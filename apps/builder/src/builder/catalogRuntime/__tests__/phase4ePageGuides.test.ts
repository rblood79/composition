import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogDeleteGuideCommand,
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
