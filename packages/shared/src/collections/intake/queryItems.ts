/**
 * ADR-313 Decision 4 — 조회 응답의 항목을 collection 의 저장 값으로 (JSON 규칙). 실행기 (`executeCollectionEndpoint`)
 * 는 이 모듈을 실행할 때 lazy 로 읽는다 — Builder 첫 화면 (`collectionSnapshot`) 에 변환기를 싣지 않는다 (HC3).
 */
import { normalizeRows, type IntakeField } from "./normalizeRows";

/** The collection a query fills, as the intake reads it. */
export interface IntakeCollection {
  id?: string;
  schema?: readonly IntakeField[];
  keyField?: string;
}

/**
 * A query's items in the collection's stored values: a field's declared notation is read; an
 * undeclared value is left as is. Items that are not row objects, a collection without a schema, and
 * items needing nothing come back as they are (HC6).
 */
export function intakeQueryItems(
  items: unknown,
  collection: IntakeCollection | undefined,
): unknown {
  const schema = collection?.schema;
  if (!schema?.length || !Array.isArray(items)) return items;
  if (
    !items.every(
      (item) => item !== null && typeof item === "object" && !Array.isArray(item),
    )
  )
    return items;
  return normalizeRows(items as Record<string, unknown>[], schema, "json", {
    ...(collection?.keyField ? { keyField: collection.keyField } : {}),
  }).rows;
}
