import {
  ColorArea as AriaColorArea,
  ColorAreaProps as AriaColorAreaProps,
  ColorThumb,
} from "react-aria-components";

import "./styles/ColorArea.css";

export type ColorAreaProps = AriaColorAreaProps;

export function ColorArea(props: ColorAreaProps) {
  return (
    <AriaColorArea {...props} className="react-aria-ColorArea">
      <ColorThumb className="react-aria-ColorThumb" />
    </AriaColorArea>
  );
}
