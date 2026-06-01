/**
 * Checkbox Component Spec
 *
 * React Aria 기반 체크박스 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { parsePxValue, parseBorderWidth } from "../primitives";
import { fontFamily, getLabelLineHeight } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
// ADR-908 Phase 3-A-2: Fill token dual-read seam
import { resolveFillTokens } from "../utils/fillTokens";
import {
  Type,
  Eye,
  ToggleLeft,
  CheckSquare,
  AlertTriangle,
  PointerOff,
  PenOff,
  Hash,
} from "lucide-react";

/**
 * Checkbox Props
 */
export interface CheckboxProps {
  variant?: "default" | "emphasized";
  size?: "sm" | "md" | "lg";
  children?: string;
  label?: string;
  text?: string;
  name?: string;
  value?: string;
  isEmphasized?: boolean;
  isSelected?: boolean;
  isIndeterminate?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  autoFocus?: boolean;
  form?: string;
  style?: Record<string, string | number | undefined>;
}

/** variant별 비체크 시 박스 테두리 색상 (Skia shapes 전용) */
export const CHECKBOX_BOX_BORDER: Record<string, TokenRef> = {
  default: "{color.border}" as TokenRef,
  emphasized: "{color.border}" as TokenRef,
};

/** variant별 체크 시 색상 */
export const CHECKBOX_CHECKED_COLORS: Record<
  string,
  { bg: TokenRef; border: TokenRef }
> = {
  default: {
    bg: "{color.neutral}" as TokenRef,
    border: "{color.neutral}" as TokenRef,
  },
  emphasized: {
    bg: "{color.accent}" as TokenRef,
    border: "{color.accent}" as TokenRef,
  },
};

/**
 * Checkbox Component Spec
 */
export const CheckboxSpec: ComponentSpec<CheckboxProps> = {
  name: "Checkbox",
  description: "React Aria 기반 체크박스 컴포넌트",
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
    // selected/selectedBorder: indicator box 의 checked 상태 색(보편 상태축).
    //   이전 CHECKBOX_CHECKED_COLORS/CHECKBOX_BOX_BORDER 상수를 variant 로 흡수(ADR-142 B2).
    //   border = 미선택 box 테두리, fill.default.selected = checked bg, selectedBorder = checked border.
    default: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
          selected: "{color.neutral}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
      selectedBorder: "{color.neutral}" as TokenRef,
    },
    emphasized: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.accent-subtle}" as TokenRef,
          pressed: "{color.accent-subtle}" as TokenRef,
          selected: "{color.accent}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
      selectedBorder: "{color.accent}" as TokenRef,
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
      indicator: { boxSize: 16, boxRadius: 4 },
    },
    md: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 8,
      indicator: { boxSize: 20, boxRadius: 4 },
    },
    lg: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 10,
      indicator: { boxSize: 24, boxRadius: 6 },
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
        visibleWhen: { parentTagNot: "CheckboxGroup" },
        fields: [
          { key: "isEmphasized", type: "boolean", icon: Eye },
          { type: "size" },
        ],
      },
      {
        title: "State",
        fields: [
          { key: "isSelected", type: "boolean", icon: ToggleLeft },
          { key: "isIndeterminate", type: "boolean", icon: ToggleLeft },
          { key: "isRequired", type: "boolean", icon: CheckSquare },
          { key: "isInvalid", type: "boolean", icon: AlertTriangle },
          { key: "isDisabled", type: "boolean", icon: PointerOff },
          { key: "isReadOnly", type: "boolean", icon: PenOff },

          {
            key: "value",
            type: "string",
            label: "Value",
            icon: Hash,
            emptyToUndefined: true,
          },
        ],
      },
    ],
  },

  render: {
    shapes: (props, size, _state = "default") => {
      const variant =
        CheckboxSpec.variants![
          (props as { variant?: keyof typeof CheckboxSpec.variants }).variant ??
            CheckboxSpec.defaultVariant!
        ];
      const variantName = props.variant ?? "default";
      const boxSize = size.indicator?.boxSize ?? 20;
      const gap = size.gap ?? 8;

      const isChecked = props.isSelected;
      const checkedColors =
        CHECKBOX_CHECKED_COLORS[variantName] ?? CHECKBOX_CHECKED_COLORS.default;

      // 사용자 스타일 우선, 없으면 spec 기본값
      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.indicator?.boxRadius ?? 4,
      );
      const borderWidth = parseBorderWidth(props.style?.borderWidth, 2);

      const fill = resolveFillTokens(variant);
      const bgColor =
        props.style?.backgroundColor ??
        (isChecked ? checkedColors.bg : fill.default.base);

      const boxBorder =
        CHECKBOX_BOX_BORDER[variantName] ?? CHECKBOX_BOX_BORDER.default;
      const borderColor =
        props.style?.borderColor ??
        (isChecked ? checkedColors.border : boxBorder);

      const shapes: Shape[] = [];

      // 체크박스 박스 배경
      shapes.push({
        id: "box",
        type: "roundRect" as const,
        x: 0,
        y: 0,
        width: boxSize,
        height: boxSize,
        radius: borderRadius as unknown as number,
        fill: bgColor,
      });

      // 체크박스 박스 테두리
      shapes.push({
        type: "border" as const,
        target: "box",
        borderWidth,
        color: borderColor,
        radius: borderRadius as unknown as number,
      });

      // 체크마크 (체크된 경우)
      if (isChecked && !props.isIndeterminate) {
        const pad = boxSize * 0.2;
        shapes.push({
          type: "line" as const,
          x1: pad,
          y1: boxSize * 0.5,
          x2: boxSize * 0.4,
          y2: boxSize - pad,
          stroke: "{color.white}" as TokenRef,
          strokeWidth: 2.5,
        });
        shapes.push({
          type: "line" as const,
          x1: boxSize * 0.4,
          y1: boxSize - pad,
          x2: boxSize - pad,
          y2: pad,
          stroke: "{color.white}" as TokenRef,
          strokeWidth: 2.5,
        });
      }

      // 중간 상태 (indeterminate)
      if (props.isIndeterminate) {
        const pad = boxSize * 0.25;
        shapes.push({
          type: "line" as const,
          x1: pad,
          y1: boxSize / 2,
          x2: boxSize - pad,
          y2: boxSize / 2,
          stroke: "{color.white}" as TokenRef,
          strokeWidth: 2.5,
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
          x: boxSize + gap,
          y: boxSize / 2,
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
      "data-indeterminate": props.isIndeterminate || undefined,
      "aria-checked": props.isIndeterminate
        ? "mixed"
        : props.isSelected || undefined,
    }),

    pixi: (props) => ({
      eventMode: "static" as const,
      cursor: props.isDisabled ? "not-allowed" : "pointer",
    }),
  },
};
