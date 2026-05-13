/**
 * Data Panel System Type Definitions
 *
 * DataTable = 스키마 + Mock 데이터 + 런타임 데이터
 * ApiEndpoint = 외부 API 연결 설정 + 응답 매핑
 * Variable = 앱 전역/페이지 상태 관리
 * Transformer = 3단계 데이터 변환 시스템
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
  /** 필드 키 (예: "id", "name", "email") */
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
  Pick<DataTable, "name" | "schema" | "mockData" | "useMockData">
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
  /** Supabase Edge Function 이름 */
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
  targetCollection?: string; // DataTable name to populate

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
  Pick<Variable, "name" | "type" | "defaultValue" | "persist" | "scope" | "page_id" | "validation" | "transform">
>;

// ============================================
// Transformer (3단계 변환 시스템)
// ============================================

/**
 * 변환 레벨
 */
export type TransformLevel =
  | "level1_mapping" // 노코드 Response Mapping
  | "level2_transformer" // 로우코드 JS Transformer
  | "level3_custom"; // 풀코드 TypeScript Custom Function

/**
 * 필드 매핑 (Level 1)
 */
export interface FieldMapping {
  sourceKey: string; // API 응답 필드명
  targetKey: string; // DataTable 필드명
  transform?: "uppercase" | "lowercase" | "trim" | "number" | "boolean" | "date";
}

/**
 * Level 1: Response Mapping 설정
 */
export interface ResponseMappingConfig {
  dataPath: string; // "data.users"
  fieldMappings: FieldMapping[];
}

/**
 * Level 2: JS Transformer 설정
 */
export interface JsTransformerConfig {
  /** JavaScript 코드 (data와 context 변수가 자동 주입됨) */
  code: string;
}

/**
 * Level 3: Custom Function 설정
 */
export interface CustomFunctionConfig {
  /** TypeScript 함수 전체 코드 */
  code: string;

  /** export된 함수명 */
  functionName: string;

  /** 외부 라이브러리 의존성 (lodash, dayjs 등) */
  dependencies?: string[];
}

/**
 * Transformer 타입 (transformers 테이블)
 */
export interface Transformer {
  id: string;
  name: string;
  project_id: string;

  /** 변환 레벨 */
  level: TransformLevel;

  /** Level 1: Response Mapping (노코드) */
  responseMapping?: ResponseMappingConfig;

  /** Level 2: JS Transformer (로우코드) */
  jsTransformer?: JsTransformerConfig;

  /** Level 3: Custom Function (풀코드) */
  customFunction?: CustomFunctionConfig;

  /** 입력 DataTable */
  inputDataTable?: string;

  /** 출력 DataTable */
  outputDataTable?: string;

  /** 활성화 여부 */
  enabled: boolean;

  created_at?: string;
  updated_at?: string;
}

/**
 * Transformer 생성용 타입
 */
export type TransformerCreate = Pick<
  Transformer,
  "name" | "project_id" | "level"
> & {
  responseMapping?: ResponseMappingConfig;
  jsTransformer?: JsTransformerConfig;
  customFunction?: CustomFunctionConfig;
  inputDataTable?: string;
  outputDataTable?: string;
  enabled?: boolean;
};

/**
 * Transformer 업데이트용 타입
 */
export type TransformerUpdate = Partial<
  Omit<Transformer, "id" | "project_id" | "created_at" | "updated_at">
>;

/**
 * Transform Context (변환 함수에 주입되는 컨텍스트)
 */
export interface TransformContext {
  /** 다른 DataTable 접근 */
  collections: Record<string, unknown[]>;

  /** 변수 접근 */
  variables: Record<string, unknown>;

  /** 추가 API 호출 (Level 3 전용) */
  api: {
    fetch: (url: string, options?: RequestInit) => Promise<unknown>;
  };

  /** 유틸리티 */
  utils: {
    formatDate: (date: string, format: string) => string;
    formatCurrency: (amount: number, currency: string) => string;
  };
}

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
 * Data Store State
 */
export interface DataStoreState {
  /** 프로젝트의 모든 DataTable */
  collections: Map<string, DataTable>;

  /** 프로젝트의 모든 API Endpoint */
  apiEndpoints: Map<string, ApiEndpoint>;

  /** 프로젝트의 모든 Variable */
  variables: Map<string, Variable>;

  /** 프로젝트의 모든 Transformer */
  transformers: Map<string, Transformer>;

  /** 현재 로딩 중인 API ID 목록 */
  loadingApis: Set<string>;

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

  // ApiEndpoint CRUD
  fetchApiEndpoints: (projectId: string) => Promise<void>;
  createApiEndpoint: (data: ApiEndpointCreate) => Promise<ApiEndpoint>;
  updateApiEndpoint: (id: string, updates: ApiEndpointUpdate) => Promise<void>;
  deleteApiEndpoint: (id: string) => Promise<void>;
  executeApiEndpoint: (id: string, params?: Record<string, unknown>) => Promise<unknown>;

  // Variable CRUD
  fetchVariables: (projectId: string) => Promise<void>;
  createVariable: (data: VariableCreate) => Promise<Variable>;
  updateVariable: (id: string, updates: VariableUpdate) => Promise<void>;
  deleteVariable: (id: string) => Promise<void>;
  getVariableValue: (name: string) => unknown;
  setVariableValue: (name: string, value: unknown) => void;

  // Transformer CRUD
  fetchTransformers: (projectId: string) => Promise<void>;
  createTransformer: (data: TransformerCreate) => Promise<Transformer>;
  updateTransformer: (id: string, updates: TransformerUpdate) => Promise<void>;
  deleteTransformer: (id: string) => Promise<void>;
  executeTransformer: (id: string, inputData: unknown[]) => Promise<unknown[]>;

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

/**
 * Transformer 타입 가드
 */
export function isTransformer(obj: unknown): obj is Transformer {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "name" in obj &&
    "level" in obj
  );
}
