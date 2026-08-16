/**
 * Canvas Runtime Store Types
 *
 * Canvas Runtime은 Builder와 완전히 독립된 상태를 관리합니다.
 * postMessage를 통해서만 데이터를 수신합니다.
 */

import type { CSSProperties } from "react";
import type { CompositionDocument } from "@composition/shared";

// Runtime node shape (Preview에서 사용하는 최소 타입)
export interface RuntimeElement {
  id: string;
  type: string;
  fills?: unknown[];
  props: Record<string, unknown> & {
    style?: CSSProperties;
    className?: string;
    children?: string;
  };
  parent_id: string | null;
  page_id: string | null;
  customId?: string;
  dataBinding?: Record<string, unknown>;
}

// Page 타입
export interface RuntimePage {
  id: string;
  title: string;
  slug: string;
  parent_id?: string | null; // Nested Routes 지원
}

// Layout 타입 (Nested Routes & Slug System)
export interface RuntimeLayout {
  id: string;
  name: string;
  slug?: string | null;
}

// Theme Variable 타입
export interface ThemeVar {
  name: string;
  value: string;
  isDark?: boolean;
}

// Data Source 타입
export interface DataSource {
  id: string;
  name: string;
  type: "rest" | "supabase" | "static" | "graphql";
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  table?: string;
  filters?: Array<{ field: string; op: string; value: unknown }>;
  realtime?: boolean;
  data?: unknown;
  transform?: string;
  autoFetch?: "onLoad" | "manual";
  cacheTTL?: number;
}

// DataTable 타입 (Canvas Runtime용 - Builder의 DataTable 경량 버전)
export interface RuntimeDataTable {
  id: string;
  name: string;
  /** 스키마 정의 (Field 자동 생성용) */
  schema?: Array<{
    key: string;
    type: string;
    label?: string;
  }>;
  mockData: Record<string, unknown>[];
  useMockData: boolean;
  runtimeData?: Record<string, unknown>[];
}

// ApiEndpoint 타입 (Canvas Runtime용 - Builder의 ApiEndpoint 경량 버전)
export interface RuntimeApiEndpoint {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  baseUrl: string;
  path: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  /** 마지막 호출 결과 캐시 */
  cachedResponse?: Record<string, unknown>[] | null;
}

// Variable 타입 (Canvas Runtime용 - Builder의 Variable 경량 버전)
export interface RuntimeVariable {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  defaultValue?: unknown;
  persist: boolean;
  scope: "global" | "page" | "component";
  page_id?: string;
}

// `DataState` 는 여기 없다 (2026-08-17 제거) — 아래 §Data Sources 의 tombstone 참조.

// 상태 계층
export interface StateHierarchy {
  // App State (전역)
  appState: Record<string, unknown>;
  // Page State (페이지별)
  pageStates: Map<string, Record<string, unknown>>;
  // Component State (컴포넌트별)
  componentStates: Map<string, Record<string, unknown>>;
}

// Runtime Store State
export interface RuntimeStoreState extends StateHierarchy {
  // Elements
  elements: RuntimeElement[];
  setElements: (elements: RuntimeElement[]) => void;
  canonicalDocument: CompositionDocument | null;
  setCanonicalDocument: (document: CompositionDocument | null) => void;

  /**
   * ADR-158 Phase 3 — 인터랙션 발화가 쌓는 **임시** prop override (elementId → patch).
   *
   * canonical 렌더 경로는 문서 노드 props 를 읽으므로 `updateElementProps`
   * (=`elements` 배열) 로는 화면이 바뀌지 않는다. 문서를 고치는 대신 이 층에
   * 얹고 렌더 시점에 병합한다 — 발화는 문서 편집이 아니라서 undo/persist
   * 대상이 아니고, 문서 재수신 시 리셋되는 것이 옳은 수명이다.
   */
  interactionOverrides: Record<string, Record<string, unknown>>;
  patchInteractionOverride: (
    id: string,
    patch: Record<string, unknown>,
  ) => void;
  clearInteractionOverrides: () => void;
  updateElementProps: (id: string, props: Record<string, unknown>) => void;
  /**
   * 여러 요소 props를 한 번의 set()으로 일괄 적용 (Preview 단일 commit 보장)
   */
  batchUpdateElementProps: (
    updates: Array<{ id: string; props: Record<string, unknown> }>,
  ) => void;

  // 🚀 Phase 4: Delta Update Actions
  addElement: (element: RuntimeElement) => void;
  addElements: (elements: RuntimeElement[]) => void;
  removeElement: (elementId: string) => void;
  removeElements: (elementIds: string[]) => void;
  updateElement: (elementId: string, updates: Partial<RuntimeElement>) => void;
  getElements: () => RuntimeElement[];

  // Pages
  pages: RuntimePage[];
  setPages: (pages: RuntimePage[]) => void;
  currentPageId: string | null;
  setCurrentPageId: (pageId: string | null) => void;
  currentPath: string;
  setCurrentPath: (path: string) => void;

  // Route Parameters (동적 라우트 파라미터)
  routeParams: Record<string, string>;
  setRouteParams: (params: Record<string, string>) => void;

  // Layouts (Nested Routes & Slug System)
  layouts: RuntimeLayout[];
  setLayouts: (layouts: RuntimeLayout[]) => void;
  currentLayoutId: string | null;
  setCurrentLayoutId: (layoutId: string | null) => void;

  // Theme
  themeVars: ThemeVar[];
  setThemeVars: (vars: ThemeVar[]) => void;
  isDarkMode: boolean;
  setDarkMode: (isDark: boolean) => void;

  // Data Sources
  //
  // `dataStates` / `setDataState` 는 2026-08-17 에 제거됐다. ADR-132 가 컬렉션
  // 데이터의 sink 를 `collections.runtimeData` 로 옮기기 전 세대의 종착지였는데,
  // 그 전환 뒤로 **쓰는 쪽도 읽는 쪽도 없었다** — 유일한 기록 경로였던
  // `RenderContext.setDataState` 가 provider 0건이라 항상 undefined 였고,
  // Map 을 판독하는 코드도 존재한 적이 없다. 현행 경로는 아래 `collections`.
  dataSources: DataSource[];
  setDataSources: (sources: DataSource[]) => void;

  // DataTables (PropertyDataBinding용)
  collections: RuntimeDataTable[];
  setCollections: (tables: RuntimeDataTable[]) => void;

  // ApiEndpoints (PropertyDataBinding용)
  apiEndpoints: RuntimeApiEndpoint[];
  setApiEndpoints: (endpoints: RuntimeApiEndpoint[]) => void;

  // Variables (PropertyDataBinding용)
  variables: RuntimeVariable[];
  setVariables: (variables: RuntimeVariable[]) => void;

  // Auth Context
  authToken: string | null;
  setAuthToken: (token: string | null) => void;

  // State Management
  setState: (path: string, value: unknown) => void;
  getState: (path: string) => unknown;

  // Ready State
  isReady: boolean;
  setReady: (ready: boolean) => void;
}

// Legacy type aliases for backward compatibility
export type PreviewElement = RuntimeElement;
export type PreviewPage = RuntimePage;
export type PreviewLayout = RuntimeLayout;
export type PreviewStoreState = RuntimeStoreState;
