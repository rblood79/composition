import { describe, expect, it } from "vitest";

import { getSkiaPrimitive } from "../skiaPrimitives";
import type { Shape, SizeSpec } from "../../types";

/**
 * design-data 감사 §1-3 형제 대칭 (2026-08-21) — value_fill_arc 의 minValue/maxValue
 * 정규화 계약.
 *
 * **갭**: DOM(ProgressCircle.tsx `(value/100)×circumference`)과 Skia(value_fill_arc
 * `(value/100)×360`)가 0-100 스케일을 하드코딩 — ProgressBar 형제는 min/max 를 받는데
 * ProgressCircle 만 없었다. 채택: 양쪽이 (value-min)/(max-min) 비율을 공용.
 */

const sizeMd: SizeSpec = {
  height: 32,
  width: 32,
  paddingX: 0,
  paddingY: 0,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.none}" as never,
} as SizeSpec;

const draw = getSkiaPrimitive("value_fill_arc")!;

function indicatorSweep(props: Record<string, unknown>): number | undefined {
  const shapes = draw({
    props,
    size: sizeMd,
    visual: undefined,
    style: undefined,
  } as never) as Shape[];
  // shapes[0]=track(360°), shapes[1]=indicator
  const ind = shapes[1] as { sweepAngle?: number } | undefined;
  return ind?.sweepAngle;
}

describe("value_fill_arc minValue/maxValue 정규화 (§1-3, 2026-08-21)", () => {
  it("기본 0-100: value 25 → 90°", () => {
    expect(indicatorSweep({ value: 25 })).toBe(90);
  });

  it("min 50 / max 150: value 100 → 50% → 180°", () => {
    expect(indicatorSweep({ value: 100, minValue: 50, maxValue: 150 })).toBe(
      180,
    );
  });

  it("value 가 min 이하면 indicator 미생성 (fraction 0)", () => {
    expect(
      indicatorSweep({ value: 10, minValue: 50, maxValue: 150 }),
    ).toBeUndefined();
  });

  it("value 가 max 초과면 360° 로 clamp", () => {
    expect(indicatorSweep({ value: 999, minValue: 0, maxValue: 200 })).toBe(
      360,
    );
  });

  it("span<=0 방어: min==max → indicator 미생성", () => {
    expect(
      indicatorSweep({ value: 50, minValue: 100, maxValue: 100 }),
    ).toBeUndefined();
  });
});
