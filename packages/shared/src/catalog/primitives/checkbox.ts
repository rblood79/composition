import type { PrimitiveBinding } from "../types";
import {
  CHECKBOX_SIZE_VALUES,
  toCheckboxRacProps,
  type CheckboxCanonicalProps,
  type CheckboxRacProps,
} from "../outputs/toRacProps";

const checkboxAccepts = {
  children: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Checkbox",
  },
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    inspector: false,
  },
  isEmphasized: {
    kind: "boolean",
    label: "Emphasized",
    section: "appearance",
    default: false,
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: CHECKBOX_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  isSelected: {
    kind: "boolean",
    label: "Selected",
    section: "state",
    default: false,
  },
  defaultSelected: {
    kind: "boolean",
    label: "Default Selected",
    section: "state",
    inspector: false,
  },
  isIndeterminate: {
    kind: "boolean",
    label: "Indeterminate",
    section: "state",
    default: false,
  },
  isRequired: {
    kind: "boolean",
    label: "Required",
    section: "state",
    default: false,
  },
  isInvalid: {
    kind: "boolean",
    label: "Invalid",
    section: "state",
    default: false,
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
  isLoading: {
    kind: "boolean",
    label: "Loading",
    section: "state",
    default: false,
  },
  name: {
    kind: "string",
    label: "Name",
    section: "state",
    inspector: false,
  },
  value: {
    kind: "string",
    label: "Value",
    section: "state",
    inspector: false,
  },
  form: {
    kind: "string",
    label: "Form",
    section: "state",
    inspector: false,
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

export const checkboxPrimitiveBinding: PrimitiveBinding<
  CheckboxCanonicalProps,
  CheckboxRacProps
> = {
  tag: "Checkbox",
  family: "selection",
  runtime: {
    source: "react-aria-components",
    exportName: "Checkbox",
  },
  defaultProps: {
    children: "Checkbox",
    size: "md",
    isEmphasized: false,
    isSelected: false,
    isIndeterminate: false,
    isDisabled: false,
    isInvalid: false,
    isReadOnly: false,
    isRequired: false,
  },
  props: {
    accepts: checkboxAccepts,
  },
  toRacProps: toCheckboxRacProps,
  skiaPrimitive: { kind: "checkbox" },
};

export const checkboxInspectorThemeValues = {
  sizes: {
    Checkbox: CHECKBOX_SIZE_VALUES,
  },
};
