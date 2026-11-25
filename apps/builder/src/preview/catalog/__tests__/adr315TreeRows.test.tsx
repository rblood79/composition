import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogTableTotalsCommand } from "../../../builder/catalogRuntime/tableTotals";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 5 증분 5d — a Table whose binding names its rows' child rows (breakdown §5.4
 * 「계층 데이터」 — the binding's parent ID field or children field, a Tree's roles): its rows are a
 * tree (RAC nested Rows · `treeColumn` — the first data Column), every row collapsed at first; every
 * level is searched (a match keeps its path) · sorted (among its siblings) · totalled; the page ·
 * window count top rows.
 *
 * Fixture (Name · Type · Status, parent): p1 Bora B 2 · p2 Chan A 1 (p1) · p3 Ara B 3 (p1) ·
 * p4 Dana A 5 · p5 Eun A — (p4) · p6 Gim B 4 (p2).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-type", key: "type", type: "string" },
  { id: "f-status", key: "status", type: "number" },
];
const FLAT = {
  id: "people",
  name: "People",
  schema: [...SCHEMA, { id: "f-parent", key: "parent", type: "string" }],
  mockData: [
    { id: "p1", name: "Bora", type: "B", status: 2, parent: null },
    { id: "p2", name: "Chan", type: "A", status: 1, parent: "p1" },
    { id: "p3", name: "Ara", type: "B", status: 3, parent: "p1" },
    { id: "p4", name: "Dana", type: "A", status: 5, parent: null },
    { id: "p5", name: "Eun", type: "A", status: null, parent: "p4" },
    { id: "p6", name: "Gim", type: "B", status: 4, parent: "p2" },
  ],
  useMockData: true,
};
/** The same tree as nested arrays (a children field). */
const NESTED = {
  id: "nested",
  name: "Nested",
  schema: [...SCHEMA, { id: "f-kids", key: "kids", type: "array" }],
  mockData: [
    {
      id: "p1",
      name: "Bora",
      type: "B",
      status: 2,
      kids: [
        {
          id: "p2",
          name: "Chan",
          type: "A",
          status: 1,
          kids: [{ id: "p6", name: "Gim", type: "B", status: 4 }],
        },
        { id: "p3", name: "Ara", type: "B", status: 3 },
      ],
    },
    {
      id: "p4",
      name: "Dana",
      type: "A",
      status: 5,
      kids: [{ id: "p5", name: "Eun", type: "A", status: null }],
    },
  ],
  useMockData: true,
};

async function openTable(collection: "people" | "nested") {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [FLAT, NESTED],
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
        collectionId: collection,
        name: collection,
        fieldMap:
          collection === "people"
            ? { parentId: "f-parent" }
            : { children: "f-kids" },
      })!,
    ),
  );
  h.flush();
  await settle();
  const root = () => h.session.root!;
  const table = () =>
    [...root().domInputs.values()].find((record) => record.ruleId === "Table")!;
  const column = (key: string) => {
    const header = [...h.workspace.root.domInputs.values()].find(
      (record) => record.ruleId === "TableHeader",
    )!;
    return header.children
      .map((child) => h.workspace.root.domInputs.get(child)!)
      .find((record) => record.props.key === key)!;
  };
  /** The body's rows: each one's level, its expanded state and its Name cell. */
  const rows = () =>
    [...h.view.container.querySelectorAll('tbody [role="row"]')].map((row) => [
      row.getAttribute("aria-level"),
      row.getAttribute("aria-expanded"),
      (row.querySelector('[role="rowheader"]')?.textContent ?? "").trim(),
    ]);
  const set = async (patch: Record<string, unknown>) => {
    act(() => h.session.tables.setTableState(table().id, patch));
    await settle();
  };
  return { h, id, table, column, rows, set, errors };
}

describe("a Table's tree rows (ADR-315 Phase 5 증분 5d)", () => {
  for (const collection of ["people", "nested"] as const)
    it(`${collection === "people" ? "a parent ID field" : "a children field"}: top rows collapsed · open one · sort among siblings · a search keeps a match's path · totals over every level`, async () => {
      const t = await openTable(collection);
      // The top rows, collapsed: their child rows are not drawn (RAC still counts them expandable).
      expect(
        t.h.view.container.querySelector('[role="treegrid"]'),
      ).not.toBeNull();
      expect(t.rows()).toEqual([
        ["1", "false", "Bora"],
        ["1", "false", "Dana"],
      ]);
      // (The first data Column — Name — holds the expand button.)
      expect(
        t.h.view.container.querySelectorAll('[slot="chevron"]').length,
      ).toBe(2);
      // Open Bora: its two child rows one level down; Chan has a child row of its own.
      act(() => {
        fireEvent.click(
          t.h.view.container.querySelector(
            'tbody [role="row"] [slot="chevron"]',
          ) as HTMLElement,
        );
      });
      await settle();
      expect(t.h.session.tables.tableState(t.table().id).expandedKeys).toEqual(["p1"]);
      expect(t.rows()).toEqual([
        ["1", "true", "Bora"],
        ["2", "false", "Chan"],
        ["2", null, "Ara"],
        ["1", "false", "Dana"],
      ]);
      // A sort by Name: each level among itself (Ara before Chan; the top rows stay Bora · Dana).
      await t.set({ sort: [{ column: "name", direction: "ascending" }] });
      expect(t.rows().map((row) => row[2])).toEqual([
        "Bora",
        "Ara",
        "Chan",
        "Dana",
      ]);
      await t.set({ sort: [{ column: "name", direction: "descending" }] });
      expect(t.rows().map((row) => row[2])).toEqual([
        "Dana",
        "Bora",
        "Chan",
        "Ara",
      ]);
      // A search 「gim」 — a grandchild: its path stays (Bora › Chan › Gim), Dana · Ara do not.
      await t.set({ sort: [], search: "gim", expandedKeys: ["p1", "p2"] });
      expect(t.rows()).toEqual([
        ["1", "true", "Bora"],
        ["2", "true", "Chan"],
        ["3", null, "Gim"],
      ]);
      // Totals over every level: Status 2 + 1 + 3 + 5 + 4 (Eun's empty status is no number).
      await t.set({ search: "" });
      t.h.workspace.execute(
        setFields({
          targets: [
            t.h.workspace.positionOfRecord(t.column("status").id)!.target,
          ],
          props: { aggregate: { kind: "set", value: "sum" } },
        }),
      );
      t.h.workspace.execute(
        catalogTableTotalsCommand(
          t.h.workspace.runtime.graph,
          t.id,
          true,
          t.h.workspace.newId,
        ),
      );
      t.h.flush();
      await settle();
      const totals = [
        ...(t.h.view.container
          .querySelector('tfoot [role="row"]')
          ?.querySelectorAll('[role="rowheader"], [role="gridcell"]') ?? []),
      ].map((cell) => (cell.textContent ?? "").trim());
      expect(totals.at(-1)).toBe("15");
      expect(
        t.errors.mock.calls.filter((call) =>
          /Cell count|column count|Cannot read/i.test(String(call[0])),
        ),
      ).toEqual([]);
      t.h.view.unmount();
    }, 120_000);
  it("pages count top rows: an open row's child rows stay on its page (TanStack `paginateExpandedRows: false`)", async () => {
    const t = await openTable("people");
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "pages", size: 1 }));
    t.h.flush();
    await settle();
    await t.set({ expandedKeys: ["p1"] });
    expect(t.rows().map((row) => row[2])).toEqual(["Bora", "Chan", "Ara"]);
    expect(t.h.session.pageOf(t.id)?.count).toBe(2);
    await act(() => t.h.session.goToPage(t.id, 2));
    await settle();
    expect(t.rows().map((row) => row[2])).toEqual(["Dana"]);
    t.h.view.unmount();
  }, 120_000);
});
