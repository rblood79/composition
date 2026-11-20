/**
 * ADR-315 Phase 2 — the one sort of rows: a view's sort (`runViewQueries`) and a Table's header
 * sort (`catalogBoundRows`) both order row numbers here (HC2 — no second sort; HC3 — row numbers,
 * before any window cuts them).
 *
 * Each sort entry's values become ranks once (a number · a time · 0/1 · the collator's place of a
 * text), then every comparison is of two numbers — TanStack lowercases a text at each comparison
 * (ADR-315 F12). A column's ranks are kept per rows (`cache`): another direction, or the column as
 * a second entry, reads no value again.
 *
 * Empty values (`undefined` · `null` · `""` · a value its field's type cannot read) stand apart
 * from the direction: last unless the entry says first (TanStack `sortUndefined: 'last'`).
 */
import { viewFieldKind } from "./comparison";

export type ViewSortDirection = "ascending" | "descending";

/** One sort entry as the order reads it. */
export interface ViewSortKey {
  /** The value row `index` sorts by. */
  readonly valueAt: (index: number) => unknown;
  readonly direction: ViewSortDirection;
  /** The field's data type (`viewFieldKind`); absent = by the values (all numbers, else text). */
  readonly type?: string;
  /** Where the empty values go (both directions). Absent = last. */
  readonly empty?: "first" | "last";
  /** The rows the values are of and the column's name among them: its ranks are kept. */
  readonly cache?: { readonly rows: object; readonly name: string };
}

const COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === "";

/** A date value's time: an ISO text · a timestamp · a `Date` · a `CalendarDate`-like object. */
function timeOf(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value);
  if (value !== null && typeof value === "object") {
    const { year, month, day, hour, minute, second } = value as Record<
      string,
      unknown
    >;
    if (
      typeof year === "number" &&
      typeof month === "number" &&
      typeof day === "number"
    )
      return Date.UTC(
        year,
        month - 1,
        day,
        typeof hour === "number" ? hour : 0,
        typeof minute === "number" ? minute : 0,
        typeof second === "number" ? second : 0,
      );
  }
  return Number.NaN;
}

/** Ranks of `count` values (ascending — a smaller rank first); `NaN` = an empty value. */
function ranksOf(
  count: number,
  valueAt: (index: number) => unknown,
  type: string | undefined,
): Float64Array {
  const ranks = new Float64Array(count);
  const values = new Array<unknown>(count);
  let numeric = type === undefined;
  for (let index = 0; index < count; index += 1) {
    const value = valueAt(index);
    values[index] = value;
    if (numeric && !isEmpty(value) && typeof value !== "number")
      numeric = false;
  }
  const kind = type === undefined ? undefined : viewFieldKind(type);
  if (kind === "number" || (kind === undefined && numeric)) {
    for (let index = 0; index < count; index += 1) {
      const value = values[index];
      ranks[index] =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : Number.NaN;
    }
    return ranks;
  }
  if (kind === "date") {
    for (let index = 0; index < count; index += 1)
      ranks[index] = isEmpty(values[index])
        ? Number.NaN
        : timeOf(values[index]);
    return ranks;
  }
  if (kind === "boolean") {
    for (let index = 0; index < count; index += 1)
      ranks[index] =
        values[index] === true ? 1 : values[index] === false ? 0 : Number.NaN;
    return ranks;
  }
  // (Text: the collator places the texts once; equal texts — `a` · `A` — share a rank.)
  const texts = new Array<string>(count);
  const filled: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = values[index];
    if (isEmpty(value)) {
      ranks[index] = Number.NaN;
      continue;
    }
    texts[index] =
      typeof value === "string"
        ? value
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    filled.push(index);
  }
  filled.sort((a, b) => COLLATOR.compare(texts[a]!, texts[b]!));
  let rank = 0;
  for (let place = 0; place < filled.length; place += 1) {
    if (
      place > 0 &&
      COLLATOR.compare(texts[filled[place - 1]!]!, texts[filled[place]!]!) !== 0
    )
      rank += 1;
    ranks[filled[place]!] = rank;
  }
  return ranks;
}

/** A column's ranks per rows (a few columns per rows — the oldest goes first). */
const keptRanks = new WeakMap<object, Map<string, Float64Array>>();

function keyRanks(count: number, key: ViewSortKey): Float64Array {
  if (!key.cache) return ranksOf(count, key.valueAt, key.type);
  let held = keptRanks.get(key.cache.rows);
  if (!held) keptRanks.set(key.cache.rows, (held = new Map()));
  const name = `${key.type ?? ""}\0${key.cache.name}`;
  let ranks = held.get(name);
  if (!ranks || ranks.length !== count) {
    ranks = ranksOf(count, key.valueAt, key.type);
    if (held.size >= 8) held.delete(held.keys().next().value!);
    held.set(name, ranks);
  }
  return ranks;
}

/**
 * The numbers of `count` rows in the order of `keys` (the first entry, then the next among its
 * equal rows …; stable — rows equal by every entry keep their own order).
 */
export function viewSortOrder(
  count: number,
  keys: readonly ViewSortKey[],
): Uint32Array {
  const order = new Uint32Array(count);
  for (let index = 0; index < count; index += 1) order[index] = index;
  if (!keys.length || count < 2) return order;
  const ranks = keys.map((key) => keyRanks(count, key));
  const signs = keys.map((key) => (key.direction === "descending" ? -1 : 1));
  const empties = keys.map((key) => (key.empty === "first" ? -1 : 1));
  const size = keys.length;
  return order.sort((a, b) => {
    for (let entry = 0; entry < size; entry += 1) {
      const x = ranks[entry]![a]!;
      const y = ranks[entry]![b]!;
      if (x === y) continue;
      const emptyX = x !== x;
      const emptyY = y !== y;
      if (emptyX && emptyY) continue;
      if (emptyX) return empties[entry]!;
      if (emptyY) return -empties[entry]!;
      return signs[entry]! * (x < y ? -1 : 1);
    }
    return a - b;
  });
}
