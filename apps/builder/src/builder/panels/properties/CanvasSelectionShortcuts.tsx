/**
 * CanvasSelectionShortcutsHost — 캔버스 전역 선택 단축키 host
 *
 * ADR-155 Phase 2: PropertiesPanel 에서 이전.
 * 이 단축키들 (Cmd+C/V/D/A, Escape, Cmd+G, 정렬/분배 등) 은 캔버스 선택에 대한
 * 전역 동작이라 패널 표시 여부와 무관하게 항상 동작해야 한다. PropertiesPanel 이
 * Activity gating 대상이 되면 숨김 중 effect 가 내려가 등록이 사라지므로,
 * 항상 mounted 인 headless host (BuilderCore 직속, null 렌더) 로 분리한다.
 * 구독 (selection/canonical map) 재렌더가 BuilderCore 로 전파되지 않도록
 * 반드시 leaf 컴포넌트로 mount 한다.
 *
 * panel:properties scope 의 Copy/Paste Properties 와 Cmd+? 도움말 토글은
 * 패널 UI 이므로 PropertiesPanel 에 잔류.
 */

import { memo, useCallback, useEffect, useMemo } from "react";
import { useStore, useDebouncedSelectedElementData } from "../../stores";
import {
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
  useActiveScope,
} from "@/builder/hooks";
import { useCanonicalPropertyElementsMap } from "./hooks/useCanonicalPropertyRead";
import type { AlignmentType } from "../../stores/utils/elementAlignment";
import type { DistributionType } from "../../stores/utils/elementDistribution";
import { canDetachInstance } from "../../utils/editingSemantics";
import { runComponentSemanticsAction } from "../../utils/componentSemanticsRunner";
import { panelNodeMapToElementMap } from "./panelNodeElementMap";
import { useStyleActions } from "../styles/hooks/useStyleActions";
import {
  alignSelection,
  copySelection,
  distributeSelection,
  duplicateSelection,
  groupSelection,
  paste,
  ungroupSelection,
} from "../../workspace/canvas/actions/canvasActions";

export const CanvasSelectionShortcutsHost = memo(
  function CanvasSelectionShortcutsHost() {
    const selectedElement = useDebouncedSelectedElementData();
    const elementsById = useCanonicalPropertyElementsMap();
    const activeScope = useActiveScope();
    const { copyStyles, pasteStyles } = useStyleActions();

    // 🚀 Performance: 액션만 가져오기 (구독 없음)
    const setSelectedElement = useStore.getState().setSelectedElement;
    const setSelectedElements = useStore.getState().setSelectedElements;

    // 🚀 Performance: getState() 패턴 - 구독 없이 최신 상태 조회
    const getElementsMap = useCallback(
      () => new Map(elementsById),
      [elementsById],
    );
    const getLegacyElementsMap = useCallback(
      () => panelNodeMapToElementMap(elementsById),
      [elementsById],
    );
    const getCurrentPageId = useCallback(
      () => useStore.getState().currentPageId,
      [],
    );
    const getSelectedElementIds = useCallback(
      () => useStore.getState().selectedElementIds || [],
      [],
    );
    const getSelectedElementId = useCallback(
      () => useStore.getState().selectedElementId,
      [],
    );
    const getMultiSelectMode = useCallback(
      () => useStore.getState().multiSelectMode || false,
      [],
    );

    // ⭐ Multi-select quick actions
    const handleCopyAll = useCallback(async () => {
      await copySelection({ elementsMap: getLegacyElementsMap() });
    }, [getLegacyElementsMap]);

    const handlePasteAll = useCallback(async () => {
      await paste({
        elementsMap: getLegacyElementsMap(),
        pasteHistory: "batch",
      });
    }, [getLegacyElementsMap]);

    // ⭐ Phase 6: Duplicate handler (Cmd+D)
    const handleDuplicate = useCallback(async () => {
      await duplicateSelection({ elementsMap: getLegacyElementsMap() });
    }, [getLegacyElementsMap]);

    // ⭐ Phase 3: Advanced Selection - Select All (Cmd+A)
    const handleSelectAll = useCallback(() => {
      const currentPageId = getCurrentPageId();

      if (!currentPageId) {
        console.warn("[SelectAll] No page selected");
        return;
      }

      // 🆕 O(1) 인덱스 기반 조회
      const getPageElements = useStore.getState().getPageElements;
      const pageElements = getPageElements(currentPageId);

      if (pageElements.length === 0) {
        console.warn("[SelectAll] No elements on current page");
        return;
      }

      // Get all element IDs from current page
      const allElementIds = pageElements.map((el) => el.id);

      // Use store's setSelectedElements
      setSelectedElements(allElementIds);
      console.log(`✅ [SelectAll] Selected ${allElementIds.length} elements`);
    }, [getCurrentPageId, setSelectedElements]);

    // ⭐ Phase 3: Advanced Selection - Clear Selection (Esc)
    const handleEscapeClearSelection = useCallback(() => {
      setSelectedElement(null);
      console.log("✅ [Esc] Selection cleared");
    }, [setSelectedElement]);

    const handleDetachSelectedInstance = useCallback(async () => {
      const selectedId = getSelectedElementId() ?? selectedElement?.id;
      const element = selectedId ? elementsById.get(selectedId) : null;
      if (!selectedId || !canDetachInstance(element)) return;
      // 확인 문구 조립은 `runComponentSemanticsAction` 이 소유한다 (ADR-199
      // Phase 3) — 종전에는 여기서 원본을 안 되짚어 패널과 문구가 갈렸다 (R2).
      await runComponentSemanticsAction("detach-instance", {
        targetId: selectedId,
        element,
      });
    }, [elementsById, getSelectedElementId, selectedElement?.id]);

    // ⭐ Phase 3: Advanced Selection - Tab Navigation
    const handleTabNavigation = useCallback(
      (event: KeyboardEvent) => {
        const multiSelectMode = getMultiSelectMode();
        const selectedElementIds = getSelectedElementIds();

        if (!multiSelectMode || selectedElementIds.length === 0) return;

        event.preventDefault();

        const currentIndex = selectedElementIds.indexOf(
          selectedElement?.id || "",
        );
        let nextIndex: number;

        if (event.shiftKey) {
          // Shift+Tab: Navigate backwards
          nextIndex =
            currentIndex <= 0
              ? selectedElementIds.length - 1
              : currentIndex - 1;
        } else {
          // Tab: Navigate forwards
          nextIndex =
            currentIndex >= selectedElementIds.length - 1
              ? 0
              : currentIndex + 1;
        }

        const nextElementId = selectedElementIds[nextIndex];
        const elementsMap = getElementsMap();
        const nextElement = elementsMap.get(nextElementId);

        if (nextElement) {
          setSelectedElement(nextElementId, nextElement.props);
          console.log(
            `✅ [Tab] Navigated to element ${nextIndex + 1}/${selectedElementIds.length}:`,
            nextElement.type,
          );
        }
      },
      [
        getMultiSelectMode,
        getSelectedElementIds,
        selectedElement,
        getElementsMap,
        setSelectedElement,
      ],
    );

    // ⭐ Phase 4: Group Selection (Cmd+G)
    const handleGroupSelection = useCallback(async () => {
      await groupSelection({ elementsMap: getLegacyElementsMap() });
    }, [getLegacyElementsMap]);

    // ⭐ Phase 4: Ungroup Selection (Cmd+Shift+G)
    const handleUngroupSelection = useCallback(async () => {
      await ungroupSelection({ elementsMap: getLegacyElementsMap() });
    }, [getLegacyElementsMap]);

    // ⭐ Phase 5.1: Element Alignment
    const handleAlign = useCallback(
      async (type: AlignmentType) => {
        await alignSelection({ elementsMap: getLegacyElementsMap() }, type);
      },
      [getLegacyElementsMap],
    );

    // ⭐ Phase 5.2: Element Distribution
    const handleDistribute = useCallback(
      async (type: DistributionType) => {
        await distributeSelection(
          { elementsMap: getLegacyElementsMap() },
          type,
        );
      },
      [getLegacyElementsMap],
    );

    // ⭐ Copy/Paste Styles (StylesPanel 에서 이전 — ADR-155 Phase 2)
    // 패널 툴바 버튼용 원본 핸들러는 StylesPanel 잔류 (같은 useStyleActions 경유).
    // 숨김 중에도 동작하던 단축키 계약 보존을 위해 host 에 등록.
    const handleCopyStyles = useCallback(async () => {
      const selectedStyle =
        (selectedElement?.style as Record<string, unknown> | undefined) ?? null;
      if (!selectedStyle) return;
      await copyStyles(selectedStyle);
    }, [selectedElement, copyStyles]);

    const handlePasteStyles = useCallback(async () => {
      await pasteStyles();
    }, [pasteStyles]);

    // 🔥 캔버스 전역 단축키 (PropertiesPanel 에서 이전 — ADR-155 Phase 2)
    //
    // key/modifier/scope/priority 는 `SHORTCUT_DEFINITIONS` 가 정본이다 — 등록이
    // 손으로 다시 적으면 정의는 치트시트 표기용으로만 남고, scope 를 생략한
    // 항목은 registry 가 global 로 간주해 모달 위에서도 동작한다 (2026-08-27
    // code-review #13: ⌘D 가 그 사례였고 나머지 15건도 같은 상태였다).
    const shortcuts = useMemo(
      () => [
        // ⭐ Multi-element copy/paste — 정의 없음: 포커스가 properties 패널 안일
        // 때만 발동 (canvas 쪽 ⌘C/⌘V 는 useGlobalKeyboardShortcuts 의 `copy`/
        // `paste` 정의가 담당). 두 표면이 같은 키를 다른 scope 로 나눠 갖는다.
        //
        // 종전 정의 `copyAllProperties`/`pasteAllProperties`(⌘⌥C/V)는 이 등록이
        // 읽지 않는 유령이라 2026-08-27 에 삭제했다. 여기를 `copy`/`paste` 정의로
        // 합치지 않은 이유는 동작이 다르기 때문이다 — canvas 쪽은
        // `writeClipboardText` 로 클립보드 텍스트도 쓰고 `requireCurrentPageForCopy`
        // 로 현재 페이지를 요구한다. scope 를 넓히면 두 핸들러가 함께 동작한다.
        {
          key: "c",
          modifier: "cmd" as const,
          handler: handleCopyAll,
          description: "Copy All Elements",
          scope: "panel:properties" as const,
        },
        {
          key: "v",
          modifier: "cmd" as const,
          handler: handlePasteAll,
          description: "Paste Elements",
          scope: "panel:properties" as const,
        },
        ...bindHandlersToDefinitions(
          [
            "duplicate",
            "selectAll",
            "escape",
            "detachInstance",
            "group",
            "ungroup",
            "alignLeft",
            "alignHCenter",
            "alignRight",
            "alignTop",
            "alignVCenter",
            "alignBottom",
            "distributeH",
            "distributeV",
            // StylesPanel 에서 이전 — 패널 Activity gating 중에도 등록이 남도록
            // host 가 갖되, scope 는 정의(`panel:styles`)를 따른다
            "copyStyles",
            "pasteStyles",
          ],
          {
            duplicate: handleDuplicate,
            selectAll: handleSelectAll,
            escape: handleEscapeClearSelection,
            detachInstance: handleDetachSelectedInstance,
            group: handleGroupSelection,
            ungroup: handleUngroupSelection,
            alignLeft: () => handleAlign("left"),
            alignHCenter: () => handleAlign("center"),
            alignRight: () => handleAlign("right"),
            alignTop: () => handleAlign("top"),
            alignVCenter: () => handleAlign("middle"),
            alignBottom: () => handleAlign("bottom"),
            distributeH: () => handleDistribute("horizontal"),
            distributeV: () => handleDistribute("vertical"),
            copyStyles: handleCopyStyles,
            pasteStyles: handlePasteStyles,
          },
        ),
      ],
      [
        handleCopyAll,
        handlePasteAll,
        handleDuplicate,
        handleSelectAll,
        handleEscapeClearSelection,
        handleDetachSelectedInstance,
        handleGroupSelection,
        handleUngroupSelection,
        handleAlign,
        handleDistribute,
        handleCopyStyles,
        handlePasteStyles,
      ],
    );

    useKeyboardShortcutsRegistry(shortcuts, [shortcuts], { activeScope });

    // ⭐ Phase 3: Tab navigation (requires special handling)
    // Note: Tab navigation requires special handling (Shift+Tab, preventDefault) that useKeyboardShortcutsRegistry doesn't support
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        const multiSelectMode = useStore.getState().multiSelectMode || false;
        const selectedElementIds = useStore.getState().selectedElementIds || [];

        if (
          event.key === "Tab" &&
          multiSelectMode &&
          selectedElementIds.length > 0
        ) {
          handleTabNavigation(event);
        }
      };

      // eslint-disable-next-line local/prefer-keyboard-shortcuts-registry
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleTabNavigation]); // multiSelectMode, selectedElementIds 제거 (함수 내부에서 가져옴)

    return null;
  },
);
