/**
 * ADR-284 Decision 6 — a view as an API request: the same conditions the local evaluator runs,
 * written in the endpoint's query format (`EndpointQuerySerialization`):
 *
 * - `suffix` — one query parameter per condition, the field key plus a suffix per comparison
 *   (json-server · PostgREST family: `gender=male` · `name_like=pa` · `age_gte=20`; a list repeats
 *   the parameter), the sort as `_sort` · `_order`. A flat parameter list cannot hold an `or` of
 *   applied conditions, a several-field condition or a comparison the table does not name — those
 *   are left out and **reported** (never silently dropped: R1).
 * - `body` — the condition tree as JSON (`{ where, sort }`) the server reads whole.
 * - `none` — local only: the session filters the loaded rows itself (a partial result when the
 *   endpoint pages).
 *
 * The skip rule (empty · skip literal · `enabled`) is the evaluator's (`readViewCondition`): a
 * skipped condition is no parameter.
 */
import type {
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../../catalog/document/types";
import { viewDay } from "./comparison";
import { readViewCondition, viewFieldOf, type ViewRunInput } from "./evaluate";

/** An endpoint's query format for the views that read its collection. */
export interface EndpointQuerySerialization {
  kind: "suffix" | "body" | "none";
  /** `suffix`: comparison → parameter suffix (absent = the json-server table below). */
  suffixes?: Partial<Record<ViewComparison, string>>;
  /** `suffix`: the sort's parameter names (default `_sort` · `_order`). */
  sortParam?: string;
  orderParam?: string;
}

/**
 * The default suffix table (json-server): `equals` is the bare field, a list repeats it. Absent
 * comparisons are not expressible as a flat parameter — the panel shows them as 「서버로 보낼 수
 * 없음」 until the author names a suffix.
 */
export const DEFAULT_QUERY_SUFFIXES: Readonly<
  Partial<Record<ViewComparison, string>>
> = {
  equals: "",
  notEquals: "_ne",
  contains: "_like",
  oneOf: "",
  gte: "_gte",
  gt: "_gt",
  lte: "_lte",
  lt: "_lt",
  after: "_gt",
  before: "_lt",
};

export type SerializationWarningCode =
  /** An `or` of applied conditions in a flat parameter list. */
  | "OR_GROUP"
  /** A comparison the suffix table does not name. */
  | "COMPARISON"
  /** A condition over several fields (any of them) in a flat parameter list. */
  | "MULTI_FIELD"
  /** A field path through a reference (Phase 4 — `expand=`). */
  | "REFERENCE_PATH"
  /** A field or reference that does not resolve. */
  | "BROKEN"
  /** A body format on a `GET` endpoint (the body is not sent). */
  | "GET_BODY"
  /** Several different views read one endpoint's collection (one request — none sent). */
  | "MULTI_VIEW"
  /** A grouping · aggregates: not a request — the view runs on the loaded rows (Phase 4). */
  | "GROUP";

export interface SerializationWarning {
  code: SerializationWarningCode;
  /** The condition (or group) it is about; absent = the whole view · endpoint. */
  conditionId?: string;
  comparison?: ViewComparison;
}

export interface SerializedViewQuery {
  /** `suffix`: the parameters, in condition order. */
  params: [string, string][];
  /** `body`: the JSON the request carries. */
  body?: { where?: unknown; sort?: { field: string; direction: string } };
  warnings: SerializationWarning[];
}

/** A value as a parameter: a day for date-like objects, else its text. */
function text(value: unknown): string {
  if (value !== null && typeof value === "object" && !Array.isArray(value))
    return viewDay(value) ?? JSON.stringify(value);
  return String(value);
}

/**
 * The views of a binding (the last is the bound one; a derived view's sources first) as one
 * request. Only the bound view chain's conditions and the last sort are sent.
 */
export function serializeViewQueries(
  serialization: EndpointQuerySerialization,
  input: Pick<ViewRunInput, "queries" | "schema" | "resolve">,
  method = "GET",
): SerializedViewQuery {
  const warnings: SerializationWarning[] = [];
  const params: [string, string][] = [];
  if (serialization.kind === "none") return { params, warnings };
  const suffixes = serialization.suffixes ?? DEFAULT_QUERY_SUFFIXES;
  const keyOf = (condition: ViewCondition, index = 0) =>
    viewFieldOf(condition.fields[index]!, input.schema)?.key;

  /** A condition's JSON for the body format, or undefined when it is skipped. */
  const bodyCondition = (condition: ViewCondition): unknown => {
    const read = readViewCondition(condition, input);
    if (read.skip) {
      if (read.broken)
        warnings.push({ code: "BROKEN", conditionId: condition.id });
      return undefined;
    }
    if (condition.fields.some((path) => path.length > 1))
      warnings.push({ code: "REFERENCE_PATH", conditionId: condition.id });
    return {
      fields: read.fields.map((field) => field.key),
      op: condition.op,
      ...(read.value !== undefined ? { value: read.value } : {}),
      ...(condition.sensitivity ? { sensitivity: condition.sensitivity } : {}),
      ...(condition.unit ? { unit: condition.unit } : {}),
    };
  };
  const bodyGroup = (group: ViewConditionGroup): unknown => {
    const items = group.items
      .map((item) => ("items" in item ? bodyGroup(item) : bodyCondition(item)))
      .filter((item) => item !== undefined);
    return items.length ? { op: group.op, items } : undefined;
  };

  /** A condition's parameters for the suffix format. */
  const suffixCondition = (condition: ViewCondition) => {
    const read = readViewCondition(condition, input);
    if (read.skip) {
      if (read.broken)
        warnings.push({ code: "BROKEN", conditionId: condition.id });
      return;
    }
    if (condition.fields.length > 1) {
      warnings.push({ code: "MULTI_FIELD", conditionId: condition.id });
      return;
    }
    if (condition.fields[0]!.length > 1) {
      warnings.push({ code: "REFERENCE_PATH", conditionId: condition.id });
      return;
    }
    const key = keyOf(condition)!;
    const { op } = condition;
    if (op === "between") {
      const [low, high] = Array.isArray(read.value) ? read.value : [];
      const gte = suffixes.gte;
      const lte = suffixes.lte;
      if (gte === undefined || lte === undefined) {
        warnings.push({
          code: "COMPARISON",
          conditionId: condition.id,
          comparison: op,
        });
        return;
      }
      if (low !== undefined && low !== null && low !== "")
        params.push([`${key}${gte}`, text(low)]);
      if (high !== undefined && high !== null && high !== "")
        params.push([`${key}${lte}`, text(high)]);
      return;
    }
    const suffix = suffixes[op];
    if (suffix === undefined) {
      warnings.push({
        code: "COMPARISON",
        conditionId: condition.id,
        comparison: op,
      });
      return;
    }
    const values =
      op === "oneOf"
        ? read.value instanceof Set
          ? [...read.value]
          : Array.isArray(read.value)
            ? read.value
            : [read.value]
        : [read.value];
    for (const value of values) params.push([`${key}${suffix}`, text(value)]);
  };
  /** A group in the suffix format: `and` flattens; an `or` of two or more applied items cannot. */
  const suffixGroup = (group: ViewConditionGroup) => {
    const applied = group.items.filter((item) =>
      "items" in item ? true : !readViewCondition(item, input).skip,
    );
    if (group.op === "or" && applied.length > 1) {
      warnings.push({ code: "OR_GROUP", conditionId: group.id });
      return;
    }
    for (const item of group.items)
      if ("items" in item) suffixGroup(item);
      else suffixCondition(item);
  };

  const queries = input.queries;
  const last = queries[queries.length - 1];
  const sortOf = (query: ViewQuery | undefined) => {
    const sort = query?.sort;
    if (!sort) return undefined;
    if ("field" in sort) {
      const field = viewFieldOf(sort.field, input.schema);
      return field
        ? { field: field.key, direction: sort.direction }
        : undefined;
    }
    const value = input.resolve(`!var.${sort.variableId}`)?.value as
      { column?: unknown; direction?: unknown } | undefined;
    if (!value || typeof value !== "object") return undefined;
    const field = input.schema.find(
      (item) =>
        item.id === String(value.column).replace(/^data:field:/, "") ||
        item.key === String(value.column),
    );
    return field &&
      (value.direction === "ascending" || value.direction === "descending")
      ? { field: field.key, direction: value.direction }
      : undefined;
  };
  const sort = sortOf(last);

  // (`none` returned above: anything but `suffix` is the body tree.)
  if (serialization.kind !== "suffix") {
    if (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD")
      warnings.push({ code: "GET_BODY" });
    const groups = queries
      .map((query) => bodyGroup(query.where))
      .filter((group) => group !== undefined);
    return {
      params,
      body: {
        ...(groups.length
          ? {
              where:
                groups.length === 1 ? groups[0] : { op: "and", items: groups },
            }
          : {}),
        ...(sort ? { sort } : {}),
      },
      warnings,
    };
  }
  for (const query of queries) suffixGroup(query.where);
  if (sort) {
    params.push([serialization.sortParam ?? "_sort", sort.field]);
    params.push([
      serialization.orderParam ?? "_order",
      sort.direction === "descending" ? "desc" : "asc",
    ]);
  }
  return { params, warnings };
}

/**
 * What a format cannot carry of a view, whatever its variables hold (every condition taken as
 * applied) — the warnings the endpoint's format · a condition's authoring · a source change show
 * (Decision 6's three moments). The run (`serializeViewQueries`) reports the same codes for the
 * conditions that apply at the time.
 */
export function viewQueryLimits(
  serialization: EndpointQuerySerialization,
  input: Pick<ViewRunInput, "queries" | "schema">,
  method = "GET",
): SerializationWarning[] {
  const warnings: SerializationWarning[] = [];
  if (serialization.kind === "none") return warnings;
  const suffixes = serialization.suffixes ?? DEFAULT_QUERY_SUFFIXES;
  const visit = (item: ViewCondition | ViewConditionGroup) => {
    if ("items" in item) {
      if (
        serialization.kind === "suffix" &&
        item.op === "or" &&
        item.items.length > 1
      ) {
        warnings.push({ code: "OR_GROUP", conditionId: item.id });
        return;
      }
      item.items.forEach(visit);
      return;
    }
    // (A path through a reference is Phase 4's `expand=` — not a parameter, nor a body key yet.)
    if (item.fields.some((path) => path.length > 1)) {
      warnings.push({ code: "REFERENCE_PATH", conditionId: item.id });
      return;
    }
    if (item.fields.some((path) => !viewFieldOf(path, input.schema))) {
      warnings.push({ code: "BROKEN", conditionId: item.id });
      return;
    }
    if (serialization.kind !== "suffix") return;
    if (item.fields.length > 1) {
      warnings.push({ code: "MULTI_FIELD", conditionId: item.id });
      return;
    }
    const carried =
      item.op === "between"
        ? suffixes.gte !== undefined && suffixes.lte !== undefined
        : suffixes[item.op] !== undefined;
    if (!carried)
      warnings.push({
        code: "COMPARISON",
        conditionId: item.id,
        comparison: item.op,
      });
  };
  for (const query of input.queries) {
    visit(query.where);
    if (query.groupBy || query.aggregates) warnings.push({ code: "GROUP" });
  }
  if (
    serialization.kind !== "suffix" &&
    (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD")
  )
    warnings.push({ code: "GET_BODY" });
  return warnings;
}
