import { describe, it, expect } from "vitest";
import {
  parsePxValue,
  parsePadding4Way,
  parseBorderWidth,
  parseGapValue,
} from "../cssValueParser";

/**
 * ADR-907 Phase 1 — Layer A CSS value parser SSOT
 *
 * Hard Constraint:
 * - 숫자/문자열/undefined 3 형태 수용
 * - fallback 수용 (기존 default 보존)
 * - shorthand 1/2/3/4 값 분해 (padding/gap)
 */

describe("parsePxValue", () => {
  it("숫자 value 그대로 반환", () => {
    expect(parsePxValue(16, 0)).toBe(16);
    expect(parsePxValue(0, 99)).toBe(0);
  });

  it("px 문자열 파싱", () => {
    expect(parsePxValue("16px", 0)).toBe(16);
    expect(parsePxValue("24.5px", 0)).toBeCloseTo(24.5);
  });

  it("단위 없는 숫자 문자열 파싱", () => {
    expect(parsePxValue("16", 0)).toBe(16);
    expect(parsePxValue("24.5", 0)).toBeCloseTo(24.5);
  });

  it("undefined/null → fallback", () => {
    expect(parsePxValue(undefined, 12)).toBe(12);
    expect(parsePxValue(null, 12)).toBe(12);
  });

  it("빈 문자열 → fallback", () => {
    expect(parsePxValue("", 12)).toBe(12);
    expect(parsePxValue("   ", 12)).toBe(12);
  });

  it("NaN / 파싱 실패 → fallback", () => {
    expect(parsePxValue("auto", 12)).toBe(12);
    expect(parsePxValue("invalid", 12)).toBe(12);
    expect(parsePxValue(NaN, 12)).toBe(12);
  });

  it("객체/배열 → fallback", () => {
    expect(parsePxValue({}, 8)).toBe(8);
    expect(parsePxValue([], 8)).toBe(8);
  });
});

describe("parsePadding4Way", () => {
  it("undefined style → 0 4방향", () => {
    expect(parsePadding4Way()).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(parsePadding4Way(undefined)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("longhand 4 방향 개별 지정", () => {
    expect(
      parsePadding4Way({
        paddingTop: 8,
        paddingRight: 16,
        paddingBottom: 24,
        paddingLeft: 32,
      }),
    ).toEqual({ top: 8, right: 16, bottom: 24, left: 32 });
  });

  it("shorthand 1값 — 전체 동일", () => {
    expect(parsePadding4Way({ padding: 16 })).toEqual({
      top: 16,
      right: 16,
      bottom: 16,
      left: 16,
    });
    expect(parsePadding4Way({ padding: "16px" })).toEqual({
      top: 16,
      right: 16,
      bottom: 16,
      left: 16,
    });
  });

  it("shorthand 2값 — T/B + L/R", () => {
    expect(parsePadding4Way({ padding: "8px 16px" })).toEqual({
      top: 8,
      right: 16,
      bottom: 8,
      left: 16,
    });
  });

  it("shorthand 3값 — T + L/R + B", () => {
    expect(parsePadding4Way({ padding: "8px 16px 24px" })).toEqual({
      top: 8,
      right: 16,
      bottom: 24,
      left: 16,
    });
  });

  it("shorthand 4값 — T/R/B/L", () => {
    expect(parsePadding4Way({ padding: "8px 16px 24px 32px" })).toEqual({
      top: 8,
      right: 16,
      bottom: 24,
      left: 32,
    });
  });

  it("longhand 가 shorthand override", () => {
    expect(
      parsePadding4Way({
        padding: "8px",
        paddingTop: 99,
      }),
    ).toEqual({ top: 99, right: 8, bottom: 8, left: 8 });
  });

  it("잘못된 shorthand 값 → 0 으로 fallback", () => {
    expect(parsePadding4Way({ padding: "auto" })).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("숫자 shorthand", () => {
    expect(parsePadding4Way({ padding: 12 })).toEqual({
      top: 12,
      right: 12,
      bottom: 12,
      left: 12,
    });
  });
});

describe("parseBorderWidth", () => {
  it("숫자 → 그대로", () => {
    expect(parseBorderWidth(1)).toBe(1);
    expect(parseBorderWidth(2)).toBe(2);
    expect(parseBorderWidth(0)).toBe(0);
  });

  it("px 문자열 파싱", () => {
    expect(parseBorderWidth("1px")).toBe(1);
    expect(parseBorderWidth("2.5px")).toBeCloseTo(2.5);
  });

  it("undefined → fallback (default 0)", () => {
    expect(parseBorderWidth(undefined)).toBe(0);
    expect(parseBorderWidth(undefined, 1)).toBe(1);
  });

  it("null → fallback", () => {
    expect(parseBorderWidth(null, 1)).toBe(1);
  });

  it("빈 문자열 → fallback", () => {
    expect(parseBorderWidth("", 1)).toBe(1);
  });

  it("잘못된 값 → fallback", () => {
    expect(parseBorderWidth("thick", 1)).toBe(1); // keyword 미지원
    expect(parseBorderWidth("auto", 1)).toBe(1);
  });
});

describe("parseGapValue", () => {
  it("undefined style → 0 row/column", () => {
    expect(parseGapValue()).toEqual({ row: 0, column: 0 });
    expect(parseGapValue(undefined)).toEqual({ row: 0, column: 0 });
  });

  it("gap shorthand 1값 — row/column 동일", () => {
    expect(parseGapValue({ gap: 8 })).toEqual({ row: 8, column: 8 });
    expect(parseGapValue({ gap: "12px" })).toEqual({ row: 12, column: 12 });
  });

  it("gap shorthand 2값 — row / column", () => {
    expect(parseGapValue({ gap: "8px 16px" })).toEqual({ row: 8, column: 16 });
  });

  it("rowGap / columnGap longhand", () => {
    expect(parseGapValue({ rowGap: 4, columnGap: 12 })).toEqual({
      row: 4,
      column: 12,
    });
  });

  it("longhand 가 shorthand override", () => {
    expect(
      parseGapValue({
        gap: "8px 16px",
        rowGap: 99,
      }),
    ).toEqual({ row: 99, column: 16 });
  });

  it("fallback 적용", () => {
    expect(parseGapValue(undefined, 12)).toEqual({ row: 12, column: 12 });
    expect(parseGapValue({}, 12)).toEqual({ row: 12, column: 12 });
    expect(parseGapValue({ rowGap: 4 }, 12)).toEqual({ row: 4, column: 12 });
  });

  it("잘못된 값 → fallback 또는 0", () => {
    expect(parseGapValue({ gap: "auto" }, 8)).toEqual({ row: 8, column: 8 });
    expect(parseGapValue({ gap: "auto" })).toEqual({ row: 0, column: 0 });
  });
});
