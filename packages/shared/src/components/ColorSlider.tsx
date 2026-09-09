import {
  ColorSlider as AriaColorSlider,
  ColorSliderProps as AriaColorSliderProps,
} from "react-aria-components/ColorSlider";
import { SliderTrack } from "react-aria-components/Slider";
import { ColorThumb } from "react-aria-components/ColorThumb";

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
