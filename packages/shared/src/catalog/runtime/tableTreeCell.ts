/**
 * ADR-315 Phase 5 증분 5b-3 — a grouped Table's tree cell on the Builder's Canvas: the expand button
 * the DOM's RAC Cell draws in its Table's `treeColumn` (`CatalogTableCell` · `Table.css` — S2
 * TableView's tree cell) at the cell's start: a `1lh` square holding a `1em` chevron, then a 4px gap,
 * then the cell's content. The Canvas reads the same room off the cell's own font: the box keeps
 * the button's room at its start (`catalogBoxModel`) and the chevron is drawn in it
 * (`ruleShapes.ts`). The Preview · Publish draw RAC's button and take no mark.
 */
import type { CatalogConsumerNode } from "./compositionRoot";

/** The resolver's mark on a top group row's tree cell (`"closed"` · `"open"`) — never authored. */
export const CATALOG_TREE_CELL_PROP = "_treeCell";
/** The gap between the button and the content (`Table.css` `.table-tree-cell` `gap`). */
export const CATALOG_TREE_CELL_GAP = 4;

export interface CatalogTreeCellGlyph {
  readonly expanded: boolean;
  /** The chevron's size — `1em` of the cell's font. */
  readonly fontSize: number;
  /** The button's square — `1lh` of the cell's font. */
  readonly lineHeight: number;
  /** The room the button takes at the cell's start: its square and the gap. */
  readonly reserve: number;
}

/** A tree cell's button (its mark — `CATALOG_TREE_CELL_PROP`), or undefined for any other node. */
export function catalogTreeCellGlyph(
  node: Pick<CatalogConsumerNode, "props" | "visual">,
): CatalogTreeCellGlyph | undefined {
  const mark = node.props[CATALOG_TREE_CELL_PROP];
  if (mark !== "open" && mark !== "closed") return undefined;
  const fontSize = Number(node.visual.fontSize);
  if (!Number.isFinite(fontSize) || fontSize <= 0) return undefined;
  // (A record's line height is a ratio of its font size — a px text is its length.)
  const line = node.visual.lineHeight;
  const ratio = typeof line === "number" ? line : Number.NaN;
  const pixels =
    typeof line === "string" && line.endsWith("px") ? parseFloat(line) : NaN;
  const lineHeight =
    Math.round(
      (Number.isFinite(pixels)
        ? pixels
        : (Number.isFinite(ratio) ? ratio : 1.2) * fontSize) * 100,
    ) / 100;
  return {
    expanded: mark === "open",
    fontSize,
    lineHeight,
    reserve: lineHeight + CATALOG_TREE_CELL_GAP,
  };
}
