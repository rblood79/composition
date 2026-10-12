// src/shared/components/Table.tsx

import React from "react";

// ADR-159 P5: array/object 셀 컴포넌트 placeholder — 분류는 shared 단일 소스(G2 대칭),
//   칩 시각은 RAC TagGroup(read-only) + TagGroup.css.

import type { CollectionProjectionRow } from "../collections";

import { classifyTableCellDisplay } from "../collections/cellValue";

import type {
  ColumnMapping,
  ComponentSize,
  DataBinding,
  DataBindingValue,
} from "../types";

import { TableCellTags } from "./Table.components";

/** Rows per page a table offers. */
export const PAGE_SIZES = [5, 10, 20, 50, 100] as const;

/**
 * API Fetcher 타입 (DI용)
 */
export type ApiFetcher<T> = (
  endpoint: string,
  params: Record<string, unknown>,
) => Promise<T[]>;

/**
 * API Config 타입 (DI용)
 * apiFetcher prop으로 전달하거나, 이 타입의 객체를 컨텍스트로 제공
 */
export type ApiConfig = Record<string, ApiFetcher<unknown>>;

export function renderTableCellValue(value: unknown): React.ReactNode {
  if (React.isValidElement(value)) return value;
  if (value !== null && typeof value === "object") {
    const display = classifyTableCellDisplay(value);
    if (display.kind === "tags") {
      const chips =
        display.overflow > 0
          ? [...display.items, `+${display.overflow}`]
          : display.items;
      return <TableCellTags chips={chips} />;
    }
    return display.text;
  }
  return value as React.ReactNode;
}

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

/**
 * ADR-152 (Phase 3 deferred 후속): DOM Table 행 id = shared 정규화 행 key (`itemKey` —
 * fieldMap value 역할 → 없으면 `id` 컬럼 휴리스틱). Skia `getTableProjectionRows` 의
 * `getItemKey(item, i, roles)` 와 같은 값이라 두 leg 의 행 identity 가 일치한다.
 * TanStack `getRowId` 는 정렬·페이지 slice 뒤의 index 를 주므로 원본 index 가 아니라
 * item 참조로 찾는다 (object 가 아닌 행은 index 폴백).
 */
export function buildTableRowIdResolver(
  rows: readonly CollectionProjectionRow[],
): (item: unknown, index: number) => string {
  const byItem = new WeakMap<object, string>();
  for (const row of rows) {
    if (typeof row.item === "object" && row.item !== null) {
      byItem.set(row.item, row.itemKey);
    }
  }
  return (item, index) =>
    (typeof item === "object" && item !== null
      ? byItem.get(item)
      : undefined) ?? String(index);
}

export type PaginationMode = "pagination" | "infinite";

export interface ColumnDefinition<T> {
  key: keyof T;
  label: string;
  elementId?: string; // Column Element ID for selection
  order_num?: number; // order_num 추가
  allowsSorting?: boolean;
  enableResizing?: boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: "left" | "center" | "right";
}

export interface ColumnGroupDefinition {
  id: string;
  label: string;
  span: number;
  order_num?: number; // order_num 추가
  align?: "left" | "center" | "right";
  variant?: "default" | "primary" | "secondary";
  sticky?: boolean;
}

// 데이터 매핑 인터페이스
export interface DataMapping {
  resultPath?: string; // API 응답에서 데이터 배열 경로 (예: "results", "data")
  idKey?: string; // 고유 식별자 필드 (예: "id", "name")
  totalKey?: string; // 전체 개수 필드 (예: "total", "count")
}

export interface TableProps<T extends { id: string | number }> {
  [attribute: `data-${string}`]: unknown;
  className?: string;
  /** Root div inline style — ADR-907 Phase 5 Layer C (a) O 전환 */
  style?: React.CSSProperties;
  "data-element-id"?: string;
  tableHeaderElementId?: string; // TableHeader Element ID for selection

  // M3 props
  variant?: string;
  size?: ComponentSize;

  // 데이터 바인딩 (PropertyDataBinding 형식 지원)
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;

  // 데이터 소스: 정적 or 비동기
  data?: T[]; // 정적 데이터면 API 호출 안 함
  apiUrlKey?: string; // apiConfig 키 (예: "demo")
  customApiUrl?: string; // Custom API URL (apiUrlKey가 "CUSTOM"일 때 사용)
  endpointPath?: string; // 엔드포인트 (예: "/users")
  enableAsyncLoading?: boolean; // true일 때만 API 사용
  dataMapping?: DataMapping; // 데이터 매핑 설정
  apiParams?: Record<string, unknown>; // API 파라미터
  apiConfig?: ApiConfig; // API 설정 (DI)

  // 컬럼
  columns: ColumnDefinition<T>[];
  columnGroups?: ColumnGroupDefinition[]; // Column Groups 추가

  // 표 옵션
  paginationMode?: PaginationMode; // 'pagination' | 'infinite'
  itemsPerPage?: number; // default: 50
  height?: number; // 뷰포트 높이, default: 400
  heightMode?: "auto" | "fixed" | "viewport" | "full"; // 높이 모드
  heightUnit?: "px" | "vh" | "rem" | "em"; // 높이 단위
  viewportHeight?: number; // 뷰포트 높이 비율 (%), default: 50
  rowHeight?: number; // 추정 행 높이, default: 40
  overscan?: number; // default: 12

  // 정렬 초기값
  sortColumn?: keyof T | string;
  sortDirection?: "ascending" | "descending";

  // 기능
  enableResize?: boolean; // default: true

  // 콜백
  onColumnsDetected?: (columns: ColumnDefinition<T>[]) => void; // 자동 감지된 컬럼 전달
  onItemsPerPageChange?: (itemsPerPage: number) => void; // 페이지당 항목 수 변경 콜백

  /**
   * Show loading skeleton instead of table
   * @default false
   */
  isLoading?: boolean;
  /**
   * Number of skeleton rows to show when loading
   * @default 5
   */
  skeletonRowCount?: number;
}

// Table className helper
export const getTableClassName = (
  variant: string,
  size: ComponentSize,
  className?: string,
) => (className ? `react-aria-Table ${className}` : "react-aria-Table");
