/**
 * Skia Frame Build Pipeline (ADR-035 Phase 4)
 *
 * SkiaOverlay의 renderFrame() 내부에서 매 프레임 실행되는
 * content build 로직을 독립 모듈로 추출.
 *
 * 빌드 경로는 Command Stream 단일: elementsMap + layoutMap → RenderCommand[].
 * 구 tree 경로는 cameraContainer 생산자가 없어 도달 불가로 남았다가
 * 2026-08-14 simplify에서 제거됐다.
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
  executeDamageRenderCommands,
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
import { countFrameEvent, setFrameGauge } from "./frameCapture";
import { FrameContentCache } from "./frameContentCache";
import {
  buildDragPresentationNode,
  buildDragPresentationPlan,
} from "./dragPresentation";

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
 * 빈 프레임의 사유. caller 의 clearFrame 처리와 **readiness 판정**이 같이 읽는다.
 *
 * - `layout-pending` — 그릴 root 는 있는데 layout 산출물이 아직 없다. 이 revision 의
 *   결과가 확정되지 않았으므로 boot readiness 를 확정하면 안 된다.
 * - `no-visible-content` — 이 revision 에 그릴 것이 실제로 없다 (저장된 viewport 가
 *   화면 밖이라 페이지가 전부 culling 되는 경우 등). 빈 화면이 곧 올바른 결과이므로
 *   clearFrame 의 실제 surface flush 로 readiness 를 확정할 수 있다.
 *
 * 두 값은 build 가 실제로 사용한 root 개수/bounds 개수에서 그대로 나온다 — caller 가
 * 같은 조건을 다시 유도하면 표면마다 답이 갈린다.
 */
export type EmptyFrameReason = "layout-pending" | "no-visible-content";

export type ContentBuildOutcome =
  | { kind: "content"; content: ContentBuildResult }
  | { kind: "empty"; reason: EmptyFrameReason };

/**
 * 프레임 content를 빌드한다.
 *
 * Command Stream 또는 Tree 경로 중 하나를 선택하여
 * treeBoundsMap, AI bounds, content node를 생성한다.
 *
 * @returns `kind: "empty"` — 빈 씬인 경우 (caller가 clearFrame 처리 + 사유별 readiness 판정)
 */
export function buildSkiaFrameContent(
  input: ContentBuildInput,
  // 필수 — 기본값으로 새 캐시를 만들면 인자를 빠뜨린 호출부가 매 프레임 빈
  // 캐시를 받아 childrenCacheHit 0 인 채로 조용히 최적화를 잃는다.
  cache: FrameContentCache,
): ContentBuildOutcome {
  countFrameEvent("contentBuild");
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

  // ADR-111 P3-δ (D2=B): page + frame root 병합. 두 collection 결과를 단일 맵으로
  // 통합 (D3=A). layout 판정과 stream 빌드가 **같은 root 집합**을 읽도록 여기서 한 번만
  // 계산한다 — 두 곳이 각자 유도하면 표면마다 답이 갈린다.
  const roots = collectFrameRoots(rendererInput);

  const sharedLayoutMap = getSharedLayoutMap();
  if (sharedLayoutMap === null) {
    // layout 이 아직 없다. 다만 root 가 하나도 없으면 layout publisher 에게 발행할
    // 것이 없었다는 뜻이다 — 저장된 viewport 가 화면 밖이면 visiblePages 가 비어
    // (buildVisiblePageSet) publisher 입력이 0 이 되고 shared layout map 이 영원히
    // null 로 남는다. 그 상태는 pending 이 아니라 "이 revision 에 그릴 것이 없다" 로
    // 확정된 결과다. root 가 있는데 layout 이 없으면 진짜 pending 이다.
    return {
      kind: "empty",
      reason:
        roots.rootElementIds.length === 0
          ? "no-visible-content"
          : "layout-pending",
    };
  }

  const hasAIEffects =
    aiState.generatingNodes.size > 0 || aiState.flashAnimations.size > 0;

  const result = buildViaCommandStream(
    roots,
    sharedLayoutMap,
    registryVersion,
    pagePosVersion,
    hasAIEffects,
    aiState,
    rendererInput,
    ck,
    fontMgr,
    cache,
  );
  if (!result.stream) return { kind: "empty", reason: result.emptyReason };
  const treeBoundsMap = result.stream.treeBoundsMap;
  const hitBoundsMap = result.stream.hitBoundsMap;
  const renderChildrenMap =
    result.stream.childrenMap ?? rendererInput.childrenMap;
  const nodeBoundsMap = result.stream.nodeBoundsMap;
  const contentNode = result.stream.contentNode;
  const dragPresentationNode = result.stream.dragPresentationNode;

  return {
    kind: "content",
    content: {
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
      dragPresentationNode,
      hasAIEffects,
      empty: false,
    },
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
  dragPresentationNode: SkiaRenderable | null;
}

interface FrameRoots {
  rootElementIds: string[];
  bodyPagePositions: Record<string, { x: number; y: number }>;
  bodyPageIds: Map<string, string>;
}

/** 이 프레임에 그릴 root (visible page body + frame body) 를 모은다. */
function collectFrameRoots(rendererInput: SkiaRendererInput): FrameRoots {
  const pageResult = collectVisiblePageRoots(rendererInput);
  const frameResult = collectVisibleFrameRoots(rendererInput);
  return {
    rootElementIds: [
      ...pageResult.rootElementIds,
      ...frameResult.rootElementIds,
    ],
    bodyPagePositions: {
      ...pageResult.bodyPagePositions,
      ...frameResult.bodyPagePositions,
    },
    bodyPageIds: pageResult.bodyPageIds,
  };
}

function buildViaCommandStream(
  roots: FrameRoots,
  sharedLayoutMap: Map<string, unknown>,
  registryVersion: number,
  pagePosVersion: number,
  hasAIEffects: boolean,
  aiState: RendererAIInvalidation,
  rendererInput: SkiaRendererInput,
  ck: CanvasKit,
  fontMgr: FontMgr | undefined,
  cache: FrameContentCache,
):
  | { stream: InternalBuildResult; emptyReason: null }
  | {
      stream: null;
      emptyReason: EmptyFrameReason;
    } {
  const treeBuildStart =
    process.env.NODE_ENV === "development" ? performance.now() : 0;

  const layoutVersion = getSharedLayoutVersion();
  const { rootElementIds, bodyPagePositions, bodyPageIds } = roots;

  // Fix 1: filteredChildrenMap 사용 (layoutMap과 동일 트리 소스)
  const filteredChildIds = getSharedFilteredChildrenMap();
  let commandChildrenMap: Map<string, CanvasSceneNode[]>;
  if (filteredChildIds) {
    const syntheticMap = getSyntheticElementsMap();
    commandChildrenMap = cache.readChildren(
      filteredChildIds,
      rendererInput.renderNodesMap,
      syntheticMap,
      registryVersion,
      layoutVersion,
    );
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
    {
      baseCanonicalRevision: layoutVersion,
    },
  );
  const dragPresentationPlan = buildDragPresentationPlan(
    stream,
    registryVersion,
  );

  if (process.env.NODE_ENV === "development") {
    recordWasmMetric("skiaTreeBuildTime", performance.now() - treeBuildStart);
  }

  const treeBoundsMap = stream.boundsMap;
  setFrameGauge("renderBoundsCount", treeBoundsMap.size);
  setFrameGauge("resolvedInputNodeCount", rendererInput.renderNodesMap.size);
  if (treeBoundsMap.size === 0) {
    // root 가 하나도 없다 = 이 revision 에 그릴 것이 없다 (전부 화면 밖 culling,
    // layout 편집 모드의 페이지 root 제외 등). root 는 있는데 bounds 가 0 이면
    // layout 산출물이 아직 그 root 를 담지 못한 상태다 — readiness 확정 금지.
    return {
      stream: null,
      emptyReason:
        rootElementIds.length === 0 ? "no-visible-content" : "layout-pending",
    };
  }

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
        dragPresentationPlan
          ? { end: dragPresentationPlan.backgroundCommandEnd }
          : undefined,
      );
    },
    renderDamageSkia(canvas, bounds) {
      const currentPagePositionSnapshot = getPagePositionPresentationSnapshot();
      return executeDamageRenderCommands(
        ck,
        canvas,
        stream,
        bounds,
        fontMgr,
        bodyPageIds,
        currentPagePositionSnapshot,
      );
    },
  };
  const dragPresentationNode = dragPresentationPlan
    ? buildDragPresentationNode(ck, dragPresentationPlan, fontMgr, bodyPageIds)
    : null;

  return {
    stream: {
      treeBoundsMap,
      hitBoundsMap: stream.hitBoundsMap,
      childrenMap: commandChildrenMap,
      nodeBoundsMap,
      contentNode,
      dragPresentationNode,
    },
    emptyReason: null,
  };
}

// ============================================
// Internal — Tree 경로
// ============================================
