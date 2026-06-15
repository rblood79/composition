import { describe, expect, it } from "vitest";

import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * ADR-912 Slider value-fill + thumb — `slider_fill_bar` / `slider_thumb` escape 회귀 게이트.
 *
 * **렌더 소유권 분리 (2026-06-10 → ADR-912 catalog cutover 2026-06-16)**:
 *   - `slider_fill_bar`(SliderTrack, replace) = track 배경 + value 채움 막대 **만**. trackY=0
 *     (box 전체가 트랙, thumb 은 box 밖). thumb 은 더 이상 여기서 안 그린다.
 *   - `slider_thumb`(SliderThumb, replace) = circle 핸들 + border. SliderThumb element 가 자기
 *     box(thumbSize) 안에 그린다. SliderThumb spec→catalog cutover(2026-06-16)로 본 escape 가
 *     기존 SliderThumb.spec.render.shapes(circle + border 2px {color.base})를 1:1 대체.
 *
 * (이전: slider_fill_bar 가 thumb 까지 그렸음 — 2026-06-10 SliderTrack→SliderThumb 이전 전.)
 */

// SliderTrack rule.sizes.md 미러 (trackHeight 8).
const trackSizeMd: SizeSpec = {
  height: 8,
  thumbSize: 18,
  paddingX: 0,
  paddingY: 0,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.none}" as never,
};

// SliderTrack rule.variants.default 미러 (track base neutral-subtle / fillBar accent).
const trackVisual: ComponentVisualRule = {
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

// SliderThumb rule.sizes.md 미러 (지름 18 = Slider.indicator.thumbSize SSOT).
const thumbSizeMd: SizeSpec = {
  height: 18,
  paddingX: 0,
  paddingY: 0,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.full}" as never,
};

// SliderThumb rule.variants.default 미러 (circle fill accent).
const thumbVisual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.accent}" as never,
    },
  },
  text: "{color.neutral}" as never,
} as ComponentVisualRule;

const drawFill = getSkiaPrimitive("slider_fill_bar")!;
const drawThumb = getSkiaPrimitive("slider_thumb")!;

function byId(shapes: Shape[], id: string): Shape | undefined {
  return shapes.find((s) => (s as { id?: string }).id === id);
}
function circles(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "circle");
}

describe("skiaPrimitive 'slider_fill_bar' — SliderTrack value-fill (ADR-912)", () => {
  it("registry 에 replace 모드로 등록 (track box 자체 생성, buildCatalogShapes box 대체)", () => {
    expect(drawFill).toBeDefined();
    expect(getSkiaPrimitiveMode("slider_fill_bar")).toBe("replace");
  });

  it("single value — track + fill 만 (thumb 은 slider_thumb 가 담당, 여기서 안 그림)", () => {
    const shapes = drawFill({
      props: { value: 50, minValue: 0, maxValue: 100, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    expect(byId(shapes, "track")).toBeDefined();
    expect(byId(shapes, "fill")).toBeDefined();
    // 2026-06-10 이후: thumb 소유권 이전 → slider_fill_bar 는 thumb/circle 미생성.
    expect(byId(shapes, "thumb")).toBeUndefined();
    expect(circles(shapes)).toHaveLength(0);
  });

  it("track 배경 = neutral-subtle, fill = accent (rule fillBar)", () => {
    const shapes = drawFill({
      props: { value: 50, minValue: 0, maxValue: 100, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    expect((byId(shapes, "track") as { fill?: string }).fill).toBe(
      "{color.neutral-subtle}",
    );
    expect((byId(shapes, "fill") as { fill?: string }).fill).toBe(
      "{color.accent}",
    );
  });

  it("track = box 전체 (trackY=0, height=trackHeight) — thumb 은 box 밖", () => {
    const shapes = drawFill({
      props: { value: 50, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    // 2026-06-10: layout box height = trackHeight(8) → 트랙은 box 전체(trackY=0).
    expect((byId(shapes, "track") as { y?: number }).y).toBe(0);
    expect((byId(shapes, "fill") as { y?: number }).y).toBe(0);
    expect((byId(shapes, "track") as { height?: number }).height).toBe(8);
  });

  it("range value [20,80] — fill 구간 채움 (thumb 없음)", () => {
    const shapes = drawFill({
      props: {
        value: [20, 80],
        minValue: 0,
        maxValue: 100,
        _containerWidth: 200,
      },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    // range fill: x0 = 200*20/100 = 40, width = (80-20)% = 200*60/100 = 120.
    const fill = byId(shapes, "fill") as { x?: number; width?: number };
    expect(fill.x).toBe(40);
    expect(fill.width).toBe(120);
    // thumb 은 slider_fill_bar 소관 아님.
    expect(circles(shapes)).toHaveLength(0);
  });

  it("min/max 정규화 — minValue 50 maxValue 150 value 100 → percent 50% (fill width)", () => {
    const shapes = drawFill({
      props: { value: 100, minValue: 50, maxValue: 150, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    // (100-50)/(150-50) = 50% → fill width = 200*50/100 = 100.
    expect((byId(shapes, "fill") as { width?: number }).width).toBe(100);
  });

  it("value=0 → fill 미생성 (width 0)", () => {
    const shapes = drawFill({
      props: { value: 0, minValue: 0, maxValue: 100, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    expect(byId(shapes, "fill")).toBeUndefined();
  });

  it("style.color override 가 fillBar 보다 우선 (사용자 색)", () => {
    const shapes = drawFill({
      props: { value: 50, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: { color: "{color.positive}" },
    })!;
    expect((byId(shapes, "fill") as { fill?: string }).fill).toBe(
      "{color.positive}",
    );
  });
});

describe("skiaPrimitive 'slider_thumb' — SliderThumb 핸들 (ADR-912 cutover 2026-06-16)", () => {
  it("registry 에 replace 모드로 등록 (circle 전체 외형, buildCatalogShapes box 대체)", () => {
    expect(drawThumb).toBeDefined();
    expect(getSkiaPrimitiveMode("slider_thumb")).toBe("replace");
  });

  it("circle 핸들 + border (spec render.shapes 1:1 — radius=size.height/2, border 2px {color.base})", () => {
    const shapes = drawThumb({
      props: {},
      size: thumbSizeMd,
      visual: thumbVisual,
      style: undefined,
    })!;
    expect(shapes.map((s) => s.type)).toEqual(["circle", "border"]);
    const thumb = byId(shapes, "thumb") as { radius?: number; fill?: string };
    expect(thumb.radius).toBe(9); // size.height 18 / 2
    expect(thumb.fill).toBe("{color.accent}"); // rule default fill base
    const border = shapes[1] as {
      target?: string;
      borderWidth?: number;
      color?: string;
      radius?: number;
    };
    expect(border.target).toBe("thumb");
    expect(border.borderWidth).toBe(2);
    expect(border.color).toBe("{color.base}");
    expect(border.radius).toBe(9);
  });

  it("지름 = size.height (Slider.indicator.thumbSize SSOT 14/18/22/26)", () => {
    const radiusFor = (height: number) => {
      const shapes = drawThumb({
        props: {},
        size: { ...thumbSizeMd, height },
        visual: thumbVisual,
        style: undefined,
      })!;
      return (byId(shapes, "thumb") as { radius?: number }).radius;
    };
    expect(radiusFor(14)).toBe(7); // sm
    expect(radiusFor(18)).toBe(9); // md
    expect(radiusFor(22)).toBe(11); // lg
    expect(radiusFor(26)).toBe(13); // xl
  });

  it("style.backgroundColor override 가 rule fill 보다 우선 (사용자 색)", () => {
    const shapes = drawThumb({
      props: {},
      size: thumbSizeMd,
      visual: thumbVisual,
      style: { backgroundColor: "{color.positive}" },
    })!;
    expect((byId(shapes, "thumb") as { fill?: string }).fill).toBe(
      "{color.positive}",
    );
  });

  it("size.height 누락 시 18 fallback (md thumbSize)", () => {
    const shapes = drawThumb({
      props: {},
      size: { ...thumbSizeMd, height: undefined as unknown as number },
      visual: thumbVisual,
      style: undefined,
    })!;
    expect((byId(shapes, "thumb") as { radius?: number }).radius).toBe(9);
  });
});
