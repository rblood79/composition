import type { PrimitiveBinding } from "../types";
import {
  BUTTON_SIZE_VALUES,
  COLOR_FIELD_CHANNEL_VALUES,
  COLOR_FIELD_COLOR_SPACE_VALUES,
  COLOR_FIELD_LABEL_ALIGN_VALUES,
  TEXT_FIELD_LABEL_POSITION_VALUES,
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES,
  toColorFieldRacProps,
  type ColorFieldCanonicalProps,
  type ColorFieldRacProps,
} from "../outputs/toRacProps";

const colorFieldAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Color",
  },
  value: {
    kind: "string",
    label: "Value",
    section: "content",
    default: "#000000",
    placeholder: "#000000",
  },
  placeholder: {
    kind: "string",
    label: "Placeholder",
    section: "content",
    default: "#000000",
    placeholder: "#000000",
  },
  description: {
    kind: "string",
    label: "Description",
    section: "content",
    emptyToUndefined: true,
  },
  size: {
    kind: "size",
    label: "Size",
    section: "appearance",
    default: "md",
  },
  labelPosition: {
    kind: "enum",
    label: "Label Position",
    section: "appearance",
    default: "top",
    options: TEXT_FIELD_LABEL_POSITION_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  labelAlign: {
    kind: "enum",
    label: "Label Alignment",
    section: "appearance",
    default: "start",
    options: COLOR_FIELD_LABEL_ALIGN_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  isQuiet: {
    kind: "boolean",
    label: "Quiet",
    section: "appearance",
    default: false,
  },
  colorSpace: {
    kind: "enum",
    label: "Color Space",
    section: "color",
    default: "rgb",
    options: COLOR_FIELD_COLOR_SPACE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  channel: {
    kind: "enum",
    label: "Channel",
    section: "color",
    options: COLOR_FIELD_CHANNEL_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
    emptyToUndefined: true,
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  isReadOnly: {
    kind: "boolean",
    label: "Read Only",
    section: "state",
    default: false,
  },
  isInvalid: {
    kind: "boolean",
    label: "Invalid",
    section: "state",
    default: false,
  },
  errorMessage: {
    kind: "string",
    label: "Error Message",
    section: "state",
    visibleWhen: { key: "isInvalid", truthy: true },
    emptyToUndefined: true,
  },
  necessityIndicator: {
    kind: "enum",
    label: "Required",
    section: "state",
    options: TEXT_FIELD_NECESSITY_INDICATOR_VALUES.map((value) => ({
      value,
      label: value === "icon" ? "Icon (*)" : "Label",
    })),
  },
  isRequired: {
    kind: "boolean",
    label: "Required State",
    section: "state",
    inspector: false,
    default: false,
  },
  className: {
    kind: "string",
    label: "Class name",
    section: "appearance",
    inspector: false,
  },
  style: {
    kind: "string",
    label: "Style",
    section: "appearance",
    inspector: false,
  },
} as const;

export const colorFieldPrimitiveBinding: PrimitiveBinding<
  ColorFieldCanonicalProps,
  ColorFieldRacProps
> = {
  tag: "ColorField",
  family: "fields",
  runtime: {
    source: "react-aria-components",
    exportName: "ColorField",
  },
  defaultProps: {
    label: "Color",
    value: "#000000",
    placeholder: "#000000",
    colorSpace: "rgb",
    size: "md",
    labelPosition: "top",
    labelAlign: "start",
    isRequired: false,
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  },
  props: {
    accepts: colorFieldAccepts,
  },
  toRacProps: toColorFieldRacProps,
  skiaPrimitive: { kind: "color-field" },
};

export const colorFieldInspectorThemeValues = {
  sizes: {
    ColorField: BUTTON_SIZE_VALUES,
  },
};
