/**
 * Radio Component Spec
 *
 * React Aria 기반 라디오 버튼 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { parseBorderWidth } from "../primitives";
import { fontFamily, getLabelLineHeight } from "../primitives/typography";
import { resolveStateColors } from "../utils/stateEffect";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
import { Type, Hash, PointerOff, PenOff, Sparkles } from "lucide-react";

/**
 * Radio Props
 */
export interface RadioProps {
  variant?: "default" | "accent" | "neutral" | "negative";
  size?: "sm" | "md" | "lg" | "xl";
  children?: string;
  label?: string;
  text?: string;
  value?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  isEmphasized?: boolean;
  autoFocus?: boolean;
  style?: Record<string, string | number | undefined>;
}

/** variant별 비선택 시 ring 테두리 색상 (Skia shapes 전용) */
export const RADIO_RING_BORDER: Record<string, TokenRef> = {
  default: "{color.border-hover}" as TokenRef,
  accent: "{color.border-hover}" as TokenRef,
  neutral: "{color.border-hover}" as TokenRef,
  negative: "{color.negative}" as TokenRef,
};

/** variant별 선택 시 색상 */
export const RADIO_SELECTED_COLORS: Record<
  string,
  { ring: TokenRef; dot: TokenRef }
> = {
  default: {
    ring: "{color.accent}" as TokenRef,
    dot: "{color.accent}" as TokenRef,
  },
  accent: {
    ring: "{color.accent}" as TokenRef,
    dot: "{color.accent}" as TokenRef,
  },
  neutral: {
    ring: "{color.neutral-subtle}" as TokenRef,
    dot: "{color.neutral-subtle}" as TokenRef,
  },
  negative: {
    ring: "{color.negative}" as TokenRef,
    dot: "{color.negative}" as TokenRef,
  },
};

/**
 * Radio Component Spec
 */
export const RadioSpec: ComponentSpec<RadioProps> = {
  name: "Radio",
  description: "React Aria 기반 라디오 버튼 컴포넌트",
  archetype: "toggle-indicator",
  element: "label",

  // ADR-083 Phase 3: toggle-indicator archetype base 의 layout primitive 2 필드 리프팅.
  //   CSS / Skia layout (implicitStyles Phase 0) / Style Panel 3경로 동일 소스.
  //   cursor / user-select 는 ContainerStylesSchema 미지원 → archetype table 잔존.
  containerStyles: {
    display: "inline-flex",
    alignItems: "center",
  },

  defaultVariant: "default",
  defaultSize: "md",

  variants: {
    // selected/selectedBorder: indicator ring/dot 의 selected 상태 색(보편 상태축).
    //   이전 RADIO_SELECTED_COLORS/RADIO_RING_BORDER 상수를 variant 로 흡수(ADR-142 B2).
    //   border = 미선택 ring 테두리, fill.default.selected = selected dot, selectedBorder = selected ring.
    // ADR-912 단계 5 step 2: 각 variant 에 textWeight:400 명시 (rule 정본 정합 — measurement
    //   generic 전환 drift 0, spec 추종 guardrail 통과). spec 삭제(step 4) 시 함께 제거.
    default: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
          selected: "{color.accent}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border-hover}" as TokenRef,
      selectedBorder: "{color.accent}" as TokenRef,
      textWeight: 400,
    },
    accent: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
          selected: "{color.accent}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border-hover}" as TokenRef,
      selectedBorder: "{color.accent}" as TokenRef,
      textWeight: 400,
    },
    neutral: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
          selected: "{color.neutral-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border-hover}" as TokenRef,
      selectedBorder: "{color.neutral-subtle}" as TokenRef,
      textWeight: 400,
    },
    negative: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.negative-subtle}" as TokenRef,
          pressed: "{color.negative-subtle}" as TokenRef,
          selected: "{color.negative}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.negative}" as TokenRef,
      selectedBorder: "{color.negative}" as TokenRef,
      textWeight: 400,
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
      indicator: { boxSize: 16, dotSize: 6 },
    },
    md: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 8,
      indicator: { boxSize: 20, dotSize: 8 },
    },
    lg: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 10,
      indicator: { boxSize: 24, dotSize: 10 },
    },
    xl: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-xl}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 12,
      indicator: { boxSize: 28, dotSize: 12 },
    },
  },

  states: {
    hover: {},
    pressed: {},
    disabled: {
      opacity: 0.38,
      cursor: "not-allowed",
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  propagation: {
    rules: [
      { parentProp: "size", childPath: "Label", override: true },
      {
        parentProp: "children",
        childPath: "Label",
        childProp: "children",
        override: true,
      },
    ],
  },

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          { key: "children", type: "string", label: "Label", icon: Type },
          {
            key: "value",
            type: "string",
            label: "Value",
            emptyToUndefined: true,
            icon: Hash,
          },
        ],
      },
      {
        title: "State",
        fields: [
          { key: "isDisabled", type: "boolean", icon: PointerOff },
          { key: "isReadOnly", type: "boolean", icon: PenOff },
          {
            key: "isEmphasized",
            type: "boolean",
            label: "Emphasized",
            icon: Sparkles,
          },
        ],
      },
    ],
  },

  render: {
    shapes: (props, size, state = "default") => {
      const variant =
        RadioSpec.variants![
          (props as { variant?: keyof typeof RadioSpec.variants }).variant ??
            RadioSpec.defaultVariant!
        ];
      const variantName = props.variant ?? "default";
      const outer = size.indicator?.boxSize ?? 20;
      const inner = size.indicator?.dotSize ?? 8;
      const selectedColors =
        RADIO_SELECTED_COLORS[variantName] ?? RADIO_SELECTED_COLORS.default;
      const gap = size.gap ?? 8;
      const outerRadius = outer / 2;

      // 사용자 스타일 우선
      const borderWidth = parseBorderWidth(props.style?.borderWidth, 2);

      const ringBorder =
        RADIO_RING_BORDER[variantName] ?? RADIO_RING_BORDER.default;
      const borderColor =
        props.style?.borderColor ??
        (props.isSelected ? selectedColors.ring : ringBorder);

      const shapes: Shape[] = [];

      // 외곽 원 (테두리)
      shapes.push({
        id: "ring",
        type: "circle" as const,
        x: outerRadius,
        y: outerRadius,
        radius: outerRadius,
        fill: resolveStateColors(variant, state).background,
        fillAlpha: 0,
      });

      // 외곽 원 테두리
      shapes.push({
        type: "border" as const,
        target: "ring",
        borderWidth,
        color: borderColor,
        radius: outerRadius,
      });

      // 내부 원 (선택된 경우)
      if (props.isSelected) {
        shapes.push({
          type: "circle" as const,
          x: outerRadius,
          y: outerRadius,
          radius: inner / 2,
          fill: selectedColors.dot,
        });
      }

      // 라벨 텍스트 — 자식 Element가 있으면 스킵 (TextSprite가 렌더링)
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      const labelText = props.children || props.label || props.text;
      if (!hasChildren && labelText) {
        const textColor = props.style?.color ?? variant.text;
        const fontSize = resolveSpecFontSize(
          props.size ? size.fontSize : (props.style?.fontSize ?? size.fontSize),
          16,
        );
        const ff = (props.style?.fontFamily as string) || fontFamily.sans;
        const textAlign =
          (props.style?.textAlign as "left" | "center" | "right") || "left";

        const lineHeight = getLabelLineHeight(fontSize);

        shapes.push({
          type: "text" as const,
          x: outer + gap,
          y: outerRadius,
          text: labelText,
          fontSize,
          lineHeight,
          fontFamily: ff,
          fill: textColor,
          align: textAlign,
          baseline: "middle" as const,
        });
      }

      return shapes;
    },

    react: (props) => ({
      "data-selected": props.isSelected || undefined,
      "aria-checked": props.isSelected || undefined,
    }),

    pixi: (props) => ({
      eventMode: "static" as const,
      cursor: props.isDisabled ? "not-allowed" : "pointer",
    }),
  },
};
