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
import type { ComponentSize } from "../types";

import "./styles/ColorPicker.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface ColorPickerProps extends Omit<
  AriaColorPickerProps,
  "children"
> {
  /**
   * Size variant
   * @default 'md'
   */
  size?: ComponentSize;
  label?: string;
  children?: React.ReactNode;
  className?: string;
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
  size = "md",
  children,
  className,
  ...props
}: ColorPickerProps) {
  const baseClassName = typeof className === "string" ? className : undefined;
  const colorPickerClassName = baseClassName
    ? `react-aria-ColorPicker ${baseClassName}`
    : "react-aria-ColorPicker";

  return (
    <div className={colorPickerClassName} data-size={size}>
      <AriaColorPicker {...props}>
        <DialogTrigger>
          <Button className="color-picker-button">
            <ColorSwatch />
          </Button>
          <Popover placement="bottom start" className="color-picker-popover">
            {children || (
              <>
                <ColorArea
                  colorSpace="hsb"
                  xChannel="saturation"
                  yChannel="brightness"
                />
                <ColorSlider colorSpace="hsb" channel="hue" />
                <ColorField label="Hex" />
              </>
            )}
          </Popover>
        </DialogTrigger>
      </AriaColorPicker>
    </div>
  );
}
