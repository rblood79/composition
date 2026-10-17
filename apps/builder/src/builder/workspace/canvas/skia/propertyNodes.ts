/**
 * ADR-269 Phase 1 — property node table: the scroll context of the command stream.
 *
 * A scroll/auto box's position is not baked into its commands or its node data: the recorder
 * (`visitElement` — child boxes, sticky offsets) and the executor (`CHILDREN_BEGIN` translate,
 * `CHILDREN_END` scrollbar) read it here by the owner's element id. A scroll then changes one entry
 * and moves the descendants' maps (`subtreeTranslate.ts` `applyScrollDelta`) — the owner's subtree
 * is not recorded again, and its node data (the picture key) does not change.
 *
 * Keyed like the Skia node registry (`useSkiaNode.ts`): the binding that registers a node writes its
 * entry and removes it with the node.
 */
/** A scroll/auto box's scrollbar (track = the box side; `catalogScrollbar` derives it). */
export interface ScrollbarGeometry {
  vertical?: { trackHeight: number; thumbHeight: number; thumbY: number };
  horizontal?: { trackWidth: number; thumbWidth: number; thumbX: number };
}

export interface ScrollNode {
  readonly scrollTop: number;
  readonly scrollLeft: number;
  /**
   * The scrollbar the executor draws at `CHILDREN_END` (in the box's coordinates) — derived from
   * the offset and range by the owner of the entry (`canvasBinding.ts` `catalogScrollbar`), never
   * recorded into a command.
   */
  readonly bar?: {
    readonly width: number;
    readonly height: number;
    readonly scrollbar: ScrollbarGeometry;
  };
}

const scrollNodes = new Map<string, ScrollNode>();

export function scrollNodeOf(elementId: string): ScrollNode | undefined {
  return scrollNodes.get(elementId);
}

export function setScrollNode(elementId: string, node: ScrollNode): void {
  scrollNodes.set(elementId, node);
}

export function deleteScrollNode(elementId: string): void {
  scrollNodes.delete(elementId);
}

/** The offset a scroll owner moves its children by (zero when it has no entry). */
export function scrollOffsetOf(elementId: string): {
  scrollTop: number;
  scrollLeft: number;
} {
  const node = scrollNodes.get(elementId);
  return node
    ? { scrollTop: node.scrollTop, scrollLeft: node.scrollLeft }
    : { scrollTop: 0, scrollLeft: 0 };
}

/** Tests: start from an empty table. */
export function resetPropertyNodes(): void {
  scrollNodes.clear();
}
