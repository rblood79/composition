import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanvasLayoutNode } from "../../layoutNode";
import {
  getTextMeasurer,
  setTextMeasurer,
  type TextMeasurer,
} from "../../../utils/textMeasure";
import { enrichWithIntrinsicSize } from "../utils";

let previous: TextMeasurer;
let wrappedCalls: number;
let widthCalls: number;

beforeEach(() => {
  previous = getTextMeasurer();
  wrappedCalls = 0;
  widthCalls = 0;
  setTextMeasurer({
    measureWidth: (text, style) => {
      widthCalls++;
      return text.length * style.fontSize * 0.5;
    },
    measureWrapped: (text, style, width) => {
      wrappedCalls++;
      const contentWidth = text.length * style.fontSize * 0.5;
      return {
        width: Math.min(width, contentWidth),
        height: Math.ceil(contentWidth / width) * (style.lineHeight ?? 20),
      };
    },
  });
});

afterEach(() => setTextMeasurer(previous));

describe("intrinsic 측정 작업량", () => {
  it("고정 폭 Text의 자동 높이는 최종 측정 폭에서 한 번만 잰다", () => {
    const text = {
      id: "text",
      type: "Text",
      props: {
        children: "one two three four five six",
        style: {
          width: "100px",
          height: "auto",
          fontSize: 16,
          lineHeight: "20px",
        },
      },
    } as CanvasLayoutNode;
    const result = enrichWithIntrinsicSize(text, 400, 300);
    expect((result.props?.style as Record<string, unknown>).height).toBe(60);
    expect(wrappedCalls).toBe(1);
    expect(widthCalls).toBe(0);
  });

  it("고정 크기 Text는 baseline만 공급하고 내용 크기를 다시 재지 않는다", () => {
    const text = {
      id: "text",
      type: "Text",
      props: {
        children: "one two three four five six",
        style: {
          width: "100px",
          height: "20px",
          fontSize: 16,
          lineHeight: "20px",
        },
      },
    } as CanvasLayoutNode;
    const result = enrichWithIntrinsicSize(text, 400, 300);
    expect(
      (result.props?.style as Record<string, unknown>).leafBaseline,
    ).toBeTypeOf("number");
    expect(wrappedCalls).toBe(0);
    expect(widthCalls).toBe(0);
  });
});
