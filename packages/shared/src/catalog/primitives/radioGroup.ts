import type { PrimitiveBinding } from "../types";
import {
  FORM_VALIDATION_BEHAVIOR_VALUES,
  RADIO_GROUP_LABEL_ALIGN_VALUES,
  RADIO_GROUP_LABEL_POSITION_VALUES,
  RADIO_GROUP_NECESSITY_INDICATOR_VALUES,
  RADIO_GROUP_ORIENTATION_VALUES,
  RADIO_GROUP_SIZE_VALUES,
  RADIO_GROUP_VARIANT_VALUES,
  toRadioGroupRacProps,
  type RadioGroupCanonicalProps,
  type RadioGroupRacProps,
} from "../outputs/toRacProps";

const radioGroupAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Radio Group",
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
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "default",
    options: RADIO_GROUP_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
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
    options: RADIO_GROUP_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  orientation: {
    kind: "enum",
    label: "Orientation",
    section: "appearance",
    default: "vertical",
    options: RADIO_GROUP_ORIENTATION_VALUES.map((value) => ({
      value,
      label: value === "horizontal" ? "Horizontal" : "Vertical",
    })),
  },
  labelPosition: {
    kind: "enum",
    label: "Label position",
    section: "appearance",
    default: "top",
    options: RADIO_GROUP_LABEL_POSITION_VALUES.map((value) => ({
      value,
      label: value === "top" ? "Top" : "Side",
    })),
  },
  labelAlign: {
    kind: "enum",
    label: "Label align",
    section: "appearance",
    default: "start",
    options: RADIO_GROUP_LABEL_ALIGN_VALUES.map((value) => ({
      value,
      label: value === "start" ? "Start" : "End",
    })),
  },
  necessityIndicator: {
    kind: "enum",
    label: "Necessity indicator",
    section: "state",
    default: "icon",
    options: RADIO_GROUP_NECESSITY_INDICATOR_VALUES.map((value) => ({
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
    kind: "string",
    label: "Selected value",
    section: "state",
    default: "option-1",
    inspector: false,
  },
  defaultValue: {
    kind: "string",
    label: "Default selected value",
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

export const radioGroupPrimitiveBinding: PrimitiveBinding<
  RadioGroupCanonicalProps,
  RadioGroupRacProps
> = {
  tag: "RadioGroup",
  family: "selection",
  runtime: {
    source: "react-aria-components",
    exportName: "RadioGroup",
  },
  defaultProps: {
    label: "Radio Group",
    value: "option-1",
    variant: "default",
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
  },
  props: {
    accepts: radioGroupAccepts,
  },
  toRacProps: toRadioGroupRacProps,
  placement: {
    kind: "node-with-children",
    children: [
      {
        type: "Radio",
        props: {
          children: "Option 1",
          value: "option-1",
          isSelected: true,
          size: "md",
        },
      },
      {
        type: "Radio",
        props: {
          children: "Option 2",
          value: "option-2",
          isSelected: false,
          size: "md",
        },
      },
    ],
  },
  skiaPrimitive: { kind: "radio-group" },
};

export const radioGroupInspectorThemeValues = {
  variants: {
    RadioGroup: RADIO_GROUP_VARIANT_VALUES,
  },
  sizes: {
    RadioGroup: RADIO_GROUP_SIZE_VALUES,
  },
};
