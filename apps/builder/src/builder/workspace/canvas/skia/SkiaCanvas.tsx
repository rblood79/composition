/**
 * SkiaCanvas — 독립 Skia 렌더러 (ADR-100 Phase 2.6)
 *
 * PixiJS Application 없이 동작하는 단독 캔버스 컴포넌트.
 * - 자체 requestAnimationFrame 루프
 * - Camera 클래스로 viewport 제어
 * - 기존 빌드 파이프라인(buildSkiaFrameContent, buildFrameRenderPlan) 재사용
 * SkiaOverlay와 동일한 렌더링 결과를 산출하되,
 * PixiJS ticker/Container/EventBoundary에 대한 의존성을 완전히 제거한다.
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
import { setDragSiblingOffsets } from "./nodeRendererTree";
import { buildSkiaFrameContent } from "./skiaFramePipeline";
import { invalidateCommandStreamCache } from "./renderCommands";
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
import { Camera } from "../viewport/Camera";
import { viewportState as mutableViewport } from "../viewport/viewportState";
import { StoreRenderBridge } from "./StoreRenderBridge";
import { getSharedLayoutMap } from "../layout/engines/fullTreeLayout";
import { useStore } from "../../../stores";
import { useAIVisualFeedbackStore } from "../../../stores/aiVisualFeedback";
import { observe, PERF_LABEL } from "../../../utils/perfMarks";
import {
  useThemeConfigStore,
  resolveSkiaTheme,
} from "../../../../stores/themeConfigStore";

// Dev profiler — window.__composition_PROFILER 노출 (side-effect import)
import "../benchmarks/devProfiler";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkiaCanvasProps {
  /** 부모 컨테이너 DOM 요소 */
  containerEl: HTMLDivElement;
  /** PixiJS Application (과도기 호환, 미사용) */
  app?: unknown;
  /** Layout 무효화 콜백 */
  invalidateLayout: () => void;
  /**
   * ADR-074 Phase 4: scene sub-packet 만 BuilderCanvas 에서 주입.
   * overlay packet (ai + selection + dragActive) 은 SkiaCanvas 내부에서
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
  /** 외부 Camera 인스턴스 (미지정 시 내부 생성) */
  camera?: Camera;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Skia 단독 렌더러.
 *
 * PixiJS 없이 동작:
 * - z-index: 2 — CanvasKit 캔버스 (디자인 + 오버레이)
 * - 자체 RAF 루프 (PixiJS ticker 불필요)
 * - Camera 클래스로 viewport 상태 관리
 * - Command Stream 경로 전용 (sharedLayoutMap 필수)
 */
export function SkiaCanvas({
  containerEl,
  app,
  invalidateLayout,
  sceneInvalidationPacket,
  rendererInput,
  dropIndicatorSnapshotRef,
  pageTitleBoundsMapRef,
  camera: externalCamera,
}: SkiaCanvasProps) {
  // ADR-074 Phase 4: overlay sub-packet 을 SkiaCanvas 내부에서 자체 구독/생성.
  // BuilderCanvas 루트의 selection/editing/ai 구독을 제거하여 루트 리렌더
  // fan-out 을 차단. 합성 invalidationPacket 은 기존 ref/render 로직과 호환.
  const currentPageId = useStore((state) => state.currentPageId);
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
      dragActive: false,
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
  const _cameraRef = useRef<Camera>(externalCamera ?? new Camera());

  // Phase 6: Selection/AI 상태 변경 감지용 ref
  const overlayVersionRef = useRef(0);
  const lastSelectionSignatureRef = useRef("");
  const lastAIActiveRef = useRef(0);
  const _lastPageFramesSignatureRef = useRef("");
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

  // Workflow/hover 캐시
  const invalidationPacketRef = useRef(invalidationPacket);
  const rendererInputRef = useRef(rendererInput);
  const storeRenderBridgeRef = useRef<StoreRenderBridge | null>(null);
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
  const treeBoundsMapRef = useRef<Map<string, BoundingBox>>(new Map());

  // Workflow
  const workflowHoverStateRef = useRef<WorkflowHoverState>({
    hoveredEdgeId: null,
  });
  const edgeGeometryCacheRef = useRef<CachedEdgeGeometry[]>([]);
  const edgeGeometryCacheKeyRef = useRef("");
  const pageFrameMapRef = useRef<Map<string, PageFrame>>(new Map());
  const lastHoveredEdgeRef = useRef<string | null>(null);
  const lastFocusedPageRef = useRef<string | null>(null);

  // Grid
  const lastGridSignatureRef = useRef("");

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
    invalidateCommandStreamCache();
    rendererRef.current?.invalidateContent();
    storeRenderBridgeRef.current?.sync(
      rendererInput.renderNodesMap,
      getSharedLayoutMap(),
      resolveSkiaTheme(useThemeConfigStore.getState().darkMode),
      rendererInput.childrenMap,
      true,
    );
    recordInvalidation("content", "rendererInput");
  }, [rendererInput]);

  useEffect(() => {
    invalidationPacketRef.current = invalidationPacket;
  }, [invalidationPacket]);

  // ---------- StoreRenderBridge (Phase 6) ----------
  // PixiJS Application이 없을 때 store에서 직접 skiaNodeRegistry를 채운다.

  useEffect(() => {
    if (app) return; // PixiJS가 있으면 기존 Sprite 경로 사용
    const bridge = new StoreRenderBridge();
    storeRenderBridgeRef.current = bridge;
    bridge.connect({
      getElements: () => rendererInputRef.current.renderNodesMap,
      getLayoutMap: () => getSharedLayoutMap(),
      getChildrenMap: () => rendererInputRef.current.childrenMap,
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
    });

    return () => {
      if (storeRenderBridgeRef.current === bridge) {
        storeRenderBridgeRef.current = null;
      }
      bridge.dispose();
    };
  }, [app]);

  // Camera ↔ viewport 동기화는 viewportState 뮤터블 ref로 대체 (Phase 5.4)
  // ViewportController.notifyUpdateListeners()가 viewportState를 동기 갱신
  // SkiaCanvas RAF에서 mutableViewport.x/y/zoom으로 직접 읽기

  // ---------- 인터랙션 훅 ----------

  useWorkflowInteraction({
    containerEl,
    edgeGeometryCacheRef,
    pageFrameMapRef,
    hoverStateRef: workflowHoverStateRef,
    overlayVersionRef,
    minimapConfigRef,
  });

  useElementHoverInteraction({
    containerEl,
    frameAreasRef,
    pageFramesRef: visiblePageFramesRef,
    getHoverElementsMap: () => rendererInputRef.current.renderNodesMap,
    getHoverChildrenMap: () => rendererInputRef.current.childrenMap,
    hoverStateRef: elementHoverStateRef,
    overlayVersionRef,
    treeBoundsMapRef,
  });

  useScrollWheelInteraction({
    containerEl,
    getScrollElementsMap: () => rendererInputRef.current.renderNodesMap,
    treeBoundsMapRef,
  });

  // ---------- WASM + Font 초기화 ----------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAllWasm();
        if (cancelled) return;

        getCanvasKit(); // CanvasKit 초기화 확인
        // 기본 폰트 로딩 (빌트인 Variable → 커스텀)
        await loadBuiltinFontsToSkia();
        await loadAllCustomFontsToSkia();
        if (!cancelled) setReady(true);
      } catch (e) {
        console.error("[SkiaCanvas] WASM/Font 초기화 실패:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

    // 테마 변경 동기화 — Skia 캐시 무효화 + invalidation 트리거 (background color 직접
    // 갱신은 BodySpec TokenRef resolve 가 자동 처리, 본 watcher 는 frame 재렌더만 보장)
    const themeWatcherHandle = setupThemeWatcher(containerEl, {
      onThemeChange: () => {
        renderer.invalidateContent();
        recordInvalidation("theme", "builderThemeChange");
      },
    });

    // ----- RAF 렌더 루프 (PixiJS ticker 대체) -----
    let rafId = 0;
    let running = true;

    // ADR-069 Phase 0: renderFrameCore는 원본 로직을 그대로 보존.
    // 아래 renderFrame wrapper가 observe()로 "render.frame" 라벨에 계측을 주입한다.
    // 내부 buildSkiaFrameContent / buildFrameRenderPlan / renderer.render 세 단계도
    // 각각 서브 라벨(render.content.build / render.plan.build / render.skia.draw)로
    // 분해 계측하여 Violation 발생 시 어느 단계가 지배적인지 즉시 식별 가능.
    const renderFrameCore = (): void => {
      if (!running) return;
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

      // Grid 상태
      const currentGridSignature = packet.grid.signature;
      if (currentGridSignature !== lastGridSignatureRef.current) {
        overlayVersionRef.current++;
        recordInvalidation("overlay", "grid");
        lastGridSignatureRef.current = currentGridSignature;
      }

      // 드래그 중 오버레이 갱신
      if (packet.dragActive) {
        overlayVersionRef.current++;
        recordInvalidation("overlay", "drag");
      }

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

      const cameraState = {
        zoom: cameraZoom,
        panX: cameraX,
        panY: cameraY,
      };

      // Visible page 변경 → content 무효화
      if (
        sceneDocument.visibleContentVersion !==
        lastVisibleContentVersionRef.current
      ) {
        lastVisibleContentVersionRef.current =
          sceneDocument.visibleContentVersion;
        renderer.invalidateContent();
        recordInvalidation("content", "visiblePages");
      }

      if (
        sceneDocument.visiblePagePositionVersion !==
        lastVisiblePagePositionVersionRef.current
      ) {
        lastVisiblePagePositionVersionRef.current =
          sceneDocument.visiblePagePositionVersion;
        renderer.invalidateContent();
        recordInvalidation("viewport", "visiblePagePosition");
        setPagePosStaleFrames(3);
      }

      if (tickPagePosStaleFrames()) {
        renderer.invalidateContent();
      }

      const fontMgr =
        skiaFontManager.getFamilies().length > 0
          ? skiaFontManager.getFontMgr()
          : undefined;

      // Drag animation
      const dropIndicator = dropIndicatorSnapshotRef?.current ?? null;
      if (dropIndicator) {
        const stillAnimating = tickAnimations();
        const interpolated = getInterpolatedOffsets();
        setDragSiblingOffsets(interpolated.size > 0 ? interpolated : null);
        if (stillAnimating) {
          notifyLayoutChange();
        }
      }

      // Content build — Command Stream 경로 (cameraContainer: null → PixiJS 불필요)
      const contentResult = observe(PERF_LABEL.RENDER_CONTENT_BUILD, () =>
        buildSkiaFrameContent({
          aiState: packet.ai,
          registryVersion,
          pagePosVersion: contentPagePositionVersion,
          cameraContainer: null, // Skia 단독 모드: PixiJS Container 불필요
          cameraX,
          cameraY,
          cameraZoom,
          ck,
          fontMgr,
          rendererInput: currentRendererInput,
        }),
      );

      if (!contentResult) {
        renderer.clearFrame();
        renderer.invalidateContent();
        return;
      }

      const { sharedScene, nodeBoundsMap, hasAIEffects, contentNode } =
        contentResult;
      const snapshot = createFrameInputSnapshot({
        registryVersion,
        pagePosVersion: documentPageFrameVersion,
        cameraX,
        cameraY,
        cameraZoom,
        overlayVersion: overlayVersionRef.current,
      });
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
        }),
      );

      treeBoundsMapRef.current = framePlan.sharedScene.treeBoundsMap;
      renderer.setContentNode(framePlan.contentNode);
      renderer.setOverlayNode(framePlan.overlayNode);
      renderer.setScreenOverlayNode(framePlan.screenOverlayNode);

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

      observe(PERF_LABEL.RENDER_SKIA_DRAW, () => {
        renderer.render(
          framePlan.cullingBounds,
          registryVersion,
          cameraState,
          overlayVersionRef.current,
        );
      });
    };

    // renderFrameCore는 내부에서 requestAnimationFrame(renderFrame)을 호출하므로,
    // 루프가 지속되는 동안 매 프레임 observe()가 "render.frame" duration을 기록한다.
    const renderFrame = (): void => {
      observe(PERF_LABEL.RENDER_FRAME, () => renderFrameCore());
    };

    // RAF 시작
    rafId = requestAnimationFrame(renderFrame);

    // WebGL 컨텍스트 손실 감시
    const unwatchContext = watchContextLoss(
      skiaCanvas,
      () => {
        contextLostRef.current = true;
      },
      () => {
        contextLostRef.current = false;
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
      cancelAnimationFrame(rafId);
      themeWatcherHandle.disconnect();
      unwatchContext();
      if (minimapFadeTimerRef.current)
        clearTimeout(minimapFadeTimerRef.current);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [ready, containerEl, dropIndicatorSnapshotRef, pageTitleBoundsMapRef]);

  // 페이지 전환 시 오버레이 갱신
  const prevPageIdRef = useRef(
    rendererInput.sceneSnapshot.document.currentPageId,
  );

  useEffect(() => {
    const currentPageId = rendererInput.sceneSnapshot.document.currentPageId;
    if (prevPageIdRef.current !== currentPageId) {
      prevPageIdRef.current = currentPageId;
      overlayVersionRef.current++;
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
        // (PixiJS 없음 → pointerEvents를 'auto'로)
        pointerEvents: "auto",
      }}
    />
  );
}
