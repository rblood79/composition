// 🚀 Phase 1: Immer 제거 - 함수형 업데이트로 전환
// import { produce } from "immer"; // REMOVED
import type { StateCreator } from "zustand";
import type { CanonicalNode } from "@composition/shared";
import {
  ComponentElementProps,
  Element,
} from "../../../types/core/store.types";
import { sanitizeFillDerivedStylePatch } from "../../panels/styles/utils/fillDerivedStyleProps";
import { historyManager } from "../history";
import {
  buildCanonicalReplaceEvents,
  buildCanonicalUpdateEvent,
  hasNonPropsCanonicalHistoryChange,
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
  updateCanonicalNodeFromElementPrimary,
  updateCanonicalNodePropsBatchPrimary,
  updateCanonicalNodePropsPrimary,
} from "@/adapters/canonical/canonicalMutations";
import {
  getElementLayoutId,
  LEGACY_COMPONENT_ROLE_FIELD,
  LEGACY_LAYOUT_ID_FIELD,
  LEGACY_MASTER_ID_FIELD,
  LEGACY_SLOT_NAME_FIELD,
} from "@/adapters/canonical/legacyElementFields";
import { readCanonicalNodeCustomId } from "@/adapters/canonical/legacyMetadata";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import {
  canonicalNodeToElement,
  getActiveCanonicalDocumentElements,
} from "../canonical/canonicalElementsView";
import {
  getCanonicalNodeOccurrenceCount,
  getFirstProjectableNodeById,
  getProjectableChildrenByParent,
  getProjectableNodes,
} from "../canonical/canonicalTraversalHelpers";
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

const EMPTY_ELEMENTS: Element[] = [];
const elementArrayIndexCache = new WeakMap<
  readonly Element[],
  ReadonlyMap<string, number>
>();

function getElementArrayIndex(
  elements: readonly Element[],
  elementId: string,
): number {
  let indexById = elementArrayIndexCache.get(elements);
  if (!indexById) {
    const nextIndexById = new Map<string, number>();
    elements.forEach((element, index) => {
      if (!nextIndexById.has(element.id)) {
        nextIndexById.set(element.id, index);
      }
    });
    indexById = nextIndexById;
    elementArrayIndexCache.set(elements, indexById);
  }
  return indexById.get(elementId) ?? -1;
}

type DerivedPropsUpdate = {
  element: Element;
  elements: Element[];
  elementsMap: ElementUpdateLookup;
};

function createDerivedPropsUpdate(
  state: Pick<ElementsState, "elements" | "elementsMap">,
  elementId: string,
  nextProps: ComponentElementProps,
): DerivedPropsUpdate | null {
  let sourceElements = state.elements;
  let index = getElementArrayIndex(sourceElements, elementId);

  // 정상 hot path는 기존 canonical-derived cache를 증분 갱신한다. bootstrap 또는
  // cache gap에서만 전체 projection으로 mirror를 복구한다.
  if (index < 0) {
    sourceElements = getActiveCanonicalDocumentElements() ?? EMPTY_ELEMENTS;
    index = getElementArrayIndex(sourceElements, elementId);
  }
  if (index < 0) return null;

  const currentElement = sourceElements[index];
  const element = { ...currentElement, props: nextProps };
  const elements = sourceElements.with(index, element);
  const sourceIndexById = elementArrayIndexCache.get(sourceElements);
  if (sourceIndexById) elementArrayIndexCache.set(elements, sourceIndexById);

  const elementsMap =
    sourceElements === state.elements
      ? new Map(state.elementsMap)
      : buildElementUpdateLookup(sourceElements);
  elementsMap.set(elementId, element);
  return { element, elements, elementsMap };
}

type DerivedElementUpdate = {
  previousElement: Element;
  element: Element;
  elements: Element[];
  elementsMap: ElementUpdateLookup;
};

function createDerivedElementUpdate(
  state: Pick<ElementsState, "elements" | "elementsMap">,
  canonicalNode: CanonicalNode,
  updates: Partial<Element>,
): DerivedElementUpdate | null {
  let sourceElements = state.elements;
  let index = getElementArrayIndex(sourceElements, canonicalNode.id);

  // 정상 hot path는 canonical-derived store cache의 위치 정보만 재사용한다.
  // bootstrap/cache gap에서만 전체 projection 한 번으로 mirror를 복구한다.
  if (index < 0) {
    sourceElements = getActiveCanonicalDocumentElements() ?? EMPTY_ELEMENTS;
    index = getElementArrayIndex(sourceElements, canonicalNode.id);
  }
  if (index < 0) return null;

  const scopeElement = sourceElements[index];
  const previousElement = canonicalNodeToElement(
    canonicalNode,
    scopeElement.parent_id ?? null,
    {
      pageId: scopeElement.page_id ?? null,
      layoutId: getElementLayoutId(scopeElement),
    },
  );
  if (!previousElement) return null;

  const element = { ...previousElement, ...updates };
  const elements = sourceElements.with(index, element);
  const sourceIndexById = elementArrayIndexCache.get(sourceElements);
  if (sourceIndexById) elementArrayIndexCache.set(elements, sourceIndexById);

  const elementsMap =
    sourceElements === state.elements
      ? new Map(state.elementsMap)
      : buildElementUpdateLookup(sourceElements);
  elementsMap.set(canonicalNode.id, element);
  return { previousElement, element, elements, elementsMap };
}

type DerivedBatchPropsUpdate = {
  elements: Element[];
  elementsMap: ElementUpdateLookup;
  updatedElementMap: ElementUpdateLookup;
};

function createDerivedBatchPropsUpdate(
  state: Pick<ElementsState, "elements" | "elementsMap">,
  nextPropsById: ReadonlyMap<string, ComponentElementProps>,
  duplicateIds: ReadonlySet<string>,
): DerivedBatchPropsUpdate | null {
  let sourceElements = state.elements;
  let hasMissingElement = false;
  for (const elementId of nextPropsById.keys()) {
    if (getElementArrayIndex(sourceElements, elementId) < 0) {
      hasMissingElement = true;
      break;
    }
  }

  // 정상 hot path는 derived cache를 직접 patch한다. bootstrap/cache gap은
  // canonical projection 한 번으로 전체 mirror를 복구한다.
  if (hasMissingElement) {
    sourceElements = getActiveCanonicalDocumentElements() ?? EMPTY_ELEMENTS;
    for (const elementId of nextPropsById.keys()) {
      if (getElementArrayIndex(sourceElements, elementId) < 0) return null;
    }
  }

  const updatedElementMap: ElementUpdateLookup = new Map();
  let elements: Element[];
  if (duplicateIds.size > 0) {
    const sourceLookup = buildElementUpdateLookup(sourceElements);
    for (const [elementId, nextProps] of nextPropsById) {
      const currentElement = sourceLookup.get(elementId);
      if (!currentElement) return null;
      updatedElementMap.set(elementId, {
        ...currentElement,
        props: nextProps,
      });
    }
    // 구 batch path는 duplicate row를 모두 마지막 same-id mirror로 교체했다.
    elements = sourceElements.map(
      (element) => updatedElementMap.get(element.id) ?? element,
    );
  } else {
    elements = [...sourceElements];
    for (const [elementId, nextProps] of nextPropsById) {
      const index = getElementArrayIndex(sourceElements, elementId);
      const currentElement = sourceElements[index];
      const updatedElement = { ...currentElement, props: nextProps };
      elements[index] = updatedElement;
      updatedElementMap.set(elementId, updatedElement);
    }
    const sourceIndexById = elementArrayIndexCache.get(sourceElements);
    if (sourceIndexById) elementArrayIndexCache.set(elements, sourceIndexById);
  }

  const elementsMap =
    sourceElements === state.elements
      ? new Map(state.elementsMap)
      : buildElementUpdateLookup(sourceElements);
  for (const [elementId, element] of updatedElementMap) {
    elementsMap.set(elementId, element);
  }
  return { elements, elementsMap, updatedElementMap };
}

function syncLocationUpdatedElementToCanonical(
  element: Element,
  updates: Partial<Element>,
): void {
  if (isStructuralOrderMirrorPatch(updates)) {
    applyElementOrderCanonicalPrimary([element]);
    return;
  }
  mergeElementsCanonicalPrimary([element]);
}

function isStructuralOrderMirrorPatch(updates: Partial<Element>): boolean {
  const keys = Object.keys(updates);
  return (
    keys.length > 0 &&
    keys.every((key) => key === "parent_id" || key === "page_id")
  );
}

const CANONICAL_LOCATION_FIELDS = new Set<string>([
  "id",
  "parent_id",
  "page_id",
  LEGACY_LAYOUT_ID_FIELD,
  LEGACY_SLOT_NAME_FIELD,
]);

const DERIVED_INDEX_FIELDS = new Set<string>([
  ...CANONICAL_LOCATION_FIELDS,
  "type",
  "variableBindings",
  LEGACY_COMPONENT_ROLE_FIELD,
  LEGACY_MASTER_ID_FIELD,
  "ref",
  "reusable",
]);

function hasCanonicalLocationUpdate(updates: Partial<Element>): boolean {
  return Object.keys(updates).some((key) => CANONICAL_LOCATION_FIELDS.has(key));
}

function requiresFullDerivedIndexRebuild(
  updates: Partial<Element>,
  occurrenceCount: number,
): boolean {
  return (
    occurrenceCount > 1 ||
    Object.keys(updates).some((key) => DERIVED_INDEX_FIELDS.has(key))
  );
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
// ============================================
// Types for Batch Operations
// ============================================

export interface BatchPropsUpdate {
  elementId: string;
  props: ComponentElementProps;
  /**
   * `props.style` 을 **부분 patch** 로 취급해 대상 요소의 현재 style 위에 덮는다 (기본은 통째 교체).
   *
   * 기본 교체 의미는 Inspector 의 style 편집 (키 삭제 포함) 이 의존하므로 바꿀 수 없다. 반면
   * propagation (`buildPropagationUpdates`) 이 만드는 patch 는 바꾸는 키 하나뿐이라, 교체로 적용하면
   * 자식의 나머지 style 이 사라진다 (r2 feh2). 이 자리에서만 병합으로 전환한다 — 생산자가 현재 style
   * 전체를 복사해 오면 `sanitizePropsPatch` 가 fill 파생 키 (backgroundColor 등) 를 patch 로 보고
   * 지워버리기 때문이다 (round 3 fe2m1).
   */
  mergeStyle?: boolean;
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

/**
 * `BatchPropsUpdate.mergeStyle` 적용 — patch 의 `style` 을 현재 style **위에 덮는다**.
 *
 * 기본 (플래그 없음) 은 통째 교체를 유지한다: Inspector 의 style 편집은 키 삭제를 위해 다음 style
 * 전체를 보내므로 병합으로 바꾸면 삭제가 불가능해진다. 반대로 propagation patch 는 바꾸는 키 하나뿐
 * 이라 교체로 적용하면 자식의 나머지 style 이 사라진다 (r2 feh2). 보존을 생산자가 "현재 style 전체
 * 복사" 로 하면 `sanitizePropsPatch` 가 그 복사본의 fill 파생 키 (backgroundColor 등) 를 patch 로 보고
 * 지우므로 (round 3 fe2m1), 병합은 반드시 이 소비 지점에서 한다.
 */
export function applyBatchStylePatch(
  currentProps: Record<string, unknown>,
  patchProps: Record<string, unknown>,
  mergeStyle: boolean | undefined,
): Record<string, unknown> {
  if (!mergeStyle) return patchProps;
  const patchStyle = patchProps.style as Record<string, unknown> | undefined;
  const currentStyle = currentProps.style as
    Record<string, unknown> | undefined;
  if (!patchStyle || !currentStyle) return patchProps;
  return { ...patchProps, style: { ...currentStyle, ...patchStyle } };
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

type OriginImpactTarget = Pick<
  CanonicalNode,
  "id" | "type" | "metadata" | "name" | "reusable"
> & {
  ref?: unknown;
};

export type OriginImpactApproval = {
  readonly kind: "origin-impact-approval";
  readonly originId: string;
  readonly confirmationKey: string | null;
};

type OriginImpactContext = {
  confirmationKey: string;
  countDurationMs: number;
  impactedInstanceIds: string[];
};

export function clearOriginImpactConfirmationCacheForTests(): void {
  confirmedOriginImpactKeys.clear();
}

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function getOriginImpactContext(
  element: OriginImpactTarget,
): OriginImpactContext | null {
  if (getEditingSemanticsRole(element) !== "origin") return null;

  const startedAt = nowMs();
  const impactedInstanceIds = getEditingSemanticsImpactInstanceIds(
    element,
    getProjectableNodes(),
  ).sort();
  const countDurationMs = nowMs() - startedAt;
  if (countDurationMs > 100) {
    console.warn(
      `[EditingSemantics] origin impact count took ${countDurationMs.toFixed(1)}ms for ${impactedInstanceIds.length} instances`,
    );
  }

  return {
    confirmationKey: JSON.stringify([element.id, impactedInstanceIds]),
    countDurationMs,
    impactedInstanceIds,
  };
}

function createOriginImpactApproval(
  element: OriginImpactTarget,
  context: OriginImpactContext | null,
): OriginImpactApproval {
  return {
    kind: "origin-impact-approval",
    originId: element.id,
    confirmationKey: context?.confirmationKey ?? null,
  };
}

function isCurrentOriginImpactApproval(
  element: OriginImpactTarget,
  approval: OriginImpactApproval | undefined,
): boolean {
  if (
    !approval ||
    approval.kind !== "origin-impact-approval" ||
    approval.originId !== element.id
  ) {
    return false;
  }
  const context = getOriginImpactContext(element);
  return approval.confirmationKey === (context?.confirmationKey ?? null);
}

export function requestOriginImpactApprovalIfNeeded(
  element: OriginImpactTarget,
): OriginImpactApproval | Promise<OriginImpactApproval | null> {
  const context = getOriginImpactContext(element);
  if (
    !context ||
    context.impactedInstanceIds.length === 0 ||
    confirmedOriginImpactKeys.has(context.confirmationKey)
  ) {
    return createOriginImpactApproval(element, context);
  }

  return requestEditingSemanticsImpactConfirmation({
    countDurationMs: context.countDurationMs,
    impactedInstanceIds: context.impactedInstanceIds,
    instanceCount: context.impactedInstanceIds.length,
    originId: element.id,
    originLabel:
      element.name ?? readCanonicalNodeCustomId(element) ?? element.type,
  }).then((confirmed) => {
    if (!confirmed) return null;
    confirmedOriginImpactKeys.add(context.confirmationKey);
    return createOriginImpactApproval(element, context);
  });
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
export function confirmOriginImpactIfNeeded(
  element: OriginImpactTarget,
  approval?: OriginImpactApproval,
): boolean | Promise<boolean> {
  if (isCurrentOriginImpactApproval(element, approval)) return true;
  const approvalResult = requestOriginImpactApprovalIfNeeded(element);
  return approvalResult instanceof Promise
    ? approvalResult.then((result) => result !== null)
    : true;
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
  async (
    elementId: string,
    props: ComponentElementProps,
    options?: { originImpactApproval?: OriginImpactApproval },
  ) => {
    if (isRenderProjectionId(elementId)) return;
    const sanitizedProps = sanitizePropsPatch(
      (props ?? {}) as Record<string, unknown>,
    ) as ComponentElementProps;
    const currentState = get();
    const canonicalNode = getFirstProjectableNodeById(elementId);
    if (!canonicalNode) return;

    const patch = sanitizedProps as Record<string, unknown>;
    if (Object.keys(patch).length === 0) return;
    const currentProps = (canonicalNode.props ?? {}) as Record<string, unknown>;
    if (!hasShallowPatchChanges(currentProps, patch)) return;
    // 동기 통과(대화상자 불필요) 경로는 await 하지 않는다 — 게이트 주석 참조.
    const originGate = confirmOriginImpactIfNeeded(
      canonicalNode,
      options?.originImpactApproval,
    );
    if (originGate !== true && !(await originGate)) return;

    const nextProps = {
      ...currentProps,
      ...sanitizedProps,
    } as ComponentElementProps;
    const derivedUpdate = createDerivedPropsUpdate(
      currentState,
      elementId,
      nextProps,
    );
    if (!derivedUpdate) return;

    const shouldRecordHistory = Boolean(currentState.currentPageId);
    const prevPropsClone = shouldRecordHistory
      ? cloneForHistory(currentProps)
      : null;
    // canonical update event 는 full merged props 계약 — patch 가 아닌
    // 병합된 전체 props 를 기록해야 undo/redo 가 props 를 소거하지 않는다.
    const mergedNextPropsClone = shouldRecordHistory
      ? cloneForHistory(nextProps)
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

    // 선택된 요소가 업데이트된 경우 selectedElementProps도 업데이트
    const selectedElementProps =
      currentState.selectedElementId === elementId
        ? createCompleteProps(derivedUpdate.element, sanitizedProps)
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

    const projectableChildrenByParent = getProjectableChildrenByParent();
    const canonicalResult = updateCanonicalNodePropsPrimary(
      elementId,
      nextProps as Record<string, unknown>,
      derivedUpdate.element,
    );
    if (!canonicalResult.changed) return;

    // ADR-190: canonical 갱신 직후 ~ set() 직전이 commit lane 의 유일한 진입
    // 시점이다. canonical 이 갱신됐으므로 documentVersion 이 post-commit
    // revision 이고, set() 이 store 구독(StoreRenderBridge resync)을 실행시키기
    // 전이라 그 sync 가 pending commit 을 본다. set() 뒤로 밀리면 sync 는
    // pendingCommit 없이 changedIds 를 소비해 뒤늦은 patch 가 stale 이 된다.
    // 서술 불가한 patch 는 descriptor 가 null 이라 기존 full rebuild 유지.
    emitStoreStyleCommitDescriptor(elementId, patch);

    // updateElementProps는 element 구조(parent_id/page_id/type/variableBindings 등)를
    // 바꾸지 않는다. canonical target/path와 descendant cache를 재투영하지 않고,
    // derived array/map은 기존 순서를 유지한 shallow copy로 갱신한다.
    if (isLayoutChange) {
      const dirtyIds = new Set(currentState.dirtyElementIds);
      markDirtyWithDescendantsUpdate(
        elementId,
        changedStyle,
        projectableChildrenByParent,
        dirtyIds,
      );
      set((state) => ({
        elements: derivedUpdate.elements,
        elementsMap: derivedUpdate.elementsMap,
        selectedElementProps,
        layoutVersion: state.layoutVersion + 1,
        dirtyElementIds: dirtyIds,
      }));
    } else {
      set({
        elements: derivedUpdate.elements,
        elementsMap: derivedUpdate.elementsMap,
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
        globalToast.error("Save failed.", {
          duration: 8000,
          messageKey: "errors.saveFailed",
          action: {
            label: "Undo",
            labelKey: "errors.undo",
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

    const initialCanonicalNode = getFirstProjectableNodeById(elementId);
    if (!initialCanonicalNode) return;
    // 동기 통과(대화상자 불필요) 경로는 await 하지 않는다 — 게이트 주석 참조.
    const originGate = confirmOriginImpactIfNeeded(initialCanonicalNode);
    if (originGate !== true && !(await originGate)) return;

    // origin confirmation만 실제 async 경계다. dialog 대기 중 다른 mutation이
    // 들어올 수 있으므로 승인 뒤 canonical target과 derived cache를 다시 읽는다.
    const state = get();
    const canonicalNode = getFirstProjectableNodeById(elementId);
    if (!canonicalNode) return;
    const derivedUpdate = createDerivedElementUpdate(
      state,
      canonicalNode,
      sanitizedUpdates,
    );
    if (!derivedUpdate) return;

    // props 밖 canonical 필드(`responsive`/`fills`) 변경은 update event 로 undo 되지
    // 않는다 — `replaceNodeProps` 가 props 만 교체하므로 full node 를 실어야 한다.
    // `inspectorActions` 의 Style 패널 경로와 동일 판정 (단일 소스: 아래 helper).
    const hasNonPropsCanonicalChange =
      hasNonPropsCanonicalHistoryChange(sanitizedUpdates);
    const shouldRecordHistory =
      Boolean(state.currentPageId) &&
      (Boolean(sanitizedUpdates.props) || hasNonPropsCanonicalChange);
    const prevPropsClone = shouldRecordHistory
      ? cloneForHistory(canonicalNode.props ?? {})
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
              [derivedUpdate.previousElement],
              [derivedUpdate.element],
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

    const projectableChildrenByParent = getProjectableChildrenByParent();
    const occurrenceCount = getCanonicalNodeOccurrenceCount(elementId);
    const needsFullIndexRebuild = requiresFullDerivedIndexRebuild(
      sanitizedUpdates,
      occurrenceCount,
    );

    if (areCanonicalMutationStoreActionsRegistered()) {
      if (hasCanonicalLocationUpdate(sanitizedUpdates)) {
        syncLocationUpdatedElementToCanonical(
          derivedUpdate.element,
          sanitizedUpdates,
        );
      } else {
        updateCanonicalNodeFromElementPrimary(derivedUpdate.element);
      }
    }

    const selectedElementProps =
      state.selectedElementId === elementId && sanitizedUpdates.props
        ? createCompleteProps(derivedUpdate.element, sanitizedUpdates.props)
        : state.selectedElementProps;

    if (isLayoutChange) {
      const dirtyIds = new Set(state.dirtyElementIds);
      markDirtyWithDescendantsUpdate(
        elementId,
        changedStyle,
        projectableChildrenByParent,
        dirtyIds,
      );
      set((latestState) => ({
        elements: derivedUpdate.elements,
        elementsMap: derivedUpdate.elementsMap,
        selectedElementProps,
        layoutVersion: latestState.layoutVersion + 1,
        dirtyElementIds: dirtyIds,
      }));
    } else {
      set({
        elements: derivedUpdate.elements,
        elementsMap: derivedUpdate.elementsMap,
        selectedElementProps,
      });
    }

    // 구조·소유권·component/variable index 축이 바뀌는 드문 경로만 전체
    // canonical derive를 수행한다. props/customId/responsive/slot/descendants
    // 편집은 위의 array/map 한 행 patch로 끝난다.
    if (needsFullIndexRebuild) get()._rebuildIndexes();

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
        globalToast.error("Save failed.", {
          duration: 8000,
          messageKey: "errors.saveFailed",
          action: {
            label: "Undo",
            labelKey: "errors.undo",
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
 * - canonical target cache + 단일 tree traversal
 * - derived array/map 일괄 patch
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
    const normalizedUpdates = canonicalUpdates.map((update) => ({
      ...update,
      props: sanitizePropsPatch(
        update.props as Record<string, unknown>,
      ) as ComponentElementProps,
    }));

    const preparedUpdates: Array<{
      elementId: string;
      patch: ComponentElementProps;
      prevProps: ComponentElementProps;
      nextProps: ComponentElementProps;
    }> = [];
    const nextPropsById = new Map<string, ComponentElementProps>();
    const duplicateIds = new Set<string>();
    for (const {
      elementId,
      props: rawProps,
      mergeStyle,
    } of normalizedUpdates) {
      const canonicalNode = getFirstProjectableNodeById(elementId);
      if (!canonicalNode) continue;
      const currentProps = (canonicalNode.props ?? {}) as Record<
        string,
        unknown
      >;
      const patch = applyBatchStylePatch(
        currentProps,
        rawProps as Record<string, unknown>,
        mergeStyle,
      ) as ComponentElementProps;
      const nextProps = { ...currentProps, ...patch } as ComponentElementProps;
      preparedUpdates.push({
        elementId,
        patch: rawProps,
        prevProps: cloneForHistory(currentProps) as ComponentElementProps,
        nextProps,
      });
      nextPropsById.set(elementId, nextProps);
      if (getCanonicalNodeOccurrenceCount(elementId) > 1) {
        duplicateIds.add(elementId);
      }
    }
    if (preparedUpdates.length === 0) return;

    const derivedUpdate = createDerivedBatchPropsUpdate(
      state,
      nextPropsById,
      duplicateIds,
    );
    if (!derivedUpdate) return;

    // 선택된 요소 props 업데이트
    const selectedId = state.selectedElementId;
    const selectedElement = selectedId
      ? derivedUpdate.updatedElementMap.get(selectedId)
      : null;
    const selectedProps = selectedElement
      ? createCompleteProps(
          selectedElement,
          nextPropsById.get(selectedElement.id),
        )
      : state.selectedElementProps;

    // ADR-006 P3-1: batch props 변경 시 dirty tracking
    // 업데이트 중 하나라도 레이아웃 영향이 있으면 layoutVersion 증가
    const dirtyIds = new Set(state.dirtyElementIds);
    const childrenByParent = getProjectableChildrenByParent();
    let hasAnyLayoutChange = false;
    for (const { elementId, patch } of preparedUpdates) {
      const changedStyle = (patch.style ?? {}) as Record<string, unknown>;
      const hasStyleChange = Object.keys(changedStyle).length > 0;
      const isLayoutChange = hasStyleChange
        ? isLayoutAffectingUpdate(changedStyle)
        : Object.keys(patch as Record<string, unknown>).some(
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

    // canonical event는 full merged props 계약이다. 사용자-가시 mutation 전에
    // 부모+자식 전체를 한 batch history entry로 동기 기록한다.
    if (state.currentPageId) {
      historyManager.addEntry({
        type: "batch",
        elementId: preparedUpdates[0].elementId,
        elementIds: preparedUpdates.map((update) => update.elementId),
        data: {
          canonicalEvents: preparedUpdates.map((update) =>
            buildCanonicalUpdateEvent(
              update.elementId,
              update.prevProps as Record<string, unknown>,
              cloneForHistory(
                nextPropsById.get(update.elementId) ?? {},
              ) as Record<string, unknown>,
            ),
          ),
        },
      });
    }

    const canonicalResult = updateCanonicalNodePropsBatchPrimary(
      nextPropsById as ReadonlyMap<string, Record<string, unknown>>,
      Array.from(derivedUpdate.updatedElementMap.values()),
    );
    if (!canonicalResult.changed) return;

    // ADR-190 Phase 3: 다중 선택 편집·정렬·드래그가 여기로 모인다. 요소마다
    // 따로 queue 하면 pendingCommit 단일 슬롯이 앞선 patch 를 덮어쓰므로
    // **한 번에** 배열로 넘긴다 (R6).
    emitStoreStyleCommitDescriptors(
      preparedUpdates.map(({ elementId, patch }) => ({
        elementId,
        patch: patch as Record<string, unknown>,
      })),
    );

    if (hasAnyLayoutChange) {
      set((prevState) => ({
        elements: derivedUpdate.elements,
        elementsMap: derivedUpdate.elementsMap,
        selectedElementProps: selectedProps,
        layoutVersion: prevState.layoutVersion + 1,
        dirtyElementIds: dirtyIds,
      }));
    } else {
      set({
        elements: derivedUpdate.elements,
        elementsMap: derivedUpdate.elementsMap,
        selectedElementProps: selectedProps,
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
        globalToast.error("Save failed.", {
          duration: 8000,
          messageKey: "errors.saveFailed",
          action: {
            label: "Undo",
            labelKey: "errors.undo",
            onClick: () => get().undo(),
          },
        });
      }
    })();
  };
