// 🚀 Phase 1: Immer 제거 - 함수형 업데이트로 전환
// import { produce } from "immer"; // REMOVED
import type { StateCreator } from "zustand";
import {
  ComponentElementProps,
  Element,
} from "../../../types/core/store.types";
import { sanitizeFillDerivedStylePatch } from "../../panels/styles/utils/fillDerivedStyleProps";
import { historyManager } from "../history";
import {
  buildCanonicalMoveEvents,
  buildCanonicalReplaceEvents,
  buildCanonicalUpdateEvent,
  captureCanonicalNodeLocations,
  hasNonPropsCanonicalHistoryChange,
  type CanonicalHistoryNodeEvent,
} from "../history/canonicalHistoryEvents";
import { createCompleteProps } from "./elementHelpers";
import type { ElementsState } from "../elements";
import { getDB } from "../../../lib/db";
import { globalToast } from "../toast";
import {
  getEditingSemanticsImpactInstanceIds,
  getEditingSemanticsRole,
} from "../../utils/editingSemantics";
import { requestEditingSemanticsImpactConfirmation } from "../../utils/editingSemanticsImpactConfirmation";
import {
  applyElementOrderCanonicalPrimary,
  areCanonicalMutationStoreActionsRegistered,
  mergeElementsCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { getActiveCanonicalDocumentElements } from "../canonical/canonicalElementsView";
import { isRenderProjectionId } from "../../projection/renderProjectionIds";
import {
  INHERITED_LAYOUT_PROPS_UPDATE,
  NON_LAYOUT_PROPS_UPDATE,
} from "../../presentation/invalidation/editorMutationEffectRegistry";
import {
  emitStoreStyleCommitDescriptor,
  emitStoreStyleCommitDescriptors,
} from "../../presentation/storeCommitEmitter";

type BuilderDb = Awaited<ReturnType<typeof getDB>>;
type ElementUpdateLookup<TElement extends Element = Element> = Map<
  string,
  TElement
>;
type ElementUpdateChildrenByParent<TElement extends Element = Element> = Map<
  string,
  TElement[]
>;

function syncUpdatedElementToCanonical(
  element: Element,
  updates?: Partial<Element>,
): void {
  if (updates && isStructuralOrderMirrorPatch(updates)) {
    syncUpdatedElementsToCanonical(
      [element],
      [{ elementId: element.id, updates }],
    );
    return;
  }
  syncUpdatedElementsToCanonical([element]);
}

function isStructuralOrderMirrorPatch(updates: Partial<Element>): boolean {
  const keys = Object.keys(updates);
  return (
    keys.length > 0 &&
    keys.every((key) => key === "parent_id" || key === "page_id")
  );
}

function isStructuralOrderMirrorUpdate(update: BatchElementUpdate): boolean {
  return isStructuralOrderMirrorPatch(update.updates);
}

function syncUpdatedElementsToCanonical(
  elements: Element[],
  updates?: BatchElementUpdate[],
): void {
  if (!areCanonicalMutationStoreActionsRegistered()) return;
  if (updates && updates.every(isStructuralOrderMirrorUpdate)) {
    applyElementOrderCanonicalPrimary(elements);
    return;
  }
  mergeElementsCanonicalPrimary(elements);
}

async function persistActiveCanonicalDocument(db: BuilderDb): Promise<void> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return;
  const doc = canonical.documents.get(projectId);
  if (!doc) return;
  await db.documents.put(projectId, doc);
}

function isLayoutAffectingUpdate(
  changedStyle: Record<string, unknown>,
): boolean {
  return Object.keys(changedStyle).some((k) => !NON_LAYOUT_PROPS_UPDATE.has(k));
}

function buildElementUpdateLookup<TElement extends Element>(
  elements: readonly TElement[],
): ElementUpdateLookup<TElement> {
  return new Map(elements.map((element) => [element.id, element]));
}

function findElementForUpdate(
  elements: Element[],
  elementId: string,
): Element | undefined {
  return elements.find((element) => element.id === elementId);
}

function buildElementUpdateChildrenByParent<TElement extends Element>(
  elements: readonly TElement[],
): ElementUpdateChildrenByParent<TElement> {
  const childrenByParent: ElementUpdateChildrenByParent<TElement> = new Map();
  for (const element of elements) {
    const parentId = element.parent_id;
    if (!parentId) continue;
    childrenByParent.set(parentId, [
      ...(childrenByParent.get(parentId) ?? []),
      element,
    ]);
  }
  return childrenByParent;
}

function getElementUpdateSourceElements(
  state: Pick<ElementsState, "elements">,
): Element[] {
  const { elements: legacyElements } = state;
  return getActiveCanonicalDocumentElements() ?? legacyElements;
}

function markDirtyWithDescendantsUpdate(
  elementId: string,
  changedStyle: Record<string, unknown>,
  childrenByParent: ReadonlyMap<string, readonly Pick<Element, "id">[]>,
  dirtySet: Set<string>,
): void {
  dirtySet.add(elementId);
  const hasInheritedChange = Object.keys(changedStyle).some((k) =>
    INHERITED_LAYOUT_PROPS_UPDATE.has(k),
  );
  if (hasInheritedChange) {
    const queue = [elementId];
    while (queue.length > 0) {
      const parentId = queue.pop()!;
      const children = childrenByParent.get(parentId) ?? [];
      for (const child of children) {
        dirtySet.add(child.id);
        queue.push(child.id);
      }
    }
  }
}
import {
  rebuildPageIndex,
  rebuildComponentIndex,
  rebuildVariableUsageIndex,
} from "./elementIndexer";

// ============================================
// Types for Batch Operations
// ============================================

export interface BatchElementUpdate {
  elementId: string;
  updates: Partial<Element>;
}

export interface BatchPropsUpdate {
  elementId: string;
  props: ComponentElementProps;
}

type SetState = Parameters<StateCreator<ElementsState>>[0];
type GetState = Parameters<StateCreator<ElementsState>>[1];

function cloneForHistory<T>(value: T): T {
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
  } catch {
    // structuredClone 실패 시 JSON fallback
  }
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return value;
    return JSON.parse(json) as T;
  } catch {
    return value;
  }
}

/** 단일 요소 update entry 기록. prev/next 모두 merged 전체 props 여야 한다. */
function recordUpdateHistoryEntry(
  elementId: string,
  prevProps: Record<string, unknown>,
  nextProps: Record<string, unknown>,
): void {
  historyManager.addEntry({
    type: "update",
    elementId,
    data: {
      canonicalEvents: [
        buildCanonicalUpdateEvent(elementId, prevProps, nextProps),
      ],
    },
  });
}

function hasShallowPatchChanges(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  for (const key of Object.keys(patch)) {
    if (prev[key] !== patch[key]) return true;
  }
  return false;
}

function sanitizePropsPatch<T extends Record<string, unknown>>(props: T): T {
  const nextProps = { ...props };
  const rawStyle = nextProps.style;
  if (rawStyle && typeof rawStyle === "object" && !Array.isArray(rawStyle)) {
    (nextProps as Record<string, unknown>).style =
      sanitizeFillDerivedStylePatch(rawStyle as Record<string, string>, true);
  }
  return nextProps as T;
}

function sanitizeElementUpdate(updates: Partial<Element>): Partial<Element> {
  if (!updates.props) {
    return updates;
  }

  return {
    ...updates,
    props: sanitizePropsPatch(
      updates.props as Record<string, unknown>,
    ) as ComponentElementProps,
  };
}

const confirmedOriginImpactKeys = new Set<string>();

export function clearOriginImpactConfirmationCacheForTests(): void {
  confirmedOriginImpactKeys.clear();
}

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * origin 편집 영향 confirm 게이트 — 대화상자가 필요 없으면 **동기로** `true`.
 *
 * 반환형이 `boolean | Promise<boolean>` 인 이유: 이 게이트는 mutation 이 아니라 선행
 * 조건 검사이고, 대화상자를 띄우지 않는 경로(=대부분의 편집)에서는 계산이 전부 동기다.
 * `async` 로 두면 그 경로에도 await 지점이 생기는데, `await` 는 값이 이미 준비돼 있어도
 * microtask 경계를 만든다. history 트랜잭션 창(프리셋 적용 — usePresetApply) 안에서는
 * 그 경계가 곧 외부 mutation 이 같은 되돌리기 엔트리로 병합될 틈이 되므로, 양보 지점
 * 자체를 없애는 것이 유일한 구조적 차단이다.
 *
 * 호출부는 `gate !== true && !(await gate)` 형태로 받는다 — 동기 `true` 는 await 없이
 * 통과하고, 대화상자 경로만 실제로 양보한다.
 */
function confirmOriginImpactIfNeeded(
  state: ElementsState,
  element: Element,
): boolean | Promise<boolean> {
  if (getEditingSemanticsRole(element) !== "origin") return true;

  const startedAt = nowMs();
  const sourceElements = getElementUpdateSourceElements(state);
  const impactedInstanceIds = getEditingSemanticsImpactInstanceIds(
    element,
    sourceElements,
  );
  const countDurationMs = nowMs() - startedAt;
  if (countDurationMs > 100) {
    console.warn(
      `[EditingSemantics] origin impact count took ${countDurationMs.toFixed(1)}ms for ${impactedInstanceIds.length} instances`,
    );
  }

  const instanceCount = impactedInstanceIds.length;
  if (instanceCount === 0) return true;

  const confirmationKey = `${element.id}:${instanceCount}`;
  if (confirmedOriginImpactKeys.has(confirmationKey)) {
    return true;
  }

  return requestEditingSemanticsImpactConfirmation({
    countDurationMs,
    impactedInstanceIds,
    instanceCount,
    originId: element.id,
    originLabel: element.componentName ?? element.customId ?? element.type,
  }).then((confirmed) => {
    if (confirmed) {
      confirmedOriginImpactKeys.add(confirmationKey);
    }
    return confirmed;
  });
}

/**
 * UpdateElementProps 액션 생성 팩토리
 *
 * 요소의 props만 업데이트하는 로직을 처리합니다.
 *
 * 처리 순서:
 * 1. 히스토리 추가 (Undo/Redo 지원)
 * 2. canonical document mutation
 * 3. derived store cache 업데이트 (즉시 UI 반영)
 * 4. iframe 업데이트는 PropertyPanel에서 직접 처리 (무한 루프 방지)
 * 5. IndexedDB canonical document 저장
 *
 * @param set - Zustand setState 함수
 * @param get - Zustand getState 함수
 * @returns updateElementProps 액션 함수
 */
export const createUpdateElementPropsAction =
  (set: SetState, get: GetState) =>
  async (elementId: string, props: ComponentElementProps) => {
    if (isRenderProjectionId(elementId)) return;
    const sanitizedProps = sanitizePropsPatch(
      (props ?? {}) as Record<string, unknown>,
    ) as ComponentElementProps;
    const currentState = get();
    const sourceElements = getElementUpdateSourceElements(currentState);
    const element = findElementForUpdate(sourceElements, elementId);
    if (!element) return;

    const patch = sanitizedProps as Record<string, unknown>;
    if (Object.keys(patch).length === 0) return;
    if (
      !hasShallowPatchChanges(element.props as Record<string, unknown>, patch)
    )
      return;
    // 동기 통과(대화상자 불필요) 경로는 await 하지 않는다 — 게이트 주석 참조.
    const originGate = confirmOriginImpactIfNeeded(currentState, element);
    if (originGate !== true && !(await originGate)) return;

    const shouldRecordHistory = Boolean(currentState.currentPageId);
    const prevPropsClone = shouldRecordHistory
      ? cloneForHistory(element.props)
      : null;
    // canonical update event 는 full merged props 계약 — patch 가 아닌
    // 병합된 전체 props 를 기록해야 undo/redo 가 props 를 소거하지 않는다.
    const mergedNextPropsClone = shouldRecordHistory
      ? cloneForHistory({ ...element.props, ...sanitizedProps })
      : null;

    // 🚀 Phase 1: Immer → 함수형 업데이트
    // 1. 히스토리 추가 (상태 변경 전에 기록)
    if (currentState.currentPageId && prevPropsClone && mergedNextPropsClone) {
      recordUpdateHistoryEntry(
        elementId,
        prevPropsClone as Record<string, unknown>,
        mergedNextPropsClone as Record<string, unknown>,
      );
    }

    // ADR-040 Phase 3: indexOf + with() 증분 패치 (elements.map/find O(N) 제거)
    const updatedElement = {
      ...element,
      props: { ...element.props, ...sanitizedProps },
    };
    const idx = sourceElements.indexOf(element);
    const updatedElements =
      idx !== -1 ? sourceElements.with(idx, updatedElement) : sourceElements;

    // 선택된 요소가 업데이트된 경우 selectedElementProps도 업데이트
    const selectedElementProps =
      currentState.selectedElementId === elementId
        ? createCompleteProps(updatedElement, sanitizedProps)
        : currentState.selectedElementProps;

    // ADR-006 P3-1: props.style 변경 시 dirty tracking
    // props 중 style 객체만 추출하여 레이아웃 영향 여부 판단
    const changedStyle = (sanitizedProps.style ?? {}) as Record<
      string,
      unknown
    >;
    const hasStyleChange = Object.keys(changedStyle).length > 0;
    const isLayoutChange = hasStyleChange
      ? isLayoutAffectingUpdate(changedStyle)
      : Object.keys(patch).some((k) => k !== "style"); // style 외 props 변경은 레이아웃 영향으로 간주

    syncUpdatedElementToCanonical(updatedElement);

    // ADR-190: canonical 갱신 직후 ~ set() 직전이 commit lane 의 유일한 진입
    // 시점이다. canonical 이 갱신됐으므로 documentVersion 이 post-commit
    // revision 이고, set() 이 store 구독(StoreRenderBridge resync)을 발화시키기
    // 전이라 그 sync 가 pending commit 을 본다. set() 뒤로 밀리면 sync 는
    // pendingCommit 없이 changedIds 를 소비해 뒤늦은 patch 가 stale 이 된다.
    // 서술 불가한 patch 는 descriptor 가 null 이라 기존 full rebuild 유지.
    emitStoreStyleCommitDescriptor(elementId, patch);

    // updateElementProps는 element 구조(parent_id/page_id/type/variableBindings 등)를 바꾸지 않으므로,
    // 전체 인덱스 재구축(O(n)) 대신 변경된 요소만 O(1)로 갱신한다.
    if (updatedElement) {
      const elementsMap = buildElementUpdateLookup(sourceElements);
      elementsMap.set(elementId, updatedElement);
      if (isLayoutChange) {
        const dirtyIds = new Set(currentState.dirtyElementIds);
        markDirtyWithDescendantsUpdate(
          elementId,
          changedStyle,
          buildElementUpdateChildrenByParent(sourceElements),
          dirtyIds,
        );
        set((state) => ({
          elements: updatedElements,
          elementsMap,
          selectedElementProps,
          layoutVersion: state.layoutVersion + 1,
          dirtyElementIds: dirtyIds,
        }));
      } else {
        set({
          elements: updatedElements,
          elementsMap,
          selectedElementProps,
        });
      }
    } else {
      set({
        elements: updatedElements,
        selectedElementProps,
      });
    }

    // 2. iframe 업데이트는 PropertyPanel에서 직접 처리하도록 변경 (무한 루프 방지)

    // 3. Canonical document 저장 — UI 이벤트 핸들러를 블로킹하지 않도록 비동기 처리
    void (async () => {
      try {
        const db = await getDB();
        await persistActiveCanonicalDocument(db);
      } catch (error) {
        console.warn(
          "⚠️ [IndexedDB] canonical document 저장 중 오류 (메모리는 정상):",
          error,
        );
        // 🚀 Phase 7: Toast + Undo 버튼
        globalToast.error("저장에 실패했습니다.", {
          duration: 8000,
          action: {
            label: "되돌리기",
            onClick: () => get().undo(),
          },
        });
      }
    })();
  };

/**
 * UpdateElement 액션 생성 팩토리
 *
 * 요소의 전체 속성(props, dataBinding 등)을 업데이트하는 로직을 처리합니다.
 *
 * 처리 순서:
 * 1. 히스토리 추가 (props 변경 시)
 * 2. canonical document mutation
 * 3. derived store cache 업데이트
 * 4. IndexedDB canonical document 저장
 *
 * @param set - Zustand setState 함수
 * @param get - Zustand getState 함수
 * @returns updateElement 액션 함수
 */
export const createUpdateElementAction =
  (set: SetState, get: GetState) =>
  async (
    elementId: string,
    updates: Partial<import("../../../types/core/store.types").Element>,
  ) => {
    if (isRenderProjectionId(elementId)) return;
    const sanitizedUpdates = sanitizeElementUpdate(updates as Partial<Element>);
    if (Object.keys(sanitizedUpdates).length === 0) return;

    const currentState = get();
    const sourceElements = getElementUpdateSourceElements(currentState);
    const element = findElementForUpdate(sourceElements, elementId);
    if (!element) return;
    // 동기 통과(대화상자 불필요) 경로는 await 하지 않는다 — 게이트 주석 참조.
    const originGate = confirmOriginImpactIfNeeded(currentState, element);
    if (originGate !== true && !(await originGate)) return;

    // props 밖 canonical 필드(`responsive`/`fills`) 변경은 update event 로 undo 되지
    // 않는다 — `replaceNodeProps` 가 props 만 교체하므로 full node 를 실어야 한다.
    // `inspectorActions` 의 Style 패널 경로와 동일 판정 (단일 소스: 아래 helper).
    const hasNonPropsCanonicalChange =
      hasNonPropsCanonicalHistoryChange(sanitizedUpdates);
    const shouldRecordHistory =
      Boolean(currentState.currentPageId) &&
      (Boolean(sanitizedUpdates.props) || hasNonPropsCanonicalChange);
    const prevPropsClone = shouldRecordHistory
      ? cloneForHistory(element.props)
      : null;
    // updateElement 는 `{...element, ...sanitizedUpdates}` 로 props 를 전체
    // 교체하므로 sanitizedUpdates.props 자체가 full next props 다.
    const newPropsClone =
      shouldRecordHistory && sanitizedUpdates.props
        ? cloneForHistory(sanitizedUpdates.props)
        : null;

    // 🚀 Phase 1: Immer → 함수형 업데이트
    // 1. 히스토리 추가 (상태 변경 전에 기록)
    //    canonical mutation 은 아래 `set` 안에서 일어나므로 여기는 pre-mutation 시점
    //    (`buildCanonicalReplaceEvents` 의 prevCaptures 미전달 모드).
    if (shouldRecordHistory) {
      if (hasNonPropsCanonicalChange) {
        historyManager.addEntry({
          type: "update",
          elementId,
          data: {
            canonicalEvents: buildCanonicalReplaceEvents(
              [element],
              [{ ...element, ...sanitizedUpdates }],
            ),
          },
        });
      } else if (prevPropsClone && newPropsClone) {
        recordUpdateHistoryEntry(
          elementId,
          prevPropsClone as Record<string, unknown>,
          newPropsClone as Record<string, unknown>,
        );
      }
    }

    // ADR-006 P3-1: props.style 변경 시 dirty tracking
    const changedStyle = (sanitizedUpdates.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    const hasStyleChange = Object.keys(changedStyle).length > 0;
    // ADR-154/168: `responsive` 는 props 축이 아니라 top-level 필드로 온다. props 키 검사만
    // 하면 responsive-only write 가 layout 무영향으로 판정돼 layoutVersion 이 오르지 않고,
    // resolve 재계산·preview 재발행이 전부 건너뛰어진다 (실측: 프리셋 적용 후 preview 의
    // `@media` CSS 가 새로고침 전까지 이전 프리셋 규칙 그대로였다). `inspectorActions.ts`
    // 의 Style 패널 경로는 같은 이유로 이미 bump 을 강제하고 있다 — 그 규칙은 호출자
    // 속성이 아니라 **필드 자체의 성질**이므로 일반 경로에도 있어야 한다.
    const hasResponsiveChange = "responsive" in sanitizedUpdates;
    const isLayoutChange =
      hasResponsiveChange ||
      (hasStyleChange
        ? isLayoutAffectingUpdate(changedStyle)
        : Boolean(sanitizedUpdates.props)); // props 변경이 있으면 레이아웃 영향으로 간주

    // Atomic derive — set callback 안에서 latest `state` 기반으로 elements 재계산.
    // Why: concurrent 호출 (예: Promise.all 로 여러 updateElement) 시 모든 호출이
    // 외부에서 같은 stale snapshot 기반으로 derive 하면 `set` last-write-wins 로
    // 다른 element 변경이 lost. canonical 자체는 latest doc 기반이라 안전하나,
    // legacy `state.elements` mirror 가 `_rebuildIndexes` primary derive source
    // 이므로 mirror race 가 UI 에 그대로 노출됨.
    set((state) => {
      const latestSource = getElementUpdateSourceElements(state);
      const latestIdx = latestSource.findIndex((el) => el.id === elementId);
      if (latestIdx === -1) return state; // 다른 호출로 이미 삭제된 경우 skip

      const latestElement = latestSource[latestIdx];
      const latestUpdatedElement = { ...latestElement, ...sanitizedUpdates };
      syncUpdatedElementToCanonical(latestUpdatedElement, sanitizedUpdates);
      const latestUpdatedElements = latestSource.with(
        latestIdx,
        latestUpdatedElement,
      );

      const latestSelectedElementProps =
        state.selectedElementId === elementId && sanitizedUpdates.props
          ? createCompleteProps(latestUpdatedElement, sanitizedUpdates.props)
          : state.selectedElementProps;

      if (isLayoutChange) {
        const dirtyIds = new Set(state.dirtyElementIds);
        markDirtyWithDescendantsUpdate(
          elementId,
          changedStyle,
          buildElementUpdateChildrenByParent(latestSource),
          dirtyIds,
        );
        return {
          elements: latestUpdatedElements,
          selectedElementProps: latestSelectedElementProps,
          layoutVersion: state.layoutVersion + 1,
          dirtyElementIds: dirtyIds,
        };
      }
      return {
        elements: latestUpdatedElements,
        selectedElementProps: latestSelectedElementProps,
      };
    });

    // 🔧 CRITICAL: elementsMap 재구축 (재선택 시 이전 값 반환 방지)
    // Immer produce() 외부에서 호출 (Map은 Immer가 직접 지원하지 않음)
    get()._rebuildIndexes();

    // 2. Canonical document 저장 — UI 이벤트 핸들러를 블로킹하지 않도록 비동기 처리
    if (typeof indexedDB === "undefined") return;
    void (async () => {
      try {
        const db = await getDB();
        await persistActiveCanonicalDocument(db);
      } catch (error) {
        console.warn(
          "⚠️ [IndexedDB] canonical document 저장 중 오류 (메모리는 정상):",
          error,
        );
        // 🚀 Phase 7: Toast + Undo 버튼
        globalToast.error("저장에 실패했습니다.", {
          duration: 8000,
          action: {
            label: "되돌리기",
            onClick: () => get().undo(),
          },
        });
      }
    })();
  };

// ============================================
// 🚀 Batch Operations (100+ 요소 최적화)
// ============================================

/**
 * BatchUpdateElementProps 액션 생성 팩토리
 *
 * 여러 요소의 props를 한 번에 업데이트합니다.
 * 100개 이상의 요소를 동시에 업데이트할 때 성능 최적화됨.
 *
 * 최적화 포인트:
 * - 단일 Zustand 상태 업데이트 (N번 → 1번)
 * - 단일 히스토리 엔트리 (batch 타입)
 * - 단일 인덱스 재구축 (N번 → 1번)
 * - IndexedDB 병렬 저장 (Promise.all)
 *
 * @param set - Zustand setState 함수
 * @param get - Zustand getState 함수
 * @returns batchUpdateElementProps 액션 함수
 */
export const createBatchUpdateElementPropsAction =
  (set: SetState, get: GetState) => async (updates: BatchPropsUpdate[]) => {
    const canonicalUpdates = updates.filter(
      (update) => !isRenderProjectionId(update.elementId),
    );
    if (canonicalUpdates.length === 0) return;

    const state = get();
    const sourceElements = getElementUpdateSourceElements(state);
    const normalizedUpdates = canonicalUpdates.map((update) => ({
      ...update,
      props: sanitizePropsPatch(
        update.props as Record<string, unknown>,
      ) as ComponentElementProps,
    }));
    const elementLookup = buildElementUpdateLookup(sourceElements);
    const validUpdates = normalizedUpdates.filter((u) =>
      elementLookup.has(u.elementId),
    );

    if (validUpdates.length === 0) return;

    // 🚀 Phase 1: Immer → 함수형 업데이트
    // 1. 히스토리용 이전 상태 저장 (불변 업데이트를 위해 먼저 수집)
    const prevStates: Array<{
      elementId: string;
      prevProps: ComponentElementProps;
    }> = [];

    // 업데이트 맵 생성 (O(1) 조회용)
    const updateMap = new Map<string, ComponentElementProps>();
    const updatedElementMap: ElementUpdateLookup = new Map();
    const nextElementsMap = new Map(elementLookup);
    for (const { elementId, props } of validUpdates) {
      const element = elementLookup.get(elementId);
      if (element) {
        prevStates.push({
          elementId,
          prevProps: cloneForHistory(element.props),
        });
        updateMap.set(elementId, props);

        // props-only 업데이트는 element 구조를 바꾸지 않으므로,
        // 인덱스 전체 재구축 대신 요소만 O(1)로 갱신한다.
        const merged = { ...element, props: { ...element.props, ...props } };
        updatedElementMap.set(elementId, merged);
        nextElementsMap.set(elementId, merged);
      }
    }

    // 2. 단일 메모리 상태 업데이트 (불변)
    const updatedElements = sourceElements.map(
      (el) => updatedElementMap.get(el.id) ?? el,
    );

    // 선택된 요소 props 업데이트
    const selectedId = state.selectedElementId;
    const selectedProps =
      selectedId && updateMap.has(selectedId)
        ? (() => {
            const el = updatedElementMap.get(selectedId);
            return el
              ? createCompleteProps(el, updateMap.get(selectedId)!)
              : state.selectedElementProps;
          })()
        : state.selectedElementProps;

    // ADR-006 P3-1: batch props 변경 시 dirty tracking
    // 업데이트 중 하나라도 레이아웃 영향이 있으면 layoutVersion 증가
    const dirtyIds = new Set(state.dirtyElementIds);
    const childrenByParent = buildElementUpdateChildrenByParent(sourceElements);
    let hasAnyLayoutChange = false;
    for (const { elementId, props } of validUpdates) {
      const changedStyle = (props.style ?? {}) as Record<string, unknown>;
      const hasStyleChange = Object.keys(changedStyle).length > 0;
      const isLayoutChange = hasStyleChange
        ? isLayoutAffectingUpdate(changedStyle)
        : Object.keys(props as Record<string, unknown>).some(
            (k) => k !== "style",
          );
      if (isLayoutChange) {
        hasAnyLayoutChange = true;
        markDirtyWithDescendantsUpdate(
          elementId,
          changedStyle,
          childrenByParent,
          dirtyIds,
        );
      }
    }

    const updatedElementsForPersistence = Array.from(
      updatedElementMap.values(),
    );
    syncUpdatedElementsToCanonical(updatedElementsForPersistence);

    // ADR-190 Phase 3: 다중 선택 편집·정렬·드래그가 여기로 모인다. 요소마다
    // 따로 queue 하면 pendingCommit 단일 슬롯이 앞선 patch 를 덮어쓰므로
    // **한 번에** 배열로 넘긴다 (R6).
    emitStoreStyleCommitDescriptors(
      validUpdates.map(({ elementId, props }) => ({
        elementId,
        patch: props as Record<string, unknown>,
      })),
    );

    if (hasAnyLayoutChange) {
      set((prevState) => ({
        elements: updatedElements,
        elementsMap: nextElementsMap,
        selectedElementProps: selectedProps,
        layoutVersion: prevState.layoutVersion + 1,
        dirtyElementIds: dirtyIds,
      }));
    } else {
      set({
        elements: updatedElements,
        elementsMap: nextElementsMap,
        selectedElementProps: selectedProps,
      });
    }

    // 2. 단일 히스토리 엔트리 추가 (batch 타입)
    // canonical update event — full merged props 계약 (updatedElementMap 의
    // merged 결과를 next 로 기록).
    const currentPageId = get().currentPageId;
    if (currentPageId && prevStates.length > 0) {
      historyManager.addEntry({
        type: "batch",
        elementId: prevStates[0].elementId, // 대표 요소
        elementIds: prevStates.map((s) => s.elementId),
        data: {
          canonicalEvents: prevStates.map((s) =>
            buildCanonicalUpdateEvent(
              s.elementId,
              s.prevProps as Record<string, unknown>,
              cloneForHistory(
                updatedElementMap.get(s.elementId)?.props ?? {},
              ) as Record<string, unknown>,
            ),
          ),
        },
      });
    }

    // 3. Canonical document 저장 — UI 이벤트 핸들러를 블로킹하지 않도록 비동기 처리
    void (async () => {
      try {
        const db = await getDB();
        await persistActiveCanonicalDocument(db);
      } catch (error) {
        console.warn(
          "⚠️ [IndexedDB] canonical document 배치 저장 중 오류 (메모리는 정상):",
          error,
        );
        // 🚀 Phase 7: Toast + Undo 버튼
        globalToast.error("저장에 실패했습니다.", {
          duration: 8000,
          action: {
            label: "되돌리기",
            onClick: () => get().undo(),
          },
        });
      }
    })();
  };

/**
 * BatchUpdateElements 액션 생성 팩토리
 *
 * 여러 요소의 전체 속성을 한 번에 업데이트합니다.
 * props, dataBinding 등 모든 필드 지원.
 *
 * @param set - Zustand setState 함수
 * @param get - Zustand getState 함수
 * @returns batchUpdateElements 액션 함수
 */
export const createBatchUpdateElementsAction =
  (set: SetState, get: GetState) => async (updates: BatchElementUpdate[]) => {
    const canonicalUpdates = updates.filter(
      (update) => !isRenderProjectionId(update.elementId),
    );
    if (canonicalUpdates.length === 0) return;

    const state = get();
    const sourceElements = getElementUpdateSourceElements(state);
    const normalizedUpdates = canonicalUpdates.map((update) => ({
      ...update,
      updates: sanitizeElementUpdate(update.updates),
    }));
    const elementLookup = buildElementUpdateLookup(sourceElements);
    const validUpdates = normalizedUpdates.filter((u) =>
      elementLookup.has(u.elementId),
    );

    if (validUpdates.length === 0) return;

    // 🚀 Phase 1: Immer → 함수형 업데이트
    // 1. 히스토리용 canonical update event 수집 (props 변경 시에만)
    //    batchUpdateElements 는 `{...el, ...updates}` 로 props 를 전체
    //    교체하므로 updates.props 자체가 full next props 다.
    const updateEvents: CanonicalHistoryNodeEvent[] = [];

    // 업데이트 맵 생성 (O(1) 조회용)
    const updateMap = new Map<string, Partial<Element>>();
    for (const { elementId, updates: elementUpdates } of validUpdates) {
      const element = elementLookup.get(elementId);
      if (element) {
        if (elementUpdates.props) {
          updateEvents.push(
            buildCanonicalUpdateEvent(
              elementId,
              cloneForHistory(element.props) as Record<string, unknown>,
              cloneForHistory(elementUpdates.props) as Record<string, unknown>,
            ),
          );
        }
        updateMap.set(elementId, elementUpdates);
      }
    }

    // 구조 변경(parent_id) 대상의 from-location 은 canonical mutation 전에 캡처
    const structuralIds = validUpdates
      .filter((u) => u.updates.parent_id !== undefined)
      .map((u) => u.elementId);
    const structuralFromLocations =
      captureCanonicalNodeLocations(structuralIds);

    // 2. 단일 메모리 상태 업데이트 (불변)
    const updatedElements = sourceElements.map((el) => {
      const updates = updateMap.get(el.id);
      return updates ? { ...el, ...updates } : el;
    });

    // 선택된 요소 props 업데이트
    const selectedId = state.selectedElementId;
    const selectedUpdate = selectedId ? updateMap.get(selectedId) : undefined;
    const selectedProps =
      selectedId && selectedUpdate?.props
        ? (() => {
            const el = updatedElements.find((e) => e.id === selectedId);
            return el
              ? createCompleteProps(el, selectedUpdate.props!)
              : state.selectedElementProps;
          })()
        : state.selectedElementProps;

    // Fix 3: 단일 atomic set() — elements + indexes 동시 갱신 (transient 불일치 방지)
    const elementsMap: ElementUpdateLookup = new Map();
    const newChildrenMap: ElementUpdateChildrenByParent = new Map();
    updatedElements.forEach((el) => {
      elementsMap.set(el.id, el);
      const parentId = el.parent_id || "root";
      if (!newChildrenMap.has(parentId)) {
        newChildrenMap.set(parentId, []);
      }
      newChildrenMap.get(parentId)!.push(el);
    });
    const pageIndex = rebuildPageIndex(updatedElements, elementsMap);
    const componentIndex = rebuildComponentIndex(updatedElements);
    const variableUsageIndex = rebuildVariableUsageIndex(updatedElements);

    // pageElementsSnapshot 재구축 — 레이어 트리가 이 스냅샷에 의존
    const pageElementsSnapshot: Record<string, Element[]> = {};
    for (const [pageId, elementIds] of pageIndex.elementsByPage.entries()) {
      const pageElements = updatedElements.filter((element) =>
        elementIds.has(element.id),
      );
      pageElementsSnapshot[pageId] = pageElements;
    }

    // ADR-006 P3-1: batch elements 변경 시 dirty tracking
    const dirtyIds = new Set(state.dirtyElementIds);
    let hasAnyLayoutChange = false;

    // 구조 변경(parent_id) 시 layoutVersion 증가 필수
    for (const { updates: elementUpdates } of validUpdates) {
      if (elementUpdates.parent_id !== undefined) {
        hasAnyLayoutChange = true;
        break;
      }
    }

    for (const { elementId, updates: elementUpdates } of validUpdates) {
      if (!elementUpdates.props) continue;
      const changedStyle = (elementUpdates.props.style ?? {}) as Record<
        string,
        unknown
      >;
      const hasStyleChange = Object.keys(changedStyle).length > 0;
      const isLayoutChange = hasStyleChange
        ? isLayoutAffectingUpdate(changedStyle)
        : true; // props 변경 → 레이아웃 영향 간주
      if (isLayoutChange) {
        hasAnyLayoutChange = true;
        markDirtyWithDescendantsUpdate(
          elementId,
          changedStyle,
          newChildrenMap,
          dirtyIds,
        );
      }
    }

    const updatedElementMap = new Map(
      updatedElements.map((element) => [element.id, element]),
    );
    const updatedElementsForPersistence = validUpdates
      .map((update) => updatedElementMap.get(update.elementId))
      .filter((element): element is Element => Boolean(element));
    syncUpdatedElementsToCanonical(updatedElementsForPersistence, validUpdates);

    set((prevState) => ({
      elements: updatedElements,
      selectedElementProps: selectedProps,
      elementsMap,
      childrenMap: newChildrenMap,
      pageIndex,
      pageElementsSnapshot,
      componentIndex,
      variableUsageIndex,
      ...(hasAnyLayoutChange && {
        layoutVersion: prevState.layoutVersion + 1,
        dirtyElementIds: dirtyIds,
      }),
    }));

    // 2. 히스토리 엔트리 추가 — update event (props) + move event (parent_id)
    //    를 단일 batch entry 로. move 의 to-location 은 sync 후 doc 에서 해석.
    //    (과거: 혼합 batch 에서 구조 변경이 history 누락 + batch diff 기록이
    //     props-only event 를 만들어 undo 시 parent 복원이 skip 되던 결함)
    const currentPageId = get().currentPageId;
    if (currentPageId) {
      const moveEvents = buildCanonicalMoveEvents(
        structuralIds.flatMap((nodeId) => {
          const from = structuralFromLocations.get(nodeId);
          return from ? [{ nodeId, from }] : [];
        }),
      );
      const canonicalEvents = [...updateEvents, ...moveEvents];
      if (canonicalEvents.length > 0) {
        historyManager.addEntry({
          type: updateEvents.length > 0 ? "batch" : "move",
          elementId: validUpdates[0].elementId,
          elementIds: validUpdates.map((u) => u.elementId),
          data: { canonicalEvents },
        });
      }
    }

    // 4. Canonical document 저장
    try {
      const db = await getDB();
      await persistActiveCanonicalDocument(db);
    } catch (error) {
      console.warn(
        "⚠️ [IndexedDB] canonical document 배치 저장 중 오류 (메모리는 정상):",
        error,
      );
      // 🚀 Phase 7: Toast + Undo 버튼
      globalToast.error("저장에 실패했습니다.", {
        duration: 8000,
        action: {
          label: "되돌리기",
          onClick: () => get().undo(),
        },
      });
    }
  };
