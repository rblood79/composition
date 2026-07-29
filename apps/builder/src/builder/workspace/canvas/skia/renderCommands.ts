/**
 * Phase 3: Flat Render Command Stream
 *
 * elementsMap + childrenMap + fullTreeLayoutMap + skiaNodeRegistry에서 직접
 * 렌더 커맨드 스트림(플랫 배열)을 구성하여 PixiJS 순회 제거 + 선형 렌더링.
 *
 * @see ADR-005 Phase 3
 * @since 2026-02-28
 */

import type {
  CanvasKit,
  Canvas,
  FontMgr,
  SkPicture,
  Image as SkImage,
} from "canvaskit-wasm";
import type { SkiaNodeData } from "./nodeRenderers";
import type { ClipPathShape } from "../sprites/styleConverter";
import type { EffectStyle, MaskImageStyle } from "./types";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { BoundingBox } from "../selection/types";
import type { AIEffectNodeBounds } from "./types";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import {
  buildMaskGradientShader,
  determineMaskMode,
  applyMaskImage,
} from "./nodeRendererMask";
import { getSkImage, loadSkImage } from "./imageCache";
import { observe, PERF_LABEL } from "../../../utils/perfMarks";
import { getSkiaNode } from "./useSkiaNode";
import { getDragVisualOffset, getSiblingOffset } from "./nodeRendererTree";
import {
  renderBox,
  renderText,
  renderImage,
  renderLine,
  renderIconPath,
  renderPartialBorder,
  renderScrollbar,
  buildClipPath,
  getEditingElementId,
} from "./nodeRenderers";
import {
  beginRenderEffects,
  endRenderEffects,
  countEffectLayers,
} from "./effects";
import { toSkiaBlendMode } from "./blendModes";
import { getCacheMetrics } from "./cacheMetrics";
import { addCommandCount, incrementDrawCall } from "./drawStats";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import {
  ensureNodePictureFontGeneration,
  getCachedNodePicture,
  invalidateNodePicture,
  isNodePictureCacheEnabled,
  isVolatileNode,
  storeNodePicture,
} from "./nodePictureCache";
import { WASM_FLAGS } from "../wasm-bindings/featureFlags";
import * as spatialIndex from "../wasm-bindings/spatialIndex";
import { resolveStickyY, resolveStickyX } from "../layout/stickyResolver";

// ── Command 타입 ──────────────────────────────────────────────────────

const CMD_ELEMENT_BEGIN = 0 as const;
const CMD_DRAW = 1 as const;
const CMD_CHILDREN_BEGIN = 2 as const;
const CMD_CHILDREN_END = 3 as const;
const CMD_ELEMENT_END = 4 as const;
const DRAG_ELEMENT_ALPHA = 0.9;

interface ElementBeginCmd {
  type: typeof CMD_ELEMENT_BEGIN;
  x: number;
  y: number;
  width: number;
  height: number;
  elementId: string;
  visible: boolean;
  transform?: Float32Array;
  clipPath?: ClipPathShape;
  blendMode?: string;
  effects?: EffectStyle[];
  /** position: fixed 요소 — executeRenderCommands에서 camera 역보정 대상 */
  isFixed?: boolean;
  /** CSS mask-image — 요소 전체를 offscreen에 렌더 후 mask 합성 */
  maskImage?: MaskImageStyle;
}

interface DrawCmd {
  type: typeof CMD_DRAW;
  nodeType: SkiaNodeData["type"];
  skiaData: SkiaNodeData;
  width: number;
  height: number;
}

interface ChildrenBeginCmd {
  type: typeof CMD_CHILDREN_BEGIN;
  clipChildren: boolean;
  width: number;
  height: number;
  scrollOffset?: { scrollTop: number; scrollLeft: number };
}

interface ChildrenEndCmd {
  type: typeof CMD_CHILDREN_END;
  clipChildren: boolean;
  hasScrollOffset: boolean;
  scrollbar?: SkiaNodeData["scrollbar"];
  scrollbarNode?: SkiaNodeData;
}

interface ElementEndCmd {
  type: typeof CMD_ELEMENT_END;
  hasBlend: boolean;
  effectLayerCount: number;
}

type RenderCommand =
  | ElementBeginCmd
  | DrawCmd
  | ChildrenBeginCmd
  | ChildrenEndCmd
  | ElementEndCmd;

/**
 * 요소의 self-draw 블록 커맨드 구간 — [start, end).
 *
 * ELEMENT_BEGIN 직후부터 CHILDREN_BEGIN(또는 ELEMENT_END) 직전까지의
 * DRAW + 내부 자식(spec shapes) wrapper 커맨드만 포함한다. 자식 요소 재귀는
 * 구간 밖이므로, 이 구간은 해당 요소의 skiaData + width/height 만의 함수다 —
 * 노드 Picture 캐시(ADR-153 Phase 3)의 record 단위.
 */
export interface SelfSpan {
  start: number;
  end: number;
}

export interface RenderCommandStream {
  commands: RenderCommand[];
  /** elementId → self-draw 커맨드 구간 (노드 Picture 캐시 record/replay 단위) */
  selfSpans: Map<string, SelfSpan>;
  boundsMap: Map<string, BoundingBox>;
  /**
   * 클립 인지 히트 영역 — `boundsMap` 을 조상 clip rect 로 교차한 결과.
   *
   * `boundsMap` 은 요소 원본 박스(오버레이/텍스트 편집/측정 기준)라 조상이
   * overflow hidden/clip/scroll/auto 로 잘라낸 영역까지 포함한다. 포인터 판정에
   * 그대로 쓰면 **화면에 없는 영역이 히트**된다 (ListBox maxHeight:300 + 내용 350
   * 에서 y=310 클릭 시 body 대신 ListBox 선택). 히트 계열 소비자는 본 맵을 쓴다.
   * 교차 결과가 비면 아예 등재하지 않는다 = 히트 불가.
   */
  hitBoundsMap: Map<string, BoundingBox>;
}

/** 씬 절대 좌표 clip rect (조상 누적 교차 결과). null = 클립 없음 */
type ClipRect = { x: number; y: number; width: number; height: number } | null;

/** 교차 영역 0 — 서브트리 전체가 잘림. 크기 0 이라 모든 교차가 null 이 된다. */
const EMPTY_CLIP: ClipRect = { x: 0, y: 0, width: 0, height: 0 };

/**
 * bounds 를 clip rect 로 교차한다. 교차 영역이 없으면 null.
 *
 * 렌더러(`executeRenderCommands` CMD_CHILDREN_BEGIN)가 적용하는 clip 과 동일 계약:
 * clip rect 는 클리핑 조상의 절대 박스이며, 요소 자신의 clipChildren 은 자식에만 적용된다.
 */
function intersectBounds(
  bounds: BoundingBox,
  clip: ClipRect,
): BoundingBox | null {
  if (!clip) return bounds;

  const left = Math.max(bounds.x, clip.x);
  const top = Math.max(bounds.y, clip.y);
  const right = Math.min(bounds.x + bounds.width, clip.x + clip.width);
  const bottom = Math.min(bounds.y + bounds.height, clip.y + clip.height);

  if (right <= left || bottom <= top) return null;

  return { x: left, y: top, width: right - left, height: bottom - top };
}

interface DeferredDragRootVisit {
  elementId: string;
  parentAbsX: number;
  parentAbsY: number;
  parentElementId: string | null;
}

interface VisitOptions {
  deferredDragRoot?: { current: DeferredDragRootVisit | null };
  dragRootId?: string | null;
  renderAsTopLayer?: boolean;
}

/** 최신 boundsMap 캐시 (씬 좌표 — TextEditOverlay 위치 계산용) */
let _lastBoundsMap: Map<string, BoundingBox> = new Map();

/** 최신 hitBoundsMap 캐시 (씬 좌표 — 조상 clip 교차 완료) */
let _lastHitBoundsMap: Map<string, BoundingBox> = new Map();

/** 씬 좌표 기반 요소 bounds 조회 (카메라 변환 미포함) */
export function getSceneBounds(elementId: string): BoundingBox | undefined {
  return _lastBoundsMap.get(elementId);
}

/**
 * 씬 좌표 기반 요소 **히트** bounds 조회 — 조상 clip rect 교차 결과.
 *
 * 조상이 잘라낸 영역은 포함되지 않으며, 전부 잘린 요소는 undefined.
 * 포인터 판정(클릭/호버/드롭)은 `getSceneBounds` 대신 본 함수를 쓴다.
 */
export function getSceneHitBounds(elementId: string): BoundingBox | undefined {
  return _lastHitBoundsMap.get(elementId);
}

// ── Bounds 구독 (TextEditOverlay 이벤트 기반 위치 추적) ──────────────

type BoundsListener = (elementId: string, bounds: BoundingBox) => void;
const _boundsListeners = new Map<string, Set<BoundsListener>>();

/** 특정 요소의 bounds 변경을 구독한다. 해제 함수를 반환한다. */
export function subscribeBounds(
  elementId: string,
  listener: BoundsListener,
): () => void {
  let set = _boundsListeners.get(elementId);
  if (!set) {
    set = new Set();
    _boundsListeners.set(elementId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) _boundsListeners.delete(elementId);
  };
}

/** boundsMap 갱신 후 구독자에게 알림 */
function _notifyBoundsListeners(boundsMap: Map<string, BoundingBox>): void {
  if (_boundsListeners.size === 0) return;
  for (const [id, listeners] of _boundsListeners) {
    const bounds = boundsMap.get(id);
    if (bounds) {
      for (const fn of listeners) fn(id, bounds);
    }
  }
}

// ── updateTextChildren (SkiaOverlay.tsx:91-129에서 이동) ──────────────

function updateTextChildren(
  children: SkiaNodeData[] | undefined,
  parentWidth: number,
  parentHeight: number,
): SkiaNodeData[] | undefined {
  return children?.map((child: SkiaNodeData) => {
    if (child.type === "text" && child.text) {
      if (child.text.autoCenter === false) {
        return child;
      }
      const fontSize = child.text.fontSize || 14;
      const lineHeight = child.text.lineHeight || fontSize * 1.2;
      return {
        ...child,
        width: parentWidth,
        height: parentHeight,
        text: {
          ...child.text,
          maxWidth: parentWidth,
          paddingTop: Math.max(0, (parentHeight - lineHeight) / 2),
        },
      };
    }
    if (child.type === "box" && child.children && child.children.length > 0) {
      const updatedChildren = updateTextChildren(
        child.children,
        parentWidth,
        parentHeight,
      );
      return {
        ...child,
        width: parentWidth,
        height: parentHeight,
        children: updatedChildren,
      };
    }
    return child;
  });
}

// ── buildRenderCommandStream ──────────────────────────────────────────

// 캐시
let _cachedStream: RenderCommandStream | null = null;
/**
 * ADR-172 Phase 1.5: 스트림의 **입력**인 commandChildrenMap 을 같은 캐시 엔트리에
 * 동봉한다. 별도 캐시 키를 신설하지 않는 이유는 두 캐시의 무효화 시점이 갈리면
 * 스트림과 childrenMap 이 어긋나기 때문 — 여기 두면 `invalidateCommandStreamCache()`
 * 한 번으로 둘 다 무효화된다.
 */
let _cachedCommandChildrenMap: Map<string, CanvasSceneNode[]> | null = null;
let _cacheRegVersion = -1;
let _cachePagePosVersion = -1;
let _cacheFramePosVersion = -1;
let _cacheLayoutVersion = -1;
let _cacheRootSignature = "";
/** 직전 miss 가 명시적 invalidateCommandStreamCache() 호출로 인한 것인지 구분 */
let _explicitInvalidate = false;

/**
 * ADR-153 Phase 1-a: command stream 캐시 miss 사유 분류 (dev-only 호출).
 * 5중 키 중 어떤 성분이 어긋났는지 판정한다 — 복합 mismatch 는 "+" 로 연결.
 */
function classifyCommandStreamMiss(
  registryVersion: number,
  pagePosVersion: number,
  framePosVersion: number,
  layoutVersion: number,
  rootSignature: string,
): string {
  if (!_cachedStream) return _explicitInvalidate ? "forced" : "cold";
  const reasons: string[] = [];
  if (registryVersion !== _cacheRegVersion) reasons.push("registry");
  if (layoutVersion !== _cacheLayoutVersion) reasons.push("layout");
  if (pagePosVersion !== _cachePagePosVersion) reasons.push("page-pos");
  if (framePosVersion !== _cacheFramePosVersion) reasons.push("frame-pos");
  if (rootSignature !== _cacheRootSignature) reasons.push("root-signature");
  return reasons.length > 0 ? reasons.join("+") : "unknown";
}

/**
 * 캐시 기반 커맨드 스트림 획득.
 *
 * registryVersion + pagePositionsVersion + framePositionsVersion + sharedLayoutVersion 4중 키.
 * ADR-111 P3-δ: framePositionsVersion 추가 — frame 좌표 변경 시 invalidate (D3=A 단일 맵
 * 통합 후에도 frame 영역 카운터는 별도 추적, page-only 변경과 frame-only 변경을 구분 캐시).
 *
 * ADR-172 Phase 1.5: `childrenMap` 을 **lazy builder** 로 받는다. 이 맵은 스트림의
 * 입력이면서 자체도 O(총 자식 수) 재구축 비용을 갖는데(실측 9,600 자식에서 p50
 * 2.06ms / p95 3.72ms — 60fps 예산의 12~22%), 캐시 hit 프레임에서는 결과가 쓰이지
 * 않는다. blit(카메라 전용) 프레임은 5중 키가 전부 그대로라 항상 hit 이므로,
 * builder 를 호출하지 않는 것만으로 그 비용이 사라진다.
 *
 * **builder 를 미리 호출해 값으로 넘기지 말 것** — 그 순간 lazy 가 무의미해진다.
 */
export function getCachedCommandStream(
  rootElementIds: string[],
  buildChildrenMap: () => Map<string, CanvasSceneNode[]>,
  layoutMap: Map<string, ComputedLayout>,
  pagePositions: Record<string, { x: number; y: number }>,
  registryVersion: number,
  pagePosVersion: number,
  framePosVersion: number,
  layoutVersion: number,
): {
  childrenMap: Map<string, CanvasSceneNode[]>;
  stream: RenderCommandStream;
} {
  const rootSignature = rootElementIds.join("|");
  if (
    _cachedStream &&
    _cachedCommandChildrenMap &&
    registryVersion === _cacheRegVersion &&
    pagePosVersion === _cachePagePosVersion &&
    framePosVersion === _cacheFramePosVersion &&
    layoutVersion === _cacheLayoutVersion &&
    rootSignature === _cacheRootSignature
  ) {
    if (process.env.NODE_ENV === "development") {
      getCacheMetrics("commandStream").recordHit();
    }
    return { childrenMap: _cachedCommandChildrenMap, stream: _cachedStream };
  }

  if (process.env.NODE_ENV === "development") {
    getCacheMetrics("commandStream").recordMiss(
      classifyCommandStreamMiss(
        registryVersion,
        pagePosVersion,
        framePosVersion,
        layoutVersion,
        rootSignature,
      ),
    );
  }

  // ADR-172 Phase 4: miss 경로에서만 도는 조립 — 팬 프레임에서 count 가 0 이어야
  // 캐시가 실제로 걸린 것이다 (G5 의 Skia 축 증거). duration 은 실사용 규모에서
  // 측정 하한 아래라 신호가 되지 못한다 — PERF_LABEL 주석 참조.
  const childrenMap = observe(
    PERF_LABEL.RENDER_DERIVED_CHILDREN_MAP,
    buildChildrenMap,
  );
  const stream = buildRenderCommandStream(
    rootElementIds,
    childrenMap,
    layoutMap,
    pagePositions,
  );

  _cachedStream = stream;
  _cachedCommandChildrenMap = childrenMap;
  _cacheRegVersion = registryVersion;
  _cachePagePosVersion = pagePosVersion;
  _cacheFramePosVersion = framePosVersion;
  _cacheLayoutVersion = layoutVersion;
  _cacheRootSignature = rootSignature;
  _explicitInvalidate = false;

  return { childrenMap, stream };
}

/**
 * 커맨드 스트림 캐시 무효화 (pagePositions stale 프레임 등)
 *
 * ADR-172 Phase 1.5: 동봉된 `commandChildrenMap` 도 함께 버린다 — 한쪽만 남으면
 * 다음 프레임에서 스트림과 childrenMap 이 서로 다른 세대가 된다.
 */
export function invalidateCommandStreamCache(): void {
  _cachedStream = null;
  _cachedCommandChildrenMap = null;
  _cacheRootSignature = "";
  _explicitInvalidate = true;
}

/**
 * elementsMap + childrenMap + layoutMap + skiaNodeRegistry에서 직접
 * RenderCommand[] 플랫 배열을 구성한다.
 *
 * DFS pre-order: 각 페이지 body에서 시작.
 */
export function buildRenderCommandStream(
  rootElementIds: string[],
  childrenMap: Map<string, CanvasSceneNode[]>,
  layoutMap: Map<string, ComputedLayout>,
  pagePositions: Record<string, { x: number; y: number }>,
): RenderCommandStream {
  const commands: RenderCommand[] = [];
  const selfSpans = new Map<string, SelfSpan>();
  const boundsMap = new Map<string, BoundingBox>();
  const hitBoundsMap = new Map<string, BoundingBox>();
  const dragRootId = getDragVisualOffset()?.elementId ?? null;
  const deferredDragRoot = { current: null as DeferredDragRootVisit | null };
  const visitOptions: VisitOptions = {
    deferredDragRoot,
    dragRootId,
  };

  for (const bodyId of rootElementIds) {
    const pagePos = pagePositions[bodyId];
    const offsetX = pagePos?.x ?? 0;
    const offsetY = pagePos?.y ?? 0;

    visitElement(
      bodyId,
      offsetX,
      offsetY,
      commands,
      selfSpans,
      boundsMap,
      hitBoundsMap,
      null,
      childrenMap,
      layoutMap,
      offsetX,
      offsetY,
      null,
      visitOptions,
    );
  }

  if (deferredDragRoot.current) {
    const deferred = deferredDragRoot.current;
    // top-layer 재방문은 조상의 clip save/restore 밖에서 그려진다 → clip 미적용
    visitElement(
      deferred.elementId,
      deferred.parentAbsX,
      deferred.parentAbsY,
      commands,
      selfSpans,
      boundsMap,
      hitBoundsMap,
      null,
      childrenMap,
      layoutMap,
      0,
      0,
      deferred.parentElementId,
      { renderAsTopLayer: true },
    );
  }

  // SpatialIndex 동기화: 클립 인지 히트 영역을 반영 (화면에 없는 영역은 히트 불가)
  if (WASM_FLAGS.SPATIAL_INDEX) {
    syncSpatialIndex(hitBoundsMap);
  }

  // 최신 boundsMap 캐시 (TextEditOverlay 등 외부 접근용)
  _lastBoundsMap = boundsMap;
  _lastHitBoundsMap = hitBoundsMap;
  _notifyBoundsListeners(boundsMap);

  return { commands, selfSpans, boundsMap, hitBoundsMap };
}

/**
 * boundsMap → SpatialIndex 동기화.
 *
 * renderCommands가 씬 좌표(페이지 오프셋 포함) 절대좌표로 boundsMap을 구성하므로,
 * 항상 최신 씬 좌표 기반 SpatialIndex를 유지한다.
 * elementRegistry.updateElementBounds()의 스크린 좌표 동기화를 대체.
 */
function syncSpatialIndex(boundsMap: Map<string, BoundingBox>): void {
  const items: Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }> = [];
  for (const [id, bounds] of boundsMap) {
    if (bounds.width > 0 && bounds.height > 0) {
      items.push({
        id,
        x: bounds.x,
        y: bounds.y,
        w: bounds.width,
        h: bounds.height,
      });
    }
  }
  spatialIndex.batchUpdate(items);
}

/**
 * DFS pre-order 순회: 단일 element를 커맨드 스트림으로 변환.
 *
 * @param cmdOffsetX - 커맨드의 x에 추가할 오프셋 (페이지 오프셋용, 루트 호출에만 전달)
 * @param cmdOffsetY - 커맨드의 y에 추가할 오프셋 (페이지 오프셋용, 루트 호출에만 전달)
 * @param parentElementId - 부모 elementId (sticky containerBottom/Right 계산용)
 */
function visitElement(
  elementId: string,
  parentAbsX: number,
  parentAbsY: number,
  commands: RenderCommand[],
  selfSpans: Map<string, SelfSpan>,
  boundsMap: Map<string, BoundingBox>,
  hitBoundsMap: Map<string, BoundingBox>,
  clipRect: ClipRect,
  childrenMap: Map<string, CanvasSceneNode[]>,
  layoutMap: Map<string, ComputedLayout>,
  cmdOffsetX: number = 0,
  cmdOffsetY: number = 0,
  parentElementId: string | null = null,
  options: VisitOptions = {},
): void {
  const skiaData = getSkiaNode(elementId);
  if (!skiaData) return;

  if (options.dragRootId === elementId && options.deferredDragRoot) {
    options.deferredDragRoot.current = {
      elementId,
      parentAbsX,
      parentAbsY,
      parentElementId,
    };
    return;
  }

  // layoutMap에서 부모 기준 상대 좌표 + 크기 조회
  const layout = layoutMap.get(elementId);
  const relX = layout?.x ?? skiaData.x;
  const relY = layout?.y ?? skiaData.y;
  const rawWidth = layout?.width ?? skiaData.width;
  const rawHeight = layout?.height ?? skiaData.height;

  // contentMinHeight 적용 (Card 등 auto-height)
  const width =
    rawWidth > 0 ? rawWidth : skiaData.width > 0 ? skiaData.width : 0;
  const baseHeight =
    rawHeight > 0 ? rawHeight : skiaData.height > 0 ? skiaData.height : 0;
  const height = skiaData.contentMinHeight
    ? Math.max(baseHeight, skiaData.contentMinHeight)
    : baseHeight;

  // 절대 좌표
  const absX = parentAbsX + relX;
  const absY = parentAbsY + relY;

  // boundsMap에 절대 좌표 기록 (원본 박스 — 오버레이/측정 기준)
  const elementBounds = { x: absX, y: absY, width, height };
  boundsMap.set(elementId, elementBounds);

  // hitBoundsMap: 조상 clip rect 와 교차한 히트 영역. 전부 잘렸으면 미등재.
  const hitBounds = intersectBounds(elementBounds, clipRect);
  if (hitBounds) {
    hitBoundsMap.set(elementId, hitBounds);
  }

  // position: sticky/fixed — 렌더 좌표 보정
  // layoutMap의 y/x는 정적 레이아웃 기준이므로 스크롤 후 post-layout 보정 필요
  const topLayerOffsetX = options.renderAsTopLayer ? parentAbsX : cmdOffsetX;
  const topLayerOffsetY = options.renderAsTopLayer ? parentAbsY : cmdOffsetY;
  let renderRelX = relX + topLayerOffsetX;
  let renderRelY = relY + topLayerOffsetY;

  // 부모 layout: sticky containerBottom/Right 계산용
  const parentLayout = parentElementId
    ? layoutMap.get(parentElementId)
    : undefined;

  if (skiaData.isFixed) {
    // fixed: containerBottom=Infinity → 제한 없음. 스크롤 없이 뷰포트 고정
    renderRelY = resolveStickyY({
      elementY: relY,
      stickyTop: skiaData.stickyTop ?? 0,
      scrollOffset: 0,
      containerTop: 0,
      containerBottom: Infinity,
      elementHeight: height,
    });
    renderRelX = resolveStickyX({
      elementX: relX,
      stickyLeft: skiaData.stickyLeft ?? 0,
      scrollOffset: 0,
      containerLeft: 0,
      containerRight: Infinity,
      elementWidth: width,
    });
  } else if (skiaData.isSticky) {
    // sticky: 부모 scrollOffset 기준으로 보정
    // parentAbsX/Y는 이미 부모의 scrollOffset이 차감된 절대 좌표
    const parentScrollY = skiaData.scrollOffset?.scrollTop ?? 0;
    const parentScrollX = skiaData.scrollOffset?.scrollLeft ?? 0;
    // 부모 layout이 있으면 실제 크기로 containerBottom/Right 계산,
    // 없으면 Infinity fallback (루트 body 등)
    const containerBottom =
      parentLayout != null ? parentLayout.height : Infinity;
    const containerRight = parentLayout != null ? parentLayout.width : Infinity;
    renderRelY =
      resolveStickyY({
        elementY: relY,
        stickyTop: skiaData.stickyTop ?? 0,
        scrollOffset: parentScrollY,
        containerTop: 0,
        containerBottom,
        elementHeight: height,
      }) + topLayerOffsetY;
    renderRelX =
      resolveStickyX({
        elementX: relX,
        stickyLeft: skiaData.stickyLeft ?? 0,
        scrollOffset: parentScrollX,
        containerLeft: 0,
        containerRight,
        elementWidth: width,
      }) + topLayerOffsetX;
  }

  // ELEMENT_BEGIN
  // cmdOffsetX/Y: 페이지 오프셋 (루트 body 호출 시에만 non-zero)
  // canvas.translate()에 페이지 위치가 반영되어야 다중 페이지가 올바른 위치에 렌더링됨
  commands.push({
    type: CMD_ELEMENT_BEGIN,
    x: renderRelX,
    y: renderRelY,
    width,
    height,
    elementId,
    visible: skiaData.visible,
    transform: skiaData.transform,
    clipPath: skiaData.clipPath,
    blendMode: skiaData.blendMode,
    effects: skiaData.effects,
    isFixed: skiaData.isFixed,
    maskImage: skiaData.maskImage,
  });

  // 내부 자식 (text 등) → DRAW 커맨드
  const updatedInternalChildren = updateTextChildren(
    skiaData.children,
    width,
    height,
  );
  // self-draw 블록 구간 기록 — ELEMENT_BEGIN 직후 ~ CHILDREN_BEGIN 직전.
  // 이 구간은 skiaData + width/height 만의 함수라 노드 Picture record 단위가 된다.
  const selfSpanStart = commands.length;
  emitDrawCommands(skiaData, updatedInternalChildren, width, height, commands);
  if (commands.length > selfSpanStart) {
    selfSpans.set(elementId, { start: selfSpanStart, end: commands.length });
  }

  // 외부 자식 (element children) → CHILDREN_BEGIN/END + 재귀
  const childElements = childrenMap.get(elementId);
  // ADR-050: clipChildren일 때 skiaData의 원본 크기 사용 (pageWidth/Height)
  // layoutMap의 height는 enrichment로 확장될 수 있어 clip이 무효화됨
  const clipWidth = skiaData.clipChildren
    ? skiaData.width > 0
      ? skiaData.width
      : width
    : width;
  const clipHeight = skiaData.clipChildren
    ? skiaData.height > 0
      ? skiaData.height
      : height
    : height;
  if (childElements && childElements.length > 0) {
    commands.push({
      type: CMD_CHILDREN_BEGIN,
      clipChildren: skiaData.clipChildren ?? false,
      width: clipWidth,
      height: clipHeight,
      scrollOffset: skiaData.scrollOffset,
    });

    // z-index 정렬: skiaNodeRegistry에서 각 자식의 zIndex 조회
    const sortedChildren = sortChildElementsByZIndex(childElements);

    // boundsMap에 scroll offset 반영: 자식의 절대 좌표에서 부모의 스크롤량 차감
    const scrollX = skiaData.scrollOffset?.scrollLeft ?? 0;
    const scrollY = skiaData.scrollOffset?.scrollTop ?? 0;
    const childVisitOptions = options.renderAsTopLayer ? {} : options;

    // 자식 clip rect: 렌더러의 CMD_CHILDREN_BEGIN clipRect(0,0,clipWidth,clipHeight)를
    // 절대 좌표로 옮긴 것. scroll translate 는 clip 적용 **뒤** 라 clip 원점은 스크롤 미반영.
    const childClipRect: ClipRect =
      skiaData.clipChildren && clipWidth > 0 && clipHeight > 0
        ? // 조상 clip 과 교차가 비면 EMPTY_CLIP — null(=클립 없음)로 되돌리면
          //   전부 잘린 서브트리가 오히려 무제한 히트 가능해진다.
          (intersectBounds(
            { x: absX, y: absY, width: clipWidth, height: clipHeight },
            clipRect,
          ) ?? EMPTY_CLIP)
        : clipRect;

    for (const child of sortedChildren) {
      visitElement(
        child.id,
        absX - scrollX,
        absY - scrollY,
        commands,
        selfSpans,
        boundsMap,
        hitBoundsMap,
        childClipRect,
        childrenMap,
        layoutMap,
        0,
        0,
        elementId,
        childVisitOptions,
      );
    }

    commands.push({
      type: CMD_CHILDREN_END,
      clipChildren: skiaData.clipChildren ?? false,
      hasScrollOffset: !!(
        skiaData.scrollOffset &&
        (skiaData.scrollOffset.scrollTop !== 0 ||
          skiaData.scrollOffset.scrollLeft !== 0)
      ),
      scrollbar: skiaData.scrollbar,
      scrollbarNode: skiaData.scrollbar ? skiaData : undefined,
    });
  }

  // ELEMENT_END
  // 실제 saveLayer 를 여는 effect 수만 센다(inner drop-shadow 제외) — beginRenderEffects 와
  //   동일 predicate. length 를 쓰면 inset 요소에서 over-restore → canvas 스택 붕괴.
  const effectCount = skiaData.effects
    ? countEffectLayers(skiaData.effects)
    : 0;
  commands.push({
    type: CMD_ELEMENT_END,
    hasBlend: !!(skiaData.blendMode && skiaData.blendMode !== "normal"),
    effectLayerCount: effectCount,
  });
}

/**
 * 자식 elements를 z-index로 정렬.
 * skiaNodeRegistry에서 zIndex를 조회한다.
 */
function sortChildElementsByZIndex(
  children: CanvasSceneNode[],
): CanvasSceneNode[] {
  // z-index가 있는 자식이 하나라도 있는지 확인
  let hasZIndex = false;
  for (const child of children) {
    const node = getSkiaNode(child.id);
    if (node?.zIndex !== undefined) {
      hasZIndex = true;
      break;
    }
  }
  if (!hasZIndex) return children;

  const indexed = children.map((child, i) => ({
    child,
    originalIndex: i,
    zIndex: getSkiaNode(child.id)?.zIndex ?? 0,
  }));
  indexed.sort((a, b) => {
    if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
    return a.originalIndex - b.originalIndex;
  });
  return indexed.map((item) => item.child);
}

/**
 * 단일 element의 Skia 렌더 데이터를 DRAW 커맨드로 변환.
 * 내부 자식 (SkiaNodeData.children)도 재귀적으로 DRAW로 변환.
 */
function emitDrawCommands(
  skiaData: SkiaNodeData,
  internalChildren: SkiaNodeData[] | undefined,
  width: number,
  height: number,
  commands: RenderCommand[],
): void {
  // 자체 렌더 (box, text, image 등)
  if (skiaData.type !== "container") {
    commands.push({
      type: CMD_DRAW,
      nodeType: skiaData.type,
      skiaData: {
        ...skiaData,
        x: 0, // ELEMENT_BEGIN에서 이미 translate됨
        y: 0,
        width,
        height,
        children: undefined, // 내부 자식은 별도 처리
      },
      width,
      height,
    });
  }

  // 내부 자식 DRAW (spec shapes 등)
  if (internalChildren) {
    for (const child of internalChildren) {
      emitInternalChildDraw(child, commands);
    }
  }
}

/**
 * 내부 자식 (SkiaNodeData.children)을 재귀적으로 DRAW로 변환.
 * 이들은 element가 아닌 spec shapes 등의 렌더 노드.
 */
function emitInternalChildDraw(
  node: SkiaNodeData,
  commands: RenderCommand[],
): void {
  // 내부 자식은 element가 아니므로 ELEMENT_BEGIN/END 없이
  // 부모의 save/restore 컨텍스트 안에서 DRAW만 발행.
  // 단, 이들이 독립적인 위치를 가질 수 있으므로 별도 ELEMENT_BEGIN/END로 감싸야 한다.
  commands.push({
    type: CMD_ELEMENT_BEGIN,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    elementId: "", // 내부 자식은 elementId 없음
    visible: node.visible ?? true,
    transform: node.transform,
    clipPath: node.clipPath,
    blendMode: node.blendMode,
    effects: node.effects,
  });

  if (node.type !== "container") {
    commands.push({
      type: CMD_DRAW,
      nodeType: node.type,
      skiaData: {
        ...node,
        x: 0,
        y: 0,
        children: undefined,
      },
      width: node.width,
      height: node.height,
    });
  }

  // 재귀: 내부 자식의 자식
  if (node.children) {
    for (const child of node.children) {
      emitInternalChildDraw(child, commands);
    }
  }

  // 실제 saveLayer 를 여는 effect 수만 센다(inner drop-shadow 제외) — beginRenderEffects 정합.
  const effectCount = node.effects ? countEffectLayers(node.effects) : 0;
  commands.push({
    type: CMD_ELEMENT_END,
    hasBlend: !!(node.blendMode && node.blendMode !== "normal"),
    effectLayerCount: effectCount,
  });
}

// ── executeRenderCommands ─────────────────────────────────────────────

/**
 * RenderCommand[] 플랫 배열을 선형 for 루프로 실행하여 CanvasKit 드로콜 발행.
 *
 * `selfSpans` 전달 시 (command stream 경로) 노드 Picture 캐시가 활성화된다 —
 * 내용이 바뀌지 않은 요소의 self-draw 블록은 record 된 SkPicture 재생으로 대체
 * (ADR-153 Phase 3). tree fallback 경로는 selfSpans 가 없어 종전과 동일하다.
 */
export function executeRenderCommands(
  ck: CanvasKit,
  canvas: Canvas,
  commands: RenderCommand[],
  cullingBounds: DOMRect,
  fontMgr?: FontMgr,
  selfSpans?: ReadonlyMap<string, SelfSpan>,
): void {
  if (process.env.NODE_ENV === "development") {
    addCommandCount(commands.length);
  }
  const spans =
    selfSpans && selfSpans.size > 0 && isNodePictureCacheEnabled()
      ? selfSpans
      : undefined;
  // 폰트 로딩으로 fontMgr 교체 시 record 글리프 stale — 전량 폐기 후 진행
  if (spans) ensureNodePictureFontGeneration(fontMgr ?? null);
  executeCommandRange(
    ck,
    canvas,
    commands,
    0,
    commands.length,
    cullingBounds,
    fontMgr,
    spans,
  );
}

/**
 * 커맨드 배열의 [start, end) 구간을 실행한다.
 *
 * record 재진입: 노드 Picture miss 시 self-draw 구간을 PictureRecorder canvas 로
 * 본 함수 재호출해 기록한다 (spans=undefined → 중첩 캐시 없음, 무컬링 bounds).
 */
function executeCommandRange(
  ck: CanvasKit,
  canvas: Canvas,
  commands: RenderCommand[],
  start: number,
  end: number,
  cullingBounds: DOMRect,
  fontMgr?: FontMgr,
  selfSpans?: ReadonlyMap<string, SelfSpan>,
): void {
  const cullLeft = cullingBounds.x;
  const cullTop = cullingBounds.y;
  const cullRight = cullLeft + cullingBounds.width;
  const cullBottom = cullTop + cullingBounds.height;

  // 절대좌표 추적 스택 (컬링용)
  const translateStack: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  let stackTop = 0;

  // 현재 요소 ID 스택 (편집 중 텍스트 숨김용)
  const elementIdStack: string[] = [""];
  let eidTop = 0;
  const editingId = getEditingElementId();

  // 비가시 요소 스킵 카운터
  let skipDepth = 0;

  // 드래그 반투명 레이어 추적 스택 (ELEMENT_BEGIN/END 쌍 대응)
  const dragAlphaStack: boolean[] = [];

  // CHILDREN_BEGIN/END 스크롤 오프셋 스택 (컬링 절대좌표를 canvas.translate와 동기화)
  const scrollDeltaStack: Array<{ dx: number; dy: number }> = [];

  // mask-image 레이어 스택: 요소별 마스크 정보 저장
  // ELEMENT_BEGIN에서 mask 있으면 push, ELEMENT_END에서 pop 후 합성
  interface MaskLayerEntry {
    maskImage: MaskImageStyle;
    width: number;
    height: number;
    /** mask를 실제로 적용하는 함수 (저장 시점의 canvas context 캡처) */
    apply: () => void;
  }
  const maskLayerStack: Array<MaskLayerEntry | null> = [];

  for (let i = start; i < end; i++) {
    const cmd = commands[i];

    // 비가시 요소 스킵
    if (skipDepth > 0) {
      if (cmd.type === CMD_ELEMENT_BEGIN) {
        skipDepth++;
      } else if (cmd.type === CMD_ELEMENT_END) {
        skipDepth--;
      }
      continue;
    }

    switch (cmd.type) {
      case CMD_ELEMENT_BEGIN: {
        if (!cmd.visible) {
          skipDepth = 1;
          continue;
        }

        // Pencil deferred-drop: 드래그 대상/형제 오프셋은 culling에도 반영한다.
        const dragOff = getDragVisualOffset();
        const hasDragOffset =
          dragOff !== null && cmd.elementId === dragOff.elementId;
        const sibOff = !hasDragOffset
          ? getSiblingOffset(cmd.elementId)
          : undefined;
        const dox = hasDragOffset ? dragOff.dx : (sibOff?.dx ?? 0);
        const doy = hasDragOffset ? dragOff.dy : (sibOff?.dy ?? 0);

        // AABB 컬링 (width/height=0 가상 컨테이너는 스킵)
        if (cmd.width > 0 || cmd.height > 0) {
          const parent = translateStack[stackTop];
          const nodeLeft = parent.x + cmd.x + dox;
          const nodeTop = parent.y + cmd.y + doy;
          const nodeRight = nodeLeft + cmd.width;
          const nodeBottom = nodeTop + cmd.height;
          if (
            cullLeft > nodeRight ||
            cullRight < nodeLeft ||
            cullTop > nodeBottom ||
            cullBottom < nodeTop
          ) {
            skipDepth = 1;
            continue;
          }
        }

        // elementId 스택 갱신 (편집 중 텍스트 숨김용)
        // 실제 element의 ELEMENT_BEGIN은 non-empty elementId를 가짐
        // 내부 자식(spec shapes)은 빈 문자열 → 부모 elementId를 유지
        eidTop++;
        if (eidTop >= elementIdStack.length) {
          elementIdStack.push(cmd.elementId || elementIdStack[eidTop - 1]);
        } else {
          elementIdStack[eidTop] = cmd.elementId || elementIdStack[eidTop - 1];
        }

        // translate 스택 갱신
        const parentPos = translateStack[stackTop];
        stackTop++;
        if (stackTop >= translateStack.length) {
          translateStack.push({
            x: parentPos.x + cmd.x + dox,
            y: parentPos.y + cmd.y + doy,
          });
        } else {
          translateStack[stackTop] = {
            x: parentPos.x + cmd.x + dox,
            y: parentPos.y + cmd.y + doy,
          };
        }

        canvas.save();
        // position: fixed — camera 역보정 인프라 (TODO: cameraX/Y 파라미터 수신 후 활성화)
        // 현재는 buildRenderCommandStream에서 이미 보정된 좌표를 사용하므로
        // translate는 일반 경로와 동일하게 처리.
        // 향후: executeRenderCommands(ck, canvas, commands, bounds, fontMgr, cameraX, cameraY)
        // 로 시그니처 확장 후 isFixed 요소에 canvas.translate(-cameraX, -cameraY) 적용.
        canvas.translate(cmd.x + dox, cmd.y + doy);

        // A-8: 드래그 중인 요소 반투명 처리
        if (hasDragOffset) {
          const alphaPaint = acquirePooledPaint(ck);
          alphaPaint.setAlphaf(DRAG_ELEMENT_ALPHA);
          canvas.saveLayer(alphaPaint);
          releasePooledPaint(alphaPaint);
          dragAlphaStack.push(true);
        } else {
          dragAlphaStack.push(false);
        }

        if (cmd.transform) {
          canvas.concat(cmd.transform);
        }

        if (cmd.clipPath) {
          const clipP = buildClipPath(ck, cmd.clipPath, cmd.width, cmd.height);
          if (clipP) {
            canvas.clipPath(clipP, ck.ClipOp.Intersect, true);
            clipP.delete();
          }
        }

        if (cmd.blendMode && cmd.blendMode !== "normal") {
          const blendPaint = acquirePooledPaint(ck);
          blendPaint.setBlendMode(
            toSkiaBlendMode(ck, cmd.blendMode) as Parameters<
              typeof blendPaint.setBlendMode
            >[0],
          );
          canvas.saveLayer(blendPaint);
          releasePooledPaint(blendPaint);
        }

        if (cmd.effects) {
          beginRenderEffects(ck, canvas, cmd.effects);
        }

        // mask-image: 이 요소의 모든 드로콜을 offscreen에 캡처하기 위해
        // saveLayer를 추가로 호출한다. ELEMENT_END에서 mask 합성 후 restore.
        if (
          cmd.maskImage &&
          cmd.maskImage.type === "gradient" &&
          cmd.maskImage.gradient
        ) {
          const maskInfo = cmd.maskImage;
          const maskWidth = cmd.width;
          const maskHeight = cmd.height;
          canvas.saveLayer();
          maskLayerStack.push({
            maskImage: maskInfo,
            width: maskWidth,
            height: maskHeight,
            apply: () => {
              // saveLayer로 캡처된 layer 위에 DstIn 블렌드로 gradient mask 그리기
              const maskShader = buildMaskGradientShader(
                ck,
                maskInfo.gradient!,
              );
              if (!maskShader) return;
              try {
                const mode = determineMaskMode(
                  undefined,
                  "gradient",
                  maskInfo.mode,
                );
                applyMaskImage(
                  ck,
                  canvas,
                  maskWidth,
                  maskHeight,
                  maskShader,
                  mode,
                  // content는 이미 saveLayer로 캡처되어 있으므로 빈 콜백
                  // 실제 합성은 applyMaskImage 내부의 drawRect(DstIn)로 처리
                  () => {},
                );
              } finally {
                maskShader.delete();
              }
            },
          });
        } else if (
          cmd.maskImage &&
          cmd.maskImage.type === "image" &&
          cmd.maskImage.imageUrl
        ) {
          // image mask: imageCache에서 SkImage 조회
          const maskSkImage = getSkImage(cmd.maskImage.imageUrl);
          if (maskSkImage) {
            const maskInfo = cmd.maskImage;
            const maskWidth = cmd.width;
            const maskHeight = cmd.height;
            canvas.saveLayer();
            maskLayerStack.push({
              maskImage: maskInfo,
              width: maskWidth,
              height: maskHeight,
              apply: () => {
                const imgShader = (
                  maskSkImage as {
                    makeShaderOptions(
                      tx: unknown,
                      ty: unknown,
                      fm: unknown,
                      mm: unknown,
                    ): { delete(): void };
                  }
                ).makeShaderOptions(
                  ck.TileMode.Clamp,
                  ck.TileMode.Clamp,
                  ck.FilterMode.Linear,
                  ck.MipmapMode.None,
                );
                try {
                  const mode = determineMaskMode(
                    maskInfo.imageUrl,
                    undefined,
                    maskInfo.mode,
                  );
                  applyMaskImage(
                    ck,
                    canvas,
                    maskWidth,
                    maskHeight,
                    imgShader,
                    mode,
                    () => {},
                  );
                } finally {
                  imgShader.delete();
                }
              },
            });
          } else {
            // 이미지 미로딩 → 비동기 로드 트리거, 이번 프레임은 mask 없이
            loadSkImage(cmd.maskImage.imageUrl);
            maskLayerStack.push(null);
          }
        } else {
          maskLayerStack.push(null);
        }

        // 노드 Picture 캐시 (ADR-153 Phase 3): BEGIN 상태(translate/alpha/transform/
        // clip/blend/effects/mask)가 모두 적용된 뒤이므로, self-draw 구간을 record 된
        // Picture 재생으로 대체할 수 있다. 성공 시 구간을 건너뛴다.
        if (selfSpans) {
          const span = selfSpans.get(cmd.elementId);
          if (
            span &&
            drawSelfSpanViaPicture(
              ck,
              canvas,
              commands,
              span,
              cmd,
              fontMgr,
              editingId,
            )
          ) {
            i = span.end - 1; // 루프 i++ 로 구간 종료 지점에 도달
          }
        }
        break;
      }

      case CMD_DRAW: {
        if (process.env.NODE_ENV === "development") {
          incrementDrawCall();
        }
        // 타입별 렌더링 디스패치
        switch (cmd.nodeType) {
          case "box":
            renderBox(ck, canvas, cmd.skiaData);
            break;
          case "text":
            if (cmd.skiaData.box) renderBox(ck, canvas, cmd.skiaData);
            // Pencil hideText: 편집 중인 요소의 텍스트만 숨김 (배경/보더 유지)
            if (fontMgr && !(editingId && elementIdStack[eidTop] === editingId))
              renderText(ck, canvas, cmd.skiaData, fontMgr);
            break;
          case "image":
            renderImage(ck, canvas, cmd.skiaData);
            break;
          case "line":
            renderLine(ck, canvas, cmd.skiaData);
            break;
          case "icon_path":
            renderIconPath(ck, canvas, cmd.skiaData);
            break;
          case "partial_border":
            renderPartialBorder(ck, canvas, cmd.skiaData);
            break;
          case "container":
            break;
        }
        break;
      }

      case CMD_CHILDREN_BEGIN: {
        if (cmd.clipChildren && cmd.width > 0 && cmd.height > 0) {
          canvas.save();
          const clipRect = ck.LTRBRect(0, 0, cmd.width, cmd.height);
          canvas.clipRect(clipRect, ck.ClipOp.Intersect, true);
        }

        if (
          cmd.scrollOffset &&
          (cmd.scrollOffset.scrollTop !== 0 ||
            cmd.scrollOffset.scrollLeft !== 0)
        ) {
          canvas.save();
          canvas.translate(
            -cmd.scrollOffset.scrollLeft,
            -cmd.scrollOffset.scrollTop,
          );
          // 컬링용 절대좌표 스택에도 동일 스크롤 반영 — 미반영 시 스크롤로
          // 뷰포트에 들어온 자식이 스크롤 전 좌표로 판정되어 오컬링된다.
          const top = translateStack[stackTop];
          translateStack[stackTop] = {
            x: top.x - cmd.scrollOffset.scrollLeft,
            y: top.y - cmd.scrollOffset.scrollTop,
          };
          scrollDeltaStack.push({
            dx: cmd.scrollOffset.scrollLeft,
            dy: cmd.scrollOffset.scrollTop,
          });
        }
        break;
      }

      case CMD_CHILDREN_END: {
        if (cmd.hasScrollOffset) {
          canvas.restore();
          const delta = scrollDeltaStack.pop();
          if (delta) {
            const top = translateStack[stackTop];
            translateStack[stackTop] = {
              x: top.x + delta.dx,
              y: top.y + delta.dy,
            };
          }
        }

        if (cmd.scrollbar && cmd.scrollbarNode) {
          renderScrollbar(ck, canvas, cmd.scrollbarNode);
        }

        if (cmd.clipChildren) {
          canvas.restore();
        }
        break;
      }

      case CMD_ELEMENT_END: {
        endRenderEffects(canvas, cmd.effectLayerCount);
        if (cmd.hasBlend) canvas.restore();
        // A-8: 드래그 반투명 레이어 복원
        const hadDragAlpha = dragAlphaStack.pop();
        if (hadDragAlpha) canvas.restore();
        // mask-image: saveLayer 복원 후 mask gradient 합성
        const maskEntry = maskLayerStack.pop();
        if (maskEntry) {
          canvas.restore(); // saveLayer(content) 복원
          maskEntry.apply(); // DstIn gradient 드로콜
        }
        canvas.restore();
        if (stackTop > 0) stackTop--;
        if (eidTop > 0) eidTop--;
        break;
      }
    }
  }
}

// ── 노드 Picture 캐시 record/replay (ADR-153 Phase 3) ─────────────────

/**
 * record 는 무컬링 — cullRect/뷰포트 밖 op 이 유실되면 카메라 이동 후 replay 에서
 * 콘텐츠가 비므로, 충분히 큰 경계를 쓴다.
 */
const RECORD_CULL_EXTENT = 1_000_000;
const RECORD_BOUNDS = {
  x: -RECORD_CULL_EXTENT,
  y: -RECORD_CULL_EXTENT,
  width: RECORD_CULL_EXTENT * 2,
  height: RECORD_CULL_EXTENT * 2,
} as DOMRect;

/**
 * `RECORD_BOUNDS` 의 CanvasKit 표현. 상수값이라 한 번만 만든다 —
 * 캐시 전량 폐기 직후 프레임은 전 요소가 record 를 타므로 그 버스트에서
 * 같은 Float32Array 를 요소 수만큼 재할당하게 된다.
 */
let recordRect: ReturnType<CanvasKit["LTRBRect"]> | null = null;
function getRecordRect(ck: CanvasKit): ReturnType<CanvasKit["LTRBRect"]> {
  recordRect ??= ck.LTRBRect(
    -RECORD_CULL_EXTENT,
    -RECORD_CULL_EXTENT,
    RECORD_CULL_EXTENT,
    RECORD_CULL_EXTENT,
  );
  return recordRect;
}

/**
 * self-draw 구간을 Picture 재생으로 대체 시도한다.
 *
 * @returns true = replay 수행(구간 skip 가능) / false = direct 경로로 폴백
 */
function drawSelfSpanViaPicture(
  ck: CanvasKit,
  canvas: Canvas,
  commands: RenderCommand[],
  span: SelfSpan,
  cmd: ElementBeginCmd,
  fontMgr: FontMgr | undefined,
  editingId: string | null,
): boolean {
  const elementId = cmd.elementId;

  // 텍스트 편집 중 숨김은 direct 경로 전용 로직 — 캐시 우회 (record 도 안 함)
  if (editingId === elementId) return false;

  // transition/animation tick 이 skiaData 를 in-place mutate 하는 구간 —
  // identity 키가 변경을 못 보므로 캐시 우회 + 기존 항목 폐기 (r1 M1 volatile 면제)
  if (isVolatileNode(elementId)) {
    invalidateNodePicture(elementId);
    return false;
  }

  const dataRef = getSkiaNode(elementId);
  if (!dataRef) return false;

  let picture = getCachedNodePicture(elementId, dataRef, cmd.width, cmd.height);
  if (!picture) {
    picture = recordSelfSpan(ck, commands, span, elementId, fontMgr);
    if (!picture) return false; // record 실패 → direct draw 폴백
    storeNodePicture(
      elementId,
      dataRef,
      cmd.width,
      cmd.height,
      picture,
      collectSpanImageRefs(commands, span),
    );
  }

  canvas.drawPicture(picture);
  if (process.env.NODE_ENV === "development") {
    incrementDrawCall();
  }
  return true;
}

/** self-draw 구간을 노드-로컬 좌표로 record 한다. 실패 시 null (direct 폴백). */
function recordSelfSpan(
  ck: CanvasKit,
  commands: RenderCommand[],
  span: SelfSpan,
  elementId: string,
  fontMgr: FontMgr | undefined,
): SkPicture | null {
  const recorder = new ck.PictureRecorder();
  try {
    const recCanvas = recorder.beginRecording(getRecordRect(ck));
    // spans=undefined → record 중 중첩 캐시 없음 (구간 안은 내부 자식 wrapper 뿐)
    executeCommandRange(
      ck,
      recCanvas,
      commands,
      span.start,
      span.end,
      RECORD_BOUNDS,
      fontMgr,
      undefined,
    );
    return recorder.finishRecordingAsPicture() ?? null;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[nodePictureCache] record 실패 — direct draw 폴백:",
        elementId,
        e,
      );
    }
    return null;
  } finally {
    recorder.delete();
  }
}

/** 구간이 참조하는 SkImage 수집 — imageCache 퇴거 역참조 인덱스용 (R2) */
function collectSpanImageRefs(
  commands: RenderCommand[],
  span: SelfSpan,
): SkImage[] | null {
  let refs: SkImage[] | null = null;
  for (let i = span.start; i < span.end; i++) {
    const c = commands[i];
    if (c.type !== CMD_DRAW) continue;
    const img = c.skiaData.image?.skImage;
    if (img) (refs ??= []).push(img);
  }
  return refs;
}

/**
 * boundsMap + skiaNodeRegistry에서 AI 이펙트 대상의 AIEffectNodeBounds를 구성.
 * buildNodeBoundsMap() DFS를 대체한다.
 */
export function buildAIBoundsFromStream(
  boundsMap: Map<string, BoundingBox>,
  targetIds: Set<string>,
): Map<string, AIEffectNodeBounds> {
  const result = new Map<string, AIEffectNodeBounds>();
  for (const id of targetIds) {
    const bounds = boundsMap.get(id);
    if (!bounds) continue;
    const node = getSkiaNode(id);
    const borderRadius = node?.box
      ? Array.isArray(node.box.borderRadius)
        ? node.box.borderRadius[0]
        : (node.box.borderRadius ?? 0)
      : 0;
    result.set(id, {
      elementId: id,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      borderRadius,
    });
  }
  return result;
}
