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
  authoredVisual?: (
    node: CatalogConsumerNode,
  ) => Readonly<Record<string, unknown>>,
): Record<string, string | number> | undefined {
  const parent = get(node.parentId);
  if (!parent) return undefined;
  const fixed = catalogFixedMainShrink(node, parent, authoredVisual);
  if (!node.fillSizing) return fixed;
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
  const layout = { ...fixed, ...projected };
  return Object.keys(layout).length ? layout : undefined;
}

function boxStyle(item: CatalogConsumerNode): Record<string, unknown> {
  const box = catalogBoxModel(item);
  return {
    display: box.display,
    flexDirection: box.flexDirection ?? "row",
    ...(box.width !== undefined ? { width: box.width } : {}),
    ...(box.height !== undefined ? { height: box.height } : {}),
    ...(box.minWidth !== undefined ? { minWidth: box.minWidth } : {}),
    ...(box.minHeight !== undefined ? { minHeight: box.minHeight } : {}),
    ...item.layout,
    ...(item.visual.aspectRatio !== undefined
      ? { aspectRatio: item.visual.aspectRatio }
      : {}),
  };
}

/** A node with a written or rule length on either axis (a fixed-shrink candidate). */
export function hasLength(node: CatalogConsumerNode): boolean {
  return (
    node.sizing.width != null ||
    node.sizing.height != null ||
    typeof node.visual.width === "string" ||
    typeof node.visual.height === "string"
  );
}

/** Lengths that are not a fixed size (the box sizes from its content or its parent). */
const CONTENT_SIZE_KEYWORDS = new Set([
  "auto",
  "fit-content",
  "min-content",
  "max-content",
]);

/**
 * A size the author wrote on the main axis of a flex parent is the size (Size Fixed · Parent ·
 * Viewport): the item does not shrink below it (`flex-shrink: 0`), as the Fixed mode always
 * wrote (`sizeModeResolver.resolveFixed`, 2026-09). Resolved here — not written with the size —
 * so a parent made a flex later, or turned to the other direction, still decides it. A rule's
 * default length (Table `width: 100%`) is not authored and keeps shrinking; an authored or
 * rule flex shrink wins. **Why (2026-11-13)**: the catalog Height write
 * (`catalogSizingCommand`) wrote the size alone, so Height 400 in a column flex body that
 * overflowed shrank to 128 (사용자 보고 「table height 400 을 넣어도 적용이 되지 않는다」).
 */
export function catalogFixedMainShrink(
  node: CatalogConsumerNode,
  parent: CatalogConsumerNode,
  authoredVisual?: (
    node: CatalogConsumerNode,
  ) => Readonly<Record<string, unknown>>,
): { flexShrink: number } | undefined {
  if (node.layout.flexShrink !== undefined) return undefined;
  const position = node.layout.position;
  if (position === "absolute" || position === "fixed") return undefined;
  const parentStyle = boxStyle(parent);
  const display = String(parentStyle.display);
  if (display !== "flex" && display !== "inline-flex") return undefined;
  const axis = String(parentStyle.flexDirection).startsWith("column")
    ? "height"
    : "width";
  if (node.fillSizing?.[axis]) return undefined;
  if (node.sizing[axis] != null) return { flexShrink: 0 };
  const value = node.visual[axis];
  if (typeof value !== "string" || CONTENT_SIZE_KEYWORDS.has(value.trim()))
    return undefined;
  return authoredVisual?.(node)[axis] !== undefined
    ? { flexShrink: 0 }
    : undefined;
}

/** Records whose fill projection reads `node` (its fill children and their fill children). */
export function catalogFillDependents(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  authoredVisual?: (node: CatalogConsumerNode) => Readonly<Record<string, unknown>>,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  for (const id of node.children) {
    const child = get(id);
    if (!child) continue;
    // (A sized child whose fixed shrink turns on or off with this box — `catalogFixedMainShrink`.)
    if (
      child.fillSizing ||
      (hasLength(child) &&
        (child.fillLayout?.flexShrink === 0) !==
          (catalogFixedMainShrink(child, node, authoredVisual) !== undefined))
    )
      out.push(child);
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
