"use client";
import {
  ColorPicker as AriaColorPicker,
  ColorPickerProps as AriaColorPickerProps,
  DialogTrigger,
} from "react-aria-components";
import { Button } from "./Button";
import { ColorSwatch } from "./ColorSwatch";
import { ColorSlider } from "./ColorSlider";
import { ColorArea } from "./ColorArea";
import { ColorField } from "./ColorField";
import { Popover } from "./Popover";
import {
  toColorPickerRacProps,
  type ColorPickerCanonicalProps,
  type ColorPickerRacProps,
} from "../catalog/outputs/toRacProps";

import "./styles/ColorPicker.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface ColorPickerProps extends Omit<
  AriaColorPickerProps,
  "children" | "value" | "defaultValue"
> {
  /**
   * Size variant
   * @default 'md'
   */
  value?: ColorPickerRacProps["value"];
  defaultValue?: ColorPickerRacProps["defaultValue"];
  variant?: ColorPickerRacProps["variant"];
  size?: ColorPickerRacProps["size"];
  label?: string;
  isDisabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ColorPicker Component
 *
 * Features:
 * - Color selection with visual picker
 * - HSB color space support
 * - Hex input field
 * - Customizable color sliders and area
 *
 * @example
 * <ColorPicker size="md" />
 * <ColorPicker>
 *   <ColorArea colorSpace="rgb" xChannel="red" yChannel="green" />
 * </ColorPicker>
 */
export function ColorPicker({
  value,
  defaultValue,
  variant,
  size,
  label,
  isDisabled,
  children,
  className,
  style,
  ...props
}: ColorPickerProps) {
  const projectedProps = toColorPickerRacProps({
    ...props,
    value,
    defaultValue,
    variant,
    size,
    label,
    isDisabled,
    className,
    style,
  } as ColorPickerCanonicalProps);
  const baseClassName =
    typeof projectedProps.className === "string"
      ? projectedProps.className
      : undefined;
  const colorPickerClassName = baseClassName
    ? `react-aria-ColorPicker ${baseClassName}`
    : "react-aria-ColorPicker";
  const dataAttributes = Object.fromEntries(
    Object.entries(props).filter(([key]) => key.startsWith("data-")),
  ) as Record<`data-${string}`, string | number | boolean | undefined>;
  const colorValue = projectedProps.value ?? projectedProps.defaultValue;

  return (
    <div
      {...dataAttributes}
      className={colorPickerClassName}
      data-default-value={projectedProps.defaultValue}
      data-disabled={projectedProps.isDisabled || undefined}
      data-size={projectedProps.size}
      data-value={colorValue}
      data-variant={projectedProps.variant}
      style={projectedProps.style as React.CSSProperties | undefined}
    >
      <AriaColorPicker
        {...(projectedProps.value
          ? { value: projectedProps.value }
          : { defaultValue: projectedProps.defaultValue })}
      >
        <DialogTrigger>
          <Button className="color-picker-button">
            <ColorSwatch color={colorValue} isDisabled={isDisabled} />
          </Button>
          <Popover placement="bottom start" className="color-picker-popover">
            {children || (
              <>
                <ColorArea
                  colorSpace="hsb"
                  xChannel="saturation"
                  yChannel="brightness"
                  color={colorValue}
                  isDisabled={isDisabled}
                />
                <ColorSlider
                  colorSpace="hsb"
                  channel="hue"
                  color={colorValue}
                  isDisabled={isDisabled}
                />
                <ColorField
                  label="Hex"
                  value={colorValue}
                  isDisabled={isDisabled}
                />
              </>
            )}
          </Popover>
        </DialogTrigger>
      </AriaColorPicker>
    </div>
  );
}
