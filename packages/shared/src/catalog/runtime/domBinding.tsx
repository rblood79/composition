import { isBodyType } from "../../domain/predicates";
import { catalogAspectRatio, catalogLayoutCss } from "./fillLayout";
import {
  CATALOG_AUTHORED_PAINT_KEYS,
  CATALOG_RADIUS_CSS,
  catalogVisualWithBackground,
  catalogAuthoredDomStyle,
  catalogAuthoredPaintCss,
  isTypedCatalogColor,
} from "./authoredStyle";
import * as RAC from "react-aria-components";
import {
  cloneElement,
  createElement,
  Fragment,
  isValidElement,
  memo,
  useCallback,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  componentTypeSet,
  getPrimitiveBinding,
  resolveStaticItemKey,
  toRacProps,
  usesButtonBaseUtility,
  OWNER_DRAWN_PART_HOSTS,
} from "@composition/shared";
import {
  DELEGATING_INTERNAL_RENDERERS,
  DELEGATING_RAC_RENDERERS,
  INTERNAL_RENDERERS,
} from "./domRegistry";
import { catalogAuthoredLayout, catalogAuthoredVisual } from "./libraryVisual";
import {
  FIELD_HINT_OWNERS,
  catalogAbsentByValue,
  catalogStateConditions,
  catalogStateOwner,
  catalogStateValue,
  catalogTreeChevronButtonItem,
  catalogTreeChevronGlyphItem,
} from "./presence";
import {
  catalogShowWhenGate,
  catalogStateChildren,
  type CatalogDomStateCondition,
} from "./stateFrames";
import { racSlotProps, type RacSlotResolution } from "./racSlot";
import { RacSlotScope } from "./racSlotScope";
import type { StateName } from "../document/types";
import { withCatalogStateStyles, type CatalogStateStyles } from "./stateStyles";
import {
  authoredInvalid,
  CATALOG_DELEGATED_DOM,
  CATALOG_DATE_INPUT_NODE_FIELDS,
  CATALOG_INPUT_NODE_FIELDS,
  CATALOG_LABEL_NODE_FIELDS,
  catalogFieldHintNodes,
  catalogFieldLabelNecessity,
  catalogFieldControlNodes,
  catalogFieldLabelNode,
  catalogDomPartParent,
  catalogPartField,
  catalogOwnerDrawnPart,
  catalogToggleIndicatorElement,
  catalogTypeName,
} from "./delegatedDom";
import { Heading, Label, Text } from "react-aria-components";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Group } from "../../components/Group";
import { Slot } from "../../components/Slot";
import {
  CATALOG_BINDING_VISUAL_KEYS,
  catalogBoxModel,
  catalogGlyphSize,
  catalogTextMetrics,
  type CatalogLength,
} from "./boxModel";
import {
  CATALOG_NOWRAP_TEXT_BINDINGS,
  type CatalogCompositionRoot,
  type CatalogConsumerNode,
} from "./compositionRoot";

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
/**
 * The part node elements of a field whose RAC component composes its parts itself (ADR-253): each
 * is placed as the component's `label` · `description` · `errorMessage`.
 */
interface FieldPartElements {
  label?: ReactElement;
  description?: ReactElement;
  error?: ReactElement;
  /** The part node elements inside the field's control wrapper, in order (ADR-253). */
  control?: ReactElement[];
}
type DomBinding = (
  node: CatalogConsumerNode,
  style: CSSProperties,
  children: ReactElement[],
  context: CatalogDomContext,
  parts?: FieldPartElements,
) => ReactElement;

const textBindings = new Set([
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
    !node.placement &&
    (authored.position === "absolute" || authored.position === "relative")
  )
    layout.position = authored.position;
  const css = catalogLayoutCss(layout) as CSSProperties;
  if (node.fillLayout) Object.assign(css, catalogLayoutCss(node.fillLayout));
  if (catalogAspectRatio(node.visual.aspectRatio) !== undefined)
    css.aspectRatio = String(node.visual.aspectRatio);
  return css;
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
    ...(box.position
      ? { position: "absolute", left: box.position.x, top: box.position.y }
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

const element =
  (tag: string): DomBinding =>
  (node, style, children) =>
    createElement(
      tag,
      { key: node.id, "data-catalog-id": node.id, style },
      ...children,
    );

/**
 * The side label layout the shared field wrappers read (`labelPosition` → `data-label-position`,
 * `labelAlign` → `data-label-align`); absent values keep the wrapper defaults.
 */
const labelLayout = (node: CatalogConsumerNode) => ({
  ...(typeof node.props.labelPosition === "string"
    ? { labelPosition: node.props.labelPosition }
    : {}),
  ...(typeof node.props.labelAlign === "string"
    ? { labelAlign: node.props.labelAlign }
    : {}),
});
const glyph =
  (fallbackName: string, fallbackSize: number): DomBinding =>
  (node, style) =>
    createElement(Icon, {
      key: node.id,
      "data-catalog-id": node.id,
      iconName: String(node.props.iconName ?? fallbackName),
      strokeWidth: Number(node.props.strokeWidth ?? 2),
      style: {
        ...style,
        // (An item's remove glyph takes the item color — `derivedOf`, ADR-256 Phase 5d.)
        color: cssColor(
          (node.derivedProps?.color as string | undefined) ?? node.visual.color,
        ),
        fontSize: catalogGlyphSize(node) ?? fallbackSize,
      },
    });

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
  heading: (node, style) =>
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
            style,
          } as Parameters<typeof Heading>[0],
          String(node.props.children ?? ""),
        ),
    }),
  // (`children`: what its field appends to the Label — the necessity indicator, ADR-253.)
  label: (node, style, children) =>
    createElement(
      Label,
      { key: node.id, "data-catalog-id": node.id, style } as Parameters<
        typeof Label
      >[0],
      String(node.props.children ?? ""),
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
  selecticon: glyph("chevron-down", 18),
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
};

/**
 * The element of a node-tree field's control Group, by the field's binding (ADR-256 Phase 2c ·
 * 6b · 6d): RAC's `Group` — a SearchField's · ComboBox's also carries its container class (the
 * field rule's selector for the box · the parts' row).
 */
const NODE_TREE_CONTROL_WRAPPERS: Readonly<
  Record<
    string,
    (node: CatalogConsumerNode, children: ReactElement[]) => ReactElement
  >
> = {
  numberfield: (node, children) =>
    createElement(
      RAC.Group,
      { key: node.id, "data-catalog-id": node.id } as Parameters<
        typeof RAC.Group
      >[0],
      ...children,
    ),
  searchfield: (node, children) =>
    createElement(
      RAC.Group,
      {
        key: node.id,
        "data-catalog-id": node.id,
        className: "react-aria-Group searchfield-container",
      } as Parameters<typeof RAC.Group>[0],
      ...children,
    ),
  // (RAC's ComboBox takes this Group as its Popover's trigger — `GroupContext` ref.)
  combobox: (node, children) =>
    createElement(
      RAC.Group,
      {
        key: node.id,
        "data-catalog-id": node.id,
        className: "react-aria-Group combobox-container",
      } as Parameters<typeof RAC.Group>[0],
      ...children,
    ),
};

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
): ReactElement {
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
    ((segment: Parameters<typeof RAC.DateSegment>[0]["segment"]) =>
      createElement(RAC.DateSegment, { segment })) as never,
  );
}

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
  if (resolution.kind === "named" && resolution.slot === "chevron")
    return createElement(
      RAC.Button,
      {
        "data-catalog-id": node.id,
        slot: resolution.slot,
        style,
      } as Parameters<typeof RAC.Button>[0],
      ...children,
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
      ...(node.props.isDisabled === true ? { isDisabled: true } : {}),
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
 * Bindings whose RAC component composes its sub-part DOM itself (D1). Their typed children keep
 * graph and Canvas identity but render no DOM element of their own.
 */
export const CATALOG_DOM_CHILD_OWNING_BINDINGS: ReadonlySet<string> = new Set([
  // (A Select · ComboBox draws its node tree — ADR-256 Phase 6c · 6d.)
  // Shared components that compose from their own props and never read `children`.
  "datepicker",
  "daterangepicker",
  // (A Table draws its node tree — ADR-256 Phase 5i.)
]);

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
      CATALOG_DOM_CHILD_OWNING_BINDINGS.has(parent.bindingId ?? "") ||
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

/** Parents whose RAC `PopoverContext` places their Popover (ADR-256 Phase 5g · 6c · 6d). */
const CONTEXT_PLACED_POPOVER_PARENTS: ReadonlySet<string> = new Set([
  "SubmenuTrigger",
  "Select",
  "ComboBox",
]);

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
function ruleDom(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  children: ReactElement[],
  /** The field's part node elements, in place of its `label` · hint texts (ADR-253). */
  parts?: FieldPartElements,
): ReactElement {
  const type = node.ruleId!;
  const binding = getPrimitiveBinding(type);
  const delegating =
    binding?.source.kind === "internal"
      ? DELEGATING_INTERNAL_RENDERERS.has(binding.source.renderer)
      : binding?.source.kind === "rac" && DELEGATING_RAC_RENDERERS.has(type);
  if (delegating)
    throw new Error(`CATALOG_DOM_BINDING_REQUIRED:${node.definitionId}`);
  const style = authoredStyle(root, node);
  const racProps = binding ? toRacProps({ props: node.props }, binding) : {};
  const { children: textChildren, ...rest } = racProps;
  if (parts?.label) rest.label = parts.label;
  if (parts?.description) rest.description = parts.description;
  if (parts?.error) rest.errorMessage = parts.error;
  // (A picker's control: the part node elements inside its Group — ADR-253.)
  if (parts?.control) rest.controlElements = parts.control;
  const lower = type.toLowerCase();
  // ADR-256 Phase 5g · 6c · 6d: a submenu's · Select's · ComboBox's Popover takes its place from
  // RAC's SubmenuTrigger · Select · ComboBox (`end top` · `bottom start`, their `PopoverContext`) —
  // the type's default `placement` would override it (the reference passes none).
  if (
    lower === "popover" &&
    CONTEXT_PLACED_POPOVER_PARENTS.has(
      catalogTypeName(root, root.domInputs.get(node.parentId)!),
    )
  )
    delete rest.placement;
  // A Dialog is named by its title (RAC `Heading slot="title"` → `aria-labelledby`, ADR-254); one
  // without a title (and without the author's name) keeps the fallback name. RAC drops the title
  // link whenever an `aria-label` is given (`useDialog`), so the fallback is decided here.
  if (lower === "dialog" && !node.ariaLabel && !dialogTitleOf(root, node))
    rest["aria-label"] = "Dialog";
  // (A Breadcrumb draws its node tree — `delegatedDom` `breadcrumb`, ADR-256 Phase 5a.)
  const ownChildren = children;
  const content =
    ownChildren.length > 0
      ? ownChildren
      : textChildren === undefined
        ? []
        : [String(textChildren)];
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
    for (const key of ["size", "variant"] as const)
      if (typeof node.props[key] === "string")
        dataAttrs[`data-${key}`] = String(node.props[key]);
    return createElement(
      "div",
      {
        key: node.id,
        "data-catalog-id": node.id,
        className: `react-aria-${isBodyType(type) ? "Body" : type}`,
        ...dataAttrs,
        style,
      },
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
  const element = createElement(
    Component,
    {
      key: node.id,
      "data-catalog-id": node.id,
      ...rest,
      ...(lower === "menuitem"
        ? {
            id: resolveStaticItemKey(
              node.props as Record<string, unknown>,
              node.id,
            ),
            textValue: itemLabelText(root, node),
            isDisabled: node.props.isDisabled === true,
            ...(typeof node.props.href === "string" && node.props.href
              ? { href: node.props.href }
              : {}),
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
        ? { isRowHeader: columnIsRowHeader(root, node) }
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

/** Collection items that pass their RAC render props to their parts (`catalogStateChildren`). */
const STATE_FRAME_ITEMS: ReadonlySet<string> = new Set(["tag", "menuitem"]);

/** Whether an item holds a node shown while it is selected (a MenuItem's Check / Dot). */
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
  for (const [key, value] of Object.entries(
    noSheet ? node.visual : catalogAuthoredVisual(root, node),
  ).sort((a, b) => authoredRank(a) - authoredRank(b))) {
    const css = AUTHORED_CSS[key];
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
  // Authored absolute placement (from the parent's padding box), as the native box bindings.
  if (node.placement?.kind === "absolute")
    Object.assign(style, {
      position: "absolute",
      left: node.placement.x,
      top: node.placement.y,
    });
  return style;
}

interface CatalogDomNodeProps {
  root: CatalogCompositionRoot;
  id: string;
  context: CatalogDomContext;
}

/**
 * One node's binding, subscribed to that node's `subscribeDom` delta through
 * `useSyncExternalStore`: React re-reads the record when it registers the subscription, so an
 * edit that lands between this render and the subscription is not lost. A leaf edit re-renders
 * only the edited node: `memo` stops the parent re-render at children whose props are unchanged,
 * and structure changes arrive as the parent's own delta (its `children` list) and reconcile by
 * key. A text node under a Slot also reads the Slot's text metric (`catalogTextMetrics`), so it
 * subscribes to that parent too.
 */
const CatalogDomNode = memo(function CatalogDomNode({
  root,
  id,
  context,
}: CatalogDomNodeProps): ReactElement | null {
  const read = useCallback(() => root.domInputs.get(id), [root, id]);
  const node = useSyncExternalStore(
    useCallback(
      (notify: () => void) => root.subscribeDom(id, notify),
      [root, id],
    ),
    read,
    read,
  );
  const runtime = context.runtime;
  const readRevision = useCallback(
    () => runtime?.revisionOf(id) ?? 0,
    [runtime, id],
  );
  useSyncExternalStore(
    useCallback(
      (notify: () => void) =>
        runtime ? runtime.subscribe(id, notify) : () => {},
      [runtime, id],
    ),
    readRevision,
    readRevision,
  );
  const parentInput = node ? root.domInputs.get(node.parentId) : undefined;
  // A field's part keeps its field through a layout frame (ADR-256 G2 — `catalogDomPartParent`).
  const partParent =
    parentInput?.bindingId === "frame" && node
      ? catalogDomPartParent(root, node)
      : parentInput;
  // A text leaf in a slot reads the slot's values; a field's Label node shows what its field
  // appends to it (the necessity indicator of the field's `isRequired` — ADR-253).
  const watchedParentId =
    node &&
    textBindings.has(node.bindingId ?? "") &&
    parentInput?.bindingId === "slot"
      ? node.parentId
      : node &&
          ((node.bindingId === "label" &&
            CATALOG_LABEL_NODE_FIELDS[partParent?.bindingId ?? ""] !==
              undefined) ||
            // A TextArea's Input node is its `<textarea rows>` (the field's `rows`).
            (partParent?.bindingId === "textarea" && node.ruleId === "Input"))
        ? partParent!.id
        : // A Button inside a field's control wrapper is drawn by the field's state (disabled).
          node?.bindingId === "button" &&
            partParent?.bindingId === "group" &&
            catalogPartField(root, node) !== partParent
          ? catalogPartField(root, node)?.id
          : // (A Select's trigger Button is the field's direct child.)
            node?.bindingId === "button" && partParent?.bindingId === "select"
            ? partParent.id
            : undefined;
  const readParent = useCallback(
    () => (watchedParentId ? root.domInputs.get(watchedParentId) : undefined),
    [root, watchedParentId],
  );
  const watchedParent = useSyncExternalStore(
    useCallback(
      (notify: () => void) =>
        watchedParentId ? root.subscribeDom(watchedParentId, notify) : () => {},
      [root, watchedParentId],
    ),
    readParent,
    readParent,
  );
  useWatchedChildren(
    root,
    runtime,
    node && CATALOG_DELEGATED_DOM[node.bindingId ?? ""]?.watchesChildren
      ? node.children
      : NO_CHILDREN,
  );
  // A Column's row-header default reads its sibling columns (`columnIsRowHeader` — RAC throws
  // when an edit to another column leaves the table without one, ADR-256 Phase 5 Round 12).
  const columnHeaderId = node?.ruleId === "Column" ? node.parentId : undefined;
  const readColumns = useCallback(
    () =>
      (columnHeaderId && root.domInputs.get(columnHeaderId)?.children) ||
      NO_CHILDREN,
    [root, columnHeaderId],
  );
  useWatchedChildren(
    root,
    runtime,
    useSyncExternalStore(
      useCallback(
        (notify: () => void) =>
          columnHeaderId ? root.subscribeDom(columnHeaderId, notify) : () => {},
        [root, columnHeaderId],
      ),
      readColumns,
      readColumns,
    ),
  );
  // A removed node disappears through its parent's children delta; until then it renders nothing.
  if (!node) return null;
  context.onNodeRender?.(id);
  const { rendered: shown, styleOverride } = withOverride(
    node,
    runtime?.overrideOf(id),
  );
  const element = withRuntime(
    withCatalogStateStyles(
      renderNode(
        root,
        shown,
        context,
        parentInput,
        partParent,
        watchedParent,
        styleOverride,
      ),
      catalogDomStateStyles(shown),
    ),
    runtime?.handlersOf(id),
  );
  // ADR-256 Decision 7: a node is there only in the states its `showWhen` names — its owners'
  // RAC state where they pass it down (`stateFrames.tsx`), else their records.
  return shown.showWhen && element
    ? catalogShowWhenGate(id, catalogDomStateConditions(root, shown), element)
    : element;
});

/** A conditioned node's conditions against the DOM records (`catalogStateOwner` — the Canvas's). */
function catalogDomStateConditions(
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

const NO_CHILDREN: readonly string[] = [];

/**
 * A component that renders from its children's values (a DisclosureGroup's expansion) renders
 * again when a child's record or runtime props change.
 */
function useWatchedChildren(
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

/** A capability's prop patch over the record (its `style` goes over the computed style). */
function withOverride(
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
function withRuntime(
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

function renderNode(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  context: CatalogDomContext,
  parentInput: CatalogConsumerNode | undefined,
  partParent: CatalogConsumerNode | undefined,
  watchedParent: CatalogConsumerNode | undefined,
  styleOverride: CSSProperties | undefined,
): ReactElement | null {
  const id = node.id;
  // ADR-256 Decision 7: an optional text part with nothing to say is not there.
  if (catalogAbsentByValue(node)) return null;
  // A field whose RAC component composes its parts itself still draws its Label · Description ·
  // FieldError from its part nodes (ADR-253): each element is placed as the component's prop.
  const owning = CATALOG_DOM_CHILD_OWNING_BINDINGS.has(node.bindingId ?? "");
  const partElement = (part: CatalogConsumerNode | undefined) =>
    part &&
    createElement(CatalogDomNode, { key: part.id, root, id: part.id, context });
  const hints = owning ? catalogFieldHintNodes(root, node) : {};
  const parts: FieldPartElements | undefined = owning
    ? {
        label: String(node.props.label ?? "").trim()
          ? partElement(catalogFieldLabelNode(root, node))
          : undefined,
        description: String(node.props.description ?? "").trim()
          ? partElement(hints.description)
          : undefined,
        error: partElement(hints.error),
        ...(catalogFieldControlNodes(root, node).length
          ? {
              control: catalogFieldControlNodes(root, node).map((part) =>
                partElement(part)!,
              ),
            }
          : {}),
      }
    : undefined;
  const children: ReactElement[] = owning
    ? []
    : (node.bindingId === "submenutrigger"
        ? submenuTriggerChildren(root, node)
        : node.children
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
        childStyle: (childId) => {
          const child = root.domInputs.get(childId);
          return child ? catalogDomStyle(child, node) : {};
        },
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
  const wrapper =
    node.bindingId === "group"
      ? NODE_TREE_CONTROL_WRAPPERS[partParent?.bindingId ?? ""]
      : undefined;
  if (wrapper) return withHtmlId(root, node, wrapper(node, children));
  // A field's Input node is a RAC Input inside the field's context (ADR-253).
  const field = watchedParent ?? catalogPartField(root, node);
  if (
    field &&
    CATALOG_INPUT_NODE_FIELDS.has(field.bindingId ?? "") &&
    node.ruleId === "Input"
  )
    return fieldInputBinding(
      node,
      styleOverride
        ? { ...authoredStyle(root, node), ...styleOverride }
        : authoredStyle(root, node),
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
  const bound = binding
    ? catalogDomStyle(
        node,
        node.bindingId === "button" || watchedParent?.id !== node.parentId
          ? parentInput
          : watchedParent,
      )
    : undefined;
  // A Select's value takes its trigger Button's text color and the field sheet's placeholder
  // paint (`[data-placeholder]`): its color goes inline only when the document wrote it.
  // A Disclosure's title Text takes its trigger's color the same way (`… > .react-aria-Text
  // { color: inherit }` — the trigger's hover color reaches it).
  if (
    bound &&
    (node.bindingId === "selectvalue" ||
      (node.bindingId === "text" &&
        parentInput?.bindingId === "disclosureheader")) &&
    catalogAuthoredVisual(root, node).color === undefined
  )
    delete bound.color;
  // A Button's paint is its rule's sheet (`data-variant` · `data-fill-style` …), which also
  // changes it by state (hover · pressed · disabled): the background, border color and text color
  // go inline only when the document wrote them (an origin override, the node's own value) —
  // an inline rest color would keep every state at rest (ADR-253: a field's stepper and trigger
  // are Button instances).
  //
  // A Button the document disables keeps its rest paint inline, as the Canvas draws it (the
  // rule's disabled state is its opacity; the shared `.button-base` sheet would also repaint it).
  // Inside a disabled field the field's root fades once: the Button does not fade again.
  if (bound && node.bindingId === "button") {
    const partField = catalogPartField(root, node);
    const fieldDisabled =
      partField !== undefined &&
      (partField.id !== partParent?.id || partField.bindingId === "select") &&
      partField.props.isDisabled === true;
    // (The sheet gives every Button a border: one the document removes is written out.)
    if (Number(node.visual.borderWidth) === 0) bound.borderWidth = 0;
    // A SearchField's sheet hides its clear button while the input is empty (`[data-empty]`,
    // RAC's run state): that Button's display stays the sheet's.
    if (
      partField?.bindingId === "searchfield" &&
      partField.id !== partParent?.id
    )
      delete bound.display;
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
  const sheetBox =
    node.bindingId === "button" &&
    catalogTreeChevronButtonItem(
      node,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    )
      ? authoredStyle(root, node)
      : undefined;
  // Its glyph takes the button's color (`all: unset` inherits the row's — selected, disabled), so
  // the Canvas resting color (the item's, `derivedOf`) does not go inline.
  const sheetColored =
    node.bindingId === "icon" &&
    catalogTreeChevronGlyphItem(
      node,
      (id) => root.domInputs.get(id),
      (entry) => catalogTypeName(root, entry),
    )
      ? {
          ...node,
          visual: { ...node.visual, color: undefined },
          derivedProps: { ...node.derivedProps, color: undefined },
        }
      : undefined;
  const rendered = binding
    ? binding(
        (sheetColored as CatalogConsumerNode | undefined) ?? node,
        sheetBox ?? (styleOverride ? { ...bound, ...styleOverride } : bound!),
        children,
        context,
        parts,
      )
    : ruleDom(root, node, children, parts);
  const slot = itemSlotRole(root, node);
  return withHtmlId(
    root,
    node,
    slot
      ? cloneElement(rendered as ReactElement<{ slot?: string }>, { slot })
      : rendered,
  );
}

/** Explicit state keys survive even when equal to rest (the rule sheet can change rest paint). */
function catalogDomStateStyles(
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
  if (node.htmlId && !STATIC_ITEM_TYPES.has(type) && type !== "TabPanel")
    patch.id = node.htmlId;
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
