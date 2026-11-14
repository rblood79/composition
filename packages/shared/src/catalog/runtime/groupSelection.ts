/**
 * ADR-308 Decision 1 · 3 — a selection (and expansion) is its group's: the group stores the keys of
 * its items (S2 · RAC `selectedKey(s)` · `value` · `expandedKeys`), an item is selected while its
 * key is among them. One reading for every consumer — the Canvas (`presence.ts`), the DOM
 * (`delegatedDom.runtime.ts` · `domBinding.runtime.ts`) and the dispatcher — so the two renderers
 * cannot pick different items (R1).
 *
 * An item's key is `catalogItemKey` (its authored `id`; a group Radio's · Checkbox's `value`), the
 * key every consumer hands RAC too (R9).
 */
import { CATALOG_TOGGLE_GROUP_OF } from "../document/sizePropagation";
import {
  COLLECTION_ITEM_OWNERS,
  catalogCollectionSelectionMode,
} from "../document/collectionItems";
import { resolveStaticItemKey } from "../slotRoles";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogPickerOfOption } from "./pickerSelection";

type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** How a group holds its selection (installed S2 · RAC, breakdown §2). */
type SelectionShape = "key" | "keys" | "value" | "values" | "picker";

const SELECTION_SHAPES: Readonly<Record<string, SelectionShape>> = {
  Tabs: "key",
  SegmentedControl: "key",
  ComboBox: "key",
  Select: "picker",
  RadioGroup: "value",
  CheckboxGroup: "values",
  ListBox: "keys",
  GridList: "keys",
  Table: "keys",
  Tree: "keys",
  TagGroup: "keys",
  Menu: "keys",
  CardView: "keys",
  ToggleButtonGroup: "keys",
  SelectBoxGroup: "keys",
};

/** The groups whose selection this module reads. */
export const CATALOG_SELECTION_GROUP_TYPES: ReadonlySet<string> = new Set(
  Object.keys(SELECTION_SHAPES),
);

/** The groups whose expansion this module reads (`expandedKeys`). */
export const CATALOG_EXPANSION_GROUP_TYPES: ReadonlySet<string> = new Set([
  "Tree",
  "Accordion",
]);

/**
 * A group's selection props — `[controlled, default]` (S2 names). The Design panel writes the one
 * `catalogGroupSelectionStoreProp` names; the other is accepted and read first (Decision 2).
 */
export function catalogGroupSelectionProps(
  groupType: string,
): readonly [string, string] | undefined {
  const shape = SELECTION_SHAPES[groupType];
  if (!shape) return undefined;
  return shape === "key"
    ? ["selectedKey", "defaultSelectedKey"]
    : shape === "keys"
      ? ["selectedKeys", "defaultSelectedKeys"]
      : ["value", "defaultValue"];
}

/** The prop the Design panel stores a group's selection in (the family's convention — §2). */
export function catalogGroupSelectionStoreProp(
  groupType: string,
): string | undefined {
  const shape = SELECTION_SHAPES[groupType];
  if (!shape) return undefined;
  return shape === "key"
    ? "defaultSelectedKey"
    : shape === "keys"
      ? "defaultSelectedKeys"
      : "value";
}

/** A group selects several keys (a list) — else one (`selectedKey` · a RadioGroup's `value`). */
export function catalogGroupSelectsMany(
  groupType: string,
  props: Readonly<Record<string, unknown>>,
): boolean {
  const shape = SELECTION_SHAPES[groupType];
  if (shape === "values") return true;
  if (shape === "keys")
    return catalogCollectionSelectionMode(groupType, props) === "multiple";
  if (shape === "picker") return props.selectionMode === "multiple";
  return false;
}

/** The item types whose key a group's selection names. */
const GROUP_ITEM_TYPES_OF: Readonly<Record<string, readonly string[]>> = {
  Tabs: ["Tab"],
  SegmentedControl: ["SegmentedControlItem"],
  ComboBox: ["ListBoxItem"],
  Select: ["ListBoxItem"],
  RadioGroup: ["Radio"],
  CheckboxGroup: ["Checkbox"],
  ListBox: ["ListBoxItem"],
  GridList: ["GridListItem"],
  Table: ["Row"],
  Tree: ["TreeItem"],
  TagGroup: ["Tag"],
  Menu: ["MenuItem"],
  CardView: ["Card"],
  ToggleButtonGroup: ["ToggleButton"],
  SelectBoxGroup: ["SelectBox"],
  Accordion: ["Disclosure"],
};

/** Items whose key is their `value` inside their group (the reference's Radio · Checkbox). */
const VALUE_KEYED_ITEMS: ReadonlySet<string> = new Set(["Radio", "Checkbox"]);

/**
 * An item's RAC key: its authored `id` (a Radio's · Checkbox's `value`), else the record's identity
 * (`resolveStaticItemKey`). The DOM hands RAC this key, the group's selection names it.
 */
export function catalogItemKey(
  item: CatalogConsumerNode,
  typeOf: TypeOf,
): string {
  const props = item.props as Record<string, unknown>;
  if (VALUE_KEYED_ITEMS.has(typeOf(item))) {
    const value = props.value;
    return typeof value === "string" && value !== ""
      ? value
      : typeof value === "number"
        ? String(value)
        : item.id;
  }
  return resolveStaticItemKey(props, item.id);
}

/** A group that RAC's state context reaches through any element (a toggle's group). */
function nearestOfType(
  item: CatalogConsumerNode,
  type: string,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  for (let cursor = get(item.parentId); cursor; cursor = get(cursor.parentId))
    if (typeOf(cursor) === type) return cursor;
  return undefined;
}

/**
 * The group whose selection decides an item's: a toggle's nearest group (RAC's group state
 * context), a picker's option's Select · ComboBox (through its Popover · ListBox), a Menu's ·
 * SelectBoxGroup's item, else the collection it sits in (through its wrappers — TabList, sections,
 * TableBody, parent TreeItems). Frames between are passed (RAC context crosses any element).
 */
export function catalogSelectionGroupOf(
  item: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  const type = typeOf(item);
  const toggleGroup = CATALOG_TOGGLE_GROUP_OF[type];
  if (toggleGroup) {
    // (A selection checkbox is its item's part, not a group member.)
    if (item.props.slot === "selection") return undefined;
    return nearestOfType(item, toggleGroup, get, typeOf);
  }
  if (type === "SegmentedControlItem")
    return nearestOfType(item, "SegmentedControl", get, typeOf);
  if (type === "ListBoxItem" || type === "MenuItem" || type === "SelectBox") {
    const picker = catalogPickerOfOption(item, get, typeOf);
    if (picker) return picker;
  }
  const owners = COLLECTION_ITEM_OWNERS[type];
  if (!owners) return undefined;
  let cursor = get(item.parentId);
  while (
    cursor &&
    (owners.through.includes(typeOf(cursor)) || typeOf(cursor) === "frame")
  )
    cursor = get(cursor.parentId);
  return cursor && owners.owners.includes(typeOf(cursor)) ? cursor : undefined;
}

/** A group's items (in document order) — the ones whose `catalogSelectionGroupOf` is it. */
export function catalogGroupItems(
  group: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  const itemTypes = GROUP_ITEM_TYPES_OF[typeOf(group)] ?? [];
  const items: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const id of node.children) {
      const child = get(id);
      if (!child) continue;
      if (
        itemTypes.includes(typeOf(child)) &&
        (typeOf(group) === "Accordion"
          ? nearestOfType(child, "Accordion", get, typeOf)?.id === group.id
          : catalogSelectionGroupOf(child, get, typeOf)?.id === group.id)
      )
        items.push(child);
      visit(child);
    }
  };
  visit(group);
  return items;
}

/** A group's selected keys: `"all"`, or a list (empty = nothing selected). */
export type CatalogGroupKeys = readonly string[] | "all";

const keyText = (value: unknown): string | undefined =>
  typeof value === "string" && value !== ""
    ? value
    : typeof value === "number"
      ? String(value)
      : undefined;

const keyList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((key) => {
        const text = keyText(key);
        return text === undefined ? [] : [text];
      })
    : [];

/** The first of a group's stored props that holds a value (controlled, then default). */
function stored(
  props: Readonly<Record<string, unknown>>,
  names: readonly [string, string],
): unknown {
  const controlled = props[names[0]];
  return controlled !== undefined && controlled !== null
    ? controlled
    : props[names[1]];
}

/**
 * A group's selection (ADR-308 Decision 2 · 3): the controlled prop, else the default one, else the
 * group's RAC default — Tabs · SegmentedControl the first enabled item, the rest nothing. A
 * collection that selects nothing (`selectionMode` none) has an empty selection, as RAC's.
 */
export function catalogGroupSelection(
  group: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogGroupKeys {
  const type = typeOf(group);
  const shape = SELECTION_SHAPES[type];
  const names = catalogGroupSelectionProps(type);
  if (!shape || !names) return [];
  const props = group.props as Record<string, unknown>;
  const raw = stored(props, names);
  switch (shape) {
    case "keys": {
      if (catalogCollectionSelectionMode(type, props) === "none") return [];
      if (raw === "all") return "all";
      return keyList(raw);
    }
    case "key": {
      const key = keyText(raw);
      if (type === "ComboBox") return key === undefined ? [] : [key];
      // (Tabs · SegmentedControl: a key no item has — or none — is RAC's first enabled item,
      //  `useTabListState` · the single-selection group's `disallowEmptySelection`.)
      const items = catalogGroupItems(group, get, typeOf);
      if (
        key !== undefined &&
        items.some((item) => catalogItemKey(item, typeOf) === key)
      )
        return [key];
      const disabledKeys = new Set(
        Array.isArray(props.disabledKeys) ? props.disabledKeys.map(String) : [],
      );
      const first = items.find(
        (item) =>
          item.props.isDisabled !== true &&
          !disabledKeys.has(catalogItemKey(item, typeOf)),
      );
      return first ? [catalogItemKey(first, typeOf)] : [];
    }
    case "picker": {
      const keys = Array.isArray(raw)
        ? keyList(raw)
        : keyText(raw) !== undefined
          ? [keyText(raw)!]
          : [];
      return props.selectionMode === "multiple" ? keys : keys.slice(0, 1);
    }
    case "value": {
      const key = keyText(raw);
      return key === undefined ? [] : [key];
    }
    case "values":
      return keyList(raw);
  }
}

/** Whether `keys` holds `key`. */
export function catalogKeysHold(keys: CatalogGroupKeys, key: string): boolean {
  return keys === "all" || keys.includes(key);
}

/**
 * Whether an item is selected by its group (RAC `data-selected`): undefined outside a selection
 * group — a standalone toggle · Card keeps its own `isSelected` (RAC's own state).
 */
export function catalogItemSelected(
  item: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean | undefined {
  const group = catalogSelectionGroupOf(item, get, typeOf);
  if (!group) return undefined;
  return catalogKeysHold(
    catalogGroupSelection(group, get, typeOf),
    catalogItemKey(item, typeOf),
  );
}

/**
 * A Tree's · an Accordion's expanded keys: `expandedKeys`, else `defaultExpandedKeys` (absent = none,
 * RAC's default). An Accordion that expands one keeps the first (RAC `useDisclosureGroupState`).
 */
export function catalogGroupExpansion(
  group: CatalogConsumerNode,
  typeOf: TypeOf,
): string[] {
  const props = group.props as Record<string, unknown>;
  const keys = keyList(stored(props, ["expandedKeys", "defaultExpandedKeys"]));
  return typeOf(group) === "Accordion" &&
    props.allowsMultipleExpanded !== true &&
    keys.length > 1
    ? keys.slice(0, 1)
    : keys;
}
