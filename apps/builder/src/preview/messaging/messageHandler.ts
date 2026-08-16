/**
 * Message Handler - postMessage 수신 처리
 *
 * @deprecated 🚀 Phase 10 B2.4: WebGL Canvas로 마이그레이션 중
 *
 * Builder로부터 전달받는 메시지를 처리합니다.
 * Preview Runtime은 이 핸들러를 통해서만 데이터를 수신합니다.
 *
 * 이 파일은 iframe 기반 Preview를 위한 것입니다.
 * WebGL Canvas (VITE_USE_WEBGL_CANVAS=true)에서는 사용되지 않습니다.
 *
 * @see src/builder/stores/canvasStore.ts - 직접 스토어 접근 방식
 */

import type {
  PreviewStoreState,
  PreviewElement,
  PreviewPage,
  PreviewLayout,
  ThemeVar,
  DataSource,
  RuntimeDataTable,
  RuntimeApiEndpoint,
  RuntimeVariable,
} from "../store/types";
import type { CompositionDocument } from "@composition/shared";

// ============================================
// Helper: Get Target Origin for postMessage
// ============================================

/**
 * postMessage의 targetOrigin을 반환합니다.
 * src iframe은 부모와 동일한 origin을 공유합니다.
 */
function getTargetOrigin(): string {
  return window.location.origin;
}

// ============================================
// Message Types (Builder → Preview)
// ============================================

// **ADR-125 Phase 3 — legacy bulk node receive 제거**.
// Builder → Preview 의 active channel 은 UPDATE_CANONICAL_DOCUMENT 단일.
// 기존 UpdateElementsMessage interface 는 본 phase 에서 삭제됨.

export interface UpdateCanonicalDocumentMessage {
  type: "UPDATE_CANONICAL_DOCUMENT";
  document: CompositionDocument | null;
}

export interface UpdateElementPropsMessage {
  type: "UPDATE_ELEMENT_PROPS";
  elementId: string;
  props: Record<string, unknown>;
}

// `DELETE_ELEMENT` / `DELETE_ELEMENTS` 메시지는 두지 않는다 — 송신처가
// 0건이고, 수신 핸들러 2개도 `void data.elementId;` 한 줄짜리 no-op 이었다
// ("실제 구현에서는 store에 deleteElement 메서드 추가 필요" TODO 주석 동반).
// 요소 삭제는 canonical 문서 재송신(`UPDATE_CANONICAL_DOCUMENT`)이 처리하므로
// 전용 삭제 메시지가 애초에 필요 없다.
export interface ThemeVarsMessage {
  type: "THEME_VARS";
  vars: ThemeVar[];
}

export interface SetDarkModeMessage {
  type: "SET_DARK_MODE";
  isDark: boolean;
}

/**
 * ADR-056 Phase 3: Base Typography 동기화
 * themeConfigStore.baseTypography 변경 시 Preview body에 직접 적용.
 */
export interface ThemeBaseTypographyMessage {
  type: "THEME_BASE_TYPOGRAPHY";
  payload: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
  };
}

export interface UpdatePageInfoMessage {
  type: "UPDATE_PAGE_INFO";
  pageId: string | null;
  layoutId: string | null;
}

export interface UpdatePagesMessage {
  type: "UPDATE_PAGES";
  pages: PreviewPage[];
}

export interface UpdateDataSourcesMessage {
  type: "UPDATE_DATA_SOURCES";
  dataSources: DataSource[];
}

export interface UpdateDataTablesMessage {
  type: "UPDATE_DATA_TABLES";
  collections: RuntimeDataTable[];
}

export interface UpdateApiEndpointsMessage {
  type: "UPDATE_API_ENDPOINTS";
  apiEndpoints: RuntimeApiEndpoint[];
}

export interface UpdateVariablesMessage {
  type: "UPDATE_VARIABLES";
  variables: RuntimeVariable[];
}

export interface UpdateLayoutsMessage {
  type: "UPDATE_LAYOUTS";
  layouts: PreviewLayout[];
}

export interface UpdateAuthContextMessage {
  type: "UPDATE_AUTH_CONTEXT";
  token: string | null;
}

export interface RequestElementSelectionMessage {
  type: "REQUEST_ELEMENT_SELECTION";
  elementId: string;
}

export type BuilderToPreviewMessage =
  | UpdateCanonicalDocumentMessage
  | UpdateElementPropsMessage
  | ThemeVarsMessage
  | SetDarkModeMessage
  | ThemeBaseTypographyMessage
  | UpdatePageInfoMessage
  | UpdatePagesMessage
  | UpdateLayoutsMessage
  | UpdateDataSourcesMessage
  | UpdateDataTablesMessage
  | UpdateApiEndpointsMessage
  | UpdateVariablesMessage
  | UpdateAuthContextMessage
  | RequestElementSelectionMessage;

// ============================================
// Message Handler Class
// ============================================

type StoreActions = Pick<
  PreviewStoreState,
  | "setElements"
  | "setCanonicalDocument"
  | "updateElementProps"
  | "setThemeVars"
  | "setDarkMode"
  | "setCurrentPageId"
  | "setCurrentLayoutId"
  | "setPages"
  | "setLayouts"
  | "setDataSources"
  | "setCollections"
  | "setApiEndpoints"
  | "setVariables"
  | "setAuthToken"
  | "setReady"
>;
// 종전에 여기 delta 전용 optional action 6종(`addElement` / `addElements` /
// `removeElement` / `removeElements` / `updateElement` / `getElements`)이
// 붙어 있었다. 소비처가 삭제된 `DELTA_*` 핸들러뿐이라 함께 제거 —
// Builder → Preview 전체 동기화는 `UPDATE_CANONICAL_DOCUMENT` 단일 채널이다.

export class MessageHandler {
  private store: StoreActions;
  private onElementSelected?: (elementId: string) => void;
  private onVariablesUpdated?: (variables: RuntimeVariable[]) => void;

  constructor(
    store: StoreActions,
    options?: {
      onElementSelected?: (elementId: string) => void;
      onVariablesUpdated?: (variables: RuntimeVariable[]) => void;
    },
  ) {
    this.store = store;
    this.onElementSelected = options?.onElementSelected;
    this.onVariablesUpdated = options?.onVariablesUpdated;
  }

  /**
   * 메시지 이벤트 처리
   */
  handle(event: MessageEvent): void {
    // Origin 검증 (production에서만)
    if (import.meta.env.PROD) {
      if (event.origin !== window.location.origin) {
        console.warn("[Preview] Message from untrusted origin:", event.origin);
        return;
      }
    }

    const data = event.data as BuilderToPreviewMessage;
    if (!data || typeof data !== "object" || !data.type) {
      return;
    }

    switch (data.type) {
      case "UPDATE_CANONICAL_DOCUMENT":
        this.handleUpdateCanonicalDocument(data);
        break;

      case "UPDATE_ELEMENT_PROPS":
        this.handleUpdateElementProps(data);
        break;

      case "THEME_VARS":
        this.handleThemeVars(data);
        break;

      case "SET_DARK_MODE":
        this.handleSetDarkMode(data);
        break;

      case "THEME_BASE_TYPOGRAPHY":
        this.handleThemeBaseTypography(data);
        break;

      case "UPDATE_PAGE_INFO":
        this.handleUpdatePageInfo(data);
        break;

      case "UPDATE_PAGES":
        this.handleUpdatePages(data);
        break;

      case "UPDATE_LAYOUTS":
        this.handleUpdateLayouts(data);
        break;

      case "UPDATE_DATA_SOURCES":
        this.handleUpdateDataSources(data);
        break;

      case "UPDATE_DATA_TABLES":
        this.handleUpdateDataTables(data);
        break;

      case "UPDATE_API_ENDPOINTS":
        this.handleUpdateApiEndpoints(data);
        break;

      case "UPDATE_VARIABLES":
        this.handleUpdateVariables(data);
        break;

      case "UPDATE_AUTH_CONTEXT":
        this.handleUpdateAuthContext(data);
        break;

      case "REQUEST_ELEMENT_SELECTION":
        this.handleRequestElementSelection(data);
        break;

      default:
        // 알 수 없는 메시지 타입은 무시
        break;
    }
  }

  // ============================================
  // Individual Message Handlers
  // ============================================

  // **ADR-125 Phase 3** — handleUpdateElements 제거됨. canonical hydration 만 사용.

  private handleUpdateCanonicalDocument(
    data: UpdateCanonicalDocumentMessage,
  ): void {
    this.store.setCanonicalDocument(data.document ?? null);
  }

  private handleUpdateElementProps(data: UpdateElementPropsMessage): void {
    const { elementId, props } = data;
    if (elementId && props) {
      this.store.updateElementProps(elementId, props);
    }
  }

  private handleThemeVars(data: ThemeVarsMessage): void {
    const vars = data.vars || [];
    this.store.setThemeVars(vars);
  }

  private handleSetDarkMode(data: SetDarkModeMessage): void {
    this.store.setDarkMode(data.isDark);
  }

  /**
   * :root + body 양쪽 주입: :root 는 D3 symmetric consumer 대칭 (ADR-107),
   * body 는 ADR-056 Phase 3 하위 호환 경로 보존.
   */
  private handleThemeBaseTypography(data: ThemeBaseTypographyMessage): void {
    const { fontFamily, fontSize, lineHeight } = data.payload;
    const apply = (el: HTMLElement) => {
      el.style.fontFamily = fontFamily;
      el.style.fontSize = `${fontSize}px`;
      el.style.lineHeight = String(lineHeight);
    };
    apply(document.documentElement);
    apply(document.body);
  }

  private handleUpdatePageInfo(data: UpdatePageInfoMessage): void {
    this.store.setCurrentPageId(data.pageId);
    this.store.setCurrentLayoutId(data.layoutId);
  }

  private handleUpdatePages(data: UpdatePagesMessage): void {
    const pages = data.pages || [];
    this.store.setPages(pages);
  }

  private handleUpdateLayouts(data: UpdateLayoutsMessage): void {
    const layouts = data.layouts || [];
    this.store.setLayouts(layouts);
  }

  private handleUpdateDataSources(data: UpdateDataSourcesMessage): void {
    const dataSources = data.dataSources || [];
    this.store.setDataSources(dataSources);
  }

  private handleUpdateDataTables(data: UpdateDataTablesMessage): void {
    const collections = data.collections || [];
    this.store.setCollections(collections);
  }

  private handleUpdateApiEndpoints(data: UpdateApiEndpointsMessage): void {
    const apiEndpoints = data.apiEndpoints || [];
    this.store.setApiEndpoints(apiEndpoints);
  }

  private handleUpdateVariables(data: UpdateVariablesMessage): void {
    const variables = data.variables || [];
    this.store.setVariables(variables);
    // EventEngine에 variables 동기화
    if (this.onVariablesUpdated) {
      this.onVariablesUpdated(variables);
    }
  }

  private handleUpdateAuthContext(data: UpdateAuthContextMessage): void {
    this.store.setAuthToken(data.token);
  }

  private handleRequestElementSelection(
    data: RequestElementSelectionMessage,
  ): void {
    if (this.onElementSelected) {
      this.onElementSelected(data.elementId);
    }
  }

  // ============================================
  // Send to Builder
  // ============================================

  private sendToBuilder(message: Record<string, unknown>): void {
    try {
      window.parent.postMessage(message, getTargetOrigin());
    } catch (error) {
      console.error("[Preview] Failed to send message to builder:", error);
    }
  }
}

// ============================================
// Message Sender (Preview → Builder)
// ============================================

export const messageSender = {
  /**
   * Preview 준비 완료 알림
   */
  sendReady(): void {
    window.parent.postMessage(
      { type: "PREVIEW_READY" },
      window.location.origin,
    );
  },

  /**
   * 요소 선택 알림
   */
  sendElementSelected(
    elementId: string,
    rect: { top: number; left: number; width: number; height: number },
    options?: {
      isMultiSelect?: boolean;
      props?: Record<string, unknown>;
      style?: Record<string, unknown>;
    },
  ): void {
    window.parent.postMessage(
      {
        type: "ELEMENT_SELECTED",
        elementId,
        isMultiSelect: options?.isMultiSelect || false,
        payload: {
          rect,
          props: options?.props,
          style: options?.style,
        },
      },
      getTargetOrigin(),
    );
  },

  /**
   * Computed Style 전송
   */
  sendComputedStyle(
    elementId: string,
    computedStyle: Record<string, string>,
  ): void {
    window.parent.postMessage(
      {
        type: "ELEMENT_COMPUTED_STYLE",
        elementId,
        payload: { computedStyle },
      },
      getTargetOrigin(),
    );
  },

  /**
   * Lasso 선택 결과 전송
   */
  sendDragSelected(elementIds: string[]): void {
    window.parent.postMessage(
      {
        type: "ELEMENTS_DRAG_SELECTED",
        elementIds,
      },
      getTargetOrigin(),
    );
  },

  /**
   * 상태 변경 알림 (디버깅용)
   */
  sendStateChanged(path: string, value: unknown): void {
    window.parent.postMessage(
      {
        type: "STATE_CHANGED",
        path,
        value,
      },
      getTargetOrigin(),
    );
  },

  /**
   * Preview 상호작용으로 바뀐 element props 를 builder store 에 역전파 (2026-07-14).
   *
   * **Why**: Preview 의 `updateElementProps` 는 **Preview runtime store 전용**이라 builder store
   *   (= Skia 렌더 source) 로 올라가지 않는다. 그래서 Preview 에서 Disclosure header 를 클릭해
   *   접어도 Skia 는 펼친 채 남아 CSS↔Skia 가 발산했다.
   *
   * **적용 범위**: 문서 prop 을 실제로 바꾸는 상호작용에만 사용한다(Disclosure 확장 상태 등
   *   binding/factory 가 보유한 prop). 순수 런타임 상태(hover/focus 등)는 대상 아님.
   */
  sendPropsChanged(elementId: string, props: Record<string, unknown>): void {
    window.parent.postMessage(
      {
        type: "ELEMENT_PROPS_CHANGED",
        elementId,
        payload: { props },
      },
      getTargetOrigin(),
    );
  },
};
