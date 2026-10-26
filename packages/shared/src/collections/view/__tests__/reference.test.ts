import { describe, expect, it } from "vitest";
import type {
  ViewConditionGroup,
  ViewQuery,
} from "../../../catalog/document/types";
import { runViewQueries, viewRunReferences, viewRunSchema } from "../evaluate";
import { viewQueryLimits } from "../serialize";
import { catalogBoundRows } from "../../../catalog/runtime/dataBinding";

/**
 * ADR-284 G4 — a field path through a reference field (Decision 4 — `find`): `[teamId, name]` is
 * the name of the Teams row whose `id` is the Users row's `teamId`. Conditions · the sort ·
 * grouping read it; a key that finds no row (unknown · null) reads empty (「없음」); a path whose
 * target is not loaded is broken. Expected rows are written by hand.
 */
const TEAMS = {
  id: "teams",
  schema: [
    { id: "f-tid", key: "id", type: "string" },
    { id: "f-tname", key: "name", type: "string" },
  ],
  mockData: [
    { id: "t1", name: "Red" },
    { id: "t2", name: "Blue" },
  ],
  useMockData: true,
};
const USERS_SCHEMA = viewRunSchema([
  { id: "f-uid", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  {
    id: "f-team",
    key: "teamId",
    type: "reference",
    reference: { collectionId: "teams", keyField: "f-tid" },
  },
]);
const USERS = [
  { id: "u1", name: "Kim", teamId: "t1" },
  { id: "u2", name: "Park", teamId: "t2" },
  { id: "u3", name: "Lee", teamId: "t1" },
  { id: "u4", name: "Cho", teamId: "t9" },
  { id: "u5", name: "Choi", teamId: null },
];
const TEAM_NAME = ["data:field:f-team", "data:field:f-tname"] as const;
const where = (items: ViewConditionGroup["items"]): ViewConditionGroup => ({
  id: "where",
  op: "and",
  items,
});
const run = (query: ViewQuery, references = viewRunReferences([TEAMS])) =>
  runViewQueries(USERS, {
    queries: [query],
    schema: USERS_SCHEMA,
    resolve: (value) => ({ value }),
    references,
  });
const names = (rows: readonly unknown[]) =>
  rows.map((row) => (row as { name: string }).name);

describe("ADR-284 G4 — a reference path (team.name)", () => {
  it("a condition on team.name; 「없음」 finds the rows whose key points nowhere (unknown · null)", () => {
    expect(
      names(
        run({
          where: where([
            { id: "red", fields: [TEAM_NAME], op: "equals", value: "Red" },
          ]),
        }).rows,
      ),
    ).toEqual(["Kim", "Lee"]);
    expect(
      names(
        run({
          where: where([{ id: "none", fields: [TEAM_NAME], op: "notExists" }]),
        }).rows,
      ),
    ).toEqual(["Cho", "Choi"]);
  });

  it("the sort and a grouping read the path; the grouped row holds team.name flat and nested", () => {
    expect(
      names(
        run({
          where: where([]),
          sort: { field: [...TEAM_NAME], direction: "ascending" },
        }).rows,
      ),
    ).toEqual(["Cho", "Choi", "Park", "Kim", "Lee"]);
    const grouped = run({
      where: where([]),
      groupBy: [TEAM_NAME],
      aggregates: [{ fn: "count", as: "count" }],
    });
    expect(grouped.rows).toEqual([
      { "teamId.name": "Red", teamId: { name: "Red" }, count: 2 },
      { "teamId.name": "Blue", teamId: { name: "Blue" }, count: 1 },
      { "teamId.name": null, teamId: { name: null }, count: 2 },
    ]);
    expect(grouped.schema[0]).toMatchObject({
      id: "f-team__f-tname",
      key: "teamId.name",
    });
  });

  it("a path whose target is not loaded is broken (never a silent pass); the API format names it", () => {
    const result = run(
      {
        where: where([
          { id: "red", fields: [TEAM_NAME], op: "equals", value: "Red" },
        ]),
      },
      () => undefined,
    );
    expect(result.broken).toEqual(["red"]);
    expect(names(result.rows)).toHaveLength(5);
    expect(
      viewQueryLimits(
        { kind: "suffix" },
        {
          queries: [
            {
              where: where([
                { id: "red", fields: [TEAM_NAME], op: "equals", value: "Red" },
              ]),
            },
          ],
          schema: USERS_SCHEMA,
        },
      ),
    ).toEqual([{ code: "REFERENCE_PATH", conditionId: "red" }]);
  });

  it("the row source re-runs when the target's rows change (the same Users rows, a renamed team)", () => {
    const users = {
      id: "users",
      schema: [
        { id: "f-uid", key: "id", type: "string" },
        { id: "f-name", key: "name", type: "string" },
        {
          id: "f-team",
          key: "teamId",
          type: "reference",
          reference: { collectionId: "teams", keyField: "f-tid" },
        },
      ],
      mockData: USERS,
      useMockData: true,
    };
    const binding = {
      collectionId: "data:collection:users" as const,
      fieldMap: {},
      query: {
        queries: [
          {
            where: where([
              {
                id: "red",
                fields: [TEAM_NAME],
                op: "equals" as const,
                value: "Red",
              },
            ]),
          },
        ],
        values: {},
        names: [],
      },
    };
    const keys = (teams: typeof TEAMS) =>
      catalogBoundRows(binding, [users, teams])!.map((row) => row.key);
    expect(keys(TEAMS)).toEqual(["u1", "u3"]);
    expect(
      keys({
        ...TEAMS,
        mockData: [
          { id: "t1", name: "Green" },
          { id: "t2", name: "Red" },
        ],
      }),
    ).toEqual(["u2"]);
  });
});
