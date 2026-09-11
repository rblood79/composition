/**
 * `DataField.id` → 행 key 색인 (ADR-152 Phase 1b).
 *
 * `{#<fieldId>}` 템플릿 저장형 · 차트 `dimension/metric` 의 `#<fieldId>` 참조는 행
 * (사용자 데이터, key 로 색인) 을 읽으려면 id → key 매핑이 필요하다. 매핑의 정본은
 * collection schema 인데, 렌더 소비처 (Skia projection · DOM wrapper · 차트 기하 —
 * compile 7곳 · readField 1곳) 는 schema 를 들고 있지 않다. 그래서 **collection 이
 * 렌더용으로 resolve 되는 두 지점** (`readDataBindingRows` · `useCollectionData`) 이
 * schema 를 여기 등록하고, 보간·차트 read 는 이 색인만 본다 — 소비처 호출부 변경 0.
 *
 * id 는 UUID 라 프로젝트 전역에서 유일하므로 collection 구분 없는 평면 Map 으로 충분하다.
 * rename 은 store update → 같은 등록 지점을 다시 지나며 key 가 갱신된다. 등록 전
 * (collection 미로드) 에는 미해결 → 소비처는 빈 문자열 (throw 금지, 템플릿 미지 필드와
 * 같은 규약). specs 에 두는 이유: shared → specs 의존 방향 (차트 `readField` 가 여기 산다).
 */

export const FIELD_ID_REF_PREFIX = "#";

type FieldLike = { id?: string; key: string; children?: readonly FieldLike[] };

const index = new Map<string, string>();

/** schema 의 id 있는 필드를 (children 재귀) 등록. 같은 id 는 마지막 등록이 이긴다 (rename). */
export function registerFieldIds(schema: readonly FieldLike[] | undefined): void {
  if (!schema) return;
  for (const field of schema) {
    if (typeof field.id === "string" && field.id.length > 0 && field.key) {
      index.set(field.id, field.key);
    }
    if (field.children && field.children.length > 0) registerFieldIds(field.children);
  }
}

/** `#<id>` 참조 → 행 key. 참조 형식이 아니면 그대로 (key 참조 · v1). 미등록 id 는 null. */
export function resolveFieldRef(ref: string): string | null {
  if (!ref.startsWith(FIELD_ID_REF_PREFIX)) return ref;
  return index.get(ref.slice(FIELD_ID_REF_PREFIX.length)) ?? null;
}

export function isFieldIdRef(ref: string): boolean {
  return ref.startsWith(FIELD_ID_REF_PREFIX);
}

/** 테스트 전용 — 색인 초기화. */
export function clearFieldIdIndex(): void {
  index.clear();
}
