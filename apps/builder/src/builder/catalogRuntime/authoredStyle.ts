import type { CSSProperties } from "react";
import { fillsToCssBackgroundStyle } from "@composition/shared";
import type { CatalogFillLayer } from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-248 Phase 4a-3: the node paint surface the Style and Fill panels author (effects, per-corner
 * radius, per-side border width, stacking, CSS background image, fill layers). One mapping —
 * resolved node → CSS longhands — feeds both consumers: the DOM applies it inline, the Canvas
 * converts the same record with the old app's pure style/fill converters (`authoredPaintCanvas`),
 * so an authored value cannot mean one thing in Preview and another on the Canvas. This module is
 * the DOM-safe half (the Preview loads it; no Skia or layout code — G5 bundle gate).
 */
export const CATALOG_AUTHORED_PAINT_KEYS: ReadonlySet<string> = new Set([
  "boxShadow",
  "filter",
  "transform",
  "zIndex",
  "backgroundImage",
  "backgroundSize",
  "radiusTopLeft",
  "radiusTopRight",
  "radiusBottomRight",
  "radiusBottomLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
]);

export const CATALOG_RADIUS_CSS: Readonly<Record<string, string>> = {
  radiusTopLeft: "borderTopLeftRadius",
  radiusTopRight: "borderTopRightRadius",
  radiusBottomRight: "borderBottomRightRadius",
  radiusBottomLeft: "borderBottomLeftRadius",
};
export const CATALOG_SIDE_WIDTH_KEYS = [
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
] as const;

const px = (value: unknown): string => `${Number(value)}px`;

/** CSS longhands of the node's authored paint keys (absent keys emit nothing). */
export function catalogAuthoredPaintCss(
  node: Pick<CatalogConsumerNode, "visual">,
): Record<string, string | number> {
  const visual = node.visual;
  const css: Record<string, string | number> = {};
  for (const key of [
    "boxShadow",
    "filter",
    "transform",
    "backgroundImage",
    "backgroundSize",
  ])
    if (visual[key] !== undefined) css[key] = String(visual[key]);
  if (visual.zIndex !== undefined) css.zIndex = Number(visual.zIndex);
  for (const [key, cssKey] of Object.entries(CATALOG_RADIUS_CSS))
    if (visual[key] !== undefined) css[cssKey] = px(visual[key]);
  for (const key of CATALOG_SIDE_WIDTH_KEYS)
    if (visual[key] !== undefined) css[key] = px(visual[key]);
  return css;
}

/** Fill layers in the Fill panel's item shape, which the old DOM/Canvas converters read. */
export function catalogFillItems(
  fills: readonly CatalogFillLayer[] | undefined,
): unknown[] | undefined {
  if (!fills?.length) return undefined;
  return fills.map(({ kind, ...rest }) => ({ ...rest, type: kind }));
}

/** The Fill panel's items (`type`) as document paint layers (`kind`) — the inverse of the above. */
export function catalogFillLayers(
  items: readonly { type: string }[],
): CatalogFillLayer[] {
  return items.map(
    ({ type, ...rest }) => ({ ...rest, kind: type }) as CatalogFillLayer,
  );
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const CSS_VAR = /^var\(--[a-z0-9-]+\)$/;
/** A resolved color the typed binding paint reads directly (hex6, theme var or keyword). */
export function isTypedCatalogColor(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "black" ||
    value === "white" ||
    value === "transparent" ||
    (typeof value === "string" && (HEX6.test(value) || CSS_VAR.test(value)))
  );
}

/**
 * `backgroundColor` (a Styles or AI style write — a valid visual field) is the box's background:
 * the DOM inlines it and `fill` to the same CSS property, the later key winning. The Canvas paints
 * the background from `fill`, so the node it paints carries the winner as `fill`.
 */
export function catalogVisualWithBackground<
  N extends Pick<CatalogConsumerNode, "visual">,
>(node: N): N {
  const visual = node.visual;
  if (!("backgroundColor" in visual)) return node;
  const { backgroundColor, ...rest } = visual;
  const keys = Object.keys(visual);
  const fillWins = keys.lastIndexOf("fill") > keys.indexOf("backgroundColor");
  return {
    ...node,
    visual: fillWins ? rest : { ...rest, fill: backgroundColor },
  };
}

/** True when the node's paint needs the authored path on either consumer. */
export function hasCatalogAuthoredPaint(
  node: Pick<CatalogConsumerNode, "visual" | "fills">,
): boolean {
  if (node.fills?.length) return true;
  for (const key of Object.keys(node.visual))
    if (CATALOG_AUTHORED_PAINT_KEYS.has(key)) return true;
  return (
    !isTypedCatalogColor(node.visual.fill) ||
    !isTypedCatalogColor(node.visual.borderColor)
  );
}

/** DOM inline additions: authored paint CSS and fill layers as CSS backgrounds. */
export function catalogAuthoredDomStyle(
  node: Pick<CatalogConsumerNode, "visual" | "fills">,
): CSSProperties {
  const style = catalogAuthoredPaintCss(node) as CSSProperties;
  const fills = catalogFillItems(node.fills);
  if (fills) Object.assign(style, fillsToCssBackgroundStyle(fills));
  return style;
}
