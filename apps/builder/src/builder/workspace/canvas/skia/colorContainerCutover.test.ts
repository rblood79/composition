import { describe, expect, it } from "vitest";
import { getPrimitiveBinding } from "@composition/shared";
import { DELEGATING_INTERNAL_RENDERERS } from "../../../../preview/components/canonicalRendererRegistry";

import {
  SHELL_ONLY_CONTAINER_TAGS,
  SYNTHETIC_CHILD_PROP_MERGE_TAGS,
  buildSpecNodeData,
} from "./buildSpecNodeData";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";

const COLOR_CONTAINERS = ["ColorPicker", "ColorSwatchPicker"] as const;

function makeElement(type: string): CanvasSceneNode {
  return {
    id: type,
    type,
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: { size: "md" },
  } as unknown as CanvasSceneNode;
}

function makeLayout(): ComputedLayout {
  return { x: 0, y: 0, width: 220, height: 120 } as ComputedLayout;
}

describe("ADR-912 — Color container shell-only cutover", () => {
  for (const type of COLOR_CONTAINERS) {
    it(`${type} is shell-only because factory children own the color UI`, () => {
      expect(SHELL_ONLY_CONTAINER_TAGS.has(type)).toBe(true);
      expect(SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(type)).toBe(false);
    });

    it(`${type} delegates DOM rendering to rendererMap for child-tree context`, () => {
      const binding = getPrimitiveBinding(type);

      expect(binding?.source.kind).toBe("internal");
      if (binding?.source.kind === "internal") {
        expect(DELEGATING_INTERNAL_RENDERERS.has(binding.source.renderer)).toBe(
          true,
        );
      }
    });

    it(`${type} builds Skia node data without a legacy spec file`, () => {
      const element = makeElement(type);
      const node = buildSpecNodeData({
        element,
        layout: makeLayout(),
        theme: "light",
        elementsMap: new Map([[element.id, element]]),
      });

      expect(node).not.toBeNull();
      expect(node?.type).toBe("box");
      expect(node?.box).toBeDefined();
    });
  }
});
