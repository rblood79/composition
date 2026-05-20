import {
  ColorThumb,
  ColorWheel as AriaColorWheel,
  ColorWheelProps as AriaColorWheelProps,
  ColorWheelTrack,
  composeRenderProps,
} from "react-aria-components";
import {
  toColorWheelRacProps,
  type ColorWheelCanonicalProps,
  type ColorWheelRacProps,
} from "../catalog/outputs/toRacProps";

import "./styles/ColorWheel.css";

export interface ColorWheelProps extends Omit<
  AriaColorWheelProps,
  "outerRadius" | "innerRadius"
> {
  color?: string;
  hue?: ColorWheelRacProps["hue"];
  outerRadius?: ColorWheelRacProps["outerRadius"];
  innerRadius?: ColorWheelRacProps["innerRadius"];
  size?: ColorWheelRacProps["size"];
  isDisabled?: boolean;
}

export function ColorWheel({
  color,
  hue,
  outerRadius,
  innerRadius,
  size,
  isDisabled,
  defaultValue,
  ...props
}: ColorWheelProps) {
  const projectedProps = toColorWheelRacProps({
    ...props,
    color,
    defaultValue,
    hue,
    outerRadius,
    innerRadius,
    size,
    isDisabled,
  } as ColorWheelCanonicalProps);

  return (
    <AriaColorWheel
      {...props}
      aria-label={props["aria-label"] ?? projectedProps["aria-label"]}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-ColorWheel ${className}`
          : "react-aria-ColorWheel",
      )}
      data-disabled={(isDisabled ?? projectedProps.isDisabled) || undefined}
      data-hue={projectedProps.hue}
      data-inner-radius={innerRadius ?? projectedProps.innerRadius}
      data-outer-radius={outerRadius ?? projectedProps.outerRadius}
      data-size={size ?? projectedProps.size}
      defaultValue={defaultValue ?? projectedProps.defaultValue}
      innerRadius={innerRadius ?? projectedProps.innerRadius}
      isDisabled={isDisabled ?? projectedProps.isDisabled}
      outerRadius={outerRadius ?? projectedProps.outerRadius}
      style={props.style ?? projectedProps.style}
    >
      <ColorWheelTrack className="react-aria-ColorWheelTrack" />
      <ColorThumb className="react-aria-ColorThumb" />
    </AriaColorWheel>
  );
}

export { ColorWheel as MyColorWheel };
