import { describe, expect, it } from "vitest";

// ADR-912 단계5 step4 date-color (2026-06-16): Calendar/RangeCalendarSpec import 제거 — spec 삭제.
//   calendar_grid draw fn 은 이미 spec-free(visual+size 만 읽음) → spec.render.shapes oracle 대신
//   rule-mirror visual + draw fn 자기-출력 구조 invariant(shape 종류/개수)로 단언(Tooltip/Popover
//   전환 패턴). RangeCalendar 동형 describe 제거 — draw fn 은 type 무관하게 동일 visual 이면 동일 출력
//   (spec spread 동형 비교 의의 소멸).
// ADR-912 단계5 step4 date-color (2026-06-17): DatePicker/DateRangePicker.spec 물리 삭제 — datefield_trigger
//   oracle 을 추출 모듈(datePickerShapes)의 buildDatePickerShapes + DATE_PICKER_SIZES 직접 호출로 전환.
//   render.shapes 가 buildDatePickerShapes wrapper(displayText 계산 + 호출)였으므로 동등 결과 보장.
import {
  buildDatePickerShapes,
  buildDatePlaceholder,
  DATE_PICKER_SIZES,
} from "../datePickerShapes";
import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import type {
  ComponentVisualRule,
  SizeSpec,
  Shape,
  TokenRef,
} from "../../types";

/**
 * ADR-912 단계 5 (1b) date escape parity — date family 의 비-box 시각(6주×7일 날짜 grid /
 * trigger field)을 `calendar_grid` / `datefield_trigger` skiaPrimitive(replace) 가 그린다.
 *
 * **정본 (ADR-912 단계 5 (1b), 2026-06-04)**: spec.render.shapes 의 시각을 draw module 로
 * 1:1 이식(overlay 패턴 동일 — skiaPrimitives.overlay.test.ts). escape 는 spec VariantSpec
 * 대신 보편 rule(resolveComponentVisual 로 spec→visual 동등 생성) + size 를 읽는다(spec-free).
 *
 * **ADR-912 단계5 step4 date-color (2026-06-16)**: Calendar/RangeCalendar.spec 삭제로 spec oracle
 * 소멸. calendar_grid 는 spec-free draw module 이므로, legacy spec oracle 대신 rule-mirror visual +
 * draw fn 자기-출력 구조 invariant(shape 종류/개수)로 단언.
 */

// rule-mirror visual: componentRulesTable.Calendar default variant fill base.
//   calendar_grid stroke/fill = visual.fill.default[state] + visual.colors.text/border.
const CALENDAR_FILL_BASE = "{color.base}" as TokenRef;
const calendarVisual = {
  fill: { default: { base: CALENDAR_FILL_BASE } },
  colors: { text: "{color.neutral}", border: "{color.border}" },
} as unknown as ComponentVisualRule;

// rule-mirror sizes (componentRulesTable.Calendar.sizes — paddingX/paddingY/gap/iconSize 보강 후).
const ruleSizes: Record<string, SizeSpec> = {
  sm: {
    height: 0,
    paddingX: 4,
    paddingY: 4,
    gap: 4,
    fontSize: "{typography.text-xs}",
    borderRadius: "{radius.md}",
    iconSize: 20,
  } as unknown as SizeSpec,
  md: {
    height: 0,
    paddingX: 8,
    paddingY: 8,
    gap: 6,
    fontSize: "{typography.text-sm}",
    borderRadius: "{radius.lg}",
    iconSize: 26,
  } as unknown as SizeSpec,
  lg: {
    height: 0,
    paddingX: 12,
    paddingY: 12,
    gap: 8,
    fontSize: "{typography.text-base}",
    borderRadius: "{radius.xl}",
    iconSize: 32,
  } as unknown as SizeSpec,
};

/** non-text shape 비교 (text 는 Intl/locale 의존 — 별도 검증). */
function nonText(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type !== "text");
}
function only(shapes: Shape[], ...types: string[]): Shape[] {
  return shapes.filter((s) => types.includes(s.type));
}

describe("skiaPrimitive 'calendar_grid' — Calendar 날짜 grid (spec-free)", () => {
  const draw = getSkiaPrimitive("calendar_grid");
  const sizes = ["sm", "md", "lg"] as const;

  it("registry 에 replace 모드로 등록되어 있다(box+text 대체)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("calendar_grid")).toBe("replace");
  });

  for (const size of sizes) {
    it(`standalone/${size} — non-text shape 구조 invariant(bg/border + grid 요소)`, () => {
      const props = { size } as Record<string, unknown>;
      const shapes = draw!({
        props,
        size: ruleSizes[size],
        visual: calendarVisual,
        style: undefined,
      });
      expect(shapes).not.toBeNull();
      const nt = nonText(shapes!);
      // shell(bg roundRect + border) + nav icon + today circle 등 grid 요소 존재.
      expect(nt.length).toBeGreaterThan(2);
      expect(only(nt, "roundRect").length).toBeGreaterThanOrEqual(1);
      expect(only(nt, "border").length).toBeGreaterThanOrEqual(1);
    });

    it(`standalone/${size} — date cell text 39개(month 1 + weekday 7 + day 31)`, () => {
      const props = { size, locale: "en-US" } as Record<string, unknown>;
      const shapes = draw!({
        props,
        size: ruleSizes[size],
        visual: calendarVisual,
        style: undefined,
      });
      // month(1) + weekday(7) + day(31) = 39 text shapes
      expect(only(shapes!, "text").length).toBe(39);
    });
  }

  it("_hasChildren=true — shell(bg+border)만, grid 미렌더", () => {
    const props = { size: "md", _hasChildren: true } as Record<string, unknown>;
    const shapes = draw!({
      props,
      size: ruleSizes.md,
      visual: calendarVisual,
      style: undefined,
    });
    expect(shapes).not.toBeNull();
    // shell = bg(roundRect) + border 만
    expect(shapes!.map((s) => s.type).sort()).toEqual(["border", "roundRect"]);
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
    it(`DatePicker/${size} — buildDatePickerShapes 와 parity(input-bg/border/text/icon)`, () => {
      const props = { size, locale: "en-US" } as Record<string, unknown>;
      const sizeSpec = DATE_PICKER_SIZES[size];
      // render.shapes wrapper 로직 재현: displayText = value||placeholder||buildDatePlaceholder(locale).
      const legacy = buildDatePickerShapes({
        props: props as unknown as Record<string, unknown>,
        sizeEntry: sizeSpec as unknown as Record<string, unknown>,
        displayText: buildDatePlaceholder("en-US"),
        hasValue: false,
        defaultContainerWidth: 200,
      });
      const shapes = draw!({
        props,
        size: sizeSpec as unknown as SizeSpec,
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
    const sizeSpec = DATE_PICKER_SIZES.md;
    // DateRangePicker render.shapes wrapper 재현: displayText = range placeholder, defaultContainerWidth 320.
    const rangePlaceholder = `${buildDatePlaceholder("en-US")} – ${buildDatePlaceholder("en-US")}`;
    const legacy = buildDatePickerShapes({
      props: props as unknown as Record<string, unknown>,
      sizeEntry: sizeSpec as unknown as Record<string, unknown>,
      displayText: rangePlaceholder,
      hasValue: false,
      defaultContainerWidth: 320,
    });
    const shapes = draw!({
      props,
      size: sizeSpec as unknown as SizeSpec,
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
      size: DATE_PICKER_SIZES.md as unknown as SizeSpec,
      visual: undefined,
      style: undefined,
    });
    expect(shapes).toEqual([]);
  });
});
