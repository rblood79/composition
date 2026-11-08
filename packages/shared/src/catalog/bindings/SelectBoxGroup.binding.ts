import type { PrimitiveBinding } from "../types";

export const selectBoxGroupBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "selectboxgroup" },
  props: {
    accepts: {
      slot: {
        kind: "string",
        label: "Slot",
        section: "content",
        editorHidden: true,
      },
      selectedKeys: {
        kind: "selection-keys",
        label: "Selected Keys",
        section: "state",
      },
      defaultSelectedKeys: {
        kind: "selection-keys",
        label: "Default Selected Keys",
        section: "state",
      },
      disabledKeys: {
        kind: "string-array",
        label: "Disabled Keys",
        section: "state",
      },
      autoFocus: { kind: "auto-focus", label: "Auto Focus", section: "state" },
      escapeKeyBehavior: {
        kind: "enum",
        label: "Escape Key Behavior",
        section: "state",
        default: "clearSelection",
        options: [
          { value: "clearSelection", label: "Clear Selection" },
          { value: "none", label: "None" },
        ],
      },
      "aria-labelledby": {
        kind: "string",
        label: "Labelled By",
        section: "content",
      },
      "aria-describedby": {
        kind: "string",
        label: "Described By",
        section: "content",
      },
      "aria-details": { kind: "string", label: "Details", section: "content" },
      "aria-label": {
        kind: "string",
        label: "Accessible Label",
        section: "content",
        editorHidden: true,
      },
      orientation: {
        kind: "enum",
        label: "Orientation",
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
