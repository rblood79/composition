import {
  type DateValue,
  GregorianCalendar,
  getDayOfWeek,
  toCalendar,
  toCalendarDate,
} from "@internationalized/date";
import {
  catalogIsoDayFits,
  catalogUnavailableDatesFit,
  type CatalogUnavailableDate,
} from "../document/unavailableDates";

/**
 * S2 `isDateUnavailable` from data (S2 체크리스트 부록 D.3 2단계, 2026-11-23): a record's authored
 * weekdays · dates (`isDateUnavailable`) and the dates its data source names (`_unavailableDates` —
 * the resolver's, from the binding's rows: ISO days and `start/end` intervals) as one test. The DOM gives it to RAC; the Canvas calendar
 * model marks the same days.
 */

/** The record prop the resolver puts its data dates in (the binding's rows — never the document). */
export const CATALOG_UNAVAILABLE_DATA_PROP = "_unavailableDates";

const gregorian = new GregorianCalendar();

/** A day as its ISO Gregorian date (`YYYY-MM-DD`) — whatever the calendar it is in. */
function catalogIsoDay(date: DateValue): string {
  return toCalendar(toCalendarDate(date), gregorian).toString();
}

/** A day's weekday — 0 = Sunday … 6 = Saturday (the stored weekdays' numbering). */
function catalogWeekday(date: DateValue): number {
  return getDayOfWeek(toCalendarDate(date), "en-US");
}

const tests = new Map<string, (date: DateValue) => boolean>();

/**
 * A record's unavailable-date test — undefined when nothing makes a date unavailable. The same
 * weekdays · dates give the same function (RAC re-validates when the function changes).
 */
export function catalogUnavailableDateTest(
  props: Readonly<Record<string, unknown>>,
): ((date: DateValue) => boolean) | undefined {
  const authored = catalogUnavailableDatesFit(props.isDateUnavailable)
    ? props.isDateUnavailable
    : undefined;
  const data = Array.isArray(props[CATALOG_UNAVAILABLE_DATA_PROP])
    ? (props[CATALOG_UNAVAILABLE_DATA_PROP] as readonly unknown[])
    : [];
  const weekdays = [...new Set(authored?.weekdays ?? [])].sort();
  // (The data's periods are ISO intervals — `start/end`.)
  const dataEntries = data.map((entry) => {
    if (typeof entry !== "string" || !entry.includes("/")) return entry;
    const [start, end] = entry.split("/");
    return { start, end };
  });
  const entries = [...(authored?.dates ?? []), ...dataEntries].filter(
    (entry): entry is CatalogUnavailableDate =>
      catalogIsoDayFits(entry) ||
      (!!entry &&
        typeof entry === "object" &&
        catalogIsoDayFits((entry as { start?: unknown }).start) &&
        catalogIsoDayFits((entry as { end?: unknown }).end)),
  );
  if (!weekdays.length && !entries.length) return undefined;
  const key = JSON.stringify([weekdays, entries]);
  const cached = tests.get(key);
  if (cached) return cached;
  const days = new Set<string>();
  const periods: { start: string; end: string }[] = [];
  for (const entry of entries)
    if (typeof entry === "string") days.add(entry);
    else periods.push(entry);
  const weekdaySet = new Set(weekdays);
  const test = (date: DateValue) => {
    if (weekdaySet.size && weekdaySet.has(catalogWeekday(date))) return true;
    const day = catalogIsoDay(date);
    return (
      days.has(day) ||
      periods.some((period) => period.start <= day && day <= period.end)
    );
  };
  // (A bounded cache: the documents' distinct lists are few; drop the oldest past 200.)
  if (tests.size >= 200) tests.delete(tests.keys().next().value!);
  tests.set(key, test);
  return test;
}
