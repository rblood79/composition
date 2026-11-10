import type { PrimitiveBinding } from "../types";

export const dialogTriggerBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "dialogtrigger" },
  props: {
    accepts: {
      isOpen: { kind: "boolean", label: "Open", section: "state" },
      defaultOpen: {
        kind: "boolean",
        label: "Initially open",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};
