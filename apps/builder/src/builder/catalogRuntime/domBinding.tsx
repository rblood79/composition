import { catalogAspectRatio, catalogLayoutCss } from "./fillLayout";
import {
  CATALOG_AUTHORED_PAINT_KEYS,
  catalogAuthoredDomStyle,
  catalogAuthoredPaintCss,
  isTypedCatalogColor,
} from "./authoredStyle";
import * as RAC from "react-aria-components";
import {
  cloneElement,
  createElement,
  memo,
  useCallback,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ElementType,
  type ReactElement,
} from "react";
import {
  catalogBreadcrumbSeparatorIcon,
  componentTypeSet,
  getPrimitiveBinding,
  resolveStaticItemKey,
  toRacProps,
  usesButtonBaseUtility,
} from "@composition/shared";
import {
  DELEGATING_INTERNAL_RENDERERS,
  DELEGATING_RAC_RENDERERS,
  INTERNAL_RENDERERS,
} from "../../preview/components/canonicalRendererRegistry";
import { catalogAuthoredLayout, catalogAuthoredVisual } from "./libraryVisual";
import { CATALOG_DELEGATED_DOM, catalogTypeName } from "./delegatedDom";
import { Heading, Label, Text } from "react-aria-components";
import { Button } from "../../../../../packages/shared/src/components/Button";
import { Icon } from "../../../../../packages/shared/src/components/Icon";
import { Group } from "../../../../../packages/shared/src/components/Group";
import { Select } from "../../../../../packages/shared/src/components/Select";
import { ComboBox } from "../../../../../packages/shared/src/components/ComboBox";
import { Slot } from "../../../../../packages/shared/src/components/Slot";
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
  /** Current date/time for date fields (deterministic renders in tests). */
  today?: () => unknown;
}
type DomBinding = (
  node: CatalogConsumerNode,
  style: CSSProperties,
  children: ReactElement[],
  context: CatalogDomContext,
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
    Object.assign(style, {
      margin: 0,
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
        color: cssColor(node.visual.color),
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
    return createElement(
      Group,
      {
        key: node.id,
        "data-catalog-id": node.id,
        role: role === "region" || role === "presentation" ? role : "group",
        label: text("label"),
        isDisabled: node.props.isDisabled === true,
        isInvalid: node.props.isInvalid === true,
        isReadOnly: node.props.isReadOnly === true,
        "aria-label": text("aria-label") ?? node.name,
        "aria-labelledby": text("aria-labelledby"),
        "aria-orientation":
          node.props.orientation === "horizontal" ? "horizontal" : "vertical",
        style,
      } as Parameters<typeof Group>[0],
      ...children,
    );
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
  // Preview generic Text = `span.react-aria-Text` (RAC Text's element), without RAC's slot
  // context: inside a RAC parent that provides Text slots (TagGroup, ListBoxItem…) a slot-less RAC
  // Text throws, while the Preview draws a plain span.
  text: (node, style) =>
    createElement(
      "span",
      {
        key: node.id,
        "data-catalog-id": node.id,
        className: "react-aria-Text",
        ...(typeof node.props.size === "string"
          ? { "data-size": node.props.size }
          : {}),
        style,
      },
      String(node.props.children ?? ""),
    ),
  heading: (node, style) =>
    createElement(
      Heading,
      { key: node.id, "data-catalog-id": node.id, style } as Parameters<
        typeof Heading
      >[0],
      String(node.props.children ?? ""),
    ),
  label: (node, style) =>
    createElement(
      Label,
      { key: node.id, "data-catalog-id": node.id, style } as Parameters<
        typeof Label
      >[0],
      String(node.props.children ?? ""),
    ),
  description: (node, style) =>
    createElement(
      Text,
      {
        key: node.id,
        "data-catalog-id": node.id,
        slot: "description",
        style,
      } as Parameters<typeof Text>[0],
      String(node.props.children ?? ""),
    ),
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
    createElement(
      Button,
      {
        key: node.id,
        "data-catalog-id": node.id,
        variant: node.props.variant,
        size: node.props.size,
        fillStyle: node.props.fillStyle,
        staticColor: node.props.staticColor,
        type: node.props.type,
        isDisabled: node.props.isDisabled === true,
        autoFocus: node.props.autoFocus === true,
        style,
      } as Parameters<typeof Button>[0],
      ...children,
      ...(node.props.children === undefined
        ? []
        : [String(node.props.children)]),
    ),
  icon: glyph("circle", 24),
  selecticon: glyph("chevron-down", 18),
  // RAC owns the trigger/input, value, icon and option DOM. The typed child IDs remain in the
  // graph and Canvas scene; `catalogDomOwnerTarget` maps a SelectTrigger ID to the RAC region.
  select: (node, style) =>
    createElement(Select, {
      key: node.id,
      "data-catalog-id": node.id,
      label:
        typeof node.props.label === "string" ? node.props.label : undefined,
      placeholder:
        typeof node.props.placeholder === "string"
          ? node.props.placeholder
          : undefined,
      size: typeof node.props.size === "string" ? node.props.size : "md",
      ...labelLayout(node),
      isDisabled: node.props.isDisabled === true,
      isInvalid: node.props.isInvalid === true,
      isRequired: node.props.isRequired === true,
      style,
    } as Parameters<typeof Select>[0]),
  combobox: (node, style) =>
    createElement(ComboBox, {
      key: node.id,
      "data-catalog-id": node.id,
      label:
        typeof node.props.label === "string" ? node.props.label : undefined,
      placeholder:
        typeof node.props.placeholder === "string"
          ? node.props.placeholder
          : undefined,
      size: typeof node.props.size === "string" ? node.props.size : "md",
      ...labelLayout(node),
      isDisabled: node.props.isDisabled === true,
      isInvalid: node.props.isInvalid === true,
      isReadOnly: node.props.isReadOnly === true,
      isRequired: node.props.isRequired === true,
      style,
    } as Parameters<typeof ComboBox>[0]),
};

/** Binding ids with a product DOM binding (census and consumers read this, not a copy). */
export const CATALOG_DOM_BINDING_IDS: ReadonlySet<string> = new Set(
  Object.keys(bindings),
);

/**
 * Bindings whose RAC component composes its sub-part DOM itself (D1). Their typed children keep
 * graph and Canvas identity but render no DOM element of their own.
 */
export const CATALOG_DOM_CHILD_OWNING_BINDINGS: ReadonlySet<string> = new Set([
  "select",
  "combobox",
  // Shared components that compose from their own props and never read `children`.
  "datepicker",
  "daterangepicker",
  "table",
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

/** DOM target owned by a shared RAC parent for a typed SelectTrigger sub-part. */
export function catalogDomOwnerTarget(
  root: CatalogCompositionRoot,
  id: string,
): { ownerId: string; selector: string } | undefined {
  const node = root.domInputs.get(id);
  if (node?.bindingId !== "selecttrigger") return undefined;
  const parent = root.domInputs.get(node.parentId);
  if (parent?.bindingId === "select")
    return { ownerId: parent.id, selector: ".react-aria-Button" };
  if (parent?.bindingId === "combobox")
    return { ownerId: parent.id, selector: ".combobox-container" };
  return undefined;
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
  borderWidth: (value) => ({ borderWidth: Number(value) }),
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

/** Registered components that drop DOM rest props (the shared Table takes `data-element-id` only). */
const MARKER_WRAPPED_RULE_TYPES: ReadonlySet<string> = new Set(["Table"]);

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
  const lower = type.toLowerCase();
  // Preview `CanonicalNodeRenderer`: a crumb's separator Icon child renders after its Link (shared
  // `Breadcrumb` `separator`, dropped on the current crumb); a crumb without children takes the
  // catalog default Icon.
  const separatorIds =
    lower === "breadcrumb"
      ? new Set(
          node.children.filter(
            (childId) =>
              root.domInputs.get(childId)?.props.slot === "separator",
          ),
        )
      : undefined;
  const ownChildren = separatorIds
    ? children.filter((child) => !separatorIds.has(String(child.key)))
    : children;
  const separator =
    separatorIds === undefined
      ? undefined
      : node.children.length === 0
        ? createElement(Icon, {
            iconName: catalogBreadcrumbSeparatorIcon(undefined).name,
          })
        : separatorIds.size > 0
          ? children.filter((child) => separatorIds.has(String(child.key)))
          : undefined;
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
  const Component: ElementType | undefined = !binding
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
        className: `react-aria-${type}`,
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
      ...(STATIC_ITEM_TYPES.has(type)
        ? {
            id: resolveStaticItemKey(
              node.props as Record<string, unknown>,
              node.id,
            ),
          }
        : {}),
      ...(usesButtonBaseUtility(type)
        ? { className: `react-aria-${type} button-base` }
        : {}),
      ...(separator !== undefined ? { separator } : {}),
      style,
    },
    ...content,
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
    // Preview orphan host: a hidden next crumb keeps the sample a link, except the `current`
    // state origin, which stays last (current).
    ...(lower === "breadcrumb" && node.displayState !== "current"
      ? [
          createElement(RAC.Breadcrumb, {
            key: "__orphan-next",
            id: "__orphan-next",
            style: { display: "none" },
          }),
        ]
      : []),
  );
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
  const watchedParentId =
    node &&
    textBindings.has(node.bindingId ?? "") &&
    parentInput?.bindingId === "slot"
      ? node.parentId
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
  // A removed node disappears through its parent's children delta; until then it renders nothing.
  if (!node) return null;
  context.onNodeRender?.(id);
  const { rendered: shown, styleOverride } = withOverride(
    node,
    runtime?.overrideOf(id),
  );
  return withRuntime(
    renderNode(root, shown, context, parentInput, watchedParent, styleOverride),
    runtime?.handlersOf(id),
  );
});

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
  watchedParent: CatalogConsumerNode | undefined,
  styleOverride: CSSProperties | undefined,
): ReactElement | null {
  const id = node.id;
  const children = CATALOG_DOM_CHILD_OWNING_BINDINGS.has(node.bindingId ?? "")
    ? []
    : node.children.map((childId) =>
        createElement(CatalogDomNode, {
          key: childId,
          root,
          id: childId,
          context,
        }),
      );
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
        today: context.today,
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
  const binding = bindingOf(node);
  const rendered = binding
    ? binding(
        node,
        styleOverride
          ? {
              ...catalogDomStyle(node, watchedParent ?? parentInput),
              ...styleOverride,
            }
          : catalogDomStyle(node, watchedParent ?? parentInput),
        children,
        context,
      )
    : ruleDom(root, node, children);
  const slot = itemSlotRole(root, node);
  return withHtmlId(
    root,
    node,
    slot
      ? cloneElement(rendered as ReactElement<{ slot?: string }>, { slot })
      : rendered,
  );
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
  if (node.htmlId) patch.id = node.htmlId;
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
          : join(`react-aria-${catalogTypeName(root, node)}`, authored);
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
