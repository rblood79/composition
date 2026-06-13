/**
 * CheckboxGroup Component Spec
 *
 * React Aria 기반 체크박스 그룹 컨테이너 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
// ADR-912 collection sub-part cutover (2026-06-14): CheckboxItemsSpec import 제거 (spec 물리 삭제).
import {
  Layout,
  Tag,
  FileText,
  AlertTriangle,
  PointerOff,
  Eye,
  PenOff,
  CheckSquare,
  ArrowLeftRight,
  HelpCircle,
} from "lucide-react";

/**
 * CheckboxGroup Props
 */
export interface CheckboxGroupProps {
  variant?: "default" | "accent";
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  orientation?: "vertical" | "horizontal";
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "end";
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  isRequired?: boolean;
  necessityIndicator?: "icon" | "label";
  defaultValue?: string[];
  errorMessage?: string;
  name?: string;
  value?: string[];
  form?: string;
  isEmphasized?: boolean;
  contextualHelp?: string;
  validationBehavior?: "native" | "aria";
  children?: string;
  style?: Record<string, string | number | undefined>;
}

/**
 * CheckboxGroup Component Spec
 */
export const CheckboxGroupSpec: ComponentSpec<CheckboxGroupProps> = {
  name: "CheckboxGroup",
  description: "React Aria 기반 체크박스 그룹 컨테이너 컴포넌트",
  element: "div",
  skipCSSGeneration: false,

  // ADR-087 SP1: CheckboxGroup static layout-primitive 리프팅.
  //   flexDirection 은 labelPosition prop 에 의존 → runtime 결정 (implicitStyles 잔존).
  //   Label whiteSpace 주입 역시 child-level runtime.
  //   gap 은 spec.sizes[size].gap (size-indexed 8/12/16) 이 이미 size-indexed emit 되므로
  //   containerStyles.gap 으로 리프팅하면 size-indexed 블록 skip 되어 회귀 → 제외.
  containerStyles: {
    display: "flex",
  },

  defaultVariant: "default",
  defaultSize: "md",

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
    accent: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.base}" as TokenRef,
          pressed: "{color.base}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 8,
    },
    md: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 12,
    },
    lg: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 16,
    },
  },

  composition: {
    layout: "flex-column",
    gap: "var(--spacing-xs)",
    containerStyles: {
      color: "var(--fg)",
      "--label-font-size": "var(--text-sm)",
      "--label-line-height": "var(--text-sm--line-height)",
      "--cb-items-gap": "12px",
      "--cb-hint-size": "var(--text-xs)",
    },
    containerVariants: {
      size: {
        sm: {
          styles: {
            "--label-font-size": "var(--text-xs)",
            "--label-line-height": "var(--text-xs--line-height)",
            "--cb-items-gap": "8px",
          },
        },
        lg: {
          styles: {
            "--label-font-size": "var(--text-base)",
            "--label-line-height": "var(--text-base--line-height)",
            "--cb-items-gap": "16px",
          },
        },
      },
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
      orientation: {
        vertical: {
          nested: [
            {
              selector: ".checkbox-items",
              styles: {
                display: "flex",
                "flex-direction": "column",
                gap: "var(--cb-items-gap, var(--spacing-md))",
              },
            },
          ],
        },
        horizontal: {
          nested: [
            {
              selector: ".checkbox-items",
              styles: {
                display: "flex",
                "flex-direction": "row",
                "align-items": "center",
                gap: "var(--cb-items-gap, var(--spacing-md))",
              },
            },
          ],
        },
      },
    },
    delegation: [
      {
        childSelector: '[slot="description"]',
        bridges: {
          "font-size": "var(--cb-hint-size)",
        },
      },
    ],
  },

  states: {
    hover: {},
    pressed: {},
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  // ADR-912 collection sub-part cutover (2026-06-14): CheckboxItems 중간 컨테이너 폐기.
  //   react-aria-starter 구조(CheckboxGroup > Checkbox 직속) 채택 → propagation childPath
  //   에서 중간 "CheckboxItems" 단계 제거. childSpecs [CheckboxItemsSpec] 도 제거(spec 삭제).
  propagation: {
    rules: [
      {
        parentProp: "size",
        childPath: ["Checkbox"],
        override: true,
      },
      {
        parentProp: "size",
        childPath: ["Checkbox", "Label"],
        override: true,
      },
      { parentProp: "size", childPath: "Label", override: true },
    ],
  },

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          { key: "label", type: "string", label: "Label", icon: Tag },
          {
            key: "description",
            type: "string",
            label: "Description",
            icon: FileText,
          },
          {
            key: "errorMessage",
            type: "string",
            label: "Error Message",
            icon: AlertTriangle,
          },
          {
            key: "contextualHelp",
            type: "string",
            label: "Contextual Help",
            icon: HelpCircle,
            emptyToUndefined: true,
          },
        ],
      },
      {
        title: "Appearance",
        fields: [
          { key: "isEmphasized", type: "boolean", icon: Eye },
          { type: "size" },
          {
            key: "orientation",
            type: "enum",
            label: "Orientation",
            icon: ArrowLeftRight,
            options: [
              { value: "horizontal", label: "Horizontal" },
              { value: "vertical", label: "Vertical" },
            ],
            defaultValue: "vertical",
          },
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
            label: "Label Align",
            icon: Layout,
            options: [
              { value: "start", label: "Start" },
              { value: "end", label: "End" },
            ],
            defaultValue: "start",
          },
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "necessityIndicator",
            type: "enum",
            label: "Required",
            icon: CheckSquare,
            emptyToUndefined: true,
            derivedUpdateFn: (value: unknown) =>
              value
                ? { isRequired: true, necessityIndicator: value }
                : { isRequired: false, necessityIndicator: undefined },
            options: [
              { value: "", label: "None" },
              { value: "icon", label: "Icon (*)" },
              { value: "label", label: "Label (required/optional)" },
            ],
          },
          { key: "isInvalid", type: "boolean", icon: AlertTriangle },

          { key: "isDisabled", type: "boolean", icon: PointerOff },
          { key: "isReadOnly", type: "boolean", icon: PenOff },
        ],
      },
      {
        title: "Item Management",
        fields: [
          {
            key: "items",
            type: "children-manager",
            label: "Checkboxes",
            childTag: "Checkbox",
            defaultChildProps: {
              children: "Checkbox",
              value: "",
              isSelected: false,
            },
            labelProp: "children",
          },
        ],
      },
    ],
  },

  render: {
    shapes: (props, size, _state = "default") => {
      const shapes: Shape[] = [];

      // Propagation 정합성: props.size 명시 시 size.fontSize 우선
      const fontSize = resolveSpecFontSize(
        props.size ? size.fontSize : (props.style?.fontSize ?? size.fontSize),
        16,
      );
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;
      const textAlign =
        (props.style?.textAlign as "left" | "center" | "right") || "left";

      // 그룹 라벨: 자식 Label 요소가 독립 렌더링하므로 Spec에서는 렌더링하지 않음

      // 설명 / 에러 메시지 — 자식 유무와 무관하게 항상 자체 렌더링
      const descText =
        props.isInvalid && props.errorMessage
          ? props.errorMessage
          : props.description;
      if (descText) {
        shapes.push({
          type: "text" as const,
          x: 0,
          y: 0,
          text: descText,
          fontSize: fontSize - 2,
          fontFamily: ff,
          fill: props.isInvalid
            ? ("{color.negative}" as TokenRef)
            : ("{color.neutral-subdued}" as TokenRef),
          align: textAlign,
          baseline: "top" as const,
        });
      }

      // 자식이 있으면 자식 컨테이너는 생략 (자식이 직접 렌더링)
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      if (hasChildren) return shapes;

      // 체크박스 자식 컨테이너
      shapes.push({
        type: "container" as const,
        x: 0,
        y: 0,
        width: "auto",
        height: "auto",
        children: [],
        layout: {
          display: "flex",
          flexDirection: props.orientation === "horizontal" ? "row" : "column",
          gap: size.gap,
        },
      });

      return shapes;
    },

    react: (props) => ({
      "data-disabled": props.isDisabled || undefined,
      "data-invalid": props.isInvalid || undefined,
      "aria-orientation": props.orientation || "vertical",
      role: "group",
    }),

    pixi: (props) => ({
      eventMode: props.isDisabled ? ("none" as const) : ("passive" as const),
    }),
  },
};
