import { getIconData } from "@composition/rendering";
import { isDisclosureExpandedInContext } from "../../utils/disclosureGroupExpansion";
import { resolveStaticItemKey } from "../slotRoles";
import { getNecessityIndicatorSuffix } from "../../components/FieldNecessityIndicator";
import { COLLECTION_ITEM_OWNERS } from "../document/collectionItems";
import { MANUAL_ITEM_LABEL_COLORS } from "../document/manualBoxRules";
import { catalogCalendarTitle } from "../resolvers/resolveCatalogRuleCanvasBox";
import { racFieldHourCycle } from "../document/dateSegments";
import type { CatalogConsumerNode } from "./compositionRoot";

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
    DatePicker: new Set(["Calendar", "Popover"]),
    DateRangePicker: new Set(["RangeCalendar", "Calendar", "Popover"]),
    Select: new Set(["ListBox", "ListBoxItem", "ListBoxSection", "Popover"]),
    ComboBox: new Set(["ListBox", "ListBoxItem", "ListBoxSection", "Popover"]),
    // RAC MenuTrigger: the items live in the closed Popover; only the trigger button shows.
    Menu: new Set(["MenuItem", "MenuSection", "Separator", "Popover"]),
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
 * Tabs' Tab ↔ TabPanel pairing (by `itemId`, or by order for a typed template without item keys)
 * and the key RAC selects on the first render (explicit key, else the first enabled tab).
 */
export function catalogTabsSelection(
  tabsNode: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
) {
  const direct = childrenOf(tabsNode, get);
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
  const list = get(node.parentId);
  if (!list || typeOf(list) !== "TabList") return undefined;
  const tabs = get(list.parentId);
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
]);
/** Whether a field's hint part (`Description` · `FieldError`) shows; `undefined` = not one. */
export function catalogFieldHintShown(
  type: string,
  field: CatalogConsumerNode,
  fieldType: string,
): boolean | undefined {
  if (!FIELD_HINT_OWNERS.has(fieldType)) return undefined;
  if (type === "Description") return !!String(field.props.description ?? "");
  if (type === "FieldError")
    return (
      field.props.isInvalid === true && !!String(field.props.errorMessage ?? "")
    );
  return undefined;
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
  const parent = get(node.parentId);
  if (!parent) return false;
  const type = typeOf(node);
  const parentType = typeOf(parent);
  if (TRIGGER_OVERLAY_CHILDREN[parentType]?.has(type)) return true;
  const hint = catalogFieldHintShown(type, parent, parentType);
  if (hint !== undefined) return !hint;
  // The separator Icon after a crumb's Link: shared `Breadcrumb` drops it on RAC's current crumb.
  if (parentType === "Breadcrumb" && node.props.slot === "separator")
    return !catalogBreadcrumbSeparator(parent, get, typeOf);
  const field = catalogSearchFieldOfClear(node, get, typeOf);
  if (field) return !field.props.value;
  if (
    catalogPickerOfButton(node, get, typeOf)?.props.showCalendarIcon === false
  )
    return true;
  if (type === "TreeItem" && parentType === "TreeItem")
    return !catalogTreeItemExpanded(parent, get, typeOf);
  if (parentType === "Disclosure" && !DISCLOSURE_TRIGGER_TYPES.has(type))
    return !catalogDisclosureExpanded(parent, get, typeOf);
  if (type === "TabPanel" && parentType === "TabPanels") {
    const tabs = get(parent.parentId);
    if (!tabs || typeOf(tabs) !== "Tabs") return false;
    const { pairs, selectedKey } = catalogTabsSelection(tabs, get, typeOf);
    return !pairs.some(
      (pair) => pair.panel?.id === node.id && pair.key === selectedKey,
    );
  }
  return false;
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
  const trigger = get(node.parentId);
  if (!trigger || typeOf(trigger) !== "SelectTrigger") return;
  const field = get(trigger.parentId);
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
  const trigger = get(node.parentId);
  if (!trigger || typeOf(trigger) !== "SelectTrigger") return;
  const field = get(trigger.parentId);
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
  const trigger = get(node.parentId);
  if (!trigger || typeOf(trigger) !== "SelectTrigger") return;
  const field = get(trigger.parentId);
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
    cursor = get(cursor.parentId);
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
  if (typeOf(scope) === "Tabs")
    return catalogTabsSelection(scope, get, typeOf).panels;
  if (typeOf(scope) === "Breadcrumbs")
    return catalogBreadcrumbItems(scope, get, typeOf).flatMap((crumb) =>
      childrenOf(crumb, get).filter(
        (child) => child.props.slot === "separator",
      ),
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
      ...childrenOf(scope, get).filter((child) =>
        ["Description", "FieldError"].includes(typeOf(child)),
      ),
      ...(typeOf(scope) === "SearchField"
        ? childrenOf(scope, get)
            .flatMap((trigger) => childrenOf(trigger, get))
            .filter((icon) => catalogSearchFieldOfClear(icon, get, typeOf))
        : []),
      // (A picker's calendar button follows its `showCalendarIcon`.)
      ...childrenOf(scope, get)
        .flatMap((trigger) => childrenOf(trigger, get))
        .filter((button) => catalogPickerOfButton(button, get, typeOf)),
    ];
  const items: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of childrenOf(node, get))
      if (typeOf(child) === "TreeItem") {
        items.push(child);
        visit(child);
      }
  };
  visit(scope);
  return items;
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
  const min = number(slider.props.minValue, 0);
  const max = number(slider.props.maxValue, 100);
  const value = number(
    slider.props.value ?? slider.props.defaultValue,
    (min + max) / 2,
  );
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
 * Tree item that has no `TreeItemChevron` child — an item detached or made before the node): a
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
    width: `${TREE_CHEVRON_WIDTH + padding}px`,
    height: "100%",
    minHeight: `${TREE_CHEVRON_ICON}px`,
    paddingLeft: `${padding}px`,
    flexShrink: 0,
  };
}

/**
 * A TreeItem's `TreeItemChevron` child (the chevron button as a document node, 2026-10-04): at
 * most one, as a list like the other re-plan dependents.
 */
export function catalogTreeChevrons(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  if (typeOf(node) !== "TreeItem") return [];
  for (const id of node.children) {
    const child = get(id);
    if (child && typeOf(child) === "TreeItemChevron") return [child];
  }
  return [];
}

/** A `TreeItemChevron` record's TreeItem level; undefined for any other node. */
function treeChevronLevel(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): number | undefined {
  if (typeOf(node) !== "TreeItemChevron") return undefined;
  const item = get(node.parentId);
  return item ? catalogTreeLevel(item, get, typeOf) : undefined;
}

/**
 * A `TreeItemChevron` record's layout: its TreeItem's chevron button at the item's level.
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

/** A `TreeItemChevron` record's left padding (its level indent) — what its glyph centers right of. */
export function catalogTreeChevronInset(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): number {
  const level = treeChevronLevel(node, get, typeOf);
  return level === undefined ? 0 : treeChevronIndent(level);
}

/**
 * Parts a record's DOM owner composes before its children: a TreeItem row's chevron button when
 * the item has no `TreeItemChevron` child to hold it.
 */
export function catalogComposedParts(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): readonly CatalogComposedPart[] {
  if (catalogTreeChevrons(node, get, typeOf).length) return [];
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

/** RAC date fields that compose their DateInput's segments from their own props. */
const DATE_INPUT_OWNERS = new Set([
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
]);

/** The field owning a trigger sub-part, past the SelectTrigger wrapper. */
function triggerOwner(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  let owner = get(node.parentId);
  while (owner && typeOf(owner) === "SelectTrigger")
    owner = get(owner.parentId);
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
  const wrapper = get(node.parentId);
  const owner = triggerOwner(node, get, typeOf);
  if (!wrapper || !owner) return undefined;
  if (type === "SelectIcon")
    return typeOf(wrapper) === "SelectTrigger" &&
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
  const resolvedLocale = typeof ownLocale === "string" ? ownLocale : locale;
  if (resolvedLocale) out._locale = resolvedLocale;
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
  // The box of a quiet field shows its own quiet state (`fieldBoxOfQuietField`).
  const quietField = fieldBoxOfQuietField(node, get, typeOf);
  const own = quietField
    ? {
        ...control,
        isQuiet: true,
        _fieldDisabled: quietField.props.isDisabled === true,
        _fieldInvalid: quietField.props.isInvalid === true,
      }
    : control;
  const selected = catalogCollectionItemSelected(node, get, typeOf);
  return selected === undefined ? own : { ...own, _isSelected: selected };
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
  const parent = get(node.parentId);
  if (!parent) return;
  if (typeOf(parent) === "SelectTrigger" && parent.props.variant !== "plain")
    return;
  const owner = triggerOwner(node, get, typeOf);
  return owner?.props.isQuiet === true ? owner : undefined;
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
  const level = catalogTreeLevel(node, get, typeOf);
  // RAC TreeItem: `data-has-child-items` shows the chevron, `data-expanded` turns it (the rule's
  // `leadingIcon`), the level indents it.
  // RAC Breadcrumbs draws its last crumb as the current one (no separator, current paint); the
  // crumb's label Text inherits the current Link's weight.
  if (typeOf(node) === "Breadcrumb")
    return { _isLast: !catalogBreadcrumbSeparator(node, get, typeOf) };
  // RAC Tabs: a vertical TabList's Tab draws its indicator on the trailing edge.
  if (catalogTabsOfTab(node, get, typeOf)?.props.orientation === "vertical")
    return { orientation: "vertical" };
  const crumb = get(node.parentId);
  if (
    crumb &&
    typeOf(crumb) === "Breadcrumb" &&
    catalogBreadcrumbLabels(crumb, get, typeOf).includes(node)
  )
    return { _isLast: !catalogBreadcrumbSeparator(crumb, get, typeOf) };
  // RAC Calendar's header heading is its visible-range title from the Calendar's own props (the
  // header child's authored `children` is not read by the DOM).
  const calendar = get(node.parentId);
  if (
    typeOf(node) === "CalendarHeader" &&
    calendar &&
    CALENDAR_TYPES.has(typeOf(calendar))
  )
    return { children: catalogCalendarTitle(calendar.props, locale) };
  if (level !== undefined)
    return {
      _treeLevel: level,
      _hasTreeChildren: childrenOf(node, get).some(
        (child) => typeOf(child) === "TreeItem",
      ),
      isExpanded: catalogTreeItemExpanded(node, get, typeOf),
    };
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
  ];
  return [
    ...items,
    ...[owner, ...items].flatMap((item) =>
      catalogItemLabels(item, get, typeOf),
    ),
  ];
}

/**
 * A field's box and trigger parts whose derived values read the field (`fieldSubpartProps` · an
 * Input's quiet state and a SearchField's value), direct or inside its SelectTrigger.
 */
function fieldSubparts(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return childrenOf(owner, get)
    .flatMap((child) =>
      typeOf(child) === "SelectTrigger" ? childrenOf(child, get) : [child],
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
  if (track)
    return childrenOf(owner, get).filter((child) => typeOf(child) === track);
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
    return childrenOf(owner, get).filter(
      (child) => typeOf(child) === "CalendarHeader",
    );
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

/** Thumbs whose placement a Slider record's values decide. */
export function catalogSliderThumbs(
  slider: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  if (typeOf(slider) !== "Slider") return [];
  return childrenOf(slider, get)
    .filter((child) => typeOf(child) === "SliderTrack")
    .flatMap((track) =>
      childrenOf(track, get).filter((child) => typeOf(child) === "SliderThumb"),
    );
}

/** Fields whose DOM renders the necessity indicator after their Label (`renderNecessityIndicator`). */
const NECESSITY_OWNERS: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "Select",
  "ComboBox",
  "DateField",
  "TimeField",
  "ColorField",
  "CheckboxGroup",
  "RadioGroup",
  "TagGroup",
]);

/**
 * Text the DOM appends to a field's Label: the necessity indicator of the field's own
 * `necessityIndicator`, else the nearest Form's (`resolveInheritedFormFieldProps`), for its
 * `isRequired` (`getNecessityIndicatorSuffix`). Empty for any other node.
 */
export function catalogLabelSuffix(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string {
  if (typeOf(node) !== "Label") return "";
  const field = get(node.parentId);
  if (!field || !NECESSITY_OWNERS.has(typeOf(field))) return "";
  let indicator = field.props.necessityIndicator;
  for (
    let cursor = get(field.parentId);
    typeof indicator !== "string" && cursor;
    cursor = get(cursor.parentId)
  )
    if (typeOf(cursor) === "Form") indicator = cursor.props.necessityIndicator;
  return getNecessityIndicatorSuffix(
    typeof indicator === "string" ? indicator : undefined,
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
  if (NECESSITY_OWNERS.has(type))
    return childrenOf(owner, get).filter((child) => typeOf(child) === "Label");
  if (type !== "Form") return [];
  const out: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of childrenOf(node, get)) {
      if (NECESSITY_OWNERS.has(typeOf(child)))
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
  return childrenOf(crumb, get).filter(
    (child) => typeOf(child) === "Text" && child.props.slot !== "separator",
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
