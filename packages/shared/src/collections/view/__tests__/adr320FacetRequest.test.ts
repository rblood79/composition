import { describe, expect, it } from "vitest";
import type { ViewQuery } from "../../../catalog/document/types";
import { viewFacetRequestQueries, type ViewRunField } from "../evaluate";
import { serializeViewQueries } from "../serialize";

/**
 * ADR-320 사용자 결정 9 — a server's candidate-values request: the chain before the candidate-values
 * view with the edited condition left out (wherever it is — an emptied group leaves with it), and
 * `facet` beside `where` (no page · sort · total). Only a `body` endpoint that says `facets` is
 * asked; any other is refused with `FACET` (never sent for a server to ignore).
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-score", key: "score", type: "number" },
  { id: "f-team", key: "team", type: "string" },
];
const SCORE = ["data:field:f-score"] as never;
const TEAM = ["data:field:f-team"] as never;
const CHAIN: ViewQuery[] = [
  {
    where: {
      id: "w",
      op: "and",
      items: [
        { id: "c-score", fields: [SCORE], op: "gte", value: 10 },
        {
          id: "g",
          op: "or",
          items: [{ id: "c-team", fields: [TEAM], op: "equals", value: "A" }],
        },
      ],
    },
    sort: [{ field: SCORE, direction: "desc" }],
  } as never,
  {
    where: { id: "table-facet", op: "and", items: [] },
    groupBy: [[TEAM]],
    aggregates: [{ fn: "count", as: "__count" }],
    facet: true,
    facetSkip: "c-team",
  } as never,
];

describe("ADR-320 사용자 결정 9 — the candidate-values request", () => {
  it("the chain without the edited condition (its emptied group with it) and without the candidate-values view", () => {
    const queries = viewFacetRequestQueries(CHAIN);
    expect(queries).toHaveLength(1);
    expect(queries[0]!.where.items).toEqual([
      { id: "c-score", fields: [SCORE], op: "gte", value: 10 },
    ]);
  });

  it("a `facets` body: `{ where, facet }` only", () => {
    const served = serializeViewQueries(
      { kind: "body", facets: true, pageSize: 50 },
      {
          queries: viewFacetRequestQueries(CHAIN),
          schema: SCHEMA,
          resolve: (value) => ({ value }),
        },
      "POST",
      undefined,
      { facet: { field: "team", search: "a", cursor: "p2" } },
    );
    expect(served.load).toBeUndefined();
    expect(served.body).toEqual({
      where: {
        op: "and",
        items: [{ fields: ["score"], op: "gte", value: 10 }],
      },
      facet: { field: "team", search: "a", cursor: "p2" },
    });
  });

  it("a body without `facets` · a `suffix` format: `FACET`, nothing sent", () => {
    for (const format of [{ kind: "body" }, { kind: "suffix" }] as const) {
      const served = serializeViewQueries(
        format,
        {
          queries: viewFacetRequestQueries(CHAIN),
          schema: SCHEMA,
          resolve: (value) => ({ value }),
        },
        "POST",
        undefined,
        { facet: { field: "team" } },
      );
      expect(served.load).toBe("all");
      expect(served.body).toBeUndefined();
      expect(served.warnings.map((item) => item.code)).toContain("FACET");
    }
  });
});
