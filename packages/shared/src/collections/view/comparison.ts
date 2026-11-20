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

/**
 * Whether a condition's value skips it (it passes every row): the default — no value · `""` · an
 * empty list · a Selection of `"all"` (`between`: both ends empty) — or the condition's own skip
 * value too. One rule for a view's condition (`readViewCondition`) and a Table state's
 * (`rowFilter.ts`).
 */
export function viewConditionSkips(
  op: ViewComparison,
  value: unknown,
  skip: ViewCondition["skip"] = "empty",
): boolean {
  const empty =
    op === "between"
      ? Array.isArray(value) && value.every(viewValueIsEmpty)
      : viewValueIsEmpty(value) || viewValueList(value) === "all";
  return skip === "empty" ? empty : empty || value === skip;
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

/**
 * Text the plain path of `contains` reads: printable ASCII. NFC leaves it as it is, no unit of it
 * is ignorable to a collator or expands into two, and lower-casing keeps its length.
 * (Hangul is not plain: the search collator reads a syllable as its letters — `각가` is `가까`,
 * `간ㅏ` is `가나` — so a folded `includes` misses matches. It takes the scan, `unitClassesOf`.)
 */
const PLAIN_TEXT = /^[\x20-\x7E]*$/;
/** How a collator's equality of plain text folds: case-less, as written, or neither (`null`). */
type PlainFold = "lower" | "same" | null;
const plainFolds = new WeakMap<Intl.Collator, PlainFold>();
/**
 * The fold under which two plain units are the same unit exactly when the collator says so —
 * read from the collator itself, once: every pair of printable ASCII units (Turkish `I` is not
 * `i`, Lithuanian `y` is `i`, Thai ignores punctuation — neither fold is theirs: `null`).
 */
function plainFoldOf(collator: Intl.Collator): PlainFold {
  let fold = plainFolds.get(collator);
  if (fold !== undefined) return fold;
  const units = Array.from({ length: 0x7f - 0x20 }, (_, index) =>
    String.fromCharCode(0x20 + index),
  );
  let lower = true;
  let same = true;
  for (let a = 0; a < units.length && (lower || same); a += 1)
    for (let b = a + 1; b < units.length; b += 1) {
      const equal = collator.compare(units[a]!, units[b]!) === 0;
      if (equal) same = false;
      if (equal !== (units[a]!.toLowerCase() === units[b]!.toLowerCase()))
        lower = false;
    }
  fold = same ? "same" : lower ? "lower" : null;
  plainFolds.set(collator, fold);
  return fold;
}

/**
 * ADR-315 Phase 3 — how a collator folds plain text (`plainFoldOf`), for a reader that folds a text
 * itself (the fuzzy search's units): case-less, as written, or neither (`null`).
 */
export function viewPlainFold(
  locale: string | undefined,
  sensitivity: ViewCondition["sensitivity"],
): "lower" | "same" | null {
  return plainFoldOf(collatorOf(locale, sensitivity ?? "base"));
}

/**
 * ADR-315 Phase 3 — `contains` of a plain search, as its plain path answers one cell: the returned
 * function is true where the cell is plain and its folded text holds no hit — `textMatch`'s 「no hit
 * is the answer」. A search typed on (`ab` → `abc`) cannot hit where its beginning did not, so a
 * row every searched cell of which missed this way stays a miss (`rowFilter.ts`). Undefined = the
 * search is not plain, or the collator folds plain text neither way: every cell is compared.
 */
export function viewPlainContainsMiss(
  locale: string | undefined,
  sensitivity: ViewCondition["sensitivity"],
  search: string,
): ((cell: string) => boolean) | undefined {
  if (!search.length || !PLAIN_TEXT.test(search)) return undefined;
  const fold = plainFoldOf(collatorOf(locale, sensitivity ?? "base"));
  if (!fold) return undefined;
  const lower = fold === "lower";
  const folded = lower ? search.toLowerCase() : search;
  return (cell) =>
    PLAIN_TEXT.test(cell) &&
    (lower ? cell.toLowerCase() : cell).indexOf(folded) < 0;
}

/** The Hangul letters a syllable is read as, one a class (consonants, then vowels). */
const HANGUL_LETTERS = "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ";
/** A syllable's leading consonant as those letters, in the syllables' order (`ㄲ` = `ㄱㄱ`). */
const HANGUL_LEADS = [
  "ㄱ",
  "ㄱㄱ",
  "ㄴ",
  "ㄷ",
  "ㄷㄷ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅂㅂ",
  "ㅅ",
  "ㅅㅅ",
  "ㅇ",
  "ㅈ",
  "ㅈㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];
const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JAMO_FIRST = 0x3131;
const JAMO_LAST = 0x3163;
/**
 * The letter a unit begins with, as a collator reads it — its class (−1 = not known): two texts
 * a collator finds equal begin with the same letter, so a slice beginning with another letter than
 * the search is not compared at all (`textMatch`'s scan).
 */
interface UnitClasses {
  /** Printable ASCII by its fold (none when the collator's ASCII is neither fold — `plainFoldOf`). */
  readonly ascii: Int16Array | undefined;
  /** A Hangul syllable by its leading consonant's first letter. */
  readonly lead: Int16Array;
  /** A Hangul compatibility jamo that is one of the letters. */
  readonly jamo: Int16Array;
}
const unitClasses = new WeakMap<Intl.Collator, UnitClasses>();
/**
 * A collator's unit classes, read from the collator itself, once — `base` is the locale's
 * base-sensitivity collator (texts a stricter one finds equal are equal to it too). A class is
 * given only where the collator shows it: the letters differ from each other and from nothing,
 * and a syllable equals its leading consonant's letters before its vowel (`까` = `ㄱㄱㅏ` to the
 * search collator; not to a sort collator — its `까` then has no class and is always compared).
 */
function unitClassesOf(base: Intl.Collator): UnitClasses {
  let classes = unitClasses.get(base);
  if (classes) return classes;
  const fold = plainFoldOf(base);
  let ascii: Int16Array | undefined;
  if (fold) {
    ascii = new Int16Array(0x80).fill(-1);
    for (let code = 0x20; code < 0x7f; code += 1)
      ascii[code] =
        fold === "lower"
          ? String.fromCharCode(code).toLowerCase().charCodeAt(0)
          : code;
  }
  const letters = [...HANGUL_LETTERS];
  const lettersDiffer = letters.every(
    (letter, at) =>
      base.compare(letter, "") !== 0 &&
      base.compare(letter, "a") !== 0 &&
      letters.every(
        (other, index) => index <= at || base.compare(letter, other) !== 0,
      ),
  );
  const classOf = (letter: string) => 0x100 + HANGUL_LETTERS.indexOf(letter);
  const lead = new Int16Array(HANGUL_LEADS.length).fill(-1);
  const jamo = new Int16Array(JAMO_LAST - JAMO_FIRST + 1).fill(-1);
  if (lettersDiffer) {
    HANGUL_LEADS.forEach((spelled, index) => {
      const syllable = String.fromCharCode(HANGUL_FIRST + index * 588);
      if (base.compare(syllable, `${spelled}ㅏ`) === 0)
        lead[index] = classOf(spelled[0]!);
    });
    for (const letter of letters)
      jamo[letter.charCodeAt(0) - JAMO_FIRST] = classOf(letter);
  }
  classes = { ascii, lead, jamo };
  unitClasses.set(base, classes);
  return classes;
}
function unitClass(classes: UnitClasses, code: number): number {
  if (code < 0x80) return classes.ascii ? classes.ascii[code]! : -1;
  if (code >= HANGUL_FIRST && code <= HANGUL_LAST)
    return classes.lead[((code - HANGUL_FIRST) / 588) | 0]!;
  if (code >= JAMO_FIRST && code <= JAMO_LAST)
    return classes.jamo[code - JAMO_FIRST]!;
  return -1;
}

/** Text NFC leaves as it is: ASCII, Hangul syllables and compatibility jamo. */
const NFC_STABLE = /^[\x00-\x7F\u3131-\u3163\uAC00-\uD7A3]*$/;
/** `text` in NFC (a text of stable units is not normalized again — every cell of a filter run). */
const nfc = (value: string): string =>
  NFC_STABLE.test(value) ? value : value.normalize("NFC");

/** `useFilter`'s `contains` · `startsWith` · `endsWith` (same scan, same collator). */
function textMatch(
  locale: string | undefined,
  sensitivity: NonNullable<ViewCondition["sensitivity"]>,
  op: "contains" | "startsWith" | "endsWith",
  cell: string,
  search: string,
): boolean {
  if (search.length === 0) return true;
  const collator = collatorOf(locale, sensitivity);
  // (Plain text: one `includes` of the folded cell — the scan below compares a slice at every
  //  unit of every cell, 12 ~ 19 ms a run of 10,000 rows × 3 fields where this takes 0.3 ~ 0.4,
  //  2026-11-20. No hit is the answer; a hit is the collator's to confirm — a digraph its locale
  //  reads as one letter (`cH` is not `ch` in Slovak) falls to the scan.)
  if (op === "contains" && PLAIN_TEXT.test(search) && PLAIN_TEXT.test(cell)) {
    const fold = plainFoldOf(collator);
    if (fold) {
      const at =
        fold === "lower"
          ? cell.toLowerCase().indexOf(search.toLowerCase())
          : cell.indexOf(search);
      if (at < 0) return false;
      if (collator.compare(search, cell.slice(at, at + search.length)) === 0)
        return true;
    }
  }
  const string = nfc(cell);
  const substring = nfc(search);
  if (op === "startsWith")
    return collator.compare(string.slice(0, substring.length), substring) === 0;
  if (op === "endsWith")
    return collator.compare(string.slice(-substring.length), substring) === 0;
  // (A slice beginning with another letter than the search is not the search — `unitClassesOf`:
  //  Hangul text is compared where a syllable begins with the search's first letter, about one
  //  unit in ten.)
  const classes = unitClassesOf(collatorOf(locale, "base"));
  const wanted = unitClass(classes, substring.charCodeAt(0));
  for (let scan = 0; scan + substring.length <= string.length; scan++) {
    if (wanted >= 0) {
      const found = unitClass(classes, string.charCodeAt(scan));
      if (found >= 0 && found !== wanted) continue;
    }
    if (
      collator.compare(
        substring,
        string.slice(scan, scan + substring.length),
      ) === 0
    )
      return true;
  }
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
    if (
      year !== undefined ||
      typeof hour !== "number" ||
      typeof minute !== "number"
    )
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

/** The key of every empty value (`viewEqualityKeys`). */
export const VIEW_EMPTY_KEY = "\0empty";

/**
 * ADR-315 Phase 3 — a key a value, for a filter's candidate values (`ViewQuery.facet`): two values
 * of a field have the same key exactly when `equals` holds them the same (`same` — text by the
 * search collator at the default sensitivity: `A` · `a` are one candidate; a number by value, a
 * date by its day · time) and every empty value has the one empty key. So a candidate's count is
 * the rows choosing it gives.
 */
export function viewEqualityKeys(
  values: readonly unknown[],
  options: ViewCompareOptions,
): string[] {
  const keys = new Array<string>(values.length);
  const texts = new Map<string, number[]>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (viewValueIsEmpty(value)) {
      keys[index] = VIEW_EMPTY_KEY;
      continue;
    }
    if (options.kind === "number") {
      const number = numberOf(value);
      if (number !== undefined) {
        keys[index] = `n:${number}`;
        continue;
      }
    } else if (options.kind === "boolean") {
      if (value === true || value === "true") keys[index] = "b:1";
      else if (value === false || value === "false") keys[index] = "b:0";
      if (keys[index] !== undefined) continue;
    } else if (options.kind === "date") {
      const at = viewTime(value) ?? viewDay(value);
      if (at !== undefined) {
        keys[index] = `d:${at}`;
        continue;
      }
    }
    // (Text — and a value its field's type cannot read: by its text.)
    const string = text(value);
    const held = texts.get(string);
    if (held) held.push(index);
    else texts.set(string, [index]);
  }
  if (texts.size) {
    // (The distinct texts in the collator's order: equal ones stand together — one class.)
    const collator = collatorOf(options.locale, options.sensitivity ?? "base");
    const distinct = [...texts.keys()].sort(collator.compare);
    let first = distinct[0]!;
    for (const string of distinct) {
      if (collator.compare(first, string) !== 0) first = string;
      for (const index of texts.get(string)!) keys[index] = `t:${first}`;
    }
  }
  return keys;
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
        options.locale,
        options.sensitivity ?? "base",
        op,
        text(cell),
        text(value),
      );
    case "notContains":
    case "notStartsWith":
    case "notEndsWith":
      return !textMatch(
        options.locale,
        options.sensitivity ?? "base",
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
