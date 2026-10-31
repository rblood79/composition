import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { DataChange } from "@composition/shared";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  LIBRARY_CONTRACT_VERSION,
  type CatalogDocument,
  type DataBindingRef,
  type DefinitionId,
  type EntryId,
  type NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogValidationError } from "../../../../../../packages/shared/src/catalog/document/validation";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { getCatalogEntry } from "../../../../../../packages/shared/src/catalog/componentCatalog";
import { getPrimitiveBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import { INTERNAL_RENDERERS } from "../../../../../../packages/shared/src/catalog/runtime/domRegistry.runtime";
import {
  tableHeaderColumns,
  tableHeaderPosition,
} from "../../../../../../packages/shared/src/catalog/commands";
import { tableAlignedIn } from "../../../../../../packages/shared/src/catalog/commands/collections";
import { CommandDraft } from "../../../../../../packages/shared/src/catalog/commands/context";
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { createCatalogQuickConnectHost } from "../../panels/datatable/usage/catalogQuickConnectHost";
import { useDataStore } from "../../stores/data";
import { bindCatalogDataStore } from "../catalogDataStore";
import {
  resolveColumnMode,
  targetHasBinding,
} from "../../panels/datatable/utils/quickConnectPlan";
import type { CatalogConsumerNode } from "../compositionRoot";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { getPaletteItems } from "../../panels/components/paletteItems";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-277 — the table is one type (RAC `Table`). The palette Table's origin template carries the
 * starter the S2-named second table had (Columns Name · Type · Status, one Row of three Cells);
 * a bound Table shows only its projected rows; the first Quick Connect of a Table without a
 * binding replaces its columns with the schema's (사용자 결정 3 — the starter's keys `name` ·
 * `type` · `status` would read nothing from a `{title, price}` row), a reconnect keeps them unless
 * asked; `replace` rebuilds every static row's cells so the Table stays aligned once unbound.
 */
const ROUTE = "adr277";
const PROJECT = `project:project:${ROUTE}` as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const COLLECTION = "data:collection:items" as DataBindingRef["collectionId"];
const BINDING: DataBindingRef = { collectionId: COLLECTION, fieldMap: {} };
const schema = [
  { id: "f-title", key: "title", type: "string" },
  { id: "f-price", key: "price", type: "number" },
];
const input = {
  name: "Items",
  project_id: ROUTE,
  schema,
  mockData: [{ title: "A", price: 10 }],
  useMockData: true,
} as never;

/** ADR-286: the real data store bound to the workspace (phase4eQuickConnect). */
function boundStore() {
  return {
    get collections() {
      return useDataStore.getState().collections;
    },
    apply: (change: DataChange, options: { document?: readonly unknown[] }) =>
      useDataStore.getState().applyDataChange(change, options),
    collection: (id: string) => useDataStore.getState().collections.get(id),
  };
}

async function open() {
  const library = await buildCodeCatalogLibrary();
  const store = boundStore();
  // Any bound collection's rows: the Quick Connect's (whatever id) or the fixed one.
  const rows: CatalogBoundRow[] = [
    { key: "r1", values: { title: "A", price: 10 } },
    { key: "r2", values: { title: "B", price: 20 } },
  ];
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-277" }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr277-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: { rows: () => rows },
    },
  );
  useDataStore.getState().reset();
  bindCatalogDataStore(workspace);
  const paletteHost = {
    graph: workspace.runtime.graph,
    get records() {
      return workspace.root.domInputs;
    },
    selection: () => workspace.session.getSnapshot().selection,
    itemOfRecord: (identity: string) => workspace.itemOfRecord(identity),
    pageContent: () => ({ kind: "node" as const, id: BODY }),
    newId: workspace.newId,
  };
  const command = catalogPaletteInsertCommand(paletteHost, "Table");
  if (!command) throw new Error("no place for Table");
  const table = workspace.execute(command).plan.selectAfter![0] as NodeId;
  const host = createCatalogQuickConnectHost(
    workspace,
    store,
    (name) => `Create table and connect — ${name}`,
  );
  const graph = workspace.runtime.graph;
  const typeOf = (record: CatalogConsumerNode) =>
    graph.getDefinition(record.definitionId as DefinitionId)?.name ?? "";
  const find = (id: string, type: string): CatalogConsumerNode | undefined => {
    const record = workspace.root.domInputs.get(id);
    if (!record) return undefined;
    if (typeOf(record) === type) return record;
    for (const child of record.children) {
      const found = find(child, type);
      if (found) return found;
    }
    return undefined;
  };
  const tableRecord = () => workspace.root.recordsOfSource(table)[0]!;
  /** The resolved TableHeader's Columns (their names) and the TableBody's rows as cell texts. */
  const resolved = () => {
    const records = workspace.root.domInputs;
    const header = find(tableRecord(), "TableHeader")!;
    const body = find(tableRecord(), "TableBody")!;
    return {
      columns: header.children.map((id) =>
        String(records.get(id)!.props.children ?? ""),
      ),
      rows: body.children.map((rowId) => ({
        type: typeOf(records.get(rowId)!),
        cells: records
          .get(rowId)!
          .children.map((cellId) =>
            String(records.get(cellId)?.props.children ?? ""),
          ),
      })),
    };
  };
  const columnKeys = () =>
    tableHeaderColumns(graph, tableHeaderPosition(graph, table)!).map(
      (column) => column.key,
    );
  const bindingOf = () => {
    const entry = graph.getEntry(table);
    return entry?.kind === "node" ? entry.binding : undefined;
  };
  const target = () => host.capture(workspace.root.recordsOfSource(table)[0]!)!;
  const aligned = () => tableAlignedIn(new CommandDraft(graph), table);
  return {
    workspace,
    graph,
    host,
    table,
    resolved,
    columnKeys,
    bindingOf,
    target,
    aligned,
  };
}

describe("ADR-277 — the palette Table's origin (the starter)", () => {
  it("a new Table resolves to TableHeader(Column 3: Name · Type · Status) + TableBody(Row 1 · Cell 3)", async () => {
    const { resolved, columnKeys, aligned } = await open();
    expect(resolved().columns).toEqual(["Name", "Type", "Status"]);
    expect(resolved().rows).toEqual([
      { type: "Row", cells: ["Item 1", "File", "Active"] },
    ]);
    // (`resolveTableColumnKey`: a Column without `key` reads its name, lower-cased.)
    expect(columnKeys()).toEqual(["name", "type", "status"]);
    expect(aligned()).toBe(true);
  });

  it("a bound Table's resolved TableBody holds the projected rows only (no static Row)", async () => {
    const { workspace, table, resolved } = await open();
    workspace.execute(
      catalogBindingCommand([{ kind: "node", id: table }], BINDING),
    );
    // (The starter's keys read nothing from `{title, price}` — the projected cells are empty;
    // the first connect below replaces the columns.)
    expect(resolved().rows).toEqual([
      { type: "Row", cells: ["", "", ""] },
      { type: "Row", cells: ["", "", ""] },
    ]);
    workspace.execute(
      catalogBindingCommand([{ kind: "node", id: table }], undefined),
    );
    expect(resolved().rows).toEqual([
      { type: "Row", cells: ["Item 1", "File", "Active"] },
    ]);
  });
});

describe("ADR-277 Decision 2 — the first Quick Connect replaces the starter columns (사용자 결정 3)", () => {
  it("resolveColumnMode: no binding → replace; a binding → preserve unless asked; no columns → create", () => {
    const plan = {
      tableId: "t",
      tableHeaderId: "h",
      pageId: null,
      existing: [{ id: "c", key: "name", label: "Name" }],
    };
    expect(resolveColumnMode(plan, false, false)).toBe("replace");
    expect(resolveColumnMode(plan, true, false)).toBe("replace");
    expect(resolveColumnMode(plan, false, true)).toBe("preserve");
    expect(resolveColumnMode(plan, true, true)).toBe("replace");
    expect(resolveColumnMode({ ...plan, existing: [] }, false, true)).toBe(
      "create",
    );
    expect(resolveColumnMode(null, false, false)).toBe("none");
    // Round 2 h1: the capture's `binding` is always the snapshot envelope — the Table's actual
    // binding is its `props`.
    expect(targetHasBinding({ binding: { props: undefined } })).toBe(false);
    expect(targetHasBinding({ binding: {} })).toBe(false);
    expect(targetHasBinding({ binding: { props: BINDING } })).toBe(true);
  });

  it("a {title, price} schema connected with the defaults: columns = title · price, cells = the row values (no blank)", async () => {
    const { host, target, resolved, columnKeys, bindingOf, aligned } =
      await open();
    const captured = target();
    expect(captured.binding).toEqual({ props: undefined });
    expect(targetHasBinding(captured)).toBe(false);
    expect(host.planColumns(captured)!.existing.map((c) => c.key)).toEqual([
      "name",
      "type",
      "status",
    ]);
    const created = await host.execute({
      input,
      target: captured,
      projectId: ROUTE,
    });
    expect(host.readBack(captured.elementId, created.id)).toBe(true);
    expect(bindingOf()?.collectionId).toBe(`data:collection:${created.id}`);
    expect(columnKeys()).toEqual(["title", "price"]);
    expect(resolved().columns).toEqual(["title", "price"]);
    expect(resolved().rows).toEqual([
      { type: "Row", cells: ["A", "10"] },
      { type: "Row", cells: ["B", "20"] },
    ]);
    expect(resolved().rows.flatMap((row) => row.cells)).not.toContain("");
    expect(aligned()).toBe(true);
  });

  it("a reconnect keeps the columns by default and replaces them when asked", async () => {
    const { host, target, columnKeys } = await open();
    await host.execute({ input, target: target(), projectId: ROUTE });
    expect(columnKeys()).toEqual(["title", "price"]);
    const other = {
      ...(input as Record<string, unknown>),
      name: "Other",
      schema: [{ id: "f-sku", key: "sku", type: "string" }],
      mockData: [{ sku: "x" }],
    } as never;
    const bound = target();
    expect(targetHasBinding(bound)).toBe(true);
    await host.execute({ input: other, target: bound, projectId: ROUTE });
    expect(columnKeys()).toEqual(["title", "price"]);
    await host.execute({
      input: other,
      target: target(),
      projectId: ROUTE,
      replaceColumns: true,
    });
    expect(columnKeys()).toEqual(["sku"]);
  });

  it("replace rebuilds the static Row's cells (one per new column): unbound, the Table is aligned", async () => {
    const { workspace, table, host, target, resolved, aligned } = await open();
    await host.execute({ input, target: target(), projectId: ROUTE });
    expect(aligned()).toBe(true);
    workspace.execute(
      catalogBindingCommand([{ kind: "node", id: table }], undefined),
    );
    // The starter Row is back with two (empty) cells under the two schema columns.
    expect(resolved().columns).toEqual(["title", "price"]);
    expect(resolved().rows).toEqual([{ type: "Row", cells: ["", ""] }]);
    expect(aligned()).toBe(true);
  });
});

describe("ADR-277 — one table type", () => {
  it("the S2-named second table is gone: rule · binding · renderer · origin · palette · catalog", async () => {
    const library = await buildCodeCatalogLibrary();
    expect(
      (COMPONENT_RULES_TABLE as Record<string, unknown>).TableView,
    ).toBeUndefined();
    expect(getPrimitiveBinding("TableView")).toBeUndefined();
    expect(
      (INTERNAL_RENDERERS as Record<string, unknown>).tableview,
    ).toBeUndefined();
    expect(
      library.definitions.has(
        "lib:definition:origin-component-tableview" as `lib:definition:${string}`,
      ),
    ).toBe(false);
    expect(
      [...library.templates.keys()].some((id) =>
        String(id).startsWith("lib:template:component-tableview"),
      ),
    ).toBe(false);
    expect(
      library.definitions.has(
        "lib:definition:origin-component-table" as `lib:definition:${string}`,
      ),
    ).toBe(true);
    expect(getCatalogEntry("TableView")).toBeUndefined();
    const palette = getPaletteItems();
    expect(palette.some((item) => item.type === "TableView")).toBe(false);
    expect(palette.filter((item) => item.type === "Table")).toHaveLength(1);
    // The Table keeps its surface (S2 TableView's axes + composition's height).
    const table = getPrimitiveBinding("Table")!;
    for (const key of [
      "dataBinding",
      "isQuiet",
      "density",
      "selectionMode",
      "selectionStyle",
      "overflowMode",
      "heightMode",
      "height",
    ])
      expect(table.props.accepts, key).toHaveProperty(key);
    // (S2 TableView has no size axis — ADR-295 후속 C1 removed the Table's S · M · L.)
    expect(table.props.accepts).not.toHaveProperty("size");
  });

  it("raises the library contract to 44 — a 43 document is refused, not converted", async () => {
    // (ADR-278 raised it again, to 45 — the refusal of an older contract is the same.)
    expect(LIBRARY_CONTRACT_VERSION).toBeGreaterThanOrEqual(44);
    const library = await buildCodeCatalogLibrary();
    const document = newCatalogProjectDocument({
      projectId: PROJECT,
      name: "old",
    });
    let code: string | undefined;
    try {
      new CatalogGraph(
        {
          ...document,
          libraryContractVersion: 43,
        } as unknown as CatalogDocument,
        library,
      );
    } catch (error) {
      code = (error as CatalogValidationError).code;
    }
    expect(code).toBe("UNSUPPORTED_LIBRARY_CONTRACT");
  });
});
