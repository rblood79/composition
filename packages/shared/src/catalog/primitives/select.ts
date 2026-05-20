import type { PrimitiveBinding } from "../types";
import {
  SELECT_ALIGN_VALUES,
  SELECT_DIRECTION_VALUES,
  SELECT_LABEL_ALIGN_VALUES,
  SELECT_LABEL_POSITION_VALUES,
  SELECT_NECESSITY_INDICATOR_VALUES,
  SELECT_SIZE_VALUES,
  SELECT_VALIDATION_BEHAVIOR_VALUES,
  toSelectRacProps,
  type SelectCanonicalProps,
  type SelectRacProps,
} from "../outputs/toRacProps";

const selectAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Select",
  },
  items: {
    kind: "binding",
    label: "Items",
    section: "content",
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
  placeholder: {
    kind: "string",
    label: "Placeholder",
    section: "content",
    default: "Choose an option...",
  },
  contextualHelp: {
    kind: "string",
    label: "Contextual help",
    section: "content",
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: SELECT_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  iconName: {
    kind: "icon",
    label: "Trigger icon",
    section: "appearance",
    default: "chevron-down",
  },
  labelPosition: {
    kind: "enum",
    label: "Label position",
    section: "appearance",
    default: "top",
    options: SELECT_LABEL_POSITION_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  labelAlign: {
    kind: "enum",
    label: "Label align",
    section: "appearance",
    default: "start",
    options: SELECT_LABEL_ALIGN_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  isQuiet: {
    kind: "boolean",
    label: "Quiet",
    section: "appearance",
    default: false,
  },
  align: {
    kind: "enum",
    label: "Align",
    section: "appearance",
    default: "start",
    options: SELECT_ALIGN_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  direction: {
    kind: "enum",
    label: "Direction",
    section: "appearance",
    default: "bottom",
    options: SELECT_DIRECTION_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  shouldFlip: {
    kind: "boolean",
    label: "Should flip",
    section: "appearance",
    default: true,
  },
  selectedKey: {
    kind: "string",
    label: "Selected key",
    section: "state",
  },
  defaultSelectedKey: {
    kind: "string",
    label: "Default selected key",
    section: "state",
  },
  disallowEmptySelection: {
    kind: "boolean",
    label: "Disallow empty",
    section: "state",
    default: false,
  },
  necessityIndicator: {
    kind: "enum",
    label: "Required indicator",
    section: "state",
    options: SELECT_NECESSITY_INDICATOR_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
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
    label: "Read only",
    section: "state",
    default: false,
  },
  autoFocus: {
    kind: "boolean",
    label: "Auto focus",
    section: "state",
    default: false,
    inspector: false,
  },
  validationBehavior: {
    kind: "enum",
    label: "Validation behavior",
    section: "state",
    default: "native",
    options: SELECT_VALIDATION_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
    inspector: false,
  },
  menuWidth: {
    kind: "string",
    label: "Menu width",
    section: "appearance",
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

export const selectPrimitiveBinding: PrimitiveBinding<
  SelectCanonicalProps,
  SelectRacProps
> = {
  tag: "Select",
  family: "collections",
  runtime: {
    source: "react-aria-components",
    exportName: "Select",
  },
  defaultProps: {
    label: "Select",
    placeholder: "Choose an option...",
    selectedKey: undefined,
    size: "md",
    iconName: "chevron-down",
    labelPosition: "top",
    labelAlign: "start",
    isQuiet: false,
    align: "start",
    direction: "bottom",
    shouldFlip: true,
    disallowEmptySelection: false,
    isDisabled: false,
    isInvalid: false,
    isReadOnly: false,
    isRequired: false,
    autoFocus: false,
    validationBehavior: "native",
    items: [
      { id: "item-1", label: "Aardvark", value: "aardvark" },
      { id: "item-2", label: "Cat", value: "cat" },
      { id: "item-3", label: "Dog", value: "dog" },
      { id: "item-4", label: "Kangaroo", value: "kangaroo" },
    ],
  },
  props: {
    accepts: selectAccepts,
  },
  toRacProps: toSelectRacProps,
  skiaPrimitive: { kind: "select" },
};

export const selectInspectorThemeValues = {
  sizes: {
    Select: SELECT_SIZE_VALUES,
  },
};
