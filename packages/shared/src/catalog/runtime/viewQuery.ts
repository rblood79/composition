/**
 * ADR-284 — what a binding's view reads, resolved once per row request: the view chain (a shared
 * view's source views first, then the bound one — or the binding's built-in view) and the current
 * value of every reference it holds (`!var.<id>[.path]` — the bound node's page variable or the
 * project's; runtime values in the Preview · Publish, defaults on the Canvas). The row source
 * (`catalogBoundRows`) runs it with `runViewQueries` — the same function in every consumer.
 */
import type { CatalogGraph } from "../document/graph";
import type {
  DataBindingRef,
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../document/types";
import { parseRuleValueRef } from "../../interactions/valueRef";
import { catalogVariableValue, type CatalogStateSource } from "./stateTemplate";

/** A binding's view as the row source runs it. */
export interface CatalogRowQuery {
  queries: readonly ViewQuery[];
  /** Each reference the queries hold → its current value (absent = it does not resolve). */
  values: Readonly<Record<string, unknown>>;
  /** The variable names the queries read (a write to one of them shows the rows again). */
  names: readonly string[];
  /**
   * ADR-284 Decision 6 — set by the Preview · Publish session when the rows are the server's answer
   * to this view (the request carried it): the view does not run on them again. `complete` = no
   * further page; `total` = the server's count for the query; `warnings` = conditions the request
   * could not carry (the result holds rows they would have left out).
   */
  served?: { complete: boolean; total?: number; warnings?: number };
  /** The session's load of an API collection the view runs on locally: `complete` = no further page. */
  loaded?: { complete: boolean };
}

/** The views a binding reads, its shared view's sources first; undefined = none. */
export function catalogBindingViews(
  graph: Pick<CatalogGraph, "getEntry">,
  binding: DataBindingRef,
): ViewQuery[] | undefined {
  if (binding.view) return [binding.view];
  if (!binding.viewId) return undefined;
  const chain: ViewQuery[] = [];
  const seen = new Set<string>();
  for (let id: string | undefined = binding.viewId; id && !seen.has(id);) {
    seen.add(id);
    const view = graph.getEntry(id as never);
    if (view?.kind !== "view") return undefined;
    chain.unshift(view);
    id = "viewId" in view.source ? view.source.viewId : undefined;
  }
  return chain;
}

/** Every reference string a view chain holds (condition values · `enabled` · a sort variable). */
export function catalogViewReferences(queries: readonly ViewQuery[]): string[] {
  const refs = new Set<string>();
  const add = (value: unknown) => {
    if (parseRuleValueRef(value)) refs.add(value as string);
  };
  const visit = (item: ViewCondition | ViewConditionGroup) => {
    if ("items" in item) {
      item.items.forEach(visit);
      return;
    }
    if (Array.isArray(item.value)) item.value.forEach(add);
    else add(item.value);
    add(item.enabled);
  };
  for (const query of queries) {
    visit(query.where);
    if (query.sort && "variableId" in query.sort)
      refs.add(`!var.${query.sort.variableId}`);
  }
  return [...refs];
}

/** A binding's view with its references read for `ownerId`; undefined = the binding has none. */
export function catalogBindingQuery(
  graph: CatalogGraph,
  binding: DataBindingRef,
  ownerId: string | undefined,
  source: CatalogStateSource | undefined,
): CatalogRowQuery | undefined {
  const queries = catalogBindingViews(graph, binding);
  if (!queries) return undefined;
  const values: Record<string, unknown> = {};
  const names = new Set<string>();
  for (const ref of catalogViewReferences(queries)) {
    // (A view runs outside any event: only variables resolve — `!event` · `!item` stay broken.)
    const parsed = parseRuleValueRef(ref);
    if (parsed?.from !== "var") continue;
    const variable = catalogVariableValue(
      graph,
      parsed.variableId,
      ownerId,
      source,
    );
    if (!variable) continue;
    names.add(variable.name);
    let value = variable.value;
    for (const segment of parsed.path)
      value =
        value !== null && typeof value === "object"
          ? (value as Record<string, unknown>)[segment]
          : undefined;
    // (A RAC `Selection` written by a rule: a `Set` reads as its keys.)
    values[ref] = value instanceof Set ? [...value] : value;
  }
  return { queries, values, names: [...names] };
}

/** The run's reader of a query's values: a reference to its value, a literal to itself. */
export function catalogRowQueryResolve(
  query: CatalogRowQuery,
): (value: unknown) => { value: unknown } | undefined {
  return (value) =>
    parseRuleValueRef(value)
      ? Object.prototype.hasOwnProperty.call(query.values, value as string)
        ? { value: query.values[value as string] }
        : undefined
      : { value };
}
