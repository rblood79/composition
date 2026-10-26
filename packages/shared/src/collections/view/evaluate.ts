/**
 * ADR-284 Decision 6 — the local view evaluator: a pure function (a view chain + values + rows →
 * rows), shared by the Builder Canvas, the Preview and Publish (`catalogBoundRows` — one module, no
 * branch). It runs on the source's whole rows; the display window comes after (Decision 3 — a
 * match past the 100th row is a match).
 *
 * Order per view: conditions → group · aggregate → sort. A derived view runs on its source view's
 * result and reads its schema (a grouped view's rows are its group fields and its aggregates — the
 * sort and the next view name them by id). The reference examples' shape (연구 §2):
 * `items.filter(…conditions with empty values passing…).toSorted(collator…)`, a count is
 * `reduce`.
 */
import type {
  DataFieldPath,
  ViewAggregate,
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
  /** The result rows' fields: the source's, or a grouped view's group fields and aggregates. */
  schema: readonly ViewRunField[];
  /** Conditions whose field or reference does not resolve: skipped, and shown as broken. */
  broken: readonly string[];
  /** Conditions that applied (not skipped) — 「적용 조건 수」. */
  applied: number;
}

/** A condition's verdict on a row: it holds · it does not · it is skipped (passes every row). */
export type ViewVerdict = "match" | "miss" | "skip";

const fieldId = (id: string) => id.replace(/^data:field:/, "");

/** The schema field a path's first step names (Phase 4: reference steps). */
export function viewFieldOf(
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

/**
 * A condition as a run reads it once: its fields, whether it applies (`enabled` · the skip value ·
 * an empty value) and its value with references read. `broken` = a field or a reference that does
 * not resolve (the condition is skipped and shown as broken). The local evaluator and the API
 * serializer read the same answer (ADR-284 R1 — one skip rule for both).
 */
export function readViewCondition(
  condition: ViewCondition,
  input: Pick<ViewRunInput, "schema" | "resolve">,
):
  | { skip: true; broken: boolean }
  | { skip: false; fields: ViewRunField[]; value: unknown } {
  const fields = condition.fields.map((path) =>
    viewFieldOf(path, input.schema),
  );
  if (fields.some((field) => !field)) return { skip: true, broken: true };
  // 적용 여부 — a Checkbox's 「closed 제외」: false (or not set) skips.
  if (condition.enabled !== undefined) {
    const enabled = input.resolve(condition.enabled);
    if (!enabled) return { skip: true, broken: true };
    if (enabled.value !== true && enabled.value !== "true")
      return { skip: true, broken: false };
  }
  let value: unknown;
  if (condition.op !== "exists" && condition.op !== "notExists") {
    // (A list value — `oneOf` · `between` — may hold references in its cells.)
    const read = Array.isArray(condition.value)
      ? condition.value.map((cell) => input.resolve(cell))
      : input.resolve(condition.value);
    if (Array.isArray(read)) {
      if (read.some((cell) => !cell)) return { skip: true, broken: true };
      value = read.map((cell) => cell!.value);
    } else {
      if (!read) return { skip: true, broken: true };
      value = read.value;
    }
    const skipValue = condition.skip ?? "empty";
    // (`between` with both ends empty · a Selection of "all" pass every row.)
    const empty =
      condition.op === "between"
        ? Array.isArray(value) && value.every(viewValueIsEmpty)
        : viewValueIsEmpty(value) || viewValueList(value) === "all";
    if (skipValue === "empty" ? empty : empty || value === skipValue)
      return { skip: true, broken: false };
  }
  return { skip: false, fields: fields as ViewRunField[], value };
}

function prepareCondition(
  condition: ViewCondition,
  input: ViewRunInput,
  broken: string[],
): PreparedCondition {
  const read = readViewCondition(condition, input);
  if (read.skip) {
    if (read.broken) broken.push(condition.id);
    return {
      kind: "condition",
      id: condition.id,
      skip: true,
      fields: [],
      condition,
      value: undefined,
    };
  }
  return {
    kind: "condition",
    id: condition.id,
    skip: false,
    fields: read.fields.map((field) => ({
      field,
      kind: viewFieldKind(field.type),
    })),
    condition,
    value: read.value,
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
  schema: readonly ViewRunField[],
): { field: ViewRunField; direction: "ascending" | "descending" } | undefined {
  const sort = query.sort;
  if (!sort) return undefined;
  if ("field" in sort) {
    const field = viewFieldOf(sort.field, schema);
    return field ? { field, direction: sort.direction } : undefined;
  }
  const value = input.resolve(`!var.${sort.variableId}`)?.value;
  if (!value || typeof value !== "object") return undefined;
  const { column, direction } = value as Record<string, unknown>;
  if (direction !== "ascending" && direction !== "descending") return undefined;
  const name = String(column ?? "");
  const field = schema.find(
    (item) => item.id === fieldId(name) || item.key === name,
  );
  return field ? { field, direction } : undefined;
}

/** The broken marks of a grouping · an aggregate whose field does not resolve. */
export const VIEW_GROUP_BROKEN = "groupBy";
export const viewAggregateBroken = (aggregate: ViewAggregate) =>
  `aggregate:${aggregate.as}`;

/**
 * A grouped view's result fields: its group fields as the source has them, then each aggregate
 * (`id` = `key` = its `as`; a count · sum · mean is a number, a min · max keeps its field's type).
 * A view without grouping or aggregates keeps the source's.
 */
export function viewResultSchema(
  query: ViewQuery,
  schema: readonly ViewRunField[],
): readonly ViewRunField[] {
  if (!query.groupBy && !query.aggregates) return schema;
  const fields: ViewRunField[] = [];
  for (const path of query.groupBy ?? []) {
    const field = viewFieldOf(path, schema);
    if (field) fields.push(field);
  }
  for (const aggregate of query.aggregates ?? []) {
    const source =
      aggregate.field && (aggregate.fn === "min" || aggregate.fn === "max")
        ? viewFieldOf(aggregate.field, schema)
        : undefined;
    fields.push({
      id: aggregate.as,
      key: aggregate.as,
      type: source?.type ?? "number",
    });
  }
  return fields;
}

const groupKeyOf = (value: unknown) =>
  JSON.stringify(value === undefined ? null : value);

function aggregateOf(
  aggregate: ViewAggregate,
  field: ViewRunField | undefined,
  rows: readonly unknown[],
): unknown {
  if (aggregate.fn === "count") return rows.length;
  if (!field) return null;
  const cells = rows
    .map((row) => cellOf(row, field))
    .filter((cell) => !viewValueIsEmpty(cell));
  if (aggregate.fn === "min" || aggregate.fn === "max") {
    if (!cells.length) return null;
    const sign = aggregate.fn === "min" ? 1 : -1;
    return cells.reduce((best, cell) =>
      sign * catalogTableSortCompare(cell, best) < 0 ? cell : best,
    );
  }
  // (`sum` · `mean` read numbers — Chart `budgetAggregate`'s; a text cell that is a number counts.)
  const numbers = cells
    .map((cell) => (typeof cell === "number" ? cell : Number(cell)))
    .filter((cell) => Number.isFinite(cell));
  const sum = numbers.reduce((total, cell) => total + cell, 0);
  if (aggregate.fn === "sum") return sum;
  return numbers.length ? sum / numbers.length : null;
}

/**
 * Group · aggregate (Decision 3): one row per distinct group value (in first-seen order) with the
 * group fields and the aggregates; aggregates without grouping are one row (a list's result count).
 * A group with no rows is not a row — unless `emptyGroups: "all"`: every value the field has in
 * the data (the collection's rows — a kanban column stays while a search empties it) is a row (a
 * count of 0).
 */
function groupRows(
  query: ViewQuery,
  rows: readonly unknown[],
  sourceRows: readonly unknown[],
  schema: readonly ViewRunField[],
  broken: string[],
): readonly unknown[] {
  const keys = (query.groupBy ?? []).map((path) => viewFieldOf(path, schema));
  if (keys.some((field) => !field)) broken.push(VIEW_GROUP_BROKEN);
  const fields = keys.filter((field): field is ViewRunField => !!field);
  const aggregates = (query.aggregates ?? []).map((aggregate) => {
    const field = aggregate.field
      ? viewFieldOf(aggregate.field, schema)
      : undefined;
    if (aggregate.field && !field) broken.push(viewAggregateBroken(aggregate));
    return { aggregate, field };
  });
  const groups = new Map<string, { values: unknown[]; rows: unknown[] }>();
  const groupOf = (row: unknown) => {
    const values = fields.map((field) => cellOf(row, field) ?? null);
    const key = groupKeyOf(values);
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { values, rows: [] }));
    return group;
  };
  if (query.emptyGroups === "all" && fields.length)
    sourceRows.forEach((row) => groupOf(row));
  if (!fields.length) groups.set("", { values: [], rows: [...rows] });
  else rows.forEach((row) => groupOf(row).rows.push(row));
  return [...groups.values()].map((group) => {
    const row: Record<string, unknown> = {};
    fields.forEach((field, index) => (row[field.key] = group.values[index]));
    for (const { aggregate, field } of aggregates)
      row[aggregate.as] = aggregateOf(aggregate, field, group.rows);
    return row;
  });
}

/** One view over rows: its conditions, its group · aggregates, then its sort (stable). */
function runQuery(
  query: ViewQuery,
  rows: readonly unknown[],
  /** Every value a group field has (`emptyGroups`): the collection's rows, else these rows. */
  dataRows: readonly unknown[],
  schema: readonly ViewRunField[],
  input: ViewRunInput,
  broken: string[],
): {
  rows: readonly unknown[];
  schema: readonly ViewRunField[];
  applied: number;
} {
  const stage = { ...input, schema };
  const where = prepare(query.where, stage, broken);
  const applied = countApplied(where);
  let out = applied
    ? rows.filter((row) => judge(where, row, stage) !== "miss")
    : rows;
  const resultSchema = viewResultSchema(query, schema);
  if (query.groupBy || query.aggregates)
    out = groupRows(query, out, dataRows, schema, broken);
  const sort = sortOf(query, input, resultSchema);
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
  return { rows: out, schema: resultSchema, applied };
}

/** The view chain over a source's whole rows. */
export function runViewQueries(
  rows: readonly unknown[],
  input: ViewRunInput,
): ViewRunResult {
  const broken: string[] = [];
  let out = rows;
  let schema = input.schema;
  let applied = 0;
  let grouped = false;
  for (const query of input.queries) {
    // (Until a view groups, the collection's rows hold every value of a field.)
    const result = runQuery(
      query,
      out,
      grouped ? out : rows,
      schema,
      input,
      broken,
    );
    grouped ||= !!(query.groupBy || query.aggregates);
    out = result.rows;
    schema = result.schema;
    applied = result.applied;
  }
  return { rows: out, schema, broken, applied };
}

/** The fields the view at `queryIndex` reads: its source's result fields. */
export function viewSchemaAt(
  input: Pick<ViewRunInput, "queries" | "schema">,
  queryIndex: number,
): readonly ViewRunField[] {
  let schema = input.schema;
  for (const query of input.queries.slice(0, queryIndex))
    schema = viewResultSchema(query, schema);
  return schema;
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
  const stage = { ...input, schema: viewSchemaAt(input, queryIndex) };
  const visit = (item: PreparedCondition | PreparedGroup): ViewVerdict => {
    const verdict = judge(item, row, stage);
    verdicts.set(item.id, verdict);
    if (item.kind === "group") item.items.forEach(visit);
    return verdict;
  };
  visit(prepare(query.where, stage, []));
  return verdicts;
}
