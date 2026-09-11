/**
 * ADR-213 Phase 4 — 승인 diff 뷰의 순수 요약 (`summarizeDataChange`).
 *
 * - 테이블별 필드 추가/변경 · 행 삽입 수 + 샘플 3행 · 바인딩 변경 · endpoint 정의 (신규/변경)
 * - "사용처 N" — 152 역참조 (update_field type 변경 · 테이블 수준)
 * - 이름 해석: collectionId → 이름, elementId → 요소 type, endpoint id → 신규/변경 판정
 */
import { describe, expect, it } from "vitest";
import type { DataOp } from "@composition/shared";
import {
  DIFF_SAMPLE_ROWS_MAX,
  summarizeDataChange,
  type DataChangeSummaryContext,
} from "./dataChangeSummary";

const ctx: DataChangeSummaryContext = {
  collections: [
    {
      id: "users",
      name: "Users",
      schema: [
        { id: "f_name", key: "name", type: "string" },
        { id: "f_age", key: "age", type: "number" },
      ],
    },
  ],
  usage: new Map([["users", 3]]),
  endpointIds: new Set(["ep1"]),
  elementTypes: new Map([["e1", "ListBox"]]),
};

describe("summarizeDataChange", () => {
  it("create_collection: 이름 · 필드 수 · 행 수 · 샘플 ≤3행 (키는 스키마 순)", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      name: `n${i}`,
      age: i,
    }));
    const [item] = summarizeDataChange(
      [
        {
          op: "create_collection",
          name: "Posts",
          schema: [
            { key: "name", type: "string" },
            { key: "age", type: "number" },
          ],
          rows,
        },
      ],
      ctx,
    ).items;
    expect(item).toMatchObject({
      kind: "collection",
      op: "create_collection",
      collection: { id: null, name: "Posts", isNew: true },
      fieldCount: 2,
      fields: [
        { key: "name", type: "string", required: false },
        { key: "age", type: "number", required: false },
      ],
      rowCount: 5,
      sample: {
        keys: ["name", "age"],
        rows: rows.slice(0, DIFF_SAMPLE_ROWS_MAX),
      },
    });
  });

  it("add_field · update_field(type 변경 → 사용처 N) · insert_rows(수 + 샘플) · set_source 는 collection 이름으로 묶인다", () => {
    const { items, usedBy } = summarizeDataChange(
      [
        {
          op: "add_field",
          collectionId: "users",
          field: { key: "email", type: "email" },
        },
        {
          op: "update_field",
          collectionId: "users",
          fieldId: "f_age",
          patch: { type: "string" },
        },
        {
          op: "insert_rows",
          collectionId: "users",
          rows: [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }],
        },
        {
          op: "set_source",
          collectionId: "users",
          source: "api",
          endpointId: "ep1",
        },
      ],
      ctx,
    );
    expect(items.map((i) => i.op)).toEqual([
      "add_field",
      "update_field",
      "insert_rows",
      "set_source",
    ]);
    expect(items[0]).toMatchObject({
      collection: { id: "users", name: "Users", isNew: false },
      field: { key: "email", type: "email" },
    });
    expect(items[1]).toMatchObject({
      field: { key: "age", type: "number" },
      patch: { type: "string" },
      typeChange: { from: "number", to: "string" },
      usedBy: 3,
    });
    expect(items[2]).toMatchObject({
      rowCount: 4,
      sample: {
        keys: ["name", "age"],
        rows: [{ name: "a" }, { name: "b" }, { name: "c" }],
      },
    });
    expect(items[3]).toMatchObject({ source: "api", endpointId: "ep1" });
    // 테이블 수준 사용처 (영향 collection 별)
    expect(usedBy).toEqual([{ id: "users", name: "Users", count: 3 }]);
  });

  it("define_endpoint: 신규/변경 판정 · method · url · 헤더 수 / bind_element: 요소 type · collection 이름 · 해제", () => {
    const { items } = summarizeDataChange(
      [
        {
          op: "define_endpoint",
          endpoint: {
            id: "ep1",
            name: "getUsers",
            method: "GET",
            baseUrl: "https://api.example.com",
            path: "/users",
            headers: [
              {
                key: "Authorization",
                value: "Bearer {{secret.TOKEN}}",
                enabled: true,
              },
            ],
          },
        },
        {
          op: "define_endpoint",
          endpoint: {
            name: "newOne",
            method: "POST",
            baseUrl: "https://h",
            path: "/p",
          },
        },
        {
          op: "bind_element",
          elementId: "e1",
          collectionId: "users",
          fieldMap: { value: "f_name" },
        },
        { op: "bind_element", elementId: "e9", collectionId: null },
      ],
      ctx,
    );
    expect(items[0]).toMatchObject({
      kind: "endpoint",
      endpoint: {
        name: "getUsers",
        method: "GET",
        url: "https://api.example.com/users",
        isNew: false,
        headerKeys: ["Authorization"],
      },
    });
    expect(items[1]).toMatchObject({
      endpoint: {
        name: "newOne",
        isNew: true,
        url: "https://h/p",
        headerKeys: [],
      },
    });
    expect(items[2]).toMatchObject({
      kind: "binding",
      element: { id: "e1", type: "ListBox" },
      collection: { id: "users", name: "Users" },
      fieldMap: { value: "name" },
    });
    expect(items[3]).toMatchObject({
      kind: "binding",
      element: { id: "e9", type: null },
      collection: null,
    });
  });

  it("모르는 collection/필드 id 는 id 그대로 (throw 하지 않는다 — 적용기가 거부한다)", () => {
    const { items, usedBy } = summarizeDataChange(
      [
        {
          op: "add_field",
          collectionId: "ghost",
          field: { key: "x", type: "string" },
        },
      ],
      ctx,
    );
    expect(items[0]).toMatchObject({
      collection: { id: "ghost", name: "ghost", isNew: false },
    });
    expect(usedBy).toEqual([]);
  });
});
