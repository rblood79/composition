import type { PrimitiveBinding } from "../types";

/**
 * SelectionIndicator — the selected item's mark (ADR-256 Phase 5e — reference `Tab > (children +
 * SelectionIndicator)`). DOM is RAC `SelectionIndicator`: it is there while its item is selected
 * (RAC's `SelectionIndicatorContext` — the item's `isSelected`) and slides between items (RAC's
 * `SharedElementTransition`, the TabList's).
 *
 * D1: RAC's `SelectionIndicator` as is — its presence is its item's selection.
 * D2: no props of its own.
 * D3: the bar (accent, 3px along the item's edge) is the Tab's part (`manualBoxRules` Tab — the
 *     sheet's `.react-aria-Tab .react-aria-SelectionIndicator`). No rule of its own.
 */
export const selectionIndicatorBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "selectionindicator",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
