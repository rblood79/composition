import type { PrimitiveBinding } from "../types";
import {
  COMBO_BOX_LABEL_POSITION_VALUES,
  COMBO_BOX_MENU_TRIGGER_VALUES,
  COMBO_BOX_NECESSITY_INDICATOR_VALUES,
  COMBO_BOX_SIZE_VALUES,
  COMBO_BOX_VALIDATION_BEHAVIOR_VALUES,
  toComboBoxRacProps,
  type ComboBoxCanonicalProps,
  type ComboBoxRacProps,
} from "../outputs/toRacProps";

const comboBoxAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Combo Box",
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
    default: "Type or select...",
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
    options: COMBO_BOX_SIZE_VALUES.map((value) => ({
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
    options: COMBO_BOX_LABEL_POSITION_VALUES.map((value) => ({
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
  selectedKey: {
    kind: "string",
    label: "Selected key",
    section: "state",
  },
  inputValue: {
    kind: "string",
    label: "Input value",
    section: "state",
  },
  allowsCustomValue: {
    kind: "boolean",
    label: "Allows custom value",
    section: "state",
    default: true,
  },
  necessityIndicator: {
    kind: "enum",
    label: "Required indicator",
    section: "state",
    options: COMBO_BOX_NECESSITY_INDICATOR_VALUES.map((value) => ({
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
  defaultSelectedKey: {
    kind: "string",
    label: "Default selected key",
    section: "state",
    inspector: false,
  },
  defaultInputValue: {
    kind: "string",
    label: "Default input value",
    section: "state",
    inspector: false,
  },
  autoFocus: {
    kind: "boolean",
    label: "Auto focus",
    section: "state",
    default: false,
    inspector: false,
  },
  menuTrigger: {
    kind: "enum",
    label: "Menu trigger",
    section: "state",
    default: "focus",
    options: COMBO_BOX_MENU_TRIGGER_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
    inspector: false,
  },
  validationBehavior: {
    kind: "enum",
    label: "Validation behavior",
    section: "state",
    default: "native",
    options: COMBO_BOX_VALIDATION_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
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

export const comboBoxPrimitiveBinding: PrimitiveBinding<
  ComboBoxCanonicalProps,
  ComboBoxRacProps
> = {
  tag: "ComboBox",
  family: "collections",
  runtime: {
    source: "react-aria-components",
    exportName: "ComboBox",
  },
  defaultProps: {
    label: "Combo Box",
    placeholder: "Type or select...",
    inputValue: "",
    allowsCustomValue: true,
    size: "md",
    iconName: "chevron-down",
    labelPosition: "top",
    isQuiet: false,
    isDisabled: false,
    isInvalid: false,
    isReadOnly: false,
    isRequired: false,
    autoFocus: false,
    menuTrigger: "focus",
    validationBehavior: "native",
    items: [
      { id: "item-1", label: "Aardvark", value: "aardvark" },
      { id: "item-2", label: "Cat", value: "cat" },
      { id: "item-3", label: "Dog", value: "dog" },
      { id: "item-4", label: "Kangaroo", value: "kangaroo" },
    ],
  },
  props: {
    accepts: comboBoxAccepts,
  },
  toRacProps: toComboBoxRacProps,
  skiaPrimitive: { kind: "combo-box" },
};

export const comboBoxInspectorThemeValues = {
  sizes: {
    ComboBox: COMBO_BOX_SIZE_VALUES,
  },
};
