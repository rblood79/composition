import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataCollectionId,
  NodeId,
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { runViewQueries } from "../../../../../../packages/shared/src/collections/view/evaluate";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogResultCountCommand } from "../../../builder/catalogRuntime/viewAuthoring";
import { addView } from "../../../../../../packages/shared/src/catalog/commands";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-284 G2 — a view an API endpoint carries. The mock server is a separate implementation of the
 * formats (json-server's suffix parameters · a body tree), never the serializer: what it answers
 * for the request must equal the local evaluator over the whole data (walkthrough tasks ① ② ④ ⑤
 * as parameters, ⑥ as a body). Also: the server's total · completeness, a variable write starting
 * a new query (no cursor · total carried over), the 300 ms pause for text, a late answer dropped,
 * and the conditions a format cannot carry reported (never applied again on the client).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const USERS = "data:collection:users" as DataCollectionId;
const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-gender", key: "gender", type: "string" },
  { id: "f-age", key: "age", type: "number" },
  { id: "f-status", key: "status", type: "string" },
  { id: "f-joined", key: "joined", type: "date" },
] as const;
type Row = {
  id: string;
  name: string;
  gender: string;
  age: number;
  status: string;
  joined: string;
};
const ROWS: Row[] = [
  ["Kim", "male", 31, "open", "2026-09-20"],
  ["Park", "female", 24, "closed", "2026-10-02"],
  ["Lee", "male", 22, "open", "2026-10-09"],
  ["Choi", "female", 35, "open", "2026-10-15"],
  ["Jung", "male", 28, "closed", "2026-10-21"],
  ["Kang", "female", 19, "open", "2026-11-03"],
  ["Cho", "male", 41, "open", "2026-10-30"],
  ["Yoon", "female", 27, "closed", "2026-09-28"],
].map(([name, gender, age, status, joined], index) => ({
  id: `u${index + 1}`,
  name: name as string,
  gender: gender as string,
  age: age as number,
  status: status as string,
  joined: joined as string,
}));
const NAMES = new RegExp(ROWS.map((row) => row.name).join("|"));

const VAR = (id: string) => `!var.data:variable:${id}`;
const condition = (
  id: string,
  op: ViewCondition["op"],
  field: string,
  patch: Partial<ViewCondition> = {},
): ViewCondition => ({ id, fields: [[`data:field:${field}`]], op, ...patch });
const where = (items: ViewConditionGroup["items"]): ViewConditionGroup => ({
  id: "where",
  op: "and",
  items,
});

/** ① gender (radio, 「all」 skips) ② name contains ④ joined range ⑤ hide closed (checkbox). */
const SUFFIX_VIEW: ViewQuery = {
  where: where([
    condition("gender", "equals", "f-gender", {
      value: VAR("g"),
      skip: "all",
    }),
    condition("search", "contains", "f-name", { value: VAR("q") }),
    condition("joined", "between", "f-joined", {
      value: [VAR("from"), VAR("to")],
    }),
    condition("open", "notEquals", "f-status", {
      value: "closed",
      enabled: VAR("hide"),
    }),
  ]),
  sort: { field: ["data:field:f-age"], direction: "ascending" },
};
/** ⑥ search AND (female OR age < 25). */
const EITHER: ViewConditionGroup = {
  id: "either",
  op: "or",
  items: [
    condition("female", "equals", "f-gender", { value: "female" }),
    condition("young", "lt", "f-age", { value: 25 }),
  ],
};
const BODY_VIEW: ViewQuery = {
  where: where([
    condition("search", "contains", "f-name", { value: VAR("q") }),
    EITHER,
  ]),
};
const VARIABLES = [
  { id: "g", name: "g", type: "string" as const, defaultValue: "all" },
  { id: "q", name: "q", type: "string" as const, defaultValue: "" },
  { id: "from", name: "from", type: "string" as const, defaultValue: "" },
  { id: "to", name: "to", type: "object" as const, defaultValue: null },
  { id: "hide", name: "hide", type: "boolean" as const, defaultValue: false },
];

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
/** Past the text pause (300 ms). */
const pause = async () => {
  await act(() => new Promise((r) => setTimeout(r, 350)));
  await settle();
};

/** The local evaluator over the whole data, with the same values. */
function expected(view: ViewQuery, values: Record<string, unknown>) {
  return runViewQueries(ROWS, {
    queries: [view],
    schema: SCHEMA,
    resolve: (value) =>
      typeof value === "string" && value.startsWith("!var.")
        ? { value: values[value.slice("!var.data:variable:".length)] }
        : { value },
  }).rows.map((row) => (row as Row).name);
}

// ── The mock server: json-server's suffixes and a body tree, written apart from the serializer ──

const day = (value: unknown) =>
  value && typeof value === "object"
    ? (() => {
        const { year, month, day } = value as Record<string, number>;
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      })()
    : String(value);
/** json-server compares numbers as numbers, anything else as text. */
function order(a: unknown, b: string) {
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && b !== ""
    ? x - y
    : String(a).localeCompare(b);
}
function suffixFilter(rows: Row[], params: URLSearchParams): Row[] {
  const keys = new Set([...params.keys()]);
  let out = rows;
  for (const param of keys) {
    if (param.startsWith("_") || param === "page") continue;
    const values = params.getAll(param);
    const match = /^(.*?)(_ne|_like|_gte|_gt|_lte|_lt)?$/.exec(param)!;
    const field = match[1] as keyof Row;
    const suffix = match[2];
    out = out.filter((row) => {
      const cell = row[field];
      switch (suffix) {
        case "_ne":
          return values.every((value) => String(cell) !== value);
        case "_like":
          return values.every((value) =>
            new RegExp(value, "i").test(String(cell)),
          );
        case "_gte":
          return order(cell, values[0]!) >= 0;
        case "_gt":
          return order(cell, values[0]!) > 0;
        case "_lte":
          return order(cell, values[0]!) <= 0;
        case "_lt":
          return order(cell, values[0]!) < 0;
        default:
          return values.includes(String(cell));
      }
    });
  }
  const sort = params.get("_sort") as keyof Row | null;
  if (sort) {
    out = [...out].sort((a, b) => order(a[sort], String(b[sort])));
    if (params.get("_order") === "desc") out.reverse();
  }
  return out;
}
type Tree =
  | { op: "and" | "or"; items: Tree[] }
  | { fields: (keyof Row)[]; op: string; value?: unknown };
function bodyMatch(row: Row, tree: Tree): boolean {
  if ("items" in tree)
    return tree.op === "or"
      ? tree.items.some((item) => bodyMatch(row, item))
      : tree.items.every((item) => bodyMatch(row, item));
  return tree.fields.some((field) => {
    const cell = row[field];
    const value = tree.value;
    switch (tree.op) {
      case "equals":
        return String(cell) === String(value);
      case "contains":
        return String(cell).toLowerCase().includes(String(value).toLowerCase());
      case "lt":
        return Number(cell) < Number(value);
      default:
        throw new Error(`mock server: ${tree.op}`);
    }
  });
}

interface Request {
  url: URL;
  body?: { where?: Tree };
  signal?: AbortSignal | null;
}
/** Pages of `size` (`?page=`), the answer `{ items, next, total }`; `hold` keeps an answer back. */
function stubServer(size = 100) {
  const requests: Request[] = [];
  const held = new Map<string, () => void>();
  const hold = new Set<string>();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, body, signal: init?.signal });
    const key = `${url.pathname}${url.search}`;
    if (hold.has(key)) await new Promise<void>((r) => held.set(key, r));
    const rows = body
      ? ROWS.filter((row) => !body.where || bodyMatch(row, body.where))
      : suffixFilter(ROWS, url.searchParams);
    const page = Number(url.searchParams.get("page") ?? 1);
    const more = page * size < rows.length;
    return new Response(
      JSON.stringify({
        items: rows.slice((page - 1) * size, page * size),
        next: more ? String(page + 1) : null,
        total: rows.length,
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  const urls = () =>
    requests.map((request) => `${request.url.pathname}${request.url.search}`);
  return { requests, urls, hold, held };
}

async function apiPreview(
  view: ViewQuery,
  endpoint: Record<string, unknown> = {},
  options: { types?: readonly string[]; second?: ViewQuery } = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(options.types ?? ["ListBox", "Button"]);
  const [list, button] = h.ids as [NodeId, NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "users",
          name: "Users",
          schema: SCHEMA.map((field) => ({ ...field })),
          mockData: [],
          // (The Builder's load — what a collection the session does not load shows.)
          runtimeData: ROWS,
          useMockData: false,
        },
      ],
      variables: VARIABLES,
      apiEndpoints: [
        {
          id: "list",
          name: "listUsers",
          baseUrl: "https://api.example.test",
          method: "GET",
          path: "/users",
          targetCollection: "Users",
          responseMapping: { dataPath: "items", totalPath: "total" },
          querySerialization: { kind: "suffix" },
          ...endpoint,
        },
      ],
    } as never);
  });
  const bind = (id: NodeId, query: ViewQuery) =>
    h.workspace.execute(
      catalogBindingCommand([{ kind: "node", id }], {
        ...catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
        view: query,
      }),
    );
  bind(list, view);
  if (options.second) bind(button, options.second);
  h.flush();
  await settle();
  const shown = (id: NodeId = list) =>
    [
      ...(h.element(id)?.querySelectorAll('[role="option"], [role="row"]') ??
        []),
    ]
      .map((item) => NAMES.exec(item.textContent ?? "")?.[0])
      .filter(Boolean);
  /** A variable write — the `setState` rule's path. */
  const write = (id: string, value: unknown) =>
    act(() => {
      h.session.writeState({
        variableId: `data:variable:${id}`,
        op: "set",
        value,
      } as never);
    });
  return { ...h, list, button, shown, write };
}

describe("ADR-284 G2 — the server answers the view as the local evaluator would", () => {
  it("suffix parameters (① ② ④ ⑤ + the sort): each setting's rows equal the local run over the whole data", async () => {
    const server = stubServer();
    const h = await apiPreview(SUFFIX_VIEW);
    const settings: Record<string, unknown>[] = [
      { g: "all", q: "", from: "", to: null, hide: false },
      { g: "female", q: "", from: "", to: null, hide: false },
      { g: "all", q: "o", from: "", to: null, hide: false },
      {
        g: "all",
        q: "",
        from: "2026-10-01",
        to: { year: 2026, month: 10, day: 21 },
        hide: false,
      },
      { g: "all", q: "", from: "", to: null, hide: true },
      {
        g: "male",
        q: "n",
        from: "2026-10-01",
        to: { year: 2026, month: 10, day: 31 },
        hide: true,
      },
    ];
    let previous: Record<string, unknown> = settings[0]!;
    for (const values of settings) {
      for (const [id, value] of Object.entries(values))
        if (previous[id] !== value) h.write(id, value);
      previous = values;
      await pause();
      const want = expected(SUFFIX_VIEW, values);
      expect(h.shown(), JSON.stringify(values)).toEqual(want);
      expect(h.session.viewResult(h.list)).toMatchObject({
        served: true,
        total: want.length,
        complete: true,
      });
    }
    // (The last setting as parameters — the mock server read these, not the client's filter.)
    expect(server.urls().at(-1)).toBe(
      "/users?gender=male&name_like=n&joined_gte=2026-10-01&joined_lte=2026-10-31&status_ne=closed&_sort=age&_order=asc",
    );
    h.view.unmount();
  });

  it("body JSON (⑥ search AND (female OR age < 25)) on a POST endpoint: the server's tree answer equals the local run", async () => {
    const server = stubServer();
    const h = await apiPreview(BODY_VIEW, {
      method: "POST",
      querySerialization: { kind: "body" },
    });
    for (const q of ["", "o", "K"]) {
      if (q) h.write("q", q);
      await pause();
      expect(h.shown(), q).toEqual(expected(BODY_VIEW, { q }));
      expect(h.session.viewResult(h.list)).toMatchObject({ served: true });
      expect(h.session.viewResult(h.list)?.unsent).toBeUndefined();
    }
    expect(server.requests.at(-1)!.body).toEqual({
      where: {
        op: "and",
        items: [
          { fields: ["name"], op: "contains", value: "K" },
          {
            op: "or",
            items: [
              { fields: ["gender"], op: "equals", value: "female" },
              { fields: ["age"], op: "lt", value: 25 },
            ],
          },
        ],
      },
    });
    h.view.unmount();
  });

  it("an `or` the suffix format cannot carry is reported, and its rows are the server's (not filtered again)", async () => {
    const server = stubServer();
    const h = await apiPreview(BODY_VIEW);
    h.write("q", "o");
    await pause();
    expect(server.urls().at(-1)).toBe("/users?name_like=o");
    // (The server answered `name_like=o` only — the client does not quietly apply the `or`.)
    expect(h.shown()).toEqual(
      ROWS.filter((row) => /o/i.test(row.name)).map((row) => row.name),
    );
    expect(h.session.viewResult(h.list)).toMatchObject({
      served: true,
      unsent: 1,
    });
    h.view.unmount();
  });
});

describe("ADR-284 G2 — a variable write is a new query", () => {
  it("the server's total · completeness; a write drops the cursor and the total of the last query", async () => {
    const server = stubServer(2);
    const h = await apiPreview(SUFFIX_VIEW, {
      queryParams: [{ key: "page", value: "{{ cursor }}" }],
      responseMapping: {
        dataPath: "items",
        cursorPath: "next",
        totalPath: "total",
      },
    });
    // (The data arrived before the binding: its first load is the plain one, then the view's.)
    expect(server.urls()).toEqual(["/users", "/users?_sort=age&_order=asc"]);
    expect(h.session.viewResult(h.list)).toMatchObject({
      served: true,
      matched: 2,
      total: 8,
      complete: false,
    });
    h.rule(h.button, "onPress", { opcode: "loadMore", collectionId: USERS });
    act(() => {
      fireEvent.click(h.element(h.button)!);
    });
    await settle();
    expect(server.urls().at(-1)).toBe("/users?page=2&_sort=age&_order=asc");
    expect(h.session.viewResult(h.list)).toMatchObject({
      matched: 4,
      total: 8,
    });
    h.write("g", "female");
    await settle();
    // (No page: the new query starts over; its total is its own.)
    expect(server.urls().at(-1)).toBe(
      "/users?gender=female&_sort=age&_order=asc",
    );
    expect(h.session.viewResult(h.list)).toMatchObject({
      matched: 2,
      total: 4,
      complete: false,
    });
    expect(h.shown()).toEqual(
      expected(SUFFIX_VIEW, {
        g: "female",
        q: "",
        from: "",
        to: null,
        hide: false,
      }).slice(0, 2),
    );
    h.view.unmount();
  });

  it("a text condition's writes wait 300 ms (one request for the last text); another write loads at once", async () => {
    const server = stubServer();
    const h = await apiPreview(SUFFIX_VIEW);
    expect(server.urls()).toHaveLength(1);
    h.write("q", "K");
    h.write("q", "Ki");
    h.write("q", "Kim");
    await settle();
    expect(server.urls()).toHaveLength(1);
    await pause();
    expect(server.urls()).toEqual([
      "/users?_sort=age&_order=asc",
      "/users?name_like=Kim&_sort=age&_order=asc",
    ]);
    expect(h.shown()).toEqual(["Kim"]);
    h.write("hide", true);
    await settle();
    expect(server.urls().at(-1)).toBe(
      "/users?name_like=Kim&status_ne=closed&_sort=age&_order=asc",
    );
    h.view.unmount();
  });

  it("a newer query aborts the one in flight; its late answer is not shown", async () => {
    const server = stubServer();
    const h = await apiPreview(SUFFIX_VIEW);
    server.hold.add("/users?gender=male&_sort=age&_order=asc");
    h.write("g", "male");
    await settle();
    // (Another query of the same rows: S2's `filtering`, not a first `loading`.)
    expect(
      (
        h.session as unknown as { loadingStates: Map<string, string> }
      ).loadingStates.get("users"),
    ).toBe("filtering");
    h.write("g", "female");
    await settle();
    const female = expected(SUFFIX_VIEW, {
      g: "female",
      q: "",
      from: "",
      to: "",
      hide: false,
    });
    expect(h.shown()).toEqual(female);
    const late = server.requests.find((request) =>
      request.url.search.includes("gender=male"),
    )!;
    expect(late.signal?.aborted).toBe(true);
    server.held.get("/users?gender=male&_sort=age&_order=asc")!();
    await settle();
    expect(h.shown()).toEqual(female);
    h.view.unmount();
  });

  it("two different views on one endpoint: none is sent — each runs on the Builder's loaded rows", async () => {
    const server = stubServer();
    const h = await apiPreview(
      SUFFIX_VIEW,
      {},
      {
        types: ["ListBox", "GridList"],
        second: { where: where([EITHER]) },
      },
    );
    expect(server.urls()).toEqual([]);
    h.write("g", "female");
    await settle();
    expect(server.urls()).toEqual([]);
    expect(h.shown()).toEqual(
      expected(SUFFIX_VIEW, {
        g: "female",
        q: "",
        from: "",
        to: null,
        hide: false,
      }),
    );
    expect(h.shown(h.button)).toEqual(expected({ where: where([EITHER]) }, {}));
    expect(h.session.viewResult(h.list)?.served).toBeUndefined();
    h.view.unmount();
  });

  it("a grouped view (G4) is not a request: it counts the loaded rows and never calls them complete", async () => {
    // (Pages of 3: the loaded rows are part of the data until the last page.)
    const server = stubServer(3);
    const h = await apiPreview(SUFFIX_VIEW, {
      queryParams: [{ key: "page", value: "{{ cursor }}" }],
      responseMapping: {
        dataPath: "items",
        totalPath: "total",
        cursorPath: "next",
      },
    });
    server.requests.length = 0;
    const VIEW = "project:view:by-gender";
    act(() => {
      h.workspace.execute(
        addView({
          entry: {
            kind: "view",
            id: VIEW as never,
            name: "By gender",
            source: { collectionId: USERS },
            where: where([]),
            groupBy: [["data:field:f-gender"]],
            aggregates: [{ fn: "count", as: "count" }],
          },
        }),
      );
      h.workspace.execute(
        catalogBindingCommand([{ kind: "node", id: h.list }], {
          ...catalogBindingRef({
            source: "dataTable",
            collectionId: "users",
            name: "Users",
          })!,
          viewId: VIEW as never,
        }),
      );
    });
    h.flush();
    await settle();
    // (No request carries a grouping; the result is the Builder's loaded rows grouped.)
    expect(server.urls().filter((url) => url.includes("gender"))).toEqual([]);
    const result = h.session.viewResult(h.list);
    expect(result?.served).toBeUndefined();
    expect(result?.complete).not.toBe(true);
    // (The first page's 3 rows — Kim · Park · Lee — are 2 male · 1 female, not the 8 rows' 4 · 4.)
    expect(result?.matched).toBe(2);
    expect(result?.loaded).toBe(3);
    h.view.unmount();
  });

  it("「결과 수 표시」 over a view the server answers: the count is the server's total, not the loaded page", async () => {
    const server = stubServer(3);
    const h = await apiPreview(SUFFIX_VIEW, {
      queryParams: [{ key: "page", value: "{{ cursor }}" }],
      responseMapping: {
        dataPath: "items",
        totalPath: "total",
        cursorPath: "next",
      },
    });
    const { command, created } = catalogResultCountCommand(
      h.workspace.runtime.graph,
      { listId: h.list, viewName: "Users view", text: "{count}" },
      h.workspace.newId,
    );
    act(() => {
      h.workspace.execute(command);
    });
    h.flush();
    await settle();
    // (One request — the list's view; the count is a count of it, not another view.)
    expect(server.urls().at(-1)).toBe("/users?_sort=age&_order=asc");
    expect(h.shown()).toHaveLength(3);
    expect(h.element(created.textId)?.textContent?.trim()).toBe("8");
    h.write("g", "female");
    await settle();
    expect(server.urls().at(-1)).toBe(
      "/users?gender=female&_sort=age&_order=asc",
    );
    expect(h.element(created.textId)?.textContent?.trim()).toBe("4");
    h.view.unmount();
  });
});
