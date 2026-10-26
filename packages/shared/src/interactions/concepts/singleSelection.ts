import type {
  ColorSwatchPickerProps,
  ComboBoxProps,
  RadioGroupProps,
  SelectProps,
  TabsProps,
} from "react-aria-components";
import type { InteractionConcept } from "./types";

/**
 * RAC single selection — three surfaces of one concept (RadioGroup.md "Value" · Tabs.md
 * "Selection" · Select.md / ComboBox.md "Selection"): a RadioGroup's `value`, a Tabs'
 * `selectedKey`, a picker's `selectedKey`. The capability names are the registry's own.
 */
const RADIO = [
  "value",
  "defaultValue",
  "onChange",
  "isDisabled",
  "isReadOnly",
] as const satisfies readonly (keyof RadioGroupProps)[];
const TABS = [
  "selectedKey",
  "defaultSelectedKey",
  "onSelectionChange",
  "isDisabled",
  "disabledKeys",
] as const satisfies readonly (keyof TabsProps)[];
const PICKER = [
  "selectedKey",
  "defaultSelectedKey",
  "onSelectionChange",
  "isDisabled",
  "disabledKeys",
] as const satisfies readonly (keyof SelectProps<object>)[];
const COMBO = PICKER satisfies readonly (keyof ComboBoxProps<object>)[];
/**
 * RAC 1.22 Select (S2 Picker — the D2 authority) takes its selection as `value` · `onChange`;
 * `selectedKey` · `onSelectionChange` are `@deprecated` and single-only — with `selectionMode:
 * "multiple"` RAC ignores `selectedKey` and never calls `onSelectionChange` (installed
 * `useSelectState.mjs` `setValue`). S2 ComboBox keeps `selectedKey` (it omits RAC's `value`).
 */
const SELECT = [
  "value",
  "defaultValue",
  "onChange",
  "onSelectionChange",
  "selectionMode",
  "isDisabled",
  "disabledKeys",
] as const satisfies readonly (keyof SelectProps<object>)[];
const SWATCH = [
  "value",
  "defaultValue",
  "onChange",
] as const satisfies readonly (keyof ColorSwatchPickerProps)[];
void [RADIO, TABS, COMBO, SWATCH, SELECT];

export const singleSelectionValue = {
  id: "singleSelection",
  racDoc: "RadioGroup.md — Value",
  racType: "RadioGroupProps",
  events: ["onChange"],
  args: { onChange: ["value"] },
  state: {
    prop: "value",
    defaultProp: "defaultValue",
    callback: "onChange",
    valueType: "key",
  },
  conditions: ["isDisabled", "isReadOnly"],
  capabilities: {
    setValue: {
      labelKey: "capabilities.setValue",
      value: "!param",
      param: { kind: "value", labelKey: "capabilities.paramValueToSelect" },
    },
  },
} as const satisfies InteractionConcept;

export const singleSelectionTabs = {
  id: "singleSelection",
  racDoc: "Tabs.md — Selection",
  racType: "TabsProps",
  events: ["onSelectionChange"],
  args: { onSelectionChange: ["keys"] },
  state: {
    prop: "selectedKey",
    defaultProp: "defaultSelectedKey",
    callback: "onSelectionChange",
    valueType: "key",
  },
  conditions: ["isDisabled", "disabledKeys"],
  capabilities: {
    selectTab: {
      labelKey: "capabilities.selectTab",
      value: "!param",
      param: { kind: "itemKey", labelKey: "capabilities.paramTabKey" },
    },
  },
} as const satisfies InteractionConcept;

export const singleSelectionPicker = {
  id: "singleSelection",
  racDoc: "ComboBox.md — Selection",
  racType: "ComboBoxProps",
  events: ["onSelectionChange"],
  args: { onSelectionChange: ["keys"] },
  state: {
    prop: "selectedKey",
    defaultProp: "defaultSelectedKey",
    callback: "onSelectionChange",
    valueType: "key",
  },
  conditions: ["isDisabled", "disabledKeys"],
  capabilities: {
    selectItem: {
      labelKey: "capabilities.selectItem",
      value: "!param",
      param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
    },
    clearSelection: { labelKey: "capabilities.clearSelection", value: null },
  },
} as const satisfies InteractionConcept;

/**
 * RAC Select.md — Selection: `value` (one key, or keys with `selectionMode: "multiple"`) /
 * `onChange`. The deprecated `onSelectionChange` stays derived but hidden (single only — a rule
 * that already uses it keeps it). A key set operation replaces in single mode (RAC's default).
 */
export const selectValue = {
  id: "singleSelection",
  racDoc: "Select.md — Selection (value · onChange)",
  racType: "SelectProps",
  events: ["onChange"],
  hiddenEvents: ["onSelectionChange"],
  args: { onChange: ["value"], onSelectionChange: ["keys"] },
  state: {
    prop: "value",
    defaultProp: "defaultValue",
    callback: "onChange",
    valueType: "key",
  },
  selectionDefault: "single",
  conditions: ["isDisabled", "disabledKeys"],
  capabilities: {
    selectItem: {
      labelKey: "capabilities.selectItem",
      value: "!param",
      param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
      op: "add",
    },
    deselectItem: {
      labelKey: "capabilities.deselectItem",
      value: "!param",
      param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
      op: "remove",
    },
    clearSelection: { labelKey: "capabilities.clearSelection", value: [] },
  },
} as const satisfies InteractionConcept;

/** RAC ColorSwatchPicker.md — the selected swatch is the value (`value` / `onChange`). */
export const selectionAsValue = {
  id: "selectionAsValue",
  racDoc: "ColorSwatchPicker.md — Value",
  racType: "ColorSwatchPickerProps",
  events: ["onChange"],
  args: { onChange: ["value"] },
  state: {
    prop: "value",
    defaultProp: "defaultValue",
    callback: "onChange",
    valueType: "color",
  },
  conditions: [],
  capabilities: {
    setValue: {
      labelKey: "capabilities.setValue",
      value: "!param",
      param: { kind: "text", labelKey: "capabilities.paramValue" },
    },
  },
} as const satisfies InteractionConcept;
