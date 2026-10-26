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
  // (RAC event audit 2026-10-26 — the controlled `focusedValue` had no write: go to a date's month.)
  capabilities: {
    focusDate: {
      labelKey: "capabilities.focusDate",
      value: "!param",
      param: { kind: "text", labelKey: "capabilities.paramDate" },
    },
  },
} as const satisfies InteractionConcept;
