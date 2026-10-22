import type { FormProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/**
 * RAC Form.md — RAC delegates to the native `<form>`: `onSubmit` · `onReset` are its events and
 * submit · reset are DOM-ref calls (`requestSubmit()` · `reset()`), not a prop (ADR-280 Decision 9).
 */
const NAMES = [
  "onSubmit",
  "onReset",
] as const satisfies readonly (keyof FormProps)[];

export const form = {
  id: "form",
  racDoc: "Form.md — RAC delegates to the native <form>",
  racType: "FormProps",
  events: NAMES,
  // ADR-281 Decision 5 — the submitted fields (`bindings.ts` reads the event's form element).
  args: { onSubmit: ["formData"] },
  conditions: [],
  capabilities: {
    submit: {
      labelKey: "capabilities.submit",
      value: null,
      imperative: true,
    },
    reset: { labelKey: "capabilities.reset", value: null, imperative: true },
  },
} as const satisfies InteractionConcept;
