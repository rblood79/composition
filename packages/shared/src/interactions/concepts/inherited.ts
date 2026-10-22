import type {
  ButtonProps,
  I18nProviderProps,
  TextFieldProps,
} from "react-aria-components";
import type { InteractionConcept } from "./types";

/**
 * ADR-281 Decision 3 · 6 — what a page root (`body`) and a frame pass down to the RAC components
 * inside: v3 `Provider`'s `isDisabled` · `isReadOnly` · `isRequired` cascade (S2 dropped it; RAC
 * `Provider` carries it — `catalog/runtime/providerContexts.ts`), S2 `Provider`'s `locale` (RAC
 * `I18nProvider`) and `colorScheme` (the theme's color mode). Not a new vocabulary: each is the
 * same prop its receivers take, set · toggled as the toggle concept does. No event — RAC reports
 * no change of an ancestor's prop (the state has no callback; `implicitState.ts` mirrors none).
 */
const FLAGS = [
  "isDisabled",
] as const satisfies readonly (keyof ButtonProps)[];
const FIELD_FLAGS = [
  "isReadOnly",
  "isRequired",
] as const satisfies readonly (keyof TextFieldProps)[];
const LOCALE = ["locale"] as const satisfies readonly (keyof I18nProviderProps)[];
void [FLAGS, FIELD_FLAGS, LOCALE];

const flag = (
  prop: "isDisabled" | "isReadOnly" | "isRequired",
  on: string,
  off: string,
  flip: string,
) =>
  ({
    id: "inherited",
    racDoc: "Provider (v3 cascade) — RAC Provider + useContextProps",
    racType: "ButtonProps · TextFieldProps (context props)",
    events: [],
    state: { prop, callback: "", valueType: "boolean" },
    conditions: [],
    capabilities: {
      [on]: { labelKey: `capabilities.${on}`, value: true },
      [off]: { labelKey: `capabilities.${off}`, value: false },
      [flip]: { labelKey: `capabilities.${flip}`, value: "!self" },
    },
  }) as const satisfies InteractionConcept;

export const inheritedDisabled = flag(
  "isDisabled",
  "disableAll",
  "enableAll",
  "toggleDisabledAll",
);
export const inheritedReadOnly = flag(
  "isReadOnly",
  "readOnlyAll",
  "editableAll",
  "toggleReadOnlyAll",
);
export const inheritedRequired = flag(
  "isRequired",
  "requiredAll",
  "optionalAll",
  "toggleRequiredAll",
);

export const inheritedLocale = {
  id: "inherited",
  racDoc: "I18nProvider — locale",
  racType: "I18nProviderProps",
  events: [],
  state: { prop: "locale", callback: "", valueType: "string" },
  conditions: [],
  capabilities: {
    setLocale: {
      labelKey: "capabilities.setLocale",
      value: "!param",
      param: { kind: "text", labelKey: "capabilities.paramLocale" },
    },
  },
} as const satisfies InteractionConcept;

/** S2 `Provider` `colorScheme` (`'light' | 'dark'` — `Provider.d.ts:5`). */
export const colorScheme = {
  id: "inherited",
  racDoc: "S2 Provider — colorScheme",
  racType: "S2 ProviderProps",
  events: [],
  state: { prop: "colorScheme", callback: "", valueType: "string" },
  conditions: [],
  capabilities: {
    lightScheme: { labelKey: "capabilities.lightScheme", value: "light" },
    darkScheme: { labelKey: "capabilities.darkScheme", value: "dark" },
  },
} as const satisfies InteractionConcept;
