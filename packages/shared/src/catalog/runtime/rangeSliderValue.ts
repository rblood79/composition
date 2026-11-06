/** One authored S2 RangeValue contract for paint, DOM and runtime change events. */
export interface CatalogRangeValue {
  start: number;
  end: number;
}

export function catalogRangeValue(
  value: unknown,
  min = 0,
  max = 100,
  step = 1,
): CatalogRangeValue {
  const range =
    value && typeof value === "object"
      ? (value as Partial<CatalogRangeValue>)
      : {};
  const finite = (number: unknown, fallback: number) =>
    typeof number === "number" && Number.isFinite(number) ? number : fallback;
  const snap = (number: number) => {
    const bounded = Math.max(min, Math.min(max, number));
    return step > 0
      ? Math.max(
          min,
          Math.min(max, min + Math.round((bounded - min) / step) * step),
        )
      : bounded;
  };
  const start = snap(finite(range.start, min));
  const end = snap(finite(range.end, max));
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

export function catalogRangeValueFromThumbs(value: unknown): CatalogRangeValue {
  const thumbs = Array.isArray(value) ? value : [];
  return { start: Number(thumbs[0] ?? 0), end: Number(thumbs[1] ?? 100) };
}
