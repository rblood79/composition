import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type CaseNode,
  type ParityCase,
  type StyleRecord,
  runParityCase,
  runPipelineParityCase,
} from "./harness";

/**
 * ADR-156 옵션 3-a — E2 grid justify(가로 배치·폭) 엔진↔CSS 정합.
 *
 * 3-b 는 세로 align 만 구현하고 가로 justify·폭 respect 를 §Residual 로 남겼다. §Residual 은
 * "JS DFS 가 grid 자식 폭을 트랙 폭으로 강제 → 엔진이 justify 를 더해도 live 이중 적용/무효,
 * 옵션 3-a(엔진 크기 respect + JS DFS 제거)로만 해소" 라고 서술했으나, **2-layer 측정으로 반증**:
 * explicit-width 자식은 enrich 가 width 를 주입하지 않아(rawWidth 명시) JS DFS 가 무해 —
 * pipelineLeg(Layer 2) === engineLeg(Layer 1). 즉 **엔진 grid 커널만 고치면 양 레이어가 함께
 * 정합**하며 JS DFS 제거는 불필요.
 *
 * 구현: `tree.rs::solve_grid` 에 `grid_inline_justify`(= `grid_block_align` 가로 대칭) 추가 —
 * justify≠stretch 이고 자식이 실제 width(cw>0)를 가지면 셀 안 start/center/end 배치.
 *
 * 각 fixture 는 **자식 height = 행 height** 로 세로(align) 축 발산을 제거해 justify 만 격리한다.
 * (explicit-height-under-stretch 축소는 line 180 별도 §Residual — 세로축.)
 */

function nested(
  container: StyleRecord,
  children: CaseNode[],
  name: string,
  availW = 300,
): ParityCase {
  const kids = children.length;
  return {
    name,
    availW,
    availH: -1,
    nodes: [
      ...children,
      { label: "grid", style: container, children: children.map((_, i) => i) },
      {
        label: "root",
        style: { display: "block", width: `${availW}px`, height: "600px" },
        children: [kids],
      },
    ],
  };
}

const gridBase: StyleRecord = {
  display: "grid",
  gridTemplateColumns: ["1fr"],
  gridTemplateRows: ["100px"],
  width: "200px",
  height: "100px",
};

const E2_JUSTIFY_CASES: ParityCase[] = [
  nested(
    { ...gridBase, justifyItems: "end" },
    [{ label: "c", style: { width: "40px", height: "100px" } }],
    "E2 grid justify-items:end (explicit width 40 → x=160 w=40)",
    200,
  ),
  nested(
    gridBase,
    [
      {
        label: "c",
        style: { width: "40px", height: "100px", justifySelf: "center" },
      },
    ],
    "E2 grid justify-self:center (x=80 w=40)",
    200,
  ),
  nested(
    { ...gridBase, justifyItems: "end" },
    [
      {
        label: "c",
        style: { width: "40px", height: "100px", justifySelf: "start" },
      },
    ],
    "E2 grid justify-self:start overrides container justify-items:end (x=0)",
    200,
  ),
  // 2-열 그리드 — 각 자식 justify. (트랙 100/100, 자식 40 폭)
  nested(
    {
      display: "grid",
      gridTemplateColumns: ["1fr", "1fr"],
      gridTemplateRows: ["100px"],
      width: "200px",
      height: "100px",
      justifyItems: "center",
    },
    [
      { label: "a", style: { width: "40px", height: "100px" } },
      { label: "b", style: { width: "40px", height: "100px" } },
    ],
    "E2 grid 2-col justify-items:center (a.x=30, b.x=130)",
    200,
  ),
];

describe("ADR-156 옵션 3-a — E2 grid justify(가로) 엔진↔CSS 정합 (2-layer)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  // Layer 1 — 엔진 직접.
  it.each(E2_JUSTIFY_CASES)("engine: $name", (c) => {
    const bad = runParityCase(c);
    expect(bad, bad.join("; ")).toEqual([]);
  });

  // Layer 2 — 빌더 파이프라인(calculateFullTreeLayout). JS DFS 무해 확증.
  it.each(E2_JUSTIFY_CASES)("pipeline: $name", (c) => {
    const bad = runPipelineParityCase(c);
    expect(bad, bad.join("; ")).toEqual([]);
  });
});
