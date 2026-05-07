import { describe, expect, it } from "vitest";

import {
  calculateDotBackgroundMetrics,
  DOT_BACKGROUND_INSET,
} from "./DotBackground";

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function screenPhase(tx: number, gap: number): number {
  return positiveModulo(-DOT_BACKGROUND_INSET + tx, gap);
}

describe("calculateDotBackgroundMetrics", () => {
  it("keeps dot phase anchored to page coordinates at non-integer zoom", () => {
    const panOffset = { x: 124, y: -87 };
    const metrics = calculateDotBackgroundMetrics({
      panOffset,
      zoom: 1.37,
    });

    expect(screenPhase(metrics.tx, metrics.gap)).toBeCloseTo(
      positiveModulo(panOffset.x, metrics.gap),
    );
    expect(screenPhase(metrics.ty, metrics.gap)).toBeCloseTo(
      positiveModulo(panOffset.y, metrics.gap),
    );
  });
});
