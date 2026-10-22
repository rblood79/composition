import type { ButtonProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC `useFocus` — derived, hidden until ADR B decides the panel. */
const HIDDEN = [
  "onFocus",
  "onBlur",
  "onFocusChange",
] as const satisfies readonly (keyof ButtonProps)[];

export const focus = {
  id: "focus",
  racDoc: "Button.md — Events (useFocus)",
  racType: "ButtonProps",
  events: [],
  hiddenEvents: HIDDEN,
  conditions: [],
} as const satisfies InteractionConcept;
