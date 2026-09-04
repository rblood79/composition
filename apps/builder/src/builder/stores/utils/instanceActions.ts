/**
 * G.1 Instance Store Actions
 *
 * Master-Instance 시스템의 스토어 액션.
 * createInstance, detachInstance 등 인스턴스 생명주기 관리.
 *
 * Master propagation은 별도 액션이 불필요:
 * canonical ref/descendants shape를 renderer resolver가 매 render input에서 병합한다.
 *
 * @see docs/WASM_DOC_IMPACT_ANALYSIS.md §G.1
 */

import { v4 as uuidv4 } from "uuid";
import type { Element } from "../../../types/core/store.types";
import type { ElementsState } from "../elements";
import { mergePropsWithStyleDeep } from "../../../utils/component/instanceResolver";
import { historyManager } from "../history";
import {
  buildCanonicalInsertEvents,
  buildCanonicalReplaceEvents,
  captureCanonicalReplaceSources,
} from "../history/canonicalHistoryEvents";
import { createCompleteProps } from "./elementHelpers";
import { buildIdPathContext } from "../../../adapters/canonical/idPath";
import {
  getEditingSemanticsImpactInstanceIds,
  getEditingSemanticsRole,
  isEditingSemanticsOrigin,
} from "../../utils/editingSemantics";
import { requestEditingSemanticsImpactConfirmation } from "../../utils/editingSemanticsImpactConfirmation";
import { getDB } from "../../../lib/db";
import {
  areCanonicalMutationStoreActionsRegistered,
  mergeElementsCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";
import {
  COMPONENT_DESCENDANTS_MIRROR_FIELD,
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_OVERRIDES_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
  getComponentDescendantsMirror,
  getComponentMasterReference,
  getComponentOverridesMirror,
  isComponentInstanceMirrorElement,
} from "../../../adapters/canonical/componentSemanticsMirror";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../../adapters/canonical/frameMirror";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { getActiveCanonicalDocumentElementsView } from "../canonical/canonicalElementsView";
import { generateCustomId } from "../../utils/idGeneration";

type CanonicalElementFields = {
  children?: unknown;
  reusable?: boolean;
  [COMPONENT_ROLE_MIRROR_FIELD]?: "master" | "instance";
  [COMPONENT_MASTER_ID_MIRROR_FIELD]?: string;
  [COMPONENT_OVERRIDES_MIRROR_FIELD]?: Record<string, unknown>;
  [COMPONENT_DESCENDANTS_MIRROR_FIELD]?: Record<string, unknown>;
  metadata?: { type?: string; [key: string]: unknown };
  ref?: unknown;
};

type CanonicalElement = Element & CanonicalElementFields;

const EMPTY_ELEMENTS: Element[] = [];
type InstanceActionSourceState = Omit<ElementsState, "elements"> & {
  elements: readonly Element[];
};

function asCanonicalElement(
  element: Element,
): Element & CanonicalElementFields {
  return element as Element & CanonicalElementFields;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getElementProps(element: Element): Record<string, unknown> {
  return element.props ?? {};
}

function getRootOverrideProps(element: Element): Record<string, unknown> {
  return element.props ?? {};
}

function getCanonicalRef(element: Element): string | null {
  const ref = asCanonicalElement(element).ref;
  return typeof ref === "string" ? ref : null;
}

function removeRecordKey(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
  const { [key]: _removed, ...rest } = record;
  return rest;
}

function hasCanonicalOverridePayload(
  override: Record<string, unknown>,
): boolean {
  if (typeof override.type === "string") return true;
  if (Array.isArray(override.children)) return true;

  return Object.keys(propsFromCanonicalOverride(override)).length > 0;
}

function resetCanonicalOverrideRecordField(
  override: Record<string, unknown>,
  fieldKey: string,
): Record<string, unknown> | null {
  if (isRecord(override.props)) {
    const nextProps = removeRecordKey(override.props, fieldKey);
    if (!nextProps) return null;
    return { ...override, props: nextProps };
  }

  return removeRecordKey(override, fieldKey);
}

function findInstanceActionElement(
  elements: readonly Element[],
  elementId: string | null | undefined,
): Element | undefined {
  if (!elementId) return undefined;
  return elements.find((element) => element.id === elementId);
}

function getInstanceActionSourceElements(): readonly Element[] {
  return getActiveCanonicalDocumentElementsView()?.elements ?? EMPTY_ELEMENTS;
}

function withInstanceActionSourceState(
  state: ElementsState | InstanceActionSourceState,
): InstanceActionSourceState {
  return { ...state, elements: getInstanceActionSourceElements() };
}

function resolveRefMaster(ref: string): Element | undefined {
  const elements = getInstanceActionSourceElements();
  const direct = findInstanceActionElement(elements, ref);
  if (direct) return direct;

  const { pathIdMap } = buildIdPathContext(elements);
  const pathId = pathIdMap.get(ref);
  const pathElement = findInstanceActionElement(elements, pathId);
  if (pathElement) return pathElement;

  return elements.find(
    (element) => element.customId === ref || element.componentName === ref,
  );
}

function getSortedChildren(parentId: string): Element[] {
  return getInstanceActionSourceElements().filter(
    (element) => element.parent_id === parentId,
  );
}

function getComponentNameForElement(element: Element): string {
  return (
    element.componentName ?? element.customId ?? `${element.type} component`
  );
}

function getDescendantOverride(
  legacyOverrideMap: Record<string, unknown> | undefined,
  source: Element,
  relativePath: string,
): Record<string, unknown> | undefined {
  if (!legacyOverrideMap) return undefined;
  const candidates = [
    relativePath,
    source.customId,
    source.componentName,
    source.id,
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    const override = legacyOverrideMap[candidate];
    if (isRecord(override)) return override;
  }
  return undefined;
}

function propsFromCanonicalOverride(
  override: Record<string, unknown>,
): Record<string, unknown> {
  const {
    children: _children,
    [COMPONENT_DESCENDANTS_MIRROR_FIELD]: _legacyOverrideMap,
    id: _id,
    metadata: _metadata,
    name: _name,
    ref: _ref,
    reusable: _reusable,
    type: _type,
    ...props
  } = override;
  return isRecord(override.props) ? override.props : props;
}

function stripCanonicalRuntimeFields(element: CanonicalElement): Element {
  const clone = { ...element } as CanonicalElement;
  delete clone.children;
  delete clone[COMPONENT_DESCENDANTS_MIRROR_FIELD];
  delete clone.metadata;
  delete clone.ref;
  return clone;
}

function persistElementsAfterInstanceMutation(_elements: Element[]): void {
  if (typeof indexedDB === "undefined") return;
  void (async () => {
    try {
      const db = await getDB();
      const canonical = useCanonicalDocumentStore.getState();
      const projectId = canonical.currentProjectId;
      const doc = projectId ? canonical.documents.get(projectId) : null;
      if (projectId && doc) {
        await db.documents.put(projectId, doc);
      }
    } catch (error) {
      console.warn(
        "⚠️ [IndexedDB] instance mutation 저장 중 오류 (메모리는 정상):",
        error,
      );
    }
  })();
}

/**
 * Canonical document 에 instance mutation 결과를 sync.
 *
 * **호출 순서 (현 잔존 패턴, ADR-122 §Residual)**: 본 함수의 caller 3곳
 * (`applyElementSnapshotBatch` / `createInstance` / `resetInstanceOverrideField`)
 * 는 `set` → 본 함수 → `_rebuildIndexes` 순서다. `_rebuildIndexes` 는 canonical
 * 우선 derive (elements.ts:430 `getCanonicalOrStoreElements`) 이므로 본 함수가
 * `_rebuildIndexes` 보다 먼저 호출되는 것은 stale derive race 회피에 필수다 —
 * 회귀: commits a859f8b97 + ee91020c4 가 그 race 만 우회 해소.
 *
 * 다만 이 순서는 ADR-122 HC #2 (`runtime mutation 은 canonical document 를 먼저
 * 갱신`) 의 **canonical 1차 (sync) → set → _rebuildIndexes** 를 충족하지 못하는
 * `set` 1차 잔존이다 (canonical-first invariant 아님). 호출 순서 reverse 정정은
 * history undo/redo + instance master/snapshot 영역 광범위로 회귀 위험 HIGH →
 * 후속 작업 분리. 상세는 `.claude/rules/state-management.md` 의 "Canonical sync
 * 호출 순서" 섹션 + § 잔존 영역 표 참조.
 */
function syncInstanceElementsToCanonical(elements: Element[]): void {
  if (!areCanonicalMutationStoreActionsRegistered()) return;
  mergeElementsCanonicalPrimary(elements);
}

function createMaterializedElementFromOverride(
  override: Record<string, unknown>,
  fallback: Element,
  id: string,
  parentId: string | null,
  pageId: string | null | undefined,
): Element {
  return stripCanonicalRuntimeFields({
    ...fallback,
    id,
    type: typeof override.type === "string" ? override.type : fallback.type,
    parent_id: parentId,
    page_id: pageId ?? null,
    props: propsFromCanonicalOverride(override),
    reusable: undefined,
    [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
    [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
    [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
    [COMPONENT_DESCENDANTS_MIRROR_FIELD]: undefined,
    componentName:
      typeof override.name === "string"
        ? override.name
        : fallback.componentName,
  });
}

function getCanonicalChildren(
  value: Record<string, unknown>,
): Record<string, unknown>[] {
  const children = value.children;
  if (!Array.isArray(children)) return [];
  return children.filter(isRecord);
}

function buildCanonicalDetachSnapshot(
  state: InstanceActionSourceState,
  refId: string,
  usedIds = new Set(
    getInstanceActionSourceElements().map((element) => element.id),
  ),
): { elements: Element[]; previousElements: Element[] } | null {
  const sourceState = withInstanceActionSourceState(state);
  const refElement = findInstanceActionElement(sourceState.elements, refId);
  if (!refElement || refElement.type !== "ref") return null;

  const ref = getCanonicalRef(refElement);
  if (!ref) {
    console.warn("[Instance] canonical ref target not found:", refId);
    return null;
  }

  const master = resolveRefMaster(ref);
  if (!master) {
    console.warn("[Instance] canonical ref master not found:", ref);
    return null;
  }

  const legacyDescendantMap = getComponentDescendantsMirror(refElement);
  const pageId = refElement.page_id ?? master.page_id ?? null;
  const createdChildren: Element[] = [];

  const nextId = (preferredId?: string) => {
    if (preferredId && !usedIds.has(preferredId)) {
      usedIds.add(preferredId);
      return preferredId;
    }
    let id = uuidv4();
    while (usedIds.has(id)) id = uuidv4();
    usedIds.add(id);
    return id;
  };

  const materializeCanonicalNode = (
    source: Record<string, unknown>,
    parentId: string,
  ): Element => {
    const preferredId = typeof source.id === "string" ? source.id : undefined;
    const materializedId = nextId(preferredId);
    const type = typeof source.type === "string" ? source.type : "Box";
    const element = createMaterializedElementFromOverride(
      source,
      {
        id: materializedId,
        type,
        props: {},
        parent_id: parentId,
        page_id: pageId,
      } as Element,
      materializedId,
      parentId,
      pageId,
    );
    createdChildren.push(element);

    getCanonicalChildren(source).forEach((child) => {
      materializeCanonicalNode(child, element.id);
    });

    return element;
  };

  const materializeChild = (
    source: Element,
    parentId: string,
    relativePath: string,
    // 중첩 descendant 재귀는 현재 경로에서 해석한 legacy map을 이어받는다.
    activeLegacyDescendantMap:
      Record<string, unknown> | undefined = legacyDescendantMap,
  ): Element => {
    const override = getDescendantOverride(
      activeLegacyDescendantMap,
      source,
      relativePath,
    );
    const hasReplacement = Boolean(
      override && typeof override.type === "string",
    );
    const hasChildrenReplacement = Boolean(
      override && Array.isArray(override.children) && !hasReplacement,
    );
    if (hasReplacement && Array.isArray(override?.children)) {
      throw new Error(
        `[Instance] canonical slot override at "${relativePath}" violates 3-mode discriminator`,
      );
    }
    const nestedRef = !hasReplacement ? getCanonicalRef(source) : null;
    const nestedMaster = nestedRef ? resolveRefMaster(nestedRef) : null;
    const materializationSource = nestedMaster ?? source;
    const sourceOverrideProps = nestedMaster
      ? getRootOverrideProps(source)
      : {};
    const childDescendants = nestedMaster
      ? getComponentDescendantsMirror(source)
      : activeLegacyDescendantMap;
    const replacementId =
      hasReplacement && typeof override?.id === "string"
        ? override.id
        : undefined;
    const id = nextId(replacementId);
    const baseProps = getElementProps(materializationSource);
    const patchProps =
      override && !hasReplacement && !hasChildrenReplacement
        ? propsFromCanonicalOverride(override)
        : {};
    const mergedProps = mergePropsWithStyleDeep(
      mergePropsWithStyleDeep(baseProps, sourceOverrideProps),
      patchProps,
    );
    const element = stripCanonicalRuntimeFields(
      hasReplacement
        ? createMaterializedElementFromOverride(
            override!,
            source,
            id,
            parentId,
            pageId,
          )
        : {
            ...materializationSource,
            id,
            parent_id: parentId,
            page_id: pageId,
            props: mergedProps,
            reusable: undefined,
            [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
            [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
            [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
            [COMPONENT_DESCENDANTS_MIRROR_FIELD]: undefined,
          },
    );

    createdChildren.push(element);

    const childSources = hasReplacement
      ? []
      : hasChildrenReplacement
        ? ((override!.children as unknown[]) ?? [])
        : getSortedChildren(materializationSource.id);

    childSources.forEach((childSource) => {
      if (hasChildrenReplacement && isRecord(childSource)) {
        materializeCanonicalNode(childSource, element.id);
        return;
      }

      const childElement = childSource as Element;
      const childSegment =
        childElement.customId ?? childElement.componentName ?? childElement.id;
      const childPath = nestedMaster
        ? childSegment
        : `${relativePath}/${childSegment}`;
      materializeChild(childElement, element.id, childPath, childDescendants);
    });

    return element;
  };

  const rootProps = mergePropsWithStyleDeep(
    getElementProps(master),
    getRootOverrideProps(refElement),
  );
  const detachedRoot: Element = withFrameElementMirrorId(
    stripCanonicalRuntimeFields({
      ...master,
      ...refElement,
      id: refElement.id,
      type: master.type,
      parent_id: refElement.parent_id ?? null,
      page_id: refElement.page_id ?? master.page_id ?? null,
      props: rootProps,
      reusable: undefined,
      [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
      [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: undefined,
      componentName: refElement.componentName ?? master.componentName,
    }),
    getFrameElementMirrorId(refElement),
  );
  const previousState = { ...refElement };

  getSortedChildren(master.id).forEach((child) => {
    materializeChild(
      child,
      detachedRoot.id,
      child.customId ?? child.componentName ?? child.id,
    );
  });

  const nextElements = [detachedRoot, ...createdChildren];

  return {
    elements: nextElements,
    previousElements: [previousState],
  };
}

function buildLegacyDetachSnapshot(
  instanceId: string,
): { elements: Element[]; previousElements: Element[] } | null {
  const sourceElements = getInstanceActionSourceElements();
  const instance = findInstanceActionElement(sourceElements, instanceId);
  if (!instance || !isComponentInstanceMirrorElement(instance)) return null;

  const masterRef = getComponentMasterReference(instance);
  const master = findInstanceActionElement(sourceElements, masterRef);

  let mergedProps: Record<string, unknown>;
  if (master) {
    // override 없음 → 빈 객체 (master props 유지). shared-cache 경로의
    // getInstanceOverrides 는 override 부재 시 instance.props 로 대체하므로
    // detach 확정 props 에는 사용하지 않는다.
    mergedProps = mergePropsWithStyleDeep(
      master.props || {},
      getComponentOverridesMirror(instance) ?? {},
    );
  } else {
    mergedProps = {
      ...instance.props,
      ...(getComponentOverridesMirror(instance) ?? {}),
    };
  }

  const detachedInstance: CanonicalElement = {
    ...instance,
    props: mergedProps,
    [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
    [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
    [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
    [COMPONENT_DESCENDANTS_MIRROR_FIELD]: undefined,
  };

  return {
    elements: [detachedInstance],
    previousElements: [{ ...instance }],
  };
}

function buildDetachSnapshot(
  state: ElementsState | InstanceActionSourceState,
  instanceId: string,
  usedIds?: Set<string>,
): { elements: Element[]; previousElements: Element[] } | null {
  const sourceState = withInstanceActionSourceState(state);
  const instance = findInstanceActionElement(sourceState.elements, instanceId);
  if (instance?.type === "ref") {
    return buildCanonicalDetachSnapshot(sourceState, instanceId, usedIds);
  }
  return buildLegacyDetachSnapshot(instanceId);
}

export function buildDetachSnapshotsForOrigins(
  state: ElementsState,
  origins: Element[],
  excludedElementIds: Set<string> = new Set(),
): { elements: Element[]; previousElements: Element[] } {
  const sourceState = withInstanceActionSourceState(state);
  const usedIds = new Set(sourceState.elements.map((element) => element.id));
  const seenInstanceIds = new Set<string>();
  const previousElements: Element[] = [];
  const elements: Element[] = [];

  for (const origin of origins) {
    // reusable 이면 origin 이다 — 다른 컴포넌트의 인스턴스이기도 한 노드
    // (dual) 도 자기 인스턴스를 갖는다. role 로 판정하면 instance 가 먼저 잡혀
    // 이 노드의 인스턴스들이 dangling ref 로 남는다.
    if (!isEditingSemanticsOrigin(origin)) continue;

    const impactedInstanceIds = getEditingSemanticsImpactInstanceIds(
      origin,
      sourceState.elements,
    );
    for (const instanceId of impactedInstanceIds) {
      if (seenInstanceIds.has(instanceId)) continue;
      if (excludedElementIds.has(instanceId)) continue;
      seenInstanceIds.add(instanceId);

      const snapshot = buildDetachSnapshot(sourceState, instanceId, usedIds);
      if (!snapshot) {
        console.warn("[Instance] cannot auto-detach impacted instance:", {
          originId: origin.id,
          instanceId,
        });
        continue;
      }

      previousElements.push(...snapshot.previousElements);
      elements.push(...snapshot.elements);
    }
  }

  return { previousElements, elements };
}

function applyElementSnapshotBatch(
  get: () => ElementsState,
  set: (
    partial:
      | Partial<ElementsState>
      | ((state: ElementsState) => Partial<ElementsState>),
  ) => void,
  elementId: string,
  previousElements: Element[],
  nextElements: Element[],
): void {
  const state = get();

  // ADR-122 HC#2 정합 순서로 재배열 (2026-07-15, §Residual 해소):
  // ① prev 캡처 (pre-mutation) → ② canonical sync 1차 → ③ replace event
  // entry (post-mutation 빌드 — detach 확장 subtree children 포함) → ④ set
  // (legacy mirror 2차) → ⑤ _rebuildIndexes
  const prevCaptures = captureCanonicalReplaceSources(
    previousElements.map((element) => element.id),
  );

  syncInstanceElementsToCanonical(nextElements);

  if (state.currentPageId) {
    historyManager.addEntry({
      type: "batch",
      elementId,
      elementIds: nextElements.map((element) => element.id),
      data: {
        canonicalEvents: buildCanonicalReplaceEvents(
          previousElements,
          nextElements,
          prevCaptures,
        ),
      },
    });
  }

  set((prevState) => {
    const removeIds = new Set(nextElements.map((element) => element.id));
    const sourceElements = getInstanceActionSourceElements();
    const retained = sourceElements.filter(
      (element) => !removeIds.has(element.id),
    );
    const updatedElements = [...retained, ...nextElements];
    const selectedElementProps = prevState.selectedElementId
      ? (() => {
          const selected = nextElements.find(
            (element) => element.id === prevState.selectedElementId,
          );
          return selected
            ? createCompleteProps(selected)
            : prevState.selectedElementProps;
        })()
      : prevState.selectedElementProps;
    return {
      elements: updatedElements,
      selectedElementProps,
      layoutVersion: prevState.layoutVersion + 1,
    };
  });
  get()._rebuildIndexes();
  const sourceElements = getInstanceActionSourceElements();
  const _persistedElements = nextElements.map(
    (element) =>
      findInstanceActionElement(sourceElements, element.id) ?? element,
  );
  persistElementsAfterInstanceMutation(_persistedElements);
}

/**
 * Instance 요소 생성
 *
 * master를 참조하는 새 instance element를 생성한다.
 * props는 비워두고, renderer resolver가 렌더링 시 master props를 병합.
 */
export function createInstance(
  get: () => ElementsState,
  set: (
    partial:
      | Partial<ElementsState>
      | ((state: ElementsState) => Partial<ElementsState>),
  ) => void,
  masterRefId: string,
  parentId: string,
  pageId: string,
): Element | null {
  const state = withInstanceActionSourceState(get());
  const { elements: sourceElements } = state;
  const master = findInstanceActionElement(sourceElements, masterRefId);
  if (!master || getEditingSemanticsRole(master) !== "origin") {
    console.warn("[Instance] master not found or not a master:", masterRefId);
    return null;
  }

  // ADR-116 G5-B P5-B: legacy override write site cleanup — empty Record 를
  // undefined 로 변경, 신규 legacy instance 는 IndexedDB 에 해당 field 자체를
  // 저장하지 않음 (read site 는 isRecord 검사 후 fallback 으로 안전).
  // legacy role 분기 자체는 ADR-111 P3 cleanup 영역.
  const instanceElement: CanonicalElement = {
    id: uuidv4(),
    type: master.type,
    customId: generateCustomId(master.type, sourceElements),
    props: {},
    parent_id: parentId,
    page_id: pageId,
    [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
    [COMPONENT_MASTER_ID_MIRROR_FIELD]: masterRefId,
    [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
    componentName: master.componentName,
  };

  // ADR-040: elements 배열 추가 + 구조 변경이므로 _rebuildIndexes() 필수
  set((prevState) => ({
    elements: [...getInstanceActionSourceElements(), instanceElement],
    layoutVersion: prevState.layoutVersion + 1,
  }));
  // ADR-122 §Residual: set 1차 → sync → _rebuildIndexes (canonical-first 아님,
  // race 회피용 sync 선행) — syncInstanceElementsToCanonical JSDoc 참조
  syncInstanceElementsToCanonical([instanceElement]);
  // 히스토리 — canonical insert event (sync 후 doc 조회 기반 빌드)
  if (state.currentPageId) {
    historyManager.addEntry({
      type: "add",
      elementId: instanceElement.id,
      data: {
        canonicalEvents: buildCanonicalInsertEvents([instanceElement]),
      },
    });
  }
  get()._rebuildIndexes();
  persistElementsAfterInstanceMutation([instanceElement]);

  return instanceElement;
}

/**
 * Instance를 독립 요소로 분리 (Detach)
 *
 * master props + instance patch를 병합하여 독립적인 props를 가진 일반 요소로 변환.
 * legacy instance marker 필드를 모두 제거.
 *
 * @returns detach 이전 상태 (undo 복원용)
 */
export function detachInstance(
  get: () => ElementsState,
  set: (
    partial:
      | Partial<ElementsState>
      | ((state: ElementsState) => Partial<ElementsState>),
  ) => void,
  instanceId: string,
): { previousState: Element } | null {
  const state = withInstanceActionSourceState(get());
  const snapshot = buildDetachSnapshot(state, instanceId);
  if (!snapshot) {
    console.warn("[Instance] element is not an instance:", instanceId);
    return null;
  }

  applyElementSnapshotBatch(
    get,
    set,
    instanceId,
    snapshot.previousElements,
    snapshot.elements,
  );

  return { previousState: snapshot.previousElements[0] };
}

async function confirmOriginToggleImpact(
  origin: Element,
  impactedInstanceIds: string[],
  countDurationMs: number,
): Promise<boolean> {
  if (impactedInstanceIds.length === 0) return true;
  return requestEditingSemanticsImpactConfirmation({
    countDurationMs,
    impactedInstanceIds,
    instanceCount: impactedInstanceIds.length,
    originId: origin.id,
    originLabel: getComponentNameForElement(origin),
  });
}

function measureOriginImpact(
  origin: Element,
  elements: readonly Element[],
): { countDurationMs: number; impactedInstanceIds: string[] } {
  const startedAt = performance.now();
  const impactedInstanceIds = getEditingSemanticsImpactInstanceIds(
    origin,
    elements,
  );
  return {
    countDurationMs: performance.now() - startedAt,
    impactedInstanceIds,
  };
}

export async function toggleComponentOrigin(
  get: () => ElementsState,
  set: (
    partial:
      | Partial<ElementsState>
      | ((state: ElementsState) => Partial<ElementsState>),
  ) => void,
  elementId: string,
  options: { beforeMutation?: () => void | Promise<void> } = {},
): Promise<{ elements: Element[]; previousElements: Element[] } | null> {
  const initialState = withInstanceActionSourceState(get());
  const element = findInstanceActionElement(initialState.elements, elementId);
  if (!element) return null;

  // 판정 축은 `reusable` 하나 — 인스턴스이면서 동시에 재사용 원본인 노드는
  // 여기서 원본 해제로 들어가야 한다 (role 판정 시 instance 가 먼저 잡혀
  // "다시 reusable 로 만들기" 로 되돌아가 해제 자체가 불가능했다).
  if (!isEditingSemanticsOrigin(element)) {
    const nextElement: CanonicalElement = {
      ...element,
      componentName: getComponentNameForElement(element),
      reusable: true,
    };
    applyElementSnapshotBatch(get, set, elementId, [element], [nextElement]);
    return { previousElements: [element], elements: [nextElement] };
  }

  const t0Impact = measureOriginImpact(element, initialState.elements);
  const t0Confirmed = await confirmOriginToggleImpact(
    element,
    t0Impact.impactedInstanceIds,
    t0Impact.countDurationMs,
  );
  if (!t0Confirmed) return null;

  await options.beforeMutation?.();

  const latestState = withInstanceActionSourceState(get());
  const latestElement = findInstanceActionElement(
    latestState.elements,
    elementId,
  );
  if (!latestElement) return null;
  const t1Impact = measureOriginImpact(latestElement, latestState.elements);
  const impactChanged =
    t1Impact.impactedInstanceIds.length !==
      t0Impact.impactedInstanceIds.length ||
    t1Impact.impactedInstanceIds.some(
      (id, index) => id !== t0Impact.impactedInstanceIds[index],
    );

  if (impactChanged) {
    const t1Confirmed = await confirmOriginToggleImpact(
      latestElement,
      t1Impact.impactedInstanceIds,
      t1Impact.countDurationMs,
    );
    if (!t1Confirmed) return null;
  }

  const nextOrigin: CanonicalElement = {
    ...latestElement,
    [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
    reusable: false,
  };
  const usedIds = new Set(latestState.elements.map((current) => current.id));
  const previousElements: Element[] = [latestElement];
  const nextElements: Element[] = [nextOrigin];

  for (const instanceId of t1Impact.impactedInstanceIds) {
    const snapshot = buildDetachSnapshot(latestState, instanceId, usedIds);
    if (!snapshot) {
      console.warn("[Instance] cannot detach impacted instance:", instanceId);
      return null;
    }
    previousElements.push(...snapshot.previousElements);
    nextElements.push(...snapshot.elements);
  }

  applyElementSnapshotBatch(
    get,
    set,
    elementId,
    previousElements,
    nextElements,
  );
  return { previousElements, elements: nextElements };
}

/**
 * Instance override 필드를 제거한다.
 *
 * legacy instance는 root patch, canonical ref는 `props`를 root override
 * 저장소로 사용한다. canonical child override는
 * `descendantPath`가 지정된 경우 slot path 단위로 제거한다.
 */
export function resetInstanceOverrideField(
  get: () => ElementsState,
  set: (
    partial:
      | Partial<ElementsState>
      | ((state: ElementsState) => Partial<ElementsState>),
  ) => void,
  instanceId: string,
  fieldKey: string,
  descendantPath?: string,
): { previousState: Element } | null {
  const state = withInstanceActionSourceState(get());
  const { elements: sourceElements } = state;
  const instance = findInstanceActionElement(sourceElements, instanceId);
  if (!instance || !fieldKey) return null;

  const previousState = { ...instance };
  let nextElement: CanonicalElement | null = null;

  if (descendantPath && instance.type === "ref") {
    const legacyDescendantMap = getComponentDescendantsMirror(instance);
    const targetOverride = legacyDescendantMap?.[descendantPath];
    if (!isRecord(legacyDescendantMap) || !isRecord(targetOverride))
      return null;

    const nextOverride = resetCanonicalOverrideRecordField(
      targetOverride,
      fieldKey,
    );
    if (!nextOverride) return null;

    const nextLegacyDescendantMap = { ...legacyDescendantMap };
    if (hasCanonicalOverridePayload(nextOverride)) {
      nextLegacyDescendantMap[descendantPath] = nextOverride;
    } else {
      delete nextLegacyDescendantMap[descendantPath];
    }

    nextElement = {
      ...instance,
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: nextLegacyDescendantMap,
    } as Element;
  } else if (isComponentInstanceMirrorElement(instance)) {
    const overridePatch = getComponentOverridesMirror(instance) ?? {};
    const nextOverridePatch = removeRecordKey(overridePatch, fieldKey);
    if (!nextOverridePatch) return null;
    nextElement = {
      ...instance,
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: nextOverridePatch,
    };
  } else if (instance.type === "ref") {
    const props = instance.props ?? {};
    const nextProps = removeRecordKey(props, fieldKey);
    if (!nextProps) return null;
    nextElement = {
      ...instance,
      props: nextProps,
    };
  }

  if (!nextElement) return null;

  if (state.selectedElementId === instanceId) {
    state._cancelHydrateSelectedProps();
  }

  if (state.currentPageId) {
    // replace event 쌍 (pre-mutation 모드) — override/descendants mirror field
    // 변경은 props update event 로 표현 불가. canonical sync (아래
    // syncInstanceElementsToCanonical) 전 호출이므로 prev 는 현재 doc 에서,
    // next 는 nextElement 로부터 빌드된다.
    historyManager.addEntry({
      type: "update",
      elementId: instanceId,
      data: {
        canonicalEvents: buildCanonicalReplaceEvents(
          [previousState],
          [nextElement],
        ),
      },
    });
  }

  set((prevState) => {
    const sourceElements = getInstanceActionSourceElements();
    const idx = sourceElements.findIndex((el) => el.id === instanceId);
    const nextElements =
      idx >= 0 ? sourceElements.with(idx, nextElement) : [...sourceElements];
    const nextElementsMap = new Map(
      nextElements.map((element) => [element.id, element]),
    );
    nextElementsMap.set(instanceId, nextElement);
    return {
      elements: nextElements,
      elementsMap: nextElementsMap,
      selectedElementProps:
        prevState.selectedElementId === instanceId
          ? createCompleteProps(nextElement)
          : prevState.selectedElementProps,
      layoutVersion: prevState.layoutVersion + 1,
    };
  });
  // ADR-122 §Residual: set 1차 → sync → _rebuildIndexes (canonical-first 아님,
  // race 회피용 sync 선행) — syncInstanceElementsToCanonical JSDoc 참조
  syncInstanceElementsToCanonical([nextElement]);
  get()._rebuildIndexes();
  const persistedSourceElements = getInstanceActionSourceElements();
  const _persistedElement =
    findInstanceActionElement(persistedSourceElements, instanceId) ??
    nextElement;
  persistElementsAfterInstanceMutation([_persistedElement]);

  return { previousState };
}
