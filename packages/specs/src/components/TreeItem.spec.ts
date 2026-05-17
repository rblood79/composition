/**
 * TreeItem Component Spec
 *
 * Tree 컴포넌트의 항목 행 — expand/collapse chevron + 라벨 텍스트.
 * Skia 에서 TreeItem 자식 Element 가 각자 행을 렌더 (Preview renderTree 와 D3 대칭).
 *
 * Preview: renderTree (CollectionRenderers.tsx) 가 자식 TreeItem Element 를
 * 재귀 렌더하며 displayTitle = title || label || value || children 순으로 해석.
 * chevron 표시 여부는 실제 자식 TreeItem 존재 여부로 판정 (childTreeItems.length > 0).
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";

/**
 * TreeItem Props
 */
export interface TreeItemProps {
  children?: string;
  title?: string;
  label?: string;
  value?: string;
  style?: Record<string, string | number | undefined>;
}

/**
 * TreeItem Component Spec
 */
export const TreeItemSpec: ComponentSpec<TreeItemProps> = {
  name: "TreeItem",
  description: "Tree 항목 행 (chevron + 라벨)",
  element: "div",
  archetype: "simple",
  skipCSSGeneration: true,

  defaultVariant: "default",
  defaultSize: "md",

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.transparent}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 0,
      paddingX: 8,
      paddingY: 4,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    md: {
      height: 0,
      paddingX: 8,
      paddingY: 6,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    lg: {
      height: 0,
      paddingX: 12,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
  },

  states: {
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
  },

  render: {
    shapes: (props, size) => {
      // Preview renderTree 와 동일 해석 순서: title || label || value || children
      const text = String(
        props.title || props.label || props.value || props.children || "",
      );
      if (!text) return [];

      const fontSize = resolveSpecFontSize(
        props.style?.fontSize ?? size.fontSize,
        14,
      );
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;
      const textColor: TokenRef =
        (props.style?.color as TokenRef) ?? ("{color.neutral}" as TokenRef);
      // chevron 표시 = 실제 자식 TreeItem 존재 (buildSpecNodeData _hasChildren 주입).
      // Preview 의 childTreeItems.length > 0 판정과 대칭.
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;

      const chevronSize = Math.round(fontSize * 1.1);
      const paddingX = 8;
      const paddingY = 6;
      const rowHeight = fontSize + paddingY * 2;
      const cy = rowHeight / 2;

      const shapes: Shape[] = [];

      // expand/collapse chevron — 자식 TreeItem 이 있을 때만
      if (hasChildren) {
        shapes.push({
          type: "icon_font" as const,
          iconName: "chevron-right",
          x: paddingX + chevronSize / 2,
          y: cy,
          fontSize: chevronSize,
          fill: "{color.neutral-subdued}" as TokenRef,
          strokeWidth: 2,
        });
      }

      // 라벨 텍스트 — chevron 유무와 무관하게 동일 x (RAC Tree 행 정렬과 동일)
      shapes.push({
        type: "text" as const,
        x: paddingX + chevronSize + 6,
        y: cy,
        text,
        fontSize,
        fontFamily: ff,
        fontWeight: 400,
        fill: textColor,
        baseline: "middle" as const,
        align: "left" as const,
      });

      return shapes;
    },
  },

  properties: {
    sections: [],
  },
};
