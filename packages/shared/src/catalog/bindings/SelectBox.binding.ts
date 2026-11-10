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
      // (RAC's item key — not a second "ID" next to the Accessibility section's HTML id.)
      id: {
        kind: "string",
        label: "Item ID",
        section: "content",
        editorHidden: true,
      },
      textValue: { kind: "string", label: "Text value", section: "content" },
      "aria-label": {
        kind: "string",
        label: "Accessible label",
        section: "content",
        editorHidden: true,
      },
      isSelected: ITEM_SELECTED_PROP_CONTRACT,
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
