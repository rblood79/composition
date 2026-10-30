import { create } from "zustand";

export interface CompareModeState {
  /** Compare mode 활성화 여부 (Preview + Skia 분할) */
  isCompareMode: boolean;
  /** Compare Canvas를 현재 페이지 하나로 제한할지 여부 */
  filterCurrentPage: boolean;
  /**
   * ADR-295 사용자 결정 4 — Preview 를 터치 기기 크기 (S2 scale 1.25 · 글자 17) 로 본다. 실제 기기 조건
   * (pointer) 과 별도인 보기 토글이다. Canvas 는 늘 desktop (사용자 결정 7).
   */
  previewTouch: boolean;
  /** Compare mode 토글 */
  toggleCompareMode: () => void;
  /** Compare mode 설정 */
  setCompareMode: (enabled: boolean) => void;
  /** Compare Canvas current-page filter 설정 */
  setCurrentPageFilter: (enabled: boolean) => void;
  /** Preview 터치 보기 설정 */
  setPreviewTouch: (enabled: boolean) => void;
}

export const useCompareModeStore = create<CompareModeState>()((set) => ({
  // 초기값: VITE_CANVAS_COMPARE_MODE 로 시드 (true → 초기 분할 활성, 헤더 "Skia Only Mode" 상태)
  isCompareMode: /^(true|1)$/i.test(
    import.meta.env.VITE_CANVAS_COMPARE_MODE ?? "",
  ),
  // Compare의 기존 동작은 Canvas 전체 page scene이다. 단일 page는 명시적 옵션이다.
  filterCurrentPage: false,
  previewTouch: false,

  toggleCompareMode: () => {
    set((state) => ({ isCompareMode: !state.isCompareMode }));
  },

  setCompareMode: (enabled) => {
    set({ isCompareMode: enabled });
  },

  setCurrentPageFilter: (enabled) => {
    set({ filterCurrentPage: enabled });
  },

  setPreviewTouch: (enabled) => {
    set({ previewTouch: enabled });
  },
}));
