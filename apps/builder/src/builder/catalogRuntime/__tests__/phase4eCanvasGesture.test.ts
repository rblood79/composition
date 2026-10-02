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
  setWholeField,
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
  // Manual guides the gestures snap to (scene coordinates).
  const guides = { x: [] as number[], y: [] as number[] };
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
    guideLines: () => guides,
    reflow: (target, patch) => {
      workspace.root.previewRecord(target, patch);
      sync();
    },
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
  return { workspace, scene, gestures, record, box, center, children, guides };
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

  it("an absolutely placed node moves by offset (its placement); a left/top handle moves it too", async () => {
    const { workspace, gestures, record, center, box } = await open();
    workspace.execute(
      setWholeField({
        targets: [{ kind: "node", id: id("d") }],
        field: "placement",
        value: { kind: "absolute", x: 10, y: 12 },
      }),
    );
    workspace.selectRecords([record("d")]);
    const [x, y] = center("d");
    gestures.beginMove(x, y, record("d"));
    gestures.update(x + 30, y + 5, 1);
    expect(gestures.preview()?.line).toBeUndefined();
    gestures.finish();
    const placement = () => {
      const entry = workspace.runtime.graph.getEntry(id("d"));
      return entry?.kind === "node" ? entry.placement : undefined;
    };
    expect(placement()).toEqual({ kind: "absolute", x: 40, y: 17 });

    // The top-left handle keeps the bottom-right edge: size grows, placement moves (one step).
    const start = box("d");
    const revision = workspace.runtime.graph.revision;
    expect(gestures.beginResize(start.x, start.y, 1)).toBe(true);
    gestures.update(start.x - 10, start.y - 4, 1);
    gestures.finish();
    expect(placement()).toEqual({ kind: "absolute", x: 30, y: 13 });
    const entry = workspace.runtime.graph.getEntry(id("d"));
    expect(entry?.kind === "node" && entry.sizing).toEqual({
      width: { kind: "set", value: Math.round(start.width + 10) },
      height: { kind: "set", value: Math.round(start.height + 4) },
    });
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
  });

  it("an absolute drag snaps to its parent's edge and to manual guides; ⌘ (snap off) moves freely", async () => {
    const { workspace, gestures, record, center, box, guides } = await open();
    workspace.execute(
      setWholeField({
        targets: [{ kind: "node", id: id("d") }],
        field: "placement",
        value: { kind: "absolute", x: 10, y: 12 },
      }),
    );
    workspace.selectRecords([record("d")]);
    const parent = box("box");
    const start = box("d");
    const [x, y] = center("d");
    // 2 px short of the parent's left edge (threshold 5 screen px at zoom 1): it snaps there.
    const dx = parent.x - start.x + 2;
    gestures.beginMove(x, y, record("d"));
    gestures.update(x + dx, y + 20, 1, { snap: true });
    expect(gestures.preview()?.ghost?.x).toBe(parent.x);
    expect(gestures.preview()?.snapGuides?.length).toBeGreaterThan(0);
    // Snap off: the raw position, no lines.
    gestures.update(x + dx, y + 20, 1, { snap: false });
    expect(gestures.preview()?.ghost?.x).toBe(start.x + dx);
    expect(gestures.preview()?.snapGuides).toBeUndefined();
    // The committed placement is the snapped one.
    gestures.update(x + dx, y + 20, 1, { snap: true });
    gestures.finish();
    const entry = workspace.runtime.graph.getEntry(id("d"));
    expect(entry?.kind === "node" && entry.placement).toEqual({
      kind: "absolute",
      x: Math.round(10 + parent.x - start.x),
      y: 32,
    });
    // A manual guide wins: the top edge lands on it.
    const moved = box("d");
    guides.y.push(moved.y + 100);
    const [mx, my] = center("d");
    gestures.beginMove(mx, my, record("d"));
    gestures.update(mx + 40, my + 97, 1, { snap: true });
    expect(gestures.preview()?.ghost?.y).toBe(moved.y + 100);
    gestures.cancel();
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

  it("resize and spacing drags reflow live — siblings move, the document and history do not; release commits that geometry, cancel puts it back", async () => {
    const { workspace, scene, gestures, record, box } = await open();
    const entry = (name: string) => {
      const found = workspace.runtime.graph.getEntry(id(name));
      return found?.kind === "node" ? found : undefined;
    };
    const applied = () => workspace.history.getSnapshot().applied;
    workspace.selectRecords([record("a")]);
    const a = box("a");
    const bTop = box("b").y;
    const steps = applied();
    // Bottom edge of A down 30: B follows during the drag.
    const edge = { x: a.x + a.width / 2, y: a.y + a.height };
    expect(gestures.beginResize(edge.x, edge.y, 1)).toBe(true);
    gestures.update(edge.x, edge.y + 30, 1);
    expect(box("a").height).toBe(a.height + 30);
    expect(box("b").y).toBe(bTop + 30);
    expect(entry("a")?.sizing.height).toEqual({ kind: "set", value: 40 });
    expect(applied()).toBe(steps);
    const live = { a: box("a"), b: box("b") };
    gestures.finish();
    expect(entry("a")?.sizing.height).toEqual({ kind: "set", value: 70 });
    expect(applied()).toBe(steps + 1);
    expect({ a: box("a"), b: box("b") }).toEqual(live);

    // Top padding of the list: A moves down live; cancel restores it and writes nothing.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("list") }],
        visual: { padding: { kind: "set", value: 8 } },
      }),
    );
    scene.sync();
    workspace.selectRecords([record("list")]);
    const aTop = box("a").y;
    const band = gestures
      .spacingBands()
      .find((item) => item.kind === "padding" && item.side === "top")!;
    const [tx, ty] = [
      band.rect.x + band.rect.width / 2,
      band.rect.y + band.rect.height / 2,
    ];
    const before = applied();
    expect(gestures.beginSpacing(tx, ty, 1)).toBe(true);
    gestures.update(tx, ty + 10, 1);
    expect(box("a").y).toBe(aTop + 10);
    gestures.cancel();
    expect(box("a").y).toBe(aTop);
    expect(entry("list")?.visual).not.toHaveProperty("paddingTop");
    expect(applied()).toBe(before);
    // Dragged and brought back to the start value: no command, and the record is its own again
    // (no previewed value left for the DOM readers of the same inputs).
    expect(gestures.beginSpacing(tx, ty, 1)).toBe(true);
    gestures.update(tx, ty + 10, 1);
    gestures.update(tx, ty, 1);
    expect(gestures.finish()).toBe(false);
    expect(
      workspace.root.domInputs.get(record("list"))?.visual,
    ).not.toHaveProperty("paddingTop");
  });

  it("a preview reaches the Canvas listeners only, and a step that replaces the record meanwhile wins over the restore", async () => {
    const { workspace, record } = await open();
    const target = record("a");
    const heard: string[] = [];
    workspace.root.subscribeCanvas(target, () => heard.push("canvas"));
    workspace.root.subscribeDom(target, () => heard.push("dom"));
    workspace.root.previewRecord(target, { sizing: { height: 90 } });
    expect(heard).toEqual(["canvas"]);
    expect(workspace.root.canvasInputs.get(target)?.sizing.height).toBe(90);
    // An edit lands on the record during the drag: the restore keeps the edit's record.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("a") }],
        sizing: { height: { kind: "set", value: 55 } },
      }),
    );
    workspace.root.previewRecord(target);
    expect(workspace.root.canvasInputs.get(target)?.sizing.height).toBe(55);
    expect(workspace.root.getGeometry([target]).get(target)?.height).toBe(55);
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

  it("spacing handles drag padding (Alt: both sides of the axis) and the gap; a leaf has none", async () => {
    const { workspace, gestures, record } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("list") }],
        visual: {
          padding: { kind: "set", value: 8 },
          gap: { kind: "set", value: 4 },
        },
      }),
    );
    workspace.selectRecords([record("a")]);
    expect(gestures.spacingBands()).toEqual([]);
    workspace.selectRecords([record("list")]);
    const bands = gestures.spacingBands();
    expect(bands.filter((band) => band.kind === "padding")).toHaveLength(4);
    expect(bands.filter((band) => band.kind === "gap")).toHaveLength(2);
    const center = (kind: string, side: string | null) => {
      const band = bands.find(
        (item) => item.kind === kind && item.side === side,
      )!;
      return [
        band.rect.x + band.rect.width / 2,
        band.rect.y + band.rect.height / 2,
      ] as const;
    };
    const visual = () => {
      const entry = workspace.runtime.graph.getEntry(id("list"));
      return entry?.kind === "node" ? entry.visual : {};
    };

    // Top padding: dragging down 10 px grows it (8 → 18); Alt also moves the bottom.
    const [tx, ty] = center("padding", "top");
    expect(gestures.spacingAt(tx, ty, 1)?.onHandle).toBe(true);
    expect(gestures.beginSpacing(tx, ty, 1, { alt: true })).toBe(true);
    gestures.update(tx, ty + 10, 1);
    expect(gestures.preview()?.spacing?.active.bandIds).toHaveLength(2);
    gestures.finish();
    expect(visual()).toMatchObject({
      paddingTop: { kind: "set", value: 18 },
      paddingBottom: { kind: "set", value: 18 },
    });
    expect(visual()).not.toHaveProperty("paddingLeft");

    // The gap between A and B: down 13 px with Shift = the delta in 10 px steps (4 → 14).
    const [gx, gy] = gestures
      .spacingBands()
      .filter((band) => band.kind === "gap")
      .map((band) => [
        band.rect.x + band.rect.width / 2,
        band.rect.y + band.rect.height / 2,
      ])[0];
    gestures.beginSpacing(gx, gy, 1);
    gestures.update(gx, gy + 13, 1, { axisLock: true });
    gestures.finish();
    expect(visual()).toMatchObject({ gap: { kind: "set", value: 14 } });
  });

  it("a spacing handle clicked without a drag opens the inline input; its value commits as one step", async () => {
    const { workspace, gestures, record } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("list") }],
        visual: { padding: { kind: "set", value: 8 } },
      }),
    );
    workspace.selectRecords([record("list")]);
    const top = gestures
      .spacingBands()
      .find((band) => band.kind === "padding" && band.side === "top")!;
    const [tx, ty] = [
      top.rect.x + top.rect.width / 2,
      top.rect.y + top.rect.height / 2,
    ];
    const visual = () => {
      const entry = workspace.runtime.graph.getEntry(id("list"));
      return entry?.kind === "node" ? entry.visual : {};
    };
    // A drag is not a click.
    gestures.beginSpacing(tx, ty, 1);
    gestures.update(tx, ty + 10, 1);
    gestures.finish();
    expect(gestures.takeSpacingClick()).toBeUndefined();
    // A press released in place (Alt: both sides) is, once.
    gestures.beginSpacing(tx, ty, 1, { alt: true });
    expect(gestures.finish()).toBe(false);
    const click = gestures.takeSpacingClick()!;
    expect(click.start).toBe(18);
    expect(gestures.takeSpacingClick()).toBeUndefined();
    const undo = workspace.runtime.historyLabels.undo.length;
    workspace.execute(gestures.spacingValueCommand(click, 24)!);
    expect(visual()).toMatchObject({
      paddingTop: { kind: "set", value: 24 },
      paddingBottom: { kind: "set", value: 24 },
    });
    expect(workspace.runtime.historyLabels.undo.length).toBe(undo + 1);
    // Not a length: nothing.
    expect(gestures.spacingValueCommand(click, -1)).toBeUndefined();
    expect(gestures.spacingValueCommand(click, Number.NaN)).toBeUndefined();
  });
});

describe("ADR-248 4e-8 drag modifiers and nesting notices", () => {
  it("Alt drag drops a copy at the drop position (one step, the original stays); an absolute copy lands at the offset", async () => {
    const { workspace, gestures, record, center, box, children } = await open();
    workspace.selectRecords([record("a")]);
    const [ax, ay] = center("a");
    const c = box("c");
    gestures.beginMove(ax, ay, record("a"), { copy: true });
    gestures.update(ax, c.y + c.height - 1, 1);
    const depth = workspace.runtime.historyDepth.undo;
    expect(gestures.finish()).toBe(true);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    const list = children("list");
    expect(list.slice(0, 3)).toEqual([id("a"), id("b"), id("c")]);
    expect(list).toHaveLength(4);
    const copy = workspace.runtime.graph.getEntry(list[3]!);
    expect(copy?.kind === "node" && copy.props.children).toEqual({
      kind: "set",
      value: "A",
    });
    // The copy is selected.
    expect(workspace.session.getSnapshot().selection[0].target).toEqual({
      kind: "node",
      id: list[3],
    });
    workspace.undo();
    expect(children("list")).toEqual([id("a"), id("b"), id("c")]);

    // Over its own box a copy still drops (next to the original): no no-op shortcut.
    workspace.execute(
      setWholeField({
        targets: [{ kind: "node", id: id("d") }],
        field: "placement",
        value: { kind: "absolute", x: 10, y: 12 },
      }),
    );
    workspace.selectRecords([record("d")]);
    const [dx, dy] = center("d");
    gestures.beginMove(dx, dy, record("d"), { copy: true });
    gestures.update(dx + 30, dy + 5, 1);
    expect(gestures.finish()).toBe(true);
    const [original, duplicate] = children("box");
    const placementOf = (nodeId: NodeId | undefined) => {
      const entry = nodeId ? workspace.runtime.graph.getEntry(nodeId) : null;
      return entry?.kind === "node" ? entry.placement : undefined;
    };
    expect(original).toBe(id("d"));
    expect(placementOf(original)).toEqual({ kind: "absolute", x: 10, y: 12 });
    expect(placementOf(duplicate)).toEqual({ kind: "absolute", x: 40, y: 17 });
  });

  it("a container that refuses the node passes the drop to its nearest accepting ancestor (notice after the step); none moves = rejected", async () => {
    const { workspace, scene, gestures, record, center, children } =
      await open();
    const notices: unknown[] = [];
    (
      gestures as unknown as {
        host: { notifyNesting?: (notice: unknown) => void };
      }
    ).host.notifyNesting = (notice) => notices.push(notice);
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node("form2", "lib:definition:type-Form"),
          node("form1", "lib:definition:type-Form", [id("inner")]),
          {
            ...node("inner", "lib:definition:type-frame"),
            sizing: {
              width: { kind: "set", value: 300 },
              height: { kind: "set", value: 120 },
            },
          },
        ],
        rootIds: [id("form2"), id("form1")],
        newId: allocator(),
      }),
    );
    scene.sync();
    const bodyChildren = () => {
      const body = workspace.runtime.graph.getEntry(BODY);
      return body?.kind === "node" ? body.children : [];
    };
    workspace.selectRecords([record("form2")]);
    const [fx, fy] = center("form2");
    const [ix, iy] = center("inner");
    gestures.beginMove(fx, fy, record("form2"));
    gestures.update(ix, iy, 1);
    // A form cannot sit inside a form: the body (the nearest structural ancestor) takes it, at its end.
    expect(gestures.finish()).toBe(true);
    expect(children("inner")).toEqual([]);
    expect(bodyChildren().at(-1)).toBe(id("form2"));
    expect(notices).toEqual([
      expect.objectContaining({
        kind: "relocated",
        target: "body",
        violation: expect.objectContaining({
          parentType: "Form",
          childType: "Form",
        }),
      }),
    ]);
    // Again: the body's end is where it already is — nothing moves, the rejection notice shows.
    const revision = workspace.runtime.graph.revision;
    const [gx, gy] = center("form2");
    const [jx, jy] = center("inner");
    gestures.beginMove(gx, gy, record("form2"));
    gestures.update(jx, jy, 1);
    expect(gestures.finish()).toBe(false);
    expect(workspace.runtime.graph.revision).toBe(revision);
    expect(notices[1]).toMatchObject({ kind: "rejected" });
  });

  it("a ratio with a dependent axis locks the resize: only the driving axis is written", async () => {
    const { workspace, scene, gestures, record, box } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("box") }],
        sizing: { width: { kind: "set", value: 200 } },
        visual: { aspectRatio: { kind: "set", value: "2 / 1" } },
      }),
    );
    scene.sync();
    workspace.selectRecords([record("box")]);
    const sizingOf = () => {
      const entry = workspace.runtime.graph.getEntry(id("box"));
      return entry?.kind === "node" ? entry.sizing : undefined;
    };
    const start = box("box");
    expect(start).toMatchObject({ width: 200, height: 100 });
    // The corner drives the width; the height follows the ratio (not written).
    expect(
      gestures.beginResize(start.x + start.width, start.y + start.height, 1),
    ).toBe(true);
    gestures.update(start.x + start.width + 40, start.y + start.height + 90, 1);
    gestures.finish();
    expect(sizingOf()).toEqual({ width: { kind: "set", value: 240 } });
    expect(box("box")).toMatchObject({ width: 240, height: 120 });
    // The bottom edge (the dependent axis) drives the width through the ratio.
    const next = box("box");
    expect(
      gestures.beginResize(next.x + next.width / 2, next.y + next.height, 1),
    ).toBe(true);
    gestures.update(next.x + next.width / 2, next.y + next.height + 30, 1);
    gestures.finish();
    expect(sizingOf()).toEqual({ width: { kind: "set", value: 300 } });
  });

  it("absolute nodes: a multi-selection moves by the offset; over another flow container the leader's selection joins its flow; over the page body it stays absolute at the front", async () => {
    const { workspace, scene, gestures, record, center, box, children } =
      await open();
    const place = (name: string, x: number, y: number) =>
      workspace.execute(
        setWholeField({
          targets: [{ kind: "node", id: id(name) }],
          field: "placement",
          value: { kind: "absolute", x, y },
        }),
      );
    const placementOf = (name: string) => {
      const entry = workspace.runtime.graph.getEntry(id(name));
      return entry?.kind === "node" ? entry.placement : undefined;
    };
    // The frame keeps a size of its own (an absolute child takes none).
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("box") }],
        sizing: {
          width: { kind: "set", value: 400 },
          height: { kind: "set", value: 200 },
        },
      }),
    );
    place("d", 10, 12);
    place("c", 4, 6);
    scene.sync();
    workspace.selectRecords([record("d"), record("c")]);
    // In place (over its own parent): every absolute node moves by the offset, one step.
    const [dx, dy] = center("d");
    gestures.beginMove(dx, dy, record("d"));
    gestures.update(dx + 30, dy + 5, 1);
    expect(gestures.preview()?.ghosts).toHaveLength(1);
    const depth = workspace.runtime.historyDepth.undo;
    expect(gestures.finish()).toBe(true);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(placementOf("d")).toEqual({ kind: "absolute", x: 40, y: 17 });
    expect(placementOf("c")).toEqual({ kind: "absolute", x: 34, y: 11 });
    workspace.undo();
    scene.sync();

    // Over the page body (empty area): d leaves its frame, stays absolute at the body's front.
    workspace.selectRecords([record("d")]);
    const [ex, ey] = center("d");
    const start = box("d");
    const body = box("home-body");
    gestures.beginMove(ex, ey, record("d"));
    gestures.update(1000, 900, 1);
    expect(gestures.preview()?.line).toBeUndefined();
    expect(gestures.finish()).toBe(true);
    const bodyEntry = workspace.runtime.graph.getEntry(BODY);
    expect(bodyEntry?.kind === "node" && bodyEntry.children[0]).toBe(id("d"));
    expect(children("box")).toEqual([]);
    expect(placementOf("d")).toEqual({
      kind: "absolute",
      x: Math.round(start.x + 1000 - ex - body.x),
      y: Math.round(start.y + 900 - ey - body.y),
    });
    workspace.undo();
    scene.sync();

    // Over another frame: d joins its flow (the placement goes).
    workspace.selectRecords([record("d")]);
    const [fx, fy] = center("d");
    const [bx, by] = center("b");
    gestures.beginMove(fx, fy, record("d"));
    gestures.update(bx, by, 1);
    expect(gestures.preview()?.line).toBeDefined();
    gestures.finish();
    expect(children("list")).toContain(id("d"));
    expect(placementOf("d")).toBeUndefined();
  });
});
