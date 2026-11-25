import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogTableTotalsCommand,
  catalogTableTotalsOn,
} from "../../../builder/catalogRuntime/tableTotals";
import { insertTableColumns } from "../../../../../../packages/shared/src/catalog/commands";
import { tableHeaderPosition } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 5 증분 5c — a Table's totals row (breakdown §5.4 「바닥 합계 행은 TableFooter 의 Row」):
 * the 「Totals row」 switch fills the Table's footer (its 「Totals」 slot — RAC `TableFooter`) with a
 * Row, a cell per column reading that column's aggregate (Column 「Aggregate」) over every row the
 * Table's state keeps — searched · filtered, before 「더 보기」 · a page cut them. The Canvas draws
 * it too (the same rows — the Builder's row source).
 *
 * Fixture (Name · Type · Status): p1 Bora B 2 · p2 Chan A 1 · p3 Ara B 3 · p4 Dana A 5 · p5 Eun A —.
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

async function openTable() {
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
  const column = (key: string) => {
    const header = [...h.workspace.root.domInputs.values()].find(
      (record) => record.ruleId === "TableHeader",
    )!;
    return header.children
      .map((child) => h.workspace.root.domInputs.get(child)!)
      .find((record) => record.props.key === key)!;
  };
  const cellTexts = (row: Element | null | undefined) =>
    [
      ...(row?.querySelectorAll('[role="rowheader"], [role="gridcell"]') ?? []),
    ].map((cell) => (cell.textContent ?? "").trim());
  /** The DOM's totals row (the footer's) and the body's rows. */
  const dom = () => ({
    totals: cellTexts(
      h.view.container.querySelector('tfoot [role="row"]'),
    ),
    footer: h.view.container.querySelectorAll("tfoot").length,
    body: h.view.container.querySelectorAll('tbody [role="row"]').length,
  });
  const aggregate = (key: string, fn: string) =>
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(column(key).id)!.target],
        props: { aggregate: { kind: "set", value: fn } },
      }),
    );
  const totalsSwitch = async (on: boolean) => {
    h.workspace.execute(
      catalogTableTotalsCommand(
        h.workspace.runtime.graph,
        id,
        on,
        h.workspace.newId,
      ),
    );
    h.flush();
    await settle();
  };
  return {
    h,
    id,
    table,
    column,
    dom,
    aggregate,
    totalsSwitch,
    errors,
  };
}

describe("a Table's totals row (ADR-315 Phase 5 증분 5c)", () => {
  it("the switch adds a footer row: each Column's aggregate over every row the state keeps; off removes it", async () => {
    const t = await openTable();
    t.aggregate("name", "count");
    t.aggregate("status", "sum");
    expect(catalogTableTotalsOn(t.h.workspace.runtime.graph, t.id)).toBe(false);
    await t.totalsSwitch(true);
    expect(catalogTableTotalsOn(t.h.workspace.runtime.graph, t.id)).toBe(true);
    // Name: 5 rows · Type: no aggregate · Status: 2 + 1 + 3 + 5 (Eun's empty status is no number).
    expect(t.dom().totals).toEqual(["5", "", "11"]);
    expect(t.dom().footer).toBe(1);
    expect(t.dom().body).toBe(5);
    // (The Canvas's totals row: `adr315CanvasGroups.test.ts` — this harness's Builder reads no rows.)
    // A search keeps Bora · Ara (「ra」): the totals follow.
    act(() => t.h.session.tables.searchTable(t.table().id, "ra"));
    await settle();
    expect(t.dom().body).toBe(2);
    expect(t.dom().totals).toEqual(["2", "", "5"]);
    // A column added: the totals row gets its cell (the table stays aligned).
    const header = tableHeaderPosition(t.h.workspace.runtime.graph, t.id)!;
    t.h.workspace.execute(
      insertTableColumns({
        header,
        columns: [{ key: "id", label: "Id" }],
        buildColumn: () => {
          const entryId = t.h.workspace.newId("node");
          return {
            entries: [
              {
                kind: "node",
                id: entryId,
                definitionId: catalogPaletteDefinitionId(
                  t.h.workspace.runtime.graph.library,
                  "Column",
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
        },
        buildCell: () => {
          const entryId = t.h.workspace.newId("node");
          return {
            entries: [
              {
                kind: "node",
                id: entryId,
                definitionId: catalogPaletteDefinitionId(
                  t.h.workspace.runtime.graph.library,
                  "Cell",
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
        },
        newId: t.h.workspace.newId,
      }),
    );
    t.h.flush();
    await settle();
    expect(t.dom().totals).toEqual(["2", "", "5", ""]);
    // (Its totals cell reads the new column — its aggregate shows once it has one.)
    t.aggregate("id", "count");
    t.h.flush();
    await settle();
    expect(t.dom().totals).toEqual(["2", "", "5", "2"]);
    // (A reader hides Type — the Table state's column slice: the totals row's cells follow the
    //  columns, as every row's do — `catalogProjectTableColumns`.)
    act(() =>
      t.h.session.tables.setTableState(t.table().id, { hiddenColumns: ["type"] }),
    );
    await settle();
    expect(t.dom().totals).toEqual(["2", "5", "2"]);
    await t.totalsSwitch(false);
    expect(catalogTableTotalsOn(t.h.workspace.runtime.graph, t.id)).toBe(false);
    expect(t.dom().totals).toEqual([]);
    expect(
      t.errors.mock.calls.filter((call) =>
        /Cell count|column count|Cannot read/i.test(String(call[0])),
      ),
    ).toEqual([]);
  }, 120_000);
});
