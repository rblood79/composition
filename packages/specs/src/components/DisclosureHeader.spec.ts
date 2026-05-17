/**
 * DisclosureHeader Component Spec (properties-only)
 *
 * Disclosure 컴포넌트의 트리거 헤더 요소
 * heading level을 지정하여 접근성 시맨틱 구조 제공
 *
 * @packageDocumentation
 */

import type { ComponentSpec, TokenRef } from "../types";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
import { Heading } from "lucide-react";

export interface DisclosureHeaderProps {
  children?: string;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  style?: Record<string, string | number | undefined>;
}

export const DisclosureHeaderSpec: ComponentSpec<DisclosureHeaderProps> = {
  name: "DisclosureHeader",
  description: "Disclosure 트리거 헤더 (h1~h6 시맨틱)",
  element: "h3",
  archetype: "simple",

  // ADR-083 Phase 11: simple archetype base 의 layout primitive 2 필드 리프팅.
  containerStyles: {
    display: "inline-flex",
    alignItems: "center",
  },
  skipCSSGeneration: false,

  defaultVariant: "default",
  defaultSize: "md",

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          {
            key: "headingLevel",
            type: "enum",
            label: "Heading Level",
            icon: Heading,
            defaultValue: 3,
            options: [
              { value: "1", label: "H1" },
              { value: "2", label: "H2" },
              { value: "3", label: "H3" },
              { value: "4", label: "H4" },
              { value: "5", label: "H5" },
              { value: "6", label: "H6" },
            ],
            valueTransform: "number",
          },
        ],
      },
    ],
  },

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.transparent}" as TokenRef,
          hover: "{color.transparent}" as TokenRef,
          pressed: "{color.transparent}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
    },
  },

  sizes: {
    md: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
  },

  states: {
    // ADR-140 C1-c: Disclosure 헤더 press-scale 촉각 피드백
    pressed: { scale: 0.97 },
  },

  render: {
    shapes: (props, size) => {
      const text = String(
        props.children ?? (props as Record<string, unknown>).title ?? "Section",
      );
      const fontSize = resolveSpecFontSize(
        props.style?.fontSize ?? size.fontSize,
        14,
      );
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;
      const textColor: TokenRef =
        (props.style?.color as TokenRef) ?? ("{color.neutral}" as TokenRef);
      const chevronSize = Math.round(fontSize * 1.1);
      const paddingX = 12;
      const paddingY = 8;
      // chevron 좌측, 텍스트 chevron 우측에 gap(6px) 두고 배치
      // 행 높이 = fontSize + paddingY*2, 수직 중앙 = (height/2)
      const rowHeight = fontSize + paddingY * 2;
      const cy = rowHeight / 2;

      return [
        // chevron 아이콘 (ChevronRight)
        {
          type: "icon_font" as const,
          iconName: "chevron-right",
          x: paddingX + chevronSize / 2,
          y: cy,
          fontSize: chevronSize,
          fill: "{color.neutral-subdued}" as TokenRef,
          strokeWidth: 2,
        },
        // 타이틀 텍스트
        {
          type: "text" as const,
          x: paddingX + chevronSize + 6,
          y: cy,
          text,
          fontSize,
          fontFamily: ff,
          fontWeight: 600,
          fill: textColor,
          baseline: "middle" as const,
          align: "left" as const,
        },
      ];
    },
  },
};
