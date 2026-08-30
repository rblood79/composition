// @vitest-environment node
/**
 * ADR-199 Phase 4 — 투영 불변식 게이트.
 *
 * 같은 노드인데 표면마다 다른 답이 나오는 회귀가 2026-08-30 하루에 두 번 났고,
 * 둘 다 원인이 **술어의 입력이 표면마다 다른 사영**이라는 점이었다:
 *
 * 1. `canDetachInstance` 가 `type === "ref"` 를 읽었는데 캔버스 상호작용 map 은
 *    Skia `interactionNodesMap` 파생이라 `type` 이 렌더 컴포넌트(`"Button"`)로
 *    해소된다 → "인스턴스 분리" 가 캔버스 표면에서만 통째로 사라졌다.
 * 2. `resolveCanonicalRefElement` 가 원본의 `reusable` 누수를 막으려고 필드를
 *    통째로 지워, 자신이 승격된 dual 노드에서 캔버스 메뉴만 "컴포넌트 만들기"
 *    (이미 원본인 노드를 다시 원본으로 만드는 no-op) 를 띄웠다 (R7).
 *
 * 그래서 두 조항을 기계로 집행한다:
 *
 * - **술어는 `type` 을 읽지 않는다** — 사영마다 값이 달라지는 필드다.
 * - **사영은 시맨틱 축을 싣는다** — 술어가 옳아도 입력이 필드를 잃으면 같다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveCanonicalRefElement } from "../canonicalRefResolution";
import {
  canDetachInstance,
  getEditingSemanticsOriginId,
  isEditingSemanticsInstance,
  isEditingSemanticsOrigin,
} from "../editingSemantics";

const SOURCE = readFileSync(
  resolve(__dirname, "../editingSemantics.ts"),
  "utf-8",
);

/** 사영 불변 필드만 읽어야 하는 술어 — 액션 가용성 판정의 입력 4종. */
const PROJECTION_INVARIANT_PREDICATES = [
  "isEditingSemanticsInstance",
  "isEditingSemanticsOrigin",
  "canDetachInstance",
  "getEditingSemanticsOriginId",
] as const;

/**
 * **같은 파일의 의도적 예외** — 사영 입력을 받지 않는 함수들.
 *
 * 새 항목을 넣으려면 "이 함수의 입력이 사영을 거치지 않는다" 를 근거와 함께
 * 적는다. 적을 수 없으면 예외가 아니라 수리 대상이다.
 */
const TYPE_READ_ALLOWLIST: ReadonlyArray<{
  fn: string;
  reason: string;
}> = [
  {
    fn: "hasEditingSlotMarker",
    reason:
      "`type === \"Slot\"` 은 시맨틱 축이 아니라 노드 종류 자체다. Slot 은 사영이 다른 타입으로 해소하지 않는다.",
  },
  {
    fn: "getCanonicalOverrideFieldKeys",
    reason: "`type` 을 override 키 집합에서 제외하려고 구조 분해만 한다 (읽지 않는다).",
  },
  {
    fn: "getEditingSemanticsOverrideFields",
    reason:
      "override 목록은 Properties 패널 한 곳만 소비한다 (`ComponentSemanticsSection.tsx:130`). 입력이 canonical property element 라 사영을 거치지 않는다.",
  },
  {
    fn: "getEditingSemanticsOverrideItems",
    reason: "위와 같은 소비 경로 (같은 호출부 1곳).",
  },
];

function bodyOf(fn: string): string {
  const start = SOURCE.indexOf(`function ${fn}(`);
  if (start < 0) throw new Error(`함수를 찾지 못했다: ${fn}`);
  const open = SOURCE.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < SOURCE.length; i += 1) {
    if (SOURCE[i] === "{") depth += 1;
    if (SOURCE[i] === "}") {
      depth -= 1;
      if (depth === 0) return SOURCE.slice(open, i + 1);
    }
  }
  throw new Error(`본문 끝을 찾지 못했다: ${fn}`);
}

/** 주석 제거 — 규칙을 설명하는 주석에 `type` 이 나오는 것은 위반이 아니다. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("ADR-199 HC3 — 술어는 사영 불변 필드만 읽는다", () => {
  it.each(PROJECTION_INVARIANT_PREDICATES)("%s 는 type 을 읽지 않는다", (fn) => {
    expect(stripComments(bodyOf(fn))).not.toMatch(/\btype\b/);
  });

  it("예외 목록은 사유를 갖는다 (빈 사유로 늘리지 못한다)", () => {
    for (const entry of TYPE_READ_ALLOWLIST) {
      expect(entry.reason.length, entry.fn).toBeGreaterThan(20);
      expect(SOURCE).toContain(`function ${entry.fn}(`);
    }
  });

  it("type 을 읽는 함수는 술어 4종 밖 + 예외 목록 안에만 있다", () => {
    const named = [
      ...SOURCE.matchAll(/(?:export )?function (\w+)\(/g),
    ].map((m) => m[1]);
    const readsType = named.filter((fn) =>
      /\btype\b/.test(stripComments(bodyOf(fn))),
    );
    const allowed = new Set(TYPE_READ_ALLOWLIST.map((e) => e.fn));
    expect(readsType.filter((fn) => !allowed.has(fn))).toEqual([]);
  });
});

describe("ADR-199 HC3 — 사영 3종이 같은 답을 준다", () => {
  const ORIGIN = { id: "origin", type: "Button", reusable: true, props: {} };

  /**
   * 3종 사영:
   * - canonical: 문서 그대로 (`type:"ref"` + `ref`)
   * - resolved: 캔버스/Preview 가 보는 해소 결과 (`type` 이 원본 컴포넌트로 바뀐다)
   * - legacyMirror: elementsMap mirror (`componentRole`/`masterId`)
   */
  function projections(node: Record<string, unknown>) {
    const canonical = node;
    const resolved = resolveCanonicalRefElement(node as never, [
      ORIGIN,
      node,
    ] as never) as Record<string, unknown>;
    const legacyMirror = {
      id: node.id,
      type: ORIGIN.type,
      componentRole: "instance",
      masterId: ORIGIN.id,
      ...(node.reusable === true ? { reusable: true } : {}),
    };
    return { canonical, resolved, legacyMirror };
  }

  it("인스턴스 — 세 사영 모두 instance 축이 참, 분리 가능", () => {
    const views = projections({
      id: "instance",
      type: "ref",
      ref: "origin",
      props: {},
    });
    for (const [name, view] of Object.entries(views)) {
      expect(isEditingSemanticsInstance(view), name).toBe(true);
      expect(canDetachInstance(view), name).toBe(true);
      expect(isEditingSemanticsOrigin(view), name).toBe(false);
      expect(getEditingSemanticsOriginId(view), name).toBe("origin");
    }
  });

  it("인스턴스이면서 원본 — 세 사영 모두 두 축이 참 (R7 회귀 방지)", () => {
    const views = projections({
      id: "promoted",
      type: "ref",
      ref: "origin",
      reusable: true,
      props: {},
    });
    for (const [name, view] of Object.entries(views)) {
      expect(isEditingSemanticsInstance(view), name).toBe(true);
      expect(isEditingSemanticsOrigin(view), name).toBe(true);
    }
  });

  it("해소 결과에 원본의 reusable 이 새지 않는다", () => {
    const { resolved } = projections({
      id: "instance",
      type: "ref",
      ref: "origin",
      props: {},
    });
    expect(resolved.reusable).toBeUndefined();
    // 해소는 type 을 원본 컴포넌트로 바꾼다 — 술어가 type 을 읽으면 안 되는 이유
    expect(resolved.type).toBe("Button");
  });
});
