import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogTableColumnKey } from "../../../../../../packages/shared/src/catalog/runtime/tableSort";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 2 (G2) — a Table sorted by several columns in the Preview: a header press with
 * Shift adds that Column to the sort (the session keeps the list and turns the direction — RAC
 * knows the first sort only), the rows are in the hand-written order, RAC's header shows the first
 * sort and the Columns of a sort of several draw their order.
 *
 * Fixture (Type · Status are the Table's Columns; Status is a number, one row has none):
 *   p1 Bora  B 2 · p2 Chan  A 1 · p3 Ara  B 3 · p4 Dana  A 5 · p5 Eun  A —
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

/** A bound Table (Users) with its three data Columns sortable; `props` = the Table's own. */
async function openTable(
  props: Readonly<Record<string, unknown>> = {},
  columnProps: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
) {
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
  if (Object.keys(props).length)
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set" as const, value: value as never },
          ]),
        ),
      }),
    );
  h.flush();
  await settle();
  const root = () => h.session.root!;
  const table = () =>
    [...root().domInputs.values()].find((record) => record.ruleId === "Table")!;
  const rowKeys = () =>
    [...root().domInputs.values()]
      .filter(
        (record) =>
          record.bindingId === "row" &&
          root().domInputs.get(record.parentId)?.bindingId === "tablebody",
      )
      .sort((a, b) => a.rowIndex! - b.rowIndex!)
      .map((record) => record.props.id);
  const column = (key: string) => {
    const header = table()
      .children.map((child) => root().domInputs.get(child))
      .find((record) => record?.ruleId === "TableHeader")!;
    return header.children
      .map((child) => root().domInputs.get(child)!)
      .find(
        (record) => record.ruleId === "Column" && record.props.key === key,
      )!;
  };
  for (const key of ["name", "type", "status"])
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(column(key).id)!.target],
        props: {
          allowsSorting: { kind: "set", value: true },
          ...Object.fromEntries(
            Object.entries(columnProps[key] ?? {}).map(([name, value]) => [
              name,
              { kind: "set" as const, value: value as never },
            ]),
          ),
        },
      }),
    );
  h.flush();
  await settle();
  const press = async (key: string, add = false) => {
    act(() => {
      h.session.tables.pressTableSort(
        table().id,
        catalogTableColumnKey(column(key)),
        add,
      );
    });
    await settle();
  };
  const state = () => h.session.tables.tableState(table().id).sort;
  /** The headers RAC marks sorted, and the order marks drawn (`<column name>:<order>`). */
  const header = () => {
    const cells = [
      ...h.view.container.querySelectorAll('[role="columnheader"]'),
    ];
    return {
      ariaSort: cells
        .filter(
          (cell) =>
            cell.getAttribute("aria-sort") &&
            cell.getAttribute("aria-sort") !== "none",
        )
        .map(
          (cell) =>
            `${cell.textContent!.replace(/^\d+/, "").trim()}:${cell.getAttribute("aria-sort")}`,
        ),
      orders: cells.flatMap((cell) => {
        const mark = cell.querySelector(".sort-order");
        const arrow = cell.querySelector(".sort-indicator");
        return mark
          ? [
              `${cell.textContent!.replace(/^\d+/, "").trim()}:${mark.textContent}:${arrow?.getAttribute("data-sort-direction")}`,
            ]
          : [];
      }),
    };
  };
  return { h, table, rowKeys, column, press, state, header };
}

describe("a Table sorted by several columns (ADR-315 Phase 2)", () => {
  it("adds a Column with Shift, turns it in place, and orders the rows by every entry", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = await openTable({ allowsMultiSort: true });
    expect(t.rowKeys()).toEqual(["p1", "p2", "p3", "p4", "p5"]);

    await t.press("type");
    expect(t.state()).toEqual([{ column: "type", direction: "ascending" }]);
    // A: p2 · p4 · p5 (their own order) — B: p1 · p3
    expect(t.rowKeys()).toEqual(["p2", "p4", "p5", "p1", "p3"]);
    // (One sort: RAC's header alone — no order mark.)
    expect(t.header()).toEqual({ ariaSort: ["Type:ascending"], orders: [] });

    await t.press("status", true);
    expect(t.state()).toEqual([
      { column: "type", direction: "ascending" },
      { column: "status", direction: "ascending" },
    ]);
    // A: 1 (p2) · 5 (p4) · none (p5 — an empty value is last) — B: 2 (p1) · 3 (p3)
    expect(t.rowKeys()).toEqual(["p2", "p4", "p5", "p1", "p3"]);

    // (The second Column pressed again with Shift turns in place — RAC gives `ascending` for a
    //  Column that is not its first sort every time; the state turns it.)
    await t.press("status", true);
    expect(t.state()).toEqual([
      { column: "type", direction: "ascending" },
      { column: "status", direction: "descending" },
    ]);
    // A: 5 (p4) · 1 (p2) · none (p5 — still last) — B: 3 (p3) · 2 (p1)
    expect(t.rowKeys()).toEqual(["p4", "p2", "p5", "p3", "p1"]);
    // RAC's `aria-sort` is the first sort's header only (APG — one header at a time); each sorted
    // Column draws its place in the list and its own direction.
    expect(t.header()).toEqual({
      ariaSort: ["Type:ascending"],
      orders: ["Type:1:ascending", "Status:2:descending"],
    });

    // (The first Column turned with Shift: the list keeps its order.)
    await t.press("type", true);
    expect(t.state()).toEqual([
      { column: "type", direction: "descending" },
      { column: "status", direction: "descending" },
    ]);
    // B: 3 (p3) · 2 (p1) — A: 5 (p4) · 1 (p2) · none (p5)
    expect(t.rowKeys()).toEqual(["p3", "p1", "p4", "p2", "p5"]);

    // A press without Shift is the only sort (the list goes).
    await t.press("name");
    expect(t.state()).toEqual([{ column: "name", direction: "ascending" }]);
    // Ara · Bora · Chan · Dana · Eun
    expect(t.rowKeys()).toEqual(["p3", "p1", "p2", "p4", "p5"]);
    expect(t.header()).toEqual({ ariaSort: ["Name:ascending"], orders: [] });
    t.h.view.unmount();
  }, 120_000);

  it("keeps one sort on a Table that does not allow several — Shift or not", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = await openTable();
    await t.press("type");
    await t.press("status", true);
    expect(t.state()).toEqual([{ column: "status", direction: "ascending" }]);
    // 1 (p2) · 2 (p1) · 3 (p3) · 5 (p4) · none (p5)
    expect(t.rowKeys()).toEqual(["p2", "p1", "p3", "p4", "p5"]);
    expect(t.header().orders).toEqual([]);
    t.h.view.unmount();
  }, 120_000);

  it("stops at the Table's most sort columns", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = await openTable({ allowsMultiSort: true, maxSortColumns: 2 });
    await t.press("type");
    await t.press("status", true);
    await t.press("name", true);
    expect(t.state()).toEqual([
      { column: "type", direction: "ascending" },
      { column: "status", direction: "ascending" },
    ]);
    // (RAC's header was told the state's first sort again — not the Column it was pressed on.)
    expect(t.header().ariaSort).toEqual(["Type:ascending"]);
    t.h.view.unmount();
  }, 120_000);

  it("a Column's cycle: its first direction, the other, then unsorted when the Table allows it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = await openTable(
      { allowsUnsorted: true },
      {
        status: { sortFirstDirection: "descending", sortEmptyValues: "first" },
      },
    );
    await t.press("status");
    expect(t.state()).toEqual([{ column: "status", direction: "descending" }]);
    // none (p5 — this Column puts its empty values first) · 5 (p4) · 3 (p3) · 2 (p1) · 1 (p2)
    expect(t.rowKeys()).toEqual(["p5", "p4", "p3", "p1", "p2"]);
    await t.press("status");
    expect(t.state()).toEqual([{ column: "status", direction: "ascending" }]);
    expect(t.rowKeys()).toEqual(["p5", "p2", "p1", "p3", "p4"]);
    await t.press("status");
    expect(t.state()).toBeUndefined();
    expect(t.rowKeys()).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(t.header()).toEqual({ ariaSort: [], orders: [] });
    t.h.view.unmount();
  }, 120_000);

  it("reads Shift at the header's press (the DOM — RAC's `onSortChange` names the Column only)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = await openTable({ allowsMultiSort: true });
    const headerOf = (name: string) =>
      [...t.h.view.container.querySelectorAll('[role="columnheader"]')].find(
        (cell) => cell.textContent!.includes(name),
      ) as HTMLElement;
    const click = async (name: string, shiftKey: boolean) => {
      const target = headerOf(name);
      await act(async () => {
        fireEvent.pointerDown(target, {
          pointerType: "mouse",
          button: 0,
          shiftKey,
        });
        fireEvent.mouseDown(target, { button: 0, shiftKey });
        fireEvent.pointerUp(target, {
          pointerType: "mouse",
          button: 0,
          shiftKey,
        });
        fireEvent.mouseUp(target, { button: 0, shiftKey });
        fireEvent.click(target, { button: 0, shiftKey });
      });
      await settle();
    };
    await click("Type", false);
    expect(t.state()).toEqual([{ column: "type", direction: "ascending" }]);
    await click("Status", true);
    expect(t.state()).toEqual([
      { column: "type", direction: "ascending" },
      { column: "status", direction: "ascending" },
    ]);
    await click("Name", false);
    expect(t.state()).toEqual([{ column: "name", direction: "ascending" }]);
    t.h.view.unmount();
  }, 120_000);
});
