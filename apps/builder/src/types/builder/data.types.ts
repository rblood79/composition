import type {
  DataChange,
  DataOp,
  ExecutionPolicy,
  VariableMigrationStatus,
  VariableOwner,
} from "@composition/shared";

export type { ExecutionPolicy } from "@composition/shared";

/**
 * Data Panel System Type Definitions
 *
 * DataTable = 스키마 + Mock 데이터 + 런타임 데이터
 * ApiEndpoint = 외부 API 연결 설정 + 응답 매핑
 * Variable = 앱 전역/페이지 상태 관리
 */

// ============================================
// DataTable (데이터 테이블)
// ============================================

/**
 * 데이터 필드 타입
 */
export type DataFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "email"
  | "url"
  | "image"
  | "array"
  | "object";

/**
 * 데이터 필드 정의
 */
export interface DataField {
  /**
   * v2.1 (ADR-152): 안정 참조 — `{#id}` 템플릿 저장형 · fieldMap · 차트 시리즈가
   * 참조. store 진입 경계 (`normalizeCollection`) 가 부여하고 id 없던 collection 은
   * hydrate 직후 1회 write-back. rename 은 `key` 만 바꾼다.
   */
  id?: string;

  /** 필드 키 (예: "id", "name", "email") — 행 key · 표시 이름 */
  key: string;

  /** 필드 타입 */
  type: DataFieldType;

  /** UI 표시용 레이블 */
  label?: string;

  /** 필수 여부 */
  required?: boolean;

  /** 기본값 */
  defaultValue?: unknown;

  /** 중첩 스키마 (type이 "object" 또는 "array"인 경우) */
  children?: DataField[];
}

/**
 * DataTable 타입 (collections 테이블)
 */
export interface DataTable {
  id: string;
  name: string; // "users", "products"
  project_id: string;

  /** 설명 */
  description?: string;

  /** 스키마 정의 */
  schema: DataField[];

  /** Mock 데이터 (개발용) */
  mockData: Record<string, unknown>[];

  /** 런타임 데이터 (API 응답 저장) - 메모리에만 존재, DB에 저장 안함 */
  runtimeData?: Record<string, unknown>[];

  /** true면 mockData 사용, false면 API 결과 사용 */
  useMockData: boolean;

  /** ADR-218 — 실행 정책. 미설정 = manual (BC read 호환). */
  executionPolicy?: ExecutionPolicy;

  created_at?: string;
  updated_at?: string;
}

/**
 * DataTable 생성용 타입
 */
export type DataTableCreate = Pick<DataTable, "name" | "project_id"> & {
  schema?: DataField[];
  mockData?: Record<string, unknown>[];
  useMockData?: boolean;
};

/**
 * DataTable 업데이트용 타입
 */
export type DataTableUpdate = Partial<
  Pick<
    DataTable,
    | "name"
    | "schema"
    | "mockData"
    | "runtimeData"
    | "useMockData"
    | "executionPolicy"
  >
>;

// ============================================
// API Endpoint (API 엔드포인트)
// ============================================

/**
 * HTTP 메서드 타입
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * API 헤더
 */
export interface ApiHeader {
  key: string;
  value: string; // 변수 포함 가능: "Bearer {{authToken}}"
  enabled: boolean;
}

/**
 * API 파라미터
 */
export interface ApiParam {
  key: string;
  value: string; // 변수 포함 가능: "{{searchQuery}}"
  type: "string" | "number" | "boolean";
  required: boolean;
}

/**
 * 페이지네이션 설정
 */
export interface PaginationConfig {
  type: "offset" | "cursor" | "page";
  totalPath?: string; // "meta.total"
  nextCursorPath?: string; // "meta.nextCursor"
}

/**
 * 응답 매핑 설정
 */
export interface ResponseMapping {
  /** JSON Path to data array/object (예: "data", "response.items", "results") */
  dataPath: string;

  /** 필드 매핑 (선택적, 이름 변환용) */
  fieldMappings?: {
    sourceKey: string; // API 응답 필드
    targetKey: string; // DataTable 필드
  }[];

  /** 페이지네이션 설정 (선택적) */
  pagination?: PaginationConfig;
}

/**
 * Body 타입
 */
export type BodyType = "json" | "form-data" | "x-www-form-urlencoded" | "none";

/**
 * 실행 모드 (클라이언트 vs 서버)
 */
export type ExecutionMode = "client" | "server";

/**
 * 서버 실행 설정 (API 키 보호용)
 */
export interface ServerConfig {
  /** 서버 측 실행 함수(엔드포인트) 이름 — 서버 실행 모드 전용 */
  edgeFunctionName: string;

  /** Vault 시크릿 매핑 */
  secretMappings?: {
    headerKey: string; // 예: "Authorization"
    vaultKey: string; // 예: "STRIPE_SECRET_KEY"
    format?: string; // 예: "Bearer {value}"
  }[];

  /** 응답 필터링 */
  responseFilter?: {
    removeFields?: string[];
    allowFields?: string[];
  };
}

/**
 * API Endpoint 타입 (api_endpoints 테이블)
 */
export interface ApiEndpoint {
  id: string;
  name: string; // "getUsers", "createUser"
  project_id: string;

  /** 설명 */
  description?: string;

  // Request Configuration
  method: HttpMethod;
  baseUrl: string; // "https://api.example.com"
  path: string; // "/users" or "/users/{{userId}}"

  // Headers
  headers: ApiHeader[];

  // Query Parameters (GET)
  queryParams: ApiParam[];

  // Body (POST, PUT, PATCH)
  bodyType: BodyType;
  bodyTemplate?: string; // JSON template with variables

  // Response Handling
  responseMapping: ResponseMapping;

  // Target DataTable
  /** v2.1 (ADR-152): 안정 참조 — sink 는 id 우선, `targetCollection` (이름) fallback */
  targetCollectionId?: string;
  targetCollection?: string; // DataTable name to populate (v1 잔존 · 표시용)

  // Server-side Execution (API key protection)
  executionMode: ExecutionMode;
  serverConfig?: ServerConfig;

  // Settings
  timeout?: number; // ms, default 30000
  retryCount?: number; // default 0

  created_at?: string;
  updated_at?: string;
}

/**
 * ApiEndpoint 생성용 타입
 */
export type ApiEndpointCreate = Pick<
  ApiEndpoint,
  "name" | "project_id" | "method" | "baseUrl" | "path"
> & {
  headers?: ApiHeader[];
  queryParams?: ApiParam[];
  bodyType?: BodyType;
  bodyTemplate?: string;
  responseMapping?: ResponseMapping;
  targetCollectionId?: string;
  targetCollection?: string;
  executionMode?: ExecutionMode;
  serverConfig?: ServerConfig;
  timeout?: number;
  retryCount?: number;
};

/**
 * ApiEndpoint 업데이트용 타입
 */
export type ApiEndpointUpdate = Partial<
  Omit<ApiEndpoint, "id" | "project_id" | "created_at" | "updated_at">
>;

// ============================================
// Variable (전역 변수)
//
// 도메인 경계 (ADR-143): 본 `Variable` 타입 / `variables` IndexedDB store 는
// 앱 런타임 상태(`authToken` / `currentUser` 류 — app-logic 도메인)다.
// canonical document 의 `tokens` 필드(D3 시각 design token — ADR-143 으로
// `variables` → `tokens` 정명)와 단어가 겹치지만 **별개 도메인**이며 서로
// 참조·통합하지 않는다. 시각 토큰은 `composition-document.types.ts` 의
// `CompositionDocument.tokens` / `TokensSnapshot` 참조.
// ============================================

/**
 * 변수 타입
 */
export type VariableType = "string" | "number" | "boolean" | "object" | "array";

/**
 * 변수 스코프
 */
export type VariableScope = "global" | "page" | "component";

/**
 * Variable 유효성 검사 규칙
 */
export interface VariableValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  schema?: string; // JSON Schema for object/array types
}

/**
 * Variable 타입 (variables 테이블)
 */
export interface Variable {
  id: string;
  name: string; // "authToken", "currentUser", "theme"
  project_id: string;

  type: VariableType;
  defaultValue?: unknown;

  /** localStorage에 저장할지 */
  persist: boolean;

  /** 전역 또는 페이지 범위 */
  scope: VariableScope;

  /** scope가 "page"인 경우 페이지 ID */
  page_id?: string;

  /**
   * 소유자 (ADR-214 Phase 1, additive). 이 store 의 변수는 전부 프로젝트 저장이므로
   * 정상 값은 `{ kind: "project" }` 이고, `{ kind: "page" }` 는 `scope:"page" + page_id`
   * 구 데이터의 읽기 변환 결과다 (페이지 변수의 정본은 canonical 페이지 노드 `state`).
   * 로드 시 `migrateVariableOwners` 가 채우며 저장 전까지 IndexedDB 원본은 재직렬화하지 않는다.
   * `scope` / `page_id` 는 하위 호환 (`isVariable` 가드 · 구 UI) 으로 남긴다.
   */
  owner?: VariableOwner;

  /**
   * HC3 — `scope:"component"` (및 `page` without `page_id`) 를 project 로 승격한 표식.
   * 인덱스 배지 · 로그가 읽는다. 조용한 변환 0.
   */
  migrationStatus?: VariableMigrationStatus;

  /** 유효성 검사 규칙 */
  validation?: VariableValidation;

  /** 변환 함수 코드 (value, context) => transformedValue */
  transform?: string;

  created_at?: string;
  updated_at?: string;
}

/**
 * Variable 생성용 타입
 */
export type VariableCreate = Pick<Variable, "name" | "project_id" | "type"> & {
  defaultValue?: unknown;
  persist?: boolean;
  scope?: VariableScope;
  page_id?: string;
};

/**
 * Variable 업데이트용 타입
 */
export type VariableUpdate = Partial<
  Pick<
    Variable,
    | "name"
    | "type"
    | "defaultValue"
    | "persist"
    | "scope"
    | "page_id"
    | "validation"
    | "transform"
  >
>;

// ============================================
// DataBinding (Visual Picker 하이브리드)
// ============================================

/**
 * 바인딩 표현식 타입
 */
export type BindingExpressionType =
  | "static" // 정적 값
  | "dataTable" // DataTable 필드 참조
  | "variable" // Variable 참조
  | "expression"; // Mustache 표현식

/**
 * 바인딩 표현식
 */
export interface BindingExpression {
  type: BindingExpressionType;

  /** type: "static" - 정적 값 */
  value?: unknown;

  /** type: "dataTable" - DataTable 참조 */
  dataTable?: string; // "users"
  field?: string; // "name"
  index?: number | string; // 0 or "{{selectedIndex}}"

  /** type: "variable" - Variable 참조 */
  variable?: string; // "currentUser"
  path?: string; // "profile.name"

  /** type: "expression" - Mustache 표현식 */
  expression?: string; // "{{users.length > 0 ? users[0].name : 'No data'}}"
}

/**
 * Element DataBinding (Element.dataBinding 확장)
 */
export interface ElementDataBinding {
  /** Collection Binding (ListBox, GridList 등) */
  dataSource?: string; // DataTable name: "users"

  /** Field Bindings */
  bindings?: {
    [propKey: string]: BindingExpression;
  };
}

// ============================================
// Store Types
// ============================================

/**
 * API endpoint 실행 스냅샷 — ADR-213 Phase 3 ("왜 실패했지?" 의 컨텍스트 원천).
 *
 * `executeApiEndpoint` 가 성공 · 실패 모두 endpoint 당 **마지막 1건** 을 남긴다 (세션 전용 ·
 * 저장 안 함). 값은 **원문** 이다 — AI 가 읽는 경로 (`explain_request_failure` ·
 * `list/get_api_endpoint` lastRun) 는 공유 redactor 를 지난 뒤에만 provider 로 나간다 (HC5).
 */
export interface ApiRunRecord {
  runId: string;
  endpointId: string;
  /** ISO — 요청 시작 시각 */
  startedAt: string;
  durationMs: number;
  ok: boolean;
  request: {
    method: HttpMethod;
    /** 변수 치환 · query 까지 붙은 최종 URL (proxy 경로 아님) */
    url: string;
    headers: Record<string, string>;
    bodyType: BodyType;
    body?: string;
  };
  /** fetch 가 응답을 받았을 때만 — 네트워크 오류 · timeout 은 `null` */
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    /** 본문 앞부분 (`API_RUN_BODY_PREVIEW_MAX_BYTES`) — 실패 응답도 남긴다 */
    bodyPreview: string;
    bodyTruncated: boolean;
    bodyBytes: number;
  } | null;
  /** 실패 사유 (HTTP 상태 · 네트워크 · timeout · JSON 파싱) */
  error?: string;
}

/**
 * Data Store State
 */
export interface DataStoreState {
  /** 프로젝트의 모든 DataTable */
  collections: Map<string, DataTable>;

  /** 프로젝트의 모든 API Endpoint */
  apiEndpoints: Map<string, ApiEndpoint>;

  /** 프로젝트의 모든 Variable */
  variables: Map<string, Variable>;

  /** 현재 로딩 중인 API ID 목록 */
  loadingApis: Set<string>;

  /** endpoint id → 마지막 실행 스냅샷 (ADR-213 Phase 3, 세션 전용) */
  apiRuns: Map<string, ApiRunRecord>;

  /** 에러 상태 */
  errors: Map<string, Error>;

  /** 로딩 상태 */
  isLoading: boolean;
}

/**
 * Data Store Actions
 */
export interface DataStoreActions {
  // DataTable CRUD
  fetchCollections: (projectId: string) => Promise<void>;
  createDataTable: (data: DataTableCreate) => Promise<DataTable>;
  updateCollection: (id: string, updates: DataTableUpdate) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  getDataTableData: (name: string) => Record<string, unknown>[];
  setRuntimeData: (name: string, data: Record<string, unknown>[]) => void;
  /**
   * ADR-152 §2-3 — 데이터 편집 단일 진입점. create/update/deleteCollection 은 이
   * 적용기의 wrapper 다. `record:false` 는 undo/redo 재적용 (History 없음).
   */
  applyDataChange: (
    change: DataChange,
    options?: { record?: boolean; projectId?: string },
  ) => Promise<{
    applied: DataOp[];
    inverse: DataOp[];
    collectionIds: string[];
    /** ADR-214 — 영향 프로젝트 변수 id */
    variableIds: string[];
    /** ADR-213 Phase 4 — 영향 API endpoint id */
    endpointIds: string[];
  }>;

  // ApiEndpoint CRUD
  fetchApiEndpoints: (projectId: string) => Promise<void>;
  createApiEndpoint: (data: ApiEndpointCreate) => Promise<ApiEndpoint>;
  updateApiEndpoint: (id: string, updates: ApiEndpointUpdate) => Promise<void>;
  deleteApiEndpoint: (id: string) => Promise<void>;
  executeApiEndpoint: (
    id: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;

  // Variable CRUD
  fetchVariables: (projectId: string) => Promise<void>;
  createVariable: (data: VariableCreate) => Promise<Variable>;
  updateVariable: (id: string, updates: VariableUpdate) => Promise<void>;
  deleteVariable: (id: string) => Promise<void>;
  getVariableValue: (name: string) => unknown;
  setVariableValue: (name: string, value: unknown) => void;

  // Utilities
  clearErrors: () => void;
  reset: () => void;
}

/**
 * 완전한 Data Store 타입
 */
export type DataStore = DataStoreState & DataStoreActions;

// ============================================
// Type Guards
// ============================================

/**
 * DataTable 타입 가드
 */
export function isDataTable(obj: unknown): obj is DataTable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "name" in obj &&
    "schema" in obj &&
    Array.isArray((obj as DataTable).schema)
  );
}

/**
 * ApiEndpoint 타입 가드
 */
export function isApiEndpoint(obj: unknown): obj is ApiEndpoint {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "method" in obj &&
    "baseUrl" in obj &&
    "path" in obj
  );
}

/**
 * Variable 타입 가드
 */
export function isVariable(obj: unknown): obj is Variable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "name" in obj &&
    "type" in obj &&
    "scope" in obj
  );
}
