import { afterEach, describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import { setDragVisualOffset } from "./nodeRendererTree";
import { buildRenderCommandStream } from "./renderCommands";
import type { SkiaNodeData } from "./nodeRenderers";

function makeElement(
  id: string,
  overrides: Partial<CanvasSceneNode> = {},
): CanvasSceneNode {
  return {
    id,
    type: "Box",
    page_id: "page-1",
    parent_id: null,
    order_num: 0,
    props: {},
    deleted: false,
    ...overrides,
  } as CanvasSceneNode;
}

function registerNode(id: string, overrides: Partial<SkiaNodeData> = {}): void {
  registerSkiaNode(id, {
    elementId: id,
    height: 100,
    type: "container",
    visible: true,
    width: 100,
    x: 0,
    y: 0,
    ...overrides,
  } as SkiaNodeData);
}

function elementCommandIds(commands: unknown[]): string[] {
  return commands
    .map((command) =>
      typeof command === "object" && command !== null
        ? (command as { elementId?: unknown }).elementId
        : undefined,
    )
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

describe("buildRenderCommandStream drag top layer", () => {
  afterEach(() => {
    setDragVisualOffset(null, 0, 0, true);
    clearSkiaRegistry();
  });

  it("renders the dragged subtree after all page roots", () => {
    const page1Body = makeElement("page-1-body", {
      type: "body",
      page_id: "page-1",
    });
    const page2Body = makeElement("page-2-body", {
      type: "body",
      page_id: "page-2",
    });
    const source = makeElement("source-card", {
      parent_id: page1Body.id,
      page_id: "page-1",
    });

    registerNode(page1Body.id);
    registerNode(page2Body.id);
    registerNode(source.id);
    setDragVisualOffset(source.id, 900, 0, true);

    const stream = buildRenderCommandStream(
      [page1Body.id, page2Body.id],
      new Map([[page1Body.id, [source]]]),
      new Map([[source.id, { x: 24, y: 32, width: 160, height: 120 }]]),
      {
        [page1Body.id]: { x: 0, y: 0 },
        [page2Body.id]: { x: 900, y: 0 },
      },
    );

    expect(elementCommandIds(stream.commands)).toEqual([
      page1Body.id,
      page2Body.id,
      source.id,
    ]);
  });

  it("exposes only marked internal Skia children as hit-test owners", () => {
    registerNode("tabs", {
      width: 240,
      height: 120,
      children: [
        {
          type: "box",
          elementId: "panel-overview",
          hitTestOwner: true,
          x: 12,
          y: 44,
          width: 180,
          height: 60,
          visible: true,
          box: {
            fillColor: Float32Array.of(1, 1, 1, 1),
            borderRadius: 0,
          },
        },
        {
          type: "box",
          elementId: "tabs:panel:bg",
          x: 12,
          y: 44,
          width: 180,
          height: 60,
          visible: true,
          box: {
            fillColor: Float32Array.of(1, 1, 1, 1),
            borderRadius: 0,
          },
        },
      ],
    });

    const stream = buildRenderCommandStream(
      ["tabs"],
      new Map(),
      new Map([
        ["tabs", { elementId: "tabs", x: 20, y: 30, width: 240, height: 120 }],
      ]),
      {},
    );

    expect(stream.boundsMap.get("panel-overview")).toEqual({
      x: 32,
      y: 74,
      width: 180,
      height: 60,
    });
    expect(stream.boundsMap.has("tabs:panel:bg")).toBe(false);
  });

  it("exposes canonical owner paths for hit-test owners (ADR-144 G4)", () => {
    registerNode("tabs", {
      width: 240,
      height: 120,
      children: [
        {
          type: "box",
          elementId: "tab-label",
          hitTestOwner: true,
          ownerPath: "tabs/tablist-instance/tab-ref-overview/tab-label",
          x: 0,
          y: 0,
          width: 90,
          height: 36,
          visible: true,
          box: {
            fillColor: Float32Array.of(1, 1, 1, 1),
            borderRadius: 0,
          },
        },
        {
          type: "box",
          elementId: "panel-overview",
          hitTestOwner: true,
          // ownerPath 미설정 — elementId 자체로 fallback (단일 origin child case)
          x: 12,
          y: 44,
          width: 180,
          height: 60,
          visible: true,
          box: {
            fillColor: Float32Array.of(1, 1, 1, 1),
            borderRadius: 0,
          },
        },
        {
          type: "box",
          elementId: "tabs:panel:bg",
          x: 12,
          y: 44,
          width: 180,
          height: 60,
          visible: true,
          box: {
            fillColor: Float32Array.of(1, 1, 1, 1),
            borderRadius: 0,
          },
        },
      ],
    });

    const stream = buildRenderCommandStream(
      ["tabs"],
      new Map(),
      new Map([
        ["tabs", { elementId: "tabs", x: 20, y: 30, width: 240, height: 120 }],
      ]),
      {},
    );

    // root element: ownerPath = elementId 자체
    expect(stream.ownerPathMap.get("tabs")).toBe("tabs");
    // ref instance descendant origin child: ownerPath 가 ancestor instance chain 포함
    expect(stream.ownerPathMap.get("tab-label")).toBe(
      "tabs/tablist-instance/tab-ref-overview/tab-label",
    );
    // hit-test owner 인데 ownerPath 미지정 → elementId fallback
    expect(stream.ownerPathMap.get("panel-overview")).toBe("panel-overview");
    // synthetic (hitTestOwner=false) → ownerPathMap 미등록 (editable owner 아님)
    expect(stream.ownerPathMap.has("tabs:panel:bg")).toBe(false);
  });
});
