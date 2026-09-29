import type { CSSProperties } from "react";
import { fillsToCssBackgroundStyle } from "@composition/shared";
import type { CatalogFillLayer } from "../../../../../packages/shared/src/catalog/document/types";
import type { CanvasSceneNode } from "../workspace/canvas/scene/canvasSceneNode";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import { buildBoxNodeData } from "../workspace/canvas/skia/buildBoxNodeData";
import {
  colorIntToFloat32,
  cssColorToAlpha,
  cssColorToHex,
} from "../workspace/canvas/styleConversion/styleConverter";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-248 Phase 4a-3: the node paint surface the Style and Fill panels author (effects, per-corner
 * radius, per-side border width, stacking, CSS background image, fill layers). One mapping —
 * resolved node → CSS longhands — feeds both consumers: the DOM applies it inline, the Canvas
 * converts the same record with the old app's pure style/fill converters (`buildBoxNodeData`),
 * so an authored value cannot mean one thing in Preview and another on the Canvas.
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

const RADIUS_CSS: Readonly<Record<string, string>> = {
  radiusTopLeft: "borderTopLeftRadius",
  radiusTopRight: "borderTopRightRadius",
  radiusBottomRight: "borderBottomRightRadius",
  radiusBottomLeft: "borderBottomLeftRadius",
};
const SIDE_WIDTH_KEYS = [
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
  for (const [key, cssKey] of Object.entries(RADIUS_CSS))
    if (visual[key] !== undefined) css[cssKey] = px(visual[key]);
  for (const key of SIDE_WIDTH_KEYS)
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

/** Any CSS color (hex3/4/6/8, rgb(a), hsl(a), keyword) as Skia RGBA floats. */
export function catalogCssColorRgba(value: string): Float32Array {
  return colorIntToFloat32(cssColorToHex(value), cssColorToAlpha(value));
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

/**
 * Canvas: overlay the authored paint on a binding's node data. The same CSS record (plus the
 * resolved fill/border that the old builder needs to place fills and per-side strokes) runs through
 * the old `buildBoxNodeData`; fill channels, radii, side widths, effects, transform and stacking
 * are taken from its result.
 */
export function applyCatalogAuthoredPaint(
  node: Pick<CatalogConsumerNode, "id" | "visual" | "fills">,
  data: SkiaNodeData,
  rect: { x: number; y: number; width: number; height: number },
  theme: "light" | "dark" = "light",
): SkiaNodeData {
  if (!hasCatalogAuthoredPaint(node)) return data;
  const visual = node.visual;
  const style: Record<string, string | number> = {
    ...catalogAuthoredPaintCss(node),
    ...(visual.borderColor !== undefined &&
    typeof visual.borderColor === "string"
      ? { borderColor: visual.borderColor }
      : {}),
    ...(visual.borderWidth !== undefined
      ? { borderWidth: px(visual.borderWidth) }
      : {}),
    ...(visual.borderStyle !== undefined
      ? { borderStyle: String(visual.borderStyle) }
      : SIDE_WIDTH_KEYS.some((key) => visual[key] !== undefined) ||
          visual.borderWidth !== undefined
        ? { borderStyle: "solid" }
        : {}),
    ...(visual.radius !== undefined ? { borderRadius: px(visual.radius) } : {}),
  };
  // Per-corner radius longhands must follow the shorthand they refine.
  for (const cssKey of Object.values(RADIUS_CSS))
    if (cssKey in style) {
      const value = style[cssKey];
      delete style[cssKey];
      style[cssKey] = value;
    }
  const fills = catalogFillItems(node.fills);
  const built = buildBoxNodeData({
    element: {
      id: node.id,
      type: "div",
      props: { style },
      ...(fills ? { fills } : {}),
    } as unknown as CanvasSceneNode,
    layout: { ...rect, elementId: node.id } as never,
    theme,
  });
  if (!built) return data;
  const next: SkiaNodeData = { ...data };
  if (built.effects?.length)
    next.effects = [...(data.effects ?? []), ...built.effects];
  if (built.presentationShadowTargets?.length)
    next.presentationShadowTargets = built.presentationShadowTargets;
  if (built.transform) next.transform = built.transform;
  if (built.blendMode) next.blendMode = built.blendMode;
  if (built.zIndex !== undefined) next.zIndex = built.zIndex;
  if (built.isStackingContext) next.isStackingContext = true;
  if (data.box && built.box) {
    const box = { ...data.box };
    if (fills || visual.backgroundImage !== undefined) {
      box.fillColor = built.box.fillColor;
      if (built.box.fill) box.fill = built.box.fill;
      if (built.box.fillUnderlays) box.fillUnderlays = built.box.fillUnderlays;
      next.presentationFillTargets = built.presentationFillTargets;
    }
    if (Object.values(RADIUS_CSS).some((cssKey) => cssKey in style))
      box.borderRadius = built.box.borderRadius;
    if (built.box.strokeWidths) box.strokeWidths = built.box.strokeWidths;
    if (
      SIDE_WIDTH_KEYS.some((key) => visual[key] !== undefined) &&
      built.box.strokeColor
    ) {
      box.strokeColor ??= built.box.strokeColor;
      box.strokeWidth ??= built.box.strokeWidth;
    }
    next.box = box;
  }
  return next;
}
