/**
 * React Stately Type Definitions
 *
 * React Stately 공통 타입 정의
 * 모든 Phase에서 사용되는 React Stately 관련 타입
 */

import type { Key, Selection } from "react-stately";
import type { FieldType } from "./unified.types";

/**
 * 리스트 데이터 아이템 기본 인터페이스
 * useListData에서 사용
 */
export interface ListDataItem {
  /** 고유 키 (필수) */
  id: string;
  /** 추가 속성 */
  [key: string]: unknown;
}

/**
 * 컬럼 리스트 아이템 (Phase 2: Data Section)
 * APICollectionEditor, SupabaseCollectionEditor에서 사용
 */
export interface ColumnListItem extends ListDataItem {
  /** 컬럼 키 (데이터 필드명) */
  key: string;
  /** 표시 레이블 */
  label: string;
  /** 데이터 타입 */
  type: FieldType;
  /** 선택 여부 */
  selected?: boolean;
  /** 표시 순서 */
  order?: number;
}

/**
 * 트리 데이터 아이템 기본 인터페이스
 * useTreeData에서 사용
 */
export interface TreeDataItem extends ListDataItem {
  /** 자식 노드 */
  children?: TreeDataItem[];
}

/**
 * Element 트리 아이템 (Phase 3: Sidebar Tree)
 * Sidebar의 요소 계층 구조 표현
 */
export interface ElementTreeItem extends TreeDataItem {
  /** React Aria 컴포넌트 태그 */
  type: string;
  /** 부모 요소 ID (flat 구조와의 호환성) */
  parent_id?: string | null;
  /** 컴포넌트 props */
  props?: Record<string, unknown>;
  /** 삭제 여부 */
  deleted?: boolean;
  /** 데이터 바인딩 설정 */
  dataBinding?: Record<string, unknown>;
  /** 자식 요소들 */
  children?: ElementTreeItem[];
}

/**
 * 비동기 리스트 로드 옵션
 * useAsyncList의 load 함수 파라미터
 */
export interface AsyncListLoadOptions {
  /** AbortController signal (자동 cleanup) */
  signal: AbortSignal;
  /** 페이지네이션 커서 (옵션) */
  cursor?: string;
  /** 필터 키워드 (옵션) */
  filterText?: string;
}

/**
 * 비동기 리스트 로드 결과
 * useAsyncList의 load 함수 반환값
 */
export interface AsyncListLoadResult<T> {
  /** 로드된 아이템 목록 */
  items: T[];
  /** 다음 페이지 커서 (옵션) */
  cursor?: string;
}

/**
 * 리스트 상태 옵션
 * useListState에서 사용
 */
export interface ListStateOptions<T> {
  /** 초기 아이템 목록 */
  items: T[];
  /** 선택 모드 */
  selectionMode?: "none" | "single" | "multiple";
  /** 빈 선택 허용 여부 */
  disallowEmptySelection?: boolean;
  /** 초기 선택된 키 */
  defaultSelectedKeys?: Iterable<Key>;
  /** 선택 변경 이벤트 */
  onSelectionChange?: (keys: Selection) => void;
}

/**
 * 트리 상태 옵션
 * useTreeState에서 사용
 */
export interface TreeStateOptions<T> {
  /** 트리 컬렉션 */
  collection: T[];
  /** 선택 모드 */
  selectionMode?: "none" | "single" | "multiple";
  /** 빈 선택 허용 여부 */
  disallowEmptySelection?: boolean;
  /** 초기 펼쳐진 키 */
  expandedKeys?: Set<Key>;
  /** 펼침 상태 변경 이벤트 */
  onExpandedChange?: (keys: Set<Key>) => void;
  /** 선택 변경 이벤트 */
  onSelectionChange?: (keys: Selection) => void;
}

/**
 * 페이지네이션 상태 옵션
 * usePaginationState에서 사용
 */
export interface PaginationStateOptions {
  /** 전체 페이지 수 */
  totalPages: number;
  /** 초기 페이지 (기본값: 1) */
  initialPage?: number;
  /** 페이지 변경 이벤트 */
  onChange?: (page: number) => void;
  /** 한 번에 표시할 페이지 번호 개수 (기본값: 5) */
  maxVisiblePages?: number;
}

/**
 * 테이블 상태 옵션
 * useTableState에서 사용
 */
export interface TableStateOptions<T> {
  /** 테이블 데이터 */
  items: T[];
  /** 선택 모드 */
  selectionMode?: "none" | "single" | "multiple";
  /** 정렬 설정 */
  sortDescriptor?: {
    column: Key;
    direction: "ascending" | "descending";
  };
  /** 정렬 변경 이벤트 */
  onSortChange?: (descriptor: {
    column: Key;
    direction: "ascending" | "descending";
  }) => void;
  /** 선택 변경 이벤트 */
  onSelectionChange?: (keys: Selection) => void;
}

/**
 * React Stately 훅 반환값 공통 타입
 */

/**
 * useListData 반환값
 */
export interface UseListDataResult<T> {
  /** 아이템 목록 */
  items: T[];
  /** 아이템 추가 (끝에) */
  append: (...items: T[]) => void;
  /** 아이템 추가 (앞에) */
  prepend: (...items: T[]) => void;
  /** 아이템 삽입 */
  insert: (index: number, ...items: T[]) => void;
  /** 아이템 제거 */
  remove: (...keys: Key[]) => void;
  /** 선택된 아이템 제거 */
  removeSelectedItems: () => void;
  /** 아이템 이동 */
  move: (key: Key, toIndex: number) => void;
  /** 아이템 업데이트 */
  update: (key: Key, newItem: T | ((oldItem: T) => T)) => void;
  /** 아이템 가져오기 */
  getItem: (key: Key) => T | undefined;
  /** 선택된 키 */
  selectedKeys: Set<Key>;
  /** 선택된 키 설정 */
  setSelectedKeys: (keys: Set<Key> | "all") => void;
}

/**
 * useAsyncList 반환값
 */
export interface UseAsyncListResult<T> {
  /** 아이템 목록 */
  items: T[];
  /** 로딩 중 여부 */
  isLoading: boolean;
  /** 에러 */
  error: Error | null;
  /** 재로드 */
  reload: () => void;
  /** 더 로드 (페이지네이션) */
  loadMore?: () => void;
  /** 정렬 */
  sort?: (descriptor: {
    column: Key;
    direction: "ascending" | "descending";
  }) => void;
  /** 필터 텍스트 */
  filterText?: string;
  /** 필터 텍스트 설정 */
  setFilterText?: (text: string) => void;
}

/**
 * useTreeData 반환값
 */
export interface UseTreeDataResult<T extends TreeDataItem> {
  /** 트리 아이템 */
  items: T[];
  /** 아이템 추가 */
  append: (parentKey: Key | null, ...items: T[]) => void;
  /** 아이템 삽입 */
  insert: (parentKey: Key | null, index: number, ...items: T[]) => void;
  /** 아이템 제거 */
  remove: (...keys: Key[]) => void;
  /** 아이템 업데이트 */
  update: (key: Key, newItem: T | ((oldItem: T) => T)) => void;
  /** 아이템 이동 */
  move: (key: Key, toParentKey: Key | null, index: number) => void;
  /** 아이템 가져오기 */
  getItem: (key: Key) => T | undefined;
}

/**
 * useTreeState 반환값
 */
export interface UseTreeStateResult {
  /** 트리 컬렉션 */
  collection: Iterable<unknown>;
  /** 선택 관리자 */
  selectionManager: {
    selectedKeys: Set<Key>;
    isSelected: (key: Key) => boolean;
    setSelectedKeys: (keys: Set<Key>) => void;
    clearSelection: () => void;
  };
  /** 펼쳐진 키 */
  expandedKeys: Set<Key>;
  /** 키 토글 (펼침/접기) */
  toggleKey: (key: Key) => void;
}

/**
 * usePaginationState 반환값
 */
export interface UsePaginationStateResult {
  /** 현재 페이지 */
  currentPage: number;
  /** 전체 페이지 수 */
  totalPages: number;
  /** 표시할 페이지 번호 목록 */
  visiblePages: number[];
  /** 이전 페이지로 이동 가능 여부 */
  canGoPrevious: boolean;
  /** 다음 페이지로 이동 가능 여부 */
  canGoNext: boolean;
  /** 이전 페이지로 이동 */
  previous: () => void;
  /** 다음 페이지로 이동 */
  next: () => void;
  /** 첫 페이지로 이동 */
  first: () => void;
  /** 마지막 페이지로 이동 */
  last: () => void;
  /** 특정 페이지로 이동 */
  setPage: (page: number) => void;
}

/**
 * React Stately 유틸리티 타입
 */

/**
 * 키 추출 함수 타입
 */
export type GetKey<T> = (item: T) => Key;

/**
 * 자식 추출 함수 타입
 */
export type GetChildren<T> = (item: T) => T[] | undefined;

/**
 * 비동기 로드 함수 타입
 */
export type AsyncLoadFunction<T> = (
  options: AsyncListLoadOptions,
) => Promise<AsyncListLoadResult<T>>;

/**
 * React Stately 훅 옵션 공통 속성
 */
export interface CommonStatelyOptions<T> {
  /** 초기 아이템 목록 */
  initialItems?: T[];
  /** 키 추출 함수 */
  getKey: GetKey<T>;
}

/**
 * React Stately 에러 타입
 */
export class StatelyError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "StatelyError";
  }
}

/**
 * React Stately 에러 코드
 */
export enum StatelyErrorCode {
  INVALID_KEY = "INVALID_KEY",
  ITEM_NOT_FOUND = "ITEM_NOT_FOUND",
  LOAD_FAILED = "LOAD_FAILED",
  INVALID_INDEX = "INVALID_INDEX",
  DUPLICATE_KEY = "DUPLICATE_KEY",
}
