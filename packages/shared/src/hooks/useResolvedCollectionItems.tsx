/**
 * useResolvedCollectionItems — collection items 단일 계약의 DOM hook adapter (ADR-912 영역 B 연장).
 *
 * **목적 (설계 §2-D)**: `resolveCollectionItems` 순수 계약은 동기 함수라 async/dataTable/API
 * source 를 해소하지 못한다(Skia projector 는 builder 가 보유한 collections snapshot 을 넘겨
 * 순수 함수로 충분하지만, DOM wrapper 는 `useCollectionData` 의 DI 경유 비동기 해소가 필요).
 *
 * 본 hook 은 그 경계를 닫는다:
 * 1. `useCollectionData({ dataBinding, ... })` 로 async/dataTable/API source 를 `boundData` 로 해소
 * 2. dataBinding 이 있으면 `boundData`, 없으면 정적 `props.items` 를 source rows 로 선택
 *    (resolveCollectionItems 순수 계약의 우선순위와 동일: dataBinding 우선 → 정적 items)
 * 3. 선택된 source rows 를 **Skia projector 와 동일한 `toItemProjectionRow` normalizer** 로 정규화
 *
 * → DOM wrapper 와 Skia projector 가 **같은 row 형태**(CollectionProjectionRow)를 산출한다 = 시각 대칭 SSOT.
 *
 * **금지 (설계 §2-D)**:
 * - wrapper 별 `if (!hasDataBinding && items)` 분기 복제 (ADR-142 no-classification 역행)
 * - wrapper 에서 `useCollectionDataServices()` 직접 호출 / `collections` store 직접 import
 *   → 본 hook 이 유일한 DOM 진입점.
 */

import { useMemo } from "react";
import type { DataBinding } from "../types";
import {
  toItemProjectionRow,
  COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
  type CollectionProjectionRow,
  type ResolvedCollectionItems,
} from "../collections";
import { useCollectionData } from "./useCollectionData";

export interface UseResolvedCollectionItemsOptions {
  /** 데이터 바인딩 (dataTable/static/collection/API). 있으면 boundData 우선. */
  dataBinding?: DataBinding;
  /** 정적 items SSOT (dataBinding 없을 때 source). ADR-097 P2 패턴. */
  items?: unknown[];
  /** 컴포넌트 이름 (useCollectionData 디버깅용). */
  componentName: string;
  /** dataBinding 미해소 시 fallback (useCollectionData 경유). */
  fallbackData?: Record<string, unknown>[];
  /** DataTable ID (dataBinding 대신). */
  datatableId?: string;
  /** 컴포넌트 ID (DataTable consumer 등록용). */
  elementId?: string;
  /** window limit (기본 100). */
  windowLimit?: number;
}

export interface UseResolvedCollectionItemsResult extends ResolvedCollectionItems {
  /** async/dataTable 로딩 상태 (useCollectionData 경유). */
  loading: boolean;
  /** 에러 메시지 (없으면 null). */
  error: string | null;
}

/**
 * collection items 를 정규화된 row 로 해소하는 DOM hook.
 *
 * dataBinding 이 실제 데이터를 산출하면 그 boundData 를, 아니면 정적 items 를 source 로 쓴다.
 * 양쪽 모두 `toItemProjectionRow` 로 정규화 → Skia projector(getFlatProjectionRows)와 동일 형태.
 */
export function useResolvedCollectionItems(
  options: UseResolvedCollectionItemsOptions,
): UseResolvedCollectionItemsResult {
  const {
    dataBinding,
    items,
    componentName,
    fallbackData = [],
    datatableId,
    elementId,
    windowLimit = COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
  } = options;

  // async/dataTable/API source 해소 (DI 경유 — 순수 함수가 못하는 비동기).
  const {
    data: boundData,
    loading,
    error,
  } = useCollectionData({
    dataBinding,
    componentName,
    fallbackData,
    datatableId,
    elementId,
  });

  // dataBinding 이 실제 행을 산출했는지 — 산출했으면 boundData, 아니면 정적 items.
  //   resolveCollectionItems 순수 계약의 우선순위와 동일 (dataBinding 우선 → props.items).
  //   단 DOM 은 dataBinding 해소가 useCollectionData 책임이므로 boundData.length 로 판정.
  const hasBoundRows = Array.isArray(boundData) && boundData.length > 0;
  const hasStaticItems = Array.isArray(items) && items.length > 0;

  return useMemo<UseResolvedCollectionItemsResult>(() => {
    const sourceRows: unknown[] = hasBoundRows
      ? boundData
      : hasStaticItems
        ? (items as unknown[])
        : [];

    const sourceKind: ResolvedCollectionItems["sourceKind"] = hasBoundRows
      ? "dataBinding"
      : hasStaticItems
        ? "static-items"
        : "empty";

    const rows: CollectionProjectionRow[] = sourceRows
      .slice(0, windowLimit)
      .map((item, rowIndex) => toItemProjectionRow(item, rowIndex));

    return { rows, sourceKind, loading, error };
    // boundData/items 참조 동일성 + 길이 기반 — hasBoundRows/hasStaticItems 가 deps 대표.
  }, [
    boundData,
    items,
    hasBoundRows,
    hasStaticItems,
    windowLimit,
    loading,
    error,
  ]);
}
