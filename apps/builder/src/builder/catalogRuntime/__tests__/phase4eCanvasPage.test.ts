import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { createPage } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogCanvasGestures } from "../canvasGesture";
import { catalogPageDropCommand } from "../canvasPage";
import { runCatalogShortcut } from "../shortcuts";
import { pickTopmostRecord } from "../canvasPick";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-3b page frame drag: dropping a page frame commits the old Builder's placement
 * rule over the catalog pages — off the grid it is placed freely (one step, undo returns it); the
 * home page and the first cell stay. The drag itself only previews (the ghost frame).
 */
const PROJECT = "project:project:pages" as EntryId<"project">;
const HOME = "project:page:home" as EntryId<"page">;
const SECOND = "project:page:second" as EntryId<"page">;
const SECOND_BODY = "project:node:second-body" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Pages" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-pages-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    createPage({
      page: {
        kind: "page",
        id: SECOND,
        route: "/second",
        name: "Second",
        children: [SECOND_BODY],
      },
      entries: [
        {
          kind: "node",
          id: SECOND_BODY,
          definitionId: "lib:definition:type-body",
          name: "Body",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
    }),
  );
  const scene = new CatalogCanvasScene(workspace.root);
  const frame = (page: EntryId<"page">) =>
    workspace.root.pageFrameRects().get(page)!;
  const placement = () => {
    const entry = workspace.runtime.graph.getEntry(SECOND);
    return entry?.kind === "page" ? entry.placement : undefined;
  };
  return { workspace, scene, frame, placement };
}

describe("ADR-248 Phase 4e-3b page frame drag", () => {
  it("off the grid a page is placed freely (one step, undo); the home page and the first cell stay", async () => {
    const { workspace, scene, frame, placement } = await open();
    const second = frame(SECOND);
    const secondBody = workspace.root.recordsOfSource(SECOND_BODY)[0];
    expect(second.x).toBeGreaterThan(0);
    expect(
      catalogPageDropCommand(workspace.root, HOME, { x: 0, y: 3000 }),
    ).toBeUndefined();
    // The first cell is the home page's flow origin.
    expect(
      catalogPageDropCommand(workspace.root, SECOND, { x: 0, y: 0 }),
    ).toBeUndefined();

    const revision = workspace.runtime.graph.revision;
    workspace.execute(
      catalogPageDropCommand(workspace.root, SECOND, { x: 40, y: -3000 })!,
    );
    expect(placement()).toEqual({
      base: { position: "absolute", left: 40, top: -3000 },
      breakpoints: {},
    });
    expect(frame(SECOND)).toMatchObject({ x: 40, y: -3000 });
    // The Canvas scene follows the moved frame (the page root's frame changed: it binds again).
    expect(scene.sync().kind).not.toBe("unchanged");
    expect(scene.stream.boundsMap.get(secondBody)).toMatchObject({
      x: 40,
      y: -3000,
    });
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    workspace.undo();
    expect(placement()).toBeUndefined();
    expect(frame(SECOND)).toMatchObject({ x: second.x, y: second.y });
  });

  it("the gesture previews the ghost frame and commits the drop; the home page does not start one", async () => {
    const { workspace, scene, frame, placement } = await open();
    const secondBody = workspace.root.recordsOfSource(SECOND_BODY)[0];
    const homeBody = workspace.root.recordsOfSource(
      "project:node:home-body",
    )[0];
    const gestures = new CatalogCanvasGestures({
      get records() {
        return workspace.root.domInputs;
      },
      graph: workspace.runtime.graph,
      bounds: (record) => scene.stream.boundsMap.get(record),
      pick: (x, y) =>
        pickTopmostRecord(scene.stream, x, y, scene.stream.hitBoundsMap.keys()),
      selection: () => workspace.session.getSnapshot().selection,
      editingContext: () => undefined,
      selectRecords: (ids) => workspace.selectRecords(ids),
      breakpoint: () => "desktop",
      execute: (command) => {
        workspace.execute(command);
        scene.sync();
      },
      newId: workspace.newId,
      movablePageOf: (record) => (record === secondBody ? SECOND : undefined),
      pageDropCommand: (page, topLeft) =>
        catalogPageDropCommand(
          workspace.root,
          page as EntryId<"page">,
          topLeft,
        ),
    });
    expect(gestures.beginPageDrag(10, 10, homeBody)).toBe(false);
    const start = frame(SECOND);
    expect(gestures.beginPageDrag(start.x + 5, start.y + 5, secondBody)).toBe(
      true,
    );
    gestures.update(start.x + 5, start.y - 4000, 1);
    expect(gestures.preview()?.ghost).toMatchObject({
      x: start.x,
      y: start.y - 4005,
    });
    expect(workspace.runtime.graph.getEntry(SECOND)).not.toHaveProperty(
      "placement",
    );
    gestures.finish();
    expect(placement()?.base).toMatchObject({
      position: "absolute",
      top: start.y - 4005,
    });
  });

  it("arrows on a selected page move its frame (1px, Shift 10px) by the drop rule; the home page stays", async () => {
    const { workspace, frame } = await open();
    const steps = () => workspace.runtime.historyDepth.undo;
    // A grid page nudged within its cell lands where it is: no step.
    workspace.selectRecords([workspace.root.recordsOfSource(SECOND_BODY)[0]]);
    const pinned = steps();
    expect(runCatalogShortcut(workspace, "arrowRight")).toBe(true);
    const settled = steps();
    expect(runCatalogShortcut(workspace, "arrowRight")).toBe(false);
    expect(steps()).toBe(settled);
    expect(settled - pinned).toBeLessThanOrEqual(1);
    // Placed off the grid (a grid page snaps back to its cell, as the old nudge did).
    workspace.execute(
      catalogPageDropCommand(workspace.root, SECOND, { x: 40, y: -3000 })!,
    );
    const start = frame(SECOND);
    workspace.selectRecords([workspace.root.recordsOfSource(SECOND_BODY)[0]]);
    const before = steps();
    expect(runCatalogShortcut(workspace, "arrowRight")).toBe(true);
    expect(frame(SECOND)).toMatchObject({ x: start.x + 1, y: start.y });
    expect(runCatalogShortcut(workspace, "arrowDownShift")).toBe(true);
    expect(frame(SECOND)).toMatchObject({ x: start.x + 1, y: start.y + 10 });
    expect(steps()).toBe(before + 2);
    workspace.undo();
    workspace.undo();
    expect(frame(SECOND)).toMatchObject({ x: start.x, y: start.y });
    // The home page stays (no step).
    const home = workspace.runtime.graph.getEntry(HOME);
    const homeBody = home?.kind === "page" ? home.children[0] : undefined;
    workspace.selectRecords([workspace.root.recordsOfSource(homeBody!)[0]]);
    expect(runCatalogShortcut(workspace, "arrowLeft")).toBe(false);
    expect(steps()).toBe(before);
  });
});
