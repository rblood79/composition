/**
 * DisclosureContent Component Spec
 *
 * Disclosure 컴포넌트의 패널 콘텐츠 영역 — 들여쓴 plain 텍스트 표시.
 * Skia에서 DisclosureContent 자식 텍스트를 렌더하기 위한 최소 spec.
 *
 * Preview: renderDisclosureContent (LayoutRenderers.tsx) — children.length > 0 이면
 * 자식 렌더, 없으면 props.children 문자열 렌더. Skia도 동일 동작.
 *
 * @packageDocumentation
 */

import type { ComponentSpec, TokenRef } from "../types";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";

/**
 * DisclosureContent Props
 */
export interface DisclosureContentProps {
  children?: string;
  style?: Record<string, string | number | undefined>;
}

/**
 * DisclosureContent Component Spec
 */
export const DisclosureContentSpec: ComponentSpec<DisclosureContentProps> = {
  name: "DisclosureContent",
  description: "Disclosure 패널 콘텐츠 영역",
  element: "div",
  archetype: "simple",
  skipCSSGeneration: true,

  defaultVariant: "default",
  defaultSize: "md",

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.transparent}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 0,
      paddingX: 8,
      paddingY: 4,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    md: {
      height: 0,
      paddingX: 12,
      paddingY: 6,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    lg: {
      height: 0,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
  },

  states: {
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
  },

  render: {
    shapes: (props, size) => {
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      // 자식 element 가 있으면 Skia가 자식들을 직접 렌더 — 이 spec shapes 비워둠
      if (hasChildren) return [];

      const text = String(props.children || "");
      if (!text) return [];

      const fontSize = resolveSpecFontSize(
        props.style?.fontSize ?? size.fontSize,
        14,
      );
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;
      const textColor: TokenRef =
        (props.style?.color as TokenRef) ?? ("{color.neutral}" as TokenRef);

      return [
        {
          type: "text" as const,
          x: 12,
          y: fontSize,
          text,
          fontSize,
          fontFamily: ff,
          fontWeight: 400,
          fill: textColor,
          baseline: "top" as const,
          align: "left" as const,
        },
      ];
    },
  },

  properties: {
    sections: [],
  },
};
