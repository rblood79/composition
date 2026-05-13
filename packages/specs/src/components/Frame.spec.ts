/**
 * Frame Component Spec — ADR-130 Phase 1
 *
 * canonical `frame` = layout container (pencil structural lowercase).
 * RAC `Group` (D1/ARIA semantic) 과 분리된 D3 layout primitive.
 *
 * - skipCSSGeneration: true (수동 CSS 없음, layout container dedicated)
 * - ARIA role 없음 (RAC Group 의 role="group" 비대응)
 * - render.shapes(): hasChildren 시 빈 배열, 아니면 최소 container shape
 *
 * @see docs/adr/130-layer3-canonical-vocabulary-alignment.md
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";

export interface FrameProps {
  clip?: boolean;
  placeholder?: boolean;
  style?: Record<string, string | number | undefined>;
}

export const FrameSpec: ComponentSpec<FrameProps> = {
  name: "frame",
  description: "Canonical layout container (ADR-130, pencil structural).",
  element: "div",
  skipCSSGeneration: true,

  defaultSize: "md",

  sizes: {
    md: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
  },

  states: {},

  render: {
    shapes: (props) => {
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      if (hasChildren) return [];

      const shapes: Shape[] = [
        {
          type: "container" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: "auto",
          children: [],
          layout: {
            display: "flex",
            flexDirection: "column",
            gap: 0,
          },
        },
      ];

      return shapes;
    },

    react: () => ({}),
  },
};
