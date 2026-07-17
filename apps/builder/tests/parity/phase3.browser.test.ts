import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type CaseNode,
  type ParityCase,
  type StyleRecord,
  runParityCase,
} from "./harness";

/**
 * ADR-156 Phase 3 — grid 커널 차등 fixture (G3, 옵션 3-b)
 *
 * Phase 1 하니스로 grid 발산(E2/E12/E13/E14)을 실 Chrome 과 대조한다. 옵션 3-b 는
 * 엔진이 **정렬(위치)만** 추가하고 크기 stretch 는 유지(JS DFS 사전 조정 존속)하므로,
 * justify(가로)축 fit-content 는 §Residual — 아래 fixture 는 그 잔존을 건드리지 않는
 * 정렬/배치 축(track alignment, span placement, auto-flow, align 세로축)만 검증한다.
 *
 * 모든 케이스는 definite `root`(300×600 block) 아래 중첩 — root 자기 크기(E5) 격리.
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

// ── E13: span-aware auto-placement (점유 셀 스킵) ──
const E13_CASES: ParityCase[] = [
  nested(
    {
      display: "grid",
      gridTemplateColumns: ["1fr", "1fr"],
      gridTemplateRows: ["50px", "50px"],
      width: "200px",
      height: "100px",
    },
    [
      // 1행 전체 span (col 1~3). 숫자 line 병기(엔진은 gridColumnStart/End, DOM 은 동일 해석).
      {
        label: "span2",
        style: { gridColumnStart: "1", gridColumnEnd: "3" },
      },
      // auto 2개 — span 점유를 스킵해 2행에 배치돼야 한다 (구현 전엔 1행 2열에 겹침).
      { label: "a", style: {} },
      { label: "b", style: {} },
    ],
    "E13 grid: column span 2 pushes auto children to next row",
    200,
  ),
  nested(
    {
      display: "grid",
      gridTemplateColumns: ["1fr", "1fr", "1fr"],
      gridTemplateRows: ["40px", "40px"],
      width: "300px",
      height: "80px",
    },
    [
      { label: "a", style: {} },
      // row span 2 (2행 점유) — 다음 auto 자식이 이 열을 건너뛰어야 한다.
      { label: "rspan", style: { gridRowStart: "1", gridRowEnd: "3" } },
      { label: "c", style: {} },
      { label: "d", style: {} },
    ],
    "E13 grid: row span 2 occupancy skipped by later auto children",
  ),
];

describe("ADR-156 Phase 3 — E13 span-aware placement 엔진↔CSS 정합 (G3)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E13_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});
