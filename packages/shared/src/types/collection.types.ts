/**
 * Collection Data Types
 *
 * useCollectionData 훅에서 사용하는 타입 정의
 * DI 패턴을 위한 서비스 인터페이스 포함
 *
 * @since 2025-01-02
 */

import type { DataBinding } from './element.types';

// ============================================
// Schema Types
// ============================================

/**
 * DataTable 스키마 필드
 */
export interface SchemaField {
  key: string;
  type: string;
  label?: string;
}

// ============================================
// DataTable Types
// ============================================

/**
 * DataTable 정의
 */
export interface DataTableDefinition {
  id: string;
  name: string;
  schema?: SchemaField[];
  mockData?: Record<string, unknown>[];
  runtimeData?: Record<string, unknown>[];
  useMockData?: boolean;
}

/**
 * DataTable 상태
 */
export interface CollectionState {
  data: Record<string, unknown>[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string | null;
}

// ============================================
// API Endpoint Types
// ============================================

/**
 * API Endpoint 헤더
 */
export interface ApiEndpointHeader {
  key: string;
  value: string;
  enabled: boolean;
}

/**
 * API Endpoint 정의
 */
export interface ApiEndpointDefinition {
  id: string;
  name: string;
  baseUrl: string;
  path: string;
  method?: string;
  headers?: ApiEndpointHeader[] | Record<string, string>;
}

// ============================================
// useCollectionData Options
// ============================================

/**
 * useCollectionData 옵션
 */
export interface UseCollectionDataOptions {
  /** 데이터 바인딩 설정 */
  dataBinding?: DataBinding;
  /** 컴포넌트 이름 (디버깅용) */
  componentName: string;
  /** Mock API 실패 시 사용할 기본 데이터 */
  fallbackData?: Record<string, unknown>[];
  /** DataTable ID (dataBinding 대신 사용) */
  datatableId?: string;
  /** 컴포넌트 ID (DataTable consumer 등록용) */
  elementId?: string;
}

/**
 * useCollectionData 반환값
 */
export interface UseCollectionDataResult {
  /** 가져온 데이터 배열 */
  data: Record<string, unknown>[];
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 (없으면 null) */
  error: string | null;
  /** 데이터 재로드 */
  reload: () => void;
  /** 캐시 삭제 (이 바인딩의 캐시만 삭제) */
  clearCache: () => void;
  /** DataTable 스키마 정보 (Field 자동 생성용) */
  schema?: SchemaField[];
  /** 정렬 함수 */
  sort?: (descriptor: {
    column: string;
    direction: 'ascending' | 'descending';
  }) => void;
  /** 필터 텍스트 */
  filterText?: string;
  /** 필터 텍스트 설정 */
  setFilterText?: (text: string) => void;
  /** 더 많은 데이터 로드 (페이지네이션) */
  loadMore?: () => void;
  /** 더 로드할 데이터가 있는지 여부 */
  hasMore?: boolean;
}

// ============================================
// Service Interfaces (for DI)
// ============================================

/**
 * DataTable 서비스 인터페이스
 */
export interface DataTableService {
  /** DataTable 상태 조회 */
  getDataTableState: (datatableId: string) => CollectionState | undefined;
  /** DataTable 목록 조회 */
  getDataTables: () => DataTableDefinition[];
  /** Consumer 등록 */
  addConsumer?: (datatableId: string, elementId: string) => void;
  /** Consumer 해제 */
  removeConsumer?: (datatableId: string, elementId: string) => void;
  /** DataTable 로드 */
  loadDataTable?: (datatableId: string) => void;
}

/**
 * API Endpoint 서비스 인터페이스
 */
export interface ApiEndpointService {
  /** API Endpoint 목록 조회 */
  getApiEndpoints: () => ApiEndpointDefinition[];
  /** API Endpoint 실행 */
  executeApiEndpoint?: (endpointId: string) => Promise<unknown>;
}

/**
 * Mock API 서비스 인터페이스
 */
export interface MockApiService {
  /** Mock API 함수 */
  mockFetch?: (
    endpoint: string,
    params?: Record<string, unknown>
  ) => Promise<unknown>;
}

/**
 * Collection Data 서비스 컨텍스트
 */
export interface CollectionDataServices {
  /** DataTable 서비스 */
  dataTableService?: DataTableService;
  /** API Endpoint 서비스 */
  apiEndpointService?: ApiEndpointService;
  /** Mock API 서비스 */
  mockApiService?: MockApiService;
  /** Canvas 컨텍스트 여부 (iframe 내부인지) */
  isCanvasContext?: boolean;
}

// ============================================
// AsyncListLoadOptions (from react-stately)
// ============================================

/**
 * React Stately의 AsyncListLoadOptions 대체 타입
 */
export interface AsyncListLoadOptions {
  signal: AbortSignal;
  cursor?: string;
  filterText?: string;
}

// ============================================
// PropertyDataBinding (for Builder components)
// ============================================

/**
 * 데이터 갱신 모드
 */
export type RefreshMode = 'manual' | 'onMount' | 'interval';

/**
 * Property Data Binding 값 (Builder 에디터용)
 * DataBinding과 다른 형식 - 더 간단한 바인딩 표현
 */
export interface PropertyDataBinding {
  /** 바인딩 소스 타입 */
  source: 'dataTable' | 'api' | 'variable' | 'route';
  /** 소스 이름 */
  name: string;
  /** 데이터 경로 (예: "items[0].name", "user.email") */
  path?: string;
  /** 기본값 */
  defaultValue?: unknown;
  /** 갱신 모드 (기본: manual) */
  refreshMode?: RefreshMode;
  /** 갱신 간격 (ms, interval 모드에서 사용) */
  refreshInterval?: number;
}

/**
 * DataBindingValue 타입 (하위 호환성)
 * @deprecated PropertyDataBinding 사용 권장
 */
export type DataBindingValue = PropertyDataBinding;
