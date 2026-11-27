/**
 * ADR-284 Decision 6 — a view as an API request: the same conditions the local evaluator runs,
 * written in the endpoint's query format (`EndpointQuerySerialization`):
 *
 * - `suffix` — one query parameter per condition, the field key plus a suffix per comparison
 *   (json-server · PostgREST family: `gender=male` · `name_like=pa` · `age_gte=20`; a list repeats
 *   the parameter), the sort as `_sort` · `_order`. A flat parameter list cannot hold an `or` of
 *   applied conditions, a several-field condition or a comparison the table does not name — those
 *   are left out and **reported** (never silently dropped: R1).
 * - `body` — the condition tree as JSON the server reads whole: `{ where, sort, group, page, total }`
 *   (ADR-291 Decision 6 — a grouping · aggregates go as `group`, the page as `page`, `total: true`
 *   asks for the whole count).
 * - `none` — local only: the session filters the loaded rows itself (a partial result when the
 *   endpoint pages).
 *
 * The skip rule (empty · skip literal · `enabled`) is the evaluator's (`readViewCondition`): a
 * skipped condition is no parameter.
 *
 * ADR-291 Decision 5 — a view that reads a **computed field** anywhere (a condition · the sort · a
 * group key · an aggregate's input) cannot go to the server (it has neither the cell nor the
 * formula): `COMPUTED` is reported, nothing of the view is sent, and the session loads every row
 * (`load: "all"`, up to its cap) to run the whole chain locally — never half a request (conditions
 * on the server, aggregates here: an aggregate answer has no raw cells to recover from). A `suffix`
 * format cannot carry a grouping either: its conditions are sent and the rows are loaded whole
 * (`GROUP` · `load: "all"`), the grouping runs here.
 */
import { outgoingFieldValue } from "../intake/outgoing";
import { resolveField } from "../resolveBoundCollection";
import {
  VIEW_EXTENDED_AGGREGATES,
  type DataFieldPath,
  type ViewAggregate,
  type ViewComparison,
  type ViewCondition,
  type ViewConditionGroup,
  type ViewQuery,
} from "../../catalog/document/types";
import { viewDay } from "./comparison";
import { DEFAULT_QUERY_SUFFIXES } from "./querySuffixes";
import {
  readViewCondition,
  VIEW_SEARCH_CONDITION,
  viewFieldOf,
  type ViewRunField,
  type ViewRunInput,
} from "./evaluate";

/**
 * ADR-291 사용자 결정 3 (2026-10-29) — the most rows the session loads to run a view locally (a
 * computed field in the view · a grouping a `suffix` format cannot carry); past it the view is
 * refused (no rows, a notice) — never a quiet partial result.
 */
export const VIEW_LOCAL_LOAD_CAP = 10_000;

/** An endpoint's query format for the views that read its collection. */
export interface EndpointQuerySerialization {
  kind: "suffix" | "body" | "none";
  /** `suffix`: comparison → parameter suffix (absent = the json-server table below). */
  suffixes?: Partial<Record<ViewComparison, string>>;
  /** `suffix`: the sort's parameter names (default `_sort` · `_order`). */
  sortParam?: string;
  orderParam?: string;
  /**
   * ADR-291 Decision 6 — `suffix`: the page parameters (json-server `_page` · `_limit`), sent when
   * `pageSize` is set (the cursor is the page number, from 1). `body`: `pageSize` is `page.limit`.
   */
  pageParam?: string;
  limitParam?: string;
  pageSize?: number;
  /** The response header holding the whole count (json-server `X-Total-Count`); absent = that. */
  totalHeader?: string;
  /**
   * ADR-315 Phase 2 — `suffix`: the endpoint takes several sorts as comma lists in the sort · order
   * parameters (json-server). Absent = one sort only. `body` always carries the list.
   */
  multiSort?: boolean;
  /**
   * ADR-315 Phase 3 — `suffix`: the parameter a Table's search text goes in (json-server `q` — the
   * server searches its own fields). Absent = a flat format carries no search: a Table on it takes
   * none (`catalogTableSliceServable`). `body` carries the search as a condition over its fields.
   */
  searchParam?: string;
  /**
   * ADR-315 사용자 결정 4 — `body`: the server runs the aggregates added after ADR-291's contract
   * (`median` · `unique` · `uniqueCount` · `extent` · `first` · `last` — `VIEW_EXTENDED_AGGREGATES`).
   * Absent = `count` · `sum` · `mean` · `min` · `max` only: a grouping with another is not sent —
   * every row is loaded and grouped here (`AGGREGATE`), never sent for a server to ignore.
   */
  extendedAggregates?: boolean;
  /**
   * ADR-315 Phase 5 증분 5g — `body`: the server answers a request's `keys` — `{ field, only }`
   * the rows whose key field is exactly one of the values, `{ field, except }` the rows whose key
   * is none of them (breakdown §4.3.3 — an identity, not a condition: no case folding). Absent =
   * not sent (a server that ignores an item it does not know would answer every row).
   */
  keyRows?: boolean;
  /**
   * ADR-315 Phase 5 증분 5g — `suffix`: the parameter of the keys to answer (`keys.only` — one per
   * key) and of the keys to leave out (`keys.except`). Both named = rows by key are sent.
   */
  keyOnlyParam?: string;
  keyExceptParam?: string;
  /**
   * ADR-315 Phase 5 증분 5g — `body`: the server answers a request's `groupOf` — `{ by, values }`
   * the rows its own grouping by `by` puts in the group of `values` (breakdown §4.3.2 · §4.3.3:
   * a group's rows, and a group's next-level groups). Absent = a Table's grouping · totals row
   * over a server's pages loads every row and runs here.
   */
  groupRows?: boolean;
}

/** ADR-315 Phase 5 증분 5g — a group's rows in a request (`body.groupOf`): its fields and values. */
export interface SerializedGroupOf {
  /** The grouped fields' keys, outer first. */
  by: readonly string[];
  /** The group's values as its group query answered them (`null` is not `""`). */
  values: readonly unknown[];
}

/** ADR-315 Phase 5 증분 5g — what a request asks for besides its view (§4.3.3 — identities). */
export interface SerializedRequestItems {
  keys?: SerializedKeyRows;
  groupOf?: SerializedGroupOf;
}

/**
 * ADR-315 Phase 5 증분 5g — rows by key in a request (`body.keys` · the key parameters): the item
 * keys as the key field's values (by its type — a number key `5` is not the text `"5"`).
 */
export interface SerializedKeyRows {
  /** The key field's key. */
  field: string;
  only?: readonly string[];
  except?: readonly string[];
}

export { VIEW_SEARCH_CONDITION };

/** A sort entry as a request carries it (`body.sort` — one entry an object, more a list). */
export interface SerializedSort {
  field: string;
  direction: "ascending" | "descending";
  empty?: "first" | "last";
}

export { DEFAULT_QUERY_SUFFIXES };

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
  /**
   * A body format on a `GET` · `HEAD` endpoint (the body is not sent). ADR-320 Decision 4 — a view
   * with something to carry is not the server's then: every row is loaded and it runs here.
   */
  | "GET_BODY"
  /**
   * ADR-320 Decision 4 — a `suffix` format: a condition's parameter key (its field + the
   * comparison's suffix) is already in the request — another condition's, or the endpoint's own
   * URL's. A server reads a repeated key as `or`, so the later condition is not sent: every row is
   * loaded and the view runs here. (One condition's list — `oneOf` — is one key repeated: sent.)
   */
  | "DUPLICATE_KEY"
  /** Several different views read one endpoint's collection (one request — none sent). */
  | "MULTI_VIEW"
  /** A grouping · aggregates in a `suffix` format: not parameters — every row is loaded, grouped here. */
  | "GROUP"
  /** ADR-315 Phase 2 — several sorts in a `suffix` format that takes one: only the first is sent. */
  | "MULTI_SORT"
  /** ADR-315 Phase 5 증분 5g — rows by key the endpoint names no request for: not sent. */
  | "KEYS"
  /** ADR-315 Phase 5 증분 5g — a group's rows the endpoint names no request for: not sent. */
  | "GROUP_OF"
  /**
   * ADR-315 사용자 결정 4 — a `body` grouping with an aggregate the endpoint has not said it runs
   * (`extendedAggregates`): the grouping is not sent, every row is loaded and grouped here.
   */
  | "AGGREGATE"
  /**
   * ADR-291 Decision 5 — the view reads a computed field (a condition · the sort · a group key · an
   * aggregate's input): nothing of it is sent, every row is loaded, the whole chain runs here.
   */
  | "COMPUTED";

export interface SerializationWarning {
  code: SerializationWarningCode;
  /** The condition (or group) it is about; absent = the whole view · endpoint. */
  conditionId?: string;
  comparison?: ViewComparison;
  /** `COMPUTED`: the aggregate (its `as`) reading a computed field. `AGGREGATE`: the one not run. */
  aggregate?: string;
  /** `COMPUTED`: the computed field's key. */
  field?: string;
}

/** `body`: a grouping · aggregates as the server runs them (ADR-291 Decision 6). */
export interface SerializedViewGroup {
  by: string[];
  aggregates: { fn: ViewAggregate["fn"]; field?: string; as: string }[];
}
export interface SerializedViewQuery {
  /** `suffix`: the parameters, in condition order. */
  params: [string, string][];
  /** `body`: the JSON the request carries. */
  body?: {
    where?: unknown;
    sort?: SerializedSort | SerializedSort[];
    group?: SerializedViewGroup;
    page?: { cursor?: string; limit?: number };
    total?: true;
  };
  warnings: SerializationWarning[];
  /**
   * `"all"` = the session loads every page (to its cap) before the view can be right: the view
   * reads a computed field (`COMPUTED` — nothing sent), or a `suffix` format cannot carry its
   * grouping (`GROUP` — conditions sent, grouped here). Absent = the answer is the view's result.
   */
  load?: "all";
}

/** A value as a parameter: a day for date-like objects, else its text. */
function text(value: unknown): string {
  if (value !== null && typeof value === "object" && !Array.isArray(value))
    return viewDay(value) ?? JSON.stringify(value);
  return String(value);
}

/**
 * ADR-313 Decision 5 — a field's value as the server reads it: a declared notation writes it back
 * (`true` → `"Y"`, a day → `"20261106"`); undeclared fields send the value as before.
 */
function fieldText(field: ViewRunField | undefined, value: unknown): string {
  const written = outgoingFieldValue(field, dateLike(value), "text");
  return written === undefined ? text(value) : (written as string);
}
function fieldJson(field: ViewRunField | undefined, value: unknown): unknown {
  if (!field?.encoding) return value;
  const one = (item: unknown) =>
    outgoingFieldValue(field, dateLike(item), "json") ?? item;
  if (value instanceof Set) return [...value].map(one);
  return Array.isArray(value) ? value.map(one) : one(value);
}
/** A date-like object (a picker's value) as its day text, so a date notation can read it. */
function dateLike(value: unknown): unknown {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Set)
    ? (viewDay(value) ?? value)
    : value;
}

/**
 * ADR-291 Decision 5 — where a view chain reads a computed field (`ViewRunField.formula`): a
 * condition's field, the sort's, a group key, an aggregate's input. A computed field reading
 * another is computed itself, so the transit is in the set. A sort held by a variable is judged by
 * the run (`serializeViewQueries` resolves it); the static limits take it as not computed.
 */
export function computedViewUses(
  input: Pick<ViewRunInput, "queries" | "schema"> &
    Partial<Pick<ViewRunInput, "resolve">>,
): SerializationWarning[] {
  const warnings: SerializationWarning[] = [];
  const computedOf = (path: DataFieldPath): ViewRunField | undefined => {
    const field = viewFieldOf(path, input.schema);
    return field?.formula ? field : undefined;
  };
  const visit = (item: ViewCondition | ViewConditionGroup) => {
    if ("items" in item) {
      item.items.forEach(visit);
      return;
    }
    const computed = item.fields.map(computedOf).find((field) => field);
    if (computed)
      warnings.push({
        code: "COMPUTED",
        conditionId: item.id,
        field: computed.key,
      });
  };
  for (const query of input.queries) {
    visit(query.where);
    for (const path of query.groupBy ?? []) {
      const computed = computedOf(path);
      if (computed) warnings.push({ code: "COMPUTED", field: computed.key });
    }
    for (const aggregate of query.aggregates ?? []) {
      const computed = aggregate.field && computedOf(aggregate.field);
      if (computed)
        warnings.push({
          code: "COMPUTED",
          aggregate: aggregate.as,
          field: computed.key,
        });
    }
    for (const sort of query.sort ?? []) {
      if ("field" in sort) {
        const computed = computedOf(sort.field);
        if (computed) warnings.push({ code: "COMPUTED", field: computed.key });
      } else if (input.resolve) {
        const value = input.resolve(`!var.${sort.variableId}`)?.value as
          { column?: unknown } | undefined;
        const column =
          value && typeof value === "object" ? String(value.column) : undefined;
        const computed =
          column !== undefined
            ? input.schema.find(
                (item) =>
                  item.formula &&
                  (item.id === column.replace(/^data:field:/, "") ||
                    item.key === column),
              )
            : undefined;
        if (computed) warnings.push({ code: "COMPUTED", field: computed.key });
      }
    }
  }
  return warnings;
}

/**
 * ADR-315 Phase 5 증분 5g — an item key as its key field's value: the field's type reads it (a
 * number field's `"5"` is `5`, a boolean's `"true"` is `true`); any other is the text.
 */
function keyFieldValue(field: ViewRunField | undefined, key: string): unknown {
  if (field?.type === "number") {
    const number = Number(key);
    return key.trim() !== "" && Number.isFinite(number) ? number : key;
  }
  if (field?.type === "boolean" && (key === "true" || key === "false"))
    return key === "true";
  return key;
}

/**
 * The views of a binding (the last is the bound one; a derived view's sources first) as one
 * request. Only the bound view chain's conditions and the last sort are sent. `page` = the load's
 * cursor (a `suffix` page number · a `body` cursor) — the format's page parameters carry it.
 */
export function serializeViewQueries(
  serialization: EndpointQuerySerialization,
  input: Pick<ViewRunInput, "queries" | "schema" | "resolve">,
  method = "GET",
  page?: { cursor?: string },
  /**
   * ADR-315 Phase 5 증분 5g — rows by key (a Table's pinned rows · the page without them) and a
   * group's rows (an open group's children).
   */
  items?: SerializedRequestItems,
  /**
   * ADR-320 Decision 4 — the parameter keys the endpoint's own URL already has (its path · its
   * default query · its resolved templates · the load arguments — the request as it goes).
   */
  taken?: Iterable<string>,
): SerializedViewQuery {
  const keys = items?.keys;
  const groupOf = items?.groupOf;
  const warnings: SerializationWarning[] = [];
  const params: [string, string][] = [];
  if (serialization.kind === "none") return { params, warnings };
  // (ADR-291 Decision 5 — a computed field anywhere in the chain: the whole view runs here.)
  const computed = computedViewUses(input);
  if (computed.length) return { params, warnings: computed, load: "all" };
  const suffixes = serialization.suffixes ?? DEFAULT_QUERY_SUFFIXES;
  const keyOf = (condition: ViewCondition, index = 0) =>
    viewFieldOf(condition.fields[index]!, input.schema)?.key;
  // (ADR-320 — the keys the request has so far: a condition whose key is one of them is not sent.)
  const sent = new Set<string>(taken ?? []);
  let duplicate = false;
  const takes = (condition: ViewCondition, names: readonly string[]) => {
    if (names.some((name) => sent.has(name))) {
      warnings.push({ code: "DUPLICATE_KEY", conditionId: condition.id });
      duplicate = true;
      return false;
    }
    for (const name of names) sent.add(name);
    return true;
  };

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
      ...(read.value !== undefined
        ? {
            value:
              read.fields.length === 1
                ? fieldJson(read.fields[0], read.value)
                : read.value,
          }
        : {}),
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
    // (ADR-315 Phase 3 — a Table's search: the endpoint's search parameter carries the text.)
    if (condition.id === VIEW_SEARCH_CONDITION && serialization.searchParam) {
      // (The text as typed: it is no field's value — no field notation writes it back.)
      params.push([serialization.searchParam, String(read.value ?? "")]);
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
      const has = (end: unknown) =>
        end !== undefined && end !== null && end !== "";
      if (
        !takes(condition, [
          ...(has(low) ? [`${key}${gte}`] : []),
          ...(has(high) ? [`${key}${lte}`] : []),
        ])
      )
        return;
      if (has(low))
        params.push([`${key}${gte}`, fieldText(read.fields[0], low)]);
      if (has(high))
        params.push([`${key}${lte}`, fieldText(read.fields[0], high)]);
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
    if (!takes(condition, [`${key}${suffix}`])) return;
    for (const value of values)
      params.push([`${key}${suffix}`, fieldText(read.fields[0], value)]);
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
  /** The last view's sort entries as the request names them (a field by its key). */
  const sortsOf = (query: ViewQuery | undefined): SerializedSort[] =>
    (query?.sort ?? []).flatMap((sort): SerializedSort[] => {
      if ("field" in sort) {
        const field = viewFieldOf(sort.field, input.schema);
        return field
          ? [
              {
                field: field.key,
                direction: sort.direction,
                ...(sort.empty ? { empty: sort.empty } : {}),
              },
            ]
          : [];
      }
      const value = input.resolve(`!var.${sort.variableId}`)?.value as
        { column?: unknown; direction?: unknown } | undefined;
      if (!value || typeof value !== "object") return [];
      const field = input.schema.find(
        (item) =>
          item.id === String(value.column).replace(/^data:field:/, "") ||
          item.key === String(value.column),
      );
      return field &&
        (value.direction === "ascending" || value.direction === "descending")
        ? [{ field: field.key, direction: value.direction }]
        : [];
    });
  const sorts = sortsOf(last);
  const grouped = queries.some((query) => query.groupBy || query.aggregates);

  // (`none` returned above: anything but `suffix` is the body tree.)
  if (serialization.kind !== "suffix") {
    const bodyless =
      method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD";
    if (bodyless) warnings.push({ code: "GET_BODY" });
    const groups = queries
      .map((query) => bodyGroup(query.where))
      .filter((group) => group !== undefined);
    // (ADR-320 Decision 4 — the body does not go: a view with conditions · a sort · a grouping to
    //  carry is not the server's. Nothing is sent, every row loads and the chain runs here.)
    if (bodyless && (groups.length || sorts.length || grouped))
      return { params, warnings, load: "all" };
    // (ADR-291 Decision 6 — the chain's grouping · aggregates as the server runs them; a derived
    // view grouping a grouped view is one grouping here (the last query's). ADR-315 사용자 결정 4
    // — an aggregate the endpoint has not said it runs: the conditions go, the grouping runs here.)
    const unrun = grouped ? unrunAggregates(serialization, queries) : [];
    warnings.push(...unrun);
    const group =
      grouped && !unrun.length ? bodyGroupOf(queries, input.schema) : undefined;
    const pageBody =
      page?.cursor !== undefined || serialization.pageSize !== undefined
        ? {
            ...(page?.cursor !== undefined ? { cursor: page.cursor } : {}),
            ...(serialization.pageSize !== undefined
              ? { limit: serialization.pageSize }
              : {}),
          }
        : undefined;
    // (ADR-315 Phase 5 증분 5g — rows by key: `keys` beside `where`; the pinned rows' request is
    //  those rows only — no page cuts it.)
    const keyed = keys && (keys.only ? true : !!keys.except?.length);
    if (keyed && serialization.keyRows !== true)
      warnings.push({ code: "KEYS" });
    const keyField = keys
      ? (resolveField(input.schema, keys.field) ?? undefined)
      : undefined;
    const keysBody =
      keyed && serialization.keyRows === true
        ? {
            field: keys!.field,
            ...(keys!.only
              ? {
                  only: keys!.only.map((key) =>
                    fieldJson(keyField, keyFieldValue(keyField, key)),
                  ),
                }
              : {
                  except: keys!.except!.map((key) =>
                    fieldJson(keyField, keyFieldValue(keyField, key)),
                  ),
                }),
          }
        : undefined;
    // (ADR-315 Phase 5 증분 5g — a group's rows: `groupOf` beside `where` — the server's own
    //  grouping decides, values as the group query gave them.)
    if (groupOf && serialization.groupRows !== true)
      warnings.push({ code: "GROUP_OF" });
    const groupOfBody =
      groupOf && serialization.groupRows === true
        ? {
            by: groupOf.by,
            values: groupOf.values.map((value, index) =>
              fieldJson(
                resolveField(input.schema, groupOf.by[index]) ?? undefined,
                value,
              ),
            ),
          }
        : undefined;
    return {
      params,
      body: {
        ...(keysBody ? { keys: keysBody } : {}),
        ...(groupOfBody ? { groupOf: groupOfBody } : {}),
        ...(groups.length
          ? {
              where:
                groups.length === 1 ? groups[0] : { op: "and", items: groups },
            }
          : {}),
        // (ADR-315 Phase 2 — one entry is the object it always was; more are the list, in order.)
        ...(sorts.length === 1
          ? { sort: sorts[0] }
          : sorts.length
            ? { sort: sorts }
            : {}),
        ...(group ? { group } : {}),
        ...(pageBody && !keys?.only ? { page: pageBody } : {}),
        total: true,
      },
      warnings,
      ...(unrun.length ? { load: "all" as const } : {}),
    };
  }
  for (const query of queries) suffixGroup(query.where);
  if (sorts.length) {
    // (ADR-315 Phase 2 — a flat format names one sort unless the endpoint says it takes a comma
    //  list (`multiSort` — json-server `_sort=a,b&_order=asc,desc`). The entries past the first of
    //  a format that does not are not sent, and said so: a page cut by one sort is not the page of
    //  two (리뷰 round 1 H1) — a Table's state never holds them (`catalogTableSortLimit`).)
    const sent = serialization.multiSort ? sorts : sorts.slice(0, 1);
    if (sent.length < sorts.length) warnings.push({ code: "MULTI_SORT" });
    params.push([
      serialization.sortParam ?? "_sort",
      sent.map((sort) => sort.field).join(","),
    ]);
    params.push([
      serialization.orderParam ?? "_order",
      sent
        .map((sort) => (sort.direction === "descending" ? "desc" : "asc"))
        .join(","),
    ]);
  }
  // (ADR-315 Phase 5 증분 5g — rows by key: a parameter a key, the endpoint's names — the pinned
  //  rows' request is those rows only, no page.)
  const keyField = keys
    ? (resolveField(input.schema, keys.field) ?? undefined)
    : undefined;
  const keyParam = keys?.only
    ? serialization.keyOnlyParam
    : serialization.keyExceptParam;
  const keyList = keys?.only ?? keys?.except ?? [];
  if (keys && (keys.only || keyList.length)) {
    if (!keyParam) warnings.push({ code: "KEYS" });
    else
      for (const key of keyList)
        params.push([
          keyParam,
          fieldText(keyField, keyFieldValue(keyField, key)),
        ]);
  }
  if (serialization.pageSize !== undefined && !(keys?.only && keyParam)) {
    params.push([serialization.pageParam ?? "_page", page?.cursor ?? "1"]);
    params.push([
      serialization.limitParam ?? "_limit",
      String(serialization.pageSize),
    ]);
  }
  if (groupOf) warnings.push({ code: "GROUP_OF" });
  // (ADR-291 Decision 6 — a flat parameter list has no grouping: every row, grouped here.)
  if (grouped) {
    warnings.push({ code: "GROUP" });
    return { params, warnings, load: "all" };
  }
  // (ADR-320 Decision 4 — a condition left out for its key: what was sent narrows the rows, the
  //  whole chain runs here over every one of them.)
  if (duplicate) return { params, warnings, load: "all" };
  return { params, warnings };
}

/**
 * ADR-315 사용자 결정 4 — the aggregates of a chain a `body` endpoint does not run: the ones added
 * after ADR-291's contract, unless the endpoint says it runs them (`extendedAggregates`).
 */
function unrunAggregates(
  serialization: EndpointQuerySerialization,
  queries: readonly ViewQuery[],
): SerializationWarning[] {
  // (A `suffix` format groups nothing (`GROUP`); `none` sends nothing.)
  if (serialization.kind !== "suffix" && serialization.kind !== "none") {
    if (serialization.extendedAggregates) return [];
  } else return [];
  return queries.flatMap((query) =>
    (query.aggregates ?? [])
      .filter((aggregate) => VIEW_EXTENDED_AGGREGATES.has(aggregate.fn))
      .map((aggregate) => ({
        code: "AGGREGATE" as const,
        aggregate: aggregate.as,
      })),
  );
}

/** The grouping the body carries: the last grouped query's keys and aggregates, by field key. */
function bodyGroupOf(
  queries: readonly ViewQuery[],
  schema: readonly ViewRunField[],
): SerializedViewGroup | undefined {
  const query = [...queries]
    .reverse()
    .find((item) => item.groupBy || item.aggregates);
  if (!query) return undefined;
  const keyOf = (path: DataFieldPath) => viewFieldOf(path, schema)?.key;
  return {
    by: (query.groupBy ?? [])
      .map(keyOf)
      .filter((key): key is string => key !== undefined),
    aggregates: (query.aggregates ?? []).map((aggregate) => {
      const field = aggregate.field && keyOf(aggregate.field);
      return {
        fn: aggregate.fn,
        ...(field ? { field } : {}),
        as: aggregate.as,
      };
    }),
  };
}

/**
 * ADR-320 Decision 4 — the parameter keys an endpoint's own URL carries: its query parameters' (a
 * load argument's too — it is in the request once given) and the ones written in its address. A
 * view's condition giving one of them would repeat the key (a server reads that as `or`), so it is
 * not sent (`serializeViewQueries` · `viewQueryLimits` `taken`). The keys are the endpoint's own —
 * no template is resolved to read them.
 */
export function endpointUrlKeys(endpoint: {
  baseUrl?: string;
  path?: string;
  queryParams?: readonly { key: string; value?: string }[];
}): string[] {
  const keys = (endpoint.queryParams ?? []).flatMap((param) =>
    param.key ? [param.key] : [],
  );
  const written = `${endpoint.baseUrl ?? ""}${endpoint.path ?? ""}`
    .split("?")[1]
    ?.split("#")[0];
  for (const part of written?.split("&") ?? []) {
    const name = part.split("=")[0] ?? "";
    if (!name) continue;
    try {
      keys.push(decodeURIComponent(name.replace(/\+/g, " ")));
    } catch {
      keys.push(name);
    }
  }
  return [...new Set(keys)];
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
  /** ADR-320 Decision 4 — the parameter keys the endpoint's own URL already has. */
  taken?: Iterable<string>,
): SerializationWarning[] {
  const warnings: SerializationWarning[] = [];
  if (serialization.kind === "none") return warnings;
  const sent = new Set<string>(taken ?? []);
  // (ADR-291 Decision 5 — a computed field anywhere: nothing of the view goes; that is the report.)
  const computed = computedViewUses(input);
  if (computed.length) return computed;
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
    if (item.id === VIEW_SEARCH_CONDITION && serialization.searchParam) return;
    if (item.fields.length > 1) {
      warnings.push({ code: "MULTI_FIELD", conditionId: item.id });
      return;
    }
    const carried =
      item.op === "between"
        ? suffixes.gte !== undefined && suffixes.lte !== undefined
        : suffixes[item.op] !== undefined;
    if (!carried) {
      warnings.push({
        code: "COMPARISON",
        conditionId: item.id,
        comparison: item.op,
      });
      return;
    }
    // (ADR-320 Decision 4 — a key the request already has: a repeated key reads as `or`.)
    const key = viewFieldOf(item.fields[0]!, input.schema)!.key;
    const names =
      item.op === "between"
        ? [`${key}${suffixes.gte}`, `${key}${suffixes.lte}`]
        : [`${key}${suffixes[item.op]}`];
    if (names.some((name) => sent.has(name)))
      warnings.push({ code: "DUPLICATE_KEY", conditionId: item.id });
    else for (const name of names) sent.add(name);
  };
  for (const query of input.queries) {
    visit(query.where);
    // (ADR-291 Decision 6 — a body carries the grouping; a flat parameter list cannot.)
    if (serialization.kind === "suffix" && (query.groupBy || query.aggregates))
      warnings.push({ code: "GROUP" });
  }
  warnings.push(...unrunAggregates(serialization, input.queries));
  if (
    serialization.kind !== "suffix" &&
    (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD")
  )
    warnings.push({ code: "GET_BODY" });
  return warnings;
}
