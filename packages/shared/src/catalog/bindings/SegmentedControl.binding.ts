import { ITEM_KEY_PROP_CONTRACT } from "../document/itemLinks";
import type { PrimitiveBinding, PropContract } from "../types";

const ariaLabelingProps = {
  "aria-label": {
    kind: "string",
    label: "Accessible label",
    section: "content",
    editorHidden: true,
  },
  // (2026-11-11 사용자 결정 「숨김」: developer HTML · ARIA attributes — accepted, not offered in the panel.)
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
} satisfies Record<string, PropContract>;

/** S2 single selection contract. The first enabled item is selected by default. */
export const segmentedControlBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "segmentedcontrol" },
  props: {
    accepts: {
      ...ariaLabelingProps,
      slot: {
        kind: "string",
        label: "Slot",
        section: "content",
        editorHidden: true,
      },
      // (Selection sits in Content like Tabs — one prop, one section across components, 사용자 결정
      //   2026-10-13; `propSectionConsistency.test.ts`.)
      selectedKey: {
        editorHidden: true,
        kind: "string",
        label: "Selected item",
        section: "value",
      },
      // ADR-308 Phase 2: its items as a dropdown (사용자 결정 3).
      defaultSelectedKey: {
        kind: "enum",
        label: "Selected item",
        section: "value",
      },
      // S2 fixes horizontal; Composition exposes RAC's keyboard/layout axis explicitly.
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isJustified: {
        kind: "boolean",
        label: "Justified",
        section: "appearance",
      },
    },
    toRacProps: "default",
  },
};

export const segmentedControlItemBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "segmentedcontrolitem" },
  props: {
    accepts: {
      ...ariaLabelingProps,
      slot: {
        kind: "string",
        label: "Slot",
        section: "content",
        editorHidden: true,
      },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      // ADR-308 사용자 결정 2: its RAC key — the name its group's selection uses.
      id: ITEM_KEY_PROP_CONTRACT,
      label: {
        kind: "string",
        label: "Label",
        section: "content",
        default: "View",
      },
      icon: { kind: "icon", label: "Icon", section: "content" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
