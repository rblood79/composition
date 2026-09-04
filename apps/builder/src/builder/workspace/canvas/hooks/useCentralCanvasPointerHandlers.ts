import {
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import { useStore } from "../../../stores";
import type { BoundingBox, FrameBodySelectionArea } from "../selection";
import { resolveHandleCursor } from "../selection";
import {
  commitPointerClick,
  isPointerDoubleClick,
  resetPointerClick,
  resolveBodySelection,
  resolveDoubleClickTargetId,
  applyAxisLock,
  armDragAltClone,
  setDragSnapSuppressed,
  resolveCanvasInteractionTarget,
  resolveMultiDragTargets,
  resolveSelectedPageIds,
  resolveSelectionDragIntent,
  resolveSelectionHit,
  resolveTopPageIdAtPoint,
} from "../interaction";
import { hitTestPoint } from "../wasm-bindings/spatialIndex";
import { buildPagePaintRank } from "../scene/pagePaintOrder";
import { useKeyboardShortcutsRegistry } from "../../../hooks/useKeyboardShortcutsRegistry";
import { observe, PERF_LABEL } from "../../../utils/perfMarks";
import type { CanvasInteractionNode } from "../interaction/interactionNode";
import type { CanvasGestureSession } from "../interaction/canvasGestureSession";

interface ModifierState {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** 드래그 시작 threshold (px, scene-local 좌표계) */
const DRAG_THRESHOLD = 3;

interface UseCentralCanvasPointerHandlersOptions {
  gestureSession: CanvasGestureSession;
  completeEditRef: MutableRefObject<(elementId: string) => void>;
  computeSelectionBoundsForHitTest: () => BoundingBox | null;
  containerRef: RefObject<HTMLDivElement | null>;
  editingElementIdRef: MutableRefObject<string | null>;
  handleElementClickRef: MutableRefObject<
    (elementId: string, modifiers?: ModifierState) => void
  >;
  handleElementDoubleClickRef: MutableRefObject<(elementId: string) => void>;
  frameAreas?: FrameBodySelectionArea[];
  getHitChildrenMap?: () => Map<string, CanvasInteractionNode[]>;
  getHitElementsMap?: () => Map<string, CanvasInteractionNode>;
  isEditingRef: MutableRefObject<boolean>;
  lastClickTargetRef: MutableRefObject<string | null>;
  lastClickTimeRef: MutableRefObject<number>;
  /** 드래그 시작 콜백 (SelectionLayer로 전달) */
  onStartMove: MutableRefObject<
    (
      elementId: string,
      bounds: BoundingBox,
      position: { x: number; y: number },
    ) => void
  >;
  /** 드래그 업데이트 콜백 (SelectionLayer로 전달) */
  onUpdateDrag: MutableRefObject<(position: { x: number; y: number }) => void>;
  /** 드래그 종료 콜백 (SelectionLayer로 전달) */
  onEndDrag: MutableRefObject<() => void>;
  /** 선택된 page body의 빈 영역 drag를 page-position drag로 연결한다. */
  startPageDrag: (
    pageId: string,
    pointerId: number,
    pointerX: number,
    pointerY: number,
  ) => void;
  /** ADR-043 Phase 5: 드래그 취소 콜백 (Escape 키) */
  onCancelDrag: MutableRefObject<() => void>;
  pageSelectionEnabled?: boolean;
  pageHeight: number;
  pageWidth: number;
  screenToCanvasPoint: (position: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  selectionBoundsRef: MutableRefObject<BoundingBox | null>;
  /**
   * ADR-074 Phase 1: 빈 영역 클릭에서 페이지 전환 + body 선택을
   * 단일 set()으로 병합하기 위한 action. ADR-069 Phase 1 기반.
   */
  selectElementWithPageTransition: (
    elementId: string,
    targetPageId: string | null,
  ) => void;
  setCurrentPageId: (pageId: string) => void;
  setCursor: (cursor: string) => void;
  setSelectedElements: (elementIds: string[]) => void;
  zoom: number;
}

type PendingDrag = {
  elementId: string;
  bounds: BoundingBox;
  startCanvasPos: { x: number; y: number };
  startClientX: number;
  startClientY: number;
};

export function useCentralCanvasPointerHandlers({
  gestureSession,
  completeEditRef,
  computeSelectionBoundsForHitTest,
  containerRef,
  editingElementIdRef,
  handleElementClickRef,
  handleElementDoubleClickRef,
  frameAreas = [],
  getHitChildrenMap,
  getHitElementsMap,
  isEditingRef,
  lastClickTargetRef,
  lastClickTimeRef,
  onStartMove,
  onUpdateDrag,
  onCancelDrag,
  onEndDrag,
  startPageDrag,
  pageSelectionEnabled = true,
  pageHeight,
  pageWidth,
  screenToCanvasPoint,
  selectionBoundsRef,
  selectElementWithPageTransition,
  setCurrentPageId,
  setCursor,
  setSelectedElements,
  zoom,
}: UseCentralCanvasPointerHandlersOptions): void {
  /** 드래그 pending 상태 — effect 재실행 간 유지되므로 ref로 관리 */
  const pendingDragRef = useRef<PendingDrag | null>(null);
  /** 현재 드래그 활성 여부 — effect 재실행 간 유지되므로 ref로 관리 */
  const isDraggingRef = useRef(false);

  // Escape 키 드래그 취소 — window.keydown 직접 등록 대신 레지스트리 사용
  useKeyboardShortcutsRegistry(
    [
      {
        key: "Escape",
        modifier: "none",
        handler: () => {
          if (isDraggingRef.current || pendingDragRef.current) {
            onCancelDrag.current();
            pendingDragRef.current = null;
            isDraggingRef.current = false;
          }
        },
        preventDefault: true,
        category: "canvas",
        description: "Cancel drag (Escape)",
      },
    ],
    [onCancelDrag],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    // effect 재실행 시 드래그 상태 초기화
    pendingDragRef.current = null;
    isDraggingRef.current = false;

    // ADR-069 Phase 0: handlePointerDown 전체 구간을 "input.pointerdown" 라벨로 계측.
    // early return이 많아 try/finally가 필요한데, observe()가 이를 캡슐화한다.
    // 원본 로직은 handlePointerDownCore에 그대로 유지.
    const handlePointerDownCore = (event: PointerEvent): void => {
      if (event.button !== 0) {
        return;
      }

      if (gestureSession.blocksPointerDown(event.pointerId)) {
        return;
      }

      const guardedEvent = event as PointerEvent & { __handled?: boolean };
      if (guardedEvent.__handled) {
        return;
      }
      guardedEvent.__handled = true;

      if (
        gestureSession.beginPointer(event.pointerId, event.button) === "pan"
      ) {
        return;
      }

      if (isEditingRef.current) {
        const target = event.target as HTMLElement;
        const overlay = target.closest("[data-text-edit-overlay]");
        if (overlay) {
          return;
        }
        const editId = editingElementIdRef.current;
        if (editId) {
          completeEditRef.current(editId);
        }
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"]')) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const canvasPos = screenToCanvasPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });

      // ADR-069 Phase 1-C(deferred): computeSelectionBoundsForHitTest 2회 호출(L172/L242)은
      // 각각 (1) 이전 selection 기준 리사이즈 핸들 감지, (2) 새 selection 기준 pendingDrag
      // bounds 설정을 담당한다. 단일 요소 Map 조회 기반이라 이론상 저렴(O(1) per selected
      // element)하므로 조건부 skip은 Phase 0 baseline 측정에서 실제 비용이 확인된 후에
      // 재평가한다. 지금 최적화는 premature.
      const selectionBounds = computeSelectionBoundsForHitTest();
      selectionBoundsRef.current = selectionBounds;

      const state = useStore.getState();
      const hitElementsMap = getHitElementsMap?.();
      const hitChildrenMap = getHitChildrenMap?.();
      if (!hitElementsMap || !hitChildrenMap) {
        return;
      }
      const selectedIds = state.selectedElementIds;
      const hasSelection = selectedIds.length >= 1;
      // ADR-178 Phase 2: 전 선택이 page body 면 페이지 드래그 대상 집합
      // (단일이면 기존 selectedPageId 파생과 동일 — currentPageId 폴백 포함)
      const selectedPageIds = pageSelectionEnabled
        ? resolveSelectedPageIds({
            currentPageId: state.currentPageId,
            elementsMap: hitElementsMap,
            selectedIds,
          })
        : [];
      const now = Date.now();

      if (hasSelection && selectionBounds) {
        const { hitHandle } = resolveSelectionHit(
          canvasPos,
          selectionBounds,
          zoom,
        );
        if (hitHandle) {
          // Page body의 selection outline은 resize 대상이 아니다. page 전체 선택
          // 상태에서는 이 edge drag를 page-position drag로 승격해, 자식이 page를
          // 가득 채운 문서에서도 위치 이동 진입점을 제공한다.
          // ADR-178: 페이지 다중 선택이면 집합 전체가 함께 움직인다 (리더 =
          // 집합 첫 페이지).
          if (
            selectedPageIds.length > 0 &&
            gestureSession.promoteElementToPage(
              event.pointerId,
              selectedPageIds[0],
              state.activeBreakpoint,
              selectedPageIds,
            )
          ) {
            startPageDrag(
              selectedPageIds[0],
              event.pointerId,
              event.clientX,
              event.clientY,
            );
          }
          // 리사이즈 핸들 히트 — 드래그 기능 비활성 상태 (single/multi 공통)
          return;
        }
      }

      // 페이지 겹침 영역에서는 위에 그려진(활성) 페이지의 요소가 잡혀야 하고,
      // 위 페이지 body 에 가려진 아래 페이지 요소는 히트에서 제외해야 한다.
      const pagePaintRank = buildPagePaintRank(
        state.pages,
        state.currentPageId,
      );
      const topPageId = resolveTopPageIdAtPoint({
        canvasPoint: canvasPos,
        activePageId: state.currentPageId,
        pageHeight,
        pagePositions: state.pagePositions,
        pageWidth,
        pages: state.pages,
      });
      const interactionTarget = resolveCanvasInteractionTarget({
        candidateIds: hitTestPoint(canvasPos.x, canvasPos.y),
        elementsMap: hitElementsMap,
        childrenMap: hitChildrenMap,
        pagePaintRank,
        occludingPageRank:
          topPageId !== null ? (pagePaintRank.get(topPageId) ?? null) : null,
      });
      if (interactionTarget.kind === "slot-guard") {
        if (!event.shiftKey) {
          const bodySelection = resolveBodySelection({
            canvasPoint: canvasPos,
            currentPageId: state.currentPageId,
            elementsMap: hitElementsMap,
            frameAreas,
            pageHeight,
            pageIndexElementsByPage: state.pageIndex.elementsByPage,
            pageSelectionEnabled,
            pagePositions: state.pagePositions,
            pageWidth,
            pages: state.pages,
          });

          if (bodySelection.bodyElementId) {
            handleElementClickRef.current(bodySelection.bodyElementId, {
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              shiftKey: event.shiftKey,
            });
          } else if (bodySelection.pageId) {
            if (bodySelection.pageId !== state.currentPageId) {
              setCurrentPageId(bodySelection.pageId);
            }
            setSelectedElements([]);
          }
        }
        return;
      }
      const hitElementId =
        interactionTarget.kind === "select"
          ? interactionTarget.elementId
          : null;
      const hitTargetPageId =
        interactionTarget.kind === "select" ? interactionTarget.pageId : null;

      // 드래그 의도 판정은 선택 박스(bbox)가 아니라 **계층 정규화된 클릭 타깃** 기준이다.
      // bbox 기준이면 선택 박스에 겹쳐 있을 뿐인 다른 요소 클릭까지 삼켜서 선택이 무시된다.
      // body 선택 / 히트 없음 예외는 resolveSelectionDragIntent 내부에 흡수됨.
      // 상세: .claude/rules/canvas-rendering.md §8.8
      const isSelectionDragIntent = resolveSelectionDragIntent({
        editingContextId: state.editingContextId,
        elementsMap: hitElementsMap,
        hitElementId,
        selectedIds,
      });

      const { inSelectionBounds } = isSelectionDragIntent
        ? resolveSelectionHit(canvasPos, selectionBounds, zoom)
        : { inSelectionBounds: false };

      if (!inSelectionBounds && hitElementId) {
        if (
          isPointerDoubleClick(
            {
              lastClickTargetId: lastClickTargetRef.current,
              lastClickTime: lastClickTimeRef.current,
            },
            hitElementId,
            now,
          )
        ) {
          const resetState = resetPointerClick();
          lastClickTargetRef.current = resetState.lastClickTargetId;
          lastClickTimeRef.current = resetState.lastClickTime;
          handleElementDoubleClickRef.current(hitElementId);
          return;
        }

        const session = commitPointerClick(hitElementId, now);
        lastClickTargetRef.current = session.lastClickTargetId;
        lastClickTimeRef.current = session.lastClickTime;

        const modifiers = {
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        };

        handleElementClickRef.current(hitElementId, modifiers);

        // ADR-043: 선택 즉시 pendingDrag 설정 — 첫 클릭에서 바로 드래그 가능
        // handleElementClick이 동기적으로 store를 갱신한 후 bounds 재계산.
        // ADR-178: shift 클릭으로 다중 확장된 직후에도 정규화 리더로 잡는다
        // (body 제외 + 조상 우선 — resolveMultiDragTargets 단일 진입점).
        const freshDragTargets = resolveMultiDragTargets({
          elementsMap: hitElementsMap,
          selectedIds: useStore.getState().selectedElementIds,
        });
        if (freshDragTargets.length > 0) {
          const freshBounds = computeSelectionBoundsForHitTest();
          if (freshBounds) {
            pendingDragRef.current = {
              elementId: freshDragTargets[0],
              bounds: freshBounds,
              startCanvasPos: canvasPos,
              startClientX: event.clientX,
              startClientY: event.clientY,
            };
            // ADR-178 Phase 3: Alt 드래그 복제는 pointerdown 시점 판정
            armDragAltClone(event.altKey);
          }
        } else if (hitTargetPageId && hitTargetPageId !== state.currentPageId) {
          selectElementWithPageTransition(hitElementId, hitTargetPageId);
        }
        return;
      }

      if (inSelectionBounds) {
        if (hasSelection && selectionBounds) {
          const targetId = selectedIds[0] ?? null;
          const doubleClickTargetId = resolveDoubleClickTargetId(
            hitElementId,
            targetId,
          );
          if (
            isPointerDoubleClick(
              {
                lastClickTargetId: lastClickTargetRef.current,
                lastClickTime: lastClickTimeRef.current,
              },
              doubleClickTargetId,
              now,
            )
          ) {
            const resetState = resetPointerClick();
            lastClickTargetRef.current = resetState.lastClickTargetId;
            lastClickTimeRef.current = resetState.lastClickTime;
            if (doubleClickTargetId) {
              handleElementDoubleClickRef.current(doubleClickTargetId);
            }
            return;
          }

          const session = commitPointerClick(doubleClickTargetId, now);
          lastClickTargetRef.current = session.lastClickTargetId;
          lastClickTimeRef.current = session.lastClickTime;

          // ADR-178: 정규화 리더로 pendingDrag — body 는 요소 드래그 대상이
          // 아니다. 종전에는 다중 선택 시 body 가드(selectedElement 는 선택
          // 1개일 때만 조회)가 무조건 통과해 selectedIds[0](body 가능)로
          // 드래그가 시작되는 엣지가 있었다 (breakdown §2.1).
          const dragTargets = resolveMultiDragTargets({
            elementsMap: hitElementsMap,
            selectedIds,
          });
          if (dragTargets.length > 0) {
            pendingDragRef.current = {
              elementId: dragTargets[0],
              bounds: selectionBounds,
              startCanvasPos: canvasPos,
              startClientX: event.clientX,
              startClientY: event.clientY,
            };
            // ADR-178 Phase 3: Alt 드래그 복제는 pointerdown 시점 판정
            armDragAltClone(event.altKey);
          }
        }
        return;
      }

      if (!hitElementId) {
        const resetState = resetPointerClick();
        lastClickTargetRef.current = resetState.lastClickTargetId;
        lastClickTimeRef.current = resetState.lastClickTime;
        if (!event.shiftKey) {
          const bodySelection = resolveBodySelection({
            canvasPoint: canvasPos,
            currentPageId: state.currentPageId,
            elementsMap: hitElementsMap,
            frameAreas,
            pageHeight,
            pageIndexElementsByPage: state.pageIndex.elementsByPage,
            pageSelectionEnabled,
            pagePositions: state.pagePositions,
            pageWidth,
            pages: state.pages,
          });

          // Pages 패널의 전체 선택은 page body를 선택한다. body 자체는 element
          // drag 대상이 아니므로, 빈 page 영역에서 시작한 gesture만 page owner로
          // 승격해 위치 이동으로 연결한다. 자식 요소를 누른 경우는 위에서
          // hitElementId 경로로 이미 분기되어 개별 선택/drag를 그대로 유지한다.
          // ADR-178: 다중 페이지 선택에 포함된 페이지의 빈 영역을 잡으면 그
          // 페이지가 리더가 되어 집합 전체가 함께 움직인다.
          if (
            bodySelection.pageId &&
            selectedPageIds.includes(bodySelection.pageId) &&
            gestureSession.promoteElementToPage(
              event.pointerId,
              bodySelection.pageId,
              state.activeBreakpoint,
              selectedPageIds,
            )
          ) {
            startPageDrag(
              bodySelection.pageId,
              event.pointerId,
              event.clientX,
              event.clientY,
            );
            return;
          }

          if (bodySelection.bodyElementId) {
            handleElementClickRef.current(bodySelection.bodyElementId, {
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              shiftKey: event.shiftKey,
            });

            // 첫 press 에서도 같은 제스처로 page 를 잡아 끌 수 있게 — 선택 직후
            // 바로 page drag 세션으로 승격한다. 위의 promote 분기는 "이전 press
            // 에서 이미 선택된 page" 만 잡아서, 클릭(선택)-해제-재클릭 두 제스처가
            // 필요했다 (2026-08-12 사용자 보고). 클릭만 하고 안 움직이면 commit
            // 없음 (usePageDrag finish 의 isSamePosition 가드) 이라 클릭 의미는
            // 그대로다.
            // ADR-178: shift 클릭으로 다중 body 선택이 된 직후일 수 있어
            // 선택을 fresh 재파생해 집합으로 승격한다.
            if (bodySelection.pageId) {
              const freshPageIds = resolveSelectedPageIds({
                currentPageId: useStore.getState().currentPageId,
                elementsMap: hitElementsMap,
                selectedIds: useStore.getState().selectedElementIds,
              });
              const dragPageIds = freshPageIds.includes(bodySelection.pageId)
                ? freshPageIds
                : [bodySelection.pageId];
              if (
                gestureSession.promoteElementToPage(
                  event.pointerId,
                  bodySelection.pageId,
                  state.activeBreakpoint,
                  dragPageIds,
                )
              ) {
                startPageDrag(
                  bodySelection.pageId,
                  event.pointerId,
                  event.clientX,
                  event.clientY,
                );
              }
            }
          } else if (bodySelection.pageId) {
            // ADR-074 Phase 1: 페이지 영역 내부 빈 공간 클릭
            // - Case A (페이지 전환 + body 선택): selectElementWithPageTransition
            //   단일 set()으로 병합하여 store notify 2회 → 1회로 축소.
            // - Case B (페이지 동일 + body 선택): handleElementClickRef 경유.
            //   Frame body 도 같은 경로에서 selected reusable frame 을 동기화한다.
            // - Case C/D (body 없음): 페이지 전환 여부와 무관하게 기존 2-call 유지.
            //   bodyElementId가 없는 페이지는 희귀 edge라 별도 action 신설 보류.
            const needsPageTransition =
              bodySelection.pageId !== state.currentPageId;
            if (needsPageTransition) {
              setCurrentPageId(bodySelection.pageId);
            }
            setSelectedElements([]);
          } else {
            // 페이지 영역 밖 클릭 → 선택 모두 해제
            setSelectedElements([]);
          }
        }
      }
    };

    // handlePointerDownCore의 early return을 try/finally로 캡슐화하여 누락 없는
    // duration 측정 보장. window.__composition_PERF__.snapshot("input.pointerdown")
    // 으로 DevTools console에서 즉시 조회 가능.
    const handlePointerDown = (event: PointerEvent): void => {
      observe(PERF_LABEL.INPUT_POINTERDOWN, () => handlePointerDownCore(event));
    };

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (gestureSession.shouldSuppressElementInteraction(event.pointerId)) {
        return;
      }

      const pending = pendingDragRef.current;
      if (pending) {
        const dx = event.clientX - pending.startClientX;
        const dy = event.clientY - pending.startClientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!isDraggingRef.current && dist >= DRAG_THRESHOLD) {
          // threshold 초과 → 드래그 시작
          isDraggingRef.current = true;
          // store에서 최신 selectedElementIds 읽기 (stale closure 방지) —
          // ADR-178: 정규화 리더 (body 제외 + 조상 우선). pendingDrag 설정
          // 시점과 같은 판정이라 통상 일치하고, 선택이 그새 바뀐 경우를 보정.
          const currentMap = getHitElementsMap?.();
          const currentTargets = currentMap
            ? resolveMultiDragTargets({
                elementsMap: currentMap,
                selectedIds: useStore.getState().selectedElementIds,
              })
            : [];
          const currentId = currentTargets[0] ?? pending.elementId;
          onStartMove.current(
            currentId,
            pending.bounds,
            pending.startCanvasPos,
          );
        }

        if (isDraggingRef.current) {
          const rect = element.getBoundingClientRect();
          let canvasPos = screenToCanvasPoint({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
          // ADR-178 Phase 3: 드래그 중 Shift = 축 고정. 시작 scene 좌표 기준
          // 지배 축만 남긴다 — delta(시각 오프셋)와 scenePoint(드롭 판정)가
          // 같은 좌표에서 파생되므로 한 지점 고정으로 둘 다 잠긴다.
          if (event.shiftKey) {
            canvasPos = applyAxisLock(pending.startCanvasPos, canvasPos);
          }
          // ADR-179: Cmd/Ctrl 홀드 = 전 스냅 억제 (useDragBridge 스냅 판정 소비)
          setDragSnapSuppressed(event.metaKey || event.ctrlKey);
          onUpdateDrag.current(canvasPos);
        }
        return;
      }

      // pendingDrag 없을 때 커서 업데이트
      const rect = element.getBoundingClientRect();
      const canvasPos = screenToCanvasPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });

      const state = useStore.getState();
      const hasSelection = state.selectedElementIds.length >= 1;

      if (hasSelection) {
        const selectionBounds =
          selectionBoundsRef.current ?? computeSelectionBoundsForHitTest();
        const { hitHandle } = resolveSelectionHit(
          canvasPos,
          selectionBounds,
          zoom,
        );
        if (hitHandle) {
          const selectedElement =
            state.selectedElementIds.length === 1
              ? getHitElementsMap?.().get(state.selectedElementIds[0])
              : null;
          if (
            pageSelectionEnabled &&
            selectedElement?.type.toLowerCase() === "body"
          ) {
            setCursor("move");
            return;
          }
          setCursor(resolveHandleCursor(hitHandle));
          return;
        }
      }

      setCursor("default");
    };

    const finishElementPointer = (
      pointerId: number,
      cancelled: boolean,
    ): boolean => {
      if (gestureSession.ownerFor(pointerId) !== "element") {
        return false;
      }

      // element owner는 viewport/page lifecycle의 pointerup 경로를 타지 않으므로
      // 중앙 handler가 반드시 세션을 해제한다. 이 누락이 남으면 activePointerId가
      // 영구 점유되어 이후 pointerdown이 모두 차단된다.
      try {
        if (isDraggingRef.current) {
          if (cancelled) {
            onCancelDrag.current();
          } else {
            onEndDrag.current();
          }
        } else {
          // 드래그로 승격되지 않은 press — Alt 복제 arm 잔류 방지
          armDragAltClone(false);
        }
      } finally {
        // ADR-179: 스냅 억제 플래그 세션 잔류 방지
        setDragSnapSuppressed(false);
        pendingDragRef.current = null;
        isDraggingRef.current = false;
        gestureSession.endPointer(pointerId);
      }
      return true;
    };

    const handleWindowPointerUp = (event: PointerEvent) => {
      if (finishElementPointer(event.pointerId, false)) {
        return;
      }

      if (gestureSession.shouldSuppressElementInteraction(event.pointerId)) {
        return;
      }

      if (isDraggingRef.current) {
        onEndDrag.current();
      } else {
        // 드래그로 승격되지 않은 press — Alt 복제 arm 잔류 방지
        armDragAltClone(false);
      }
      // ADR-179: 스냅 억제 플래그 세션 잔류 방지
      setDragSnapSuppressed(false);
      pendingDragRef.current = null;
      isDraggingRef.current = false;
    };

    const handleWindowPointerCancel = (event: PointerEvent) => {
      finishElementPointer(event.pointerId, true);
    };

    // pointermove 는 window 리스너 하나만 둔다 — element 에 같은 리스너를 걸면
    // 버블링으로 두 번 동작해 hit-test/커서 계산이 이벤트마다 2회 돈다.
    element.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);

    return () => {
      // effect 재실행/언마운트 시 드래그 상태 초기화
      pendingDragRef.current = null;
      isDraggingRef.current = false;
      element.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
    };
  }, [
    completeEditRef,
    gestureSession,
    computeSelectionBoundsForHitTest,
    containerRef,
    editingElementIdRef,
    handleElementClickRef,
    handleElementDoubleClickRef,
    frameAreas,
    getHitChildrenMap,
    getHitElementsMap,
    isEditingRef,
    lastClickTargetRef,
    lastClickTimeRef,
    onEndDrag,
    onCancelDrag,
    onStartMove,
    onUpdateDrag,
    pageSelectionEnabled,
    pageHeight,
    pageWidth,
    screenToCanvasPoint,
    selectionBoundsRef,
    selectElementWithPageTransition,
    setCurrentPageId,
    setCursor,
    setSelectedElements,
    startPageDrag,
    zoom,
  ]);
}
