import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  diffCase,
  domLeg,
  engineLeg,
  pipelineLeg,
  type CaseNode,
  type ParityCase,
} from "./harness";

/**
 * flex 교차축 — **내용이 컨테이너 cross 를 넘길 때** (CSS-FLEXBOX §9.4 step 8 + §8.3)
 *
 * `flexSweep` 는 이 영역을 의도적으로 비켜간다 (definite cross 를 줄 합보다 크게 잡음 —
 * 음수 free space 는 정합 region 밖이라 명시). 그래서 "라인 cross 가 컨테이너 cross 를
 * 넘는" 형태가 sweep 에 한 번도 안 걸렸다.
 *
 * §9.4 step 8 은 **대입**이다 — "If the flex container is single-line and has a definite
 * cross size, the outer cross size of the flex line **is** the flex container's inner cross
 * size". 라인이 컨테이너보다 커도 라인 cross 는 컨테이너 cross 이고, 넘치는 아이템은 그
 * 라인 밖으로 흘러넘친다. 라인을 아이템에 맞춰 키우면 `align-items:stretch` 가 그 커진
 * 라인을 채우게 되어 **auto-cross 아이템이 내용까지 자란다** (CSS 는 컨테이너에서 자름).
 *
 * 프리셋 row 레이아웃에서 실제로 닿는 형태다 — 확정 높이 밴드 안의 auto-height 자식.
 */

/** root(block, 확정) > container(flex, 확정 cross) > item(cross auto) > 내용(고정 cross) */
function overflowCase(
  name: string,
  dir: "row" | "column",
  alignItems: string,
  contentCross: number,
  containerCross: string,
): ParityCase {
  const isRow = dir === "row";
  const crossProp = isRow ? "height" : "width";
  const mainProp = isRow ? "width" : "height";

  const nodes: CaseNode[] = [
    {
      label: "content",
      style: {
        width: "50px",
        height: "40px",
        [crossProp]: `${contentCross}px`,
      },
    },
    { label: "item", style: { [mainProp]: "80px" }, children: [0] },
    {
      label: "container",
      style: {
        display: "flex",
        flexDirection: dir,
        flexWrap: "nowrap",
        alignItems,
        [mainProp]: isRow ? "300px" : "200px",
        [crossProp]: containerCross,
      },
      children: [1],
    },
    {
      label: "root",
      style: { display: "block", width: "400px", height: "500px" },
      children: [2],
    },
  ];

  return { name, availW: 400, availH: 500, nodes };
}

const CASES: ParityCase[] = [
  // ── row: cross = height ──
  overflowCase("row/stretch 내용<컨테이너", "row", "stretch", 50, "100px"),
  overflowCase("row/stretch 내용>컨테이너", "row", "stretch", 300, "100px"),
  overflowCase(
    "row/flex-start 내용>컨테이너",
    "row",
    "flex-start",
    300,
    "100px",
  ),
  overflowCase("row/stretch 컨테이너 auto", "row", "stretch", 300, "auto"),
  // ── column: cross = width ──
  overflowCase(
    "column/stretch 내용<컨테이너",
    "column",
    "stretch",
    60,
    "150px",
  ),
  overflowCase(
    "column/stretch 내용>컨테이너",
    "column",
    "stretch",
    300,
    "150px",
  ),
  overflowCase(
    "column/flex-start 내용>컨테이너",
    "column",
    "flex-start",
    300,
    "150px",
  ),
];

describe("flex 교차축 overflow — CSS 대조", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(CASES.map((c) => [c.name, c] as const))(
    "engine leg — %s",
    (_name, c) => {
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        engineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))(
    "pipeline leg — %s",
    (_name, c) => {
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        pipelineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    },
  );
});
