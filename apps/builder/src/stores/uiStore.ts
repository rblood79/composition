/**
 * UI Store
 *
 * 앱 전역 UI 설정 관리 (localStorage 기반 영구 저장)
 * - themeMode: 테마 모드 (light/dark/auto)
 * - uiScale: UI 스케일 (80/100/120)
 * - toastPlacement: 빌더 알림 Toast 자리 (S2 `ToastContainer` placement — 앱 토스트 자리는 프로젝트의
 *   Site 「Toast placement」 로 따로 둔다, 사용자 2026-11-12)
 *
 * Phase 1: settings.ts에서 분리하여 글로벌 UI 설정 격리
 *
 * @since 2024-12-29
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ToastPlacement } from "../../../../packages/shared/src/components/Toast";

// ============================================
// Types
// ============================================

export type ThemeMode = "light" | "dark" | "auto";
export type UiScale = 80 | 100 | 120;
export type { ToastPlacement };

export interface UiState {
  /** 테마 모드 (기본값: 'auto') */
  themeMode: ThemeMode;

  /** UI 스케일 (기본값: 100) */
  uiScale: UiScale;

  /** 빌더 알림 Toast 자리 (기본값: 'bottom' — S2 `ToastContainer` 기본, 사용자 2026-11-12) */
  toastPlacement: ToastPlacement;

  /** 테마 모드 설정 */
  setThemeMode: (mode: ThemeMode) => void;

  /** UI 스케일 설정 */
  setUiScale: (scale: UiScale) => void;

  /** 빌더 알림 Toast 자리 설정 */
  setToastPlacement: (placement: ToastPlacement) => void;

  /** 설정 초기화 */
  resetUiSettings: () => void;
}

// ============================================
// Default Values
// ============================================

const DEFAULT_UI_STATE = {
  themeMode: "auto" as ThemeMode,
  uiScale: 100 as UiScale,
  toastPlacement: "bottom" as ToastPlacement,
};

// ============================================
// Store
// ============================================

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      // Initial state
      ...DEFAULT_UI_STATE,

      // Actions
      setThemeMode: (mode: ThemeMode) => {
        set({ themeMode: mode });
      },

      setUiScale: (scale: UiScale) => {
        document.documentElement.style.setProperty("--ui-scale", String(scale));
        set({ uiScale: scale });
      },

      setToastPlacement: (placement: ToastPlacement) => {
        set({ toastPlacement: placement });
      },

      resetUiSettings: () => {
        set(DEFAULT_UI_STATE);
      },
    }),
    {
      name: "composition-ui", // localStorage key
      onRehydrateStorage: () => (state) => {
        if (state?.uiScale) {
          document.documentElement.style.setProperty(
            "--ui-scale",
            String(state.uiScale),
          );
        }
      },
    },
  ),
);

// ============================================
// Selectors (for convenience)
// ============================================

export const useThemeMode = () => useUiStore((state) => state.themeMode);
export const useUiScale = () => useUiStore((state) => state.uiScale);

// ============================================
// Non-React Access (for effects, services)
// ============================================

export const getUiState = (): Pick<UiState, "themeMode" | "uiScale"> => {
  const state = useUiStore.getState();
  return {
    themeMode: state.themeMode,
    uiScale: state.uiScale,
  };
};
