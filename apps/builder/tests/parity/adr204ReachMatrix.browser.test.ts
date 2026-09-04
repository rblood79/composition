import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { useStore } from "@/builder/stores";
import type { Element } from "@/types/core/store.types";
import { type CaseNode, domLeg, pipelineLeg } from "./harness";
import {
  layoutTree,
  paletteCreationTree,
  type ProductionTree,
} from "./adr923ProductionTrees";
import { mountProductionRoot } from "./adr923PreviewLeg";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * ADR-204 Phase 3 — **G1 도달 매트릭스 Chrome 차등**.
 *
 * Phase 1 (커널 §4.5 specified size suggestion 절) + Phase 2 (가상화 collection 의 세로축 스칼라 공급)
 * 뒤, ADR 이 겨냥한 표면을 production 진입점으로 **Chrome 과 직접** 잰다. DC-6 게이트
 * (`adr923Dc6ChromeGate`) 는 DOM 쪽을 "flex column 80 > overflow > 164px 상자" 아날로그로 대신했다 —
 * 여기서는 DOM leg 도 preview 와 같은 `rendererMap` 실렌더 (실 번들 CSS + Preview 전역 reset) 다.
 *
 * 세 부류를 한 표에 둔다 (G1 통과 조건 그대로):
 *   1. **격차 행** — 제약 flex column 80 안의 collection, non-scrollable (visible / clip / Table raw):
 *      Chrome 과 ≤1px.
 *   2. **scrollable 행** — ListBox raw(auto) / *:auto: 값 불변 (80). Table 은 min-height 40 (catalog) 이라 별도 행.
 *   3. **collection 밖 대조군** — 실 자식을 가진 일반 상자 (G0 의 column definite 케이스): 회귀 0.
 *
 * DOM collection 은 height 를 지정하지 않는다 (Canvas 의 주입 높이 164 는 read-time implicitStyles 산물이고
 * preview 는 행을 실제로 그린다). 따라서 제약 없는 400 행이 두 leg 의 **콘텐츠 높이 자체**가 같은지의
 * 대조군이고, 80 행이 floor 판정이다.
 */

interface Row {
  type: string;
  overflow: string;
  parentH: number;
  scrollable: boolean;
  dom: number;
  pipeline: number;
  reachedOverflow: string;
}

const rows: Row[] = [];
let host: HTMLElement | undefined;
const roots: Root[] = [];
let trees: ProductionTree[] = [];

function underFlexColumn(
  tree: ProductionTree,
  height: number,
  overflowOverride?: string,
): { rootId: string; elements: Element[] } {
  const parentId = `adr204-g1-flex-${tree.type}-${overflowOverride ?? "raw"}-${height}`;
  const parent = {
    id: parentId,
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: 400, height },
    },
    parent_id: null,
  } as unknown as Element;
  const elements = tree.elements.map((el) => {
    if (el.id !== tree.root.id) return el;
    const props = el.props as Record<string, unknown>;
    const style = { ...((props.style as Record<string, unknown>) ?? {}) };
    if (overflowOverride !== undefined) style.overflow = overflowOverride;
    return {
      ...el,
      parent_id: parentId,
      props: { ...props, style },
    } as Element;
  });
  return { rootId: parentId, elements: [parent, ...elements] };
}

/** DOM leg — flex column(height) 호스트 안에 collection root 를 flex item 으로 직접 둔다. */
async function domCollectionHeight(
  tree: ProductionTree,
  height: number,
  overflowOverride?: string,
): Promise<number> {
  const flex = document.createElement("div");
  flex.style.cssText = `display:flex;flex-direction:column;width:400px;height:${height}px;`;
  host!.appendChild(flex);
  const elements = tree.elements.map((el) => {
    if (el.id !== tree.root.id || overflowOverride === undefined) return el;
    const props = el.props as Record<string, unknown>;
    const style = { ...((props.style as Record<string, unknown>) ?? {}) };
    style.overflow = overflowOverride;
    return { ...el, props: { ...props, style } } as Element;
  });
  const first = await mountProductionRoot(flex, roots, elements);
  if (!first) throw new Error(`${tree.type}: DOM root 없음`);
  // mountPreviewNode 의 400px block 래퍼를 지운다 — collection 자체가 flex item 이어야 §4.5 판정이 걸린다.
  const wrapper = first.parentElement as HTMLElement;
  wrapper.style.cssText = "display:contents;";
  // RAC collection 은 `<template>` (collection portal) 과 focus-scope span 을 먼저 그린다 —
  //   실제 root 는 `data-element-id` 를 가진 요소다 (rendererMap 이 root 에 단다).
  const root = wrapper.querySelector<HTMLElement>(
    `[data-element-id="${tree.root.id}"]`,
  );
  if (!root) throw new Error(`${tree.type}: DOM root 없음 (data-element-id)`);
  // RAC collection 의 행은 portal 커밋 뒤 한 틱 늦게 붙는다 (첫 마운트에서 관찰) — 행이 붙거나
  //   높이가 두 프레임 연속 같아질 때까지 기다린 뒤 잰다.
  let last = -1;
  for (let i = 0; i < 30; i++) {
    const h = root.getBoundingClientRect().height;
    const rows = root.querySelectorAll('[role="option"],[role="row"]').length;
    if (rows > 0 && h === last) break;
    last = h;
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
  return root.getBoundingClientRect().height;
}

function pipelineCollection(
  tree: ProductionTree,
  height: number,
  overflowOverride?: string,
): { h: number; reached: string } {
  const { rootId, elements } = underFlexColumn(tree, height, overflowOverride);
  const run = layoutTree(rootId, elements, 400, -1, "adr204-g1");
  const batch = run.batch.get(tree.root.id)!;
  return {
    h: run.layout.get(tree.root.id)!.height,
    reached: String(batch.style.overflowY ?? batch.style.overflow ?? "(none)"),
  };
}

function isScrollable(reached: string): boolean {
  const o = reached.toLowerCase();
  return o === "auto" || o === "scroll" || o === "hidden";
}

/** collection 밖 대조군 — flex column 80 > item(height 164, overflow) > 164 콘텐츠 상자 (G0 column). */
function generalBox(overflow: "visible" | "auto"): CaseNode[] {
  return [
    {
      label: "content",
      style: { display: "block", width: "50px", height: "164px" },
    },
    {
      label: "item",
      style: { display: "block", height: "164px", width: "50px", overflow },
      children: [0],
    },
    {
      label: "parent",
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100px",
        height: "80px",
      },
      children: [1],
    },
  ];
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr204-g1-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);

  trees = [
    await paletteCreationTree("ListBox", "adr204-g1-listbox"),
    await paletteCreationTree("GridList", "adr204-g1-gridlist"),
    await paletteCreationTree("Table", "adr204-g1-table"),
  ];
  for (const tree of trees) {
    for (const parentH of [400, 80] as const) {
      for (const ov of [undefined, "visible", "clip", "auto"] as const) {
        const pipe = pipelineCollection(tree, parentH, ov);
        const dom = await domCollectionHeight(tree, parentH, ov);
        const row: Row = {
          type: tree.type,
          overflow: ov ?? "raw",
          parentH,
          scrollable: isScrollable(pipe.reached),
          dom,
          pipeline: pipe.h,
          reachedOverflow: pipe.reached,
        };
        rows.push(row);
        console.log(
          `ADR204G1 ${row.type} ${row.parentH} overflow:${row.overflow} (reached ${row.reachedOverflow}) → dom ${row.dom} pipeline ${row.pipeline}`,
        );
      }
    }
  }
});

afterAll(async () => {
  for (const r of roots) r.unmount();
  host?.remove();
  const { server } = await import("vitest/browser");
  await server.commands.writeFile(
    "tests/parity/.artifacts/adr204-reach-matrix.json",
    JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 2),
  );
});

const key = (r: Row) => `${r.type} ${r.parentH} ${r.overflow}`;
const find = (type: string, parentH: number, overflow: string): Row => {
  const r = rows.find(
    (x) => x.type === type && x.parentH === parentH && x.overflow === overflow,
  );
  if (!r) throw new Error(`row 없음: ${type} ${parentH} ${overflow}`);
  return r;
};

describe("ADR-204 Phase 3 — G1 도달 매트릭스 (production collection × overflow × 제약 flex column, Chrome 차등)", () => {
  it("제약 없는 400 — 두 leg 의 콘텐츠 높이가 같다 (collection 의 주입 높이 = DOM 실 행 높이, 대조군)", () => {
    for (const r of rows.filter((x) => x.parentH === 400)) {
      expect(Math.abs(r.dom - r.pipeline), key(r)).toBeLessThanOrEqual(1);
    }
  });

  it("격차 행 — 제약 80 + non-scrollable (ListBox·GridList 의 raw(GridList)/visible/clip): production = Chrome (≤1px) 이고 floor 가 80 을 넘는다", () => {
    const gap = rows.filter(
      (x) => x.parentH === 80 && !x.scrollable && x.type !== "Table",
    );
    expect(gap.length).toBe(5);
    for (const r of gap) {
      expect(Math.abs(r.dom - r.pipeline), key(r)).toBeLessThanOrEqual(1);
      // floor 가 실제로 걸렸다 — 제약 80 을 넘는다 (80 이면 §4.5 절이 읽히지 않은 것).
      expect(r.pipeline, key(r)).toBeGreaterThan(80);
    }
    // GridList raw 는 DOM (GridList.css) 에 overflow 선언이 없어 non-scrollable — Canvas 도 같아야 한다
    //   (종전 implicit `overflow:hidden` 주입은 Canvas 만 scroll container 로 만들어 80 이었다).
    expect(find("GridList", 80, "raw").scrollable).toBe(false);
  });

  it("Table — DOM 외곽은 min-height 40 (catalog containerStyles) 이라 overflow 와 무관하게 80 으로 줄어든다: production 도 80 (종전 minHeight 402 주입은 402)", () => {
    for (const r of rows.filter((x) => x.type === "Table" && x.parentH === 80)) {
      expect(r.dom, key(r)).toBeCloseTo(80, 0);
      expect(r.pipeline, key(r)).toBeCloseTo(80, 0);
    }
  });

  it("scrollable 행 — ListBox raw(auto) / *:auto 는 값 불변 80 (§4.5 절이 non-scrollable 안에서만 동작)", () => {
    const scroll = rows.filter(
      (x) => x.parentH === 80 && x.scrollable && x.type !== "Table",
    );
    expect(scroll.length).toBe(3);
    for (const r of scroll) {
      expect(r.pipeline, key(r)).toBeCloseTo(80, 0);
      expect(Math.abs(r.dom - r.pipeline), key(r)).toBeLessThanOrEqual(1);
    }
    expect(find("ListBox", 80, "raw").reachedOverflow).toBe("auto");
  });

  it("collection 밖 대조군 — 실 자식 일반 상자 (G0 column definite): visible 164/164 · auto 80/80 회귀 0", () => {
    const visible = generalBox("visible");
    const auto = generalBox("auto");
    const vDom = domLeg(visible, 400)[1].h;
    const vPipe = pipelineLeg(visible, 400, -1)[1].h;
    const aDom = domLeg(auto, 400)[1].h;
    const aPipe = pipelineLeg(auto, 400, -1)[1].h;
    console.log(
      `ADR204G1 control visible dom ${vDom} pipeline ${vPipe} · auto dom ${aDom} pipeline ${aPipe}`,
    );
    expect(vDom).toBeCloseTo(164, 0);
    expect(vPipe).toBeCloseTo(164, 0);
    expect(aDom).toBeCloseTo(80, 0);
    expect(aPipe).toBeCloseTo(80, 0);
  });
});
