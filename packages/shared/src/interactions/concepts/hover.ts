import type { ButtonProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC `useHover` — RAC only (S2 removed the hover events): derived, hidden (ADR B). */
const HIDDEN = [
  "onHoverStart",
  "onHoverEnd",
  "onHoverChange",
] as const satisfies readonly (keyof ButtonProps)[];

export const hover = {
  id: "hover",
  racDoc: "Button.md — Events (useHover)",
  racType: "ButtonProps",
  events: [],
  hiddenEvents: HIDDEN,
  conditions: ["isDisabled"],
} as const satisfies InteractionConcept;
