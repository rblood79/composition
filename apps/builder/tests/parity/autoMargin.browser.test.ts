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
 * `margin: auto` — 정렬보다 **먼저** 여유를 가져간다 (CSS-FLEXBOX-1 §8.1)
 *
 * 세 규칙이 한 묶음이라 함께 잠근다:
 * - §9.6 step 13 — cross auto margin 이 **라인** cross 여유를 균등 흡수 (음수 여유면 0).
 * - §9.6 step 14 — cross margin 중 하나라도 auto 면 `align-self` 무효.
 * - §9.4 step 11 — `stretch` 는 cross margin 이 **둘 다 auto 가 아닐 때만** 적용.
 *
 * 흡수 단위가 **라인**이라는 점이 핵심이다. 구 구현은 tree.rs 후처리로 main 축만,
 * 그것도 단일 라인 근사로 처리해서 (a) cross 축은 통째로 미구현, (b) wrap 컨테이너는
 * main 축 흡수조차 일어나지 않았다. 실측(2026-07-27): `align-items` 기본값에서
 * `marginTop:auto` 아이템이 y=0 (DOM 160), wrap 2줄에서 `marginLeft:auto` 가 x=100
 * (DOM 150).
 *
 * reverse 축(row-reverse / wrap-reverse)의 margin start/end 역할은 **별개 결함**이라
 * `reverseMargin.browser.test.ts` 가 담당한다 — 고정 margin 에서도 재현되므로
 * auto margin 계약과 섞지 않는다.
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
): CaseNode => ({ label, style, children }) as CaseNode;

/** kids → flex 컨테이너 → root 3층 케이스. */
function flexCase(
  name: string,
  container: StyleRecord,
  kids: StyleRecord[],
): ParityCase {
  return {
    name,
    availW: 400,
    availH: 600,
    nodes: [
      ...kids.map((s, i) => box(`c${i}`, s)),
      box(
        "flex",
        { display: "flex", flexWrap: "nowrap", ...container },
        kids.map((_, i) => i),
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [
        kids.length,
      ]),
    ],
  };
}

const ROW: StyleRecord = {
  flexDirection: "row",
  width: "300px",
  height: "200px",
};
const KID: StyleRecord = { width: "40px", height: "40px" };

const CASES: ParityCase[] = [];

// ── cross 축 흡수 × align-items 4종 (§9.6 step 13/14, §9.4 step 11) ──
// align-items 가 무엇이든 auto margin 이 이긴다. stretch 는 크기까지 억제된다.
for (const [tag, m] of [
  ["start-auto", { marginTop: "auto" }],
  ["end-auto", { marginBottom: "auto" }],
  ["both-auto", { marginTop: "auto", marginBottom: "auto" }],
] as Array<[string, StyleRecord]>) {
  for (const ai of ["flex-start", "center", "flex-end", "stretch"]) {
    CASES.push(
      flexCase(
        `row cross ${tag} / align-items:${ai}`,
        { ...ROW, alignItems: ai },
        [{ ...KID, ...m }, KID],
      ),
    );
  }
}

// ── column 컨테이너의 cross(=가로) 축 ──
for (const [tag, m] of [
  ["left-auto", { marginLeft: "auto" }],
  ["right-auto", { marginRight: "auto" }],
  ["both-auto", { marginLeft: "auto", marginRight: "auto" }],
] as Array<[string, StyleRecord]>) {
  CASES.push(
    flexCase(
      `column cross ${tag}`,
      {
        flexDirection: "column",
        alignItems: "flex-start",
        width: "300px",
        height: "200px",
      },
      [{ ...KID, ...m }, KID],
    ),
  );
}

// ── stretch 억제 — cross size auto + cross auto margin 이면 내용 크기 유지 ──
CASES.push(
  flexCase(
    "stretch 억제 / height auto + marginTop auto",
    { ...ROW, alignItems: "stretch" },
    [{ width: "40px", marginTop: "auto" }],
  ),
  flexCase("align-self:stretch 명시 + cross auto margin", ROW, [
    { ...KID, alignSelf: "stretch", marginTop: "auto" },
  ]),
  flexCase("align-self:center 명시 + cross auto margin", ROW, [
    { ...KID, alignSelf: "center", marginBottom: "auto" },
  ]),
);

// ── main 축 흡수는 justify-content 를 무효화한다 (§8.1) ──
for (const jc of [
  "flex-start",
  "center",
  "flex-end",
  "space-between",
  "space-around",
]) {
  CASES.push(
    flexCase(
      `main auto / justify-content:${jc}`,
      { ...ROW, height: "60px", justifyContent: jc },
      [{ ...KID, marginLeft: "auto" }, KID],
    ),
  );
}

// ── 흡수 단위가 라인이라는 계약 (multi-line) ──
CASES.push(
  {
    name: "wrap 2줄 / 둘째 아이템 marginLeft auto (라인별 여유)",
    availW: 400,
    availH: 600,
    nodes: [
      box("c0", { width: "100px", height: "40px" }),
      box("c1", { width: "100px", height: "40px", marginLeft: "auto" }),
      box("c2", { width: "100px", height: "40px" }),
      box(
        "flex",
        {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          width: "250px",
          height: "200px",
        },
        [0, 1, 2],
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [3]),
    ],
  },
  {
    name: "wrap 2줄 / 첫 줄 아이템 marginTop auto (라인 cross 기준)",
    availW: 400,
    availH: 600,
    nodes: [
      box("c0", { width: "100px", height: "40px", marginTop: "auto" }),
      box("c1", { width: "100px", height: "80px" }),
      box("c2", { width: "100px", height: "40px" }),
      box(
        "flex",
        {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          alignContent: "flex-start",
          width: "250px",
          height: "300px",
        },
        [0, 1, 2],
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [3]),
    ],
  },
);

// ── 여유가 없거나 미결정이면 흡수 없음 ──
CASES.push(
  flexCase(
    "음수 여유 / cross auto margin (흡수 0)",
    { ...ROW, height: "100px" },
    [{ width: "40px", height: "300px", marginTop: "auto" }],
  ),
  flexCase("flexGrow 가 여유를 먼저 먹음 / main auto (흡수 0)", ROW, [
    { height: "40px", flexGrow: 1, marginLeft: "auto" },
    KID,
  ]),
  {
    name: "컨테이너 height:auto column / main auto (여유 개념 없음)",
    availW: 400,
    availH: 600,
    nodes: [
      box("c0", { ...KID, marginTop: "auto" }),
      box("c1", KID),
      box(
        "flex",
        {
          display: "flex",
          flexDirection: "column",
          flexWrap: "nowrap",
          width: "300px",
        },
        [0, 1],
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [2]),
    ],
  },
  {
    name: "컨테이너 height:auto row / cross auto (라인 cross = 자식 max)",
    availW: 400,
    availH: 600,
    nodes: [
      box("c0", { ...KID, marginTop: "auto" }),
      box("c1", { width: "40px", height: "90px" }),
      box(
        "flex",
        {
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          alignItems: "flex-start",
          width: "300px",
        },
        [0, 1],
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [2]),
    ],
  },
);

// ── 고정 margin 과 혼합 / 다중 auto 균등 분배 ──
CASES.push(
  flexCase("cross: marginTop 10px + marginBottom auto", ROW, [
    { ...KID, marginTop: "10px", marginBottom: "auto" },
  ]),
  flexCase("cross: marginTop auto + marginBottom 30px", ROW, [
    { ...KID, marginTop: "auto", marginBottom: "30px" },
  ]),
  flexCase("main: marginLeft auto + marginRight 20px", ROW, [
    { ...KID, marginLeft: "auto", marginRight: "20px" },
  ]),
  flexCase("main: 양쪽 auto → 중앙", ROW, [
    { ...KID, marginLeft: "auto", marginRight: "auto" },
  ]),
  flexCase("두 아이템 각각 marginLeft auto (균등 분배)", ROW, [
    { ...KID, marginLeft: "auto" },
    { ...KID, marginLeft: "auto" },
  ]),
  flexCase("두 아이템 각각 cross 양쪽 auto", ROW, [
    { ...KID, marginTop: "auto", marginBottom: "auto" },
    { width: "40px", height: "80px", marginTop: "auto", marginBottom: "auto" },
  ]),
);

// ── 컨테이너 padding/gap 이 있는 경우 (여유는 content-box 기준) ──
CASES.push(
  flexCase(
    "padding+gap / main auto",
    {
      ...ROW,
      paddingTop: "10px",
      paddingRight: "20px",
      paddingBottom: "10px",
      paddingLeft: "20px",
      columnGap: "8px",
    },
    [KID, { ...KID, marginLeft: "auto" }],
  ),
  flexCase(
    "비대칭 padding / cross auto",
    {
      ...ROW,
      paddingTop: "10px",
      paddingRight: "20px",
      paddingBottom: "30px",
      paddingLeft: "20px",
    },
    [{ ...KID, marginTop: "auto" }],
  ),
);

// ── auto margin 아이템이 그 자신 flex 컨테이너 (중첩 전파) ──
CASES.push({
  name: "중첩 — auto margin 아이템이 flex 컨테이너",
  availW: 400,
  availH: 600,
  nodes: [
    box("leaf", { width: "30px", height: "30px" }),
    box(
      "c0",
      {
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        width: "60px",
        height: "60px",
        marginTop: "auto",
        marginLeft: "auto",
      },
      [0],
    ),
    box(
      "flex",
      {
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        width: "300px",
        height: "200px",
      },
      [1],
    ),
    box("root", { display: "block", width: "400px", height: "600px" }, [2]),
  ],
});

// ── block 자식의 세로 auto margin 은 CSS 가 0 (§10.6.3) — 흡수 대상 아님 ──
CASES.push({
  name: "block 자식 세로 auto margin (CSS 는 0)",
  availW: 400,
  availH: 600,
  nodes: [
    box("c0", {
      width: "80px",
      height: "40px",
      marginTop: "auto",
      marginBottom: "auto",
    }),
    box("mid", { display: "block", width: "300px", height: "200px" }, [0]),
    box("root", { display: "block", width: "400px", height: "600px" }, [1]),
  ],
});

describe("auto margin — CSS 대조", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(CASES.map((c) => [c.name, c] as const))(
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

  it.each(CASES.map((c) => [c.name, c] as const))(
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

  /**
   * grid item 의 auto margin — **해소됨** (2026-07-28).
   *
   * 이 케이스는 원래 "grid 는 §8.1 흡수를 타지 않는다" 는 잔존 스냅샷이었고, 그때도
   * **선행 결함에 가려져** 있었다 — 명시 width 를 가진 grid item 이 트랙 폭으로
   * stretch 되는 문제(40 → 150)가 먼저 걸려서 auto margin 만 고쳐도 좌표가 맞지
   * 않았다. 선행 결함(grid item 박스 모델)을 닫으면서 함께 정합해졌다.
   * 상세 계약은 `gridItemBox.browser.test.ts` — 여기서는 flex ↔ grid 두 축이 같은
   * §8.1 규칙을 따른다는 **교차 확인**만 남긴다.
   */
  it("grid item auto margin — flex 와 같은 §8.1 규칙", () => {
    const c: ParityCase = {
      name: "grid item auto margin",
      availW: 400,
      availH: 600,
      nodes: [
        box("c0", { ...KID, marginLeft: "auto", marginTop: "auto" }),
        box("c1", KID),
        box(
          "grid",
          {
            display: "grid",
            gridTemplateColumns: ["150px", "150px"],
            gridTemplateRows: ["100px"],
            width: "300px",
            height: "100px",
          },
          [0, 1],
        ),
        box("root", { display: "block", width: "400px", height: "600px" }, [2]),
      ],
    };
    const dom = domLeg(c.nodes, c.availW);
    const bad = diffCase(c.nodes, dom, engineLeg(c.nodes, c.availW, c.availH));
    expect(bad, bad.join("\n")).toEqual([]);
    // CSS: 명시 width 40 유지 + auto margin 이 영역 여유를 흡수 → 우하단 정렬.
    expect(dom[0].w).toBe(40);
    expect(dom[0].x).toBe(110);
    expect(dom[0].y).toBe(60);
  });
});
