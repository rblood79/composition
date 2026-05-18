/**
 * Form Component Spec
 *
 * React Aria 기반 폼 컨테이너 컴포넌트
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
import {
  CheckSquare,
  Globe,
  Send,
  Layout,
  FormInput,
  Sparkles,
} from "lucide-react";
import { FormFieldSpec } from "./FormField.spec";

/**
 * Form Props
 */
export interface FormProps {
  variant?: "default" | "outlined";
  size?: "sm" | "md" | "lg" | "xl";
  children?: string;
  title?: string;
  description?: string;
  isDisabled?: boolean;
  action?: string;
  method?: "get" | "post";
  encType?:
    | "application/x-www-form-urlencoded"
    | "multipart/form-data"
    | "text/plain";
  target?: "_self" | "_blank" | "_parent" | "_top";
  autoFocus?: boolean;
  restoreFocus?: boolean;
  validationBehavior?: "native" | "aria";
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "center" | "end";
  necessityIndicator?: "icon" | "label";
  isEmphasized?: boolean;
  style?: Record<string, string | number | undefined>;
}

/**
 * Form Component Spec
 */
export const FormSpec: ComponentSpec<FormProps> = {
  name: "Form",
  description: "React Aria 기반 폼 컨테이너 컴포넌트",
  element: "form",
  skipCSSGeneration: false,

  defaultVariant: "default",
  defaultSize: "md",

  properties: {
    sections: [
      {
        title: "Appearance",
        fields: [
          {
            key: "labelPosition",
            type: "enum",
            label: "Label Position",
            icon: Layout,
            options: [
              { value: "top", label: "Top" },
              { value: "side", label: "Side" },
            ],
            defaultValue: "top",
          },
          {
            key: "labelAlign",
            type: "enum",
            label: "Label Alignment",
            icon: Layout,
            options: [
              { value: "start", label: "Left" },
              { value: "center", label: "Center" },
              { value: "end", label: "Right" },
            ],
            defaultValue: "start",
          },
          {
            key: "necessityIndicator",
            type: "enum",
            label: "Necessity Indicator",
            icon: CheckSquare,
            emptyToUndefined: true,
            options: [
              { value: "", label: "None" },
              { value: "icon", label: "Icon (*)" },
              { value: "label", label: "Label (required/optional)" },
            ],
          },
          {
            key: "isEmphasized",
            type: "boolean",
            label: "Emphasized",
            icon: Sparkles,
          },
        ],
      },
      {
        title: "Submission",
        fields: [
          {
            key: "action",
            type: "string",
            label: "Action",
            placeholder: "/api/submit",
            emptyToUndefined: true,
            icon: Send,
          },
          {
            key: "method",
            type: "enum",
            label: "Method",
            icon: Send,
            options: [
              { value: "get", label: "GET" },
              { value: "post", label: "POST" },
            ],
            defaultValue: "get",
          },
          {
            key: "encType",
            type: "enum",
            label: "Encoding Type",
            icon: FormInput,
            emptyToUndefined: true,
            options: [
              { value: "", label: "Default" },
              {
                value: "application/x-www-form-urlencoded",
                label: "URL Encoded",
              },
              {
                value: "multipart/form-data",
                label: "Multipart (File Upload)",
              },
              { value: "text/plain", label: "Plain Text" },
            ],
          },
          {
            key: "target",
            type: "enum",
            label: "Target",
            emptyToUndefined: true,
            icon: Globe,
            options: [
              { value: "", label: "None" },
              { value: "_self", label: "Same Window" },
              { value: "_blank", label: "New Window" },
              { value: "_parent", label: "Parent Frame" },
              { value: "_top", label: "Top Frame" },
            ],
          },
        ],
      },
    ],
  },

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
    outlined: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.base}" as TokenRef,
          pressed: "{color.base}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 0,
      paddingX: 12,
      paddingY: 12,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 12,
    },
    md: {
      height: 0,
      paddingX: 20,
      paddingY: 20,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      gap: 16,
    },
    lg: {
      height: 0,
      paddingX: 28,
      paddingY: 28,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.xl}" as TokenRef,
      gap: 20,
    },
    xl: {
      height: 0,
      paddingX: 36,
      paddingY: 36,
      fontSize: "{typography.text-xl}" as TokenRef,
      borderRadius: "{radius.2xl}" as TokenRef,
      gap: 24,
    },
  },

  states: {
    hover: {},
    pressed: {},
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {},
  },

  // ADR-094 expandChildSpecs: FormField 슬롯 spec 을 Skia/Taffy 에 자동 등록.
  childSpecs: [FormFieldSpec],

  composition: {
    layout: "flex-column",
    gap: "16px",
    containerStyles: {
      "align-items": "start",
      "--form-label-width": "auto",
      "--form-label-align": "start",
      "--form-field-gap": "var(--spacing-md)",
    },
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "--form-label-width": "11rem",
          },
        },
      },
      "label-align": {
        center: {
          styles: {
            "--form-label-align": "center",
          },
        },
        end: {
          styles: {
            "--form-label-align": "end",
          },
        },
      },
    },
    delegation: [],
  },

  render: {
    shapes: (props, size, _state = "default") => {
      const variant =
        FormSpec.variants![
          (props as { variant?: keyof typeof FormSpec.variants }).variant ??
            FormSpec.defaultVariant!
        ];
      // 배경 roundRect는 항상 'auto'를 사용하여 specShapesToSkia의 containerWidth에 맞춤
      const width = "auto" as const;

      // 사용자 스타일 우선, 없으면 spec 기본값
      const fill = resolveFillTokens(variant);
      const bgColor = props.style?.backgroundColor ?? fill.default.base;

      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );

      const textColor = props.style?.color ?? variant.text;
      const fontSize = resolveSpecFontSize(
        props.style?.fontSize ?? size.fontSize,
        16,
      );
      const fwRaw = props.style?.fontWeight;
      const fw =
        fwRaw != null
          ? typeof fwRaw === "number"
            ? fwRaw
            : parseInt(String(fwRaw), 10) || 600
          : 600;
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;
      const textAlign =
        (props.style?.textAlign as "left" | "center" | "right") || "left";

      const shapes: Shape[] = [];

      // 배경
      shapes.push({
        id: "bg",
        type: "roundRect" as const,
        x: 0,
        y: 0,
        width,
        height: "auto",
        radius: borderRadius as unknown as number,
        fill: bgColor,
      });

      // 테두리 (outlined variant)
      const borderColor = props.style?.borderColor ?? variant.border;
      const borderWidth = parseBorderWidth(props.style?.borderWidth, 1);
      if (borderColor) {
        shapes.push({
          type: "border" as const,
          target: "bg",
          borderWidth,
          color: borderColor,
          radius: borderRadius as unknown as number,
        });
      }

      // 자식 Element가 콘텐츠 렌더링 담당 (Heading, Description, FormField 등)
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      if (hasChildren) return shapes;

      // fallback: 자식이 없는 레거시 데이터 → 전체 렌더링
      // 타이틀
      if (props.title) {
        shapes.push({
          type: "text" as const,
          x: size.paddingX,
          y: size.paddingY,
          text: props.title,
          fontSize: fontSize + 4,
          fontFamily: ff,
          fontWeight: fw,
          fill: textColor,
          align: textAlign,
          baseline: "top" as const,
        });
      }

      // 설명
      if (props.description) {
        shapes.push({
          type: "text" as const,
          x: size.paddingX,
          y: size.paddingY + (props.title ? fontSize + 12 : 0),
          text: props.description,
          fontSize: fontSize - 2,
          fontFamily: ff,
          fill: "{color.neutral-subdued}" as TokenRef,
          align: textAlign,
          baseline: "top" as const,
        });
      }

      const padding = parsePxValue(
        props.style?.paddingTop ?? props.style?.padding,
        size.paddingY,
      );
      shapes.push({
        type: "container" as const,
        x: 0,
        y: 0,
        width: "auto",
        height: "auto",
        children: [],
        layout: {
          display: "flex",
          flexDirection: "column",
          gap: size.gap,
          padding,
        },
      });

      return shapes;
    },

    react: (props) => ({
      "data-disabled": props.isDisabled || undefined,
    }),

    pixi: (props) => ({
      eventMode: props.isDisabled ? ("none" as const) : ("passive" as const),
    }),
  },
};
