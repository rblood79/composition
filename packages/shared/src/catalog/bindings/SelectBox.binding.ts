import type { PrimitiveBinding } from "../types";
import { ITEM_SELECTED_PROP_CONTRACT } from "../document/itemLinks";

export const selectBoxBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "selectbox" },
  rac: {
    primitive: "ListBoxItem",
    parts: ["option"],
    slots: [],
    states: ["isSelected", "isDisabled", "isHovered", "isFocusVisible"],
    renderProps: [
      "isSelected",
      "isDisabled",
      "isHovered",
      "isFocused",
      "isFocusVisible",
      "selectionMode",
    ],
    dataAttributes: [
      "data-selected",
      "data-disabled",
      "data-hovered",
      "data-focus-visible",
    ],
  },
  props: {
    accepts: {
      id: { kind: "string", label: "Item ID", section: "content" },
      textValue: { kind: "string", label: "Text Value", section: "content" },
      "aria-label": {
        kind: "string",
        label: "Accessible Label",
        section: "content",
      },
      isSelected: ITEM_SELECTED_PROP_CONTRACT,
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
