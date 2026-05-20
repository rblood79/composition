import {
  Separator as AriaSeparator,
  type SeparatorProps as AriaSeparatorProps,
} from "react-aria-components";
import {
  toSeparatorRacProps,
  type SeparatorCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSizeSubset, SeparatorVariant } from "../types";
import "./styles/Separator.css";

export interface SeparatorProps extends AriaSeparatorProps {
  /**
   * The orientation of the separator
   * @default 'horizontal'
   */
  orientation?: "horizontal" | "vertical";

  /**
   * Visual variant
   * @default 'default'
   */
  variant?: SeparatorVariant;

  /**
   * Size/thickness of the separator
   * @default 'md'
   */
  size?: ComponentSizeSubset;
}

/** ADR-142 primitive wrapper: canonical props are projected through catalog toRacProps. */
export function Separator(props: SeparatorProps) {
  const projectedProps = toSeparatorRacProps(props as SeparatorCanonicalProps);
  const {
    orientation: _orientation,
    variant: _variant,
    size: _size,
    className,
    ...restProps
  } = props;
  const { orientation, variant, size } = projectedProps;

  return (
    <AriaSeparator
      {...restProps}
      orientation={orientation}
      className={
        className ? `react-aria-Separator ${className}` : "react-aria-Separator"
      }
      data-orientation={orientation}
      data-variant={variant}
      data-size={size}
    />
  );
}
