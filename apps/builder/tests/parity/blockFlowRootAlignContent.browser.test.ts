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
 * `display: flow-root` 의 BFC · block 컨테이너의 `align-content` (Taffy 대조 ⑧, 2026-09-07)
 *
 * - CSS-DISPLAY-3 §2.1: `flow-root` 는 새 block formatting context 를 만든다 → 자기 in-flow
 *   자식과의 margin collapse 를 막고 (CSS 2.1 §8.3.1) 자식 margin 이 자기 높이에 든다.
 *   `display.rs` 는 `flow-root` 를 파싱하지만 `node_establishes_bfc` / `solve_block` 의
 *   `creates_bfc` 가 scroll container 와 flex/grid 만 봤다 (B8 — Chrome fr h 50 / 엔진 10).
 *   `inline-block` (outer inline + inner flow-root) 도 같은 BFC 다.
 * - CSS-ALIGN-3 §6.1 (Chrome 123+): block 컨테이너의 `align-content` 는 in-flow 내용 묶음을
 *   여유 공간 (content box − 내용 높이) 에 정렬한다. `solve_block` 에 0건 (B5 — Chrome child y
 *   75 / 엔진 0).
 *
 * 대조군: overflow:hidden (기존 BFC 경로) · 일반 block wrapper (margin 탈출 유지) ·
 * height auto (여유 공간 없음) · abs 자식 (정렬 대상 아님).
 */

const n = (label: string, style: StyleRecord, children?: number[]): CaseNode =>
  ({ label, style, children }) as CaseNode;

const root = (children: number[], extra: StyleRecord = {}): CaseNode =>
  n("root", { width: "400px", ...extra }, children);

// ── flow-root BFC ──
const FLOW_ROOT: ParityCase[] = [
  {
    name: "B8 flow-root > child mt40 h10 · sib h10 → fr h 50, sib y 50",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { marginTop: "40px", height: "10px" }),
      n("fr", { display: "flow-root" }, [0]),
      n("sib", { height: "10px" }),
      root([1, 2]),
    ],
  },
  {
    name: "flow-root > child h10 mb20 · sib → 마지막 margin 도 안에 (fr h 30, sib y 30)",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "10px", marginBottom: "20px" }),
      n("fr", { display: "flow-root" }, [0]),
      n("sib", { height: "10px" }),
      root([1, 2]),
    ],
  },
  {
    name: "a h10 mb20 · flow-root mt10 > child h10 → BFC 자신의 top 은 형제와 collapse (fr y 20)",
    availW: 400,
    availH: -1,
    nodes: [
      n("a", { height: "10px", marginBottom: "20px" }),
      n("child", { height: "10px" }),
      n("fr", { display: "flow-root", marginTop: "10px" }, [1]),
      root([0, 2]),
    ],
  },
  {
    name: "빈 flow-root mt20 mb30 사이 형제 — BFC 는 self-collapsing 이 아니다",
    availW: 400,
    availH: -1,
    nodes: [
      n("a", { height: "10px" }),
      n("fr", {
        display: "flow-root",
        marginTop: "20px",
        marginBottom: "30px",
      }),
      n("b", { height: "10px" }),
      root([0, 1, 2]),
    ],
  },
  {
    name: "flow-root > block wrap > child mt40 h10 → margin 은 wrap 을 탈출하되 fr 안에 (child y 40, fr h 50)",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { marginTop: "40px", height: "10px" }),
      n("wrap", {}, [0]),
      n("fr", { display: "flow-root" }, [1]),
      n("sib", { height: "10px" }),
      root([2, 3]),
    ],
  },
  {
    name: "inline-block w100 > child mt40 h10 → ib h 50 (inline-block 도 BFC)",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { marginTop: "40px", height: "10px" }),
      n("ib", { display: "inline-block", width: "100px" }, [0]),
      // line-height 0 — strut descent 를 제거해 BFC 축만 잰다 (엔진은 "normal" strut 을 모른다)
      root([1], { lineHeight: 0 }),
    ],
  },
  {
    // live 대조군 (abs wrapper 안 plain block) 이 드러낸 인접 사각 — abs-pos 상자도 BFC (CSS 2.1 §9.4.1).
    name: "abs w300 > plain block > child mt40 h10 → abs 가 BFC (abs h 50, plain y 40)",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { marginTop: "40px", height: "10px" }),
      n("plain", {}, [0]),
      n("abs", {
        position: "absolute",
        top: "0px",
        left: "0px",
        insetTop: "0px",
        insetLeft: "0px",
        width: "300px",
      }, [1]),
      root([2], { position: "relative", height: "100px" }),
    ],
  },
  {
    name: "대조군 — overflow hidden > child mt40 h10 (기존 BFC 경로) → h 50",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { marginTop: "40px", height: "10px" }),
      n("oh", { overflowX: "hidden", overflowY: "hidden" }, [0]),
      n("sib", { height: "10px" }),
      root([1, 2]),
    ],
  },
  {
    name: "대조군 — 일반 block wrap > child mt40 h10 → margin 탈출 (wrap h 10, wrap y 40)",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { marginTop: "40px", height: "10px" }),
      n("wrap", {}, [0]),
      n("sib", { height: "10px" }),
      root([1, 2]),
    ],
  },
];

// ── block align-content ──
const box = (h: string, ac: string, extra: StyleRecord = {}): StyleRecord => ({
  width: "400px",
  height: h,
  alignContent: ac,
  ...extra,
});

const ALIGN_CONTENT: ParityCase[] = [
  {
    name: "B5 block h200 align-content center > child h50 → y 75",
    availW: 400,
    availH: -1,
    nodes: [n("child", { height: "50px" }), root([0], box("200px", "center"))],
  },
  {
    name: "block h200 align-content end > child h50 → y 150",
    availW: 400,
    availH: -1,
    nodes: [n("child", { height: "50px" }), root([0], box("200px", "end"))],
  },
  {
    name: "block h200 align-content flex-end > child h50 → y 150",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      root([0], box("200px", "flex-end")),
    ],
  },
  {
    name: "block h200 align-content start > child h50 → y 0",
    availW: 400,
    availH: -1,
    nodes: [n("child", { height: "50px" }), root([0], box("200px", "start"))],
  },
  {
    name: "block h200 align-content space-between > child h50 (단일) → 폴백",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      root([0], box("200px", "space-between")),
    ],
  },
  {
    name: "block h200 align-content space-around > child h50 (단일) → 폴백",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      root([0], box("200px", "space-around")),
    ],
  },
  {
    name: "block h200 align-content space-evenly > child h50 (단일) → 폴백",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      root([0], box("200px", "space-evenly")),
    ],
  },
  {
    name: "block h200 center > a h50 · b mt10 h30 → 묶음 90, y 55 / 115",
    availW: 400,
    availH: -1,
    nodes: [
      n("a", { height: "50px" }),
      n("b", { marginTop: "10px", height: "30px" }),
      root([0, 1], box("200px", "center")),
    ],
  },
  {
    name: "block h200 pt20 center > child h50 → content 160, y 20+55",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      root([0], box("200px", "center", { paddingTop: "20px" })),
    ],
  },
  {
    name: "block h200 center > child mt20 h50 → 첫 자식 top margin 과 정렬",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { marginTop: "20px", height: "50px" }),
      root([0], box("200px", "center")),
    ],
  },
  {
    name: "block h200 center > child h50 mb30 → 마지막 자식 bottom margin 과 정렬",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px", marginBottom: "30px" }),
      root([0], box("200px", "center")),
    ],
  },
  {
    name: "block h100 center > child h150 (overflow) → 기본 overflow 동작",
    availW: 400,
    availH: -1,
    nodes: [n("child", { height: "150px" }), root([0], box("100px", "center"))],
  },
  {
    name: "block h100 unsafe center > child h150 → 음수 허용",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "150px" }),
      root([0], box("100px", "unsafe center")),
    ],
  },
  {
    name: "block h100 safe center > child h150 → start",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "150px" }),
      root([0], box("100px", "safe center")),
    ],
  },
  {
    name: "block h200 safe center > child h50 → 여유 있으면 center",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      root([0], box("200px", "safe center")),
    ],
  },
  {
    name: "block height auto min-height 200 center > child h50 → min-height 가 만든 여유",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      root([0], { width: "400px", minHeight: "200px", alignContent: "center" }),
    ],
  },
  {
    name: "block h200 center > in-flow h50 + abs top0 → abs 는 정렬 대상 아님",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      n("abs", {
        position: "absolute",
        top: "0px",
        left: "0px",
        insetTop: "0px",
        insetLeft: "0px",
        width: "20px",
        height: "20px",
      }),
      root([0, 1], box("200px", "center", { position: "relative" })),
    ],
  },
  {
    name: "flex column > block h200 center > child h50 → flex item 인 block 도 정렬",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      n("blk", box("200px", "center"), [0]),
      root([1], { display: "flex", flexDirection: "column" }),
    ],
  },
  {
    name: "대조군 — block height auto center > child h50 → 여유 0 (y 0, h 50)",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      root([0], { width: "400px", alignContent: "center" }),
    ],
  },
  {
    name: "대조군 — block h200 normal > child h50 → y 0",
    availW: 400,
    availH: -1,
    nodes: [n("child", { height: "50px" }), root([0], box("200px", "normal"))],
  },
  {
    name: "대조군 — block h200 (미지정) > child h50 → y 0",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px" }),
      root([0], { width: "400px", height: "200px" }),
    ],
  },
];


// ── align-content 와 첫 자식 margin 의 collapse (outer 를 씌워 blk 자신의 이동을 본다) ──
const MARGIN_ESCAPE: ParityCase[] = (
  ["normal", "start", "center", "end"] as const
).map((ac) => ({
  name: `outer > block h200 ${ac} > child mt20 h50 → blk.y 로 top margin 탈출 여부`,
  availW: 400,
  availH: -1,
  nodes: [
    n("child", { marginTop: "20px", height: "50px" }),
    n("blk", box("200px", ac), [0]),
    root([1]),
  ],
}));

const AUTO_HEIGHT_MARGIN: ParityCase[] = [
  {
    name: "outer > block h auto center > child mt20 h50 → auto 높이에서도 top margin 탈출 여부",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { marginTop: "20px", height: "50px" }),
      n("blk", { width: "400px", alignContent: "center" }, [0]),
      root([1]),
    ],
  },
  {
    name: "outer > block h auto center > child h50 mb30 · sib → bottom margin 탈출 여부 (blk.h)",
    availW: 400,
    availH: -1,
    nodes: [
      n("child", { height: "50px", marginBottom: "30px" }),
      n("blk", { width: "400px", alignContent: "center" }, [0]),
      n("sib", { height: "10px" }),
      root([1, 2]),
    ],
  },
];

const ALL = [
  ...FLOW_ROOT,
  ...ALIGN_CONTENT,
  ...MARGIN_ESCAPE,
  ...AUTO_HEIGHT_MARGIN,
];

describe("⑧ flow-root BFC · block align-content", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(ALL.map((c) => [c.name, c] as const))(
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

  it.each(ALL.map((c) => [c.name, c] as const))(
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
