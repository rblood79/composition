/**
 * ADR-313 G2 (R2) — 나가는 값은 필드의 값 표현으로 되돌린다 (Decision 5 · HC7): 보기 조건의 쿼리 글자 ·
 * body 의 JSON 타입 · Form 제출 body · 큰 정수 literal. 그리고 항목 key 가 collection 의 `keyField` 를 따른다
 * (Decision 6). 기대 값은 손으로 썼다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ViewQuery } from "../../../catalog/document/types";
import type { ApiEndpointDefinition } from "../../../types/collection.types";
import {
  createCollectionEndpointSubmitter,
  loadCollectionEndpoint,
} from "../../executeCollectionEndpoint";
import { getItemKey, resolveFieldRoles } from "../../resolveCollectionItems";
import type { ViewRunField } from "../../view/evaluate";
import { serializeViewQueries } from "../../view/serialize";

const SCHEMA: ViewRunField[] = [
  { id: "f-id", key: "USER_ID", type: "string", encoding: { kind: "bigInt" } },
  {
    id: "f-use",
    key: "USE_YN",
    type: "boolean",
    encoding: { kind: "flag", true: "Y", false: "N" },
  },
  {
    id: "f-join",
    key: "JOIN_DT",
    type: "date",
    encoding: { kind: "compactDate", wire: "number" },
  },
  {
    id: "f-upd",
    key: "UPD_TS",
    type: "date",
    encoding: { kind: "epochMs", wire: "number" },
  },
  {
    id: "f-amt",
    key: "SALARY_AMT",
    type: "number",
    encoding: { kind: "numberText" },
  },
  { id: "f-name", key: "USER_NM", type: "string" },
];

const query: ViewQuery = {
  where: {
    id: "w",
    op: "and",
    items: [
      { id: "a", fields: [["data:field:f-use"]], op: "equals", value: true },
      {
        id: "b",
        fields: [["data:field:f-join"]],
        op: "between",
        value: ["2026-11-01", "!var.to"],
      },
      {
        id: "c",
        fields: [["data:field:f-id"]],
        op: "oneOf",
        value: ["9007199254740993", "1001"],
      },
      {
        id: "d",
        fields: [["data:field:f-amt"]],
        op: "gte",
        value: "4500000.00",
      },
      { id: "e", fields: [["data:field:f-name"]], op: "contains", value: "홍" },
      {
        id: "f",
        fields: [["data:field:f-upd"]],
        op: "lt",
        value: "2026-11-06T01:30:00Z",
      },
    ],
  },
};
const resolve = (value: unknown) =>
  value === "!var.to"
    ? { value: { year: 2026, month: 11, day: 30 } }
    : { value };

describe("ADR-313 G2 — 보기 조건 직렬화", () => {
  it("쿼리 — 되돌린 표현의 글자 (선언 없는 필드는 지금처럼)", () => {
    const { params } = serializeViewQueries(
      {
        kind: "suffix",
        suffixes: {
          equals: "",
          between: "",
          oneOf: "",
          gte: "_gte",
          lte: "_lte",
          lt: "_lt",
          contains: "_like",
        },
      },
      { queries: [query], schema: SCHEMA, resolve },
    );
    expect(params).toEqual([
      ["USE_YN", "Y"],
      ["JOIN_DT_gte", "20261101"],
      ["JOIN_DT_lte", "20261130"],
      ["USER_ID", "9007199254740993"],
      ["USER_ID", "1001"],
      ["SALARY_AMT_gte", "4500000"],
      ["USER_NM_like", "홍"],
      ["UPD_TS_lt", "1793928600000"],
    ]);
  });

  it("body — 되돌린 JSON 타입 · 큰 정수는 따옴표 없는 literal (요청 글자로 확인)", async () => {
    const serialized = serializeViewQueries(
      { kind: "body" },
      { queries: [query], schema: SCHEMA, resolve },
      "POST",
    );
    const fetch = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    stubWindow();
    await loadCollectionEndpoint(
      {
        id: "e",
        name: "e",
        baseUrl: "https://api.example.com",
        path: "/users",
        method: "POST",
        bodyType: "json",
      } as ApiEndpointDefinition,
      new AbortController().signal,
      undefined,
      undefined,
      { body: serialized.body },
    );
    const sent = String(
      (fetch.mock.calls[0] as unknown as [unknown, RequestInit])[1].body,
    );
    expect(sent).toContain('"fields":["USE_YN"],"op":"equals","value":"Y"');
    expect(sent).toContain('"value":[20261101,20261130]');
    expect(sent).toContain('"value":[9007199254740993,1001]');
    expect(sent).toContain('"value":"4500000"');
    expect(sent).toContain('"value":1793928600000');
    expect(sent).toContain('"value":"홍"');
  });
});

afterEach(() => vi.unstubAllGlobals());
// (buildEndpointRequest 가 상대 URL 을 window.location 으로 푼다 — node 환경.)
const stubWindow = () => vi.stubGlobal("window", { location: { href: "https://app.example.com/" } });

describe("ADR-313 G2 — Form 제출 body", () => {
  it("endpoint 가 채우는 collection 의 값 표현으로 — Form 의 글자를 읽어 되돌린다", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    stubWindow();
    const submit = createCollectionEndpointSubmitter(
      [
        {
          id: "save",
          name: "save",
          baseUrl: "https://api.example.com",
          path: "/users",
          method: "POST",
          targetCollectionId: "users",
        } as ApiEndpointDefinition,
        {
          id: "free",
          name: "free",
          baseUrl: "https://api.example.com",
          path: "/log",
          method: "POST",
        } as ApiEndpointDefinition,
      ],
      () => [{ id: "users", schema: SCHEMA }],
    );
    await submit("save", {
      USER_ID: "9007199254740993",
      USE_YN: "on",
      JOIN_DT: "2026-11-06",
      USER_NM: "홍",
    });
    await submit("free", { USE_YN: "on" });
    const bodies = fetch.mock.calls.map((call) =>
      String((call as unknown as [unknown, RequestInit])[1].body),
    );
    expect(bodies[0]).toBe(
      '{"USER_ID":9007199254740993,"USE_YN":"Y","JOIN_DT":20261106,"USER_NM":"홍"}',
    );
    // (대상 collection 이 없는 endpoint 는 지금처럼.)
    expect(bodies[1]).toBe('{"USE_YN":"on"}');
  });
});

describe("ADR-313 G2 — 항목 key 순서 (Decision 6)", () => {
  const schema = [
    { id: "f-id", key: "USER_ID" },
    { id: "f-code", key: "code" },
  ];
  const row = { USER_ID: "9007199254740993", code: "A1", id: "x" };
  it("바인딩 fieldMap.value → collection keyField → id · key · value → row-N", () => {
    expect(
      getItemKey(
        row,
        0,
        resolveFieldRoles({ fieldMap: { value: "f-code" } }, schema, "f-id"),
      ),
    ).toBe("A1");
    expect(
      getItemKey(
        row,
        0,
        resolveFieldRoles({ collectionId: "users" }, schema, "f-id"),
      ),
    ).toBe("9007199254740993");
    expect(
      getItemKey(row, 0, resolveFieldRoles({ fieldMap: {} }, schema, "f-id")),
    ).toBe("9007199254740993");
    expect(
      getItemKey(row, 0, resolveFieldRoles({ collectionId: "users" }, schema)),
    ).toBe("x");
    expect(
      getItemKey(
        {},
        2,
        resolveFieldRoles({ collectionId: "users" }, schema, "f-id"),
      ),
    ).toBe("row-3");
  });
});
