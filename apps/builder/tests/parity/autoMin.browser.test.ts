import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type ParityCase,
  runParityCase,
  runPipelineParityCase,
} from "./harness";

/**
 * ADR-164 G1 — §4.5 automatic minimum size 차등 fixture (raw style 직행)
 *
 * Step 5.7 (부모-overflow 기준 flexShrink:0 전면 주입) 제거 + 엔진 content-based
 * minimum floor (flex.rs §4.5, width-auto item 한정 + item overflow 조건) 의
 * Chrome 실측 대조. 두 leg 모두 돌린다:
 *   - runParityCase       — 엔진 직접 (프로토콜 off 18 overflow_main 소비 확증)
 *   - runPipelineParityCase — 빌더 실 파이프라인 (`calculateFullTreeLayout`) —
 *     Step 5.7 제거 후 보정 없는 입력이 엔진에 그대로 도달하는지 확증.
 *     노드 type 은 generic `box` 라 enrichWithIntrinsicSize 주입 0 (raw 직행).
 *
 * 케이스 (breakdown §3-3): (a) scroll 컨테이너 자식 shrink / (b) `flex:1 minWidth:0`
 * / (c) flexShrink 명시 상호작용 / (d) column 대칭 + content floor / (e) grid no-op.
 */

// (a) overflow 컨테이너의 flex 자식 shrink — Step 5.7 제거의 R1 본체.
//     빈 div 자식(width 200)의 automatic minimum = min(specified 200, content 0) = 0
//     → CSS 는 150 씩 shrink. 제거 전 파이프라인은 flexShrink:0 주입으로 200/200 이었다.
const A_SCROLL_SHRINK: ParityCase = {
  name: "a: overflowX:auto flex row children shrink to 150",
  availW: 300,
  availH: -1,
  nodes: [
    { label: "c0", style: { width: "200px", height: "50px" } },
    { label: "c1", style: { width: "200px", height: "50px" } },
    {
      label: "root",
      style: {
        display: "flex",
        width: "300px",
        height: "100px",
        overflowX: "auto",
      },
      children: [0, 1],
    },
  ],
};

const A2_HIDDEN_SHRINK: ParityCase = {
  name: "a2: overflowX:hidden variant",
  availW: 300,
  availH: -1,
  nodes: [
    { label: "c0", style: { width: "200px", height: "50px" } },
    { label: "c1", style: { width: "200px", height: "50px" } },
    {
      label: "root",
      style: {
        display: "flex",
        width: "300px",
        height: "100px",
        overflowX: "hidden",
      },
      children: [0, 1],
    },
  ],
};

// (b) `flex:1 minWidth:0` — 명시 min:0 존중 (falsy 함정 가드) + grow 정상.
const B_FLEX1_MINW0: ParityCase = {
  name: "b: flex:1 minWidth:0 grows to remainder",
  availW: 300,
  availH: -1,
  nodes: [
    {
      label: "c0",
      style: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: "0%",
        minWidth: "0px",
        height: "50px",
      },
    },
    { label: "c1", style: { width: "100px", height: "50px" } },
    {
      label: "root",
      style: { display: "flex", width: "300px", height: "100px" },
      children: [0, 1],
    },
  ],
};

// (c) 자식 flexShrink 명시 상호작용 — shrink:0 은 동결, shrink:1 이 전량 흡수.
const C_EXPLICIT_SHRINK: ParityCase = {
  name: "c: flexShrink 0/1 mix — c1 absorbs all deficit",
  availW: 300,
  availH: -1,
  nodes: [
    { label: "c0", style: { width: "200px", height: "50px", flexShrink: 0 } },
    { label: "c1", style: { width: "200px", height: "50px", flexShrink: 1 } },
    {
      label: "root",
      style: {
        display: "flex",
        width: "300px",
        height: "100px",
        overflowX: "hidden",
      },
      children: [0, 1],
    },
  ],
};

// (d) column 축 대칭 — min-height:auto (빈 자식 → floor 0 → 100 씩 shrink).
const D_COLUMN_SHRINK: ParityCase = {
  name: "d: column overflowY:auto children shrink to 100",
  availW: 100,
  availH: -1,
  nodes: [
    { label: "c0", style: { height: "150px" } },
    { label: "c1", style: { height: "150px" } },
    {
      label: "root",
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100px",
        height: "200px",
        overflowY: "auto",
      },
      children: [0, 1],
    },
  ],
};

// (d2) column content floor — 신규 엔진 §4.5 floor 의 본체 확증.
//     height-auto 컨테이너 item(손자 120px)은 content-based minimum 120 에서 동결,
//     definite 형제(150)가 잔여 부족 전량 흡수 → 80.
const D2_COLUMN_CONTENT_FLOOR: ParityCase = {
  name: "d2: column auto item floors at content 120, sibling shrinks to 80",
  availW: 100,
  availH: -1,
  nodes: [
    { label: "gk", style: { display: "block", height: "120px" } },
    { label: "cauto", style: { display: "block" }, children: [0] },
    { label: "cfix", style: { height: "150px", flexShrink: 1 } },
    {
      label: "root",
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100px",
        height: "200px",
      },
      children: [1, 2],
    },
  ],
};

// (d3) row content floor — width-auto item(손자 width 120)이 120 에서 동결,
//     definite 형제(200)가 130 으로 shrink.
const D3_ROW_CONTENT_FLOOR: ParityCase = {
  name: "d3: row auto item floors at content 120, sibling shrinks to 130",
  availW: 250,
  availH: -1,
  nodes: [
    { label: "gk", style: { width: "120px", height: "20px" } },
    { label: "cauto", style: { display: "block" }, children: [0] },
    { label: "cfix", style: { width: "200px", height: "20px" } },
    {
      label: "root",
      style: {
        display: "flex",
        width: "250px",
        height: "60px",
        overflowX: "hidden",
      },
      children: [1, 2],
    },
  ],
};

// (e) grid 클립 컨테이너 no-op — Step 5.7 은 grid 에도 주입했으나 grid 알고리즘은
//     flex_shrink 미소비. 제거가 grid 경로 무영향임을 fixture 로 증명.
const E_GRID_NOOP: ParityCase = {
  name: "e: grid overflowX:hidden fixed tracks unchanged",
  availW: 150,
  availH: -1,
  nodes: [
    { label: "c0", style: { height: "40px" } },
    { label: "c1", style: { height: "40px" } },
    {
      label: "root",
      style: {
        display: "grid",
        gridTemplateColumns: ["100px", "100px"],
        width: "150px",
        height: "100px",
        overflowX: "hidden",
      },
      children: [0, 1],
    },
  ],
};

const CASES: ParityCase[] = [
  A_SCROLL_SHRINK,
  A2_HIDDEN_SHRINK,
  B_FLEX1_MINW0,
  C_EXPLICIT_SHRINK,
  D_COLUMN_SHRINK,
  D2_COLUMN_CONTENT_FLOOR,
  D3_ROW_CONTENT_FLOOR,
  E_GRID_NOOP,
];

describe("ADR-164 G1 — automatic minimum size (engine leg)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  for (const c of CASES) {
    it(c.name, () => {
      expect(runParityCase(c)).toEqual([]);
    });
  }
});

describe("ADR-164 G1 — automatic minimum size (builder pipeline leg)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  for (const c of CASES) {
    it(`pipeline: ${c.name}`, () => {
      expect(runPipelineParityCase(c)).toEqual([]);
    });
  }
});
