/**
 * 바인딩 → collection · 필드 참조 단일 resolve 헬퍼 (ADR-152 Phase 1).
 *
 * **계약 v2**: `PropertyDataBinding.collectionId` (안정 참조) 우선, 실패 시 `name`
 * (v1 잔존) fallback, 둘 다 실패면 null. name fallback 안에서는 `dt.name === name`
 * 다음에 `dt.id === name` 도 본다 — import envelope 가 다른 프로젝트의 id 바인딩을
 * 새 id 로 재연결할 때 `name` 자리에 id 를 실어 왔기 때문 (구 형식 read 호환).
 *
 * **왜 한 곳인가**: rename 파손 (격차 1) 은 resolve 지점이 여러 곳에 흩어져 있을 때
 * 한 곳만 id 를 보고 나머지가 name 을 보면 재발한다. DOM (`useCollectionData` ·
 * `readDataBindingRows`) · Skia projector · Properties 패널 (chart 컬럼 · 소유자
 * 컬럼) · store 액션이 전부 이 함수를 지난다 — 직접 `find(name ===)` 은 정적 가드
 * (`resolveBoundCollection.static.test.ts`) 가 0건으로 고정한다.
 *
 * **왜 O(n) 인가**: 입력이 `readonly T[]` 라 순회다. 빌더 store 는 id 키 Map 이라
 * `.get(id)` O(1) 로 먼저 시도하고 (`resolveStoreCollection`), 배열 순회는 name
 * fallback 과 DOM/Skia 의 배열 입력 (collections snapshot 은 배열) 에서만 일어난다.
 * 프로젝트당 collection 수는 수십 이내라 hot path (pointer) 밖에서는 상수다.
 */

type CollectionLike = { id?: string; name?: string };
type FieldLike = { id?: string; key: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** 이름 (또는 name 자리에 실린 id) 으로 collection 을 찾는다 — v1 fallback 의 본체. */
export function resolveCollectionByName<T extends CollectionLike>(
  name: string | undefined,
  collections: readonly T[],
): T | null {
  if (typeof name !== "string" || name.length === 0) return null;
  for (const collection of collections) {
    if (collection.name === name) return collection;
  }
  for (const collection of collections) {
    if (collection.id === name) return collection;
  }
  return null;
}

/**
 * `PropertyDataBinding` (또는 동형 record) → collection.
 * 1. `collectionId` 매치 2. `name` 매치 (v1) 3. null.
 */
export function resolveBoundCollection<T extends CollectionLike>(
  binding: unknown,
  collections: readonly T[],
): T | null {
  if (!isRecord(binding)) return null;
  const collectionId = binding.collectionId;
  if (typeof collectionId === "string" && collectionId.length > 0) {
    for (const collection of collections) {
      if (collection.id === collectionId) return collection;
    }
  }
  const name = binding.name;
  return resolveCollectionByName(
    typeof name === "string" ? name : undefined,
    collections,
  );
}

/**
 * id 키 Map (빌더 `useDataStore.collections`) 에서 O(1) 우선 resolve.
 * Map 미스면 값 순회 name fallback.
 */
export function resolveStoreCollection<T extends CollectionLike>(
  binding: unknown,
  collections: ReadonlyMap<string, T>,
): T | null {
  if (!isRecord(binding)) return null;
  const collectionId = binding.collectionId;
  if (typeof collectionId === "string") {
    const hit = collections.get(collectionId);
    if (hit) return hit;
  }
  const name = binding.name;
  if (typeof name === "string") {
    const byId = collections.get(name);
    if (byId) return byId;
  }
  return resolveBoundCollection(binding, Array.from(collections.values()));
}

/**
 * 필드 참조 (`fieldId` 또는 v1 `key`) → schema 필드. id 매치 → key 매치 → null.
 * `DataField.id` 는 additive 라 id 없는 구 필드는 key 로만 찾힌다.
 */
export function resolveField<F extends FieldLike>(
  schema: readonly F[] | undefined,
  ref: string | undefined,
): F | null {
  if (!schema || typeof ref !== "string" || ref.length === 0) return null;
  for (const field of schema) {
    if (field.id === ref) return field;
  }
  for (const field of schema) {
    if (field.key === ref) return field;
  }
  return null;
}
