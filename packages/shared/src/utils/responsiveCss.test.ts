/**
 * ADR-154 개정 1 — responsive @media CSS 출력의 eligible 필터(R8) 검증.
 *
 * non-eligible(전역: border/fontSize/backgroundColor 등) stale override 는 @media 로
 * emit 되지 않아야 한다 (전역 속성은 base inline 이 전 breakpoint 담당). eligible
 * (Layout·Transform) override 만 @media 규칙로 나온다.
 */
import { describe, expect, it } from "vitest";
import type { ElementResponsiveConfig } from "../types/responsive.types";
import { isResponsiveEligibleStyleProp } from "../types/responsive.types";
import { buildResponsiveElementCss } from "./responsiveCss";

describe("isResponsiveEligibleStyleProp — allowlist SSOT", () => {
  it("Layout·Transform 키는 eligible", () => {
    for (const k of ["width", "padding", "gap", "flexDirection", "minWidth"]) {
      expect(isResponsiveEligibleStyleProp(k)).toBe(true);
    }
  });
  it("전역(border/typography/bg/overflow) 키는 non-eligible", () => {
    for (const k of [
      "borderColor",
      "borderRadius",
      "fontSize",
      "backgroundColor",
      "overflow",
      "boxShadow",
    ]) {
      expect(isResponsiveEligibleStyleProp(k)).toBe(false);
    }
  });
});

describe("buildResponsiveElementCss — R8 eligible 필터", () => {
  it("eligible override(width) 는 @media 로 emit", () => {
    const responsive = {
      styles: { width: { mobile: "50%" } },
    } as unknown as ElementResponsiveConfig;
    const css = buildResponsiveElementCss("el1", { width: "100%" }, responsive);
    expect(css).not.toBeNull();
    expect(css).toContain("width:50% !important");
    expect(css).toContain('[data-element-id="el1"]');
  });

  it("non-eligible override(fontSize/borderColor) 는 emit 안 함 (stale 무력화)", () => {
    const responsive = {
      styles: {
        fontSize: { mobile: 12 },
        borderColor: { mobile: "#f00" },
      },
    } as unknown as ElementResponsiveConfig;
    const css = buildResponsiveElementCss("el2", {}, responsive);
    expect(css).toBeNull();
  });

  it("혼합 시 eligible 만 emit, non-eligible 은 누락", () => {
    const responsive = {
      styles: {
        paddingTop: { mobile: 8 },
        borderRadius: { mobile: 4 },
      },
    } as unknown as ElementResponsiveConfig;
    const css = buildResponsiveElementCss("el3", {}, responsive) ?? "";
    expect(css).toContain("padding-top:8px !important");
    expect(css).not.toContain("border-radius");
  });

  it("visibility override 는 eligible 필터와 무관하게 유지 (별도 축)", () => {
    const responsive = {
      visibility: { mobile: false },
    } as unknown as ElementResponsiveConfig;
    const css = buildResponsiveElementCss("el4", {}, responsive) ?? "";
    expect(css).toContain("display:none !important");
  });
});
