import {
  hasDefiniteAxisSize,
  resolveFillProjection,
  type FillParentContext,
} from "@composition/shared";
import { catalogBoxModel } from "./boxModel";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-248 Phase 4a-3d: a node's fill intent (ADR-224 `fillSizing`) projected against its parent's
 * resolved box, with the shared `resolveFillProjection` (the old Canvas and Preview projection).
 * The composition root stores the result on the record (`fillLayout`); the Rust layout input and
 * the DOM style both apply it, so the two consumers cannot project the same intent differently.
 */
export function catalogFillLayout(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): Record<string, string | number> | undefined {
  if (!node.fillSizing) return undefined;
  const parent = get(node.parentId);
  if (!parent) return undefined;
  const boxStyle = (item: CatalogConsumerNode): Record<string, unknown> => {
    const box = catalogBoxModel(item);
    return {
      display: box.display,
      flexDirection: box.flexDirection ?? "row",
      ...(box.width !== undefined ? { width: box.width } : {}),
      ...(box.height !== undefined ? { height: box.height } : {}),
      ...(box.minWidth !== undefined ? { minWidth: box.minWidth } : {}),
      ...(box.minHeight !== undefined ? { minHeight: box.minHeight } : {}),
      ...item.layout,
      ...(item.placement ? { position: "absolute" } : {}),
      ...(item.visual.aspectRatio !== undefined
        ? { aspectRatio: item.visual.aspectRatio }
        : {}),
    };
  };
  const parentStyle = boxStyle(parent);
  const grand = get(parent.parentId);
  const grandStyle = grand ? boxStyle(grand) : undefined;
  const grandContext: FillParentContext | undefined = grandStyle
    ? {
        display: String(grandStyle.display),
        flexDirection: String(grandStyle.flexDirection),
      }
    : undefined;
  const parentFill = {
    type: typeOf(parent),
    sizing: parent.fillSizing as never,
  };
  const projected = resolveFillProjection(
    node.fillSizing as never,
    boxStyle(node),
    {
      display: String(parentStyle.display),
      flexDirection: String(parentStyle.flexDirection),
      definite: {
        width: hasDefiniteAxisSize(
          parentFill,
          parentStyle,
          "width",
          "desktop",
          grandContext,
        ),
        height: hasDefiniteAxisSize(
          parentFill,
          parentStyle,
          "height",
          "desktop",
          grandContext,
        ),
      },
    },
  );
  return Object.keys(projected).length ? projected : undefined;
}

/** Records whose fill projection reads `node` (its fill children and their fill children). */
export function catalogFillDependents(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  for (const id of node.children) {
    const child = get(id);
    if (!child) continue;
    if (child.fillSizing) out.push(child);
    for (const grandId of child.children) {
      const grand = get(grandId);
      if (grand?.fillSizing) out.push(grand);
    }
  }
  return out;
}

/** CSS property of a typed layout field (insets are the CSS offset properties). */
const LAYOUT_CSS_NAME: Readonly<Record<string, string>> = {
  insetLeft: "left",
  insetTop: "top",
  insetRight: "right",
  insetBottom: "bottom",
};
/** Typed layout values (and a fill projection) as DOM inline CSS. */
export function catalogLayoutCss(
  layout: Readonly<Record<string, string | number>>,
): Record<string, string | number> {
  const css: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(layout))
    css[LAYOUT_CSS_NAME[key] ?? key] =
      key === "flexGrow" || key === "flexShrink" ? Number(value) : value;
  return css;
}

/** Rust `aspectRatio` (f32) from the authored CSS value (`16 / 9` or a number). */
export function catalogAspectRatio(value: unknown): number | undefined {
  if (typeof value === "number") return value > 0 ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(value.trim());
  if (!match) return undefined;
  const ratio = Number(match[1]) / Number(match[2]);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}
