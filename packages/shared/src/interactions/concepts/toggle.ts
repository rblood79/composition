import type { CheckboxProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC `useToggleState` (Checkbox.md · Switch.md · ToggleButton.md "Selection"). */
const NAMES = [
  "isSelected",
  "defaultSelected",
  "onChange",
  "isDisabled",
  "isReadOnly",
] as const satisfies readonly (keyof CheckboxProps)[];
void NAMES;

export const toggle = {
  id: "toggle",
  racDoc: "Checkbox.md — Selection (useToggleState)",
  racType: "CheckboxProps",
  events: ["onChange"],
  args: { onChange: ["value"] },
  state: {
    prop: "isSelected",
    defaultProp: "defaultSelected",
    callback: "onChange",
    valueType: "boolean",
  },
  conditions: ["isDisabled", "isReadOnly"],
  capabilities: {
    check: { labelKey: "capabilities.check", value: true },
    uncheck: { labelKey: "capabilities.uncheck", value: false },
    toggleCheck: { labelKey: "capabilities.toggleCheck", value: "!self" },
  },
} as const satisfies InteractionConcept;
