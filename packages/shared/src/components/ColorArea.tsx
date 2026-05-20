import {
  ColorArea as AriaColorArea,
  ColorAreaProps as AriaColorAreaProps,
  ColorThumb,
  composeRenderProps,
} from "react-aria-components";
import {
  toColorAreaRacProps,
  type ColorAreaCanonicalProps,
  type ColorAreaRacProps,
} from "../catalog/outputs/toRacProps";

import "./styles/ColorArea.css";

export interface ColorAreaProps extends Omit<
  AriaColorAreaProps,
  "value" | "xChannel" | "yChannel" | "colorSpace"
> {
  color?: string;
  xChannel?: ColorAreaRacProps["xChannel"];
  yChannel?: ColorAreaRacProps["yChannel"];
  colorSpace?: ColorAreaRacProps["colorSpace"];
  size?: ColorAreaRacProps["size"];
  xValue?: ColorAreaRacProps["xValue"];
  yValue?: ColorAreaRacProps["yValue"];
  isDisabled?: boolean;
}

export function ColorArea({
  color,
  xChannel,
  yChannel,
  colorSpace,
  size,
  xValue,
  yValue,
  isDisabled,
  defaultValue,
  ...props
}: ColorAreaProps) {
  const projectedProps = toColorAreaRacProps({
    ...props,
    color,
    defaultValue,
    xChannel,
    yChannel,
    colorSpace,
    size,
    xValue,
    yValue,
    isDisabled,
  } as ColorAreaCanonicalProps);

  return (
    <AriaColorArea
      {...props}
      aria-label={props["aria-label"] ?? projectedProps["aria-label"]}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-ColorArea ${className}`
          : "react-aria-ColorArea",
      )}
      colorSpace={colorSpace ?? projectedProps.colorSpace}
      data-color-space={colorSpace ?? projectedProps.colorSpace}
      data-disabled={(isDisabled ?? projectedProps.isDisabled) || undefined}
      data-size={size ?? projectedProps.size}
      data-x-channel={xChannel ?? projectedProps.xChannel}
      data-x-value={projectedProps.xValue}
      data-y-channel={yChannel ?? projectedProps.yChannel}
      data-y-value={projectedProps.yValue}
      defaultValue={defaultValue ?? projectedProps.defaultValue}
      isDisabled={isDisabled ?? projectedProps.isDisabled}
      style={props.style ?? projectedProps.style}
      xChannel={xChannel ?? projectedProps.xChannel}
      yChannel={yChannel ?? projectedProps.yChannel}
    >
      <ColorThumb className="react-aria-ColorThumb" />
    </AriaColorArea>
  );
}
