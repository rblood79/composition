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
import type { SlotComposition } from "../catalog/slotRoles";

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
  /** 이벤트 핸들러 생성 — 반환 형태는 아래 `EventHandlerMap` 정본을 가리킨다 */
  createEventHandlerMap?: (
    element: PreviewElement,
    context: RenderContext,
  ) => EventHandlerMap;
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
  /** 데이터 상태 설정 (DataTable용) */
  setDataState?: (elementId: string, state: DataState) => void;
  /**
   * ADR-148 Phase 0 — ListBox 행 template 의 slot 구성 (origin 문서 자식에서 파생).
   * 표준 ListBox instance 는 anchor-less bare ref 라 renderer 가 childrenByParent 로
   * Components 페이지 origin 에 접근할 수 없다 — provider(Preview App)가 문서에서
   * 1회 계산해 주입한다 (builder projection resolveListBoxTemplateOriginId 와 대칭).
   * null/미주입 = legacy 문서 → 렌더러는 기존 flat-props 동작.
   */
  listBoxTemplateSlotComposition?: SlotComposition | null;
  /**
   * ListBox 행 template origin 의 root style (2026-07-20, Selected variant 배선).
   *
   * provider(Preview App)가 문서에서 master `slot` 등록을 해석해 주입:
   * - `base`: default origin(`slot[0]`) 의 `props.style` — 모든 행에 적용.
   * - `selected`: Selected variant origin(`metadata.variant==="selected"`, fallback `slot[1]`)
   *   의 `props.style` — `data-selected` 행에만 overlay.
   *
   * builder Skia projection(appendListBoxRowProjection 의 templateAnchorStyle +
   * selectedOriginStyle overlay)과 대칭. null/미주입 = legacy → catalog CSS base 만.
   */
  listBoxRowTemplateStyles?: {
    base: Record<string, unknown> | null;
    selected: Record<string, unknown> | null;
  } | null;
  /**
   * ADR-148 Phase 4 — GridListItem 카드 template 의 slot 구성 (ListBox 동형,
   * origin `component-gridlist-item-default` 자식에서 파생).
   */
  gridListTemplateSlotComposition?: SlotComposition | null;
  /**
   * ADR-148 Phase 4 — MenuItem 의 slot 구성 (ListBox 동형, origin
   * `component-menu-item-default` 자식에서 파생 — icon/label/shortcut/description).
   */
  menuItemTemplateSlotComposition?: SlotComposition | null;
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
 * 이벤트 핸들러 맵 타입 — 요소 하나가 렌더 시 받을 트리거 callback 묶음.
 *
 * **이 형태의 유일 정의처다**. 종전에는 같은 형태가 세 곳에 각자 적혀 있었고
 * (`RuntimeServices.createEventHandlerMap` 반환형 인라인 / preview `types/index.ts` /
 * builder legacy `events.types.ts`), legacy 쪽 하나가 이미 혼자 다른 형태
 * (`(context: EventContext) => Promise<EventExecutionResult>`)로 갈려 있었다.
 * 형태를 다시 적지 말고 이 별칭을 가리킬 것 — preview 쪽 소비자는
 * `import("@composition/shared/types").EventHandlerMap` (같은 파일의
 * `RuntimeServices` 참조와 동일 어법).
 */
export type EventHandlerMap = Record<string, (e: Event) => void>;
