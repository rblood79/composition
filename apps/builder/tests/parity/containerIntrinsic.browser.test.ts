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
 * 전 케이스 green (Phase 2 완료). 착수 시점에는 발산 4형태가 `it.fails` 였고, Phase 2 가
 * 성공하는 순간 "실패해야 하는데 통과" 로 red 가 되어 `.fails` 제거를 강제하도록 걸어 뒀다 —
 * 부분 반영 상태가 조용히 green 으로 넘어가는 경로를 없애기 위해서다 (R2/G3).
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
 *
 * ## Phase 3 판정 (2026-07-27) — grid 이연 / height 축 부재
 *
 * | 축                | 실측                                             | 판정                       |
 * | ----------------- | ------------------------------------------------ | -------------------------- |
 * | grid (I/J)        | 측정 모드에서 fr·auto 트랙 0 → item 통째로 붕괴 | **이연** — 측정 자체를 포기 |
 * | height (K)        | 컨테이너·형제 정합, 백분율 재해소만 발산        | **결함 부재** (구조상)      |
 *
 * grid 는 `measure_intrinsic_width` 가 `None` 을 돌려 ADR-169 이전 경로를 유지한다.
 * height 축은 블록 방향이 내용 크기라 "stretch 를 고유 크기로 오인" 하는 형태가 성립하지
 * 않는다 — 빈도가 아니라 구조상 인라인 축 전용이다. 상세는 각 케이스 docblock.
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
    // **floor 구속 케이스** — sidebar 를 1800 `flexShrink:0` 으로 키워 content 가
    // available 훨씬 아래(120)로 눌리게 만든다. 여기서는 base size 가 아니라 **하한**이
    // 결과를 정한다. TS 가 주입한 `minWidth` 가 참 min-content(0)보다 크면 그 값이
    // 하한이 되어 눌리지 못한다 — masking 이 결과로 드러나는 유일한 형태다.
    name: "R8-c. floor 구속 (sidebar 1800 flexShrink:0)",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "r8c-inner", style: { width: "100%", height: "40px" } },
      {
        label: "r8c-content",
        style: { width: "fit-content", flexGrow: 1, height: "100px" },
        children: [0],
      },
      {
        label: "r8c-sidebar",
        style: { width: "1800px", flexShrink: 0, height: "100px" },
      },
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

/**
 * R8-d — **결정적 masking 판별** (pipeline 전용).
 *
 * R8-a/b/c 는 컨테이너 자식이 stretch 이거나 고정폭이라, TS 의 `baseContentWidth` 가
 * 0 이거나 참 min-content 와 같아져 주입이 과대해질 수 없다. 주입이 참 하한보다
 * **커지려면** 컨테이너 콘텐츠가 "펼치면 넓지만 접으면 좁은" 것이어야 한다 — 실텍스트다.
 * TS 는 단일줄 폭을, CSS 는 최장 단어를 하한으로 본다.
 *
 * 형태: 접히지 않으면 안 되는 압박(sidebar 300 `flexShrink:0`, root 340)에 텍스트를
 * 품은 `width:fit-content` 컨테이너. 주입된 minWidth 가 하한이 되면 컨테이너가 단일줄
 * 폭에서 멈춰 DOM(최장 단어까지 접힘)과 갈린다.
 *
 * engine leg 는 태우지 않는다 — 실텍스트 스칼라를 손으로 넣으면 Chrome font metric 과
 * 어긋나 판별이 아니라 측정 오차를 재게 된다 (`intrinsicSizing` PIPELINE_CASES 와 동일 이유).
 */
const R8D_TEXT_STYLE = {
  width: "auto",
  fontSize: 16,
  fontFamily: "Arial",
  fontWeight: 400,
  lineHeight: "20px",
} as const;

const R8D_FLOOR_BINDING_TEXT: ParityCase = {
  name: "R8-d. 실텍스트 + fit-content 컨테이너, floor 구속",
  availW: 340,
  availH: -1,
  nodes: [
    {
      label: "r8d-text",
      elementType: "Text",
      text: "Hello World Wide",
      style: { ...R8D_TEXT_STYLE },
    },
    {
      label: "r8d-content",
      style: { width: "fit-content", flexGrow: 1, overflowX: "hidden" },
      children: [0],
    },
    {
      label: "r8d-sidebar",
      style: { width: "300px", flexShrink: 0, height: "40px" },
    },
    {
      label: "r8d-root",
      style: {
        display: "flex",
        flexDirection: "row",
        width: "340px",
        height: "80px",
        alignItems: "flex-start",
      },
      children: [1, 2],
    },
  ],
};

/**
 * H — **§4.5 floor 채널(off 19) 전용 판별** (pipeline, 실텍스트).
 *
 * R8-d 는 `overflow:hidden` 이라 §4.5 가 애초에 적용되지 않아 floor 채널을 태우지 않는다.
 * 이 케이스는 컨테이너를 overflow visible / width auto 로 두어 §4.5 조건을 만족시키고,
 * leftover(40)가 min-content 보다 작아 **하한이 결과를 정하게** 한다.
 *
 * off 13 만 고치고 off 19 을 두면 `0 = absent` 계약 때문에 floor 가 `content_main`
 * = **max-content(단일줄 폭)** 으로 잡힌다 — 컨테이너가 최장 단어까지 접히지 못하고
 * 단일줄 폭에서 멈춘다. 이것이 "부분 반영 금지"(G3)의 실증 형태다.
 */
const H_FLOOR_CHANNEL_TEXT: ParityCase = {
  name: "H. §4.5 floor 채널 — 실텍스트 컨테이너가 최장 단어까지 접힌다",
  availW: 340,
  availH: -1,
  nodes: [
    {
      label: "h-text",
      elementType: "Text",
      text: "Hello World Wide",
      style: { ...R8D_TEXT_STYLE },
    },
    {
      // overflow 미선언(visible) + width auto → §4.5 auto-min 적용 조건 성립.
      label: "h-content",
      style: { flexGrow: 1 },
      children: [0],
    },
    {
      label: "h-sidebar",
      style: { width: "300px", flexShrink: 0, height: "40px" },
    },
    {
      label: "h-root",
      style: {
        display: "flex",
        flexDirection: "row",
        width: "340px",
        height: "80px",
        alignItems: "flex-start",
      },
      children: [1, 2],
    },
  ],
};

/**
 * I/J — **grid 축 이연의 실측 근거** (ADR-169 Phase 3 / G5).
 *
 * `solve_grid` 는 available 이 음수(측정 센티넬 / indefinite)면 fr·auto 트랙을 0 으로
 * 해소한다 (`grid.rs::resolve_grid_tracks` 2단계 `remaining.max(0.0)`). 그래서 측정
 * 모드에서 grid 는 intrinsic 이 (0,0) 으로 나오고, 그 0 을 `content_main` 으로 소비하면
 * grid item 이 **통째로 붕괴**한다 — 토글 실측으로 직접·중첩 형태 모두 1000 → 0 을 확인했다.
 *
 * Phase 3 판정은 **이연**이다. `measure_intrinsic_width` 가 grid 서브트리에 `None` 을
 * 돌려 측정 채널을 열지 않고, ADR-169 이전 경로(컨테이너 available 로 solve)를 그대로 둔다.
 * 아래 스냅샷이 그 상태의 **잔존 발산**이다 — 0 붕괴가 아니라 "DOM 보다 넓게 남는" 형태이며,
 * ADR-169 착수 이전과 동일하다. 재개 조건은 `layout-engine.md` §"컨테이너 intrinsic".
 */
const GRID_DEFERRED: ParityCase[] = [
  {
    name: "I. grid 컨테이너가 직접 flex item",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "i-g1", style: { width: "200px", height: "40px" } },
      { label: "i-g2", style: { width: "200px", height: "40px" } },
      {
        label: "i-grid",
        style: {
          display: "grid",
          gridTemplateColumns: ["1fr", "1fr"],
          height: "100px",
        },
        children: [0, 1],
      },
      {
        label: "i-sidebar",
        style: { width: "240px", flexShrink: 0, height: "100px" },
      },
      row([2, 3]),
    ],
  },
  {
    name: "J. grid 가 flex item 의 자손 (중첩)",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "j-g1", style: { width: "200px", height: "40px" } },
      { label: "j-g2", style: { width: "200px", height: "40px" } },
      {
        label: "j-grid",
        style: {
          display: "grid",
          gridTemplateColumns: ["1fr", "1fr"],
          height: "40px",
        },
        children: [0, 1],
      },
      { label: "j-content", style: { height: "100px" }, children: [2] },
      {
        label: "j-sidebar",
        style: { width: "240px", flexShrink: 0, height: "100px" },
      },
      row([3, 4]),
    ],
  },
];

/**
 * K — **height 축(column main) 실측** (ADR-169 R6 / Phase 3 판정 근거).
 *
 * Phase 2 의 측정 배선은 `is_row` 한정이다. 같은 결함이 세로로도 있는지 보려면 폭 축
 * 발산 형태(G — 고정 형제 `flexShrink:0` + stretch 내용)를 그대로 90° 돌리면 된다.
 * 컨테이너 높이 100 에 footer 60(`flexShrink:0`), content 는 `flexGrow:1` + 자식이
 * `height:100%`.
 *
 * **실측 결과 — 컨테이너 결함은 세로에 없다.** `k-content`/`k-footer` 는 DOM 과 정합이고
 * 발산은 `k-inner.h` 한 줄뿐이다. 이유가 원리적이다: 인라인 방향은 블록 박스의 초기
 * 동작이 **stretch** 라 auto 폭 자식이 available 을 채우지만, 블록 방향은 `height:auto`
 * 가 **내용 크기**다. "늘어나기만 하는 내용을 고유 크기로 오인" 하는 형태 자체가
 * 세로에서는 성립하지 않는다 — 실사용 빈도가 아니라 **구조상** 인라인 축 전용이다.
 *
 * 남는 `k-inner.h`(dom 40 / eng 0)는 **다른 결함**이다 — flex 분배로 부모 높이가 확정된
 * 뒤 `height:100%` 를 재해소하는 경로가 엔진에 없다. 컨테이너 intrinsic 과 무관하므로
 * ADR-169 범위 밖으로 기록만 남긴다 (해소되면 이 스냅샷이 red 로 알린다).
 */
const K_COLUMN_MAIN: ParityCase = {
  name: "K. column main(height) — 컨테이너 결함 부재 + 백분율 잔존",
  availW: 300,
  availH: 100,
  nodes: [
    { label: "k-inner", style: { width: "40px", height: "100%" } },
    {
      label: "k-content",
      style: { flexGrow: 1, width: "100px" },
      children: [0],
    },
    {
      label: "k-footer",
      style: { height: "60px", flexShrink: 0, width: "100px" },
    },
    {
      label: "root",
      style: {
        display: "flex",
        flexDirection: "column",
        width: "300px",
        height: "100px",
      },
      children: [1, 2],
    },
  ],
};

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

  describe("발산이었던 형태 — Phase 2 로 해소 (2026-07-27)", () => {
    for (const c of DIVERGENT) {
      it(c.name, () => {
        expect(runParityCase(c)).toEqual([]);
      });
    }
  });

  // **잔존 발산 (Phase 2 미해소, 실측 기록)**. 엔진 측 floor 채널은 정확하다 —
  // Rust `container_item_floors_at_exact_min_content` 가 동일 형태에서 스칼라 42 를
  // 집계해 42 에서 정지함을 확증한다. 여기서 40 이 나오는 것은 **파이프라인 층**이
  // 중첩 텍스트에 대해 다른 하한을 공급한다는 뜻이고, 원인 지목은 Phase 3 이후로 넘긴다
  // (엔진 오배선이면 위 Rust 테스트가 먼저 red 가 된다 — 두 층이 분리 감시된다).
  describe("§4.5 floor 채널 — 잔존 발산 1.5px", () => {
    it(H_FLOOR_CHANNEL_TEXT.name, () => {
      expect(runPipelineParityCase(H_FLOOR_CHANNEL_TEXT))
        .toMatchInlineSnapshot(`
        [
          "h-text.w: dom=41.5 eng=40.0 (Δ1.5)",
          "h-content.w: dom=41.5 eng=40.0 (Δ1.5)",
          "h-sidebar.x: dom=41.5 eng=40.0 (Δ1.5)",
        ]
      `);
    });
  });

  // 프리셋 실형태(G)는 빌더 실 진입점으로도 건다 — 엔진만 고치고 TS 선계산이 되돌리는
  // 상태를 막는다. Phase 2 후 이 단언이 통과하면 red 가 되어 `.fails` 제거를 강제한다.
  describe("파이프라인 leg — TS 선계산 상쇄 없음 확인", () => {
    it("G. 프리셋 실형태 (calculateFullTreeLayout 경유)", () => {
      expect(runPipelineParityCase(DIVERGENT[3])).toEqual([]);
    });
  });

  // 인라인 스냅샷은 **호출 지점당 1개**라 루프로 묶으면 기록에 실패한다 — 펼쳐 둔다.
  describe("R8 — TS minWidth 주입의 masking 판정", () => {
    it("R8-a 판별 — engine leg (TS 선계산 미경유)", () => {
      expect(runParityCase(R8_CASES[0])).toMatchInlineSnapshot(`[]`);
    });

    it("R8-a 판별 — pipeline leg (TS minWidth 주입 경유)", () => {
      expect(runPipelineParityCase(R8_CASES[0])).toMatchInlineSnapshot(`[]`);
    });

    it("R8-c floor 구속 — engine leg", () => {
      expect(runParityCase(R8_CASES[1])).toMatchInlineSnapshot(`[]`);
    });

    it("R8-c floor 구속 — pipeline leg (masking 여부가 여기서 드러난다)", () => {
      expect(runPipelineParityCase(R8_CASES[1])).toMatchInlineSnapshot(`[]`);
    });

    it("R8-d 결정적 판별 — pipeline leg (실텍스트, floor 구속)", () => {
      expect(
        runPipelineParityCase(R8D_FLOOR_BINDING_TEXT),
      ).toMatchInlineSnapshot(`[]`);
    });

    it("R8-b 대조군 — engine leg", () => {
      expect(runParityCase(R8_CASES[2])).toMatchInlineSnapshot(`[]`);
    });

    it("R8-b 대조군 — pipeline leg", () => {
      expect(runPipelineParityCase(R8_CASES[2])).toMatchInlineSnapshot(`[]`);
    });
  });

  // grid 축 — **2026-07-28 이연 해소**. `solve_grid` 가 측정 센티넬을 받으면 트랙을
  // available 분배 대신 자식 기여로 세운다(§12.5–§12.7.1) — fr 은 §12.7.1 used flex
  // fraction 으로 편다. 종전 스냅샷은 컨테이너 폭 1920(=available 채움) vs DOM 400
  // 이었고, 지금은 4 leg 전부 발산 0 이다.
  //
  // 0 붕괴 재발 감시는 Rust `grid_flex_item_uses_track_contribution` 와 이중이다 —
  // 그쪽은 값(400)을, 여기는 DOM 대조를 잠근다.
  describe("grid 축 — 트랙 기여 기반 intrinsic", () => {
    it("I. grid 직접 flex item — engine leg", () => {
      expect(runParityCase(GRID_DEFERRED[0])).toMatchInlineSnapshot(`[]`);
    });

    it("I. grid 직접 flex item — pipeline leg", () => {
      expect(runPipelineParityCase(GRID_DEFERRED[0])).toMatchInlineSnapshot(`[]`);
    });

    it("J. grid 중첩 — engine leg", () => {
      expect(runParityCase(GRID_DEFERRED[1])).toMatchInlineSnapshot(`[]`);
    });

    it("K. height 축(column main) — engine leg", () => {
      expect(runParityCase(K_COLUMN_MAIN)).toMatchInlineSnapshot(`
        [
          "k-inner.h: dom=40.0 eng=0.0 (Δ40.0)",
        ]
      `);
    });

    it("K. height 축(column main) — pipeline leg", () => {
      expect(runPipelineParityCase(K_COLUMN_MAIN)).toMatchInlineSnapshot(`
        [
          "k-inner.h: dom=40.0 eng=0.0 (Δ40.0)",
        ]
      `);
    });

    it("J. grid 중첩 — pipeline leg", () => {
      expect(runPipelineParityCase(GRID_DEFERRED[1])).toMatchInlineSnapshot(`[]`);
    });
  });
});
