import { describe, expect, it } from "vitest";

import { Canvas2DTextMeasurer } from "../textMeasure";

/**
 * ADR-027 D3 — 레이아웃의 활성 측정기 (Canvas2DTextMeasurer; CanvasKit 측정기는 설치되지 않는다) 가
 * pre 계열 white-space 의 `\n` 을 hard break 로 센다. jsdom 엔 2D context 가 없어 한 줄은 lineHeight
 * 한 줄로 떨어진다 — 여기서 보는 것은 "줄을 나누는가" 뿐이다.
 */
describe("Canvas2DTextMeasurer.measureWrapped — hard break", () => {
  const m = new Canvas2DTextMeasurer();
  const style = { fontSize: 16, fontFamily: "Pretendard", lineHeight: 24 };

  it("pre-wrap: `\\n` 마다 줄이 는다 (빈 줄 포함)", () => {
    expect(m.measureWrapped("a\nb\nc", { ...style, whiteSpace: "pre-wrap" }, 320).height).toBe(72);
    expect(m.measureWrapped("a\n\nc", { ...style, whiteSpace: "pre-wrap" }, 320).height).toBe(72);
  });

  it("pre: 폭과 무관하게 `\\n` 만", () => {
    expect(m.measureWrapped("a\nb", { ...style, whiteSpace: "pre" }, 1).height).toBe(48);
  });

  it("normal / 미지정: `\\n` 은 공백 — 1줄 (종전)", () => {
    expect(m.measureWrapped("a\nb\nc", style, 320).height).toBe(24);
    expect(m.measureWrapped("a\nb\nc", { ...style, whiteSpace: "normal" }, 320).height).toBe(24);
  });
});
