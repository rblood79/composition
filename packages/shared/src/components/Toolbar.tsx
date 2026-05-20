import {
  composeRenderProps,
  Toolbar as RACToolbar,
  ToolbarProps,
} from "react-aria-components";
import {
  toToolbarRacProps,
  type ToolbarCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSizeSubset } from "../types";
import "./styles/generated/Toolbar.css";

export interface ToolbarExtendedProps extends ToolbarProps {
  variant?: "default" | "accent";
  size?: ComponentSizeSubset;
}

export function Toolbar({
  variant: inputVariant,
  size: inputSize,
  orientation: inputOrientation,
  className,
  style,
  ...props
}: ToolbarExtendedProps) {
  const projectedProps = toToolbarRacProps({
    ...props,
    variant: inputVariant,
    size: inputSize,
    orientation: inputOrientation,
    className,
    style,
  } as ToolbarCanonicalProps);
  const variant = inputVariant ?? projectedProps.variant;
  const size = inputSize ?? projectedProps.size;
  const orientation = inputOrientation ?? projectedProps.orientation;

  return (
    <RACToolbar
      {...props}
      aria-label={projectedProps["aria-label"]}
      orientation={orientation}
      data-orientation={orientation}
      data-variant={variant}
      data-size={size}
      className={composeRenderProps(className, (cls) =>
        cls ? `react-aria-Toolbar ${cls}` : "react-aria-Toolbar",
      )}
      style={style}
    />
  );
}
