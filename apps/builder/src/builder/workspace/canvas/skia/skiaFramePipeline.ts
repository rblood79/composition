/**
 * Skia Frame Build Pipeline (ADR-035 Phase 4)
 *
 * SkiaOverlay의 renderFrame() 내부에서 매 프레임 실행되는
 * content build 로직을 독립 모듈로 추출.
 *
 * 빌드 경로는 Command Stream 단일: elementsMap + layoutMap → RenderCommand[].
 * (구 Tree 경로 — PixiJS 씬 그래프 DFS — 는 ADR-900 으로 PixiJS 가 제거되며
 * cameraContainer 생산자가 null 고정이 되어 도달 불가로 남았다가 2026-08-14
 * simplify 에서 제거됨. layout publish 전에는 null 을 반환해 빈 프레임.)
 *
 * 공용 산출물(treeBoundsMap)을 1회 생성하여
 * selection/workflow/AI overlay가 재사용한다.
 */

import type { CanvasKit, FontMgr } from "canvaskit-wasm";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { RendererAIInvalidation, SkiaRendererInput } from "../renderers";
import type { BoundingBox } from "../selection/types";
import type {
  AIEffectNodeBounds,
  SkiaRenderable,
  ContentBuildResult,
  SharedSceneDerivedData,
} from "./types";
import type { ElementBounds } from "./workflowRenderer";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import {
  getSharedLayoutMap,
  getSharedLayoutVersion,
  getSharedFilteredChildrenMap,
  getSyntheticElementsMap,
} from "../layout/engines/fullTreeLayout";
import {
  getCachedCommandStream,
  executeRenderCommands,
  buildAIBoundsFromStream,
} from "./renderCommands";
import {
  buildElementBoundsMapFromTreeBounds,
  getCachedOverflowInfoMap,
} from "./skiaFrameHelpers";
import { recordWasmMetric } from "../utils/gpuProfilerCore";
import { collectVisiblePageRoots } from "./visiblePageRoots";
import { collectVisibleFrameRoots } from "./visibleFrameRoots";
import { getPagePositionPresentationSnapshot } from "../interaction/pagePositionPresentation";

// ============================================
// Content Build — 입력/출력 타입
// ============================================

export interface ContentBuildInput {
  aiState: RendererAIInvalidation;
  registryVersion: number;
  pagePosVersion: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  ck: CanvasKit;
  fontMgr: FontMgr | undefined;
  rendererInput: SkiaRendererInput;
}

// ============================================
// Content Build — 메인 함수
// ============================================

/**
 * 프레임 content를 빌드한다.
 *
 * Command Stream 또는 Tree 경로 중 하나를 선택하여
 * treeBoundsMap, AI bounds, content node를 생성한다.
 *
 * @returns null — 빈 씬인 경우 (caller가 clearFrame 처리)
 */
export function buildSkiaFrameContent(
  input: ContentBuildInput,
): ContentBuildResult | null {
  const {
    aiState,
    registryVersion,
    pagePosVersion,
    cameraX,
    cameraY,
    cameraZoom,
    ck,
    fontMgr,
    rendererInput,
  } = input;

  const sharedLayoutMap = getSharedLayoutMap();
  if (sharedLayoutMap === null) {
    // layout publish 전 — 그릴 콘텐츠가 없다. caller(clearFrame)가 빈 프레임 처리.
    return null;
  }

  const hasAIEffects =
    aiState.generatingNodes.size > 0 || aiState.flashAnimations.size > 0;

  const result = buildViaCommandStream(
    sharedLayoutMap,
    registryVersion,
    pagePosVersion,
    hasAIEffects,
    aiState,
    rendererInput,
    ck,
    fontMgr,
  );
  if (!result) return null;
  const treeBoundsMap = result.treeBoundsMap;
  const hitBoundsMap = result.hitBoundsMap;
  const renderChildrenMap = result.childrenMap ?? rendererInput.childrenMap;
  const nodeBoundsMap = result.nodeBoundsMap;
  const contentNode = result.contentNode;

  return {
    sharedScene: buildSharedSceneDerivedData(
      treeBoundsMap,
      rendererInput.renderNodesMap,
      renderChildrenMap,
      registryVersion,
      pagePosVersion,
      cameraX,
      cameraY,
      cameraZoom,
      hitBoundsMap,
    ),
    nodeBoundsMap,
    workflowElementBoundsMap: null, // workflow 단계에서 필요 시 빌드
    contentNode,
    hasAIEffects,
    empty: false,
  };
}

export function buildSharedSceneDerivedData(
  treeBoundsMap: Map<string, BoundingBox>,
  elementsMap: Map<string, CanvasSceneNode>,
  childrenMap: Map<string, CanvasSceneNode[]>,
  registryVersion: number,
  pagePosVersion: number,
  cameraX: number,
  cameraY: number,
  cameraZoom: number,
  /** 조상 clip 교차 히트 영역 (renderCommands 산출) */
  hitBoundsMap: Map<string, BoundingBox>,
): SharedSceneDerivedData {
  return {
    treeBoundsMap,
    hitBoundsMap,
    childrenMap,
    overflowInfoMap: getCachedOverflowInfoMap(
      treeBoundsMap,
      elementsMap,
      childrenMap,
      registryVersion,
      pagePosVersion,
    ),
    cameraX,
    cameraY,
    cameraZoom,
  };
}

// ============================================
// Workflow Data Build
// ============================================

/**
 * 워크플로우 오버레이에 필요한 요소 바운드 맵을 빌드한다.
 * content build의 treeBoundsMap을 재사용하여 중복 순회를 방지한다.
 */
export function buildWorkflowElementBounds(
  treeBoundsMap: Map<string, BoundingBox>,
): Map<string, ElementBounds> {
  return buildElementBoundsMapFromTreeBounds(treeBoundsMap);
}

// ============================================
// Internal — Command Stream 경로
// ============================================

interface InternalBuildResult {
  treeBoundsMap: Map<string, BoundingBox>;
  /** 조상 clip 교차 히트 영역. tree 경로는 clip 추적이 없어 treeBoundsMap 과 동일. */
  hitBoundsMap: Map<string, BoundingBox>;
  childrenMap?: Map<string, CanvasSceneNode[]>;
  nodeBoundsMap: Map<string, AIEffectNodeBounds> | null;
  contentNode: SkiaRenderable;
}

function buildViaCommandStream(
  sharedLayoutMap: Map<string, unknown>,
  registryVersion: number,
  pagePosVersion: number,
  hasAIEffects: boolean,
  aiState: RendererAIInvalidation,
  rendererInput: SkiaRendererInput,
  ck: CanvasKit,
  fontMgr: FontMgr | undefined,
): InternalBuildResult | null {
  const treeBuildStart =
    process.env.NODE_ENV === "development" ? performance.now() : 0;

  const layoutVersion = getSharedLayoutVersion();
  // ADR-111 P3-δ (D2=B): page + frame root 병합. 두 collection 결과를 단일 맵으로
  // 통합 (D3=A) 하여 buildRenderCommandStream 시그니처 미변경.
  const pageResult = collectVisiblePageRoots(rendererInput);
  const frameResult = collectVisibleFrameRoots(rendererInput);
  const rootElementIds = [
    ...pageResult.rootElementIds,
    ...frameResult.rootElementIds,
  ];
  const bodyPagePositions = {
    ...pageResult.bodyPagePositions,
    ...frameResult.bodyPagePositions,
  };
  const bodyPageIds = pageResult.bodyPageIds;

  // Fix 1: filteredChildrenMap 사용 (layoutMap과 동일 트리 소스)
  const filteredChildIds = getSharedFilteredChildrenMap();
  let commandChildrenMap: Map<string, CanvasSceneNode[]>;
  if (filteredChildIds) {
    commandChildrenMap = new Map();
    const syntheticMap = getSyntheticElementsMap();
    for (const [parentId, childIds] of filteredChildIds) {
      const children: CanvasSceneNode[] = [];
      for (const cid of childIds) {
        const el =
          rendererInput.renderNodesMap.get(cid) ?? syntheticMap.get(cid);
        if (el) children.push(el as CanvasSceneNode);
      }
      commandChildrenMap.set(parentId, children);
    }
  } else {
    commandChildrenMap = rendererInput.childrenMap;
  }

  const stream = getCachedCommandStream(
    rootElementIds,
    commandChildrenMap,
    sharedLayoutMap as Map<string, ComputedLayout>,
    bodyPagePositions,
    registryVersion,
    pagePosVersion,
    rendererInput.framePositionsVersion,
    layoutVersion,
  );

  if (process.env.NODE_ENV === "development") {
    recordWasmMetric("skiaTreeBuildTime", performance.now() - treeBuildStart);
  }

  const treeBoundsMap = stream.boundsMap;
  if (treeBoundsMap.size === 0) return null;

  // Selection build (boundsMap에서 0ms — 공용 산출물 재사용)
  const selectionBuildStart =
    process.env.NODE_ENV === "development" ? performance.now() : 0;
  if (process.env.NODE_ENV === "development") {
    recordWasmMetric(
      "selectionBuildTime",
      performance.now() - selectionBuildStart,
    );
  }

  // AI 이펙트 바운드 (stream.boundsMap에서 필터링)
  let nodeBoundsMap: Map<string, AIEffectNodeBounds> | null = null;
  if (hasAIEffects) {
    const aiBuildStart =
      process.env.NODE_ENV === "development" ? performance.now() : 0;
    const targetIds = new Set<string>();
    for (const id of aiState.generatingNodes.keys()) targetIds.add(id);
    for (const id of aiState.flashAnimations.keys()) targetIds.add(id);
    nodeBoundsMap = buildAIBoundsFromStream(stream.boundsMap, targetIds);
    if (process.env.NODE_ENV === "development") {
      recordWasmMetric("aiBoundsBuildTime", performance.now() - aiBuildStart);
    }
  }

  const contentNode: SkiaRenderable = {
    renderSkia(canvas, bounds) {
      const currentPagePositionSnapshot = getPagePositionPresentationSnapshot();
      // selfSpans 전달 = 노드 Picture 캐시 활성 (ADR-153 Phase 3 — command stream 경로 한정)
      executeRenderCommands(
        ck,
        canvas,
        stream.commands,
        bounds,
        fontMgr,
        stream.selfSpans,
        bodyPageIds,
        currentPagePositionSnapshot,
      );
    },
  };

  return {
    treeBoundsMap,
    hitBoundsMap: stream.hitBoundsMap,
    childrenMap: commandChildrenMap,
    nodeBoundsMap,
    contentNode,
  };
}

// ============================================
// Internal — Tree 경로
// ============================================
