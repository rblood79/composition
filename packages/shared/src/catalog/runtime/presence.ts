import { getIconData } from "@composition/rendering";
import { isDisclosureExpandedInContext } from "../../utils/disclosureGroupExpansion";
import { resolveStaticItemKey } from "../slotRoles";
import { getNecessityIndicatorSuffix } from "../../components/FieldNecessityIndicator";
import { COLLECTION_ITEM_OWNERS } from "../document/collectionItems";
import { RAC_SLOT_PROVIDERS } from "../generated/racSlotProviders";
import { MANUAL_ITEM_LABEL_COLORS } from "../document/manualBoxRules";
import { catalogCalendarTitle } from "../resolvers/resolveCatalogRuleCanvasBox";
import { racFieldHourCycle } from "../document/dateSegments";
import type { CatalogConsumerNode } from "./compositionRoot";
import type {
  CatalogShowWhen,
  CatalogStateKey,
  CatalogStateOwnerRef,
} from "../document/types";
import { catalogStateKeysOf } from "../document/stateOwnerRefs";
import { isFieldControlGroup } from "../../domain/componentTraits";
export { catalogStateKeysOf };

/**
 * ADR-248 resting-state presence of a resolved node: which nodes a component does not show until
 * the user opens or selects something. Layout gives them no box (`display: none`) and the Canvas
 * does not draw them; the DOM binding reaches the same result through RAC (closed popovers,
 * unselected TabPanel, collapsed TreeItem).
 *
 * Pure over consumer records; `get`/`typeOf` are the caller's record lookup and type name.
 */
export type CatalogRecordLookup = (
  id: string,
) => CatalogConsumerNode | undefined;
export type CatalogTypeOf = (node: CatalogConsumerNode) => string;

/** Children a trigger component keeps in its closed overlay (popover / dialog / listbox). */
const TRIGGER_OVERLAY_CHILDREN: Readonly<Record<string, ReadonlySet<string>>> =
  {
    DialogTrigger: new Set(["Dialog", "Modal", "Popover"]),
    // ADR-255: RAC TooltipTrigger — the Tooltip shows on the trigger's hover / focus.
    TooltipTrigger: new Set(["Tooltip"]),
    // ADR-256 Phase 6c · 6d · 6e: a picker's list · calendar is in its Popover (a ListBox · Calendar
    // outside it shows — RAC draws it in the picker's context; items sit only in a ListBox).
    DatePicker: new Set(["Popover"]),
    DateRangePicker: new Set(["Popover"]),
    Select: new Set(["Popover"]),
    ComboBox: new Set(["Popover"]),
    // RAC MenuTrigger: the items live in the closed Popover; only the trigger button shows.
    Menu: new Set([
      "MenuItem",
      "SubmenuTrigger",
      "MenuSection",
      "Separator",
      "Popover",
    ]),
    // ADR-256 Phase 5g: the submenu lives in the trigger item's closed Popover.
    SubmenuTrigger: new Set(["Popover"]),
  };

/** Disclosure children rendered as its trigger, not inside its RAC DisclosurePanel. */
const DISCLOSURE_TRIGGER_TYPES: ReadonlySet<string> = new Set([
  "DisclosureHeader",
  "Heading",
]);

/**
 * Whether RAC shows a Disclosure's panel: its own `isExpanded` (absent = expanded), or inside a
 * DisclosureGroup the group's expanded keys (`isDisclosureExpandedInContext`, the DOM binding's).
 */
export function catalogDisclosureExpanded(
  disclosure: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  const node = (record: CatalogConsumerNode) => ({
    id: record.id,
    type: typeOf(record),
    props: record.props as Record<string, unknown>,
  });
  const parent = get(disclosure.parentId);
  return isDisclosureExpandedInContext(
    node(disclosure),
    parent ? node(parent) : null,
    parent && typeOf(parent) === "DisclosureGroup"
      ? childrenOf(parent, get).map(node)
      : undefined,
  );
}

/** Types whose change can move Tabs' selected panel. */
export const TABS_SELECTION_TYPES: ReadonlySet<string> = new Set([
  "Tabs",
  "TabList",
  "Tab",
  "TabPanels",
  "TabPanel",
]);

const childrenOf = (node: CatalogConsumerNode, get: CatalogRecordLookup) =>
  node.children.flatMap((id) => {
    const child = get(id);
    return child ? [child] : [];
  });

/**
 * ADR-256 G2 — a layout frame the author puts around a field's parts is a plain element with no
 * RAC context of its own: the parts inside it stay in the field's context (RAC passes context
 * through any element). The field's part lookups go through it.
 */
const PART_FRAME_TYPES: ReadonlySet<string> = new Set(["frame"]);

/** A node's parent with the layout frames it sits in skipped (`PART_FRAME_TYPES`). */
export function catalogPartParent(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  let parent = get(node.parentId);
  while (parent && PART_FRAME_TYPES.has(typeOf(parent)))
    parent = get(parent.parentId);
  return parent;
}

/** A node's children with the layout frames among them opened (`PART_FRAME_TYPES`). */
function partChildrenOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return childrenOf(node, get).flatMap((child) =>
    PART_FRAME_TYPES.has(typeOf(child))
      ? partChildrenOf(child, get, typeOf)
      : [child],
  );
}

/**
 * Fields the Preview draws as their node tree (ADR-256 Phase 2): each part shows by its own value,
 * not by a field prop — the Description its own text (`presentWhen`).
 */
const NODE_TREE_FIELDS: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "DateField",
  "TimeField",
  "Checkbox",
  "Switch",
  "Radio",
  "CheckboxGroup",
  "RadioGroup",
]);

/**
 * Tabs' Tab ↔ TabPanel pairing (by `itemId`, or by order for a typed template without item keys)
 * and the key RAC selects on the first render (explicit key, else the first enabled tab).
 */
export function catalogTabsSelection(
  tabsNode: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
) {
  // (Through the frames around them — ADR-256 Phase 5e-2: Tabs takes free content.)
  const direct = partChildrenOf(tabsNode, get, typeOf);
  const tabList = direct.find((child) => typeOf(child) === "TabList");
  const panelsNode = direct.find((child) => typeOf(child) === "TabPanels");
  const tabs = tabList
    ? childrenOf(tabList, get).filter((child) => typeOf(child) === "Tab")
    : [];
  const panels = panelsNode
    ? childrenOf(panelsNode, get).filter(
        (child) => typeOf(child) === "TabPanel",
      )
    : [];
  const keyed = panels.some((panel) => panel.props.itemId !== undefined);
  const pairs = tabs.map((tab, index) => {
    const key = resolveStaticItemKey(
      tab.props as Record<string, unknown>,
      tab.id,
    );
    const panel =
      panels.find((candidate) => candidate.props.itemId === key) ??
      (keyed ? undefined : panels[index]);
    return { key, tab, panel };
  });
  const explicit = tabsNode.props.defaultSelectedKey;
  const firstEnabled =
    pairs.find((pair) => pair.tab.props.isDisabled !== true) ?? pairs[0];
  const selectedKey = explicit ? String(explicit) : firstEnabled?.key;
  return { tabList, panelsNode, tabs, panels, pairs, selectedKey };
}

/**
 * RAC `data-selected` of an item inside its collection: the collection's selection state decides
 * (the DOM binding's keys — Tabs' selected key, else its first enabled Tab; ListBox's
 * `selectedKey`; TagGroup/GridList/Tree none), not the item template's display state. Undefined
 * outside a collection (a state origin shows its own display state).
 */
function catalogCollectionItemSelected(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean | undefined {
  // A selection checkbox shows its item's selection (RAC `CheckboxFieldContext` slot `selection`).
  const checkboxItem = catalogSelectionCheckboxItem(node, get, typeOf);
  if (checkboxItem)
    return catalogStateValue(checkboxItem, "isSelected", get, typeOf);
  const tabs = catalogTabsOfTab(node, get, typeOf);
  if (tabs) {
    const { pairs, selectedKey } = catalogTabsSelection(tabs, get, typeOf);
    return pairs.some(
      (pair) => pair.tab.id === node.id && pair.key === selectedKey,
    );
  }
  const owner = catalogCollectionOfItem(node, get, typeOf);
  if (!owner) return undefined;
  const key = resolveStaticItemKey(
    node.props as Record<string, unknown>,
    node.id,
  );
  return typeOf(owner) === "ListBox" &&
    typeof owner.props.selectedKey === "string"
    ? owner.props.selectedKey === key
    : false;
}

/**
 * ADR-256 Phase 5f — the item a `Checkbox[slot=selection]` is the selection checkbox of: the
 * nearest ancestor providing RAC's Checkbox context, when its slots have `selection` (GridListItem
 * · TreeItem · Row — the installed RAC's `useGridListSelectionCheckbox` props). Undefined for any
 * other node, and for a Checkbox the slot does not connect.
 */
export function catalogSelectionCheckboxItem(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Checkbox" || node.props.slot !== "selection")
    return undefined;
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId)) {
    const provision = RAC_SLOT_PROVIDERS[typeOf(cursor)]?.Checkbox;
    if (!provision) continue;
    return !provision.cleared && provision.slots?.includes("selection")
      ? cursor
      : undefined;
  }
  return undefined;
}

/**
 * A selection checkbox is disabled when its item cannot be selected (RAC `canSelectItem`): the
 * item is disabled, or its collection selects nothing (`selectionMode` none — a standalone item's
 * host collection too).
 */
function catalogSelectionCheckboxDisabled(
  item: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (catalogStateValue(item, "isDisabled", get, typeOf)) return true;
  // A Column's checkbox selects every row (RAC `useTableSelectAllCheckbox` — a multiple-selection
  // Table with rows; ADR-256 Phase 5i-2).
  if (typeOf(item) === "Column") {
    const table = catalogTableOfColumn(item, get, typeOf);
    return (
      !table ||
      table.props.selectionMode !== "multiple" ||
      catalogTableRows(table, get, typeOf).length === 0
    );
  }
  const collection = catalogCollectionOfItem(item, get, typeOf);
  const mode = collection?.props.selectionMode;
  return typeof mode !== "string" || mode === "none";
}

/**
 * The selection checkboxes of an item (`catalogSelectionCheckboxItem`), through frames and a
 * TreeItem's row content (RAC's TreeItem gives its contexts through `TreeItemContent` — Phase 5h).
 */
function catalogSelectionCheckboxes(
  item: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  if (!RAC_SLOT_PROVIDERS[typeOf(item)]?.Checkbox) return [];
  return partChildrenOf(item, get, typeOf)
    .flatMap((child) =>
      // (A Row's checkbox sits in its Cell — the reference's selection column.)
      typeOf(child) === "TreeItemContent" || typeOf(child) === "Cell"
        ? partChildrenOf(child, get, typeOf)
        : [child],
    )
    .filter(
      (child) => catalogSelectionCheckboxItem(child, get, typeOf) === item,
    );
}

/** ADR-256 Phase 5i-2 — the RAC Table a Column heads (through its TableHeader). */
function catalogTableOfColumn(
  column: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const header = get(column.parentId);
  const table =
    header && typeOf(header) === "TableHeader"
      ? get(header.parentId)
      : undefined;
  return table && typeOf(table) === "Table" ? table : undefined;
}

/** A RAC Table's rows (its TableBody's). */
function catalogTableRows(
  table: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return childrenOf(table, get)
    .filter((child) => typeOf(child) === "TableBody")
    .flatMap((body) =>
      childrenOf(body, get).filter((row) => typeOf(row) === "Row"),
    );
}

/**
 * The select-all checkboxes of a RAC Table (its Columns' `Checkbox[slot=selection]`): they follow
 * the Table's selection mode and row count — `table` is the Table, its TableBody or a Row.
 */
function catalogTableSelectAllCheckboxes(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  let table: CatalogConsumerNode | undefined = node;
  while (
    table &&
    typeOf(table) !== "Table" &&
    ["TableBody", "Row"].includes(typeOf(table))
  )
    table = get(table.parentId);
  if (!table || typeOf(table) !== "Table") return [];
  return childrenOf(table, get)
    .filter((child) => typeOf(child) === "TableHeader")
    .flatMap((header) => childrenOf(header, get))
    .filter((column) => typeOf(column) === "Column")
    .flatMap((column) => catalogSelectionCheckboxes(column, get, typeOf));
}

function catalogCollectionOfItem(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const item = COLLECTION_ITEM_OWNERS[typeOf(node)];
  if (!item) return undefined;
  let cursor = get(node.parentId);
  while (cursor && item.through.includes(typeOf(cursor)))
    cursor = get(cursor.parentId);
  return cursor && typeOf(cursor) === item.owner ? cursor : undefined;
}

/** Items whose selection a collection record decides (`catalogCollectionItemSelected`). */
function catalogCollectionItems(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const type = typeOf(owner);
  if (
    !Object.values(COLLECTION_ITEM_OWNERS).some((item) => item.owner === type)
  )
    return [];
  const items: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of childrenOf(node, get)) {
      const childType = typeOf(child);
      if (COLLECTION_ITEM_OWNERS[childType]?.owner === type) items.push(child);
      if (
        Object.values(COLLECTION_ITEM_OWNERS).some(
          (item) => item.owner === type && item.through.includes(childType),
        )
      )
        visit(child);
    }
  };
  visit(owner);
  return items;
}

/** The Tabs owning a Tab through its TabList (the pairing `catalogTabsSelection` reads). */
function catalogTabsOfTab(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Tab") return undefined;
  const list = catalogPartParent(node, get, typeOf);
  if (!list || typeOf(list) !== "TabList") return undefined;
  const tabs = catalogPartParent(list, get, typeOf);
  return tabs && typeOf(tabs) === "Tabs" ? tabs : undefined;
}

/**
 * Fields whose Description · FieldError are part nodes (ADR-253 — instances of the part origins).
 * The Description shows while the field has a `description`; the FieldError while the field is
 * invalid and has an `errorMessage` (RAC `FieldError` renders on `isInvalid`; an error RAC raises
 * at run time — blur, submit — is the Preview's run state, not the document's).
 */
export const FIELD_HINT_OWNERS: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "Select",
  "ComboBox",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "CheckboxGroup",
  "RadioGroup",
  // ADR-256 Phase 3: RAC `CheckboxField` · `SwitchField` (+ Description · FieldError — the reference).
  "Checkbox",
  "Switch",
  // RAC `RadioField` (+ Description — the reference Radio has no FieldError).
  "Radio",
]);
/** Whether a field's hint part (`Description` · `FieldError`) shows; `undefined` = not one. */
export function catalogFieldHintShown(
  type: string,
  field: CatalogConsumerNode,
  fieldType: string,
): boolean | undefined {
  if (!FIELD_HINT_OWNERS.has(fieldType)) return undefined;
  if (type === "Description")
    return NODE_TREE_FIELDS.has(fieldType)
      ? undefined
      : !!String(field.props.description ?? "");
  if (type === "FieldError")
    return (
      field.props.isInvalid === true && !!String(field.props.errorMessage ?? "")
    );
  return undefined;
}

/**
 * ADR-256 Decision 7 — a node whose value condition (`presentWhen: "nonEmptyText"`) does not hold:
 * its final text (`String(value ?? "")`, every binding substituted — no trim) is empty and it
 * holds no child nodes. The Canvas and the DOM read this one predicate.
 */
export function catalogAbsentByValue(node: CatalogConsumerNode): boolean {
  return (
    node.presentWhen === "nonEmptyText" &&
    node.children.length === 0 &&
    String(node.props.children ?? "").length === 0
  );
}

/** Whether the node itself is not shown in the resting state (its subtree follows it). */
export function catalogHiddenAtRest(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  // A glyph whose icon name has no path data (an origin's unfilled `{icon}` placeholder): the DOM
  // `Icon` renders nothing for it (as the old Skia icon shape drew nothing), so no box either.
  if (
    (node.bindingId === "icon" || node.bindingId === "selecticon") &&
    node.props.iconName !== undefined &&
    !getIconData(String(node.props.iconName))
  )
    return true;
  if (catalogAbsentByValue(node)) return true;
  if (catalogProgressValueHidden(node, get, typeOf)) return true;
  // ADR-256 Decision 7: a node is there only in the states its `showWhen` names.
  if (node.showWhen && !catalogShowWhenHolds(node, get, typeOf)) return true;
  // ADR-256 Phase 5e: RAC's `SelectionIndicator` is there while its item is selected (its
  // `SelectionIndicatorContext` — the item's `isSelected`).
  if (typeOf(node) === "SelectionIndicator") {
    const item = catalogStateOwner(node, "isSelected", undefined, get, typeOf);
    return !item || !catalogStateValue(item, "isSelected", get, typeOf);
  }
  const parent = get(node.parentId);
  if (!parent) return false;
  const type = typeOf(node);
  const parentType = typeOf(parent);
  // (A closed overlay keeps its trigger owner through a layout frame — RAC's `PopoverContext`
  // reaches it there, `catalogPartParent`.)
  const partParent = catalogPartParent(node, get, typeOf);
  if (partParent && TRIGGER_OVERLAY_CHILDREN[typeOf(partParent)]?.has(type))
    return true;
  // (A hint part keeps its field through a layout frame — `catalogPartParent`.)
  const hintField = partParent;
  const hint =
    hintField && catalogFieldHintShown(type, hintField, typeOf(hintField));
  if (hint !== undefined) return !hint;
  const field = catalogSearchFieldOfClear(node, get, typeOf);
  if (field) return !field.props.value;
  if (
    catalogPickerOfButton(node, get, typeOf)?.props.showCalendarIcon === false
  )
    return true;
  if (type === "TreeItem" && parentType === "TreeItem")
    return !catalogTreeItemExpanded(parent, get, typeOf);
  // ADR-256 Phase 5h: an item without child items hides its chevron button (`Tree.css`
  // `visibility: hidden` — the box stays, the glyph is not drawn).
  const chevronItem = catalogTreeChevronGlyphItem(node, get, typeOf);
  if (chevronItem) return !treeItemHasChildItems(chevronItem, get, typeOf);
  if (parentType === "Disclosure" && !DISCLOSURE_TRIGGER_TYPES.has(type))
    return !catalogDisclosureExpanded(parent, get, typeOf);
  if (type === "TabPanel" && parentType === "TabPanels") {
    const tabs = catalogPartParent(parent, get, typeOf);
    if (!tabs || typeOf(tabs) !== "Tabs") return false;
    const { pairs, selectedKey } = catalogTabsSelection(tabs, get, typeOf);
    return !pairs.some(
      (pair) => pair.panel?.id === node.id && pair.key === selectedKey,
    );
  }
  return false;
}

/**
 * ADR-256 Phase 6b — a field's control Group (`FIELD_CONTROL_GROUP_HOSTS`, layout frames skipped):
 * the node a field's wrapped parts sit in.
 */
export function catalogIsFieldControlGroup(
  node: CatalogConsumerNode | undefined,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (!node || typeOf(node) !== "Group") return false;
  const field = catalogPartParent(node, get, typeOf);
  return isFieldControlGroup("Group", field ? typeOf(field) : undefined);
}

/**
 * A picker's calendar button (the FieldButton instance in its Group — ADR-253): the shared pickers
 * draw it unless `showCalendarIcon` is false. Returns the owning picker for that node.
 */
export function catalogPickerOfButton(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Button") return;
  const trigger = catalogPartParent(node, get, typeOf);
  if (!catalogIsFieldControlGroup(trigger, get, typeOf)) return;
  const field = catalogPartParent(trigger!, get, typeOf);
  return field && ["DatePicker", "DateRangePicker"].includes(typeOf(field))
    ? field
    : undefined;
}

/** The SearchField that owns `node` as the Input in its control wrapper. */
function catalogSearchFieldOfInput(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Input") return;
  const trigger = catalogPartParent(node, get, typeOf);
  if (!catalogIsFieldControlGroup(trigger, get, typeOf)) return;
  const field = catalogPartParent(trigger!, get, typeOf);
  return field && typeOf(field) === "SearchField" ? field : undefined;
}

/**
 * SearchField's clear button (the Button instance in its control wrapper — ADR-253): RAC marks
 * the field `data-empty` while its value (`value`, the renderer's `defaultValue`) is empty and
 * the stylesheet hides the button (`[data-empty="true"] .react-aria-Button { display: none }`).
 * Returns the owning field for that node.
 */
function catalogSearchFieldOfClear(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Button") return;
  const trigger = catalogPartParent(node, get, typeOf);
  if (!catalogIsFieldControlGroup(trigger, get, typeOf)) return;
  const field = catalogPartParent(trigger!, get, typeOf);
  return field && typeOf(field) === "SearchField" ? field : undefined;
}

/**
 * ADR-239 expansion: the owning Tree's `expandedKeys` (absent = all collapsed, RAC controlled);
 * a TreeItem outside a Tree follows its own `isExpanded` (absent = expanded).
 */
export function catalogTreeItemExpanded(
  item: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  let cursor = get(item.parentId);
  while (cursor && typeOf(cursor) === "TreeItem") cursor = get(cursor.parentId);
  if (!cursor || typeOf(cursor) !== "Tree")
    return item.props.isExpanded !== false;
  const keys = cursor.props.expandedKeys;
  if (!Array.isArray(keys)) return false;
  const key = resolveStaticItemKey(
    item.props as Record<string, unknown>,
    item.id,
  );
  return keys.some((entry) => String(entry) === key);
}

/**
 * The record whose values decide the presence of nodes below it (Tabs selection, Tree
 * expansion), if `node` is part of such a scope; a value change inside it re-derives
 * `catalogPresenceDependents`.
 */
export function catalogPresenceScope(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) === "DisclosureGroup") return node;
  // A ProgressBar's · Meter's value text follows its `showValueLabel` (ADR-256 Phase 7a).
  if (PROGRESS_VALUES[typeOf(node)]) return node;
  // Which crumb is current (its separator hidden) follows the Breadcrumbs' crumb list.
  if (typeOf(node) === "Breadcrumbs") return node;
  if (typeOf(node) === "Breadcrumb") {
    const owner = get(node.parentId);
    if (owner && typeOf(owner) === "Breadcrumbs") return owner;
  }
  if (typeOf(node) === "Disclosure") {
    const parent = get(node.parentId);
    return parent && typeOf(parent) === "DisclosureGroup" ? parent : node;
  }
  let cursor: CatalogConsumerNode | undefined = node;
  for (let depth = 0; cursor && depth < 3; depth++) {
    const type = typeOf(cursor);
    if (type === "Tabs" || type === "SearchField") return cursor;
    // A field's hint parts follow its `description` · `isInvalid` · `errorMessage`.
    if (depth === 0 && FIELD_HINT_OWNERS.has(type)) return cursor;
    if (!TABS_SELECTION_TYPES.has(type)) break;
    // (A frame around the TabList inside Tabs passes — ADR-256 Phase 5e-2.)
    cursor = catalogPartParent(cursor, get, typeOf);
  }
  cursor = node;
  while (cursor && typeOf(cursor) === "TreeItem") cursor = get(cursor.parentId);
  return cursor && typeOf(cursor) === "Tree" ? cursor : undefined;
}

/** Nodes of a presence scope whose `catalogHiddenAtRest` can change with the scope's values. */
export function catalogPresenceDependents(
  scope: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const valueType = PROGRESS_VALUES[typeOf(scope)];
  if (valueType)
    return partChildrenOf(scope, get, typeOf).filter(
      (child) => typeOf(child) === valueType,
    );
  if (typeOf(scope) === "Tabs") {
    const { panels, tabs } = catalogTabsSelection(scope, get, typeOf);
    // (and the Tabs' selection indicators — ADR-256 Phase 5e)
    return [
      ...panels,
      ...tabs.flatMap((tab) => catalogSelectionIndicators(tab, get, typeOf)),
    ];
  }
  // Which crumb is current moves with the crumb list: the conditioned nodes in every crumb
  // (`showWhen` — the reference's separator `!isCurrent`) are judged again.
  if (typeOf(scope) === "Breadcrumbs")
    return catalogBreadcrumbItems(scope, get, typeOf).flatMap((crumb) =>
      catalogStateDependents(crumb, get, typeOf),
    );
  if (typeOf(scope) === "Disclosure" || typeOf(scope) === "DisclosureGroup")
    return (
      typeOf(scope) === "Disclosure"
        ? [scope]
        : childrenOf(scope, get).filter(
            (child) => typeOf(child) === "Disclosure",
          )
    ).flatMap((disclosure) =>
      childrenOf(disclosure, get).filter(
        (child) => !DISCLOSURE_TRIGGER_TYPES.has(typeOf(child)),
      ),
    );
  if (FIELD_HINT_OWNERS.has(typeOf(scope)))
    return [
      ...partChildrenOf(scope, get, typeOf).filter((child) =>
        ["Description", "FieldError"].includes(typeOf(child)),
      ),
      ...(typeOf(scope) === "SearchField"
        ? partChildrenOf(scope, get, typeOf)
            .flatMap((trigger) => partChildrenOf(trigger, get, typeOf))
            .filter((icon) => catalogSearchFieldOfClear(icon, get, typeOf))
        : []),
      // (A picker's calendar button follows its `showCalendarIcon`.)
      ...partChildrenOf(scope, get, typeOf)
        .flatMap((trigger) => partChildrenOf(trigger, get, typeOf))
        .filter((button) => catalogPickerOfButton(button, get, typeOf)),
    ];
  const items: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of childrenOf(node, get))
      if (typeOf(child) === "TreeItem") {
        // (and its chevron glyph — shown while the item has child items, ADR-256 Phase 5h)
        items.push(
          child,
          ...catalogTreeChevrons(child, get, typeOf).filter((glyph) =>
            catalogTreeChevronGlyphItem(glyph, get, typeOf),
          ),
        );
        visit(child);
      }
  };
  visit(scope);
  return items;
}

/** A Slider's value and range as RAC reads them (`value` · `defaultValue`, else the middle). */
export function catalogSliderRange(slider: CatalogConsumerNode): {
  min: number;
  max: number;
  value: number;
} {
  const number = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const min = number(slider.props.minValue, 0);
  const max = number(slider.props.maxValue, 100);
  const value = number(
    slider.props.value ?? slider.props.defaultValue,
    (min + max) / 2,
  );
  return { min, max, value };
}

/**
 * ADR-256 Phase 7c — RAC SliderFill placement (D1 behavior, `Slider.mjs` `SliderFill`): absolutely
 * placed in its track from the range's start (`offset` — the minimum) to the thumb's value
 * (`insetInlineStart: start%`, `width: (end − start)%`, `height: 100%`). Undefined for any other node.
 */
export function catalogSliderFillLayout(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string> | undefined {
  if ((node.ruleId ?? typeOf(node)) !== "SliderFill") return undefined;
  const track = get(node.parentId);
  const slider = track ? get(track.parentId) : undefined;
  if (!track || !slider || typeOf(track) !== "SliderTrack") return undefined;
  if (typeOf(slider) !== "Slider") return undefined;
  const { min, max, value } = catalogSliderRange(slider);
  const ratio =
    max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  return {
    position: "absolute",
    insetLeft: "0%",
    insetTop: "0px",
    width: `${ratio * 100}%`,
    height: "100%",
  };
}

/**
 * RAC SliderThumb placement (D1 behavior): absolutely placed on the track at the value's ratio
 * (`left: pct%`, centered with `translateX(-50%)`), vertically centered on the track (`top: 50%`,
 * `translateY(-50%)`). Undefined for any other node.
 */
export function catalogSliderThumbLayout(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, unknown> | undefined {
  if (typeOf(node) !== "SliderThumb") return undefined;
  const track = get(node.parentId);
  const slider = track ? get(track.parentId) : undefined;
  if (!track || !slider || typeOf(track) !== "SliderTrack") return undefined;
  const number = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const { min, max, value } = catalogSliderRange(slider);
  const ratio =
    max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const size = number(node.visual.height ?? node.visual.width, 18);
  const trackHeight = number(track.visual.height, size);
  return {
    position: "absolute",
    insetLeft: `${ratio * 100}%`,
    insetTop: `${(trackHeight - size) / 2}px`,
    marginLeft: `${-size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
  };
}

/**
 * A box the owner's DOM renderer composes with no catalog node of its own (the chevron button of a
 * Tree item that has no row content — a bare TreeItem the shared Tree draws): a
 * layout leaf before the record's children. It paints nothing itself — the owner's D3 rule draws
 * what the box holds (TreeItem `visual.leadingIcon` over `catalogDerivedProps`).
 */
export interface CatalogComposedPart {
  readonly id: string;
  /** Rust `NodeStyle` of the part's border box. */
  readonly style: Readonly<Record<string, string | number>>;
  /**
   * Record children laid out inside this part (a group's items wrapper), in place of the first of
   * them; absent = a leaf before the record's children.
   */
  readonly wraps?: readonly string[];
}

/** `Tree.css` chevron button: `width: 20px` (content box) + `padding-left: (level − 1) × --padding`. */
const TREE_CHEVRON_WIDTH = 20;
const TREE_LEVEL_PADDING = 4;
/** The chevron svg (`size={16}`): the button's content height. */
const TREE_CHEVRON_ICON = 16;

/**
 * A TreeItem's level (1 = child of the Tree). A TreeItem outside a Tree is a level-1 row of its
 * Preview host (`RAC.Tree` with `data-composition-tree` — the same `Tree.css` row).
 */
function catalogTreeLevel(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): number | undefined {
  if (typeOf(node) !== "TreeItem") return undefined;
  let level = 1;
  let cursor = get(node.parentId);
  while (cursor && typeOf(cursor) === "TreeItem") {
    level++;
    cursor = get(cursor.parentId);
  }
  return level;
}

/**
 * A TreeItem row's chevron `Button` (`Tree.tsx` `TreeItemContent`, `Tree.css`): a 20px flex item
 * (`flex-shrink: 0`) indented by the item's level, before the item's content. Its `height: 100%`
 * fills the row's content box when the row's height is definite (a Tree of set height), else it is
 * its svg's height (the minimum).
 */
const treeChevronIndent = (level: number) => (level - 1) * TREE_LEVEL_PADDING;
function treeChevronStyle(level: number): Record<string, string | number> {
  const padding = treeChevronIndent(level);
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: `${TREE_CHEVRON_WIDTH + padding}px`,
    height: "100%",
    minHeight: `${TREE_CHEVRON_ICON}px`,
    paddingLeft: `${padding}px`,
    flexShrink: 0,
  };
}

/** ADR-256 Phase 5h — a TreeItem's row content (its RAC `TreeItemContent` child). */
export function catalogTreeItemContent(
  item: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(item) !== "TreeItem") return undefined;
  for (const id of item.children) {
    const child = get(id);
    if (child && typeOf(child) === "TreeItemContent") return child;
  }
  return undefined;
}

/**
 * ADR-256 Phase 5h — the TreeItem whose chevron button `node` is: a `Button[slot=chevron]` in the
 * item's `TreeItemContent` (RAC `ButtonContext` gives the slot the item's expand button props).
 */
export function catalogTreeChevronButtonItem(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Button" || node.props.slot !== "chevron")
    return undefined;
  // (Through the author's layout frames — RAC context passes any element, Round 12.)
  const content = catalogPartParent(node, get, typeOf);
  if (!content || typeOf(content) !== "TreeItemContent") return undefined;
  const item = get(content.parentId);
  return item && typeOf(item) === "TreeItem" ? item : undefined;
}

/**
 * ADR-256 Phase 5h — the TreeItem whose chevron glyph `node` is (an Icon in its chevron button):
 * `Tree.css` hides the button of an item without child items (`visibility: hidden` — the glyph is
 * not drawn, its box stays) and turns the svg 90° on an expanded item.
 */
export function catalogTreeChevronGlyphItem(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Icon") return undefined;
  const button = catalogPartParent(node, get, typeOf);
  return button ? catalogTreeChevronButtonItem(button, get, typeOf) : undefined;
}

/** Whether a TreeItem has child items (RAC `hasChildItems` — `data-has-child-items`). */
function treeItemHasChildItems(
  item: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  return childrenOf(item, get).some((child) => typeOf(child) === "TreeItem");
}

/**
 * A TreeItem's chevron button records — the `Button[slot=chevron]` in its `TreeItemContent`
 * (ADR-256 Phase 5h) — and their glyphs: the re-plan dependents of the item (level indent, child
 * items, expansion).
 */
export function catalogTreeChevrons(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  if (typeOf(node) !== "TreeItem") return [];
  const content = catalogTreeItemContent(node, get, typeOf);
  if (!content) return [];
  return partChildrenOf(content, get, typeOf)
    .filter((child) => catalogTreeChevronButtonItem(child, get, typeOf))
    .flatMap((button) => [
      button,
      ...partChildrenOf(button, get, typeOf).filter((glyph) =>
        catalogTreeChevronGlyphItem(glyph, get, typeOf),
      ),
    ]);
}

/** A chevron button record's TreeItem level; undefined for any other node. */
function treeChevronLevel(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): number | undefined {
  const item = catalogTreeChevronButtonItem(node, get, typeOf);
  return item ? catalogTreeLevel(item, get, typeOf) : undefined;
}

/**
 * A TreeItem chevron button's layout (`Button[slot=chevron]` in its row content): the `Tree.css`
 * button at the item's level.
 * Undefined for any other node.
 */
export function catalogTreeChevronLayout(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string | number> | undefined {
  const level = treeChevronLevel(node, get, typeOf);
  return level === undefined ? undefined : treeChevronStyle(level);
}

/**
 * Parts a record's DOM owner composes before its children: a TreeItem row's chevron button when
 * the item has no `TreeItemContent` (ADR-256 Phase 5h — the content holds its own chevron button,
 * or none) to hold it.
 */
export function catalogComposedParts(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): readonly CatalogComposedPart[] {
  if (catalogTreeItemContent(node, get, typeOf)) return [];
  const level = catalogTreeLevel(node, get, typeOf);
  if (level === undefined) return [];
  return [{ id: `${node.id}::part:chevron`, style: treeChevronStyle(level) }];
}

/** RAC Calendar owners (their header child's heading is the owner's visible-range title). */
const CALENDAR_TYPES = new Set(["Calendar", "RangeCalendar"]);

/** RAC ProgressBar/Meter and the track sub-part whose fill they own. */
const PROGRESS_TRACKS: Readonly<Record<string, string>> = {
  ProgressBar: "ProgressBarTrack",
  Meter: "MeterTrack",
};

/** ADR-256 Phase 7a — a progress owner's fill node (in its track — the reference `div.track > div.fill`). */
const PROGRESS_FILLS: Readonly<Record<string, string>> = {
  ProgressBar: "ProgressBarFill",
  Meter: "MeterFill",
};
const PROGRESS_FILL_TYPES: ReadonlySet<string> = new Set(
  Object.values(PROGRESS_FILLS),
);

/** The ProgressBar a fill node fills (its nearest progress ancestor, past the track and any frame). */
export function catalogProgressFillOwner(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  // (A rule-backed record names its type — no type lookup for every record.)
  const type = node.ruleId ?? typeOf(node);
  if (!PROGRESS_FILL_TYPES.has(type)) return undefined;
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId))
    if (PROGRESS_TRACKS[typeOf(cursor)])
      return PROGRESS_FILLS[typeOf(cursor)] === type ? cursor : undefined;
  return undefined;
}

/** A progress owner's value text part (RSP `showValueLabel` — false hides it). */
const PROGRESS_VALUES: Readonly<Record<string, string>> = {
  ProgressBar: "ProgressBarValue",
  Meter: "MeterValue",
  // (ADR-256 Phase 7c: a Slider's value text — RSP `showValueLabel`.)
  Slider: "SliderOutput",
};
const PROGRESS_VALUE_TYPES: ReadonlySet<string> = new Set(
  Object.values(PROGRESS_VALUES),
);

/**
 * ADR-256 Phase 7a — a ProgressBar's · Meter's value text while its owner's `showValueLabel` is
 * false (RSP): not there. The Canvas and the DOM read this one predicate.
 */
export function catalogProgressValueHidden(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  const type = node.ruleId ?? typeOf(node);
  if (!PROGRESS_VALUE_TYPES.has(type)) return false;
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId))
    if (PROGRESS_VALUES[typeOf(cursor)])
      return (
        PROGRESS_VALUES[typeOf(cursor)] === type &&
        cursor.props.showValueLabel === false
      );
  return false;
}

/**
 * ADR-256 Phase 7a — an indeterminate ProgressBar's fill on the Canvas: the still bar the track
 * primitive drew (20 % → 50 % of the track — the DOM animates the sheet's 120px `.fill`, the Canvas
 * draws no motion). Its width binding has no value then (`{percentage}` — RAC gives none).
 */
export function catalogProgressFillLayout(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string> | undefined {
  const owner = catalogProgressFillOwner(node, get, typeOf);
  return owner?.props.isIndeterminate === true
    ? { width: "30%", marginLeft: "20%" }
    : undefined;
}

/** RAC date fields that compose their DateInput's segments from their own props. */
const DATE_INPUT_OWNERS = new Set([
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
]);

/** The field owning a trigger sub-part, past the field's control Group. */
function triggerOwner(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  let owner = catalogPartParent(node, get, typeOf);
  while (owner && catalogIsFieldControlGroup(owner, get, typeOf))
    owner = catalogPartParent(owner, get, typeOf);
  return owner;
}

/**
 * The owner's DOM renders a field sub-part from the owner's props, not the typed child's: a date
 * field's DateInput segments (`_parentTag` — a picker's trigger draws the box, a range shows the
 * start/end pair — granularity, hour cycle and locale, the locale as the layout measures it), and
 * a trigger icon the owner names (`DatePicker.tsx` `<Icon iconName={iconName}>`).
 */
function fieldSubpartProps(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  locale?: string,
): Record<string, string | number | boolean> | undefined {
  const type = typeOf(node);
  if (type !== "DateInput" && type !== "SelectIcon") return undefined;
  const wrapper = catalogPartParent(node, get, typeOf);
  const owner = triggerOwner(node, get, typeOf);
  if (!wrapper || !owner) return undefined;
  if (type === "SelectIcon")
    return catalogIsFieldControlGroup(wrapper, get, typeOf) &&
      typeof owner.props.iconName === "string"
      ? { iconName: owner.props.iconName }
      : undefined;
  const ownerType = typeOf(owner);
  if (!DATE_INPUT_OWNERS.has(ownerType)) return undefined;
  const prop = (key: string) => node.props[key] ?? owner.props[key];
  const out: Record<string, string | number | boolean> = {
    _parentTag: ownerType,
  };
  const granularity = prop("granularity");
  if (typeof granularity === "string") out._granularity = granularity;
  const hourCycle = racFieldHourCycle(ownerType, prop("hourCycle"));
  if (hourCycle !== undefined) out._hourCycle = hourCycle;
  const ownLocale = prop("locale");
  const resolvedLocale =
    typeof ownLocale === "string" && ownLocale ? ownLocale : locale;
  const system = prop("calendarSystem");
  if (resolvedLocale)
    out._locale =
      typeof system === "string" && system
        ? `${resolvedLocale}-u-ca-${system}`
        : resolvedLocale;
  return out;
}

/**
 * Owner-derived values of a RAC progress track (D1 behavior): RAC ProgressBar/Meter computes the
 * fill percentage from its own `value`/`minValue`/`maxValue` (`.fill` `width: pct%`) and the
 * track follows the owner's `isIndeterminate`/`variant`/`size`. Undefined for any other node.
 */
export function catalogDerivedProps(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  locale?: string,
): Readonly<Record<string, string | number | boolean>> | undefined {
  const control = ownDerivedProps(node, get, typeOf, locale);
  // The box of a quiet field shows its own quiet state (`fieldBoxOfQuietField`); a box the field's
  // own rule styles names that field (`_quietOwner` — `catalogQuietStyles`).
  const quietField = fieldBoxOfQuietField(node, get, typeOf);
  const quietOwner = quietField
    ? undefined
    : ownerStyledQuietBox(node, get, typeOf);
  const quiet = quietField ?? quietOwner;
  const own = quiet
    ? {
        ...control,
        isQuiet: true,
        ...(quietOwner ? { _quietOwner: typeOf(quietOwner) } : {}),
        _fieldDisabled: quiet.props.isDisabled === true,
        _fieldInvalid: quiet.props.isInvalid === true,
      }
    : control;
  const selected = catalogCollectionItemSelected(node, get, typeOf);
  const withSelection =
    selected === undefined ? own : { ...own, _isSelected: selected };
  // (A selection checkbox is disabled while its item cannot be selected — RAC's context value.)
  const checkboxItem = catalogSelectionCheckboxItem(node, get, typeOf);
  return checkboxItem &&
    catalogSelectionCheckboxDisabled(checkboxItem, get, typeOf)
    ? { ...withSelection, isDisabled: true }
    : withSelection;
}

/**
 * A field's box part — its Input / DateInput instance, direct or inside a control wrapper that
 * paints nothing (`variant: "plain"`; a range picker's Group is the box itself) — whose field is
 * quiet (RSP `isQuiet`, ADR-253): the part's rule draws the quiet shape (`&[data-quiet]`), one
 * definition for every field. Returns the owning field for that node.
 */
function fieldBoxOfQuietField(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const type = typeOf(node);
  if (type !== "Input" && type !== "DateInput") return;
  if (!catalogPartParent(node, get, typeOf)) return;
  // (A field's control Group only places its box — a DateRangePicker's Group, the one that paints,
  // takes no `isQuiet`.)
  const owner = triggerOwner(node, get, typeOf);
  return owner?.props.isQuiet === true ? owner : undefined;
}

/**
 * A quiet field's box that the field's own rule styles (`quiet.true.nested` — the DOM sheet's
 * `.react-aria-<Field>[data-quiet="true"] <box>`): a Select's trigger (a Button instance — RAC's
 * trigger is the Button itself). Returns the owning field. (A DateRangePicker takes no `isQuiet`
 * — S2 has none, 2026-10-07.)
 */
const QUIET_OWNER_BOXES: Readonly<Record<string, string>> = {
  Select: "Button",
};
function ownerStyledQuietBox(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const owner = get(node.parentId);
  if (!owner || QUIET_OWNER_BOXES[typeOf(owner)] !== typeOf(node)) return;
  return owner.props.isQuiet === true ? owner : undefined;
}

function ownDerivedProps(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  locale?: string,
): Readonly<Record<string, string | number | boolean>> | undefined {
  const subpart = fieldSubpartProps(node, get, typeOf, locale);
  if (subpart) return subpart;
  // A SearchField's `value` is its input's initial value (the renderer's `defaultValue`): the
  // Canvas draws it in the Input's text, where the DOM input shows it over the placeholder.
  const searchValue = catalogSearchFieldOfInput(node, get, typeOf)?.props.value;
  if (typeof searchValue === "string" && searchValue !== "")
    return { placeholder: searchValue };
  // ADR-256 Phase 5h: an expanded item's chevron glyph turns (`Tree.css` `[data-expanded]
  // .react-aria-Button[slot=chevron] svg { rotate: 90deg }`) — the Canvas draws the turned glyph
  // (`chevron-right` 90° = `chevron-down`), as the item rule's `leading_icon` does.
  const chevronItem = catalogTreeChevronGlyphItem(node, get, typeOf);
  if (chevronItem)
    return node.props.iconName === "chevron-right" &&
      catalogTreeItemExpanded(chevronItem, get, typeOf)
      ? { iconName: "chevron-down" }
      : undefined;
  const level = catalogTreeLevel(node, get, typeOf);
  // RAC TreeItem: `data-has-child-items` shows the chevron, `data-expanded` turns it (the rule's
  // `leadingIcon`), the level indents it.
  // RAC Disclosure: `data-expanded` turns the trigger's chevron (the header rule's `leadingIcon`,
  // painted in the header's DisclosureChevron node or, without one, by the header itself).
  const disclosure = get(node.parentId);
  if (
    typeOf(node) === "DisclosureHeader" &&
    disclosure &&
    typeOf(disclosure) === "Disclosure"
  )
    return { isExpanded: catalogDisclosureExpanded(disclosure, get, typeOf) };
  // RAC Breadcrumbs draws its last crumb as the current one (no separator, current paint); the
  // crumb's label Text inherits the current Link's weight.
  if (typeOf(node) === "Breadcrumb")
    return { _isLast: !catalogBreadcrumbSeparator(node, get, typeOf) };
  // RAC Tabs: a vertical TabList's Tab draws its indicator on the trailing edge.
  if (catalogTabsOfTab(node, get, typeOf)?.props.orientation === "vertical")
    return { orientation: "vertical" };
  // (its SelectionIndicator node — ADR-256 Phase 5e: `catalogSelectionIndicatorLayout`)
  if (typeOf(node) === "SelectionIndicator") {
    const tab = catalogPartParent(node, get, typeOf);
    if (
      tab &&
      catalogTabsOfTab(tab, get, typeOf)?.props.orientation === "vertical"
    )
      return { orientation: "vertical" };
  }
  const crumb = get(node.parentId);
  if (
    crumb &&
    typeOf(crumb) === "Breadcrumb" &&
    catalogBreadcrumbLabels(crumb, get, typeOf).includes(node)
  )
    return {
      _isLast: !catalogBreadcrumbSeparator(crumb, get, typeOf),
      // A crumb's Link rests without the Link rule's underline (`Breadcrumbs.css`
      // `.react-aria-Link { text-decoration: none }`; hover is the Preview's).
      ...(typeOf(node) === "Link" ? { _noUnderline: true } : {}),
    };
  // RAC Calendar's header heading is its visible-range title from the Calendar's own props (the
  // header child's authored `children` is not read by the DOM).
  const calendar = get(node.parentId);
  if (
    typeOf(node) === "CalendarHeader" &&
    calendar &&
    CALENDAR_TYPES.has(typeOf(calendar))
  )
    return { children: catalogCalendarTitle(calendar.props, locale) };
  // RAC Calendar's grid formats its weekdays and days in the Calendar's locale and calendar system
  // (`I18nProvider` around the RAC Calendar): the Calendar's own, else the environment's.
  if (
    typeOf(node) === "CalendarGrid" &&
    calendar &&
    CALENDAR_TYPES.has(typeOf(calendar))
  ) {
    const own = calendar.props.locale;
    const system = calendar.props.calendarSystem;
    return {
      locale:
        typeof own === "string" && own
          ? own
          : (locale ?? globalThis.navigator?.language ?? "en-US"),
      calendarSystem: typeof system === "string" ? system : "",
    };
  }
  if (level !== undefined)
    return {
      _treeLevel: level,
      _hasTreeChildren: childrenOf(node, get).some(
        (child) => typeOf(child) === "TreeItem",
      ),
      isExpanded: catalogTreeItemExpanded(node, get, typeOf),
    };
  // ADR-256 Phase 7a: a fill takes its ProgressBar's variant and size (its paint · its box).
  const fillOwner = catalogProgressFillOwner(node, get, typeOf);
  if (fillOwner) {
    const out: Record<string, string> = {};
    for (const key of ["variant", "size"])
      if (typeof fillOwner.props[key] === "string")
        out[key] = fillOwner.props[key] as string;
    return Object.keys(out).length ? out : undefined;
  }
  const owner = get(node.parentId);
  if (!owner || PROGRESS_TRACKS[typeOf(owner)] !== typeOf(node))
    return undefined;
  const number = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const min = number(owner.props.minValue, 0);
  const max = number(owner.props.maxValue, 100);
  const value = number(owner.props.value, 0);
  const out: Record<string, string | number | boolean> = {
    value:
      max > min
        ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
        : 0,
    isIndeterminate: owner.props.isIndeterminate === true,
  };
  for (const key of ["variant", "size"])
    if (typeof owner.props[key] === "string")
      out[key] = owner.props[key] as string;
  return out;
}

/**
 * Records whose derived values read `owner`: a ProgressBar/Meter's track; a Tree's items (its
 * `expandedKeys`); a TreeItem's parent item (its child items); a Tabs' Tabs (its selected key) and
 * a Tab's sibling Tabs (its `isDisabled` moves the default selection); a ListBox/TagGroup/GridList/
 * Tree's items (its selection; a Tree's `expandedKeys` too).
 */
export function catalogDerivedPropsDependents(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  // An item's label Text takes the item's color (`catalogItemLabels`): it follows the item's own
  // values and every item whose selection this record decides.
  const items = [
    ...derivedDependents(owner, get, typeOf),
    ...fieldSubparts(owner, get, typeOf),
    // (A Table's select-all checkboxes follow its selection mode and its rows — Phase 5i-2.)
    ...catalogTableSelectAllCheckboxes(owner, get, typeOf),
    // The box a quiet field's own rule styles (`ownerStyledQuietBox`).
    ...childrenOf(owner, get).filter(
      (child) => QUIET_OWNER_BOXES[typeOf(owner)] === typeOf(child),
    ),
  ];
  return [
    ...items,
    ...[owner, ...items].flatMap((item) => [
      ...catalogItemLabels(item, get, typeOf),
      // (its selection indicators — their bar follows the Tab's orientation, ADR-256 Phase 5e)
      ...catalogSelectionIndicators(item, get, typeOf),
      // (its selection checkboxes — the item's selection and selectability, Phase 5f)
      ...catalogSelectionCheckboxes(item, get, typeOf),
      // (its chevron glyph — the item's expansion turns it, Phase 5h)
      ...catalogTreeChevrons(item, get, typeOf).filter((glyph) =>
        catalogTreeChevronGlyphItem(glyph, get, typeOf),
      ),
      // (and its remove button's glyph — `catalogItemRemoveGlyphItem`)
      ...(MANUAL_ITEM_LABEL_COLORS[typeOf(item)]
        ? childrenOf(item, get)
            .flatMap((button) => childrenOf(button, get))
            .filter(
              (glyph) =>
                catalogItemRemoveGlyphItem(glyph, get, typeOf) === item,
            )
        : []),
    ]),
  ];
}

/**
 * A field's box and trigger parts whose derived values read the field (`fieldSubpartProps` · an
 * Input's quiet state and a SearchField's value), direct or inside its control Group.
 */
function fieldSubparts(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return partChildrenOf(owner, get, typeOf)
    .flatMap((child) =>
      typeOf(child) === "Group"
        ? partChildrenOf(child, get, typeOf)
        : [child],
    )
    .filter(
      (child) =>
        fieldSubpartProps(child, get, typeOf) !== undefined ||
        typeOf(child) === "Input",
    );
}

function derivedDependents(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const type = typeOf(owner);
  const track = PROGRESS_TRACKS[type];
  if (track) {
    const tracks = childrenOf(owner, get).filter(
      (child) => typeOf(child) === track,
    );
    // (and the fill in each track — ADR-256 Phase 7a)
    const fill = PROGRESS_FILLS[type];
    return fill
      ? [
          ...tracks,
          ...tracks.flatMap((part) =>
            childrenOf(part, get).filter((child) => typeOf(child) === fill),
          ),
        ]
      : tracks;
  }
  if (type === "Tabs") return catalogTabsSelection(owner, get, typeOf).tabs;
  const items = catalogCollectionItems(owner, get, typeOf);
  if (items.length) return items;
  // A Tab's `isDisabled` can move the default selection (the first enabled Tab) to a sibling.
  const ownerTabs = catalogTabsOfTab(owner, get, typeOf);
  if (ownerTabs)
    return catalogTabsSelection(ownerTabs, get, typeOf).tabs.filter(
      (tab) => tab.id !== owner.id,
    );
  if (type === "Breadcrumbs")
    return catalogBreadcrumbItems(owner, get, typeOf).flatMap((crumb) => [
      crumb,
      ...catalogBreadcrumbLabels(crumb, get, typeOf),
    ]);
  if (CALENDAR_TYPES.has(type))
    return childrenOf(owner, get).filter((child) =>
      ["CalendarHeader", "CalendarGrid"].includes(typeOf(child)),
    );
  // A Disclosure's header turns its chevron with the expansion — inside a DisclosureGroup every
  // sibling's (the group's expanded keys).
  if (type === "Disclosure" || type === "DisclosureGroup") {
    const parent = get(owner.parentId);
    const group =
      type === "DisclosureGroup"
        ? owner
        : parent && typeOf(parent) === "DisclosureGroup"
          ? parent
          : undefined;
    const disclosures = group
      ? childrenOf(group, get).filter((child) => typeOf(child) === "Disclosure")
      : [owner];
    return disclosures.flatMap((disclosure) =>
      childrenOf(disclosure, get).filter(
        (child) => typeOf(child) === "DisclosureHeader",
      ),
    );
  }
  const parent = get(owner.parentId);
  return type === "TreeItem" && parent && typeOf(parent) === "TreeItem"
    ? [parent]
    : [];
}

/**
 * A Tab/Tag's label Text children: `.react-aria-Tab/Tag .react-aria-Text { color: inherit }`
 * (`MANUAL_ITEM_LABEL_COLORS`) — they take the item's variant/state/selection color.
 */
export function catalogItemLabels(
  item: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return MANUAL_ITEM_LABEL_COLORS[typeOf(item)]
    ? childrenOf(item, get).filter((child) => typeOf(child) === "Text")
    : [];
}

/** ADR-256 Phase 5e — an item's SelectionIndicator nodes (through frames). */
export function catalogSelectionIndicators(
  item: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  if (!catalogStateKeysOf(typeOf(item)).includes("isSelected")) return [];
  return partChildrenOf(item, get, typeOf).filter(
    (child) => typeOf(child) === "SelectionIndicator",
  );
}

/**
 * ADR-256 Phase 5e — a vertical TabList's indicator bar (`TabsIndicator.css` vertical: 3px wide,
 * the Tab's height) over the Tab part rule's horizontal bar; both anchor the Tab's bottom-right.
 */
export function catalogSelectionIndicatorLayout(
  node: CatalogConsumerNode,
): Record<string, string> | undefined {
  return node.bindingId === "selectionindicator" &&
    node.derivedProps?.orientation === "vertical"
    ? { width: "3px", height: "100%" }
    : undefined;
}

/**
 * ADR-256 Phase 5d — the item whose color a remove button's glyph takes (`TagGroup.css`
 * `.react-aria-Tag [slot=remove] { color: inherit }`): the glyph's button is the item's
 * `Button[slot=remove]`, and the item colors its labels (`catalogItemLabels`).
 */
export function catalogItemRemoveGlyphItem(
  glyph: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(glyph) !== "Icon") return undefined;
  const button = get(glyph.parentId);
  if (!button || typeOf(button) !== "Button" || button.props.slot !== "remove")
    return undefined;
  const item = get(button.parentId);
  return item && MANUAL_ITEM_LABEL_COLORS[typeOf(item)] ? item : undefined;
}

/** Thumbs whose placement a Slider record's values decide. */
export function catalogSliderThumbs(
  slider: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  if (typeOf(slider) !== "Slider") return [];
  // (and its fill — ADR-256 Phase 7c: RAC's SliderFill follows the same values)
  return childrenOf(slider, get)
    .filter((child) => typeOf(child) === "SliderTrack")
    .flatMap((track) =>
      childrenOf(track, get).filter((child) =>
        ["SliderThumb", "SliderFill"].includes(typeOf(child)),
      ),
    );
}

/**
 * Fields whose DOM Label is their Label node (ADR-253): the node's binding draws it inside the
 * field's RAC context, with what the field appends to its Label. `necessity` = the field shows the
 * necessity indicator of its `isRequired` (RSP `necessityIndicator`: its own value, else the
 * nearest Form's, else the icon — every field alike, ADR-253 follow-up 2026-10-07) · `none` = it
 * appends nothing. Keyed by binding id; the Canvas label suffix and the DOM read this one map.
 */
export const CATALOG_LABEL_NODE_FIELDS: Readonly<
  Record<string, "necessity" | "none">
> = {
  textfield: "necessity",
  textarea: "necessity",
  numberfield: "necessity",
  searchfield: "necessity",
  colorfield: "necessity",
  datefield: "necessity",
  timefield: "necessity",
  datepicker: "necessity",
  daterangepicker: "necessity",
  checkboxgroup: "necessity",
  radiogroup: "necessity",
  select: "necessity",
  combobox: "necessity",
  meter: "none",
  progressbar: "none",
  slider: "none",
  taggroup: "none",
};

/**
 * The necessity indicator a field shows (RSP): its own `necessityIndicator`, else the nearest
 * Form's; undefined = the icon. `parentOf` walks the records of one consumer.
 */
export function catalogFieldNecessityIndicator(
  field: CatalogConsumerNode,
  parentOf: (node: CatalogConsumerNode) => CatalogConsumerNode | undefined,
  typeOf: CatalogTypeOf,
): string | undefined {
  const own = field.props.necessityIndicator;
  if (typeof own === "string") return own;
  for (let cursor = parentOf(field); cursor; cursor = parentOf(cursor))
    if (typeOf(cursor) === "Form") {
      const form = cursor.props.necessityIndicator;
      return typeof form === "string" ? form : undefined;
    }
  return undefined;
}

/**
 * Text the DOM appends to a field's Label (`catalogFieldLabelNecessity`): the field's necessity
 * indicator for its `isRequired` (`getNecessityIndicatorSuffix`). Empty for any other node.
 */
export function catalogLabelSuffix(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string {
  if (typeOf(node) !== "Label") return "";
  const field = catalogPartParent(node, get, typeOf);
  if (
    !field ||
    CATALOG_LABEL_NODE_FIELDS[field.bindingId ?? ""] !== "necessity"
  )
    return "";
  return getNecessityIndicatorSuffix(
    catalogFieldNecessityIndicator(
      field,
      (record) => get(record.parentId),
      typeOf,
    ),
    field.props.isRequired === true,
  );
}

/** Labels whose suffix a record's values decide (a field's own Label, a Form's field Labels). */
export function catalogLabelSuffixDependents(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const type = typeOf(owner);
  if (CATALOG_LABEL_NODE_FIELDS[owner.bindingId ?? ""] === "necessity")
    return partChildrenOf(owner, get, typeOf).filter(
      (child) => typeOf(child) === "Label",
    );
  if (type !== "Form") return [];
  const out: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of childrenOf(node, get)) {
      if (CATALOG_LABEL_NODE_FIELDS[child.bindingId ?? ""] === "necessity")
        out.push(...catalogLabelSuffixDependents(child, get, typeOf));
      else visit(child);
    }
  };
  visit(owner);
  return out;
}

/**
 * shared `Breadcrumb` puts the separator after every crumb's Link but the current (last) one —
 * the crumb's separator Icon child, or the catalog default Icon for a crumb without children.
 * Returns the owner size and whether this crumb carries it; undefined for any other node. A crumb outside Breadcrumbs is hosted by the DOM
 * binding in a size-less RAC Breadcrumbs before a hidden next crumb (Preview orphan host), so it
 * carries the base-rule separator (`orphan`) — except the `current` state origin, which the host
 * keeps last.
 */
export function catalogBreadcrumbSeparator(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): { owner: CatalogConsumerNode; orphan?: true } | undefined {
  if (typeOf(node) !== "Breadcrumb") return undefined;
  const owner = get(node.parentId);
  if (!owner || typeOf(owner) !== "Breadcrumbs")
    return node.displayState === "current"
      ? undefined
      : { owner: node, orphan: true };
  const crumbs = childrenOf(owner, get).filter(
    (child) => typeOf(child) === "Breadcrumb" && !child.hidden,
  );
  return crumbs.at(-1)?.id === node.id ? undefined : { owner };
}

/**
 * `ListBox.css` `.react-aria-ListBoxItem:has([slot="icon"]) { padding-left: calc(--spacing-md +
 * --lb-icon-size + 6px) }`: an item inside a ListBox (the Preview marks the slot there) whose
 * icon slot child renders. Returns that item's left padding; undefined for any other node.
 */
export function catalogItemSlotInset(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): number | undefined {
  if (typeOf(node) !== "ListBoxItem") return undefined;
  let owner = get(node.parentId);
  while (owner && typeOf(owner) === "ListBoxSection")
    owner = get(owner.parentId);
  if (!owner || typeOf(owner) !== "ListBox") return undefined;
  return childrenOf(node, get).some(
    (child) => child.props.slot === "icon" && !child.hidden,
  )
    ? 12 + 16 + 6
    : undefined;
}

/** A crumb's label Text children (inside its RAC Link — they take the current crumb's weight). */
export function catalogBreadcrumbLabels(
  crumb: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  // (A crumb's label: the reference's `Link` — ADR-256 Phase 5a — or an authored Text.)
  return childrenOf(crumb, get).filter(
    (child) =>
      (typeOf(child) === "Link" || typeOf(child) === "Text") &&
      child.props.slot !== "separator",
  );
}

/** Crumbs whose separator a Breadcrumbs record's children decide. */
export function catalogBreadcrumbItems(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return typeOf(owner) === "Breadcrumbs"
    ? childrenOf(owner, get).filter((child) => typeOf(child) === "Breadcrumb")
    : [];
}

// ── ADR-256 Decision 7 — state conditions (`showWhen`) ───────────────────────────────────────────

/** A toggle's RAC button type → its field type (the button reads the field's state). */
const TOGGLE_BUTTON_FIELDS: Readonly<Record<string, string>> = {
  CheckboxButton: "Checkbox",
  SwitchButton: "Switch",
  RadioButton: "Radio",
};
/** Keys only an interaction gives (the part under the pointer — on the Canvas, a display state). */
const INTERACTION_KEYS: ReadonlySet<CatalogStateKey> = new Set([
  "isPressed",
  "isHovered",
  "isFocusVisible",
]);

/** One `showWhen` condition, normalized: its key, negation and own state owner. */
export interface CatalogStateCondition {
  readonly key: CatalogStateKey;
  readonly not: boolean;
  readonly from?: CatalogStateOwnerRef;
}
export function catalogStateConditions(
  showWhen: CatalogShowWhen,
): CatalogStateCondition[] {
  return showWhen.all.map((item) =>
    typeof item === "string"
      ? { key: item, not: false, from: showWhen.from }
      : "key" in item
        ? { key: item.key, not: false, from: item.from }
        : {
            key: item.not,
            not: true,
            from: ("from" in item ? item.from : undefined) ?? showWhen.from,
          },
  );
}

/** A record id's instance path segments and own id (`a/b::own`). */
function recordAddress(id: string): { path: string[]; own: string } {
  const at = id.lastIndexOf("::");
  return at < 0
    ? { path: [], own: id }
    : { path: id.slice(0, at).split("/"), own: id.slice(at + 2) };
}
const endsWith = (path: readonly string[], tail: readonly string[]) =>
  tail.length <= path.length &&
  tail.every((id, index) => path[path.length - tail.length + index] === id);

/**
 * Whether `record` is the ancestor a stored state owner address names (breakdown §1-1): a node id
 * is the record's own; an address's target is the record's own and the instance path ends the
 * record's, and every earlier position of the root-to-target path is the record's ancestor in the
 * same instance (a path that does not exist names nothing).
 */
function isStateOwner(
  record: CatalogConsumerNode,
  ref: Extract<CatalogStateOwnerRef, { ancestor: unknown }>["ancestor"],
  get: CatalogRecordLookup,
): boolean {
  // (A composite instance's record is also its collapsed template root's — `collapsedIds`.)
  const ids = (node: CatalogConsumerNode) => [
    node.id,
    ...(node.collapsedIds ?? []),
  ];
  return ids(record).some((recordId) => {
    const { path, own } = recordAddress(recordId);
    if ("nodeId" in ref) return own === ref.nodeId;
    const address = "address" in ref ? ref.address : ref.local;
    const steps = address.templatePath;
    if (own !== steps[steps.length - 1] || !endsWith(path, address.instances))
      return false;
    const prefix = path.join("/");
    let cursor: CatalogConsumerNode | undefined = record;
    for (let index = steps.length - 2; index >= 0; index -= 1) {
      cursor = cursor && get(cursor.parentId);
      if (!cursor || !ids(cursor).includes(`${prefix}::${steps[index]}`))
        return false;
    }
    return true;
  });
}

/**
 * The part whose state a condition reads: the nearest ancestor that gives the key (default), the
 * nearest of a type that gives it (`{ type }`), or the one ancestor an address names (`{ ancestor }`
 * — inside an origin, `local` is that origin's position in the nearest instance). `undefined` =
 * the reference is not linked (no such ancestor, or it does not give the key): the condition is
 * false — never another ancestor in its place.
 */
export function catalogStateOwner(
  node: CatalogConsumerNode,
  key: CatalogStateKey,
  from: CatalogStateOwnerRef | undefined,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId)) {
    const gives = catalogStateKeysOf(typeOf(cursor)).includes(key);
    if (!from) {
      if (gives) return cursor;
    } else if ("type" in from) {
      if (typeOf(cursor) === from.type && gives) return cursor;
    } else if (isStateOwner(cursor, from.ancestor, get))
      return gives ? cursor : undefined;
  }
  return undefined;
}

/** A toggle type → its group type (a group item reads the group's context). */
const GROUP_OF_ITEM: Readonly<Record<string, string>> = {
  Checkbox: "CheckboxGroup",
  Radio: "RadioGroup",
  // ADR-256 Phase 5d: a Tag's `allowsRemoving` is its TagGroup's (RAC `useTag` — the group's
  // `onRemove`), through the TagList.
  Tag: "TagGroup",
};
const ITEM_STATE_GROUPS: ReadonlySet<string> = new Set(
  Object.values(GROUP_OF_ITEM),
);
const GROUP_ITEMS_TYPES: ReadonlySet<string> = new Set([
  "CheckboxItems",
  "RadioItems",
  "TagList",
]);
/**
 * The states an item takes from its group (installed RAC 1.21.0): a Radio all four from the
 * RadioGroup's state; a Checkbox disabled · read-only · invalid from the CheckboxGroup's, its
 * `isRequired` its own prop (`Checkbox.mjs` — `props.isRequired`).
 */
const GROUP_STATE_KEYS: Readonly<Record<string, ReadonlySet<CatalogStateKey>>> =
  {
    Checkbox: new Set(["isDisabled", "isReadOnly", "isInvalid"]),
    Radio: new Set(["isDisabled", "isReadOnly", "isInvalid", "isRequired"]),
    Tag: new Set(["allowsRemoving"]),
  };
/** The CheckboxGroup / RadioGroup / TagGroup an item sits in (through its items wrapper and frames). */
function catalogItemGroup(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const groupType = GROUP_OF_ITEM[typeOf(owner)];
  if (!groupType) return undefined;
  let cursor = catalogPartParent(owner, get, typeOf);
  while (cursor && GROUP_ITEMS_TYPES.has(typeOf(cursor)))
    cursor = catalogPartParent(cursor, get, typeOf);
  return cursor && typeOf(cursor) === groupType ? cursor : undefined;
}
/** A RadioGroup's value: its first selected Radio's (as the DOM's `radiogroup`), else its own. */
function catalogRadioGroupValue(
  group: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string {
  const radios: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of childrenOf(node, get)) {
      const type = typeOf(child);
      if (type === "Radio") radios.push(child);
      else if (GROUP_ITEMS_TYPES.has(type) || PART_FRAME_TYPES.has(type))
        visit(child);
    }
  };
  visit(group);
  const selected = radios.find((radio) => radio.props.isSelected === true);
  return selected?.props.value !== undefined
    ? String(selected.props.value)
    : String(group.props.value ?? "");
}

/**
 * A state owner's resting value of a key on the Canvas (no interaction): the record's props, its
 * display state (a Components page state cell · a state origin) and the values derived for it.
 * hover · pressed · focus-visible exist only as a display state; an overlay is never open.
 */
export function catalogStateValue(
  owner: CatalogConsumerNode,
  key: CatalogStateKey,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  // A toggle's RAC button shares its field's state (RAC's `*Field` context): the field's record
  // holds it, the button only its own interaction display state.
  const host = TOGGLE_BUTTON_FIELDS[typeOf(owner)];
  if (host && !INTERACTION_KEYS.has(key)) {
    const field = catalogPartParent(owner, get, typeOf);
    if (field && typeOf(field) === host)
      return catalogStateValue(field, key, get, typeOf);
  }
  const props = owner.props;
  const derived = (owner.derivedProps ?? {}) as Record<string, unknown>;
  const state = owner.displayState;
  // A group item takes its group's state too (RAC's group context): disabled · read-only ·
  // invalid · required, and a Radio's selection is the group's value.
  const group = catalogItemGroup(owner, get, typeOf);
  if (
    group &&
    GROUP_STATE_KEYS[typeOf(owner)]?.has(key) &&
    group.props[key] === true
  )
    return true;
  switch (key) {
    case "isSelected": {
      // (Computed here, not read from the derived values — a condition is judged before they are.)
      // A collection's item is selected by its collection (Tabs' key — the paint's `_isSelected`),
      // over a display state its origin carried (a detached Tab keeps the Selected origin's).
      const item = catalogCollectionItemSelected(owner, get, typeOf);
      if (item !== undefined) return item;
      if (state === "selected") return true;
      if (state === "unselected") return false;
      if (group && typeOf(owner) === "Radio")
        return (
          catalogRadioGroupValue(group, get, typeOf) ===
          String(props.value ?? "")
        );
      return (props.isSelected ?? props.defaultSelected) === true;
    }
    case "isIndeterminate":
      return props.isIndeterminate === true || derived.isIndeterminate === true;
    case "isExpanded":
      if (state === "collapsed") return false;
      if (typeOf(owner) === "Disclosure")
        return catalogDisclosureExpanded(owner, get, typeOf);
      if (typeOf(owner) === "TreeItem")
        return catalogTreeItemExpanded(owner, get, typeOf);
      return (derived.isExpanded ?? props.isExpanded) === true;
    case "isInvalid":
      return props.isInvalid === true || derived._fieldInvalid === true;
    case "isDisabled": {
      const checkboxItem = catalogSelectionCheckboxItem(owner, get, typeOf);
      return (
        state === "disabled" ||
        props.isDisabled === true ||
        derived._fieldDisabled === true ||
        (!!checkboxItem &&
          catalogSelectionCheckboxDisabled(checkboxItem, get, typeOf))
      );
    }
    case "isReadOnly":
    case "isRequired":
    case "allowsRemoving":
    case "allowsSorting":
      return props[key] === true;
    case "isPressed":
      return state === "pressed";
    case "isHovered":
      return state === "hover";
    case "isFocusVisible":
      return state === "focusVisible";
    case "isOpen":
      return false;
    case "isCurrent":
      return (
        state === "current" ||
        (typeOf(owner) === "Breadcrumb" &&
          !catalogBreadcrumbSeparator(owner, get, typeOf))
      );
    case "hasSubmenu": {
      const parent = get(owner.parentId);
      return !!parent && typeOf(parent) === "SubmenuTrigger";
    }
  }
}

/**
 * ADR-256 Decision 7 — whether a node's `showWhen` holds: every condition's owner is linked and
 * its value (negated for `not`) is true. `valueOf` = where the owner's state comes from (the
 * Canvas resting value; the DOM passes RAC's render props).
 */
export function catalogShowWhenHolds(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  valueOf: (owner: CatalogConsumerNode, key: CatalogStateKey) => boolean = (
    owner,
    key,
  ) => catalogStateValue(owner, key, get, typeOf),
): boolean {
  if (!node.showWhen) return true;
  return catalogStateConditions(node.showWhen).every((condition) => {
    const owner = catalogStateOwner(
      node,
      condition.key,
      condition.from,
      get,
      typeOf,
    );
    return !!owner && valueOf(owner, condition.key) !== condition.not;
  });
}

/**
 * Nodes whose `showWhen` can follow `node`'s state: the conditioned nodes below a part that gives
 * state keys (a change of its values re-judges them).
 */
export function catalogStateDependents(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  // (A group whose items take its state — a TagGroup's `allowsRemoving` — gives no keys of its own.)
  if (
    !catalogStateKeysOf(typeOf(node)).length &&
    !ITEM_STATE_GROUPS.has(typeOf(node))
  )
    return [];
  const out: CatalogConsumerNode[] = [];
  const visit = (record: CatalogConsumerNode) => {
    for (const child of childrenOf(record, get)) {
      if (child.showWhen) out.push(child);
      visit(child);
    }
  };
  visit(node);
  return out;
}
