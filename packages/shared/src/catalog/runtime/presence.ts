import { catalogSkeletonState } from "./skeletonContext";
import { catalogParticipatesInLayout } from "./layoutParticipation";
import {
  catalogTimelineDateTime,
  catalogTimelineDerived,
  catalogTimelineItemDerived,
} from "./timeline";
import {
  TIMELINE_COLORS,
  TIMELINE_ITEM_TYPE,
  TIMELINE_TYPE,
} from "../rule/timeline";
import {
  CASCADER_ITEM_TYPE,
  CASCADER_TYPE,
  cascaderDescriptionText,
  cascaderNotice,
  cascaderTableOf,
  cascaderValueText,
  catalogCascaderBackHidden,
  catalogCascaderChevronHidden,
  catalogCascaderCount,
  catalogCascaderItemRow,
  catalogCascaderOwnRowPart,
  catalogCascaderPassPartHidden,
  catalogCascaderTrailCrumb,
  catalogCascaderTrailHidden,
  catalogCascaderTrailOf,
  catalogCascaderTreeChevron,
  catalogCascaderTreeLevel,
  catalogCascaderItemSelected,
  catalogCascaderItemDuplicate,
  catalogCascaderItemHidden,
  catalogCascaderSearchField,
  catalogCascaderOfTriggerPart,
  catalogCascaderTrailCrumbText,
} from "./cascader";
import { catalogStepDerived, catalogStepListDerived } from "./stepList";
import {
  catalogStepListKeys,
  catalogStepListStates,
  type StepListStateInput,
} from "./stepListState";
import {
  catalogStepChromeColors,
  STEP_LIST_TYPE,
  STEP_PANEL_TYPE,
  STEP_TYPE,
  STEPPER_TYPE,
  type StepState,
} from "../rule/stepList";
import {
  catalogResizableCollapsedSize,
  catalogResizableDisplay,
  catalogResizableStartCollapsed,
  catalogResizableGroupDerived,
  catalogResizableHandleDerived,
  catalogResizableOrientation,
  catalogResizablePanelDerived,
  catalogResizablePanelShares,
  RESIZABLE_GROUP_TYPE,
  RESIZABLE_HANDLE_TYPE,
  RESIZABLE_PANEL_TYPE,
} from "./resizablePanels";
import { catalogUnavailableDateTest } from "./unavailableDates";
import {
  CATALOG_COLUMN_PLACE_PROP,
  resolveTableColumnKey,
} from "../../collections/resolveCollectionItems";
import {
  CATALOG_TREE_COLUMN_PROP,
  catalogTableAuthoredSort,
  catalogTableColumnEntries,
} from "../resolution/tableColumns";
import { catalogTableColumnKey } from "./tableSort";
import type { CatalogActionBadgeContent } from "../rule/actionBadge";
import { catalogStaticScheme } from "./staticBackdrop";
import {
  catalogSelectBoxDescriptionHidden,
  catalogSelectBoxShown,
} from "./selectBoxPresence";
import {
  catalogCalendarFirstDate,
  catalogDateRange,
  catalogDateStartValue,
  catalogDateValue,
} from "./dateValueRead";
import {
  catalogGroupExpansion,
  catalogGroupDisabledKeys,
  catalogGroupSelection,
  catalogItemDisabledByGroup,
  catalogItemKey,
  catalogItemSelected,
  catalogKeysHold,
} from "./groupSelection";
import { selectBoxDisabledKeys } from "./selectBoxSelection";
import { catalogSegmentOwner, catalogSegmentItems } from "./segmentedSelection";
import { formatLabeledValue } from "../document/labeledValue";
import { catalogRangeValue } from "./rangeSliderValue";
import { necessityLabel } from "./necessityLabels";
import {
  catalogPickerOfOption,
  catalogPickerOptions,
  catalogComboBoxSelectedOption,
  catalogPickerSelectionItem,
  catalogPickerSelectionHidden,
} from "./pickerSelection";
import {
  OVERLAY_OPEN_OWNERS,
  OVERLAY_BODY_TYPES,
  catalogAuthoredOpen,
  catalogOverlayOpen,
  catalogOverlayOwner,
} from "./overlayState";
import {
  catalogColorControlDerivedProps,
  catalogColorControlParts,
} from "./colorControlParts";
import {
  catalogNotificationBadgeText,
  cssVarToTokenRef,
  getIconData,
  resolveToken,
  resolveTextSourceText,
  S2_TOAST_EDGE,
  type TokenRef,
} from "@composition/rendering";
import { catalogToastIcon } from "../document/toastChrome";
import {
  catalogActionBarBorder,
  catalogActionBarCollectionOf,
  catalogActionBarCount,
  catalogActionBarSpaceOf,
  catalogLinkedActionBarOf,
} from "./actionBarContainer";
import { catalogValueDependents } from "./valueBindings";
import { catalogButtonPending } from "../document/buttonPending";
import { NumberFormatter } from "@internationalized/number";
import { parseColor } from "react-stately";
import { isRTL } from "@react-aria/i18n";
import { catalogNumberFormatOptions } from "../document/numberFormatValue";
import {
  catalogTableRowTracks,
  catalogTableSelectionColumn,
  catalogTrackTableOf,
  CATALOG_COLUMN_HIDDEN_PROP,
  CATALOG_COLUMN_MENU_PROP,
  CATALOG_COLUMN_PINNED_EDGE_PROP,
  CATALOG_COLUMN_PINNED_PROP,
  catalogRowStriped,
  catalogTableFooterPart,
  catalogTableSelectionPartHidden,
  catalogTableSelectionParts,
  catalogTableTrackDependents,
} from "./tableTracks";
import {
  CATALOG_CELL_LINE_PROP,
  CATALOG_CELL_MERGED_PROP,
  CATALOG_ROW_CELL_LINES_PROP,
} from "./tableCellMerge";
import { catalogCellStripe } from "./tableStripes";
import { isDisclosureExpandedByIntent } from "../../utils/accordionExpansion";
import { resolveStaticItemKey } from "../slotRoles";
import {
  COLLECTION_ITEM_OWNERS,
  isCollectionItemOf,
  isCollectionWrapperOf,
  isItemCollection,
} from "../document/collectionItems";
import { CATALOG_TOGGLE_GROUP_OF } from "../document/sizePropagation";
import {
  catalogAncestorInherited,
  catalogInheritedTakes,
  catalogInheritedFlag,
} from "./inheritedProps";
import { catalogNavLinkDerived, catalogNavLinks } from "./navRoute";
import {
  catalogSideNavDependents,
  catalogSideNavDerived,
  catalogSideNavHidden,
  catalogSideNavPanelOf,
  catalogSideNavOf,
  type CatalogSideNavShownRoute,
} from "./sideNav";
import { CATALOG_INHERITED_RECEIVERS } from "./providerContexts";
import { RAC_SLOT_PROVIDERS } from "../generated/racSlotProviders";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import type { ComponentRule } from "../../types/catalog-style.types";
import { catalogBoxModel } from "./boxModel";
import {
  catalogContainerLayerAbove,
  catalogContainerLayerOf,
  catalogDerivesContainerLayer,
} from "./containerLayer";
import { MANUAL_ITEM_LABEL_COLORS } from "../document/manualBoxRules";
import { catalogBreadcrumbSeparatorIcon } from "../resolvers/resolveCatalogRuleCanvasBox";
import {
  catalogListItemFlexShrink,
  catalogListSectionHeaderSticky,
} from "../document/rulePartRules";
import {
  type CatalogCalendarModelInput,
  catalogCalendarGrid,
  catalogCalendarHeaderOrder,
  catalogCalendarHeading,
  catalogCalendarLocale,
  catalogCalendarMonthCount,
  catalogCalendarPickerText,
  catalogCalendarRangeTitle,
  catalogCalendarYearFirst,
} from "./calendarModel";
import { racFieldHourCycle } from "../document/dateSegments";
import type { CatalogConsumerNode } from "./compositionRoot";
import {
  catalogSelectValues,
  catalogValueTemplateHidden,
  catalogValueTemplateNodes,
  catalogValueTemplateShown,
} from "./selectValueTemplate";
import {
  CATALOG_UNAVAILABLE_MENU_TRIGGER,
  catalogMenuItemUnavailable,
} from "./unavailableMenuItem";
import type {
  CatalogShowWhen,
  CatalogStateKey,
  CatalogStateOwnerRef,
} from "../document/types";
import { catalogStateKeysOf } from "../document/stateOwnerRefs";
import {
  isFieldControlGroup,
  PART_FRAME_TYPES,
} from "../../domain/componentTraits";
import {
  catalogFieldBox,
  catalogFieldBoxOfInput,
  catalogFieldErrorIcon,
} from "./fieldPrefix";
import {
  CATALOG_EMPTY_STATE_COLLECTIONS,
  catalogIsEmptyState,
  RAC_COLLECTION_CHILD_TYPES,
  catalogChildKind,
} from "../nesting/nestingRules";
import { catalogLengthPx } from "./lengthPx";
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

/**
 * The triggers whose overlay is the component's own body (ADR-278 `OPEN_BODY_ORIGINS` — Dialog ·
 * Popover · Tooltip · ContextualHelp · Menu): a project component's origin opens it on the Local
 * page card (`originBodyOpen`), as the Library page's cards do with a patch `open`. A picker's
 * Popover (Select · ComboBox · DatePicker) is a part — it stays closed.
 */
const OPEN_BODY_TRIGGERS: ReadonlySet<string> = new Set([
  "DialogTrigger",
  "PreviewTrigger",
  "SheetTrigger",
  "TooltipTrigger",
  "ContextualHelp",
  "MenuTrigger",
]);
/**
 * Whether a trigger record draws its overlay body open although no display state says so — the
 * consumer decides (a project component's origin drawn on the Local page).
 */
export type CatalogOriginBodyOpen = (trigger: CatalogConsumerNode) => boolean;

/**
 * ADR-256 Phase 8c — a Disclosure's trigger parts, the reference `Disclosure > Heading >
 * Button[slot=trigger] > (chevron + title)` (layout frames skipped, `catalogPartParent`). The
 * binding id filters first: these run for every record.
 */
export function catalogDisclosureOfHeading(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (node.bindingId !== "heading") return undefined;
  const owner = catalogPartParent(node, get, typeOf);
  return owner && typeOf(owner) === "Disclosure" ? owner : undefined;
}
/** The Disclosure whose trigger Button `node` is. */
export function catalogDisclosureOfTrigger(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (node.bindingId !== "button" || node.props.slot !== "trigger")
    return undefined;
  const heading = catalogPartParent(node, get, typeOf);
  return heading ? catalogDisclosureOfHeading(heading, get, typeOf) : undefined;
}
/** A Disclosure's trigger chevron Icons (`Heading > Button[slot=trigger] > Icon`). */
function catalogDisclosureTriggerIcons(
  disclosure: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return partChildrenOf(disclosure, get, typeOf)
    .filter((heading) => heading.bindingId === "heading")
    .flatMap((heading) => partChildrenOf(heading, get, typeOf))
    .filter(
      (button) =>
        button.bindingId === "button" && button.props.slot === "trigger",
    )
    .flatMap((button) => partChildrenOf(button, get, typeOf))
    .filter((child) => child.bindingId === "icon");
}
/** The Disclosure whose trigger holds `node` (its chevron Icon · its title Text). */
export function catalogDisclosureOfTriggerPart(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (node.bindingId !== "icon" && node.bindingId !== "text") return undefined;
  const trigger = catalogPartParent(node, get, typeOf);
  return trigger ? catalogDisclosureOfTrigger(trigger, get, typeOf) : undefined;
}

/**
 * The Accordion whose state a Disclosure follows: RAC's group context reaches every
 * Disclosure below the group — through any element and a Disclosure's panel — up to a nested
 * group (ADR-256 Phase 8 판독 H1).
 */
export function catalogAccordionOf(
  disclosure: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  for (let cursor = get(disclosure.parentId); cursor;) {
    if (typeOf(cursor) === "Accordion") return cursor;
    cursor = get(cursor.parentId);
  }
  return undefined;
}

/**
 * An Accordion's Disclosures in document order (those whose `catalogAccordionOf` is it)
 * and the containers they sit in — a change to either can move the group's expanded keys.
 */
export function catalogGroupDisclosures(
  group: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): { disclosures: CatalogConsumerNode[]; containers: CatalogConsumerNode[] } {
  const disclosures: CatalogConsumerNode[] = [];
  const containers: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of childrenOf(node, get)) {
      const type = typeOf(child);
      if (type === "Accordion") continue;
      if (type === "Disclosure") disclosures.push(child);
      // (An empty frame too: a Disclosure put into it later joins the group — Round 19 LOW.)
      else if (catalogChildKind(type).kind !== "leaf") containers.push(child);
      visit(child);
    }
  };
  visit(group);
  return { disclosures, containers };
}

/**
 * Whether RAC shows a Disclosure's panel: its own `isExpanded` (absent = expanded), or inside a
 * Accordion the group's expanded keys (`isDisclosureExpandedInContext`, the DOM binding's).
 */
export function catalogDisclosureExpanded(
  disclosure: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  // ADR-308: inside an Accordion the group's expanded keys decide (`catalogGroupExpansion` — one
  // key while it expands one); a standalone Disclosure keeps its own `isExpanded`.
  const group = catalogAccordionOf(disclosure, get, typeOf);
  if (!group)
    return isDisclosureExpandedByIntent(
      disclosure.props as Record<string, unknown>,
    );
  return catalogGroupExpansion(group, typeOf).includes(
    catalogItemKey(disclosure, typeOf),
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

/**
 * ToggleButton's decorative Icon and (ADR-276) its label Text follow its text color, including
 * selected/hover states — `utilities.css` `.button-base > :is(.react-aria-Icon, .react-aria-Text,
 * .react-aria-Label) { color: inherit }`.
 */
export function catalogToggleButtonGlyphOwner(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (!["icon", "text", "label"].includes(node.bindingId ?? ""))
    return undefined;
  const parent = catalogPartParent(node, get, typeOf);
  if (
    node.bindingId === "label" &&
    parent &&
    [
      "CheckboxGroup",
      "RadioGroup",
      "TextField",
      "TextArea",
      // (S2 체크리스트 §4.1, 2026-11-22: TokenField — S2 TextArea's pattern.)
      "TokenField",
      "SearchField",
      "NumberField",
      "ColorField",
      "ComboBox",
      // (2026-11-09: the date fields — their disabled Label, no longer a dimmed root.)
      "DateField",
      "TimeField",
      "DatePicker",
      "DateRangePicker",
      // (2026-11-18: S2 Slider's `color` — `neutral-subdued`, `disabled` while disabled — no dimmed root.)
      "Slider",
      "RangeSlider",
    ].includes(typeOf(parent))
  )
    return parent;
  if (
    node.bindingId === "label" &&
    parent &&
    ["CheckboxButton", "RadioButton", "SwitchButton"].includes(typeOf(parent))
  ) {
    return catalogPartParent(parent, get, typeOf);
  }
  if (!parent) return undefined;
  // (A Button an owner disables — its ButtonGroup, its field — paints its Text · Icon with its state
  //  paint, S2 content being `currentColor`: gray on both consumers, 2026-11-09. Buttons that are
  //  another component's part (a Disclosure trigger, a Tag's remove, a Tree chevron) keep their
  //  owner's glyph color.)
  if (typeOf(parent) === "Button") {
    // (A Select's trigger value · glyph are the picker parts' — `_pickerIcon` · `_pickerValue`.)
    const field = catalogFieldButtonOwner(parent, get, typeOf);
    // (2026-11-14: an `auto` Button's scheme is resolved after its parts are — they take its paint,
    //  S2 content `currentColor`; the DOM `color: inherit` under its `data-static-color`.)
    return catalogButtonGroupOf(parent, get, typeOf) ||
      (field && typeOf(field) !== "Select" && typeOf(field) !== "Cascader") ||
      parent.props.staticColor === "auto"
      ? parent
      : undefined;
  }
  return ["ToggleButton", "ActionButton", "SegmentedControlItem"].includes(
    typeOf(parent),
  )
    ? parent
    : undefined;
}

/**
 * S2 마이그레이션 (2026-11-18) — the picture of a DropZone's IllustratedMessage (S2 `DropZone >
 * IllustratedMessage > Illustration`): S2 colors it accent while a drag is over the zone
 * (`IllustratedMessageContext.isDropTarget` → `--iconPrimary`).
 */
export function catalogIllustrationInDropZone(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(node) !== "Illustration") return false;
  const message = catalogPartParent(node, get, typeOf);
  if (!message || typeOf(message) !== "IllustratedMessage") return false;
  const zone = catalogPartParent(message, get, typeOf);
  return zone !== undefined && typeOf(zone) === "DropZone";
}

/**
 * ADR-259 Phase 3 — the ContextualHelp an ActionButton is the trigger of (its parent, layout frames
 * skipped): S2's quiet icon-only ActionButton (`slot={null}` — S2 `ContextualHelp.tsx:198`), its box
 * the ActionButton rule's icon-only square at the help's size (XS 20 · S 24).
 */
export function catalogContextualHelpOfTrigger(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "ActionButton") return undefined;
  const parent = catalogPartParent(node, get, typeOf);
  return parent && typeOf(parent) === "ContextualHelp" ? parent : undefined;
}

/**
 * ADR-164 재개 (ADR-256 G5 example 12): a layout frame the author put around a part inside a
 * positioned part box (a SliderTrack's `relative` — the fill · thumbs are placed in it) is a static
 * box, as its DOM `div`: the parts it holds are placed in the box around it (the engine's nearest
 * positioned ancestor, `position: static`). A frame with an authored position, or a placed one,
 * is positioned itself; a frame outside a positioned part keeps the parent-box placement (an
 * authored `placement` is its parent's coordinates).
 */
export function catalogStaticPartFrame(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (!PART_FRAME_TYPES.has(typeOf(node))) return false;
  if (node.layout.position !== undefined) return false;
  const owner = catalogPartParent(node, get, typeOf);
  return (
    !!owner &&
    (owner.layout.position === "relative" ||
      owner.layout.position === "absolute")
  );
}

/** A node's children with the layout frames among them opened (`PART_FRAME_TYPES`). */
/** A record's part children, past the layout frames the author puts around them. */
export function catalogPartChildren(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return partChildrenOf(node, get, typeOf);
}

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
  // (S2 체크리스트 §4.1 TokenField Phase 4)
  "TokenField",
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
    : direct.filter((child) => typeOf(child) === "TabPanel");
  // A keyed panel pairs with its Tab; the panels without a key pair in order with the Tabs no keyed
  // panel names (G5 example 8 — "+" keys only the pair it adds, the template's pairs stay by order).
  const keyed = tabs.map((tab) => {
    const key = catalogItemKey(tab, typeOf);
    return {
      key,
      tab,
      panel: panels.find((candidate) => candidate.props.itemId === key),
    };
  });
  const unkeyed = panels.filter((panel) => panel.props.itemId === undefined);
  let next = 0;
  const pairs = keyed.map((pair) =>
    pair.panel ? pair : { ...pair, panel: unkeyed[next++] },
  );
  // ADR-308: the Tabs' key (`selectedKey`, else `defaultSelectedKey`), else RAC's default — the
  // first enabled Tab (`catalogGroupSelection`).
  const keys = catalogGroupSelection(tabsNode, get, typeOf);
  const selectedKey = keys === "all" ? undefined : (keys[0] ?? pairs[0]?.key);
  return { tabList, panelsNode, tabs, panels, pairs, selectedKey };
}

/**
 * RAC `data-selected` of an item inside its collection: the collection's selection state decides
 * (the DOM binding's keys — Tabs' selected key, else its first Selected · enabled Tab; any other
 * collection's items set Selected while it selects — RAC selects nothing in `selectionMode` none),
 * not the item template's display state. Undefined outside a collection (a state origin shows its
 * own display state).
 */
/** Whether `node` is a Tag of an emphasized TagGroup (S2 `isEmphasized`). */
function catalogTagOfEmphasizedGroup(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(node) !== "Tag") return false;
  const owner = catalogCollectionOfItem(node, get, typeOf);
  return (
    !!owner && typeOf(owner) === "TagGroup" && owner.props.isEmphasized === true
  );
}

function catalogCollectionItemSelected(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean | undefined {
  // A selection checkbox shows its item's selection (RAC `CheckboxFieldContext` slot `selection`).
  const checkboxItem = catalogSelectionCheckboxItem(node, get, typeOf);
  if (checkboxItem)
    return catalogStateValue(checkboxItem, "isSelected", get, typeOf);
  // A Column's select-all checkbox is checked while every row is (RAC `useTableSelectAllCheckbox`).
  if (typeOf(node) === "Column") {
    const counts = catalogTableSelectedRows(node, get, typeOf);
    return counts
      ? counts.total > 0 && counts.selected === counts.total
      : undefined;
  }
  const tabs = catalogTabsOfTab(node, get, typeOf);
  if (tabs) {
    const { pairs, selectedKey } = catalogTabsSelection(tabs, get, typeOf);
    return pairs.some(
      (pair) => pair.tab.id === node.id && pair.key === selectedKey,
    );
  }
  // (ADR-326 Phase 4: a Cascader item — its field's value, as the DOM's Menu selects its rows.)
  const cascaderItem = catalogCascaderItemSelected(node, get, typeOf);
  if (cascaderItem !== undefined) return cascaderItem;
  // ADR-308: every other item is selected by its group's keys (a collection's, a picker's, a toggle
  // group's, a SegmentedControl's — `catalogItemSelected`).
  return catalogItemSelected(node, get, typeOf);
}

/**
 * Whether a SelectionIndicator's item is selected — a Card's from its CardView's keys first (the
 * Card record's own derived selection is judged later in the same step), else the item's state.
 */
function catalogIndicatorItemSelected(
  item: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  return (
    (typeOf(item) === "Card"
      ? catalogCollectionItemSelected(item, get, typeOf)
      : undefined) ??
    catalogStateValue(item, "isSelected", get, typeOf) === true
  );
}

/**
 * S2 `CardCheckbox` — the Card origin's plate `frame` around its selection Checkbox (S2's `div`
 * at the card's spacing with its backdrop, 2026-11-18): the Card it sits in, if `node` is that
 * frame.
 */
function catalogCardCheckboxCard(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "frame") return undefined;
  const card = get(node.parentId);
  if (!card || typeOf(card) !== "Card") return undefined;
  return node.children.some((id) => {
    const child = get(id);
    return (
      !!child &&
      typeOf(child) === "Checkbox" &&
      child.props.slot === "selection"
    );
  })
    ? card
    : undefined;
}

/**
 * S2 `--card-spacing` (`Card.tsx`): the card's spacing at its size and `density` — the Card rule's
 * size block (regular) or its `containerVariants.density` block's `&[data-size]` compound. The
 * spacing places the sections and the checkbox; the card's padding is the same value but 0 on a
 * quiet card (S2 `--card-padding-x/y`).
 */
function catalogCardSpacing(card: CatalogConsumerNode): number | undefined {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>).Card;
  const size = String(card.props.size ?? "M");
  const density = String(card.props.density ?? "regular");
  const variants = (
    rule?.structure?.composition as
      | {
          containerVariants?: Record<
            string,
            Record<
              string,
              {
                nested?: ReadonlyArray<{
                  selector: string;
                  styles: Record<string, string>;
                }>;
              }
            >
          >;
        }
      | undefined
  )?.containerVariants;
  const compound = variants?.density?.[density]?.nested?.find(
    (nested) => nested.selector === `&[data-size="${size}"]`,
  )?.styles.padding;
  if (compound !== undefined) return Number.parseFloat(compound);
  const value = (rule?.sizes as Record<string, { paddingX?: unknown }>)?.[size]
    ?.paddingX;
  return typeof value === "number" ? value : undefined;
}

/** A Card's sections in its flow — not its absolute selection indicator · checkbox plate. */
function catalogCardFlowChildren(
  card: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return card.children
    .map((id) => get(id))
    .filter(
      (child): child is CatalogConsumerNode =>
        !!child &&
        child.hidden !== true &&
        typeOf(child) !== "SelectionIndicator" &&
        !catalogCardCheckboxCard(child, get, typeOf),
    );
}

/**
 * S2 Card's sections (`Card.tsx` `preview` · `content` · `footer`): no gap — the CardPreview reaches
 * the card's edges (`marginX: -padding-x`, `marginTop: -padding-y`, the bottom too when it is the
 * last section — here only when it is the first, the margin is the card's padding: authored, the
 * density's or a quiet card's 0), a Content is the spacing below what comes before it and ¾ of it
 * above what follows (`paddingTop` · `paddingBottom: calc(var(--card-spacing) * 1.5 / 2)` — 0 at the
 * first · last child), a Footer ¾ above it. Undefined for any other node.
 */
export function catalogCardSection(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, number | string> | undefined {
  const type = typeOf(node);
  // (S2 `isCardView: 'full'`: a Card in a CardView fills its cell — not its size's width.)
  if (type === "Card")
    return catalogCardViewOf(node, get, typeOf)
      ? { _inCardView: 1 }
      : undefined;
  if (!CARD_SECTION_TYPES.has(type)) return undefined;
  const card = get(node.parentId);
  if (!card || typeOf(card) !== "Card") return undefined;
  const flow = catalogCardFlowChildren(card, get, typeOf);
  if (type === "Avatar" || type === "Image") {
    // (S2 UserCard's Avatar · ProductCard's thumbnail right after the preview: up half its height
    //  over it — `:is([slot=preview] + *)` `marginTop: calc(var(--size) / -2)` · `calc(self(height)
    //  / -2)`; a positioned box so it draws over the preview.)
    const index = flow.findIndex((child) => child.id === node.id);
    const before = index > 0 ? flow[index - 1] : undefined;
    if (!before || typeOf(before) !== "CardPreview") return undefined;
    const height =
      type === "Avatar"
        ? node.props.isOverBackground === true
          ? Number(node.props.size)
          : Number.NaN
        : node.props.slot === "thumbnail"
          ? catalogCardThumbnailSize(card)
          : Number.NaN;
    return Number.isFinite(height) && height > 0
      ? { _cardOverlap: height / 2 }
      : undefined;
  }
  const first = flow[0]?.id === node.id;
  const last = flow[flow.length - 1]?.id === node.id;
  if (type === "CardPreview") {
    const padding = catalogBoxModel(card).padding;
    const out: Record<string, number | string> = {
      _cardBleedLeft: catalogLengthPx(padding?.left),
      _cardBleedRight: catalogLengthPx(padding?.right),
    };
    if (first) out._cardBleedTop = catalogLengthPx(padding?.top);
    if (last) out._cardBleedBottom = catalogLengthPx(padding?.bottom);
    // (S2 quiet: the card does not clip — the preview takes the card's corner, its size's radius.)
    if (card.props.variant === "quiet") {
      const radius = (
        (COMPONENT_RULES_TABLE as Record<string, ComponentRule>).Card?.sizes as
          Record<string, { borderRadius?: unknown }> | undefined
      )?.[String(card.props.size ?? "M")]?.borderRadius;
      const name = /^\{radius\.([a-z]+)\}$/.exec(String(radius))?.[1];
      if (name) return { ...out, cardRadius: name };
    }
    return out;
  }
  const spacing = catalogCardSpacing(card);
  if (spacing === undefined) return undefined;
  if (type === "Footer") return { _cardPadTop: spacing * 0.75 };
  return {
    _cardPadTop: first ? 0 : spacing,
    _cardPadBottom: last ? 0 : spacing * 0.75,
  };
}

const CARD_SECTION_TYPES: ReadonlySet<string> = new Set([
  "CardPreview",
  "Content",
  "Footer",
  "Avatar",
  "Image",
]);

/** S2 ProductCard's thumbnail side at the card's size — the Card rule's `sizeSelectors`. */
function catalogCardThumbnailSize(card: CatalogConsumerNode): number {
  const composition = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)
    .Card?.structure?.composition as
    | { sizeSelectors?: Record<string, Record<string, Record<string, string>>> }
    | undefined;
  return Number.parseFloat(
    composition?.sizeSelectors?.[String(card.props.size ?? "M")]?.[
      '> .react-aria-Image[slot="thumbnail"]'
    ]?.height ?? "",
  );
}

/**
 * A CardPreview's reach to its card's edges (`catalogCardSection` — S2 `preview` negative margins):
 * it stretches across the card (no `100%` width — that would stop at the padding) with the margins
 * the card's padding. An Avatar · thumbnail over the preview moves up (`_cardOverlap`). An authored
 * margin wins on its side.
 */
export function catalogCardPreviewLayout(
  node: CatalogConsumerNode,
): Record<string, string> | undefined {
  const derived = node.derivedProps;
  if (derived?._inCardView === 1)
    return node.sizing.width === undefined ? { width: "100%" } : undefined;
  if (typeof derived?._cardOverlap === "number")
    return {
      position: "relative",
      ...(node.layout.marginTop === undefined
        ? { marginTop: `${-derived._cardOverlap}px` }
        : {}),
    };
  if (typeof derived?._cardBleedLeft !== "number") return undefined;
  const out: Record<string, string> = { width: "auto", alignSelf: "stretch" };
  for (const [key, side] of [
    ["_cardBleedTop", "marginTop"],
    ["_cardBleedRight", "marginRight"],
    ["_cardBleedBottom", "marginBottom"],
    ["_cardBleedLeft", "marginLeft"],
  ] as const) {
    const value = derived[key];
    if (
      typeof value === "number" &&
      value > 0 &&
      node.layout[side] === undefined
    )
      out[side] = `${-value}px`;
  }
  return out;
}

/**
 * The RAC contexts a part gives its children (`RAC_SLOT_PROVIDERS`) — a Card in a CardView is RAC's
 * GridListItem (the `card` renderer — S2 CardView), so it gives a GridListItem's.
 */
function racSlotProvision(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): (typeof RAC_SLOT_PROVIDERS)[string] | undefined {
  if (typeOf(node) === "Card")
    return catalogCardViewOf(node, get, typeOf)
      ? RAC_SLOT_PROVIDERS.GridListItem
      : undefined;
  return RAC_SLOT_PROVIDERS[typeOf(node)];
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
  const pickerItem = catalogPickerSelectionItem(node, get, typeOf);
  if (pickerItem) return pickerItem;
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId)) {
    const provision = racSlotProvision(cursor, get, typeOf)?.Checkbox;
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
  const collection =
    catalogPickerOfOption(item, get, typeOf) ??
    catalogCollectionOfItem(item, get, typeOf);
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
  if (
    !racSlotProvision(item, get, typeOf)?.Checkbox &&
    !["ListBoxItem", "MenuItem"].includes(typeOf(item))
  )
    return [];
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

/**
 * S2's Divider among a collection's items (`separator-utils.ts` `isSeparatorHidden`): a Separator in
 * a Menu (2026-11-18) or a ListBox (2026-11-22 — S2 `PickerSection`) is not drawn first, last or
 * right before another Separator — the one a section brings (「+ Section」) disappears when the
 * section ends the list. The list's empty state (the Menu's Text · a ListBox's IllustratedMessage)
 * is not an item.
 */
const SEPARATOR_COLLECTIONS: Readonly<Record<string, string>> = {
  Menu: "Text",
  ListBox: "IllustratedMessage",
};
export function catalogCollectionSeparatorHidden(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(node) !== "Separator") return false;
  const list = get(node.parentId);
  const emptyState = list && SEPARATOR_COLLECTIONS[typeOf(list)];
  if (!list || !emptyState) return false;
  const items = childrenOf(list, get).filter(
    (child) => typeOf(child) !== emptyState,
  );
  const at = items.findIndex((child) => child.id === node.id);
  const next = items[at + 1];
  return at <= 0 || !next || typeOf(next) === "Separator";
}

/**
 * A Pagination's parts that its controls and page window leave out (2026-11-19 — shadcn aria
 * Pagination). `controls`: `simple` = the numbers only (no step buttons, no first · last page or gaps),
 * `iconsOnly` = the step buttons only, their chevrons alone (no number group, no words); its 「Rows per
 * page」 Select while `showRowsPerPage`. Around the page window of its number group
 * (the resolver's `_pageWindow` — a connected Pagination in a running Preview) the first page shows
 * when the window starts after it and its gap when a page lies between, the last page and its gap
 * likewise. Without a window (an unconnected sample) the sample's end shows: its last page and the
 * gap before it.
 */
export function catalogPaginationPartHidden(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  const type = typeOf(node);
  const parent = get(node.parentId);
  if (!parent) return false;
  // (The Pagination above a part — across its navigation frame: shadcn's `Field` + `nav` pair,
  //  사용자 「rows per page 와 pagination 이 그룹화」 2026-11-19.)
  const paginationOf = (record: CatalogConsumerNode | undefined) => {
    let cursor = record;
    while (cursor && typeOf(cursor) === "frame") cursor = get(cursor.parentId);
    return cursor && typeOf(cursor) === "Pagination" ? cursor : undefined;
  };
  // An icons-only step button's word (its name instead — the resolver's `aria-label`).
  if (type === "Text" && typeOf(parent) === "ActionButton")
    return paginationOf(get(parent.parentId))?.props.controls === "iconsOnly";
  // (Its 「Rows per page」 Select — the Pagination's own child — only while asked for.)
  if (typeOf(parent) === "Pagination" && type === "Select")
    return parent.props.showRowsPerPage !== true;
  // Its step buttons and number group (in its navigation frame).
  if (typeOf(parent) === "frame") {
    const pagination = paginationOf(parent);
    if (!pagination) return false;
    const controls = pagination.props.controls;
    if (type === "ActionButton") return controls === "simple";
    if (type === "ActionButtonGroup") return controls === "iconsOnly";
    return false;
  }
  if (typeOf(parent) !== "ActionButtonGroup") return false;
  const pagination = paginationOf(get(parent.parentId));
  if (!pagination) return false;
  let part: "first" | "last" | "gapStart" | "gapEnd" | undefined;
  if (
    type === "ActionButton" &&
    (node.props.id === "first" || node.props.id === "last")
  )
    part = node.props.id;
  else if (type === "Icon") {
    // (A gap before the numbers is the start's, after them the end's.)
    const siblings = childrenOf(parent, get);
    const at = siblings.findIndex((child) => child.id === node.id);
    const numbered = siblings.some(
      (child, index) =>
        index < at &&
        typeOf(child) === "ActionButton" &&
        /^\d+$/.test(String(child.props.id ?? "")),
    );
    part = numbered ? "gapEnd" : "gapStart";
  }
  if (!part) return false;
  if (pagination.props.controls === "simple") return true;
  const span = parent.props._pageWindow as
    { start: number; end: number } | undefined;
  if (!span) return part === "first" || part === "gapStart";
  const window = { ...span, count: Number(parent.props._pageCount ?? 0) };
  switch (part) {
    case "first":
      return window.start <= 1;
    case "gapStart":
      return window.start <= 2;
    case "gapEnd":
      return window.end >= window.count - 1;
    case "last":
      return window.end >= window.count;
  }
}

/**
 * An item its collection's `disabledKeys` names (S2 · RAC disable the item: no press · selection,
 * the disabled paint) — Menu · TagGroup · SideNav (2026-11-18), ListBox · GridList · Table · Tree ·
 * CardView · Select · ComboBox · Tabs (부록 D.3 2단계, 2026-11-23). The DOM's RAC reads the
 * collection's prop; the Canvas paints the item disabled.
 */
export function catalogItemKeyDisabled(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(node) !== "SideNavItem")
    return catalogItemDisabledByGroup(node, get, typeOf);
  const nav = catalogSideNavOf(node, get, typeOf);
  return (
    !!nav &&
    catalogGroupDisabledKeys(nav.props).includes(catalogItemKey(node, typeOf))
  );
}

/** The dismissible Dialog (S2 `isDismissible`) whose ButtonGroup `node` is — it gives way to the close button. */
export function catalogDismissibleDialogOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "ButtonGroup") return undefined;
  const dialog = catalogPartParent(node, get, typeOf);
  return dialog &&
    typeOf(dialog) === "Dialog" &&
    dialog.props.isDismissible === true
    ? dialog
    : undefined;
}

/**
 * The collections whose items carry a selection Checkbox only while the collection selects with
 * checkboxes — S2 draws it for `selectionMode !== 'none' && selectionBehavior === 'toggle'` (the
 * `checkbox` style): TreeView `TreeSelectionCheckbox`, ListView `ListSelectionCheckbox`, Card
 * `CardCheckbox` (2026-11-18 — GridList · CardView joined the Tree).
 */
const CHECKBOX_SELECTION_COLLECTIONS: Readonly<Record<string, string>> = {
  TreeItem: "Tree",
  GridListItem: "GridList",
  Card: "CardView",
};

/** Whether a collection selects with checkboxes (S2: a selection mode and the `checkbox` style). */
export function catalogCheckboxSelection(
  collection: CatalogConsumerNode,
): boolean {
  const mode = collection.props.selectionMode;
  // (No style = S2's `checkbox` — every collection, the Tree too since 2026-11-18 §7-5.)
  const style = collection.props.selectionStyle ?? "checkbox";
  return (mode === "single" || mode === "multiple") && style === "checkbox";
}

/**
 * A Tree · GridList · CardView item's selection Checkbox is there only while its collection
 * selects with checkboxes (`catalogCheckboxSelection`) — on the Canvas (`catalogHiddenAtRest`)
 * and in the DOM.
 */
export function catalogSelectionCheckboxHidden(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  const item = catalogSelectionCheckboxItem(node, get, typeOf);
  // S2 TableHeader: the selection column heads with a select-all Checkbox only for `multiple`
  // (`single` — a visually hidden label; its column follows `catalogTableSelectionPartHidden`).
  if (item && typeOf(item) === "Column") {
    const table = catalogTableOfColumn(item, get, typeOf);
    return (
      !!table &&
      (table.props.selectionMode !== "multiple" ||
        catalogTableSelectionPartHidden(item, get, typeOf))
    );
  }
  // (A Card's plate is there while its Checkbox is — S2 `CardCheckbox`.)
  if (catalogCardCheckboxCard(node, get, typeOf))
    return node.children.some((id) => {
      const child = get(id);
      return (
        !!child &&
        typeOf(child) === "Checkbox" &&
        catalogSelectionCheckboxHidden(child, get, typeOf)
      );
    });
  // (A standalone Card's — no RAC item, no selection: S2 draws `CardCheckbox` only in a CardView.)
  if (!item && typeOf(node) === "Checkbox" && node.props.slot === "selection") {
    let parent = get(node.parentId);
    while (parent && typeOf(parent) === "frame") parent = get(parent.parentId);
    if (parent && typeOf(parent) === "Card") return true;
  }
  const collectionType = item && CHECKBOX_SELECTION_COLLECTIONS[typeOf(item)];
  if (!item || !collectionType) return false;
  const collection = catalogCollectionOfItem(item, get, typeOf);
  return (
    !collection ||
    typeOf(collection) !== collectionType ||
    !catalogCheckboxSelection(collection)
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

/** The rows of the Table a Column heads, and how many of them start selected (`isSelected`). */
function catalogTableSelectedRows(
  column: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): { total: number; selected: number } | undefined {
  const table = catalogTableOfColumn(column, get, typeOf);
  if (!table) return undefined;
  const rows = catalogTableRows(table, get, typeOf);
  const keys = catalogGroupSelection(table, get, typeOf);
  return {
    total: rows.length,
    selected: rows.filter((row) =>
      catalogKeysHold(keys, catalogItemKey(row, typeOf)),
    ).length,
  };
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
  return cursor && item.owners.includes(typeOf(cursor)) ? cursor : undefined;
}

/**
 * The CardView a Card is an item of — S2 `InternalCardViewContext`: the view's RAC GridListItem —
 * by the collection table (`COLLECTION_ITEM_OWNERS`). The Canvas (`_inCardView` · slot contexts)
 * and the DOM (the GridListItem · its key) read this one predicate.
 */
export function catalogCardViewOf(
  card: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(card) !== "Card") return undefined;
  const view = catalogCollectionOfItem(card, get, typeOf);
  return view && typeOf(view) === "CardView" ? view : undefined;
}

/** Items whose selection a collection record decides (`catalogCollectionItemSelected`). */
function catalogCollectionItems(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const type = typeOf(owner);
  if (!isItemCollection(type)) return [];
  const items: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of childrenOf(node, get)) {
      const childType = typeOf(child);
      if (isCollectionItemOf(childType, type)) items.push(child);
      if (isCollectionWrapperOf(childType, type)) visit(child);
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
  "Cascader",
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
  // (S2 체크리스트 §4.1 TokenField Phase 4: S2 TextArea's HelpText — RAC TokenField has no FieldError
  //  context, so the DOM draws the error text itself, `CatalogTokenFieldError`.)
  "TokenField",
]);
/**
 * Owners whose error part follows their `isInvalid` — the fields, and the S2 TagGroup (its error
 * text is the S2 `HelpText`'s, shown while invalid; RAC's TagGroup has no validation — 2026-10-09).
 */
const ERROR_HINT_OWNERS: ReadonlySet<string> = new Set([
  ...FIELD_HINT_OWNERS,
  "TagGroup",
]);
/**
 * ADR-322 Phase 4 — a valid Cascader whose items repeat a key shows its notice in the Description's
 * place (`cascaderNotice`), with or without a description.
 */
function catalogCascaderNoticeShown(
  field: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  return (
    typeOf(field) === CASCADER_TYPE &&
    field.props.isInvalid !== true &&
    cascaderNotice(cascaderTableOf(field, get, typeOf)) !== undefined
  );
}

/** Whether a field's hint part (`Description` · `FieldError`) shows; `undefined` = not one. */
export function catalogFieldHintShown(
  type: string,
  field: CatalogConsumerNode,
  fieldType: string,
): boolean | undefined {
  if (fieldType === "TagGroup")
    return type === "FieldError"
      ? field.props.isInvalid === true &&
          !!String(field.props.errorMessage ?? "")
      : undefined;
  if (!FIELD_HINT_OWNERS.has(fieldType)) return undefined;
  if (type === "Description")
    return field.props.isInvalid === true
      ? false
      : NODE_TREE_FIELDS.has(fieldType)
        ? undefined
        : !!String(field.props.description ?? "");
  if (type === "FieldError")
    return (
      field.props.isInvalid === true && !!String(field.props.errorMessage ?? "")
    );
  return undefined;
}

/**
 * Whether a node is absent by a value — it has no text to show — rather than by a state RAC
 * changes (a closed overlay, an unselected panel, a valid field's error): a `presentWhen` part
 * with empty text, a field's Description without `description`, its FieldError without
 * `errorMessage`. Nothing renders it until the value is written, so the Layers tree leaves it out.
 */
export function catalogAbsentByOwnerValue(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (
    catalogAbsentByValue(node) ||
    catalogFieldLabelPartsHidden(node, get, typeOf) ||
    catalogFieldLabelRowAbsent(node, get, typeOf) ||
    catalogPickerTimeAbsent(node, get, typeOf)
  )
    return true;
  if (catalogPickerSelectionHidden(node, get, typeOf)) return true;
  const type = typeOf(node);
  if (type !== "Description" && type !== "FieldError") return false;
  const field = catalogPartParent(node, get, typeOf);
  if (!field) return false;
  const fieldType = typeOf(field);
  if (type === "FieldError")
    return (
      ERROR_HINT_OWNERS.has(fieldType) &&
      !String(field.props.errorMessage ?? "")
    );
  if (catalogCascaderNoticeShown(field, get, typeOf)) return false;
  return (
    FIELD_HINT_OWNERS.has(fieldType) &&
    !NODE_TREE_FIELDS.has(fieldType) &&
    !String(field.props.description ?? "")
  );
}

/**
 * A TagGroup's S2 `groupActionLabel` (`TagGroup.tsx` `ActionGroup`): the label of the action button
 * after its tags — empty = no button. The Canvas (`settleTagRows`) and the DOM (`TagListRun`) read
 * this one value.
 */
export function catalogTagGroupActionLabel(
  props: Readonly<Record<string, unknown>>,
): string {
  return typeof props.groupActionLabel === "string"
    ? props.groupActionLabel
    : "";
}

/**
 * ADR-256 Decision 7 — a node whose value condition (`presentWhen: "nonEmptyText"`) does not hold:
 * its final text (`String(value ?? "")`, every binding substituted — no trim) is empty and it
 * holds no child nodes. The Canvas and the DOM read this one predicate.
 */
export function catalogAbsentByValue(node: CatalogConsumerNode): boolean {
  // (The final text: a derived one — a Cascader's notice in its Description — stands for the bound.)
  const derived = node.derivedProps?.children;
  return (
    node.presentWhen === "nonEmptyText" &&
    node.children.length === 0 &&
    String(
      (typeof derived === "string" ? derived : undefined) ??
        node.props.children ??
        "",
    ).length === 0
  );
}

/**
 * Whether a collection holds an item — what RAC's `collection.size` counts: its `item` nodes (a
 * section's included), not a loader · Header · Separator. The resolved children: a bound
 * collection's rows (none while its data is empty).
 */
export function catalogCollectionHasItems(
  collection: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  // (A Table's items are its body's rows — its empty state is the Table's child, S2 TableBody's.)
  if (typeOf(collection) === "Table") {
    const body = collection.children
      .map(get)
      .find((child) => child && typeOf(child) === "TableBody");
    return !!body && catalogCollectionHasItems(body, get, typeOf);
  }
  const items = RAC_COLLECTION_CHILD_TYPES[typeOf(collection)] ?? [];
  return collection.children.some((id) => {
    const child = get(id);
    if (!child) return false;
    const type = typeOf(child);
    // (A CardView's SkeletonCollection is its loading items — RAC counts it only while loading.)
    if (
      !items.includes(type) ||
      type === "Separator" ||
      type === "Header" ||
      type === "SkeletonCollection"
    )
      return false;
    return type.endsWith("Section")
      ? catalogCollectionHasItems(child, get, typeOf)
      : true;
  });
}

const REPEAT_TEMPLATE_BINDINGS: ReadonlySet<string> = new Set([
  "token",
  "calendarcell",
  "calendarheadercell",
  "datesegment",
]);
/** Whether the node itself is not shown in the resting state (its subtree follows it). */
export function catalogHiddenAtRest(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  originBodyOpen?: CatalogOriginBodyOpen,
): boolean {
  // (A CardView's · Table's · Tree's ActionBar counts its collection's selection — S2
  //  `renderActionBar`; `actionBarContainer.ts`.)
  if (
    typeOf(node) === "ActionBar" &&
    catalogActionBarCount(node, get, typeOf) === 0
  )
    return true;
  if (catalogSelectBoxDescriptionHidden(node, get, typeOf)) return true;
  // (ADR-326 Phase 4 · 5 — a Cascader's items: its just-opened screen (`catalogCascaderItemRow` —
  //  `columns` the first level, `tree` the start value's expanded branches, `drill` the open level),
  //  a `drill` path item's own parts, a leaf's row no chevron (a `tree` row keeps its room).)
  //  (A drawn item still takes the shared checks below — its `showWhen` among them.)
  if (
    typeOf(node) === CASCADER_ITEM_TYPE &&
    catalogCascaderItemHidden(node, get, typeOf)
  )
    return true;
  if (catalogCascaderPassPartHidden(node, get, typeOf)) return true;
  // (A `drill` level's own row — 「<branch> 전체」 — has no chevron.)
  if (catalogCascaderOwnRowPart(node, get, typeOf, "en")?.hidden) return true;
  if (catalogCascaderChevronHidden(node, get, typeOf)) return true;
  // (사용자 결정 2026-11-29 — a branch row's item count: a leaf · a level not read yet draws none.)
  if (catalogCascaderCount(node, get, typeOf) === 0) return true;
  // (ADR-326 Phase 5 — a `drill` trail's crumb positions without a path crumb.)
  if (catalogCascaderTrailCrumb(node, get, typeOf) === undefined) return true;
  // (사용자 결정 2026-11-29 — the top level draws no trail and no 「Back」: the reference's head row.)
  if (catalogCascaderTrailHidden(node, get, typeOf)) return true;
  if (catalogCascaderBackHidden(node, get, typeOf)) return true;
  // (ADR-322 Phase 4 — a Cascader's Description carries its repeated-key notice, description or not.)
  if (typeOf(node) === "Description") {
    const field = catalogPartParent(node, get, typeOf);
    if (field && catalogCascaderNoticeShown(field, get, typeOf)) return false;
  }
  // (S2 Column `menuItems` — a Column's MenuItem is its closed menu's item, §9.2.)
  if (typeOf(node) === "MenuItem") {
    const parent = get(node.parentId);
    if (parent && typeOf(parent) === "Column") return true;
  }
  // A glyph whose icon name has no path data (an origin's unfilled `{icon}` placeholder): the DOM
  // `Icon` renders nothing for it (as the old Skia icon shape drew nothing), so no box either.
  if (
    (node.bindingId === "icon" || node.bindingId === "illustration") &&
    node.props.iconName !== undefined &&
    !getIconData(String(node.props.iconName))
  )
    return true;
  if (
    catalogAbsentByValue(node) ||
    catalogFieldLabelPartsHidden(node, get, typeOf) ||
    catalogFieldLabelRowAbsent(node, get, typeOf) ||
    catalogPickerTimeAbsent(node, get, typeOf)
  )
    return true;
  if (catalogActionButtonPartAbsent(node, get, typeOf)) return true;
  if (catalogImageFallbackHidden(node, get, typeOf)) return true;
  // (S2 체크리스트 §9.3 — a Select's value shape: nothing selected, or a copy of an item not selected.)
  if (catalogValueTemplateHidden(node, get, typeOf)) return true;
  // (S2 체크리스트 §9.3 — an editable cell's Form: S2 `EditableCell`'s popover, closed at rest — the
  //  Canvas never opens it.)
  if (catalogEditableCellForm(node, get, typeOf)) return true;
  // 닫힌 overlay의 화살표만 숨긴다. 열린 portal에서는 부모 배치가 좌표를 제공한다.
  if (node.bindingId === "overlayarrow") {
    const parent = get(node.parentId);
    return !parent || !catalogOverlayOpen(parent, get, typeOf);
  }
  // ADR-256 Phase 9 (Decision 13): a calendar grid's cell · weekday cell and a date input's segment
  // are the templates RAC draws per date · weekday · segment — the Canvas grid and date input draw
  // them from the model, the template node has no box of its own.
  if (node.bindingId && REPEAT_TEMPLATE_BINDINGS.has(node.bindingId))
    return true;
  if (catalogProgressValueHidden(node, get, typeOf)) return true;
  if (catalogStepperHidden(node, get, typeOf)) return true;
  if (catalogPickerSelectionHidden(node, get, typeOf)) return true;
  // ADR-257 Phase 3: a highlight-selection Table has no selection checkbox column (S2).
  if (catalogTableSelectionPartHidden(node, get, typeOf)) return true;
  // ADR-315 Phase 4: a Column 「Hidden by default」 and its Cells — records the Builder keeps
  // (the author selects the Column in Layers), drawn nowhere (`catalogProjectTableColumns`).
  if (node.props[CATALOG_COLUMN_HIDDEN_PROP] === true) return true;
  // S2 `ColumnWithMenu`: a Column's ⋮ only while it has its menu.
  if (catalogColumnMenuIconHidden(node, get, typeOf)) return true;
  // A Tree · GridList · CardView item's selection Checkbox only for checkbox selection (S2).
  if (catalogSelectionCheckboxHidden(node, get, typeOf)) return true;
  // S2 Dialog `isDismissible`: its close button replaces its ButtonGroup (2026-11-18).
  if (catalogDismissibleDialogOf(node, get, typeOf)) return true;
  // S2 Menu Divider: none first, last or before another (2026-11-18).
  if (catalogCollectionSeparatorHidden(node, get, typeOf)) return true;
  // A Pagination's first · last page and gaps: around its page window (2026-11-19).
  if (catalogPaginationPartHidden(node, get, typeOf)) return true;
  // ADR-256 Decision 7: a node is there only in the states its `showWhen` names.
  if (node.showWhen && !catalogShowWhenHolds(node, get, typeOf)) return true;
  // ADR-256 Phase 5e: RAC's `SelectionIndicator` is there while its item is selected (its
  // `SelectionIndicatorContext` — the item's `isSelected`).
  if (typeOf(node) === "SelectionIndicator") {
    const item = catalogStateOwner(node, "isSelected", undefined, get, typeOf);
    return !item || !catalogIndicatorItemSelected(item, get, typeOf);
  }
  const parent = get(node.parentId);
  if (!parent) return false;
  const type = typeOf(node);
  const parentType = typeOf(parent);
  // RAC `renderEmptyState` (2026-10-23): a collection's IllustratedMessage is drawn while it has no
  // items.
  if (catalogIsEmptyState(type, parentType))
    return catalogCollectionHasItems(parent, get, typeOf);
  // (A closed overlay keeps its trigger owner through a layout frame — RAC's `PopoverContext`
  // reaches it there, `catalogPartParent`.)
  const partParent = catalogPartParent(node, get, typeOf);
  if (
    OVERLAY_BODY_TYPES.has(type) ||
    (type === "Dialog" && parentType === "DialogTrigger")
  ) {
    const owner = catalogOverlayOwner(node, get, typeOf);
    const originOpen =
      owner &&
      OPEN_BODY_TRIGGERS.has(typeOf(owner)) &&
      originBodyOpen?.(owner) === true;
    return !(
      node.displayState === "open" ||
      originOpen ||
      catalogOverlayOpen(node, get, typeOf)
    );
  }
  // (A hint part keeps its field through a layout frame — `catalogPartParent`.)
  const hintField = partParent;
  const hint =
    hintField && catalogFieldHintShown(type, hintField, typeOf(hintField));
  if (hint !== undefined) return !hint;
  const field = catalogSearchFieldOfClear(node, get, typeOf);
  if (field)
    return (
      !field.props.value ||
      field.props.isReadOnly === true ||
      catalogCascaderSearchField(field, get, typeOf)
    );
  // ADR-300: a closed item's child items · a collapsed panel's row text · chevrons · headers.
  if (catalogSideNavHidden(node, get, typeOf)) return true;
  if (type === "TreeItem" && parentType === "TreeItem")
    return !catalogTreeItemExpanded(parent, get, typeOf);
  // ADR-256 Phase 5h: an item without child items hides its chevron button (`Tree.css`
  // `visibility: hidden` — the box stays, the glyph is not drawn).
  const chevronItem = catalogTreeChevronGlyphItem(node, get, typeOf);
  if (chevronItem) return !treeItemHasChildItems(chevronItem, get, typeOf);
  // RAC shows a Disclosure's panel while it is expanded (ADR-256 Phase 8c — its other children,
  // the trigger Heading among them, stay).
  if (type === "DisclosurePanel") {
    const disclosure = catalogPartParent(node, get, typeOf);
    if (disclosure && typeOf(disclosure) === "Disclosure")
      return !catalogDisclosureExpanded(disclosure, get, typeOf);
  }
  // ADR-321 Phase 3: a Stepper draws its current step's panel only.
  if (type === STEP_PANEL_TYPE)
    return catalogStepPanelWaiting(node, get, typeOf);
  if (type === "TabPanel") {
    const tabs =
      parentType === "Tabs" ? parent : catalogPartParent(parent, get, typeOf);
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
 * The field that owns `node` as its Input: a SearchField's own child (ADR-256 G5 example 5 — no
 * control Group), a NumberField's in its control Group.
 */
export function catalogFieldOfInput(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Input") return;
  const field = triggerOwner(node, get, typeOf);
  return field && TEXT_INPUT_FIELDS.has(typeOf(field)) ? field : undefined;
}

const TEXT_INPUT_FIELDS = new Set([
  "TextField",
  "TextArea",
  "SearchField",
  "NumberField",
  "ColorField",
  "ComboBox",
]);

/**
 * SearchField's clear button (the Button instance in its control Group — S2 `FieldGroup`, 2026-11-13):
 * RAC marks the field `data-empty` while its value (`value`, the renderer's `defaultValue`) is
 * empty. S2 also omits the button while read-only. The field's generated stylesheet consumes
 * RAC's `data-empty` / `data-readonly` for live DOM state; Canvas uses the same authored states.
 * Returns the owning field for that node.
 */
function catalogSearchFieldOfClear(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Button") return;
  // (In S2's `FieldGroup` — the field's control Group, 2026-11-13.)
  const field = triggerOwner(node, get, typeOf);
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
  // (ADR-308: `expandedKeys`, else `defaultExpandedKeys` — `catalogGroupExpansion`.)
  return catalogGroupExpansion(cursor, typeOf).includes(
    catalogItemKey(item, typeOf),
  );
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
  // ADR-300: a panel's collapse · a nav's expanded keys decide its parts' presence.
  if (typeOf(node) === "SideNavPanel" || typeOf(node) === "SideNav")
    return node;
  if (typeOf(node) === "SideNavItem" || typeOf(node) === "SideNavSection")
    return (
      catalogSideNavOf(node, get, typeOf) ??
      catalogSideNavPanelOf(node, get, typeOf)
    );
  if (typeOf(node) === "Accordion") return node;
  // A field's label row follows its Label's text (S2 `FieldLabel` — `catalogFieldLabelRowAbsent`).
  if (typeOf(node) === "Label") {
    const row = get(node.parentId);
    if (row && typeOf(row) === "FieldLabel") return row;
  }
  // (2026-11-14) An ActionButton's icon · avatar · count badge follow its values and each other
  //   (`catalogActionButtonPartAbsent`).
  if (typeOf(node) === "ActionButton") return node;
  if (["Icon", "Avatar", "Badge"].includes(typeOf(node))) {
    const button = get(node.parentId);
    if (button && typeOf(button) === "ActionButton") return button;
  }
  // A Table's selection column follows its `selectionStyle` (ADR-257 Phase 3).
  if (typeOf(node) === "Table") return node;
  // A GridList's · CardView's item selection Checkboxes follow its selection mode · style (S2).
  if (typeOf(node) === "GridList" || typeOf(node) === "CardView") return node;
  // A Dialog's ButtonGroup follows its `isDismissible` (S2, 2026-11-18).
  if (typeOf(node) === "Dialog") return node;
  // A ProgressBar's · Meter's value text follows its `label` · `isIndeterminate` (S2), a Slider's its
  //   `showValueLabel` (ADR-256 Phase 7a).
  if (PROGRESS_VALUES[typeOf(node)]) return node;
  // Which crumb is current (its separator hidden) follows the Breadcrumbs' crumb list.
  if (typeOf(node) === "Breadcrumbs") return node;
  if (typeOf(node) === "Breadcrumb") {
    const owner = get(node.parentId);
    if (owner && typeOf(owner) === "Breadcrumbs") return owner;
  }
  if (typeOf(node) === "Disclosure")
    return catalogAccordionOf(node, get, typeOf) ?? node;
  // ADR-321 Phase 3: a Stepper's panels follow its StepList's current step (the list's keys, its
  //   Steps' keys · disabled flags) and their own keys.
  if (typeOf(node) === STEPPER_TYPE) return node;
  if (typeOf(node) === STEP_LIST_TYPE || typeOf(node) === STEP_PANEL_TYPE) {
    const stepper = catalogStepperOf(node, get, typeOf);
    if (stepper) return stepper;
  }
  if (typeOf(node) === STEP_TYPE) {
    const list = get(node.parentId);
    const stepper =
      list && typeOf(list) === STEP_LIST_TYPE
        ? catalogStepperOf(list, get, typeOf)
        : undefined;
    if (stepper) return stepper;
  }
  let cursor: CatalogConsumerNode | undefined = node;
  for (let depth = 0; cursor && depth < 3; depth++) {
    const type = typeOf(cursor);
    if (type === "Tabs" || type === "SearchField") return cursor;
    // A field's hint parts follow its `description` · `isInvalid` · `errorMessage`.
    if (depth === 0 && ERROR_HINT_OWNERS.has(type)) return cursor;
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
  if (typeOf(scope) === "SideNavPanel" || typeOf(scope) === "SideNav")
    return catalogSideNavDependents(scope, get, typeOf);
  if (typeOf(scope) === "FieldLabel") return [scope];
  if (typeOf(scope) === "GridList" || typeOf(scope) === "CardView")
    return catalogCollectionItems(scope, get, typeOf).flatMap((item) => [
      ...catalogSelectionCheckboxes(item, get, typeOf),
      // (a Card's checkbox plate — S2 `CardCheckbox`)
      ...childrenOf(item, get).filter(
        (child) => !!catalogCardCheckboxCard(child, get, typeOf),
      ),
    ]);
  if (typeOf(scope) === "Table")
    return [
      ...catalogTableSelectionParts(scope, get, typeOf),
      // (its select-all Checkbox is there only for `multiple` — S2 TableHeader)
      ...catalogTableSelectAllCheckboxes(scope, get, typeOf),
    ];
  if (typeOf(scope) === "Dialog")
    return partChildrenOf(scope, get, typeOf).filter(
      (child) => typeOf(child) === "ButtonGroup",
    );
  if (typeOf(scope) === "ActionButton")
    return childrenOf(scope, get).filter((child) =>
      ["Icon", "Avatar", "Badge"].includes(typeOf(child)),
    );
  const valueType = PROGRESS_VALUES[typeOf(scope)];
  if (valueType)
    return partChildrenOf(scope, get, typeOf).filter(
      (child) => typeOf(child) === valueType,
    );
  if (typeOf(scope) === STEPPER_TYPE)
    return catalogStepperModel(scope, get, typeOf).panels;
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
  if (typeOf(scope) === "Disclosure" || typeOf(scope) === "Accordion")
    return (
      typeOf(scope) === "Disclosure"
        ? [scope]
        : catalogGroupDisclosures(scope, get, typeOf).disclosures
    ).flatMap((disclosure) =>
      partChildrenOf(disclosure, get, typeOf).filter(
        (child) => typeOf(child) === "DisclosurePanel",
      ),
    );
  if (ERROR_HINT_OWNERS.has(typeOf(scope)))
    return [
      ...partChildrenOf(scope, get, typeOf).filter((child) =>
        ["Description", "FieldError"].includes(typeOf(child)),
      ),
      // (a picker's time fields follow its granularity — S2 `showTimeField`)
      ...(PICKER_TYPES.has(typeOf(scope))
        ? pickerTimeParts(scope, get, typeOf)
        : []),
      // (S2 체크리스트 §9.3: a Select's selection shows its value shape's nodes — its copies.)
      ...(typeOf(scope) === "Select"
        ? catalogValueTemplateNodes(scope, get, typeOf)
        : []),
      ...(typeOf(scope) === "SearchField"
        ? partChildrenOf(scope, get, typeOf)
            .flatMap((child) =>
              typeOf(child) === "Group"
                ? partChildrenOf(child, get, typeOf)
                : [child],
            )
            .filter((button) => catalogSearchFieldOfClear(button, get, typeOf))
        : []),
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
          ...catalogSelectionCheckboxes(child, get, typeOf),
        );
        visit(child);
      }
  };
  visit(scope);
  return items;
}

/** RAC's `roundToStepPrecision` (react-stately `utils/number`): the step's decimal places. */
function roundToStepPrecision(value: number, step: number): number {
  const text = step.toString();
  const exponent = text.toLowerCase().indexOf("e-");
  const point = text.indexOf(".");
  const precision =
    exponent > 0
      ? Math.abs(Math.floor(Math.log10(Math.abs(step)))) + exponent
      : point >= 0
        ? text.length - point
        : 0;
  if (precision <= 0) return value;
  const pow = Math.pow(10, precision);
  return Math.round(value * pow) / pow;
}

/**
 * RAC's `snapValueToStep` (react-stately `utils/number`, which `useSliderState` and
 * `useNumberFieldState` apply to the value): the nearest step from the minimum (half up — from 0
 * without one), inside the range — past the maximum, the last step that fits. An unset bound is
 * `NaN` (RAC `Number(undefined)`).
 */
function snapValueToStep(
  value: number,
  min: number,
  max: number,
  step: number,
): number {
  const remainder = (value - (Number.isNaN(min) ? 0 : min)) % step;
  let snapped = roundToStepPrecision(
    Math.abs(remainder) * 2 >= step
      ? value + Math.sign(remainder) * (step - Math.abs(remainder))
      : value - remainder,
    step,
  );
  if (!Number.isNaN(min)) {
    if (snapped < min) snapped = min;
    else if (!Number.isNaN(max) && snapped > max)
      snapped =
        min + Math.floor(roundToStepPrecision((max - min) / step, step)) * step;
  } else if (!Number.isNaN(max) && snapped > max)
    snapped = Math.floor(roundToStepPrecision(max / step, step)) * step;
  return roundToStepPrecision(snapped, step);
}

/**
 * A NumberField's document value as a number — `undefined` when empty or not a number (S2: no
 * value is an empty input, RAC `NaN`). The Value prop is text in the Design panel.
 */
export function catalogNumberFieldValue(value: unknown): number | undefined {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

/**
 * The text RAC's NumberField starts its input with (`useNumberFieldState`): the value snapped to
 * the range and step (`commitBehavior` 'snap' — only clamped without a step), in the locale's number
 * format with the field's `formatOptions` (`NumberFormatter`). Empty without a value.
 */
export function catalogNumberFieldText(
  field: CatalogConsumerNode,
  locale?: string,
): string {
  const value = catalogNumberFieldValue(field.props.value);
  if (value === undefined) return "";
  const bound = (key: string) => {
    const raw = field.props[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : Number.NaN;
  };
  const min = bound("minValue");
  const max = bound("maxValue");
  const step = bound("step");
  const snapped = !Number.isNaN(step)
    ? snapValueToStep(value, min, max, step)
    : Math.min(
        Number.isNaN(max) ? Infinity : max,
        Math.max(Number.isNaN(min) ? -Infinity : min, value),
      );
  const own = typeof field.props.locale === "string" ? field.props.locale : "";
  return new NumberFormatter(
    own || locale || globalThis.navigator?.language || "en-US",
    catalogNumberFormatOptions(field.props.formatOptions),
  ).format(snapped);
}

/**
 * A Slider's value and range as RAC reads them (`value` · `defaultValue`, else the middle),
 * snapped to its `step` as RAC's slider state does (ADR-256 후속 12).
 */
export function catalogSliderRange(slider: CatalogConsumerNode): {
  min: number;
  max: number;
  value: number;
} {
  const number = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const min = number(slider.props.minValue, 0);
  const max = number(slider.props.maxValue, 100);
  const step = number(slider.props.step, 1);
  const raw = number(
    slider.props.value ?? slider.props.defaultValue,
    (min + max) / 2,
  );
  const value = step > 0 ? snapValueToStep(raw, min, max, step) : raw;
  return { min, max, value };
}

/**
 * S2 1.8.2 Slider · RangeSlider value text width in characters (`Slider.tsx` `maxLabelLength` — the
 * SliderOutput is `${n}ch` wide with tabular digits, so the text does not move as the value
 * changes): the longer of the min and max formatted (a RangeSlider's: the ranges `[min, min + step]`
 * and `[max - step, max]`), counted in code points.
 */
function catalogSliderValueChars(
  slider: CatalogConsumerNode,
  range: boolean,
  locale?: string,
): number {
  const own =
    typeof slider.props.locale === "string" ? slider.props.locale : "";
  const formatter = new NumberFormatter(
    own || locale || globalThis.navigator?.language || "en-US",
    catalogNumberFormatOptions(slider.props.formatOptions),
  );
  const { min, max } = catalogSliderRange(slider);
  const length = (text: string) => [...text].length;
  if (!range)
    return Math.max(
      length(formatter.format(min)),
      length(formatter.format(max)),
    );
  const step = Number(slider.props.step) || 1;
  return Math.max(
    length(formatter.formatRange(min, min + step)),
    length(formatter.formatRange(max - step, max)),
  );
}

/** Whether `node` sits in its Slider's label container (past the author's frames). */
function catalogInLabelContainer(
  node: CatalogConsumerNode,
  slider: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  for (
    let cursor = get(node.parentId);
    cursor && cursor.id !== slider.id;
    cursor = get(cursor.parentId)
  )
    if (typeOf(cursor) === "SliderLabelContainer") return true;
  return false;
}

/**
 * The SliderTrack holding `node` — a SliderTrackBar · SliderThumb in it, or a SliderFill in its bar
 * (S2 `track > upperTrack > SliderFill`, 2026-11-18; a fill straight in the track too), past the
 * layout frames the author puts around a part (`catalogPartParent`).
 */
function catalogSliderTrackOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const parent = catalogPartParent(node, get, typeOf);
  const track =
    parent && typeOf(parent) === "SliderTrackBar"
      ? catalogPartParent(parent, get, typeOf)
      : parent;
  return track && typeOf(track) === "SliderTrack" ? track : undefined;
}

/** The parts of a Slider's track — its bars, the fills in them and its thumbs (`catalogSliderTrackOf`). */
function catalogSliderTrackParts(
  track: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return partChildrenOf(track, get, typeOf).flatMap((child) =>
    typeOf(child) === "SliderTrackBar"
      ? [child, ...partChildrenOf(child, get, typeOf)]
      : [child],
  );
}

/**
 * The Slider whose track holds `node` — a SliderTrackBar, SliderFill or SliderThumb
 * (`catalogSliderTrackOf`).
 */
function catalogSliderOfTrackPart(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const type = node.ruleId ?? typeOf(node);
  if (!["SliderFill", "SliderThumb", "SliderTrackBar"].includes(type))
    return undefined;
  const track = catalogSliderTrackOf(node, get, typeOf);
  const slider = track ? catalogPartParent(track, get, typeOf) : undefined;
  return slider && ["Slider", "RangeSlider"].includes(typeOf(slider))
    ? slider
    : undefined;
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
  const slider = catalogSliderOfTrackPart(node, get, typeOf);
  if (!slider) return undefined;
  const { min, max, value } = catalogSliderRange(slider);
  const ratio = (at: number): number =>
    max > min ? Math.min(1, Math.max(0, (at - min) / (max - min))) : 0;
  // S2 `fillOffset` — the fill runs between the offset and the value (RAC `SliderFill` clamps
  // the offset to the range; absent = the minimum).
  const range =
    typeOf(slider) === "RangeSlider"
      ? catalogRangeValue(
          slider.props.value,
          min,
          max,
          Number(slider.props.step ?? 1),
        )
      : undefined;
  const raw = Number(slider.props.fillOffset);
  const offset =
    range?.start ??
    (Number.isFinite(raw) ? Math.min(Math.max(raw, min), max) : min);
  const upper = range?.end ?? value;
  const start = Math.min(ratio(offset), ratio(upper));
  const end = Math.max(ratio(offset), ratio(upper));
  // (RAC `SliderFill` sets no `top` — the fill keeps its static position, the top of the box it
  // sits in; G5 example 12: in a frame the track's top is not the frame's.)
  return {
    position: "absolute",
    insetLeft: `${start * 100}%`,
    width: `${(end - start) * 100}%`,
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
  // (Through the layout frames the author puts around a part — `catalogPartParent`.)
  const track = catalogSliderTrackOf(node, get, typeOf);
  const slider = catalogSliderOfTrackPart(node, get, typeOf);
  if (!track || !slider) return undefined;
  const number = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const { min, max, value } = catalogSliderRange(slider);
  const index = Number(
    node.props.index ??
      node.props._thumbIndex ??
      partChildrenOf(track, get, typeOf)
        .filter((child) => typeOf(child) === "SliderThumb")
        .findIndex((child) => child.id === node.id),
  );
  const range =
    typeOf(slider) === "RangeSlider"
      ? catalogRangeValue(
          slider.props.value,
          min,
          max,
          Number(slider.props.step ?? 1),
        )
      : undefined;
  const position = range ? (index === 1 ? range.end : range.start) : value;
  const ratio =
    max > min ? Math.min(1, Math.max(0, (position - min) / (max - min))) : 0;
  const size = number(node.visual.height ?? node.visual.width, 18);
  // S2 `thumbStyle: precise` — a narrow bar (width 6, size + 2 tall — S2 Slider.tsx thumb).
  const precise = slider.props.thumbStyle === "precise";
  // (The rule gives one side — the circle; a written width is the DOM's inline width too.)
  const width = precise ? catalogScaledPx(6) : number(node.visual.width, size);
  const height = precise ? size + catalogScaledPx(2) : size;
  // (Centered across the track row — S2 `thumbContainer` `top: 50%` · `translate(-50%, -50%)`.)
  const trackHeight = number(track.visual.height, height);
  return {
    position: "absolute",
    insetLeft: `${ratio * 100}%`,
    insetTop: `${(trackHeight - height) / 2}px`,
    marginLeft: `${-width / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
}

/**
 * S2 1.8.0 Slider `trackStyle: 'thick'` (2026-10-10): the bar is 16px with the S2 sm corner (S2
 * `trackStyling` — thin 4 · thick 16, radius sm). The Canvas height (`styleOf`) and the DOM
 * track inline (`domBinding`) read this one value; the Canvas paint radius is the SliderTrack
 * rule's `containerVariants["track-style"]` (the same 4px).
 */
export const CATALOG_SLIDER_THICK_TRACK = { height: 16, radius: 4 } as const;

/**
 * ADR-295 후속 — an S2 fixed sizing number (`size(n)` — rem × `--s2-scale`) in the installed maps: n × the
 * device unit `{size.unit}` (desktop 1 — the Canvas; the G2 harness's touch arm 1.25). The DOM writes the same
 * number as `catalogDeviceScaledCss`.
 */
export function catalogScaledPx(px: number): number {
  const unit = resolveToken("{size.unit}" as TokenRef);
  return px * (typeof unit === "number" ? unit : 1);
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
  /** A wrapper laid out even with nothing to wrap (a page body's content). */
  readonly standsEmpty?: boolean;
}

/**
 * `Tree.css` chevron button: `width: 40px + indent` with `padding-left: indent`, indent =
 * `(level − 1) × 16px` — S2 TreeView's `level-padding` column (`--indent: 16`) before the expand button
 * (`expandButton` 40 × 40). Both are S2 sizing numbers (`size()` — touch × 1.25): the Canvas reads
 * them through `catalogScaledPx`, the DOM writes `catalogTreeChevronDeviceBox` inline (ADR-295 후속 B2).
 */
const TREE_CHEVRON_WIDTH = 40;
const TREE_LEVEL_PADDING = 16;

/** The chevron button's S2 width · level indent px at `level` (desktop numbers — callers scale them). */
export function catalogTreeChevronBox(level: number): {
  readonly width: number;
  readonly indent: number;
} {
  const indent = (level - 1) * TREE_LEVEL_PADDING;
  return { width: TREE_CHEVRON_WIDTH + indent, indent };
}
/**
 * The chevron glyph's box: the button's content height — its Icon, the Button rule's size-S icon (the
 * chevron Button is size S — S2 `1lh` of its font since ADR-295 Phase 3c: 16 desktop · 18 touch). A
 * leaf item's hidden glyph keeps its box in the DOM (`visibility: hidden`), so the Canvas floor reads
 * the same token in the installed maps (Phase 3b · 3c).
 */
const treeChevronIcon = (): number =>
  Number(
    resolveToken(
      COMPONENT_RULES_TABLE.Button!.sizes.S!.iconSize as unknown as TokenRef,
    ),
  );

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
function treeChevronStyle(level: number): Record<string, string | number> {
  const box = catalogTreeChevronBox(level);
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: `${catalogScaledPx(box.width)}px`,
    height: "100%",
    minHeight: `${treeChevronIcon()}px`,
    paddingLeft: `${catalogScaledPx(box.indent)}px`,
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
 * The disabled TreeItem whose row label `node` is (a Text in its `TreeItemContent`, through frames) —
 * S2 TreeView `treeRow` `isDisabled: gray-400`: the label takes the row's disabled color (the TreeItem
 * rule's `isDisabled` paint), as the `Tree` sheet's `[data-disabled] .react-aria-Text`. Undefined for
 * an enabled row — the label keeps its own color there.
 */
export function catalogDisabledTreeItemLabelItem(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Text") return undefined;
  const content = catalogPartParent(node, get, typeOf);
  if (!content || typeOf(content) !== "TreeItemContent") return undefined;
  const item = get(content.parentId);
  if (!item || typeOf(item) !== "TreeItem") return undefined;
  // (Its own `isDisabled`, or its Tree's `disabledKeys` naming it — 부록 D.3 2단계.)
  return item.props.isDisabled === true ||
    catalogItemKeyDisabled(item, get, typeOf)
    ? item
    : undefined;
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

/** A sortable Column in a Table's header (`allowsSorting` — RAC's sort operation). */
function sortableTableColumn(
  column: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(column) !== "Column" || column.props.allowsSorting !== true)
    return false;
  const header = get(column.parentId);
  const table = header && get(header.parentId);
  return (
    !!header &&
    typeOf(header) === "TableHeader" &&
    !!table &&
    typeOf(table) === "Table"
  );
}

/**
 * ADR-315 Phase 4 증분 6 — a bound Table record's authored sort as its header shows it: each
 * entry's drawn Column by its RAC key (the key RAC's `sortDescriptor` names — `catalogTableColumnKey`).
 * A Column is matched by its Column key (its authored place's key in the Table's column list, else
 * its own); a hidden one has no header to mark (left out). An entry no authored Column shows ends
 * the list. Undefined = none.
 */
/**
 * ADR-315 Phase 5 — a grouped Table record's `treeColumn`: the RAC key of the header Column its
 * rows expand from (the resolver marks it — `CATALOG_TREE_COLUMN_PROP`); undefined = none.
 */
export function catalogTableTreeColumn(
  table: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string | undefined {
  const column = childrenOf(table, get)
    .filter((child) => typeOf(child) === "TableHeader")
    .flatMap((header) => childrenOf(header, get))
    .find(
      (child) =>
        typeOf(child) === "Column" &&
        child.props[CATALOG_TREE_COLUMN_PROP] === true,
    );
  return column ? catalogTableColumnKey(column) : undefined;
}

export function catalogTableAuthoredSortShown(
  table: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
):
  | readonly { column: string; direction: "ascending" | "descending" }[]
  | undefined {
  const sort = catalogTableAuthoredSort(table.props);
  if (!sort) return undefined;
  const authored = catalogTableColumnEntries(table.props);
  const columns = childrenOf(table, get)
    .filter((child) => typeOf(child) === "TableHeader")
    .flatMap((header) => childrenOf(header, get))
    .filter((child) => typeOf(child) === "Column");
  const keyOf = (column: CatalogConsumerNode, index: number) => {
    const place = column.props[CATALOG_COLUMN_PLACE_PROP];
    const entry =
      typeof place === "number"
        ? authored?.find((item) => item.place === place)
        : undefined;
    return entry?.key ?? resolveTableColumnKey(column.props, index);
  };
  // (The Canvas keeps a hidden Column's record — marked, not drawn: `CATALOG_COLUMN_HIDDEN_PROP`.)
  const drawn = new Map(
    columns.flatMap((column, index) =>
      column.props[CATALOG_COLUMN_HIDDEN_PROP] === true
        ? []
        : [[keyOf(column, index), column] as const],
    ),
  );
  const out: { column: string; direction: "ascending" | "descending" }[] = [];
  for (const entry of sort) {
    const column = drawn.get(entry.column);
    if (!column) {
      if (authored?.some((item) => item.key === entry.column)) continue;
      break;
    }
    out.push({
      column: catalogTableColumnKey(column),
      direction: entry.direction,
    });
  }
  return out.length ? out : undefined;
}

/**
 * A Column's content wrapper — its first frame (S2 `ColumnContents`' `div`, flex · centered · the
 * column's `align` as `justifyContent`).
 */
function catalogColumnContent(
  column: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  return typeOf(column) === "Column"
    ? childrenOf(column, get).find((child) => typeOf(child) === "frame")
    : undefined;
}

/**
 * The sortable Column whose content wrapper `node` is: S2 draws the sort arrow there, before the
 * name, only while the column is sorted (`sortDirection != null`) — the DOM (`CatalogSortIndicator`);
 * the Canvas is never sorted and keeps no box for it.
 */
export function catalogColumnSortContent(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "frame") return undefined;
  const column = get(node.parentId);
  return column &&
    sortableTableColumn(column, get, typeOf) &&
    catalogColumnContent(column, get, typeOf)?.id === node.id
    ? column
    : undefined;
}

/**
 * ADR-315 Phase 4 증분 6 — the sort mark of a sortable Column (S2 `ColumnContents`' sort arrow and
 * our order mark — `CatalogSortIndicator`): one box before the name. Fixed px, as S2's arrow is: the
 * order mark is ours (S2 has no sort of several columns) and does not follow the header's font —
 * the Canvas and the DOM read the same numbers (a frame's font on the Canvas record is not the
 * one the DOM wrapper inherits).
 */
export const CATALOG_SORT_MARK = {
  /** The arrow's square (S2 `sortIcon` — 16). */
  arrow: 16,
  /** The space between the arrow and the order mark. */
  orderGap: 2,
  /** The mark's end margin (S2 `sortIcon` `marginEnd: 8`). */
  end: 8,
  /** The order mark's font size. */
  orderFont: 12,
  /** A digit's advance in the order mark (tabular figures). */
  digit: 7.2,
} as const;
/** The mark box's width: the arrow, and the order mark after it in a sort of several columns. */
export function catalogSortMarkWidth(order: number | undefined): number {
  if (order === undefined) return CATALOG_SORT_MARK.arrow;
  const { arrow, orderGap, digit } = CATALOG_SORT_MARK;
  return arrow + orderGap + String(order).length * digit;
}

/**
 * ADR-315 Phase 4 증분 6 — the authored sort a sortable Column's content wrapper `node` shows (its
 * Table's `catalogTableAuthoredSortShown`): its direction, and its 1-based place in a sort of
 * several columns. The Canvas draws it (HC9 — the authored layer); the DOM shows the run layer's
 * sort, this one until a Table state's stands in.
 */
export function catalogColumnAuthoredSortMark(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): { direction: "ascending" | "descending"; order?: number } | undefined {
  const column = catalogColumnSortContent(node, get, typeOf);
  const header = column && get(column.parentId);
  const table = header && get(header.parentId);
  const shown = table && catalogTableAuthoredSortShown(table, get, typeOf);
  if (!shown) return undefined;
  const key = catalogTableColumnKey(column!);
  const index = shown.findIndex((entry) => entry.column === key);
  return index < 0
    ? undefined
    : {
        direction: shown[index]!.direction,
        ...(shown.length > 1 ? { order: index + 1 } : {}),
      };
}

/**
 * S2 `ColumnWithMenu`: a Column with a menu (`isMenu` — the resolver's `catalogColumnHasMenu`: its
 * resize · hide · pin · filter, its Table's reorder) puts its content in a menu Button ending in a ⋮
 * (`MoreVertical`). The ⋮ Icon of its content wrapper is there only then.
 */
export function catalogColumnMenuIconHidden(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(node) !== "Icon") return false;
  const wrapper = get(node.parentId);
  const column = wrapper && get(wrapper.parentId);
  return (
    !!column &&
    typeOf(column) === "Column" &&
    catalogColumnContent(column, get, typeOf)?.id === wrapper.id &&
    column.props[CATALOG_COLUMN_MENU_PROP] !== true
  );
}

/** S2 `ColumnWithMenu`: the content wrapper `node` of a Column with a menu (`isMenu`). */
export function catalogColumnMenuContent(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(node) !== "frame") return false;
  const column = get(node.parentId);
  return (
    !!column &&
    typeOf(column) === "Column" &&
    column.props[CATALOG_COLUMN_MENU_PROP] === true &&
    catalogColumnContent(column, get, typeOf)?.id === node.id
  );
}

/** A sortable Column without a content wrapper: its sort arrow goes before its content. */
export function catalogColumnSortsInline(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  return (
    sortableTableColumn(node, get, typeOf) &&
    !catalogColumnContent(node, get, typeOf)
  );
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
 * items, expansion). The row's label Texts too — they take a disabled item's color
 * (`catalogDisabledTreeItemLabelItem`, 2026-11-23).
 */
export function catalogTreeChevrons(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  if (typeOf(node) !== "TreeItem") return [];
  const content = catalogTreeItemContent(node, get, typeOf);
  if (!content) return [];
  const row = partChildrenOf(content, get, typeOf);
  return [
    ...row
      .filter((child) => catalogTreeChevronButtonItem(child, get, typeOf))
      .flatMap((button) => [
        button,
        ...partChildrenOf(button, get, typeOf).filter((glyph) =>
          catalogTreeChevronGlyphItem(glyph, get, typeOf),
        ),
      ]),
    ...row.filter((child) => typeOf(child) === "Text"),
  ];
}

/** A chevron button record's TreeItem level; undefined for any other node. */
export function catalogTreeChevronLevel(
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
  const level = catalogTreeChevronLevel(node, get, typeOf);
  return level === undefined ? undefined : treeChevronStyle(level);
}

/**
 * A TreeItem with a row content node, on the Canvas: RAC draws its row and then its child items as
 * the next rows (flat), so the item's box is a column — the row is its `TreeItemContent` (the
 * `Tree.css` row box, `manualBoxRules`) and the child items stack below it (ADR-256 후속 14).
 * Undefined for any other node (an item without a content node keeps the row box itself).
 */
export function catalogTreeItemLayout(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string> | undefined {
  if (!catalogTreeItemContent(node, get, typeOf)) return undefined;
  return {
    flexDirection: "column",
    alignItems: "stretch",
    rowGap: "0px",
    columnGap: "0px",
    paddingTop: "0px",
    paddingRight: "0px",
    paddingBottom: "0px",
    paddingLeft: "0px",
  };
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
const PICKER_TYPES = new Set(["DatePicker", "DateRangePicker"]);
/**
 * What a calendar's model reads (ADR-256 Phase 9): its own duration, weeks and locale; in a picker
 * the picker's first day and bounds (RAC's calendar context — the calendar's own stay unset in
 * the DOM).
 */
function calendarModelInput(
  calendar: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogCalendarModelInput {
  const picker = calendarPicker(calendar, get, typeOf);
  const own = (picker ?? calendar).props;
  const range = typeOf(calendar) === "RangeCalendar";
  // ADR-309 Decision 4 — the value it shows (a picker's calendar: the picker's — RAC's calendar
  // context). The month it opens on: a standalone calendar's own focused date, then the value, then
  // today (F7); a picker's: its value, then its placeholder, then today — RAC gives the calendar
  // the placeholder only while the picker has no value (`useDatePicker` — F15).
  const value = catalogDateStartValue(own);
  const hasValue = range
    ? !!catalogDateRange(value)
    : picker
      ? !!catalogDateValue(value)
      : !!catalogCalendarFirstDate(value);
  return {
    visibleDuration: calendar.props.visibleDuration,
    // (S2 체크리스트 §9.1 — S2 · RAC `selectionAlignment`, the calendar's own.)
    selectionAlignment: calendar.props.selectionAlignment,
    weeksInMonth: calendar.props.weeksInMonth,
    locale: calendar.props.locale,
    calendarSystem: calendar.props.calendarSystem,
    firstDayOfWeek: own.firstDayOfWeek,
    minValue: own.minValue,
    maxValue: own.maxValue,
    value,
    range,
    isInvalid: own.isInvalid,
    // (S2 체크리스트 부록 D.3 — the unavailable dates; a picker's calendar the picker's, as RAC.)
    ...(catalogUnavailableDateTest(own)
      ? { isDateUnavailable: catalogUnavailableDateTest(own) }
      : {}),
    ...(picker
      ? hasValue
        ? {}
        : { defaultFocusedValue: picker.props.placeholderValue }
      : {
          selectionMode: calendar.props.selectionMode,
          defaultFocusedValue: calendar.props.defaultFocusedValue,
        }),
  };
}
/**
 * The picker a calendar opens from: `DatePicker > Popover > Dialog > Calendar` (S2 1.8.2
 * `CalendarPopover`, 2026-11-18) — or the Popover's direct child (ADR-256 Phase 6e's reference).
 */
function calendarPicker(
  calendar: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  let popover = get(calendar.parentId);
  if (popover && typeOf(popover) === "Dialog") popover = get(popover.parentId);
  if (!popover || typeOf(popover) !== "Popover") return undefined;
  const picker = get(popover.parentId);
  return picker && PICKER_TYPES.has(typeOf(picker)) ? picker : undefined;
}

/**
 * S2 1.8.2 `DatePicker` · `DateRangePicker` (2026-11-18 사용자 「이번에 넣음」): with a time
 * granularity the picker's `CalendarPopover` holds a TimeField (a range: start · end) after its
 * calendar — the picker's time value (`state.timeValue` · `timeRange`). A TimeField in a picker's
 * Popover Dialog (layout frames skipped): its picker and its place among the picker's time fields
 * (0 = the time · the start, 1 = the end).
 */
export function catalogPickerTimeFieldOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): { picker: CatalogConsumerNode; index: number } | undefined {
  if (typeOf(node) !== "TimeField") return undefined;
  const dialog = catalogPartParent(node, get, typeOf);
  if (!dialog || typeOf(dialog) !== "Dialog") return undefined;
  const popover = get(dialog.parentId);
  if (!popover || typeOf(popover) !== "Popover") return undefined;
  const picker = get(popover.parentId);
  if (!picker || !PICKER_TYPES.has(typeOf(picker))) return undefined;
  const fields = pickerTimeFields(dialog, get, typeOf);
  return {
    picker,
    index: Math.max(
      0,
      fields.findIndex((field) => field.id === node.id),
    ),
  };
}

/** The TimeFields in a picker's Dialog, in order (layout frames passed through). */
function pickerTimeFields(
  dialog: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (record: CatalogConsumerNode) => {
    for (const child of childrenOf(record, get)) {
      const type = typeOf(child);
      if (type === "TimeField") out.push(child);
      else if (PART_FRAME_TYPES.has(type)) visit(child);
    }
  };
  visit(dialog);
  return out;
}

/**
 * The time of a picker's ISO value for its TimeField (RAC `state.timeValue` — a date-only value is
 * midnight, ADR-309): `HH:mm[:ss[.sss]]`.
 */
function catalogTimeOfDateValue(value: string): string {
  const time = /T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)/.exec(value);
  return time ? time[1]! : "00:00:00";
}

/** A field's DateInputs (through its Group). */
function dateInputsOf(
  field: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (record: CatalogConsumerNode) => {
    for (const child of childrenOf(record, get)) {
      if (typeOf(child) === "DateInput") out.push(child);
      else if (typeOf(child) === "Group") visit(child);
    }
  };
  visit(field);
  return out;
}

/** S2 `timeGranularity`: the picker's granularity when it is a time one (hour · minute · second). */
export function catalogPickerTimeGranularity(
  picker: CatalogConsumerNode,
): "hour" | "minute" | "second" | undefined {
  const granularity = picker.props.granularity;
  return granularity === "hour" ||
    granularity === "minute" ||
    granularity === "second"
    ? granularity
    : undefined;
}

/**
 * S2 `showTimeField`: a picker's TimeField shows only at a time granularity — and the frame holding
 * only those (S2's time `div`) goes with them. Both consumers (Canvas presence · DOM render).
 */
export function catalogPickerTimeAbsent(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  const type = typeOf(node);
  if (type === "TimeField") {
    const at = catalogPickerTimeFieldOf(node, get, typeOf);
    return !!at && !catalogPickerTimeGranularity(at.picker);
  }
  if (type !== "frame") return false;
  const children = childrenOf(node, get);
  return (
    children.length > 0 &&
    children.every(
      (child) =>
        typeOf(child) === "TimeField" &&
        catalogPickerTimeAbsent(child, get, typeOf),
    )
  );
}

/** A picker's time parts (its Dialog's TimeFields and the frames holding them). */
function pickerTimeParts(
  picker: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  for (const popover of childrenOf(picker, get)) {
    if (typeOf(popover) !== "Popover") continue;
    for (const dialog of childrenOf(popover, get)) {
      if (typeOf(dialog) !== "Dialog") continue;
      for (const field of pickerTimeFields(dialog, get, typeOf)) {
        out.push(field);
        for (
          let frame = get(field.parentId);
          frame &&
          frame.id !== dialog.id &&
          PART_FRAME_TYPES.has(typeOf(frame));
          frame = get(frame.parentId)
        )
          if (!out.includes(frame)) out.push(frame);
      }
    }
  }
  return out;
}

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

/** A progress owner's value text part (`catalogProgressValueHidden` — when it shows). */
const PROGRESS_VALUES: Readonly<Record<string, string>> = {
  ProgressBar: "ProgressBarValue",
  Meter: "MeterValue",
  // (ADR-256 Phase 7c: a Slider's value text — RSP `showValueLabel`.)
  Slider: "SliderOutput",
};
const PROGRESS_VALUE_TYPES: ReadonlySet<string> = new Set(
  Object.values(PROGRESS_VALUES),
);

/** Text nodes inside an InlineAlert whose bold fill turns their color (S2 heading · content). */
const INLINE_ALERT_TEXT_TYPES: ReadonlySet<string> = new Set([
  "Heading",
  "Description",
  "Text",
  "Paragraph",
  "Label",
]);

/**
 * S2 1.8.0 InlineAlert `fillStyle: boldFill` (2026-10-10): the title and the content go white (black
 * on notice — S2 InlineAlert.tsx heading · content color). The derived `color` wins over the
 * node's definition color in both consumers (`derivedProps.color`); an authored color wins over
 * it (`derivedOf` checks).
 */
export function catalogInlineAlertBoldText(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string | undefined {
  if (!INLINE_ALERT_TEXT_TYPES.has(typeOf(node))) return undefined;
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId))
    if (typeOf(cursor) === "InlineAlert")
      return cursor.props.fillStyle === "boldFill"
        ? cursor.props.variant === "notice"
          ? "#000000"
          : "#ffffff"
        : undefined;
  return undefined;
}

/**
 * 295 후속 C9 — S2 Toast's start · end padding (`S2_TOAST_EDGE` — 16 + icon M + 8, neutral 16 · 8 +
 * close + 16), the device tokens' px (`{size.toast.*}`). `catalogBoxModel` reads them under an
 * authored padding.
 */
export function catalogToastEdges(props: Readonly<Record<string, unknown>>): {
  _toastPaddingLeft: number;
  _toastPaddingRight: number;
} {
  const px = (ref: string, fallback: number) => {
    const value = resolveToken(ref as TokenRef);
    return typeof value === "number" ? value : fallback;
  };
  return {
    _toastPaddingLeft: catalogToastIcon(props)
      ? px("{size.toast.padding-start-icon}", 42)
      : S2_TOAST_EDGE.start,
    _toastPaddingRight: px("{size.toast.padding-end}", 56),
  };
}

/**
 * 295 후속 C9 — S2 Toast `toastStyle` `color: 'white'` (every variant): a text node in a Toast is white,
 * unless it is a Button's own text (the action Button paints its text from its rule — S2
 * `staticColor="white"`). The derived `color` wins over the node's definition color in both
 * consumers (`compositionRoot` `derivedProps`); an authored color wins over it.
 */
export function catalogToastText(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string | undefined {
  if (!INLINE_ALERT_TEXT_TYPES.has(typeOf(node))) return undefined;
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId)) {
    const type = typeOf(cursor);
    if (type === "Toast") return "#ffffff";
    if (type === "Button" || type === "ToggleButton") return undefined;
  }
  return undefined;
}

/**
 * S2 1.8.0 NumberField `hideStepper` (2026-10-10): its increment · decrement Buttons are not
 * there (S2 renders no stepper). The nearest NumberField owner decides — the buttons sit in its
 * control Group. The Canvas (`catalogHiddenAtRest`) and the DOM (`renderNode`) read this one
 * predicate.
 */
export function catalogStepperHidden(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (node.props.slot !== "increment" && node.props.slot !== "decrement")
    return false;
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId))
    if (typeOf(cursor) === "NumberField")
      return cursor.props.hideStepper === true;
  return false;
}

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
  // (S2 1.8.2 `Slider.tsx`, 2026-11-18: the value text follows the label — in the label container
  //  with the label on top, after the track in the field input with the label at the side. Each
  //  place holds its own SliderOutput; the other one is not there.)
  let row: string | undefined;
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId)) {
    const owner = typeOf(cursor);
    if (owner === "SliderLabelContainer" || owner === "SliderFieldInput")
      row ??= owner;
    if (
      row &&
      (owner === "Slider" || owner === "RangeSlider") &&
      (row === "SliderFieldInput") !== (cursor.props.labelPosition === "side")
    )
      return true;
    if (!PROGRESS_VALUES[owner]) continue;
    if (PROGRESS_VALUES[owner] !== type) return false;
    // (S2 1.8.2 `ProgressBar.tsx` · `Meter.tsx`: the value text shows with a label — `label &&`,
    //  and not while a ProgressBar is indeterminate. S2 has no `showValueLabel` there; a Slider
    //  keeps its v3 `showValueLabel`.)
    if (owner === "Slider") return cursor.props.showValueLabel === false;
    return (
      String(cursor.props.label ?? "") === "" ||
      (owner === "ProgressBar" && cursor.props.isIndeterminate === true)
    );
  }
  return false;
}

/**
 * ADR-256 Phase 7a — an indeterminate ProgressBar's fill on the Canvas: the whole track, the sheet's
 * `.fill` box (G5 example 14 — the reference keeps the box and moves only its paint; the DOM pulses
 * its opacity, the Canvas draws it still). Its width binding has no value then (`{percentage}` —
 * RAC gives none).
 */
export function catalogProgressFillLayout(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string> | undefined {
  const owner = catalogProgressFillOwner(node, get, typeOf);
  return owner?.props.isIndeterminate === true ? { width: "100%" } : undefined;
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
 * start/end pair — granularity, hour cycle and locale, the locale as the layout measures it).
 */
function fieldSubpartProps(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  locale?: string,
): Record<string, string | number | boolean> | undefined {
  const type = typeOf(node);
  if (type === "Button" || type === "Icon") {
    // (A SearchField's parts sit in its control Group — S2 `FieldGroup`, 2026-11-13: `triggerOwner`
    //  crosses it.)
    const parent = triggerOwner(node, get, typeOf);
    const field =
      type === "Icon" && parent && typeOf(parent) === "Button"
        ? triggerOwner(parent, get, typeOf)
        : undefined;
    if (field && typeOf(field) === "SearchField")
      return { _iconVariant: String(field.props.size ?? "M") };
    if (parent && typeOf(parent) === "SearchField")
      return {
        _searchFieldPart: true,
        isDisabled:
          node.props.isDisabled === true || parent.props.isDisabled === true,
      };
  }
  if (type === "Description" || type === "FieldError") {
    const field = triggerOwner(node, get, typeOf);
    if (field && FIELD_HINT_OWNERS.has(typeOf(field)))
      return {
        isDisabled:
          node.props.isDisabled === true || field.props.isDisabled === true,
      };
  }
  if (type !== "DateInput") return undefined;
  const wrapper = catalogPartParent(node, get, typeOf);
  const owner = triggerOwner(node, get, typeOf);
  if (!wrapper || !owner) return undefined;
  const ownerType = typeOf(owner);
  if (!DATE_INPUT_OWNERS.has(ownerType)) return undefined;
  // (A picker's time field — S2 `CalendarPopover`'s TimeField, 2026-11-18: the picker's time value,
  //  granularity, hour cycle and time zone.)
  const pickerTime = catalogPickerTimeFieldOf(owner, get, typeOf);
  const source = pickerTime?.picker ?? owner;
  const prop = (key: string) =>
    pickerTime ? source.props[key] : (node.props[key] ?? owner.props[key]);
  const out: Record<string, string | number | boolean> = {
    _parentTag: ownerType,
  };
  const granularity = pickerTime
    ? catalogPickerTimeGranularity(pickerTime.picker)
    : prop("granularity");
  if (typeof granularity === "string") out._granularity = granularity;
  // (A picker's time field takes the picker's hour cycle — unset = the locale's, as S2 passes
  //  `props.hourCycle` — not a standalone TimeField's 24.)
  const hourCycle = racFieldHourCycle(
    pickerTime ? typeOf(source) : ownerType,
    prop("hourCycle"),
  );
  if (hourCycle !== undefined) out._hourCycle = hourCycle;
  // ADR-309 Decision 4 — the value its segments show: the owner's start value (a range picker's
  // start · end DateInput its end of the range — RAC shows a range only when both ends read).
  const start = catalogDateStartValue(source.props);
  const end = pickerTime ? pickerTime.index === 1 : node.props.slot === "end";
  const shown =
    typeOf(source) === "DateRangePicker"
      ? catalogDateRange(start)
        ? (start as Record<string, unknown>)[end ? "end" : "start"]
        : undefined
      : start;
  if (typeof shown === "string" && shown)
    out._dateValue = pickerTime ? catalogTimeOfDateValue(shown) : shown;
  if (owner.props.shouldForceLeadingZeros === false)
    out._forceLeadingZeros = false;
  if (source.props.hideTimeZone === true) out._hideTimeZone = true;
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
/** The ActionBar derived values of a node (`catalogDerivedProps`) — undefined when none. */
function catalogActionBarDerivedProps(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string | number | boolean> | undefined {
  const collection = catalogActionBarCollectionOf(node, get, typeOf);
  if (collection) {
    const border = catalogActionBarBorder(collection);
    return {
      _actionBarInContainer: true,
      ...(border > 0 ? { _actionBarBorder: border } : {}),
    };
  }
  const space = catalogActionBarSpaceOf(node, get, typeOf);
  return space === undefined ? undefined : { _actionBarSpace: space };
}

export function catalogDerivedProps(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  locale?: string,
  // (ADR-300 user decision 1: the shown page's route — a SideNav without `selectedRoute` marks it.)
  shownRoute?: CatalogSideNavShownRoute,
): Readonly<Record<string, string | number | boolean>> | undefined {
  const own = derivedPropsBeforeSkeleton(node, get, typeOf, locale, shownRoute);
  // S2 `renderActionBar` (부록 D.3 2단계, 2026-11-23): a collection's ActionBar floats over its
  //   bottom (`_actionBarInContainer` — its count is `catalogActionBarCount`); the collection
  //   keeps room under its items while it shows (`_actionBarSpace` — its bottom padding).
  const actionBar = catalogActionBarDerivedProps(node, get, typeOf);
  const derived = actionBar ? { ...own, ...actionBar } : own;
  // ADR-314 Phase 2 — S2 `SkeletonContext`: a participant inside a loading Skeleton (the context not
  // cut between — `skeletonContext.ts`) draws its loading look (its rule's `isSkeleton` branch, Phase 3).
  // Phase 3 — below a loading wrapped participant (a Badge's words …) it is not drawn (S2
  //   `visibility: hidden`; the layout keeps its box).
  const { isSkeleton, hidden } = catalogSkeletonState(node, get, typeOf);
  return isSkeleton || hidden
    ? {
        ...derived,
        ...(isSkeleton ? { isSkeleton: true } : {}),
        ...(hidden ? { _skeletonHidden: true } : {}),
      }
    : derived;
}

/**
 * ADR-315 Phase 6 — a node inside a Cell its row above runs into (`CATALOG_CELL_MERGED_PROP`): not
 * drawn (its box stays laid out; the DOM keeps the text for a screen reader — opacity, not
 * `visibility`). The nearest Cell decides; a Row · Table above ends the walk.
 */
function catalogCellMergedContent(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  let parent = get(node.parentId);
  for (let depth = 0; parent && depth < 8; depth += 1) {
    const type = typeOf(parent);
    if (type === "Cell") return parent.props[CATALOG_CELL_MERGED_PROP] === true;
    if (type === "Row" || type === "Table" || type === "TableBody")
      return false;
    parent = get(parent.parentId);
  }
  return false;
}

function derivedPropsBeforeSkeleton(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  locale?: string,
  shownRoute?: CatalogSideNavShownRoute,
): Readonly<Record<string, string | number | boolean>> | undefined {
  const ownControl = ownDerivedProps(node, get, typeOf, locale);
  const toggleGroup = ["Radio", "Checkbox"].includes(typeOf(node))
    ? catalogItemGroup(node, get, typeOf)
    : undefined;
  // RAC 그룹 context의 상태를 Canvas 소비자에도 전달한다. 이전 derived 값은
  // 다시 읽지 않아 그룹 상태를 해제할 때 disabled/invalid가 남지 않게 한다.
  const control = toggleGroup
    ? {
        ...ownControl,
        isDisabled:
          node.props.isDisabled === true ||
          toggleGroup.props.isDisabled === true,
        isInvalid:
          node.props.isInvalid === true || toggleGroup.props.isInvalid === true,
      }
    : ownControl;
  // The box of a quiet field shows its own quiet state (`fieldBoxOfQuietField`); a box the field's
  // own rule styles names that field (`_quietOwner` — `catalogQuietStyles`).
  const quietField =
    fieldBoxOfQuietField(node, get, typeOf) ??
    prefixBoxOfQuietField(node, get, typeOf);
  const quietOwner = quietField
    ? undefined
    : ownerStyledQuietBox(node, get, typeOf);
  const quiet = quietField ?? quietOwner;
  // (Any field's box shows its field's invalid state — the Input rule's `&[data-invalid]` border,
  // RAC's `data-invalid` on the DOM side.)
  const invalidField = quiet ? undefined : fieldOfBox(node, get, typeOf);
  // (The input in a field's box — Input · DateInput · TokenInput in the control Group, every field
  //  since 2026-11-14 — paints its text from its own rule's `isDisabled` branch: RAC's `data-disabled`
  //  on the DOM side. `fieldOfBox` skips it, so the Canvas text kept its resting color.)
  const boxGroup =
    quiet || invalidField
      ? undefined
      : catalogFieldBoxOfInput(node, get, typeOf);
  const boxedDisabled =
    !!boxGroup &&
    catalogFieldBox(boxGroup, get, typeOf)?.field.props.isDisabled === true;
  const own = quiet
    ? {
        ...control,
        isQuiet: true,
        ...(quietOwner ? { _quietOwner: typeOf(quietOwner) } : {}),
        _fieldDisabled: quiet.props.isDisabled === true,
        _fieldInvalid: quiet.props.isInvalid === true,
      }
    : invalidField
      ? {
          ...control,
          isInvalid:
            node.props.isInvalid === true ||
            invalidField.props.isInvalid === true,
          _fieldInvalid: invalidField.props.isInvalid === true,
          _fieldDisabled: invalidField.props.isDisabled === true,
        }
      : boxedDisabled
        ? { ...control, _fieldDisabled: true }
        : control;
  const selected = catalogCollectionItemSelected(node, get, typeOf);
  // (S2 TagGroup `isEmphasized`: its selected Tags paint the accent pair — `rulePaint.ts`.)
  const emphasized =
    selected !== undefined && catalogTagOfEmphasizedGroup(node, get, typeOf);
  const withSelection =
    selected === undefined
      ? own
      : {
          ...own,
          _isSelected: selected,
          ...(emphasized ? { _emphasized: true } : {}),
        };
  // (A selection checkbox is disabled while its item cannot be selected — RAC's context value.)
  const checkboxItem = catalogSelectionCheckboxItem(node, get, typeOf);
  // (A Button in a disabled ButtonGroup — S2 `isDisabled`: "all the Buttons are disabled".)
  const disabled =
    (!!checkboxItem &&
      catalogSelectionCheckboxDisabled(checkboxItem, get, typeOf)) ||
    (["Button", "LinkButton"].includes(typeOf(node)) &&
      catalogButtonGroupOf(node, get, typeOf)?.props.isDisabled === true) ||
    (typeOf(node) === "ActionButton" &&
      node.props.isDisabled !== false &&
      catalogActionButtonGroupOf(node, get, typeOf)?.props.isDisabled ===
        true) ||
    // (A disabled FileUpload's DropZone and FileTrigger Button — ADR-201 D2 `isDisabled`, 2026-11-23.)
    (FILE_UPLOAD_INPUT_TYPES.has(typeOf(node)) &&
      catalogFileUploadOf(node, get, typeOf)?.props.isDisabled === true) ||
    catalogItemKeyDisabled(node, get, typeOf) ||
    // (ADR-326 Phase 4: a Cascader row whose key repeats — the DOM Menu's `disabledKeys`.)
    catalogCascaderItemDuplicate(node, get, typeOf);
  // (A select-all checkbox while some rows — not all — are selected: RAC's indeterminate dash.)
  const selectAll =
    checkboxItem && typeOf(checkboxItem) === "Column"
      ? catalogTableSelectedRows(checkboxItem, get, typeOf)
      : undefined;
  const partial =
    !!selectAll &&
    selectAll.selected > 0 &&
    selectAll.selected < selectAll.total;
  const checkboxMarked = partial
    ? { ...withSelection, isIndeterminate: true }
    : withSelection;
  // (A Card's selection Checkbox plate sits at the card's spacing from its corner — S2
  //  `CardCheckbox` `top` · `insetStart: '--card-spacing'`: the card's padding at its size.)
  const checkboxCard = catalogCardCheckboxCard(node, get, typeOf);
  const cardSpacing = checkboxCard
    ? catalogCardSpacing(checkboxCard)
    : undefined;
  const cardSection = catalogCardSection(node, get, typeOf);
  const marked =
    cardSpacing !== undefined
      ? { ...checkboxMarked, _cardSpacing: cardSpacing }
      : cardSection
        ? { ...checkboxMarked, ...cardSection }
        : checkboxMarked;
  // ADR-281 Decision 3 — a page root's · frame's isDisabled · isReadOnly reach the components whose
  // RAC context takes them (RAC `Provider` on the DOM side). An own `false` does not re-enable: a
  // record cannot tell an authored `false` from its origin's declared default (`catalogInheritedFlags`).
  const fromHosts = CATALOG_INHERITED_RECEIVERS.has(typeOf(node))
    ? catalogAncestorInherited(node, get, typeOf)
    : undefined;
  // (A loading Skeleton's disable reaches S2's `useFormProps` components only — ADR-314.)
  const takes = fromHosts
    ? catalogInheritedTakes(typeOf(node), fromHosts)
    : undefined;
  const hostFlag = (flag: "isDisabled" | "isReadOnly") =>
    !!takes?.includes(flag) && fromHosts?.[flag] === true;
  const hostDisabled = hostFlag("isDisabled");
  const hostReadOnly = hostFlag("isReadOnly");
  const inheritedMarked = hostReadOnly
    ? { ...marked, isReadOnly: true }
    : marked;
  const result =
    disabled || hostDisabled
      ? { ...inheritedMarked, isDisabled: true }
      : inheritedMarked;
  // (S2 Disclosure `isInGroup`: inside an Accordion only the last child keeps its bottom
  // border — `catalogDisclosureBorders`; the DOM's `data-in-group` and `:last-child`.)
  const grouped = catalogAccordionPosition(node, get, typeOf);
  // (A standalone list's item: its flex shrink and the line under it — the ListBox rule's item
  // selectors, 2026-10-13.)
  const first = catalogListItemEdges(node, get, typeOf);
  const placed = grouped
    ? { ...result, ...grouped }
    : first
      ? { ...result, ...first }
      : result;
  // (S2 Meter · ProgressBar `staticColor`: the label and the value text in the static color.)
  const staticText = catalogProgressStaticText(node, get, typeOf);
  // (2026-11-15: S2 `isInCheckboxGroup` — a grouped Checkbox's help text in its label's column at the
  //  group row gap, `toggleLayout.ts` `catalogToggleItemHelpRefs`; its size the item's.)
  const helpItem =
    typeOf(node) === "Description" ? get(node.parentId) : undefined;
  const groupedHelp =
    helpItem &&
    typeOf(helpItem) === "Checkbox" &&
    catalogToggleGroupOf(helpItem, get, typeOf);
  const colored =
    staticText || groupedHelp
      ? {
          ...placed,
          ...(staticText ? { staticColor: staticText } : {}),
          ...(groupedHelp
            ? { _toggleItemHelp: String(helpItem.props.size ?? "M") }
            : {}),
        }
      : placed;
  // (ADR-257: a Table's header row · Row is a grid on its Table's shared column tracks — the
  //  selection column at S2's `{size.table.selection-column}`: the Canvas's px, the DOM's
  //  device variable `_tableDeviceTracks`, ADR-295 후속.)
  const selectionWidth = resolveToken(
    "{size.table.selection-column}" as TokenRef,
  );
  const tracks = catalogTableRowTracks(
    node,
    get,
    typeOf,
    typeof selectionWidth === "number" ? selectionWidth : undefined,
  );
  const tracked = tracks
    ? {
        ...colored,
        _tableTracks: tracks.list.join(" "),
        ...(tracks.deviceTracks
          ? { _tableDeviceTracks: tracks.deviceTracks }
          : {}),
      }
    : colored;
  // (ADR-295 후속 C7: S2's checkbox column — its Column · Cells end 8 in, not 16 — `catalogBoxModel`.)
  const selectionPart =
    (typeOf(node) === "Column" || typeOf(node) === "Cell") &&
    catalogTrackTableOf(get(node.parentId) ?? node, get, typeOf) !==
      undefined &&
    catalogTableSelectionColumn(node, get, typeOf);
  const selectionPart_ = selectionPart
    ? { ...tracked, _tableSelectionPart: true }
    : tracked;
  // (295 후속 C9: S2 Toast's start · end padding hold its variant icon · close button — device
  //  tokens, neutral 16 with no icon — `catalogBoxModel`; the DOM reads the Toast rule's selectors.)
  const selectionMarked =
    typeOf(node) === "Toast"
      ? { ...selectionPart_, ...catalogToastEdges(node.props) }
      : selectionPart_;
  // (ADR-267: a standalone list's section header sticks — the ListBox rule's section header.)
  const sticky = catalogListSectionHeaderInsets(node, get, typeOf);
  const stuck = sticky ? { ...selectionMarked, ...sticky } : selectionMarked;
  // (S2 Button is a pill; a field's own button keeps its size's corner — the Button rule's
  //  `field-button` blocks, `catalogFieldButtonSize`.)
  const fieldButton = catalogFieldButtonSize(node, get, typeOf);
  const pickerOwner = catalogOverlayOwner(node, get, typeOf);
  // (ADR-322: a Cascader's open Button and its value · glyph are Select's trigger parts — no overlay
  //  node owns them, the field does.)
  const cascader = catalogCascaderOfTriggerPart(node, get, typeOf);
  const picker =
    pickerOwner && typeOf(pickerOwner) === "Select" ? pickerOwner : cascader;
  const selectionItem =
    typeOf(node) === "Icon"
      ? catalogPickerSelectionItem(node, get, typeOf)
      : undefined;
  const pickerPart =
    picker && ["Button", "SelectValue", "Icon"].includes(typeOf(node))
      ? {
          ...(typeOf(node) === "Button" ? { _pickerTrigger: true } : {}),
          ...(typeOf(node) === "SelectValue" ? { _pickerValue: true } : {}),
          ...(cascader && typeOf(node) === "SelectValue"
            ? { _cascaderValue: true }
            : {}),
          // (S2 체크리스트 §9.3: it shows its value shape — S2 `renderValue` — in place of its text.)
          ...(typeOf(node) === "SelectValue" &&
          catalogValueTemplateShown(node, get, typeOf)
            ? { _valueTemplate: true }
            : {}),
          ...(typeOf(node) === "Icon" ? { _pickerIcon: true } : {}),
          _pickerInvalid: picker.props.isInvalid === true,
          _overlayOpen: catalogOverlayOpen(picker, get, typeOf),
          isDisabled:
            picker.props.isDisabled === true ||
            node.props.isDisabled === true ||
            stuck?.isDisabled === true,
          isQuiet: picker.props.isQuiet === true,
        }
      : {};
  const buttoned = {
    ...stuck,
    ...(fieldButton ? { fieldButton } : {}),
    // (A disabled field disables its own buttons — RAC's field context; S2 paints them with the
    //  disabled color, `NumberField` stepButton · Picker · ComboBox button. The Canvas paint reads
    //  the same state the DOM gets from RAC's `data-disabled`.)
    ...(fieldButton &&
    catalogFieldButtonOwner(node, get, typeOf)?.props.isDisabled === true
      ? { isDisabled: true }
      : {}),
    ...pickerPart,
    // (ADR-326 §4.4 · §4.5 — a Cascader's open screen: an item's row state and `tree` level, a
    //  `tree` row's chevron, a `drill` trail's crumbs and their label text.)
    ...catalogCascaderOpenDerived(node, get, typeOf, locale),
    // (ADR-315 Phase 4 — a pinned Table column's edge: the Column · Cell rule's `pinned-edge` line.
    //  The column projection marks the record, `tableColumns.ts`.)
    ...(node.props[CATALOG_COLUMN_PINNED_EDGE_PROP] === true &&
    (node.props[CATALOG_COLUMN_PINNED_PROP] === "start" ||
      node.props[CATALOG_COLUMN_PINNED_PROP] === "end")
      ? { pinnedEdge: node.props[CATALOG_COLUMN_PINNED_PROP] as string }
      : {}),
    // (ADR-315 Phase 6 — a merged Table's body Row draws its line by its Cells, each its own unless
    //  it runs into the row below; a Cell its row above runs into hides its content. The column
    //  projection marks the records, `tableColumns.ts`.)
    ...(node.props[CATALOG_ROW_CELL_LINES_PROP] === true
      ? { cellLines: "cells" }
      : {}),
    // (S2 체크리스트 §9.3 — a Row in its Table's footer (the totals row) and its Cells: S2
    //  `TableFooter`'s row look, the Row · Cell rule's `in-footer` block.)
    ...(catalogTableFooterPart(node, get, typeOf) ? { inFooter: "true" } : {}),
    // (ADR-317 Phase 5 — a 「Striped rows」 Table's shaded Row and a merged run's Cell whose stripe
    //  is not its row's: the Row · Cell rule's `striped` · `stripe` block. A selected row shows its
    //  selection — the DOM's selected paint comes after the stripe.)
    ...catalogStripeProps(node, selected, get, typeOf),
    // (S2 `selectBoxStyles`' `:has` blocks — the parts a SelectBox shows pick its grid; the box and
    //  its slotted parts carry them for the Canvas, `catalogSelectBoxContentStyle`.)
    ...selectBoxShownProps(node, get, typeOf),
    // (S2 체크리스트 §9.3 — S2 `EditableCell`'s edit button: `visibility: hidden` at rest (the row's
    //  hover · focus shows it — the DOM's), its box laid out.)
    ...(catalogEditableCellButton(node, get, typeOf)
      ? { _editButtonHidden: true }
      : {}),
    ...(node.props[CATALOG_CELL_LINE_PROP] === "bottom" ||
    node.props[CATALOG_CELL_LINE_PROP] === "none"
      ? { mergeLine: node.props[CATALOG_CELL_LINE_PROP] as string }
      : {}),
    ...(catalogCellMergedContent(node, get, typeOf)
      ? { _cellMergedContent: true }
      : {}),
    // (ADR-315 Phase 4 증분 6 — a sorted Column's content wrapper holds its sort mark: the Canvas
    //  lays it out as a part (`compositionRoot.partsFor`) and draws it there.)
    ...(() => {
      const mark = catalogColumnAuthoredSortMark(node, get, typeOf);
      return mark
        ? {
            _sortMark:
              mark.order === undefined
                ? (mark.direction as string)
                : `${mark.direction}:${mark.order}`,
          }
        : ({} as Record<string, never>);
    })(),
    // (S2 `FieldErrorIcon`: an invalid field's input keeps the alert glyph's room — the Canvas draws
    //  it there, `fieldPrefix.ts` `catalogFieldErrorIcon`.)
    ...(() => {
      const icon = catalogFieldErrorIcon(node, get, typeOf);
      return icon
        ? {
            _fieldErrorIcon: icon.size,
            _fieldErrorIconEnd: icon.offsetEnd,
            ...(icon.top ? { _fieldErrorIconTop: true } : {}),
          }
        : {};
    })(),
    ...(selectionItem
      ? {
          _selectionMarkHidden: !catalogStateValue(
            selectionItem,
            "isSelected",
            get,
            typeOf,
          ),
        }
      : {}),
    // (a Select option's check is its own Icon part — the sheet's glyph gives way, `ruleDom`)
    ...(catalogPickerOfOption(node, get, typeOf)
      ? { _pickerOption: true }
      : {}),
  };
  // (ADR-300: a SideNav part's collapse · current · level — `catalogSideNavDerived`.)
  const sideNav = catalogSideNavDerived(node, get, typeOf, shownRoute);
  // (2026-11-14: a Nav's current Link — `catalogNavLinkDerived`.)
  const navLink = catalogNavLinkDerived(node, get, typeOf, shownRoute);
  const withSideNav =
    sideNav || navLink ? { ...buttoned, ...sideNav, ...navLink } : buttoned;
  // (ADR-303: a rule that reads `{color.container}` paints its nearest container's layer — the DOM's
  //  inherited `--container-bg`, `containerLayer.ts`.)
  const withContainer = catalogDerivesContainerLayer(node)
    ? {
        ...withSideNav,
        _containerLayer: catalogContainerLayerAbove(node, get),
      }
    : withSideNav;
  // (S2 Dialog `isDismissible` gives its Modal RAC's `isDismissable` — an outside press closes it;
  //  `isKeyboardDismissDisabled` its RAC `isKeyboardDismissDisabled` — Escape does not.)
  if (typeOf(node) === "Modal") {
    const dialogs = partChildrenOf(node, get, typeOf).filter(
      (child) => typeOf(child) === "Dialog",
    );
    const dismissible = dialogs.some(
      (child) => child.props.isDismissible === true,
    );
    const keyboardLocked = dialogs.some(
      (child) => child.props.isKeyboardDismissDisabled === true,
    );
    if (dismissible || keyboardLocked)
      return {
        ...withContainer,
        ...(dismissible ? { _dialogDismissible: true } : {}),
        ...(keyboardLocked ? { _dialogKeyboardDismissDisabled: true } : {}),
      };
  }
  if (typeOf(node) === "Sheet") {
    const overlay = catalogPartParent(node, get, typeOf);
    if (overlay && typeOf(overlay) === "SheetOverlay") {
      let direction = String(
        overlay.props.swipeDirection || overlay.props.position || "bottom",
      );
      if (direction === "start" || direction === "end") {
        const rtl = isRTL(locale ?? "en-US");
        direction = (direction === "start") !== rtl ? "left" : "right";
      }
      // RAC의 center 위치는 기본적으로 수직 양방향 swipe다.
      if (direction === "center") direction = "vertical";
      return {
        ...withContainer,
        _sheetHandle: overlay.props.preventDismissal !== true,
        _sheetSwipeDirection: direction,
      };
    }
  }
  return withContainer;
}

/**
 * The fields whose own buttons are S2 field buttons, not S2 `Button`s (2026-10-28): the Picker's
 * trigger, NumberField's steppers, ComboBox's · the date pickers' field button, SearchField's clear
 * button. Here they are instances of the Button origin (ADR-253 — the Button rule owns their shape).
 */
const FIELD_BUTTON_OWNERS: ReadonlySet<string> = new Set([
  "Select",
  "Cascader",
  "NumberField",
  "ComboBox",
  "SearchField",
  "DatePicker",
  "DateRangePicker",
  // (2026-10-30 — 사용자 「pagination 의 button 에 border-radius S:7, M:8, L:9, XL:10」: the page
  //  buttons take the same size corners, not the pill.)
  "Pagination",
]);

/**
 * S2 `Button` is `control({shape: 'pill'})` (Button.tsx); a field's own button keeps the corner of
 * its size (2026-10-28 — 사용자 「Button 모서리를 S2 처럼 완전히 둥글게」). The Button's own size for
 * a button a field owns (through its part frames and control Group — `triggerOwner`) — the key of
 * the Button rule's `field-button` blocks (DOM `data-field-button`, Canvas `containerVariants`).
 * Undefined for any other node.
 */
export function catalogFieldButtonSize(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string | undefined {
  if (!catalogFieldButtonOwner(node, get, typeOf)) return undefined;
  return typeof node.props.size === "string" ? node.props.size : "M";
}

/** The field a field button (`catalogFieldButtonSize`) belongs to. */
function catalogFieldButtonOwner(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Button") return undefined;
  const owner = triggerOwner(node, get, typeOf);
  return owner && FIELD_BUTTON_OWNERS.has(typeOf(owner)) ? owner : undefined;
}

/**
 * ADR-267 — a standalone ListBox's section header (`ListBox > ListBoxSection > Header`, not in a
 * Popover — the rule block's `:not(.react-aria-Popover *)`) is sticky: its insets
 * (`catalogListSectionHeaderSticky`) as `_stickyInsetTop` …, which `styleOf` sends with
 * `position: sticky`, and its paint order as `_stickyZIndex` (the Canvas sorts it over its items). Undefined for other nodes and for a picker's list.
 */
function catalogListSectionHeaderInsets(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Readonly<Record<string, number>> | undefined {
  if (typeOf(node) !== "Header") return undefined;
  const section = get(node.parentId);
  if (!section || typeOf(section) !== "ListBoxSection") return undefined;
  const list = get(section.parentId);
  if (!list || typeOf(list) !== "ListBox") return undefined;
  for (let up = get(list.parentId); up; up = get(up.parentId))
    if (typeOf(up) === "Popover") return undefined;
  const sticky = catalogListSectionHeaderSticky();
  if (!sticky) return undefined;
  return {
    ...Object.fromEntries(
      Object.entries(sticky.insets).map(([key, px]) => [
        `_sticky${key[0].toUpperCase()}${key.slice(1)}`,
        px,
      ]),
    ),
    // (The header paints over the items it is stuck on — the block's `z-index`.)
    ...(sticky.zIndex !== undefined ? { _stickyZIndex: sticky.zIndex } : {}),
  };
}

/**
 * S2 1.8.0 Meter · ProgressBar `staticColor` (2026-10-10): its label (`FieldLabel staticColor`) and
 * its value text (`isStaticColor`) are `transparent-overlay-1000` — the static color itself. The
 * label · value node of a static ProgressBar · Meter takes its `staticColor` (its paint:
 * `resolveCatalogPaint`'s static text color). Undefined otherwise.
 */
function catalogProgressStaticText(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): "white" | "black" | "auto" | undefined {
  const type = node.ruleId ?? typeOf(node);
  if (type !== "Label" && !PROGRESS_VALUE_TYPES.has(type)) return undefined;
  // (The Label sits in its label row — S2 `FieldLabel`, passed through.)
  const owner =
    type === "Label"
      ? catalogPartParent(node, get, typeOf)
      : get(node.parentId);
  if (!owner) return undefined;
  const ownerType = typeOf(owner);
  if (!PROGRESS_TRACKS[ownerType]) return undefined;
  if (type !== "Label" && PROGRESS_VALUES[ownerType] !== type) return undefined;
  // (an `auto` owner's parts resolve `auto` themselves against the same backdrop — `staticBackdrop.ts`)
  return owner.props.staticColor === "auto"
    ? "auto"
    : catalogStaticScheme(owner);
}

/**
 * A Disclosure inside an Accordion (any depth — RAC's group context): `_inGroup` and whether
 * it is its parent's last child (`_lastChild` — the sheet's `:last-child`). Undefined otherwise.
 */
function catalogAccordionPosition(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): { _inGroup: true; _lastChild: boolean } | undefined {
  if (typeOf(node) !== "Disclosure") return undefined;
  if (!catalogAccordionOf(node, get, typeOf)) return undefined;
  const siblings = get(node.parentId)?.children ?? [];
  return { _inGroup: true, _lastChild: siblings.at(-1) === node.id };
}

/**
 * A standalone list's item (2026-10-13 — the reference `ListBox.css`): its flex shrink from the
 * list rule's item selector (`catalogListItemFlexShrink`) and whether it is its parent's last shown
 * child (`_lastItem` — the sheet's `:not(:last-child)` line under it; hidden records render no
 * element). No margins — the list's padding holds the items off its border (사용자 2026-10-13).
 * Undefined for other nodes and for a picker's list (in a Popover — the reference's dropdown list,
 * its own sheet).
 */
function catalogListItemEdges(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
):
  | {
      _itemShrink?: number;
      _lastItem?: boolean;
      _inPopover?: true;
      _pickerList?: true;
    }
  | undefined {
  const type = typeOf(node);
  // (A picker's list in its Popover — the ListBox rule's `inPopover` state: S2 Picker · ComboBox's
  //  list `padding: 8`, read by `catalogBoxModel`; 2026-11-24.)
  if (type === "ListBox") {
    for (let up = get(node.parentId); up; up = get(up.parentId))
      if (typeOf(up) === "Popover") return { _pickerList: true };
    return undefined;
  }
  if (type !== "ListBoxItem") return undefined;
  const parent = get(node.parentId);
  if (!parent) return undefined;
  const parentType = typeOf(parent);
  const list =
    parentType === "ListBox"
      ? parent
      : parentType === "ListBoxSection"
        ? get(parent.parentId)
        : undefined;
  if (!list || typeOf(list) !== "ListBox") return undefined;
  for (let up = get(list.parentId); up; up = get(up.parentId))
    if (typeOf(up) === "Popover") return { _inPopover: true };
  const shrink = catalogListItemFlexShrink("ListBox", type);
  const shown = parent.children.filter((id) => get(id)?.hidden !== true);
  return {
    ...(shrink === undefined ? {} : { _itemShrink: shrink }),
    _lastItem: shown.at(-1) === node.id,
  };
}

/**
 * (2026-11-14) An ActionButton's Avatar is there with an image, its count Badge with a count (S2 renders
 * the child the author wrote; the origin's unfilled `{avatar}` · `{badge}` write none). The Canvas
 * (`catalogHiddenAtRest`) and the DOM (`renderNode`) read this one predicate.
 */
export function catalogActionButtonPartAbsent(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (
    node.bindingId !== "avatar" &&
    node.bindingId !== "badge" &&
    node.bindingId !== "icon"
  )
    return false;
  const button = get(node.parentId);
  if (!button || typeOf(button) !== "ActionButton") return false;
  // (S2 API `<Icon /> or <Avatar />` — the docs example drops the icon once an avatar is on.)
  if (node.bindingId === "icon")
    return childrenOf(button, get).some(
      (child) => child.bindingId === "avatar" && catalogAvatarHasImage(child),
    );
  // (S2 NotificationBadge `display: none` while its button is disabled — `NotificationBadgeContext`
  //  `isDisabled`: its own flag, its group's or an inherited one.)
  if (node.bindingId === "badge")
    return (
      catalogNotificationBadgeText(node.props.value) === undefined ||
      button.props.isDisabled === true ||
      button.derivedProps?.isDisabled === true
    );
  return !catalogAvatarHasImage(node);
}

/** An Avatar with an image — not the origin's unfilled `{avatar}`. */
function catalogAvatarHasImage(node: CatalogConsumerNode): boolean {
  const src = String(node.props.src ?? "");
  return src !== "" && !/^\{\w+\}$/.test(src);
}

/**
 * (2026-11-14) What an ActionButton shows beside its count badge — S2 `iconOnly` · `textOnly` selectors
 * (`[slot=icon]` · `[slot=avatar]` · `[data-rsp-slot=text]`).
 */
export function catalogActionBadgeContent(
  button: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogActionBadgeContent {
  const visible = childrenOf(button, get).filter(
    (child) => !child.hidden && typeOf(child) !== "Badge",
  );
  const glyph = visible.some((child) =>
    ["Icon", "Avatar"].includes(typeOf(child)),
  );
  const words =
    !!button.props.children ||
    visible.some((child) => !["Icon", "Avatar"].includes(typeOf(child)));
  return glyph ? (words ? "default" : "glyphOnly") : "textOnly";
}

/** S2 action group types — an ActionButtonGroup, and a Toolbar (the same group context, 2026-11-14). */
const ACTION_GROUP_TYPES: ReadonlySet<string> = new Set([
  "ActionButtonGroup",
  "Toolbar",
]);

/** ActionButton의 가장 가까운 그룹. 중간 Frame을 지나도 context는 유지된다. */
export function catalogActionButtonGroupOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId))
    if (ACTION_GROUP_TYPES.has(typeOf(parent))) return parent;
  return undefined;
}

function actionGroupButtons(
  group: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return childrenOf(group, get).flatMap((child) =>
    ACTION_GROUP_TYPES.has(typeOf(child))
      ? []
      : [
          ...(typeOf(child) === "ActionButton" ? [child] : []),
          ...actionGroupButtons(child, get, typeOf),
        ],
  );
}

/**
 * ADR-201 D2 — a FileUpload's `isDisabled` disables its input surfaces: the DropZone and the
 * FileTrigger's Button (S2 `<FileTrigger><Button>`, 11-22). One derived value the Canvas paints
 * and the DOM passes to RAC (`buttonDisabled` · the DropZone intake).
 */
const FILE_UPLOAD_INPUT_TYPES: ReadonlySet<string> = new Set([
  "DropZone",
  "Button",
]);

/** The nearest FileUpload above `node` (through any element). */
export function catalogFileUploadOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId))
    if (typeOf(parent) === "FileUpload") return parent;
  return undefined;
}

/** A FileUpload's input surfaces and their parts (its `isDisabled` repaints them). */
function fileUploadInputs(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (record: CatalogConsumerNode, inside: boolean) => {
    for (const child of childrenOf(record, get)) {
      if (typeOf(child) === "FileUpload") continue;
      const input = FILE_UPLOAD_INPUT_TYPES.has(typeOf(child));
      if (input || inside) out.push(child);
      visit(child, inside || input);
    }
  };
  visit(owner, false);
  return out;
}

/**
 * S2 `Image` `renderError` (S2 체크리스트 부록 D.2, 사용자 결정 2026-11-23 「오류 대체 내용」): the nodes
 * an author puts in an Image are what it shows when it has no picture. With a source they rest
 * hidden (the picture covers the box); without one they show — on the Canvas and in the DOM, where a
 * source that fails to load shows them too (`CatalogImageBox` — runtime only, the Canvas cannot know).
 */
export function catalogImageFallbackHidden(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  const image = get(node.parentId);
  if (!image || typeOf(image) !== "Image") return false;
  const src = image.props.src;
  return typeof src === "string" && src !== "";
}

/** The nearest ButtonGroup above a Button (through any element — S2's `ButtonContext`). */
export function catalogButtonGroupOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId))
    if (typeOf(parent) === "ButtonGroup") return parent;
  return undefined;
}

/** The Buttons whose nearest ButtonGroup is `group` (its `isDisabled` disables them). */
function buttonGroupButtons(
  group: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return childrenOf(group, get).flatMap((child) =>
    typeOf(child) === "ButtonGroup"
      ? []
      : [
          ...(["Button", "LinkButton"].includes(typeOf(child)) ? [child] : []),
          ...buttonGroupButtons(child, get, typeOf),
        ],
  );
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
  // (ADR-259 Phase 2: in a prefix box the Group is the box — it shows the quiet state.)
  if (catalogFieldBoxOfInput(node, get, typeOf)) return;
  // (A field's control Group only places its box — a DateRangePicker takes no `isQuiet` (S2).)
  const owner = triggerOwner(node, get, typeOf);
  return owner?.props.isQuiet === true ? owner : undefined;
}

/** The field whose box this part draws: a field's Input · DateInput, or a prefix box Group. */
function fieldOfBox(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const type = typeOf(node);
  if (type === "Group") return catalogFieldBox(node, get, typeOf)?.field;
  if (type !== "Input" && type !== "DateInput") return;
  if (!catalogPartParent(node, get, typeOf)) return;
  if (catalogFieldBoxOfInput(node, get, typeOf)) return;
  return triggerOwner(node, get, typeOf);
}

/**
 * ADR-259 Phase 2 — a prefix field's box Group (`catalogFieldBox`) whose field is quiet: the Group
 * draws the Input rule's quiet shape (the Input inside lays its box down).
 */
function prefixBoxOfQuietField(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const box = catalogFieldBox(node, get, typeOf);
  return box?.field.props.isQuiet === true ? box.field : undefined;
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

/**
 * A composed field Label's necessity text (S2 `FieldLabel` — "(required)" · "(optional)" in the
 * field's locale), read from the field's inherited `isRequired`; `undefined` for any other node.
 * The Label's `_necessityText` and its `{necessityLabel}` part's value both read it here — the
 * value pass runs before the derived pass (`compositionRoot.ts`), so reading the Label's
 * `derivedProps` gave "" on a fresh build and the last value incrementally (2026-11-09).
 */
export function catalogLabelNecessityText(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  locale?: string,
): string | undefined {
  const field = catalogComposedFieldLabel(node, get, typeOf)
    ? catalogPartParent(node, get, typeOf)
    : undefined;
  if (!field) return undefined;
  return necessityLabel(
    catalogInheritedFlag(field, "isRequired", get, typeOf),
    typeof field.props.locale === "string" ? field.props.locale : locale,
  );
}

function ownDerivedProps(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  locale?: string,
): Readonly<Record<string, string | number | boolean>> | undefined {
  const base = ownDerivedPropsBase(node, get, typeOf, locale);
  const necessityText = catalogLabelNecessityText(node, get, typeOf, locale);
  const composed =
    necessityText === undefined
      ? base
      : { ...base, _fieldComposed: true, _necessityText: necessityText };
  // (S2 LabeledValue's label is `FieldLabel elementType="span"` — no control to label.)
  const labeledValue =
    typeOf(node) === "Label" &&
    typeOf(catalogPartParent(node, get, typeOf) ?? node) === "LabeledValue";
  const own = labeledValue ? { ...composed, _labelElement: "span" } : composed;
  // S2 Button `isPending`: the button's children (its icon · text nodes) stay laid out but are not
  // shown (`buttonPending.ts` — the DOM wraps them in `visibility: hidden`, the Canvas registers
  // them unpainted).
  const parent = get(node.parentId);
  if (!parent || !catalogButtonPending(typeOf(parent), parent.props))
    return own;
  return { ...own, _pendingHidden: true };
}

/** ADR-321: the Steps a StepList draws, in order (hidden ones are not steps). */
function stepsOf(
  list: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  return childrenOf(list, get).filter(
    (child) => !child.hidden && typeOf(child) === STEP_TYPE,
  );
}

/**
 * ADR-321: a StepList's input to its state rule (`stepListState.ts`) — its steps' keys in order,
 * the disabled ones (the list's `disabledKeys` and each Step's own `isDisabled`), its switches and
 * the two keys it starts with. `props` = the list's props as they stand (a running Preview's runtime
 * values over the record's); both consumers and the rules' Do read this one function.
 */
export function catalogStepListInput(
  list: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  props: Readonly<Record<string, unknown>> = list.props,
): StepListStateInput {
  const steps = stepsOf(list, get, typeOf);
  const keys = steps.map((step) => catalogItemKey(step, typeOf));
  return {
    keys,
    ...catalogStepListKeys(props),
    disabledKeys: [
      ...catalogGroupDisabledKeys(props),
      ...keys.filter((_, index) => steps[index]!.props.isDisabled === true),
    ],
    isDisabled: props.isDisabled === true,
    isReadOnly: props.isReadOnly === true,
    allowsFreeNavigation: props.allowsFreeNavigation === true,
  };
}

/**
 * ADR-321 Phase 3 (사용자 결정 2): a Stepper's StepList (its first, through the frames around it), its
 * StepPanels paired with the list's Steps (by `itemId`, else in order for a panel without a key —
 * Tabs' pairing) and the key of the current step. `listProps` = the list's props as they stand (a
 * running Preview's runtime values); the Canvas reads the start state.
 */
export function catalogStepperModel(
  stepper: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  listProps?: Readonly<Record<string, unknown>>,
) {
  const direct = partChildrenOf(stepper, get, typeOf);
  const list = direct.find((child) => typeOf(child) === STEP_LIST_TYPE);
  const panels = direct.filter((child) => typeOf(child) === STEP_PANEL_TYPE);
  const steps = list ? stepsOf(list, get, typeOf) : [];
  const keyed = steps.map((step) => {
    const key = catalogItemKey(step, typeOf);
    return {
      key,
      panel: panels.find((candidate) => candidate.props.itemId === key),
    };
  });
  const unkeyed = panels.filter((panel) => panel.props.itemId === undefined);
  let next = 0;
  const pairs = keyed.map((pair) =>
    pair.panel ? pair : { ...pair, panel: unkeyed[next++] },
  );
  const currentKey = list
    ? catalogStepListStates(
        catalogStepListInput(list, get, typeOf, listProps ?? list.props),
      ).selectedKey
    : null;
  return { list, panels, pairs, currentKey };
}

/** ADR-321 Phase 3: the Stepper a StepPanel · StepList sits in (through the frames around it). */
export function catalogStepperOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const owner = catalogPartParent(node, get, typeOf);
  return owner && typeOf(owner) === STEPPER_TYPE ? owner : undefined;
}

/**
 * ADR-321 Phase 3: whether a StepPanel waits (its step is not the current one — only the current
 * step's panel is drawn; a panel no Step names is not drawn either). Outside a Stepper it shows.
 */
export function catalogStepPanelWaiting(
  panel: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  listProps?: Readonly<Record<string, unknown>>,
): boolean {
  const stepper = catalogStepperOf(panel, get, typeOf);
  if (!stepper) return false;
  const { pairs, currentKey } = catalogStepperModel(
    stepper,
    get,
    typeOf,
    listProps,
  );
  return !pairs.some(
    (pair) => pair.panel?.id === panel.id && pair.key === currentKey,
  );
}

/**
 * ADR-323 Phase 2: the TimelineItems a Timeline draws, in order — a hidden one, and one whose
 * `display` is `none`, is not an item (판독 F5: it took a side and kept the last one's connector).
 * `every` keeps them all (the items a list change reaches).
 */
function timelineItemsOf(
  list: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  every = false,
): CatalogConsumerNode[] {
  return childrenOf(list, get).filter(
    (child) =>
      typeOf(child) === TIMELINE_ITEM_TYPE &&
      (every || catalogParticipatesInLayout(child)),
  );
}

/**
 * ADR-323 Phase 2: a TimelineItem's derived values in its Timeline (`runtime/timeline.ts`) — its
 * status (사용자 결정 1, the item's own `status` — a bound row's status field, resolver), its place
 * and its side. Undefined outside a Timeline (the origin's own card draws a box of its Texts).
 */
function timelineItemDerivedOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string | number | boolean> | undefined {
  const list = get(node.parentId);
  if (!list || typeOf(list) !== TIMELINE_TYPE) return undefined;
  const items = timelineItemsOf(list, get, typeOf);
  const index = items.findIndex((item) => item.id === node.id);
  if (index < 0) return undefined;
  return catalogTimelineItemDerived({
    index,
    count: items.length,
    list: list.props,
    status: node.props.status,
    size: node.props.size ?? list.props.size,
  });
}

/**
 * ADR-323 Phase 2: the color a TimelineItem's date · description Text takes (subdued — the title
 * keeps the document's). Both consumers read it as the Text's derived `color`; an authored color
 * wins. Undefined for any other node.
 */
export function catalogTimelineTextColor(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string | undefined {
  if (node.bindingId !== "text") return undefined;
  if (node.props.slot !== "date" && node.props.slot !== "description")
    return undefined;
  const item = get(node.parentId);
  if (!item || typeOf(item) !== TIMELINE_ITEM_TYPE) return undefined;
  return TIMELINE_COLORS.secondaryText;
}

/**
 * ADR-321: a Step's derived values in its StepList (`runtime/stepList.ts` — the start state the
 * Canvas draws).
 */
function stepDerivedOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string | number | boolean> | undefined {
  const list = get(node.parentId);
  if (!list || typeOf(list) !== STEP_LIST_TYPE) return undefined;
  const steps = stepsOf(list, get, typeOf);
  const at = steps.findIndex((step) => step.id === node.id);
  if (at < 0) return undefined;
  const { steps: states } = catalogStepListStates(
    catalogStepListInput(list, get, typeOf),
  );
  return catalogStepDerived(
    states[at]!,
    steps.length,
    list.props,
    node.props.size ?? list.props.size,
  );
}

/**
 * ADR-321: the color a Step's label · description Text takes (design-data `Step text` — the current
 * step's label is the neutral · accent content color, the others subdued, a disabled step's the
 * disabled content color). Both consumers read it as the Text's derived `color`; an authored color
 * wins. Undefined for any other node.
 */
export function catalogStepTextColor(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string | undefined {
  if (node.bindingId !== "text") return undefined;
  const step = get(node.parentId);
  if (!step || typeOf(step) !== STEP_TYPE) return undefined;
  const derived = stepDerivedOf(step, get, typeOf);
  if (!derived) return undefined;
  const colors = catalogStepChromeColors({
    state: derived._stepState as StepState,
    emphasized: derived._stepEmphasized === true,
    disabled: derived._stepDisabled === true,
  });
  return node.props.slot === "description" ? colors.description : colors.label;
}

function ownDerivedPropsBase(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  locale?: string,
): Readonly<Record<string, string | number | boolean>> | undefined {
  if (node.bindingId === "text" && node.props.slot === "value") {
    const owner = catalogPartParent(node, get, typeOf);
    if (
      owner &&
      typeOf(owner) === "LabeledValue" &&
      (node.props.children === "{formattedValue}" ||
        node.valueTemplate?.props?.children === "{formattedValue}")
    )
      return {
        children: formatLabeledValue(
          owner.props.value,
          locale,
          owner.props.formatOptions,
        ),
      };
  }
  // ADR-318: a Resizable Panel's share of its Group (the sibling Panels' `defaultSize` — one share
  //   table per Group) and its min · max on the Group's axis; a Handle takes the Group's axis.
  if (typeOf(node) === RESIZABLE_GROUP_TYPE)
    return catalogResizableGroupDerived(
      catalogResizableOrientation(node.props),
    );
  if (
    typeOf(node) === RESIZABLE_PANEL_TYPE ||
    typeOf(node) === RESIZABLE_HANDLE_TYPE
  ) {
    const group = get(node.parentId);
    if (!group || typeOf(group) !== RESIZABLE_GROUP_TYPE) return undefined;
    const orientation = catalogResizableOrientation(group.props);
    if (typeOf(node) === RESIZABLE_HANDLE_TYPE) {
      const host = get(group.parentId);
      return catalogResizableHandleDerived(
        orientation,
        !!host && typeOf(host) === RESIZABLE_PANEL_TYPE,
      );
    }
    const panels = childrenOf(group, get).filter(
      (child) => !child.hidden && typeOf(child) === RESIZABLE_PANEL_TYPE,
    );
    const at = panels.findIndex((panel) => panel.id === node.id);
    if (at < 0) return undefined;
    const shares = catalogResizablePanelShares(
      panels.map((panel) => panel.props),
    );
    // (Phase 3: a collapsible Panel that starts collapsed draws its collapsed size — the others share
    //  the rest; the Canvas draws the start state only.)
    const collapsed = panels.map((panel) =>
      catalogResizableStartCollapsed(panel.props),
    );
    const display = catalogResizableDisplay(
      shares,
      collapsed,
      panels.map((panel) => catalogResizableCollapsedSize(panel.props)),
    );
    return {
      ...catalogResizablePanelDerived(
        node.props,
        shares[at]!,
        orientation,
        display[at],
        collapsed[at],
      ),
    };
  }
  // ADR-323 Phase 2: a Timeline's direction · placement; an item's status · place · side · room.
  if (typeOf(node) === TIMELINE_TYPE) return catalogTimelineDerived(node.props);
  if (typeOf(node) === TIMELINE_ITEM_TYPE)
    return timelineItemDerivedOf(node, get, typeOf);
  // ADR-321: a StepList's direction; a Step's state · place in its list and its visual's room.
  if (typeOf(node) === STEP_LIST_TYPE)
    return catalogStepListDerived(node.props);
  if (typeOf(node) === STEP_TYPE) return stepDerivedOf(node, get, typeOf);
  if (typeOf(node) === "SelectBox") {
    const group = get(node.parentId);
    if (group && typeOf(group) === "SelectBoxGroup")
      return {
        orientation: String(group.props.orientation || "vertical"),
        isDisabled: selectBoxDisabledKeys(group.props, [
          {
            key: resolveStaticItemKey(
              node.props as Record<string, unknown>,
              node.id,
            ),
            isDisabled: node.props.isDisabled === true,
          },
        ]).includes(
          resolveStaticItemKey(node.props as Record<string, unknown>, node.id),
        ),
      };
  }
  const labelPart = catalogFieldLabelPart(node, get, typeOf);
  if (labelPart) {
    const { role, label, field, mode, required, include } = labelPart;
    const ownText = resolveTextSourceText("Text", node.props);
    const text = necessityLabel(
      required,
      typeof field.props.locale === "string" ? field.props.locale : locale,
    );
    const body =
      ownText === "{fieldLabel}" ||
      node.valueTemplate?.props?.children === "{fieldLabel}"
        ? String(label.props.children ?? "")
        : ownText;
    return {
      _fieldLabelRole: String(role),
      _fieldLabelInclude: include,
      _fieldLabelRequired: required,
      _fieldLabelAria: text,
      ...(role === "label-content" ? { children: body } : {}),
      // S2 leaves NBSP in the accessible label, separating the necessity text.
      ...(role === "necessity-label" &&
      (ownText === "{necessityLabel}" ||
        node.valueTemplate?.props?.children === "{necessityLabel}")
        ? { children: text }
        : {}),
      ...(role === "necessity-icon"
        ? {
            _iconVariant: String(
              field.props.size === "S" ? "M" : (field.props.size ?? "M"),
            ),
          }
        : {}),
    };
  }
  // ADR-256 Phase 8a: an overlay arrow's svg is its overlay's (the reference starter's — Tooltip 8,
  // Popover 12); the DOM binding draws it at that size.
  if (node.bindingId === "overlayarrow") {
    const overlay = catalogPartParent(node, get, typeOf);
    return { _arrowSize: overlay && typeOf(overlay) === "Tooltip" ? 8 : 12 };
  }
  // ADR-323 Phase 2: a TimelineItem's date Text is a `time` element when its text is an ISO date
  //   (`catalogTimelineDateTime` — the DOM's `dateTime`; another text stays a `span`).
  if (node.bindingId === "text" && node.props.slot === "date") {
    const item = get(node.parentId);
    const dateTime =
      item && typeOf(item) === TIMELINE_ITEM_TYPE
        ? catalogTimelineDateTime(node.props.children)
        : undefined;
    if (dateTime) return { _timeDateTime: dateTime };
  }
  // The Text between a DateRangePicker's two DateInputs is the reference's decorative dash
  // (`<span aria-hidden="true">–</span>`): the DOM keeps it out of the accessible name.
  if (node.bindingId === "text") {
    const group = get(node.parentId);
    const picker = group && get(group.parentId);
    if (
      group &&
      picker &&
      typeOf(picker) === "DateRangePicker" &&
      isFieldControlGroup(typeOf(group), typeOf(picker))
    )
      return { _decorative: true };
  }
  const subpart = fieldSubpartProps(node, get, typeOf, locale);
  // (ADR-322 Phase 4 — a Cascader's repeated-key notice after its description: the field's own
  //  `description` (the DOM's `useField` names it) and its Description part's text.)
  const noticeType = typeOf(node);
  if (noticeType === CASCADER_TYPE || noticeType === "Description") {
    const cascader =
      noticeType === CASCADER_TYPE
        ? node
        : catalogPartParent(node, get, typeOf);
    const text =
      cascader && typeOf(cascader) === CASCADER_TYPE
        ? cascaderDescriptionText(
            cascaderTableOf(cascader, get, typeOf),
            cascader.props,
            locale,
          )
        : undefined;
    if (text !== undefined)
      return noticeType === CASCADER_TYPE
        ? { ...subpart, description: text }
        : { ...subpart, children: text };
  }
  if (subpart) return subpart;
  // ADR-258 Phase 2: a Color control's gradient · thumb paint (its value's — the record diff
  // repaints the part when the control's value changes).
  const color = catalogColorControlDerivedProps(node, get, typeOf);
  // (S2 1.8.2 Slider · ColorSlider: the value text is `disabled` while its control is — the
  //  SliderOutput rule's tree; RAC's `data-disabled` in the DOM. 2026-11-18)
  // (S2 1.8.2 Slider · RangeSlider: the value text is `${n}ch` wide with tabular digits —
  //  `_valueChars`, the Canvas width · the DOM inline — at the end in the label container, at the
  //  start after the track — `_valueAlign`, `Slider.tsx` `output`. 2026-11-18)
  if ((node.ruleId ?? typeOf(node)) === "SliderOutput") {
    const owner = catalogPartParent(node, get, typeOf);
    const ownerType = owner && typeOf(owner);
    const slider = ownerType === "Slider" || ownerType === "RangeSlider";
    const derived = {
      ...color,
      ...(owner && slider
        ? {
            _valueChars: catalogSliderValueChars(
              owner,
              ownerType === "RangeSlider",
              locale,
            ),
            _valueAlign: catalogInLabelContainer(node, owner, get, typeOf)
              ? "end"
              : "start",
          }
        : {}),
      ...((slider || ownerType === "ColorSlider") &&
      owner!.props.isDisabled === true
        ? { isDisabled: true }
        : {}),
    };
    if (Object.keys(derived).length > 0) return derived;
  }
  if (color) return color;
  // S2 Slider parts (2026-11-18): `trackStyle: thick` — the bar 16px with the S2 sm corner, the fill
  // the same corner (`CATALOG_SLIDER_THICK_TRACK`: the Canvas height `styleOf`, the DOM inline, the
  // rules' `track-style` block); `isDisabled` — the bar · fill · thumb take S2's disabled colors
  // (RAC's `data-disabled` in the DOM); `isEmphasized` — the fill's `emphasized` variant (the DOM's
  // SliderFill `data-variant`; S2's thumb has no emphasized look). `fillOffset` rides to the fill
  // (RAC SliderFill `offset`), `thumbStyle: precise` to the thumb (its layout).
  const slider = catalogSliderOfTrackPart(node, get, typeOf);
  if (
    slider &&
    typeOf(slider) === "RangeSlider" &&
    typeOf(node) === "SliderThumb"
  ) {
    const track = catalogPartParent(node, get, typeOf);
    const index = Number(
      node.props.index ??
        node.props._thumbIndex ??
        (track
          ? partChildrenOf(track, get, typeOf)
              .filter((child) => typeOf(child) === "SliderThumb")
              .findIndex((child) => child.id === node.id)
          : 0),
    );
    return {
      name: String(
        (index === 1 ? slider.props.endName : slider.props.startName) ?? "",
      ),
      form: String(slider.props.form ?? ""),
      thumbLabel: index === 1 ? "Maximum" : "Minimum",
      ...(slider.props.isDisabled === true ? { isDisabled: true } : {}),
      ...(slider.props.thumbStyle === "precise"
        ? { thumbStyle: "precise" }
        : {}),
    };
  }
  if (slider) {
    const derived: Record<string, string | number | boolean> = {};
    const type = node.ruleId ?? typeOf(node);
    if (slider.props.isDisabled === true) derived.isDisabled = true;
    if (type === "SliderFill" && slider.props.isEmphasized === true)
      derived.variant = "emphasized";
    if (
      (type === "SliderFill" || type === "SliderTrackBar") &&
      slider.props.trackStyle === "thick"
    )
      derived.trackStyle = "thick";
    const offset = Number(slider.props.fillOffset);
    if (
      (node.ruleId ?? typeOf(node)) === "SliderFill" &&
      Number.isFinite(offset)
    )
      derived._fillOffset = offset;
    if (typeOf(node) === "SliderThumb" && slider.props.thumbStyle === "precise")
      derived.thumbStyle = "precise";
    return Object.keys(derived).length ? derived : undefined;
  }
  // RAC owns the DOM value. Canvas reads the same resting text and distinguishes it from
  // the placeholder, whose color is independent of hover/disabled input text.
  const valueField = catalogFieldOfInput(node, get, typeOf);
  if (valueField) {
    const fieldType = typeOf(valueField);
    let text = String(
      valueField.props.value ?? valueField.props.defaultValue ?? "",
    );
    // (ADR-326 Phase 4: a Cascader's search opens empty — `catalogCascaderSearchField`.)
    if (catalogCascaderSearchField(valueField, get, typeOf)) text = "";
    if (fieldType === "NumberField")
      text = catalogNumberFieldText(valueField, locale);
    if (fieldType === "ColorField" && text) {
      try {
        text = parseColor(text).toString("hex");
      } catch {
        text = "";
      }
    }
    if (fieldType === "ComboBox") {
      const selected = catalogComboBoxSelectedOption(valueField, get, typeOf);
      text = String(
        valueField.props.inputValue ??
          valueField.props.defaultInputValue ??
          (selected
            ? childrenOf(selected, get)
                .filter((child) => child.props.slot === "label")
                .map((child) => String(child.props.children ?? ""))
                .join("") ||
              selected.props.textValue ||
              ""
            : ""),
      );
    }
    if (valueField.props.type === "password")
      text = "•".repeat([...text].length);
    // These editable field parts expose the owner's raw value, including the empty state.
    // RAC still owns DOM input state; Canvas uses this channel to edit the owner prop.
    const editableValue: Record<string, string> =
      fieldType === "TextArea" || fieldType === "ColorField"
        ? { value: String(valueField.props.value ?? "") }
        : {};
    return text
      ? { ...editableValue, placeholder: text, _inputHasValue: true }
      : { ...editableValue, _inputHasValue: false };
  }
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
  // ADR-256 Phase 8c: the Disclosure trigger's chevron turns with the expansion (the sheet's
  // `[aria-expanded='true'] .react-aria-Icon[data-icon='chevron-right'] svg`) — the Canvas draws the turned
  // glyph, as the Tree chevron's.
  if (node.bindingId === "icon") {
    const owner = catalogDisclosureOfTriggerPart(node, get, typeOf);
    if (owner)
      return node.props.iconName === "chevron-right" &&
        catalogDisclosureExpanded(owner, get, typeOf)
        ? { iconName: "chevron-down" }
        : undefined;
  }
  // (2026-11-14) An ActionButton's count badge (S2 NotificationBadge): its place follows what the button
  //   shows beside it — an icon · avatar with words, one alone, words alone (`catalogActionBadgeLayout`).
  if (typeOf(node) === "Badge") {
    const button = get(node.parentId);
    if (button && typeOf(button) === "ActionButton") {
      const content = catalogActionBadgeContent(button, get, typeOf);
      // (S2 `NotificationBadgeContext` `staticColor`: the button's — its group's over its own.)
      const staticColor =
        button.derivedProps?.staticColor ?? button.props.staticColor;
      return {
        _actionBadge: content,
        _actionBadgeSize: String(button.props.size ?? "M"),
        ...(staticColor === "white" ||
        staticColor === "black" ||
        staticColor === "auto"
          ? { staticColor }
          : {}),
      };
    }
  }
  if (typeOf(node) === "ActionButton" || typeOf(node) === "ToggleButton") {
    // (S2 `iconOnly`: an icon or an avatar and no words — the count badge is drawn over it, 2026-11-14.)
    const visible = childrenOf(node, get).filter(
      (child) => !child.hidden && typeOf(child) !== "Badge",
    );
    const iconOnly =
      visible.length > 0 &&
      visible.every((child) => ["Icon", "Avatar"].includes(typeOf(child))) &&
      !node.props.children;
    const derived: Record<string, string | boolean> = {
      _actionIconOnly: typeOf(node) === "ActionButton" && iconOnly,
      _overlayOpen: catalogOverlayOpen(node, get, typeOf),
    };
    const group =
      typeOf(node) === "ActionButton"
        ? catalogActionButtonGroupOf(node, get, typeOf)
        : catalogToggleGroupOf(node, get, typeOf);
    if (!group) return derived;
    derived._inActionGroup = true;
    for (const key of [
      "size",
      "isQuiet",
      "isEmphasized",
      "staticColor",
      "density",
      "orientation",
    ])
      if (
        (typeof group.props[key] === "string" && group.props[key] !== "") ||
        typeof group.props[key] === "boolean"
      )
        derived[key] = group.props[key] as string | boolean;
    if (group.props.isJustified === true) derived._justified = true;
    const siblings = childrenOf(get(node.parentId)!, get).filter(
      (child) => !child.hidden,
    );
    derived._actionFirst = siblings[0]?.id === node.id;
    derived._actionLast = siblings.at(-1)?.id === node.id;
    return derived;
  }
  // RAC Breadcrumbs draws its last crumb as the current one (no separator, current paint); the
  // crumb's label Text inherits the current Link's weight.
  if (typeOf(node) === "Breadcrumb")
    return { _isLast: !catalogBreadcrumbSeparator(node, get, typeOf) };
  const tabsOwner = catalogTabsOfTab(node, get, typeOf);
  if (tabsOwner)
    return {
      orientation:
        tabsOwner.props.orientation === "vertical" ? "vertical" : "horizontal",
      isDisabled:
        node.props.isDisabled === true ||
        tabsOwner.props.isDisabled === true ||
        catalogGroupDisabledKeys(tabsOwner.props).includes(
          catalogItemKey(node, typeOf),
        ),
    };
  // (its SelectionIndicator node — ADR-256 Phase 5e: `catalogSelectionIndicatorLayout`)
  if (node.bindingId === "segmentedcontrolitem") {
    const group = catalogSegmentOwner(node, get);
    return {
      _isSelected: catalogStateValue(node, "isSelected", get, typeOf),
      isDisabled:
        node.props.isDisabled === true || group?.props.isDisabled === true,
      ...(group?.props.isJustified ? { _justified: true } : {}),
    };
  }
  if (typeOf(node) === "SelectionIndicator") {
    const tab = catalogPartParent(node, get, typeOf);
    // (A Card's — S2 `SelectionIndicator`, 2026-11-18: S2's own div, not RAC's. In a CardView it
    //  reads its RAC item's selection; a standalone Card has no RAC item, so it gets the Card's.)
    if (tab && typeOf(tab) === "Card") {
      const view = catalogCollectionOfItem(tab, get, typeOf);
      return view && typeOf(view) === "CardView"
        ? { _cardIndicator: true }
        : {
            _cardIndicator: true,
            _isSelected: catalogIndicatorItemSelected(tab, get, typeOf),
          };
    }
    const tabs = tab && catalogTabsOfTab(tab, get, typeOf);
    if (tab && tabs)
      return {
        orientation:
          tabs.props.orientation === "vertical" ? "vertical" : "horizontal",
        isDisabled:
          tab.props.isDisabled === true ||
          tabs.props.isDisabled === true ||
          catalogGroupDisabledKeys(tabs.props).includes(
            catalogItemKey(tab, typeOf),
          ),
      };
  }
  const crumb = get(node.parentId);
  // A crumb's separator Icon follows its Breadcrumbs' `separatorIcon` (user decision 2026-11-13)
  //   while it is still the rule's default glyph — a separator the author changed keeps its own.
  if (
    crumb &&
    typeOf(crumb) === "Breadcrumb" &&
    typeOf(node) === "Icon" &&
    node.props.slot === "separator"
  ) {
    const list = get(crumb.parentId);
    const listIcon =
      list && typeOf(list) === "Breadcrumbs"
        ? list.props.separatorIcon
        : undefined;
    return typeof listIcon === "string" &&
      listIcon &&
      // (The rule's default glyph — catalog `Breadcrumb` `trailingIcon`, S2 Chevron.)
      node.props.iconName === catalogBreadcrumbSeparatorIcon(undefined).name
      ? { _ownerIconName: listIcon }
      : undefined;
  }
  if (
    crumb &&
    typeOf(crumb) === "Breadcrumb" &&
    // (By id: an edit's incremental rebuild hands a new record object — `includes(node)` missed it
    //   and the current crumb lost its weight after any edit.)
    catalogBreadcrumbLabels(crumb, get, typeOf).some(
      (label) => label.id === node.id,
    )
  ) {
    const owner = get(crumb.parentId);
    return {
      _isLast: !catalogBreadcrumbSeparator(crumb, get, typeOf),
      // S2 `linkStyles` color `isDisabled: 'disabled'` — RAC Breadcrumbs' `isDisabled` reaches every
      // crumb (`catalogTextMetrics` paints the link label; the current crumb stays `neutral`).
      ...(crumb.props.isDisabled === true ||
      (owner &&
        typeOf(owner) === "Breadcrumbs" &&
        owner.props.isDisabled === true)
        ? { _crumbDisabled: true }
        : {}),
      // A crumb's Link rests without the Link rule's underline (`Breadcrumbs.css`
      // `.react-aria-Link { text-decoration: none }`; hover is the Preview's).
      ...(typeOf(node) === "Link" ? { _noUnderline: true } : {}),
    };
  }
  // ADR-256 Phase 9 — a calendar's parts show the month of their month block (the block's copy
  // index — RAC's `offset`), from the calendar's own props (`calendarModel.ts`): the heading RAC's
  // `CalendarHeading` text, the grid its weekday row and week rows in the calendar's locale and
  // calendar system (`I18nProvider` around the RAC Calendar).
  const partType = typeOf(node);
  // (A plain Heading in a calendar's header takes RAC Calendar's `HeadingContext` — the visible
  // range's title, `useVisibleRangeDescription`.)
  if (partType === "Heading") {
    // (its heading group — S2's `div.heading` in the header row, 2026-11-18)
    const header = get(node.parentId);
    const calendar =
      header && typeOf(header) === "CalendarMonth"
        ? catalogCalendarOf(header, get, typeOf)
        : undefined;
    if (calendar)
      return {
        children: catalogCalendarRangeTitle(
          calendarModelInput(calendar, get, typeOf),
          locale,
        ),
      };
  }
  // A calendar's month · year picker: RAC's focused month · year (its Select's value — the picker's
  // `{formatted}` item text and the value its trigger shows).
  if (partType === "CalendarMonthPicker" || partType === "CalendarYearPicker") {
    const calendar = catalogCalendarOf(node, get, typeOf);
    if (calendar)
      return {
        _formatted: catalogCalendarPickerText(
          calendarModelInput(calendar, get, typeOf),
          partType === "CalendarMonthPicker" ? "month" : "year",
          locale,
          undefined,
          node.props.format,
        ),
      };
  }
  // A calendar heading group's month · year pickers in the calendar's locale order (`_childOrder` —
  // the Canvas engine's child order and the DOM's render order, composition extension).
  if (partType === "CalendarMonth") {
    const calendar = catalogCalendarOf(node, get, typeOf);
    const order =
      calendar &&
      catalogCalendarHeaderOrder(
        node.children,
        (id) => {
          const child = get(id);
          return child ? typeOf(child) : undefined;
        },
        catalogCalendarYearFirst(
          calendarModelInput(calendar, get, typeOf),
          locale,
        ),
      );
    if (order) return { _childOrder: JSON.stringify(order) };
  }
  if (partType === "SelectValue") {
    // (ADR-322: a Cascader's value text — the start value's path (or name), the placeholder while
    //  nothing is picked — `runtime/cascader.ts`, the DOM reads the same record.)
    const cascader = catalogCascaderOfTriggerPart(node, get, typeOf);
    if (cascader) {
      const text = cascaderValueText(
        cascaderTableOf(cascader, get, typeOf),
        cascader.props,
        undefined,
        locale,
      );
      return text === undefined ? undefined : { children: text };
    }
    const picker = catalogCalendarPickerOfValue(node, get, typeOf);
    const formatted = picker && ownDerivedProps(picker, get, typeOf, locale);
    if (typeof formatted?._formatted === "string")
      return { children: formatted._formatted };
  }
  if (partType === "CalendarHeading" || partType === "CalendarGrid") {
    const calendar = catalogCalendarOf(node, get, typeOf);
    if (calendar) {
      const input = calendarModelInput(calendar, get, typeOf);
      const month = catalogCalendarMonthOf(node, get, typeOf);
      const offset = month ? catalogCalendarMonthIndex(month) : 0;
      if (partType === "CalendarHeading")
        return {
          children: catalogCalendarHeading(input, offset, locale),
        };
      const system = calendar.props.calendarSystem;
      return {
        locale: catalogCalendarLocale({ locale: input.locale }, locale),
        calendarSystem: typeof system === "string" ? system : "",
        _calendarGrid: JSON.stringify(
          catalogCalendarGrid(input, offset, locale),
        ),
      };
    }
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
    // (and its `staticColor` — the sheet's static `--fill-color`, ADR-256 후속 11)
    for (const key of ["variant", "size", "staticColor"])
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
  // (`staticColor`: the sheet's static track — the static color at the rule's `staticAlpha`.)
  for (const key of ["variant", "size", "staticColor"])
    if (typeof owner.props[key] === "string")
      out[key] = owner.props[key] as string;
  return out;
}

/**
 * ADR-303 — the `{color.container}` readers whose layer an owner decides: its descendants down to
 * the next container (that one decides below itself). Only when the owner's own layer changed
 * (`before` = the record it replaces — none for a new record): an edit that leaves it the same
 * container (or still none) changes nothing below it, so a large frame's resize · style edit does
 * not walk its subtree. (A move re-plans the moved subtree itself — G2 `move` rows.)
 */
export function catalogContainerDependents(
  owner: CatalogConsumerNode,
  before: CatalogConsumerNode | undefined,
  get: CatalogRecordLookup,
): CatalogConsumerNode[] {
  if (
    before &&
    catalogContainerLayerOf(before) === catalogContainerLayerOf(owner)
  )
    return [];
  const out: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of childrenOf(node, get)) {
      if (catalogDerivesContainerLayer(child)) out.push(child);
      if (!catalogContainerLayerOf(child)) visit(child);
    }
  };
  visit(owner);
  return out;
}

/**
 * ADR-317 Phase 5 — a striped Table's Row (`striped`) · a merged run's Cell (`cellStripe`), not
 * while the row is selected (`selected` — the Row's own, read once by the caller).
 */
function catalogStripeProps(
  node: CatalogConsumerNode,
  selected: boolean | undefined,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string> {
  const type = typeOf(node);
  if (type === "Row")
    return selected !== true && catalogRowStriped(node, get, typeOf)
      ? { striped: "true" }
      : {};
  if (type !== "Cell") return {};
  const stripe = catalogCellStripe(node.props);
  if (!stripe) return {};
  const row = get(node.parentId);
  return row && catalogCollectionItemSelected(row, get, typeOf) === true
    ? {}
    : { cellStripe: stripe };
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
  // Editing a selected option or its label also changes the ComboBox input text.
  const comboInputs: CatalogConsumerNode[] = [];
  if (["ListBoxItem", "Text"].includes(typeOf(owner))) {
    for (
      let parent = get(owner.parentId);
      parent;
      parent = get(parent.parentId)
    ) {
      if (typeOf(parent) === "ComboBox") {
        comboInputs.push(
          ...fieldSubparts(parent, get, typeOf).filter(
            (child) => typeOf(child) === "Input",
          ),
        );
        break;
      }
    }
  }
  // An item's label Text takes the item's color (`catalogItemLabels`): it follows the item's own
  // values and every item whose selection this record decides.
  // (A CardView's · Table's · Tree's ActionBar counts its selection — and its count text.)
  const linkedBar = catalogLinkedActionBarOf(owner, get, typeOf);
  const items = [
    ...comboInputs,
    ...(linkedBar
      ? [linkedBar, ...catalogValueDependents(linkedBar, get, typeOf)]
      : []),
    ...catalogFieldLabelPartsDependents(owner, get, typeOf),
    ...(OVERLAY_OPEN_OWNERS.has(typeOf(owner))
      ? partChildrenOf(owner, get, typeOf).filter(
          (child) => typeOf(child) === "ActionButton",
        )
      : []),
    ...(typeOf(owner) === "SheetOverlay"
      ? partChildrenOf(owner, get, typeOf).filter(
          (child) => typeOf(child) === "Sheet",
        )
      : []),
    // (A Dialog's `isDismissible` is its Modal's `_dialogDismissible`.)
    ...(typeOf(owner) === "Dialog"
      ? [catalogPartParent(owner, get, typeOf)].filter(
          (parent): parent is CatalogConsumerNode =>
            !!parent && typeOf(parent) === "Modal",
        )
      : []),
    ...derivedDependents(owner, get, typeOf),
    // (ADR-318: a Group's Panels · Handles take its axis; a Panel's size moves its sibling Panels'
    //  shares. G1 live 2026-11-26: without it the Canvas kept the other Panel's 50 after a
    //  `defaultSize` 30 and the Handle's row thickness after `orientation` vertical. The unit root
    //  of `adr318ResizableWiring.test.tsx` did not show it — the live harness is its gate.)
    ...(typeOf(owner) === RESIZABLE_GROUP_TYPE
      ? childrenOf(owner, get)
      : typeOf(owner) === RESIZABLE_PANEL_TYPE &&
          get(owner.parentId) &&
          typeOf(get(owner.parentId)!) === RESIZABLE_GROUP_TYPE
        ? childrenOf(get(owner.parentId)!, get).filter(
            (child) =>
              child.id !== owner.id && typeOf(child) === RESIZABLE_PANEL_TYPE,
          )
        : []),
    // (ADR-323 Phase 2: a Timeline's orientation · placement · size reach its items; an item's
    //  place (one more · one fewer · hidden) moves its siblings' index · last · side.)
    ...(typeOf(owner) === TIMELINE_TYPE
      ? timelineItemsOf(owner, get, typeOf, true)
      : typeOf(owner) === TIMELINE_ITEM_TYPE &&
          get(owner.parentId) &&
          typeOf(get(owner.parentId)!) === TIMELINE_TYPE
        ? timelineItemsOf(get(owner.parentId)!, get, typeOf, true).filter(
            (item) => item.id !== owner.id,
          )
        : []),
    // (ADR-321: a StepList's keys · orientation · emphasis reach its Steps and their Texts' color;
    //  a Step's key · disabled · place moves its sibling steps' states — and its own Texts.)
    ...(typeOf(owner) === STEP_LIST_TYPE
      ? stepsOf(owner, get, typeOf).flatMap((step) => [
          step,
          ...childrenOf(step, get),
        ])
      : typeOf(owner) === STEP_TYPE &&
          get(owner.parentId) &&
          typeOf(get(owner.parentId)!) === STEP_LIST_TYPE
        ? stepsOf(get(owner.parentId)!, get, typeOf).flatMap((step) => [
            ...(step.id === owner.id ? [] : [step]),
            ...childrenOf(step, get),
          ])
        : []),
    // (ADR-308: a picker's options take its selection — their `_isSelected` · check marks.)
    ...(typeOf(owner) === "Select" || typeOf(owner) === "ComboBox"
      ? catalogPickerOptions(owner, get, typeOf)
      : []),
    // (S2 체크리스트 §9.3: its SelectValue shows its value shape while something is selected.)
    ...(typeOf(owner) === "Select"
      ? catalogSelectValues(owner, get, typeOf)
      : []),
    ...fieldSubparts(owner, get, typeOf),
    // (A Button's children follow its `isPending` — `_pendingHidden`, `buttonPending.ts`.)
    ...(["Button", "ActionButton"].includes(typeOf(owner))
      ? childrenOf(owner, get)
      : []),
    // (A Color control's gradient · thumb parts — ADR-258 Phase 2.)
    ...catalogColorControlParts(owner, get, typeOf),
    // (A Table's select-all checkboxes follow its selection mode and its rows — Phase 5i-2.)
    ...catalogTableSelectAllCheckboxes(owner, get, typeOf),
    // (A Column's menu ⋮ follows its `isMenu` — S2 `ColumnWithMenu`.)
    ...(typeOf(owner) === "Column"
      ? [catalogColumnContent(owner, get, typeOf)]
          .filter((wrapper): wrapper is CatalogConsumerNode => !!wrapper)
          .flatMap((wrapper) => childrenOf(wrapper, get))
          .filter((child) => typeOf(child) === "Icon")
      : []),
    // (ADR-257: its Table's header row and Rows lay out on the Columns' tracks.)
    ...catalogTableTrackDependents(owner, get, typeOf),
    // (ADR-300 Decision 3 ⑤: a panel's · nav's · item's change re-derives the parts below.)
    ...catalogSideNavDependents(owner, get, typeOf),
    // The box a quiet field's own rule styles (`ownerStyledQuietBox`).
    ...childrenOf(owner, get).filter(
      (child) => QUIET_OWNER_BOXES[typeOf(owner)] === typeOf(child),
    ),
    ...(typeOf(owner) === "Select" || typeOf(owner) === CASCADER_TYPE
      ? childrenOf(owner, get)
          .filter((child) => typeOf(child) === "Button")
          .flatMap((button) => childrenOf(button, get))
      : []),
    // (Its grouped Disclosures: which one is its last child — `catalogAccordionPosition`.)
    ...childrenOf(owner, get).filter(
      (child) =>
        typeOf(child) === "Disclosure" &&
        !!catalogAccordionOf(child, get, typeOf),
    ),
    // (A list's · a section's items: which is the last — `catalogListItemEdges`.)
    ...(typeOf(owner) === "ListBox" || typeOf(owner) === "ListBoxSection"
      ? childrenOf(owner, get).filter(
          (child) => typeOf(child) === "ListBoxItem",
        )
      : []),
  ];
  return [
    ...items,
    ...partChildrenOf(owner, get, typeOf).filter(
      (label) =>
        catalogToggleButtonGlyphOwner(label, get, typeOf)?.id === owner.id,
    ),
    ...[owner, ...items].flatMap((item) => [
      ...catalogItemLabels(item, get, typeOf),
      ...(["Checkbox", "Radio", "Switch"].includes(typeOf(item))
        ? partChildrenOf(item, get, typeOf).flatMap((button) =>
            partChildrenOf(button, get, typeOf).filter(
              (label) =>
                catalogToggleButtonGlyphOwner(label, get, typeOf)?.id ===
                item.id,
            ),
          )
        : []),
      ...(["ToggleButton", "ActionButton", "Button"].includes(typeOf(item))
        ? partChildrenOf(item, get, typeOf).filter(
            (glyph) =>
              catalogToggleButtonGlyphOwner(glyph, get, typeOf)?.id === item.id,
          )
        : []),
      // (its selection indicators — their bar follows the Tab's orientation, ADR-256 Phase 5e)
      ...catalogSelectionIndicators(item, get, typeOf),
      // (its selection checkboxes — the item's selection and selectability, Phase 5f)
      ...catalogSelectionCheckboxes(item, get, typeOf),
      // (a TreeItem's chevron and label — they take a disabled item's color, which its Tree's
      //  `disabledKeys` can turn on: 부록 D.3 2단계)
      ...(item !== owner ? catalogTreeChevrons(item, get, typeOf) : []),
      // (a Card's checkbox plate — its spacing follows the Card's size, S2 `CardCheckbox` — and its
      //  sections: the spacing · padding follow its size · density · variant, `catalogCardSection`)
      ...(typeOf(item) === "Card" ? childrenOf(item, get) : []),
      // (…and a section's siblings: which section is first · last — its own presence decides it)
      ...(item === owner &&
      CARD_SECTION_TYPES.has(typeOf(item)) &&
      get(item.parentId) &&
      typeOf(get(item.parentId)!) === "Card"
        ? childrenOf(get(item.parentId)!, get).filter(
            (sibling) => sibling.id !== item.id,
          )
        : []),
      ...partChildrenOf(item, get, typeOf).filter(
        (child) =>
          catalogPickerSelectionItem(child, get, typeOf)?.id === item.id,
      ),
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
 * Input's quiet state and a SearchField's · NumberField's value), direct or inside its control Group.
 */
function fieldSubparts(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  // (A SearchField's clear Button — in its Group — passes its glyph the field's size.)
  const inner = (child: CatalogConsumerNode): CatalogConsumerNode[] =>
    typeOf(child) === "Group" ||
    (typeOf(owner) === "SearchField" && typeOf(child) === "Button")
      ? [child, ...partChildrenOf(child, get, typeOf).flatMap(inner)]
      : [child];
  return partChildrenOf(owner, get, typeOf)
    .flatMap(inner)
    .filter(
      (child) =>
        fieldSubpartProps(child, get, typeOf) !== undefined ||
        typeOf(child) === "Input" ||
        // (ADR-259 Phase 2: a prefix box shows its field's quiet · invalid state.)
        !!catalogFieldBox(child, get, typeOf),
    );
}

function derivedDependents(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  // (A Checkbox's help text follows its group and size — `_toggleItemHelp`, 2026-11-15.)
  if (typeOf(owner) === "Checkbox")
    return childrenOf(owner, get).filter(
      (child) => typeOf(child) === "Description",
    );
  if (typeOf(owner) === "RadioGroup" || typeOf(owner) === "CheckboxGroup")
    return catalogToggleGroupItems(
      owner,
      typeOf(owner) === "RadioGroup" ? "Radio" : "Checkbox",
      get,
      typeOf,
    ).items;
  const type = typeOf(owner);
  if (type === "ActionBar") {
    const descendants = (record: CatalogConsumerNode): CatalogConsumerNode[] =>
      childrenOf(record, get).flatMap((child) => [
        child,
        ...descendants(child),
      ]);
    return descendants(owner);
  }
  const track = PROGRESS_TRACKS[type];
  if (track) {
    const tracks = childrenOf(owner, get).filter(
      (child) => typeOf(child) === track,
    );
    // (its label and value text — their `staticColor`, `catalogProgressStaticText`)
    // (the Label through its label row — S2 `FieldLabel`)
    const texts = partChildrenOf(owner, get, typeOf).filter(
      (child) =>
        typeOf(child) === "Label" || typeOf(child) === PROGRESS_VALUES[type],
    );
    // (and the fill in each track — ADR-256 Phase 7a)
    const fill = PROGRESS_FILLS[type];
    return fill
      ? [
          ...tracks,
          ...texts,
          ...tracks.flatMap((part) =>
            childrenOf(part, get).filter((child) => typeOf(child) === fill),
          ),
        ]
      : [...tracks, ...texts];
  }
  if (type === "SegmentedControl")
    return [
      ...new Map(
        catalogSegmentItems(owner, get)
          .flatMap((item) => [
            item,
            ...childrenOf(item, get),
            ...partChildrenOf(item, get, typeOf),
          ])
          .map((part) => [part.id, part]),
      ).values(),
    ];
  if (type === "Tabs") return catalogTabsSelection(owner, get, typeOf).tabs;
  // (A Nav's `selectedRoute` moves the current mark among its Links.)
  if (type === "Nav") return catalogNavLinks(owner, get, typeOf);
  if (type === "ButtonGroup") return buttonGroupButtons(owner, get, typeOf);
  if (type === "FileUpload") return fileUploadInputs(owner, get, typeOf);
  if (ACTION_GROUP_TYPES.has(type))
    return actionGroupButtons(owner, get, typeOf).flatMap((button) => [
      button,
      ...childrenOf(button, get),
    ]);
  // (An InlineAlert's texts follow its bold fill — `catalogInlineAlertBoldText`.)
  if (type === "InlineAlert") {
    const texts: CatalogConsumerNode[] = [];
    const visit = (record: CatalogConsumerNode) => {
      for (const child of childrenOf(record, get)) {
        if (INLINE_ALERT_TEXT_TYPES.has(typeOf(child))) texts.push(child);
        visit(child);
      }
    };
    visit(owner);
    if (texts.length) return texts;
  }
  // (A NumberField's stepper Buttons follow its `hideStepper` — `catalogStepperHidden`.)
  if (type === "NumberField") {
    const steppers: CatalogConsumerNode[] = [];
    const visit = (record: CatalogConsumerNode) => {
      for (const child of childrenOf(record, get))
        if (
          child.props.slot === "increment" ||
          child.props.slot === "decrement"
        )
          steppers.push(child);
        else visit(child);
    };
    visit(owner);
    if (steppers.length) return steppers;
  }
  // (A ToggleButtonGroup's `staticColor` is its ToggleButtons' — at any depth in the group.)
  if (type === "ToggleButtonGroup")
    return catalogToggleGroupItems(owner, "ToggleButton", get, typeOf).items;
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
      // (Its `separatorIcon` is its crumbs' separator glyph.)
      ...childrenOf(crumb, get).filter(
        (child) => typeOf(child) === "Icon" && child.props.slot === "separator",
      ),
    ]);
  // (A crumb's own `isDisabled` is its labels' disabled paint.)
  if (type === "Breadcrumb") return catalogBreadcrumbLabels(owner, get, typeOf);
  // ADR-256 Phase 9: a calendar's headings and grids show its months (in its month blocks).
  if (CALENDAR_TYPES.has(type)) return calendarModelParts(owner, get, typeOf);
  // A calendar month · year picker's `format` is its Select's value text (the SelectValue).
  if (type === "CalendarMonthPicker" || type === "CalendarYearPicker") {
    const values: CatalogConsumerNode[] = [];
    const visit = (record: CatalogConsumerNode) => {
      for (const child of childrenOf(record, get)) {
        if (typeOf(child) === "SelectValue") values.push(child);
        visit(child);
      }
    };
    visit(owner);
    return values;
  }
  // A picker's first day, bounds and value (ADR-309) are its calendar's (`calendarPicker`).
  if (PICKER_TYPES.has(type))
    return [
      ...childrenOf(owner, get)
        .filter((popover) => typeOf(popover) === "Popover")
        .flatMap((popover) => childrenOf(popover, get))
        // (S2 `CalendarPopover`: the calendar in the Popover's Dialog)
        .flatMap((child) =>
          typeOf(child) === "Dialog" ? childrenOf(child, get) : [child],
        )
        .filter((calendar) => CALENDAR_TYPES.has(typeOf(calendar)))
        .flatMap((calendar) => calendarModelParts(calendar, get, typeOf)),
      // (and its time fields' inputs — the picker's time value, S2 `CalendarPopover`)
      ...pickerTimeParts(owner, get, typeOf)
        .filter((part) => typeOf(part) === "TimeField")
        .flatMap((field) => dateInputsOf(field, get, typeOf)),
    ];
  // A Disclosure's header turns its chevron with the expansion — inside an Accordion every
  // sibling's (the group's expanded keys).
  if (type === "Disclosure" || type === "Accordion") {
    const group =
      type === "Accordion" ? owner : catalogAccordionOf(owner, get, typeOf);
    const disclosures = group
      ? catalogGroupDisclosures(group, get, typeOf).disclosures
      : [owner];
    // (ADR-256 Phase 8c: its trigger's chevron Icon.)
    return disclosures.flatMap((disclosure) =>
      catalogDisclosureTriggerIcons(disclosure, get, typeOf),
    );
  }
  const parent = get(owner.parentId);
  return type === "TreeItem" && parent && typeOf(parent) === "TreeItem"
    ? [parent]
    : [];
}

/**
 * A Tab/Tag's label Text children: `.react-aria-Tab/Tag .react-aria-Text { color: inherit }`
 * (`MANUAL_ITEM_LABEL_COLORS`) — they take the item's variant/state/selection color. A ListBox
 * item's icon too (`iconSlots` — S2 `currentColor`, 2026-11-22).
 */
export function catalogItemLabels(
  item: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const colors = MANUAL_ITEM_LABEL_COLORS[typeOf(item)];
  // (Through layout frames — a Tag's texts sit in its content `div`, S2 `TagWrapper`, 2026-11-18.)
  return colors
    ? partChildrenOf(item, get, typeOf).filter(
        (child) =>
          typeOf(child) === "Text" ||
          (typeOf(child) === "Icon" &&
            !!colors.iconSlots?.includes(String(child.props.slot))),
      )
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
 * ADR-256 Phase 5e — a vertical TabList's indicator bar (`TabsIndicator.css` vertical: 2px wide,
 * the Tab's height) at its leading edge, 12px before the tab content.
 */
export function catalogSelectionIndicatorLayout(
  node: CatalogConsumerNode,
): Record<string, string> | undefined {
  // (A Card's selection Checkbox at the card's spacing from its corner — `_cardSpacing`.)
  const spacing = node.derivedProps?._cardSpacing;
  if (typeof spacing === "number")
    return { insetTop: `${spacing}px`, insetLeft: `${spacing}px` };
  return node.bindingId === "selectionindicator" &&
    node.derivedProps?.orientation === "vertical"
    ? {
        width: "2px",
        height: "100%",
        insetLeft: "-12px",
        insetRight: "auto",
        insetTop: "0px",
      }
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
  if (!["Slider", "RangeSlider"].includes(typeOf(slider))) return [];
  // (and its fill — ADR-256 Phase 7c: RAC's SliderFill follows the same values; the bar follows the
  //  Slider's `trackStyle` · `isDisabled` — the derived thick · disabled bar.)
  return partChildrenOf(slider, get, typeOf)
    .filter((child) =>
      // (its value text — the disabled color)
      ["SliderTrack", "SliderOutput"].includes(typeOf(child)),
    )
    .flatMap((track) =>
      typeOf(track) === "SliderOutput"
        ? [track]
        : [
            track,
            ...catalogSliderTrackParts(track, get, typeOf).filter((child) =>
              ["SliderThumb", "SliderFill", "SliderTrackBar"].includes(
                typeOf(child),
              ),
            ),
          ],
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
  // (ADR-322: S2 Picker's label row — Select's.)
  cascader: "necessity",
  combobox: "necessity",
  // (S2 체크리스트 §4.1 TokenField Phase 4 — S2 TextArea's FieldLabel)
  tokenfield: "necessity",
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

/** 실제 작성된 필드 Label 자식. slot은 편집 가능한 부품의 역할을 지정한다. */
export function catalogComposedFieldLabel(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (node.bindingId !== "label") return false;
  const owner = catalogPartParent(node, get, typeOf);
  return (
    !!owner && CATALOG_LABEL_NODE_FIELDS[owner.bindingId ?? ""] === "necessity"
  );
}
export function catalogFieldLabelPart(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
) {
  const role = node.props.slot;
  if (
    ![
      "label-content",
      "necessity-icon",
      "necessity-label",
      "necessity-space",
    ].includes(String(role))
  )
    return;
  const label = get(node.parentId);
  if (!label || typeOf(label) !== "Label") return;
  const field = catalogPartParent(label, get, typeOf);
  if (
    !field ||
    CATALOG_LABEL_NODE_FIELDS[field.bindingId ?? ""] !== "necessity"
  )
    return;
  const mode =
    catalogFieldNecessityIndicator(
      field,
      (entry) => get(entry.parentId),
      typeOf,
    ) ?? "icon";
  const required = catalogInheritedFlag(field, "isRequired", get, typeOf);
  const empty = String(label.props.children ?? "") === "";
  const hidden =
    empty ||
    (role === "necessity-icon"
      ? !required || mode !== "icon"
      : role === "necessity-label"
        ? mode !== "label"
        : role === "necessity-space"
          ? !(required || mode === "label") ||
            !childrenOf(label, get).some(
              (child) =>
                child.props.slot ===
                (mode === "label" ? "necessity-label" : "necessity-icon"),
            )
          : false);
  return {
    role,
    label,
    field,
    required,
    mode,
    hidden,
    include: ["Select", "Cascader", "CheckboxGroup"].includes(typeOf(field)),
  };
}
export function catalogFieldLabelPartsHidden(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  return (
    (catalogComposedFieldLabel(node, get, typeOf) &&
      node.presentWhen === "nonEmptyText" &&
      String(node.props.children ?? "") === "") ||
    catalogFieldLabelPart(node, get, typeOf)?.hidden === true
  );
}
/**
 * A field's label row (S2 `FieldLabel` — `Field.tsx`: `if (!props.children) return null`) is absent
 * with its Label: no label text, no row (its help with it). The Canvas, the DOM and the Layers tree
 * read this one predicate; the row is the presence scope of its Label (`catalogPresenceScope`).
 */
export function catalogFieldLabelRowAbsent(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(node) !== "FieldLabel") return false;
  const label = childrenOf(node, get).find(
    (child) => typeOf(child) === "Label",
  );
  return (
    !!label &&
    (catalogAbsentByValue(label) ||
      catalogFieldLabelPartsHidden(label, get, typeOf))
  );
}
/**
 * The color S2 `FieldLabel` gives the Label in its row — `fieldLabel()` `neutral-subdued`, the
 * FieldLabel rule's `.react-aria-Label` block (its generated sheet carries the same) — for a row's
 * Label whose text is its own: a Meter's · ProgressBar's · LabeledValue's. A field's composed Label
 * holds its text in parts that take the color themselves (the Label rule's `label-content` block,
 * disabled included). Undefined for any other node.
 */
export function catalogFieldLabelRowColor(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string | undefined {
  if (typeOf(node) !== "Label") return undefined;
  const row = get(node.parentId);
  if (!row || typeOf(row) !== "FieldLabel") return undefined;
  if (catalogComposedFieldLabel(node, get, typeOf)) return undefined;
  // (A field whose color tree paints its Label — a Slider's `neutral-subdued` · `disabled`, S2
  //  `FieldLabel isDisabled` — keeps it: `catalogToggleButtonGlyphOwner`, 2026-11-18.)
  if (catalogToggleButtonGlyphOwner(node, get, typeOf)) return undefined;
  const color = (
    COMPONENT_RULES_TABLE.FieldLabel?.structure?.composition as
      { staticSelectors?: Record<string, Record<string, string>> } | undefined
  )?.staticSelectors?.[".react-aria-Label"]?.color;
  return color ? (cssVarToTokenRef(color) ?? color) : undefined;
}

/**
 * S2 체크리스트 §4.1 (2026-11-22) — the color a ListBox item's description takes (S2 `description`
 * `neutral-subdued`): the ListBox rule's description selectors — in a picker's list always (no
 * selection fill), in a standalone list while its item is not selected (a selected one keeps the
 * item's on-accent text). Undefined where the item's color holds.
 */
export function catalogListBoxDescriptionColor(
  inPopover: boolean,
  selected: boolean,
  /** (S2: a disabled item's description is the disabled color — 2026-11-24.) */
  disabled = false,
): string | undefined {
  const scopes = (
    COMPONENT_RULES_TABLE.ListBox?.structure?.composition as
      | {
          rootSelectors?: Record<
            string,
            { nested?: Record<string, Record<string, string>> }
          >;
        }
      | undefined
  )?.rootSelectors;
  const disabledColor = disabled
    ? scopes?.[
        inPopover
          ? "&:is(.react-aria-Popover *)"
          : "&:not(.react-aria-Popover *)"
      ]?.nested?.['.react-aria-ListBoxItem[data-disabled] [slot="description"]']
        ?.color
    : undefined;
  const color = disabledColor
    ? disabledColor
    : inPopover
      ? scopes?.["&:is(.react-aria-Popover *)"]?.nested?.[
          '.react-aria-ListBoxItem [slot="description"]'
        ]?.color
      : selected
        ? undefined
        : scopes?.["&:not(.react-aria-Popover *)"]?.nested?.[
            '.react-aria-ListBoxItem:not([data-selected]) [slot="description"]'
          ]?.color;
  return color && color !== "inherit"
    ? (cssVarToTokenRef(color) ?? color)
    : undefined;
}

export function catalogFieldLabelPartsDependents(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const labels =
    owner.bindingId === "label"
      ? [owner]
      : catalogLabelSuffixDependents(owner, get, typeOf);
  return labels.flatMap((label) =>
    childrenOf(label, get).filter((child) =>
      [
        "label-content",
        "necessity-icon",
        "necessity-label",
        "necessity-space",
      ].includes(String(child.props.slot)),
    ),
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
  // (A `drill` Cascader's trail: the positions holding a path crumb — judged here, not by a sibling's
  //  `hidden`, which a step may not have settled yet: the last is the open level.)
  const crumbs = childrenOf(owner, get).filter(
    (child) =>
      typeOf(child) === "Breadcrumb" &&
      !child.hidden &&
      catalogCascaderTrailCrumb(child, get, typeOf) !== undefined,
  );
  return crumbs.at(-1)?.id === node.id ? undefined : { owner };
}

/**
 * ADR-326 Phase 5 (§4.4 · §4.5) — what a Cascader's just-opened screen derives on the Canvas: an
 * item's row state (`_cascaderRow`) and `tree` level (`_cascaderLevel` — its row's indent), a `tree`
 * row's chevron (a leaf's room undrawn — `_glyphRoomOnly`; an open branch's turned), a `drill`
 * trail's whole length (`_trailCrumbs` — its folder menu counts every crumb, as the DOM's), a
 * crumb label's path text and a branch row's item count (`_cascaderCount`). The DOM reads its own RAC state (`cascaderPanel.components.tsx`).
 */
function catalogCascaderOpenDerived(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
  locale: string | undefined,
): Record<string, unknown> {
  // (A `drill` level's own row label: 「<branch> 전체」 — the DOM's own row reads its context
  //  (`_cascaderOwnLabel`, on every item label), not this text: the record also draws as its upper
  //  level's row.)
  const own = catalogCascaderOwnRowPart(
    node,
    get,
    typeOf,
    locale || globalThis.navigator?.language || "en-US",
  );
  if (own?.label !== undefined)
    return { _cascaderOwnLabel: true, children: own.label };
  // (Every item label: the DOM's own row of any level it opens gives its name there.)
  if (typeOf(node) === "Text" && node.props.slot === "label") {
    const item = get(node.parentId);
    if (item && typeOf(item) === CASCADER_ITEM_TYPE)
      return { _cascaderOwnLabel: true };
  }
  const row = catalogCascaderItemRow(node, get, typeOf);
  if (row) {
    const level = catalogCascaderTreeLevel(node, get, typeOf);
    return {
      _cascaderRow: row,
      ...(level !== undefined ? { _cascaderLevel: level } : {}),
    };
  }
  const chevron = catalogCascaderTreeChevron(node, get, typeOf);
  if (chevron)
    return {
      _cascaderTreeChevron: true,
      ...(chevron.roomOnly ? { _glyphRoomOnly: true } : {}),
      // (An open branch's glyph turns 90° — the rule's `[data-expanded]` turn, whatever its icon:
      //  the Canvas turns the drawn glyph, `canvasBinding` `_glyphTurned`.)
      ...(chevron.expanded ? { _glyphTurned: true } : {}),
    };
  // (A branch row's item count — the DOM's row reads its running table, `CatalogCascaderCount`.)
  const count = catalogCascaderCount(node, get, typeOf);
  if (count !== undefined)
    return {
      _cascaderCount: true,
      ...(count ? { children: String(count) } : {}),
    };
  const trail = catalogCascaderTrailOf(node, get, typeOf);
  if (trail) return { _trailCrumbs: trail.crumbs.length };
  if (catalogCascaderTrailCrumbText(node, get, typeOf)) {
    const crumb = catalogCascaderTrailCrumb(get(node.parentId)!, get, typeOf);
    return { _cascaderCrumb: true, ...(crumb ? { children: crumb.text } : {}) };
  }
  return {};
}

/**
 * The author's selection mark on a collection item (a `slot=selection` part, or a node shown while
 * `isSelected` — the reference's Check / Dot): it stands in for the sheet's glyph — the DOM's
 * `data-selection-mark`.
 */
export function catalogItemHasSelectionMark(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  return node.children.some((id) => {
    const child = get(id);
    return (
      !!child &&
      !catalogPickerSelectionHidden(child, get, typeOf) &&
      (child.props.slot === "selection" ||
        (!!child.showWhen &&
          catalogStateConditions(child.showWhen).some(
            (condition) => condition.key === "isSelected" && !condition.not,
          )))
    );
  });
}

/**
 * `ListBox.css` `.react-aria-ListBoxItem:not([data-selection-mark]):has(> [slot="icon"])`: an item in a
 * ListBox (the Preview marks the slot there) whose icon renders, with no selection mark (a picker's
 * option is always marked) — S2's `listboxItem` grid (`CATALOG_LIST_BOX_ITEM_ICON_GRID`).
 */
export function catalogItemIconGrid(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(node) !== "ListBoxItem") return false;
  let owner = get(node.parentId);
  while (owner && typeOf(owner) === "ListBoxSection")
    owner = get(owner.parentId);
  if (!owner || typeOf(owner) !== "ListBox") return false;
  if (
    node.derivedProps?._pickerOption === true ||
    catalogItemHasSelectionMark(node, get, typeOf)
  )
    return false;
  return childrenOf(node, get).some(
    (child) => child.props.slot === "icon" && !child.hidden,
  );
}

/** A crumb's label children (inside its RAC Link · current `div` — they take the current crumb's weight). */
export function catalogBreadcrumbLabels(
  crumb: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  // (A crumb's label: its Text — S2 structure, 2026-11-13 — or an authored Link.)
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
/** A toggle type → the RAC group whose state context it reads. */
const TOGGLE_GROUP_OF = CATALOG_TOGGLE_GROUP_OF;
/**
 * The group a toggle belongs to: RAC's group state context (`CheckboxGroupStateContext` ·
 * `RadioGroupStateContext` · `ToggleGroupStateContext` — set only by the group itself, RAC 1.21.0)
 * reaches every toggle below the group through any element (an items wrapper, a frame, a RAC
 * `Group`) — the nearest group of its type (Codex Round 20 H2).
 */
export function catalogToggleGroupOf(
  item: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const groupType = TOGGLE_GROUP_OF[typeOf(item)];
  if (!groupType) return undefined;
  for (let cursor = get(item.parentId); cursor; cursor = get(cursor.parentId))
    if (typeOf(cursor) === groupType) return cursor;
  return undefined;
}
/**
 * A group's toggles of `itemType` in document order (those whose `catalogToggleGroupOf` is it — a
 * nested group of the same type keeps its own; a toggle is never inside another of its type —
 * `nestingRules.ts` `NO_SELF_NESTING_TYPES`) and the containers they sit in: a change to either can
 * move the group's value.
 */
export function catalogToggleGroupItems(
  group: CatalogConsumerNode,
  itemType: string,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): { items: CatalogConsumerNode[]; containers: CatalogConsumerNode[] } {
  const groupType = typeOf(group);
  const items: CatalogConsumerNode[] = [];
  const containers: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of childrenOf(node, get)) {
      const type = typeOf(child);
      if (type === groupType) continue;
      if (type === itemType) items.push(child);
      else if (catalogChildKind(type).kind !== "leaf") {
        containers.push(child);
        visit(child);
      }
    }
  };
  visit(group);
  return { items, containers };
}
/** The CheckboxGroup / RadioGroup / TagGroup an item sits in (a Tag through its TagList). */
function catalogItemGroup(
  owner: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (TOGGLE_GROUP_OF[typeOf(owner)])
    return catalogToggleGroupOf(owner, get, typeOf);
  const groupType = GROUP_OF_ITEM[typeOf(owner)];
  if (!groupType) return undefined;
  let cursor = catalogPartParent(owner, get, typeOf);
  while (cursor && GROUP_ITEMS_TYPES.has(typeOf(cursor)))
    cursor = catalogPartParent(cursor, get, typeOf);
  return cursor && typeOf(cursor) === groupType ? cursor : undefined;
}

/**
 * A state owner's resting value of a key on the Canvas (no interaction): the record's props, its
 * display state (a Components page state cell · a state origin) and the values derived for it.
 * hover · pressed · focus-visible exist only as a display state; Sheet also reads authored open props.
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
      // ADR-308: an item in a selection group is selected by the group's keys (the paint's
      // `_isSelected`), over a display state its origin carried (a detached Tab keeps the Selected
      // origin's). A standalone toggle · Card keeps its own (RAC's own state).
      const item = catalogCollectionItemSelected(owner, get, typeOf);
      if (item !== undefined) return item;
      if (state === "selected") return true;
      if (state === "unselected") return false;
      return (props.isSelected ?? props.defaultSelected) === true;
    }
    case "isIndeterminate": {
      // (A select-all checkbox while some rows — not all — are selected: RAC's indeterminate.)
      const column = catalogSelectionCheckboxItem(owner, get, typeOf);
      if (column && typeOf(column) === "Column") {
        const counts = catalogTableSelectedRows(column, get, typeOf);
        if (counts && counts.selected > 0 && counts.selected < counts.total)
          return true;
      }
      return props.isIndeterminate === true || derived.isIndeterminate === true;
    }
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
        // (A Button its ButtonGroup disables — `catalogDerivedProps`.)
        derived.isDisabled === true ||
        (!!checkboxItem &&
          catalogSelectionCheckboxDisabled(checkboxItem, get, typeOf))
      );
    }
    case "isReadOnly":
    case "isRequired":
      return catalogInheritedFlag(owner, key, get, typeOf);
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
      if (
        OVERLAY_OPEN_OWNERS.has(typeOf(owner)) ||
        OVERLAY_BODY_TYPES.has(typeOf(owner))
      )
        return catalogAuthoredOpen(owner);
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
    // S2 체크리스트 §9.3: its S2 UnavailableMenuItemTrigger's `isUnavailable`.
    case "isUnavailable":
      return catalogMenuItemUnavailable(owner, get, typeOf);
    // ADR-256 Phase 9: a month block's place among its calendar's shown months (its copy index).
    case "isFirstMonth":
      return catalogCalendarMonthIndex(owner) === 0;
    case "isLastMonth":
      return (
        catalogCalendarMonthIndex(owner) ===
        catalogCalendarMonthCount(
          catalogCalendarOf(owner, get, typeOf)?.props.visibleDuration,
        ) -
          1
      );
  }
}

/**
 * ADR-256 Phase 9 — the parts of a calendar whose derived values read its model: its headings
 * (RAC `CalendarHeading` · a plain Heading in a header) and grids, at any depth below it (not a
 * nested calendar's).
 */
function calendarModelParts(
  calendar: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (record: CatalogConsumerNode) => {
    for (const child of childrenOf(record, get)) {
      const type = typeOf(child);
      if (CALENDAR_TYPES.has(type)) continue;
      if (
        type === "CalendarHeading" ||
        type === "CalendarMonth" ||
        type === "CalendarGrid" ||
        type === "Heading" ||
        type === "CalendarMonthPicker" ||
        type === "CalendarYearPicker" ||
        (type === "SelectValue" &&
          !!catalogCalendarPickerOfValue(child, get, typeOf))
      )
        out.push(child);
      visit(child);
    }
  };
  visit(calendar);
  return out;
}

/**
 * ADR-256 Phase 9 — a calendar's previous · next Button (RAC's `previous` · `next` slots, in a
 * calendar): the reference starter's plain RAC Button, whose box the calendar sheets give
 * (`.react-aria-Calendar header > .react-aria-Button` — the Canvas reads the same values from the header's
 * part rules).
 */
export function catalogCalendarNavButton(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  return (
    node.bindingId === "button" &&
    (node.props.slot === "previous" || node.props.slot === "next") &&
    !!catalogCalendarOf(node, get, typeOf)
  );
}

/** ADR-256 Phase 9 — a glyph in a calendar's previous · next Button (it takes the Button's color). */
export function catalogCalendarNavButtonGlyph(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (node.bindingId !== "icon") return false;
  const button = get(node.parentId);
  return !!button && catalogCalendarNavButton(button, get, typeOf);
}

/**
 * ADR-256 Phase 9 — the calendar month · year picker whose Select a part belongs to (the picker's
 * one child is its Select; the part sits in it — its SelectValue, its ListBox).
 */
export function catalogCalendarPickerOfValue(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId)) {
    const type = typeOf(cursor);
    if (type !== "Select") continue;
    const picker = get(cursor.parentId);
    return picker &&
      (typeOf(picker) === "CalendarMonthPicker" ||
        typeOf(picker) === "CalendarYearPicker")
      ? picker
      : undefined;
  }
  return undefined;
}

/** ADR-256 Phase 9 — a month block's index among its calendar's shown months (its copy's). */
export function catalogCalendarMonthIndex(month: CatalogConsumerNode): number {
  return month.monthIndex ?? 0;
}

/** The Calendar · RangeCalendar a part sits in (the nearest — a part's own calendar). */
export function catalogCalendarOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId))
    if (CALENDAR_TYPES.has(typeOf(cursor))) return cursor;
  return undefined;
}

/**
 * The per-month part a calendar part sits in or is (its offset — the copy's index): its heading
 * group (`CalendarMonth`), or the repeated grid itself.
 */
export function catalogCalendarMonthOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  for (
    let cursor: CatalogConsumerNode | undefined = node;
    cursor;
    cursor = get(cursor.parentId)
  ) {
    const type = typeOf(cursor);
    // (A heading group, or a grid repeated on its own in the grid row — S2's, 2026-11-18.)
    if (type === "CalendarMonth" || cursor.monthIndex !== undefined)
      return cursor;
    if (CALENDAR_TYPES.has(type)) return undefined;
  }
  return undefined;
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
  // (An Image's `src` shows or hides its error content — `catalogImageFallbackHidden`.)
  if (typeOf(node) === "Image") return childrenOf(node, get);
  // Trigger의 prop만 바뀌어도 overlay의 hidden과 레이아웃을 증분 갱신한다.
  const out: CatalogConsumerNode[] = OVERLAY_OPEN_OWNERS.has(typeOf(node))
    ? partChildrenOf(node, get, typeOf).filter(
        (child) =>
          OVERLAY_BODY_TYPES.has(typeOf(child)) || typeOf(child) === "Dialog",
      )
    : [];
  const bodies = OVERLAY_BODY_TYPES.has(typeOf(node)) ? [node] : [...out];
  for (const body of bodies)
    out.push(
      ...childrenOf(body, get).filter(
        (child) => child.bindingId === "overlayarrow",
      ),
    );
  // (A group whose items take its state — a TagGroup's `allowsRemoving` — gives no keys of its own.
  //  S2 체크리스트 §9.3: an UnavailableMenuItemTrigger's `isUnavailable` is its item's state too.)
  if (
    !catalogStateKeysOf(typeOf(node)).length &&
    !ITEM_STATE_GROUPS.has(typeOf(node)) &&
    typeOf(node) !== CATALOG_UNAVAILABLE_MENU_TRIGGER
  )
    return out;
  const visit = (record: CatalogConsumerNode) => {
    for (const child of childrenOf(record, get)) {
      if (child.showWhen || catalogPickerSelectionItem(child, get, typeOf))
        out.push(child);
      visit(child);
    }
  };
  visit(node);
  return out;
}

/**
 * S2 체크리스트 §9.3 — S2 `EditableCell`: a Cell holding a Form (its `renderEditing` — the popover
 * the edit button opens). The Form is that Form; the edit button is an `ActionButton[slot=edit]`
 * in the cell's content frame.
 */
function catalogEditableCellForm(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(node) !== "Form") return false;
  const cell = get(node.parentId);
  return !!cell && typeOf(cell) === "Cell";
}
export function catalogEditableCell(
  cell: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(cell) !== "Cell") return undefined;
  for (const id of cell.children) {
    const child = get(id);
    if (child && typeOf(child) === "Form") return child;
  }
  return undefined;
}
function catalogEditableCellButton(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  if (typeOf(node) !== "ActionButton" || node.props.slot !== "edit")
    return false;
  const frame = get(node.parentId);
  const cell = frame ? get(frame.parentId) : undefined;
  return !!cell && !!catalogEditableCell(cell, get, typeOf);
}

function selectBoxShownProps(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string> {
  const shown = catalogSelectBoxShown(node, get, typeOf);
  if (shown === undefined) return {};
  return typeOf(node) === "SelectBox"
    ? { _selectBoxShown: shown }
    : { _selectBoxPartOf: shown };
}
