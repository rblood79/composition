import { CATALOG_AUTHORED_PAINT_KEYS } from "./authoredStyle";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogCurrentTextWeight } from "../resolvers/resolveCatalogRuleCanvasBox";
import { installedBaseFontFamily } from "./themeMaps";

/**
 * ADR-248 — one box model per resolved catalog node. The Rust layout input (`compositionRoot`)
 * and the DOM binding (`domBinding`) both project from this, so Canvas geometry and DOM CSS read
 * the same resolved values. A number is CSS px; a string is a CSS length keyword/value.
 */
export type CatalogLength = number | string;

/**
 * A glyph's icon square (Icon · SelectIcon · Illustration): an authored `fontSize` overrides the size scale's
 * `iconSize`, as the Preview `renderIcon` reads `style.fontSize` before the size map. Part rules
 * write `iconSize`, so a `fontSize` here is always the node's own authored value. The Rust input,
 * the Canvas icon paint and the DOM binding read this one value.
 */
export function catalogGlyphSize(
  node: CatalogConsumerNode,
): number | undefined {
  const authored = node.visual.fontSize;
  if (typeof authored === "number" && authored > 0) return authored;
  const scale = node.visual.iconSize;
  return typeof scale === "number" ? scale : undefined;
}
export interface CatalogBoxModel {
  display: string;
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  flexWrap?: string;
  /** Absolute placement from the parent's padding-box origin. */
  position?: { x: number; y: number };
  width?: CatalogLength;
  height?: CatalogLength;
  minWidth?: CatalogLength;
  minHeight?: CatalogLength;
  gap?: CatalogLength;
  padding?: {
    top: CatalogLength;
    right: CatalogLength;
    bottom: CatalogLength;
    left: CatalogLength;
  };
  borderWidth?: CatalogLength;
}

/**
 * Visual keys the catalog Canvas and DOM bindings consume. Anything else on a resolved node is
 * an explicit binding error in both consumers (`CATALOG_CANVAS_/CATALOG_DOM_VISUAL_UNSUPPORTED`).
 */
export const CATALOG_BINDING_VISUAL_KEYS: ReadonlySet<string> = new Set([
  ...CATALOG_AUTHORED_PAINT_KEYS,
  // Typography (Phase 4a-3c): text bindings paint and measure it; other nodes pass the inherited
  // keys down (`CatalogConsumerNode.inheritedText`).
  "aspectRatio",
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
  "fill",
  "borderColor",
  "borderWidth",
  "borderStyle",
  "fillAlpha",
  "minHeight",
  "radius",
  "overflow",
  "gap",
  "padding",
  "width",
  "height",
  "color",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "iconGap",
  "iconSize",
  "paddingX",
  "paddingY",
  "minWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "opacity",
]);

/** Bindings whose default display is block; every other binding is a flex container. */
const blockBindings = new Set([
  "frame",
  "rectangle",
  "slot",
  "text",
  "heading",
  "paragraph",
]);

const length = (value: unknown): CatalogLength | undefined =>
  typeof value === "number" || typeof value === "string" ? value : undefined;

export function catalogBoxModel(node: CatalogConsumerNode): CatalogBoxModel {
  const layout = node.layout;
  const paddingX = length(node.visual.paddingX ?? node.visual.padding);
  const paddingY = length(node.visual.paddingY ?? node.visual.padding);
  const model: CatalogBoxModel = {
    display:
      layout.display ??
      (blockBindings.has(node.bindingId ?? "") ? "block" : "flex"),
  };
  const flexDirection =
    layout.flexDirection ??
    (node.bindingId === "group"
      ? node.props.orientation === "horizontal"
        ? "row"
        : "column"
      : undefined);
  if (flexDirection) model.flexDirection = flexDirection;
  if (layout.alignItems) model.alignItems = layout.alignItems;
  if (layout.justifyContent) model.justifyContent = layout.justifyContent;
  if (layout.flexWrap) model.flexWrap = layout.flexWrap;
  if (node.placement?.kind === "absolute")
    model.position = { x: node.placement.x, y: node.placement.y };
  const width = length(node.sizing.width ?? node.visual.width);
  const height = length(node.sizing.height ?? node.visual.height);
  const minWidth = length(node.sizing.minWidth ?? node.visual.minWidth);
  const minHeight = length(node.sizing.minHeight ?? node.visual.minHeight);
  const gap = length(node.visual.gap);
  const borderWidth = length(node.visual.borderWidth);
  if (width !== undefined) model.width = width;
  if (height !== undefined) model.height = height;
  if (minWidth !== undefined) model.minWidth = minWidth;
  if (minHeight !== undefined) model.minHeight = minHeight;
  if (gap !== undefined) model.gap = gap;
  const side = (key: string, axis: CatalogLength | undefined) =>
    length(node.visual[key]) ?? axis;
  const padding = {
    top: side("paddingTop", paddingY),
    right: side("paddingRight", paddingX),
    bottom: side("paddingBottom", paddingY),
    left: side("paddingLeft", paddingX),
  };
  if (Object.values(padding).some((value) => value !== undefined))
    model.padding = {
      top: padding.top ?? 0,
      right: padding.right ?? 0,
      bottom: padding.bottom ?? 0,
      left: padding.left ?? 0,
    };
  if (borderWidth !== undefined) model.borderWidth = borderWidth;
  return model;
}

/**
 * Authored typography of a text-painting node: its own value, else the nearest ancestor's
 * (`inheritedText`, CSS inherited properties); `textDecoration` is not inherited. The font family
 * falls back to the theme's base family (the DOM root inherits it). Absent keys keep each
 * consumer's default. The Canvas paragraph, the layout measure and the DOM style read this.
 */
export interface CatalogTextTypography {
  fontFamily?: string;
  fontStyle?: string;
  letterSpacing?: number;
  textAlign?: string;
  textTransform?: string;
  textDecoration?: string;
  whiteSpace?: string;
  wordBreak?: string;
  overflowWrap?: string;
  textOverflow?: string;
}
export function catalogTextTypography(
  node: Pick<CatalogConsumerNode, "visual" | "inheritedText">,
): CatalogTextTypography {
  const read = (key: string) => node.visual[key] ?? node.inheritedText?.[key];
  const text = (key: string) => {
    const value = read(key);
    return value === undefined ? undefined : String(value);
  };
  const letterSpacing = read("letterSpacing");
  const typography: CatalogTextTypography = {};
  for (const key of [
    "fontFamily",
    "fontStyle",
    "textAlign",
    "textTransform",
    "whiteSpace",
    "wordBreak",
    "overflowWrap",
  ] as const) {
    const value = text(key);
    if (value !== undefined) typography[key] = value;
  }
  if (typography.fontFamily === undefined) {
    const base = installedBaseFontFamily();
    if (base !== undefined) typography.fontFamily = base;
  }
  if (letterSpacing !== undefined)
    typography.letterSpacing = Number(letterSpacing);
  if (node.visual.textDecoration !== undefined)
    typography.textDecoration = String(node.visual.textDecoration);
  if (node.visual.textOverflow !== undefined)
    typography.textOverflow = String(node.visual.textOverflow);
  return typography;
}

const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
]);
/**
 * A CSS font-family list as Canvas paragraph families: named families in order, then the
 * default Pretendard (the Canvas cannot resolve a generic family; the DOM default is the same).
 */
export function catalogFontFamilies(fontFamily: string | undefined): string[] {
  const named = (fontFamily ?? "")
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/g, ""))
    .filter((family) => family && !GENERIC_FAMILIES.has(family.toLowerCase()));
  return named.includes("Pretendard") ? named : [...named, "Pretendard"];
}

/**
 * The text may break inside a word wider than its box (CSS `overflow-wrap: break-word | anywhere`,
 * `word-break: break-all` and the legacy `break-word`): the layout wraps it at the box width, not
 * at the longest word.
 */
export function catalogTextBreaksWords(font: {
  overflowWrap?: string;
  wordBreak?: string;
}): boolean {
  return (
    font.overflowWrap === "break-word" ||
    font.overflowWrap === "anywhere" ||
    font.wordBreak === "break-all" ||
    font.wordBreak === "break-word"
  );
}

/** Resolved text paint shared by the Canvas paragraph and the DOM text style. */
export interface CatalogTextMetrics extends CatalogTextTypography {
  fontSize: number;
  /** Ratio to fontSize; undefined keeps the renderer's normal line height. */
  lineHeight?: number;
  fontWeight?: number;
  color: unknown;
}

/**
 * Text metrics of a text-painting node. A text node without its own fontSize inside a Slot uses
 * the Slot's fontSize/lineHeight (the Slot owns the placeholder/content text metric); otherwise
 * 16px is the default. Canvas and DOM both call this, so neither relies on CSS inheritance: a
 * current crumb's label Text (`presence` derives `_isLast`) takes the RAC Link's current weight
 * (catalog `Breadcrumb.currentTextWeight`) and accent color, as the Preview's `.react-aria-Text`
 * inherits them; a Tab/Tag label takes its item's color the same way (`derivedProps.color`).
 */
export function catalogTextMetrics(
  node: CatalogConsumerNode,
  parent: CatalogConsumerNode | undefined,
): CatalogTextMetrics {
  const inheritsSlot =
    node.visual.fontSize === undefined && parent?.bindingId === "slot";
  const fontSize = Number(
    (inheritsSlot ? parent.visual.fontSize : node.visual.fontSize) ?? 16,
  );
  if (!Number.isFinite(fontSize) || fontSize <= 0)
    throw new Error(`CATALOG_TEXT_FONT_SIZE_UNSUPPORTED:${node.id}`);
  const lineHeight = inheritsSlot
    ? parent.visual.lineHeight
    : node.visual.lineHeight;
  return {
    ...catalogTextTypography(node),
    fontSize,
    ...(lineHeight !== undefined ? { lineHeight: Number(lineHeight) } : {}),
    ...(node.derivedProps?._isLast === true
      ? { fontWeight: catalogCurrentTextWeight("Breadcrumb") ?? 600 }
      : node.visual.fontWeight !== undefined
        ? { fontWeight: Number(node.visual.fontWeight) }
        : {}),
    // The current Link's `[data-current] { color: var(--breadcrumb-accent) }` (= `--accent`); a
    // Tab/Tag label's item color (`color: inherit` — the root derives it from the item's paint).
    color:
      node.derivedProps?._isLast === true
        ? "var(--accent)"
        : (node.derivedProps?.color ?? node.visual.color ?? "#000000"),
  };
}
