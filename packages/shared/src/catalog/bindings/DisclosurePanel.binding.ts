import type { PrimitiveBinding } from "../types";

/**
 * DisclosurePanel — a Disclosure's panel (ADR-256 Phase 8c — the reference
 * `Disclosure > Heading > Button[slot=trigger] + DisclosurePanel`). DOM is RAC `DisclosurePanel`
 * around the starter's content `div` (`<AriaDisclosurePanel><div>{children}</div>`): RAC shows it
 * while its Disclosure is expanded and names it by the trigger. The node's box is the content
 * div's — the Disclosure sheet's `.react-aria-DisclosurePanel > div` padding.
 *
 * D1: RAC's `DisclosurePanel` as is (its presence is its Disclosure's expansion).
 * D2: no props of its own.
 * D3: the Disclosure rule (`.react-aria-DisclosurePanel > div` — padding, color); its content takes
 *     the Disclosure's size font (part rules).
 */
export const disclosurePanelBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "disclosurepanel" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
