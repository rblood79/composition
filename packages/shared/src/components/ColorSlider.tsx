import {
  ColorSlider as AriaColorSlider,
  ColorSliderProps as AriaColorSliderProps,
  ColorThumb,
  SliderTrack,
  composeRenderProps,
} from "react-aria-components";
import {
  toColorSliderRacProps,
  type ColorSliderCanonicalProps,
  type ColorSliderRacProps,
} from "../catalog/outputs/toRacProps";

import "./styles/ColorSlider.css";

export interface ColorSliderProps extends Omit<
  AriaColorSliderProps,
  "value" | "channel" | "colorSpace" | "orientation"
> {
  color?: string;
  value?: ColorSliderRacProps["value"];
  channel?: ColorSliderRacProps["channel"];
  colorSpace?: ColorSliderRacProps["colorSpace"];
  orientation?: ColorSliderRacProps["orientation"];
  size?: ColorSliderRacProps["size"];
  isDisabled?: boolean;
}

export function ColorSlider({
  color,
  value,
  channel,
  colorSpace,
  orientation,
  size,
  isDisabled,
  defaultValue,
  ...props
}: ColorSliderProps) {
  const projectedProps = toColorSliderRacProps({
    ...props,
    color,
    defaultValue,
    value,
    channel,
    colorSpace,
    orientation,
    size,
    isDisabled,
  } as ColorSliderCanonicalProps);

  return (
    <AriaColorSlider
      {...props}
      aria-label={props["aria-label"] ?? projectedProps["aria-label"]}
      channel={channel ?? projectedProps.channel}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-ColorSlider ${className}`
          : "react-aria-ColorSlider",
      )}
      colorSpace={colorSpace ?? projectedProps.colorSpace}
      data-channel={channel ?? projectedProps.channel}
      data-color-space={colorSpace ?? projectedProps.colorSpace}
      data-disabled={(isDisabled ?? projectedProps.isDisabled) || undefined}
      data-orientation={orientation ?? projectedProps.orientation}
      data-size={size ?? projectedProps.size}
      data-value={projectedProps.value}
      defaultValue={defaultValue ?? projectedProps.defaultValue}
      isDisabled={isDisabled ?? projectedProps.isDisabled}
      orientation={orientation ?? projectedProps.orientation}
      style={props.style ?? projectedProps.style}
    >
      <SliderTrack className="react-aria-SliderTrack">
        <ColorThumb className="react-aria-ColorThumb" />
      </SliderTrack>
    </AriaColorSlider>
  );
}
