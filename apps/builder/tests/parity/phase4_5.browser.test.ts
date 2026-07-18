import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { type ParityCase, runParityCase } from "./harness";

/**
 * ADR-156 Phase 4.5 — 좌표계(position) 차등 fixture (G4)
 *
 * 대상 발산:
 *   E10 position:relative inset offset — in-flow 유지 + 시각 offset (형제·컨테이너 크기 불변)
 *   E11 absolute 3종 —
 *       ① 양측 inset + auto size → containing block 안에서 stretch
 *       ② inset 무지정 → static position(정상 흐름 위치) 유지
 *       ③ margin:auto + 양측 inset → 남는 공간 균등 분배(중앙)
 *
 * 회귀 기준선: ABS-2 (% inset — 이미 정합, breakdown §1-2)
 *
 * fixture 계약: DOM leg 는 CSS 표준 left/top/right/bottom + marginLeft/Right 를,
 *   엔진 leg 는 insetLeft/insetTop/insetRight/insetBottom 을 읽으므로 **양쪽 병기**한다.
 *   (invalid CSS property `insetLeft` 는 DOM 에서 무시 — 엔진만 소비.)
 * abs 자식의 containing block 은 가장 가까운 positioned 조상 → `cb` 를 position:relative 로.
 * 좌표는 root-상대, TOL 1px. 값은 실 Chrome(leg1)이 ground truth.
 */

// ── E10: position:relative 시각 offset ──
// k 는 in-flow(형제 무이동)이나 자신만 left15/top10 만큼 시각 이동.
// pre(20px) 뒤라 flow y=20 → offset 후 30. post 는 k 의 flow box(20..40) 기준이라 40 유지.
const E10_CASES: ParityCase[] = [
  {
    name: "E10 relative: inset offset shifts element only (siblings keep flow position)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "pre", style: { display: "block", height: "20px" } },
      {
        label: "k",
        style: {
          display: "block",
          height: "20px",
          position: "relative",
          left: "15px",
          top: "10px",
          insetLeft: "15px",
          insetTop: "10px",
        },
      },
      { label: "post", style: { display: "block", height: "20px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", height: "600px" },
        children: [0, 1, 2],
      },
    ],
  },
];

describe("ADR-156 Phase 4.5 — E10 relative offset 엔진↔CSS 정합 (G4)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E10_CASES)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── E11 ①: 양측 inset + auto size → stretch ──
// cb(200×100) 안에서 k 가 left10/right10 → w=180, top15/bottom25 → h=60.
const E11_STRETCH: ParityCase[] = [
  {
    name: "E11-1 absolute stretch: left+right & top+bottom with auto size fills containing block",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "k",
        style: {
          position: "absolute",
          left: "10px",
          right: "10px",
          top: "15px",
          bottom: "25px",
          insetLeft: "10px",
          insetRight: "10px",
          insetTop: "15px",
          insetBottom: "25px",
        },
      },
      {
        label: "cb",
        style: {
          display: "block",
          position: "relative",
          width: "200px",
          height: "100px",
        },
        children: [0],
      },
      {
        label: "root",
        style: { display: "block", width: "300px", height: "600px" },
        children: [1],
      },
    ],
  },
];

describe("ADR-156 Phase 4.5 — E11 ① absolute stretch 엔진↔CSS 정합 (G4)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E11_STRETCH)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── E11 ②: inset 무지정 → static position ──
// pre(30px) 뒤의 abs k 는 top/bottom auto → static position(정상 흐름 위치) = (0, 30).
const E11_STATIC: ParityCase[] = [
  {
    name: "E11-2 absolute static position: no inset keeps in-flow position (after 30px sibling)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "pre", style: { display: "block", height: "30px" } },
      {
        label: "k",
        style: { position: "absolute", width: "20px", height: "20px" },
      },
      {
        label: "cb",
        style: {
          display: "block",
          position: "relative",
          width: "200px",
          height: "100px",
        },
        children: [0, 1],
      },
      {
        label: "root",
        style: { display: "block", width: "300px", height: "600px" },
        children: [2],
      },
    ],
  },
];

describe("ADR-156 Phase 4.5 — E11 ② absolute static position 엔진↔CSS 정합 (G4)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E11_STATIC)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── E11 ③: margin auto + 양측 inset → 중앙 ──
// left0/right0 + width40 → free=160, marginLeft/Right auto 균등 분배 → x=80.
const E11_MARGIN_AUTO: ParityCase[] = [
  {
    name: "E11-3 absolute margin auto centering: left+right+width with auto margins centers",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "k",
        style: {
          position: "absolute",
          left: "0px",
          right: "0px",
          top: "0px",
          insetLeft: "0px",
          insetRight: "0px",
          insetTop: "0px",
          width: "40px",
          height: "20px",
          marginLeft: "auto",
          marginRight: "auto",
        },
      },
      {
        label: "cb",
        style: {
          display: "block",
          position: "relative",
          width: "200px",
          height: "100px",
        },
        children: [0],
      },
      {
        label: "root",
        style: { display: "block", width: "300px", height: "600px" },
        children: [1],
      },
    ],
  },
];

describe("ADR-156 Phase 4.5 — E11 ③ absolute margin auto 중앙 엔진↔CSS 정합 (G4)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(E11_MARGIN_AUTO)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── 회귀 기준선: ABS-2 (% inset — 이미 정합) ──
// left:50% → containing block(200) 기준 x=100. Phase 4.5 수정이 이를 깨면 안 됨.
const ABS_REGRESSION: ParityCase[] = [
  {
    name: "ABS-2 regression: percent inset resolves against containing block (must stay correct)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "k",
        style: {
          position: "absolute",
          left: "50%",
          top: "0px",
          insetLeft: "50%",
          insetTop: "0px",
          width: "20px",
          height: "20px",
        },
      },
      {
        label: "cb",
        style: {
          display: "block",
          position: "relative",
          width: "200px",
          height: "100px",
        },
        children: [0],
      },
      {
        label: "root",
        style: { display: "block", width: "300px", height: "600px" },
        children: [1],
      },
    ],
  },
];

describe("ADR-156 Phase 4.5 — ABS-2 % inset 회귀 기준선 (G4)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(ABS_REGRESSION)("$name", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});
