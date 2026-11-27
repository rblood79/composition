/**
 * ADR-320 Phase 4 — the condition builder's edits of a scope tree (breakdown §5.6): an item
 * replaced anywhere (a group the change empties goes too — storage refuses an empty group), moved
 * before · after · into a group (a drag, 「Move up」 · 「Move down」), wrapped in a group, a group
 * ungrouped, a group's 「and · or」 switched. The root stays the scope's `and` (§5.1). Nesting is
 * capped on screen (Decision 3 — three levels of groups): an edit that would nest deeper is not
 * offered (`catalogFilterDepthTaken`). No React here.
 */
import type { ViewCondition, ViewConditionGroup } from "../document/types";
import {
  catalogFilterProbeValue,
  catalogFilterStartOp,
  type CatalogFilterBarField,
} from "./filterBarAccess";
import { CATALOG_FILTER_TREE_ID } from "./filterScope";

export type CatalogFilterItem = ViewCondition | ViewConditionGroup;

/** Decision 3 — the deepest group the builder makes (a root's group is level 1). */
export const CATALOG_FILTER_GROUP_DEPTH = 3;

const isGroup = (item: CatalogFilterItem): item is ViewConditionGroup =>
  "items" in item;

/** The items with `id` replaced by `next(item)` anywhere; a group left with no item goes. */
function itemsWith(
  items: readonly CatalogFilterItem[],
  id: string,
  next: (item: CatalogFilterItem) => readonly CatalogFilterItem[],
): CatalogFilterItem[] {
  return items.flatMap((item) => {
    if (item.id === id) return [...next(item)];
    if (!isGroup(item)) return [item];
    const inner = itemsWith(item.items, id, next);
    if (
      inner.length === item.items.length &&
      inner.every((at, i) => at === item.items[i])
    )
      return [item];
    return inner.length ? [{ ...item, items: inner }] : [];
  });
}

/** A root of `items` (`null` = no item left — the scope's 「no condition」). */
function rootOf(
  tree: ViewConditionGroup | undefined,
  items: readonly CatalogFilterItem[],
): ViewConditionGroup | null {
  return items.length
    ? { id: tree?.id ?? CATALOG_FILTER_TREE_ID, op: "and", items: [...items] }
    : null;
}

/** The tree with item `id` (anywhere) replaced by `next(item)` (`[]` = removed). */
export function catalogFilterTreeWith(
  tree: ViewConditionGroup | undefined,
  id: string,
  next: (item: CatalogFilterItem) => readonly CatalogFilterItem[],
): ViewConditionGroup | null {
  return rootOf(tree, itemsWith(tree?.items ?? [], id, next));
}

/** Where an item is: its parent group (the root's id for a root item), index and group level. */
export interface CatalogFilterPlace {
  readonly item: CatalogFilterItem;
  readonly parent: ViewConditionGroup;
  readonly index: number;
  /** The level of the group it is in (the root = 0). */
  readonly level: number;
}

export function catalogFilterPlaceOf(
  tree: ViewConditionGroup | undefined,
  id: string,
): CatalogFilterPlace | undefined {
  const walk = (
    group: ViewConditionGroup,
    level: number,
  ): CatalogFilterPlace | undefined => {
    for (const [index, item] of group.items.entries()) {
      if (item.id === id) return { item, parent: group, index, level };
      if (isGroup(item)) {
        const inner = walk(item, level + 1);
        if (inner) return inner;
      }
    }
    return undefined;
  };
  return tree ? walk(tree, 0) : undefined;
}

/** The deepest group level in `tree` (the root = 0). */
export function catalogFilterGroupDepth(
  item: CatalogFilterItem | undefined,
): number {
  if (!item || !isGroup(item)) return 0;
  return item.items.reduce(
    (deepest, inner) =>
      Math.max(
        deepest,
        isGroup(inner) ? 1 + catalogFilterGroupDepth(inner) : 0,
      ),
    0,
  );
}

/** Whether a tree nests no deeper than the builder makes (Decision 3). */
export const catalogFilterDepthTaken = (
  tree: ViewConditionGroup | null,
): boolean =>
  catalogFilterGroupDepth(tree ?? undefined) <= CATALOG_FILTER_GROUP_DEPTH;

export type CatalogFilterDropPosition = "before" | "after" | "on";

/**
 * The tree with the items `ids` moved before · after `target`, or into group `target` (its end) —
 * a drag's drop, 「Move up」 · 「Move down」. `undefined`: no such move (the target is a moved item
 * or inside one, `on` a condition, or a group would nest deeper than Decision 3).
 */
export function catalogFilterMoved(
  tree: ViewConditionGroup | undefined,
  ids: readonly string[],
  target: string,
  position: CatalogFilterDropPosition,
): ViewConditionGroup | null | undefined {
  if (!tree || ids.includes(target)) return undefined;
  const moving = new Set(ids);
  const taken: CatalogFilterItem[] = [];
  const without = (items: readonly CatalogFilterItem[]): CatalogFilterItem[] =>
    items.flatMap((item): CatalogFilterItem[] => {
      if (moving.has(item.id)) {
        taken.push(item);
        return [];
      }
      if (!isGroup(item)) return [item];
      const inner = without(item.items);
      return inner.length ? [{ ...item, items: inner }] : [];
    });
  const rest = without(tree.items);
  if (taken.length !== moving.size) return undefined;
  const at = catalogFilterPlaceOf(rootOf(tree, rest) ?? undefined, target);
  if (!at || (position === "on" && !isGroup(at.item))) return undefined;
  const placed = itemsWith(rest, target, (item) =>
    position === "on"
      ? [
          {
            ...(item as ViewConditionGroup),
            items: [...(item as ViewConditionGroup).items, ...taken],
          },
        ]
      : position === "before"
        ? [...taken, item]
        : [item, ...taken],
  );
  const next = rootOf(tree, placed);
  return catalogFilterDepthTaken(next) ? next : undefined;
}

/** 「Move up」 · 「Move down」 — the item one place earlier · later among its group's items. */
export function catalogFilterShifted(
  tree: ViewConditionGroup | undefined,
  id: string,
  by: -1 | 1,
): ViewConditionGroup | null | undefined {
  const at = catalogFilterPlaceOf(tree, id);
  const sibling = at?.parent.items[at.index + by];
  if (!at || !sibling) return undefined;
  return catalogFilterMoved(
    tree,
    [id],
    sibling.id,
    by < 0 ? "before" : "after",
  );
}

/** 「Group」 — the item in a new group of its own (`op` the opposite of its group's). */
export function catalogFilterWrapped(
  tree: ViewConditionGroup | undefined,
  id: string,
  groupId: string,
): ViewConditionGroup | null | undefined {
  const at = catalogFilterPlaceOf(tree, id);
  if (!at) return undefined;
  const op = at.parent.op === "and" ? "or" : "and";
  const next = catalogFilterTreeWith(tree, id, (item) => [
    { id: groupId, op, items: [item] },
  ]);
  return catalogFilterDepthTaken(next) ? next : undefined;
}

/** 「Ungroup」 — a group's items in its place. */
export const catalogFilterUngrouped = (
  tree: ViewConditionGroup | undefined,
  id: string,
): ViewConditionGroup | null =>
  catalogFilterTreeWith(tree, id, (item) =>
    isGroup(item) ? item.items : [item],
  );

/** A group's 「and · or」 switched. */
export const catalogFilterSwitched = (
  tree: ViewConditionGroup | undefined,
  id: string,
): ViewConditionGroup | null =>
  catalogFilterTreeWith(tree, id, (item) =>
    isGroup(item)
      ? [{ ...item, op: item.op === "and" ? "or" : "and" }]
      : [item],
  );

/**
 * An item added at the end of group `into` (the root: the tree's id or `undefined`) — a condition,
 * or a new group holding it (`group` — its `op` the opposite of the group it goes in).
 */
export function catalogFilterAdded(
  tree: ViewConditionGroup | undefined,
  into: string | undefined,
  condition: ViewCondition,
  group?: string,
): ViewConditionGroup | null | undefined {
  const parent =
    into === undefined || into === (tree?.id ?? CATALOG_FILTER_TREE_ID)
      ? undefined
      : catalogFilterPlaceOf(tree, into)?.item;
  if (parent && !isGroup(parent)) return undefined;
  const parentOp = parent ? parent.op : "and";
  const item: CatalogFilterItem = group
    ? { id: group, op: parentOp === "and" ? "or" : "and", items: [condition] }
    : condition;
  const next = parent
    ? catalogFilterTreeWith(tree, parent.id, (at) => [
        {
          ...(at as ViewConditionGroup),
          items: [...(at as ViewConditionGroup).items, item],
        },
      ])
    : rootOf(tree, [...(tree?.items ?? []), item]);
  return catalogFilterDepthTaken(next) ? next : undefined;
}

/** A group's level (the root = 0 · a root group 1) — 「Add group」 is not offered at the deepest. */
export const catalogFilterLevelOf = (
  tree: ViewConditionGroup | undefined,
  id: string,
): number => {
  if (!tree || id === tree.id) return 0;
  const at = catalogFilterPlaceOf(tree, id);
  return at ? at.level + 1 : 0;
};

/**
 * Whether the scope takes groups: an 「or」 group of two conditions on the first field it offers
 * (its start comparison) added to the tree now — the scope's judgment (`takes`).
 */
export function catalogFilterGroupsTaken(
  fields: readonly CatalogFilterBarField[],
  tree: ViewConditionGroup | undefined,
  takes: (tree: ViewConditionGroup) => boolean,
): boolean {
  const all = fields.flatMap((field) => [field, ...(field.fields ?? [])]);
  const field = all.find((at) => at.ops.length);
  const op = field && catalogFilterStartOp(field.kind, field.ops);
  if (!field || !op) return false;
  const value = catalogFilterProbeValue(op, field.kind);
  const probe = (id: string): ViewCondition => ({
    id,
    fields: [[...field.path]],
    op,
    ...(value !== undefined ? { value } : {}),
    ...(op === "withinLast" ? { unit: "day" as const } : {}),
  });
  return takes({
    id: tree?.id ?? "filter-scope",
    op: "and",
    items: [
      ...(tree?.items ?? []),
      {
        id: "filter-bar:probe-group",
        op: "or",
        items: [probe("filter-bar:probe-a"), probe("filter-bar:probe-b")],
      },
    ],
  });
}
