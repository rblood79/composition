import { describe, expect, it } from "vitest";

import { CalendarSpec } from "../../components/Calendar.spec";
import { RangeCalendarSpec } from "../../components/RangeCalendar.spec";
import { DatePickerSpec } from "../../components/DatePicker.spec";
import { DateRangePickerSpec } from "../../components/DateRangePicker.spec";
import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";
import type { Shape } from "../../types";

/**
 * ADR-912 단계 5 (1b) date escape parity — date family 의 비-box 시각(6주×7일 날짜 grid /
 * trigger field)을 `calendar_grid` / `datefield_trigger` skiaPrimitive(replace) 가 그린다.
 *
 * **정본 (ADR-912 단계 5 (1b), 2026-06-04)**: spec.render.shapes 의 시각을 draw module 로
 * 1:1 이식(overlay 패턴 동일 — skiaPrimitives.overlay.test.ts). escape 는 spec VariantSpec
 * 대신 보편 rule(resolveComponentVisual 로 spec→visual 동등 생성) + size 를 읽는다(spec-free).
 *
 * 각 draw module 이 legacy render.shapes 출력과 완전 parity 임을 보장한다(회귀 0). 이로써
 * skiaLegacy 제거(isCatalogSkiaCutover=true) 후에도 Skia 가 spec.render.shapes 없이 시각 유지.
 */

const calendarVisual = resolveComponentVisual(
  CalendarSpec as never,
  CalendarSpec.defaultVariant!,
);

/** non-text shape 비교 (text 는 Intl/locale 의존 — 별도 검증). */
function nonText(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type !== "text");
}
function only(shapes: Shape[], ...types: string[]): Shape[] {
  return shapes.filter((s) => types.includes(s.type));
}

describe("skiaPrimitive 'calendar_grid' — Calendar 날짜 grid parity", () => {
  const draw = getSkiaPrimitive("calendar_grid");
  const sizes = ["sm", "md", "lg"] as const;

  it("registry 에 replace 모드로 등록되어 있다(box+text 대체)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("calendar_grid")).toBe("replace");
  });

  for (const size of sizes) {
    it(`standalone/${size} — legacy grid 와 non-text shape parity(bg/border/icon/circle)`, () => {
      const props = { size } as Record<string, unknown>;
      const sizeSpec = CalendarSpec.sizes[size];
      const legacy = nonText(
        CalendarSpec.render.shapes(
          props as Parameters<typeof CalendarSpec.render.shapes>[0],
          sizeSpec,
          "default",
        ),
      );
      const shapes = draw!({
        props,
        size: sizeSpec,
        visual: calendarVisual,
        style: undefined,
      });
      expect(shapes).not.toBeNull();
      expect(nonText(shapes!)).toEqual(legacy);
    });

    it(`standalone/${size} — date cell 수(31 day text + 7 weekday + month) parity`, () => {
      const props = { size, locale: "en-US" } as Record<string, unknown>;
      const sizeSpec = CalendarSpec.sizes[size];
      const legacy = only(
        CalendarSpec.render.shapes(
          props as Parameters<typeof CalendarSpec.render.shapes>[0],
          sizeSpec,
          "default",
        ),
        "text",
      );
      const shapes = draw!({
        props,
        size: sizeSpec,
        visual: calendarVisual,
        style: undefined,
      });
      // month(1) + weekday(7) + day(31) = 39 text shapes
      expect(only(shapes!, "text").length).toBe(legacy.length);
      expect(only(shapes!, "text").length).toBe(39);
    });
  }

  it("_hasChildren=true — shell(bg+border)만, grid 미렌더", () => {
    const props = { size: "md", _hasChildren: true } as Record<string, unknown>;
    const sizeSpec = CalendarSpec.sizes.md;
    const shapes = draw!({
      props,
      size: sizeSpec,
      visual: calendarVisual,
      style: undefined,
    });
    expect(shapes).not.toBeNull();
    // shell = bg(roundRect) + border 만
    expect(shapes!.map((s) => s.type).sort()).toEqual(["border", "roundRect"]);
  });
});

describe("skiaPrimitive 'calendar_grid' — RangeCalendar 동형(...CalendarSpec)", () => {
  const draw = getSkiaPrimitive("calendar_grid");

  it("RangeCalendar.render.shapes 와 non-text parity(시각 동형)", () => {
    const props = { size: "md" } as Record<string, unknown>;
    const sizeSpec = RangeCalendarSpec.sizes.md;
    const legacy = nonText(
      RangeCalendarSpec.render.shapes(
        props as Parameters<typeof RangeCalendarSpec.render.shapes>[0],
        sizeSpec,
        "default",
      ),
    );
    const rangeVisual = resolveComponentVisual(
      RangeCalendarSpec as never,
      RangeCalendarSpec.defaultVariant!,
    );
    const shapes = draw!({
      props,
      size: sizeSpec,
      visual: rangeVisual,
      style: undefined,
    });
    expect(nonText(shapes!)).toEqual(legacy);
  });
});

describe("skiaPrimitive 'datefield_trigger' — DatePicker trigger field parity", () => {
  const draw = getSkiaPrimitive("datefield_trigger");
  const sizes = ["sm", "md", "lg"] as const;

  it("registry 에 replace 모드로 등록되어 있다(box+text 대체)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("datefield_trigger")).toBe("replace");
  });

  for (const size of sizes) {
    it(`DatePicker/${size} — legacy buildDatePickerShapes 와 parity(input-bg/border/text/icon)`, () => {
      const props = { size, locale: "en-US" } as Record<string, unknown>;
      const sizeSpec = DatePickerSpec.sizes[size];
      const legacy = DatePickerSpec.render.shapes(
        props as Parameters<typeof DatePickerSpec.render.shapes>[0],
        sizeSpec,
        "default",
      );
      const shapes = draw!({
        props,
        size: sizeSpec,
        visual: undefined,
        style: undefined,
      });
      expect(shapes).toEqual(legacy);
    });
  }

  it("DateRangePicker — range trigger(폭 320 + 'start – end') parity", () => {
    const props = {
      size: "md",
      locale: "en-US",
      _dateRange: true,
    } as Record<string, unknown>;
    const sizeSpec = DateRangePickerSpec.sizes.md;
    const legacy = DateRangePickerSpec.render.shapes(
      props as Parameters<typeof DateRangePickerSpec.render.shapes>[0],
      sizeSpec,
      "default",
    );
    const shapes = draw!({
      props,
      size: sizeSpec,
      visual: undefined,
      style: undefined,
    });
    // input-bg 폭 320 확인 (range 기본 폭)
    const bg = shapes!.find((s) => s.type === "roundRect");
    expect((bg as { width: number })?.width).toBe(320);
    expect(shapes).toEqual(legacy);
  });

  it("_hasChildren=true — 투명 컨테이너(빈 배열)", () => {
    const props = { size: "md", _hasChildren: true } as Record<string, unknown>;
    const shapes = draw!({
      props,
      size: DatePickerSpec.sizes.md,
      visual: undefined,
      style: undefined,
    });
    expect(shapes).toEqual([]);
  });
});
