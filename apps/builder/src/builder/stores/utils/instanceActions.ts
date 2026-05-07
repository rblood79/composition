/**
 * G.1 Instance Store Actions
 *
 * Master-Instance 시스템의 스토어 액션.
 * createInstance, detachInstance 등 인스턴스 생명주기 관리.
 *
 * Master propagation은 별도 액션이 불필요:
 * useResolvedElement hook이 elementsMap 변경을 자동 감지하여 리렌더.
 *
 * @see docs/WASM_DOC_IMPACT_ANALYSIS.md §G.1
 */

import { v4 as uuidv4 } from "uuid";
import type { Element } from "../../../types/core/store.types";
import type { ElementsState } from "../elements";
import {
  mergePropsWithStyleDeep,
  resolveInstanceProps,
} from "../../../utils/component/instanceResolver";
import { sortElementsByOrderThenSource } from "../../utils/elementOrdering";
import { historyManager } from "../history";
import { createCompleteProps } from "./elementHelpers";
import { buildIdPathContext } from "../../../adapters/canonical/idPath";
import {
  getEditingSemanticsImpactInstanceIds,
  getEditingSemanticsRole,
} from "../../utils/editingSemantics";
import { requestEditingSemanticsImpactConfirmation } from "../../utils/editingSemanticsImpactConfirmation";
import { getDB } from "../../../lib/db";
import { sanitizeElement } from "../../../adapters/canonical/legacyElementSanitizer";
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
  isComponentOriginMirrorElement,
} from "../../../adapters/canonical/componentSemanticsMirror";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../../adapters/canonical/frameMirror";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { generateCustomId } from "../../utils/idGeneration";

type CanonicalElementFields = {
  children?: unknown;
  [COMPONENT_DESCENDANTS_MIRROR_FIELD]?: Record<string, unknown>;
  metadata?: { type?: string; [key: string]: unknown };
  ref?: unknown;
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

function resolveRefMaster(
  ref: string,
  state: ElementsState,
): Element | undefined {
  const direct = state.elementsMap.get(ref);
  if (direct) return direct;

  const { pathIdMap } = buildIdPathContext(state.elements);
  const pathId = pathIdMap.get(ref);
  if (pathId) return state.elementsMap.get(pathId);

  return state.elements.find(
    (element) => element.customId === ref || element.componentName === ref,
  );
}

function getSortedChildren(state: ElementsState, parentId: string): Element[] {
  return sortElementsByOrderThenSource(state.childrenMap.get(parentId) ?? []);
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

function stripCanonicalRuntimeFields(element: Element): Element {
  const clone = { ...element } as Element & CanonicalElementFields;
  delete clone.children;
  delete clone[COMPONENT_DESCENDANTS_MIRROR_FIELD];
  delete clone.metadata;
  delete clone.ref;
  return clone;
}

function persistElementsAfterInstanceMutation(elements: Element[]): void {
  if (typeof indexedDB === "undefined") return;
  void (async () => {
    try {
      const db = await getDB();
      await db.elements.insertMany(
        elements.map((element) => sanitizeElement(element)),
      );
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
  orderNum: number,
): Element {
  return stripCanonicalRuntimeFields({
    ...fallback,
    id,
    type: typeof override.type === "string" ? override.type : fallback.type,
    parent_id: parentId,
    page_id: pageId ?? null,
    order_num: orderNum,
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
  state: ElementsState,
  refId: string,
  usedIds = new Set(state.elements.map((element) => element.id)),
): { elements: Element[]; previousElements: Element[] } | null {
  const refElement = state.elementsMap.get(refId);
  if (!refElement || refElement.type !== "ref") return null;

  const ref = getCanonicalRef(refElement);
  if (!ref) {
    console.warn("[Instance] canonical ref target not found:", refId);
    return null;
  }

  const master = resolveRefMaster(ref, state);
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
    orderNum: number,
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
        order_num: orderNum,
      } as Element,
      materializedId,
      parentId,
      pageId,
      orderNum,
    );
    createdChildren.push(element);

    getCanonicalChildren(source).forEach((child, index) => {
      materializeCanonicalNode(child, element.id, index);
    });

    return element;
  };

  const materializeChild = (
    source: Element,
    parentId: string,
    relativePath: string,
    orderNum: number,
    activeLegacyDescendantMap:
      | Record<string, unknown>
      | undefined = legacyDescendantMap,
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
    const nestedMaster = nestedRef ? resolveRefMaster(nestedRef, state) : null;
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
            orderNum,
          )
        : {
            ...materializationSource,
            id,
            parent_id: parentId,
            page_id: pageId,
            order_num: orderNum,
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
        : getSortedChildren(state, materializationSource.id);

    childSources.forEach((childSource, index) => {
      if (hasChildrenReplacement && isRecord(childSource)) {
        materializeCanonicalNode(childSource, element.id, index);
        return;
      }

      const childElement = childSource as Element;
      const childSegment =
        childElement.customId ?? childElement.componentName ?? childElement.id;
      const childPath = nestedMaster
        ? childSegment
        : `${relativePath}/${childSegment}`;
      materializeChild(
        childElement,
        element.id,
        childPath,
        index,
        childDescendants,
      );
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
      order_num: refElement.order_num,
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

  getSortedChildren(state, master.id).forEach((child, index) => {
    materializeChild(
      child,
      detachedRoot.id,
      child.customId ?? child.componentName ?? child.id,
      index,
    );
  });

  const nextElements = [detachedRoot, ...createdChildren];

  return {
    elements: nextElements,
    previousElements: [previousState],
  };
}

function buildLegacyDetachSnapshot(
  state: ElementsState,
  instanceId: string,
): { elements: Element[]; previousElements: Element[] } | null {
  const instance = state.elementsMap.get(instanceId);
  if (!instance || !isComponentInstanceMirrorElement(instance)) return null;

  const masterRef = getComponentMasterReference(instance);
  const master = masterRef ? state.elementsMap.get(masterRef) : undefined;

  let mergedProps: Record<string, unknown>;
  if (master) {
    const { props } = resolveInstanceProps(instance, master);
    mergedProps = props;
  } else {
    mergedProps = {
      ...instance.props,
      ...(getComponentOverridesMirror(instance) ?? {}),
    };
  }

  return {
    elements: [
      {
        ...instance,
        props: mergedProps,
        [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
        [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
        [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
        [COMPONENT_DESCENDANTS_MIRROR_FIELD]: undefined,
      },
    ],
    previousElements: [{ ...instance }],
  };
}

function buildDetachSnapshot(
  state: ElementsState,
  instanceId: string,
  usedIds?: Set<string>,
): { elements: Element[]; previousElements: Element[] } | null {
  const instance = state.elementsMap.get(instanceId);
  if (instance?.type === "ref") {
    return buildCanonicalDetachSnapshot(state, instanceId, usedIds);
  }
  return buildLegacyDetachSnapshot(state, instanceId);
}

export function buildDetachSnapshotsForOrigins(
  state: ElementsState,
  origins: Element[],
  excludedElementIds: Set<string> = new Set(),
): { elements: Element[]; previousElements: Element[] } {
  const usedIds = new Set(state.elements.map((element) => element.id));
  const seenInstanceIds = new Set<string>();
  const previousElements: Element[] = [];
  const elements: Element[] = [];

  for (const origin of origins) {
    if (getEditingSemanticsRole(origin) !== "origin") continue;

    const impactedInstanceIds = getEditingSemanticsImpactInstanceIds(
      origin,
      state.elements,
    );
    for (const instanceId of impactedInstanceIds) {
      if (seenInstanceIds.has(instanceId)) continue;
      if (excludedElementIds.has(instanceId)) continue;
      seenInstanceIds.add(instanceId);

      const snapshot = buildDetachSnapshot(state, instanceId, usedIds);
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

  if (state.currentPageId) {
    historyManager.addEntry({
      type: "batch",
      elementId,
      elementIds: nextElements.map((element) => element.id),
      data: {
        prevElements: previousElements,
        elements: nextElements,
      },
    });
  }

  set((prevState) => {
    const removeIds = new Set(nextElements.map((element) => element.id));
    const retained = prevState.elements.filter(
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
  syncInstanceElementsToCanonical(nextElements);
  const persistedElements = nextElements.map(
    (element) => get().elementsMap.get(element.id) ?? element,
  );
  persistElementsAfterInstanceMutation(persistedElements);
}

/**
 * Instance 요소 생성
 *
 * master를 참조하는 새 instance element를 생성한다.
 * props는 비워두고, useResolvedElement가 렌더링 시 master props를 병합.
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
  const state = get();
  const master = state.elementsMap.get(masterRefId);
  if (!master || !isComponentOriginMirrorElement(master)) {
    console.warn("[Instance] master not found or not a master:", masterRefId);
    return null;
  }

  // 다음 order_num 계산
  const siblings = state.childrenMap.get(parentId) || [];
  const maxOrder = siblings.reduce(
    (max, el) => Math.max(max, el.order_num ?? 0),
    0,
  );

  // ADR-116 G5-B P5-B: legacy override write site cleanup — empty Record 를
  // undefined 로 변경, 신규 legacy instance 는 IndexedDB 에 해당 field 자체를
  // 저장하지 않음 (read site 는 isRecord 검사 후 fallback 으로 안전).
  // legacy role 분기 자체는 ADR-111 P3 cleanup 영역.
  const instanceElement: Element = {
    id: uuidv4(),
    type: master.type,
    customId: generateCustomId(master.type, state.elements),
    props: {},
    parent_id: parentId,
    page_id: pageId,
    order_num: maxOrder + 1,
    [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
    [COMPONENT_MASTER_ID_MIRROR_FIELD]: masterRefId,
    [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
    componentName: master.componentName,
  };

  // ADR-040: elements 배열 추가 + 구조 변경이므로 _rebuildIndexes() 필수
  set((prevState) => ({
    elements: [...prevState.elements, instanceElement],
    layoutVersion: prevState.layoutVersion + 1,
  }));
  get()._rebuildIndexes();
  syncInstanceElementsToCanonical([instanceElement]);
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
  const state = get();
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
  elements: Element[],
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
  const initialState = get();
  const element = initialState.elementsMap.get(elementId);
  if (!element) return null;

  const role = getEditingSemanticsRole(element);
  if (role !== "origin") {
    const nextElement: Element = {
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

  const latestState = get();
  const latestElement = latestState.elementsMap.get(elementId);
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

  const nextOrigin: Element = {
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
  const state = get();
  const instance = state.elementsMap.get(instanceId);
  if (!instance || !fieldKey) return null;

  const previousState = { ...instance };
  let nextElement: Element | null = null;

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
    historyManager.addEntry({
      type: "update",
      elementId: instanceId,
      data: {
        element: nextElement,
        prevElement: previousState,
      },
    });
  }

  set((prevState) => {
    const idx = prevState.elements.findIndex((el) => el.id === instanceId);
    const nextElements =
      idx >= 0 ? prevState.elements.with(idx, nextElement) : prevState.elements;
    const nextElementsMap = new Map(prevState.elementsMap);
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
  get()._rebuildIndexes();
  syncInstanceElementsToCanonical([nextElement]);
  const persistedElement = get().elementsMap.get(instanceId) ?? nextElement;
  persistElementsAfterInstanceMutation([persistedElement]);

  return { previousState };
}
