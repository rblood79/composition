import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  answerBody,
  answerSuffix,
} from "../../../../scripts/mock-query-server.mjs";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogRemoveTableSearchCommand,
  catalogTableSearchCommand,
  catalogTableSearchRules,
} from "../../../builder/catalogRuntime/viewAuthoring";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 3 (G3) — a Table's search in the Preview: the panel's 「Search」 switch places a
 * SearchField whose text is the Table state's `search`; the rows are the hand-written ones — under
 * a sort, in a page, in a virtual Table — and a Table whose rows are the server's pages sends the
 * search or does not hold it (breakdown §4.3.1 — 리뷰 round 1 H2).
 *
 * Fixture (Name · Type · Status are the Table's Columns):
 *   p1 Bora B 2 · p2 Chan A 1 · p3 Ara B 3 · p4 Dana A 5 · p5 Eun A —
 * 「an」 is in Chan · Dana; 「a」 in every name but Eun — and in Eun's type `A`.
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
const ROWS = [
  { id: "p1", name: "Bora", type: "B", status: 2 },
  { id: "p2", name: "Chan", type: "A", status: 1 },
  { id: "p3", name: "Ara", type: "B", status: 3 },
  { id: "p4", name: "Dana", type: "A", status: 5 },
  { id: "p5", name: "Eun", type: "A", status: null },
];
const USERS = {
  id: "users",
  name: "Users",
  schema: SCHEMA,
  mockData: ROWS,
  useMockData: true,
};

async function openTable(
  data: Record<string, unknown> = { collections: [USERS] },
  props: Readonly<Record<string, unknown>> = {},
) {
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
  const search = async (text: string) => {
    act(() => h.session.searchTable(table().id, text));
    await settle();
  };
  const state = () => h.session.tableState(table().id);
  return { h, id, table, body, rowKeys, column, search, state };
}

describe("a Table's search (ADR-315 Phase 3)", () => {
  it("the panel's switch places a SearchField whose text searches the Table's rows", async () => {
    const t = await openTable();
    const graph = t.h.workspace.runtime.graph;
    const { command, created } = catalogTableSearchCommand(
      graph,
      { tableId: t.id, label: "Search" },
      t.h.workspace.newId,
    );
    t.h.workspace.execute(command);
    t.h.flush();
    await settle();
    expect(catalogTableSearchRules(graph, t.id).map((rule) => rule.id)).toEqual(
      [created.ruleId],
    );
    // (The SearchField stands before the Table.)
    const input = t.h.view.container.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!;
    const grid = t.h.view.container.querySelector('[role="grid"]')!;
    expect(
      input.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(t.rowKeys()).toEqual(["p1", "p2", "p3", "p4", "p5"]);

    await act(async () => {
      fireEvent.change(input, { target: { value: "an" } });
    });
    await settle();
    expect(t.state()).toEqual({ search: "an" });
    // Chan · Dana
    expect(t.rowKeys()).toEqual(["p2", "p4"]);
    // (The DOM's rows are those two.)
    expect(
      [...t.h.view.container.querySelectorAll('[role="row"]')].filter((row) =>
        row.querySelector('[role="rowheader"], [role="gridcell"]'),
      ).length,
    ).toBe(2);

    await act(async () => {
      fireEvent.change(input, { target: { value: "" } });
    });
    await settle();
    expect(t.state()).toEqual({});
    expect(t.rowKeys()).toEqual(["p1", "p2", "p3", "p4", "p5"]);

    // The switch off: the rule and the SearchField it placed go.
    t.h.workspace.execute(catalogRemoveTableSearchCommand(graph, t.id));
    t.h.flush();
    await settle();
    expect(catalogTableSearchRules(graph, t.id)).toEqual([]);
    expect(t.h.view.container.querySelector('input[type="search"]')).toBeNull();
    t.h.view.unmount();
  }, 120_000);

  it("searches the searchable Columns — a Column that says no is not read", async () => {
    const t = await openTable();
    // 「a」: Bora · Chan · Ara · Dana by name, Eun by its type `A`.
    await t.search("a");
    expect(t.rowKeys()).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    t.h.workspace.execute(
      setFields({
        targets: [t.h.workspace.positionOfRecord(t.column("name").id)!.target],
        props: { allowsSearching: { kind: "set", value: false } },
      }),
    );
    t.h.flush();
    await settle();
    // (Without the names: type `A` — Chan · Dana · Eun.)
    expect(t.rowKeys()).toEqual(["p2", "p4", "p5"]);
    t.h.view.unmount();
  }, 120_000);

  it("filters the sorted rows, and a page · a virtual Table show their rows of the result", async () => {
    const t = await openTable();
    act(() => {
      t.h.session.setTableState(t.table().id, {
        sort: [{ column: "name", direction: "descending" }],
      });
    });
    await settle();
    // Eun · Dana · Chan · Bora · Ara
    expect(t.rowKeys()).toEqual(["p5", "p4", "p2", "p1", "p3"]);
    await t.search("a");
    expect(t.rowKeys()).toEqual(["p5", "p4", "p2", "p1", "p3"]);
    await t.search("ar");
    // 「ar」: Ara only (Bora has `ra`).
    expect(t.rowKeys()).toEqual(["p3"]);

    // Pages of 2 over 「a」 (5 rows): page 2 is Chan · Bora — a search typed goes back to page 1.
    await t.search("a");
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "pages", size: 2 }));
    t.h.flush();
    await settle();
    expect(t.rowKeys()).toEqual(["p5", "p4"]);
    await act(() => t.h.session.goToPage(t.id, 2));
    await settle();
    expect(t.rowKeys()).toEqual(["p2", "p1"]);
    expect(t.h.session.pageOf(t.id)?.count).toBe(3);
    await t.search("an");
    expect(t.h.session.pageOf(t.id)?.page).toBe(1);
    // Dana · Chan — one page.
    expect(t.rowKeys()).toEqual(["p4", "p2"]);
    expect(t.h.session.pageOf(t.id)?.count).toBe(1);

    // Virtual: the collection's keys are the result's.
    t.h.workspace.execute(setRowDisplay(t.id, { mode: "virtual" }));
    t.h.flush();
    await settle();
    expect(t.body()?.rowWindow?.keys ?? t.rowKeys()).toEqual(["p4", "p2"]);
    t.h.view.unmount();
  }, 120_000);

  it("starts with the authored search text, and a fuzzy Table grades its matches", async () => {
    const t = await openTable(undefined, {
      searchText: "an",
      searchMatch: "fuzzy",
    });
    // (The state took the authored text before the first rows were read.)
    expect(t.state()).toEqual({ search: "an" });
    // Chan · Dana contain it; no other name has a · n in order (Bora · Ara · Eun).
    expect(t.rowKeys()).toEqual(["p2", "p4"]);
    // 「da」: Dana begins with it — no other row.
    await t.search("da");
    expect(t.rowKeys()).toEqual(["p4"]);
    // 「aa」: no name contains it; Ara · Dana have a · a apart (three letters each) — in the
    // rows' own order.
    await t.search("aa");
    expect(t.rowKeys()).toEqual(["p3", "p4"]);
    // (Cleared: every row — the authored text does not come back.)
    await t.search("");
    expect(t.state()).toEqual({});
    expect(t.rowKeys()).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    t.h.view.unmount();
  }, 120_000);
});

describe("a Table's column filters (ADR-315 Phase 3)", () => {
  it("keeps the rows each filter passes, joined with the search — one filter a Column", async () => {
    const t = await openTable();
    const filter = async (filters: readonly object[]) => {
      act(() => {
        t.h.session.setTableState(t.table().id, { columnFilters: filters });
      });
      await settle();
    };
    // status ≥ 2: Bora (2) · Ara (3) · Dana (5) — Eun has none.
    await filter([{ column: "status", condition: { op: "gte", value: 2 } }]);
    expect(t.rowKeys()).toEqual(["p1", "p3", "p4"]);
    // … and type A: Dana.
    await filter([
      { column: "status", condition: { op: "gte", value: 2 } },
      { column: "type", condition: { op: "equals", value: "a" } },
    ]);
    expect(t.rowKeys()).toEqual(["p4"]);
    // (The same Column again: its later condition stands — status ≤ 2: Bora · Chan.)
    await filter([
      { column: "status", condition: { op: "gte", value: 2 } },
      { column: "status", condition: { op: "lte", value: 2 } },
    ]);
    expect(t.state().columnFilters).toEqual([
      { column: "status", condition: { op: "lte", value: 2 } },
    ]);
    expect(t.rowKeys()).toEqual(["p1", "p2"]);
    // … with 「an」: Chan.
    await t.search("an");
    expect(t.rowKeys()).toEqual(["p2"]);
    // (No status: Eun — an empty value's own comparison.)
    await t.search("");
    await filter([{ column: "status", condition: { op: "notExists" } }]);
    expect(t.rowKeys()).toEqual(["p5"]);
    await filter([]);
    expect(t.state()).toEqual({});
    expect(t.rowKeys()).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    t.h.view.unmount();
  }, 120_000);
});

describe("a Table's search on the server's pages (리뷰 round 1 H2)", () => {
  // A page of 2. 「needle」 is in s1 · s3's names and s4's note: the server's first page is
  // [s1, s3] — the rows here ([s1, s2]) could not give it.
  const REMOTE_ROWS = [
    { id: "s1", name: "needle one", type: "A", status: 1 },
    { id: "s2", name: "two", type: "A", status: 5 },
    { id: "s3", name: "three needle", type: "B", status: 9 },
    { id: "s4", name: "four", type: "needle", status: 3 },
  ];
  function stubServer() {
    const requests: { search: string; body?: Record<string, unknown> }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ search: decodeURIComponent(url.search), body });
      const answer = body
        ? answerBody(REMOTE_ROWS, body)
        : answerSuffix(REMOTE_ROWS, url.searchParams);
      return new Response(
        JSON.stringify({ items: answer.items, total: REMOTE_ROWS.length }),
        { headers: { "content-type": "application/json" } },
      );
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
        runtimeData: REMOTE_ROWS,
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
  /** A search typed on a remote Table waits 300 ms for its request (the newest text wins). */
  const typed = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

  it("a suffix format with a search parameter sends the text — the page is the server's", async () => {
    const requests = stubServer();
    const t = await openTable(
      remote({ kind: "suffix", pageSize: 2, searchParam: "q" }),
    );
    expect(t.h.session.tableSliceServable(t.table().id, "search")).toEqual({
      accepts: "whole",
    });
    await t.search("need");
    await t.search("needle");
    await typed();
    await settle();
    expect(requests.at(-1)!.search).toBe("?q=needle&_page=1&_limit=2");
    // (Typed on within 300 ms: no request for 「need」.)
    expect(requests.some((request) => request.search.includes("q=need&"))).toBe(
      false,
    );
    expect(t.rowKeys()).toEqual(["s1", "s3"]);
    t.h.view.unmount();
  }, 120_000);

  it("a suffix format without one: the Table holds no search — nothing is sent short", async () => {
    const requests = stubServer();
    const t = await openTable(remote({ kind: "suffix", pageSize: 2 }));
    expect(t.h.session.tableSliceServable(t.table().id, "search")).toEqual({
      accepts: "none",
      reason: "suffixNoSearch",
    });
    const before = requests.length;
    await t.search("needle");
    await typed();
    expect(t.state()).toEqual({});
    expect(requests.length).toBe(before);
    t.h.view.unmount();
  }, 120_000);

  it("a column filter goes as its comparison's parameter — one the format does not name is not held", async () => {
    const requests = stubServer();
    const t = await openTable(remote({ kind: "suffix", pageSize: 2 }));
    act(() => {
      t.h.session.setTableState(t.table().id, {
        columnFilters: [
          { column: "status", condition: { op: "gte", value: 3 } },
        ],
      });
    });
    await settle();
    expect(requests.at(-1)!.search).toBe("?status_gte=3&_page=1&_limit=2");
    // status ≥ 3: s2 (5) · s3 (9) · s4 (3) — the server's page of 2.
    expect(t.rowKeys()).toEqual(["s2", "s3"]);
    // (`startsWith` has no parameter suffix in this format: the state does not take it.)
    const before = requests.length;
    act(() => {
      t.h.session.setTableState(t.table().id, {
        columnFilters: [
          { column: "name", condition: { op: "startsWith", value: "t" } },
        ],
      });
    });
    await settle();
    expect(t.state()).toEqual({});
    // (No request ever named `name`: the filter is not sent in part, nor in another shape.)
    expect(requests.some((request) => request.search.includes("name"))).toBe(
      false,
    );
    expect(requests.length).toBe(before);
    // (The Table holds no slice now: the collection's rows as loaded, unfiltered.)
    expect(t.rowKeys()).toEqual(["s1", "s2", "s3", "s4"]);
    t.h.view.unmount();
  }, 120_000);

  it("a body format carries the search as a condition over the searchable Columns' fields", async () => {
    const requests = stubServer();
    const t = await openTable(remote({ kind: "body", pageSize: 2 }, "POST"));
    await t.search("needle");
    await typed();
    await settle();
    expect(requests.at(-1)!.body!.where).toEqual({
      op: "and",
      items: [
        { fields: ["name", "type", "status"], op: "contains", value: "needle" },
      ],
    });
    // (The mock server's own filter over those fields: s1 · s3 by name, s4 by type — a page of 2.)
    expect(t.rowKeys()).toEqual(["s1", "s3"]);
    t.h.view.unmount();
  }, 120_000);
});
