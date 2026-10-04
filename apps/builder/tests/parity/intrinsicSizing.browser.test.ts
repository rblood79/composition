import { beforeAll, describe, expect, it } from "vitest";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { type ParityCase, runParityCase } from "./harness";

/**
 * ADR-165 G1 — intrinsic sizing 측정 계약 차등 fixture
 *
 * min/max-content 스칼라 공급(contentMinWidth/contentMaxWidth) + 엔진 fit-content
 * 공식(CSS-SIZING-3 §5) + §4.5 floor 정확 하한(flex.rs off 19) 의 Chrome 실측 대조.
 *
 * ENGINE_CASES — runParityCase. DOM leg 은 fontSize:0 inline-block 원자로
 * min-content(=max 원자)/max-content(=Σ원자)를 **정확 정수**로 구성하고, 엔진 leg 은
 * 대응 스칼라를 style 로 직접 받는다 — 엔진 소비(clamp/floor) 격리 검증.
 * 실 텍스트 end-to-end 를 보던 PIPELINE_CASES 는 2026-10-05 fullTreeLayout 삭제와 함께
 * 제거 — catalog 경로의 같은 축은 `adr248CatalogTextLeafScalar.browser.test.ts`.
 */

// ── ENGINE_CASES — 스칼라 소비 격리 (원자: [70, 50] → min 70 / max 120) ──

// (e1) 재줄바꿈 shrink 정확 하한 — 컨테이너 50 < min-content 70 → floor 에서 정지.
//      ADR-164 상한 근사였다면 floor = max-content(120) 로 과대.
const E1_SHRINK_FLOOR: ParityCase = {
  name: "e1: flex shrink floors at exact min-content 70",
  availW: 50,
  availH: -1,
  nodes: [
    {
      label: "leaf",
      style: { height: "20px", contentMinWidth: 70, contentMaxWidth: 120 },
      domAtoms: [70, 50],
    },
    {
      label: "root",
      style: {
        display: "flex",
        width: "50px",
        height: "40px",
        overflowX: "hidden",
        alignItems: "flex-start",
      },
      children: [0],
    },
  ],
};

// (e2) 무압박 auto — basis = max-content 120.
const E2_AUTO_MAX_CONTENT: ParityCase = {
  name: "e2: auto leaf basis = max-content 120 (no pressure)",
  availW: 300,
  availH: -1,
  nodes: [
    {
      label: "leaf",
      style: { height: "20px", contentMinWidth: 70, contentMaxWidth: 120 },
      domAtoms: [70, 50],
    },
    {
      label: "root",
      style: {
        display: "flex",
        width: "300px",
        height: "40px",
        alignItems: "flex-start",
      },
      children: [0],
    },
  ],
};

// (e3) fit-content, 좁은 컨테이너 — clamp(70, 100, 120) = 100.
const E3_FIT_CONTENT_NARROW: ParityCase = {
  name: "e3: fit-content clamps to avail 100",
  availW: 100,
  availH: -1,
  nodes: [
    {
      label: "leaf",
      style: {
        width: "fit-content",
        height: "20px",
        contentMinWidth: 70,
        contentMaxWidth: 120,
      },
      domAtoms: [70, 50],
    },
    {
      label: "root",
      style: { display: "block", width: "100px", height: "40px" },
      children: [0],
    },
  ],
};

// (e4) fit-content, 넓은 컨테이너 — clamp(70, 300, 120) = 120.
const E4_FIT_CONTENT_WIDE: ParityCase = {
  name: "e4: fit-content caps at max-content 120",
  availW: 300,
  availH: -1,
  nodes: [
    {
      label: "leaf",
      style: {
        width: "fit-content",
        height: "20px",
        contentMinWidth: 70,
        contentMaxWidth: 120,
      },
      domAtoms: [70, 50],
    },
    {
      label: "root",
      style: { display: "block", width: "300px", height: "40px" },
      children: [0],
    },
  ],
};

// (e5) width:min-content 키워드 — 최장 원자 70.
const E5_MIN_CONTENT_KEYWORD: ParityCase = {
  name: "e5: width:min-content = 70",
  availW: 300,
  availH: -1,
  nodes: [
    {
      label: "leaf",
      style: {
        width: "min-content",
        height: "20px",
        contentMinWidth: 70,
        contentMaxWidth: 120,
      },
      domAtoms: [70, 50],
    },
    {
      label: "root",
      style: { display: "block", width: "300px", height: "40px" },
      children: [0],
    },
  ],
};

// (e6) width:max-content 키워드 — avail(100) 무시하고 120 (overflow 허용).
const E6_MAX_CONTENT_KEYWORD: ParityCase = {
  name: "e6: width:max-content = 120 ignores avail 100",
  availW: 100,
  availH: -1,
  nodes: [
    {
      label: "leaf",
      style: {
        width: "max-content",
        height: "20px",
        contentMinWidth: 70,
        contentMaxWidth: 120,
      },
      domAtoms: [70, 50],
    },
    {
      label: "root",
      style: { display: "block", width: "100px", height: "40px" },
      children: [0],
    },
  ],
};

const ENGINE_CASES: ParityCase[] = [
  E1_SHRINK_FLOOR,
  E2_AUTO_MAX_CONTENT,
  E3_FIT_CONTENT_NARROW,
  E4_FIT_CONTENT_WIDE,
  E5_MIN_CONTENT_KEYWORD,
  E6_MAX_CONTENT_KEYWORD,
];

describe("ADR-165 G1 — intrinsic sizing scalars (engine leg)", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  for (const c of ENGINE_CASES) {
    it(c.name, () => {
      expect(runParityCase(c)).toEqual([]);
    });
  }
});
