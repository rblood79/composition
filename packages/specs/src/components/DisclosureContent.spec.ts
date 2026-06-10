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
    // lineHeight: DOM(RAC DisclosurePanel) 은 fontSize 별 CSS line-height 토큰을
    //   상속(text-sm → 20px). layout(calculateContentHeight §5)+Skia 가 동일 px 를
    //   읽도록 spec sizes 에 명시. 누락 시 fontSize*1.5 fallback 으로 DOM(20) ↔
    //   Skia(24) 4px drift 발생.
    sm: {
      height: 0,
      paddingX: 8,
      paddingY: 4,
      fontSize: "{typography.text-xs}" as TokenRef,
      lineHeight: "{typography.text-xs--line-height}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    md: {
      height: 0,
      paddingX: 12,
      paddingY: 6,
      fontSize: "{typography.text-sm}" as TokenRef,
      lineHeight: "{typography.text-sm--line-height}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    lg: {
      height: 0,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      lineHeight: "{typography.text-base--line-height}" as TokenRef,
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

      // DOM 정합: RAC DisclosurePanel 은 unstyled <div> 로 padding/margin 0
      //   (Chrome 실측 padTop/Bottom/Left=0, marTop/Bottom=0). 따라서 Skia 텍스트도
      //   x=0/y=0 (baseline=top → y 는 텍스트 상단 좌표) 으로 컨테이너 좌상단에 붙여
      //   DOM 과 시각 대칭. 기존 x:12/y:fontSize 는 top·left 단방향 여백을 만들어
      //   상하/좌 비대칭(top 여백만 존재, bottom 0)을 유발했다.
      return [
        {
          type: "text" as const,
          x: 0,
          y: 0,
          text,
          fontSize,
          // size.lineHeight (TokenRef) emit — extractSpecTextStyle 의
          //   resolveShapeLineHeight 가 px 로 변환하여 layout height 가 DOM 과 정합.
          lineHeight: size.lineHeight as unknown as number,
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
