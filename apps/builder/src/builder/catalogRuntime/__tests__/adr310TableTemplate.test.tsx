// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import {
  insertNodes,
  insertTableColumns,
  insertTableRow,
  removeTargets,
  setFields,
  tableBodyPosition,
  tableHeaderPosition,
} from "../../../../../../packages/shared/src/catalog/commands";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogLibrary,
  DataBindingRef,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { catalogBindingCommand } from "../dataBindingCommand";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { classifyTableCellDisplay } from "../../../../../../packages/shared/src/collections/cellValue";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-310 G4 — a bound Table repeats its Row template: binding a 3-column Table leaves one Row
 * (marked `repeat`) with three Cells reading `{name}` · `{type}` · `{status}`; the stored nodes do
 * not grow with the rows (0 · 100 · 1,000); a Badge in a template cell shows in every row; a new
 * column adds a template cell reading its field; a static Row stands beside the template.
 */
const BODY = "project:node:home-body" as NodeId;
const TABLE = "project:node:table" as NodeId;
const BINDING = {
  collectionId: "data:collection:c1",
  fieldMap: {},
} as DataBindingRef;
const rowsOf = (
  count: number,
  status: (index: number) => unknown = (index) => `S${index}`,
): CatalogBoundRow[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `r${index}`,
    values: { name: `N${index}`, type: `T${index}`, status: status(index) },
  }));

let library: CatalogLibrary;
beforeAll(async () => {
  library = await buildCodeCatalogLibrary();
});

async function boundTable(count: number, status?: (index: number) => unknown) {
  const rows = rowsOf(count, status);
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:table" as EntryId<"project">,
        name: "Table",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr310-table-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        rows: (binding) =>
          binding.collectionId === BINDING.collectionId ? rows : undefined,
      },
    },
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
  return workspace;
}

const bind = (workspace: CatalogWorkspace) =>
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: TABLE }],
      BINDING,
      workspace.newId,
    ),
  );

/** A row's selection cell (S2's selection column — the origin's first, 2026-11-18) holds the
 * selection Checkbox only: the rows below read their data cells. */
function selectionCell(workspace: CatalogWorkspace, cellId: string): boolean {
  const graph = workspace.runtime.graph;
  const cell = graph.getEntry(cellId as NodeId) as NodeEntry;
  if (cell.props.children?.kind === "set" && cell.props.children.value)
    return false;
  return cell.children.some((id) => {
    const child = graph.getEntry(id) as NodeEntry;
    const slot = child.props.slot;
    return slot?.kind === "set" && slot.value === "selection";
  });
}

/** The Table's own rows (its TableBody fill) and each one's data cells. */
function ownRows(workspace: CatalogWorkspace) {
  const graph = workspace.runtime.graph;
  const fill = (graph.getEntry(TABLE) as NodeEntry).descendantOverrides.find(
    (override) =>
      override.kind === "fillSlot" &&
      override.address.templatePath.at(-1) ===
        "lib:template:component-table__2",
  ) as { childIds: readonly NodeId[] } | undefined;
  return (fill?.childIds ?? []).map((id) => {
    const row = graph.getEntry(id) as NodeEntry;
    return {
      id,
      type: definitionTypeName(graph, row.definitionId),
      repeat: row.repeat,
      selectionCells: row.children.filter((cellId) =>
        selectionCell(workspace, cellId),
      ).length,
      cells: row.children
        .filter((cellId) => !selectionCell(workspace, cellId))
        .map((cellId) => {
          const cell = graph.getEntry(cellId) as NodeEntry;
          const text = cell.props.children;
          return text?.kind === "set" ? text.value : undefined;
        }),
    };
  });
}

/** The drawn rows under the Table's TableBody: each one's source and its cells' text. */
function drawnRows(workspace: CatalogWorkspace) {
  const root = workspace.root;
  const [table] = root.recordsOfSource(TABLE);
  const record = (id: string) => root.canvasInputs.get(id)!;
  const body = record(table!).children.find(
    (id) => root.typeOf(record(id)) === "TableBody",
  )!;
  // (A node with children shows theirs — S2 TableView's Cell is `Cell > Text`, its `children`
  // prop the Text's.)
  const text = (id: string): string =>
    record(id).children.length
      ? record(id).children.map(text).join("")
      : typeof record(id).props.children === "string"
        ? (record(id).props.children as string)
        : "";
  // (Its data cells — not the selection cell, which holds the selection Checkbox.)
  const dataCells = (id: string) =>
    record(id).children.filter(
      (cell) =>
        !!record(cell).props.children ||
        !record(cell).children.some(
          (child) =>
            root.typeOf(record(child)) === "Checkbox" &&
            record(child).props.slot === "selection",
        ),
    );
  return record(body).children.map((id) => ({
    source: record(id).sourceId,
    row: record(id).rowIndex,
    selectionCells: record(id).children.length - dataCells(id).length,
    cells: dataCells(id).map(text),
    types: dataCells(id).map((cell) =>
      record(cell).children.map((child) => root.typeOf(record(child))),
    ),
  }));
}

describe("ADR-310 G4 — a bound Table's Row template", () => {
  it("binding a 3-column Table leaves Row 1 · Cell 3 reading the columns' fields; the stored nodes are the same at 0 · 100 · 1,000 rows", async () => {
    const counts: number[] = [];
    for (const count of [0, 100, 1000]) {
      const workspace = await boundTable(count);
      try {
        bind(workspace);
        expect(ownRows(workspace)).toEqual([
          {
            id: expect.any(String),
            type: "Row",
            repeat: true,
            selectionCells: 1,
            cells: ["{name}", "{type}", "{status}"],
          },
        ]);
        counts.push(workspace.runtime.graph.size);
        const drawn = drawnRows(workspace);
        // (A fixed-height Table — the binding default, 400 — draws the rows its height holds.)
        expect(drawn.length).toBe(count === 0 ? 0 : 14);
        if (count)
          expect(drawn.slice(0, 2)).toEqual([
            expect.objectContaining({ row: 0, cells: ["N0", "T0", "S0"] }),
            expect.objectContaining({ row: 1, cells: ["N1", "T1", "S1"] }),
          ]);
      } finally {
        workspace.dispose();
      }
    }
    expect(new Set(counts).size).toBe(1);
  });

  it("a Badge in a template cell shows in every row; a new column adds a template cell reading its field", async () => {
    const workspace = await boundTable(5);
    try {
      bind(workspace);
      const [template] = ownRows(workspace);
      const graph = workspace.runtime.graph;
      // (after the selection cell — S2's selection column, 2026-11-18)
      const statusCell = (graph.getEntry(template!.id) as NodeEntry)
        .children[3]!;
      const badge = workspace.newId("node") as NodeId;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: statusCell },
          entries: [
            {
              kind: "node",
              id: badge,
              definitionId: catalogPaletteDefinitionId(library, "Badge"),
              children: [],
              props: { children: { kind: "set", value: "{status}" } },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [badge],
          newId: workspace.newId,
        }),
      );
      const drawn = drawnRows(workspace);
      expect(drawn).toHaveLength(5);
      for (const [index, row] of drawn.entries()) {
        expect(row.types[2]).toContain("Badge");
        expect(row.cells[2]).toContain(`S${index}`);
      }

      const node = (type: string) => {
        const id = workspace.newId("node") as NodeId;
        return {
          entries: [
            {
              kind: "node",
              id,
              definitionId: catalogPaletteDefinitionId(library, type),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootId: id,
        };
      };
      workspace.execute(
        insertTableColumns({
          header: tableHeaderPosition(graph, TABLE)!,
          columns: [{ key: "owner", label: "Owner" }],
          buildColumn: () => node("Column"),
          buildCell: () => node("Cell"),
          newId: workspace.newId,
        }),
      );
      expect(ownRows(workspace)[0]!.cells).toEqual([
        "{name}",
        "{type}",
        "{status}",
        "{owner}",
      ]);
      expect(drawnRows(workspace)[0]!.cells).toHaveLength(4);
    } finally {
      workspace.dispose();
    }
  });

  it("a static Row stands beside the template (no TABLE_ROWS_FROM_DATA); the DOM draws both; unbinding leaves the template static", async () => {
    const workspace = await boundTable(3);
    try {
      bind(workspace);
      const graph = workspace.runtime.graph;
      const row = (columnCount: number) => {
        const cells = Array.from({ length: columnCount }, () => ({
          kind: "node" as const,
          id: workspace.newId("node") as NodeId,
          definitionId: catalogPaletteDefinitionId(library, "Cell"),
          children: [],
          props: { children: { kind: "set" as const, value: "Total" } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        }));
        const id = workspace.newId("node") as NodeId;
        return {
          entries: [
            {
              kind: "node",
              id,
              definitionId: catalogPaletteDefinitionId(library, "Row"),
              children: cells.map((cell) => cell.id),
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
            ...(cells as NodeEntry[]),
          ],
          rootId: id,
        };
      };
      workspace.execute(
        insertTableRow({
          body: tableBodyPosition(graph, TABLE)!,
          buildRow: row,
          newId: workspace.newId,
        }),
      );
      const drawn = drawnRows(workspace);
      expect(drawn.map((item) => item.row)).toEqual([0, 1, 2, undefined]);
      expect(drawn[3]!.cells).toEqual(["Total", "Total", "Total"]);

      const root = workspace.root;
      const html = renderToStaticMarkup(
        renderCatalogDom(root, root.recordsOfSource(TABLE)[0]!),
      );
      // (The header row, three data rows, the static row.)
      expect(html.match(/role="row"/g)).toHaveLength(5);
      expect(html.indexOf("N2")).toBeLessThan(html.indexOf("Total"));

      workspace.execute(
        catalogBindingCommand([{ kind: "node", id: TABLE }], undefined),
      );
      expect(ownRows(workspace).map((item) => item.repeat)).toEqual([
        undefined,
        undefined,
      ]);
      expect(drawnRows(workspace).map((item) => item.row)).toEqual([
        undefined,
        undefined,
      ]);
    } finally {
      workspace.dispose();
    }
  });

  it("binding pins each label-keyed Column's key — a later label edit keeps the column's field (cells · sort key)", async () => {
    const workspace = await boundTable(3);
    try {
      bind(workspace);
      const graph = workspace.runtime.graph;
      const header = (
        graph.getEntry(TABLE) as NodeEntry
      ).descendantOverrides.find(
        (override) =>
          override.kind === "fillSlot" &&
          override.address.templatePath.at(-1) ===
            "lib:template:component-table__1",
      ) as { childIds: readonly NodeId[] };
      // (S2's selection column first — no key: no data column)
      const keys = () =>
        header.childIds.map((id) => {
          const key = (graph.getEntry(id) as NodeEntry).props.key;
          return key?.kind === "set" ? key.value : undefined;
        });
      expect(keys()).toEqual([undefined, "name", "type", "status"]);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: header.childIds[2]! }],
          props: { children: { kind: "set", value: "Role" } },
        }),
      );
      expect(keys()).toEqual([undefined, "name", "type", "status"]);
      expect(drawnRows(workspace).map((row) => row.cells[1])).toEqual([
        "T0",
        "T1",
        "T2",
      ]);
    } finally {
      workspace.dispose();
    }
  });

  it("a Table holding no row gets a plain Row template — a cell per column, each reading its field", async () => {
    const workspace = await boundTable(2);
    try {
      const [starter] = ownRows(workspace);
      workspace.execute(
        removeTargets({ targets: [{ kind: "node", id: starter!.id }] }),
      );
      expect(ownRows(workspace)).toEqual([]);
      bind(workspace);
      expect(ownRows(workspace)).toEqual([
        {
          id: expect.any(String),
          type: "Row",
          repeat: true,
          // (the plain Row's selection cell holds its Checkbox — `insertTableRow`)
          selectionCells: 1,
          cells: ["{name}", "{type}", "{status}"],
        },
      ]);
      expect(drawnRows(workspace).map((row) => row.cells)).toEqual([
        ["N0", "T0", "S0"],
        ["N1", "T1", "S1"],
      ]);
    } finally {
      workspace.dispose();
    }
  });

  it("binding a Table holding no row builds its template's data cells as Cell originals — `Cell > Text` (S2 TableView)", async () => {
    const workspace = await boundTable(1);
    try {
      const [starter] = ownRows(workspace);
      workspace.execute(
        removeTargets({ targets: [{ kind: "node", id: starter!.id }] }),
      );
      bind(workspace);
      const root = workspace.root;
      const [row] = drawnRows(workspace);
      expect(row!.cells).toEqual(["N0", "T0", "S0"]);
      const body = root.canvasInputs
        .get(root.recordsOfSource(TABLE)[0]!)!
        .children.map((id) => root.canvasInputs.get(id)!)
        .find((record) => root.typeOf(record) === "TableBody")!;
      const cells = root.canvasInputs
        .get(body.children[0]!)!
        .children.map((id) => root.canvasInputs.get(id)!)
        .filter((cell) => !selectionCell(workspace, cell.sourceId));
      expect(
        cells.map((cell) =>
          root.typeOf(root.canvasInputs.get(cell.children[0]!)!),
        ),
      ).toEqual(["Text", "Text", "Text"]);
    } finally {
      workspace.dispose();
    }
  });

  it("a list value shows as a Table cell's text in the Cell's Text (S2 TableView — `Cell > Text`)", async () => {
    const workspace = await boundTable(1, () => ["a", "b", "c", "d", "e"]);
    try {
      bind(workspace);
      const cell = drawnRows(workspace)[0]!.cells[2]!;
      const display = classifyTableCellDisplay(["a", "b", "c", "d", "e"]);
      expect(display.kind).not.toBe("text");
      expect(cell).toBe(
        display.kind !== "text"
          ? `${display.items.join(", ")}${display.overflow ? ` +${display.overflow}` : ""}`
          : "",
      );
    } finally {
      workspace.dispose();
    }
  });

  it("a field edit inside the bound Row template reaches every drawn row (the cell's text · a Checkbox's label cleared)", async () => {
    // (Why — 2026-11-15: a repeated row's record id carries `#row:<key>` but the resolver asks for
    //  the template position, so a template cell's edit missed its owned path —
    //  RESOLVED_INSTANCE_MISSING; and the cleared label, taken for sample text, brought back the
    //  origin's 「Checkbox」.)
    const workspace = await boundTable(2);
    try {
      bind(workspace);
      const [template] = ownRows(workspace);
      const graph = workspace.runtime.graph;
      // (its first data cell — after S2's selection cell)
      const cell = (graph.getEntry(template!.id) as NodeEntry).children[1]!;
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: cell }],
          props: { children: { kind: "set", value: "{type}" } },
        }),
      );
      expect(drawnRows(workspace).map((row) => row.cells[0])).toEqual([
        "T0",
        "T1",
      ]);
      const checkbox = workspace.newId("node") as NodeId;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: cell },
          index: 0,
          entries: [
            {
              kind: "node",
              id: checkbox,
              definitionId: catalogPaletteDefinitionId(library, "Checkbox"),
              children: [],
              props: { slot: { kind: "set", value: "selection" } },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [checkbox],
          newId: workspace.newId,
        }),
      );
      // (the cell's Text · the Checkbox's Label)
      expect(drawnRows(workspace)[1]!.cells[0]).toBe("T1Checkbox");
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: checkbox }],
          props: { children: { kind: "set", value: "" } },
        }),
      );
      expect(drawnRows(workspace).map((row) => row.cells[0])).toEqual([
        "T0",
        "T1",
      ]);
    } finally {
      workspace.dispose();
    }
  });
});
