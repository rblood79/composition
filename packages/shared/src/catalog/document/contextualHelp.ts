/**
 * ADR-259 Phase 3 — S2 `ContextualHelp` (`@react-spectrum/s2` 1.8.0 `ContextualHelp.tsx`).
 */

/** The glyph of a help's trigger per `variant` (S2 HelpCircle · InfoCircle — the Lucide pair). */
export function catalogContextualHelpGlyph(variant: unknown): string {
  return variant === "info" ? "info" : "circle-question-mark";
}

/**
 * A field's label row stands in its Label's place (S2 `FieldLabel` — the row takes `gridArea:
 * label`): the field rule's Label selectors reach a FieldLabel too. The generated sheet widens
 * `.react-aria-Label` to `:is(.react-aria-Label, .react-aria-FieldLabel)` (`partAliases`), the
 * Canvas gives a FieldLabel the field's Label part rules (`compileRulePartRules`).
 */
export const CATALOG_FIELD_LABEL_PART_ALIASES: Readonly<
  Record<string, readonly string[]>
> = { Label: ["FieldLabel"] };
