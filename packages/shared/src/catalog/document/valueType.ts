import type { CalendarDuration, ValueType } from "./types";

/**
 * A scalar value against its declared value type. `slot` (ADR-256 Decision 4) holds a slot name or
 * `false` (the explicit detach) — a condition, a part rule or a template value keyed on a slot name
 * (`[slot="description"]`) matches it like a string.
 */
export function scalarFitsType(
  value: unknown,
  type: ValueType | string | undefined,
): boolean {
  if (type === "slot") return typeof value === "string" || value === false;
  if (type === "columnSize") return catalogColumnSizeFits(value, false);
  if (type === "columnStaticSize") return catalogColumnSizeFits(value, true);
  if (type === "calendarDuration") return false;
  return type !== undefined && typeof value === type;
}

/**
 * A prop value against its declared value type — one rule for the document validator (`graph.ts`),
 * the library (`library.ts`) and rule defaults: a typed duration only where `calendarDuration` is
 * accepted (never a token), a string list, a list of flat item records, a token reference (its
 * token type is checked separately) or a scalar of that type.
 */
export function catalogPropValueFits(value: unknown, type: string): boolean {
  if (type === "calendarDuration") return catalogCalendarDurationFits(value);
  if (type === "slot") return scalarFitsType(value, type);
  if (type === "string[]")
    return (
      Array.isArray(value) && value.every((item) => typeof item === "string")
    );
  if (type === "items")
    return (
      Array.isArray(value) &&
      value.every(
        (item) => !!item && typeof item === "object" && !Array.isArray(item),
      )
    );
  if (Array.isArray(value)) return false;
  if (value && typeof value === "object") return "tokenId" in value;
  return scalarFitsType(value, type);
}

/** ADR-256 Phase 9 — the units of a Calendar's authored `visibleDuration`. */
export const CALENDAR_DURATION_UNITS = ["days", "weeks", "months"] as const;

/**
 * ADR-256 Phase 9 — a Calendar · RangeCalendar `visibleDuration` as stored: exactly one of
 * `days` · `weeks` · `months` with a safe whole count ≥ 1 (RAC `DateDuration`'s other keys are not
 * authored). Anything else — empty, two units, extra keys, an array, a numeric string, 0, a
 * fraction — does not fit.
 */
export function catalogCalendarDurationFits(
  value: unknown,
): value is CalendarDuration {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1) return false;
  const [unit] = keys;
  if (!(CALENDAR_DURATION_UNITS as readonly string[]).includes(unit))
    return false;
  const count = (value as Record<string, unknown>)[unit];
  return (
    typeof count === "number" && Number.isSafeInteger(count) && count >= 1
  );
}

const COLUMN_FR = /^([1-9]\d*)fr$/;
const COLUMN_PERCENT = /^(\d+)%$/;

/**
 * ADR-257 — S2 1.8.0 `ColumnSize` (`staticOnly` = `ColumnStaticSize`) as stored: a finite px
 * number ≥ 0, `"Nfr"` (whole N ≥ 1), `"N%"` (whole N). S2's type also admits a numeric string
 * (`${number}`), but RAC's `parseStaticWidth` throws on one — the document keeps numbers only
 * (a composition restriction of the notation, not the meaning).
 */
export function catalogColumnSizeFits(
  value: unknown,
  staticOnly: boolean,
): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (typeof value !== "string") return false;
  return (
    COLUMN_PERCENT.test(value) || (!staticOnly && COLUMN_FR.test(value))
  );
}
