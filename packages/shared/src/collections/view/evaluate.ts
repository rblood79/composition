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
import { withComputedCells } from "../formula/compute";

/** A source schema field (the data's `DataField` — `id` without the `data:field:` prefix). */
export interface ViewRunField {
  id: string;
  key: string;
  type?: string;
  /** ADR-284 Decision 4 — a reference field: its value is a key of `collectionId`'s `keyField`. */
  reference?: { collectionId: string; keyField: string };
  /** A field read through references (`team.name`): the target row's value, not `row[key]`. */
  read?: (row: unknown) => unknown;
  /**
   * ADR-291 Decision 2 · 3 — a computed field: its json-formula expression over field ids
   * (`'f-price' * 'f-qty'`), written onto the rows before the views read them (`withComputedCells`).
   */
  formula?: string;
}

/** A referenced collection as the run reads it (the target of a reference field). */
export interface ViewRunCollection {
  rows: readonly unknown[];
  schema: readonly ViewRunField[];
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
  /** The collections reference fields point at (a path through one reads its rows). */
  references?: (collectionId: string) => ViewRunCollection | undefined;
}

export interface ViewRunResult {
  rows: readonly unknown[];
  /** The result rows' fields: the source's, or a grouped view's group fields and aggregates. */
  schema: readonly ViewRunField[];
  /** Conditions whose field or reference does not resolve: skipped, and shown as broken. */
  broken: readonly string[];
  /** Conditions that applied (not skipped) over the whole chain — 「적용 조건 수」. */
  applied: number;
}

/** A condition's verdict on a row: it holds · it does not · it is skipped (passes every row). */
export type ViewVerdict = "match" | "miss" | "skip";

const fieldId = (id: string) => id.replace(/^data:field:/, "");

/** A data schema as the run reads it (fields with ids; a reference keeps its target). */
export function viewRunSchema(
  schema:
    | readonly {
        id?: string;
        key: string;
        type?: string;
        reference?: { collectionId: string; keyField: string };
        formula?: string;
      }[]
    | undefined,
): ViewRunField[] {
  return (schema ?? []).flatMap((field) =>
    field.id && field.key
      ? [
          {
            id: field.id,
            key: field.key,
            ...(field.type ? { type: field.type } : {}),
            ...(field.reference ? { reference: field.reference } : {}),
            ...(field.formula ? { formula: field.formula } : {}),
          },
        ]
      : [],
  );
}

/** The collections a run's reference fields reach, from the loaded collections (by data id). */
export function viewRunReferences(
  collections: readonly {
    id?: string;
    schema?: Parameters<typeof viewRunSchema>[0];
    mockData?: readonly unknown[];
    runtimeData?: readonly unknown[];
    useMockData?: boolean;
  }[],
): NonNullable<ViewRunInput["references"]> {
  const read = new Map<string, ViewRunCollection | undefined>();
  return (collectionId) => {
    const id = collectionId.replace(/^data:collection:/, "");
    if (!read.has(id)) {
      const source = collections.find((item) => item.id === id);
      read.set(
        id,
        source
          ? {
              rows:
                (source.useMockData ? source.mockData : source.runtimeData) ??
                [],
              schema: viewRunSchema(source.schema),
            }
          : undefined,
      );
    }
    return read.get(id);
  };
}

/** The steps of a path in its field's id (a grouped row's field by a path). */
export const VIEW_PATH_JOIN = "__";

/** A target's rows by their key field's value (`find` — one index per rows and key field). */
const keyIndexes = new WeakMap<object, Map<string, Map<string, unknown>>>();
function keyIndex(
  rows: readonly unknown[],
  key: ViewRunField,
): Map<string, unknown> {
  let byField = keyIndexes.get(rows);
  if (!byField) keyIndexes.set(rows, (byField = new Map()));
  let index = byField.get(key.key);
  if (!index) {
    index = new Map();
    for (const row of rows) {
      const value = cellOf(row, key);
      if (value === undefined || value === null || value === "") continue;
      // (The first row with a key wins — `items.find`.)
      if (!index.has(String(value))) index.set(String(value), row);
    }
    byField.set(key.key, index);
  }
  return index;
}

/**
 * The field a path names: one step is a schema field; more steps go through reference fields
 * (`[teamId, name]` = the Teams row whose key is the row's `teamId`, its `name` — `team.name`).
 * A step that does not resolve (no field · not a reference · no target) is undefined (the
 * condition is broken); a row whose key finds no target row reads an empty value (「없음」).
 */
export function viewFieldOf(
  path: DataFieldPath,
  schema: readonly ViewRunField[],
  references?: ViewRunInput["references"],
): ViewRunField | undefined {
  if (!path.length) return undefined;
  const id = fieldId(path[0]!);
  const first = schema.find((field) => field.id === id);
  if (!first || path.length === 1) return first;
  const target = first.reference && references?.(first.reference.collectionId);
  if (!target) return undefined;
  const keyId = fieldId(first.reference!.keyField);
  const key = target.schema.find((field) => field.id === keyId);
  const rest = viewFieldOf(path.slice(1), target.schema, references);
  if (!key || !rest) return undefined;
  const index = keyIndex(target.rows, key);
  return {
    // (A grouped view's field id of a path — `__` joins the steps: a data id has no dot.)
    id: path.map(fieldId).join(VIEW_PATH_JOIN),
    key: `${first.key}.${rest.key}`,
    ...(rest.type ? { type: rest.type } : {}),
    read: (row) => {
      const value = cellOf(row, first);
      if (value === undefined || value === null || value === "")
        return undefined;
      const hit = index.get(String(value));
      return hit === undefined ? undefined : cellOf(hit, rest);
    },
  };
}

/** A row's value of a field: through its references, or by its key (`a.b` — a grouped row's). */
function cellOf(row: unknown, field: ViewRunField): unknown {
  if (field.read) return field.read(row);
  if (row === null || typeof row !== "object") return undefined;
  const record = row as Record<string, unknown>;
  if (field.key in record || !field.key.includes(".")) return record[field.key];
  let value: unknown = record;
  for (const step of field.key.split(".")) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[step];
  }
  return value;
}

/**
 * Write a grouped row's field: `team.name` both as itself (a binding's field role reads the key)
 * and nested (`{ team: { name } }` — what a `{team.name}` template reads).
 */
function setCell(row: Record<string, unknown>, key: string, value: unknown) {
  row[key] = value;
  if (!key.includes(".")) return;
  const steps = key.split(".");
  let at = row;
  for (const step of steps.slice(0, -1)) {
    const next = at[step];
    at = (at[step] =
      next !== null && typeof next === "object" ? next : {}) as Record<
      string,
      unknown
    >;
  }
  at[steps[steps.length - 1]!] = value;
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
  input: Pick<ViewRunInput, "schema" | "resolve" | "references">,
):
  | { skip: true; broken: boolean }
  | { skip: false; fields: ViewRunField[]; value: unknown } {
  const fields = condition.fields.map((path) =>
    viewFieldOf(path, input.schema, input.references),
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

/**
 * 「적용 조건 수」 — the view's top-level conditions that apply: a nested group (「또는 조건」 — a search
 * over two names) is one condition, applying when anything in it does.
 */
function countApplied(group: PreparedGroup): number {
  return group.items.filter((item) => appliesAny(item)).length;
}
const appliesAny = (item: PreparedCondition | PreparedGroup): boolean =>
  item.kind === "group" ? item.items.some(appliesAny) : !item.skip;

/** A sort's field and direction as the run reads them (a variable holds `{column, direction}`). */
function sortOf(
  query: ViewQuery,
  input: ViewRunInput,
  schema: readonly ViewRunField[],
): { field: ViewRunField; direction: "ascending" | "descending" } | undefined {
  const sort = query.sort;
  if (!sort) return undefined;
  if ("field" in sort) {
    const field = viewFieldOf(sort.field, schema, input.references);
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
  references?: ViewRunInput["references"],
): readonly ViewRunField[] {
  if (!query.groupBy && !query.aggregates) return schema;
  const fields: ViewRunField[] = [];
  for (const path of query.groupBy ?? []) {
    const field = viewFieldOf(path, schema, references);
    // (A grouped row holds the value itself — a path's `team.name` as `{ team: { name } }`.)
    if (field) {
      const { read: _read, ...own } = field;
      fields.push(own);
    }
  }
  for (const aggregate of query.aggregates ?? []) {
    const source =
      aggregate.field && (aggregate.fn === "min" || aggregate.fn === "max")
        ? viewFieldOf(aggregate.field, schema, references)
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
  sourceApplied: number,
): unknown {
  if (aggregate.fn === "count") return rows.length;
  if (aggregate.fn === "applied") return sourceApplied;
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
  references: ViewRunInput["references"],
  broken: string[],
  /** The conditions the source views applied (the `applied` aggregate). */
  sourceApplied: number,
): readonly unknown[] {
  const keys = (query.groupBy ?? []).map((path) =>
    viewFieldOf(path, schema, references),
  );
  if (keys.some((field) => !field)) broken.push(VIEW_GROUP_BROKEN);
  const fields = keys.filter((field): field is ViewRunField => !!field);
  const aggregates = (query.aggregates ?? []).map((aggregate) => {
    const field = aggregate.field
      ? viewFieldOf(aggregate.field, schema, references)
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
    fields.forEach((field, index) =>
      setCell(row, field.key, group.values[index]),
    );
    for (const { aggregate, field } of aggregates)
      row[aggregate.as] = aggregateOf(
        aggregate,
        field,
        group.rows,
        sourceApplied,
      );
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
  sourceApplied: number,
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
  const resultSchema = viewResultSchema(query, schema, input.references);
  if (query.groupBy || query.aggregates)
    out = groupRows(
      query,
      out,
      dataRows,
      schema,
      input.references,
      broken,
      sourceApplied,
    );
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
  // (ADR-291 Decision 3 — computed cells exist before the first view reads a row.)
  rows = withComputedCells(rows, input.schema, input);
  let out = rows;
  let schema = input.schema;
  // (The conditions the views before this one applied — a derived view's `applied` aggregate.)
  let sourceApplied = 0;
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
      sourceApplied,
    );
    grouped ||= !!(query.groupBy || query.aggregates);
    out = result.rows;
    schema = result.schema;
    sourceApplied += result.applied;
  }
  return { rows: out, schema, broken, applied: sourceApplied };
}

/** The fields the view at `queryIndex` reads: its source's result fields. */
export function viewSchemaAt(
  input: Pick<ViewRunInput, "queries" | "schema" | "references">,
  queryIndex: number,
): readonly ViewRunField[] {
  let schema = input.schema;
  for (const query of input.queries.slice(0, queryIndex))
    schema = viewResultSchema(query, schema, input.references);
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
  // (ADR-291 — the row the run judges: its computed cells written, as `runViewQueries` does.)
  [row] = withComputedCells([row], input.schema, input);
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
