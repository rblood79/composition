/**
 * Skia Overlay Build Pipeline (ADR-035 Phase 4)
 *
 * SkiaOverlay의 renderFrame() 내부에서 overlay node를 빌드하는
 * 로직을 독립 모듈로 추출.
 *
 * - buildWorkflowOverlayData(): 워크플로우 관련 데이터 사전 준비
 * - buildFrameCaches(): 엣지 지오메트리 캐시 관리
 * - buildOverlayNode(): overlay SkiaRenderable 생성
 */

import type { CanvasKit, Canvas, FontMgr } from "canvaskit-wasm";
import type { Element } from "../../../../types/core/store.types";
import type { BoundingBox } from "../selection/types";
import type { RendererInvalidationPacket } from "../renderers";
import type { AIEffectNodeBounds, SkiaRenderable } from "./types";
import type { FrameAreaGroup, WorkflowEdge } from "./workflowEdges";
import type { PageFrame, ElementBounds } from "./workflowRenderer";
import type { CachedEdgeGeometry } from "./workflowHitTest";
import type { SelectionRenderResult } from "./skiaWorkflowSelection";
import type { ElementHoverState } from "../hooks/useElementHoverInteraction";
import { getFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import {
  renderDropIndicator,
  type DropIndicatorState,
} from "./dropIndicatorRenderer";
import { renderGeneratingEffects, renderFlashes } from "./aiEffects";
import {
  renderSelectionBox,
  renderTransformHandles,
  renderDimensionLabels,
  renderLasso,
  renderPageTitle,
} from "./selectionRenderer";
import { renderSlotHatchPattern } from "./slotMarkerRenderer";
import {
  renderWorkflowEdges,
  renderDataSourceEdges,
  renderLayoutGroups,
  renderPageFrameHighlight,
} from "./workflowRenderer";
import {
  renderHoverHighlight,
  renderEditingContextBorder,
  renderOverflowContent,
  renderOverflowHatching,
} from "./hoverRenderer";
import { OVERLAY_BLUE_RGB } from "./semanticOverlayColors";
import { renderWorkflowMinimap, type MinimapConfig } from "./workflowMinimap";
import {
  buildPageFrameMap,
  getCachedChildOverflowContextMap,
  type OverflowContentInfo,
} from "./skiaFrameHelpers";
import { buildEdgeGeometryCache } from "./workflowHitTest";
import { buildWorkflowElementBounds } from "./skiaFramePipeline";
import {
  buildHoverHighlightTargets,
  buildFrameTitleRenderItems,
  buildMinimapConfig,
  buildMinimapRenderData,
  buildMinimapViewportBounds,
  buildPageTitleRenderItems,
  buildSlotMarkerTargets,
  shouldRenderWorkflowMinimap,
  type PageTitleBounds,
} from "./skiaOverlayHelpers";
import {
  buildWorkflowHighlightState,
  collectHighlightedWorkflowPageIds,
  filterRenderableWorkflowEdges,
} from "./skiaWorkflowSelection";

// ============================================
// Workflow Overlay Data
// ============================================

export interface WorkflowOverlayData {
  pageFrameMap: Map<string, PageFrame>;
  workflowElementBoundsMap: Map<string, ElementBounds> | null;
}

/**
 * 워크플로우 오버레이에 필요한 데이터를 사전 빌드한다.
 * renderSkia 콜백 이전에 호출하여 히트테스트 캐시 등을 준비한다.
 */
export function buildWorkflowOverlayData(
  treeBoundsMap: Map<string, BoundingBox>,
  pageFrames: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
): WorkflowOverlayData {
  const pfMap = buildPageFrameMap(pageFrames);
  const workflowElementBoundsMap = buildWorkflowElementBounds(treeBoundsMap);
  return { pageFrameMap: pfMap, workflowElementBoundsMap };
}

// ============================================
// Frame Caches
// ============================================

export interface FrameCacheState {
  edgeGeometryCache: CachedEdgeGeometry[];
  edgeGeometryCacheKey: string;
}

/**
 * 엣지 지오메트리 캐시를 버전 기반으로 갱신한다.
 * 변경이 없으면 이전 캐시를 그대로 반환한다.
 */
export function buildFrameCaches(
  workflowEdges: WorkflowEdge[],
  pageFrameMap: Map<string, PageFrame>,
  workflowElementBoundsMap: Map<string, ElementBounds> | null,
  workflowGraphSignature: string,
  pagePosVersion: number,
  workflowStraightEdges: boolean,
  prevCacheKey: string,
  prevCache: CachedEdgeGeometry[],
): FrameCacheState {
  if (workflowEdges.length === 0) {
    return { edgeGeometryCache: [], edgeGeometryCacheKey: "" };
  }

  const cacheKey = `${workflowGraphSignature}:${pagePosVersion}:${workflowStraightEdges}`;
  if (cacheKey === prevCacheKey) {
    return { edgeGeometryCache: prevCache, edgeGeometryCacheKey: prevCacheKey };
  }

  const cache = buildEdgeGeometryCache(
    workflowEdges,
    pageFrameMap,
    workflowElementBoundsMap ?? new Map(),
    workflowStraightEdges,
  );
  return { edgeGeometryCache: cache, edgeGeometryCacheKey: cacheKey };
}

// ============================================
// Overlay Node Builder
// ============================================

export interface OverlayBuildInput {
  ck: CanvasKit;
  fontMgr: FontMgr | undefined;
  treeBoundsMap: Map<string, BoundingBox>;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  // AI
  hasAIEffects: boolean;
  nodeBoundsMap: Map<string, AIEffectNodeBounds> | null;
  // Selection
  selectionData: SelectionRenderResult;
  invalidationPacket: RendererInvalidationPacket;
  // Workflow
  pageFrameMap: Map<string, PageFrame>;
  workflowElementBoundsMap: Map<string, ElementBounds> | null;
  workflowHoveredEdgeId: string | null;
  // Hover
  elementHoverState: ElementHoverState;
  elementsMap: Map<string, Element>;
  childrenMap: Map<string, Element[]>;
  // Overflow (Figma-style content outline)
  overflowInfoMap?: Map<string, OverflowContentInfo>;
  // Drop Indicator (드래그 중 타겟 표시)
  dropIndicatorState: DropIndicatorState | null;
  // Visible page frames (page title/selection 계층)
  visiblePageFrames?: Array<{
    id: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    elementCount: number;
  }>;
  /** Frames 탭 multi-canvas overview 용 frame title 렌더 입력. */
  frameAreas?: FrameAreaGroup[];
  /**
   * 페이지 타이틀 drag hit-test 를 위한 scene 좌표 bounds 저장소.
   * renderSkia 호출마다 clear 후 실제 렌더된 title 의 bounds 를 populate 한다.
   * BuilderCanvas pointerdown 핸들러가 pageId 를 조회하여 usePageDrag 를 트리거.
   */
  pageTitleBoundsMap?: Map<string, PageTitleBounds>;
  // Minimap
  minimapVisible: boolean;
  minimapConfig: MinimapConfig;
  skiaCanvasWidth: number;
  skiaCanvasHeight: number;
  dpr: number;
}

function resolveSelectedFrameIdForTitle(
  selectedElementIds: string[],
  elementsMap: Map<string, Element>,
): string | null {
  for (const elementId of selectedElementIds) {
    const element = elementsMap.get(elementId);
    const layoutId = element ? getFrameElementMirrorId(element) : null;
    if (element?.page_id == null && layoutId) {
      return layoutId;
    }
  }

  return null;
}

/**
 * 오버레이 SkiaRenderable을 빌드한다.
 * AI 이펙트, 페이지 타이틀, 워크플로우, 호버, 선택, 미니맵을
 * 하나의 overlay node로 합성한다.
 */
export function buildOverlayNode(input: OverlayBuildInput): SkiaRenderable {
  const {
    ck,
    fontMgr,
    treeBoundsMap,
    cameraZoom,
    cameraX,
    cameraY,
    hasAIEffects,
    nodeBoundsMap,
    selectionData,
    invalidationPacket,
    pageFrameMap,
    workflowElementBoundsMap,
    workflowHoveredEdgeId,
    elementHoverState,
    elementsMap,
    childrenMap,
    overflowInfoMap,
    dropIndicatorState,
    visiblePageFrames,
    frameAreas,
    pageTitleBoundsMap,
    minimapVisible,
    skiaCanvasWidth,
    skiaCanvasHeight,
    dpr,
  } = input;

  const { ai, selection, workflow } = invalidationPacket;

  return {
    renderSkia(canvas: Canvas) {
      // ── AI Effects ──
      if (hasAIEffects && nodeBoundsMap) {
        const now = performance.now();
        renderGeneratingEffects(
          ck,
          canvas,
          now,
          ai.generatingNodes,
          nodeBoundsMap,
        );
        renderFlashes(ck, canvas, now, ai.flashAnimations, nodeBoundsMap);
        if (ai.flashAnimations.size > 0) {
          ai.cleanupExpiredFlashes(now);
        }
      }

      // ── Page Titles ──
      // bounds Map 은 매 프레임 갱신 — stale pageId (예: 페이지 삭제 후) 가 남지 않도록 clear.
      if (pageTitleBoundsMap) pageTitleBoundsMap.clear();
      const frames = visiblePageFrames ?? [];
      if (frames.length > 0) {
        const pageTitleItems = buildPageTitleRenderItems(
          frames,
          selection.currentPageId,
          selection.selectedElementIds.length > 0,
        );
        const invZoom = cameraZoom === 0 ? 1 : 1 / cameraZoom;
        // PAGE_TITLE_OFFSET_Y / FONT_SIZE 는 selectionRenderer.ts 상수와 동일하게 유지.
        // drag hit-test 박스는 실제 그려지는 text glyph 보다 약간 넉넉하게 잡아
        // 사용자가 베이스라인 위/아래 포인터-다운도 타이틀로 인식하도록 한다.
        const TITLE_OFFSET_Y = 20;
        const TITLE_FONT_SIZE = 12;
        const HIT_PAD_X = 6;
        const HIT_PAD_Y = 4;
        for (const item of pageTitleItems) {
          canvas.save();
          canvas.translate(item.x, item.y);
          const measured = renderPageTitle(
            ck,
            canvas,
            item.title,
            cameraZoom,
            fontMgr,
            item.highlighted,
          );
          canvas.restore();

          if (pageTitleBoundsMap && measured) {
            const sceneTextTop =
              item.y - TITLE_OFFSET_Y * invZoom - HIT_PAD_Y * invZoom;
            const sceneTextHeight = (TITLE_FONT_SIZE + HIT_PAD_Y * 2) * invZoom;
            const sceneTextWidth =
              (measured.titleWidth + HIT_PAD_X * 2) * invZoom;
            pageTitleBoundsMap.set(item.pageId, {
              pageId: item.pageId,
              sceneX: item.x - HIT_PAD_X * invZoom,
              sceneY: sceneTextTop,
              sceneWidth: sceneTextWidth,
              sceneHeight: sceneTextHeight,
            });
          }
        }
      }

      // ── Frame Titles ──
      // Page title 과 동일한 Pencil-style label 을 재사용하되, page drag hit-test
      // map 에는 등록하지 않는다. Frame title 은 현재 시점에서 시각 chrome 이며
      // Page title drag 동작과 섞이면 안 된다.
      const frameTitleItems = buildFrameTitleRenderItems(
        frameAreas ?? [],
        resolveSelectedFrameIdForTitle(
          selection.selectedElementIds,
          elementsMap,
        ),
      );
      for (const item of frameTitleItems) {
        canvas.save();
        canvas.translate(item.x, item.y);
        renderPageTitle(
          ck,
          canvas,
          item.title,
          cameraZoom,
          fontMgr,
          item.highlighted,
        );
        canvas.restore();
      }

      // ── Workflow Overlay ──
      if (workflow.showOverlay) {
        const elBoundsMap = workflowElementBoundsMap ?? new Map();
        const showNav = workflow.showNavigation;
        const showEvents = workflow.showEvents;
        const showDS = workflow.showDataSources;
        const showLG = workflow.showLayoutGroups;
        const focusedPageId = workflow.focusedPageId;
        const highlightState = buildWorkflowHighlightState(
          workflowHoveredEdgeId,
          focusedPageId,
          workflow.workflowEdges,
        );

        // Page frame highlight (엣지 아래에 렌더)
        if (highlightState && focusedPageId) {
          const connectedPageIds = collectHighlightedWorkflowPageIds(
            focusedPageId,
            highlightState,
            workflow.workflowEdges,
          );
          renderPageFrameHighlight(
            ck,
            canvas,
            connectedPageIds,
            pageFrameMap,
            cameraZoom,
            OVERLAY_BLUE_RGB,
            0.8,
          );
        }

        // Layout groups
        if (showLG && workflow.layoutGroups.length > 0) {
          renderLayoutGroups(
            ck,
            canvas,
            workflow.layoutGroups,
            pageFrameMap,
            cameraZoom,
            fontMgr,
          );
        }

        // Navigation/Event edges
        if (workflow.workflowEdges.length > 0 && (showNav || showEvents)) {
          const filteredEdges = filterRenderableWorkflowEdges(
            workflow.workflowEdges,
            showNav,
            showEvents,
          );
          if (filteredEdges.length > 0) {
            renderWorkflowEdges(
              ck,
              canvas,
              filteredEdges,
              pageFrameMap,
              cameraZoom,
              fontMgr,
              elBoundsMap,
              highlightState,
              workflow.straightEdges,
            );
          }
        }

        // Data source edges
        if (showDS && workflow.dataSourceEdges.length > 0) {
          renderDataSourceEdges(
            ck,
            canvas,
            workflow.dataSourceEdges,
            pageFrameMap,
            elBoundsMap,
            cameraZoom,
            fontMgr,
          );
        }
      }

      // ── Slot Markers (Pencil-style authoring chrome) ──
      const slotMarkerTargets = buildSlotMarkerTargets(
        treeBoundsMap,
        elementsMap,
        childrenMap,
      );
      for (const target of slotMarkerTargets) {
        renderSlotHatchPattern(
          ck,
          canvas,
          target.bounds,
          cameraZoom,
          target.slotMarkerRole,
          target.showHatch,
        );
      }

      // ── Editing Context Border ──
      const editingContextId = selection.editingContextId;
      if (editingContextId && treeBoundsMap.has(editingContextId)) {
        const contextBounds = treeBoundsMap.get(editingContextId)!;
        renderEditingContextBorder(ck, canvas, contextBounds, cameraZoom);
      }

      // ── Hover Highlights ──
      // Drag/drop feedback가 활성일 때는 일반 hover overlay를 숨긴다.
      // sibling visual offset으로 실제 위치가 transient하게 바뀌기 때문에,
      // raw bounds 기반 hover와 drop target 표시가 중복 렌더될 수 있다.
      if (!dropIndicatorState) {
        const {
          hoveredElementId: hoveredCtxId,
          hoveredLeafIds,
          isGroupHover,
        } = elementHoverState;
        const hoverTargets = buildHoverHighlightTargets(
          treeBoundsMap,
          hoveredCtxId,
          hoveredLeafIds,
          isGroupHover,
          elementsMap,
        );
        for (const target of hoverTargets) {
          renderHoverHighlight(
            ck,
            canvas,
            target.bounds,
            cameraZoom,
            target.dashed,
            target.semanticRole ?? target.slotMarkerRole,
          );
        }

        // ── Overflow Content (Figma-style) ──
        if (hoveredCtxId && overflowInfoMap) {
          const overflowInfo = overflowInfoMap.get(hoveredCtxId);
          if (overflowInfo) {
            renderOverflowContent(ck, canvas, overflowInfo, cameraZoom);
          }
        }
      }

      // ── Drop Indicator ──
      if (dropIndicatorState) {
        renderDropIndicator(ck, canvas, dropIndicatorState, cameraZoom);
      }

      // ── Selection (드래그 중에는 숨김 — 드래그 요소가 반투명으로 떠있으므로) ──
      if (selectionData.semanticTargets.length > 0 && !dropIndicatorState) {
        for (const target of selectionData.semanticTargets) {
          renderSelectionBox(
            ck,
            canvas,
            target.bounds,
            cameraZoom,
            target.semanticRole ?? target.slotMarkerRole,
          );
        }
      }
      if (selectionData.bounds && !dropIndicatorState) {
        const selectionSemanticRole =
          selectionData.semanticRole ?? selectionData.slotMarkerRole;
        renderSelectionBox(
          ck,
          canvas,
          selectionData.bounds,
          cameraZoom,
          selectionSemanticRole,
        );
        if (selectionData.showHandles) {
          renderTransformHandles(
            ck,
            canvas,
            selectionData.bounds,
            cameraZoom,
            selectionSemanticRole,
          );
        }
        renderDimensionLabels(
          ck,
          canvas,
          selectionData.bounds,
          cameraZoom,
          fontMgr,
          selectionSemanticRole,
        );
      }
      if (selectionData.lasso) {
        renderLasso(ck, canvas, selectionData.lasso, cameraZoom);
      }

      // ── Overflow Hatching (scroll/auto 부모의 자식 선택 시 사선 패턴) ──
      if (overflowInfoMap && selection.selectedElementIds.length > 0) {
        const childCtxMap = getCachedChildOverflowContextMap(overflowInfoMap);
        for (const selId of selection.selectedElementIds) {
          const ctx = childCtxMap.get(selId);
          if (
            ctx &&
            (ctx.overflowType === "scroll" || ctx.overflowType === "auto")
          ) {
            renderOverflowHatching(ck, canvas, ctx, cameraZoom);
          }
        }
      }

      // ── Minimap ──
      const mmScreenW = skiaCanvasWidth / dpr;
      const mmScreenH = skiaCanvasHeight / dpr;
      if (
        shouldRenderWorkflowMinimap(
          workflow.showOverlay,
          minimapVisible,
          pageFrameMap.size,
        )
      ) {
        const mmConfig = buildMinimapConfig(mmScreenW, mmScreenH);
        renderWorkflowMinimap(
          ck,
          canvas,
          buildMinimapRenderData(
            pageFrameMap,
            workflow.workflowEdges,
            workflow.focusedPageId,
            buildMinimapViewportBounds(
              cameraX,
              cameraY,
              cameraZoom,
              mmScreenW,
              mmScreenH,
            ),
          ),
          mmConfig,
          { zoom: cameraZoom, panX: cameraX, panY: cameraY },
          { width: mmScreenW, height: mmScreenH },
          cameraZoom,
        );
      }
    },
  };
}
