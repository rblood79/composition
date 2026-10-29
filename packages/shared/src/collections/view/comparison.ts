/**
 * ADR-284 Decision 2 — the closed comparison vocabulary as one table: what a comparison does with a
 * row's cell and the condition's value. The panel (which comparisons a field offers), the document
 * check, the local evaluator and the API serializer read this file — never a second copy.
 *
 * Text follows RAC `useFilter` (`react-aria` `i18n/useFilter` — `Intl.Collator` `usage: "search"`,
 * NFC on both sides, an empty search matches): a condition is a pure function so it cannot call the
 * hook, it builds the same collator. Dates compare by day; a time-only date by its time.
 */
import type {
  ViewComparison,
  ViewCondition,
} from "../../catalog/document/types";

/** A field's value kind as the comparisons see it (the data schema's types, folded). */
export type ViewFieldKind = "text" | "number" | "boolean" | "date" | "list";

/** Data schema field types → the kind a comparison reads (`DataFieldType`). */
export function viewFieldKind(type: string | undefined): ViewFieldKind {
  switch (type) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "array":
      return "list";
    default:
      return "text";
  }
}

/**
 * Which comparisons a field kind offers (the panel's list, the run's check). `exists` ·
 * `notExists` fit every kind.
 */
export const VIEW_COMPARISONS_BY_KIND: Readonly<
  Record<ViewFieldKind, readonly ViewComparison[]>
> = {
  text: [
    "equals",
    "notEquals",
    "contains",
    "startsWith",
    "endsWith",
    "notContains",
    "notStartsWith",
    "notEndsWith",
    "oneOf",
    "exists",
    "notExists",
  ],
  number: [
    "equals",
    "notEquals",
    "gte",
    "gt",
    "lte",
    "lt",
    "between",
    "oneOf",
    "exists",
    "notExists",
  ],
  boolean: ["equals", "notEquals", "exists", "notExists"],
  date: [
    "equals",
    "notEquals",
    "before",
    "after",
    "between",
    "withinLast",
    "exists",
    "notExists",
  ],
  list: ["containsAny", "containsAll", "exists", "notExists"],
};

/** Whether the value is empty — the default skip (no value · `""` · an empty list). */
export function viewValueIsEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Set) return value.size === 0;
  return false;
}

/** A RAC `Selection` (`Set` · `"all"`) or a list as an array; a scalar as a list of one. */
export function viewValueList(value: unknown): unknown[] | "all" {
  if (value === "all") return "all";
  if (value instanceof Set) return [...value];
  if (Array.isArray(value)) return value;
  return viewValueIsEmpty(value) ? [] : [value];
}

const collators = new Map<string, Intl.Collator>();
function collatorOf(
  locale: string | undefined,
  sensitivity: NonNullable<ViewCondition["sensitivity"]>,
): Intl.Collator {
  const key = `${locale ?? ""}\0${sensitivity}`;
  let collator = collators.get(key);
  if (!collator) {
    collator = new Intl.Collator(locale, { usage: "search", sensitivity });
    collators.set(key, collator);
  }
  return collator;
}

const text = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

/** The text comparisons whose `!` the `not…` ones are. */
export const NEGATED_TEXT = {
  notContains: "contains",
  notStartsWith: "startsWith",
  notEndsWith: "endsWith",
} as const satisfies Partial<Record<ViewComparison, ViewComparison>>;

/** `useFilter`'s `contains` · `startsWith` · `endsWith` (same scan, same collator). */
function textMatch(
  collator: Intl.Collator,
  op: "contains" | "startsWith" | "endsWith",
  cell: string,
  search: string,
): boolean {
  if (search.length === 0) return true;
  const string = cell.normalize("NFC");
  const substring = search.normalize("NFC");
  if (op === "startsWith")
    return collator.compare(string.slice(0, substring.length), substring) === 0;
  if (op === "endsWith")
    return collator.compare(string.slice(-substring.length), substring) === 0;
  for (let scan = 0; scan + substring.length <= string.length; scan++)
    if (
      collator.compare(
        substring,
        string.slice(scan, scan + substring.length),
      ) === 0
    )
      return true;
  return false;
}

/**
 * A time-only value as a sortable text (`HH:MM:SS.mmm`): a `date` cell's time shape (`10:30` ·
 * `10:30:15.5` — 2026-10-29) or a RAC `Time`-like object (`hour` · `minute`, no `year`).
 * Undefined when it is none — a time compares only with a time (it has no day).
 */
function viewTime(value: unknown): string | undefined {
  const pad = (n: number, size = 2) => String(n).padStart(size, "0");
  if (typeof value === "string") {
    const m = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(value.trim());
    if (!m) return undefined;
    return `${m[1]}:${m[2]}:${m[3] ?? "00"}.${(m[4] ?? "").padEnd(3, "0").slice(0, 3)}`;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const { year, hour, minute, second, millisecond } = value as Record<
      string,
      unknown
    >;
    if (year !== undefined || typeof hour !== "number" || typeof minute !== "number")
      return undefined;
    return `${pad(hour)}:${pad(minute)}:${pad(typeof second === "number" ? second : 0)}.${pad(typeof millisecond === "number" ? millisecond : 0, 3)}`;
  }
  return undefined;
}

/**
 * A value as a day (`YYYY-MM-DD`): an ISO date · date-time string, a `Date`, a timestamp, or a
 * RAC `CalendarDate`-like object (`year` · `month` · `day`). Undefined when it is none.
 */
export function viewDay(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))
    return value.slice(0, 10);
  if (typeof value === "object" && !(value instanceof Date)) {
    const { year, month, day } = value as Record<string, unknown>;
    if (
      typeof year === "number" &&
      typeof month === "number" &&
      typeof day === "number"
    )
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return undefined;
  }
  const date =
    value instanceof Date
      ? value
      : typeof value === "number" || typeof value === "string"
        ? new Date(value)
        : undefined;
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function numberOf(value: unknown): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** What the comparisons need besides the cell and the value. */
export interface ViewCompareOptions {
  kind: ViewFieldKind;
  sensitivity?: ViewCondition["sensitivity"];
  unit?: ViewCondition["unit"];
  locale?: string;
  /** Today (`withinLast`) — the run's clock, so a test can fix it. */
  today?: string;
}

/**
 * Ascending order of two values of a kind (`gte` · `between` · `before` …): numbers by value, dates
 * by day, the rest by the collator. Undefined when they do not compare (a missing value).
 */
function order(
  a: unknown,
  b: unknown,
  options: ViewCompareOptions,
): number | undefined {
  if (options.kind === "date") {
    const leftTime = viewTime(a);
    const rightTime = viewTime(b);
    if (leftTime || rightTime) {
      if (!leftTime || !rightTime) return undefined;
      return leftTime < rightTime ? -1 : leftTime > rightTime ? 1 : 0;
    }
    const left = viewDay(a);
    const right = viewDay(b);
    if (!left || !right) return undefined;
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (options.kind === "number") {
    const left = numberOf(a);
    const right = numberOf(b);
    if (left === undefined || right === undefined) return undefined;
    return left - right;
  }
  if (viewValueIsEmpty(a) || viewValueIsEmpty(b)) return undefined;
  return collatorOf(options.locale, options.sensitivity ?? "base").compare(
    text(a),
    text(b),
  );
}

function same(a: unknown, b: unknown, options: ViewCompareOptions): boolean {
  if (options.kind === "boolean") {
    const flag = (value: unknown) =>
      value === true || value === "true"
        ? true
        : value === false || value === "false"
          ? false
          : undefined;
    return flag(a) !== undefined && flag(a) === flag(b);
  }
  if (options.kind === "text")
    return (
      !viewValueIsEmpty(a) &&
      !viewValueIsEmpty(b) &&
      collatorOf(options.locale, options.sensitivity ?? "base").compare(
        text(a),
        text(b),
      ) === 0
    );
  return order(a, b, options) === 0;
}

const UNIT_DAYS = { day: 1, week: 7, month: 30, year: 365 } as const;

/**
 * Whether a row's cell passes a comparison with the value (already resolved — a reference read,
 * the skip decided). A list cell (`list` kind) is the row's array; another kind's array cell
 * matches when any element does.
 */
export function viewCompare(
  op: ViewComparison,
  cell: unknown,
  value: unknown,
  options: ViewCompareOptions,
): boolean {
  switch (op) {
    case "exists":
      return !viewValueIsEmpty(cell);
    case "notExists":
      return viewValueIsEmpty(cell);
    case "containsAny":
    case "containsAll": {
      const cells = viewValueList(cell);
      const wanted = viewValueList(value);
      if (cells === "all") return true;
      if (wanted === "all")
        return op === "containsAny" ? cells.length > 0 : true;
      const has = (item: unknown) =>
        cells.some((element) =>
          same(element, item, { ...options, kind: "text" }),
        );
      return op === "containsAny" ? wanted.some(has) : wanted.every(has);
    }
    default:
      break;
  }
  if (Array.isArray(cell))
    return op === "notEquals" || op in NEGATED_TEXT
      ? cell.every((element) => viewCompare(op, element, value, options))
      : cell.some((element) => viewCompare(op, element, value, options));
  switch (op) {
    case "equals":
      return same(cell, value, options);
    case "notEquals":
      return !same(cell, value, options);
    case "contains":
    case "startsWith":
    case "endsWith":
      return textMatch(
        collatorOf(options.locale, options.sensitivity ?? "base"),
        op,
        text(cell),
        text(value),
      );
    case "notContains":
    case "notStartsWith":
    case "notEndsWith":
      return !textMatch(
        collatorOf(options.locale, options.sensitivity ?? "base"),
        NEGATED_TEXT[op],
        text(cell),
        text(value),
      );
    case "oneOf": {
      const wanted = viewValueList(value);
      return (
        wanted === "all" || wanted.some((item) => same(cell, item, options))
      );
    }
    case "gte":
    case "after": {
      const at = order(cell, value, options);
      return at !== undefined && (op === "gte" ? at >= 0 : at > 0);
    }
    case "gt": {
      const at = order(cell, value, options);
      return at !== undefined && at > 0;
    }
    case "lte":
    case "before": {
      const at = order(cell, value, options);
      return at !== undefined && (op === "lte" ? at <= 0 : at < 0);
    }
    case "lt": {
      const at = order(cell, value, options);
      return at !== undefined && at < 0;
    }
    case "between": {
      // (Both ends included; an empty end is open — a range field with one end set.)
      const [low, high] = Array.isArray(value) ? value : [];
      const above = viewValueIsEmpty(low) ? 0 : order(cell, low, options);
      const below = viewValueIsEmpty(high) ? 0 : order(cell, high, options);
      return (
        above !== undefined && below !== undefined && above >= 0 && below <= 0
      );
    }
    case "withinLast": {
      const day = viewDay(cell);
      const amount = numberOf(value);
      const today = options.today ?? viewDay(new Date())!;
      if (!day || amount === undefined) return false;
      const from = new Date(`${today}T00:00:00Z`);
      from.setUTCDate(
        from.getUTCDate() - amount * UNIT_DAYS[options.unit ?? "day"],
      );
      return day >= from.toISOString().slice(0, 10) && day <= today;
    }
    default:
      return false;
  }
}
