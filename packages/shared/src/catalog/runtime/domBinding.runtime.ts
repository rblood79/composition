import { CatalogTokenFieldError } from "./tokenField.components";
import { catalogSkeletonText } from "./skeletonAnimation";
import { catalogActionBadgeNodeLayout } from "../rule/actionBadge";
import { catalogToggleItemHelpRefs } from "../rule/toggleLayout";
import { catalogEffectiveStaticColor } from "./staticBackdrop";
import {
  SliderThumb as CatalogSliderThumb,
  SliderTrackBar as CatalogSliderTrackBar,
  SliderLabelContainer as CatalogSliderLabelContainer,
  SliderFieldInput as CatalogSliderFieldInput,
} from "../../components/RangeSlider";
import { catalogSelectBoxDescriptionHidden } from "./selectBoxPresence";
import { LinkButton } from "../../components/LinkButton";
import { LinkPrimitive } from "../../components/LinkPrimitive";
import { LabeledValue } from "../../components/LabeledValue";
import {
  catalogPickerSelectionHidden,
  catalogPickerSelectionItem,
  LISTBOX_PICKER_TYPES,
} from "./pickerSelection";
import {
  CatalogPickerValueContent,
  CatalogPickerValueTypography,
  CatalogPickerSelectionSlot,
} from "./pickerSelection.components";
import {
  PICKER_INVALID_ICON,
  pickerInvalidGlyph,
} from "../document/pickerTrigger";
import { catalogS2OverlayPlacement } from "./overlayLayout";
import { catalogCssFontFamily, DEFAULT_BASE_TYPOGRAPHY } from "./fontDefaults";
export { catalogS2OverlayPlacement } from "./overlayLayout";
import { catalogTextRunsContent } from "./textRunsDom";
import { paintAt, ruleHasPaintImage } from "../rule/rulePaintTree";
import {
  catalogIsAuthoredAbsolute,
  catalogIsAuthoredPlaced,
} from "./positioning";
import { parseColor } from "react-aria-components/ColorPicker";
import {
  catalogControlledProps,
  catalogRuntimeStateOf,
  catalogOpenOwnerOf,
  catalogSelectionValue,
  CATALOG_OPEN_BODY_TYPES,
  CATALOG_OPEN_TRIGGER_TYPES,
  INPUT_VALUE,
  IS_OPEN,
  SELECTED_KEYS,
  VALUE,
} from "./runtimeStateProps";
import {
  componentTypeSet,
  getPrimitiveBinding,
  OWNER_DRAWN_PART_HOSTS,
  resolveStaticItemKey,
  toRacProps,
  usesButtonBaseUtility,
} from "@composition/shared";
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { CatalogRowWindowMode } from "./rowWindowContext";
import {
  CATALOG_DETAIL_ROW_SUFFIX,
  CATALOG_GROUP_PLACEHOLDER_SUFFIX,
} from "./tableRowSlices";

import {
  cloneElement,
  createContext,
  createElement,
  useContext,
  Fragment,
  isValidElement,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";

import * as RAC from "react-aria-components";
import { catalogSideNavPart } from "./sideNav.lazy";
import {
  catalogSideNavChevronGlyphItem,
  catalogSideNavChevronItem,
  catalogSideNavRowItemOf,
  catalogSideNavTextOwner,
} from "./sideNav";

import { Heading, Label, Text } from "react-aria-components";
import { TableLoadMoreItem } from "react-aria-components/Table";

import {
  ActionButton,
  type ActionButtonProps,
} from "../../components/ActionButton";
import { Button } from "../../components/Button";

import { ContextualHelpButton } from "../../components/ContextualHelp";
import { InlineAlertIcon } from "../../components/InlineAlertIcon";
import { catalogInlineAlertIcon } from "../document/inlineAlertIcon";
import { CatalogImageBox } from "./imageBox.components";

import { Group } from "../../components/Group";

import { Icon } from "../../components/Icon";
import { catalogPickerSpinner } from "./pickerSpinner";

import { Slot } from "../../components/Slot";

import { isBodyType } from "../../domain/predicates";
import { containerTypeSet } from "../../domain/componentTraits";
import {
  CATALOG_COLOR_CHECKER_CSS,
  CATALOG_COLOR_CONTROL_OUTLINE,
  CATALOG_COLOR_CONTROL_OUTLINE_CSS,
  CATALOG_COLOR_SWATCH_BORDER_CSS,
  CATALOG_COLOR_SWATCH_CHECKER_CSS,
  CATALOG_COLOR_SWATCH_SLASH,
  getIconData,
  ruleLengthCss,
  tokenToCSSVar,
  type TokenRef,
} from "@composition/rendering";
import { CatalogColorHandle } from "./colorHandleDom.runtime";
import {
  CATALOG_FIELD_BOX_CLASS,
  CATALOG_PREFIX_UNNAMED_FIELDS,
  catalogFieldBoxInputDomStyle,
  catalogFieldBox,
  catalogFieldBoxInputEnd,
  CATALOG_FIELD_ERROR_ICON,
  catalogFieldBoxInputStart,
  catalogFieldBoxStyle,
  catalogIsFieldPrefix,
} from "./fieldPrefix";
import {
  catalogItemTrailingIcon,
  catalogLinkOutCardEndInset,
  catalogItemLinkProps,
  catalogLinkOutGlyph,
  catalogLinkOutPaddingRight,
  IMAGE_ELEMENT_PROP_CONTRACTS,
} from "../document/itemLinks";

import { catalogTokenValue } from "../document/themedToken";

import type { DefinitionId, StateName, TokenId } from "../document/types";

import {
  CATALOG_COLOR_WHEEL_TRACK,
  catalogColorWheelDiameter,
} from "../resolvers/resolveCatalogRuleCanvasBox";
import {
  copyResolvedTokenRefs,
  type CatalogRowWindowKeys,
} from "../resolution/resolver";

import {
  CATALOG_AUTHORED_PAINT_KEYS,
  CATALOG_RADIUS_CSS,
  CATALOG_SIDE_WIDTH_KEYS,
  catalogAuthoredDomStyle,
  catalogAuthoredPaintCss,
  catalogVisualWithBackground,
  isTypedCatalogColor,
} from "./authoredStyle";

import {
  CATALOG_BINDING_VISUAL_KEYS,
  catalogBoxModel,
  catalogGlyphBoxSize,
  catalogGlyphSize,
  catalogTextMetrics,
  type CatalogLength,
} from "./boxModel";

import {
  catalogCalendarMonthPickerFormat,
  catalogCalendarVisibleYears,
  catalogChildOrder,
} from "./calendarModel";

import {
  CatalogCalendarPickerContext,
  type CatalogCalendarPickerAria,
} from "./calendarPickerContext";

import {
  CATALOG_COLOR_CONTROL_TYPES,
  catalogColorControlProps,
  catalogColorKey,
  type CatalogColorControlType,
} from "./colorControlGradient";

import {
  CATALOG_NOWRAP_TEXT_BINDINGS,
  CATALOG_ROW_SEPARATOR,
  CATALOG_INHERITED_TEXT_KEYS,
  CATALOG_TEXT_STYLE_CONTAINERS,
  type CatalogCompositionRoot,
  type CatalogConsumerNode,
} from "./compositionRoot";

import { catalogIsEmptyState } from "../nesting/nestingRules";
import {
  catalogActionBarSpace,
  catalogLinkedActionBarOf,
  catalogSelectionCountOf,
} from "./actionBarContainer";
import { CatalogActionBarHost } from "./actionBarHost.components";
import type { CatalogGroupKeys } from "./groupSelection";
import {
  CATALOG_DATE_INPUT_NODE_FIELDS,
  CATALOG_DELEGATED_DOM,
  CATALOG_INPUT_NODE_FIELDS,
  catalogCollectionSelectedKeys,
  catalogLoadMoreItem,
  catalogLoadingEmptyState,
  catalogDomPartParent,
  catalogOwnerDrawnPart,
  catalogPartField,
  catalogToggleIndicatorElement,
  catalogTypeName,
} from "./delegatedDom";

import { CatalogNavLink } from "./navRoute.components";
import { CatalogPreviewTriggerTarget } from "./previewTriggerTarget.components";
import {
  DELEGATING_INTERNAL_RENDERERS,
  DELEGATING_RAC_RENDERERS,
  INTERNAL_RENDERERS,
} from "./domRegistry";

import { catalogAspectRatio, catalogLayoutCss } from "./fillLayout";

import { resolveAssetUrl } from "../../utils/assetRef";

import {
  catalogAuthoredLayout,
  catalogAuthoredVisual,
  catalogDerivedRestVisual,
  catalogHasAuthoredColor,
  catalogHasAuthoredVisual,
  catalogHasExplicitVisual,
} from "./libraryVisual";
import {
  catalogFieldLabelPartsHidden,
  catalogFieldLabelRowAbsent,
  catalogPickerTimeAbsent,
  catalogSelectionCheckboxHidden,
  catalogCollectionSeparatorHidden,
  catalogPaginationPartHidden,
  catalogColumnMenuIconHidden,
} from "./presence";
import { catalogSelectionGroupOf } from "./groupSelection";
import { catalogPickerMenuWidth } from "./pickerMenuWidth";
import { catalogLayoutTokenCss, catalogNodeTokenCss } from "./nodeTokenCss";
import { catalogContainerCss } from "./containerLayer";
import {
  catalogDeviceControlCss,
  catalogDeviceLayoutCss,
  catalogDeviceGlyphSize,
  catalogDeviceRowsHeightCss,
  catalogDeviceScaledCss,
  catalogDeviceTypographyCss,
} from "./deviceTypography";
import {
  useCatalogDeviceTokenPx,
  useCatalogDeviceUnit,
} from "./deviceUnit.runtime";
import type { CatalogTableDeviceColumns } from "./virtualListLayout";

import {
  CATALOG_SLIDER_THICK_TRACK,
  catalogAbsentByValue,
  catalogActionButtonPartAbsent,
  catalogAccordionOf,
  catalogCalendarNavButton,
  catalogCalendarNavButtonGlyph,
  catalogColumnMenuContent,
  catalogColumnSortContent,
  catalogTableAuthoredSortShown,
  catalogTableTreeColumn,
  catalogColumnSortsInline,
  catalogContextualHelpOfTrigger,
  catalogIllustrationInDropZone,
  catalogDisclosureOfHeading,
  catalogDisclosureOfTrigger,
  catalogDisclosureOfTriggerPart,
  catalogFieldHintShown,
  catalogItemLabels,
  catalogItemRemoveGlyphItem,
  catalogProgressValueHidden,
  catalogDismissibleDialogOf,
  catalogStateConditions,
  catalogStateOwner,
  catalogStateValue,
  catalogStepperHidden,
  catalogTreeChevronButtonItem,
  catalogTreeChevronBox,
  catalogTreeChevronLevel,
  catalogTreeChevronGlyphItem,
  catalogToggleButtonGlyphOwner,
  catalogEditableCell,
  FIELD_HINT_OWNERS,
} from "./presence";

import {
  catalogDomSlot,
  racSlotProps,
  type RacSlotResolution,
} from "./racSlot";

import { RacSlotScope } from "./racSlotScope";

import {
  catalogMenuItemUnavailable,
  catalogUnavailableGlyphDomId,
  catalogUnavailableGlyphItem,
  catalogUnavailableGlyphOf,
} from "./unavailableMenuItem";

import {
  CatalogAlertGlyph,
  CatalogMoreActionsName,
  CatalogUnavailableGlyph,
} from "./unavailableMenuItem.components";
import { catalogMoreActionsTrigger } from "./actionMenu";
import { catalogAlertDialogGlyph } from "./alertDialog";

import {
  catalogValueRowKey,
  catalogValueTemplateOwner,
} from "./selectValueTemplate";

import {
  CatalogSelectValueRowGate,
  CatalogSelectValueShape,
} from "./selectValueTemplate.components";

import {
  catalogValueGate,
  catalogStateChildren,
  type CatalogDomStateCondition,
} from "./stateFrames";

import { type CatalogStateStyles } from "./stateStyles";

import {
  catalogColumnChildren,
  catalogResizableTracks,
  CatalogColumnMenuButton,
  CatalogSortIndicator,
} from "./tableOperationsDom";

import {
  catalogTableColumnKey,
  catalogTableResizable,
  catalogTableSortedRows,
  catalogTableSortOf,
  type CatalogTableSort,
} from "./tableSort";
import { catalogTableColumnRoles } from "./tableColumnRoles";
import type {
  CatalogColumnFilterView,
  CatalogColumnMenuItem,
  CatalogColumnMenuItemId,
} from "./tableColumnMenu";
import type { CatalogTableColumnFilter } from "./tableState";
import {
  CATALOG_COLUMN_MENU_PROP,
  CATALOG_COLUMN_PINNED_AT_PROP,
  CATALOG_COLUMN_PINNED_PROP,
  catalogTableExpandedKeys,
} from "../resolution/tableColumns";

import {
  CATALOG_DRAG_COLUMN_WIDTH,
  CATALOG_PINNED_ROW_PROP,
  CATALOG_ROW_PINNABLE_PROP,
  CATALOG_TABLE_PINNED_COLUMNS_PROP,
  CATALOG_TABLE_PINNED_ROWS_PROP,
  catalogCellSpan,
  catalogTableSelectionColumn,
  catalogTableRowTracks,
  catalogTableSelectionPartHidden,
  catalogTrackTableOf,
  CATALOG_SELECTION_COLUMN_VAR,
  CATALOG_SELECTION_COLUMN_WIDTH,
} from "./tableTracks";
import { CATALOG_CELL_COLUMN_PROP } from "./tableCellMerge";
import {
  CATALOG_COLUMN_PLACE_PROP,
  resolveTableColumnKey,
} from "../../collections/resolveCollectionItems";

import {
  CatalogAutocomplete,
  CatalogCalendarCell,
  CatalogCalendarGrid,
  CatalogCalendarHeaderCell,
  CatalogCalendarHeading,
  CatalogDateSegment,
  CatalogDomNode,
} from "./domBinding.components";
import { BUTTON_FORM_FOCUS_ACCEPTS } from "../bindings/Button.binding";
import {
  catalogRacOwnsText,
  catalogValueKeysIn,
  catalogValueOwner,
  type CatalogValueTemplate,
} from "./valueBindings";

/**
 * ADR-248 DOM binding: resolved catalog inputs → RAC / shared components with the same resolved
 * values the Canvas binding paints. Product-path code (Phase 3 test entry assembles it; Phase 4
 * cutover uses it as is). D1 stays with RAC: bindings pick the component and pass ARIA-relevant
 * props only; visual values come from the resolved node, never from a per-type stylesheet here.
 */
/**
 * A running Preview's per-record behavior (ADR-248 4e-6): the interaction rules' event handlers
 * and the prop overrides capabilities write (runtime state, never the document).
 */
export interface CatalogDomRuntime {
  /** Moves when the record's handlers or override change (the node renders again). */
  revisionOf(id: string): number;
  handlersOf(
    id: string,
  ): Readonly<Record<string, (...args: unknown[]) => void>>;
  /** Prop patch of a record (`style` merges into its computed style). */
  overrideOf(id: string): Readonly<Record<string, unknown>> | undefined;
  /**
   * A component's own state change (a Disclosure or Tree expanded by the user) as a runtime prop
   * of the record — the same values a capability writes, never the document (ADR-250).
   */
  setRuntimeProps?(id: string, patch: Readonly<Record<string, unknown>>): void;
  /**
   * ADR-315 Phase 2 — a Table's header press: the Column RAC named (its RAC key) and whether the
   * press adds to the sort (Shift held). The session turns the Column's direction and keeps the
   * list; RAC is told the first sort back (`sortDescriptor`).
   */
  pressTableSort?(tableId: string, column: string, add: boolean): void;
  /**
   * ADR-315 Phase 5 — the group rows RAC opened · closed (its `onExpandedChange` — their row keys):
   * the Table's state (`expandedKeys`); the rows are read again.
   */
  expandTableRows?(tableId: string, keys: readonly string[]): void;
  /**
   * ADR-315 Phase 5 증분 5f — a viewer's pin from a row's menu: the row (its key) to the top, the
   * bottom, or back among the rows (`none`) — the Table's state (`pinnedRows`).
   */
  pinTableRow?(
    tableId: string,
    rowKey: string,
    side: "top" | "bottom" | "none",
  ): void;
  /**
   * S2 체크리스트 §9.3 — an S2 `EditableCell`'s save: the submitted fields (by name — the column
   * keys) onto its drawn row's item (the session's `useListData.update`).
   */
  editTableRow?(rowId: string, values: Readonly<Record<string, unknown>>): void;
  /**
   * ADR-315 Phase 6 — a cell range of a Table its viewers select cells in, as tab-separated text:
   * its rows (keys, in the order shown) by its Columns (keys) — the rows' data (breakdown §5.6).
   */
  tableCellText?(
    tableId: string,
    rows: readonly string[],
    columns: readonly string[],
  ): string;
  /**
   * ADR-315 Phase 4 — the widths RAC's column resize left (its `onResizeEnd` — RAC keys, px): the
   * Table's state (`columnWidths`), remembered with it.
   */
  resizeTableColumns?(
    tableId: string,
    widths: Readonly<Record<string, number>>,
  ): void;
  /**
   * ADR-315 Phase 4 — a drawn Column's menu (S2 `ColumnWithMenu`): its items as the Table's state
   * is now, and an item pressed — the session's (`tableColumnMenu.ts`); RAC's resize stays here.
   */
  tableColumnMenu?(
    tableId: string,
    racKey: string,
  ): readonly CatalogColumnMenuItem[];
  runTableColumnMenu?(
    tableId: string,
    racKey: string,
    id: CatalogColumnMenuItemId,
  ): void;
  /**
   * ADR-315 Phase 4 증분 5 — a header drag: may the Column `fromKey` drop on `toKey` (RAC keys),
   * and with `apply` the drop — the session's (`catalogColumnDropPatch`).
   */
  dropTableColumn?(
    tableId: string,
    fromKey: string,
    toKey: string,
    apply: boolean,
  ): boolean;
  /**
   * ADR-315 Phase 4 증분 4c — a drawn Column's filter dialog (its comparisons, filter now and
   * candidate values) and its write — the session's (`tableColumnMenu.ts`).
   */
  tableColumnFilter?(
    tableId: string,
    racKey: string,
  ): CatalogColumnFilterView | undefined;
  setTableColumnFilter?(
    tableId: string,
    racKey: string,
    condition: CatalogTableColumnFilter["condition"] | undefined,
  ): void;
  /** ADR-315 Phase 4 — a Table's state widths by RAC key: where a Column's resize starts. */
  tableColumnWidths?(
    tableId: string,
  ): Readonly<Record<string, number>> | undefined;
  /** `useAsyncList.loadMore()` — a bound collection's end loads the next page (the session's). */
  loadMore?(collectionId: string): void;
  /**
   * ADR-310 Decision 10 「더 보기」 — a bound list's end shows more: its display window grows over
   * the rows already loaded (`moreLoaded`), else the next page loads, then the window grows.
   */
  showMore?(collectionId: string, ownerId: string, moreLoaded: boolean): void;
  /**
   * A windowed Table's rows `[first, last]` of `total` are drawn without records — its window moves
   * to hold them (`CatalogPreviewSession.showRows`).
   */
  showRows?(owner: string, first: number, last: number, total: number): void;
  /** ADR-310 「더 보기」 — loaded rows past the list's display window (`CatalogPreviewSession.moreLoaded`). */
  moreLoaded?(collectionId: string, ownerId: string): boolean;
  /** ADR-310 Decision 11 — a collection's load (a run's own load-more spinner). */
  loadingOf?(collectionId: string): string | undefined;
  /** ADR-310 Phase 7 — a click in a Pagination: its list steps (the session's page). */
  paginationClick?(recordId: string, target: Element, nav: Element): void;
  /** Whether a collection pages (its endpoint gives a cursor) — only those end in a load-more item. */
  pages?(collectionId: string): boolean;
  /**
   * `inputValue={list.filterText} onInputChange={list.setFilterText}` — the collection a record's
   * text filters on the server (a ComboBox · an Autocomplete's list), and the text's load.
   */
  serverFilterOf?(recordId: string): string | undefined;
  setFilterText?(collectionId: string, filterText: string): void;
  subscribe(id: string, notify: () => void): () => void;
}

export interface CatalogDomContext {
  slotMode?: "edit" | "page";
  /** The Preview's runtime (rules and capability overrides); absent = a static render. */
  runtime?: CatalogDomRuntime;
  /** Observation hook: called once per node binding render (initial mount and each delta). */
  onNodeRender?: (id: string) => void;
}

/** ADR-256 Phase 9 — the month offset of a calendar month block's parts (the block's copy index). */
export const CalendarMonthOffset = createContext(0);

/** ADR-256 Phase 9 — the weekday RAC's grid header draws a weekday cell template for. */
export const CalendarWeekday = createContext<string | null>(null);

/** ADR-256 Phase 9 — the segment RAC's DateInput draws a segment template for. */
export const DateSegmentPart = createContext<
  Parameters<typeof RAC.DateSegment>[0]["segment"] | null
>(null);

/** ADR-256 Phase 9 — the date RAC's grid draws a cell template for. */
export const CalendarCellDate = createContext<
  RAC.CalendarCellProps["date"] | null
>(null);

/** Bindings of the repeat templates RAC draws per day · date · segment (Decision 13). */
const REPEAT_TEMPLATE_BINDINGS: ReadonlySet<string> = new Set([
  "calendarcell",
  "calendarheadercell",
  "datesegment",
]);

/**
 * The child element of a repeat template (Decision 13 — a grid's cell · weekday cell, a DateInput's
 * segment): a child is its node's `CatalogDomNode` element, so it is found by the node's binding
 * (G5 example 15 — an element-type match never saw it, and RAC drew its plain cells).
 */
export function repeatTemplatePart(
  parts: ReactElement[],
  bindingId: string,
): ReactElement | undefined {
  return parts.find((part) => {
    if (!isValidElement(part) || part.type !== CatalogDomNode) return false;
    const { root, id } = part.props as CatalogDomNodeProps;
    return root.domInputs.get(id)?.bindingId === bindingId;
  });
}

const NECESSITY_PARTS: ReadonlySet<string> = new Set([
  "necessity-space",
  "necessity-icon",
  "necessity-label",
]);
/**
 * S2 `FieldLabel` (`Field.tsx`): the NBSP and the necessity mark (asterisk · "(required)") sit in
 * one `span` (`whiteSpace: nowrap`) after the label text — drawn only when a part shows. The parts
 * stay the Label's nodes (the Canvas lays them out as the Label's inline children; the span has no
 * box, so the geometry is the same).
 */
function necessityGrouped(children: ReactElement[]): ReactElement[] {
  const record = (child: ReactElement) => {
    if (!isValidElement(child) || child.type !== CatalogDomNode) return;
    const { root, id } = child.props as CatalogDomNodeProps;
    return root.domInputs.get(id);
  };
  const parts = children.filter((child) =>
    NECESSITY_PARTS.has(String(record(child)?.props.slot ?? "")),
  );
  if (!parts.length) return children;
  const rest = children.filter((child) => !parts.includes(child));
  return parts.some((child) => !record(child)?.hidden)
    ? [
        ...rest,
        createElement(
          "span",
          { key: "necessity", style: { whiteSpace: "nowrap" } },
          ...parts,
        ),
      ]
    : rest;
}

type DomBinding = (
  node: CatalogConsumerNode,
  style: CSSProperties,
  children: ReactElement[],
  context: CatalogDomContext,
) => ReactElement;

export const textBindings = new Set([
  "text",
  "heading",
  "label",
  "description",
  "paragraph",
  "button",
  "fielderror",
  "selectvalue",
]);

const CSS_VAR = /^var\(--[a-z0-9-]+\)$/;

function cssLength(value: CatalogLength | undefined): string | undefined {
  return typeof value === "number" ? `${value}px` : value;
}

function cssColor(value: unknown, alpha = 1): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "transparent") return "transparent";
  // An authored CSS color (validated by the document) is its own CSS text.
  if (alpha === 1 && typeof value === "string" && !isTypedCatalogColor(value))
    return value;
  // A theme token in CSS form (`var(--accent-subtle)`) is the document's own reference.
  if (alpha === 1 && typeof value === "string" && CSS_VAR.test(value))
    return value;
  const hex =
    value === "black" ? "#000000" : value === "white" ? "#ffffff" : value;
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex))
    throw new Error(`CATALOG_DOM_COLOR_UNSUPPORTED:${String(value)}`);
  if (alpha === 1) return hex.toLowerCase();
  const channel = (offset: number) =>
    parseInt(hex.slice(offset, offset + 2), 16);
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
}

/** Layout fields the box model does not carry, as the Rust input reads them. */
const NODE_ITEM_LAYOUT_KEYS = [
  "contain",
  "containIntrinsicWidth",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "justifySelf",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
  "rowGap",
  "columnGap",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "verticalAlign",
  "insetLeft",
  "insetTop",
  "insetRight",
  "insetBottom",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridTemplateAreas",
  "maxWidth",
  "maxHeight",
];

function catalogNodeLayoutCss(node: CatalogConsumerNode): CSSProperties {
  // Only author-written keys: definition/part-rule layout reaches the DOM through the component
  // stylesheet (inlining it again double-applies, e.g. a ListBox item icon's margin).
  const authored = node.authoredLayout ?? {};
  const layout: Record<string, string> = {};
  for (const key of NODE_ITEM_LAYOUT_KEYS)
    if (authored[key] !== undefined) layout[key] = authored[key];
  // ADR-298 Phase 3 — an inset · gap longhand the document wrote as a theme token: its variable (the
  // record holds the token's px for the engine).
  catalogLayoutTokenCss(layout, authored);
  for (const key of ["maxWidth", "maxHeight"] as const)
    if (layout[key] === undefined && typeof node.sizing[key] === "number")
      layout[key] = `${node.sizing[key]}px`;
  if (
    authored.position === "absolute" ||
    authored.position === "relative" ||
    authored.position === "sticky" ||
    authored.position === "fixed"
  )
    layout.position = authored.position;
  const css = catalogLayoutCss(layout) as CSSProperties;
  if (node.fillLayout) Object.assign(css, catalogLayoutCss(node.fillLayout));
  if (catalogAspectRatio(node.visual.aspectRatio) !== undefined)
    css.aspectRatio = String(node.visual.aspectRatio);
  return css;
}

/** S2 `useVisuallyHidden` — read by a screen reader, no box. */
const VISUALLY_HIDDEN: CSSProperties = {
  border: 0,
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  margin: -1,
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  width: 1,
  whiteSpace: "nowrap",
};

/**
 * ADR-295 후속 — a Table's columns that follow the device as px numbers (S2 `useScale()`: the
 * selection column 40 · 52 — `{size.table.selection-column}`, not the unit × 40 — and the drag
 * column 16 · 20): RAC's Column widths and a virtual Table's `TableLayout` take numbers.
 */
export function useCatalogTableDeviceColumns(): CatalogTableDeviceColumns {
  return {
    selection: useCatalogDeviceTokenPx(
      CATALOG_SELECTION_COLUMN_VAR,
      CATALOG_SELECTION_COLUMN_WIDTH,
    ),
    drag: CATALOG_DRAG_COLUMN_WIDTH * useCatalogDeviceUnit(),
  };
}

/**
 * ADR-295 후속 C1 — the drag column's RAC Column. Its width is a px number (RAC `ColumnSize` — the
 * resizable Table's column widths are RAC's arithmetic, `CatalogTableResizeTracks`), so it takes the
 * device unit in JS as S2 does (`useScale()` — `width={scale === 'medium' ? 16 : 20}`).
 */
function CatalogTableDragColumn(): ReactElement {
  const width = useCatalogTableDeviceColumns().drag;
  return createElement(
    RAC.Column as ElementType,
    { "data-drag-column": "", width, minWidth: width },
    createElement("span", { style: VISUALLY_HIDDEN }, "Drag"),
  );
}

/**
 * ADR-295 후속 — a resizable Table's selection Column (a Column holding `Checkbox[slot=selection]`
 * with no authored width): S2's fixed checkbox column (`TableView.tsx` — `width` · `minWidth`
 * `scale === 'medium' ? 40 : 52`). RAC's column widths are px numbers, so the device value is read
 * in JS (`{size.table.selection-column}` — not the unit × 40); without it RAC gave the column its
 * default 1fr over a 75 floor. An authored floor stays the floor (the track's clamp).
 */
function CatalogTableSelectionColumn(
  props: Record<string, unknown>,
): ReactElement {
  const width = useCatalogTableDeviceColumns().selection;
  return createElement(RAC.Column as ElementType, {
    ...props,
    width,
    minWidth: props.minWidth ?? width,
  });
}

/**
 * ADR-295 후속 — S2 / RAC Table's drag column (`allowsDragging` — the Table drags,
 * `withTableDrag`): the header's first RAC Column (S2 width 16 · 20, its name for a screen reader
 * only) and each Row's first RAC Cell holding RAC's drag `Button` (S2 `DragHandleButton` — 10 × 22,
 * shown while the row has keyboard focus, `Table.css`). Not document nodes: the Canvas keeps the
 * same first track as an empty cell.
 */
function catalogTableDragPart(lower: "tableheader" | "row"): ReactElement {
  if (lower === "tableheader")
    return createElement(CatalogTableDragColumn, {
      key: "catalog:drag-column",
    });
  return createElement(
    RAC.Cell as ElementType,
    { key: "catalog:drag-cell", "data-drag-cell": "" },
    createElement(
      RAC.Button as ElementType,
      {
        slot: "drag",
        className: "react-aria-Button catalog-drag-handle",
        style: {
          width: catalogDeviceScaledCss(10),
          height: catalogDeviceScaledCss(22),
        },
      },
      createElement(Icon, {
        "aria-hidden": true,
        iconName: "grip-vertical",
        strokeWidth: 2,
        style: { fontSize: 16, width: 16, height: 16 },
      }),
    ),
  );
}

/**
 * ADR-257: a Table's Row is a grid on the Columns' shared tracks (as `styleOf`). The header row is
 * the `tr` RAC makes inside the TableHeader (no node of its own): the TableHeader carries the
 * tracks as a variable its row reads (`Table.css` `.react-aria-TableHeader > tr`).
 */
function catalogTableTrackStyle(
  node: CatalogConsumerNode,
  resizable = false,
): CSSProperties {
  // (Phase 2: a Cell's `colSpan` takes that many of its row's tracks.)
  if (node.bindingId === "cell" && catalogCellSpan(node) > 1)
    return { gridColumn: `span ${catalogCellSpan(node)}` };
  // (ADR-295 후속: a track that follows the device — the selection column's S2 40 · touch 52 —
  //  is its CSS variable here, `_tableDeviceTracks`; the Canvas reads the px list.)
  const device = node.derivedProps?._tableDeviceTracks;
  const shared =
    typeof device === "string" ? device : node.derivedProps?._tableTracks;
  if (typeof shared !== "string") return {};
  // (ADR-295 후속: a draggable Table's first track is S2's drag column — the device-scaled 16, 20 on
  //  a touch device; the Canvas reads its desktop px from the same list.)
  const derived =
    node.derivedProps?._allowsDragging === true
      ? `${catalogDeviceScaledCss(CATALOG_DRAG_COLUMN_WIDTH)} ${shared.slice(shared.indexOf(" ") + 1)}`
      : shared;
  // (Phase 4: in a resizable Table the tracks are RAC's column widths — `tableOperationsDom`.)
  const tracks = resizable ? catalogResizableTracks(derived) : derived;
  return node.bindingId === "tableheader"
    ? ({ "--table-column-tracks": tracks } as CSSProperties)
    : { display: "grid", gridTemplateColumns: tracks };
}

/**
 * ADR-315 Phase 4 — a pinned column's Column · Cell (`catalogProjectTableColumns` marks them): where
 * it stays while the Table scrolls sideways — past the pinned columns before it, whose widths the
 * pinned Columns measure (`CatalogTablePinMeasure` → `--table-pin-start-<n>` · `--table-pin-end-<n>`).
 * `Table.css` reads `--table-pin-at` (a Table drawn without the `Virtualizer`: `position: sticky`
 * at that inset; in it RAC's `TableLayout` places the start side itself and the end side reads
 * the same variable).
 */
function catalogTablePinnedStyle(node: CatalogConsumerNode): CSSProperties {
  const side = node.props[CATALOG_COLUMN_PINNED_PROP];
  const at = node.props[CATALOG_COLUMN_PINNED_AT_PROP];
  if ((side !== "start" && side !== "end") || typeof at !== "number") return {};
  return {
    "--table-pin-at": `var(--table-pin-${side}-${at}, 0px)`,
  } as CSSProperties;
}
/**
 * ADR-315 Phase 5 증분 5f — a pinned row's · a pinnable row's Cell (`CatalogTableCell`): the last
 * Cell of a pinned row measures where the Table's pinned rows stand (`measuresRowPin`), and the
 * last Cell of a data row of a Table its viewers pin rows in (`CATALOG_ROW_PINNABLE_PROP`) holds
 * the row's menu (`rowPin` — its side now and the pin).
 */
function catalogTableRowPinProps(
  node: CatalogConsumerNode,
  domGet: (id: string) => CatalogConsumerNode | undefined,
  domType: (entry: CatalogConsumerNode) => string,
  context: CatalogDomContext,
): Record<string, unknown> {
  const row = domGet(node.parentId);
  if (!row || row.rowIndex === undefined || domType(row) !== "Row") return {};
  const mark = row.props[CATALOG_PINNED_ROW_PROP];
  const side = mark === "top" || mark === "bottom" ? mark : undefined;
  const cells = row.children.filter((id) => {
    const child = domGet(id);
    return !!child && domType(child) === "Cell";
  });
  const out: Record<string, unknown> = {};
  // (The last Cell: the first may be the selection column's — not drawn in a Table that selects
  //  by highlight, `catalogTableSelectionPartHidden`; live 2026-11-21, nothing was measured.)
  if (side && cells.at(-1) === node.id) out.measuresRowPin = true;
  const table = catalogTrackTableOf(row, domGet, domType);
  const runtime = context.runtime;
  if (
    table?.props[CATALOG_ROW_PINNABLE_PROP] === true &&
    runtime?.pinTableRow &&
    cells.at(-1) === node.id
  ) {
    const key = String(row.props.id ?? row.id);
    // (A detail row is its row's — no row of its own to pin.)
    if (key.endsWith(CATALOG_DETAIL_ROW_SUFFIX)) return out;
    out.rowPin = {
      side: side ?? "none",
      pin: (to: "top" | "bottom" | "none") =>
        runtime.pinTableRow!(table.id, key, to),
    };
  }
  return out;
}
/**
 * S2 체크리스트 §9.3 — an S2 `EditableCell` (`CatalogTableCell` → `editableCell.components.tsx`): its
 * editing Form's record (drawn in the popover) and the save onto its drawn row (`editTableRow`).
 */
function catalogEditableCellProps(
  node: CatalogConsumerNode,
  domGet: (id: string) => CatalogConsumerNode | undefined,
  domType: (entry: CatalogConsumerNode) => string,
  context: CatalogDomContext,
): Record<string, unknown> {
  const form = catalogEditableCell(node, domGet, domType);
  const runtime = context.runtime;
  if (!form) return {};
  return {
    editableCell: {
      formId: form.id,
      onSave: (values: Readonly<Record<string, unknown>>) =>
        runtime?.editTableRow?.(node.parentId, values),
    },
  };
}
/**
 * ADR-315 Phase 6 — a Table 「Cell selection」's rows and Columns, as its cell ranges read them
 * (`CatalogCellSelectionSource.order`): every row key in the order shown — a virtual Table's window
 * keys (its rows outside the window too), else its Row records, a row's nested rows after it — and
 * the drawn Columns' keys (not the selection column). Read when used: the order is the rows' now.
 */
function catalogTableCellOrder(
  tableId: string,
  domGet: (id: string) => CatalogConsumerNode | undefined,
  domType: (entry: CatalogConsumerNode) => string,
): { rows: readonly string[]; columns: readonly string[] } {
  const table = domGet(tableId);
  const parts = (table?.children ?? []).flatMap((id) => {
    const part = domGet(id);
    return part ? [part] : [];
  });
  const header = parts.find((part) => domType(part) === "TableHeader");
  const body = parts.find((part) => domType(part) === "TableBody");
  const columns = (header?.children ?? []).flatMap((id, index) => {
    const column = domGet(id);
    if (!column || domType(column) !== "Column" || column.hidden) return [];
    const selection = column.children.some(
      (part) => domGet(part)?.props.slot === "selection",
    );
    if (selection) return [];
    const place = column.props[CATALOG_COLUMN_PLACE_PROP];
    return [
      resolveTableColumnKey(
        column.props as Record<string, unknown>,
        typeof place === "number" ? place : index,
      ),
    ];
  });
  const windowed = body?.rowWindow?.keys;
  if (windowed) return { rows: windowed, columns };
  const rows: string[] = [];
  const visit = (ids: readonly string[]) => {
    for (const id of ids) {
      const row = domGet(id);
      if (!row || domType(row) !== "Row") continue;
      rows.push(
        resolveStaticItemKey(row.props as Record<string, unknown>, row.id),
      );
      visit(row.children);
    }
  };
  visit(body?.children ?? []);
  return { rows, columns };
}
/** The `data-pinned` attributes of a pinned column's Column · Cell (`Table.css`). */
function catalogTablePinnedProps(
  node: CatalogConsumerNode,
): Record<string, string | number> {
  const side = node.props[CATALOG_COLUMN_PINNED_PROP];
  const at = node.props[CATALOG_COLUMN_PINNED_AT_PROP];
  return (side === "start" || side === "end") && typeof at === "number"
    ? { "data-pinned": side, "data-pinned-at": at }
    : {};
}

/**
 * ADR-310 Phase 8: a part fills the box RAC's virtual `Layout` gives it — a Table's Row (its cells
 * sit in the row box, so its own border draws at the box's edge) and an item of a horizontal list
 * (its list's drawn flow is a flex row — `catalogVirtualFlow`: the box is the line's height, as
 * the Canvas's flex stretches the item; a vertical list's block item fills its width).
 */
function catalogFillsVirtualBox(
  root: CatalogCompositionRoot,
  /** The Row's Table · the item's list. */
  list: CatalogConsumerNode | undefined,
  row: boolean,
): boolean {
  return (
    list?.derivedProps?._rowDisplay === "virtual" &&
    (row || root.getDrawnLayoutStyle(list.id)?.flexDirection === "row")
  );
}

/** Inline CSS from the shared box model plus resolved paint/text values. */
export function catalogDomStyle(
  node: CatalogConsumerNode,
  parent?: CatalogConsumerNode,
  authoredVisual?: Readonly<Record<string, unknown>>,
): CSSProperties {
  node = catalogVisualWithBackground(node);
  for (const key of Object.keys(node.visual))
    if (!CATALOG_BINDING_VISUAL_KEYS.has(key))
      throw new Error(`CATALOG_DOM_VISUAL_UNSUPPORTED:${node.id}:${key}`);
  const box = catalogBoxModel(node, authoredVisual);
  const visual = node.visual;
  const borderWidth = Number(box.borderWidth ?? 0);
  if (borderWidth > 0 && visual.borderColor === undefined)
    throw new Error(`CATALOG_DOM_STROKE_COLOR_REQUIRED:${node.id}`);
  const fillAlpha = Number(visual.fillAlpha ?? 1);
  const isText = textBindings.has(node.bindingId ?? "");
  const style: CSSProperties = {
    boxSizing: "border-box",
    ...(node.derivedProps?._inActionGroup === true ? { flexShrink: 0 } : {}),
    ...(node.derivedProps?._justified === true
      ? { flexGrow: 1, flexBasis: "0px" }
      : {}),
    display: box.display,
    ...(box.flexDirection
      ? { flexDirection: box.flexDirection as CSSProperties["flexDirection"] }
      : {}),
    ...(box.alignItems ? { alignItems: box.alignItems } : {}),
    ...(box.justifyContent ? { justifyContent: box.justifyContent } : {}),
    ...(box.flexWrap
      ? { flexWrap: box.flexWrap as CSSProperties["flexWrap"] }
      : {}),
    ...(box.width !== undefined ? { width: cssLength(box.width) } : {}),
    ...(box.height !== undefined ? { height: cssLength(box.height) } : {}),
    ...(box.aspectRatio !== undefined
      ? { aspectRatio: String(box.aspectRatio) }
      : {}),
    ...(visual.opacity !== undefined
      ? { opacity: Number(visual.opacity) }
      : {}),
    // (ADR-315 Phase 6 — inside a Cell its row above runs into: not seen, still read.)
    ...(node.derivedProps?._cellMergedContent ? { opacity: 0 } : {}),
    ...(box.minWidth !== undefined
      ? { minWidth: cssLength(box.minWidth) }
      : {}),
    ...(box.minHeight !== undefined
      ? { minHeight: cssLength(box.minHeight) }
      : {}),
    ...(box.gap !== undefined
      ? { rowGap: cssLength(box.gap), columnGap: cssLength(box.gap) }
      : {}),
    ...(box.padding
      ? {
          paddingTop: cssLength(box.padding.top),
          paddingRight: cssLength(box.padding.right),
          paddingBottom: cssLength(box.padding.bottom),
          paddingLeft: cssLength(box.padding.left),
        }
      : {}),
    ...(borderWidth > 0
      ? {
          borderWidth,
          borderStyle: String(visual.borderStyle ?? "solid"),
          borderColor: cssColor(visual.borderColor),
        }
      : {}),
    ...(visual.fill !== undefined
      ? { backgroundColor: cssColor(visual.fill, fillAlpha) }
      : {}),
    ...(visual.radius !== undefined
      ? { borderRadius: Number(visual.radius) }
      : {}),
    ...(visual.overflow !== undefined
      ? { overflow: String(visual.overflow) as CSSProperties["overflow"] }
      : {}),
  };
  // Authored paint (effects, per-corner radius, per-side width, fill layers): the same CSS
  // record the Canvas converts (`authoredStyle.ts`).
  Object.assign(style, catalogAuthoredDomStyle(node));
  // A corner radius next to the box radius goes out as four corners: React rewrites a changed
  // shorthand over the longhands it keeps (a later re-render would round the square corners of a
  // field's stepper again — ADR-253).
  const corners = Object.values(CATALOG_RADIUS_CSS) as (keyof CSSProperties)[];
  if (
    style.borderRadius !== undefined &&
    corners.some((corner) => style[corner] !== undefined)
  ) {
    const radius = style.borderRadius;
    delete style.borderRadius;
    for (const corner of corners)
      if (style[corner] === undefined)
        (style as Record<string, unknown>)[corner] = radius;
  }
  // Item/placement layout, max sizes, aspect ratio and the fill projection: the Rust input's own
  // fields (`styleOf`), as CSS.
  Object.assign(style, catalogNodeLayoutCss(node));
  Object.assign(style, catalogTableTrackStyle(node));
  Object.assign(style, catalogTablePinnedStyle(node));
  if (
    !(borderWidth > 0) &&
    [
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
    ].some((key) => visual[key] !== undefined)
  ) {
    if (visual.borderColor === undefined)
      throw new Error(`CATALOG_DOM_STROKE_COLOR_REQUIRED:${node.id}`);
    style.borderStyle = String(
      visual.borderStyle ?? "solid",
    ) as CSSProperties["borderStyle"];
    style.borderColor = cssColor(visual.borderColor);
    style.borderWidth = 0;
    Object.assign(style, catalogAuthoredPaintCss({ visual }));
  }
  if (isText) {
    const metrics = catalogTextMetrics(node, parent);
    // A text element's UA margin is reset; the margin its owner's rule places it with (a side
    // label field's hint indent — a part rule, in the record's layout) is written back after it,
    // or the reset would win over the owner's stylesheet (ADR-253).
    const placed = catalogLayoutCss(
      Object.fromEntries(
        (["marginTop", "marginRight", "marginBottom", "marginLeft"] as const)
          .filter((key) => node.layout[key] !== undefined)
          .map((key) => [key, node.layout[key]!]),
      ),
    ) as CSSProperties;
    Object.assign(style, {
      // (Four sides, not the shorthand: React warns on a shorthand mixed with a side.)
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      ...placed,
      fontFamily: metrics.fontFamily ?? DEFAULT_BASE_TYPOGRAPHY.fontFamily,
      fontSize: metrics.fontSize,
      whiteSpace: (metrics.whiteSpace ??
        (CATALOG_NOWRAP_TEXT_BINDINGS.has(node.bindingId ?? "")
          ? "nowrap"
          : "normal")) as CSSProperties["whiteSpace"],
      ...(metrics.fontStyle !== undefined
        ? { fontStyle: metrics.fontStyle }
        : {}),
      ...(metrics.letterSpacing !== undefined
        ? { letterSpacing: `${metrics.letterSpacing}px` }
        : {}),
      ...(metrics.textAlign !== undefined
        ? { textAlign: metrics.textAlign as CSSProperties["textAlign"] }
        : {}),
      ...(metrics.textTransform !== undefined
        ? {
            textTransform:
              metrics.textTransform as CSSProperties["textTransform"],
          }
        : {}),
      // (ADR-299 — a range-formatted text's own decoration is on its run spans, `textRunsDom.ts`;
      //  an inherited one stays on the element — under every run, which cannot remove it.)
      ...(metrics.textDecoration !== undefined &&
      (!node.textRuns || node.visual.textDecoration === undefined)
        ? { textDecoration: metrics.textDecoration }
        : {}),
      ...(metrics.wordBreak !== undefined
        ? { wordBreak: metrics.wordBreak as CSSProperties["wordBreak"] }
        : {}),
      ...(metrics.overflowWrap !== undefined
        ? {
            overflowWrap: metrics.overflowWrap as CSSProperties["overflowWrap"],
          }
        : {}),
      ...(metrics.textOverflow !== undefined
        ? { textOverflow: metrics.textOverflow }
        : {}),
      color: cssColor(metrics.color),
      ...(metrics.fontWeight !== undefined
        ? { fontWeight: metrics.fontWeight }
        : {}),
      ...(metrics.lineHeight !== undefined
        ? { lineHeight: metrics.lineHeight }
        : {}),
    } satisfies CSSProperties);
  } else if (node.bindingId === "slot") {
    // The Slot's own text metric drives its placeholder chrome (Canvas `slotChrome` reads the same).
    if (visual.fontSize !== undefined) style.fontSize = Number(visual.fontSize);
    if (visual.lineHeight !== undefined)
      style.lineHeight = Number(visual.lineHeight);
  }
  // ADR-298 D5: a value read from a theme token goes inline as the token's variable.
  catalogNodeTokenCss(style, visual);
  // ADR-303: a layer-filled frame gives its children its layer (`--container-bg`).
  catalogContainerCss(style as Record<string, unknown>, node);
  return style;
}

export const element =
  (tag: string): DomBinding =>
  (node, style, children) =>
    createElement(
      tag,
      { key: node.id, "data-catalog-id": node.id, style },
      ...children,
    );

const glyph =
  (
    fallbackName: string,
    fallbackSize: number,
    className?: string,
  ): DomBinding =>
  (node, style) => {
    // (Its glyph name: a sheet turns the chevron only — the Disclosure trigger's, Phase 8 판독 M3.)
    // (A crumb separator's glyph is its Breadcrumbs' `separatorIcon` — `presence.ts`.)
    const name = String(
      node.derivedProps?._ownerIconName ?? node.props.iconName ?? fallbackName,
    );
    return createElement(Icon, {
      key: node.id,
      "data-catalog-id": node.id,
      ...(className ? { className } : {}),
      "data-icon": name,
      iconName: name,
      elementType:
        node.derivedProps?._fieldLabelRole === "necessity-icon"
          ? "span"
          : "div",
      ...(typeof node.props.slot === "string" ? { slot: node.props.slot } : {}),
      ...(node.derivedProps?._fieldLabelRole === "necessity-icon"
        ? {
            "aria-hidden": node.derivedProps._fieldLabelInclude !== true,
            "aria-label":
              node.derivedProps._fieldLabelInclude === true
                ? String(node.derivedProps._fieldLabelAria)
                : undefined,
            role:
              node.derivedProps._fieldLabelInclude === true ? "img" : undefined,
          }
        : {}),
      size: (node.derivedProps?._iconVariant ?? node.props.size) as
        "S" | "M" | "L" | "XL" | undefined,
      strokeWidth: Number(node.props.strokeWidth ?? 2),
      style: {
        ...style,
        // (An item's remove glyph takes the item color — `derivedOf`, ADR-256 Phase 5d.)
        color: cssColor(
          node.derivedProps?._pickerIcon === true &&
            node.derivedProps.color !== undefined
            ? "inherit"
            : ((node.derivedProps?.color as string | undefined) ??
                node.visual.color),
        ),
        // (ADR-295 Phase 3b: an S2 icon step is its device variable — the touch set reaches the glyph.)
        // (An authored px box — the Layout tab's width · height — is the glyph: `catalogGlyphBoxSize`.)
        fontSize:
          catalogGlyphBoxSize(node) ??
          (node.derivedProps?.iconSize as number | undefined) ??
          catalogDeviceGlyphSize(node.visual) ??
          catalogGlyphSize(node) ??
          fallbackSize,
        // The resolved glyph sets the natural box too. Icon.css's default M height must
        // not override XS/XL or a field-owned glyph; explicit authored boxes still win.
        width:
          style.width ??
          catalogGlyphBoxSize(node) ??
          (node.derivedProps?.iconSize as number | undefined) ??
          catalogDeviceGlyphSize(node.visual) ??
          catalogGlyphSize(node) ??
          fallbackSize,
        height:
          style.height ??
          catalogGlyphBoxSize(node) ??
          (node.derivedProps?.iconSize as number | undefined) ??
          catalogDeviceGlyphSize(node.visual) ??
          catalogGlyphSize(node) ??
          fallbackSize,
      },
    });
  };

/**
 * A TreeItem chevron button's inline box: `Tree.css` states the desktop S2 40 + level indent (a manual
 * sheet reads no `--catalog-token-*`), inline writes its device formula (touch × 1.25 — S2 `size()`),
 * then what the document wrote (ADR-295 후속 B2).
 */
function treeChevronSheetBox(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (entry: CatalogConsumerNode) => string,
): CSSProperties {
  const level = catalogTreeChevronLevel(node, get, typeOf);
  const box = level === undefined ? undefined : catalogTreeChevronBox(level);
  return {
    ...(box
      ? {
          width: catalogDeviceScaledCss(box.width),
          paddingLeft: catalogDeviceScaledCss(box.indent),
        }
      : {}),
    ...authoredStyle(root, node),
  };
}

function withInheritedIconColor(
  node: CatalogConsumerNode,
): CatalogConsumerNode {
  const { color: _color, ...derivedProps } = node.derivedProps ?? {};
  return {
    ...node,
    visual: withTokenRefs({ ...node.visual, color: "inherit" }, node.visual),
    derivedProps,
  };
}

/**
 * A recolored copy of a glyph's visual keeps its token refs — an S2 icon step stays its device
 * variable (`catalogDeviceGlyphSize`, ADR-295 Phase 3b).
 */
function withTokenRefs<T extends object>(copy: T, source: object): T {
  copyResolvedTokenRefs(copy, source);
  return copy;
}

const bindings: Readonly<Record<string, DomBinding>> = {
  composite: element("div"),
  // Frame is a neutral layout container: no ARIA role (ADR-130).
  frame: element("div"),
  rectangle: element("div"),
  box: element("div"),
  group: (node, style, children) => {
    const text = (key: string) =>
      typeof node.props[key] === "string"
        ? (node.props[key] as string)
        : undefined;
    const role = text("role");
    return createElement(Group, {
      key: node.id,
      "data-catalog-id": node.id,
      role: role === "region" || role === "presentation" ? role : "group",
      label: text("label"),
      isDisabled: node.props.isDisabled === true,
      isInvalid: node.props.isInvalid === true,
      isReadOnly: node.props.isReadOnly === true,
      "aria-label": text("aria-label") ?? node.name,
      "aria-labelledby": text("aria-labelledby"),
      // (The old layout group's orientation — RAC's Group itself has none, ADR-256 Phase 6a.)
      ...(typeof node.props.orientation === "string"
        ? {
            "aria-orientation":
              node.props.orientation === "horizontal"
                ? "horizontal"
                : "vertical",
          }
        : {}),
      style,
      // (Its render props are the state frame of the `showWhen` nodes inside — ADR-256
      // Decision 7.)
      children: catalogStateChildren(node.id, () => children),
    } as unknown as Parameters<typeof Group>[0]);
  },
  slot: (node, style, children, context) =>
    createElement(
      Slot,
      {
        key: node.id,
        "data-element-id": node.id,
        ...{ "data-catalog-id": node.id },
        name: node.slot?.name ?? node.name ?? "Slot",

        required: node.slot?.required ?? false,
        ...(typeof node.props.description === "string"
          ? { description: node.props.description }
          : {}),
        isEditMode: context.slotMode !== "page",
        style,
      },
      ...children,
    ),
  // Text = RAC `Text` (`span.react-aria-Text`) in its parent's Text context (ADR-256 Decision 4 —
  // a ListBoxItem's label slot names the option). A slot the context does not provide (or none
  // where it has no default) renders the plain span RAC would refuse, keeping the authored name.
  text: (node, style) =>
    createElement(CatalogPickerValueTypography, {
      key: node.id,
      style,
      // (The render's one element takes no key — keyed by the record id, a data row's view reused
      //  for another row remounted RAC's Text and its span, ADR-310 G8 ⑤.)
      render: (style) =>
        createElement(RacSlotScope, {
          context: "Text",
          authored: node.props.slot,
          render: (resolution) => {
            const props = {
              "data-catalog-id": node.id,
              className: "react-aria-Text",
              ...(node.derivedProps?._fieldLabelRole === "necessity-label"
                ? {
                    "aria-hidden":
                      node.derivedProps._fieldLabelInclude !== true &&
                      node.derivedProps._fieldLabelRequired === true
                        ? true
                        : undefined,
                  }
                : {}),
              // (A DateRangePicker's dash — `presence.ts` `_decorative`, the reference's `aria-hidden`.)
              ...(node.derivedProps?._decorative === true
                ? { "aria-hidden": true }
                : {}),
              ...(typeof node.props.size === "string"
                ? { "data-size": node.props.size }
                : {}),
              style,
            };
            const text =
              catalogTextRunsContent(
                node.textRuns,
                node.visual.textDecoration,
              ) ??
              String(node.derivedProps?.children ?? node.props.children ?? "");
            // ADR-314 Phase 3 — S2 `useSkeletonText`: in a loading Skeleton the words sit in the
            //   look's inline span (`skeletonAnimation.ts`).
            const words =
              node.derivedProps?.isSkeleton === true
                ? catalogSkeletonText(text)
                : text;
            return detachedSlot(resolution)
              ? createElement(
                  "span",
                  {
                    ...props,
                    ...(resolution.kind === "unconnected" && resolution.slot
                      ? { slot: resolution.slot }
                      : {}),
                    // (No Text provider above — RAC's Text writes its `slot` as is: a selected item's
                    // label in a SelectValue, which clears the context — G5 example 3.)
                    ...(resolution.kind === "none" &&
                    typeof node.props.slot === "string" &&
                    node.props.slot !== ""
                      ? { slot: node.props.slot }
                      : {}),
                  },
                  words,
                )
              : createElement(
                  Text,
                  { ...props, ...racSlotProps(resolution) } as Parameters<
                    typeof Text
                  >[0],
                  words,
                );
          },
        }),
    }),
  // (`slot`: a Dialog's title — RAC connects it as the dialog's name, ADR-254. A slot the Heading
  // context does not provide renders detached instead of throwing — ADR-256 Decision 4.)
  heading: (node, style, children) =>
    createElement(RacSlotScope, {
      key: node.id,
      context: "Heading",
      authored: node.props.slot,
      render: (resolution) =>
        createElement(
          Heading,
          {
            "data-catalog-id": node.id,
            ...racSlotProps(resolution),
            // S2 `level` — the heading element (unset = RAC's 3).
            ...(typeof node.props.level === "number"
              ? { level: node.props.level }
              : {}),
            style,
          } as Parameters<typeof Heading>[0],
          // (Its element children after its text — a Disclosure's header holds its trigger Button,
          // ADR-256 Phase 8c.)
          ...(children.length && !node.props.children
            ? []
            : (catalogTextRunsContent(
                node.textRuns,
                node.visual.textDecoration,
              ) ?? [String(node.props.children ?? "")])),
          ...children,
        ),
    }),
  // (`children`: what its field appends to the Label — the necessity indicator, ADR-253.)
  label: (node, style, children) =>
    createElement(
      Label,
      {
        key: node.id,
        "data-catalog-id": node.id,
        // (S2 LabeledValue: a `span` — `_labelElement`.)
        elementType: node.derivedProps?._labelElement,
        style,
      } as Parameters<typeof Label>[0],
      // (A ColorSlider's Label without its own text shows the channel's name — RAC's, ADR-258.)
      ...(catalogRacOwnsText(node) || node.derivedProps?._fieldComposed === true
        ? []
        : [String(node.props.children ?? "")]),
      ...necessityGrouped(children),
    ),
  description: (node, style) =>
    createElement(RacSlotScope, {
      key: node.id,
      context: "Text",
      authored: node.props.slot ?? "description",
      render: (resolution) =>
        createElement(
          CatalogFieldDescription,
          {
            "data-catalog-id": node.id,
            "data-disabled": node.derivedProps?.isDisabled || undefined,
            className: "react-aria-Description",
            "data-variant": "default",
            ...racSlotProps(resolution),
            style,
          } as Parameters<typeof Text>[0],
          String(node.props.children ?? ""),
        ),
    }),
  paragraph: (node, style) =>
    createElement(
      "p",
      { key: node.id, "data-catalog-id": node.id, style },
      ...(catalogTextRunsContent(node.textRuns, node.visual.textDecoration) ?? [
        String(node.props.children ?? ""),
      ]),
    ),
  fielderror: (node, style) =>
    createElement(
      "span",
      {
        key: node.id,
        "data-catalog-id": node.id,
        className: "react-aria-FieldError",
        role: "alert",
        style,
      },
      String(node.props.children ?? ""),
    ),
  actionbutton: (node, style, children) =>
    createElement(RacSlotScope, {
      key: node.id,
      context: "Button",
      authored: node.props.slot,
      render: (resolution: RacSlotResolution) =>
        createElement(
          ActionButton,
          {
            "data-catalog-id": node.id,
            "data-icon-only": node.derivedProps?._actionIconOnly || undefined,
            size: node.props.size,
            staticColor: catalogEffectiveStaticColor(node),
            isQuiet: node.props.isQuiet,
            type: node.props.type,
            isPending: node.props.isPending,
            autoFocus: node.props.autoFocus,
            // (A Pagination's shown page · an icon-only step button's word — 2026-11-19.)
            "aria-current": node.props["aria-current"],
            "aria-label": node.props["aria-label"],
            isDisabled: buttonDisabled(node) || node.props.isDisabled,
            ...buttonFormFocusProps(node),
            ...racSlotProps(resolution),
            style,
          } as Parameters<typeof ActionButton>[0],
          ...children,
          typeof node.props.children === "string" ? node.props.children : null,
        ),
    }),
  labeledvalue: (node, style, children) =>
    createElement(
      LabeledValue,
      {
        key: node.id,
        "data-catalog-id": node.id,
        size: node.props.size,
        labelPosition: node.props.labelPosition,
        labelAlign: node.props.labelAlign,
        style,
      } as Parameters<typeof LabeledValue>[0],
      ...children,
    ),
  linkbutton: (node, style, children) =>
    createElement(RacSlotScope, {
      key: node.id,
      context: "Link",
      authored: node.props.slot,
      render: (resolution) =>
        createElement(
          LinkButton,
          {
            key: node.id,
            "data-catalog-id": node.id,
            variant: node.props.variant,
            size: node.props.size,
            fillStyle: node.props.fillStyle,
            staticColor: catalogEffectiveStaticColor(node),
            "data-size": node.props.size,
            "data-variant": node.props.variant,
            "data-fill-style": node.props.fillStyle,
            "data-static-color": catalogEffectiveStaticColor(node),
            href: node.props.href as string | undefined,
            target: node.props.target as string | undefined,
            rel: node.props.rel as string | undefined,
            download: node.props.download,
            hrefLang: node.props.hrefLang,
            ping: node.props.ping,
            referrerPolicy: node.props.referrerPolicy,
            "aria-current": node.props["aria-current"],
            "aria-label": node.props["aria-label"],
            "aria-labelledby": node.props["aria-labelledby"],
            "aria-describedby": node.props["aria-describedby"],
            "aria-details": node.props["aria-details"],
            ...(node.props.isDisabled === true ? { isDisabled: true } : {}),
            autoFocus: node.props.autoFocus,
            ...racSlotProps(resolution),
            style,
          } as Parameters<typeof LinkButton>[0],
          ...children,
          typeof node.props.children === "string" ? node.props.children : null,
        ),
    }),
  button: (node, style, children) =>
    createElement(RacSlotScope, {
      key: node.id,
      context: "Button",
      authored: node.props.slot,
      render: (resolution) => buttonElement(node, style, children, resolution),
    }),
  // RAC `SelectValue` inside a Select's trigger Button (ADR-253): RAC writes the selected item's
  // text, or the Select's placeholder.
  selectvalue: (node, style, children) => {
    const invalid = node.derivedProps?._pickerInvalid === true;
    const glyph = pickerInvalidGlyph(node.props.size);
    return createElement(RAC.SelectValue, {
      key: node.id,
      "data-catalog-id": node.id,
      style: {
        ...style,
        ...(node.derivedProps?.color !== undefined ? { color: "inherit" } : {}),
        ...(invalid ? { position: "relative" } : {}),
      },
      children: ({
        defaultChildren,
        selectedItems,
        state,
      }: {
        defaultChildren: ReactNode;
        selectedItems: unknown[];
        state?: {
          selectionManager?: { selectedKeys?: Iterable<unknown> };
        };
      }) =>
        createElement(
          Fragment,
          null,
          // S2 체크리스트 §9.3 (S2 `renderValue`): its nodes are the value's shape while something is
          // selected — the copies of the selected items (RAC's running keys); else S2's default.
          children.length > 0 && selectedItems.length > 0
            ? createElement(
                CatalogSelectValueShape,
                {
                  keys: new Set(
                    [...(state?.selectionManager?.selectedKeys ?? [])].map(
                      String,
                    ),
                  ),
                },
                ...children,
              )
            : createElement(
                CatalogPickerValueContent,
                { count: selectedItems.length },
                defaultChildren,
              ),
          invalid
            ? createElement(Icon, {
                "aria-hidden": true,
                "data-picker-invalid": "",
                iconName: PICKER_INVALID_ICON,
                style: {
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: glyph.size,
                  height: glyph.size,
                  fontSize: glyph.size,
                  color:
                    node.derivedProps?.isDisabled === true
                      ? "var(--fg-picker-disabled)"
                      : "var(--negative)",
                },
              })
            : null,
        ),
    } as Parameters<typeof RAC.SelectValue>[0]);
  },
  icon: glyph("circle", 24),
  // The S2 IllustratedMessage's picture: its own class (the owner sheet places it) and its glyph
  // box (the Icon sheet's `.react-aria-Icon` height is the Icon scale's).
  illustration: (node, style, children, context) => {
    // (ADR-295 후속: the S2 picture is `scaled(n)` — its box is the device formula.)
    // (An authored px box is the picture — `catalogGlyphBoxSize`, the Icon's contract.)
    const size =
      catalogGlyphBoxSize(node) ??
      catalogDeviceGlyphSize(node.visual) ??
      catalogGlyphSize(node) ??
      96;
    return glyph("image", 96, "react-aria-Illustration")(
      node,
      { ...style, width: style.width ?? size, height: style.height ?? size },
      children,
      context,
    );
  },
  // ADR-256 Phase 5e: RAC `SelectionIndicator` in its item's context (there while the item is
  // selected); its box is the item sheet's (`.react-aria-Tab .react-aria-SelectionIndicator`).
  // (A Card's is S2's own `SelectionIndicator` div — `CatalogCardSelectionIndicator`.)
  selectionindicator: (node, style) =>
    node.derivedProps?._cardIndicator === true
      ? createElement(CatalogCardSelectionIndicator, {
          key: node.id,
          id: node.id,
          isSelected:
            typeof node.derivedProps._isSelected === "boolean"
              ? node.derivedProps._isSelected
              : undefined,
          style,
        })
      : createElement(RAC.SelectionIndicator, {
          key: node.id,
          "data-catalog-id": node.id,
          "data-variant": "default",
          "data-disabled": node.derivedProps?.isDisabled === true || undefined,
          style,
        } as Parameters<typeof RAC.SelectionIndicator>[0]),
  // ADR-256 Phase 5g: RAC `SubmenuTrigger` — no element of its own; it reads its item (the first
  // child — RAC gives it `aria-haspopup`) and the Popover holding the submenu (the second).
  submenutrigger: (node, _style, children) =>
    children.length < 2
      ? createElement(Fragment, { key: node.id }, ...children)
      : createElement(
          RAC.SubmenuTrigger as ElementType,
          { key: node.id },
          ...children,
        ),
  // S2 체크리스트 §9.3: S2 `UnavailableMenuItemTrigger` (`Menu.tsx:1074-1091`) — unavailable, RAC's
  // `SubmenuTrigger` around the item and its help Popover (named by its title Heading — the Popover's
  // own `aria-labelledby`, below); available, the item alone. No element of its own.
  unavailablemenuitemtrigger: (node, _style, children) =>
    node.props.isUnavailable !== true || children.length < 2
      ? createElement(Fragment, { key: node.id }, children[0])
      : createElement(
          RAC.SubmenuTrigger as ElementType,
          { key: node.id },
          ...children,
        ),
  // ADR-256 Phase 6g: RAC `Autocomplete` — no element of its own; it gives the text field inside
  // its input props and the collection beside it the filter · virtual focus.
  // ADR-314: S2 `Skeleton` — a loading context with no element of its own; only its children.
  // ADR-314 Phase 4: a CardView draws its SkeletonCollection's template as loading items itself
  //   (`delegatedDom.runtime.ts` `cardview`); anywhere else it is nothing.
  skeletoncollection: (node) => createElement(Fragment, { key: node.id }),
  skeleton: (node, _style, children) =>
    createElement(Fragment, { key: node.id }, ...children),
  autocomplete: (node, _style, children, context) => {
    // (Its list filtered on the server — `inputValue={list.filterText}
    // onInputChange={list.setFilterText}`, no client filter.)
    const runtime = context?.runtime;
    const serverCollection = runtime?.serverFilterOf?.(node.id);
    const text =
      runtime?.setRuntimeProps &&
      catalogControlledProps(
        node.id,
        (id, patch) => runtime.setRuntimeProps!(id, patch),
        INPUT_VALUE,
        String(
          runtime.overrideOf(node.id)?.inputValue ??
            node.props.defaultInputValue ??
            "",
        ),
      );
    return createElement(
      CatalogAutocomplete as ElementType,
      {
        key: node.id,
        // (A running Preview: its text controlled from the record's runtime value — ADR-280.)
        ...(text
          ? serverCollection && runtime?.setFilterText
            ? {
                ...text,
                onInputChange: (value: string) => {
                  (text.onInputChange as (next: string) => void)(value);
                  runtime.setFilterText!(serverCollection, value);
                },
                serverFiltered: true,
              }
            : text
          : typeof node.props.defaultInputValue === "string"
            ? { defaultInputValue: node.props.defaultInputValue }
            : {}),
        disableAutoFocusFirst: node.props.disableAutoFocusFirst === true,
        disableVirtualFocus: node.props.disableVirtualFocus === true,
      },
      ...children,
    );
  },
  // ADR-256 Phase 5h: RAC `TreeItemContent` — no element of its own; its children are the row's
  // (RAC gives them the row's chevron `Button` and selection `Checkbox` contexts).
  treeitemcontent: (node, _style, children) =>
    createElement(
      RAC.TreeItemContent as ElementType,
      { key: node.id },
      ...children,
    ),
  // ADR-300 Phase 2: the SideNav row's parts — RAC `NavigationTreeItemContent` (no element), RAC
  // `Link` in the row's `LinkContext`, RAC `NavigationTreeHeader` (`sideNav.components.tsx`).
  //   (In the lazy chunk its SideNav loaded — `sideNav.lazy.ts`.)
  sidenavitemcontent: (node, _style, children) =>
    catalogSideNavPart((parts) =>
      parts.catalogSideNavItemContent(node.id, children),
    ),
  sidenavitemlink: (node, style, children) =>
    catalogSideNavPart((parts) =>
      parts.catalogSideNavItemLink(node.id, style, children),
    ),
  sidenavheader: (node, style, children) =>
    catalogSideNavPart((parts) =>
      parts.catalogSideNavHeader(node.id, style, children),
    ),
  // (A Select · ComboBox draws its node tree — `delegatedDom` `select` · `combobox`, ADR-256 Phase
  // 6c · 6d.)
  // ADR-256 Phase 7a: a ProgressBar's parts in its RAC children — the reference's value text and
  // `div.track > div.fill`, with the classes the ProgressBar sheet styles (`.value` · `.bar` ·
  // `.fill`). Their bound text · width are the owner's render props (`valueBindings.ts`).
  progressbarvalue: (node, style) => progressPart(node, style, "span", "value"),
  progressbartrack: (node, style, children) =>
    progressPart(node, style, "div", "bar", children),
  progressbarfill: (node, style) => progressPart(node, style, "div", "fill"),
  // ADR-256 Phase 7b: a Meter's parts — the same elements (the Meter sheet's `.value` · `.bar` · `.fill`).
  metervalue: (node, style) => progressPart(node, style, "span", "value"),
  metertrack: (node, style, children) =>
    progressPart(node, style, "div", "bar", children),
  meterfill: (node, style) => progressPart(node, style, "div", "fill"),
  // ADR-256 Phase 7c: a Slider's parts are RAC's, in the Slider's context. The output writes RAC's
  // value text unless the node has its own; the fill and the thumbs keep RAC's placement (the
  // node's own style never moves them — `RAC_PLACED_KEYS`).
  slideroutput: (node, style) =>
    createElement(
      RAC.SliderOutput as ElementType,
      // (Its type size is the Slider sheet's — `.react-aria-Slider[data-size] .react-aria-SliderOutput`;
      //  its variant named, so the sheet's disabled color — `[data-variant][data-disabled]` — reaches it.)
      {
        key: node.id,
        "data-catalog-id": node.id,
        "data-variant": "default",
        style: sliderValueStyle(node, style),
      },
      ...(catalogRacOwnsText(node) || node.derivedProps?._fieldComposed === true
        ? []
        : [String(node.props.children ?? "")]),
    ),
  slidertrack: (node, style, children) =>
    createElement(RAC.SliderTrack as ElementType, {
      key: node.id,
      "data-catalog-id": node.id,
      "data-size": String(node.props.size ?? "M"),
      style,
      // S2 ColorSlider: the channel gradient over the checkerboard, the face outline (none while
      // disabled) — `colorHandle.ts`, the Canvas `color_slider_track`.
      ...(typeof node.derivedProps?._colorGradient === "string"
        ? {
            style: ({
              defaultStyle,
              isDisabled,
            }: {
              defaultStyle: CSSProperties;
              isDisabled: boolean;
            }) => ({
              ...defaultStyle,
              ...style,
              ...(isDisabled
                ? {}
                : {
                    ...COLOR_FACE_OUTLINE,
                    background: `${defaultStyle.background}, ${CATALOG_COLOR_CHECKER_CSS}`,
                  }),
            }),
          }
        : {}),
      children: catalogStateChildren(node.id, () => children),
    }),
  // S2 `upperTrack` (2026-11-18): the bar in the track row, holding the fill (`SliderTrackBar` — its
  // disabled look is the Slider's RAC state). A thick bar is 16 with the S2 sm corner (the Canvas
  // reads the same values: `CATALOG_SLIDER_THICK_TRACK` in `styleOf`, the rule's `track-style` block).
  // S2 `labelContainer` · field input `div` (2026-11-18): a Slider's two rows — plain `div`s.
  sliderlabelcontainer: (node, style, children) =>
    createElement(
      CatalogSliderLabelContainer as ElementType,
      { key: node.id, "data-catalog-id": node.id, style },
      ...children,
    ),
  sliderfieldinput: (node, style, children) =>
    createElement(
      CatalogSliderFieldInput as ElementType,
      {
        key: node.id,
        "data-catalog-id": node.id,
        size: String(node.props.size ?? "M"),
        style,
      },
      ...children,
    ),
  slidertrackbar: (node, style, children) =>
    createElement(
      CatalogSliderTrackBar as ElementType,
      {
        key: node.id,
        "data-catalog-id": node.id,
        ...sliderThickTrack(node, style, true),
      },
      ...children,
    ),
  sliderfill: (node, style) =>
    createElement(RAC.SliderFill as ElementType, {
      key: node.id,
      "data-catalog-id": node.id,
      // (S2 `isEmphasized` — the SliderFill sheet's variant, derived from the Slider; always named, so
      //  the sheet's disabled branch — `[data-variant][data-disabled]` — reaches the default fill.)
      "data-variant":
        node.derivedProps?.variant === "emphasized" ? "emphasized" : "default",
      ...(node.derivedProps?.trackStyle === "thick"
        ? { "data-track-style": "thick" }
        : {}),
      // (S2 `fillOffset` — RAC's own fill placement starts there; derived from the Slider.)
      ...(typeof node.derivedProps?._fillOffset === "number"
        ? { offset: node.derivedProps._fillOffset }
        : {}),
      style: ({ defaultStyle }: { defaultStyle: CSSProperties }) => ({
        ...withoutRacPlacement(sliderThickTrack(node, style, false).style),
        ...defaultStyle,
      }),
    }),
  // ADR-256 Phase 8a: RAC `OverlayArrow` with the reference starter's svg (its overlay's size —
  // `_arrowSize`); RAC places it from the trigger and the overlay's sheet turns the svg. Its paint
  // is its overlay's surface (`catalogOverlayArrowPaint` — the Canvas reads the same values).
  overlayarrow: (node, style) => {
    const size = Number(node.derivedProps?._arrowSize ?? 12);
    const color = (value: unknown) =>
      typeof value !== "string"
        ? undefined
        : value.startsWith("{")
          ? tokenToCSSVar(value as TokenRef)
          : value;
    const fill = color(node.derivedProps?._arrowFill);
    const stroke = color(node.derivedProps?._arrowStroke);
    return createElement(
      RAC.OverlayArrow as ElementType,
      { key: node.id, "data-catalog-id": node.id, style },
      createElement(
        "svg",
        {
          width: size,
          height: size,
          viewBox: `0 0 ${size} ${size}`,
          ...(fill
            ? {
                style: {
                  fill,
                  stroke: stroke ?? "none",
                  ...(stroke
                    ? { strokeWidth: node.derivedProps?._arrowStrokeWidth }
                    : {}),
                },
              }
            : {}),
        },
        createElement("path", {
          d: `M0 0 L${size / 2} ${size / 2} L${size} 0`,
        }),
      ),
    );
  },
  // ADR-256 Phase 9 · S2 1.8.2 `Calendar.tsx` (2026-11-18): a calendar's parts — `header > div (one
  // heading group per shown month: Button[previous] + CalendarHeading + Button[next]) + div >
  // CalendarGrid (one per shown month) > CalendarCell`. A heading group · grid is one copy per shown
  // month (the resolver's — its `monthIndex`); its heading · grid show the month at that offset.
  calendarmonth: (node, style, children) =>
    createElement(
      CalendarMonthOffset.Provider,
      { key: node.id, value: node.monthIndex ?? 0 },
      createElement(
        "div",
        { "data-catalog-id": node.id, className: "month", style },
        ...children,
      ),
    ),
  calendarheader: (node, style, children) =>
    createElement(
      "header",
      { key: node.id, "data-catalog-id": node.id, style },
      ...children,
    ),
  calendarheading: (node, style) =>
    createElement(CatalogCalendarHeading, { key: node.id, node, style }),
  // (A grid repeated on its own in the grid row — S2's, 2026-11-18 — is its own month's copy.)
  calendargrid: (node, style, children) => {
    const grid = createElement(CatalogCalendarGrid, {
      key: node.id,
      node,
      style,
      parts: children,
    });
    return node.monthIndex === undefined
      ? grid
      : createElement(
          CalendarMonthOffset.Provider,
          { key: node.id, value: node.monthIndex },
          grid,
        );
  },
  calendarcell: (node, style, children) =>
    createElement(CatalogCalendarCell, {
      key: node.id,
      node,
      style,
      cellChildren: children,
    }),
  // The weekday cell · date segment templates (Decision 13): RAC draws them per day · segment.
  calendarheadercell: (node, style, children) =>
    createElement(CatalogCalendarHeaderCell, {
      key: node.id,
      node,
      style,
      cellChildren: children,
    }),
  datesegment: (node, style) =>
    createElement(CatalogDateSegment, { key: node.id, node, style }),
  // RAC's month · year pickers (no element): their render props reach their Select (its name,
  // value and move) and its ListBox (the items — `CatalogCalendarPickerContext`).
  calendarmonthpicker: (node, _style, children) =>
    createElement(RAC.CalendarMonthPicker as ElementType, {
      key: node.id,
      format: catalogCalendarMonthPickerFormat(node.props.format),
      children: (aria: CatalogCalendarPickerAria) =>
        createElement(
          CatalogCalendarPickerContext.Provider,
          { value: { ownerId: node.id, aria } },
          ...children,
        ),
    }),
  calendaryearpicker: (node, _style, children) =>
    createElement(RAC.CalendarYearPicker as ElementType, {
      key: node.id,
      visibleYears: catalogCalendarVisibleYears(node.props.visibleYears),
      children: (aria: CatalogCalendarPickerAria) =>
        createElement(
          CatalogCalendarPickerContext.Provider,
          { value: { ownerId: node.id, aria } },
          ...children,
        ),
    }),
  // 2026-11-18: S2 `DisclosureHeader` — the title Heading's row (a plain `div`; RAC's Disclosure
  // contexts reach the Heading through it).
  disclosureheader: (node, style, children) =>
    createElement(
      "div",
      {
        key: node.id,
        "data-catalog-id": node.id,
        className: "react-aria-DisclosureHeader",
        style,
      },
      ...children,
    ),
  // ADR-256 Phase 8c: RAC `DisclosurePanel` around the starter's content `div`, which is the
  // node's box (the Disclosure sheet's `.react-aria-DisclosurePanel > div` padding).
  disclosurepanel: (node, style, children) =>
    createElement(
      RAC.DisclosurePanel as ElementType,
      { key: node.id, "data-catalog-id": node.id },
      createElement("div", { style }, ...children),
    ),
  // (A thumb's `index` is its place among its track's thumbs — `renderNode` gives it.)
  sliderthumb: (node, style) => {
    // S2 `thumbStyle: precise` — a narrow bar (width 6, size + 2 tall; the Canvas layout's values).
    const size = Number(node.visual.height ?? node.visual.width ?? 18);
    const precise = node.derivedProps?.thumbStyle === "precise";
    return createElement(CatalogSliderThumb as ElementType, {
      key: node.id,
      "data-catalog-id": node.id,
      ...(precise ? { "data-thumb-style": "precise" } : {}),
      index: Number(node.props.index ?? node.props._thumbIndex ?? 0),
      name:
        typeof node.derivedProps?.name === "string"
          ? node.derivedProps.name
          : undefined,
      form:
        typeof node.derivedProps?.form === "string"
          ? node.derivedProps.form
          : undefined,
      "aria-label":
        typeof node.derivedProps?.thumbLabel === "string"
          ? node.derivedProps.thumbLabel
          : undefined,
      // (ADR-295 후속: S2 `size()` numbers — the device formula of the desktop px.)
      style: precise
        ? {
            ...withoutRacPlacement(style),
            width: catalogDeviceScaledCss(6),
            height: catalogDeviceScaledCss(size + 2),
          }
        : withoutRacPlacement(style),
    });
  },
  // ADR-258 Phase 2: a Color control's parts are RAC's, in its context — RAC places the thumb at
  // the value and paints it the displayed color, and sizes · paints · clips the wheel's ring (the
  // node's own style never moves or repaints them — `RAC_COLOR_PART_KEYS`).
  // (S2 `ColorHandle` — the inner ring, checkerboard and drag Loupe: `colorHandleDom.runtime.ts`.)
  colorthumb: (node, style) =>
    createElement(CatalogColorHandle as ElementType, {
      key: node.id,
      "data-catalog-id": node.id,
      style: withoutRacColorPart(withoutRacPlacement(style)),
    }),
  // S2 ColorWheel: the track's outline (offset −1) and the inner border `div` (inset = the track,
  // its outline outside) — none while disabled (`colorHandle.ts`, the Canvas `color_wheel_track`).
  colorwheeltrack: (node, style) =>
    createElement(
      Fragment,
      { key: node.id },
      createElement(RAC.ColorWheelTrack as ElementType, {
        "data-catalog-id": node.id,
        style: ({ isDisabled }: { isDisabled: boolean }) => ({
          ...withoutRacColorPart(style),
          ...(isDisabled ? {} : COLOR_FACE_OUTLINE),
        }),
      }),
      // (Hidden while the wheel is disabled — the ColorWheel rule's `[data-disabled]` selector.)
      createElement("div", {
        "aria-hidden": true,
        className: "color-wheel-inner-ring",
        style: {
          position: "absolute",
          inset: CATALOG_COLOR_WHEEL_TRACK,
          pointerEvents: "none",
          borderRadius: "50%",
          outline: CATALOG_COLOR_CONTROL_OUTLINE_CSS,
        },
      }),
    ),
};

/** S2's Color control face outline (`outline 1px gray-1000/10`, offset −1 — `colorHandle.ts`). */
/** S2 `ColorSwatch.tsx`'s background for the swatch color (`#rrggbbaa` — `_swatchColor`). */
function colorSwatchBackground(color: unknown): CSSProperties {
  if (typeof color !== "string" || !/^#[0-9a-f]{8}$/i.test(color)) return {};
  const alpha = Number.parseInt(color.slice(7), 16);
  if (alpha === 255) return {};
  if (alpha > 0)
    return {
      background: `linear-gradient(${color}, ${color}), ${CATALOG_COLOR_SWATCH_CHECKER_CSS}`,
    };
  const half = CATALOG_COLOR_SWATCH_SLASH.width / 2;
  const red = tokenToCSSVar(CATALOG_COLOR_SWATCH_SLASH.token as TokenRef);
  return {
    background: `linear-gradient(to bottom right, transparent calc(50% - ${half}px), ${red} calc(50% - ${half}px) calc(50% + ${half}px), transparent calc(50% + ${half}px)) no-repeat`,
  };
}

const COLOR_FACE_OUTLINE: CSSProperties = {
  outline: CATALOG_COLOR_CONTROL_OUTLINE_CSS,
  outlineOffset: -CATALOG_COLOR_CONTROL_OUTLINE.width,
};

/** Keys RAC writes on a ColorThumb · ColorWheelTrack from the control's state (`useColorWheel` · `ColorThumb`). */
const RAC_COLOR_PART_KEYS = [
  "width",
  "height",
  "background",
  "backgroundColor",
  "backgroundImage",
  "clipPath",
] as const;

function withoutRacColorPart(style: CSSProperties): CSSProperties {
  const out = { ...style };
  for (const key of RAC_COLOR_PART_KEYS) delete out[key];
  return out;
}

/** Keys RAC's SliderFill · SliderThumb place by the Slider's state (`useSliderThumb` · `SliderFill`). */
const RAC_PLACED_KEYS = [
  "position",
  "left",
  "right",
  "top",
  "bottom",
  "insetInlineStart",
  "transform",
] as const;

/**
 * S2 `trackStyle: thick` on a Slider's bar · fill (the derived `trackStyle`): the S2 sm corner, and
 * the bar's 16 height (ADR-295 후속: an S2 `size()` number — the device formula of the desktop px).
 */
function sliderThickTrack(
  node: CatalogConsumerNode,
  style: CSSProperties,
  bar: boolean,
): { style: CSSProperties; "data-track-style"?: "thick" } {
  if (node.derivedProps?.trackStyle !== "thick") return { style };
  return {
    "data-track-style": "thick",
    style: {
      ...style,
      ...(bar
        ? { height: catalogDeviceScaledCss(CATALOG_SLIDER_THICK_TRACK.height) }
        : {}),
      borderRadius: CATALOG_SLIDER_THICK_TRACK.radius,
    },
  };
}

/**
 * S2 1.8.2 Slider value text (`Slider.tsx` — the presence's `_valueChars` · `_valueAlign`): `${n}ch`
 * wide and at least as wide (an authored width wins), tabular digits, its text at its row's side.
 * The SliderOutput rule's box is a flex box, where `text-align` does not move the text (its
 * anonymous item is only as wide as the text) — `justify-content` does, as S2's `textAlign` on its
 * blockified `<output>`. The Canvas reads the same (`sliderValueWidth`, `sliderValueText`).
 */
function sliderValueStyle(
  node: CatalogConsumerNode,
  style: CSSProperties,
): CSSProperties {
  const chars = node.derivedProps?._valueChars;
  if (typeof chars !== "number") return style;
  const align = node.derivedProps?._valueAlign;
  return {
    width: `${chars}ch`,
    minWidth: `${chars}ch`,
    ...style,
    fontVariantNumeric: "tabular-nums",
    justifyContent: align === "end" ? "flex-end" : "flex-start",
  };
}

function withoutRacPlacement(style: CSSProperties): CSSProperties {
  const out = { ...style };
  for (const key of RAC_PLACED_KEYS) delete out[key];
  return out;
}

/** A progress part's element (a ProgressBar's · Meter's value text, track and fill). */
function progressPart(
  node: CatalogConsumerNode,
  style: CSSProperties,
  tag: "span" | "div",
  className: string,
  children: ReactElement[] = [],
): ReactElement {
  return createElement(
    tag,
    {
      key: node.id,
      "data-catalog-id": node.id,
      className,
      style: {
        ...style,
        ...(tag === "span" && node.visual.whiteSpace !== undefined
          ? {
              whiteSpace: node.visual.whiteSpace as CSSProperties["whiteSpace"],
            }
          : {}),
      },
    },
    ...(tag === "span" ? [String(node.props.children ?? "")] : children),
  );
}

/**
 * The element of a node-tree field's control Group, by the field's binding (ADR-256 Phase 2c ·
 * 6b · 6d): RAC's `Group` — a ComboBox's also carries its container class (the field rule's
 * selector for the box · the parts' row). Like any Group it passes the author's `role`
 * and its render props as the state frame of the `showWhen` nodes inside (Decision 7); its states
 * go only when the author set them — `false` would override the field's own (RAC's `GroupContext`).
 */
const NODE_TREE_CONTROL_CLASSES: Readonly<Record<string, string | undefined>> =
  {
    numberfield: undefined,
    // (RAC's DatePicker · DateRangePicker · ComboBox take this Group as their Popover's trigger —
    // `GroupContext` ref, ADR-256 Phase 6d · 6e.)
    datepicker: undefined,
    daterangepicker: undefined,
    combobox: "react-aria-Group combobox-container",
    // (S2 `FieldGroup` around a TextField's · TextArea's · ColorField's Input and a DateField's ·
    //  TimeField's DateInput — 2026-11-14.)
    textfield: undefined,
    textarea: undefined,
    // (S2 체크리스트 §4.1: a TokenField's box around its TokenInput — S2 TextArea's `FieldGroup`.)
    tokenfield: undefined,
    colorfield: undefined,
    datefield: undefined,
    timefield: undefined,
    // (2026-11-13: S2 SearchField's `FieldGroup` around its glyph · Input · clear button.)
    searchfield: undefined,
  };
/**
 * Fields whose control Group is S2's `FieldGroup role="presentation"` taking the field's invalid ·
 * disabled itself: RAC's TextField · SearchField give no `GroupContext`, and a DateField's · TimeField's
 * is its DateInput's (`DATE_BOX_GROUP_BINDINGS` — S2 `DateField.tsx` passes `role="presentation"` ·
 * `isDisabled` · `isInvalid` to the `FieldGroup`).
 */
/** Date fields whose RAC `GroupContext` belongs to their DateInput, not to the box Group around it. */
const DATE_BOX_GROUP_BINDINGS: ReadonlySet<string> = new Set([
  "datefield",
  "timefield",
]);
const PREFIX_GROUP_BINDINGS: ReadonlySet<string> = new Set([
  "textfield",
  "textarea",
  // (RAC's TokenField gives no `GroupContext` either.)
  "tokenfield",
  "colorfield",
  "searchfield",
  "datefield",
  "timefield",
]);

/** The DOM id of a prefix (its author id, else one from the node) — the input names it (S2). */
export function catalogFieldPrefixDomId(node: CatalogConsumerNode): string {
  return node.htmlId ?? `prefix-${node.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

/**
 * ADR-259 Phase 2 — S2 `FieldGroup` (`Field.tsx:258-273`): a press on the box that is not on a
 * button or the input (the prefix, the padding) focuses the input — mouse `pointerdown`, touch
 * `touchend`.
 */
function forwardFocus(event: {
  target: EventTarget | null;
  currentTarget: EventTarget;
  preventDefault: () => void;
}): void {
  const target = event.target as Element | null;
  if (
    !target ||
    (target as HTMLElement).isContentEditable ||
    target.closest('button,input,textarea,[role="button"]')
  )
    return;
  event.preventDefault();
  // (A TokenField's TokenInput is RAC's contenteditable `div`.)
  (event.currentTarget as Element)
    .querySelector<HTMLElement>('input, textarea, [contenteditable="true"]')
    ?.focus();
}

/**
 * S2 `FieldErrorIcon` in an invalid field's box (`fieldPrefix.ts` `catalogFieldErrorIcon`): the glyph
 * element after its input. The input keeps the glyph's room at its end (its end padding), so the glyph
 * takes no room of its own — its start margin pulls it back over that room (and the box's gap before
 * it), its end margin is the rest: the Canvas draws it at the same place on the input.
 */
function withFieldErrorIcon(
  root: CatalogCompositionRoot,
  group: CatalogConsumerNode,
  field: CatalogConsumerNode,
  box: { buttoned: boolean },
  children: ReactElement[],
): ReactElement[] {
  const at = children.findIndex(
    (child) =>
      isValidElement(child) &&
      child.type === CatalogDomNode &&
      typeof root.domInputs.get((child.props as CatalogDomNodeProps).id)
        ?.derivedProps?._fieldErrorIcon === "number",
  );
  if (at < 0) return children;
  const input = root.domInputs.get(
    (children[at]!.props as CatalogDomNodeProps).id,
  )!;
  const size = Number(input.derivedProps!._fieldErrorIcon);
  const end = Number(input.derivedProps!._fieldErrorIconEnd ?? 0);
  const authored = authoredStyle(root, group) as CSSProperties;
  const gap =
    authored.columnGap ??
    authored.gap ??
    catalogFieldBoxStyle(
      field.props.size,
      catalogTypeName(root, field),
      box.buttoned,
    ).gap ??
    0;
  const gapCss = typeof gap === "number" ? `${gap}px` : String(gap);
  return [
    ...children.slice(0, at + 1),
    createElement(Icon, {
      key: "field-error-icon",
      "aria-hidden": true,
      "data-field-error-icon": "",
      iconName: CATALOG_FIELD_ERROR_ICON,
      style: {
        flexShrink: 0,
        width: size,
        height: size,
        fontSize: size,
        color: "var(--negative)",
        alignSelf:
          input.derivedProps?._fieldErrorIconTop === true
            ? "flex-start"
            : "center",
        marginInlineStart: `calc(${-(end + size)}px - ${gapCss})`,
        marginInlineEnd: end,
      },
    }),
    ...children.slice(at + 1),
  ];
}

function nodeTreeControlGroup(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  field: CatalogConsumerNode,
  className: string | undefined,
  children: ReactElement[],
): ReactElement {
  const role = node.props.role;
  const box = catalogFieldBox(
    node,
    (id) => root.domInputs.get(id),
    (record) => catalogTypeName(root, record),
  );
  const ownGroup = PREFIX_GROUP_BINDINGS.has(field.bindingId ?? "");
  const disabled = field.props.isDisabled === true;
  if (box) children = withFieldErrorIcon(root, node, field, box, children);
  // The input's name: its label, then the prefix (S2 `FieldGroup` extends `InputContext` — not a
  // TextArea's, S2 G0 oracle).
  const prefixId =
    box?.prefix &&
    !CATALOG_PREFIX_UNNAMED_FIELDS.has(catalogTypeName(root, field))
      ? catalogFieldPrefixDomId(box.prefix)
      : undefined;
  const content = prefixId
    ? createElement(RAC.InputContext.Consumer as ElementType, {
        children: (ctx: Record<string, unknown> | null) =>
          createElement(
            RAC.InputContext.Provider,
            {
              value: {
                ...(ctx ?? {}),
                "aria-labelledby": ctx?.["aria-labelledby"]
                  ? `${String(ctx["aria-labelledby"])} ${prefixId}`
                  : prefixId,
              },
            },
            ...children,
          ),
      })
    : undefined;
  // A DateField's · TimeField's `GroupContext` (the field props · ref RAC gives its DateInput) passes
  //   this box to the DateInput inside: the box takes only its own presentation role and the field's
  //   states — one element carries the field's id, role and key handling.
  const passesGroupContext = DATE_BOX_GROUP_BINDINGS.has(field.bindingId ?? "");
  const group = (fieldGroupContext?: unknown) =>
    createElement(RAC.Group, {
      key: node.id,
      "data-catalog-id": node.id,
      ...(className || box
        ? {
            className: [
              className ?? "react-aria-Group",
              box && CATALOG_FIELD_BOX_CLASS,
            ]
              .filter(Boolean)
              .join(" "),
          }
        : {}),
      ...(role === "region" || role === "presentation"
        ? { role }
        : ownGroup
          ? { role: "presentation" }
          : {}),
      ...Object.fromEntries(
        (["isDisabled", "isInvalid", "isReadOnly"] as const)
          .filter(
            (key) =>
              node.props[key] === true ||
              (ownGroup && field.props[key] === true),
          )
          .map((key) => [key, true]),
      ),
      // ADR-259 Phase 2: the prefix box (S2 `FieldGroup`) — the Input rule's sheet draws it
      // (`FieldBox`) at the field's size and quiet state; a press on it focuses the input.
      ...(box
        ? {
            "data-size": String(field.props.size ?? "M"),
            "data-variant": "default",
            ...(field.props.isQuiet === true ? { "data-quiet": "true" } : {}),
            style: (() => {
              const style = catalogFieldBoxStyle(
                field.props.size,
                catalogTypeName(root, field),
                box.buttoned,
              );
              return {
                display: style.display,
                flexDirection: style.flexDirection,
                alignItems: style.alignItems,
                width: style.width,
                ...(style.height !== undefined ? { height: style.height } : {}),
                paddingTop: style.paddingTop,
                paddingRight: style.paddingRight,
                paddingBottom: style.paddingBottom,
                paddingLeft: style.paddingLeft,
                // (S2 NumberField: the stepper gap is the Group's own — authored rowGap · columnGap win.)
                ...(style.gap !== undefined
                  ? { rowGap: style.gap, columnGap: style.gap }
                  : {}),
                // (A quiet box's corners · fill are the quiet state's — a SearchField's pill stays out.)
                ...quietStyle(node, authoredStyle(root, node)),
              };
            })(),
            ...(disabled
              ? {}
              : {
                  onPointerDown: (event: {
                    pointerType: string;
                    target: EventTarget | null;
                    currentTarget: EventTarget;
                    preventDefault: () => void;
                  }) => {
                    if (event.pointerType === "mouse") forwardFocus(event);
                  },
                  onTouchEnd: forwardFocus,
                }),
          }
        : { style: authoredStyle(root, node) }),
      children: catalogStateChildren(node.id, () => {
        const parts = content ? [content] : children;
        return passesGroupContext
          ? [
              createElement(
                RAC.GroupContext.Provider,
                { key: "field-group", value: fieldGroupContext as never },
                ...parts,
              ),
            ]
          : parts;
      }),
    } as unknown as Parameters<typeof RAC.Group>[0]);
  if (!passesGroupContext) return group();
  return createElement(RAC.GroupContext.Consumer as ElementType, {
    key: node.id,
    children: (fieldGroupContext: unknown) =>
      createElement(
        RAC.GroupContext.Provider,
        { value: null },
        group(fieldGroupContext),
      ),
  });
}

/** A toggle's text in its RAC button (ADR-256 Phase 3): a `span` with the Label rule's look. */
const toggleTextBinding: DomBinding = (node, style, children) =>
  createElement(
    "span",
    {
      key: node.id,
      "data-catalog-id": node.id,
      className: "react-aria-Label",
      style,
    },
    String(node.props.children ?? ""),
    ...children,
  );

// S2 HelpText shows description only while valid, including RAC client validation.
function CatalogFieldDescription(props: Parameters<typeof Text>[0]) {
  const validation = useContext(RAC.FieldErrorContext);
  return validation?.isInvalid ? null : createElement(Text, props);
}

const fieldErrorBinding: DomBinding = (node, style) =>
  createElement(
    RAC.FieldError,
    {
      key: node.id,
      "data-catalog-id": node.id,
      "data-disabled": node.derivedProps?.isDisabled || undefined,
      "data-variant": "default",
      style,
    } as Parameters<typeof RAC.FieldError>[0],
    String(node.props.children ?? "") || undefined,
  );

/**
 * S2 체크리스트 §4.1 TokenField Phase 4 — a TokenField's error part: RAC TokenField has no FieldError
 * context, so its text at the id the field's `aria-describedby` names (`CatalogTokenFieldError`). It
 * shows while the field is invalid with a message (`catalogFieldHintShown`).
 */
const tokenFieldErrorBinding: DomBinding = (node, style) =>
  createElement(
    CatalogTokenFieldError,
    { key: node.id, "data-catalog-id": node.id, style },
    String(node.props.children ?? ""),
  );

/**
 * ADR-256 Phase 5d — a TagGroup's error part (a FieldError origin instance): the reference's
 * `Text[slot=errorMessage]` in the TagGroup's text context (a TagGroup has no validation, so no
 * RAC FieldError context — the part shows while it has a message, `presentWhen`).
 */
const tagGroupErrorBinding: DomBinding = (node, style) =>
  createElement(
    RAC.Text,
    {
      key: node.id,
      "data-catalog-id": node.id,
      slot: "errorMessage",
      className: "react-aria-FieldError",
      style,
    } as Parameters<typeof RAC.Text>[0],
    String(node.props.children ?? ""),
  );

/**
 * The quiet state of a field's box part (`data-quiet` — the part rule's `&[data-quiet]`): the
 * part of a quiet field (`derivedProps.isQuiet`, `presence.ts`).
 */
const quietState = (node: CatalogConsumerNode) =>
  node.derivedProps?.isQuiet === true ? { "data-quiet": "true" } : {};

/**
 * What the quiet state itself draws — no fill, an underline, square corners: a rest value the
 * document wrote for those (a SearchField's pill radius on its Input) stays out of the inline
 * style while the part is quiet, so the part sheet's state shows (as a Button's state paint).
 */
const QUIET_STATE_KEYS: ReadonlySet<string> = new Set([
  "background",
  "backgroundColor",
  "borderColor",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
  "boxShadow",
]);

const quietStyle = (
  node: CatalogConsumerNode,
  style: CSSProperties,
): CSSProperties =>
  node.derivedProps?.isQuiet === true
    ? (Object.fromEntries(
        Object.entries(style).filter(([key]) => !QUIET_STATE_KEYS.has(key)),
      ) as CSSProperties)
    : style;

/**
 * A field's Input node (ADR-253): a RAC `Input` — the `<textarea>` of a TextArea — inside the
 * field's RAC context, which gives it its id, value and state. Its box is the Input rule's sheet
 * at the node's size (`data-size`, the field's); `style` carries only what the document wrote
 * (the Input origin's override, this node's own values). Nothing the field's context already
 * provides is passed.
 */
function fieldInputBinding(
  node: CatalogConsumerNode,
  style: CSSProperties,
  field: CatalogConsumerNode,
): ReactElement {
  const text = (key: string) =>
    typeof node.props[key] === "string" && node.props[key]
      ? { [key]: node.props[key] }
      : {};
  const multiline = field.bindingId === "textarea";
  const rows = typeof field.props.rows === "number" ? field.props.rows : 3;
  // ADR-295 Phase 3: the rows box over the device variables (the touch set's line and height).
  if (multiline) {
    style = { ...style };
    catalogDeviceRowsHeightCss(style, node.visual, rows);
  }
  return createElement((multiline ? RAC.TextArea : RAC.Input) as ElementType, {
    key: node.id,
    "data-catalog-id": node.id,
    ...(typeof node.props.size === "string"
      ? { "data-size": node.props.size }
      : {}),
    ...quietState(node),
    // (`type` is a TextField's own prop: any other field's RAC context sets its input's type —
    // a SearchField's `search`.)
    ...(multiline
      ? { rows }
      : field.bindingId === "textfield"
        ? text("type")
        : {}),
    ...text("placeholder"),
    "data-authored-color": style.color !== undefined || undefined,
    style: quietStyle(node, style),
  });
}

/**
 * A date field's DateInput node (ADR-253): a RAC `DateInput` — its segments are RAC's — inside
 * the field's RAC context. Its box is the DateInput rule's sheet at the node's size
 * (`data-size`); `style` carries only what the document wrote. `slot` is RAC's named slot of a
 * range picker's pair (`start` · `end`).
 */
/**
 * ADR-259 Phase 2 — an Input (DateInput) in a field box (S2 `FieldGroup`): the Group draws the box, the
 * Input lays its own down (`CATALOG_FIELD_BOX_INPUT_STYLE` — the Canvas layout · paint read the same).
 * These are its defaults there: what the author wrote on it comes after and wins. Empty elsewhere.
 */
function laidFieldBoxInput(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  end: number | undefined,
  start: number | undefined,
): CSSProperties {
  return catalogFieldBoxInputDomStyle(
    node,
    (id) => root.domInputs.get(id),
    (entry) => catalogTypeName(root, entry),
    end,
    start,
  );
}

function fieldDateInputBinding(
  node: CatalogConsumerNode,
  style: CSSProperties,
  children: ReactElement[] = [],
): ReactElement {
  // ADR-256 Phase 9 (Decision 13): its segment node is the template RAC draws per segment.
  const segment = repeatTemplatePart(children, "datesegment");
  return createElement(
    RAC.DateInput,
    {
      key: node.id,
      "data-catalog-id": node.id,
      ...(typeof node.props.size === "string"
        ? { "data-size": node.props.size }
        : {}),
      ...quietState(node),
      ...(typeof node.props.slot === "string" && node.props.slot
        ? { slot: node.props.slot }
        : {}),
      style: quietStyle(node, style),
    } as unknown as Parameters<typeof RAC.DateInput>[0],
    ((part: Parameters<typeof RAC.DateSegment>[0]["segment"]) =>
      segment
        ? createElement(DateSegmentPart.Provider, { value: part }, segment)
        : createElement(RAC.DateSegment, { segment: part })) as never,
  );
}

/** A Button's own `isDisabled`, or its ButtonGroup's (S2 — every Button in the group, `presence.ts`). */
const buttonDisabled = (node: CatalogConsumerNode) =>
  node.props.isDisabled === true || node.derivedProps?.isDisabled === true;

/** A Button node's element (its RAC slot resolved in the parent's Button context). */
/** S2 form · focus props of a Button · ActionButton (binding — editorHidden): the authored ones. */
function buttonFormFocusProps(
  node: CatalogConsumerNode,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const key of Object.keys(BUTTON_FORM_FOCUS_ACCEPTS))
    if (node.props[key] !== undefined) props[key] = node.props[key];
  return props;
}

function buttonElement(
  node: CatalogConsumerNode,
  style: CSSProperties,
  children: ReactElement[],
  resolution: RacSlotResolution,
): ReactElement {
  // A TreeItem's expand button (RAC's `chevron` slot — ADR-256 Phase 5h): the reference's plain
  // RAC Button, which `Tree.css` styles (`.react-aria-Button[slot=chevron] { all: unset }`) — the
  // filled `.button-base` paint of a later layer stays off.
  // A Disclosure's trigger (RAC's `trigger` slot — ADR-256 Phase 8c) is the reference's plain RAC
  // Button too: the Disclosure sheet styles it (`.react-aria-Button[slot='trigger']`).
  // A calendar's previous · next Buttons (RAC's `previous` · `next` slots — ADR-256 Phase 9) are the
  // reference starter's plain RAC Buttons too: the calendar sheets style them
  // (`.react-aria-Calendar header > .react-aria-Button`).
  if (
    resolution.kind === "named" &&
    (resolution.slot === "chevron" ||
      resolution.slot === "trigger" ||
      resolution.slot === "previous" ||
      resolution.slot === "next")
  )
    return createElement(
      RAC.Button,
      {
        "data-catalog-id": node.id,
        slot: resolution.slot,
        // (What the document says, as below — Phase 8 판독 M2.)
        ...(buttonDisabled(node) ? { isDisabled: true } : {}),
        ...(node.props.autoFocus === true ? { autoFocus: true } : {}),
        style,
      } as Parameters<typeof RAC.Button>[0],
      ...children,
      ...(node.props.children === undefined || node.props.children === ""
        ? []
        : [String(node.props.children)]),
    );
  return createElement(
    Button,
    {
      "data-catalog-id": node.id,
      variant: node.props.variant,
      size: node.props.size,
      fillStyle: node.props.fillStyle,
      staticColor: catalogEffectiveStaticColor(node),
      type: node.props.type,
      // Only what the document says (ADR-253 Decision 5): RAC puts an explicit prop over its
      // parent's context, so a default `false` would undo a field's disabled stepper.
      ...(buttonDisabled(node) ? { isDisabled: true } : {}),
      // (S2 `isPending` — the shared Button hides its content and shows the pending circle,
      //  `buttonPending.ts`; RAC marks the element and blocks the press.)
      ...(node.props.isPending === true ? { isPending: true } : {}),
      ...(node.props.autoFocus === true ? { autoFocus: true } : {}),
      ...buttonFormFocusProps(node),
      // RAC's named slot of the parent this Button belongs to (a NumberField's steppers) —
      // ADR-256 Decision 4: the slot the context resolves to (`null` = detached).
      ...racSlotProps(resolution),
      // (A quiet Select's trigger: the field sheet draws the quiet box — `data-quiet` keeps the
      // filled Button paint off, and a rest paint the document wrote stays out while quiet, as
      // on a quiet field's Input.)
      ...quietState(node),
      // (A field's own button keeps its size's corner — the Button rule's `field-button` blocks;
      //  a Button elsewhere is S2's pill.)
      ...(typeof node.derivedProps?.fieldButton === "string"
        ? { "data-field-button": node.derivedProps.fieldButton }
        : {}),
      ...(node.derivedProps?._searchFieldPart === true
        ? { "data-search-field-part": "true" }
        : {}),
      ...(node.derivedProps?._pickerTrigger === true
        ? {
            "data-picker": "true",
            "data-invalid": node.derivedProps._pickerInvalid || undefined,
          }
        : {}),
      style: quietStyle(node, style),
    } as unknown as Parameters<typeof Button>[0],
    ...children,
    ...(node.props.children === undefined || node.props.children === ""
      ? []
      : [String(node.props.children)]),
  );
}

/**
 * A resolution with no context to connect to — detached, not connected, or no provider above
 * (rendered as the plain element, the DOM it had before ADR-256).
 */
function detachedSlot(resolution: RacSlotResolution): boolean {
  return (
    resolution.kind === "detached" ||
    resolution.kind === "unconnected" ||
    resolution.kind === "none"
  );
}

/** Binding ids with a product DOM binding (census and consumers read this, not a copy). */
export const CATALOG_DOM_BINDING_IDS: ReadonlySet<string> = new Set(
  Object.keys(bindings),
);

/**
 * RAC overlays render nothing while closed (D1): a Tooltip/Popover/Modal without an open trigger,
 * and a Dialog inside a DialogTrigger. Their Canvas nodes stay; their DOM is absent.
 */
function isClosedOverlay(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): boolean {
  if (CATALOG_DOM_OVERLAY_BINDINGS.has(node.bindingId ?? "")) return true;
  return (
    node.bindingId === "dialog" &&
    root.domInputs.get(node.parentId)?.bindingId === "dialogtrigger"
  );
}

export const CATALOG_DOM_OVERLAY_BINDINGS: ReadonlySet<string> = new Set([
  "tooltip",
  "popover",
  "modal",
  "sheetoverlay",
]);

/**
 * Whether `id` renders its own DOM element: false inside a child-owning RAC parent and for a
 * closed overlay and its subtree.
 */
export function catalogDomRendersNode(
  root: CatalogCompositionRoot,
  id: string,
): boolean {
  const self = root.domInputs.get(id);
  if (self && isClosedOverlay(root, self)) return false;
  if (self && catalogOwnerDrawnPart(root, self)) return false;
  const selfParent = self ? root.domInputs.get(self.parentId) : undefined;
  if (
    self &&
    selfParent &&
    CATALOG_DELEGATED_DOM[selfParent.bindingId ?? ""]?.absorbsChild?.(
      self,
      selfParent,
      root,
    )
  )
    return false;
  let child = self;
  let parentId = self?.parentId;
  const path: CatalogConsumerNode[] = [];
  while (child && parentId) {
    path.push(child);
    const parent = root.domInputs.get(parentId);
    if (!parent) return true;
    const delegated = CATALOG_DELEGATED_DOM[parent.bindingId ?? ""];
    if (
      isClosedOverlay(root, parent) ||
      delegated?.ownsChild?.(child, parent, root) ||
      path.some((node) => delegated?.ownsDescendant?.(node, parent, root))
    )
      return false;
    child = parent;
    parentId = parent.parentId;
  }
  return true;
}

/** Authored visual writes → inline CSS for rule-backed nodes (library values are class CSS). */
const TYPOGRAPHY_KEYS: ReadonlySet<string> = new Set([
  "fontFamily",
  "fontStyle",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecoration",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "textOverflow",
]);

/**
 * ADR-257 Phase 3 — a Table cell's text box (the rule's S2 `align` · `overflowMode` blocks): the
 * Canvas paints these on a cell · column text leaf (`canvasBinding` `text`), so its DOM element
 * takes them inline too. A Badge's (ADR-257 후속 — S2 `overflowMode`) the same way: its rule
 * painter draws its text with them.
 */
const RULE_TEXT_BOX_BINDINGS: ReadonlySet<string> = new Set([
  "cell",
  "column",
  "badge",
]);

const RULE_TEXT_BOX_CSS: Readonly<
  Record<string, (value: unknown) => CSSProperties>
> = {
  textAlign: (value) => ({
    textAlign: String(value) as CSSProperties["textAlign"],
  }),
  whiteSpace: (value) => ({
    whiteSpace: String(value) as CSSProperties["whiteSpace"],
  }),
  textOverflow: (value) => ({ textOverflow: String(value) }),
};

const AUTHORED_CSS: Readonly<
  Record<string, (value: unknown) => CSSProperties>
> = {
  fill: (value) => ({ backgroundColor: cssColor(value) }),
  backgroundColor: (value) => ({ backgroundColor: cssColor(value) }),
  color: (value) => ({ color: cssColor(value) }),
  borderColor: (value) => ({ borderColor: cssColor(value) }),
  radius: (value) => ({ borderRadius: Number(value) }),
  // (A length string — an origin's `"1px"` — as written; a number is px.)
  borderWidth: (value) => ({
    borderWidth:
      typeof value === "string" && Number.isNaN(Number(value))
        ? value
        : Number(value),
  }),
  fontSize: (value) => ({ fontSize: Number(value) }),
  fontWeight: (value) => ({ fontWeight: Number(value) }),
  width: (value) => ({ width: cssLength(value as CatalogLength) }),
  height: (value) => ({ height: cssLength(value as CatalogLength) }),
  minWidth: (value) => ({ minWidth: cssLength(value as CatalogLength) }),
  minHeight: (value) => ({ minHeight: cssLength(value as CatalogLength) }),
  // ADR-909: shorthands go out as their longhands — React writes inline styles key by key, so a
  // shorthand next to its longhands lets a later shorthand change overwrite the longhand the
  // Canvas keeps (`AUTHORED_PRECEDENCE` orders them like `catalogBoxModel`).
  gap: (value) => ({
    rowGap: cssLength(value as CatalogLength),
    columnGap: cssLength(value as CatalogLength),
  }),
  padding: (value) => ({
    paddingTop: cssLength(value as CatalogLength),
    paddingRight: cssLength(value as CatalogLength),
    paddingBottom: cssLength(value as CatalogLength),
    paddingLeft: cssLength(value as CatalogLength),
  }),
  paddingX: (value) => ({
    paddingLeft: cssLength(value as CatalogLength),
    paddingRight: cssLength(value as CatalogLength),
  }),
  paddingY: (value) => ({
    paddingTop: cssLength(value as CatalogLength),
    paddingBottom: cssLength(value as CatalogLength),
  }),
  paddingTop: (value) => ({ paddingTop: cssLength(value as CatalogLength) }),
  paddingRight: (value) => ({
    paddingRight: cssLength(value as CatalogLength),
  }),
  paddingBottom: (value) => ({
    paddingBottom: cssLength(value as CatalogLength),
  }),
  paddingLeft: (value) => ({ paddingLeft: cssLength(value as CatalogLength) }),
  lineHeight: (value) => ({ lineHeight: Number(value) }),
  opacity: (value) => ({ opacity: Number(value) }),
  overflow: (value) => ({
    overflow: String(value) as CSSProperties["overflow"],
  }),
  borderStyle: (value) => ({
    borderStyle: String(value) as CSSProperties["borderStyle"],
  }),
  ...Object.fromEntries(
    [...CATALOG_AUTHORED_PAINT_KEYS].map((key) => [
      key,
      (value: unknown) =>
        catalogAuthoredPaintCss({
          visual: { [key]: value as never },
        }) as CSSProperties,
    ]),
  ),
};

/**
 * Whether a Column is a row header: a column marked `isRowHeader`, else the first named column not
 * marked `false` (Round 12 — RAC throws without one, so a header whose columns are all marked
 * `false` still has its first named column name the rows).
 */
function columnIsRowHeader(
  root: CatalogCompositionRoot,
  column: CatalogConsumerNode,
): boolean {
  if (column.props.isRowHeader === true) return true;
  const header = root.domInputs.get(column.parentId);
  const columns = (header?.children ?? [])
    .map((id) => root.domInputs.get(id))
    .filter(
      (child): child is CatalogConsumerNode =>
        !!child && catalogTypeName(root, child) === "Column",
    );
  // (Not a selection column — its `Checkbox[slot=selection]` names no row, ADR-256 Phase 5i-2.
  //  One rule with the session's Table state — `catalogTableColumnRoles`, ADR-315.)
  const roles = catalogTableColumnRoles(columns, (id) => {
    const box = root.domInputs.get(id);
    return (
      !!box &&
      catalogTypeName(root, box) === "Checkbox" &&
      box.props.slot === "selection"
    );
  });
  return (
    roles[columns.findIndex((child) => child.id === column.id)]?.rowHeader ===
    true
  );
}

/**
 * A SubmenuTrigger's children as RAC reads them — its item, then the Popover holding the submenu
 * (`children[0]` · `children[1]`), whatever the authored order (ADR-256 Phase 5 Round 12). Without
 * a Popover yet the item alone is drawn, as a plain item.
 */
function submenuTriggerChildren(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): readonly string[] {
  const first = (type: string) =>
    node.children.find((id) => {
      const child = root.domInputs.get(id);
      return !!child && catalogTypeName(root, child) === type;
    });
  const item = first("MenuItem");
  const popover = first("Popover");
  return item ? (popover ? [item, popover] : [item]) : [];
}

/** The overlays between a Dialog and its DialogTrigger (RAC's trigger context reaches through). */
const DIALOG_TRIGGER_OVERLAYS = new Set(["Modal", "ModalOverlay", "Popover"]);

/** The Dialog sits in a DialogTrigger's overlay (layout frames skipped — `catalogDomPartParent`). */
function inDialogTrigger(
  root: CatalogCompositionRoot,
  dialog: CatalogConsumerNode,
): boolean {
  for (
    let parent = catalogDomPartParent(root, dialog);
    parent;
    parent = catalogDomPartParent(root, parent)
  ) {
    const type = catalogTypeName(root, parent);
    if (type === "DialogTrigger") return true;
    if (!type || !DIALOG_TRIGGER_OVERLAYS.has(type)) return false;
  }
  return false;
}

/**
 * The Dialog sits in a DatePicker's · DateRangePicker's Popover (S2 `CalendarPopover`, 2026-11-18):
 * RAC's picker names it (`DialogContext` — `aria-labelledby` = the picker's label), so no fallback.
 */
function inPickerPopover(
  root: CatalogCompositionRoot,
  dialog: CatalogConsumerNode,
): boolean {
  const popover = catalogDomPartParent(root, dialog);
  if (!popover || catalogTypeName(root, popover) !== "Popover") return false;
  const picker = catalogDomPartParent(root, popover);
  return (
    picker?.bindingId === "datepicker" ||
    picker?.bindingId === "daterangepicker"
  );
}

/** A Dialog's title: a Heading below it with RAC's `title` slot (not one of a nested Dialog). */
function dialogTitleOf(
  root: CatalogCompositionRoot,
  dialog: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  const visit = (id: string): CatalogConsumerNode | undefined => {
    const record = root.domInputs.get(id);
    if (!record || record.hidden || record.bindingId === "dialog")
      return undefined;
    if (record.bindingId === "heading" && record.props.slot === "title")
      return record;
    for (const child of record.children) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  for (const child of dialog.children) {
    const found = visit(child);
    if (found) return found;
  }
  return undefined;
}

/**
 * ADR-259 Phase 3 — a ContextualHelp's Popover holds a `slot="title"` Heading (S2 names the
 * Popover by it). The closed Popover is a hidden record (the Canvas draws no closed overlay), so
 * the search goes in regardless — a Heading the document hides itself (`showWhen`) is not a title.
 */
/** The title Heading id of an unavailable item's help Popover (its HTML id), when it has one. */
function catalogUnavailableHelpTitle(
  root: CatalogCompositionRoot,
  popover: CatalogConsumerNode,
): string | undefined {
  const owner = root.domInputs.get(popover.parentId);
  if (
    !owner ||
    owner.bindingId !== "unavailablemenuitemtrigger" ||
    owner.props.isUnavailable !== true
  )
    return undefined;
  const visit = (id: string): string | undefined => {
    const record = root.domInputs.get(id);
    if (!record) return undefined;
    if (record.bindingId === "heading" && record.props.slot === "title")
      return !record.showWhen && !catalogAbsentByValue(record)
        ? record.htmlId
        : undefined;
    for (const child of record.children) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  for (const child of popover.children) {
    const found = visit(child);
    if (found) return found;
  }
  return undefined;
}

function contextualHelpTitled(
  root: CatalogCompositionRoot,
  help: CatalogConsumerNode,
): boolean {
  const visit = (id: string): boolean => {
    const record = root.domInputs.get(id);
    if (!record || record.bindingId === "contextualhelp") return false;
    if (record.bindingId === "heading" && record.props.slot === "title")
      return !record.showWhen && !catalogAbsentByValue(record);
    return record.children.some(visit);
  };
  return help.children.some(visit);
}

/** Parents whose RAC `PopoverContext` places their Popover (ADR-256 Phase 5g · 6c · 6d · 6e). */
const CONTEXT_PLACED_POPOVER_PARENTS: ReadonlySet<string> = new Set([
  "MenuTrigger",
  "SubmenuTrigger",
  "UnavailableMenuItemTrigger",
  "Select",
  "ComboBox",
  "DatePicker",
  "DateRangePicker",
]);

/**
 * S2 1.8.0 Picker · ComboBox · MenuTrigger place their Popover from their own `direction` + `align`
 * (S2 `placement={`${direction} ${align}`}`, defaults bottom · start — RAC's `bottom start`). A
 * MenuTrigger's sideways direction (`left` · `right` · `start` · `end`) takes its other half from
 * `align`: start → top, end → bottom (S2 `MenuTrigger`).
 */
const S2_OVERLAY_POSITION_OWNERS: ReadonlySet<string> = new Set([
  "Select",
  "ComboBox",
  "MenuTrigger",
]);

/**
 * S2 1.8.0 `menuWidth` (px): a Picker's Popover takes it as its width (not when quiet — the trigger
 * width stays its minimum), a ComboBox's as `--trigger-width` (its width and minimum).
 * The viewport collision cap below constrains both the requested width and minimum.
 */
function s2MenuWidthStyle(
  ownerType: string,
  props: Readonly<Record<string, unknown>>,
): CSSProperties | undefined {
  const width = props.menuWidth;
  if (typeof width !== "number" || !(width > 0)) return undefined;
  if (ownerType === "Select")
    return props.isQuiet === true ? undefined : { width: `${width}px` };
  if (ownerType === "ComboBox")
    return { "--trigger-width": `${width}px` } as CSSProperties;
  return undefined;
}

/**
 * Registered components that drop DOM rest props: the marker is a `display: contents` wrapper.
 * (None now — the shared data Table was the one; the catalog Table is RAC's, ADR-256 Phase 5i.)
 */
const MARKER_WRAPPED_RULE_TYPES: ReadonlySet<string> = new Set<string>();

/**
 * DOM for a rule-backed node without a type binding: the registered RAC component
 * (`source.kind: "rac"`) or shared internal renderer, with `toRacProps` data attributes so the
 * generated class CSS applies. Components that compose their children from an element context
 * (the Preview's delegating renderers) need their own binding and fail here explicitly.
 */
/**
 * Whether an Image is in an S2 Card's `CardPreview` (layout frames skipped) — there the Card's sheet
 * paints its placeholder; elsewhere the Image rule's rest paint goes inline.
 */
function imageInS2CardPreview(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): boolean {
  const parent = catalogDomPartParent(root, node);
  return !!parent && catalogTypeName(root, parent) === "CardPreview";
}

/**
 * An Image's `img` source and text (S2 `Image` — `src` only when set, `alt=""` without one: no
 * text = decorative). The picture covers the box (S2 Card's image · `Avatar.tsx`), as the Canvas
 * image shape fits it (`ruleShapes` — cover).
 */
function imageElementProps(
  props: Readonly<Record<string, unknown>>,
): Record<string, string | number> & { alt: string; src?: string } {
  // ADR-235: an uploaded `asset:` ref resolves to its URL (`Avatar.tsx`); not ready yet = no src.
  const src =
    typeof props.src === "string" && props.src !== ""
      ? (resolveAssetUrl(props.src) ?? undefined)
      : undefined;
  // (S2 `Image`'s `img` attributes — 부록 D.2: the fetch hints and the intrinsic size, as authored.)
  const attributes: Record<string, string | number> = {};
  for (const key of Object.keys(IMAGE_ELEMENT_PROP_CONTRACTS)) {
    const value = props[key];
    if (typeof value === "string" ? value !== "" : typeof value === "number")
      attributes[key] = value as string | number;
  }
  return {
    ...attributes,
    ...(src ? { src } : {}),
    alt: typeof props.alt === "string" ? props.alt : "",
  };
}

function ruleDom(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  children: ReactElement[],
  context: CatalogDomContext,
): ReactElement {
  const type = node.ruleId!;
  const binding = getPrimitiveBinding(type);
  const delegating =
    binding?.source.kind === "internal"
      ? DELEGATING_INTERNAL_RENDERERS.has(binding.source.renderer)
      : binding?.source.kind === "rac" && DELEGATING_RAC_RENDERERS.has(type);
  if (delegating)
    throw new Error(`CATALOG_DOM_BINDING_REQUIRED:${node.definitionId}`);
  // ADR-257 Phase 4 — the RAC Table these parts belong to, and whether one of its Columns resizes
  // (the Preview wraps it in RAC's `ResizableTableContainer` — the Canvas has no operations).
  const domGet = (recordId: string) => root.domInputs.get(recordId);
  const domType = (entry: CatalogConsumerNode) => catalogTypeName(root, entry);
  const operationsTable =
    type === "Table"
      ? node
      : type === "Column"
        ? domGet(domGet(node.parentId)?.parentId ?? "")
        : type === "TableHeader" || type === "Row"
          ? catalogTrackTableOf(node, domGet, domType)
          : undefined;
  // (ADR-277: the table is one type — only a Table with a resizing Column is in RAC's container.)
  const resizable =
    !!operationsTable &&
    domType(operationsTable) === "Table" &&
    catalogTableResizable(operationsTable, domGet, domType);
  // (ADR-315 Phase 4 — a pinned column's edge line is the Column · Cell rule's derived
  //  `pinned-edge` block: Column · Cell have no sheet of their own, so it goes inline as their
  //  other rule values do — the same rest values the Canvas paints, `catalogDerivedRestVisual`.)
  // (ADR-315 Phase 6 — a merged Table's body Row · Cell line is the Row · Cell rule's derived
  //  `cell-lines` · `merge-line` block, inline the same way.)
  const edged: CatalogConsumerNode =
    node.derivedProps?.pinnedEdge ||
    node.derivedProps?.cellLines ||
    node.derivedProps?.mergeLine ||
    node.derivedProps?.inFooter
      ? {
          ...node,
          visual: {
            ...node.visual,
            ...catalogDerivedRestVisual(root, node),
          } as CatalogConsumerNode["visual"],
        }
      : node;
  let style = {
    ...authoredStyle(root, edged),
    ...catalogTableTrackStyle(node, resizable),
    ...catalogTablePinnedStyle(node),
    // (ADR-310 Phase 8: a virtual-scrolled Table's Row fills the row box RAC's `TableLayout` gives
    //  it — its cells are placed in that box, so the Row's own border draws at the box's edge.)
    ...(catalogFillsVirtualBox(
      root,
      type === "Row" ? operationsTable : domGet(node.parentId),
      type === "Row",
    )
      ? { height: "100%" }
      : {}),
    // (ADR-295 후속 C7: S2's checkbox column part ends 8 in — `catalogBoxModel`; an authored end wins.)
    ...(node.derivedProps?._tableSelectionPart === true &&
    catalogAuthoredVisual(root, node).paddingRight === undefined
      ? { paddingRight: cssLength(catalogBoxModel(node).padding?.right ?? 0) }
      : {}),
  };
  // (The resolved static scheme — an `auto`'s backdrop scheme, a group's — over the prop; an empty
  //  one is none, 2026-11-14.)
  const staticColor = catalogEffectiveStaticColor(node);
  const bindingProps =
    staticColor !== node.props.staticColor
      ? { ...node.props, staticColor }
      : node.props;
  const racProps = binding ? toRacProps({ props: bindingProps }, binding) : {};
  const { children: textChildren, ...rest } = racProps;
  // Separator has no authorable variant, but its size/staticColor paint branches belong to
  // the default catalog variant. Match that sheet without adding a public variant prop.
  if (type === "Separator") rest["data-variant"] = "default";
  // (A scheme a record takes without accepting the prop — an ActionButton's count badge, S2
  //  `NotificationBadgeContext`; the Canvas paint reads the same derived value, 2026-11-14.)
  if (staticColor && rest["data-static-color"] === undefined)
    rest["data-static-color"] = staticColor;
  if (node.domSlot) rest.slot = catalogDomSlot(node);
  const lower = type.toLowerCase();
  // ADR-280 Decision 3 · 4 (Phase 0 probe P1) — an overlay's open state is its trigger's: a
  // running Preview controls the trigger's `isOpen` from the record's runtime value (a rule's
  // `open` · `close`, the user's press · dismiss). A body owns it only standing without a trigger
  // (its own `isOpen` beats the trigger's context — giving it one inside would kill the press).
  if (
    context.runtime?.setRuntimeProps &&
    (CATALOG_OPEN_TRIGGER_TYPES.has(type) ||
      (CATALOG_OPEN_BODY_TYPES.has(type) &&
        catalogOpenOwnerOf(root, node.id, domType) === undefined))
  ) {
    const declared = root.domInputs.get(node.id)?.props ?? node.props;
    Object.assign(
      rest,
      catalogControlledProps(
        node.id,
        (id, patch) => context.runtime!.setRuntimeProps!(id, patch),
        IS_OPEN,
        Boolean(
          catalogRuntimeStateOf(
            root,
            root.domInputs.get(node.id) ?? node,
            context.runtime.overrideOf(node.id),
            "isOpen",
          ) ??
          declared.defaultOpen ??
          false,
        ),
      ),
    );
    delete rest.defaultOpen;
  }
  // `useAsyncList`'s load (resolver — a bound Table): S2's TableBody shows it, not RAC's Table.
  if (lower === "table") delete rest.loadingState;
  // S2 TableView `loadingState: "loading"` — an empty body draws the progress circle (S2
  // `TableBody`'s `renderEmptyState`; rows keep showing while they reload).
  // S2 TableView `TableBody` `renderEmptyState` (S2 체크리스트 부록 D.3 2단계, 2026-11-23): the
  // Table's IllustratedMessage child (the body's children are its rows) is what RAC draws in the body
  // while it has no rows — the Table does not draw it.
  const tableEmptyStateId = (table: CatalogConsumerNode | undefined) =>
    table?.children.find((id) => {
      const child = root.domInputs.get(id);
      return (
        !!child && catalogIsEmptyState(catalogTypeName(root, child), "Table")
      );
    });
  const emptyStateId =
    lower === "tablebody"
      ? tableEmptyStateId(root.domInputs.get(node.parentId))
      : undefined;
  const bodyEmptyState = emptyStateId
    ? createElement(CatalogDomNode, {
        key: catalogChildKey(node, emptyStateId),
        root,
        id: emptyStateId,
        context,
      })
    : undefined;
  const ownEmptyStateId =
    lower === "table" ? tableEmptyStateId(node) : undefined;
  if (
    lower === "tablebody" &&
    root.domInputs.get(node.parentId)?.props.loadingState === "loading"
  )
    rest.renderEmptyState = catalogLoadingEmptyState;
  else if (bodyEmptyState) rest.renderEmptyState = () => bodyEmptyState;
  // A resizable Column's document width is where its drag starts (S2 `width` is controlled — the
  // widths a drag leaves are the Preview's, 사용자 결정 5).
  if (lower === "column" && resizable) {
    if (rest.width !== undefined) rest.defaultWidth = rest.width;
    delete rest.width;
    // (ADR-315 Phase 4 — the width the Table's state holds, a resize's or a remembered one, wins
    //  over the document's.)
    const kept =
      operationsTable &&
      context.runtime?.tableColumnWidths?.(operationsTable.id)?.[
        catalogTableColumnKey({
          id: node.id,
          ...(node.htmlId ? { htmlId: node.htmlId } : {}),
        })
      ];
    if (typeof kept === "number") rest.defaultWidth = kept;
  }
  // (ADR-315 Phase 4 — a pinned Column measures its header: the pinned columns after it stand
  //  past its width, `CatalogTablePinMeasure`.)
  const pinnedColumn =
    lower === "column" &&
    (node.props[CATALOG_COLUMN_PINNED_PROP] === "start" ||
      node.props[CATALOG_COLUMN_PINNED_PROP] === "end");
  const columnOperations =
    lower === "column" &&
    (node.props.allowsSorting === true ||
      resizable ||
      pinnedColumn ||
      node.props[CATALOG_COLUMN_MENU_PROP] === true) &&
    operationsTable
      ? {
          measuresPin: pinnedColumn,
          sortable: node.props.allowsSorting === true,
          sortsInline: catalogColumnSortsInline(node, domGet, domType),
          // (ADR-315 Phase 2 — this Column's place in a sort of several: its order mark.)
          sortEntry: columnSortEntry(root, node, operationsTable, context),
          resizable: node.props.allowsResizing === true,
          // (ADR-315 Phase 4 — S2 `isMenu`, the resolver's: the same value the rule's `is-menu`
          //  block and the Table's end line read.)
          menu: node.props[CATALOG_COLUMN_MENU_PROP] === true,
          // (ADR-315 Phase 4 — its items and their writes are the session's, by the Column's RAC
          //  key: `tableColumnMenu.ts`.)
          ...(node.props[CATALOG_COLUMN_MENU_PROP] === true &&
          context.runtime?.tableColumnMenu &&
          context.runtime.runTableColumnMenu
            ? (() => {
                const runtime = context.runtime!;
                const racKey = catalogTableColumnKey({
                  id: node.id,
                  ...(node.htmlId ? { htmlId: node.htmlId } : {}),
                });
                return {
                  // (ADR-315 Phase 4 증분 5 — a Table that reorders: each data Column's header
                  //  drags by its handle and takes a drop — the session's write.)
                  ...(operationsTable.props.allowsColumnReordering === true &&
                  runtime.dropTableColumn
                    ? {
                        drag: {
                          table: operationsTable.id,
                          key: racKey,
                          drop: (from: string, apply: boolean) =>
                            runtime.dropTableColumn!(
                              operationsTable.id,
                              from,
                              racKey,
                              apply,
                            ),
                        },
                      }
                    : {}),
                  menuItems: () =>
                    runtime.tableColumnMenu!(operationsTable.id, racKey),
                  runMenu: (id: CatalogColumnMenuItemId) =>
                    runtime.runTableColumnMenu!(operationsTable.id, racKey, id),
                  // (ADR-315 Phase 4 증분 4c — 「Filter…」's dialog reads · writes the session's.)
                  ...(runtime.tableColumnFilter && runtime.setTableColumnFilter
                    ? {
                        filter: {
                          read: () =>
                            runtime.tableColumnFilter!(
                              operationsTable.id,
                              racKey,
                            ),
                          write: (
                            condition:
                              CatalogTableColumnFilter["condition"] | undefined,
                          ) =>
                            runtime.setTableColumnFilter!(
                              operationsTable.id,
                              racKey,
                              condition,
                            ),
                        },
                      }
                    : {}),
                };
              })()
            : {}),
          // (One Column of a resizable Table writes RAC's widths as the rows' tracks.)
          writesTracks:
            resizable &&
            (domGet(node.parentId)?.children ?? []).find((columnId) => {
              const column = domGet(columnId);
              return (
                !!column &&
                domType(column) === "Column" &&
                !catalogTableSelectionPartHidden(column, domGet, domType)
              );
            }) === node.id,
        }
      : undefined;
  // ADR-256 Phase 5g · 6c · 6d · 6e: a submenu's · picker's Popover takes its place from RAC's
  // SubmenuTrigger · Select · ComboBox · DatePicker · DateRangePicker (`end top` · `bottom start`,
  // their `PopoverContext`) — the type's default `placement` would override it (the reference
  // passes none). A placement the author chose wins (Phase 6 Round 14 m4); the record carries the
  // default when none was chosen, so the default value stands for "none". The trigger owner is
  // found through layout frames (RAC's context reaches the Popover there).
  const placementOwner =
    lower === "popover" ? catalogDomPartParent(root, node) : undefined;
  const placementOwnerType =
    placementOwner && catalogTypeName(root, placementOwner);
  if (
    placementOwner &&
    placementOwnerType &&
    CONTEXT_PLACED_POPOVER_PARENTS.has(placementOwnerType) &&
    rest.placement === binding?.props.accepts.placement?.default
  ) {
    // S2 Picker · ComboBox · MenuTrigger: the owner's `direction` · `align` (the Popover's own
    // placement, when chosen, still wins).
    if (S2_OVERLAY_POSITION_OWNERS.has(placementOwnerType))
      rest.placement = catalogS2OverlayPlacement(placementOwner.props);
    else delete rest.placement;
  }
  // S2 `menuWidth` — the Popover's own authored width wins.
  const menuWidth =
    placementOwner &&
    placementOwnerType &&
    s2MenuWidthStyle(placementOwnerType, placementOwner.props);
  if (menuWidth) style = { ...menuWidth, ...style };
  // CSS min-width wins over max-width. A full-viewport picker trigger must not
  // force its menu beyond the space left by RAC's collision padding.
  if (placementOwnerType && LISTBOX_PICKER_TYPES.has(placementOwnerType)) {
    const defaults = catalogPickerMenuWidth(
      placementOwnerType,
      placementOwner!.props,
      "var(--trigger-width)",
    );
    if (
      placementOwnerType === "Select" &&
      placementOwner!.props.isQuiet === true
    )
      style = { width: cssLength(defaults.width), ...style };
    const authoredWidth = node.sizing.width ?? node.visual.width;
    if (
      catalogHasAuthoredVisual(root, node, "width") &&
      (typeof authoredWidth === "number" || typeof authoredWidth === "string")
    )
      style.width = cssLength(authoredWidth);
    const available = "var(--catalog-overlay-available-width)";
    const ownMax = style.maxWidth;
    style = {
      ...style,
      minWidth: `min(${cssLength(style.minWidth ?? defaults.minWidth)}, ${available})`,
      maxWidth:
        ownMax && ownMax !== "none"
          ? `min(${cssLength(ownMax)}, ${available})`
          : available,
    };
  }
  // A Dialog is named by its title (RAC `Heading slot="title"` → `aria-labelledby`, ADR-254); one
  // without a title (and without the author's name) keeps the fallback name. RAC drops the title
  // link whenever an `aria-label` is given (`useDialog`), so the fallback is decided here. In a
  // DialogTrigger RAC names a titleless Dialog by its trigger (`aria-labelledby` = the trigger's
  // id): no fallback there (G5 example 4).
  if (
    lower === "dialog" &&
    !node.ariaLabel &&
    !dialogTitleOf(root, node) &&
    !inDialogTrigger(root, node) &&
    !inPickerPopover(root, node)
  )
    rest["aria-label"] = "Dialog";
  // S2 Dialog `isDismissible` gives its Modal RAC's `isDismissable` (`_dialogDismissible`).
  if (lower === "modal" && node.derivedProps?._dialogDismissible === true)
    rest.isDismissable = true;
  // S2 Dialog `isKeyboardDismissDisabled` gives its Modal RAC's (`_dialogKeyboardDismissDisabled`).
  if (
    lower === "modal" &&
    node.derivedProps?._dialogKeyboardDismissDisabled === true
  )
    rest.isKeyboardDismissDisabled = true;
  // An open modal's underlay is the Modal rule's (`_modalUnderlay` — the Canvas backdrop paints the
  // same): the shared Modal · a Dialog opening its own modal put it on their `ModalOverlay`.
  const underlay = node.derivedProps?._modalUnderlay;
  if ((lower === "modal" || lower === "dialog") && typeof underlay === "string")
    rest.underlay = underlay.startsWith("{")
      ? tokenToCSSVar(underlay as TokenRef)
      : underlay;
  // ADR-256 Phase 8a: an overlay's arrow is its `OverlayArrow` child node — the shared overlay
  // draws none of its own.
  if (lower === "popover" || lower === "tooltip") {
    rest.hideArrow = true;
    // shared wrapper는 size prop으로 data-size를 쓰므로 catalog 값을 함께 전달한다.
    rest.size = node.props.size;
  }
  // S2 체크리스트 §9.3: an unavailable item's help Popover is named by its `slot="title"` Heading
  // (S2 `ContextualHelpPopover` `aria-labelledby={titleId}` over the item RAC's SubmenuTrigger names
  // it by) — the Heading's element id, which an automatic HTML id always gives.
  if (lower === "popover") {
    const title = catalogUnavailableHelpTitle(root, node);
    if (title) rest["aria-labelledby"] = title;
  }
  // ADR-259 Phase 3: S2 names a ContextualHelp's Popover by its `slot="title"` Heading (without
  // one RAC names it by the trigger).
  if (lower === "contextualhelp")
    rest.titled = contextualHelpTitled(root, node);
  // S2 ColorWheel `size` → RAC's required radii (outer = half the diameter, inner = outer − the
  // track) — the raw number must not reach the DOM element. The box is the diameter square: S2
  // writes width/height from `size` over the style (ColorWheel.tsx), so a box sizing never parts
  // the wheel from its track (ADR-258 후속 — the Canvas `styleOf` square is the same).
  if (lower === "colorwheel") {
    const diameter = catalogColorWheelDiameter(node.props.size);
    rest.outerRadius = diameter / 2;
    rest.innerRadius = diameter / 2 - CATALOG_COLOR_WHEEL_TRACK;
    delete rest.size;
    style = { ...style, width: diameter, height: diameter };
  }
  // S2 ColorArea's face outline (offset −1, none while disabled — `colorHandle.ts`; the Canvas
  // `color_area_fill`).
  if (lower === "colorarea" && node.props.isDisabled !== true)
    style = { ...COLOR_FACE_OUTLINE, ...style };
  // S2 ColorSwatch: its border over its color (the rule's own is transparent), a translucent color
  // over the swatch checkerboard, alpha 0 = the red slash (`colorHandle.ts` — the Canvas `color_swatch`).
  if (lower === "colorswatch")
    style = {
      ...style,
      border: CATALOG_COLOR_SWATCH_BORDER_CSS,
      ...colorSwatchBackground(node.derivedProps?._swatchColor),
    };
  // ADR-258 Decision 1 · 8 — the Color controls get the props the Canvas reads
  //   (`catalogColorControlProps`): a RAC color value (the binding default when empty or not one)
  //   and channels of the effective space — one fallback for both consumers (RAC throws on the
  //   rest; a ColorSlider without a value took the whole Preview down).
  const colorType = CATALOG_COLOR_CONTROL_TYPES.has(type)
    ? (type as CatalogColorControlType)
    : undefined;
  if (colorType) {
    for (const key of ["colorSpace", "channel", "xChannel", "yChannel"])
      delete rest[key];
    Object.assign(rest, catalogColorControlProps(colorType, node.props));
    // ADR-280 Decision 4 — a running Preview controls the color from the record's runtime `value`
    // (a rule's `setValue`, the user's drag); a static render keeps RAC's default.
    if (context.runtime?.setRuntimeProps) {
      const runtimeValue = node.props.value;
      Object.assign(
        rest,
        catalogControlledProps(
          node.id,
          (id, patch) => context.runtime!.setRuntimeProps!(id, patch),
          VALUE,
          catalogColorInSpace(runtimeValue, rest.defaultValue),
          (next) =>
            next &&
            typeof (next as { toString?: unknown }).toString === "function"
              ? String(next)
              : null,
        ),
      );
      delete rest.defaultValue;
    }
  }
  // (A Breadcrumb draws its node tree — `delegatedDom` `breadcrumb`, ADR-256 Phase 5a.)
  // S2 TableView `renderActionBar` (부록 D.3 2단계, 2026-11-23): its ActionBar child is drawn beside
  //   the table in S2's wrapper (`CatalogActionBarHost`), not inside it.
  const tableActionBar =
    lower === "table"
      ? catalogLinkedActionBarOf(node, domGet, domType)
      : undefined;
  const childId = (element: ReactElement) =>
    (element.props as { id?: unknown }).id;
  const tableActionBarElement = tableActionBar
    ? children.find((element) => childId(element) === tableActionBar.id)
    : undefined;
  const ownChildren =
    ownEmptyStateId || tableActionBar
      ? children.filter(
          (element) =>
            childId(element) !== ownEmptyStateId &&
            childId(element) !== tableActionBar?.id,
        )
      : children;
  // ADR-259 Phase 1: S2 `hideLinkOutIcon` is an owner's context value (its items carry a copy) —
  // no RAC prop.
  delete rest.hideLinkOutIcon;
  // (S2 ListView's `hasChildItems` draws the chevron below — no RAC prop.)
  delete rest.hasChildItems;
  // (An emptied link field is no link — RAC makes any `href` one.)
  for (const key of ["href", "target", "rel"])
    if (rest[key] === "") delete rest[key];
  // S2's link-out glyph of an item opening a new tab, or a ListView item's chevron while it has
  // child items — the box the Canvas draws (`ruleShapes`).
  const trailingIcon = catalogItemTrailingIcon(type, node.props);
  if (trailingIcon) {
    const ownRight = catalogLinkOutOwnRight(node);
    style = {
      ...style,
      position: style.position ?? "relative",
      ...(catalogLinkOutCardEndInset(type) === undefined
        ? {
            paddingRight: catalogLinkOutPaddingRight(
              type,
              node.props.size,
              ownRight,
            ),
          }
        : {}),
    };
  }
  const content = [
    ...(ownChildren.length > 0
      ? ownChildren
      : textChildren === undefined
        ? []
        : // (ADR-299 — a Link's range-formatted text: a span per run.)
          (catalogTextRunsContent(
            node.textRuns,
            node.visual.textDecoration,
          ) ?? [String(textChildren)])),
    ...(trailingIcon
      ? [catalogLinkOutGlyphElement(node, type, trailingIcon)]
      : []),
  ];
  if (lower === "sheet" && node.derivedProps?._sheetHandle === true)
    content.unshift(
      createElement("div", {
        key: "sheet-handle",
        className: "sheet-handle",
        "aria-hidden": true,
      }),
    );
  // ADR-295 후속: a draggable Table's header row · Row — S2's drag column first.
  if (
    (lower === "tableheader" || lower === "row") &&
    node.derivedProps?._allowsDragging === true
  )
    content.unshift(catalogTableDragPart(lower));
  const collection = collectionAncestor(root, node);
  // A collection-only item outside its collection is not a RAC item (Preview catalog path).
  const outsideCollection =
    binding?.source.kind === "internal" &&
    COLLECTION_ONLY_RENDERERS[binding.source.renderer] !== undefined &&
    COLLECTION_ONLY_RENDERERS[binding.source.renderer] !== collection;
  // MenuItem has no standalone primitive binding: inside a Menu it is a RAC collection item.
  const Component: ElementType | undefined =
    lower === "menuitem"
      ? (RAC.MenuItem as ElementType)
      : !binding
        ? undefined
        : type === "Header" && collection === "gridlist"
          ? (RAC.GridListHeader as ElementType)
          : binding.source.kind === "rac"
            ? (RAC as unknown as Record<string, ElementType | undefined>)[
                binding.source.component
              ]
            : outsideCollection && lower === "tab"
              ? undefined
              : INTERNAL_RENDERERS[binding.source.renderer];
  if (!Component) {
    // No registered component: the generated class CSS still owns the box (Preview fallback).
    const dataAttrs: Record<string, string> = {};
    for (const key of ["size", "variant", "orientation"] as const)
      if (typeof node.props[key] === "string")
        dataAttrs[`data-${key}`] = String(node.props[key]);
    // (S2 InlineAlert `fillStyle` — the generated `[data-fill-style]` blocks.)
    if (typeof node.props.fillStyle === "string")
      dataAttrs["data-fill-style"] = String(node.props.fillStyle);
    // S2 `Image` (2026-11-18 — every Image, not only a Card preview's): a box around its `img`. Outside
    // an S2 Card's preview the box carries the placeholder — the Image rule's rest paint, S2 wrapper
    // `gray-100`, the Canvas box's; the rule has no generated sheet, so it goes inline under an
    // authored fill (ADR-297 후속 ⑤). S2's wrapper clips (`overflow: hidden`).
    const imageRule =
      type === "Image" && !imageInS2CardPreview(root, node) && node.ruleId
        ? root.runtime.graph.library.rules.get(node.ruleId)
        : undefined;
    const imagePlaceholder = paintAt(
      imageRule?.variants[imageRule.defaultVariant ?? "default"]?.paint
        .backgroundColor,
    );
    const imageBox: CSSProperties | undefined =
      type === "Image"
        ? {
            overflow: "hidden",
            ...(imagePlaceholder?.startsWith("{")
              ? {
                  backgroundColor: tokenToCSSVar(imagePlaceholder as TokenRef),
                }
              : {}),
          }
        : undefined;
    // S2 InlineAlert's variant icon — first, as S2 renders it (`catalogInlineAlertIcon`; the
    // Canvas draws the same box, `ruleShapes`).
    const alertIcon =
      type === "InlineAlert" ? catalogInlineAlertIcon(node.props) : undefined;
    const alertPadding = alertIcon ? catalogBoxModel(node).padding : undefined;
    return createElement(
      (type === "Image" ? CatalogImageBox : "div") as ElementType,
      {
        key: node.id,
        "data-catalog-id": node.id,
        slot: catalogDomSlot(node),
        className: `react-aria-${isBodyType(type) ? "Body" : type}`,
        ...(type === "Image"
          ? { imgProps: imageElementProps(node.props) }
          : {}),
        ...dataAttrs,
        // The type's fixed ARIA (InlineAlert `role="alert"` — a plain box carries the D1 role).
        ...binding?.staticAttrs,
        style: alertIcon
          ? { ...style, position: style.position ?? "relative" }
          : imageBox
            ? { ...imageBox, ...style }
            : style,
      },
      ...(alertIcon
        ? [
            createElement(InlineAlertIcon, {
              key: "inline-alert-icon",
              variant: alertIcon.variant,
              iconName: alertIcon.iconName,
              size: alertIcon.size,
              color: alertIcon.color.startsWith("{")
                ? tokenToCSSVar(alertIcon.color as TokenRef)
                : alertIcon.color,
              top: cssLength(alertPadding?.top ?? 0) ?? 0,
              end: cssLength(alertPadding?.right ?? 0) ?? 0,
            }),
          ]
        : []),
      // The Image is S2's: a box around its `img` (`@react-spectrum/s2` 1.8.2 `Image.tsx`) — the `img`
      // fills the box (S2 `imgStyles`, cover); its nodes are what it shows without a picture (S2
      // `renderError` — `CatalogImageBox` by load state). The box keeps the placeholder fill.
      ...content,
    );
  }
  if (MARKER_WRAPPED_RULE_TYPES.has(type))
    // The component takes no DOM rest props: the marker is a `display: contents` wrapper.
    return createElement(
      "div",
      {
        key: node.id,
        "data-catalog-id": node.id,
        style: { display: "contents" },
      },
      createElement(Component, { ...rest, style }, ...content),
    );
  // ADR-257 Phase 2: RAC keeps a cell's column index from when its row was built — a row whose
  // spans change (`colSpan`, a cell taken or left) is built again (RAC throws on a stale index).
  // (A selection cell a highlight Table leaves out moves the others' indices too — Phase 3; so does
  //  the drag cell a draggable Table puts first — ADR-295 후속.)
  const rowSpans = lower === "row" ? catalogRowSpans(root, node) : undefined;
  // ADR-257 Phase 5: RAC's resizable container keeps the column widths it started with (a Column's
  // document width is RAC's `defaultWidth` there) — a document change of a width builds the Table
  // again (the widths a drag left are runtime state: they give way to the document's edit).
  // (ADR-315 Phase 4 — so does a state width set from outside the drag: a rule's, the browser's
  //  memory — `_widthsRevision`, the session's echo. A drag's own widths are RAC's already.)
  const widthKey =
    resizable && lower === "table"
      ? `${tableColumnWidthKey(root, node)}|${String(
          context.runtime?.overrideOf(node.id)?._widthsRevision ?? 0,
        )}`
      : undefined;
  // A collection item's RAC id is its key (`resolveStaticItemKey`); RAC refuses an item whose id
  // changes in place ("Cannot change the id of an item" — an open Preview while the author sets a
  // Tab's id, G5 example 8): the key remounts the item instead. (A Table's Row too — ADR-310 Phase 4:
  // its first data row is its template's element, whose id turns into the row's key when the rows come.)
  const itemKey =
    STATIC_ITEM_TYPES.has(type) || lower === "menuitem" || lower === "row"
      ? resolveStaticItemKey(node.props as Record<string, unknown>, node.id)
      : undefined;
  // ADR-258 Decision 7 — RAC's Color state keeps its first `defaultValue`: a document edit of the
  //   value (or its undo) starts the Preview again from the new one (the Slider's `key` rule). The
  //   key part keeps the value's own space and exact channels (`catalogColorKey`) — no other prop.
  // A Table's rows set Selected start RAC's selection (2026-10-13 — its `defaultSelectedKeys`, which
  // RAC keeps from the first render: a changed set builds the Table again).
  // ADR-280 — a running Preview controls it from the record's runtime value (`catalogRuntimeStateOf`
  // — the dispatcher reads the same); no key part then.
  const tableSelected =
    lower !== "table"
      ? undefined
      : context.runtime?.setRuntimeProps
        ? (catalogRuntimeStateOf(
            root,
            root.domInputs.get(node.id) ?? node,
            context.runtime.overrideOf(node.id),
            "selectedKeys",
          ) as string[])
        : catalogCollectionSelectedKeys(root, node);
  const ownKey =
    itemKey !== undefined && itemKey !== node.id
      ? `${node.id}#${itemKey}`
      : colorType && !context.runtime?.setRuntimeProps
        ? `${node.id}:${catalogColorKey(colorType, node.props.defaultValue)}`
        : tableSelected?.length && !context.runtime?.setRuntimeProps
          ? `${node.id}|selected:${tableSelected.join(",")}`
          : node.id;
  // (ADR-295 후속: a resizable Table's selection Column without a width of its own is S2's
  //  fixed device-width column — `CatalogTableSelectionColumn`.)
  const selectionColumn =
    lower === "column" &&
    resizable &&
    node.props.width === undefined &&
    node.props.defaultWidth === undefined &&
    catalogTableSelectionColumn(node, domGet, domType);
  const tableActionBarCount =
    tableActionBarElement && tableSelected !== undefined
      ? catalogSelectionCountOf(tableSelected as CatalogGroupKeys)
      : 0;
  const element = createElement(
    lower === "link"
      ? // (In a Nav it is current at the Nav's route — `navRoute.components.tsx`.)
        CatalogNavLink
      : selectionColumn
        ? CatalogTableSelectionColumn
        : tableActionBarElement
          ? CatalogActionBarHost
          : Component,
    {
      ...(tableActionBarElement
        ? {
            host: Component,
            actionBar: tableActionBarElement,
            actionBarSpace:
              tableActionBarCount === 0
                ? undefined
                : catalogActionBarSpace("Table", node.props),
          }
        : {}),
      key:
        widthKey !== undefined
          ? `${ownKey}|${widthKey}`
          : rowSpans === undefined
            ? ownKey
            : `${ownKey}|${rowSpans}`,
      "data-catalog-id": node.id,
      ...binding?.staticAttrs,
      ...rest,
      ...(lower === "menuitem"
        ? {
            id: resolveStaticItemKey(
              node.props as Record<string, unknown>,
              node.id,
            ),
            textValue: itemLabelText(root, node),
            // (Only a disabled item says so — an explicit `false` beats its Menu's `disabledKeys`
            //  in RAC, 2026-11-18.)
            ...(node.props.isDisabled === true ? { isDisabled: true } : {}),
            // S2 체크리스트 §9.3: an unavailable item is described by its info glyph (S2
            //  `aria-describedby={infoIconId}`).
            ...(catalogMenuItemUnavailable(node, domGet, domType) &&
            catalogUnavailableGlyphOf(node, domGet)
              ? { "aria-describedby": catalogUnavailableGlyphDomId(node.id) }
              : {}),
            // ADR-295 Phase 3c-3c ③: its Menu's size (the resolver carries it) — the sheet's
            // `[data-size]` blocks (S2 control height · padding · label font).
            "data-size": String(node.props.size ?? "M"),
            // ADR-259 Phase 1: the MenuItem's link (RAC draws an `<a>`).
            ...catalogItemLinkProps(node.props),
            // The author's selection mark (a node shown while `isSelected` — the reference's
            // Check / Dot) stands in for the sheet's glyph (`Menu.css`).
            ...(hasSelectionMark(root, node)
              ? { "data-selection-mark": "" }
              : {}),
          }
        : {}),
      // ADR-256 Phase 5i: a RAC Table names each row by its row header columns' cells — RAC throws
      // without one, so a header with none set makes its first column the row header.
      // ADR-315 Phase 4: a pinned column's Column · Cells say so (`Table.css` keeps them in view).
      ...(lower === "column" || lower === "cell"
        ? catalogTablePinnedProps(node)
        : {}),
      ...(lower === "cell"
        ? catalogTableRowPinProps(node, domGet, domType, context)
        : {}),
      // (S2 체크리스트 §9.3 — S2 `EditableCell`: a Cell holding its editing Form.)
      ...(lower === "cell"
        ? catalogEditableCellProps(node, domGet, domType, context)
        : {}),
      // ADR-315 Phase 6 — a Cell of a Table 「Cell selection」 names its Column (its range's point).
      ...(lower === "cell" &&
      typeof node.props[CATALOG_CELL_COLUMN_PROP] === "string"
        ? { "data-column-key": node.props[CATALOG_CELL_COLUMN_PROP] }
        : {}),
      ...(lower === "column"
        ? {
            isRowHeader: columnIsRowHeader(root, node),
            // ADR-257 Phase 4: the key RAC's sort names (`catalogTableColumnKey` — an author's HTML
            // id takes its place, `withHtmlId`).
            id: node.id,
          }
        : {}),
      // ADR-257 Phase 4: RAC sorts through the Table (`onSortChange`) — the Preview's runtime
      // state (사용자 결정 4); a Column's resizing needs the Table in RAC's container.
      ...(lower === "table"
        ? {
            // (ADR-315 Phase 4 증분 6 — no sort of its own: the sort its rows are in as authored.)
            sortDescriptor:
              catalogTableSortOf(node.props.sortDescriptor) ??
              catalogTableAuthoredSortShown(node, domGet, domType)?.[0],
            // (ADR-284 Decision 5: a Table its view's variable sorts — the header press is the
            // rule's, which writes the variable; no runtime sort of its own.)
            ...(context.runtime?.setRuntimeProps && !node.props._sortByVariable
              ? context.runtime.pressTableSort
                ? {
                    // (ADR-315 Phase 2 — `CatalogTable` adds whether Shift was held: RAC's
                    //  `onSortChange` names the Column only.)
                    onSortPress: (column: string, add: boolean) =>
                      context.runtime!.pressTableSort!(node.id, column, add),
                  }
                : {
                    onSortChange: (sortDescriptor: unknown) =>
                      context.runtime!.setRuntimeProps!(node.id, {
                        sortDescriptor: catalogTableSortOf(sortDescriptor),
                      }),
                  }
              : {}),
            // (ADR-315 Phase 5 — a grouped Table: its rows expand from the outer grouped Column,
            //  RAC `treeColumn`; the open group rows are the session's — controlled.)
            ...(() => {
              const expanded = catalogTableExpandedKeys(node.props);
              const tree = expanded
                ? catalogTableTreeColumn(node, domGet, domType)
                : undefined;
              return expanded && tree
                ? {
                    treeColumn: tree,
                    expandedKeys: expanded,
                    ...(context.runtime?.expandTableRows
                      ? {
                          onExpandedChange: (keys: Iterable<unknown>) =>
                            context.runtime!.expandTableRows!(
                              node.id,
                              [...keys].map(String),
                            ),
                        }
                      : {}),
                  }
                : {};
            })(),
            tableResizable: resizable,
            // (ADR-315 Phase 7 — the Table's pinned columns · pinned rows · row pinning: the sheet's
            //  rules for them are scoped to these, so a Table without them pays none of their
            //  `:has()` style work — `Table.css`.)
            ...(node.props[CATALOG_TABLE_PINNED_COLUMNS_PROP] === true
              ? { "data-pinned-columns": "" }
              : {}),
            ...(node.props[CATALOG_TABLE_PINNED_ROWS_PROP]
              ? { "data-pinned-rows": "" }
              : {}),
            ...(node.props[CATALOG_ROW_PINNABLE_PROP] === true
              ? { "data-row-pinning": "" }
              : {}),
            // (ADR-315 Phase 6 — 「Cell selection」, never with row selection: 사용자 결정 5.)
            ...(node.props.allowsCellSelection === true &&
            node.props.selectionMode !== "single" &&
            node.props.selectionMode !== "multiple" &&
            context.runtime?.tableCellText
              ? {
                  cellSelection: {
                    order: () =>
                      catalogTableCellOrder(node.id, domGet, domType),
                    text: (
                      rows: readonly string[],
                      columns: readonly string[],
                    ) =>
                      context.runtime!.tableCellText!(node.id, rows, columns),
                  },
                }
              : {}),
            ...(resizable && context.runtime?.resizeTableColumns
              ? {
                  onColumnsResized: (widths: Record<string, number>) =>
                    context.runtime!.resizeTableColumns!(node.id, widths),
                }
              : {}),
            ...catalogControlledProps(
              node.id,
              context.runtime?.setRuntimeProps
                ? (id, patch) => context.runtime!.setRuntimeProps!(id, patch)
                : undefined,
              SELECTED_KEYS,
              tableSelected,
              catalogSelectionValue,
            ),
          }
        : {}),
      // (A Row's RAC key — its Table's selection names it.)
      ...(lower === "row"
        ? {
            id: resolveStaticItemKey(
              node.props as Record<string, unknown>,
              node.id,
            ),
            // (ADR-315 Phase 5 증분 5f — a pinned row stays in view: `Table.css`.)
            ...(node.props[CATALOG_PINNED_ROW_PROP] === "top" ||
            node.props[CATALOG_PINNED_ROW_PROP] === "bottom"
              ? { "data-pinned-row": node.props[CATALOG_PINNED_ROW_PROP] }
              : {}),
          }
        : {}),
      ...(STATIC_ITEM_TYPES.has(type)
        ? {
            id: resolveStaticItemKey(
              node.props as Record<string, unknown>,
              node.id,
            ),
          }
        : {}),
      ...(lower === "tab" &&
      node.props.labelBehavior === "hide" &&
      !node.ariaLabel
        ? { "aria-label": itemTextChildren(root, node) }
        : {}),
      // A ListBoxItem's text is its label part's (RAC reads `textValue` for a picker's input
      // value and filter, type-ahead and the hidden native select — its children are elements).
      ...(lower === "listboxitem" && itemLabelText(root, node)
        ? { textValue: itemLabelText(root, node) }
        : {}),
      // ADR-256 Phase 6f: a picker item's author mark (the reference DropdownItem's Check) stands in
      // for the sheet's glyph (`ListBox.css`), as a MenuItem's does.
      ...(lower === "listboxitem" &&
      (node.derivedProps?._pickerOption === true ||
        hasSelectionMark(root, node))
        ? { "data-selection-mark": "" }
        : {}),
      // A Tag's · GridListItem's text is its label Text's (the reference's plain children ·
      // `textValue={image.title}` — the row's name).
      ...(lower === "tag" || lower === "gridlistitem"
        ? { textValue: itemTextChildren(root, node) }
        : {}),
      ...(usesButtonBaseUtility(type)
        ? { className: `react-aria-${type} button-base` }
        : {}),
      style,
    },
    // ADR-256 Decision 7: an item whose parts are conditioned on its state (a Tag's remove button
    // — `allowsRemoving`) passes its RAC render props down as their frame.
    ...(STATE_FRAME_ITEMS.has(lower)
      ? [
          // (RAC takes a render function as an item's children.)
          catalogStateChildren(
            node.id,
            () => content,
            // (S2 체크리스트 §9.3: an unavailable item shows its info glyph, not the chevron RAC's
            //  SubmenuTrigger would give it — S2 `UnavailableIconWrapper`.)
            lower === "menuitem" &&
              catalogMenuItemUnavailable(node, domGet, domType)
              ? { isUnavailable: true, hasSubmenu: false }
              : undefined,
          ) as unknown as ReactNode,
        ]
      : columnOperations
        ? [
            // (RAC's Column passes its sort direction to a render function.)
            catalogColumnChildren(
              content,
              columnOperations,
            ) as unknown as ReactNode,
          ]
        : content),
  );
  if (lower === "link")
    return createElement(RacSlotScope, {
      key: node.id,
      context: "Link",
      authored: node.props.slot,
      render: (resolution) =>
        cloneElement(
          element,
          { slot: undefined, ...racSlotProps(resolution) },
          // ADR-314 Phase 3 — S2 Link `useSkeletonText`: in a loading Skeleton the words sit in
          //   the look's inline span.
          ...(node.derivedProps?.isSkeleton === true
            ? [
                catalogSkeletonText(
                  (element.props as { children?: ReactNode }).children,
                ),
              ]
            : []),
        ),
    });
  // Preview `hostOrphanRadio` / `hostOrphanCollectionItem`: RAC items need their host.
  if (lower === "radio" && collection !== "radiogroup")
    return createElement(
      RAC.RadioGroup,
      {
        key: `host:${node.id}`,
        "aria-label": "Radio sample",
        value:
          node.props.isSelected === true
            ? String(node.props.value ?? "")
            : null,
        style: { display: "contents" },
      },
      element,
    );
  const host = ORPHAN_ITEM_HOST[lower];
  if (!host || collection === host.toLowerCase()) return element;
  const Host = (RAC as unknown as Record<string, ElementType | undefined>)[
    host
  ];
  if (!Host) return element;
  return createElement(
    Host,
    {
      key: `host:${node.id}`,
      "aria-label": `${type} sample`,
      style: { display: "contents" },
    },
    // A RAC Tag is a TagList item; the Preview host (TagGroup alone) cannot render one.
    lower === "tag"
      ? createElement(RAC.TagList, { style: { display: "contents" } }, element)
      : element,
  );
}

/** A link-out item's own right padding (its box model — the Rust input reads the same). */
function catalogLinkOutOwnRight(node: CatalogConsumerNode): number {
  const right = catalogBoxModel(node).padding?.right;
  return typeof right === "number"
    ? right
    : Number.parseFloat(String(right ?? 0)) || 0;
}

/**
 * ADR-259 Phase 1 — S2's link-out glyph (`ui-icons/LinkOut`, here the Lucide `external-link`): a
 * decorative svg in the item's end padding, its own right padding outside it, centred on the box
 * (a card's in its bottom padding — `catalogLinkOutCardEndInset`) and in the item's text color
 * (`currentColor`).
 */
/**
 * S2 Card `SelectionIndicator` (2026-11-18): a plain `div` over the card while it is selected — its
 * RAC item's selection in a CardView (RAC `SelectionIndicatorContext`, live in the Preview), else
 * the standalone Card's (`isSelected`). Presses go through to what it covers (S2 `pointerEvents:
 * 'none'`). Not RAC's `SelectionIndicator` — that one needs a `SharedElementTransition`.
 */
function CatalogCardSelectionIndicator({
  id,
  isSelected,
  style,
}: {
  id: string;
  isSelected?: boolean;
  style?: CSSProperties;
}): ReactNode {
  const item = useContext(RAC.SelectionIndicatorContext) as
    { isSelected?: boolean } | null | undefined;
  if (!(isSelected ?? item?.isSelected)) return null;
  return createElement("div", {
    "data-catalog-id": id,
    className: "react-aria-SelectionIndicator",
    "data-variant": "default",
    style: { pointerEvents: "none", ...style },
  });
}

function catalogLinkOutGlyphElement(
  node: CatalogConsumerNode,
  type: string,
  icon: string,
): ReactNode {
  const glyph = catalogLinkOutGlyph(type, node.props.size);
  const data = getIconData(icon);
  const cardEnd = catalogLinkOutCardEndInset(type);
  const bottom = catalogBoxModel(node).padding?.bottom;
  const place =
    cardEnd === undefined
      ? {
          right: catalogLinkOutOwnRight(node),
          top: "50%",
          transform: "translateY(-50%)",
        }
      : {
          // A card: in its bottom padding, its end at the texts' end.
          right: cardEnd,
          bottom:
            typeof bottom === "number"
              ? (bottom - glyph.size) / 2
              : `calc((${bottom ?? "0px"} - ${glyph.size}px) / 2)`,
        };
  return createElement(
    "span",
    {
      key: `${node.id}::link-out`,
      className: "link-out",
      "aria-hidden": "true",
      style: {
        position: "absolute",
        ...place,
        width: glyph.size,
        height: glyph.size,
        display: "flex",
        pointerEvents: "none",
      },
    },
    data &&
      createElement(
        "svg",
        {
          width: glyph.size,
          height: glyph.size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        ...data.paths.map((d, i) => createElement("path", { key: i, d })),
        ...(data.circles ?? []).map((c, i) =>
          createElement("circle", { key: `c${i}`, cx: c.cx, cy: c.cy, r: c.r }),
        ),
      ),
  );
}

/** Collection items that pass their RAC render props to their parts (`catalogStateChildren`). */
const STATE_FRAME_ITEMS: ReadonlySet<string> = new Set([
  "tag",
  "menuitem",
  // ADR-256 Phase 6f: a picker item's mark shown while it is selected.
  "listboxitem",
]);

/** Whether an item holds a node shown while it is selected (a MenuItem's · picker item's Check / Dot). */
function hasSelectionMark(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): boolean {
  return node.children.some((id) => {
    const child = root.domInputs.get(id);
    return (
      !!child &&
      !catalogPickerSelectionHidden(
        child,
        (id) => root.domInputs.get(id),
        root.typeOf,
      ) &&
      (child.props.slot === "selection" ||
        (!!child?.showWhen &&
          catalogStateConditions(child.showWhen).some(
            (condition) => condition.key === "isSelected" && !condition.not,
          )))
    );
  });
}

/** An item's text: its Text children's without a slot name (a Tag's · GridListItem's label). */
function itemTextChildren(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): string {
  // (Through layout frames — a Tag's text sits in its content `div`, S2 `TagWrapper`, 2026-11-18.)
  return node.children
    .map((id) => root.domInputs.get(id))
    .flatMap((child) =>
      child && catalogTypeName(root, child) === "frame"
        ? child.children.map((id) => root.domInputs.get(id))
        : [child],
    )
    .filter(
      (child) =>
        !!child &&
        catalogTypeName(root, child) === "Text" &&
        // (Not a description — `Text slot="description"`.)
        !child.props.slot,
    )
    .map((child) => String(child?.props.children ?? ""))
    .join(" ");
}

/** A collection item's text: its label part's (the `label` slot role child). */
function itemLabelText(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): string {
  return node.children
    .map((id) => root.domInputs.get(id))
    .filter((child) => child?.props.slot === "label")
    .map((child) => String(child?.props.children ?? ""))
    .join("");
}

/** Preview `ORPHAN_ITEM_HOST`: RAC host of each collection item/section type (lower-case). */
const ORPHAN_ITEM_HOST: Readonly<Record<string, string>> = {
  listboxsection: "ListBox",
  gridlistsection: "GridList",
  menusection: "Menu",
  selectbox: "SelectBoxGroup",
  listboxitem: "ListBox",
  gridlistitem: "GridList",
  menuitem: "Menu",
  tag: "TagGroup",
  treeitem: "Tree",
  breadcrumb: "Breadcrumbs",
};

/** Internal item renderers that are RAC items only inside their collection. */
const COLLECTION_ONLY_RENDERERS: Readonly<Record<string, string>> = {
  tab: "tabs",
  tag: "taggroup",
  selectbox: "selectboxgroup",
  listboxitem: "listbox",
  gridlistitem: "gridlist",
  breadcrumb: "breadcrumbs",
};

const COLLECTION_HOSTS: ReadonlySet<string> = new Set([
  ...Object.values(ORPHAN_ITEM_HOST).map((host) => host.toLowerCase()),
  "radiogroup",
  ...Object.values(COLLECTION_ONLY_RENDERERS),
]);

/**
 * Preview `itemSlotAttr`: a collection item child's slot role reaches the DOM as its `slot`
 * attribute only inside a ListBox/Menu/GridList/TagGroup (the stylesheets' `[slot=…]` rules).
 */
const ITEM_SLOT_COLLECTIONS: ReadonlySet<string> = componentTypeSet(
  "itemSlotCollection",
  { lowercase: true },
);

const ITEM_SLOT_ROLES: ReadonlySet<string> = new Set([
  "icon",
  "avatar",
  "label",
  "description",
]);

function itemSlotRole(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): string | undefined {
  const role = node.props.slot;
  if (typeof role !== "string" || !ITEM_SLOT_ROLES.has(role)) return undefined;
  const collection =
    collectionAncestor(root, node) ?? orphanItemHost(root, node);
  return collection && ITEM_SLOT_COLLECTIONS.has(collection) ? role : undefined;
}

/**
 * The RAC host (lower-case) a standalone collection item above `node` renders in
 * (`ORPHAN_ITEM_HOST`): its children are items' children like inside the collection (4e-11).
 */
function orphanItemHost(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): string | undefined {
  for (
    let cursor = root.domInputs.get(node.parentId);
    cursor;
    cursor = root.domInputs.get(cursor.parentId)
  ) {
    const host = ORPHAN_ITEM_HOST[catalogTypeName(root, cursor).toLowerCase()];
    if (host) return host.toLowerCase();
  }
  return undefined;
}

const STATIC_ITEM_TYPES: ReadonlySet<string> = componentTypeSet(
  "staticCollectionItem",
);

/** Nearest collection host type above `node` (lower-case), as the Preview passes it down. */
function collectionAncestor(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): string | undefined {
  for (
    let parent = root.domInputs.get(node.parentId);
    parent;
    parent = root.domInputs.get(parent.parentId)
  ) {
    const type = catalogTypeName(root, parent).toLowerCase();
    if (COLLECTION_HOSTS.has(type)) return type;
  }
  return undefined;
}

function bindingOf(node: CatalogConsumerNode): DomBinding | undefined {
  const bindingId =
    node.bindingId ??
    (node.definitionMode === "composite" ? "composite" : undefined);
  const binding = bindingId ? bindings[bindingId] : undefined;
  if (!binding && !node.ruleId && !CATALOG_DELEGATED_DOM[bindingId ?? ""])
    throw new Error(`CATALOG_DOM_BINDING_REQUIRED:${node.definitionId}`);
  return binding;
}

/**
 * Write order of authored keys whose CSS overlaps: the whole box, then an axis, then a side — the
 * box model's precedence (`paddingTop` > `paddingY` > `padding`), not the document's key order.
 */
const AUTHORED_PRECEDENCE: Readonly<Record<string, number>> = {
  gap: 0,
  padding: 0,
  paddingX: 1,
  paddingY: 1,
};

const authoredRank = ([key]: [string, unknown]) =>
  AUTHORED_PRECEDENCE[key] ?? 2;

/** Authored visual writes of a node as inline CSS (library visuals are class CSS). */
function authoredStyle(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): CSSProperties {
  const style: CSSProperties = {};
  // A rule without `structure` has no generated sheet: its catalog values reach the DOM only
  // inline (the whole resolved box and layout, not just the authored layer).
  const rule = node.ruleId
    ? root.runtime.graph.library.rules.get(node.ruleId)
    : undefined;
  const noSheet = !!rule && !rule.structure;
  const carriesText = CATALOG_TEXT_STYLE_CONTAINERS.has(
    catalogTypeName(root, node),
  );
  const localeLineHeight = Number(node.visual.lineHeight);
  if (
    rule?.localeTypography &&
    Number.isFinite(localeLineHeight) &&
    localeLineHeight > 0
  )
    style.lineHeight = localeLineHeight;
  for (const [key, value] of Object.entries(
    noSheet ? node.visual : catalogAuthoredVisual(root, node),
  ).sort((a, b) => authoredRank(a) - authoredRank(b))) {
    if (key === "aspectRatio") continue; // written below from the resolved ratio
    // (ADR-299 — a range-formatted text's own decoration is on its run spans; an authored `none`
    //  stays on the element — it turns off a rule's line (a Link's) that no span could remove.)
    if (
      key === "textDecoration" &&
      node.textRuns &&
      !/^none\b/.test(String(value))
    )
      continue;
    const textCss =
      TYPOGRAPHY_KEYS.has(key) &&
      carriesText &&
      CATALOG_INHERITED_TEXT_KEYS.some((inherited) => inherited === key)
        ? (value: unknown) =>
            ({
              [key]:
                key === "fontFamily"
                  ? catalogCssFontFamily(String(value))
                  : value,
            }) as CSSProperties
        : undefined;
    const css =
      AUTHORED_CSS[key] ??
      textCss ??
      (node.bindingId === "input" && key === "whiteSpace"
        ? RULE_TEXT_BOX_CSS.whiteSpace
        : undefined) ??
      (RULE_TEXT_BOX_BINDINGS.has(node.bindingId ?? "")
        ? RULE_TEXT_BOX_CSS[key]
        : undefined);
    if (!css) {
      // Typography on a rule executor is not painted by the Canvas yet: fail on both sides.
      if (noSheet && !TYPOGRAPHY_KEYS.has(key)) continue; // paint-only catalog value
      throw new Error(`CATALOG_DOM_VISUAL_UNSUPPORTED:${node.id}:${key}`);
    }
    Object.assign(style, css(value));
  }
  // A side width with no box width (a Cell's divider · a pinned column's edge — ADR-315 Phase 4):
  // the other sides draw nothing, as on the Canvas. Under the inline `border-style` CSS would
  // draw them at `medium` (live 2026-11-20: a pinned cell stood in a 3px frame).
  if (
    style.borderStyle !== undefined &&
    !(Number(node.visual.borderWidth) > 0) &&
    CATALOG_SIDE_WIDTH_KEYS.some((side) => style[side] !== undefined)
  )
    for (const side of CATALOG_SIDE_WIDTH_KEYS)
      if (style[side] === undefined) style[side] = 0;
  // ADR-295 Phase 2: a token font size over the rule sheet (a part rule's) — its device variable.
  if (node.bindingId !== "icon") catalogDeviceTypographyCss(style, node.visual);
  catalogDeviceControlCss(style, node.visual);
  // ADR-298 D5: a value read from a theme token goes inline as the token's variable.
  catalogNodeTokenCss(style, node.visual);
  for (const key of ["width", "height", "minWidth", "minHeight"] as const) {
    const value = node.sizing[key];
    if (typeof value === "number") style[key] = value;
  }
  // Template/instance-authored layout (origin style) inline over the class CSS.
  // (2026-11-14: an ActionButton's count badge — its place, the Canvas engine's same input
  //   (`catalogActionBadgeNodeLayout`); an authored place wins.)
  if (!catalogIsAuthoredPlaced(node))
    Object.assign(
      style,
      catalogLayoutCss(catalogActionBadgeNodeLayout(node.derivedProps)),
    );
  Object.assign(
    style,
    catalogLayoutCss(noSheet ? node.layout : catalogAuthoredLayout(root, node)),
  );
  catalogDeviceLayoutCss(style, node.layout);
  if (node.fillLayout) Object.assign(style, catalogLayoutCss(node.fillLayout));
  const ratio = catalogAspectRatio(node.visual.aspectRatio);
  if (ratio !== undefined) style.aspectRatio = String(node.visual.aspectRatio);
  // Authored fill layers over the class CSS background.
  if (node.fills?.length)
    Object.assign(
      style,
      catalogAuthoredDomStyle({ visual: {}, fills: node.fills }),
    );
  // ADR-297 후속 ⑥: an authored background is the box's background — the rule's gradient (class
  //   `background-image`, S2 premium · genai Button) does not paint over it. The Canvas drops it the same
  //   way (`resolveCatalogPaint` · `catalogRulePaint`).
  if (
    style.backgroundImage === undefined &&
    (style.backgroundColor !== undefined || style.background !== undefined) &&
    ruleHasPaintImage(rule?.variants)
  )
    style.backgroundImage = "none";
  // ADR-303: a container gives its children its layer — they read `var(--container-bg, var(--bg))`
  //   (`{color.container}`); the value is the layer token's own variable (no hand-written name).
  catalogContainerCss(style as Record<string, unknown>, node);
  // An authored absolute box's position · insets came with its authored layout (ADR-275).
  if (!catalogIsAuthoredPlaced(node)) containingBlock(root, node, style);
  if (node.derivedProps?._fieldLabelRole) {
    for (const key of [
      "fontSize",
      "fontWeight",
      "lineHeight",
      "color",
    ] as const) {
      const value = node.derivedProps[key];
      if (value !== undefined)
        Object.assign(style, {
          [key]: key === "color" ? cssColor(String(value)) : value,
        });
    }
    if (node.derivedProps._fieldPartWidth !== undefined)
      style.width = Number(node.derivedProps._fieldPartWidth);
    if (node.derivedProps._fieldPartHeight !== undefined)
      style.height = Number(node.derivedProps._fieldPartHeight);
  }
  return style;
}

const STRUCTURAL_TYPES = containerTypeSet("structural", { lowercase: true });

/**
 * A structural container holding an absolutely placed child is its containing block, as the layout
 * engine places it (from the parent) — otherwise the DOM measures it from the nearest positioned
 * ancestor (the page body) and the Preview drifts from the Canvas (2026-10-15).
 */
function containingBlock(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  style: CSSProperties,
): void {
  if (
    !style.position &&
    STRUCTURAL_TYPES.has(catalogTypeName(root, node).toLowerCase()) &&
    node.children.some((id) => {
      const child = root.domInputs.get(id);
      return !!child && catalogIsAuthoredAbsolute(child);
    })
  )
    style.position = "relative";
}

export interface CatalogDomNodeProps {
  root: CatalogCompositionRoot;
  id: string;
  context: CatalogDomContext;
  /**
   * A windowed Table's row (`CatalogWindowRows`): its RAC key, and the cells a row without a
   * record draws. The node draws the row's record when it has one (`id`), else the empty row — in
   * the same element, so RAC's collection keeps the row as the window moves.
   */
  windowRow?: string;
  rowShape?: CatalogRowShape;
  /**
   * ADR-315 Phase 5 — a grouped windowed Table's row: the rows inside it (its group's rows, or a
   * closed group's empty child row — `CatalogWindowRowNest`), after its cells. Absent = a flat
   * Table's row (its element as it was).
   */
  nestedRows?: readonly ReactElement[];
}
/** A windowed Table's rows' cells: how many, and their spans (`catalogRowSpans` — the Row's key). */
export interface CatalogRowShape {
  readonly cells: number;
  readonly spans: string;
}

/** Each bound key's owner record id (`catalogValueOwner` — the Canvas's). */
export function catalogDomValueOwners(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  template: CatalogValueTemplate,
): Record<string, string | undefined> {
  const owners: Record<string, string | undefined> = {};
  for (const text of Object.values({ ...template.props, ...template.visual }))
    for (const key of catalogValueKeysIn(text))
      owners[key] = catalogValueOwner(
        node,
        key,
        (id) => root.domInputs.get(id),
        (entry) => catalogTypeName(root, entry),
      )?.id;
  return owners;
}

/** A conditioned node's conditions against the DOM records (`catalogStateOwner` — the Canvas's). */
export function catalogDomStateConditions(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): CatalogDomStateCondition[] {
  const get = (id: string) => root.domInputs.get(id);
  const typeOf = (record: CatalogConsumerNode) => catalogTypeName(root, record);
  return catalogStateConditions(node.showWhen!).map((condition) => {
    const owner = catalogStateOwner(
      node,
      condition.key,
      condition.from,
      get,
      typeOf,
    );
    return {
      ownerId: owner?.id,
      key: condition.key,
      not: condition.not,
      recordValue: owner
        ? catalogStateValue(owner, condition.key, get, typeOf)
        : false,
    };
  });
}

export const NO_CHILDREN: readonly string[] = [];

/**
 * A component that renders from its children's values (an Accordion's expansion) renders
 * again when a child's record or runtime props change.
 */
export function useWatchedChildren(
  root: CatalogCompositionRoot,
  runtime: CatalogDomRuntime | undefined,
  ids: readonly string[],
): void {
  const key = ids.join("\n");
  const version = useRef(0);
  const subscribe = useCallback(
    (notify: () => void) => {
      const changed = () => {
        version.current += 1;
        notify();
      };
      const offs = (key ? key.split("\n") : []).flatMap((childId) => [
        root.subscribeDom(childId, changed),
        ...(runtime ? [runtime.subscribe(childId, changed)] : []),
      ]);
      return () => offs.forEach((off) => off());
    },
    [root, runtime, key],
  );
  const read = useCallback(() => version.current, []);
  useSyncExternalStore(subscribe, read, read);
}

/**
 * ADR-280 — a runtime color (a rule's `#00FF00`, a drag's value) in the control's own space: a
 * ColorSlider's channel (`hue`) exists only in its space, and RAC throws on the rest.
 */
function catalogColorInSpace(runtime: unknown, fallback: unknown): unknown {
  if (typeof runtime !== "string" || !runtime) return fallback;
  try {
    const space = parseColor(String(fallback)).getColorSpace();
    return parseColor(runtime).toFormat(space).toString();
  } catch {
    return fallback;
  }
}

/** A capability's prop patch over the record (its `style` goes over the computed style). */
export function withOverride(
  node: CatalogConsumerNode,
  override: Readonly<Record<string, unknown>> | undefined,
): { rendered: CatalogConsumerNode; styleOverride?: CSSProperties } {
  if (!override) return { rendered: node };
  const { style, ...props } = override;
  return {
    rendered: Object.keys(props).length
      ? ({
          ...node,
          props: { ...node.props, ...props } as CatalogConsumerNode["props"],
        } as CatalogConsumerNode)
      : node,
    ...(style && typeof style === "object"
      ? { styleOverride: style as CSSProperties }
      : {}),
  };
}

/** The rules' handlers on the node's element, after any handler the binding set itself. */
export function withRuntime(
  element: ReactElement | null,
  handlers: Readonly<Record<string, (...args: unknown[]) => void>> | undefined,
): ReactElement | null {
  if (!element || !handlers || !Object.keys(handlers).length) return element;
  const own = element.props as Record<string, unknown>;
  const patch: Record<string, (...args: unknown[]) => void> = {};
  for (const [name, handler] of Object.entries(handlers)) {
    const existing = own[name];
    patch[name] =
      typeof existing === "function"
        ? (...args: unknown[]) => {
            (existing as (...a: unknown[]) => void)(...args);
            handler(...args);
          }
        : handler;
  }
  return cloneElement(element, patch);
}

/** A Table's Columns' document widths (their ids and S2 width props). */
function tableColumnIds(
  root: CatalogCompositionRoot,
  table: CatalogConsumerNode,
): string[] {
  return table.children.flatMap((childId) => {
    const child = root.domInputs.get(childId);
    return child && catalogTypeName(root, child) === "TableHeader"
      ? [childId, ...child.children]
      : [];
  });
}

function tableColumnWidthKey(
  root: CatalogCompositionRoot,
  table: CatalogConsumerNode,
): string {
  return tableColumnIds(root, table)
    .map((id) => {
      const column = root.domInputs.get(id);
      if (!column || catalogTypeName(root, column) !== "Column") return "";
      const { width, defaultWidth, minWidth, maxWidth } = column.props;
      return `${id}:${String(width)}:${String(defaultWidth)}:${String(minWidth)}:${String(maxWidth)}`;
    })
    .join(";");
}

/**
 * A Row's cells as RAC keeps them (ADR-257 Phase 2): each cell's span, a selection cell left out
 * as `-`, the drag cell first — a row whose spans change is built again (the Row's key).
 */
export function catalogRowSpans(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): string {
  return (
    (node.derivedProps?._allowsDragging === true ? "drag," : "") +
    node.children
      .map((childId) => {
        const child = root.domInputs.get(childId);
        if (!child) return 1;
        return catalogTableSelectionPartHidden(
          child,
          (recordId) => root.domInputs.get(recordId),
          (entry) => catalogTypeName(root, entry),
        )
          ? "-"
          : catalogCellSpan(child);
      })
      .join(",")
  );
}

/** No record: a windowed row outside its Table's record window (`CatalogDomNodeProps.id`). */
const CATALOG_ROW_PENDING_ID = "catalog:row-pending";
/**
 * A windowed Table's Row element key — the same for the row's record and its empty row, so the
 * RAC Row (its collection node) stays when the window moves over it. A row whose RAC id or spans
 * differ from the empty row's is built again (RAC refuses an id · a cell index changing in place):
 * a record row whose spans are not its Table's row shape keys them too.
 *
 * (ADR-315 Phase 4 — an empty row has no cells, so its key is its row key alone. A change of the
 *  row shape — a column hidden or shown — builds every row again through its chunk's key
 *  (`catalogWindowRowChunkKey`): keyed by the shape, each of 10,000 empty rows was re-keyed in
 *  place, and React placed them one by one — live, sorted, CPU 4x: a column hide 2,104 ms, 1,435
 *  of them `getHostSibling`.)
 */
const windowRowKey = (rowKey: string, spans: string, shapeSpans: string) =>
  spans === shapeSpans
    ? `catalog:row|${rowKey}`
    : `catalog:row|${rowKey}|${spans}`;
/** A row chunk's element key: its name and the Table's row shape (`windowRowKey`). */
export const catalogWindowRowChunkKey = (name: string, shapeSpans: string) =>
  `${name}|${shapeSpans}`;
/** A windowed row's record element under that key (`catalogWindowRowPending` — the same key). */
export function catalogWindowRowElement(
  root: CatalogCompositionRoot,
  record: CatalogConsumerNode,
  element: ReactElement | null,
  shape: CatalogRowShape,
  nested?: readonly ReactElement[],
): ReactElement | null {
  if (!element) return element;
  const key = windowRowKey(
    resolveStaticItemKey(record.props as Record<string, unknown>, record.id),
    catalogRowSpans(root, record),
    shape.spans,
  );
  // (ADR-315 Phase 5 — a grouped Table's row holds its rows after its cells: RAC's nested Row.)
  return nested
    ? cloneElement(
        element,
        { key },
        (element.props as { children?: ReactNode }).children,
        nested,
      )
    : cloneElement(element, { key });
}
/**
 * A windowed Table's row outside its record window (2026-11-19 — `CatalogRowWindowKeys`): RAC's
 * collection holds every row (keys · order — keyboard, selection, the scroll height), so each is a
 * keyed RAC Row without cells. The `Layout` reports the rows coming into view
 * (`CatalogTableLayout`), and the window moves over them before the frame paints — one of these
 * is drawn only as an empty row for the frames a move takes (`CatalogTableLayout.buildRow` gives
 * it a row's height).
 *
 * (2026-11-20: no Cells. An empty Cell per column made the collection of a 6-column Table of
 *  10,000 rows 70,000 nodes — RAC copies its key map on every change (a window move, a sort) and
 *  a sort mounts them all again. RAC counts a row's cells only when it has one.)
 */
export function catalogWindowRowPending(
  rowKey: string,
  shape: CatalogRowShape,
  nested?: readonly ReactElement[],
): ReactElement {
  return createElement(
    RAC.Row as ElementType,
    {
      key: windowRowKey(rowKey, shape.spans, shape.spans),
      id: rowKey,
      "data-row-pending": "",
    },
    nested,
  );
}

/** Rows a chunk: a window move re-renders the chunks it crosses, not every row of the Table. */
const WINDOW_ROW_CHUNK = 64;
const NO_ROW_IDS: readonly string[] = [];
interface WindowRowChunkProps {
  root: CatalogCompositionRoot;
  context: CatalogDomContext;
  keys: readonly string[];
  from: number;
  to: number;
  /** The first row of `[from, to)` with a record, and those rows' record ids. */
  at: number;
  ids: readonly string[];
  shape: CatalogRowShape;
}
const CatalogWindowRowChunk = memo(
  function CatalogWindowRowChunk({
    root,
    context,
    keys,
    from,
    to,
    at,
    ids,
    shape,
  }: WindowRowChunkProps): ReactElement {
    const rows: ReactElement[] = [];
    for (let index = from; index < to; index += 1)
      rows.push(
        createElement(CatalogDomNode, {
          key: keys[index],
          root,
          id: ids[index - at] ?? CATALOG_ROW_PENDING_ID,
          context,
          windowRow: keys[index]!,
          rowShape: shape,
        }),
      );
    return createElement(Fragment, null, rows);
  },
  (before, after) =>
    before.root === after.root &&
    before.context === after.context &&
    before.keys === after.keys &&
    before.from === after.from &&
    before.to === after.to &&
    before.at === after.at &&
    before.shape === after.shape &&
    before.ids.length === after.ids.length &&
    before.ids.every((id, index) => id === after.ids[index]),
);

/**
 * A windowed TableBody's data rows — every row of the data, in RAC's collection: the window's as
 * their records, the rest as empty rows, each under its row key so a row keeps its RAC Row as the
 * window moves over it (2026-11-19: an empty row swapped for its record's element took the row out
 * of RAC's collection and put it back — RAC then renumbers every row after it, 10,000 rows a move).
 * Inside the `Virtualizer` only (`CatalogRowWindowMode`): until its chunk loads the Table draws its
 * window's rows, and a Table its `Layout` refuses draws as it is — every row a record (asked once).
 */
const CatalogWindowRows = memo(function CatalogWindowRows({
  root,
  context,
  keys,
  start,
  ids,
  cells,
  spans,
  owner,
  depths,
  closed,
  base = 0,
  count,
}: {
  root: CatalogCompositionRoot;
  context: CatalogDomContext;
  keys: readonly string[];
  start: number;
  ids: readonly string[];
  cells: number;
  spans: string;
  owner: string;
  depths?: readonly number[];
  closed?: ReadonlySet<string>;
  /** ADR-315 Phase 5 증분 5f — the first of `keys` in the whole run (after its pinned rows). */
  base?: number;
  /** The whole run's rows (`keys` and the pinned rows). */
  count?: number;
}): ReactElement {
  const mode = useContext(CatalogRowWindowMode);
  const runtime = context.runtime;
  useLayoutEffect(() => {
    if (mode === "refused")
      runtime?.showRows?.(
        owner,
        base,
        base + keys.length - 1,
        count ?? keys.length,
      );
  }, [mode, runtime, owner, keys, base, count]);
  const shape = useMemo(() => ({ cells, spans }), [cells, spans]);
  // ADR-315 Phase 5 — a grouped Table's rows nest by depth (`CatalogRowWindowKeys.depths`). In
  // the `Virtualizer` every row is drawn (empty outside the window); before it, the window's rows
  // and the groups they are in.
  if (depths)
    return createElement(CatalogWindowRowNest, {
      root,
      context,
      keys,
      ends: windowRowEnds(depths),
      closed: closed ?? NO_CLOSED_GROUPS,
      from: 0,
      to: keys.length,
      start,
      ids,
      shape,
      all: mode === "virtual",
    });
  const rows: ReactElement[] = [];
  if (mode !== "virtual" || !cells) {
    ids.forEach((id, place) =>
      rows.push(
        createElement(CatalogDomNode, {
          key: keys[start + place],
          root,
          id,
          context,
        }),
      ),
    );
    return createElement(Fragment, null, rows);
  }
  for (const chunk of catalogWindowRowChunks(keys, start, ids))
    rows.push(
      createElement(CatalogWindowRowChunk, {
        ...chunk,
        key: catalogWindowRowChunkKey(chunk.key, spans),
        root,
        context,
        keys,
        shape,
      }),
    );
  return createElement(Fragment, null, rows);
});

/** A key list's chunks by name (`windowRowChunkNames`) — the list is the same through a window move. */
const CHUNK_NAMES = new WeakMap<readonly string[], readonly string[]>();
/**
 * Each chunk's name: its place and a hash of its rows' keys — a chunk whose rows are other rows
 * is another chunk (React mounts it whole), one whose rows are the same is the same chunk.
 *
 * Why (2026-11-20, live — a sort click of 10,000 rows, 186 of its 486 ms in React's
 * `getHostSibling`): under a chunk named by its place alone, a sort put other rows in every chunk
 * — each one an insertion, and React looks for the element after an inserted one by walking the
 * siblings past every other inserted one: the rows squared. A chunk mounted whole is placed once.
 * (Two key lists hashing alike only keep a chunk: its rows are then placed one by one, as before.)
 */
function windowRowChunkNames(keys: readonly string[]): readonly string[] {
  let names = CHUNK_NAMES.get(keys);
  if (!names) {
    const out: string[] = [];
    for (let from = 0; from < keys.length; from += WINDOW_ROW_CHUNK) {
      const to = Math.min(keys.length, from + WINDOW_ROW_CHUNK);
      let hash = 0x811c9dc5;
      for (let index = from; index < to; index += 1) {
        const key = keys[index]!;
        for (let at = 0; at < key.length; at += 1)
          hash = Math.imul(hash ^ key.charCodeAt(at), 0x01000193);
        hash = Math.imul(hash ^ 0x1f, 0x01000193);
      }
      out.push(`${from}:${(hash >>> 0).toString(36)}`);
    }
    CHUNK_NAMES.set(keys, (names = out));
  }
  return names;
}
/**
 * A windowed Table's rows as chunks: `[from, to)` of the key list under the chunk's name, with the
 * record ids of its rows in the window (`at` = the first of them).
 */
export function catalogWindowRowChunks(
  keys: readonly string[],
  start: number,
  ids: readonly string[],
): {
  key: string;
  from: number;
  to: number;
  at: number;
  ids: readonly string[];
}[] {
  const names = windowRowChunkNames(keys);
  const end = start + ids.length;
  return names.map((key, place) => {
    const from = place * WINDOW_ROW_CHUNK;
    const to = Math.min(keys.length, from + WINDOW_ROW_CHUNK);
    const lo = Math.max(from, start);
    const hi = Math.min(to, end);
    return {
      key,
      from,
      to,
      at: lo < hi ? lo : from,
      ids: lo < hi ? ids.slice(lo - start, hi - start) : NO_ROW_IDS,
    };
  });
}

const NO_CLOSED_GROUPS: ReadonlySet<string> = new Set();
/** Each row's subtree end in a depth list (the index after its last nested row) — by the list. */
const WINDOW_ROW_ENDS = new WeakMap<readonly number[], readonly number[]>();
function windowRowEnds(depths: readonly number[]): readonly number[] {
  let ends = WINDOW_ROW_ENDS.get(depths);
  if (!ends) {
    const out = new Array<number>(depths.length);
    const open: number[] = [];
    depths.forEach((depth, index) => {
      while (open.length && depths[open.at(-1)!]! >= depth)
        out[open.pop()!] = index;
      open.push(index);
    });
    for (const index of open) out[index] = depths.length;
    WINDOW_ROW_ENDS.set(depths, (ends = out));
  }
  return ends;
}
interface WindowRowNestProps {
  root: CatalogCompositionRoot;
  context: CatalogDomContext;
  keys: readonly string[];
  /** Each row's subtree end (`windowRowEnds`). */
  ends: readonly number[];
  closed: ReadonlySet<string>;
  /** The rows `[from, to)` — whole subtrees, siblings at one depth. */
  from: number;
  to: number;
  /** The window: its first row and its rows' record ids. */
  start: number;
  ids: readonly string[];
  shape: CatalogRowShape;
  /** Every row (the `Virtualizer`'s) — else the window's rows and their groups only. */
  all: boolean;
}
/**
 * ADR-315 Phase 5 — a grouped windowed Table's sibling rows `[from, to)`, each holding its own
 * rows (RAC's nested Row) — the records' rows and empty rows alike, by key, so a row keeps its
 * RAC Row as the window moves (`CatalogWindowRows`). More siblings than a chunk are cut into
 * chunks (each one this component): a window move re-renders the chunks it crosses — inside an
 * open group of thousands of rows too (Phase 0 시제품 S2 — 「묶음의 자식도 부모 Row 안에서 chunk」).
 */
const CatalogWindowRowNest = memo(
  function CatalogWindowRowNest(props: WindowRowNestProps): ReactElement {
    const { keys, ends, closed, from, to, start, ids, shape, all } = props;
    const end = start + ids.length;
    const siblings: number[] = [];
    for (let index = from; index < to; index = ends[index]!)
      // (Before the `Virtualizer`: only the rows the window reaches.)
      if (all || (index < end && ends[index]! > start)) siblings.push(index);
    const rows: ReactElement[] = [];
    if (siblings.length > WINDOW_ROW_CHUNK) {
      for (let at = 0; at < siblings.length; at += WINDOW_ROW_CHUNK) {
        const first = siblings[at]!;
        const last =
          siblings[Math.min(siblings.length, at + WINDOW_ROW_CHUNK) - 1]!;
        rows.push(
          createElement(CatalogWindowRowNest, {
            ...props,
            key: windowRowNestKey(keys, siblings, at),
            from: first,
            to: ends[last]!,
          }),
        );
      }
      return createElement(Fragment, null, rows);
    }
    for (const index of siblings) {
      const key = keys[index]!;
      const nested: ReactElement[] = [];
      if (ends[index]! > index + 1)
        nested.push(
          createElement(CatalogWindowRowNest, {
            ...props,
            key: "catalog:nested-rows",
            from: index + 1,
            to: ends[index]!,
          }),
        );
      // (A closed group's one empty child row — RAC opens a row that has one.)
      if (closed.has(key))
        nested.push(
          catalogWindowRowPending(
            `${key}${CATALOG_GROUP_PLACEHOLDER_SUFFIX}`,
            shape,
          ),
        );
      rows.push(
        createElement(CatalogDomNode, {
          key,
          root: props.root,
          id:
            index >= start && index < end
              ? ids[index - start]!
              : CATALOG_ROW_PENDING_ID,
          context: props.context,
          windowRow: key,
          rowShape: shape,
          nestedRows: nested,
        }),
      );
    }
    return createElement(Fragment, null, rows);
  },
  (before, after) => {
    if (
      before.root !== after.root ||
      before.context !== after.context ||
      before.keys !== after.keys ||
      before.ends !== after.ends ||
      before.closed !== after.closed ||
      before.from !== after.from ||
      before.to !== after.to ||
      before.shape !== after.shape ||
      before.all !== after.all
    )
      return false;
    // (The same records in `[from, to)`: the window's ids there.)
    const idsIn = (props: WindowRowNestProps) => {
      const lo = Math.max(props.from, props.start);
      const hi = Math.min(props.to, props.start + props.ids.length);
      return lo < hi
        ? { lo, ids: props.ids.slice(lo - props.start, hi - props.start) }
        : { lo: 0, ids: NO_ROW_IDS };
    };
    const a = idsIn(before);
    const b = idsIn(after);
    return (
      a.lo === b.lo &&
      a.ids.length === b.ids.length &&
      a.ids.every((id, index) => id === b.ids[index])
    );
  },
);
/** A nest chunk's name: its first row's key and a hash of its siblings' keys (`windowRowChunkNames`). */
function windowRowNestKey(
  keys: readonly string[],
  siblings: readonly number[],
  at: number,
): string {
  let hash = 0x811c9dc5;
  const to = Math.min(siblings.length, at + WINDOW_ROW_CHUNK);
  for (let place = at; place < to; place += 1) {
    const key = keys[siblings[place]!]!;
    for (let index = 0; index < key.length; index += 1)
      hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193);
    hash = Math.imul(hash ^ 0x1f, 0x01000193);
  }
  return `catalog:nest|${at}:${(hash >>> 0).toString(36)}`;
}

/** The key lists of a window's rows between its pinned rows (a run's key lists are cached by list). */
const BETWEEN_PINS = new WeakMap<
  readonly string[],
  { pinned: string; keys: readonly string[]; depths?: readonly number[] }
>();
/**
 * ADR-315 Phase 5 증분 5f — a windowed body's rows between its pinned rows (`CatalogWindowRows`):
 * their keys · depths and the window's start among them, and where they sit in the whole run
 * (`base` · `count` — the rows in view the session is told are the whole run's places).
 */
function catalogWindowBetweenPins(window: CatalogRowWindowKeys): {
  keys: readonly string[];
  start: number;
  depths?: readonly number[];
  base?: number;
  count?: number;
} {
  const pinned = window.pinned;
  if (!pinned)
    return {
      keys: window.keys,
      start: window.start,
      ...(window.depths ? { depths: window.depths } : {}),
    };
  const end = window.keys.length - pinned.bottom;
  const name = `${pinned.top}:${pinned.bottom}`;
  let held = BETWEEN_PINS.get(window.keys);
  if (held?.pinned !== name || !held.depths !== !window.depths) {
    held = {
      pinned: name,
      keys: window.keys.slice(pinned.top, end),
      ...(window.depths
        ? { depths: window.depths.slice(pinned.top, end) }
        : {}),
    };
    BETWEEN_PINS.set(window.keys, held);
  }
  return {
    keys: held.keys,
    start: window.start - pinned.top,
    ...(held.depths ? { depths: held.depths } : {}),
    base: pinned.top,
    count: window.keys.length,
  };
}

/**
 * A windowed TableBody's children: its other children as they are, its data rows as one
 * `CatalogWindowRows` (the records' rows are one run — the resolver's window).
 */
function windowRowChildren(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  ids: readonly string[],
  context: CatalogDomContext,
  childElement: (childId: string) => ReactElement[],
): ReactElement[] | undefined {
  const window = node.rowWindow;
  if (!window) return undefined;
  // (ADR-315 Phase 5 증분 5f — the pinned rows are records first · last, drawn as they are: the
  //  window's rows are the ones between them, `CatalogRowWindowKeys.pinned`.)
  const data = ids.map((id) => {
    const record = root.domInputs.get(id);
    return (
      record?.rowIndex !== undefined &&
      record.props[CATALOG_PINNED_ROW_PROP] === undefined
    );
  });
  const first = data.indexOf(true);
  const last = data.lastIndexOf(true);
  if (first < 0) return undefined;
  const get = (id: string) => root.domInputs.get(id);
  const row = get(ids[first]!)!;
  // (The tracks are read from a Row — `catalogTrackTableOf` takes a Row or the header.)
  const cells =
    (catalogTableRowTracks(row, get, (entry) => catalogTypeName(root, entry))
      ?.list.length ?? 0) +
    (row.derivedProps?._allowsDragging === true ? 1 : 0);
  return [
    ...ids.slice(0, first).flatMap(childElement),
    createElement(CatalogWindowRows, {
      key: "catalog:window-rows",
      root,
      context,
      ...catalogWindowBetweenPins(window),
      ids: ids.slice(first, last + 1),
      cells,
      spans: catalogRowSpans(root, row),
      owner: window.owner,
      ...(window.closed ? { closed: window.closed } : {}),
    }),
    ...ids.slice(last + 1).flatMap(childElement),
  ];
}

/**
 * ADR-257 Phase 4 — an authored TableBody's Rows in its Table's Preview sort (the text of their
 * cell in the sorted column). Data rows come sorted by value from the resolver (the rows a fixed
 * height shows are the sorted data's first — `boundTableRows`).
 */
/** A Table record's sort entries as its view reads them (RAC keys): the list, else the one sort. */
function tableSortEntries(
  override: Readonly<Record<string, unknown>> | undefined,
): readonly CatalogTableSort[] | undefined {
  const entries = override?._sortEntries;
  if (Array.isArray(entries)) {
    const list = entries.flatMap((entry) => catalogTableSortOf(entry) ?? []);
    if (list.length) return list;
  }
  const one = catalogTableSortOf(override?.sortDescriptor);
  return one ? [one] : undefined;
}

/**
 * A Column's place in its Table's sort of several columns (ADR-315 Phase 2): its 1-based order and
 * direction. Undefined = the Table has one sort or none (RAC's own direction draws the arrow).
 */
function columnSortEntry(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  table: CatalogConsumerNode,
  context: CatalogDomContext,
): { order: number; direction: "ascending" | "descending" } | undefined {
  // (ADR-315 Phase 4 증분 6 — no sort of its own: the sort its rows are in as authored.)
  const entries =
    tableSortEntries(context.runtime?.overrideOf(table.id)) ??
    catalogTableAuthoredSortShown(
      table,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    );
  if (!entries || entries.length < 2) return undefined;
  const key = catalogTableColumnKey({
    id: node.id,
    ...(node.htmlId ? { htmlId: node.htmlId } : {}),
  });
  const index = entries.findIndex((entry) => entry.column === key);
  return index < 0
    ? undefined
    : { order: index + 1, direction: entries[index]!.direction };
}

function tableBodyOrder(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  context: CatalogDomContext,
): readonly string[] {
  if (node.children.some((id) => id.includes(CATALOG_ROW_SEPARATOR)))
    return node.children;
  return (
    catalogTableSortedRows(
      node,
      tableSortEntries(context.runtime?.overrideOf(node.parentId)),
      (recordId) => root.domInputs.get(recordId),
      (entry) => catalogTypeName(root, entry),
    ) ?? node.children
  );
}

/**
 * ADR-310 G8 ⑤ — a child's React key under a data row's copy (`…#row:<key>`): the child's identity
 * without that row's suffix, so the key is the child's template position. RAC reuses an item's view
 * for another row as the list scrolls (its reference re-renders the same item component); keyed by
 * the row's record id, every child of the reused row unmounted and mounted again (live, 4x: our
 * virtual list dropped 79 % of scroll frames, RAC's own list 20 %). Siblings stay unique — one row's
 * children differ by template position, and a list's rows (different suffixes) keep their ids.
 */
export function catalogChildKey(
  parent: CatalogConsumerNode,
  childId: string,
): string {
  const at = parent.id.indexOf(CATALOG_ROW_SEPARATOR);
  if (at < 0) return childId;
  const suffix = parent.id.slice(at);
  return childId.endsWith(suffix) ? childId.slice(0, -suffix.length) : childId;
}

/**
 * The same for the element a data row's copy draws: a binding keys its element by the record id
 * (`key: node.id`) — under a reused row view that key changed with the row and React remounted the
 * element (Icon · Text · their spans). The row's suffix leaves the key.
 */
export function catalogRowStableElement<T extends ReactElement | null>(
  record: CatalogConsumerNode,
  element: T,
): T {
  const at = record.id.indexOf(CATALOG_ROW_SEPARATOR);
  const key = element?.key;
  if (at < 0 || typeof key !== "string") return element;
  const suffix = record.id.slice(at);
  return key.includes(suffix)
    ? (cloneElement(element!, { key: key.replace(suffix, "") }) as T)
    : element;
}

export function renderNode(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  context: CatalogDomContext,
  parentInput: CatalogConsumerNode | undefined,
  partParent: CatalogConsumerNode | undefined,
  watchedParent: CatalogConsumerNode | undefined,
  styleOverride: CSSProperties | undefined,
): ReactElement | null {
  // ADR-256 Decision 7: an optional text part with nothing to say is not there.
  if (
    catalogAbsentByValue(node) ||
    // (2026-11-14: an ActionButton's unfilled Avatar · count Badge.)
    catalogActionButtonPartAbsent(
      node,
      (id) => root.domInputs.get(id),
      root.typeOf,
    ) ||
    catalogFieldLabelPartsHidden(
      node,
      (id) => root.domInputs.get(id),
      root.typeOf,
    ) ||
    // (A field's label row without label text — S2 `FieldLabel`, the Canvas's predicate.)
    catalogFieldLabelRowAbsent(
      node,
      (id) => root.domInputs.get(id),
      root.typeOf,
    ) ||
    // (A picker's time field off its time granularity — S2 `showTimeField`.)
    catalogPickerTimeAbsent(
      node,
      (id) => root.domInputs.get(id),
      root.typeOf,
    ) ||
    // (An item's selection Checkbox · a Card's checkbox plate off checkbox selection — S2.)
    catalogSelectionCheckboxHidden(
      node,
      (id) => root.domInputs.get(id),
      root.typeOf,
    ) ||
    // (S2 Menu · ListBox Divider: none first, last or before another.)
    catalogCollectionSeparatorHidden(
      node,
      (id) => root.domInputs.get(id),
      root.typeOf,
    ) ||
    // (A Pagination's first · last page and gaps: around its page window.)
    catalogPaginationPartHidden(
      node,
      (id) => root.domInputs.get(id),
      root.typeOf,
    ) ||
    // (S2 `ColumnWithMenu`: a Column's ⋮ only while it has its menu.)
    catalogColumnMenuIconHidden(
      node,
      (id) => root.domInputs.get(id),
      root.typeOf,
    )
  )
    return null;
  if (
    catalogPickerSelectionHidden(
      node,
      (id) => root.domInputs.get(id),
      root.typeOf,
    )
  )
    return null;
  // (A TagGroup's error text while the group is not invalid — the Canvas's predicate, S2. A
  //  TokenField's hint parts too (S2 체크리스트 §4.1 Phase 4): RAC TokenField has no validation to
  //  swap its Description for the error — S2 HelpText shows one of them.)
  const hintHost = partParent && catalogTypeName(root, partParent);
  if (
    partParent &&
    (hintHost === "TagGroup" || hintHost === "TokenField") &&
    catalogFieldHintShown(catalogTypeName(root, node), partParent, hintHost) ===
      false
  )
    return null;
  // (A NumberField's stepper Buttons while `hideStepper` — the Canvas's predicate, S2.)
  if (
    catalogStepperHidden(
      node,
      (recordId) => root.domInputs.get(recordId),
      (entry) => catalogTypeName(root, entry),
    )
  )
    return null;
  // (A highlight-selection Table's selection checkbox column — the Canvas's predicate, S2.)
  if (
    catalogTableSelectionPartHidden(
      node,
      (recordId) => root.domInputs.get(recordId),
      (entry) => catalogTypeName(root, entry),
    )
  )
    return null;
  // (A dismissible Dialog's ButtonGroup — its close button replaces it, the Canvas's predicate, S2.)
  if (
    catalogDismissibleDialogOf(
      node,
      (recordId) => root.domInputs.get(recordId),
      (entry) => catalogTypeName(root, entry),
    )
  )
    return null;
  if (
    catalogSelectBoxDescriptionHidden(
      node,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    )
  )
    return null;
  // (A ProgressBar's · Meter's value text without a label or while indeterminate (S2), a Slider's while
  //  `showValueLabel` is false — the Canvas's predicate.)
  if (
    catalogProgressValueHidden(
      node,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    )
  )
    return null;
  const childIds =
    node.bindingId === "submenutrigger" ||
    node.bindingId === "unavailablemenuitemtrigger"
      ? submenuTriggerChildren(root, node)
      : node.ruleId === "TableBody"
        ? tableBodyOrder(root, node, context)
        : // A derived show order (a calendar header's pickers in its locale order).
          (catalogChildOrder(node.derivedProps) ?? node.children);
  const childElement = (childId: string): ReactElement[] => {
    const child = root.domInputs.get(childId);
    // A part its owner draws has no element of its own — but a toggle indicator in a layout
    // frame inside its button is drawn there by the button's state (ADR-256 Phase 3 review m1).
    if (child && catalogOwnerDrawnPart(root, child)) {
      const indicator = catalogToggleIndicatorElement(root, child);
      return indicator ? [indicator] : [];
    }
    const key = catalogChildKey(node, childId);
    const element = createElement(CatalogDomNode, {
      key,
      root,
      id: childId,
      context,
    });
    // (A PreviewTrigger's trigger keeps its authored style — RAC's guard goes to the sheet.)
    return [
      node.bindingId === "previewtrigger"
        ? createElement(CatalogPreviewTriggerTarget, {
            key,
            children: element,
          })
        : element,
    ];
  };
  // (A windowed Table's data rows: every row under its key — `CatalogWindowRows`.)
  const children: ReactElement[] =
    (node.ruleId === "TableBody"
      ? windowRowChildren(root, node, childIds, context, childElement)
      : undefined) ?? childIds.flatMap(childElement);
  // A sortable Column's sort arrow opens its content wrapper, before the name (S2
  // `ColumnContents` — drawn only while sorted, `CatalogSortIndicator`).
  if (
    catalogColumnSortContent(
      node,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    )
  )
    children.unshift(
      createElement(CatalogSortIndicator, { key: "sort-indicator" }),
    );
  // A bound Table's end loads its next page (`TableLoadMoreItem` — `onLoadMore`, S2 TableView).
  if (node.ruleId === "TableBody") {
    const table = root.domInputs.get(node.parentId);
    if (table)
      children.push(
        ...catalogLoadMoreItem(
          root,
          table,
          context.runtime?.loadMore || context.runtime?.showMore
            ? (collectionId, ownerId, moreLoaded) =>
                context.runtime!.showMore
                  ? context.runtime!.showMore(collectionId, ownerId, moreLoaded)
                  : !moreLoaded
                    ? context.runtime!.loadMore?.(collectionId)
                    : undefined
            : undefined,
          TableLoadMoreItem,
          (collectionId) => context.runtime?.pages?.(collectionId) ?? false,
          (collectionId, ownerId) =>
            context.runtime?.moreLoaded?.(collectionId, ownerId) ?? false,
        ),
      );
  }
  // S2 Picker · ComboBox `loadingState` (`useAsyncList.loadingState`): a bound picker's field shows
  // its spinner — in the Select's trigger before the chevron, in the ComboBox's Group before its
  // button (`catalogPickerSpinner`).
  const pickerType =
    partParent &&
    ((node.bindingId === "button" &&
      catalogTypeName(root, partParent) === "Select") ||
      (node.bindingId === "group" &&
        catalogTypeName(root, partParent) === "ComboBox"))
      ? catalogTypeName(root, partParent)
      : undefined;
  const pickerSpinner = catalogPickerSpinner(pickerType, partParent?.props);
  if (pickerSpinner)
    children.splice(Math.max(children.length - 1, 0), 0, pickerSpinner);
  const delegated = CATALOG_DELEGATED_DOM[node.bindingId ?? ""];
  if (delegated && !bindings[node.bindingId ?? ""])
    return withHtmlId(
      root,
      node,
      delegated.render({
        root,
        node,
        style: styleOverride
          ? { ...authoredStyle(root, node), ...styleOverride }
          : ITEMS_WRAPPER_BINDINGS.has(node.bindingId ?? "") && partParent
            ? // (A group's items wrapper: the group's sheet gives its orientation box — only what
              //  the document wrote goes inline, 2026-11-13 전수 감사.)
              authoredStyle(
                root,
                withoutOwnerPartValues(root, node, partParent),
              )
            : authoredStyle(root, node),
        renderChild: (childId) =>
          createElement(CatalogDomNode, {
            key: catalogChildKey(node, childId),
            root,
            id: childId,
            context,
          }),
        ...(context.runtime
          ? {
              runtimeProps: (recordId: string) =>
                context.runtime!.overrideOf(recordId),
              handlersOf: (recordId: string) =>
                context.runtime!.handlersOf(recordId),
            }
          : {}),
        styleOf: (recordId: string) => {
          const record = root.domInputs.get(recordId);
          return record ? authoredStyle(root, record) : {};
        },
        writtenStyleOf: (recordId: string) => {
          const record = root.domInputs.get(recordId);
          if (!record) return {};
          const written = <T extends object>(values: T | undefined) =>
            Object.fromEntries(
              Object.entries(values ?? {}).filter(([key]) =>
                root.wroteStyleKey(record, key),
              ),
            ) as T;
          return authoredStyle(root, {
            ...record,
            visual: written(record.visual),
            layout: written(record.layout),
          });
        },
        ...(context.runtime?.setRuntimeProps
          ? {
              setRuntimeProps: (
                recordId: string,
                patch: Readonly<Record<string, unknown>>,
              ) => context.runtime!.setRuntimeProps!(recordId, patch),
            }
          : {}),
        ...(context.runtime?.loadMore || context.runtime?.showMore
          ? {
              loadMore: (
                collectionId: string,
                ownerId: string,
                moreLoaded: boolean,
              ) =>
                context.runtime!.showMore
                  ? context.runtime!.showMore(collectionId, ownerId, moreLoaded)
                  : !moreLoaded && context.runtime!.pages?.(collectionId)
                    ? context.runtime!.loadMore?.(collectionId)
                    : undefined,
              pages: (collectionId: string) =>
                context.runtime!.pages?.(collectionId) ?? false,
              moreLoaded: (collectionId: string, ownerId: string) =>
                context.runtime!.moreLoaded?.(collectionId, ownerId) ?? false,
              loadingOf: (collectionId: string) =>
                context.runtime!.loadingOf?.(collectionId),
            }
          : {}),
        ...(context.runtime?.paginationClick
          ? {
              paginationClick: (
                recordId: string,
                target: Element,
                nav: Element,
              ) => context.runtime!.paginationClick!(recordId, target, nav),
            }
          : {}),
        ...(context.runtime?.serverFilterOf && context.runtime.setFilterText
          ? {
              serverFilterOf: (recordId: string) =>
                context.runtime!.serverFilterOf!(recordId),
              setFilterText: (collectionId: string, filterText: string) =>
                context.runtime!.setFilterText!(collectionId, filterText),
            }
          : {}),
      }),
    );
  // A field's control Group in a field drawn as its node tree (ADR-256 Phase 2c · 6b): RAC's Group
  // of a NumberField · SearchField — its parts in it, in order. Its box is the field sheet's (the
  // field owns the Group's look — no inline style).
  const controlOf = partParent?.bindingId ?? "";
  if (node.bindingId === "group" && controlOf in NODE_TREE_CONTROL_CLASSES)
    return withHtmlId(
      root,
      node,
      nodeTreeControlGroup(
        root,
        node,
        partParent!,
        NODE_TREE_CONTROL_CLASSES[controlOf],
        children,
      ),
    );
  // A field's Input node is a RAC Input inside the field's context (ADR-253).
  const field = watchedParent ?? catalogPartField(root, node);
  if (
    field &&
    CATALOG_INPUT_NODE_FIELDS.has(field.bindingId ?? "") &&
    node.ruleId === "Input"
  ) {
    const inputStyle = { ...authoredStyle(root, node), ...styleOverride };
    const inputEnd = catalogFieldBoxInputEnd(
      node,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    );
    const inputStart = catalogFieldBoxInputStart(
      node,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    );
    return fieldInputBinding(
      node,
      {
        // ADR-259 Phase 2: in a prefix box the Group draws the box — the Input lays its own down
        // (`CATALOG_FIELD_BOX_INPUT_STYLE`, the Rust input reads the same). These are the Input's
        // defaults there: what the author wrote on the Input (`inputStyle`) comes after and wins.
        ...laidFieldBoxInput(root, node, inputEnd, inputStart),
        ...inputStyle,
      },
      field,
    );
  }
  // A date field's DateInput node is a RAC DateInput inside the field's context (ADR-253).
  if (
    field &&
    CATALOG_DATE_INPUT_NODE_FIELDS.has(field.bindingId ?? "") &&
    node.ruleId === "DateInput"
  )
    return fieldDateInputBinding(
      node,
      {
        // (A DatePicker's DateInput lays its box down in the Group — the same set as an Input's.)
        ...laidFieldBoxInput(
          root,
          node,
          catalogFieldBoxInputEnd(
            node,
            (id) => root.domInputs.get(id),
            (entry) => catalogTypeName(root, entry),
          ),
          undefined,
        ),
        ...authoredStyle(root, node),
        ...styleOverride,
      },
      children,
    );
  // A field's FieldError node is a RAC FieldError inside the field's context (ADR-253): RAC shows
  // it while the field is invalid — the authored message, else what its validation raised.
  const binding =
    node.bindingId === "fielderror" &&
    partParent &&
    catalogTypeName(root, partParent) === "TokenField"
      ? tokenFieldErrorBinding
      : node.bindingId === "fielderror" &&
          partParent &&
          FIELD_HINT_OWNERS.has(catalogTypeName(root, partParent))
        ? fieldErrorBinding
        : node.bindingId === "fielderror" &&
            partParent &&
            catalogTypeName(root, partParent) === "TagGroup"
          ? tagGroupErrorBinding
          : // A toggle's text in its RAC button (ADR-256 Phase 3 — the reference's button children): an
            // element of its own, not RAC's `Label` (a label inside the button's `label`; in a group it
            // would take the group's label context).
            node.bindingId === "label" &&
              partParent &&
              OWNER_DRAWN_PART_HOSTS[catalogTypeName(root, partParent)]
            ? toggleTextBinding
            : bindingOf(node);
  // A Slider's thumb (ADR-256 Phase 7c): RAC's thumb of its place among the track's thumbs; its
  // ring is the slider sheet's (`.react-aria-SliderThumb` border — its color is the sheet's), not
  // inline — unless the author wrote one (2026-11-14 감사: the written width was dropped).
  if (node.bindingId === "sliderthumb" && parentInput) {
    const { borderWidth: _ring, ...sheetRing } = node.visual;
    const visual = catalogHasExplicitVisual(root, node, "borderWidth")
      ? node.visual
      : sheetRing;
    // (The copy keeps the token refs — the thumb's `scaled` sides go inline as the device formula.)
    copyResolvedTokenRefs(visual, node.visual, Object.keys(visual));
    node = {
      ...node,
      visual,
      props: {
        ...node.props,
        _thumbIndex: parentInput.children
          .map((childId) => root.domInputs.get(childId))
          .filter((child) => child?.bindingId === "sliderthumb")
          .findIndex((child) => child!.id === node.id),
      },
    };
  }
  // A field's own Button (derived `fieldButton`) draws its size's corner and no border (S2 — ADR-295
  // 후속), not the rule's pill and 1px: the same rest values the Canvas paints (`catalogDerivedRestVisual`). The record's pill went inline
  // and beat the sheet's `[data-field-button]` block — Select trigger · NumberField stepper ·
  // Pagination were pills in the Preview (2026-10-30 live).
  const rest =
    node.derivedProps?.fieldButton || node.bindingId === "actionbutton"
      ? catalogDerivedRestVisual(root, node)
      : undefined;
  const stepper: CatalogConsumerNode = rest
    ? {
        ...node,
        visual: {
          ...node.visual,
          ...rest,
        } as CatalogConsumerNode["visual"],
      }
    : node;
  const bound = binding
    ? {
        ...catalogDomStyle(
          stepper,
          node.bindingId === "button" || watchedParent?.id !== node.parentId
            ? parentInput
            : watchedParent,
          node.derivedProps?._actionIconOnly === true
            ? catalogAuthoredVisual(root, node)
            : undefined,
        ),
      }
    : undefined;
  if (bound && !catalogIsAuthoredPlaced(node))
    containingBlock(root, node, bound);
  // ADR-295 Phase 2: a font size the resolver read from a typography token goes out as the token's
  //   variable, so the touch set reaches it as it reaches the generated sheets (a literal stays px). An
  //   Icon's font size is its glyph size, not a text step (S2 icon sizes — Phase 3).
  if (bound && node.bindingId !== "icon")
    catalogDeviceTypographyCss(bound, node.visual);
  // ADR-295 Phase 3: an S2 control box (`{size.height.<S>}` minimum) — its height and centring padding
  //   as the device variables.
  if (bound) catalogDeviceControlCss(bound, node.visual);
  // ADR-295 Phase 3c-3b: a part rule's length margin (a field button's overlap) — its device formula.
  if (bound) catalogDeviceLayoutCss(bound, node.layout);
  // (2026-11-15: a grouped Checkbox's help text — S2 `isInCheckboxGroup`, over its own field margins;
  //  the Canvas's same margins as the refs' device formulas, `toggleLayout.ts`.)
  const toggleHelp =
    bound && node.derivedProps?._toggleItemHelp
      ? catalogToggleItemHelpRefs(node.derivedProps)
      : undefined;
  if (bound && toggleHelp) {
    bound.marginTop = ruleLengthCss(toggleHelp.marginTop);
    bound.marginLeft = ruleLengthCss(toggleHelp.marginLeft);
  }
  if (bound && node.derivedProps?._fieldLabelRole)
    // Label skips stylesheet generation. Its typed part defaults (including inline/flex
    // baseline participation) must reach DOM as well as authored edits, just as Canvas reads them.
    Object.assign(bound, catalogLayoutCss(node.layout));
  // Hint states belong to their catalog sheet; a resolved resting color inline would
  // override disabled. Explicitly authored text colors still win, and so does an owner-derived
  // one (2026-11-09: an InlineAlert boldFill description is white on both consumers — deleting it
  // left the sheet's `--fg-muted` gray on the bold fill).
  if (
    bound &&
    ["description", "fielderror"].includes(node.bindingId ?? "") &&
    !catalogHasAuthoredColor(root, node)
  ) {
    if (typeof node.derivedProps?.color === "string")
      bound.color = node.derivedProps.color;
    else delete bound.color;
  }
  // A Select's value takes its trigger Button's text color and the field sheet's placeholder
  // paint (`[data-placeholder]`): its color goes inline only when the document wrote it.
  // A Disclosure's title Text takes its trigger's color the same way (`… > .react-aria-Text
  // { color: inherit }` — the trigger's hover color reaches it), and so does a Tab's · Tag's label
  // (`.react-aria-Tag .react-aria-Text { color: inherit }`): RAC's run selection recolors the item
  // in the Preview, and the Canvas's item color (`derivedOf`) is the authored state's (2026-10-09).
  const itemOfLabel = () => {
    const item = catalogDomPartParent(root, node);
    return (
      item &&
      catalogItemLabels(
        item,
        (id) => root.domInputs.get(id),
        (entry) => catalogTypeName(root, entry),
      ).some((label) => label.id === node.id)
    );
  };
  if (
    bound &&
    (node.bindingId === "selectvalue" ||
      (node.bindingId === "text" &&
        (catalogDisclosureOfTriggerPart(
          node,
          (id) => root.domInputs.get(id),
          (entry) => catalogTypeName(root, entry),
        ) !== undefined ||
          itemOfLabel()))) &&
    catalogAuthoredVisual(root, node).color === undefined
  )
    delete bound.color;
  // A ToggleButton's label Text (ADR-276 — the button owns it) takes the button's color, which the
  // sheet changes with RAC's runtime selection (`[data-selected]`): a resting color inline stayed
  // when the user toggled it in the Preview, so the selected label vanished (2026-10-30).
  const glyphOwner = catalogToggleButtonGlyphOwner(
    node,
    (id) => root.domInputs.get(id),
    (entry) => catalogTypeName(root, entry),
  );
  // (A Button's label color its rule's part block gives is the Button's paint, not a write — the
  //  Canvas reads the same: `compositionRoot` `toggleGlyphOwner`.)
  const glyphColorWritten = (entry: CatalogConsumerNode) =>
    glyphOwner && catalogTypeName(root, glyphOwner) === "Button"
      ? catalogHasExplicitVisual(root, entry, "color")
      : catalogHasAuthoredColor(root, entry);
  if (
    bound &&
    (node.bindingId === "text" || node.bindingId === "label") &&
    glyphOwner &&
    !glyphColorWritten(node)
  )
    bound.color = "inherit";
  if (bound && node.bindingId === "text") {
    const owner = catalogToggleButtonGlyphOwner(
      node,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    );
    if (owner && catalogTypeName(root, owner) === "SegmentedControlItem") {
      const authored = catalogAuthoredVisual(root, node);
      for (const key of ["fontSize", "fontWeight", "lineHeight"] as const)
        if (authored[key] === undefined) bound[key] = "inherit";
    }
  }
  // ADR-300 — a SideNav row's · header's Text takes its owner's type and color (S2 `treeCellGrid`:
  // `font: ui`, `neutral-subdued`, the current row `neutral` bold — the rules' `& .react-aria-Text`):
  // RAC marks the current row at run time (`data-current` — a navigation moves it), so the Text's
  // resting values do not go inline.
  if (
    bound &&
    node.bindingId === "text" &&
    catalogSideNavTextOwner(
      node,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    )
  ) {
    const authored = catalogAuthoredVisual(root, node);
    for (const key of ["color", "fontSize", "fontWeight", "lineHeight"])
      if (authored[key] === undefined) delete bound[key as keyof CSSProperties];
    // (A collapsed panel hides it — the panel rule's `display: none`; an inline box display would
    //  beat that.)
    if (node.authoredLayout?.display === undefined) delete bound.display;
  }
  // The repeat templates RAC draws per day · date · segment (Decision 13) are RAC's `th` · cell ·
  // segment: their display is the element's (a table cell, the sheet's) unless the document wrote
  // one — the box default `flex` made every weekday `th` a flex box (G5 example 15: the grid 380
  // tall, the Canvas's 200).
  if (
    bound &&
    REPEAT_TEMPLATE_BINDINGS.has(node.bindingId ?? "") &&
    node.authoredLayout?.display === undefined
  )
    delete bound.display;
  // A Button's paint is its rule's sheet (`data-variant` · `data-fill-style` …), which also
  // changes it by state (hover · pressed · disabled): the background, border color and text color
  // go inline only when the document wrote them (an origin override, the node's own value) —
  // an inline rest color would keep every state at rest (ADR-253: a field's stepper and trigger
  // are Button instances).
  //
  // A Button the document disables keeps its resolved paint inline. A Button RAC's context
  // disables (a disabled field's own button) is not authored: its props here carry the context
  // (`isDisabled`, ids, aria), so "authored" is read against the document record — otherwise the
  // rule's disabled paint differs from the rest `visual` and the rest color went inline over the
  // sheet's `[data-disabled]` paint (2026-11-09: a disabled Select drew #292929, the Canvas gray).
  // ADR-259 Phase 3: a ContextualHelp's trigger is S2's quiet ActionButton, detached from any
  // Button context (S2 `slot={null}`) and named by its help — its box and quiet paint are the
  // ActionButton sheet's, as for any ActionButton (S2 마이그레이션 2026-11-18).
  const helpOwner =
    node.bindingId === "actionbutton"
      ? catalogContextualHelpOfTrigger(
          node,
          (id) => root.domInputs.get(id),
          (entry) => catalogTypeName(root, entry),
        )
      : undefined;
  if (
    bound &&
    (node.bindingId === "button" || node.bindingId === "actionbutton")
  ) {
    const partField = catalogPartField(root, node);
    const declared = root.domInputs.get(node.id) ?? node;
    // The sheet owns fill/outline and field borders; only an authored removal goes inline.
    // A derived fill border of 0 must not erase a quiet Select's CSS underline.
    if (
      Number(node.visual.borderWidth) === 0 &&
      catalogAuthoredVisual(root, declared, true).borderWidth !== undefined
    )
      bound.borderWidth = 0;
    // A SearchField's sheet hides its clear button (in its control Group) while the input is empty
    // or read-only (RAC's run state): that Button's display stays the sheet's.
    if (partField?.bindingId === "searchfield") delete bound.display;
    if (
      node.derivedProps?._pickerTrigger === true ||
      node.derivedProps?._searchFieldPart === true ||
      declared.props.isDisabled !== true
    ) {
      // The rule's colors and their states are the generated sheet's (the variant's condition tree —
      // ADR-297); only a color the document wrote goes inline, over every state, as the Canvas
      // paints it (`resolveCatalogPaint` — the authored style wins over the tree). Not the
      // `.button-base` variables: that ramp skips catalog nodes since ADR-297 3e, so a fill written
      // as `--button-color` reached nothing (2026-11-02 — the Tag remove button drew the variant's
      // dark fill in the Preview, transparent on the Canvas). Fill layers are their own background.
      const authored = catalogAuthoredVisual(root, declared, true);
      const fillAuthored =
        authored.fill !== undefined || authored.backgroundColor !== undefined;
      if (!fillAuthored && !node.fills?.length) delete bound.backgroundColor;
      // ADR-297 후속 ⑥: the variant's gradient (the definition's `backgroundImage` — S2 premium · genai)
      //   is the sheet's too, by state; an authored background turns it off (the Canvas the same —
      //   `catalogPaintedVisual`), authored fill layers paint their own.
      if (
        authored.backgroundImage === undefined &&
        typeof node.visual.backgroundImage === "string"
      ) {
        const layers = node.fills?.length
          ? catalogAuthoredDomStyle({ visual: {}, fills: node.fills })
          : undefined;
        if (layers?.backgroundImage !== undefined)
          bound.backgroundImage = layers.backgroundImage;
        else if (fillAuthored || layers) bound.backgroundImage = "none";
        else delete bound.backgroundImage;
      }
      if (authored.borderColor === undefined) delete bound.borderColor;
      if (authored.color === undefined) delete bound.color;
    }
  }
  // Compact의 개별 코너는 생성 CSS가 담당한다. 기본 radius를 inline으로 덮지 않는다.
  if (
    bound &&
    node.bindingId === "actionbutton" &&
    node.derivedProps?.density === "compact" &&
    catalogAuthoredVisual(root, node).borderRadius === undefined
  )
    delete bound.borderRadius;
  // A TreeItem's chevron button (ADR-256 Phase 5h) is the reference's plain RAC Button: `Tree.css`
  // gives its box (`all: unset` · 20px · the level indent), so only what the document wrote goes
  // inline — not the Button type's resolved box, which would override the sheet.
  // So are a Disclosure's header Heading and trigger Button (ADR-256 Phase 8c — the Disclosure
  // sheet's `.react-aria-Heading` · `.react-aria-Button[slot='trigger']`; the Canvas reads the same
  // values from the Disclosure's part rules).
  const domGet = (id: string) => root.domInputs.get(id);
  const domType = (entry: CatalogConsumerNode) => catalogTypeName(root, entry);
  const disclosureOwner =
    catalogDisclosureOfTrigger(node, domGet, domType) ??
    catalogDisclosureOfHeading(node, domGet, domType);
  // (A calendar's nav Button: the header row's part rule gives its box on the Canvas —
  // `.react-aria-Calendar header > .react-aria-Button` in the DOM, ADR-256 Phase 9.)
  const calendarNavHeader =
    node.bindingId === "button" &&
    catalogCalendarNavButton(node, domGet, domType)
      ? domGet(node.parentId)
      : undefined;
  const sheetBox = disclosureOwner
    ? authoredStyle(root, withoutOwnerPartValues(root, node, disclosureOwner))
    : calendarNavHeader
      ? authoredStyle(
          root,
          withoutOwnerPartValues(root, node, calendarNavHeader),
        )
      : node.bindingId === "button" &&
          catalogTreeChevronButtonItem(node, domGet, domType)
        ? treeChevronSheetBox(root, node, domGet, domType)
        : // (A SideNav row's chevron: the `SideNavItem` rule's sheet box — ADR-300.)
          node.bindingId === "button" &&
            catalogSideNavChevronItem(node, domGet, domType)
          ? authoredStyle(root, node)
          : undefined;
  // Its glyph takes the button's color (`all: unset` inherits the row's — selected, disabled), so
  // the Canvas resting color (the item's, `derivedOf`) does not go inline.
  // (A Disclosure trigger's chevron takes the trigger's color — hover included — the same way.)
  const sheetColored =
    // (S2 DropZone — its IllustratedMessage's picture turns accent while a drag is over the zone
    //  (`--iconPrimary` · `isDropTarget`): the color is the sheet's, rest `--fg` as the Canvas
    //  paints it — S2 마이그레이션 2026-11-18.)
    (node.bindingId === "illustration" &&
      !glyphColorWritten(node) &&
      catalogIllustrationInDropZone(node, domGet, domType)) ||
    (node.bindingId === "icon" &&
      (catalogTreeChevronGlyphItem(node, domGet, domType) ||
        catalogDisclosureOfTriggerPart(node, domGet, domType) ||
        // (A calendar nav Button's chevron takes the Button's `--fg` — ADR-256 Phase 9.)
        catalogCalendarNavButtonGlyph(node, domGet, domType) ||
        // (A Tag's remove X takes the Tag's color through its button — `TagGroup.css`.)
        catalogItemRemoveGlyphItem(node, domGet, domType)))
      ? {
          ...node,
          visual: withTokenRefs(
            { ...node.visual, color: undefined },
            node.visual,
          ),
          derivedProps: { ...node.derivedProps, color: undefined },
        }
      : undefined;
  const toggleColored =
    node.bindingId === "icon" &&
    // (ADR-300 — a SideNav row's chevron glyph is S2's `currentColor`, the row's: always — the
    //  Button's part rule colors an icon in it, which reads as a write. The Icon sheet's own `--fg`
    //  would win over the button's inherit.)
    (catalogSideNavChevronGlyphItem(node, domGet, domType) ||
      (!glyphColorWritten(node) &&
        (glyphOwner ||
          // (A SideNav row's icon: the row's color, current included.)
          catalogSideNavRowItemOf(node, domGet, domType) ||
          // (A ListBox item's icon: the item's color — RAC's selection recolors the item, S2
          //  `currentColor`; `catalogItemLabels`.)
          itemOfLabel())))
      ? withInheritedIconColor(node)
      : undefined;
  const rendered = helpOwner
    ? createElement(
        ContextualHelpButton,
        {
          "data-catalog-id": node.id,
          "data-icon-only":
            node.derivedProps?._actionIconOnly === true || undefined,
          size: node.props.size as ActionButtonProps["size"],
          isQuiet: node.props.isQuiet === true,
          style: { ...bound, ...styleOverride },
          ...(buttonDisabled(node) || node.props.isDisabled === true
            ? { isDisabled: true }
            : {}),
          ...(node.props.autoFocus === true ? { autoFocus: true } : {}),
        },
        ...children,
      )
    : binding
      ? binding(
          toggleColored ??
            (sheetColored as CatalogConsumerNode | undefined) ??
            node,
          sheetBox ?? (styleOverride ? { ...bound, ...styleOverride } : bound!),
          children,
          context,
        )
      : ruleDom(root, node, children, context);
  const slot = itemSlotRole(root, node);
  // S2 `ColumnWithMenu`: a resizable Column's content wrapper is its menu Button (Preview).
  const menuWrapped = catalogColumnMenuContent(node, domGet, domType)
    ? createElement(CatalogColumnMenuButton, {
        key: node.id,
        element: rendered as ReactElement,
      })
    : rendered;
  const named = withHtmlId(
    root,
    node,
    slot
      ? cloneElement(menuWrapped as ReactElement<{ slot?: string }>, { slot })
      : menuWrapped,
  );
  // ADR-259 Phase 2: a field's prefix carries the id its input's name points at (S2 `FieldGroup`).
  const prefixParent =
    catalogIsFieldPrefix(node, domType) && domGet(node.parentId);
  // (Its `slot` too — an Icon passes only an item's slot role — so the field sheet's prefix
  // selectors reach it: its gap, its shrink.)
  const element =
    prefixParent &&
    catalogFieldBox(prefixParent, domGet, domType)?.prefix?.id === node.id
      ? cloneElement(named as ReactElement<{ id?: string; slot?: string }>, {
          slot: "prefix",
          ...(node.htmlId ? {} : { id: catalogFieldPrefixDomId(node) }),
        })
      : named;
  // S2 체크리스트 §9.3: an unavailable item's info glyph — the item's description (its id, its
  // localized name — S2 `UnavailableIconWrapper`).
  const unavailableItem =
    node.bindingId === "icon"
      ? catalogUnavailableGlyphItem(node, domGet, domType)
      : undefined;
  // S2 체크리스트 §9.3: a copy of a SelectValue's repeated node shows while its row is selected.
  const valueRow =
    node.rowIndex !== undefined &&
    catalogValueTemplateOwner(node, domGet, domType)
      ? catalogValueRowKey(node)
      : undefined;
  if (valueRow !== undefined)
    return createElement(CatalogSelectValueRowGate, {
      key: node.id,
      rowKey: valueRow,
      element: element as ReactElement,
    });
  // S2 ActionMenu (§9.3): an unnamed icon-only menu trigger is named 「More actions」 in the site's
  // language (S2 `menu.moreActions`).
  if (
    node.bindingId === "actionbutton" &&
    catalogMoreActionsTrigger(node, domGet, domType)
  )
    return createElement(CatalogMoreActionsName, {
      key: node.id,
      element: element as ReactElement,
    });
  // S2 AlertDialog (§9.3): its title glyph is named 「Alert」 in the site's language.
  if (
    node.bindingId === "icon" &&
    catalogAlertDialogGlyph(node, domGet, domType)
  )
    return createElement(CatalogAlertGlyph, {
      key: node.id,
      element: element as ReactElement,
    });
  if (unavailableItem)
    return createElement(CatalogUnavailableGlyph, {
      key: node.id,
      id: catalogUnavailableGlyphDomId(unavailableItem.id),
      element: element as ReactElement,
    });
  const selectionItem =
    node.bindingId === "icon"
      ? catalogPickerSelectionItem(node, domGet, domType)
      : undefined;
  if (selectionItem)
    return createElement(CatalogPickerSelectionSlot, {
      children: catalogValueGate(
        node.id,
        { isSelected: selectionItem.id },
        (read) =>
          cloneElement(
            element as ReactElement<{ slot?: string; style?: CSSProperties }>,
            {
              slot: "selection",
              style: {
                ...(element.props as { style?: CSSProperties }).style,
                visibility:
                  read("isSelected").value === true ? "visible" : "hidden",
              },
            },
          ),
      ),
    });
  return element;
}

/**
 * ADR-256 Phase 8c — `node` without the values its owner's part rules give it: the owner's sheet
 * draws those in the DOM (a Disclosure's `.react-aria-Heading` · `.react-aria-Button[slot='trigger']`
 * — inline, the trigger's transparent rest fill would cover the sheet's hover background). A value
 * the document wrote over a part rule's stays.
 */
/** A group's items wrapper (ADR-251 — `div.checkbox-items` · `div.radio-items`). */
const ITEMS_WRAPPER_BINDINGS: ReadonlySet<string> = new Set([
  "checkboxitems",
  "radioitems",
]);

function withoutOwnerPartValues(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  owner: CatalogConsumerNode,
): CatalogConsumerNode {
  const graph = root.runtime.graph;
  const definition = graph.getDefinition(owner.definitionId as DefinitionId);
  const rules =
    definition && "partRules" in definition ? (definition.partRules ?? []) : [];
  const value = (raw: unknown) =>
    raw && typeof raw === "object" && "tokenId" in raw
      ? (() => {
          const token = graph.getToken((raw as { tokenId: TokenId }).tokenId);
          return token && catalogTokenValue(token, root.colorMode);
        })()
      : raw;
  const visual: Record<string, unknown> = { ...node.visual };
  const layout: Record<string, string> = { ...node.layout };
  for (const rule of rules) {
    if (rule.child.definitionId !== node.definitionId) continue;
    for (const [key, raw] of Object.entries(rule.visual ?? {}))
      if (Object.is(visual[key], value(raw))) delete visual[key];
    for (const [key, raw] of Object.entries(rule.layout ?? {}))
      if (layout[key] === raw) delete layout[key];
  }
  return { ...node, visual: visual as typeof node.visual, layout };
}

/** Explicit state keys survive even when equal to rest (the rule sheet can change rest paint). */
export function catalogDomStateStyles(
  node: CatalogConsumerNode,
): CatalogStateStyles | undefined {
  if (!node.stateVisual) return undefined;
  const out: CatalogStateStyles = {};
  for (const [state, values] of Object.entries(node.stateVisual)) {
    const merged = catalogVisualWithBackground({
      ...node,
      visual: { ...node.visual, ...values },
    });
    const box = catalogBoxModel(merged);
    const style: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values).sort(
      (a, b) => authoredRank(a) - authoredRank(b),
    )) {
      const css = AUTHORED_CSS[key];
      const declared = css
        ? css(value)
        : TYPOGRAPHY_KEYS.has(key)
          ? {
              [key]:
                key === "fontFamily"
                  ? catalogCssFontFamily(String(value))
                  : value,
            }
          : key === "aspectRatio"
            ? { aspectRatio: String(value) }
            : key === "iconSize"
              ? { "--icon-size": `${Number(value)}px` }
              : key === "iconGap"
                ? { "--icon-gap": `${Number(value)}px` }
                : key === "fillAlpha"
                  ? {}
                  : undefined;
      if (!declared)
        throw new Error(`CATALOG_DOM_VISUAL_UNSUPPORTED:${node.id}:${key}`);
      Object.assign(style, declared);
      // A rest side/corner still refines a state shorthand, as in the Canvas box model.
      for (const [side, property] of Object.entries({
        top: "paddingTop",
        right: "paddingRight",
        bottom: "paddingBottom",
        left: "paddingLeft",
      }))
        if (property in declared && box.padding)
          style[property] = cssLength(
            box.padding[side as keyof typeof box.padding],
          );
      if (
        key === "radius" &&
        Object.keys(CATALOG_RADIUS_CSS).some(
          (corner) => merged.visual[corner] !== undefined,
        )
      ) {
        delete style.borderRadius;
        for (const [corner, property] of Object.entries(CATALOG_RADIUS_CSS))
          style[property] = Number(merged.visual[corner] ?? value);
      }
    }
    if (values.fillAlpha !== undefined && merged.visual.fill !== undefined)
      style.backgroundColor = cssColor(
        merged.visual.fill,
        Number(values.fillAlpha),
      );
    out[state as StateName] = style as CSSProperties;
  }
  return out;
}

type ClassNameValue =
  | string
  | ((values: { defaultClassName?: string }) => string | undefined)
  | undefined;

/**
 * The author's DOM attributes (`metadata` — every element) on the node's own element, for every
 * binding: `id`, `aria-label`, and class names after the element's own. An element without a
 * class of its own takes `react-aria-{Type}` first — a class passed to a RAC component replaces
 * its default (the old Preview's root class + author class rule); a DOM tag takes the author's.
 */
function withHtmlId(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  element: ReactElement,
): ReactElement {
  if (!node.htmlId && !node.className && !node.ariaLabel) return element;
  // (A binding with no element of its own — S2 `Skeleton` · `SkeletonCollection`, a lone
  //  SubmenuTrigger — draws a Fragment: no element to name. Why (2026-11-19): every record has an
  //  automatic id, and a Skeleton's reached its Fragment — React 「Invalid prop `id` supplied to
  //  React.Fragment」.)
  if (element.type === Fragment) return element;
  const patch: Record<string, unknown> = {};
  // (A collection item's and a TabPanel's `id` is RAC's key — RAC writes their element id and pairs
  // a TabPanel with its Tab by it: the author's HTML id would change the key, not the element id.
  // ADR-256 Phase 5e-2 — a detached Tabs' panel lost its Tab.)
  const type = catalogTypeName(root, node);
  // (RAC gives a Select's `id` to its trigger: with the Select's own id the trigger Button's would
  // be a second id for one element — RAC's id merging then swaps the two forever, ADR-256 후속 5.)
  const parent = root.domInputs.get(node.parentId);
  const selectTrigger =
    node.bindingId === "button" &&
    parent?.bindingId === "select" &&
    Boolean(parent.htmlId);
  // (A Slider's thumb input takes its id from the label's at mount (`getSliderThumbId` — RAC's
  // `useId` keeps the first value): the author's label id would rename the label and the
  // SliderOutput's `for` but not the input — the output lost its thumb. A detached Slider's Label
  // has an automatic id — G5 example 12.)
  const sliderLabel =
    type === "Label" &&
    (() => {
      const owner = catalogDomPartParent(root, node);
      return (
        owner !== undefined &&
        ["Slider", "RangeSlider"].includes(catalogTypeName(root, owner))
      );
    })();
  // (A Card in a CardView is the view's RAC GridListItem: its `id` is the item key the view's
  // selection names — `cardview` — so the author's HTML id would unselect it. A Card the view
  // starts with is an owned node with an automatic id since 2026-10-14.)
  const cardViewItem =
    type === "Card" &&
    parent !== undefined &&
    catalogTypeName(root, parent) === "CardView";
  // (ADR-308 R9: a selection · expansion item's `id` is its RAC key — a Table's Row, a group's
  //  ToggleButton, an Accordion's Disclosure — as a CardView's Card above.)
  const selectionItem =
    (type === "Row" || type === "ToggleButton" || type === "Disclosure") &&
    (type === "Disclosure"
      ? !!catalogAccordionOf(
          node,
          (id) => root.domInputs.get(id),
          (record) => catalogTypeName(root, record),
        )
      : !!catalogSelectionGroupOf(
          node,
          (id) => root.domInputs.get(id),
          (record) => catalogTypeName(root, record),
        ));
  // (ADR-310: a data row's copy of its template — the rows after the first — takes no author id: an
  // HTML id names one element, and a Table cell's id is its RAC key, which a collection keeps unique.)
  const rowCopy = node.id.includes(CATALOG_ROW_SEPARATOR);
  if (
    node.htmlId &&
    !rowCopy &&
    !selectTrigger &&
    !sliderLabel &&
    !cardViewItem &&
    !selectionItem &&
    !STATIC_ITEM_TYPES.has(type) &&
    type !== "TabPanel"
  ) {
    patch.id = node.htmlId;
    // (RAC's `useLabel` keeps the id it mounted with in `useId` state — a Select's trigger kept the
    // first id — so a new author id remounts the RAC component.)
    if (typeof element.type !== "string")
      patch.key = `${element.key ?? ""}#${node.htmlId}`;
  }
  if (node.ariaLabel) patch["aria-label"] = node.ariaLabel;
  // (S2 체크리스트 §9.3 — S2 `TableFooter`'s row is out of the selection, not dimmed: S2 Row
  //  `isDisabled` + `disabledBehavior: "selection"` (react-stately's per-item disabled behavior —
  //  never selected, no `data-disabled`). The record keeps no `isDisabled`: the Canvas has nothing
  //  to dim.)
  if (type === "Row" && node.derivedProps?.inFooter) {
    patch.isDisabled = true;
    patch.disabledBehavior = "selection";
  }
  const authored = node.className;
  if (authored) {
    const own = (element.props as { className?: ClassNameValue }).className;
    const join = (...names: (string | undefined)[]) =>
      names.filter(Boolean).join(" ");
    patch.className =
      typeof own === "function"
        ? (values: { defaultClassName?: string }) => join(own(values), authored)
        : own !== undefined || typeof element.type === "string"
          ? join(own, authored)
          : join(`react-aria-${type}`, authored);
  }
  return cloneElement(element, patch);
}

/**
 * Render one resolved subtree from the composition root's DOM inputs. The initial render walks
 * the subtree once; later edits reach only the subscribed nodes whose input changed.
 */
export function renderCatalogDom(
  root: CatalogCompositionRoot,
  id: string,
  context: CatalogDomContext = {},
): ReactElement {
  const node = root.domInputs.get(id);
  if (!node) throw new Error(`CATALOG_DOM_INPUT_REQUIRED:${id}`);
  bindingOf(node);
  return createElement(CatalogDomNode, { key: id, root, id, context });
}
export function useCatalogDomInput(
  root: CatalogCompositionRoot,
  id: string | undefined,
) {
  const read = useCallback(
    () => (id ? root.domInputs.get(id) : undefined),
    [root, id],
  );
  const subscribe = useCallback(
    (notify: () => void) => (id ? root.subscribeDom(id, notify) : () => {}),
    [root, id],
  );
  return useSyncExternalStore(subscribe, read, read);
}
