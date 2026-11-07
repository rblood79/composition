import type { PrimitiveBinding, PropContract } from "../types";

const ariaLabelingProps = {
  "aria-label": {
    kind: "string",
    label: "Accessible Label",
    section: "content",
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
      selectedKey: { kind: "string", label: "Selected Key", section: "state" },
      defaultSelectedKey: {
        kind: "string",
        label: "Default Selected Key",
        section: "state",
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
      id: { kind: "string", label: "ID", section: "content" },
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
