import React from "react";
import { ElementProps } from "../../types/integrations/supabase.types";
import { DataBinding } from "../../types/builder/unified.types";
import { EventEngine } from "../../utils/events/eventEngine";

/**
 * Preview에서 사용하는 Element 타입
 */
export interface PreviewElement {
  id: string;
  customId?: string; // custom_id from database (e.g., button_1, table_1)
  type: string;
  fills?: unknown[];
  props: ElementProps;
  text?: string;
  parent_id?: string | null;
  page_id?: string | null; // Layout element면 null
  dataBinding?: DataBinding;
  deleted?: boolean;
}

/**
 * 렌더링 컨텍스트 - 모든 렌더러에 전달되는 공통 데이터
 */
export interface RenderContext {
  elements: PreviewElement[];
  /** id 기반 O(1) 조회용 인덱스 (provider가 elements와 함께 빌드) */
  elementsById: ReadonlyMap<string, PreviewElement>;
  /** parent_id 기반 자식 조회 인덱스 — canonical source order 보존 */
  childrenByParent: ReadonlyMap<string, readonly PreviewElement[]>;
  updateElementProps: (id: string, props: Record<string, unknown>) => void;
  /** 여러 element props를 한 번에 업데이트 (단일 commit) */
  batchUpdateElementProps: (
    updates: Array<{ id: string; props: Record<string, unknown> }>,
  ) => void;
  setElements: (elements: PreviewElement[]) => void;
  eventEngine: EventEngine;
  projectId?: string;
  renderElement: (el: PreviewElement, key?: string) => React.ReactNode;
  // Layout/Slot System 필드
  editMode?: "page" | "layout"; // 현재 편집 모드
  /**
   * ACTION_ID → 실행 함수 변환 (Q11: shared 렌더러는 EVENT_REGISTRY에 직접 의존 금지)
   * EVENT_REGISTRY.resolve를 주입. 없으면 undefined 반환.
   */
  resolveActionId?: (id: string) => (() => void) | undefined;
}

/**
 * 컴포넌트 렌더러 인터페이스
 */
export interface ComponentRenderer {
  canRender(type: string): boolean;
  render(element: PreviewElement, context: RenderContext): React.ReactNode;
}

/**
 * 이벤트 핸들러 타입
 */
export type EventHandlerMap = Record<string, (e: Event) => void>;

/**
 * postMessage 타입들
 */
export interface PreviewMessage {
  type: string;
  [key: string]: unknown;
}

// **ADR-125 Phase 3** — UpdateElementsMessage 제거됨. canonical document channel 만 사용.

export interface UpdateElementPropsMessage extends PreviewMessage {
  type: "UPDATE_ELEMENT_PROPS";
  elementId: string;
  props: Record<string, unknown>;
  merge?: boolean;
}

export interface DeleteElementsMessage extends PreviewMessage {
  type: "DELETE_ELEMENTS";
  elementIds: string[];
}

export interface DeleteElementMessage extends PreviewMessage {
  type: "DELETE_ELEMENT";
  elementId: string;
}

export interface ThemeVarsMessage extends PreviewMessage {
  type: "THEME_VARS";
  vars: Array<{ cssVar: string; value: string }>;
}

export interface UpdateThemeTokensMessage extends PreviewMessage {
  type: "UPDATE_THEME_TOKENS";
  styles: Record<string, string>;
}

export interface AddColumnElementsMessage extends PreviewMessage {
  type: "ADD_COLUMN_ELEMENTS";
  payload: {
    tableId: string;
    tableHeaderId: string;
    columns: Array<{
      id: string;
      type: string;
      page_id: string;
      parent_id: string;
      props: Record<string, unknown>;
    }>;
  };
}

export interface NavigateToPageMessage extends PreviewMessage {
  type: "NAVIGATE_TO_PAGE";
  payload: {
    path: string;
    replace?: boolean;
  };
}

export interface SetDarkModeMessage extends PreviewMessage {
  type: "SET_DARK_MODE";
  isDark: boolean;
}

export interface SetEditModeMessage extends PreviewMessage {
  type: "SET_EDIT_MODE";
  mode: "page" | "layout";
}

/**
 * Page 정보 업데이트 메시지.
 * Page가 변경될 때 해당 Page의 reusable frame binding을 Preview에 전달
 */
export interface UpdatePageInfoMessage extends PreviewMessage {
  type: "UPDATE_PAGE_INFO";
  pageId: string | null;
  layoutId: string | null;
}

/**
 * Nested Routes & Slug System: Layout 목록 업데이트 메시지
 * Layout 변경 시 Preview에 전달하여 URL 계산에 사용
 */
export interface UpdateLayoutsMessage extends PreviewMessage {
  type: "UPDATE_LAYOUTS";
  layouts: Array<{
    id: string;
    name: string;
    slug?: string | null;
  }>;
}

export interface ElementSelectedMessage extends PreviewMessage {
  type: "ELEMENT_SELECTED";
  elementId: string;
  isMultiSelect?: boolean;
  payload: {
    rect: {
      top: number;
      left: number;
      width: number;
      height: number;
    };
    props: Record<string, unknown>;
    type: string;
    style?: React.CSSProperties;
    computedStyle?: Partial<React.CSSProperties>;
  };
}

export interface ElementsDragSelectedMessage extends PreviewMessage {
  type: "ELEMENTS_DRAG_SELECTED";
  elementIds: string[];
}

export type MessageType =
  | UpdateElementPropsMessage
  | DeleteElementsMessage
  | DeleteElementMessage
  | ThemeVarsMessage
  | UpdateThemeTokensMessage
  | AddColumnElementsMessage
  | NavigateToPageMessage
  | SetDarkModeMessage
  | SetEditModeMessage
  | UpdatePageInfoMessage
  | UpdateLayoutsMessage
  | ElementSelectedMessage
  | ElementsDragSelectedMessage;
