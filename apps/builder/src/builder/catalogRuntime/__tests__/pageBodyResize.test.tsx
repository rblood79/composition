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
import { CANVAS_VIEWPORT } from "../../../../../../packages/shared/src/catalog/runtime/canvasBreakpoints";
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
 * box 로도 사이즈 조절」): the right handle writes the body's width, the bottom handle its Min H —
 * or its Height when it authored one — at the active breakpoint; the left · top handles are not
 * there (the frame's top-left is the page's place). The frame is the body as Publish draws it
 * (user 2026-11-13 — no Builder-only frame height): Height auto grows with the content from the
 * Min H, a Height (px · `%` · `vh` of the screen) is the frame and the content scrolls in it.
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

describe("page body frame = the body (width · Height · Min H)", () => {
  it("drags the bottom-right handle: the body's width and Min H at the breakpoint in one step, the frame follows live and on release", async () => {
    const { workspace, scene, gestures, bodyRecord, sizingAt } = await open();
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
    expect(sizingAt()).toEqual({
      width: { kind: "set", value: start.width - 100 },
      minHeight: { kind: "set", value: start.height + 200 },
    });
    expect(workspace.root.pageFrameRects().values().next().value).toMatchObject(
      { width: start.width - 100, height: start.height + 200 },
    );
    // One step: undo puts both back.
    workspace.undo();
    scene.sync();
    expect(sizingAt()).toEqual({});
    expect(scene.stream.boundsMap.get(bodyRecord())).toMatchObject({
      width: start.width,
      height: start.height,
    });
  });

  it("a corner dragged straight down writes the Min H only (the width did not change)", async () => {
    const { dragCorner, sizingAt } = await open();
    const start = dragCorner(0, 150);
    expect(sizingAt()).toEqual({
      minHeight: { kind: "set", value: start.height + 150 },
    });
  });

  it("over an authored Height the bottom handle writes the Height", async () => {
    const { workspace, scene, dragCorner, sizingAt } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BODY }],
        breakpoint: workspace.session.getSnapshot().breakpoint,
        sizing: { height: { kind: "set", value: 900 } },
      }),
    );
    scene.sync();
    dragCorner(0, 100);
    expect(sizingAt()).toEqual({ height: { kind: "set", value: 1000 } });
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

  it("Height auto: the frame takes the page's whole content and follows it, never under the screen (or the Min H)", async () => {
    const { workspace, scene, bodyRecord } = await open();
    const breakpoint = workspace.session.getSnapshot().breakpoint;
    const frame = () => scene.stream.boundsMap.get(bodyRecord())!.height;
    const screen = CANVAS_VIEWPORT[breakpoint].height;
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
    // A Min H past the content: the frame is the Min H.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BODY }],
        breakpoint,
        sizing: { minHeight: { kind: "set", value: screen + 1200 } },
      }),
    );
    scene.sync();
    expect(frame()).toBe(screen + 1200);
  });

  it("Height 100% · 100vh: the frame is the screen and the longer content scrolls in it", async () => {
    const { workspace, scene, bodyRecord } = await open();
    const breakpoint = workspace.session.getSnapshot().breakpoint;
    const screen = CANVAS_VIEWPORT[breakpoint].height;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:box" as NodeId }],
        breakpoint,
        sizing: { height: { kind: "set", value: screen + 500 } },
      }),
    );
    for (const [height, expected] of [
      ["100%", screen],
      ["100vh", screen],
      ["50%", screen / 2],
    ] as const) {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: BODY }],
          breakpoint,
          visual: { height: { kind: "set", value: height } },
        }),
      );
      scene.sync();
      expect(scene.stream.boundsMap.get(bodyRecord())?.height).toBe(expected);
    }
  });

  it("a page step names the page as its History subject", async () => {
    const { workspace, page } = await open();
    workspace.execute(
      updatePage({ id: page()!.id, fields: { name: "Renamed" } }),
    );
    expect(workspace.history.getSnapshot().subjects.at(-1)).toBe("Renamed");
  });

  it("a page without a Height is as tall as its own content, not its page grid row (an empty page beside a long one)", async () => {
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
    // (Same grid row: the long page's row is taller than the empty page.)
    expect(frames().get(second)!.y).toBe(frames().get(home.id)!.y);
    expect(frames().get(home.id)!.height).toBeGreaterThanOrEqual(screen + 800);
    expect(frames().get(second)!.height).toBe(screen);
  });
});
