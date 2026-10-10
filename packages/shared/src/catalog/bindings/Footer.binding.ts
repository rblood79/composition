import type { PrimitiveBinding } from "../types";

/**
 * Footer — S2 `Footer` (`@react-spectrum/s2/src/Content.tsx`): the action row at the end of a Card
 * (`Card > CardPreview + Content + Footer` — a Button, a StatusLight …). RAC has no such part; the
 * S2 element is a plain `div`.
 *
 * **ADR-256 Phase 10 (2026-10-11, 사용자 결정 — 범용 Content · Footer)**: the Card's CardFooter
 *   became this shared type. As S2's `FooterContext`, the owner arranges it — the Card rule's
 *   `staticSelectors` give its row alignment and gap (`COMPONENT_RULES_TABLE.Card`); its own rule
 *   is a neutral row. (The top padding stays the Card template's inline value: the generated sheet
 *   of every size block writes `padding: 0` at the owner selector's specificity.)
 *
 * **DOM = `CATALOG_DELEGATED_DOM.footer` (delegatedDom.tsx)**: `div.react-aria-Footer` around its
 *   child nodes in order.
 *
 * D1: S2 `<div>` (internal source). D2: none (S2). D3: the
 *   owner's rule and its own rule (`COMPONENT_RULES_TABLE.Footer`).
 */
export const footerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // (Not "footer" — a DialogFooter's generic `footer` element renderer takes that id.)
    renderer: "s2footer",
  },
  props: {
    // (S2 gives it no props — the owner's context styles it.)
    accepts: {},
    toRacProps: "default",
  },
};
