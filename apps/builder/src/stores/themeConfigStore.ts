/**
 * Theme Config Store
 *
 * Builder 패널이 읽는 활성 테마 선택값 (ADR-021 · ADR-227).
 * 문서의 활성 테마가 정본이고, 설치 (`installThemeMaps`) 가 Skia 토큰 맵을 바꾼 뒤
 * `applyResolvedTheme` 이 이 store 를 한 번에 맞춘다 (`builderTheme.ts`).
 *
 * - themeVersion 증가 → 토큰 맵을 읽는 패널 memo 재계산
 *
 * @see ADR-021
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { TintPreset } from "../utils/theme/tintToSkiaColors";
import type { NeutralPreset } from "../utils/theme/neutralToSkiaColors";
import {
  DEFAULT_BASE_TYPOGRAPHY,
  type BaseTypography,
} from "../builder/fonts/customFonts";

// ============================================================================
// Types
// ============================================================================

export type DarkModePreference = "light" | "dark" | "system";

export type RadiusScale = "none" | "sm" | "md" | "lg" | "xl";

/** 활성 테마가 정하는 설정 필드 */
interface PersistedThemeConfig {
  tint: TintPreset;
  darkMode: DarkModePreference;
  neutral: NeutralPreset;
  radiusScale: RadiusScale;
  baseTypography: BaseTypography;
}

interface ThemeConfigState extends PersistedThemeConfig {
  /**
   * 테마 재해석 신호용 버전 카운터.
   * 토큰 맵은 제자리에서 바뀌므로 이 값이 구독자의 유일한 재계산 신호다.
   */
  themeVersion: number;

  /**
   * ADR-227 — 활성 테마 snapshot 설치 뒤 store 필드를 **한 번의 set** 으로 맞춘다 (themeVersion +1).
   * 토큰 맵 mutation · notifyLayoutChange · Preview 전송은 `installThemeMaps` 가 소유 —
   * 여기서는 store 상태만.
   */
  applyResolvedTheme: (fields: PersistedThemeConfig) => void;
}

// ============================================================================
// Store
// ============================================================================

/** store 기본 선택값. */
export const DEFAULT_THEME_SELECTION = {
  tint: "blue",
  neutral: "neutral",
  radiusScale: "md",
} as const satisfies {
  tint: TintPreset;
  neutral: NeutralPreset;
  radiusScale: RadiusScale;
};

export const useThemeConfigStore = create<ThemeConfigState>()(
  devtools(
    (set) => ({
      tint: DEFAULT_THEME_SELECTION.tint,
      darkMode: "light",
      neutral: DEFAULT_THEME_SELECTION.neutral,
      radiusScale: DEFAULT_THEME_SELECTION.radiusScale,
      baseTypography: DEFAULT_BASE_TYPOGRAPHY,
      themeVersion: 0,

      applyResolvedTheme: (fields) => {
        set(
          (state) => ({
            tint: fields.tint,
            darkMode: fields.darkMode,
            neutral: fields.neutral,
            radiusScale: fields.radiusScale,
            baseTypography: fields.baseTypography,
            themeVersion: state.themeVersion + 1,
          }),
          undefined,
          "applyResolvedTheme",
        );
      },
    }),
    { name: "ThemeConfigStore" },
  ),
);

// ============================================================================
// Selectors
// ============================================================================

export const useThemeConfigTint = () => useThemeConfigStore((s) => s.tint);

export const useThemeConfigVersion = () =>
  useThemeConfigStore((s) => s.themeVersion);

export const useThemeConfigDarkMode = () =>
  useThemeConfigStore((s) => s.darkMode);

export const useThemeConfigNeutral = () =>
  useThemeConfigStore((s) => s.neutral);

export const useThemeConfigRadiusScale = () =>
  useThemeConfigStore((s) => s.radiusScale);

export const useThemeConfigBaseTypography = () =>
  useThemeConfigStore((s) => s.baseTypography);

/**
 * DarkModePreference → 실제 "light" | "dark" 해석.
 * "system"이면 OS 미디어 쿼리 기준. Skia theme 파라미터로 사용.
 */
export function resolveSkiaTheme(pref: DarkModePreference): "light" | "dark" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

export const useResolvedSkiaTheme = () =>
  useThemeConfigStore((s) => resolveSkiaTheme(s.darkMode));

// dev 전용 디버그 전역 — live 하니스가 런타임 파생값 (ADR-227 문서 → store) 을 읽는 진입점.
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (window as unknown as Record<string, unknown>).__composition_THEME_CONFIG__ =
    useThemeConfigStore;
}
