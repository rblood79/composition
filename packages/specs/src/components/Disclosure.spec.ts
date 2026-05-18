/**
 * Disclosure Component Spec
 *
 * React Aria 기반 디스클로저 (아코디언) 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { parsePxValue, parseBorderWidth } from "../primitives";
import { fontFamily } from "../primitives/typography";
import { resolveStateColors } from "../utils/stateEffect";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
import { ToggleLeft, PointerOff, Type } from "lucide-react";

/**
 * Disclosure Props
 */
export interface DisclosureProps {
  size?: "sm" | "md" | "lg";
  isExpanded?: boolean;
  title?: string;
  style?: Record<string, string | number | undefined>;
}

/**
 * Disclosure Component Spec
 */
export const DisclosureSpec: ComponentSpec<DisclosureProps> = {
  name: "Disclosure",
  description: "React Aria 기반 디스클로저 (아코디언) 컴포넌트",
  element: "div",
  skipCSSGeneration: false,

  defaultSize: "md",

  sizes: {
    sm: {
      height: 0,
      paddingX: 8,
      paddingY: 2,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      lineHeight: "{typography.text-xs--line-height}" as TokenRef,
      borderWidth: 1,
      iconSize: 14,
      gap: 6,
    },
    md: {
      height: 0,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      lineHeight: "{typography.text-sm--line-height}" as TokenRef,
      borderWidth: 1,
      iconSize: 16,
      gap: 8,
    },
    lg: {
      height: 0,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      lineHeight: "{typography.text-base--line-height}" as TokenRef,
      borderWidth: 1,
      iconSize: 20,
      gap: 10,
    },
  },

  states: {
    hover: {},
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  // ADR-141 Phase 1 (P2 / 감사 H16): chevron rotate micro-interaction.
  //   접힘 상태 = chevron-right(`>`), 펼침 상태([data-expanded]) → 90° 회전(`v`).
  //   `.disclosure-chevron` 은 Disclosure.tsx 가 렌더하는 trigger svg — 기존 CSS 전무.
  //   crop: size(--icon-size 상속)·stroke 기본형 + rotate + transition 을 함께 정의.
  //   Skia(DisclosureHeader icon_font)는 transient rotate 미지원 → CSS 전용 enhancement
  //   (ADR-141 R1 — data-expanded chevron 방향은 Skia 후속 재분류 대상).
  composition: {
    staticSelectors: {
      ".disclosure-chevron": {
        width: "var(--icon-size)",
        height: "var(--icon-size)",
        "flex-shrink": "0",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        rotate: "0deg",
        transition: "rotate 200ms",
      },
    },
    rootSelectors: {
      "&[data-expanded]": {
        nested: {
          ".disclosure-chevron": {
            rotate: "90deg",
          },
        },
      },
    },
    delegation: [],
  },

  render: {
    shapes: (props, size, state = "default") => {
      // variant 제거 (ADR-059 B2.2): default 색상 토큰 상수 사용
      const defaultVariantColors = {
        fill: {
          default: {
            base: "{color.base}" as TokenRef,
            hover: "{color.layer-2}" as TokenRef,
            pressed: "{color.layer-1}" as TokenRef,
          },
        },
        text: "{color.neutral}" as TokenRef,
        border: "{color.border}" as TokenRef,
      };
      const title = props.title || "Disclosure";

      // 사용자 스타일 우선
      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );
      const borderWidth = parseBorderWidth(props.style?.borderWidth, 1);

      const bgColor =
        props.style?.backgroundColor ??
        resolveStateColors(defaultVariantColors, state).background;
      const borderColor =
        props.style?.borderColor ??
        (defaultVariantColors.border || ("{color.border}" as TokenRef));

      const textColor = props.style?.color ?? defaultVariantColors.text;
      const fontSize = resolveSpecFontSize(
        props.style?.fontSize ?? size.fontSize,
        16,
      );
      const fwRaw = props.style?.fontWeight;
      const fw =
        fwRaw != null
          ? typeof fwRaw === "number"
            ? fwRaw
            : parseInt(String(fwRaw), 10) || 500
          : 500;
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;
      const textAlign =
        (props.style?.textAlign as "left" | "center" | "right") || "left";

      const paddingX = parsePxValue(
        props.style?.paddingLeft ??
          props.style?.paddingRight ??
          props.style?.padding,
        size.paddingX,
      );
      const paddingY = parsePxValue(
        props.style?.paddingTop ??
          props.style?.paddingBottom ??
          props.style?.padding,
        size.paddingY,
      );

      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      // _hasChildren=true: Disclosure는 투명 레이아웃 컨테이너.
      // 헤더/콘텐츠 시각 요소는 각 자식 spec(DisclosureHeader/DisclosureContent)이 담당.
      if (hasChildren) return [];

      const shapes: Shape[] = [
        // 배경
        {
          id: "bg",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: "auto",
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
      ];

      // 헤더 + 콘텐츠 (standalone 전용)
      shapes.push(
        // 헤더 (클릭 영역)
        {
          type: "container" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: size.height,
          children: [
            // 타이틀 텍스트
            {
              type: "text" as const,
              x: paddingX,
              y: size.height / 2,
              text: title,
              fontSize,
              fontFamily: ff,
              fontWeight: fw,
              fill: textColor,
              baseline: "middle" as const,
              align: textAlign,
            },
          ],
          layout: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: [0, paddingX, 0, paddingX],
          },
        },
        // 콘텐츠 패널 (isExpanded일 때만 표시)
        {
          type: "container" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: props.isExpanded ? "auto" : 0,
          children: [],
          layout: {
            display: props.isExpanded ? "flex" : "none",
            flexDirection: "column",
            padding: [0, paddingX, paddingY, paddingX],
            gap: size.gap,
          },
        },
      );

      return shapes;
    },

    react: (props) => ({
      "data-expanded": props.isExpanded || undefined,
    }),

    pixi: () => ({
      eventMode: "static" as const,
      cursor: "pointer",
    }),
  },

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          {
            key: "title",
            type: "string",
            label: "Title",
            placeholder: "Click to expand",
            icon: Type,
          },
        ],
      },
      {
        title: "Appearance",
        fields: [{ type: "size" }],
      },
      {
        title: "State",
        fields: [
          {
            key: "defaultExpanded",
            type: "boolean",
            label: "Default Expanded",
            icon: ToggleLeft,
          },
          {
            key: "isExpanded",
            type: "boolean",
            label: "Expanded (Controlled)",
            icon: ToggleLeft,
          },

          { key: "isDisabled", type: "boolean", icon: PointerOff },
        ],
      },
    ],
  },
};
