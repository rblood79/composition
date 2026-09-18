import type { BoundingBox } from "../../../workspace/canvas/selection/types";

export type SizeConstraintProperty =
  "minWidth" | "maxWidth" | "minHeight" | "maxHeight";

interface ComparableConstraint {
  value: number;
  unit: string | null;
}

/**
 * 비교 가능한 단순 CSS 길이만 읽는다. 서로 다른 단위나 calc()/키워드를 parseFloat 로
 * 억지 비교하지 않는다. 단위 없는 0은 CSS 길이의 모든 단위와 동치라 예외로 허용한다.
 */
function parseComparableConstraint(value: string): ComparableConstraint | null {
  const match = value.trim().match(/^(\d+(?:\.\d*)?|\.\d+)(px|%|vw|vh)?$/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;
  const unit = match[2]?.toLowerCase() ?? null;
  if (unit === null && numeric !== 0) return null;
  return { value: numeric, unit };
}

/** ADR-224: 같은 기준에서 새 min > max가 되는 commit만 차단한다. */
export function hasSizeConstraintConflict(
  property: SizeConstraintProperty,
  nextValue: string,
  oppositeValue: string,
): boolean {
  const next = parseComparableConstraint(nextValue);
  const opposite = parseComparableConstraint(oppositeValue);
  if (!next || !opposite) return false;
  if (
    next.unit !== opposite.unit &&
    next.unit !== null &&
    opposite.unit !== null
  ) {
    return false;
  }
  return property.startsWith("min")
    ? next.value > opposite.value
    : next.value < opposite.value;
}

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
