/**
 * ADR-159 P4a — slot Text 필드 피커의 컬럼 목록 소스.
 *
 * 편집 중인 Text(slot 자식/템플릿 자식)의 조상에서 collection 소유자(데이터 바인딩
 * 또는 정적 items 보유)를 찾아, 그 데이터의 필드 키 목록을 돌려준다. 소유자가 없으면
 * null — 피커 미노출(일반 입력 유지). 컬럼 출처 우선순위:
 *
 * 1. `props.dataBinding` — property binding(`{source:"dataTable", name}`) → collections
 *    store 의 해당 테이블 schema 키 (없으면 mockData[0] 키) — `readTableColumns` 계보
 * 2. `props.dataBinding` — legacy collection binding(`{type:"collection", source:"static"}`)
 *    → `config.data[0]` 키
 * 3. `props.items` — 정적 items 행의 첫 record 키
 */
import { useMemo } from "react";
import { useCollections } from "../../../stores/data";
import { useCanonicalPropertyElementsMap } from "./useCanonicalPropertyRead";
import {
  OwnerField,
  resolveOwnerCollectionFields,
} from "./useOwnerCollectionColumns";

/**
 * ADR-248 4e-7: the old element store's part of `useOwnerCollectionColumns.ts` (moved out so the catalog Builder's
 * import graph does not reach the old store). Goes with the old store.
 */
/** 소유 collection 필드 (key + id) — `{field}` 템플릿 저장형 변환 (ADR-152 1b) 입력. */
export function useOwnerCollectionFields(
  elementId: string | undefined,
): OwnerField[] | null {
  const elementsMap = useCanonicalPropertyElementsMap();
  const collections = useCollections();

  return useMemo(
    () => resolveOwnerCollectionFields(elementsMap, elementId, collections),
    [elementsMap, elementId, collections],
  );
}

export function useOwnerCollectionColumns(
  elementId: string | undefined,
): string[] | null {
  const fields = useOwnerCollectionFields(elementId);
  return useMemo(() => fields?.map((f) => f.key) ?? null, [fields]);
}
