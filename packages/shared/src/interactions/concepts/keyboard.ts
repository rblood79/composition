import type { ButtonProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC `useKeyboard` — derived, never offered (user decision Q3, 2026-10-22). */
const HIDDEN = [
  "onKeyDown",
  "onKeyUp",
] as const satisfies readonly (keyof ButtonProps)[];

export const keyboard = {
  id: "keyboard",
  racDoc: "Button.md — Events (useKeyboard)",
  racType: "ButtonProps",
  events: [],
  hiddenEvents: HIDDEN,
  conditions: ["isDisabled"],
} as const satisfies InteractionConcept;
