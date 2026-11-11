import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-157 sample over catalog records: a bound collection that grows with its rows builds only
 * the rows its page can show (`CatalogRootOptions.rowSample`); the rest are not records — their
 * area keeps its height below the sample and the editor marks it "+N more" (hatch, Builder chrome
 * — not D3 paint).
 */
export interface CatalogRowSampleRoot {
  readonly canvasInputs: ReadonlyMap<string, CatalogConsumerNode>;
  rowRemainders(): ReadonlyMap<
    string,
    { readonly hiddenRows: number; readonly height: number }
  >;
}

export interface CatalogRowRemainder {
  /** The row owner record (its box holds the rows and the area). */
  ownerId: string;
  /** The rows the sample built (the area starts below them). */
  rowIds: readonly string[];
  /** The collection's rows not built. */
  hiddenRows: number;
  /** The area's height (`CatalogRowRemainderArea.height`). */
  height: number;
}

/** Owners showing a sample: where the editor marks the rows it did not build. */
export function catalogRowRemainders(
  root: CatalogRowSampleRoot,
): CatalogRowRemainder[] {
  const out: CatalogRowRemainder[] = [];
  for (const [ownerId, area] of root.rowRemainders()) {
    const owner = root.canvasInputs.get(ownerId);
    if (!owner) continue;
    out.push({
      ownerId,
      rowIds: owner.children.filter(
        (id) => root.canvasInputs.get(id)?.rowIndex !== undefined,
      ),
      hiddenRows: area.hiddenRows,
      height: area.height,
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
 * The marked area of a remainder: as wide as the sample rows, `height` tall below the lowest of
 * them, cut to what the owner shows (`clip`, its clip-aware box).
 */
export function catalogRowRemainderBox(
  remainder: CatalogRowRemainder,
  boxOf: (id: string) => Box | undefined,
  clip?: Box,
): Box | undefined {
  let left = Infinity;
  let right = -Infinity;
  let top = -Infinity;
  for (const id of remainder.rowIds) {
    const box = boxOf(id);
    if (!box) continue;
    left = Math.min(left, box.x);
    right = Math.max(right, box.x + box.width);
    top = Math.max(top, box.y + box.height);
  }
  let bottom = top + remainder.height;
  if (clip) {
    left = Math.max(left, clip.x);
    top = Math.max(top, clip.y);
    right = Math.min(right, clip.x + clip.width);
    bottom = Math.min(bottom, clip.y + clip.height);
  }
  if (!(right > left && bottom > top)) return undefined;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
