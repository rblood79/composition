import type { PrimitiveBinding } from "../types";

/**
 * TreeItemContent — a TreeItem's row content (ADR-256 Phase 5h — reference `TreeItem >
 * TreeItemContent > Button[slot=chevron] + text`, nested TreeItems after it). DOM is RAC
 * `TreeItemContent`: no element of its own — its children are the row's (`div.react-aria-TreeItem`
 * > `div[role=gridcell]` `display: contents`), and RAC gives them the row's contexts (the chevron
 * `Button`, the selection `Checkbox`).
 *
 * D1: RAC's `TreeItemContent` as is.
 * D2: no props of its own.
 * D3: none — the row is the TreeItem's (`Tree.css`); the Canvas lays the content out as the row's
 *     flex line (`manualBoxRules` TreeItemContent).
 */
export const treeItemContentBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "treeitemcontent",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
