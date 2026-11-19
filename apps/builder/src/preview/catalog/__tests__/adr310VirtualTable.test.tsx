import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  CATALOG_ROW_WINDOW_STEP,
  CATALOG_VIRTUAL_ROW_WINDOW,
} from "../../../../../../packages/shared/src/catalog/runtime/catalogPreviewSession";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-310 Phase 8 — a virtual-scrolled Table holds every loaded row in the Preview (the
 * `Virtualizer` puts the visible ones in the DOM). Before, the rows its height holds were all the
 * Preview kept (`boundTableRows`): live, a 300 px Table bound to 250 rows scrolled to its 11th row
 * only. (2026-11-19: only the Builder's sample is cut by the height — the Preview keeps what the
 * display mode delivers in every mode, and the Table scrolls.)
 *
 * 2026-11-19 (row window): 「holds every row」 is RAC's collection — every row's key, in order. The
 * records are the rows around the ones shown (`CATALOG_VIRTUAL_ROW_WINDOW`); the rest are keyed Rows
 * without content, and one drawn moves the window (`showRows`). Before, every row was records: a
 * sort of 1,000 rows resolved them all again (560 ms; 10,000 rows 6 s) and 10,000 rows held 1 GB.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

describe("ADR-310 Phase 8 — a virtual Table's rows", () => {
  it("a fixed-height Table bound to 250 rows holds all 250 once virtual-scrolled", async () => {
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
    // (jsdom lays nothing out — RAC's `Layout` there reports more rows in view each pass until it
    //  holds them all. The rows in view are given by hand here; the `Layout`'s own report is the
    //  live harness's — `datagrid-table-vs-tanstack-live.mjs`.)
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
    h.flush();
    await settle();
    const rows = () => {
      const root = h.session.root!;
      return [...root.domInputs.values()].filter(
        (record) =>
          record.bindingId === "row" &&
          root.domInputs.get(record.parentId)?.bindingId === "tablebody",
      ).length;
    };
    const body = () =>
      [...h.session.root!.domInputs.values()].find(
        (record) => record.bindingId === "tablebody",
      );
    const bodyOverflow = () => body()?.visual.overflow;
    const rowIndexes = () => {
      const root = h.session.root!;
      return [...root.domInputs.values()]
        .filter(
          (record) =>
            record.bindingId === "row" &&
            root.domInputs.get(record.parentId)?.bindingId === "tablebody",
        )
        .map((record) => record.rowIndex!)
        .sort((a, b) => a - b);
    };
    // (Shown as it is — 「더 보기」: the window of 100, not the rows its height holds. The Preview
    //  cuts nothing — the Table scrolls. 2026-11-19: a page of 20 showed 14.)
    expect(rows()).toBe(100);
    expect(bodyOverflow()).not.toBe("hidden");
    h.workspace.execute(setRowDisplay(id, { mode: "virtual" }));
    h.flush();
    await settle();
    // (Every row is in the collection by key; the records are the window's.)
    expect(body()?.rowWindow?.keys.length).toBe(250);
    expect(body()?.rowWindow?.keys.slice(0, 2)).toEqual(["p1", "p2"]);
    expect(body()?.rowWindow?.start).toBe(0);
    expect(rows()).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    // (RAC's collection holds every row — the rows outside the window are keyed Rows without
    //  content: a virtualized grid's `aria-rowcount` is its header row + its rows. Live, 2026-11-19:
    //  without them the Table scrolled over its 60 window rows only.)
    expect(
      h.view.container
        .querySelector("[role=grid]")
        ?.getAttribute("aria-rowcount"),
    ).toBe("251");
    expect(rowIndexes()[0]).toBe(0);
    expect(rowIndexes().at(-1)).toBe(CATALOG_VIRTUAL_ROW_WINDOW - 1);
    const owner = body()!.rowWindow!.owner;
    const rowRecords = () => {
      const root = h.session.root!;
      return new Map(
        [...root.domInputs.values()]
          .filter(
            (record) =>
              record.bindingId === "row" &&
              root.domInputs.get(record.parentId)?.bindingId === "tablebody",
          )
          .map((record) => [record.rowIndex!, record] as const),
      );
    };
    // (A row's RAC key is its key in the window's list — the empty row and the record's row are
    //  the same RAC Row.)
    for (const [index, record] of rowRecords())
      expect(record.props.id).toBe(body()!.rowWindow!.keys[index]);
    // (Rows in view well inside the window: it stays.)
    act(() => showRows(owner, 10, 21, 250));
    await settle();
    expect(body()?.rowWindow?.start).toBe(0);
    // (A short move — rows 30 ~ 59 stay in the window: their records are the ones they were (not
    //  resolved again), the rows coming in are new, and the rows left behind are gone. Before, a
    //  move resolved every row of the window again — live, scrolling p95 100 ms at 1x.)
    const held = rowRecords();
    act(() => showRows(owner, 50, 69, 250));
    await settle();
    expect(body()?.rowWindow?.start).toBe(30);
    const moved = rowRecords();
    expect([...moved.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: CATALOG_VIRTUAL_ROW_WINDOW }, (_, i) => 30 + i),
    );
    for (let index = 30; index < 60; index += 1)
      expect(moved.get(index)).toBe(held.get(index));
    // (The move resolved the 30 rows coming in — half the window — and the Table's own records.)
    const rowRecordsEach = [...h.session.root!.domInputs.keys()].filter((key) =>
      key.endsWith(`#row:${moved.get(75)!.props.id}`),
    ).length;
    expect(rowRecordsEach).toBeGreaterThan(1);
    expect(h.session.root!.metrics.layoutInputVisits).toBeLessThan(
      rowRecordsEach * 40,
    );
    expect(h.session.root!.domInputs.get(held.get(0)!.id)).toBeUndefined();
    expect(
      h.session.root!.domInputs.get(held.get(0)!.children[0]!),
    ).toBeUndefined();
    expect(moved.get(75)!.props.id).toBe("p76");
    expect(
      h.session.root!.domInputs.get(moved.get(75)!.children[0]!),
    ).toBeDefined();
    // (Rows 100 ~ 111 come into view — a scroll: the window moves over them, and its rows keep
    //  their place in the whole run.)
    act(() => showRows(owner, 100, 111, 250));
    await settle();
    expect(rows()).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    expect(body()?.rowWindow?.start).toBe(76);
    expect(rowIndexes()[0]).toBe(76);
    expect(rowIndexes().at(-1)).toBe(76 + CATALOG_VIRTUAL_ROW_WINDOW - 1);
    expect(
      h.view.container
        .querySelector("[role=grid]")
        ?.getAttribute("aria-rowcount"),
    ).toBe("251");
    // (The end: the window stops at the last row.)
    act(() => showRows(owner, 240, 249, 250));
    await settle();
    expect(rowIndexes().at(-1)).toBe(249);
    expect(rows()).toBe(CATALOG_VIRTUAL_ROW_WINDOW);
    // (More rows in view than the window holds with a step on each side — a tall Table: it grows
    //  to hold them, centred.)
    const grown = 40 + 2 * CATALOG_ROW_WINDOW_STEP;
    act(() => showRows(owner, 100, 139, 250));
    await settle();
    expect(rows()).toBe(grown);
    expect(rowIndexes()[0]).toBe(120 - grown / 2);
    // (Less than a step off its centre the window stays; a step off, it follows by those rows.)
    act(() => showRows(owner, 103, 142, 250));
    await settle();
    expect(rowIndexes()[0]).toBe(120 - grown / 2);
    act(() =>
      showRows(
        owner,
        100 + CATALOG_ROW_WINDOW_STEP,
        139 + CATALOG_ROW_WINDOW_STEP,
        250,
      ),
    );
    await settle();
    expect(rowIndexes()[0]).toBe(120 - grown / 2 + CATALOG_ROW_WINDOW_STEP);
    expect(rows()).toBe(grown);
    // (Drawn without the `Virtualizer` every row is in view: every row is a record.)
    act(() => showRows(owner, 0, 249, 250));
    await settle();
    expect(rows()).toBe(250);
    expect(body()?.rowWindow).toBeUndefined();
    // (2026-11-19 사용자 보고 「가상스크롤시에 table 내의 내용이 보이지 않는다」: the `Virtualizer`
    //  places the rows absolutely in a body of no height — a clipping body cut every row.)
    expect(bodyOverflow()).not.toBe("hidden");
    h.view.unmount();
    // (250 Table rows render past the default 5 s under a loaded suite run — 7 s alone, and past
    //  30 s once in a full `src/preview` run.)
  }, 90_000);
});
