/**
 * Group Component Spec
 *
 * React Aria 기반 그룹 컨테이너 컴포넌트
 * Single Source of Truth - React와 Skia Canvas에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { Tag, Shield, PointerOff, AlertTriangle, PenOff } from "lucide-react";

/**
 * Group Props
 */
export interface GroupProps {
  variant?: "default" | "accent";
  size?: "sm" | "md" | "lg";
  orientation?: "horizontal" | "vertical";
  label?: string;
  style?: Record<string, string | number | undefined>;
}

/**
 * Group Component Spec
 */
export const GroupSpec: ComponentSpec<GroupProps> = {
  name: "Group",
  description: "React Aria 기반 그룹 컨테이너 컴포넌트",
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
    },
    accent: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.base}" as TokenRef,
          pressed: "{color.base}" as TokenRef,
        },
      },
      text: "{color.accent}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 6,
    },
    md: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 8,
    },
    lg: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 12,
    },
  },

  states: {
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
  },

  render: {
    shapes: (props, size, _state = "default") => {
      const isVertical = props.orientation !== "horizontal";

      // Child Composition: 자식 Element가 있으면 spec shapes 스킵 (TRANSPARENT)
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      if (hasChildren) return [];

      const shapes: Shape[] = [
        // 그룹 컨테이너
        {
          type: "container" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: "auto",
          children: [],
          layout: {
            display: "flex",
            flexDirection: isVertical ? "column" : "row",
            gap: size.gap,
          },
        },
      ];

      return shapes;
    },

    react: (props) => ({
      role: "group",
      "aria-label": props.label,
      "aria-orientation": props.orientation,
    }),
  },

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          {
            key: "label",
            type: "string",
            label: "Label",
            icon: Tag,
            placeholder: "Group label",
          },
        ],
      },
      {
        title: "ARIA Role",
        fields: [
          {
            key: "role",
            type: "enum",
            label: "Role",
            icon: Shield,
            options: [
              { value: "group", label: "Group" },
              { value: "region", label: "Region" },
              { value: "presentation", label: "Presentation" },
            ],
            defaultValue: "group",
          },
        ],
      },
      {
        title: "State",
        fields: [
          { key: "isDisabled", type: "boolean", icon: PointerOff },
          { key: "isInvalid", type: "boolean", icon: AlertTriangle },
          { key: "isReadOnly", type: "boolean", icon: PenOff },
        ],
      },
    ],
  },
};
