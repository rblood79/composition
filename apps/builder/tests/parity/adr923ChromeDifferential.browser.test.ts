import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type CaseNode,
  type ParityCase,
  type StyleRecord,
  diffCase,
  domLeg,
  engineLeg,
  pipelineLeg,
} from "./harness";

/**
 * ADR-923 Phase 3 — Chrome 차등 증명 (G1 전반).
 *
 * leg 1 (ground truth) — 실 Chrome `getBoundingClientRect` (harness.domLeg).
 * leg 2 (게이트 대상)   — **어댑터 우회** 엔진 직결 (harness.engineLeg — raw CSS
 *   display 문자열 inline-block/inline-flex/inline-grid 를 buildTreeBatch 로 직접
 *   전달, Phase 1 outer/inner 배선 + Phase 2 baseline 계약이 판정 대상).
 * leg 3 (대조군, 기록만) — 현 어댑터 경로 (harness.pipelineLeg — IFC 시뮬레이션).
 *   breakdown Phase 3: "(전) 현 어댑터 경로 결과도 같은 표에 나란히 기록".
 *
 * 통과: 위치·크기 ≤ 1px (harness.TOL). 실패 = 엔진 결함 → Phase 1·2 수리 → 재실행.
 * 강등 없음 (G1).
 *
 * ## fixture 계약
 * - IFC 부모는 `fontSize:"0px"` — CSS strut(부모 폰트/line-height 의 zero-width
 *   inline box) 의 **폰트 축**을 0 으로 만들어 검증 대상 차원(배치·baseline)을
 *   격리한다. strut 자체는 명시 line-height 케이스(strut-short/tall)가 검증한다
 *   — 거기서는 fontSize 0 이라 strut ascent = lineHeight/2 로 폰트 무관 결정.
 * - `engineStyle`: 두 leg 의 계약 차이가 있는 키만 override 해 engine leg 에 적용
 *   (lineHeight — DOM 은 CSS 문자열 "40px", 엔진 NodeStyle 은 px 숫자 f32).
 *   fontSize 등 엔진 미선언 필드는 serde 가 무시한다 (deny_unknown_fields 없음).
 */

interface DiffCaseNode extends CaseNode {
  /** engine leg 전용 override — 두 leg 직렬화 계약이 갈리는 키만. */
  engineStyle?: StyleRecord;
}

interface DiffCase extends Omit<ParityCase, "nodes"> {
  nodes: DiffCaseNode[];
}

const FS0: StyleRecord = { fontSize: "0px" };
const ib = (w: number, h: number, extra: StyleRecord = {}): StyleRecord => ({
  display: "inline-block",
  width: `${w}px`,
  height: `${h}px`,
  ...extra,
});

const CASES: DiffCase[] = [
  {
    name: "ib-two-one-line — inline-block 2개 한 줄",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "b", style: ib(80, 24) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "ib-wrap — 3개 중 셋째 줄바꿈",
    availW: 150,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "b", style: ib(60, 20) },
      { label: "c", style: ib(60, 20) },
      {
        label: "root",
        style: { display: "block", width: "150px", ...FS0 },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "explicit-width-block-sibling — 명시 폭 block 형제 (ADR-198 재현)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      {
        label: "mid",
        style: { display: "block", width: "120px", height: "30px" },
      },
      { label: "b", style: ib(60, 20) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "auto-width-block-sibling — auto 폭 block 형제",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "mid", style: { display: "block", height: "30px" } },
      { label: "b", style: ib(60, 20) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "valign-top",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "b", style: ib(60, 40, { verticalAlign: "top" }) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "valign-middle",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "b", style: ib(60, 40, { verticalAlign: "middle" }) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "valign-bottom",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "b", style: ib(60, 40, { verticalAlign: "bottom" }) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "valign-baseline — 기본 baseline 정렬 (bottom = 폴백 baseline)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "b", style: ib(60, 40) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "child-margin — 인라인 마진 + 형제 block",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: ib(60, 20, { marginLeft: "10px", marginRight: "6px" }),
      },
      { label: "b", style: ib(60, 20, { marginTop: "5px" }) },
      { label: "tail", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "empty-block-sibling — 빈 block 이 줄을 끊는다",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "empty", style: { display: "block" } },
      { label: "b", style: ib(60, 20) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "parent-padding — 부모 padding 안 line box",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "mid", style: { display: "block", height: "30px" } },
      { label: "b", style: ib(60, 20) },
      {
        label: "root",
        style: {
          display: "block",
          width: "300px",
          paddingTop: "12px",
          paddingLeft: "8px",
          ...FS0,
        },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "inline-flex-nested-baseline — inline-flex 컨테이너 baseline (R6 필수)",
    availW: 320,
    availH: -1,
    nodes: [
      { label: "a1a", style: ib(60, 20) },
      {
        label: "a1",
        style: { display: "block", width: "60px", ...FS0 },
        children: [0],
      },
      {
        label: "a",
        style: { display: "inline-flex", paddingBottom: "15px" },
        children: [1],
      },
      { label: "b1a", style: ib(60, 40) },
      {
        label: "b1",
        style: { display: "block", width: "60px", ...FS0 },
        children: [3],
      },
      { label: "b", style: { display: "inline-flex" }, children: [4] },
      {
        label: "root",
        style: { display: "block", width: "320px", ...FS0 },
        children: [2, 5],
      },
    ],
  },
  {
    name: "inline-grid-line — inline-grid 가 line item",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "g1", style: { width: "40px", height: "30px" } },
      { label: "g2", style: { width: "40px", height: "30px" } },
      {
        label: "g",
        style: {
          display: "inline-grid",
          gridTemplateColumns: ["40px", "40px"],
        },
        children: [1, 2],
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 3],
      },
    ],
  },
  {
    name: "ib-shrink-to-fit-wrap — r6: fit-content 100 vs one-pass 80",
    availW: 100,
    availH: -1,
    nodes: [
      { label: "f1", style: { width: "80px", height: "20px" } },
      { label: "f2", style: { width: "80px", height: "20px" } },
      {
        label: "f",
        style: { display: "inline-flex", flexWrap: "wrap" },
        children: [0, 1],
      },
      {
        label: "root",
        style: { display: "block", width: "100px", ...FS0 },
        children: [2],
      },
    ],
  },
  {
    name: "ib-fit-under-min-content — available < min-content 는 overflow",
    availW: 60,
    availH: -1,
    nodes: [
      { label: "c1", style: { width: "80px", height: "20px" } },
      { label: "f", style: { display: "inline-flex" }, children: [0] },
      {
        label: "root",
        style: { display: "block", width: "60px", ...FS0 },
        children: [1],
      },
    ],
  },
  {
    name: "ib-pct-child-shrink — r6: shrink-to-fit 안 percentage 재해소",
    availW: 100,
    availH: -1,
    nodes: [
      {
        label: "p1",
        style: { width: "60px", height: "20px", flexShrink: 0 },
      },
      {
        label: "p2",
        style: { width: "50%", height: "20px", flexShrink: 0 },
      },
      {
        label: "f",
        style: { display: "inline-flex" },
        children: [0, 1],
      },
      {
        label: "root",
        style: { display: "block", width: "100px", ...FS0 },
        children: [2],
      },
    ],
  },
  {
    name: "ib-baseline-margin-bottom — r7: 폴백 baseline 은 margin edge (§10.8.1)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20, { marginBottom: "8px" }) },
      { label: "b", style: ib(60, 40) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "ib-overflow-hidden-baseline — r7: overflow≠visible 은 margin edge (§10.8.1)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a1", style: ib(60, 20) },
      {
        label: "a",
        style: {
          display: "inline-block",
          width: "60px",
          paddingBottom: "10px",
          overflowX: "hidden",
          overflowY: "hidden",
          ...FS0,
        },
        children: [0],
      },
      { label: "b", style: ib(60, 40) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "valign-top-bottom-only — r7: baseline 참여자 없는 줄",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20, { verticalAlign: "top" }) },
      { label: "b", style: ib(60, 40, { verticalAlign: "bottom" }) },
      { label: "c", style: ib(30, 30, { verticalAlign: "bottom" }) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "inline-flex-column-baseline — r7: column flex 첫 item baseline",
    availW: 320,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 40) },
      { label: "c1a", style: ib(60, 12) },
      {
        label: "c1",
        style: { display: "block", width: "60px", ...FS0 },
        children: [1],
      },
      { label: "c2", style: { width: "60px", height: "20px" } },
      {
        label: "c",
        style: { display: "inline-flex", flexDirection: "column" },
        children: [2, 3],
      },
      {
        label: "root",
        style: { display: "block", width: "320px", ...FS0 },
        children: [0, 4],
      },
    ],
  },
  {
    name: "atomic-line-height-inert — atomic inline 의 line-height 는 line box 에 관여하지 않는다",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: ib(60, 20, { lineHeight: "50px" }),
        engineStyle: { lineHeight: 50 },
      },
      { label: "tail", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "strut-short — 부모 line-height strut 이 짧은 item 위로 line 확장",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "tail", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", lineHeight: "40px", ...FS0 },
        engineStyle: { lineHeight: 40 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "strut-tall — item 이 strut 보다 커도 strut descent 는 남는다",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 50) },
      { label: "tail", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", lineHeight: "40px", ...FS0 },
        engineStyle: { lineHeight: 40 },
        children: [0, 1],
      },
    ],
  },
{
    name: "valign-middle-tall — r8: middle 은 baseline 에 중심 고정 (x-height/2=0)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      { label: "m", style: ib(60, 60, { verticalAlign: "middle" }) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "strut-last-line — r8: 마지막 line box 의 strut 높이가 auto-height 에 반영",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: ib(60, 20) },
      {
        label: "root",
        style: { display: "block", width: "300px", lineHeight: "40px", ...FS0 },
        engineStyle: { lineHeight: 40 },
        children: [0],
      },
    ],
  },
  {
    name: "clip-no-bfc — r8: overflow:clip 은 BFC 를 만들지 않는다 (margin 관통)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "inner",
        style: { display: "block", marginTop: "20px", height: "10px" },
      },
      {
        label: "wrap",
        style: { display: "block", overflowX: "clip", overflowY: "clip" },
        children: [0],
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1],
      },
    ],
  },
  {
    name: "ib-overflow-clip-baseline — r8: clip 의 inline-block baseline 판정 (오라클)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a1", style: ib(60, 20) },
      {
        label: "a",
        style: {
          display: "inline-block",
          width: "60px",
          paddingBottom: "10px",
          overflowX: "clip",
          overflowY: "clip",
          ...FS0,
        },
        children: [0],
      },
      { label: "b", style: ib(60, 40) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
];

/** engine leg 입력 — engineStyle override 적용. */
function toEngineNodes(nodes: DiffCaseNode[]): CaseNode[] {
  return nodes.map((n) => ({
    ...n,
    style: n.engineStyle ? { ...n.style, ...n.engineStyle } : n.style,
  }));
}

// 대조군 표 — 콘솔로만 내면 통과 시 아무것도 안 남는다 (browser mode 는 통과 테스트
// 로그를 숨김 — ADR-198 artifacts.ts 교훈). afterAll 에서 파일로 내보낸다
// (`.artifacts/` 는 gitignore — 표는 docs/adr/evidence 로 옮긴다).
const RECORD: Record<string, { engine: string; adapter: string }> = {};

describe("ADR-923 Phase 3 — Chrome 차등 (어댑터 우회 엔진 직결, G1 전반)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  afterAll(async () => {
    const { server } = await import("vitest/browser");
    await server.commands.writeFile(
      "tests/parity/.artifacts/adr923-phase3-differential.json",
      JSON.stringify(
        { measuredAt: new Date().toISOString(), tolPx: 1, cases: RECORD },
        null,
        2,
      ),
    );
  });

  it.each(CASES)("$name", (c) => {
    const dom = domLeg(c.nodes, c.availW);
    const eng = engineLeg(toEngineNodes(c.nodes), c.availW, c.availH);
    const bad = diffCase(c.nodes, dom, eng);

    // 대조군 (현 어댑터 경로) — 기록만, 게이트 아님 (breakdown Phase 3).
    let adapterNote: string;
    try {
      const pipe = pipelineLeg(c.nodes, c.availW, c.availH);
      const pipeBad = diffCase(c.nodes, dom, pipe);
      adapterNote =
        pipeBad.length === 0 ? "정합" : `발산 ${pipeBad.length}: ${pipeBad.join(" | ")}`;
    } catch (e) {
      adapterNote = `error: ${String(e)}`;
    }
    console.log(`[ADR-923 P3] ${c.name} · adapterLeg(대조군): ${adapterNote}`);
    RECORD[c.name] = {
      engine: bad.length === 0 ? "정합" : `발산 ${bad.length}: ${bad.join(" | ")}`,
      adapter: adapterNote,
    };

    expect(bad, `${c.name} — Chrome↔엔진 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ── r8l2 — 프로덕션 파이프라인 wrap intrinsic-min 전용 fixture (게이트) ──
//
// Phase 3 수리 중 유일하게 프로덕션 실효인 wrap flex min-content 정정
// (`min_wrap_measure` — css-flexbox-1 §9.9.1: min-content = 최대 item contribution,
// 합산 아님) 을 **프로덕션 어댑터 경로(pipelineLeg)** 로 게이트한다 — 위 표의
// 엔진 직결 ib-shrink-to-fit-wrap 은 raw inline-flex 라 프로덕션 운반 어휘 밖.
// display:flex(운반 union 내) row 부모의 flex item 이 min-width:auto 바닥으로
// min-content 를 실제로 소비한다: max-content 160 → shrink 목표 60 → 바닥 80.
describe("ADR-923 r8l2 — 프로덕션 wrap intrinsic-min (pipelineLeg 게이트)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it("flex row 60px 안 wrap flex item 은 min-content(최대 item 80)로 바닥", () => {
    const nodes: CaseNode[] = [
      { label: "f1", style: { width: "80px", height: "20px" } },
      { label: "f2", style: { width: "80px", height: "20px" } },
      {
        label: "f",
        style: { display: "flex", flexWrap: "wrap" },
        children: [0, 1],
      },
      {
        label: "root",
        style: { display: "flex", width: "60px" },
        children: [2],
      },
    ];
    const dom = domLeg(nodes, 60);
    const pipe = pipelineLeg(nodes, 60, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});
