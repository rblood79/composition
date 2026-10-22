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
import { useCallback, useSyncExternalStore } from "react";

import {
  cloneElement,
  createContext,
  createElement,
  Fragment,
  isValidElement,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";

import * as RAC from "react-aria-components";

import { Heading, Label, Text } from "react-aria-components";

import { Button } from "../../components/Button";

import { ContextualHelpButton } from "../../components/ContextualHelp";
import { InlineAlertIcon } from "../../components/InlineAlertIcon";
import { catalogInlineAlertIcon } from "../document/inlineAlertIcon";

import { Group } from "../../components/Group";

import { Icon } from "../../components/Icon";
import { ProgressCircle } from "../../components/ProgressCircle";

import { Slot } from "../../components/Slot";

import { isBodyType } from "../../domain/predicates";
import { containerTypeSet } from "../../domain/componentTraits";
import {
  getIconData,
  tokenToCSSVar,
  type TokenRef,
} from "@composition/rendering";
import {
  CATALOG_FIELD_BOX_CLASS,
  CATALOG_PREFIX_UNNAMED_FIELDS,
  CATALOG_FIELD_BOX_INPUT_STYLE,
  catalogFieldBox,
  catalogFieldBoxOfInput,
  catalogFieldBoxStepperNode,
  catalogFieldBoxStyle,
  catalogIsFieldPrefix,
} from "./fieldPrefix";
import {
  CATALOG_LINK_OUT_ICON,
  catalogItemLinkOut,
  catalogLinkOutCardEndInset,
  catalogItemLinkProps,
  catalogLinkOutGlyph,
  catalogLinkOutPaddingRight,
} from "../document/itemLinks";

import { catalogTokenValue } from "../document/themedToken";

import type { DefinitionId, StateName, TokenId } from "../document/types";

import {
  CATALOG_COLOR_WHEEL_TRACK,
  catalogColorWheelDiameter,
} from "../resolvers/resolveCatalogRuleCanvasBox";

import {
  CATALOG_AUTHORED_PAINT_KEYS,
  CATALOG_RADIUS_CSS,
  catalogAuthoredDomStyle,
  catalogAuthoredPaintCss,
  catalogVisualWithBackground,
  isTypedCatalogColor,
} from "./authoredStyle";

import {
  CATALOG_BINDING_VISUAL_KEYS,
  catalogBoxModel,
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

import {
  CATALOG_DATE_INPUT_NODE_FIELDS,
  CATALOG_DELEGATED_DOM,
  CATALOG_INPUT_NODE_FIELDS,
  catalogCollectionSelectedKeys,
  catalogDomPartParent,
  catalogFieldLabelNecessity,
  catalogOwnerDrawnPart,
  catalogPartField,
  catalogToggleIndicatorElement,
  catalogTypeName,
} from "./delegatedDom";

import {
  DELEGATING_INTERNAL_RENDERERS,
  DELEGATING_RAC_RENDERERS,
  INTERNAL_RENDERERS,
} from "./domRegistry";

import { catalogAspectRatio, catalogLayoutCss } from "./fillLayout";

import {
  catalogAuthoredLayout,
  catalogAuthoredVisual,
  catalogHasAuthoredColor,
} from "./libraryVisual";

import {
  CATALOG_SLIDER_THICK_TRACK,
  catalogAbsentByValue,
  catalogCalendarNavButton,
  catalogCalendarNavButtonGlyph,
  catalogColumnSortNameGroup,
  catalogColumnSortsAtEnd,
  catalogContextualHelpOfTrigger,
  catalogDisclosureOfHeading,
  catalogDisclosureOfTrigger,
  catalogDisclosureOfTriggerPart,
  catalogFieldHintShown,
  catalogItemLabels,
  catalogItemRemoveGlyphItem,
  catalogProgressValueHidden,
  catalogSkeletonIdle,
  catalogStateConditions,
  catalogStateOwner,
  catalogStateValue,
  catalogStepperHidden,
  catalogTreeChevronButtonItem,
  catalogTreeChevronGlyphItem,
  catalogToggleButtonGlyphOwner,
  FIELD_HINT_OWNERS,
} from "./presence";

import { racSlotProps, type RacSlotResolution } from "./racSlot";

import { RacSlotScope } from "./racSlotScope";

import {
  catalogStateChildren,
  type CatalogDomStateCondition,
} from "./stateFrames";

import { type CatalogStateStyles } from "./stateStyles";

import {
  catalogColumnChildren,
  catalogResizableTracks,
  CatalogSortIndicator,
} from "./tableOperationsDom";

import {
  catalogTableResizable,
  catalogTableSortedRows,
  catalogTableSortOf,
} from "./tableSort";

import {
  catalogCellSpan,
  catalogTableSelectionPartHidden,
  catalogTrackTableOf,
} from "./tableTracks";

import {
  CatalogAutocomplete,
  CatalogCalendarCell,
  CatalogCalendarGrid,
  CatalogCalendarHeaderCell,
  CatalogCalendarHeading,
  CatalogDateSegment,
  CatalogDomNode,
} from "./domBinding.components";
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
  const derived = node.derivedProps?._tableTracks;
  if (typeof derived !== "string") return {};
  // (Phase 4: in a resizable Table the tracks are RAC's column widths — `tableOperationsDom`.)
  const tracks = resizable ? catalogResizableTracks(derived) : derived;
  return node.bindingId === "tableheader"
    ? ({ "--table-column-tracks": tracks } as CSSProperties)
    : { display: "grid", gridTemplateColumns: tracks };
}

/** Inline CSS from the shared box model plus resolved paint/text values. */
export function catalogDomStyle(
  node: CatalogConsumerNode,
  parent?: CatalogConsumerNode,
): CSSProperties {
  node = catalogVisualWithBackground(node);
  for (const key of Object.keys(node.visual))
    if (!CATALOG_BINDING_VISUAL_KEYS.has(key))
      throw new Error(`CATALOG_DOM_VISUAL_UNSUPPORTED:${node.id}:${key}`);
  const box = catalogBoxModel(node);
  const visual = node.visual;
  const borderWidth = Number(box.borderWidth ?? 0);
  if (borderWidth > 0 && visual.borderColor === undefined)
    throw new Error(`CATALOG_DOM_STROKE_COLOR_REQUIRED:${node.id}`);
  const fillAlpha = Number(visual.fillAlpha ?? 1);
  const isText = textBindings.has(node.bindingId ?? "");
  const style: CSSProperties = {
    boxSizing: "border-box",
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
    ...(visual.opacity !== undefined
      ? { opacity: Number(visual.opacity) }
      : {}),
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
      fontFamily: metrics.fontFamily ?? "Pretendard, sans-serif",
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
      ...(metrics.textDecoration !== undefined
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
  (node, style) =>
    createElement(Icon, {
      key: node.id,
      "data-catalog-id": node.id,
      ...(className ? { className } : {}),
      // (Its glyph name: a sheet turns the chevron only — the Disclosure trigger's, Phase 8 판독 M3.)
      "data-icon": String(node.props.iconName ?? fallbackName),
      iconName: String(node.props.iconName ?? fallbackName),
      strokeWidth: Number(node.props.strokeWidth ?? 2),
      style: {
        ...style,
        // (An item's remove glyph takes the item color — `derivedOf`, ADR-256 Phase 5d.)
        color: cssColor(
          (node.derivedProps?.color as string | undefined) ?? node.visual.color,
        ),
        fontSize: catalogGlyphSize(node) ?? fallbackSize,
        // The resolved glyph sets the natural box too. Icon.css's default M height must
        // not override XS/XL or a field-owned glyph; explicit authored boxes still win.
        width: style.width ?? catalogGlyphSize(node) ?? fallbackSize,
        height: style.height ?? catalogGlyphSize(node) ?? fallbackSize,
      },
    });

function withInheritedIconColor(
  node: CatalogConsumerNode,
): CatalogConsumerNode {
  const { color: _color, ...derivedProps } = node.derivedProps ?? {};
  return {
    ...node,
    visual: { ...node.visual, color: "inherit" },
    derivedProps,
  };
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
    createElement(RacSlotScope, {
      key: node.id,
      context: "Text",
      authored: node.props.slot,
      render: (resolution) => {
        const props = {
          "data-catalog-id": node.id,
          className: "react-aria-Text",
          // (A DateRangePicker's dash — `presence.ts` `_decorative`, the reference's `aria-hidden`.)
          ...(node.derivedProps?._decorative === true
            ? { "aria-hidden": true }
            : {}),
          ...(typeof node.props.size === "string"
            ? { "data-size": node.props.size }
            : {}),
          style,
        };
        const text = String(node.props.children ?? "");
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
              text,
            )
          : createElement(
              Text,
              { ...props, ...racSlotProps(resolution) } as Parameters<
                typeof Text
              >[0],
              text,
            );
      },
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
            : [String(node.props.children ?? "")]),
          ...children,
        ),
    }),
  // (`children`: what its field appends to the Label — the necessity indicator, ADR-253.)
  label: (node, style, children) =>
    createElement(
      Label,
      { key: node.id, "data-catalog-id": node.id, style } as Parameters<
        typeof Label
      >[0],
      // (A ColorSlider's Label without its own text shows the channel's name — RAC's, ADR-258.)
      ...(catalogRacOwnsText(node) ? [] : [String(node.props.children ?? "")]),
      ...children,
    ),
  description: (node, style) =>
    createElement(RacSlotScope, {
      key: node.id,
      context: "Text",
      authored: node.props.slot ?? "description",
      render: (resolution) =>
        createElement(
          Text,
          {
            "data-catalog-id": node.id,
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
      String(node.props.children ?? ""),
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
  button: (node, style, children) =>
    createElement(RacSlotScope, {
      key: node.id,
      context: "Button",
      authored: node.props.slot,
      render: (resolution) => buttonElement(node, style, children, resolution),
    }),
  // RAC `SelectValue` inside a Select's trigger Button (ADR-253): RAC writes the selected item's
  // text, or the Select's placeholder.
  selectvalue: (node, style) =>
    createElement(RAC.SelectValue, {
      key: node.id,
      "data-catalog-id": node.id,
      style,
    } as Parameters<typeof RAC.SelectValue>[0]),
  icon: glyph("circle", 24),
  // The S2 IllustratedMessage's picture: its own class (the owner sheet places it) and its glyph
  // box (the Icon sheet's `.react-aria-Icon` height is the Icon scale's).
  illustration: (node, style, children, context) => {
    const size = catalogGlyphSize(node) ?? 96;
    return glyph("image", 96, "react-aria-Illustration")(
      node,
      { ...style, width: size, height: size },
      children,
      context,
    );
  },
  // ADR-256 Phase 5e: RAC `SelectionIndicator` in its item's context (there while the item is
  // selected); its box is the item sheet's (`.react-aria-Tab .react-aria-SelectionIndicator`).
  selectionindicator: (node, style) =>
    createElement(RAC.SelectionIndicator, {
      key: node.id,
      "data-catalog-id": node.id,
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
  // ADR-256 Phase 6g: RAC `Autocomplete` — no element of its own; it gives the text field inside
  // its input props and the collection beside it the filter · virtual focus.
  autocomplete: (node, _style, children, context) =>
    createElement(
      CatalogAutocomplete as ElementType,
      {
        key: node.id,
        // (A running Preview: its text controlled from the record's runtime value — ADR-280.)
        ...(context?.runtime?.setRuntimeProps
          ? catalogControlledProps(
              node.id,
              (id, patch) => context.runtime!.setRuntimeProps!(id, patch),
              INPUT_VALUE,
              String(
                context.runtime.overrideOf(node.id)?.inputValue ??
                  node.props.defaultInputValue ??
                  "",
              ),
            )
          : typeof node.props.defaultInputValue === "string"
            ? { defaultInputValue: node.props.defaultInputValue }
            : {}),
        disableAutoFocusFirst: node.props.disableAutoFocusFirst === true,
        disableVirtualFocus: node.props.disableVirtualFocus === true,
      },
      ...children,
    ),
  // ADR-256 Phase 5h: RAC `TreeItemContent` — no element of its own; its children are the row's
  // (RAC gives them the row's chevron `Button` and selection `Checkbox` contexts).
  treeitemcontent: (node, _style, children) =>
    createElement(
      RAC.TreeItemContent as ElementType,
      { key: node.id },
      ...children,
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
      // (Its type size is the Slider sheet's — `.react-aria-Slider[data-size] .react-aria-SliderOutput`.)
      { key: node.id, "data-catalog-id": node.id, style },
      ...(catalogRacOwnsText(node) ? [] : [String(node.props.children ?? "")]),
    ),
  slidertrack: (node, style, children) =>
    createElement(RAC.SliderTrack as ElementType, {
      key: node.id,
      "data-catalog-id": node.id,
      "data-size": String(node.props.size ?? "M"),
      // S2 `trackStyle: thick` — the 16px bar with the S2 sm corner (the Canvas reads the same
      // values: `CATALOG_SLIDER_THICK_TRACK` in `styleOf`, the rule's containerVariants radius).
      ...(node.derivedProps?.trackStyle === "thick"
        ? { "data-track-style": "thick" }
        : {}),
      style:
        node.derivedProps?.trackStyle === "thick"
          ? {
              ...style,
              height: CATALOG_SLIDER_THICK_TRACK.height,
              borderRadius: CATALOG_SLIDER_THICK_TRACK.radius,
            }
          : style,
      children: catalogStateChildren(node.id, () => children),
    }),
  sliderfill: (node, style) =>
    createElement(RAC.SliderFill as ElementType, {
      key: node.id,
      "data-catalog-id": node.id,
      // (S2 `isEmphasized` — the SliderFill sheet's variant, derived from the Slider.)
      "data-variant":
        node.derivedProps?.variant === "emphasized" ? "emphasized" : undefined,
      // (S2 `fillOffset` — RAC's own fill placement starts there; derived from the Slider.)
      ...(typeof node.derivedProps?._fillOffset === "number"
        ? { offset: node.derivedProps._fillOffset }
        : {}),
      style: ({ defaultStyle }: { defaultStyle: CSSProperties }) => ({
        ...withoutRacPlacement(style),
        ...defaultStyle,
      }),
    }),
  // ADR-256 Phase 8a: RAC `OverlayArrow` with the reference starter's svg (its overlay's size —
  // `_arrowSize`); RAC places it from the trigger and the overlay's sheet turns and paints the svg.
  overlayarrow: (node, style) => {
    const size = Number(node.derivedProps?._arrowSize ?? 12);
    return createElement(
      RAC.OverlayArrow as ElementType,
      { key: node.id, "data-catalog-id": node.id, style },
      createElement(
        "svg",
        { width: size, height: size, viewBox: `0 0 ${size} ${size}` },
        createElement("path", {
          d: `M0 0 L${size / 2} ${size / 2} L${size} 0`,
        }),
      ),
    );
  },
  // ADR-256 Phase 9: a calendar's parts (the reference starter's `div.month > header (Button[previous]
  // + CalendarHeading + Button[next]) + CalendarGrid > CalendarCell`). A month block is one copy per
  // shown month (the resolver's — its `monthIndex`); its heading · grid show the month at that offset.
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
  calendargrid: (node, style, children) =>
    createElement(CatalogCalendarGrid, {
      key: node.id,
      node,
      style,
      parts: children,
    }),
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
    return createElement(RAC.SliderThumb as ElementType, {
      key: node.id,
      "data-catalog-id": node.id,
      ...(precise ? { "data-thumb-style": "precise" } : {}),
      index: Number(node.props._thumbIndex ?? 0),
      style: precise
        ? { ...withoutRacPlacement(style), width: 6, height: size + 2 }
        : withoutRacPlacement(style),
    });
  },
  // ADR-258 Phase 2: a Color control's parts are RAC's, in its context — RAC places the thumb at
  // the value and paints it the displayed color, and sizes · paints · clips the wheel's ring (the
  // node's own style never moves or repaints them — `RAC_COLOR_PART_KEYS`).
  colorthumb: (node, style) =>
    createElement(RAC.ColorThumb as ElementType, {
      key: node.id,
      "data-catalog-id": node.id,
      style: withoutRacColorPart(withoutRacPlacement(style)),
    }),
  colorwheeltrack: (node, style) =>
    createElement(RAC.ColorWheelTrack as ElementType, {
      key: node.id,
      "data-catalog-id": node.id,
      style: withoutRacColorPart(style),
    }),
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
    { key: node.id, "data-catalog-id": node.id, className, style },
    ...(tag === "span" ? [String(node.props.children ?? "")] : children),
  );
}

/**
 * The element of a node-tree field's control Group, by the field's binding (ADR-256 Phase 2c ·
 * 6b · 6d): RAC's `Group` — a ComboBox's also carries its container class (the field rule's
 * selector for the box · the parts' row). (A SearchField has none — its parts are its own children,
 * G5 example 5.) Like any Group it passes the author's `role`
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
    // ADR-259 Phase 2: the Group a prefix wraps a TextField's · TextArea's · ColorField's Input in.
    textfield: undefined,
    textarea: undefined,
    colorfield: undefined,
  };
/**
 * Fields with no RAC `GroupContext` (RAC's TextField gives none): their prefix Group is S2's
 * `FieldGroup role="presentation"` and takes the field's invalid · disabled itself.
 */
const PREFIX_GROUP_BINDINGS: ReadonlySet<string> = new Set([
  "textfield",
  "textarea",
  "colorfield",
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
  (event.currentTarget as Element)
    .querySelector<HTMLElement>("input, textarea")
    ?.focus();
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
  // The input's name: its label, then the prefix (S2 `FieldGroup` extends `InputContext` — not a
  // TextArea's, S2 G0 oracle).
  const prefixId =
    box && !CATALOG_PREFIX_UNNAMED_FIELDS.has(catalogTypeName(root, field))
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
  return createElement(RAC.Group, {
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
            node.props[key] === true || (ownGroup && field.props[key] === true),
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
      : {}),
    children: catalogStateChildren(node.id, () =>
      content ? [content] : children,
    ),
  } as unknown as Parameters<typeof RAC.Group>[0]);
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

const fieldErrorBinding: DomBinding = (node, style) =>
  createElement(
    RAC.FieldError,
    { key: node.id, "data-catalog-id": node.id, style } as Parameters<
      typeof RAC.FieldError
    >[0],
    String(node.props.children ?? "") || undefined,
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
      ? { rows: typeof field.props.rows === "number" ? field.props.rows : 3 }
      : field.bindingId === "textfield"
        ? text("type")
        : {}),
    ...text("placeholder"),
    style: quietStyle(node, style),
  });
}

/**
 * A date field's DateInput node (ADR-253): a RAC `DateInput` — its segments are RAC's — inside
 * the field's RAC context. Its box is the DateInput rule's sheet at the node's size
 * (`data-size`); `style` carries only what the document wrote. `slot` is RAC's named slot of a
 * range picker's pair (`start` · `end`).
 */
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
      staticColor: node.props.staticColor,
      type: node.props.type,
      // Only what the document says (ADR-253 Decision 5): RAC puts an explicit prop over its
      // parent's context, so a default `false` would undo a field's disabled stepper.
      ...(buttonDisabled(node) ? { isDisabled: true } : {}),
      // (S2 `isPending` — the shared Button hides its content and shows the pending circle,
      //  `buttonPending.ts`; RAC marks the element and blocks the press.)
      ...(node.props.isPending === true ? { isPending: true } : {}),
      ...(node.props.autoFocus === true ? { autoFocus: true } : {}),
      // RAC's named slot of the parent this Button belongs to (a NumberField's steppers) —
      // ADR-256 Decision 4: the slot the context resolves to (`null` = detached).
      ...racSlotProps(resolution),
      // (A quiet Select's trigger: the field sheet draws the quiet box — `data-quiet` keeps the
      // filled Button paint off, and a rest paint the document wrote stays out while quiet, as
      // on a quiet field's Input.)
      ...quietState(node),
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
  // (Not a selection column — its `Checkbox[slot=selection]` names no row, ADR-256 Phase 5i-2.)
  const named = columns.filter(
    (child) =>
      !child.children.some((id) => {
        const box = root.domInputs.get(id);
        return (
          !!box &&
          catalogTypeName(root, box) === "Checkbox" &&
          box.props.slot === "selection"
        );
      }),
  );
  if (columns.some((child) => child.props.isRowHeader === true)) return false;
  const first =
    named.find((child) => child.props.isRowHeader !== false) ??
    named[0] ??
    columns[0];
  return first?.id === column.id;
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

export function catalogS2OverlayPlacement(
  props: Readonly<Record<string, unknown>>,
): string {
  const direction =
    typeof props.direction === "string" ? props.direction : "bottom";
  const align = props.align === "end" ? "end" : "start";
  if (["left", "right", "start", "end"].includes(direction))
    return `${direction} ${align === "end" ? "bottom" : "top"}`;
  return `${direction === "top" ? "top" : "bottom"} ${align}`;
}

/**
 * S2 1.8.0 `menuWidth` (px): a Picker's Popover takes it as its width (not when quiet — the trigger
 * width stays its minimum; the Popover sheet's size cap gives way, S2's Popover stops only at the
 * window), a ComboBox's as `--trigger-width` (its width and minimum — its sheet has no cap).
 */
function s2MenuWidthStyle(
  ownerType: string,
  props: Readonly<Record<string, unknown>>,
): CSSProperties | undefined {
  const width = props.menuWidth;
  if (typeof width !== "number" || !(width > 0)) return undefined;
  if (ownerType === "Select")
    return props.isQuiet === true
      ? undefined
      : { width: `${width}px`, maxWidth: "none" };
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
 * Whether an Image is in an S2 Card's `CardPreview` (layout frames skipped) — there it is S2's
 * Image (a box around its `img`); elsewhere the RAC examples' plain `img`.
 */
function imageInS2CardPreview(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): boolean {
  const parent = catalogDomPartParent(root, node);
  return !!parent && catalogTypeName(root, parent) === "CardPreview";
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
  let style = {
    ...authoredStyle(root, node),
    ...catalogTableTrackStyle(node, resizable),
  };
  const racProps = binding ? toRacProps({ props: node.props }, binding) : {};
  const { children: textChildren, ...rest } = racProps;
  const lower = type.toLowerCase();
  // ADR-280 Decision 3 · 4 (Phase 0 probe P1) — an overlay's open state is its trigger's: a
  // running Preview controls the trigger's `isOpen` from the record's runtime value (a rule's
  // `open` · `close`, the user's press · dismiss). A body owns it only standing without a trigger
  // (its own `isOpen` beats the trigger's context — giving it one inside would kill the press).
  if (
    context.runtime?.setRuntimeProps &&
    (CATALOG_OPEN_TRIGGER_TYPES.has(type) ||
      (CATALOG_OPEN_BODY_TYPES.has(type) &&
        !catalogOpenOwnerOf(root, node.id, domType)))
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
  if (
    lower === "tablebody" &&
    root.domInputs.get(node.parentId)?.props.loadingState === "loading"
  )
    rest.renderEmptyState = () =>
      createElement(
        "div",
        // (S2 `centeredWrapper` — the Canvas loads nothing, so it has no counterpart.)
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
  // A resizable Column's document width is where its drag starts (S2 `width` is controlled — the
  // widths a drag leaves are the Preview's, 사용자 결정 5).
  if (lower === "column" && resizable) {
    if (rest.width !== undefined) rest.defaultWidth = rest.width;
    delete rest.width;
  }
  const columnOperations =
    lower === "column" &&
    (node.props.allowsSorting === true || resizable) &&
    operationsTable
      ? {
          sortable: node.props.allowsSorting === true,
          sortsAtEnd: catalogColumnSortsAtEnd(node, domGet, domType),
          resizable: node.props.allowsResizing === true,
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
  // A Dialog is named by its title (RAC `Heading slot="title"` → `aria-labelledby`, ADR-254); one
  // without a title (and without the author's name) keeps the fallback name. RAC drops the title
  // link whenever an `aria-label` is given (`useDialog`), so the fallback is decided here. In a
  // DialogTrigger RAC names a titleless Dialog by its trigger (`aria-labelledby` = the trigger's
  // id): no fallback there (G5 example 4).
  if (
    lower === "dialog" &&
    !node.ariaLabel &&
    !dialogTitleOf(root, node) &&
    !inDialogTrigger(root, node)
  )
    rest["aria-label"] = "Dialog";
  // ADR-256 Phase 8a: an overlay's arrow is its `OverlayArrow` child node — the shared overlay
  // draws none of its own.
  if (lower === "popover" || lower === "tooltip") rest.hideArrow = true;
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
  const ownChildren = children;
  // ADR-259 Phase 1: S2 `hideLinkOutIcon` is an owner's context value (its items carry a copy) —
  // no RAC prop.
  delete rest.hideLinkOutIcon;
  // (An emptied link field is no link — RAC makes any `href` one.)
  for (const key of ["href", "target", "rel"])
    if (rest[key] === "") delete rest[key];
  // S2's link-out glyph of an item opening a new tab — the box the Canvas draws (`ruleShapes`).
  const linkOut = catalogItemLinkOut(type, node.props);
  if (linkOut) {
    const glyph = catalogLinkOutGlyph(type, node.props.size);
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
        : [String(textChildren)]),
    ...(linkOut ? [catalogLinkOutGlyphElement(node, type)] : []),
  ];
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
    // An Image outside an S2 Card's preview is the RAC examples' plain `img` (G5 example 10 — the
    // GridList item's photo): the element is the box (`alt=""` — no source, the placeholder fill).
    if (type === "Image" && !imageInS2CardPreview(root, node))
      return createElement("img", {
        key: node.id,
        "data-catalog-id": node.id,
        className: "react-aria-Image",
        alt: "",
        ...dataAttrs,
        style,
      });
    // S2 InlineAlert's variant icon — first, as S2 renders it (`catalogInlineAlertIcon`; the
    // Canvas draws the same box, `ruleShapes`).
    const alertIcon =
      type === "InlineAlert" ? catalogInlineAlertIcon(node.props) : undefined;
    const alertPadding = alertIcon ? catalogBoxModel(node).padding : undefined;
    return createElement(
      "div",
      {
        key: node.id,
        "data-catalog-id": node.id,
        className: `react-aria-${isBodyType(type) ? "Body" : type}`,
        ...dataAttrs,
        // The type's fixed ARIA (InlineAlert `role="alert"` — a plain box carries the D1 role).
        ...binding?.staticAttrs,
        style: alertIcon
          ? { ...style, position: style.position ?? "relative" }
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
      // In an S2 Card's preview the Image is S2's: a box around its `img` (`@react-spectrum/s2`
      // 1.8.0 mounted — G5 example 13); with no source the `img` paints nothing (`alt=""`), the box
      // keeps the placeholder fill.
      ...(type === "Image"
        ? [createElement("img", { key: "img", alt: "" })]
        : content),
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
  // (A selection cell a highlight Table leaves out moves the others' indices too — Phase 3.)
  const rowSpans =
    lower === "row"
      ? node.children
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
      : undefined;
  // ADR-257 Phase 5: RAC's resizable container keeps the column widths it started with (a Column's
  // document width is RAC's `defaultWidth` there) — a document change of a width builds the Table
  // again (the widths a drag left are runtime state: they give way to the document's edit).
  const widthKey =
    resizable && lower === "table"
      ? tableColumnWidthKey(root, node)
      : undefined;
  // A collection item's RAC id is its key (`resolveStaticItemKey`); RAC refuses an item whose id
  // changes in place ("Cannot change the id of an item" — an open Preview while the author sets a
  // Tab's id, G5 example 8): the key remounts the item instead.
  const itemKey =
    STATIC_ITEM_TYPES.has(type) || lower === "menuitem"
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
  const element = createElement(
    Component,
    {
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
            isDisabled: node.props.isDisabled === true,
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
            sortDescriptor: catalogTableSortOf(node.props.sortDescriptor),
            ...(context.runtime?.setRuntimeProps
              ? {
                  onSortChange: (sortDescriptor: unknown) =>
                    context.runtime!.setRuntimeProps!(node.id, {
                      sortDescriptor: catalogTableSortOf(sortDescriptor),
                    }),
                }
              : {}),
            tableResizable: resizable,
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
      // A ListBoxItem's text is its label part's (RAC reads `textValue` for a picker's input
      // value and filter, type-ahead and the hidden native select — its children are elements).
      ...(lower === "listboxitem" && itemLabelText(root, node)
        ? { textValue: itemLabelText(root, node) }
        : {}),
      // ADR-256 Phase 6f: a picker item's author mark (the reference DropdownItem's Check) stands in
      // for the sheet's glyph (`ListBox.css`), as a MenuItem's does.
      ...(lower === "listboxitem" && hasSelectionMark(root, node)
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
          catalogStateChildren(node.id, () => content) as unknown as ReactNode,
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
function catalogLinkOutGlyphElement(
  node: CatalogConsumerNode,
  type: string,
): ReactNode {
  const glyph = catalogLinkOutGlyph(type, node.props.size);
  const data = getIconData(CATALOG_LINK_OUT_ICON);
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
      !!child?.showWhen &&
      catalogStateConditions(child.showWhen).some(
        (condition) => condition.key === "isSelected" && !condition.not,
      )
    );
  });
}

/** An item's text: its Text children's without a slot name (a Tag's · GridListItem's label). */
function itemTextChildren(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): string {
  return node.children
    .map((id) => root.domInputs.get(id))
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
  for (const [key, value] of Object.entries(
    noSheet ? node.visual : catalogAuthoredVisual(root, node),
  ).sort((a, b) => authoredRank(a) - authoredRank(b))) {
    const textCss =
      TYPOGRAPHY_KEYS.has(key) &&
      carriesText &&
      CATALOG_INHERITED_TEXT_KEYS.some((inherited) => inherited === key)
        ? (value: unknown) => ({ [key]: value }) as CSSProperties
        : undefined;
    const css =
      AUTHORED_CSS[key] ??
      textCss ??
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
  for (const key of ["width", "height", "minWidth", "minHeight"] as const) {
    const value = node.sizing[key];
    if (typeof value === "number") style[key] = value;
  }
  // Template/instance-authored layout (origin style) inline over the class CSS.
  Object.assign(
    style,
    catalogLayoutCss(noSheet ? node.layout : catalogAuthoredLayout(root, node)),
  );
  if (node.fillLayout) Object.assign(style, catalogLayoutCss(node.fillLayout));
  const ratio = catalogAspectRatio(node.visual.aspectRatio);
  if (ratio !== undefined) style.aspectRatio = String(node.visual.aspectRatio);
  // Authored fill layers over the class CSS background.
  if (node.fills?.length)
    Object.assign(
      style,
      catalogAuthoredDomStyle({ visual: {}, fills: node.fills }),
    );
  // An authored absolute box's position · insets came with its authored layout (ADR-275).
  if (!catalogIsAuthoredPlaced(node)) containingBlock(root, node, style);
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
 * A component that renders from its children's values (a DisclosureGroup's expansion) renders
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
 * ADR-257 Phase 4 — an authored TableBody's Rows in its Table's Preview sort (the text of their
 * cell in the sorted column). Data rows come sorted by value from the resolver (the rows a fixed
 * height shows are the sorted data's first — `projectTableRows`).
 */
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
      catalogTableSortOf(
        context.runtime?.overrideOf(node.parentId)?.sortDescriptor,
      ),
      (recordId) => root.domInputs.get(recordId),
      (entry) => catalogTypeName(root, entry),
    ) ?? node.children
  );
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
  if (catalogAbsentByValue(node)) return null;
  // (A TagGroup's error text while the group is not invalid — the Canvas's predicate, S2.)
  if (
    partParent &&
    catalogTypeName(root, partParent) === "TagGroup" &&
    catalogFieldHintShown(
      catalogTypeName(root, node),
      partParent,
      "TagGroup",
    ) === false
  )
    return null;
  // (A Skeleton after loading — `isLoading: false`, the Canvas's predicate, S2.)
  if (catalogSkeletonIdle(node, (entry) => catalogTypeName(root, entry)))
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
  // (A ProgressBar's · Meter's value text while `showValueLabel` is false — the Canvas's predicate.)
  if (
    catalogProgressValueHidden(
      node,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    )
  )
    return null;
  const children: ReactElement[] = (
    node.bindingId === "submenutrigger"
      ? submenuTriggerChildren(root, node)
      : node.ruleId === "TableBody"
        ? tableBodyOrder(root, node, context)
        : // A derived show order (a calendar header's pickers in its locale order).
          (catalogChildOrder(node.derivedProps) ?? node.children)
  ).flatMap((childId) => {
    const child = root.domInputs.get(childId);
    // A part its owner draws has no element of its own — but a toggle indicator in a layout
    // frame inside its button is drawn there by the button's state (ADR-256 Phase 3 review m1).
    if (child && catalogOwnerDrawnPart(root, child)) {
      const indicator = catalogToggleIndicatorElement(root, child);
      return indicator ? [indicator] : [];
    }
    return [
      createElement(CatalogDomNode, {
        key: childId,
        root,
        id: childId,
        context,
      }),
    ];
  });
  if (node.bindingId === "label") {
    const necessity = catalogFieldLabelNecessity(root, node);
    if (isValidElement(necessity))
      children.push(cloneElement(necessity, { key: "necessity" }));
  }
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
          : authoredStyle(root, node),
        renderChild: (childId) =>
          createElement(CatalogDomNode, {
            key: childId,
            root,
            id: childId,
            context,
          }),
        ...(context.runtime
          ? {
              runtimeProps: (recordId: string) =>
                context.runtime!.overrideOf(recordId),
            }
          : {}),
        ...(context.runtime?.setRuntimeProps
          ? {
              setRuntimeProps: (
                recordId: string,
                patch: Readonly<Record<string, unknown>>,
              ) => context.runtime!.setRuntimeProps!(recordId, patch),
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
  )
    return fieldInputBinding(
      node,
      {
        ...authoredStyle(root, node),
        ...styleOverride,
        // ADR-259 Phase 2: in a prefix box the Group draws the box — the Input lays its own down
        // (`CATALOG_FIELD_BOX_INPUT_STYLE`, the Rust input reads the same).
        ...(catalogFieldBoxOfInput(
          node,
          (id) => root.domInputs.get(id),
          (entry) => catalogTypeName(root, entry),
        )
          ? {
              ...CATALOG_FIELD_BOX_INPUT_STYLE,
              background: "transparent",
              borderRadius: 0,
              boxShadow: "none",
              outline: "none",
            }
          : {}),
      },
      field,
    );
  // A date field's DateInput node is a RAC DateInput inside the field's context (ADR-253).
  if (
    field &&
    CATALOG_DATE_INPUT_NODE_FIELDS.has(field.bindingId ?? "") &&
    node.ruleId === "DateInput"
  )
    return fieldDateInputBinding(
      node,
      styleOverride
        ? { ...authoredStyle(root, node), ...styleOverride }
        : authoredStyle(root, node),
      children,
    );
  // A field's FieldError node is a RAC FieldError inside the field's context (ADR-253): RAC shows
  // it while the field is invalid — the authored message, else what its validation raised.
  const binding =
    node.bindingId === "fielderror" &&
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
  // inline.
  if (node.bindingId === "sliderthumb" && parentInput) {
    const { borderWidth: _ring, ...visual } = node.visual;
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
  // (ADR-259 Phase 2: a NumberField's stepper in its prefix box lays its border down — inline, over
  // the Button sheet's border.)
  const stepper =
    node.bindingId === "button"
      ? catalogFieldBoxStepperNode(
          node,
          (id) => root.domInputs.get(id),
          (entry) => catalogTypeName(root, entry),
        )
      : node;
  const bound = binding
    ? {
        ...catalogDomStyle(
          stepper,
          node.bindingId === "button" || watchedParent?.id !== node.parentId
            ? parentInput
            : watchedParent,
        ),
        ...(stepper !== node ? { borderWidth: 0 } : {}),
      }
    : undefined;
  if (bound && !catalogIsAuthoredPlaced(node))
    containingBlock(root, node, bound);
  // A Select's value takes its trigger Button's text color and the field sheet's placeholder
  // paint (`[data-placeholder]`): its color goes inline only when the document wrote it.
  // A Disclosure's title Text takes its trigger's color the same way (`… > .react-aria-Text
  // { color: inherit }` — the trigger's hover color reaches it), and so does a Tab's · Tag's label
  // (`.react-aria-Tag .react-aria-Text { color: inherit }`): RAC's run selection recolors the item
  // in the Preview, and the Canvas's item color (`derivedOf`) is the authored state's (2026-10-09).
  const itemOfLabel = () => {
    const item = root.domInputs.get(node.parentId);
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
  // A Button the document disables keeps its rest paint inline, as the Canvas draws it (the
  // rule's disabled state is its opacity; the shared `.button-base` sheet would also repaint it).
  // Inside a disabled field the field's root fades once: the Button does not fade again.
  // ADR-259 Phase 3: a ContextualHelp's trigger is RAC's plain Button (S2's quiet ActionButton,
  // detached from any Button context) — its box and quiet paint are the record's, inline.
  const helpOwner =
    node.bindingId === "button"
      ? catalogContextualHelpOfTrigger(
          node,
          (id) => root.domInputs.get(id),
          (entry) => catalogTypeName(root, entry),
        )
      : undefined;
  if (bound && node.bindingId === "button" && !helpOwner) {
    const partField = catalogPartField(root, node);
    const fieldDisabled =
      partField !== undefined &&
      (partField.id !== partParent?.id ||
        partField.bindingId === "select" ||
        partField.bindingId === "searchfield") &&
      partField.props.isDisabled === true;
    // (The sheet gives every Button a border: one the document removes is written out.)
    if (Number(node.visual.borderWidth) === 0) bound.borderWidth = 0;
    // A SearchField's sheet hides its clear button (its own child — G5 example 5) while the input
    // is empty (`[data-empty]`, RAC's run state): that Button's display stays the sheet's.
    if (partField?.bindingId === "searchfield") delete bound.display;
    if (node.props.isDisabled !== true && !fieldDisabled) {
      // A color the document wrote goes out as the sheet's own variable (`.button-base` reads
      // `--button-color` · `--button-border` · `--button-text`), so its hover and pressed colors
      // derive from it; the variant's explicit hover / pressed colors are released with it.
      const authored = catalogAuthoredVisual(root, node, true);
      const variables = bound as Record<string, unknown>;
      const fillAuthored =
        authored.fill !== undefined || authored.backgroundColor !== undefined;
      // (An outline Button's sheet does not read `--button-color`: its fill stays a property;
      // fill layers are their own background.)
      const direct = node.fills?.length || node.props.fillStyle === "outline";
      if (!(fillAuthored && direct) && !node.fills?.length) {
        if (fillAuthored) {
          variables["--button-color"] = bound.backgroundColor;
          variables["--button-color-hover"] = "initial";
          variables["--button-color-pressed"] = "initial";
        }
        delete bound.backgroundColor;
      }
      if (authored.borderColor !== undefined)
        variables["--button-border"] = bound.borderColor;
      delete bound.borderColor;
      if (authored.color !== undefined)
        variables["--button-text"] = bound.color;
      delete bound.color;
    } else if (fieldDisabled && node.props.isDisabled !== true)
      bound.opacity = 1;
  }
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
        ? authoredStyle(root, node)
        : undefined;
  // Its glyph takes the button's color (`all: unset` inherits the row's — selected, disabled), so
  // the Canvas resting color (the item's, `derivedOf`) does not go inline.
  // (A Disclosure trigger's chevron takes the trigger's color — hover included — the same way.)
  const sheetColored =
    node.bindingId === "icon" &&
    (catalogTreeChevronGlyphItem(node, domGet, domType) ||
      catalogDisclosureOfTriggerPart(node, domGet, domType) ||
      // (A calendar nav Button's chevron takes the Button's `--fg` — ADR-256 Phase 9.)
      catalogCalendarNavButtonGlyph(node, domGet, domType) ||
      // (A Tag's remove X takes the Tag's color through its button — `TagGroup.css`.)
      catalogItemRemoveGlyphItem(node, domGet, domType))
      ? {
          ...node,
          visual: { ...node.visual, color: undefined },
          derivedProps: { ...node.derivedProps, color: undefined },
        }
      : undefined;
  const toggleColored =
    node.bindingId === "icon" &&
    !catalogHasAuthoredColor(root, node) &&
    catalogToggleButtonGlyphOwner(node, domGet, domType)
      ? withInheritedIconColor(node)
      : undefined;
  const rendered = helpOwner
    ? createElement(
        ContextualHelpButton,
        {
          "data-catalog-id": node.id,
          // (The Button sheet gives every RAC Button a border — the quiet box writes its own out.)
          style: {
            ...bound,
            ...(Number(node.visual.borderWidth) === 0
              ? { borderWidth: 0 }
              : {}),
            ...styleOverride,
          },
          ...(buttonDisabled(node) ? { isDisabled: true } : {}),
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
  const named = withHtmlId(
    root,
    node,
    slot
      ? cloneElement(rendered as ReactElement<{ slot?: string }>, { slot })
      : rendered,
  );
  // ADR-259 Phase 2: a field's prefix carries the id its input's name points at (S2 `FieldGroup`).
  const prefixParent =
    catalogIsFieldPrefix(node, domType) && domGet(node.parentId);
  // (Its `slot` too — an Icon passes only an item's slot role — so the field sheet's prefix
  // selectors reach it: its gap, its shrink.)
  const element =
    prefixParent &&
    catalogFieldBox(prefixParent, domGet, domType)?.prefix.id === node.id
      ? cloneElement(named as ReactElement<{ id?: string; slot?: string }>, {
          slot: "prefix",
          ...(node.htmlId ? {} : { id: catalogFieldPrefixDomId(node) }),
        })
      : named;
  // A sortable Column's sort indicator follows its name Group (G5 example 11 — the reference's
  // `span.sort-indicator`, `catalogColumnSortNameGroup`).
  return catalogColumnSortNameGroup(node, domGet, domType)
    ? createElement(
        Fragment,
        { key: node.id },
        element,
        createElement(CatalogSortIndicator, { key: "sort-indicator" }),
      )
    : element;
}

/**
 * ADR-256 Phase 8c — `node` without the values its owner's part rules give it: the owner's sheet
 * draws those in the DOM (a Disclosure's `.react-aria-Heading` · `.react-aria-Button[slot='trigger']`
 * — inline, the trigger's transparent rest fill would cover the sheet's hover background). A value
 * the document wrote over a part rule's stays.
 */
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
          ? { [key]: value }
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
      return owner !== undefined && catalogTypeName(root, owner) === "Slider";
    })();
  // (A Card in a CardView is the view's RAC GridListItem: its `id` is the item key the view's
  // selection names — `cardview` — so the author's HTML id would unselect it. A Card the view
  // starts with is an owned node with an automatic id since 2026-10-14.)
  const cardViewItem =
    type === "Card" &&
    parent !== undefined &&
    catalogTypeName(root, parent) === "CardView";
  if (
    node.htmlId &&
    !selectTrigger &&
    !sliderLabel &&
    !cardViewItem &&
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
