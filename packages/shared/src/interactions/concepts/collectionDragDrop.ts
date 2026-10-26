import type { DragAndDropOptions } from "react-aria-components/useDragAndDrop";
import type { InteractionConcept } from "./types";

/**
 * ADR-284 Phase 5 — a collection's drag and drop (useDragAndDrop.md — the options a ListBox ·
 * GridList · Tree · Table takes through `dragAndDropHooks`). The handlers that end a drop
 * (`onReorder` · `onInsert` · `onRootDrop` · `onItemDrop`) and the drag's end (`onDragEnd`); RAC
 * offers only the drops a handler is given for. Each takes one event object — its fields are the
 * rule's arguments (`!event.target.key` · `!event.target.dropPosition`). `keys` of a drop from
 * another list are the dragged items' keys the Preview reads from their drag data (the reference's
 * `await item.getText('issue-id')`).
 */
export const COLLECTION_DRAG_DROP_EVENTS = [
  "onReorder",
  "onInsert",
  "onRootDrop",
  "onItemDrop",
  "onDragEnd",
] as const satisfies readonly (keyof DragAndDropOptions)[];

export const collectionDragDrop = {
  id: "collectionDragDrop",
  racDoc: "useDragAndDrop.md — Events (DragAndDropOptions)",
  racType: "DragAndDropOptions",
  events: COLLECTION_DRAG_DROP_EVENTS,
  argFields: true,
  args: {
    onReorder: ["keys", "target", "dropOperation"],
    onInsert: ["keys", "items", "target", "dropOperation"],
    onRootDrop: ["keys", "items", "dropOperation"],
    onItemDrop: ["keys", "items", "target", "dropOperation", "isInternal"],
    onDragEnd: ["keys", "dropOperation", "isInternal"],
  },
  conditions: [],
} as const satisfies InteractionConcept;
