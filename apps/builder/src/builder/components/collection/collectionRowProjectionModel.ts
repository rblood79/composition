/**
 * ADR-912 영역 B 연장 (2026-06-05) — collection row projection 모델이
 * `@composition/shared` 의 collections 계약으로 hoist 됨 (resolveCollectionItems 단일 계약).
 *
 * 본 모듈은 **thin re-export alias** 로 유지(소비처 변경 0, ADR-912 C1 hoist 선례).
 * DOM wrapper(shared) 와 Skia projector(builder) 가 동일 `resolveCollectionItems` 순수
 * 계약을 소비하기 위해 family 무관 row normalizer 를 shared 로 이전했다.
 *
 * shared root export(`@composition/shared`)에서 collection 심볼만 명시 재export
 * (전체 `export *` 대신 named — alias 의도 명확 + collection 외 심볼 누출 차단).
 */

export {
  COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
  isRecord,
  readArray,
  isProjectionRowsInput,
  readDataBindingRows,
  readStringField,
  getItemKey,
  getItemLabel,
  getItemDescription,
  getItemIcon,
  getItemValue,
  getItemDisabled,
  toItemProjectionRow,
  getFlatProjectionRows,
  resolveCollectionItems,
  readTableColumns,
  getTableProjectionRows,
} from "@composition/shared";

export type {
  CollectionDataSource,
  CollectionProjectionRow,
  CollectionProjectionRowsInput,
  ResolvedCollectionItems,
  TableColumnDef,
  TableProjectionRow,
} from "@composition/shared";
