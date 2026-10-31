import { isPropVar } from "../document/valueType";
import { getIconData, resolveTextSourceText } from "@composition/rendering";
import {
  CATALOG_TOAST_CLOSE_ICON,
  CATALOG_TOAST_CLOSE_LABELS,
  catalogToastIcon,
} from "../document/toastChrome";
import { CatalogWaterfallGrid } from "./waterfall.components";
import { catalogWaterfallLayout } from "./waterfall";
import { catalogItemLinkProps } from "../document/itemLinks";
import { catalogDeviceValueCss } from "./deviceTypography";

import {
  OWNER_DRAWN_PART_HOSTS,
  OWNER_DRAWN_PART_OWNERS,
} from "@composition/shared";

import {
  getLocalTimeZone,
  Time,
  toCalendarDateTime,
  today,
} from "@internationalized/date";

import {
  Fragment,
  createContext,
  createElement,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";

import { DEFAULT_SLOT, TextContext } from "react-aria-components";

import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
} from "react-aria-components/Breadcrumbs";

import { Button as AriaButton } from "react-aria-components/Button";
import { useLocale } from "react-aria-components/I18nProvider";

import { Calendar as RacCalendar } from "react-aria-components/Calendar";

import {
  CheckboxButton as AriaCheckboxButton,
  CheckboxField as AriaCheckboxField,
} from "react-aria-components/Checkbox";

import { CheckboxGroup as AriaCheckboxGroup } from "react-aria-components/CheckboxGroup";

import type { Key } from "react-aria-components/Collection";

import { ColorField as AriaColorField } from "react-aria-components/ColorField";

import { parseColor } from "react-aria-components/ColorPicker";

import { ColorSwatchPickerItem as AriaColorSwatchPickerItem } from "react-aria-components/ColorSwatchPicker";

import { CatalogComboBox } from "./comboBoxSelectionText";

import { DateField as AriaDateField } from "react-aria-components/DateField";

import { DatePicker as AriaDatePicker } from "react-aria-components/DatePicker";

import { DateRangePicker as AriaDateRangePicker } from "react-aria-components/DateRangePicker";

import { Disclosure as RacDisclosure } from "react-aria-components/Disclosure";

import { DisclosureGroup as RacDisclosureGroup } from "react-aria-components/DisclosureGroup";

import {
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
} from "react-aria-components/GridList";

import {
  ListBox as AriaListBox,
  ListBoxLoadMoreItem,
} from "react-aria-components/ListBox";
import { GridListLoadMoreItem } from "react-aria-components/GridList";
import { TreeLoadMoreItem } from "react-aria-components/Tree";

import { Menu as AriaMenu, MenuLoadMoreItem } from "react-aria-components/Menu";

import { Meter as AriaMeter } from "react-aria-components/Meter";

import { NumberField as AriaNumberField } from "react-aria-components/NumberField";

import { ProgressBar as AriaProgressBar } from "react-aria-components/ProgressBar";

import {
  RadioButton as AriaRadioButton,
  RadioField as AriaRadioField,
  RadioGroup as AriaRadioGroup,
} from "react-aria-components/RadioGroup";

import { RangeCalendar as RacRangeCalendar } from "react-aria-components/RangeCalendar";

import { SearchField as AriaSearchField } from "react-aria-components/SearchField";

import { Select as AriaSelect } from "react-aria-components/Select";

import { Slider as AriaSlider } from "react-aria-components/Slider";

import {
  SwitchButton as AriaSwitchButton,
  SwitchField as AriaSwitchField,
} from "react-aria-components/Switch";

import { TabPanels as AriaTabPanels } from "react-aria-components/Tabs";

import { Text as AriaText } from "react-aria-components/Text";

import { TextField as AriaTextField } from "react-aria-components/TextField";

import { TimeField as AriaTimeField } from "react-aria-components/TimeField";

import { TreeItem as AriaTreeItem } from "react-aria-components/Tree";

import { Breadcrumbs } from "../../components/Breadcrumbs";
import { ProgressCircle } from "../../components/ProgressCircle";

import { Card } from "../../components/Card";

import { CheckboxIndicatorBox } from "../../components/Checkbox";

import { ColorSwatchPicker } from "../../components/ColorSwatchPicker";

import { DataField } from "../../components/Field";

import {
  renderNecessityIndicator,
  type NecessityIndicator,
} from "../../components/FieldNecessityIndicator";

import {
  FILE_UPLOAD_INPUT_CHILD_TYPES,
  FileUpload,
} from "../../components/FileUpload";

import { Form } from "../../components/Form";

import { GridList } from "../../components/GridList";

import { ListBox } from "../../components/ListBox";

import { TabList, TabPanel, Tabs } from "../../components/Tabs";

import { type TagRowsState } from "../../components/TagGroup";

import { ToggleButton } from "../../components/ToggleButton";

import { ToggleButtonGroup } from "../../components/ToggleButtonGroup";

import { Tree, TreeItem } from "../../components/Tree";

import { FileTriggerIntake } from "../../upload/intakeAdapters";

import { safeParseDateString } from "../../utils/core/dateUtils";

import {
  allowsMultipleExpanded,
  resolveGroupExpandedDisclosureIds,
} from "../../utils/disclosureGroupExpansion";

import type { DefinitionId } from "../document/types";

import { catalogCalendarDurationFits } from "../document/valueType";
import { catalogNumberFormatOptions } from "../document/numberFormatValue";

import {
  catalogItemStartsSelected,
  isCollectionItemOf,
  isCollectionWrapperOf,
} from "../document/collectionItems";
import { resolveStaticItemKey } from "../slotRoles";

import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";
import {
  catalogControlledProps,
  catalogRuntimeStateOf,
  catalogSelectionValue,
  catalogSelectValue,
  EXPANDED_KEYS,
  INPUT_VALUE,
  IS_OPEN,
  IS_SELECTED,
  SELECTED_KEY,
  SELECTED_KEYS,
  VALUE,
  FOCUSED_VALUE,
  type CatalogStateProp,
} from "./runtimeStateProps";

import {
  CATALOG_LABEL_NODE_FIELDS,
  catalogAbsentByValue,
  catalogDisclosureExpanded,
  catalogDisclosureGroupOf,
  catalogFieldNecessityIndicator,
  catalogGroupDisclosures,
  catalogNumberFieldValue,
  catalogPartParent,
  catalogSliderRange,
  catalogTabsSelection,
  catalogToggleGroupItems,
  catalogToggleGroupOf,
  catalogTreeItemExpanded,
  catalogTreeSelectionCheckboxHidden,
  FIELD_HINT_OWNERS,
} from "./presence";
import { CATALOG_EMPTY_STATE_TYPE } from "../nesting/nestingRules";

import { racSlotProps } from "./racSlot";

import { RacSlotScope } from "./racSlotScope";

import { catalogStateChildren, catalogStateFrame } from "./stateFrames";

import {
  CalendarPickerList,
  CalendarPickerSelect,
  ForwardingI18nProvider,
  ForwardingMarker,
  GroupToggleFrame,
  SelfToggleButton,
  TagGroupRun,
  TagListRun,
  ToggleIndicatorPart,
} from "./delegatedDom.components";
import { catalogValueTemplateOf } from "./valueBindings";

/**
 * ADR-248 DOM bindings for the types whose Preview renderer composes from an element context
 * (the Preview's delegating renderers, `renderFacetDeclaration.ts`). Each binding reads the
 * resolved node and its resolved children and renders the same shared/RAC component the Preview
 * renderer renders; D1 stays with RAC, and the class CSS carries the library visuals. Product-path
 * code (Phase 4 uses it as is); a binding per execution id, not per test.
 *
 * `ownsChild` says which direct children have no DOM of their own (their values are read by the
 * parent, or the component composes that part itself); every other child renders through
 * `renderChild` (its own binding, with its `data-catalog-id`).
 */
export interface DelegatedDomInput {
  readonly root: CatalogCompositionRoot;
  readonly node: CatalogConsumerNode;
  /** Authored inline style (library visuals come from the class CSS). */
  readonly style: CSSProperties;
  readonly renderChild: (id: string) => ReactElement;
  /**
   * A running Preview's runtime props (ADR-250): the component's own state (expansion) goes here
   * and comes back as the node's props; absent = a static render of the declared state.
   */
  readonly setRuntimeProps?: (
    recordId: string,
    patch: Readonly<Record<string, unknown>>,
  ) => void;
  /**
   * `useAsyncList.loadMore()` of a running Preview (the session's): a bound collection's end
   * (`*LoadMoreItem` — `onLoadMore`) loads its next page. Absent = a static render.
   */
  readonly loadMore?: (collectionId: string) => void;
  /** Whether a collection pages (its endpoint gives a cursor). */
  readonly pages?: (collectionId: string) => boolean;
  /** The collection the record's text filters on the server · that text's load (`setFilterText`). */
  readonly serverFilterOf?: (recordId: string) => string | undefined;
  readonly setFilterText?: (collectionId: string, filterText: string) => void;
  /** A record's runtime props (another record's — a group reads its children's). */
  readonly runtimeProps?: (
    recordId: string,
  ) => Readonly<Record<string, unknown>> | undefined;
  /**
   * A running Preview's rule handlers of a record this binding draws itself (a Tree's RAC TreeItems
   * are not their own nodes — `withRuntime` never sees them).
   */
  readonly handlersOf?: (
    recordId: string,
  ) => Readonly<Record<string, (...args: unknown[]) => void>>;
}

/**
 * `onInputChange={list.setFilterText}` beside a record's controlled text when its collection is
 * filtered on the server; the collection then shows what the server gave (`defaultFilter` keeps
 * every item — the reference passes `items`, which RAC does not filter).
 */
function serverFiltered(
  input: DelegatedDomInput,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const collectionId = input.serverFilterOf?.(input.node.id);
  const setFilterText = input.setFilterText;
  if (!collectionId || !setFilterText) return props;
  const onInputChange = props.onInputChange as
    ((value: string) => void) | undefined;
  return {
    ...props,
    onInputChange: (value: string) => {
      onInputChange?.(value);
      setFilterText(collectionId, value);
    },
    defaultFilter: () => true,
  };
}

const PICKER_TYPES: ReadonlySet<string> = new Set(["Select", "ComboBox"]);

/** The record whose binding a collection shows: its own, or its picker's (through the Popover). */
function boundOwnerOf(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  const own = root.runtime.graph.getEntry(node.sourceId as never);
  if (own?.kind === "node" && own.binding) return node;
  const popover = root.domInputs.get(node.parentId);
  if (!popover || catalogTypeName(root, popover) !== "Popover")
    return undefined;
  const picker = root.domInputs.get(popover.parentId);
  return picker && PICKER_TYPES.has(catalogTypeName(root, picker))
    ? picker
    : undefined;
}

/** S2's first-load spinner in an empty collection (`loadingState: "loading"` — S2 `centeredWrapper`). */
export function catalogLoadingEmptyState(): ReactElement {
  return createElement(
    "div",
    // (The Canvas loads nothing, so it has no counterpart.)
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      },
    },
    createElement(ProgressCircle, {
      isIndeterminate: true,
      "aria-label": "Loading…",
    }),
  );
}

/**
 * A collection's RAC `renderEmptyState` (2026-10-23 사용자 결정): its IllustratedMessage child —
 * RAC draws it while the collection has no items, as the Canvas does (`catalogHiddenAtRest`). While
 * a bound collection's first load runs, S2's spinner instead (ListView · TreeView · TableView).
 */
export function catalogEmptyState(
  input: DelegatedDomInput,
  loadingState: unknown = input.node.props.loadingState,
): { renderEmptyState?: () => ReactNode } {
  if (loadingState === "loading")
    return { renderEmptyState: catalogLoadingEmptyState };
  const content = children(input).find(
    (child) => catalogTypeName(input.root, child) === CATALOG_EMPTY_STATE_TYPE,
  );
  return content
    ? { renderEmptyState: () => input.renderChild(content.id) }
    : {};
}

/** Whether a collection child is its empty state (rendered by `catalogEmptyState`, not as an item). */
const isEmptyStateChild = (
  child: CatalogConsumerNode,
  root: CatalogCompositionRoot,
) => catalogTypeName(root, child) === CATALOG_EMPTY_STATE_TYPE;

/**
 * The reference's load-more item at a bound collection's end (S2 passes `onLoadMore` and draws it
 * itself): RAC's `*LoadMoreItem` sentinel loads the next page when it is seen —
 * `useAsyncList.loadMore()`, nothing without a cursor — its spinner while `loadingMore`.
 */
export function catalogLoadMoreItem(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  loadMore: ((collectionId: string) => void) | undefined,
  Item: ElementType,
  pages: (collectionId: string) => boolean,
): ReactElement[] {
  if (!loadMore) return [];
  // (A picker's list shows the picker's collection — `Select · ComboBox > Popover > ListBox`, S2
  // Picker · ComboBox `onLoadMore`.)
  const owner = boundOwnerOf(root, node);
  if (!owner) return [];
  const source = root.runtime.graph.getEntry(owner.sourceId as never);
  const binding = source?.kind === "node" ? source.binding : undefined;
  if (!binding) return [];
  const collectionId = binding.collectionId.replace(/^data:collection:/, "");
  if (!pages(collectionId)) return [];
  const isLoading = owner.props.loadingState === "loadingMore";
  return [
    createElement(
      Item,
      {
        key: "__load-more",
        onLoadMore: () => loadMore(collectionId),
        isLoading,
      },
      isLoading
        ? createElement(ProgressCircle, {
            isIndeterminate: true,
            size: "S",
            "aria-label": "Loading more…",
          })
        : null,
    ),
  ];
}

export interface DelegatedDomBinding {
  render(input: DelegatedDomInput): ReactElement;
  /**
   * Renders from its children's values: it renders again when a child changes (or, as a function,
   * when one of the records it names changes).
   */
  watchesChildren?:
    | boolean
    | ((
        node: CatalogConsumerNode,
        root: CatalogCompositionRoot,
      ) => readonly string[]);
  ownsChild?(
    child: CatalogConsumerNode,
    parent: CatalogConsumerNode,
    root: CatalogCompositionRoot,
  ): boolean;
  /**
   * The child has no element of its own but its children still render (a structural layer the
   * component replaces, e.g. Tabs' TabPanels).
   */
  absorbsChild?(
    child: CatalogConsumerNode,
    parent: CatalogConsumerNode,
    root: CatalogCompositionRoot,
  ): boolean;
  /**
   * A deeper descendant the component leaves unrendered in its current state (e.g. Tabs renders
   * only the selected TabPanel). Called for every node on the path below the ancestor.
   */
  ownsDescendant?(
    node: CatalogConsumerNode,
    ancestor: CatalogConsumerNode,
    root: CatalogCompositionRoot,
  ): boolean;
}

// ── resolved-value helpers ─────────────────────────────────────────────
/** Registered type name of a resolved node (definition name). */
export function catalogTypeName(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): string {
  return (
    node.ruleId ??
    root.runtime.graph.getDefinition(node.definitionId as DefinitionId)?.name ??
    ""
  );
}

/**
 * A part node its owner draws (`OWNER_DRAWN_PART_OWNERS`, 2026-10-04): a toggle's indicator (the
 * RAC toggle draws `div.checkbox` · `::before` · `div.indicator`) and a Disclosure's chevron (the
 * shared Disclosure's trigger draws `svg.disclosure-chevron`). The record renders no element —
 * the owner absorbs it, so the delegated renderers never see it as a child.
 */
export function catalogOwnerDrawnPart(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): boolean {
  return OWNER_DRAWN_PART_OWNERS[catalogTypeName(root, node)] !== undefined;
}

export const childrenOf = (
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): CatalogConsumerNode[] =>
  node.children
    .map((id) => root.domInputs.get(id)!)
    .filter((child) => child && !catalogOwnerDrawnPart(root, child));

export const children = (input: DelegatedDomInput): CatalogConsumerNode[] =>
  childrenOf(input.root, input.node);

/**
 * A collection's RAC `defaultSelectedKeys` (2026-10-13): the keys of its items set Selected
 * (`isSelected` — through its sections · TableBody · parent TreeItems) while it selects — the
 * Canvas `catalogCollectionItemSelected` reads the same (`catalogItemStartsSelected`).
 */
export function catalogCollectionSelectedKeys(
  root: CatalogCompositionRoot,
  collection: CatalogConsumerNode,
): string[] {
  const type = catalogTypeName(root, collection);
  const keys: string[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of node.children) {
      const record = root.domInputs.get(child);
      if (!record) continue;
      const childType = catalogTypeName(root, record);
      if (
        isCollectionItemOf(childType, type) &&
        catalogItemStartsSelected(type, collection.props, record.props)
      )
        keys.push(
          // (A Row is not a static collection item: its HTML id, when it has one, is RAC's `id` —
          // `withHtmlId` — so its key.)
          childType === "Row" && record.htmlId
            ? record.htmlId
            : resolveStaticItemKey(
                record.props as Record<string, unknown>,
                record.id,
              ),
        );
      if (isCollectionWrapperOf(childType, type)) visit(record);
    }
  };
  visit(collection);
  return keys;
}

/**
 * ADR-280 Decision 8 — a collection's item keys (the same walk as its Selected keys): every key
 * (to spell out a `"all"` selection) and the disabled ones (RAC refuses to select those).
 */
export function catalogCollectionItemKeys(
  root: CatalogCompositionRoot,
  collection: CatalogConsumerNode,
): { itemKeys: string[]; disabledKeys: string[] } {
  const type = catalogTypeName(root, collection);
  const itemKeys: string[] = [];
  const disabledKeys: string[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const child of node.children) {
      const record = root.domInputs.get(child);
      if (!record) continue;
      const childType = catalogTypeName(root, record);
      if (isCollectionItemOf(childType, type)) {
        const key =
          childType === "Row" && record.htmlId
            ? record.htmlId
            : resolveStaticItemKey(
                record.props as Record<string, unknown>,
                record.id,
              );
        itemKeys.push(key);
        if (record.props.isDisabled === true) disabledKeys.push(key);
      }
      if (isCollectionWrapperOf(childType, type)) visit(record);
    }
  };
  visit(collection);
  return { itemKeys, disabledKeys };
}

/** RAC keeps its first `defaultSelectedKeys`: a changed authored set builds the collection again. */
const selectionKey = (base: string, keys: readonly string[]) =>
  keys.length ? `${base}|selected:${keys.join(",")}` : base;

/**
 * ADR-280 Decision 4 — a node's RAC state in this render: the running Preview's runtime value
 * (a rule's write, the user's change), else what it starts with (`catalogRuntimeStateOf` — the
 * dispatcher reads the same).
 */
const runtimeState = (input: DelegatedDomInput, prop: string): unknown =>
  catalogRuntimeStateOf(
    input.root,
    input.root.domInputs.get(input.node.id) ?? input.node,
    input.runtimeProps?.(input.node.id),
    prop,
    input.runtimeProps,
  );

/** ADR-280 Decision 4 — the state prop to RAC: controlled in a running Preview, else its default. */
const controlled = (
  input: DelegatedDomInput,
  names: CatalogStateProp,
  value: unknown,
  toOverride?: (next: unknown) => unknown,
) =>
  catalogControlledProps(
    input.node.id,
    input.setRuntimeProps,
    names,
    value,
    toOverride,
  );

/**
 * A field an Autocomplete drives (its SearchField · TextField): RAC gives it the text through the
 * Autocomplete's context — a value of its own would beat it (the Autocomplete's `inputValue` is
 * the controlled state, ADR-280).
 */
const inAutocomplete = (input: DelegatedDomInput) => {
  const owner = catalogDomPartParent(input.root, input.node);
  return !!owner && catalogTypeName(input.root, owner) === "Autocomplete";
};

/** ADR-280 — a picker's open state: controlled in a running Preview (RAC's own otherwise). */
const openState = (input: DelegatedDomInput): Record<string, unknown> =>
  input.setRuntimeProps
    ? controlled(input, IS_OPEN, runtimeState(input, "isOpen") === true)
    : {};

/** The element's key: one key while controlled; else (a static render) the start state re-keys. */
const stateKey = (input: DelegatedDomInput, uncontrolledKey: string) =>
  input.setRuntimeProps ? marker(input).key : uncontrolledKey;

export const str = (value: unknown) => String(value || "");

const opt = (value: unknown) =>
  value === undefined || value === null || value === ""
    ? undefined
    : String(value);

const num = (value: unknown) =>
  value === undefined ? undefined : Number(value);

export const bool = (value: unknown) => Boolean(value);

/** RAC `acceptedFileTypes` from the panel's comma-separated text (`image/png, .pdf`). */
const fileTypes = (value: unknown) => {
  const types = String(value ?? "")
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean);
  return types.length ? types : undefined;
};

/** Nearest ancestor Form's field layout props (Preview `resolveInheritedFormFieldProps`). */
function inheritedForm(input: DelegatedDomInput) {
  for (
    let parent = input.root.domInputs.get(input.node.parentId);
    parent;
    parent = input.root.domInputs.get(parent.parentId)
  )
    if (catalogTypeName(input.root, parent) === "Form")
      return {
        labelPosition: parent.props.labelPosition,
        labelAlign: parent.props.labelAlign,
        necessityIndicator: parent.props.necessityIndicator,
      };
  return {} as Record<string, unknown>;
}

/** Common catalog chrome of composition-owned wrappers (`react-aria-{Type}` + data axes). */
/** A Lucide glyph as the DOM draws icons here (`getIconData` — the Canvas `icon_font` reads the same). */
function toastGlyph(iconName: string): ReactElement {
  const data = getIconData(iconName);
  return createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
    },
    ...(data?.paths ?? []).map((d, i) => createElement("path", { key: i, d })),
    ...(data?.circles ?? []).map((c, i) =>
      createElement("circle", { key: `c${i}`, cx: c.cx, cy: c.cy, r: c.r }),
    ),
  );
}

/** S2 `CloseButton staticColor="white"` of a placed Toast (its name in the locale — en · ko). */
function ToastNodeClose({ onClose }: { onClose?: () => void }): ReactElement {
  const { locale } = useLocale();
  return createElement(
    AriaButton,
    {
      className: "toast-close-button",
      "aria-label":
        CATALOG_TOAST_CLOSE_LABELS[locale.split("-")[0] ?? "en"] ??
        CATALOG_TOAST_CLOSE_LABELS.en,
      ...(onClose ? { onPress: onClose } : {}),
    },
    toastGlyph(CATALOG_TOAST_CLOSE_ICON),
  );
}

function chrome(input: DelegatedDomInput, type: string) {
  const rule = input.root.runtime.graph.library.rules.get(type);
  return {
    className: `react-aria-${type}`,
    "data-size": str(input.node.props.size ?? rule?.defaultSize ?? "M"),
    "data-variant": str(
      input.node.props.variant ?? rule?.defaultVariant ?? "default",
    ),
  };
}

/**
 * S2 Card's `TextContext` (`@react-spectrum/s2/src/Card.tsx`): the default slot and the `title` ·
 * `description` slots its Content's Text nodes take (ADR-256 Phase 10 — `racSlot.ts`
 * `S2_SLOT_PROVIDERS.Card` predicts the same table).
 */
const CARD_TEXT_SLOTS = {
  slots: { [DEFAULT_SLOT]: {}, title: {}, description: {} },
};

/** A Card's title text — its `Text[slot=title]` node's, at any depth (the S2 Card's name in a CardView). */
function cardTitleText(input: DelegatedDomInput): string {
  const stack = [...children(input)];
  while (stack.length) {
    const node = stack.shift()!;
    if (
      catalogTypeName(input.root, node) === "Text" &&
      node.props.slot === "title"
    )
      return String(node.props.children ?? "");
    stack.unshift(
      ...node.children
        .map((id) => input.root.domInputs.get(id))
        .filter((child): child is CatalogConsumerNode => !!child),
    );
  }
  return "";
}

// (An item's RAC id is its key — `resolveStaticItemKey`: a new id remounts the item, RAC refuses an
// item whose id changes in place — G5 example 8.)
export const marker = (input: DelegatedDomInput) => {
  const itemKey = resolveStaticItemKey(
    input.node.props as Record<string, unknown>,
    input.node.id,
  );
  return {
    key:
      itemKey === input.node.id ? input.node.id : `${input.node.id}#${itemKey}`,
    "data-catalog-id": input.node.id,
  };
};

export const renderAll = (input: DelegatedDomInput, list = children(input)) =>
  list.map((child) => input.renderChild(child.id));

/**
 * RAC TreeItems of resolved TreeItem records (shared `TreeItem`: title/childItems); their other
 * children render as the item's content.
 */
/**
 * A Tree's expansion keys: the declared list, or one key (an interaction's `expand` capability
 * carries the item key it names).
 */
function treeKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return typeof value === "string" && value ? [value] : [];
}

/** Every TreeItem record a Tree draws (nested items included). */
function treeItemIds(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): string[] {
  return childrenOf(root, node).flatMap((child) =>
    catalogTypeName(root, child) === "TreeItem"
      ? [child.id, ...treeItemIds(root, child)]
      : [],
  );
}

/**
 * ADR-295 후속 — a Tree row's S2 minimum (`manualBoxRules` TreeItem `scaledLengthRef(40)`, rem × `--s2-scale`):
 * the `Tree.css` row states the desktop 40, the row inline its device formula (the touch set × 1.25 — a manual
 * sheet reads no `--catalog-token-*`).
 */
function treeRowDeviceStyle(
  item: CatalogConsumerNode,
): { style: CSSProperties } | Record<string, never> {
  const minHeight = catalogDeviceValueCss(item.visual, "minHeight");
  return minHeight ? { style: { minHeight } } : {};
}

function treeItemElements(
  input: DelegatedDomInput,
  list: readonly CatalogConsumerNode[],
): ReactElement[] {
  return list.map((item) => {
    const kids = childrenOf(input.root, item);
    const childItems = kids.filter(
      (kid) => catalogTypeName(input.root, kid) === "TreeItem",
    );
    const others = kids.filter(
      (kid) => catalogTypeName(input.root, kid) !== "TreeItem",
    );
    const id = resolveStaticItemKey(
      item.props as Record<string, unknown>,
      item.id,
    );
    // ADR-256 Phase 5h — an item whose row is its `TreeItemContent` is the reference's RAC
    // `TreeItem`: the content node (RAC `TreeItemContent` — its chevron `Button`, text …) then the
    // child items.
    const content = others.find(
      (kid) => catalogTypeName(input.root, kid) === "TreeItemContent",
    );
    if (content) {
      const text = childrenOf(input.root, content).find(
        (kid) => catalogTypeName(input.root, kid) === "Text",
      );
      return createElement(
        AriaTreeItem as ElementType,
        {
          key: id === item.id ? item.id : `${item.id}#${id}`,
          "data-catalog-id": item.id,
          ...(item.id === input.node.id
            ? { style: input.style }
            : treeRowDeviceStyle(item)),
          id,
          textValue: text
            ? resolveTextSourceText(
                "Text",
                text.props as Record<string, unknown>,
              )
            : "",
          isDisabled: item.props.isDisabled === true,
          // ADR-259 Phase 1: RAC's item link (`data-href` · `data-target` · `data-rel`).
          ...catalogItemLinkProps(item.props),
          // (The item's own rules — its `onAction` · press · hover.)
          ...input.handlersOf?.(item.id),
        },
        ...others.map((kid) => input.renderChild(kid.id)),
        ...treeItemElements(input, childItems),
      );
    }
    const title = others.length
      ? ""
      : resolveTextSourceText(
          "TreeItem",
          item.props as Record<string, unknown>,
        );
    const label = others.find(
      (kid) => catalogTypeName(input.root, kid) === "Text",
    );
    return createElement(TreeItem as ElementType, {
      key: id === item.id ? item.id : `${item.id}#${id}`,
      "data-catalog-id": item.id,
      // A standalone item is the node itself: its authored inline style (the Tree's items take none —
      //   but their S2 row minimum's device formula, `treeRowDeviceStyle`).
      ...(item.id === input.node.id
        ? { style: input.style }
        : treeRowDeviceStyle(item)),
      id,
      title,
      textValue: label
        ? resolveTextSourceText("Text", label.props as Record<string, unknown>)
        : title,
      hasChildren: childItems.length > 0,
      showInfoButton: false,
      isDisabled: item.props.isDisabled === true,
      ...catalogItemLinkProps(item.props),
      ...input.handlersOf?.(item.id),
      children: others.map((kid) => input.renderChild(kid.id)),
      childItems: childItems.length
        ? treeItemElements(input, childItems)
        : undefined,
    });
  });
}

const ownsAll = () => true;

/** A Menu's RAC collection children (ADR-256 Phase 5g: + SubmenuTrigger). */
/** The triggers whose Popover holds a Menu (RAC `MenuTrigger` · `SubmenuTrigger`). */
const MENU_TRIGGER_TYPES: ReadonlySet<string> = new Set([
  "MenuTrigger",
  "SubmenuTrigger",
]);

const MENU_CHILD_TYPES: ReadonlySet<string> = new Set([
  "MenuItem",
  "SubmenuTrigger",
  "MenuSection",
  "Separator",
]);

const container =
  (
    tag: string,
    extra?: (input: DelegatedDomInput) => Record<string, unknown>,
  ) =>
  (input: DelegatedDomInput) =>
    createElement(
      tag,
      { ...marker(input), ...extra?.(input), style: input.style },
      ...renderAll(input),
    );

export { CATALOG_LABEL_NODE_FIELDS };

/** The Label node of a field that draws its Label from it; `undefined` = the field composes it. */
export function catalogFieldLabelNode(
  root: CatalogCompositionRoot,
  field: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  if (CATALOG_LABEL_NODE_FIELDS[field.bindingId ?? ""] === undefined)
    return undefined;
  return childrenOf(root, field).find(
    (child) => catalogTypeName(root, child) === "Label",
  );
}

/** The necessity indicator a field appends to its Label node (`catalogFieldNecessityIndicator`). */
export function catalogFieldLabelNecessity(
  root: CatalogCompositionRoot,
  label: CatalogConsumerNode,
): ReactNode {
  const field = catalogDomPartParent(root, label);
  if (
    !field ||
    CATALOG_LABEL_NODE_FIELDS[field.bindingId ?? ""] !== "necessity"
  )
    return null;
  return renderNecessityIndicator(
    catalogFieldNecessityIndicator(
      field,
      (record) => root.domInputs.get(record.parentId),
      (record) => catalogTypeName(root, record),
    ) as NecessityIndicator | undefined,
    bool(field.props.isRequired),
  );
}

/**
 * The hint part nodes (`Description` · `FieldError`) of a field that draws them from its nodes
 * (`FIELD_HINT_OWNERS`): instances of the part origins, each drawn by its own binding inside the
 * field's RAC context.
 */
export function catalogFieldHintNodes(
  root: CatalogCompositionRoot,
  field: CatalogConsumerNode,
): { description?: CatalogConsumerNode; error?: CatalogConsumerNode } {
  if (!FIELD_HINT_OWNERS.has(catalogTypeName(root, field))) return {};
  const kids = childrenOf(root, field);
  const find = (type: string) =>
    kids.find((child) => catalogTypeName(root, child) === type);
  return { description: find("Description"), error: find("FieldError") };
}

/**
 * Fields whose control is their Input node (ADR-253): an instance of the Input origin, drawn by
 * its own binding inside the field's RAC context (a RAC `Input`; the `<textarea>` of a TextArea).
 */
export const CATALOG_INPUT_NODE_FIELDS: ReadonlySet<string> = new Set([
  "textfield",
  "textarea",
  "colorfield",
  "numberfield",
  "combobox",
  "searchfield",
]);

/**
 * Fields whose control is a wrapper node (a RAC `Group` — ADR-256 Phase 6b, `FIELD_CONTROL_GROUP_HOSTS`)
 * around part nodes (ADR-253): each part is drawn by its own binding inside the field's RAC
 * context, in the wrapper's order.
 */
export const CATALOG_WRAPPED_CONTROL_FIELDS: ReadonlySet<string> = new Set([
  "numberfield",
  "combobox",
  // ADR-259 Phase 2: while a prefix wraps their Input in a Group (none without one).
  "textfield",
  "textarea",
  "colorfield",
  // (Not searchfield: its parts are its own children — ADR-256 G5 example 5.)
  "datepicker",
  "daterangepicker",
]);

/**
 * The control part nodes of a field: those inside its control wrapper (`[]` = the field composes
 * them).
 */
export function catalogFieldControlNodes(
  root: CatalogCompositionRoot,
  field: CatalogConsumerNode,
): CatalogConsumerNode[] {
  if (!CATALOG_WRAPPED_CONTROL_FIELDS.has(field.bindingId ?? "")) return [];
  const wrapper = childrenOf(root, field).find(
    (child) => catalogTypeName(root, child) === "Group",
  );
  return wrapper ? childrenOf(root, wrapper) : [];
}

/** Pickers whose ListBox takes their RAC `ListBoxContext` (ADR-253 Phase 4 · ADR-256 Phase 6c · 6d). */
const LIST_PICKER_BINDINGS: ReadonlySet<string> = new Set([
  "select",
  "combobox",
]);

/**
 * The picker whose RAC `ListBoxContext` a ListBox node takes (its name, selection and focus — D1):
 * a ListBox in a Select · ComboBox — in its Popover, the reference's `Popover > ListBox` (ADR-256
 * Phase 6c · 6d), or its direct child (RAC's context reaches it there too).
 */
export function catalogListPicker(
  root: CatalogCompositionRoot,
  list: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  return pickerHost(root, list, LIST_PICKER_BINDINGS);
}

/** Pickers whose Calendar · RangeCalendar takes their RAC calendar context (ADR-256 Phase 6e). */
const CALENDAR_PICKER_BINDINGS: ReadonlySet<string> = new Set([
  "datepicker",
  "daterangepicker",
]);

/**
 * The picker whose RAC calendar context a Calendar · RangeCalendar node takes (its value, focus and
 * paging — D1): one in a DatePicker · DateRangePicker — in its Popover, the reference's `Popover >
 * Calendar` (ADR-256 Phase 6e), or its direct child (RAC's context reaches it there too).
 */
export function catalogCalendarPicker(
  root: CatalogCompositionRoot,
  calendar: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  return pickerHost(root, calendar, CALENDAR_PICKER_BINDINGS);
}

/**
 * A node's picker of `hosts`: its parent, or the parent of the Popover it is in — layout frames
 * between skipped (`catalogDomPartParent`: a frame keeps a part in its picker's RAC context).
 */
function pickerHost(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  hosts: ReadonlySet<string>,
): CatalogConsumerNode | undefined {
  const parent = catalogDomPartParent(root, node);
  if (!parent) return undefined;
  const host =
    catalogTypeName(root, parent) === "Popover"
      ? catalogDomPartParent(root, parent)
      : parent;
  return hosts.has(host?.bindingId ?? "") ? host : undefined;
}

/**
 * A part node's parent with the layout frames it sits in skipped (`catalogPartParent` — ADR-256
 * G2: a frame around a field's parts keeps them in the field's RAC context).
 */
export function catalogDomPartParent(
  root: CatalogCompositionRoot,
  part: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  return catalogPartParent(
    part,
    (id) => root.domInputs.get(id),
    (record) => catalogTypeName(root, record),
  );
}

/**
 * The field a part node belongs to: its parent, or the parent of the control wrapper it is in
 * (layout frames skipped — `catalogDomPartParent`).
 */
export function catalogPartField(
  root: CatalogCompositionRoot,
  part: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  const parent = catalogDomPartParent(root, part);
  if (!parent || parent.bindingId !== "group") return parent;
  const field = catalogDomPartParent(root, parent);
  return field && CATALOG_WRAPPED_CONTROL_FIELDS.has(field.bindingId ?? "")
    ? field
    : parent;
}

/**
 * Date fields whose control is their DateInput node (ADR-253): an instance of the DateInput
 * origin, drawn by its own binding inside the field's RAC context (a RAC `DateInput` and its
 * segments).
 */
export const CATALOG_DATE_INPUT_NODE_FIELDS: ReadonlySet<string> = new Set([
  "datefield",
  "timefield",
  "datepicker",
  "daterangepicker",
]);

/**
 * The Input (a date field's DateInput) node of a field that draws its control from it;
 * `undefined` = the field composes it.
 */
export function catalogFieldInputNode(
  root: CatalogCompositionRoot,
  field: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  const type = CATALOG_INPUT_NODE_FIELDS.has(field.bindingId ?? "")
    ? "Input"
    : CATALOG_DATE_INPUT_NODE_FIELDS.has(field.bindingId ?? "")
      ? "DateInput"
      : undefined;
  if (!type) return undefined;
  return [
    ...childrenOf(root, field),
    ...catalogFieldControlNodes(root, field),
  ].find((child) => catalogTypeName(root, child) === type);
}

/**
 * A field's `isInvalid` for RAC: `true` while the document says so, else left unset. An explicit
 * `false` would fix the field as valid — RAC's own validation (required · type · pattern, shown
 * after the value is committed) could never show its error (ADR-253 Decision 5).
 */
export const authoredInvalid = (
  props: CatalogConsumerNode["props"],
): true | undefined => (props.isInvalid === true ? true : undefined);

function fieldBase(input: DelegatedDomInput) {
  const props = input.node.props;
  const form = inheritedForm(input);
  return {
    ...marker(input),
    style: input.style,
    isDisabled: bool(props.isDisabled),
    isRequired: bool(props.isRequired),
    isReadOnly: bool(props.isReadOnly),
    isInvalid: authoredInvalid(props),
    isQuiet: bool(props.isQuiet),
    necessityIndicator: props.necessityIndicator ?? form.necessityIndicator,
    labelPosition: props.labelPosition ?? form.labelPosition ?? "top",
    labelAlign: props.labelAlign ?? form.labelAlign,
    name: opt(props.name),
    autoFocus: bool(props.autoFocus),
  };
}

const inputHints = (props: CatalogConsumerNode["props"]) => ({
  autoComplete: opt(props.autoComplete),
  autoCorrect: opt(props.autoCorrect),
  inputMode: opt(props.inputMode),
  enterKeyHint: opt(props.enterKeyHint),
  spellCheck: opt(props.spellCheck),
});

function withI18n(
  element: ReactElement,
  locale: unknown,
  calendar?: unknown,
): ReactElement {
  if (!locale && !calendar) return element;
  // (A calendar system alone extends the environment's locale — RAC's default.)
  const base = String(locale || globalThis.navigator?.language || "en-US");
  const tag = calendar ? `${base}-u-ca-${String(calendar)}` : base;
  // (ADR-280 Decision 5 — the provider forwards the rules' handlers to the field.)
  return createElement(ForwardingI18nProvider, {
    key: element.key,
    locale: tag,
    element,
  });
}

/**
 * ADR-256 Decision 2 (Phase 2) — a field draws its node tree: the RAC field component and its
 * children in order, each by its own binding inside the field's RAC context (Label with the
 * necessity indicator · Input / DateInput · Description · FieldError, and any free child the
 * author put in). The field gives RAC only its own values: state, validation, value; the label
 * layout and quiet are data attributes its sheet reads. (The shared field components composed
 * the same root from props — they are no longer on the Preview path.)
 */
/**
 * A toggle's RAC button (ADR-256 Phase 3 — `CheckboxButton` · `SwitchButton`): its children in
 * order; the indicator node's place is the element RAC's state draws (a part its owner draws — the
 * node has no element of its own).
 */
type ToggleRenderProps = { isSelected: boolean; isIndeterminate?: boolean };

type ToggleIndicators = Readonly<
  Record<string, (key: string, state: ToggleRenderProps) => ReactElement>
>;

/**
 * The button's render state and indicator drawing, for an indicator node the author put in a layout
 * frame inside the button (RAC's render props reach only the button's direct children; the frame
 * passes this context through as RAC passes its own).
 */
export const ToggleIndicatorContext = createContext<{
  readonly state: ToggleRenderProps;
  readonly indicators: ToggleIndicators;
} | null>(null);

/**
 * The element a toggle indicator node stands for when it is not its button's direct child (inside a
 * layout frame in the button — ADR-256 Phase 3 review m1): the button's indicator, by its state.
 * Other parts their owner draws have no element here.
 */
export function catalogToggleIndicatorElement(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): ReactElement | null {
  const type = catalogTypeName(root, node);
  return OWNER_DRAWN_PART_HOSTS[
    catalogTypeName(root, catalogDomPartParent(root, node) ?? node)
  ] && OWNER_DRAWN_PART_OWNERS[type]
    ? createElement(ToggleIndicatorPart, {
        key: node.id,
        type,
        nodeKey: node.id,
      })
    : null;
}

/**
 * RAC 1.22 splits a toggle into `CheckboxField` · `SwitchField` (the toggle's props) and its
 * `*Button` (the `label`) — hover is the button's (`CheckboxButtonProps extends HoverEvents`;
 * `CheckboxFieldProps` has none — installed `Checkbox.mjs` `useHover({...props})` in the button).
 * A rule on the Checkbox · Switch node (the Field) reaches the button here.
 */
function toggleHoverHandlers(
  input: DelegatedDomInput,
): Record<string, (...args: unknown[]) => void> {
  const owner = input.root.domInputs.get(input.node.parentId);
  if (!owner || !TOGGLE_FIELD_TYPES.has(catalogTypeName(input.root, owner)))
    return {};
  return Object.fromEntries(
    Object.entries(input.handlersOf?.(owner.id) ?? {}).filter(([name]) =>
      name.startsWith("onHover"),
    ),
  );
}
const TOGGLE_FIELD_TYPES: ReadonlySet<string> = new Set(["Checkbox", "Switch"]);

function toggleButton(
  component: ElementType,
  className: string,
  indicators: ToggleIndicators,
): DelegatedDomBinding {
  return {
    // (The toggle's hover rules are drawn here — a rule added on the toggle renders it again.)
    watchesChildren: (node) => [node.parentId],
    render: (input) =>
      createElement(component, {
        ...marker(input),
        ...toggleHoverHandlers(input),
        style: input.style,
        className,
        children: (state: ToggleRenderProps) =>
          // (Its render props are the state frame of the `showWhen` nodes inside — Decision 7.)
          catalogStateFrame(
            input.node.id,
            input.node.id,
            state,
            createElement(
              ToggleIndicatorContext.Provider,
              { value: { state, indicators } },
              ...input.node.children.map((id) => {
                const child = input.root.domInputs.get(id);
                const indicator = child
                  ? indicators[catalogTypeName(input.root, child)]
                  : undefined;
                return indicator ? indicator(id, state) : input.renderChild(id);
              }),
            ),
          ),
      }),
  };
}

/** A group's items and the containers between — a change to either can move its value. */
const groupWatched = (
  group: CatalogConsumerNode,
  root: CatalogCompositionRoot,
  itemType: string,
) => {
  const { items, containers } = catalogToggleGroupItems(
    group,
    itemType,
    domGet(root),
    (record) => catalogTypeName(root, record),
  );
  return [...containers, ...items].map((record) => record.id);
};

/** A grouped Checkbox's RAC value: its own `value`, else its record id (RAC needs a key). */
const groupItemValue = (box: CatalogConsumerNode): string =>
  str(box.props.value) || box.id;

/** The group a toggle's DOM input belongs to (`catalogToggleGroupOf` over the DOM inputs). */
const domToggleGroupOf = (
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
) =>
  catalogToggleGroupOf(node, domGet(root), (record) =>
    catalogTypeName(root, record),
  );

const domGet = (root: CatalogCompositionRoot) => (id: string) =>
  root.domInputs.get(id);

/** ADR-256 Phase 9 — whether a Select record is a calendar month · year picker's child. */
function isCalendarPicker(
  input: DelegatedDomInput,
  select: CatalogConsumerNode,
): boolean {
  const parent = input.root.domInputs.get(select.parentId);
  const type = parent && catalogTypeName(input.root, parent);
  return type === "CalendarMonthPicker" || type === "CalendarYearPicker";
}

/**
 * ADR-256 Phase 9 — a calendar picker's Select takes RAC's render props (the reference's
 * `<Select {...props}>`): its name, the focused month · year key and the move.
 */
function calendarPickerSelect(
  binding: DelegatedDomBinding,
): DelegatedDomBinding {
  return {
    ...binding,
    render: (input) => {
      const element = binding.render(input);
      return isCalendarPicker(input, input.node)
        ? createElement(CalendarPickerSelect, { key: input.node.id, element })
        : element;
    },
  };
}

function nodeTreeField(
  component: ElementType,
  type: string,
  own: (props: CatalogConsumerNode["props"]) => Record<string, unknown>,
  i18n?: (props: CatalogConsumerNode["props"]) => [unknown, unknown?],
  defaultLabelAlign?: string,
  /** ADR-280 — RAC's changed value as the record's runtime `value` (the document's form). */
  toOverride: (next: unknown) => unknown = (next) => next,
  /** ADR-280 — the field's other RAC states (a picker's selection · open state · input text). */
  states?: (input: DelegatedDomInput) => Record<string, unknown>,
): DelegatedDomBinding {
  return {
    render: (input) => {
      const props = input.node.props;
      const {
        necessityIndicator: _necessity,
        labelPosition,
        labelAlign,
        isQuiet,
        ...base
      } = fieldBase(input);
      const ownProps = own(props);
      const element = createElement(
        component,
        {
          ...base,
          className: `react-aria-${type}`,
          "data-size": str(props.size) || "M",
          "data-label-position": labelPosition,
          "data-label-align": labelAlign ?? defaultLabelAlign,
          "data-quiet": isQuiet ? "true" : undefined,
          ...ownProps,
          // A static render: RAC's value is the run state — `defaultValue`; a document edit of the
          // value starts it again, as the Slider's does. A running Preview: controlled from the
          // first render (always a defined value — `null` for none) and the change goes to the
          // record's runtime `value` (ADR-280 Decision 4).
          ...("defaultValue" in ownProps
            ? input.setRuntimeProps && !inAutocomplete(input)
              ? {
                  defaultValue: undefined,
                  ...controlled(
                    input,
                    VALUE,
                    ownProps.defaultValue ?? null,
                    toOverride,
                  ),
                }
              : { key: `${input.node.id}:${String(ownProps.defaultValue)}` }
            : {}),
          ...states?.(input),
        },
        ...renderAll(input),
      );
      if (!i18n) return element;
      const [locale, calendar] = i18n(props);
      return withI18n(element, locale, calendar);
    },
  };
}

/** A whole count ≥ 1 (RAC `weeksInMonth`), else unset. */
const wholeCount = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1
    ? value
    : undefined;

/** S2 `firstDayOfWeek` — one of RAC's day names, else unset (the locale's own first day). */
const DAYS_OF_WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const firstDayOfWeek = (value: unknown) =>
  typeof value === "string" && DAYS_OF_WEEK.includes(value)
    ? (value as "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat")
    : undefined;

/**
 * A placeholder date the document wrote as text (`2030-03-15`), at the field's granularity: RAC
 * throws on a date-only value at a time granularity (`Invalid granularity minute for value …` —
 * the Preview went blank), so a time field's placeholder is that day at midnight.
 */
const placeholderDate = (value: unknown, granularity: unknown) => {
  const date =
    typeof value === "string" ? safeParseDateString(value) : undefined;
  if (!date) return undefined;
  return ["hour", "minute", "second"].includes(String(granularity))
    ? toCalendarDateTime(date)
    : date;
};

/** A date prop the document wrote as text (`2026-10-08`), parsed for RAC. */
const dateValue = (value: unknown) =>
  typeof value === "string" ? safeParseDateString(value) : value;

/** ADR-280 — a RAC date · time value as the record's runtime `value` (its ISO text). */
const dateToOverride = (next: unknown) => (next == null ? null : String(next));

/** A date range as RAC takes it (`{ start, end }` of dates), else none (`null`). */
function dateRangeValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const { start, end } = value as { start?: unknown; end?: unknown };
  const from = dateValue(start);
  const to = dateValue(end);
  return from && to ? { start: from, end: to } : null;
}

const dateRangeToOverride = (next: unknown) => {
  if (!next || typeof next !== "object") return null;
  const { start, end } = next as { start?: unknown; end?: unknown };
  return start && end ? { start: String(start), end: String(end) } : null;
};

/** A DatePicker's · DateRangePicker's own RAC props (the parts take theirs from its context). */
const datePickerProps = (props: CatalogConsumerNode["props"]) => ({
  granularity: ["day", "hour", "minute", "second"].includes(
    String(props.granularity),
  )
    ? props.granularity
    : "day",
  minValue: dateValue(props.minValue),
  maxValue: dateValue(props.maxValue),
  hideTimeZone: props.hideTimeZone !== false,
  shouldForceLeadingZeros: props.shouldForceLeadingZeros !== false,
  shouldCloseOnSelect: props.shouldCloseOnSelect !== false,
  pageBehavior: props.pageBehavior === "single" ? "single" : undefined,
  // (RAC hands it to the picker's calendar — `calendarProps`.)
  firstDayOfWeek: firstDayOfWeek(props.firstDayOfWeek),
  // No value of its own: the date its calendar opens on (as DateField's).
  placeholderValue: placeholderDate(props.placeholderValue, props.granularity),
  validationBehavior: props.validationBehavior || undefined,
});

/** A time prop the document wrote as text (`HH:MM(:SS)`), parsed for RAC. */
function timeValue(value: unknown): unknown {
  if (typeof value !== "string") return value || undefined;
  const [hour, minute, second] = value
    .split(":")
    .map((part) => parseInt(part, 10));
  return hour !== undefined &&
    minute !== undefined &&
    !isNaN(hour) &&
    !isNaN(minute)
    ? new Time(hour, minute, second && !isNaN(second) ? second : 0)
    : undefined;
}

/**
 * Marker for components that render no DOM of their own or drop DOM props (FileTrigger renders
 * a hidden input + press responder; DataField takes no rest props): the Preview's delegating
 * wrapper form, `display: contents`, so it adds no box.
 */
const markerWrap = (input: DelegatedDomInput, element: ReactElement) => {
  const { key, ...markerProps } = marker(input);
  // (ADR-280 Decision 5 — the rules' handlers reach the component, not the marker `div`.)
  return createElement(ForwardingMarker, {
    key,
    markerProps: { ...markerProps, style: { display: "contents" } },
    element,
  });
};

/** What a TagGroup gives its TagList: its `maxRows` · size · label position and its removed tags. */
export const TagGroupRunContext = createContext<{
  readonly maxRows: number | undefined;
  readonly size: string;
  readonly labelPosition: string;
  readonly removed: ReadonlySet<Key>;
  /** (Held here: RAC also renders the TagList in its hidden collection copy — `useTagMaxRows`.) */
  readonly rows: TagRowsState;
} | null>(null);

/** A Tag node's RAC key (as its binding gives it). */
export const tagKey = (tag: CatalogConsumerNode) =>
  resolveStaticItemKey(tag.props as Record<string, unknown>, tag.id);

/**
 * Whether a Label node the TagGroup's RAC label slot takes is there: a Label in its tree with text
 * (`catalogAbsentByValue` renders none), reached through layout containers (Group · frame — RAC's
 * Group leaves the `LabelContext` as it is). RAC then names the grid by it (`aria-labelledby`).
 */
const LABEL_PASS_THROUGH_TYPES = new Set(["Group", "frame", "FieldLabel"]);

export function tagGroupLabelled(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): boolean {
  return childrenOf(root, node).some((child) => {
    const type = catalogTypeName(root, child);
    if (type === "Label") return !catalogAbsentByValue(child);
    return LABEL_PASS_THROUGH_TYPES.has(type) && tagGroupLabelled(root, child);
  });
}

/** A Tag's chip text (its label Texts) — what the maxRows mirror measures. */
export const tagChipText = (
  root: CatalogCompositionRoot,
  tag: CatalogConsumerNode,
) =>
  childrenOf(root, tag)
    .filter((kid) => catalogTypeName(root, kid) === "Text")
    .map((kid) => str(kid.props.children))
    .join(" ");

/** A TagGroup's Tag records (in its TagList — RAC's collection). */
export const tagGroupTags = (
  root: CatalogCompositionRoot,
  group: CatalogConsumerNode,
): CatalogConsumerNode[] =>
  [...root.domInputs.values()].filter(
    (record) =>
      catalogTypeName(root, record) === "Tag" &&
      catalogDomPartParent(root, record)?.parentId === group.id,
  );

/** The author's DOM attributes `withHtmlId` puts on a renderer's element (id · class · aria-label). */
export type AuthoredDomAttributes = Readonly<Record<string, unknown>>;

// ── bindings ───────────────────────────────────────────────────────────
/** A ToggleButtonGroup's ToggleButtons (any depth — RAC context) and the containers between. */
function groupToggleButtons(
  group: CatalogConsumerNode,
  root: CatalogCompositionRoot,
): { buttons: CatalogConsumerNode[]; frames: CatalogConsumerNode[] } {
  const { items, containers } = catalogToggleGroupItems(
    group,
    "ToggleButton",
    domGet(root),
    (record) => catalogTypeName(root, record),
  );
  return { buttons: items, frames: containers };
}

/** A DisclosureGroup's Disclosures (any depth — RAC context) over the DOM inputs. */
const groupDisclosures = (
  group: CatalogConsumerNode,
  root: CatalogCompositionRoot,
) =>
  catalogGroupDisclosures(
    group,
    (id) => root.domInputs.get(id),
    (record) => catalogTypeName(root, record),
  );

const DELEGATED: Record<string, DelegatedDomBinding> = {
  // ADR-256 Phase 5e-2: Tabs draws its node tree — the reference `Tabs > (… TabList …) + TabPanels >
  // TabPanel`, with free content anywhere (a frame around the TabList, buttons beside it). Each part
  // renders itself in RAC's Tabs context (`tablist` · `tabpanels` · `tabpanel`).
  tabs: {
    // RAC renders only the selected TabPanel.
    ownsDescendant: (node, ancestor, root) => {
      if (catalogTypeName(root, node) !== "TabPanel") return false;
      const { pairs, selectedKey } = tabsModel(root, ancestor);
      return pairs.some(
        (pair) => pair.panel?.id === node.id && pair.key !== selectedKey,
      );
    },
    render: (input) => {
      const props = input.node.props;
      // The Tabs' key, else its first Selected · enabled Tab, else the first enabled one — RAC's
      // own default (`catalogTabsSelection`, the Canvas reads the same).
      const selectedKey = runtimeState(input, "selectedKey");
      return createElement(
        Tabs as ElementType,
        {
          ...marker(input),
          key: stateKey(input, `${input.node.id}:${str(selectedKey)}`),
          style: input.style,
          ...controlled(input, SELECTED_KEY, selectedKey),
          density: props.density || "regular",
          orientation: props.orientation || "horizontal",
          size: props.size || "M",
          isDisabled: bool(props.isDisabled),
        },
        ...renderAll(input),
      );
    },
  },
  tablist: {
    render: (input) => {
      // (Its size · density are the Tabs' — the resolver carries them, `CATALOG_SIZE_PROPAGATION`
      // · `CATALOG_DENSITY_PROPAGATION_OWNER`, the value the Canvas draws.)
      const props = input.node.props;
      return createElement(
        TabList as ElementType,
        {
          ...marker(input),
          style: input.style,
          // (The list's accessible name — RAC requires one; the author's `aria-label`.)
          ...(input.node.ariaLabel
            ? { "aria-label": input.node.ariaLabel }
            : {}),
          density: props.density || "regular",
          size: props.size || "M",
          // (The selected Tab's bar is its SelectionIndicator node — the sheet's `::before` bar stays
          // off. The old `showIndicator` prop is gone, 2026-10-09.)
          showIndicator: true,
        },
        ...renderAll(input),
      );
    },
  },
  tabpanels: {
    render: (input) =>
      createElement(
        AriaTabPanels as ElementType,
        { ...marker(input), style: input.style },
        ...renderAll(input),
      ),
  },
  tabpanel: {
    render: (input) => {
      // (Its Tab's key — the pairing `catalogTabsSelection` makes.)
      const tabs = tabsAncestor(input.root, input.node);
      const key = tabs
        ? tabsModel(input.root, tabs).pairs.find(
            (pair) => pair.panel?.id === input.node.id,
          )?.key
        : undefined;
      return createElement(
        TabPanel as ElementType,
        { ...marker(input), style: input.style, id: key ?? input.node.id },
        ...renderAll(input),
      );
    },
  },
  // Codex Round 20 H1: the reference's tree — `TagGroup > Label + TagList > Tag… +
  // Text[description] + Text[errorMessage]` and free content, each child its own node in the
  // author's order (a deleted Label is not drawn again from the `label` prop). Its selection is
  // RAC's (Preview run state — M1); removed tags leave the list (`TagGroupRun`).
  taggroup: {
    // (Its selection is its Tags' Selected — a Tag's change reaches the group's keys.)
    watchesChildren: (node, root) =>
      tagGroupTags(root, node).flatMap((tag) => [tag.id, tag.parentId]),
    render: (input) => createElement(TagGroupRun, { input }),
  },
  // The TagList node is the chip box (`div.tag-list-wrapper` — RAC's TagList is `display: contents`)
  // with the TagGroup's `maxRows` (a measuring mirror · Show all).
  taglist: {
    render: (input) => createElement(TagListRun, { input }),
  },
  listbox: {
    ownsChild: (child, _parent, root) =>
      !["ListBoxItem", "ListBoxSection"].includes(
        catalogTypeName(root, child),
      ) && !isEmptyStateChild(child, root),
    render: (input) => {
      const props = input.node.props;
      // A picker's list (ADR-253 Phase 4): RAC's Select · ComboBox own its name, selection and
      // focus (their context), and its sheet reads the picker's size.
      const picker = catalogListPicker(input.root, input.node);
      const inPicker = !!picker;
      // ADR-256 Phase 9: a calendar month · year picker's list — RAC makes the items (the
      // picker's render props); the ListBoxItem node is the template drawn once per item.
      if (picker && isCalendarPicker(input, picker)) {
        const item = children(input).find(
          (child) => catalogTypeName(input.root, child) === "ListBoxItem",
        );
        return createElement(CalendarPickerList, {
          key: input.node.id,
          listProps: {
            "data-catalog-id": input.node.id,
            style: input.style,
            className: "react-aria-ListBox",
            "data-size": str(picker.props.size || "M"),
          },
          itemId: item?.id,
          // (The item's own text — the reference's `{item.formatted}` — or its child nodes.)
          itemText: item
            ? String(
                catalogValueTemplateOf(item)?.props?.children ??
                  item.props.children ??
                  "",
              )
            : "{formatted}",
          renderItemChildren: () =>
            (item?.children ?? []).map((id) => input.renderChild(id)),
        });
      }
      // (RAC's ListBox itself, as the reference's pickers compose it: the shared ListBox's
      // variant marks are the standalone list's.)
      const selected = inPicker
        ? []
        : (runtimeState(input, "selectedKeys") as string[] | "all");
      return createElement(
        (inPicker ? AriaListBox : ListBox) as ElementType,
        inPicker
          ? {
              ...marker(input),
              style: input.style,
              className: "react-aria-ListBox",
              "data-size": str(picker!.props.size || "M"),
              ...catalogEmptyState(input),
            }
          : {
              ...marker(input),
              key: stateKey(
                input,
                selectionKey(marker(input).key, selected as string[]),
              ),
              style: input.style,
              "aria-label": str(props.label || "List"),
              // (No variant axis — S2 · RAC · v3 have none, 2026-10-12. The shared ListBox's own
              // default "primary" would turn on its old `[data-variant=primary]` sheet.)
              variant: "default",
              orientation: props.orientation || "vertical",
              selectionMode: props.selectionMode ?? "none",
              disallowEmptySelection: bool(props.disallowEmptySelection),
              autoFocus: bool(props.autoFocus),
              // (Its items set Selected — the item's edit surface, 2026-10-13; in a running
              // Preview the selection is controlled — ADR-280.)
              ...controlled(
                input,
                SELECTED_KEYS,
                selected,
                catalogSelectionValue,
              ),
              ...catalogEmptyState(input),
            },
        ...renderAll(
          input,
          children(input).filter((child) =>
            ["ListBoxItem", "ListBoxSection"].includes(
              catalogTypeName(input.root, child),
            ),
          ),
        ),
        ...catalogLoadMoreItem(
          input.root,
          input.node,
          input.loadMore,
          ListBoxLoadMoreItem,
          (id) => input.pages?.(id) ?? false,
        ),
      );
    },
  },
  gridlist: {
    ownsChild: (child, _parent, root) =>
      !["GridListItem", "GridListSection"].includes(
        catalogTypeName(root, child),
      ) && !isEmptyStateChild(child, root),
    render: (input) => {
      const props = input.node.props;
      const selected = runtimeState(input, "selectedKeys") as string[] | "all";
      const waterfall = catalogWaterfallLayout(input.node);
      return createElement(
        (waterfall ? CatalogWaterfallGrid : GridList) as ElementType,
        {
          ...(waterfall ? { as: GridList } : {}),
          ...marker(input),
          key: stateKey(
            input,
            selectionKey(marker(input).key, selected as string[]),
          ),
          style: input.style,
          "aria-label": str(props.label || "Grid List"),
          variant: props.variant || "default",
          isQuiet: bool(props.isQuiet),
          // (RAC GridList lays out `stack` · `grid`; a waterfall is a grid whose rows are placed —
          // `CatalogWaterfallGrid`, RAC's `WaterfallLayout` keeps the grid's keyboard model.)
          layout: waterfall ? "grid" : props.layout || "grid",
          selectionMode: props.selectionMode ?? "none",
          selectionStyle: props.selectionStyle || undefined,
          disallowEmptySelection: bool(props.disallowEmptySelection),
          ...controlled(input, SELECTED_KEYS, selected, catalogSelectionValue),
          ...catalogEmptyState(input),
        },
        ...renderAll(
          input,
          children(input).filter((child) =>
            ["GridListItem", "GridListSection"].includes(
              catalogTypeName(input.root, child),
            ),
          ),
        ),
        ...catalogLoadMoreItem(
          input.root,
          input.node,
          input.loadMore,
          GridListLoadMoreItem,
          (id) => input.pages?.(id) ?? false,
        ),
      );
    },
  },
  breadcrumbs: {
    ownsChild: (child, _parent, root) =>
      catalogTypeName(root, child) !== "Breadcrumb",
    render: (input) => {
      const props = input.node.props;
      return createElement(
        Breadcrumbs as ElementType,
        {
          ...marker(input),
          style: input.style,
          "data-size": str(props.size || "M"),
          "data-variant": str(props.variant || "default"),
          "aria-label":
            typeof props["aria-label"] === "string"
              ? props["aria-label"]
              : undefined,
          size: props.size,
          isDisabled: bool(props.isDisabled),
        },
        ...renderAll(
          input,
          children(input).filter(
            (child) => catalogTypeName(input.root, child) === "Breadcrumb",
          ),
        ),
      );
    },
  },
  // ADR-256 Phase 5a: a Breadcrumb is RAC `Breadcrumb` — its children in order (the reference's
  // `Link` and a separator Icon there while not current, `showWhen`); its render props
  // (`isCurrent` · `isDisabled`) are the state frame of the nodes inside. Outside a Breadcrumbs (a
  // Components page sample) RAC needs its collection: a host with no box, and a hidden next crumb
  // that keeps a non-current sample a link.
  breadcrumb: {
    render: (input) => {
      const props = input.node.props;
      const element = createElement(AriaBreadcrumb as ElementType, {
        ...marker(input),
        id: resolveStaticItemKey(
          props as Record<string, unknown>,
          input.node.id,
        ),
        style: input.style,
        className: "react-aria-Breadcrumb",
        children: catalogStateChildren(input.node.id, () => renderAll(input)),
      });
      const parent = input.root.domInputs.get(input.node.parentId);
      if (parent && catalogTypeName(input.root, parent) === "Breadcrumbs")
        return element;
      return createElement(
        AriaBreadcrumbs as ElementType,
        {
          key: `host:${input.node.id}`,
          "aria-label": "Breadcrumb sample",
          style: { display: "contents" },
        },
        element,
        ...(input.node.displayState !== "current"
          ? [
              createElement(AriaBreadcrumb as ElementType, {
                key: "__orphan-next",
                id: "__orphan-next",
                style: { display: "none" },
              }),
            ]
          : []),
      );
    },
  },
  menu: {
    // ADR-256 후속 4: a Menu node is RAC's `Menu` — the list — wherever it stands: in a
    // MenuTrigger's or a SubmenuTrigger's Popover (the trigger names it and opens it — RAC's
    // `MenuContext` · `PopoverContext`, Phase 5g), or open in an Autocomplete (its filter — RAC's
    // `SelectableCollectionContext`, G0 example 4).
    ownsChild: (child, _parent, root) => !isEmptyStateChild(child, root),
    render: (input) => {
      const props = input.node.props;
      const popover = input.root.domInputs.get(input.node.parentId);
      const trigger = popover && input.root.domInputs.get(popover.parentId);
      const triggered =
        !!popover &&
        !!trigger &&
        catalogTypeName(input.root, popover) === "Popover" &&
        MENU_TRIGGER_TYPES.has(catalogTypeName(input.root, trigger));
      // (In an Autocomplete RAC names the list — its collection props, "Suggestions" localized —
      // and a given name wins over them: no fallback there, G5 example 4.)
      const owner = catalogDomPartParent(input.root, input.node);
      const autocompleted =
        !!owner && catalogTypeName(input.root, owner) === "Autocomplete";
      const selected = runtimeState(input, "selectedKeys") as string[];
      return createElement(
        AriaMenu as ElementType,
        {
          key: input.setRuntimeProps
            ? input.node.id
            : selectionKey(input.node.id, selected),
          "data-catalog-id": input.node.id,
          className: "react-aria-Menu",
          "data-size": props.size || "M",
          style: input.style,
          // (RAC needs a name: in a trigger the trigger's, in an Autocomplete RAC's; open, the
          // author's or "Menu".)
          ...(typeof props["aria-label"] === "string"
            ? { "aria-label": props["aria-label"] }
            : triggered || autocompleted
              ? {}
              : { "aria-label": "Menu" }),
          ...catalogEmptyState(input),
          ...(props.selectionMode && props.selectionMode !== "none"
            ? {
                selectionMode: props.selectionMode,
                // (Its MenuItems set Selected — 2026-10-13; a running Preview controls it.)
                ...controlled(
                  input,
                  SELECTED_KEYS,
                  selected,
                  catalogSelectionValue,
                ),
              }
            : {}),
        },
        ...renderAll(
          input,
          children(input).filter((child) =>
            MENU_CHILD_TYPES.has(catalogTypeName(input.root, child)),
          ),
        ),
        ...catalogLoadMoreItem(
          input.root,
          input.node,
          input.loadMore,
          MenuLoadMoreItem,
          (id) => input.pages?.(id) ?? false,
        ),
      );
    },
  },
  tree: {
    // TreeItem children become RAC TreeItems (title/childItems); their other children render.
    // Nested items of a collapsed parent are not rendered (ADR-239 `expandedKeys`).
    // (The Tree draws its items: a rule added on one renders the Tree again — its handlers.)
    watchesChildren: (node, root) => treeItemIds(root, node),
    ownsDescendant: (node, _ancestor, root) => {
      const parent = root.domInputs.get(node.parentId);
      const get = (id: string) => root.domInputs.get(id);
      const typeOf = (entry: CatalogConsumerNode) =>
        catalogTypeName(root, entry);
      return (
        !!parent &&
        typeOf(node) === "TreeItem" &&
        typeOf(parent) === "TreeItem" &&
        !catalogTreeItemExpanded(parent, get, typeOf)
      );
    },
    render: (input) => {
      const props = input.node.props;
      const items = (list: CatalogConsumerNode[]) =>
        treeItemElements(input, list);
      const treeSelected = runtimeState(input, "selectedKeys") as string[];
      return createElement(
        Tree as ElementType,
        {
          ...marker(input),
          key: stateKey(
            input,
            selectionKey(marker(input).key, treeSelected as string[]),
          ),
          style: input.style,
          "aria-label": str(props["aria-label"] || props.label || "Tree"),
          selectionMode: props.selectionMode ?? "single",
          disallowEmptySelection: bool(props.disallowEmptySelection),
          // RSP `selectionStyle` (checkbox → RAC `toggle`, highlight → `replace`): the shared Tree
          // converts it (`resolveSelectionBehavior`, highlight when unset).
          selectionStyle: props.selectionStyle,
          // In the Preview the user's expansion is a runtime prop of the record (ADR-250); the
          // declared keys stay in the document. Controlled from the first render (ADR-280).
          ...(input.setRuntimeProps
            ? controlled(
                input,
                EXPANDED_KEYS,
                treeKeys(runtimeState(input, "expandedKeys")) ?? [],
                catalogSelectionValue,
              )
            : {
                expandedKeys: treeKeys(props.expandedKeys),
                defaultExpandedKeys: Array.isArray(props.defaultExpandedKeys)
                  ? props.defaultExpandedKeys
                  : [],
              }),
          // The selection starts from the items set Selected (2026-10-13); a pressed row ·
          // selection checkbox selects it (ADR-256 Phase 5h-2) — the record's runtime value in a
          // running Preview (ADR-280).
          ...controlled(
            input,
            SELECTED_KEYS,
            treeSelected,
            catalogSelectionValue,
          ),
          ...catalogEmptyState(input),
        },
        ...items(
          children(input).filter(
            (child) => catalogTypeName(input.root, child) === "TreeItem",
          ),
        ),
        ...catalogLoadMoreItem(
          input.root,
          input.node,
          input.loadMore,
          TreeLoadMoreItem,
          (id) => input.pages?.(id) ?? false,
        ),
      );
    },
  },
  treeitem: {
    // A TreeItem outside a Tree (Preview orphan host): one row of a contents-only shared Tree, so
    // the `Tree.css` row (`[data-composition-tree]`) and its chevron apply (4e-11).
    ownsChild: ownsAll,
    render: (input) =>
      createElement(
        Tree as ElementType,
        {
          key: `host:${input.node.id}`,
          "aria-label": "TreeItem sample",
          style: { display: "contents" },
          selectionMode: "none",
        },
        ...treeItemElements(input, [input.node]),
      ),
  },
  filetrigger: {
    render: (input) => {
      const props = input.node.props;
      const list = children(input);
      return markerWrap(
        input,
        createElement(
          FileTriggerIntake as ElementType,
          {
            allowsMultiple: bool(props.allowsMultiple),
            acceptDirectory: bool(props.acceptDirectory),
            defaultCamera: props.defaultCamera,
            acceptedFileTypes: fileTypes(props.acceptedFileTypes),
          },
          ...(list.length
            ? renderAll(input, list)
            : [
                createElement(
                  AriaButton as ElementType,
                  {
                    key: "trigger",
                    className: "react-aria-FileTrigger",
                    "data-variant": str(props.variant || "default"),
                    "data-size": str(props.size || "M"),
                    isDisabled: bool(props.isDisabled),
                    style: input.style,
                  },
                  resolveTextSourceText(
                    "FileTrigger",
                    props as Record<string, unknown>,
                  ),
                ),
              ]),
        ),
      );
    },
  },
  fileupload: {
    render: (input) => {
      const props = input.node.props;
      const list = children(input);
      const isInput = (child: CatalogConsumerNode) =>
        FILE_UPLOAD_INPUT_CHILD_TYPES.has(catalogTypeName(input.root, child));
      return createElement(FileUpload as ElementType, {
        ...marker(input),
        style: input.style,
        endpoint: props.endpoint,
        chunkSize: props.chunkSize,
        parallelUploads: props.parallelUploads,
        maxFileSize: props.maxFileSize,
        autoProceed: props.autoProceed,
        retryDelays: Array.isArray(props.retryDelays)
          ? props.retryDelays
          : undefined,
        showPreview: props.showPreview,
        isDisabled: bool(props.isDisabled),
        variant: props.variant,
        size: props.size,
        inputSurface: renderAll(input, list.filter(isInput)),
        sampleRows: renderAll(
          input,
          list.filter((child) => !isInput(child)),
        ),
      });
    },
  },
  textfield: nodeTreeField(AriaTextField, "TextField", (props) => ({
    ...inputHints(props),
    defaultValue: str(props.value),
    maxLength: num(props.maxLength),
    minLength: num(props.minLength),
    pattern: opt(props.pattern),
  })),
  textarea: nodeTreeField(AriaTextField, "TextField", (props) => ({
    ...inputHints(props),
    defaultValue: str(props.value),
    maxLength: num(props.maxLength),
    minLength: num(props.minLength),
  })),
  // S2: no value is an empty input (RAC `NaN`) that shows the placeholder — not 0.
  numberfield: nodeTreeField(AriaNumberField, "NumberField", (props) => ({
    defaultValue: catalogNumberFieldValue(props.value),
    minValue: num(props.minValue),
    maxValue: num(props.maxValue),
    step: num(props.step),
    formatOptions: catalogNumberFormatOptions(props.formatOptions),
    locale: opt(props.locale),
    isWheelDisabled: bool(props.isWheelDisabled),
  })),
  // ADR-256 Phase 6c: the reference's tree — `Select > Label + Button(SelectValue + Icon) +
  // Text[description] + FieldError + Popover > ListBox`, each part in RAC's Select context (its
  // Popover takes the Select's trigger and place — `PopoverContext`). Without a visible label the
  // Select is named by its placeholder (RAC needs a label or an `aria-label`).
  select: calendarPickerSelect(
    nodeTreeField(
      AriaSelect,
      "Select",
      (props) => ({
        placeholder: opt(props.placeholder),
        // Single (RAC's default) or Multiple — its ListBox and SelectValue follow RAC's state.
        selectionMode:
          props.selectionMode === "multiple" ? "multiple" : undefined,
        "aria-label": str(props.label).trim()
          ? undefined
          : (opt(props.placeholder) ?? "Select an option"),
      }),
      undefined,
      undefined,
      undefined,
      // (A calendar month · year picker's Select takes its value from the calendar — RAC's.)
      (input) =>
        isCalendarPicker(input, input.node)
          ? {}
          : {
              // (RAC 1.22 Select's selection is `value` · `onChange` — S2 Picker's; the deprecated
              // `selectedKey` is single only, RAC ignores it with `selectionMode: "multiple"`.)
              ...controlled(
                input,
                VALUE,
                catalogSelectValue(
                  runtimeState(input, "value"),
                  input.node.props.selectionMode === "multiple",
                ),
              ),
              ...openState(input),
            },
    ),
  ),
  // ADR-256 Phase 6d: the reference's tree — `ComboBox > Label + Group(Input + Button) +
  // Text[description] + FieldError + Popover > ListBox`, each part in RAC's ComboBox context (its
  // Popover takes the Group as trigger and its place — `PopoverContext`). Without a visible label
  // the ComboBox is named by its placeholder (RAC needs a label or an `aria-label`).
  combobox: nodeTreeField(
    CatalogComboBox,
    "ComboBox",
    (props) => ({
      allowsCustomValue: bool(props.allowsCustomValue),
      menuTrigger: opt(props.menuTrigger),
      "aria-label": str(props.label).trim()
        ? undefined
        : (opt(props.placeholder) ?? "Select an option"),
    }),
    undefined,
    undefined,
    undefined,
    // (A running Preview: its selection and input text controlled — ADR-280. A server-filtered
    // ComboBox — its endpoint reads `{{ filterText }}` — loads with the text, the reference's
    // `inputValue={list.filterText} onInputChange={list.setFilterText}`: the list does not filter
    // again. With both controlled, RAC leaves the input text to the selection's writer —
    // `CatalogComboBox`.)
    (input) =>
      input.setRuntimeProps
        ? {
            onSelectionText: (patch: Record<string, unknown>) =>
              input.setRuntimeProps!(input.node.id, patch),
            ...controlled(
              input,
              SELECTED_KEY,
              runtimeState(input, "selectedKey") ?? null,
            ),
            ...serverFiltered(
              input,
              controlled(
                input,
                INPUT_VALUE,
                str(runtimeState(input, "inputValue")),
              ),
            ),
          }
        : {},
  ),
  // ADR-256 Phase 6e: the reference's tree — `DatePicker > Label + Group(DateInput + Button) +
  // Text[description] + FieldError + Popover > Calendar` (a DateRangePicker's pair of DateInputs and
  // RangeCalendar), each part in RAC's picker context (its Popover takes the Group as trigger and its
  // place — `PopoverContext`; its calendar the value · `pageBehavior` — `CalendarContext`).
  datepicker: nodeTreeField(
    AriaDatePicker,
    "DatePicker",
    (props) => ({
      ...datePickerProps(props),
      defaultValue: dateValue(props.value) ?? null,
      hourCycle: num(props.hourCycle),
      "aria-label": str(props.label).trim() ? undefined : "Date Picker",
    }),
    (props) => [props.locale, props.calendarSystem],
    undefined,
    dateToOverride,
    openState,
  ),
  daterangepicker: nodeTreeField(
    AriaDateRangePicker,
    "DateRangePicker",
    (props) => ({
      ...datePickerProps(props),
      defaultValue: dateRangeValue(props.value),
      hourCycle: num(props.hourCycle),
      allowsNonContiguousRanges: bool(props.allowsNonContiguousRanges),
      startName: opt(props.startName),
      endName: opt(props.endName),
      "aria-label": str(props.label).trim() ? undefined : "Date Range",
    }),
    (props) => [props.locale, props.calendarSystem],
    undefined,
    dateRangeToOverride,
    openState,
  ),
  searchfield: nodeTreeField(AriaSearchField, "SearchField", (props) => ({
    ...inputHints(props),
    // S2 `type` — RAC's SearchField gives it to its input (unset = `search`).
    type: opt(props.type),
    defaultValue: str(props.value),
    maxLength: num(props.maxLength),
    minLength: num(props.minLength),
    pattern: opt(props.pattern),
  })),
  datefield: nodeTreeField(
    AriaDateField,
    "DateField",
    (props) => ({
      defaultValue: dateValue(props.value) ?? null,
      hideTimeZone: props.hideTimeZone !== false,
      shouldForceLeadingZeros: props.shouldForceLeadingZeros !== false,
      minValue: dateValue(props.minValue),
      maxValue: dateValue(props.maxValue),
      // No value of its own: the empty segments (RAC · RSP — the Canvas draws the same).
      placeholderValue: placeholderDate(
        props.placeholderValue,
        props.granularity,
      ),
      granularity: ["day", "hour", "minute", "second"].includes(
        String(props.granularity),
      )
        ? props.granularity
        : "day",
      hourCycle: num(props.hourCycle),
    }),
    (props) => [props.locale, props.calendarSystem],
    undefined,
    dateToOverride,
  ),
  timefield: nodeTreeField(
    AriaTimeField,
    "TimeField",
    (props) => ({
      defaultValue: timeValue(props.value) ?? null,
      hourCycle: num(props.hourCycle) ?? 24,
      placeholderValue: timeValue(props.placeholderValue),
      minValue: timeValue(props.minValue),
      maxValue: timeValue(props.maxValue),
      hideTimeZone: props.hideTimeZone !== false,
      shouldForceLeadingZeros: props.shouldForceLeadingZeros !== false,
      granularity: ["hour", "minute", "second"].includes(
        String(props.granularity),
      )
        ? props.granularity
        : "minute",
    }),
    (props) => [props.locale],
    undefined,
    dateToOverride,
  ),
  colorfield: nodeTreeField(
    AriaColorField,
    "ColorField",
    (props) => ({
      // (A running Preview's `value` — a rule's write, the user's edit — over the authored one.)
      defaultValue: opt(props.value ?? props.defaultValue),
      channel: props.channel,
      colorSpace: props.colorSpace,
      isWheelDisabled: bool(props.isWheelDisabled),
    }),
    undefined,
    "start",
    (next) =>
      next && typeof (next as { toString?: unknown }).toString === "function"
        ? (next as { toString(format: string): string }).toString("hex")
        : "",
  ),
  // ADR-256 Phase 7c: the Slider is RAC's, its children in order — the reference `Label` +
  // `SliderOutput` + `SliderTrack > SliderFill + SliderThumb`, and anything the author put in.
  slider: {
    render: (input) => {
      const props = input.node.props;
      const { min, max } = catalogSliderRange(input.node);
      const value = runtimeState(input, "value");
      return withI18n(
        createElement(AriaSlider as ElementType, {
          ...marker(input),
          // (A static render's value is RAC's run state — `defaultValue`; a document edit of the
          // value starts it again. A running Preview's is controlled — ADR-280.)
          key: stateKey(input, `${input.node.id}:${value}`),
          style: input.style,
          className: "react-aria-Slider",
          "data-size": str(props.size) || "M",
          "data-label-position": str(props.labelPosition) || "top",
          // (S2 start · end — start is the sheet's default, so only end is an attribute.)
          "data-label-align": props.labelAlign === "end" ? "end" : undefined,
          "data-emphasized": bool(props.isEmphasized) || undefined,
          ...controlled(input, VALUE, value),
          minValue: min,
          maxValue: max,
          step: num(props.step) ?? 1,
          formatOptions: catalogNumberFormatOptions(props.formatOptions),
          isDisabled: bool(props.isDisabled),
          // (No visible label: RAC needs a name — the type's own.)
          "aria-label": str(props.label).trim() ? undefined : "Slider",
          children: catalogStateChildren(input.node.id, () => renderAll(input)),
        }),
        props.locale,
      );
    },
  },
  // ADR-256 Phase 7a: the ProgressBar is RAC's, its children in order — the reference `Label` +
  // value text (`{valueText}`) + track > fill (`width: {percentage}%`), and anything the author put
  // in. Its render props are the state frame the bound parts read (Decision 12 — `stateFrames.tsx`).
  progressbar: {
    render: (input) => {
      const props = input.node.props;
      const staticColor = props.staticColor;
      return withI18n(
        createElement(AriaProgressBar as ElementType, {
          ...marker(input),
          style: input.style,
          className: "react-aria-ProgressBar",
          "data-variant": str(props.variant) || "default",
          "data-size": str(props.size) || "M",
          "data-label-position": str(props.labelPosition) || "top",
          "data-indeterminate": bool(props.isIndeterminate)
            ? "true"
            : undefined,
          "data-static-color":
            staticColor === "white" || staticColor === "black"
              ? staticColor
              : undefined,
          value: num(props.value) ?? 0,
          minValue: num(props.minValue) ?? 0,
          maxValue: num(props.maxValue) ?? 100,
          isIndeterminate: bool(props.isIndeterminate),
          valueLabel: opt(props.valueLabel),
          formatOptions: catalogNumberFormatOptions(props.formatOptions),
          // (No visible label: RAC needs a name — the type's own.)
          "aria-label": str(props.label).trim() ? undefined : "Progress",
          children: catalogStateChildren(input.node.id, () => renderAll(input)),
        }),
        props.locale,
      );
    },
  },
  // ADR-256 Phase 7b: the Meter is RAC's, its children in order — `Label` + value text
  // (`{valueText}`) + track > fill (`width: {percentage}%`) and anything the author put in; its
  // render props are the frame the bound parts read (Decision 12).
  meter: {
    render: (input) => {
      const props = input.node.props;
      const staticColor = props.staticColor;
      return withI18n(
        createElement(AriaMeter as ElementType, {
          ...marker(input),
          style: input.style,
          className: "react-aria-Meter",
          "data-variant": str(props.variant) || "informative",
          "data-size": str(props.size) || "M",
          "data-label-position": str(props.labelPosition) || "top",
          "data-static-color":
            staticColor === "white" || staticColor === "black"
              ? staticColor
              : undefined,
          value: num(props.value) ?? 0,
          minValue: num(props.minValue) ?? 0,
          maxValue: num(props.maxValue) ?? 100,
          valueLabel: opt(props.valueLabel),
          formatOptions: catalogNumberFormatOptions(props.formatOptions),
          // (No visible label: RAC needs a name — the type's own.)
          "aria-label": str(props.label).trim() ? undefined : "Meter",
          children: catalogStateChildren(input.node.id, () => renderAll(input)),
        }),
        props.locale,
      );
    },
  },
  // ADR-256 Phase 3: the Switch is RAC `SwitchField` — its children in order (the SwitchButton, a
  // Description, a FieldError, anything the author put in).
  switch: {
    render: (input) => {
      const props = input.node.props;
      return createElement(AriaSwitchField as ElementType, {
        ...marker(input),
        style: input.style,
        className: "react-aria-Switch",
        "data-size": str(props.size) || "M",
        // (S2 `isEmphasized` — the rule's emphasized variant, which the Canvas paints.)
        "data-emphasized": bool(props.isEmphasized) || undefined,
        ...controlled(
          input,
          IS_SELECTED,
          bool(runtimeState(input, "isSelected")),
        ),
        isDisabled: bool(props.isDisabled),
        isReadOnly: bool(props.isReadOnly),
        isRequired: bool(props.isRequired),
        isInvalid: authoredInvalid(props),
        name: opt(props.name),
        value: opt(props.value),
        autoFocus: bool(props.autoFocus),
        // (Its render props are the state frame of the `showWhen` nodes inside — Decision 7.)
        children: catalogStateChildren(input.node.id, () => renderAll(input)),
      });
    },
  },
  // ADR-256 Phase 3: the Radio is RAC `RadioField` — its children in order (the RadioButton, a
  // Description, anything the author put in). Outside a RadioGroup it needs RAC's group state: a
  // host group with no box of its own (`display: contents` — the old `hostOrphanRadio`).
  radio: {
    render: (input) => {
      const props = input.node.props;
      const element = createElement(AriaRadioField as ElementType, {
        ...marker(input),
        style: input.style,
        className: "react-aria-Radio",
        "data-size": str(props.size) || "M",
        "data-variant": str(props.variant) || "default",
        // (S2 context — the group's `isEmphasized`, which the resolver put on this record.)
        "data-emphasized": bool(props.isEmphasized) || undefined,
        value: str(props.value),
        isDisabled: bool(props.isDisabled),
        autoFocus: bool(props.autoFocus),
        // (Its render props are the state frame of the `showWhen` nodes inside — Decision 7.)
        children: catalogStateChildren(input.node.id, () => renderAll(input)),
      });
      for (
        let parent = input.root.domInputs.get(input.node.parentId);
        parent;
        parent = input.root.domInputs.get(parent.parentId)
      )
        if (catalogTypeName(input.root, parent) === "RadioGroup")
          return element;
      return createElement(
        AriaRadioGroup,
        {
          key: `host:${input.node.id}`,
          "aria-label": "Radio sample",
          value: props.isSelected === true ? str(props.value) : null,
          style: { display: "contents" },
        },
        element,
      );
    },
  },
  // ADR-256 Phase 3: the Radio's RAC `RadioButton` (the `label`) — its children in order; the
  // RadioIndicator node's place is the ring (`div.indicator` — `Radio.css`, the reference's).
  radiobutton: toggleButton(AriaRadioButton, "react-aria-RadioButton", {
    RadioIndicator: (key) =>
      createElement("div", { key, className: "indicator" }),
  }),
  // ADR-256 Phase 3: the Switch's RAC `SwitchButton` (the `label`) — its children in order; the
  // SwitchIndicator node's place is the track (`div.indicator` — `Switch.css`).
  switchbutton: toggleButton(AriaSwitchButton, "react-aria-SwitchButton", {
    SwitchIndicator: (key) =>
      createElement("div", { key, className: "indicator" }),
  }),
  // ADR-256 Phase 3: the Checkbox is RAC `CheckboxField` — its children in order (the CheckboxButton,
  // a Description, a FieldError, anything the author put in). In a CheckboxGroup it is one of the
  // group's values (its `value`, else its record id — the group's `defaultValue`). Phase 5f: its authored slot
  // connects it to the RAC context it renders in — a collection item's `selection` gives it the
  // item's selection (state · name · handler), so its own state props stay out (RAC merges the
  // element's props over the context's).
  checkbox: {
    render: (input) => {
      if (
        catalogTreeSelectionCheckboxHidden(
          input.node,
          (id) => input.root.domInputs.get(id),
          input.root.typeOf,
        )
      )
        return createElement(Fragment, { key: input.node.id });
      const props = input.node.props;
      const inGroup = !!domToggleGroupOf(input.root, input.node);
      return createElement(RacSlotScope, {
        // A static render: RAC holds the selection and an authored change of the default starts the
        // element over (2026-10-09). A running Preview: controlled — ADR-280.
        key: stateKey(input, `${input.node.id}:${bool(props.isSelected)}`),
        context: "Checkbox",
        authored: props.slot,
        render: (resolution) =>
          createElement(AriaCheckboxField as ElementType, {
            "data-catalog-id": input.node.id,
            ...racSlotProps(resolution),
            style: input.style,
            className: "react-aria-Checkbox",
            "data-size": str(props.size) || "M",
            // (S2 `isEmphasized` — the rule's emphasized variant, which the Canvas paints.)
            "data-emphasized": bool(props.isEmphasized) || undefined,
            ...(resolution.kind === "named"
              ? {}
              : {
                  ...(inGroup
                    ? // (RAC's grouped item: its value is its key and form value, `props.name ||
                      // group's` — S2 passes both.)
                      {
                        value: groupItemValue(input.node),
                        name: opt(props.name),
                      }
                    : {
                        ...controlled(
                          input,
                          IS_SELECTED,
                          bool(runtimeState(input, "isSelected")),
                        ),
                        name: opt(props.name),
                        value: opt(props.value),
                      }),
                  isIndeterminate: bool(props.isIndeterminate),
                  isDisabled: bool(props.isDisabled),
                }),
            isInvalid: bool(props.isInvalid),
            isReadOnly: bool(props.isReadOnly),
            // (In a group RAC reads the item's `isRequired ?? group's` — an unset item's is the
            // group's, so a `false` here would cut the group's Required off.)
            isRequired: inGroup
              ? bool(props.isRequired) || undefined
              : bool(props.isRequired),
            autoFocus: bool(props.autoFocus),
            // (Its render props are the state frame of the `showWhen` nodes inside — Decision 7.)
            children: catalogStateChildren(input.node.id, () =>
              renderAll(input),
            ),
          }),
      });
    },
  },
  // ADR-256 Phase 3: the Checkbox's RAC `CheckboxButton` (the `label`) — its children in order; the
  // CheckboxIndicator node's place is the indicator box, drawn by RAC's state (a part its owner
  // draws: the node has no element of its own).
  checkboxbutton: toggleButton(
    AriaCheckboxButton,
    "react-aria-CheckboxButton",
    {
      CheckboxIndicator: (key, { isSelected, isIndeterminate }) =>
        createElement(CheckboxIndicatorBox, {
          key,
          isSelected,
          isIndeterminate: isIndeterminate === true,
        }),
    },
  ),

  // ADR-256 Phase 3: a CheckboxGroup is RAC `CheckboxGroup` — its children in order (the Label, the
  // items wrapper, a Description, a FieldError, anything the author put in). Its value is the
  // selected items' values (each item is a `CheckboxField` with its `value`, else its record id —
  // `checkbox`).
  checkboxgroup: {
    // (Its value is its items' `isSelected` — through any element between: Codex Round 20 H2.)
    watchesChildren: (node, root) => groupWatched(node, root, "Checkbox"),
    render: (input) => {
      const props = input.node.props;
      const selected = runtimeState(input, "value") as string[];
      const size = str(props.size) || "M";
      return createElement(
        AriaCheckboxGroup as ElementType,
        {
          ...marker(input),
          key: stateKey(input, `${input.node.id}:${selected.join(",")}`),
          style: input.style,
          className: "react-aria-CheckboxGroup",
          "data-orientation": str(props.orientation) || "vertical",
          "data-checkbox-size": size,
          "data-size": size,
          "data-label-position": str(props.labelPosition) || "top",
          // (S2 start · end — start is the sheet's default, so only end is an attribute.)
          "data-label-align": props.labelAlign === "end" ? "end" : undefined,
          ...controlled(input, VALUE, selected),
          isDisabled: bool(props.isDisabled),
          isInvalid: authoredInvalid(props),
          isReadOnly: bool(props.isReadOnly),
          isRequired: bool(props.isRequired),
          name: opt(props.name),
        },
        ...renderAll(input),
      );
    },
  },
  // ADR-251 · ADR-256 Phase 3: a group's items wrapper is the reference's `div.checkbox-items` /
  // `div.radio-items` (outside RAC's structure, no role) — its children in order, with its node's
  // marker. Its box is the group rule's (`orientation` block); it takes no authored style (as the
  // Canvas paints none).
  checkboxitems: {
    render: (input) =>
      createElement(
        "div",
        { ...marker(input), className: "checkbox-items" },
        ...renderAll(input),
      ),
  },
  radioitems: {
    render: (input) =>
      createElement(
        "div",
        { ...marker(input), className: "radio-items" },
        ...renderAll(input),
      ),
  },
  // ADR-256 Phase 3: a RadioGroup is RAC `RadioGroup` — its children in order. Its value is the
  // first selected item's (each item is a `RadioField` with its `value` — `radio`), else its own.
  radiogroup: {
    watchesChildren: (node, root) => groupWatched(node, root, "Radio"),
    render: (input) => {
      const props = input.node.props;
      const value = str(runtimeState(input, "value"));
      const size = str(props.size) || "M";
      return createElement(
        AriaRadioGroup as ElementType,
        {
          ...marker(input),
          key: stateKey(input, `${input.node.id}:${value}`),
          style: input.style,
          className: "react-aria-RadioGroup",
          "data-radio-size": size,
          "data-size": size,
          "data-label-position": str(props.labelPosition) || "top",
          // (S2 start · end — start is the sheet's default, so only end is an attribute.)
          "data-label-align": props.labelAlign === "end" ? "end" : undefined,
          // (No value is `null` — RAC reads `""` as a chosen value and takes every Radio out of
          // the Tab order; ADR-256 후속 7.)
          ...controlled(input, VALUE, value || null),
          orientation: str(props.orientation) || "vertical",
          isDisabled: bool(props.isDisabled),
          isInvalid: authoredInvalid(props),
          isReadOnly: bool(props.isReadOnly),
          isRequired: bool(props.isRequired),
          name: opt(props.name),
        },
        ...renderAll(input),
      );
    },
  },
  togglebutton: {
    render: (input) => {
      const props = input.node.props;
      // (An element between keeps it in the group's RAC context.)
      const inGroup = !!domToggleGroupOf(input.root, input.node);
      // Outside a group its selection is its own (RAC state): tracked so the `showWhen` nodes inside
      // read it (ADR-256 Decision 7 — the shared ToggleButton draws children, not RAC's function).
      if (!inGroup)
        return createElement(SelfToggleButton, {
          key: stateKey(input, `${input.node.id}:${bool(props.isSelected)}`),
          ownerId: input.node.id,
          defaultSelected: bool(props.isSelected),
          // (A running Preview: controlled by the record's runtime value — ADR-280.)
          ...(input.setRuntimeProps
            ? {
                selected: bool(runtimeState(input, "isSelected")),
                onSelectedChange: (next: boolean) =>
                  input.setRuntimeProps!(input.node.id, { isSelected: next }),
              }
            : {}),
          isDisabled: bool(props.isDisabled),
          render: (selection: Record<string, unknown>) =>
            createElement(
              ToggleButton as ElementType,
              {
                ...marker(input),
                id: input.node.id,
                style: input.style,
                ...selection,
                isDisabled: bool(props.isDisabled),
                autoFocus: bool(props.autoFocus),
                isEmphasized: bool(props.isEmphasized),
                isQuiet: bool(props.isQuiet),
                staticColor: props.staticColor || "auto",
                size: props.size || "M",
              },
              typeof props.children === "string" ? props.children : null,
              ...renderAll(input),
            ),
        });
      return createElement(GroupToggleFrame, {
        ownerId: input.node.id,
        isSelected: bool(props.isSelected),
        isDisabled: bool(props.isDisabled),
        children: createElement(
          ToggleButton as ElementType,
          {
            ...marker(input),
            id: input.node.id,
            style: input.style,
            isDisabled: bool(props.isDisabled),
            autoFocus: bool(props.autoFocus),
            isEmphasized: bool(props.isEmphasized),
            isQuiet: bool(props.isQuiet),
            staticColor: props.staticColor || "auto",
            size: props.size || "M",
          },
          typeof props.children === "string" ? props.children : null,
          ...renderAll(input),
        ),
      });
    },
  },
  // ADR-256 Phase 3: a ToggleButtonGroup draws its children in order (its ToggleButtons and anything
  // the author put in) — the shared group gives its buttons the S2 contexts (indicator · emphasized ·
  // quiet · static color).
  togglebuttongroup: {
    // Its selection is its ToggleButtons' `isSelected` — through the frames the author put
    // between (they stay in the group's RAC context — ADR-256 후속 18).
    watchesChildren: (node, root) => {
      const { buttons, frames } = groupToggleButtons(node, root);
      return [...frames, ...buttons].map((record) => record.id);
    },
    render: (input) => {
      const props = input.node.props;
      const selected = runtimeState(input, "selectedKeys") as string[] | "all";
      return createElement(
        ToggleButtonGroup as ElementType,
        {
          ...marker(input),
          key: stateKey(
            input,
            `${input.node.id}:${[...selected].sort().join(",")}`,
          ),
          style: input.style,
          orientation: props.orientation,
          selectionMode: props.selectionMode,
          disallowEmptySelection: bool(props.disallowEmptySelection),
          indicator: bool(props.indicator),
          isEmphasized: bool(props.isEmphasized),
          // S2 isJustified (2026-10-10): the sheet's `[data-justified]` grows each button.
          isJustified: bool(props.isJustified),
          staticColor: props.staticColor || "auto",
          size: props.size || "M",
          density: props.density || "regular",
          ...controlled(input, SELECTED_KEYS, selected, catalogSelectionValue),
          // (Only when disabled — RAC writes `aria-disabled` for any boolean.)
          isDisabled: bool(props.isDisabled) || undefined,
        },
        ...renderAll(input),
      );
    },
  },
  buttongroup: {
    render: (input) => {
      const props = input.node.props;
      const justify: Record<string, string> = {
        start: "flex-start",
        center: "center",
        end: "flex-end",
      };
      const gap: Record<string, number> = {
        XS: 4,
        S: 6,
        M: 8,
        L: 10,
        XL: 12,
      };
      return createElement(
        "div",
        {
          ...marker(input),
          role: "group",
          style: {
            display: "flex",
            flexDirection: props.orientation === "vertical" ? "column" : "row",
            gap: gap[str(props.size || "M")] ?? 8,
            justifyContent: justify[str(props.align || "end")] ?? "flex-end",
            // This group has no generated class; consume the typed catalog root height.
            height:
              typeof input.node.visual.height === "string" ||
              typeof input.node.visual.height === "number"
                ? input.node.visual.height
                : undefined,
            ...input.style,
          },
        },
        ...renderAll(input),
      );
    },
  },
  // S2 AvatarGroup: a `role="group"` named by its label — the Text node after the avatars
  // (`useLabel`; the label text is the same name).
  avatargroup: {
    render: (input) =>
      createElement(
        "div",
        {
          ...marker(input),
          role: "group",
          "aria-label":
            str(
              children(input).find(
                (child) => catalogTypeName(input.root, child) === "Text",
              )?.props.children,
            ).trim() || undefined,
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            ...input.style,
          },
        },
        ...renderAll(input),
      ),
  },
  // S2 Card (ADR-256 Phase 10): the shared Card box around its child nodes in order — CardPreview ·
  // Content · Footer. Like S2's Card it gives its descendants the `TextContext` slots `title` ·
  // `description` (`@react-spectrum/s2/src/Card.tsx` — the Content's two Text nodes; the Card rule's
  // `[slot]` selectors style them). In a CardView it is the RAC `GridListItem` of the view's RAC
  // GridList (S2 `InternalCardViewContext` — its row; RAC's gridcell is `display: contents`), named
  // by its title text.
  card: {
    render: (input) => {
      const props = input.node.props;
      const content = createElement(
        TextContext.Provider,
        { value: CARD_TEXT_SLOTS },
        ...renderAll(input),
      );
      const parent = input.root.domInputs.get(input.node.parentId);
      if (parent && catalogTypeName(input.root, parent) === "CardView")
        return createElement(
          AriaGridListItem as ElementType,
          {
            ...marker(input),
            id: resolveStaticItemKey(
              props as Record<string, unknown>,
              input.node.id,
            ),
            textValue: cardTitleText(input) || undefined,
            className: "react-aria-Card",
            style: input.style,
            "data-variant": str(props.variant || "primary"),
            "data-size": str(props.size || "M"),
            href: opt(props.href),
            target: opt(props.target),
          },
          content,
        );
      return createElement(
        Card as ElementType,
        {
          ...marker(input),
          style: input.style,
          variant: props.variant || undefined,
          size: props.size || "M",
          isSelected: bool(props.isSelected),
          isDisabled: bool(props.isDisabled),
          // S2: a standalone Card with an `href` is a RAC Link (`Card.tsx`).
          href: opt(props.href),
          target: opt(props.target),
        },
        content,
      );
    },
  },
  // S2 CardPreview (`@react-spectrum/s2` 1.8.0 mounted — G5 example 13): `div[slot=preview]` around
  // an inner `div` holding the media. The inner box does not lay out (`display: contents`) — the
  // Canvas has one box, the CardPreview node's.
  cardpreview: {
    render: (input) =>
      createElement(
        "div",
        {
          ...marker(input),
          ...chrome(input, "CardPreview"),
          slot: "preview",
          style: input.style,
        },
        createElement(
          "div",
          { style: { display: "contents" } },
          ...renderAll(input),
        ),
      ),
  },
  // ADR-256 Phase 10: S2 Content · Footer — plain sections; their owner arranges them. (Keyed by the
  // type's binding id; their renderer ids are `s2content` · `s2footer` — a DialogFooter's generic
  // `footer` element renderer has that id.)
  content: {
    render: container("div", (input) => chrome(input, "Content")),
  },
  // (S2 Footer is a `footer` element — the S2 mount, G5 example 13.)
  footer: {
    render: container("footer", (input) => chrome(input, "Footer")),
  },
  // S2 CardView (ADR-256 Phase 10): a RAC GridList of its Cards (`@react-spectrum/s2/src/CardView.tsx`
  // — its cards are GridListItems). Its selection is RAC's: the Cards' `isSelected` start it while it
  // selects (`selectionMode` — as a TagGroup's Tags), their `isDisabled` disable the item.
  cardview: {
    ownsChild: (child, _parent, root) =>
      catalogTypeName(root, child) !== "Card",
    render: (input) => {
      const props = input.node.props;
      const cards = children(input).filter(
        (child) => catalogTypeName(input.root, child) === "Card",
      );
      const key = (card: CatalogConsumerNode) =>
        resolveStaticItemKey(card.props as Record<string, unknown>, card.id);
      const selectionMode = str(props.selectionMode || "none");
      const selected = runtimeState(input, "selectedKeys") as string[];
      const waterfall = catalogWaterfallLayout(input.node);
      return createElement(
        (waterfall ? CatalogWaterfallGrid : AriaGridList) as ElementType,
        {
          ...(waterfall ? { as: AriaGridList } : {}),
          ...marker(input),
          // (A static render: a changed authored selection remounts RAC's uncontrolled state — as
          // a TagGroup's. A running Preview: controlled — ADR-280.)
          key: stateKey(
            input,
            `${input.node.id}:${selectionMode}:${[...selected].join(",")}`,
          ),
          className: "react-aria-CardView",
          "aria-label": str(props["aria-label"] || "Card view"),
          layout: "grid",
          "data-size": str(props.size || "M"),
          "data-variant": str(props.variant || "primary"),
          selectionMode,
          ...controlled(input, SELECTED_KEYS, selected, catalogSelectionValue),
          disabledKeys: cards
            .filter((card) => card.props.isDisabled === true)
            .map(key),
          style: {
            display: "flex",
            flexWrap: "wrap",
            ...input.style,
          },
        },
        ...renderAll(input, cards),
      );
    },
  },
  pagination: {
    render: container("nav", (input) => ({
      ...chrome(input, "Pagination"),
      "aria-label": "Pagination",
    })),
  },
  nav: {
    render: (input) =>
      createElement(
        "nav",
        {
          ...marker(input),
          ...chrome(input, "Nav"),
          // The `<nav>` name is the `aria-label` it accepts (no `label` — HTML · RSP have none);
          // the Attributes axis (metadata `ariaLabel`) still overrides it (`domBinding.tsx` `withHtmlId`).
          "aria-label": str(input.node.props["aria-label"] || "Navigation"),
          style: { display: "flex", alignItems: "center", ...input.style },
        },
        ...renderAll(input),
      ),
  },
  toast: {
    render: (input) => {
      const props = input.node.props;
      const list = children(input);
      // 295 후속 C9 — S2 Toast draws its variant icon and its CloseButton itself (in the rule's
      // padding — `toastChrome.ts`); closing a placed Toast hides it in a running Preview (the
      // common `hide`'s `style.display`).
      const icon = catalogToastIcon(props);
      const hide = input.setRuntimeProps
        ? () =>
            input.setRuntimeProps!(input.node.id, {
              style: {
                ...((props.style as Record<string, unknown>) ?? {}),
                display: "none",
              },
            })
        : undefined;
      return createElement(
        "div",
        {
          ...marker(input),
          // The rule's class · variant: the generated `.react-aria-Toast` sheet sizes and paints it
          // as the Canvas does (without the class an empty Toast was its text's height).
          ...chrome(input, "Toast"),
          role: "alert",
          style: input.style,
        },
        ...(icon
          ? [
              createElement(
                "span",
                {
                  key: "toast-variant-icon",
                  className: "toast-variant-icon",
                  "aria-hidden": true,
                },
                toastGlyph(icon),
              ),
            ]
          : []),
        ...(list.length
          ? renderAll(input, list)
          : [(props.children as ReactNode) || "Toast"]),
        createElement(ToastNodeClose, {
          key: "toast-close-button",
          onClose: hide,
        }),
      );
    },
  },
  // ADR-256 Phase 8c: RAC Disclosure draws its node tree in order — the reference
  // `Heading > Button[slot=trigger] > (chevron + title)` + `DisclosurePanel` (the starter's; RAC's
  // contexts link the trigger and the panel). Its expansion: the declared state, the Preview's runtime
  // value (ADR-250), or its DisclosureGroup's.
  disclosure: {
    render: (input) => {
      const props = input.node.props;
      // (RAC's group context reaches it through any element — Phase 8 판독 H1.)
      const inGroup = !!catalogDisclosureGroupOf(
        input.node,
        (id) => input.root.domInputs.get(id),
        (record) => catalogTypeName(input.root, record),
      );
      const expanded = Boolean(props.isExpanded ?? true);
      // In the Preview the user's expansion is a runtime prop of the record (ADR-250); a static
      // render shows the declared state.
      const runtime = !inGroup ? input.setRuntimeProps : undefined;
      // (Its state for the `showWhen` nodes inside — ADR-256 Decision 7: the expansion is its prop,
      // the Preview's runtime value, else the group's.)
      const frame = (element: ReactElement) =>
        catalogStateFrame(
          input.node.id,
          input.node.id,
          {
            isExpanded: inGroup
              ? catalogDisclosureExpanded(
                  input.node,
                  (id) => input.root.domInputs.get(id),
                  (record) => catalogTypeName(input.root, record),
                )
              : expanded,
            isDisabled: bool(props.isDisabled),
          },
          element,
        );
      return frame(
        createElement(
          RacDisclosure as ElementType,
          {
            ...marker(input),
            key:
              inGroup || runtime
                ? input.node.id
                : `${input.node.id}:${expanded}`,
            id: input.node.id,
            style: input.style,
            "data-size": str(props.size || "M"),
            // S2 density · quiet · `isInGroup` (the sheet's trigger height, borders — 2026-10-10).
            "data-density": opt(props.density),
            "data-quiet": bool(props.isQuiet) || undefined,
            "data-in-group": inGroup || undefined,
            isDisabled: bool(props.isDisabled),
            ...(inGroup
              ? {}
              : runtime
                ? {
                    isExpanded: expanded,
                    onExpandedChange: (next: boolean) =>
                      runtime(input.node.id, { isExpanded: next }),
                  }
                : { defaultExpanded: expanded }),
          },
          ...renderAll(input, children(input)),
        ),
      );
    },
  },
  disclosuregroup: {
    // Its expansion is its Disclosures' `isExpanded` (declared, or the Preview's runtime value) —
    // every Disclosure its RAC context reaches, at any depth (Phase 8 판독 H1).
    watchesChildren: (node, root) => {
      const { disclosures, containers } = groupDisclosures(node, root);
      return [node, ...containers, ...disclosures].map((record) => record.id);
    },
    render: (input) => {
      const props = input.node.props;
      const list = children(input);
      const { disclosures } = groupDisclosures(input.node, input.root);
      const expanded = resolveGroupExpandedDisclosureIds(
        props as Record<string, unknown>,
        disclosures.map((child) => ({
          id: child.id,
          type: catalogTypeName(input.root, child),
          props: {
            ...(child.props as Record<string, unknown>),
            ...input.runtimeProps?.(child.id),
          },
        })),
      );
      // ADR-280 — a rule's `expand` · `collapse` is the group's runtime `expandedKeys`; until
      // there is one, its Disclosures' (declared or runtime) `isExpanded` — one function with the
      // dispatcher (`catalogRuntimeStateOf`).
      const groupKeys = input.runtimeProps?.(input.node.id)?.expandedKeys;
      const keys = (runtimeState(input, "expandedKeys") as string[]).map(
        String,
      );
      // In the Preview the user's expansion is each Disclosure's runtime `isExpanded` (ADR-250); a
      // static render shows the declared state.
      const setRuntime = input.setRuntimeProps;
      const multiple = allowsMultipleExpanded(props as Record<string, unknown>);
      // ADR-256 Phase 8d: RAC DisclosureGroup around its children as they are (free content — G0 ②).
      return createElement(
        RacDisclosureGroup as ElementType,
        {
          ...marker(input),
          key: `${input.node.id}:${multiple}`,
          style: input.style,
          "data-variant": str(props.variant || "default"),
          "data-size": str(props.size || "M"),
          allowsMultipleExpanded: multiple,
          isDisabled: bool(props.isDisabled),
          ...(setRuntime
            ? {
                expandedKeys: keys,
                onExpandedChange: (next: Set<unknown>) => {
                  // (A rule's group keys follow the user's change; without them each Disclosure's
                  // own runtime value is the state — a declaration drops it, ADR-250 R2.)
                  if (Array.isArray(groupKeys))
                    setRuntime(input.node.id, {
                      expandedKeys: [...next].map(String),
                    });
                  for (const child of disclosures)
                    if (next.has(child.id) !== expanded.has(child.id))
                      setRuntime(child.id, { isExpanded: next.has(child.id) });
                },
              }
            : { defaultExpandedKeys: keys }),
        },
        ...renderAll(input, list),
      );
    },
  },
  colorpicker: {
    render: (input) =>
      createElement(
        "div",
        {
          ...marker(input),
          className: "react-aria-ColorPicker ",
          "data-size": str(input.node.props.size ?? "M"),
          "data-variant": opt(input.node.props.variant),
          style: input.style,
        },
        ...renderAll(input),
      ),
  },
  // ADR-256 Phase 5b: a ColorSwatchPicker is RAC `ColorSwatchPicker` — its items in order (each
  // a RAC `ColorSwatchPickerItem` node holding its ColorSwatch).
  colorswatchpicker: {
    render: (input) => {
      const props = input.node.props;
      return createElement(
        ColorSwatchPicker as ElementType,
        {
          ...marker(input),
          style: input.style,
          // (ADR-280 — a running Preview controls it from the record's runtime `value`.)
          ...(input.setRuntimeProps
            ? controlled(
                input,
                VALUE,
                opt(props.value ?? props.defaultValue) ?? null,
                (next) =>
                  next &&
                  typeof (next as { toString?: unknown }).toString ===
                    "function"
                    ? (next as { toString(format: string): string }).toString(
                        "hex",
                      )
                    : null,
              )
            : typeof props.defaultValue === "string" && props.defaultValue
              ? { defaultValue: props.defaultValue }
              : {}),
          ...(props.layout === "grid" || props.layout === "stack"
            ? { layout: props.layout }
            : {}),
        },
        ...renderAll(
          input,
          children(input).filter(
            (child) =>
              catalogTypeName(input.root, child) === "ColorSwatchPickerItem",
          ),
        ),
      );
    },
  },
  // ADR-256 Phase 5b: the picker's item — RAC `ColorSwatchPickerItem` (its `color` is the picker's
  // value for it and the ColorSwatch inside shows it through RAC's context), its children in order.
  colorswatchpickeritem: {
    render: (input) => {
      const props = input.node.props;
      const picker = input.root.domInputs.get(input.node.parentId);
      let color;
      try {
        color = parseColor(String(props.color || "#3b82f6"));
      } catch {
        color = parseColor("#3b82f6");
      }
      const element = createElement(
        AriaColorSwatchPickerItem as ElementType,
        {
          ...marker(input),
          style: input.style,
          className: "react-aria-ColorSwatchPickerItem",
          color,
          isDisabled:
            bool(props.isDisabled) || picker?.props.isDisabled === true,
        },
        ...renderAll(input),
      );
      // (Outside a picker RAC needs its collection: a host with no box.)
      return picker &&
        catalogTypeName(input.root, picker) === "ColorSwatchPicker"
        ? element
        : createElement(
            ColorSwatchPicker as ElementType,
            {
              key: `host:${input.node.id}`,
              "aria-label": "Color swatch sample",
              style: { display: "contents" },
            },
            element,
          );
    },
  },
  field: {
    render: (input) => {
      const props = input.node.props;
      return markerWrap(
        input,
        createElement(
          DataField as ElementType,
          {
            key: input.node.id,
            style: input.style,
            fieldKey: props.key,
            label: props.label,
            type: props.type,
            value: props.value,
            showLabel: props.showLabel !== false,
            visible: props.visible !== false,
          },
          ...renderAll(input),
        ),
      );
    },
  },
  form: {
    render: (input) => {
      const props = input.node.props;
      return createElement(
        Form as ElementType,
        {
          ...marker(input),
          style: input.style,
          action: opt(props.action),
          method: props.method || undefined,
          // ADR-280 Decision 9 — a Form without an authored destination (no `action`, not
          // `method="dialog"`) does not leave the page on submit (it would reload the Preview ·
          // the published page); an authored `action` · `dialog` keeps HTML's own submission.
          onSubmit: (event: { preventDefault(): void }) => {
            if (!str(props.action).trim() && props.method !== "dialog")
              event.preventDefault();
          },
          encType: props.encType || undefined,
          target: props.target || undefined,
          validationBehavior: props.validationBehavior || undefined,
          labelPosition: props.labelPosition || undefined,
          labelAlign: props.labelAlign || undefined,
          necessityIndicator: props.necessityIndicator || undefined,
          size: str(props.size) || "M",
        },
        ...renderAll(input),
      );
    },
  },
  // ADR-256 Phase 9: RAC Calendar · RangeCalendar drawing their node tree — the reference
  // starter's `div.months > div.month (repeated) > header (Button[previous] + CalendarHeading +
  // Button[next]) + CalendarGrid > CalendarCell` (each part its own binding in RAC's calendar
  // context), then the error text RAC names (`Text slot="errorMessage"`).
  calendar: {
    render: (input) => {
      const props = input.node.props;
      return calendarElement(input, RacCalendar, "Calendar", {
        selectionMode: catalogCalendarPicker(input.root, input.node)
          ? undefined
          : props.selectionMode === "multiple"
            ? "multiple"
            : "single",
        // (A running Preview: controlled from the record's runtime `value` — ADR-280; a picker's
        // calendar takes the picker's value from RAC's context.)
        ...(catalogCalendarPicker(input.root, input.node)
          ? {}
          : {
              ...controlled(
                input,
                VALUE,
                dateValue(props.value ?? props.defaultValue) ?? null,
                dateToOverride,
              ),
              ...focusedDateProps(input, props.value ?? props.defaultValue),
            }),
      });
    },
  },
  rangecalendar: {
    render: (input) =>
      calendarElement(input, RacRangeCalendar, "Range Calendar", {
        // (In a DateRangePicker RAC's context gives the picker's — a `false` here would override
        // it: RAC merges a defined own value over the context's.)
        allowsNonContiguousRanges: catalogCalendarPicker(input.root, input.node)
          ? undefined
          : bool(input.node.props.allowsNonContiguousRanges),
        ...(catalogCalendarPicker(input.root, input.node)
          ? {}
          : {
              ...controlled(
                input,
                VALUE,
                dateRangeValue(input.node.props.value),
                dateRangeToOverride,
              ),
              ...focusedDateProps(
                input,
                (
                  dateRangeValue(input.node.props.value) as {
                    start?: unknown;
                  } | null
                )?.start,
              ),
            }),
      }),
  },
};

/**
 * A picker calendar's props RAC's calendar context gives (`calendarProps` leaves the node's own
 * unset — `own`): the picker's state, bounds, paging and first day (ADR-256 Phase 9 — Properties
 * edits them on the picker), and `selectionMode` — a picker selects one date.
 */
export const CATALOG_PICKER_CALENDAR_PROPS: ReadonlySet<string> = new Set([
  "isDisabled",
  "isReadOnly",
  "isInvalid",
  "autoFocus",
  "pageBehavior",
  "firstDayOfWeek",
  "minValue",
  "maxValue",
  "errorMessage",
  "selectionMode",
]);

/** A DateRangePicker's RangeCalendar: those, and the picker's non-contiguous ranges. */
export const CATALOG_PICKER_RANGE_CALENDAR_PROPS: ReadonlySet<string> = new Set(
  [...CATALOG_PICKER_CALENDAR_PROPS, "allowsNonContiguousRanges"],
);

/**
 * A Calendar's · RangeCalendar's RAC element. In a DatePicker · DateRangePicker
 * (`catalogCalendarPicker` — ADR-256 Phase 6e) RAC's calendar context gives its value, bounds,
 * state, focus, paging and first day: the node's own values stay unset so they do not override it
 * (a calendar has no size — the picker's size is its field's). Its `visibleDuration` ·
 * `weeksInMonth` stay the node's (ADR-256 Phase 9 — the context carries neither, `useDatePicker` `calendarProps`).
 */
/**
 * RAC Calendar.md "Focused value" — in a running Preview the calendar's focused date (the month it
 * shows) is the record's runtime `focusedValue`: a rule's `focusDate` writes it, the user's
 * navigation (`onFocusChange`) too. Controlled from the first render (ADR-280 Decision 4) — it
 * starts where RAC would: the authored focused date, the value, else today.
 */
function focusedDateProps(
  input: DelegatedDomInput,
  value: unknown,
): Record<string, unknown> {
  if (!input.setRuntimeProps) return {};
  const props = input.node.props;
  return controlled(
    input,
    FOCUSED_VALUE,
    dateValue(props.focusedValue) ??
      dateValue(props.defaultFocusedValue) ??
      dateValue(value) ??
      today(getLocalTimeZone()),
    dateToOverride,
  );
}

function calendarElement(
  input: DelegatedDomInput,
  Component: ElementType,
  name: string,
  extra: Record<string, unknown>,
): ReactElement {
  const props = input.node.props;
  const picker = catalogCalendarPicker(input.root, input.node);
  const own = (value: unknown) => (picker ? undefined : value);
  const errorMessage = picker ? "" : str(props.errorMessage);
  const element = createElement(
    Component,
    {
      ...marker(input),
      style: input.style,
      "data-variant": str(props.variant || "default"),
      // (No `data-size` — the calendar has no size, 2026-10-13: its month follows its width.)
      "aria-label":
        typeof props["aria-label"] === "string"
          ? props["aria-label"]
          : own(name),
      isDisabled: own(bool(props.isDisabled)),
      isReadOnly: own(bool(props.isReadOnly)),
      isInvalid: own(bool(props.isInvalid)),
      pageBehavior: own(props.pageBehavior === "single" ? "single" : "visible"),
      firstDayOfWeek: own(firstDayOfWeek(props.firstDayOfWeek)),
      minValue: own(dateValue(props.minValue)),
      maxValue: own(dateValue(props.maxValue)),
      defaultFocusedValue: own(dateValue(props.defaultFocusedValue)),
      autoFocus: own(bool(props.autoFocus)),
      visibleDuration: catalogCalendarDurationFits(props.visibleDuration)
        ? props.visibleDuration
        : undefined,
      weeksInMonth: wholeCount(props.weeksInMonth),
      ...extra,
    },
    ...renderAll(input),
    ...(errorMessage
      ? [
          createElement(
            AriaText as ElementType,
            { key: `${input.node.id}:error`, slot: "errorMessage" },
            errorMessage,
          ),
        ]
      : []),
  );
  return withI18n(element, props.locale, props.calendarSystem);
}

/** The Tabs a part sits in (through the frames and free content around it). */
function tabsAncestor(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  for (
    let cursor = root.domInputs.get(node.parentId);
    cursor;
    cursor = root.domInputs.get(cursor.parentId)
  )
    if (catalogTypeName(root, cursor) === "Tabs") return cursor;
  return undefined;
}

function tabsModel(
  root: CatalogCompositionRoot,
  tabsNode: CatalogConsumerNode,
) {
  return catalogTabsSelection(
    tabsNode,
    (id) => root.domInputs.get(id),
    (node) => catalogTypeName(root, node),
  );
}

/**
 * A named RAC state's value as the component starts — the same model the uncontrolled RAC
 * component is given here (Tabs' key, a collection's Selected items, the Slider's snapped value,
 * a RadioGroup's Selected Radio …): the variable's default when the state is named.
 */
export function catalogStateSourceValue(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  prop: string,
  runtimeOf?: (
    recordId: string,
  ) => Readonly<Record<string, unknown>> | undefined,
): unknown {
  const props = node.props;
  const type = catalogTypeName(root, node);
  // (ADR-284 Phase 6 — a state prop that reads a variable (「검색 추가」 · 「변수로 정하기」) is the
  //  variable's value: it beats the items' start selection — a RadioGroup's 「전체」 after a pick.)
  if (
    isPropVar(
      (node as { templateProps?: Record<string, unknown> }).templateProps?.[
        prop
      ],
    )
  )
    return props[prop];
  switch (prop) {
    case "selectedKey":
      return type === "Tabs"
        ? str(tabsModel(root, node).selectedKey)
        : (props.selectedKey ?? null);
    case "selectedKeys":
      if (type === "ToggleButtonGroup")
        return groupToggleButtons(node, root)
          .buttons.filter((button) => button.props.isSelected === true)
          .map((button) => button.id);
      if (type === "TagGroup")
        return tagGroupTags(root, node)
          .filter((tag) => tag.props.isSelected === true)
          .map(tagKey);
      if (type === "CardView")
        return str(props.selectionMode || "none") === "none"
          ? []
          : childrenOf(root, node)
              .filter(
                (card) =>
                  catalogTypeName(root, card) === "Card" &&
                  card.props.isSelected === true,
              )
              .map((card) =>
                resolveStaticItemKey(
                  card.props as Record<string, unknown>,
                  card.id,
                ),
              );
      return catalogCollectionSelectedKeys(root, node);
    case "expandedKeys":
      if (type === "DisclosureGroup") {
        const { disclosures } = groupDisclosures(node, root);
        const expanded = resolveGroupExpandedDisclosureIds(
          props as Record<string, unknown>,
          disclosures.map((child) => ({
            id: child.id,
            type: catalogTypeName(root, child),
            props: {
              ...(child.props as Record<string, unknown>),
              ...runtimeOf?.(child.id),
            },
          })),
        );
        return disclosures
          .filter((child) => expanded.has(child.id))
          .map((child) => child.id);
      }
      if (Array.isArray(props.expandedKeys))
        return props.expandedKeys.map(String);
      return Array.isArray(props.defaultExpandedKeys)
        ? props.defaultExpandedKeys.map(String)
        : [];
    case "isExpanded":
      return Boolean(props.isExpanded ?? true);
    case "isSelected":
      return Boolean(props.isSelected);
    case "value": {
      if (type === "Slider") return catalogSliderRange(node).value;
      if (type === "CheckboxGroup")
        return catalogToggleGroupItems(
          node,
          "Checkbox",
          domGet(root),
          (record) => catalogTypeName(root, record),
        )
          .items.filter((box) => box.props.isSelected === true)
          .map(groupItemValue);
      if (type !== "RadioGroup") return props.value;
      const selected = catalogToggleGroupItems(
        node,
        "Radio",
        domGet(root),
        (record) => catalogTypeName(root, record),
      ).items.find((radio) => radio.props.isSelected === true);
      return selected?.props.value !== undefined
        ? String(selected.props.value)
        : str(props.value);
    }
    default:
      return props[prop];
  }
}

export const CATALOG_DELEGATED_DOM: Readonly<
  Record<string, DelegatedDomBinding>
> = DELEGATED;
