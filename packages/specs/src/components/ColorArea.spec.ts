/**
 * ColorArea Component Spec
 *
 * React Aria 기반 2D 색상 영역 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { Sliders, PointerOff } from "lucide-react";

/**
 * ColorArea Props
 */
export interface ColorAreaProps {
  variant?: "default" | "accent";
  size?: "sm" | "md" | "lg";
  hue?: number;
  xValue?: number;
  yValue?: number;
  colorSpace?: "rgb" | "hsl" | "hsb";
  xChannel?:
    | "red"
    | "green"
    | "blue"
    | "hue"
    | "saturation"
    | "lightness"
    | "brightness";
  yChannel?:
    | "red"
    | "green"
    | "blue"
    | "hue"
    | "saturation"
    | "lightness"
    | "brightness";
  isDisabled?: boolean;
  style?: Record<string, string | number | undefined>;
}

/**
 * ColorArea Component Spec
 */
export const ColorAreaSpec: ComponentSpec<ColorAreaProps> = {
  name: "ColorArea",
  description: "React Aria 기반 2D 색상 선택 영역 (saturation/brightness)",
  element: "div",
  skipCSSGeneration: true,

  defaultVariant: "default",
  defaultSize: "md",

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.base}" as TokenRef,
          pressed: "{color.base}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
    accent: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.base}" as TokenRef,
          pressed: "{color.base}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.accent}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 120,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      iconSize: 14,
      gap: 0,
    },
    md: {
      height: 180,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      iconSize: 18,
      gap: 0,
    },
    lg: {
      height: 240,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      iconSize: 22,
      gap: 0,
    },
  },

  states: {
    hover: {},
    pressed: {},
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  properties: {
    sections: [
      {
        title: "Color Space",
        fields: [
          {
            key: "colorSpace",
            type: "enum",
            label: "Color Space",
            icon: Sliders,
            options: [
              { value: "rgb", label: "RGB" },
              { value: "hsl", label: "HSL" },
              { value: "hsb", label: "HSB" },
            ],
            defaultValue: "rgb",
          },
          {
            key: "xChannel",
            type: "enum",
            label: "X Channel",
            icon: Sliders,
            options: [
              { value: "red", label: "Red" },
              { value: "green", label: "Green" },
              { value: "blue", label: "Blue" },
              { value: "hue", label: "Hue" },
              { value: "saturation", label: "Saturation" },
              { value: "lightness", label: "Lightness" },
              { value: "brightness", label: "Brightness" },
            ],
            defaultValue: "saturation",
          },
          {
            key: "yChannel",
            type: "enum",
            label: "Y Channel",
            icon: Sliders,
            options: [
              { value: "red", label: "Red" },
              { value: "green", label: "Green" },
              { value: "blue", label: "Blue" },
              { value: "hue", label: "Hue" },
              { value: "saturation", label: "Saturation" },
              { value: "lightness", label: "Lightness" },
              { value: "brightness", label: "Brightness" },
            ],
            defaultValue: "brightness",
          },
        ],
      },
      {
        title: "State",
        fields: [{ key: "isDisabled", type: "boolean", icon: PointerOff }],
      },
    ],
  },

  render: {
    shapes: (props, size, _state = "default") => {
      const areaSize = size.height; // 정사각형
      const borderRadius = size.borderRadius;
      const thumbSize = size.iconSize ?? 18;

      const xValue = props.xValue ?? 0.7;
      const yValue = props.yValue ?? 0.3;

      const shapes: Shape[] = [
        // Color area gradient (saturation x brightness)
        {
          id: "area",
          type: "gradient" as const,
          x: 0,
          y: 0,
          width: areaSize,
          height: areaSize,
          radius: borderRadius as unknown as number,
          gradient: {
            type: "linear",
            angle: 90,
            stops: [
              { offset: 0, color: "#FFFFFF" },
              { offset: 1, color: "#000000" },
            ],
          },
        },
        // Area 테두리
        {
          type: "border" as const,
          target: "area",
          borderWidth: 1,
          color: "{color.border}" as TokenRef,
          radius: borderRadius as unknown as number,
        },
        // Thumb (원형)
        {
          type: "circle" as const,
          x: xValue * areaSize,
          y: (1 - yValue) * areaSize,
          radius: thumbSize / 2,
          fill: "{color.base}" as TokenRef,
        },
        // Thumb 테두리
        {
          type: "border" as const,
          x: xValue * areaSize - thumbSize / 2,
          y: (1 - yValue) * areaSize - thumbSize / 2,
          width: thumbSize,
          height: thumbSize,
          borderWidth: 2,
          color: "{color.border}" as TokenRef,
          radius: thumbSize / 2,
        },
      ];

      return shapes;
    },

    react: (props) => ({
      role: "slider",
      "aria-label": "Color area",
      "data-disabled": props.isDisabled || undefined,
    }),

    pixi: (props) => ({
      eventMode: props.isDisabled ? ("none" as const) : ("static" as const),
      cursor: props.isDisabled ? "not-allowed" : "crosshair",
    }),
  },
};
