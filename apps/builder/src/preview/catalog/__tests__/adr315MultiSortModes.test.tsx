import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  answerBody,
  answerSuffix,
} from "../../../../scripts/mock-query-server.mjs";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogTableColumnKey } from "../../../../../../packages/shared/src/catalog/runtime/tableSort";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 2 (G2) — a sort of several columns where the rows are cut: 「더 보기」 · a page · a
 * virtual Table show their rows of the whole sorted collection (the sort runs on row numbers
 * before the cut — HC3), and a Table whose rows are the server's pages sends the whole sort list
 * or does not hold it (breakdown §4.3.1 — 리뷰 round 1 H1).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-type", key: "type", type: "string" },
  { id: "f-status", key: "status", type: "number" },
];

async function openTable(data: Record<string, unknown>) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      variables: [],
      apiEndpoints: [],
      ...data,
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
  h.workspace.execute(
    setFields({
      targets: [{ kind: "node", id }],
      props: { allowsMultiSort: { kind: "set", value: true } },
    }),
  );
  h.flush();
  await settle();
  const root = () => h.session.root!;
  const table = () =>
    [...root().domInputs.values()].find((record) => record.ruleId === "Table")!;
  const body = () =>
    [...root().domInputs.values()].find(
      (record) => record.bindingId === "tablebody",
    );
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
  return { h, id, table, body, rowKeys, press, state };
}

describe("a sort of several columns, then the display's cut (local rows)", () => {
  // p1 … p250: an even row is type A, an odd one B; status = its number.
  const USERS = {
    id: "users",
    name: "Users",
    schema: SCHEMA,
    mockData: Array.from({ length: 250 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Person${index + 1}`,
      type: (index + 1) % 2 === 0 ? "A" : "B",
      status: index + 1,
    })),
    useMockData: true,
  };

  it("「더 보기」 · a page · a virtual Table show their rows of the sorted collection", async () => {
    const t = await openTable({ collections: [USERS] });
    await t.press("type");
    await t.press("status", true);
    await t.press("status", true);
    expect(t.state()).toEqual([
      { column: "type", direction: "ascending" },
      { column: "status", direction: "descending" },
    ]);
    // Type A (the 125 even rows) by status ↓: p250 · p248 … p2 — then B: p249 … p1.
    // 「더 보기」: the first 100 of that order.
    expect(t.rowKeys().length).toBe(100);
    expect(t.rowKeys().slice(0, 3)).toEqual(["p250", "p248", "p246"]);
    // (The 100th: 250 − 2 × 99.)
    expect(t.rowKeys()[99]).toBe("p52");
    await act(() => t.h.session.showMore("users", t.id, true));
    await settle();
    expect(t.rowKeys().length).toBe(200);
    // (The 126th is the first B row; the 200th is B's 75th: 249 − 2 × 74.)
    expect(t.rowKeys()[124]).toBe("p2");
    expect(t.rowKeys()[125]).toBe("p249");
    expect(t.rowKeys()[199]).toBe("p101");

    // Pages of 20: page 2 is rows 21 … 40 of the order.
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "pages", size: 20 }));
    t.h.flush();
    await settle();
    expect(t.rowKeys().slice(0, 2)).toEqual(["p250", "p248"]);
    await act(() => t.h.session.goToPage(t.id, 2));
    await settle();
    expect(t.rowKeys().length).toBe(20);
    expect(t.rowKeys()[0]).toBe("p210");
    expect(t.rowKeys()[19]).toBe("p172");
    // (One more sort entry is another order: the list starts over at its first page.)
    await t.press("name", true);
    expect(t.h.session.pageOf(t.id)?.page).toBe(1);

    // Virtual: every row is in the collection by key, in the order.
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "virtual" }));
    t.h.flush();
    await settle();
    // (jsdom lays nothing out: RAC's `Layout` reports every row in view, so every row is a record
    //  and there is no window — the order is the records'. The window's own keys are the live
    //  harness's, `datagrid-table-vs-tanstack-live.mjs`.)
    const keys = t.body()?.rowWindow?.keys ?? t.rowKeys();
    expect(keys.length).toBe(250);
    expect(keys.slice(0, 3)).toEqual(["p250", "p248", "p246"]);
    expect(keys[124]).toBe("p2");
    expect(keys[125]).toBe("p249");
    expect(keys[249]).toBe("p1");
    t.h.view.unmount();
  }, 120_000);
});

describe("a sort of several columns on the server's pages (리뷰 round 1 H1)", () => {
  // A page of 2. team (Type) ↑ then score (Status) ↓ is [s3, s2]; Type ↑ alone is [s1, s2] — s3 is
  // not in that answer, so the second sort is never made up for here.
  const ROWS = [
    { id: "s1", name: "s1", type: "A", status: 1 },
    { id: "s2", name: "s2", type: "A", status: 5 },
    { id: "s3", name: "s3", type: "A", status: 9 },
    { id: "s4", name: "s4", type: "B", status: 3 },
  ];
  /** The mock query server (its own filter · sort · page — not the evaluator) behind `fetch`. */
  function stubServer() {
    const requests: { search: string; body?: Record<string, unknown> }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ search: decodeURIComponent(url.search), body });
      const items = body
        ? answerBody(ROWS, body).items
        : answerSuffix(ROWS, url.searchParams).items;
      return new Response(JSON.stringify({ items, total: ROWS.length }), {
        headers: { "content-type": "application/json" },
      });
    });
    return requests;
  }
  const remote = (
    querySerialization: Record<string, unknown>,
    method = "GET",
  ) => ({
    collections: [
      {
        id: "users",
        name: "Users",
        schema: SCHEMA,
        mockData: [],
        // (The Builder's load — what the Table shows before the session's first request.)
        runtimeData: ROWS,
        useMockData: false,
      },
    ],
    apiEndpoints: [
      {
        id: "list",
        name: "listUsers",
        baseUrl: "https://api.example.test",
        method,
        path: "/users",
        targetCollection: "Users",
        responseMapping: { dataPath: "items", totalPath: "total" },
        querySerialization,
      },
    ],
  });

  it("a format that takes a sort list: the request carries both, the page is the server's", async () => {
    const requests = stubServer();
    const t = await openTable(
      remote({ kind: "suffix", pageSize: 2, multiSort: true }),
    );
    expect(t.h.session.tables.tableSliceServable(t.table().id, "sort")).toEqual({
      accepts: "whole",
    });
    await t.press("type");
    await t.press("status", true);
    await t.press("status", true);
    expect(t.state()).toEqual([
      { column: "type", direction: "ascending" },
      { column: "status", direction: "descending" },
    ]);
    expect(requests.at(-1)!.search).toBe(
      "?_sort=type,status&_order=asc,desc&_page=1&_limit=2",
    );
    // (The server's page — the rows are not sorted here again.)
    expect(t.rowKeys()).toEqual(["s3", "s2"]);
    t.h.view.unmount();
  }, 120_000);

  it("a format that takes one sort: the second never enters the state — one sort is sent whole", async () => {
    const requests = stubServer();
    const t = await openTable(remote({ kind: "suffix", pageSize: 2 }));
    expect(t.h.session.tables.tableSliceServable(t.table().id, "sort")).toEqual({
      accepts: "one",
      reason: "suffixSingle",
    });
    await t.press("type");
    expect(requests.at(-1)!.search).toBe(
      "?_sort=type&_order=asc&_page=1&_limit=2",
    );
    expect(t.rowKeys()).toEqual(["s1", "s2"]);
    // (Shift on this Table is a plain press: the Column pressed is the one sort.)
    await t.press("status", true);
    expect(t.state()).toEqual([{ column: "status", direction: "ascending" }]);
    expect(requests.at(-1)!.search).toBe(
      "?_sort=status&_order=asc&_page=1&_limit=2",
    );
    // 1 (s1) · 3 (s4)
    expect(t.rowKeys()).toEqual(["s1", "s4"]);
    // (A write of two sorts — a rule · the browser's memory — goes through the same judgment: the
    //  state holds one, the last written.)
    act(() => {
      t.h.session.tables.setTableState(t.table().id, {
        sort: [
          { column: "type", direction: "ascending" },
          { column: "status", direction: "descending" },
        ],
      });
    });
    await settle();
    expect(t.state()).toEqual([{ column: "status", direction: "descending" }]);
    // (No request ever named two sorts.)
    expect(requests.some((request) => request.search.includes(","))).toBe(
      false,
    );
    t.h.view.unmount();
  }, 120_000);

  it("a body format carries the list in order", async () => {
    const requests = stubServer();
    const t = await openTable(remote({ kind: "body", pageSize: 2 }, "POST"));
    await t.press("type");
    await t.press("status", true);
    await t.press("status", true);
    expect(requests.at(-1)!.body!.sort).toEqual([
      { field: "type", direction: "ascending" },
      { field: "status", direction: "descending" },
    ]);
    expect(t.rowKeys()).toEqual(["s3", "s2"]);
    // (Back to one sort: the request's `sort` is the object it always was.)
    await t.press("status");
    expect(requests.at(-1)!.body!.sort).toEqual({
      field: "status",
      direction: "ascending",
    });
    t.h.view.unmount();
  }, 120_000);
});
