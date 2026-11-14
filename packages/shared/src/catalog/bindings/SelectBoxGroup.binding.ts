import type { PrimitiveBinding } from "../types";

export const selectBoxGroupBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "selectboxgroup" },
  props: {
    accepts: {
      // ADR-310 Phase 1: the S2 `items` collection (rows repeat the item template).
      dataBinding: {
        kind: "binding",
        label: "Data source",
        section: "collection",
      },
      slot: {
        kind: "string",
        label: "Slot",
        section: "content",
        editorHidden: true,
      },
      selectedKeys: {
        editorHidden: true,
        kind: "selection-keys",
        label: "Selected items",
        section: "value",
      },
      // ADR-308 Phase 2: its SelectBoxes as a check list (사용자 결정 3).
      defaultSelectedKeys: {
        kind: "selection-keys",
        label: "Selected items",
        section: "value",
      },
      disabledKeys: {
        kind: "string-array",
        label: "Disabled keys",
        section: "state",
      },
      autoFocus: { kind: "auto-focus", label: "Auto Focus", section: "state" },
      // (2026-11-11 사용자 결정 「숨김」: developer HTML · ARIA attributes — accepted, not offered in the panel.)
      escapeKeyBehavior: {
        editorHidden: true,
        kind: "enum",
        label: "Escape key behavior",
        section: "state",
        default: "clearSelection",
        options: [
          { value: "clearSelection", label: "Clear selection" },
          { value: "none", label: "None" },
        ],
      },
      "aria-labelledby": {
        editorHidden: true,
        kind: "string",
        label: "Labelled by",
        section: "content",
      },
      "aria-describedby": {
        editorHidden: true,
        kind: "string",
        label: "Described by",
        section: "content",
      },
      "aria-details": {
        kind: "string",
        label: "Details",
        section: "content",
        editorHidden: true,
      },
      "aria-label": {
        kind: "string",
        label: "Accessible label",
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
