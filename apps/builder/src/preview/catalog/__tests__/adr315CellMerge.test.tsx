import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import { catalogTableGroupKey } from "../../../../../../packages/shared/src/catalog/runtime/tableRowSlices";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { resolveTableColumnKey } from "../../../../../../packages/shared/src/collections/resolveCollectionItems";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogTableDetailCommand } from "../../../builder/catalogRuntime/tableDetail";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 6 — a Column 「Merge same values」 (breakdown §5.5): in the order shown, a cell whose
 * value is its row above's draws no value and no line between them. The DOM keeps every row's Cell
 * and its text (a screen reader reads it — `opacity`, not `visibility`); a merged Table's body row
 * line is its cells' (the Row draws none), so a merged cell has none under it.
 *
 * Fixture (Name · Type · Status): p1 Bora B 2 · p2 Chan A 1 · p3 Ara B 3 · p4 Dana A 5 · p5 Eun A —
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
};

async function openTable(users = USERS, virtual = false) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [users],
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
  // (jsdom lays nothing out: the rows in view are given by hand — `adr310VirtualTable.test.tsx`.)
  const showRows = h.session.showRows.bind(h.session);
  if (virtual) {
    vi.spyOn(h.session, "showRows").mockImplementation(() => {});
    h.workspace.execute(setRowDisplay(id, { mode: "virtual" }));
  }
  h.flush();
  await settle();
  const root = () => h.session.root!;
  const get = (recordId: string) => root().domInputs.get(recordId)!;
  const table = () =>
    [...root().domInputs.values()].find((record) => record.ruleId === "Table")!;
  const column = (key: string) => {
    const header = table()
      .children.map(get)
      .find((record) => record.ruleId === "TableHeader")!;
    return header.children
      .map(get)
      .find(
        (record, index) =>
          resolveTableColumnKey(
            record.props as Record<string, unknown>,
            index,
          ) === key,
      )!;
  };
  const merge = async (key: string, on = true) => {
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(column(key).id)!.target],
        props: { mergeSameValues: { kind: "set", value: on } },
      }),
    );
    h.flush();
    await settle();
  };
  /** The body's data rows: each one's record and its Cell records, in order. */
  const bodyRows = () => {
    const body = table()
      .children.map(get)
      .find((record) => record.bindingId === "tablebody")!;
    return body.children
      .map(get)
      .filter((record) => record.bindingId === "row")
      .map((row) => ({
        row,
        cells: row.children
          .map(get)
          .filter((record) => record.ruleId === "Cell"),
      }));
  };
  /** The DOM: each data row's cells — text, whether drawn (opacity), its bottom line. */
  const dom = () =>
    [...h.view.container.querySelectorAll('[role="row"]')]
      .filter((row) =>
        row.querySelector('[role="gridcell"], [role="rowheader"]'),
      )
      .map((row) => ({
        line: (row as HTMLElement).style.borderBottomWidth,
        cells: [
          ...row.querySelectorAll('[role="rowheader"], [role="gridcell"]'),
        ].map((cell) => {
          // (Its content: the catalog elements in it — a tree column's expand button is RAC's.)
          const content = [
            ...cell.querySelectorAll<HTMLElement>("[data-catalog-id]"),
          ];
          return {
            text: (cell.textContent ?? "").trim(),
            shown: !content.some((element) => element.style.opacity === "0"),
            line: (cell as HTMLElement).style.borderBottomWidth,
          };
        }),
      }));
  const set = async (patch: Record<string, unknown>) => {
    act(() => h.session.tables.setTableState(table().id, patch));
    await settle();
  };
  /** The body's row records by their place in the rows shown (a window's or all). */
  const windowRows = () =>
    new Map(
      [...root().domInputs.values()]
        .filter(
          (record) =>
            record.bindingId === "row" &&
            root().domInputs.get(record.parentId)?.bindingId === "tablebody",
        )
        .map((record) => [record.rowIndex!, record] as const),
    );
  /** A row record's Cell in a Column: drawn (its content), its line. */
  const cellOf = (row: { children: readonly string[] }, key: string) => {
    const cells = row.children
      .map(get)
      .filter((record) => record.ruleId === "Cell");
    const place = table()
      .children.map(get)
      .find((record) => record.ruleId === "TableHeader")!
      .children.map(get)
      .findIndex(
        (record, index) =>
          resolveTableColumnKey(
            record.props as Record<string, unknown>,
            index,
          ) === key,
      );
    const cell = cells[place]!;
    return {
      merged: cell.props._cellMerged === true,
      line: cell.props._cellLine,
    };
  };
  return {
    h,
    root,
    get,
    table,
    column,
    merge,
    bodyRows,
    dom,
    set,
    errors,
    showRows,
    windowRows,
    cellOf,
  };
}

describe("a Column's same values run together (ADR-315 Phase 6)", () => {
  it("a group's rows run together inside it, never into a group row", async () => {
    const t = await openTable();
    await t.merge("type");
    await t.set({
      grouping: ["type"],
      expandedKeys: [catalogTableGroupKey(["B"]), catalogTableGroupKey(["A"])],
    });
    const rows = t.dom();
    // B (2) · Bora · Ara · A (3) · Chan · Dana · Eun — the grouped Column first.
    expect(rows.map((row) => row.cells[0]!.text)).toEqual([
      "B (2)",
      "B",
      "B",
      "A (3)",
      "A",
      "A",
      "A",
    ]);
    expect(rows.map((row) => row.cells[0]!.shown)).toEqual([
      true,
      true,
      false,
      true,
      true,
      false,
      false,
    ]);
    expect(rows.map((row) => row.cells[0]!.line)).toEqual([
      "1px",
      "0px",
      "1px",
      "1px",
      "0px",
      "0px",
      "1px",
    ]);
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();
  }, 120_000);

  it("a group row runs into no row — two closed groups of one aggregate value stay apart", async () => {
    // 50 rows, type T0 … T4 by turns (10 a team): every group's 「Count」 of Status is 10.
    const t = await openTable({
      ...USERS,
      mockData: Array.from({ length: 50 }, (_, index) => ({
        id: `p${index + 1}`,
        name: `Person${index + 1}`,
        type: `T${index % 5}`,
        status: index,
      })),
    });
    t.h.workspace.execute(
      setFields({
        targets: [
          t.h.workspace.positionOfRecord(t.column("status").id)!.target,
        ],
        props: { aggregate: { kind: "set", value: "count" } },
      }),
    );
    await t.merge("status");
    await t.set({ grouping: ["type"] });
    const rows = t.bodyRows();
    expect(rows).toHaveLength(5);
    expect(rows.map(({ row }) => row.props._mergeUp ?? null)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();
  }, 120_000);

  it("an open detail row ends a run: the row after it shows its value", async () => {
    const t = await openTable();
    t.h.workspace.execute(
      catalogTableDetailCommand(
        t.h.workspace.runtime.graph,
        t.table().sourceId as never,
        true,
        t.h.workspace.newId,
      ),
    );
    t.h.flush();
    await settle();
    await t.merge("type");
    // B · A · B · A · A — p4 open: its detail row stands between p4 and p5.
    await t.set({ expandedKeys: ["p4"] });
    const rows = t.bodyRows();
    const p5 = rows.find(({ row }) => row.props.id === "p5")!.row;
    const p4 = rows.find(({ row }) => row.props.id === "p4")!.row;
    expect(p5.props._mergeUp).toBeUndefined();
    expect(p4.props._mergeDown).toBeUndefined();
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();
  }, 120_000);

  it("a virtual Table: its window's first row shows its value; a window move draws the rows at its old edge again", async () => {
    // 250 rows, type T0 … T9 in runs of 25 (p1 … p25 T0, p26 … p50 T1 …).
    const users = {
      ...USERS,
      mockData: Array.from({ length: 250 }, (_, index) => ({
        id: `p${index + 1}`,
        name: `Person${index + 1}`,
        type: `T${Math.floor(index / 25)}`,
        status: index,
      })),
    };
    const t = await openTable(users, true);
    await t.merge("type");
    let rows = t.windowRows();
    // The window 0 … 59: p51 (T2's first) shows, p52 … p60 not; p60 (59) ends the window — its
    //  line drawn though p61 is T2 too.
    expect(t.cellOf(rows.get(50)!, "type")).toEqual({
      merged: false,
      line: "none",
    });
    expect(t.cellOf(rows.get(51)!, "type")).toEqual({
      merged: true,
      line: "none",
    });
    expect(t.cellOf(rows.get(59)!, "type")).toEqual({
      merged: true,
      line: "bottom",
    });
    expect(t.cellOf(rows.get(24)!, "type")).toEqual({
      merged: true,
      line: "bottom",
    });
    expect(t.cellOf(rows.get(25)!, "type")).toEqual({
      merged: false,
      line: "none",
    });

    const body = [...t.root().domInputs.values()].find(
      (record) => record.bindingId === "tablebody",
    )!;
    const owner = body.rowWindow!.owner;
    act(() => t.showRows(owner, 60, 80, 250));
    await settle();
    rows = t.windowRows();
    const start = Math.min(...rows.keys());
    expect(start).toBeGreaterThan(0);
    // The new window's first row shows its value, mid-run; p60 now runs into p61.
    expect(t.cellOf(rows.get(start)!, "type").merged).toBe(false);
    expect(t.cellOf(rows.get(59)!, "type")).toEqual({
      merged: true,
      line: "none",
    });
    expect(t.cellOf(rows.get(60)!, "type")).toEqual({
      merged: true,
      line: "none",
    });
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();
  }, 120_000);

  it("runs same values in the order shown: no value and no line between; sort · search change it", async () => {
    const t = await openTable();
    await t.merge("type");
    // B · A · B · A · A — only p4 · p5 run together.
    let rows = t.dom();
    expect(rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ["Bora", "B", "2"],
      ["Chan", "A", "1"],
      ["Ara", "B", "3"],
      ["Dana", "A", "5"],
      ["Eun", "A", ""],
    ]);
    // (Its text stays — a screen reader reads every row's Cell; only p5's Type is not drawn.)
    expect(rows.map((row) => row.cells.map((cell) => cell.shown))).toEqual([
      [true, true, true],
      [true, true, true],
      [true, true, true],
      [true, true, true],
      [true, false, true],
    ]);
    // A merged Table's row line is its cells': none under p4's Type, every other cell 1px.
    expect(rows.map((row) => row.line)).toEqual([
      "0px",
      "0px",
      "0px",
      "0px",
      "0px",
    ]);
    expect(rows.map((row) => row.cells.map((cell) => cell.line))).toEqual([
      ["1px", "1px", "1px"],
      ["1px", "1px", "1px"],
      ["1px", "1px", "1px"],
      ["1px", "0px", "1px"],
      ["1px", "1px", "1px"],
    ]);

    // Sorted by Type: A · A · A · B · B — the runs are p2 … p5 · p1 · p3 by the order shown.
    await t.set({ sort: [{ column: "type", direction: "ascending" }] });
    rows = t.dom();
    expect(rows.map((row) => row.cells[1]!.text)).toEqual([
      "A",
      "A",
      "A",
      "B",
      "B",
    ]);
    expect(rows.map((row) => row.cells[1]!.shown)).toEqual([
      true,
      false,
      false,
      true,
      false,
    ]);
    expect(rows.map((row) => row.cells[1]!.line)).toEqual([
      "0px",
      "0px",
      "1px",
      "0px",
      "1px",
    ]);

    // A search keeps Chan · Dana (both A, one after the other) — one run.
    await t.set({ search: "an" });
    rows = t.dom();
    expect(rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ["Chan", "A", "1"],
      ["Dana", "A", "5"],
    ]);
    expect(rows.map((row) => row.cells[1]!.shown)).toEqual([true, false]);

    // Off: the row draws its line again, every value drawn.
    await t.set({ search: "" });
    await t.merge("type", false);
    rows = t.dom();
    expect(rows.map((row) => row.line)).toEqual(
      ["", "", "", "", ""].map(() => rows[0]!.line),
    );
    expect(rows[0]!.line).not.toBe("0px");
    expect(
      rows.flatMap((row) => row.cells.map((cell) => cell.shown)).every(Boolean),
    ).toBe(true);
    expect(
      rows
        .flatMap((row) => row.cells.map((cell) => cell.line))
        .every((line) => line === ""),
    ).toBe(true);
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();
  }, 120_000);

  it("follows its Column moved · pinned; an empty value runs into nothing", async () => {
    // (p4 · p5 both without a status: two empty values, one after the other.)
    const t = await openTable({
      ...USERS,
      mockData: USERS.mockData.map((row) =>
        row.id === "p4" ? { ...row, status: null } : row,
      ),
    });
    await t.merge("status");
    // (Status 2 · 1 · 3 · 5 · — : no two the same — and the empty one runs into nothing.)
    expect(
      t
        .dom()
        .flatMap((row) => row.cells.map((cell) => cell.shown))
        .every(Boolean),
    ).toBe(true);
    await t.merge("status", false);
    await t.merge("type");
    await t.set({
      sort: [{ column: "type", direction: "ascending" }],
      columnOrder: ["type", "name", "status"],
    });
    let rows = t.dom();
    expect(rows.map((row) => row.cells[0]!.text)).toEqual([
      "A",
      "A",
      "A",
      "B",
      "B",
    ]);
    expect(rows.map((row) => row.cells[0]!.shown)).toEqual([
      true,
      false,
      false,
      true,
      false,
    ]);
    expect(rows.map((row) => row.cells[1]!.shown)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    await t.set({ pinnedColumns: { start: [], end: ["type"] } });
    rows = t.dom();
    expect(rows.map((row) => row.cells.at(-1)!.text)).toEqual([
      "A",
      "A",
      "A",
      "B",
      "B",
    ]);
    expect(rows.map((row) => row.cells.at(-1)!.shown)).toEqual([
      true,
      false,
      false,
      true,
      false,
    ]);
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();
  }, 120_000);
});
