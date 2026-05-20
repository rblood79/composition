import type { PrimitiveBinding } from "../types";
import {
  BUTTON_SIZE_VALUES,
  TEXT_FIELD_LABEL_POSITION_VALUES,
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES,
  TEXT_FIELD_TYPE_VALUES,
  toTextFieldRacProps,
  type TextFieldCanonicalProps,
  type TextFieldRacProps,
} from "../outputs/toRacProps";

const textFieldAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Text Field",
  },
  value: {
    kind: "string",
    label: "Value",
    section: "content",
    default: "",
  },
  placeholder: {
    kind: "string",
    label: "Placeholder",
    section: "content",
    default: "Enter text...",
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
  isQuiet: {
    kind: "boolean",
    label: "Quiet",
    section: "appearance",
    default: false,
  },
  type: {
    kind: "enum",
    label: "Input Type",
    section: "inputType",
    default: "text",
    options: TEXT_FIELD_TYPE_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
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
  isLoading: {
    kind: "boolean",
    label: "Loading",
    section: "state",
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

export const textFieldPrimitiveBinding: PrimitiveBinding<
  TextFieldCanonicalProps,
  TextFieldRacProps
> = {
  tag: "TextField",
  family: "fields",
  runtime: {
    source: "react-aria-components",
    exportName: "TextField",
  },
  defaultProps: {
    label: "Text Field",
    value: "",
    placeholder: "Enter text...",
    type: "text",
    size: "md",
    labelPosition: "top",
    isRequired: false,
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  },
  props: {
    accepts: textFieldAccepts,
  },
  toRacProps: toTextFieldRacProps,
  skiaPrimitive: { kind: "text-field" },
};

export const textFieldInspectorThemeValues = {
  sizes: {
    TextField: BUTTON_SIZE_VALUES,
  },
};
