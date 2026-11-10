import type { PrimitiveBinding } from "../types";

/** Label and value remain real authored Text parts, independently editable. */
export const labeledValueBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "labeledvalue" },
  props: {
    accepts: {
      label: {
        kind: "string",
        label: "Label",
        section: "content",
        default: "Label",
      },
      value: {
        kind: "labeled-value",
        label: "Value",
        section: "content",
        default: "Value",
      },
      formatOptions: {
        kind: "labeled-format",
        label: "Format options",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      labelPosition: {
        kind: "enum",
        label: "Label Position",
        section: "appearance",
        default: "top",
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
        ],
      },
      labelAlign: {
        kind: "enum",
        label: "Label align",
        section: "appearance",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ],
      },
    },
    toRacProps: "default",
  },
};
