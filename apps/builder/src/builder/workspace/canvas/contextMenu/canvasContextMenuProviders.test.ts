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

  it("builds the z-order cluster for a single target with siblings (ADR-182 T1 #4~#7)", () => {
    const items = buildCanvasContextMenuItems(
      {
        clientX: 100,
        clientY: 120,
        surface: "canvas-element",
        targetElementIds: ["first"],
      },
      options([element("first"), element("second")]),
    );

    expect(items.map((item) => item.id)).toEqual([
      "copy",
      "paste",
      "duplicate",
      "selection-separator",
      "z-order-separator",
      "bring-to-front",
      "bring-forward",
      "send-backward",
      "send-to-back",
      // 단일 선택 group 은 결정적 no-op 이라 만들지 않는다 (code-review #10).
      // 여기는 provider 원본이라 붕 뜬 structure-separator 가 남아 있고,
      // 실제 메뉴에서는 조립 지점의 `dropEmptySeparators` 가 걷어낸다.
      "structure-separator",
      "component-separator",
      "toggle-component-origin",
      "delete-separator",
      "delete",
    ]);
  });

  // 2026-08-27 code-review #10 — `distributeSelection` 은 3개 미만에서 즉시
  // return 이라 2개 선택의 분배 버튼은 피드백 0 인 dead 버튼이었다.
  it("2개 선택에서는 분배 항목을 만들지 않는다 (3개부터)", () => {
    const alignSubmenu = (ids: string[]) => {
      const items = buildCanvasContextMenuItems(
        {
          clientX: 0,
          clientY: 0,
          surface: "canvas-element",
          targetElementIds: ids,
        },
        options(ids.map((id) => element(id))),
      );
      const align = items.find((item) => item.id === "align");
      return align?.kind === "submenu" ? align.items.map((i) => i.id) : [];
    };

    const two = alignSubmenu(["a", "b"]);
    expect(two).toEqual([
      "align-left",
      "align-center",
      "align-right",
      "align-top",
      "align-middle",
      "align-bottom",
    ]);
    expect(two).not.toContain("align-distribute-separator");

    const three = alignSubmenu(["a", "b", "c"]);
    expect(three).toContain("distribute-horizontal");
    expect(three).toContain("distribute-vertical");
    expect(three).toContain("align-distribute-separator");
  });

  // 2026-08-27 code-review #10 — `groupSelection` 은 `multiSelectMode &&
  // length >= 2` 에서만 실행한다. 단일 선택 group 은 결정적 no-op 이었다.
  it("단일 선택에는 group 을 만들지 않는다 (2개부터)", () => {
    const ids = (targets: string[], pool: string[]) =>
      buildCanvasContextMenuItems(
        {
          clientX: 0,
          clientY: 0,
          surface: "canvas-element",
          targetElementIds: targets,
        },
        options(pool.map((id) => element(id))),
      ).map((item) => item.id);

    expect(ids(["first"], ["first", "second"])).not.toContain("group");
    expect(ids(["first", "second"], ["first", "second"])).toContain("group");
  });

  it("hides the z-order cluster when the target has no sibling", () => {
    const items = buildCanvasContextMenuItems(
      {
        clientX: 100,
        clientY: 120,
        surface: "canvas-element",
        targetElementIds: ["only"],
      },
      options([element("only")]),
    );

    expect(items.map((item) => item.id)).not.toContain("bring-to-front");
    expect(items.map((item) => item.id)).not.toContain("send-to-back");
  });

  it("hides the z-order cluster for multi-selection and projected ids", () => {
    const multi = buildCanvasContextMenuItems(
      {
        clientX: 100,
        clientY: 120,
        surface: "canvas-element",
        targetElementIds: ["first", "second"],
      },
      options([element("first"), element("second")]),
    );
    expect(multi.map((item) => item.id)).not.toContain("bring-to-front");

    const projectedId = "page-1::page-frame::slot";
    const projected = buildCanvasContextMenuItems(
      {
        clientX: 100,
        clientY: 120,
        surface: "canvas-element",
        targetElementIds: [projectedId],
      },
      options([element(projectedId), element("sibling")]),
    );
    expect(projected.map((item) => item.id)).not.toContain("bring-to-front");
  });

  it("marks Delete as destructive (Pen model)", () => {
    const items = buildCanvasContextMenuItems(
      {
        clientX: 100,
        clientY: 120,
        surface: "canvas-element",
        targetElementIds: ["first"],
      },
      options([element("first")]),
    );

    const deleteItem = items.find((item) => item.id === "delete");
    expect(deleteItem).toMatchObject({ kind: "action", destructive: true });
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
