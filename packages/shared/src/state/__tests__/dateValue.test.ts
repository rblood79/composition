import { describe, expect, it } from "vitest";
import { CalendarDate, Time } from "@internationalized/date";
import { dateValueToText, isDateValueText, parseDateValue } from "../dateValue";

/** The `date` variable type (2026-10-29): one type, the ISO text's shape says its precision. */
describe("dateValue", () => {
  it("parses each ISO shape to RAC's value of it", () => {
    expect(parseDateValue("2026-10-29")?.kind).toBe("date");
    expect(parseDateValue("2026-10-29T10:30")?.kind).toBe("dateTime");
    expect(parseDateValue("2026-10-29T10:30:00")?.kind).toBe("dateTime");
    expect(parseDateValue("10:30")?.kind).toBe("time");
    expect(parseDateValue("10:30:15.5")?.kind).toBe("time");
    expect(parseDateValue("2026-10-29T10:30:00Z")?.kind).toBe("zoned");
    expect(parseDateValue("2026-10-29T10:30:00+09:00")?.kind).toBe("zoned");
    expect(parseDateValue("2026-10-29T10:30[Asia/Seoul]")?.kind).toBe("zoned");
    expect(parseDateValue("2026-10-29")?.value.toString()).toBe("2026-10-29");
  });

  it("rejects what is no date text", () => {
    for (const text of [
      "",
      "hello",
      "2026-13-01",
      "25:00",
      "2026-10-29T",
      "20261029",
    ])
      expect(parseDateValue(text)).toBeUndefined();
    expect(isDateValueText("")).toBe(true);
    expect(isDateValueText("2026-10-29")).toBe(true);
    expect(isDateValueText("hello")).toBe(false);
    expect(isDateValueText(20261029)).toBe(false);
    expect(isDateValueText(null)).toBe(false);
  });

  it("writes a runtime date as its text", () => {
    expect(dateValueToText(new CalendarDate(2026, 10, 29))).toBe("2026-10-29");
    expect(dateValueToText(new Time(10, 30))).toBe("10:30:00");
    expect(dateValueToText(new Date(Date.UTC(2026, 9, 29, 1, 2, 3)))).toBe(
      "2026-10-29T01:02:03.000Z",
    );
    expect(dateValueToText(" 2026-10-29 ")).toBe("2026-10-29");
    expect(dateValueToText("hello")).toBe("");
    expect(dateValueToText(null)).toBe("");
    expect(dateValueToText({ a: 1 })).toBe("");
  });
});
