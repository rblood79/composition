import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  answerBody,
  answerSuffix,
} from "../../../../scripts/mock-query-server.mjs";
import { loadFormulaEngine } from "../../../../../../packages/shared/src/collections/formula/engine";
import { loadCollectionEndpoint } from "../../../../../../packages/shared/src/collections/executeCollectionEndpoint";
import {
  runViewQueries,
  type ViewRunField,
} from "../../../../../../packages/shared/src/collections/view/evaluate";
import {
  serializeViewQueries,
  viewQueryLimits,
} from "../../../../../../packages/shared/src/collections/view/serialize";
import type {
  ViewConditionGroup,
  ViewQuery,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { ApiEndpointDefinition } from "../../../../../../packages/shared/src/types/collection.types";

/**
 * ADR-291 G5 — one fixture (200 rows · 2 groups · 5 aggregates · nulls) through the local
 * evaluator and the mock server (`scripts/mock-query-server.mjs`, its own filter · sort · group):
 * the same rows, values and total. Then the `suffix` format: a grouping is reported (`GROUP`,
 * every row loaded) and the page · whole count go round (`_page` · `_limit` · `X-Total-Count`).
 * Values the test names are computed by hand (the fixture's arithmetic), not read back.
 */
beforeAll(() => loadFormulaEngine());
afterEach(() => vi.unstubAllGlobals());

const ROWS = Array.from({ length: 200 }, (_unused, i) => ({
  id: `r${i}`,
  name: `Row ${i}`,
  city: i % 3 === 0 ? "Seoul" : "Busan",
  status: ["open", "closed", "pending", "archived"][i % 4]!,
  price: i % 7 === 0 ? null : i * 3,
  score: i % 11 === 0 ? null : i % 50,
}));
const SCHEMA: ViewRunField[] = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-city", key: "city", type: "string" },
  { id: "f-status", key: "status", type: "string" },
  { id: "f-price", key: "price", type: "number" },
  { id: "f-score", key: "score", type: "number" },
];
const f = (id: string) => [`data:field:${id}` as const];
const where: ViewConditionGroup = {
  id: "w",
  op: "and",
  items: [{ id: "open", fields: [f("f-status")], op: "equals", value: "open" }],
};
const GROUPED: ViewQuery = {
  where,
  groupBy: [f("f-city")],
  aggregates: [
    { fn: "count", as: "n" },
    { fn: "sum", field: f("f-price"), as: "price" },
    { fn: "mean", field: f("f-score"), as: "score" },
    { fn: "min", field: f("f-score"), as: "low" },
    { fn: "max", field: f("f-score"), as: "high" },
  ],
};
const resolve = (value: unknown) => ({ value });

describe("ADR-291 G5 — local evaluator = mock server (body format)", () => {
  it("the grouped view: the same group rows, values and total — Seoul by hand: 17 · 4,140 · 400/15 · 6 · 48", () => {
    const local = runViewQueries(ROWS, {
      queries: [GROUPED],
      schema: SCHEMA,
      resolve,
    });
    const request = serializeViewQueries(
      { kind: "body" },
      { queries: [GROUPED], schema: SCHEMA, resolve },
      "POST",
    );
    expect(request.load).toBeUndefined();
    expect(request.body?.group).toEqual({
      by: ["city"],
      aggregates: [
        { fn: "count", as: "n" },
        { fn: "sum", field: "price", as: "price" },
        { fn: "mean", field: "score", as: "score" },
        { fn: "min", field: "score", as: "low" },
        { fn: "max", field: "score", as: "high" },
      ],
    });
    const served = answerBody(ROWS, request.body);
    expect(served.items).toEqual(local.rows);
    expect(served.total).toBe(2);
    expect(local.rows).toHaveLength(2);
    // (open ∧ Seoul = i % 12 === 0, i = 0 … 192: 17 rows; price null at 0 · 84 · 168 (sum 3 × (1,632 − 252)); score null at 0 · 132 — 15 scores summing to 400.)
    const seoul = local.rows.find(
      (row) => (row as { city: string }).city === "Seoul",
    );
    expect(seoul).toEqual({
      city: "Seoul",
      n: 17,
      price: 4140,
      score: 400 / 15,
      low: 6,
      high: 48,
    });
  });

  it("filter + sort without a grouping: the same rows in the same order, the page cursor as an offset", () => {
    const view: ViewQuery = {
      where,
      sort: { field: f("f-score"), direction: "descending" },
    };
    const local = runViewQueries(ROWS, {
      queries: [view],
      schema: SCHEMA,
      resolve,
    });
    const request = serializeViewQueries(
      { kind: "body", pageSize: 20 },
      { queries: [view], schema: SCHEMA, resolve },
      "POST",
    );
    expect(request.body?.page).toEqual({ limit: 20 });
    const first = answerBody(ROWS, request.body);
    expect(first.total).toBe(50);
    expect(first.items.map((row) => row.id)).toEqual(
      local.rows.slice(0, 20).map((row) => (row as { id: string }).id),
    );
    const second = answerBody(
      ROWS,
      serializeViewQueries(
        { kind: "body", pageSize: 20 },
        { queries: [view], schema: SCHEMA, resolve },
        "POST",
        { cursor: first.cursor },
      ).body,
    );
    expect(second.items.map((row) => row.id)).toEqual(
      local.rows.slice(20, 40).map((row) => (row as { id: string }).id),
    );
  });
});

describe("ADR-291 G5 — the suffix format", () => {
  const endpoint: ApiEndpointDefinition = {
    id: "ep",
    name: "rows",
    baseUrl: "http://mock",
    path: "/rows",
    method: "GET",
    responseMapping: { dataPath: "" },
    querySerialization: { kind: "suffix", pageSize: 50 },
  };
  const stubFetch = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        const { items, headers } = answerSuffix(ROWS, url.searchParams);
        return new Response(JSON.stringify(items), {
          headers: { "content-type": "application/json", ...headers },
        });
      }),
    );

  it("a grouping is not parameters — `GROUP`, every row loaded; the conditions still go", () => {
    expect(
      viewQueryLimits(
        { kind: "suffix" },
        { queries: [GROUPED], schema: SCHEMA },
      ),
    ).toEqual([{ code: "GROUP" }]);
    const request = serializeViewQueries(
      { kind: "suffix", pageSize: 50 },
      { queries: [GROUPED], schema: SCHEMA, resolve },
    );
    expect(request.load).toBe("all");
    expect(request.params).toEqual([
      ["status", "open"],
      ["_page", "1"],
      ["_limit", "50"],
    ]);
  });

  it("page · whole count go round: `_page=1&_limit=50` → 50 rows, `X-Total-Count` 50, cursor 2 → page 2 empty, no cursor", async () => {
    stubFetch();
    const request = serializeViewQueries(
      { kind: "suffix", pageSize: 50 },
      { queries: [{ where }], schema: SCHEMA, resolve },
    );
    const extra = { query: request.params };
    const first = await loadCollectionEndpoint(
      endpoint,
      new AbortController().signal,
      undefined,
      undefined,
      extra,
    );
    expect((first.items as unknown[]).length).toBe(50);
    expect(first.total).toBe(50);
    expect(first.cursor).toBe("2");
    const next = serializeViewQueries(
      { kind: "suffix", pageSize: 50 },
      { queries: [{ where }], schema: SCHEMA, resolve },
      "GET",
      { cursor: first.cursor },
    );
    expect(next.params).toContainEqual(["_page", "2"]);
    const second = await loadCollectionEndpoint(
      endpoint,
      new AbortController().signal,
      undefined,
      first.cursor,
      { query: next.params },
    );
    expect((second.items as unknown[]).length).toBe(0);
    expect(second.cursor).toBeUndefined();
  });

  it("a computed field in the view: nothing of it is sent, `COMPUTED` names the column, every row loaded — a computed field reading a computed field too", () => {
    const schema: ViewRunField[] = [
      ...SCHEMA,
      { id: "f-total", key: "total", type: "number", formula: "'f-price' * 2" },
      { id: "f-tax", key: "tax", type: "number", formula: "'f-total' * 0.1" },
    ];
    const view: ViewQuery = {
      where,
      groupBy: [f("f-city")],
      aggregates: [{ fn: "sum", field: f("f-tax"), as: "tax" }],
    };
    for (const kind of ["suffix", "body"] as const) {
      const request = serializeViewQueries(
        { kind },
        { queries: [view], schema, resolve },
        "POST",
      );
      expect(request.warnings).toEqual([
        { code: "COMPUTED", aggregate: "tax", field: "tax" },
      ]);
      expect(request.params).toEqual([]);
      expect(request.body).toBeUndefined();
      expect(request.load).toBe("all");
      expect(viewQueryLimits({ kind }, { queries: [view], schema })).toEqual(
        request.warnings,
      );
    }
    // (The whole chain here: tax = price × 2 × 0.1 over open ∧ Seoul = 4,140 × 0.2.)
    const local = runViewQueries(ROWS, { queries: [view], schema, resolve });
    expect(
      local.rows.find((row) => (row as { city: string }).city === "Seoul"),
    ).toEqual({ city: "Seoul", tax: 828 });
  });
});
