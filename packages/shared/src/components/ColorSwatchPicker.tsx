import {
  ColorSwatchPicker as AriaColorSwatchPicker,
  ColorSwatchPickerItem as AriaColorSwatchPickerItem,
  ColorSwatchPickerItemProps,
  ColorSwatchPickerProps,
} from "react-aria-components/ColorSwatchPicker";

import { ColorSwatch, type ColorSwatchProps } from "./ColorSwatch";


export function ColorSwatchPicker({
  children,
  ...props
}: ColorSwatchPickerProps) {
  return <AriaColorSwatchPicker {...props}>{children}</AriaColorSwatchPicker>;
}

export { ColorSwatchPicker as MyColorSwatchPicker };

export function ColorSwatchPickerItem({
  swatchProps,
  ...props
}: ColorSwatchPickerItemProps & {
  /**
   * ADR-239 Phase 4 — 안쪽 swatch (`.react-aria-ColorSwatch`) 의 모양 (해석된 ColorSwatch 자식의 style · className).
   * 색은 항목 `color` 가 RAC context 로 준다.
   */
  swatchProps?: Omit<ColorSwatchProps, "color">;
}) {
  return (
    <AriaColorSwatchPickerItem {...props}>
      <ColorSwatch {...swatchProps} />
    </AriaColorSwatchPickerItem>
  );
}

export { ColorSwatchPickerItem as MyColorSwatchPickerItem };
