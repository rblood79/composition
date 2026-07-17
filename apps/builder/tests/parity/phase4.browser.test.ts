import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type CaseNode,
  type ParityCase,
  type StyleRecord,
  runParityCase,
} from "./harness";

/**
 * ADR-156 Phase 4 — block/flex flow 차등 fixture (G4)
 *
 * 대상 발산:
 *   E3  부모-자식 마진 상쇄 (block) — 첫 자식 margin-top 이 부모 밖으로 탈출
 *   E17 overflow BFC — overflow≠visible 은 상쇄를 차단 (E3 와 동시 구현 필수)
 *   E7  음수 margin 을 flow 좌표 산술에 반영 (현재 0 으로 clamp)
 *   E8  row-reverse / column-reverse / wrap-reverse 소비
 *
 * 모든 케이스는 definite `root`(block, 명시 크기) 아래 중첩 — root 자기 크기(E5) 격리.
 * 좌표는 root-상대, TOL 1px. 값은 실 Chrome(leg1)이 ground truth.
 */

// definite root(block) 아래 임의 노드 트리를 감싸는 헬퍼.
// children 은 이미 post-order 로 배열된 노드들, rootChildren 은 root 직속 자식 인덱스.
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

// ── E3: 부모-자식 마진 상쇄 (block) ──
// mid(block, 무 padding) 의 첫 자식 k 의 margin-top 이 mid 밖으로 탈출 → mid.h 는 k 높이만.
// sib 가 mid 아래 배치되며 탈출 마진이 형제 전파에 반영되는지 확인.
const E3_CASES: ParityCase[] = [
  wrap(
    [
      // [0] k — mid 의 첫 자식, margin-top 30 (부모 밖으로 상쇄 탈출)
      {
        label: "k",
        style: { display: "block", height: "20px", marginTop: "30px" },
      },
      // [1] mid — padding 없음 → 상쇄 차단 요인 없음
      { label: "mid", style: { display: "block" }, children: [0] },
      // [2] sib — mid 아래 형제 (탈출 마진 전파 확인)
      { label: "sib", style: { display: "block", height: "10px" } },
    ],
    [1, 2],
    "E3 block: first-child margin-top escapes parent (mid.h excludes it, sib propagates)",
  ),
  wrap(
    [
      // padding-top 이 있으면 상쇄 차단 → k.margin 이 mid 안에 유지 (R4 회귀 기준선)
      {
        label: "k",
        style: { display: "block", height: "20px", marginTop: "30px" },
      },
      {
        label: "mid",
        style: { display: "block", paddingTop: "10px" },
        children: [0],
      },
    ],
    [1],
    "E3 block: parent padding-top blocks collapse (margin stays inside)",
  ),
];

describe("ADR-156 Phase 4 — E3 부모-자식 마진 상쇄 엔진↔CSS 정합 (G4)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E3_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── E17: overflow BFC 가 상쇄를 차단 (E3 와 동시 필수) ──
// mid 가 overflow≠visible → BFC 생성 → 첫 자식 margin-top 상쇄 차단.
// E3 만 구현하고 E17 을 빠뜨리면 여기서 mid.h 가 잘못 축소된다.
const E17_CASES: ParityCase[] = [
  wrap(
    [
      {
        label: "k",
        style: { display: "block", height: "20px", marginTop: "30px" },
      },
      {
        label: "mid",
        style: { display: "block", overflowY: "hidden" },
        children: [0],
      },
    ],
    [1],
    "E17 block: overflowY:hidden creates BFC blocking collapse (margin stays inside)",
  ),
];

describe("ADR-156 Phase 4 — E17 overflow BFC 상쇄 차단 엔진↔CSS 정합 (G4)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E17_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── E7: 음수 margin 을 flow 좌표에 반영 ──
const E7_CASES: ParityCase[] = [
  wrap(
    [
      // block 형제: b 의 음수 margin-top 이 a 와 상쇄(mixed), margin-left 가 x 이동
      { label: "a", style: { display: "block", height: "20px" } },
      {
        label: "b",
        style: {
          display: "block",
          height: "20px",
          marginTop: "-10px",
          marginLeft: "-20px",
        },
      },
    ],
    [0, 1],
    "E7 block: negative margins shift sibling (mt collapse mixed, ml offset)",
  ),
  {
    name: "E7 flex row: negative marginLeft pulls second item left",
    availW: 300,
    availH: -1,
    nodes: [
      // flex row 자식 2개, b 에 marginLeft:-20
      { label: "a", style: { width: "50px", height: "20px" } },
      {
        label: "b",
        style: { width: "50px", height: "20px", marginLeft: "-20px" },
      },
      {
        label: "root",
        style: {
          display: "flex",
          flexDirection: "row",
          width: "300px",
          height: "600px",
        },
        children: [0, 1],
      },
    ],
  },
];

describe("ADR-156 Phase 4 — E7 음수 margin 엔진↔CSS 정합 (G4)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E7_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── E8: reverse 3종 ──
const E8_CASES: ParityCase[] = [
  {
    name: "E8 flex row-reverse: first child at right edge",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "a", style: { width: "40px", height: "20px" } },
      { label: "b", style: { width: "40px", height: "20px" } },
      {
        label: "root",
        style: {
          display: "flex",
          flexDirection: "row-reverse",
          width: "200px",
          height: "600px",
        },
        children: [0, 1],
      },
    ],
  },
  {
    name: "E8 flex column-reverse: first child at bottom",
    availW: 100,
    availH: -1,
    nodes: [
      { label: "a", style: { width: "40px", height: "30px" } },
      { label: "b", style: { width: "40px", height: "30px" } },
      {
        label: "root",
        style: {
          display: "flex",
          flexDirection: "column-reverse",
          width: "100px",
          height: "200px",
        },
        children: [0, 1],
      },
    ],
  },
  {
    name: "E8 flex wrap-reverse: line order reversed (first item on bottom line)",
    availW: 100,
    availH: -1,
    nodes: [
      // w60 2개 → 100 폭에서 2줄 wrap. wrap-reverse → a 가 아래 줄, b 가 위 줄.
      { label: "a", style: { width: "60px", height: "20px" } },
      { label: "b", style: { width: "60px", height: "20px" } },
      {
        label: "root",
        style: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap-reverse",
          width: "100px",
          height: "200px",
        },
        children: [0, 1],
      },
    ],
  },
];

describe("ADR-156 Phase 4 — E8 reverse 3종 엔진↔CSS 정합 (G4)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E8_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});
