import {
  ColorSwatch as AriaColorSwatch,
  ColorSwatchProps as AriaColorSwatchProps,
  composeRenderProps,
} from "react-aria-components";
import {
  toColorSwatchRacProps,
  type ColorSwatchCanonicalProps,
  type ColorSwatchRacProps,
} from "../catalog/outputs/toRacProps";

import "./styles/generated/ColorSwatch.css";
import "./styles/ColorSwatch.css";

export interface ColorSwatchProps extends AriaColorSwatchProps {
  variant?: ColorSwatchRacProps["variant"];
  size?: ColorSwatchRacProps["size"];
  rounding?: ColorSwatchRacProps["rounding"];
  isSelected?: boolean;
  isDisabled?: boolean;
}

export function ColorSwatch({
  color,
  variant,
  size,
  rounding,
  isSelected,
  isDisabled,
  ...props
}: ColorSwatchProps) {
  const projectedProps = toColorSwatchRacProps({
    ...props,
    color,
    variant,
    size,
    rounding,
    isSelected,
    isDisabled,
  } as ColorSwatchCanonicalProps);

  return (
    <AriaColorSwatch
      {...props}
      color={projectedProps.color}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-ColorSwatch ${className}`
          : "react-aria-ColorSwatch",
      )}
      data-color={projectedProps.color}
      data-disabled={projectedProps.isDisabled || undefined}
      data-rounding={projectedProps.rounding}
      data-selected={projectedProps.isSelected || undefined}
      data-size={projectedProps.size}
      data-variant={projectedProps.variant}
      style={props.style}
    />
  );
}
