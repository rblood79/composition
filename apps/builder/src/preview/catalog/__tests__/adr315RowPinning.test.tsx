import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogTableDetailCommand } from "../../../builder/catalogRuntime/tableDetail";
import { catalogTablePinnedRowKeys } from "../../../../../../packages/shared/src/catalog/runtime/catalogVirtualizer.components";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 5 증분 5f — a bound Table's pinned rows (breakdown §5.4 「행 고정」 · §4.4): the
 * Table state's `pinnedRows` splits the rows into [top · the rest · bottom] — out of the rest's
 * sort, page and window — and each pinned row stays in view (`data-pinned-row` · sticky). 「Row
 * pinning」 gives each data row a menu at its last cell; a pinned row the search leaves out is not
 * shown unless 「Keep pinned rows」.
 *
 * Fixture (Name · Type · Status): p1 Bora B 1 · p2 Chan A 2 · p3 Ara B 3 · p4 Dana A 4 · p5 Eun B 5.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const NAMES = ["Bora", "Chan", "Ara", "Dana", "Eun"];

async function openTable(rows = 5) {
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
            { id: "f-status", key: "status", type: "number" },
          ],
          mockData: Array.from({ length: rows }, (_, index) => ({
            id: `p${index + 1}`,
            name: NAMES[index] ?? `Person${index + 1}`,
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
  const table = () =>
    [...h.session.root!.domInputs.values()].find(
      (record) => record.ruleId === "Table",
    )!;
  /** The body's rows: each one's key and pinned side. */
  const rows_ = () =>
    [...h.view.container.querySelectorAll('tbody [role="row"]')].map((row) => [
      row.getAttribute("data-key"),
      row.getAttribute("data-pinned-row"),
    ]);
  const keys = () => rows_().map((row) => row[0]);
  const set = async (patch: Record<string, unknown>) => {
    act(() => h.session.setTableState(table().id, patch));
    await settle();
  };
  const declare = async (props: Record<string, unknown>) => {
    h.declare(id, props as never);
    await settle();
  };
  /** A row's menu item pressed (its menu at the row's last cell). */
  const pinFromMenu = async (key: string, item: string) => {
    const button = h.view.container.querySelector(
      `tbody [role="row"][data-key="${key}"] .table-row-pin-button`,
    ) as HTMLElement;
    await act(async () => {
      fireEvent.click(button);
    });
    await settle();
    const menuItem = [...document.querySelectorAll('[role="menuitem"]')].find(
      (element) => element.textContent?.trim() === item,
    ) as HTMLElement;
    await act(async () => {
      fireEvent.click(menuItem);
    });
    await settle();
  };
  return { h, id, table, rows: rows_, keys, set, declare, pinFromMenu, errors };
}

describe("a Table's pinned rows (ADR-315 Phase 5 증분 5f)", () => {
  it("a Table with a detail row: a pinned row is no expandable row (its detail would scroll away under it)", async () => {
    const t = await openTable();
    t.h.workspace.execute(
      catalogTableDetailCommand(
        t.h.workspace.runtime.graph,
        t.id,
        true,
        t.h.workspace.newId,
      ),
    );
    t.h.flush();
    await settle();
    await t.set({ pinnedRows: { top: ["p2"], bottom: [] } });
    const expanded = [
      ...t.h.view.container.querySelectorAll('tbody [role="row"]'),
    ].map((row) => [
      row.getAttribute("data-key"),
      row.getAttribute("aria-expanded"),
    ]);
    expect(expanded[0]).toEqual(["p2", null]);
    expect(expanded.slice(1).every((row) => row[1] === "false")).toBe(true);
    t.h.view.unmount();
  }, 120_000);

  it("the state's pinned rows: first · last, out of the sort · the page; a search leaves an unkept one out", async () => {
    const t = await openTable();
    await t.set({ pinnedRows: { top: ["p3"], bottom: ["p1"] } });
    expect(t.rows()).toEqual([
      ["p3", "top"],
      ["p2", null],
      ["p4", null],
      ["p5", null],
      ["p1", "bottom"],
    ]);
    // (Each pinned row's inset is measured — `--table-row-pin-at`, `Table.css`: jsdom lays out no
    //  box, so 0. The measure is in a drawn cell — the first may be the hidden selection column's.)
    for (const key of ["p3", "p1"])
      expect(
        (
          t.h.view.container.querySelector(
            `tbody [data-key="${key}"]`,
          ) as HTMLElement
        ).style.getPropertyValue("--table-row-pin-at"),
      ).toBe("0px");
        // A sort orders the rest only.
    await t.set({ sort: [{ column: "name", direction: "descending" }] });
    expect(t.keys()).toEqual(["p3", "p5", "p4", "p2", "p1"]);
    // A search 「n」 — Chan · Dana · Eun: the pinned Ara · Bora are left out (not kept — the state
    // holds them).
    await t.set({ sort: [], search: "n" });
    expect(t.keys()).toEqual(["p2", "p4", "p5"]);
    expect(t.h.session.tableState(t.table().id).pinnedRows).toEqual({
      top: ["p3"],
      bottom: ["p1"],
    });
    // 「Keep pinned rows」: they stay whatever the search.
    await t.declare({ allowsRowPinning: true, keepPinnedRows: true });
    expect(t.rows()).toEqual([
      ["p3", "top"],
      ["p2", null],
      ["p4", null],
      ["p5", null],
      ["p1", "bottom"],
    ]);
    await t.set({ search: "" });
    // Pages count the rest: 3 rows a page of 2 — 2 pages, the pinned rows on each.
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "pages", size: 2 }));
    t.h.flush();
    await settle();
    expect(t.keys()).toEqual(["p3", "p2", "p4", "p1"]);
    expect(t.h.session.pageOf(t.id)?.count).toBe(2);
    await act(() => t.h.session.goToPage(t.id, 2));
    await settle();
    expect(t.keys()).toEqual(["p3", "p5", "p1"]);
    expect(
      t.errors.mock.calls.filter((call) =>
        /Cell count|column count|Cannot read/i.test(String(call[0])),
      ),
    ).toEqual([]);
    t.h.view.unmount();
  }, 120_000);

  it("「Row pinning」: each data row's menu at its last cell — pin to top · bottom, unpin", async () => {
    const t = await openTable();
    expect(
      t.h.view.container.querySelectorAll(".table-row-pin-button").length,
    ).toBe(0);
    await t.declare({ allowsRowPinning: true });
    const buttons = [
      ...t.h.view.container.querySelectorAll(".table-row-pin-button"),
    ];
    expect(buttons.length).toBe(5);
    // (In each row's last cell — the Status column's.)
    expect(
      buttons.every(
        (button) =>
          button.closest('[role="gridcell"], [role="rowheader"]') ===
          button.closest('[role="row"]')!.lastElementChild,
      ),
    ).toBe(true);
    expect(buttons[0]!.getAttribute("aria-label")).toBe("Row actions");
    await t.pinFromMenu("p4", "Pin to top");
    expect(t.rows()[0]).toEqual(["p4", "top"]);
    // (A pinned row's menu shows its mark and offers the other side · unpin.)
    const pinned = t.h.view.container.querySelector(
      'tbody [data-key="p4"] .table-row-pin-button',
    )!;
    expect(pinned.getAttribute("data-pinned-side")).toBe("top");
    await t.pinFromMenu("p2", "Pin to bottom");
    expect(t.rows().at(-1)).toEqual(["p2", "bottom"]);
    await t.pinFromMenu("p5", "Pin to top");
    expect(t.keys()).toEqual(["p4", "p5", "p1", "p3", "p2"]);
    // (Each pinned row's cells follow its pin — the menu's side and the inset measure.)
    for (const [key, side] of [
      ["p4", "top"],
      ["p5", "top"],
      ["p2", "bottom"],
    ] as const) {
      const row = t.h.view.container.querySelector(
        `tbody [data-key="${key}"]`,
      ) as HTMLElement;
      expect(
        row
          .querySelector(".table-row-pin-button")!
          .getAttribute("data-pinned-side"),
      ).toBe(side);
      expect(row.style.getPropertyValue("--table-row-pin-at")).toBe("0px");
    }
    await t.pinFromMenu("p4", "Unpin");
    expect(t.rows()).toEqual([
      ["p5", "top"],
      ["p1", null],
      ["p3", null],
      ["p4", null],
      ["p2", "bottom"],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("a rule's 「Pin row to top」 · 「Unpin row」 on the row it runs in (a Row's own When)", async () => {
    const t = await openTable();
    const rowNode = [...t.h.session.root!.domInputs.values()].find(
      (record) => record.ruleId === "Row" && record.rowIndex === 2,
    )!.sourceId as NodeId;
    t.h.rule(rowNode, "onAction", {
      opcode: "capability",
      target: { nodeId: rowNode },
      capabilityId: "pinRowBottom",
    } as never);
    await settle();
    await act(async () => {
      fireEvent.click(
        t.h.view.container.querySelector(
          'tbody [role="row"][data-key="p3"] [role="gridcell"]',
        ) as HTMLElement,
      );
    });
    await settle();
    expect(t.rows().at(-1)).toEqual(["p3", "bottom"]);
    expect(t.h.session.tableState(t.table().id).pinnedRows).toEqual({
      top: [],
      bottom: ["p3"],
    });
    t.h.view.unmount();
  }, 120_000);

  it("a virtual Table: the pinned rows are records wherever the window is; the window is cut between them", async () => {
    const t = await openTable(250);
    vi.spyOn(t.h.session, "showRows").mockImplementation(() => {});
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "virtual" }));
    t.h.flush();
    await settle();
    await t.set({ pinnedRows: { top: ["p200"], bottom: ["p3"] } });
    const body = [...t.h.session.root!.domInputs.values()].find(
      (record) => record.bindingId === "tablebody",
    )!;
    const window = body.rowWindow!;
    expect(window.keys.length).toBe(250);
    expect(window.keys[0]).toBe("p200");
    expect(window.keys.at(-1)).toBe("p3");
    expect(window.pinned).toEqual({ top: 1, bottom: 1 });
    // (The Table record names them — a pin is a change of the Table: its `Virtualizer` lays the
    //  pinned rows out wherever the view is, live 2026-11-21.)
    expect(t.table().props._pinnedRows).toBe("p200\u0000p3");
    // (…which the virtual `Layout` takes as its options — `CatalogTableLayout` builds them.)
    expect(
      catalogTablePinnedRowKeys(t.h.session.root! as never, t.table() as never),
    ).toEqual({ pinnedTop: "p200", pinnedBottom: "p3" });
    const records = body.children
      .map((child) => t.h.session.root!.domInputs.get(child)!)
      .filter((record) => record.rowIndex !== undefined);
    // (The pinned rows first · last, their place in the whole run.)
    expect(records[0]!.props.id).toBe("p200");
    expect(records[0]!.rowIndex).toBe(0);
    expect(records.at(-1)!.props.id).toBe("p3");
    expect(records.at(-1)!.rowIndex).toBe(249);
    expect(records[1]!.rowIndex).toBe(1);
    expect(records[1]!.props.id).toBe("p1");
    // (The DOM: the pinned rows drawn first · last, every other row once between them.)
    // (A virtual Table's rows are RAC's `div` rows — no `tbody`.)
    const drawn = [
      ...t.h.view.container.querySelectorAll('[role="row"][data-key]'),
    ]
      .map((row) => row.getAttribute("data-key")!)
      .filter((key) => /^p\d+$/.test(key));
    expect(drawn[0]).toBe("p200");
    expect(drawn.at(-1)).toBe("p3");
    expect(drawn.length).toBe(250);
    expect(new Set(drawn).size).toBe(250);
    t.h.view.unmount();
  }, 120_000);
});
