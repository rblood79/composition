import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-248 4e: the old Builder's sample policy (ADR-157) over catalog records — a bound collection
 * that grows with its rows (`rowCount`, no bounded height) shows its first `rowSample` rows; the
 * later rows keep their layout box (the owner is the DOM's height) but are neither drawn nor
 * picked, and the editor marks their area "+N more" (hatch, Builder chrome — not D3 paint).
 */
export interface CatalogRowSampleRoot {
  readonly rowSample?: number;
  readonly canvasInputs: ReadonlyMap<string, CatalogConsumerNode>;
}

/** A row record past the sample of an owner that grows with its rows. */
export function catalogRowSampleHidden(
  root: CatalogRowSampleRoot,
  node: CatalogConsumerNode,
): boolean {
  const sample = root.rowSample;
  if (sample === undefined || node.rowIndex === undefined) return false;
  if (node.rowIndex < sample) return false;
  return root.canvasInputs.get(node.parentId)?.rowCount !== undefined;
}

/** The record or one of its ancestors is a row the sample does not draw (not pickable). */
export function catalogRowSampleHiddenWithin(
  root: CatalogRowSampleRoot,
  id: string,
): boolean {
  if (root.rowSample === undefined) return false;
  for (
    let node = root.canvasInputs.get(id);
    node;
    node = root.canvasInputs.get(node.parentId)
  )
    if (catalogRowSampleHidden(root, node)) return true;
  return false;
}

export interface CatalogRowRemainder {
  /** The row owner record (its box holds the rows). */
  ownerId: string;
  /** The laid-out rows the sample does not draw (the marked area is their box). */
  hiddenIds: readonly string[];
  /** The rows not drawn: the collection's count past the sample. */
  hiddenRows: number;
}

/** Owners showing a sample: where the editor marks the rows it does not draw. */
export function catalogRowRemainders(
  root: CatalogRowSampleRoot,
): CatalogRowRemainder[] {
  const sample = root.rowSample;
  if (sample === undefined) return [];
  const out: CatalogRowRemainder[] = [];
  for (const node of root.canvasInputs.values()) {
    if (node.rowCount === undefined || node.rowCount <= sample) continue;
    out.push({
      ownerId: node.id,
      hiddenIds: node.children.filter((id) => {
        const row = root.canvasInputs.get(id)?.rowIndex;
        return row !== undefined && row >= sample;
      }),
      hiddenRows: node.rowCount - sample,
    });
  }
  return out;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
/**
 * The marked area of a remainder: the union of the rows not drawn (their layout boxes — the owner
 * keeps the DOM's height), cut to what the owner shows (`clip`, its clip-aware box).
 */
export function catalogRowRemainderBox(
  remainder: CatalogRowRemainder,
  boxOf: (id: string) => Box | undefined,
  clip?: Box,
): Box | undefined {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const id of remainder.hiddenIds) {
    const box = boxOf(id);
    if (!box) continue;
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.width);
    bottom = Math.max(bottom, box.y + box.height);
  }
  if (clip) {
    left = Math.max(left, clip.x);
    top = Math.max(top, clip.y);
    right = Math.min(right, clip.x + clip.width);
    bottom = Math.min(bottom, clip.y + clip.height);
  }
  if (!(right > left && bottom > top)) return undefined;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
