import { describe, expect, it } from "vitest";

import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * ADR-912 SliderTrack value-fill (value-fill 4 완결) — `slider_fill_bar` escape 회귀 게이트.
 *
 * SliderTrack catalog 발효(slider_fill_bar replace) 후 Skia 시각 불변식 검증:
 *   track 배경 + value 채움 막대 + thumb 핸들(single 1 / range 2)을 자체 생성.
 *
 * **value_fill_bar(Progress/Meter)와 다른 점**: thumb(원+border)를 그리고, layout box=thumbSize
 *   (thumb 컨테이너)라 replace 모드. `_hasChildren=true`(SliderThumb 자식)여도 dead 분기 우회.
 *
 * 좌표 = SliderTrack.spec.render.shapes 1:1: trackY=(thumbSize-trackHeight)/2,
 *   thumb x=width*percent/100, y=thumbSize/2, radius=thumbSize/2.
 */

// SliderTrack rule.sizes.md 미러 (thumbSize 18 / trackHeight 8).
const sizeMd: SizeSpec = {
  height: 8,
  thumbSize: 18,
  paddingX: 0,
  paddingY: 0,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.none}" as never,
};

// SliderTrack rule.variants.default 미러 (track base neutral-subtle / fillBar accent).
const visual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.neutral-subtle}" as never,
      hover: "{color.neutral-subtle}" as never,
      pressed: "{color.neutral-subtle}" as never,
    },
  },
  fillBar: "{color.accent}" as never,
  text: "{color.neutral}" as never,
} as ComponentVisualRule;

const draw = getSkiaPrimitive("slider_fill_bar")!;

function byId(shapes: Shape[], id: string): Shape | undefined {
  return shapes.find((s) => (s as { id?: string }).id === id);
}
function circles(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "circle");
}

describe("skiaPrimitive 'slider_fill_bar' — SliderTrack value-fill (ADR-912)", () => {
  it("registry 에 replace 모드로 등록 (track box 자체 생성, buildCatalogShapes box 대체)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("slider_fill_bar")).toBe("replace");
  });

  it("single value — track + fill + thumb 1개 + thumb border", () => {
    const shapes = draw({
      props: { value: 50, minValue: 0, maxValue: 100, _containerWidth: 200 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect(byId(shapes, "track")).toBeDefined();
    expect(byId(shapes, "fill")).toBeDefined();
    // single → thumb id "thumb", circle 1개 + border 1개.
    expect(byId(shapes, "thumb")).toBeDefined();
    expect(circles(shapes)).toHaveLength(1);
    expect(shapes.filter((s) => s.type === "border")).toHaveLength(1);
  });

  it("track 배경 = neutral-subtle, fill/thumb = accent (rule fillBar)", () => {
    const shapes = draw({
      props: { value: 50, minValue: 0, maxValue: 100, _containerWidth: 200 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((byId(shapes, "track") as { fill?: string }).fill).toBe(
      "{color.neutral-subtle}",
    );
    expect((byId(shapes, "fill") as { fill?: string }).fill).toBe(
      "{color.accent}",
    );
    expect((byId(shapes, "thumb") as { fill?: string }).fill).toBe(
      "{color.accent}",
    );
  });

  it("thumb 좌표 = spec 1:1 (x=width*p/100, y=thumbSize/2, radius=thumbSize/2)", () => {
    const shapes = draw({
      props: { value: 50, minValue: 0, maxValue: 100, _containerWidth: 200 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const thumb = byId(shapes, "thumb") as {
      x?: number;
      y?: number;
      radius?: number;
    };
    expect(thumb.x).toBe(100); // 200 * 50 / 100
    expect(thumb.y).toBe(9); // thumbSize 18 / 2
    expect(thumb.radius).toBe(9);
  });

  it("track 세로 중앙 오프셋 trackY=(thumbSize-trackHeight)/2", () => {
    const shapes = draw({
      props: { value: 50, _containerWidth: 200 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    // trackY = (18 - 8) / 2 = 5
    expect((byId(shapes, "track") as { y?: number }).y).toBe(5);
    expect((byId(shapes, "fill") as { y?: number }).y).toBe(5);
  });

  it("range value [20,80] — thumb 2개 (thumb-0 / thumb-1) + fill 구간 채움", () => {
    const shapes = draw({
      props: {
        value: [20, 80],
        minValue: 0,
        maxValue: 100,
        _containerWidth: 200,
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect(circles(shapes)).toHaveLength(2);
    expect(byId(shapes, "thumb-0")).toBeDefined();
    expect(byId(shapes, "thumb-1")).toBeDefined();
    // range fill: x0 = 200*20/100 = 40, width = (80-20)% = 200*60/100 = 120.
    const fill = byId(shapes, "fill") as { x?: number; width?: number };
    expect(fill.x).toBe(40);
    expect(fill.width).toBe(120);
  });

  it("_hasChildren=true 여도 그린다 (value_fill_bar dead 분기 우회 — SliderThumb 자식 항상 존재)", () => {
    const shapes = draw({
      props: { value: 50, _containerWidth: 200, _hasChildren: true },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    // value_fill_bar 라면 _hasChildren 으로 [] 반환 → slider_fill_bar 는 track+fill+thumb 생성.
    expect(shapes.length).toBeGreaterThan(0);
    expect(byId(shapes, "track")).toBeDefined();
    expect(byId(shapes, "thumb")).toBeDefined();
  });

  it("min/max 정규화 — minValue 50 maxValue 150 value 100 → percent 50%", () => {
    const shapes = draw({
      props: { value: 100, minValue: 50, maxValue: 150, _containerWidth: 200 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    // (100-50)/(150-50) = 50% → thumb x = 200*50/100 = 100, fill width = 100.
    expect((byId(shapes, "thumb") as { x?: number }).x).toBe(100);
    expect((byId(shapes, "fill") as { width?: number }).width).toBe(100);
  });

  it("value=0 → fill 미생성(width 0), thumb 는 x=0 에 생성", () => {
    const shapes = draw({
      props: { value: 0, minValue: 0, maxValue: 100, _containerWidth: 200 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect(byId(shapes, "fill")).toBeUndefined();
    expect((byId(shapes, "thumb") as { x?: number }).x).toBe(0);
  });

  it("style.color override 가 fillBar 보다 우선 (사용자 색)", () => {
    const shapes = draw({
      props: { value: 50, _containerWidth: 200 },
      size: sizeMd,
      visual,
      style: { color: "{color.positive}" },
    })!;
    expect((byId(shapes, "fill") as { fill?: string }).fill).toBe(
      "{color.positive}",
    );
    expect((byId(shapes, "thumb") as { fill?: string }).fill).toBe(
      "{color.positive}",
    );
  });
});
