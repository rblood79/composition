import type { PrimitiveBinding, PropContract } from "../types";

const ariaLabelingProps = {
  "aria-label": {
    kind: "string",
    label: "Accessible Label",
    section: "content",
    editorHidden: true,
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
      selectedKey: { kind: "string", label: "Selected Key", section: "content" },
      defaultSelectedKey: {
        kind: "string",
        label: "Default Selected Key",
        section: "content",
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
      // (RAC's item key — kept apart from the HTML id; not a second "ID" field next to the
      //  Accessibility section's, as no other item exposes its key.)
      id: { kind: "string", label: "ID", section: "content", editorHidden: true },
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
