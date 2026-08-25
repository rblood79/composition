import { darkColors, lightColors } from "@composition/specs";
import { describe, expect, it } from "vitest";

import { resolveAccentColorTokens } from "../../../../utils/theme/tintToSkiaColors";
import { resolveStylePanelColor } from "./styleValueHelpers";

describe("resolveStylePanelColor", () => {
  it("TokenRef와 CSS variable을 현재 theme concrete color로 해석한다", () => {
    expect(resolveStylePanelColor("{color.accent}", "light")).toBe(
      lightColors.accent,
    );
    expect(resolveStylePanelColor("var(--accent)", "light")).toBe(
      lightColors.accent,
    );
  });

  it("요소 accent를 global token mutation 없이 해석한다", () => {
    const lightBefore = lightColors.accent;
    const darkBefore = darkColors.accent;
    const lightExpected = resolveAccentColorTokens("red", "light")?.accent;
    const darkExpected = resolveAccentColorTokens("blue", "dark")?.accent;

    expect(resolveStylePanelColor("var(--accent)", "light", "red")).toBe(
      lightExpected,
    );
    expect(resolveStylePanelColor("var(--accent)", "dark", "blue")).toBe(
      darkExpected,
    );
    expect(lightColors.accent).toBe(lightBefore);
    expect(darkColors.accent).toBe(darkBefore);
  });

  it("transparent catalog 색을 picker가 보존 가능한 완전 투명 hex로 정규화한다", () => {
    expect(resolveStylePanelColor("{color.transparent}", "light")).toBe(
      "#00000000",
    );
    expect(resolveStylePanelColor("transparent", "dark")).toBe("#00000000");
  });

  it("알 수 없는 CSS variable과 이미 concrete인 색은 원문을 보존한다", () => {
    expect(resolveStylePanelColor("var(--custom-color)", "light")).toBe(
      "var(--custom-color)",
    );
    expect(resolveStylePanelColor("#123456", "light")).toBe("#123456");
  });
});
