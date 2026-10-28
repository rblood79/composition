import type { ComponentRule } from "../../types/catalog-style.types";
/** ADR-248 Phase 1. This module has no Builder or persistence dependency. */
export const CATALOG_FORMAT = "composition-catalog" as const;
export const CATALOG_SCHEMA_VERSION = 1 as const;
/**
 * Library contract the document's template IDs refer to. 2 — ADR-251: RadioGroup · CheckboxGroup
 * templates hold their items in a RadioItems / CheckboxItems node (`component-radiogroup__2` is
 * the wrapper, no longer the first Radio). 3 — ADR-253: a field's parts are instances of the part
 * origins (`component-textfield__1` is an instance of the Label origin; its Label is that
 * origin's template root). 4 — ADR-253 Phase 3: every field · group Label position
 * (`component-select__1` …) is an instance of the Label origin. 5 — ADR-253 Phase 4: a Select ·
 * ComboBox holds its items in its ListBox (`component-select__listbox`, an instance of the ListBox
 * origin whose slot the items fill — `component-select__item-1` sits below it). 6 — ADR-254
 * Phase 2: the title and description positions of the Dialog · Popover · Card · InlineAlert ·
 * Tooltip origins (`component-card__title` …) are instances of the Heading · Description origins.
 * 7 — ADR-255: the Popover origin is `DialogTrigger > Button + Popover`, the Tooltip origin
 * `TooltipTrigger > Button + Tooltip` (the overlay one level down, `component-popover__overlay`).
 * 8 — ADR-256 Phase 2: a field's Label · Description positions carry `presentWhen: "nonEmptyText"`
 * (their presence is that value condition; a binding alone keeps every node), and the field
 * draws its node tree. 9 — ADR-256 Phase 3: Checkbox · Switch · Radio are `*Field > *Button`
 * (`component-checkbox__button` holds the indicator and the text `component-checkbox__1`) with
 * Description (· FieldError) positions; a CheckboxGroup · RadioGroup Label · Description carry
 * `presentWhen`. 10 — ADR-256 Phase 5a: a Breadcrumb's label position is a RAC `Link`
 * (`component-breadcrumb-item-default__label`, `href` bound to the crumb's) and its separator Icon
 * is there while the crumb is not current (`showWhen: { all: [{ not: "isCurrent" }] }`). 11 —
 * ADR-256 Phase 5b: a ColorSwatchPicker's items are `ColorSwatchPickerItem` positions
 * (`component-colorswatchpicker__1` …, the item `color`) each holding a ColorSwatch instance. 12 —
 * ADR-256 Phase 5c: a ListBox · GridList · Menu item's description Text carries `presentWhen`. 13 —
 * ADR-256 Phase 5d: a Tag holds a remove `Button[slot=remove]` (`component-tag-item-default__remove`,
 * `showWhen: { all: ["allowsRemoving"] }`) and its label Text has no slot name; a TagGroup holds
 * Description · FieldError positions (`component-taggroup__description` · `__error`). 14 — ADR-256
 * Phase 5e: a Tab holds a `SelectionIndicator` (`component-tab-item-default__indicator`) and its
 * label Text has no slot name. 15 — ADR-256 Phase 5f: the Checkbox origin takes `slot` (a
 * collection item's `Checkbox[slot=selection]`) and its label carries `presentWhen`. 16 — ADR-256
 * Phase 5g: a MenuItem's shortcut is a RAC `Keyboard` (`component-menu-item-default__shortcut`,
 * `presentWhen`) in place of a `Text[slot=shortcut]`. 17 — ADR-256 Phase 5g: a MenuItem holds the
 * submenu chevron (`component-menu-item-default__chevron`, `showWhen: { all: ["hasSubmenu"] }`).
 * 18 — ADR-256 Phase 5h: a TreeItem's row is a RAC `TreeItemContent`
 * (`component-tree-item-default__content`) holding the chevron `Button[slot=chevron] > Icon` and the
 * label, in place of a `TreeItemChevron` and the label as the item's children.
 * 19 — ADR-256 Phase 6b: a field's control wrapper (NumberField · SearchField · ComboBox ·
 * DatePicker · DateRangePicker `__2`) is a RAC `Group` in place of a `SelectTrigger`. 20 —
 * ADR-256 Phase 6c: a Select's ListBox sits in its Popover (`component-select__popover`,
 * `hideArrow`) — `Select > Label + Button + Description + FieldError + Popover > ListBox`. 21 —
 * ADR-256 Phase 6d: a ComboBox's ListBox sits in its Popover (`component-combobox__popover`,
 * `hideArrow`) — `ComboBox > Label + Group(Input + Button) + Description + FieldError + Popover >
 * ListBox`. 22 — ADR-256 Phase 6e: a DatePicker's Calendar · a DateRangePicker's RangeCalendar
 * (was a Calendar) sits in its Popover (`component-datepicker__popover` ·
 * `component-daterangepicker__popover`, `hideArrow`) — `DatePicker > Label + Group(DateInput +
 * Button) + Description + FieldError + Popover > Calendar`. 23 — ADR-256 Phase 6h: a Column's
 * name sits in a RAC `Group` (`Column > Group[role=presentation] > Text {children}` — the
 * reference's `.column-name`); the palette Table's starter columns are plain Columns.
 * 24 — ADR-256 Phase 7a: a ProgressBar's value text binds RAC's `{valueText}`
 * (`component-progressbar__2`) and its track holds a `ProgressBarFill` (`__3_1`, width
 * `{percentage}%`); its Label carries `presentWhen`. 25 — ADR-256 Phase 7b: a Meter the same
 * (`component-meter__2` `{valueText}` · `__3_1` `MeterFill`, Label `presentWhen`). 26 — ADR-256
 * Phase 7c: a Slider's track holds a RAC `SliderFill` (`component-slider__3_2`) before its thumb and
 * takes no value of its own; its SliderOutput has no text (RAC writes the value); Label `presentWhen`.
 * 27 — ADR-256 Phase 8a: a Popover's · Tooltip's arrow is an `OverlayArrow` node
 * (`component-popover__arrow` · `component-tooltip__arrow`); no Popover `hideArrow` (origin accepts ·
 * the picker Popovers). 28 — ADR-256 Phase 8b: a Dialog opens in its `Modal` node
 * (`component-dialog__modal` — `DialogTrigger > Button + Modal > Dialog`); `isDismissable` is the
 * Modal's. 29 — ADR-256 Phase 8c: a Disclosure is `Heading > Button[slot=trigger] > (Icon + Text)`
 * + `DisclosurePanel > Text` (`component-disclosure__heading` … `__content`; no DisclosureHeader ·
 * DisclosureChevron · DisclosureContent). 30 — ADR-256 후속 4: a Menu is `MenuTrigger > Button +
 * Popover > Menu` (`component-menu__trigger` · `__popover` · `__menu`; the origin accepts `size` ·
 * `selectionMode`) — the Menu node is RAC's list, its trigger the Button node. 31 — a Tag has no
 * `variant` (RAC · S2 Tag has none): a selected Tag is its TagGroup's selection — the Tag's
 * `isSelected` (Selected) gives the group's `defaultSelectedKeys` (2026-10-09). 32 — a collection
 * (TagGroup · ListBox · GridList · Menu · Select · ComboBox) takes no `items` (the old items-manager
 * array): its items are its child nodes (RAC static collection) or its data binding (RAC dynamic
 * collection — the rows with the item node as their template) (2026-10-09). 33 — the props a
 * node now carries or that nothing read are gone (2026-10-09 property audit): Breadcrumbs `items`,
 * Tabs `showIndicator`, Tab `title`, Pagination `totalPages` · `currentPage`, Tag `allowsRemoving`
 * (its TagGroup's), Menu `isDisabled`, CardView `gap` (Styles gap), SelectValue · DatePicker ·
 * DateRangePicker `placeholder`, the pickers' `showCalendarIcon` (the Button node), Input's field
 * states, InlineAlert `heading` · `children`, Card `footer` · `orientation` · `isSelectable`, Toast
 * `defaultTitle` · `defaultDescription` · `timeout`, the calendar parts' `locale` ·
 * `calendarSystem` · header `children`, FileUpload's file options (its FileTrigger's), and
 * one-choice variants / sizes. 34 — the S2 IllustratedMessage is a node tree (2026-10-09):
 * `IllustratedMessage > Illustration + Heading + Description` (origin `component-illustratedmessage`,
 * `{title}` · `{description}`) with `orientation`; its `heading` · `description` props are gone.
 * 35 — the S2 AvatarGroup's `label` is a Text node after the avatars (2026-10-09): origin
 * `component-avatargroup` accepts `label` (`__label` — `{label}`); the type has no `label` prop.
 * 36 — sizes take the S2 names (2026-10-09, D2 = S2 1.8.0): `XS` · `S` · `M` · `L` · `XL` (and
 * `XXL` · `XXXL` for the text types) in place of `xs` · `sm` · `md` · `lg` · `xl` · `2xl` · `3xl`
 * — a node's `size`, the origins' defaults, the rule size keys and the DOM `data-size`.
 * 37 — ADR-256 Phase 9: a Calendar · RangeCalendar is the reference starter's node tree — `frame >
 * CalendarMonth > CalendarHeader (Button[slot=previous] (showWhen isFirstMonth) + CalendarHeading +
 * Button[slot=next] (showWhen isLastMonth)) + CalendarGrid > CalendarCell` (`component-calendar__months`
 * … `__cell`; the month block repeats per shown month); `visibleDuration` · `weeksInMonth` in place
 * of `maxVisibleMonths`. The grid's weekday cell (`__weekday` — CalendarHeaderCell) and a date input's
 * segment (`component-dateinput__segment` — DateSegment) are repeat templates too (Decision 13); the
 * month · year pickers (CalendarMonthPicker · CalendarYearPicker) are origins of their own.
 * 38 — ADR-256 Phase 10: the S2 Card — `Card > CardPreview + Content (Text[slot=title] +
 * Text[slot=description]) + Footer` (CardHeader gone; CardContent · CardFooter are the shared S2
 * types `Content` · `Footer`); the Card origin takes no `title` · `description` (its Text nodes hold
 * them). An InlineAlert's description sits in a `Content` (`component-inline-alert__content`).
 * 39 — ADR-256 Phase 11 (G5): the ListBox · GridList section origins' items carry no fixed `id`
 * (`item-1` · `item-2`) — two sections in one collection shared their RAC keys; an item's key is
 * its node id unless the author gives one.
 * 40 — ADR-256 Phase 11 (G5 example 5): the SearchField is the reference's `SearchField > Label +
 * Icon + Input + Button + Description + FieldError` — no control `Group` (its grid places them).
 * 41 — ADR-258 Phase 2: the Color controls are the reference trees — `ColorArea > ColorThumb`,
 * `ColorSlider > Label {label} + SliderOutput + SliderTrack > ColorThumb`, `ColorWheel >
 * ColorWheelTrack + ColorThumb` (origins `component-colorarea` · `-colorslider` · `-colorwheel`; the
 * new types ColorThumb · ColorWheelTrack). A ColorArea · ColorSlider · ColorWheel saved without
 * those parts is a 40 document (사용자 결정 1 — refused, not converted).
 * 42 — ADR-275 Phase 2: an authored absolute box is `layout.position: absolute` + `inset*` (the
 * node `placement` field is gone). A 41 document with a `placement` is refused (사용자 결정 1).
 * ADR-275 Phase 6 (same contract — additive): a node's `layout.position` may be `sticky`.
 * 43 — ADR-276: the Button · ToggleButton origins are `Button > Icon{icon} + Text{label}` (the
 * IconButton template — `component-button__icon` · `__label`, the label `presentWhen`, an unfilled
 * `{icon}` draws nothing) and the nested Button positions of other origins carry their words as
 * `label`; the IconButton origin is gone. A 42 document (an own `children` Button, an IconButton
 * instance) is refused (사용자 결정 2026-10-20).
 * 44 — ADR-277: the table is one type — the TableView origin · template are gone and the Table
 * origin's template carries the starter (`component-table__1_1..3` Columns Name · Type · Status,
 * `__2_1` a table-row instance with three Cells). A 43 document (a TableView instance, a Table
 * whose template had no starter) is refused (사용자 결정 2026-10-21).
 * 46 (ADR-279): a definition owns its template — the ADR-260 reference field is gone; a
 * component's origin lives on the Local page and an instance stands where the node stood. A 45
 * document (an origin on a page, a hidden template) is refused.
 * 47 (same contract — additive): a rule may append to, update or remove from a collection
 * (`append` · `update` · `remove` — `useListData.append` · `update` · `remove`) or load it
 * again (`reload` — `useAsyncList.reload` — ADR-281
 * user decision 3, second step); a 47 document without one is unchanged.
 * 48 — ADR-282: a library origin's project override may own a copy of the origin's template
 * (`templateRootId` · `templateMap` — the origin unlocked on the Library page); the copy is the
 * origin's template for every instance. A 47 document is refused (사용자 지시 2026-10-14).
 * 49 — ADR-283: a capability action's target is a place reference (`target` — `{ nodeId }` ·
 * `{ address }` · `{ local }` · `{ unset }`) instead of a page node id (`targetId`). A 48 document
 * is refused.
 * 50 — ADR-284: a rule's Do is a list (`actions`, one action = a list of one) instead of one
 * `action`; a binding may read a view (`viewId` · `view`) and the project lists shared views
 * (`viewIds`). A 49 document is refused.
 * 51 — ADR-286: data definitions (collections · API endpoints · project variables) are document
 * entries (`collection` · `endpoint` · `projectVariable`, listed by the project), and the project
 * holds its site settings (`site`) and a page its own (`meta`). A 50 document is refused.
 * An earlier contract's document is refused, never re-mapped.
 */
export const LIBRARY_CONTRACT_VERSION = 51 as const;

export type EntryKind =
  | "project"
  | "page"
  | "definition"
  | "definitionOverride"
  | "node"
  | "theme"
  | "token"
  | "stateVariable"
  | "interaction"
  | "asset"
  | "view"
  | "collection"
  | "endpoint"
  | "projectVariable";
/** ADR-286 — the data entries keep their data reference ids (`data:collection:` …). */
export type DataEntryKind = "collection" | "endpoint" | "projectVariable";
export type EntryId<K extends EntryKind = EntryKind> = `project:${Exclude<
  K,
  DataEntryKind
>}:${string}`;
export type LibraryDefinitionId = `lib:definition:${string}`;
export type LibraryTemplateId = `lib:template:${string}`;
export type LibraryTokenId = `lib:token:${string}`;
export type DefinitionId = EntryId<"definition"> | LibraryDefinitionId;
export type TemplateId = EntryId<"node"> | LibraryTemplateId;
export type TokenId = EntryId<"token"> | LibraryTokenId;
export type NodeId = EntryId<"node">;
export type DataCollectionId = `data:collection:${string}`;
export type DataFieldId = `data:field:${string}`;
export type DataEndpointId = `data:endpoint:${string}`;
export type ProjectVariableId = `data:variable:${string}`;

export type Scalar = string | number | boolean;
export interface TokenUse {
  kind: "token";
  tokenId: TokenId;
}
/** A flat collection row: scalar cells. */
export type ItemRow = Readonly<Record<string, Scalar>>;
/**
 * One row of an items-manager prop (static collection items, chart series …): scalar cells; a
 * section row (ADR-099) also holds its own rows one level down (`items`).
 */
export type ItemValue = Readonly<Record<string, Scalar | readonly ItemRow[]>>;
/**
 * Structured prop values (Phase 4b): a string list (`string-array` prop kind) or a list of flat
 * item records (`items-manager` prop kind — RSP dynamic collection items, Chart series).
 */
export type StructuredValue = readonly string[] | readonly ItemValue[];
/**
 * ADR-256 Phase 9 — a Calendar · RangeCalendar `visibleDuration` (RAC `DateDuration`, one unit with
 * a whole count ≥ 1 — `catalogCalendarDurationFits`). Its own value type: never a token, never in a
 * visual field, state variable or condition.
 */
export type CalendarDuration =
  | { readonly days: number }
  | { readonly weeks: number }
  | { readonly months: number };
/**
 * S2 · RAC `formatOptions` (사용자 결정 2026-10-12) — `numberFormat`, an object of its own (never a
 * token, a visual field, a state variable or a condition). Shape: `numberFormatValue.ts`.
 */
export interface NumberFormatValue {
  readonly style?: "decimal" | "percent" | "currency" | "unit";
  readonly currency?: string;
  readonly currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name";
  readonly currencySign?: "standard" | "accounting";
  readonly unit?: string;
  readonly unitDisplay?: "short" | "long" | "narrow";
  readonly minimumIntegerDigits?: number;
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
  readonly useGrouping?: boolean;
  readonly signDisplay?: "auto" | "never" | "always" | "exceptZero";
}
/**
 * ADR-284 Phase 6 — a boolean prop that reads a value condition (ios-list's
 * `isDisabled={selectedKeys !== 'all' && selectedKeys.size === 0}`): true while `subject` compares as
 * `op` with `value` — the view condition's closed vocabulary over one value instead of a row. The
 * subject is a variable reference (`!var.<id>[.path]`; `.size` = a selection's count). Resolved where
 * `{{ }}` is (the record's variables — runtime values in Preview · Publish, defaults in the Canvas).
 */
export interface PropWhen {
  kind: "when";
  subject: string;
  op: ViewComparison;
  value?: ViewConditionValue;
}
/**
 * ADR-284 Phase 6 — a prop that is a variable's value (a state prop RAC controls: the photos
 * sidebar's `selectedKeys={[album]}` — a key list prop of a text variable holds its one key). Text
 * props read a variable as a whole `{{ name }}` template instead.
 */
export interface PropVar {
  kind: "var";
  ref: string;
}
export type AuthoredValue =
  | Scalar
  | TokenUse
  | StructuredValue
  | CalendarDuration
  | NumberFormatValue
  | PropWhen
  | PropVar;
/**
 * `slot` (ADR-256 Decision 4): RAC's named slot of a part — a slot name, or `false` = the explicit
 * `slot={null}` (detach from the parent's context). Absent = unset (RAC's default slot or a plain
 * context). The three are different values in storage and validation.
 */
export type ValueType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "items"
  | "slot"
  // ADR-257 — S2 Column widths (`ColumnSize` · `ColumnStaticSize`: a px number or "Nfr" · "N%").
  | "columnSize"
  | "columnStaticSize"
  // ADR-256 Phase 9 — a Calendar's `visibleDuration` (`CalendarDuration`).
  | "calendarDuration"
  // ADR-258 — a Color control's color string in RAC's `parseColor` syntax (`isRacColorString`).
  | "racColor"
  // S2 · RAC `formatOptions` — `catalogNumberFormatFits` (사용자 결정 2026-10-12).
  | "numberFormat";
/** Resolved prop value: a scalar, a structured value, a calendar duration or a number format. */
export type PropValue =
  | Scalar
  | StructuredValue
  | CalendarDuration
  | NumberFormatValue
  | PropWhen
  | PropVar;
export type TokenType = "color" | "length" | "number" | "string" | "boolean";
export type ThemePreset = {
  tint:
    | "red"
    | "orange"
    | "yellow"
    | "green"
    | "turquoise"
    | "cyan"
    | "blue"
    | "indigo"
    | "purple"
    | "pink";
  neutral: "slate" | "gray" | "zinc" | "neutral" | "stone";
  radius: "none" | "sm" | "md" | "lg" | "xl";
  darkMode: "light" | "dark" | "system";
};
export type VisualField =
  | "color"
  | "backgroundColor"
  | "borderColor"
  | "fill"
  | "opacity"
  | "fontSize"
  | "lineHeight"
  | "fontWeight"
  | "width"
  | "height"
  | "overflow"
  | "radius"
  | "gap"
  | "padding"
  | "borderWidth"
  | "borderStyle"
  | "fillAlpha"
  | "minHeight"
  | "thumbSize"
  | "indentPerLevel"
  | "iconGap"
  | "iconSize"
  // ADR-248 Phase 3 typed extension (사용자 승인 2026-09-29): per-axis padding and min width.
  | "paddingX"
  | "paddingY"
  | "minWidth"
  // Per-side padding (an asymmetric stylesheet padding); a side wins over paddingX/paddingY.
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  // ADR-248 Phase 4a: the Style panel's node authoring surface (typography, effects,
  // per-corner radius and per-side border width). CSS values keep their CSS text where the
  // property has no finite typed form (`boxShadow`, `filter`, `transform`, background image).
  | "fontFamily"
  | "fontStyle"
  | "letterSpacing"
  | "textAlign"
  | "textTransform"
  | "textDecoration"
  | "whiteSpace"
  | "wordBreak"
  // ADR-248 Phase 4e-6-31 (사용자 승인 2026-10-01): the Text behavior presets' wrap and
  // truncation keys (`overflow-wrap` is inherited; `text-overflow` is the box's own).
  | "overflowWrap"
  | "textOverflow"
  | "boxShadow"
  | "filter"
  | "transform"
  | "zIndex"
  | "aspectRatio"
  | "backgroundImage"
  | "backgroundSize"
  | "radiusTopLeft"
  | "radiusTopRight"
  | "radiusBottomRight"
  | "radiusBottomLeft"
  | "borderTopWidth"
  | "borderRightWidth"
  | "borderBottomWidth"
  | "borderLeftWidth";
/** Box layout declarations consumed by the Rust layout input and the isolated RAC DOM style. */
export type LayoutField =
  | "display"
  | "flexDirection"
  | "alignItems"
  | "justifyContent"
  | "flexWrap"
  // ADR-248 Phase 3 typed extension (사용자 판정 2026-09-29 — typed 입력 확장): item and
  // placement declarations authored by templates (origin `style`), as CSS values.
  | "position"
  // With `position: absolute`: CSS `left`/`top` from the containing block (Rust `insetLeft`/
  // `insetTop`) — a stylesheet-placed sub-part (a collection item's icon slot).
  | "insetLeft"
  | "insetTop"
  // ADR-275: a node-authored absolute box takes any of the four (Position section constraints); a
  // sticky box's are its stick thresholds (Phase 6 — unset = auto, that side does not stick).
  | "insetRight"
  | "insetBottom"
  | "flexGrow"
  | "flexShrink"
  | "flexBasis"
  | "alignSelf"
  | "justifySelf"
  | "gridColumnStart"
  | "gridColumnEnd"
  | "gridRowStart"
  | "gridRowEnd"
  | "rowGap"
  | "columnGap"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft"
  | "verticalAlign"
  // Container tracks and limits of a rule's Canvas box (`resolveCatalogRuleCanvasBox`).
  | "gridTemplateColumns"
  | "gridTemplateRows"
  | "gridTemplateAreas"
  | "maxWidth"
  | "maxHeight"
  /** CSS `order` of a flex / grid item (the composition root reorders the engine children). */
  | "order";
export type LayoutValues = Readonly<Partial<Record<LayoutField, string>>>;
/** Node-authored box layout writes (CSS text values, validated per field). */
export type LayoutWrites = Readonly<
  Partial<Record<LayoutField, WriteValue<string>>>
>;
export type SizingField =
  "width" | "height" | "minWidth" | "minHeight" | "maxWidth" | "maxHeight";
export type StateName =
  | "hover"
  | "pressed"
  | "selected"
  | "selectedHover"
  | "selectedPressed"
  | "disabled"
  | "focusVisible";
/**
 * The one state a state-origin template node shows statically (the Components page's
 * `Button/Hover`, `Checkbox/Unselected`, `Disclosure/Collapsed` …). It is the instance layer's own:
 * an outer instance's display state replaces the one of the template it instantiates.
 */
export type DisplayStateName =
  | "selected"
  | "unselected"
  | "disabled"
  | "hover"
  | "pressed"
  | "focusVisible"
  | "collapsed"
  | "current"
  /**
   * ADR-278: a closed overlay (a trigger's Modal · Popover · Tooltip) shown open — the Components
   * page draws an overlay origin's body beside its trigger. No paint state, no RAC prop.
   */
  | "open";
export const DISPLAY_STATE_NAMES: readonly DisplayStateName[] = [
  "selected",
  "unselected",
  "disabled",
  "hover",
  "pressed",
  "focusVisible",
  "collapsed",
  "current",
  "open",
];
export type BreakpointName = "desktop" | "tablet" | "mobile";
export type PagePlacementField =
  | "position"
  | "left"
  | "top"
  | "gridColumnStart"
  | "gridColumnEnd"
  | "gridRowStart"
  | "gridRowEnd";
export interface PageLayoutDeclaration {
  direction?: "auto" | "vertical" | "horizontal";
  gap?: number;
  columns?: number | "auto";
  /** `columns: "auto"` 의 기준 배율 (%, 10 ~ 100) — breakpoint 공통. 부재 = 40 (ADR-274). */
  autoFitZoom?: number;
  breakpoints?: Partial<
    Record<BreakpointName, { gap?: number; columns?: number | "auto" }>
  >;
}
export interface PagePlacementDeclaration {
  base: Partial<Record<PagePlacementField, string | number>>;
  breakpoints: Partial<
    Record<BreakpointName, Partial<Record<PagePlacementField, string | number>>>
  >;
}
export interface PageGuideDeclaration {
  id: string;
  axis: "x" | "y";
  position: number;
}
export type WriteValue<T> =
  { kind: "set"; value: T } | { kind: "remove" } | { kind: "mask" };
export type PropWrites = Readonly<Record<string, WriteValue<AuthoredValue>>>;
export type VisualWrites = Readonly<
  Partial<Record<VisualField, WriteValue<AuthoredValue>>>
>;
export type SizingWrites = Readonly<
  Partial<Record<SizingField, WriteValue<number | null>>>
>;
export type PropValues = Readonly<Record<string, AuthoredValue>>;
export type VisualValues = Readonly<
  Partial<Record<VisualField, AuthoredValue>>
>;
export type StateRules = Readonly<Partial<Record<StateName, VisualWrites>>>;
/** Scalar equality on resolved props; every key must be an accepted prop of the owner definition. */
export type PropCondition = Readonly<Record<string, Scalar>>;
/**
 * Ordered rule applied after `propVisualRules`: matches when every `when` prop equals the resolved
 * value and, if present, `state` is the resolution state. Later rules win.
 */
export interface ConditionalRule {
  when: PropCondition;
  state?: StateName;
  visual?: VisualValues;
  layout?: LayoutValues;
}
/**
 * Values a parent definition applies to its direct children of `child.definitionId` (and, when
 * given, whose resolved props equal `child.props`). Replaces CSS child-selector delegation.
 */
export interface PartRule {
  /**
   * `via`: the rule targets the matching children of a direct child of `via` (a descendant
   * selector through a sub-part wrapper, e.g. `NumberField > Group > Input`).
   */
  child: {
    definitionId: LibraryDefinitionId;
    props?: PropCondition;
    via?: LibraryDefinitionId;
    /** With `via`: resolved props the intermediate wrapper must have. */
    viaProps?: PropCondition;
  };
  when?: PropCondition;
  state?: StateName;
  visual?: VisualValues;
  layout?: LayoutValues;
}

export interface InstanceAddress {
  /** First ID is the authored instance; later IDs are nested template instances. */
  instances: readonly (NodeId | TemplateId)[];
  /** Root-to-target IDs inside the final referenced definition. */
  templatePath: readonly TemplateId[];
}

/** The fields an instance writes at one of its template positions (a `patch`, or a `fillSlot`'s own). */
export interface DescendantPatchFields {
  props?: PropWrites;
  visual?: VisualWrites;
  sizing?: SizingWrites;
  stateRules?: StateRules;
  /** `false` hides the addressed descendant (slot toggle); absent keeps the template value. */
  enabled?: boolean;
  /**
   * ADR-278: the display state shown at the addressed descendant (an instance root layer's
   * `displayState` for one position — the Components page opens an overlay origin's body with
   * `open`). Below the instance's own root layer, above the template node's.
   */
  displayState?: DisplayStateName;
  /** ADR-248 Phase 4b: the node authoring fields a path override can write (§3.4). */
  layout?: LayoutWrites;
  fills?: readonly CatalogFillLayer[];
  fillSizing?: FillSizing;
  responsive?: Partial<Record<ResponsiveBreakpointName, NodeResponsiveLayer>>;
  visibility?: Partial<Record<BreakpointName, boolean>>;
  /**
   * ADR-281 Decision 4: the origin's rules this instance changes at the position — keyed by the
   * template node's rule, `"off"` (it does not run here) or this instance's own rule at the same
   * address (it runs instead). Read by `effectiveInteractions.ts` (the panel and the Preview).
   */
  interactions?: Readonly<
    Record<EntryId<"interaction">, "off" | EntryId<"interaction">>
  >;
}

export type DescendantOverride =
  | ({ kind: "patch"; address: InstanceAddress } & DescendantPatchFields)
  | { kind: "replace"; address: InstanceAddress; replacementId: NodeId }
  /**
   * The instance's own child list at a position (its slot contents — owned since 2026-10-14 when
   * placed). One override per address: the position's own field writes ride along (a Card's
   * Content styled after its items became the instance's).
   */
  | ({
      kind: "fillSlot";
      address: InstanceAddress;
      childIds: readonly NodeId[];
    } & DescendantPatchFields);

/** The field writes an override holds at its position (a `replace` holds none). */
export function descendantPatchOf(
  override: DescendantOverride | undefined,
): (DescendantPatchFields & { address: InstanceAddress }) | undefined {
  return override && override.kind !== "replace" ? override : undefined;
}

export interface DataBindingRef {
  collectionId: DataCollectionId;
  fieldMap: Readonly<Record<string, DataFieldId>>;
  /**
   * `useListData.getItem(key)` — one item of the collection: a literal key or a `{{ }}` template
   * (`{{ params.id }}` · a variable). Absent = every item. A container's descendants read the
   * item's fields (`{name}`); a collection component shows that item only.
   */
  key?: string;
  /**
   * ADR-284 — a shared view the binding reads (named, `ProjectEntry.viewIds`); its root collection
   * is `collectionId`. Absent = the binding's own (built-in) view below, or every row.
   */
  viewId?: EntryId<"view">;
  /** ADR-284 — the binding's built-in view (unnamed) over `collectionId`; never with `viewId`. */
  view?: ViewQuery;
}

/**
 * ADR-284 — a field path: field ids from the source collection, through reference fields
 * (`[teamId, name]` = `team.name`). Stored by id so a rename keeps it.
 */
export type DataFieldPath = readonly DataFieldId[];
/**
 * ADR-284 Decision 2 — the closed comparison vocabulary. Text ones follow RAC `useFilter`
 * (`Intl.Collator` `usage: "search"`, `sensitivity: "base"`) and `not…` is its `!` (the emoji
 * picker's `!label.startsWith('regional indicator')`); `oneOf` = the value is one of a list
 * (a `Selection`), `containsAny` · `containsAll` read an array field; `between` includes both ends;
 * `before` · `after` · `withinLast` compare dates by day.
 */
export type ViewComparison =
  | "equals"
  | "notEquals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "notContains"
  | "notStartsWith"
  | "notEndsWith"
  | "oneOf"
  | "containsAny"
  | "containsAll"
  | "gte"
  | "gt"
  | "lte"
  | "lt"
  | "between"
  | "before"
  | "after"
  | "withinLast"
  | "exists"
  | "notExists";
export const VIEW_COMPARISONS: readonly ViewComparison[] = [
  "equals",
  "notEquals",
  "contains",
  "startsWith",
  "endsWith",
  "notContains",
  "notStartsWith",
  "notEndsWith",
  "oneOf",
  "containsAny",
  "containsAll",
  "gte",
  "gt",
  "lte",
  "lt",
  "between",
  "before",
  "after",
  "withinLast",
  "exists",
  "notExists",
];
/** A condition's value: a literal, a list (`oneOf` · `between`) or a rule value reference string. */
export type ViewConditionValue = Scalar | readonly Scalar[];
/**
 * ADR-284 — one condition: `filter`'s one term. Any of `fields` matching is a match (plants'
 * `name` OR `scientific` contains the search). `value` may be a rule value reference
 * (`!var.<id>` · `!event.<arg>` — `interactions/valueRef.ts`).
 */
export interface ViewCondition {
  /** Stable within the view (re-editing · the run explanation name the same condition). */
  id: string;
  fields: readonly DataFieldPath[];
  op: ViewComparison;
  value?: ViewConditionValue;
  /**
   * The value that skips the condition (passes every row): `"empty"` (default — no value · `""` ·
   * `[]`) or a literal (a RadioGroup's `"all"`).
   */
  skip?: "empty" | Scalar;
  /** Whether it applies: a boolean or a reference (a Checkbox's `!var.<id>`); false skips it. */
  enabled?: Scalar;
  /** Text comparisons — `Intl.Collator` sensitivity (default `base`, as `useFilter`). */
  sensitivity?: "base" | "accent" | "case" | "variant";
  /** `withinLast` — the value counts these units back from today. */
  unit?: "day" | "week" | "month" | "year";
}
/** ADR-284 — conditions joined by `and` · `or`; a group whose items all skip is skipped. */
export interface ViewConditionGroup {
  id: string;
  op: "and" | "or";
  items: readonly (ViewCondition | ViewConditionGroup)[];
}
/**
 * ADR-284 Decision 3 — aggregate names shared with Chart `budgetAggregate` (+ `count`), and
 * `applied`: the number of conditions the source views apply (「적용 조건 수」 — a skipped condition
 * is not counted; the same for every row).
 */
export type ViewAggregateFn =
  | "count"
  | "sum"
  | "mean"
  | "min"
  | "max"
  | "applied";
export interface ViewAggregate {
  fn: ViewAggregateFn;
  /** The field summed · compared; absent for `count` · `applied`. */
  field?: DataFieldPath;
  /** The result field's name (unique in the view). */
  as: string;
}
/**
 * ADR-284 Decision 5 — the sort: a variable holding a `SortDescriptor` (`{column, direction}` — a
 * Table's `onSortChange` writes it; `column` names a field by id or key), or a literal one.
 */
export type ViewSort =
  | { variableId: EntryId<"stateVariable"> | ProjectVariableId }
  | { field: DataFieldPath; direction: "ascending" | "descending" };
/** ADR-284 — what a view computes over its source: conditions → group · aggregate → sort. */
export interface ViewQuery {
  where: ViewConditionGroup;
  groupBy?: readonly DataFieldPath[];
  /**
   * A group with no rows (after the conditions): absent = no row; `"all"` = every value the group
   * field has in the data is a row (a kanban column's count of 0).
   */
  emptyGroups?: "all";
  aggregates?: readonly ViewAggregate[];
  sort?: ViewSort;
}
/**
 * ADR-284 Decision 1 — a shared (named) view. Its source is a collection or another shared view (a
 * derived view — the result count of a list's view). A binding's built-in view is promoted to one
 * when a derived view needs it as its source.
 */
export interface ViewEntry extends ViewQuery {
  kind: "view";
  id: EntryId<"view">;
  name: string;
  source: { collectionId: DataCollectionId } | { viewId: EntryId<"view"> };
}

export interface ProjectEntry {
  kind: "project";
  id: EntryId<"project">;
  name: string;
  pageIds: readonly EntryId<"page">[];
  /**
   * ADR-282 Phase 3 — the Components tab's pages (the Library's · Local's): pages the project
   * owns outside `pageIds`, so routes, the Pages list, Preview and publish do not see them. Made
   * the first time the tab opens one.
   */
  componentPageIds?: readonly EntryId<"page">[];
  definitionIds: readonly EntryId<"definition">[];
  overrideIds: readonly EntryId<"definitionOverride">[];
  themeIds: readonly EntryId<"theme">[];
  tokenIds: readonly EntryId<"token">[];
  stateVariableIds: readonly EntryId<"stateVariable">[];
  interactionIds: readonly EntryId<"interaction">[];
  assetIds: readonly EntryId<"asset">[];
  /** ADR-284 — the shared data views (absent = none). */
  viewIds?: readonly EntryId<"view">[];
  /** ADR-286 — the data definitions (absent = none). */
  collectionIds?: readonly DataCollectionId[];
  endpointIds?: readonly DataEndpointId[];
  projectVariableIds?: readonly ProjectVariableId[];
  /** ADR-286 Decision 5 — the site settings (absent = defaults). */
  site?: CatalogSiteSettings;
  activeThemeId?: EntryId<"theme">;
  pageLayout?: PageLayoutDeclaration;
  /**
   * Where the app's toasts show (S2 1.8.0 `ToastContainer` `placement` — one region per app). Absent
   * = `bottom end`, the region's place before (S2's own default is `bottom`).
   */
  toastPlacement?: CatalogToastPlacement;
}
/** ADR-235 content address of an uploaded asset (`asset:sha256-<hex>` — the asset GC reads it). */
export type CatalogAssetUrl = `asset:sha256-${string}`;
/**
 * ADR-286 Decision 5 — who may open the published site. No secret lives in the document (a
 * password's hash, a client secret, a certificate's key): the publish host keeps them.
 */
export type CatalogSiteAccess =
  | { kind: "none" }
  | { kind: "password"; hint?: string }
  | {
      kind: "sso";
      protocol: "saml" | "oidc";
      issuer: string;
      metadataUrl?: string;
      clientId?: string;
      protectedPageIds: readonly EntryId<"page">[] | "all";
    };
/** ADR-286 Decision 5 — one redirect (the list's order is its priority; `*` matches any rest). */
export interface CatalogSiteRedirect {
  from: string;
  to: string;
  permanent: boolean;
}
/** ADR-286 Decision 5 — the site settings (Framer Site Settings). Every field optional. */
export interface CatalogSiteSettings {
  title?: string;
  description?: string;
  /** BCP 47 (`<html lang>`). */
  lang?: string;
  favicon?: { light?: CatalogAssetUrl; dark?: CatalogAssetUrl };
  /** The installed app's icon (home screen · desktop shortcut — `apple-touch-icon` · manifest). */
  appIcon?: CatalogAssetUrl;
  /** The installed app's name (absent = the site title). */
  appName?: string;
  /** `#rrggbb` — the browser bar · installed app window (`theme-color` · manifest). */
  themeColor?: string;
  socialImage?: CatalogAssetUrl;
  search?: { index: boolean; sitemap: boolean; robots: "allow" | "none" };
  redirects?: readonly CatalogSiteRedirect[];
  access?: CatalogSiteAccess;
}
/** ADR-286 Decision 6 — a page's own settings over the site's (absent = the site's). */
export interface CatalogPageMeta {
  title?: string;
  description?: string;
  socialImage?: CatalogAssetUrl;
  hidden?: { search?: boolean; sitemap?: boolean };
}
/** S2 1.8.0 `ToastPlacement`. */
export type CatalogToastPlacement = "top" | "top end" | "bottom" | "bottom end";
export const CATALOG_TOAST_PLACEMENTS: readonly CatalogToastPlacement[] = [
  "top",
  "top end",
  "bottom",
  "bottom end",
];
/** Breakpoints below desktop: desktop is the node's base layer (desktop-first cascade). */
export type ResponsiveBreakpointName = Exclude<BreakpointName, "desktop">;
/**
 * A tablet or mobile override layer. Resolution for mobile applies tablet then mobile over the
 * base (the old `getResponsiveValueWithCascade` order).
 */
export interface NodeResponsiveLayer {
  visual?: VisualWrites;
  layout?: LayoutWrites;
  sizing?: SizingWrites;
  fillSizing?: FillSizing;
}
/** ADR-224 fill intent per axis: a weight, or `null` to release an inherited fill. */
export type FillSizing = Readonly<
  Partial<Record<"width" | "height", { factor: number } | null>>
>;
export type FillBlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";
export interface CatalogGradientStop {
  /** `#RRGGBBAA`. */
  color: string;
  /** 0–1. */
  position: number;
}
interface FillLayerBase {
  id: string;
  enabled: boolean;
  /** 0–1. */
  opacity: number;
  blendMode: FillBlendMode;
}
/** A node paint layer (the Fill panel's item), bottom to top. */
export type CatalogFillLayer =
  | (FillLayerBase & { kind: "color"; color: string })
  | (FillLayerBase & {
      kind: "linear-gradient";
      stops: readonly CatalogGradientStop[];
      rotation: number;
    })
  | (FillLayerBase & {
      kind: "radial-gradient";
      stops: readonly CatalogGradientStop[];
      center: { x: number; y: number };
      radius: { width: number; height: number };
    })
  | (FillLayerBase & {
      kind: "angular-gradient";
      stops: readonly CatalogGradientStop[];
      center: { x: number; y: number };
      rotation: number;
    })
  | (FillLayerBase & {
      kind: "image";
      url: string;
      mode: "stretch" | "fill" | "fit";
    })
  | (FillLayerBase & {
      kind: "mesh-gradient";
      rows: number;
      columns: number;
      points: readonly {
        position: readonly [number, number];
        color: string;
        leftHandle?: readonly [number, number];
        rightHandle?: readonly [number, number];
        topHandle?: readonly [number, number];
        bottomHandle?: readonly [number, number];
      }[];
    });
/** ADR-021 per-node tint/dark mode override. */
export interface NodeThemeOverride {
  mode?: "light" | "dark";
  tint?: ThemePreset["tint"];
}
export interface PageEntry {
  kind: "page";
  id: EntryId<"page">;
  route: string;
  name: string;
  children: readonly NodeId[];
  placement?: PagePlacementDeclaration;
  guideEntries?: Partial<
    Record<BreakpointName, readonly PageGuideDeclaration[]>
  >;
  /** Nested route: the parent page (route hierarchy only; pages stay separate frames). */
  parentId?: EntryId<"page">;
  /** ADR-286 Decision 6 — the page's own title · description · social image · search. */
  meta?: CatalogPageMeta;
}
export interface DefinitionEntry {
  kind: "definition";
  id: EntryId<"definition">;
  name: string;
  mode: "primitive" | "composite" | "native";
  accepts: Readonly<Record<string, ValueType>>;
  defaults: PropValues;
  visual: VisualValues;
  stateRules: StateRules;
  bindingId?: string;
  /** The template the definition owns (ADR-279: a component's origin, drawn on the Local page). */
  templateRootId?: NodeId;
  /**
   * `layout`: a reusable page layout — a page applies it by making its body an instance of this
   * definition and filling the template's slots. Absent = a component definition.
   */
  usage?: "component" | "layout";
  /**
   * ADR-261 Decision 4 — the component's properties (Figma component properties): values an
   * instance writes under `key` on its root, projected onto the origin nodes they drive. The
   * default is the target's own value (nothing stored). User components only.
   */
  properties?: readonly ComponentProperty[];
}
/**
 * ADR-261 Decision 4 — the kinds of a user component's property (Phase 4: text · boolean; Phase 5:
 * instance — Figma's instance swap).
 */
export type ComponentPropertyKind = "text" | "boolean" | "instance";
export const COMPONENT_PROPERTY_KINDS: readonly ComponentPropertyKind[] = [
  "text",
  "boolean",
  "instance",
];
/**
 * One origin node a property drives: a text property writes its `prop`, a boolean its `enabled`,
 * an instance property swaps the nested instance (the instance's `replace` override there).
 */
export interface ComponentPropertyTarget {
  id: NodeId;
  /** The text prop (text kind only — a string prop the target accepts). */
  prop?: string;
}
export interface ComponentProperty {
  /** Stable prop key an instance writes on its root (generated; the name can change). */
  key: string;
  name: string;
  kind: ComponentPropertyKind;
  /** Nodes of the component's origin subtree it drives (one property may drive several). */
  targets: readonly ComponentPropertyTarget[];
  /**
   * Instance kind: the components offered first when an instance picks its value (Figma's
   * preferred values — a suggestion, not a limit).
   */
  preferred?: readonly DefinitionId[];
}
export interface DefinitionOverrideEntry {
  kind: "definitionOverride";
  id: EntryId<"definitionOverride">;
  targetId: LibraryDefinitionId;
  defaults: PropWrites;
  visual: VisualWrites;
  stateRules: StateRules;
  /**
   * ADR-282: the unlocked origin's template — a copy of the library template the override owns
   * (absent = locked, the library template). Every instance of the origin projects it.
   */
  templateRootId?: NodeId;
  /** ADR-282: library template node → its copy (with `templateRootId`, never alone). */
  templateMap?: Readonly<Record<LibraryTemplateId, NodeId>>;
}
/** ADR-256 Decision 7 — the value conditions a node's presence may have (`presentWhen`). */
export type CatalogPresentWhen = "nonEmptyText";
export const CATALOG_PRESENT_WHEN: readonly CatalogPresentWhen[] = [
  "nonEmptyText",
];

/**
 * ADR-256 Decision 7 — the state keys a node's `showWhen` may test: boolean render props of the RAC
 * parts (G0 ④-1 — the installed RAC's `useRenderProps` values).
 */
export const CATALOG_STATE_KEYS = [
  "isSelected",
  "isIndeterminate",
  "isExpanded",
  "isInvalid",
  "isDisabled",
  "isReadOnly",
  "isRequired",
  "isPressed",
  "isHovered",
  "isFocusVisible",
  "isOpen",
  "isCurrent",
  "hasSubmenu",
  "allowsRemoving",
  "allowsSorting",
  // ADR-256 Phase 9 — a calendar month block's place (composition keys, `catalogStateKeysOf`).
  "isFirstMonth",
  "isLastMonth",
] as const;
export type CatalogStateKey = (typeof CATALOG_STATE_KEYS)[number];
/**
 * The part whose state a condition reads (breakdown §1-1): `{ type }` = the nearest ancestor of
 * that type that gives the key; `{ ancestor }` = one particular ancestor by its stored address — an
 * authored node (`nodeId`), a node inside an instance (`address`), or, inside an origin's template,
 * a position of that origin (`local`, prefixed with the current instance when used).
 */
export type CatalogStateOwnerRef =
  | { type: string }
  | { ancestor: CatalogNodeRef };
/**
 * A stored reference to one drawn place of the document (ADR-283 Decision 1 — shared by a state
 * owner reference and a capability's target): an authored node (`nodeId`), a position inside an
 * instance (`address`), or, inside an origin's template, a position of that origin relative to the
 * instance it is drawn in (`local`).
 */
export type CatalogNodeRef =
  | { nodeId: NodeId }
  | { address: InstanceAddress }
  | {
      local: {
        instances: readonly TemplateId[];
        templatePath: readonly TemplateId[];
      };
    };
/**
 * A capability's target (ADR-283 Decision 1): a place, or `unset` — the place was removed by a
 * swap · detach · dissolve and the rule stays to be pointed again (no reference, nothing runs).
 */
export type CatalogCapabilityTarget = CatalogNodeRef | { unset: true };
/** One condition: a key, its negation, or either with its own state owner. */
export type CatalogShowCondition =
  | CatalogStateKey
  | { not: CatalogStateKey }
  | { key: CatalogStateKey; from: CatalogStateOwnerRef }
  | { not: CatalogStateKey; from: CatalogStateOwnerRef };
/**
 * ADR-256 Decision 7 — the states in which a node is there: every condition holds (`all`, 1 – 3).
 * A condition's own `from` comes before the whole `from`; with neither, the owner is the nearest
 * ancestor that gives the key. False: the node is not in the DOM and takes no place.
 */
export interface CatalogShowWhen {
  all: readonly CatalogShowCondition[];
  from?: CatalogStateOwnerRef;
}

export interface NodeEntry {
  kind: "node";
  id: NodeId;
  /** Display label only; IDs remain the stable reference address. */
  name?: string;
  definitionId: DefinitionId;
  children: readonly NodeId[];
  props: PropWrites;
  visual: VisualWrites;
  sizing: SizingWrites;
  stateRules?: StateRules;
  descendantOverrides: readonly DescendantOverride[];
  binding?: DataBindingRef;
  /**
   * A slot an instance fills. ADR-261 Decision 3 — `suggested`: components offered first when an
   * instance fills it (pen.dev 「suggested slot components」 — a hint, not a restriction).
   */
  slot?: {
    name: string;
    required: boolean;
    suggested?: readonly DefinitionId[];
  };
  /** Named content regions declared by an authored container. */
  regions?: readonly { name: string; required: boolean }[];
  placeholder?: boolean;
  /** `false` hides the node and its subtree from every consumer (canonical `enabled`, G0 map). */
  enabled?: boolean;
  /**
   * ADR-256 Decision 7 — a value condition on an optional text part (Label · Description · a
   * description `Text`): `nonEmptyText` = the node is there only while its final text (every
   * binding substituted, `String(value ?? "")`) is not empty, or it holds child nodes. Absent = the
   * node is always there (a binding never removes a node by itself).
   */
  presentWhen?: CatalogPresentWhen;
  /** ADR-256 Decision 7 — the states in which the node is there (`CatalogShowWhen`). */
  showWhen?: CatalogShowWhen;
  /**
   * ADR-282: the display state a node of an unlocked origin's copy keeps from the library template
   * node it copies (a state origin's root — `LibraryTemplateNode.displayState`).
   */
  displayState?: DisplayStateName;
  /**
   * ADR-282 Phase 3 — a Components page ◆ cell: the origin it draws first (a library origin's
   * sample, or the template root its definition · override owns). A reference the Builder reads
   * (`CatalogGraph.setViewChildren`), not a child — the cell owns only its stored children. An
   * origin that is gone draws nothing.
   */
  originOf?: DefinitionId;
  /** Authored box layout over the definition and rule layout (ADR-248 Phase 4a). */
  layout?: LayoutWrites;
  /** Paint layers; absent = the definition's fill. */
  fills?: readonly CatalogFillLayer[];
  fillSizing?: FillSizing;
  responsive?: Partial<Record<ResponsiveBreakpointName, NodeResponsiveLayer>>;
  /** Per-breakpoint display (cascades like the responsive layers); `false` hides the subtree. */
  visibility?: Partial<Record<BreakpointName, boolean>>;
  themeOverride?: NodeThemeOverride;
  /**
   * Typed allowlist of authored node metadata (G0 destination "node.metadata"). `htmlId` is the
   * user's DOM `id` (old `customId`) — separate from `props.id`, which is a collection item key.
   */
  metadata?: NodeMetadata;
}
export interface NodeMetadata {
  htmlId?: string;
  /** The author's DOM class names, after the element's own classes (every element — old `className`). */
  className?: string;
  /** The author's accessible name (`aria-label`, every element — old `aria-label` prop). */
  ariaLabel?: string;
}
export interface ThemeEntry {
  kind: "theme";
  id: EntryId<"theme">;
  name: string;
  tokenIds: readonly EntryId<"token">[];
  preset: ThemePreset;
}
export interface TokenEntry {
  kind: "token";
  id: EntryId<"token">;
  name: string;
  tokenType: TokenType;
  value: Scalar;
  source: "spec-token" | "user-defined";
}
export interface StateVariableEntry {
  kind: "stateVariable";
  id: EntryId<"stateVariable">;
  ownerId: EntryId<"page"> | NodeId;
  name: string;
  /**
   * `object` · `array` hold structured values a rule writes (a selected row — the Value field's
   * `!item.keys`); their default is `""` (nothing yet — read as `null`).
   */
  valueType: ValueType | "object" | "array";
  /** A `source` variable's array kind (selected · expanded keys) holds the keys. */
  defaultValue: Scalar | readonly string[];
  /**
   * A named RAC state (the old implicit state): the variable follows this node's RAC state prop at
   * run time (Preview · publish observe the RAC event — never a controlled prop, D1) and is read
   * only. Its owner is the node's page (`{{ name }}` reads it anywhere on the page); its default
   * is the component's value when it was named.
   */
  source?: { nodeId: NodeId; prop: string };
}
export interface InteractionEntry {
  kind: "interaction";
  id: EntryId<"interaction">;
  ownerId: NodeId;
  address?: InstanceAddress;
  trigger: string;
  /**
   * ADR-284 Decision 8 — the Do list, run in order (one action = a list of one); a failure stops
   * the rest. No condition · branch (ADR-158).
   */
  actions: readonly InteractionAction[];
}
/** One Do of a rule (ADR-284 — a rule holds a list of them). */
export type InteractionAction =
    | {
        opcode: "setState";
        variableId: EntryId<"stateVariable"> | ProjectVariableId;
        op: "set" | "toggle" | "increment" | "reset";
        value?: Scalar;
      }
    | { opcode: "navigate"; pageId: EntryId<"page"> }
    | {
        opcode: "callEndpoint";
        endpointId: DataEndpointId;
        /** ADR-281 Decision 5 — the request body: a literal or `"!event.formData"`. */
        body?: Scalar;
      }
    | {
        opcode: "append";
        collectionId: DataCollectionId;
        /** The value appended: `"!event.formData"` (a Form's fields) — resolved when the rule runs. */
        value?: Scalar;
        /** `useTreeData.append(parentKey, …)` — the parent item's key; absent = the top level. */
        parentKey?: Scalar;
      }
    | {
        /** `useListData.update(key, newValue)` — the item's fields take the value's. */
        opcode: "update";
        collectionId: DataCollectionId;
        /**
         * The item's key (`"!event.key"` · a literal); absent = the value's `id`. Keys
         * (`"!event.keys"`) update each item (the reference's `for (let id of ids) list.update(…)`).
         */
        key?: Scalar;
        value?: Scalar;
        /**
         * ADR-284 Phase 5 — the one field the value writes (`{...list.getItem(id), [field]: value}`
         * — the kanban's status); absent = the value is a record whose fields the item takes.
         */
        field?: DataFieldId;
      }
    | {
        /** `useAsyncList.reload()` — the collection's endpoint runs again (its items replace). */
        opcode: "reload";
        collectionId: DataCollectionId;
      }
    | {
        /** `useListData.insert(index, …items)` — the value at `index` (a number). */
        opcode: "insert";
        collectionId: DataCollectionId;
        index?: Scalar;
        value?: Scalar;
        /** `useTreeData.insert(parentKey, index, …)` — the parent item's key; absent = the top. */
        parentKey?: Scalar;
      }
    | {
        /** `useListData.insertBefore(key, …)` · `insertAfter(key, …)` — next to the item `key`. */
        opcode: "insertBefore" | "insertAfter";
        collectionId: DataCollectionId;
        key?: Scalar;
        value?: Scalar;
      }
    | {
        /** `useListData.prepend(…items)`. */
        opcode: "prepend";
        collectionId: DataCollectionId;
        value?: Scalar;
        /** `useTreeData.prepend(parentKey, …)` — the parent item's key; absent = the top level. */
        parentKey?: Scalar;
      }
    | {
        /** `useListData.move(key, toIndex)`. */
        opcode: "move";
        collectionId: DataCollectionId;
        key?: Scalar;
        toIndex?: Scalar;
        /** `useTreeData.move(key, toParentKey, index)` — the new parent's key; absent = the top. */
        toParentKey?: Scalar;
      }
    | {
        /** `useListData.moveBefore(key, keys)` · `moveAfter(key, keys)` — `keys` next to `key`. */
        opcode: "moveBefore" | "moveAfter";
        collectionId: DataCollectionId;
        key?: Scalar;
        keys?: Scalar;
        /**
         * ADR-284 Phase 5 — the side a drop chose (`"!event.target.dropPosition"`): `before` runs
         * `moveBefore`, `after` `moveAfter` (the reference's `if (e.target.dropPosition === …)`);
         * absent = the opcode's side.
         */
        dropPosition?: Scalar;
      }
    | {
        /** `useListData.removeSelectedItems()` — the selection of the components showing it. */
        opcode: "removeSelectedItems";
        collectionId: DataCollectionId;
      }
    | {
        /** `useAsyncList.loadMore()` — the next page (the cursor the last load gave). */
        opcode: "loadMore";
        collectionId: DataCollectionId;
      }
    | {
        /** `useAsyncList.setFilterText(text)` — loads again with the text (`load({filterText})`). */
        opcode: "setFilterText";
        collectionId: DataCollectionId;
        value?: Scalar;
      }
    | {
        /** `useListData.remove(...keys)`. */
        opcode: "remove";
        collectionId: DataCollectionId;
        /** The items' keys: `"!event.key"` · `"!event.keys"` (a selection) · a literal. */
        keys?: Scalar;
      }
    | { opcode: "toast"; message: string }
    | {
        opcode: "capability";
        target: CatalogCapabilityTarget;
        capabilityId: string;
        value?: Scalar | readonly Scalar[];
      };
export interface AssetEntry {
  kind: "asset";
  id: EntryId<"asset">;
  contentId: string;
  mediaType: string;
  byteLength: number;
  filename: string;
}
/** ADR-286 — a data field (the Data panel's column): `id` is the stable reference (`{#id}`). */
export interface CatalogDataField {
  id?: string;
  key: string;
  type?: string;
  label?: string;
  required?: boolean;
  defaultValue?: unknown;
  children?: readonly CatalogDataField[];
  reference?: { collectionId: string; keyField: string };
}
/** ADR-286 Decision 1 — a collection's definition: its schema and the rows the author wrote. */
export interface CollectionEntry {
  kind: "collection";
  id: DataCollectionId;
  name: string;
  description?: string;
  schema: readonly CatalogDataField[];
  /** At most `CATALOG_COLLECTION_ROW_LIMIT` rows (사용자 결정 1, 2026-10-28). */
  mockData: readonly Readonly<Record<string, unknown>>[];
  useMockData: boolean;
  executionPolicy?: { mode: "auto" | "manual" | "interval"; intervalSec?: number };
}
/** ADR-286 사용자 결정 1 — a collection holds at most this many authored rows. */
export const CATALOG_COLLECTION_ROW_LIMIT = 1000;
/**
 * ADR-286 Decision 1 — an API endpoint's definition (request · response · server run). A server
 * run names its secrets (`serverConfig.secretMappings[].vaultKey`); their values stay server side.
 */
export interface EndpointEntry {
  kind: "endpoint";
  id: DataEndpointId;
  name: string;
  description?: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  baseUrl: string;
  path: string;
  headers: readonly { key: string; value: string; enabled: boolean }[];
  queryParams: readonly {
    key: string;
    value: string;
    type: "string" | "number" | "boolean";
    required: boolean;
  }[];
  bodyType: "json" | "form-data" | "x-www-form-urlencoded" | "none";
  bodyTemplate?: string;
  responseMapping: Readonly<Record<string, unknown>> & { dataPath: string };
  querySerialization?: Readonly<Record<string, unknown>>;
  /** The collection the response fills. */
  targetCollectionId?: DataCollectionId;
  executionMode: "client" | "server";
  serverConfig?: Readonly<Record<string, unknown>>;
  timeout?: number;
  retryCount?: number;
  uploadDryRun?: boolean;
}
/** ADR-286 Decision 1 · 사용자 결정 3 — a project variable (apart from page · node variables). */
export interface ProjectVariableEntry {
  kind: "projectVariable";
  id: ProjectVariableId;
  name: string;
  valueType: "string" | "number" | "boolean" | "object" | "array";
  defaultValue?: unknown;
  persist: boolean;
  validation?: Readonly<Record<string, unknown>>;
  transform?: string;
}
export type DataEntry = CollectionEntry | EndpointEntry | ProjectVariableEntry;

export type CatalogEntry =
  | ProjectEntry
  | PageEntry
  | DefinitionEntry
  | DefinitionOverrideEntry
  | NodeEntry
  | ThemeEntry
  | TokenEntry
  | StateVariableEntry
  | InteractionEntry
  | AssetEntry
  | ViewEntry
  | CollectionEntry
  | EndpointEntry
  | ProjectVariableEntry;

/** What an edit addresses: an owned node, or a template position inside an instance. */
export type EditTarget =
  | { kind: "node"; id: NodeId }
  | { kind: "descendant"; ownerId: NodeId; address: InstanceAddress };

/**
 * Where nodes are placed: a page, an owned node, or a container position of an instance's
 * template (its children become the instance's `fillSlot`).
 */
export type NodeParent =
  | { kind: "page"; id: EntryId<"page"> }
  | { kind: "node"; id: NodeId }
  | { kind: "descendant"; ownerId: NodeId; address: InstanceAddress };

/**
 * Graph reads a command planner needs. `CatalogGraph` is one (the committed state); a
 * `CatalogStage` is another (the committed state with staged records layered over it), so a
 * command plans the same way alone or after earlier commands of a composed edit.
 */
export interface CatalogReader {
  readonly projectId: EntryId<"project">;
  readonly revision: number;
  readonly library: CatalogLibrary;
  getEntry(id: string): CatalogEntry | undefined;
  ownerOf(id: string): string | undefined;
  referrersOf(id: string): ReadonlySet<string>;
  instancesOf(definitionId: string): ReadonlySet<string>;
  /**
   * The definition whose template root `id` is: a project definition (ADR-279), or an unlocked
   * library origin whose override owns `id` (ADR-282 — a `lib:definition:` id).
   */
  definitionOfTemplateRoot(id: string): DefinitionId | undefined;
}

export interface CatalogDocument {
  format: typeof CATALOG_FORMAT;
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  libraryContractVersion: typeof LIBRARY_CONTRACT_VERSION;
  revision: number;
  projectId: EntryId<"project">;
  rootId: EntryId<"project">;
  /** Wire format only. Runtime mutations use a private indexed table. */
  entries: Readonly<Record<string, CatalogEntry>>;
}

export interface LibraryDefinition {
  id: LibraryDefinitionId;
  name: string;
  mode: "primitive" | "composite" | "native";
  accepts: Readonly<Record<string, ValueType>>;
  defaults: PropValues;
  visual: VisualValues;
  /** Accepted literal values for finite-choice props such as Slot size. */
  propChoices?: Readonly<Record<string, readonly Scalar[]>>;
  /** Visual values selected by a typed prop value, before node visual writes. */
  propVisualRules?: Readonly<
    Record<string, Readonly<Record<string, VisualValues>>>
  >;
  stateRules: StateRules;
  /** Base box layout declaration. */
  layout?: LayoutValues;
  conditionalRules?: readonly ConditionalRule[];
  partRules?: readonly PartRule[];
  bindingId?: string;
  /** A library template id; an unlocked origin's copy (ADR-282) through the graph's library view. */
  templateRootId?: TemplateId;
  /**
   * Registered D3 rule (`COMPONENT_RULES_TABLE` key) whose variant paint, state paint and
   * sub-part structure the binding executors read from `CatalogLibrary.rules`. Size geometry
   * that layout needs is also declared as typed values (`visual`/`propVisualRules`).
   */
  ruleId?: string;
}
/**
 * Patch a library template node that instantiates a composite applies to that composite's own
 * template. `templatePath` starts at the composite's template root (same shape as
 * `InstanceAddress.templatePath`); the instance chain is the template node itself.
 */
export interface LibraryDescendantPatch {
  /** Library template ids; the copies of an unlocked origin's (ADR-282) through the library view. */
  templatePath: readonly TemplateId[];
  props?: PropValues;
  visual?: VisualValues;
  layout?: LayoutValues;
  enabled?: boolean;
}
/**
 * A slot fill of a library template node that instantiates a composite (ADR-253): the listed
 * children of that node stand at a slot position of the composite's template in place of the
 * position's own (default) children — the library form of an instance's `fillSlot`, which
 * replaces it when the instance fills the same position. `templatePath` starts at the composite's
 * template root (as `LibraryDescendantPatch.templatePath`).
 */
export interface LibrarySlotFill {
  templatePath: readonly TemplateId[];
  childIds: readonly LibraryTemplateId[];
}
export interface LibraryTemplateNode {
  id: LibraryTemplateId;
  definitionId: DefinitionId;
  children: readonly LibraryTemplateId[];
  props: PropValues;
  visual: VisualValues;
  slot?: { name: string; required: boolean };
  /** Authored box/item layout of this template node (origin `style`), over definition rules. */
  layout?: LayoutValues;
  /** `false` hides this template node (and subtree) unless an instance enables it. */
  enabled?: boolean;
  /**
   * ADR-256 Decision 7 — a value condition on an optional text part (Label · Description · a
   * description `Text`): `nonEmptyText` = the node is there only while its final text (every
   * binding substituted, `String(value ?? "")`) is not empty, or it holds child nodes. Absent = the
   * node is always there (a binding never removes a node by itself).
   */
  presentWhen?: CatalogPresentWhen;
  /** ADR-256 Decision 7 — the states in which the node is there (`CatalogShowWhen`). */
  showWhen?: CatalogShowWhen;
  descendantPatches?: readonly LibraryDescendantPatch[];
  /** Children of this node that fill slot positions of the composite it instantiates. */
  slotFills?: readonly LibrarySlotFill[];
  /** State-origin template node: the state it displays (`DisplayStateName`). */
  displayState?: DisplayStateName;
  /**
   * Authored visual this template node shows only in a state (the old state layer: a selectable
   * item origin's own style is its selected look, which its resting `--unselected` layer removes).
   */
  stateRules?: StateRules;
}
export interface LibraryToken {
  id: LibraryTokenId;
  tokenType: TokenType;
  value: Scalar;
  source: "spec-token";
  /**
   * The theme token the value was read from (`{color.accent}`): a rendering environment reads it
   * again in its color mode and installed theme (`catalogTokenValue`); `value` is the build-time read.
   */
  ref?: `{${string}}`;
}
export interface CatalogLibrary {
  contractVersion: typeof LIBRARY_CONTRACT_VERSION;
  revision: string;
  definitions: ReadonlyMap<LibraryDefinitionId, Readonly<LibraryDefinition>>;
  templates: ReadonlyMap<LibraryTemplateId, Readonly<LibraryTemplateNode>>;
  tokens: ReadonlyMap<LibraryTokenId, Readonly<LibraryToken>>;
  /** Read-only D3 rules referenced by `LibraryDefinition.ruleId` (code catalog data). */
  rules: ReadonlyMap<string, Readonly<ComponentRule>>;
  execution: {
    bindingIds: ReadonlySet<string>;
    triggerIds: ReadonlySet<string>;
    capabilityIds: ReadonlySet<string>;
    actionOpCodes: ReadonlySet<InteractionAction["opcode"]>;
  };
}
