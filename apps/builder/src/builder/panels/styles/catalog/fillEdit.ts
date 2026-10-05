import type { FillItem } from "../../../../types/builder/fill.types";

/** Layers equal apart from their ids (a synthesized layer gets a new id on every read). */
const sameLayers = (left: readonly FillItem[], right: readonly FillItem[]) =>
  left.length === right.length &&
  left.every(
    (layer, index) =>
      JSON.stringify({ ...layer, id: "" }) ===
      JSON.stringify({ ...right[index], id: "" }),
  );

/**
 * A Fill edit of a multi-selection. The panel shows the first element's layers and builds the
 * next array on them (`before` → `after`); another element replays the same change on its own
 * layers instead of taking the first element's array (toggling a layer of one must not replace
 * every layer of the others):
 *
 * - same layers as `before` → `after`
 * - a reorder → the same permutation; a change at index i → the changed fields at its index i
 *   (a type change replaces that layer)
 * - one layer added at the end → appended; one removed → the same index removed
 * - a reorder of a different layer count → its own layers; any other edit → `after`
 */
export function replayFillEdit(
  before: readonly FillItem[],
  after: readonly FillItem[],
  own: readonly FillItem[],
): FillItem[] {
  if (sameLayers(own, before)) return [...after];
  if (
    after.length === before.length + 1 &&
    sameLayers(after.slice(0, -1), before)
  )
    return [...own, after[after.length - 1]!];
  if (after.length === before.length - 1) {
    const removed = before.findIndex(
      (layer, index) => layer.id !== after[index]?.id,
    );
    return own.filter((_, index) => index !== removed);
  }
  if (after.length !== before.length) return [...after];
  const ids = before.map((layer) => layer.id);
  const reordered =
    after.some((layer, index) => layer.id !== ids[index]) &&
    after.every((layer) => ids.includes(layer.id));
  if (reordered)
    return own.length === before.length
      ? after.map((layer) => own[ids.indexOf(layer.id)]!)
      : [...own];
  return own.map((layer, index) => {
    const from = before[index];
    const to = after[index];
    if (!from || !to) return layer;
    if (from.type !== to.type) return to;
    const patch = Object.fromEntries(
      Object.entries(to).filter(
        ([key, value]) =>
          key !== "id" &&
          JSON.stringify(value) !==
            JSON.stringify((from as unknown as Record<string, unknown>)[key]),
      ),
    );
    return Object.keys(patch).length
      ? ({ ...layer, ...patch } as FillItem)
      : layer;
  });
}
