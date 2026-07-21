import { describe, expect, it } from "vitest";
import type { ElementResponsiveConfig } from "@composition/shared";
import {
  clearGlobalStyleResponsiveOverrides,
  isGlobalStyleProp,
} from "./globalStyleProps";

describe("globalStyleProps — border 전역 속성 판정", () => {
  it("border 색/스타일/너비는 전역(global) 속성", () => {
    expect(isGlobalStyleProp("borderColor")).toBe(true);
    expect(isGlobalStyleProp("borderStyle")).toBe(true);
    expect(isGlobalStyleProp("borderWidth")).toBe(true);
    expect(isGlobalStyleProp("borderTopColor")).toBe(true);
    expect(isGlobalStyleProp("borderLeftWidth")).toBe(true);
  });

  it("borderRadius / 기타 layout 속성은 전역 아님 (responsive 유지)", () => {
    expect(isGlobalStyleProp("borderRadius")).toBe(false);
    expect(isGlobalStyleProp("padding")).toBe(false);
    expect(isGlobalStyleProp("gap")).toBe(false);
    expect(isGlobalStyleProp("width")).toBe(false);
  });
});

describe("clearGlobalStyleResponsiveOverrides — responsive 에서 border 키 제거", () => {
  it("border 키만 제거하고 non-global 키(gap)는 breakpoint 별로 보존", () => {
    const existing: ElementResponsiveConfig = {
      styles: {
        borderColor: { mobile: "#ff0000", tablet: "#00ff00" },
        rowGap: { mobile: 33 },
      },
    } as unknown as ElementResponsiveConfig;
    const result = clearGlobalStyleResponsiveOverrides(existing);
    expect(result).not.toBeNull();
    const styles = result?.styles as Record<string, unknown>;
    expect(styles.borderColor).toBeUndefined();
    expect(styles.rowGap).toEqual({ mobile: 33 });
  });

  it("border 키가 전부 제거돼 styles 가 비면 styles 필드 자체 삭제", () => {
    const existing: ElementResponsiveConfig = {
      styles: { borderWidth: { mobile: 2 } },
    } as unknown as ElementResponsiveConfig;
    const result = clearGlobalStyleResponsiveOverrides(existing);
    expect(result).not.toBeNull();
    expect(result?.styles).toBeUndefined();
  });

  it("border 키가 없으면 null 반환 (불필요한 write 회피)", () => {
    const existing: ElementResponsiveConfig = {
      styles: { rowGap: { mobile: 12 } },
    } as unknown as ElementResponsiveConfig;
    expect(clearGlobalStyleResponsiveOverrides(existing)).toBeNull();
  });

  it("styles 자체가 없으면 null 반환", () => {
    expect(clearGlobalStyleResponsiveOverrides(undefined)).toBeNull();
    expect(
      clearGlobalStyleResponsiveOverrides({} as ElementResponsiveConfig),
    ).toBeNull();
  });
});
