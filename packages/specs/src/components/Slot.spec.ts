/**
 * Slot Component Spec
 *
 * 플레이스홀더 컨테이너 컴포넌트
 * Single Source of Truth - React와 Skia Canvas에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, TokenRef } from "../types";
import { parsePxValue, parseBorderWidth } from "../primitives";
import { FileText, Type, AlertCircle } from "lucide-react";

/**
 * Slot Props
 */
export interface SlotProps {
  size?: "sm" | "md" | "lg";
  name?: string;
  description?: string;
  required?: boolean;
  style?: Record<string, string | number | undefined>;
}

/**
 * Slot Component Spec
 */
const SLOT_DEFAULTS = {
  background: "{color.base}" as TokenRef,
  border: "{color.border}" as TokenRef,
};

export const SlotSpec: ComponentSpec<SlotProps> = {
  name: "Slot",
  description: "플레이스홀더 슬롯 컨테이너 컴포넌트",
  element: "div",
  skipCSSGeneration: false,

  defaultSize: "md",

  sizes: {
    sm: {
      height: 40,
      paddingX: 8,
      paddingY: 8,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 4,
    },
    md: {
      height: 60,
      paddingX: 12,
      paddingY: 12,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 8,
    },
    lg: {
      height: 80,
      paddingX: 16,
      paddingY: 16,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      gap: 12,
    },
  },

  states: {},

  properties: {
    sections: [
      {
        title: "Slot Settings",
        fields: [
          {
            key: "name",
            type: "string",
            label: "Name",
            icon: FileText,
            placeholder: "content",
          },
          {
            key: "description",
            type: "string",
            label: "Description",
            icon: Type,
            placeholder: "Main content area",
            emptyToUndefined: true,
          },
          {
            key: "required",
            type: "boolean",
            label: "Required",
            icon: AlertCircle,
          },
        ],
      },
    ],
  },

  render: {
    shapes: (props, size, _state = "default") => {
      // 사용자 스타일 우선, 없으면 spec 기본값
      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );
      const borderWidth = parseBorderWidth(props.style?.borderWidth, 1);

      const bgColor = props.style?.backgroundColor ?? SLOT_DEFAULTS.background;
      const borderColor = props.style?.borderColor ?? SLOT_DEFAULTS.border;

      return [
        {
          id: "bg",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: "auto" as unknown as number,
          radius: borderRadius as unknown as number,
          fill: bgColor,
          fillAlpha: 0.5,
        },
        {
          type: "border" as const,
          target: "bg",
          borderWidth,
          color: borderColor,
          style: "dashed",
          radius: borderRadius as unknown as number,
        },
      ];
    },

    react: () => ({}),
  },
};
