/**
 * Toast Component Spec
 *
 * React Aria 기반 토스트 알림 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { parsePxValue, parseBorderWidth } from "../primitives";
import { fontFamily } from "../primitives/typography";
import { resolveStateColors } from "../utils/stateEffect";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
import { Tag, FileText, Clock, Bell, Layout } from "lucide-react";

/**
 * Toast Props
 */
export interface ToastProps {
  defaultTitle?: string;
  defaultDescription?: string;
  timeout?: number;
  position?:
    | "top end"
    | "top start"
    | "top"
    | "bottom end"
    | "bottom start"
    | "bottom";
  variant?: "info" | "positive" | "neutral" | "negative";
  size?: "sm" | "md" | "lg";
  message?: string;
  children?: string;
  /** ElementSprite 주입: 엔진 계산 최종 높이 */
  _containerHeight?: number;
  style?: Record<string, string | number | undefined>;
}

/**
 * Toast Component Spec
 *
 * overlay: toast (포털, 화면 하단에 표시)
 */
export const ToastSpec: ComponentSpec<ToastProps> = {
  name: "Toast",
  description: "React Aria 기반 토스트 알림 컴포넌트",
  archetype: "overlay",
  element: "div",

  defaultVariant: "info",
  defaultSize: "md",

  properties: {
    sections: [
      {
        title: "Default Toast Content",
        fields: [
          {
            key: "defaultTitle",
            type: "string",
            label: "Default Title",
            placeholder: "Notification",
            emptyToUndefined: true,
            icon: Tag,
          },
          {
            key: "defaultDescription",
            type: "string",
            label: "Default Description",
            emptyToUndefined: true,
            icon: FileText,
          },
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "timeout",
            type: "number",
            label: "Default Timeout (ms)",
            icon: Clock,
            defaultValue: 5000,
          },
        ],
      },
      {
        title: "Appearance",
        fields: [
          {
            key: "variant",
            type: "enum",
            label: "Default Variant",
            icon: Bell,
            options: [
              { value: "info", label: "Info" },
              { value: "positive", label: "Positive" },
              { value: "neutral", label: "Neutral" },
              { value: "negative", label: "Negative" },
            ],
            defaultValue: "info",
          },
          {
            key: "position",
            type: "enum",
            label: "Position",
            icon: Layout,
            options: [
              { value: "top end", label: "Top End" },
              { value: "top start", label: "Top Start" },
              { value: "top", label: "Top" },
              { value: "bottom end", label: "Bottom End" },
              { value: "bottom start", label: "Bottom Start" },
              { value: "bottom", label: "Bottom" },
            ],
            defaultValue: "bottom",
          },
        ],
      },
    ],
  },

  overlay: {
    usePortal: true,
    type: "toast",
    hasBackdrop: false,
    closeOnEscape: true,
    trapFocus: false,
    pixiLayer: "toast",
  },

  variants: {
    info: {
      fill: {
        default: {
          base: "{color.neutral-subtle}" as TokenRef,
          hover: "{color.neutral-subtle}" as TokenRef,
          pressed: "{color.neutral-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
    positive: {
      fill: {
        default: {
          base: "{color.positive-subtle}" as TokenRef,
          hover: "{color.positive-subtle}" as TokenRef,
          pressed: "{color.positive-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.positive}" as TokenRef,
    },
    neutral: {
      fill: {
        default: {
          base: "{color.neutral-subtle}" as TokenRef,
          hover: "{color.neutral-subtle}" as TokenRef,
          pressed: "{color.neutral-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
    negative: {
      fill: {
        default: {
          base: "{color.negative-subtle}" as TokenRef,
          hover: "{color.negative-subtle}" as TokenRef,
          pressed: "{color.negative-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.negative}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 40,
      paddingX: 12,
      paddingY: 8,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      iconSize: 16,
      gap: 8,
    },
    md: {
      height: 48,
      paddingX: 16,
      paddingY: 12,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      iconSize: 20,
      gap: 10,
    },
    lg: {
      height: 56,
      paddingX: 20,
      paddingY: 16,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      iconSize: 24,
      gap: 12,
    },
  },

  states: {},

  render: {
    shapes: (props, size, state = "default") => {
      const variant =
        ToastSpec.variants![
          (props as { variant?: keyof typeof ToastSpec.variants }).variant ??
            ToastSpec.defaultVariant!
        ];
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;

      const message =
        props.defaultDescription ||
        props.defaultTitle ||
        props.message ||
        props.children ||
        "Notification";

      // 사용자 스타일 우선, 없으면 spec 기본값
      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );
      const borderWidth = parseBorderWidth(props.style?.borderWidth, 1);

      const bgColor =
        props.style?.backgroundColor ??
        resolveStateColors(variant, state).background;
      const borderColor =
        props.style?.borderColor ??
        (variant.border || ("{color.border}" as TokenRef));

      // 사용자 스타일 padding 우선, 없으면 spec 기본값
      const paddingX = parsePxValue(
        props.style?.paddingLeft ??
          props.style?.paddingRight ??
          props.style?.padding,
        size.paddingX,
      );

      // 사용자 스타일 font 속성 우선, 없으면 spec 기본값
      const fontSize = resolveSpecFontSize(
        props.style?.fontSize ?? size.fontSize,
        16,
      );
      const fwRaw = props.style?.fontWeight;
      const fw =
        fwRaw != null
          ? typeof fwRaw === "number"
            ? fwRaw
            : parseInt(String(fwRaw), 10) || 400
          : 400;
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;
      const textAlign =
        (props.style?.textAlign as "left" | "center" | "right") || "left";
      const textColor = props.style?.color ?? variant.text;

      const shapes: Shape[] = [
        // 그림자
        {
          type: "shadow" as const,
          target: "bg",
          offsetX: 0,
          offsetY: 4,
          blur: 12,
          spread: 0,
          color: "rgba(0, 0, 0, 0.15)",
          alpha: 0.15,
        },
        // 배경
        {
          id: "bg",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: size.height,
          radius: borderRadius as unknown as number,
          fill: bgColor,
        },
        // 테두리
        {
          type: "border" as const,
          target: "bg",
          borderWidth,
          color: borderColor,
          radius: borderRadius as unknown as number,
        },
        // 좌측 액센트 바
        {
          type: "rect" as const,
          x: 0,
          y: 0,
          width: 3,
          height: size.height,
          fill: variant.border || ("{color.accent}" as TokenRef),
        },
      ];
      if (hasChildren) return shapes;

      // 메시지 텍스트 (standalone 전용)
      shapes.push({
        type: "text" as const,
        x: paddingX + (size.iconSize || 20) + (size.gap || 10),
        y:
          typeof props._containerHeight === "number" &&
          props._containerHeight > 0
            ? props._containerHeight / 2
            : size.height / 2,
        text: message,
        fontSize: fontSize,
        fontFamily: ff,
        fontWeight: fw,
        fill: textColor,
        baseline: "middle" as const,
        align: textAlign,
      });

      return shapes;
    },

    react: () => ({
      role: "alert",
      "aria-live": "polite",
    }),

    pixi: () => ({
      eventMode: "static" as const,
    }),
  },
};
