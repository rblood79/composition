import type { PrimitiveBinding } from "../types";

/**
 * Content — S2 `Content` (`@react-spectrum/s2/src/Content.tsx`): the body section of a Card
 * (`Card > CardPreview + Content + Footer` — its `Text slot="title"` · `Text slot="description"`
 * and any free content) and of an InlineAlert (`InlineAlert > Heading + Content`). RAC has no such
 * part; the S2 element is a plain `div`.
 *
 * **ADR-256 Phase 10 (2026-10-11, 사용자 결정 — 범용 Content · Footer)**: the Card's CardContent
 *   became this shared type. As S2's `ContentContext`, the owner arranges it — the Card rule's
 *   `staticSelectors` / `sizeSelectors` give its gap and its title · description text
 *   (`COMPONENT_RULES_TABLE.Card`); its own rule is a neutral vertical stack.
 *
 * **DOM = `CATALOG_DELEGATED_DOM.content` (delegatedDom.tsx)**: `div.react-aria-Content` around its
 *   child nodes in order.
 *
 * D1: S2 `<div>` (internal source). D2: none (S2). D3: the
 *   owner's rule and its own rule (`COMPONENT_RULES_TABLE.Content`).
 */
export const contentBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // (Not "content"/"footer" alone — a DialogFooter's generic `footer` element renderer takes that id.)
    renderer: "s2content",
  },
  props: {
    // (S2 gives it no props — the owner's context styles it.)
    accepts: {},
    toRacProps: "default",
  },
};
