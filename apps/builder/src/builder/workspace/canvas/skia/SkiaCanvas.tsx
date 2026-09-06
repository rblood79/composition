/**
 * SkiaCanvas — 독립 Skia 렌더러 (ADR-100 Phase 2.6)
 *
 * 단독 CanvasKit 캔버스 컴포넌트.
 * - 자체 requestAnimationFrame 루프
 * - Camera 클래스로 viewport 제어
 * - 기존 빌드 파이프라인(buildSkiaFrameContent, buildFrameRenderPlan) 재사용
 * SkiaOverlay와 동일한 렌더링 결과를 산출하되,
 * 별도 scene graph와 renderer ticker에 의존하지 않는다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { SkiaRenderer } from "./SkiaRenderer";
import { getRegistryVersion, notifyLayoutChange } from "./useSkiaNode";
import { isCanvasKitInitialized, getCanvasKit } from "./initCanvasKit";
import { initAllWasm } from "../wasm-bindings/init";
import { skiaFontManager } from "./fontManager";
import {
  loadBuiltinFontsToSkia,
  loadAllCustomFontsToSkia,
  syncCustomFontsWithSkia,
} from "../../../fonts/loadCustomFontsToSkia";
import { registerImageLoadCallback } from "./imageCache";
import {
  countFrameEvent,
  frameCaptureEnabled,
  recordReadinessPresentation,
} from "./frameCapture";
import { destroyAllSkiaCaches } from "./disposable";
import {
  createOverlayInvalidationPacket,
  type RendererInvalidationPacket,
  type RendererSceneInvalidation,
  type SkiaRendererInput,
} from "../renderers";
import type { DropIndicatorSnapshot } from "../selection/dropTargetResolver";
import { recordInvalidation } from "./renderInvalidation";
import { setupThemeWatcher } from "./themeWatcher";
import {
  setPagePosStaleFrames,
  tickPagePosStaleFrames,
} from "./skiaTreeBuilder";
import { tickAnimations, getInterpolatedOffsets } from "./dragAnimator";
import {
  getDragSiblingOffsetRevision,
  getDragVisualOffset,
  getDragVisualOffsetRevision,
  setDragSiblingOffsets,
} from "./nodeRendererTree";
import { buildSkiaFrameContent } from "./skiaFramePipeline";
import { FrameContentCache } from "./frameContentCache";
import {
  invalidateCommandStreamCache,
  markCachedCommandStreamPatched,
} from "./renderCommands";
import { type PageFrame } from "./workflowRenderer";
import { type CachedEdgeGeometry } from "./workflowHitTest";
import {
  useWorkflowInteraction,
  type WorkflowHoverState,
} from "../hooks/useWorkflowInteraction";
import {
  useElementHoverInteraction,
  type ElementHoverState,
} from "../hooks/useElementHoverInteraction";
import { useScrollWheelInteraction } from "../hooks/useScrollWheelInteraction";
import { DEFAULT_MINIMAP_CONFIG, type MinimapConfig } from "./workflowMinimap";
import type { BoundingBox } from "../selection/types";
import { watchContextLoss } from "./createSurface";
import { flushWasmMetrics, recordWasmMetric } from "../utils/gpuProfilerCore";
import {
  createFrameInputSnapshot,
  buildFrameRenderPlan,
} from "./skiaFramePlan";
import { viewportState as mutableViewport } from "../viewport/viewportState";
import { StoreRenderBridge } from "./StoreRenderBridge";
import {
  computePresentationLayoutTargeted,
  getSharedLayoutMap,
  getSharedLayoutVersion,
} from "../layout/engines/fullTreeLayout";
import { useCanvasLifecycleStore } from "../stores";
import { useStore } from "../../../stores";
import { useAIVisualFeedbackStore } from "../../../stores/aiVisualFeedback";
import { observe, PERF_LABEL } from "../../../utils/perfMarks";
import type { CanvasGestureSession } from "../interaction/canvasGestureSession";
import {
  useThemeConfigStore,
  resolveSkiaTheme,
} from "../../../../stores/themeConfigStore";
import {
  getPagePositionPresentationSnapshot,
  subscribePagePositionPresentation,
} from "../interaction/pagePositionPresentation";
import { publishCanvasFramePresentation } from "../canvasFramePresentation";
import {
  getPageGuideRevision,
  subscribePageGuideRevision,
} from "../interaction/pageGuideRevision";
import { SkiaEditorPresentationBridge } from "../../../presentation/skiaEditorPresentationBridge";
import { SkiaEditorPresentationLayoutBridge } from "../../../presentation/skiaEditorPresentationLayoutBridge";
import { editorPresentationFillPilotRuntime } from "../../../presentation/editorPresentationFillPilot";
import { setStoreCommitDescriptorSink } from "../../../presentation/storeCommitDescriptorSink";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";

// Dev profiler — window.__composition_PROFILER 노출 (side-effect import)
import "../benchmarks/devProfiler";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkiaCanvasProps {
  /** 부모 컨테이너 DOM 요소 */
  containerEl: HTMLDivElement;
  /** Canvas pointer session 제스처 소유권 */
  gestureSession: CanvasGestureSession;
  /** Layout 무효화 콜백 */
  invalidateLayout: () => void;
  /**
   * ADR-074 Phase 4: scene sub-packet 만 BuilderCanvas 에서 주입.
   * overlay packet (ai + selection) 은 SkiaCanvas 내부에서
   * useStore 로 직접 구독하여 생성 — BuilderCanvas 루트 selection 구독 제거.
   */
  sceneInvalidationPacket: RendererSceneInvalidation;
  /** 렌더러 입력 (store 스냅샷) */
  rendererInput: SkiaRendererInput;
  /** 드롭 인디케이터 스냅샷 ref */
  dropIndicatorSnapshotRef?: React.MutableRefObject<DropIndicatorSnapshot | null>;
  /**
   * 페이지 타이틀 drag hit-test scene bounds 누적 맵.
   * BuilderCanvas pointerdown 핸들러가 이 ref 로 scene 좌표 → pageId 조회.
   * 매 프레임 renderSkia 에서 clear + populate 된다.
   */
  pageTitleBoundsMapRef?: React.MutableRefObject<
    Map<string, import("./skiaOverlayHelpers").PageTitleBounds>
  >;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Skia 단독 렌더러.
 *
 * 단독 CanvasKit 경로로 동작:
 * - z-index: 2 — CanvasKit 캔버스 (디자인 + 오버레이)
 * - 자체 RAF 루프
 * - Camera 클래스로 viewport 상태 관리
 * - Command Stream 경로 전용 (sharedLayoutMap 필수)
 */
export function SkiaCanvas({
  containerEl,
  gestureSession,
  invalidateLayout,
  sceneInvalidationPacket,
  rendererInput,
  dropIndicatorSnapshotRef,
  pageTitleBoundsMapRef,
}: SkiaCanvasProps) {
  // ADR-074 Phase 4: overlay sub-packet 을 SkiaCanvas 내부에서 자체 구독/생성.
  // BuilderCanvas 루트의 selection/editing/ai 구독을 제거하여 루트 리렌더
  // fan-out 을 차단. 합성 invalidationPacket 은 기존 ref/render 로직과 호환.
  const currentPageId = useStore((state) => state.currentPageId);
  useEffect(() => {
    if (!frameCaptureEnabled) return;
    return useCanonicalDocumentStore.subscribe((state, previous) => {
      if (state.documentVersion !== previous.documentVersion)
        countFrameEvent("domainPublication");
    });
  }, []);
  const selectedElementId = useStore((state) => state.selectedElementId);
  const selectedElementIds = useStore((state) => state.selectedElementIds);
  const editingContextId = useStore((state) => state.editingContextId);
  const aiFlashAnimations = useAIVisualFeedbackStore(
    (state) => state.flashAnimations,
  );
  const aiGeneratingNodes = useAIVisualFeedbackStore(
    (state) => state.generatingNodes,
  );
  const cleanupExpiredFlashes = useAIVisualFeedbackStore(
    (state) => state.cleanupExpiredFlashes,
  );

  const overlayInvalidationPacket = useMemo(() => {
    return createOverlayInvalidationPacket({
      ai: {
        cleanupExpiredFlashes,
        flashAnimations: aiFlashAnimations,
        generatingNodes: aiGeneratingNodes,
      },
      selection: {
        currentPageId,
        editingContextId,
        selectedElementId,
        selectedElementIds,
      },
    });
  }, [
    aiFlashAnimations,
    aiGeneratingNodes,
    cleanupExpiredFlashes,
    currentPageId,
    editingContextId,
    selectedElementId,
    selectedElementIds,
  ]);

  const invalidationPacket = useMemo<RendererInvalidationPacket>(() => {
    return {
      ...sceneInvalidationPacket,
      ...overlayInvalidationPacket,
    };
  }, [sceneInvalidationPacket, overlayInvalidationPacket]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SkiaRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const contextLostRef = useRef(false);
  const presentationTarget = useCanvasLifecycleStore(
    (state) => state.presentationTarget,
  );
  const presentationTargetRef = useRef(presentationTarget);

  // Phase 6: Selection/AI 상태 변경 감지용 ref
  const overlayVersionRef = useRef(0);
  const lastSelectionSignatureRef = useRef("");
  const lastAIActiveRef = useRef(0);
  const allPageFramesRef = useRef(
    rendererInput.sceneSnapshot.document.allPageFrames,
  );
  const visiblePageFramesRef = useRef(
    rendererInput.sceneSnapshot.document.visiblePageFrames,
  );
  const frameAreasRef = useRef(rendererInput.frameAreas);
  const documentPageFrameVersionRef = useRef(
    rendererInput.sceneSnapshot.document.allPageFrameVersion,
  );
  const lastVisibleContentVersionRef = useRef(
    rendererInput.sceneSnapshot.document.visibleContentVersion,
  );
  const lastVisiblePagePositionVersionRef = useRef(
    rendererInput.sceneSnapshot.document.visiblePagePositionVersion,
  );
  const pagePositionPresentationVersionRef = useRef(
    getPagePositionPresentationSnapshot().version,
  );
  const pageGuideRevisionRef = useRef(getPageGuideRevision());
  const dragVisualOffsetRevisionRef = useRef(getDragVisualOffsetRevision());
  const dragSiblingOffsetRevisionRef = useRef(getDragSiblingOffsetRevision());

  // Workflow/hover 캐시
  const invalidationPacketRef = useRef(invalidationPacket);
  const rendererInputRef = useRef(rendererInput);
  const storeRenderBridgeRef = useRef<StoreRenderBridge | null>(null);
  const editorPresentationBridgeRef =
    useRef<SkiaEditorPresentationBridge | null>(null);
  const editorPresentationLayoutBridgeRef =
    useRef<SkiaEditorPresentationLayoutBridge | null>(null);
  const lastWorkflowOverlaySignatureRef = useRef("");
  const lastWorkflowGraphSignatureRef = useRef("");
  const lastWfSubTogglesRef = useRef("");

  // 호버 상태
  const elementHoverStateRef = useRef<ElementHoverState>({
    hoveredElementId: null,
    hoveredLeafIds: [],
    isGroupHover: false,
  });
  const lastEditingContextRef = useRef<string | null>(null);
  /**
   * 포인터 판정용 히트 영역 (조상 clip rect 교차 완료).
   * 호버/휠 스크롤 타깃은 화면에 실제로 그려진 영역만 잡아야 하므로
   * 원본 박스(treeBoundsMap)가 아니라 hitBoundsMap 을 쓴다.
   */
  const hitBoundsMapRef = useRef<Map<string, BoundingBox>>(new Map());

  // Workflow
  const workflowHoverStateRef = useRef<WorkflowHoverState>({
    hoveredEdgeId: null,
  });
  const edgeGeometryCacheRef = useRef<CachedEdgeGeometry[]>([]);
  const edgeGeometryCacheKeyRef = useRef("");
  const pageFrameMapRef = useRef<Map<string, PageFrame>>(new Map());
  const lastHoveredEdgeRef = useRef<string | null>(null);
  const lastFocusedPageRef = useRef<string | null>(null);
  // StoreRenderBridge의 subtree patch가 전달한 damage는 같은 canonical
  // document revision의 visibleContentVersion 감지에서 full invalidation으로
  // 승격되면 안 된다. revision이 바뀐 unrelated 변경은 fail-closed 한다.
  const pendingDamageRevisionRef = useRef<number | null>(null);

  // Minimap
  const minimapConfigRef = useRef<MinimapConfig>(DEFAULT_MINIMAP_CONFIG);
  const minimapVisibleRef = useRef(false);
  const minimapFadeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastMinimapCameraRef = useRef({ x: 0, y: 0, zoom: 1 });

  // Dev metrics
  const devRegistryWindowStartMs = useRef(0);
  const devRegistryWindowStartVersion = useRef(0);

  // ---------- Ref 갱신 ----------

  useEffect(() => {
    allPageFramesRef.current =
      rendererInput.sceneSnapshot.document.allPageFrames;
    visiblePageFramesRef.current =
      rendererInput.sceneSnapshot.document.visiblePageFrames;
    frameAreasRef.current = rendererInput.frameAreas;
    rendererInputRef.current = rendererInput;
    documentPageFrameVersionRef.current =
      rendererInput.sceneSnapshot.document.allPageFrameVersion;
    const syncResult = storeRenderBridgeRef.current?.sync(
      rendererInput.renderNodesMap,
      getSharedLayoutMap(),
      resolveSkiaTheme(useThemeConfigStore.getState().darkMode),
      rendererInput.childrenMap,
      rendererInput.projectionVersion,
      true,
      getSharedLayoutVersion(),
    ) ?? { commandStreamPatched: false, commandStreamInvalidated: true };
    // StoreRenderBridge가 pending canonical commit을 현재 cached stream에 먼저
    // splice할 수 있도록 cache invalidation은 sync 이후에 수행한다. patch 실패 시
    // bridge가 full rebuild를 완료하고 여기서 일반 cache miss를 강제한다.
    if (syncResult.commandStreamPatched) {
      markCachedCommandStreamPatched({
        registryVersion: getRegistryVersion(),
        pagePosVersion:
          rendererInput.sceneSnapshot.document.visiblePagePositionVersion,
        framePosVersion: rendererInput.framePositionsVersion,
        layoutVersion: getSharedLayoutVersion(),
      });
      pendingDamageRevisionRef.current =
        syncResult.damageRevision ?? rendererInput.documentRevision;
    } else if (syncResult.commandStreamInvalidated) {
      invalidateCommandStreamCache();
      pendingDamageRevisionRef.current = null;
    }
    editorPresentationBridgeRef.current?.handleStoreSync(
      rendererInput.documentRevision,
    );
    editorPresentationLayoutBridgeRef.current?.handleStoreSync(
      rendererInput.documentRevision,
    );
    // 이 effect는 bridge.sync()를 직접 호출하므로 onDidSync callback을
    // 거치지 않는다. presentation handoff가 paint invalidation을 덧씌울 수
    // 있으므로 두 handoff 이후 마지막에 G3 damage를 renderer에 전달한다.
    if (syncResult.commandStreamPatched) {
      pendingDamageRevisionRef.current =
        syncResult.damageRevision ?? rendererInputRef.current.documentRevision;
      rendererRef.current?.invalidateContent(syncResult.damageBounds);
    } else if (syncResult.commandStreamInvalidated) {
      pendingDamageRevisionRef.current = null;
      rendererRef.current?.invalidateContent();
    }
    recordInvalidation("content", "rendererInput");
  }, [rendererInput]);

  useEffect(() => {
    invalidationPacketRef.current = invalidationPacket;
  }, [invalidationPacket]);

  // Page drag는 canonical pagePositions를 pointerup에서만 갱신한다. 따라서
  // presentation snapshot 변경은 content surface cache를 직접 무효화해야 다음
  // frame에서 transient page root transform과 selection/title overlay가 함께 그려진다.
  useEffect(() => {
    return subscribePagePositionPresentation(() => {
      const nextVersion = getPagePositionPresentationSnapshot().version;
      if (nextVersion === pagePositionPresentationVersionRef.current) {
        return;
      }

      pagePositionPresentationVersionRef.current = nextVersion;
      rendererRef.current?.invalidateContent();
      overlayVersionRef.current++;
      recordInvalidation("content", "pagePositionPresentation");
    });
  }, []);

  // ADR-181 C11 — 수동 가이드는 오버레이 패스 전용이라 overlay 만 무효화한다.
  // 위 page position 과 달리 `invalidateContent()` 를 부르지 않는다: page root
  // transform 이 바뀌는 축이 아니라 본문 렌더가 그대로다 (더 싼 경로, HC1).
  useEffect(() => {
    return subscribePageGuideRevision(() => {
      const nextRevision = getPageGuideRevision();
      if (nextRevision === pageGuideRevisionRef.current) return;
      pageGuideRevisionRef.current = nextRevision;
      overlayVersionRef.current++;
      recordInvalidation("overlay", "pageGuideRevision");
    });
  }, []);

  // ---------- StoreRenderBridge (Phase 6) ----------
  // store 데이터에서 직접 skiaNodeRegistry 를 채운다 (항상 이 경로).
  //   이 effect는 조건 분기 없이 무조건 실행된다.

  useEffect(() => {
    const bridge = new StoreRenderBridge();
    storeRenderBridgeRef.current = bridge;
    bridge.connect({
      getElements: () => rendererInputRef.current.renderNodesMap,
      getLayoutMap: () => getSharedLayoutMap(),
      getChildrenMap: () => rendererInputRef.current.childrenMap,
      getProjectionVersion: () => rendererInputRef.current.projectionVersion,
      getCanonicalRevision: () => getSharedLayoutVersion(),
      // rendererInput 변경은 위 effect 에서 직접 bridge.sync 를 호출한다.
      // 이 subscription 은 theme-only invalidation boundary 로 제한한다.
      subscribe: (cb) => {
        let prevThemeVersion = useThemeConfigStore.getState().themeVersion;
        const unsubTheme = useThemeConfigStore.subscribe(() => {
          const { themeVersion } = useThemeConfigStore.getState();
          if (themeVersion !== prevThemeVersion) {
            prevThemeVersion = themeVersion;
            cb();
            // ADR-902 후속: clearFrame 투명화 후 page body fill 이 element-tree 로만 노출된다.
            // contentSnapshot/blit 캐시 경로에 이전 프레임 색이 남아있을 가능성을 차단하기 위해
            // 다음 frame 을 "full" classifyFrame 으로 강제해 content surface 를 재페인트한다.
            rendererRef.current?.invalidateContent();
          }
        });
        return () => {
          unsubTheme();
        };
      },
      // themeConfigStore에서 매 sync마다 동적으로 읽기
      getTheme: () => resolveSkiaTheme(useThemeConfigStore.getState().darkMode),
      onDidSync: (syncResult) => {
        if (syncResult.commandStreamPatched) {
          markCachedCommandStreamPatched({
            registryVersion: getRegistryVersion(),
            pagePosVersion:
              rendererInputRef.current.sceneSnapshot.document
                .visiblePagePositionVersion,
            framePosVersion: rendererInputRef.current.framePositionsVersion,
            layoutVersion: getSharedLayoutVersion(),
          });
        } else if (syncResult.commandStreamInvalidated) {
          invalidateCommandStreamCache();
        }
        editorPresentationBridgeRef.current?.handleStoreSync(
          rendererInputRef.current.documentRevision,
        );
        editorPresentationLayoutBridgeRef.current?.handleStoreSync(
          rendererInputRef.current.documentRevision,
        );
        // G3: commit subtree patch가 계산한 이전/이후 hit bounds 합집합만
        // content damage로 전달한다. presentation handoff가 paint invalidation을
        // 덧씌울 수 있으므로 두 handoff 이후 마지막에 renderer를 무효화한다.
        if (syncResult.commandStreamPatched) {
          pendingDamageRevisionRef.current =
            syncResult.damageRevision ??
            rendererInputRef.current.documentRevision;
          rendererRef.current?.invalidateContent(syncResult.damageBounds);
        } else if (syncResult.commandStreamInvalidated) {
          pendingDamageRevisionRef.current = null;
          rendererRef.current?.invalidateContent();
        }
      },
    });
    const presentationBridge = new SkiaEditorPresentationBridge({
      getActiveProjectId: () =>
        useCanonicalDocumentStore.getState().currentProjectId,
      getProjectionIndex: () =>
        rendererInputRef.current.presentationProjectionIndex,
      getStoreRenderBridge: () => storeRenderBridgeRef.current,
      onPaintInvalidated: () => {
        rendererRef.current?.invalidateContent();
        recordInvalidation("content", "editorPresentation");
      },
      onCommitted: ({ descriptor, revision }) => {
        storeRenderBridgeRef.current?.queueCommitPatch([descriptor], revision);
      },
      runtime: editorPresentationFillPilotRuntime,
    });
    editorPresentationBridgeRef.current = presentationBridge;
    // ADR-190: presentation session 을 거치지 않는 generic canonical commit
    // (Properties 패널 / 캔버스 텍스트 / AI tool / preview ingress) 도 같은
    // commit lane 으로 보낸다. presentation adapter 는 store action 이 아니라
    // useStore.setState 직접 경로라 두 생산자가 겹치지 않는다 (ADR-190 Phase 0).
    setStoreCommitDescriptorSink((descriptors, revision) => {
      storeRenderBridgeRef.current?.queueCommitPatch(descriptors, revision);
    });
    const presentationLayoutBridge = new SkiaEditorPresentationLayoutBridge({
      getActiveProjectId: () =>
        useCanonicalDocumentStore.getState().currentProjectId,
      getCanonicalRevision: () => getSharedLayoutVersion(),
      getChildrenMap: () => rendererInputRef.current.childrenMap,
      getLayoutMap: () => getSharedLayoutMap(),
      getRenderNode: (nodeId) =>
        rendererInputRef.current.renderNodesMap.get(nodeId),
      computeTargetedLayout: computePresentationLayoutTargeted,
      onPatched: (stream) => {
        hitBoundsMapRef.current = stream.hitBoundsMap;
        rendererRef.current?.invalidateContent();
        recordInvalidation("content", "editorPresentationLayout");
      },
      runtime: editorPresentationFillPilotRuntime,
    });
    editorPresentationLayoutBridgeRef.current = presentationLayoutBridge;

    return () => {
      setStoreCommitDescriptorSink(null);
      if (editorPresentationBridgeRef.current === presentationBridge) {
        editorPresentationBridgeRef.current = null;
      }
      presentationBridge.dispose();
      if (
        editorPresentationLayoutBridgeRef.current === presentationLayoutBridge
      ) {
        editorPresentationLayoutBridgeRef.current = null;
      }
      presentationLayoutBridge.dispose();
      if (storeRenderBridgeRef.current === bridge) {
        storeRenderBridgeRef.current = null;
      }
      bridge.dispose();
    };
  }, []);

  // Camera ↔ viewport 동기화는 viewportState 뮤터블 ref로 대체 (Phase 5.4)
  // ViewportController.notifyUpdateListeners()가 viewportState를 동기 갱신
  // SkiaCanvas RAF에서 mutableViewport.x/y/zoom으로 직접 읽기

  // ---------- 인터랙션 훅 ----------

  useWorkflowInteraction({
    containerEl,
    gestureSession,
    edgeGeometryCacheRef,
    pageFrameMapRef,
    hoverStateRef: workflowHoverStateRef,
    overlayVersionRef,
    minimapConfigRef,
  });

  useElementHoverInteraction({
    containerEl,
    gestureSession,
    frameAreasRef,
    pageFramesRef: visiblePageFramesRef,
    getHoverElementsMap: () => rendererInputRef.current.interactionNodesMap,
    getHoverChildrenMap: () => rendererInputRef.current.interactionChildrenMap,
    hoverStateRef: elementHoverStateRef,
    overlayVersionRef,
    hitBoundsMapRef,
  });

  useScrollWheelInteraction({
    containerEl,
    getScrollElementsMap: () => rendererInputRef.current.interactionNodesMap,
    hitBoundsMapRef,
  });

  // ---------- WASM + Font 초기화 ----------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        useCanvasLifecycleStore.getState().setBootstrapPhase("wasm");
        await initAllWasm();
        if (cancelled) return;

        getCanvasKit(); // CanvasKit 초기화 확인
        useCanvasLifecycleStore.getState().setBootstrapPhase("fonts");
        // 기본 폰트 로딩 (빌트인 Variable → 커스텀)
        await loadBuiltinFontsToSkia();
        await loadAllCustomFontsToSkia();
        if (!cancelled) {
          useCanvasLifecycleStore.getState().setBootstrapPhase("surface");
          setReady(true);
        }
      } catch (e) {
        console.error("[SkiaCanvas] WASM/Font 초기화 실패:", e);
        if (!cancelled) {
          useCanvasLifecycleStore.getState().failCanvasBootstrap();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 프로젝트 hydration이 완료되면 matching revision의 실제 surface flush를
  // 새 bootstrap target으로 기다린다. renderer가 이미 idle 상태여도 target
  // 설정 직후 한 프레임을 강제로 제출해 이전 프로젝트/이전 revision의 화면을
  // 준비 완료로 오인하지 않는다.
  useEffect(() => {
    presentationTargetRef.current = presentationTarget;
    if (presentationTarget) {
      rendererRef.current?.invalidateContent();
    }
  }, [presentationTarget]);

  // 동적 폰트 동기화
  useEffect(() => {
    if (!ready) return;

    const handleCustomFontsUpdated = async () => {
      try {
        await syncCustomFontsWithSkia();
        notifyLayoutChange();
        invalidateLayout();
        window.dispatchEvent(new CustomEvent("composition:fonts-ready"));
      } catch (e) {
        console.warn("[SkiaCanvas] 동적 커스텀 폰트 동기화 실패:", e);
      }
    };

    window.addEventListener(
      "composition:custom-fonts-updated",
      handleCustomFontsUpdated,
    );
    return () => {
      window.removeEventListener(
        "composition:custom-fonts-updated",
        handleCustomFontsUpdated,
      );
    };
  }, [ready, invalidateLayout]);

  // ---------- Surface + RAF 렌더 루프 ----------

  useEffect(() => {
    if (!ready || !canvasRef.current) return;
    if (!isCanvasKitInitialized()) return;

    const ck = getCanvasKit();
    const skiaCanvas = canvasRef.current;

    // DPR 적용
    const dpr = window.devicePixelRatio || 1;
    const rect = containerEl.getBoundingClientRect();
    skiaCanvas.width = Math.floor(rect.width * dpr);
    skiaCanvas.height = Math.floor(rect.height * dpr);
    skiaCanvas.style.width = `${rect.width}px`;
    skiaCanvas.style.height = `${rect.height}px`;

    // ADR-109 D4: SkiaRenderer.backgroundColor field cleanup. ADR-902 이후
    // clearFrame() 이 투명 clear 로 동작하고 body fill 은 element tree (BodySpec) 가
    // 담당하므로 renderer 가 background color 를 보유할 필요 없음.
    const renderer = new SkiaRenderer(ck, skiaCanvas, dpr);
    rendererRef.current = renderer;
    useCanvasLifecycleStore.getState().setBootstrapPhase("first-frame");

    // 테마 변경 동기화 — Skia 캐시 무효화 + invalidation 트리거 (background color 직접
    // 갱신은 BodySpec TokenRef resolve 가 자동 처리, 본 watcher 는 frame 재렌더만 보장)
    const themeWatcherHandle = setupThemeWatcher({
      onThemeChange: () => {
        renderer.invalidateContent();
        recordInvalidation("theme", "builderThemeChange");
      },
    });

    // ----- RAF 렌더 루프 -----
    let rafId = 0;
    let running = true;
    const contentCache = new FrameContentCache();
    // 재사용 판정 3축은 항상 함께 만들어지고 함께 무효화된다. 한 참조로 묶어
    // 부분 초기화로 stale 값이 남는 경로를 없앤다.
    let preparedFrame: {
      input: SkiaRendererInput;
      packet: typeof invalidationPacketRef.current;
      layoutVersion: number;
    } | null = null;
    // 재사용 검사 전용 스크래치. skip 경로에서 즉시 버려질 camera 객체를
    // 매 RAF 새로 할당하지 않는다.
    const cameraProbe = { zoom: 0, panX: 0, panY: 0 };

    // ADR-069 Phase 0: renderFrameCore는 원본 로직을 그대로 보존.
    // 아래 renderFrame wrapper가 observe()로 "render.frame" 라벨에 계측을 주입한다.
    // 내부 buildSkiaFrameContent / buildFrameRenderPlan / renderer.render 세 단계도
    // 각각 서브 라벨(render.content.build / render.plan.build / render.skia.draw)로
    // 분해 계측하여 Violation 발생 시 어느 단계가 지배적인지 즉시 식별 가능.
    const renderFrameCore = (): void => {
      if (!running) return;
      countFrameEvent("renderRaf");
      rafId = requestAnimationFrame(renderFrame);

      if (!rendererRef.current) return;
      if (contextLostRef.current) return;

      // Camera 상태 — ViewportController 뮤터블 ref에서 직접 읽기 (zero-latency)
      const cameraX = mutableViewport.x;
      const cameraY = mutableViewport.y;
      const cameraZoom = Math.max(mutableViewport.zoom, 0.001);

      const registryVersion = getRegistryVersion();
      const packet = invalidationPacketRef.current;
      const currentRendererInput = rendererInputRef.current;
      const pagePositionSnapshot = getPagePositionPresentationSnapshot();
      const sceneDocument = currentRendererInput.sceneSnapshot.document;
      const contentPagePositionVersion =
        sceneDocument.visiblePagePositionVersion;
      const documentPageFrameVersion = documentPageFrameVersionRef.current;

      // 미니맵 가시성
      const lastMmCam = lastMinimapCameraRef.current;
      const cameraChanged =
        cameraX !== lastMmCam.x ||
        cameraY !== lastMmCam.y ||
        cameraZoom !== lastMmCam.zoom;
      if (cameraChanged) {
        lastMinimapCameraRef.current = {
          x: cameraX,
          y: cameraY,
          zoom: cameraZoom,
        };
        if (!minimapVisibleRef.current) {
          minimapVisibleRef.current = true;
          overlayVersionRef.current++;
          recordInvalidation("overlay", "minimapShow");
        }
        if (minimapFadeTimerRef.current)
          clearTimeout(minimapFadeTimerRef.current);
        minimapFadeTimerRef.current = setTimeout(() => {
          minimapVisibleRef.current = false;
          overlayVersionRef.current++;
          recordInvalidation("overlay", "minimapHide");
        }, 1500);
      }

      // Dev metrics
      if (process.env.NODE_ENV === "development") {
        const now = performance.now();
        if (devRegistryWindowStartMs.current <= 0) {
          devRegistryWindowStartMs.current = now;
          devRegistryWindowStartVersion.current = registryVersion;
        } else {
          const elapsed = now - devRegistryWindowStartMs.current;
          if (elapsed >= 1000) {
            const delta =
              registryVersion - devRegistryWindowStartVersion.current;
            const perSec = delta / (elapsed / 1000);
            recordWasmMetric("registryChangesPerSec", perSec);
            flushWasmMetrics();
            devRegistryWindowStartMs.current = now;
            devRegistryWindowStartVersion.current = registryVersion;
          }
        }
      }

      // Selection 상태 변경 감지
      const currentSelectionSignature = packet.selection.selectionSignature;
      if (currentSelectionSignature !== lastSelectionSignatureRef.current) {
        overlayVersionRef.current++;
        recordInvalidation("overlay", "selection");
        lastSelectionSignatureRef.current = currentSelectionSignature;
      }

      // editingContext 변경 감지
      const currentEditingSignature = packet.selection.editingSignature;
      if (currentEditingSignature !== lastEditingContextRef.current) {
        overlayVersionRef.current++;
        recordInvalidation("overlay", "editingContext");
        lastEditingContextRef.current = currentEditingSignature;
      }

      // AI 상태 변경 감지
      const aiState = packet.ai;
      const currentAIActive =
        aiState.generatingNodes.size + aiState.flashAnimations.size;
      if (currentAIActive > 0) {
        const hasGenerating = aiState.generatingNodes.size > 0;
        if (hasGenerating) {
          overlayVersionRef.current++;
          recordInvalidation("overlay", "aiGenerating");
        } else {
          const now = performance.now();
          let allNearEnd = true;
          for (const flash of aiState.flashAnimations.values()) {
            const elapsed = now - flash.startTime;
            const progress = Math.min(elapsed / flash.duration, 1);
            if (progress < 0.9) {
              allNearEnd = false;
              break;
            }
          }
          if (!allNearEnd) {
            overlayVersionRef.current++;
            recordInvalidation("overlay", "aiFlash");
          }
        }
      } else if (currentAIActive !== lastAIActiveRef.current) {
        overlayVersionRef.current++;
        recordInvalidation("overlay", "aiCleanup");
      }
      lastAIActiveRef.current = currentAIActive;

      // Workflow 오버레이 상태
      const workflowOverlaySignature = packet.workflow.overlaySignature;
      if (
        workflowOverlaySignature !== lastWorkflowOverlaySignatureRef.current
      ) {
        lastWorkflowOverlaySignatureRef.current = workflowOverlaySignature;
        overlayVersionRef.current++;
        recordInvalidation("workflow", "toggleOverlay");
      }

      if (packet.workflow.showOverlay) {
        const subKey = packet.workflow.subToggleSignature;
        if (subKey !== lastWfSubTogglesRef.current) {
          lastWfSubTogglesRef.current = subKey;
          overlayVersionRef.current++;
          recordInvalidation("workflow", "subToggles");
        }

        const workflowGraphSignature = packet.workflow.graphSignature;
        if (workflowGraphSignature !== lastWorkflowGraphSignatureRef.current) {
          lastWorkflowGraphSignatureRef.current = workflowGraphSignature;
          overlayVersionRef.current++;
          recordInvalidation("workflow", "edgesRecalc");
        }

        const hoveredEdgeId = workflowHoverStateRef.current.hoveredEdgeId;
        if (hoveredEdgeId !== lastHoveredEdgeRef.current) {
          lastHoveredEdgeRef.current = hoveredEdgeId;
          overlayVersionRef.current++;
          recordInvalidation("workflow", "hoverEdge");
        }
        const focusedPageId = packet.workflow.focusedPageId;
        if (focusedPageId !== lastFocusedPageRef.current) {
          lastFocusedPageRef.current = focusedPageId;
          overlayVersionRef.current++;
          recordInvalidation("workflow", "focusedPage");
        }
      }

      // Visible page 변경 → content 무효화
      if (
        sceneDocument.visibleContentVersion !==
        lastVisibleContentVersionRef.current
      ) {
        const pendingDamageRevision = pendingDamageRevisionRef.current;
        const isRedundantDamageInvalidation =
          pendingDamageRevision === currentRendererInput.documentRevision;
        lastVisibleContentVersionRef.current =
          sceneDocument.visibleContentVersion;
        pendingDamageRevisionRef.current = null;
        if (!isRedundantDamageInvalidation) {
          renderer.invalidateContent();
        }
        recordInvalidation("content", "visiblePages");
      }

      if (
        sceneDocument.visiblePagePositionVersion !==
        lastVisiblePagePositionVersionRef.current
      ) {
        lastVisiblePagePositionVersionRef.current =
          sceneDocument.visiblePagePositionVersion;
        pendingDamageRevisionRef.current = null;
        renderer.invalidateContent();
        recordInvalidation("viewport", "visiblePagePosition");
        setPagePosStaleFrames(3);
      }

      if (tickPagePosStaleFrames()) {
        pendingDamageRevisionRef.current = null;
        renderer.invalidateContent();
      }

      const fontMgr =
        skiaFontManager.getFamilies().length > 0
          ? skiaFontManager.getFontMgr()
          : undefined;

      // Drag visual presentation
      const dragVisualOffsetRevision = getDragVisualOffsetRevision();
      if (dragVisualOffsetRevision !== dragVisualOffsetRevisionRef.current) {
        dragVisualOffsetRevisionRef.current = dragVisualOffsetRevision;
        // 같은 target의 delta는 retained picture의 translate에서 소비한다.
        // registry/content를 무효화하지 않고 현재 surface를 다시 present한다.
        overlayVersionRef.current++;
        recordInvalidation("overlay", "dragPresentation");
      }

      // Drag animation
      const dropIndicator = dropIndicatorSnapshotRef?.current ?? null;
      if (dropIndicator) {
        tickAnimations();
        const interpolated = getInterpolatedOffsets();
        setDragSiblingOffsets(interpolated.size > 0 ? interpolated : null);
      }
      const dragSiblingOffsetRevision = getDragSiblingOffsetRevision();
      if (dragSiblingOffsetRevision !== dragSiblingOffsetRevisionRef.current) {
        dragSiblingOffsetRevisionRef.current = dragSiblingOffsetRevision;
        // sibling offset은 execute 시점의 presentation 값이다. registry/command
        // stream은 유지하고, 이 값을 bake하는 content snapshot만 갱신한다.
        renderer.invalidateContent();
        recordInvalidation("content", "dragSiblingPresentation");
      }

      // Content build — Command Stream 경로
      const layoutVersion = getSharedLayoutVersion();
      cameraProbe.zoom = cameraZoom;
      cameraProbe.panX = cameraX;
      cameraProbe.panY = cameraY;
      if (
        preparedFrame?.input === currentRendererInput &&
        preparedFrame.packet === packet &&
        preparedFrame.layoutVersion === layoutVersion &&
        !presentationTargetRef.current &&
        !dropIndicator &&
        packet.ai.generatingNodes.size === 0 &&
        packet.ai.flashAnimations.size === 0 &&
        renderer.canReuseFramePreparation(
          registryVersion,
          cameraProbe,
          overlayVersionRef.current,
        )
      ) {
        renderer.pollGpuTimer();
        countFrameEvent("preparationSkipped");
        return;
      }
      const contentResult = observe(PERF_LABEL.RENDER_CONTENT_BUILD, () =>
        buildSkiaFrameContent(
          {
            aiState: packet.ai,
            registryVersion,
            pagePosVersion: contentPagePositionVersion,
            cameraX,
            cameraY,
            cameraZoom,
            ck,
            fontMgr,
            rendererInput: currentRendererInput,
          },
          contentCache,
        ),
      );

      if (!contentResult) {
        preparedFrame = null;
        renderer.clearFrame();
        renderer.invalidateContent();
        pendingDamageRevisionRef.current = null;
        return;
      }

      const {
        sharedScene,
        nodeBoundsMap,
        hasAIEffects,
        contentNode,
        dragPresentationNode,
      } = contentResult;
      const snapshot = createFrameInputSnapshot({
        registryVersion,
        pagePosVersion: documentPageFrameVersion,
        cameraX,
        cameraY,
        cameraZoom,
        overlayVersion: overlayVersionRef.current,
      });
      countFrameEvent("planBuild");
      const framePlan = observe(PERF_LABEL.RENDER_PLAN_BUILD, () =>
        buildFrameRenderPlan({
          ck,
          elementsMap: currentRendererInput.renderNodesMap,
          fontMgr,
          invalidationPacket: packet,
          snapshot,
          sharedScene,
          nodeBoundsMap,
          hasAIEffects,
          contentNode,
          dragPresentationNode,
          dragPresentationActive: getDragVisualOffset() !== null,
          allPageFrames: allPageFramesRef.current,
          visiblePageFrames:
            currentRendererInput.editMode === "layout"
              ? []
              : visiblePageFramesRef.current,
          frameAreas: frameAreasRef.current,
          pageTitleBoundsMap: pageTitleBoundsMapRef?.current,
          workflowHoverState: workflowHoverStateRef.current,
          elementHoverState: elementHoverStateRef.current,
          dropIndicatorState: dropIndicator,
          minimapVisible: minimapVisibleRef.current,
          minimapConfig: minimapConfigRef.current,
          skiaCanvasWidth: skiaCanvas.width,
          skiaCanvasHeight: skiaCanvas.height,
          dpr,
          prevEdgeGeometryCache: edgeGeometryCacheRef.current,
          prevEdgeGeometryCacheKey: edgeGeometryCacheKeyRef.current,
          pagePositionSnapshot,
        }),
      );

      hitBoundsMapRef.current = framePlan.sharedScene.hitBoundsMap;
      renderer.setContentNode(framePlan.contentNode);
      renderer.setOverlayNode(framePlan.overlayNode);

      if (framePlan.workflow) {
        pageFrameMapRef.current = framePlan.workflow.pageFrameMap;
        edgeGeometryCacheRef.current = framePlan.workflow.edgeGeometryCache;
        edgeGeometryCacheKeyRef.current =
          framePlan.workflow.edgeGeometryCacheKey;
      } else {
        pageFrameMapRef.current = new Map<string, PageFrame>();
        edgeGeometryCacheRef.current = [];
        edgeGeometryCacheKeyRef.current = "";
      }

      // DOM overlay는 별도 RAF를 만들지 않고, 이 frame이 실제로 그릴 정확한
      // camera/page snapshot을 소비한다. callback은 transform-only여야 한다.
      const cameraState = {
        zoom: cameraZoom,
        panX: cameraX,
        panY: cameraY,
      };
      publishCanvasFramePresentation(cameraState, pagePositionSnapshot);

      const didPresent = observe(PERF_LABEL.RENDER_SKIA_DRAW, () =>
        renderer.render(
          framePlan.cullingBounds,
          registryVersion,
          cameraState,
          overlayVersionRef.current,
        ),
      );

      const pendingTarget = presentationTargetRef.current;
      preparedFrame = { input: currentRendererInput, packet, layoutVersion };
      if (didPresent && pendingTarget) {
        const renderedProjectId =
          useCanonicalDocumentStore.getState().currentProjectId;
        if (renderedProjectId) {
          const lifecycle = useCanvasLifecycleStore.getState();
          lifecycle.acknowledgePresentedFrame({
            projectId: renderedProjectId,
            documentRevision: currentRendererInput.documentRevision,
          });
          // 성공한 acknowledgment 뒤에는 ref를 비워 이후 RAF의 Zustand 접근을
          // 제거한다. revision이 아직 target보다 낮으면 다음 제출을 계속 기다린다.
          if (useCanvasLifecycleStore.getState().isCanvasReady) {
            recordReadinessPresentation(
              renderedProjectId,
              currentRendererInput.documentRevision,
            );
            presentationTargetRef.current = null;
          }
        }
      }
    };

    // renderFrameCore는 내부에서 requestAnimationFrame(renderFrame)을 호출하므로,
    // 루프가 지속되는 동안 매 프레임 observe()가 "render.frame" duration을 기록한다.
    const renderFrame = (): void => {
      observe(PERF_LABEL.RENDER_FRAME, () => renderFrameCore());
    };

    // RAF 시작
    rafId = requestAnimationFrame(renderFrame);

    // WebGL 컨텍스트 손실 감시 — 이 등록이 **유일한 소유자**다.
    //   캔버스를 소유한 층만 그 element 에 리스너를 걸 수 있다. 밖에서
    //   `querySelector("canvas")` 로 찾아 거는 경로는 이 컴포넌트가 lazy 라
    //   마운트 시점에 DOM 에 없어 조용히 실패한다 (ADR-900 잔재, 2026-08-15).
    //   그래서 렌더 복구(ref)와 사용자 알림(store)을 여기서 함께 발행한다.
    const publishContextLost = (lost: boolean) => {
      useCanvasLifecycleStore.getState().setContextLost(lost);
    };
    const unwatchContext = watchContextLoss(
      skiaCanvas,
      () => {
        contextLostRef.current = true;
        publishContextLost(true);
      },
      () => {
        contextLostRef.current = false;
        publishContextLost(false);
        if (rendererRef.current && canvasRef.current) {
          rendererRef.current.resize(canvasRef.current);
          rendererRef.current.invalidateContent();
          rendererRef.current.clearFrame();
          recordInvalidation("resource", "contextRestored");
        }
      },
    );

    return () => {
      running = false;
      contentCache.clear();
      cancelAnimationFrame(rafId);
      themeWatcherHandle.disconnect();
      unwatchContext();
      // 손실 상태로 캔버스가 사라지면 플래그가 남아 remount 후에도 경고가 붙는다.
      if (contextLostRef.current) {
        contextLostRef.current = false;
        publishContextLost(false);
      }
      if (minimapFadeTimerRef.current)
        clearTimeout(minimapFadeTimerRef.current);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [ready, containerEl, dropIndicatorSnapshotRef, pageTitleBoundsMapRef]);

  // 캔버스 unmount 시 모듈 캐시 통합 해제 (ADR-153 Phase 2 — R2 WASM 누수 차단).
  // render-loop effect 의 cleanup 은 deps 변경마다 재실행되므로 여기(unmount 한정)서만
  // 파괴한다 — paint 풀/imageCache 는 remount 시 lazy 재구축된다.
  useEffect(() => () => destroyAllSkiaCaches(), []);

  // 페이지 전환 시 오버레이 갱신
  const prevPageIdRef = useRef(
    rendererInput.sceneSnapshot.document.currentPageId,
  );

  useEffect(() => {
    const currentPageId = rendererInput.sceneSnapshot.document.currentPageId;
    if (prevPageIdRef.current !== currentPageId) {
      prevPageIdRef.current = currentPageId;
      overlayVersionRef.current++;
      // 활성 페이지가 페인트 최상단으로 재배열되므로 (pagePaintOrder.ts) content
      // 재렌더 필수 — overlayVersion 만으로는 classifyFrame 이 "present"(snapshot
      // blit)로 분류해 이전 겹침 순서의 스냅샷이 남는다.
      rendererRef.current?.invalidateContent();
      recordInvalidation("overlay", "pageSwitch");
    }
  }, [rendererInput.sceneSnapshot.document.currentPageId]);

  // 이미지 로딩 완료 콜백
  useEffect(() => {
    if (!ready) return;

    const unregister = registerImageLoadCallback(() => {
      rendererRef.current?.invalidateContent();
      invalidateLayout();
      recordInvalidation("resource", "imageLoaded");
    });

    return unregister;
  }, [ready, invalidateLayout]);

  // 리사이즈 대응 (150ms 디바운스)
  useEffect(() => {
    if (!ready || !canvasRef.current) return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !canvasRef.current) return;

      if (resizeTimer) clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {
        if (!canvasRef.current) return;

        const dpr = window.devicePixelRatio || 1;
        const { width, height } = entry.contentRect;
        canvasRef.current.width = Math.floor(width * dpr);
        canvasRef.current.height = Math.floor(height * dpr);
        canvasRef.current.style.width = `${width}px`;
        canvasRef.current.style.height = `${height}px`;

        if (rendererRef.current) {
          rendererRef.current.resize(canvasRef.current);
          rendererRef.current.invalidateContent();
          rendererRef.current.clearFrame();
          recordInvalidation("content", "containerResize");
        }
      }, 150);
    });

    observer.observe(containerEl);

    // DPR 변경 감지
    let dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const handleDprChange = () => {
      if (!canvasRef.current || !rendererRef.current) return;

      const newDpr = window.devicePixelRatio || 1;
      const rect = containerEl.getBoundingClientRect();
      canvasRef.current.width = Math.floor(rect.width * newDpr);
      canvasRef.current.height = Math.floor(rect.height * newDpr);

      rendererRef.current.resize(canvasRef.current);
      rendererRef.current.invalidateContent();
      rendererRef.current.clearFrame();
      recordInvalidation("resource", "dprChange");

      dprQuery.removeEventListener("change", handleDprChange);
      dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener("change", handleDprChange);
    };
    dprQuery.addEventListener("change", handleDprChange);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
      dprQuery.removeEventListener("change", handleDprChange);
    };
  }, [ready, containerEl]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="skia-canvas-unified"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 2,
        // SkiaCanvas는 단독 렌더러이므로 이벤트도 수신
        // Canvas가 직접 pointer 이벤트를 수신
        pointerEvents: "auto",
      }}
    />
  );
}
