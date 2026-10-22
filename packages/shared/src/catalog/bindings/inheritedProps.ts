import type { PropContract } from "../types";
import { DATE_LOCALE_PROP } from "./dateLocaleProps";

/**
 * ADR-281 Decision 3 · 6 — the props a page root (`body`) and a frame pass down to every RAC
 * component inside (RAC `Provider` · `I18nProvider` — the nearest ancestor wins, a component's own
 * value wins over all). D2: `isDisabled` · `isReadOnly` · `isRequired` are v3 `Provider`'s cascade
 * (S2 dropped it — `d2Provenance.ts` `v3`), `locale` · `colorScheme` are S2 `Provider`'s.
 *
 * `colorScheme` is the page root's only, and a runtime value (a rule's Do — Decision 6): the
 * Builder's Canvas draws the project theme's color mode, so it is not authored (`editorHidden`).
 */
export const CATALOG_INHERITED_PROP_CONTRACTS: Readonly<
  Record<string, PropContract>
> = {
  isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
  isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
  isRequired: { kind: "boolean", label: "Required", section: "state" },
  locale: DATE_LOCALE_PROP,
};

export const CATALOG_COLOR_SCHEME_PROP: PropContract = {
  kind: "enum",
  label: "Color Scheme",
  section: "state",
  options: [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ],
  editorHidden: true,
};

/** Which props each inheritance host passes down (user decision 1 — page root + frame). */
export const CATALOG_INHERITANCE_HOSTS: Readonly<
  Record<string, readonly string[]>
> = {
  body: ["isDisabled", "isReadOnly", "isRequired", "locale", "colorScheme"],
  frame: ["isDisabled", "isReadOnly", "isRequired", "locale"],
};
