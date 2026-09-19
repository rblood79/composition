import { create } from "zustand";
import { isCanvasCompareMode } from "../../../../utils/featureFlags";

export interface CompareModeState {
  /** Compare mode 활성화 여부 (Preview + Skia 분할) */
  isCompareMode: boolean;
  /** Compare Canvas를 현재 페이지 하나로 제한할지 여부 */
  filterCurrentPage: boolean;
  /** Compare mode 토글 */
  toggleCompareMode: () => void;
  /** Compare mode 설정 */
  setCompareMode: (enabled: boolean) => void;
  /** Compare Canvas current-page filter 설정 */
  setCurrentPageFilter: (enabled: boolean) => void;
}

export const useCompareModeStore = create<CompareModeState>()((set) => ({
  // 초기값: VITE_CANVAS_COMPARE_MODE 로 시드 (true → 초기 분할 활성, 헤더 "Skia Only Mode" 상태)
  isCompareMode: isCanvasCompareMode(),
  // Compare의 기존 동작은 Canvas 전체 page scene이다. 단일 page는 명시적 옵션이다.
  filterCurrentPage: false,

  toggleCompareMode: () => {
    set((state) => ({ isCompareMode: !state.isCompareMode }));
  },

  setCompareMode: (enabled) => {
    set({ isCompareMode: enabled });
  },

  setCurrentPageFilter: (enabled) => {
    set({ filterCurrentPage: enabled });
  },
}));
