/**
 * ADR-213 Phase 6 — AI-1 구조화 계약 (I3): 모델은 스키마 + 규칙, 행은 코드가.
 *
 * - `TableSpecSchema`: key 식별자 · 중복 거부 · type enum · tool JSON Schema 는 zod 파생
 * - `generateSampleRows`: 결정적 (같은 이름 = 같은 행) · 규칙별 값 · reference 는 기존 행에서
 * - `validateSampleRows`: 스키마 밖 컬럼 · enum 밖 값 · 깨진 FK · required · type — 생성기
 *   출력은 issue 0, 손으로 섞은 행은 잡힌다 (생성기 = 검증기)
 */
import { describe, expect, it } from "vitest";
import {
  SAMPLE_ROWS_DEFAULT,
  TableSpecSchema,
  generateSampleRows,
  tableSpecJsonSchema,
  tableSpecToSchema,
  validateSampleRows,
  type SampleGenerationContext,
  type TableSpec,
} from "./tableSpec";

const blog: TableSpec = {
  name: "Blog Posts",
  fields: [
    { key: "id", type: "string", required: true },
    { key: "title", type: "string", required: true },
    { key: "body", type: "string" },
    { key: "author", type: "string", generate: { kind: "reference", collection: "Users", field: "name" } },
    { key: "publishedAt", type: "date" },
    { key: "status", type: "string", generate: { kind: "enum", values: ["draft", "published", "archived"] } },
  ],
};

const ctx: SampleGenerationContext = {
  collections: [
    {
      id: "c-users",
      name: "Users",
      rows: [{ id: "u1", name: "Ana Kim" }, { id: "u2", name: "Bo Lee" }],
    },
  ],
};

describe("TableSpecSchema", () => {
  it("key 는 식별자 · 중복 거부 · type 은 DATA_FIELD_TYPES · tool 스키마는 zod 파생", () => {
    expect(TableSpecSchema.safeParse(blog).success).toBe(true);
    expect(
      TableSpecSchema.safeParse({
        name: "X",
        fields: [{ key: "bad key", type: "string" }],
      }).success,
    ).toBe(false);
    expect(
      TableSpecSchema.safeParse({
        name: "X",
        fields: [
          { key: "a", type: "string" },
          { key: "a", type: "number" },
        ],
      }).success,
    ).toBe(false);
    expect(
      TableSpecSchema.safeParse({ name: "X", fields: [{ key: "a", type: "money" }] })
        .success,
    ).toBe(false);
    const json = JSON.stringify(tableSpecJsonSchema());
    expect(json).toContain('"reference"');
    expect(json).toContain('"enum"');
    expect(json).toContain('"sampleCount"');
  });
});

describe("generateSampleRows", () => {
  it("기본 5행 · 결정적 · 스키마 키만 · enum 순환 · FK 는 기존 행 값", () => {
    const rows = generateSampleRows(blog, ctx);
    expect(rows).toHaveLength(SAMPLE_ROWS_DEFAULT);
    expect(rows).toEqual(generateSampleRows(blog, ctx));
    for (const row of rows) {
      expect(Object.keys(row)).toEqual(blog.fields.map((f) => f.key));
      expect(["draft", "published", "archived"]).toContain(row.status);
      expect(["Ana Kim", "Bo Lee"]).toContain(row.author);
      expect(String(row.publishedAt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.title).toBe("string");
    }
    expect(rows.map((r) => r.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(rows.map((r) => r.status)).toEqual([
      "draft",
      "published",
      "archived",
      "draft",
      "published",
    ]);
  });

  it("규칙 없는 필드는 type · key 힌트로 기본 규칙 (email · url · integer · boolean · datetime · list)", () => {
    const spec: TableSpec = {
      name: "Mixed",
      sampleCount: 3,
      fields: [
        { key: "email", type: "email" },
        { key: "homepage", type: "url" },
        { key: "age", type: "number" },
        { key: "isActive", type: "boolean" },
        { key: "createdAt", type: "datetime" },
        { key: "tags", type: "array" },
        { key: "ownerName", type: "string" },
      ],
    };
    const [row] = generateSampleRows(spec, { collections: [] });
    expect(row.email).toMatch(/@example\.com$/);
    expect(row.homepage).toMatch(/^https:\/\//);
    expect(Number.isInteger(row.age)).toBe(true);
    expect(typeof row.isActive).toBe("boolean");
    expect(String(row.createdAt)).toMatch(/T\d{2}:\d{2}/);
    expect(Array.isArray(row.tags)).toBe(true);
    expect(String(row.ownerName)).toMatch(/^\w+ \w+$/);
    expect(validateSampleRows(spec, generateSampleRows(spec, { collections: [] }), { collections: [] })).toEqual([]);
  });

  it("reference 대상이 없으면 null (검증이 reference-broken 으로 잡는다)", () => {
    const rows = generateSampleRows(blog, { collections: [] });
    expect(rows.every((r) => r.author === null)).toBe(true);
    // null 은 required 아님 → 통과 (빈 값은 규칙 검사를 건너뛴다)
    expect(validateSampleRows(blog, rows, { collections: [] })).toEqual([]);
  });
});

describe("validateSampleRows — 생성기 = 검증기", () => {
  it("생성기 출력은 issue 0", () => {
    expect(validateSampleRows(blog, generateSampleRows(blog, ctx), ctx)).toEqual([]);
  });

  it("스키마 밖 컬럼 · enum 밖 값 · 깨진 FK · required 누락 · type 불일치를 행/키 단위로 잡는다", () => {
    const rows = generateSampleRows(blog, ctx);
    const tampered = rows.map((r) => ({ ...r }));
    tampered[0].extra = "x";
    tampered[1].status = "deleted";
    tampered[2].author = "Nobody";
    tampered[3].title = "";
    tampered[4].publishedAt = "not a date";
    expect(validateSampleRows(blog, tampered, ctx)).toEqual([
      { row: 0, key: "extra", reason: "unknown-column" },
      { row: 1, key: "status", reason: "enum-violation", value: "deleted" },
      { row: 2, key: "author", reason: "reference-broken", value: "Nobody" },
      { row: 3, key: "title", reason: "required-missing" },
      { row: 4, key: "publishedAt", reason: "type-mismatch", value: "not a date" },
    ]);
  });

  it("tableSpecToSchema — create_collection schema (label/required 는 있을 때만)", () => {
    expect(tableSpecToSchema(blog).slice(0, 2)).toEqual([
      { key: "id", type: "string", required: true },
      { key: "title", type: "string", required: true },
    ]);
    expect(tableSpecToSchema(blog)[2]).toEqual({ key: "body", type: "string" });
  });
});
