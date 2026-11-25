import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  CATALOG_STAGED_ROW_MARGIN,
  CATALOG_VIRTUAL_ROW_WINDOW,
} from "../../../../../../packages/shared/src/catalog/runtime/catalogPreviewSession";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 3 (G3 — a search keystroke's cost): a virtual Table's search · sort changes which
 * rows show and their order, never a row's own data. Live (10,000 rows, 2026-11-20) every keystroke
 * resolved the window's 60 rows again and React drew them again — 86 ms of CPU a key (the filter
 * itself 6), the same whether the result changed or not: 「Person」 typed over rows all named
 * 「Person N」 paid it six times for the same rows. So:
 *
 *  - a row that stays at its place (the same key at the same index) keeps its records;
 *  - the rows in view are resolved first, the rest of the window once the frame painted.
 *
 * Fixture: 250 rows `p1 … p250`, named `Person1 … Person250`.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
/** Past the frame: the rows left out of a staged window come in after it paints. */
const painted = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 80));
  });

async function openVirtualTable() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
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
          ],
          mockData: Array.from({ length: 250 }, (_, index) => ({
            id: `p${index + 1}`,
            name: `Person${index + 1}`,
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
  /** The window's row records by their place in the result. */
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
  return { h, showRows, table, body, rows };
}

describe("a virtual Table's search keeps the rows that stay (ADR-315 Phase 3)", () => {
  it("a search with the same rows resolves no row again; one that moves rows resolves those", async () => {
    const t = await openVirtualTable();
    expect(t.rows().size).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    const before = t.rows();
    const bodyBefore = t.body();

    // 「Person」 is in every name: the same 250 rows in the same order.
    act(() => t.h.session.tables.searchTable(t.table().id, "Person"));
    await settle();
    expect(t.body().rowWindow?.keys.length).toBe(250);
    // (The same rows are the same collection to RAC: the body's record is the one it was — a new
    //  key list would draw every row in view again.)
    expect(t.body()).toBe(bodyBefore);
    const same = t.rows();
    expect(same.size).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    for (const [index, record] of before) expect(same.get(index)).toBe(record);

    // 「Person1」: p1 · p10 ~ p19 · p100 ~ p199 — 111 rows. p1 stays first; the row after it is p10.
    act(() => t.h.session.tables.searchTable(t.table().id, "Person1"));
    await painted();
    expect(t.body().rowWindow?.keys.length).toBe(111);
    expect(t.body().rowWindow?.keys.slice(0, 3)).toEqual(["p1", "p10", "p11"]);
    const narrowed = t.rows();
    expect(narrowed.get(0)).toBe(before.get(0));
    expect(narrowed.get(1)?.props.id).toBe("p10");
    expect(narrowed.get(1)).not.toBe(before.get(1));
    // (The row that left the result is gone — its records with it.)
    expect(t.h.session.root!.domInputs.get(before.get(1)!.id)).toBeUndefined();

    // A sort: rows change places — only a row at its old place is kept (none here: descending).
    act(() =>
      t.h.session.tables.setTableState(t.table().id, {
        sort: [{ column: "name", direction: "descending" }],
      }),
    );
    await painted();
    const sorted = t.rows();
    expect(sorted.get(0)?.props.id).toBe("p199");
    expect(sorted.get(0)).not.toBe(narrowed.get(0));
    t.h.view.unmount();
  }, 120_000);

  it("resolves the rows in view first, and the rest of the window once the frame painted", async () => {
    const t = await openVirtualTable();
    const owner = t.body().rowWindow!.owner;
    // (14 rows in view at the top: the window stays where it is.)
    act(() => t.showRows(owner, 0, 13, 250));
    await settle();
    expect(t.rows().size).toBe(CATALOG_VIRTUAL_ROW_WINDOW);

    // 「Person2」: p2 · p20 ~ p29 · p200 ~ p250 — 62 rows, none at its old place.
    act(() => t.h.session.tables.searchTable(t.table().id, "Person2"));
    const staged = t.rows();
    expect(t.body().rowWindow?.keys.length).toBe(62);
    expect(staged.size).toBe(14 + 2 * CATALOG_STAGED_ROW_MARGIN);
    expect(staged.get(0)?.props.id).toBe("p2");
    // (Every row is still a row of RAC's collection — the ones without records are keyed Rows.)
    expect(
      t.h.view.container
        .querySelector("[role=grid]")
        ?.getAttribute("aria-rowcount"),
    ).toBe("63");

    await painted();
    const full = t.rows();
    expect(full.size).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    // (The rows drawn first are the ones they were — the rest came in.)
    for (const [index, record] of staged) expect(full.get(index)).toBe(record);
    expect(full.get(59)?.props.id).toBe("p248");

    // A key typed before the frame paints: the rows in view again — the rest wait for that frame.
    act(() => t.h.session.tables.searchTable(t.table().id, "Person"));
    act(() => t.h.session.tables.searchTable(t.table().id, "Person1"));
    expect(t.rows().size).toBe(14 + 2 * CATALOG_STAGED_ROW_MARGIN);
    await painted();
    expect(t.rows().size).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    expect(t.rows().get(1)?.props.id).toBe("p10");

    // Rows in view outside the staged rows (the Table scrolled before the frame): the window moves
    // over them at once, whole.
    act(() => t.h.session.tables.searchTable(t.table().id, "Person"));
    act(() => t.showRows(owner, 100, 113, 250));
    await settle();
    expect(t.rows().size).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    expect(t.rows().has(100)).toBe(true);
    expect(t.rows().has(113)).toBe(true);
    await painted();
    expect(t.rows().size).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    expect(t.rows().has(100)).toBe(true);
    t.h.view.unmount();
  }, 120_000);
});
