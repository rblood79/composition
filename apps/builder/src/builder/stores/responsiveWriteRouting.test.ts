/**
 * ADR-154 개정 1 — write 라우팅 판정(shouldWriteBreakpointOverride) 단위 검증.
 *
 * 개정 모델: 편집 기본은 base(전역). eligible(Layout·Transform) 속성이 해당 tier
 * 토글 ON(명시 override 존재)일 때만 responsive override 로 라우팅. 이 판정을 write
 * 3함수(commit/preview/batch)가 공유하므로(R10), 판정 자체를 단독 검증한다.
 */
import { describe, expect, it } from "vitest";
import type { ElementResponsiveConfig } from "@composition/shared";
import {
  hasOwnTierOverride,
  shouldWriteBreakpointOverride,
} from "./utils/responsiveWriteRouting";

const withOverride = (
  styles: Record<string, Record<string, unknown>>,
): ElementResponsiveConfig =>
  ({ styles }) as unknown as ElementResponsiveConfig;

describe("hasOwnTierOverride — 자기 tier 명시 override 존재 판정", () => {
  it("직접 키(width) mobile override 존재 → true, tablet → false", () => {
    const r = withOverride({ width: { mobile: "50%" } });
    expect(hasOwnTierOverride(r, "width", "mobile")).toBe(true);
    expect(hasOwnTierOverride(r, "width", "tablet")).toBe(false);
  });

  it("shorthand(padding)은 longhand 중 하나라도 존재하면 ON", () => {
    const r = withOverride({ paddingTop: { mobile: 8 } });
    expect(hasOwnTierOverride(r, "padding", "mobile")).toBe(true);
    expect(hasOwnTierOverride(r, "paddingTop", "mobile")).toBe(true);
    expect(hasOwnTierOverride(r, "paddingBottom", "mobile")).toBe(false);
  });

  it("responsive 없거나 styles 없으면 false", () => {
    expect(hasOwnTierOverride(undefined, "width", "mobile")).toBe(false);
    expect(
      hasOwnTierOverride({} as ElementResponsiveConfig, "width", "mobile"),
    ).toBe(false);
  });
});

describe("shouldWriteBreakpointOverride — 개정 write 라우팅", () => {
  const rWidthMobile = withOverride({ width: { mobile: "50%" } });

  it("desktop 은 항상 base (eligible + override 있어도 false)", () => {
    expect(
      shouldWriteBreakpointOverride(rWidthMobile, "width", "desktop"),
    ).toBe(false);
  });

  it("eligible + 토글 ON(override 존재) → override write (true)", () => {
    expect(shouldWriteBreakpointOverride(rWidthMobile, "width", "mobile")).toBe(
      true,
    );
  });

  it("eligible + 토글 OFF(override 없음) → base write (false) — 개정 기본", () => {
    expect(shouldWriteBreakpointOverride(undefined, "padding", "mobile")).toBe(
      false,
    );
    // 다른 tier 에만 override 존재 → 이 tier 는 OFF
    expect(shouldWriteBreakpointOverride(rWidthMobile, "width", "tablet")).toBe(
      false,
    );
  });

  it("non-eligible(전역: border/fontSize/backgroundColor)은 override 있어도 base (false)", () => {
    const rBorder = withOverride({ borderColor: { mobile: "#f00" } });
    expect(
      shouldWriteBreakpointOverride(rBorder, "borderColor", "mobile"),
    ).toBe(false);
    const rFont = withOverride({ fontSize: { mobile: 12 } });
    expect(shouldWriteBreakpointOverride(rFont, "fontSize", "mobile")).toBe(
      false,
    );
  });
});
