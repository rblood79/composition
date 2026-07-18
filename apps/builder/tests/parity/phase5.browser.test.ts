import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type CaseNode,
  type ParityCase,
  type StyleRecord,
  runParityCase,
} from "./harness";

/**
 * ADR-156 Phase 5 — margin auto(E4) + root self-sizing(E5) + aspect-ratio(E15) (G5)
 *
 * 대상 발산:
 *   E4  margin:auto 정렬 — block 가로 중앙 + flex auto margin free space 흡수
 *   E5  root 자기 크기 결함군 — auto 높이 pad_border 누락 / 무폭 flex root availW 미채움 /
 *       자기 min·max clamp 무시 (중첩이면 정합, root 만 결함)
 *   E15 aspect-ratio — 한 축 명시 + ratio 로 다른 축 파생
 *
 * E5 는 **root 가 divergent 노드**라 wrap() 을 쓰지 않는다(root 자기 크기 경로 격리).
 * E4/E15 는 definite root 아래 중첩(E5 격리). 좌표 root-상대, TOL 1px. 값은 실 Chrome(leg1) ground truth.
 */

// definite root(block) 아래 중첩 헬퍼 (phase4 와 동일).
function wrap(
  nodes: CaseNode[],
  rootChildren: number[],
  name: string,
  availW = 300,
  rootStyle: StyleRecord = {},
): ParityCase {
  return {
    name,
    availW,
    availH: -1,
    nodes: [
      ...nodes,
      {
        label: "root",
        style: {
          display: "block",
          width: `${availW}px`,
          height: "600px",
          ...rootStyle,
        },
        children: rootChildren,
      },
    ],
  };
}

// ── E5: root 자기 크기 결함군 (root = divergent 노드) ──
const E5_CASES: ParityCase[] = [
  {
    // ① auto 높이에 padding 합산 — root.h = child 20 + padding 20 = 40.
    name: "E5-pad root auto height adds padding (h = content + padding)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "child",
        style: { display: "block", width: "100px", height: "20px" },
      },
      {
        label: "root",
        style: {
          display: "block",
          paddingTop: "10px",
          paddingRight: "10px",
          paddingBottom: "10px",
          paddingLeft: "10px",
        },
        children: [0],
      },
    ],
  },
  {
    // ① auto 높이에 border 합산 — root.h = child 20 + border 10 = 30.
    name: "E5-border root auto height adds border (h = content + border)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "child",
        style: { display: "block", width: "100px", height: "20px" },
      },
      {
        label: "root",
        style: {
          display: "block",
          borderTop: "5px",
          borderBottom: "5px",
          borderTopStyle: "solid",
          borderBottomStyle: "solid",
        },
        children: [0],
      },
    ],
  },
  {
    // ② 무폭 flex root 가 availW 를 채운다 (block-level 컨테이너) — root.w = 200.
    name: "E5-nowidth-flex root fills available width (flex container is block-level)",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "child", style: { width: "40px", height: "20px" } },
      {
        label: "root",
        style: { display: "flex", flexDirection: "row" },
        children: [0],
      },
    ],
  },
  {
    // ③ 자기 minHeight clamp — root.h = max(child 30, minHeight 80) = 80.
    name: "E5-minH root auto height clamps up to minHeight",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "child",
        style: { display: "block", width: "100px", height: "30px" },
      },
      {
        label: "root",
        style: { display: "block", minHeight: "80px" },
        children: [0],
      },
    ],
  },
  {
    // ③ 자기 maxHeight clamp — root.h = min(child 100, maxHeight 50) = 50.
    name: "E5-maxH root auto height clamps down to maxHeight",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "child",
        style: { display: "block", width: "100px", height: "100px" },
      },
      {
        label: "root",
        style: { display: "block", maxHeight: "50px" },
        children: [0],
      },
    ],
  },
];

describe("ADR-156 Phase 5 — E5 root 자기 크기 결함군 엔진↔CSS 정합 (G5)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E5_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── E4: margin:auto 정렬 ──
const E4_CASES: ParityCase[] = [
  wrap(
    [
      // block 자식: marginLeft/Right auto + width80 → 가로 중앙 (mid 200 → x=60).
      {
        label: "k",
        style: {
          display: "block",
          width: "80px",
          height: "20px",
          marginLeft: "auto",
          marginRight: "auto",
        },
      },
      {
        label: "mid",
        style: { display: "block", width: "200px" },
        children: [0],
      },
    ],
    [1],
    "E4 block: margin-left/right auto centers child horizontally",
  ),
  {
    // flex row 자식: marginLeft auto → free space 흡수, 우측으로 밀림 (x = 200 - 40 = 160).
    name: "E4 flex row: margin-left auto pushes item to the end",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "k",
        style: { width: "40px", height: "20px", marginLeft: "auto" },
      },
      {
        label: "root",
        style: {
          display: "flex",
          flexDirection: "row",
          width: "200px",
          height: "600px",
        },
        children: [0],
      },
    ],
  },
];

describe("ADR-156 Phase 5 — E4 margin auto 엔진↔CSS 정합 (G5)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E4_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── E15: aspect-ratio ──
const E15_CASES: ParityCase[] = [
  wrap(
    [
      // width 100 + aspectRatio 2 → height 50 (파생).
      {
        label: "k",
        style: { display: "block", width: "100px", aspectRatio: 2 },
      },
    ],
    [0],
    "E15 aspect-ratio: width given derives height (100 / 2 = 50)",
  ),
  wrap(
    [
      // height 60 + aspectRatio 3 → width 180 (파생).
      {
        label: "k",
        style: { display: "block", height: "60px", aspectRatio: 3 },
      },
    ],
    [0],
    "E15 aspect-ratio: height given derives width (60 * 3 = 180)",
  ),
];

describe("ADR-156 Phase 5 — E15 aspect-ratio 엔진↔CSS 정합 (G5)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E15_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});
