import type { SearchFieldProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC SearchField.md "Events": Enter submits, the clear button clears. */
const NAMES = [
  "onSubmit",
  "onClear",
] as const satisfies readonly (keyof SearchFieldProps)[];

export const search = {
  id: "search",
  racDoc: "SearchField.md — Events",
  racType: "SearchFieldProps",
  events: NAMES,
  conditions: ["isDisabled", "isReadOnly"],
} as const satisfies InteractionConcept;
