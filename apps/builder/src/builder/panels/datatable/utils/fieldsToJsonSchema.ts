/**
 * ADR-313 Decision 8 · §2.6 — collection 의 스키마를 JSON Schema 2020-12 로 낸다 (표 메뉴 — 복사 · 파일).
 *
 * 내보낸 스키마는 **저장 값** (정규 값 — Decision 3) 을 기술한다: `boolean` 은 `true` · `false`, 날짜는 ISO 글자,
 * 큰 정수 key 는 글자. 원본 표기 (값 표현) 는 `x-composition-encoding` 주석일 뿐이다.
 *
 * - `date` 는 `type: "string"` 이고 `format` 을 쓰지 않는다 — offset 없는 일시가 `date-time` 검사에서 탈락한다
 *   (F9). 정밀도는 `x-composition-type: "date"` 주석.
 * - `required: true` → 객체의 `required` 배열 + 타입 하나, 그 밖은 `type: [T, "null"]`.
 * - Composition 고유 정보는 `x-composition-*` 주석 (`id` · `order` · `key` · `encoding` · `reference` ·
 *   `formula`) — 읽는 쪽이 무시해도 스키마가 성립한다. 계산 필드는 `readOnly: true`.
 *
 * 순수 함수. 네트워크를 쓰지 않는다.
 */
import type {
  DataField,
  DataTable,
} from "../../../../types/builder/data.types";

type Json = Record<string, unknown>;

const JSON_TYPE: Record<string, string | string[]> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  date: "string",
  array: "array",
  object: "object",
  // (참조 값 = 다른 표 행의 key — 글자 또는 수.)
  reference: ["string", "number"],
};

function fieldSchema(field: DataField, order: number): Json {
  const base = JSON_TYPE[field.type] ?? "string";
  const types = Array.isArray(base) ? base : [base];
  const out: Json = {
    type: field.required
      ? types.length === 1
        ? types[0]
        : types
      : [...types, "null"],
  };
  if (field.label && field.label !== field.key) out.title = field.label;
  if (field.format === "email") out.format = "email";
  else if (field.format === "url" || field.format === "image")
    out.format = "uri";
  if (field.type === "object" && field.children?.length)
    Object.assign(out, objectSchema(field.children));
  if (field.type === "array" && field.children?.length)
    out.items = { type: "object", ...objectSchema(field.children) };
  if (field.defaultValue !== undefined && field.defaultValue !== null)
    out.default = field.defaultValue;
  if (field.formula) out.readOnly = true;
  if (field.id) out["x-composition-id"] = field.id;
  out["x-composition-order"] = order;
  if (field.type === "date") out["x-composition-type"] = "date";
  if (field.format === "image") out["x-composition-format"] = "image";
  if (field.encoding) out["x-composition-encoding"] = field.encoding;
  if (field.reference) out["x-composition-reference"] = field.reference;
  if (field.formula) out["x-composition-formula"] = field.formula;
  return out;
}

function objectSchema(fields: readonly DataField[]): Json {
  const properties: Json = {};
  const required: string[] = [];
  fields.forEach((field, index) => {
    properties[field.key] = fieldSchema(field, index);
    if (field.required) required.push(field.key);
  });
  return { properties, ...(required.length ? { required } : {}) };
}

/** 한 행의 JSON Schema (`$schema` 2020-12 · 제목 = 표 이름 · key 필드 = `x-composition-key`). */
export function fieldsToJsonSchema(
  table: Pick<DataTable, "name" | "schema" | "keyField">,
): Json {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: table.name,
    type: "object",
    // (§2.2 — the key field cannot be empty: it is required in the export.)
    ...objectSchema(
      table.schema.map((field) =>
        table.keyField && field.id === table.keyField ? { ...field, required: true } : field,
      ),
    ),
    ...(table.keyField ? { "x-composition-key": table.keyField } : {}),
  };
}
