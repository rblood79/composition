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
import type { CatalogSpacingLive } from "../spacingLive";
import { readSessionSpacingValue } from "../../presentation/useSpacingSession";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { placeAbsolute, absolutePlacementOf } from "./absoluteLayoutFixture";

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

async function open(options: { paddingLinked?: () => boolean } = {}) {
  const live: (CatalogSpacingLive | null)[] = [];
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
    itemOfRecord: (record) => workspace.itemOfRecord(record),
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
    ...(options.paddingLinked ? { paddingLinked: options.paddingLinked } : {}),
    spacingLive: (next) => live.push(next),
    ownFields: (target) => workspace.readModel.ownFields(target),
    viewport: () => workspace.root.viewport,
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
  return {
    workspace,
    scene,
    gestures,
    record,
    box,
    center,
    children,
    guides,
    live,
  };
}

/** The panel's view of a published drag (what `useSpacingSession` returns for it). */
const useSpacingSessionView = (live: CatalogSpacingLive) => ({
  nodeId: live.identity,
  properties: live.properties,
  values: live.values,
});

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
    // A reorder in its own column: the opened slot shows it — no container frame.
    expect(preview.reflow).toBe(true);
    expect(preview.container).toBeUndefined();
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
    const { workspace, scene, gestures, record, center, box } = await open();
    workspace.execute(placeAbsolute({ kind: "node", id: id("d") }, 10, 12));
    // Its parent keeps a height of its own (an absolute child adds none): the drag stays over it.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("box") }],
        sizing: { height: { kind: "set", value: 200 } },
      }),
    );
    // The Canvas draws the placed box before the user grabs it (the move starts from it).
    scene.sync();
    workspace.selectRecords([record("d")]);
    const [x, y] = center("d");
    gestures.beginMove(x, y, record("d"));
    gestures.update(x + 30, y + 5, 1);
    expect(gestures.preview()?.line).toBeUndefined();
    gestures.finish();
    const placement = () => {
      const entry = workspace.runtime.graph.getEntry(id("d"));
      return absolutePlacementOf(entry);
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

  // ADR-275 Decision 5: a drag keeps the box's constraint — a Right box moves its right inset, a
  // Center box its offset (both insets), and a Left+Right box both sides by the same amount.
  it.each([
    [
      "Right · Bottom",
      { insetRight: "30px", insetBottom: "40px" },
      { insetRight: "20px", insetBottom: "35px" },
    ],
    [
      "Center",
      {
        insetLeft: "0px",
        insetRight: "0px",
        justifySelf: "unsafe center",
        insetTop: "0px",
        insetBottom: "0px",
        alignSelf: "unsafe center",
      },
      {
        insetLeft: "10px",
        insetRight: "-10px",
        insetTop: "5px",
        insetBottom: "-5px",
      },
    ],
    [
      "Left+Right",
      { insetLeft: "20px", insetRight: "20px", insetTop: "10px" },
      { insetLeft: "30px", insetRight: "10px", insetTop: "15px" },
    ],
  ])(
    "an absolute drag keeps its constraint — %s (ADR-275)",
    async (_, layout, expected) => {
      const { workspace, scene, gestures, record, center } = await open();
      const set = (value: string) => ({ kind: "set" as const, value });
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: id("box") }],
          sizing: { height: { kind: "set", value: 200 } },
        }),
      );
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: id("d") }],
          layout: {
            position: set("absolute"),
            ...Object.fromEntries(
              Object.entries(layout).map(([key, value]) => [key, set(value)]),
            ),
          },
          // A Left+Right box stretches (width auto — Decision 4; the Text definition's is 100 %).
          ...("insetLeft" in layout &&
          "insetRight" in layout &&
          !("justifySelf" in layout)
            ? { visual: { width: set("auto") } }
            : { sizing: { width: { kind: "set", value: 60 } } }),
        }),
      );
      scene.sync();
      workspace.selectRecords([record("d")]);
      const [x, y] = center("d");
      gestures.beginMove(x, y, record("d"));
      gestures.update(x + 10, y + 5, 1);
      gestures.finish();
      const entry = workspace.runtime.graph.getEntry(id("d"));
      const written = Object.fromEntries(
        Object.entries((entry?.kind === "node" && entry.layout) || {}).map(
          ([key, write]) => [key, write?.kind === "set" ? write.value : write],
        ),
      );
      expect(written).toMatchObject(expected);
      // The constraint's other sides are not added (a Right box gets no Left).
      if (!("insetLeft" in layout)) expect(written.insetLeft).toBeUndefined();
    },
  );

  // ADR-275 Phase 7: a fixed box's drag writes its insets in the page viewport (1920 × 1080), not
  // its parent — a Right · Bottom box moves its right · bottom insets from the screen's edges.
  it("a fixed drag keeps its constraint in the page viewport (ADR-275 Phase 7)", async () => {
    const { workspace, scene, gestures, record, center } = await open();
    const set = (value: string) => ({ kind: "set" as const, value });
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("d") }],
        layout: {
          position: set("fixed"),
          insetRight: set("30px"),
          insetBottom: set("40px"),
        },
        sizing: { width: { kind: "set", value: 60 } },
      }),
    );
    scene.sync();
    const body = scene.stream.boundsMap.get(
      workspace.root.recordsOfSource(BODY)[0],
    )!;
    const placed = scene.stream.boundsMap.get(record("d"))!;
    expect(placed.x + placed.width - body.x).toBe(1920 - 30);
    workspace.selectRecords([record("d")]);
    const [x, y] = center("d");
    gestures.beginMove(x, y, record("d"));
    gestures.update(x + 10, y + 5, 1);
    gestures.finish();
    const entry = workspace.runtime.graph.getEntry(id("d"));
    const layout = entry?.kind === "node" ? entry.layout : undefined;
    expect(layout?.insetRight).toEqual(set("20px"));
    expect(layout?.insetBottom).toEqual(set("35px"));
    expect(layout?.insetLeft).toBeUndefined();
  });

  it("an absolute drag snaps to its parent's edge and to manual guides; ⌘ (snap off) moves freely", async () => {
    const { workspace, scene, gestures, record, center, box, guides } =
      await open();
    workspace.execute(placeAbsolute({ kind: "node", id: id("d") }, 10, 12));
    // Its parent keeps a height of its own (an absolute child adds none): the drag stays over it.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("box") }],
        sizing: { height: { kind: "set", value: 200 } },
      }),
    );
    // The Canvas draws the placed box before the user grabs it (the move starts from it).
    scene.sync();
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
    expect(absolutePlacementOf(entry)).toEqual({
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

  // The old spacing interaction read the Styles box model's padding link (any side → all four)
  // and published the drag to the panel (`setActiveSpacingSession`); the catalog Canvas does both.
  it("padding link ON: one handle drags all four sides; the Styles panel follows the drag's value and sides", async () => {
    const { workspace, gestures, record, live } = await open({
      paddingLinked: () => true,
    });
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
    expect(gestures.beginSpacing(tx, ty, 1)).toBe(true);
    gestures.update(tx, ty + 10, 1);
    // The panel's view while dragging: 18 on all four sides of this record.
    const view = useSpacingSessionView(live.at(-1)!);
    expect(view.properties).toEqual([
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ]);
    expect(readSessionSpacingValue(view, record("list"), "paddingLeft")).toBe(
      18,
    );
    expect(
      readSessionSpacingValue(view, record("a"), "paddingLeft"),
    ).toBeNull();
    gestures.finish();
    expect(live.at(-1)).toBeNull();
    const entry = workspace.runtime.graph.getEntry(id("list"));
    expect(entry?.kind === "node" ? entry.visual : {}).toMatchObject({
      paddingTop: { kind: "set", value: 18 },
      paddingRight: { kind: "set", value: 18 },
      paddingBottom: { kind: "set", value: 18 },
      paddingLeft: { kind: "set", value: 18 },
    });
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
    workspace.execute(placeAbsolute({ kind: "node", id: id("d") }, 10, 12));
    workspace.selectRecords([record("d")]);
    const [dx, dy] = center("d");
    gestures.beginMove(dx, dy, record("d"), { copy: true });
    gestures.update(dx + 30, dy + 5, 1);
    expect(gestures.finish()).toBe(true);
    const [original, duplicate] = children("box");
    const placementOf = (nodeId: NodeId | undefined) => {
      const entry = nodeId ? workspace.runtime.graph.getEntry(nodeId) : null;
      return absolutePlacementOf(entry);
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
          // Smaller than the frame it is dragged over (the size rule would skip a larger one).
          {
            ...node("form2", "lib:definition:type-Form"),
            sizing: {
              width: { kind: "set", value: 100 },
              height: { kind: "set", value: 40 },
            },
          },
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
      workspace.execute(placeAbsolute({ kind: "node", id: id(name) }, x, y));
    const placementOf = (name: string) => {
      const entry = workspace.runtime.graph.getEntry(id(name));
      return absolutePlacementOf(entry);
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

/**
 * 2026-10-15 Canvas drop 규칙 (사용자 결정 — Figma 기준): grid 는 커서에 가장 가까운 칸 사이로,
 * absolute 형제는 흐름 순서에 끼지 않고, 끄는 객체가 부모보다 크면 넣지 않으며 (⌘ 로 우회),
 * Control drag 는 놓은 자리에 absolute 로 둔다.
 */
describe("Canvas drop rules (Figma)", () => {
  const placementOf = (workspace: CatalogWorkspace, name: string) => {
    const entry = workspace.runtime.graph.getEntry(id(name));
    return absolutePlacementOf(entry);
  };

  it("over another item's cell (Figma, 2026-10-16 사용자 결정): the node takes it, the item in its way goes to the nearest empty cell", async () => {
    const { workspace, scene, gestures, record, box, center } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("list") }],
        layout: {
          display: { kind: "set", value: "grid" },
          gridTemplateColumns: { kind: "set", value: "1fr 1fr" },
        },
      }),
    );
    scene.sync();
    // a · b on the first row, c below a.
    expect(box("b").y).toBe(box("a").y);
    expect(box("c").y).toBeGreaterThan(box("a").y);
    workspace.selectRecords([record("c")]);
    const [cx, cy] = center("c");
    const a = box("a");
    gestures.beginMove(cx, cy, record("c"));
    gestures.update(a.x + a.width * 0.75, a.y + a.height / 2, 1);
    expect(gestures.preview()!.cell).toEqual({
      x: a.x,
      y: a.y,
      width: a.width,
      height: expect.any(Number),
    });
    expect(gestures.preview()!.line).toBeUndefined();
    gestures.finish();
    scene.sync();
    const lines = (name: string) => {
      const entry = workspace.runtime.graph.getEntry(id(name));
      const layout = entry?.kind === "node" ? entry.layout : undefined;
      return [layout?.gridColumnStart, layout?.gridRowStart].map(
        (write) => (write as { value?: string } | undefined)?.value,
      );
    };
    expect(lines("c")).toEqual(["1", "1"]);
    // a: the free cell nearest its own (c's old cell, below it).
    expect(lines("a")).toEqual(["1", "2"]);
    expect(box("c").x).toBe(a.x);
    expect(box("c").y).toBe(a.y);
    expect(box("a").y).toBeGreaterThan(box("c").y);
  });

  it("a grid target (Figma): every cell outlined; an append from outside fills the empty cell; a row start's line sits mid-padding", async () => {
    const { workspace, scene, gestures, record, box, center } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("list") }],
        layout: {
          display: { kind: "set", value: "grid" },
          gridTemplateColumns: { kind: "set", value: "1fr 1fr" },
        },
        visual: {
          paddingLeft: { kind: "set", value: 40 },
          gap: { kind: "set", value: 30 },
        },
      }),
    );
    scene.sync();
    const list = box("list");
    const a = box("a");
    const b = box("b");
    const c = box("c");
    // d (in box) into the grid's empty cell beside c: the cell is filled, no line.
    workspace.selectRecords([record("d")]);
    const [dx, dy] = center("d");
    gestures.beginMove(dx, dy, record("d"));
    // ⌘: the text d is as wide as the page (the size rule would keep it out).
    gestures.update(b.x + b.width / 2, c.y + c.height / 2, 1, {
      bypassSize: true,
    });
    const preview = gestures.preview()!;
    expect(preview.cells).toHaveLength(4);
    expect(preview.cell).toEqual({
      x: b.x,
      y: c.y,
      width: b.width,
      height: c.height,
    });
    expect(preview.line).toBeUndefined();
    // Over a: its cell (Figma — a goes to an empty cell on the drop), no line.
    gestures.update(a.x + 2, a.y + a.height / 2, 1, { bypassSize: true });
    expect(gestures.preview()!.cell?.x).toBe(a.x);
    expect(gestures.preview()!.cell?.y).toBe(a.y);
    expect(gestures.preview()!.line).toBeUndefined();
    expect(list.x).toBeLessThan(a.x);
    gestures.cancel();
  });

  /**
   * 2026-10-16 사용자 요청 「빈 칸에 놓기도 Figma 처럼 — 순차적이지 않게 빈칸을 건너 배치, 2칸도
   * 지정」: an empty cell pins the node there (`gridColumnStart` · `gridRowStart`), the siblings the
   * move would shift stay pinned where they are, a spanning node takes its cells.
   */
  const gridOf = async (
    layout: Record<string, string> = {},
    extra: Parameters<typeof setFields>[0]["layout"] = {},
  ) => {
    const opened = await open();
    opened.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("list") }],
        layout: {
          display: { kind: "set", value: "grid" },
          // The Layout section's tracks (2026-10-16): they share the grid size, an item never grows them.
          gridTemplateColumns: {
            kind: "set",
            value: "repeat(3, minmax(0, 1fr))",
          },
          gridTemplateRows: { kind: "set", value: "repeat(3, minmax(0, 1fr))" },
          ...Object.fromEntries(
            Object.entries(layout).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          ...extra,
        },
        sizing: {
          width: { kind: "set", value: 600 },
          height: { kind: "set", value: 300 },
        },
      }),
    );
    opened.scene.sync();
    return opened;
  };
  const linesOf = (workspace: CatalogWorkspace, name: string) => {
    const entry = workspace.runtime.graph.getEntry(id(name));
    const layout = entry?.kind === "node" ? entry.layout : undefined;
    const value = (write: unknown) =>
      (write as { value?: string } | undefined)?.value;
    return [
      value(layout?.gridColumnStart),
      value(layout?.gridRowStart),
      value(layout?.gridColumnEnd),
      value(layout?.gridRowEnd),
    ];
  };

  it("an empty cell past others (not the next one): the node is pinned there, the siblings stay", async () => {
    const { workspace, scene, gestures, record, box, center } = await gridOf();
    const list = box("list");
    const b = box("b");
    const c = box("c");
    // a · b · c fill the first row; a goes to the last column of the third row.
    expect(b.y).toBe(box("a").y);
    workspace.selectRecords([record("a")]);
    const [ax, ay] = center("a");
    gestures.beginMove(ax, ay, record("a"));
    const target = { x: c.x + c.width / 2, y: list.y + list.height - 20 };
    gestures.update(target.x, target.y, 1);
    const preview = gestures.preview()!;
    expect(preview.cells).toHaveLength(9);
    expect(preview.cell).toEqual(preview.cells![8]);
    expect(preview.line).toBeUndefined();
    const depth = workspace.runtime.historyDepth.undo;
    expect(gestures.finish()).toBe(true);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    scene.sync();
    expect(linesOf(workspace, "a").slice(0, 2)).toEqual(["3", "3"]);
    // b · c would close up to the first columns: pinned where they were.
    expect(linesOf(workspace, "b").slice(0, 2)).toEqual(["2", "1"]);
    expect(linesOf(workspace, "c").slice(0, 2)).toEqual(["3", "1"]);
    // The engine places them so: a in the bottom-right cell, b · c unmoved, the first cell empty.
    expect(box("b")).toEqual(b);
    expect(box("c")).toEqual(c);
    expect(box("a").x).toBe(c.x);
    expect(box("a").y).toBeGreaterThan(list.y + list.height / 2);
    // Back over b (Figma): a takes b's cell, b goes to the nearest empty one (the first).
    const [, by] = center("b");
    workspace.selectRecords([record("a")]);
    const [ax2, ay2] = center("a");
    gestures.beginMove(ax2, ay2, record("a"));
    gestures.update(box("b").x + 2, by, 1);
    expect(gestures.preview()!.cell).toEqual(preview.cells![1]);
    gestures.finish();
    expect(linesOf(workspace, "a").slice(0, 2)).toEqual(["2", "1"]);
    expect(linesOf(workspace, "b").slice(0, 2)).toEqual(["1", "1"]);
    expect(linesOf(workspace, "c").slice(0, 2)).toEqual(["3", "1"]);
  });

  it("a taken cell with no empty one left (Figma): the item in its way goes to a new row — the row template grows", async () => {
    const { workspace, scene, gestures, record, box, center } = await gridOf({
      gridTemplateRows: "minmax(0, 1fr)",
    });
    // a · b · c fill the one row; d (in box) is dropped on b.
    workspace.selectRecords([record("d")]);
    const [dx, dy] = center("d");
    const b = box("b");
    gestures.beginMove(dx, dy, record("d"));
    gestures.update(b.x + b.width / 2, b.y + b.height / 2, 1, {
      bypassSize: true,
    });
    expect(gestures.preview()!.cell?.x).toBe(b.x);
    const depth = workspace.runtime.historyDepth.undo;
    expect(gestures.finish()).toBe(true);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    scene.sync();
    expect(linesOf(workspace, "d").slice(0, 2)).toEqual(["2", "1"]);
    // b: the nearest cell in the new row (right below where it was).
    expect(linesOf(workspace, "b").slice(0, 2)).toEqual(["2", "2"]);
    const list = workspace.runtime.graph.getEntry(id("list"));
    expect(
      list?.kind === "node" &&
        (list.layout?.gridTemplateRows as { value?: string }).value,
    ).toBe("repeat(2, minmax(0, 1fr))");
    expect(box("b").y).toBeGreaterThan(box("d").y);
  });

  it("a node spanning two columns takes an empty cell only where both are free, and keeps its span", async () => {
    const { workspace, scene, gestures, record, box, center } = await gridOf();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("a") }],
        layout: { gridColumnEnd: { kind: "set", value: "span 2" } },
      }),
    );
    scene.sync();
    const list = box("list");
    // a spans the first two columns, b the third, c the next row.
    expect(box("a").width).toBeGreaterThan(box("b").width * 1.5);
    workspace.selectRecords([record("a")]);
    const [ax, ay] = center("a");
    gestures.beginMove(ax, ay, record("a"));
    // The last column of the bottom row: two columns do not fit there — the cell is not offered.
    const cellWidth = box("b").width;
    gestures.update(list.x + list.width - 10, list.y + list.height - 20, 1);
    const right = gestures.preview()!.cell;
    expect(right?.x ?? 0).toBeLessThan(list.x + list.width - cellWidth * 1.5);
    // The bottom row's first column: both columns, one span-wide cell.
    gestures.update(list.x + 20, list.y + list.height - 20, 1);
    const cell = gestures.preview()!.cell!;
    expect(cell.width).toBeGreaterThan(cellWidth * 1.5);
    gestures.finish();
    scene.sync();
    expect(linesOf(workspace, "a")).toEqual(["1", "3", "span 2", undefined]);
    expect(box("a").y).toBeGreaterThan(list.y + list.height / 2);
    expect(box("a").width).toBeGreaterThan(cellWidth * 1.5);
  });

  /**
   * 2026-10-16 사용자 지적 「Figma — 2칸만큼 드래그해도 grid 2칸이 병합되는 것은 아니다, 드랍한 요소가
   * 2칸만큼 공간을 차지하는 것. 현재는 grid 칸이 늘어난다」: an item two cells wide takes two
   * cells (`span 2`); the cells keep their size (a `1fr` track grew to the item before).
   */
  it("a node two cells wide dropped into a cell takes two cells — the cells keep their size", async () => {
    const { workspace, scene, gestures, record, box, center } = await gridOf();
    const list = box("list");
    const cellsBefore = gestures.gridCellsOfRecord(record("list"));
    expect(cellsBefore[0]!.width).toBe(200);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("d") }],
        sizing: { width: { kind: "set", value: 400 } },
      }),
    );
    scene.sync();
    workspace.selectRecords([record("d")]);
    const [dx, dy] = center("d");
    gestures.beginMove(dx, dy, record("d"));
    gestures.update(list.x + 20, list.y + list.height - 20, 1);
    // The cell shown is the two cells it takes.
    expect(gestures.preview()!.cell).toEqual({
      x: list.x,
      y: list.y + 200,
      width: 400,
      height: 100,
    });
    gestures.finish();
    scene.sync();
    expect(linesOf(workspace, "d")).toEqual(["1", "3", "span 2", undefined]);
    const cellsAfter = gestures.gridCellsOfRecord(record("list"));
    expect(cellsAfter.map((cell) => cell.width)).toEqual(
      cellsBefore.map((cell) => cell.width),
    );
    expect(box("d")).toMatchObject({ x: list.x, y: list.y + 200, width: 400 });
  });

  const fillOf = (workspace: CatalogWorkspace, name: string) => {
    const entry = workspace.runtime.graph.getEntry(id(name));
    return entry?.kind === "node" ? entry.fillSizing : undefined;
  };
  const sizingOf = (workspace: CatalogWorkspace, name: string) => {
    const entry = workspace.runtime.graph.getEntry(id(name));
    return entry?.kind === "node" ? entry.sizing : undefined;
  };

  // 사용자 결정 (2026-10-16 「Figma 방식으로 진행해」 — 같은 날 「핸들 span 계산은 빼고 요소만
  // 늘어나게」 를 바꿈): a handle released on a cell line takes the cells up to it (span) and fills
  // them (Figma — the dimension becomes Fill container); the cells keep their size.
  it("resizing a grid child onto a column line takes the cells up to it and fills them", async () => {
    const { workspace, scene, gestures, record, box } = await gridOf();
    const cellsBefore = gestures.gridCellsOfRecord(record("list"));
    workspace.selectRecords([record("a")]);
    const a = box("a");
    const edge = { x: a.x + a.width, y: a.y + a.height / 2 };
    expect(gestures.beginResize(edge.x, edge.y, 1)).toBe(true);
    // 3 px short of the second column's end (columns 200): it snaps there.
    gestures.update(a.x + 397, edge.y, 1);
    // 2026-10-16 사용자 보고 「크기 조절 드래그 시작하면 안 보인다」: the parent grid's cells stay
    // outlined while its child resizes (Figma).
    expect(gestures.preview()?.gridGuides).toEqual(cellsBefore);
    gestures.finish();
    scene.sync();
    // Pinned where it is, two columns, the width filling them (no fixed width).
    expect(linesOf(workspace, "a")).toEqual(["1", "1", "span 2", undefined]);
    expect(fillOf(workspace, "a")?.width).toEqual({ factor: 1 });
    expect(sizingOf(workspace, "a")?.width).toBeUndefined();
    expect(box("a")).toMatchObject({ x: a.x, y: a.y, width: 400 });
    expect(gestures.gridCellsOfRecord(record("list"))).toEqual(cellsBefore);
  });

  it("resizing a grid child onto a row line takes the rows up to it — two rows, height filling them", async () => {
    const { workspace, scene, gestures, record, box } = await gridOf();
    workspace.selectRecords([record("a")]);
    const a = box("a");
    expect(a.y).toBe(box("list").y);
    const edge = { x: a.x + a.width / 2, y: a.y + a.height };
    expect(gestures.beginResize(edge.x, edge.y, 1)).toBe(true);
    // 3 px short of the second row's bottom (rows 100): it snaps to 200.
    gestures.update(edge.x, a.y + 197, 1);
    gestures.finish();
    scene.sync();
    expect(linesOf(workspace, "a")).toEqual(["1", "1", undefined, "span 2"]);
    expect(fillOf(workspace, "a")?.height).toEqual({ factor: 1 });
    expect(box("a").height).toBe(200);
  });

  it("a handle released off the cell lines (or with snap off) only sizes the node — no span", async () => {
    const { workspace, scene, gestures, record, box } = await gridOf();
    const cellsBefore = gestures.gridCellsOfRecord(record("list"));
    const b = box("b");
    workspace.selectRecords([record("a")]);
    const a = box("a");
    const edge = { x: a.x + a.width, y: a.y + a.height / 2 };
    expect(gestures.beginResize(edge.x, edge.y, 1)).toBe(true);
    gestures.update(a.x + 350, edge.y, 1);
    gestures.finish();
    scene.sync();
    expect(linesOf(workspace, "a")).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(box("a").width).toBe(350);
    expect(fillOf(workspace, "a")?.width).toBeUndefined();
    expect(gestures.gridCellsOfRecord(record("list"))).toEqual(cellsBefore);
    expect(box("b")).toEqual(b);
    // ⌘ (snap off) on a line: the size only.
    workspace.selectRecords([record("a")]);
    const wide = box("a");
    expect(
      gestures.beginResize(wide.x + wide.width, wide.y + wide.height / 2, 1),
    ).toBe(true);
    gestures.update(wide.x + 400, wide.y + wide.height / 2, 1, { snap: false });
    gestures.finish();
    scene.sync();
    expect(linesOf(workspace, "a")[2]).toBeUndefined();
    expect(box("a").width).toBe(400);
  });

  // 2026-10-16 사용자 보고 「배치는 되지만 1칸 이상 그려지지 않음」: a node two rows tall over the last
  // row took it and hung below the grid (a 0-high implicit row) — it goes where both rows are in.
  it("a node two rows tall is offered only cells whose rows are all inside the grid", async () => {
    const { workspace, scene, gestures, record, box, center } = await gridOf();
    const list = box("list");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("d") }],
        sizing: {
          width: { kind: "set", value: 100 },
          height: { kind: "set", value: 200 },
        },
      }),
    );
    scene.sync();
    workspace.selectRecords([record("d")]);
    const [dx, dy] = center("d");
    gestures.beginMove(dx, dy, record("d"));
    // Over the last row's middle cell.
    gestures.update(list.x + 300, list.y + 250, 1);
    expect(gestures.preview()!.cell).toEqual({
      x: list.x + 200,
      y: list.y + 100,
      width: 200,
      height: 200,
    });
    gestures.finish();
    scene.sync();
    expect(linesOf(workspace, "d")).toEqual(["2", "2", undefined, "span 2"]);
    expect(box("d").y + box("d").height).toBeLessThanOrEqual(
      list.y + list.height,
    );
    expect(box("list").height).toBe(list.height);
  });

  /**
   * 2026-10-16 사용자 보고 「col span, row span 이 1 × 1 이상일 때 일부 가이드 배경을 잘 못 찾는다」:
   * a spanning node's cell follows the dragged box (the pointer keeps the cell it grabbed inside the
   * span), its own cells are offered like empty ones, and another item's cell takes the drop only
   * under the pointer.
   */
  const spanGrid = async () => {
    const opened = await gridOf({
      gridTemplateRows: "repeat(4, minmax(0, 1fr))",
    });
    opened.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("list") }],
        sizing: { height: { kind: "set", value: 400 } },
      }),
    );
    opened.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("a") }],
        layout: {
          gridColumnEnd: { kind: "set", value: "span 2" },
          gridRowEnd: { kind: "set", value: "span 2" },
        },
      }),
    );
    opened.scene.sync();
    const { workspace, gestures, record, box } = opened;
    // a takes columns 1–2 of rows 1–2 (cells 200 × 100), b and c the third column.
    const list = box("list");
    expect(box("a")).toMatchObject({ x: list.x, y: list.y, width: 400 });
    workspace.selectRecords([record("a")]);
    // Grabbed in its second column.
    const grab = { x: box("a").x + 200, y: box("a").y + 20 };
    gestures.beginMove(grab.x, grab.y, record("a"));
    return { ...opened, list, grab };
  };

  it("a spanning node's cell follows the dragged box, not the cell under the pointer", async () => {
    const { gestures, list, grab } = await spanGrid();
    // The box's top-left over the first column of the third row; the pointer over its second column.
    gestures.update(grab.x + 10, grab.y + 210, 1);
    expect(gestures.preview()!.cell).toEqual({
      x: list.x,
      y: list.y + 200,
      width: 400,
      height: 200,
    });
    gestures.cancel();
  });

  it("a spanning node over its own cells shows them (no command on release)", async () => {
    const { workspace, gestures, list, grab } = await spanGrid();
    gestures.update(grab.x + 30, grab.y + 20, 1);
    expect(gestures.preview()!.cell).toEqual({
      x: list.x,
      y: list.y,
      width: 400,
      height: 200,
    });
    expect(gestures.preview()!.line).toBeUndefined();
    const depth = workspace.runtime.historyDepth.undo;
    gestures.finish();
    expect(workspace.runtime.historyDepth.undo).toBe(depth);
  });

  it("near another item's cell (the pointer not on it) a spanning node keeps the empty cells it fits", async () => {
    const { gestures, list, grab } = await spanGrid();
    // The pointer over the third column of the third row, 5 px below c's cell.
    gestures.update(list.x + 500, list.y + 205, 1);
    expect(grab.x).toBe(list.x + 200);
    expect(gestures.preview()!.cell).toEqual({
      x: list.x + 200,
      y: list.y + 200,
      width: 400,
      height: 200,
    });
    gestures.cancel();
  });

  it("a copy (Alt) into an empty cell is pinned there; the original stays", async () => {
    const { workspace, scene, gestures, record, box, center } = await gridOf();
    const list = box("list");
    workspace.selectRecords([record("b")]);
    const [bx, by] = center("b");
    gestures.beginMove(bx, by, record("b"), { copy: true });
    gestures.update(list.x + 20, list.y + list.height - 20, 1);
    expect(gestures.preview()!.cell).toBeDefined();
    gestures.finish();
    scene.sync();
    const entry = workspace.runtime.graph.getEntry(id("list"));
    const kids = entry?.kind === "node" ? entry.children : [];
    expect(kids).toHaveLength(4);
    const copy = kids.find(
      (kid) => ![id("a"), id("b"), id("c")].includes(kid),
    )!;
    const copyEntry = workspace.runtime.graph.getEntry(copy);
    const layout = copyEntry?.kind === "node" ? copyEntry.layout : undefined;
    expect(
      [layout?.gridColumnStart, layout?.gridRowStart].map(
        (write) => (write as { value?: string } | undefined)?.value,
      ),
    ).toEqual(["1", "3"]);
    expect(linesOf(workspace, "b").slice(0, 2)).toEqual([undefined, undefined]);
  });

  it("absolute siblings take no flow slot: the line follows the flow children", async () => {
    const { workspace, scene, gestures, record, box, center } = await open();
    workspace.execute(placeAbsolute({ kind: "node", id: id("b") }, 0, 300));
    scene.sync();
    workspace.selectRecords([record("c")]);
    const [cx, cy] = center("c");
    const a = box("a");
    gestures.beginMove(cx, cy, record("c"));
    gestures.update(a.x + 4, a.y + a.height * 0.75, 1);
    const line = gestures.preview()!.line!;
    expect(line.height).toBe(0);
    // After a (its bottom edge), not at b's box 300 px below.
    expect(line.y).toBeCloseTo(a.y + a.height, 0);
  });

  it("an object larger than a container does not enter it; ⌘ bypasses the size rule", async () => {
    const { workspace, scene, gestures, record, box, center, children } =
      await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("box") }],
        sizing: {
          width: { kind: "set", value: 60 },
          height: { kind: "set", value: 60 },
        },
      }),
    );
    scene.sync();
    expect(box("a").width).toBeGreaterThan(60);
    workspace.selectRecords([record("a")]);
    const [ax, ay] = center("a");
    const target = box("box");
    const over = [target.x + 5, target.y + 50] as const;
    gestures.beginMove(ax, ay, record("a"));
    gestures.update(...over, 1);
    expect(gestures.preview()?.container).not.toEqual(target);
    gestures.cancel();

    gestures.beginMove(ax, ay, record("a"));
    gestures.update(...over, 1, { bypassSize: true });
    expect(gestures.preview()?.container).toEqual(target);
    gestures.finish();
    expect(children("box")).toContain(id("a"));
  });

  it("Control drag places the node absolutely where it is dropped (front of the container, one step)", async () => {
    const { workspace, scene, gestures, record, box, center, children } =
      await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("box") }],
        sizing: {
          width: { kind: "set", value: 400 },
          height: { kind: "set", value: 200 },
        },
      }),
    );
    // Narrower than the frame (the size rule lets it in).
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("a") }],
        sizing: { width: { kind: "set", value: 120 } },
      }),
    );
    scene.sync();
    workspace.selectRecords([record("a")]);
    const [ax, ay] = center("a");
    const start = box("a");
    const target = box("box");
    const point = [target.x + 30, target.y + 120] as const;
    gestures.beginMove(ax, ay, record("a"));
    gestures.update(...point, 1, { absolute: true });
    expect(gestures.preview()?.line).toBeUndefined();
    expect(gestures.preview()?.container).toEqual(target);
    const depth = workspace.runtime.historyDepth.undo;
    expect(gestures.finish()).toBe(true);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(children("box").at(-1)).toBe(id("a"));
    expect(placementOf(workspace, "a")).toEqual({
      kind: "absolute",
      x: Math.round(start.x + point[0] - ax - target.x),
      y: Math.round(start.y + point[1] - ay - target.y),
    });

    // Over its own parent: it stays there, placed at the offset.
    workspace.undo();
    scene.sync();
    workspace.selectRecords([record("b")]);
    const [bx, by] = center("b");
    const bStart = box("b");
    const list = box("list");
    gestures.beginMove(bx, by, record("b"));
    gestures.update(bx + 20, by + 10, 1, { absolute: true });
    gestures.finish();
    expect(children("list")).toEqual([id("a"), id("c"), id("b")]);
    expect(placementOf(workspace, "b")).toEqual({
      kind: "absolute",
      x: Math.round(bStart.x + 20 - list.x),
      y: Math.round(bStart.y + 10 - list.y),
    });
  });
});

/**
 * 2026-10-15 drag 중 표현 (사용자: Figma · Pen.dev — 끄는 요소의 실제 모습 · 형제가 비킨다): 흐름
 * 컨테이너 안팎으로 끄는 동안 형제의 목표 offset — 빠진 자리를 메우고 끼울 자리를 연다.
 */
describe("drag presentation — the dragged element and its siblings' reflow", () => {
  it("a reorder in a column: the dragged follows the pointer, the siblings close up and open its slot", async () => {
    const { workspace, gestures, record, box, center } = await open();
    workspace.selectRecords([record("a")]);
    const [ax, ay] = center("a");
    const a = box("a");
    const c = box("c");
    gestures.beginMove(ax, ay, record("a"));
    gestures.update(ax, c.y + c.height - 1, 1);
    const view = gestures.dragPresentation()!;
    expect(view.records).toEqual([record("a")]);
    expect(view.dy).toBe(c.y + c.height - 1 - ay);
    // a goes after c: b and c move up by a's height (no gap here).
    expect(view.siblings.get(record("b"))).toEqual({ dx: 0, dy: -a.height });
    expect(view.siblings.get(record("c"))).toEqual({ dx: 0, dy: -a.height });
    // The opened slot shows the drop: no insertion line over a reflowed flow.
    expect(gestures.preview()?.reflow).toBe(true);
  });

  it("into another container (Figma · pen.dev): the source closes up, the target keeps its siblings — the line and its frame show the drop, the dragged is faded", async () => {
    const { workspace, gestures, record, box, center } = await open();
    workspace.selectRecords([record("b")]);
    const [bx, by] = center("b");
    const b = box("b");
    const d = box("d");
    gestures.beginMove(bx, by, record("b"));
    gestures.update(d.x + 4, d.y + 2, 1);
    const view = gestures.dragPresentation()!;
    expect(view.siblings.get(record("a"))).toBeUndefined();
    expect(view.siblings.get(record("c"))).toEqual({ dx: 0, dy: -b.height });
    expect(view.siblings.get(record("d"))).toBeUndefined();
    expect(view.outside).toBe(true);
    const preview = gestures.preview()!;
    expect(preview.reflow).toBeFalsy();
    expect(preview.line).toBeDefined();
    expect(preview.container).toEqual(box("box"));
    // Back over its own column: opaque, no frame.
    const [ax, ay] = center("a");
    gestures.update(ax, ay, 1);
    expect(gestures.dragPresentation()!.outside).toBe(false);
    expect(gestures.preview()!.container).toBeUndefined();
  });

  it("the line (Figma): inside the padding, as long as the dragged box; half a gap before the first child, mid-gap between, half a gap after the last", async () => {
    const { workspace, scene, gestures, record, box, center } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("box") }],
        layout: {
          display: { kind: "set", value: "flex" },
          flexDirection: { kind: "set", value: "column" },
        },
        visual: {
          paddingTop: { kind: "set", value: 40 },
          paddingLeft: { kind: "set", value: 24 },
          gap: { kind: "set", value: 30 },
        },
      }),
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: id("box") },
        entries: [text("e")],
        rootIds: [id("e")],
        newId: allocator(),
      }),
    );
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("a") }],
        sizing: { width: { kind: "set", value: 120 } },
      }),
    );
    scene.sync();
    const frame = box("box");
    const d = box("d");
    const e = box("e");
    expect(d.y).toBe(frame.y + 40);
    expect(e.y - (d.y + d.height)).toBe(30);
    workspace.selectRecords([record("a")]);
    const [ax, ay] = center("a");
    const line = (y: number) => {
      gestures.update(d.x + 4, y, 1);
      return gestures.preview()!.line!;
    };
    gestures.beginMove(ax, ay, record("a"));
    // Before d: half the gap above it, from the content start, the dragged width long.
    expect(line(d.y + 2)).toEqual({
      x: frame.x + 24,
      y: d.y - 15,
      width: 120,
      height: 0,
    });
    // Between d and e: the middle of the gap.
    expect(line(e.y + 2).y).toBe(d.y + d.height + 15);
    // After e: half the gap below it.
    expect(line(e.y + e.height - 2).y).toBe(e.y + e.height + 15);
    gestures.cancel();
  });

  it("an empty container: the line at its content start, inside the padding", async () => {
    const { workspace, scene, gestures, record, box, center } = await open();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            ...node("empty", "lib:definition:type-frame"),
            // Full width (the dragged text is as wide as the page: the size rule lets it in).
            sizing: { height: { kind: "set", value: 120 } },
            visual: {
              paddingTop: { kind: "set", value: 10 },
              paddingLeft: { kind: "set", value: 16 },
            },
          },
        ],
        rootIds: [id("empty")],
        newId: allocator(),
      }),
    );
    scene.sync();
    workspace.selectRecords([record("a")]);
    const [ax, ay] = center("a");
    const [ex, ey] = center("empty");
    const frame = box("empty");
    gestures.beginMove(ax, ay, record("a"));
    gestures.update(ex, ey, 1);
    expect(gestures.preview()!.line).toMatchObject({
      x: frame.x + 16,
      y: frame.y + 10,
    });
    gestures.cancel();
  });

  it("Alt (copy): the original stays — no element offset, no reflow; a grid keeps its line", async () => {
    const { workspace, scene, gestures, record, box, center } = await open();
    workspace.selectRecords([record("a")]);
    const [ax, ay] = center("a");
    const c = box("c");
    gestures.beginMove(ax, ay, record("a"), { copy: true });
    gestures.update(ax, c.y + c.height - 1, 1);
    expect(gestures.dragPresentation()).toMatchObject({ records: [] });
    expect(gestures.dragPresentation()!.siblings.size).toBe(0);
    gestures.cancel();

    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("list") }],
        layout: {
          display: { kind: "set", value: "grid" },
          gridTemplateColumns: { kind: "set", value: "1fr 1fr" },
        },
      }),
    );
    scene.sync();
    const [cx, cy] = center("c");
    const a = box("a");
    workspace.selectRecords([record("c")]);
    gestures.beginMove(cx, cy, record("c"));
    gestures.update(a.x + a.width * 0.75, a.y + a.height / 2, 1);
    expect(gestures.preview()?.reflow).toBeFalsy();
    expect(gestures.dragPresentation()!.siblings.size).toBe(0);
  });
});

/**
 * 2026-10-15 drag 중 거리 · 중심선 (사용자 결정 — 키 없이 자동, ⌥ 는 정지 측정 · 복제): absolute 로
 * 놓이는 drag 는 네 변에서 가장 가까운 형제 · 부모 가장자리까지의 거리, 흐름 drag 는 끄는 요소의
 * 중심이 놓일 컨테이너의 중심과 맞을 때 중심선 (표시만 — 흡착 없음).
 */
describe("drag guides — distances (absolute) and the centre line (flow)", () => {
  it("an absolute drag measures each side to its parent's edge", async () => {
    const { workspace, scene, gestures, record, box, center } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("box") }],
        sizing: {
          width: { kind: "set", value: 400 },
          height: { kind: "set", value: 200 },
        },
      }),
    );
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("d") }],
        sizing: { width: { kind: "set", value: 80 } },
      }),
    );
    workspace.execute(placeAbsolute({ kind: "node", id: id("d") }, 10, 12));
    scene.sync();
    workspace.selectRecords([record("d")]);
    const parent = box("box");
    const [x, y] = center("d");
    gestures.beginMove(x, y, record("d"));
    gestures.update(x + 30, y + 20, 1);
    const ghost = gestures.preview()!.ghost!;
    const distances = gestures.preview()!.distances!;
    expect(distances.map((g) => [g.axis, g.start, g.end])).toEqual([
      ["x", ghost.x + ghost.width, parent.x + parent.width],
      ["x", parent.x, ghost.x],
      ["y", ghost.y + ghost.height, parent.y + parent.height],
      ["y", parent.y, ghost.y],
    ]);
    expect(distances[1]!.value).toBe(40);
    gestures.cancel();
  });

  it("a flow drag shows the container's centre line only while the centres meet (no snap)", async () => {
    const { workspace, gestures, record, box, center } = await open();
    workspace.selectRecords([record("a")]);
    const list = box("list");
    const a = box("a");
    // a sits left in the column: move it so its centre is 2 px off the list's centre.
    const [ax, ay] = center("a");
    const toCentre = list.x + list.width / 2 - (a.x + a.width / 2);
    gestures.beginMove(ax, ay, record("a"));
    gestures.update(ax + toCentre + 2, ay + 10, 1);
    const line = gestures
      .preview()
      ?.snapGuides?.find((g) => g.kind === "line" && g.axis === "x");
    expect(line).toMatchObject({ position: list.x + list.width / 2 });
    // Shown, not snapped: the ghost keeps the raw offset.
    expect(gestures.preview()!.ghost!.x).toBe(a.x + toCentre + 2);
    gestures.update(ax + toCentre + 40, ay + 10, 1);
    expect(
      gestures
        .preview()
        ?.snapGuides?.some((g) => g.kind === "line" && g.axis === "x"),
    ).toBe(false);
    expect(gestures.preview()?.distances).toBeUndefined();
    gestures.cancel();
  });
});
