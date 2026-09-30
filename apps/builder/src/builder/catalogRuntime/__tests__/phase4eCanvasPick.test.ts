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
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogCanvasPicking } from "../canvasPick";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-3 Canvas picking: a click selects the element directly under the page body (the
 * old Builder's hierarchical rule over record parents), ⌘ selects the picked element itself, a
 * double click enters the container, Escape goes back up, and hover shows what a click selects.
 */
const PROJECT = "project:project:pick" as EntryId<"project">;
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
const text = (name: string, value: string) =>
  node(name, "lib:definition:text", [], {
    children: { kind: "set", value },
  });
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:p${++next}` as EntryId<K>;
};

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Pick" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-pick-${Math.random()}`),
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
        node("frame", "lib:definition:type-frame", [id("inner")]),
        node("inner", "lib:definition:type-frame", [id("leaf")]),
        text("leaf", "Leaf"),
      ],
      rootIds: [id("frame")],
      newId: allocator(),
    }),
  );
  const scene = new CatalogCanvasScene(workspace.root);
  const picking = new CatalogCanvasPicking({
    records: workspace.root.domInputs,
    session: workspace.session,
    get stream() {
      return scene.stream;
    },
    // The spatial index needs the wasm module: scan every hit box instead.
    query: () => scene.stream.hitBoundsMap.keys(),
    selectRecords: (ids, options) => workspace.selectRecords(ids, options),
    itemOf: (record) => workspace.itemOfRecord(record),
  });
  const record = (name: string) => workspace.root.recordsOfSource(id(name))[0];
  const center = (name: string) => {
    const box = scene.stream.boundsMap.get(record(name))!;
    return [box.x + box.width / 2, box.y + box.height / 2] as const;
  };
  const selected = () =>
    workspace.session.getSnapshot().selection.map((item) => item.identity);
  return { workspace, scene, picking, record, center, selected };
}

describe("ADR-248 Phase 4e-3 Canvas picking", () => {
  it("click selects the body's direct child, ⌘ the leaf, empty page the body, outside clears", async () => {
    const { workspace, picking, record, center, selected } = await open();
    const [lx, ly] = center("leaf");
    expect(picking.pick(lx, ly)).toBe(record("leaf"));

    picking.click(lx, ly);
    expect(selected()).toEqual([record("frame")]);
    expect(workspace.session.getSnapshot().selection[0].target).toEqual({
      kind: "node",
      id: id("frame"),
    });

    picking.click(lx, ly, { deep: true });
    expect(selected()).toEqual([record("leaf")]);

    // The body's empty area selects the body; off every page clears.
    picking.click(1900, 1070);
    expect(selected()).toEqual(workspace.root.recordsOfSource(BODY));
    picking.click(-500, -500);
    expect(selected()).toEqual([]);
  });

  it("hover shows the click target; double click enters one level; Escape climbs then clears", async () => {
    const { workspace, picking, record, center, selected } = await open();
    const [lx, ly] = center("leaf");
    picking.hover(lx, ly);
    expect(workspace.session.getSnapshot().hover?.identity).toBe(
      record("frame"),
    );

    expect(picking.doubleClick(lx, ly)).toBe(true);
    expect(workspace.session.getSnapshot().editingContext).toBe(id("frame"));
    expect(selected()).toEqual([record("inner")]);
    // Inside the context a click selects the context's direct child; hover follows.
    picking.click(lx, ly);
    expect(selected()).toEqual([record("inner")]);
    picking.hover(lx, ly);
    expect(workspace.session.getSnapshot().hover?.identity).toBe(
      record("inner"),
    );

    expect(picking.doubleClick(lx, ly)).toBe(true);
    expect(workspace.session.getSnapshot().editingContext).toBe(id("inner"));
    expect(selected()).toEqual([record("leaf")]);
    // The leaf is the target itself: nothing to enter.
    expect(picking.doubleClick(lx, ly)).toBe(false);

    picking.escape();
    expect(workspace.session.getSnapshot().editingContext).toBe(id("frame"));
    expect(selected()).toEqual([record("inner")]);
    picking.escape();
    expect(workspace.session.getSnapshot().editingContext).toBeUndefined();
    expect(selected()).toEqual([record("frame")]);
    picking.escape();
    expect(selected()).toEqual([]);
  });

  it("a click outside the entered context leaves it and selects at the page level", async () => {
    const { workspace, picking, center, selected } = await open();
    const [lx, ly] = center("leaf");
    picking.doubleClick(lx, ly);
    expect(workspace.session.getSnapshot().editingContext).toBe(id("frame"));
    picking.click(1900, 1070);
    expect(workspace.session.getSnapshot().editingContext).toBeUndefined();
    expect(selected()).toEqual(workspace.root.recordsOfSource(BODY));
  });
});
