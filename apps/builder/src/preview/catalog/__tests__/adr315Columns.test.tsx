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
 * ADR-315 Phase 4 (G4) — a Table's column slices in the Preview: hiding and ordering its Columns
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

describe("a Table's column slices (ADR-315 Phase 4)", () => {
  it("hides and orders Columns — the header and every Row together, no row read again", async () => {
    const t = await openTable();
    expect(t.columnKeys()).toEqual(["name", "type", "status"]);
    expect(t.dom().headers).toEqual(["Name", "Type", "Status"]);
    expect(t.dom().rows[0]).toEqual(["Bora", "B", "2"]);
    const rowSource = vi.spyOn(
      t.h.session as unknown as { boundRows: (...args: unknown[]) => unknown },
      "boundRows",
    );

    await t.set({ hiddenColumns: ["type"] });
    expect(t.columnKeys()).toEqual(["name", "status"]);
    expect(t.dom().headers).toEqual(["Name", "Status"]);
    expect(t.dom().rows).toEqual([
      ["Bora", "2"],
      ["Chan", "1"],
      ["Ara", "3"],
      ["Dana", "5"],
      ["Eun", ""],
    ]);

    await t.set({ columnOrder: ["status", "name", "type"] });
    expect(t.columnKeys()).toEqual(["status", "name"]);
    expect(t.dom().headers).toEqual(["Status", "Name"]);
    expect(t.dom().rows[3]).toEqual(["5", "Dana"]);

    // Shown again: at its place in the order.
    await t.set({ hiddenColumns: [] });
    expect(t.columnKeys()).toEqual(["status", "name", "type"]);
    expect(t.dom().rows[3]).toEqual(["5", "Dana", "A"]);
    // (HC4 — the row source was not called for any of them.)
    expect(rowSource).toHaveBeenCalledTimes(0);
    expect(t.h.session.tables.tableColumnsNow(t.table().id)).toEqual({
      columns: ["name", "type", "status"],
      hidden: [],
      pinned: { start: [], end: [] },
    });
    // (No row whose cells are not its columns reached RAC.)
    expect(
      t.errors.mock.calls.filter((call) =>
        /Cell count|column count/i.test(String(call[0])),
      ),
    ).toEqual([]);
    t.h.view.unmount();
  }, 120_000);

  it("a hidden Column is still searched · sorted by, and the state still names it", async () => {
    const t = await openTable();
    await t.set({ hiddenColumns: ["type"] });
    expect(t.dom().headers).toEqual(["Name", "Status"]);
    // 「b」 is in Bora's name — and in Ara's hidden type `B`.
    await t.set({ search: "b" });
    expect(t.dom().rows).toEqual([
      ["Bora", "2"],
      ["Ara", "3"],
    ]);
    // Sorted by the hidden Type, ascending: the `A` rows, then the `B` rows — as authored within.
    await t.set({
      search: "",
      sort: [{ column: "type", direction: "ascending" }],
    });
    expect(t.dom().rows.map((cells) => cells[0])).toEqual([
      "Chan",
      "Dana",
      "Eun",
      "Bora",
      "Ara",
    ]);
    expect(t.h.session.tables.tableState(t.table().id)).toEqual({
      hiddenColumns: ["type"],
      sort: [{ column: "type", direction: "ascending" }],
    });
    // (The sorted Column is not drawn: no header says `aria-sort`.)
    expect(
      t.h.view.container.querySelectorAll(
        '[aria-sort="ascending"], [aria-sort="descending"]',
      ).length,
    ).toBe(0);
    t.h.view.unmount();
  }, 120_000);

  it("the last row header Column stays when every Column would hide", async () => {
    const t = await openTable();
    await t.set({ hiddenColumns: ["name", "type", "status"] });
    // (Name is the row header — the first named Column: it stays.)
    expect(t.columnKeys()).toEqual(["name"]);
    expect(t.dom().rows[0]).toEqual(["Bora"]);
    t.h.view.unmount();
  }, 120_000);

  it("a virtual Table projects its window's rows, and its other rows stay keyed Rows", async () => {
    const t = await openTable();
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "virtual" }));
    t.h.flush();
    await settle();
    await t.set({ hiddenColumns: ["type"], columnOrder: ["status", "name"] });
    expect(t.columnKeys()).toEqual(["status", "name"]);
    expect(
      t.h.view.container
        .querySelector("[role=grid]")
        ?.getAttribute("aria-rowcount"),
    ).toBe("6");
    t.h.view.unmount();
  }, 120_000);

  it("an author's Column edit reaches the columns the state names (no stale column list)", async () => {
    const t = await openTable();
    // The author renames the Type Column's key — a value edit, no structure change.
    t.h.workspace.execute(
      setFields({
        targets: [t.h.workspace.positionOfRecord(t.column("type").id)!.target],
        props: { key: { kind: "set", value: "kind" } },
      }),
    );
    t.h.flush();
    await settle();
    expect(t.h.session.tables.tableColumnsNow(t.table().id).columns).toEqual([
      "name",
      "kind",
      "status",
    ]);
    await t.set({ hiddenColumns: ["kind"] });
    expect(t.dom().headers).toEqual(["Name", "Status"]);
    // (The old name is no Column: the state does not hold it.)
    await t.set({ hiddenColumns: ["type"] });
    expect(t.h.session.tables.tableState(t.table().id)).toEqual({});
    expect(t.dom().headers).toEqual(["Name", "Type", "Status"]);
    t.h.view.unmount();
  }, 120_000);

  it("the Canvas draws a Column 「Hidden by default」 hidden, and a Table state shows it", async () => {
    const t = await openTable();
    t.h.workspace.execute(
      setFields({
        targets: [t.h.workspace.positionOfRecord(t.column("type").id)!.target],
        props: { defaultHidden: { kind: "set", value: true } },
      }),
    );
    t.h.flush();
    await settle();
    // The Builder's Canvas and the Preview: the same two Columns.
    expect(t.columnKeys(t.h.workspace.root as never)).toEqual([
      "name",
      "status",
    ]);
    expect(t.columnKeys()).toEqual(["name", "status"]);
    expect(t.dom().headers).toEqual(["Name", "Status"]);
    expect(t.h.session.tables.tableColumnsNow(t.table().id).hidden).toEqual(["type"]);
    // (The Preview's user shows it: the state's list replaces the authored default.)
    await t.set({ hiddenColumns: [] });
    expect(t.dom().headers).toEqual(["Name", "Type", "Status"]);
    t.h.view.unmount();
  }, 120_000);
  // Live (2026-11-20, a Table placed and not bound): the switch turned on and the Canvas kept the
  // Column — its edit resolved the Column's record alone (a bound Table's edits already took the
  // structure path, so the bound test above did not see it).
  it("a Table that is not bound hides its Column 「Hidden by default」 on the Canvas and in the Preview", async () => {
    const t = await openTable(false);
    expect(t.dom().headers).toEqual(["Name", "Type", "Status"]);
    const type = [...t.h.workspace.root.domInputs.values()].filter(
      (record) => record.ruleId === "Column",
    )[2]!;
    t.h.workspace.execute(
      setFields({
        targets: [t.h.workspace.positionOfRecord(type.id)!.target],
        props: { defaultHidden: { kind: "set", value: true } },
      }),
    );
    t.h.flush();
    await settle();
    // (Two data Columns drawn — on both.)
    expect(t.columnKeys(t.h.workspace.root as never)).toEqual([
      "name",
      "status",
    ]);
    expect(t.columnKeys()).toEqual(["name", "status"]);
    // The Builder keeps the hidden Column as a record — the author selects it in Layers and turns
    // the switch off (live, 2026-11-20: left out, its Layers row selected nothing). It is not
    // drawn and has no track; its Cell follows. The Preview's root does not hold it (RAC's
    // collection is the columns shown).
    const builder = t.h.workspace.root;
    const kept = [...builder.domInputs.values()].filter(
      (record) => record.props._columnHidden === true,
    );
    expect(kept.map((record) => record.ruleId).sort()).toEqual([
      "Cell",
      "Column",
    ]);
    expect(kept.every((record) => record.hidden === true)).toBe(true);
    const row = [...builder.domInputs.values()].find(
      (record) => record.ruleId === "Row",
    )!;
    // (Two tracks — `minmax(75px, 1fr)` each.)
    expect(
      String(row.derivedProps?._tableTracks).match(/minmax\(/g),
    ).toHaveLength(2);
    expect(
      [...t.h.session.root!.domInputs.values()].filter(
        (record) => record.props._columnHidden === true,
      ),
    ).toEqual([]);
    expect(t.dom().headers).toEqual(["Name", "Status"]);
    expect(t.dom().rows[0]).toHaveLength(2);
    // The author edits the hidden Column itself (selected in Layers) — its width: it stays hidden
    // (resolved on its own its mark would be gone, and the Canvas would draw a header cell).
    t.h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: type.sourceId as NodeId }],
        props: { minWidth: { kind: "set", value: 120 } },
      }),
    );
    t.h.flush();
    await settle();
    expect(t.columnKeys(t.h.workspace.root as never)).toEqual([
      "name",
      "status",
    ]);
    expect(
      [...t.h.workspace.root.domInputs.values()]
        .filter((record) => record.props._columnHidden === true)
        .map((record) => record.ruleId)
        .sort(),
    ).toEqual(["Cell", "Column"]);
    // Turned off again: the Column is back.
    t.h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: type.sourceId as NodeId }],
        props: { defaultHidden: { kind: "set", value: false } },
      }),
    );
    t.h.flush();
    await settle();
    expect(t.dom().headers).toEqual(["Name", "Type", "Status"]);
    t.h.view.unmount();
  }, 120_000);
  it("the Table's own value edit keeps the columns the state names (a pruned resolution)", async () => {
    for (const bound of [true, false]) {
      const t = await openTable(bound);
      await t.set({ hiddenColumns: ["type"] });
      expect(t.dom().headers).toEqual(["Name", "Status"]);
      // The author edits the Table itself — its density: no Column, no structure.
      t.h.workspace.execute(
        setFields({
          targets: [{ kind: "node", id: t.id }],
          props: { density: { kind: "set", value: "compact" } },
        }),
      );
      t.h.flush();
      await settle();
      expect(t.h.session.tables.tableColumnsNow(t.table().id)).toEqual({
        columns: ["name", "type", "status"],
        hidden: ["type"],
        pinned: { start: [], end: [] },
      });
      expect(t.dom().headers).toEqual(["Name", "Status"]);
      // (The hidden Column is still one the state names: shown again.)
      await t.set({ hiddenColumns: [] });
      expect(t.dom().headers).toEqual(["Name", "Type", "Status"]);
      t.h.view.unmount();
    }
  }, 120_000);
  it("pins Columns: the pinned ones first · last, marked for the sheet — by the state or by default", async () => {
    const t = await openTable();
    // (ADR-315 Phase 7 — the Table says it pins columns: the sheet's pinned-column rules are
    //  scoped to it, so a Table without one pays none of their `:has()` style work.)
    const pinsColumns = () =>
      t.h.view.container
        .querySelector("[data-node-table]")!
        .hasAttribute("data-pinned-columns");
    expect(pinsColumns()).toBe(false);
    const marks = () =>
      [...t.h.view.container.querySelectorAll('[role="columnheader"]')].map(
        (cell) => [
          (cell.textContent ?? "").trim(),
          cell.getAttribute("data-pinned"),
          cell.getAttribute("data-pinned-at"),
        ],
      );
    await t.set({ pinnedColumns: { start: ["status"], end: ["name"] } });
    expect(marks()).toEqual([
      ["Status", "start", "1"],
      ["Type", null, null],
      ["Name", "end", "0"],
    ]);
    expect(pinsColumns()).toBe(true);
    // (Each Row's cells stand with their columns, marked the same.)
    const first = [...t.h.view.container.querySelectorAll('[role="row"]')]
      .map((row) => [
        ...row.querySelectorAll('[role="rowheader"], [role="gridcell"]'),
      ])
      .find((cells) => cells.length)!;
    expect(
      first.map((cell) => [
        (cell.textContent ?? "").trim(),
        cell.getAttribute("data-pinned"),
      ]),
    ).toEqual([
      ["2", "start"],
      ["B", null],
      ["Bora", "end"],
    ]);
    // (The inset each reads: the widths of the pinned columns before it — a pinned Column measures
    //  its Table's, `CatalogTablePinMeasure`: jsdom lays nothing out, every width 0.)
    expect(
      (first[0] as HTMLElement).style.getPropertyValue("--table-pin-at"),
    ).toBe("var(--table-pin-start-1, 0px)");
    const grid =
      t.h.view.container.querySelector<HTMLElement>("[data-node-table]")!;
    expect(grid.style.getPropertyValue("--table-pin-start-1")).toBe("0px");
    expect(grid.style.getPropertyValue("--table-pin-end-0")).toBe("0px");
    // (The edge of each side draws the line between the pinned columns and the rest — the
    //  Column · Cell rule's `pinned-edge` block: Status at its end, Name at its start.)
    //  (A header cell's other sides are its Table's part value, 0.)
    const lines = (cells: Element[]) =>
      cells.map((cell) => [
        (cell as HTMLElement).style.borderRightWidth === "1px",
        (cell as HTMLElement).style.borderLeftWidth === "1px",
      ]);
    const edges = [
      [true, false],
      [false, false],
      [false, true],
    ];
    expect(lines(first)).toEqual(edges);
    // (A cell's other sides draw nothing — CSS would draw them at `medium` under the line's style.)
    expect(
      ["borderTopWidth", "borderLeftWidth", "borderBottomWidth"].map(
        (side) => (first[0] as HTMLElement).style[side as "borderTopWidth"],
      ),
    ).toEqual(["0px", "0px", "0px"]);
    expect(
      lines([...t.h.view.container.querySelectorAll('[role="columnheader"]')]),
    ).toEqual(edges);
    await t.set({ pinnedColumns: { start: [], end: [] } });
    expect(marks().map((item) => item[1])).toEqual([null, null, null]);

    // The author's default: Type pinned at the start — on the Canvas's records too.
    t.h.workspace.execute(
      setFields({
        targets: [t.h.workspace.positionOfRecord(t.column("type").id)!.target],
        props: { defaultPinned: { kind: "set", value: "start" } },
      }),
    );
    t.h.flush();
    await settle();
    expect(t.columnKeys(t.h.workspace.root as never)).toEqual([
      "type",
      "name",
      "status",
    ]);
    expect(marks().map((item) => [item[0], item[1]])).toEqual([
      ["Type", "start"],
      ["Name", null],
      ["Status", null],
    ]);
    // (The Canvas draws the same line: the record's derived `pinnedEdge` turns the rule's block on.)
    expect(
      t.h.workspace.root.domInputs.get(t.column("type").id)?.derivedProps
        ?.pinnedEdge,
    ).toBe("start");
    // (…and lays it out: the line's 1px is in the box the engine places the content in, as the
    //  DOM's border — 2026-11-25, the engine input had `borderRight: 0px`.)
    const pinnedInput = (id: string) =>
      JSON.parse(t.h.workspace.root.getAppliedLayoutInput(id) ?? "{}") as {
        borderRight?: string;
      };
    expect(pinnedInput(t.column("type").id).borderRight).toBe("1px");
    expect(pinnedInput(t.column("name").id).borderRight).toBe("0px");
    expect(t.h.session.tables.tableColumnsNow(t.table().id).pinned).toEqual({
      start: ["type"],
      end: [],
    });
    // (The author's default is no slice: pinning the same columns keeps the state empty — what the
    //  browser remembers is only what the reader changed.)
    await t.set({ pinnedColumns: { start: ["type"], end: [] } });
    expect(t.h.session.tables.tableState(t.table().id).pinnedColumns).toBeUndefined();
    t.h.view.unmount();
  }, 120_000);
});

describe("a Column's menu (ADR-315 Phase 4 — S2 `ColumnWithMenu`)", () => {
  it("its items are what the author allowed, as the state is now; each item writes its slice", async () => {
    const t = await openTable();
    const write = (id: string, props: Record<string, unknown>) => {
      t.h.workspace.execute(
        setFields({
          targets: [t.h.workspace.positionOfRecord(id)!.target],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value: value as never },
            ]),
          ),
        }),
      );
    };
    write(t.table().id, { allowsColumnReordering: true });
    write(t.column("type").id, {
      allowsSorting: true,
      allowsHiding: true,
      allowsPinning: true,
    });
    write(t.column("name").id, { allowsHiding: true });
    t.h.flush();
    await settle();
    const header = (name: string) =>
      [
        ...t.h.view.container.querySelectorAll<HTMLElement>(
          '[role="columnheader"]',
        ),
      ].find((cell) => (cell.textContent ?? "").trim() === name)!;
    let open: HTMLElement | null = null;
    const menuOf = (name: string) => {
      const button = header(name).querySelector("button")!;
      act(() => {
        fireEvent.click(button);
      });
      open = document.getElementById(button.getAttribute("aria-controls")!);
      return [...open!.querySelectorAll<HTMLElement>('[role="menuitem"]')].map(
        (item) => ({
          label: (item.textContent ?? "").trim(),
          disabled: item.getAttribute("aria-disabled") === "true",
          item,
        }),
      );
    };
    const close = () =>
      act(() => {
        fireEvent.keyDown(open!, { key: "Escape" });
      });
    const press = async (name: string, label: string) => {
      const item = menuOf(name).find((entry) => entry.label === label)!;
      expect(item.disabled).toBe(false);
      act(() => {
        fireEvent.click(item.item);
      });
      await settle();
    };
    const labels = (name: string) => {
      const items = menuOf(name).map(({ label, disabled }) =>
        disabled ? `${label} (off)` : label,
      );
      close();
      return items;
    };
    expect(labels("Type")).toEqual([
      "Sort Ascending",
      "Sort Descending",
      "Hide column",
      "Pin to start",
      "Pin to end",
      "Move left",
      "Move right",
    ]);
    // (Name: the Table's row header — its hide would leave none; the first column moves right only)
    expect(labels("Name")).toEqual([
      "Hide column (off)",
      "Move left (off)",
      "Move right",
    ]);
    // (Status: the Table's reorder alone)
    expect(labels("Status")).toEqual(["Move left", "Move right (off)"]);

    await press("Type", "Move right");
    expect(t.columnKeys()).toEqual(["name", "status", "type"]);
    expect(t.dom().headers).toEqual(["Name", "Status", "Type"]);
    expect(t.dom().rows[0]).toEqual(["Bora", "2", "B"]);
    expect(labels("Type")).toContain("Move right (off)");

    await press("Type", "Pin to start");
    expect(t.columnKeys()).toEqual(["type", "name", "status"]);
    expect(t.h.session.tables.tableState(t.table().id).pinnedColumns).toEqual({
      start: ["type"],
      end: [],
    });
    expect(labels("Type")).toEqual([
      "Sort Ascending",
      "Sort Descending",
      "Hide column",
      "Pin to end",
      "Unpin",
      // (alone on its side)
      "Move left (off)",
      "Move right (off)",
    ]);
    await press("Type", "Unpin");
    // (back among the unpinned columns at the place its move left it)
    expect(t.columnKeys()).toEqual(["name", "status", "type"]);

    await press("Type", "Sort Descending");
    expect(t.h.session.tables.tableState(t.table().id).sort).toEqual([
      { column: "type", direction: "descending" },
    ]);
    expect(header("Type").getAttribute("aria-sort")).toBe("descending");

    await press("Type", "Hide column");
    expect(t.columnKeys()).toEqual(["name", "status"]);
    expect(t.h.session.tables.tableState(t.table().id).hiddenColumns).toEqual([
      "type",
    ]);
    expect(t.errors).not.toHaveBeenCalled();
  });
});

describe("a Column's filter (ADR-315 Phase 4 증분 4c — 열 메뉴 「필터」)", () => {
  it("「Filter…」 opens its dialog: a condition of the field kind, candidate values of the other slices' rows, Apply · Clear", async () => {
    const t = await openTable();
    for (const key of ["type", "status"])
      t.h.workspace.execute(
        setFields({
          targets: [t.h.workspace.positionOfRecord(t.column(key).id)!.target],
          props: { allowsFiltering: { kind: "set", value: true } },
        }),
      );
    t.h.flush();
    await settle();
    // (the author's switch gives the Column its S2 menu)
    expect(t.column("type").props.isMenu).toBe(true);
    expect(t.column("name").props.isMenu).not.toBe(true);
    const header = (name: string) =>
      [
        ...t.h.view.container.querySelectorAll<HTMLElement>(
          '[role="columnheader"]',
        ),
      ].find((cell) => (cell.textContent ?? "").trim() === name)!;
    const menuOf = (name: string) => {
      const button = header(name).querySelector("button")!;
      act(() => {
        fireEvent.click(button);
      });
      const open = document.getElementById(
        button.getAttribute("aria-controls")!,
      )!;
      return [...open.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    };
    const labels = (name: string) => {
      const items = menuOf(name);
      const out = items.map((item) => (item.textContent ?? "").trim());
      act(() => {
        fireEvent.keyDown(items[0]!, { key: "Escape" });
      });
      return out;
    };
    const dialog = async (name: string) => {
      const item = menuOf(name).find(
        (entry) => (entry.textContent ?? "").trim() === "Filter…",
      )!;
      act(() => {
        fireEvent.click(item);
      });
      await settle();
      return document.querySelector<HTMLElement>('[role="dialog"]')!;
    };
    const apply = async (box: HTMLElement) => {
      const button = [...box.querySelectorAll("button")].find(
        (entry) => (entry.textContent ?? "").trim() === "Apply",
      )!;
      act(() => {
        fireEvent.click(button);
      });
      await settle();
    };
    const names = () => t.dom().rows.map((row) => row[0]);

    expect(labels("Type")).toEqual(["Filter…"]);
    // (text: 「Contains」 first — a typed value)
    let box = await dialog("Type");
    expect(box.textContent).toContain("Contains");
    const value = box.querySelector<HTMLInputElement>("input")!;
    act(() => {
      fireEvent.change(value, { target: { value: "a" } });
    });
    await apply(box);
    expect(t.h.session.tables.tableState(t.table().id).columnFilters).toEqual([
      { column: "type", condition: { op: "contains", value: "a" } },
    ]);
    // (the comparison's default sensitivity: 「a」 finds the A rows)
    expect(names()).toEqual(["Chan", "Dana", "Eun"]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(labels("Type")).toEqual(["Filter…", "Clear filter"]);

    // (number: 「Equals」 with the candidates of the rows Type's filter keeps — its own aside)
    box = await dialog("Status");
    expect(box.textContent).toContain("Equals");
    const options = () =>
      [...box.querySelectorAll<HTMLElement>('[role="option"]')].map((option) =>
        (option.textContent ?? "").replace(/\s+/g, " ").trim(),
      );
    expect([...options()].sort()).toEqual(["(Empty)1", "11", "51"].sort());
    const five = [...box.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (option) => (option.textContent ?? "").startsWith("5"),
    )!;
    act(() => {
      fireEvent.click(five);
    });
    expect(box.querySelector<HTMLInputElement>("input")!.value).toBe("5");
    await apply(box);
    expect(names()).toEqual(["Dana"]);
    expect(t.h.session.tables.tableState(t.table().id).columnFilters?.[1]).toEqual({
      column: "status",
      condition: { op: "equals", value: 5 },
    });

    // (the dialog opens on the Column's filter now)
    box = await dialog("Type");
    expect(box.querySelector<HTMLInputElement>("input")!.value).toBe("a");
    act(() => {
      fireEvent.keyDown(box, { key: "Escape" });
    });
    await settle();

    // 「Clear filter」 drops Type's filter only
    const clear = menuOf("Type").find(
      (entry) => (entry.textContent ?? "").trim() === "Clear filter",
    )!;
    act(() => {
      fireEvent.click(clear);
    });
    await settle();
    expect(t.h.session.tables.tableState(t.table().id).columnFilters).toEqual([
      { column: "status", condition: { op: "equals", value: 5 } },
    ]);
    expect(names()).toEqual(["Dana"]);
    expect(t.errors).not.toHaveBeenCalled();
  });

  it("a Table not bound to data offers 「Filter…」 off (no field to compare)", async () => {
    const t = await openTable(false);
    // (the selection Column first, then Name · Type · Status — the Builder's records)
    const typeColumn = [...t.h.workspace.root.domInputs.values()].filter(
      (record) => record.ruleId === "Column",
    )[2];
    expect(typeColumn).toBeDefined();
    t.h.workspace.execute(
      setFields({
        targets: [t.h.workspace.positionOfRecord(typeColumn!.id)!.target],
        props: { allowsFiltering: { kind: "set", value: true } },
      }),
    );
    t.h.flush();
    await settle();
    const button = [
      ...t.h.view.container.querySelectorAll<HTMLElement>(
        '[role="columnheader"]',
      ),
    ]
      .find((cell) => (cell.textContent ?? "").trim() === "Type")!
      .querySelector("button")!;
    act(() => {
      fireEvent.click(button);
    });
    const items = [
      ...document
        .getElementById(button.getAttribute("aria-controls")!)!
        .querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ];
    expect(
      items.map(
        (item) =>
          `${(item.textContent ?? "").trim()}${item.getAttribute("aria-disabled") === "true" ? " (off)" : ""}`,
      ),
    ).toEqual(["Filter… (off)"]);
  });
});
