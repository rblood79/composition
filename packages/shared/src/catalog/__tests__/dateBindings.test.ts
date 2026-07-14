import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import { getCatalogCutoverTypes, getCatalogEntry } from "../componentCatalog";
import { toRacProps } from "../outputs/toRacProps";

/**
 * ADR-142 family ⑦(date) — Calendar/RangeCalendar/DatePicker/DateRangePicker 계약 검증.
 *
 * composition wrapper(날짜 grid / Popover 합성, internal source).
 * **ADR-912 단계 5 (1b) + step 1 (2026-06-04) — Skia generic 발효 (skiaLegacy 0건)**: 날짜
 * grid(6주×7일)/trigger field 는 skiaPrimitive escape 로 재현(Calendar/RangeCalendar=calendar_grid,
 * DatePicker/DateRangePicker=datefield_trigger). DOM·Skia 게이트 모두 발효.
 * **color leaf 5종 box-only cutover (사용자 방침 2026-06-11)**: ColorSwatch/ColorArea/ColorWheel/
 * ColorSlider/TailSwatch 는 box-only catalog cutover 로 전환됨(colorLeafCutover.test.ts). arc/wheel/
 * gradient 정교 시각은 빌더 완성 후 ProgressCircle 구조로 복원 — 지금은 generic box(의도적 손실).
 * container(ColorPicker/ColorSwatchPicker)는 2026-06-17 shell-only container slice 로 cutover.
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

  it("cutover 게이트가 date 4 포함 (단계 5 (1b) escape 발효)", () => {
    const gate = getCatalogCutoverTypes();
    for (const type of DATE_TYPES) {
      expect(gate.has(type), `${type} in cutover gate`).toBe(true);
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

  it("color container(ColorPicker/ColorSwatchPicker)는 catalog 등록", () => {
    // 사용자 방침 2026-06-11: color leaf 5종(ColorSwatch/Area/Wheel/Slider/TailSwatch)은 box-only
    // catalog cutover 로 등록됨(colorLeafCutover.test.ts). container 도 shell-only slice 로 cutover.
    expect(getCatalogEntry("ColorPicker")).toBeDefined();
    expect(getCatalogEntry("ColorSwatchPicker")).toBeDefined();
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

  // 회귀 방지 (2026-07-14, 사용자 적발): DatePicker size 를 바꿔도 **CSS(Preview) 가 미반영**.
  //   `toRacProps` 는 size(kind:"size")를 기본적으로 `data-size` 속성으로만 라우팅하는데,
  //   DatePicker/DateRangePicker 는 source=internal — composition wrapper(DatePicker.tsx)가
  //   **size 를 React prop 으로 직접 소비**하고(하위 Label/DateInput/Button 크기 결정)
  //   `{...props}` **뒤에** 자기 `data-size={size}` 를 다시 쓴다. 따라서 passthrough 가 없으면
  //   (1) wrapper 의 size 가 undefined → default "md" 고정, (2) 그 "md" 가 toRacProps 의
  //   `data-size="lg"` 까지 **덮어써** CSS selector 가 영원히 md 로 매칭된다.
  //   ProgressCircle/Avatar/StatusLight 선례 동형.
  describe("size passthrough — wrapper 가 size 를 React prop 으로 소비하는 internal 컴포넌트", () => {
    const PASSTHROUGH_TYPES = ["DatePicker", "DateRangePicker"] as const;

    it.each(PASSTHROUGH_TYPES)(
      "%s binding 은 propPassthrough 에 size 를 포함한다",
      (type) => {
        const binding = getPrimitiveBinding(type)!;
        expect(binding.props.propPassthrough).toContain("size");
      },
    );

    it.each(PASSTHROUGH_TYPES)(
      "%s toRacProps: size 가 React prop + data-size 둘 다 emit",
      (type) => {
        const result = toRacProps(
          { id: "n1", type, props: { size: "xl" } },
          getPrimitiveBinding(type)!,
        );
        // React prop — wrapper 가 이걸 못 받으면 default("md") 로 고정된다
        expect(result.size).toBe("xl");
        // data-* — CSS selector(.react-aria-DatePicker[data-size="xl"]) 매칭용
        expect(result["data-size"]).toBe("xl");
      },
    );
  });
});
