import { describe, expect, it } from "vitest";

import { getSkiaPrimitive, getSkiaPrimitiveMode } from "./catalogPaintFixture";
import type { FixtureVisual as ComponentVisualRule } from "./fixtureVisual";
import type { SizeSpec } from "../../types";

/**
 * Slider thumb — `slider_thumb` 회귀 게이트 (ADR-256 Phase 7c · S2 1.8.2 `thumb`, 2026-11-18).
 *
 * SliderThumb 노드가 자기 box (엔진이 RAC 와 같은 값 자리에 absolute 로 둔다 —
 * `catalogSliderThumbLayout`) 를 채우는 둥근 상자 (원 · precise 막대) 에 rule 칠 — 바탕 `gray-25` ·
 * 2px 테두리 `gray-800` (비활성 `border-disabled`) — 을 그린다.
 */

const thumbVisual: ComponentVisualRule = {
  fill: { default: { base: "{color.base}" as never } },
  text: "{color.neutral}" as never,
} as ComponentVisualRule;

const drawThumb = getSkiaPrimitive("slider_thumb")!;

describe("skiaPrimitive 'slider_thumb' — SliderThumb 이 자기 상자에 handle 을 그린다 (ADR-256 Phase 7c)", () => {
  it("registry 에 replace 모드로 등록", () => {
    expect(drawThumb).toBeDefined();
    expect(getSkiaPrimitiveMode("slider_thumb")).toBe("replace");
  });

  it("box 를 채우는 원 (지름 = box) + rule 의 2px 테두리 — 엔진이 absolute box 를 value 자리에 둔다", () => {
    const shapes = drawThumb({
      props: { _containerWidth: 18, _containerHeight: 18 },
      size: { height: 18 } as SizeSpec,
      visual: thumbVisual,
      paint: {
        backgroundColor: "{color.base}",
        borderColor: "{color.neutral}",
      },
      style: undefined,
    } as never)!;
    expect(shapes[0]).toMatchObject({
      type: "roundRect",
      x: 0,
      y: 0,
      width: 18,
      height: 18,
      radius: 9,
      fill: "{color.base}",
    });
    expect(shapes.find((s) => s.type === "border")).toMatchObject({
      borderWidth: 2,
      color: "{color.neutral}",
    });
  });

  it("precise: 6 × 22 막대 — 모서리 full (짧은 변의 반)", () => {
    const shapes = drawThumb({
      props: { _containerWidth: 6, _containerHeight: 22 },
      size: { height: 22 } as SizeSpec,
      visual: thumbVisual,
      paint: { backgroundColor: "{color.base}" },
      style: undefined,
    } as never)!;
    expect(shapes[0]).toMatchObject({ width: 6, height: 22, radius: 3 });
  });
});
