/**
 * A length — a px number or a CSS length text (`"12px"` · a computed style) — in px: 0 when it is
 * not a finite number. (No imports — the panel's · lazy chunks read it.)
 */
export function catalogLengthPx(value: unknown): number {
  const number =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(number) ? number : 0;
}
