// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
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
 * box 로도 사이즈 조절」): the right · bottom handles write the body's width and its Min H at the
 * active breakpoint — not a height (the body grows past its frame with its content); the left · top
 * handles are not there (the frame's top-left is the page's place).
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
  return { workspace, scene, gestures, bodyRecord, entry };
}

describe("page body selection box resize = its frame (width · Min H)", () => {
  it("drags the bottom-right handle: width and Min H at the breakpoint, the frame follows live and on release", async () => {
    const { workspace, scene, gestures, bodyRecord, entry } = await open();
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
    const sizing =
      breakpoint === "desktop"
        ? entry()?.sizing
        : entry()?.responsive?.[breakpoint]?.sizing;
    expect(sizing).toEqual({
      width: { kind: "set", value: start.width - 100 },
      minHeight: { kind: "set", value: start.height + 200 },
    });
    expect(workspace.root.pageFrameRects().values().next().value).toMatchObject(
      {
        width: start.width - 100,
        height: start.height + 200,
      },
    );
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
});
