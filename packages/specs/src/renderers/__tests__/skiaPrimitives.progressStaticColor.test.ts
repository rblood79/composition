import { describe, expect, it } from "vitest";

import { getSkiaPrimitive } from "../skiaPrimitives";
import { buildCatalogShapes } from "../buildCatalogShapes";
import type { Shape, SizeSpec, ComponentVisual } from "../../types";

/**
 * design-data 감사 §2-F "over background" (2026-08-21) — ProgressBar/Circle staticColor.
 *
 * Button 형(bg 반전) 스킴이 아니라 value-fill 2채널 스킴:
 *   track = static 25% wash / fill·indicator = solid static.
 * DOM(수동 ProgressBar.css var 재정의 / ProgressCircle.tsx 인라인)과 동일 상수(0.25)를
 * Skia 3지점(value_fill_bar / value_fill_arc / buildCatalogShapes track wash)에 고정한다.
 */

const sizeMd: SizeSpec = {
  height: 8,
  paddingX: 0,
  paddingY: 0,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.none}" as never,
} as SizeSpec;

describe("value_fill_bar staticColor (§2-F)", () => {
  const draw = getSkiaPrimitive("value_fill_bar")!;
  const bar = (props: Record<string, unknown>) =>
    (
      draw({
        props: { value: 50, _containerWidth: 200, ...props },
        size: sizeMd,
        visual: { fillBar: "{color.accent}" } as never,
        style: undefined,
      } as never) as Shape[]
    )[0] as { fill?: unknown };

  it("white → fill 막대 #ffffff solid (variant fillBar 대체)", () => {
    expect(bar({ staticColor: "white" }).fill).toBe("#ffffff");
  });

  it("black → #000000 / auto·미지정 → variant fillBar 유지", () => {
    expect(bar({ staticColor: "black" }).fill).toBe("#000000");
    expect(bar({ staticColor: "auto" }).fill).toBe("{color.accent}");
    expect(bar({}).fill).toBe("{color.accent}");
  });

  it("사용자 style.color 는 static 보다 우선", () => {
    const shapes = draw({
      props: { value: 50, _containerWidth: 200, staticColor: "white" },
      size: sizeMd,
      visual: { fillBar: "{color.accent}" } as never,
      style: { color: "#123456" },
    } as never) as Shape[];
    expect((shapes[0] as { fill?: unknown }).fill).toBe("#123456");
  });
});

describe("value_fill_arc staticColor (§2-F)", () => {
  const draw = getSkiaPrimitive("value_fill_arc")!;
  const arcs = (props: Record<string, unknown>) =>
    draw({
      props: { value: 50, ...props },
      size: { ...sizeMd, height: 32, width: 32 } as SizeSpec,
      visual: {
        fill: { default: { base: "{color.neutral-subtle}" } },
        fillBar: "{color.accent}",
      } as never,
      style: undefined,
    } as never) as Array<{
      stroke?: unknown;
      strokeAlpha?: number;
    }>;

  it("white → track #ffffff + strokeAlpha 0.25 / indicator #ffffff solid", () => {
    const [track, indicator] = arcs({ staticColor: "white" });
    expect(track.stroke).toBe("#ffffff");
    expect(track.strokeAlpha).toBe(0.25);
    expect(indicator.stroke).toBe("#ffffff");
    expect(indicator.strokeAlpha).toBeUndefined();
  });

  it("미지정 → variant 경로 유지 (track alpha 없음)", () => {
    const [track, indicator] = arcs({});
    expect(track.stroke).toBe("{color.neutral-subtle}");
    expect(track.strokeAlpha).toBeUndefined();
    expect(indicator.stroke).toBe("{color.accent}");
  });
});

describe("buildCatalogShapes track wash (§2-F — fillBar 채널 데이터 분기)", () => {
  const trackVisual = {
    fill: { default: { base: "{color.neutral-subtle}" } },
    fillBar: "{color.accent}",
  } as unknown as ComponentVisual;
  const buttonVisual = {
    fill: { default: { base: "{color.accent}" } },
    colors: { text: "{color.neutral}" },
    text: "{color.neutral}",
  } as unknown as ComponentVisual;

  it("fillBar 보유 rule + staticColor → bg=staticHex + fillAlpha 0.25 (wash)", () => {
    const shapes = buildCatalogShapes(
      trackVisual,
      { staticColor: "white" },
      sizeMd,
    ) as Array<{ id?: string; fill?: unknown; fillAlpha?: number }>;
    const bg = shapes.find((s) => s.id === "bg")!;
    expect(bg.fill).toBe("#ffffff");
    expect(bg.fillAlpha).toBe(0.25);
  });

  it("fillBar 미보유(Button 형) → 기존 solid 반전 스킴 유지 (회귀 가드)", () => {
    const shapes = buildCatalogShapes(
      buttonVisual,
      { staticColor: "white", children: "Save" },
      sizeMd,
    ) as Array<{ id?: string; fill?: unknown; fillAlpha?: number }>;
    const bg = shapes.find((s) => s.id === "bg")!;
    expect(bg.fill).toBe("#ffffff");
    expect(bg.fillAlpha).toBe(1);
  });
});
