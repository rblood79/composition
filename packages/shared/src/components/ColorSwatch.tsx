import {
  ColorSwatch as AriaColorSwatch,
  ColorSwatchProps as AriaColorSwatchProps,
} from "react-aria-components";

import "./styles/ColorSwatch.css";

export type ColorSwatchProps = AriaColorSwatchProps;

export function ColorSwatch(props: ColorSwatchProps) {
  return <AriaColorSwatch {...props} className="react-aria-ColorSwatch" />;
}
