import type { PrimitiveBinding } from "../types";

/**
 * DisclosureHeader — the row around a Disclosure's title Heading (S2 `DisclosureHeader`, a `div`
 * `display: flex · alignItems: center · gap: 4` — `Disclosure.tsx` `DisclosureHeaderWithForwardRef`):
 * the Heading grows to fill it and the author may set ActionButtons beside it. The Disclosure origin
 * has it (`Disclosure > DisclosureHeader > Heading > Button[slot=trigger] + DisclosurePanel`).
 *
 * D1: no role (S2's is a plain `div` — RAC's Disclosure contexts reach the Heading through it).
 * D2: no props of its own.
 * D3: the DisclosureHeader rule (the row); the Disclosure's sheet reaches the Heading and trigger
 *     through it (part rules pass it like a layout frame).
 */
export const disclosureHeaderBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "disclosureheader" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
