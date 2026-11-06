import type { PrimitiveBinding } from "../types";

export const selectBoxGroupBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "selectboxgroup" },
  props: {
    accepts: {
      "aria-label": {
        kind: "string",
        label: "Accessible Label",
        section: "content",
      },
      orientation: {
        kind: "enum",
        label: "Content Orientation",
        section: "appearance",
        default: "vertical",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
      },
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "single",
        options: [
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      disallowEmptySelection: {
        kind: "boolean",
        label: "Disallow Empty Selection",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};
