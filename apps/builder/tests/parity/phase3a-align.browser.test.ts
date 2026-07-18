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
 * ADR-156 옵션 3-a **세로축** — E2 grid align(세로 배치·height) 엔진↔CSS 정합.
 *
 * phase3a.browser.test.ts 는 justify(가로)를, 옵션 3-b 는 align≠stretch(start/center/end)만
 * 다뤘고, **align==stretch 인데 자식이 explicit height** 인 경우를 §Residual 로 남겼다.
 * CSS Grid 에서 `align-self:stretch`(기본)는 자식 height 가 `auto` 일 때만 셀을 채우고,
 * **definite(explicit) height 는 stretch 를 이겨** 유지 + start(top) 정렬한다. 엔진은 이를
 * 무시하고 셀 높이로 stretch 했다(발산).
 *
 * ## 반증된 §Residual 서술
 * §Residual 은 "회귀 범위 큼(live stretch 의존)" 이라 미뤘으나, cargo 회귀 대상은 2개
 * (`grid_implicit_auto_row_multi_row_max_height`, `grid_mixed_px_and_auto_rows_preserve_px`)
 * 뿐이고 **둘 다 CSS-incorrect 단언**(explicit-height 자식을 셀로 stretch)이었다. Chrome
 * ground truth 실측(harness domLeg)으로 정정. ProgressBar/Meter/Slider 는 auto row 를 자식
 * intrinsic 으로 sizing → explicit height == 셀 → free=0 → 무회귀.
 *
 * 구현: `tree.rs::solve_grid` 세로축 — `resolve_self_size` 로 자식 explicit height 감지 후
 * align==stretch + explicit height → start(top) 코드로 승격(explicit 유지).
 *
 * **폭(justify)은 세로축 전용 수정이라 미변경** — 각 fixture 는 자식 width 를 셀 폭과
 * 일치시켜(또는 auto) 수평축 발산을 격리한다. 수평 explicit-width-under-stretch mirror 는
 * 별도 §Residual(Case C).
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

const oneColRow100: StyleRecord = {
  display: "grid",
  gridTemplateColumns: ["1fr"],
  gridTemplateRows: ["100px"],
  width: "200px",
  height: "100px",
};

const E2_ALIGN_CASES: ParityCase[] = [
  // 기본 stretch + explicit height(셀보다 짧음) → 유지 + top. 폭은 auto → stretch fill(정합).
  nested(
    oneColRow100,
    [{ label: "c", style: { height: "40px" } }],
    "align stretch + explicit height 40 → h=40 top (셀 100)",
    200,
  ),
  // align-self:center override + explicit height → 셀 중앙.
  nested(
    oneColRow100,
    [{ label: "c", style: { height: "40px", alignSelf: "center" } }],
    "align-self:center + explicit height 40 → y=30 h=40",
    200,
  ),
  // align-self:end → 셀 하단.
  nested(
    oneColRow100,
    [{ label: "c", style: { height: "40px", alignSelf: "end" } }],
    "align-self:end + explicit height 40 → y=60 h=40",
    200,
  ),
  // 회귀: auto-height 자식은 stretch 로 셀 채움(explicit 아님).
  nested(
    oneColRow100,
    [{ label: "c", style: {} }],
    "auto-height 자식 → stretch fill h=100 (무회귀)",
    200,
  ),
  // 2열 같은 row — c0 짧은 explicit(30) top, c1 explicit(50)=row → row0=50.
  nested(
    {
      display: "grid",
      gridTemplateColumns: ["1fr", "1fr"],
      width: "200px",
    },
    [
      { label: "c0", style: { height: "30px" } },
      { label: "c1", style: { height: "50px" } },
    ],
    "2-col 같은 row: c0(30) top 유지, c1(50)=row height",
    200,
  ),
  // px row + auto row 혼합 — px row(40) 안 짧은 explicit(20) top, auto row=intrinsic(25).
  nested(
    {
      display: "grid",
      gridTemplateColumns: ["1fr"],
      gridTemplateRows: ["40px", "auto"],
      width: "200px",
    },
    [
      {
        label: "c0",
        style: {
          height: "20px",
          gridColumnStart: "1",
          gridColumnEnd: "2",
          gridRowStart: "1",
          gridRowEnd: "2",
        },
      },
      {
        label: "c1",
        style: {
          height: "25px",
          gridColumnStart: "1",
          gridColumnEnd: "2",
          gridRowStart: "2",
          gridRowEnd: "3",
        },
      },
    ],
    "px row(40) 짧은 explicit(20) top + auto row intrinsic(25)",
    200,
  ),
];

describe("ADR-156 옵션 3-a 세로축 — E2 grid align(세로) 엔진↔CSS 정합 (2-layer)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  // Layer 1 — 엔진 직접.
  it.each(E2_ALIGN_CASES)("engine: $name", (c) => {
    const bad = runParityCase(c);
    expect(bad, bad.join("; ")).toEqual([]);
  });

  // Layer 2 — 빌더 파이프라인(calculateFullTreeLayout). JS DFS 가 explicit height 를
  //   마스킹하지 않음을 확증.
  it.each(E2_ALIGN_CASES)("pipeline: $name", (c) => {
    const bad = runPipelineParityCase(c);
    expect(bad, bad.join("; ")).toEqual([]);
  });
});
