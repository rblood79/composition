import { describe, expect, it, vi } from "vitest";
import {
  CalendarDate,
  CalendarDateTime,
  ZonedDateTime,
} from "@internationalized/date";
import { safeParseDateString } from "../core/dateUtils";

describe("safeParseDateString", () => {
  it("preserves the date kind instead of parsing all ISO values as CalendarDate", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(safeParseDateString("2026-11-06")).toBeInstanceOf(CalendarDate);
      const local = safeParseDateString("2026-11-06T00:00:00");
      expect(local).toBeInstanceOf(CalendarDateTime);
      expect(local?.toString()).toBe("2026-11-06T00:00:00");
      expect(safeParseDateString("2026-11-06T10:30:15.5Z")).toBeInstanceOf(
        ZonedDateTime,
      );
      expect(
        safeParseDateString(
          "2026-11-06T10:30:15.5+09:00[Asia/Seoul]",
        )?.toString(),
      ).toBe("2026-11-06T10:30:15.5+09:00[Asia/Seoul]");
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("returns no calendar value for time-only, invalid or DST-invalid ISO", () => {
    expect(safeParseDateString("10:30:15")).toBeNull();
    expect(safeParseDateString("2026-02-30")).toBeNull();
    expect(
      safeParseDateString("2026-03-08T02:30[America/New_York]"),
    ).toBeNull();
    expect(safeParseDateString(null)).toBeNull();
  });
});
