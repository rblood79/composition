// 🚀 Phase 1: Immer 제거 - 함수형 업데이트로 전환
// import { produce } from "immer"; // REMOVED
import { persistActiveCanonicalDocument as persistCanonicalDocument } from "../canonical/persistActiveCanonicalDocument";
import type { StateCreator } from "zustand";
import { Element } from "../../../types/core/store.types";
import { historyManager } from "../history";
import { getDB } from "../../../lib/db";
import { createCompleteProps } from "./elementHelpers";
import type { ElementsState } from "../elements";
import {
  rebuildPageIndex,
  rebuildComponentIndex,
  rebuildVariableUsageIndex,
} from "./elementIndexer";
import { buildDetachSnapshotsForOrigins } from "./instanceActions";
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
import { getActiveCanonicalDocumentElementProjection } from "../canonical/canonicalElementsView";
import {
  buildCanonicalRemoveEvents,
  buildCanonicalReplaceEvents,
  captureCanonicalReplaceSources,
  type CanonicalHistoryNodeEvent,
  type CanonicalReplaceCapture,
} from "../history/canonicalHistoryEvents";
import { isListBoxTemplateAnchor } from "../../components/listbox/listBoxTemplateOrigins";
import { emitStoreStructureCommitDescriptors } from "../../presentation/storeCommitEmitter";
import { isRenderProjectionId } from "../../projection/renderProjectionIds";
import { isSystemOwnedOrigin } from "../../../adapters/canonical/editingSemantics";

type SetState = Parameters<StateCreator<ElementsState>>[0];
type GetState = Parameters<StateCreator<ElementsState>>[1];
type BuilderDb = Awaited<ReturnType<typeof getDB>>;
type ElementRemovalLookup<TElement extends Element = Element> = Map<
  string,
  TElement
>;
type ElementRemovalChildrenByParent<TElement extends Element = Element> = Map<
  string,
  TElement[]
>;

const EMPTY_ELEMENTS: Element[] = [];

function syncRemovedElementsToCanonical(elements: Element[]): void {
  if (!areCanonicalMutationStoreActionsRegistered()) return;
  setElementsCanonicalPrimary(elements);
}

function getElementRemovalSourceElements(): readonly Element[] {
  return getActiveCanonicalDocumentElementProjection() ?? EMPTY_ELEMENTS;
}

async function persistActiveCanonicalDocument(db: BuilderDb): Promise<void> {
  // 삭제 명령의 기존 급감 가드 옵션을 유지한다.
  await persistCanonicalDocument(db, {
    allowShrink: true,
    reason: "element-removal",
  });
}

/** ADR-241 Phase 3 — 열 · 셀 삭제가 같이 지울 셀 · 열 (위 호출부 주석). */
function collectTableStructureRemovals<TElement extends Element>(
  element: TElement,
  elementsById: ElementRemovalLookup<TElement>,
  childrenByParent: ElementRemovalChildrenByParent<TElement>,
): TElement[] {
  const childrenOf = (id: string | undefined): TElement[] =>
    (id ? childrenByParent.get(id) : undefined) ?? [];
  const isTableOwner = (candidate: TElement | undefined): boolean =>
    candidate?.type === "Table" || candidate?.type === "TableView";
  const parent = element.parent_id
    ? elementsById.get(element.parent_id)
    : undefined;
  if (!parent?.parent_id) return [];
  const aligned = (rows: readonly TElement[], columnCount: number) =>
    rows.every((row) => childrenOf(row.id).length === columnCount);

  // 열 삭제
  if (parent.type === "TableHeader") {
    const owner = elementsById.get(parent.parent_id);
    if (!isTableOwner(owner)) return [];
    const columns = childrenOf(parent.id);
    const index = columns.findIndex((column) => column.id === element.id);
    const body = childrenOf(owner!.id).find((c) => c.type === "TableBody");
    const rows = childrenOf(body?.id);
    if (index < 0 || !aligned(rows, columns.length)) return [];
    return rows
      .map((row) => childrenOf(row.id)[index])
      .filter((cell): cell is TElement => Boolean(cell));
  }

  // 셀 삭제 (행 = TableBody 자식)
  const body = elementsById.get(parent.parent_id);
  if (body?.type !== "TableBody" || !body.parent_id) return [];
  const owner = elementsById.get(body.parent_id);
  if (!isTableOwner(owner)) return [];
  const header = childrenOf(owner!.id).find((c) => c.type === "TableHeader");
  const columns = childrenOf(header?.id);
  const rows = childrenOf(body.id);
  const index = childrenOf(parent.id).findIndex((c) => c.id === element.id);
  const column = columns[index];
  if (index < 0 || !column || !aligned(rows, columns.length)) return [];
  return [
    column,
    ...rows
      .filter((row) => row.id !== parent.id)
      .map((row) => childrenOf(row.id)[index])
      .filter((cell): cell is TElement => Boolean(cell)),
  ];
}

/**
 * 단일 요소에 대해 삭제해야 할 모든 연관 요소를 수집하는 헬퍼
 * (자식, Table Column/Cell, Tab/Panel 연결 등)
 *
 * @returns 중복 제거된 삭제 대상 요소 배열 (루트 요소 포함)
 *          또는 삭제 불가(Body, 미존재)인 경우 null
 */
function collectElementsToRemove<TElement extends Element>(
  elementId: string,
  elements: readonly TElement[],
): { rootElement: TElement; allElements: TElement[] } | null {
  const elementsById: ElementRemovalLookup<TElement> = new Map(
    elements.map((element) => [element.id, element]),
  );
  const childrenByParent: ElementRemovalChildrenByParent<TElement> = new Map();
  for (const element of elements) {
    const parentId = element.parent_id;
    if (!parentId) continue;
    childrenByParent.set(parentId, [
      ...(childrenByParent.get(parentId) ?? []),
      element,
    ]);
  }

  const element = elementsById.get(elementId);
  if (!element) return null;
  if (element.type.toLowerCase() === "body") return null;
  if (isListBoxTemplateAnchor(element)) return null;
  // ADR-228 Decision 4: systemOwned reusable origin root (Components 페이지의 catalog·손 seed
  //   origin) 는 삭제 불가 — 지우면 그 ref instance 전부가 세션 안에서 빈 노드가 되고 재로드
  //   때 재시드로만 돌아온다. 이동·편집은 허용 (여기서는 삭제만 막는다).
  if (isSystemOwnedOrigin(element)) return null;

  // 자식 요소들 찾기 (재귀적으로)
  const findChildren = (parentId: string): TElement[] => {
    const directChildren = childrenByParent.get(parentId) ?? [];
    const allChildren: TElement[] = [];
    for (const child of directChildren) {
      allChildren.push(child);
      allChildren.push(...findChildren(child.id));
    }
    return allChildren;
  };

  let childElements = findChildren(elementId);
  // ADR-241 Phase 3 — Table · TableView 열 ↔ 정적 행 셀 동기화 (종전 Table 전용 분기를 구조 기준으로 넓힘): 열 = TableHeader 자식
  //   (plain Column · Column origin ref), 행 = TableBody 자식 (plain Row · Row origin ref), 셀 = 행 자식 (ref 의 자기 자식 포함). 열
  //   삭제 → 모든 행의 같은 index 셀 · 셀 삭제 → 같은 index 열 + 다른 행의 셀 (셀 수 = 열 수 계약). 셀 수가 어긋난 표는 동기화 밖.
  childElements = [
    ...childElements,
    ...collectTableStructureRemovals(element, elementsById, childrenByParent),
  ];

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
  sourceElements: readonly Element[],
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

  // DB 연결은 실제로 쓰는 지점(맨 아래 영속화)에서 얻는다. 여기서 미리 await 하면
  // history 기록과 메모리 반영이 IndexedDB open 이 끝날 때까지 밀리고, 그 사이 다른
  // mutation 이 끼어들 수 있다. 특히 history 트랜잭션 창 안에서 호출될 때 (프리셋
  // 적용 — usePresetApply) 창이 그만큼 넓어져 무관한 변경이 같은 되돌리기 엔트리로
  // 병합된다. 이 함수는 `set()` 까지 **동기 도달**해야 한다.

  // 요소 필터링
  const detachPreviousIds = new Set(
    autoDetach.previousElements.map((element) => element.id),
  );
  const filteredElements = sourceElements.filter(
    (el) => !removeSet.has(el.id) && !detachPreviousIds.has(el.id),
  );
  const updatedElements =
    autoDetach.elements.length > 0
      ? [...filteredElements, ...autoDetach.elements]
      : filteredElements;

  // 히스토리 소스는 canonical mutation 전에 캡처해 삭제 전 node/위치를 보존한다.
  // - remove events: 삭제 대상 (pre-mutation doc 조회)
  // - autoDetach: 영향 instance 의 prev 캡처 → replace event 는 mutation 후 빌드
  // ADR-073 P5: skipHistory=true 시 히스토리 기록 생략 (migration 경로에서 undo 스택 오염 방지)
  const shouldRecordHistory = Boolean(
    currentState.currentPageId && !options.skipHistory,
  );
  let removeEvents: CanonicalHistoryNodeEvent[] = [];
  let detachPrevCaptures: Map<string, CanonicalReplaceCapture> | null = null;
  if (shouldRecordHistory) {
    // ADR-241 Phase 3 — root 만이 아니라 삭제 집합의 모든 subtree 최상단 (Table 열 삭제가 같이 지우는 다른 행의 셀 — root 의
    //   자손이 아니다) 을 싣는다. root 만 실으면 undo 가 열만 되살리고 셀은 잃는다 (종전 Table 분기도 같은 공백).
    removeEvents = buildCanonicalRemoveEvents(
      allUniqueElements,
      allUniqueElements,
    );
    if (autoDetach.elements.length > 0) {
      detachPrevCaptures = captureCanonicalReplaceSources(
        autoDetach.previousElements.map((element) => element.id),
      );
    }
  }

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
  const newElementsMap: ElementRemovalLookup = new Map();
  const newChildrenMap: ElementRemovalChildrenByParent = new Map();
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

  syncRemovedElementsToCanonical(updatedElements);
  if (shouldRecordHistory) {
    // detach replace event 는 post-mutation doc 에서 next node (확장 subtree
    // children 포함) 를 조회해 빌드
    const detachEvents = detachPrevCaptures
      ? buildCanonicalReplaceEvents(
          autoDetach.previousElements,
          autoDetach.elements,
          detachPrevCaptures,
        )
      : [];
    const canonicalEvents = [...removeEvents, ...detachEvents];
    if (canonicalEvents.length > 0) {
      historyManager.addEntry(
        autoDetach.elements.length > 0
          ? {
              type: "batch",
              elementId: rootElements[0].id,
              elementIds: [
                ...elementIdsToRemove,
                ...autoDetach.elements.map((element) => element.id),
              ],
              data: { canonicalEvents },
            }
          : {
              type: "remove",
              elementId: rootElements[0].id,
              data: { canonicalEvents },
            },
      );
    }
  }

  // ADR-190 Phase 2: canonical 갱신 뒤 · set() 앞. 삭제된 노드는 post-commit
  // 트리에 없으므로 부모 참조가 유일한 dirty root 단서이며, 그 부모는 mutation
  // 전 스냅샷(`rootElements`)에서만 읽을 수 있다.
  //
  // 삭제 대상의 **자손**은 따로 싣지 않는다 — 부모 subtree 를 다시 기록하면
  // 사라진 자손도 함께 사라진다. root 의 부모만 dirty 로 잡으면 충분하다.
  //
  // autoDetach 는 삭제와 별개로 다른 요소의 props 를 바꾸므로, 그 요소들이
  // 있으면 structure descriptor 만으로 화면을 맞출 수 없다 → 전체를 포기하고
  // full rebuild 로 보낸다.
  if (autoDetach.elements.length === 0) {
    emitStoreStructureCommitDescriptors(
      rootElements.map((element) => ({
        elementId: element.id,
        parentId: element.parent_id,
      })),
      "remove",
    );
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

  // Canonical document 영속화 (연결 획득 포함) — 위 `set()` 이후이므로 이 지점부터
  // 비동기다. 연결 실패와 저장 실패는 진단이 다르므로 로그를 나눠 유지한다.
  if (typeof indexedDB !== "undefined") {
    let db: BuilderDb | null = null;
    try {
      db = await getDB();
    } catch (error) {
      console.error("❌ [IndexedDB] 연결 중 오류:", error);
    }
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
  }

  // postMessage
  const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();
  if (!isWebGLOnly && typeof window !== "undefined" && window.parent) {
    window.parent.postMessage(
      { type: "ELEMENT_REMOVED", payload: { elementId: elementIdsToRemove } },
      "*",
    );
  }
}

/**
 * RemoveElement 액션 생성 팩토리 (단일 요소 삭제)
 */
export const createRemoveElementAction =
  (set: SetState, get: GetState) =>
  async (elementId: string, options?: { skipHistory?: boolean }) => {
    if (isRenderProjectionId(elementId)) return;
    const sourceElements = getElementRemovalSourceElements();
    const result = collectElementsToRemove(elementId, sourceElements);
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
      sourceElements,
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
    const canonicalElementIds = elementIds.filter(
      (elementId) => !isRenderProjectionId(elementId),
    );
    if (canonicalElementIds.length === 0) return;

    // 단일 요소면 기존 경로 사용
    if (canonicalElementIds.length === 1) {
      const removeElement = createRemoveElementAction(set, get);
      return removeElement(canonicalElementIds[0], options);
    }

    const sourceElements = getElementRemovalSourceElements();
    const rootElements: Element[] = [];
    const allElementsMap: ElementRemovalLookup = new Map();

    // 각 요소에 대해 삭제 대상 수집
    for (const id of canonicalElementIds) {
      const result = collectElementsToRemove(id, sourceElements);
      if (!result) continue;

      rootElements.push(result.rootElement);
      for (const el of result.allElements) {
        allElementsMap.set(el.id, el);
      }
    }

    if (rootElements.length === 0) return;

    const allUniqueElements = Array.from(allElementsMap.values());
    await executeRemoval(
      set,
      get,
      sourceElements,
      rootElements,
      allUniqueElements,
      options,
    );
  };
