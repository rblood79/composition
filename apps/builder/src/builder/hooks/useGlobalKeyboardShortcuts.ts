/**
 * useGlobalKeyboardShortcuts Hook
 *
 * 전역 키보드 단축키 통합 훅
 * - Undo/Redo (Cmd+Z, Cmd+Shift+Z)
 * - Zoom (Cmd+=/-/0/1/2)
 * - Copy/Paste/Delete (스코프 기반)
 *
 * 설정 파일(keyboardShortcuts.ts)에서 정의를 가져오고
 * 핸들러만 바인딩하는 방식으로 구현
 *
 * @since Phase 0+1 구현 (2025-12-28)
 * @updated Phase 2 - JSON Config 연동 (2025-12-28)
 * @updated Phase 4 - 스코프 시스템 연동 (2025-12-28)
 * @updated Phase 6 - Copy/Paste/Delete 스코프 기반 통합 (2025-12-29)
 */

import { useCallback, useMemo } from "react";
import { useStore } from "../stores";
import { useViewportSyncStore } from "../workspace/canvas/stores";
import {
  useKeyboardShortcutsRegistry,
  type KeyboardShortcut,
} from "./useKeyboardShortcutsRegistry";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from "../config/keyboardShortcuts";
import { usePanelLayout } from "./usePanelLayout";
import { useActiveScope } from "./useActiveScope";
import {
  applyViewportState,
  computeFitViewport,
  zoomViewportAtContainerCenter,
} from "../workspace/canvas/viewport/viewportActions";
import {
  copyMultipleElements,
  pasteMultipleElements,
  resolvePasteTargetParentId,
  serializeCopiedElements,
  deserializeCopiedElements,
} from "../utils/multiElementCopy";
import { canDetachInstance } from "../utils/editingSemantics";
import { requestEditingSemanticsDetachConfirmation } from "../utils/editingSemanticsImpactConfirmation";
import { useCopyPaste } from "./useCopyPaste";

// ============================================
// Constants
// ============================================

const ZOOM_STEP = 0.1;

// ============================================
// Types
// ============================================

type ShortcutHandlers = Partial<Record<ShortcutId, () => void>>;

// ============================================
// Helper Functions
// ============================================

/**
 * 설정 파일의 정의와 핸들러를 결합하여 KeyboardShortcut 배열 생성
 */
function bindHandlersToDefinitions(
  ids: ShortcutId[],
  handlers: ShortcutHandlers,
): KeyboardShortcut[] {
  return ids
    .filter((id) => handlers[id] !== undefined)
    .map((id) => {
      const def = SHORTCUT_DEFINITIONS[id];
      return {
        key: def.key,
        code: def.code,
        modifier: def.modifier,
        handler: handlers[id]!,
        preventDefault: true,
        stopPropagation: def.capture,
        allowInInput: def.allowInInput,
        priority: def.priority,
        category: def.category,
        description: def.description,
        scope: def.scope, // Phase 4: 스코프 추가
      };
    });
}

// ============================================
// Hook
// ============================================

export function useGlobalKeyboardShortcuts() {
  // ----------------------------------------
  // Active Scope (Phase 4)
  // ----------------------------------------

  const activeScope = useActiveScope();
  const { toggleBottomPanel } = usePanelLayout();

  // ----------------------------------------
  // Undo/Redo Handlers
  // ----------------------------------------

  const handleUndo = useCallback(async () => {
    console.log("[Keyboard] Undo triggered");
    const { undo } = useStore.getState();
    await undo();
  }, []);

  const handleRedo = useCallback(async () => {
    console.log("[Keyboard] Redo triggered");
    const { redo } = useStore.getState();
    await redo();
  }, []);

  // ----------------------------------------
  // Zoom Handlers
  // ----------------------------------------

  const zoomTo = useCallback((targetZoom: number) => {
    zoomViewportAtContainerCenter(targetZoom);
  }, []);

  const handleZoomIn = useCallback(() => {
    const { zoom } = useViewportSyncStore.getState();
    zoomTo(zoom + ZOOM_STEP);
  }, [zoomTo]);

  const handleZoomOut = useCallback(() => {
    const { zoom } = useViewportSyncStore.getState();
    zoomTo(zoom - ZOOM_STEP);
  }, [zoomTo]);

  const handleZoomToFit = useCallback(() => {
    const { containerSize, canvasSize } = useViewportSyncStore.getState();
    if (containerSize.width === 0 || containerSize.height === 0) return;

    const fitState = computeFitViewport({ canvasSize, containerSize });
    applyViewportState(fitState);
  }, []);

  const handleZoom100 = useCallback(() => zoomTo(1), [zoomTo]);
  const handleZoom200 = useCallback(() => zoomTo(2), [zoomTo]);

  // ----------------------------------------
  // Panel Handlers
  // ----------------------------------------

  const handleToggleMonitor = useCallback(() => {
    toggleBottomPanel("monitor");
  }, [toggleBottomPanel]);

  // ----------------------------------------
  // Copy/Paste/Delete Handlers (Phase 6)
  // ----------------------------------------

  /**
   * Element Clipboard - useCopyPaste 훅 사용
   * copyText/pasteText를 통해 직렬화된 요소 데이터 처리
   */
  const { copyText, pasteText } = useCopyPaste({
    onPaste: () => {}, // pasteText 사용으로 직접 처리
    name: "elements",
  });

  /**
   * Canvas Copy - 선택된 요소들 복사
   */
  const handleCanvasCopy = useCallback(async () => {
    const { selectedElementIds, elementsMap, currentPageId } =
      useStore.getState();

    if (selectedElementIds.length === 0 || !currentPageId) {
      console.log("[Keyboard] Copy: No elements selected");
      return;
    }

    const copiedData = copyMultipleElements(selectedElementIds, elementsMap);
    const serialized = serializeCopiedElements(copiedData);

    const success = await copyText(serialized);
    if (success) {
      console.log(`[Keyboard] Copied ${copiedData.elements.length} elements`);
    } else {
      console.error("[Keyboard] Copy failed");
    }
  }, [copyText]);

  /**
   * Canvas Paste - 클립보드에서 요소 붙여넣기
   */
  const handleCanvasPaste = useCallback(async () => {
    const { currentPageId, addElement, elements, selectedElementId } =
      useStore.getState();

    if (!currentPageId) {
      console.log("[Keyboard] Paste: No page selected");
      return;
    }

    const text = await pasteText();
    if (!text) {
      console.log("[Keyboard] Paste: Failed to read clipboard");
      return;
    }

    const copiedData = deserializeCopiedElements(text);
    if (!copiedData) {
      console.log("[Keyboard] Paste: No valid element data in clipboard");
      return;
    }

    const newElements = pasteMultipleElements(
      copiedData,
      currentPageId,
      { x: 10, y: 10 },
      elements,
      {
        targetParentId: resolvePasteTargetParentId({
          currentPageId,
          selectedElementId,
          elements,
        }),
      },
    );

    for (const element of newElements) {
      await addElement(element);
    }

    console.log(`[Keyboard] Pasted ${newElements.length} elements`);
  }, [pasteText]);

  /**
   * Canvas Delete - 선택된 요소들 삭제
   */
  const handleCanvasDelete = useCallback(async () => {
    const {
      selectedElementId,
      selectedElementIds,
      elementsMap,
      removeElements,
      setSelectedElement,
    } = useStore.getState();

    const selectedIdsForDelete = [...selectedElementIds];
    if (
      selectedElementId &&
      !selectedIdsForDelete.includes(selectedElementId)
    ) {
      const primaryElement = elementsMap.get(selectedElementId);
      if (primaryElement?.type.toLowerCase() !== "body") {
        selectedIdsForDelete.unshift(selectedElementId);
      }
    }

    if (selectedIdsForDelete.length === 0) {
      console.log("[Keyboard] Delete: No elements selected");
      return;
    }

    // Body 요소는 키보드로 삭제 불가 (페이지 삭제 시에만 함께 삭제)
    const deletableIds = selectedIdsForDelete.filter((id) => {
      const el = elementsMap.get(id);
      return el && el.type.toLowerCase() !== "body";
    });

    if (deletableIds.length === 0) {
      console.log("[Keyboard] Delete: Only body elements selected, skipping");
      return;
    }

    // 선택 해제 먼저
    setSelectedElement(null);

    // 배치 삭제: 단일 set()으로 모든 요소 동시 제거
    await removeElements(deletableIds);
  }, []);

  const handleToggleComponentOrigin = useCallback(async () => {
    const { selectedElementId, toggleComponentOrigin } = useStore.getState();
    if (!selectedElementId) {
      console.log("[Keyboard] Toggle component: No element selected");
      return;
    }
    await toggleComponentOrigin(selectedElementId);
  }, []);

  const handleDetachInstance = useCallback(async () => {
    const { selectedElementId, elementsMap, detachInstance } =
      useStore.getState();
    if (!selectedElementId) {
      console.log("[Keyboard] Detach instance: No element selected");
      return;
    }

    const element = elementsMap.get(selectedElementId);
    if (!canDetachInstance(element)) {
      console.log("[Keyboard] Detach instance: Selection is not an instance");
      return;
    }

    const confirmed = await requestEditingSemanticsDetachConfirmation({
      instanceId: selectedElementId,
      instanceLabel:
        element?.componentName ??
        element?.customId ??
        element?.type ??
        selectedElementId,
    });
    if (!confirmed) return;

    detachInstance(selectedElementId);
  }, []);

  /**
   * 형제 순서 재배치 — 캔버스 포커스 상태의 화살표 키.
   *
   * flow 자식의 x/y 는 레이아웃 엔진 소유라 화살표가 뜻할 수 있는 "이동" 은
   * canonical children[] 순서 변경뿐이다 (ADR-118). 다중 선택은 1차 범위 제외 —
   * 여러 요소를 한 칸씩 옮기면 상대 순서가 뒤엉켜 별도 규칙이 필요하다.
   */
  const handleReorderSibling = useCallback((direction: -1 | 1) => {
    const {
      selectedElementIds,
      selectedElementId,
      reorderElementWithinParent,
    } = useStore.getState();
    if (selectedElementIds.length > 1) return;

    const targetId = selectedElementId ?? selectedElementIds[0] ?? null;
    if (!targetId) return;

    reorderElementWithinParent(targetId, direction);
  }, []);

  /**
   * ADR-177 Phase 3 — 페이지 nudge 대상 판정.
   *
   * 선택이 페이지 body(page_id 보유) 단일이면 화살표는 형제 순서가 아니라
   * 페이지 위치 이동이다. projection/frame body(page_id 없음)는 대상 아님.
   */
  const resolveSelectedPageForNudge = useCallback((): string | null => {
    const { selectedElementIds, selectedElementId, elementsMap } =
      useStore.getState();
    if (selectedElementIds.length > 1) return null;
    const targetId = selectedElementId ?? selectedElementIds[0] ?? null;
    if (!targetId) return null;
    const element = elementsMap.get(targetId);
    if (!element || element.type.toLowerCase() !== "body") return null;
    return element.page_id ?? null;
  }, []);

  /**
   * 화살표 공통 진입점 — 페이지 선택이면 nudge(1px / Shift 10px, 위치는
   * `updatePagePosition` 경유라 히스토리·persist 자동 편입), element 선택이면
   * 형제 순서 재배치 (Shift 조합은 페이지 전용 — element 에서는 no-op).
   */
  const handleArrowMove = useCallback(
    (dx: -1 | 0 | 1, dy: -1 | 0 | 1, direction: -1 | 1, step: 1 | 10) => {
      const pageId = resolveSelectedPageForNudge();
      if (pageId) {
        const state = useStore.getState();
        const position = state.pagePositions[pageId];
        if (!position) return;
        state.updatePagePosition(
          pageId,
          position.x + dx * step,
          position.y + dy * step,
        );
        return;
      }
      if (step !== 1) return;
      handleReorderSibling(direction);
    },
    [resolveSelectedPageForNudge, handleReorderSibling],
  );

  const handleArrowUp = useCallback(
    () => handleArrowMove(0, -1, -1, 1),
    [handleArrowMove],
  );
  const handleArrowDown = useCallback(
    () => handleArrowMove(0, 1, 1, 1),
    [handleArrowMove],
  );
  const handleArrowLeft = useCallback(
    () => handleArrowMove(-1, 0, -1, 1),
    [handleArrowMove],
  );
  const handleArrowRight = useCallback(
    () => handleArrowMove(1, 0, 1, 1),
    [handleArrowMove],
  );
  const handleArrowUpShift = useCallback(
    () => handleArrowMove(0, -1, -1, 10),
    [handleArrowMove],
  );
  const handleArrowDownShift = useCallback(
    () => handleArrowMove(0, 1, 1, 10),
    [handleArrowMove],
  );
  const handleArrowLeftShift = useCallback(
    () => handleArrowMove(-1, 0, -1, 10),
    [handleArrowMove],
  );
  const handleArrowRightShift = useCallback(
    () => handleArrowMove(1, 0, 1, 10),
    [handleArrowMove],
  );

  /**
   * Events Panel Copy - 선택된 액션들 복사
   * (현재는 placeholder - Events panel에서 구체적 구현 필요)
   */
  const handleEventsCopy = useCallback(() => {
    console.log("[Keyboard] Events Copy: placeholder");
    // TODO: Events panel과 연동 필요
    // eventsClipboardRef.current = JSON.stringify(selectedActions);
  }, []);

  /**
   * Events Panel Paste - 클립보드에서 액션 붙여넣기
   */
  const handleEventsPaste = useCallback(() => {
    console.log("[Keyboard] Events Paste: placeholder");
    // TODO: Events panel과 연동 필요
  }, []);

  /**
   * Events Panel Delete - 선택된 액션들 삭제
   */
  const handleEventsDelete = useCallback(() => {
    console.log("[Keyboard] Events Delete: placeholder");
    // TODO: Events panel과 연동 필요
  }, []);

  /**
   * Escape - 우선순위: editingContext 복귀 → 선택 해제 / 모달 닫기
   * (텍스트 편집 중 Escape는 TextEditOverlay가 자체 처리)
   */
  const handleEscape = useCallback(() => {
    const {
      editingContextId,
      exitEditingContext,
      setSelectedElement,
      selectedElementIds,
    } = useStore.getState();

    // 1. editingContext 진입 상태 → 한 단계 위로 복귀
    if (editingContextId !== null) {
      exitEditingContext();
      console.log("[Keyboard] Exited editing context");
      return;
    }

    // 2. 요소 선택 상태 → 선택 해제
    if (selectedElementIds.length > 0) {
      setSelectedElement(null);
      console.log("[Keyboard] Selection cleared");
    }
  }, []);

  /**
   * 스코프 기반 핸들러 선택
   */
  const getScopedHandler = useCallback(
    (canvasHandler: () => void, eventsHandler: () => void) => {
      return () => {
        if (activeScope === "panel:events") {
          eventsHandler();
        } else {
          canvasHandler();
        }
      };
    },
    [activeScope],
  );

  // ----------------------------------------
  // Handler Map
  // ----------------------------------------

  const handlers: ShortcutHandlers = useMemo(
    () => ({
      // System
      undo: handleUndo,
      redo: handleRedo,

      // Navigation
      zoomIn: handleZoomIn,
      zoomInNumpad: handleZoomIn,
      zoomOut: handleZoomOut,
      zoomToFit: handleZoomToFit,
      zoom100: handleZoom100,
      zoom200: handleZoom200,
      toggleMonitor: handleToggleMonitor,

      // Canvas (Phase 6: 스코프 기반)
      copy: getScopedHandler(handleCanvasCopy, handleEventsCopy),
      paste: getScopedHandler(handleCanvasPaste, handleEventsPaste),
      delete: getScopedHandler(handleCanvasDelete, handleEventsDelete),
      deleteAlt: getScopedHandler(handleCanvasDelete, handleEventsDelete),
      toggleComponentOrigin: handleToggleComponentOrigin,
      detachInstance: handleDetachInstance,
      escape: handleEscape,
      // 화살표 — 페이지 선택 시 nudge(ADR-177), element 선택 시 형제 순서
      arrowUp: handleArrowUp,
      arrowLeft: handleArrowLeft,
      arrowDown: handleArrowDown,
      arrowRight: handleArrowRight,
      arrowUpShift: handleArrowUpShift,
      arrowLeftShift: handleArrowLeftShift,
      arrowDownShift: handleArrowDownShift,
      arrowRightShift: handleArrowRightShift,
    }),
    [
      handleUndo,
      handleRedo,
      handleZoomIn,
      handleZoomOut,
      handleZoomToFit,
      handleZoom100,
      handleZoom200,
      handleToggleMonitor,
      // Phase 6
      getScopedHandler,
      handleCanvasCopy,
      handleCanvasPaste,
      handleCanvasDelete,
      handleToggleComponentOrigin,
      handleDetachInstance,
      handleEventsCopy,
      handleEventsPaste,
      handleEventsDelete,
      handleEscape,
      handleArrowUp,
      handleArrowDown,
      handleArrowLeft,
      handleArrowRight,
      handleArrowUpShift,
      handleArrowDownShift,
      handleArrowLeftShift,
      handleArrowRightShift,
    ],
  );

  // ----------------------------------------
  // Build Shortcuts from Config
  // ----------------------------------------

  const shortcuts: KeyboardShortcut[] = useMemo(() => {
    const shortcutIds: ShortcutId[] = [
      // System
      "undo",
      "redo",
      // Navigation
      "zoomIn",
      "zoomInNumpad",
      "zoomOut",
      "zoomToFit",
      "zoom100",
      "zoom200",
      // Panels
      "toggleMonitor",
      // Canvas (Phase 6)
      "copy",
      "paste",
      "toggleComponentOrigin",
      "detachInstance",
      "delete",
      "deleteAlt",
      "escape",
      // 화살표 — 형제 순서 재배치 + 페이지 nudge (canvas-focused)
      "arrowUp",
      "arrowDown",
      "arrowLeft",
      "arrowRight",
      "arrowUpShift",
      "arrowDownShift",
      "arrowLeftShift",
      "arrowRightShift",
    ];

    return bindHandlersToDefinitions(shortcutIds, handlers);
  }, [handlers]);

  // ----------------------------------------
  // Register Shortcuts
  // ----------------------------------------

  // System + Navigation 단축키는 capture phase에서 처리
  // (브라우저 기본 동작 차단 필요)
  // Phase 4: activeScope 전달로 스코프 기반 필터링
  useKeyboardShortcutsRegistry(shortcuts, [shortcuts, activeScope], {
    capture: true,
    target: "document",
    activeScope,
  });
}

export default useGlobalKeyboardShortcuts;
