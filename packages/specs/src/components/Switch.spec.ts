/**
 * Switch Component Spec
 *
 * React Aria 기반 스위치(토글) 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { fontFamily, getLabelLineHeight } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
import { Type, Eye, ToggleLeft, PointerOff, PenOff } from "lucide-react";

/**
 * Switch Props
 */
export interface SwitchProps {
  variant?: "default" | "emphasized";
  size?: "sm" | "md" | "lg" | "xl";
  children?: string;
  label?: string;
  name?: string;
  isEmphasized?: boolean;
  defaultSelected?: boolean;
  isSelected?: boolean;
  isInvalid?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  autoFocus?: boolean;
  value?: string;
  form?: string;
  style?: Record<string, string | number | undefined>;
}

/** variant별 선택 시 트랙 색상 */
export const SWITCH_SELECTED_TRACK_COLORS: Record<string, TokenRef> = {
  default: "{color.neutral}" as TokenRef,
  emphasized: "{color.accent}" as TokenRef,
};

/**
 * Switch Component Spec
 */
export const SwitchSpec: ComponentSpec<SwitchProps> = {
  name: "Switch",
  description: "React Aria 기반 스위치(토글) 컴포넌트",
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
    // fill.default.selected: indicator track 의 selected(on) 상태 색(보편 상태축).
    //   이전 SWITCH_SELECTED_TRACK_COLORS 상수를 variant 로 흡수(ADR-142 B2). base=transparent 는
    //   컨테이너 배경(track 아님) — 미선택 track 색은 모든 variant 공통이라 skiaPrimitive 잔존.
    // ADR-912 단계 5 step 2: textWeight:400 명시 (rule 정본 정합 — measurement generic 전환
    //   drift 0, spec 추종 guardrail 통과). spec 삭제(step 4) 시 함께 제거.
    default: {
      fill: {
        default: {
          base: "{color.transparent}" as TokenRef,
          hover: "{color.transparent}" as TokenRef,
          pressed: "{color.transparent}" as TokenRef,
          selected: "{color.neutral}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      textWeight: 400,
    },
    emphasized: {
      fill: {
        default: {
          base: "{color.transparent}" as TokenRef,
          hover: "{color.transparent}" as TokenRef,
          pressed: "{color.transparent}" as TokenRef,
          selected: "{color.accent}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      textWeight: 400,
    },
  },

  sizes: {
    sm: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 8,
      indicator: {
        trackWidth: 32,
        trackHeight: 18,
        thumbSize: 14,
        thumbOffset: 2,
      },
    },
    md: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 10,
      indicator: {
        trackWidth: 36,
        trackHeight: 20,
        thumbSize: 16,
        thumbOffset: 2,
      },
    },
    lg: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 12,
      indicator: {
        trackWidth: 44,
        trackHeight: 24,
        thumbSize: 20,
        thumbOffset: 2,
      },
    },
    xl: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 14,
      indicator: {
        trackWidth: 52,
        trackHeight: 28,
        thumbSize: 24,
        thumbOffset: 2,
      },
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
        ],
      },
      {
        title: "Appearance",
        fields: [
          { key: "isEmphasized", type: "boolean", icon: Eye },
          { type: "size" },
        ],
      },
      {
        title: "State",
        fields: [
          { key: "isSelected", type: "boolean", icon: ToggleLeft },
          { key: "isDisabled", type: "boolean", icon: PointerOff },
          { key: "isReadOnly", type: "boolean", icon: PenOff },
        ],
      },
    ],
  },

  render: {
    shapes: (props, size, _state = "default") => {
      const variant =
        SwitchSpec.variants![
          (props as { variant?: keyof typeof SwitchSpec.variants }).variant ??
            SwitchSpec.defaultVariant!
        ];
      const variantName = props.variant ?? "default";
      const switchSize = {
        trackWidth: size.indicator?.trackWidth ?? 36,
        trackHeight: size.indicator?.trackHeight ?? 20,
        thumbSize: size.indicator?.thumbSize ?? 16,
        thumbOffset: size.indicator?.thumbOffset ?? 2,
      };
      const gap = size.gap ?? 10;

      const isChecked = props.isSelected;
      const defaultTrackColor = isChecked
        ? (SWITCH_SELECTED_TRACK_COLORS[variantName] ??
          SWITCH_SELECTED_TRACK_COLORS.default)
        : ("{color.accent-subtle}" as TokenRef);

      const thumbX = isChecked
        ? switchSize.trackWidth - switchSize.thumbSize - switchSize.thumbOffset
        : switchSize.thumbOffset;
      const trackRadius = switchSize.trackHeight / 2;

      // 트랙 색상: indicator 전용 — 사용자 backgroundColor는 라벨 영역이므로 트랙에 적용하지 않음
      const bgColor = defaultTrackColor;

      // 트랙 테두리: indicator 전용 — 사용자 border 스타일은 라벨 영역이므로 트랙에 적용하지 않음
      const borderWidth = 2;
      const borderColor = "{color.border-hover}" as TokenRef;

      const shapes: Shape[] = [];

      // 트랙 배경
      shapes.push({
        id: "track",
        type: "roundRect" as const,
        x: 0,
        y: 0,
        width: switchSize.trackWidth,
        height: switchSize.trackHeight,
        radius: trackRadius,
        fill: bgColor,
      });

      // 트랙 테두리 (비선택 시)
      if (!isChecked) {
        shapes.push({
          type: "border" as const,
          target: "track",
          borderWidth,
          color: borderColor,
          radius: trackRadius,
        });
      }

      // 썸 (동그란 노브)
      // CSS: 선택 시 white, 비선택 시 --button-background-pressed (neutral-100 계열)
      shapes.push({
        id: "thumb",
        type: "circle" as const,
        x: thumbX + switchSize.thumbSize / 2,
        y: switchSize.trackHeight / 2,
        radius: switchSize.thumbSize / 2,
        fill: isChecked
          ? ("{color.white}" as TokenRef)
          : ("{color.neutral-subtle}" as TokenRef),
      });

      // 라벨 텍스트 — 자식 Element가 있으면 스킵 (TextSprite가 렌더링)
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      const labelText = props.children || props.label;
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
          x: switchSize.trackWidth + gap,
          y: switchSize.trackHeight / 2,
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
      role: "switch",
    }),

    pixi: (props) => ({
      eventMode: "static" as const,
      cursor: props.isDisabled ? "not-allowed" : "pointer",
    }),
  },
};
