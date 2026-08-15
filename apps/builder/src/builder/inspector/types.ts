import type { ColumnMapping } from "../../types/builder/unified.types";
import type { EventHandler } from "../panels/events/types/eventTypes";
import type { DataBinding as SharedDataBinding } from "@composition/shared";

// `ComputedLayout` 인터페이스와 `SelectedElement.computedLayout` 은 삭제됐다
//   (2026-08-15). @pixi/layout(yoga) 결과 채널이었고 writer 인
//   `updateSelectedElementLayout` 의 호출부가 ADR-900 이후 0건이라 값이 채워진
//   적이 없다 — 패널은 이 필드를 읽지 않는다. 살아 있는 동명 타입
//   (`canvas/layout/engines/LayoutEngine.ts::ComputedLayout`)과는 별개.

/**
 * Inspector에서 관리하는 선택된 요소
 */
export interface SelectedElement {
  id: string;
  customId?: string; // custom_id from database (user-defined ID)
  type: string;

  // PropertiesSection - tv() variants + 컴포넌트 고유 속성
  properties: {
    variant?: string;
    size?: string;
    [key: string]: unknown;
  };

  // StyleSection - Inline Styles + Computed Styles
  style?: React.CSSProperties; // Inline styles (사용자가 직접 설정)
  computedStyle?: Partial<React.CSSProperties>; // Computed styles (브라우저 계산값)

  // Size Mode (ADR-026) - 부모 레이아웃 컨텍스트
  parentDisplay?: string;
  parentFlexDirection?: string;

  // StyleSection - 의미 클래스 + CSS 변수 (deprecated - inline style로 마이그레이션 중)
  semanticClasses?: string[];
  cssVariables?: Record<string, string>;

  // DataSection - 데이터 바인딩
  dataBinding?: DataBinding;

  // EventSection - 이벤트 핸들러
  events?: EventHandler[];
}

declare const IMMEDIATE_SELECTION_SNAPSHOT_BRAND: unique symbol;

export interface ImmediateSelectionSnapshot {
  readonly [IMMEDIATE_SELECTION_SNAPSHOT_BRAND]: true;
  readonly selectedElementId: string | null;
  readonly currentPageId: string | null;
}

declare const DEFERRED_SELECTED_ELEMENT_BRAND: unique symbol;

export type DeferredSelectedElement = SelectedElement & {
  readonly [DEFERRED_SELECTED_ELEMENT_BRAND]: true;
};

/**
 * 데이터 바인딩 타입
 */
export type DataBindingType = "collection" | "value";

/**
 * 데이터 바인딩
 */
// Element/Builder runtime와 동일한 shared DataBinding SSOT를 사용한다.
// Inspector 전용 축소 타입을 별도로 두면 getElementDataBinding() 반환값과 불일치한다.
export type DataBinding = SharedDataBinding;

/**
 * Collection 바인딩 (Table, ListBox, GridList 등)
 */
export interface CollectionBinding {
  type: "collection";
  source: "static" | "supabase" | "state" | "api";
  config:
    | SupabaseCollectionConfig
    | StateCollectionConfig
    | StaticCollectionConfig
    | APICollectionConfig;
}

/**
 * Value 바인딩 (TextField, Select 등)
 */
export interface ValueBinding {
  type: "value";
  source: "static" | "state" | "computed" | "supabase" | "api";
  config:
    | StaticValueConfig
    | StateValueConfig
    | ComputedValueConfig
    | SupabaseValueConfig
    | APIValueConfig;
}

/**
 * Supabase Collection 설정
 */
export interface SupabaseCollectionConfig {
  table: string;
  columns: string[];
  filters?: FilterCondition[];
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  offset?: number;
}

/**
 * Supabase Value 설정
 */
export interface SupabaseValueConfig {
  table: string;
  column: string;
  filter?: FilterCondition;
}

/**
 * API Collection 설정
 */
export interface APICollectionConfig {
  baseUrl: string;
  customUrl?: string; // CUSTOM 선택 시 사용
  endpoint: string;
  method?: "GET" | "POST";
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  columns?: string[]; // 선택된 컬럼 목록 (사용자가 선택한 것)
  availableColumns?: string[]; // Load로 가져온 전체 컬럼 목록
  columnMapping?: ColumnMapping; // 컬럼 타입 정보 (unified.ts의 ColumnMapping 사용)
  dataMapping: {
    resultPath: string; // 응답에서 데이터 배열 경로 (예: "data.items")
    idKey?: string; // ID 필드 이름 (기본값: "id")
    totalKey?: string; // 전체 개수 필드 경로
  };
}

/**
 * API Value 설정
 */
export interface APIValueConfig {
  baseUrl: string;
  endpoint: string;
  method?: "GET" | "POST";
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  dataMapping: {
    resultPath: string; // 응답에서 값 경로
  };
}

/**
 * 필터 조건
 */
export interface FilterCondition {
  column: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "in";
  value: unknown;
}

/**
 * State Collection 설정
 */
export interface StateCollectionConfig {
  storePath: string;
  selector?: string;
}

/**
 * State Value 설정
 */
export interface StateValueConfig {
  storePath: string;
  transform?: string;
}

/**
 * Static Collection 설정
 */
export interface StaticCollectionConfig {
  data: unknown[];
  columnMapping?: {
    [columnName: string]: {
      key: string; // 데이터 객체의 키
      label?: string; // 표시할 라벨
      type?: "string" | "number" | "boolean" | "date";
      sortable?: boolean;
      width?: number;
      align?: "left" | "center" | "right";
    };
  };
}

/**
 * Static Value 설정
 */
export interface StaticValueConfig {
  value: string | number | boolean;
}

/**
 * Computed Value 설정
 */
export interface ComputedValueConfig {
  expression: string;
  dependencies: string[];
}

/**
 * 이벤트 타입 - events/types/에서 통합 관리
 * @deprecated 이 파일에서 직접 정의하지 않고 events/types/에서 import
 */
export type {
  EventHandler,
  EventAction,
  EventType,
  ActionType,
  ActionConfig,
  NavigateConfig,
  SetStateConfig,
  APICallConfig,
  ShowModalConfig,
  HideModalConfig,
  ShowToastConfig,
  ValidateFormConfig,
  CustomConfig,
  ScrollToConfig,
  ToggleVisibilityConfig,
  CopyToClipboardConfig,
} from "../panels/events/types/eventTypes";

/**
 * 컴포넌트 에디터 Props (기존 PropertyEditorProps와 호환)
 */
export interface ComponentEditorProps {
  elementId: string;
  currentProps: Record<string, unknown>;
  onUpdate: (updatedProps: Record<string, unknown>) => void;
}

/**
 * 의미 클래스
 */
export interface SemanticClass {
  value: string;
  label: string;
  category: string;
  description?: string;
}

/**
 * 의미 클래스 카테고리
 */
export interface SemanticClassCategory {
  id: string;
  label: string;
  icon?: string;
  classes: SemanticClass[];
}
