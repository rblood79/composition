/**
 * Drop Target Resolver
 *
 * ADR-043 Phase 2: 드래그 중 마우스 위치에서 drop target 컨테이너와
 * insertion index를 결정하는 순수 함수 모듈.
 *
 * 좌표 규칙:
 * - getSceneBounds (renderCommands boundsMap)를 source of truth로 사용 (scene-local 좌표)
 * - layoutBoundsRegistry 사용 금지 (PixiJS global 좌표 — Camera zoom/pan 포함)
 * - Pixi container.getBounds() 사용 금지 (Camera transform 포함 글로벌 좌표)
 *
 * Phase 범위:
 * - 같은 부모 내 reorder만 지원
 * - cross-container 이동은 Phase 4에서 추가
 *
 * @since 2026-03-29 ADR-043 Phase 2
 */

import type { Element } from "../../../../types/builder/unified.types";
import { isLegacyInstanceElement } from "../../../../adapters/canonical/legacyElementFields";
import { parseGapValue, parsePadding4Way } from "@composition/specs";
import type { ElementBounds } from "../elementRegistry";
import { getSceneBounds } from "../skia/renderCommands";
import { getSpecForTag } from "../sprites/tagSpecMap";
import { sortElementsByOrderThenSource } from "../../../utils/elementOrdering";

// ============================================
// Types
// ============================================

export interface DropTarget {
  /** drop target 컨테이너 요소 ID */
  containerId: string;
  /** 삽입 위치 (0-based, 기존 자식들 사이 또는 처음/끝) */
  insertionIndex: number;
  /** 인접 삽입 여부 (기존 요소 사이에 들어가는 경우 true) */
  isAdjacentInsertion: boolean;
  /** 컨테이너의 layout 방향 */
  isHorizontal: boolean;
  /** 컨테이너 bounds (DropIndicator 렌더링용) */
  containerBounds: ElementBounds;
  /** 드래그 대상 제외 후 정렬된 형제 bounds (DropIndicator 렌더링용) */
  siblingBounds: ElementBounds[];
  /** cross-container reparent 여부 */
  isReparent: boolean;
  /** reparent 시 원래 부모 ID */
  originalParentId?: string;
}

/**
 * ADR-043 Phase 3: SkiaOverlay RAF에서 읽는 drop indicator 스냅샷.
 * DropIndicatorState와 동일한 형태로, DropTarget에서 직접 추출한다.
 * BoundingBox 대신 ElementBounds를 사용하여 변환 없이 전달.
 */
export interface DropIndicatorSnapshot {
  targetBounds: ElementBounds;
  insertIndex: number;
  childBounds: ElementBounds[];
  isHorizontal: boolean;
  isReparent?: boolean;
  /** 드래그 요소의 주축 크기 — 삽입 라인이 animated gap 중앙에 위치하도록 보정 */
  dragSize?: number;
  /** scene 좌표계의 실제 삽입 라인 위치. 렌더러 추정 대신 resolver 계약으로 전달한다. */
  insertionLinePosition?: number;
  /** 드롭 시 드래그 요소가 차지할 scene 좌표계 placeholder box. */
  placeholderBounds?: ElementBounds;
}

/** resolveDropTarget에 필요한 store 슬라이스 */
export interface DropTargetStoreSlice {
  elementsMap: Map<string, Element>;
  childrenMap: Map<string, Element[]>;
}

// ============================================
// Internal Utilities
// ============================================

/**
 * bounds 배열에서 커서 위치 기반 insertion index를 결정한다.
 * 커서가 형제 midpoint 앞이면 해당 인덱스, 뒤면 +1.
 */
function findInsertionIndex(
  pos: number,
  bounds: ElementBounds[],
  fallback: number,
  isHorizontal: boolean,
): number {
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i];
    const bStart = isHorizontal ? b.x : b.y;
    const bEnd = bStart + (isHorizontal ? b.width : b.height);
    if (pos < bStart) return i;
    if (pos >= bStart && pos <= bEnd) {
      return pos < (bStart + bEnd) / 2 ? i : i + 1;
    }
  }
  return fallback;
}

const STRUCTURAL_CONTAINER_TYPES = new Set([
  "body",
  "box",
  "card",
  "cardcontent",
  "cardfooter",
  "cardheader",
  "cardpreview",
  "container",
  "frame",
  "group",
  "section",
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * 컨테이너의 주요 flex 방향을 결정한다.
 * inline style 우선, 없으면 Spec.containerStyles 를 fallback 으로 사용한다.
 */
function detectIsHorizontal(element: Element): boolean {
  const style = asRecord(element.props?.style);
  const spec = getSpecForTag(element.type);
  const specStyles = asRecord(spec?.containerStyles);
  const flexDir = style?.flexDirection ?? specStyles?.flexDirection;
  if (flexDir === "row" || flexDir === "row-reverse") return true;

  const display = style?.display ?? specStyles?.display;
  // grid는 기본적으로 row 방향
  if (display === "grid") return true;

  return false;
}

function isBodyElement(element: Element): boolean {
  return element.type?.toLowerCase() === "body";
}

function hasCanonicalRef(element: Element): boolean {
  return typeof (element as Element & { ref?: unknown }).ref === "string";
}

function isComponentInstanceElement(element: Element): boolean {
  return isLegacyInstanceElement(element) || hasCanonicalRef(element);
}

function isExplicitSlotHost(element: Element): boolean {
  return Array.isArray(element.slot);
}

function hasLayoutContainerStyle(element: Element): boolean {
  const style = asRecord(element.props?.style);
  const display = style?.display;
  const flexDirection = style?.flexDirection;
  if (
    display === "flex" ||
    display === "inline-flex" ||
    display === "grid" ||
    flexDirection === "row" ||
    flexDirection === "row-reverse" ||
    flexDirection === "column" ||
    flexDirection === "column-reverse"
  ) {
    return true;
  }

  const spec = getSpecForTag(element.type);
  const specStyles = asRecord(spec?.containerStyles);
  const specDisplay = specStyles?.display;
  const specFlexDirection = specStyles?.flexDirection;
  return (
    specDisplay === "flex" ||
    specDisplay === "inline-flex" ||
    specDisplay === "grid" ||
    specFlexDirection === "row" ||
    specFlexDirection === "row-reverse" ||
    specFlexDirection === "column" ||
    specFlexDirection === "column-reverse"
  );
}

function isInsideGuardedInstance(
  element: Element,
  store: DropTargetStoreSlice,
): boolean {
  let currentId = element.id;
  while (currentId) {
    const current = store.elementsMap.get(currentId);
    if (!current) return false;
    if (isComponentInstanceElement(current)) return true;
    currentId = current.parent_id ?? "";
  }
  return false;
}

function acceptsDraggedElement(
  candidate: Element,
  store: DropTargetStoreSlice,
): boolean {
  if (isBodyElement(candidate)) return true;
  if (isExplicitSlotHost(candidate)) return true;
  if (isInsideGuardedInstance(candidate, store)) return false;

  const type = candidate.type.toLowerCase();
  const hasKnownChildren = store.childrenMap.has(candidate.id);
  const structuralContainer = STRUCTURAL_CONTAINER_TYPES.has(type);

  if (structuralContainer) return true;
  if (hasKnownChildren && hasLayoutContainerStyle(candidate)) return true;

  return false;
}

/**
 * order_num 오름차순으로 자식 요소를 정렬한다.
 * order_num 동률은 childrenMap의 기존 형제 순서를 유지한다.
 * childrenMap에서 반환된 배열은 stale일 수 있으므로
 * elementsMap에서 최신 값을 읽어 order_num 기준 정렬.
 */
function getSortedChildren(
  parentId: string,
  store: DropTargetStoreSlice,
): Element[] {
  const rawChildren = store.childrenMap.get(parentId);
  if (!rawChildren || rawChildren.length === 0) return [];

  // childrenMap props는 stale → elementsMap에서 최신 조회
  const fresh = rawChildren
    .map((c) => store.elementsMap.get(c.id))
    .filter((c): c is Element => c !== undefined);

  return sortElementsByOrderThenSource(fresh, rawChildren);
}

function getBoundedSiblingEntries(
  siblings: Element[],
): Array<{ element: Element; bounds: ElementBounds }> {
  return siblings
    .map((element) => {
      const bounds = getSceneBounds(element.id);
      return bounds ? { element, bounds } : null;
    })
    .filter(
      (
        entry,
      ): entry is {
        element: Element;
        bounds: ElementBounds;
      } => entry !== null,
    );
}

// ============================================
// Cross-Container Helpers
// ============================================

/**
 * 순환 방지: elementId가 ancestorId의 자손인지 확인.
 * (드래그 요소를 자신의 자손 컨테이너로 이동하면 순환 참조 발생)
 */
function isDescendantOf(
  elementId: string,
  ancestorId: string,
  elementsMap: Map<string, Element>,
): boolean {
  let currentId: string | undefined = elementId;
  while (currentId) {
    if (currentId === ancestorId) return true;
    const el = elementsMap.get(currentId);
    currentId = el?.parent_id ?? undefined;
  }
  return false;
}

/**
 * Cross-container drop target 탐색.
 * hitIds에서 유효한 컨테이너 후보를 찾아 가장 깊은 것을 선택.
 */
function resolveCrossContainerDrop(
  scenePoint: { x: number; y: number },
  draggedElementId: string,
  hitIds: string[],
  store: DropTargetStoreSlice,
): DropTarget | null {
  const dragged = store.elementsMap.get(draggedElementId);
  if (!dragged) return null;

  let bestCandidate: { element: Element; depth: number } | null = null;

  for (const hitId of hitIds) {
    if (hitId === draggedElementId) continue;
    if (isDescendantOf(hitId, draggedElementId, store.elementsMap)) continue;

    const hitEl = store.elementsMap.get(hitId);
    if (!hitEl) continue;
    if (hitId === dragged.parent_id) continue; // 현재 부모는 same-parent 로직이 처리
    const isBody = isBodyElement(hitEl);
    if (!isBody && !hitEl.parent_id) continue; // body 외 root 제외

    if (!acceptsDraggedElement(hitEl, store)) continue;

    // depth 계산 (부모 체인 길이)
    let depth = 0;
    let cur: string | undefined = hitId;
    while (cur) {
      depth++;
      const el = store.elementsMap.get(cur);
      cur = el?.parent_id ?? undefined;
    }

    if (!bestCandidate || depth > bestCandidate.depth) {
      bestCandidate = { element: hitEl, depth };
    }
  }

  if (!bestCandidate) return null;

  const container = bestCandidate.element;
  const containerId = container.id;
  const containerBounds = getSceneBounds(containerId);
  if (!containerBounds) return null;

  const isHorizontal = detectIsHorizontal(container);

  // 새 컨테이너의 자식 목록에서 삽입 위치 계산
  const children = getSortedChildren(containerId, store);
  const childBounds: ElementBounds[] = [];
  for (const child of children) {
    const b = getSceneBounds(child.id);
    if (b) childBounds.push(b);
  }

  const pos = isHorizontal ? scenePoint.x : scenePoint.y;
  const insertionIndex = findInsertionIndex(
    pos,
    childBounds,
    children.length,
    isHorizontal,
  );

  return {
    containerId,
    insertionIndex,
    isAdjacentInsertion: false,
    isHorizontal,
    containerBounds,
    siblingBounds: childBounds,
    isReparent: true,
    originalParentId: dragged.parent_id ?? undefined,
  };
}

// ============================================
// Main Resolver
// ============================================

/**
 * scene-local 좌표에서 drop target을 찾는다.
 *
 * 동작:
 * 1. draggedElementId의 부모 컨테이너를 찾는다.
 * 2. 부모의 자식들(드래그 대상 제외)의 layoutBounds를 조회한다.
 * 3. scenePoint와 각 형제의 bounds를 비교하여 insertion index를 결정한다.
 *
 * 반환:
 * - DropTarget: 유효한 drop target이 있는 경우
 * - null: 부모 없음, bounds 없음, body가 부모인데 적절한 위치를 못 찾은 경우
 *
 * 순수 함수 — side effect 없음.
 */
export function resolveDropTarget(
  scenePoint: { x: number; y: number },
  draggedElementId: string,
  store: DropTargetStoreSlice,
  hitTestFn?: (x: number, y: number) => string[],
): DropTarget | null {
  // 1. 드래그 요소 조회
  const dragged = store.elementsMap.get(draggedElementId);
  if (!dragged) return null;

  // 2. 부모 컨테이너 결정
  const parentId = dragged.parent_id;
  if (!parentId) return null;

  const parent = store.elementsMap.get(parentId);
  if (!parent) return null;

  // 3. 컨테이너 bounds 조회 (body 등 bounds 미등록 컨테이너는 자식 bounds로 대체)
  let containerBounds = getSceneBounds(parentId);

  // 4. 컨테이너의 방향 감지
  const isHorizontal = detectIsHorizontal(parent);

  // 5. 드래그 대상을 제외한 형제 요소 (order_num 오름차순)
  const sortedChildren = getSortedChildren(parentId, store);
  const siblings = sortedChildren.filter((c) => c.id !== draggedElementId);

  // 6. 형제 bounds 수집 (layoutBoundsRegistry에 없는 요소는 스킵)
  const siblingBounds: ElementBounds[] = [];
  for (const sibling of siblings) {
    const b = getSceneBounds(sibling.id);
    if (b) siblingBounds.push(b);
  }

  // 6.1 containerBounds가 없으면 (body 등) 자식+드래그 요소 bounds의 합집합으로 대체
  if (!containerBounds && siblingBounds.length > 0) {
    const dragBounds = getSceneBounds(draggedElementId);
    const all = dragBounds ? [...siblingBounds, dragBounds] : siblingBounds;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const b of all) {
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.width > maxX) maxX = b.x + b.width;
      if (b.y + b.height > maxY) maxY = b.y + b.height;
    }
    containerBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
  if (!containerBounds) return null;

  // 7. insertion index 결정.
  // raw bounds midpoint만 쓰면 sibling이 시각적으로 열린 slot 안에서도
  // 원래 자리(no-op)로 판정될 수 있으므로, same-parent는 드래그 요소가
  // 실제 차지할 placeholder center에 가장 가까운 index로 보정한다.
  const pos = isHorizontal ? scenePoint.x : scenePoint.y;
  const rawInsertionIndex = findInsertionIndex(
    pos,
    siblingBounds,
    siblings.length,
    isHorizontal,
  );
  const insertionIndex = findSameParentInsertionIndex(
    pos,
    rawInsertionIndex,
    isHorizontal,
    containerBounds,
    sortedChildren,
    getBoundedSiblingEntries(siblings),
    draggedElementId,
    getSceneBounds(draggedElementId),
    getContainerAxisSpacing(parent, isHorizontal),
  );

  // 8. 현재 드래그 요소의 현재 index를 구해 인접 삽입 여부 판단
  const currentIndex = sortedChildren.findIndex(
    (c) => c.id === draggedElementId,
  );
  const originalInsertIndex =
    currentIndex >= 0 && currentIndex <= insertionIndex
      ? insertionIndex + 1
      : insertionIndex;

  const isAdjacentInsertion =
    originalInsertIndex === currentIndex ||
    originalInsertIndex === currentIndex + 1;

  const sameParentResult: DropTarget = {
    containerId: parentId,
    insertionIndex,
    isAdjacentInsertion,
    isHorizontal,
    containerBounds,
    siblingBounds,
    isReparent: false,
  };

  // 9. hitTestFn이 있으면 cross-container 후보 탐색
  if (hitTestFn) {
    const hitIds = hitTestFn(scenePoint.x, scenePoint.y);
    const crossResult = resolveCrossContainerDrop(
      scenePoint,
      draggedElementId,
      hitIds,
      store,
    );

    // 커서가 현재 부모 bounds 밖인지 판단
    const cursorOutsideParent =
      containerBounds != null &&
      (scenePoint.x < containerBounds.x ||
        scenePoint.x > containerBounds.x + containerBounds.width ||
        scenePoint.y < containerBounds.y ||
        scenePoint.y > containerBounds.y + containerBounds.height);

    if (crossResult) {
      const crossTargetInsideParent = isDescendantOf(
        crossResult.containerId,
        parentId,
        store.elementsMap,
      );
      if (
        cursorOutsideParent ||
        (crossTargetInsideParent && sameParentResult.isAdjacentInsertion)
      ) {
        return crossResult;
      }
    }

    // 커서가 부모 밖인데 cross-container도 없으면 → 조부모로 reparent (그룹에서 꺼내기)
    if (cursorOutsideParent && parent.parent_id) {
      const grandparentId = parent.parent_id;
      const grandparent = store.elementsMap.get(grandparentId);
      if (grandparent) {
        const gpBounds = getSceneBounds(grandparentId);
        if (gpBounds) {
          const gpIsHz = detectIsHorizontal(grandparent);
          const gpChildren = getSortedChildren(grandparentId, store);
          const gpChildBounds: ElementBounds[] = [];
          for (const child of gpChildren) {
            const b = getSceneBounds(child.id);
            if (b) gpChildBounds.push(b);
          }
          const gpPos = gpIsHz ? scenePoint.x : scenePoint.y;
          const gpInsertionIndex = findInsertionIndex(
            gpPos,
            gpChildBounds,
            gpChildren.length,
            gpIsHz,
          );
          return {
            containerId: grandparentId,
            insertionIndex: gpInsertionIndex,
            isAdjacentInsertion: false,
            isHorizontal: gpIsHz,
            containerBounds: gpBounds,
            siblingBounds: gpChildBounds,
            isReparent: true,
            originalParentId: parentId,
          };
        }
      }
    }
  }

  return sameParentResult;
}

// ============================================
// Sibling Visual Offsets (Pencil vacate + insertion)
// ============================================

/**
 * 드래그 중 형제 요소들의 시각적 오프셋을 계산한다.
 *
 * Pencil 패턴:
 * - Vacate: 드래그 요소의 원래 자리를 형제들이 채움 (gap close)
 * - Insertion: 삽입 위치에서 형제들이 공간을 열어줌 (make space)
 *
 * 알고리즘:
 * - origIdx 이후 형제: -(dragSize + gap) (gap close)
 * - insertionIndex 이후 형제: +(dragSize + gap) (make space)
 * - 두 오프셋을 합산
 *
 * @returns elementId → { dx, dy } 맵
 */
export function computeSiblingOffsets(
  dropTarget: DropTarget,
  draggedElementId: string,
  store: DropTargetStoreSlice,
): Map<string, { dx: number; dy: number }> {
  const offsets = new Map<string, { dx: number; dy: number }>();
  const { containerId, insertionIndex, isHorizontal } = dropTarget;
  const container = store.elementsMap.get(containerId);
  const spacing = getContainerAxisSpacing(container, isHorizontal);

  // 전체 자식 (드래그 요소 포함, order_num 오름차순)
  const sortedChildren = getSortedChildren(containerId, store);
  const origIdx = sortedChildren.findIndex((c) => c.id === draggedElementId);
  if (origIdx < 0) return offsets;

  // 드래그 요소의 크기 (layoutBoundsRegistry에서)
  const dragBounds = getSceneBounds(draggedElementId);
  if (!dragBounds) return offsets;
  const dragSize = isHorizontal ? dragBounds.width : dragBounds.height;
  const dragSpan = dragSize + spacing.gap;

  // id → 원래 인덱스 맵 (O(1) lookup, findIndex N² 제거)
  const origIndexMap = buildOriginalIndexMap(sortedChildren);

  const siblings = sortedChildren.filter((c) => c.id !== draggedElementId);

  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    const oi = origIndexMap.get(sibling.id)!;

    const total = computeSameParentSiblingOffsetValue(
      oi,
      i,
      origIdx,
      insertionIndex,
      dragSpan,
    );
    if (total !== 0) {
      offsets.set(sibling.id, {
        dx: isHorizontal ? total : 0,
        dy: isHorizontal ? 0 : total,
      });
    }
  }

  return offsets;
}

function getAxisStart(bounds: ElementBounds, isHorizontal: boolean): number {
  return isHorizontal ? bounds.x : bounds.y;
}

function getAxisEnd(bounds: ElementBounds, isHorizontal: boolean): number {
  return isHorizontal ? bounds.x + bounds.width : bounds.y + bounds.height;
}

function getContainerAxisSpacing(
  element: Element | undefined,
  isHorizontal: boolean,
): { paddingStart: number; paddingEnd: number; gap: number } {
  const style = asRecord(element?.props?.style);
  const padding = parsePadding4Way({
    padding: style?.padding,
    paddingTop: style?.paddingTop,
    paddingRight: style?.paddingRight,
    paddingBottom: style?.paddingBottom,
    paddingLeft: style?.paddingLeft,
  });
  const gap = parseGapValue({
    gap: style?.gap,
    rowGap: style?.rowGap,
    columnGap: style?.columnGap,
  });

  return isHorizontal
    ? {
        paddingStart: padding.left,
        paddingEnd: padding.right,
        gap: gap.column,
      }
    : {
        paddingStart: padding.top,
        paddingEnd: padding.bottom,
        gap: gap.row,
      };
}

function getAxisSize(bounds: ElementBounds, isHorizontal: boolean): number {
  return isHorizontal ? bounds.width : bounds.height;
}

function getCrossStart(bounds: ElementBounds, isHorizontal: boolean): number {
  return isHorizontal ? bounds.y : bounds.x;
}

function getCrossSize(bounds: ElementBounds, isHorizontal: boolean): number {
  return isHorizontal ? bounds.height : bounds.width;
}

function computeSameParentSiblingOffsetValue(
  originalIndex: number,
  siblingIndex: number,
  originalDraggedIndex: number,
  insertionIndex: number,
  dragSpan: number,
): number {
  const closeGap = originalIndex > originalDraggedIndex ? -dragSpan : 0;
  const makeSpace = siblingIndex >= insertionIndex ? dragSpan : 0;
  return closeGap + makeSpace;
}

function buildOriginalIndexMap(children: Element[]): Map<string, number> {
  const indexes = new Map<string, number>();
  for (let i = 0; i < children.length; i++) {
    indexes.set(children[i].id, i);
  }
  return indexes;
}

function computeSameParentInsertionLineFromEntries(
  insertionIndex: number,
  isHorizontal: boolean,
  containerBounds: ElementBounds,
  siblingEntries: Array<{ element: Element; bounds: ElementBounds }>,
  originalIndexMap: Map<string, number>,
  originalDraggedIndex: number,
  dragSpan: number,
  spacing: { paddingStart: number; gap: number },
): number {
  if (siblingEntries.length === 0) {
    return getAxisStart(containerBounds, isHorizontal) + spacing.paddingStart;
  }

  const getOffset = (
    entry: { element: Element; bounds: ElementBounds },
    siblingIndex: number,
  ) =>
    computeSameParentSiblingOffsetValue(
      originalIndexMap.get(entry.element.id) ?? siblingIndex,
      siblingIndex,
      originalDraggedIndex,
      insertionIndex,
      dragSpan,
    );

  if (insertionIndex <= 0) {
    const first = siblingEntries[0];
    return (
      getAxisStart(first.bounds, isHorizontal) + getOffset(first, 0) - dragSpan
    );
  }

  if (insertionIndex >= siblingEntries.length) {
    const lastIndex = siblingEntries.length - 1;
    const last = siblingEntries[lastIndex];
    return (
      getAxisEnd(last.bounds, isHorizontal) +
      getOffset(last, lastIndex) +
      spacing.gap
    );
  }

  const previousIndex = insertionIndex - 1;
  const previous = siblingEntries[previousIndex];
  return (
    getAxisEnd(previous.bounds, isHorizontal) +
    getOffset(previous, previousIndex) +
    spacing.gap
  );
}

function findSameParentInsertionIndex(
  pos: number,
  fallbackIndex: number,
  isHorizontal: boolean,
  containerBounds: ElementBounds,
  sortedChildren: Element[],
  siblingEntries: Array<{ element: Element; bounds: ElementBounds }>,
  draggedElementId: string,
  dragBounds: ElementBounds | undefined,
  spacing: { paddingStart: number; gap: number },
): number {
  if (!dragBounds || siblingEntries.length === 0) return fallbackIndex;

  const originalDraggedIndex = sortedChildren.findIndex(
    (child) => child.id === draggedElementId,
  );
  if (originalDraggedIndex < 0) return fallbackIndex;

  const dragSize = getAxisSize(dragBounds, isHorizontal);
  const dragSpan = dragSize + spacing.gap;
  const originalIndexMap = buildOriginalIndexMap(sortedChildren);
  let bestIndex = fallbackIndex;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index <= siblingEntries.length; index++) {
    const linePosition = computeSameParentInsertionLineFromEntries(
      index,
      isHorizontal,
      containerBounds,
      siblingEntries,
      originalIndexMap,
      originalDraggedIndex,
      dragSpan,
      spacing,
    );
    const distance = Math.abs(pos - (linePosition + dragSize / 2));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

/**
 * Drop indicator line 의 scene 좌표를 계산한다.
 *
 * Cross-container 는 아직 target siblings 를 움직이지 않으므로 새 요소가
 * 실제로 시작될 padding/gap layout boundary 에 라인을 둔다. Same-container
 * reorder 도 형제 visual offset 이후의 실제 layout boundary 를 계산한다.
 */
export function computeInsertionLinePosition(
  dropTarget: DropTarget,
  draggedElementId: string,
  store: DropTargetStoreSlice,
): number | undefined {
  const { containerId, insertionIndex, isHorizontal } = dropTarget;
  const container = store.elementsMap.get(containerId);
  const spacing = getContainerAxisSpacing(container, isHorizontal);
  const sortedChildren = getSortedChildren(containerId, store);
  const siblings = sortedChildren.filter((c) => c.id !== draggedElementId);
  const siblingEntries = getBoundedSiblingEntries(siblings);

  if (siblingEntries.length === 0) {
    return (
      getAxisStart(dropTarget.containerBounds, isHorizontal) +
      spacing.paddingStart
    );
  }

  const originalIndex = sortedChildren.findIndex(
    (child) => child.id === draggedElementId,
  );
  const isReparent = dropTarget.isReparent || originalIndex < 0;

  if (isReparent) {
    if (insertionIndex <= 0) {
      const firstStart = getAxisStart(siblingEntries[0].bounds, isHorizontal);
      const contentStart =
        getAxisStart(dropTarget.containerBounds, isHorizontal) +
        spacing.paddingStart;
      return spacing.paddingStart > 0 ? contentStart : firstStart;
    }
    if (insertionIndex >= siblingEntries.length) {
      const lastEnd = getAxisEnd(
        siblingEntries[siblingEntries.length - 1].bounds,
        isHorizontal,
      );
      const contentEnd =
        getAxisEnd(dropTarget.containerBounds, isHorizontal) -
        spacing.paddingEnd;
      if (spacing.gap > 0) {
        return lastEnd + spacing.gap;
      }
      return spacing.paddingEnd > 0 ? (lastEnd + contentEnd) / 2 : lastEnd;
    }
    if (spacing.gap > 0) {
      return (
        getAxisEnd(siblingEntries[insertionIndex - 1].bounds, isHorizontal) +
        spacing.gap
      );
    }
    return (
      (getAxisEnd(siblingEntries[insertionIndex - 1].bounds, isHorizontal) +
        getAxisStart(siblingEntries[insertionIndex].bounds, isHorizontal)) /
      2
    );
  }

  const dragBounds = getSceneBounds(draggedElementId);
  const dragSize = dragBounds
    ? isHorizontal
      ? dragBounds.width
      : dragBounds.height
    : 0;
  const dragSpan = dragSize + spacing.gap;
  const originalIndexMap = buildOriginalIndexMap(sortedChildren);

  return computeSameParentInsertionLineFromEntries(
    insertionIndex,
    isHorizontal,
    dropTarget.containerBounds,
    siblingEntries,
    originalIndexMap,
    originalIndex,
    dragSpan,
    spacing,
  );
}

export function computeDropPlaceholderBounds(
  dropTarget: DropTarget,
  draggedElementId: string,
  store: DropTargetStoreSlice,
): ElementBounds | undefined {
  const draggedBounds = getSceneBounds(draggedElementId);
  if (!draggedBounds) return undefined;

  const linePosition = computeInsertionLinePosition(
    dropTarget,
    draggedElementId,
    store,
  );
  if (linePosition === undefined) return undefined;

  const { containerId, insertionIndex, isHorizontal } = dropTarget;
  const sortedChildren = getSortedChildren(containerId, store);
  const siblings = sortedChildren.filter((c) => c.id !== draggedElementId);
  const siblingEntries = getBoundedSiblingEntries(siblings);
  const neighbor =
    siblingEntries[Math.min(insertionIndex, siblingEntries.length - 1)] ??
    siblingEntries[insertionIndex - 1];
  const crossStart = !dropTarget.isReparent
    ? getCrossStart(draggedBounds, isHorizontal)
    : neighbor
      ? getCrossStart(neighbor.bounds, isHorizontal)
      : getCrossStart(dropTarget.containerBounds, isHorizontal);
  const crossSize = getCrossSize(draggedBounds, isHorizontal);

  if (isHorizontal) {
    return {
      x: linePosition,
      y: crossStart,
      width: draggedBounds.width,
      height: crossSize,
    };
  }

  return {
    x: crossStart,
    y: linePosition,
    width: crossSize,
    height: draggedBounds.height,
  };
}

// ============================================
// Commit Helper
// ============================================

/**
 * resolveDropTarget 결과를 order_num 업데이트 배열로 변환한다.
 *
 * 드래그 요소를 insertionIndex 위치에 삽입한 후
 * 전체 형제 배열의 order_num을 0-based로 재계산.
 *
 * @returns batchUpdateElementOrders에 전달할 최종 형제 순서 전체.
 *          canonical children 순서도 같은 커밋에서 재작성되도록 unchanged sibling도 포함한다.
 */
export function computeReorderFromDropTarget(
  dropTarget: DropTarget,
  draggedElementId: string,
  store: DropTargetStoreSlice,
): Array<{ id: string; order_num: number }> {
  const { containerId, insertionIndex } = dropTarget;

  // 드래그 대상을 제외한 형제 (order_num 오름차순)
  const sortedChildren = getSortedChildren(containerId, store);
  const siblings = sortedChildren.filter((c) => c.id !== draggedElementId);

  // 드래그 요소를 insertionIndex에 삽입
  const newOrder = [
    ...siblings.slice(0, insertionIndex),
    { id: draggedElementId, order_num: -1 }, // placeholder, 아래서 재할당
    ...siblings.slice(insertionIndex),
  ];

  // 0-based order_num 재계산. 변경 여부와 무관하게 최종 형제 순서 전체를 반환한다.
  const updates: Array<{ id: string; order_num: number }> = [];
  for (let i = 0; i < newOrder.length; i++) {
    const child = newOrder[i];
    const existing = store.elementsMap.get(child.id);
    if (!existing) continue;
    updates.push({ id: child.id, order_num: i });
  }

  return updates;
}
