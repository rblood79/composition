import type { AutocompleteProps, ComboBoxProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC ComboBox.md · Autocomplete.md "Input value": `inputValue` / `onInputChange`. */
const NAMES = [
  "inputValue",
  "defaultInputValue",
  "onInputChange",
] as const satisfies readonly (keyof ComboBoxProps<object>)[];
const AUTOCOMPLETE = NAMES satisfies readonly (keyof AutocompleteProps)[];
void AUTOCOMPLETE;

export const inputValue = {
  id: "inputValue",
  racDoc: "ComboBox.md — Input value",
  racType: "ComboBoxProps · AutocompleteProps",
  events: ["onInputChange"],
  args: { onInputChange: ["value"] },
  state: {
    prop: "inputValue",
    defaultProp: "defaultInputValue",
    callback: "onInputChange",
    valueType: "string",
  },
  conditions: ["isDisabled", "isReadOnly"],
  capabilities: {
    setInput: {
      labelKey: "capabilities.setInput",
      value: "!param",
      param: { kind: "text", labelKey: "capabilities.paramValue" },
    },
  },
} as const satisfies InteractionConcept;
