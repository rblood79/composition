import type { PrimitiveBinding } from "../types";

export const dialogTriggerBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "dialogtrigger" },
  props: {
    accepts: {
      isOpen: { kind: "boolean", label: "Open", section: "value" },
      defaultOpen: {
        editorHidden: true,
        kind: "boolean",
        label: "Initially open",
        section: "value",
      },
    },
    toRacProps: "default",
  },
};
