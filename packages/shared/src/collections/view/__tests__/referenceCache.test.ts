import { describe, expect, it } from "vitest";
import type { CatalogRowBinding } from "../../../catalog/resolution/resolver";
import { catalogBoundRows } from "../../../catalog/runtime/dataBinding";
import { resolveCollectionSnapshot } from "../../collectionSnapshot";
import { viewRunReferences } from "../evaluate";

function fixture() {
  const users = {
    id: "users",
    useMockData: true,
    mockData: [{ id: "u1", teamId: "t1" }],
    schema: [
      { id: "uid", key: "id", type: "string" },
      {
        id: "team",
        key: "teamId",
        type: "reference",
        reference: { collectionId: "teams", keyField: "tid" },
      },
    ],
  };
  const teams = {
    id: "teams",
    useMockData: true,
    mockData: [{ id: "t1", orgId: "o1" }],
    schema: [
      { id: "tid", key: "id", type: "string" },
      {
        id: "org",
        key: "orgId",
        type: "reference",
        reference: { collectionId: "orgs", keyField: "oid" },
      },
    ],
  };
  const orgs = {
    id: "orgs",
    useMockData: true,
    mockData: [{ id: "o1", name: "Red", other: "Blue" }],
    schema: [
      { id: "oid", key: "id", type: "string" },
      { id: "name", key: "name", type: "string" },
    ],
  };
  const binding: CatalogRowBinding = {
    collectionId: "data:collection:users",
    fieldMap: {},
    query: {
      queries: [
        {
          where: {
            id: "where",
            op: "and",
            items: [
              {
                id: "red",
                fields: [
                  ["data:field:team", "data:field:org", "data:field:name"],
                ],
                op: "equals",
                value: "Red",
              },
            ],
          },
        },
      ],
      values: {},
      names: [],
    },
  };
  return { users, teams, orgs, binding };
}

describe("참조 조회와 보기 캐시의 데이터 계약", () => {
  it.each([
    { useMockData: false },
    {
      useMockData: false,
      status: "loading" as const,
      runtimeData: [{ id: "old" }],
    },
    {
      useMockData: false,
      status: "error" as const,
      runtimeData: [{ id: "old" }],
    },
    { useMockData: false, status: "success" as const, runtimeData: [] },
    { useMockData: true, status: "loading" as const },
  ])("참조 경로도 공용 snapshot을 따른다: %j", (state) => {
    const source = { id: "teams", mockData: [{ id: "mock" }], ...state };
    expect(viewRunReferences([source])("teams")?.rows).toEqual(
      resolveCollectionSnapshot(source).data,
    );
  });

  it("원본 행을 유지한 채 중첩 참조 대상의 행이 바뀌면 다시 평가한다", () => {
    const { users, teams, orgs, binding } = fixture();
    expect(catalogBoundRows(binding, [users, teams, orgs])).toHaveLength(1);
    expect(
      catalogBoundRows(binding, [
        users,
        teams,
        { ...orgs, mockData: [{ id: "o1", name: "Blue", other: "Red" }] },
      ]),
    ).toHaveLength(0);
  });

  it("참조 대상의 schema가 바뀌어도 이전 필드 값을 재사용하지 않는다", () => {
    const { users, teams, orgs, binding } = fixture();
    expect(catalogBoundRows(binding, [users, teams, orgs])).toHaveLength(1);
    const renamed = {
      ...orgs,
      schema: orgs.schema.map((field) =>
        field.id === "name" ? { ...field, key: "other" } : field,
      ),
    };
    expect(catalogBoundRows(binding, [users, teams, renamed])).toHaveLength(0);
  });

  it("없던 중첩 참조 대상이 로드되면 broken 결과를 다시 평가한다", () => {
    const { users, teams, orgs, binding } = fixture();
    expect(catalogBoundRows(binding, [users, teams])).toHaveLength(1);
    expect(
      catalogBoundRows(binding, [users, teams, { ...orgs, mockData: [] }]),
    ).toHaveLength(0);
  });
});
