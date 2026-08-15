import { describe, expect, it } from "vitest";
import type { CanvasActionElement } from "../actions/canvasActions";
import { buildCanvasContextMenuItems } from "./canvasContextMenuProviders";

function element(
  id: string,
  type = "Button",
  overrides: Partial<CanvasActionElement> = {},
): CanvasActionElement {
  return {
    id,
    type,
    props: {},
    parent_id: "body",
    page_id: "page-1",
    ...overrides,
  };
}

function options(elements: CanvasActionElement[]) {
  const elementsMap = new Map(elements.map((item) => [item.id, item]));
  return { getInteractiveElementsMap: () => elementsMap };
}

describe("canvas context-menu providers", () => {
  it("builds T1 selection actions and hides single-selection-only items for multi-select", () => {
    const items = buildCanvasContextMenuItems(
      {
        clientX: 100,
        clientY: 120,
        scenePoint: { x: 20, y: 30 },
        surface: "canvas-element",
        targetElementIds: ["first", "second"],
      },
      options([element("first"), element("second")]),
    );

    expect(items.map((item) => item.id)).toEqual([
      "copy",
      "paste",
      "duplicate",
      "selection-separator",
      "group",
      "align",
      "delete-separator",
      "delete",
    ]);
  });

  it("builds component and detach actions for a single target", () => {
    const items = buildCanvasContextMenuItems(
      {
        clientX: 100,
        clientY: 120,
        surface: "canvas-element",
        targetElementIds: ["instance"],
      },
      options([
        element("instance", "ref", {
          ref: "origin",
          componentName: "Button instance",
        } as Partial<CanvasActionElement> & { ref: string }),
        element("origin", "Button", {
          reusable: true,
        } as Partial<CanvasActionElement>),
      ]),
    );

    expect(items.map((item) => item.id)).toContain("toggle-component-origin");
    expect(items.map((item) => item.id)).toContain("go-to-origin");
    expect(items.map((item) => item.id)).toContain("detach-instance");
    expect(items.at(-1)?.id).toBe("delete");
  });

  it("builds T2 viewport and canvas setting actions", () => {
    const items = buildCanvasContextMenuItems(
      {
        clientX: 100,
        clientY: 120,
        scenePoint: { x: 20, y: 30 },
        surface: "canvas-empty",
        targetElementIds: [],
      },
      options([]),
    );

    expect(items.map((item) => item.id)).toEqual([
      "paste",
      "viewport-separator",
      "zoom-to-fit",
      "zoom-100",
      "settings-separator",
      "show-rulers",
      "snap-to-objects",
    ]);
  });
});
