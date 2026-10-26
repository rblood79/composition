/**
 * ADR-284 Decision 6 — the local view evaluator: a pure function (a view chain + values + rows →
 * rows), shared by the Builder Canvas, the Preview and Publish (`catalogBoundRows` — one module, no
 * branch). It runs on the source's whole rows; the display window comes after (Decision 3 — a
 * match past the 100th row is a match).
 *
 * Order per view: conditions → (Phase 4: group · aggregate) → sort. A derived view runs on its
 * source view's result. The reference examples' shape (연구 §2): `items.filter(…conditions with
 * empty values passing…).toSorted(collator…)`.
 */
import type {
  DataFieldPath,
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../../catalog/document/types";
import {
  viewCompare,
  viewFieldKind,
  viewValueIsEmpty,
  viewValueList,
  type ViewFieldKind,
} from "./comparison";
import { catalogTableSortCompare } from "../../catalog/runtime/tableSort";

/** A source schema field (the data's `DataField` — `id` without the `data:field:` prefix). */
export interface ViewRunField {
  id: string;
  key: string;
  type?: string;
}

export interface ViewRunInput {
  /** The views from the source collection's to the bound one (a derived view's sources first). */
  queries: readonly ViewQuery[];
  schema: readonly ViewRunField[];
  /**
   * A value as the run reads it: a reference (`!var.<id>` · `!event.<arg>`) to its current value,
   * a literal to itself; undefined = a reference that does not resolve.
   */
  resolve(value: unknown): { value: unknown } | undefined;
  locale?: string;
  /** Today as `YYYY-MM-DD` (`withinLast`); absent = the clock's. */
  today?: string;
}

export interface ViewRunResult {
  rows: readonly unknown[];
  /** Conditions whose field or reference does not resolve: skipped, and shown as broken. */
  broken: readonly string[];
  /** Conditions that applied (not skipped) — 「적용 조건 수」. */
  applied: number;
}

/** A condition's verdict on a row: it holds · it does not · it is skipped (passes every row). */
export type ViewVerdict = "match" | "miss" | "skip";

const fieldId = (id: string) => id.replace(/^data:field:/, "");

/** The schema field a path's first step names (Phase 4: reference steps). */
function fieldOf(
  path: DataFieldPath,
  schema: readonly ViewRunField[],
): ViewRunField | undefined {
  if (path.length !== 1) return undefined;
  const id = fieldId(path[0]!);
  return schema.find((field) => field.id === id);
}

function cellOf(row: unknown, field: ViewRunField): unknown {
  return row !== null && typeof row === "object"
    ? (row as Record<string, unknown>)[field.key]
    : undefined;
}

/** A condition with its value read once per run (not per row). */
interface PreparedCondition {
  kind: "condition";
  id: string;
  skip: boolean;
  fields: { field: ViewRunField; kind: ViewFieldKind }[];
  condition: ViewCondition;
  value: unknown;
}
interface PreparedGroup {
  kind: "group";
  id: string;
  op: "and" | "or";
  items: (PreparedCondition | PreparedGroup)[];
}

function prepare(
  group: ViewConditionGroup,
  input: ViewRunInput,
  broken: string[],
): PreparedGroup {
  return {
    kind: "group",
    id: group.id,
    op: group.op,
    items: group.items.map((item) =>
      "items" in item
        ? prepare(item, input, broken)
        : prepareCondition(item, input, broken),
    ),
  };
}

function prepareCondition(
  condition: ViewCondition,
  input: ViewRunInput,
  broken: string[],
): PreparedCondition {
  const skipped = (isBroken: boolean): PreparedCondition => {
    if (isBroken) broken.push(condition.id);
    return {
      kind: "condition",
      id: condition.id,
      skip: true,
      fields: [],
      condition,
      value: undefined,
    };
  };
  const fields = condition.fields.map((path) => fieldOf(path, input.schema));
  if (fields.some((field) => !field)) return skipped(true);
  // 적용 여부 — a Checkbox's 「closed 제외」: false (or not set) skips.
  if (condition.enabled !== undefined) {
    const enabled = input.resolve(condition.enabled);
    if (!enabled) return skipped(true);
    if (enabled.value !== true && enabled.value !== "true")
      return skipped(false);
  }
  let value: unknown;
  if (condition.op !== "exists" && condition.op !== "notExists") {
    // (A list value — `oneOf` · `between` — may hold references in its cells.)
    const read = Array.isArray(condition.value)
      ? condition.value.map((cell) => input.resolve(cell))
      : input.resolve(condition.value);
    if (Array.isArray(read)) {
      if (read.some((cell) => !cell)) return skipped(true);
      value = read.map((cell) => cell!.value);
    } else {
      if (!read) return skipped(true);
      value = read.value;
    }
    const skipValue = condition.skip ?? "empty";
    // (`between` with both ends empty · a Selection of "all" pass every row.)
    const empty =
      condition.op === "between"
        ? Array.isArray(value) && value.every(viewValueIsEmpty)
        : viewValueIsEmpty(value) || viewValueList(value) === "all";
    if (skipValue === "empty" ? empty : empty || value === skipValue)
      return skipped(false);
  }
  return {
    kind: "condition",
    id: condition.id,
    skip: false,
    fields: (fields as ViewRunField[]).map((field) => ({
      field,
      kind: viewFieldKind(field.type),
    })),
    condition,
    value,
  };
}

function judge(
  item: PreparedCondition | PreparedGroup,
  row: unknown,
  input: ViewRunInput,
): ViewVerdict {
  if (item.kind === "condition") {
    if (item.skip) return "skip";
    const { condition } = item;
    // (Several fields: any field matching is a match — `name` OR `scientific` contains the search.)
    return item.fields.some(({ field, kind }) =>
      viewCompare(condition.op, cellOf(row, field), item.value, {
        kind,
        ...(condition.sensitivity
          ? { sensitivity: condition.sensitivity }
          : {}),
        ...(condition.unit ? { unit: condition.unit } : {}),
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.today ? { today: input.today } : {}),
      }),
    )
      ? "match"
      : "miss";
  }
  let applied = false;
  for (const child of item.items) {
    const verdict = judge(child, row, input);
    if (verdict === "skip") continue;
    applied = true;
    if (item.op === "and" && verdict === "miss") return "miss";
    if (item.op === "or" && verdict === "match") return "match";
  }
  // (A group whose items all skip is skipped; `and` with no miss matches, `or` with no match misses.)
  if (!applied) return "skip";
  return item.op === "and" ? "match" : "miss";
}

function countApplied(group: PreparedGroup): number {
  return group.items.reduce(
    (sum, item) =>
      sum + (item.kind === "group" ? countApplied(item) : item.skip ? 0 : 1),
    0,
  );
}

/** A sort's field and direction as the run reads them (a variable holds `{column, direction}`). */
function sortOf(
  query: ViewQuery,
  input: ViewRunInput,
): { field: ViewRunField; direction: "ascending" | "descending" } | undefined {
  const sort = query.sort;
  if (!sort) return undefined;
  if ("field" in sort) {
    const field = fieldOf(sort.field, input.schema);
    return field ? { field, direction: sort.direction } : undefined;
  }
  const value = input.resolve(`!var.${sort.variableId}`)?.value;
  if (!value || typeof value !== "object") return undefined;
  const { column, direction } = value as Record<string, unknown>;
  if (direction !== "ascending" && direction !== "descending") return undefined;
  const name = String(column ?? "");
  const field = input.schema.find(
    (item) => item.id === fieldId(name) || item.key === name,
  );
  return field ? { field, direction } : undefined;
}

/** One view over rows: its conditions, then its sort (stable). */
function runQuery(
  query: ViewQuery,
  rows: readonly unknown[],
  input: ViewRunInput,
  broken: string[],
): { rows: readonly unknown[]; applied: number } {
  const where = prepare(query.where, input, broken);
  const applied = countApplied(where);
  let out = applied
    ? rows.filter((row) => judge(where, row, input) !== "miss")
    : rows;
  const sort = sortOf(query, input);
  if (sort) {
    const sign = sort.direction === "descending" ? -1 : 1;
    out = out
      .map((row, index) => ({ row, index, value: cellOf(row, sort.field) }))
      .sort(
        (a, b) =>
          sign * catalogTableSortCompare(a.value, b.value) || a.index - b.index,
      )
      .map((item) => item.row);
  }
  return { rows: out, applied };
}

/** The view chain over a source's whole rows. */
export function runViewQueries(
  rows: readonly unknown[],
  input: ViewRunInput,
): ViewRunResult {
  const broken: string[] = [];
  let out = rows;
  let applied = 0;
  for (const query of input.queries) {
    const result = runQuery(query, out, input, broken);
    out = result.rows;
    applied = result.applied;
  }
  return { rows: out, broken, applied };
}

/**
 * Each condition's verdict on one row (the run explanation — Decision 11): the same prepared
 * conditions and the same judge as the run, for the view at `queryIndex` of the chain.
 */
export function explainViewRow(
  row: unknown,
  input: ViewRunInput,
  queryIndex = input.queries.length - 1,
): ReadonlyMap<string, ViewVerdict> {
  const verdicts = new Map<string, ViewVerdict>();
  const query = input.queries[queryIndex];
  if (!query) return verdicts;
  const visit = (item: PreparedCondition | PreparedGroup): ViewVerdict => {
    const verdict = judge(item, row, input);
    verdicts.set(item.id, verdict);
    if (item.kind === "group") item.items.forEach(visit);
    return verdict;
  };
  visit(prepare(query.where, input, []));
  return verdicts;
}
