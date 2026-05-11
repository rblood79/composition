import { useCallback } from "react";
import { useStore } from "../../../stores";
import { useEditModeStore } from "../../../stores/editMode";
import { selectReusableFrame } from "../../../stores/utils/frameActions";
import {
  resolveClickTarget,
  resolveContextEntryTarget,
  resolveEditingContextForTreeSelection,
  resolveModifierClickTarget,
} from "../../../utils/hierarchicalSelection";
import type { ComponentElementProps } from "../../../../types/core/store.types";
import { getElementBoundsSimple } from "../elementRegistry";
import { getFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { CanvasInteractionNode } from "../interaction/interactionNode";

interface SelectionModifiers {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

interface UseCanvasElementSelectionHandlersOptions {
  clearSelection: () => void;
  isEditing: boolean;
  /**
   * ADR-069 Phase 1: 페이지 전환 + 선택을 단일 set()으로 병합하는 action.
   * 기존 clearSelection + setCurrentPageId + setSelectedElement 3-set 조합을 대체한다.
   */
  selectElementWithPageTransition: (
    elementId: string,
    targetPageId: string | null,
    options?: {
      editingContextId?: string | null;
      props?: ComponentElementProps;
    },
  ) => void;
  setCurrentPageId: (pageId: string) => void;
  setSelectedElement: (
    elementId: string | null,
    props?: Record<string, unknown>,
  ) => void;
  setSelectedElements: (elementIds: string[]) => void;
  startEdit: (
    elementId: string,
    layoutPosition?: { x: number; y: number; width: number; height: number },
  ) => void;
  getInteractiveChildrenMap: () => Map<string, CanvasInteractionNode[]>;
  getInteractiveElementsMap: () => Map<string, CanvasInteractionNode>;
}

const TEXT_EDITABLE_TAGS = new Set([
  "Text",
  "Heading",
  "Label",
  "Paragraph",
  "Link",
  "Description",
  "Strong",
  "Em",
  "Code",
  "Button",
  "ToggleButton",
  "Tag",
  "Badge",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
  "a",
  "label",
  "button",
]);

function syncReusableFrameSelectionForElement(
  element: CanvasInteractionNode | undefined,
): void {
  if (!element) return;
  if (element.page_id != null) return;
  const layoutId = getFrameElementMirrorId(element);
  if (!layoutId) return;

  selectReusableFrame(layoutId);
  useEditModeStore.getState().setCurrentLayoutId(layoutId);
}

// ADR-069 Phase 1: startTransition 제거
// Zustand 외부 store는 React의 `useSyncExternalStore`로 구독되며 transition lane으로
// 분리되지 않는다 (set() 즉시 notify). 따라서 startTransition 래핑은 외부 store
// notify 비용을 완화하지 못하므로 제거하고, same-turn set() 호출 자체를 줄이는
// selectElementWithPageTransition 병합 action에 의존한다.
function selectResolvedTarget(
  resolvedTarget: string,
  modifiers: SelectionModifiers | undefined,
  targetPageId: string | null,
  setSelectedElement: (
    elementId: string | null,
    props?: Record<string, unknown>,
  ) => void,
  setSelectedElements: (elementIds: string[]) => void,
  clearSelection: () => void,
  selectElementWithPageTransition: (
    elementId: string,
    targetPageId: string | null,
    options?: {
      editingContextId?: string | null;
      props?: ComponentElementProps;
    },
  ) => void,
  interactiveElementsMap: Map<string, CanvasInteractionNode>,
): void {
  const isMultiSelectKey = modifiers?.shiftKey;

  if (isMultiSelectKey) {
    const currentState = useStore.getState();
    const currentPageId = currentState.currentPageId;
    const targetElement = interactiveElementsMap.get(resolvedTarget);

    // 다른 페이지 요소를 modifier와 함께 클릭한 경우: 단일 선택 + 페이지 전환으로 대체
    if (targetElement?.page_id && targetElement.page_id !== currentPageId) {
      selectElementWithPageTransition(resolvedTarget, targetElement.page_id);
      return;
    }

    const selectedSet = new Set(currentState.selectedElementIds);
    if (selectedSet.has(resolvedTarget)) {
      selectedSet.delete(resolvedTarget);
      if (selectedSet.size > 0) {
        setSelectedElements(Array.from(selectedSet));
      } else {
        clearSelection();
      }
    } else {
      selectedSet.add(resolvedTarget);
      setSelectedElements(Array.from(selectedSet));
    }
    return;
  }

  // 단일 선택: 페이지 전환이 필요하면 병합 action, 아니면 기존 setSelectedElement
  if (targetPageId) {
    selectElementWithPageTransition(resolvedTarget, targetPageId);
  } else {
    const targetElement = interactiveElementsMap.get(resolvedTarget);
    syncReusableFrameSelectionForElement(targetElement);
    setSelectedElement(
      resolvedTarget,
      targetElement?.props as Record<string, unknown> | undefined,
    );
  }
}

function handleUnresolvedTarget(
  elementId: string,
  clickedElement: CanvasInteractionNode | undefined,
  setSelectedElement: (elementId: string | null) => void,
  selectElementWithPageTransition: (
    elementId: string,
    targetPageId: string | null,
  ) => void,
): void {
  if (clickedElement?.type.toLowerCase() !== "body") {
    return;
  }

  syncReusableFrameSelectionForElement(clickedElement);

  // ADR-069 Phase 1: body + 페이지 전환을 병합 action으로 단일 set()
  if (
    clickedElement.page_id &&
    clickedElement.page_id !== useStore.getState().currentPageId
  ) {
    selectElementWithPageTransition(elementId, clickedElement.page_id);
    return;
  }

  setSelectedElement(elementId);
}

function selectDirectModifierTarget(
  elementId: string,
  interactiveElementsMap: Map<string, CanvasInteractionNode>,
  selectElementWithPageTransition: (
    elementId: string,
    targetPageId: string | null,
    options?: {
      editingContextId?: string | null;
      props?: ComponentElementProps;
    },
  ) => void,
): void {
  const state = useStore.getState();
  const directElement = interactiveElementsMap.get(elementId);
  if (!directElement) return;

  const targetPageId =
    directElement.page_id && directElement.page_id !== state.currentPageId
      ? directElement.page_id
      : null;
  const editingContextId = resolveEditingContextForTreeSelection(
    elementId,
    interactiveElementsMap,
  );

  selectElementWithPageTransition(elementId, targetPageId, {
    editingContextId,
    props: directElement.props as ComponentElementProps | undefined,
  });
}

export function useCanvasElementSelectionHandlers({
  clearSelection,
  isEditing,
  selectElementWithPageTransition,
  setCurrentPageId: _setCurrentPageId,
  setSelectedElement,
  setSelectedElements,
  startEdit,
  getInteractiveChildrenMap,
  getInteractiveElementsMap,
}: UseCanvasElementSelectionHandlersOptions) {
  // setCurrentPageId는 ADR-069 이전 API 호환을 위해 options에 유지하되,
  // 본 hook 내부에서는 selectElementWithPageTransition으로 전환되어 직접 사용하지 않는다.
  void _setCurrentPageId;

  const handleElementClick = useCallback(
    (elementId: string, modifiers?: SelectionModifiers) => {
      if (isEditing) {
        return;
      }

      const state = useStore.getState();
      const interactiveElementsMap = getInteractiveElementsMap();
      const clickedElement = interactiveElementsMap.get(elementId);

      // ADR-069 Phase 1: page crossing 판정만 여기서 하고, 실제 clearSelection +
      // setCurrentPageId + setSelectedElement 3-set 병합은 selectResolvedTarget
      // 내부에서 selectElementWithPageTransition 단일 action으로 수행한다.
      const targetPageId =
        clickedElement?.page_id &&
        clickedElement.page_id !== state.currentPageId
          ? clickedElement.page_id
          : null;
      const directModifierTarget =
        (modifiers?.metaKey || modifiers?.ctrlKey) && !modifiers.shiftKey
          ? resolveModifierClickTarget(
              elementId,
              state.editingContextId,
              interactiveElementsMap,
            )
          : null;

      if (directModifierTarget) {
        selectDirectModifierTarget(
          directModifierTarget,
          interactiveElementsMap,
          selectElementWithPageTransition,
        );
        return;
      }

      let resolvedTarget = resolveClickTarget(
        elementId,
        state.editingContextId,
        interactiveElementsMap,
      );

      if (!resolvedTarget) {
        if (state.editingContextId === null) {
          handleUnresolvedTarget(
            elementId,
            clickedElement,
            setSelectedElement,
            selectElementWithPageTransition,
          );
          return;
        }

        // context 밖 요소 클릭: 루트로 즉시 복귀 후 해당 요소 선택 시도
        state.setEditingContext(null);
        resolvedTarget = resolveClickTarget(
          elementId,
          null,
          interactiveElementsMap,
        );
        if (!resolvedTarget) {
          handleUnresolvedTarget(
            elementId,
            clickedElement,
            setSelectedElement,
            selectElementWithPageTransition,
          );
          return;
        }
      }

      selectResolvedTarget(
        resolvedTarget,
        modifiers,
        targetPageId,
        setSelectedElement,
        setSelectedElements,
        clearSelection,
        selectElementWithPageTransition,
        interactiveElementsMap,
      );
    },
    [
      clearSelection,
      isEditing,
      selectElementWithPageTransition,
      setSelectedElement,
      setSelectedElements,
      getInteractiveElementsMap,
    ],
  );

  const handleElementDoubleClick = useCallback(
    (elementId: string) => {
      const state = useStore.getState();
      const interactiveElementsMap = getInteractiveElementsMap();
      const interactiveChildrenMap = getInteractiveChildrenMap();
      const resolvedTarget = resolveClickTarget(
        elementId,
        state.editingContextId,
        interactiveElementsMap,
      );
      if (!resolvedTarget) {
        return;
      }

      const resolvedElement = interactiveElementsMap.get(resolvedTarget);
      if (!resolvedElement) {
        return;
      }

      if (TEXT_EDITABLE_TAGS.has(resolvedElement.type)) {
        const layoutPosition = getElementBoundsSimple(resolvedTarget);
        startEdit(resolvedTarget, layoutPosition ?? undefined);
        return;
      }

      const children = interactiveChildrenMap.get(resolvedTarget);
      if (children && children.length > 0) {
        const entryTarget = resolveContextEntryTarget(
          elementId,
          resolvedTarget,
          interactiveElementsMap,
        );
        state.setEditingContext(resolvedTarget);
        if (entryTarget) {
          selectResolvedTarget(
            entryTarget,
            undefined,
            null,
            setSelectedElement,
            setSelectedElements,
            clearSelection,
            selectElementWithPageTransition,
            interactiveElementsMap,
          );
        } else {
          setSelectedElement(null);
        }
        return;
      }

      const layoutPosition = getElementBoundsSimple(resolvedTarget);
      startEdit(resolvedTarget, layoutPosition ?? undefined);
    },
    [
      clearSelection,
      getInteractiveChildrenMap,
      getInteractiveElementsMap,
      selectElementWithPageTransition,
      setSelectedElement,
      setSelectedElements,
      startEdit,
    ],
  );

  return {
    handleElementClick,
    handleElementDoubleClick,
  };
}
