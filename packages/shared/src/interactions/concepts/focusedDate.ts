import type { CalendarProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC Calendar.md "Focused value": `focusedValue` / `onFocusChange(date)`. */
const NAMES = [
  "focusedValue",
  "defaultFocusedValue",
  "onFocusChange",
] as const satisfies readonly (keyof CalendarProps<never>)[];
void NAMES;

export const focusedDate = {
  id: "focusedDate",
  racDoc: "Calendar.md — Focused value",
  racType: "CalendarProps",
  events: ["onFocusChange"],
  args: { onFocusChange: ["date"] },
  state: {
    prop: "focusedValue",
    defaultProp: "defaultFocusedValue",
    callback: "onFocusChange",
    valueType: "date",
  },
  conditions: [],
} as const satisfies InteractionConcept;
