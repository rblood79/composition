/**
 * useDragBridge — SelectionLayer 드래그 로직의 PixiJS 독립 추출 (ADR-100 Phase 6)
 *
 * SelectionLayer(PixiJS Application 내부)의 useDragInteraction + 콜백 ref 바인딩을
 * PixiJS 외부에서도 동작하도록 추출.
 *
 * ADR-049 Deferred Commit 아키텍처를 그대로 유지:
 * - 드래그 중: setDragVisualOffset + resolveDropTarget + computeSiblingOffsets
 * - 드롭 시: canonical children[] move
 *
 * PixiJS 의존 부분 (SelectionBox setVisible/resetPosition)은 제거.
 * Skia 렌더링이 selection box를 이미 처리하므로 시각적 영향 없음.
 */

import { useEffect, useRef, type MutableRefObject } from "react";
import { useStore } from "../../../stores";
import { useDragInteraction } from "../selection/useDragInteraction";
import {
  resolveDropTarget,
  computeReorderFromDropTarget,
  computeSiblingOffsets,
  computeInsertionLinePosition,
  computeDropPlaceholderBounds,
  type DropTarget,
  type DropIndicatorSnapshot,
} from "../selection/dropTargetResolver";
import {
  setDragVisualOffset,
  setDragSiblingOffsets,
} from "../skia/nodeRendererTree";
import {
  updateAnimationTargets,
  clearAllAnimations,
} from "../skia/dragAnimator";
import { historyManager } from "../../../stores/history";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { visitCanonicalDocumentElements } from "../../../stores/canonical/canonicalElementsView";
import { getDB } from "../../../../lib/db";
import { hitTestPoint } from "../wasm-bindings/spatialIndex";
import { getSceneBounds } from "../skia/renderCommands";
import type { BoundingBox } from "../selection/types";
import { moveElementCanonicalPrimary } from "../../../../adapters/canonical/canonicalMutations";
import type { CanvasInteractionNode } from "../interaction/interactionNode";

type DragSnapshotEntry = {
  id: string;
  page_id?: string | null;
  parent_id?: string | null;
};

type SceneBoundsResolver = (
  elementId: string,
) => BoundingBox | null | undefined;

type DragReadModel = {
  elementsById: ReadonlyMap<string, CanvasInteractionNode>;
  childrenByParent: ReadonlyMap<string, CanvasInteractionNode[]>;
};

type DragReadModelResolvers = {
  getInteractiveElementsMap?: () => Map<string, CanvasInteractionNode>;
  getInteractiveChildrenMap?: () => Map<string, CanvasInteractionNode[]>;
};

interface UseDragBridgeOptions {
  onStartMoveRef: MutableRefObject<
    (
      elementId: string,
      bounds: BoundingBox,
      position: { x: number; y: number },
    ) => void
  >;
  onUpdateDragRef: MutableRefObject<
    (position: { x: number; y: number }) => void
  >;
  onEndDragRef: MutableRefObject<() => void>;
  onCancelDragRef: MutableRefObject<() => void>;
  dropIndicatorSnapshotRef: MutableRefObject<DropIndicatorSnapshot | null>;
  getInteractiveElementsMap?: () => Map<string, CanvasInteractionNode>;
  getInteractiveChildrenMap?: () => Map<string, CanvasInteractionNode[]>;
  /** false이면 ref 바인딩 스킵 (SelectionLayer가 대신 바인딩) */
  enabled?: boolean;
}

function asStyleRecord(
  element: CanvasInteractionNode,
): Record<string, unknown> {
  const style = element.props?.style;
  return style && typeof style === "object" && !Array.isArray(style)
    ? (style as Record<string, unknown>)
    : {};
}

function parsePx(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d+)?(?:px)?$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPx(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}px`;
}

function toDragSnapshotEntry(
  element: CanvasInteractionNode,
): DragSnapshotEntry {
  return {
    id: element.id,
    page_id: element.page_id,
    parent_id: element.parent_id,
  };
}

export function resolveDragReadModel(
  fallback: DragReadModel,
  resolvers: DragReadModelResolvers = {},
): DragReadModel {
  return {
    elementsById:
      resolvers.getInteractiveElementsMap?.() ?? fallback.elementsById,
    childrenByParent:
      resolvers.getInteractiveChildrenMap?.() ?? fallback.childrenByParent,
  };
}

function buildDragReadModelFromElements(
  elements: CanvasInteractionNode[],
): DragReadModel {
  const elementsById = new Map(
    elements.map((element) => [element.id, element]),
  );
  const childrenByParent = new Map<string, CanvasInteractionNode[]>();
  for (const element of elements) {
    if (element.deleted || !element.parent_id) continue;
    const siblings = childrenByParent.get(element.parent_id);
    if (siblings) {
      siblings.push(element);
    } else {
      childrenByParent.set(element.parent_id, [element]);
    }
  }
  return { elementsById, childrenByParent };
}

function buildDragReadModelFromCanonicalDocument(
  doc: Parameters<typeof visitCanonicalDocumentElements>[0],
): DragReadModel {
  const elements: CanvasInteractionNode[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  return buildDragReadModelFromElements(elements);
}

export function collectDragSnapshotEntries(
  elementsById: ReadonlyMap<string, CanvasInteractionNode>,
  childrenByParent: ReadonlyMap<string, CanvasInteractionNode[]>,
  draggedId: string,
): DragSnapshotEntry[] {
  const dragged = elementsById.get(draggedId);
  if (!dragged) return [];

  const entries = new Map<string, DragSnapshotEntry>();
  const addElement = (element: CanvasInteractionNode | undefined): void => {
    if (!element) return;
    entries.set(element.id, toDragSnapshotEntry(element));
  };

  for (const element of elementsById.values()) {
    if (element.parent_id === dragged.parent_id) {
      addElement(element);
    }
  }

  const stack = [draggedId];
  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId) continue;

    addElement(elementsById.get(currentId));

    const children = childrenByParent.get(currentId) ?? [];
    for (const child of children) {
      const childId = child.id;
      if (entries.has(childId)) continue;
      stack.push(childId);
    }
  }

  return Array.from(entries.values());
}

async function persistActiveCanonicalDocument(
  db: Awaited<ReturnType<typeof getDB>>,
): Promise<void> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return;
  const doc = canonical.documents.get(projectId);
  if (!doc) return;
  await db.documents.put(projectId, doc);
}

export function isManualPositionDragTarget(
  element: CanvasInteractionNode | undefined,
): boolean {
  if (!element || element.deleted) {
    return false;
  }

  const style = asStyleRecord(element);
  return style.position === "absolute";
}

export function resolveManualPositionDragProps(
  element: CanvasInteractionNode | undefined,
  delta: { x: number; y: number },
  getBounds: SceneBoundsResolver = getSceneBounds,
): Record<string, unknown> | null {
  if (!element || !isManualPositionDragTarget(element)) {
    return null;
  }

  if (delta.x === 0 && delta.y === 0) {
    return null;
  }

  const style = asStyleRecord(element);
  const elementBounds = getBounds(element.id);
  const parentBounds = element.parent_id ? getBounds(element.parent_id) : null;
  const fallbackLeft =
    elementBounds != null ? elementBounds.x - (parentBounds?.x ?? 0) : 0;
  const fallbackTop =
    elementBounds != null ? elementBounds.y - (parentBounds?.y ?? 0) : 0;

  const baseLeft = parsePx(style.left) ?? fallbackLeft;
  const baseTop = parsePx(style.top) ?? fallbackTop;

  return {
    style: {
      ...style,
      left: formatPx(baseLeft + delta.x),
      top: formatPx(baseTop + delta.y),
    },
  };
}

export function useDragBridge({
  onStartMoveRef,
  onUpdateDragRef,
  onEndDragRef,
  onCancelDragRef,
  dropIndicatorSnapshotRef,
  getInteractiveElementsMap,
  getInteractiveChildrenMap,
  enabled = true,
}: UseDragBridgeOptions): void {
  const dragStartSnapshotRef = useRef<DragSnapshotEntry[] | null>(null);

  const lastResolvedDropTargetRef = useRef<DropTarget | null>(null);

  const { startMove, updateDrag, endDrag, cancelDrag } = useDragInteraction({
    onDragUpdate: (operation, data) => {
      if (operation !== "move" || !data.delta) return;

      const { delta } = data;
      const dragState = useStore.getState();
      const draggedId = dragState.selectedElementIds[0];
      if (!draggedId) return;

      const scenePoint = data.current;
      if (!scenePoint) return;

      const dragStore = resolveDragReadModel(dragState, {
        getInteractiveElementsMap,
        getInteractiveChildrenMap,
      });
      const dragged = dragStore.elementsById.get(draggedId);
      if (isManualPositionDragTarget(dragged)) {
        setDragVisualOffset(draggedId, delta.x, delta.y);
        updateAnimationTargets(null);
        setDragSiblingOffsets(null);
        lastResolvedDropTargetRef.current = null;
        dropIndicatorSnapshotRef.current = null;
        return;
      }

      // 드래그 시작 시 원래 parent/page 스냅샷 캡처
      if (!dragStartSnapshotRef.current) {
        dragStartSnapshotRef.current = collectDragSnapshotEntries(
          dragStore.elementsById,
          dragStore.childrenByParent,
          draggedId,
        );
      }

      // 드래그 요소 시각적 오프셋 (store 변경 없음)
      setDragVisualOffset(draggedId, delta.x, delta.y);

      // dead zone
      const prevTarget = lastResolvedDropTargetRef.current;
      if (prevTarget) {
        const draggedBounds = getSceneBounds(draggedId);
        if (draggedBounds) {
          const isHz = prevTarget.isHorizontal;
          const pos = isHz ? scenePoint.x : scenePoint.y;
          const bStart = isHz ? draggedBounds.x : draggedBounds.y;
          const bEnd =
            bStart + (isHz ? draggedBounds.width : draggedBounds.height);
          if (pos >= bStart && pos <= bEnd) {
            dropIndicatorSnapshotRef.current = {
              targetBounds: prevTarget.containerBounds,
              insertIndex: prevTarget.insertionIndex,
              childBounds: prevTarget.siblingBounds,
              isHorizontal: prevTarget.isHorizontal,
              isReparent: prevTarget.isReparent,
              dragSize: prevTarget.isHorizontal
                ? draggedBounds.width
                : draggedBounds.height,
              insertionLinePosition: computeInsertionLinePosition(
                prevTarget,
                draggedId,
                dragStore,
              ),
              placeholderBounds: computeDropPlaceholderBounds(
                prevTarget,
                draggedId,
                dragStore,
              ),
            };
            return;
          }
        }
      }

      // drop target resolve
      const resolved = resolveDropTarget(
        scenePoint,
        draggedId,
        dragStore,
        hitTestPoint,
      );

      lastResolvedDropTargetRef.current = resolved;

      // 형제 시각적 오프셋 갱신
      if (resolved) {
        const offsets = computeSiblingOffsets(resolved, draggedId, dragStore);
        updateAnimationTargets(offsets.size > 0 ? offsets : null);
      } else {
        updateAnimationTargets(null);
      }

      // drop indicator 스냅샷 갱신
      if (resolved) {
        const db = getSceneBounds(draggedId);
        const dragSize = db
          ? resolved.isHorizontal
            ? db.width
            : db.height
          : 0;
        dropIndicatorSnapshotRef.current = {
          targetBounds: resolved.containerBounds,
          insertIndex: resolved.insertionIndex,
          childBounds: resolved.siblingBounds,
          isHorizontal: resolved.isHorizontal,
          isReparent: resolved.isReparent,
          dragSize,
          insertionLinePosition: computeInsertionLinePosition(
            resolved,
            draggedId,
            dragStore,
          ),
          placeholderBounds: computeDropPlaceholderBounds(
            resolved,
            draggedId,
            dragStore,
          ),
        };
      } else {
        dropIndicatorSnapshotRef.current = null;
      }
    },
    onMoveEnd: (elementId, _delta) => {
      const state = useStore.getState();
      const dragStore = resolveDragReadModel(state, {
        getInteractiveElementsMap,
        getInteractiveChildrenMap,
      });
      const manualPositionProps = resolveManualPositionDragProps(
        dragStore.elementsById.get(elementId),
        _delta,
      );
      const finalTarget = lastResolvedDropTargetRef.current;
      const startSnapshot = dragStartSnapshotRef.current;

      // 시각적 상태 해제
      clearAllAnimations();
      setDragVisualOffset(null, 0, 0, true);
      setDragSiblingOffsets(null);

      lastResolvedDropTargetRef.current = null;
      dragStartSnapshotRef.current = null;
      dropIndicatorSnapshotRef.current = null;

      if (manualPositionProps) {
        void state.batchUpdateElementProps([
          {
            elementId,
            props: manualPositionProps,
          },
        ]);
        return;
      }

      const prevSnapshotMap = new Map(
        (startSnapshot ?? []).map((snapshot) => [snapshot.id, snapshot]),
      );
      if (startSnapshot && finalTarget?.isReparent) {
        const targetSiblings = dragStore.childrenByParent.get(
          finalTarget.containerId,
        );
        targetSiblings?.forEach((sibling) => {
          const element = dragStore.elementsById.get(sibling.id);
          if (element && !prevSnapshotMap.has(element.id)) {
            prevSnapshotMap.set(element.id, toDragSnapshotEntry(element));
          }
        });
      }

      // 단일 canonical-primary commit
      let postMoveStore: DragReadModel | null = null;
      if (finalTarget && !finalTarget.isAdjacentInsertion) {
        const updates = computeReorderFromDropTarget(
          finalTarget,
          elementId,
          dragStore,
        );
        if (updates.length > 0) {
          const moveResult = moveElementCanonicalPrimary(
            elementId,
            finalTarget.containerId,
            finalTarget.insertionIndex,
          );
          if (moveResult.document) {
            postMoveStore = buildDragReadModelFromCanonicalDocument(
              moveResult.document,
            );
          }
        }
      }

      // History + DB Persist
      if (startSnapshot) {
        const state = useStore.getState();
        const historyStore =
          postMoveStore ??
          resolveDragReadModel(state, {
            getInteractiveElementsMap,
            getInteractiveChildrenMap,
          });
        const affectedIds = new Set(prevSnapshotMap.keys());
        if (finalTarget?.isReparent) {
          const newSiblings = historyStore.childrenByParent.get(
            finalTarget.containerId,
          );
          newSiblings?.forEach((c) => affectedIds.add(c.id));
          affectedIds.add(elementId);
        }

        const affectedIdList = Array.from(affectedIds);
        const prevElements = affectedIdList
          .map((id) => {
            const snapshot = prevSnapshotMap.get(id);
            const el = historyStore.elementsById.get(id);
            if (!snapshot || !el) return undefined;
            return {
              ...el,
              page_id:
                snapshot.page_id === undefined ? el.page_id : snapshot.page_id,
              parent_id:
                snapshot.parent_id === undefined
                  ? el.parent_id
                  : snapshot.parent_id,
            };
          })
          .filter((el): el is NonNullable<typeof el> => el !== undefined);
        const nextElements = affectedIdList
          .map((id) => historyStore.elementsById.get(id))
          .filter((el): el is NonNullable<typeof el> => el !== undefined);

        if (prevElements.length > 0 && nextElements.length > 0) {
          const hasChange =
            Boolean(finalTarget && !finalTarget.isAdjacentInsertion) ||
            prevElements.some((p) => {
              const next = historyStore.elementsById.get(p.id);
              return (
                next &&
                (next.parent_id !== p.parent_id || next.page_id !== p.page_id)
              );
            });
          if (hasChange) {
            historyManager.addEntry({
              type: "batch",
              elementId: "drag-reorder",
              elementIds: affectedIdList,
              data: {
                prevElements,
                elements: nextElements,
              },
            });
          }
        }

        // DB Persist
        queueMicrotask(() => {
          void (async () => {
            try {
              const db = await getDB();
              await persistActiveCanonicalDocument(db);
            } catch (error) {
              console.error("[DragBridge] reorder/reparent DB persist:", error);
            }
          })();
        });
      }
    },
  });

  // 콜백 refs 바인딩 (enabled=false이면 SelectionLayer가 바인딩)
  useEffect(() => {
    if (!enabled) return;
    onStartMoveRef.current = startMove;
    onUpdateDragRef.current = updateDrag;
    onEndDragRef.current = endDrag;
    onCancelDragRef.current = () => {
      cancelDrag();
      clearAllAnimations();
      setDragVisualOffset(null);
      setDragSiblingOffsets(null);
      dropIndicatorSnapshotRef.current = null;
      lastResolvedDropTargetRef.current = null;
      dragStartSnapshotRef.current = null;
    };
  }, [
    enabled,
    startMove,
    updateDrag,
    endDrag,
    cancelDrag,
    onStartMoveRef,
    onUpdateDragRef,
    onEndDragRef,
    onCancelDragRef,
    dropIndicatorSnapshotRef,
  ]);
}
