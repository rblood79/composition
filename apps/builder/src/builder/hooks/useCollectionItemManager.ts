/**
 * useCollectionItemManager - Collection Item 관리 자동화
 *
 * ListBox, GridList, Select, ComboBox 등 Collection 컴포넌트의
 * 자식 Item 관리를 위한 공통 훅
 *
 * @example
 * ```tsx
 * const { children, selectedItemIndex, selectItem, addItem, deleteItem, updateItem } =
 *   useCollectionItemManager({
 *     elementId: 'listbox-1',
 *     childTag: 'ListBoxItem',
 *     defaultItemProps: (index) => ({
 *       label: `Item ${index + 1}`,
 *       value: `item${index + 1}`,
 *     }),
 *   });
 * ```
 */

import { useState, useMemo, useCallback } from "react";
import { useStore } from "../stores";
import { visitCanonicalDocumentElements } from "../stores/canonical/canonicalElementsView";
import { useActiveCanonicalDocument } from "../stores/canonical/canonicalElementsBridge";
import { ElementUtils } from "../../utils/element/elementUtils";

interface CollectionItemNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  customId?: string;
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

const EMPTY_CHILDREN: CollectionItemNode[] = [];

function useCollectionChildren(elementId: string): CollectionItemNode[] {
  const canonicalDocument = useActiveCanonicalDocument();
  const canonicalChildren = useMemo(() => {
    if (!canonicalDocument) return null;
    const children: CollectionItemNode[] = [];
    visitCanonicalDocumentElements(canonicalDocument, (element) => {
      if (!element.deleted && element.parent_id === elementId) {
        children.push(element);
      }
    });
    return children;
  }, [canonicalDocument, elementId]);
  const storeElements = useStore((state) => {
    if (canonicalChildren) return EMPTY_CHILDREN;
    const { elements: legacyElements } = state;
    return legacyElements ?? EMPTY_CHILDREN;
  });

  return useMemo(() => {
    const sourceElements = canonicalChildren ?? storeElements;
    if (sourceElements.length === 0) return EMPTY_CHILDREN;
    return sourceElements.filter(
      (element) => !element.deleted && element.parent_id === elementId,
    );
  }, [canonicalChildren, elementId, storeElements]);
}

export interface UseCollectionItemManagerOptions {
  /** 부모 Collection 요소 ID (ListBox, GridList, Select, ComboBox 등) */
  elementId: string;
  /** 자식 Item 태그 이름 (ListBoxItem, GridListItem, SelectItem, ComboBoxItem) */
  childTag: string;
  /** 새 Item 생성 시 기본 props 생성 함수 (index: 현재 Item 개수) */
  defaultItemProps?: (index: number) => Record<string, unknown>;
}

export interface UseCollectionItemManagerResult {
  /** 필터링 및 정렬된 자식 Item 목록 */
  children: CollectionItemNode[];
  /** 현재 선택된 Item의 인덱스 (null: 선택 없음) */
  selectedItemIndex: number | null;
  /** 선택된 Item 인덱스 설정 */
  setSelectedItemIndex: (index: number | null) => void;
  /** 특정 인덱스의 Item 선택 */
  selectItem: (index: number) => void;
  /** Item 선택 해제 */
  deselectItem: () => void;
  /** 새 Item 추가 */
  addItem: () => Promise<void>;
  /** 특정 Item 삭제 */
  deleteItem: (itemId: string) => Promise<void>;
  /** 특정 Item의 props 업데이트 */
  updateItem: (itemId: string, props: Record<string, unknown>) => void;
}

/**
 * Collection Item 관리 훅
 *
 * Collection 컴포넌트(ListBox, GridList, Select, ComboBox)의 자식 Item 관리를 자동화합니다.
 * - 자식 Item 필터링 및 정렬 (useMemo)
 * - Item 선택 상태 관리
 * - Item CRUD 작업 (추가, 삭제, 업데이트)
 */
export function useCollectionItemManager(
  options: UseCollectionItemManagerOptions,
): UseCollectionItemManagerResult {
  const { elementId, childTag, defaultItemProps } = options;

  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(
    null,
  );

  const currentPageId = useStore((state) => state.currentPageId);
  const rawChildren = useCollectionChildren(elementId);

  /**
   * 자식 Item 필터링 (canonical/store source order 보존)
   */
  const children = useMemo(() => {
    return rawChildren.filter((child) => child.type === childTag);
  }, [rawChildren, childTag]);

  /**
   * 특정 인덱스의 Item 선택
   */
  const selectItem = useCallback((index: number) => {
    setSelectedItemIndex(index);
  }, []);

  /**
   * Item 선택 해제
   */
  const deselectItem = useCallback(() => {
    setSelectedItemIndex(null);
  }, []);

  /**
   * 새 Item 추가
   * - defaultItemProps 함수로 기본 props 생성
   * - ElementUtils로 DB에 저장
   * - Zustand store에 추가
   */
  const addItem = useCallback(async () => {
    try {
      const currentIndex = children.length;
      const defaultProps = defaultItemProps
        ? defaultItemProps(currentIndex)
        : {
            label: `Item ${currentIndex + 1}`,
            value: `item${currentIndex + 1}`,
          };

      const newItem = {
        id: ElementUtils.generateId(),
        page_id: currentPageId || "1",
        type: childTag,
        props: {
          ...defaultProps,
          isDisabled: false,
          style: {},
          className: "",
        },
        parent_id: elementId,
      };

      // IndexedDB persistence via addElement
      useStore.getState().addElement(newItem as CollectionItemNode);
      console.log(`새 ${childTag} 추가됨:`, newItem);
    } catch (error) {
      console.error(`${childTag} 추가 중 오류:`, error);
    }
  }, [children.length, childTag, elementId, currentPageId, defaultItemProps]);

  /**
   * 특정 Item 삭제
   * - Supabase에서 삭제
   * - Zustand store에서 제거
   * - 선택 상태 해제
   */
  const deleteItem = useCallback(
    async (itemId: string) => {
      try {
        // IndexedDB persistence via removeElement
        await useStore.getState().removeElement(itemId);
        setSelectedItemIndex(null);
        console.log(`${childTag} 삭제됨:`, itemId);
      } catch (error) {
        console.error(`${childTag} 삭제 중 오류:`, error);
      }
    },
    [childTag],
  );

  /**
   * 특정 Item의 props 업데이트
   * - Zustand store의 updateElementProps 사용
   */
  const updateItem = useCallback(
    (itemId: string, props: Record<string, unknown>) => {
      useStore.getState().updateElementProps(itemId, props);
    },
    [],
  );

  return {
    children,
    selectedItemIndex,
    setSelectedItemIndex,
    selectItem,
    deselectItem,
    addItem,
    deleteItem,
    updateItem,
  };
}
