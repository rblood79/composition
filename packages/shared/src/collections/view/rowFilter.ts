/**
 * ADR-315 Phase 3 — the rows a Table's state keeps (its search · its column filters), as row
 * numbers: the row source filters the numbers its sort ordered, before its window · page cuts them
 * (HC3), so a search typed on never sorts again. A test is a view condition read by key — the
 * comparison is the views' own (`viewCompare`, HC2 — no second comparison), and so is what skips
 * a test (`viewConditionSkips`). The same slices as a view's conditions run through
 * `runViewQueries` keep the same rows (`tableStateQuery.test.ts`).
 *
 * The search test reads several fields (any of them matching is a match — TanStack's global
 * filter) and may be fuzzy (`fuzzy.ts` — the grades come back as `rank`).
 *
 * 「이어 치기」 — a search typed on (`ab` → `abc`): a row every searched cell of which certainly
 * missed the shorter search is not compared again. 「Certainly」 is narrow on purpose: the cell and
 * both searches are plain text under a collator that folds it one way (`viewPlainContainsMiss` —
 * the comparison's own 「no hit is the answer」; fuzzy: the units not in order). Anything else — Hangul,
 * a collator reading two letters as one — is compared every time: the search collator is not
 * monotone there (`간ㅏ` is `가나`, which does not contain `간`).
 */
import type {
  ViewComparison,
  ViewCondition,
} from "../../catalog/document/types";
import {
  viewCompare,
  viewConditionSkips,
  viewFieldKind,
  viewPlainContainsMiss,
  viewPlainFold,
  type ViewFieldKind,
} from "./comparison";
import {
  VIEW_FUZZY_NO_MATCH,
  viewFuzzyMisses,
  viewFuzzyRank,
  viewFuzzySearch,
} from "./fuzzy";

/** A field a test reads: the value of row `index`, and the field's data type. */
export interface ViewRowTestField {
  readonly valueAt: (index: number) => unknown;
  /** The field's data type (`viewFieldKind`); absent = text. */
  readonly type?: string;
  /** The field's name among the rows (the search's kept misses are by the fields' names). */
  readonly name?: string;
}

/** One test of a row: a condition over fields read by a function. */
export interface ViewRowTest {
  readonly fields: readonly ViewRowTestField[];
  readonly op: ViewComparison;
  readonly value?: unknown;
  readonly sensitivity?: ViewCondition["sensitivity"];
  readonly unit?: ViewCondition["unit"];
  /**
   * The Table's search: `contains` over its fields — `"fuzzy"` grades the match instead
   * (`viewFuzzyRank`). One test of a run at most.
   */
  readonly search?: "contains" | "fuzzy";
}

export interface ViewRowsKept {
  /** `pass[index] === 1` — the row passes every test; undefined = no test applies (every row). */
  readonly pass: Uint8Array | undefined;
  /** A fuzzy search's rank of each passing row (a smaller number is a better match). */
  readonly rank?: Uint16Array;
}

export interface ViewRowsOptions {
  readonly locale?: string;
  /** Today as `YYYY-MM-DD` (`withinLast`). */
  readonly today?: string;
  /** The rows the tests read: a search's certain misses are kept for the next, longer search. */
  readonly rows?: object;
}

/** The last search of a rows · fields: its text and the rows that certainly missed it. */
interface KeptSearch {
  readonly text: string;
  readonly miss: Uint8Array;
}
const keptSearches = new WeakMap<object, Map<string, KeptSearch>>();

const textOf = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

interface Prepared {
  readonly test: ViewRowTest;
  /** What `viewCompare` reads besides the cell and the value, a field. */
  readonly compare: readonly {
    kind: ViewFieldKind;
    sensitivity?: ViewCondition["sensitivity"];
    unit?: ViewCondition["unit"];
    locale?: string;
    today?: string;
  }[];
}

/**
 * The rows of `count` that pass every test (a test whose value skips it passes every row —
 * `viewConditionSkips`).
 */
export function viewRowsPassing(
  count: number,
  tests: readonly ViewRowTest[],
  options: ViewRowsOptions = {},
): ViewRowsKept {
  const applied: Prepared[] = [];
  let search: Prepared | undefined;
  for (const test of tests) {
    if (!test.fields.length) continue;
    if (
      test.op !== "exists" &&
      test.op !== "notExists" &&
      viewConditionSkips(test.op, test.value)
    )
      continue;
    const prepared = {
      test,
      compare: test.fields.map((field) => ({
        kind: viewFieldKind(field.type),
        ...(test.sensitivity ? { sensitivity: test.sensitivity } : {}),
        ...(test.unit ? { unit: test.unit } : {}),
        ...(options.locale ? { locale: options.locale } : {}),
        ...(options.today ? { today: options.today } : {}),
      })),
    };
    if (test.search) search = prepared;
    else applied.push(prepared);
  }
  if (!applied.length && !search) return { pass: undefined };
  const pass = new Uint8Array(count).fill(1);
  const compare = (prepared: Prepared, index: number): boolean => {
    const { test } = prepared;
    for (let at = 0; at < test.fields.length; at += 1)
      if (
        viewCompare(
          test.op,
          test.fields[at]!.valueAt(index),
          test.value,
          prepared.compare[at]!,
        )
      )
        return true;
    return false;
  };
  for (const prepared of applied)
    for (let index = 0; index < count; index += 1)
      if (pass[index] && !compare(prepared, index)) pass[index] = 0;
  if (!search) return { pass };

  const { test } = search;
  const text = textOf(test.value);
  const fuzzy =
    test.search === "fuzzy"
      ? viewFuzzySearch(text, options.locale, test.sensitivity)
      : undefined;
  const rank = fuzzy ? new Uint16Array(count) : undefined;
  // (A certain miss: the plain path's — the comparison's own answer for a plain cell.)
  const plainMiss = viewPlainContainsMiss(
    options.locale,
    test.sensitivity,
    text,
  );
  const certain = plainMiss
    ? fuzzy
      ? // (Fuzzy: a plain cell without the search's units in order — the collator folds plain
        //  text as the units do, checked above by `plainMiss` being there.)
        (cell: string) => plainMiss(cell) && viewFuzzyMisses(cell, fuzzy)
      : plainMiss
    : undefined;
  const name =
    options.rows && test.fields.every((field) => field.name !== undefined)
      ? JSON.stringify([
          test.fields.map((field) => field.name),
          test.search,
          test.sensitivity ?? "base",
          options.locale ?? "",
          viewPlainFold(options.locale, test.sensitivity),
        ])
      : undefined;
  let held = name ? keptSearches.get(options.rows!) : undefined;
  const last = name ? held?.get(name) : undefined;
  // (Typed on: the last search is in this one, and its certain misses are this one's.)
  const skip =
    last &&
    certain &&
    last.text.length > 0 &&
    last.miss.length === count &&
    text.includes(last.text)
      ? last.miss
      : undefined;
  const miss = name && certain ? new Uint8Array(count) : undefined;
  const contains = {
    kind: "text" as const,
    ...(test.sensitivity ? { sensitivity: test.sensitivity } : {}),
    ...(options.locale ? { locale: options.locale } : {}),
  };
  for (let index = 0; index < count; index += 1) {
    // (A row another test dropped is not searched: not known to be a certain miss.)
    if (!pass[index]) continue;
    if (skip?.[index]) {
      pass[index] = 0;
      miss![index] = 1;
      continue;
    }
    let best = VIEW_FUZZY_NO_MATCH;
    let hit = false;
    let missed = !!certain;
    for (let at = 0; at < test.fields.length; at += 1) {
      const value = test.fields[at]!.valueAt(index);
      // (A list cell matches when any element does — `viewCompare`; never a certain miss.)
      const cells = Array.isArray(value) ? value : [value];
      if (Array.isArray(value)) missed = false;
      for (const item of cells) {
        const cell = textOf(item);
        if (certain?.(cell)) continue;
        missed = false;
        if (fuzzy) {
          const grade = viewFuzzyRank(cell, fuzzy);
          if (grade !== VIEW_FUZZY_NO_MATCH && (best < 0 || grade < best))
            best = grade;
        } else if (viewCompare("contains", cell, text, contains)) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (fuzzy) {
      if (best < 0) pass[index] = 0;
      else rank![index] = best;
    } else if (!hit) pass[index] = 0;
    if (miss && missed) miss[index] = 1;
  }
  if (name && miss) {
    if (!held) keptSearches.set(options.rows!, (held = new Map()));
    // (A few searches per rows — a Table's; the oldest goes first.)
    if (!held.has(name) && held.size >= 4)
      held.delete(held.keys().next().value!);
    held.set(name, { text, miss });
  } else if (name) held?.delete(name);
  return rank ? { pass, rank } : { pass };
}

/**
 * ADR-320 Decision 3 — tests joined by `and` · `or`: a condition group read by key (the Table's
 * search is never one of them — it stays a test of its own, `viewRowsPassing`).
 */
export interface ViewRowTestGroup {
  readonly op: "and" | "or";
  readonly items: readonly (ViewRowTest | ViewRowTestGroup)[];
}
const isTestGroup = (
  item: ViewRowTest | ViewRowTestGroup,
): item is ViewRowTestGroup => "items" in item;

/**
 * ADR-320 Decision 3 — the rows a group of tests keeps (`pass[index] === 1`), as the one evaluator
 * judges a group (`evaluate.ts` `judge`): a test whose value skips it and a group whose items all
 * skip are no operand — an `and` keeps the rows every applied item keeps, an `or` the rows any of
 * them keeps (a skipped item is never 「every row」 joined to an `or`). Undefined = the group is
 * skipped (no item applies — every row).
 *
 * An `and`'s own tests run together (`viewRowsPassing` — a row one test dropped is not compared
 * again); an `or`'s run one by one over every row.
 */
export function viewRowsPassingGroup(
  count: number,
  group: ViewRowTestGroup,
  options: Pick<ViewRowsOptions, "locale" | "today"> = {},
): Uint8Array | undefined {
  let out: Uint8Array | undefined;
  const join = (pass: Uint8Array | undefined) => {
    if (!pass) return;
    if (!out) {
      // (Each call's flags are its own array — the first one is kept as the result.)
      out = pass;
      return;
    }
    if (group.op === "and")
      for (let index = 0; index < count; index += 1)
        out[index]! &= pass[index]!;
    else
      for (let index = 0; index < count; index += 1)
        out[index]! |= pass[index]!;
  };
  if (group.op === "and") {
    const own = group.items.filter(
      (item): item is ViewRowTest => !isTestGroup(item),
    );
    if (own.length) join(viewRowsPassing(count, own, options).pass);
  }
  for (const item of group.items) {
    if (isTestGroup(item)) join(viewRowsPassingGroup(count, item, options));
    else if (group.op === "or")
      join(viewRowsPassing(count, [item], options).pass);
  }
  return out;
}
