/**
 * collection 이 store 에 들어오는 경계의 정규화 (ADR-152 Phase 1, HC7 / R8).
 *
 * `DataField.id` 는 additive 라 구 문서 · import envelope · 편집기의 새 필드 행이
 * id 없이 들어온다. 참조 (`{#id}` 템플릿 · fieldMap · 차트 시리즈, canonical 문서)
 * 와 정의 (`DataField.id`, IndexedDB `collections`) 는 저장 단위가 달라, 메모리에서만
 * 부여한 id 는 문서가 먼저 저장되는 순서에서 재생성된다. 그래서 (1) store 에 넣는
 * **모든** 경로가 이 함수를 지나고 (2) id 가 새로 부여된 collection 은 호출자
 * (`fetchCollections`) 가 hydrate 직후 1회 write-back 한다 — `assigned` 가 그 판정.
 *
 * 부여가 없으면 **같은 참조**를 돌려준다 — Map 이 그대로면 `useCollections` 의 memo
 * 가 유지된다 (ADR-210 P4 실측: 배열이 바뀌면 Chart 컨트롤이 전부 다시 그린다).
 */
import type { DataField, DataTable } from "../../types/builder/data.types";

function newFieldId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * id 없는 필드 (빈 key 제외 — 편집 중 임시 행) 에 id 부여. 같은 배열 안의 중복 id 는
 * 뒤쪽을 새로 부여한다 (복사-붙여넣기로 같은 id 가 두 번 실리는 경우).
 */
export function normalizeSchema(
  schema: readonly DataField[] | undefined,
  seen: Set<string> = new Set(),
): { schema: DataField[]; assigned: boolean } {
  if (!schema || schema.length === 0)
    return { schema: (schema ?? []) as DataField[], assigned: false };
  let assigned = false;
  const next = schema.map((field) => {
    let out = field;
    const needsId =
      field.key.length > 0 &&
      (typeof field.id !== "string" ||
        field.id.length === 0 ||
        seen.has(field.id));
    if (needsId) {
      out = { ...out, id: newFieldId() };
      assigned = true;
    }
    if (typeof out.id === "string") seen.add(out.id);
    if (out.children && out.children.length > 0) {
      const child = normalizeSchema(out.children, seen);
      if (child.assigned) {
        out =
          out === field
            ? { ...out, children: child.schema }
            : { ...out, children: child.schema };
        assigned = true;
      }
    }
    return out;
  });
  return { schema: assigned ? next : (schema as DataField[]), assigned };
}

export function normalizeCollection(collection: DataTable): {
  collection: DataTable;
  assigned: boolean;
} {
  const { schema, assigned } = normalizeSchema(collection.schema);
  if (!assigned) return { collection, assigned: false };
  return { collection: { ...collection, schema }, assigned: true };
}

/** 배열 → **id 키** Map (HC8 재키잉). `assigned` 는 write-back 대상 (부여된 것만). */
export function normalizeCollectionMap(list: readonly DataTable[]): {
  collections: Map<string, DataTable>;
  assigned: DataTable[];
} {
  const collections = new Map<string, DataTable>();
  const assigned: DataTable[] = [];
  for (const entry of list) {
    const result = normalizeCollection(entry);
    collections.set(result.collection.id, result.collection);
    if (result.assigned) assigned.push(result.collection);
  }
  return { collections, assigned };
}
