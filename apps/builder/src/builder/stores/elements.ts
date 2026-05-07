import { useMemo } from "react";
import { create } from "zustand";
// 🚀 Phase 1: Immer 제거 - 함수형 업데이트로 전환
// import { produce } from "immer"; // REMOVED
import { StateCreator } from "zustand";
import type { StoredMenuItem } from "@composition/specs";
import {
  Element,
  ComponentElementProps,
  ComputedLayout,
} from "../../types/core/store.types";
import { Page } from "../../types/builder/unified.types";
import {
  getComponentMasterReference as getInstanceMasterRef,
  isComponentInstanceMirrorElement as isInstanceElement,
  isComponentOriginMirrorElement as isMasterElement,
} from "../../adapters/canonical/componentSemanticsMirror";
import type { PageLayoutDirection } from "./canvasSettings";
import { historyManager } from "./history";
import { reorderElements } from "./utils/elementReorder";
import {
  createCompleteProps,
  findElementById,
  computeCanvasElementStyle,
} from "./utils/elementHelpers";
import { sortElementsByOrderThenSource } from "../utils/elementOrdering";
import {
  createUndoAction,
  createRedoAction,
  createGoToHistoryIndexAction,
} from "./history/historyActions";
import {
  createRemoveElementAction,
  createRemoveElementsAction,
} from "./utils/elementRemoval";
import {
  createAddElementAction,
  createAddComplexElementAction,
} from "./utils/elementCreation";
import {
  createUpdateElementPropsAction,
  createUpdateElementAction,
  createBatchUpdateElementPropsAction,
  createBatchUpdateElementsAction,
  type BatchElementUpdate,
  type BatchPropsUpdate,
} from "./utils/elementUpdate";
import { ElementUtils } from "../../utils/element/elementUtils";
import {
  createInstance as createInstanceAction,
  detachInstance as detachInstanceAction,
  resetInstanceOverrideField as resetInstanceOverrideFieldAction,
  toggleComponentOrigin as toggleComponentOriginAction,
} from "./utils/instanceActions";
import { longTaskMonitor } from "../../utils/longTaskMonitor";
import { observe, PERF_LABEL } from "../utils/perfMarks";
import {
  scheduleCancelableBackgroundTask,
  scheduleNextFrame,
} from "../utils/scheduleTask";
import { normalizeElementTags } from "./utils/elementTagNormalizer";
import { normalizeExternalFillIngress } from "../panels/styles/utils/fillExternalIngress";
import {
  type PageElementIndex,
  type ComponentIndex,
  type VariableUsageIndex,
  createEmptyPageIndex,
  createEmptyComponentIndex,
  createEmptyVariableUsageIndex,
  rebuildPageIndex,
  indexElement,
  unindexElement,
  rebuildComponentIndex,
  rebuildVariableUsageIndex,
  getPageElements as getPageElementsFromIndex,
} from "./utils/elementIndexer";
import { getNullablePageFrameBindingId } from "@/adapters/canonical/frameMirror";
// ADR-116 Phase 3 G4 — mutation reverse wrapper (D18=A 정합)
import {
  areCanonicalMutationStoreActionsRegistered,
  mergeElementsCanonicalPrimary,
  updateElementCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";

function pageLayoutId(page: Page): string | null {
  return getNullablePageFrameBindingId(page);
}

function shouldInvalidatePagesLayout(
  currentPages: Page[],
  nextPages: Page[],
): boolean {
  if (currentPages.length !== nextPages.length) {
    return true;
  }

  return currentPages.some((page, index) => {
    const nextPage = nextPages[index];
    return (
      !nextPage ||
      page.id !== nextPage.id ||
      page.order_num !== nextPage.order_num ||
      pageLayoutId(page) !== pageLayoutId(nextPage)
    );
  });
}

export interface ElementsState {
  elements: Element[];
  pageElementsSnapshot: Record<string, Element[]>;
  // 성능 최적화: O(1) 조회를 위한 Map 인덱스
  elementsMap: Map<string, Element>;
  childrenMap: Map<string, Element[]>;
  // 🆕 Phase 2: 페이지별 인덱스 (O(1) 페이지 요소 조회)
  pageIndex: PageElementIndex;
  // G.1: Component-Instance 인덱스
  componentIndex: ComponentIndex;
  // G.2: Variable Usage 인덱스
  variableUsageIndex: VariableUsageIndex;
  selectedElementId: string | null;
  selectedElementProps: ComponentElementProps;
  selectedTab: { parentId: string; tabIndex: number } | null;
  pages: Page[];
  currentPageId: string | null;
  historyOperationInProgress: boolean;
  // ⭐ Multi-select state
  selectedElementIds: string[];
  // 🚀 O(1) 검색용 Set (selectedElementIds와 동기화)
  selectedElementIdsSet: Set<string>;
  multiSelectMode: boolean;
  editingContextId: string | null;

  // 🆕 Multi-page: 페이지별 캔버스 위치
  pagePositions: Record<string, { x: number; y: number }>;
  pagePositionsVersion: number;

  // ADR-111 P3-α: reusable frame 별 캔버스 영역 (frame canvas authoring 시각 path)
  // pagePositions 와 분리: page 는 global pageWidth/Height 공유, frame 은 width/height 개별
  framePositions: Record<
    string,
    { x: number; y: number; width: number; height: number }
  >;
  framePositionsVersion: number;

  // ADR-006 P3-1: Dirty Tracking — 레이아웃 변경 감지
  /** 레이아웃에 영향 있는 변경이 발생할 때마다 증가. useMemo 의존성에 사용. */
  layoutVersion: number;
  /** 현재 프레임에서 레이아웃이 변경된 요소 ID 집합. fullTreeLayout이 소비 후 초기화. */
  dirtyElementIds: Set<string>;
  /** dirtyElementIds를 초기화 (fullTreeLayout 호출 후 호출) */
  clearDirtyElementIds: () => void;

  // 내부 헬퍼: 인덱스 재구축
  _rebuildIndexes: () => void;
  // 내부 헬퍼: 진행 중인 selectedElementProps hydration 취소
  _cancelHydrateSelectedProps: () => void;

  // 🆕 Phase 2: O(1) 페이지 요소 조회
  getPageElements: (pageId: string) => Element[];

  setElements: (elements: Element[]) => void;
  hydrateProjectSnapshot: (elements: Element[]) => void;
  recoverElementsSnapshot: (elements: Element[]) => void;
  mergeElements: (elements: Element[]) => void;
  replaceElementId: (oldId: string, newId: string) => void;
  loadPageElements: (elements: Element[], pageId: string) => void;
  addElement: (element: Element) => Promise<void>;
  updateElementProps: (
    elementId: string,
    props: ComponentElementProps,
  ) => Promise<void>;
  updateElement: (
    elementId: string,
    updates: Partial<Element>,
  ) => Promise<void>;
  setSelectedElement: (
    elementId: string | null,
    props?: ComponentElementProps,
    style?: React.CSSProperties,
    computedStyle?: Partial<React.CSSProperties>,
  ) => void;
  selectTabElement: (
    elementId: string,
    props: ComponentElementProps,
    tabIndex: number,
  ) => void;
  setPages: (pages: Page[]) => void;
  appendPageShell: (
    page: Page,
    bodyElement: Element,
    position: { x: number; y: number },
    options?: { activate?: boolean },
  ) => void;
  removePageLocal: (
    pageId: string,
    nextSelection?: { pageId: string | null; elementId: string | null },
  ) => void;
  activatePage: (pageId: string, elementId?: string | null) => void;
  /** Page activation alias. Keeps page body selection in sync. */
  setCurrentPageId: (pageId: string) => void;
  // ADR-069 Phase 1: 페이지 전환 + 선택을 단일 set()으로 병합
  // clearSelection + setCurrentPageId + setSelectedElement 3회 notify → 1회
  selectElementWithPageTransition: (
    elementId: string,
    targetPageId: string | null,
    options?: {
      editingContextId?: string | null;
      props?: ComponentElementProps;
    },
  ) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  goToHistoryIndex: (targetIndex: number) => Promise<void>;
  removeElement: (
    elementId: string,
    options?: { skipHistory?: boolean },
  ) => Promise<void>;
  removeElements: (
    elementIds: string[],
    options?: { skipHistory?: boolean },
  ) => Promise<void>;
  addComplexElement: (
    parentElement: Element,
    childElements: Element[],
  ) => Promise<void>;
  updateElementOrder: (elementId: string, orderNum: number) => void;
  batchUpdateElementOrders: (
    updates: Array<{ id: string; order_num: number }>,
  ) => void;
  moveElementToContainer: (
    elementId: string,
    newParentId: string,
    insertionIndex: number,
  ) => void;

  // 다중 선택 관련 액션
  toggleElementInSelection: (elementId: string) => void;
  setSelectedElements: (elementIds: string[]) => void;

  // 🚀 배치 업데이트 (100+ 요소 최적화)
  batchUpdateElementProps: (updates: BatchPropsUpdate[]) => Promise<void>;
  batchUpdateElements: (updates: BatchElementUpdate[]) => Promise<void>;

  // 🆕 Multi-page: 페이지 위치 관리
  initializePagePositions: (
    pages: Page[],
    pageWidth: number,
    pageHeight: number,
    gap: number,
    direction?: PageLayoutDirection,
  ) => void;
  updatePagePosition: (pageId: string, x: number, y: number) => void;

  // ADR-111 P3-α: reusable frame 캔버스 영역 setter
  /** frame id 의 좌표/크기 partial 갱신. 기존 entry 보존 후 patch merge. 신규 frame 은 미주입 필드를 0 으로 초기화. */
  updateFramePosition: (
    frameId: string,
    patch: Partial<{ x: number; y: number; width: number; height: number }>,
  ) => void;
  /** frame 삭제 시 좌표 entry 정리. 미존재 frame 은 no-op. */
  removeFramePosition: (frameId: string) => void;

  // 🚀 WebGL computed layout 동기화
  updateSelectedElementLayout: (
    elementId: string,
    layout: ComputedLayout,
  ) => void;

  // G.1: Instance 생성 액션
  createInstance: (
    masterRefId: string,
    parentId: string,
    pageId: string,
  ) => Element | null;
  detachInstance: (instanceId: string) => { previousState: Element } | null;
  toggleComponentOrigin: (
    elementId: string,
    options?: { beforeMutation?: () => void | Promise<void> },
  ) => Promise<{ elements: Element[]; previousElements: Element[] } | null>;
  resetInstanceOverrideField: (
    instanceId: string,
    fieldKey: string,
    descendantPath?: string,
  ) => { previousState: Element } | null;

  // ADR-006: 외부 트리거(텍스트 측정기 교체, 폰트 로딩 등)에서 레이아웃 재계산 요청
  invalidateLayout: () => void;

  // ADR-073: 일반화 items 조작 액션 (Menu/Select/ComboBox 공통, type-agnostic)
  addItem: (
    elementId: string,
    itemsKey: string,
    item?: Record<string, unknown>,
  ) => Promise<void>;
  removeItem: (
    elementId: string,
    itemsKey: string,
    itemId: string,
  ) => Promise<void>;
  updateItem: (
    elementId: string,
    itemsKey: string,
    itemId: string,
    patch: Record<string, unknown>,
  ) => Promise<void>;

  // ADR-099 Phase 4: Section/Separator 추가 액션
  /** items 배열 끝에 section 엔트리 삽입 */
  addSection: (
    elementId: string,
    itemsKey: string,
    header?: string,
  ) => Promise<void>;
  /** items 배열 끝에 separator 엔트리 삽입 (Menu 전용) */
  addSeparator: (elementId: string, itemsKey: string) => Promise<void>;
  /**
   * section 엔트리 내부 item 추가.
   * section 은 items 배열의 최상위 엔트리이므로 updateItem 과는 별도 경로 필요.
   */
  addItemToSection: (
    elementId: string,
    itemsKey: string,
    sectionId: string,
    item: Record<string, unknown>,
  ) => Promise<void>;
  /** section 엔트리 내부 item 제거 */
  removeItemFromSection: (
    elementId: string,
    itemsKey: string,
    sectionId: string,
    itemId: string,
  ) => Promise<void>;
  /** section 엔트리 내부 item 업데이트 */
  updateItemInSection: (
    elementId: string,
    itemsKey: string,
    sectionId: string,
    itemId: string,
    patch: Record<string, unknown>,
  ) => Promise<void>;

  // ADR-068: Menu items SSOT — StoredMenuItem 배열 조작 액션 (addItem의 thin wrapper)
  addMenuItem: (
    menuId: string,
    item?: Partial<StoredMenuItem>,
  ) => Promise<void>;
  removeMenuItem: (menuId: string, itemId: string) => Promise<void>;
  updateMenuItem: (
    menuId: string,
    itemId: string,
    patch: Partial<StoredMenuItem>,
  ) => Promise<void>;
  reorderMenuItems: (
    menuId: string,
    fromIndex: number,
    toIndex: number,
  ) => Promise<void>;
}

type PageActivationPatch = Pick<
  ElementsState,
  | "currentPageId"
  | "selectedElementId"
  | "selectedElementIds"
  | "selectedElementIdsSet"
  | "multiSelectMode"
  | "selectedElementProps"
  | "editingContextId"
  | "selectedTab"
>;

function findPageActivationBodyElement(
  elements: readonly Element[] | undefined,
): Element | null {
  return (
    elements?.find((element) => element.type.toLowerCase() === "body") ??
    elements?.find((element) => element.order_num === 0) ??
    null
  );
}

function resolvePageActivationTarget(
  state: ElementsState,
  pageId: string,
  elementId: string | null,
): Element | null {
  return (
    (elementId ? state.elementsMap.get(elementId) : undefined) ??
    findPageActivationBodyElement(state.pageElementsSnapshot[pageId])
  );
}

function collectElementSubtreeIds(
  rootId: string,
  childrenMap: Map<string, Element[]>,
): Set<string> {
  const subtreeIds = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (subtreeIds.has(currentId)) continue;
    subtreeIds.add(currentId);
    const children = childrenMap.get(currentId) ?? [];
    for (const child of children) {
      stack.push(child.id);
    }
  }
  return subtreeIds;
}

function createPageActivationPatch(
  state: ElementsState,
  pageId: string,
  elementId: string | null,
): PageActivationPatch {
  const targetElement = resolvePageActivationTarget(state, pageId, elementId);
  const nextSelectedElementId = targetElement?.id ?? null;

  return {
    currentPageId: pageId,
    selectedElementId: nextSelectedElementId,
    selectedElementIds: nextSelectedElementId ? [nextSelectedElementId] : [],
    selectedElementIdsSet: nextSelectedElementId
      ? new Set([nextSelectedElementId])
      : new Set<string>(),
    multiSelectMode: false,
    selectedElementProps: targetElement
      ? createCompleteProps(targetElement)
      : {},
    editingContextId: null,
    selectedTab: null,
  };
}

function hasAppliedPageActivationPatch(
  state: ElementsState,
  pageId: string,
  selectedElementId: string | null,
): boolean {
  const hasExpectedSelectionSet = selectedElementId
    ? state.selectedElementIds.length === 1 &&
      state.selectedElementIds[0] === selectedElementId &&
      state.selectedElementIdsSet.size === 1 &&
      state.selectedElementIdsSet.has(selectedElementId)
    : state.selectedElementIds.length === 0 &&
      state.selectedElementIdsSet.size === 0;

  return (
    state.currentPageId === pageId &&
    state.selectedElementId === selectedElementId &&
    hasExpectedSelectionSet &&
    state.multiSelectMode === false &&
    state.editingContextId === null &&
    state.selectedTab === null
  );
}

export const createElementsSlice: StateCreator<ElementsState> = (set, get) => {
  // undo/redo/goToHistoryIndex 함수 생성
  const undo = createUndoAction(set, get);
  const redo = createRedoAction(set, get);
  const goToHistoryIndex = createGoToHistoryIndexAction(set, get);

  // removeElement / removeElements 함수 생성
  const removeElement = createRemoveElementAction(set, get);
  const removeElements = createRemoveElementsAction(set, get);

  // addElement/addComplexElement 함수 생성
  const addElement = createAddElementAction(set, get);
  const addComplexElement = createAddComplexElementAction(set, get);

  // updateElementProps/updateElement 함수 생성
  const updateElementProps = createUpdateElementPropsAction(set, get);
  const updateElement = createUpdateElementAction(set, get);

  // 🚀 배치 업데이트 함수 생성 (100+ 요소 최적화)
  const batchUpdateElementProps = createBatchUpdateElementPropsAction(set, get);
  const batchUpdateElements = createBatchUpdateElementsAction(set, get);

  // 인덱스 재구축 순수 함수 (Fix 3: atomic update 지원)
  const buildIndexes = (elements: Element[]) => {
    const elementsMap = new Map<string, Element>();
    const childrenMap = new Map<string, Element[]>();

    elements.forEach((el) => {
      elementsMap.set(el.id, el);
      const parentId = el.parent_id || "root";
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(el);
    });

    const pageIndex = rebuildPageIndex(elements, elementsMap);
    const componentIndex = rebuildComponentIndex(elements);
    const variableUsageIndex = rebuildVariableUsageIndex(elements);
    const pageElementsSnapshot: Record<string, Element[]> = {};

    for (const [pageId, elementIds] of pageIndex.elementsByPage.entries()) {
      const pageElements = sortElementsByOrderThenSource(
        Array.from(elementIds)
          .map((id) => elementsMap.get(id))
          .filter((element): element is Element => Boolean(element)),
        elements,
      );
      pageElementsSnapshot[pageId] = pageElements;
    }

    return {
      pageElementsSnapshot,
      elementsMap,
      childrenMap,
      pageIndex,
      componentIndex,
      variableUsageIndex,
    };
  };

  // 인덱스 재구축 함수 (Phase 2: 페이지 인덱스 포함)
  const _rebuildIndexes = () => {
    const { elements } = get();
    set(buildIndexes(elements));
  };

  // 🆕 Phase 2: O(1) 페이지 요소 조회 함수
  const getPageElements = (pageId: string): Element[] => {
    const { pageIndex, elementsMap } = get();
    return getPageElementsFromIndex(pageIndex, pageId, elementsMap);
  };

  const applyFullSnapshot = (elements: Element[]) => {
    const { elements: normalizedElements } = normalizeElementTags(elements);
    const canonicalElements = normalizedElements.map((element) =>
      normalizeExternalFillIngress(element),
    );
    const nextIndexes = buildIndexes(canonicalElements);
    set((state) => ({
      elements: canonicalElements,
      ...nextIndexes,
      layoutVersion: state.layoutVersion + 1,
    }));
  };

  const clonePageIndex = (pageIndex: PageElementIndex): PageElementIndex => ({
    elementsByPage: new Map(
      Array.from(pageIndex.elementsByPage.entries(), ([pageId, ids]) => [
        pageId,
        new Set(ids),
      ]),
    ),
    rootsByPage: new Map(
      Array.from(pageIndex.rootsByPage.entries(), ([pageId, rootIds]) => [
        pageId,
        [...rootIds],
      ]),
    ),
  });

  const cloneComponentIndex = (
    componentIndex: ComponentIndex,
  ): ComponentIndex => ({
    masterToInstances: new Map(
      Array.from(
        componentIndex.masterToInstances.entries(),
        ([masterRefId, ids]) => [masterRefId, new Set(ids)],
      ),
    ),
    masterComponents: new Map(componentIndex.masterComponents),
  });

  const cloneVariableUsageIndex = (
    variableUsageIndex: VariableUsageIndex,
  ): VariableUsageIndex => ({
    variableToElements: new Map(
      Array.from(
        variableUsageIndex.variableToElements.entries(),
        ([variableName, ids]) => [variableName, new Set(ids)],
      ),
    ),
  });

  // ADR-116 G5-B P5-C: legacy role literal
  // 검사 → isMasterElement / isInstanceElement 호출로 단일화. 두 type guard
  // 자체는 read-through fallback marker 보존 (legacy 의미 유지).
  const indexComponentElement = (
    componentIndex: ComponentIndex,
    element: Element,
  ) => {
    if (isMasterElement(element)) {
      componentIndex.masterComponents.set(element.id, element);
    }

    // ADR-116 G5-B P5-D: legacy origin direct property access →
    // getInstanceMasterRef helper 호출 단일화 (canonical RefNode 의 ref 도
    // 자동 호환). isInstanceElement 가 strict legacy 이므로 본 분기에서는
    // legacy origin 만 도달, helper 의 canonical 분기는 dead in this branch
    // (안전).
    if (isInstanceElement(element)) {
      const masterRef = getInstanceMasterRef(element);
      if (!masterRef) return;
      if (!componentIndex.masterToInstances.has(masterRef)) {
        componentIndex.masterToInstances.set(masterRef, new Set());
      }
      componentIndex.masterToInstances.get(masterRef)!.add(element.id);
    }
  };

  const unindexComponentElement = (
    componentIndex: ComponentIndex,
    element: Element,
  ) => {
    if (isMasterElement(element)) {
      componentIndex.masterComponents.delete(element.id);
      componentIndex.masterToInstances.delete(element.id);
    }

    if (isInstanceElement(element)) {
      const masterRef = getInstanceMasterRef(element);
      if (!masterRef) return;
      const instanceIds = componentIndex.masterToInstances.get(masterRef);
      if (instanceIds) {
        instanceIds.delete(element.id);
        if (instanceIds.size === 0) {
          componentIndex.masterToInstances.delete(masterRef);
        }
      }
    }
  };

  const indexVariableUsageElement = (
    variableUsageIndex: VariableUsageIndex,
    element: Element,
  ) => {
    if (!element.variableBindings || element.variableBindings.length === 0) {
      return;
    }

    for (const variableName of element.variableBindings) {
      if (!variableUsageIndex.variableToElements.has(variableName)) {
        variableUsageIndex.variableToElements.set(variableName, new Set());
      }
      variableUsageIndex.variableToElements.get(variableName)!.add(element.id);
    }
  };

  const unindexVariableUsageElement = (
    variableUsageIndex: VariableUsageIndex,
    element: Element,
  ) => {
    if (!element.variableBindings || element.variableBindings.length === 0) {
      return;
    }

    for (const variableName of element.variableBindings) {
      const elementIds =
        variableUsageIndex.variableToElements.get(variableName);
      if (!elementIds) {
        continue;
      }
      elementIds.delete(element.id);
      if (elementIds.size === 0) {
        variableUsageIndex.variableToElements.delete(variableName);
      }
    }
  };

  // 🚀 Phase 4.3: 인스펙터 props hydration을 백그라운드 우선순위로 분리
  // WebGL Canvas의 pointerdown task를 짧게 유지하기 위해,
  // selectedElementProps(종종 큰 객체)는 브라우저 유휴 시간에 채웁니다.
  let cancelHydrateTask: (() => void) | null = null;

  const cancelHydrateSelectedProps = () => {
    if (cancelHydrateTask) {
      cancelHydrateTask();
      cancelHydrateTask = null;
    }
  };

  const scheduleHydrateSelectedProps = (elementId: string) => {
    if (typeof window === "undefined") {
      // SSR/특수 환경: 동기 처리
      const state = get();
      const element =
        state.elementsMap.get(elementId) ??
        findElementById(state.elements, elementId);
      if (!element) return;
      // 🚀 WebGL 요소의 computedStyle 포함 (borderRadius 등)
      const computedStyle = computeCanvasElementStyle(element);
      set({
        selectedElementProps: {
          ...createCompleteProps(element),
          computedStyle,
        },
      });
      return;
    }

    cancelHydrateSelectedProps();

    // 🚀 Phase 4.3: scheduler.postTask('background') 또는 requestIdleCallback 사용
    // - 캔버스 렌더링보다 낮은 우선순위
    // - 브라우저 유휴 시간에 실행되어 Long Task 분할
    cancelHydrateTask = scheduleCancelableBackgroundTask(
      () => {
        cancelHydrateTask = null;

        const state = get();
        if (state.selectedElementId !== elementId) return; // stale update 방지

        const element =
          state.elementsMap.get(elementId) ??
          findElementById(state.elements, elementId);
        if (!element) return;

        longTaskMonitor.measure(
          "interaction.select:hydrate-selected-props",
          () => {
            // 🚀 WebGL 요소의 computedStyle만 추가 (borderRadius 등)
            // 기본 props는 setSelectedElement에서 이미 동기적으로 설정됨
            const computedStyle = computeCanvasElementStyle(element);
            const currentProps = state.selectedElementProps;
            const hasValidProps =
              currentProps && Object.keys(currentProps).length > 0;

            if (hasValidProps) {
              // props가 이미 있으면 computedStyle만 병합 (불필요한 리렌더 방지)
              set({ selectedElementProps: { ...currentProps, computedStyle } });
            } else {
              // fallback: 전체 props 재구성
              set({
                selectedElementProps: {
                  ...createCompleteProps(element),
                  computedStyle,
                },
              });
            }
          },
        );
      },
      { timeout: 50 },
    ); // 50ms 내에 실행 보장
  };

  return {
    elements: [],
    pageElementsSnapshot: {},
    elementsMap: new Map(),
    childrenMap: new Map(),
    // 🆕 Phase 2: 페이지 인덱스 초기값
    pageIndex: createEmptyPageIndex(),
    componentIndex: createEmptyComponentIndex(),
    variableUsageIndex: createEmptyVariableUsageIndex(),
    selectedElementId: null,
    selectedElementProps: {},
    selectedTab: null,
    pages: [],
    currentPageId: null,
    historyOperationInProgress: false,
    // ⭐ Multi-select state
    selectedElementIds: [],
    // 🚀 O(1) 검색용 Set
    selectedElementIdsSet: new Set<string>(),
    multiSelectMode: false,
    editingContextId: null,

    // 🆕 Multi-page: 페이지별 캔버스 위치
    pagePositions: {},
    pagePositionsVersion: 0,

    // ADR-111 P3-α: reusable frame 캔버스 영역 초기값
    framePositions: {},
    framePositionsVersion: 0,

    // ADR-006 P3-1: Dirty Tracking 초기값
    layoutVersion: 0,
    dirtyElementIds: new Set<string>(),
    clearDirtyElementIds: () => set({ dirtyElementIds: new Set<string>() }),

    _rebuildIndexes,
    _cancelHydrateSelectedProps: cancelHydrateSelectedProps,
    getPageElements,

    // 🚀 Phase 1: Immer → 함수형 업데이트 (Low Risk)
    // setElements는 내부 상태 관리용이므로 히스토리 기록하지 않음
    // 실제 요소 변경은 addElement, updateElementProps, removeElement에서 처리
    setElements: (elements) => {
      applyFullSnapshot(elements);
    },

    hydrateProjectSnapshot: (elements) => {
      applyFullSnapshot(elements);
    },

    recoverElementsSnapshot: (elements) => {
      applyFullSnapshot(elements);
    },

    mergeElements: (elements) => {
      if (elements.length === 0) {
        return;
      }

      const { elements: normalizedElements } = normalizeElementTags(elements);
      const canonicalElements = normalizedElements.map((element) =>
        normalizeExternalFillIngress(element),
      );
      set((state) => {
        const mergedMap = new Map(state.elementsMap);
        let changed = false;

        canonicalElements.forEach((element) => {
          const previous = mergedMap.get(element.id);
          if (previous !== element) {
            changed = true;
          }
          mergedMap.set(element.id, element);
        });

        if (!changed) {
          return state;
        }

        const mergedElements = Array.from(mergedMap.values());
        const nextIndexes = buildIndexes(mergedElements);

        return {
          ...state,
          elements: mergedElements,
          ...nextIndexes,
          layoutVersion: state.layoutVersion + 1,
        };
      });
    },

    replaceElementId: (oldId, newId) => {
      if (!oldId || !newId || oldId === newId) {
        return;
      }

      set((state) => {
        const targetElement = state.elementsMap.get(oldId);
        if (!targetElement) {
          return state;
        }

        const updatedElements = state.elements.map((element) => {
          if (element.id === oldId) {
            return { ...element, id: newId };
          }
          if (element.parent_id === oldId) {
            return { ...element, parent_id: newId };
          }
          return element;
        });
        const nextIndexes = buildIndexes(updatedElements);

        const nextSelectedElementId =
          state.selectedElementId === oldId ? newId : state.selectedElementId;
        const nextSelectedElementIds = state.selectedElementIds.map((id) =>
          id === oldId ? newId : id,
        );
        const nextEditingContextId =
          state.editingContextId === oldId ? newId : state.editingContextId;
        const nextSelectedTab =
          state.selectedTab?.parentId === oldId
            ? { ...state.selectedTab, parentId: newId }
            : state.selectedTab;

        return {
          ...state,
          elements: updatedElements,
          ...nextIndexes,
          selectedElementId: nextSelectedElementId,
          selectedElementIds: nextSelectedElementIds,
          selectedElementIdsSet: new Set(nextSelectedElementIds),
          selectedElementProps:
            nextSelectedElementId === newId
              ? createCompleteProps({ ...targetElement, id: newId })
              : state.selectedElementProps,
          editingContextId: nextEditingContextId,
          selectedTab: nextSelectedTab,
          layoutVersion: state.layoutVersion + 1,
        };
      });
    },

    // 🚀 Phase 1: Immer → 함수형 업데이트 (Low Risk)
    loadPageElements: (elements, pageId) => {
      // 레거시 태그(section)를 canonical 태그(Section)로 정규화
      const {
        elements: normalizedElements,
        updatedElements: normalizedTagElements,
      } = normalizeElementTags(elements);

      // orphan 요소들을 body로 마이그레이션
      const {
        elements: migratedElements,
        updatedElements: orphanMigratedElements,
      } = ElementUtils.migrateOrphanElementsToBody(normalizedElements, pageId);

      // 페이지 변경 시 히스토리 초기화
      historyManager.setCurrentPage(pageId);
      const nextIndexes = buildIndexes(migratedElements);
      set((state) => {
        const nextState = {
          ...state,
          elements: migratedElements,
          ...nextIndexes,
        };

        return {
          elements: migratedElements,
          ...nextIndexes,
          ...createPageActivationPatch(nextState, pageId, null),
          layoutVersion: state.layoutVersion + 1,
        };
      });

      // 정규화/마이그레이션으로 변경된 요소가 있으면 DB에도 저장 (백그라운드)
      const changedElementIds = new Set<string>([
        ...normalizedTagElements.map((el) => el.id),
        ...orphanMigratedElements.map((el) => el.id),
      ]);

      if (changedElementIds.size > 0) {
        const elementById = new Map(migratedElements.map((el) => [el.id, el]));
        const elementsToPersist = Array.from(changedElementIds)
          .map((id) => elementById.get(id))
          .filter((el): el is Element => Boolean(el));

        Promise.all(
          elementsToPersist.map((el) =>
            updateElementCanonicalPrimary(el.id, el),
          ),
        )
          .then(() => {
            console.log(
              `✅ ${elementsToPersist.length}개 요소 정규화/마이그레이션 DB 업데이트 완료`,
            );
          })
          .catch((error) => {
            console.warn(
              "⚠️ 요소 정규화/마이그레이션 DB 업데이트 실패:",
              error,
            );
          });
      }

      // 페이지 로드 직후 즉시 order_num 재정렬 (검증보다 먼저 실행)
      // ⚡ setTimeout(50) → queueMicrotask: 초기 로드와 reorder 사이의 타이밍 갭 제거
      // 50ms 지연은 불필요한 재렌더링과 Skia 캐시 무효화를 유발함
      queueMicrotask(() => {
        const { elements: latestElements, batchUpdateElementOrders } = get();
        reorderElements(latestElements, pageId, batchUpdateElementOrders);
      });
    },

    // Factory 함수로 생성된 addElement 사용
    addElement,

    // Factory 함수로 생성된 updateElementProps 사용
    updateElementProps,

    // Factory 함수로 생성된 updateElement 사용
    updateElement,

    // 🚀 Phase 1: Immer → 함수형 업데이트 (Medium Risk)
    // 🚀 Phase 6.3: 참조 안정성 최적화 - 불필요한 상태 업데이트 방지
    setSelectedElement: (elementId, props, style, computedStyle) => {
      const startTime = performance.now();
      cancelHydrateSelectedProps();

      const currentState = get();

      // 🚀 Early Return: 동일한 요소 선택 시 (props/style/computedStyle 없는 경우)
      // - 같은 요소를 클릭해도 불필요한 리렌더 방지
      if (
        elementId === currentState.selectedElementId &&
        !props &&
        !style &&
        !computedStyle
      ) {
        return; // 변경 없음
      }

      const hasExternalProps = Boolean(props || style || computedStyle);

      // WebGL Canvas 기본 선택 경로: elementId만 전달됨
      // 🚀 Performance: 2단계 set()으로 분리하여 paint 차단 최소화
      // - Phase 1 (즉시): 캔버스 하이라이트용 상태 (selectedElementId, Ids, IdsSet)
      // - Phase 2 (RAF): 인스펙터용 상태 (selectedElementProps)
      //   → StylesPanel 훅들이 Phase 1에서 element.props fallback으로
      //     기본값을 사용하고, Phase 2에서 완전한 props로 갱신
      if (elementId && !hasExternalProps) {
        let selectedElementIds: string[];
        let selectedElementIdsSet: Set<string>;

        if (
          elementId === currentState.selectedElementId &&
          currentState.selectedElementIds.length === 1
        ) {
          selectedElementIds = currentState.selectedElementIds;
          selectedElementIdsSet = currentState.selectedElementIdsSet;
        } else {
          selectedElementIds = [elementId];
          selectedElementIdsSet = new Set([elementId]);
        }

        // Phase 1: 캔버스 하이라이트 즉시 반영 (selectedElementProps 미변경 — hydrate가 담당)
        set({
          selectedElementId: elementId,
          selectedElementIds,
          selectedElementIdsSet,
          multiSelectMode: false,
        });

        // Phase 2: 인스펙터용 props를 다음 프레임에서 설정
        scheduleNextFrame(() => {
          const latestState = get();
          // 선택이 이미 변경되었으면 스킵
          if (latestState.selectedElementId !== elementId) return;

          const element =
            latestState.elementsMap.get(elementId) ??
            findElementById(latestState.elements, elementId);
          const initialProps = element ? createCompleteProps(element) : {};

          set({ selectedElementProps: initialProps });
        });

        // computedStyle만 백그라운드 hydration으로 분리
        scheduleHydrateSelectedProps(elementId);
        const duration = performance.now() - startTime;
        if (duration >= 8) {
          console.log("[perf] store.set-selected-element.sync", {
            durationMs: Number(duration.toFixed(1)),
            elementId,
            mode: "deferred-props",
          });
        }
        return;
      }

      let resolvedProps = props;

      if (elementId && !resolvedProps) {
        const { elementsMap, elements } = currentState;
        const element =
          elementsMap.get(elementId) ?? findElementById(elements, elementId);
        if (element) {
          resolvedProps = createCompleteProps(element);
        }
      }

      // 🚀 Phase 6.3: 상태 업데이트 최소화
      // - style/computedStyle이 없으면 기존 객체 재사용 시도
      let selectedElementProps: ComponentElementProps;
      if (elementId && resolvedProps) {
        if (!style && !computedStyle) {
          // style/computedStyle 없으면 resolvedProps 그대로 사용 (새 객체 생성 X)
          selectedElementProps = resolvedProps;
        } else {
          selectedElementProps = {
            ...resolvedProps,
            ...(style ? { style } : {}),
            ...(computedStyle ? { computedStyle } : {}),
          };
        }
      } else {
        selectedElementProps = {};
      }

      // ⭐ SelectionState와 동기화
      // 🚀 Phase 6.3: 동일한 요소면 배열/Set 재생성 스킵
      let selectedElementIds: string[];
      let selectedElementIdsSet: Set<string>;

      if (
        elementId === currentState.selectedElementId &&
        currentState.selectedElementIds.length === 1
      ) {
        // 같은 요소 선택 - 기존 배열/Set 재사용
        selectedElementIds = currentState.selectedElementIds;
        selectedElementIdsSet = currentState.selectedElementIdsSet;
      } else {
        selectedElementIds = elementId ? [elementId] : [];
        selectedElementIdsSet = elementId
          ? new Set([elementId])
          : new Set<string>();
      }

      set({
        selectedElementId: elementId,
        selectedElementProps,
        selectedElementIds,
        selectedElementIdsSet,
        multiSelectMode: false,
      });

      const duration = performance.now() - startTime;
      if (duration >= 8) {
        console.log("[perf] store.set-selected-element.sync", {
          durationMs: Number(duration.toFixed(1)),
          elementId,
          mode: hasExternalProps ? "external-props" : "resolved-props",
        });
      }
    },

    // 🚀 Phase 1: Immer → 함수형 업데이트 (Medium Risk)
    selectTabElement: (elementId, props, tabIndex) =>
      set({
        selectedElementId: elementId,
        selectedElementProps: props,
        selectedTab: { parentId: elementId, tabIndex },
      }),

    // 🚀 Phase 1: Immer → 함수형 업데이트 (Low Risk)
    setPages: (pages) =>
      set((state) => {
        const shouldInvalidateLayout = shouldInvalidatePagesLayout(
          state.pages,
          pages,
        );

        return {
          pages,
          ...(shouldInvalidateLayout
            ? { layoutVersion: state.layoutVersion + 1 }
            : {}),
        };
      }),

    appendPageShell: (page, bodyElement, position, options) => {
      const activate = options?.activate ?? true;
      if (activate) {
        historyManager.setCurrentPage(page.id);
      }

      const startTime = performance.now();
      set((state) => {
        const nextElements = [...state.elements, bodyElement];
        const nextPages = [...state.pages, page];
        const nextElementsMap = new Map(state.elementsMap);
        nextElementsMap.set(bodyElement.id, bodyElement);

        const nextChildrenMap = new Map(state.childrenMap);
        const rootChildren = nextChildrenMap.get("root") ?? [];
        nextChildrenMap.set("root", [...rootChildren, bodyElement]);

        const nextPageIndex = clonePageIndex(state.pageIndex);
        indexElement(nextPageIndex, bodyElement, nextElementsMap);
        const nextComponentIndex = cloneComponentIndex(state.componentIndex);
        indexComponentElement(nextComponentIndex, bodyElement);
        const nextVariableUsageIndex = cloneVariableUsageIndex(
          state.variableUsageIndex,
        );
        indexVariableUsageElement(nextVariableUsageIndex, bodyElement);
        const nextPageElementsSnapshot = {
          ...state.pageElementsSnapshot,
          [page.id]: [bodyElement],
        };

        return {
          pages: nextPages,
          currentPageId: activate ? page.id : state.currentPageId,
          elements: nextElements,
          elementsMap: nextElementsMap,
          childrenMap: nextChildrenMap,
          pageElementsSnapshot: nextPageElementsSnapshot,
          pageIndex: nextPageIndex,
          componentIndex: nextComponentIndex,
          variableUsageIndex: nextVariableUsageIndex,
          selectedElementId: activate
            ? bodyElement.id
            : state.selectedElementId,
          selectedElementIds: activate
            ? [bodyElement.id]
            : state.selectedElementIds,
          selectedElementIdsSet: activate
            ? new Set([bodyElement.id])
            : state.selectedElementIdsSet,
          multiSelectMode: activate ? false : state.multiSelectMode,
          selectedElementProps: activate
            ? createCompleteProps(bodyElement)
            : state.selectedElementProps,
          editingContextId: activate ? null : state.editingContextId,
          pagePositions: {
            ...state.pagePositions,
            [page.id]: position,
          },
          pagePositionsVersion: state.pagePositionsVersion + 1,
          layoutVersion: state.layoutVersion + 1,
        };
      });

      const duration = performance.now() - startTime;
      if (duration >= 8) {
        console.log("[perf] store.append-page-shell", {
          durationMs: Number(duration.toFixed(1)),
          pageId: page.id,
        });
      }
    },

    removePageLocal: (pageId, nextSelection) => {
      const startTime = performance.now();
      set((state) => {
        const removedElements =
          getPageElementsFromIndex(
            state.pageIndex,
            pageId,
            state.elementsMap,
          ) ?? state.elements.filter((element) => element.page_id === pageId);
        const removedElementIds = new Set(
          removedElements.map((element) => element.id),
        );
        const nextPages = state.pages.filter((page) => page.id !== pageId);
        const nextElements = state.elements.filter(
          (element) => !removedElementIds.has(element.id),
        );
        const nextElementsMap = new Map(state.elementsMap);
        const nextChildrenMap = new Map(state.childrenMap);
        const nextPageIndex = clonePageIndex(state.pageIndex);
        const nextComponentIndex = cloneComponentIndex(state.componentIndex);
        const nextVariableUsageIndex = cloneVariableUsageIndex(
          state.variableUsageIndex,
        );

        removedElements.forEach((element) => {
          nextElementsMap.delete(element.id);
          nextChildrenMap.delete(element.id);

          const parentId = element.parent_id || "root";
          const siblings = nextChildrenMap.get(parentId);
          if (siblings) {
            const nextSiblings = siblings.filter(
              (child) => child.id !== element.id,
            );
            if (nextSiblings.length > 0) {
              nextChildrenMap.set(parentId, nextSiblings);
            } else {
              nextChildrenMap.delete(parentId);
            }
          }

          unindexElement(nextPageIndex, element);
          unindexComponentElement(nextComponentIndex, element);
          unindexVariableUsageElement(nextVariableUsageIndex, element);
        });

        const nextPagePositions = { ...state.pagePositions };
        delete nextPagePositions[pageId];
        const nextPageElementsSnapshot = { ...state.pageElementsSnapshot };
        delete nextPageElementsSnapshot[pageId];

        const requestedElementId = nextSelection?.elementId ?? null;
        const requestedPageId = nextSelection?.pageId ?? null;
        const requestedElementIsValid =
          requestedElementId !== null &&
          nextElementsMap.has(requestedElementId);
        const nextSelectedElementIds = requestedElementIsValid
          ? [requestedElementId]
          : state.selectedElementIds.filter((id) => nextElementsMap.has(id));
        const nextSelectedElementId = requestedElementIsValid
          ? requestedElementId
          : state.selectedElementId &&
              nextElementsMap.has(state.selectedElementId)
            ? state.selectedElementId
            : (nextSelectedElementIds[0] ?? null);
        const nextEditingContextId =
          state.editingContextId && nextElementsMap.has(state.editingContextId)
            ? state.editingContextId
            : null;
        const nextCurrentPageId =
          requestedPageId !== null
            ? requestedPageId
            : state.currentPageId === pageId
              ? null
              : state.currentPageId;

        return {
          pages: nextPages,
          elements: nextElements,
          elementsMap: nextElementsMap,
          childrenMap: nextChildrenMap,
          pageElementsSnapshot: nextPageElementsSnapshot,
          pageIndex: nextPageIndex,
          componentIndex: nextComponentIndex,
          variableUsageIndex: nextVariableUsageIndex,
          pagePositions: nextPagePositions,
          pagePositionsVersion: state.pagePositionsVersion + 1,
          currentPageId: nextCurrentPageId,
          selectedElementId: nextSelectedElementId,
          selectedElementIds: nextSelectedElementIds,
          selectedElementIdsSet: new Set(nextSelectedElementIds),
          multiSelectMode: nextSelectedElementIds.length > 1,
          selectedElementProps: nextSelectedElementId
            ? createCompleteProps(nextElementsMap.get(nextSelectedElementId)!)
            : {},
          editingContextId: nextEditingContextId,
          layoutVersion: state.layoutVersion + 1,
        };
      });

      const duration = performance.now() - startTime;
      if (duration >= 8) {
        console.log("[perf] store.remove-page-local", {
          durationMs: Number(duration.toFixed(1)),
          pageId,
        });
      }
    },

    // ADR-040 Phase 2: Atomic Page Activation — 중복 activation 방어 + 단일 commit
    activatePage: (pageId, elementId = null) => {
      const state = get();
      const targetElement = resolvePageActivationTarget(
        state,
        pageId,
        elementId,
      );
      const nextSelectedElementId = targetElement?.id ?? null;
      // 동일 페이지 + 동일 요소 선택이면 중복 commit 방지
      if (hasAppliedPageActivationPatch(state, pageId, nextSelectedElementId)) {
        return;
      }

      const startTime = performance.now();
      historyManager.setCurrentPage(pageId);
      set((prevState) =>
        createPageActivationPatch(prevState, pageId, elementId),
      );

      const duration = performance.now() - startTime;
      if (duration >= 8) {
        console.log("[perf] store.activate-page", {
          durationMs: Number(duration.toFixed(1)),
          pageId,
          elementId,
        });
      }
    },

    // Page activation alias. Use activatePage semantics so currentPageId and
    // selected page body cannot drift when older call sites switch pages.
    setCurrentPageId: (pageId) => {
      observe(PERF_LABEL.INPUT_PAGE_TRANSITION, () => {
        const state = get();
        const targetElement = resolvePageActivationTarget(state, pageId, null);
        const nextSelectedElementId = targetElement?.id ?? null;
        if (
          hasAppliedPageActivationPatch(state, pageId, nextSelectedElementId)
        ) {
          return;
        }

        const startTime = performance.now();
        historyManager.setCurrentPage(pageId);
        set((prevState) => createPageActivationPatch(prevState, pageId, null));
        const duration = performance.now() - startTime;
        if (duration >= 8) {
          console.log("[perf] store.set-current-page", {
            durationMs: Number(duration.toFixed(1)),
            pageId,
          });
        }
      });
    },

    // ADR-069 Phase 1: 페이지 전환 + 선택 동시 처리 — 단일 set() 보장
    // 기존 3-set 조합(clearSelection + setCurrentPageId + setSelectedElement)은
    // 외부 store notify를 3회 발생시켜 구독자 fan-out이 누적된다.
    // 본 action은 selection + currentPageId + editingContextId + multiSelectMode를
    // 한 번의 set()에 병합하고, props hydrate는 기존 Phase2 패턴(scheduleNextFrame)
    // 을 그대로 유지한다.
    selectElementWithPageTransition: (elementId, targetPageId, options) => {
      const currentState = get();
      const shouldChangePage =
        targetPageId != null && targetPageId !== currentState.currentPageId;
      const shouldSetEditingContext =
        options != null &&
        Object.prototype.hasOwnProperty.call(options, "editingContextId");
      const externalProps = options?.props;

      // ADR-074 Phase 5: 페이지 전환이 실제 발생하는 경우에만
      // input.page-transition 라벨로 계측. selection-only 경로는 통계 왜곡
      // 방지를 위해 unlabeled 유지.
      const doWork = () => {
        const startTime = performance.now();
        cancelHydrateSelectedProps();

        if (shouldChangePage) {
          historyManager.setCurrentPage(targetPageId);
        }

        // Phase 1 (즉시): 캔버스 하이라이트용 상태 병합
        set({
          ...(shouldChangePage ? { currentPageId: targetPageId } : {}),
          ...(shouldSetEditingContext
            ? { editingContextId: options?.editingContextId ?? null }
            : shouldChangePage
              ? { editingContextId: null }
              : {}),
          selectedElementId: elementId,
          selectedElementIds: [elementId],
          selectedElementIdsSet: new Set([elementId]),
          multiSelectMode: false,
          ...(externalProps ? { selectedElementProps: externalProps } : {}),
        });

        // Phase 2 (다음 프레임): 인스펙터용 props hydrate
        scheduleNextFrame(() => {
          const latestState = get();
          if (latestState.selectedElementId !== elementId) return;

          const element =
            latestState.elementsMap.get(elementId) ??
            findElementById(latestState.elements, elementId);
          const initialProps = element
            ? createCompleteProps(element)
            : (externalProps ?? {});

          set({ selectedElementProps: initialProps });
        });

        // computedStyle 백그라운드 hydration
        scheduleHydrateSelectedProps(elementId);

        const duration = performance.now() - startTime;
        if (duration >= 8) {
          console.log("[perf] store.select-with-page-transition", {
            durationMs: Number(duration.toFixed(1)),
            elementId,
            targetPageId,
            pageChanged: shouldChangePage,
          });
        }
      };

      if (shouldChangePage) {
        observe(PERF_LABEL.INPUT_PAGE_TRANSITION, doWork);
      } else {
        doWork();
      }
    },

    undo,

    redo,

    goToHistoryIndex,

    removeElement,
    removeElements,

    // Factory 함수로 생성된 addComplexElement 사용
    addComplexElement,

    // 🚀 Phase 1: Immer → 함수형 업데이트 (High Risk)
    updateElementOrder: (elementId, orderNum) => {
      const { elements } = get();
      const updatedElements = elements.map((el) =>
        el.id === elementId ? { ...el, order_num: orderNum } : el,
      );
      set((state) => ({
        elements: updatedElements,
        layoutVersion: state.layoutVersion + 1,
      }));
      get()._rebuildIndexes();
      if (areCanonicalMutationStoreActionsRegistered()) {
        const updatedElement = updatedElements.find(
          (el) => el.id === elementId,
        );
        if (updatedElement) {
          mergeElementsCanonicalPrimary([updatedElement]);
        }
      }
    },

    // 배치 order_num 업데이트 (단일 set() + _rebuildIndexes())
    batchUpdateElementOrders: (updates) => {
      if (updates.length === 0) return;
      const { elements } = get();
      const updateMap = new Map(updates.map((u) => [u.id, u.order_num]));
      const updatedElements = elements.map((el) => {
        const newOrder = updateMap.get(el.id);
        return newOrder !== undefined ? { ...el, order_num: newOrder } : el;
      });
      set((state) => ({
        elements: updatedElements,
        layoutVersion: state.layoutVersion + 1,
      }));
      get()._rebuildIndexes();
      if (areCanonicalMutationStoreActionsRegistered()) {
        const updatedElementMap = new Map(
          updatedElements.map((updated) => [updated.id, updated]),
        );
        const changedElements = updates
          .map((update) => updatedElementMap.get(update.id))
          .filter((updated): updated is Element => Boolean(updated));
        if (changedElements.length > 0) {
          mergeElementsCanonicalPrimary(changedElements);
        }
      }
    },

    // cross-container 이동: parent_id 변경 + 양쪽 컨테이너 order_num 재정렬
    moveElementToContainer: (elementId, newParentId, insertionIndex) => {
      const prevState = get();
      const element = prevState.elementsMap.get(elementId);
      if (!element || !element.parent_id) return;

      const oldParentId = element.parent_id;
      if (oldParentId === newParentId) return; // same parent → batchUpdateElementOrders 사용
      const newParent = prevState.elementsMap.get(newParentId);
      if (!newParent) return;
      const targetPageId = newParent.page_id ?? element.page_id ?? null;
      const subtreeIds = collectElementSubtreeIds(
        elementId,
        prevState.childrenMap,
      );

      // childrenMap props는 stale → elementsMap에서 최신 조회
      const oldSiblings = (prevState.childrenMap.get(oldParentId) ?? [])
        .map((c) => prevState.elementsMap.get(c.id))
        .filter((c): c is Element => c !== undefined);
      const newSiblings = (prevState.childrenMap.get(newParentId) ?? [])
        .map((c) => prevState.elementsMap.get(c.id))
        .filter((c): c is Element => c !== undefined);

      // 변경 맵 구성: id → { parent_id?, order_num }
      const updateMap = new Map<
        string,
        { page_id?: string | null; parent_id?: string; order_num?: number }
      >();

      // 구 부모: 드래그 요소 제거 후 나머지 재정렬
      const remainingOld = sortElementsByOrderThenSource(
        oldSiblings.filter((c) => c.id !== elementId),
        oldSiblings,
      );
      remainingOld.forEach((c, i) => updateMap.set(c.id, { order_num: i }));

      // 신 부모: 삽입 위치에 요소 추가 후 재정렬
      const sortedNew = sortElementsByOrderThenSource(newSiblings);
      const newOrder = [
        ...sortedNew.slice(0, insertionIndex),
        element,
        ...sortedNew.slice(insertionIndex),
      ];
      newOrder.forEach((c, i) => {
        if (c.id === elementId) {
          updateMap.set(c.id, {
            page_id: targetPageId,
            parent_id: newParentId,
            order_num: i,
          });
        } else {
          updateMap.set(c.id, { order_num: i });
        }
      });

      for (const subtreeId of subtreeIds) {
        if (subtreeId === elementId) continue;
        const current = prevState.elementsMap.get(subtreeId);
        if (!current || current.page_id === targetPageId) continue;
        updateMap.set(subtreeId, {
          ...(updateMap.get(subtreeId) ?? {}),
          page_id: targetPageId,
        });
      }

      // 단일 set()으로 전체 적용 (prevState와 동일 스냅샷 사용)
      const updatedElements = prevState.elements.map((el) => {
        const upd = updateMap.get(el.id);
        if (!upd) return el;
        return {
          ...el,
          ...(upd.order_num !== undefined ? { order_num: upd.order_num } : {}),
          ...(upd.parent_id ? { parent_id: upd.parent_id } : {}),
          ...(upd.page_id !== undefined ? { page_id: upd.page_id } : {}),
        };
      });

      set((state) => ({
        elements: updatedElements,
        layoutVersion: state.layoutVersion + 1,
      }));
      get()._rebuildIndexes();
      if (areCanonicalMutationStoreActionsRegistered()) {
        const updatedElementMap = new Map(
          updatedElements.map((updated) => [updated.id, updated]),
        );
        const changedElements = Array.from(updateMap.keys())
          .map((id) => updatedElementMap.get(id))
          .filter((updated): updated is Element => Boolean(updated));
        if (changedElements.length > 0) {
          mergeElementsCanonicalPrimary(changedElements);
        }
      }
    },

    // 🚀 Phase 1: Immer → 함수형 업데이트 (High Risk)
    // ⭐ 다중 선택: 요소를 선택 목록에서 추가/제거 (토글)
    toggleElementInSelection: (elementId: string) => {
      const state = get();
      const { elementsMap, elements, selectedElementIdsSet } = state;

      const resolveCompleteProps = (id: string) => {
        const element = elementsMap.get(id) ?? findElementById(elements, id);
        return element ? createCompleteProps(element) : null;
      };

      // 🚀 O(1) 검색용 Set 사용
      const isAlreadySelected = selectedElementIdsSet.has(elementId);

      if (isAlreadySelected) {
        // 이미 선택됨 → 제거
        const newSet = new Set(selectedElementIdsSet);
        newSet.delete(elementId);
        const newSelectedIds = Array.from(newSet);

        if (newSelectedIds.length === 0) {
          // 선택이 비어있으면 다중 선택 모드 해제
          set({
            selectedElementIds: [],
            selectedElementIdsSet: new Set<string>(),
            multiSelectMode: false,
            selectedElementId: null,
            selectedElementProps: {},
          });
        } else {
          // 첫 번째 요소를 primary selection으로 유지
          const nextProps = resolveCompleteProps(newSelectedIds[0]);
          set({
            selectedElementIds: newSelectedIds,
            selectedElementIdsSet: newSet,
            selectedElementId: newSelectedIds[0],
            selectedElementProps: nextProps || {},
          });
        }
      } else {
        // 선택 안 됨 → 추가
        const newSet = new Set(selectedElementIdsSet);
        newSet.add(elementId);
        const newSelectedIds = Array.from(newSet);

        if (newSelectedIds.length === 1) {
          // 첫 번째로 추가되는 경우 primary selection 설정
          const nextProps = resolveCompleteProps(elementId);
          set({
            selectedElementIds: newSelectedIds,
            selectedElementIdsSet: newSet,
            multiSelectMode: true,
            selectedElementId: elementId,
            selectedElementProps: nextProps || {},
          });
        } else {
          set({
            selectedElementIds: newSelectedIds,
            selectedElementIdsSet: newSet,
            multiSelectMode: true,
          });
        }
      }
    },

    // 🚀 Phase 1: Immer → 함수형 업데이트 (Medium Risk)
    // ⭐ 다중 선택: 여러 요소를 한 번에 선택 (드래그 선택용)
    setSelectedElements: (elementIds: string[]) => {
      const { elementsMap, elements } = get();

      const resolveCompleteProps = (id: string) => {
        const element = elementsMap.get(id) ?? findElementById(elements, id);
        return element ? createCompleteProps(element) : null;
      };

      if (elementIds.length > 0) {
        // 첫 번째 요소를 primary selection으로 설정
        const nextProps = resolveCompleteProps(elementIds[0]);
        set({
          selectedElementIds: elementIds,
          // 🚀 O(1) 검색용 Set 동기화
          selectedElementIdsSet: new Set(elementIds),
          multiSelectMode: elementIds.length > 1,
          selectedElementId: elementIds[0],
          selectedElementProps: nextProps || {},
        });
      } else {
        // 선택 없음
        set({
          selectedElementIds: [],
          selectedElementIdsSet: new Set<string>(),
          multiSelectMode: false,
          selectedElementId: null,
          selectedElementProps: {},
        });
      }
    },

    // 🚀 배치 업데이트 (Factory 함수로 생성)
    batchUpdateElementProps,
    batchUpdateElements,

    // 🚀 WebGL computed layout 동기화
    // Canvas에서 layout 계산 완료 시 호출하여 stylePanel과 동기화
    updateSelectedElementLayout: (
      elementId: string,
      layout: ComputedLayout,
    ) => {
      const state = get();

      // 현재 선택된 요소만 업데이트 (성능 최적화)
      if (state.selectedElementId !== elementId) return;

      // computedLayout이 변경되었는지 확인
      const currentLayout = state.selectedElementProps?.computedLayout;
      if (
        currentLayout?.width === layout.width &&
        currentLayout?.height === layout.height
      ) {
        return; // 변경 없음
      }

      // selectedElementProps에 computedLayout 추가/업데이트
      set({
        selectedElementProps: {
          ...state.selectedElementProps,
          computedLayout: layout,
        },
      });
    },

    // 🆕 Multi-page: 페이지 위치 초기화 (order_num 정렬 → 수평 스택)
    initializePagePositions: (
      pages: Page[],
      pageWidth: number,
      pageHeight: number,
      gap: number,
      direction: PageLayoutDirection = "horizontal",
    ) => {
      const sorted = [...pages].sort(
        (a, b) => (a.order_num ?? 0) - (b.order_num ?? 0),
      );
      const positions: Record<string, { x: number; y: number }> = {};

      if (direction === "vertical") {
        let currentY = 0;
        for (const page of sorted) {
          positions[page.id] = { x: 0, y: currentY };
          currentY += pageHeight + gap;
        }
      } else if (direction === "zigzag") {
        for (let i = 0; i < sorted.length; i++) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          positions[sorted[i].id] = {
            x: col * (pageWidth + gap),
            y: row * (pageHeight + gap),
          };
        }
      } else {
        // horizontal (기본)
        let currentX = 0;
        for (const page of sorted) {
          positions[page.id] = { x: currentX, y: 0 };
          currentX += pageWidth + gap;
        }
      }

      set((state) => ({
        pagePositions: positions,
        pagePositionsVersion: state.pagePositionsVersion + 1,
      }));
    },

    // 🆕 Multi-page: 단일 페이지 위치 업데이트 (드래그용)
    updatePagePosition: (pageId: string, x: number, y: number) => {
      set((state) => ({
        pagePositions: { ...state.pagePositions, [pageId]: { x, y } },
        pagePositionsVersion: state.pagePositionsVersion + 1,
      }));
    },

    // ADR-111 P3-α: reusable frame 좌표/크기 갱신 (drag/resize 통합)
    updateFramePosition: (frameId, patch) => {
      set((state) => {
        const prev = state.framePositions[frameId] ?? {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        };
        const next = {
          x: patch.x ?? prev.x,
          y: patch.y ?? prev.y,
          width: patch.width ?? prev.width,
          height: patch.height ?? prev.height,
        };
        return {
          framePositions: { ...state.framePositions, [frameId]: next },
          framePositionsVersion: state.framePositionsVersion + 1,
        };
      });
    },

    // ADR-111 P3-α: reusable frame 삭제 시 좌표 entry 정리
    removeFramePosition: (frameId) => {
      set((state) => {
        if (!(frameId in state.framePositions)) return state;
        const nextPositions = { ...state.framePositions };
        delete nextPositions[frameId];
        return {
          framePositions: nextPositions,
          framePositionsVersion: state.framePositionsVersion + 1,
        };
      });
    },

    // G.1: Instance 생성 액션
    createInstance: (masterRefId: string, parentId: string, pageId: string) => {
      return createInstanceAction(get, set, masterRefId, parentId, pageId);
    },

    detachInstance: (instanceId: string) => {
      return detachInstanceAction(get, set, instanceId);
    },

    toggleComponentOrigin: (
      elementId: string,
      options?: { beforeMutation?: () => void | Promise<void> },
    ) => {
      return toggleComponentOriginAction(get, set, elementId, options);
    },

    resetInstanceOverrideField: (
      instanceId: string,
      fieldKey: string,
      descendantPath?: string,
    ) => {
      return resetInstanceOverrideFieldAction(
        get,
        set,
        instanceId,
        fieldKey,
        descendantPath,
      );
    },

    invalidateLayout: () => {
      set((state) => ({ layoutVersion: state.layoutVersion + 1 }));
    },

    // ADR-073: 일반화 items 조작 액션 (type-agnostic)
    // updateElementProps가 props 변경을 layoutVersion++ 처리하므로
    // items 변경 시 파이프라인(Memory→History→DB) 자동 처리됨.

    addItem: async (elementId, itemsKey, item) => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray(
        (el.props as Record<string, unknown>)[itemsKey],
      )
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<
            string,
            unknown
          >[])
        : [];
      const newItem: Record<string, unknown> = {
        label: "Item",
        ...(item ?? {}),
        id:
          item?.id !== undefined && item.id !== ""
            ? String(item.id)
            : crypto.randomUUID(),
      };
      await get().updateElementProps(elementId, {
        [itemsKey]: [...currentItems, newItem],
      });
    },

    removeItem: async (elementId, itemsKey, itemId) => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray(
        (el.props as Record<string, unknown>)[itemsKey],
      )
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<
            string,
            unknown
          >[])
        : [];
      const next = currentItems.filter((it) => it.id !== itemId);
      await get().updateElementProps(elementId, { [itemsKey]: next });
    },

    updateItem: async (elementId, itemsKey, itemId, patch) => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray(
        (el.props as Record<string, unknown>)[itemsKey],
      )
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<
            string,
            unknown
          >[])
        : [];
      const next = currentItems.map((it) =>
        it.id === itemId ? { ...it, ...patch } : it,
      );
      await get().updateElementProps(elementId, { [itemsKey]: next });
    },

    // ADR-099 Phase 4: Section/Separator 액션
    addSection: async (elementId, itemsKey, header = "New Section") => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray(
        (el.props as Record<string, unknown>)[itemsKey],
      )
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<
            string,
            unknown
          >[])
        : [];
      const newSection: Record<string, unknown> = {
        id: crypto.randomUUID(),
        type: "section",
        header,
        items: [],
      };
      await get().updateElementProps(elementId, {
        [itemsKey]: [...currentItems, newSection],
      });
    },

    addSeparator: async (elementId, itemsKey) => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray(
        (el.props as Record<string, unknown>)[itemsKey],
      )
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<
            string,
            unknown
          >[])
        : [];
      const newSeparator: Record<string, unknown> = {
        id: crypto.randomUUID(),
        type: "separator",
      };
      await get().updateElementProps(elementId, {
        [itemsKey]: [...currentItems, newSeparator],
      });
    },

    addItemToSection: async (elementId, itemsKey, sectionId, item) => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray(
        (el.props as Record<string, unknown>)[itemsKey],
      )
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<
            string,
            unknown
          >[])
        : [];
      const newItem: Record<string, unknown> = {
        label: "Item",
        ...item,
        id:
          item.id !== undefined && item.id !== ""
            ? String(item.id)
            : crypto.randomUUID(),
      };
      const next = currentItems.map((entry) => {
        if (entry.id === sectionId && entry.type === "section") {
          const sectionItems = Array.isArray(entry.items)
            ? (entry.items as Record<string, unknown>[])
            : [];
          return { ...entry, items: [...sectionItems, newItem] };
        }
        return entry;
      });
      await get().updateElementProps(elementId, { [itemsKey]: next });
    },

    removeItemFromSection: async (elementId, itemsKey, sectionId, itemId) => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray(
        (el.props as Record<string, unknown>)[itemsKey],
      )
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<
            string,
            unknown
          >[])
        : [];
      const next = currentItems.map((entry) => {
        if (entry.id === sectionId && entry.type === "section") {
          const sectionItems = Array.isArray(entry.items)
            ? (entry.items as Record<string, unknown>[])
            : [];
          return {
            ...entry,
            items: sectionItems.filter((it) => it.id !== itemId),
          };
        }
        return entry;
      });
      await get().updateElementProps(elementId, { [itemsKey]: next });
    },

    updateItemInSection: async (
      elementId,
      itemsKey,
      sectionId,
      itemId,
      patch,
    ) => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray(
        (el.props as Record<string, unknown>)[itemsKey],
      )
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<
            string,
            unknown
          >[])
        : [];
      const next = currentItems.map((entry) => {
        if (entry.id === sectionId && entry.type === "section") {
          const sectionItems = Array.isArray(entry.items)
            ? (entry.items as Record<string, unknown>[])
            : [];
          return {
            ...entry,
            items: sectionItems.map((it) =>
              it.id === itemId ? { ...it, ...patch } : it,
            ),
          };
        }
        return entry;
      });
      await get().updateElementProps(elementId, { [itemsKey]: next });
    },

    // ADR-068 → ADR-073: Menu items SSOT は 일반화 액션의 thin wrapper
    addMenuItem: async (menuId, item) => {
      return get().addItem(menuId, "items", item as Record<string, unknown>);
    },

    removeMenuItem: async (menuId, itemId) => {
      return get().removeItem(menuId, "items", itemId);
    },

    updateMenuItem: async (menuId, itemId, patch) => {
      return get().updateItem(
        menuId,
        "items",
        itemId,
        patch as Record<string, unknown>,
      );
    },

    reorderMenuItems: async (menuId, fromIndex, toIndex) => {
      const menu = get().elementsMap.get(menuId);
      if (!menu || menu.type !== "Menu") return;
      const items = ((menu.props.items ?? []) as StoredMenuItem[]).slice();
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= items.length ||
        toIndex >= items.length ||
        fromIndex === toIndex
      ) {
        return;
      }
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      await get().updateElementProps(menuId, { items });
    },
  };
};

// 기존 호환성을 위한 useStore export
export const useStore = create<ElementsState>(createElementsSlice);

// ============================================
// 🚀 Performance Optimized Selectors
// ============================================

// 안정적인 빈 배열 참조 (새 배열 생성 방지)
const EMPTY_ELEMENTS: Element[] = [];

/**
 * 현재 페이지의 요소만 반환하는 선택적 selector
 *
 * 🎯 Phase 2 최적화:
 * - O(1) 조회: pageIndex 기반 인덱스 사용 (filter O(n) → getPageElements O(1))
 * - 안정적인 참조: pageIndex 캐시 활용
 * - 개별 구독: currentPageId, pageIndex, elementsMap 분리 구독
 * - 무한 루프 방지: getSnapshot 결과 캐싱
 *
 * @example
 * ```tsx
 * const currentPageElements = useCurrentPageElements();
 * ```
 */
export const useCurrentPageElements = (): Element[] => {
  const currentPageId = useStore((state) => state.currentPageId);
  const currentPageElements = useStore((state) => {
    if (!state.currentPageId) return EMPTY_ELEMENTS;
    return state.pageElementsSnapshot[state.currentPageId] ?? EMPTY_ELEMENTS;
  });

  return useMemo(() => {
    if (!currentPageId) return EMPTY_ELEMENTS;
    return currentPageElements;
  }, [currentPageElements, currentPageId]);
};

/**
 * elementsMap을 활용한 O(1) 요소 조회 selector
 *
 * @param elementId - 조회할 요소 ID
 * @returns 요소 또는 undefined
 */
export const useElementById = (
  elementId: string | null,
): Element | undefined => {
  return useStore((state) => {
    if (!elementId) return undefined;
    return state.elementsMap.get(elementId);
  });
};

/**
 * childrenMap을 활용한 O(1) 자식 요소 조회 selector
 *
 * @param parentId - 부모 요소 ID (null이면 루트 요소들)
 * @returns 자식 요소 배열
 */
export const useChildElements = (parentId: string | null): Element[] => {
  return useStore((state) => {
    const key = parentId || "root";
    // 안정적인 빈 배열 참조 반환 (새 배열 생성 방지)
    return state.childrenMap.get(key) ?? EMPTY_ELEMENTS;
  });
};

/**
 * 현재 페이지의 요소 개수만 반환 (가벼운 조회용)
 * 트리 노드 개수 표시 등에 사용
 *
 * 🆕 Phase 2: O(1) 인덱스 기반 카운트
 */
export const useCurrentPageElementCount = (): number => {
  return useStore((state) => {
    const { pageIndex, currentPageId } = state;
    if (!currentPageId) return 0;
    // O(1) 인덱스 기반 카운트
    return pageIndex.elementsByPage.get(currentPageId)?.size ?? 0;
  });
};
