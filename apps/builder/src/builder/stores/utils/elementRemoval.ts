// 🚀 Phase 1: Immer 제거 - 함수형 업데이트로 전환
// import { produce } from "immer"; // REMOVED
import type { StateCreator } from "zustand";
import { Element } from "../../../types/core/store.types";
import { historyManager } from "../history";
import { getDB } from "../../../lib/db";
import { createCompleteProps, getElementById } from "./elementHelpers";
import { reorderElements } from "./elementReorder";
import type { ElementsState } from "../elements";
import {
  rebuildPageIndex,
  rebuildComponentIndex,
  rebuildVariableUsageIndex,
} from "./elementIndexer";
import { buildDetachSnapshotsForOrigins } from "./instanceActions";
import { sanitizeElement } from "../../../adapters/canonical/legacyElementSanitizer";
// 🚀 Phase 11: Feature Flags for WebGL-only mode
import {
  isWebGLCanvas,
  isCanvasCompareMode,
} from "../../../utils/featureFlags";
// 🚀 Skia 레지스트리 동기화 — React useEffect cleanup 지연 문제 해결
import { unregisterSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import {
  areCanonicalMutationStoreActionsRegistered,
  setElementsCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";

type SetState = Parameters<StateCreator<ElementsState>>[0];
type GetState = Parameters<StateCreator<ElementsState>>[1];
type BuilderDb = Awaited<ReturnType<typeof getDB>>;

// ADR-100 Phase 1 (098-a 슬롯): "SelectItem" = RAC 공식 `ListBoxItem` alias. composition 내부 식별자 유지.
// ADR-101 Phase 1 (098-b 슬롯): "ComboBoxItem" = RAC alias 이름 동일. ADR-073 items SSOT 이관 완료.
//   (양쪽 모두 기존 프로젝트 migration 경로에 존재 — 삭제 연쇄 대상 포함 필수)
const COLLECTION_ITEM_TAGS = new Set([
  "Tab",
  "Panel",
  "ListBoxItem",
  "GridListItem",
  "MenuItem",
  "ComboBoxItem",
  "SelectItem",
  "TreeItem",
  "ToggleButton",
]);

function syncRemovedElementsToCanonical(elements: Element[]): void {
  if (!areCanonicalMutationStoreActionsRegistered()) return;
  setElementsCanonicalPrimary(elements);
}

async function persistActiveCanonicalDocument(db: BuilderDb): Promise<void> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return;
  const doc = canonical.documents.get(projectId);
  if (!doc) return;
  await db.documents.put(projectId, doc);
}

/**
 * 단일 요소에 대해 삭제해야 할 모든 연관 요소를 수집하는 헬퍼
 * (자식, Table Column/Cell, Tab/Panel 연결 등)
 *
 * @returns 중복 제거된 삭제 대상 요소 배열 (루트 요소 포함)
 *          또는 삭제 불가(Body, 미존재)인 경우 null
 */
function collectElementsToRemove(
  elementId: string,
  elements: Element[],
  elementsMap: Map<string, Element>,
  childrenMap: Map<string, Element[]>,
): { rootElement: Element; allElements: Element[] } | null {
  const element = getElementById(elementsMap, elementId);
  if (!element) return null;
  if (element.type.toLowerCase() === "body") return null;

  // 자식 요소들 찾기 (재귀적으로) — O(1) childrenMap 사용
  const findChildren = (parentId: string): Element[] => {
    const directChildren = childrenMap.get(parentId) ?? [];
    const allChildren: Element[] = [];
    for (const child of directChildren) {
      allChildren.push(child);
      allChildren.push(...findChildren(child.id));
    }
    return allChildren;
  };

  let childElements = findChildren(elementId);

  // Table Column 삭제 시 특별 처리: 연관된 Cell들도 함께 삭제
  if (element.type === "Column") {
    const tableElement = elements.find((el) => {
      const tableHeader = elements.find(
        (header) => header.id === element.parent_id,
      );
      return (
        tableHeader && el.id === tableHeader.parent_id && el.type === "Table"
      );
    });

    if (tableElement) {
      const tableBody = elements.find(
        (el) => el.parent_id === tableElement.id && el.type === "TableBody",
      );
      if (tableBody) {
        const rows = elements.filter(
          (el) => el.parent_id === tableBody.id && el.type === "Row",
        );
        const cellsToRemove = rows.flatMap((row) =>
          elements.filter(
            (cell) =>
              cell.parent_id === row.id &&
              cell.type === "Cell" &&
              cell.order_num === element.order_num,
          ),
        );
        childElements = [...childElements, ...cellsToRemove];
      }
    }
  }

  // Table Cell 삭제 시 특별 처리: 대응하는 Column도 함께 삭제
  if (element.type === "Cell") {
    const row = elements.find((el) => el.id === element.parent_id);
    if (row && row.type === "Row") {
      const tableBody = elements.find((el) => el.id === row.parent_id);
      if (tableBody && tableBody.type === "TableBody") {
        const tableElement = elements.find(
          (el) => el.id === tableBody.parent_id && el.type === "Table",
        );
        if (tableElement) {
          const tableHeader = elements.find(
            (el) =>
              el.parent_id === tableElement.id && el.type === "TableHeader",
          );
          if (tableHeader) {
            const columnToRemove = elements.find(
              (col) =>
                col.parent_id === tableHeader.id &&
                col.type === "Column" &&
                col.order_num === element.order_num,
            );
            if (columnToRemove) {
              const allRows = elements.filter(
                (el) => el.parent_id === tableBody.id && el.type === "Row",
              );
              const otherCellsToRemove = allRows.flatMap((r) =>
                elements.filter(
                  (cell) =>
                    cell.parent_id === r.id &&
                    cell.type === "Cell" &&
                    cell.order_num === element.order_num &&
                    cell.id !== element.id,
                ),
              );
              childElements = [
                ...childElements,
                columnToRemove,
                ...otherCellsToRemove,
              ];
            }
          }
        }
      }
    }
  }

  // ADR-066: Tab element 소멸. TabPanel 개별 삭제는 cascade 자식만 처리
  // (items 동기화는 TabsEditor.removeTabItem 경로에서만 보장).

  const allElementsToRemove = [element, ...childElements];

  // 중복 제거
  const seen = new Set<string>();
  const uniqueElements = allElementsToRemove.filter((el) => {
    if (seen.has(el.id)) return false;
    seen.add(el.id);
    return true;
  });

  return { rootElement: element, allElements: uniqueElements };
}

/**
 * 공통 삭제 실행 로직: DB 삭제 + 히스토리 기록 + Skia 정리 + 원자적 set() + postMessage + 재정렬
 */
async function executeRemoval(
  set: SetState,
  get: GetState,
  rootElements: Element[],
  allUniqueElements: Element[],
  options: { skipHistory?: boolean } = {},
) {
  const elementIdsToRemove = allUniqueElements.map((el) => el.id);
  const removeSet = new Set(elementIdsToRemove);
  const currentState = get();
  const autoDetach = buildDetachSnapshotsForOrigins(
    currentState,
    allUniqueElements,
    removeSet,
  );

  let db: BuilderDb | null = null;

  // IndexedDB 삭제
  if (typeof indexedDB !== "undefined") {
    try {
      db = await getDB();
      await db.elements.deleteMany(elementIdsToRemove);
      if (autoDetach.elements.length > 0) {
        await db.elements.insertMany(
          autoDetach.elements.map((element) => sanitizeElement(element)),
        );
      }
    } catch (error) {
      console.error("❌ [IndexedDB] 요소 삭제 중 오류:", error);
    }
  }

  // 히스토리: 첫 번째 루트를 대표 elementId로, 나머지 모두를 childElements로 기록
  // ADR-073 P5: skipHistory=true 시 히스토리 기록 생략 (migration 경로에서 undo 스택 오염 방지)
  if (currentState.currentPageId && !options.skipHistory) {
    if (autoDetach.elements.length > 0) {
      historyManager.addEntry({
        type: "batch",
        elementId: rootElements[0].id,
        elementIds: [
          ...elementIdsToRemove,
          ...autoDetach.elements.map((element) => element.id),
        ],
        data: {
          prevElements: [
            ...allUniqueElements.map((element) => ({ ...element })),
            ...autoDetach.previousElements.map((element) => ({ ...element })),
          ],
          elements: autoDetach.elements.map((element) => ({ ...element })),
        },
      });
    } else {
      historyManager.addEntry({
        type: "remove",
        elementId: rootElements[0].id,
        data: {
          element: { ...rootElements[0] },
          childElements: allUniqueElements
            .filter((el) => el.id !== rootElements[0].id)
            .map((child) => ({ ...child })),
        },
      });
    }
  }

  // 요소 필터링
  const detachPreviousIds = new Set(
    autoDetach.previousElements.map((element) => element.id),
  );
  const filteredElements = currentState.elements.filter(
    (el) => !removeSet.has(el.id) && !detachPreviousIds.has(el.id),
  );
  const updatedElements =
    autoDetach.elements.length > 0
      ? [...filteredElements, ...autoDetach.elements]
      : filteredElements;

  // 선택 상태 정리
  const isSelectedRemoved = removeSet.has(currentState.selectedElementId || "");
  const detachedSelectedElement = autoDetach.elements.find(
    (element) => element.id === currentState.selectedElementId,
  );
  const filteredSelectedIds = currentState.selectedElementIds.filter(
    (id: string) => !removeSet.has(id),
  );
  const hasSelectedIdsChanged =
    filteredSelectedIds.length !== currentState.selectedElementIds.length;
  const isEditingContextRemoved =
    currentState.editingContextId != null &&
    removeSet.has(currentState.editingContextId);

  // Skia 레지스트리 즉시 정리
  for (const id of elementIdsToRemove) {
    unregisterSkiaNode(id);
  }

  // 원자적 상태 업데이트: elements + 모든 인덱스를 단일 set()으로
  const newElementsMap = new Map<string, Element>();
  const newChildrenMap = new Map<string, Element[]>();
  updatedElements.forEach((el) => {
    newElementsMap.set(el.id, el);
    const parentId = el.parent_id || "root";
    if (!newChildrenMap.has(parentId)) {
      newChildrenMap.set(parentId, []);
    }
    newChildrenMap.get(parentId)!.push(el);
  });

  const newPageIndex = rebuildPageIndex(updatedElements, newElementsMap);

  // pageElementsSnapshot 재구축 — 레이어 트리가 이 스냅샷에 의존
  const newPageElementsSnapshot: Record<string, Element[]> = {};
  for (const [pageId, elementIds] of newPageIndex.elementsByPage.entries()) {
    const pageElements = updatedElements.filter((element) =>
      elementIds.has(element.id),
    );
    newPageElementsSnapshot[pageId] = pageElements;
  }

  set((state) => ({
    elements: updatedElements,
    elementsMap: newElementsMap,
    childrenMap: newChildrenMap,
    pageIndex: newPageIndex,
    pageElementsSnapshot: newPageElementsSnapshot,
    componentIndex: rebuildComponentIndex(filteredElements),
    variableUsageIndex: rebuildVariableUsageIndex(filteredElements),
    // ADR-006 P3-1: 구조 변경 → layoutVersion 무조건 증가
    layoutVersion: state.layoutVersion + 1,
    ...(isSelectedRemoved && {
      selectedElementId: null,
      selectedElementProps: {},
    }),
    ...(!isSelectedRemoved &&
      detachedSelectedElement && {
        selectedElementProps: createCompleteProps(detachedSelectedElement),
      }),
    ...(hasSelectedIdsChanged && {
      selectedElementIds: filteredSelectedIds,
      selectedElementIdsSet: new Set(filteredSelectedIds),
    }),
    ...(isEditingContextRemoved && {
      editingContextId: null,
    }),
  }));

  syncRemovedElementsToCanonical(updatedElements);

  if (db) {
    try {
      await persistActiveCanonicalDocument(db);
    } catch (error) {
      console.warn(
        "⚠️ [IndexedDB] canonical document 삭제 반영 중 오류 (메모리는 정상):",
        error,
      );
    }
  }

  // postMessage
  const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();
  if (!isWebGLOnly && typeof window !== "undefined" && window.parent) {
    window.parent.postMessage(
      { type: "ELEMENT_REMOVED", payload: { elementId: elementIdsToRemove } },
      "*",
    );
  }

  // order_num 재정렬
  const currentPageId = get().currentPageId;
  if (currentPageId) {
    const hasCollectionItem = rootElements.some((el) =>
      COLLECTION_ITEM_TAGS.has(el.type),
    );
    if (!hasCollectionItem) {
      setTimeout(() => {
        const { elements, batchUpdateElementOrders } = get();
        reorderElements(elements, currentPageId, batchUpdateElementOrders);
      }, 100);
    }
  }
}

/**
 * RemoveElement 액션 생성 팩토리 (단일 요소 삭제)
 */
export const createRemoveElementAction =
  (set: SetState, get: GetState) =>
  async (elementId: string, options?: { skipHistory?: boolean }) => {
    const state = get();
    const result = collectElementsToRemove(
      elementId,
      state.elements,
      state.elementsMap,
      state.childrenMap,
    );
    if (!result) {
      if (import.meta.env.DEV) {
        console.debug("⚠️ removeElement: 삭제 불가 (미존재 또는 Body)", {
          elementId,
        });
      }
      return;
    }
    await executeRemoval(
      set,
      get,
      [result.rootElement],
      result.allElements,
      options,
    );
  };

/**
 * RemoveElements 배치 삭제 액션 생성 팩토리 (다중 요소 동시 삭제)
 * 모든 요소를 단일 set()으로 제거하여 화면에서 동시에 사라짐
 */
export const createRemoveElementsAction =
  (set: SetState, get: GetState) =>
  async (elementIds: string[], options?: { skipHistory?: boolean }) => {
    if (elementIds.length === 0) return;

    // 단일 요소면 기존 경로 사용
    if (elementIds.length === 1) {
      const removeElement = createRemoveElementAction(set, get);
      return removeElement(elementIds[0], options);
    }

    const state = get();
    const rootElements: Element[] = [];
    const allElementsMap = new Map<string, Element>();

    // 각 요소에 대해 삭제 대상 수집
    for (const id of elementIds) {
      const result = collectElementsToRemove(
        id,
        state.elements,
        state.elementsMap,
        state.childrenMap,
      );
      if (!result) continue;

      rootElements.push(result.rootElement);
      for (const el of result.allElements) {
        allElementsMap.set(el.id, el);
      }
    }

    if (rootElements.length === 0) return;

    const allUniqueElements = Array.from(allElementsMap.values());
    await executeRemoval(set, get, rootElements, allUniqueElements, options);
  };
