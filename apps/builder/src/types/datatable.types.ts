/**
 * DataTable Type Definitions
 *
 * DataTable 컴포넌트를 위한 타입 정의
 * 중앙 집중식 데이터 관리 및 여러 컴포넌트 간 데이터 공유를 지원
 *
 * @see docs/PLANNED_FEATURES.md - DataTable Component Architecture
 */

import type { DataBinding } from './builder/unified.types';

/**
 * DataTable 상태
 */
export type DataTableStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * DataTable Transform 설정
 */
export interface DataTableTransform {
  /** 정렬 설정 */
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };

  /** 필터 설정 */
  filter?: {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
    value: unknown;
  }[];

  /** 필드 매핑 (renaming) */
  map?: Record<string, string>;

  /** 선택할 필드들 (projection) */
  select?: string[];

  /** 제한할 아이템 수 */
  limit?: number;

  /** 건너뛸 아이템 수 */
  offset?: number;
}

/**
 * DataTable 설정
 */
export interface CollectionConfig {
  /** DataTable 고유 ID */
  id: string;

  /** DataTable 표시 이름 */
  name: string;

  /** 데이터 바인딩 설정 (API, Static, Supabase) */
  dataBinding: DataBinding;

  /** 설명 (옵션) */
  description?: string;

  /** 자동 새로고침 간격 (ms, 옵션) */
  refreshInterval?: number;

  /** 캐시 사용 여부 (기본: true) */
  useCache?: boolean;

  /** 캐시 만료 시간 (ms, 기본: 5분) */
  cacheTTL?: number;

  /** 데이터 변환 설정 (Phase 6 Advanced) */
  transform?: DataTableTransform;

  /** localStorage에 캐시 영속화 (Phase 6 Advanced) */
  persistCache?: boolean;
}

/**
 * DataTable 런타임 상태
 */
export interface CollectionState {
  /** DataTable ID */
  id: string;

  /** 현재 상태 */
  status: DataTableStatus;

  /** 로드된 데이터 */
  data: Record<string, unknown>[];

  /** 에러 메시지 (있는 경우) */
  error: string | null;

  /** 마지막 로드 시간 */
  lastLoadedAt: number | null;

  /** 데이터를 사용 중인 컴포넌트 ID 목록 */
  consumers: string[];
}

/**
 * DataTable Store 상태
 */
export interface DataTableStoreState {
  /** 모든 DataTable 설정 (id -> config) */
  collections: Map<string, CollectionConfig>;

  /** 모든 DataTable 런타임 상태 (id -> state) */
  dataTableStates: Map<string, CollectionState>;
}

/**
 * DataTable Store 액션
 */
export interface DataTableStoreActions {
  /** DataTable 등록 */
  registerDataTable: (config: CollectionConfig) => void;

  /** DataTable 제거 */
  unregisterDataTable: (dataTableId: string) => void;

  /** DataTable 데이터 로드 */
  loadDataTable: (dataTableId: string) => Promise<void>;

  /** DataTable 데이터 새로고침 */
  refreshDataTable: (dataTableId: string) => Promise<void>;

  /** 모든 DataTable 새로고침 */
  refreshAllDataTables: () => Promise<void>;

  /** DataTable에 소비자 등록 */
  addConsumer: (dataTableId: string, consumerId: string) => void;

  /** DataTable에서 소비자 제거 */
  removeConsumer: (dataTableId: string, consumerId: string) => void;

  /** DataTable 데이터 가져오기 */
  getDataTableData: (dataTableId: string) => Record<string, unknown>[];

  /** DataTable 상태 가져오기 */
  getDataTableState: (dataTableId: string) => CollectionState | undefined;

  /** DataTable 설정 업데이트 */
  updateDataTableConfig: (dataTableId: string, updates: Partial<CollectionConfig>) => void;

  /** 모든 DataTable 초기화 */
  clearAllDataTables: () => void;
}

/**
 * DataTable Store 전체 타입
 */
export type DataTableStore = DataTableStoreState & DataTableStoreActions;

/**
 * DataTable 컴포넌트 Props
 */
export interface DataTableProps {
  /** DataTable 고유 ID (필수) */
  id: string;

  /** DataTable 표시 이름 (옵션) */
  name?: string;

  /** 데이터 바인딩 설정 */
  dataBinding?: DataBinding;

  /** 설명 (옵션) */
  description?: string;

  /** 자동 새로고침 간격 (ms, 옵션) */
  refreshInterval?: number;

  /** 초기 로드 시 자동 로드 여부 (기본: true) */
  autoLoad?: boolean;
}

/**
 * DataTable을 사용하는 컴포넌트의 공통 Props
 */
export interface DataTableConsumerProps {
  /** 참조할 DataTable ID (dataBinding과 상호 배타적) */
  dataTableId?: string;

  /** 직접 데이터 바인딩 (dataTableId와 상호 배타적) */
  dataBinding?: DataBinding;
}

/**
 * useCollection 훅 반환 타입
 */
export interface UseDataTableResult {
  /** 로드된 데이터 */
  data: Record<string, unknown>[];

  /** 로딩 상태 */
  loading: boolean;

  /** 에러 메시지 */
  error: string | null;

  /** 데이터 새로고침 */
  refresh: () => Promise<void>;

  /** DataTable 상태 */
  status: DataTableStatus;
}

/**
 * 타입 가드: CollectionConfig 확인
 */
export function isDataTableConfig(config: unknown): config is CollectionConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    'id' in config &&
    'name' in config &&
    'dataBinding' in config
  );
}
