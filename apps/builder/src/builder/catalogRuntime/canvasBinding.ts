import type { CanvasSceneNode } from "../workspace/canvas/scene/canvasSceneNodeTypes";
import { getIconData } from "@composition/rendering";
import type { ComputedLayout } from "../workspace/canvas/layout/engines/LayoutEngine";
import {
  buildRenderCommandStream,
  buildSubtreeCommandStream,
} from "../workspace/canvas/skia/renderCommands";
import { applyCommitSubtreeCommandPatch } from "../workspace/canvas/skia/subtreeCommandPatch";
import {
  registerSkiaNode,
  unregisterSkiaNode,
} from "../workspace/canvas/skia/useSkiaNode";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import { catalogNodeState } from "../../../../../packages/shared/src/catalog/resolution/resolver";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogDateInputPaintProps, catalogRuleNodeData } from "./ruleShapes";
import { catalogRuleTextColor, cssVarColor } from "./rulePaint";
import { catalogAuthoredVisual } from "./libraryVisual";
import {
  CATALOG_NOWRAP_TEXT_BINDINGS,
  CatalogCompositionRoot,
} from "./compositionRoot";
import type { SlotChromeInput } from "./slotChrome";
import {
  catalogOverflowClips,
  catalogOverflowScrolls,
  catalogScrollbar,
  catalogScrollRange,
  type CatalogOverflowTree,
} from "./canvasOverflow";
import {
  applyTextTransform,
  parseTextDecoration,
} from "../workspace/canvas/styleConversion/styleConverter";
import {
  catalogVisualWithBackground,
  hasCatalogAuthoredPaint,
  isTypedCatalogColor,
} from "./authoredStyle";
import {
  applyCatalogAuthoredPaint,
  catalogCssColorRgba,
} from "./authoredPaintCanvas";
import {
  CATALOG_BINDING_VISUAL_KEYS,
  catalogFontFamilies,
  catalogBoxModel,
  catalogGlyphSize,
  catalogTextMetrics,
} from "./boxModel";
import { catalogRowSampleHidden } from "./rowSample";

/**
 * ADR-248 Canvas binding: resolved catalog inputs → existing CanvasKit render commands.
 * Product-path code (Phase 3 test entry assembles it; Phase 4 cutover uses it as is).
 * A binding id without an entry here, or a visual key a binding cannot paint or lay out,
 * fails explicitly — never a silent default.
 */
type Rect = { x: number; y: number; width: number; height: number };
type Binding = (
  node: CatalogConsumerNode,
  rect: Rect,
  parent?: CatalogConsumerNode,
  /** The layout wrapped this text leaf (`CatalogCompositionRoot.textWraps`). */
  wraps?: boolean,
  /** Text the DOM appends (`CatalogCompositionRoot.labelSuffix`). */
  suffix?: string,
) => SkiaNodeData;
const supportedVisualKeys = CATALOG_BINDING_VISUAL_KEYS;

/**
 * Color mode of the bind/update in progress (the root's `colorMode`): theme CSS variables resolve
 * to that mode's token value, as the DOM consumer's `data-theme` scope resolves them. Set only for
 * the synchronous span of one bind or update (`withColorMode`).
 */
let colorMode: "light" | "dark" = "light";
function withColorMode<T>(mode: "light" | "dark", run: () => T): T {
  const previous = colorMode;
  colorMode = mode;
  try {
    return run();
  } finally {
    colorMode = previous;
  }
}
function rgba(value: unknown): Float32Array {
  if (value === undefined || value === null) return Float32Array.of(0, 0, 0, 0);
  // An authored CSS color (rgb(a), hsl(a), hex8 …) goes through the old app's CSS color parser.
  if (!isTypedCatalogColor(value) && typeof value === "string")
    return catalogCssColorRgba(value);
  value = cssVarColor(value, colorMode);
  if (value === "black") value = "#000000";
  if (value === "white") value = "#ffffff";
  if (value === "transparent") return Float32Array.of(0, 0, 0, 0);
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value))
    throw new Error(`CATALOG_CANVAS_COLOR_UNSUPPORTED:${String(value)}`);
  return Float32Array.of(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
    1,
  );
}

function assertSupportedVisual(node: CatalogConsumerNode): void {
  for (const key of Object.keys(node.visual))
    if (!supportedVisualKeys.has(key))
      throw new Error(`CATALOG_CANVAS_VISUAL_UNSUPPORTED:${node.id}:${key}`);
}

function box(node: CatalogConsumerNode, rect: Rect): SkiaNodeData {
  assertSupportedVisual(node);
  const strokeWidth = Number(node.visual.borderWidth ?? 0);
  if (!Number.isFinite(strokeWidth) || strokeWidth < 0)
    throw new Error(`CATALOG_CANVAS_STROKE_UNSUPPORTED:${node.id}`);
  if (strokeWidth > 0 && node.visual.borderColor === undefined)
    throw new Error(`CATALOG_CANVAS_STROKE_COLOR_REQUIRED:${node.id}`);
  const fillAlpha = Number(node.visual.fillAlpha ?? 1);
  const radius = Number(node.visual.radius ?? 0);
  const borderStyle = node.visual.borderStyle ?? "solid";
  if (!Number.isFinite(fillAlpha) || fillAlpha < 0 || fillAlpha > 1)
    throw new Error(`CATALOG_CANVAS_FILL_ALPHA_UNSUPPORTED:${node.id}`);
  if (!Number.isFinite(radius) || radius < 0)
    throw new Error(`CATALOG_CANVAS_RADIUS_UNSUPPORTED:${node.id}`);
  if (!["solid", "dashed", "dotted"].includes(String(borderStyle)))
    throw new Error(`CATALOG_CANVAS_BORDER_STYLE_UNSUPPORTED:${node.id}`);
  const fillColor = rgba(node.visual.fill);
  fillColor[3] *= fillAlpha;
  return {
    type: "box",
    elementId: node.id,
    ...rect,
    visible: true,
    clipChildren: catalogOverflowClips(node.visual.overflow),
    ...(catalogOverflowClips(node.visual.overflow) && strokeWidth > 0
      ? { clipBorderInset: strokeWidth }
      : {}),
    box: {
      fillColor,
      borderRadius: radius,
      ...(node.visual.borderColor !== undefined
        ? {
            strokeColor: rgba(node.visual.borderColor),
            strokeWidth,
            strokeStyle: borderStyle as "solid" | "dashed" | "dotted",
          }
        : {}),
    },
  };
}

function container(node: CatalogConsumerNode, rect: Rect): SkiaNodeData {
  assertSupportedVisual(node);
  return {
    type: "container",
    elementId: node.id,
    ...rect,
    visible: true,
    clipChildren: catalogOverflowClips(node.visual.overflow),
  };
}

/**
 * The node's resolved `opacity` (a disabled state rule, or authored) as the layer effect the old
 * Canvas put on a disabled catalog node (`{ type: "opacity", source: "state" }`); the DOM carries
 * the same value (`catalogDomStyle`, generated `[data-disabled]` CSS).
 */
function withOpacity(
  node: CatalogConsumerNode,
  data: SkiaNodeData,
): SkiaNodeData {
  const opacity = Number(node.visual.opacity ?? 1);
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
    throw new Error(`CATALOG_CANVAS_OPACITY_UNSUPPORTED:${node.id}`);
  return opacity < 1 && data.visible
    ? {
        ...data,
        effects: [
          ...(data.effects ?? []),
          { type: "opacity" as const, value: opacity, source: "state" },
        ],
      }
    : data;
}

/** A node not shown at rest (`presence.ts`): the command stream skips it and its subtree. */
function hiddenNode(node: CatalogConsumerNode, rect: Rect): SkiaNodeData {
  return { type: "container", elementId: node.id, ...rect, visible: false };
}

function containerWithAuthoredPaint(
  node: CatalogConsumerNode,
  rect: Rect,
): SkiaNodeData {
  return node.visual.fill != null ||
    node.visual.borderColor != null ||
    node.visual.borderWidth != null ||
    hasCatalogAuthoredPaint(node)
    ? box(node, rect)
    : container(node, rect);
}

const glyph: Binding = (node, rect) => {
  assertSupportedVisual(node);
  // A trigger icon the owning field names (`catalogDerivedProps`) over its own value.
  const name = String(
    node.derivedProps?.iconName ??
      node.props.iconName ??
      (node.bindingId === "selecticon" ? "chevron-down" : "circle"),
  );
  const data = getIconData(name);
  if (!data)
    throw new Error(`CATALOG_CANVAS_GLYPH_REQUIRED:${node.id}:${name}`);
  const size = catalogGlyphSize(node) ?? Math.min(rect.width, rect.height);
  if (!Number.isFinite(size) || size <= 0)
    throw new Error(`CATALOG_CANVAS_GLYPH_SIZE_UNSUPPORTED:${node.id}`);
  return {
    type: "icon_path",
    elementId: node.id,
    ...rect,
    visible: true,
    iconPath: {
      paths: data.paths,
      circles: data.circles,
      cx: rect.width / 2,
      cy: rect.height / 2,
      size,
      strokeColor: rgba(node.visual.color ?? "#000000"),
      strokeWidth: Number(node.props.strokeWidth ?? 2),
    },
  };
};

const bindings: Readonly<Record<string, Binding>> = {
  composite: containerWithAuthoredPaint,
  frame: containerWithAuthoredPaint,
  rectangle: box,
  group: containerWithAuthoredPaint,
  slot: containerWithAuthoredPaint,
  // ADR-251: a group's items wrapper — its DOM box is the group's own `div.*-items`, which takes
  // no authored paint, so the Canvas paints none either (layout box only).
  radioitems: container,
  checkboxitems: container,
  box,
  icon: glyph,
  selecticon: glyph,
  selecttrigger: box,
  select: containerWithAuthoredPaint,
  combobox: containerWithAuthoredPaint,
  text: (node, rect, parent, wraps, suffix = "") => {
    const metrics = catalogTextMetrics(node, parent);
    const fontSize = metrics.fontSize;
    const layoutWhiteSpace =
      wraps && !CATALOG_NOWRAP_TEXT_BINDINGS.has(node.bindingId ?? "")
        ? "normal"
        : "nowrap";
    return {
      ...box(node, rect),
      type: "text",
      text: {
        content: applyTextTransform(
          `${String(node.props.children ?? "")}${node.props.children ? suffix : ""}`,
          metrics.textTransform,
        ),
        fontFamilies: catalogFontFamilies(metrics.fontFamily),
        fontSize,
        ...(metrics.fontStyle === "italic"
          ? { fontStyle: 1 }
          : metrics.fontStyle === "oblique"
            ? { fontStyle: 2 }
            : {}),
        ...(metrics.letterSpacing !== undefined
          ? { letterSpacing: metrics.letterSpacing }
          : {}),
        ...(metrics.textAlign === "center" || metrics.textAlign === "right"
          ? { align: metrics.textAlign }
          : metrics.textAlign === "end"
            ? { align: "right" as const }
            : {}),
        ...(metrics.textDecoration !== undefined
          ? { decoration: parseTextDecoration(metrics.textDecoration) }
          : {}),
        ...(metrics.wordBreak === "break-all" ||
        metrics.wordBreak === "keep-all"
          ? { wordBreak: metrics.wordBreak }
          : {}),
        // CSS `word-break: break-word` (legacy) breaks a long word as `overflow-wrap` does; an
        // authored `overflow-wrap` wins over it.
        ...(metrics.overflowWrap === "break-word" ||
        metrics.overflowWrap === "anywhere"
          ? { overflowWrap: metrics.overflowWrap }
          : metrics.overflowWrap === undefined &&
              metrics.wordBreak === "break-word"
            ? { overflowWrap: "break-word" as const }
            : {}),
        // `text-overflow: ellipsis` shows on a box that clips its one line (CSS: overflow other
        // than visible + nowrap); the paragraph paints the ellipsis at the box width.
        ...(metrics.textOverflow === "ellipsis"
          ? {
              textOverflow: "ellipsis" as const,
              clipText: catalogOverflowClips(node.visual.overflow),
            }
          : {}),
        ...(metrics.fontWeight !== undefined
          ? { fontWeight: metrics.fontWeight }
          : {}),
        ...(metrics.lineHeight !== undefined
          ? { lineHeight: fontSize * metrics.lineHeight }
          : {}),
        color: rgba(metrics.color),
        paddingLeft: 0,
        paddingTop: 0,
        maxWidth: rect.width,
        // The layout's wrap decision: a leaf it kept on one line paints unwrapped; an authored
        // non-normal white-space (nowrap / pre …) is painted as declared.
        whiteSpace:
          metrics.whiteSpace === undefined || metrics.whiteSpace === "normal"
            ? layoutWhiteSpace
            : (metrics.whiteSpace as
                "nowrap" | "pre" | "pre-wrap" | "pre-line"),
      },
    };
  },
  button: (node, rect, parent) => {
    const painted = bindings.text(node, rect, parent);
    const paddingX = Number(node.visual.paddingX ?? 0);
    return {
      ...painted,
      text: {
        ...painted.text!,
        align: "center",
        autoCenter: true,
        verticalAlign: "middle",
        paddingLeft: paddingX,
        maxWidth: Math.max(0, rect.width - 2 * paddingX),
      },
    };
  },
  heading: (node, rect, parent, wraps) =>
    bindings.text(node, rect, parent, wraps),
  label: (node, rect, parent, wraps, suffix) =>
    bindings.text(node, rect, parent, wraps, suffix),
  description: (node, rect, parent, wraps) =>
    bindings.text(node, rect, parent, wraps),
  paragraph: (node, rect, parent, wraps) =>
    bindings.text(node, rect, parent, wraps),
  fielderror: (node, rect, parent, wraps) =>
    bindings.text(node, rect, parent, wraps),
  selectvalue: (node, rect, parent, wraps) =>
    bindings.text(node, rect, parent, wraps),
};

/** Binding ids with a product Canvas binding (census and consumers read this, not a copy). */
export const CATALOG_CANVAS_BINDING_IDS: ReadonlySet<string> = new Set(
  Object.keys(bindings),
);

/** Canvas node data for a rule-backed node (`ruleShapes.ts`). */
/** Typography keys a rule executor does not paint yet: explicit failure, never a silent drop. */
const RULE_UNPAINTED_TEXT_KEYS = [
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
];
function ruleNodeData(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  rect: Rect,
): SkiaNodeData {
  for (const key of RULE_UNPAINTED_TEXT_KEYS)
    if (node.visual[key] !== undefined)
      throw new Error(`CATALOG_CANVAS_VISUAL_UNSUPPORTED:${node.id}:${key}`);
  const rule = root.runtime.graph.library.rules.get(node.ruleId!);
  if (!rule) throw new Error(`CATALOG_CANVAS_RULE_REQUIRED:${node.ruleId}`);
  const segments =
    node.bindingId === "dateinput"
      ? catalogDateInputPaintProps(root, node)
      : undefined;
  const input = {
    node: node.derivedProps
      ? { ...node, props: { ...node.props, ...node.derivedProps } }
      : node,
    ...(segments ? { paintProps: segments } : {}),
    rect,
    rule,
    type: node.ruleId!,
    authoredVisual: catalogAuthoredVisual(root, node),
    state: catalogNodeState(node.displayState, root.state),
    theme: root.colorMode,
    singleLine: root.textKeptOnOneLine(node.id),
  };
  const data = catalogRuleNodeData(input);
  const content = dropZoneContentData(
    root,
    node,
    rect,
    catalogRuleTextColor(input),
  );
  return {
    ...data,
    ...(content.length
      ? { children: [...(data.children ?? []), ...content] }
      : {}),
    x: rect.x,
    y: rect.y,
  };
}

/**
 * The DropZone's composed icon · label · description (`dropZoneContent.ts`) as internal children
 * of its rule data: a centered column in the content box (`justify-content` / `align-items`
 * center — overflowing both sides alike, like the DOM), in the variant text color.
 */
function dropZoneContentData(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  rect: Rect,
  color: string | undefined,
): SkiaNodeData[] {
  if (node.bindingId !== "dropzone") return [];
  const content = root.dropZoneContent(node.id, rect.width);
  if (!content) return [];
  const box = catalogBoxModel(node);
  const num = (value: unknown) => (typeof value === "number" ? value : 0);
  const border = num(box.borderWidth);
  const left = border + num(box.padding?.left);
  const top = border + num(box.padding?.top);
  const width = rect.width - left - border - num(box.padding?.right);
  const height = rect.height - top - border - num(box.padding?.bottom);
  const paint = rgba(color ?? "#000000");
  let y = top + (height - content.height) / 2;
  const out: SkiaNodeData[] = [];
  for (const part of content.parts) {
    const x = left + (width - part.width) / 2;
    const frame = { x, y, width: part.width, height: part.height };
    if (part.kind === "icon") {
      const icon = getIconData("upload");
      if (!icon)
        throw new Error(`CATALOG_CANVAS_GLYPH_REQUIRED:${node.id}:upload`);
      out.push({
        type: "icon_path",
        ...frame,
        visible: true,
        iconPath: {
          paths: icon.paths,
          circles: icon.circles,
          cx: part.width / 2,
          cy: part.height / 2,
          size: part.width,
          strokeColor: paint,
          strokeWidth: 2,
        },
      });
    } else {
      // A rule node's text child spans the node box and is placed by its padding (the executor's
      // convention, `specShapesToSkia`): the paragraph is laid out in the part's band, and
      // `autoCenter: false` keeps the command stream from re-centering it in the node.
      const font = part.font!;
      out.push({
        type: "text",
        x: 0,
        y: 0,
        width: rect.width,
        height: rect.height,
        visible: true,
        box: { fillColor: rgba(undefined), borderRadius: 0 },
        text: {
          content: part.text!,
          fontFamilies: catalogFontFamilies(undefined),
          fontSize: font.fontSize,
          fontWeight: font.fontWeight,
          lineHeight: font.fontSize * font.lineHeight,
          color: paint,
          align: "center",
          autoCenter: false,
          paddingLeft: frame.x,
          paddingTop: frame.y,
          maxWidth: part.width,
          whiteSpace: part.wraps ? "normal" : "nowrap",
        },
      });
    }
    y += part.height + content.gap;
  }
  return out;
}

/**
 * One node's Canvas data: its binding (or rule executor), the authored paint overlay
 * (`authoredStyle.ts`) and the resolved opacity — the same for the initial bind and a delta update.
 */
function paintedNodeData(
  root: CatalogCompositionRoot,
  input: CatalogConsumerNode,
  rect: Rect,
  binding: Binding | undefined,
  parent: CatalogConsumerNode | undefined,
): SkiaNodeData {
  const node = catalogVisualWithBackground(input);
  return withOverflowClip(
    node,
    withOpacity(
      node,
      applyCatalogAuthoredPaint(
        node,
        binding
          ? binding(
              node,
              rect,
              parent,
              root.textWraps(node.id),
              root.labelSuffix(node.id),
            )
          : ruleNodeData(root, node, rect),
        rect,
        root.colorMode,
      ),
    ),
  );
}

/**
 * Every overflow but `visible` clips the children (CSS) — a rule-backed node too (its definition
 * carries the rule box's overflow: ListBox, Menu …), inside its border as the box binding does.
 */
function withOverflowClip(
  node: CatalogConsumerNode,
  data: SkiaNodeData,
): SkiaNodeData {
  if (!data.visible || !catalogOverflowClips(node.visual.overflow)) return data;
  const stroke = data.box?.strokeWidth ?? 0;
  return {
    ...data,
    clipChildren: true,
    ...(stroke > 0 && data.clipBorderInset === undefined
      ? { clipBorderInset: stroke }
      : {}),
  };
}

/** The scroll/auto box's end padding and border: the scroll range reaches past them. */
function scrollEnd(node: CatalogConsumerNode): {
  right: number;
  bottom: number;
} {
  const model = catalogBoxModel(node);
  const px = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const border = px(model.borderWidth);
  return {
    right: px(model.padding?.right) + border,
    bottom: px(model.padding?.bottom) + border,
  };
}

function bindingKey(node: CatalogConsumerNode): string | undefined {
  return (
    node.bindingId ??
    (node.definitionMode === "composite" ? "composite" : undefined)
  );
}

function chromeText(
  id: string,
  rect: Rect,
  content: string,
  chrome: SlotChromeInput,
): SkiaNodeData {
  return {
    type: "text",
    elementId: id,
    ...rect,
    visible: true,
    box: { fillColor: rgba(undefined), borderRadius: 0 },
    text: {
      content,
      fontFamilies: ["Pretendard"],
      fontSize: chrome.fontSize,
      lineHeight: chrome.fontSize * chrome.lineHeight,
      color: rgba("#000000"),
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: rect.width,
      whiteSpace: id === chrome.descriptionId ? "pre" : "nowrap",
    },
  };
}

/** Result of applying the subscribed per-node deltas to the bound command stream. */
export type CatalogCanvasUpdate =
  | {
      readonly status: "patched";
      /** Nodes whose Skia data was re-derived and re-registered. */
      readonly rebound: readonly string[];
      /** Nodes whose engine rect differs from the bound rect after the edit. */
      readonly geometryChanged: readonly string[];
      /** Layout results read from the engine (node ids) to find the changed region. */
      readonly geometryQueries: number;
      /** Top-most subtree roots whose commands were rebuilt and spliced. */
      readonly patchRoots: readonly string[];
      /** Subtree command builds (one per patch root; never the whole scene). */
      readonly subtreeBuilds: number;
      /** Scene nodes the subtree builds visited. */
      readonly subtreeNodeVisits: number;
      /** Commands spliced into the stream. */
      readonly commandWrites: number;
    }
  | {
      /**
       * The delta changes what the patch path does not own (structure, a geometry change that
       * reaches the scene root, Slot chrome/inheritance or Slot geometry, binding id, or a
       * rejected splice). The caller disposes and binds
       * again; the binding never silently keeps a stale stream.
       */
      readonly status: "rebind-required";
      readonly id: string;
      readonly reason: string;
    };

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((id, index) => id === right[index]);
const sameRect = (left: Rect | undefined, right: Rect | undefined) =>
  !!left &&
  !!right &&
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

/**
 * Projection from resolved catalog inputs to existing CanvasKit commands. The initial bind walks
 * every input once; after that each node's `subscribeCanvas` delta marks it dirty and `update()`
 * re-derives only those nodes and splices their subtree commands into the same stream.
 */
export function bindCatalogCanvas(
  root: CatalogCompositionRoot,
  rootIds: readonly string[],
  pageShell?: { id: string; rect: Rect; fill: string },
  context: CatalogCanvasBindContext = {},
) {
  const bound = withColorMode(root.colorMode, () =>
    bindInColorMode(root, rootIds, pageShell, context),
  );
  return {
    ...bound,
    update: () => withColorMode(root.colorMode, bound.update),
  };
}

/** A scroll/auto box's scroll position (record id → px), kept by the owner across rebinds. */
export type CatalogScrollOffsets = Map<
  string,
  { scrollTop: number; scrollLeft: number }
>;

export interface CatalogCanvasBindContext {
  slotMode?: "edit" | "page";
  scrollOffsets?: CatalogScrollOffsets;
}

function bindInColorMode(
  root: CatalogCompositionRoot,
  rootIds: readonly string[],
  pageShell?: { id: string; rect: Rect; fill: string },
  context: CatalogCanvasBindContext = {},
) {
  const sceneNodes = new Map<string, CanvasSceneNode>();
  const childrenMap = new Map<string, CanvasSceneNode[]>();
  const layoutMap = new Map<string, ComputedLayout>();
  const registeredIds = new Set<string>();
  const unpainted: Array<{ id: string; reason: string }> = [];
  const resolvedBindingIds = new Set<string>();
  const tree: CatalogOverflowTree = {
    overflowOf: (id) => root.canvasInputs.get(id)?.visual.overflow,
    childrenOf: (id) => root.canvasInputs.get(id)?.children ?? [],
    parentOf: (id) => root.canvasInputs.get(id)?.parentId,
  };
  /** The scrollbar each scroll/auto box was registered with (an update compares against it). */
  const scrollbars = new Map<string, string>();
  const offsets: CatalogScrollOffsets = context.scrollOffsets ?? new Map();
  const ranges = new Map<
    string,
    { maxScrollTop: number; maxScrollLeft: number }
  >();
  /** Range, the position clamped into it, and the scrollbar of a scroll/auto box. */
  const scrollStateOf = (
    node: CatalogConsumerNode,
    rect: Rect,
    rectOf: (id: string) => Rect | undefined,
  ) => {
    const range = catalogScrollRange(node.id, tree, rectOf, scrollEnd(node));
    const current = offsets.get(node.id);
    const offset = {
      scrollTop: Math.min(
        Math.max(current?.scrollTop ?? 0, 0),
        range.maxScrollTop,
      ),
      scrollLeft: Math.min(
        Math.max(current?.scrollLeft ?? 0, 0),
        range.maxScrollLeft,
      ),
    };
    return {
      range,
      offset,
      bar: catalogScrollbar(rect.width, rect.height, range, offset),
    };
  };
  const withScrollbar = (
    node: CatalogConsumerNode,
    data: SkiaNodeData,
    rectOf: (id: string) => Rect | undefined,
  ): SkiaNodeData => {
    if (
      node.hidden ||
      !data.visible ||
      !catalogOverflowScrolls(node.visual.overflow)
    ) {
      scrollbars.delete(node.id);
      ranges.delete(node.id);
      return data;
    }
    const { range, offset, bar } = scrollStateOf(node, data, rectOf);
    ranges.set(node.id, range);
    scrollbars.set(node.id, JSON.stringify(bar ?? null));
    const scrolled = offset.scrollTop !== 0 || offset.scrollLeft !== 0;
    if (scrolled) offsets.set(node.id, offset);
    else offsets.delete(node.id);
    return {
      ...data,
      ...(bar ? { scrollbar: bar } : {}),
      // The children move by the position (renderCommands translates them and their boxes).
      ...(scrolled ? { scrollOffset: offset } : {}),
    };
  };
  try {
    const geometry = root.getGeometry(root.canvasInputs.keys());
    for (const node of root.canvasInputs.values()) {
      const bindingId = bindingKey(node);
      const binding = bindingId ? bindings[bindingId] : undefined;
      if (!bindingId || (!binding && !node.ruleId))
        throw new Error(`CATALOG_CANVAS_BINDING_REQUIRED:${node.definitionId}`);
      resolvedBindingIds.add(bindingId);
      if (
        bindingId === "slot" &&
        context.slotMode !== "page" &&
        node.children.length === 0 &&
        !root.slotChromeInputs.has(node.id)
      )
        unpainted.push({
          id: node.id,
          reason:
            "SLOT_PLACEHOLDER_ICON_NAME_REQUIRED_DESCRIPTION_NOT_PAINTED; EDITOR_HATCH_USES_TRANSIENT_OVERLAY_TARGET",
        });
      const rect = geometry.get(node.id);
      if (!rect) throw new Error(`CATALOG_CANVAS_LAYOUT_REQUIRED:${node.id}`);
      const parent = root.canvasInputs.get(node.parentId);
      // renderCommands consumes these scene fields and registry data; its
      // required legacy source pointer is never read in that module.
      sceneNodes.set(node.id, {
        id: node.id,
        type: bindingId,
        props: {},
        parentId: node.parentId || pageShell?.id || null,
        pageId: pageShell?.id ?? null,
        layoutId: node.id,
      } as CanvasSceneNode);
      layoutMap.set(node.id, { ...rect, elementId: node.id });
      registerSkiaNode(
        node.id,
        node.hidden || catalogRowSampleHidden(root, node)
          ? hiddenNode(node, rect)
          : bindingId === "slot" && context.slotMode === "page"
            ? container(node, rect)
            : withScrollbar(
                node,
                paintedNodeData(root, node, rect, binding, parent),
                (id) => geometry.get(id),
              ),
      );
      registeredIds.add(node.id);
    }
    if (context.slotMode !== "page")
      for (const chrome of root.slotChromeInputs.values()) {
        const rect = root.getGeometry([chrome.id]).get(chrome.id);
        if (!rect) throw new Error(`SLOT_CHROME_LAYOUT_REQUIRED:${chrome.id}`);
        const children: string[] = [];
        const add = (id: string, local: Rect, data: SkiaNodeData) => {
          sceneNodes.set(id, {
            id,
            type: data.type,
            props: {},
            parentId: chrome.id,
            pageId: pageShell?.id ?? null,
            layoutId: id,
          } as CanvasSceneNode);
          layoutMap.set(id, { ...local, elementId: id });
          registerSkiaNode(id, data);
          registeredIds.add(id);
          childrenMap.set(id, []);
          children.push(id);
        };
        const textX = chrome.iconSize + chrome.iconGap;
        const textY =
          (chrome.height - chrome.nameHeight - chrome.descriptionHeight) / 2;
        const iconRect = {
          x: 0,
          // Chromium snaps the 24px SVG icon paint at half-pixel flex centers
          // to the DPR1 device grid; keep the transient Canvas paint aligned.
          y: Math.round((chrome.height - chrome.iconSize) / 2),
          width: chrome.iconSize,
          height: chrome.iconSize,
        };
        add(chrome.iconId, iconRect, {
          type: "icon_path",
          elementId: chrome.iconId,
          ...iconRect,
          visible: true,
          iconPath: {
            paths: [
              "M5 3H19Q21 3 21 5V19Q21 21 19 21H5Q3 21 3 19V5Q3 3 5 3Z",
              "M9 3V21",
              "M15 3V21",
              "M3 9H21",
              "M3 15H21",
            ],
            cx: chrome.iconSize / 2,
            cy: chrome.iconSize / 2,
            size: chrome.iconSize,
            strokeColor: rgba("#000000"),
            strokeWidth: 2,
          },
        });
        const nameRect = {
          x: textX,
          y: textY,
          width: Math.max(1, chrome.nameWidth),
          height: chrome.nameHeight,
        };
        add(
          chrome.nameId,
          nameRect,
          chromeText(chrome.nameId, nameRect, chrome.name, chrome),
        );
        if (chrome.requiredId && chrome.requiredLabel) {
          const requiredRect = {
            x: textX + chrome.nameWidth,
            y: textY,
            width: Math.max(1, chrome.textWidth - chrome.nameWidth),
            height: chrome.nameHeight,
          };
          add(
            chrome.requiredId,
            requiredRect,
            chromeText(
              chrome.requiredId,
              requiredRect,
              chrome.requiredLabel,
              chrome,
            ),
          );
        }
        if (chrome.descriptionId && chrome.description) {
          const descriptionRect = {
            x: textX,
            y: textY + chrome.nameHeight,
            width: chrome.textWidth,
            height: chrome.descriptionHeight,
          };
          add(
            chrome.descriptionId,
            descriptionRect,
            chromeText(
              chrome.descriptionId,
              descriptionRect,
              chrome.descriptionLines.join("\n"),
              chrome,
            ),
          );
        }
        sceneNodes.set(chrome.id, {
          id: chrome.id,
          type: "container",
          props: {},
          parentId: chrome.slotId,
          pageId: pageShell?.id ?? null,
          layoutId: chrome.id,
        } as CanvasSceneNode);
        layoutMap.set(chrome.id, { ...rect, elementId: chrome.id });
        registerSkiaNode(chrome.id, {
          type: "container",
          elementId: chrome.id,
          ...rect,
          visible: true,
        });
        registeredIds.add(chrome.id);
        childrenMap.set(
          chrome.id,
          children.map((id) => sceneNodes.get(id)!),
        );
      }
    for (const node of root.canvasInputs.values()) {
      const chrome = root.slotChromeInputs.get(node.id);
      const childIds =
        chrome && context.slotMode !== "page"
          ? [...node.children, chrome.id]
          : node.children;
      const children = childIds.map((id) => sceneNodes.get(id));
      if (children.some((child) => !child))
        throw new Error(`CATALOG_CANVAS_CHILD_REQUIRED:${node.id}`);
      childrenMap.set(node.id, children as CanvasSceneNode[]);
    }
    if (pageShell) {
      sceneNodes.set(pageShell.id, {
        id: pageShell.id,
        type: "body",
        props: {},
        parentId: null,
        pageId: pageShell.id,
        layoutId: pageShell.id,
      } as CanvasSceneNode);
      layoutMap.set(pageShell.id, {
        ...pageShell.rect,
        elementId: pageShell.id,
      });
      registerSkiaNode(pageShell.id, {
        type: "box",
        elementId: pageShell.id,
        ...pageShell.rect,
        visible: true,
        box: { fillColor: rgba(pageShell.fill), borderRadius: 0 },
      });
      registeredIds.add(pageShell.id);
      childrenMap.set(
        pageShell.id,
        rootIds.map((id) => {
          const child = sceneNodes.get(id);
          if (!child) throw new Error(`CATALOG_CANVAS_ROOT_REQUIRED:${id}`);
          return child;
        }),
      );
    }
    const stream = buildRenderCommandStream(
      pageShell ? [pageShell.id] : [...rootIds],
      childrenMap,
      layoutMap,
      {},
      { presentationRevision: 0, baseCanonicalRevision: 0 },
      // The subtree splice publishes bounds and upserts the spatial index, so the initial bind
      // publishes its full snapshot too: both consumers read one scene state.
      { syncSpatialIndexSnapshot: true, publishBoundsSnapshot: true },
    );
    const bound = new Map<string, CatalogConsumerNode>();
    const dirty = new Set<string>();
    const unsubscribe = new Map<string, () => void>();
    for (const node of root.canvasInputs.values()) {
      bound.set(node.id, node);
      unsubscribe.set(
        node.id,
        root.subscribeCanvas(node.id, () => dirty.add(node.id)),
      );
    }
    let revision = stream.presentationRevision;
    const update = (): CatalogCanvasUpdate => {
      let geometryQueries = 0;
      const rebind = (id: string, reason: string): CatalogCanvasUpdate => ({
        status: "rebind-required",
        id,
        reason,
      });
      const input = (id: string) => root.canvasInputs.get(id);
      /** Changed engine results (parent-relative rects) against the bound layout map. */
      const changedRects = new Map<string, Rect>();
      const compare = (ids: readonly string[]): string[] => {
        if (!ids.length) return [];
        geometryQueries += ids.length;
        const next = root.getGeometry(ids);
        const changed: string[] = [];
        for (const id of ids) {
          const rect = next.get(id);
          if (!rect) throw new Error(`CATALOG_CANVAS_LAYOUT_REQUIRED:${id}`);
          if (sameRect(rect, changedRects.get(id) ?? layoutMap.get(id)))
            continue;
          changedRects.set(id, rect);
          changed.push(id);
        }
        return changed;
      };
      const sizeChanged = (id: string) => {
        const before = layoutMap.get(id)!;
        const after = changedRects.get(id);
        return (
          !!after &&
          (!before ||
            after.width !== before.width ||
            after.height !== before.height)
        );
      };
      /** A resized box can move or resize its children; a moved box cannot (rects are local). */
      const descend = (id: string): void => {
        for (const child of compare(input(id)!.children))
          if (sizeChanged(child)) descend(child);
      };
      /**
       * Rust block flow (`block.rs` `block_layout` + `tree.rs` `solve_block`): a block-level
       * child's box comes from the container's content width, its own fields, and the running
       * y of the preceding siblings' heights and margins. A sibling's width enters only the
       * container's shrink-to-fit width — that rect is compared first. So when the container is
       * `display: block` with an unchanged rect, the changed child is an in-flow block-level box
       * (not an atomic inline in a line box, not absolute) and its height is unchanged, no
       * sibling rect can change. Catalog nodes carry no margin keys, so margins stay 0.
       */
      const blockFlowSiblingsFixed = (
        id: string,
        parent: CatalogConsumerNode,
      ): boolean => {
        const child = catalogBoxModel(input(id)!);
        // An absolutely placed box is out of flow: with the parent's rect unchanged (checked by
        // the caller) no sibling reads its size, in any parent display.
        if (child.position) return true;
        return (
          catalogBoxModel(parent).display === "block" &&
          !child.display.startsWith("inline") &&
          changedRects.get(id)!.height === layoutMap.get(id)!.height
        );
      };
      /**
       * Geometry region of a layout edit: the seed's own box and descendants, then — while the
       * box on the ancestor path changed size — its parent and (unless block flow proves them
       * fixed) its siblings. The region root is the
       * lowest node whose subtree holds every changed rect; its parent's render context is kept.
       */
      const geometryRegion = (seed: string): string | CatalogCanvasUpdate => {
        compare([seed]);
        descend(seed);
        let regionRoot = seed;
        let cursor = seed;
        while (sizeChanged(cursor)) {
          const parentId = input(cursor)!.parentId;
          const parent = input(parentId);
          if (!parent) return rebind(cursor, "geometry-reaches-scene-root");
          const parentChanged = compare([parentId]).length > 0;
          if (parentChanged) regionRoot = parentId;
          if (parentChanged || !blockFlowSiblingsFixed(cursor, parent)) {
            const siblings = parent.children.filter((id) => id !== cursor);
            for (const sibling of compare(siblings)) {
              regionRoot = parentId;
              if (sizeChanged(sibling)) descend(sibling);
            }
          }
          cursor = parentId;
        }
        return regionRoot;
      };
      const reRegister = new Set<string>();
      const patchRoots = new Set<string>();
      // Structure is a commit-lane subtree splice. Reconcile only the changed parents' trees;
      // unrelated pages keep their registrations, subscriptions, geometry and command spans.
      const structural = new Set<string>();
      for (const id of dirty) {
        const before = bound.get(id);
        const node = input(id);
        if (!before) continue;
        if (!node || node.parentId !== before.parentId) {
          let parentId = before.parentId;
          while (!input(parentId) && bound.has(parentId))
            parentId = bound.get(parentId)!.parentId;
          if (!input(parentId))
            return rebind(id, "structure-reaches-scene-root");
          structural.add(parentId);
        }
        if (node && !sameIds(node.children, before.children))
          structural.add(id);
      }
      const regions = [...structural].filter((id) => {
        for (
          let parent = input(id)?.parentId;
          parent;
          parent = input(parent)?.parentId
        )
          if (structural.has(parent)) return false;
        return true;
      });
      const reconciled = new Set<string>();
      for (const region of regions) {
        const previous = new Set<string>();
        const collectPrevious = (id: string) => {
          if (previous.has(id)) return;
          previous.add(id);
          for (const child of childrenMap.get(id) ?? [])
            collectPrevious(child.id);
        };
        collectPrevious(region);
        const next = new Set<string>();
        const collectNext = (id: string) => {
          if (next.has(id)) return;
          const node = input(id);
          if (
            !node ||
            node.bindingId === "slot" ||
            root.slotChromeInputs.has(id)
          )
            return false;
          next.add(id);
          for (const child of node.children)
            if (collectNext(child) === false) return false;
          return true;
        };
        if (collectNext(region) === false)
          return rebind(region, "slot-structure");
        // Materialize new scene positions before wiring the new child lists.
        for (const id of next) {
          const node = input(id)!;
          const before = bound.get(id);
          if (before && bindingKey(node) !== bindingKey(before))
            return rebind(id, "binding");
          if (!before) {
            sceneNodes.set(id, {
              id,
              type: bindingKey(node),
              props: {},
              parentId: node.parentId,
              pageId: pageShell?.id ?? null,
              layoutId: id,
            } as CanvasSceneNode);
            unsubscribe.set(
              id,
              root.subscribeCanvas(id, () => dirty.add(id)),
            );
            registeredIds.add(id);
            reRegister.add(id);
          } else if (dirty.has(id)) reRegister.add(id);
          bound.set(id, node);
          reconciled.add(id);
        }
        compare([...next]);
        for (const id of next)
          childrenMap.set(
            id,
            input(id)!.children.map((child) => sceneNodes.get(child)!),
          );
        for (const id of previous) {
          if (next.has(id)) continue;
          unsubscribe.get(id)?.();
          unsubscribe.delete(id);
          unregisterSkiaNode(id);
          registeredIds.delete(id);
          sceneNodes.delete(id);
          childrenMap.delete(id);
          layoutMap.delete(id);
          bound.delete(id);
          ranges.delete(id);
          scrollbars.delete(id);
          reconciled.add(id);
        }
        const regionRoot = geometryRegion(region);
        if (typeof regionRoot !== "string") return regionRoot;
        patchRoots.add(regionRoot);
      }
      for (const id of dirty) {
        if (reconciled.has(id)) continue;
        const before = bound.get(id)!;
        const node = input(id);
        if (!node) return rebind(id, "removed");
        if (
          node.parentId !== before.parentId ||
          !sameIds(node.children, before.children)
        )
          return rebind(id, "structure");
        if (bindingKey(node) !== bindingKey(before))
          return rebind(id, "binding");
        // Slot chrome and a child text's inherited metric are bound together with the Slot.
        if (node.bindingId === "slot") return rebind(id, "slot");
        reRegister.add(id);
        bound.set(id, node);
        const layoutInput =
          JSON.stringify(catalogBoxModel(node)) !==
          JSON.stringify(catalogBoxModel(before));
        if (!layoutInput && !compare([id]).length) {
          patchRoots.add(id);
          continue;
        }
        const region = geometryRegion(id);
        if (typeof region !== "string") return region;
        patchRoots.add(region);
      }
      for (const [id, rect] of changedRects) {
        // Slot chrome children are laid out from the Slot box; they are not re-derived here.
        if (input(id)!.bindingId === "slot") return rebind(id, "slot-geometry");
        layoutMap.set(id, { ...rect, elementId: id });
        reRegister.add(id);
      }
      // A moved or resized box changes the scroll range of its nearest clipping ancestor: a
      // scroll/auto box draws again when its scrollbar changes (only then — a page body that
      // scrolls is not rebuilt for every edit inside it; a paint edit moves no range).
      const rectOf = (id: string) => layoutMap.get(id);
      // Removing/reordering a descendant can change the scroll extent even if every surviving
      // box kept its rect (a fixed-size inner container may have overflowed its scroll owner).
      for (const id of new Set([...changedRects.keys(), ...regions])) {
        let cursor = input(id)?.parentId;
        for (let depth = 0; cursor && depth <= 32; depth += 1) {
          const owner = input(cursor);
          if (!owner) break;
          if (catalogOverflowClips(owner.visual.overflow)) {
            if (
              !reRegister.has(cursor) &&
              catalogOverflowScrolls(owner.visual.overflow) &&
              JSON.stringify(
                scrollStateOf(owner, layoutMap.get(cursor)!, rectOf).bar ??
                  null,
              ) !== scrollbars.get(cursor)
            ) {
              reRegister.add(cursor);
              patchRoots.add(cursor);
            }
            break;
          }
          cursor = owner.parentId;
        }
      }
      for (const id of reRegister) {
        const node = input(id)!;
        const binding = bindings[bindingKey(node)!];
        const rect = layoutMap.get(id)!;
        registerSkiaNode(
          id,
          node.hidden || catalogRowSampleHidden(root, node)
            ? hiddenNode(node, rect)
            : withScrollbar(
                node,
                paintedNodeData(
                  root,
                  node,
                  rect,
                  binding,
                  input(node.parentId),
                ),
                rectOf,
              ),
        );
      }
      // Patch only the top-most roots: a root inside another root's subtree is rebuilt with it.
      const roots = [...patchRoots].filter((id) => {
        for (let cursor = input(id)?.parentId; cursor;) {
          if (patchRoots.has(cursor)) return false;
          cursor = input(cursor)?.parentId;
        }
        return true;
      });
      let subtreeNodeVisits = 0;
      let commandWrites = 0;
      for (const id of roots) {
        const context = stream.subtreeBuildContextByElement.get(id);
        if (!context) return rebind(id, "subtree-context");
        revision += 1;
        const replacement = buildSubtreeCommandStream({
          rootId: id,
          childrenMap,
          layoutMap,
          context,
          revision: {
            presentationRevision: revision,
            baseCanonicalRevision: stream.baseCanonicalRevision,
          },
        });
        subtreeNodeVisits += replacement.subtreeSpans.size;
        const patch = applyCommitSubtreeCommandPatch({
          current: stream,
          replacement,
          rootId: id,
          revision,
          canonicalRevision: stream.baseCanonicalRevision,
        });
        if (!patch.applied)
          return rebind(id, `splice-rejected:${patch.reason ?? "unknown"}`);
        const span = replacement.subtreeSpans.get(id)!;
        commandWrites += span.end - span.start;
      }
      dirty.clear();
      return {
        status: "patched",
        rebound: [...reRegister],
        geometryChanged: [...changedRects.keys()],
        geometryQueries,
        patchRoots: roots,
        subtreeBuilds: roots.length,
        subtreeNodeVisits,
        commandWrites,
      };
    };
    /** Whether a record is a scroll/auto box with somewhere to scroll. */
    const scrollable = (id: string) => {
      const range = ranges.get(id);
      return !!range && (range.maxScrollTop > 0 || range.maxScrollLeft > 0);
    };
    /**
     * Scroll a box by a wheel delta (clamped to its range). A change redraws the box at the next
     * `update` (the patch path: its subtree, with the moved children's boxes); false = no change.
     */
    const scrollBy = (id: string, deltaX: number, deltaY: number) => {
      const range = ranges.get(id);
      if (!range) return false;
      const current = offsets.get(id) ?? { scrollTop: 0, scrollLeft: 0 };
      const next = {
        scrollTop: Math.min(
          Math.max(current.scrollTop + deltaY, 0),
          range.maxScrollTop,
        ),
        scrollLeft: Math.min(
          Math.max(current.scrollLeft + deltaX, 0),
          range.maxScrollLeft,
        ),
      };
      if (
        next.scrollTop === current.scrollTop &&
        next.scrollLeft === current.scrollLeft
      )
        return false;
      offsets.set(id, next);
      dirty.add(id);
      return true;
    };
    return {
      stream,
      bindingIds: [...resolvedBindingIds],
      unpainted,
      update,
      scrollable,
      scrollBy,
      dispose: () => {
        unsubscribe.forEach((off) => off());
        registeredIds.forEach(unregisterSkiaNode);
      },
    };
  } catch (error) {
    registeredIds.forEach(unregisterSkiaNode);
    throw error;
  }
}
