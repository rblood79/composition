/**
 * ADR-313 Decision 5 — 나가는 값은 같은 선언으로 되돌린다. 값 표현을 선언한 필드만 바뀌고, 선언 없는 필드는
 * 지금처럼 그대로 나간다. JSON body 의 `bigInt` 는 `rawJsonNumber` 로 — `stringifyJsonLossless` 가 따옴표 없이
 * 쓴다. 의존 0 · 순수 함수.
 */
import {
  readEncodedText,
  writeEncoded,
  writeEncodedText,
  type FieldEncoding,
} from "./encoding";
import { normalizeRows, readTextCell, type IntakeField } from "./normalizeRows";

/** 필드 key → 값 표현 (선언한 필드만). */
function encodedFields(
  fields: readonly IntakeField[] | undefined,
): Map<string, FieldEncoding> {
  const out = new Map<string, FieldEncoding>();
  for (const field of fields ?? [])
    if (field.encoding && !field.formula) out.set(field.key, field.encoding);
  return out;
}

/**
 * 한 레코드 (Form 제출 body · 목록 편집 값) 를 서버가 읽는 표현으로. `source` 가 `text` 면 (Form 의 글자) 먼저
 * 글자 셀 읽기로 정규 값을 만든 뒤 되돌린다 — `"Y"` 로 온 글자도, 체크박스의 `true` 도 같은 `"Y"` 가 된다.
 * 바뀐 것이 없으면 받은 객체 그대로.
 */
export function outgoingRecord(
  record: unknown,
  fields: readonly IntakeField[] | undefined,
  source: "json" | "text" = "json",
): unknown {
  const encodings = encodedFields(fields);
  if (
    !encodings.size ||
    record === null ||
    typeof record !== "object" ||
    Array.isArray(record)
  )
    return record;
  const declared = (fields ?? []).filter((field) => encodings.has(field.key));
  const [stored] = normalizeRows(
    [record as Record<string, unknown>],
    declared,
    source,
  ).rows;
  let next: Record<string, unknown> | undefined;
  for (const [key, encoding] of encodings) {
    if (!(key in stored)) continue;
    const value = writeEncoded(encoding, stored[key]);
    if (!Object.is(value, (record as Record<string, unknown>)[key])) {
      next ??= { ...(record as Record<string, unknown>) };
      next[key] = value;
    }
  }
  return next ?? record;
}

/** 나가는 값 하나의 정규 값 — 글자 (변수 · 입력의 값) 는 선언의 표기 → 열 타입으로 읽는다. */
function canonicalOf(field: IntakeField & { encoding: FieldEncoding }, value: unknown): unknown {
  if (typeof value !== "string") return value;
  const read = readEncodedText(field.encoding, value) ?? readTextCell(field.type, value);
  return read.ok ? read.value : value;
}

/**
 * 보기 조건 값 하나 (Decision 5) — `json` 은 body 의 JSON 값 (큰 정수는 `rawJsonNumber`), `text` 는 쿼리 글자.
 * 값 표현이 없는 필드는 `undefined` (호출자가 지금처럼 쓴다).
 */
export function outgoingFieldValue(
  field: IntakeField | undefined,
  value: unknown,
  as: "json" | "text",
): unknown {
  if (!field?.encoding || value === null || value === undefined) return undefined;
  const declared = field as IntakeField & { encoding: FieldEncoding };
  const canonical = canonicalOf(declared, value);
  return as === "text" ? writeEncodedText(declared.encoding, canonical) : writeEncoded(declared.encoding, canonical);
}
