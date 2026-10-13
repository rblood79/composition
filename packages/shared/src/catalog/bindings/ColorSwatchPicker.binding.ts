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
      defaultValue: {
        kind: "string",
        label: "Default Value",
        section: "content",
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
