import { describe, expect, it } from "vitest";

import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * ADR-912 (A/2D) CalendarGrid value — `calendar_month_grid` escape 회귀 게이트.
 *
 * CalendarGrid catalog 발효(calendar_month_grid replace) 후 Skia 시각 불변식 검증:
 *   요일 헤더 7 text + 날짜 셀 text(totalDays) + today circle dot 를 자체 생성(nav 없음).
 *
 * **calendar_grid(Calendar 부모, nav 포함)와 다른 점**: nav(chevron + 월/년 title) 미생성 —
 *   nav 는 CalendarHeader 자식(inline_icon_text)이 담당. 좌표 = CalendarGrid.spec.ts:132-233 1:1.
 *
 * 좌표: cellSize=iconSize+4, weekdayY=cellSize/2, gridStartY=cellSize,
 *   day x=col*(cellSize+gap), y=gridStartY+row*(cellSize+gap)+cellSize/2,
 *   today circle x=cellCenter, y=cy+cellSize/2-4, radius:3.
 */

// CalendarGrid rule.sizes.md 미러 (iconSize 26 / gap 6 → cellSize 30).
const sizeMd: SizeSpec = {
  height: 0,
  iconSize: 26,
  gap: 6,
  paddingX: 0,
  paddingY: 0,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.none}" as never,
};

// CalendarGrid rule.variants.default 미러 (text neutral / transparent fill).
const visual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.transparent}" as never,
      hover: "{color.transparent}" as never,
      pressed: "{color.transparent}" as never,
    },
  },
  text: "{color.neutral}" as never,
  border: "{color.transparent}" as never,
} as ComponentVisualRule;

const draw = getSkiaPrimitive("calendar_month_grid")!;

function texts(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "text");
}
function circles(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "circle");
}

describe("skiaPrimitive 'calendar_month_grid' — CalendarGrid value-fill (ADR-912 A/2D)", () => {
  it("registry 에 replace 모드로 등록 (2D grid box 자체 생성, buildCatalogShapes box 대체)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("calendar_month_grid")).toBe("replace");
  });

  it("nav 미생성 — chevron icon_font / nav title 없음 (calendar_grid 부모와 차이)", () => {
    const shapes = draw({
      props: { dayOffset: 1, totalDays: 31 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    // calendar_grid(부모)는 icon_font(chevron-left/right) 2개를 생성하지만 calendar_month_grid 는 0.
    expect(shapes.filter((s) => s.type === "icon_font")).toHaveLength(0);
  });

  it("요일 헤더 7 text + 날짜 셀 31 text (totalDays=31, today 미표시)", () => {
    const shapes = draw({
      props: { dayOffset: 1, totalDays: 31 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    // weekday 7 + day 31 = 38 text.
    expect(texts(shapes)).toHaveLength(38);
    // today 미표시(defaultToday 미설정) → circle 0.
    expect(circles(shapes)).toHaveLength(0);
  });

  it("defaultToday=true + todayDate → today circle dot 1개 (radius 3 accent)", () => {
    const shapes = draw({
      props: {
        dayOffset: 1,
        totalDays: 31,
        defaultToday: true,
        todayDate: 15,
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const c = circles(shapes);
    expect(c).toHaveLength(1);
    expect((c[0] as { radius?: number }).radius).toBe(3);
    expect((c[0] as { fill?: string }).fill).toBe("{color.accent}");
  });

  it("요일 헤더 y = cellSize/2 (cellSize=iconSize+4=30 → weekdayY=15)", () => {
    const shapes = draw({
      props: { dayOffset: 1, totalDays: 31 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    // 첫 7 text 가 요일 헤더 (y=15 모두 동일).
    const weekdayTexts = texts(shapes).slice(0, 7);
    weekdayTexts.forEach((t) => {
      expect((t as { y?: number }).y).toBe(15);
    });
  });

  it("날짜 셀 좌표 = DOM 셀 모델 1:1 (cellBox=cellSize+4, day 1 dayOffset=1 → col=1 row=0)", () => {
    const shapes = draw({
      props: { dayOffset: 1, totalDays: 31 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    // ADR-151 B1 (2026-07-16): gap 모델 → DOM `td { padding: 2px }` 셀 모델.
    //   cellBox = cellSize + CELL_PAD*2 = 34. day 1: idx=0+1=1 → col=1, row=0.
    //   cellLeft = 1*34 + 2 = 36. gridStartY=cellSize=30. cy = 30 + 0*34 + 2 + 30/2 = 47.
    const day1 = texts(shapes).find(
      (t) => (t as { text?: string }).text === "1",
    );
    expect(day1).toBeDefined();
    expect((day1 as { x?: number }).x).toBe(36);
    expect((day1 as { y?: number }).y).toBe(47);
  });

  it("today 날짜 text 는 fontWeight 700 (강조), 비-today 는 400", () => {
    const shapes = draw({
      props: {
        dayOffset: 1,
        totalDays: 31,
        defaultToday: true,
        todayDate: 15,
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const day15 = texts(shapes).find(
      (t) => (t as { text?: string }).text === "15",
    );
    const day14 = texts(shapes).find(
      (t) => (t as { text?: string }).text === "14",
    );
    expect((day15 as { fontWeight?: number }).fontWeight).toBe(700);
    expect((day14 as { fontWeight?: number }).fontWeight).toBe(400);
  });

  it("날짜 text 색 = rule visual.text (neutral), 요일 = neutral-subdued", () => {
    const shapes = draw({
      props: { dayOffset: 1, totalDays: 31 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const weekday0 = texts(shapes)[0];
    const day1 = texts(shapes).find(
      (t) => (t as { text?: string }).text === "1",
    );
    expect((weekday0 as { fill?: string }).fill).toBe(
      "{color.neutral-subdued}",
    );
    expect((day1 as { fill?: string }).fill).toBe("{color.neutral}");
  });

  it("28일 월(dayOffset=0, totalDays=28) — 날짜 셀 28 text", () => {
    const shapes = draw({
      props: { dayOffset: 0, totalDays: 28 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    // weekday 7 + day 28 = 35 text.
    expect(texts(shapes)).toHaveLength(35);
  });
});
