import {
  ColorArea as AriaColorArea,
  ColorAreaProps as AriaColorAreaProps,
} from "react-aria-components/ColorArea";
import { ColorThumb } from "react-aria-components/ColorThumb";

import "./styles/ColorArea.css";

export type ColorAreaProps = AriaColorAreaProps;

export function ColorArea(props: ColorAreaProps) {
  return (
    <AriaColorArea {...props} className="react-aria-ColorArea">
      <ColorThumb className="react-aria-ColorThumb" />
    </AriaColorArea>
  );
}
