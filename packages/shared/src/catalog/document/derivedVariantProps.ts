/**
 * Container variant props no binding accepts (2026-10-28): the resolver derives them from a node's
 * place (`catalogDerivedProps`), so a definition's conditional rule keyed on one turns on through
 * the derived props (`catalogDerivedConditionalVisual` · `catalogDerivedRestVisual`), never an
 * authored value. The definition validator accepts these condition keys without `accepts`.
 *
 * - `fieldButton`: a field's own Button — its size (S2 Button is a pill; a field button keeps its
 *   size's corner — `presence.ts` `catalogFieldButtonSize`).
 */
export const CATALOG_DERIVED_VARIANT_PROPS: ReadonlySet<string> = new Set([
  "fieldButton",
]);
