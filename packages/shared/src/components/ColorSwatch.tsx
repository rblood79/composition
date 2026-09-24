import {
  ColorSwatch as AriaColorSwatch,
  ColorSwatchProps as AriaColorSwatchProps,
} from "react-aria-components/ColorSwatch";


export type ColorSwatchProps = AriaColorSwatchProps;

export function ColorSwatch(props: ColorSwatchProps) {
  // ADR-239 Phase 4 — 저작 className 은 RAC 기본 class 뒤에 덧붙인다 (picker 항목의 swatch 모양).
  const extra = typeof props.className === "string" ? props.className : "";
  return (
    <AriaColorSwatch
      {...props}
      className={extra ? `react-aria-ColorSwatch ${extra}` : "react-aria-ColorSwatch"}
    />
  );
}
