import { catalogIsOutOfFlow } from "./positioning";

interface LayoutRecord {
  readonly hidden?: boolean;
  readonly layout: Readonly<Record<string, string>>;
}

interface LayoutTreeRecord extends LayoutRecord {
  readonly id: string;
  readonly parentId: string;
}

/** Resolved presence and display, shared by the layout input and editing consumers.
 * Zero-sized boxes, opacity and CSS visibility do not remove an item from layout.
 * `contents` keeps its subtree participating; flattening it belongs to the layout engine.
 */
export const catalogParticipatesInLayout = (record: LayoutRecord): boolean =>
  !record.hidden && record.layout.display !== "none";

/** A participating child that takes a slot in its container's normal flow. */
export const catalogParticipatesInFlow = (record: LayoutRecord): boolean =>
  catalogParticipatesInLayout(record) && !catalogIsOutOfFlow(record);

/** Editing geometry is available only while the record and its ancestors have layout.
 * Missing parents terminate at the consumer tree boundary (the synthetic page root).
 * A malformed cycle is not an editable displayed subtree.
 */
export function catalogHasDisplayedLayout(
  record: LayoutTreeRecord,
  records: ReadonlyMap<string, LayoutTreeRecord>,
): boolean {
  const seen = new Set<string>();
  let current: LayoutTreeRecord | undefined = record;
  while (current) {
    if (!catalogParticipatesInLayout(current) || seen.has(current.id))
      return false;
    seen.add(current.id);
    current = records.get(current.parentId);
  }
  return true;
}
