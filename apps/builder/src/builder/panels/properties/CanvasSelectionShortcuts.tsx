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
import { useKeyboardShortcutsRegistry, useActiveScope } from "@/builder/hooks";
import { useCanonicalPropertyElementsMap } from "./hooks/useCanonicalPropertyRead";
import {
  copyMultipleElements,
  pasteMultipleElements,
  resolvePasteTargetParentId,
  serializeCopiedElements,
  deserializeCopiedElements,
} from "../../utils/multiElementCopy";
import {
  createGroupFromSelection,
  isFrameOrLegacyGroup,
  ungroupElement,
} from "../../stores/utils/elementGrouping";
import { alignElements } from "../../stores/utils/elementAlignment";
import type { AlignmentType } from "../../stores/utils/elementAlignment";
import { distributeElements } from "../../stores/utils/elementDistribution";
import type { DistributionType } from "../../stores/utils/elementDistribution";
import { canDetachInstance } from "../../utils/editingSemantics";
import {
  trackGroupCreation,
  trackUngroup,
  trackMultiPaste,
} from "../../stores/utils/historyHelpers";
import { requestEditingSemanticsDetachConfirmation } from "../../utils/editingSemanticsImpactConfirmation";
import { panelNodeMapToElementMap } from "./panelNodeElementMap";
import { useStyleActions } from "../styles/hooks/useStyleActions";

export const CanvasSelectionShortcutsHost = memo(
  function CanvasSelectionShortcutsHost() {
    const selectedElement = useDebouncedSelectedElementData();
    const elementsById = useCanonicalPropertyElementsMap();
    const activeScope = useActiveScope();
    const { copyStyles, pasteStyles } = useStyleActions();

    // 🚀 Performance: 액션만 가져오기 (구독 없음)
    const removeElement = useStore.getState().removeElement;
    const setSelectedElement = useStore.getState().setSelectedElement;
    const updateElementProps = useStore.getState().updateElementProps;
    const addElement = useStore.getState().addElement;
    const updateElement = useStore.getState().updateElement;
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
      const selectedElementIds = getSelectedElementIds();
      console.log("[Copy] Starting copy operation...", { selectedElementIds });

      if (selectedElementIds.length === 0) {
        console.warn("[Copy] No elements selected");
        return;
      }

      try {
        // Copy elements with relationship preservation
        console.log("[Copy] Calling copyMultipleElements...");
        const elementsMap = getLegacyElementsMap();
        const copiedData = copyMultipleElements(
          selectedElementIds,
          elementsMap,
        );
        console.log("[Copy] Copied data:", {
          elementCount: copiedData.elements.length,
          rootIds: copiedData.rootIds,
          externalParents: copiedData.externalParents.size,
        });

        // Serialize and copy to clipboard
        console.log("[Copy] Serializing to JSON...");
        const jsonData = serializeCopiedElements(copiedData);
        console.log("[Copy] JSON length:", jsonData.length, "bytes");

        console.log("[Copy] Writing to clipboard...");
        // Note: useCopyPaste hook doesn't support complex element copying with relationships
        // eslint-disable-next-line local/prefer-copy-paste-hook
        await navigator.clipboard.writeText(jsonData);

        console.log(
          `✅ [Copy] Successfully copied ${selectedElementIds.length} elements to clipboard`,
        );
        // TODO: Show toast notification
      } catch (error) {
        console.error("❌ [Copy] Failed to copy elements:", error);
        // TODO: Show error toast
      }
    }, [getSelectedElementIds, getLegacyElementsMap]);

    const handlePasteAll = useCallback(async () => {
      const currentPageId = getCurrentPageId();
      console.log("[Paste] Starting paste operation...", { currentPageId });

      if (!currentPageId) {
        console.warn("[Paste] No current page selected");
        return;
      }

      try {
        // Read from clipboard
        console.log("[Paste] Reading from clipboard...");
        // Note: useCopyPaste hook doesn't support complex element pasting with relationships
        // eslint-disable-next-line local/prefer-copy-paste-hook
        const clipboardText = await navigator.clipboard.readText();
        console.log(
          "[Paste] Clipboard text length:",
          clipboardText.length,
          "bytes",
        );
        console.log(
          "[Paste] First 100 chars:",
          clipboardText.substring(0, 100),
        );

        // Deserialize
        console.log("[Paste] Deserializing clipboard data...");
        const copiedData = deserializeCopiedElements(clipboardText);
        if (!copiedData) {
          console.warn(
            "[Paste] Clipboard does not contain valid composition element data",
          );
          return;
        }

        console.log("[Paste] Deserialized data:", {
          elementCount: copiedData.elements.length,
          rootIds: copiedData.rootIds,
          externalParents: copiedData.externalParents.size,
        });

        // Paste with offset
        console.log("[Paste] Creating new elements with offset...");
        const elementsMap = getLegacyElementsMap();
        const newElements = pasteMultipleElements(
          copiedData,
          currentPageId,
          {
            x: 10,
            y: 10,
          },
          Array.from(elementsMap.values()),
          {
            targetParentId: resolvePasteTargetParentId({
              currentPageId,
              selectedElementId: getSelectedElementId(),
              elements: elementsMap.values(),
            }),
          },
        );
        console.log("[Paste] New elements created:", newElements.length);

        if (newElements.length === 0) {
          console.warn("[Paste] No elements to paste");
          return;
        }

        // Add all new elements to store
        console.log("[Paste] Adding elements to store...");
        await Promise.all(
          newElements.map((element) => {
            console.log("[Paste] Adding element:", element.id, element.type);
            return addElement(element, { skipHistory: true });
          }),
        );

        // ⭐ Phase 7: Track in history AFTER adding elements
        trackMultiPaste(newElements);

        console.log(
          `✅ [Paste] Successfully pasted ${newElements.length} elements`,
        );
        // TODO: Show toast notification
      } catch (error) {
        console.error("❌ [Paste] Failed to paste elements:", error);
        // TODO: Show error toast
      }
    }, [
      getCurrentPageId,
      getSelectedElementId,
      getLegacyElementsMap,
      addElement,
    ]);

    // ⭐ Phase 6: Duplicate handler (Cmd+D)
    const handleDuplicate = useCallback(async () => {
      const multiSelectMode = getMultiSelectMode();
      const selectedElementIds = getSelectedElementIds();
      const currentPageId = getCurrentPageId();

      if (
        !multiSelectMode ||
        selectedElementIds.length === 0 ||
        !currentPageId
      ) {
        console.warn("[Duplicate] No elements selected or no page active");
        return;
      }

      try {
        console.log(
          `[Duplicate] Duplicating ${selectedElementIds.length} elements`,
        );

        // Copy current selection
        const elementsMap = getLegacyElementsMap();
        const copiedData = copyMultipleElements(
          selectedElementIds,
          elementsMap,
        );

        // Paste with 10px offset (standard offset for duplicate)
        const newElements = pasteMultipleElements(
          copiedData,
          currentPageId,
          {
            x: 10,
            y: 10,
          },
          Array.from(elementsMap.values()),
        );

        if (newElements.length === 0) {
          console.warn("[Duplicate] No elements to duplicate");
          return;
        }

        // Add all new elements to store
        await Promise.all(
          newElements.map((element) =>
            addElement(element, { skipHistory: true }),
          ),
        );

        // ⭐ Track in history AFTER adding elements
        trackMultiPaste(newElements);

        // ⭐ Auto-select duplicated elements
        const newElementIds = newElements.map((el) => el.id);
        setSelectedElements(newElementIds);
        console.log(
          `✅ [Duplicate] Duplicated and selected ${newElements.length} elements`,
        );

        // TODO: Show toast notification
      } catch (error) {
        console.error("❌ [Duplicate] Failed to duplicate elements:", error);
        // TODO: Show error toast
      }
    }, [
      getMultiSelectMode,
      getSelectedElementIds,
      getCurrentPageId,
      getLegacyElementsMap,
      addElement,
      setSelectedElements,
    ]);

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
      const state = useStore.getState();
      const selectedId = getSelectedElementId() ?? selectedElement?.id;
      const element = selectedId ? elementsById.get(selectedId) : null;
      if (!selectedId || !canDetachInstance(element)) return;

      const confirmed = await requestEditingSemanticsDetachConfirmation({
        instanceId: selectedId,
        instanceLabel:
          element?.componentName ??
          element?.customId ??
          element?.type ??
          selectedId,
      });
      if (!confirmed) return;

      state.detachInstance(selectedId);
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
      const multiSelectMode = getMultiSelectMode();
      const selectedElementIds = getSelectedElementIds();
      const pageId = getCurrentPageId();

      if (!multiSelectMode || selectedElementIds.length < 2 || !pageId) {
        console.warn("[Group] Need at least 2 elements selected");
        return;
      }

      try {
        console.log("[Group] Grouping", selectedElementIds.length, "elements");

        const elementsMap = getLegacyElementsMap();
        const previousChildren = selectedElementIds
          .map((id: string) => elementsMap.get(id))
          .filter((el): el is NonNullable<typeof el> => el !== undefined);

        // Create group from selection. Cross-page selection 도 허용 — 최초 선택 요소의
        // page 가 frame anchor 가 되고, 다른 page 의 selection 도 frame 의 child 로
        // 이동 (page_id 도 frame.page_id 로 reparent).
        const { groupElement, updatedChildren } = createGroupFromSelection(
          selectedElementIds,
          elementsMap,
          pageId,
        );

        // Add group to store (this saves to DB)
        await addElement(groupElement, { skipHistory: true });

        // Update children with new parent_id + page_id.
        // updateElement 가 store-layer 에서 atomic (set callback 안 latest state 기반
        // derive) 이므로 concurrent Promise.all 호출도 race-free. page_id 도 함께
        // update — cross-page 의 다른 page element 가 frame.page_id 로 이동해야
        // canonical document tree 의 page 경계 정합 + frame 의 child 로 정상 인식.
        await Promise.all(
          updatedChildren.map((child) =>
            updateElement(child.id, {
              parent_id: child.parent_id,
              page_id: child.page_id,
            }),
          ),
        );

        // ⭐ Phase 7: Track in history AFTER group creation
        trackGroupCreation(groupElement, previousChildren, updatedChildren);

        // Select the new group
        setSelectedElement(groupElement.id, groupElement.props);

        console.log(
          `✅ [Group] Created group ${groupElement.id} with ${updatedChildren.length} children`,
        );
      } catch (error) {
        console.error("❌ [Group] Failed to create group:", error);
      }
    }, [
      getMultiSelectMode,
      getSelectedElementIds,
      getCurrentPageId,
      getLegacyElementsMap,
      addElement,
      updateElement,
      setSelectedElement,
    ]);

    // ⭐ Phase 4: Ungroup Selection (Cmd+Shift+G)
    const handleUngroupSelection = useCallback(async () => {
      if (!selectedElement || !isFrameOrLegacyGroup(selectedElement.type)) {
        console.warn("[Ungroup] Selected element is not a frame/Group");
        return;
      }

      try {
        console.log("[Ungroup] Ungrouping element", selectedElement.id);

        const elementsMap = getLegacyElementsMap();

        // Store group element before deletion for history
        const groupElementForHistory = elementsMap.get(selectedElement.id);
        const previousChildren = Array.from(elementsMap.values()).filter(
          (element) => element.parent_id === selectedElement.id,
        );

        // Ungroup element
        const { updatedChildren, groupIdToDelete } = ungroupElement(
          selectedElement.id,
          elementsMap,
        );

        // ⭐ Phase 7: Track in history BEFORE making changes
        if (groupElementForHistory) {
          trackUngroup(
            groupIdToDelete,
            previousChildren,
            groupElementForHistory,
            updatedChildren,
          );
        }

        // Update children with new parent_id (IndexedDB persistence via updateElement)
        await Promise.all(
          updatedChildren.map(async (child) => {
            await updateElement(child.id, {
              parent_id: child.parent_id,
            });
          }),
        );

        // Delete group element.
        // skipHistory: trackUngroup 이 이미 group 의 remove event 를 기록한다
        //   (buildCanonicalUngroupEvents = move 들 + remove). 여기서 또 기록하면 같은
        //   삭제가 두 엔트리가 되어 undo 1회는 "빈 frame 만 복원", 2회에야 자식이
        //   돌아오는 죽은 단계가 생긴다 (실측: 그룹 해제 1회 → 엔트리 2개).
        //   group 생성 쪽 addElement(…, { skipHistory: true }) 와 대칭.
        await removeElement(groupIdToDelete, { skipHistory: true });

        // Select first child
        if (updatedChildren.length > 0) {
          setSelectedElement(updatedChildren[0].id, updatedChildren[0].props);
        } else {
          setSelectedElement(null);
        }

        console.log(
          `✅ [Ungroup] Ungrouped ${updatedChildren.length} elements`,
        );
      } catch (error) {
        console.error("❌ [Ungroup] Failed to ungroup:", error);
      }
    }, [
      selectedElement,
      getLegacyElementsMap,
      updateElement,
      removeElement,
      setSelectedElement,
    ]);

    // ⭐ Phase 5.1: Element Alignment
    const handleAlign = useCallback(
      async (type: AlignmentType) => {
        const multiSelectMode = getMultiSelectMode();
        const selectedElementIds = getSelectedElementIds();

        if (!multiSelectMode || selectedElementIds.length < 2) {
          console.warn("[Alignment] Need at least 2 elements selected");
          return;
        }

        try {
          console.log(
            `[Alignment] Aligning ${selectedElementIds.length} elements to ${type}`,
          );

          const elementsMap = getLegacyElementsMap();

          // Calculate alignment updates
          const updates = alignElements(selectedElementIds, elementsMap, type);

          if (updates.length === 0) {
            console.warn("[Alignment] No updates generated");
            return;
          }

          // 단일 batch 로 적용 = 되돌리기 1회. 요소별 updateElementProps 를 Promise.all
          //   로 돌리면 각 호출이 자기 entry 를 만들어 undo 가 요소 수만큼 늘어난다.
          //   trackBatchUpdate 도 제거했다 — batchUpdateElementProps 가 요소별 merged
          //   props 로 batch entry 1개를 스스로 기록하며, 여기서 넘기던 인자는 형태부터
          //   틀렸다 (2번째 인자는 "모든 요소에 적용할 props 패치" 인데 `{elementId: style}`
          //   맵을 넘겨 요소 id 가 prop 이름으로 기록됐다).
          const batchUpdateElementProps =
            useStore.getState().batchUpdateElementProps;
          await batchUpdateElementProps(
            updates.flatMap((update) => {
              const element = elementsMap.get(update.id);
              if (!element) return [];
              return [
                {
                  elementId: update.id,
                  props: {
                    style: {
                      ...((element.props.style as Record<string, unknown>) ||
                        {}),
                      ...update.style,
                    },
                  } as import("../../../types/core/store.types").ComponentElementProps,
                },
              ];
            }),
          );

          console.log(
            `✅ [Alignment] Aligned ${updates.length} elements to ${type}`,
          );
        } catch (error) {
          console.error("❌ [Alignment] Failed to align:", error);
        }
      },
      [
        getMultiSelectMode,
        getSelectedElementIds,
        getLegacyElementsMap,
        updateElementProps,
      ],
    );

    // ⭐ Phase 5.2: Element Distribution
    const handleDistribute = useCallback(
      async (type: DistributionType) => {
        const multiSelectMode = getMultiSelectMode();
        const selectedElementIds = getSelectedElementIds();

        if (!multiSelectMode || selectedElementIds.length < 3) {
          console.warn("[Distribution] Need at least 3 elements selected");
          return;
        }

        try {
          console.log(
            `[Distribution] Distributing ${selectedElementIds.length} elements ${type}ly`,
          );

          const elementsMap = getLegacyElementsMap();

          // Calculate distribution updates
          const updates = distributeElements(
            selectedElementIds,
            elementsMap,
            type,
          );

          if (updates.length === 0) {
            console.warn("[Distribution] No updates generated");
            return;
          }

          // 단일 batch 로 적용 = 되돌리기 1회. 요소별 updateElementProps 를 Promise.all
          //   로 돌리면 각 호출이 자기 entry 를 만들어 undo 가 요소 수만큼 늘어난다.
          //   trackBatchUpdate 도 제거했다 — batchUpdateElementProps 가 요소별 merged
          //   props 로 batch entry 1개를 스스로 기록하며, 여기서 넘기던 인자는 형태부터
          //   틀렸다 (2번째 인자는 "모든 요소에 적용할 props 패치" 인데 `{elementId: style}`
          //   맵을 넘겨 요소 id 가 prop 이름으로 기록됐다).
          const batchUpdateElementProps =
            useStore.getState().batchUpdateElementProps;
          await batchUpdateElementProps(
            updates.flatMap((update) => {
              const element = elementsMap.get(update.id);
              if (!element) return [];
              return [
                {
                  elementId: update.id,
                  props: {
                    style: {
                      ...((element.props.style as Record<string, unknown>) ||
                        {}),
                      ...update.style,
                    },
                  } as import("../../../types/core/store.types").ComponentElementProps,
                },
              ];
            }),
          );

          console.log(
            `✅ [Distribution] Distributed ${updates.length} elements ${type}ly`,
          );
        } catch (error) {
          console.error("❌ [Distribution] Failed to distribute:", error);
        }
      },
      [
        getMultiSelectMode,
        getSelectedElementIds,
        getLegacyElementsMap,
        updateElementProps,
      ],
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
    const shortcuts = useMemo(
      () => [
        // ⭐ Multi-element shortcuts
        // scope 유지: 원본 (PropertiesPanel) 과 동일 — 포커스가 properties 패널
        // 안일 때만 발동 (canvas 쪽 copy/paste 는 BuilderCanvas 자체 등록 담당)
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
        {
          key: "d",
          modifier: "cmd" as const,
          handler: handleDuplicate,
          description: "Duplicate Selection",
        },
        // ⭐ Phase 3: Advanced Selection shortcuts
        {
          key: "a",
          modifier: "cmd" as const,
          handler: handleSelectAll,
          description: "Select All",
        },
        {
          key: "Escape",
          modifier: "none" as const,
          handler: handleEscapeClearSelection,
          description: "Clear Selection",
        },
        {
          key: "x",
          modifier: "cmdAlt" as const,
          handler: handleDetachSelectedInstance,
          description: "Detach Instance",
        },
        // ⭐ Phase 4: Grouping shortcuts
        {
          key: "g",
          modifier: "cmd" as const,
          handler: handleGroupSelection,
          description: "Group Selection",
        },
        {
          key: "g",
          modifier: "cmdShift" as const,
          handler: handleUngroupSelection,
          description: "Ungroup Selection",
        },
        // ⭐ Phase 5.1: Alignment shortcuts
        {
          key: "l",
          modifier: "cmdShift" as const,
          handler: () => handleAlign("left"),
          description: "Align Left",
        },
        {
          key: "h",
          modifier: "cmdShift" as const,
          handler: () => handleAlign("center"),
          description: "Align Horizontal Center",
        },
        {
          key: "r",
          modifier: "cmdShift" as const,
          handler: () => handleAlign("right"),
          description: "Align Right",
        },
        {
          key: "t",
          modifier: "cmdShift" as const,
          handler: () => handleAlign("top"),
          description: "Align Top",
        },
        {
          key: "m",
          modifier: "cmdShift" as const,
          handler: () => handleAlign("middle"),
          description: "Align Vertical Middle",
        },
        {
          key: "b",
          modifier: "cmdShift" as const,
          handler: () => handleAlign("bottom"),
          description: "Align Bottom",
        },
        // ⭐ Phase 5.2: Distribution shortcuts
        {
          key: "d",
          modifier: "cmdShift" as const,
          handler: () => handleDistribute("horizontal"),
          description: "Distribute Horizontally",
        },
        {
          key: "v",
          modifier: "altShift" as const,
          handler: () => handleDistribute("vertical"),
          description: "Distribute Vertically",
        },
        // ⭐ Copy/Paste Styles (StylesPanel 에서 이전)
        {
          key: "c",
          modifier: "cmdShift" as const,
          handler: handleCopyStyles,
          description: "Copy Styles",
        },
        {
          key: "v",
          modifier: "cmdShift" as const,
          handler: handlePasteStyles,
          description: "Paste Styles",
        },
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

    useKeyboardShortcutsRegistry(
      shortcuts,
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
      { activeScope },
    );

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
