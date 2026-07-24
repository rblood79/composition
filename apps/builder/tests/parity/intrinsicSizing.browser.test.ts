import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type ParityCase,
  runParityCase,
  runPipelineParityCase,
} from "./harness";

/**
 * ADR-165 G1 — intrinsic sizing 측정 계약 차등 fixture
 *
 * min/max-content 스칼라 공급(contentMinWidth/contentMaxWidth) + 엔진 fit-content
 * 공식(CSS-SIZING-3 §5) + §4.5 floor 정확 하한(flex.rs off 19) 의 Chrome 실측 대조.
 *
 * 두 그룹으로 나뉜다 (autoMin.browser.test.ts 와 달리 leg 별 케이스가 다르다):
 *   - ENGINE_CASES  — runParityCase 만. DOM leg 은 fontSize:0 inline-block 원자로
 *     min-content(=max 원자)/max-content(=Σ원자)를 **정확 정수**로 구성하고, 엔진
 *     leg 은 대응 스칼라를 style 로 직접 받는다 — 엔진 소비(clamp/floor) 격리 검증.
 *     pipeline 을 태우지 않는 이유: generic `box` 는 TEXT_LEAF 가 아니라 스칼라
 *     공급 대상이 아니고, DOM 원자는 pipeline elementsMap 에 존재하지 않는다.
 *   - PIPELINE_CASES — runPipelineParityCase 만. 실제 텍스트(`Text` leaf)로 공급
 *     체인 전체(enrichment 측정 → 스칼라 직렬화 → 엔진 소비 → Step 4.5 height
 *     재측정)를 end-to-end 검증. DOM leg 도 같은 텍스트·font 로 렌더 — Canvas 2D
 *     측정과 Chrome 레이아웃이 같은 텍스트 엔진이라 sub-pixel 정합 (TOL 1px).
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

// ── PIPELINE_CASES — 실 텍스트 end-to-end (측정→스칼라→엔진→2-pass height) ──

// inline width:"auto" — 제품 Text 계열은 generated CSS base 가 width:100% (B22,
// implicitStyles 선주입) 라 intrinsic 동작을 보려면 inline auto 로 base 를 이겨야
// 한다 (DOM 도 inline > stylesheet 로 동일). 이것이 제품-충실 intrinsic 경로.
const TEXT_STYLE = {
  width: "auto",
  fontSize: 16,
  fontFamily: "Arial",
  fontWeight: 400,
  lineHeight: "20px",
} as const;

// (p1) R1 본체 — 컨테이너 30 < min-content("World") → 정확 min-content 에서 정지 +
//      재줄바꿈 2줄 height. ADR-164 이전엔 단일줄 폭(minWidth 주입)에서 정지했다.
const P1_TEXT_FLOOR: ParityCase = {
  name: "p1: text leaf floors at word min-content, wraps to 2 lines",
  availW: 30,
  availH: -1,
  nodes: [
    {
      label: "txt",
      elementType: "Text",
      text: "Hello World",
      style: { ...TEXT_STYLE },
    },
    {
      label: "root",
      style: {
        display: "flex",
        width: "30px",
        height: "60px",
        overflowX: "hidden",
        alignItems: "flex-start",
      },
      children: [0],
    },
  ],
};

// (p2) 압박은 있으나 floor 미달 — 컨테이너 폭 60 으로 shrink + 2줄 재줄바꿈.
const P2_TEXT_WRAP: ParityCase = {
  name: "p2: text leaf shrinks to 60 and wraps (above floor)",
  availW: 60,
  availH: -1,
  nodes: [
    {
      label: "txt",
      elementType: "Text",
      text: "Hello World",
      style: { ...TEXT_STYLE },
    },
    {
      label: "root",
      style: {
        display: "flex",
        width: "60px",
        height: "60px",
        overflowX: "hidden",
        alignItems: "flex-start",
      },
      children: [0],
    },
  ],
};

// (p3) width:fit-content 텍스트 leaf (block 컨텍스트) — 단일줄 max-content 로 수렴.
const P3_TEXT_FIT_CONTENT: ParityCase = {
  name: "p3: text leaf fit-content = single-line max-content",
  availW: 300,
  availH: -1,
  nodes: [
    {
      label: "txt",
      elementType: "Text",
      text: "Hello World",
      style: { ...TEXT_STYLE, width: "fit-content" },
    },
    {
      label: "root",
      style: { display: "block", width: "300px", height: "40px" },
      children: [0],
    },
  ],
};

// (p4) auto 텍스트 leaf, 무압박 flex — max-content 폭 유지 (회귀 가드).
const P4_TEXT_AUTO_NO_PRESSURE: ParityCase = {
  name: "p4: auto text leaf keeps max-content (no pressure)",
  availW: 300,
  availH: -1,
  nodes: [
    {
      label: "txt",
      elementType: "Text",
      text: "Hello World",
      style: { ...TEXT_STYLE },
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

const PIPELINE_CASES: ParityCase[] = [
  P1_TEXT_FLOOR,
  P2_TEXT_WRAP,
  P3_TEXT_FIT_CONTENT,
  P4_TEXT_AUTO_NO_PRESSURE,
];

describe("ADR-165 G1 — intrinsic sizing scalars (engine leg)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  for (const c of ENGINE_CASES) {
    it(c.name, () => {
      expect(runParityCase(c)).toEqual([]);
    });
  }
});

describe("ADR-165 G1 — intrinsic sizing end-to-end (builder pipeline leg)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  for (const c of PIPELINE_CASES) {
    it(`pipeline: ${c.name}`, () => {
      expect(runPipelineParityCase(c)).toEqual([]);
    });
  }
});
