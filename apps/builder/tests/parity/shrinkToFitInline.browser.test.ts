import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  diffCase,
  domLeg,
  engineLeg,
  type CaseNode,
  type ParityCase,
  type StyleRecord,
} from "./harness";

/**
 * **shrink-to-fit 인라인 축** — 확정 뒤 재-solve + 암묵 열 (2026-07-28)
 *
 * 두 결함이 같은 자리에 있었다. 하나는 확정 **뒤**를 안 돌던 것(아래 §1), 다른 하나는
 * 확정 자체를 못 하던 것(§2 — 명시 열이 없는 grid 가 미결정 센티넬을 폭으로 보고).
 *
 * ## §1. 확정 뒤 자식 재-solve (CSS-SIZING-3 §5.1)
 *
 * 인라인 available 이 미결정이면 컨테이너 크기가 자식으로부터 나온다. 그 pass 에서 자식의
 * `%` 는 참조할 확정 크기가 없어 `auto` 로 풀리고, auto 폭 블록 자식은 stretch 대신
 * fit-content 가 된다 — **intrinsic 기여를 구하는 동안만** 맞는 해석이다. CSS 는 크기가
 * 정해진 뒤 그 크기를 containing block 으로 삼아 자식을 정상 배치한다.
 *
 * 구 엔진은 1차 pass 에서 멈춰 있었다. 실측 발산(box 폭 120 확정):
 *
 * | 자식                | Chrome        | 구 엔진      |
 * | ------------------- | ------------- | ------------ |
 * | `width:50%`         | 60            | **120**      |
 * | `width:150%`        | 180 (넘침)    | **120**      |
 * | `marginLeft:10%`    | x=147 / w=108 | x=135 / 120  |
 * | auto 폭 짧은 형제   | 120 (stretch) | **40**       |
 *
 * **컨테이너 상자는 1차 pass 값을 유지한다** — intrinsic 크기는 `%` 를 `auto` 로 본 값이고,
 * 재해소로 자식이 더 커지면 CSS 도 넘치게 둔다.
 *
 * 진입 경로는 두 갈래다. block/flex 는 **상속 available 이 미결정**(부모의 non-stretch
 * `align-items` — Container Align), grid 는 `inline_intrinsic`(거기에 `width: max-content`
 * 같은 키워드까지 포함).
 */

const AVAIL_W = 390;

/** root(column flex + align-items) > box > 자식 — box 가 shrink-to-fit 이 된다. */
function wrap(
  name: string,
  boxStyle: StyleRecord,
  inner: CaseNode[],
  align = "center",
): ParityCase {
  const n = inner.length;
  return {
    name,
    availW: AVAIL_W,
    availH: -1,
    nodes: [
      ...inner,
      { label: "box", style: boxStyle, children: inner.map((_, i) => i) },
      {
        label: "root",
        style: {
          display: "flex",
          flexDirection: "column",
          width: `${AVAIL_W}px`,
          alignItems: align,
        },
        children: [n],
      },
    ],
  };
}

/** 측정 스칼라를 직접 받는 leaf — DOM leg 은 같은 폭의 inline-block 원자로 맞춘다. */
const atom = (w: number, style: StyleRecord = {}): CaseNode => ({
  label: "a",
  style: { height: "20px", contentMinWidth: w, contentMaxWidth: w, ...style },
  domAtoms: [w],
});

const PAD10: StyleRecord = {
  paddingTop: "10px",
  paddingRight: "10px",
  paddingBottom: "10px",
  paddingLeft: "10px",
};

const BOXES: Record<string, StyleRecord> = {
  block: { display: "block" },
  "flex-row": { display: "flex", flexDirection: "row" },
  "flex-col": { display: "flex", flexDirection: "column" },
  grid: { display: "grid", gridTemplateColumns: ["auto"] },
};

function check(c: ParityCase) {
  expect(
    diffCase(
      c.nodes,
      domLeg(c.nodes, c.availW),
      engineLeg(c.nodes, c.availW, c.availH),
    ),
  ).toEqual([]);
}

describe("shrink-to-fit 확정 뒤 `%` 재해소", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  for (const [bname, bstyle] of Object.entries(BOXES)) {
    describe(`box = ${bname}`, () => {
      const CASES: ParityCase[] = [
        // `%` 폭 — 확정 폭(120)의 비율. 150% 는 넘치고 상자는 그대로다.
        wrap(`단독 width:50%`, bstyle, [atom(120, { width: "50%" })]),
        wrap(`단독 width:100%`, bstyle, [atom(120, { width: "100%" })]),
        wrap(`단독 width:150% (넘침)`, bstyle, [atom(120, { width: "150%" })]),
        // 형제가 상자 폭을 정하고, `%` 자식이 그 폭을 기준으로 풀린다.
        wrap(`앵커 + width:50% 형제`, bstyle, [
          atom(120),
          atom(40, { width: "50%" }),
        ]),
        // `%` 없이도 달라진다 — auto 폭 자식은 확정 뒤 stretch 다.
        wrap(`앵커 + auto 폭 짧은 형제`, bstyle, [atom(120), atom(40)]),
        // `%` padding/margin 도 같은 기준으로 풀린다 (CSS: 둘 다 인라인 축 기준).
        //
        // flex-row 의 padding 은 **선행 결함에 가려져 있다** — 측정 스칼라 leaf 가
        // border-box 를 반환하는데 main 축 content 슬롯은 content-box 를 기대한다
        // (아래 [잔존]). `%` 든 px 든 같은 값이라 여기서 확인할 수 있는 것이 없다.
        ...(bname === "flex-row"
          ? []
          : [
              wrap(`자식 paddingLeft:10%`, bstyle, [
                atom(120, { paddingLeft: "10%" }),
              ]),
            ]),
        wrap(`자식 marginLeft:10%`, bstyle, [atom(120, { marginLeft: "10%" })]),
        // 컨테이너 자신의 padding — 상자는 border-box, `%` 기준은 content box.
        wrap(`box padding + width:50% 자식`, { ...bstyle, ...PAD10 }, [
          atom(120, { width: "50%" }),
        ]),
        // align-items 를 바꿔도 같다 (shrink-to-fit 신호는 non-stretch 전부).
        wrap(
          `flex-start + width:50%`,
          bstyle,
          [atom(120, { width: "50%" })],
          "flex-start",
        ),
        // 대조군 — stretch 는 available 이 확정이라 종전 경로 그대로.
        wrap(
          `[대조] stretch + width:50%`,
          bstyle,
          [atom(120, { width: "50%" })],
          "stretch",
        ),
      ];
      for (const c of CASES) {
        it(c.name, () => check(c));
      }
    });
  }

  describe("중첩 — 확정 폭이 손자까지 내려간다", () => {
    it("box > mid(auto 폭) > width:50%", () => {
      check({
        name: "nested",
        availW: AVAIL_W,
        availH: -1,
        nodes: [
          atom(120, { width: "50%" }),
          { label: "mid", style: { display: "block" }, children: [0] },
          { label: "box", style: { display: "block" }, children: [1] },
          {
            label: "root",
            style: {
              display: "flex",
              flexDirection: "column",
              width: `${AVAIL_W}px`,
              alignItems: "center",
            },
            children: [2],
          },
        ],
      });
    });
  });

  describe("grid — 키워드 폭도 같은 경로", () => {
    // 상속 available 은 definite(390) 인데 `width: max-content` 라 shrink-to-fit 이다.
    // block/flex 의 "상속 available 미결정" 게이트로는 안 잡혀 `inline_intrinsic` 을 쓴다.
    it("width:max-content 그리드의 자식 `%`", () => {
      check({
        name: "grid max-content",
        availW: AVAIL_W,
        availH: -1,
        nodes: [
          atom(120, { width: "50%" }),
          {
            label: "box",
            style: {
              display: "grid",
              gridTemplateColumns: ["auto"],
              width: "max-content",
            },
            children: [0],
          },
          {
            label: "root",
            style: { display: "block", width: `${AVAIL_W}px` },
            children: [1],
          },
        ],
      });
    });

    it("트랙은 얼린다 — `1fr 1fr` / min-content 는 재분배하지 않는다", () => {
      // 재진입이 트랙을 원본 토큰으로 다시 세우면 `fr` 이 확정 폭을 나눠 가져 35·35 가
      // 된다. CSS 는 intrinsic pass 의 결과(40·30)를 그대로 쓴다 — 트랙 freeze 의 근거.
      const nodes: CaseNode[] = [
        atom(40),
        atom(30),
        {
          label: "box",
          style: {
            display: "grid",
            gridTemplateColumns: ["1fr", "1fr"],
            width: "min-content",
          },
          children: [0, 1],
        },
        {
          label: "root",
          style: { display: "block", width: `${AVAIL_W}px` },
          children: [2],
        },
      ];
      const dom = domLeg(nodes, AVAIL_W);
      const eng = engineLeg(nodes, AVAIL_W, -1);
      expect(Math.round(eng[0].w)).toBe(Math.round(dom[0].w)); // 40
      expect(Math.round(eng[1].x)).toBe(Math.round(dom[1].x)); // 40 (35 아님)
    });
  });

  describe("§2. 명시 열 없는 grid — 암묵 열", () => {
    // `grid-template-columns` 미지정이면 auto-placement 가 암묵 열을 만들고 그 크기는
    // `grid-auto-columns`(기본 `auto`)가 정한다. 종전엔 intrinsic 경로가 "명시 토큰 없음"
    // 으로 그냥 빠져나가 컨테이너 폭이 **미결정 센티넬(-1)** 그대로 보고됐다.
    const gridCase = (
      name: string,
      boxStyle: StyleRecord,
      kids: CaseNode[],
    ): ParityCase => wrap(name, { display: "grid", ...boxStyle }, kids);

    const CASES: ParityCase[] = [
      gridCase("자식 1", {}, [atom(120)]),
      gridCase("자식 2 — 암묵 행으로 쌓인다", {}, [atom(120), atom(60)]),
      gridCase("rowGap", { rowGap: "8px" }, [atom(120), atom(60)]),
      gridCase(
        "gridAutoColumns 로 열 크기 지정",
        { gridAutoColumns: ["40px"] },
        [atom(120)],
      ),
      gridCase("자식 `%` 도 확정 열 기준으로 풀린다", {}, [
        atom(120, { width: "50%" }),
      ]),
    ];
    for (const c of CASES) {
      it(c.name, () => check(c));
    }

    it("[잔존] flow:column 은 행 extent 를 못 세운다", () => {
      // 열은 맞고(자식 x/w 정합) 컨테이너 **높이**만 0 이다. 암묵 **행** 생성은 row-flow
      // 전용이라 col-flow 에는 행 트랙이 서지 않는다 — 별개 축(grid.rs 의 flow 확장).
      const c = gridCase("flow column", { gridAutoFlow: "column" }, [
        atom(120),
        atom(60),
      ]);
      const dom = domLeg(c.nodes, c.availW);
      const eng = engineLeg(c.nodes, c.availW, c.availH);
      const bi = c.nodes.findIndex((n) => n.label === "box");
      expect(Math.round(eng[bi].w)).toBe(Math.round(dom[bi].w)); // 180
      expect(Math.round(eng[1].x)).toBe(Math.round(dom[1].x)); // 두 번째 열 위치
      expect(Math.round(dom[bi].h)).toBe(20);
      expect(Math.round(eng[bi].h)).toBe(0); // 행 트랙 미생성
    });
  });

  describe("[잔존] 측정 스칼라 leaf 의 padding 이중 계산", () => {
    // leaf 의 `resolve_leaf_intrinsic_width` 는 border-box 를 반환하는데, 부모 커널의
    // content 슬롯은 content-box 를 기대한다(`flex.rs::border_main` 이 pad_border 를 더한다).
    // shrink-to-fit 과 무관한 **선행 결함** — 부모가 definite 여도 같은 값이 나온다.
    it("definite 부모에서도 재현된다 (본 변경과 무관)", () => {
      const mk = (boxStyle: StyleRecord): CaseNode[] => [
        atom(120, { paddingLeft: "12px" }),
        { label: "box", style: boxStyle, children: [0] },
        {
          label: "root",
          style: { display: "block", width: `${AVAIL_W}px` },
          children: [1],
        },
      ];
      const definite = mk({
        display: "flex",
        flexDirection: "row",
        width: "120px",
      });
      const dom = domLeg(definite, AVAIL_W);
      const eng = engineLeg(definite, AVAIL_W, -1);
      expect(Math.round(dom[0].w)).toBe(132); // content 120 + padding 12
      expect(Math.round(eng[0].w)).toBe(144); // padding 이 두 번 더해진다
    });
  });
});
