import type { NumberFormatValue } from "./types";

/**
 * S2 1.8.0 · RAC `formatOptions` (NumberField · Meter · ProgressBar · Slider) as the document stores
 * it — the value type `numberFormat` (사용자 결정 2026-10-12 「S2 · RAC 가 객체면 객체 값 타입」).
 * S2 and RAC take `Intl.NumberFormatOptions`; the document keeps the keys all four consumers handle
 * the same way — RAC's NumberField parses its own text back (`NumberParser`: decimal · percent ·
 * currency · unit), so notation · significant digits · rounding are not authored.
 *
 * Unset = RAC's own default (Meter · ProgressBar `{style: 'percent'}`, NumberField · Slider the
 * locale's decimal). An empty object is not a value — it would be RAC's decimal, not the unset
 * default.
 */
export type CatalogNumberFormat = NumberFormatValue;

export const CATALOG_NUMBER_FORMAT_STYLES = [
  "decimal",
  "percent",
  "currency",
  "unit",
] as const;
export const CATALOG_CURRENCY_DISPLAYS = [
  "symbol",
  "narrowSymbol",
  "code",
  "name",
] as const;
export const CATALOG_CURRENCY_SIGNS = ["standard", "accounting"] as const;
export const CATALOG_UNIT_DISPLAYS = ["short", "long", "narrow"] as const;
export const CATALOG_SIGN_DISPLAYS = [
  "auto",
  "never",
  "always",
  "exceptZero",
] as const;

type KeyCheck = (value: unknown) => boolean;

const oneOf =
  (values: readonly string[]): KeyCheck =>
  (value) =>
    typeof value === "string" && values.includes(value);
const wholeIn =
  (min: number, max: number): KeyCheck =>
  (value) =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max;

/** Each authored key and its own check (Intl's ranges: integer digits 1–21, fraction 0–100). */
const KEY_CHECKS: Readonly<Record<keyof CatalogNumberFormat, KeyCheck>> = {
  style: oneOf(CATALOG_NUMBER_FORMAT_STYLES),
  currency: (value) => typeof value === "string" && /^[A-Z]{3}$/.test(value),
  currencyDisplay: oneOf(CATALOG_CURRENCY_DISPLAYS),
  currencySign: oneOf(CATALOG_CURRENCY_SIGNS),
  unit: (value) =>
    typeof value === "string" && /^[a-z]+(-[a-z]+)*$/.test(value),
  unitDisplay: oneOf(CATALOG_UNIT_DISPLAYS),
  minimumIntegerDigits: wholeIn(1, 21),
  minimumFractionDigits: wholeIn(0, 100),
  maximumFractionDigits: wholeIn(0, 100),
  useGrouping: (value) => typeof value === "boolean",
  signDisplay: oneOf(CATALOG_SIGN_DISPLAYS),
};

/** Keys that belong to one style only — present without that style they would be dormant. */
const CURRENCY_KEYS = ["currency", "currencyDisplay", "currencySign"] as const;
const UNIT_KEYS = ["unit", "unitDisplay"] as const;

/**
 * A stored `formatOptions`: a plain non-empty object of the authored keys, each its own type; a
 * currency style names its ISO code (and only it carries the currency keys), a unit style names its
 * unit (and only it carries the unit keys); the fraction range is ordered; and `Intl.NumberFormat`
 * takes it (a unit Intl does not sanction is refused here, not at render).
 */
export function catalogNumberFormatFits(
  value: unknown,
): value is CatalogNumberFormat {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) return false;
  for (const key of keys) {
    const check = KEY_CHECKS[key as keyof CatalogNumberFormat];
    if (!check || !check(record[key])) return false;
  }
  const style = record.style;
  if ((style === "currency") !== "currency" in record) return false;
  if ((style === "unit") !== "unit" in record) return false;
  if (style !== "currency" && CURRENCY_KEYS.some((key) => key in record))
    return false;
  if (style !== "unit" && UNIT_KEYS.some((key) => key in record)) return false;
  const min = record.minimumFractionDigits;
  const max = record.maximumFractionDigits;
  if (typeof min === "number" && typeof max === "number" && min > max)
    return false;
  try {
    new Intl.NumberFormat("en-US", record as Intl.NumberFormatOptions);
  } catch {
    return false;
  }
  return true;
}

/** The value RAC receives: the stored object, else nothing (RAC's own default). */
export function catalogNumberFormatOptions(
  value: unknown,
): Intl.NumberFormatOptions | undefined {
  return catalogNumberFormatFits(value)
    ? (value as Intl.NumberFormatOptions)
    : undefined;
}
