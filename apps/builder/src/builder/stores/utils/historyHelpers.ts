/**
 * History Helper Functions for Multi-Select Operations
 * Phase 7: History Integration
 *
 * Helper functions to track multi-element operations in history
 */

import type { Element } from "../../../types/builder/unified.types";
import type { ComponentIndex } from "./elementIndexer";
import { historyManager } from "../history";
import {
  buildCanonicalGroupEvents,
  buildCanonicalInsertEvents,
  buildCanonicalMoveEvents,
  buildCanonicalUngroupEvents,
  buildCanonicalUpdateEvent,
  type CanonicalNodeLocation,
} from "../history/canonicalHistoryEvents";

/**
 * Track batch property update in history.
 *
 * **호출 규약 (2026-07-26)**: 이 헬퍼는 스스로 history 를 기록하지 않는 mutation 경로
 * 에서만 쓴다. `batchUpdateElementProps` / `updateElementProps` 는 자신의 canonical
 * update event 를 이미 기록하므로, 그와 나란히 부르면 같은 변경이 두 엔트리가 되어
 * 죽은 undo 단계가 생긴다 (align/distribute/batch 편집 5 곳에서 그 상태였고 호출을
 * 제거했다). 현재 유일한 정당한 사용처는 `trackInstancePropagation` 이다.
 *
 * `updates` 는 **모든 대상 요소에 공통 적용할 props 패치**다. `{elementId: patch}`
 * 형태의 맵을 넘기면 요소 id 가 prop 이름으로 기록된다 (제거된 5 곳의 실제 오용).
 *
 * @param elementIds - IDs of elements being updated
 * @param updates - 모든 요소에 공통 적용할 props 패치
 * @param elementsMap - Map of all elements
 */
export function trackBatchUpdate<TElement extends Element>(
  elementIds: readonly string[],
  updates: Record<string, unknown>,
  elementsMap: ReadonlyMap<string, TElement>,
): void {
  if (elementIds.length === 0) return;

  // canonical update event — full merged props 계약 (prev/next 모두 전체 props)
  const canonicalEvents = elementIds
    .map((id) => {
      const element = elementsMap.get(id);
      if (!element) return null;

      return buildCanonicalUpdateEvent(
        id,
        structuredClone(element.props) as Record<string, unknown>,
        structuredClone({ ...element.props, ...updates }) as Record<
          string,
          unknown
        >,
      );
    })
    .filter((event): event is NonNullable<typeof event> => event !== null);

  if (canonicalEvents.length === 0) return;

  // Add to history
  historyManager.addEntry({
    type: "batch",
    elementId: elementIds[0], // Primary element for reference
    elementIds: [...elementIds],
    data: {
      canonicalEvents,
    },
  });
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
}

/**
 * Track a canonical container move in history.
 *
 * `from` 은 canonical mutation **이전** 에 캡처한 좌표여야 한다
 * (`captureCanonicalNodeLocations` 를 mutation 앞에서 호출). mutation 후에
 * 캡처하면 이동 후 좌표가 기록되어 undo 가 제자리로 되돌리지 못한다.
 */
export function trackCanonicalMove(
  elementId: string,
  from: CanonicalNodeLocation | undefined,
): void {
  if (!from) return;

  const canonicalEvents = buildCanonicalMoveEvents([
    { nodeId: elementId, from },
  ]);
  if (canonicalEvents.length === 0) return;

  historyManager.addEntry({
    type: "move",
    elementId,
    data: { canonicalEvents },
  });
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
}

// ============================================
// G.5: Instance Propagation
// ============================================

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
}
