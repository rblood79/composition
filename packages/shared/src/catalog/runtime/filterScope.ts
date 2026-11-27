/**
 * ADR-320 — a filter scope's condition tree: the one run-time filter of a target (Decision 1 —
 * HC3). Its value is a view's condition group as it is (`ViewConditionGroup`, the root an `and`):
 * a Table's column menu reads and writes the root's condition of that Column
 * (`table-filter:<Column key>`), a filter bar edits the whole tree, and the rows read it joined to
 * the authored view's conditions by `and` (`catalogTableStateQueries`).
 *
 * This module holds the tree's shape and its edits. What a scope accepts (the request must carry
 * the condition — Decision 4) is judged where the tree is assigned, with these functions.
 */
import {
  VIEW_COMPARISONS,
  type DataFieldId,
  type ViewComparison,
  type ViewCondition,
  type ViewConditionGroup,
} from "../document/types";

/** The id of a scope tree's root group. */
export const CATALOG_FILTER_TREE_ID = "filter-scope";
/** The id of a Table Column's condition in the tree (`table-filter:<Column key>`). */
export const catalogColumnFilterConditionId = (column: string) =>
  `table-filter:${column}`;

/** A Column filter's condition as its dialog writes it (the Column names the field). */
export type CatalogColumnFilterCondition = Pick<
  ViewCondition,
  "op" | "value" | "sensitivity" | "unit"
>;

/** The deepest nesting a tree read from outside may have (a guard, not the UI's limit). */
const MAX_DEPTH = 16;
const SENSITIVITIES = ["base", "accent", "case", "variant"];
const UNITS = ["day", "week", "month", "year"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

function conditionOf(
  value: Record<string, unknown>,
): ViewCondition | undefined {
  const { id, fields, op, skip, enabled, sensitivity, unit } = value;
  if (typeof id !== "string" || !id) return undefined;
  if (!(VIEW_COMPARISONS as readonly unknown[]).includes(op)) return undefined;
  if (
    !Array.isArray(fields) ||
    !fields.length ||
    !fields.every(
      (path) =>
        Array.isArray(path) &&
        path.length > 0 &&
        path.every(
          (step) => typeof step === "string" && step.startsWith("data:field:"),
        ),
    )
  )
    return undefined;
  const compared = value.value;
  if (
    compared !== undefined &&
    !isScalar(compared) &&
    !(Array.isArray(compared) && compared.every(isScalar))
  )
    return undefined;
  if (skip !== undefined && !isScalar(skip)) return undefined;
  // (A run-time tree holds what applies as a value — no reference to a variable.)
  if (enabled !== undefined && typeof enabled !== "boolean") return undefined;
  if (
    sensitivity !== undefined &&
    !SENSITIVITIES.includes(sensitivity as string)
  )
    return undefined;
  if (unit !== undefined && !UNITS.includes(unit as string)) return undefined;
  return {
    id,
    fields: (fields as string[][]).map((path) => [...path] as DataFieldId[]),
    op: op as ViewComparison,
    ...(compared !== undefined
      ? { value: compared as ViewCondition["value"] }
      : {}),
    ...(skip !== undefined ? { skip: skip as ViewCondition["skip"] } : {}),
    ...(enabled !== undefined ? { enabled } : {}),
    ...(sensitivity !== undefined
      ? { sensitivity: sensitivity as ViewCondition["sensitivity"] }
      : {}),
    ...(unit !== undefined ? { unit: unit as ViewCondition["unit"] } : {}),
  };
}

function groupOf(
  value: Record<string, unknown>,
  depth: number,
): ViewConditionGroup | undefined {
  const { id, op, items } = value;
  if (typeof id !== "string" || !id) return undefined;
  if (op !== "and" && op !== "or") return undefined;
  if (!Array.isArray(items) || depth > MAX_DEPTH) return undefined;
  const out: (ViewCondition | ViewConditionGroup)[] = [];
  for (const item of items) {
    if (!isRecord(item)) return undefined;
    if ("items" in item) {
      const inner = groupOf(item, depth + 1);
      if (!inner) return undefined;
      // (A group with nothing in it says nothing — the stored form refuses an empty `or`.)
      if (inner.items.length) out.push(inner);
    } else {
      const condition = conditionOf(item);
      if (!condition) return undefined;
      out.push(condition);
    }
  }
  return { id, op, items: out };
}

/**
 * A value from outside the session (a rule's Do · the browser's memory · an address · a filter
 * bar's authored start) as a scope tree — `undefined` = not a tree (nothing is written), `null` =
 * an empty tree (no filter). The root is an `and`: an `or` given as the root is its one item. A
 * root item named again (a Column filtered again) is its later value, at its first place.
 */
export function catalogFilterTreeRead(
  value: unknown,
): ViewConditionGroup | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const read = groupOf(value, 0);
  if (!read) return undefined;
  const root: ViewConditionGroup =
    read.op === "and"
      ? read
      : { id: CATALOG_FILTER_TREE_ID, op: "and", items: [read] };
  const byId = new Map<string, ViewCondition | ViewConditionGroup>();
  for (const item of root.items) byId.set(item.id, item);
  const items = [...byId.values()];
  return items.length ? { ...root, items } : null;
}

/** Every condition of a tree, in order (the groups walked through). */
export function catalogFilterTreeConditions(
  tree: ViewConditionGroup | undefined,
): ViewCondition[] {
  const out: ViewCondition[] = [];
  const walk = (group: ViewConditionGroup) => {
    for (const item of group.items)
      if ("items" in item) walk(item);
      else out.push(item);
  };
  if (tree) walk(tree);
  return out;
}

/** A Table Column's own condition: the root's item of that Column, if it is a condition. */
export function catalogFilterColumnCondition(
  tree: ViewConditionGroup | undefined,
  column: string,
): ViewCondition | undefined {
  const id = catalogColumnFilterConditionId(column);
  const item = tree?.items.find((entry) => entry.id === id);
  return item && !("items" in item) ? item : undefined;
}

/**
 * The tree with a Table Column's condition written (in place of the one it had, else last) or
 * dropped (`undefined`). The other items — a filter bar's conditions and groups, on that field or
 * any other — stay as they are. The result may have no item (the caller's slice rule removes it).
 */
export function catalogFilterTreeWithColumn(
  tree: ViewConditionGroup | undefined,
  column: string,
  field: DataFieldId | undefined,
  condition: CatalogColumnFilterCondition | undefined,
): ViewConditionGroup {
  const id = catalogColumnFilterConditionId(column);
  const entry: ViewCondition | undefined = condition &&
    field && {
      id,
      fields: [[field]],
      op: condition.op,
      ...(condition.value !== undefined ? { value: condition.value } : {}),
      ...(condition.sensitivity ? { sensitivity: condition.sensitivity } : {}),
      ...(condition.unit ? { unit: condition.unit } : {}),
    };
  const held = tree?.items ?? [];
  const items = held.some((item) => item.id === id)
    ? held.flatMap((item) => (item.id !== id ? [item] : entry ? [entry] : []))
    : entry
      ? [...held, entry]
      : [...held];
  return { id: tree?.id ?? CATALOG_FILTER_TREE_ID, op: "and", items };
}

/** Whether a tree is its root's conditions only — no group anywhere (the fast local path). */
export const catalogFilterTreeFlat = (tree: ViewConditionGroup): boolean =>
  tree.items.every((item) => !("items" in item));
