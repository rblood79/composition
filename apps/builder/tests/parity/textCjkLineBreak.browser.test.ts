import { beforeAll, describe, expect, it } from "vitest";

import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import {
  domLeg,
  pipelineLeg,
  type CaseNode,
  type StyleRecord,
} from "./harness";

/**
 * **한글·한자 연속의 줄바꿈 단위 + 줄바꿈 폭의 border** (사용자 live 2026-09-20)
 *
 * 레이아웃 측정기 (`Canvas2DTextMeasurer.measureWrapped`) 가 공백 split 로 단어를 나눠 한글 연속
 * "가나다라마바사" 를 한 단어로 봤다 — Chrome (UAX #14 · `word-break: normal`) 은 음절 사이가 break
 * 기회다. 30% 폭 (content 40.6) 의 Text 상자가 Preview 350 / Canvas 278 (한글 4줄 ↔ 1줄). 렌더 힌트
 * (`measureWithCanvas2D`) 는 이미 음절 단위였으나 pre-wrap 은 `needsFallback` 이 CanvasKit 경로로
 * 보내 같은 공백 split (`cssNormalBreakProcess`) 이었다. 이제 레이아웃·렌더가 한 파이프라인이다.
 *
 * 둘째 축 — 4.9 텍스트 leaf 의 줄바꿈 폭이 border 를 안 뺐다 (120 − 60 = 60 vs Chrome 58).
 *
 * `keep-all` 은 종전대로 한 단위 (Chrome 도 넘친다).
 */

const PAGE_W = 390;
const PAGE_H = 600;
const TOL = 1.0;

const TEXT_BASE: StyleRecord = {
  fontFamily: "Arial",
  fontSize: 16,
  fontWeight: 400,
  lineHeight: "24px",
  whiteSpace: "pre-wrap",
};
// Arial 16 한글 폭 ≈ 16 — 60px 상자에 3자/줄, 40px 상자에 2자/줄. "BGTRFV bye bye" 는 공백에서 접힌다.
const TEXT =
  "ABCDEFG\n12345\n가나다라마바사\n098763\nBGTRFV bye bye\nKKJLGGGH\nEND";

const CASES: { name: string; text: StyleRecord }[] = [
  {
    name: "block width:120px padding:30px border:1px — 한글 음절 단위 + border 차감",
    text: {
      ...TEXT_BASE,
      display: "block",
      width: "120px",
      padding: "30px",
      borderStyle: "solid",
      borderWidth: "1px",
      borderColor: "#f00",
    },
  },
  {
    name: "block width:30% padding:30px border:1px — 사용자 live 케이스",
    text: {
      ...TEXT_BASE,
      display: "block",
      width: "30%",
      padding: "30px",
      borderStyle: "solid",
      borderWidth: "1px",
      borderColor: "#f00",
    },
  },
  {
    name: "flex column width:30% padding:30px — 익명 flex item 텍스트",
    text: {
      ...TEXT_BASE,
      display: "flex",
      flexDirection: "column",
      width: "30%",
      padding: "30px",
    },
  },
  {
    name: "white-space:normal width:60px — 조각 없는 normal 도 음절 단위",
    text: {
      ...TEXT_BASE,
      whiteSpace: "normal",
      display: "block",
      width: "60px",
    },
  },
  {
    name: "대조군 — word-break:keep-all width:60px (한 단위, 넘침)",
    text: {
      ...TEXT_BASE,
      display: "block",
      width: "60px",
      wordBreak: "keep-all",
    },
  },
  // sweep (2026-09-20) — 같은 "단어 = 공백 사이" 전제가 남아 있던 경로들
  {
    name: "sweep — overflow-wrap:break-word width:60px (줄 첫 단어도 넘치면 문자 분할)",
    text: {
      ...TEXT_BASE,
      display: "block",
      width: "60px",
      overflowWrap: "break-word",
    },
  },
  {
    name: "sweep — word-spacing:4px width:120px padding:30px border:1px (wrap leg 에 wordSpacing)",
    text: {
      ...TEXT_BASE,
      display: "block",
      width: "120px",
      padding: "30px",
      borderStyle: "solid",
      borderWidth: "1px",
      borderColor: "#f00",
      wordSpacing: "4px",
    },
  },
  {
    // small-caps 합성 폭 (smallCapsSynthesis.ts) — wrap leg 이 fontVariant 를 받아야 줄 수가 맞는다.
    name: "sweep — font-variant:small-caps + letter-spacing:2px width:66px (합성 폭으로 줄 수)",
    text: {
      ...TEXT_BASE,
      display: "block",
      width: "66px",
      fontVariant: "small-caps",
      letterSpacing: "2px",
    },
  },
  {
    name: "width:60px padding:10px border:1px — 좁은 padding 도 같은 식",
    text: {
      ...TEXT_BASE,
      display: "block",
      width: "60px",
      padding: "10px",
      borderStyle: "solid",
      borderWidth: "1px",
      borderColor: "#f00",
    },
  },
];

describe("한글 연속의 줄바꿈 단위 — Canvas 상자 높이 = Chrome", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  it.each(CASES.map((c) => [c.name, c.text] as const))("%s", (_n, style) => {
    const nodes: CaseNode[] = [
      { label: "t", elementType: "Text", text: TEXT, style },
      {
        label: "body",
        elementType: "body",
        style: { display: "block" },
        children: [0],
      },
    ];
    const dom = domLeg(nodes, PAGE_W);
    const pipe = pipelineLeg(nodes, PAGE_W, PAGE_H);
    const bad: string[] = [];
    for (const f of ["x", "y", "w", "h"] as const) {
      const d = Math.abs(dom[0][f] - pipe[0][f]);
      if (d > TOL) {
        bad.push(
          `t.${f}: dom=${dom[0][f].toFixed(1)} pipe=${pipe[0][f].toFixed(1)} (Δ${d.toFixed(1)})`,
        );
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
