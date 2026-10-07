import type { PrimitiveBinding } from "../types";

/**
 * ColorSwatchPickerItem — a ColorSwatchPicker's item (ADR-256 Phase 5b — reference
 * `ColorSwatchPicker > ColorSwatchPickerItem > ColorSwatch`). DOM is RAC `ColorSwatchPickerItem`:
 * the item's `color` is the picker's value for it, and the ColorSwatch inside shows that color
 * through RAC's context (it needs no color of its own).
 *
 * D1: RAC's `ColorSwatchPickerItem` as is — selection · focus are the picker's.
 * D2: `color` (RAC's item prop) and `isDisabled`.
 * D3: the item box (flex, fit-content) is the picker's part (`manualBoxRules` ColorSwatchPicker,
 *     the sheet's `.react-aria-ColorSwatchPicker > .react-aria-ColorSwatchPickerItem`); the selected
 *     ring is the sheet's `[data-selected]::after` (Preview). No rule of its own.
 */
export const colorSwatchPickerItemBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "colorswatchpickeritem",
  },
  props: {
    accepts: {
      color: { kind: "string", label: "Color", section: "content" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
