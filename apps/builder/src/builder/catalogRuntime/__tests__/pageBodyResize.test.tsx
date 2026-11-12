// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPage,
  insertNodes,
  setFields,
  updatePage,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogCanvasGestures } from "../canvasGesture";
import { pickTopmostRecord } from "../canvasPick";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A page body's selection box resizes its frame (user 2026-11-13 — 「컴퍼넌트처럼 page 의 selection
 * box 로도 사이즈 조절」): the right handle writes the body's width, the bottom handle the page's
 * Canvas viewport height (`PageEntry.viewportHeights` — Adobe XD's Viewport Height, a Builder view
 * state: Publish and the body's Min H keep theirs — user 2026-11-13) at the active breakpoint; the
 * left · top handles are not there (the frame's top-left is the page's place).
 */
const BODY = "project:node:home-body" as NodeId;
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:page-resize" as EntryId<"project">,
        name: "Page resize",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `page-resize-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  // (A child so the body has content to keep — the frame is not its content.)
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: "project:node:box" as NodeId,
          definitionId: "lib:definition:type-frame",
          children: [],
          props: {},
          visual: {},
          sizing: { height: { kind: "set", value: 100 } },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: ["project:node:box" as NodeId],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const scene = new CatalogCanvasScene(workspace.root);
  const gestures = new CatalogCanvasGestures({
    get records() {
      return workspace.root.domInputs;
    },
    graph: workspace.runtime.graph,
    bounds: (record) => scene.stream.boundsMap.get(record),
    pick: (x, y) =>
      pickTopmostRecord(scene.stream, x, y, scene.stream.hitBoundsMap.keys()),
    selection: () => workspace.session.getSnapshot().selection,
    itemOfRecord: (record) => workspace.itemOfRecord(record),
    editingContext: () => workspace.session.getSnapshot().editingContext,
    selectRecords: (ids, options) => workspace.selectRecords(ids, options),
    breakpoint: () => workspace.session.getSnapshot().breakpoint,
    execute: (command) => {
      workspace.execute(command);
      scene.sync();
    },
    newId: workspace.newId,
    guideLines: () => ({ x: [], y: [] }),
    reflow: (target, patch) => {
      workspace.root.previewRecord(target, patch);
      scene.sync();
    },
  });
  const bodyRecord = () => workspace.root.recordsOfSource(BODY)[0];
  const entry = () => {
    const e = workspace.runtime.graph.getEntry(BODY);
    return e?.kind === "node" ? e : undefined;
  };
  const page = () => {
    const pageId = workspace.runtime.graph.ownerOf(BODY)!;
    const e = workspace.runtime.graph.getEntry(pageId);
    return e?.kind === "page" ? e : undefined;
  };
  const sizingAt = () => {
    const breakpoint = workspace.session.getSnapshot().breakpoint;
    return breakpoint === "desktop"
      ? entry()?.sizing
      : entry()?.responsive?.[breakpoint]?.sizing;
  };
  /** Drag the bottom-right handle by (dx, dy) and release. */
  const dragCorner = (dx: number, dy: number) => {
    workspace.selectRecords([bodyRecord()]);
    scene.sync();
    const start = scene.stream.boundsMap.get(bodyRecord())!;
    const corner = { x: start.x + start.width, y: start.y + start.height };
    expect(gestures.beginResize(corner.x, corner.y, 1)).toBe(true);
    gestures.update(corner.x + dx, corner.y + dy, 1);
    gestures.finish();
    return start;
  };
  return {
    workspace,
    scene,
    gestures,
    bodyRecord,
    entry,
    page,
    sizingAt,
    dragCorner,
  };
}

describe("page body selection box resize = its frame (width · Canvas viewport height)", () => {
  it("drags the bottom-right handle: the body's width and the page's viewport height at the breakpoint in one step, the frame follows live and on release", async () => {
    const { workspace, scene, gestures, bodyRecord, page, sizingAt } =
      await open();
    workspace.selectRecords([bodyRecord()]);
    scene.sync();
    const start = scene.stream.boundsMap.get(bodyRecord())!;
    const corner = { x: start.x + start.width, y: start.y + start.height };
    const revision = workspace.runtime.graph.revision;
    expect(gestures.beginResize(corner.x, corner.y, 1)).toBe(true);
    gestures.update(corner.x - 100, corner.y + 200, 1);
    // Live: the frame takes the drag before the document changes.
    expect(scene.stream.boundsMap.get(bodyRecord())).toMatchObject({
      width: start.width - 100,
      height: start.height + 200,
    });
    expect(workspace.runtime.graph.revision).toBe(revision);
    gestures.finish();
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    const breakpoint = workspace.session.getSnapshot().breakpoint;
    // The height is the page's Canvas viewport — not the body's Min H (Publish does not read it).
    expect(sizingAt()).toEqual({
      width: { kind: "set", value: start.width - 100 },
    });
    expect(page()?.viewportHeights).toEqual({
      [breakpoint]: start.height + 200,
    });
    expect(workspace.root.pageFrameRects().values().next().value).toMatchObject(
      {
        width: start.width - 100,
        height: start.height + 200,
      },
    );
    // One step: undo puts both back.
    workspace.undo();
    scene.sync();
    expect(page()?.viewportHeights).toBeUndefined();
    expect(scene.stream.boundsMap.get(bodyRecord())).toMatchObject({
      width: start.width,
      height: start.height,
    });
  });

  it("a corner dragged straight down writes the viewport height only (the width did not change)", async () => {
    const { workspace, page, dragCorner, sizingAt } = await open();
    const start = dragCorner(0, 150);
    expect(sizingAt()?.width).toBeUndefined();
    expect(page()?.viewportHeights).toEqual({
      [workspace.session.getSnapshot().breakpoint]: start.height + 150,
    });
  });

  it("dragged back to the frame's own height clears the viewport height", async () => {
    const { page, dragCorner } = await open();
    dragCorner(0, 300);
    expect(page()?.viewportHeights).toBeDefined();
    dragCorner(0, -300);
    expect(page()?.viewportHeights).toBeUndefined();
  });

  it("keeps the body's Min H inside a shorter viewport (the content scrolls in the frame)", async () => {
    const { workspace, scene, bodyRecord, page, dragCorner, sizingAt } =
      await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BODY }],
        breakpoint: workspace.session.getSnapshot().breakpoint,
        sizing: { minHeight: { kind: "set", value: 1200 } },
      }),
    );
    scene.sync();
    // Without a viewport height the frame is the Min H.
    expect(scene.stream.boundsMap.get(bodyRecord())?.height).toBe(1200);
    dragCorner(0, -400);
    expect(Object.values(page()?.viewportHeights ?? {})).toEqual([800]);
    // (The frame is the viewport height, not the Min H — the content keeps the Min H.)
    expect(sizingAt()?.minHeight).toEqual({ kind: "set", value: 1200 });
    const content = `${bodyRecord()}::part:page-content`;
    expect(scene.stream.boundsMap.get(bodyRecord())?.height).toBe(800);
    expect(
      workspace.root.getGeometry([content]).get(content)?.height,
    ).toBeGreaterThanOrEqual(1200);
  });

  it("has no left · top handles (the page drag moves the frame)", async () => {
    const { workspace, scene, gestures, bodyRecord } = await open();
    workspace.selectRecords([bodyRecord()]);
    scene.sync();
    const start = scene.stream.boundsMap.get(bodyRecord())!;
    expect(gestures.handleAt(start.x, start.y, 1)).toBeNull();
    expect(gestures.handleAt(start.x + start.width, start.y, 1)).toBeNull();
    expect(gestures.handleAt(start.x, start.y + start.height, 1)).toBeNull();
    expect(
      gestures.handleAt(start.x + start.width, start.y + start.height / 2, 1)
        ?.position,
    ).toBe("middle-right");
  });

  it("Canvas height fit-content: the frame takes the page's whole content and follows it, never under the screen", async () => {
    const { workspace, scene, bodyRecord, page } = await open();
    const breakpoint = workspace.session.getSnapshot().breakpoint;
    const frame = () => scene.stream.boundsMap.get(bodyRecord())!.height;
    const screen = frame();
    workspace.execute(
      updatePage({
        id: page()!.id,
        fields: { viewportHeights: { [breakpoint]: "fit-content" } },
      }),
    );
    scene.sync();
    // Short content: the page's own height (the screen).
    expect(frame()).toBe(screen);
    const grow = (height: number) => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: "project:node:box" as NodeId }],
          breakpoint,
          sizing: { height: { kind: "set", value: height } },
        }),
      );
      scene.sync();
    };
    grow(screen + 500);
    expect(frame()).toBe(screen + 500);
    grow(screen + 900);
    expect(frame()).toBe(screen + 900);
    // The body itself is untouched (Publish reads it).
    expect(workspace.runtime.graph.getEntry(BODY)).toMatchObject({
      sizing: {},
    });
  });

  it("over an authored Height the frame is the Canvas height and the content keeps the Height", async () => {
    const { workspace, scene, bodyRecord, page } = await open();
    const breakpoint = workspace.session.getSnapshot().breakpoint;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BODY }],
        breakpoint,
        sizing: { height: { kind: "set", value: 1500 } },
      }),
    );
    scene.sync();
    expect(scene.stream.boundsMap.get(bodyRecord())?.height).toBe(1500);
    workspace.execute(
      updatePage({
        id: page()!.id,
        fields: { viewportHeights: { [breakpoint]: 600 } },
      }),
    );
    scene.sync();
    const content = `${bodyRecord()}::part:page-content`;
    expect(scene.stream.boundsMap.get(bodyRecord())?.height).toBe(600);
    expect(workspace.root.getGeometry([content]).get(content)?.height).toBe(
      1500,
    );
  });

  it("names the page as the History subject of a Canvas height step", async () => {
    const { workspace, page, dragCorner } = await open();
    dragCorner(0, 120);
    const history = workspace.history.getSnapshot();
    expect(history.labels.at(-1)).toBe("Canvas height");
    expect(history.subjects.at(-1)).toBe(page()!.name);
  });

  it("a fit-content page is as tall as its own content, not its page grid row (an empty page beside a long one)", async () => {
    const { workspace, page } = await open();
    const breakpoint = workspace.session.getSnapshot().breakpoint;
    const home = page()!;
    const second = "project:page:second" as EntryId<"page">;
    const body = workspace.runtime.graph.getEntry(BODY) as NodeEntry;
    const secondBody: NodeEntry = {
      ...structuredClone(body),
      id: "project:node:second-body" as NodeId,
      children: [],
    };
    workspace.execute(
      createPage({
        page: {
          kind: "page",
          id: second,
          route: "/second",
          name: "Second",
          children: [secondBody.id],
        },
        entries: [secondBody],
      }),
    );
    const frames = () => workspace.root.pageFrameRects();
    const screen = frames().get(second)!.height;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:box" as NodeId }],
        breakpoint,
        sizing: { height: { kind: "set", value: screen + 800 } },
      }),
    );
    for (const id of [home.id, second])
      workspace.execute(
        updatePage({
          id,
          fields: { viewportHeights: { [breakpoint]: "fit-content" } },
        }),
      );
    // (Same grid row: the long page's row is taller than the empty page.)
    expect(frames().get(second)!.y).toBe(frames().get(home.id)!.y);
    expect(frames().get(home.id)!.height).toBeGreaterThanOrEqual(screen + 800);
    expect(frames().get(second)!.height).toBe(screen);
  });
});
