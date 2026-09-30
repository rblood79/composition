import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogCanvasGestures } from "../canvasGesture";
import { pickTopmostRecord } from "../canvasPick";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-3b Canvas gestures: a drag past the threshold previews in the overlay only and
 * commits one command on release — a reorder among siblings, a move into another structural
 * container, an offset for an absolutely placed element, fixed width/height for a handle resize.
 */
const PROJECT = "project:project:gesture" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
  props: NodeEntry["props"] = {},
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props,
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
// No text measure in this environment: each text gets a fixed 40 px height.
const text = (name: string): NodeEntry => ({
  ...node(name, "lib:definition:text", [], {
    children: { kind: "set", value: name.toUpperCase() },
  }),
  sizing: { height: { kind: "set", value: 40 } },
});
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:g${++next}` as EntryId<K>;
};

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Gesture" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-gesture-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("list", "lib:definition:type-frame", [id("a"), id("b"), id("c")]),
        text("a"),
        text("b"),
        text("c"),
        node("box", "lib:definition:type-frame", [id("d")]),
        text("d"),
      ],
      rootIds: [id("list"), id("box")],
      newId: allocator(),
    }),
  );
  // Frames stack their children in a column here (the drop axis follows the container's flow).
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id: id("list") }],
      layout: {
        display: { kind: "set", value: "flex" },
        flexDirection: { kind: "set", value: "column" },
      },
    }),
  );
  const scene = new CatalogCanvasScene(workspace.root);
  const sync = () => scene.sync();
  const gestures = new CatalogCanvasGestures({
    get records() {
      return workspace.root.domInputs;
    },
    graph: workspace.runtime.graph,
    bounds: (record) => scene.stream.boundsMap.get(record),
    pick: (x, y) =>
      pickTopmostRecord(scene.stream, x, y, scene.stream.hitBoundsMap.keys()),
    selection: () => workspace.session.getSnapshot().selection,
    editingContext: () => workspace.session.getSnapshot().editingContext,
    selectRecords: (ids, options) => workspace.selectRecords(ids, options),
    breakpoint: () => workspace.session.getSnapshot().breakpoint,
    execute: (command) => {
      workspace.execute(command);
      sync();
    },
    newId: workspace.newId,
  });
  const record = (name: string) => workspace.root.recordsOfSource(id(name))[0];
  const box = (name: string) => scene.stream.boundsMap.get(record(name))!;
  const center = (name: string) => {
    const b = box(name);
    return [b.x + b.width / 2, b.y + b.height / 2] as const;
  };
  const children = (name: string) => {
    const entry = workspace.runtime.graph.getEntry(id(name));
    return entry?.kind === "node" ? entry.children : [];
  };
  return { workspace, scene, gestures, record, box, center, children };
}

describe("ADR-248 Phase 4e-3b Canvas gestures", () => {
  it("reorders among siblings on release (one history step); undo restores; below the threshold nothing", async () => {
    const { workspace, gestures, record, box, center, children } = await open();
    workspace.selectRecords([record("a")]);
    const [ax, ay] = center("a");
    // 2 scene px at zoom 1 is under the 3 px threshold: a click, not a drag.
    expect(gestures.beginMove(ax, ay, record("a"))).toBe(true);
    expect(gestures.update(ax, ay + 2, 1)).toBe(false);
    expect(gestures.finish()).toBe(false);

    const revision = workspace.runtime.graph.revision;
    gestures.beginMove(ax, ay, record("a"));
    const c = box("c");
    expect(gestures.update(ax, c.y + c.height - 1, 1)).toBe(true);
    // The document does not change during the drag; the preview shows the ghost and the line.
    expect(workspace.runtime.graph.revision).toBe(revision);
    const preview = gestures.preview()!;
    expect(preview.ghost).toMatchObject({ width: box("a").width });
    expect(preview.line).toMatchObject({ y: c.y + c.height, height: 0 });
    expect(preview.container).toEqual(box("list"));
    expect(gestures.finish()).toBe(true);
    expect(children("list")).toEqual([id("b"), id("c"), id("a")]);
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    workspace.undo();
    expect(children("list")).toEqual([id("a"), id("b"), id("c")]);
  });

  it("dropping over its own box keeps the order (no command); over another frame moves into it", async () => {
    const { workspace, gestures, record, center, children } = await open();
    workspace.selectRecords([record("b")]);
    const [bx, by] = center("b");
    gestures.beginMove(bx, by, record("b"));
    gestures.update(bx + 5, by + 1, 1);
    const revision = workspace.runtime.graph.revision;
    expect(gestures.finish()).toBe(false);
    expect(workspace.runtime.graph.revision).toBe(revision);

    gestures.beginMove(bx, by, record("b"));
    const [dx, dy] = center("d");
    gestures.update(dx, dy, 1);
    expect(gestures.preview()?.container).toBeDefined();
    gestures.finish();
    expect(children("list")).toEqual([id("a"), id("c")]);
    expect(children("box")).toContain(id("b"));
    // The moved node stays selected at its new position.
    expect(workspace.session.getSnapshot().selection[0].target).toEqual({
      kind: "node",
      id: id("b"),
    });
  });

  it("an absolutely placed element moves by offset (left/top at the current breakpoint)", async () => {
    const { workspace, gestures, record, center } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("d") }],
        layout: {
          position: { kind: "set", value: "absolute" },
          insetLeft: { kind: "set", value: "10px" },
          insetTop: { kind: "set", value: "12px" },
        },
      }),
    );
    workspace.selectRecords([record("d")]);
    const [x, y] = center("d");
    gestures.beginMove(x, y, record("d"));
    gestures.update(x + 30, y + 5, 1);
    expect(gestures.preview()?.line).toBeUndefined();
    gestures.finish();
    const entry = workspace.runtime.graph.getEntry(id("d"));
    expect(entry?.kind === "node" && entry.layout).toMatchObject({
      insetLeft: { kind: "set", value: "40px" },
      insetTop: { kind: "set", value: "17px" },
    });
  });

  it("a corner handle resizes to fixed width/height on release; the ghost follows the handle", async () => {
    const { workspace, scene, gestures, record, box } = await open();
    workspace.selectRecords([record("a")]);
    const start = box("a");
    const corner = { x: start.x + start.width, y: start.y + start.height };
    expect(gestures.handleAt(corner.x, corner.y, 1)?.position).toBe(
      "bottom-right",
    );
    // The page body has no handles (its frame is the page).
    workspace.selectRecords(workspace.root.recordsOfSource(BODY));
    expect(gestures.handleAt(0, 0, 1)).toBeNull();
    workspace.selectRecords([record("a")]);

    expect(gestures.beginResize(corner.x, corner.y, 1)).toBe(true);
    gestures.update(corner.x - 40, corner.y + 20, 1);
    expect(gestures.preview()?.ghost).toEqual({
      x: start.x,
      y: start.y,
      width: Math.round(start.width - 40),
      height: Math.round(start.height + 20),
    });
    gestures.finish();
    const entry = workspace.runtime.graph.getEntry(id("a"));
    expect(entry?.kind === "node" && entry.sizing).toEqual({
      width: { kind: "set", value: Math.round(start.width - 40) },
      height: { kind: "set", value: Math.round(start.height + 20) },
    });
    expect(box("a").height).toBe(Math.round(start.height + 20));

    // On mobile the resize writes the mobile layer; the base keeps its size.
    workspace.setBreakpoint("mobile");
    scene.replaceRoot(workspace.root);
    const mobile = box("a");
    const edge = {
      x: mobile.x + mobile.width / 2,
      y: mobile.y + mobile.height,
    };
    expect(gestures.beginResize(edge.x, edge.y, 1)).toBe(true);
    gestures.update(edge.x, edge.y + 10, 1);
    gestures.finish();
    const after = workspace.runtime.graph.getEntry(id("a"));
    expect(after?.kind === "node" && after.sizing.height).toEqual({
      kind: "set",
      value: Math.round(start.height + 20),
    });
    expect(after?.kind === "node" && after.responsive?.mobile?.sizing).toEqual({
      height: { kind: "set", value: Math.round(mobile.height + 10) },
    });
  });

  it("a marquee from the page background selects the intersected elements of the level; shift adds", async () => {
    const { workspace, gestures, record, box } = await open();
    const list = box("list");
    const frame = box("box");
    // From below both frames up across the second only: the level is the body's children.
    const below = frame.y + frame.height + 20;
    gestures.beginMarquee(10, below, false);
    expect(gestures.update(12, below - 1, 1)).toBe(false);
    gestures.update(20, frame.y + 1, 1);
    expect(gestures.preview()?.highlights).toEqual([frame]);
    expect(gestures.finish()).toBe(false);
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.identity),
    ).toEqual([record("box")]);

    // Shift adds the list (its box) to the selection.
    gestures.beginMarquee(10, below, true);
    gestures.update(20, list.y + 1, 1);
    gestures.finish();
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.identity),
    ).toEqual([record("box"), record("list")]);

    // Inside a context the level is the context's children.
    workspace.session.enterContext(id("list"));
    gestures.beginMarquee(list.x + list.width - 1, list.y + 1, false);
    gestures.update(list.x + list.width - 2, box("b").y + 1, 1);
    gestures.finish();
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.identity),
    ).toEqual([record("a"), record("b")]);
  });
});
