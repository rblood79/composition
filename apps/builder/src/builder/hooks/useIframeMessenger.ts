/**
 * useIframeMessenger - iframe 기반 Preview 통신 훅
 *
 * @deprecated 🚀 Phase 10 B2.4: WebGL Canvas로 마이그레이션 중
 *
 * 이 훅은 iframe + postMessage 패턴을 사용합니다.
 * WebGL Canvas (VITE_USE_WEBGL_CANVAS=true)에서는 더 이상 필요하지 않습니다.
 *
 * 마이그레이션 가이드:
 * - 요소 가져오기: useCanvasElements() 사용
 * - 선택 요소: useCanvasSelectedElement() 사용
 * - 요소 업데이트: useCanvasUpdateElement() 사용
 *
 * @see src/builder/stores/canvasStore.ts
 */

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  startTransition,
} from "react";
import { debounce, DebouncedFunc } from "lodash";
import { markBegin, markEnd } from "../utils/perfMarks";
import { useStore } from "../stores";
import { useEditModeStore } from "../stores/editMode";
import {
  getCanonicalReusableFrameLayouts,
  getSelectedReusableFrameId,
  useCanonicalReusableFrameLayouts,
  useSelectedReusableFrameId,
} from "../stores/canonical/canonicalFrameStore";
import {
  useDataTables,
  useApiEndpoints,
  useVariables,
  getVariablesForCanvas,
} from "../stores/data";
// useZundoActions는 제거됨 - 기존 시스템 사용
import type { ElementProps } from "../../types/integrations/supabase.types";
import { Element } from "../../types/core/store.types";
// ElementUtils는 현재 사용되지 않음
import { MessageService } from "../../utils/messaging";
// ADR-116 Phase 3 G4 — mutation reverse wrapper (D18=A 정합)
import {
  mergeElementsCanonicalPrimary,
  createMultipleElementsCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";
import {
  getNullablePageFrameBindingId,
  withPageFrameBinding,
} from "../../adapters/canonical/frameMirror";
// 🚀 Delta Update
import { canvasDeltaMessenger } from "../utils/canvasDeltaMessenger";
// 🚀 Phase 11: Feature Flags for WebGL-only mode optimization
import { isWebGLCanvas, isCanvasCompareMode } from "../../utils/featureFlags";
// ADR-116 Phase 2 G3 Step 3 — canonical document → derived Element[] source
import {
  useCanonicalElements,
  canonicalDocumentToElements,
} from "../stores/canonical/canonicalElementsView";
import {
  getActiveCanonicalDocument,
  useActiveCanonicalDocument,
} from "../stores/canonical/canonicalElementsBridge";
import type { CompositionDocument } from "@composition/shared";
// ADR-006 P2-2: postMessage 보안 검증
import {
  isValidBootstrapMessage,
  isValidPreviewMessage,
} from "../../utils/messageValidation";
import { scheduleNextFrame } from "../utils/scheduleTask";
// ADR-056 Phase 3: Base Typography 초기 동기화
import { useThemeConfigStore } from "../../stores/themeConfigStore";
import { normalizeExternalFillIngressBatch } from "../panels/styles/utils/fillExternalIngress";

export type IframeReadyState =
  | "not_initialized"
  | "loading"
  | "ready"
  | "error";

// 🎯 모듈 레벨 변수: 모든 useIframeMessenger 인스턴스가 공유
let pendingAutoSelectElementId: string | null = null;

export interface UseIframeMessengerReturn {
  iframeReadyState: IframeReadyState;
  handleIframeLoad: () => void;
  handleMessage: (event: MessageEvent) => void;
  handleUndo: DebouncedFunc<() => Promise<void>>;
  handleRedo: DebouncedFunc<() => Promise<void>>;
  sendElementsToIframe: (elements: Element[]) => void;
  sendElementSelectedMessage: (elementId: string, props?: ElementProps) => void;
  requestElementSelection: (elementId: string) => void;
  requestAutoSelectAfterUpdate: (elementId: string) => void;
  sendLayoutsToIframe: () => void;
  sendPagesToIframe: () => void;
  sendDataTablesToIframe: () => void;
  sendApiEndpointsToIframe: () => void;
  sendVariablesToIframe: () => void;
  isIframeReady: boolean;
}

// 🚀 Phase 11: No-op debounced functions for WebGL-only mode
const noopDebouncedAsync = debounce(() => Promise.resolve(), 0);

function cancelScheduledFrame(taskId: number | null): void {
  if (taskId === null) {
    return;
  }

  if (typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(taskId);
    return;
  }

  clearTimeout(taskId);
}

export const useIframeMessenger = (): UseIframeMessengerReturn => {
  // 🚀 Phase 11: WebGL-only 모드에서는 iframe 통신 완전 스킵
  // - isWebGLCanvas(): WebGL 캔버스 활성화 여부 (빌드타임 상수)
  // - isCanvasCompareMode(): 비교 모드 (빌드타임 상수)
  // - WebGL only = WebGL 활성화 && 비교 모드 아님
  // ⚠️ React Hook 규칙: 모든 Hook은 조건문 전에 호출해야 함
  const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();

  // ⚠️ Hook 호출은 항상 동일한 순서로 실행 (조건부 early return 금지)
  const [iframeReadyState, setIframeReadyState] =
    useState<IframeReadyState>("not_initialized");
  const iframeReadyStateRef = useRef<IframeReadyState>("not_initialized"); // 🔧 Ref로 즉시 상태 변경
  const messageQueueRef = useRef<Array<{ type: string; payload: unknown }>>([]);
  const lastAckTimestampRef = useRef<number>(0); // ✅ 마지막 ACK 시점
  const isSendingRef = useRef(false); // ✅ 전송 중 플래그
  const lastSentElementsRef = useRef<Element[] | null>(null); // ✅ 마지막 전송된 elements (중복 전송 방지)
  const previewGeneratedElementsRef = useRef<Map<string, Element>>(new Map());
  const previewGeneratedElementsFlushIdRef = useRef<number | null>(null);

  const legacyElements = useStore((state) => state.elements);
  // ADR-116 direct cutover — active canonical document 의 derived Element[] 를
  // publish source 로 사용. 초기 hydration 전에는 legacy elements fallback.
  const canonicalElements = useCanonicalElements();
  const activeCanonicalDocument = useActiveCanonicalDocument();
  const elements = useMemo(() => {
    if (!canonicalElements) return legacyElements;
    return canonicalElements;
  }, [legacyElements, canonicalElements]);
  const elementsMap = useStore((state) => state.elementsMap);
  const currentPageId = useStore((state) => state.currentPageId);
  const pages = useStore((state) => state.pages);
  const currentEditMode = useEditModeStore((state) => state.mode);

  // ⭐ Nested Routes & Slug System: canonical reusable frame surface 구독
  const layouts = useCanonicalReusableFrameLayouts();
  const selectedReusableFrameId = useSelectedReusableFrameId();

  // ⭐ DataTables 구독 (PropertyDataBinding용)
  const dataTables = useDataTables();

  // ⭐ ApiEndpoints 구독 (PropertyDataBinding용)
  const apiEndpoints = useApiEndpoints();

  // ⭐ Variables 구독 (PropertyDataBinding용)
  const variables = useVariables();

  // 기존 히스토리 시스템에서 필요한 함수들만 가져오기
  // undo, redo는 함수 내에서 직접 호출

  // iframe이 준비되었는지 계산된 값
  const isIframeReady = iframeReadyState === "ready";

  const flushPreviewGeneratedElements = useCallback(() => {
    previewGeneratedElementsFlushIdRef.current = null;

    const queuedElements = normalizeExternalFillIngressBatch(
      Array.from(previewGeneratedElementsRef.current.values()) as Element[],
    );
    previewGeneratedElementsRef.current.clear();

    if (queuedElements.length === 0) {
      return;
    }

    mergeElementsCanonicalPrimary(queuedElements);

    void (async () => {
      try {
        await createMultipleElementsCanonicalPrimary(queuedElements);
      } catch (error) {
        console.error("❌ Preview generated elements DB 저장 실패:", error);
      }
    })();
  }, []);

  const enqueuePreviewGeneratedElements = useCallback(
    (elements: Element[]) => {
      if (elements.length === 0) {
        return;
      }

      for (const element of elements) {
        previewGeneratedElementsRef.current.set(element.id, element);
      }

      if (previewGeneratedElementsFlushIdRef.current !== null) {
        return;
      }

      previewGeneratedElementsFlushIdRef.current = scheduleNextFrame(() => {
        flushPreviewGeneratedElements();
      });
    },
    [flushPreviewGeneratedElements],
  );

  // 요소들을 iframe에 전송 (상태에 따라 큐잉)
  // ⭐ Layout/Slot System: pageInfo도 함께 전송 (초기 로드 시 Layout 렌더링용)
  const sendElementsToIframe = useCallback((elementsToSend: Element[]) => {
    const iframe = MessageService.getIframe();

    // 🔧 FIX: Ref를 사용하여 최신 상태 확인 (비동기 state 업데이트 회피)
    const currentReadyState = iframeReadyStateRef.current;

    // ⭐ Layout/Slot System: editMode에 따라 pageInfo 결정
    const currentEditMode = useEditModeStore.getState().mode;
    const selectedReusableFrameId = getSelectedReusableFrameId();
    const { currentPageId, pages } = useStore.getState();
    const currentPage = pages.find((p) => p.id === currentPageId);
    const scopedElements =
      currentEditMode === "layout" || !currentPageId
        ? elementsToSend
        : elementsToSend.filter((element) => element.page_id === currentPageId);

    // Layout 편집 모드: pageId=null, layoutId=selectedReusableFrameId
    // Page 모드: pageId=currentPageId, layoutId=page legacy layout binding
    // ADR-903 P3-D-4 Phase B: reusableFrameId 신규 field — canonical model 의
    // reusable frame 식별자. 현 시점 layoutId 와 동일 의미 (alias). Preview 가
    // version 으로 분기해 신규 field 우선 사용 가능. legacy layoutId 는 BC 위해 유지.
    const layoutId =
      currentEditMode === "layout"
        ? selectedReusableFrameId
        : getNullablePageFrameBindingId(currentPage);
    const pageInfo = {
      pageId: currentEditMode === "layout" ? null : currentPageId,
      layoutId,
      reusableFrameId: layoutId,
    };

    // iframe이 준비되지 않았으면 큐에 넣기
    if (currentReadyState !== "ready" || !iframe?.contentWindow) {
      messageQueueRef.current.push({
        type: "UPDATE_ELEMENTS",
        payload: { elements: scopedElements, pageInfo },
      });
      return;
    }

    // ADR-903 P3-D-4 Phase B: version bump
    // - legacy-1.0 → composition-1.0 (canonical resolver 전환 완료 신호)
    // - Preview 가 version 으로 reusableFrameId vs layoutId 우선순위 분기
    const message = {
      type: "UPDATE_ELEMENTS",
      version: "composition-1.0" as const,
      elements: scopedElements,
      pageInfo,
    };
    iframe.contentWindow.postMessage(message, window.location.origin);
  }, []); // ✅ 의존성 제거 (Ref 사용)

  const sendCanonicalDocumentToIframe = useCallback(
    (document: CompositionDocument | null) => {
      const iframe = MessageService.getIframe();
      const currentReadyState = iframeReadyStateRef.current;
      const message = {
        type: "UPDATE_CANONICAL_DOCUMENT" as const,
        document,
      };

      if (currentReadyState !== "ready" || !iframe?.contentWindow) {
        messageQueueRef.current.push({
          type: "UPDATE_CANONICAL_DOCUMENT",
          payload: message,
        });
        return;
      }

      iframe.contentWindow.postMessage(message, window.location.origin);
    },
    [],
  );

  // ⭐ Layout/Slot System: Page 정보를 iframe에 전송
  const sendPageInfoToIframe = useCallback(
    (pageId: string | null, layoutId: string | null) => {
      const startTime = markBegin();
      const iframe = MessageService.getIframe();
      const currentReadyState = iframeReadyStateRef.current;

      const message = {
        type: "UPDATE_PAGE_INFO",
        pageId,
        layoutId,
      };

      if (currentReadyState !== "ready" || !iframe?.contentWindow) {
        messageQueueRef.current.push({
          type: "UPDATE_PAGE_INFO",
          payload: message,
        });
        const duration = markEnd("iframe.send-page-info.queue", startTime);
        if (duration >= 8) {
          console.log("[perf] iframe.send-page-info.queue", {
            durationMs: Number(duration.toFixed(1)),
            pageId,
            layoutId,
          });
        }
        return;
      }

      iframe.contentWindow.postMessage(message, window.location.origin);
      const duration = markEnd("iframe.send-page-info", startTime);
      if (duration >= 8) {
        console.log("[perf] iframe.send-page-info", {
          durationMs: Number(duration.toFixed(1)),
          pageId,
          layoutId,
        });
      }
    },
    [],
  );

  // ⭐ Nested Routes & Slug System: Layouts를 iframe에 전송
  const sendLayoutsToIframe = useCallback(() => {
    const iframe = MessageService.getIframe();

    // 🔧 FIX: Ref를 사용하여 최신 상태 확인
    const currentReadyState = iframeReadyStateRef.current;

    // 현재 reusable frame surface 가져오기
    const currentLayouts = getCanonicalReusableFrameLayouts();

    // PreviewLayout 형태로 변환 (id, name, slug만 전송)
    const previewLayouts = currentLayouts.map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug || null,
    }));

    const message = {
      type: "UPDATE_LAYOUTS",
      layouts: previewLayouts,
    };

    // iframe이 준비되지 않았으면 큐에 넣기
    if (currentReadyState !== "ready" || !iframe?.contentWindow) {
      messageQueueRef.current.push({
        type: "UPDATE_LAYOUTS",
        payload: message,
      });
      return;
    }

    iframe.contentWindow.postMessage(message, window.location.origin);
  }, []); // ✅ 의존성 제거 (Ref 사용)

  // ⭐ ADR-903 P2 옵션 C: Pages 를 iframe 에 전송 (canonical resolver hydration)
  // legacy 경로는 element.page_id 만으로 렌더 가능했으나 canonical resolve 가
  // page 노드 (RefNode metadata.type="legacy-page") 생성을 위해 pages 메타데이터
  // 필요. UPDATE_PAGES message handler 는 P0 시점에 land 됐으나 sender 가 누락.
  const sendPagesToIframe = useCallback(() => {
    const iframe = MessageService.getIframe();
    const currentReadyState = iframeReadyStateRef.current;

    // 현재 pages 가져오기 (useStore 통합 store)
    const currentPages = useStore.getState().pages;

    // PreviewPage (RuntimePage) 형태로 변환
    const previewPages = currentPages.map((p) =>
      withPageFrameBinding(
        {
          id: p.id,
          title: p.title,
          slug: p.slug,
          order_num: p.order_num ?? 0,
          parent_id: p.parent_id ?? null,
        },
        getNullablePageFrameBindingId(p),
      ),
    );

    const message = {
      type: "UPDATE_PAGES" as const,
      pages: previewPages,
    };

    if (currentReadyState !== "ready" || !iframe?.contentWindow) {
      messageQueueRef.current.push({
        type: "UPDATE_PAGES",
        payload: message,
      });
      return;
    }

    iframe.contentWindow.postMessage(message, window.location.origin);
  }, []);

  // ⭐ DataTables를 iframe에 전송 (PropertyDataBinding용)
  const sendDataTablesToIframe = useCallback(() => {
    const iframe = MessageService.getIframe();

    // 🔧 FIX: Ref를 사용하여 최신 상태 확인
    const currentReadyState = iframeReadyStateRef.current;

    // 현재 dataTables 가져오기
    const currentDataTables = dataTables;

    // RuntimeDataTable 형태로 변환 (id, name, mockData, runtimeData, useMockData, schema 전송)
    // ⭐ mockData의 키는 schema의 key를 그대로 유지 (label 변환 제거)
    const runtimeDataTables = currentDataTables.map((dt) => {
      return {
        id: dt.id,
        name: dt.name,
        schema: dt.schema, // schema도 함께 전송
        mockData: dt.mockData || [],
        runtimeData: dt.runtimeData || [], // ⭐ runtimeData도 전송 (API 데이터)
        useMockData: dt.useMockData,
      };
    });

    const message = {
      type: "UPDATE_DATA_TABLES",
      dataTables: runtimeDataTables,
    };

    // iframe이 준비되지 않았으면 큐에 넣기
    if (currentReadyState !== "ready" || !iframe?.contentWindow) {
      messageQueueRef.current.push({
        type: "UPDATE_DATA_TABLES",
        payload: message,
      });
      return;
    }

    iframe.contentWindow.postMessage(message, window.location.origin);
  }, [dataTables]); // dataTables 변경 시 갱신

  // ⭐ ApiEndpoints를 iframe에 전송 (PropertyDataBinding용)
  const sendApiEndpointsToIframe = useCallback(() => {
    const iframe = MessageService.getIframe();

    // 🔧 FIX: Ref를 사용하여 최신 상태 확인
    const currentReadyState = iframeReadyStateRef.current;

    // 현재 apiEndpoints 가져오기
    const currentApiEndpoints = apiEndpoints;

    // RuntimeApiEndpoint 형태로 변환
    const runtimeApiEndpoints = currentApiEndpoints.map((ep) => ({
      id: ep.id,
      name: ep.name,
      method: ep.method,
      baseUrl: ep.baseUrl,
      path: ep.path,
      headers: ep.headers,
      params: ep.queryParams,
      body: ep.bodyTemplate,
    }));

    const message = {
      type: "UPDATE_API_ENDPOINTS",
      apiEndpoints: runtimeApiEndpoints,
    };

    // iframe이 준비되지 않았으면 큐에 넣기
    if (currentReadyState !== "ready" || !iframe?.contentWindow) {
      messageQueueRef.current.push({
        type: "UPDATE_API_ENDPOINTS",
        payload: message,
      });
      return;
    }

    iframe.contentWindow.postMessage(message, window.location.origin);
  }, [apiEndpoints]); // apiEndpoints 변경 시 갱신

  // ⭐ Variables를 iframe에 전송 (PropertyDataBinding용)
  const sendVariablesToIframe = useCallback(() => {
    const iframe = MessageService.getIframe();

    // 🔧 FIX: Ref를 사용하여 최신 상태 확인
    const currentReadyState = iframeReadyStateRef.current;

    // ⭐ getVariablesForCanvas 사용 - 런타임 값 포함
    const runtimeVariables = getVariablesForCanvas();

    const message = {
      type: "UPDATE_VARIABLES",
      variables: runtimeVariables,
    };

    // iframe이 준비되지 않았으면 큐에 넣기
    if (currentReadyState !== "ready" || !iframe?.contentWindow) {
      messageQueueRef.current.push({
        type: "UPDATE_VARIABLES",
        payload: message,
      });
      return;
    }

    iframe.contentWindow.postMessage(message, window.location.origin);
  }, []); // variables 변경은 별도 useEffect에서 처리

  // 요소 선택 시 iframe에 메시지 전송
  const sendElementSelectedMessage = useCallback(
    (elementId: string, props?: ElementProps) => {
      const iframe = MessageService.getIframe();

      // 성능 최적화: Map 사용 (O(1) 조회)
      const element = elementsMap.get(elementId);
      if (!element) return;

      const message = {
        type: "ELEMENT_SELECTED",
        elementId,
        payload: {
          type: element.type,
          props: props || element.props,
          source: "builder",
        },
        source: "builder",
      };

      // 🔧 FIX: Ref 사용
      if (iframeReadyStateRef.current !== "ready" || !iframe?.contentWindow) {
        messageQueueRef.current.push({
          type: "ELEMENT_SELECTED",
          payload: message,
        });
        return;
      }

      iframe.contentWindow.postMessage(message, window.location.origin);
    },
    [elementsMap],
  ); // ✅ 의존성에서 iframeReadyState 제거

  // 큐에 있는 메시지들 처리
  const processMessageQueue = useCallback(() => {
    // 🔧 FIX: Ref 사용
    if (iframeReadyStateRef.current !== "ready") return;

    const iframe = MessageService.getIframe();
    if (!iframe?.contentWindow) return;

    const queue = [...messageQueueRef.current];
    messageQueueRef.current = [];

    queue.forEach((item) => {
      if (item.type === "UPDATE_ELEMENTS") {
        // ⭐ Layout/Slot System: 새 payload 형식 (elements + pageInfo)
        // ADR-903 P3-D-4 Phase B: reusableFrameId 추가 (layoutId alias)
        const payload = item.payload as {
          elements: Element[];
          pageInfo: {
            pageId: string | null;
            layoutId: string | null;
            reusableFrameId?: string | null;
          };
        };
        // ADR-903 P3-D-4 Phase B: version composition-1.0 (큐 경로 동기화)
        iframe.contentWindow!.postMessage(
          {
            type: "UPDATE_ELEMENTS",
            version: "composition-1.0" as const,
            elements: payload.elements,
            pageInfo: payload.pageInfo,
          },
          window.location.origin,
        );
      } else if (item.type === "ELEMENT_SELECTED") {
        iframe.contentWindow!.postMessage(item.payload, window.location.origin);
      } else if (item.type === "REQUEST_ELEMENT_SELECTION") {
        iframe.contentWindow!.postMessage(item.payload, window.location.origin);
      } else if (item.type === "UPDATE_PAGE_INFO") {
        // ⭐ Layout/Slot System: Page 정보 전송
        iframe.contentWindow!.postMessage(item.payload, window.location.origin);
      } else if (item.type === "UPDATE_CANONICAL_DOCUMENT") {
        iframe.contentWindow!.postMessage(item.payload, window.location.origin);
      } else if (item.type === "UPDATE_LAYOUTS") {
        // ⭐ Nested Routes & Slug System: Layouts 전송
        iframe.contentWindow!.postMessage(item.payload, window.location.origin);
      } else if (item.type === "UPDATE_DATA_TABLES") {
        // ⭐ DataTables 전송 (PropertyDataBinding용)
        iframe.contentWindow!.postMessage(item.payload, window.location.origin);
      } else if (item.type === "UPDATE_API_ENDPOINTS") {
        // ⭐ ApiEndpoints 전송 (PropertyDataBinding용)
        iframe.contentWindow!.postMessage(item.payload, window.location.origin);
      } else if (item.type === "UPDATE_VARIABLES") {
        // ⭐ Variables 전송 (PropertyDataBinding용)
        iframe.contentWindow!.postMessage(item.payload, window.location.origin);
      }
    });
  }, []); // ✅ 의존성 제거 (Ref 사용)

  const handleIframeLoad = useCallback(() => {
    // 🔧 FIX: Ref도 업데이트
    iframeReadyStateRef.current = "loading";
    setIframeReadyState("loading");

    // 🔧 FIX: 요소 전송은 PREVIEW_READY 핸들러에서 처리
    // (여기서는 DOM 로드만 확인하고, Preview의 React 앱 마운트를 기다림)
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // PREVIEW_READY는 origin 검증, 그 외는 source+origin 이중 검증
      const isBootstrap = event.data?.type === "PREVIEW_READY";
      if (isBootstrap) {
        if (!isValidBootstrapMessage(event)) {
          console.warn(
            "[Security] PREVIEW_READY 메시지 검증 실패 — 잘못된 origin:",
            event.origin,
          );
          return;
        }
      } else {
        if (!isValidPreviewMessage(event)) {
          return;
        }
      }

      // 🔧 FIX: Preview가 준비되었다는 신호 처리
      if (event.data.type === "PREVIEW_READY") {
        // 🔧 FIX: Ref를 먼저 업데이트 (동기적 상태 변경)
        iframeReadyStateRef.current = "ready";
        // State도 업데이트 (UI 반영)
        setIframeReadyState("ready");

        // 🚀 Delta Update: iframe 참조 설정
        const iframe = MessageService.getIframe();
        if (iframe) {
          canvasDeltaMessenger.setIframe(iframe);
        }

        // ✅ 즉시 처리 (setTimeout 제거)
        processMessageQueue();

        // ⭐ Layout/Slot System: persist hydration 완료 후 요소 전송
        // (새로고침 시 editMode가 아직 hydration 안 됐을 수 있음)
        const sendInitialData = () => {
          // ADR-056 Phase 3: Base Typography 초기 전송
          // (새로고침 시 localStorage 복원된 baseTypography → Preview body 동기화)
          const { baseTypography } = useThemeConfigStore.getState();
          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
              { type: "THEME_BASE_TYPOGRAPHY", payload: baseTypography },
              window.location.origin,
            );
          }

          // ⭐ Nested Routes & Slug System: 초기 layouts 전송
          sendLayoutsToIframe();

          // ⭐ ADR-903 P2 옵션 C: 초기 pages 전송 (canonical resolver hydration)
          sendPagesToIframe();

          const canonicalDoc = getActiveCanonicalDocument();
          sendCanonicalDocumentToIframe(canonicalDoc);

          // ⭐ DataTables 전송 (PropertyDataBinding용)
          sendDataTablesToIframe();

          // ⭐ ApiEndpoints 전송 (PropertyDataBinding용)
          sendApiEndpointsToIframe();

          // ⭐ Variables 전송 (PropertyDataBinding용)
          sendVariablesToIframe();

          // Elements 전송
          // sendInitialData 는 useCallback 안의 closure 라 React state (elements) 가
          // stale 가능. 매 호출 시 active canonical document 를 직접 확인한다.
          let currentElements: Element[];
          if (canonicalDoc) {
            currentElements = canonicalDocumentToElements(canonicalDoc);
          } else {
            currentElements = useStore.getState().elements;
          }
          if (currentElements.length > 0) {
            // Phase 2.1 최적화: 참조 저장 (중복 전송 방지)
            lastSentElementsRef.current = currentElements;
            sendElementsToIframe(currentElements);
          }
        };

        // persist hydration 완료 확인
        const editModeHydrated =
          useEditModeStore.persist?.hasHydrated?.() ?? true;
        if (editModeHydrated) {
          // 이미 hydration 완료 → 즉시 전송
          sendInitialData();
        } else {
          // hydration 대기 후 전송
          const checkHydration = () => {
            const editDone = useEditModeStore.persist?.hasHydrated?.() ?? true;
            if (editDone) {
              sendInitialData();
            } else {
              // 다음 프레임에서 다시 확인
              requestAnimationFrame(checkHydration);
            }
          };
          requestAnimationFrame(checkHydration);
        }

        return;
      }

      // ✅ ACK: Preview가 요소를 받았다는 확인
      if (event.data.type === "ELEMENTS_UPDATED_ACK") {
        // ACK 시점 기록
        lastAckTimestampRef.current = event.data.timestamp || Date.now();

        // 전송 플래그 해제 (즉시)
        isSendingRef.current = false;

        // 🎯 대기 중인 auto-select가 있으면 실행 (모듈 레벨 변수)
        if (pendingAutoSelectElementId) {
          const elementId = pendingAutoSelectElementId;
          pendingAutoSelectElementId = null; // 초기화

          const iframe = MessageService.getIframe();
          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
              {
                type: "REQUEST_ELEMENT_SELECTION",
                elementId,
              },
              "*", // 개발환경: origin 제한 없음
            );
          }
        }

        return;
      }

      // Preview에서 Column Elements 일괄 추가 요청
      if (
        event.data.type === "ADD_COLUMN_ELEMENTS" &&
        event.data.payload?.columns
      ) {
        const { elementsMap } = useStore.getState();
        const newColumns = event.data.payload.columns;

        const columnsToAdd = newColumns.filter(
          (col: Element) => !elementsMap.has(col.id),
        );

        if (columnsToAdd.length === 0) {
          return;
        }

        enqueuePreviewGeneratedElements(columnsToAdd);
        return;
      }

      // Preview에서 Field Elements 일괄 추가 요청 (ListBox column detection)
      if (
        event.data.type === "ADD_FIELD_ELEMENTS" &&
        event.data.payload?.fields
      ) {
        const { elementsMap } = useStore.getState();
        const newFields = event.data.payload.fields;

        const fieldsToAdd = newFields.filter(
          (field: Element) => !elementsMap.has(field.id),
        );

        if (fieldsToAdd.length === 0) {
          return;
        }

        enqueuePreviewGeneratedElements(fieldsToAdd);
        return;
      }

      if (event.data.type === "UPDATE_ELEMENTS" && event.data.elements) {
        const isRecoverySync =
          event.data.source === "preview-recovery" ||
          event.data.syncMode === "recovery" ||
          event.data.reason === "hard-resync";

        if (!isRecoverySync) {
          console.warn(
            "[ADR-040] Ignored interactive UPDATE_ELEMENTS from preview; recovery sync only",
          );
          return;
        }

        const { recoverElementsSnapshot } = useStore.getState();
        recoverElementsSnapshot(event.data.elements as Element[]);
      }

      if (event.data.type === "UPDATE_THEME_TOKENS") {
        const iframe = MessageService.getIframe();
        if (!iframe?.contentDocument) return;

        let parentStyleElement = document.getElementById("theme-tokens");
        if (!parentStyleElement) {
          parentStyleElement = document.createElement("style");
          parentStyleElement.id = "theme-tokens";
          document.head.appendChild(parentStyleElement);
        }

        const cssString = `:root {\n${Object.entries(event.data.styles)
          .map(([key, value]) => `  ${key}: ${value};`)
          .join("\n")}\n}`;

        parentStyleElement.textContent = cssString;

        let styleElement =
          iframe.contentDocument.getElementById("theme-tokens");
        if (!styleElement) {
          styleElement = iframe.contentDocument.createElement("style");
          styleElement.id = "theme-tokens";
          iframe.contentDocument.head.appendChild(styleElement);
        }

        styleElement.textContent = cssString;
      }

      if (
        event.data.type === "ELEMENT_SELECTED" &&
        event.data.source !== "builder"
      ) {
        const newElementId = event.data.elementId;

        // ⭐ 다중 선택 모드 처리
        const { isMultiSelect } = event.data;

        // 🚀 Phase 19: startTransition으로 선택 업데이트를 비긴급 처리 (INP 개선)
        startTransition(() => {
          if (isMultiSelect) {
            // Cmd/Ctrl + Click: 다중 선택 토글
            const store = useStore.getState();
            store.toggleElementInSelection(newElementId);
          } else {
            // 일반 클릭: 단일 선택 (computedStyle 없이 즉시 선택 - Option B+C)
            // computedStyle은 별도 메시지(ELEMENT_COMPUTED_STYLE)로 나중에 도착
            useStore.getState().setSelectedElement(
              newElementId,
              event.data.payload?.props,
              event.data.payload?.style,
              undefined, // computedStyle은 나중에 업데이트
            );
          }
        });
      }

      // ⭐ Option C: computedStyle 별도 메시지 처리 (오버레이 표시 후 지연 도착)
      // 🚀 Phase 21: startTransition 적용
      if (
        event.data.type === "ELEMENT_COMPUTED_STYLE" &&
        event.data.elementId
      ) {
        startTransition(() => {
          const store = useStore.getState();
          const currentSelectedId = store.selectedElementId;

          // 현재 선택된 요소의 computedStyle만 업데이트
          if (
            currentSelectedId === event.data.elementId &&
            event.data.payload?.computedStyle
          ) {
            store.updateSelectedComputedStyle(event.data.payload.computedStyle);
          }
        });
      }

      // ⭐ 드래그 선택 (Shift + Drag Lasso Selection)
      // 🚀 Phase 21: startTransition 적용
      if (event.data.type === "ELEMENTS_DRAG_SELECTED") {
        startTransition(() => {
          // ⭐ FIX: 드래그 선택은 새로운 선택 세트를 설정하므로 항상 허용
          // (isSyncingToBuilder 체크 제거 - 새 요소 선택은 차단하지 않음)
          const store = useStore.getState();
          store.setSelectedElements(event.data.elementIds);
        });
      }

      // ELEMENT_UPDATED 메시지 처리는 제거 (무한 루프 방지)
      // PropertyPanel에서 직접 iframe으로 메시지를 보내므로 여기서는 처리하지 않음

      // 누락된 메시지 핸들링 추가
      // 🚀 Phase 21: startTransition 적용
      if (event.data.type === "UPDATE_ELEMENT_PROPS" && event.data.elementId) {
        startTransition(() => {
          const { updateElementProps } = useStore.getState();
          updateElementProps(
            event.data.elementId,
            event.data.props || event.data.payload?.props,
          );
        });
      }

      // 프리뷰에서 보내는 element-props-update 메시지 처리
      // 🚀 Phase 21: startTransition 적용
      if (event.data.type === "element-props-update" && event.data.elementId) {
        startTransition(() => {
          const { updateElementProps } = useStore.getState();
          updateElementProps(event.data.elementId, event.data.props);
        });
      }

      // 프리뷰에서 보내는 element-click 메시지 처리
      if (event.data.type === "element-click" && event.data.elementId) {
        // 🚀 Phase 19: startTransition으로 선택 업데이트를 비긴급 처리 (INP 개선)
        startTransition(() => {
          useStore
            .getState()
            .setSelectedElement(
              event.data.elementId,
              event.data.payload?.props,
            );
        });

        // 선택된 요소 정보를 iframe에 다시 전송하여 오버레이 표시
        // 성능 최적화: Map 사용 (O(1) 조회)
        const element = elementsMap.get(event.data.elementId);
        if (element) {
          const iframe = MessageService.getIframe();
          if (iframe?.contentWindow) {
            const message = {
              type: "ELEMENT_SELECTED",
              elementId: event.data.elementId,
              payload: {
                type: element.type,
                props: element.props,
                source: "builder",
              },
              source: "builder",
            };
            iframe.contentWindow.postMessage(message, window.location.origin);
          }
        }
      }

      // 추가: element-hover 메시지 처리 (선택사항)
      if (event.data.type === "element-hover" && event.data.elementId) {
        // 필요시 hover 상태 처리 로직 추가
      }
    },
    [
      enqueuePreviewGeneratedElements,
      elementsMap,
      processMessageQueue,
      sendElementsToIframe,
      sendCanonicalDocumentToIframe,
      sendLayoutsToIframe,
      sendPagesToIframe,
      sendDataTablesToIframe,
      sendApiEndpointsToIframe,
      sendVariablesToIframe,
    ],
  );

  useEffect(() => {
    return () => {
      cancelScheduledFrame(previewGeneratedElementsFlushIdRef.current);
    };
  }, []);

  const { handleUndo, handleRedo } = useMemo(() => {
    const runHistoryAction = (action: "undo" | "redo") => {
      try {
        // 백업 시스템의 히스토리 사용
        const historyAction = useStore.getState()[action];
        historyAction();
      } catch (error) {
        console.error(`백업 시스템 ${action} error:`, error);
      }
    };

    return {
      handleUndo: debounce(() => runHistoryAction("undo"), 300),
      handleRedo: debounce(() => runHistoryAction("redo"), 300),
    };
  }, []);

  useEffect(() => {
    return () => {
      handleUndo.cancel();
      handleRedo.cancel();
    };
  }, [handleUndo, handleRedo]);

  // Page 정보가 변경될 때 iframe에 전송
  const lastSentPageInfoRef = useRef<{
    pageId: string | null;
    layoutId: string | null;
  }>({
    pageId: null,
    layoutId: null,
  });
  const pendingPageInfoFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // iframe이 준비되지 않았으면 스킵
    if (iframeReadyStateRef.current !== "ready") {
      return;
    }

    const currentPage = pages.find((p) => p.id === currentPageId);
    const pageId = currentEditMode === "layout" ? null : currentPageId;
    const layoutId =
      currentEditMode === "layout"
        ? selectedReusableFrameId
        : getNullablePageFrameBindingId(currentPage);

    // 이전 값과 같으면 스킵
    if (
      lastSentPageInfoRef.current.pageId === pageId &&
      lastSentPageInfoRef.current.layoutId === layoutId
    ) {
      return;
    }

    cancelScheduledFrame(pendingPageInfoFrameRef.current);

    pendingPageInfoFrameRef.current = scheduleNextFrame(() => {
      const frameStart = performance.now();
      pendingPageInfoFrameRef.current = null;

      if (iframeReadyStateRef.current !== "ready") {
        return;
      }

      lastSentPageInfoRef.current = { pageId, layoutId };
      sendPageInfoToIframe(pageId, layoutId);
      const duration = performance.now() - frameStart;
      if (duration >= 8) {
        console.log("[perf] iframe.page-info.effect", {
          durationMs: Number(duration.toFixed(1)),
          pageId,
          layoutId,
        });
      }
    });

    return () => {
      cancelScheduledFrame(pendingPageInfoFrameRef.current);
      pendingPageInfoFrameRef.current = null;
    };
  }, [
    currentEditMode,
    currentPageId,
    pages,
    selectedReusableFrameId,
    sendPageInfoToIframe,
  ]);

  const pendingElementsFrameRef = useRef<number | null>(null);
  const lastSentCanonicalDocumentRef = useRef<CompositionDocument | null>(null);
  const pendingCanonicalDocumentFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isWebGLOnly) return;

    if (lastSentCanonicalDocumentRef.current === activeCanonicalDocument) {
      return;
    }

    cancelScheduledFrame(pendingCanonicalDocumentFrameRef.current);

    pendingCanonicalDocumentFrameRef.current = scheduleNextFrame(() => {
      pendingCanonicalDocumentFrameRef.current = null;
      lastSentCanonicalDocumentRef.current = activeCanonicalDocument;
      sendCanonicalDocumentToIframe(activeCanonicalDocument);
    });

    return () => {
      cancelScheduledFrame(pendingCanonicalDocumentFrameRef.current);
      pendingCanonicalDocumentFrameRef.current = null;
    };
  }, [activeCanonicalDocument, isWebGLOnly, sendCanonicalDocumentToIframe]);

  useEffect(() => {
    if (isWebGLOnly) return;

    if (lastSentElementsRef.current === elements) {
      return;
    }

    cancelScheduledFrame(pendingElementsFrameRef.current);

    pendingElementsFrameRef.current = scheduleNextFrame(() => {
      pendingElementsFrameRef.current = null;
      lastSentElementsRef.current = elements;
      sendElementsToIframe(elements);
    });

    return () => {
      cancelScheduledFrame(pendingElementsFrameRef.current);
      pendingElementsFrameRef.current = null;
    };
  }, [elements, isWebGLOnly, sendElementsToIframe]);

  // ⭐ Nested Routes & Slug System: Layouts가 변경될 때마다 iframe에 전송
  const lastSentLayoutsRef = useRef<string>("");

  useEffect(() => {
    // iframe이 준비되지 않았으면 스킵
    if (iframeReadyStateRef.current !== "ready") {
      return;
    }

    // JSON 문자열로 비교 (slug 변경 감지 포함)
    const layoutsJson = JSON.stringify(
      layouts.map((l) => ({
        id: l.id,
        name: l.name,
        slug: l.slug,
      })),
    );

    // 이전 값과 같으면 스킵
    if (lastSentLayoutsRef.current === layoutsJson) {
      return;
    }

    // 값 저장 후 전송
    lastSentLayoutsRef.current = layoutsJson;
    sendLayoutsToIframe();
  }, [layouts, sendLayoutsToIframe]);

  // ⭐ ADR-903 P2 옵션 C: Pages 가 변경될 때마다 iframe 에 전송
  const lastSentPagesRef = useRef<string>("");

  useEffect(() => {
    if (iframeReadyStateRef.current !== "ready") {
      return;
    }

    const pagesJson = JSON.stringify(
      pages.map((p) =>
        withPageFrameBinding(
          {
            id: p.id,
            title: p.title,
            slug: p.slug,
            order_num: p.order_num ?? 0,
            parent_id: p.parent_id ?? null,
          },
          getNullablePageFrameBindingId(p),
        ),
      ),
    );

    if (lastSentPagesRef.current === pagesJson) {
      return;
    }

    lastSentPagesRef.current = pagesJson;
    sendPagesToIframe();
  }, [pages, sendPagesToIframe]);

  // ⭐ DataTables가 변경될 때마다 iframe에 전송 (PropertyDataBinding용)
  const lastSentDataTablesRef = useRef<string>("");

  useEffect(() => {
    // JSON 문자열로 비교 (mockData 변경 감지 포함)
    const dataTablesJson = JSON.stringify(
      dataTables.map((dt) => ({
        id: dt.id,
        name: dt.name,
        mockData: dt.mockData,
        useMockData: dt.useMockData,
      })),
    );

    // 이전 값과 같으면 스킵
    if (lastSentDataTablesRef.current === dataTablesJson) {
      return;
    }

    // 값 저장 후 전송 (sendDataTablesToIframe 내부에서 iframe 준비 상태에 따라 큐잉 또는 직접 전송)
    lastSentDataTablesRef.current = dataTablesJson;
    sendDataTablesToIframe();
  }, [dataTables, sendDataTablesToIframe]);

  // ⭐ ApiEndpoints가 변경될 때마다 iframe에 전송 (PropertyDataBinding용)
  const lastSentApiEndpointsRef = useRef<string>("");

  useEffect(() => {
    // JSON 문자열로 비교
    const apiEndpointsJson = JSON.stringify(
      apiEndpoints.map((ep) => ({
        id: ep.id,
        name: ep.name,
        method: ep.method,
        baseUrl: ep.baseUrl,
        path: ep.path,
      })),
    );

    // 이전 값과 같으면 스킵
    if (lastSentApiEndpointsRef.current === apiEndpointsJson) {
      return;
    }

    // 값 저장 후 전송 (sendApiEndpointsToIframe 내부에서 iframe 준비 상태에 따라 큐잉 또는 직접 전송)
    lastSentApiEndpointsRef.current = apiEndpointsJson;
    sendApiEndpointsToIframe();
  }, [apiEndpoints, sendApiEndpointsToIframe]);

  // ⭐ Variables가 변경될 때마다 iframe에 전송 (PropertyDataBinding용)
  const lastSentVariablesRef = useRef<string>("");

  useEffect(() => {
    // JSON 문자열로 비교
    const variablesJson = JSON.stringify(
      variables.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        defaultValue: v.defaultValue,
        persist: v.persist,
        scope: v.scope,
      })),
    );

    // 이전 값과 같으면 스킵
    if (lastSentVariablesRef.current === variablesJson) {
      return;
    }

    // 값 저장 후 전송 (sendVariablesToIframe 내부에서 iframe 준비 상태에 따라 큐잉 또는 직접 전송)
    lastSentVariablesRef.current = variablesJson;
    sendVariablesToIframe();
  }, [variables, sendVariablesToIframe]);

  // 🔧 REMOVED: Ref를 사용하므로 iframeReadyState 기반 useEffect 불필요
  // processMessageQueue는 PREVIEW_READY 핸들러에서 직접 호출됨

  // Preview에 요소 선택 요청 (rect 정보와 함께 응답받기)
  const requestElementSelection = useCallback((elementId: string) => {
    const iframe = MessageService.getIframe();

    const message = {
      type: "REQUEST_ELEMENT_SELECTION",
      elementId,
    };

    // 🔧 FIX: iframe이 준비되지 않았으면 큐에 넣기
    if (iframeReadyStateRef.current !== "ready" || !iframe?.contentWindow) {
      messageQueueRef.current.push({
        type: "REQUEST_ELEMENT_SELECTION",
        payload: message,
      });
      return;
    }

    iframe.contentWindow.postMessage(message, window.location.origin);
  }, []); // ✅ 의존성 제거 (Ref 사용)

  // 🎯 UPDATE_ELEMENTS 후 ACK를 받으면 자동으로 요소 선택 (모듈 레벨 변수)
  const requestAutoSelectAfterUpdate = useCallback(
    (elementId: string) => {
      if (isWebGLOnly) return; // 🚀 WebGL-only 모드에서는 스킵
      pendingAutoSelectElementId = elementId;
    },
    [isWebGLOnly],
  );

  // 🚀 Phase 11: WebGL-only 모드에서는 no-op 반환
  // Hook은 항상 호출되지만, 실제 작업은 스킵됨
  if (isWebGLOnly) {
    return {
      iframeReadyState: "not_initialized",
      handleIframeLoad: () => {},
      handleMessage: () => {},
      handleUndo: noopDebouncedAsync,
      handleRedo: noopDebouncedAsync,
      sendElementsToIframe: () => {},
      sendElementSelectedMessage: () => {},
      requestElementSelection: () => {},
      requestAutoSelectAfterUpdate: () => {},
      sendLayoutsToIframe: () => {},
      sendPagesToIframe: () => {},
      sendDataTablesToIframe: () => {},
      sendApiEndpointsToIframe: () => {},
      sendVariablesToIframe: () => {},
      isIframeReady: false,
    };
  }

  return {
    iframeReadyState,
    handleIframeLoad,
    handleMessage,
    handleUndo,
    handleRedo,
    sendElementsToIframe,
    sendElementSelectedMessage,
    requestElementSelection,
    requestAutoSelectAfterUpdate,
    sendLayoutsToIframe,
    sendPagesToIframe,
    sendDataTablesToIframe,
    sendApiEndpointsToIframe,
    sendVariablesToIframe,
    isIframeReady,
  };
};
