import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { BoundingBox } from "../selection/types";
import type { SkiaNodeData } from "./nodeRenderers";
import type { ElementBounds, PageFrame } from "./workflowRenderer";

export function buildTreeBoundsMap(
  tree: SkiaNodeData,
): Map<string, BoundingBox> {
  const boundsMap = new Map<string, BoundingBox>();

  function traverse(
    node: SkiaNodeData,
    parentX: number,
    parentY: number,
  ): void {
    const absX = parentX + node.x;
    const absY = parentY + node.y;

    if (node.elementId) {
      boundsMap.set(node.elementId, {
        x: absX,
        y: absY,
        width: node.width,
        height: node.height,
      });
    }

    // 부모의 scrollOffset을 자식 좌표에 반영
    // overflow: scroll 컨테이너의 자식은 스크롤만큼 이동한 위치에 렌더링됨
    const scrollX = node.scrollOffset?.scrollLeft ?? 0;
    const scrollY = node.scrollOffset?.scrollTop ?? 0;

    if (node.children) {
      for (const child of node.children) {
        traverse(child, absX - scrollX, absY - scrollY);
      }
    }
  }

  traverse(tree, 0, 0);
  return boundsMap;
}

export function buildPageFrameMap(
  pageFrames: PageFrame[],
): Map<string, PageFrame> {
  const pageFrameMap = new Map<string, PageFrame>();
  for (const frame of pageFrames) {
    pageFrameMap.set(frame.id, frame);
  }
  return pageFrameMap;
}

// ============================================
// Overflow Content Info — ADR-050 Phase 3
// ============================================

/** overflow 컨테이너의 자식 전체 + 개별 bounds */
export interface OverflowContentInfo {
  containerBounds: BoundingBox;
  contentBounds: BoundingBox;
  overflowChildren: Array<{ id: string; bounds: BoundingBox }>;
  /** overflow 타입 — scroll/auto 시 선택 상태에서 해칭 패턴 표시 */
  overflowType: "hidden" | "clip" | "scroll" | "auto";
}

/** 자식 요소가 속한 overflow 부모 정보 */
export interface ChildOverflowContext {
  /** 부모 컨테이너 bounds (클리핑 영역) */
  containerBounds: BoundingBox;
  /** 자식 요소의 bounds (원본) */
  childBounds: BoundingBox;
  /** 부모의 overflow 타입 */
  overflowType: "hidden" | "clip" | "scroll" | "auto";
}

/**
 * overflow 컨테이너별로 자식 bounds를 수집하여 맵을 반환한다.
 *
 * overflow === "visible" 또는 overflow 없는 요소는 건너뛴다.
 * 컨테이너 경계를 벗어난 자식만 overflowChildBounds에 포함된다.
 */
export function buildOverflowInfoMap(
  treeBoundsMap: Map<string, BoundingBox>,
  elementsMap: Map<string, CanvasSceneNode>,
  childrenMap: Map<string, CanvasSceneNode[]>,
): Map<string, OverflowContentInfo> {
  const result = new Map<string, OverflowContentInfo>();

  for (const [elementId, containerBounds] of treeBoundsMap) {
    const el = elementsMap.get(elementId);
    if (!el) continue;

    const overflow = (el.props?.style as Record<string, unknown>)?.overflow as
      | string
      | undefined;
    if (!overflow || overflow === "visible") continue;

    const children = childrenMap.get(elementId);
    if (!children || children.length === 0) continue;

    const cx = containerBounds.x;
    const cy = containerBounds.y;
    const cr = cx + containerBounds.width;
    const cb = cy + containerBounds.height;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const overflowChildren: Array<{ id: string; bounds: BoundingBox }> = [];

    for (const child of children) {
      const b = treeBoundsMap.get(child.id);
      if (!b) continue;

      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);

      if (b.x < cx || b.y < cy || b.x + b.width > cr || b.y + b.height > cb) {
        overflowChildren.push({ id: child.id, bounds: b });
      }
    }

    if (minX === Infinity || overflowChildren.length === 0) continue;

    result.set(elementId, {
      containerBounds,
      contentBounds: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      overflowChildren,
      overflowType: overflow as "hidden" | "clip" | "scroll" | "auto",
    });
  }

  return result;
}

/**
 * overflowInfoMap에서 자식 ID → 부모 overflow 컨텍스트 역매핑을 생성한다.
 * 선택된 자식 요소가 overflow 영역에 있는지 빠르게 조회하기 위해 사용.
 */
export function buildChildOverflowContextMap(
  overflowInfoMap: Map<string, OverflowContentInfo>,
): Map<string, ChildOverflowContext> {
  const result = new Map<string, ChildOverflowContext>();
  for (const info of overflowInfoMap.values()) {
    for (const child of info.overflowChildren) {
      result.set(child.id, {
        containerBounds: info.containerBounds,
        childBounds: child.bounds,
        overflowType: info.overflowType,
      });
    }
  }
  return result;
}

// ============================================
// Overflow Info Cache
// ============================================

let _cachedOverflowInfoMap: Map<string, OverflowContentInfo> | null = null;
let _cachedOverflowInfoVersion = -1;
let _cachedOverflowInfoPosVersion = -1;

/**
 * buildOverflowInfoMap()의 캐시 래퍼.
 * registryVersion + pagePosVersion이 같으면 이전 결과를 반환한다.
 */
export function getCachedOverflowInfoMap(
  treeBoundsMap: Map<string, BoundingBox>,
  elementsMap: Map<string, CanvasSceneNode>,
  childrenMap: Map<string, CanvasSceneNode[]>,
  registryVersion: number,
  pagePosVersion: number,
): Map<string, OverflowContentInfo> {
  if (
    _cachedOverflowInfoMap !== null &&
    registryVersion === _cachedOverflowInfoVersion &&
    pagePosVersion === _cachedOverflowInfoPosVersion
  ) {
    return _cachedOverflowInfoMap;
  }

  _cachedOverflowInfoMap = buildOverflowInfoMap(
    treeBoundsMap,
    elementsMap,
    childrenMap,
  );
  _cachedOverflowInfoVersion = registryVersion;
  _cachedOverflowInfoPosVersion = pagePosVersion;

  return _cachedOverflowInfoMap;
}

// ============================================
// Child Overflow Context Cache
// ============================================

let _cachedChildCtxMap: Map<string, ChildOverflowContext> | null = null;
let _cachedChildCtxSource: Map<string, OverflowContentInfo> | null = null;

/**
 * buildChildOverflowContextMap()의 참조 비교 캐시 래퍼.
 * overflowInfoMap 참조가 같으면 이전 결과를 반환한다.
 */
export function getCachedChildOverflowContextMap(
  overflowInfoMap: Map<string, OverflowContentInfo>,
): Map<string, ChildOverflowContext> {
  if (
    _cachedChildCtxSource === overflowInfoMap &&
    _cachedChildCtxMap !== null
  ) {
    return _cachedChildCtxMap;
  }
  _cachedChildCtxMap = buildChildOverflowContextMap(overflowInfoMap);
  _cachedChildCtxSource = overflowInfoMap;
  return _cachedChildCtxMap;
}

export function buildElementBoundsMapFromTreeBounds(
  treeBoundsMap: Map<string, BoundingBox>,
): Map<string, ElementBounds> {
  const elementBoundsMap = new Map<string, ElementBounds>();
  for (const [id, bbox] of treeBoundsMap) {
    elementBoundsMap.set(id, {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    });
  }
  return elementBoundsMap;
}
