import { describe, expect, it } from "vitest";

import { getSkiaPrimitive } from "./catalogPaintFixture";
import { buildCatalogShapes } from "./catalogPaintFixture";
import type { Shape, SizeSpec, ComponentVisual } from "../../types";

/**
 * design-data 감사 §2-F "over background" (2026-08-21) — ProgressBar/Circle staticColor.
 *
 * Button 형(bg 반전) 스킴이 아니라 value-fill 2채널 스킴 — S2 1.8.0 (2026-10-10):
 *   track = static 색 0.17 (`transparent-overlay-300`) / fill·indicator = 0.94 (`-900`).
 * ProgressCircle 은 DOM (ProgressCircle.tsx 인라인) 과 value_fill_arc 가 같은 상수를, bar 의 track ·
 * fill 은 rule `staticAlpha` 를 쓴다 (buildCatalogShapes 가 칠의 투명도로). (ProgressBar 의 채움은
 * ADR-256 Phase 7a 부터 ProgressBarFill 노드 — `value_fill_bar` 는 2026-10-09 삭제.)
 */

const sizeMd: SizeSpec = {
  height: 8,
  paddingX: 0,
  paddingY: 0,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.none}" as never,
} as SizeSpec;

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

  it.each([
    ["white", "#ffffff"],
    ["black", "#000000"],
  ])("%s → track strokeAlpha 0.17 / indicator 0.94 (S2)", (staticColor, hex) => {
    const [track, indicator] = arcs({ staticColor });
    expect(track.stroke).toBe(hex);
    expect(track.strokeAlpha).toBe(0.17);
    expect(indicator.stroke).toBe(hex);
    expect(indicator.strokeAlpha).toBe(0.94);
  });

  it("indeterminate 의 호도 0.94", () => {
    const [, indicator] = arcs({ staticColor: "white", isIndeterminate: true });
    expect(indicator.strokeAlpha).toBe(0.94);
  });

  it("미지정 → variant 경로 유지 (track alpha 없음)", () => {
    const [track, indicator] = arcs({});
    expect(track.stroke).toBe("{color.neutral-subtle}");
    expect(track.strokeAlpha).toBeUndefined();
    expect(indicator.stroke).toBe("{color.accent}");
    expect(indicator.strokeAlpha).toBeUndefined();
  });
});

describe("buildCatalogShapes track wash (§2-F — fillBar 채널 데이터 분기)", () => {
  const trackVisual = {
    fill: { default: { base: "{color.neutral-subtle}" } },
    fillBar: "{color.accent}",
    staticAlpha: 0.17,
  } as unknown as ComponentVisual;
  const buttonVisual = {
    fill: { default: { base: "{color.accent}" } },
    colors: { text: "{color.neutral}" },
    text: "{color.neutral}",
  } as unknown as ComponentVisual;

  it("track rule (staticAlpha 0.17) + staticColor → bg=staticHex + fillAlpha 0.17", () => {
    const shapes = buildCatalogShapes(
      trackVisual,
      { staticColor: "white" },
      sizeMd,
    ) as Array<{ id?: string; fill?: unknown; fillAlpha?: number }>;
    const bg = shapes.find((s) => s.id === "bg")!;
    expect(bg.fill).toBe("#ffffff");
    expect(bg.fillAlpha).toBe(0.17);
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
