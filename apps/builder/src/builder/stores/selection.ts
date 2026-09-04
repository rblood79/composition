import { StateCreator } from "zustand";
import { useCanonicalDocumentStore } from "./canonical/canonicalDocumentStore";
import {
  getChildren,
  getNodeMap,
  getParent,
} from "./canonical/canonicalTraversalHelpers";
// 🚀 Phase 1: Immer 제거 - 함수형 업데이트로 전환
// import { produce } from 'immer'; // REMOVED

export interface SelectionState {
  // 선택 관련 상태
  multiSelectMode: boolean;
  selectedElementIds: string[];
  // 🚀 O(1) 검색용 Set (selectedElementIds와 동기화)
  selectedElementIdsSet: Set<string>;
  selectionBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;

  // 계층적 선택 상태
  /** 현재 진입한 컨테이너 ID. null = body 직계 자식 레벨 (루트) */
  editingContextId: string | null;
  /** 호버 중인 요소 ID (레이어 트리 동기화용) */
  hoveredElementId: string | null;

  // 액션들
  setMultiSelectMode: (enabled: boolean) => void;
  addToSelection: (elementId: string) => void;
  removeFromSelection: (elementId: string) => void;
  clearSelection: () => void;
  setSelectionBounds: (
    bounds: { x: number; y: number; width: number; height: number } | null,
  ) => void;
  selectAll: (elements: Array<{ id: string }>) => void;
  selectByParent: (
    parentId: string,
    elements: Array<{ id: string; parent_id?: string | null }>,
  ) => void;

  // 계층적 선택 액션
  setEditingContext: (contextId: string | null) => void;
  enterEditingContext: (elementId: string) => void;
  exitEditingContext: () => void;
  setHoveredElementId: (elementId: string | null) => void;
}

interface SelectionElement {
  id: string;
  type: string;
  parent_id?: string | null;
}

// 다른 슬라이스(ElementsState)에서 필요한 상태
interface RequiredElementsState {
  elementsMap: ReadonlyMap<string, SelectionElement>;
  childrenMap: ReadonlyMap<string, readonly SelectionElement[]>;
}

type CombinedSelectionState = SelectionState & RequiredElementsState;

interface SelectionHierarchyEntry extends SelectionElement {
  hasChildren: boolean;
  parentType: string | null;
}

function getSelectionHierarchyEntry(
  state: RequiredElementsState,
  elementId: string,
): SelectionHierarchyEntry | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  const hasCanonicalDocument = Boolean(
    projectId && canonical.documents.has(projectId),
  );
  if (hasCanonicalDocument) {
    const node = getNodeMap().get(elementId);
    if (!node) return null;
    const parent = getParent(elementId);
    return {
      id: node.id,
      type: node.type,
      parent_id: parent?.id ?? null,
      parentType: parent?.type ?? null,
      hasChildren: getChildren(node).length > 0,
    };
  }

  const element = state.elementsMap.get(elementId);
  if (!element) return null;
  const parent = element.parent_id
    ? state.elementsMap.get(element.parent_id)
    : null;
  return {
    ...element,
    parentType: parent?.type ?? null,
    hasChildren: (state.childrenMap.get(elementId)?.length ?? 0) > 0,
  };
}

export const createSelectionSlice: StateCreator<
  CombinedSelectionState,
  [],
  [],
  SelectionState
> = (set, get) => ({
  multiSelectMode: false,
  selectedElementIds: [],
  // 🚀 O(1) 검색용 Set 초기화
  selectedElementIdsSet: new Set<string>(),
  selectionBounds: null,
  editingContextId: null,
  hoveredElementId: null,

  // 🚀 Phase 1: Immer → 함수형 업데이트
  setMultiSelectMode: (enabled) => {
    const { selectedElementIds } = get();
    const newIds = enabled
      ? selectedElementIds
      : selectedElementIds.slice(0, 1);
    set({
      multiSelectMode: enabled,
      // 단일 선택 모드로 전환 시 선택된 요소가 1개만 남도록
      selectedElementIds: newIds,
      selectedElementIdsSet: new Set(newIds),
    });
  },

  // 🚀 Phase 1: Immer → 함수형 업데이트
  // 🚀 O(n) → O(1) 최적화: Set 사용
  addToSelection: (elementId) => {
    const { multiSelectMode, selectedElementIdsSet } = get();
    if (!multiSelectMode) {
      // 단일 선택 모드인 경우 기존 선택을 모두 제거
      set({
        selectedElementIds: [elementId],
        selectedElementIdsSet: new Set([elementId]),
      });
    } else {
      // 다중 선택 모드인 경우 추가 (중복 방지) - Set으로 O(1) 검사
      if (!selectedElementIdsSet.has(elementId)) {
        const newSet = new Set(selectedElementIdsSet);
        newSet.add(elementId);
        set({
          selectedElementIds: Array.from(newSet),
          selectedElementIdsSet: newSet,
        });
      }
    }
  },

  // 🚀 Phase 1: Immer → 함수형 업데이트
  removeFromSelection: (elementId: string) => {
    const { selectedElementIdsSet } = get();
    const newSet = new Set(selectedElementIdsSet);
    newSet.delete(elementId);
    set({
      selectedElementIds: Array.from(newSet),
      selectedElementIdsSet: newSet,
    });
  },

  // 🚀 Phase 1: Immer → 함수형 업데이트
  clearSelection: () =>
    set({
      selectedElementIds: [],
      selectedElementIdsSet: new Set<string>(),
      selectionBounds: null,
    }),

  // 🚀 Phase 1: Immer → 함수형 업데이트
  setSelectionBounds: (bounds) => set({ selectionBounds: bounds }),

  // 🚀 Phase 1: Immer → 함수형 업데이트
  selectAll: (elements) => {
    const ids = elements.map((el) => el.id);
    set({
      selectedElementIds: ids,
      selectedElementIdsSet: new Set(ids),
    });
  },

  // 🚀 Phase 1: Immer → 함수형 업데이트
  selectByParent: (parentId, elements) => {
    const childElements = elements.filter((el) => el.parent_id === parentId);
    const ids = childElements.map((el) => el.id);
    set({
      selectedElementIds: ids,
      selectedElementIdsSet: new Set(ids),
    });
  },

  // 계층적 선택 액션
  setEditingContext: (contextId) => {
    set({
      editingContextId: contextId,
      selectedElementIds: [],
      selectedElementIdsSet: new Set<string>(),
      selectionBounds: null,
    });
  },

  enterEditingContext: (elementId) => {
    const entry = getSelectionHierarchyEntry(get(), elementId);
    if (!entry?.hasChildren) return;
    set({
      editingContextId: elementId,
      selectedElementIds: [],
      selectedElementIdsSet: new Set<string>(),
      selectionBounds: null,
    });
  },

  exitEditingContext: () => {
    const state = get();
    const { editingContextId } = state;
    if (editingContextId === null) return;

    const contextEntry = getSelectionHierarchyEntry(state, editingContextId);
    if (!contextEntry) {
      set({ editingContextId: null });
      return;
    }

    // body 직계 자식이면 루트로, 아니면 부모로 이동
    const newContextId =
      contextEntry.parentType === "body"
        ? null
        : (contextEntry.parent_id ?? null);

    // 빠져나온 컨테이너를 선택 상태로
    set({
      editingContextId: newContextId,
      selectedElementIds: [editingContextId],
      selectedElementIdsSet: new Set([editingContextId]),
      selectionBounds: null,
    });
  },

  setHoveredElementId: (elementId) => set({ hoveredElementId: elementId }),
});
