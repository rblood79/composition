/**
 * useIframeMessenger - iframe 기반 Preview 통신 훅
 *
 * @deprecated 🚀 Phase 10 B2.4: WebGL Canvas로 마이그레이션 중
 *
 * 이 훅은 iframe + postMessage 패턴을 사용합니다.
 * WebGL Canvas (VITE_USE_WEBGL_CANVAS=true)에서는 더 이상 필요하지 않습니다.
 *
 * 마이그레이션 가이드:
 * - 요소/선택 읽기는 canonical document와 unified store selector를 사용
 * - 요소 업데이트는 unified store action 또는 canonical mutation runner를 사용
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
  useCanonicalReusableFrameLayouts,
  useSelectedReusableFrameId,
} from "../stores/canonical/canonicalFrameStore";
import {
  useCollections,
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
import { mergeElementsCanonicalPrimary } from "@/adapters/canonical/canonicalMutations";
import { useCompareModeStore } from "../workspace/canvas/stores";
import {
  getNullablePageFrameBindingId,
  withPageFrameBinding,
} from "../../adapters/canonical/frameMirror";
// `canvasDeltaMessenger` import 제거 (2026-08-17) — delta 프로토콜 삭제.
// send 메서드 4종이 호출처 0건이었고 게이트(`isWebGLCanvas() &&
// !isCanvasCompareMode()`)까지 기본 구성에서 상시 차단이라 이중으로 죽어
// 있었다. Builder → Preview 동기화는 `UPDATE_CANONICAL_DOCUMENT` 단일 채널.
// 🚀 Phase 11: Feature Flags for WebGL-only mode optimization
import { isWebGLCanvas, isCanvasCompareMode } from "../../utils/featureFlags";
import { useActiveCanonicalDocument } from "../stores/canonical/canonicalElementsBridge";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { getActiveCanonicalElementById } from "../stores/canonical/canonicalElementsView";
import { getCanonicalDocumentProjectableNodeIds } from "../stores/canonical/canonicalTraversalHelpers";
import type { CompositionDocument } from "@composition/shared";
import { recordEditorPresentationPreviewFullDocumentMessage } from "../performance/editorPresentationPhase0Metrics";
// ADR-006 P2-2: postMessage 보안 검증
import {
  isValidBootstrapMessage,
  isValidPreviewMessage,
} from "../../utils/messageValidation";
import {
  scheduleFrameOrTimeout,
  scheduleNextFrame,
} from "../utils/scheduleTask";
// ADR-056 Phase 3: Base Typography 초기 동기화
import { useThemeConfigStore } from "../../stores/themeConfigStore";
import { normalizeExternalFillIngressBatch } from "../panels/styles/utils/fillExternalIngress";
import {
  editorPresentationFillPilotRuntime,
  editorPresentationFillPreviewBridge,
} from "../presentation/editorPresentationFillPilot";
import type { EditorPresentationPreviewTransport } from "../presentation/editorPresentationPreviewBridge";

export type IframeReadyState =
  "not_initialized" | "loading" | "ready" | "error";

function getActiveCanonicalDocumentForPreviewRead(): CompositionDocument | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;
  return canonical.getDocument(projectId) ?? null;
}

function getElementForPreviewSelection(elementId: string): Element | null {
  const doc = getActiveCanonicalDocumentForPreviewRead();
  if (doc) {
    return getActiveCanonicalElementById(elementId);
  }

  const { elements: legacyElements } = useStore.getState();
  return legacyElements.find((element) => element.id === elementId) ?? null;
}

function filterNewPreviewGeneratedElements(elements: Element[]): Element[] {
  const doc = getActiveCanonicalDocumentForPreviewRead();
  if (doc) {
    const existingElementIds = getCanonicalDocumentProjectableNodeIds(doc);
    return elements.filter((element) => !existingElementIds.has(element.id));
  }

  const { elements: legacyElements } = useStore.getState();
  const legacyElementIds = new Set(legacyElements.map((element) => element.id));
  return elements.filter((element) => !legacyElementIds.has(element.id));
}

export interface UseIframeMessengerReturn {
  iframeReadyState: IframeReadyState;
  handleIframeLoad: () => void;
  handleMessage: (event: MessageEvent) => void;
  handleUndo: DebouncedFunc<() => Promise<void>>;
  handleRedo: DebouncedFunc<() => Promise<void>>;
  sendElementSelectedMessage: (elementId: string, props?: ElementProps) => void;
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

function readCurrentCanonicalDocumentSnapshot(): {
  document: CompositionDocument | null;
  projectId: string | null;
  revision: number;
} {
  const state = useCanonicalDocumentStore.getState();
  const projectId = state.currentProjectId;
  return {
    document: projectId ? (state.documents.get(projectId) ?? null) : null,
    projectId,
    revision: state.documentVersion,
  };
}

export const useIframeMessenger = (): UseIframeMessengerReturn => {
  // 🚀 Phase 11: WebGL-only 모드에서는 iframe 통신 완전 스킵
  // - isWebGLCanvas(): WebGL 캔버스 활성화 여부 (빌드타임 상수)
  // - isCanvasCompareMode(): 비교 모드 (빌드타임 상수)
  // - runtimeCompareMode: toolbar compare toggle
  // - WebGL only = WebGL 활성화 && build/runtime 비교 모드 아님
  // ⚠️ React Hook 규칙: 모든 Hook은 조건문 전에 호출해야 함
  const runtimeCompareMode = useCompareModeStore(
    (state) => state.isCompareMode,
  );
  const isWebGLOnly =
    isWebGLCanvas() && !isCanvasCompareMode() && !runtimeCompareMode;

  // ⚠️ Hook 호출은 항상 동일한 순서로 실행 (조건부 early return 금지)
  const [iframeReadyState, setIframeReadyState] =
    useState<IframeReadyState>("not_initialized");
  const iframeReadyStateRef = useRef<IframeReadyState>("not_initialized"); // 🔧 Ref로 즉시 상태 변경
  const messageQueueRef = useRef<Array<{ type: string; payload: unknown }>>([]);
  const previewGeneratedElementsRef = useRef<Map<string, Element>>(new Map());
  const previewGeneratedElementsFlushIdRef = useRef<number | null>(null);
  const ownsIframeTransportRef = useRef(false);
  const previewTransportRef = useRef<EditorPresentationPreviewTransport | null>(
    null,
  );
  const lastSentCanonicalEnvelopeRef = useRef<{
    projectId: string | null;
    revision: number;
  } | null>(null);

  const activeCanonicalDocument = useActiveCanonicalDocument();
  const currentPageId = useStore((state) => state.currentPageId);
  const pages = useStore((state) => state.pages);
  const currentEditMode = useEditModeStore((state) => state.mode);

  // ⭐ Nested Routes & Slug System: canonical reusable frame surface 구독
  const layouts = useCanonicalReusableFrameLayouts();
  const selectedReusableFrameId = useSelectedReusableFrameId();

  // ⭐ DataTables 구독 (PropertyDataBinding용)
  const collections = useCollections();

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

    // (ADR-128) cloud `elements` row persistence 제거. canonical document
    // mutation 만으로 IndexedDB persistence 흐름 완결.
    // history 미기록 (ADR-185 의도적 생략) — preview 런타임 생성물의 ingress
    // 로, builder 사용자 편집이 아니라 undo 단위를 만들지 않는다.
    mergeElementsCanonicalPrimary(queuedElements);
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

  const sendCanonicalDocumentToIframe = useCallback(
    (
      document: CompositionDocument | null,
      envelope?: { projectId: string | null; revision: number },
    ) => {
      const canonicalState = useCanonicalDocumentStore.getState();
      const projectId = envelope?.projectId ?? canonicalState.currentProjectId;
      const documentRevision =
        envelope?.revision ?? canonicalState.documentVersion;
      const lastEnvelope = lastSentCanonicalEnvelopeRef.current;
      if (
        lastEnvelope?.projectId === projectId &&
        lastEnvelope.revision >= documentRevision
      ) {
        return;
      }
      const iframe = MessageService.getIframe();
      const currentReadyState = iframeReadyStateRef.current;
      const message = {
        type: "UPDATE_CANONICAL_DOCUMENT" as const,
        projectId,
        documentRevision,
        document,
      };
      lastSentCanonicalEnvelopeRef.current = {
        projectId,
        revision: documentRevision,
      };
      recordEditorPresentationPreviewFullDocumentMessage(message);

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

  const sendEditorPresentationMessage = useCallback(
    (message: Parameters<EditorPresentationPreviewTransport["send"]>[0]) => {
      const iframe = MessageService.getIframe();
      if (iframeReadyStateRef.current !== "ready" || !iframe?.contentWindow) {
        messageQueueRef.current.push({ type: message.type, payload: message });
        return;
      }
      iframe.contentWindow.postMessage(message, window.location.origin);
    },
    [],
  );

  const ensureCanonicalDocumentSent = useCallback(
    (projectId: string, revision: number) => {
      const canonicalState = useCanonicalDocumentStore.getState();
      if (
        canonicalState.currentProjectId !== projectId ||
        canonicalState.documentVersion < revision
      ) {
        return;
      }
      sendCanonicalDocumentToIframe(
        canonicalState.documents.get(projectId) ?? null,
        { projectId, revision: canonicalState.documentVersion },
      );
    },
    [sendCanonicalDocumentToIframe],
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

    // 현재 collections 가져오기
    const currentDataTables = collections;

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
      collections: runtimeDataTables,
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
  }, [collections]); // collections 변경 시 갱신

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

      const element = getElementForPreviewSelection(elementId);
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
    [],
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
      if (item.type === "ELEMENT_SELECTED") {
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
      } else if (item.type.startsWith("EDITOR_PRESENTATION_")) {
        iframe.contentWindow!.postMessage(item.payload, window.location.origin);
      }
    });
  }, []); // ✅ 의존성 제거 (Ref 사용)

  const handleIframeLoad = useCallback(() => {
    // Preview App은 React effect에서 PREVIEW_READY를 iframe load 이벤트보다
    // 먼저 보낼 수 있다. 이 순서를 loading으로 되돌리면 ready handler가
    // 이미 비운 queue를 다시 기다리게 되어 canonical document가 영원히
    // Preview에 도착하지 않는다.
    const hadPreviewReady = iframeReadyStateRef.current === "ready";
    editorPresentationFillPreviewBridge.attachTransport(null);
    const canonicalSnapshot = readCurrentCanonicalDocumentSnapshot();
    if (canonicalSnapshot.projectId) {
      editorPresentationFillPilotRuntime.cancelProjectSessions(
        canonicalSnapshot.projectId,
        "iframe-reload",
      );
    }
    messageQueueRef.current = [];
    lastSentCanonicalEnvelopeRef.current = null;
    ownsIframeTransportRef.current = true;

    // 🔧 FIX: Ref도 업데이트
    iframeReadyStateRef.current = hadPreviewReady ? "ready" : "loading";
    setIframeReadyState(hadPreviewReady ? "ready" : "loading");

    // 새 ready generation은 반드시 canonical envelope가 첫 메시지다.
    sendCanonicalDocumentToIframe(canonicalSnapshot.document, {
      projectId: canonicalSnapshot.projectId,
      revision: canonicalSnapshot.revision,
    });
    const transport: EditorPresentationPreviewTransport = {
      ensureCanonicalDocumentSent,
      send: sendEditorPresentationMessage,
    };
    previewTransportRef.current = transport;
    editorPresentationFillPreviewBridge.attachTransport(transport);

    // 🔧 FIX: 요소 전송은 PREVIEW_READY 핸들러에서 처리
    // (여기서는 DOM 로드만 확인하고, Preview의 React 앱 마운트를 기다림)
  }, [
    ensureCanonicalDocumentSent,
    sendCanonicalDocumentToIframe,
    sendEditorPresentationMessage,
  ]);

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

        const iframe = MessageService.getIframe();

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

          // PREVIEW_READY 는 canonical hydration보다 먼저 도착할 수 있다.
          // render closure의 이전 null snapshot을 재사용하지 말고 현재 store를
          // 읽어 같은 ready generation 안에서 최신 문서를 한 번 더 보낸다.
          const canonicalSnapshot = readCurrentCanonicalDocumentSnapshot();
          sendCanonicalDocumentToIframe(canonicalSnapshot.document, {
            projectId: canonicalSnapshot.projectId,
            revision: canonicalSnapshot.revision,
          });

          // ⭐ DataTables 전송 (PropertyDataBinding용)
          sendDataTablesToIframe();

          // ⭐ ApiEndpoints 전송 (PropertyDataBinding용)
          sendApiEndpointsToIframe();

          // ⭐ Variables 전송 (PropertyDataBinding용)
          sendVariablesToIframe();

          // **ADR-125 Phase 4** — `!canonicalDoc` legacy bootstrap fallback 제거됨.
          // Preview active channel 은 UPDATE_CANONICAL_DOCUMENT 단일.
          // canonical document 부재 시 Preview 는 빈 상태 유지 (BuilderCore mount
          // → canonical hydration → Preview 첫 frame 흐름 deterministic).
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

      // Preview에서 Column Elements 일괄 추가 요청
      if (
        event.data.type === "ADD_COLUMN_ELEMENTS" &&
        event.data.payload?.columns
      ) {
        const newColumns = event.data.payload.columns;
        const columnsToAdd = filterNewPreviewGeneratedElements(newColumns);

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
        const newFields = event.data.payload.fields;
        const fieldsToAdd = filterNewPreviewGeneratedElements(newFields);

        if (fieldsToAdd.length === 0) {
          return;
        }

        enqueuePreviewGeneratedElements(fieldsToAdd);
        return;
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

      // Preview 상호작용 → builder store 역전파 (2026-07-14).
      //   Preview 의 updateElementProps 는 Preview runtime store 전용이라 builder store
      //   (= Skia 렌더 source) 로 올라가지 않는다 → Preview 에서 Disclosure header 를 클릭해
      //   접어도 Skia 는 펼친 채 남아 CSS↔Skia 발산했다. Preview 가 문서 prop(allowlist:
      //   isExpanded 등) 변경 시 본 메시지를 보내고, builder store 를 갱신해 Skia 를 동기화한다.
      //   updateElementProps 가 layoutVersion / dirty / canonical sync / persist 를 모두 처리.
      if (
        event.data.type === "ELEMENT_PROPS_CHANGED" &&
        event.data.elementId &&
        event.data.payload?.props
      ) {
        const { elementId, payload } = event.data;
        startTransition(() => {
          void useStore.getState().updateElementProps(elementId, payload.props);
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
        const element = getElementForPreviewSelection(event.data.elementId);
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
      processMessageQueue,
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
      if (ownsIframeTransportRef.current) {
        editorPresentationFillPreviewBridge.attachTransport(null);
        previewTransportRef.current = null;
        ownsIframeTransportRef.current = false;
      }
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

  // hidden 탭에서도 동작하는 스케줄러 사용 (rAF 는 background 탭 미동작 → preview 정체).
  // 취소는 스케줄러 종류 무관 cancel 함수로 수행하므로 numeric frame id 대신 cancel 을 보관.
  const pendingCanonicalDocumentCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isWebGLOnly || !ownsIframeTransportRef.current) return;

    pendingCanonicalDocumentCancelRef.current?.();

    pendingCanonicalDocumentCancelRef.current = scheduleFrameOrTimeout(() => {
      pendingCanonicalDocumentCancelRef.current = null;
      sendCanonicalDocumentToIframe(activeCanonicalDocument);
    });

    return () => {
      pendingCanonicalDocumentCancelRef.current?.();
      pendingCanonicalDocumentCancelRef.current = null;
    };
  }, [
    activeCanonicalDocument,
    iframeReadyState,
    isWebGLOnly,
    sendCanonicalDocumentToIframe,
  ]);

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
      collections.map((dt) => ({
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
  }, [collections, sendDataTablesToIframe]);

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
  // 🚀 Phase 11: WebGL-only 모드에서는 no-op 반환
  // Hook은 항상 호출되지만, 실제 작업은 스킵됨
  if (isWebGLOnly) {
    return {
      iframeReadyState: "not_initialized",
      handleIframeLoad: () => {},
      handleMessage: () => {},
      handleUndo: noopDebouncedAsync,
      handleRedo: noopDebouncedAsync,
      sendElementSelectedMessage: () => {},
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
    sendElementSelectedMessage,
    sendLayoutsToIframe,
    sendPagesToIframe,
    sendDataTablesToIframe,
    sendApiEndpointsToIframe,
    sendVariablesToIframe,
    isIframeReady,
  };
};
