import { describe, expect, it } from "vitest";
import { borderWidth, lightColors, radius, typography } from "@composition/specs";
import {
  THEME_TOKEN_CATEGORIES,
  joinThemeTokenKey,
  parseThemeTokenInput,
  splitThemeTokenKey,
  themeTokenKeys,
  themeTokenSeedValue,
  themeTokenValueType,
} from "../themeTokenEditor";

describe("themeTokenEditor — 카테고리 · 키 · 값 검증 (ADR-227 Phase 4)", () => {
  it("카테고리 6 · 키는 seed 맵에서 (color 는 파생 hover/pressed 제외 · radius 는 full 제외 · border 는 width.<k>)", () => {
    expect(THEME_TOKEN_CATEGORIES).toHaveLength(6);
    const color = themeTokenKeys("color");
    expect(color).toContain("accent");
    expect(color.some((k) => /-(hover|pressed)$/.test(k))).toBe(false);
    expect(color.length).toBeLessThan(Object.keys(lightColors).length);
    expect(themeTokenKeys("typography")).toEqual(Object.keys(typography));
    expect(themeTokenKeys("radius")).toEqual(
      Object.keys(radius).filter((k) => k !== "full"),
    );
    expect(themeTokenKeys("border")).toEqual(
      Object.keys(borderWidth).map((k) => `width.${k}`),
    );
    expect(themeTokenKeys("focus")).toEqual([
      "ring-color",
      "ring-width",
      "ring-offset",
      "ring-inset-offset",
    ]);
  });

  it("키 분리/결합 · 미지원 카테고리는 null", () => {
    expect(splitThemeTokenKey("border.width.thin")).toEqual({
      category: "border",
      key: "width.thin",
    });
    expect(joinThemeTokenKey("radius", "md")).toBe("radius.md");
    expect(splitThemeTokenKey("weird.key")).toBeNull();
    expect(splitThemeTokenKey("nodot")).toBeNull();
  });

  it("값 타입 — color/shadow/focus ring-color/typography string 키/그 외 number", () => {
    expect(themeTokenValueType("color", "accent")).toBe("color");
    expect(themeTokenValueType("shadow", "md")).toBe("string");
    expect(themeTokenValueType("focus", "ring-color")).toBe("color");
    expect(themeTokenValueType("focus", "ring-width")).toBe("number");
    expect(themeTokenValueType("typography", "text-sm")).toBe("number");
    expect(themeTokenValueType("border", "width.thin")).toBe("number");
  });

  it("parse — hex6 만 · 숫자는 0 이상 유한 (px 접미 허용) · seed 와 같으면 null (델타 삭제) · 무효는 error", () => {
    expect(parseThemeTokenInput("color", "accent", "#00A000")).toEqual({
      entry: { type: "color", value: "#00a000", source: "spec-token" },
    });
    expect(parseThemeTokenInput("color", "accent", "red")).toEqual({ error: "invalid" });
    expect(parseThemeTokenInput("border", "width.thin", "3px")).toEqual({
      entry: { type: "number", value: 3, source: "spec-token" },
    });
    expect(parseThemeTokenInput("border", "width.thin", "1")).toEqual({ entry: null });
    expect(parseThemeTokenInput("radius", "md", "-2")).toEqual({ error: "invalid" });
    expect(parseThemeTokenInput("radius", "md", "")).toEqual({ error: "invalid" });
    expect(parseThemeTokenInput("radius", "md", String(themeTokenSeedValue("radius", "md")))).toEqual({ entry: null });
    expect(parseThemeTokenInput("shadow", "md", "0 0 4px red")).toEqual({
      entry: { type: "string", value: "0 0 4px red", source: "spec-token" },
    });
    // focus 는 seed 를 모른다 → 값 그대로 entry
    expect(parseThemeTokenInput("focus", "ring-width", "3")).toEqual({
      entry: { type: "number", value: 3, source: "spec-token" },
    });
  });
});
