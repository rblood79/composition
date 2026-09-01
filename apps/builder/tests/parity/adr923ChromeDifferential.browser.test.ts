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
  // ── round 9 (Codex r9h1 / r9m2 재현 + 인접 margin-collapse 경계 실측) ──
  {
    name: "flex-item-clip-auto-min — r9h1: overflow:clip flex item 은 scroll container 아님 → §4.5 content floor 유지",
    availW: 60,
    availH: -1,
    nodes: [
      { label: "f1", style: { width: "80px", height: "20px" } },
      { label: "f2", style: { width: "80px", height: "20px" } },
      {
        label: "f",
        style: { display: "flex", flexWrap: "wrap", overflowX: "clip" },
        children: [0, 1],
      },
      {
        label: "root",
        style: { display: "flex", width: "60px", ...FS0 },
        children: [2],
      },
    ],
  },
  {
    name: "flex-item-hidden-auto-min — r9h1 대조군: hidden 은 scroll container → floor 0",
    availW: 60,
    availH: -1,
    nodes: [
      { label: "f1", style: { width: "80px", height: "20px" } },
      { label: "f2", style: { width: "80px", height: "20px" } },
      {
        label: "f",
        style: { display: "flex", flexWrap: "wrap", overflowX: "hidden" },
        children: [0, 1],
      },
      {
        label: "root",
        style: { display: "flex", width: "60px", ...FS0 },
        children: [2],
      },
    ],
  },
  {
    name: "trailing-empty-block-escape — r9m2: 마지막 empty block 의 관통 margin 은 부모 bottom 으로 탈출 (auto height 제외)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "solid",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "empty",
        style: { display: "block", marginTop: "20px", marginBottom: "30px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "trailing-margin-contained — r9m2: 부모 padding-bottom 이 있으면 마지막 자식 bottom margin 은 content 에 포함",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "child",
        style: { display: "block", height: "10px", marginBottom: "20px" },
      },
      {
        label: "root",
        style: {
          display: "block",
          width: "300px",
          paddingBottom: "1px",
          ...FS0,
        },
        children: [0],
      },
    ],
  },
  {
    name: "trailing-empty-block-contained — r9m2: padding-bottom 부모 안 마지막 empty block 관통 margin 포함",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "solid",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "empty",
        style: { display: "block", marginTop: "20px", marginBottom: "30px" },
      },
      {
        label: "root",
        style: {
          display: "block",
          width: "300px",
          paddingBottom: "1px",
          ...FS0,
        },
        children: [0, 1],
      },
    ],
  },
  {
    name: "bfc-last-child-margin-escape — r9 인접: BFC 자식(flex) 의 자기 bottom margin 은 부모 bottom 과 collapse (탈출)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "b",
        style: { display: "flex", height: "10px", marginBottom: "20px" },
      },
      { label: "wrap", style: { display: "block" }, children: [0] },
      { label: "sib", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "bfc-sibling-top-collapse — r9 인접: BFC 자식(flex) 의 자기 top margin 은 이전 형제 bottom 과 collapse",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "20px" },
      },
      {
        label: "b",
        style: { display: "flex", marginTop: "10px", height: "10px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "bfc-first-child-top-escape — r9 인접: BFC 자식(flex) 의 자기 top margin 은 부모 top 과 collapse (탈출)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: { display: "block", height: "10px" } },
      {
        label: "b",
        style: { display: "flex", marginTop: "20px", height: "10px" },
      },
      { label: "wrap", style: { display: "block" }, children: [1] },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 2],
      },
    ],
  },
  {
    name: "empty-first-child-padded — r9 인접: padding-top 부모 안 첫 empty block 위치 = non-zero bottom border 가정 (§8.3.1)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "empty",
        style: { display: "block", marginTop: "20px", marginBottom: "30px" },
      },
      {
        label: "solid",
        style: { display: "block", marginTop: "5px", height: "10px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", paddingTop: "1px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  {
    name: "empty-first-chain-through-wrap — r9 인접: 첫 empty block + 다음 block 의 margin chain 이 wrap top 으로 통째 탈출",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "a", style: { display: "block", height: "10px" } },
      {
        label: "empty",
        style: { display: "block", marginTop: "20px", marginBottom: "30px" },
      },
      {
        label: "solid",
        style: { display: "block", marginTop: "5px", height: "10px" },
      },
      { label: "wrap", style: { display: "block" }, children: [1, 2] },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 3],
      },
    ],
  },
  {
    name: "flex-item-cross-hidden-auto-min — r9h1 양축: overflowY hidden 만 있어도 computed overflowX 는 auto → scroll container → floor 0",
    availW: 60,
    availH: -1,
    nodes: [
      { label: "f1", style: { width: "80px", height: "20px" } },
      { label: "f2", style: { width: "80px", height: "20px" } },
      {
        label: "f",
        style: { display: "flex", flexWrap: "wrap", overflowY: "hidden" },
        children: [0, 1],
      },
      {
        label: "root",
        style: { display: "flex", width: "60px", ...FS0 },
        children: [2],
      },
    ],
  },
  {
    name: "block-margin-then-line-box — r9 인접: line box 는 margin 을 collapse 하지 않는다 (block mb10 뒤 inline-block y 20)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      { label: "b", style: ib(60, 20) },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1],
      },
    ],
  },
  // ── round 9 후속 관찰 ① — height:0 명시 self-collapsing (§8.3.1 "zero or auto computed height") ──
  {
    name: "height-zero-self-collapsing — 관찰①: height:0 명시 + margin 은 self-collapsing (chain 관통, b.y 40)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "z",
        style: {
          display: "block",
          height: "0px",
          marginTop: "20px",
          marginBottom: "30px",
        },
      },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "height-zero-with-content-not-self-collapsing — 관찰① 대조군: height:0 이라도 in-flow 내용이 있으면 self-collapsing 아님 (b.y 60)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      { label: "inner", style: { display: "block", height: "10px" } },
      {
        label: "z",
        style: {
          display: "block",
          height: "0px",
          marginTop: "20px",
          marginBottom: "30px",
        },
        children: [1],
      },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 2, 3],
      },
    ],
  },
  {
    name: "self-collapsing-wrapper-of-empty — 관찰①: 자식이 전부 self-collapsing 이면 wrapper 도 self-collapsing (b.y 40)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "e",
        style: { display: "block", marginTop: "20px", marginBottom: "30px" },
      },
      { label: "wrap", style: { display: "block" }, children: [1] },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 2, 3],
      },
    ],
  },
  {
    name: "abs-only-height-zero-self-collapsing — r10m1: absolute 자식만 가진 height:0 컨테이너는 self-collapsing (b.y 40)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "abs",
        style: { position: "absolute", width: "10px", height: "10px" },
      },
      {
        label: "z",
        style: {
          display: "block",
          height: "0px",
          marginTop: "20px",
          marginBottom: "30px",
        },
        children: [1],
      },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 2, 3],
      },
    ],
  },
  {
    name: "abs-only-auto-height-self-collapsing — r10m1 대조군: 같은 구조 height auto 도 self-collapsing (b.y 40)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "abs",
        style: { position: "absolute", width: "10px", height: "10px" },
      },
      {
        label: "z",
        style: { display: "block", marginTop: "20px", marginBottom: "30px" },
        children: [1],
      },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 2, 3],
      },
    ],
  },
  {
    name: "mixed-sign-chain-three-empties — r10m2: 부호 혼합 3+ adjoining margin 은 최대 양수 + 최소 음수 한 집합 (b.y 20)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "e1",
        style: { display: "block", marginTop: "30px", marginBottom: "-20px" },
      },
      {
        label: "e2",
        style: { display: "block", marginTop: "5px", marginBottom: "25px" },
      },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1, 2, 3],
      },
    ],
  },
  {
    name: "mixed-sign-chain-hoisted-through-wrapper — r10m2: 손자에서 탈출한 음수 margin 도 wrapper·형제 margin 과 한 집합 (g.y 20)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "g",
        style: { display: "block", height: "10px", marginTop: "-20px" },
      },
      {
        label: "c",
        style: { display: "block", marginTop: "30px" },
        children: [1],
      },
      {
        label: "wrap",
        style: { display: "block", marginTop: "25px" },
        children: [2],
      },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 3, 4],
      },
    ],
  },
  {
    name: "mixed-sign-chain-self-collapsing-wrapper — r10m2: self-collapsing wrapper 의 자기 margin + 탈출 chain + 형제 margin 한 집합 (b.y 20)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "e",
        style: { display: "block", marginTop: "30px", marginBottom: "-20px" },
      },
      {
        label: "wrap",
        style: { display: "block", marginTop: "25px" },
        children: [1],
      },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 2, 3],
      },
    ],
  },
  {
    name: "negative-top-margin-padded-auto-height-clamped — r10m3: 음수 top margin 으로 in-flow bottom 이 음수여도 auto height 는 0 하한 (root.h 2)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginTop: "-30px" },
      },
      {
        label: "root",
        style: {
          display: "block",
          width: "300px",
          paddingTop: "1px",
          paddingRight: "1px",
          paddingBottom: "1px",
          paddingLeft: "1px",
          ...FS0,
        },
        children: [0],
      },
    ],
  },
  {
    name: "negative-bottom-margin-contained-clamped — r10m3: bottom padding 이 담는 음수 bottom margin 도 0 하한 (root.h 1)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "-30px" },
      },
      {
        label: "root",
        style: {
          display: "block",
          width: "300px",
          paddingBottom: "1px",
          ...FS0,
        },
        children: [0],
      },
    ],
  },
  {
    name: "negative-flow-bottom-not-self-collapsing — r10m3 인접: 음수 margin 으로 in-flow bottom ≤ 0 이어도 내용 있는 컨테이너는 self-collapsing 아님 (b.y 60)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "c1",
        style: { display: "block", height: "20px", marginBottom: "-30px" },
      },
      { label: "c2", style: { display: "block", height: "5px" } },
      {
        label: "wrap",
        style: { display: "block", marginTop: "20px", marginBottom: "30px" },
        children: [1, 2],
      },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 3, 4],
      },
    ],
  },
  {
    name: "text-leaf-height-zero-has-line-box — r10h1: 텍스트 leaf 는 height:0 이어도 line box 가 있어 self-collapsing 아님 (b.y 60; engine leg 은 leafBaseline 스칼라 = line box 신호)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "t",
        style: {
          display: "block",
          height: "0px",
          marginTop: "20px",
          marginBottom: "30px",
          fontSize: "16px",
        },
        text: "x",
        elementType: "Text",
        engineStyle: { leafBaseline: 12 },
      },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "parent-explicit-height-bottom-margin-contained — r11m1: height:50px 부모의 마지막 자식 bottom margin 은 부모 bottom 과 adjoining 아님 (§8.3.1 bottom 조건 = height auto + min-height 0; b.y 50)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", height: "50px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-min-height-nonbinding-bottom-margin-collapses — r11m1 대조군: min-height:10px (content 20 보다 작아 미바인딩) 부모는 접힘 유지 — §8.3.1 adjoining 조건은 height auto 뿐, min-height:0 은 self-collapsing 조건 (Chrome b.y 40; min_h>0 일괄 포함이면 55)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", minHeight: "10px", marginBottom: "15px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-min-height-binding-bottom-margin — r11m1: min-height:100px 바인딩 시 strut 미전파 (Chrome b.y 115 — 탈출이면 120)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", minHeight: "100px", marginBottom: "15px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-min-height-partially-binding-bottom-margin — r11m1: min-height:30px 이 strut 제외 content 20 보다 크고 strut 포함 40 보다 작을 때 strut 미전파 (Blink: used ≠ intrinsic; Chrome p.h 30 · b.y 45 — 포함-후-clamp 모델의 40 · 55 반증)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", minHeight: "30px", marginBottom: "15px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-max-height-binding-bottom-margin — r11m1: max-height:10px 바인딩 시 strut 미전파 (Chrome p.h 10 · b.y 25 — 탈출이면 30)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", maxHeight: "10px", marginBottom: "15px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-height-zero-bottom-margin-contained — r11m1 인접: height:0 (auto 아님) 부모는 used height 0 + 마지막 자식 margin 미탈출 (b.y 0)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", height: "0px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-height-zero-min-height-used — r11m1 인접: height:0 + min-height:10px 부모의 used height 는 10, 자식 margin 미탈출 (b.y 10)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", height: "0px", minHeight: "10px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-min-height-zero-bottom-margin-collapses — r11m1 대조군: min-height:0 명시 + auto height 는 접힘 유지 (max(20,15)=20; b.y 40)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", minHeight: "0px", marginBottom: "15px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-max-height-bottom-margin-collapses — r11m1 대조군: max-height 는 §8.3.1 bottom 조건에 없어 접힘 유지 (b.y 40)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", maxHeight: "100px", marginBottom: "15px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-explicit-height-top-margin-still-collapses — r11m1 대조군: height 명시는 top collapse 에 무관 (§8.3.1 top 조건은 border/padding 만; p.y 30 · c.y 30 · b.y 80)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px" },
      },
      {
        label: "c",
        style: { display: "block", height: "20px", marginTop: "20px" },
      },
      {
        label: "p",
        style: { display: "block", height: "50px" },
        children: [1],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [0, 2, 3],
      },
    ],
  },
  {
    name: "parent-percent-min-height-indefinite-cb-collapses — r12m1: 부모 auto 높이(indefinite CB) 아래 min-height:50% 는 0 (§10.7) → 미바인딩, 접힘 유지 (b.y 40; 수평 ctx 로 150 해석 시 35)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", minHeight: "50%", marginBottom: "15px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-percent-min-height-definite-cb-binding — r12m1 대조군: root height:200px (definite CB) 아래 min-height:50% = 100 바인딩 → strut 미전파 (p.h 100 · b.y 115)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", minHeight: "50%", marginBottom: "15px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0, height: "200px" },
        children: [1, 2],
      },
    ],
  },
  {
    name: "parent-min-over-max-height-min-wins — r12m2: min-height:30 > max-height:10 이면 min 우선 (§10.7 max-then-min; Chrome p.h 30 · b.y 45 / min-then-max 는 10·25)",
    availW: 300,
    availH: -1,
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: {
          display: "block",
          minHeight: "30px",
          maxHeight: "10px",
          marginBottom: "15px",
        },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [1, 2],
      },
    ],
  },
  {
    name: "root-min-over-max-height-min-wins — r12m2 sweep: root 자신의 auto 높이 clamp 도 max-then-min (Chrome root.h 30 / 종전 10)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "c", style: { display: "block", height: "20px" } },
      {
        label: "root",
        style: {
          display: "block",
          width: "300px",
          minHeight: "30px",
          maxHeight: "10px",
          ...FS0,
        },
        children: [0],
      },
    ],
  },
  {
    name: "grid-item-min-over-max-height-min-wins — r12m2 sweep: grid auto 트랙 기여값 clamp 도 max-then-min (Chrome c.h 30 · root.h 30)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "c", style: { minHeight: "30px", maxHeight: "10px" } },
      {
        label: "root",
        style: {
          display: "grid",
          gridTemplateColumns: ["1fr"],
          width: "300px",
          ...FS0,
        },
        children: [0],
      },
    ],
  },
  {
    name: "height-zero-parent-abs-child-bottom-inset — r12l2: height:0 (auto 아님) 부모의 absolute containing block 높이는 0 → bottom:0 자식 y = −10 (content 높이 기준이면 +10)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "c", style: { display: "block", height: "20px" } },
      {
        label: "abs",
        style: {
          position: "absolute",
          bottom: "0px",
          width: "20px",
          height: "10px",
        },
        engineStyle: { insetBottom: "0px" },
      },
      {
        label: "p",
        style: { display: "block", height: "0px", position: "relative" },
        children: [0, 1],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", ...FS0 },
        children: [2, 3],
      },
    ],
  },
  {
    name: "root-explicit-height-zero-min-height-clamp — r12 과제 5 (sweep): root 명시 height:0 에도 min-height 가 건다 (§10.7; Chrome root.h 10 / 종전 has_h 분기 0)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "c", style: { display: "block", height: "20px" } },
      {
        label: "root",
        style: {
          display: "block",
          width: "300px",
          height: "0px",
          minHeight: "10px",
          ...FS0,
        },
        children: [0],
      },
    ],
  },
  {
    name: "root-min-over-max-width-min-wins — r13l4: root 자신의 auto 폭 clamp 도 max-then-min (§10.4; Chrome root.w 250 / min-then-max 100)",
    availW: 300,
    availH: -1,
    nodes: [
      { label: "c", style: { display: "block", height: "20px" } },
      {
        label: "root",
        style: {
          display: "block",
          minWidth: "250px",
          maxWidth: "100px",
          ...FS0,
        },
        children: [0],
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
        pipeBad.length === 0
          ? "정합"
          : `발산 ${pipeBad.length}: ${pipeBad.join(" | ")}`;
    } catch (e) {
      adapterNote = `error: ${String(e)}`;
    }
    console.log(`[ADR-923 P3] ${c.name} · adapterLeg(대조군): ${adapterNote}`);
    RECORD[c.name] = {
      engine:
        bad.length === 0 ? "정합" : `발산 ${bad.length}: ${bad.join(" | ")}`,
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
  // r9h1 — Style Panel 의 Overflow=Clip (shorthand `overflow`) 은 scroll container 가
  // 아니라 §4.5 content floor 를 잃지 않는다 (css-flexbox-1 §4.5 "non-scrollable" ·
  // css-overflow-3 scrollable values = scroll/auto/hidden). Chrome f.w 80.
  it("flex row 60px 안 overflow:clip wrap flex item 은 min-content 바닥 유지 (r9h1)", () => {
    const nodes: CaseNode[] = [
      { label: "f1", style: { width: "80px", height: "20px" } },
      { label: "f2", style: { width: "80px", height: "20px" } },
      {
        label: "f",
        style: { display: "flex", flexWrap: "wrap", overflow: "clip" },
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

  // r10h1 — Text leaf 의 line box 는 엔진에 `leafBaseline` 스칼라로만 도달한다
  // (§8.3.1 "no line boxes" — 텍스트가 있으면 height:0 이어도 self-collapsing 아님).
  // Chrome b.y 60 (20+0+30 순차) · self-collapsing 오분류면 40 (chain collapse).
  const textZero = (
    extra: Record<string, unknown>,
    text: string,
  ): CaseNode[] => [
    {
      label: "a",
      style: { display: "block", height: "10px", marginBottom: "10px" },
    },
    {
      label: "t",
      elementType: "Text",
      text,
      style: {
        height: "0px",
        marginTop: "20px",
        marginBottom: "30px",
        fontSize: "16px",
        ...extra,
      },
    },
    {
      label: "b",
      style: { display: "block", height: "10px", marginTop: "5px" },
    },
    {
      label: "root",
      style: { display: "block", width: "300px" },
      children: [0, 1, 2],
    },
  ];
  /** root 에 style 을 얹어 자식 Text 가 상속받게 한다 (r12h1 — white-space 는 inherited). */
  const textZeroIn = (
    rootExtra: Record<string, unknown>,
    extra: Record<string, unknown>,
    text: string,
  ): CaseNode[] => {
    const nodes = textZero(extra, text);
    nodes[3] = { ...nodes[3], style: { ...nodes[3].style, ...rootExtra } };
    return nodes;
  };
  it("height:0 Text leaf 는 line box 가 있어 self-collapsing 아님 (r10h1, b.y 60)", () => {
    const nodes = textZero({}, "hello");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("width 명시 height:0 Text leaf 도 line box 신호 유지 (r10h1 인접, b.y 60)", () => {
    const nodes = textZero({ width: "100px" }, "hello");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("빈 텍스트 height:0 Text leaf 는 line box 없음 → self-collapsing (r10h1 대조군, b.y 40)", () => {
    const nodes = textZero({}, "");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("공백만 있는 Text leaf (white-space normal) 는 collapsible 공백이 전부 제거돼 line box 없음 → self-collapsing (r11h1, b.y 40)", () => {
    const nodes = textZero({}, " ");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("공백·탭·개행만 있는 Text leaf (normal) 도 line box 없음 (r11h1, b.y 40)", () => {
    const nodes = textZero({}, " \t\n ");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("공백만 + white-space:nowrap 도 collapsible → line box 없음 (r11h1, b.y 40)", () => {
    const nodes = textZero({ whiteSpace: "nowrap" }, " ");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("공백만 + white-space:pre-line 은 공백·탭 collapsible → line box 없음 (r11h1 경계, b.y 40)", () => {
    const nodes = textZero({ whiteSpace: "pre-line" }, " \t ");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("개행만 + white-space:pre-line 은 segment break 보존 (forced line break) → Chrome 판정 (r11h1 경계)", () => {
    const nodes = textZero({ whiteSpace: "pre-line" }, "\n");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("공백만 + white-space:pre 는 공백 보존 → line box 있음 (r11h1 대조군, b.y 60)", () => {
    const nodes = textZero({ whiteSpace: "pre" }, " ");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("공백만 + white-space:pre-wrap 도 line box 있음 (r11h1 대조군, b.y 60)", () => {
    const nodes = textZero({ whiteSpace: "pre-wrap" }, "  ");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("nbsp 만 있는 Text leaf 는 collapsible 아님 → line box 있음 (r11h1 대조군, b.y 60)", () => {
    const nodes = textZero({}, "\u00A0");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("fontSize:0 텍스트 x 는 line box 있음 (높이 0 이어도 line box; r11h1 대조군, b.y 60)", () => {
    const nodes = textZero({ fontSize: "0px" }, "x");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("부모 white-space:pre 를 상속한 공백만 Text 는 line box 있음 (r12h1 — inherited property; b.y 60)", () => {
    const nodes = textZeroIn({ whiteSpace: "pre" }, {}, " ");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("부모 white-space:break-spaces 상속 + 공백만 → line box 있음 (r12h1, b.y 60)", () => {
    const nodes = textZeroIn({ whiteSpace: "break-spaces" }, {}, " ");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("부모 pre 상속 + 자식 inline normal 재지정 → line box 없음 (r12h1 대조군, b.y 40)", () => {
    const nodes = textZeroIn(
      { whiteSpace: "pre" },
      { whiteSpace: "normal" },
      " ",
    );
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("부모 pre-line 상속 + 개행만 → segment break 보존 line box (r12h1 경계, b.y 60)", () => {
    const nodes = textZeroIn({ whiteSpace: "pre-line" }, {}, "\n");
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("flex row 안 공백만 Text (width:auto 명시, normal) 폭은 0 — 폭 스칼라 0 (r12l1; box.x 0, raw 공백 폭 공급 시 ≈4. width 미지정은 프로덕션 Text 기본 width:100% 가 실려 대조군 밖)", () => {
    const nodes: CaseNode[] = [
      {
        label: "t",
        elementType: "Text",
        text: " ",
        style: { width: "auto", height: "10px", fontSize: "16px" },
      },
      { label: "box", style: { width: "50px", height: "10px" } },
      {
        label: "root",
        style: { display: "flex", width: "300px" },
        children: [0, 1],
      },
    ];
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  // r13m1 — inline `white-space` 의 cascade 키워드 (`inherit`/`unset`) 는 raw 값이 아니라
  //   cssResolver computed (부모 pre 상속) 로 읽어야 한다 (Chrome 60 / raw 키워드를 normal 로
  //   소비하면 40). `initial` 은 normal 로 되돌아가 40 (대조군).
  it("부모 pre + 자식 inline white-space:inherit → computed pre → line box 있음 (r13m1; Chrome b.y 60, raw 키워드 소비 시 40)", () => {
    const nodes = textZeroIn(
      { whiteSpace: "pre" },
      { whiteSpace: "inherit" },
      " ",
    );
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("부모 pre + 자식 inline white-space:unset (상속 속성 → inherit) → line box 있음 (r13m1; b.y 60)", () => {
    const nodes = textZeroIn(
      { whiteSpace: "pre" },
      { whiteSpace: "unset" },
      " ",
    );
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("부모 pre + 자식 inline white-space:initial → normal → line box 없음 (r13m1 대조군; b.y 40)", () => {
    const nodes = textZeroIn(
      { whiteSpace: "pre" },
      { whiteSpace: "initial" },
      " ",
    );
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  // r13m2 — 텍스트 leaf 의 내용 원천은 binding 이 content 로 선언한 `children` 하나 (Preview 가
  //   그리는 것). `label`/`text` 를 측정 원천으로 읽으면 Chrome 이 그리지 않는 글자의 폭이 실린다.
  it("children 빈 문자열 + label 'X' Text 는 내용 없음 → self-collapsing (r13m2 대조군; Chrome b.y 40)", () => {
    const nodes = textZero({}, "");
    nodes[1] = { ...nodes[1], props: { label: "X" } };
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
  it("flex row 안 children 'Y' + label 'XXXXXXXXXXXXXXXXXXXX' Text (width:auto) 폭은 children 폭 (r13m2; Chrome box.x = w(Y), label 우선 측정 시 w(XXXX…))", () => {
    const nodes: CaseNode[] = [
      {
        label: "t",
        elementType: "Text",
        text: "Y",
        props: { label: "XXXXXXXXXXXXXXXXXXXX" },
        style: { width: "auto", height: "10px", fontSize: "16px" },
      },
      { label: "box", style: { width: "50px", height: "10px" } },
      {
        label: "root",
        style: { display: "flex", width: "300px" },
        children: [0, 1],
      },
    ];
    const dom = domLeg(nodes, 300);
    const pipe = pipelineLeg(nodes, 300, -1);
    const bad = diffCase(nodes, dom, pipe);
    expect(bad, `프로덕션 어댑터↔Chrome 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});
