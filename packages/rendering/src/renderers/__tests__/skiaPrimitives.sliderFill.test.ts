import { describe, expect, it } from "vitest";

import { getSkiaPrimitive, getSkiaPrimitiveMode } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * Slider thumb — `slider_thumb` 회귀 게이트 (ADR-256 Phase 7c).
 *
 * SliderThumb 노드가 자기 box (엔진이 RAC 와 같은 값 자리에 absolute 로 둔다 —
 * `catalogSliderThumbLayout`) 중앙에 accent 원 + 2px `{color.base}` 링을 그린다. track · 채움은 각자
 * 노드 (SliderTrack rule · SliderFill) — 옛 `slider_fill_bar` 는 2026-10-09 삭제.
 */

const thumbVisual: ComponentVisualRule = {
  fill: { default: { base: "{color.accent}" as never } },
  text: "{color.neutral}" as never,
} as ComponentVisualRule;

const drawThumb = getSkiaPrimitive("slider_thumb")!;

function circles(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "circle");
}

describe("skiaPrimitive 'slider_thumb' — SliderThumb 이 자기 상자에 handle 을 그린다 (ADR-256 Phase 7c)", () => {
  it("registry 에 replace 모드로 등록", () => {
    expect(drawThumb).toBeDefined();
    expect(getSkiaPrimitiveMode("slider_thumb")).toBe("replace");
  });

  it("box 중앙의 원 (지름 = box) + 2px {color.base} 링 — 엔진이 absolute box 를 value 자리에 둔다", () => {
    const shapes = drawThumb({
      props: { _containerWidth: 18 },
      size: { height: 18 } as SizeSpec,
      visual: thumbVisual,
      paint: { backgroundColor: "{color.accent}" },
      style: undefined,
    } as never)!;
    expect(circles(shapes)).toHaveLength(1);
    expect(circles(shapes)[0]).toMatchObject({ x: 9, y: 9, radius: 9 });
    expect(shapes.find((s) => s.type === "border")).toMatchObject({
      borderWidth: 2,
      color: "{color.base}",
    });
  });
});
