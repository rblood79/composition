import type { ButtonProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/**
 * RAC `usePress` (Button.md · Link.md "Events"): `onPress` is the When; the side events are RAC
 * only (S2 removed them) and stay hidden until ADR B decides the panel.
 */
const EVENTS = ["onPress"] as const satisfies readonly (keyof ButtonProps)[];
const HIDDEN = [
  "onPressStart",
  "onPressEnd",
  "onPressUp",
  "onPressChange",
] as const satisfies readonly (keyof ButtonProps)[];

export const press = {
  id: "press",
  racDoc: "Button.md — Events (usePress)",
  racType: "ButtonProps",
  events: EVENTS,
  hiddenEvents: HIDDEN,
  conditions: ["isDisabled", "isPending"],
} as const satisfies InteractionConcept;
