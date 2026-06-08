import { describe, expect, it } from "vitest";

import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * ADR-912 deletion-risk(date) DateInput value — `datefield_segments` escape 회귀 게이트.
 *
 * DateInput catalog 발효(datefield_segments replace) 후 Skia 시각 불변식 검증:
 *   input box + border + 세그먼트 placeholder text(+picker 일 때 후행 calendar icon)를 자체 생성.
 *
 * **datefield_trigger(부모 picker 가 그리는 trigger field, 자식 없을 때)와 다른 점**: datefield_segments
 *   는 **자식 DateInput element 자신** 이 그리는 입력 box+segment placeholder. `_parentTag` 4종 분기:
 *   DateField/TimeField(segment) / DatePicker/DateRangePicker(picker icon 포함).
 *
 * 좌표/text = DateInput.spec.ts:218-331 render.shapes 1:1 이식(spec-free).
 */

// DateInput rule.sizes.md 미러 (height 30, fontSize text-sm).
const sizeMd: SizeSpec = {
  height: 30,
  paddingX: 12,
  paddingY: 4,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.md}" as never,
  gap: 0,
};

// DateInput rule.variants.default 미러 (text neutral / border / layer-2 fill).
const visual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.layer-2}" as never,
      hover: "{color.layer-2}" as never,
      pressed: "{color.layer-2}" as never,
    },
  },
  text: "{color.neutral}" as never,
  border: "{color.border}" as never,
} as ComponentVisualRule;

const draw = getSkiaPrimitive("datefield_segments")!;

function texts(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "text");
}
function icons(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "icon_font");
}
function rects(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "roundRect");
}
function borders(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "border");
}

describe("skiaPrimitive 'datefield_segments' — DateInput value-fill (ADR-912 deletion-risk date)", () => {
  it("registry 에 replace 모드로 등록 (input box+segment 자체 생성, buildCatalogShapes box 대체)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("datefield_segments")).toBe("replace");
  });

  it("DateField(기본) — box + border + segment text 3 shape, picker icon 없음", () => {
    const shapes = draw({
      props: { _parentTag: "DateField", _granularity: "day", _locale: "en-US" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect(rects(shapes)).toHaveLength(1); // input-bg
    expect(borders(shapes)).toHaveLength(1);
    expect(texts(shapes)).toHaveLength(1); // segment placeholder
    expect(icons(shapes)).toHaveLength(0); // DateField 는 picker icon 없음
  });

  it("DateField en-US segment text = 'MM / DD / YYYY'", () => {
    const shapes = draw({
      props: { _parentTag: "DateField", _granularity: "day", _locale: "en-US" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((texts(shapes)[0] as { text?: string }).text).toBe("MM / DD / YYYY");
  });

  it("locale 분기 — ko(아시아) = 'YYYY / MM / DD', de(유럽) = 'DD / MM / YYYY'", () => {
    const ko = draw({
      props: { _parentTag: "DateField", _granularity: "day", _locale: "ko-KR" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const de = draw({
      props: { _parentTag: "DateField", _granularity: "day", _locale: "de-DE" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((texts(ko)[0] as { text?: string }).text).toBe("YYYY / MM / DD");
    expect((texts(de)[0] as { text?: string }).text).toBe("DD / MM / YYYY");
  });

  it("TimeField — 시간 세그먼트 'HH : MM' (날짜 없음)", () => {
    const shapes = draw({
      props: {
        _parentTag: "TimeField",
        _granularity: "minute",
        _locale: "en-US",
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((texts(shapes)[0] as { text?: string }).text).toBe("HH : MM");
  });

  it("TimeField hourCycle=12 second → 'HH : MM : SS  AM'", () => {
    const shapes = draw({
      props: {
        _parentTag: "TimeField",
        _granularity: "second",
        _hourCycle: 12,
        _locale: "en-US",
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((texts(shapes)[0] as { text?: string }).text).toBe(
      "HH : MM : SS  AM",
    );
  });

  it("DatePicker — picker icon(calendar) 1개 추가 (box+border+text+icon = 4 shape)", () => {
    const shapes = draw({
      props: {
        _parentTag: "DatePicker",
        _granularity: "day",
        _locale: "en-US",
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const ic = icons(shapes);
    expect(ic).toHaveLength(1);
    expect((ic[0] as { iconName?: string }).iconName).toBe("calendar");
  });

  it("DateRangePicker — 범위 segment 'MM / DD / YYYY – MM / DD / YYYY' + picker icon", () => {
    const shapes = draw({
      props: {
        _parentTag: "DateRangePicker",
        _granularity: "day",
        _locale: "en-US",
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((texts(shapes)[0] as { text?: string }).text).toBe(
      "MM / DD / YYYY – MM / DD / YYYY",
    );
    expect(icons(shapes)).toHaveLength(1);
  });

  it("box 색 = rule visual.fill base(layer-2), border = visual.border, text = visual.text(neutral)", () => {
    const shapes = draw({
      props: { _parentTag: "DateField", _granularity: "day", _locale: "en-US" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((rects(shapes)[0] as { fill?: string }).fill).toBe(
      "{color.layer-2}",
    );
    expect((borders(shapes)[0] as { color?: string }).color).toBe(
      "{color.border}",
    );
    expect((texts(shapes)[0] as { fill?: string }).fill).toBe(
      "{color.neutral}",
    );
  });

  it("style override — backgroundColor/borderColor/color 사용자 설정 우선", () => {
    const shapes = draw({
      props: {
        _parentTag: "DateField",
        _granularity: "day",
        _locale: "en-US",
        style: {
          backgroundColor: "#fff",
          borderColor: "#f00",
          color: "#00f",
        },
      },
      size: sizeMd,
      visual,
      style: { backgroundColor: "#fff", borderColor: "#f00", color: "#00f" },
    })!;
    expect((rects(shapes)[0] as { fill?: string }).fill).toBe("#fff");
    expect((borders(shapes)[0] as { color?: string }).color).toBe("#f00");
    expect((texts(shapes)[0] as { fill?: string }).fill).toBe("#00f");
  });
});
