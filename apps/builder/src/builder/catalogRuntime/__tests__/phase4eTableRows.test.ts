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
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import {
  insertNodes,
  insertTableColumns,
  setFields,
  tableHeaderPosition,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../compositionRoot";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e bound Table rows (the old Canvas's `appendTableRowProjection`): the DOM Table draws
 * its rows from the data, so the shared resolution shows one Row per data row under TableBody with
 * one Cell per header column (the column key reads the row; arrays as tags); a fixed-height Table
 * shows the rows its height holds; unknown rows keep the template.
 */
const BODY = "project:node:home-body" as NodeId;
const TABLE = "project:node:table" as NodeId;
const BINDING: DataBindingRef = {
  collectionId: "data:collection:users" as DataBindingRef["collectionId"],
  fieldMap: {},
};
const user = (key: string, name: string, tags: string[] = []) => ({
  key,
  values: { id: key, name, email: `${name.toLowerCase()}@x.io`, tags },
});

async function open(rowCount = 2) {
  const library = await buildCodeCatalogLibrary();
  let rows: CatalogBoundRow[] | undefined = Array.from(
    { length: rowCount },
    (_, index) =>
      index === 0
        ? user("u0", "Ann", ["a", "b"])
        : user(`u${index}`, `User${index}`),
  );
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:table-rows" as EntryId<"project">,
        name: "Table rows",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e-table-rows-${Math.random()}`),
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
  const node = (id: NodeId, definitionId: string): NodeEntry => ({
    kind: "node",
    id,
    definitionId: definitionId as NodeEntry["definitionId"],
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          ...node(TABLE, "lib:definition:origin-component-table"),
          binding: BINDING,
        },
      ],
      rootIds: [TABLE],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    insertTableColumns({
      header: tableHeaderPosition(workspace.runtime.graph, TABLE)!,
      columns: [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "tags", label: "Tags" },
      ],
      replace: false,
      buildColumn: () => {
        const id = workspace.newId("node") as NodeId;
        return {
          entries: [node(id, "lib:definition:origin-component-table-column")],
          rootId: id,
        };
      },
      buildCell: () => {
        const id = workspace.newId("node") as NodeId;
        return { entries: [node(id, "lib:definition:type-Cell")], rootId: id };
      },
      newId: workspace.newId,
    }),
  );
  return {
    workspace,
    setRows: (next: CatalogBoundRow[] | undefined) => {
      rows = next;
    },
  };
}

const typeOf = (workspace: CatalogWorkspace, record: CatalogConsumerNode) =>
  workspace.runtime.graph.getDefinition(record.definitionId as DefinitionId)
    ?.name ?? "";
/** The TableBody's rows as cell texts. */
function bodyRows(workspace: CatalogWorkspace): string[][] {
  const records = workspace.root.domInputs;
  const find = (id: string, type: string): CatalogConsumerNode | undefined => {
    const record = records.get(id);
    if (!record) return undefined;
    if (typeOf(workspace, record) === type) return record;
    for (const child of record.children) {
      const found = find(child, type);
      if (found) return found;
    }
    return undefined;
  };
  const [table] = workspace.root.recordsOfSource(TABLE);
  const body = find(table, "TableBody");
  return (body?.children ?? []).map((rowId) =>
    (records.get(rowId)?.children ?? []).map((cellId) =>
      String(records.get(cellId)?.props.children ?? ""),
    ),
  );
}

describe("ADR-248 4e bound Table rows", () => {
  it("one Row per data row, one Cell per header column (the column key reads the row)", async () => {
    const { workspace } = await open();
    expect(bodyRows(workspace)).toEqual([
      ["Ann", "ann@x.io", "a, b"],
      ["User1", "user1@x.io", ""],
    ]);
    // Rows and cells lay out: the first cell sits under the first column.
    const records = workspace.root.domInputs;
    const geometry = (id: string) => workspace.root.getGeometry([id]).get(id);
    const [table] = workspace.root.recordsOfSource(TABLE);
    const all = [...records.values()].filter((record) =>
      record.id.startsWith(table.split("::")[0]),
    );
    const firstColumn = all.find(
      (record) => typeOf(workspace, record) === "Column",
    )!;
    const firstCell = all.find(
      (record) => typeOf(workspace, record) === "Cell",
    )!;
    expect(geometry(firstCell.id)?.width).toBeCloseTo(
      geometry(firstColumn.id)!.width,
      0,
    );
    // The DOM's boxes: fixed 400 viewport + border, 150 px columns, one-line rows.
    expect(geometry(table)!.height).toBe(402);
    expect(geometry(firstColumn.id)!.width).toBe(150);
    expect(geometry(firstCell.id)!.width).toBe(150);
    const firstRow = all.find((record) => typeOf(workspace, record) === "Row")!;
    // One line like the header (this environment measures no text: both are padding only).
    expect(geometry(firstRow.id)!.height).toBe(
      geometry(firstColumn.id)!.height,
    );
    // Rows past the height are cut (Table.css clips the table; the body holds the rows).
    expect(records.get(table)!.visual.overflow).toBe("hidden");
    // The body holds the rows below the header.
    const body = all.find(
      (record) => typeOf(workspace, record) === "TableBody",
    )!;
    expect(geometry(body.id)!.height).toBeGreaterThan(0);
    workspace.dispose();
  });

  it("a column added later gets its cells; rows changing re-resolve; unknown rows keep the template", async () => {
    const { workspace, setRows } = await open();
    setRows([user("z", "Zed")]);
    workspace.refreshRows(["users"]);
    expect(bodyRows(workspace)).toEqual([["Zed", "zed@x.io", ""]]);
    setRows(undefined);
    workspace.refreshRows(["users"]);
    expect(bodyRows(workspace)).toEqual([]);
    workspace.dispose();
  });

  it("a column's key edit re-reads the rows (a value edit, not a structure change)", async () => {
    const { workspace } = await open();
    const [table] = workspace.root.recordsOfSource(TABLE);
    const records = workspace.root.domInputs;
    const column = [...records.values()].find(
      (record) =>
        record.id.startsWith(table.split("::")[0]) &&
        typeOf(workspace, record) === "Column",
    )!;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: column.sourceId as NodeId }],
        props: { key: { kind: "set", value: "email" } },
      }),
    );
    expect(bodyRows(workspace)[0]![0]).toBe("ann@x.io");
    workspace.dispose();
  });

  it("a fixed-height Table shows the rows its height holds; auto shows every row", async () => {
    const { workspace } = await open(40);
    // Fixed 400 (the template): ceil(400 / 32) + 1 rows.
    expect(bodyRows(workspace)).toHaveLength(14);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: TABLE }],
        props: { heightMode: { kind: "set", value: "auto" } },
      }),
    );
    expect(bodyRows(workspace)).toHaveLength(40);
    // The body grows with its rows (the table is as tall as them, like the DOM's auto table).
    const records = [...workspace.root.domInputs.values()];
    const named = (name: string) =>
      records.filter((record) => typeOf(workspace, record) === name);
    const [body] = named("TableBody");
    const rows = named("Row");
    const geometry = workspace.root.getGeometry([
      body!.id,
      ...rows.map((row) => row.id),
    ]);
    expect(geometry.get(body!.id)!.height).toBeGreaterThanOrEqual(
      rows.reduce((sum, row) => sum + geometry.get(row.id)!.height, 0),
    );
    workspace.dispose();
  });
});
