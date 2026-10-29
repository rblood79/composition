import { act } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type {
  NodeId,
  ViewQuery,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { loadFormulaEngine } from "../../../../../../packages/shared/src/collections/formula/engine";
import { runViewQueries } from "../../../../../../packages/shared/src/collections/view/evaluate";
import { VIEW_LOCAL_LOAD_CAP } from "../../../../../../packages/shared/src/collections/view/serialize";
import { answerBody } from "../../../../scripts/mock-query-server.mjs";
import { addView } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-291 G4 — a view over a computed field on a paged `body` endpoint: `COMPUTED` reported, no
 * `group` (nothing of the view) in the request, every page loaded, the whole chain run here — the
 * review's counterexample `groupBy(raw) + sum(total)` = 42 (two rows `{10,2}` · `{11,2}`); past
 * the row cap the view is refused (no rows, the refusal recorded). And the other side: a grouping
 * over raw fields on a `body` endpoint goes as `group` and the server's group rows are the result.
 */
beforeAll(() => loadFormulaEngine());
afterEach(() => vi.restoreAllMocks());

const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-city", key: "city", type: "string" },
  { id: "f-price", key: "price", type: "number" },
  { id: "f-qty", key: "qty", type: "number" },
  {
    id: "f-total",
    key: "total",
    type: "number",
    formula: "'f-price' * 'f-qty'",
  },
];
const ROWS = [
  ["Kim", "Seoul", 10, 2],
  ["Park", "Seoul", 11, 2],
  ["Lee", "Busan", 5, 1],
  ["Choi", "Busan", 7, 3],
  ["Jung", "Seoul", 1, 1],
].map(([name, city, price, qty], index) => ({
  id: `o${index + 1}`,
  name: name as string,
  city: city as string,
  price: price as number,
  qty: qty as number,
}));
const f = (id: string) => [`data:field:${id}` as const];
const NONE = { id: "where", op: "and" as const, items: [] };
/** `groupBy(city) + sum(total)` — the review's h1 counterexample. */
const SUM_TOTAL: ViewQuery = {
  where: NONE,
  groupBy: [f("f-city")],
  aggregates: [{ fn: "sum", field: f("f-total"), as: "sum" }],
};
/** The same grouping over raw fields — the server can run it. */
const COUNT_CITY: ViewQuery = {
  where: NONE,
  groupBy: [f("f-city")],
  aggregates: [{ fn: "count", as: "n" }],
};

const settle = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

/** Pages of `size` (`?page=`), the answer `{ items, next, total }` — `total` may lie (the cap). */
function stubServer(size: number, total?: number) {
  const requests: { url: URL; body?: Record<string, unknown> }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : undefined;
    requests.push({ url, ...(body ? { body } : {}) });
    const { page: _page, ...rest } = body ?? {};
    const rows = answerBody(ROWS, rest).items;
    const page = Number(url.searchParams.get("page") || 1);
    const more = page * size < rows.length;
    return new Response(
      JSON.stringify({
        items: rows.slice((page - 1) * size, page * size),
        next: more ? String(page + 1) : null,
        total: total ?? rows.length,
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  return { requests };
}

async function preview(view: ViewQuery) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["ListBox"]);
  const [list] = h.ids as [NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "orders",
          name: "Orders",
          schema: SCHEMA.map((field) => ({ ...field })),
          mockData: [],
          runtimeData: ROWS,
          useMockData: false,
        },
      ],
      variables: [],
      apiEndpoints: [
        {
          id: "list",
          name: "listOrders",
          baseUrl: "https://api.example.test",
          method: "POST",
          path: "/orders?page={{ cursor }}",
          targetCollection: "Orders",
          responseMapping: {
            dataPath: "items",
            cursorPath: "next",
            totalPath: "total",
          },
          querySerialization: { kind: "body" },
        },
      ],
    } as never);
  });
  // (A grouping is a shared view — ADR-284 Decision 1; the binding reads it by id.)
  const VIEW = "project:view:g4";
  act(() => {
    h.workspace.execute(
      addView({
        entry: {
          kind: "view",
          id: VIEW as never,
          name: "G4",
          source: { collectionId: "data:collection:orders" as never },
          ...view,
        },
      }),
    );
    h.workspace.execute(
      catalogBindingCommand([{ kind: "node", id: list }], {
        ...catalogBindingRef({
          source: "dataTable",
          collectionId: "orders",
          name: "Orders",
        })!,
        viewId: VIEW as never,
      }),
    );
  });
  h.flush();
  await settle();
  await settle();
  const options = () =>
    h.element(list)?.querySelectorAll('[role="option"]').length ?? 0;
  return { ...h, list, options };
}

describe("ADR-291 G4 — a computed field keeps the view here", () => {
  it("groupBy(raw) + sum(total): nothing of the view in the request, every page loaded, 42 · 26 here", async () => {
    const server = stubServer(2);
    const h = await preview(SUM_TOTAL);
    // (Three pages of two — the view needs the whole data; the template endpoint loaded once
    // before the binding too.)
    const pages = server.requests.map((r) => r.url.searchParams.get("page"));
    expect(pages.slice(-2)).toEqual(["2", "3"]);
    expect(pages.filter((page) => page === "3")).toHaveLength(1);
    for (const request of server.requests) {
      expect(request.body?.group).toBeUndefined();
      expect(request.body?.where).toBeUndefined();
    }
    const result = h.session.viewResult(h.list);
    expect(result?.served).toBeUndefined();
    expect(result).toMatchObject({ complete: true, matched: 2 });
    expect(h.options()).toBe(2);
    // (The local run over the whole data — the oracle by hand: Seoul 20 + 22 + 1 = 43? No: Jung is
    // 1 × 1 = 1 → 43; Busan 5 + 21 = 26.)
    const local = runViewQueries(ROWS, {
      queries: [SUM_TOTAL],
      schema: SCHEMA,
      resolve: (value) => ({ value }),
    });
    expect(local.rows).toEqual([
      { city: "Seoul", sum: 43 },
      { city: "Busan", sum: 26 },
    ]);
    expect(h.session.viewRefusals.size).toBe(0);
    h.view.unmount();
  });

  it("past the row cap the view is refused: no rows, the count recorded", async () => {
    stubServer(2, VIEW_LOCAL_LOAD_CAP + 1);
    const h = await preview(SUM_TOTAL);
    expect(h.session.viewRefusals.get("orders")).toBe(VIEW_LOCAL_LOAD_CAP + 1);
    expect(h.session.collectionItems("orders")).toHaveLength(0);
    const texts = [
      ...(h.element(h.list)?.querySelectorAll('[role="option"]') ?? []),
    ].map((item) => item.textContent);
    // (The one option left is the list's empty state — RAC `renderEmptyState`.)
    expect(texts.filter((text) => !/No results/.test(text ?? "")), JSON.stringify(texts)).toHaveLength(0);
    h.view.unmount();
  });

  it("a grouping over raw fields on a `body` endpoint goes as `group`; the server's group rows are the result", async () => {
    const server = stubServer(10);
    const h = await preview(COUNT_CITY);
    expect(server.requests.at(-1)!.body).toMatchObject({
      group: { by: ["city"], aggregates: [{ fn: "count", as: "n" }] },
      total: true,
    });
    expect(h.session.viewResult(h.list)).toMatchObject({
      served: true,
      matched: 2,
    });
    expect(h.options()).toBe(2);
    h.view.unmount();
  });
});
