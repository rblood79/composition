import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { CATALOG_VIRTUAL_ROW_WINDOW } from "../../../../../../packages/shared/src/catalog/runtime/catalogPreviewSession";
import { catalogTableGroupKey } from "../../../../../../packages/shared/src/catalog/runtime/tableRowSlices";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 5 증분 5b-2 — a virtual Table's group rows on its row window (breakdown §5.4 「행
 * 창과 펼침」): the window is cut from the rows the open groups show, in their order (a group, then
 * its rows), so an open group of thousands of rows makes records for the window's 60 only. The
 * records are flat (each row its own record, its depth in the window's key list); the DOM nests
 * them — a row inside its group's RAC Row — and a row outside the window is an empty Row in its
 * place, a closed group's one empty child row with it (RAC counts a row with a child row as one it
 * can open).
 *
 * Fixture: 250 rows `p1 … p250`, type `T0 … T4` by turns (p1 T0 · p2 T1 · … · p6 T0) — 50 a team.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const T = (team: string) => catalogTableGroupKey([team]);

async function openGroupedTable(types = 5, tree = false) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
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
            ...(tree
              ? [{ id: "f-parent", key: "parent", type: "string" }]
              : []),
          ],
          // (5d: p1 … p5 the top rows, each later row under p1 … p5 by turns — 49 each.)
          mockData: Array.from({ length: 250 }, (_, index) => ({
            id: `p${index + 1}`,
            name: `Person${index + 1}`,
            type: `T${index % types}`,
            ...(tree
              ? { parent: index < 5 ? null : `p${(index % 5) + 1}` }
              : {}),
          })),
          useMockData: true,
        },
      ],
      variables: [],
      apiEndpoints: [],
    });
  });
  // (jsdom lays nothing out: the rows in view are given by hand — `adr310VirtualTable.test.tsx`.)
  const showRows = h.session.showRows.bind(h.session);
  vi.spyOn(h.session, "showRows").mockImplementation(() => {});
  const id = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
        ...(tree ? { fieldMap: { parentId: "f-parent" } } : {}),
      })!,
    ),
  );
  h.workspace.execute(setRowDisplay(id, { mode: "virtual" }));
  h.flush();
  await settle();
  const root = () => h.session.root!;
  const table = () =>
    [...root().domInputs.values()].find((record) => record.ruleId === "Table")!;
  const body = () =>
    [...root().domInputs.values()].find(
      (record) => record.bindingId === "tablebody",
    )!;
  /** The body's row records by their place in the window's key list. */
  const rows = () =>
    new Map(
      [...root().domInputs.values()]
        .filter(
          (record) =>
            record.bindingId === "row" &&
            root().domInputs.get(record.parentId)?.bindingId === "tablebody",
        )
        .map((record) => [record.rowIndex!, record] as const),
    );
  /** A record's nested Row records (a group's rows read into it). */
  const nested = (recordId: string) =>
    root()
      .domInputs.get(recordId)!
      .children.filter(
        (child) => root().domInputs.get(child)?.bindingId === "row",
      );
  const set = async (patch: Record<string, unknown>) => {
    act(() => h.session.setTableState(table().id, patch));
    await settle();
  };
  /** RAC's collection as the DOM holds it: each row's key and its depth (`aria-level`). */
  const domRows = () =>
    [...h.view.container.querySelectorAll('[role="row"][data-key]')].map(
      (row) => [
        row.getAttribute("data-key"),
        Number(row.getAttribute("aria-level") ?? 0),
      ],
    );
  return { h, showRows, table, body, rows, nested, set, domRows, errors };
}

describe("a virtual Table's group rows on its row window (ADR-315 Phase 5)", () => {
  it("the window is cut from the open groups' rows in order; the records are flat, each row its depth", async () => {
    const t = await openGroupedTable();
    await t.set({ grouping: ["type"], expandedKeys: [T("T0"), T("T1")] });

    // T0 · its 50 rows · T1 · its 50 rows · T2 · T3 · T4 — 105 rows shown, a window of 60.
    const window = t.body().rowWindow!;
    expect(window.keys.length).toBe(105);
    expect(window.keys.slice(0, 3)).toEqual([T("T0"), "p1", "p6"]);
    expect(window.keys.slice(50, 53)).toEqual(["p246", T("T1"), "p2"]);
    expect(window.keys.slice(-3)).toEqual([T("T2"), T("T3"), T("T4")]);
    expect(window.depths?.slice(0, 3)).toEqual([0, 1, 1]);
    expect(window.depths?.slice(-3)).toEqual([0, 0, 0]);
    expect([...(window.closed ?? [])]).toEqual([T("T2"), T("T3"), T("T4")]);

    const records = t.rows();
    expect(records.size).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    expect(records.get(0)!.props.id).toBe(T("T0"));
    expect(records.get(51)!.props.id).toBe(T("T1"));
    // (Flat: a group's rows are not read into its record — the window's rows are the records.)
    expect(t.nested(records.get(0)!.id)).toEqual([]);
    expect(t.nested(records.get(51)!.id)).toEqual([]);
    // (The open groups go to RAC by key.)
    expect(JSON.parse(String(t.table().props._expandedKeys))).toEqual([
      T("T0"),
      T("T1"),
    ]);
    expect(t.errors).not.toHaveBeenCalled();
  });

  it("a window move keeps the rows that stay; closing a group so every row fits reads the groups nested again", async () => {
    const t = await openGroupedTable();
    await t.set({ grouping: ["type"], expandedKeys: [T("T0"), T("T1")] });
    const owner = t.body().rowWindow!.owner;
    const held = t.rows();
    act(() => t.showRows(owner, 60, 80, 105));
    await settle();
    const start = t.body().rowWindow!.start;
    expect(start).toBeGreaterThan(0);
    const moved = t.rows();
    expect([...moved.keys()].sort((a, b) => a - b)[0]).toBe(start);
    for (let index = start; index < CATALOG_VIRTUAL_ROW_WINDOW; index += 1)
      expect(moved.get(index)).toBe(held.get(index));
    expect(moved.get(51)!.props.id).toBe(T("T1"));

    // T0 closes: T0 · T1 · its 50 rows · T2 · T3 · T4 — 55 rows, inside the window: no window.
    await t.set({ expandedKeys: [T("T1")] });
    expect(t.body().rowWindow).toBeUndefined();
    const all = t.rows();
    expect(all.size).toBe(5);
    const t1 = [...all.values()].find((record) => record.props.id === T("T1"))!;
    expect(t.nested(t1.id)).toHaveLength(50);
    expect(t.errors).not.toHaveBeenCalled();
  });

  it("the DOM nests the window's rows in their groups, an empty Row for each row outside it", async () => {
    const t = await openGroupedTable();
    await t.set({ grouping: ["type"], expandedKeys: [T("T0"), T("T1")] });
    // (RAC's treegrid: every row the open groups show is a row of the collection by key, at its
    //  depth — the records' and the empty ones alike.)
    const treegrid = t.h.view.container.querySelector('[role="treegrid"]');
    expect(treegrid).not.toBeNull();
    const drawn = t.domRows();
    expect(drawn.slice(0, 3)).toEqual([
      [T("T0"), 1],
      ["p1", 2],
      ["p6", 2],
    ]);
    expect(drawn.slice(50, 53)).toEqual([
      ["p246", 2],
      [T("T1"), 1],
      ["p2", 2],
    ]);
    expect(drawn.slice(-3)).toEqual([
      [T("T2"), 1],
      [T("T3"), 1],
      [T("T4"), 1],
    ]);
    expect(drawn).toHaveLength(105);
    // (The rows past the window are empty Rows in their places.)
    expect(treegrid!.querySelectorAll("[data-row-pending]")).toHaveLength(45);
    // (A closed group can be opened. Outside the window it is an empty Row — RAC opens a row
    //  without cells; in it, its child row — the last test.)
    const closedGroup = treegrid!.querySelector(
      `[role="row"][data-key='${T("T2")}']`,
    );
    expect(closedGroup?.getAttribute("aria-expanded")).toBe("false");
    expect(t.errors).not.toHaveBeenCalled();
  });

  it("an open group of more rows than a chunk: its rows chunk inside it, and a window move draws the rows it reaches", async () => {
    const t = await openGroupedTable(2);
    await t.set({ grouping: ["type"], expandedKeys: [T("T0")] });
    // T0 · its 125 rows (p1 · p3 · … · p249) · T1 — 127 rows.
    const treegrid = t.h.view.container.querySelector('[role="treegrid"]')!;
    const drawn = () => t.domRows();
    expect(drawn()).toHaveLength(127);
    expect(drawn().slice(0, 2)).toEqual([
      [T("T0"), 1],
      ["p1", 2],
    ]);
    expect(drawn().slice(-2)).toEqual([
      ["p249", 2],
      [T("T1"), 1],
    ]);
    const filled = () =>
      [
        ...treegrid.querySelectorAll(
          '[role="row"][data-key]:not([data-row-pending])',
        ),
      ].map((row) => row.getAttribute("data-key"));
    expect(filled()).toHaveLength(CATALOG_VIRTUAL_ROW_WINDOW);
    const owner = t.body().rowWindow!.owner;
    act(() => t.showRows(owner, 100, 120, 127));
    await settle();
    const start = t.body().rowWindow!.start;
    expect(start).toBeGreaterThan(0);
    // (The rows the window holds now are drawn from their records — p201 is the 101st row of T0.)
    expect(filled()).toContain("p201");
    expect(filled()).not.toContain("p1");
    expect(filled()).toHaveLength(CATALOG_VIRTUAL_ROW_WINDOW);
    expect(drawn()).toHaveLength(127);
    expect(drawn()[101]).toEqual(["p201", 2]);
    // (T1 is in the window now — a record with its cells; closed, it still opens: its one empty
    //  child row. RAC counts a row as one to open by its last child not being a cell.)
    expect(filled()).toContain(T("T1"));
    expect(
      treegrid
        .querySelector(`[role="row"][data-key='${T("T1")}']`)
        ?.getAttribute("aria-expanded"),
    ).toBe("false");
    expect(t.errors).not.toHaveBeenCalled();
  });
});

describe("a virtual Table's tree rows on its row window (ADR-315 Phase 5 증분 5d)", () => {
  it("the window is cut from the open rows' child rows in order; records flat, a closed row's empty child Row", async () => {
    const t = await openGroupedTable(5, true);
    await t.set({ expandedKeys: ["p1", "p2"] });
    // p1 · its 49 rows · p2 · its 49 · p3 · p4 · p5 — 103 rows shown, a window of 60.
    const window = t.body().rowWindow!;
    expect(window.keys.length).toBe(103);
    expect(window.keys.slice(0, 3)).toEqual(["p1", "p6", "p11"]);
    expect(window.keys.slice(49, 52)).toEqual(["p246", "p2", "p7"]);
    expect(window.keys.slice(-3)).toEqual(["p3", "p4", "p5"]);
    expect(window.depths?.slice(0, 3)).toEqual([0, 1, 1]);
    expect(window.depths?.slice(-3)).toEqual([0, 0, 0]);
    expect([...(window.closed ?? [])]).toEqual(["p3", "p4", "p5"]);
    const records = t.rows();
    expect(records.size).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    expect(records.get(0)!.props.id).toBe("p1");
    expect(t.nested(records.get(0)!.id)).toEqual([]);
    // The DOM nests them: p1 level 1, its rows level 2 — the window's and the empty ones.
    const dom = t.domRows();
    expect(dom.slice(0, 3)).toEqual([
      ["p1", 1],
      ["p6", 2],
      ["p11", 2],
    ]);
    expect(dom.filter(([, level]) => level === 1).map(([key]) => key)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
    ]);
    expect(
      t.errors.mock.calls.filter((call) =>
        /Cell count|column count|Cannot read/i.test(String(call[0])),
      ),
    ).toEqual([]);
    t.h.view.unmount();
  }, 120_000);
});
