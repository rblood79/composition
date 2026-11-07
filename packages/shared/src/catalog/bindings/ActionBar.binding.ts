import type { PrimitiveBinding } from "../types";
import { RAC_SLOT_PROP } from "./accessibilityProps";

/** The count is state, not a fabricated collection reference: existing bindings may supply it. */
export const actionBarBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "actionbar" },
  props: {
    accepts: {
      slot: RAC_SLOT_PROP,
      selectedItemCount: {
        kind: "selection-count",
        label: "Selected Item Count",
        section: "content",
        default: 1,
        min: 0,
      },
      isEmphasized: {
        kind: "boolean",
        label: "Emphasized",
        section: "appearance",
      },
    },
    toRacProps: "default",
  },
};
