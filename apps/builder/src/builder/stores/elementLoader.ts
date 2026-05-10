/**
 * Element Loader
 *
 * 🚀 Phase 5: 페이지별 Lazy Loading + LRU 캐시
 *
 * 성능 비교:
 * - Before: 전체 페이지 요소 로드 → 50페이지 × 100요소 = ~100MB
 * - After: 현재 + 최근 5페이지만 로드 → ~10MB (90% 절감)
 *
 * 로드 우선순위:
 * 1. 메모리 (elementsMap) - 즉시
 * 2. IndexedDB - ~10ms
 * 3. Supabase - ~100-500ms
 *
 * @since 2025-12-10 Phase 5 Lazy Loading + LRU Cache
 */

import type { StateCreator } from "zustand";
import type { Element } from "../../types/core/store.types";
import { deriveProjectRenderModelFromDocument } from "@composition/shared";
import { pageCache, type LRUCacheStats } from "../utils/LRUPageCache";
import { useCanonicalDocumentStore } from "./canonical/canonicalDocumentStore";
import { normalizeElementTags } from "./utils/elementTagNormalizer";
import type { StoreElementCacheMap } from "./elements";

// ============================================
// Types
// ============================================

export interface LoaderState {
  /** 로드 완료된 페이지 ID */
  loadedPages: Set<string>;
  /** 로딩 중인 페이지 ID */
  loadingPages: Set<string>;
  /** 로더 활성화 여부 (개발/테스트 시 비활성화 가능) */
  lazyLoadingEnabled: boolean;
}

export interface ElementLoaderActions {
  /**
   * 페이지 요소 Lazy Load
   * @returns 로드된 요소 배열
   */
  lazyLoadPageElements: (pageId: string) => Promise<Element[]>;

  /**
   * 페이지 언로드 (메모리 해제)
   * 현재 페이지는 언로드 불가
   */
  unloadPage: (pageId: string) => void;

  /**
   * 페이지가 로드되었는지 확인
   */
  isPageLoaded: (pageId: string) => boolean;

  /**
   * 페이지가 로딩 중인지 확인
   */
  isPageLoading: (pageId: string) => boolean;

  /**
   * Lazy Loading 활성화/비활성화
   */
  setLazyLoadingEnabled: (enabled: boolean) => void;

  /**
   * LRU 캐시 통계 조회
   */
  getLRUStats: () => LRUCacheStats;

  /**
   * 모든 페이지 언로드 (메모리 초기화)
   */
  clearAllPages: () => void;

  /**
   * 페이지 프리로드 (백그라운드 로드)
   */
  preloadPage: (pageId: string) => void;
}

export type ElementLoaderSlice = LoaderState & ElementLoaderActions;

// ============================================
// Store 타입 (외부 의존성)
// ============================================

interface ElementsStateMinimal {
  elements: Element[];
  elementsMap: StoreElementCacheMap;
  pageElementsSnapshot: Record<string, Element[]>;
  currentPageId: string | null;
  selectedElementId: string | null;
  _rebuildIndexes: () => void;
  activatePage: (pageId: string, elementId?: string | null) => void;
}

type SetState = Parameters<
  StateCreator<ElementLoaderSlice & ElementsStateMinimal>
>[0];
type GetState = Parameters<
  StateCreator<ElementLoaderSlice & ElementsStateMinimal>
>[1];

function getActiveCanonicalElements(): Element[] | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  const document = projectId ? canonical.documents.get(projectId) : null;
  if (!projectId || !document) return null;

  return deriveProjectRenderModelFromDocument(document, projectId).elements.map(
    (element) => element as Element,
  );
}

function getPageElementsFromRuntimeState(
  state: Pick<ElementsStateMinimal, "elements">,
  pageId: string,
): Element[] {
  const canonicalElements = getActiveCanonicalElements();
  if (canonicalElements) {
    return canonicalElements.filter((element) => element.page_id === pageId);
  }

  const { elements: legacyElements } = state;
  return legacyElements.filter((element) => element.page_id === pageId);
}

function findElementFromRuntimeState(
  state: Pick<ElementsStateMinimal, "elements">,
  elementId: string,
): Element | null {
  const canonicalElements = getActiveCanonicalElements();
  if (canonicalElements) {
    return (
      canonicalElements.find((element) => element.id === elementId) ?? null
    );
  }

  const { elements: legacyElements } = state;
  return legacyElements.find((element) => element.id === elementId) ?? null;
}

// ============================================
// Element Loader Factory
// ============================================

/**
 * Element Loader Slice 생성 팩토리
 */
export function createElementLoaderSlice(
  set: SetState,
  get: GetState,
): ElementLoaderSlice {
  // ============================================
  // 내부 헬퍼 함수
  // ============================================

  /**
   * Canonical document에서 페이지 요소 파생
   */
  const loadFromCanonicalDocument = (pageId: string): Element[] => {
    const canonicalElements = getActiveCanonicalElements();
    if (!canonicalElements) return [];
    return canonicalElements.filter((element) => element.page_id === pageId);
  };

  // ============================================
  // 액션 구현
  // ============================================

  /**
   * 페이지 요소 Lazy Load
   */
  const lazyLoadPageElements = async (pageId: string): Promise<Element[]> => {
    const state = get();

    // Lazy Loading 비활성화 시 기존 동작
    if (!state.lazyLoadingEnabled) {
      return getPageElementsFromRuntimeState(state, pageId);
    }

    // 이미 로드됨
    if (state.loadedPages.has(pageId)) {
      pageCache.access(pageId);
      return getPageElementsFromRuntimeState(state, pageId);
    }

    // 로딩 중 - 완료 대기
    if (state.loadingPages.has(pageId)) {
      return new Promise((resolve) => {
        const checkLoaded = setInterval(() => {
          if (get().loadedPages.has(pageId)) {
            clearInterval(checkLoaded);
            resolve(getPageElementsFromRuntimeState(get(), pageId));
          }
        }, 50);

        // 타임아웃: 10초
        setTimeout(() => {
          clearInterval(checkLoaded);
          resolve([]);
        }, 10000);
      });
    }

    // 로딩 시작
    set((s) => ({
      loadingPages: new Set([...s.loadingPages, pageId]),
    }));

    try {
      let elements = loadFromCanonicalDocument(pageId);

      // 레거시 태그(section)를 canonical 태그(Section)로 정규화
      if (elements.length > 0) {
        const { elements: normalizedElements } = normalizeElementTags(elements);
        elements = normalizedElements;
      }

      // ADR-040 Phase 2: elements + loadedPages를 단일 set()으로 병합 (render burst 축소)
      if (elements.length > 0) {
        set((s) => {
          const newElementsMap = new Map(s.elementsMap);
          const newElements = [...s.elements];
          const existingPageSnapshot = s.pageElementsSnapshot[pageId] ?? [];
          const nextPageSnapshot = [...existingPageSnapshot];

          elements!.forEach((el) => {
            // 중복 체크
            if (!newElementsMap.has(el.id)) {
              newElementsMap.set(el.id, el);
              newElements.push(el);
              nextPageSnapshot.push(el);
            }
          });

          return {
            elements: newElements,
            elementsMap: newElementsMap,
            pageElementsSnapshot: {
              ...s.pageElementsSnapshot,
              [pageId]: nextPageSnapshot,
            },
            // 로딩 상태도 동일 commit에 포함
            loadedPages: new Set([...s.loadedPages, pageId]),
            loadingPages: new Set(
              [...s.loadingPages].filter((id) => id !== pageId),
            ),
          };
        });

        // 인덱스 재구축
        get()._rebuildIndexes();

        const latestState = get();
        const selectedElement = latestState.selectedElementId
          ? findElementFromRuntimeState(
              latestState,
              latestState.selectedElementId,
            )
          : null;
        if (
          latestState.currentPageId === pageId &&
          selectedElement?.page_id !== pageId
        ) {
          latestState.activatePage(pageId);
        }
      } else {
        // 요소 없어도 로딩 상태 업데이트
        set((s) => ({
          loadedPages: new Set([...s.loadedPages, pageId]),
          loadingPages: new Set(
            [...s.loadingPages].filter((id) => id !== pageId),
          ),
        }));
      }

      // LRU 체크 - 초과 시 오래된 페이지 언로드
      const evictPageId = pageCache.access(pageId);
      if (evictPageId) {
        // 현재 페이지가 아니면 언로드
        if (evictPageId !== get().currentPageId) {
          get().unloadPage(evictPageId);
        }
      }

      return elements;
    } catch (error) {
      console.error("[Loader] Failed to load page:", error);

      // 로딩 실패
      set((s) => ({
        loadingPages: new Set(
          [...s.loadingPages].filter((id) => id !== pageId),
        ),
      }));

      return [];
    }
  };

  /**
   * 페이지 언로드 (메모리 해제)
   */
  const unloadPage = (pageId: string): void => {
    const state = get();

    // 현재 페이지는 언로드 불가
    if (pageId === state.currentPageId) {
      console.warn(`[Loader] Cannot unload current page: ${pageId}`);
      return;
    }

    // 로드되지 않은 페이지
    if (!state.loadedPages.has(pageId)) {
      return;
    }

    // 해당 페이지 요소 제거
    set((s) => {
      const newElementsMap = new Map(s.elementsMap);
      const removedIds: string[] = [];

      // 해당 페이지 요소 찾기 및 제거
      newElementsMap.forEach((el, id) => {
        if (el.page_id === pageId) {
          removedIds.push(id);
        }
      });

      removedIds.forEach((id) => newElementsMap.delete(id));

      // elements 배열에서도 제거
      const newElements = s.elements.filter((el) => el.page_id !== pageId);

      return {
        elements: newElements,
        elementsMap: newElementsMap,
        pageElementsSnapshot: Object.fromEntries(
          Object.entries(s.pageElementsSnapshot).filter(
            ([cachedPageId]) => cachedPageId !== pageId,
          ),
        ),
        loadedPages: new Set([...s.loadedPages].filter((id) => id !== pageId)),
      };
    });

    // LRU 캐시에서도 제거
    pageCache.remove(pageId);

    // 인덱스 재구축
    get()._rebuildIndexes();
  };

  /**
   * 페이지가 로드되었는지 확인
   */
  const isPageLoaded = (pageId: string): boolean => {
    return get().loadedPages.has(pageId);
  };

  /**
   * 페이지가 로딩 중인지 확인
   */
  const isPageLoading = (pageId: string): boolean => {
    return get().loadingPages.has(pageId);
  };

  /**
   * Lazy Loading 활성화/비활성화
   */
  const setLazyLoadingEnabled = (enabled: boolean): void => {
    set({ lazyLoadingEnabled: enabled });
  };

  /**
   * LRU 캐시 통계 조회
   */
  const getLRUStats = (): LRUCacheStats => {
    return pageCache.getStats();
  };

  /**
   * 모든 페이지 언로드 (메모리 초기화)
   */
  const clearAllPages = (): void => {
    const state = get();
    const currentPageId = state.currentPageId;

    // 현재 페이지 제외하고 모두 언로드
    state.loadedPages.forEach((pageId) => {
      if (pageId !== currentPageId) {
        unloadPage(pageId);
      }
    });

    // LRU 캐시 초기화
    pageCache.clear();

    // 현재 페이지는 다시 캐시에 추가
    if (currentPageId) {
      pageCache.access(currentPageId);
    }
  };

  /**
   * 페이지 프리로드 (백그라운드 로드)
   */
  const preloadPage = (pageId: string): void => {
    const state = get();

    // 이미 로드됨 또는 로딩 중
    if (state.loadedPages.has(pageId) || state.loadingPages.has(pageId)) {
      return;
    }

    // 백그라운드에서 로드 (requestIdleCallback 사용)
    if ("requestIdleCallback" in window) {
      (
        window as Window & { requestIdleCallback: (cb: () => void) => void }
      ).requestIdleCallback(() => {
        lazyLoadPageElements(pageId);
      });
    } else {
      // fallback: setTimeout
      setTimeout(() => {
        lazyLoadPageElements(pageId);
      }, 100);
    }
  };

  // ============================================
  // 초기 상태 + 액션 반환
  // ============================================

  return {
    // State
    loadedPages: new Set<string>(),
    loadingPages: new Set<string>(),
    lazyLoadingEnabled: true, // 기본 활성화

    // Actions
    lazyLoadPageElements,
    unloadPage,
    isPageLoaded,
    isPageLoading,
    setLazyLoadingEnabled,
    getLRUStats,
    clearAllPages,
    preloadPage,
  };
}

// ============================================
// Hooks (React 컴포넌트용)
// ============================================

/**
 * 페이지 로딩 상태 훅
 *
 * @example
 * ```tsx
 * const { isLoading, isLoaded } = usePageLoadingState(pageId);
 *
 * if (isLoading) return <Spinner />;
 * ```
 */
export function usePageLoadingState(
  store: { getState: () => ElementLoaderSlice },
  pageId: string,
): { isLoading: boolean; isLoaded: boolean } {
  const state = store.getState();
  return {
    isLoading: state.isPageLoading(pageId),
    isLoaded: state.isPageLoaded(pageId),
  };
}
