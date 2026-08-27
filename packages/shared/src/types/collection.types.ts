/**
 * Collection Data Types
 *
 * useCollectionData 훅에서 사용하는 타입 정의
 * DI 패턴을 위한 서비스 인터페이스 포함
 *
 * @since 2025-01-02
 */

import type { DataBinding } from "./element.types";

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
  status: "idle" | "loading" | "success" | "error";
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
    direction: "ascending" | "descending";
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
    params?: Record<string, unknown>,
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
 * 데이터 갱신 모드 — **read 호환 전용 (오소링 UI 제거됨, 2026-07-24)**.
 *
 * **Why 제거**: (1) RAC/RSP 어느 collection 레퍼런스에도 "갱신 주기" 개념이 없다
 * (RAC 비동기 표면은 `useAsyncList` 의 load/loadMore/reload/sort + loadingState/
 * onLoadMore 뿐) → D2 기준 RSP 미규정 prop. (2) 유일한 소비처인 `useCollectionData`
 * auto-refresh effect 가 `if (!isApiBinding) return` 로 시작하는데, ADR-159 P4b 로
 * 오소링이 `source:"dataTable"` 고정이라 신규 바인딩은 항상 실행 0. (3) `"onMount"`
 * 는 api 바인딩에서조차 소비처 0건 (effect 가 `"interval"` 만 분기).
 *
 * 기존 저장 문서의 값은 편집 시에도 보존한다 (builder `PropertyDataBinding` 의
 * `handleNameChange` 가 `value?.refreshMode` 를 그대로 재기록). 타입·필드·소비
 * effect 물리 제거는 api 바인딩 잔존 문서 실측이 필요하므로 ADR-159 P4c 의 G4
 * 게이트와 함께 처리.
 */
export type RefreshMode = "manual" | "onMount" | "interval";

/**
 * Property Data Binding 값 — 인스펙터 `kind:"binding"` 필드의 wire 형상.
 *
 * `DataBinding`(canonical collection 바인딩)과 다른, 더 단순한 표현이다.
 * 이 shape 의 **정본은 여기 하나**다 — builder 의
 * `components/property/PropertyDataBinding.tsx` 는 이것을 `DataBindingValue`
 * 로 재수출하기만 한다 (종전에는 같은 shape 를 양쪽에 각각 선언했고, ADR-159
 * 의 read-호환 근거 주석이 builder 쪽에만 실려 있어 shared 사본을 보는 쪽은
 * 그 계약을 알 수 없었다).
 */
export interface PropertyDataBinding {
  /**
   * 바인딩 소스 타입.
   *
   * **ADR-159 P4b (2026-07-24)**: 오소링(신규 기록)은 `"dataTable"` 단일 —
   * composition 의 데이터 방향은 모든 동적·정적 데이터를 collection 방식
   * (ADR-132 계보)으로 처리한다. `"api" | "variable" | "route"` 는 기존 저장
   * 문서 read 호환용 잔존 타입 (runtime dispatch 는 P4c 에서 소비처 0 확증 후
   * 정리 — G4 게이트).
   */
  source: "dataTable" | "api" | "variable" | "route";
  /** 소스 이름 */
  name: string;
  /**
   * 데이터 경로 — **read 호환 전용 (오소링 UI 제거됨, 2026-07-24)**.
   *
   * **Why 제거**: 실제 해석기는 `preview/hooks/useDataSource.ts` 의
   * `useDataBinding` 하나뿐인데 그 모듈이 import 0건(dead)이다. 살아있는
   * 소비처는 `useCollectionDataCache.createCacheKey` 의 캐시 키 문자열뿐 —
   * 값을 바꿔도 캐시만 무효화되고 로드 데이터는 불변. 실제 행 read 경로
   * (`readDataBindingRows`, Skia projection + DOM 공통)와 `useCollectionData`
   * 는 `source`/`name` 만 읽는다.
   *
   * 계약상으로도 어긋난다: `kind:"binding"` 은 collection 컴포넌트 전용이라
   * 결과가 항상 **행 배열**인데 `items[0].name` 은 단일 값 드릴다운 문법이다.
   * 행 안에서 필드를 고르는 일은 ADR-159 `{field}` 템플릿(경로 접근 + 포맷)이
   * 담당한다.
   *
   * 필드는 캐시 키 호환을 위해 유지하고, 기존 값은 컬렉션 변경 시에도 보존한다.
   */
  path?: string;
  /** 기본값 */
  defaultValue?: unknown;
  /** 갱신 모드 (기본: manual) */
  refreshMode?: RefreshMode;
  /** 갱신 간격 (ms, interval 모드에서 사용) */
  refreshInterval?: number;
}

/**
 * `PropertyDataBinding` 의 별칭.
 *
 * @deprecated 로 표시하지 않는다 — 실측상 collection 컴포넌트 13종
 * (`ListBox`/`Select`/`Menu`/`Table`/`Tabs`/`TagGroup`/`GridList`/`ComboBox`/
 * `Breadcrumbs`/`RadioGroup`/`CheckboxGroup`/`ToggleButtonGroup`/`Tree`)의
 * `dataBinding` prop 과 builder 인스펙터가 **이 이름으로만** 소비한다. builder
 * 쪽에서는 동명 컴포넌트 `PropertyDataBinding` 과 식별자가 충돌해 별칭 쪽이
 * 유일한 선택지다.
 */
export type DataBindingValue = PropertyDataBinding;
