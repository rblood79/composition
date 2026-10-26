/**
 * ADR-284 — a view's variable references (`!var.<id>[.path]` in a condition's value · `enabled`,
 * a sort variable) through an id map: a copy that copies the variables (a page duplicate · an
 * element variable inside a pasted subtree) points its view at the copies. Other ids stay.
 */
import type {
  DataBindingRef,
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "./types";

function mapRef<T>(value: T, map: (id: string) => string | undefined): T {
  if (typeof value !== "string" || !value.startsWith("!var.")) return value;
  const [head, ...path] = value.slice("!var.".length).split(".");
  const next = head ? map(head) : undefined;
  return (next ? ["!var." + next, ...path].join(".") : value) as T;
}

function mapItem(
  item: ViewCondition | ViewConditionGroup,
  map: (id: string) => string | undefined,
): ViewCondition | ViewConditionGroup {
  if ("items" in item)
    return { ...item, items: item.items.map((child) => mapItem(child, map)) };
  return {
    ...item,
    ...(item.value !== undefined
      ? {
          value: Array.isArray(item.value)
            ? item.value.map((cell) => mapRef(cell, map))
            : mapRef(item.value, map),
        }
      : {}),
    ...(item.enabled !== undefined
      ? { enabled: mapRef(item.enabled, map) }
      : {}),
  };
}

export function mapViewVariables<Q extends ViewQuery>(
  query: Q,
  map: (id: string) => string | undefined,
): Q {
  const sort =
    query.sort && "variableId" in query.sort
      ? {
          variableId: (map(query.sort.variableId) ??
            query.sort.variableId) as typeof query.sort.variableId,
        }
      : query.sort;
  return {
    ...query,
    where: mapItem(query.where, map) as ViewConditionGroup,
    ...(sort ? { sort } : {}),
  };
}

/** A binding with its built-in view's variables mapped (a shared view is the project's). */
export function mapBindingViewVariables(
  binding: DataBindingRef,
  map: (id: string) => string | undefined,
): DataBindingRef {
  return binding.view
    ? { ...binding, view: mapViewVariables(binding.view, map) }
    : binding;
}
