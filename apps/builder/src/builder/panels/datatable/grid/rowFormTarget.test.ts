/**
 * ADR-289 R2 (리뷰 H2 round 3) — `resolveRowFormTarget` against real catalog transactions
 * (`CatalogWorkspace` · `bindCatalogDataStore` · `applyDataChange` · `workspace.undo()`): the same
 * array or the same JSON → the opened index; a changed row set · a removed written field · a
 * deleted table → conflict. Rows have no identity — `id` · object comparison is never used.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { bindCatalogDataStore } from "../../../catalogRuntime/catalogDataStore";
import { newCatalogProjectDocument } from "../../../catalogRuntime/project";
import { CatalogStorage } from "../../../catalogRuntime/storage";
import { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../catalogRuntime/__tests__/support/nodeLayoutEngine";
import { useDataStore } from "../../../stores/data";
import {
  openRowFormTarget,
  resolveRowFormTarget,
  SNAPSHOT_MAX_ROWS,
} from "./rowFormTarget";

type Row = Record<string, unknown>;
type Ops = Parameters<
  ReturnType<typeof useDataStore.getState>["applyDataChange"]
>[0]["ops"];

const table = () => useDataStore.getState().collections.get("users");
const change = (ops: Ops) =>
  useDataStore.getState().applyDataChange({ origin: "user", ops });
const target = (
  opened: ReturnType<typeof openRowFormTarget>,
  written = ["f-name"],
) => resolveRowFormTarget(table(), opened, written);

let workspace: CatalogWorkspace | undefined;
let unbind: (() => void) | undefined;
afterEach(() => {
  unbind?.();
  workspace?.dispose();
  useDataStore.getState().reset();
});

async function open(rows: Row[]) {
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:adr289",
      name: "ADR-289",
    }),
    await buildCodeCatalogLibrary(),
  );
  workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr289-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  useDataStore.getState().reset();
  unbind = bindCatalogDataStore(workspace);
  await change([
    {
      op: "create_collection",
      id: "users",
      name: "Users",
      schema: [
        { id: "f-name", key: "name", type: "string" },
        { id: "f-note", key: "note", type: "string" },
      ],
      rows,
    },
  ]);
  return () => table()!.mockData;
}

describe("resolveRowFormTarget — real catalog transactions", () => {
  it("another row deleted → conflict · Undo brings the JSON back → the opened index · the write lands on B", async () => {
    const rows = await open([{ name: "A" }, { name: "B" }, { name: "C" }]);
    const opened = openRowFormTarget(table()!, 1);
    expect(target(opened)).toEqual({ rowIndex: 1 });
    await change([
      { op: "remove_rows", collectionId: "users", rowIndexes: [0] },
    ]);
    expect(target(opened)).toEqual({ conflict: true });
    expect(rows()[1].name).toBe("C");
    workspace!.undo();
    expect(rows()).not.toBe(opened.mockData);
    const resolved = target(opened);
    expect(resolved).toEqual({ rowIndex: 1 });
    const promise = change([
      {
        op: "set_cell",
        collectionId: "users",
        rowIndex: (resolved as { rowIndex: number }).rowIndex,
        fieldId: "f-name",
        value: "B edited",
      },
    ]);
    // Synchronous apply — the state is reduced at the call.
    expect(rows().map((r) => r.name)).toEqual(["A", "B edited", "C"]);
    await promise;
  });

  it("duplicate id B deleted → conflict even though C's id is now unique", async () => {
    const rows = await open([
      { id: "same", name: "shared", note: "B" },
      { id: "same", name: "shared", note: "C" },
    ]);
    const opened = openRowFormTarget(table()!, 0);
    await change([
      { op: "remove_rows", collectionId: "users", rowIndexes: [0] },
    ]);
    expect(target(opened)).toEqual({ conflict: true });
    expect(rows()).toEqual([{ id: "same", name: "shared", note: "C" }]);
  });

  it("the table renamed (re-projected rows, same JSON) → the opened index", async () => {
    const rows = await open([{ name: "B" }]);
    const opened = openRowFormTarget(table()!, 0);
    await change([
      {
        op: "update_collection",
        collectionId: "users",
        patch: { name: "Renamed" },
      },
    ]);
    expect(rows()).not.toBe(opened.mockData);
    expect(target(opened)).toEqual({ rowIndex: 0 });
  });

  it("the written field removed (same row JSON) → conflict", async () => {
    await open([{ name: "B" }]);
    const opened = openRowFormTarget(table()!, 0);
    await change([
      { op: "remove_field", collectionId: "users", fieldId: "f-name" },
    ]);
    expect(JSON.stringify(table()!.mockData)).toBe(opened.snapshot);
    expect(target(opened)).toEqual({ conflict: true });
    expect(target(opened, ["f-note"])).toEqual({ rowIndex: 0 });
  });

  it("another table created and edited → the opened table keeps its array → the opened index", async () => {
    await open([{ name: "B" }]);
    const opened = openRowFormTarget(table()!, 0);
    await change([
      {
        op: "create_collection",
        id: "other",
        name: "Other",
        schema: [{ id: "f-x", key: "x", type: "string" }],
        rows: [{ x: "old" }],
      },
    ]);
    await change([
      {
        op: "set_cell",
        collectionId: "other",
        rowIndex: 0,
        fieldId: "f-x",
        value: "new",
      },
    ]);
    expect(table()!.mockData).toBe(opened.mockData);
    expect(target(opened)).toEqual({ rowIndex: 0 });
  });

  it("the table deleted → conflict", async () => {
    await open([{ name: "B" }]);
    const opened = openRowFormTarget(table()!, 0);
    await change([{ op: "delete_collection", collectionId: "users" }]);
    expect(target(opened)).toEqual({ conflict: true });
  });

  it.each(["edit", "insert", "import"])(
    "the opened table's rows changed by %s → conflict",
    async (kind) => {
      await open([{ name: "B" }]);
      const opened = openRowFormTarget(table()!, 0);
      if (kind === "edit")
        await change([
          {
            op: "set_cell",
            collectionId: "users",
            rowIndex: 0,
            fieldId: "f-note",
            value: "x",
          },
        ]);
      else if (kind === "insert")
        await change([
          {
            op: "insert_rows",
            collectionId: "users",
            rows: [{ name: "new" }],
            at: 0,
          },
        ]);
      else
        await change([
          {
            op: "replace_rows",
            collectionId: "users",
            rows: [{ name: "imported" }],
          },
        ]);
      expect(target(opened)).toEqual({ conflict: true });
    },
  );
});

describe("resolveRowFormTarget — pure edges", () => {
  it("past SNAPSHOT_MAX_ROWS no JSON is kept: the same array passes, a copy is a conflict", () => {
    const mockData = Array.from({ length: SNAPSHOT_MAX_ROWS + 1 }, (_, i) => ({
      name: String(i),
    }));
    const schema = [{ id: "f-name", key: "name", type: "string" as const }];
    const opened = openRowFormTarget({ mockData }, 3);
    expect(opened.snapshot).toBeNull();
    expect(
      resolveRowFormTarget({ mockData, schema }, opened, ["f-name"]),
    ).toEqual({ rowIndex: 3 });
    expect(
      resolveRowFormTarget({ mockData: [...mockData], schema }, opened, [
        "f-name",
      ]),
    ).toEqual({ conflict: true });
  });

  it("no latest table → conflict", () => {
    const opened = openRowFormTarget({ mockData: [{ name: "A" }] }, 0);
    expect(resolveRowFormTarget(undefined, opened, [])).toEqual({
      conflict: true,
    });
  });
});
