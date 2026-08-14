import { resolveEffectiveOverflow } from "../layout/engines/implicitStyles";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { BoundingBox } from "../selection/types";
import type { ElementBounds, PageFrame } from "./workflowRenderer";
import {
  readPagePositionDelta,
  type PagePositionPresentationSnapshot,
} from "../interaction/pagePositionPresentation";

export function buildPageFrameMap(
  pageFrames: PageFrame[],
  pagePositionSnapshot?: PagePositionPresentationSnapshot,
): Map<string, PageFrame> {
  const pageFrameMap = new Map<string, PageFrame>();
  for (const frame of pageFrames) {
    const delta = pagePositionSnapshot
      ? readPagePositionDelta(frame.id, pagePositionSnapshot)
      : null;
    pageFrameMap.set(
      frame.id,
      delta
        ? { ...frame, x: frame.x + delta.dx, y: frame.y + delta.dy }
        : frame,
    );
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

/** 자손 하강 상한 — 순환/비정상 깊이 방어 (`computeScrollExtent` 와 동형). */
const OVERFLOW_DESCENT_MAX_DEPTH = 32;

/**
 * 넘침으로 칠 최소 초과량(scene px).
 *
 * 엔진 f32 ↔ JS f64 경계에서 자식이 부모를 0.0001px 넘는 일이 생긴다(layout-engine.md
 * "f32 `Math.ceil` 보정"). chrome 은 초과분에 1/zoom 두께 stroke 를 그리므로 그런 잔차도
 * 화면상 1px 선으로 보인다 — catalog 로만 `overflow:hidden` 인 컨테이너(Card 등)까지 대상이
 * 넓어진 만큼 여기서 걸러낸다. 사용자가 알아볼 넘침은 이 값보다 훨씬 크다.
 */
const OVERFLOW_EPSILON = 0.5;

/**
 * 요소의 effective overflow — raw `props.style` 우선, 없으면 catalog `containerStyles`.
 *
 * ref instance 는 resolved type(`componentName`) 으로 조회한다 (fullTreeLayout GAP 4 동형).
 */
function resolveNodeOverflow(
  node: CanvasSceneNode | undefined,
): string | undefined {
  if (!node) return undefined;
  const type =
    (typeof node.componentName === "string" ? node.componentName : undefined) ??
    node.type;
  return resolveEffectiveOverflow(
    type,
    node.props?.style as Record<string, unknown> | undefined,
  );
}

/**
 * overflow 컨테이너별로 **경계 밖으로 나간 자손**을 수집하여 맵을 반환한다.
 *
 * overflow === "visible" 또는 overflow 없는 요소는 건너뛴다.
 *
 * **Why 자손까지 보는가**: 넘침은 `overflow: visible` 인 중간 노드를 통과해 올라온다
 * (CSS-OVERFLOW-3 §3). 프레임을 적용한 페이지가 정확히 그 형태다 —
 * `body(overflow:auto) > Slot(visible) > 실제 콘텐츠`. 슬롯은 페이지 높이에 딱 맞으므로
 * 직계만 보면 "넘치는 게 없다" 가 되어 hover 오버레이·해칭 chrome 이 아예 안 나왔다.
 * 같은 전제로 스크롤 발화가 죽어 있던 것이 `computeScrollExtent` (fullTreeLayout GAP 4).
 *
 * 하강은 두 지점에서 멈춘다:
 * - **자기 클립을 가진 자손** — 그쪽이 자기 경계로 흡수하므로 더 안쪽은 이 컨테이너를 못 넘는다.
 * - **이미 밖으로 나간 자손** — 그 노드의 사각형이 넘침을 대표한다. 계속 내려가면 같은 영역에
 *   반투명 fill 이 겹쳐 쌓인다.
 *
 * 그 결과 각 노드는 **가장 가까운 클립 조상** 하나에만 귀속되어, 전체 순회 비용은 O(N) 이고
 * `buildChildOverflowContextMap` 의 id→context 매핑도 모호해지지 않는다.
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

    const overflow = resolveNodeOverflow(el);
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

    const stack = children.map((child) => ({ id: child.id, depth: 0 }));
    const seen = new Set<string>();
    while (stack.length > 0) {
      const { id, depth } = stack.pop()!;
      if (seen.has(id)) continue; // 순환 방어
      seen.add(id);

      const b = treeBoundsMap.get(id);
      if (!b) continue;

      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);

      if (
        b.x < cx - OVERFLOW_EPSILON ||
        b.y < cy - OVERFLOW_EPSILON ||
        b.x + b.width > cr + OVERFLOW_EPSILON ||
        b.y + b.height > cb + OVERFLOW_EPSILON
      ) {
        overflowChildren.push({ id, bounds: b });
        continue;
      }

      if (depth >= OVERFLOW_DESCENT_MAX_DEPTH) continue;
      const childOverflow = resolveNodeOverflow(elementsMap.get(id));
      if (childOverflow != null && childOverflow !== "visible") continue;
      for (const grandChild of childrenMap.get(id) ?? []) {
        stack.push({ id: grandChild.id, depth: depth + 1 });
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
let _cachedOverflowInfoSource: Map<string, BoundingBox> | null = null;

/**
 * buildOverflowInfoMap()의 캐시 래퍼.
 * registryVersion + pagePosVersion + **treeBoundsMap 참조**가 같으면 이전 결과를 반환한다.
 *
 * **Why 참조까지 보는가**: 상류(command stream 의 boundsMap)는 스크롤이 바뀌면 새 맵을
 * 낸다 (자식 좌표에서 부모 `scrollOffset` 을 차감하므로). 버전 두 개만 비교하면 스크롤
 * 후에도 **스크롤 전 좌표로 만든** 오버레이가 그대로 재사용된다. 상류 캐시 키를 여기서
 * 다시 나열해 맞추는 대신 결과 참조를 그대로 키로 삼는다 — 상류가 키를 늘려도 어긋나지
 * 않는다 (`getCachedChildOverflowContextMap` 과 같은 어법).
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
    _cachedOverflowInfoSource === treeBoundsMap &&
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
  _cachedOverflowInfoSource = treeBoundsMap;

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
