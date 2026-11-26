import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import type {
  NodeId,
  NodeParent,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogColumnEditableCommand } from "../../../builder/catalogRuntime/tableEditableCell";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-317 Phase 1 (G1) — several cells written at once: the session's `updateMany` (one edit
 * record, one read of the rows — HC5) with `update`'s judgment for each value (HC2 — 사용자 결정 8:
 * a value its field's type cannot read is not written, the item keeps its value, by `update` too),
 * and the Table controller's `editTableCells` (HC3 — data rows of 「Editable」 Columns only).
 *
 * Fixture: p1 Bora 10 · p2 Chan 20 · p3 Dami 30 (`amount` number, `double` computed). The wanted
 * values below are written by hand — not read back from the system.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const USERS = {
  id: "users",
  name: "Users",
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-amount", key: "amount", type: "number" },
    {
      id: "f-double",
      key: "double",
      type: "number",
      formula: "'f-amount' * 2",
    },
  ],
  mockData: [
    { id: "p1", name: "Bora", amount: 10 },
    { id: "p2", name: "Chan", amount: 20 },
    { id: "p3", name: "Dami", amount: 30 },
  ],
  useMockData: true,
};

async function openTable(props: Record<string, unknown> = {}) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [USERS],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  const id = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  for (const [key, value] of Object.entries(props))
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { [key]: { kind: "set", value } } as never,
      }),
    );
  h.flush();
  await settle();
  const session = h.session;
  const internals = session as unknown as {
    currentRoot: { refreshRows: (...args: unknown[]) => unknown[] };
    itemEdits: Map<string, unknown[]>;
  };
  const refreshes = vi.spyOn(internals.currentRoot, "refreshRows");
  const edits = () => internals.itemEdits.get("users")?.length ?? 0;
  const item = (key: string) =>
    (session.collectionItems("users") as Record<string, unknown>[]).find(
      (each) => each.id === key,
    )!;
  const root = () => h.workspace.root;
  /** A header Column's position (by its key) — for its 「Editable」. */
  const column = (key: string): NodeParent => {
    const header = [...root().canvasInputs.values()].find(
      (record) => root().typeOf(record as never) === "TableHeader",
    )!;
    const record = header.children
      .map((child) => root().canvasInputs.get(child)!)
      .find((each) => each.props.key === key)!;
    return h.workspace.positionOfRecord(record.id)!.target as NodeParent;
  };
  const editable = async (key: string) => {
    h.workspace.execute(
      catalogColumnEditableCommand(
        h.workspace.runtime.graph,
        column(key),
        true,
        h.workspace.newId,
        { edit: (label) => `Edit ${label}` },
      ),
    );
    h.flush();
    await settle();
  };
  /** The Preview's Table record. */
  const table = () => {
    const preview = (
      session as unknown as {
        root: { domInputs: Map<string, { ruleId: string; id: string }> };
      }
    ).root;
    return [...preview.domInputs.values()].find(
      (record) => record.ruleId === "Table",
    )!.id;
  };
  return { h, session, refreshes, edits, item, editable, table };
}

describe("ADR-317 Phase 1 — the session's several-item write", () => {
  it("writes every readable field in one edit record and one read of the rows; the rest is counted", async () => {
    const t = await openTable();
    const before = t.edits();
    t.refreshes.mockClear();
    const result = t.session.updateMany("users", [
      { key: "p1", fields: { name: "Bori", amount: "1234.5" } },
      { key: "p2", fields: { amount: "abc" } },
      { key: "p3", fields: { amount: "Price", double: "5", id: "x" } },
      { key: "zz", fields: { name: "N" } },
      { key: "p1", fields: { nickname: "B" } },
    ]);
    expect(t.refreshes).toHaveBeenCalledTimes(1);
    expect(t.edits()).toBe(before + 1);
    expect(result.ok).toBe(true);
    expect(result.written).toEqual([
      { key: "p1", field: "name" },
      { key: "p1", field: "amount" },
    ]);
    expect(result.skipped).toEqual({
      unread: 2,
      computed: 1,
      keyField: 1,
      missing: 1,
      unknown: 1,
    });
    expect(t.item("p1")).toMatchObject({ name: "Bori", amount: 1234.5 });
    // (Not readable as a number — the item keeps its value, never `null`.)
    expect(t.item("p2")).toMatchObject({ name: "Chan", amount: 20 });
    expect(t.item("p3")).toMatchObject({ id: "p3", name: "Dami", amount: 30 });
    t.h.view.unmount();
  }, 120_000);

  it("writes nothing — no edit record, no read of the rows", async () => {
    const t = await openTable();
    const before = t.edits();
    t.refreshes.mockClear();
    const result = t.session.updateMany("users", [
      { key: "p1", fields: { amount: "abc" } },
      { key: "nope", fields: { name: "N" } },
    ]);
    expect(result).toEqual({
      ok: true,
      written: [],
      skipped: { unread: 1, missing: 1 },
    });
    expect(t.refreshes).not.toHaveBeenCalled();
    expect(t.edits()).toBe(before);
    t.h.view.unmount();
  }, 120_000);

  it("gives the same item values as `update` (EditableCell · Do update) for the same texts", async () => {
    const t = await openTable();
    expect(
      t.session.update("users", "p1", { amount: "42", name: "Ana" }),
    ).toEqual({ ok: true, seq: expect.any(Number) });
    t.session.updateMany("users", [
      { key: "p2", fields: { amount: "42", name: "Ana" } },
    ]);
    expect(t.item("p1")).toMatchObject({ amount: 42, name: "Ana" });
    expect(t.item("p2")).toMatchObject({ amount: 42, name: "Ana" });
    t.h.view.unmount();
  }, 120_000);

  it("사용자 결정 8 — `update` keeps a field its type cannot read and says so", async () => {
    const t = await openTable();
    const alone = t.session.update("users", "p1", { amount: "abc" });
    expect(alone.ok).toBe(false);
    expect(alone.reason).toContain("amount");
    expect(t.item("p1")).toMatchObject({ amount: 10 });
    const partly = t.session.update("users", "p1", {
      name: "Bo",
      amount: "Price",
    });
    expect(partly.ok).toBe(true);
    expect(partly.reason).toContain("amount");
    expect(t.item("p1")).toMatchObject({ name: "Bo", amount: 10 });
    // (An empty text is the field's empty value — not refused.)
    expect(t.session.update("users", "p1", { amount: "" })).toEqual({
      ok: true,
      seq: expect.any(Number),
    });
    expect(t.item("p1").amount).toBeNull();
    t.h.view.unmount();
  }, 120_000);
});

describe("ADR-317 Phase 1 — the Table's several-cell write", () => {
  it("writes only data rows' cells of 「Editable」 Columns, through one write", async () => {
    const t = await openTable({ allowsCellSelection: true });
    await t.editable("name");
    t.refreshes.mockClear();
    const result = t.session.tables.editTableCells(t.table(), [
      { row: "p1", column: "name", value: "Q" },
      { row: "p2", column: "name", value: "R" },
      { row: "p1", column: "amount", value: "5" },
      { row: "group:x", column: "name", value: "S" },
    ]);
    expect(t.refreshes).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.written).toEqual([
      { key: "p1", field: "name" },
      { key: "p2", field: "name" },
    ]);
    expect(result.skipped).toEqual({ notEditable: 1, notDataRow: 1 });
    expect(t.item("p1")).toMatchObject({ name: "Q", amount: 10 });
    expect(t.item("p2")).toMatchObject({ name: "R" });
    expect(t.item("p3")).toMatchObject({ name: "Dami" });
    t.h.view.unmount();
  }, 120_000);

  it("a Table not bound to data writes nothing", async () => {
    const t = await openTable({ allowsCellSelection: true });
    const result = t.session.tables.editTableCells("no-such-table", [
      { row: "p1", column: "name", value: "Q" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.written).toEqual([]);
    t.h.view.unmount();
  }, 120_000);
});
