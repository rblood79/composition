/**
 * ADR-313 G4 — 스키마 가져오기. 기대 값은 손으로 쓴 Spring OpenAPI 표본 (`springSamples.ts`) 의 정답이다
 * (가져오기 출력으로 만들지 않았다).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SPRING_OPENAPI_30,
  SPRING_OPENAPI_31,
} from "../../../../../../../packages/shared/src/collections/intake/__tests__/fixtures/springSamples";
import {
  endpointDraftOf,
  readSchemaDocument,
  rowPathChoices,
  schemaColumns,
  type SchemaDocument,
} from "./schemaImport";

const read = (value: unknown) => {
  const doc = readSchemaDocument(JSON.stringify(value));
  if ("error" in doc) throw new Error(doc.error);
  return doc as SchemaDocument;
};
const summary = (columns: ReturnType<typeof schemaColumns>) =>
  columns.columns.map((c) => [
    c.key,
    c.type,
    c.format ?? null,
    columns.extras[c.key]?.required ?? false,
    c.keyCandidate,
    c.candidates.map((x) => x.encoding?.kind),
  ]);

describe("ADR-313 G4 — OpenAPI 3.0 (springdoc 1.x)", () => {
  const doc = read(SPRING_OPENAPI_30);

  it("고를 수 있는 스키마 — 응답 하나 + 객체 컴포넌트 (oneOf 대상 포함)", () => {
    expect(doc.kind).toBe("openapi-3.0");
    expect(doc.choices.map((c) => c.id)).toEqual([
      "GET /api/users",
      "#/components/schemas/BaseEntity",
      "#/components/schemas/UserDto",
      "#/components/schemas/Phone",
      "#/components/schemas/Address",
      "#/components/schemas/PageUserDto",
    ]);
  });

  it("페이지 응답 → 행 배열 경로 content · 전체 수 totalElements", () => {
    const rows = rowPathChoices(doc, doc.choices[0].node);
    expect(rows[0]).toMatchObject({ path: "content", totalPath: "totalElements" });
  });

  it("UserDto (allOf 상속) → 열 · 필수 · key 후보 · 후보 · 보고", () => {
    const rows = rowPathChoices(doc, doc.choices[0].node);
    const result = schemaColumns(doc, rows[0].item);
    expect(summary(result)).toEqual([
      ["REG_DTM", "string", null, false, false, []],
      ["createdAt", "date", null, false, false, []],
      ["USER_ID", "number", null, true, true, ["bigInt"]],
      ["USER_NM", "string", null, true, false, []],
      ["USE_YN", "string", null, false, false, ["flag"]],
      ["SALARY_AMT", "string", null, false, false, []],
      ["JOIN_DT", "string", null, false, false, []],
      ["ZIP_CD", "string", null, false, false, []],
      ["email", "string", "email", false, false, []],
      ["DEPT_ID", "number", null, false, false, []],
    ]);
    expect(result.extras.USER_ID.label).toBe("사용자 ID");
    expect(result.extras.REG_DTM.label).toBe("등록 일시");
    expect(result.report).toEqual([
      { kind: "constraint", path: "USER_NM", name: "maxLength" },
      { kind: "constraint", path: "SALARY_AMT", name: "pattern" },
      { kind: "constraint", path: "DEPT_ID", name: "minimum" },
      { kind: "construct", path: "contact", name: "oneOf" },
    ]);
  });

  it("endpoint 초안 (사용자 결정 2) — 경로 · 메서드 · 쿼리 · 행 경로 · 전체 수", () => {
    const rows = rowPathChoices(doc, doc.choices[0].node);
    expect(endpointDraftOf(doc, doc.choices[0], rows[0], "users")).toEqual({
      name: "users",
      method: "GET",
      baseUrl: "",
      path: "/api/users",
      queryParams: [
        { key: "page", value: "", type: "string", required: false },
        { key: "size", value: "", type: "string", required: false },
      ],
      dataPath: "content",
      totalPath: "totalElements",
    });
    // (컴포넌트 스키마에는 요청이 없다.)
    expect(endpointDraftOf(doc, doc.choices[2], rows[0], "x")).toBeUndefined();
  });
});

describe("ADR-313 G4 — OpenAPI 3.1 (springdoc 2.x)", () => {
  const doc = read(SPRING_OPENAPI_31);
  it("type [T, null] · format date / uri · 배열 · additionalProperties", () => {
    const user = doc.choices.find((c) => c.label === "UserDto")!;
    const result = schemaColumns(doc, user.node);
    expect(summary(result)).toEqual([
      ["USER_ID", "number", null, true, true, ["bigInt"]],
      ["USER_NM", "string", null, true, false, []],
      ["USE_YN", "string", null, false, false, ["flag"]],
      ["ZIP_CD", "string", null, false, false, []],
      ["DEPT_ID", "number", null, false, false, []],
      ["createdAt", "date", null, false, false, []],
      ["birthDate", "date", null, false, false, []],
      ["homepage", "string", "url", false, false, []],
      ["tags", "array", null, false, false, []],
      ["meta", "object", null, false, false, []],
    ]);
    expect(result.report).toEqual([{ kind: "construct", path: "meta", name: "additionalProperties" }]);
  });
});

describe("ADR-313 G4 — JSON Schema · 경계", () => {
  it("루트 · $defs · 외부 $ref · 순환 · 중첩 객체", () => {
    const doc = read({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Order",
      type: "object",
      required: ["id", "customer"],
      properties: {
        id: { type: "integer" },
        customer: { $ref: "#/$defs/Customer" },
        remote: { $ref: "https://example.com/schemas/x.json" },
        parent: { $ref: "#" },
        "10": { type: "string" },
      },
      $defs: {
        Customer: { type: "object", properties: { name: { type: "string", title: "이름" } } },
      },
    });
    expect(doc.choices.map((c) => c.id)).toEqual(["#", "#/$defs/Customer"]);
    const result = schemaColumns(doc, doc.choices[0].node);
    expect(result.columns.map((c) => [c.key, c.type])).toEqual([
      ["10", "string"],
      ["id", "number"],
      ["customer", "object"],
      ["parent", "object"],
    ]);
    expect(result.extras.customer.children).toEqual([{ key: "name", type: "string", required: false, label: "이름" }]);
    expect(result.numericNames).toEqual(["10"]);
    expect(result.report).toContainEqual({ kind: "construct", path: "remote", name: "$ref https://example.com/schemas/x.json" });
    expect(result.report.some((r) => r.name.startsWith("cycle"))).toBe(true);
  });

  it("JSON 이 아니거나 스키마가 아니면 거절 (YAML 은 받지 않는다 — 사용자 결정 3)", () => {
    expect(readSchemaDocument("openapi: 3.0.1\ninfo: {}")).toEqual({ error: "not-json" });
    expect(readSchemaDocument("[1,2]")).toEqual({ error: "not-schema" });
  });

  it("HC1 — 가져오기 모듈은 네트워크를 쓰지 않는다 (정적)", () => {
    const source = readFileSync(resolve(__dirname, "schemaImport.ts"), "utf8");
    expect(source).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|import\(/);
  });
});
