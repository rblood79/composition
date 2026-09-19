// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getTextMeasurer,
  setTextMeasurer,
  type TextMeasurer,
} from "../../utils/textMeasure";
import { specShapesToSkia } from "../specShapeConverter";

/**
 * ADR-027 D3 live (2026-09-20) — baseline middle 텍스트의 세로 중앙은 textBlockHeight 로 잡는데,
 * 그 측정이 white-space 를 못 받으면 pre-wrap 의 `\n` 을 공백으로 봐 3줄 (72) 을 2줄 (48) 로 재
 * paddingTop 이 12px 커진다 (82 상자: 17 vs 5). 측정기는 결정적 fake — 줄 수만 본다.
 */
const PRE = new Set(["pre", "pre-wrap", "pre-line"]);
const fake: TextMeasurer = {
  measureWidth: (t, s) => t.length * s.fontSize * 0.5,
  measureWrapped: (t, s, maxWidth) => {
    const lh = s.lineHeight ?? s.fontSize * 1.5;
    const segs = PRE.has(s.whiteSpace ?? "normal")
      ? t.split("\n")
      : [t.replace(/\n/g, " ")];
    let lines = 0;
    for (const seg of segs)
      lines += Math.max(
        1,
        Math.ceil((seg.length * s.fontSize * 0.5) / maxWidth),
      );
    return { width: maxWidth, height: lines * lh };
  },
};
let prev: TextMeasurer;
beforeAll(() => {
  prev = getTextMeasurer();
  setTextMeasurer(fake);
});
afterAll(() => setTextMeasurer(prev));

describe("specShapesToSkia — pre-wrap 명시 줄바꿈의 textBlockHeight", () => {
  const textNode = (whiteSpace?: "pre-wrap") =>
    specShapesToSkia(
      [
        {
          id: "t",
          type: "text",
          text: "a\nb\nc",
          x: 5,
          y: 0,
          align: "center",
          baseline: "middle",
          fill: "#000",
          fontSize: 16,
          fontFamily: "Pretendard",
          lineHeight: 24,
          ...(whiteSpace ? { whiteSpace } : {}),
        },
      ],
      "light",
      342,
      82,
    ).children?.[0]?.text;

  it("whiteSpace pre-wrap → 3줄 (72) 기준 중앙: paddingTop (82 − 72) / 2 = 5", () => {
    expect(textNode("pre-wrap")?.paddingTop).toBe(5);
  });

  it("whiteSpace 없음 → 1줄 기준 (종전): paddingTop (82 − 24) / 2 = 29", () => {
    expect(textNode()?.paddingTop).toBe(29);
  });
});

describe("buildSpecNodeData 가 style.whiteSpace 를 text shape 에 싣는다 (static)", () => {
  it("변환 전 stamp 블록이 있다", () => {
    const src = readFileSync(
      resolve(__dirname, "../buildSpecNodeData.ts"),
      "utf8",
    );
    expect(src).toContain('sh.type === "text" && sh.whiteSpace == null');
  });
});

/**
 * ADR-027 후속 7 (2026-09-20, 사용자 live: Text 에 border 1px 만 주면 padding 0 에서 텍스트가 상자 밖) —
 * (a) x = 0 이면 블록 높이를 안 재 7줄을 1줄로 보고 (170 − 24) / 2 = 73 에 중앙 배치했다.
 * (b) baseline top 텍스트는 border-box 보정에서 paddingTop 도 border 만큼 내려간다 (DOM border-top).
 */
describe("specShapesToSkia — padding 0 · border 1 의 텍스트 자리", () => {
  const convert = (baseline: "top" | "middle") =>
    specShapesToSkia(
      [
        {
          id: "bg",
          type: "roundRect",
          x: 0,
          y: 0,
          width: 342,
          height: 170,
          radius: 0,
          fill: "#fff",
        },
        { id: "bd", type: "border", color: "#C20E0E", borderWidth: 1 },
        {
          id: "t",
          type: "text",
          text: "1\n2\n3\n4\n5\n6\n7",
          x: 0,
          y: 0,
          align: "left",
          baseline,
          fill: "#000",
          fontSize: 16,
          fontFamily: "Pretendard",
          lineHeight: 24,
          whiteSpace: "pre-wrap",
        },
      ],
      "light",
      342,
      170,
    ).children?.find((c) => c.type === "text")?.text;

  it("middle · x 0: 7줄 (168) 기준 중앙 → paddingTop 1 (종전 73)", () => {
    expect(convert("middle")?.paddingTop).toBe(1);
  });

  it("top: border 1 만큼 내려간다 → paddingTop 1, paddingLeft 1", () => {
    const t = convert("top");
    expect(t?.paddingTop).toBe(1);
    expect(t?.paddingLeft).toBe(1);
  });
});
