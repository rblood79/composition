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
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { setDataEntries } from "../../../../../../packages/shared/src/catalog/commands/data";
import { catalogBoxModel } from "../../../../../../packages/shared/src/catalog/runtime/boxModel";
import { catalogBindingRef } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogBuilderBoundRows } from "../catalogDataRead";
import { catalogTableTotalsCommand } from "../tableTotals";
import { catalogTableDetailCommand } from "../tableDetail";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogRuleShapes } from "../ruleShapes";
import { catalogCanvasNodeData } from "../canvasBinding";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-315 Phase 5 증분 5b-3 — the Builder's Canvas draws a Column 「Grouped」 as the Preview does
 * at first (symmetric consumers — D3): the bound Table's rows grouped by it through the Builder's
 * own row reader (`catalogBuilderBoundRows` — the resolver asks with the author's slices), each
 * group one row, closed (no child row — the Canvas has no RAC to open one), the grouped Column
 * first, and its cell holding the expand button the DOM's RAC Cell draws: a `1lh` chevron at the
 * cell's start, its text after the button and the gap (S2 tree cell — `Table.css`).
 *
 * Fixture (Name · Type · Status — the Table's Columns): p1 Bora B 2 · p2 Chan A 1 · p3 Ara B 3 ·
 * p4 Dana A 5 · p5 Eun A —.
 */
const BODY = "project:node:home-body" as NodeId;
const TABLE = "project:node:table" as NodeId;
const COLLECTION = "data:collection:users" as DataBindingRef["collectionId"];
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const PEOPLE = "data:collection:people" as DataBindingRef["collectionId"];

async function open(tree = false) {
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:groups" as EntryId<"project">,
      name: "Groups",
    }),
    library,
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr315-canvas-groups-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        // (The Builder's root — `CatalogBuilderCore`.)
        rowSample: true,
        rows: (binding, kind, ownerId, _instancePath, slices) =>
          catalogBuilderBoundRows(graph, binding, kind, ownerId, slices),
      },
    },
  );
  workspace.execute(
    setDataEntries({
      puts: [
        {
          kind: "collection",
          id: COLLECTION,
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            { id: "f-type", key: "type", type: "string" },
            { id: "f-status", key: "status", type: "number" },
          ],
          mockData: [
            { id: "p1", name: "Bora", type: "B", status: 2 },
            { id: "p2", name: "Chan", type: "A", status: 1 },
            { id: "p3", name: "Ara", type: "B", status: 3 },
            { id: "p4", name: "Dana", type: "A", status: 5 },
            { id: "p5", name: "Eun", type: "A", status: null },
          ],
          useMockData: true,
        } as never,
        {
          kind: "collection",
          id: PEOPLE,
          name: "People",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            { id: "f-status", key: "status", type: "number" },
            { id: "f-parent", key: "parent", type: "string" },
          ],
          mockData: [
            { id: "p1", name: "Bora", status: 2, parent: null },
            { id: "p2", name: "Chan", status: 1, parent: "p1" },
            { id: "p3", name: "Ara", status: 3, parent: "p1" },
            { id: "p4", name: "Dana", status: 5, parent: null },
            { id: "p5", name: "Eun", status: null, parent: "p4" },
            { id: "p6", name: "Gim", status: 4, parent: null },
          ],
          useMockData: true,
        } as never,
      ],
    }),
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: TABLE,
          definitionId: catalogPaletteDefinitionId(library, "Table"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [TABLE],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: TABLE }],
      catalogBindingRef(
        tree
          ? {
              source: "dataTable",
              collectionId: "people",
              name: "People",
              fieldMap: { parentId: "f-parent" },
            }
          : { source: "dataTable", collectionId: "users", name: "Users" },
      )!,
    ),
  );
  await settle();
  const typeOf = (definitionId: string) =>
    workspace.runtime.graph.getDefinition(definitionId as DefinitionId)?.name ??
    "";
  const records = () => [...workspace.root.canvasInputs.values()];
  const column = (key: string) =>
    records().find(
      (record) =>
        typeOf(record.definitionId) === "Column" && record.props.key === key,
    )!;
  /** The Canvas's body rows: each one's cell texts (the selection cell is none). */
  const rows = () =>
    records()
      .filter(
        (record) =>
          record.rowIndex !== undefined &&
          typeOf(record.definitionId) === "Row",
      )
      .map((row) => ({
        row,
        nested: row.children.filter(
          (id) =>
            typeOf(workspace.root.canvasInputs.get(id)?.definitionId ?? "") ===
            "Row",
        ),
        cells: row.children
          .map((id) => workspace.root.canvasInputs.get(id)!)
          .filter(
            (cell) =>
              typeOf(cell.definitionId) === "Cell" &&
              typeof cell.props.children === "string",
          ),
      }));
  return { workspace, typeOf, records, column, rows };
}

describe("ADR-315 Phase 5 — the Canvas draws a Column 「Grouped」 (5b-3)", () => {
  it("ADR-315 Phase 6 — the Canvas draws a Column 「Merge same values」: no value, no line between, the line in the cells' box", async () => {
    const t = await open();
    const heights = () =>
      t
        .rows()
        .map(({ row }) =>
          Math.round(
            t.workspace.root.getGeometry([row.id]).get(row.id)!.height,
          ),
        );
    const before = heights();
    t.workspace.execute(
      setFields({
        targets: [t.workspace.positionOfRecord(t.column("type").id)!.target],
        props: { mergeSameValues: { kind: "set", value: true } },
      }),
    );
    await settle();
    const drawn = t.rows();
    const get = (id: string) => t.workspace.root.canvasInputs.get(id)!;
    const typeCell = (index: number) =>
      drawn[index]!.row.children.map(get).filter(
        (record) => t.typeOf(record.definitionId) === "Cell",
      )[2]!;
    // B · A · B · A · A — p5's Type runs into p4's: its content not drawn, no line under p4's.
    expect(
      drawn.map((_, index) => typeCell(index).props._cellMerged === true),
    ).toEqual([false, false, false, false, true]);
    expect(drawn.map((_, index) => typeCell(index).props._cellLine)).toEqual([
      "bottom",
      "bottom",
      "bottom",
      "none",
      "bottom",
    ]);
    expect(
      typeCell(4).children.map(
        (id) => get(id).derivedProps?._cellMergedContent,
      ),
    ).toEqual([true]);
    expect(
      typeCell(3).children.map(
        (id) => get(id).derivedProps?._cellMergedContent,
      ),
    ).toEqual([undefined]);
    // The row's line is its cells' — the same 1px, so a row is as tall as before.
    expect(
      drawn.every(({ row }) => row.derivedProps?.cellLines === "cells"),
    ).toBe(true);
    // The engine lays the line out where the DOM has it: in the Cell's box, none in the Row's (so
    //  a row is as tall as before — cell + 1; this harness measures no text, so its cells are their
    //  min height).
    const engine = (id: string) => t.workspace.root.getDrawnLayoutStyle(id);
    expect(engine(drawn[3]!.row.id)?.borderBottom).toBe("0px");
    expect(engine(typeCell(2).id)?.borderBottom).toBe("1px");
    expect(engine(typeCell(3).id)?.borderBottom).toBe("0px");
    // A totals row keeps its own (none — the Table's part value is a body row's): its Row is not
    //  a merged one's, nor its Cells.
    t.workspace.execute(
      catalogTableTotalsCommand(
        t.workspace.runtime.graph,
        TABLE,
        true,
        t.workspace.newId,
      ),
    );
    await settle();
    const footer = t
      .records()
      .find((record) => t.typeOf(record.definitionId) === "TableFooter")!;
    const totals = footer.children
      .map(get)
      .find((record) => t.typeOf(record.definitionId) === "Row")!;
    expect(totals.props._cellLines).toBeUndefined();
    expect(
      totals.children
        .map(get)
        .filter((record) => t.typeOf(record.definitionId) === "Cell")
        .map((cell) => cell.props._cellLine),
    ).toEqual([undefined, undefined, undefined, undefined]);
    // The Canvas paints it the DOM's way: the Row's line off, each cell's own under it (none under
    //  p4's Type), p5's Type text not drawn.
    const paint = (id: string) => catalogCanvasNodeData(t.workspace.root, id);
    // (No stroke at all — every side 0: a uniform width would draw a box.)
    expect(paint(drawn[3]!.row.id).box?.strokeWidths).toBeUndefined();
    expect(paint(drawn[3]!.row.id).box?.strokeWidth ?? 0).toBe(0);
    expect(paint(typeCell(2).id).box?.strokeWidths).toEqual([0, 0, 1, 0]);
    expect(paint(typeCell(3).id).box?.strokeWidth ?? 0).toBe(0);
    expect(paint(typeCell(4).children[0]!).visible).toBe(false);
    expect(paint(typeCell(3).children[0]!).visible).toBe(true);
  }, 120_000);

  it("one closed row per group, the grouped Column first, its cell holding the expand button", async () => {
    const t = await open();
    t.workspace.execute(
      setFields({
        targets: [t.workspace.positionOfRecord(t.column("type").id)!.target],
        props: { defaultGrouped: { kind: "set", value: true } },
      }),
    );
    t.workspace.execute(
      setFields({
        targets: [t.workspace.positionOfRecord(t.column("status").id)!.target],
        props: { aggregate: { kind: "set", value: "sum" } },
      }),
    );
    await settle();
    const drawn = t.rows();
    // B first (Bora's), each a closed group: no child Row drawn inside it.
    expect(
      drawn.map((row) => row.cells.map((cell) => cell.props.children)),
    ).toEqual([
      ["B (2)", "", "5"],
      ["A (3)", "", "6"],
    ]);
    expect(drawn.every((row) => row.nested.length === 0)).toBe(true);
    // The grouped cell: the button's room at its start (16 + 1lh 18 + gap 4), the others as they were.
    const [typeCell, nameCell] = drawn[0]!.cells;
    expect(typeCell!.props._treeCell).toBe("closed");
    expect(nameCell!.props._treeCell).toBeUndefined();
    expect(catalogBoxModel(typeCell!).padding?.left).toBe(16 + 18 + 4);
    expect(catalogBoxModel(nameCell!).padding?.left).toBe(16);
    // The chevron: the DOM's glyph (lucide chevron-right, 1em = 14), centred in the 1lh square.
    const box = t.workspace.root.getGeometry([typeCell!.id]).get(typeCell!.id)!;
    const chevron = catalogRuleShapes({
      node: typeCell!,
      rect: { width: box.width, height: box.height },
      rule: t.workspace.runtime.graph.library.rules.get("Cell" as never)!,
      type: "Cell",
      authoredVisual: {},
    }).filter(
      (shape) => (shape as { iconName?: string }).iconName === "chevron-right",
    );
    expect(chevron).toHaveLength(1);
    expect(chevron[0]).toMatchObject({
      x: 16 + 9,
      y: box.height / 2,
      fontSize: 14,
    });
  }, 120_000);

  it("the Canvas draws a totals row too (5c): each Column's aggregate over the rows", async () => {
    const t = await open();
    t.workspace.execute(
      setFields({
        targets: [t.workspace.positionOfRecord(t.column("name").id)!.target],
        props: { aggregate: { kind: "set", value: "count" } },
      }),
    );
    t.workspace.execute(
      setFields({
        targets: [t.workspace.positionOfRecord(t.column("status").id)!.target],
        props: { aggregate: { kind: "set", value: "mean" } },
      }),
    );
    t.workspace.execute(
      catalogTableTotalsCommand(
        t.workspace.runtime.graph,
        TABLE,
        true,
        t.workspace.newId,
      ),
    );
    await settle();
    const footer = t
      .records()
      .find((record) => t.typeOf(record.definitionId) === "TableFooter")!;
    const row = footer.children
      .map((id) => t.workspace.root.canvasInputs.get(id)!)
      .find((record) => t.typeOf(record.definitionId) === "Row")!;
    const texts = row.children
      .map((id) => t.workspace.root.canvasInputs.get(id)!)
      .filter((cell) => t.typeOf(cell.definitionId) === "Cell")
      .map((cell) => String(cell.props.children ?? ""));
    // (The selection cell · Name 5 · Type — · Status (2 + 1 + 3 + 5) / 4 = 2.75.)
    expect(texts).toEqual(["", "5", "", "2.75"]);
    // The body still draws its five rows.
    expect(t.rows()).toHaveLength(5);
  }, 120_000);
  it("the Canvas draws a tree's top rows (5d): collapsed, no child Row, the first Column's cell holding the button of a row with child rows", async () => {
    const t = await open(true);
    await settle();
    const drawn = t.rows();
    // (Bora · Dana have child rows, Gim none: the top rows only — the Builder's default, closed.
    //  Name · Type (the starter's — no such field) · Status.)
    expect(
      drawn.map((row) => row.cells.map((cell) => cell.props.children)),
    ).toEqual([
      ["Bora", "", "2"],
      ["Dana", "", "5"],
      ["Gim", "", "4"],
    ]);
    expect(drawn.every((row) => row.nested.length === 0)).toBe(true);
    expect(drawn.map((row) => row.cells[0]!.props._treeCell)).toEqual([
      "closed",
      "closed",
      undefined,
    ]);
    expect(drawn[0]!.cells[1]!.props._treeCell).toBeUndefined();
    expect(catalogBoxModel(drawn[0]!.cells[0]!).padding?.left).toBe(
      16 + 18 + 4,
    );
    expect(catalogBoxModel(drawn[2]!.cells[0]!).padding?.left).toBe(16);
  }, 120_000);
  it("the Canvas draws a detail row's Table (5e): every row closed, its first data cell holding the button, no detail drawn", async () => {
    const t = await open();
    t.workspace.execute(
      catalogTableDetailCommand(
        t.workspace.runtime.graph,
        TABLE,
        true,
        t.workspace.newId,
      ),
    );
    await settle();
    const drawn = t.rows();
    expect(
      drawn.map((row) => row.cells.map((cell) => cell.props.children)),
    ).toEqual([
      ["Bora", "B", "2"],
      ["Chan", "A", "1"],
      ["Ara", "B", "3"],
      ["Dana", "A", "5"],
      ["Eun", "A", ""],
    ]);
    expect(drawn.every((row) => row.nested.length === 0)).toBe(true);
    expect(drawn.map((row) => row.cells[0]!.props._treeCell)).toEqual([
      "closed",
      "closed",
      "closed",
      "closed",
      "closed",
    ]);
    expect(drawn[0]!.cells[1]!.props._treeCell).toBeUndefined();
  }, 120_000);
});
