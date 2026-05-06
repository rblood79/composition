import {
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import { useStore } from "../../../stores";
import type { BoundingBox, FrameBodySelectionArea } from "../selection";
import {
  commitPointerClick,
  isPointerDoubleClick,
  resetPointerClick,
  resolveBodySelection,
  resolveSelectionHit,
  resolveTopmostHitElementId,
} from "../interaction";
import { hitTestPoint } from "../wasm-bindings/spatialIndex";
import { useKeyboardShortcutsRegistry } from "../../../hooks/useKeyboardShortcutsRegistry";
import { observe, PERF_LABEL } from "../../../utils/perfMarks";
import type { Element } from "../../../../types/core/store.types";

interface ModifierState {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** 드래그 시작 threshold (px, scene-local 좌표계) */
const DRAG_THRESHOLD = 3;

interface UseCentralCanvasPointerHandlersOptions {
  completeEditRef: MutableRefObject<(elementId: string) => void>;
  computeSelectionBoundsForHitTest: () => BoundingBox | null;
  containerRef: RefObject<HTMLDivElement | null>;
  editingElementIdRef: MutableRefObject<string | null>;
  handleElementClickRef: MutableRefObject<
    (elementId: string, modifiers?: ModifierState) => void
  >;
  handleElementDoubleClickRef: MutableRefObject<(elementId: string) => void>;
  frameAreas?: FrameBodySelectionArea[];
  getHitElementsMap?: () => Map<string, Element>;
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
  completeEditRef,
  computeSelectionBoundsForHitTest,
  containerRef,
  editingElementIdRef,
  handleElementClickRef,
  handleElementDoubleClickRef,
  frameAreas = [],
  getHitElementsMap,
  isEditingRef,
  lastClickTargetRef,
  lastClickTimeRef,
  onStartMove,
  onUpdateDrag,
  onCancelDrag,
  onEndDrag,
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

      const guardedEvent = event as PointerEvent & { __handled?: boolean };
      if (guardedEvent.__handled) {
        return;
      }
      guardedEvent.__handled = true;

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
      const hitElementsMap = getHitElementsMap?.() ?? state.elementsMap;
      const selectedIds = state.selectedElementIds;
      const isSingleSelection = selectedIds.length === 1;
      const now = Date.now();

      if (isSingleSelection && selectionBounds) {
        const { hitHandle } = resolveSelectionHit(
          canvasPos,
          selectionBounds,
          zoom,
        );
        if (hitHandle) {
          // 리사이즈 핸들 히트 — 드래그 기능 비활성 상태
          return;
        }
      }

      const hitElementId = resolveTopmostHitElementId(
        hitTestPoint(canvasPos.x, canvasPos.y),
        hitElementsMap,
      );

      // body가 선택된 상태에서는 inSelectionBounds를 무시한다.
      // body의 selectionBounds가 전체 페이지를 커버하므로,
      // 내부 요소 클릭 시 inSelectionBounds=true가 되어 클릭이 무시되는 버그 방지.
      const selectedElement =
        selectedIds.length === 1 ? hitElementsMap.get(selectedIds[0]) : null;
      const isBodySelected = selectedElement?.type.toLowerCase() === "body";

      const { inSelectionBounds } = isBodySelected
        ? { inSelectionBounds: false }
        : resolveSelectionHit(canvasPos, selectionBounds, zoom);

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
        // handleElementClick이 동기적으로 store를 갱신한 후 bounds 재계산
        const hitElement = hitElementsMap.get(hitElementId);
        if (hitElement && hitElement.type.toLowerCase() !== "body") {
          const freshBounds = computeSelectionBoundsForHitTest();
          if (freshBounds) {
            pendingDragRef.current = {
              elementId: hitElementId,
              bounds: freshBounds,
              startCanvasPos: canvasPos,
              startClientX: event.clientX,
              startClientY: event.clientY,
            };
          }
        }
        return;
      }

      if (inSelectionBounds) {
        if (selectedIds.length > 0 && selectionBounds) {
          const targetId = selectedIds[0] ?? null;
          if (
            isPointerDoubleClick(
              {
                lastClickTargetId: lastClickTargetRef.current,
                lastClickTime: lastClickTimeRef.current,
              },
              targetId,
              now,
            )
          ) {
            const resetState = resetPointerClick();
            lastClickTargetRef.current = resetState.lastClickTargetId;
            lastClickTimeRef.current = resetState.lastClickTime;
            if (targetId) {
              handleElementDoubleClickRef.current(targetId);
            }
            return;
          }

          const session = commitPointerClick(targetId, now);
          lastClickTargetRef.current = session.lastClickTargetId;
          lastClickTimeRef.current = session.lastClickTime;

          // Body 요소는 drag 대상에서 제외
          if (targetId && selectedElement?.type.toLowerCase() !== "body") {
            pendingDragRef.current = {
              elementId: targetId,
              bounds: selectionBounds,
              startCanvasPos: canvasPos,
              startClientX: event.clientX,
              startClientY: event.clientY,
            };
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

          if (bodySelection.bodyElementId) {
            handleElementClickRef.current(bodySelection.bodyElementId, {
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              shiftKey: event.shiftKey,
            });
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
      const pending = pendingDragRef.current;
      if (pending) {
        const dx = event.clientX - pending.startClientX;
        const dy = event.clientY - pending.startClientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!isDraggingRef.current && dist >= DRAG_THRESHOLD) {
          // threshold 초과 → 드래그 시작
          isDraggingRef.current = true;
          // store에서 최신 selectedElementIds 읽기 (stale closure 방지)
          const currentId =
            useStore.getState().selectedElementIds[0] ?? pending.elementId;
          onStartMove.current(
            currentId,
            pending.bounds,
            pending.startCanvasPos,
          );
        }

        if (isDraggingRef.current) {
          const rect = element.getBoundingClientRect();
          const canvasPos = screenToCanvasPoint({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
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
      const isSingleSelection = state.selectedElementIds.length === 1;

      if (isSingleSelection) {
        const selectionBounds =
          selectionBoundsRef.current ?? computeSelectionBoundsForHitTest();
        const { hitHandle } = resolveSelectionHit(
          canvasPos,
          selectionBounds,
          zoom,
        );
        if (hitHandle) {
          setCursor(hitHandle.cursor);
          return;
        }
      }

      setCursor("default");
    };

    const handleWindowPointerUp = () => {
      if (isDraggingRef.current) {
        onEndDrag.current();
      }
      pendingDragRef.current = null;
      isDraggingRef.current = false;
    };

    const handlePointerMove = (event: PointerEvent) => {
      // pendingDrag가 없을 때만 커서 업데이트 (드래그 중 window 핸들러가 처리)
      if (pendingDragRef.current) return;

      const rect = element.getBoundingClientRect();
      const canvasPos = screenToCanvasPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });

      const state = useStore.getState();
      const isSingleSelection = state.selectedElementIds.length === 1;

      if (isSingleSelection) {
        const selectionBounds =
          selectionBoundsRef.current ?? computeSelectionBoundsForHitTest();
        const { hitHandle } = resolveSelectionHit(
          canvasPos,
          selectionBounds,
          zoom,
        );
        if (hitHandle) {
          setCursor(hitHandle.cursor);
          return;
        }
      }

      setCursor("default");
    };

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);

    return () => {
      // effect 재실행/언마운트 시 드래그 상태 초기화
      pendingDragRef.current = null;
      isDraggingRef.current = false;
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [
    completeEditRef,
    computeSelectionBoundsForHitTest,
    containerRef,
    editingElementIdRef,
    handleElementClickRef,
    handleElementDoubleClickRef,
    frameAreas,
    getHitElementsMap,
    isEditingRef,
    lastClickTargetRef,
    lastClickTimeRef,
    onEndDrag,
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
    zoom,
  ]);
}
