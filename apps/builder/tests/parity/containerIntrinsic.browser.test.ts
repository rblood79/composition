import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  type ParityCase,
  runParityCase,
  runPipelineParityCase,
} from "./harness";

/**
 * ADR-169 Phase 0 — 컨테이너 flex item 의 intrinsic(min/max-content) 부재 fixture.
 *
 * `solve_flex` 1단계(`tree.rs:1069-1075`)는 각 item 을 **컨테이너 available 로 solve** 하고
 * 그 결과를 `content_main`(off 13)에 적는다. 그래서 *스스로 폭을 갖지 않고 늘어나기만 하는*
 * 내용(auto 폭 블록, `width:100%`)이 item 의 고유 폭으로 오인된다. 그 한 값이
 * ① flex base size ② §4.5 automatic minimum floor(off 19 absent fallback, `flex.rs:288-293`)
 * **양쪽**에 들어가 — **상한 근사가 하한으로 쓰인다.**
 *
 * leaf 는 ADR-165 스칼라(`contentMinWidth`/`contentMaxWidth`)로 이미 정확하다.
 * **컨테이너만** 비어 있고, **내용이 stretch 로만 늘어난 경우에만** 발산한다.
 *
 * ## 이 파일의 계약
 *
 * - `it` = 현재 정합 → **회귀 가드**. Phase 1(동작 무변경)·Phase 2 이후에도 green 유지.
 * - `it.fails` = 현재 발산 → **Phase 2 목표**. 안쪽 단언은 목표 상태(`toEqual([])`)이므로,
 *   Phase 2 가 성공하면 이 테스트가 "실패해야 하는데 통과" 로 **red 가 된다**. `.fails` 제거가
 *   곧 green 판정이다 (부분 반영 상태로 조용히 통과하는 경로가 없다 — R2/G3).
 *
 * ## 실측 (2026-07-27, Phase 0 착수 시점)
 *
 * 행 컨테이너 1920 = `[sidebar(고정), content(flexGrow:1)]`.
 *
 * | 케이스                              | DOM(sidebar/content) | engine     | 판정 |
 * | ----------------------------------- | -------------------- | ---------- | ---- |
 * | A. 자식 고정 50px                   | 240 / 1680           | 동일       | 정합 |
 * | B. 자식 고정 3000px                 | 0 / 3000             | 동일       | 정합 |
 * | C. 텍스트 leaf 가 item 자신         | 240 / 1680           | 동일       | 정합 |
 * | D. 자식 `width:100%`                | 240 / 1680           | 0 / 1920   | 발산 |
 * | E. 자식 auto 폭 블록                | 240 / 1680           | 0 / 1920   | 발산 |
 * | F. 텍스트 leaf 가 컨테이너 안       | 240 / 1680           | 0 / 1920   | 발산 |
 * | G. 프리셋 (sidebar `flexShrink:0`)  | 250 / 1670           | 250 / 1920 | 발산 |
 *
 * G 만 sidebar 폭이 살아 있다 — `flexShrink:0` 이라 붕괴 대신 **컨테이너를 정확히 250 초과**한다.
 * 나머지 발산 3형태는 형제가 0 으로 붕괴한다. 두 증상은 같은 원인의 두 얼굴이다.
 *
 * ## R8 판정 (2026-07-27) — masking 실재 확인
 *
 * `width:fit-content` 컨테이너(R8-a)에서 **engine leg 와 pipeline leg 의 결과가 다르다**
 * (0/1920 vs 236.7/1683.3). TS 선계산이 이 형태에 도달해 배치를 바꾼다는 뜻이고,
 * `growsInFlex` 가 `width` 채널을 막으므로 해당 채널은 `minWidth` 주입뿐이다
 * (`utils.ts:4767-4769`). 즉 `min_main != AUTO` 가 되어 **§4.5 auto-min 분기가 실행되지
 * 않으며, Phase 2 가 off 19 을 정확히 채워도 이 형태에는 도달하지 못한다.**
 * 존치·축소 판정은 Phase 2 (G2 통과 조건).
 */
const ROOT_W = 1920;

/** 공통 root — row flex, 폭 1920 고정. */
function row(children: number[]): ParityCase["nodes"][number] {
  return {
    label: "root",
    style: {
      display: "flex",
      flexDirection: "row",
      width: `${ROOT_W}px`,
      height: "200px",
    },
    children,
  };
}

// ── 정합 케이스 (회귀 가드) ──
const ALIGNED: ParityCase[] = [
  {
    // 자식이 **스스로 폭을 갖는다** — 오인할 여지가 없다.
    name: "A. content 자식 고정 50px",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "a-inner", style: { width: "50px", height: "40px" } },
      {
        label: "a-content",
        style: { flexGrow: 1, height: "100px" },
        children: [0],
      },
      { label: "a-sidebar", style: { width: "240px", height: "100px" } },
      row([1, 2]),
    ],
  },
  {
    // 진짜 과폭 — DOM 도 동일하게 형제를 붕괴시킨다. "붕괴 = 버그" 가 아님을 고정.
    name: "B. content 자식 고정 3000px (DOM 도 형제 붕괴)",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "b-inner", style: { width: "3000px", height: "40px" } },
      {
        label: "b-content",
        style: { flexGrow: 1, height: "100px" },
        children: [0],
      },
      { label: "b-sidebar", style: { width: "240px", height: "100px" } },
      row([1, 2]),
    ],
  },
  {
    // 텍스트 leaf 가 **item 자신** — ADR-165 스칼라가 off 13/19 을 채워 정확.
    name: "C. 텍스트 leaf 가 item 자신 (ADR-165 스칼라 경로)",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      {
        label: "c-content",
        style: {
          flexGrow: 1,
          height: "100px",
          contentMinWidth: 300,
          contentMaxWidth: 500,
        },
        domAtoms: [300, 200],
      },
      { label: "c-sidebar", style: { width: "240px", height: "100px" } },
      row([0, 1]),
    ],
  },
];

// ── 발산 케이스 (Phase 2 목표) ──
const DIVERGENT: ParityCase[] = [
  {
    // 자식 `width:100%` — 백분율이 available 로 해소되어 item 폭으로 오인.
    name: "D. content 자식 width:100%",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "d-inner", style: { width: "100%", height: "40px" } },
      {
        label: "d-content",
        style: { flexGrow: 1, height: "100px" },
        children: [0],
      },
      { label: "d-sidebar", style: { width: "240px", height: "100px" } },
      row([1, 2]),
    ],
  },
  {
    // 자식 auto 폭 블록 — 백분율이 아니어도 stretch 만으로 동일 오인.
    // (초기 가설 "백분율이 방아쇠" 를 반증한 형태 — 조건은 **stretch 전반**이다.)
    name: "E. content 자식 auto 폭 블록",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "e-inner", style: { height: "40px" } },
      {
        label: "e-content",
        style: { flexGrow: 1, height: "100px" },
        children: [0],
      },
      { label: "e-sidebar", style: { width: "240px", height: "100px" } },
      row([1, 2]),
    ],
  },
  {
    // 같은 텍스트 leaf 를 **컨테이너 안에** 넣으면 깨진다.
    // "텍스트라서" 가 아니라 "컨테이너라서" 임을 고정하는 대조군 (C 와 짝).
    name: "F. 텍스트 leaf 가 컨테이너 item 안 (C 의 대조군)",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      {
        // height 명시 — 폭 축만 격리한다. 생략하면 engine leg 가 leaf height 를 0 으로 내
        // (원자 10px 를 모른다) 폭과 무관한 h 발산이 섞인다.
        label: "f-leaf",
        style: { height: "10px", contentMinWidth: 300, contentMaxWidth: 500 },
        domAtoms: [300, 200],
      },
      {
        label: "f-content",
        style: { flexGrow: 1, height: "100px" },
        children: [0],
      },
      { label: "f-sidebar", style: { width: "240px", height: "100px" } },
      row([1, 2]),
    ],
  },
  {
    // 프리셋 실형태 — `sidebar-left`/`sidebar-right`/`list-detail`
    // (`presetDefinitions.ts:194/229/267`). 고정 슬롯에 `flexShrink:0` 이 있어
    // **붕괴 대신 초과**로 나타난다 — content 가 available 전체를 차지해 컨테이너를
    // 정확히 sidebar 폭만큼 넘는다.
    name: "G. 프리셋 실형태 (sidebar 250 flexShrink:0 → 붕괴 아닌 초과)",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "g-inner", style: { width: "100%", height: "40px" } },
      {
        label: "g-content",
        style: { flexGrow: 1, height: "100px" },
        children: [0],
      },
      {
        label: "g-sidebar",
        style: { width: "250px", flexShrink: 0, height: "100px" },
      },
      row([1, 2]),
    ],
  },
];

/**
 * R8 — TS `minWidth` 주입이 §4.5 auto-min 을 무력화하는가.
 *
 * `utils.ts:4767-4769` 은 `isFlexChild && style.minWidth == null` 이면
 * `minWidth = ceiledWidth` 를 주입한다. 그러면 `flex.rs:292` 의 `min_main == AUTO` 가
 * 거짓이 되어 **auto-min 분기 자체가 실행되지 않는다**. 도달 조건인
 * `needsWidth`(`utils.ts:4490`)에는 leaf 태그군뿐 아니라 `width:fit-content` 를 선언한
 * **컨테이너**도 포함된다(`utils.ts:4479` "모든 요소에서" 명시). 그리고 이 주입은
 * `growsInFlex` 가드 **바깥**이라 `flexGrow:1` 이어도 걸린다 (width 만 면제됨).
 *
 * 판정 방법: 같은 케이스를 engine leg 와 pipeline leg 로 각각 돌려 **차이**를 본다.
 * engineLeg 는 WASM 을 직접 호출해 TS 선계산을 타지 않으므로, 두 leg 의 발산 목록이
 * 다르면 주입이 실제로 도달해 배치를 바꾼 것이다.
 *
 * **판별력 요건**: 자식이 stretch 로만 늘어나야 한다. 고정폭 자식(R8-b)은 애초에 발산
 * 조건이 아니라 두 leg 가 모두 정합이라 masking 여부를 가리지 못한다 — 대조군으로만 둔다.
 */
const R8_CASES: ParityCase[] = [
  {
    // 판별 케이스 — D(발산) + `width:fit-content`.
    name: "R8-a. width:fit-content 컨테이너 + stretch 자식 (판별)",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "r8a-inner", style: { width: "100%", height: "40px" } },
      {
        label: "r8a-content",
        style: { width: "fit-content", flexGrow: 1, height: "100px" },
        children: [0],
      },
      { label: "r8a-sidebar", style: { width: "240px", height: "100px" } },
      row([1, 2]),
    ],
  },
  {
    // 대조군 — 자식이 스스로 폭을 가지면 발산 자체가 없다.
    name: "R8-b. width:fit-content 컨테이너 + 고정폭 자식 (대조군)",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "r8b-inner", style: { width: "300px", height: "40px" } },
      {
        label: "r8b-content",
        style: { width: "fit-content", flexGrow: 1, height: "100px" },
        children: [0],
      },
      { label: "r8b-sidebar", style: { width: "240px", height: "100px" } },
      row([1, 2]),
    ],
  },
];

describe("컨테이너 flex item intrinsic ↔ CSS 대조 (ADR-169)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  describe("정합 — 회귀 가드", () => {
    for (const c of ALIGNED) {
      it(c.name, () => {
        expect(runParityCase(c)).toEqual([]);
      });
    }
  });

  describe("발산 — Phase 2 목표 (통과하면 red → .fails 제거)", () => {
    for (const c of DIVERGENT) {
      it.fails(c.name, () => {
        expect(runParityCase(c)).toEqual([]);
      });
    }
  });

  // 프리셋 실형태(G)는 빌더 실 진입점으로도 건다 — 엔진만 고치고 TS 선계산이 되돌리는
  // 상태를 막는다. Phase 2 후 이 단언이 통과하면 red 가 되어 `.fails` 제거를 강제한다.
  describe("파이프라인 leg — TS 선계산 상쇄 없음 확인", () => {
    it.fails("G. 프리셋 실형태 (calculateFullTreeLayout 경유)", () => {
      expect(runPipelineParityCase(DIVERGENT[3])).toEqual([]);
    });
  });

  // 인라인 스냅샷은 **호출 지점당 1개**라 루프로 묶으면 기록에 실패한다 — 펼쳐 둔다.
  describe("R8 — TS minWidth 주입의 masking 판정", () => {
    it("R8-a 판별 — engine leg (TS 선계산 미경유)", () => {
      expect(runParityCase(R8_CASES[0])).toMatchInlineSnapshot(`
        [
          "r8a-inner.w: dom=1680.0 eng=1920.0 (Δ240.0)",
          "r8a-content.w: dom=1680.0 eng=1920.0 (Δ240.0)",
          "r8a-sidebar.x: dom=1680.0 eng=1920.0 (Δ240.0)",
          "r8a-sidebar.w: dom=240.0 eng=0.0 (Δ240.0)",
        ]
      `);
    });

    it("R8-a 판별 — pipeline leg (TS minWidth 주입 경유)", () => {
      expect(runPipelineParityCase(R8_CASES[0])).toMatchInlineSnapshot(`
        [
          "r8a-inner.w: dom=1680.0 eng=1706.7 (Δ26.7)",
          "r8a-content.w: dom=1680.0 eng=1683.3 (Δ3.3)",
          "r8a-sidebar.x: dom=1680.0 eng=1683.3 (Δ3.3)",
          "r8a-sidebar.w: dom=240.0 eng=236.7 (Δ3.3)",
        ]
      `);
    });

    it("R8-b 대조군 — engine leg", () => {
      expect(runParityCase(R8_CASES[1])).toMatchInlineSnapshot(`[]`);
    });

    it("R8-b 대조군 — pipeline leg", () => {
      expect(runPipelineParityCase(R8_CASES[1])).toMatchInlineSnapshot(`[]`);
    });
  });
});
