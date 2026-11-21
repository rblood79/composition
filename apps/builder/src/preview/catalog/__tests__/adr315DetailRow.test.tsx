import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { CATALOG_VIRTUAL_ROW_WINDOW } from "../../../../../../packages/shared/src/catalog/runtime/catalogPreviewSession";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogTableDetailCommand,
  catalogTableDetailOn,
} from "../../../builder/catalogRuntime/tableDetail";
import {
  insertTableColumns,
  tableHeaderPosition,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { removeTargets } from "../../../../../../packages/shared/src/catalog/commands/structure";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 5 증분 5e — a bound Table's detail row (breakdown §5.4 「상세 행」): the 「Detail
 * row」 switch puts a Row with one cell after the Row template's cells (reading the first data
 * column's field to start with). Each data row expands to it — RAC's nested `<Row>`, its cell
 * spanning every column drawn — read with that row's values; a closed row holds no detail.
 *
 * Fixture (Name · Type · Status): p1 Bora B 1 · p2 Chan A 2 · p3 Ara B 3.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function openTable(rows = 3) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  const names = ["Bora", "Chan", "Ara"];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "users",
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            { id: "f-type", key: "type", type: "string" },
            { id: "f-status", key: "status", type: "number" },
          ],
          mockData: Array.from({ length: rows }, (_, index) => ({
            id: `p${index + 1}`,
            name: names[index] ?? `Person${index + 1}`,
            type: index % 2 ? "A" : "B",
            status: index + 1,
          })),
          useMockData: true,
        },
      ],
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
  h.flush();
  await settle();
  const root = () => h.session.root!;
  const table = () =>
    [...root().domInputs.values()].find((record) => record.ruleId === "Table")!;
  /** The body's rows: each one's key, level, expanded state and cell texts (with spans). */
  const rows_ = () =>
    [...h.view.container.querySelectorAll('tbody [role="row"]')].map((row) => ({
      key: row.getAttribute("data-key"),
      level: row.getAttribute("aria-level"),
      expanded: row.getAttribute("aria-expanded"),
      cells: [
        ...row.querySelectorAll('[role="rowheader"], [role="gridcell"]'),
      ].map((cell) => (cell.textContent ?? "").trim()),
      spans: [
        ...row.querySelectorAll('[role="rowheader"], [role="gridcell"]'),
      ].map((cell) => cell.getAttribute("aria-colspan")),
    }));
  const detailSwitch = async (on: boolean) => {
    h.workspace.execute(
      catalogTableDetailCommand(
        h.workspace.runtime.graph,
        id,
        on,
        h.workspace.newId,
      ),
    );
    h.flush();
    await settle();
  };
  const set = async (patch: Record<string, unknown>) => {
    act(() => h.session.setTableState(table().id, patch));
    await settle();
  };
  return { h, id, table, rows: rows_, detailSwitch, set, errors };
}

describe("a Table's detail row (ADR-315 Phase 5 증분 5e)", () => {
  it("the switch: each data row expands to its detail — one cell over the columns, the row's values", async () => {
    const t = await openTable();
    expect(catalogTableDetailOn(t.h.workspace.runtime.graph, t.id)).toBe(false);
    await t.detailSwitch(true);
    expect(catalogTableDetailOn(t.h.workspace.runtime.graph, t.id)).toBe(true);
    // Every row expandable, closed: no detail drawn.
    expect(
      t.h.view.container.querySelector('[role="treegrid"]'),
    ).not.toBeNull();
    expect(t.rows().map((row) => [row.key, row.expanded])).toEqual([
      ["p1", "false"],
      ["p2", "false"],
      ["p3", "false"],
    ]);
    // Open Chan (its chevron — the first data column's cell): its detail under it, one level down,
    // one cell spanning the three columns, reading Chan's name (the switch's start).
    act(() => {
      fireEvent.click(
        t.h.view.container.querySelector(
          'tbody [role="row"][data-key="p2"] [slot="chevron"]',
        ) as HTMLElement,
      );
    });
    await settle();
    expect(t.h.session.tableState(t.table().id).expandedKeys).toEqual(["p2"]);
    const drawn = t.rows();
    expect(drawn.map((row) => [row.key, row.level])).toEqual([
      ["p1", "1"],
      ["p2", "1"],
      ["p2/detail", "2"],
      ["p3", "1"],
    ]);
    expect(drawn[2]!.cells).toEqual(["Chan"]);
    expect(drawn[2]!.spans).toEqual(["3"]);
    expect(drawn[1]!.expanded).toBe("true");
    // (It looks as its row does — the row's divider: the Row template's look.)
    const rowRecords = [...t.h.session.root!.domInputs.values()].filter(
      (record) => record.bindingId === "row",
    );
    const detailRecord = rowRecords.find((record) =>
      record.id.endsWith("detail"),
    )!;
    expect(detailRecord.visual.borderBottomWidth).toBe(
      rowRecords.find((record) => record.id.endsWith("#row:p2"))!.visual
        .borderBottomWidth,
    );
    expect(detailRecord.visual.borderBottomWidth).toBe(1);
    // A column hidden: the detail cell spans the two drawn.
    await t.set({ hiddenColumns: ["type"] });
    expect(t.rows()[2]!.spans).toEqual(["2"]);
    // A column added: the rows get its cell before their detail (the Table stays aligned), the
    // detail spans the three drawn (Name · Status · Id).
    const node = (type: string) => {
      const entryId = t.h.workspace.newId("node");
      return {
        entries: [
          {
            kind: "node" as const,
            id: entryId,
            definitionId: catalogPaletteDefinitionId(
              t.h.workspace.runtime.graph.library,
              type,
            ),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootId: entryId,
      };
    };
    t.h.workspace.execute(
      insertTableColumns({
        header: tableHeaderPosition(t.h.workspace.runtime.graph, t.id)!,
        columns: [{ key: "id", label: "Id" }],
        buildColumn: () => node("Column"),
        buildCell: () => node("Cell"),
        newId: t.h.workspace.newId,
      }),
    );
    t.h.flush();
    await settle();
    expect(t.rows().map((row) => row.cells)).toEqual([
      ["Bora", "1", "p1"],
      ["Chan", "2", "p2"],
      ["Chan"],
      ["Ara", "3", "p3"],
    ]);
    expect(t.rows()[2]!.spans).toEqual(["3"]);
    // The Status column deleted: its cells go (the detail row is no cell — it stays).
    const header = [...t.h.workspace.root.domInputs.values()].find(
      (record) => record.ruleId === "TableHeader",
    )!;
    const status = header.children
      .map((child) => t.h.workspace.root.domInputs.get(child)!)
      .find((record) => record.props.key === "status")!;
    t.h.workspace.execute(
      removeTargets({
        targets: [t.h.workspace.positionOfRecord(status.id)!.target],
      }),
    );
    t.h.flush();
    await settle();
    expect(t.rows().map((row) => row.cells)).toEqual([
      ["Bora", "p1"],
      ["Chan", "p2"],
      ["Chan"],
      ["Ara", "p3"],
    ]);
    expect(t.rows()[2]!.spans).toEqual(["2"]);
    // Off: no detail, no expandable rows.
    await t.detailSwitch(false);
    expect(catalogTableDetailOn(t.h.workspace.runtime.graph, t.id)).toBe(false);
    expect(t.rows().map((row) => [row.key, row.expanded])).toEqual([
      ["p1", null],
      ["p2", null],
      ["p3", null],
    ]);
    expect(
      t.errors.mock.calls.filter((call) =>
        /Cell count|column count|Cannot read/i.test(String(call[0])),
      ),
    ).toEqual([]);
    t.h.view.unmount();
  }, 120_000);

  it("a virtual Table: the window is cut over the open rows' details too", async () => {
    const t = await openTable(250);
    vi.spyOn(t.h.session, "showRows").mockImplementation(() => {});
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "virtual" }));
    t.h.flush();
    await settle();
    await t.detailSwitch(true);
    await t.set({ expandedKeys: ["p1", "p3"] });
    const body = [...t.h.session.root!.domInputs.values()].find(
      (record) => record.bindingId === "tablebody",
    )!;
    const window = body.rowWindow!;
    // 250 rows + 2 details shown; p1 · its detail · p2 · p3 · its detail …
    expect(window.keys.length).toBe(252);
    expect(window.keys.slice(0, 5)).toEqual([
      "p1",
      "p1/detail",
      "p2",
      "p3",
      "p3/detail",
    ]);
    expect(window.depths?.slice(0, 5)).toEqual([0, 1, 0, 0, 1]);
    expect(window.closed?.has("p2")).toBe(true);
    const records = [...t.h.session.root!.domInputs.values()].filter(
      (record) =>
        record.bindingId === "row" &&
        t.h.session.root!.domInputs.get(record.parentId)?.bindingId ===
          "tablebody",
    );
    expect(records.length).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    t.h.view.unmount();
  }, 120_000);
});
