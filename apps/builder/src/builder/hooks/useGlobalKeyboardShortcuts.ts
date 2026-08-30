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
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
  type KeyboardShortcut,
  type ShortcutHandlers,
} from "./useKeyboardShortcutsRegistry";
import type { ShortcutId } from "../config/keyboardShortcuts";
import { usePanelLayout } from "./usePanelLayout";
import { useActiveScope } from "./useActiveScope";
import {
  applyViewportState,
  computeFitViewport,
  zoomViewportAtContainerCenter,
} from "../workspace/canvas/viewport/viewportActions";
import {
  copySelection,
  cutSelection,
  deleteSelection,
  paste,
} from "../workspace/canvas/actions/canvasActions";
import { canDetachInstance } from "../utils/editingSemantics";
import { runComponentSemanticsAction } from "../utils/componentSemanticsRunner";
import { useCopyPaste } from "./useCopyPaste";
import {
  clearGuideSelection,
  getSelectedGuide,
} from "../workspace/canvas/interaction/guideEmphasis";
import { deletePageGuide } from "../workspace/canvas/viewport/pageGuideActions";
import type { SiblingEdge } from "../stores/utils/siblingReorder";

// ============================================
// Constants
// ============================================

const ZOOM_STEP = 0.1;

// ============================================
// Hook
// ============================================

export function useGlobalKeyboardShortcuts() {
  // ----------------------------------------
  // Active Scope (Phase 4)
  // ----------------------------------------

  const activeScope = useActiveScope();
  const { togglePanel } = usePanelLayout();

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
    togglePanel("monitor");
  }, [togglePanel]);

  const handleToggleWorkflowOverlay = useCallback(() => {
    useStore.getState().toggleWorkflowOverlay();
  }, []);

  // 레일 순서 그대로 ⌥1–⌥8. 정의는 있었지만 등록이 없어 여섯 개가 눌러도
  // 반응하지 않았다 (2026-08-27 인벤토리). `events` 는 패널 배치 persist 키라
  // InteractionsPanel 로 교체된 뒤에도 id 를 유지한다 (ADR-158).
  const handleToggleNavigator = useCallback(() => {
    togglePanel("navigator");
  }, [togglePanel]);
  const handleToggleComponents = useCallback(() => {
    togglePanel("components");
  }, [togglePanel]);
  const handleToggleDatatable = useCallback(() => {
    togglePanel("datatable");
  }, [togglePanel]);
  const handleToggleTheme = useCallback(() => {
    togglePanel("theme");
  }, [togglePanel]);
  const handleToggleProperties = useCallback(() => {
    togglePanel("properties");
  }, [togglePanel]);
  const handleToggleStyles = useCallback(() => {
    togglePanel("styles");
  }, [togglePanel]);
  const handleToggleEvents = useCallback(() => {
    togglePanel("events");
  }, [togglePanel]);
  const handleToggleHistory = useCallback(() => {
    togglePanel("history");
  }, [togglePanel]);
  const handleToggleAI = useCallback(() => {
    togglePanel("ai");
  }, [togglePanel]);
  const handleOpenSettings = useCallback(() => {
    togglePanel("settings");
  }, [togglePanel]);

  /** ADR-181 — 눈금자 토글 (설정 패널 스위치와 같은 상태) */
  const handleToggleRulers = useCallback(() => {
    const { showRulers, setShowRulers } = useStore.getState();
    setShowRulers(!showRulers);
  }, []);

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
    const { elementsMap } = useStore.getState();
    await copySelection({
      elementsMap,
      writeClipboardText: copyText,
      requireCurrentPageForCopy: true,
    });
  }, [copyText]);

  /**
   * Canvas Cut - 복사 후 삭제 (복사 실패 시 삭제하지 않음)
   */
  const handleCanvasCut = useCallback(async () => {
    const { elementsMap } = useStore.getState();
    await cutSelection({
      elementsMap,
      writeClipboardText: copyText,
      requireCurrentPageForCopy: true,
    });
  }, [copyText]);

  /**
   * Canvas Paste - 클립보드에서 요소 붙여넣기
   */
  const handleCanvasPaste = useCallback(async () => {
    const { elementsMap } = useStore.getState();
    await paste({ elementsMap, readClipboardText: pasteText });
  }, [pasteText]);

  /**
   * Canvas Delete - 선택된 요소들 삭제
   */
  const handleCanvasDelete = useCallback(async () => {
    // 0. 가이드 선택 (ADR-181) → 그 가이드를 지운다. Escape 와 같은 우선순위
    //    어법이다: 요소 선택과 배타라 둘 중 하나만 서 있고, 가이드가 선택돼
    //    있으면 Delete 는 그쪽을 향한다. 드래그 삭제(눈금자로 되돌리기 /
    //    페이지 밖)와 같은 커밋 경로라 Cmd+Z 도 같게 동작한다.
    const selectedGuide = getSelectedGuide();
    if (selectedGuide !== null) {
      clearGuideSelection();
      deletePageGuide(
        selectedGuide.pageId,
        selectedGuide.guideId,
        useStore.getState().activeBreakpoint,
      );
      return;
    }
    const { elementsMap } = useStore.getState();
    await deleteSelection({ elementsMap });
  }, []);

  const handleToggleComponentOrigin = useCallback(async () => {
    const { selectedElementId } = useStore.getState();
    if (!selectedElementId) {
      console.log("[Keyboard] Toggle component: No element selected");
      return;
    }
    await runComponentSemanticsAction("toggle-component-origin", {
      targetId: selectedElementId,
    });
  }, []);

  const handleDetachInstance = useCallback(async () => {
    const { selectedElementId, elementsMap } = useStore.getState();
    if (!selectedElementId) {
      console.log("[Keyboard] Detach instance: No element selected");
      return;
    }

    const element = elementsMap.get(selectedElementId);
    if (!canDetachInstance(element)) {
      console.log("[Keyboard] Detach instance: Selection is not an instance");
      return;
    }

    // 확인 문구·store 호출은 ADR-199 Phase 3 의 공통 실행 경로가 소유한다.
    await runComponentSemanticsAction("detach-instance", {
      targetId: selectedElementId,
      element,
    });
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
   * 형제 선택 이동 — Tab / ⇧Tab (Figma 와 같은 용도).
   *
   * 방향키가 형제 "순서 재배치" 를 맡으므로 Tab 은 "선택 이동" 만 한다 —
   * 두 축이 겹치지 않는다. 정의는 진작 있었지만 등록이 없어 죽어 있었다.
   * 끝에서 반대쪽으로 감싸 돈다 (형제 목록 안에서만 돌고 부모로 올라가지 않는다).
   */
  const handleSelectSibling = useCallback((direction: -1 | 1) => {
    const {
      selectedElementId,
      selectedElementIds,
      elementsMap,
      childrenMap,
      setSelectedElement,
    } = useStore.getState();

    const targetId = selectedElementId ?? selectedElementIds[0] ?? null;
    if (!targetId) return;

    const target = elementsMap.get(targetId);
    if (!target) return;

    const siblings = childrenMap.get(target.parent_id || "root") ?? [];
    if (siblings.length < 2) return;

    const index = siblings.findIndex((sibling) => sibling.id === targetId);
    if (index === -1) return;

    const next =
      siblings[(index + direction + siblings.length) % siblings.length];
    if (next && next.id !== targetId) setSelectedElement(next.id);
  }, []);

  const handleSelectNextSibling = useCallback(
    () => handleSelectSibling(1),
    [handleSelectSibling],
  );
  const handleSelectPrevSibling = useCallback(
    () => handleSelectSibling(-1),
    [handleSelectSibling],
  );

  /**
   * z-order 끝 이동 — `[` / `]` (ADR-182 T1 #4·#7).
   *
   * 대상 판정은 위 한 칸 이동과 같은 규칙 (단일 선택 한정) — 여러 요소를
   * 동시에 끝으로 보내면 상대 순서 규칙이 따로 필요하다.
   */
  const handleMoveToSiblingEdge = useCallback((edge: SiblingEdge) => {
    const { selectedElementIds, selectedElementId, moveElementToSiblingEdge } =
      useStore.getState();
    if (selectedElementIds.length > 1) return;

    const targetId = selectedElementId ?? selectedElementIds[0] ?? null;
    if (!targetId) return;

    moveElementToSiblingEdge(targetId, edge);
  }, []);

  const handleBringToFront = useCallback(
    () => handleMoveToSiblingEdge("front"),
    [handleMoveToSiblingEdge],
  );
  const handleSendToBack = useCallback(
    () => handleMoveToSiblingEdge("back"),
    [handleMoveToSiblingEdge],
  );
  const handleBringForward = useCallback(
    () => handleReorderSibling(1),
    [handleReorderSibling],
  );
  const handleSendBackward = useCallback(
    () => handleReorderSibling(-1),
    [handleReorderSibling],
  );

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

    // 0. 가이드 선택 (ADR-181) → 해제. 요소 선택과 배타라 둘 중 하나만 서
    //    있고, 가이드가 선택돼 있으면 Escape 는 그쪽을 향한다
    if (getSelectedGuide() !== null) {
      clearGuideSelection();
      return;
    }

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
      toggleWorkflowOverlay: handleToggleWorkflowOverlay,
      toggleMonitor: handleToggleMonitor,
      toggleNavigator: handleToggleNavigator,
      toggleComponents: handleToggleComponents,
      toggleDatatable: handleToggleDatatable,
      toggleTheme: handleToggleTheme,
      toggleProperties: handleToggleProperties,
      toggleStyles: handleToggleStyles,
      toggleEvents: handleToggleEvents,
      toggleHistory: handleToggleHistory,
      toggleAI: handleToggleAI,
      openSettings: handleOpenSettings,
      toggleRulers: handleToggleRulers,

      // Canvas (Phase 6: 스코프 기반)
      copy: getScopedHandler(handleCanvasCopy, handleEventsCopy),
      cut: handleCanvasCut,
      paste: getScopedHandler(handleCanvasPaste, handleEventsPaste),
      delete: getScopedHandler(handleCanvasDelete, handleEventsDelete),
      deleteAlt: getScopedHandler(handleCanvasDelete, handleEventsDelete),
      toggleComponentOrigin: handleToggleComponentOrigin,
      detachInstance: handleDetachInstance,
      escape: handleEscape,
      nextElement: handleSelectNextSibling,
      prevElement: handleSelectPrevSibling,
      // 화살표 — 페이지 선택 시 nudge(ADR-177), element 선택 시 형제 순서
      arrowUp: handleArrowUp,
      arrowLeft: handleArrowLeft,
      arrowDown: handleArrowDown,
      arrowRight: handleArrowRight,
      arrowUpShift: handleArrowUpShift,
      arrowLeftShift: handleArrowLeftShift,
      arrowDownShift: handleArrowDownShift,
      arrowRightShift: handleArrowRightShift,
      // z-order (ADR-182 Phase 4)
      bringToFront: handleBringToFront,
      bringForward: handleBringForward,
      sendBackward: handleSendBackward,
      sendToBack: handleSendToBack,
    }),
    [
      handleUndo,
      handleRedo,
      handleZoomIn,
      handleZoomOut,
      handleZoomToFit,
      handleZoom100,
      handleZoom200,
      handleToggleWorkflowOverlay,
      handleToggleMonitor,
      handleToggleNavigator,
      handleToggleComponents,
      handleToggleDatatable,
      handleToggleTheme,
      handleToggleProperties,
      handleToggleStyles,
      handleToggleEvents,
      handleToggleHistory,
      handleToggleAI,
      handleOpenSettings,
      handleToggleRulers,
      // Phase 6
      getScopedHandler,
      handleCanvasCopy,
      handleCanvasCut,
      handleCanvasPaste,
      handleCanvasDelete,
      handleToggleComponentOrigin,
      handleDetachInstance,
      handleEventsCopy,
      handleEventsPaste,
      handleEventsDelete,
      handleEscape,
      handleSelectNextSibling,
      handleSelectPrevSibling,
      handleArrowUp,
      handleArrowDown,
      handleArrowLeft,
      handleArrowRight,
      handleArrowUpShift,
      handleArrowDownShift,
      handleArrowLeftShift,
      handleArrowRightShift,
      handleBringToFront,
      handleBringForward,
      handleSendBackward,
      handleSendToBack,
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
      "toggleWorkflowOverlay",
      "toggleMonitor",
      "toggleRulers",
      "toggleNavigator",
      "toggleComponents",
      "toggleDatatable",
      "toggleTheme",
      "toggleProperties",
      "toggleStyles",
      "toggleEvents",
      "toggleHistory",
      "toggleAI",
      "openSettings",
      // Canvas (Phase 6)
      "copy",
      "cut",
      "paste",
      "toggleComponentOrigin",
      "detachInstance",
      "delete",
      "deleteAlt",
      "escape",
      "nextElement",
      "prevElement",
      // 화살표 — 형제 순서 재배치 + 페이지 nudge (canvas-focused)
      "arrowUp",
      "arrowDown",
      "arrowLeft",
      "arrowRight",
      "arrowUpShift",
      "arrowDownShift",
      "arrowLeftShift",
      "arrowRightShift",
      // z-order — `[` / `]` (끝) + ⌘[ / ⌘] (한 칸)
      "bringToFront",
      "bringForward",
      "sendBackward",
      "sendToBack",
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
