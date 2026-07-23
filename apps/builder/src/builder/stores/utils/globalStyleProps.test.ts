import { describe, expect, it } from "vitest";
import type { ElementResponsiveConfig } from "@composition/shared";
import {
  clearNonEligibleResponsiveOverrides,
  isGlobalStyleProp,
} from "./globalStyleProps";

describe("globalStyleProps — ADR-154 개정 1: 전역 = non-eligible 판정", () => {
  it("Layout·Transform(eligible) 속성은 전역 아님", () => {
    // Layout
    expect(isGlobalStyleProp("padding")).toBe(false);
    expect(isGlobalStyleProp("gap")).toBe(false);
    expect(isGlobalStyleProp("rowGap")).toBe(false);
    expect(isGlobalStyleProp("display")).toBe(false);
    expect(isGlobalStyleProp("flexDirection")).toBe(false);
    // Transform
    expect(isGlobalStyleProp("width")).toBe(false);
    expect(isGlobalStyleProp("height")).toBe(false);
    expect(isGlobalStyleProp("minWidth")).toBe(false);
    expect(isGlobalStyleProp("flexGrow")).toBe(false);
  });

  it("배경·border·radius·typography·overflow 등 non-eligible 은 전역", () => {
    // border (원안에서도 전역이던 것)
    expect(isGlobalStyleProp("borderColor")).toBe(true);
    expect(isGlobalStyleProp("borderStyle")).toBe(true);
    expect(isGlobalStyleProp("borderWidth")).toBe(true);
    expect(isGlobalStyleProp("borderTopColor")).toBe(true);
    // 개정 1 로 새로 전역이 된 것들
    expect(isGlobalStyleProp("borderRadius")).toBe(true);
    expect(isGlobalStyleProp("backgroundColor")).toBe(true);
    expect(isGlobalStyleProp("boxShadow")).toBe(true);
    expect(isGlobalStyleProp("overflow")).toBe(true);
    expect(isGlobalStyleProp("fontSize")).toBe(true);
    expect(isGlobalStyleProp("textAlign")).toBe(true);
    expect(isGlobalStyleProp("color")).toBe(true);
  });
});

describe("clearNonEligibleResponsiveOverrides — non-eligible 키 제거", () => {
  it("non-eligible 키(border/fontSize)만 제거하고 eligible(gap)은 breakpoint 별로 보존", () => {
    const existing: ElementResponsiveConfig = {
      styles: {
        borderColor: { mobile: "#ff0000", tablet: "#00ff00" },
        fontSize: { mobile: 12 },
        rowGap: { mobile: 33 },
        width: { tablet: "50%" },
      },
    } as unknown as ElementResponsiveConfig;
    const result = clearNonEligibleResponsiveOverrides(existing);
    expect(result).not.toBeNull();
    const styles = result?.styles as Record<string, unknown>;
    expect(styles.borderColor).toBeUndefined();
    expect(styles.fontSize).toBeUndefined();
    expect(styles.rowGap).toEqual({ mobile: 33 });
    expect(styles.width).toEqual({ tablet: "50%" });
  });

  it("non-eligible 키가 전부 제거돼 styles 가 비면 styles 필드 자체 삭제", () => {
    const existing: ElementResponsiveConfig = {
      styles: { borderWidth: { mobile: 2 }, fontSize: { tablet: 20 } },
    } as unknown as ElementResponsiveConfig;
    const result = clearNonEligibleResponsiveOverrides(existing);
    expect(result).not.toBeNull();
    expect(result?.styles).toBeUndefined();
  });

  it("non-eligible 키가 없으면 null 반환 (불필요한 write 회피)", () => {
    const existing: ElementResponsiveConfig = {
      styles: { rowGap: { mobile: 12 }, width: { mobile: "100%" } },
    } as unknown as ElementResponsiveConfig;
    expect(clearNonEligibleResponsiveOverrides(existing)).toBeNull();
  });

  it("styles 자체가 없으면 null 반환", () => {
    expect(clearNonEligibleResponsiveOverrides(undefined)).toBeNull();
    expect(
      clearNonEligibleResponsiveOverrides({} as ElementResponsiveConfig),
    ).toBeNull();
  });
});
