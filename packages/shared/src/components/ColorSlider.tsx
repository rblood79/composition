import {
  ColorSlider as AriaColorSlider,
  ColorSliderProps as AriaColorSliderProps,
  SliderTrack,
  ColorThumb,
} from "react-aria-components";

import "./styles/ColorSlider.css";

export type ColorSliderProps = AriaColorSliderProps;

export function ColorSlider(props: ColorSliderProps) {
  return (
    <AriaColorSlider {...props} className="react-aria-ColorSlider">
      <SliderTrack className="react-aria-SliderTrack">
        <ColorThumb className="react-aria-ColorThumb" />
      </SliderTrack>
    </AriaColorSlider>
  );
}
