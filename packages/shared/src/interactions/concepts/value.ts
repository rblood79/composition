import type {
  CalendarProps,
  CheckboxGroupProps,
  ColorFieldProps,
  DateFieldProps,
  DateRangePickerProps,
  NumberFieldProps,
  TextFieldProps,
} from "react-aria-components";
import type { InteractionConcept } from "./types";

/**
 * RAC `useControlledState` value (TextField.md · NumberField.md · ColorField.md · DateField.md ·
 * Calendar.md · CheckboxGroup.md "Value"): `value` / `defaultValue` / `onChange`. One concept per
 * value type — the controlled helper's empty value and the capability's param differ.
 */
const TEXT = [
  "value",
  "defaultValue",
  "onChange",
  "isDisabled",
  "isReadOnly",
] as const satisfies readonly (keyof TextFieldProps)[];
const NUMBER = TEXT satisfies readonly (keyof NumberFieldProps)[];
const COLOR = TEXT satisfies readonly (keyof ColorFieldProps)[];
const DATE = TEXT satisfies readonly (keyof DateFieldProps<never>)[];
const CALENDAR = [
  "value",
  "defaultValue",
  "onChange",
  "isDisabled",
  "isReadOnly",
] as const satisfies readonly (keyof CalendarProps<never>)[];
const RANGE = TEXT satisfies readonly (keyof DateRangePickerProps<never>)[];
const STRINGS = TEXT satisfies readonly (keyof CheckboxGroupProps)[];
void [NUMBER, COLOR, DATE, CALENDAR, RANGE, STRINGS];

const valueConcept = <
  T extends "string" | "number" | "color" | "date" | "dateRange" | "strings",
>(
  id: string,
  racDoc: string,
  racType: string,
  valueType: T,
  clear: unknown,
) =>
  ({
    id,
    racDoc,
    racType,
    events: ["onChange"],
    args: { onChange: ["value"] },
    state: {
      prop: "value",
      defaultProp: "defaultValue",
      callback: "onChange",
      valueType,
    },
    conditions: ["isDisabled", "isReadOnly"],
    capabilities: {
      setValue: {
        labelKey: "capabilities.setValue",
        value: "!param",
        param: {
          kind: valueType === "number" ? "number" : "text",
          labelKey: "capabilities.paramValue",
        },
      },
      clear: { labelKey: "capabilities.clear", value: clear },
    },
  }) as const satisfies InteractionConcept;

export const valueText = valueConcept(
  "value",
  "TextField.md — Value",
  "TextFieldProps",
  "string",
  "",
);
export const valueNumber = valueConcept(
  "value",
  "NumberField.md — Value",
  "NumberFieldProps",
  "number",
  null,
);
export const valueColor = valueConcept(
  "value",
  "ColorField.md — Value",
  "ColorFieldProps",
  "color",
  null,
);
export const valueDate = valueConcept(
  "value",
  "DateField.md — Value",
  "DateFieldProps",
  "date",
  null,
);
export const valueDateRange = valueConcept(
  "value",
  "DateRangePicker.md — Value",
  "DateRangePickerProps",
  "dateRange",
  null,
);
export const valueStrings = valueConcept(
  "value",
  "CheckboxGroup.md — Value",
  "CheckboxGroupProps",
  "strings",
  [],
);
