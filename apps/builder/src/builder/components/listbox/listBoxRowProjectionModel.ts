/**
 * ListBox row projection 모델 — ADR-912 C1 에서 family 무관 부분이
 * `components/collection/collectionRowProjectionModel.ts` 로 hoist 됨.
 *
 * 본 모듈은 BC alias 로 유지(소비처 변경 0). ListBox 고유 API 명칭
 * (`getListBoxProjectionRows` / `ListBoxProjectionRow` / `ListBoxCollectionDataSource` /
 * `LISTBOX_ROW_PROJECTION_WINDOW_LIMIT`)을 collection 공통 구현으로 위임한다.
 */

import {
  COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
  getFlatProjectionRows,
  type CollectionDataSource,
  type CollectionProjectionRow,
  type CollectionProjectionRowsInput,
  type CollectionWindow,
} from "../collection/collectionRowProjectionModel";

export const LISTBOX_ROW_PROJECTION_WINDOW_LIMIT =
  COLLECTION_ROW_PROJECTION_WINDOW_LIMIT;

/** @deprecated ADR-912 C1 — `CollectionDataSource`(collection/) alias. */
export type ListBoxCollectionDataSource = CollectionDataSource;

/** @deprecated ADR-912 C1 — `CollectionProjectionRow`(collection/) alias. ListBox 는 항상 kind:'item'. */
export type ListBoxProjectionRow = CollectionProjectionRow;

/**
 * ListBox projected row 배열. collections/dataBinding/props.items 3경로 → flat item row.
 * ListBox 는 section 미지원 → `getFlatProjectionRows`(kind:'item' 만) 직접 위임.
 */
export function getListBoxProjectionRows(
  input: Record<string, unknown> | CollectionProjectionRowsInput | undefined,
  // ADR-150 A2: number(legacy 정적 cap) | CollectionWindow(scrollOffset 기반 절대 index).
  window: number | CollectionWindow = LISTBOX_ROW_PROJECTION_WINDOW_LIMIT,
): ListBoxProjectionRow[] {
  return getFlatProjectionRows(input, window);
}
