import type { PrimitiveBinding } from "../types";
import {
  ITEM_KEY_PROP_CONTRACT,
} from "../document/itemLinks";

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
      // ADR-308 사용자 결정 2: its RAC key — the name its group's selection uses.
      id: ITEM_KEY_PROP_CONTRACT,
      textValue: { kind: "string", label: "Text value", section: "content" },
      "aria-label": {
        kind: "string",
        label: "Accessible label",
        section: "content",
        editorHidden: true,
      },
      // (ADR-308: its selection is its group's keys — no `isSelected` of its own.)
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
