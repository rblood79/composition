import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { resolveTableColumnKey } from "../../../../../../packages/shared/src/collections/resolveCollectionItems";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-317 Phase 5 — a Table 「Striped rows」 in the Preview DOM (breakdown §5.5): every second data
 * row in the order shown carries `data-striped` (the Table rule's block — never inline, so the row's
 * hover · selection win), a merged run's Cells say the run's first row's stripe (`data-stripe`).
 * The Builder's Canvas reads the same mark: `adr317StripedRowsCanvas.test.ts`. Expected values are
 * written by hand from the fixture.
 *
 * Fixture (Name · Type · Status): p1 Ara A 1 · p2 Bora A 2 · p3 Chan A 3 · p4 Dana B 4 · p5 Eun B 5.
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
    { id: "p1", name: "Ara", type: "A", status: 1 },
    { id: "p2", name: "Bora", type: "A", status: 2 },
    { id: "p3", name: "Chan", type: "A", status: 3 },
    { id: "p4", name: "Dana", type: "B", status: 4 },
    { id: "p5", name: "Eun", type: "B", status: 5 },
  ],
  useMockData: true,
};

async function openTable(virtual = false) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  const id = h.ids[0] as NodeId;
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [USERS],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
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
  if (virtual) h.workspace.execute(setRowDisplay(id, { mode: "virtual" }));
  h.flush();
  await settle();
  const preview = () => h.session.root!;
  const set = async (props: Record<string, unknown>) => {
    h.declare(id as never, props as never);
    h.flush();
    await settle();
  };
  /** The DOM body rows: first cell's text, stripe mark, inline background, each cell's `data-stripe`. */
  const rows = () =>
    [...h.view.container.querySelectorAll<HTMLElement>('[role="row"]')]
      .filter((row) =>
        row.querySelector('[role="rowheader"], [role="gridcell"]'),
      )
      .map((row) => ({
        text: row.querySelector('[role="rowheader"]')?.textContent?.trim(),
        striped: row.hasAttribute("data-striped"),
        inline: row.style.backgroundColor,
        cellStripes: [
          ...row.querySelectorAll<HTMLElement>(
            '[role="rowheader"], [role="gridcell"]',
          ),
        ].map((cell) => cell.getAttribute("data-stripe") ?? "-"),
      }));
  const table = () =>
    [...preview().domInputs.values()].find(
      (record) => record.ruleId === "Table",
    )!;
  const column = (key: string) => {
    const get = (recordId: string) => preview().domInputs.get(recordId)!;
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
  const merge = async (key: string) => {
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(column(key).id)!.target],
        props: { mergeSameValues: { kind: "set", value: true } },
      }),
    );
    h.flush();
    await settle();
  };
  return { h, set, rows, table, merge };
}

describe("ADR-317 Phase 5 — Striped rows in the DOM", () => {
  it("marks every second data row — none while off, never an inline background", async () => {
    const t = await openTable();
    expect(t.rows().some((row) => row.striped)).toBe(false);
    await t.set({ isStriped: true });
    expect(t.rows().map((row) => [row.text, row.striped])).toEqual([
      ["Ara", false],
      ["Bora", true],
      ["Chan", false],
      ["Dana", true],
      ["Eun", false],
    ]);
    expect(t.rows().every((row) => row.inline === "")).toBe(true);
    await t.set({ isStriped: false });
    expect(t.rows().some((row) => row.striped)).toBe(false);
    t.h.view.unmount();
  }, 120_000);

  it("follows the order shown, not the row: a sort marks the second · fourth rows it shows", async () => {
    const t = await openTable();
    await t.set({ isStriped: true });
    act(() =>
      t.h.session.tables.setTableState(t.table().id, {
        sort: [{ column: "name", direction: "descending" }],
      }),
    );
    await settle();
    expect(t.rows().map((row) => [row.text, row.striped])).toEqual([
      ["Eun", false],
      ["Dana", true],
      ["Chan", false],
      ["Bora", true],
      ["Ara", false],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("a merged run is one cell to the eye: its Cells say the run's first row's stripe", async () => {
    const t = await openTable();
    await t.set({ isStriped: true });
    await t.merge("type");
    // (Type A A A from p1 (unshaded) · B B from p4 (shaded): p2's Type cell is `off` over its
    //  shaded row, p5's `on` over its unshaded one.)
    expect(
      t.rows().map((row) => row.cellStripes.filter((stripe) => stripe !== "-")),
    ).toEqual([[], ["off"], [], [], ["on"]]);
    // (A merged Table's Row · Cell write their line blocks inline — never the stripe: the sheet's,
    //  under the row's hover · selection. Live 2026-11-26: a selected striped row kept its stripe.)
    expect(t.rows().every((row) => row.inline === "")).toBe(true);
    expect(
      [
        ...t.h.view.container.querySelectorAll<HTMLElement>(
          '[role="rowheader"], [role="gridcell"]',
        ),
      ].every((cell) => cell.style.backgroundColor === ""),
    ).toBe(true);
    t.h.view.unmount();
  }, 120_000);

  it("a virtual Table: each drawn row keeps its place's stripe", async () => {
    const t = await openTable(true);
    await t.set({ isStriped: true });
    const rows = t.rows();
    expect(rows.length).toBeGreaterThan(0);
    const order = ["Ara", "Bora", "Chan", "Dana", "Eun"];
    expect(rows.map((row) => row.striped)).toEqual(
      rows.map((row) => order.indexOf(row.text!) % 2 === 1),
    );
    t.h.view.unmount();
  }, 120_000);
});
