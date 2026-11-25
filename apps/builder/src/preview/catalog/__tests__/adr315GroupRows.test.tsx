import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { resolveTableColumnKey } from "../../../../../../packages/shared/src/collections/resolveCollectionItems";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * (Harness: the same as `adr315Columns.test.tsx`.)
 * ADR-315 Phase 5 (G5) — a Table's group rows. Phase 4 (G4) — a Table's column slices in the Preview: hiding and ordering its Columns
 * changes the header and every Row's cells together (RAC throws on a row whose cells are not its
 * columns), reads no row again (HC4), and leaves what the rows are searched by as it was (리뷰
 * round 1 H2 — a hidden Column is still searched). The Canvas draws the authored default
 * (a Column's 「Hidden by default」), the Preview a Table state over it (HC9).
 *
 * Fixture (Name · Type · Status are the Table's Columns):
 *   p1 Bora B 2 · p2 Chan A 1 · p3 Ara B 3 · p4 Dana A 5 · p5 Eun A —
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

async function openTable(bound = true) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
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
  if (bound)
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
  h.flush();
  await settle();
  const root = () => h.session.root!;
  const table = () =>
    [...root().domInputs.values()].find((record) => record.ruleId === "Table")!;
  /** The drawn header's Column keys, in order. */
  const columnKeys = (from = root()) => {
    const drawn = [...from.domInputs.values()].find(
      (record) => record.ruleId === "Table",
    )!;
    const header = drawn.children
      .map((child) => from.domInputs.get(child))
      .find((record) => record?.ruleId === "TableHeader")!;
    // (The selection column is no data column — its `Checkbox[slot=selection]`; a Column the
    //  Builder keeps hidden is a record that is not drawn — `hidden`.)
    return header.children
      .map((child) => from.domInputs.get(child)!)
      .filter(
        (record) =>
          record.ruleId === "Column" &&
          !record.hidden &&
          !record.children.some(
            (part) => from.domInputs.get(part)?.props.slot === "selection",
          ),
      )
      .map((record, index) =>
        resolveTableColumnKey(record.props as Record<string, unknown>, index),
      );
  };
  const column = (key: string) => {
    const header = table()
      .children.map((child) => root().domInputs.get(child))
      .find((record) => record?.ruleId === "TableHeader")!;
    return header.children
      .map((child) => root().domInputs.get(child)!)
      .find((record) => record.props.key === key)!;
  };
  /** The DOM: the header's names, and each data row's cell texts. */
  const dom = () => ({
    headers: [
      ...h.view.container.querySelectorAll('[role="columnheader"]'),
    ].map((cell) => (cell.textContent ?? "").trim()),
    rows: [...h.view.container.querySelectorAll('[role="row"]')]
      .map((row) =>
        [...row.querySelectorAll('[role="rowheader"], [role="gridcell"]')].map(
          (cell) => (cell.textContent ?? "").trim(),
        ),
      )
      .filter((cells) => cells.length > 0),
  });
  const set = async (patch: Record<string, unknown>) => {
    act(() => h.session.tables.setTableState(table().id, patch));
    await settle();
  };
  return { h, id, table, columnKeys, column, dom, set, errors };
}

describe("a Table's group rows (ADR-315 Phase 5)", () => {
  it("groups by a Column: a group row per value (value · count · aggregates), collapsed; opening it reads its rows nested", async () => {
    const t = await openTable();
    // 「Status」 sums the group's rows — Eun's empty status is no number.
    t.h.workspace.execute(
      setFields({
        targets: [
          t.h.workspace.positionOfRecord(t.column("status").id)!.target,
        ],
        props: { aggregate: { kind: "set", value: "sum" } },
      }),
    );
    t.h.flush();
    await settle();
    await t.set({ grouping: ["type"] });
    // Two group rows (B first — Bora's), collapsed: their rows are not drawn.
    // (The grouped Column stands first — TanStack's `reorder`; the other cells of a group row are
    //  empty but for an aggregate.)
    expect(t.dom().headers).toEqual(["Type", "Name", "Status"]);
    expect(t.dom().rows).toEqual([
      ["B (2)", "", "5"],
      ["A (3)", "", "6"],
    ]);
    const groupRows = [
      ...t.h.view.container.querySelectorAll('[role="row"][aria-expanded]'),
    ];
    expect(groupRows.map((row) => row.getAttribute("aria-expanded"))).toEqual([
      "false",
      "false",
    ]);
    // (The grouped Column is RAC's `treeColumn`: its cells hold the expand button.)
    expect(
      t.h.view.container.querySelectorAll('[slot="chevron"]').length,
    ).toBe(2);
    // Open B: its rows under it, one level down.
    act(() => {
      fireEvent.click(
        groupRows[0]!.querySelector('[slot="chevron"]') as HTMLElement,
      );
    });
    await settle();
    expect(t.h.session.tables.tableState(t.table().id).expandedKeys).toEqual([
      'group:["B"]',
    ]);
    expect(t.dom().rows).toEqual([
      ["B (2)", "", "5"],
      ["B", "Bora", "2"],
      ["B", "Ara", "3"],
      ["A (3)", "", "6"],
    ]);
    const levels = [
      ...t.h.view.container.querySelectorAll('[role="row"][aria-level]'),
    ].map((row) => row.getAttribute("aria-level"));
    expect(levels).toEqual(["1", "2", "2", "1"]);
    // Ungrouped: the rows and the columns as before.
    await t.set({ grouping: [] });
    expect(t.dom().headers).toEqual(["Name", "Type", "Status"]);
    expect(t.dom().rows.map((cells) => cells[0])).toEqual([
      "Bora",
      "Chan",
      "Ara",
      "Dana",
      "Eun",
    ]);
    expect(
      t.errors.mock.calls.filter((call) => /Cell count|column count/i.test(String(call[0]))),
    ).toEqual([]);
    t.h.view.unmount();
  }, 120_000);

  it("a Column 「Grouped」 groups the Preview's Table at first; a sort on it orders the groups", async () => {
    const t = await openTable();
    t.h.workspace.execute(
      setFields({
        targets: [t.h.workspace.positionOfRecord(t.column("type").id)!.target],
        props: { defaultGrouped: { kind: "set", value: true } },
      }),
    );
    t.h.flush();
    await settle();
    expect(t.dom().rows.map((cells) => cells.find((cell) => cell.includes("(")))).toEqual([
      "B (2)",
      "A (3)",
    ]);
    await t.set({ sort: [{ column: "type", direction: "ascending" }] });
    expect(t.dom().rows.map((cells) => cells.find((cell) => cell.includes("(")))).toEqual([
      "A (3)",
      "B (2)",
    ]);
    // The reader's 「not grouped」 over the author's grouping.
    await t.set({ grouping: [] });
    expect(t.h.session.tables.tableState(t.table().id).grouping).toEqual([]);
    expect(t.dom().rows).toHaveLength(5);
    t.h.view.unmount();
  }, 120_000);
});
