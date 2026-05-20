import type { PrimitiveBinding } from "../types";
import {
  CHECKBOX_GROUP_LABEL_ALIGN_VALUES,
  CHECKBOX_GROUP_LABEL_POSITION_VALUES,
  CHECKBOX_GROUP_NECESSITY_INDICATOR_VALUES,
  CHECKBOX_GROUP_ORIENTATION_VALUES,
  CHECKBOX_GROUP_SIZE_VALUES,
  FORM_VALIDATION_BEHAVIOR_VALUES,
  toCheckboxGroupRacProps,
  type CheckboxGroupCanonicalProps,
  type CheckboxGroupRacProps,
} from "../outputs/toRacProps";

const checkboxGroupAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Checkbox Group",
  },
  description: {
    kind: "string",
    label: "Description",
    section: "content",
  },
  errorMessage: {
    kind: "string",
    label: "Error message",
    section: "content",
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
    options: CHECKBOX_GROUP_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  orientation: {
    kind: "enum",
    label: "Orientation",
    section: "appearance",
    default: "vertical",
    options: CHECKBOX_GROUP_ORIENTATION_VALUES.map((value) => ({
      value,
      label: value === "horizontal" ? "Horizontal" : "Vertical",
    })),
  },
  labelPosition: {
    kind: "enum",
    label: "Label position",
    section: "appearance",
    default: "top",
    options: CHECKBOX_GROUP_LABEL_POSITION_VALUES.map((value) => ({
      value,
      label: value === "top" ? "Top" : "Side",
    })),
  },
  labelAlign: {
    kind: "enum",
    label: "Label align",
    section: "appearance",
    default: "start",
    options: CHECKBOX_GROUP_LABEL_ALIGN_VALUES.map((value) => ({
      value,
      label: value === "start" ? "Start" : "End",
    })),
  },
  necessityIndicator: {
    kind: "enum",
    label: "Necessity indicator",
    section: "state",
    default: "icon",
    options: CHECKBOX_GROUP_NECESSITY_INDICATOR_VALUES.map((value) => ({
      value,
      label: value === "icon" ? "Icon" : "Label",
    })),
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
  value: {
    kind: "string-array",
    label: "Selected values",
    section: "state",
    default: [],
    inspector: false,
  },
  defaultValue: {
    kind: "string-array",
    label: "Default selected values",
    section: "state",
    inspector: false,
  },
  name: {
    kind: "string",
    label: "Name",
    section: "state",
    inspector: false,
  },
  form: {
    kind: "string",
    label: "Form",
    section: "state",
    inspector: false,
  },
  validationBehavior: {
    kind: "enum",
    label: "Validation behavior",
    section: "state",
    inspector: false,
    options: FORM_VALIDATION_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value === "native" ? "Native" : "ARIA",
    })),
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

export const checkboxGroupPrimitiveBinding: PrimitiveBinding<
  CheckboxGroupCanonicalProps,
  CheckboxGroupRacProps
> = {
  tag: "CheckboxGroup",
  family: "selection",
  runtime: {
    source: "react-aria-components",
    exportName: "CheckboxGroup",
  },
  defaultProps: {
    label: "Checkbox Group",
    size: "md",
    orientation: "vertical",
    labelPosition: "top",
    labelAlign: "start",
    necessityIndicator: "icon",
    isEmphasized: false,
    isDisabled: false,
    isInvalid: false,
    isReadOnly: false,
    isRequired: false,
    value: [],
  },
  props: {
    accepts: checkboxGroupAccepts,
  },
  toRacProps: toCheckboxGroupRacProps,
  placement: {
    kind: "node-with-children",
    children: [
      {
        type: "Checkbox",
        props: {
          children: "Option 1",
          value: "option-1",
          isSelected: false,
          size: "md",
        },
      },
      {
        type: "Checkbox",
        props: {
          children: "Option 2",
          value: "option-2",
          isSelected: false,
          size: "md",
        },
      },
    ],
  },
  skiaPrimitive: { kind: "checkbox-group" },
};

export const checkboxGroupInspectorThemeValues = {
  sizes: {
    CheckboxGroup: CHECKBOX_GROUP_SIZE_VALUES,
  },
};
