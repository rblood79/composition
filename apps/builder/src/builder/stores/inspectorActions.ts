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
import {
  getResponsiveValueWithCascade,
  isResponsiveEligibleStyleProp,
} from "@composition/shared";
import type {
  BreakpointName,
  ElementResponsiveConfig,
  InteractionRule,
  ResponsiveValue,
} from "@composition/shared";
import type {
  Element,
  ComponentElementProps,
} from "../../types/core/store.types";
import type { SelectedElement, DataBinding } from "../inspector/types";
import type { FillItem } from "../../types/builder/fill.types";
import { sanitizeFillDerivedStylePatch } from "../panels/styles/utils/fillDerivedStyleProps";
import { saveService } from "../../services/save";
import { getDB } from "../../lib/db";
import { getElementDataBinding } from "../../adapters/canonical/compositionExtensionFields";
import { writeInteractionRulesToRootCollection } from "./canonical/rootCollectionInteractionsWrite";
import {
  COMPONENT_DESCENDANTS_MIRROR_FIELD,
  COMPONENT_OVERRIDES_MIRROR_FIELD,
  getComponentDescendantsMirror,
  getComponentOverridesMirror,
  isComponentInstanceMirrorElement,
} from "../../adapters/canonical/componentSemanticsMirror";
import {
  getCanonicalRefTarget,
  isCanonicalRefElement,
  resolveCanonicalRefElement,
} from "../utils/canonicalRefResolution";
import {
  areCanonicalMutationStoreActionsRegistered,
  updateCanonicalNodeFromElementPrimary,
} from "@/adapters/canonical/canonicalMutations";
import { historyManager } from "./history";
import {
  buildCanonicalReplaceEvents,
  buildCanonicalUpdateEvent,
  hasNonPropsCanonicalHistoryChange,
} from "./history/canonicalHistoryEvents";
import { useCanonicalDocumentStore } from "./canonical/canonicalDocumentStore";
import {
  canonicalNodeToElement,
  getActiveCanonicalDocumentElements,
} from "./canonical/canonicalElementsView";
import {
  getFirstProjectableNodeLookupById,
  getFirstProjectableNodeLookupByReference,
  type CanonicalProjectableNodeLookup,
} from "./canonical/canonicalTraversalHelpers";
import {
  normalizeElementTagInElement,
  normalizeElementTags,
} from "./utils/elementTagNormalizer";
import type { BatchPropsUpdate } from "./utils/elementUpdate";
import {
  collectDirtyElementSubtree,
  LAYOUT_AFFECTING_PROP_KEYS,
} from "./utils/layoutInvalidation";
import { applyBorderCompanionDefaults } from "./utils/borderCompanionDefaults";
import {
  clearNonEligibleResponsiveOverrides,
  isGlobalStyleProp,
} from "./utils/globalStyleProps";
import {
  resolveEligibleSeedDefault,
  SHORTHAND_TO_LONGHAND,
  shouldWriteBreakpointOverride,
  toStyleNumericValue,
} from "./utils/responsiveWriteRouting";
import { mergePropsWithStyleDeep } from "../../adapters/canonical/instanceResolver";

// CSS shorthand → longhand 분배 매핑 (inspectorActions 공용).
// React inline style shorthand+longhand 공존 시 rerender 경고 + Taffy
// applyCommonEngineStyle 순서 (gap → rowGap/columnGap) 로 longhand override
// 발생 → Panel 편집 무시. store 는 longhand only 정책.
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

// base props.style 에 style 항목 하나를 반영 (숫자 변환 + shorthand 분배 + border companion).
//   updateSelectedStyle / updateSelectedStyles 의 base 쓰기 로직과 동일 규약.
function applyBaseStyleEntry(
  style: Record<string, unknown>,
  property: string,
  value: string,
): void {
  const isClearing = value === "" || value === null || value === undefined;
  if (isClearing) {
    delete style[property];
  } else {
    style[property] = toStyleNumericValue(property, value);
  }
  distributeShorthand(style, property);
  if (!isClearing) applyBorderCompanionDefaults(style, property);
}

/**
 * ADR-154: activeBreakpoint override 를 `element.responsive.styles` 에 write.
 * base `props.style` 과 동일한 longhand 정책(ADR-909) — shorthand(gap/padding/margin)은
 * longhand 로 분배 저장. 빈 값(clear)은 해당 breakpoint 키를 제거하고, 키가 비면 삭제.
 * desktop 은 호출측에서 제외(base 편집).
 */
function buildResponsiveStyleOverride(
  existing: ElementResponsiveConfig | undefined,
  property: string,
  value: string,
  breakpoint: BreakpointName,
): ElementResponsiveConfig {
  const styles: Record<string, Record<string, unknown>> = {};
  const existingStyles = (existing?.styles ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  for (const k of Object.keys(existingStyles)) {
    styles[k] = { ...existingStyles[k] };
  }

  const isClearing = value === "" || value === null || value === undefined;
  const longhands = SHORTHAND_TO_LONGHAND[property] ?? [property];
  const converted = isClearing
    ? undefined
    : toStyleNumericValue(property, value);

  for (const key of longhands) {
    if (converted === undefined) {
      if (styles[key]) {
        delete styles[key][breakpoint];
        if (Object.keys(styles[key]).length === 0) delete styles[key];
      }
    } else {
      styles[key] = { ...(styles[key] ?? {}), [breakpoint]: converted };
    }
  }

  const next: ElementResponsiveConfig = { ...existing };
  if (Object.keys(styles).length > 0) {
    next.styles = styles as unknown as ElementResponsiveConfig["styles"];
  } else {
    delete next.styles;
  }
  return next;
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
  updateCanonicalNodeFromElementPrimary(element);
}

function getResolvedInspectorElement(
  element: Element,
  fallbackElements: Iterable<Element>,
): Element {
  if (!isCanonicalRefElement(element)) return element;

  const canonicalMaster = getActiveCanonicalInspectorRefMaster(element);
  if (canonicalMaster) {
    return canonicalMaster.element
      ? resolveCanonicalRefElement(element, [canonicalMaster.element])
      : element;
  }

  return resolveCanonicalRefElement(element, fallbackElements);
}

type ActiveCanonicalInspectorElement = {
  element: Element | null;
};

function projectCanonicalInspectorElement(
  lookup: CanonicalProjectableNodeLookup,
): Element | null {
  return canonicalNodeToElement(lookup.node, lookup.parentId, {
    pageId: lookup.pageId,
    layoutId: lookup.layoutId,
  });
}

function getActiveCanonicalInspectorElementById(
  elementId: string,
): ActiveCanonicalInspectorElement | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId || !canonical.documents.has(projectId)) return null;

  const lookup = getFirstProjectableNodeLookupById(elementId);
  return { element: lookup ? projectCanonicalInspectorElement(lookup) : null };
}

function getActiveCanonicalInspectorRefMaster(
  element: Element,
): ActiveCanonicalInspectorElement | null {
  const reference = getCanonicalRefTarget(element);
  if (!reference) return getActiveCanonicalInspectorElementById(element.id);

  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId || !canonical.documents.has(projectId)) return null;

  const lookup = getFirstProjectableNodeLookupByReference(reference);
  return { element: lookup ? projectCanonicalInspectorElement(lookup) : null };
}

function getInspectorElementById(
  elements: Iterable<Element>,
  elementId: string,
): Element | null {
  const canonicalElement = getActiveCanonicalInspectorElementById(elementId);
  if (canonicalElement) return canonicalElement.element;

  for (const element of elements) {
    if (element.id === elementId) return element;
  }
  return null;
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

type InspectorUpdateSource = {
  currentElement: Element;
  elements: Element[];
  elementsMap: InspectorElementMap;
};

/**
 * 정상 편집은 기존 derived collections를 그대로 사용한다. canonical target은
 * 존재하지만 bootstrap 중 배열/Map 한쪽에 target이 빠진 경우에만 cached full
 * view로 derived state를 한 번 복구해 legacy consumer가 부분 배열을 보지 않게 한다.
 */
function getInspectorUpdateSource(
  elements: Element[],
  elementsMap: InspectorElementMap,
  elementId: string,
): InspectorUpdateSource | null {
  const canonicalElement = getActiveCanonicalInspectorElementById(elementId);
  const elementIndex = elements.findIndex(
    (element) => element.id === elementId,
  );

  if (canonicalElement) {
    if (!canonicalElement.element) return null;
    if (elementIndex >= 0 && elementsMap.has(elementId)) {
      return {
        currentElement: canonicalElement.element,
        elements,
        elementsMap,
      };
    }

    const canonicalElements = getActiveCanonicalDocumentElements();
    if (canonicalElements) {
      const normalizedElements =
        normalizeElementTags(canonicalElements).elements;
      const restoredElementsMap = new Map(
        normalizedElements.map((element) => [element.id, element]),
      );
      return {
        currentElement: canonicalElement.element,
        elements: normalizedElements,
        elementsMap: restoredElementsMap,
      };
    }

    return { currentElement: canonicalElement.element, elements, elementsMap };
  }

  const fallbackElement =
    elementIndex >= 0 ? (elements[elementIndex] ?? null) : null;
  return fallbackElement
    ? { currentElement: fallbackElement, elements, elementsMap }
    : null;
}

function getInspectorWritableProps(element: Element): Record<string, unknown> {
  if (isComponentInstanceMirrorElement(element)) {
    return getComponentOverridesMirror(element) ?? {};
  }
  return (element.props ?? {}) as Record<string, unknown>;
}

/**
 * instance mirror 요소의 override 채널은 `overrides` 다 — canonical sync 는
 * `legacy.overrides` 가 있으면 그것을 그대로 `RefNode.props` 로 쓰고, 없을 때만
 * `element.props` 를 master 와 diff 한다 (canonicalMutations). 호출부가
 * `isInspectorInstanceElement` 로 instance 라고 판정했으면 mirror 작성도 같은
 * 기준이어야 하며, 그렇지 않으면 canonical `ref` instance 의 override 가
 * `overrides` 에 실리지 않아 mirror consumer (Inspector/LayerTree) 가 못 본다.
 *
 * 단 `props` 취급은 두 mirror 형태가 다르다:
 * - legacy mirror instance: `props` 는 resolved props → 덮으면 병합값 소실. 보존.
 * - canonical `ref` instance: `RefNode.props` 자체가 override map → mirror `props`
 *   도 같은 map 을 들고 있어야 canonical 과 정합.
 */
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

  if (isCanonicalRefElement(element)) {
    return {
      ...element,
      props,
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
  const next: Record<string, Record<string, unknown>> = {};
  for (const [path, patch] of Object.entries(current)) {
    if (isRecord(patch)) next[path] = patch;
  }
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

// ADR-149 Phase 2c (2026-07-19): syncEventsToRootCollection delegate 제거 —
// `updateEventsRootCollection` 가 write core 를 직접 호출. dead selected-* mutation
// 4종 제거로 유일 caller 소멸 → 단일 write 진입점 확정.
//
// ADR-158 Phase 1 (2026-07-25): 그 write core 가
// `canonical/rootCollectionInteractionsWrite.ts` 로 교체됐다 (entry 스키마
// SerializedEvent → InteractionRule). Phase 4 (2026-08-16) 에서 구 EventsPanel 과
// 그 전용 `updateLegacyElementEvents` node projection 경로가 함께 삭제됐다.

// ADR-131 Phase 8 (2026-05-13): syncDataBindingToRootCollection 제거.
// data SSOT 는 `collections` / `api_endpoints` / `variables`.

function buildInspectorPersistencePayload(
  element: Element,
  props: Record<string, unknown>,
  additionalUpdates?: Partial<Element>,
): Record<string, unknown> {
  // buildInspectorUpdatedElement 와 동일한 mirror 형태를 저장해야 한다
  // (legacy instance 는 resolved props 보존, canonical ref 는 props == override map).
  const payload: Record<string, unknown> = isComponentInstanceMirrorElement(
    element,
  )
    ? {
        props: element.props ?? {},
        [COMPONENT_OVERRIDES_MIRROR_FIELD]: props,
      }
    : isCanonicalRefElement(element)
      ? { props, [COMPONENT_OVERRIDES_MIRROR_FIELD]: props }
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
      Record<typeof COMPONENT_DESCENDANTS_MIRROR_FIELD, unknown> | undefined
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
  // design_themes / variables / collections / api_endpoints
  // 와 동일하게 events / actions 도 별 store entries 로 보인다.
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

  // Data — 별 store 부재 (Phase 7-revert): `collections` / `api_endpoints` 와
  // 중복 개념. `doc.data` 는 canonical document root field 로만 보존, 별 store
  // fan-out 없음. schema 영역 추가 framing 정정 시 별도 처리.

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
  /** 비-migrated layout/structure editor의 commit-only fallback용 legacy preview */
  updateSelectedStylePreview: (property: string, value: string) => void;
  /**
   * ADR-154: breakpoint 별 가시성 override 편집 (tablet/mobile 만).
   * visible=false → `element.responsive.visibility[breakpoint]=false` (→ @media
   * display:none). visible=true → 기본값이므로 override 키 제거. desktop 은
   * base(props.style.display)로 제어하므로 no-op (호출측에서 lock).
   */
  updateSelectedResponsiveVisibility: (
    breakpoint: BreakpointName,
    visible: boolean,
  ) => void;
  /**
   * ADR-154 개정 1: eligible(Layout·Transform) style prop 의 현재 breakpoint override
   * 토글 on/off. on = 현재 resolve 값을 해당 tier override 로 복사(이후 그 속성 편집이
   * override 로 라우팅). off = 해당 tier override 키 제거(base 상속 복귀). desktop 은
   * base 그 자체라 no-op (호출측에서 lock). non-eligible 속성은 no-op.
   */
  setResponsiveStyleOverrideEnabled: (
    property: string,
    enabled: boolean,
  ) => void;
  updateSelectedProperty: (key: string, value: unknown) => void;
  updateSelectedProperties: (properties: Record<string, unknown>) => void;
  /** 부모+자식 props를 단일 batch 히스토리로 atomic 업데이트 (Child Composition Pattern) */
  updateSelectedPropertiesWithChildren: (
    properties: Record<string, unknown>,
    childUpdates: BatchPropsUpdate[],
  ) => void;
  updateSelectedCustomId: (customId: string) => void;
  updateSelectedDataBinding: (dataBinding: DataBinding | undefined) => void;
  /**
   * ADR-149 Phase 2a/2c → ADR-158 Phase 1 — canonical 규칙 단일 write 진입점.
   *
   * entry 스키마가 구 `EventHandler` 에서 `InteractionRule` 로 교체됐다. canonical
   * root collection 만 갱신하고 legacy `element.events` mirror 는 파생하지 않는다
   * (ADR-158 breakdown §2 — Phase 1 mirror 파생 중단).
   */
  updateEventsRootCollection: (
    elementId: string,
    rules: readonly InteractionRule[],
  ) => void;
  // Fill Actions (Color Picker Phase 1)
  /** fills 배열 업데이트 + style.backgroundColor 동기화 + 히스토리/DB 저장 */
  updateSelectedFills: (fills: FillItem[]) => void;

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
  /** ADR-154: 반응형 override 편집 분기용 (canvasSettings slice) */
  activeBreakpoint: BreakpointName;
  updateElement: (
    elementId: string,
    updates: Partial<Element>,
  ) => Promise<void>;
  _rebuildIndexes: (sourceElements?: Element[]) => void;
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
   * - canonical target/ref master 는 traversal index 의 leaf lookup 으로 조회
   * - 기존 derived elementsMap/childrenMap 을 재사용해 projection/index 재구축 제거
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
    const { elements, elementsMap, selectedElementId, currentPageId } = get();
    const source = getInspectorUpdateSource(elements, elementsMap, elementId);
    if (!source) return;
    const element = normalizeElementTagInElement(source.currentElement);

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
    // instance mirror: overrides/descendants 등 props 외 mirror field 변경은
    //   replace event 쌍 (pre-mutation 모드 — canonical sync 전 호출이므로
    //   prev 는 현재 doc, next 는 updated element 로부터 빌드)
    // fills(배경 canonical 1차 필드) 변경도 props-only update event 로는 캡처 안 되므로
    //   (replaceNodeProps 가 props 만 교체) replace event 로 full node 를 기록해야 undo 로
    //   배경이 복원된다(M2b). buildCanonicalReplaceEvents 는 prev/next 노드에 fills 를 포함.
    // 일반 요소: full merged props 의 update event
    // 판정은 `canonicalHistoryEvents` 단일 소스 — 이 규칙이 여기에만 인라인으로
    // 있던 탓에 `updateElement` 일반 경로가 같은 처리를 못 갖고 있었다 (ADR-168 잔존).
    const hasNonPropsCanonicalChange =
      hasNonPropsCanonicalHistoryChange(additionalUpdates);
    if (
      currentPageId &&
      (Object.keys(propsUpdate).length > 0 || hasNonPropsCanonicalChange)
    ) {
      const canonicalEvents =
        isComponentInstanceMirrorElement(element) || hasNonPropsCanonicalChange
          ? buildCanonicalReplaceEvents([prevElement], [updatedElement])
          : [
              buildCanonicalUpdateEvent(
                elementId,
                prevProps,
                structuredClone(newProps),
              ),
            ];
      historyManager.addEntry({
        type: "update",
        elementId: elementId,
        data: { canonicalEvents },
      });
    }

    // 기존 derived Map 을 한 번만 clone 하고 target entry 만 교체 (불변성 유지)
    const newElementsMap = new Map(source.elementsMap);
    newElementsMap.set(elementId, updatedElement);

    // 🚀 elements 배열도 업데이트 (findIndex로 위치 찾아서 직접 교체)
    const newElements = replaceInspectorElement(
      source.elements,
      elementId,
      updatedElement,
    );

    // 🚀 단일 set() 호출 - 배칭으로 리렌더링 최소화
    // ADR-006 P3-1: 레이아웃 영향 prop 변경 시 layoutVersion 증가 → fullTreeLayoutMap 재계산 트리거
    // style 변경 외에도 size, label, children, text 등 레이아웃에 영향을 미치는 prop 포함
    // ADR-154: responsive override 는 props 축이 아니라 top-level 필드로 오므로
    // propsUpdate 키 검사에 걸리지 않는다 — additionalUpdates.responsive 변경도
    // 전역 재레이아웃(resolve 재계산) 대상이므로 layoutVersion bump 을 강제.
    const hasResponsiveChange =
      additionalUpdates !== undefined && "responsive" in additionalUpdates;
    const hasLayoutChange =
      hasResponsiveChange ||
      Object.keys(propsUpdate).some((key) =>
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
        collectDirtyElementSubtree(elementId, prevState.childrenMap, dirtyIds);
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

      // ADR-154 개정 1: 편집 기본은 base(props.style) = 전역(전 breakpoint 적용).
      // eligible(Layout·Transform) 속성이 해당 tier 토글 ON(명시 override 존재)일 때만
      // responsive override 로 저장한다 (shouldWriteBreakpointOverride 단일 판정, R10).
      const activeBreakpoint = get().activeBreakpoint;
      if (
        shouldWriteBreakpointOverride(
          baseElement.responsive,
          property,
          activeBreakpoint,
        )
      ) {
        const nextResponsive = buildResponsiveStyleOverride(
          baseElement.responsive,
          property,
          value,
          activeBreakpoint,
        );
        updateAndSave(
          element.id,
          {},
          { responsive: nextResponsive },
          savedPrePreview && savedPrePreview.id === element.id
            ? savedPrePreview
            : undefined,
        );
        return;
      }

      const resolvedBaseElement = getResolvedInspectorElement(
        baseElement,
        get().elements,
      );
      const currentStyle = {
        ...((resolvedBaseElement.props?.style as Record<string, string>) || {}),
      };

      const isClearing = value === "" || value === null || value === undefined;
      if (isClearing) {
        delete currentStyle[property];
      } else {
        // Canvas spec shapes 는 fontSize/padding 등을 숫자로 기대. width/height 등
        // dimensional 축은 %/vw/auto 단위 보존을 위해 문자열 유지 (toStyleNumericValue SSOT).
        (currentStyle as Record<string, unknown>)[property] =
          toStyleNumericValue(property, value);
      }

      distributeShorthand(currentStyle as Record<string, unknown>, property);
      if (!isClearing) {
        applyBorderCompanionDefaults(
          currentStyle as Record<string, unknown>,
          property,
        );
      }

      // 전역(non-eligible) 속성을 base 에 쓸 때, stale responsive override 가 남아 특정
      // breakpoint 에서 base 를 shadow 하지 않도록 responsive.styles 의 non-eligible 키 정리 (R8).
      const clearedResponsive = isGlobalStyleProp(property)
        ? clearNonEligibleResponsiveOverrides(baseElement.responsive)
        : null;

      updateAndSave(
        element.id,
        { style: currentStyle },
        clearedResponsive ? { responsive: clearedResponsive } : undefined,
        savedPrePreview && savedPrePreview.id === element.id
          ? savedPrePreview
          : undefined,
      );
    },

    updateSelectedStylePreview: (property, value) => {
      const { elements, elementsMap, selectedElementId } = get();
      if (!selectedElementId) return;

      const activeBreakpoint = get().activeBreakpoint;

      const element = getInspectorElementById(elements, selectedElementId);
      if (!element) return;

      // 첫 프리뷰 시 원본 요소 스냅샷 저장 (히스토리 정확성 + commit base).
      // desktop / 비-desktop 공통 — commit 경로(updateSelectedStyle)가 이 스냅샷을
      // pre-preview base 로 사용해 base/override 를 정확히 기록한다.
      if (!prePreviewElement || prePreviewElement.id !== selectedElementId) {
        prePreviewElement = structuredClone(element);
      }

      let updatedElement: Element;

      if (
        shouldWriteBreakpointOverride(
          element.responsive,
          property,
          activeBreakpoint,
        )
      ) {
        // ADR-154 개정 1: eligible 속성 토글 ON 일 때만 responsive override 를 preview 로
        // 반영한다 (commit 경로와 동일 shouldWriteBreakpointOverride 판정). elementsMap 만
        // 갱신(히스토리/DB 없음)하고 base 는 무변경이라 base 오염이 없다. commit 경로
        // (updateSelectedStyle)가 동일 buildResponsiveStyleOverride 로 최종 override 를
        // 기록하며, resolveResponsiveLayoutNode 가 activeBreakpoint 기준으로 이 preview
        // override 를 merge → 드래그/타이핑 중 캔버스 즉시 반영. (숫자/shorthand 변환은
        // buildResponsiveStyleOverride 내부에서 처리.) 그 외(전역/토글 OFF)는 아래 base
        // preview 로 반영 (전 breakpoint 적용).
        const nextResponsive = buildResponsiveStyleOverride(
          element.responsive,
          property,
          value,
          activeBreakpoint,
        );
        updatedElement = buildInspectorUpdatedElement(
          element,
          getInspectorWritableProps(element),
          { responsive: nextResponsive },
        );
      } else {
        // desktop = base preview (기존 동작)
        const resolvedElement = getResolvedInspectorElement(element, elements);
        const currentStyle = {
          ...((resolvedElement.props?.style as Record<string, string>) || {}),
        };

        const isClearing =
          value === "" || value === null || value === undefined;
        if (isClearing) {
          delete currentStyle[property];
        } else {
          (currentStyle as Record<string, unknown>)[property] =
            toStyleNumericValue(property, value);
        }

        distributeShorthand(currentStyle as Record<string, unknown>, property);
        if (!isClearing) {
          applyBorderCompanionDefaults(
            currentStyle as Record<string, unknown>,
            property,
          );
        }

        const newProps = {
          ...getInspectorWritableProps(element),
          style: currentStyle,
        };
        // 전역(non-eligible) 속성 preview 는 stale responsive override 를 정리해 base 값이
        // 모든 breakpoint preview 에 그대로 반영되게 한다 (R8).
        const clearedResponsive = isGlobalStyleProp(property)
          ? clearNonEligibleResponsiveOverrides(element.responsive)
          : null;
        updatedElement = buildInspectorUpdatedElement(
          element,
          newProps,
          clearedResponsive ? { responsive: clearedResponsive } : undefined,
        );
      }

      // 공통 tail — elementsMap 만 업데이트 (캔버스 렌더링용)
      // ⚠️ selectedElementProps는 업데이트하지 않음!
      // → Jotai atom이 변경되지 않아 PropertyUnitInput의 value prop 유지
      // → blur 시 valueActuallyChanged 정상 감지 → onChange(DB 저장) 호출
      const newElements = replaceInspectorElement(
        elements,
        selectedElementId,
        updatedElement,
      );
      const newElementsMap = new Map(elementsMap);
      newElementsMap.set(selectedElementId, updatedElement);

      // ADR-006 P3-1: style 프리뷰도 layoutVersion 증가 → 캔버스 레이아웃 즉시 반영
      set((prevState) => {
        const dirtyIds = new Set(prevState.dirtyElementIds);
        collectDirtyElementSubtree(
          selectedElementId,
          prevState.childrenMap,
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

    updateSelectedResponsiveVisibility: (breakpoint, visible) => {
      // desktop = base — 가시성은 base props.style.display 로 제어. responsive.visibility
      // 는 tablet/mobile override 만 (desktop visibility=false 를 허용하면 responsiveCss
      // 가 tablet/mobile @media 만 방출해 Skia↔DOM 비대칭 발생 — resolveResponsive.ts /
      // responsiveCss.ts 정합).
      if (breakpoint === "desktop") return;

      const element = getSelectedElement();
      if (!element) return;

      const existing = element.responsive;
      const visibility: Record<string, boolean> = {
        ...(existing?.visibility ?? {}),
      };
      if (visible) {
        delete visibility[breakpoint]; // 기본값(표시) → override 제거
      } else {
        visibility[breakpoint] = false;
      }

      // buildResponsiveStyleOverride 와 동일 계약: 빈 config({}) = cleared 상태
      // (resolveResponsive/responsiveCss 가 !styles && !visibility 를 no-op 처리,
      // canonicalMutations 가 빈 config 를 생략=제거).
      const next: ElementResponsiveConfig = { ...existing };
      if (Object.keys(visibility).length > 0) {
        next.visibility = visibility as ElementResponsiveConfig["visibility"];
      } else {
        delete next.visibility;
      }

      updateAndSave(element.id, {}, { responsive: next });
    },

    setResponsiveStyleOverrideEnabled: (property, enabled) => {
      const activeBreakpoint = get().activeBreakpoint;
      // desktop = base 그 자체 (토글 무의미), non-eligible = 항상 전역 → 둘 다 no-op.
      if (activeBreakpoint === "desktop") return;
      if (!isResponsiveEligibleStyleProp(property)) return;

      const element = getSelectedElement();
      if (!element) return;

      const longhands = SHORTHAND_TO_LONGHAND[property] ?? [property];

      if (!enabled) {
        // OFF: 해당 tier override 키 제거 (buildResponsiveStyleOverride "" clear 규약) →
        // base 상속 복귀. shorthand 는 longhand 별로 clear.
        let nextResponsive = element.responsive;
        for (const key of longhands) {
          nextResponsive = buildResponsiveStyleOverride(
            nextResponsive,
            key,
            "",
            activeBreakpoint,
          );
        }
        updateAndSave(element.id, {}, { responsive: nextResponsive });
        return;
      }

      // ON: 현재 effective(base ⊕ 상위 tier cascade) 값을 이 tier override 로 복사 →
      // 토글 순간 시각 변화 0, 이후 이 속성 편집이 override 로 라우팅. effective 가 없는
      // 속성(minWidth/flexGrow/alignSelf 등 factory 기본값 부재)은 resolveEligibleSeedDefault
      // 의 CSS-initial 값(length→auto, spacing→0, enum→유효 기본)으로 seed 해 토글을 고정한다
      // (기존엔 no-op → data-derived 토글이 즉시 OFF 로 읽혀 override 가 안 걸리던 버그).
      const resolved = getResolvedInspectorElement(element, get().elements);
      const baseStyle =
        (resolved.props?.style as Record<string, unknown>) || {};
      const respStyles = element.responsive?.styles as
        Record<string, ResponsiveValue<unknown>> | undefined;

      let nextResponsive = element.responsive;
      for (const key of longhands) {
        const respValue = respStyles?.[key];
        // base longhand 부재 시 shorthand fallback (예: props.style.padding="16px").
        const baseValue = baseStyle[key] ?? baseStyle[property];
        const effective =
          respValue != null
            ? getResponsiveValueWithCascade(
                respValue,
                activeBreakpoint,
                baseValue,
              )
            : baseValue;
        const seed =
          effective === undefined || effective === null || effective === ""
            ? resolveEligibleSeedDefault(key)
            : String(effective);
        nextResponsive = buildResponsiveStyleOverride(
          nextResponsive,
          key,
          seed,
          activeBreakpoint,
        );
      }
      updateAndSave(element.id, {}, { responsive: nextResponsive });
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

      // ADR-154 개정 1: batch 편집도 단수 updateSelectedStyle 와 동일 라우팅 —
      // shouldWriteBreakpointOverride(eligible + 해당 tier 토글 ON)면 override, 아니면 base.
      // 한 batch 에 override-대상 + base-대상 이 섞이면(reset 이 eligible 토글 clear +
      // 전역 base reset 을 함께 보냄) 축을 분리해 각각의 저장소에 기록.
      const activeBreakpoint = get().activeBreakpoint;
      if (activeBreakpoint !== "desktop") {
        const entries = Object.entries(styles);
        const overrideEntries = entries.filter(([property]) =>
          shouldWriteBreakpointOverride(
            baseElement.responsive,
            property,
            activeBreakpoint,
          ),
        );
        const baseEntries = entries.filter(
          ([property]) =>
            !shouldWriteBreakpointOverride(
              baseElement.responsive,
              property,
              activeBreakpoint,
            ),
        );

        let nextResponsive = baseElement.responsive;
        for (const [property, value] of overrideEntries) {
          nextResponsive = buildResponsiveStyleOverride(
            nextResponsive,
            property,
            value,
            activeBreakpoint,
          );
        }

        // base 로 갈 entry 가 없으면 override-only 경로 유지
        if (baseEntries.length === 0) {
          updateAndSave(
            element.id,
            {},
            { responsive: nextResponsive },
            savedPrePreview && savedPrePreview.id === element.id
              ? savedPrePreview
              : undefined,
          );
          return;
        }

        // base-대상 entry 는 base 에 반영 + responsive.styles 의 non-eligible 키 정리 (R8)
        const resolvedBaseElement = getResolvedInspectorElement(
          baseElement,
          get().elements,
        );
        const baseStyle = {
          ...((resolvedBaseElement.props?.style as Record<string, unknown>) ||
            {}),
        };
        for (const [property, value] of baseEntries) {
          applyBaseStyleEntry(baseStyle, property, value);
        }
        const finalResponsive =
          clearNonEligibleResponsiveOverrides(nextResponsive) ?? nextResponsive;

        updateAndSave(
          element.id,
          { style: baseStyle },
          { responsive: finalResponsive },
          savedPrePreview && savedPrePreview.id === element.id
            ? savedPrePreview
            : undefined,
        );
        return;
      }

      const resolvedBaseElement = getResolvedInspectorElement(
        baseElement,
        get().elements,
      );
      const currentStyle = {
        ...((resolvedBaseElement.props?.style as Record<string, string>) || {}),
      };

      Object.entries(styles).forEach(([property, value]) => {
        const isClearing =
          value === "" || value === null || value === undefined;
        if (isClearing) {
          delete currentStyle[property];
        } else {
          (currentStyle as Record<string, unknown>)[property] =
            toStyleNumericValue(property, value);
        }
        distributeShorthand(currentStyle as Record<string, unknown>, property);
        if (!isClearing) {
          applyBorderCompanionDefaults(
            currentStyle as Record<string, unknown>,
            property,
          );
        }
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

      // ADR-131 Phase 8 (2026-05-13): root collection sync 제거.
      // data SSOT 는 `collections` / `api_endpoints` / `variables`.
      // Element.dataBinding 은 element 별 binding reference 로 유지.
    },

    // ============================================
    // Event Actions
    // ============================================

    // ADR-158 Phase 1 — canonical 규칙 단일 write 진입점.
    //
    // ADR-149 의 dual-write (node projection + root collection) 를 canonical 단일
    // write 로 좁혔다: `InteractionRule` 은 legacy `element.events` mirror 를
    // 파생하지 않는다 (breakdown §2). persist 는 canonical document put +
    // root collection fan-out 을 담당하는 persistActiveCanonicalDocument 경유.
    updateEventsRootCollection: (elementId, rules) => {
      writeInteractionRulesToRootCollection(elementId, rules);
      void persistActiveCanonicalDocument();
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
        get().elements,
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
        Record<string, string> | undefined;
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
  const {
    style,
    computedStyle,
    events: _events,
    ...otherProps
  } = element.props as Record<string, unknown>;

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
  };
}
