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
      selectedElementIds,
      elementsMap,
      removeElements,
      setSelectedElement,
    } = useStore.getState();

    if (selectedElementIds.length === 0) {
      console.log("[Keyboard] Delete: No elements selected");
      return;
    }

    // Body 요소는 키보드로 삭제 불가 (페이지 삭제 시에만 함께 삭제)
    const deletableIds = selectedElementIds.filter((id) => {
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
