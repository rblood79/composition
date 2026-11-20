import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { CATALOG_TABLE_STATE_STORAGE_PREFIX } from "../../../../../../packages/shared/src/catalog/runtime/tableState";
import { catalogTableColumnKey } from "../../../../../../packages/shared/src/catalog/runtime/tableSort";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 사용자 결정 1 (2026-11-20 「표마다 켜는 스위치」) — a Table whose author turned
 * 「Remember state」 on keeps what its user changed in the browser, and a later session of the same
 * app starts from it: the rows are read in the kept sort before the view draws, and RAC's header
 * shows it. A Table without the switch · a session without a storage (the Builder's Preview) keeps
 * nothing. A kept column the Table no longer has is dropped.
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
const KEY = `${CATALOG_TABLE_STATE_STORAGE_PREFIX}project:project:adr280`;

function memory() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

/** A bound Table (Users) in a session of `storage`; `remember` = its 「Remember state」. */
async function openTable(
  storage: ReturnType<typeof memory> | undefined,
  remember: boolean,
) {
  const h = await openAdr280Preview(
    ["Table"],
    storage ? { tableStateStorage: storage } : {},
  );
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
  if (remember)
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { rememberState: { kind: "set", value: true } },
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
  // (The Name column sorts: RAC gives a sortable Column its `aria-sort`.)
  h.workspace.execute(
    setFields({
      targets: [h.workspace.positionOfRecord(nameColumn().id)!.target],
      props: { allowsSorting: { kind: "set", value: true } },
    }),
  );
  h.flush();
  await settle();
  const sortByName = (direction: "ascending" | "descending") =>
    act(() => {
      h.session.sortTable(table().id, {
        column: catalogTableColumnKey(nameColumn()),
        direction,
      });
    });
  return { h, table, rowKeys, sortByName };
}

describe("a Table's 「Remember state」", () => {
  it("keeps the sort in the browser and the next session starts from it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const storage = memory();
    const first = await openTable(storage, true);
    expect(storage.items.size).toBe(0);
    first.sortByName("ascending");
    await settle();
    expect(first.rowKeys()).toEqual(["p3", "p1", "p2"]);
    expect(JSON.parse(storage.items.get(KEY)!)).toEqual({
      [first.table().id]: {
        sort: [{ column: "name", direction: "ascending" }],
      },
    });
    first.h.view.unmount();

    // The same app opened again (another session, the same browser): the kept sort.
    const second = await openTable(storage, true);
    expect(second.h.session.tableState(second.table().id)).toEqual({
      sort: [{ column: "name", direction: "ascending" }],
    });
    expect(second.rowKeys()).toEqual(["p3", "p1", "p2"]);
    // (RAC is told: the sorted header says so.)
    const sorted = [
      ...second.h.view.container.querySelectorAll("[aria-sort]"),
    ].filter((cell) => cell.getAttribute("aria-sort") !== "none");
    expect(sorted.map((cell) => cell.getAttribute("aria-sort"))).toEqual([
      "ascending",
    ]);
    expect(sorted[0]!.textContent).toContain("Name");

    // The sort removed: nothing is kept.
    act(() => second.h.session.sortTable(second.table().id, undefined));
    await settle();
    expect(storage.items.has(KEY)).toBe(false);
    second.h.view.unmount();
  }, 120_000);

  it("keeps the hidden · ordered Columns, and the next session draws them so (ADR-315 Phase 4)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const headers = (h: Awaited<ReturnType<typeof openTable>>["h"]) =>
      [...h.view.container.querySelectorAll('[role="columnheader"]')].map(
        (cell) => (cell.textContent ?? "").trim(),
      );
    const storage = memory();
    const first = await openTable(storage, true);
    expect(headers(first.h)).toEqual(["Name", "Type", "Status"]);
    act(() =>
      first.h.session.setTableState(first.table().id, {
        hiddenColumns: ["type"],
        columnOrder: ["status", "name"],
      }),
    );
    await settle();
    expect(headers(first.h)).toEqual(["Status", "Name"]);
    expect(JSON.parse(storage.items.get(KEY)!)).toEqual({
      [first.table().id]: {
        hiddenColumns: ["type"],
        columnOrder: ["status", "name"],
      },
    });
    first.h.view.unmount();

    const second = await openTable(storage, true);
    expect(second.h.session.tableState(second.table().id)).toEqual({
      hiddenColumns: ["type"],
      columnOrder: ["status", "name"],
    });
    expect(headers(second.h)).toEqual(["Status", "Name"]);

    // The restore itself draws them: a root built with nothing resolved after it (Publish opens a
    // finished document — no author's edit follows the restore). The session's own 「a root was
    // built」 mark is set by hand here: the harness has no second document to open.
    const session = second.h.session as unknown as {
      tableStates: Map<string, unknown>;
      restoredTables: Set<string>;
      restoreDue: boolean;
      changed(): void;
    };
    act(() =>
      second.h.session.setTableState(second.table().id, {
        hiddenColumns: [],
        columnOrder: [],
      }),
    );
    await settle();
    expect(headers(second.h)).toEqual(["Name", "Type", "Status"]);
    storage.setItem(
      KEY,
      JSON.stringify({ [second.table().id]: { hiddenColumns: ["status"] } }),
    );
    session.tableStates.clear();
    session.restoredTables.clear();
    session.restoreDue = true;
    act(() => session.changed());
    await settle();
    expect(headers(second.h)).toEqual(["Name", "Type"]);
    second.h.view.unmount();
  }, 120_000);

  it("keeps a resized Column's width, and the next session starts its resize there (ADR-315 Phase 4)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const storage = memory();
    const resizable = async (opened: Awaited<ReturnType<typeof openTable>>) => {
      const { h, table } = opened;
      const header = table()
        .children.map((child) => h.session.root!.domInputs.get(child))
        .find((record) => record?.ruleId === "TableHeader")!;
      const name = header.children
        .map((child) => h.session.root!.domInputs.get(child)!)
        .find((record) => record.props.key === "name")!;
      h.workspace.execute(
        setFields({
          targets: [h.workspace.positionOfRecord(name.id)!.target],
          props: { allowsResizing: { kind: "set", value: true } },
        }),
      );
      h.flush();
      await settle();
      return catalogTableColumnKey(h.session.root!.domInputs.get(name.id)!);
    };
    /** RAC's widths as the Table's tracks (`CatalogTableResizeTracks`). */
    const tracks = (opened: Awaited<ReturnType<typeof openTable>>) =>
      opened.h.view.container
        .querySelector<HTMLElement>("[data-node-table]")!
        .style.getPropertyValue("--table-resized-tracks")
        .split(" ")[0];
    const first = await openTable(storage, true);
    const racKey = await resizable(first);
    /** The runtime props the session writes to RAC (its echoes). */
    const echoes = (opened: Awaited<ReturnType<typeof openTable>>) => {
      const writes: Record<string, unknown>[] = [];
      const session = opened.h.session as unknown as {
        runtimePropsWriter?: (
          id: string,
          patch: Record<string, unknown>,
        ) => void;
      };
      const write = session.runtimePropsWriter;
      expect(write).toBeDefined();
      session.runtimePropsWriter = (id, patch) => {
        writes.push(patch);
        write!(id, patch);
      };
      return () => writes.filter((patch) => "_widthsRevision" in patch).length;
    };
    const firstEchoes = echoes(first);
    // (RAC's `onResizeEnd` — jsdom drags nothing: the widths it gives, by RAC key.)
    act(() =>
      first.h.session.resizeTableColumns(first.table().id, {
        [racKey]: 260,
        "not-a-column": 90,
      }),
    );
    await settle();
    expect(first.h.session.tableState(first.table().id)).toEqual({
      columnWidths: { name: 260 },
    });
    expect(JSON.parse(storage.items.get(KEY)!)).toEqual({
      [first.table().id]: { columnWidths: { name: 260 } },
    });
    expect(first.h.session.tableColumnWidths(first.table().id)).toEqual({
      [racKey]: 260,
    });
    // (They are RAC's already: the Table is not built again.)
    expect(firstEchoes()).toBe(0);
    first.h.view.unmount();

    // The next session: the Column's resize starts at the kept width.
    const second = await openTable(storage, true);
    await resizable(second);
    expect(second.h.session.tableState(second.table().id)).toEqual({
      columnWidths: { name: 260 },
    });
    expect(tracks(second)).toBe("260px");
    // A width set from outside the drag (a reset): the Table is built again from it.
    const secondEchoes = echoes(second);
    act(() =>
      second.h.session.setTableState(second.table().id, { columnWidths: {} }),
    );
    await settle();
    expect(secondEchoes()).toBe(1);
    expect(tracks(second)).not.toBe("260px");
    second.h.view.unmount();
  }, 120_000);

  it("keeps nothing for a Table without the switch, or a session without a storage", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const storage = memory();
    const off = await openTable(storage, false);
    off.sortByName("descending");
    await settle();
    expect(off.rowKeys()).toEqual(["p2", "p1", "p3"]);
    expect(storage.items.size).toBe(0);
    off.h.view.unmount();

    // (A kept state of a Table whose switch is off now is not read back.)
    storage.setItem(
      KEY,
      JSON.stringify({
        [off.table().id]: {
          sort: [{ column: "name", direction: "descending" }],
        },
      }),
    );
    const again = await openTable(storage, false);
    expect(again.h.session.tableState(again.table().id)).toEqual({});
    expect(again.rowKeys()).toEqual(["p1", "p2", "p3"]);
    again.h.view.unmount();

    // The Builder's Preview: no storage — the switch is on and nothing is read or kept.
    const preview = await openTable(undefined, true);
    expect(preview.rowKeys()).toEqual(["p1", "p2", "p3"]);
    preview.h.view.unmount();
  }, 120_000);

  it("drops a kept column the Table no longer has, and a value that is not a state", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const storage = memory();
    const probe = await openTable(storage, true);
    const tableId = probe.table().id;
    probe.h.view.unmount();
    for (const kept of [
      { sort: [{ column: "gone", direction: "ascending" }] },
      { sort: "name" },
      "not a state",
    ]) {
      storage.setItem(KEY, JSON.stringify({ [tableId]: kept }));
      const opened = await openTable(storage, true);
      expect(opened.h.session.tableState(tableId)).toEqual({});
      expect(opened.rowKeys()).toEqual(["p1", "p2", "p3"]);
      opened.h.view.unmount();
    }
    storage.setItem(KEY, "{ broken json");
    const broken = await openTable(storage, true);
    expect(broken.rowKeys()).toEqual(["p1", "p2", "p3"]);
    broken.h.view.unmount();
  }, 120_000);
});
