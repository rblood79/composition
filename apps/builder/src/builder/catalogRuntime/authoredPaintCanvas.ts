import type { CanvasSceneNode } from "../workspace/canvas/scene/canvasSceneNodeTypes";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import { buildBoxNodeData } from "../workspace/canvas/skia/buildBoxNodeData";
import {
  colorIntToFloat32,
  cssColorToAlpha,
  cssColorToHex,
} from "../workspace/canvas/styleConversion/styleConverter";
import {
  CATALOG_RADIUS_CSS,
  CATALOG_SIDE_WIDTH_KEYS,
  catalogAuthoredPaintCss,
  catalogFillItems,
  hasCatalogAuthoredPaint,
} from "./authoredStyle";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-248 Phase 4a-3: the Canvas half of the authored paint (`authoredStyle` is the CSS record both
 * consumers read). Split out for the G5 bundle gate: the Preview DOM path must not load the old
 * builder's Skia/layout converters.
 */

const px = (value: unknown): string => `${Number(value)}px`;

/** Any CSS color (hex3/4/6/8, rgb(a), hsl(a), keyword) as Skia RGBA floats. */
export function catalogCssColorRgba(value: string): Float32Array {
  return colorIntToFloat32(cssColorToHex(value), cssColorToAlpha(value));
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
      : CATALOG_SIDE_WIDTH_KEYS.some((key) => visual[key] !== undefined) ||
          visual.borderWidth !== undefined
        ? { borderStyle: "solid" }
        : {}),
    ...(visual.radius !== undefined ? { borderRadius: px(visual.radius) } : {}),
  };
  // Per-corner radius longhands must follow the shorthand they refine.
  for (const cssKey of Object.values(CATALOG_RADIUS_CSS))
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
    if (Object.values(CATALOG_RADIUS_CSS).some((cssKey) => cssKey in style))
      box.borderRadius = built.box.borderRadius;
    if (built.box.strokeWidths) box.strokeWidths = built.box.strokeWidths;
    if (
      CATALOG_SIDE_WIDTH_KEYS.some((key) => visual[key] !== undefined) &&
      built.box.strokeColor
    ) {
      box.strokeColor ??= built.box.strokeColor;
      box.strokeWidth ??= built.box.strokeWidth;
    }
    next.box = box;
  }
  return next;
}
