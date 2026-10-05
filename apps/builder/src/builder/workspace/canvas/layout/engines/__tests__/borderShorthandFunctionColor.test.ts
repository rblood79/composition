import { describe, expect, it } from "vitest";
import { parseBorderShorthand } from "../cssValueParser";

/** 2026-10-05 감사 LOW — 함수 색 (rgb · hsl · oklch · var) 안의 공백은 토큰을 끊지 않는다. */
describe("parseBorderShorthand — 공백 있는 함수 색", () => {
  it.each([
    ["1px solid rgb(255, 0, 0)", "rgb(255, 0, 0)"],
    ["2px dashed rgb(0 0 0 / 0.5)", "rgb(0 0 0 / 0.5)"],
    ["solid oklch(0.7 0.1 200) 3px", "oklch(0.7 0.1 200)"],
    ["1px solid var(--a, rgb(1 2 3))", "var(--a, rgb(1 2 3))"],
  ])("%s", (value, color) => {
    const parsed = parseBorderShorthand(value);
    expect(parsed?.color).toBe(color);
    expect(parsed?.width).toBeGreaterThan(0);
  });

  it("색이 width 앞에 와도 width 를 읽는다 (borderGeometry 가 읽는 값)", () => {
    expect(parseBorderShorthand("rgb(0 0 0) 2px solid")?.width).toBe(2);
  });
});
