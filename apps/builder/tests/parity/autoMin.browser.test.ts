import { beforeAll, describe, expect, it } from "vitest";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { EngineLayout } from "@/builder/workspace/canvas/wasm-bindings/engine";
import { type ParityCase, domLeg, runParityCase, TOL } from "./harness";

/**
 * ADR-164 G1 — §4.5 automatic minimum size 차등 fixture (raw style 직행)
 *
 * Step 5.7 (부모-overflow 기준 flexShrink:0 전면 주입) 제거 + 엔진 content-based
 * minimum floor (flex.rs §4.5, width-auto item 한정 + item overflow 조건) 의
 * Chrome 실측 대조 — runParityCase (엔진 직접, 프로토콜 off 18 overflow_main 소비 확증).
 * (옛 pipeline leg — `calculateFullTreeLayout` — 는 2026-10-05 fullTreeLayout 삭제와 함께 제거)
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

// ADR-268 F4 — row definite 컨테이너 item 의 §4.5 content size suggestion.
//     auto min = min(specified 200, content 150) = 150 → Chrome 은 150 에서 멈추고 넘친다.
//     ADR-268 전 엔진은 2-b 가 definite item 을 재지 않아 floor 가 없었다 (100/100). 지금은 커널
//     결과 기반 지연 floor (`flex_layout_with_definite_floor`) 가 잰다.
const F_ROW_DEFINITE_FLOOR: ParityCase = {
  name: "f: row definite container items floor at min-content 150 (overflow)",
  availW: 200,
  availH: -1,
  nodes: [
    { label: "g0", style: { width: "150px", height: "20px" } },
    { label: "c0", style: { width: "200px", height: "20px" }, children: [0] },
    { label: "g1", style: { width: "150px", height: "20px" } },
    { label: "c1", style: { width: "200px", height: "20px" }, children: [2] },
    {
      label: "root",
      style: { display: "flex", width: "200px", height: "40px" },
      children: [1, 3],
    },
  ],
};

// (f-auto) 대조군 — 같은 자식 · item 폭 auto. auto 컨테이너는 2-b 가 이미 재므로 현행 정합.
const F_AUTO_CONTROL: ParityCase = {
  name: "f-auto: row auto container items (control, already floored)",
  availW: 200,
  availH: -1,
  nodes: [
    { label: "g0", style: { width: "150px", height: "20px" } },
    { label: "c0", style: { height: "20px" }, children: [0] },
    { label: "g1", style: { width: "150px", height: "20px" } },
    { label: "c1", style: { height: "20px" }, children: [2] },
    {
      label: "root",
      style: { display: "flex", width: "200px", height: "40px" },
      children: [1, 3],
    },
  ],
};

// (f-scroll) 대조군 — 같은 definite item 이 scroll container 면 auto min = 0 (현행 정합).
const F_SCROLL_CONTROL: ParityCase = {
  name: "f-scroll: row definite overflow:auto items shrink to 100 (control)",
  availW: 200,
  availH: -1,
  nodes: [
    { label: "g0", style: { width: "150px", height: "20px" } },
    {
      label: "c0",
      style: { width: "200px", height: "20px", overflowX: "auto" },
      children: [0],
    },
    { label: "g1", style: { width: "150px", height: "20px" } },
    {
      label: "c1",
      style: { width: "200px", height: "20px", overflowX: "auto" },
      children: [2],
    },
    {
      label: "root",
      style: { display: "flex", width: "200px", height: "40px" },
      children: [1, 3],
    },
  ],
};

// (f-sib) 판정 반례 (리뷰 Round 1 H1) — 뒤에 오는 auto 형제 B 의 intrinsic 은 1) 단계에서
//     0 이라 「행 합 < 컨테이너」 pre-scan 은 A 를 건너뛴다. Chrome A=150 · B=200.
const F_SIB_LATER_AUTO: ParityCase = {
  name: "f-sib: definite A floors at 150 before later auto sibling B (200)",
  availW: 300,
  availH: -1,
  nodes: [
    { label: "ga", style: { width: "150px", height: "20px" } },
    { label: "a", style: { width: "200px", height: "20px" }, children: [0] },
    { label: "gb", style: { width: "200px", height: "20px" } },
    { label: "b", style: { height: "20px" }, children: [2] },
    {
      label: "root",
      style: { display: "flex", width: "300px", height: "40px" },
      children: [1, 3],
    },
  ],
};

// (f-basis0) 판정 반례 — 행이 줄지 않아도 §9.2 hypothetical clamp 가 auto min 을 쓴다.
//     basis 0 · grow 0 → hypothetical = max(0, auto min 150) = 150. shrink 0 · 1 둘 다.
function fBasis0(flexShrink: number): ParityCase {
  return {
    name: `f-basis0: width 200 · basis 0 · grow 0 · shrink ${flexShrink} → 150`,
    availW: 500,
    availH: -1,
    nodes: [
      { label: "g", style: { width: "150px", height: "20px" } },
      {
        label: "c",
        style: {
          width: "200px",
          height: "20px",
          flexBasis: "0px",
          flexGrow: 0,
          flexShrink,
        },
        children: [0],
      },
      {
        label: "root",
        style: { display: "flex", width: "500px", height: "40px" },
        children: [1],
      },
    ],
  };
}

// D-NEW-1 (Chromium 재대조 2026-10-19) — floor 는 해소되는 길이 전부. `width` 가 px 가 아니어도
//     200 으로 풀리면 F4 와 같다 (Chrome 150/150). vw 는 하니스 viewport 가 고정이 아니라 Rust 가 덮는다.
function fUnit(width: string): ParityCase {
  return {
    name: `f-unit: row definite \`width: ${width}\` items floor at 150`,
    availW: 200,
    availH: -1,
    nodes: [
      { label: "g0", style: { width: "150px", height: "20px" } },
      { label: "c0", style: { width, height: "20px" }, children: [0] },
      { label: "g1", style: { width: "150px", height: "20px" } },
      { label: "c1", style: { width, height: "20px" }, children: [2] },
      {
        label: "root",
        style: { display: "flex", width: "200px", height: "40px" },
        children: [1, 3],
      },
    ],
  };
}

const CASES: ParityCase[] = [
  A_SCROLL_SHRINK,
  A2_HIDDEN_SHRINK,
  B_FLEX1_MINW0,
  C_EXPLICIT_SHRINK,
  D_COLUMN_SHRINK,
  D2_COLUMN_CONTENT_FLOOR,
  D3_ROW_CONTENT_FLOOR,
  E_GRID_NOOP,
  F_ROW_DEFINITE_FLOOR,
  F_SIB_LATER_AUTO,
  fBasis0(0),
  fBasis0(1),
  F_AUTO_CONTROL,
  F_SCROLL_CONTROL,
  fUnit("100%"),
  fUnit("12.5rem"),
  fUnit("calc(100% - 0px)"),
];

describe("ADR-164 G1 — automatic minimum size (engine leg)", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  for (const c of CASES) {
    it(c.name, () => {
      expect(runParityCase(c)).toEqual([]);
    });
  }

  for (const unit of ["vw", "vh"] as const) {
    it(`ADR-268: viewport 변경 뒤 ${unit} 자손의 content floor 가 Chrome 과 같다`, () => {
      const nodes: ParityCase["nodes"] = [
        { label: "g0", style: { width: `50${unit}`, height: "20px" } },
        {
          label: "c0",
          style: { width: "200px", height: "20px" },
          children: [0],
        },
        { label: "g1", style: { width: `50${unit}`, height: "20px" } },
        {
          label: "c1",
          style: { width: "200px", height: "20px" },
          children: [2],
        },
        {
          label: "root",
          style: { display: "flex", width: "200px", height: "40px" },
          children: [1, 3],
        },
      ];
      const engine = new EngineLayout();
      try {
        engine.setViewport(300, 300);
        const handles = engine.buildTreeBatch(
          JSON.stringify(
            nodes.map((node) => ({
              style: node.style,
              children: node.children ?? [],
            })),
          ),
        );
        engine.computeLayout(handles[4], 200, 40);
        expect(engine.getLayoutsBatch(handles).get(handles[1])!.width).toBe(
          150,
        );

        // 문서 입력은 그대로 두고, 현재 Chrome viewport 로 환경만 바꾼다.
        engine.setViewport(window.innerWidth, window.innerHeight);
        engine.computeLayout(handles[4], 200, 40);
        const actual = engine.getLayoutsBatch(handles);
        const expected = domLeg(nodes, 200);
        for (const index of [1, 3]) {
          expect(
            Math.abs(actual.get(handles[index])!.width - expected[index].w),
          ).toBeLessThanOrEqual(TOL);
        }
      } finally {
        engine.dispose();
      }
    });
  }
});
