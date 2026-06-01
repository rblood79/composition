/**
 * Dialog Component Spec
 *
 * React Aria 기반 다이얼로그 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { resolveStateColors } from "../utils/stateEffect";
import { MessageSquare, ToggleLeft, Parentheses } from "lucide-react";
import { DialogFooterSpec } from "./DialogFooter.spec";

/**
 * Dialog Props
 */
export interface DialogProps {
  size?: "sm" | "md" | "lg" | "xl";
  children?: string;
  title?: string;
  isDismissable?: boolean;
  role?: "dialog" | "alertdialog";
}

/**
 * Dialog Component Spec
 *
 * height: 0 = auto
 * overlay: modal (포털, 포커스 트랩, 백드롭)
 * Modal 내부에서 사용 — Modal이 backdrop과 focus management 담당
 */
export const DialogSpec: ComponentSpec<DialogProps> = {
  name: "Dialog",
  description: "React Aria 기반 다이얼로그 컴포넌트",
  archetype: "overlay",
  element: "div",
  skipCSSGeneration: false,

  // ADR-142 Inc3 — Skia generic 발효용 variant. bg/text 는 buildCatalogShapes 가 그리고
  //   (render.shapes DIALOG_DEFAULTS 와 동일), backdrop/shadow 는 skiaPrimitive 합성.
  //   Modal 패턴 동형. border 미지정 — render.shapes 도 Dialog border 미렌더(parity).
  defaultVariant: "default",
  variants: {
    default: {
      fill: {
        default: {
          base: "{color.layer-1}" as TokenRef,
          hover: "{color.layer-1}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
    },
  },

  defaultSize: "md",

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          {
            key: "children",
            type: "string",
            label: "Text",
            icon: MessageSquare,
          },
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "isDismissable",
            type: "boolean",
            label: "Dismissible",
            icon: ToggleLeft,
          },
          {
            key: "role",
            type: "enum",
            label: "Role",
            icon: Parentheses,
            options: [
              { value: "dialog", label: "Dialog" },
              { value: "alertdialog", label: "Alert Dialog" },
            ],
            defaultValue: "dialog",
          },
        ],
      },
    ],
  },

  overlay: {
    usePortal: true,
    type: "modal",
    hasBackdrop: true,
    closeOnBackdropClick: true,
    closeOnEscape: true,
    trapFocus: true,
    pixiLayer: "modal",
  },

  sizes: {
    xs: {
      height: 0,
      paddingX: 2,
      paddingY: 2,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 4,
    },
    sm: {
      height: 0,
      paddingX: 4,
      paddingY: 4,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      gap: 8,
    },
    md: {
      height: 0,
      paddingX: 8,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.xl}" as TokenRef,
      gap: 12,
    },
    lg: {
      height: 0,
      paddingX: 12,
      paddingY: 12,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.2xl}" as TokenRef,
      gap: 16,
    },
    xl: {
      height: 0,
      paddingX: 16,
      paddingY: 16,
      fontSize: "{typography.text-xl}" as TokenRef,
      borderRadius: "{radius.2xl}" as TokenRef,
      gap: 20,
    },
  },

  states: {},

  // ADR-094 expandChildSpecs: DialogFooter 슬롯 spec 을 Skia/Taffy 에 자동 등록.
  childSpecs: [DialogFooterSpec],

  render: {
    shapes: (props, size, state = "default") => {
      const DIALOG_DEFAULTS = {
        fill: {
          default: {
            base: "{color.layer-1}" as TokenRef,
            hover: "{color.layer-1}" as TokenRef,
            pressed: "{color.layer-1}" as TokenRef,
          },
        },
        text: "{color.neutral}" as TokenRef,
      };
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;

      const borderRadius = size.borderRadius;

      const shapes: Shape[] = [
        // Phase F: Backdrop (반투명 배경 오버레이)
        {
          type: "rect" as const,
          x: -9999,
          y: -9999,
          width: 99999,
          height: 99999,
          fill: "rgba(0, 0, 0, 0.5)" as unknown as TokenRef,
          fillAlpha: 0.5,
        },
        // Shadow
        {
          type: "shadow" as const,
          target: "bg",
          offsetX: 0,
          offsetY: 8,
          blur: 24,
          spread: 0,
          color: "rgba(0, 0, 0, 0.2)",
          alpha: 0.2,
        },
        // 배경
        {
          id: "bg",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: "auto",
          radius: borderRadius as unknown as number,
          fill: resolveStateColors(DIALOG_DEFAULTS, state).background,
        },
      ];
      if (hasChildren) return shapes;

      // 콘텐츠 컨테이너 (standalone 전용)
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
          padding: size.paddingY,
        },
      });

      return shapes;
    },

    react: (props) => ({
      role: props.role ?? "dialog",
      "aria-modal": true,
      "aria-label": props.title,
      "data-dismissible": props.isDismissable || undefined,
    }),

    pixi: () => ({
      eventMode: "static" as const,
    }),
  },
};
