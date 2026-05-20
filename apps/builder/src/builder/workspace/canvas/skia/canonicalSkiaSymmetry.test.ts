import { describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { resolveCanonicalDocument } from "../../../../resolvers/canonical";
import { ButtonSpec, LinkSpec, SeparatorSpec } from "@composition/specs";
import {
  buildGenericResolvedSkiaNodeData,
  measureGenericResolvedSkiaFrameBudget,
} from "./buildSpecNodeData";
import type { SkiaNodeData } from "./nodeRendererTypes";

function makeButtonOrigin(): CanonicalNode {
  return {
    id: "save-button-origin",
    type: "Button",
    reusable: true,
    props: {
      children: "Save",
      variant: "accent",
      fillStyle: "fill",
      size: "md",
    },
  };
}

function makeDocumentWithRefs(refCount = 1): CompositionDocument {
  const refs: CanonicalNode[] = Array.from({ length: refCount }, (_, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    return {
      id: `button-ref-${index}`,
      type: "ref",
      ref: "save-button-origin",
      props: {
        children: `Save ${index}`,
        style: {
          width: 120,
          height: 36,
          transform: `translate(${col * 132}px, ${row * 48}px)`,
        },
      },
    } as CanonicalNode;
  });

  return {
    version: "composition-1.0",
    children: [
      makeButtonOrigin(),
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "page", pageId: "page-1" },
        props: {
          style: { width: 800, height: 2400, backgroundColor: "#ffffff" },
        },
        children: refs,
      },
    ],
  };
}

function collectText(node: SkiaNodeData | null | undefined): string[] {
  if (!node) return [];
  return [
    ...(node.text?.content ? [node.text.content] : []),
    ...(node.children ?? []).flatMap((child) => collectText(child)),
  ];
}

describe("ADR-142 canonicalSkiaSymmetry proof slice", () => {
  it("renders a resolved Button ref through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(ButtonSpec.render, "shapes");
    const [, page] = resolveCanonicalDocument(makeDocumentWithRefs(1));

    const node = buildGenericResolvedSkiaNodeData({
      node: page,
      theme: "light",
      layoutById: new Map([
        ["page-1", { x: 0, y: 0, width: 800, height: 600 }],
        ["button-ref-0", { x: 24, y: 24, width: 120, height: 36 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(collectText(node)).toContain("Save 0");
    expect(node?.children?.[0]?.elementId).toBe("button-ref-0");
    expect(node?.children?.[0]?.box?.fillColor).toBeDefined();
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Separator through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(SeparatorSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "separator-1",
        type: "Separator",
        props: {
          orientation: "vertical",
          variant: "dashed",
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 12, y: 16, width: 4, height: 80 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("line");
    expect(node?.elementId).toBe("separator-1");
    expect(node?.line?.x1).toBe(2);
    expect(node?.line?.y2).toBe(80);
    expect(node?.line?.strokeDasharray).toEqual([6, 4]);
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Link through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(LinkSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "link-1",
        type: "Link",
        props: {
          children: "Open docs",
          variant: "secondary",
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 160, height: 28 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("text");
    expect(node?.elementId).toBe("link-1");
    expect(node?.text?.content).toBe("Open docs");
    expect(node?.text?.decoration).toBe(1);
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("measures 200+ resolved Button refs under the 60fps frame budget", () => {
    const refCount = 205;
    const [, page] = resolveCanonicalDocument(makeDocumentWithRefs(refCount));
    const layoutById = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >([["page-1", { x: 0, y: 0, width: 800, height: 2400 }]]);

    for (let index = 0; index < refCount; index += 1) {
      const row = Math.floor(index / 5);
      const col = index % 5;
      layoutById.set(`button-ref-${index}`, {
        x: 24 + col * 132,
        y: 24 + row * 48,
        width: 120,
        height: 36,
      });
    }

    const result = measureGenericResolvedSkiaFrameBudget({
      node: page,
      theme: "light",
      layoutById,
    });

    expect(result.nodeCount).toBeGreaterThanOrEqual(206);
    expect(result.estimatedFps).toBeGreaterThanOrEqual(60);
    expect(result.durationMs).toBeLessThanOrEqual(16.67);
  });
});
