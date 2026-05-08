import { useCallback, useMemo } from "react";
import type { Element } from "../../../../types/core/store.types";
import { getElementBoundsSimple } from "../elementRegistry";
import type { BoundingBox } from "../selection";
import {
  viewportToScreenPoint,
  viewportToScreenSize,
} from "../viewport/viewportTransforms";
import { sameLegacyOwnership } from "@/adapters/canonical";
import { getActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
import { parseZIndex } from "../layout/engines/cssStackingContext";

interface UseCanvasDragDropHelpersParams {
  depthMap: Map<string, number>;
  elementById: Map<string, Element>;
  elements: Element[];
  pageElements: Element[];
  pageHeight: number;
  pageWidth: number;
  panOffset: { x: number; y: number };
  zoom: number;
}

function readElementZIndex(element: Element): number {
  const style = element.props?.style as Record<string, unknown> | undefined;
  const zIndex = style?.zIndex;
  return (
    parseZIndex(
      typeof zIndex === "number" || typeof zIndex === "string"
        ? zIndex
        : undefined,
    ) ?? 0
  );
}

export function useCanvasDragDropHelpers({
  depthMap,
  elementById,
  elements,
  pageElements,
  pageHeight,
  pageWidth,
  panOffset,
  zoom,
}: UseCanvasDragDropHelpersParams) {
  const childrenByParentId = useMemo(
    () => buildChildrenMapFromElements(elements),
    [elements],
  );

  const sourceIndexById = useMemo(() => {
    const indexes = new Map<string, number>();
    elements.forEach((element, index) => {
      if (!indexes.has(element.id)) {
        indexes.set(element.id, index);
      }
    });
    return indexes;
  }, [elements]);

  const findElementsInLassoArea = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const startGlobal = viewportToScreenPoint(start, zoom, panOffset);
      const endGlobal = viewportToScreenPoint(end, zoom, panOffset);

      const lassoLeft = Math.min(startGlobal.x, endGlobal.x);
      const lassoTop = Math.min(startGlobal.y, endGlobal.y);
      const lassoRight = Math.max(startGlobal.x, endGlobal.x);
      const lassoBottom = Math.max(startGlobal.y, endGlobal.y);

      return pageElements
        .map((element) => {
          const bounds = getElementBoundsSimple(element.id);
          if (bounds) return { id: element.id, bounds };

          const style = element.props?.style as
            | Record<string, unknown>
            | undefined;
          const localLeft = Number(style?.left ?? 0);
          const localTop = Number(style?.top ?? 0);
          const localWidth = Number(style?.width ?? 0);
          const localHeight = Number(style?.height ?? 0);
          const fallbackPosition = viewportToScreenPoint(
            { x: localLeft, y: localTop },
            zoom,
            panOffset,
          );
          const fallbackSize = viewportToScreenSize(
            { width: localWidth, height: localHeight },
            zoom,
          );

          return {
            id: element.id,
            bounds: {
              x: Number.isFinite(localLeft) ? fallbackPosition.x : 0,
              y: Number.isFinite(localTop) ? fallbackPosition.y : 0,
              width: Number.isFinite(localWidth) ? fallbackSize.width : 0,
              height: Number.isFinite(localHeight) ? fallbackSize.height : 0,
            },
          };
        })
        .filter(({ bounds }) => {
          // 요소의 AABB가 lasso 영역과 교차하면 선택
          return !(
            bounds.x + bounds.width < lassoLeft ||
            bounds.x > lassoRight ||
            bounds.y + bounds.height < lassoTop ||
            bounds.y > lassoBottom
          );
        })
        .map(({ id }) => id);
    },
    [pageElements, panOffset, zoom],
  );

  const getElementBounds = useCallback(
    (element: Element): BoundingBox | null => {
      if (element.type.toLowerCase() === "body") {
        return { x: 0, y: 0, width: pageWidth, height: pageHeight };
      }

      const bounds = getElementBoundsSimple(element.id);
      if (bounds) {
        return bounds;
      }

      const style = element.props?.style as Record<string, unknown> | undefined;
      const width = Number(style?.width);
      const height = Number(style?.height);
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
      }

      return {
        x: Number(style?.left) || 0,
        y: Number(style?.top) || 0,
        width,
        height,
      };
    },
    [pageHeight, pageWidth],
  );

  const getDescendantIds = useCallback(
    (rootId: string) => {
      const result = new Set<string>();
      const stack = [rootId];

      while (stack.length > 0) {
        const currentId = stack.pop();
        if (!currentId) {
          continue;
        }
        const children = childrenByParentId.get(currentId) ?? [];
        for (const child of children) {
          if (result.has(child.id)) {
            continue;
          }
          result.add(child.id);
          stack.push(child.id);
        }
      }

      return result;
    },
    [childrenByParentId],
  );

  const findDropTarget = useCallback(
    (point: { x: number; y: number }, draggedId: string) => {
      const draggedElement = elementById.get(draggedId);
      if (!draggedElement) {
        return null;
      }

      const excludedIds = getDescendantIds(draggedId);
      excludedIds.add(draggedId);

      // ADR-116 projection 제거: drag mousemove hot path 에서 legacy snapshot 을
      // CompositionDocument 로 재구성하지 않는다.
      const doc = getActiveCanonicalDocument();
      if (!doc) return null;

      const candidates: Array<{
        bounds: BoundingBox;
        depth: number;
        element: Element;
      }> = [];

      for (const element of elements) {
        if (element.deleted) continue;
        if (!sameLegacyOwnership(element, draggedElement, doc)) continue;
        if (excludedIds.has(element.id)) continue;

        const bounds = getElementBounds(element);
        if (!bounds) continue;

        const isInside =
          point.x >= bounds.x &&
          point.x <= bounds.x + bounds.width &&
          point.y >= bounds.y &&
          point.y <= bounds.y + bounds.height;
        if (!isInside) continue;

        candidates.push({
          element,
          bounds,
          depth: depthMap.get(element.id) ?? 0,
        });
      }

      if (candidates.length === 0) {
        return null;
      }

      candidates.sort((a, b) => {
        if (a.depth !== b.depth) {
          return b.depth - a.depth;
        }
        const zIndexDiff =
          readElementZIndex(b.element) - readElementZIndex(a.element);
        if (zIndexDiff !== 0) {
          return zIndexDiff;
        }
        return (
          (sourceIndexById.get(b.element.id) ?? -1) -
          (sourceIndexById.get(a.element.id) ?? -1)
        );
      });

      const target = candidates[0];
      const parent =
        target.element.parent_id != null
          ? elementById.get(target.element.parent_id)
          : null;
      const parentStyle = parent?.props?.style as
        | Record<string, unknown>
        | undefined;
      const flexDirection = parentStyle?.flexDirection;
      const isHorizontal =
        flexDirection === "row" || flexDirection === "row-reverse";

      // 자식을 가질 수 있는 컨테이너인지 확인
      const targetChildren = childrenByParentId.get(target.element.id);
      const isContainer =
        target.element.type.toLowerCase() === "body" ||
        (targetChildren && targetChildren.length > 0);

      let dropPosition: "before" | "after" | "on" = isContainer
        ? "on"
        : "before";
      const size = isHorizontal ? target.bounds.width : target.bounds.height;

      if (size > 0 && target.element.parent_id) {
        const offset = isHorizontal
          ? point.x - target.bounds.x
          : point.y - target.bounds.y;
        const ratio = offset / size;
        if (isContainer) {
          // 컨테이너: 가장자리 15%에서만 before/after, 중앙 70%는 on (내부 이동)
          if (ratio <= 0.15) dropPosition = "before";
          else if (ratio >= 0.85) dropPosition = "after";
          else dropPosition = "on";
        } else {
          // 리프 요소: before/after만 (on 불가 — 내부 이동 방지)
          dropPosition = ratio <= 0.5 ? "before" : "after";
        }
      }

      const resolvedParentId =
        dropPosition === "on"
          ? target.element.id
          : (target.element.parent_id ?? null);

      return {
        dropPosition,
        isHorizontal,
        parentId: resolvedParentId,
        targetId: target.element.id,
      };
    },
    [
      depthMap,
      childrenByParentId,
      elementById,
      elements,
      getDescendantIds,
      getElementBounds,
      sourceIndexById,
    ],
  );

  const buildReorderUpdates = useCallback(
    (
      movedId: string,
      targetId: string,
      dropPosition: "before" | "after" | "on",
    ) => {
      const movedElement = elementById.get(movedId);
      const targetElement = elementById.get(targetId);
      if (!movedElement || !targetElement) {
        return [];
      }

      // ADR-116 projection 제거: drop path 도 active canonical document 만 사용.
      const doc = getActiveCanonicalDocument();
      if (!doc) return [];

      if (!sameLegacyOwnership(movedElement, targetElement, doc)) {
        return [];
      }

      const oldParentId = movedElement.parent_id ?? null;
      const newParentId =
        dropPosition === "on"
          ? targetElement.id
          : (targetElement.parent_id ?? null);

      if (
        oldParentId === null &&
        newParentId === null &&
        dropPosition !== "on"
      ) {
        return [];
      }

      const getSiblings = (parentId: string | null, includeMoved = false) =>
        elements.filter((element) => {
          if (element.deleted) return false;
          if (!sameLegacyOwnership(element, movedElement, doc)) return false;
          if ((element.parent_id ?? null) !== parentId) return false;
          if (!includeMoved && element.id === movedId) return false;
          return true;
        });

      const targetSiblings = getSiblings(newParentId);
      const siblingIds = targetSiblings.map((element) => element.id);
      let insertIndex = siblingIds.length;

      if (dropPosition !== "on") {
        const targetIndex = siblingIds.indexOf(targetElement.id);
        if (targetIndex >= 0) {
          insertIndex =
            dropPosition === "before" ? targetIndex : targetIndex + 1;
        }
      }

      const nextIds = siblingIds.slice();
      nextIds.splice(insertIndex, 0, movedId);

      if (oldParentId === newParentId) {
        const currentIds = getSiblings(oldParentId, true).map(
          (element) => element.id,
        );
        if (
          currentIds.length === nextIds.length &&
          currentIds.every((id, index) => id === nextIds[index])
        ) {
          return [];
        }
      }

      return oldParentId !== newParentId
        ? [
            {
              elementId: movedId,
              updates: { parent_id: newParentId },
            },
          ]
        : [];
    },
    [elementById, elements],
  );

  /**
   * Pencil findInsertionIndexInLayout 참조.
   * 포인터 위치와 자식 중심점을 비교하여 삽입 인덱스를 반환한다.
   */
  const computeInsertionIndex = useCallback(
    (
      parentId: string,
      point: { x: number; y: number },
      draggedId: string,
      isHorizontal: boolean,
    ): number => {
      const rawSiblings = childrenByParentId.get(parentId) ?? [];
      const siblings = rawSiblings
        .map((el) => elementById.get(el.id) ?? el)
        .filter((el) => el.id !== draggedId && !el.deleted);

      const pos = isHorizontal ? point.x : point.y;

      for (let i = 0; i < siblings.length; i++) {
        const bounds = getElementBounds(siblings[i]);
        if (!bounds) continue;
        const center = isHorizontal
          ? bounds.x + bounds.width / 2
          : bounds.y + bounds.height / 2;
        if (pos < center) return i;
      }
      return siblings.length;
    },
    [childrenByParentId, elementById, getElementBounds],
  );

  return {
    buildReorderUpdates,
    computeInsertionIndex,
    findDropTarget,
    findElementsInLassoArea,
    getElementBounds,
  };
}

export function buildChildrenMapFromElements(
  elements: readonly Element[],
): Map<string, Element[]> {
  const childrenMap = new Map<string, Element[]>();
  for (const element of elements) {
    if (element.deleted || !element.parent_id) continue;
    const siblings = childrenMap.get(element.parent_id);
    if (siblings) {
      siblings.push(element);
    } else {
      childrenMap.set(element.parent_id, [element]);
    }
  }
  return childrenMap;
}
