import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  diffCase,
  domLeg,
  engineLeg,
  pipelineLeg,
  type CaseNode,
  type ParityCase,
  type StyleRecord,
} from "./harness";

/**
 * 그리드 컨테이너의 블록 크기는 **행 트랙 extent** 다 — 셀 bounding box 가 아니다
 * (CSS-GRID-1 §11.1 + §12.5–§12.7.1)
 *
 * 종전 엔진은 `height:auto` 그리드의 높이를 자식 셀들의 bounding box(`max_bottom`)로
 * 잡았다. 셀 bbox 는 CSS 와 **두 방향으로** 어긋난다:
 *
 * | 형태                         | 셀 bbox | CSS (트랙 extent) |
 * | ---------------------------- | ------- | ----------------- |
 * | 30px 행 + 20px 자식          | 20      | **30**            |
 * | 30px 행 + 100px 자식(넘침)   | 100     | **30**            |
 * | `30px 40px` + 자식 1개       | 20      | **70** (빈 트랙)  |
 * | 자식에 `marginBottom:50px`   | 10      | **30**            |
 *
 * 넘치는 자식은 흘러넘치고(`overflow` 소관), 자식 없는 트랙도 자리를 차지하며, margin 은
 * 트랙을 늘리지 않는다. 셋 다 "트랙이 크기를 정하고 자식은 그 안에 놓인다" 는 한 규칙의
 * 다른 얼굴이다.
 *
 * ## 미결정 블록 축의 트랙 sizing
 *
 * 그래서 `height:auto` 에서는 **행 토큰을 전부 자식 기여로 세워야** 한다 — 인라인 축의
 * §12.5–§12.7.1 (`gridContainerIntrinsic.browser.test.ts`) 과 같은 규칙이다. `1fr`/`%` 는
 * 나눠 줄 여유가 없으니 content 크기가 되고, `minmax(auto, 60px)` 는 §12.6 으로 상한까지
 * 자란다. 종전 경로는 이 둘을 **상속 available** 로 풀었는데, 그때는 셀 bbox 가 컨테이너
 * 크기여서 우연히 가려져 있었다(`1fr` → 트랙 0 → bbox = 자식 높이 = CSS 값과 일치).
 * 트랙 extent 로 바꾸면 그 우연이 사라지므로 **두 변경은 한 묶음**이다.
 *
 * 블록 축은 min-content == max-content 다 — 높이는 폭이 정해진 뒤의 내용 크기 하나뿐이라
 * 두 값이 갈리지 않는다(인라인 축과 다른 점).
 *
 * ## 암묵 행은 명시 트랙과 **함께** 만들어진다
 *
 * 종전엔 `gridTemplateRows` 가 하나라도 있으면 암묵 행을 아예 만들지 않아, 범위를 넘은
 * 자식이 크기 0 트랙에 얹혔다 — 같은 y 에 겹치고 컨테이너도 짧아진다. 행 목록은
 * `명시 토큰 ++ grid-auto-rows 순환` 이다.
 *
 * ## 자식 → 트랙 매핑은 실제 배치여야 한다
 *
 * 트랙을 재려면 "어느 자식이 어느 트랙에 있는가" 를 알아야 하는데, 그 판정에는 CSS §8.5
 * 커서 규칙(definite column 이 커서보다 왼쪽이면 다음 행)이 들어간다. `i / col_count`
 * 근사는 그걸 모른다 — P 그룹이 그 갈림을 잠근다.
 *
 * ## 이 파일이 잠그지 않는 것
 *
 * - **인라인 축** 컨테이너 크기 — `gridContainerIntrinsic.browser.test.ts` 소관.
 * - **암묵 열**(`grid-auto-flow:column` + `grid-auto-columns`)의 content 함수·순환 —
 *   grid.rs 가 첫 토큰의 px 만 읽는다. 별도 축.
 * - **음수 grid line**(`2 / -1`)과 `dense` 패킹 — 배치 축이라 별개.
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
): CaseNode => ({ label, style, children }) as CaseNode;

const ROOT = (children: number[]): CaseNode =>
  box("root", { display: "block", width: "400px", height: "600px" }, children);

/** 명시 폭 300 / 1열 그리드. 행 토큰과 자식만 바꿔 가며 블록 크기를 본다. */
function rowCase(
  name: string,
  container: StyleRecord,
  kids: StyleRecord[] = [{ width: "40px", height: "20px" }],
): ParityCase {
  return {
    name,
    availW: 400,
    availH: 600,
    nodes: [
      ...kids.map((s, i) => box(`k${i}`, s)),
      box(
        "grid",
        {
          display: "grid",
          gridTemplateColumns: ["100px"],
          width: "300px",
          ...container,
        },
        kids.map((_, i) => i),
      ),
      ROOT([kids.length]),
    ],
  };
}

// ── A. 트랙 extent 규칙 ──
const EXTENT_CASES: ParityCase[] = [
  rowCase("A1 행 트랙이 내용보다 큼 (30px 행 / 20px 자식)", {
    gridTemplateRows: ["30px"],
  }),
  rowCase(
    "A2 자식이 행을 넘침 — 컨테이너는 안 늘어난다",
    { gridTemplateRows: ["30px"] },
    [{ width: "40px", height: "100px" }],
  ),
  rowCase("A3 빈 트랙도 자리를 차지한다 (2행 / 자식 1개)", {
    gridTemplateRows: ["30px", "40px"],
  }),
  rowCase(
    "A4 rowGap 포함",
    { gridTemplateRows: ["30px", "40px"], rowGap: "8px" },
    [
      { width: "40px", height: "10px" },
      { width: "40px", height: "10px" },
    ],
  ),
  rowCase(
    "A5 padding 포함 (border-box 합산)",
    { gridTemplateRows: ["30px"], paddingTop: "5px", paddingBottom: "7px" },
    [{ width: "40px", height: "10px" }],
  ),
  rowCase(
    "A6 자식 margin 은 트랙을 늘리지 않는다",
    { gridTemplateRows: ["30px"] },
    [{ width: "40px", height: "10px", marginBottom: "50px" }],
  ),
  rowCase("A7 auto 행 — 내용 크기", { gridTemplateRows: ["auto"] }, [
    { width: "40px", height: "35px" },
  ]),
  rowCase("A8 height 명시가 트랙 합을 이긴다", {
    gridTemplateRows: ["30px"],
    height: "200px",
  }),
];

// ── B. 미결정 블록 축의 행 토큰 해소 ──
const INDEFINITE_ROW_CASES: ParityCase[] = [
  rowCase("B1 1fr 행 — 여유가 없으니 content", {
    gridTemplateRows: ["1fr"],
  }),
  rowCase("B2 50% 행 — auto 동형", { gridTemplateRows: ["50%"] }),
  rowCase("B3 minmax(auto, 60px) — §12.6 으로 상한까지", {
    gridTemplateRows: ["minmax(auto, 60px)"],
  }),
  rowCase("B4 minmax(auto, 10px) — 상한이 내용보다 작으면 그 상한", {
    gridTemplateRows: ["minmax(auto, 10px)"],
  }),
  rowCase("B5 min-content 행", { gridTemplateRows: ["min-content"] }),
  rowCase("B6 max-content 행", { gridTemplateRows: ["max-content"] }),
  rowCase(
    "B7 1fr 2행 — 각 행이 자기 내용",
    { gridTemplateRows: ["1fr", "1fr"] },
    [
      { width: "40px", height: "20px" },
      { width: "40px", height: "50px" },
    ],
  ),
];

// ── C. 암묵 행 ──
const IMPLICIT_ROW_CASES: ParityCase[] = [
  rowCase(
    "C1 명시 1행 + 자식 3개 — 암묵 행 2개 생성",
    { gridTemplateRows: ["30px"] },
    [
      { width: "40px", height: "20px" },
      { width: "40px", height: "20px" },
      { width: "40px", height: "20px" },
    ],
  ),
  rowCase(
    "C2 gridAutoRows 50px — 암묵 행이 그 크기",
    { gridAutoRows: ["50px"] },
    [
      { width: "40px", height: "20px" },
      { width: "40px", height: "20px" },
    ],
  ),
  rowCase("C3 gridAutoRows 2값 순환", { gridAutoRows: ["30px", "50px"] }, [
    { width: "40px", height: "20px" },
    { width: "40px", height: "20px" },
    { width: "40px", height: "20px" },
  ]),
  rowCase(
    "C4 명시 1행 + gridAutoRows — 암묵 행부터 순환",
    { gridTemplateRows: ["10px"], gridAutoRows: ["40px"] },
    [
      { width: "40px", height: "5px" },
      { width: "40px", height: "5px" },
    ],
  ),
  rowCase("C5 명시 트랙 없음 — 전부 암묵 auto", {}, [
    { width: "40px", height: "20px" },
    { width: "40px", height: "35px" },
  ]),
];

// ── D. 부모 종류별 (컨테이너 크기 판정 경로가 갈린다) ──
const PARENT_CASES: ParityCase[] = [
  {
    name: "D1 block 부모 / width·height auto",
    availW: 400,
    availH: 600,
    nodes: [
      box("k", { width: "40px", height: "20px" }),
      box(
        "grid",
        {
          display: "grid",
          gridTemplateColumns: ["100px"],
          gridTemplateRows: ["30px"],
        },
        [0],
      ),
      box("p", { display: "block", width: "300px" }, [1]),
      ROOT([2]),
    ],
  },
  {
    name: "D2 flex item / 행 트랙 > 내용",
    availW: 400,
    availH: 600,
    nodes: [
      box("k", { width: "40px", height: "20px" }),
      box(
        "grid",
        {
          display: "grid",
          gridTemplateColumns: ["100px"],
          gridTemplateRows: ["30px"],
        },
        [0],
      ),
      box(
        "p",
        { display: "flex", width: "300px", alignItems: "flex-start" },
        [1],
      ),
      ROOT([2]),
    ],
  },
  {
    name: "D3 grid item 인 grid",
    availW: 400,
    availH: 600,
    nodes: [
      box("k", { width: "40px", height: "20px" }),
      box(
        "inner",
        {
          display: "grid",
          gridTemplateColumns: ["100px"],
          gridTemplateRows: ["30px"],
          alignSelf: "start",
        },
        [0],
      ),
      box(
        "p",
        { display: "grid", gridTemplateColumns: ["200px"], width: "300px" },
        [1],
      ),
      ROOT([2]),
    ],
  },
];

// ── P. 자식 → 트랙 매핑이 실제 배치여야 한다 (CSS §8.5 커서) ──
const PLACEMENT_CASES: ParityCase[] = [
  {
    // definite column 이 커서보다 **왼쪽**이면 다음 행으로 내려간다. `i / col_count`
    // 근사는 둘 다 1행으로 보아 컨테이너를 절반으로 접었다 (DOM 400 / 근사 200).
    name: "P1 definite column 역순 — 커서가 다음 행으로",
    availW: 400,
    availH: 600,
    nodes: [
      box("right", {
        gridColumnStart: "2",
        gridColumnEnd: "3",
        height: "200px",
      }),
      box("left", {
        gridColumnStart: "1",
        gridColumnEnd: "2",
        height: "200px",
      }),
      box(
        "grid",
        {
          display: "grid",
          gridTemplateColumns: ["240px", "1fr"],
          width: "600px",
        },
        [0, 1],
      ),
      ROOT([2]),
    ],
  },
  {
    name: "P2 definite column 순방향 — 같은 행",
    availW: 400,
    availH: 600,
    nodes: [
      box("left", {
        gridColumnStart: "1",
        gridColumnEnd: "2",
        height: "200px",
      }),
      box("right", {
        gridColumnStart: "2",
        gridColumnEnd: "3",
        height: "200px",
      }),
      box(
        "grid",
        {
          display: "grid",
          gridTemplateColumns: ["240px", "1fr"],
          width: "600px",
        },
        [0, 1],
      ),
      ROOT([2]),
    ],
  },
  {
    name: "P3 gridRowStart 명시 — 그 행에 귀속",
    availW: 400,
    availH: 600,
    nodes: [
      box("a", { gridRowStart: "2", width: "40px", height: "60px" }),
      box("b", { gridRowStart: "1", width: "40px", height: "20px" }),
      box(
        "grid",
        {
          display: "grid",
          gridTemplateColumns: ["100px"],
          gridTemplateRows: ["auto", "auto"],
          width: "300px",
        },
        [0, 1],
      ),
      ROOT([2]),
    ],
  },
  {
    name: "P4 flow:column — 행은 명시 트랙 고정",
    availW: 400,
    availH: 600,
    nodes: [
      box("k0", { width: "40px", height: "20px" }),
      box("k1", { width: "40px", height: "20px" }),
      box("k2", { width: "40px", height: "20px" }),
      box(
        "grid",
        {
          display: "grid",
          gridAutoFlow: "column",
          gridTemplateRows: ["30px", "30px"],
          gridAutoColumns: ["100px"],
          width: "300px",
        },
        [0, 1, 2],
      ),
      ROOT([3]),
    ],
  },
];

const ALL = [
  ...EXTENT_CASES,
  ...INDEFINITE_ROW_CASES,
  ...IMPLICIT_ROW_CASES,
  ...PARENT_CASES,
  ...PLACEMENT_CASES,
];

describe("그리드 컨테이너 블록 크기 = 행 트랙 extent", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  describe("engine leg — 엔진 직접 호출", () => {
    it.each(ALL.map((c) => [c.name, c] as const))("%s", (_n, c) => {
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        engineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
  });

  // 빌더 실 진입점(`calculateFullTreeLayout`)에서도 같은 값이 나오는지 — 엔진만 고치고
  // TS 선계산이 되돌리는 상태를 막는다.
  describe("pipeline leg — 빌더 실 진입점", () => {
    it.each(
      [
        ...EXTENT_CASES.slice(0, 6),
        ...INDEFINITE_ROW_CASES.slice(0, 4),
        ...IMPLICIT_ROW_CASES,
        ...PLACEMENT_CASES,
      ].map((c) => [c.name, c] as const),
    )("%s", (_n, c) => {
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        pipelineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
  });

  /**
   * 잔존 — **자식이 없는** 그리드는 트랙을 세우지 않는다.
   *
   * `solve_node` 는 in-flow 자식이 없으면 leaf 로 조기 반환하므로 `solve_grid` 자체가
   * 돌지 않는다. CSS 는 자식이 없어도 명시 트랙만큼 자리를 차지한다. 본 규칙(트랙 extent)
   * 과 같은 방향의 미구현이지만 거처가 다르다(트랙 sizing 이 아니라 dispatch).
   */
  it("잔존 — 자식 0개 그리드의 트랙 extent (실측 스냅샷)", () => {
    const c: ParityCase = {
      name: "childless",
      availW: 400,
      availH: 600,
      nodes: [
        box(
          "grid",
          {
            display: "grid",
            gridTemplateRows: ["30px", "40px"],
            gridTemplateColumns: ["100px"],
            width: "300px",
          },
          [],
        ),
        ROOT([0]),
      ],
    };
    const dom = domLeg(c.nodes, c.availW);
    const eng = engineLeg(c.nodes, c.availW, c.availH);
    expect(dom[0].h).toBe(70); // CSS: 트랙 30+40
    expect(eng[0].h).toBe(0); // 엔진: leaf 조기 반환 → 트랙 미해소
  });
});
