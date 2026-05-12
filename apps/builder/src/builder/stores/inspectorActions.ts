/**
 * Inspector Actions Slice
 *
 * Single Source of Truth: Inspector Store 제거 후 Builder Store에서 직접 관리
 *
 * 기존 Inspector Store의 액션들을 Builder Store로 통합:
 * - updateInlineStyle, updateInlineStyles
 * - updateProperty, updateProperties
 * - updateCustomId
 * - updateDataBinding
 * - updateEvents, addEvent, updateEvent, removeEvent
 */

import { StateCreator } from "zustand";
import type {
  Element,
  ComponentElementProps,
} from "../../types/core/store.types";
import type {
  SelectedElement,
  DataBinding,
  EventHandler,
} from "../inspector/types";
import type { ElementEvent } from "../../types/events/events.types";
import type { FillItem } from "../../types/builder/fill.types";
import { sanitizeFillDerivedStylePatch } from "../panels/styles/utils/fillDerivedStyleProps";
import { saveService } from "../../services/save";
import { getDB } from "../../lib/db";
import { getElementDataBinding } from "../../adapters/canonical/compositionExtensionFields";
import {
  migrateLegacyDataBindingToRootData,
  migrateLegacyEventsToRootEvents,
} from "../../adapters/canonical/rootCollectionMigration";
import {
  COMPONENT_DESCENDANTS_MIRROR_FIELD,
  COMPONENT_OVERRIDES_MIRROR_FIELD,
  getComponentDescendantsMirror,
  getComponentOverridesMirror,
  isComponentInstanceMirrorElement,
} from "../../adapters/canonical/componentSemanticsMirror";
import {
  isCanonicalRefElement,
  resolveCanonicalRefElement,
} from "../utils/canonicalRefResolution";
import {
  areCanonicalMutationStoreActionsRegistered,
  mergeElementsCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";
import { historyManager } from "./history";
import { useCanonicalDocumentStore } from "./canonical/canonicalDocumentStore";
import { visitCanonicalDocumentElements } from "./canonical/canonicalElementsView";
import { normalizeElementTags } from "./utils/elementTagNormalizer";
import type { BatchPropsUpdate } from "./utils/elementUpdate";
import {
  collectDirtyElementSubtree,
  LAYOUT_AFFECTING_PROP_KEYS,
} from "./utils/layoutInvalidation";
import { mergePropsWithStyleDeep } from "../../adapters/canonical/instanceResolver";

// CSS shorthand → longhand 분배 매핑 (inspectorActions 공용).
// React inline style shorthand+longhand 공존 시 rerender 경고 + Taffy
// applyCommonTaffyStyle 순서 (gap → rowGap/columnGap) 로 longhand override
// 발생 → Panel 편집 무시. store 는 longhand only 정책.
const SHORTHAND_TO_LONGHAND: Record<string, readonly string[]> = {
  gap: ["rowGap", "columnGap"],
  padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  margin: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
};
type InspectorElementMap<TElement extends Element = Element> = Map<
  string,
  TElement
>;
type InspectorChildrenMap<TElement extends Element = Element> = Map<
  string,
  TElement[]
>;

function distributeShorthand(
  style: Record<string, unknown>,
  property: string,
): void {
  const longhands = SHORTHAND_TO_LONGHAND[property];
  if (!longhands) return;
  const value = style[property];
  delete style[property];
  for (const lh of longhands) {
    if (value === undefined) delete style[lh];
    else style[lh] = value;
  }
}

function sanitizeInspectorProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const nextProps = { ...props };
  const rawStyle = nextProps.style;
  if (rawStyle && typeof rawStyle === "object" && !Array.isArray(rawStyle)) {
    nextProps.style = sanitizeFillDerivedStylePatch(
      rawStyle as Record<string, unknown>,
      true,
    );
  }
  return nextProps;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function syncInspectorElementToCanonical(element: Element): void {
  if (!areCanonicalMutationStoreActionsRegistered()) return;
  mergeElementsCanonicalPrimary([element]);
}

function getResolvedInspectorElement(
  element: Element,
  elements: Iterable<Element>,
): Element {
  return isCanonicalRefElement(element)
    ? resolveCanonicalRefElement(element, elements)
    : element;
}

function getInspectorLookupElements(
  fallbackElements: Iterable<Element> = [],
): Iterable<Element> {
  const canonicalElements = getActiveCanonicalInspectorElements();
  return canonicalElements ?? fallbackElements;
}

function getInspectorElementById(
  elements: Iterable<Element>,
  elementId: string,
): Element | null {
  const canonicalElements = getActiveCanonicalInspectorElements();
  if (canonicalElements) {
    return (
      canonicalElements.find((element) => element.id === elementId) ?? null
    );
  }

  for (const element of elements) {
    if (element.id === elementId) return element;
  }
  return null;
}

function getActiveCanonicalInspectorElements(): Element[] | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;
  const doc = canonical.documents.get(projectId);
  if (!doc) return null;

  const elements: Element[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  return elements;
}

function buildInspectorElementMap<TElement extends Element>(
  elements: Iterable<TElement>,
): InspectorElementMap<TElement> {
  const map: InspectorElementMap<TElement> = new Map();
  for (const element of elements) {
    map.set(element.id, element);
  }
  return map;
}

function replaceInspectorElement(
  elements: readonly Element[],
  elementId: string,
  updatedElement: Element,
): Element[] {
  const elementIndex = elements.findIndex(
    (element) => element.id === elementId,
  );
  if (elementIndex === -1) return [...elements, updatedElement];

  const nextElements = elements.slice();
  nextElements[elementIndex] = updatedElement;
  return nextElements;
}

function buildInspectorChildrenByParent<TElement extends Element>(
  elements: Iterable<TElement>,
): InspectorChildrenMap<TElement> {
  const childrenByParent: InspectorChildrenMap<TElement> = new Map();
  for (const element of elements) {
    const parentId = element.parent_id || "root";
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(element);
    childrenByParent.set(parentId, siblings);
  }
  return childrenByParent;
}

function getInspectorWritableProps(element: Element): Record<string, unknown> {
  if (isComponentInstanceMirrorElement(element)) {
    return getComponentOverridesMirror(element) ?? {};
  }
  return (element.props ?? {}) as Record<string, unknown>;
}

function buildInspectorUpdatedElement(
  element: Element,
  props: Record<string, unknown>,
  additionalUpdates?: Partial<Element>,
): Element {
  if (isComponentInstanceMirrorElement(element)) {
    return {
      ...element,
      ...additionalUpdates,
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: props,
    } as Element;
  }

  return {
    ...element,
    props,
    ...additionalUpdates,
  };
}

function isInspectorInstanceElement(element: Element): boolean {
  return (
    isComponentInstanceMirrorElement(element) || isCanonicalRefElement(element)
  );
}

function getSyntheticDescendantPath(
  rootElementId: string,
  childElementId: string,
): string | null {
  const prefix = `${rootElementId}/`;
  if (!childElementId.startsWith(prefix)) return null;
  const path = childElementId.slice(prefix.length);
  return path.length > 0 ? path : null;
}

function buildInstanceDescendantPatches(
  element: Element,
  childUpdates: BatchPropsUpdate[],
): Record<string, Record<string, unknown>> | null {
  if (!isInspectorInstanceElement(element)) return null;

  const current = getComponentDescendantsMirror(element) ?? {};
  const next: Record<string, Record<string, unknown>> = { ...current };
  let hasMappedChildPatch = false;

  for (const update of childUpdates) {
    const descendantPath = getSyntheticDescendantPath(
      element.id,
      update.elementId,
    );
    if (!descendantPath) continue;

    const previousPatch = isRecord(next[descendantPath])
      ? next[descendantPath]
      : {};
    next[descendantPath] = mergePropsWithStyleDeep(
      previousPatch,
      update.props as Record<string, unknown>,
    );
    hasMappedChildPatch = true;
  }

  return hasMappedChildPatch ? next : null;
}

function getSelectedPropsForState(
  updatedElement: Element,
  lookupElements: Iterable<Element>,
  fallbackProps: Record<string, unknown>,
): Record<string, unknown> {
  const resolved = getResolvedInspectorElement(updatedElement, lookupElements);
  return (resolved.props ?? fallbackProps) as Record<string, unknown>;
}

/**
 * ADR-131 Phase 4 — root collection sync helper.
 *
 * Inspector mutation 직후 canonical document `events` / `actions` / `data`
 * root collection 에 동일 변경을 sync. legacy Element.events / dataBinding 도
 * 유지 (dual-write — preview/Skia 가 legacy 경로로 read).
 *
 * dev data 0 가정 — 신규 input 가 root collection 의 primary SSOT 가 됨.
 * Phase 6 cleanup 시점에 legacy field 자체를 제거하고 root collection 단일
 * SSOT 전환.
 */
function syncEventsToRootCollection(
  elementId: string,
  events: readonly unknown[] | undefined,
): void {
  const store = useCanonicalDocumentStore.getState();
  if (!store.currentProjectId) return;

  // 1) 이 element 가 target 인 기존 events 제거 (clean slate)
  const doc = store.getDocument(store.currentProjectId);
  const existingEvents = doc?.events ?? [];
  const filteredEvents = existingEvents.filter((e) => e.target !== elementId);

  // 2) 이 element 의 events 가 actions chain 참조하던 것 제거
  const existingActions = doc?.actions ?? [];
  const eventsForThisElement = existingEvents.filter(
    (e) => e.target === elementId,
  );
  const refIds = new Set<string>();
  for (const ev of eventsForThisElement) {
    if (ev.actionRef) refIds.add(ev.actionRef);
    if (ev.fallbackActionRef) refIds.add(ev.fallbackActionRef);
  }
  // chain follow — visited set 로 DAG 안전
  const visited = new Set<string>();
  const queue = [...refIds];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const action = existingActions.find((a) => a.id === cur);
    if (action?.next) queue.push(...action.next);
  }
  const filteredActions = existingActions.filter((a) => !visited.has(a.id));

  // 3) 신규 events 변환
  const eventArr = Array.isArray(events) ? events : [];
  const result = migrateLegacyEventsToRootEvents(
    elementId,
    eventArr as Parameters<typeof migrateLegacyEventsToRootEvents>[1],
  );

  const nextEvents = [...filteredEvents, ...result.events];
  const nextActions = [...filteredActions, ...result.actions];

  store.setEvents(nextEvents.length > 0 ? nextEvents : undefined);
  store.setActions(nextActions.length > 0 ? nextActions : undefined);
}

function syncDataBindingToRootCollection(
  elementId: string,
  dataBinding: Element["dataBinding"] | null,
): void {
  const store = useCanonicalDocumentStore.getState();
  if (!store.currentProjectId) return;

  const expectedId = `db_${elementId}`;

  if (!dataBinding) {
    // removal
    const existing = store
      .getDocument(store.currentProjectId)
      ?.data?.some((d) => d.id === expectedId);
    if (existing) store.removeData(expectedId);
    return;
  }

  const next = migrateLegacyDataBindingToRootData(elementId, dataBinding);
  if (!next) return;

  const exists = store
    .getDocument(store.currentProjectId)
    ?.data?.some((d) => d.id === expectedId);
  if (exists) {
    store.updateData(expectedId, next);
  } else {
    store.addData(next);
  }
}

function buildInspectorPersistencePayload(
  element: Element,
  props: Record<string, unknown>,
  additionalUpdates?: Partial<Element>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = isComponentInstanceMirrorElement(
    element,
  )
    ? {
        props: element.props ?? {},
        [COMPONENT_OVERRIDES_MIRROR_FIELD]: props,
      }
    : { props };

  if (additionalUpdates?.customId !== undefined) {
    payload.custom_id = additionalUpdates.customId;
  }
  if (additionalUpdates?.dataBinding !== undefined) {
    payload.data_binding = additionalUpdates.dataBinding;
  }
  if (additionalUpdates?.fills !== undefined) {
    payload.fills = additionalUpdates.fills;
  }
  const mirrorDescendantPatches = (
    additionalUpdates as
      | Record<typeof COMPONENT_DESCENDANTS_MIRROR_FIELD, unknown>
      | undefined
  )?.[COMPONENT_DESCENDANTS_MIRROR_FIELD];
  if (mirrorDescendantPatches !== undefined) {
    payload[COMPONENT_DESCENDANTS_MIRROR_FIELD] = mirrorDescendantPatches;
  }

  return payload;
}

async function persistActiveCanonicalDocument(): Promise<void> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return;
  const doc = canonical.documents.get(projectId);
  if (!doc) return;
  const db = await getDB();
  await db.documents.put(projectId, doc);

  // ADR-131 Phase 7 — fan-out to dedicated IndexedDB stores so DevTools 표시가
  // design_themes / variables / data_tables / api_endpoints / transformers
  // 와 동일하게 events / data / actions 도 별 store entries 로 보인다.
  // dev data 0 가정 — full-set replacement (project 별 기존 row 삭제 후 재기록).
  await syncRootCollectionsToIndexedDB(projectId, doc);
}

async function syncRootCollectionsToIndexedDB(
  projectId: string,
  doc: import("@composition/shared").CompositionDocument,
): Promise<void> {
  const db = await getDB();

  // Events
  const existingEvents = await db.events.getByProject(projectId);
  await Promise.all(existingEvents.map((e) => db.events.delete(e.id)));
  for (const ev of doc.events ?? []) {
    await db.events.insert({ ...ev, project_id: projectId });
  }

  // Data
  const existingData = await db.data.getByProject(projectId);
  await Promise.all(existingData.map((d) => db.data.delete(d.id)));
  for (const d of doc.data ?? []) {
    await db.data.insert({ ...d, project_id: projectId });
  }

  // Actions
  const existingActions = await db.actions.getByProject(projectId);
  await Promise.all(existingActions.map((a) => db.actions.delete(a.id)));
  for (const a of doc.actions ?? []) {
    await db.actions.insert({ ...a, project_id: projectId });
  }
}

// ============================================
// Types
// ============================================

export interface InspectorActionsState {
  // Selected element in SelectedElement format (derived from elementsMap)
  // Note: This is computed from selectedElementId + elementsMap, not stored separately

  // Actions for updating selected element
  updateSelectedStyle: (property: string, value: string) => void;
  updateSelectedStyles: (styles: Record<string, string>) => void;
  /** 실시간 프리뷰: 히스토리/DB 저장 없이 캔버스만 업데이트 */
  updateSelectedStylePreview: (property: string, value: string) => void;
  updateSelectedProperty: (key: string, value: unknown) => void;
  updateSelectedProperties: (properties: Record<string, unknown>) => void;
  /** 부모+자식 props를 단일 batch 히스토리로 atomic 업데이트 (Child Composition Pattern) */
  updateSelectedPropertiesWithChildren: (
    properties: Record<string, unknown>,
    childUpdates: BatchPropsUpdate[],
  ) => void;
  updateSelectedCustomId: (customId: string) => void;
  updateSelectedDataBinding: (dataBinding: DataBinding | undefined) => void;
  updateSelectedEvents: (events: EventHandler[]) => void;
  addSelectedEvent: (event: EventHandler) => void;
  updateSelectedEvent: (id: string, event: EventHandler) => void;
  removeSelectedEvent: (id: string) => void;
  // Fill Actions (Color Picker Phase 1)
  /** fills 배열 업데이트 + style.backgroundColor 동기화 + 히스토리/DB 저장 */
  updateSelectedFills: (fills: FillItem[]) => void;
  /** fills 실시간 프리뷰: 히스토리/DB 저장 없이 캔버스만 업데이트 */
  updateSelectedFillsPreview: (fills: FillItem[]) => void;
  /** fills 경량 프리뷰: CSS 변환 없이 fills만 업데이트 (드래그 전용) */
  updateSelectedFillsPreviewLightweight: (fills: FillItem[]) => void;

  // ComputedStyle은 DB 저장 없이 메모리만 업데이트 (런타임 값)
  updateSelectedComputedStyle: (computedStyle: Record<string, string>) => void;
}

// Required state from other slices
interface RequiredState {
  selectedElementId: string | null;
  elementsMap: InspectorElementMap;
  elements: Element[];
  childrenMap: InspectorChildrenMap;
  layoutVersion: number;
  dirtyElementIds: Set<string>;
  currentPageId: string | null;
  updateElement: (
    elementId: string,
    updates: Partial<Element>,
  ) => Promise<void>;
  _rebuildIndexes: () => void;
  _cancelHydrateSelectedProps: () => void;
  batchUpdateElementProps: (updates: BatchPropsUpdate[]) => Promise<void>;
}

type CombinedState = InspectorActionsState & RequiredState;

// ============================================
// Slice Creator
// ============================================

export const createInspectorActionsSlice: StateCreator<
  CombinedState,
  [],
  [],
  InspectorActionsState
> = (set, get) => {
  /**
   * 프리뷰 전 원본 요소 스냅샷
   * - 타이핑 중 프리뷰가 elementsMap을 수정하므로,
   *   커밋 시 정확한 prevProps를 히스토리에 기록하기 위해 원본 보관
   * - state가 아닌 closure 변수로 관리 (불필요한 리렌더링 방지)
   */
  let prePreviewElement: Element | null = null;

  /**
   * Helper: Get current selected element
   */
  const getSelectedElement = (): Element | null => {
    const { selectedElementId, elements } = get();
    if (!selectedElementId) return null;
    return getInspectorElementById(elements, selectedElementId);
  };

  /**
   * Helper: Update element and save to DB
   *
   * 🚀 Performance Optimization:
   * - elementsMap 직접 업데이트 (O(1))
   * - props/style 변경 시 _rebuildIndexes 스킵 (구조 변경 없음)
   * - 단일 set() 호출로 배칭
   */
  const updateAndSave = async (
    elementId: string,
    propsUpdate: Partial<ComponentElementProps>,
    additionalUpdates?: Partial<Element>,
    /** 프리뷰 → 커밋 시 히스토리 정확성을 위한 원본 요소 */
    prevElementOverride?: Element,
  ) => {
    const { elements, selectedElementId, currentPageId } = get();
    const canonicalElements = getActiveCanonicalInspectorElements();
    const normalizedState = normalizeElementTags(canonicalElements ?? elements);
    let normalizedElements = normalizedState.elements;
    let baseElementsMap = buildInspectorElementMap(normalizedElements);

    let element = baseElementsMap.get(elementId);
    if (!element) return;

    // 선택된 요소의 props를 직접 업데이트하므로,
    // 진행 중인 hydration이 있으면 취소하여 경쟁 상태 방지
    if (selectedElementId === elementId) {
      get()._cancelHydrateSelectedProps();
    }

    // 🚀 히스토리 저장을 위한 이전 상태 캡처
    // prevElementOverride가 있으면 프리뷰 전 원본 사용 (정확한 undo/redo)
    const historyBase = prevElementOverride || element;
    const prevProps = structuredClone(getInspectorWritableProps(historyBase));
    const prevElement = structuredClone(historyBase);

    const newProps = {
      ...getInspectorWritableProps(element),
      ...propsUpdate,
    };

    const updatedElement = buildInspectorUpdatedElement(
      element,
      newProps,
      additionalUpdates,
    );

    // 🚀 히스토리 엔트리 추가 (props 변경 시)
    if (currentPageId && Object.keys(propsUpdate).length > 0) {
      const historyData = isComponentInstanceMirrorElement(element)
        ? {
            prevElement,
            element: structuredClone(updatedElement),
          }
        : {
            prevProps,
            props: structuredClone(newProps),
            prevElement,
          };
      historyManager.addEntry({
        type: "update",
        elementId: elementId,
        data: historyData,
      });
    }

    // 🚀 O(1) Map 업데이트 (새 Map 생성으로 불변성 유지)
    const newElementsMap = new Map(baseElementsMap);
    newElementsMap.set(elementId, updatedElement);

    // 🚀 elements 배열도 업데이트 (findIndex로 위치 찾아서 직접 교체)
    const elementIndex = normalizedElements.findIndex(
      (el) => el.id === elementId,
    );
    let newElements = normalizedElements;
    if (elementIndex !== -1) {
      newElements = [...normalizedElements];
      newElements[elementIndex] = updatedElement;
    }

    // 🚀 단일 set() 호출 - 배칭으로 리렌더링 최소화
    // ADR-006 P3-1: 레이아웃 영향 prop 변경 시 layoutVersion 증가 → fullTreeLayoutMap 재계산 트리거
    // style 변경 외에도 size, label, children, text 등 레이아웃에 영향을 미치는 prop 포함
    const hasLayoutChange = Object.keys(propsUpdate).some((key) =>
      LAYOUT_AFFECTING_PROP_KEYS.has(key),
    );
    set((prevState) => {
      const stateUpdate: Partial<CombinedState> = {
        elements: newElements,
        elementsMap: newElementsMap,
      };

      // selectedElementProps 동시 업데이트
      if (selectedElementId === elementId) {
        (stateUpdate as Record<string, unknown>).selectedElementProps =
          getSelectedPropsForState(
            updatedElement,
            newElementsMap.values(),
            newProps,
          );
      }

      // 레이아웃 영향 prop 변경 시 layoutVersion 증가 + dirtyElementIds 갱신
      // dirtyElementIds: 변경 요소 + 하위 자식 전체 등록 (delegation prop이 자식 레이아웃에 영향)
      if (hasLayoutChange) {
        const dirtyIds = new Set(prevState.dirtyElementIds);
        collectDirtyElementSubtree(
          elementId,
          buildInspectorChildrenByParent(prevState.elements),
          dirtyIds,
        );
        (stateUpdate as Record<string, unknown>).layoutVersion =
          prevState.layoutVersion + 1;
        (stateUpdate as Record<string, unknown>).dirtyElementIds = dirtyIds;
      }

      return stateUpdate;
    });

    // ⚠️ 구조 변경(parent_id, 추가/삭제) 시에만 인덱스 재구축
    // props/style 변경은 구조 변경이 아니므로 스킵
    // (childrenMap, pageIndex는 parent_id 기반이므로 영향 없음)
    syncInspectorElementToCanonical(updatedElement);

    // DB 저장 (비동기, idle callback)
    const runDbSync = async () => {
      try {
        const payload = buildInspectorPersistencePayload(
          element,
          newProps,
          additionalUpdates,
        );

        if (useCanonicalDocumentStore.getState().currentProjectId) {
          await persistActiveCanonicalDocument();
        } else {
          await saveService.savePropertyChange(
            {
              table: "elements",
              id: elementId,
              data: payload,
            },
            {
              source: "inspector",
              allowPreviewSaves: true,
              validateSerialization: true,
            },
          );
        }
      } catch (error) {
        console.error("❌ Inspector action DB save failed:", error);
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => runDbSync(), { timeout: 16 });
    } else {
      setTimeout(() => runDbSync(), 0);
    }
  };

  return {
    // ============================================
    // Style Actions
    // ============================================

    updateSelectedStyle: (property, value) => {
      const element = getSelectedElement();
      if (!element) return;

      // 프리뷰 상태에서 커밋 시, 원본 요소의 style을 기반으로 변경
      const savedPrePreview = prePreviewElement;
      prePreviewElement = null;

      const baseElement =
        savedPrePreview && savedPrePreview.id === element.id
          ? savedPrePreview
          : element;
      const resolvedBaseElement = getResolvedInspectorElement(
        baseElement,
        getInspectorLookupElements(),
      );
      const currentStyle = {
        ...((resolvedBaseElement.props?.style as Record<string, string>) || {}),
      };

      const NUMERIC_STYLE_PROPS = new Set([
        "fontSize",
        "fontWeight",
        "lineHeight",
        "letterSpacing",
        "opacity",
        "padding",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "gap",
        "rowGap",
        "columnGap",
        "borderWidth",
        "borderRadius",
      ]);

      if (value === "" || value === null || value === undefined) {
        delete currentStyle[property];
      } else {
        // Canvas spec shapes는 fontSize/fontWeight 등을 숫자로 기대
        // '10px' → 10, '14' → 14 등 순수 숫자 CSS 속성은 숫자로 변환
        if (NUMERIC_STYLE_PROPS.has(property)) {
          const num = parseFloat(value);
          (currentStyle as Record<string, unknown>)[property] = !isNaN(num)
            ? num
            : value;
        } else {
          currentStyle[property] = value;
        }
      }

      distributeShorthand(currentStyle as Record<string, unknown>, property);

      updateAndSave(
        element.id,
        { style: currentStyle },
        undefined,
        savedPrePreview && savedPrePreview.id === element.id
          ? savedPrePreview
          : undefined,
      );
    },

    updateSelectedStylePreview: (property, value) => {
      const { elements, selectedElementId } = get();
      if (!selectedElementId) return;

      const element = getInspectorElementById(elements, selectedElementId);
      if (!element) return;

      // 첫 프리뷰 시 원본 요소 스냅샷 저장 (히스토리 정확성)
      if (!prePreviewElement || prePreviewElement.id !== selectedElementId) {
        prePreviewElement = structuredClone(element);
      }

      const resolvedElement = getResolvedInspectorElement(
        element,
        getInspectorLookupElements(elements),
      );
      const currentStyle = {
        ...((resolvedElement.props?.style as Record<string, string>) || {}),
      };

      if (value === "" || value === null || value === undefined) {
        delete currentStyle[property];
      } else {
        const NUMERIC_STYLE_PROPS = new Set([
          "fontSize",
          "fontWeight",
          "lineHeight",
          "letterSpacing",
          "opacity",
          "padding",
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
          "gap",
          "rowGap",
          "columnGap",
          "borderWidth",
          "borderRadius",
        ]);
        if (NUMERIC_STYLE_PROPS.has(property)) {
          const num = parseFloat(value);
          (currentStyle as Record<string, unknown>)[property] = !isNaN(num)
            ? num
            : value;
        } else {
          currentStyle[property] = value;
        }
      }

      distributeShorthand(currentStyle as Record<string, unknown>, property);

      const newProps = {
        ...getInspectorWritableProps(element),
        style: currentStyle,
      };
      const updatedElement = buildInspectorUpdatedElement(element, newProps);

      // elementsMap만 업데이트 (캔버스 렌더링용)
      // ⚠️ selectedElementProps는 업데이트하지 않음!
      // → Jotai atom이 변경되지 않아 PropertyUnitInput의 value prop 유지
      // → blur 시 valueActuallyChanged 정상 감지 → onChange(DB 저장) 호출
      const newElements = replaceInspectorElement(
        elements,
        selectedElementId,
        updatedElement,
      );
      const newElementsMap = buildInspectorElementMap(newElements);
      newElementsMap.set(selectedElementId, updatedElement);

      // ADR-006 P3-1: style 프리뷰도 layoutVersion 증가 → 캔버스 레이아웃 즉시 반영
      set((prevState) => {
        const dirtyIds = new Set(prevState.dirtyElementIds);
        collectDirtyElementSubtree(
          selectedElementId,
          buildInspectorChildrenByParent(prevState.elements),
          dirtyIds,
        );

        return {
          elements: newElements,
          elementsMap: newElementsMap,
          layoutVersion: prevState.layoutVersion + 1,
          dirtyElementIds: dirtyIds,
        } as Partial<CombinedState>;
      });

      syncInspectorElementToCanonical(updatedElement);
    },

    updateSelectedStyles: (styles) => {
      const element = getSelectedElement();
      if (!element) return;

      // 프리뷰 상태에서 커밋 시, 원본 요소의 style 기반으로 변경
      const savedPrePreview = prePreviewElement;
      prePreviewElement = null;

      const baseElement =
        savedPrePreview && savedPrePreview.id === element.id
          ? savedPrePreview
          : element;
      const resolvedBaseElement = getResolvedInspectorElement(
        baseElement,
        getInspectorLookupElements(),
      );
      const currentStyle = {
        ...((resolvedBaseElement.props?.style as Record<string, string>) || {}),
      };

      Object.entries(styles).forEach(([property, value]) => {
        if (value === "" || value === null || value === undefined) {
          delete currentStyle[property];
        } else {
          const NUMERIC_STYLE_PROPS = new Set([
            "fontSize",
            "fontWeight",
            "lineHeight",
            "letterSpacing",
            "opacity",
            "padding",
            "paddingTop",
            "paddingRight",
            "paddingBottom",
            "paddingLeft",
            "gap",
            "rowGap",
            "columnGap",
            "borderWidth",
            "borderRadius",
          ]);
          if (NUMERIC_STYLE_PROPS.has(property)) {
            const num = parseFloat(value);
            (currentStyle as Record<string, unknown>)[property] = !isNaN(num)
              ? num
              : value;
          } else {
            currentStyle[property] = value;
          }
        }
        distributeShorthand(currentStyle as Record<string, unknown>, property);
      });

      updateAndSave(
        element.id,
        { style: currentStyle },
        undefined,
        savedPrePreview && savedPrePreview.id === element.id
          ? savedPrePreview
          : undefined,
      );
    },

    // ============================================
    // Property Actions
    // ============================================

    updateSelectedProperty: (key, value) => {
      const element = getSelectedElement();
      if (!element) return;

      updateAndSave(element.id, sanitizeInspectorProps({ [key]: value }));
    },

    updateSelectedProperties: (properties) => {
      const element = getSelectedElement();
      if (!element) return;

      updateAndSave(element.id, sanitizeInspectorProps(properties));
    },

    updateSelectedPropertiesWithChildren: (properties, childUpdates) => {
      const element = getSelectedElement();
      if (!element) return;

      // Race condition 방지: 선택된 요소의 hydration 취소
      get()._cancelHydrateSelectedProps();

      if (isInspectorInstanceElement(element)) {
        const descendantPatches = buildInstanceDescendantPatches(
          element,
          childUpdates,
        );
        updateAndSave(
          element.id,
          sanitizeInspectorProps(properties),
          descendantPatches
            ? ({
                [COMPONENT_DESCENDANTS_MIRROR_FIELD]: descendantPatches,
              } as Partial<Element>)
            : undefined,
        );
        return;
      }

      // 부모 + 자식을 단일 batch로 구성
      const batch: BatchPropsUpdate[] = [
        {
          elementId: element.id,
          props: sanitizeInspectorProps(properties) as ComponentElementProps,
        },
        ...childUpdates.map((update) => ({
          ...update,
          props: sanitizeInspectorProps(
            update.props as Record<string, unknown>,
          ) as ComponentElementProps,
        })),
      ];

      // batchUpdateElementProps → 단일 set() + batch 히스토리 + IndexedDB 저장
      get().batchUpdateElementProps(batch);
    },

    // ============================================
    // CustomId Action
    // ============================================

    updateSelectedCustomId: (customId) => {
      const element = getSelectedElement();
      if (!element) return;

      updateAndSave(element.id, {}, { customId });
    },

    // ============================================
    // DataBinding Action
    // ============================================

    updateSelectedDataBinding: (dataBinding) => {
      const element = getSelectedElement();
      if (!element) return;

      updateAndSave(
        element.id,
        {},
        { dataBinding: dataBinding as Element["dataBinding"] },
      );

      // ADR-131 Phase 4 — root collection mirror write.
      // legacy Element.dataBinding 유지 (preview/runtime 호환) + canonical
      // `document.data` 에도 sync. Phase 6 cleanup 에서 legacy 제거.
      syncDataBindingToRootCollection(
        element.id,
        (dataBinding ?? null) as Element["dataBinding"] | null,
      );
    },

    // ============================================
    // Event Actions
    // ============================================

    updateSelectedEvents: (events) => {
      const element = getSelectedElement();
      if (!element) return;

      updateAndSave(element.id, {
        events: events as unknown as ElementEvent[],
      });

      // ADR-131 Phase 4 — root collection mirror write
      syncEventsToRootCollection(element.id, events);
    },

    addSelectedEvent: (event) => {
      const element = getSelectedElement();
      if (!element) return;

      const currentEvents = (element.props?.events as EventHandler[]) || [];
      const next = [...currentEvents, event];
      updateAndSave(element.id, {
        events: next as unknown as ElementEvent[],
      });

      syncEventsToRootCollection(element.id, next);
    },

    updateSelectedEvent: (id, event) => {
      const element = getSelectedElement();
      if (!element) return;

      const currentEvents = (element.props?.events as EventHandler[]) || [];
      const updatedEvents = currentEvents.map((e) => (e.id === id ? event : e));
      updateAndSave(element.id, {
        events: updatedEvents as unknown as ElementEvent[],
      });

      syncEventsToRootCollection(element.id, updatedEvents);
    },

    removeSelectedEvent: (id) => {
      const element = getSelectedElement();
      if (!element) return;

      const currentEvents = (element.props?.events as EventHandler[]) || [];
      const updatedEvents = currentEvents.filter((e) => e.id !== id);
      updateAndSave(element.id, {
        events: updatedEvents as unknown as ElementEvent[],
      });

      syncEventsToRootCollection(element.id, updatedEvents);
    },

    // ============================================
    // Fill Actions (Color Picker Phase 1)
    // ============================================

    updateSelectedFills: (fills) => {
      const element = getSelectedElement();
      if (!element) return;

      // 프리뷰 상태에서 커밋 시, 원본 요소 기반으로 변경
      const savedPrePreview = prePreviewElement;
      prePreviewElement = null;

      const baseElement =
        savedPrePreview && savedPrePreview.id === element.id
          ? savedPrePreview
          : element;
      const resolvedBaseElement = getResolvedInspectorElement(
        baseElement,
        getInspectorLookupElements(),
      );

      const currentStyle = sanitizeFillDerivedStylePatch(
        (resolvedBaseElement.props?.style as Record<string, string>) || {},
        true,
      );

      updateAndSave(
        element.id,
        { style: currentStyle },
        { fills },
        savedPrePreview && savedPrePreview.id === element.id
          ? savedPrePreview
          : undefined,
      );
    },

    updateSelectedFillsPreview: (fills) => {
      const { elements, selectedElementId } = get();
      if (!selectedElementId) return;

      const element = getInspectorElementById(elements, selectedElementId);
      if (!element) return;

      // 첫 프리뷰 시 원본 요소 스냅샷 저장 (히스토리 정확성)
      if (!prePreviewElement || prePreviewElement.id !== selectedElementId) {
        prePreviewElement = structuredClone(element);
      }

      const resolvedElement = getResolvedInspectorElement(
        element,
        getInspectorLookupElements(elements),
      );
      const currentStyle = sanitizeFillDerivedStylePatch(
        (resolvedElement.props?.style as Record<string, string>) || {},
        true,
      );

      const newProps = {
        ...getInspectorWritableProps(element),
        style: currentStyle,
      };
      const updatedElement = buildInspectorUpdatedElement(element, newProps, {
        fills,
      });

      // elementsMap만 업데이트 (캔버스 렌더링용)
      // selectedElementProps는 업데이트하지 않음 (Jotai atom value 유지)
      const newElements = replaceInspectorElement(
        elements,
        selectedElementId,
        updatedElement,
      );
      const newElementsMap = buildInspectorElementMap(newElements);
      newElementsMap.set(selectedElementId, updatedElement);

      set({
        elements: newElements,
        elementsMap: newElementsMap,
      } as Partial<CombinedState>);
    },

    updateSelectedFillsPreviewLightweight: (fills) => {
      const { elements, selectedElementId } = get();
      if (!selectedElementId) return;

      const element = getInspectorElementById(elements, selectedElementId);
      if (!element) return;

      // 첫 프리뷰 시 원본 요소 스냅샷 저장 (히스토리 정확성)
      if (!prePreviewElement || prePreviewElement.id !== selectedElementId) {
        prePreviewElement = structuredClone(element);
      }

      // CSS 변환 없이 fills만 업데이트 (드래그 성능 최적화)
      const updatedElement: Element = { ...element, fills };

      // 🚀 CSS Preview도 drag 중 fills를 반영해야 하므로 elements 배열도 동기화한다.
      // selectedElementProps는 계속 건드리지 않아 패널 입력 리렌더는 막는다.
      const newElements = replaceInspectorElement(
        elements,
        selectedElementId,
        updatedElement,
      );
      const newElementsMap = buildInspectorElementMap(newElements);
      newElementsMap.set(selectedElementId, updatedElement);

      set({
        elements: newElements,
        elementsMap: newElementsMap,
      } as Partial<CombinedState>);
    },

    // ============================================
    // ComputedStyle Action (메모리만, DB 저장 없음)
    // ============================================

    updateSelectedComputedStyle: (computedStyle) => {
      const { selectedElementId } = get();
      if (!selectedElementId) return;

      // selectedElementProps만 업데이트 (UI 반영)
      // DB 저장 없음 - computedStyle은 런타임 값
      const currentState = get() as CombinedState & {
        selectedElementProps: ComponentElementProps;
      };
      const currentProps = currentState.selectedElementProps || {};

      // 변경 없으면 스킵
      const prevComputedStyle = currentProps.computedStyle as
        | Record<string, string>
        | undefined;
      if (prevComputedStyle) {
        const prevKeys = Object.keys(prevComputedStyle);
        const newKeys = Object.keys(computedStyle);
        if (prevKeys.length === newKeys.length) {
          const isSame = prevKeys.every(
            (key) => prevComputedStyle[key] === computedStyle[key],
          );
          if (isSame) return; // 변경 없음
        }
      }

      set({
        selectedElementProps: {
          ...currentProps,
          computedStyle,
        },
      } as Partial<CombinedState>);
    },
  };
};

// ============================================
// Selector: useSelectedElement
// ============================================

/**
 * Convert Element to SelectedElement format
 * Used by panels to get selected element in Inspector-compatible format
 */
export function mapElementToSelectedElement(element: Element): SelectedElement {
  const { style, computedStyle, events, ...otherProps } =
    element.props as Record<string, unknown>;

  return {
    id: element.id,
    customId: element.customId,
    type: element.type,
    properties: otherProps,
    style: (style as React.CSSProperties) || {},
    computedStyle: computedStyle as Partial<React.CSSProperties> | undefined,
    semanticClasses: [],
    cssVariables: {},
    dataBinding: getElementDataBinding(element, "legacy-only"),
    events: (events as SelectedElement["events"]) || [],
  };
}
