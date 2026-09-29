import { getLocalTimeZone, now, Time, today } from "@internationalized/date";

/**
 * Initial values the date/time field renderers show (Preview `renderDateField`/`renderTimeField`):
 * today (day granularity) or now, and 09:00. Shared so the catalog DOM binding shows the same.
 */
export function dateFieldDefaultValue(granularity: string) {
  return granularity === "day"
    ? today(getLocalTimeZone())
    : now(getLocalTimeZone());
}
export function timeFieldDefaultValue() {
  return new Time(9, 0);
}
