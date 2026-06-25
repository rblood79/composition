/**
 * ADR-912 — ColorSwatchPicker container catalog cutover.
 *
 * Factory children(ColorSwatch[]) own the visible swatches. DOM rendering delegates to the
 * existing rendererMap path so ColorSwatch children are wrapped as RAC ColorSwatchPickerItem.
 * Skia uses the componentRulesTable generic shell and independent child ColorSwatch nodes.
 */
import type { PrimitiveBinding } from "../types";
export declare const colorSwatchPickerBinding: PrimitiveBinding;
//# sourceMappingURL=ColorSwatchPicker.binding.d.ts.map