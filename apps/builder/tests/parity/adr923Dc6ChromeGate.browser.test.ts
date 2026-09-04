import { beforeAll, describe, expect, it, vi } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { useStore } from "@/builder/stores";
import type { Element } from "@/types/core/store.types";
import { type CaseNode, diffCase, domLeg, pipelineLeg } from "./harness";
import {
  layoutTree,
  paletteCreationTree,
  type ProductionTree,
} from "./adr923ProductionTrees";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * ADR-923 Phase 5 — **DC-6 overflow cap 제거의 Chrome 회귀 게이트** (breakdown Phase 5 항목 1).
 *
 * Phase 4 인벤토리 (`adr923Dc6OverflowCapInventory`) 가 cap 이 실제로 걸리던 노드 8 을 찾았다:
 * SelectValue 4 (flex 문맥) · ListBox/GridList 2 (production 형태의 scroll container) · 사용자 inline
 * Button 2 (block 문맥). cap 은 엔진 flex §4.5 automatic minimum 의 TS 중복이면서 block 문맥에도 걸고
 * clip 을 hidden 과 같이 취급했다. 제거 뒤 각 형태가 CSS 와 같게 동작하는지를 세 케이스로 고정한다:
 *
 * 1. **block 문맥 auto-height + overflow hidden/clip/auto 는 cap 되지 않는다** — Chrome ground truth
 *    (`harness.domLeg`) ↔ production 경로 (`pipelineLeg`) 를 1px 로 대조. 부모가 20px 로 낮아도
 *    자식(Text leaf, 3 줄) 의 높이는 콘텐츠 높이다 (종전 TS cap 은 20 으로 잘랐다).
 * 2. **flex 문맥 scroll container 는 엔진 §4.5 가 automatic minimum 0 으로 소비한다** (round 30
 *    r30l3 문맥 명시): production ListBox (`overflow:auto`, raw) / GridList (`overflow:hidden`,
 *    implicitStyles 주입) 서브트리를 **main-axis 크기가 제한된 flex column 부모의 item** 으로 두면
 *    행 높이 164 를 주입받아도 부모 80 에 맞춰 줄어든다; 같은 서브트리를 `overflow:visible` / `clip`
 *    (scroll container 아님 — r9h1) 으로 바꾸면 min-content 바닥 164 가 유지된다. 같은 의미의 DOM
 *    아날로그 (flex column 80 > div overflow:auto > 164px 상자) 를 Chrome 과 대조해 의미가 CSS 와
 *    같음을 보인다 — `is_scroll_container` (`tree.rs`) 는 §4.5 의 입력이지 대안이 아니다.
 * 3. **SelectValue (flex row 의 cross axis)** — production Select 트리에서 SelectValue 의 주입 높이는
 *    root availableHeight 에 무관하다 (종전 availH 8 에서 Hcapped).
 */

const TEXT = "aaaaaaaaaa bbbbbbbbbb cccccccccc";

function blockAutoHeightCase(overflow: "hidden" | "clip" | "auto"): CaseNode[] {
  return [
    {
      label: "text",
      elementType: "Text",
      text: TEXT,
      style: {
        overflow,
        fontSize: "16px",
        lineHeight: "20px",
        fontFamily: "monospace",
      },
    },
    {
      label: "parent",
      style: { display: "block", width: "100px", height: "20px" },
      children: [0],
    },
  ];
}

/** DOM 아날로그 — flex column 80 > div(overflow) > 164px 상자. */
function flexScrollAnalog(
  overflow: "auto" | "hidden" | "visible" | "clip",
): CaseNode[] {
  return [
    {
      label: "inner",
      style: { display: "block", width: "100px", height: "164px" },
    },
    {
      label: "scroller",
      style: { display: "block", overflow, width: "100px" },
      children: [0],
    },
    {
      label: "flex",
      style: {
        display: "flex",
        flexDirection: "column",
        width: "200px",
        height: "80px",
      },
      children: [1],
    },
  ];
}

function underFlexColumn(
  tree: ProductionTree,
  height: number,
  overflowOverride?: string,
): { rootId: string; elements: Element[] } {
  const parentId = `dc6-flex-${tree.type}-${overflowOverride ?? "raw"}`;
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

let listBox: ProductionTree;
let gridList: ProductionTree;
let select: ProductionTree;

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  listBox = await paletteCreationTree("ListBox", "dc6-gate-listbox");
  gridList = await paletteCreationTree("GridList", "dc6-gate-gridlist");
  select = await paletteCreationTree("Select", "dc6-gate-select");
});

describe("ADR-923 Phase 5 — DC-6 overflow cap 제거 (Chrome 게이트)", () => {
  it.each(["hidden", "clip", "auto"] as const)(
    "block 문맥 auto-height + overflow:%s — 자식 높이는 콘텐츠 높이 (부모 20px 로 cap 되지 않는다), Chrome 과 1px",
    (overflow) => {
      const nodes = blockAutoHeightCase(overflow);
      const dom = domLeg(nodes, 400);
      const pipe = pipelineLeg(nodes, 400, -1);
      console.log(
        `ADR923DC6GATE block overflow:${overflow} dom text h=${dom[0].h} pipe text h=${pipe[0].h}`,
      );
      expect(pipe[0].h).toBeGreaterThan(20 + 1); // cap 없음
      expect(diffCase(nodes, dom, pipe)).toEqual([]);
    },
  );

  it("flex column 안 production ListBox(overflow:auto) / GridList(overflow:hidden): 주입 높이 164 는 specified size 로 경계에 닿고, 부모 80 에서는 §4.5 automatic minimum 0 으로 80 에 맞춰 준다", () => {
    const facts: Record<
      string,
      { h: number; reached: string; specified: string }
    > = {};
    for (const tree of [listBox, gridList]) {
      for (const parentH of [400, 80] as const) {
        for (const ov of [undefined, "visible", "clip"] as const) {
          const { rootId, elements } = underFlexColumn(tree, parentH, ov);
          const run = layoutTree(rootId, elements, 400, -1, "dc6-gate");
          const rootBatch = run.batch.get(tree.root.id)!;
          const fact = {
            h: run.layout.get(tree.root.id)!.height,
            reached: String(
              rootBatch.style.overflowY ?? rootBatch.style.overflow,
            ),
            specified: String(rootBatch.style.height),
          };
          facts[`${tree.type} ${parentH} ${ov ?? "raw"}`] = fact;
          console.log(
            `ADR923DC6GATE flex${parentH} ${tree.type} overflow:${ov ?? "raw"} → reached overflow ${fact.reached} specified height ${fact.specified} → height ${fact.h}`,
          );
        }
      }
    }
    // raw 형태의 overflow 가 그대로 경계에 닿는다 (ListBox auto 는 raw props) — cap 없이 specified
    //   height 164 도 그대로. GridList 는 ADR-204 G1 (2026-09-04) 에서 implicit `overflow:hidden`
    //   주입을 제거했다 — DOM `.react-aria-GridList` (GridList.css) 에 overflow 선언이 없어
    //   non-scrollable 이 production 사실이다 (`adr204ReachMatrix.browser.test.ts` Chrome 대조).
    expect(facts["ListBox 400 raw"].reached).toBe("auto");
    expect(facts["GridList 400 raw"].reached).toBe("undefined");
    for (const key of ["ListBox 400 raw", "GridList 400 raw"]) {
      expect(facts[key].specified, key).toBe("164px");
      expect(facts[key].h, key).toBeCloseTo(164, 0); // 제약 없는 부모 → 주입 높이 그대로
    }
    // main-axis 가 제한된 부모 80: scroll container (auto/hidden) 는 §4.5 automatic minimum 0 → 80.
    //   종전 TS cap 도 80 을 냈지만 그건 availableHeight 로 자른 결과였고, 지금은 엔진 §4.5 소비다
    //   (specified 164 가 경계에 닿은 채 flex 축소 — 위 400 케이스가 cap 부재의 증거).
    expect(facts["ListBox 80 raw"].h).toBeCloseTo(80, 0);
    // GridList raw 는 non-scrollable (위) → §4.5 floor = min(specified 164, content 164) = 164
    //   (Chrome 164, ADR-204 G1). 종전 80 은 Canvas 만의 hidden 주입에 고정된 값이었다.
    expect(facts["GridList 80 raw"].h).toBeCloseTo(164, 0);
    // ADR-204 Phase 2 (2026-09-04) — 종전 사실 고정은 "visible/clip 도 80" 이었다 (ADR-923 범위 밖
    //   발산 기록: production collection 의 행이 가상화라 엔진 content 제안 0 → floor 0, DOM 은 행이
    //   실 자식이라 min-content 164). 이제 enrich 가 collection owner 에 세로축 정확 min-content
    //   (`contentMinHeight` = 행 수 × stride, 투영과 같은 심볼) 를 싣고 엔진 §4.5 specified size
    //   suggestion 절이 floor = min(specified 164, 164) 를 둔다 → non-scrollable 은 **164** (위 DOM
    //   아날로그 visible/clip 164 와 같다). scroll container 행 (raw) 은 여전히 80 — 절이 §4.5 조건
    //   (non-scrollable) 안에서만 동작한다는 대조군. 원복 (enrich 공급 제거 / 커널 절 제거) 은 80.
    for (const key of [
      "ListBox 80 visible",
      "ListBox 80 clip",
      "GridList 80 visible",
      "GridList 80 clip",
    ]) {
      expect(facts[key].h, key).toBeCloseTo(164, 0);
    }
  });

  it.each(["auto", "hidden", "visible", "clip"] as const)(
    "DOM 아날로그 (flex column 80 > overflow:%s > 164px) — production 경로 = Chrome (scroll container 만 80)",
    (overflow) => {
      const nodes = flexScrollAnalog(overflow);
      const dom = domLeg(nodes, 400);
      const pipe = pipelineLeg(nodes, 400, -1);
      console.log(
        `ADR923DC6GATE analog overflow:${overflow} dom scroller h=${dom[1].h} pipe scroller h=${pipe[1].h}`,
      );
      if (overflow === "auto" || overflow === "hidden") {
        expect(dom[1].h).toBeCloseTo(80, 0);
      } else {
        expect(dom[1].h).toBeCloseTo(164, 0);
      }
      expect(diffCase(nodes, dom, pipe)).toEqual([]);
    },
  );

  it.each(["hidden", "clip"] as const)(
    "block 부모 10px 안 catalog Button + inline overflow:%s (INTRINSIC leaf) — 주입 높이 30 은 availableHeight 에 무관 (종전 Hcapped)",
    (overflow) => {
      // 인벤토리 arm "inline Button overflow" 의 production 형태 — 텍스트 leaf 와 달리 INTRINSIC_MEASURE 분기의
      //   height 주입을 타므로 종전 cap (availableHeight 10 으로 절단) 의 회귀 게이트다.
      const parent = {
        id: `dc6-gate-btn-parent-${overflow}`,
        type: "div",
        props: { style: { display: "block", width: 400, height: 10 } },
        parent_id: null,
      } as unknown as Element;
      const button = {
        id: `dc6-gate-btn-${overflow}`,
        type: "Button",
        props: { children: "Overflow", style: { overflow } },
        parent_id: parent.id,
      } as unknown as Element;
      const low = layoutTree(parent.id, [parent, button], 400, 10, "dc6-gate");
      const high = layoutTree(
        parent.id,
        [parent, button],
        400,
        100000,
        "dc6-gate",
      );
      const hLow = low.layout.get(button.id)!.height;
      const hHigh = high.layout.get(button.id)!.height;
      console.log(
        `ADR923DC6GATE block10 Button overflow:${overflow} h availH10=${hLow} availH1e5=${hHigh} reached ${String(low.batch.get(button.id)!.style.height)}`,
      );
      expect(hLow).toBe(hHigh);
      expect(hLow).toBeGreaterThan(10 + 1);
    },
  );

  it("production Select 의 SelectValue 높이는 root availableHeight 에 무관하다 (종전 availH 8 에서 cap)", () => {
    const low = layoutTree(select.root.id, select.elements, 400, 8, "dc6-gate");
    const high = layoutTree(
      select.root.id,
      select.elements,
      400,
      100000,
      "dc6-gate",
    );
    const sv = select.elements.find((el) => el.type === "SelectValue");
    expect(sv, "SelectValue").toBeTruthy();
    const hLow = low.layout.get(sv!.id)!.height;
    const hHigh = high.layout.get(sv!.id)!.height;
    console.log(
      `ADR923DC6GATE SelectValue h availH8=${hLow} availH1e5=${hHigh}`,
    );
    expect(hLow).toBe(hHigh);
    expect(hLow).toBeGreaterThan(8);
  });
});
