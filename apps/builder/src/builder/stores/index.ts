import { useMemo, useDeferredValue } from "react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import { createSelectionSlice, SelectionState } from "./selection";
import { createElementsSlice, ElementsState } from "./elements";
import type { Element } from "../../types/core/store.types";
import { createSettingsSlice, SettingsState } from "./canvasSettings";
import { createPanelLayoutSlice, PanelLayoutSlice } from "./panelLayout";
import { createElementLoaderSlice, ElementLoaderSlice } from "./elementLoader";
import {
  createInspectorActionsSlice,
  InspectorActionsState,
} from "./inspectorActions";
import type {
  DeferredSelectedElement,
  ImmediateSelectionSnapshot,
  SelectedElement,
} from "../inspector/types";
import {
  getCanonicalRefTarget,
  isCanonicalRefElement,
  resolveCanonicalRefElement,
} from "../utils/canonicalRefResolution";
import type { CanonicalNode } from "@composition/shared";
import { canonicalNodeToElement } from "./canonical/canonicalElementsView";
import { useActiveCanonicalDocument } from "./canonical/canonicalElementsBridge";
import {
  getFirstProjectableNodeLookupByReference,
  getLastProjectableNodeLookupById,
  getNodeMap,
  type CanonicalProjectableNodeLookup,
} from "./canonical/canonicalTraversalHelpers";
import { getElementDataBinding } from "../../adapters/canonical/compositionExtensionFields";
import { mergePropsWithStyleDeep } from "../../adapters/canonical/instanceResolver";
import {
  getComponentOverridesMirror,
  isComponentInstanceMirrorElement,
} from "../../adapters/canonical/componentSemanticsMirror";

// ✅ ThemeState removed - now using unified theme store (themeStore.unified.ts)

// 통합 스토어 타입
interface Store
  extends
    ElementsState,
    SelectionState,
    SettingsState,
    PanelLayoutSlice,
    ElementLoaderSlice,
    InspectorActionsState {}

type UseStoreType = UseBoundStore<StoreApi<Store>>;

// HMR로 인한 store 재생성 방지: window 객체에 고정
declare global {
  interface Window {
    __composition_STORE__?: UseStoreType;
    __composition_STORE_ID__?: string;
  }
}

// HMR 대응: 기존 인스턴스가 있으면 재사용, 없으면 새로 생성
let useStore: UseStoreType;

const hasExistingStore =
  typeof window !== "undefined" && window.__composition_STORE__;

if (hasExistingStore) {
  // 기존 인스턴스 재사용
  useStore = window.__composition_STORE__!;
} else {
  // 새로운 인스턴스 생성
  useStore = create<Store>((set, get, store) => ({
    ...createElementsSlice(set, get, store),
    ...createSelectionSlice(set, get, store),
    ...createSettingsSlice(set, get, store),
    ...createPanelLayoutSlice(set, get, store),
    ...createElementLoaderSlice(set, get),
    ...createInspectorActionsSlice(set, get, store),
  }));

  if (typeof window !== "undefined") {
    window.__composition_STORE__ = useStore;
    window.__composition_STORE_ID__ = Math.random().toString(36).substring(7);
  }
}

export { useStore };

// getState API export (SaveService 등 non-React 환경에서 사용)
export const getStoreState = () => {
  // iframe 내부인 경우, parent window의 store 사용
  if (
    typeof window !== "undefined" &&
    window !== window.top &&
    window.parent &&
    (window.parent as typeof window).__composition_STORE__
  ) {
    return (window.parent as typeof window).__composition_STORE__!.getState();
  }

  // 일반적인 경우
  if (typeof window !== "undefined" && window.__composition_STORE__) {
    return window.__composition_STORE__.getState();
  }
  return useStore.getState();
};

export const subscribeStore = useStore.subscribe;

// Zundo 패턴은 기존 히스토리 시스템에 통합됨
// useStore가 개선된 히스토리 시스템을 포함함

export const useSelectedElementId = () =>
  useStore((state) => state.selectedElementId);
// 호환성 alias
export const useSelectedElement = useSelectedElementId;
export const useSelectedElementProps = () =>
  useStore((state) => state.selectedElementProps);
export const useCurrentPageId = () => useStore((state) => state.currentPageId);
export const usePages = () => useStore((state) => state.pages);

export function readImmediateSelectionSnapshot(): ImmediateSelectionSnapshot {
  const state = useStore.getState();
  return {
    selectedElementId: state.selectedElementId,
    currentPageId: state.currentPageId,
  } as ImmediateSelectionSnapshot;
}

export const useImmediateSelectedElementId = (): string | null =>
  useStore((state) => state.selectedElementId);

export const useImmediateCurrentPageId = (): string | null =>
  useStore((state) => state.currentPageId);

type SelectedRefOverrideSource = Element | CanonicalNode;

function hasCanonicalRefMirror(
  element: SelectedRefOverrideSource | undefined,
): boolean {
  const ref = (
    element as (SelectedRefOverrideSource & { ref?: unknown }) | undefined
  )?.ref;
  return typeof ref === "string" && ref.length > 0;
}

function getSelectedRefOverridePropsFromSource(
  element: SelectedRefOverrideSource | undefined,
): Record<string, unknown> {
  if (!element) return {};
  if (isComponentInstanceMirrorElement(element as Element)) {
    return getComponentOverridesMirror(element as Element) ?? {};
  }
  if (isCanonicalRefElement(element) || hasCanonicalRefMirror(element)) {
    return (element.props ?? {}) as Record<string, unknown>;
  }
  return {};
}

function getActiveCanonicalRefOverrideSource(
  elementId: string,
): CanonicalNode | undefined {
  return getNodeMap().get(elementId);
}

function projectCanonicalSelectionLookup(
  lookup: CanonicalProjectableNodeLookup,
): Element | null {
  return canonicalNodeToElement(lookup.node, lookup.parentId, {
    pageId: lookup.pageId,
    layoutId: lookup.layoutId,
  });
}

function getActiveCanonicalSelectedElement(elementId: string): Element | null {
  const selectedLookup = getLastProjectableNodeLookupById(elementId);
  if (!selectedLookup) return null;

  const selectedElement = projectCanonicalSelectionLookup(selectedLookup);
  if (!selectedElement || !isCanonicalRefElement(selectedElement)) {
    return selectedElement;
  }

  const reference = getCanonicalRefTarget(selectedElement);
  const masterLookup = reference
    ? getFirstProjectableNodeLookupByReference(reference)
    : null;
  const masterElement = masterLookup
    ? projectCanonicalSelectionLookup(masterLookup)
    : null;
  return masterElement
    ? resolveCanonicalRefElement(selectedElement, [masterElement])
    : selectedElement;
}

// ============================================
// 🚀 Single Source of Truth: Selected Element
// ============================================

/**
 * 선택된 요소를 SelectedElement 형태로 반환
 * Inspector Store 제거 후 Builder Store에서 직접 사용
 *
 * 🚀 Performance Optimization:
 * - elementsMap 전체 구독 제거 (O(n) 리렌더링 방지)
 * - selectedElementProps 직접 구독 (선택된 요소만 추적)
 * - 다른 요소 변경 시 리렌더링 방지
 *
 * @returns SelectedElement | null
 */
export const useSelectedElementData = (): SelectedElement | null => {
  // 🚀 selectedElementId만 구독 (primitive 값)
  const selectedElementId = useStore((state) => state.selectedElementId);

  // 🚀 selectedElementProps만 구독 (선택된 요소의 props만)
  // elementsMap 전체 구독 대신 이미 계산된 props 사용
  const selectedElementProps = useStore((state) => state.selectedElementProps);

  // ADR-116 Phase 2 G3 Step 2 — canonical mode 시 selected element 를 canonical
  // store 에서 파생. flag 미활성 또는 canonical 에 노드 없을 때 `null` 반환 →
  // legacy elementsMap fallback. flag 와 무관하게 항상 hook 호출 (Rules of Hooks).
  const activeCanonicalDocument = useActiveCanonicalDocument();
  const hasCanonicalDocument = activeCanonicalDocument !== null;
  const canonicalSelectedElement = useMemo(() => {
    if (!selectedElementId || !activeCanonicalDocument) return null;
    return getActiveCanonicalSelectedElement(selectedElementId);
  }, [activeCanonicalDocument, selectedElementId]);

  // 🚀 추가 정보를 위해 elementsMap에서 한 번만 읽기 (구독 아님)
  // type, customId, dataBinding은 자주 변경되지 않음
  return useMemo(() => {
    if (!selectedElementId) return null;

    let element: Element | undefined;
    let resolvedElement: Element | undefined;

    if (canonicalSelectedElement) {
      // canonical mode — canonical selected view already resolves ref instances
      // into origin-shaped display elements while preserving the selected id.
      element = canonicalSelectedElement;
      resolvedElement = element;
    } else if (hasCanonicalDocument) {
      // ADR-122 Phase 2: active canonical document 가 있는 runtime에서는
      // legacy elementsMap fallback 으로 선택 데이터를 되살리지 않는다.
      return null;
    } else {
      // canonical hydration 전 bootstrap cache — getState() 동기 read, 구독 없음.
      const { elementsMap } = useStore.getState();
      element = elementsMap.get(selectedElementId) as Element | undefined;
      if (!element) return null;
      resolvedElement = isCanonicalRefElement(element)
        ? resolveCanonicalRefElement(element, elementsMap.values())
        : element;
    }

    if (!element || !resolvedElement) return null;

    // selectedElementProps가 비어있으면 element에서 직접 추출
    const shouldUseResolvedRefProps =
      isCanonicalRefElement(element) || hasCanonicalRefMirror(element);

    const currentRefOverrideProps = shouldUseResolvedRefProps
      ? getSelectedRefOverridePropsFromSource(
          (hasCanonicalDocument
            ? getActiveCanonicalRefOverrideSource(selectedElementId)
            : element) ?? undefined,
        )
      : null;

    const props = shouldUseResolvedRefProps
      ? {
          ...mergePropsWithStyleDeep(
            (resolvedElement.props ?? {}) as Record<string, unknown>,
            currentRefOverrideProps ?? {},
          ),
          ...(selectedElementProps.computedStyle !== undefined && {
            computedStyle: selectedElementProps.computedStyle,
          }),
        }
      : selectedElementProps && Object.keys(selectedElementProps).length > 0
        ? selectedElementProps
        : element.props;

    const {
      style,
      computedStyle,
      events: _events,
      ...otherProps
    } = props as Record<string, unknown>;

    const dataBinding = getElementDataBinding(element, "legacy-only");
    const selectedElement: SelectedElement = {
      id: element.id,
      type: resolvedElement.type,
      properties: otherProps,
      style: (style as React.CSSProperties) || {},
      semanticClasses: [],
      cssVariables: {},
    };
    if (element.customId !== undefined) {
      selectedElement.customId = element.customId;
    }
    if (computedStyle !== undefined) {
      selectedElement.computedStyle =
        computedStyle as Partial<React.CSSProperties>;
    }
    if (dataBinding !== undefined) {
      selectedElement.dataBinding =
        dataBinding as unknown as SelectedElement["dataBinding"];
    }
    return selectedElement;
  }, [
    selectedElementId,
    selectedElementProps,
    canonicalSelectedElement,
    hasCanonicalDocument,
  ]);
};

/**
 * 🚀 Phase 19/Phase 3: 디바운스된 선택 요소 데이터
 *
 * 🔄 Test B: useDeferredValue 기반 구현
 * React 18 Concurrent Features를 활용하여 선택 변경을 낮은 우선순위로 처리
 * - setTimeout 대신 React의 내장 스케줄링 사용
 * - 브라우저의 네이티브 우선순위 시스템 활용
 * - 캔버스 인터랙션에 방해 없이 인스펙터 업데이트
 *
 * @returns SelectedElement | null (지연됨)
 */
export const useDebouncedSelectedElementData =
  (): DeferredSelectedElement | null => {
    const currentData = useSelectedElementData();
    return useDeferredValue(currentData) as DeferredSelectedElement | null;
  };

/**
 * 🚀 Phase 4.5: useDeferredValue 기반 선택 요소 ID
 *
 * React 18 Concurrent Features를 활용하여 선택 변경을 낮은 우선순위로 처리
 * - 캔버스 클릭은 즉시 반응
 * - 트리 하이라이트 등 부가 UI는 지연 업데이트
 *
 * @returns 지연된 selectedElementId
 */
export const useDeferredSelectedElementId = (): string | null => {
  const selectedElementId = useStore((state) => state.selectedElementId);
  return useDeferredValue(selectedElementId);
};

/**
 * 🚀 Phase 4.5: useDeferredValue 기반 선택 요소 데이터
 *
 * useDebouncedSelectedElementData + useDeferredValue 조합
 * - 디바운스: 빠른 선택 전환 필터링
 * - Defer: React concurrent 우선순위 활용
 *
 * @returns 지연된 SelectedElement | null
 */
export const useDeferredSelectedElementDataConcurrent =
  (): SelectedElement | null => {
    const currentData = useDebouncedSelectedElementData();
    return useDeferredValue(currentData);
  };

/**
 * Inspector 액션 훅 (스타일, 속성, 이벤트 업데이트)
 * 기존 useInspectorState의 액션들을 대체
 * 🚀 개별 selector로 분리하여 무한 루프 방지
 */
export const useUpdateStyle = () =>
  useStore((state) => state.updateSelectedStyle);
export const useUpdateStyles = () =>
  useStore((state) => state.updateSelectedStyles);
export const useUpdateResponsiveVisibility = () =>
  useStore((state) => state.updateSelectedResponsiveVisibility);
export const useSetResponsiveStyleOverrideEnabled = () =>
  useStore((state) => state.setResponsiveStyleOverrideEnabled);
export const useUpdateProperty = () =>
  useStore((state) => state.updateSelectedProperty);
export const useUpdateProperties = () =>
  useStore((state) => state.updateSelectedProperties);
export const useUpdateCustomId = () =>
  useStore((state) => state.updateSelectedCustomId);
export const useUpdateDataBinding = () =>
  useStore((state) => state.updateSelectedDataBinding);
// ADR-149 Phase 2c (2026-07-19): useUpdateEvents/useAddEvent/useUpdateEvent/
// useRemoveEvent 제거 — dead selected-* events mutation 4종 제거 (소비처 0).
// EventsPanel 은 useStore(s => s.updateEventsRootCollection) 단일 진입점 사용.

/**
 * 🔧 레거시 호환: useInspectorActions (개별 hook 조합)
 * 새 코드에서는 개별 hook 사용 권장
 */
export const useInspectorActions = () => ({
  updateStyle: useUpdateStyle(),
  updateStyles: useUpdateStyles(),
  updateProperty: useUpdateProperty(),
  updateProperties: useUpdateProperties(),
  updateCustomId: useUpdateCustomId(),
  updateDataBinding: useUpdateDataBinding(),
  // ADR-149 Phase 2c: events 필드 제거 (updateEvents/addEvent/updateEvent/removeEvent) —
  // dead selected-* mutation 제거. EventsPanel 은 updateEventsRootCollection 직접 사용.
});

// 액션 선택기들
// NOTE: These grouped selectors are intentional API exports for convenience.
// They should be used sparingly and only when necessary.
// For performance-critical components, use individual selectors instead.
/* eslint-disable local/no-zustand-grouped-selectors */
export const useElementActions = () =>
  useStore((state) => ({
    addElement: state.addElement,
    updateElementProps: state.updateElementProps,
    updateElement: state.updateElement,
    removeElement: state.removeElement,
    setSelectedElement: state.setSelectedElement,
    loadPageElements: state.loadPageElements,
  }));

export const useHistoryActions = () =>
  useStore((state) => ({
    undo: state.undo,
    redo: state.redo,
  }));

// Panel Workspace Layout 선택기들
export const usePanelWorkspaceLayoutState = () =>
  useStore((state) => state.panelWorkspaceLayout);
export const usePanelWorkspaceHydrationStatus = () =>
  useStore((state) => state.panelWorkspaceHydrationStatus);

// 🚀 Phase 5: Lazy Loading 선택기들
export const useLazyLoaderActions = () =>
  useStore((state) => ({
    lazyLoadPageElements: state.lazyLoadPageElements,
    unloadPage: state.unloadPage,
    isPageLoaded: state.isPageLoaded,
    isPageLoading: state.isPageLoading,
    preloadPage: state.preloadPage,
    getLRUStats: state.getLRUStats,
    setLazyLoadingEnabled: state.setLazyLoadingEnabled,
  }));

export const usePageLoadingStatus = (pageId: string | null) =>
  useStore((state) => {
    if (!pageId) return { isLoading: false, isLoaded: false };
    return {
      isLoading: state.loadingPages.has(pageId),
      isLoaded: state.loadedPages.has(pageId),
    };
  });
/* eslint-enable local/no-zustand-grouped-selectors */

// ✅ useThemeActions removed - use unified theme store instead
// import { useUnifiedThemeStore } from './themeStore.unified';

// 개발 환경 디버깅
export const useStoreDebug = () => {
  if (!import.meta.env.DEV) return {};

  return {
    getState: () => useStore.getState(),
    subscribe: (callback: (state: Store) => void) =>
      useStore.subscribe(callback),
  };
};

// ============================================
// Layout/Slot System Stores
// ============================================
export {
  useCanonicalFrameSelectionStore,
  useCanonicalReusableFrameLayouts,
  useSelectedReusableFrameId,
  getCanonicalReusableFrameLayouts,
  getSelectedReusableFrameId,
  setSelectedReusableFrameId,
} from "./canonical/canonicalFrameStore";

export {
  useEditModeStore,
  useEditMode,
  useIsPageMode,
  useIsLayoutMode,
  useCurrentEditPageId,
  useCurrentEditLayoutId,
  useEditContext,
} from "./editMode";

// ============================================
// Phase G: 렌더링/레이아웃 상태 분리
// ============================================
export {
  useRenderState,
  selectIsRendering,
  selectContextLost,
  selectFps,
} from "./renderState";

export {
  useLayoutState,
  selectViewportSize,
  selectPanelWidths,
  selectWorkableArea,
} from "./layoutState";

// ============================================
// Phase 7: 글로벌 Toast 시스템
// ============================================
export { useToastStore, globalToast } from "./toast";
export type { Toast, ToastType, ToastAction } from "./toast";

// ============================================
// W3-5: Canvas Scroll State (overflow:scroll/auto)
// ============================================
export {
  useScrollState,
  useElementScrollState,
  getScrollState,
  isScrollable,
} from "./scrollState";
export type { ElementScrollState } from "./scrollState";

// ============================================
// Canvas Store (뷰포트/편집 상태)
// ============================================
export { useCanvasStore } from "./canvasStore";
