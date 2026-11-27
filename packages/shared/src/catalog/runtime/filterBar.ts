/**
 * ADR-320 Phase 2 — a filter bar's chips as rows (breakdown §5.10): one row per root item of its
 * tree, the words in the site's language (`filterWording.ts` — the Column filter dialog's). The tree
 * is the bar's authored start (`defaultQuery`) — the Canvas's, and the Preview's first screen until
 * the scope's run-time tree reaches the rows (Phase 3). A condition names its field by the label of
 * the field its path ends at, read through the bar's lists' collection (a reference path walks into
 * the referenced collection — `fields[0]` is the condition's first path).
 */
import type {
  CatalogEntry,
  NodeEntry,
  ViewCondition,
  ViewConditionGroup,
} from "../document/types";
import {
  catalogFilterPresetsFit,
  type CatalogFilterPreset,
} from "../document/filterQuery";
import { catalogFilterTreeRead } from "./filterScope";
import { catalogFilterChips } from "./filterWording";

const FIELD_PREFIX = "data:field:";

/** A prop's authored value (a `set` write). */
const setValue = (node: NodeEntry, key: string): unknown => {
  const write = node.props[key];
  return write?.kind === "set" ? write.value : undefined;
};

/** Whether the bar keeps its tree in the browser (「Remember filters」 — 사용자 결정 4). */
export const catalogFilterBarRemembers = (bar: NodeEntry): boolean =>
  setValue(bar, "rememberFilters") === true;

/** The bar's named sets (사용자 결정 6 — the author's, in the document); none = `[]`. */
export function catalogFilterBarPresets(
  bar: NodeEntry,
): readonly CatalogFilterPreset[] {
  const value = setValue(bar, "presets");
  return catalogFilterPresetsFit(value) ? (value as CatalogFilterPreset[]) : [];
}

/** The bar's start tree (`undefined` = none — an empty or unreadable value). */
export function catalogFilterBarStartTree(
  bar: NodeEntry,
): ViewConditionGroup | undefined {
  return catalogFilterTreeRead(setValue(bar, "defaultQuery")) ?? undefined;
}

/** The collection the bar's lists read (its first bound list's). */
export function catalogFilterBarCollection(
  bar: NodeEntry,
  read: (id: string) => CatalogEntry | undefined,
): string | undefined {
  for (const id of bar.filtersOf ?? []) {
    const list = read(id);
    if (list?.kind === "node" && list.binding) return list.binding.collectionId;
  }
  return undefined;
}

/** A condition's field name: the labels along its first path (a reference field's into its own). */
export function catalogFilterFieldLabel(
  condition: ViewCondition,
  collectionId: string | undefined,
  read: (id: string) => CatalogEntry | undefined,
): string {
  const path = condition.fields[0] ?? [];
  const names: string[] = [];
  let at = collectionId;
  for (const step of path) {
    const fieldId = step.startsWith(FIELD_PREFIX)
      ? step.slice(FIELD_PREFIX.length)
      : step;
    const collection = at ? read(at) : undefined;
    const field =
      collection?.kind === "collection"
        ? collection.schema.find((item) => item.id === fieldId)
        : undefined;
    names.push(field ? (field.label ?? field.key) : fieldId);
    at = field?.reference?.collectionId;
  }
  return names.join(" › ");
}

/** The chip rows of a bar: key = the item's id, the chip's texts as values. */
export function catalogFilterBarChipRows(
  bar: NodeEntry,
  read: (id: string) => CatalogEntry | undefined,
  locale: string,
  tree: ViewConditionGroup | undefined = catalogFilterBarStartTree(bar),
): { key: string; values: Record<string, string | boolean> }[] {
  const collectionId = catalogFilterBarCollection(bar, read);
  return catalogFilterChips(
    tree,
    (condition) => catalogFilterFieldLabel(condition, collectionId, read),
    locale,
  ).map((chip) => ({
    key: chip.id,
    values: {
      id: chip.id,
      field: chip.field,
      comparison: chip.comparison,
      value: chip.value,
      label: chip.label,
      enabled: chip.enabled,
    },
  }));
}

/**
 * The list types a filter bar filters (breakdown §9 Phase 0 「대상이 될 목록 종류」 — 17): the
 * collections that repeat their rows (`COLLECTION_TYPE_TABLE` `repeat` owners, the bar itself
 * aside), the pickers, the groups a binding repeats (a Pagination's page group aside) and Chart.
 */
export const CATALOG_FILTER_TARGET_TYPES: ReadonlySet<string> = new Set([
  "Tabs",
  "TagGroup",
  "SelectBoxGroup",
  "ListBox",
  "GridList",
  "Menu",
  "Breadcrumbs",
  "Tree",
  "CardView",
  "Table",
  "Select",
  "ComboBox",
  "RadioGroup",
  "CheckboxGroup",
  "ToggleButtonGroup",
  "SegmentedControl",
  "Chart",
]);

/** The bar whose scope holds a list (one at most — graph `FILTER_TARGET_TAKEN`). */
export function catalogFilterBarOf(
  bars: Iterable<string>,
  read: (id: string) => CatalogEntry | undefined,
  listId: string,
): NodeEntry | undefined {
  for (const id of bars) {
    const bar = read(id);
    if (bar?.kind === "node" && bar.filtersOf?.includes(listId as never))
      return bar;
  }
  return undefined;
}
