/**
 * Skia Frame Plan Builder (ADR-035 Phase 4)
 *
 * SkiaOverlay renderFrame()에서 사용하는 프레임 입력/오버레이 조립을
 * 별도 모듈로 추출한다. 동작 변경 없이 orchestration 책임만 이동한다.
 */

import type { CanvasKit, FontMgr, Canvas } from "canvaskit-wasm";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { BoundingBox } from "../selection/types";
import type { RendererInvalidationPacket } from "../renderers";
import type {
  AIEffectNodeBounds,
  SharedSceneDerivedData,
  FrameInputSnapshot,
  FrameRenderPlan,
  SelectionOverlayBuildResult,
  WorkflowOverlayBuildResult,
  SkiaRenderable,
} from "./types";
import type { PageFrame } from "./workflowRenderer";
import type { CachedEdgeGeometry } from "./workflowHitTest";
import type { WorkflowHoverState } from "../hooks/useWorkflowInteraction";
import type { ElementHoverState } from "../hooks/useElementHoverInteraction";
import type { DropIndicatorState } from "./dropIndicatorRenderer";
import type { FrameAreaGroup } from "./workflowEdges";
import { renderGrid } from "./gridRenderer";
import { buildGridRenderInput } from "./skiaOverlayHelpers";
import { buildSelectionRenderData } from "./skiaWorkflowSelection";
import {
  buildWorkflowOverlayData,
  buildFrameCaches,
  buildOverlayNode,
} from "./skiaOverlayBuilder";
import type { PageTitleBounds } from "./skiaOverlayHelpers";

export interface CreateFrameInputOptions {
  registryVersion: number;
  pagePosVersion: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  overlayVersion: number;
}

export function createFrameInputSnapshot(
  input: CreateFrameInputOptions,
): FrameInputSnapshot {
  return {
    registryVersion: input.registryVersion,
    pagePosVersion: input.pagePosVersion,
    cameraX: input.cameraX,
    cameraY: input.cameraY,
    cameraZoom: input.cameraZoom,
    overlayVersion: input.overlayVersion,
  };
}

export interface BuildFrameRenderPlanInput {
  ck: CanvasKit;
  fontMgr: FontMgr | undefined;
  snapshot: FrameInputSnapshot;
  sharedScene: SharedSceneDerivedData;
  nodeBoundsMap: Map<string, AIEffectNodeBounds> | null;
  hasAIEffects: boolean;
  contentNode: SkiaRenderable;
  elementsMap: Map<string, CanvasSceneNode>;
  invalidationPacket: RendererInvalidationPacket;
  allPageFrames?: Array<{
    id: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    elementCount: number;
  }>;
  visiblePageFrames?: Array<{
    id: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    elementCount: number;
  }>;
  frameAreas?: FrameAreaGroup[];
  /**
   * 페이지 타이틀 drag hit-test 용 scene 좌표 bounds 누적 맵.
   * BuilderCanvas 가 ref 로 주입하며 render pass 가 매 프레임 갱신한다.
   */
  pageTitleBoundsMap?: Map<string, PageTitleBounds>;
  workflowHoverState: WorkflowHoverState;
  elementHoverState: ElementHoverState;
  dropIndicatorState: DropIndicatorState | null;
  minimapVisible: boolean;
  minimapConfig: import("./workflowMinimap").MinimapConfig;
  skiaCanvasWidth: number;
  skiaCanvasHeight: number;
  dpr: number;
  prevEdgeGeometryCache: CachedEdgeGeometry[];
  prevEdgeGeometryCacheKey: string;
}

export function buildFrameRenderPlan(
  input: BuildFrameRenderPlanInput,
): FrameRenderPlan {
  const {
    ck,
    fontMgr,
    snapshot,
    sharedScene,
    nodeBoundsMap,
    hasAIEffects,
    contentNode,
    elementsMap,
    invalidationPacket,
    allPageFrames,
    visiblePageFrames,
    frameAreas,
    pageTitleBoundsMap,
    workflowHoverState,
    elementHoverState,
    dropIndicatorState,
    minimapVisible,
    minimapConfig,
    skiaCanvasWidth,
    skiaCanvasHeight,
    dpr,
    prevEdgeGeometryCache,
    prevEdgeGeometryCacheKey,
  } = input;

  const selection = buildSelectionOverlayData(
    snapshot,
    sharedScene,
    invalidationPacket,
    elementsMap,
    visiblePageFrames,
  );

  const workflow = invalidationPacket.workflow.showOverlay
    ? buildWorkflowOverlayBuildResult({
        treeBoundsMap: sharedScene.treeBoundsMap,
        pageFrames: allPageFrames ?? [],
        workflowEdges: invalidationPacket.workflow.workflowEdges,
        workflowGraphSignature: invalidationPacket.workflow.graphSignature,
        pagePosVersion: snapshot.pagePosVersion,
        workflowStraightEdges: invalidationPacket.workflow.straightEdges,
        prevEdgeGeometryCache,
        prevEdgeGeometryCacheKey,
      })
    : null;

  const overlayNode = buildOverlayNode({
    ck,
    fontMgr,
    treeBoundsMap: sharedScene.treeBoundsMap,
    cameraX: snapshot.cameraX,
    cameraY: snapshot.cameraY,
    cameraZoom: snapshot.cameraZoom,
    hasAIEffects,
    nodeBoundsMap,
    selectionData: selection,
    invalidationPacket,
    pageFrameMap: workflow?.pageFrameMap ?? new Map<string, PageFrame>(),
    workflowElementBoundsMap: workflow?.workflowElementBoundsMap ?? null,
    workflowHoveredEdgeId: workflowHoverState.hoveredEdgeId,
    elementHoverState,
    elementsMap,
    childrenMap: sharedScene.childrenMap,
    overflowInfoMap: sharedScene.overflowInfoMap,
    dropIndicatorState,
    visiblePageFrames,
    frameAreas,
    pageTitleBoundsMap,
    minimapVisible,
    minimapConfig,
    skiaCanvasWidth,
    skiaCanvasHeight,
    dpr,
  });

  const screenOverlayNode = buildGridScreenOverlayNode(
    ck,
    snapshot.cameraZoom,
    invalidationPacket.grid.showGrid,
    invalidationPacket.grid.gridSize,
  );

  return {
    sharedScene,
    contentNode,
    overlayNode,
    screenOverlayNode,
    cullingBounds: createCullingBounds(
      snapshot.cameraX,
      snapshot.cameraY,
      snapshot.cameraZoom,
      skiaCanvasWidth,
      skiaCanvasHeight,
      dpr,
    ),
    selection,
    workflow,
  };
}

export function buildSelectionOverlayData(
  snapshot: FrameInputSnapshot,
  sharedScene: SharedSceneDerivedData,
  invalidationPacket: RendererInvalidationPacket,
  elementsMap: Map<string, CanvasSceneNode>,
  pageFrames?: Array<{
    id: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    elementCount: number;
  }>,
): SelectionOverlayBuildResult {
  return buildSelectionRenderData(
    sharedScene.cameraX,
    sharedScene.cameraY,
    sharedScene.cameraZoom,
    sharedScene.treeBoundsMap,
    invalidationPacket.selection,
    elementsMap,
    pageFrames,
  );
}

interface BuildWorkflowOverlayBuildResultInput {
  treeBoundsMap: Map<string, BoundingBox>;
  pageFrames: Array<{
    id: string;
    title?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    elementCount?: number;
  }>;
  workflowEdges: RendererInvalidationPacket["workflow"]["workflowEdges"];
  workflowGraphSignature: string;
  pagePosVersion: number;
  workflowStraightEdges: boolean;
  prevEdgeGeometryCache: CachedEdgeGeometry[];
  prevEdgeGeometryCacheKey: string;
}

function buildWorkflowOverlayBuildResult(
  input: BuildWorkflowOverlayBuildResultInput,
): WorkflowOverlayBuildResult {
  const wfData = buildWorkflowOverlayData(
    input.treeBoundsMap,
    input.pageFrames,
  );
  const cacheResult = buildFrameCaches(
    input.workflowEdges,
    wfData.pageFrameMap,
    wfData.workflowElementBoundsMap,
    input.workflowGraphSignature,
    input.pagePosVersion,
    input.workflowStraightEdges,
    input.prevEdgeGeometryCacheKey,
    input.prevEdgeGeometryCache,
  );

  return {
    pageFrameMap: wfData.pageFrameMap,
    workflowElementBoundsMap: wfData.workflowElementBoundsMap,
    edgeGeometryCache: cacheResult.edgeGeometryCache,
    edgeGeometryCacheKey: cacheResult.edgeGeometryCacheKey,
  };
}

function buildGridScreenOverlayNode(
  ck: CanvasKit,
  cameraZoom: number,
  showGrid: boolean,
  gridSize: number,
): SkiaRenderable | null {
  if (!showGrid) {
    return null;
  }

  return {
    renderSkia(canvas: Canvas, cullingBounds: DOMRect) {
      renderGrid(
        ck,
        canvas,
        buildGridRenderInput(cullingBounds, gridSize, cameraZoom),
      );
    },
  };
}

function createCullingBounds(
  cameraX: number,
  cameraY: number,
  cameraZoom: number,
  skiaCanvasWidth: number,
  skiaCanvasHeight: number,
  dpr: number,
): DOMRect {
  const screenW = skiaCanvasWidth / dpr;
  const screenH = skiaCanvasHeight / dpr;
  return new DOMRect(
    -cameraX / cameraZoom,
    -cameraY / cameraZoom,
    screenW / cameraZoom,
    screenH / cameraZoom,
  );
}
