import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogTableColumnKey } from "../../../../../../packages/shared/src/catalog/runtime/tableSort";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 1 — a Table record's Preview state lives in one place, the session's Table state
 * (`CatalogPreviewSession.tableState`), and names a Column by its Column key (the field it shows —
 * `resolveTableColumnKey`), not by the key RAC's sort gives it (the record id · an HTML id).
 *
 * Before: the session kept the sort alone (`tableSorts`) under the RAC key — a state remembered or
 * written by a rule under that name pointed at a record id.
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
  ],
  mockData: [
    { id: "p1", name: "Bora" },
    { id: "p2", name: "Chan" },
    { id: "p3", name: "Ara" },
  ],
  useMockData: true,
};

describe("the session's Table state", () => {
  it("holds a header sort under the Column key, and the rows follow it", async () => {
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
      });
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
    const rowKeys = () =>
      [...root().domInputs.values()]
        .filter(
          (record) =>
            record.bindingId === "row" &&
            root().domInputs.get(record.parentId)?.bindingId === "tablebody",
        )
        .sort((a, b) => a.rowIndex! - b.rowIndex!)
        .map((record) => record.props.id);
    const table = () =>
      [...root().domInputs.values()].find(
        (record) => record.ruleId === "Table",
      )!;
    const nameColumn = () => {
      const header = table()
        .children.map((child) => root().domInputs.get(child))
        .find((record) => record?.ruleId === "TableHeader")!;
      return header.children
        .map((child) => root().domInputs.get(child)!)
        .find(
          (record) => record.ruleId === "Column" && record.props.key === "name",
        )!;
    };
    // (No state written: the authored defaults — the data's order.)
    expect(h.session.tables.tableState(table().id)).toEqual({});
    expect(rowKeys()).toEqual(["p1", "p2", "p3"]);

    const racKey = catalogTableColumnKey(nameColumn());
    expect(racKey).not.toBe("name");
    act(() => {
      h.session.tables.sortTable(table().id, {
        column: racKey,
        direction: "ascending",
      });
    });
    await settle();
    expect(h.session.tables.tableState(table().id)).toEqual({
      sort: [{ column: "name", direction: "ascending" }],
    });
    // Ara · Bora · Chan
    expect(rowKeys()).toEqual(["p3", "p1", "p2"]);

    // (A column the Table does not have is not a sort: the state and the rows are the data's.)
    act(() => {
      h.session.tables.sortTable(table().id, {
        column: "no-such-column",
        direction: "descending",
      });
    });
    await settle();
    expect(h.session.tables.tableState(table().id)).toEqual({});
    expect(rowKeys()).toEqual(["p1", "p2", "p3"]);

    act(() => {
      h.session.tables.sortTable(table().id, {
        column: racKey,
        direction: "descending",
      });
    });
    await settle();
    expect(rowKeys()).toEqual(["p2", "p1", "p3"]);
    act(() => {
      h.session.tables.sortTable(table().id, undefined);
    });
    await settle();
    expect(h.session.tables.tableState(table().id)).toEqual({});
    expect(rowKeys()).toEqual(["p1", "p2", "p3"]);

    // HC4 — a column slice is not an input of the rows: writing one never calls the row source;
    // a data slice does (the count is the row source's calls — `boundRows`).
    const rowSource = vi.spyOn(
      h.session as unknown as { boundRows: (...args: unknown[]) => unknown },
      "boundRows",
    );
    // (The Table's Columns: a selection column, then Name · Type · Status. `name` is its row
    //  header column — RAC throws without one, so it does not hide; the selection column is not
    //  a data column, so no slice names it — `column1` is its place's default key.)
    act(() => {
      h.session.tables.setTableState(table().id, {
        columnWidths: { type: 180, column1: 40 },
        hiddenColumns: ["name", "status"],
        pinnedColumns: { start: ["name"], end: ["column1"] },
      });
    });
    await settle();
    expect(h.session.tables.tableState(table().id)).toEqual({
      columnWidths: { type: 180 },
      hiddenColumns: ["status"],
      pinnedColumns: { start: ["name"], end: [] },
    });
    expect(rowSource).toHaveBeenCalledTimes(0);
    expect(rowKeys()).toEqual(["p1", "p2", "p3"]);
    act(() => {
      h.session.tables.setTableState(table().id, {
        sort: [{ column: "name", direction: "descending" }],
      });
    });
    await settle();
    expect(rowSource.mock.calls.length).toBeGreaterThan(0);
    expect(rowKeys()).toEqual(["p2", "p1", "p3"]);
    // (The column slices stay through a data slice's write.)
    expect(h.session.tables.tableState(table().id).hiddenColumns).toEqual(["status"]);
    h.view.unmount();
  }, 90_000);
});
