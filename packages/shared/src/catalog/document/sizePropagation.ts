/**
 * Owner type → the child types its `size` sets (ADR-248 4e-11, 사용자 결정 2026-09-30 — RSP
 * propagates): a RAC group's size reaches its items through context, an item's its label. The
 * child is a structural child (collapsed composite instances skipped). Read by the catalog
 * resolver, so the Canvas rule box and the DOM `data-size` take one resolved value.
 *
 * The old Builder's `propagationRegistry` (`override: true` rules) copied the same sizes on write.
 */
export const CATALOG_SIZE_PROPAGATION: Readonly<
  Record<string, readonly string[]>
> = {
  ToggleButtonGroup: ["ToggleButton"],
  // ADR-251: group → items wrapper (internal `size`, never edited) → item.
  RadioGroup: ["RadioItems"],
  RadioItems: ["Radio"],
  CheckboxGroup: ["CheckboxItems"],
  CheckboxItems: ["Checkbox"],
  Radio: ["Label"],
  Checkbox: ["Label"],
  Slider: ["SliderTrack"],
  // TagGroup → TagList (the chip wrapper) → Tag: the chips take the group size.
  TagGroup: ["TagList"],
  TagList: ["Tag"],
};
