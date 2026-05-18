/**
 * Modal Component Spec (properties-only)
 */
import type { ComponentSpec, TokenRef } from "../types";
import { MessageSquare } from "lucide-react";

export interface ModalProps {
  children?: string;
  style?: Record<string, string | number | undefined>;
}

export const ModalSpec: ComponentSpec<ModalProps> = {
  name: "Modal",
  description: "모달 오버레이 컴포넌트",
  archetype: "overlay",
  element: "div",
  skipCSSGeneration: false,

  defaultVariant: "default",
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
    ],
  },

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.transparent}" as TokenRef,
          hover: "{color.transparent}" as TokenRef,
          pressed: "{color.transparent}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
    },
  },
  sizes: {
    md: {
      height: 0,
      paddingX: 24,
      paddingY: 24,
      fontSize: "{typography.text-sm}" as TokenRef,
      // ADR-141 Phase 5 (P4 / 감사 H14): Modal radius lg→xl — starter 정합.
      //   수동 overlays.css `.react-aria-Modal` 와 동일 토큰으로 유지(R5 dual-CSS).
      borderRadius: "{radius.xl}" as TokenRef,
      gap: 8,
    },
  },
  states: {},

  render: {
    shapes: () => [],
  },
};
