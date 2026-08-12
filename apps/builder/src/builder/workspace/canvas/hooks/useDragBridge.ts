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
import { captureCanonicalNodeLocations } from "../../../stores/history/canonicalHistoryEvents";
import { trackCanonicalMove } from "../../../stores/utils/historyHelpers";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { getDB } from "../../../../lib/db";
import { hitTestPoint } from "../wasm-bindings/spatialIndex";
import { getSceneBounds } from "../skia/renderCommands";
import type { BoundingBox } from "../selection/types";
import {
  moveElementToCanonicalTarget,
  moveElementsToCanonicalTarget,
} from "../../../../adapters/canonical/canonicalMutations";
import type { CanvasInteractionNode } from "../interaction/interactionNode";
import {
  armDragAltClone,
  isContainerWithinDragTargets,
  isDragAltCloneArmed,
  resolveCanonicalMoveTarget,
  resolveMultiDragTargets,
} from "../interaction";
import {
  copyMultipleElements,
  pasteMultipleElements,
} from "../../../utils/multiElementCopy";
import { trackMultiPaste } from "../../../stores/utils/historyHelpers";
import { resolveAbsoluteFlowReparentProps } from "../../../utils/absolutePositioning";

type SceneBoundsResolver = (
  elementId: string,
) => BoundingBox | null | undefined;

type DragReadModel = {
  elementsById: ReadonlyMap<string, CanvasInteractionNode>;
  childrenByParent: ReadonlyMap<string, CanvasInteractionNode[]>;
};

type DragReadModelFallback =
  | DragReadModel
  | {
      elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
      childrenMap: ReadonlyMap<string, CanvasInteractionNode[]>;
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

export function resolveDragReadModel(
  fallback: DragReadModelFallback,
  resolvers: DragReadModelResolvers = {},
): DragReadModel {
  const fallbackElementsById =
    "elementsById" in fallback ? fallback.elementsById : fallback.elementsMap;
  const fallbackChildrenByParent =
    "childrenByParent" in fallback
      ? fallback.childrenByParent
      : fallback.childrenMap;
  return {
    elementsById:
      resolvers.getInteractiveElementsMap?.() ?? fallbackElementsById,
    childrenByParent:
      resolvers.getInteractiveChildrenMap?.() ?? fallbackChildrenByParent,
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

function isManualPositionFlowContainer(
  element: CanvasInteractionNode | undefined,
): boolean {
  return element != null && element.type.toLowerCase() !== "body";
}

export function resolveManualPositionDragProps(
  element: CanvasInteractionNode | undefined,
  delta: { x: number; y: number },
  getBounds: SceneBoundsResolver = getSceneBounds,
  destinationBounds?: BoundingBox,
): Record<string, unknown> | null {
  if (!element || !isManualPositionDragTarget(element)) {
    return null;
  }

  if (delta.x === 0 && delta.y === 0) {
    return null;
  }

  const style = asStyleRecord(element);
  const elementBounds = getBounds(element.id);
  if (destinationBounds && !elementBounds) {
    return null;
  }
  const parentBounds =
    destinationBounds ??
    (element.parent_id ? getBounds(element.parent_id) : null);
  const fallbackLeft =
    elementBounds != null ? elementBounds.x - (parentBounds?.x ?? 0) : 0;
  const fallbackTop =
    elementBounds != null ? elementBounds.y - (parentBounds?.y ?? 0) : 0;

  const baseLeft = destinationBounds
    ? fallbackLeft
    : (parsePx(style.left) ?? fallbackLeft);
  const baseTop = destinationBounds
    ? fallbackTop
    : (parsePx(style.top) ?? fallbackTop);

  return {
    style: {
      ...style,
      left: formatPx(baseLeft + delta.x),
      top: formatPx(baseTop + delta.y),
    },
  };
}

export function resolveManualPositionDropProps(
  element: CanvasInteractionNode | undefined,
  target: DropTarget,
  readModel: DragReadModel,
  delta: { x: number; y: number },
  getBounds: SceneBoundsResolver = getSceneBounds,
): Record<string, unknown> | null {
  if (!element || !isManualPositionDragTarget(element)) {
    return null;
  }

  const targetContainer = readModel.elementsById.get(target.containerId);
  if (!targetContainer) {
    return null;
  }

  if (isManualPositionFlowContainer(targetContainer)) {
    return resolveAbsoluteFlowReparentProps(element, targetContainer);
  }

  return resolveManualPositionDragProps(
    element,
    delta,
    getBounds,
    target.containerBounds,
  );
}

export function resolveManualPositionDropTarget(
  element: CanvasInteractionNode | undefined,
  target: DropTarget | null,
  readModel: DragReadModel,
): DropTarget | null {
  if (!element || !isManualPositionDragTarget(element) || !target?.isReparent) {
    return null;
  }
  if (target.containerId === element.parent_id) {
    return null;
  }

  const targetContainer = readModel.elementsById.get(target.containerId);
  const sourcePageId = element?.page_id;
  const targetPageId = targetContainer?.page_id;
  if (!sourcePageId || !targetPageId || !targetContainer) {
    return null;
  }

  const isCrossPage = sourcePageId !== targetPageId;
  const isFlowContainer = isManualPositionFlowContainer(targetContainer);
  const isBodyEscape =
    targetContainer.type.toLowerCase() === "body" &&
    element?.parent_id !== targetContainer.id;

  if (isFlowContainer) {
    return target;
  }

  if (isBodyEscape) {
    return target.insertionIndex === 0
      ? target
      : { ...target, insertionIndex: 0 };
  }

  return isCrossPage ? target : null;
}

/**
 * ADR-178 Phase 3 — Alt 드래그 복제. pointerdown 시 arm 된 Alt 를 드롭
 * 시점에 소비해 대상 집합의 복제본을 **델타 위치**에 생성한다. 원본은
 * 무변경(잔류 — canonical mutation 0). 기존 duplicate 파이프라인
 * (copy/paste + addElement(skipHistory) + trackMultiPaste) 재사용 —
 * 복제본이 곧바로 이동 후 위치에 생성되므로 복제+이동이 **entry 1개**
 * (trackMultiPaste batch) 로 합산되고 undo 1회로 전체 취소된다.
 */
async function cloneDragTargetsAtDrop(
  targetIds: readonly string[],
  delta: { x: number; y: number },
): Promise<void> {
  const state = useStore.getState();
  const currentPageId = state.currentPageId;
  if (!currentPageId || targetIds.length === 0) return;

  const copied = copyMultipleElements([...targetIds], state.elementsMap);
  const newElements = pasteMultipleElements(
    copied,
    currentPageId,
    { x: delta.x, y: delta.y },
    state.elements,
  );
  if (newElements.length === 0) return;

  await Promise.all(
    newElements.map((element) =>
      state.addElement(element, { skipHistory: true }),
    ),
  );
  trackMultiPaste(newElements);
  state.setSelectedElements(newElements.map((element) => element.id));
}

/** ADR-178: 드래그 세션당 1회 정규화된 다중 드래그 대상 (ids[0] = 리더). */
interface MultiDragSession {
  ids: string[];
  idSet: ReadonlySet<string>;
}

/**
 * 다중 드래그 드롭 커밋 — ADR-178 HC2: canonical batch move 1회 + 히스토리
 * 1 entry (`runInTransaction` 병합). 대상별 현행 규칙 유지 — flow 는 순서/
 * 재부모화, absolute 는 left/top (reparent 된 absolute 만 drop 규칙).
 */
function commitMultiDragDrop({
  delta,
  dragStore,
  finalTarget,
  session,
}: {
  delta: { x: number; y: number };
  dragStore: DragReadModel;
  finalTarget: DropTarget | null;
  session: MultiDragSession;
}): void {
  const leaderId = session.ids[0];

  // R2 lock — 타겟이 대상 집합의 자신/자손이면 무효 (부분 적용 대신 전체 취소)
  let target = finalTarget;
  if (
    target &&
    isContainerWithinDragTargets({
      containerId: target.containerId,
      elementsMap: dragStore.elementsById,
      targetIds: session.idSet,
    })
  ) {
    target = null;
  }

  const leader = dragStore.elementsById.get(leaderId);
  const leaderIsManual = isManualPositionDragTarget(leader);
  // 리더가 absolute 면 단일 경로와 같은 가드 (flow 컨테이너 / body escape /
  // cross-page 만 reparent) 를 통과해야 canonical 이동 대상이다.
  const reparentTarget = leaderIsManual
    ? resolveManualPositionDropTarget(leader, target, dragStore)
    : target && !target.isAdjacentInsertion
      ? target
      : null;
  const canonicalTarget = reparentTarget
    ? resolveCanonicalMoveTarget({
        renderTargetId: reparentTarget.containerId,
        insertionIndex: reparentTarget.insertionIndex,
        elementsMap: dragStore.elementsById,
      })
    : null;

  // canonical 이동 대상 — flow 는 항상 (재배열 포함), absolute 는 부모가
  // 바뀔 때만 (same-parent 재배열에서 absolute 의 canonical 순서 불변).
  const moveIds =
    canonicalTarget && reparentTarget
      ? session.ids.filter((id) => {
          const element = dragStore.elementsById.get(id);
          if (!element) return false;
          if (!isManualPositionDragTarget(element)) return true;
          return element.parent_id !== reparentTarget.containerId;
        })
      : [];

  // absolute props 는 move 전에 계산 (bounds 캐시가 drop 이전 상태 — 단일 경로 동일)
  const absoluteUpdates: Array<{
    elementId: string;
    props: Record<string, unknown>;
  }> = [];
  for (const id of session.ids) {
    const element = dragStore.elementsById.get(id);
    if (!isManualPositionDragTarget(element)) continue;
    const props =
      reparentTarget && element?.parent_id !== reparentTarget.containerId
        ? resolveManualPositionDropProps(
            element,
            reparentTarget,
            dragStore,
            delta,
          )
        : resolveManualPositionDragProps(element, delta);
    if (props) {
      absoluteUpdates.push({ elementId: id, props });
    }
  }

  if (moveIds.length === 0 && absoluteUpdates.length === 0) {
    return;
  }

  let didCanonicalMove = false;
  historyManager.runInTransaction({ type: "move", elementId: leaderId }, () => {
    if (canonicalTarget && moveIds.length > 0) {
      const fromLocations = captureCanonicalNodeLocations(moveIds);
      const moveResult = moveElementsToCanonicalTarget(
        moveIds,
        canonicalTarget,
      );
      if (moveResult.document) {
        useStore.getState()._rebuildIndexes?.();
      }
      if (moveResult.changed) {
        didCanonicalMove = true;
        // 기록은 from index **내림차순** — undo 는 events 를 역순 적용하므로
        // (applyCanonicalHistoryEventsToDocument) 복원이 from index 오름차순
        // (작은 자리부터 삽입) 이 되어 원 순서가 정확히 재현된다. 오름차순
        // 기록이면 undo 가 형제 순서를 뒤집는다 (live 실측 — [Nav, refA]
        // 복원 시 refA 가 형제 뒤로 밀림). redo (정순 적용) 도 내림차순이
        // 정확 — to index 가 최종 문서 기준이라 큰 자리부터 재적용해야 한다.
        const trackOrder = [...moveResult.movedIds].sort(
          (left, right) =>
            (fromLocations.get(right)?.index ?? 0) -
            (fromLocations.get(left)?.index ?? 0),
        );
        for (const id of trackOrder) {
          trackCanonicalMove(id, fromLocations.get(id));
        }
      }
    }

    if (absoluteUpdates.length > 0) {
      void useStore.getState().batchUpdateElementProps(absoluteUpdates);
    }
  });

  if (didCanonicalMove) {
    queueMicrotask(() => {
      void (async () => {
        try {
          const db = await getDB();
          await persistActiveCanonicalDocument(db);
        } catch (error) {
          console.error("[DragBridge] multi-drop DB persist:", error);
        }
      })();
    });
  }
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
  const lastResolvedDropTargetRef = useRef<DropTarget | null>(null);
  // ADR-178: 드래그 세션 동안 고정되는 정규화 대상 집합 (드래그 중 선택 불변)
  const dragSessionRef = useRef<MultiDragSession | null>(null);

  const { startMove, updateDrag, endDrag, cancelDrag } = useDragInteraction({
    onDragUpdate: (operation, data) => {
      if (operation !== "move" || !data.delta) return;

      const { delta } = data;
      const dragState = useStore.getState();

      const scenePoint = data.current;
      if (!scenePoint) return;

      const dragStore = resolveDragReadModel(dragState, {
        getInteractiveElementsMap,
        getInteractiveChildrenMap,
      });

      // ADR-178: 세션당 1회 대상 집합 정규화 (조상 우선 + body 제외 —
      // 드래그 중 선택은 불변이라 첫 프레임 결과를 캐시)
      let session = dragSessionRef.current;
      if (!session) {
        const ids = resolveMultiDragTargets({
          elementsMap: dragStore.elementsById,
          selectedIds: dragState.selectedElementIds,
        });
        if (ids.length === 0) return;
        session = { ids, idSet: new Set(ids) };
        dragSessionRef.current = session;
      }
      const draggedId = session.ids[0];
      const isMulti = session.ids.length > 1;

      const dragged = dragStore.elementsById.get(draggedId);
      if (isManualPositionDragTarget(dragged)) {
        setDragVisualOffset(session.idSet, delta.x, delta.y);
        updateAnimationTargets(null);
        setDragSiblingOffsets(null);
        let resolved = resolveDropTarget(
          scenePoint,
          draggedId,
          dragStore,
          hitTestPoint,
        );
        if (
          resolved &&
          isMulti &&
          isContainerWithinDragTargets({
            containerId: resolved.containerId,
            elementsMap: dragStore.elementsById,
            targetIds: session.idSet,
          })
        ) {
          resolved = null;
        }
        const manualDropTarget = resolveManualPositionDropTarget(
          dragged,
          resolved,
          dragStore,
        );
        lastResolvedDropTargetRef.current = manualDropTarget;
        if (manualDropTarget) {
          const draggedBounds = getSceneBounds(draggedId);
          dropIndicatorSnapshotRef.current = {
            targetBounds: manualDropTarget.containerBounds,
            insertIndex: manualDropTarget.insertionIndex,
            childBounds: manualDropTarget.siblingBounds,
            isHorizontal: manualDropTarget.isHorizontal,
            isReparent: true,
            dragSize: manualDropTarget.isHorizontal
              ? (draggedBounds?.width ?? 0)
              : (draggedBounds?.height ?? 0),
            insertionLinePosition: computeInsertionLinePosition(
              manualDropTarget,
              draggedId,
              dragStore,
            ),
            placeholderBounds: computeDropPlaceholderBounds(
              manualDropTarget,
              draggedId,
              dragStore,
            ),
          };
        } else {
          dropIndicatorSnapshotRef.current = null;
        }
        return;
      }

      // 드래그 대상 시각적 오프셋 (store 변경 없음 — 전 대상 동일 델타)
      setDragVisualOffset(session.idSet, delta.x, delta.y);

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
      let resolved = resolveDropTarget(
        scenePoint,
        draggedId,
        dragStore,
        hitTestPoint,
      );
      if (
        resolved &&
        isMulti &&
        isContainerWithinDragTargets({
          containerId: resolved.containerId,
          elementsMap: dragStore.elementsById,
          targetIds: session.idSet,
        })
      ) {
        resolved = null;
      }

      lastResolvedDropTargetRef.current = resolved;

      // 형제 시각적 오프셋 갱신 — 드래그 대상 자신은 벌림 대상이 아니다
      // (드래그 오프셋이 우선이라 시각은 같지만 이중 계산 제거)
      if (resolved) {
        const offsets = computeSiblingOffsets(resolved, draggedId, dragStore);
        if (isMulti) {
          for (const id of session.ids) {
            offsets.delete(id);
          }
        }
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
      const finalTarget = lastResolvedDropTargetRef.current;
      const session = dragSessionRef.current;
      dragSessionRef.current = null;

      // ADR-178 Phase 3: Alt 드래그 복제 — 원본 무변경, 복제본을 델타
      // 위치에 생성 (시각 해제로 원본은 제자리 복귀)
      if (isDragAltCloneArmed()) {
        armDragAltClone(false);
        clearAllAnimations();
        setDragVisualOffset(null, 0, 0, true);
        setDragSiblingOffsets(null);
        lastResolvedDropTargetRef.current = null;
        dropIndicatorSnapshotRef.current = null;
        void cloneDragTargetsAtDrop(session?.ids ?? [elementId], _delta);
        return;
      }

      // ADR-178: 다중 드래그 커밋 — batch move 1회 + 히스토리 1 entry
      if (session && session.ids.length > 1) {
        clearAllAnimations();
        setDragVisualOffset(null, 0, 0, true);
        setDragSiblingOffsets(null);
        lastResolvedDropTargetRef.current = null;
        dropIndicatorSnapshotRef.current = null;
        commitMultiDragDrop({
          delta: _delta,
          dragStore,
          finalTarget,
          session,
        });
        return;
      }

      const dragged = dragStore.elementsById.get(elementId);
      const manualDropTarget = resolveManualPositionDropTarget(
        dragged,
        finalTarget,
        dragStore,
      );
      // 시각적 상태 해제
      clearAllAnimations();
      setDragVisualOffset(null, 0, 0, true);
      setDragSiblingOffsets(null);

      lastResolvedDropTargetRef.current = null;
      dropIndicatorSnapshotRef.current = null;

      if (manualDropTarget) {
        const manualPositionProps = resolveManualPositionDropProps(
          dragged,
          manualDropTarget,
          dragStore,
          _delta,
        );
        const canonicalTarget = resolveCanonicalMoveTarget({
          renderTargetId: manualDropTarget.containerId,
          insertionIndex: manualDropTarget.insertionIndex,
          elementsMap: dragStore.elementsById,
        });

        let didMove = false;
        if (manualPositionProps && canonicalTarget) {
          historyManager.runInTransaction({ type: "move", elementId }, () => {
            const fromLocations = captureCanonicalNodeLocations([elementId]);
            const moveResult = moveElementToCanonicalTarget(
              elementId,
              canonicalTarget,
            );
            if (moveResult.document) {
              useStore.getState()._rebuildIndexes?.();
            }
            if (!moveResult.changed) return;

            didMove = true;
            trackCanonicalMove(elementId, fromLocations.get(elementId));
            void useStore.getState().batchUpdateElementProps([
              {
                elementId,
                props: manualPositionProps,
              },
            ]);
          });
        }

        if (didMove) {
          return;
        }
      }

      const manualPositionProps = resolveManualPositionDragProps(
        dragged,
        _delta,
      );
      if (manualPositionProps) {
        void state.batchUpdateElementProps([
          {
            elementId,
            props: manualPositionProps,
          },
        ]);
        return;
      }

      // 단일 canonical-primary commit — history 는 canonical move event 로 표현
      // (형제 순서 변화는 canonical children[] 이 SSOT 라 move event 하나로 복원,
      //  ADR-118. 과거 요소 스냅샷 배열 방식은 flat Element[] → canonical 전체
      //  교체 fallback 을 유발했다)
      let didMove = false;
      if (finalTarget && !finalTarget.isAdjacentInsertion) {
        const updates = computeReorderFromDropTarget(
          finalTarget,
          elementId,
          dragStore,
        );
        if (updates.length > 0) {
          const canonicalTarget = resolveCanonicalMoveTarget({
            renderTargetId: finalTarget.containerId,
            insertionIndex: finalTarget.insertionIndex,
            elementsMap: dragStore.elementsById,
          });
          // from-location 은 mutation 전에 캡처
          const fromLocations = captureCanonicalNodeLocations([elementId]);
          const moveResult = canonicalTarget
            ? moveElementToCanonicalTarget(elementId, canonicalTarget)
            : { changed: false, document: null };
          if (moveResult.document) {
            useStore.getState()._rebuildIndexes?.();
          }
          if (moveResult.changed) {
            didMove = true;
            trackCanonicalMove(elementId, fromLocations.get(elementId));
          }
        }
      }

      // DB Persist — 실제 이동이 있었을 때만
      if (didMove) {
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
      dragSessionRef.current = null;
      armDragAltClone(false);
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
