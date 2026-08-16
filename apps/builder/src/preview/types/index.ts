import React from "react";
import type { ElementProps } from "../../types/integrations/supabase.types";

/**
 * Preview runtime node shape.
 */
export interface PreviewElement {
  id: string;
  customId?: string; // custom_id from database (e.g., button_1, table_1)
  type: string;
  fills?: unknown[];
  props: ElementProps & Record<string, unknown>;
  text?: string;
  parent_id?: string | null;
  page_id?: string | null; // Layout element면 null
  dataBinding?: Record<string, unknown>;
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
  /** 여러 node props를 한 번에 업데이트 (단일 commit) */
  batchUpdateElementProps: (
    updates: Array<{ id: string; props: Record<string, unknown> }>,
  ) => void;
  setElements: (elements: PreviewElement[]) => void;
  /**
   * 런타임 주입 서비스 — shared `RuntimeServices` 와 같은 것을 가리킨다.
   *
   * App 이 실제로 채우고(`createEventHandlerMap`) shared 렌더러가 소비하는데도
   * 여기 선언이 없어서, preview 쪽 소비자가 `context.services` 를 읽으려 하면
   * 컴파일이 막혔다 (ADR-158 Phase 3 트리거 배선). 형태를 다시 적지 않고 shared
   * 타입을 그대로 가리켜 둘이 갈리지 않게 한다.
   */
  services?: import("@composition/shared/types").RuntimeServices;
  projectId?: string;
  renderElement: (el: PreviewElement, key?: string) => React.ReactNode;
  // Layout/Slot System 필드
  editMode?: "page" | "layout"; // 현재 편집 모드
  /**
   * ADR-148 Phase 0 — ListBox 행 template 의 slot 구성 (shared RenderContext 동형 필드).
   * App 이 canonical 문서에서 1회 계산해 주입 — 상세는 shared renderer.types.ts 참조.
   */
  listBoxTemplateSlotComposition?:
    | import("@composition/shared").SlotComposition
    | null;
  /** ADR-148 Phase 4 — GridListItem slot 구성 (ListBox 동형). */
  gridListTemplateSlotComposition?:
    | import("@composition/shared").SlotComposition
    | null;
  /** ADR-148 Phase 4 — MenuItem slot 구성 (ListBox 동형). */
  menuItemTemplateSlotComposition?:
    | import("@composition/shared").SlotComposition
    | null;
}

/**
 * 컴포넌트 렌더러 인터페이스
 */
export interface ComponentRenderer {
  canRender(type: string): boolean;
  render(element: PreviewElement, context: RenderContext): React.ReactNode;
}

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
