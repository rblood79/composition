import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  answerBody,
  answerSuffix,
  type MockBodyRequest,
} from "../../../../scripts/mock-query-server.mjs";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogTableTotalsCommand } from "../../../builder/catalogRuntime/tableTotals";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 5 증분 5g — a Table whose rows are a server's pages (breakdown §4.3.1 · §4.3.2):
 *
 * - 5g-1 · an endpoint that does not answer a grouping · a totals row · a tree for the Table:
 *   every page loads (to `VIEW_LOCAL_LOAD_CAP`) and they run here — never over the pages loaded
 *   so far (a quiet part of the data).
 *
 * Fixture (a page of 2; Name · Type · Status are the Table's Columns):
 *   s1 Bora B 2 · s2 Chan A 1 · s3 Ara B 3 · s4 Dana A 5 · s5 Eun A 4
 * The first page [s1, s2] has one B and one A — the data has 2 B (5) and 3 A (10).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 30; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-type", key: "type", type: "string" },
  { id: "f-status", key: "status", type: "number" },
];
const ROWS = [
  { id: "s1", name: "Bora", type: "B", status: 2 },
  { id: "s2", name: "Chan", type: "A", status: 1 },
  { id: "s3", name: "Ara", type: "B", status: 3 },
  { id: "s4", name: "Dana", type: "A", status: 5 },
  { id: "s5", name: "Eun", type: "A", status: 4 },
];

interface Request {
  search: string;
  body?: MockBodyRequest & Record<string, unknown>;
}

/**
 * The mock query server (the independent oracle) over `rows` — the total it reports may be set;
 * `ignoreKeys` = a server that does not know `keys` (it answers as if none were asked).
 */
function stubServer(
  rows: readonly Record<string, unknown>[] = ROWS,
  reportedTotal?: number,
  ignoreKeys = false,
) {
  const requests: Request[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ search: decodeURIComponent(url.search), body });
    if (body) {
      const { keys, ...rest } = body;
      const answer = answerBody(rows, ignoreKeys ? rest : { ...rest, keys });
      return new Response(
        JSON.stringify({
          ...answer,
          ...(reportedTotal !== undefined ? { total: reportedTotal } : {}),
        }),
        { headers: { "content-type": "application/json" } },
      );
    }
    const answer = answerSuffix(rows, url.searchParams, {
      field: "id",
      only: "pin",
      except: "unpin",
    });
    const page = Number(url.searchParams.get("_page") ?? 1);
    const size = Number(url.searchParams.get("_limit") ?? rows.length);
    const total = Number(answer.headers["X-Total-Count"]);
    return new Response(
      JSON.stringify({
        items: answer.items,
        total: reportedTotal ?? total,
        ...(page * size < total ? { next: String(page + 1) } : {}),
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  return requests;
}

/**
 * The collection's endpoint: `"template"` pages by its own `{{ cursor }}` (no query format — the
 * Table's view is not sent); a query format pages by its `pageSize` when a view goes with it.
 */
const remote = (
  querySerialization: Record<string, unknown> | "template",
  options: { method?: string; schema?: readonly unknown[] } = {},
) => ({
  collections: [
    {
      id: "users",
      name: "Users",
      schema: options.schema ?? SCHEMA,
      mockData: [],
      useMockData: false,
    },
  ],
  apiEndpoints: [
    {
      id: "list",
      name: "listUsers",
      baseUrl: "https://api.example.test",
      method: options.method ?? "GET",
      path: "/users",
      targetCollection: "Users",
      ...(querySerialization === "template"
        ? {
            queryParams: [
              { key: "_page", value: "{{ cursor }}" },
              { key: "_limit", value: "2" },
            ],
            responseMapping: {
              dataPath: "items",
              totalPath: "total",
              cursorPath: "next",
            },
          }
        : {
            querySerialization,
            responseMapping:
              querySerialization.kind === "body"
                ? {
                    dataPath: "items",
                    totalPath: "total",
                    cursorPath: "cursor",
                  }
                : { dataPath: "items", totalPath: "total", cursorPath: "next" },
          }),
    },
  ],
});

async function openTable(
  data: Record<string, unknown>,
  fieldMap: Record<string, string> = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      variables: [],
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
        ...(Object.keys(fieldMap).length ? { fieldMap } : {}),
      } as never)!,
    ),
  );
  h.flush();
  await settle();
  const root = () => h.session.root!;
  const table = () =>
    [...root().domInputs.values()].find((record) => record.ruleId === "Table")!;
  const column = (key: string) => {
    const header = table()
      .children.map((child) => root().domInputs.get(child))
      .find((record) => record?.ruleId === "TableHeader")!;
    return header.children
      .map((child) => root().domInputs.get(child)!)
      .find((record) => record.props.key === key)!;
  };
  /** The DOM's body · footer rows, each as its cell texts (not an empty body's empty-state row — S2). */
  const rows = (scope = "tbody") =>
    [
      ...h.view.container.querySelectorAll(
        `${scope}:not([data-empty]) [role="row"]`,
      ),
    ]
      .map((row) =>
        [...row.querySelectorAll('[role="rowheader"], [role="gridcell"]')].map(
          (cell) => (cell.textContent ?? "").trim(),
        ),
      )
      .filter((cells) => cells.length > 0);
  const set = async (patch: Record<string, unknown>) => {
    act(() => h.session.tables.setTableState(table().id, patch));
    await settle();
  };
  const declare = async (props: Record<string, unknown>) => {
    h.declare(id, props as never);
    await settle();
  };
  /** The body's rows: each one's key and pinned side. */
  const pinnedRows = () =>
    [...h.view.container.querySelectorAll('tbody [role="row"]')].map((row) => [
      row.getAttribute("data-key"),
      row.getAttribute("data-pinned-row"),
    ]);
  const pin = async (key: string, side: "top" | "bottom") => {
    act(() => h.session.tables.pinTableRow(table().id, key, side));
    await settle();
  };
  return {
    h,
    id,
    table,
    column,
    rows,
    set,
    declare,
    pinnedRows,
    pin,
    errors,
  };
}

/** Sets a Column's 「Group · totals aggregate」. */
function aggregate(t: Awaited<ReturnType<typeof openTable>>, key: string) {
  t.h.workspace.execute(
    setFields({
      targets: [t.h.workspace.positionOfRecord(t.column(key).id)!.target],
      props: { aggregate: { kind: "set", value: "sum" } },
    }),
  );
  t.h.flush();
}

describe("5g-1 — a grouping · a totals row · a tree on a server's pages load every row", () => {
  it("an endpoint that pages by its own cursor: a grouping loads every page, the groups are the data's", async () => {
    const requests = stubServer();
    const t = await openTable(remote("template"));
    // (The first page only: the rows the server sent.)
    expect(t.rows().map((cells) => cells[0])).toEqual(["Bora", "Chan"]);
    expect(
      t.h.session.tables.tableSliceServable(t.table().id, "grouping"),
    ).toEqual({
      accepts: "loaded",
      reason: "rowsSplit",
    });
    aggregate(t, "status");
    await settle();
    await t.set({ grouping: ["type"] });
    // Every page was asked for — the next ones by the server's cursor.
    expect(requests.map((request) => request.search)).toEqual([
      "?_limit=2",
      "?_page=2&_limit=2",
      "?_page=3&_limit=2",
    ]);
    // The groups and their sums are the five rows', not the first page's (B 2 · A 1).
    expect(t.rows()).toEqual([
      ["B (2)", "", "5"],
      ["A (3)", "", "10"],
    ]);
    // A reload (`useAsyncList.reload` — the first page again) loads the other pages again too.
    await act(() => t.h.session.reload("users"));
    await settle();
    expect(requests.slice(3).map((request) => request.search)).toEqual([
      "?_limit=2",
      "?_page=2&_limit=2",
      "?_page=3&_limit=2",
    ]);
    expect(t.rows()).toEqual([
      ["B (2)", "", "5"],
      ["A (3)", "", "10"],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("a suffix format sending the Table's sort: the grouping loads the sorted pages, not just the first", async () => {
    const requests = stubServer();
    const t = await openTable(remote({ kind: "suffix", pageSize: 2 }));
    await t.set({ sort: [{ column: "name", direction: "ascending" }] });
    expect(t.rows().map((cells) => cells[0])).toEqual(["Ara", "Bora"]);
    await t.set({ grouping: ["type"] });
    expect(requests.map((request) => request.search)).toEqual(
      expect.arrayContaining([
        "?_sort=name&_order=asc&_page=2&_limit=2",
        "?_sort=name&_order=asc&_page=3&_limit=2",
      ]),
    );
    // (The first page [Ara, Bora] is all B — the data has an A group too.)
    expect(t.rows()).toEqual([
      ["B (2)", "", ""],
      ["A (3)", "", ""],
    ]);
    // Another sort is another request: its first page reloads — and its other pages load too.
    // (Descending by name: the first page [Eun, Dana] is all A.)
    await t.set({ sort: [{ column: "name", direction: "descending" }] });
    expect(requests.at(-1)!.search).toBe(
      "?_sort=name&_order=desc&_page=3&_limit=2",
    );
    // (The groups in the sort's order — Eun's A first — over the five rows.)
    expect(t.rows()).toEqual([
      ["A (3)", "", ""],
      ["B (2)", "", ""],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("a body format without the group-rows request: the same — the grouping is not the server's page", async () => {
    const requests = stubServer();
    const t = await openTable(
      remote({ kind: "body", pageSize: 2 }, { method: "POST" }),
    );
    await t.set({ sort: [{ column: "name", direction: "descending" }] });
    await t.set({ grouping: ["type"] });
    // (No group request went: the grouping runs here over every page.)
    expect(requests.some((request) => request.body?.group)).toBe(false);
    expect(requests.at(-1)!.body!.page).toEqual({ cursor: "4", limit: 2 });
    expect(t.rows()).toEqual([
      ["A (3)", "", ""],
      ["B (2)", "", ""],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("a totals row over a server's pages: every row loads, the totals are the data's", async () => {
    stubServer();
    const t = await openTable(remote("template"));
    aggregate(t, "status");
    t.h.workspace.execute(
      catalogTableTotalsCommand(
        t.h.workspace.runtime.graph,
        t.id,
        true,
        t.h.workspace.newId,
      ),
    );
    t.h.flush();
    await settle();
    // (The footer's sum: 2 + 1 + 3 + 5 + 4 = 15 — the first page alone is 3.)
    expect(t.rows("tfoot").map((cells) => cells.at(-1))).toEqual(["15"]);
    expect(t.rows().length).toBe(5);
    t.h.view.unmount();
  }, 120_000);

  it("a tree by a parent field over a server's pages: a child on a later page is under its parent", async () => {
    // (r2's child c1 is on the third page — the first page holds r1 · r2.)
    const TREE = [
      { id: "r1", name: "Root one", type: "A", status: 1, parent: null },
      { id: "r2", name: "Root two", type: "B", status: 2, parent: null },
      { id: "r3", name: "Root three", type: "A", status: 3, parent: null },
      { id: "c0", name: "Child zero", type: "A", status: 4, parent: "r1" },
      { id: "c1", name: "Child one", type: "B", status: 5, parent: "r2" },
    ];
    stubServer(TREE);
    const t = await openTable(
      remote("template", {
        schema: [...SCHEMA, { id: "f-parent", key: "parent", type: "string" }],
      }),
      { parentId: "f-parent" },
    );
    expect(t.h.session.tables.tableSliceServable(t.table().id, "tree")).toEqual(
      {
        accepts: "loaded",
        reason: "treeIndex",
      },
    );
    await t.set({ expandedKeys: "all" });
    expect(t.rows().map((cells) => cells[0])).toEqual([
      "Root one",
      "Child zero",
      "Root two",
      "Child one",
      "Root three",
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("a paged list (「Pages」) of a grouped Table pages the data's groups, not one server page's", async () => {
    stubServer();
    const t = await openTable(remote("template"));
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "pages", size: 1 }));
    t.h.flush();
    await settle();
    await t.set({ grouping: ["type"] });
    // (One group a page: B has 2 rows in the data — the server's first page has one B.)
    expect(t.rows()).toEqual([["B (2)", "", ""]]);
    await act(() => t.h.session.goToPage(t.id, 2));
    await settle();
    expect(t.rows()).toEqual([["A (3)", "", ""]]);
    expect(t.h.session.pageOf(t.id)?.count).toBe(2);
    t.h.view.unmount();
  }, 120_000);

  it("past the cap the Table shows no rows and says so — never the loaded part", async () => {
    stubServer(ROWS, 20_000);
    const t = await openTable(remote("template"));
    await t.set({ grouping: ["type"] });
    expect(t.rows()).toEqual([]);
    expect(t.h.session.viewRefusals.get("users")).toBe(20_000);
    t.h.view.unmount();
  }, 120_000);

  it("a flat Table on the same pages still reads one page (a sort loads nothing more)", async () => {
    const requests = stubServer();
    const t = await openTable(remote({ kind: "suffix", pageSize: 2 }));
    await t.set({ sort: [{ column: "name", direction: "ascending" }] });
    expect(requests.some((request) => request.search.includes("_page=2"))).toBe(
      false,
    );
    expect(t.rows().map((cells) => cells[0])).toEqual(["Ara", "Bora"]);
    t.h.view.unmount();
  }, 120_000);
});

describe("5g-2 — a server's pages and pinned rows: asked for by key (§4.3.3)", () => {
  const PINNABLE = { allowsRowPinning: true };

  it("a body format with 「Rows by key」: the page leaves the pinned row out, its own request brings it", async () => {
    const requests = stubServer();
    const t = await openTable(
      remote({ kind: "body", pageSize: 2, keyRows: true }, { method: "POST" }),
    );
    await t.declare(PINNABLE);
    expect(t.h.session.tables.tableSliceServable(t.table().id, "pins")).toEqual(
      {
        accepts: "whole",
      },
    );
    expect(t.table().props._rowPinnable).toBe(true);
    // Dana (s4) is on the second page.
    await t.pin("s4", "top");
    const page = requests.filter((request) => request.body?.keys?.except);
    const pinned = requests.filter((request) => request.body?.keys?.only);
    expect(page.at(-1)!.body!.keys).toEqual({ field: "id", except: ["s4"] });
    expect(page.at(-1)!.body!.page).toEqual({ limit: 2 });
    // (The pinned rows' request: those keys, no page — the answer is those rows.)
    expect(pinned.at(-1)!.body!.keys).toEqual({ field: "id", only: ["s4"] });
    expect(pinned.at(-1)!.body!.page).toBeUndefined();
    expect(t.pinnedRows()).toEqual([
      ["s4", "top"],
      ["s1", null],
      ["s2", null],
    ]);
    // Unpinned: no slice — the endpoint as authored (no view: no page parameters), every row.
    act(() => t.h.session.tables.pinTableRow(t.table().id, "s4", null));
    await settle();
    expect(requests.at(-1)!.body?.keys).toBeUndefined();
    expect(t.pinnedRows()).toEqual(
      ["s1", "s2", "s3", "s4", "s5"].map((key) => [key, null]),
    );
    t.h.view.unmount();
  }, 120_000);

  it("the pinned rows' request has the Table's filter — under 「Keep pinned rows」 it has none", async () => {
    const requests = stubServer();
    const t = await openTable(
      remote({ kind: "body", pageSize: 2, keyRows: true }, { method: "POST" }),
    );
    await t.declare(PINNABLE);
    await t.set({
      columnFilters: [{ column: "status", condition: { op: "gte", value: 3 } }],
    });
    // Bora (s1, status 2) does not pass the filter: pinned, not shown.
    await t.pin("s1", "bottom");
    const pinned = () =>
      requests.filter((request) => request.body?.keys?.only).at(-1)!.body!;
    expect(pinned().where).toEqual({
      op: "and",
      items: [{ fields: ["status"], op: "gte", value: 3 }],
    });
    expect(t.pinnedRows()).toEqual([
      ["s3", null],
      ["s4", null],
    ]);
    await t.declare({ keepPinnedRows: true });
    expect(pinned().where).toBeUndefined();
    expect(t.pinnedRows()).toEqual([
      ["s3", null],
      ["s4", null],
      ["s1", "bottom"],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("a key is an identity, not a condition: 「k1」 pins k1 only — not 「K1」", async () => {
    const CASES = [
      { id: "K1", name: "Upper", type: "A", status: 1 },
      { id: "x2", name: "Other", type: "A", status: 2 },
      { id: "k1", name: "Lower", type: "B", status: 3 },
    ];
    const requests = stubServer(CASES);
    const t = await openTable(
      remote({ kind: "body", pageSize: 1, keyRows: true }, { method: "POST" }),
    );
    await t.declare(PINNABLE);
    await t.pin("k1", "top");
    // (No condition on the key field: a `where` would fold case — `equals` · `oneOf` read 「K1」 as
    //  「k1」, §4.3.3.)
    expect(requests.some((request) => request.body?.where)).toBe(false);
    expect(t.pinnedRows()).toEqual([
      ["k1", "top"],
      ["K1", null],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("a number key goes as the number — 5 is not the text 「5」", async () => {
    const NUMBERED = ROWS.map((row, index) => ({ ...row, id: index + 1 }));
    const requests = stubServer(NUMBERED);
    const t = await openTable(
      remote(
        { kind: "body", pageSize: 2, keyRows: true },
        {
          method: "POST",
          schema: SCHEMA.map((field) =>
            field.key === "id" ? { ...field, type: "number" } : field,
          ),
        },
      ),
    );
    await t.declare(PINNABLE);
    await t.pin("5", "top");
    expect(
      requests.filter((request) => request.body?.keys?.only).at(-1)!.body!.keys,
    ).toEqual({ field: "id", only: [5] });
    expect(t.pinnedRows().map((row) => row[0])).toEqual(["5", "1", "2"]);
    t.h.view.unmount();
  }, 120_000);

  it("a suffix format with the key parameters: one parameter a key, the pinned rows' request has no page", async () => {
    const requests = stubServer();
    const t = await openTable(
      remote({
        kind: "suffix",
        pageSize: 2,
        keyOnlyParam: "pin",
        keyExceptParam: "unpin",
      }),
    );
    await t.declare(PINNABLE);
    await t.pin("s5", "bottom");
    await t.pin("s4", "top");
    expect(requests.map((request) => request.search)).toEqual(
      expect.arrayContaining([
        "?unpin=s4&unpin=s5&_page=1&_limit=2",
        "?pin=s4&pin=s5",
      ]),
    );
    expect(t.pinnedRows()).toEqual([
      ["s4", "top"],
      ["s1", null],
      ["s2", null],
      ["s5", "bottom"],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("an endpoint that names no request by key: the Table pins no row — no row menu, no state", async () => {
    stubServer();
    const t = await openTable(
      remote({ kind: "body", pageSize: 2 }, { method: "POST" }),
    );
    await t.declare(PINNABLE);
    expect(t.h.session.tables.tableSliceServable(t.table().id, "pins")).toEqual(
      {
        accepts: "none",
        reason: "noKeyRows",
      },
    );
    expect(t.table().props._rowPinnable).toBeUndefined();
    await t.pin("s4", "top");
    expect(
      t.h.session.tables.tableState(t.table().id).pinnedRows,
    ).toBeUndefined();
    expect(t.pinnedRows().every((row) => row[1] === null)).toBe(true);
    t.h.view.unmount();
  }, 120_000);

  it("a server's 「Pages」 list pins no row — a page's own request carries no view", async () => {
    stubServer();
    const t = await openTable(
      remote({ kind: "body", pageSize: 2, keyRows: true }, { method: "POST" }),
    );
    await t.declare(PINNABLE);
    expect(t.table().props._rowPinnable).toBe(true);
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "pages", size: 2 }));
    t.h.flush();
    await settle();
    expect(t.table().props._rowPinnable).toBeUndefined();
    await t.pin("s4", "top");
    expect(
      t.h.session.tables.tableState(t.table().id).pinnedRows,
    ).toBeUndefined();
    t.h.view.unmount();
  }, 120_000);

  it("a server that ignores `keys` answers every row: said, and only the pinned key's row is pinned", async () => {
    stubServer(ROWS, undefined, true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = await openTable(
      remote({ kind: "body", pageSize: 2, keyRows: true }, { method: "POST" }),
    );
    await t.declare(PINNABLE);
    await t.pin("s4", "top");
    expect(
      warn.mock.calls.some((call) =>
        /pinned rows' request \(1 keys\) was answered with 5 rows/.test(
          String(call[0]),
        ),
      ),
    ).toBe(true);
    // (The page is the server's — it ignored `except` too: s4 is on page 2, not this one.)
    expect(t.pinnedRows()).toEqual([
      ["s4", "top"],
      ["s1", null],
      ["s2", null],
    ]);
    t.h.view.unmount();
  }, 120_000);
});

describe("5g-3 — a server's groups: the group query, an open group's rows, the totals row (§4.3.2)", () => {
  const GROUPED = { kind: "body", pageSize: 2, groupRows: true };
  const groupRequests = (requests: Request[]) =>
    requests.filter((request) => request.body?.group);
  const childRequests = (requests: Request[]) =>
    requests.filter((request) => request.body?.groupOf);
  /** A group row's chevron pressed (its grouped cell's expand button). */
  const toggle = async (
    t: Awaited<ReturnType<typeof openTable>>,
    label: string,
  ) => {
    const row = [
      ...t.h.view.container.querySelectorAll('[role="row"][aria-expanded]'),
    ].find((item) => (item.textContent ?? "").includes(label))!;
    act(() => {
      fireEvent.click(row.querySelector('[slot="chevron"]') as HTMLElement);
    });
    await settle();
  };

  it("the groups are the server's group query; opening one asks for its rows (`groupOf`) — not a page of rows grouped here", async () => {
    const requests = stubServer();
    const t = await openTable(remote(GROUPED, { method: "POST" }));
    expect(
      t.h.session.tables.tableSliceServable(t.table().id, "grouping"),
    ).toEqual({
      accepts: "whole",
    });
    aggregate(t, "status");
    await settle();
    await t.set({ grouping: ["type"] });
    expect(groupRequests(requests).at(-1)!.body!.group).toEqual({
      by: ["type"],
      aggregates: [
        { fn: "count", as: "groupRowCount" },
        { fn: "sum", field: "status", as: "status" },
      ],
    });
    // (No page of raw rows was asked for after the grouping — every request since is a group's.)
    expect(requests.slice(-1).every((request) => request.body?.group)).toBe(
      true,
    );
    // The server's group rows (its page: two groups) — its counts and sums.
    expect(t.rows()).toEqual([
      ["B (2)", "", "5"],
      ["A (3)", "", "10"],
    ]);
    await toggle(t, "B (2)");
    const child = childRequests(requests).at(-1)!.body!;
    expect(child.groupOf).toEqual({ by: ["type"], values: ["B"] });
    expect(child.group).toBeUndefined();
    expect(t.rows()).toEqual([
      ["B (2)", "", "5"],
      ["B", "Bora", "2"],
      ["B", "Ara", "3"],
      ["A (3)", "", "10"],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("a group is an identity: 「a」's rows are not 「A」's, and null is not 「」", async () => {
    const CASES = [
      { id: "u1", name: "Up", type: "A", status: 1 },
      { id: "l1", name: "Low", type: "a", status: 2 },
      { id: "n1", name: "Null", type: null, status: 3 },
      { id: "e1", name: "Empty", type: "", status: 4 },
      { id: "l2", name: "Low two", type: "a", status: 5 },
    ];
    const requests = stubServer(CASES);
    const t = await openTable(
      remote({ ...GROUPED, pageSize: 10 }, { method: "POST" }),
    );
    await t.set({
      grouping: ["type"],
      expandedKeys: ['group:["a"]', "group:[null]"],
    });
    const asked = childRequests(requests).map(
      (request) => request.body!.groupOf!.values,
    );
    expect(asked).toEqual(expect.arrayContaining([["a"], [null]]));
    // (No condition stands in for the group — `equals "a"` would fold 「A」 in, `notExists` 「」.)
    expect(
      childRequests(requests).every((request) => !request.body!.where),
    ).toBe(true);
    expect(t.rows().map((cells) => cells[1])).toEqual([
      "",
      "",
      "Low",
      "Low two",
      "",
      "Null",
      "",
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("two levels: an open group's children are the next level's group query, an open sub-group's its rows", async () => {
    const requests = stubServer();
    const t = await openTable(remote(GROUPED, { method: "POST" }));
    await t.set({
      grouping: ["type", "status"],
      expandedKeys: ['group:["A"]', 'group:["A",5]'],
    });
    const children = childRequests(requests).map((request) => request.body!);
    expect(children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupOf: { by: ["type"], values: ["A"] },
          group: expect.objectContaining({ by: ["status"] }),
        }),
        expect.objectContaining({
          groupOf: { by: ["type", "status"], values: ["A", 5] },
        }),
      ]),
    );
    // (The grouped Columns stand first: Type · Status · Name. A's sub-groups are the server's
    //  status groups — 1 · 5 · 4 in its sorted rows' order; A / 5's row is Dana.)
    expect(t.rows()).toEqual([
      ["B (2)", "", ""],
      ["A (3)", "", ""],
      ["", "1 (1)", ""],
      ["", "5 (1)", ""],
      ["A", "5", "Dana"],
      ["", "4 (1)", ""],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("a totals row is a group query without fields — the server's, over the Table's filter — and the rows stay one page", async () => {
    const requests = stubServer();
    const t = await openTable(remote(GROUPED, { method: "POST" }));
    aggregate(t, "status");
    t.h.workspace.execute(
      catalogTableTotalsCommand(
        t.h.workspace.runtime.graph,
        t.id,
        true,
        t.h.workspace.newId,
      ),
    );
    t.h.flush();
    await settle();
    await t.set({
      columnFilters: [{ column: "status", condition: { op: "gte", value: 3 } }],
      sort: [{ column: "name", direction: "ascending" }],
    });
    const totals = groupRequests(requests).at(-1)!.body!;
    // (One row has no order: no sort goes with it.)
    expect(totals.sort).toBeUndefined();
    expect(totals.group).toEqual({
      by: [],
      aggregates: [{ fn: "sum", field: "status", as: "status" }],
    });
    expect(totals.where).toEqual({
      op: "and",
      items: [{ fields: ["status"], op: "gte", value: 3 }],
    });
    // (3 + 5 + 4 = 12 — the server's; the page here has two rows.)
    expect(t.rows("tfoot").map((cells) => cells.at(-1))).toEqual(["12"]);
    expect(t.rows().length).toBe(2);
    expect(
      requests.some((request) => request.body?.page?.cursor !== undefined),
    ).toBe(false);
    t.h.view.unmount();
  }, 120_000);

  it("the next page of groups (`loadMore`): its open groups' rows are asked for too", async () => {
    const requests = stubServer();
    const t = await openTable(
      remote({ ...GROUPED, pageSize: 1 }, { method: "POST" }),
    );
    await t.set({ grouping: ["type"], expandedKeys: "all" });
    expect(t.rows().map((cells) => cells[0])).toEqual(["B (2)", "B", "B"]);
    await act(() => t.h.session.loadMore("users"));
    await settle();
    // (Every page of an open group's rows: a page of 1 — B's 2 rows are two requests, A's 3 three.)
    expect(
      childRequests(requests).map((request) => request.body!.groupOf!.values),
    ).toEqual([["B"], ["B"], ["A"], ["A"], ["A"]]);
    expect(t.rows().map((cells) => cells[0])).toEqual([
      "B (2)",
      "B",
      "B",
      "A (3)",
      "A",
      "A",
      "A",
    ]);
    t.h.view.unmount();
  }, 120_000);

  /** The mock server whose answers wait while `held` says so — until `release()`. */
  function gatedServer(held: (body: MockBodyRequest) => boolean) {
    const requests: Request[] = [];
    let gate: (() => void) | undefined;
    let open = new Promise<void>((resolve) => (gate = resolve));
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      requests.push({ search: "", body });
      if (held(body)) await open;
      return new Response(JSON.stringify(answerBody(ROWS, body)), {
        headers: { "content-type": "application/json" },
      });
    });
    return {
      requests,
      release: async () => {
        gate!();
        open = new Promise<void>((resolve) => (gate = resolve));
        await settle();
      },
    };
  }

  it("groups not answered yet: no rows but the load — never the rows held grouped here", async () => {
    const server = gatedServer((body) => !!body.group);
    const t = await openTable(remote(GROUPED, { method: "POST" }));
    expect(t.rows().map((cells) => cells[0])).toEqual([
      "Bora",
      "Chan",
      "Ara",
      "Dana",
      "Eun",
    ]);
    await t.set({ grouping: ["type"] });
    // (The group query waits: the rows held are a page — grouping them would say B 1 · A 1.)
    expect(t.rows()).toEqual([]);
    await server.release();
    expect(t.rows().map((cells) => cells[0])).toEqual(["B (2)", "A (3)"]);
    t.h.view.unmount();
  }, 120_000);

  it("another state's groups: an open group's old rows are not shown under the new group row", async () => {
    let holdChildren = false;
    const server = gatedServer((body) => holdChildren && !!body.groupOf);
    const t = await openTable(remote(GROUPED, { method: "POST" }));
    await t.set({ grouping: ["type"], expandedKeys: ['group:["B"]'] });
    expect(t.rows().map((cells) => cells[1])).toEqual(["", "Bora", "Ara", ""]);
    holdChildren = true;
    // (Status ≥ 3: B is Ara alone — Bora's 2 is out. B's rows' request waits.)
    await t.set({
      columnFilters: [{ column: "status", condition: { op: "gte", value: 3 } }],
    });
    expect(t.rows()[0]![0]).toBe("B (1)");
    expect(t.rows().map((cells) => cells[1])).not.toContain("Bora");
    await server.release();
    expect(t.rows().map((cells) => cells[1])).toEqual(["", "Ara", ""]);
    t.h.view.unmount();
  }, 120_000);

  it("the open groups' rows are asked for at once — not each after the one before has answered", async () => {
    // (2026-11-25 효율 측정 5번: one after another, 12 open groups at 100 ms an answer kept a
    //  sort's rows waiting 2.8 s.)
    let holdChildren = false;
    const server = gatedServer((body) => holdChildren && !!body.groupOf);
    const t = await openTable(remote(GROUPED, { method: "POST" }));
    holdChildren = true;
    await t.set({
      grouping: ["type"],
      expandedKeys: ['group:["B"]', 'group:["A"]'],
    });
    // (Both groups' requests are out while neither has answered.)
    expect(
      childRequests(server.requests).map(
        (request) => request.body!.groupOf!.values,
      ),
    ).toEqual([["B"], ["A"]]);
    // (A's next page is not held — its rows are three, two a page.)
    holdChildren = false;
    await server.release();
    expect(t.rows().map((cells) => cells[1])).toEqual([
      "",
      "Bora",
      "Ara",
      "",
      "Chan",
      "Dana",
      "Eun",
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("an open group whose rows' answer is not its count: the group query once more, then its row says so", async () => {
    // (A server that ignores `groupOf`: B's rows are all five.)
    const requests: Request[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ search: "", body });
      const { groupOf: _ignored, ...rest } = body ?? {};
      return new Response(JSON.stringify(answerBody(ROWS, rest)), {
        headers: { "content-type": "application/json" },
      });
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = await openTable(
      remote({ ...GROUPED, pageSize: 10 }, { method: "POST" }),
    );
    await t.set({ grouping: ["type"], expandedKeys: ['group:["B"]'] });
    await settle();
    // (Asked twice for the groups — the second after the count did not match.)
    expect(
      groupRequests(requests).filter((request) => !request.body!.groupOf)
        .length,
    ).toBeGreaterThanOrEqual(2);
    expect(t.rows()[0]![0]).toBe("B (2 ≠ 5)");
    expect(
      warn.mock.calls.some((call) =>
        /counts 2 rows, the server's answer to its rows has 5/.test(
          String(call[0]),
        ),
      ),
    ).toBe(true);
    t.h.view.unmount();
  }, 120_000);

  it("an aggregate the endpoint does not run: no group query — every row loads and groups here", async () => {
    const requests = stubServer();
    const t = await openTable(remote(GROUPED, { method: "POST" }));
    t.h.workspace.execute(
      setFields({
        targets: [
          t.h.workspace.positionOfRecord(t.column("status").id)!.target,
        ],
        props: { aggregate: { kind: "set", value: "median" } },
      }),
    );
    t.h.flush();
    await settle();
    expect(
      t.h.session.tables.tableSliceServable(t.table().id, "grouping"),
    ).toEqual({
      accepts: "loaded",
      reason: "aggregateNotRun",
    });
    await t.set({ sort: [{ column: "name", direction: "ascending" }] });
    await t.set({ grouping: ["type"] });
    expect(groupRequests(requests)).toEqual([]);
    // (median: B 2.5 · A 4 — the five rows'.)
    expect(t.rows()).toEqual([
      ["B (2)", "", "2.5"],
      ["A (3)", "", "4"],
    ]);
    t.h.view.unmount();
  }, 120_000);
});
