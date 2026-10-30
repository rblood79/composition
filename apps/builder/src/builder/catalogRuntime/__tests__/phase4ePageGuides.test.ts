import "fake-indexeddb/auto";
import { act, cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Canvas, CanvasKit } from "canvaskit-wasm";
import { createPage } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogDeleteGuideCommand,
  catalogDeleteGuidesByAxisCommand,
  catalogGuidesCommand,
  catalogGuideDragAt,
  catalogGuideDragCommand,
  catalogGuidesByPage,
  catalogGuideSnapLines,
  catalogGuideTargets,
  catalogPageGuides,
} from "../pageGuides";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { CatalogGuideRulerLabel } from "../../workspace/canvas/catalog/CatalogGuideRulerLabel";
import {
  publishViewportPresentation,
  resetViewportPresentation,
} from "../../workspace/canvas/viewport/viewportPresentation";
import {
  beginGuideDrag,
  endGuideDrag,
  publishGuideDrag,
  resetGuideDragForTest,
} from "../../workspace/canvas/interaction/guidePresentation";
import { bindCatalogGuides } from "../../workspace/canvas/catalog/catalogGuides";
import { renderGuideExtension } from "../../workspace/canvas/skia/guideRenderer";
import { useBuilderUiStore } from "../../stores/builderUiStore";
import {
  clearGuideSelection,
  resetGuideEmphasisForTest,
  setSelectedGuide,
  setHoveredGuide,
} from "../../workspace/canvas/interaction/guideEmphasis";

vi.mock("../../workspace/canvas/skia/guideRenderer", () => ({
  renderGuideExtension: vi.fn(),
  renderPageGuides: vi.fn(),
  renderGuideDragPreview: vi.fn(),
}));

afterEach(() => {
  cleanup();
  resetGuideDragForTest();
  resetViewportPresentation();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  resetGuideEmphasisForTest();
  useBuilderUiStore.getState().setShowRulers(false);
});

/**
 * ADR-248 4e manual guides (ADR-181) over the catalog document: a guide lives in its page's
 * `guideEntries` at a breakpoint (page-local px); a finished drag is one `updatePage` step.
 */
async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:guides" as EntryId<"project">,
        name: "Guides",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e-guides-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId);
  const pageId = (
    project?.kind === "project" ? project.pageIds[0] : ""
  ) as string;
  return { workspace, graph, pageId };
}

const create = (
  pageId: string | null,
  position: number,
  axis: "x" | "y" = "x",
) => ({
  kind: "create" as const,
  guideId: "g1",
  axis,
  pageId,
  position,
  removing: false,
  originPageId: null,
});

describe("ADR-248 4e manual guides", () => {
  it.each(["x", "y"] as const)(
    "새 %s 안내선은 페이지 밖 생성부터 수치를 표시하고 취소 시 복원한다",
    async (axis) => {
      const { workspace, graph, pageId } = await open();
      vi.spyOn(workspace.root, "pageFrameRects").mockReturnValue(
        new Map([[pageId, { x: 100, y: 100, width: 300, height: 300 }]]),
      );
      useBuilderUiStore.getState().setShowRulers(true);
      publishViewportPresentation({ x: 40, y: 60, scale: 2 });
      const { container, unmount } = render(
        createElement(CatalogGuideRulerLabel, { workspace }),
      );
      const label = container.querySelector<HTMLSpanElement>(
        ".ruler-guide-position",
      )!;
      try {
        act(() =>
          beginGuideDrag({
            ...create(null, 0, axis),
            originPosition: 0,
            scenePosition: 80,
          }),
        );
        expect(label.hidden).toBe(false);
        expect(label.textContent).toBe("-20");
        expect(label.dataset.axis).toBe(axis);
        expect(label.style.transform).toBe(
          axis === "x" ? "translateX(203px)" : "translateY(223px)",
        );
        act(() =>
          publishGuideDrag({ pageId, position: 45, scenePosition: 145 }),
        );
        expect(label.hidden).toBe(false);
        expect(label.textContent).toBe("45");
        expect(label.style.transform).toBe(
          axis === "x" ? "translateX(333px)" : "translateY(353px)",
        );
        expect(catalogPageGuides(graph, pageId, "desktop")).toHaveLength(0);
        act(() =>
          publishGuideDrag({ pageId: null, position: 0, scenePosition: 420 }),
        );
        expect(label.hidden).toBe(false);
        expect(label.textContent).toBe("320");
        act(() => endGuideDrag());
        expect(label.hidden).toBe(true);
        expect(catalogPageGuides(graph, pageId, "desktop")).toHaveLength(0);
      } finally {
        unmount();
        workspace.dispose();
      }
    },
  );

  it("축별 제거는 한 step이며 다른 축·breakpoint를 보존하고 Undo/Redo가 복원한다", async () => {
    const { workspace, graph, pageId } = await open();
    const lines = [
      { id: "x1", axis: "x" as const, position: 50 },
      { id: "x2", axis: "x" as const, position: 100 },
      { id: "y1", axis: "y" as const, position: 70 },
    ];
    workspace.execute(
      catalogGuidesCommand(graph, pageId, "desktop", lines, "fixture")!,
    );
    workspace.execute(
      catalogGuidesCommand(graph, pageId, "mobile", lines, "fixture")!,
    );
    const before = workspace.history.getSnapshot().applied;
    workspace.execute(
      catalogDeleteGuidesByAxisCommand(graph, pageId, "x", "desktop")!,
    );
    expect(workspace.history.getSnapshot().applied).toBe(before + 1);
    expect(catalogPageGuides(graph, pageId, "desktop")).toEqual([lines[2]]);
    expect(catalogPageGuides(graph, pageId, "mobile")).toEqual(lines);
    expect(
      catalogDeleteGuidesByAxisCommand(graph, pageId, "x", "desktop"),
    ).toBeUndefined();
    workspace.undo();
    expect(catalogPageGuides(graph, pageId, "desktop")).toEqual(lines);
    workspace.redo();
    expect(catalogPageGuides(graph, pageId, "desktop")).toEqual([lines[2]]);
    workspace.dispose();
  });

  it("활성 페이지는 선택 해제 후에도 연장되며 페이지 전환·개별/일괄 메뉴가 올바른 대상을 따른다", async () => {
    const { workspace, graph, pageId } = await open();
    const second = "project:page:guide-second" as EntryId<"page">;
    workspace.execute(
      createPage({
        page: {
          kind: "page",
          id: second,
          name: "Second",
          route: "/second",
          children: [],
        },
      }),
    );
    for (const id of [pageId, second]) {
      workspace.execute(
        catalogGuidesCommand(
          graph,
          id,
          "desktop",
          [
            { id: "gx", axis: "x", position: 50 },
            { id: "gy", axis: "y", position: 70 },
          ],
          "fixture",
        )!,
      );
    }
    vi.spyOn(workspace.root, "pageFrameRects").mockReturnValue(
      new Map([
        [pageId, { x: 100, y: 100, width: 300, height: 300 }],
        [second, { x: 500, y: 100, width: 300, height: 300 }],
      ]),
    );
    useBuilderUiStore.getState().setShowRulers(true);
    const invalidate = vi.fn();
    const error = vi.fn();
    const binding = bindCatalogGuides({
      workspace,
      canvas: document.createElement("canvas"),
      scenePoint: (event) => ({ x: event.clientX, y: event.clientY }),
      zoom: () => 1,
      viewport: () => ({ x: 0, y: 0, width: 1000, height: 800 }),
      invalidateOverlay: invalidate,
      onError: error,
    });
    try {
      setSelectedGuide({ pageId, guideId: "gx" });
      clearGuideSelection(); // 페이지·요소 클릭과 같은 선택 해제.
      binding.paint({} as CanvasKit, {} as Canvas);
      expect(
        vi.mocked(renderGuideExtension).mock.calls.map((args) => args[3].x),
      ).toEqual([100, 100]);
      const bulk = binding.rulerMenu("x")[0];
      workspace.session.setPage(second);
      vi.mocked(renderGuideExtension).mockClear();
      binding.paint({} as CanvasKit, {} as Canvas);
      expect(
        vi.mocked(renderGuideExtension).mock.calls.map((args) => args[3].x),
      ).toEqual([500, 500]);
      expect(invalidate).toHaveBeenCalled();
      // 메뉴를 연 뒤 활성 페이지가 바뀌어도 원래 페이지/축만 제거한다.
      if (bulk.kind !== "action") throw new Error("missing action");
      expect(bulk.labelKey).toBe("contextMenu.deleteVerticalGuides");
      await bulk.run();
      expect(
        catalogPageGuides(graph, pageId, "desktop").map((g) => g.id),
      ).toEqual(["gy"]);
      expect(catalogPageGuides(graph, second, "desktop")).toHaveLength(2);
      // 페이지 밖 점선도 같은 가이드로 잡히며 우클릭 삭제는 한 안내선만 제거한다.
      expect(
        binding.hover(
          new MouseEvent("pointermove", {
            clientX: 550,
            clientY: 30,
          }) as PointerEvent,
        ),
      ).toBe("col-resize");
      const single = binding.contextMenu(
        new MouseEvent("contextmenu", { clientX: 550, clientY: 30 }),
      )[0];
      if (single.kind !== "action") throw new Error("missing action");
      expect(single.labelKey).toBe("contextMenu.deleteGuide");
      await single.run();
      expect(
        catalogPageGuides(graph, second, "desktop").map((g) => g.id),
      ).toEqual(["gy"]);
      workspace.undo();
      expect(catalogPageGuides(graph, second, "desktop")).toHaveLength(2);
      expect(binding.rulerMenu("y")[0]).toMatchObject({
        labelKey: "contextMenu.deleteHorizontalGuides",
      });
      expect(error).not.toHaveBeenCalled();
    } finally {
      binding.dispose();
      workspace.dispose();
    }
  });

  it("눈금자 수치는 hover부터 붉게 표시하고 선택·팬·드래그·Undo·삭제를 따른다", async () => {
    const { workspace, graph, pageId } = await open();
    workspace.execute(
      catalogGuidesCommand(
        graph,
        pageId,
        "desktop",
        [
          { id: "gx", axis: "x", position: 125 },
          { id: "gy", axis: "y", position: 75 },
        ],
        "fixture",
      )!,
    );
    vi.spyOn(workspace.root, "pageFrameRects").mockReturnValue(
      new Map([[pageId, { x: 100, y: 100, width: 300, height: 300 }]]),
    );
    useBuilderUiStore.getState().setShowRulers(true);
    const { container, unmount } = render(
      createElement(CatalogGuideRulerLabel, { workspace }),
    );
    const label = container.querySelector<HTMLSpanElement>(
      ".ruler-guide-position",
    )!;
    const markers = () => [
      ...container.querySelectorAll<HTMLElement>(".ruler-guide-line"),
    ];
    const markerAt = (axis: string) =>
      markers().find((marker) => marker.dataset.axis === axis)!;
    try {
      expect(label.hidden).toBe(true);
      expect(markers()).toHaveLength(2);
      expect(markerAt("x").style.transform).toBe("translateX(225px)");
      expect(markerAt("y").style.transform).toBe("translateY(175px)");
      act(() => setHoveredGuide({ pageId, guideId: "gx" }));
      expect(label.hidden).toBe(false);
      expect(label.textContent).toBe("125");
      expect(label.style.color).toBe("rgb(242, 72, 34)");
      act(() => setHoveredGuide(null));
      expect(label.hidden).toBe(true);
      act(() => {
        setSelectedGuide({ pageId, guideId: "gx" });
        publishViewportPresentation({ x: 40, y: 60, scale: 2 });
      });
      expect(label.hidden).toBe(false);
      expect(label.textContent).toBe("125");
      expect(label.dataset.axis).toBe("x");
      expect(label.style.transform).toBe("translateX(493px)");
      expect(markerAt("x").style.transform).toBe("translateX(490px)");
      expect(markerAt("y").style.transform).toBe("translateY(410px)");
      act(() => setSelectedGuide({ pageId, guideId: "gy" }));
      expect(container.querySelectorAll(".ruler-guide-position")).toHaveLength(
        1,
      );
      expect(label.textContent).toBe("75");
      expect(label.dataset.axis).toBe("y");
      expect(label.style.transform).toBe("translateY(413px)");
      act(() => setHoveredGuide({ pageId, guideId: "gx" }));
      expect(label.textContent).toBe("125");
      expect(label.dataset.axis).toBe("x");
      act(() => setHoveredGuide(null));
      expect(label.textContent).toBe("75");
      act(() =>
        beginGuideDrag({
          kind: "move",
          guideId: "gy",
          axis: "y",
          pageId,
          position: 90,
          removing: false,
          originPageId: pageId,
          originPosition: 75,
          scenePosition: 190,
        }),
      );
      expect(label.textContent).toBe("90");
      expect(label.style.transform).toBe("translateY(443px)");
      expect(markerAt("y").style.transform).toBe("translateY(440px)");
      act(() => endGuideDrag());
      expect(label.textContent).toBe("75");
      act(() =>
        workspace.execute(
          catalogGuideDragCommand(
            graph,
            {
              ...create(pageId, 100, "y"),
              guideId: "gy",
              kind: "move",
              originPageId: pageId,
            },
            "desktop",
          )!,
        ),
      );
      expect(label.textContent).toBe("100");
      act(() => workspace.undo());
      expect(label.textContent).toBe("75");
      act(() =>
        workspace.execute(
          catalogDeleteGuideCommand(graph, pageId, "gy", "desktop")!,
        ),
      );
      expect(label.hidden).toBe(true);
      expect(markers()).toHaveLength(1);
      act(() => workspace.undo());
      expect(label.hidden).toBe(false);
      expect(markers()).toHaveLength(2);
      act(() => workspace.session.setBreakpoint("mobile"));
      expect(label.hidden).toBe(true);
      act(() => workspace.session.setBreakpoint("desktop"));
      expect(label.hidden).toBe(false);
      act(() => clearGuideSelection());
      expect(label.hidden).toBe(true);
      expect(markers()).toHaveLength(2);
      const second = "project:page:ruler-marker-second" as EntryId<"page">;
      act(() => {
        workspace.execute(
          createPage({
            page: {
              kind: "page",
              id: second,
              name: "Second",
              route: "/second",
              children: [],
            },
          }),
        );
        workspace.session.setPage(second);
      });
      expect(markers()).toHaveLength(0);
    } finally {
      unmount();
      workspace.dispose();
    }
  });

  it.each(["x", "y"] as const)(
    "%s 안내선은 실선·점선에서 이동 커서를 보이고 재드래그를 한 번만 저장한다",
    async (axis) => {
      const { workspace, graph, pageId } = await open();
      workspace.execute(
        catalogGuideDragCommand(graph, create(pageId, 50, axis), "desktop")!,
      );
      vi.spyOn(workspace.root, "pageFrameRects").mockReturnValue(
        new Map([[pageId, { x: 100, y: 100, width: 300, height: 300 }]]),
      );
      const canvas = document.createElement("canvas");
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => canvas;
      useBuilderUiStore.getState().setShowRulers(true);
      const error = vi.fn();
      const binding = bindCatalogGuides({
        workspace,
        canvas,
        scenePoint: (event) => ({ x: event.clientX, y: event.clientY }),
        zoom: () => 1,
        viewport: () => ({ x: 0, y: 0, width: 1000, height: 800 }),
        invalidateOverlay: vi.fn(),
        onError: error,
      });
      const pointer = (type: string, position: number, along: number) => {
        const event = new MouseEvent(type, {
          clientX: axis === "x" ? position : along,
          clientY: axis === "y" ? position : along,
        });
        Object.defineProperty(event, "pointerId", { value: 7 });
        return event as PointerEvent;
      };
      try {
        for (const along of [200, 30]) {
          const before = workspace.history.getSnapshot().applied;
          expect(binding.hover(pointer("pointermove", 150, along))).toBe(
            axis === "x" ? "col-resize" : "row-resize",
          );
          expect(binding.press(pointer("pointerdown", 150, along))).toBe(true);
          window.dispatchEvent(pointer("pointermove", 190, along));
          expect(catalogPageGuides(graph, pageId, "desktop")[0].position).toBe(
            50,
          );
          expect(workspace.history.getSnapshot().applied).toBe(before);
          window.dispatchEvent(pointer("pointerup", 190, along));
          expect(catalogPageGuides(graph, pageId, "desktop")[0].position).toBe(
            90,
          );
          expect(workspace.history.getSnapshot().applied).toBe(before + 1);
          workspace.undo();
          expect(catalogPageGuides(graph, pageId, "desktop")[0].position).toBe(
            50,
          );
        }
        expect(error).not.toHaveBeenCalled();
      } finally {
        binding.dispose();
        document.elementFromPoint = originalElementFromPoint;
        workspace.dispose();
      }
    },
  );

  it("a create, move and delete drag are one step each; undo restores; breakpoints are separate", async () => {
    const { workspace, graph, pageId } = await open();
    workspace.execute(
      catalogGuideDragCommand(graph, create(pageId, 120), "desktop")!,
    );
    expect(catalogPageGuides(graph, pageId, "desktop")).toEqual([
      { id: "g1", axis: "x", position: 120 },
    ]);
    expect(catalogPageGuides(graph, pageId, "mobile")).toEqual([]);
    const move = {
      ...create(pageId, 300),
      kind: "move" as const,
      originPageId: pageId,
    };
    workspace.execute(catalogGuideDragCommand(graph, move, "desktop")!);
    expect(catalogPageGuides(graph, pageId, "desktop")[0].position).toBe(300);
    // A drag back to its place is no step.
    expect(catalogGuideDragCommand(graph, move, "desktop")).toBeUndefined();
    workspace.undo();
    expect(catalogPageGuides(graph, pageId, "desktop")[0].position).toBe(120);
    workspace.execute(
      catalogGuideDragCommand(graph, { ...move, removing: true }, "desktop")!,
    );
    expect(catalogGuidesByPage(graph, "desktop").size).toBe(0);
    // The last guide removed clears the field (no empty breakpoint lists stay).
    const page = graph.getEntry(pageId);
    expect(page?.kind === "page" && page.guideEntries).toBeFalsy();
    workspace.undo();
    expect(catalogPageGuides(graph, pageId, "desktop")).toHaveLength(1);
    // A create dropped off every page makes nothing; Delete removes a selected guide.
    expect(
      catalogGuideDragCommand(graph, create(null, 5), "desktop"),
    ).toBeUndefined();
    workspace.execute(
      catalogDeleteGuideCommand(graph, pageId, "g1", "desktop")!,
    );
    expect(catalogPageGuides(graph, pageId, "desktop")).toEqual([]);
    workspace.dispose();
  });

  it("the drag state follows the pointer: page-local, off-page and over-ruler cases", () => {
    const frames = new Map([
      ["p1", { x: 100, y: 50, width: 400, height: 300 }],
      ["p2", { x: 600, y: 50, width: 400, height: 300 }],
    ]);
    const createDrag = {
      kind: "create" as const,
      axis: "x" as const,
      originPageId: null,
    };
    expect(
      catalogGuideDragAt(createDrag, { x: 700.4, y: 60 }, false, frames),
    ).toEqual({
      pageId: "p2",
      position: 100,
      removing: false,
      scenePosition: 700.4,
    });
    expect(
      catalogGuideDragAt(createDrag, { x: 550, y: 60 }, false, frames).pageId,
    ).toBeNull();
    expect(
      catalogGuideDragAt(createDrag, { x: 150, y: 60 }, true, frames).pageId,
    ).toBeNull();
    const moveDrag = {
      kind: "move" as const,
      axis: "y" as const,
      originPageId: "p1",
    };
    // A move keeps its page (even over another page) and past its edge it deletes.
    expect(
      catalogGuideDragAt(moveDrag, { x: 700, y: 200 }, false, frames),
    ).toMatchObject({
      pageId: "p1",
      position: 150,
      removing: false,
    });
    expect(
      catalogGuideDragAt(moveDrag, { x: 150, y: 400 }, false, frames).removing,
    ).toBe(true);
    expect(
      catalogGuideDragAt(moveDrag, { x: 150, y: 60 }, true, frames).removing,
    ).toBe(true);
    // Snap lines are the guides at their frames, without the dragged page's own.
    const guidesByPage = new Map([
      ["p1", [{ id: "a", axis: "x" as const, position: 10 }]],
      ["p2", [{ id: "b", axis: "y" as const, position: 5 }]],
    ]);
    expect(catalogGuideSnapLines(guidesByPage, frames)).toEqual({
      x: [110],
      y: [55],
    });
    expect(
      catalogGuideSnapLines(guidesByPage, frames, new Set(["p2"])),
    ).toEqual({ x: [110], y: [] });
    // Paint targets are scene lines clipped to the page frame.
    expect(
      catalogGuideTargets(
        new Map([["p2", [{ id: "a", axis: "y" as const, position: 20 }]]]),
        frames,
      ),
    ).toEqual([
      {
        pageId: "p2",
        pageRect: { x: 600, y: 50, width: 400, height: 300 },
        lines: [{ id: "a", axis: "y", position: 70 }],
      },
    ]);
  });
});
