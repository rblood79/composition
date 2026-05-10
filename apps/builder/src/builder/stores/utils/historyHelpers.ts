/**
 * History Helper Functions for Multi-Select Operations
 * Phase 7: History Integration
 *
 * Helper functions to track multi-element operations in history
 */

import type {
  Element,
  ComponentElementProps,
} from "../../../types/builder/unified.types";
import type { ComponentIndex } from "./elementIndexer";
import { historyManager } from "../history";
import {
  buildCanonicalGroupEvents,
  buildCanonicalInsertEvents,
  buildCanonicalRemoveEvents,
  buildCanonicalUngroupEvents,
} from "../history/canonicalHistoryEvents";

/**
 * Track batch property update in history
 *
 * @param elementIds - IDs of elements being updated
 * @param updates - Property updates to apply
 * @param elementsMap - Map of all elements
 */
export function trackBatchUpdate<TElement extends Element>(
  elementIds: readonly string[],
  updates: Record<string, unknown>,
  elementsMap: ReadonlyMap<string, TElement>,
): void {
  if (elementIds.length === 0) return;

  // Collect previous props for all elements
  const batchUpdates = elementIds
    .map((id) => {
      const element = elementsMap.get(id);
      if (!element) return null;

      return {
        elementId: id,
        prevProps: element.props as ComponentElementProps,
        newProps: { ...element.props, ...updates } as ComponentElementProps,
      };
    })
    .filter((update): update is NonNullable<typeof update> => update !== null);

  if (batchUpdates.length === 0) return;

  // Add to history
  historyManager.addEntry({
    type: "batch",
    elementId: elementIds[0], // Primary element for reference
    elementIds: elementIds,
    data: {
      batchUpdates,
    },
  });

  console.log(
    `✅ [History] Tracked batch update for ${batchUpdates.length} elements`,
  );
}

/**
 * Track group creation in history
 *
 * @param groupElement - The created group element
 * @param childElements - Elements moved into the group
 */
export function trackGroupCreation(
  groupElement: Element,
  childElements: Element[],
  nextChildElements: Element[] = childElements,
): void {
  if (childElements.length === 0) return;

  historyManager.addEntry({
    type: "group",
    elementId: groupElement.id,
    elementIds: childElements.map((el) => el.id),
    data: {
      canonicalEvents: buildCanonicalGroupEvents(
        groupElement,
        childElements,
        nextChildElements,
      ),
      groupData: {
        groupId: groupElement.id,
        childIds: childElements.map((el) => el.id),
      },
    },
  });

  console.log(
    `✅ [History] Tracked group creation: ${groupElement.id} with ${childElements.length} children`,
  );
}

/**
 * Track ungroup operation in history
 *
 * @param groupId - ID of the group being ungrouped
 * @param childElements - Elements being moved out of the group
 * @param groupElement - The group element (for restoration)
 */
export function trackUngroup(
  groupId: string,
  childElements: Element[],
  groupElement: Element,
  nextChildElements: Element[] = childElements,
): void {
  if (childElements.length === 0) return;

  historyManager.addEntry({
    type: "ungroup",
    elementId: groupId,
    elementIds: childElements.map((el) => el.id),
    data: {
      canonicalEvents: buildCanonicalUngroupEvents(
        groupElement,
        childElements,
        nextChildElements,
      ),
      groupData: {
        groupId: groupId,
        childIds: childElements.map((el) => el.id),
      },
    },
  });

  console.log(
    `✅ [History] Tracked ungroup: ${groupId} with ${childElements.length} children`,
  );
}

/**
 * Track multi-element delete in history
 *
 * @param elements - Elements being deleted
 */
export function trackMultiDelete(elements: Element[]): void {
  if (elements.length === 0) return;

  // For multi-delete, we track each element separately
  // This allows proper undo/redo with parent-child relationships
  elements.forEach((element) => {
    historyManager.addEntry({
      type: "remove",
      elementId: element.id,
      data: {
        canonicalEvents: buildCanonicalRemoveEvents([element]),
      },
    });
  });

  console.log(
    `✅ [History] Tracked multi-delete for ${elements.length} elements`,
  );
}

/**
 * Track multi-element copy/paste in history
 *
 * ✅ 개선: 단일 batch entry로 추적 (여러 개별 entry 대신)
 * - Undo 시 한 번에 모든 요소 삭제
 * - Redo 시 한 번에 모든 요소 복원
 * - 히스토리 메모리 사용량 감소
 *
 * @param newElements - Newly pasted elements
 */
export function trackMultiPaste(newElements: Element[]): void {
  if (newElements.length === 0) return;

  // 단일 히스토리 entry로 모든 요소 추적
  // parent 요소와 나머지 요소들을 분리
  const [firstElement, ...restElements] = newElements;

  historyManager.addEntry({
    type: "add",
    elementId: firstElement.id, // Primary element for reference
    elementIds: newElements.map((el) => el.id), // All pasted element IDs
    data: {
      canonicalEvents: buildCanonicalInsertEvents([
        firstElement,
        ...restElements,
      ]),
    },
  });

  console.log(
    `✅ [History] Tracked multi-paste: single batch entry for ${newElements.length} elements`,
  );
}

// ============================================
// G.5: AI Batch Transaction + Instance Propagation
// ============================================

/**
 * Track AI batch-design operation as a single atomic history entry.
 *
 * AI가 batch_design 도구로 여러 요소를 한 번에 생성/수정/삭제할 때,
 * 모든 변경사항을 단일 히스토리 엔트리로 묶어 원자적 Undo/Redo를 보장한다.
 *
 * @param prevElements - AI 작업 전 상태
 * @param nextElements - AI 작업 후 상태
 */
export function trackAIBatchOperation(
  prevElements: Element[],
  nextElements: Element[],
): void {
  if (prevElements.length === 0 && nextElements.length === 0) return;
  historyManager.addBatchDiffEntry(prevElements, nextElements);
  console.log(
    `✅ [History] Tracked AI batch operation: ${prevElements.length} → ${nextElements.length} elements`,
  );
}

/**
 * Track master → instance propagation as a single batch history entry.
 *
 * G.1 컴포넌트-인스턴스 시스템에서 Master 속성 변경 시,
 * 모든 인스턴스에 전파된 변경사항을 trackBatchUpdate()로 묶어
 * Undo 시 Master + 인스턴스 모두 원래 상태로 복원한다.
 *
 * @param masterRefId - Master 컴포넌트 ID
 * @param updates - 전파할 속성 업데이트
 * @param componentIndex - 현재 ComponentIndex (masterToInstances 조회용)
 * @param elementsMap - 전체 요소 Map
 */
export function trackInstancePropagation<TElement extends Element>(
  masterRefId: string,
  updates: Record<string, unknown>,
  componentIndex: ComponentIndex<TElement>,
  elementsMap: ReadonlyMap<string, TElement>,
): void {
  const instanceIds = componentIndex.masterToInstances.get(masterRefId);
  if (!instanceIds || instanceIds.size === 0) return;

  // Master + 모든 Instance를 하나의 batch로 추적
  const allIds = [masterRefId, ...instanceIds];
  trackBatchUpdate(allIds, updates, elementsMap);
  console.log(
    `✅ [History] Tracked instance propagation: master ${masterRefId} → ${instanceIds.size} instances`,
  );
}

/**
 * Undo batch property update
 *
 * @param batchUpdates - Batch update data from history
 * @param updateElementProps - Function to update element props
 */
export async function undoBatchUpdate(
  batchUpdates: Array<{
    elementId: string;
    prevProps: ComponentElementProps;
    newProps: ComponentElementProps;
  }>,
  updateElementProps: (
    id: string,
    props: Record<string, unknown>,
  ) => Promise<void>,
): Promise<void> {
  await Promise.all(
    batchUpdates.map((update) =>
      updateElementProps(
        update.elementId,
        update.prevProps as Record<string, unknown>,
      ),
    ),
  );

  console.log(
    `✅ [History] Undid batch update for ${batchUpdates.length} elements`,
  );
}

/**
 * Redo batch property update
 *
 * @param batchUpdates - Batch update data from history
 * @param updateElementProps - Function to update element props
 */
export async function redoBatchUpdate(
  batchUpdates: Array<{
    elementId: string;
    prevProps: ComponentElementProps;
    newProps: ComponentElementProps;
  }>,
  updateElementProps: (
    id: string,
    props: Record<string, unknown>,
  ) => Promise<void>,
): Promise<void> {
  await Promise.all(
    batchUpdates.map((update) =>
      updateElementProps(
        update.elementId,
        update.newProps as Record<string, unknown>,
      ),
    ),
  );

  console.log(
    `✅ [History] Redid batch update for ${batchUpdates.length} elements`,
  );
}

/**
 * Undo group creation
 *
 * @param groupId - ID of the group to remove
 * @param childIds - IDs of children to restore
 * @param removeElement - Function to remove element
 * @param updateElement - Function to update element
 * @param elementsMap - Map of all elements
 */
export async function undoGroupCreation<TElement extends Element>(
  groupId: string,
  childIds: readonly string[],
  removeElement: (id: string) => Promise<void>,
  updateElement: (id: string, updates: Partial<Element>) => Promise<void>,
  elementsMap: ReadonlyMap<string, TElement>,
): Promise<void> {
  // Get group element to restore children's original parent_id
  const groupElement = elementsMap.get(groupId);
  const originalParentId = groupElement?.parent_id || null;

  // Restore children's original parent_id
  await Promise.all(
    childIds.map((childId) =>
      updateElement(childId, { parent_id: originalParentId }),
    ),
  );

  // Remove group
  await removeElement(groupId);

  console.log(`✅ [History] Undid group creation: ${groupId}`);
}

/**
 * Redo group creation
 *
 * @param groupElement - Group element to recreate
 * @param childIds - IDs of children to move into group
 * @param addElement - Function to add element
 * @param updateElement - Function to update element
 */
export async function redoGroupCreation(
  groupElement: Element,
  childIds: string[],
  addElement: (element: Element) => Promise<void>,
  updateElement: (id: string, updates: Partial<Element>) => Promise<void>,
): Promise<void> {
  // Recreate group
  await addElement(groupElement);

  // Move children into group
  await Promise.all(
    childIds.map((childId) =>
      updateElement(childId, { parent_id: groupElement.id }),
    ),
  );

  console.log(`✅ [History] Redid group creation: ${groupElement.id}`);
}
