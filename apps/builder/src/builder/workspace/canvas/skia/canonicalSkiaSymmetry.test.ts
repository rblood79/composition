import { describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { resolveCanonicalDocument } from "../../../../resolvers/canonical";
import {
  BreadcrumbSpec,
  BreadcrumbsSpec,
  ButtonSpec,
  LinkSpec,
  SeparatorSpec,
  ToggleButtonSpec,
  ToggleButtonGroupSpec,
  ToolbarSpec,
} from "@composition/specs";
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

  it("renders a resolved ToggleButton through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(ToggleButtonSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "toggle-button-1",
        type: "ToggleButton",
        props: {
          children: "Pinned",
          isSelected: true,
          isEmphasized: true,
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 120, height: 36 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("toggle-button-1");
    expect(collectText(node)).toContain("Pinned");
    expect(node?.box?.fillColor).toBeDefined();
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved ToggleButtonGroup shell and children through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(ToggleButtonGroupSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "toggle-group-1",
        type: "ToggleButtonGroup",
        props: {
          orientation: "horizontal",
          selectionMode: "multiple",
          size: "lg",
        },
        children: [
          {
            id: "toggle-child-1",
            type: "ToggleButton",
            props: {
              children: "Grid",
              isSelected: true,
              size: "lg",
            },
          },
        ],
      },
      theme: "light",
      layoutById: new Map([
        ["toggle-group-1", { x: 20, y: 24, width: 220, height: 40 }],
        ["toggle-child-1", { x: 20, y: 24, width: 100, height: 40 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("toggle-group-1");
    expect(collectText(node)).toContain("Grid");
    expect(node?.children?.[0]?.elementId).toBe("toggle-child-1");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Toolbar shell and children through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(ToolbarSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "toolbar-1",
        type: "Toolbar",
        props: {
          "aria-label": "Actions",
          orientation: "horizontal",
        },
        children: [
          {
            id: "toolbar-button-1",
            type: "Button",
            props: {
              children: "Add",
              variant: "secondary",
              size: "sm",
            },
          },
          {
            id: "toolbar-separator-1",
            type: "Separator",
            props: {
              orientation: "vertical",
              size: "sm",
            },
          },
        ],
      },
      theme: "light",
      layoutById: new Map([
        ["toolbar-1", { x: 20, y: 24, width: 260, height: 44 }],
        ["toolbar-button-1", { x: 28, y: 28, width: 72, height: 32 }],
        ["toolbar-separator-1", { x: 110, y: 30, width: 1, height: 28 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("toolbar-1");
    expect(collectText(node)).toContain("Add");
    expect(node?.children?.map((child) => child.elementId)).toEqual([
      "toolbar-button-1",
      "toolbar-separator-1",
    ]);
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders resolved Breadcrumbs and Breadcrumb children through the generic Skia path without render.shapes", () => {
    const renderBreadcrumbsShapes = vi.spyOn(BreadcrumbsSpec.render, "shapes");
    const renderBreadcrumbShapes = vi.spyOn(BreadcrumbSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "breadcrumbs-1",
        type: "Breadcrumbs",
        props: {
          "aria-label": "Trail",
          size: "L",
        },
        children: [
          {
            id: "breadcrumb-1",
            type: "Breadcrumb",
            props: {
              children: "Home",
              href: "/",
              size: "L",
            },
          },
          {
            id: "breadcrumb-2",
            type: "Breadcrumb",
            props: {
              children: "Docs",
              href: "/docs",
              size: "L",
            },
          },
        ],
      },
      theme: "light",
      layoutById: new Map([
        ["breadcrumbs-1", { x: 20, y: 24, width: 240, height: 28 }],
        ["breadcrumb-1", { x: 20, y: 24, width: 72, height: 28 }],
        ["breadcrumb-2", { x: 104, y: 24, width: 72, height: 28 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("breadcrumbs-1");
    expect(collectText(node)).toEqual(expect.arrayContaining(["Home", "Docs"]));
    expect(node?.children?.map((child) => child.elementId)).toEqual([
      "breadcrumb-1",
      "breadcrumb-2",
    ]);
    expect(renderBreadcrumbsShapes).not.toHaveBeenCalled();
    expect(renderBreadcrumbShapes).not.toHaveBeenCalled();
    renderBreadcrumbsShapes.mockRestore();
    renderBreadcrumbShapes.mockRestore();
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
