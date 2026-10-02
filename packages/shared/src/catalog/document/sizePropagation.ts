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
  RadioGroup: ["Radio"],
  CheckboxGroup: ["Checkbox"],
  Radio: ["Label"],
  Checkbox: ["Label"],
  Slider: ["SliderTrack"],
};
