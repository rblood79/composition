/**
 * Button Component Spec
 *
 * React Aria 기반 버튼 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { parsePxValue, parseBorderWidth } from "../primitives";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
// ADR-908 Phase 3-A-2: Fill token dual-read seam
import { resolveFillTokens } from "../utils/fillTokens";
import { Type, Parentheses, PointerOff } from "lucide-react";
import { STATIC_COLOR_FIELD } from "../utils/sharedSections";

/**
 * Button Props
 */
export interface ButtonProps {
  variant?:
    | "accent"
    | "primary"
    | "secondary"
    | "negative"
    | "premium"
    | "genai";
  fillStyle?: "fill" | "outline";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  children?: string;
  text?: string;
  label?: string;
  /** Lucide 아이콘 이름 (예: "arrow-right", "plus") */
  iconName?: string;
  /** 아이콘 위치: start(텍스트 왼쪽) / end(텍스트 오른쪽) */
  iconPosition?: "start" | "end";
  /** 아이콘 선 두께 (기본: 2) */
  iconStrokeWidth?: number;
  type?: "button" | "submit" | "reset";
  autoFocus?: boolean;
  href?: string;
  target?: "_self" | "_blank" | "_parent" | "_top";
  rel?: string;
  form?: string;
  name?: string;
  value?: string;
  formAction?: string;
  formMethod?: "get" | "post" | "dialog";
  formNoValidate?: boolean;
  formTarget?: "_self" | "_blank" | "_parent" | "_top";
  staticColor?: "white" | "black" | "auto";
  isDisabled?: boolean;
  isPending?: boolean;
  style?: Record<string, string | number | undefined>;
}

/**
 * Button Component Spec
 */
export const ButtonSpec: ComponentSpec<ButtonProps> = {
  name: "Button",
  description: "React Aria 기반 버튼 컴포넌트",
  archetype: "button",
  cssEmitMode: "button-base",
  element: "button",

  // ADR-083 Phase 8: button archetype base 의 layout primitive 4 필드 리프팅.
  //   box-sizing/cursor/user-select/transition/font-family 는 ContainerStylesSchema
  //   미지원 → archetype table 잔존.
  containerStyles: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
  },

  defaultVariant: "primary",
  defaultSize: "md",

  // ADR-096: DEFAULT_ELEMENT_HEIGHTS["button"] = 36 이관. BC 영향 0.
  defaultHeight: 36,

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          {
            key: "children",
            type: "string",
            label: "Text",
            icon: Type,
          },
        ],
      },
      {
        title: "Appearance",
        fields: [
          {
            type: "variant",
            label: "Variant",
            icon: Parentheses,
          },
          {
            key: "fillStyle",
            type: "enum",
            label: "Fill Style",
            icon: Parentheses,
            options: [
              { value: "fill", label: "Fill" },
              { value: "outline", label: "Outline" },
            ],
            defaultValue: "fill",
          },
          {
            type: "size",
            label: "Size",
            options: [
              { value: "xs", label: "XS" },
              { value: "sm", label: "S" },
              { value: "md", label: "M" },
              { value: "lg", label: "L" },
              { value: "xl", label: "XL" },
            ],
          },
          STATIC_COLOR_FIELD,
        ],
      },
      {
        title: "Icon",
        fields: [
          {
            key: "iconName",
            type: "icon",
            label: "Icon",
            clearKeys: ["iconPosition", "iconStrokeWidth"],
          },
          {
            key: "iconPosition",
            type: "enum",
            label: "Position",
            defaultValue: "start",
            visibleWhen: { key: "iconName", truthy: true },
            options: [
              { value: "start", label: "Start" },
              { value: "end", label: "End" },
            ],
          },
          {
            key: "iconStrokeWidth",
            type: "number",
            label: "Stroke Width",
            defaultValue: 2,
            min: 0.5,
            max: 4,
            step: 0.5,
            visibleWhen: { key: "iconName", truthy: true },
          },
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "type",
            type: "enum",
            label: "Type",
            defaultValue: "button",
            icon: Parentheses,
            options: [
              { value: "button", label: "Button" },
              { value: "submit", label: "Submit" },
              { value: "reset", label: "Reset" },
            ],
          },
          {
            key: "isPending",
            type: "boolean",
            label: "Pending",
            icon: PointerOff,
          },
          {
            key: "isDisabled",
            type: "boolean",
            label: "Disabled",
            icon: PointerOff,
          },
        ],
      },
    ],
  },

  // ADR-908 Phase 4-a (pilot): legacy background/Hover/Pressed → fill.default.*
  variants: {
    accent: {
      fill: {
        default: {
          base: "{color.accent}" as TokenRef,
          hover: "{color.accent-hover}" as TokenRef,
          pressed: "{color.accent-pressed}" as TokenRef,
        },
      },
      text: "{color.on-accent}" as TokenRef,
      border: "{color.accent}" as TokenRef,
      borderHover: "{color.accent-hover}" as TokenRef,
    },
    primary: {
      fill: {
        default: {
          base: "{color.neutral}" as TokenRef,
          hover: "{color.neutral-hover}" as TokenRef,
          pressed: "{color.neutral-pressed}" as TokenRef,
        },
      },
      text: "{color.base}" as TokenRef,
      border: "{color.neutral}" as TokenRef,
      borderHover: "{color.neutral-hover}" as TokenRef,
    },
    secondary: {
      fill: {
        default: {
          base: "{color.layer-1}" as TokenRef,
          hover: "{color.neutral-subtle}" as TokenRef,
          pressed: "{color.neutral-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
    negative: {
      fill: {
        default: {
          base: "{color.negative}" as TokenRef,
          hover: "{color.negative-hover}" as TokenRef,
          pressed: "{color.negative-pressed}" as TokenRef,
        },
      },
      text: "{color.on-negative}" as TokenRef,
      border: "{color.negative}" as TokenRef,
      borderHover: "{color.negative-hover}" as TokenRef,
    },
    premium: {
      fill: {
        default: {
          base: "{color.purple}" as TokenRef,
          hover: "{color.purple-hover}" as TokenRef,
          pressed: "{color.purple-pressed}" as TokenRef,
        },
      },
      text: "{color.white}" as TokenRef,
      border: "{color.purple}" as TokenRef,
      borderHover: "{color.purple-hover}" as TokenRef,
    },
    genai: {
      fill: {
        default: {
          base: "{color.purple}" as TokenRef,
          hover: "{color.purple-hover}" as TokenRef,
          pressed: "{color.purple-pressed}" as TokenRef,
        },
      },
      text: "{color.white}" as TokenRef,
      border: "{color.purple}" as TokenRef,
      borderHover: "{color.purple-hover}" as TokenRef,
    },
  },

  sizes: {
    xs: {
      height: 0,
      paddingX: 4,
      paddingY: 1,
      fontSize: "{typography.text-2xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      iconSize: 12,
      gap: 4,
      lineHeight: "{typography.text-2xs--line-height}" as TokenRef,
      borderWidth: 1,
      iconGap: 4,
    },
    sm: {
      height: 0,
      paddingX: 8,
      paddingY: 2,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      iconSize: 14,
      gap: 6,
      lineHeight: "{typography.text-xs--line-height}" as TokenRef,
      borderWidth: 1,
      iconGap: 6,
    },
    md: {
      height: 0,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      iconSize: 16,
      gap: 8,
      lineHeight: "{typography.text-sm--line-height}" as TokenRef,
      borderWidth: 1,
      iconGap: 8,
    },
    lg: {
      height: 0,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      iconSize: 20,
      gap: 10,
      lineHeight: "{typography.text-base--line-height}" as TokenRef,
      borderWidth: 1,
      iconGap: 10,
    },
    xl: {
      height: 0,
      paddingX: 24,
      paddingY: 12,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.xl}" as TokenRef,
      iconSize: 24,
      gap: 12,
      lineHeight: "{typography.text-lg--line-height}" as TokenRef,
      borderWidth: 1,
      iconGap: 12,
    },
  },

  states: {
    hover: {
      // variant별 hover 색상은 variants에서 정의
    },
    pressed: {
      // ADR-140 DD1: press-scale 단독 — inset-shadow 제거 (starter 디자인 언어 정합)
      scale: 0.95,
    },
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
    shapes: (props, size, state = "default") => {
      const variant =
        ButtonSpec.variants![
          (props as { variant?: keyof typeof ButtonSpec.variants }).variant ??
            ButtonSpec.defaultVariant!
        ];
      // ADR-908 Phase 3-A-2: fill token dual-read seam
      const fill = resolveFillTokens(variant);
      // 배경 roundRect는 항상 'auto'를 사용하여 specShapesToSkia의 containerWidth에 맞춤
      // props.style.width를 직접 사용하면 bgBox 추출이 실패하고 렌더링이 깨짐
      const width = "auto" as const;

      // 사용자 스타일 우선, 없으면 spec 기본값 (TokenRef passthrough → 다운스트림 resolveToken)
      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );
      const borderWidth = parseBorderWidth(props.style?.borderWidth, 1);

      const isOutline = props.fillStyle === "outline";

      // outline 시 variant별 텍스트 색상 매핑 (CSS `[data-fill-style="outline"]` 정합)
      const outlineTextMap: Record<string, TokenRef | string> = {
        accent: "{color.accent}" as TokenRef,
        primary: "{color.neutral}" as TokenRef,
        secondary: "{color.neutral}" as TokenRef,
        negative: "{color.negative}" as TokenRef,
        premium: "{color.purple}" as TokenRef,
        genai: "{color.purple}" as TokenRef,
      };

      // 상태에 따른 배경색 선택 (사용자 스타일 우선)
      const bgColor = isOutline
        ? (props.style?.backgroundColor ?? ("{color.transparent}" as TokenRef))
        : (props.style?.backgroundColor ??
          (state === "hover"
            ? (fill.default.hover ?? fill.default.base)
            : state === "pressed"
              ? (fill.default.pressed ?? fill.default.base)
              : fill.default.base));

      // 상태에 따른 텍스트색 선택 (사용자 스타일 우선)
      const textColor = isOutline
        ? (props.style?.color ??
          outlineTextMap[props.variant ?? "primary"] ??
          variant.text)
        : (props.style?.color ??
          (state === "hover" && variant.textHover
            ? variant.textHover
            : variant.text));

      // 상태에 따른 테두리색 선택 (사용자 스타일 우선)
      const borderColor = isOutline
        ? (props.style?.borderColor ?? ("{color.border-hover}" as TokenRef))
        : (props.style?.borderColor ??
          (state === "hover" && variant.borderHover
            ? variant.borderHover
            : variant.border));

      const shapes: Shape[] = [
        // 배경 (height: 'auto' → 실제 레이아웃 높이에 맞춤)
        {
          id: "bg",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width,
          height: "auto" as unknown as number,
          radius: borderRadius as unknown as number, // TokenRef를 나중에 resolve
          fill: bgColor,
          fillAlpha: fill.alpha ?? 1,
        },
      ];

      // 테두리 (있는 경우)
      if (borderColor) {
        shapes.push({
          type: "border" as const,
          target: "bg",
          borderWidth,
          color: borderColor,
          radius: borderRadius as unknown as number,
        });
      }

      // Child Composition: 자식 Element가 있으면 shell만 반환
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      if (hasChildren) return shapes;

      // 아이콘 + 텍스트 렌더링
      const iconName = props.iconName;
      const iconPos = props.iconPosition ?? "start";
      const iconSize = (size as unknown as { iconSize: number }).iconSize ?? 16;
      const gap = parsePxValue(
        props.style?.rowGap ?? props.style?.columnGap ?? props.style?.gap,
        size.gap ?? 8,
      );
      const text = props.children || props.text || props.label;

      // 사용자 스타일 padding 우선, 없으면 spec 기본값
      const paddingX = parsePxValue(
        props.style?.paddingLeft ??
          props.style?.paddingRight ??
          props.style?.padding,
        size.paddingX,
      );

      // 사용자 스타일 font 속성 우선, 없으면 spec 기본값
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

      const iconSw = props.iconStrokeWidth ?? 2;

      // fontSize 오버라이드 시 iconSize도 동일하게 적용
      const effectiveIconSize =
        props.style?.fontSize != null ? fontSize : iconSize;

      // Icon-only 모드: 아이콘만, 텍스트 없음 → 컨테이너 중앙 배치
      if (iconName && !text) {
        shapes.push({
          type: "icon_font" as const,
          iconName,
          x: 0,
          y: 0,
          fontSize: effectiveIconSize,
          fill: textColor,
          strokeWidth: iconSw,
          align: "center" as const,
          baseline: "middle" as const,
        });
        return shapes;
      }

      // Icon + Text 모드
      if (iconName && text) {
        if (iconPos === "end") {
          // Text → Icon: 텍스트 좌측, 아이콘 우측
          shapes.push({
            type: "text" as const,
            x: paddingX,
            y: 0,
            text,
            fontSize,
            fontFamily: ff,
            fontWeight: fw,
            fill: textColor,
            align: "left" as const,
            baseline: "middle" as const,
          });
          // 아이콘: 음수 x = 우측에서 오프셋 (specShapeConverter 처리)
          shapes.push({
            type: "icon_font" as const,
            iconName,
            x: -(paddingX + effectiveIconSize / 2),
            y: 0,
            fontSize: effectiveIconSize,
            fill: textColor,
            strokeWidth: iconSw,
            baseline: "middle" as const,
          });
        } else {
          // Icon → Text (기본: start)
          shapes.push({
            type: "icon_font" as const,
            iconName,
            x: paddingX + effectiveIconSize / 2,
            y: 0,
            fontSize: effectiveIconSize,
            fill: textColor,
            strokeWidth: iconSw,
            baseline: "middle" as const,
          });
          shapes.push({
            type: "text" as const,
            x: paddingX + effectiveIconSize + gap,
            y: 0,
            text,
            fontSize,
            fontFamily: ff,
            fontWeight: fw,
            fill: textColor,
            align: "left" as const,
            baseline: "middle" as const,
          });
        }
        return shapes;
      }

      // Text-only 모드 (기존)
      if (text) {
        const textAlign =
          (props.style?.textAlign as "left" | "center" | "right") || "center";

        shapes.push({
          type: "text" as const,
          x: paddingX,
          y: 0,
          text,
          fontSize,
          fontFamily: ff,
          fontWeight: fw,
          fill: textColor,
          align: textAlign,
          baseline: "middle" as const,
        });
      }

      return shapes;
    },

    react: (props) => ({
      "data-loading": props.isPending || undefined,
      "aria-busy": props.isPending || undefined,
    }),

    pixi: (props) => ({
      eventMode: "static",
      cursor: props.isDisabled ? "not-allowed" : "pointer",
    }),
  },
};
