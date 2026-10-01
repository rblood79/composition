import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DataBindingRef,
  DefinitionId,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type {
  CatalogBoundRow,
  CatalogBoundRows,
} from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { pickTopmostRecord } from "../canvasPick";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import {
  catalogRowRemainderBox,
  catalogRowRemainders,
  catalogRowSampleHidden,
  catalogRowSampleHiddenWithin,
} from "../rowSample";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e sample policy (the old Canvas's ADR-157): a bound ListBox/GridList/Table that grows
 * with its rows draws its first 10 rows; the later rows keep their layout box (the owner is the
 * DOM's height) but are neither drawn nor picked, and the editor marks their area "+N more" with
 * the collection's count. A bounded owner (authored height, a fixed Table) shows every row it has.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const BINDING: DataBindingRef = {
  collectionId: "data:collection:c1" as DataBindingRef["collectionId"],
  fieldMap: {},
};
const rowsOf = (count: number, total?: number): CatalogBoundRows =>
  Object.assign(
    Array.from({ length: count }, (_, index): CatalogBoundRow => ({
      key: `r${index}`,
      values: {
        id: `r${index}`,
        label: `Row ${index}`,
        description: "",
        icon: "",
        value: `r${index}`,
        name: `Row ${index}`,
      },
    })),
    total === undefined ? {} : { total },
  );

/** `rowSample` null = the Preview root (no sample). */
async function open(
  type: string,
  rows: CatalogBoundRows,
  rowSample: number | null = 10,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:sample" as EntryId<"project">,
        name: "Sample",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e-sample-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: { rowSample: rowSample ?? undefined, rows: () => rows },
    },
  );
  const node: NodeEntry = {
    kind: "node",
    id: LIST,
    definitionId: catalogPaletteDefinitionId(library, type),
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    binding: BINDING,
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

const typeOf = (workspace: CatalogWorkspace, definitionId: string) =>
  workspace.runtime.graph.getDefinition(definitionId as DefinitionId)?.name ??
  "";
function rowRecords(workspace: CatalogWorkspace, type: string) {
  return [...workspace.root.canvasInputs.values()].filter(
    (record) =>
      record.rowIndex !== undefined &&
      typeOf(workspace, record.definitionId) === type,
  );
}

describe("ADR-248 4e row sample", () => {
  it("a bound ListBox growing with its rows: 10 drawn, the rest laid out but not drawn, marked with the collection's count", async () => {
    const workspace = await open("ListBox", rowsOf(15, 40));
    const root = workspace.root;
    const rows = rowRecords(workspace, "ListBoxItem");
    expect(rows.map((row) => row.rowIndex)).toEqual(
      Array.from({ length: 15 }, (_, index) => index),
    );
    const owner = root.canvasInputs.get(rows[0]!.parentId)!;
    expect(owner.rowCount).toBe(40);
    expect(rows.map((row) => catalogRowSampleHidden(root, row))).toEqual(
      Array.from({ length: 15 }, (_, index) => index >= 10),
    );
    // The owner keeps every row's height (the DOM's box).
    const geometry = root.getGeometry([owner.id, rows[14]!.id]);
    expect(geometry.get(owner.id)!.height).toBeGreaterThan(
      geometry.get(rows[14]!.id)!.y,
    );
    const [remainder] = catalogRowRemainders(root);
    expect(remainder).toMatchObject({ ownerId: owner.id, hiddenRows: 30 });
    expect(remainder!.hiddenIds).toEqual(rows.slice(10).map((row) => row.id));

    // The Canvas draws the sample and skips the rest (and their subtrees).
    const pageRoots = root.pageRootRecords();
    const canvas = bindCatalogCanvas(root, pageRoots);
    expect(getSkiaNode(rows[9]!.id)!.visible).not.toBe(false);
    expect(getSkiaNode(rows[10]!.id)!.visible).toBe(false);
    // Picking skips the rows not drawn and what they hold: the owner is under the point.
    const label = root.canvasInputs.get(rows[12]!.id)!.children[0]!;
    expect(catalogRowSampleHiddenWithin(root, label)).toBe(true);
    expect(catalogRowSampleHiddenWithin(root, rows[3]!.id)).toBe(false);
    canvas.dispose();
    workspace.dispose();
  });

  it("the marked area is the union of the rows not drawn, cut to the owner's shown box", () => {
    const boxes: Record<
      string,
      { x: number; y: number; width: number; height: number }
    > = {
      a: { x: 10, y: 100, width: 200, height: 30 },
      b: { x: 10, y: 130, width: 200, height: 30 },
    };
    const remainder = { ownerId: "o", hiddenIds: ["a", "b"], hiddenRows: 7 };
    expect(catalogRowRemainderBox(remainder, (id) => boxes[id])).toEqual({
      x: 10,
      y: 100,
      width: 200,
      height: 60,
    });
    expect(
      catalogRowRemainderBox(remainder, (id) => boxes[id], {
        x: 0,
        y: 0,
        width: 300,
        height: 120,
      }),
    ).toEqual({ x: 10, y: 100, width: 200, height: 20 });
    expect(
      catalogRowRemainderBox(remainder, (id) => boxes[id], {
        x: 0,
        y: 0,
        width: 300,
        height: 90,
      }),
    ).toBeUndefined();
  });

  it("picking skips records the predicate rejects", () => {
    const stream = {
      hitBoundsMap: new Map([
        ["owner", { x: 0, y: 0, width: 100, height: 100 }],
        ["row", { x: 0, y: 50, width: 100, height: 20 }],
      ]),
      subtreeSpans: new Map([
        ["owner", { start: 0, end: 10 }],
        ["row", { start: 5, end: 6 }],
      ]),
    } as never;
    expect(pickTopmostRecord(stream, 10, 60, ["owner", "row"])).toBe("row");
    expect(
      pickTopmostRecord(stream, 10, 60, ["owner", "row"], (id) => id !== "row"),
    ).toBe("owner");
  });

  it("a bounded owner (authored height) and the Preview (no sample) show every row", async () => {
    const workspace = await open("ListBox", rowsOf(15));
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: LIST }],
        visual: { height: { kind: "set", value: 300 } },
      }),
    );
    const rows = rowRecords(workspace, "ListBoxItem");
    expect(rows).toHaveLength(15);
    expect(
      workspace.root.canvasInputs.get(rows[0]!.parentId)!.rowCount,
    ).toBeUndefined();
    expect(catalogRowRemainders(workspace.root)).toEqual([]);
    workspace.dispose();
    const preview = await open("ListBox", rowsOf(15), null);
    expect(
      rowRecords(preview, "ListBoxItem").some((row) =>
        catalogRowSampleHidden(preview.root, row),
      ),
    ).toBe(false);
    preview.dispose();
  });

  it("a GridList samples too; a 10-row list shows everything without a mark", async () => {
    const grid = await open("GridList", rowsOf(12));
    expect(catalogRowRemainders(grid.root)).toMatchObject([{ hiddenRows: 2 }]);
    grid.dispose();
    const ten = await open("ListBox", rowsOf(10));
    expect(catalogRowRemainders(ten.root)).toEqual([]);
    ten.dispose();
  });

  it("a Table samples in auto height; a fixed Table shows the rows its height holds", async () => {
    const workspace = await open("Table", rowsOf(30));
    // Fixed (the binding default): no sample.
    expect(catalogRowRemainders(workspace.root)).toEqual([]);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: LIST }],
        props: { heightMode: { kind: "set", value: "auto" } },
      }),
    );
    const rows = rowRecords(workspace, "Row");
    expect(rows).toHaveLength(30);
    expect(catalogRowRemainders(workspace.root)).toMatchObject([
      { hiddenRows: 20 },
    ]);
    expect(catalogRowSampleHidden(workspace.root, rows[20]!)).toBe(true);
    workspace.dispose();
  });
});
