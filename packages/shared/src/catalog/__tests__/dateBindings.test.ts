import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import {
  getCatalogCutoverTypes,
  getCatalogEntry,
  getCatalogSkiaCutoverTypes,
} from "../componentCatalog";
import { toRacProps } from "../outputs/toRacProps";

/**
 * ADR-142 family ⑦(date) — Calendar/RangeCalendar/DatePicker/DateRangePicker 계약 검증.
 *
 * composition wrapper(날짜 grid / Popover 합성, internal source).
 * **ADR-912 단계 5 (1b) + step 1 (2026-06-04) — Skia generic 발효 (skiaLegacy 0건)**: 날짜
 * grid(6주×7일)/trigger field 는 skiaPrimitive escape 로 재현(Calendar/RangeCalendar=calendar_grid,
 * DatePicker/DateRangePicker=datefield_trigger). DOM·Skia 게이트 모두 발효.
 * **color(TailSwatch/ColorPicker/ColorArea 등) 제외**: 사용자 지시("TailSwatch 는 패스해") —
 * arc/wheel/gradient skiaPrimitive 설계 필요 영역, 별도 처리.
 */

const DATE_TYPES = [
  "Calendar",
  "RangeCalendar",
  "DatePicker",
  "DateRangePicker",
] as const;

/** date 4 의 skiaPrimitive escape key (단계 5 (1b)). */
const DATE_SKIA_PRIMITIVE: Record<string, string> = {
  Calendar: "calendar_grid",
  RangeCalendar: "calendar_grid",
  DatePicker: "datefield_trigger",
  DateRangePicker: "datefield_trigger",
};

describe("family ⑦ date — catalog 등록 + Skia generic 발효", () => {
  it("date 4 가 catalog primitive entry (family=date-color, cutover=catalog, skiaLegacy 0건)", () => {
    for (const type of DATE_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
      expect(entry?.family).toBe("date-color");
      expect((entry as { cutover?: string } | undefined)?.cutover).toBe(
        "catalog",
      );
      expect(
        (entry as { skiaLegacy?: boolean })?.skiaLegacy,
        `${type} skiaLegacy undefined`,
      ).toBeUndefined();
    }
  });

  it("DOM·Skia 게이트 모두 date 4 포함 (단계 5 (1b) escape 발효)", () => {
    const domGate = getCatalogCutoverTypes();
    const skiaGate = getCatalogSkiaCutoverTypes();
    for (const type of DATE_TYPES) {
      expect(domGate.has(type), `${type} in DOM gate`).toBe(true);
      expect(skiaGate.has(type), `${type} in Skia gate`).toBe(true);
    }
  });

  it("date binding 은 internal source + skiaPrimitive escape (calendar_grid / datefield_trigger)", () => {
    for (const type of DATE_TYPES) {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} source`).toBe("internal");
      expect(binding?.skiaPrimitive, `${type} skiaPrimitive escape`).toBe(
        DATE_SKIA_PRIMITIVE[type],
      );
    }
  });

  it("color(TailSwatch/ColorPicker/ColorWheel)는 catalog 미등록 (사용자 지시 제외)", () => {
    expect(getCatalogEntry("TailSwatch")).toBeUndefined();
    expect(getCatalogEntry("ColorPicker")).toBeUndefined();
    expect(getCatalogEntry("ColorWheel")).toBeUndefined();
  });

  it("toRacProps: Calendar variant/size data-* 라우팅", () => {
    const result = toRacProps(
      {
        id: "cal1",
        type: "Calendar",
        props: { variant: "accent", size: "lg" },
      },
      getPrimitiveBinding("Calendar")!,
    );
    expect(result["data-variant"]).toBe("accent");
    expect(result["data-size"]).toBe("lg");
  });

  it("toRacProps: DatePicker label/showCalendarIcon 통과 + size default", () => {
    const result = toRacProps(
      {
        id: "dp1",
        type: "DatePicker",
        props: { label: "Birthday", showCalendarIcon: true },
      },
      getPrimitiveBinding("DatePicker")!,
    );
    expect(result.label).toBe("Birthday");
    expect(result.showCalendarIcon).toBe(true);
    expect(result["data-size"]).toBe("md");
  });
});
