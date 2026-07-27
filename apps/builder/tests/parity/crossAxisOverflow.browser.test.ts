import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  diffCase,
  domLeg,
  engineLeg,
  pipelineLeg,
  type CaseNode,
  type ParityCase,
} from "./harness";

/**
 * flex 교차축 — **내용이 컨테이너 cross 를 넘길 때** (CSS-FLEXBOX §9.4 step 8 + §8.3)
 *
 * `flexSweep` 는 이 영역을 오래 비켜가 있었다 (definite cross 를 줄 합보다 크게 잡음) —
 * 그래서 "라인 cross 가 컨테이너 cross 를 넘는" 형태가 한 번도 안 걸렸고, 정렬 결함 3건이
 * 그 사각지대에 있었다. 2026-07-27 에 sweep 도 음수 free space 조합을 훑도록 확장했다.
 *
 * **두 파일의 역할 분담**: sweep 은 파라미터 격자를 넓게(1152 조합), 이 파일은 각 규칙의
 * **기대 좌표를 명시적으로** 잠근다 (Chrome 실측값이 케이스 이름·주석에 박혀 있어 회귀 시
 * "무엇이 몇으로 바뀌었나" 가 바로 읽힌다). sweep 은 "어딘가 틀렸다"를, 여기는 "무엇이
 * 틀렸다"를 알려준다.
 *
 * §9.4 step 8 은 **대입**이다 — "If the flex container is single-line and has a definite
 * cross size, the outer cross size of the flex line **is** the flex container's inner cross
 * size". 라인이 컨테이너보다 커도 라인 cross 는 컨테이너 cross 이고, 넘치는 아이템은 그
 * 라인 밖으로 흘러넘친다. 라인을 아이템에 맞춰 키우면 `align-items:stretch` 가 그 커진
 * 라인을 채우게 되어 **auto-cross 아이템이 내용까지 자란다** (CSS 는 컨테이너에서 자름).
 *
 * 프리셋 row 레이아웃에서 실제로 닿는 형태다 — 확정 높이 밴드 안의 auto-height 자식.
 */

/** root(block, 확정) > container(flex, 확정 cross) > item(cross auto) > 내용(고정 cross) */
function overflowCase(
  name: string,
  dir: "row" | "column",
  alignItems: string,
  contentCross: number,
  containerCross: string,
): ParityCase {
  const isRow = dir === "row";
  const crossProp = isRow ? "height" : "width";
  const mainProp = isRow ? "width" : "height";

  const nodes: CaseNode[] = [
    {
      label: "content",
      style: {
        width: "50px",
        height: "40px",
        [crossProp]: `${contentCross}px`,
      },
    },
    { label: "item", style: { [mainProp]: "80px" }, children: [0] },
    {
      label: "container",
      style: {
        display: "flex",
        flexDirection: dir,
        flexWrap: "nowrap",
        alignItems,
        [mainProp]: isRow ? "300px" : "200px",
        [crossProp]: containerCross,
      },
      children: [1],
    },
    {
      label: "root",
      style: { display: "block", width: "400px", height: "500px" },
      children: [2],
    },
  ];

  return { name, availW: 400, availH: 500, nodes };
}

const CASES: ParityCase[] = [
  // ── row: cross = height ──
  overflowCase("row/stretch 내용<컨테이너", "row", "stretch", 50, "100px"),
  overflowCase("row/stretch 내용>컨테이너", "row", "stretch", 300, "100px"),
  overflowCase(
    "row/flex-start 내용>컨테이너",
    "row",
    "flex-start",
    300,
    "100px",
  ),
  overflowCase("row/center 내용>컨테이너", "row", "center", 300, "100px"),
  overflowCase("row/flex-end 내용>컨테이너", "row", "flex-end", 300, "100px"),
  overflowCase("row/center 내용<컨테이너", "row", "center", 40, "100px"),
  overflowCase("row/flex-end 내용<컨테이너", "row", "flex-end", 40, "100px"),
  overflowCase("row/stretch 컨테이너 auto", "row", "stretch", 300, "auto"),
  // ── column: cross = width ──
  overflowCase(
    "column/stretch 내용<컨테이너",
    "column",
    "stretch",
    60,
    "150px",
  ),
  overflowCase(
    "column/stretch 내용>컨테이너",
    "column",
    "stretch",
    300,
    "150px",
  ),
  overflowCase(
    "column/flex-start 내용>컨테이너",
    "column",
    "flex-start",
    300,
    "150px",
  ),
  overflowCase("column/center 내용>컨테이너", "column", "center", 300, "150px"),
  overflowCase(
    "column/flex-end 내용>컨테이너",
    "column",
    "flex-end",
    300,
    "150px",
  ),
];

/**
 * main 축 overflow — `justify-content` (CSS-ALIGN-3 §4.2 / §4.4)
 *
 * 교차축과 같은 규칙이되 **분배 정렬은 다르다**: 여유가 음수면 `space-*` 는 fallback 으로
 * 떨어져 start 처럼 배치된다. Chrome 실측(컨테이너 100 / 아이템 300) — center −100,
 * flex-end −200, space-between·around·evenly 는 셋 다 0. 즉 분배값의 0 클램프는 결함이
 * 아니라 정답이라, 두 계열을 같은 값으로 처리하면 반대쪽이 깨진다. 여기서 그 경계를 잠근다.
 */
function mainOverflowCase(justify: string): ParityCase {
  return {
    name: `row/justify-${justify} 아이템>컨테이너`,
    availW: 400,
    availH: 500,
    nodes: [
      {
        label: "item",
        // flexShrink:0 — 줄어들면 넘침 자체가 사라져 케이스가 무의미해진다.
        style: { width: "300px", height: "40px", flexShrink: 0 },
      },
      {
        label: "container",
        style: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          justifyContent: justify,
          width: "100px",
          height: "200px",
        },
        children: [0],
      },
      {
        label: "root",
        style: { display: "block", width: "400px", height: "500px" },
        children: [1],
      },
    ],
  };
}

const MAIN_CASES: ParityCase[] = [
  "flex-start",
  "center",
  "flex-end",
  "space-between",
  "space-around",
  "space-evenly",
].map(mainOverflowCase);

/**
 * 라인 간 배치 overflow — `align-content` (multi-line wrap)
 *
 * 줄 합이 컨테이너 cross 를 넘길 때. `justify-content` 와 같은 갈림 — 위치 정렬은 음수
 * offset, 분배·stretch 는 fallback. `flexSweep` 가 "definite cross 를 줄 합보다 크게"
 * 잡아 비켜 간 바로 그 영역이라 여기서만 검증된다.
 */
function alignContentOverflowCase(alignContent: string): ParityCase {
  const child = (i: number): CaseNode => ({
    label: `line${i}`,
    style: { width: "80px", height: "50px", flexShrink: 0 },
  });
  return {
    name: `wrap/align-content-${alignContent} 줄합>컨테이너`,
    availW: 400,
    availH: 500,
    nodes: [
      child(0),
      child(1),
      {
        label: "container",
        style: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-start",
          alignContent,
          width: "100px", // 80 짜리 둘 → 2 라인
          height: "60px", // 줄 합 100 > 60 → 음수 여유
        },
        children: [0, 1],
      },
      {
        label: "root",
        style: { display: "block", width: "400px", height: "500px" },
        children: [2],
      },
    ],
  };
}

const ALIGN_CONTENT_CASES: ParityCase[] = [
  "flex-start",
  "center",
  "flex-end",
  "stretch",
  "space-between",
  "space-around",
].map(alignContentOverflowCase);

/**
 * main 축 크기가 **미결정**일 때 — `flex-direction:column` + `height:auto`
 *
 * 여유 공간은 definite main size 에서만 산출된다 (CSS §9.7). 컨테이너가 내용으로 축소되는
 * 형태에서는 여유가 없으므로 `justify-content` 6종 전부 **no-op** 이고 컨테이너 높이는
 * 내용 합 그대로다. 위 MAIN_CASES(확정 100 안에 300)와 짝을 이룬다 — 그쪽은 "여유가
 * 음수", 이쪽은 "여유라는 개념이 없음" 이라 규칙이 다르다.
 *
 * **Why (2026-07-27, ListBoxItem origin)**: 엔진은 미결정 main 을 **음수 센티넬**로 받는데
 * 위치 정렬이 그걸 실제 여유로 오해해 `센티넬 - 내용합` 의 절반만큼 자식을 컨테이너
 * **위로** 밀어냈다. catalog `containerStyles.justifyContent:center` 를 가진 ListBoxItem
 * 마스터에서 아이콘/라벨/설명이 행 위로 삐져나가고 auto height 가 84 → 45.5 로 줄었다.
 */
function indefiniteMainCase(justify: string): ParityCase {
  const row = (i: number): CaseNode => ({
    label: `row${i}`,
    style: { height: "24px", width: "100%", flexShrink: 0 },
  });
  return {
    name: `column/height-auto justify-${justify}`,
    availW: 400,
    availH: 500,
    nodes: [
      row(0),
      row(1),
      row(2),
      {
        label: "container",
        style: {
          display: "flex",
          flexDirection: "column",
          flexWrap: "nowrap",
          alignItems: "flex-start",
          justifyContent: justify,
          rowGap: "2px",
          columnGap: "2px",
          paddingTop: "4px",
          paddingBottom: "4px",
          paddingLeft: "12px",
          paddingRight: "12px",
          width: "390px",
          // height 미지정 = auto → main(세로) 축 미결정
        },
        children: [0, 1, 2],
      },
      {
        label: "root",
        style: { display: "block", width: "400px", height: "500px" },
        children: [3],
      },
    ],
  };
}

const INDEFINITE_MAIN_CASES: ParityCase[] = [
  "flex-start",
  "center",
  "flex-end",
  "space-between",
  "space-around",
  "space-evenly",
].map(indefiniteMainCase);

const ALL_CASES = [
  ...CASES,
  ...MAIN_CASES,
  ...ALIGN_CONTENT_CASES,
  ...INDEFINITE_MAIN_CASES,
];

describe("flex 교차축 overflow — CSS 대조", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(ALL_CASES.map((c) => [c.name, c] as const))(
    "engine leg — %s",
    (_name, c) => {
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        engineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    },
  );

  it.each(ALL_CASES.map((c) => [c.name, c] as const))(
    "pipeline leg — %s",
    (_name, c) => {
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        pipelineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    },
  );
});
