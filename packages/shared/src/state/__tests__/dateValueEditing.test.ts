import { describe, expect, it } from "vitest";
import { isDateValueText } from "../dateValue";
import {
  coerceDateText,
  dateValueFromNativeInput,
  nativeDateInputOf,
} from "../dateValueEditing";

describe("lossless date editing", () => {
  const values = [
    "2026-10-29",
    "10:30",
    "10:30:00",
    "10:30:15.500",
    "2026-10-29T10:30",
    "2026-10-29T10:30:00.000Z",
    "2026-10-29T10:30:15.50+09:00",
    "2026-10-29T10:30:15.500[Asia/Seoul]",
    "2026-10-29T10:30:15.500+09:00[Asia/Seoul]",
    "10:30:15.123456789",
    "2026-10-29T10:30:15.123456789Z",
  ];
  it.each(values)("untouched round trip: %s", (value) => {
    expect(
      dateValueFromNativeInput(value, nativeDateInputOf(value).value),
    ).toBe(value);
  });

  it("keeps seconds, fractional digits and the fixed offset while editing minutes", () => {
    expect(
      dateValueFromNativeInput(
        "2026-10-29T10:30:15.500+09:00",
        "2026-10-29T10:31:15.5",
      ),
    ).toBe("2026-10-29T10:31:15.500+09:00");
    expect(dateValueFromNativeInput("10:30:15.5", "10:31")).toBe("10:31:15.5");
    expect(
      dateValueFromNativeInput("2026-10-29T10:30Z", "2026-10-30T10:30"),
    ).toBe("2026-10-30T10:30Z");
  });

  it("preserves the lexical shape after browser normalization and supports editing fractions to zero", () => {
    expect(dateValueFromNativeInput("10:30:00.000", "10:30")).toBe(
      "10:30:00.000",
    );
    expect(dateValueFromNativeInput("10:30:15.500", "10:30:15.5")).toBe(
      "10:30:15.500",
    );
    expect(dateValueFromNativeInput("10:30:15.500", "10:30:15")).toBe(
      "10:30:15.000",
    );
    expect(dateValueFromNativeInput("10:30", "10:31:00")).toBe("10:31");
  });

  it("uses native step for representable precision and exact text beyond milliseconds", () => {
    expect(nativeDateInputOf("10:30").step).toBe(60);
    expect(nativeDateInputOf("10:30:15").step).toBe(1);
    expect(nativeDateInputOf("10:30:15.500").step).toBe(0.001);
    expect(nativeDateInputOf("10:30:15.123456789")).toEqual({
      type: "text",
      value: "10:30:15.123456789",
    });
    expect(nativeDateInputOf("2026-10-29T10:30+09:00").zone).toBe("UTC+09:00");
    expect(nativeDateInputOf("2026-10-29T10:30[Asia/Seoul]").zone).toBe(
      "Asia/Seoul",
    );
  });

  it("keeps IANA zone identity and recalculates its offset when the date crosses seasons", () => {
    expect(
      dateValueFromNativeInput(
        "2026-01-15T10:30:15.500-05:00[America/New_York]",
        "2026-07-15T10:30:15.5",
      ),
    ).toBe("2026-07-15T10:30:15.500-04:00[America/New_York]");
    expect(
      dateValueFromNativeInput(
        "2026-01-15T10:30[America/New_York]",
        "2026-07-15T10:30",
      ),
    ).toBe("2026-07-15T10:30[America/New_York]");
  });

  it("rejects DST gaps and unresolved overlaps, while retaining an explicit side of an overlap", () => {
    for (const value of [
      "2026-03-08T02:30[America/New_York]",
      "2026-11-01T01:30[America/New_York]",
    ]) {
      expect(isDateValueText(value)).toBe(false);
      expect(coerceDateText(value)).toBeUndefined();
    }
    const before = "2026-03-07T02:30-05:00[America/New_York]";
    expect(
      isDateValueText(dateValueFromNativeInput(before, "2026-03-08T02:30")),
    ).toBe(false);
    const overlap = dateValueFromNativeInput(
      "2026-10-31T01:30-04:00[America/New_York]",
      "2026-11-01T01:30",
    );
    expect(overlap).toBe("2026-11-01T01:30-04:00[America/New_York]");
    expect(isDateValueText(overlap)).toBe(true);
  });

  it("keeps invalid ISO dates out of the permissive Date.parse path", () => {
    expect(coerceDateText("2026-02-30")).toBeUndefined();
    expect(coerceDateText("2026-10-29T25:00")).toBeUndefined();
  });
});
