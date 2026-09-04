import type { BoundingBox } from "../../../workspace/canvas/selection/types";

function formatAbsoluteOffsetPx(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}px`;
}

export function resolveAbsolutePositionActivationStyles(
  elementBounds: BoundingBox | null | undefined,
  parentBounds: BoundingBox | null | undefined,
): Record<string, string> | null {
  if (!elementBounds || !parentBounds) {
    return null;
  }

  return {
    position: "absolute",
    left: formatAbsoluteOffsetPx(elementBounds.x - parentBounds.x),
    top: formatAbsoluteOffsetPx(elementBounds.y - parentBounds.y),
  };
}
