/**
 * Builder Canvas
 *
 * Phase 11: DirectContainer 기반 캔버스
 *
 * 기능:
 * - PixiJS Application 초기화
 * - Element 렌더링 (ElementSprite)
 * - Selection Overlay
 * - Zoom/Pan
 *
 * @since 2025-12-11 Phase 10 B1.1
 * @updated 2026-02-18 Phase 11 - @pixi/layout 완전 제거, DirectContainer 전환
 */
import {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  lazy,
  Suspense,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useStore } from "../../stores";
import type { PageLayoutDirection } from "../../stores/canvasSettings";
import { useEditModeStore } from "../../stores/editMode";
import {
  useCanonicalReusableFrameLayouts,
  useSelectedReusableFrameId,
} from "../../stores/canonical/canonicalFrameStore";
import { useActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { requestEditingSemanticsDetachConfirmation } from "../../utils/editingSemanticsImpactConfirmation";
import { useCanvasLifecycleStore, useViewportSyncStore } from "./stores";
import { isWebGLCanvas } from "../../../utils/featureFlags";
import { isUnifiedFlag } from "./wasm-bindings/featureFlags";
import type { BoundingBox } from "./selection/types";
import type { DropIndicatorSnapshot } from "./selection/dropTargetResolver";
// GridLayer는 Skia gridRenderer로 대체됨
import { ViewportControlBridge } from "./viewport";
import { screenToViewportPoint } from "./viewport/viewportTransforms";
import { TextEditOverlay, useTextEdit } from "../overlay";
import { DotBackground } from "../components/DotBackground";
import {
  computeSelectionBounds,
  resolveCanvasDetachContextTarget,
  resolveSelectedElementsForPage,
} from "./interaction";
import {
  buildFrameRendererInput,
  buildPixiPageRendererInput,
  createSceneInvalidationPacket,
  createSkiaRendererInput,
  type RendererSceneInvalidation,
  type SkiaRendererInput,
} from "./renderers";
import { getElementBoundsSimple } from "./elementRegistry";
import { GPUDebugOverlay } from "./utils/GPUDebugOverlay";
import { useCanvasElementSelectionHandlers } from "./hooks/useCanvasElementSelectionHandlers";
import { useCentralCanvasPointerHandlers } from "./hooks/useCentralCanvasPointerHandlers";
import { useCanvasRuntimeBootstrap } from "./hooks/useCanvasRuntimeBootstrap";
import { useCanvasSurfaceLifecycle } from "./hooks/useCanvasSurfaceLifecycle";
import { useLayoutPublisher } from "./hooks/useLayoutPublisher";
import { useDragBridge } from "./hooks/useDragBridge";
import { usePageDrag } from "./hooks/usePageDrag";
import { useKeyboardShortcutsRegistry } from "../../hooks/useKeyboardShortcutsRegistry";
import type { PageTitleBounds } from "./skia/skiaOverlayHelpers";

import {
  buildCanonicalSceneModel,
  buildSceneChildrenByParent,
  buildSceneElementMap,
  buildSceneStructureSnapshot,
} from "./scene";
import {
  computeWorkflowEdges,
  computeDataSourceEdges,
  computeLayoutGroups,
  computeFrameAreas,
  type WorkflowElementInput,
} from "./skia/workflowEdges";
import type { Element } from "../../../types/core/store.types";

import { useGPUProfiler } from "./utils/gpuProfilerCore";
import { hitTestPoint } from "./wasm-bindings/spatialIndex";

// ============================================
// Types
// ============================================

export interface BuilderCanvasProps {
  /** 페이지 영역 너비 (breakpoint 크기) */
  pageWidth?: number;
  /** 페이지 영역 높이 (breakpoint 크기) */
  pageHeight?: number;
  /** 초기 Pan Offset X (비교 모드 등에서 사용) */
  initialPanOffsetX?: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const PAGE_STACK_GAP = 80;
const EMPTY_ELEMENTS: Element[] = [];

function computeStackedCanvasPosition(
  index: number,
  width: number,
  height: number,
  gap: number,
  direction: PageLayoutDirection,
): { x: number; y: number } {
  if (direction === "vertical") {
    return { x: 0, y: index * (height + gap) };
  }

  if (direction === "zigzag") {
    return {
      x: (index % 2) * (width + gap),
      y: Math.floor(index / 2) * (height + gap),
    };
  }

  return { x: index * (width + gap), y: 0 };
}

type CanvasContextMenuState = {
  elementId: string;
  x: number;
  y: number;
};

// ============================================
// Sub-Components
// ============================================

// GridLayer는 ./grid/GridLayer.tsx로 이동됨 (B1.4)
// CanvasResizeHandler 삭제됨 - resizeTo 옵션으로 대체 (Phase 12 B3.2)

/**
 * Phase 5: CanvasKit 오버레이 (Lazy Import)
 */
/**
 * SkiaCanvas (SceneGraph 기반 단독 렌더러, Lazy Import)
 */
const skiaCanvasImport = () =>
  import("./skia/SkiaCanvas").then((mod) => ({ default: mod.SkiaCanvas }));
const SkiaCanvasComponent = lazy(skiaCanvasImport);

function SkiaCanvasLazy(props: {
  containerEl: HTMLDivElement;
  invalidateLayout: () => void;
  sceneInvalidationPacket: RendererSceneInvalidation;
  rendererInput: SkiaRendererInput;
  dropIndicatorSnapshotRef?: React.MutableRefObject<DropIndicatorSnapshot | null>;
  pageTitleBoundsMapRef?: React.MutableRefObject<Map<string, PageTitleBounds>>;
}) {
  return (
    <Suspense fallback={null}>
      <SkiaCanvasComponent {...props} />
    </Suspense>
  );
}

// ============================================
// Main Component
// ============================================

export function BuilderCanvas({
  pageWidth = DEFAULT_WIDTH,
  pageHeight = DEFAULT_HEIGHT,
  initialPanOffsetX,
}: BuilderCanvasProps) {
  // Dev-only: rAF 기반 FPS/프레임타임 측정(렌더 idle 여부와는 별개)
  useGPUProfiler(import.meta.env.DEV);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const { appReady, wasmLayoutFailed, wasmLayoutReady } =
    useCanvasRuntimeBootstrap();

  const containerSize = useViewportSyncStore((state) => state.containerSize);

  // 컨테이너 ref 콜백: 마운트 시점에 DOM 노드를 안전하게 확보
  const setContainerNode = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainerEl(node);
  }, []);

  // Canvas는 컨테이너 크기에 맞춰 자동 동기화 (CSS → 종료 시 renderer.resize)

  const layouts = useCanonicalReusableFrameLayouts();
  const activeCanonicalDocument = useActiveCanonicalDocument();
  const canonicalSceneModel = useMemo(() => {
    if (!activeCanonicalDocument) return null;
    return buildCanonicalSceneModel(activeCanonicalDocument);
  }, [activeCanonicalDocument]);

  // Store state
  const storeElements = useStore((state) => {
    if (activeCanonicalDocument) return EMPTY_ELEMENTS;
    const { elements: legacyElements } = state;
    return legacyElements;
  });
  const pages = useStore((state) => state.pages);
  const currentEditMode = useEditModeStore((state) => state.mode);
  const isFrameEditMode = currentEditMode === "layout";
  // ADR-074 Phase 4: selectedElementId/Ids/editingContextId/ai 3개 구독을
  // SkiaCanvas 내부로 이전. 루트 리렌더 fan-out 차단.
  const setSelectedElement = useStore((state) => state.setSelectedElement);
  const setSelectedElements = useStore((state) => state.setSelectedElements);
  const clearSelection = useStore((state) => state.clearSelection);
  const currentPageId = useStore((state) => state.currentPageId);
  const setCurrentPageId = useStore((state) => state.setCurrentPageId);
  // ADR-069 Phase 1: 페이지 전환 + 선택 병합 action
  const selectElementWithPageTransition = useStore(
    (state) => state.selectElementWithPageTransition,
  );
  const invalidateLayout = useStore((state) => state.invalidateLayout);
  const detachInstance = useStore((state) => state.detachInstance);
  const [canvasContextMenu, setCanvasContextMenu] =
    useState<CanvasContextMenuState | null>(null);

  // Settings state (SettingsPanel 연동)
  const showGrid = useStore((state) => state.showGrid);
  const gridSize = useStore((state) => state.gridSize);
  const showWorkflowOverlay = useStore((state) => state.showWorkflowOverlay);
  const showWorkflowNavigation = useStore(
    (state) => state.showWorkflowNavigation,
  );
  const showWorkflowEvents = useStore((state) => state.showWorkflowEvents);
  const showWorkflowDataSources = useStore(
    (state) => state.showWorkflowDataSources,
  );
  const showWorkflowLayoutGroups = useStore(
    (state) => state.showWorkflowLayoutGroups,
  );
  const workflowStraightEdges = useStore(
    (state) => state.workflowStraightEdges,
  );
  const workflowFocusedPageId = useStore(
    (state) => state.workflowFocusedPageId,
  );
  const dirtyElementIds = useStore((state) => state.dirtyElementIds);
  const emptyFrameElementScopes = useMemo(() => new Map(), []);
  const frameElementScopes =
    canonicalSceneModel?.frameElementScopes ?? emptyFrameElementScopes;
  // Frames tab overview: canvas 는 reusable frame 전체를 표시하고, 이 값은
  // Node tree/properties 의 현재 frame 선택 동기화에 사용한다.
  const selectedReusableFrameId = useSelectedReusableFrameId();
  // ADR-074 Phase 4: aiGeneratingNodes/aiFlashAnimations/cleanupExpiredFlashes
  // 구독은 SkiaCanvas 내부로 이전 — BuilderCanvas 루트 리렌더 fan-out 차단.

  const zoom = useViewportSyncStore((state) => state.zoom);
  const panOffset = useViewportSyncStore((state) => state.panOffset);

  // ADR-100 Phase 9 회귀 복구: <PageContainer> 제거로 끊겼던 page-title drag
  // 경로를 Skia overlay 경유로 재배선. SkiaCanvas renderSkia 가 매 프레임
  // pageTitleBoundsMapRef.current 에 scene 좌표 bounds 를 populate 하고,
  // BuilderCanvas pointerdown(capture) 가 이 Map 을 조회해 usePageDrag 를 트리거.
  const pageTitleBoundsMapRef = useRef<Map<string, PageTitleBounds>>(new Map());
  const { startDrag: startPageDrag } = usePageDrag(zoom);

  // Canvas sync actions
  const setCanvasReady = useCanvasLifecycleStore(
    (state) => state.setCanvasReady,
  );
  const setContextLost = useCanvasLifecycleStore(
    (state) => state.setContextLost,
  );
  const syncPixiVersion = useCanvasLifecycleStore(
    (state) => state.syncPixiVersion,
  );
  const renderVersion = useCanvasLifecycleStore((state) => state.renderVersion);

  // ADR-122 Phase 3: active canonical document 가 있으면 Skia scene input은
  // Builder store mirror 가 아니라 canonical document 에서 만든 scene model을
  // 직접 사용한다. store mirror 는 hydration fallback 으로만 남긴다.
  const storeElementsMap = useMemo(
    () => buildSceneElementMap(storeElements),
    [storeElements],
  );
  const storeChildrenByParent = useMemo(
    () => buildSceneChildrenByParent(storeElements),
    [storeElements],
  );
  const elements = canonicalSceneModel?.elements ?? storeElements;
  const elementsMap = canonicalSceneModel?.elementsMap ?? storeElementsMap;
  const childrenMap =
    canonicalSceneModel?.childrenByParent ?? storeChildrenByParent;
  const elementById = elementsMap;

  // ADR-006 P3-1: dirtyElementIds 소비 후 초기화
  // layoutVersion이 변경되면 render cycle에서 useMemo가 레이아웃을 재계산한 뒤,
  // useEffect에서 이전 프레임의 dirty ID를 정리하여 메모리 누적을 방지한다.
  const layoutVersion = useStore((state) => state.layoutVersion);
  const clearDirtyElementIds = useStore((state) => state.clearDirtyElementIds);
  useEffect(() => {
    if (layoutVersion > 0) {
      clearDirtyElementIds();
    }
  }, [layoutVersion, clearDirtyElementIds]);

  // Zoom/Pan은 ViewportControlBridge에서 처리 (Application 내부에서 Container 직접 조작)

  // 🆕 Multi-page: 모든 페이지의 데이터 (body + elements) 사전 계산
  const pagePositions = useStore((state) => state.pagePositions);
  const pagePositionsVersion = useStore((state) => state.pagePositionsVersion);
  const initializePagePositions = useStore(
    (state) => state.initializePagePositions,
  );

  // ADR-111 P3-δ: reusable frame canvas authoring 시각 path
  const framePositions = useStore((state) => state.framePositions);
  const framePositionsVersion = useStore(
    (state) => state.framePositionsVersion,
  );
  const pageLayoutDirection = useStore((state) => state.pageLayoutDirection);
  const previousLayoutKeyRef = useRef(
    `${pageWidth}:${pageHeight}:${pageLayoutDirection}`,
  );

  const pageIndex = useStore((state) => state.pageIndex);
  const scenePageIndex = canonicalSceneModel?.pageIndex ?? pageIndex;

  useEffect(() => {
    const layoutKey = `${pageWidth}:${pageHeight}:${pageLayoutDirection}`;
    if (previousLayoutKeyRef.current === layoutKey || pages.length === 0) {
      return;
    }

    previousLayoutKeyRef.current = layoutKey;
    initializePagePositions(
      pages,
      pageWidth,
      pageHeight,
      PAGE_STACK_GAP,
      pageLayoutDirection,
    );
  }, [
    initializePagePositions,
    pageHeight,
    pageLayoutDirection,
    pageWidth,
    pages,
  ]);

  // ADR-074 Phase 2: structure(selection-invariant) / selection 분리.
  // selection-only 변화 시 structure useMemo identity 유지 → 하위 useMemo
  // (skiaRendererInput / layoutPublisherInputs) 의 deps 변동 차단.
  const sceneStructureSnapshot = useMemo(() => {
    const scenePages = isFrameEditMode ? [] : pages;
    return buildSceneStructureSnapshot({
      containerSize,
      currentPageId: isFrameEditMode ? null : currentPageId,
      elements,
      elementsMap,
      layoutVersion,
      pageHeight,
      pageIndex: scenePageIndex,
      pagePositions,
      pagePositionsVersion,
      pageWidth,
      pages: scenePages,
      panOffset,
      source: canonicalSceneModel ? "canonical" : "legacy-bootstrap",
      zoom,
    });
  }, [
    containerSize,
    canonicalSceneModel,
    currentPageId,
    elements,
    elementsMap,
    isFrameEditMode,
    layoutVersion,
    pageHeight,
    scenePageIndex,
    pagePositions,
    pagePositionsVersion,
    pageWidth,
    pages,
    panOffset,
    zoom,
  ]);

  // ADR-074 Phase 4: 합성 sceneSnapshot + sceneSelectionState 제거.
  // sceneSnapshot.selection 소비자 0 (rendererInput 경로는 structure 필드만 사용)
  // 이므로 selection state 생성 자체가 불필요. 하위 consumer 는 이제
  // sceneStructureSnapshot 을 직접 소비.
  const sceneSnapshot = sceneStructureSnapshot;

  const visiblePageIds = sceneStructureSnapshot.document.visiblePageIds;
  const visiblePages = useMemo(() => {
    if (isFrameEditMode) return [];
    return pages.filter((page) => visiblePageIds.has(page.id));
  }, [isFrameEditMode, pages, visiblePageIds]);

  // ADR-100 Phase 6.4: PixiJS 없이 레이아웃 발행
  const layoutPublisherInputs = useMemo(() => {
    return visiblePages
      .map((page) => {
        const input = buildPixiPageRendererInput({
          elementById,
          dirtyElementIds,
          pageHeight,
          pageId: page.id,
          pagePositionVersion: pagePositionsVersion,
          pageWidth,
          panOffset,
          sceneSnapshot,
          wasmLayoutReady,
          zoom,
        });
        return input ? { pageId: page.id, input } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [
    visiblePages,
    elementById,
    dirtyElementIds,
    pageHeight,
    pagePositionsVersion,
    pageWidth,
    panOffset,
    sceneSnapshot,
    wasmLayoutReady,
    zoom,
  ]);

  const workflowEdges = useMemo(() => {
    return computeWorkflowEdges(
      pages,
      elements as unknown as WorkflowElementInput[],
    );
  }, [pages, elements]);
  const dataSourceEdges = useMemo(() => {
    return computeDataSourceEdges(
      elements as unknown as WorkflowElementInput[],
    );
  }, [elements]);
  const layoutGroups = useMemo(() => {
    return computeLayoutGroups(pages, layouts, activeCanonicalDocument);
  }, [activeCanonicalDocument, pages, layouts]);

  // ADR-111 P3-δ (B): canonical reusable frame 별 캔버스 영역 그룹.
  const frameAreas = useMemo(() => {
    if (!isFrameEditMode) return [];
    const anchorPageId = currentPageId ?? pages[0]?.id ?? null;
    const anchorPosition = anchorPageId
      ? pagePositions[anchorPageId]
      : undefined;
    return computeFrameAreas(
      activeCanonicalDocument,
      framePositions,
      selectedReusableFrameId,
    ).map((area, index) => {
      const stackedPosition = computeStackedCanvasPosition(
        index,
        pageWidth,
        pageHeight,
        PAGE_STACK_GAP,
        pageLayoutDirection,
      );
      return {
        ...area,
        x: (anchorPosition?.x ?? 0) + stackedPosition.x,
        y: (anchorPosition?.y ?? 0) + stackedPosition.y,
        width: pageWidth,
        height: pageHeight,
      };
    });
  }, [
    activeCanonicalDocument,
    currentPageId,
    pages,
    framePositions,
    isFrameEditMode,
    pageHeight,
    pageLayoutDirection,
    pagePositions,
    pageWidth,
    selectedReusableFrameId,
  ]);

  // ADR-111 P3-δ fix #3 (D4=A, 2026-04-28): frame body 의 layout publish input.
  // page-centric `layoutPublisherInputs` 와 분리 — `buildFrameRendererInput`
  // 신규 함수 사용 (P3-α/β/γ/δ 의 domain 분리 일관 패턴).
  // frame authoring 은 현재 page 와 같은 작업면을 전환해서 쓰므로, stale
  // framePositions 대신 정규화된 frameAreas 좌표/크기를 layout publish source 로
  // 사용한다. bodyElement 미발견 시 null → filter 로 제외.
  const frameLayoutPublisherInputs = useMemo(() => {
    return frameAreas
      .map((area) => {
        const input = buildFrameRendererInput({
          dirtyElementIds,
          elementById,
          frameHeight: area.height,
          frameId: area.frameId,
          frameElementScope: frameElementScopes.get(area.frameId) ?? null,
          frameWidth: area.width,
          frameX: area.x,
          frameY: area.y,
          pagePositionVersion: framePositionsVersion,
          panOffset,
          sceneSnapshot,
          wasmLayoutReady,
          zoom,
        });
        return input ? { pageId: area.frameId, input } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [
    frameAreas,
    framePositionsVersion,
    dirtyElementIds,
    elementById,
    frameElementScopes,
    panOffset,
    sceneSnapshot,
    wasmLayoutReady,
    zoom,
  ]);

  useLayoutPublisher(
    layoutPublisherInputs,
    frameLayoutPublisherInputs,
    layoutVersion,
  );

  const skiaRendererInput = useMemo(() => {
    return createSkiaRendererInput({
      childrenMap,
      dirtyElementIds,
      editMode: currentEditMode,
      elements,
      elementsMap,
      pageIndex: scenePageIndex,
      pagePositions,
      pagePositionsVersion,
      pages,
      sceneSnapshot,
      framePositions,
      framePositionsVersion,
      frameAreas,
      frameElementScopes,
    });
  }, [
    childrenMap,
    currentEditMode,
    dirtyElementIds,
    elements,
    elementsMap,
    scenePageIndex,
    pagePositions,
    pagePositionsVersion,
    pages,
    sceneSnapshot,
    framePositions,
    framePositionsVersion,
    frameAreas,
    frameElementScopes,
  ]);

  const interactiveElementsMapRef = useRef(skiaRendererInput.elementsMap);
  const interactiveChildrenMapRef = useRef(skiaRendererInput.childrenMap);

  useEffect(() => {
    interactiveElementsMapRef.current = skiaRendererInput.elementsMap;
    interactiveChildrenMapRef.current = skiaRendererInput.childrenMap;
  }, [skiaRendererInput.childrenMap, skiaRendererInput.elementsMap]);

  const getInteractiveElementsMap = useCallback(
    () => interactiveElementsMapRef.current,
    [],
  );
  const getInteractiveChildrenMap = useCallback(
    () => interactiveChildrenMapRef.current,
    [],
  );

  const screenToCanvasPoint = useCallback(
    (position: { x: number; y: number }) => {
      return screenToViewportPoint(position, zoom, panOffset);
    },
    [panOffset, zoom],
  );
  const closeCanvasContextMenu = useCallback(() => {
    setCanvasContextMenu(null);
  }, []);

  useEffect(() => {
    if (!canvasContextMenu) return;

    window.addEventListener("pointerdown", closeCanvasContextMenu);
    return () => {
      window.removeEventListener("pointerdown", closeCanvasContextMenu);
    };
  }, [canvasContextMenu, closeCanvasContextMenu]);

  useKeyboardShortcutsRegistry(
    [
      {
        key: "Escape",
        modifier: "none",
        handler: closeCanvasContextMenu,
        preventDefault: false,
        disabled: !canvasContextMenu,
        category: "canvas",
        description: "Close canvas context menu",
      },
    ],
    [canvasContextMenu, closeCanvasContextMenu],
  );

  const handleCanvasContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const element = containerRef.current;
      if (!element) return;

      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"]')) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const canvasPoint = screenToCanvasPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      const state = useStore.getState();
      const hitElementsMap = getInteractiveElementsMap();
      const hitChildrenMap = getInteractiveChildrenMap();
      const elementId = resolveCanvasDetachContextTarget(
        hitTestPoint(canvasPoint.x, canvasPoint.y),
        hitElementsMap,
        hitChildrenMap,
      );

      if (!elementId) {
        setCanvasContextMenu(null);
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const hitElement = hitElementsMap.get(elementId);
      if (hitElement?.page_id && hitElement.page_id !== state.currentPageId) {
        selectElementWithPageTransition(elementId, hitElement.page_id);
      } else {
        setSelectedElement(elementId);
      }

      setCanvasContextMenu({
        elementId,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [
      getInteractiveChildrenMap,
      getInteractiveElementsMap,
      screenToCanvasPoint,
      selectElementWithPageTransition,
      setSelectedElement,
    ],
  );

  const handleDetachCanvasContextMenuInstance = useCallback(async () => {
    const elementId = canvasContextMenu?.elementId;
    if (!elementId) return;
    setCanvasContextMenu(null);

    const element = elements.find((candidate) => candidate.id === elementId);
    const confirmed = await requestEditingSemanticsDetachConfirmation({
      instanceId: elementId,
      instanceLabel:
        element?.componentName ??
        element?.customId ??
        element?.type ??
        elementId,
    });
    if (!confirmed) return;

    detachInstance(elementId);
  }, [canvasContextMenu?.elementId, detachInstance, elements]);

  // ADR-074 Phase 3: packet 을 scene(selection-invariant) / overlay(selection deps)
  // 로 분리. selection-only 변화 시 scenePacket identity 유지 → 하위 useMemo 중
  // scene 부분만 소비하는 곳(현재는 SkiaCanvas 내부 signature 비교) 은 재평가 없음.
  // 합성 rendererInvalidationPacket 는 기존 SkiaCanvas prop 호환용 유지.
  const sceneInvalidationPacket = useMemo(() => {
    return createSceneInvalidationPacket({
      grid: {
        gridSize,
        showGrid,
      },
      workflow: {
        dataSourceEdges,
        focusedPageId: workflowFocusedPageId,
        layoutGroups,
        layouts,
        showDataSources: showWorkflowDataSources,
        showEvents: showWorkflowEvents,
        showLayoutGroups: showWorkflowLayoutGroups,
        showNavigation: showWorkflowNavigation,
        showOverlay: showWorkflowOverlay,
        straightEdges: workflowStraightEdges,
        workflowEdges,
      },
    });
  }, [
    dataSourceEdges,
    gridSize,
    layoutGroups,
    layouts,
    showGrid,
    showWorkflowDataSources,
    showWorkflowEvents,
    showWorkflowLayoutGroups,
    showWorkflowNavigation,
    showWorkflowOverlay,
    workflowEdges,
    workflowFocusedPageId,
    workflowStraightEdges,
  ]);

  // ADR-074 Phase 4: overlayInvalidationPacket + 합성 rendererInvalidationPacket
  // useMemo 제거. overlay 는 SkiaCanvas 내부에서 자체 구독/생성.
  // SkiaCanvasLazy 에 sceneInvalidationPacket 만 전달.

  // ============================================
  // Pencil-style 중앙 pointerdown 핸들러
  // ============================================
  const lastClickTimeRef = useRef(0);
  const lastClickTargetRef = useRef<string | null>(null);

  // SelectionLayer의 selectionBounds를 ref로 저장 (중앙 핸들러에서 접근)
  const selectionBoundsRef = useRef<BoundingBox | null>(null);

  // ADR-049: drop indicator snapshot ref (SelectionLayer ↔ SkiaOverlay 공유)
  const dropIndicatorSnapshotRef = useRef<DropIndicatorSnapshot | null>(null);

  // ADR-043 Phase 1: drag 콜백 refs (SelectionLayer → useCentralCanvasPointerHandlers 연결)
  const onStartMoveRef = useRef<
    (
      elementId: string,
      bounds: BoundingBox,
      position: { x: number; y: number },
    ) => void
  >(() => {});
  const onUpdateDragRef = useRef<(position: { x: number; y: number }) => void>(
    () => {},
  );
  const onEndDragRef = useRef<() => void>(() => {});
  const onCancelDragRef = useRef<() => void>(() => {});

  useDragBridge({
    onStartMoveRef,
    onUpdateDragRef,
    onEndDragRef,
    onCancelDragRef,
    dropIndicatorSnapshotRef,
    getInteractiveElementsMap,
    getInteractiveChildrenMap,
    enabled: isUnifiedFlag("UNIFIED_ENGINE"),
  });

  const computeSelectionBoundsForHitTest = useCallback(() => {
    const state = useStore.getState();
    const selectedElements = resolveSelectedElementsForPage({
      currentPageId: state.currentPageId,
      elementsMap: interactiveElementsMapRef.current,
      selectedElementIds: state.selectedElementIds,
    });

    return computeSelectionBounds({
      frameAreas,
      getBounds: getElementBoundsSimple,
      pageHeight,
      pagePositions,
      pageWidth,
      panOffset,
      selectedElements,
      zoom,
    });
  }, [frameAreas, pageWidth, pageHeight, zoom, panOffset, pagePositions]);

  // selectionBounds를 프레임마다 갱신하지 않고, pointerdown 시점에 계산
  // (RAF 지연 없이 즉시)

  // Pencil-style: 커서 변경 유틸
  const setCursor = useCallback((cursor: string) => {
    if (containerRef.current) {
      containerRef.current.style.cursor = cursor;
    }
  }, []);

  // ============================================
  // Pencil-style 중앙 DOM 이벤트 핸들러
  // ============================================

  // Ref로 최신 핸들러 유지 (TDZ 방지 + deps 배열에서 제거 → 리스너 재등록 최소화)
  const handleElementClickRef = useRef<
    (
      elementId: string,
      modifiers?: { metaKey: boolean; shiftKey: boolean; ctrlKey: boolean },
    ) => void
  >(() => {});
  const handleElementDoubleClickRef = useRef<(elementId: string) => void>(
    () => {},
  );
  // 텍스트 편집 상태를 handleCentralPointerDown에서 참조하기 위한 ref
  // (useTextEdit()보다 앞에 정의되므로 closure로 접근 불가 → ref 필요)
  const isEditingRef = useRef(false);
  const completeEditRef = useRef<(elementId: string) => void>(() => {});
  const editingElementIdRef = useRef<string | null>(null);

  // Page title drag hit-test (capture phase).
  // Capture 단계에서 먼저 발화하므로 useCentralCanvasPointerHandlers 보다 우선.
  // hit 이면 event.__handled = true 로 중앙 핸들러가 early-return 하도록 막는다.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const onPointerDownCapture = (event: PointerEvent) => {
      if (isFrameEditMode) return;
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"]')) return;

      const rect = element.getBoundingClientRect();
      const scenePoint = screenToCanvasPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });

      for (const bounds of pageTitleBoundsMapRef.current.values()) {
        if (
          scenePoint.x >= bounds.sceneX &&
          scenePoint.x <= bounds.sceneX + bounds.sceneWidth &&
          scenePoint.y >= bounds.sceneY &&
          scenePoint.y <= bounds.sceneY + bounds.sceneHeight
        ) {
          (event as PointerEvent & { __handled?: boolean }).__handled = true;
          startPageDrag(bounds.pageId, event.clientX, event.clientY);
          return;
        }
      }
    };

    element.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => {
      element.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  }, [isFrameEditMode, screenToCanvasPoint, startPageDrag]);

  useCentralCanvasPointerHandlers({
    completeEditRef,
    computeSelectionBoundsForHitTest,
    containerRef,
    editingElementIdRef,
    handleElementClickRef,
    handleElementDoubleClickRef,
    frameAreas,
    getHitChildrenMap: getInteractiveChildrenMap,
    getHitElementsMap: getInteractiveElementsMap,
    isEditingRef,
    lastClickTargetRef,
    lastClickTimeRef,
    onCancelDrag: onCancelDragRef,
    onStartMove: onStartMoveRef,
    onUpdateDrag: onUpdateDragRef,
    onEndDrag: onEndDragRef,
    pageSelectionEnabled: !isFrameEditMode,
    pageHeight,
    pageWidth,
    screenToCanvasPoint,
    selectionBoundsRef,
    selectElementWithPageTransition,
    setCurrentPageId,
    setCursor,
    setSelectedElements,
    zoom,
  });

  // 텍스트 편집 (B1.5)
  const {
    editState,
    startEdit,
    updateText,
    completeEdit,
    cancelEdit,
    isEditing,
  } = useTextEdit();

  // 편집 상태 ref 동기화 (handleCentralPointerDown에서 참조)
  useEffect(() => {
    isEditingRef.current = isEditing;
    completeEditRef.current = completeEdit;
    editingElementIdRef.current = editState?.elementId ?? null;
  }, [completeEdit, editState?.elementId, isEditing]);

  // Element click handler with multi-select support
  // 🚀 최적화: selectedElementIds를 deps에서 제거하고 getState()로 읽어서
  // 선택 변경 시 handleElementClick 재생성 방지 → 모든 ElementSprite 리렌더링 방지
  // 🚀 Phase 18: startTransition으로 선택 업데이트 → INP 개선 (245ms → ~50ms)
  const { handleElementClick, handleElementDoubleClick } =
    useCanvasElementSelectionHandlers({
      clearSelection,
      isEditing,
      selectElementWithPageTransition,
      setCurrentPageId,
      setSelectedElement,
      setSelectedElements,
      startEdit,
      getInteractiveChildrenMap,
      getInteractiveElementsMap,
    });

  // Ref 동기화: 최신 핸들러를 ref에 할당 (중앙 DOM 이벤트 핸들러에서 사용)
  useEffect(() => {
    handleElementClickRef.current = handleElementClick;
    handleElementDoubleClickRef.current = handleElementDoubleClick;
  }, [handleElementClick, handleElementDoubleClick]);

  useCanvasSurfaceLifecycle({
    appReady,
    containerRef,
    renderVersion,
    setCanvasReady,
    setContextLost,
    syncPixiVersion,
  });

  return (
    <div
      ref={setContainerNode}
      className="canvas-container"
      tabIndex={-1}
      onContextMenu={handleCanvasContextMenu}
      onPointerDown={(e) => {
        // 캔버스 영역 클릭 시 컨테이너에 포커스 → activeScope가 'canvas-focused'로 전환
        // Backspace/Delete 등 캔버스 스코프 단축키 활성화
        const target = e.target as HTMLElement;
        if (!target.closest('input, textarea, [contenteditable="true"]')) {
          containerRef.current?.focus();
        }
      }}
    >
      {/* ADR-006 P1-2: WASM 로드 실패 배너 */}
      {wasmLayoutFailed && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "12px 16px",
            backgroundColor: "#FEF2F2",
            borderBottom: "1px solid #FECACA",
            color: "#991B1B",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 9999,
            fontSize: "14px",
          }}
        >
          <span>레이아웃 엔진 로드에 실패했습니다.</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "4px 12px",
              backgroundColor: "#DC2626",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            새로고침
          </button>
        </div>
      )}
      {containerEl && (
        <SkiaCanvasLazy
          containerEl={containerEl}
          invalidateLayout={invalidateLayout}
          sceneInvalidationPacket={sceneInvalidationPacket}
          rendererInput={skiaRendererInput}
          dropIndicatorSnapshotRef={dropIndicatorSnapshotRef}
          pageTitleBoundsMapRef={pageTitleBoundsMapRef}
        />
      )}

      {/* ADR-902: Skia canvas 뒤 도트 배경 레이어 (P0에서 투명 clear 전제) */}
      <DotBackground />

      {containerEl && (
        <ViewportControlBridge
          containerEl={containerEl}
          cameraLabel="Camera"
          minZoom={0.1}
          maxZoom={5}
          app={null}
          initialPanOffsetX={initialPanOffsetX}
        />
      )}

      <GPUDebugOverlay />

      {canvasContextMenu && (
        <div
          aria-label="Canvas context menu"
          className="canvas-context-menu"
          role="menu"
          style={{
            left: `${canvasContextMenu.x}px`,
            top: `${canvasContextMenu.y}px`,
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            className="canvas-context-menu-item"
            onClick={handleDetachCanvasContextMenuInstance}
            role="menuitem"
            type="button"
          >
            Detach instance
          </button>
        </div>
      )}

      {/* 텍스트 편집 오버레이 (B1.5) */}
      {editState && editState.elementId && (
        <TextEditOverlay
          elementId={editState.elementId}
          initialValue={editState.value}
          position={editState.position}
          size={editState.size}
          zoom={zoom}
          panOffset={panOffset}
          style={editState.style}
          onChange={updateText}
          onComplete={completeEdit}
          onCancel={cancelEdit}
        />
      )}
    </div>
  );
}

// ============================================
// Feature Flag Wrapper
// ============================================

/**
 * Feature Flag에 따라 WebGL 또는 기존 iframe 캔버스 반환
 */
export function BuilderCanvasWithFlag(props: BuilderCanvasProps) {
  const useWebGL = isWebGLCanvas();

  if (!useWebGL) {
    // 기존 iframe Canvas (Fallback)
    return null; // BuilderCore에서 기존 iframe 렌더링
  }

  return <BuilderCanvas {...props} />;
}

export default BuilderCanvas;
