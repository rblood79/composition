/**
 * SliderThumb Component Spec
 *
 * React Aria 기반 슬라이더 썸(핸들) 컴포넌트
 * Slider compound 컴포넌트의 child 요소 (드래그 가능한 원형 핸들)
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";

/**
 * SliderThumb Props
 */
export interface SliderThumbProps {
  size?: "sm" | "md" | "lg";
  /** 트랙 내 위치 계산용 (0-100 퍼센트) */
  value?: number;
  minValue?: number;
  maxValue?: number;
  isDisabled?: boolean;
  isDragging?: boolean;
  style?: Record<string, string | number | undefined>;
}

/**
 * SliderThumb Component Spec
 */
export const SliderThumbSpec: ComponentSpec<SliderThumbProps> = {
  name: "SliderThumb",
  description: "슬라이더 드래그 핸들 (원형) 렌더링",
  element: "div",
  archetype: "slider",
  skipCSSGeneration: false,

  // ADR-083 Phase 5: slider archetype base 의 layout primitive 1 필드 리프팅.
  containerStyles: {
    display: "grid",
  },

  defaultSize: "md",

  // 2026-06-10: height = thumb 지름 SSOT (Slider.spec.sizes[size].indicator.thumbSize /
  //   SliderTrack rule.thumbSize 와 동일: 14/18/22/26). 기존 16/20/24 + xl 누락은
  //   implicitStyles 주입값(정본 thumbSize)과 불일치 → Skia thumb 크기/선택영역 틀림.
  sizes: {
    sm: {
      height: 14,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 0,
    },
    md: {
      height: 18,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 0,
    },
    lg: {
      height: 22,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 0,
    },
    xl: {
      height: 26,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 0,
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

  render: {
    // 2026-06-10: thumb 렌더 소유권을 SliderTrack(slider_fill_bar) → SliderThumb element 로 이전.
    //   SliderThumb element 가 implicitStyles slidertrack 분기에서 left:percent% + width/height:
    //   thumbSize 로 배치되므로, 자기 box(thumbSize) 안에 원형 핸들을 그린다 (box 중앙 기준).
    //   DOM(RAC SliderThumb 자체 렌더)과 아키텍처 대칭 — SliderThumb 삭제 시 thumb 사라짐.
    //   (이전: SliderTrack 의 slider_fill_bar 가 thumb 까지 그려 SliderThumb 삭제해도 잔존했음.)
    shapes: (props, size) => {
      // 2026-06-10: diameter = size.height(정본 thumbSize 14/18/22/26) 우선.
      //   props.style.width 는 factory 초기값(md 18)이 store 에 고정되어 size 변경 시 갱신 안 됨
      //   → Skia thumb 고정 크기 회귀(selection 은 layout 주입 width 라 정상, render 는 store
      //   props 라 고정 — 경로 차이). size.height 는 buildSpecNodeData 가 size 변경마다 정본
      //   rule/spec sizes 로 재계산하므로 신뢰 가능. 사용자 명시 width(style.width ≠ factory
      //   기본)만 override 허용은 별도 — 현재는 size SSOT 우선으로 size 변경 정확 반영.
      const diameter = (size.height as number | undefined) ?? 18;
      const r = diameter / 2;
      const fillColor =
        (props.style?.backgroundColor as string | undefined) ??
        ("{color.accent}" as TokenRef);
      const shapes: Shape[] = [
        {
          id: "thumb",
          type: "circle" as const,
          x: r,
          y: r,
          radius: r,
          fill: fillColor,
        },
        {
          type: "border" as const,
          target: "thumb",
          borderWidth: 2,
          color: "{color.base}" as TokenRef,
          radius: r,
        },
      ];
      return shapes;
    },

    react: (props) => ({
      role: "slider",
      "aria-valuemin": props.minValue ?? 0,
      "aria-valuemax": props.maxValue ?? 100,
      "aria-valuenow": props.value ?? 50,
      "data-disabled": props.isDisabled || undefined,
      "data-dragging": props.isDragging || undefined,
    }),

    pixi: (props) => ({
      eventMode: props.isDisabled ? ("none" as const) : ("static" as const),
      cursor: props.isDisabled ? "not-allowed" : "grab",
    }),
  },
};
