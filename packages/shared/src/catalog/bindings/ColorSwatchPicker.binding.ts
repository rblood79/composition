/**
 * ADR-912 — ColorSwatchPicker container catalog cutover.
 *
 * The origin template's child nodes own the visible swatches. DOM = `CATALOG_DELEGATED_DOM.colorswatchpicker`:
 * the shared ColorSwatchPicker draws its ColorSwatchPickerItem children (each a RAC
 * ColorSwatchPickerItem — `colorswatchpickeritem` — with its ColorSwatch inside, ADR-256 Phase 5b).
 * Skia uses the componentRulesTable generic shell and the independent child nodes.
 */

import type { PrimitiveBinding } from "../types";

export const colorSwatchPickerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "colorswatchpicker",
  },
  props: {
    accepts: {
      // S2 체크리스트 §9.1 (2026-11-24): S2 ColorSwatchPicker `density` — the gap between its swatches
      //   (compact 2 · regular 4 · spacious 6 — the rule's `containerVariants.density`), and `rounding`
      //   — its swatches' corner (S2 `InternalColorSwatchContext`, default none; a swatch's own wins —
      //   `CATALOG_OWNER_CONTEXT_PROPS`).
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        default: "regular",
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
          { value: "spacious", label: "Spacious" },
        ],
      },
      rounding: {
        kind: "enum",
        label: "Rounding",
        section: "appearance",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "default", label: "Default" },
          { value: "full", label: "Full" },
        ],
      },
      defaultValue: {
        kind: "string",
        label: "Value",
        section: "value",
      },
      layout: {
        kind: "enum",
        label: "Layout",
        section: "appearance",
        default: "grid",
        options: [
          { value: "grid", label: "Grid" },
          { value: "stack", label: "Stack" },
        ],
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
