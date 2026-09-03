import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import indexCssSource from "@composition/shared/components/styles/index.css?raw";

import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { allPaletteCreationTrees } from "./adr923ProductionTrees";
import { mountProductionRoot } from "./adr923PreviewLeg";
import { rendererMap } from "@composition/shared/renderers";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * ADR-923 Phase 5 후속 착수 9 (2026-09-04) — **생성 CSS 가 실제 DOM 에 닿는가** 를 live 로 가른다.
 *
 * 착수 시점 사실: `generated/*.css` 93 개 중 `styles/index.css` 가 import 하는 것은 66 개다. 나머지 27 은
 * 번들에 실리지 않아 **런타임 기여가 0** 이다. "그러니 지워도 되는 정리 대상" 으로 보이지만, 그 판정은
 * 파일 목록으로 못 한다 — 클래스가 DOM 에 실제로 붙는데 CSS 만 안 실려 있으면 그건 정리가 아니라
 * **미배선 결함**이고, 지우면 D3 값이 DOM 에 도달할 채널을 영구히 잃는다.
 *
 * 렌더러 코드 grep 으로도 안 갈린다 (메모리 `feedback-collection-subpart-not-all-homomorphic-dom-class`
 * — dead/live 판정은 live DOM 으로, `feedback-grep-zero-refs-is-not-dead-code`). 그래서 팔레트 전수
 * production 트리를 preview 실경로 (`rendererMap`) 로 마운트하고 `.react-aria-{name}` 이 실제로 붙는지 센다.
 *
 * **이 sweep 이 못 보는 것**: 팔레트 기본 상태뿐이다. 상태 의존 자식 (FieldError 는 invalid 일 때만) ·
 * 팔레트 밖 표면 (Toast · overlay) · 팔레트에 없는 type 은 dom 0 으로 나온다. 그래서 dom 0 을 "dead" 라고
 * 부르지 않고 **`unobserved`** 로 둔다 — 삭제 근거가 아니라 "이 sweep 으로는 못 봤다" 는 기록이다.
 *
 * 게이트는 숫자가 아니라 **분류**를 고정한다: 새 미import 생성물이 생기면 셋 중 하나로 답해야 통과한다.
 */

const HOST_W = 400;

/** import 가 없어 번들에 안 실리는 생성물. */
function unimportedGeneratedNames(): string[] {
  const imported = new Set(
    [...indexCssSource.matchAll(/generated\/([A-Za-z-]+)\.css/g)].map(
      (m) => m[1],
    ),
  );
  return Object.keys(
    import.meta.glob(
      "@composition/shared/components/styles/generated/*.css",
      { query: "?raw", eager: false },
    ),
  )
    .map((p) =>
      p
        .split("/")
        .pop()!
        .replace(/\.css$/, ""),
    )
    .filter((n) => !imported.has(n))
    .sort();
}

/**
 * live 로 갈린 분류의 정본 (2026-09-04 측정, artifact `adr923-generated-css-reach.json`).
 *
 * - `covered` — 클래스가 있고, **다른 실린 CSS** 가 이미 담당한다 (base.css · parent delegation).
 * - `gap` — 클래스가 DOM 에 붙는데 담당 CSS 가 번들에 없다. **미배선 결함** — 삭제 대상이 아니다.
 * - `unobserved` — 이 sweep (팔레트 기본 상태) 에서 클래스를 못 봤다. dead 라는 뜻이 **아니다**:
 *   상태 의존 자식 · 팔레트 밖 표면 · 팔레트 미등재 type 이 전부 여기로 떨어진다. 삭제하려면 그 type 의
 *   실제 표면을 따로 열어 확인해야 한다.
 */
const EXPECTED: Readonly<Record<string, "covered" | "gap" | "unobserved">> = {
  Avatar: "unobserved",
  AvatarGroup: "unobserved",
  Body: "unobserved",
  Breadcrumb: "gap",
  ButtonGroup: "unobserved",
  CalendarHeader: "unobserved",
  CardView: "unobserved",
  DialogFooter: "unobserved",
  DisclosureHeader: "unobserved",
  DropZone: "gap",
  FieldError: "covered",
  FileTrigger: "unobserved",
  FormField: "unobserved",
  IllustratedMessage: "unobserved",
  Image: "unobserved",
  Input: "covered",
  MeterTrack: "unobserved",
  MeterValue: "unobserved",
  Nav: "unobserved",
  ProgressBarTrack: "unobserved",
  ProgressBarValue: "unobserved",
  ProgressCircle: "unobserved",
  Section: "unobserved",
  Skeleton: "gap",
  StatusLight: "unobserved",
  TailSwatch: "unobserved",
  Toast: "unobserved",
};

let host: HTMLElement;
const roots: Root[] = [];
/** name → production DOM 에서 발견된 요소 수. */
const domHits = new Map<string, number>();
/** name → 번들 CSS 안의 `.react-aria-{name}` 규칙 수. */
const bundleRules = new Map<string, number>();
/** rendererMap 항목이 없어 preview 경로로 마운트되지 않은 팔레트 type. */
const unmountable: string[] = [];

beforeAll(async () => {
  await initCompositionEngineWasm();

  const style = document.createElement("style");
  style.id = "adr923-generated-reach-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);

  host = document.createElement("div");
  host.style.cssText = `position:absolute;top:0;left:0;width:${HOST_W}px;`;
  document.body.appendChild(host);

  const trees = await allPaletteCreationTrees("gencss");
  for (const tree of trees) {
    const rootType = tree.elements[0]?.type ?? "";
    // preview 는 rendererMap 을 먼저 찾는다 — 항목이 없는 type 은 이 경로로 DOM 에 나오지 않는다.
    if (!(rootType in rendererMap)) {
      unmountable.push(rootType);
      continue;
    }
    // Slot 은 frame 편집에서만 placeholder 를 그린다 — 그 상태로 마운트한다.
    const editMode = rootType === "Slot" ? "layout" : "page";
    await mountProductionRoot(host, roots, tree.elements, editMode);
  }

  for (const name of unimportedGeneratedNames()) {
    domHits.set(name, host.querySelectorAll(`.react-aria-${name}`).length);
    bundleRules.set(
      name,
      [...bundleCss.matchAll(new RegExp(`\\.react-aria-${name}\\b`, "g"))]
        .length,
    );
  }
});

afterAll(async () => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("adr923-generated-reach-bundle")?.remove();
  const { server } = await import("vitest/browser");
  await server.commands.writeFile(
    "tests/parity/.artifacts/adr923-generated-css-reach.json",
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        unmountable,
        rows: unimportedGeneratedNames().map((name) => ({
          name,
          expected: EXPECTED[name] ?? null,
          domHits: domHits.get(name) ?? 0,
          bundleRules: bundleRules.get(name) ?? 0,
        })),
      },
      null,
      2,
    ),
  );
});

describe("ADR-923 — 미import 생성 CSS 의 DOM 도달 (live 분류)", () => {
  it("캡처 — 미import 생성물 전부가 분류표에 있다", () => {
    const names = unimportedGeneratedNames();
    for (const name of names) {
      console.log(
        `ADR923GENCSS ${name} class=${EXPECTED[name] ?? "(미분류)"} domHits=${domHits.get(name)} bundleRules=${bundleRules.get(name)}`,
      );
    }
    console.log(`ADR923GENCSS unmountable=${unmountable.join(",") || "(없음)"}`);
    expect(names.length).toBeGreaterThan(0);
    const unclassified = names.filter((n) => !(n in EXPECTED));
    expect(
      unclassified,
      "새 미import 생성물 — dead / covered / gap 중 하나로 답해야 한다",
    ).toEqual([]);
    const stale = Object.keys(EXPECTED).filter((n) => !names.includes(n));
    expect(stale, "분류표에만 남은 이름 (import 됐거나 삭제됨)").toEqual([]);
  });

  it("covered — 클래스가 붙고 담당 CSS 가 번들에 있다", () => {
    for (const [name, kind] of Object.entries(EXPECTED)) {
      if (kind !== "covered") continue;
      expect(bundleRules.get(name) ?? 0, `${name} 번들 담당 규칙 수`).toBeGreaterThan(0);
    }
  });

  it("gap — 클래스는 DOM 에 붙는데 담당 CSS 가 번들에 없다 (미배선 결함, 삭제 대상 아님)", () => {
    for (const [name, kind] of Object.entries(EXPECTED)) {
      if (kind !== "gap") continue;
      expect(domHits.get(name) ?? 0, `${name} DOM 출현 수`).toBeGreaterThan(0);
      expect(bundleRules.get(name) ?? 0, `${name} 번들 담당 규칙 수`).toBe(0);
    }
  });

  it("unobserved — 이 sweep 에서 클래스를 못 봤다 (dead 라는 뜻이 아니다)", () => {
    const observed: string[] = [];
    for (const [name, kind] of Object.entries(EXPECTED)) {
      if (kind !== "unobserved") continue;
      if ((domHits.get(name) ?? 0) > 0) {
        observed.push(`${name} (domHits ${domHits.get(name)})`);
      }
    }
    // 여기 걸리면 그 이름은 covered/gap 중 하나로 승격해야 한다 — 분류가 사실보다 낡았다는 신호.
    expect(observed, "unobserved 인데 이 sweep 에서 클래스가 보였다").toEqual([]);
  });

});
