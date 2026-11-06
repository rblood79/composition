/** Serializable S2 RangeValue<number>; endpoint order is part of the value contract. */
export interface CatalogNumberRange {
  readonly start: number;
  readonly end: number;
}

export function catalogNumberRangeFits(
  value: unknown,
): value is CatalogNumberRange {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const range = value as Record<string, unknown>;
  return (
    Object.keys(range).length === 2 &&
    typeof range.start === "number" &&
    Number.isFinite(range.start) &&
    typeof range.end === "number" &&
    Number.isFinite(range.end) &&
    range.start <= range.end
  );
}
