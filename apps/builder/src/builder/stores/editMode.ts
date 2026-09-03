/**
 * Edit Mode Store - Zustand Store for Edit Mode Management
 *
 * Page 편집 모드와 Layout 편집 모드를 관리
 * - Page 모드: 일반 Page 요소 편집
 * - Layout 모드: Layout 구조 및 Slot 편집
 *
 * EditMode* UI 상태 타입은 legacy `layout.types` schema 와 분리한다
 * (legacy model migration — layout-contracts slice).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StateCreator } from "zustand";

// ============================================
// Edit Mode Types (UI state — not layout schema)
// ============================================

/** 편집 모드 타입 */
export type EditMode = "page" | "layout";

/** 편집 컨텍스트 */
export interface EditContext {
  mode: EditMode;
  pageId: string | null;
  layoutId: string | null;
}

/** Edit Mode Store State */
export interface EditModeStoreState {
  /** 현재 편집 모드 */
  mode: EditMode;

  /** Page 모드일 때 편집 중인 Page ID */
  pageId: string | null;

  /** Layout 모드일 때 편집 중인 Layout ID */
  layoutId: string | null;
}

/** Edit Mode Store Actions */
export interface EditModeStoreActions {
  /** Page 편집 모드로 전환 */
  enterPageMode: (pageId: string) => void;

  /** Layout 편집 모드로 전환 */
  enterLayoutMode: (layoutId: string) => void;

  /** 현재 편집 컨텍스트 반환 */
  getEditContext: () => EditContext;

  /** Edit Mode 직접 설정 (탭 전환용) */
  setMode: (mode: EditMode) => void;

  /** 현재 편집 중인 Page ID 설정 */
  setCurrentPageId: (pageId: string | null) => void;

  /** 현재 편집 중인 Layout ID 설정 */
  setCurrentLayoutId: (layoutId: string | null) => void;
}

/** 완전한 Edit Mode Store 타입 */
export type EditModeStore = EditModeStoreState & EditModeStoreActions;

// ============================================
// Store Slice Creator
// ============================================

export const createEditModeSlice: StateCreator<EditModeStore> = (set, get) => {
  return {
    // ============================================
    // State
    // ============================================
    mode: "page" as EditMode,
    pageId: null,
    layoutId: null,

    // ============================================
    // Actions
    // ============================================

    /**
     * Page 편집 모드로 전환
     * @param pageId - 편집할 Page ID
     */
    enterPageMode: (pageId: string) => {
      set({
        mode: "page",
        pageId,
        layoutId: null,
      });
      console.log("📄 Page 편집 모드 진입:", pageId);
    },

    /**
     * Layout 편집 모드로 전환
     * @param layoutId - 편집할 Layout ID
     */
    enterLayoutMode: (layoutId: string) => {
      set({
        mode: "layout",
        pageId: null,
        layoutId,
      });
      console.log("🏗️ Layout 편집 모드 진입:", layoutId);
    },

    /**
     * 현재 편집 컨텍스트 반환
     */
    getEditContext: (): EditContext => {
      const { mode, pageId, layoutId } = get();
      return { mode, pageId, layoutId };
    },

    /**
     * Edit Mode 직접 설정 (탭 전환용)
     * @param mode - 설정할 모드
     */
    setMode: (mode: EditMode) => {
      set({ mode });
      console.log(`📝 Edit Mode 변경: ${mode}`);
    },

    /**
     * 현재 편집 중인 Page ID 설정
     * @param pageId - Page ID (null이면 초기화)
     */
    setCurrentPageId: (pageId: string | null) => {
      set({ pageId });
    },

    /**
     * 현재 편집 중인 Layout ID 설정
     * @param layoutId - Layout ID (null이면 초기화)
     */
    setCurrentLayoutId: (layoutId: string | null) => {
      set({ layoutId });
    },
  };
};

// ============================================
// Store Instance
// ⭐ Layout/Slot System: persist middleware로 editMode 상태 유지
// ============================================

export const useEditModeStore = create<EditModeStore>()(
  persist(createEditModeSlice, {
    name: "composition-edit-mode",
    // mode만 저장 (pageId, layoutId는 저장하지 않음 - 각 스토어에서 관리)
    partialize: (state) => ({ mode: state.mode }),
  }),
);

// ============================================
// Selectors (for optimized re-renders)
// ============================================

/**
 * 현재 편집 모드 가져오기
 */
export const useEditMode = (): EditMode => {
  return useEditModeStore((state) => state.mode);
};

/**
 * Page 모드인지 확인
 */
export const useIsPageMode = (): boolean => {
  return useEditModeStore((state) => state.mode === "page");
};

/**
 * Layout 모드인지 확인
 */
export const useIsLayoutMode = (): boolean => {
  return useEditModeStore((state) => state.mode === "layout");
};

/**
 * 현재 편집 중인 Page ID 가져오기
 */
export const useCurrentEditPageId = (): string | null => {
  return useEditModeStore((state) => state.pageId);
};

/**
 * 현재 편집 중인 Layout ID 가져오기
 */
export const useCurrentEditLayoutId = (): string | null => {
  return useEditModeStore((state) => state.layoutId);
};

/**
 * 현재 편집 컨텍스트 가져오기
 */
export const useEditContext = (): EditContext => {
  const mode = useEditModeStore((state) => state.mode);
  const pageId = useEditModeStore((state) => state.pageId);
  const layoutId = useEditModeStore((state) => state.layoutId);
  return { mode, pageId, layoutId };
};
