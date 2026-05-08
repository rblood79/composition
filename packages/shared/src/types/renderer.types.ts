/**
 * Renderer Types
 *
 * 렌더러에서 사용하는 공유 타입 정의
 * Builder Preview와 Publish App에서 공통으로 사용
 *
 * @since 2025-01-02
 */

import type { ReactNode, CSSProperties } from "react";
import type { DataBinding } from "./element.types";

// ============================================
// Element Props Types
// ============================================

/**
 * 기본 Element Props (렌더러용)
 * Supabase에서 저장되는 props 구조
 */
export interface ElementProps {
  type?: string;
  style?: CSSProperties;
  className?: string;
  text?: string;
  children?: ReactNode;
  "data-element-id"?: string;
  // 동적 props 허용
  [key: string]: unknown;
}

// ============================================
// Preview Element Types
// ============================================

/**
 * Preview/Publish에서 사용하는 Element 타입
 */
export interface PreviewElement {
  id: string;
  customId?: string;
  type: string;
  props: ElementProps;
  text?: string;
  parent_id?: string | null;
  page_id?: string | null;
  dataBinding?: DataBinding;
  deleted?: boolean;
}

// ============================================
// Render Context Types
// ============================================

/**
 * 런타임 서비스 인터페이스 (DI용)
 * apps에서 구현하여 context로 주입
 */
export interface RuntimeServices {
  /** IndexedDB 접근 */
  getDB?: () => Promise<unknown>;
  /** 저장 서비스 */
  saveService?: {
    saveToLocal: () => Promise<void>;
    getAutoSaveStatus: () => boolean;
    savePropertyChange?: (params: {
      table: string;
      id: string;
      data: Record<string, unknown>;
    }) => Promise<void>;
  };
  /** 이벤트 핸들러 생성 */
  createEventHandlerMap?: (
    element: PreviewElement,
    context: RenderContext,
  ) => Record<string, (e: Event) => void>;
}

/**
 * 데이터 상태 (DataTable 등에서 사용)
 */
export interface DataState {
  data: Record<string, unknown>[] | null;
  loading: boolean;
  error: Error | string | null;
}

/**
 * 렌더링 컨텍스트 - 모든 렌더러에 전달되는 공통 데이터
 */
export interface RenderContext {
  /** 현재 페이지의 모든 elements */
  elements: PreviewElement[];
  /** id 기반 O(1) 조회용 read model (provider가 elements와 함께 빌드) */
  elementsById: ReadonlyMap<string, PreviewElement>;
  /** parent_id 기반 자식 조회 read model — canonical source order 보존 */
  childrenByParent: ReadonlyMap<string, readonly PreviewElement[]>;
  /** element props 업데이트 함수 */
  updateElementProps: (id: string, props: Record<string, unknown>) => void;
  /** 여러 element props를 한 번에 업데이트 (단일 commit, group 자식 sync 등) */
  batchUpdateElementProps: (
    updates: Array<{ id: string; props: Record<string, unknown> }>,
  ) => void;
  /** elements 전체 교체 함수 */
  setElements: (elements: PreviewElement[]) => void;
  /** 재귀 렌더링 함수 */
  renderElement: (el: PreviewElement, key?: string) => ReactNode;
  /** 프로젝트 ID (optional) */
  projectId?: string;
  /** 편집 모드 */
  editMode?: "page" | "layout";
  /** 런타임 서비스 (DI) */
  services?: RuntimeServices;
  /** 이벤트 엔진 (optional) */
  eventEngine?: unknown;
  /** 데이터 상태 설정 (DataTable용) */
  setDataState?: (elementId: string, state: DataState) => void;
  /**
   * ACTION_ID → 실행 함수 변환 (Q11: shared 렌더러는 EVENT_REGISTRY에 직접 의존 금지)
   * Preview App이 EVENT_REGISTRY.resolve를 주입. builder preview는 noop 가능.
   */
  resolveActionId?: (id: string) => (() => void) | undefined;
}

// ============================================
// Renderer Types
// ============================================

/**
 * 렌더 함수 타입
 */
export type RenderFunction = (
  element: PreviewElement,
  context: RenderContext,
) => ReactNode;

/**
 * 컴포넌트 렌더러 인터페이스
 */
export interface ComponentRenderer {
  canRender(type: string): boolean;
  render(element: PreviewElement, context: RenderContext): ReactNode;
}

/**
 * 렌더러 맵 타입
 */
export type RendererMap = Record<string, RenderFunction>;

/**
 * 이벤트 핸들러 맵 타입
 */
export type EventHandlerMap = Record<string, (e: Event) => void>;
