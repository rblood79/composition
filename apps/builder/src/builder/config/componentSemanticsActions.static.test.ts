// @vitest-environment node
/**
 * ADR-199 Phase 5 — 표면 파생 동일성 게이트.
 *
 * 레지스트리를 세워도 새 코드가 안 쓰면 반쪽이다. 오늘 회귀 (액션 바에만
 * `toggle-component-origin` 이 빠지고 순서도 패널과 달랐던 것) 는 사람이
 * allowlist 를 손으로 맞추는 구조에서 나왔다. 그래서 세 조항을 기계로 집행한다:
 *
 * 1. **표면 소스에 라벨 리터럴 0건** — 문자열을 다시 쓰는 순간 갈린다.
 * 2. **바 순서 == 레지스트리 순서** — 같은 묶음이 표면마다 다른 순서로 서지 않게.
 * 3. **패널 전용 id 는 메뉴·바 계약에 들어가지 않는다** — 항목 집합을 조용히
 *    늘리면 HC5 (이관 전후 항목 집합 동일) 가 깨진다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ACTION_BAR_ALLOWLIST,
  type ActionBarContext,
} from "../components/overlay/actionBar/actionBarPolicy";
import { COMPONENT_SEMANTICS_ACTIONS } from "./componentSemanticsActions";
import { SHORTCUT_DEFINITIONS } from "./keyboardShortcuts";

const BUILDER_SRC = resolve(__dirname, "../..");

/** 레지스트리가 소유한 문자열 — 표면 소스에 다시 나타나면 안 된다. */
const LABEL_LITERALS = [
  "Go to component",
  "Detach instance",
  "Create component",
  "Detach component",
  "Select instances",
  "원본으로 이동",
  "인스턴스 분리",
  "컴포넌트 만들기",
  "컴포넌트 분리",
];

/** 컴포넌트 액션을 그리는 표면 3곳. */
const SURFACE_SOURCES = [
  "builder/panels/properties/ComponentSemanticsSection.tsx",
  "builder/workspace/canvas/contextMenu/canvasContextMenuProviders.ts",
  "builder/components/overlay/actionBar/actionBarPolicy.ts",
];

/** 주석 제거 — 규칙을 설명하는 주석의 인용은 위반이 아니다. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("ADR-199 — 표면은 항목을 다시 정의하지 않는다", () => {
  it.each(SURFACE_SOURCES)("%s 에 라벨 리터럴 0건", (rel) => {
    const code = stripComments(readFileSync(resolve(BUILDER_SRC, rel), "utf-8"));
    const hits = LABEL_LITERALS.filter((label) => code.includes(label));
    expect(hits, `${rel} 이 라벨을 직접 쓴다`).toEqual([]);
  });

  it("바의 컴포넌트 축 순서 == 레지스트리 순서", () => {
    const registryBarIds = COMPONENT_SEMANTICS_ACTIONS.filter((action) =>
      action.surfaces.includes("action-bar"),
    ).map((action) => action.id);
    const barComponentIds = ACTION_BAR_ALLOWLIST.instance.filter((id) =>
      registryBarIds.includes(id as (typeof registryBarIds)[number]),
    );
    expect(barComponentIds).toEqual(registryBarIds);
  });

  it("패널 전용 id 는 어떤 바 컨텍스트에도 실리지 않는다 (HC5)", () => {
    const panelOnly = COMPONENT_SEMANTICS_ACTIONS.filter(
      (action) => !action.surfaces.includes("action-bar"),
    ).map((action) => action.id);
    for (const context of Object.keys(
      ACTION_BAR_ALLOWLIST,
    ) as ActionBarContext[]) {
      for (const id of panelOnly) {
        expect(ACTION_BAR_ALLOWLIST[context], context).not.toContain(id);
      }
    }
  });

  it("commandId 는 명령 축의 실제 id 다 (두 축은 같은 문자열로 만난다)", () => {
    const shortcutIds = new Set(Object.keys(SHORTCUT_DEFINITIONS));
    for (const action of COMPONENT_SEMANTICS_ACTIONS) {
      if (!action.commandId) continue;
      expect(shortcutIds.has(action.commandId), action.id).toBe(true);
    }
  });

  it("실행 경로는 러너 한 곳 — 표면이 store 액션을 직접 부르지 않는다", () => {
    for (const rel of SURFACE_SOURCES) {
      const code = stripComments(
        readFileSync(resolve(BUILDER_SRC, rel), "utf-8"),
      );
      expect(code, rel).not.toMatch(/\.detachInstance\(/);
      expect(code, rel).not.toMatch(/\.toggleComponentOrigin\(/);
    }
  });
});
