/**
 * Scroll State Store
 *
 * W3-5: overflow:scroll/auto 스크롤 상태 관리
 *
 * 캔버스 기반 에디터에서 overflow:scroll/auto를 가진 요소의
 * 스크롤 위치를 관리하는 독립 Zustand store.
 *
 * 브라우저 네이티브 스크롤과 달리 자체적으로 스크롤 상태를 추적하며,
 * CanvasKit 렌더링 시 scrollOffset을 적용하여 시각적 스크롤을 구현한다.
 *
 * @since 2026-02-19 W3-5
 */

import { create } from "zustand";

// ============================================
// Types
// ============================================

/** 개별 요소의 스크롤 상태 */
export interface ElementScrollState {
  /** 현재 수직 스크롤 위치 (px) */
  scrollTop: number;
  /** 현재 수평 스크롤 위치 (px) */
  scrollLeft: number;
  /** 최대 수직 스크롤 가능 거리 (contentHeight - containerHeight, 0 이상) */
  maxScrollTop: number;
  /** 최대 수평 스크롤 가능 거리 (contentWidth - containerWidth, 0 이상) */
  maxScrollLeft: number;
}

/** 스크롤 상태 store 인터페이스 */
interface ScrollStateStore {
  /** elementId → 스크롤 상태 매핑 (O(1) 조회) */
  scrollMap: Map<string, ElementScrollState>;

  // ── Actions ──

  /**
   * 요소의 스크롤 위치 설정
   *
   * scrollTop/scrollLeft는 [0, maxScroll] 범위로 클램핑된다.
   * maxScroll이 아직 계산되지 않은 경우 위치만 저장한다.
   */
  setScroll: (elementId: string, scrollTop: number, scrollLeft: number) => void;

  /**
   * 레이아웃 엔진에서 계산된 maxScroll 값 업데이트
   *
   * 콘텐츠 크기가 변경될 때마다 호출되어 스크롤 범위를 갱신한다.
   * 현재 scrollTop/scrollLeft가 새 maxScroll을 초과하면 자동 클램핑한다.
   */
  updateMaxScroll: (
    elementId: string,
    maxScrollTop: number,
    maxScrollLeft: number,
  ) => void;

  /**
   * 요소의 스크롤 상태를 delta 값으로 업데이트 (wheel 이벤트용)
   *
   * deltaY → scrollTop, deltaX → scrollLeft에 가산.
   * [0, maxScroll] 범위로 클램핑된다.
   */
  scrollBy: (elementId: string, deltaX: number, deltaY: number) => void;

  /**
   * 요소의 스크롤 상태 제거 (요소 삭제 시)
   */
  removeScroll: (elementId: string) => void;

  /**
   * 모든 스크롤 상태 초기화 (페이지 전환 시)
   */
  clearAll: () => void;
}

// ============================================
// Default State
// ============================================

const DEFAULT_SCROLL_STATE: ElementScrollState = {
  scrollTop: 0,
  scrollLeft: 0,
  maxScrollTop: 0,
  maxScrollLeft: 0,
};

// ============================================
// Store
// ============================================

export const useScrollState = create<ScrollStateStore>((set, _get) => ({
  scrollMap: new Map(),

  setScroll: (elementId, scrollTop, scrollLeft) => {
    set((state) => {
      const nextMap = new Map(state.scrollMap);
      const existing = nextMap.get(elementId) ?? { ...DEFAULT_SCROLL_STATE };

      const newTop = clamp(scrollTop, 0, existing.maxScrollTop);
      const newLeft = clamp(scrollLeft, 0, existing.maxScrollLeft);

      // 값이 변경되지 않으면 no-op (불필요한 리렌더 방지)
      if (existing.scrollTop === newTop && existing.scrollLeft === newLeft) {
        return state;
      }

      nextMap.set(elementId, {
        ...existing,
        scrollTop: newTop,
        scrollLeft: newLeft,
      });

      return { scrollMap: nextMap };
    });
  },

  updateMaxScroll: (elementId, maxScrollTop, maxScrollLeft) => {
    set((state) => {
      const existing = state.scrollMap.get(elementId) ?? {
        ...DEFAULT_SCROLL_STATE,
      };

      const clampedMaxTop = Math.max(0, maxScrollTop);
      const clampedMaxLeft = Math.max(0, maxScrollLeft);
      const newTop = clamp(existing.scrollTop, 0, clampedMaxTop);
      const newLeft = clamp(existing.scrollLeft, 0, clampedMaxLeft);

      // no-op 가드: 결과 entry 가 기존과 동일하면 state 유지 → 불필요 리렌더/구독 루프 방지.
      //   ADR-150 A2 collection maxScroll 재주입(BuilderCanvas)이 scroll 마다 반복돼도
      //   값 불변 구간에서는 scrollMap reference 를 새로 만들지 않는다.
      if (
        state.scrollMap.has(elementId) &&
        existing.maxScrollTop === clampedMaxTop &&
        existing.maxScrollLeft === clampedMaxLeft &&
        existing.scrollTop === newTop &&
        existing.scrollLeft === newLeft
      ) {
        return state;
      }

      const nextMap = new Map(state.scrollMap);
      nextMap.set(elementId, {
        scrollTop: newTop,
        scrollLeft: newLeft,
        maxScrollTop: clampedMaxTop,
        maxScrollLeft: clampedMaxLeft,
      });

      return { scrollMap: nextMap };
    });
  },

  scrollBy: (elementId, deltaX, deltaY) => {
    set((state) => {
      const nextMap = new Map(state.scrollMap);
      const existing = nextMap.get(elementId) ?? { ...DEFAULT_SCROLL_STATE };

      const newTop = clamp(
        existing.scrollTop + deltaY,
        0,
        existing.maxScrollTop,
      );
      const newLeft = clamp(
        existing.scrollLeft + deltaX,
        0,
        existing.maxScrollLeft,
      );

      if (existing.scrollTop === newTop && existing.scrollLeft === newLeft) {
        return state;
      }

      nextMap.set(elementId, {
        ...existing,
        scrollTop: newTop,
        scrollLeft: newLeft,
      });

      return { scrollMap: nextMap };
    });
  },

  removeScroll: (elementId) => {
    set((state) => {
      const nextMap = new Map(state.scrollMap);
      nextMap.delete(elementId);
      return { scrollMap: nextMap };
    });
  },

  clearAll: () => {
    set({ scrollMap: new Map() });
  },
}));

// ============================================
// Selectors
// ============================================

/**
 * 요소의 스크롤 상태 조회 (O(1))
 *
 * 스크롤 상태가 없는 요소에 대해서는 null을 반환한다.
 * 렌더링 코드에서 null 체크로 스크롤 오프셋 적용 여부를 결정한다.
 */
export function getScrollState(elementId: string): ElementScrollState | null {
  return useScrollState.getState().scrollMap.get(elementId) ?? null;
}

/**
 * 요소가 스크롤 가능한지 확인 (maxScroll > 0)
 */
export function isScrollable(elementId: string): boolean {
  const scroll = getScrollState(elementId);
  if (!scroll) return false;
  return scroll.maxScrollTop > 0 || scroll.maxScrollLeft > 0;
}

/**
 * React hook: 요소의 스크롤 상태 구독
 */
export const useElementScrollState = (
  elementId: string | null,
): ElementScrollState | null =>
  useScrollState((state) => {
    if (!elementId) return null;
    return state.scrollMap.get(elementId) ?? null;
  });

// ============================================
// Utilities
// ============================================

function clamp(value: number, min: number, max: number): number {
  if (max <= min) return min;
  return Math.min(Math.max(value, min), max);
}
