/**
 * Global Stores - 통합 Export
 *
 * 앱 전역에서 사용되는 스토어들의 통합 진입점
 *
 * @since 2024-12-29 Phase 1
 */

// UI 설정 (테마 모드, UI 스케일)
export {
  useUiStore,
  useThemeMode,
  useUiScale,
  getUiState,
  type UiState,
  type ThemeMode,
  type UiScale,
} from "./uiStore";

// 테마 설정 (Tint, Dark Mode, Neutral, Radius — ADR-021)
export {
  useThemeConfigStore,
  useThemeConfigTint,
  useThemeConfigVersion,
  useThemeConfigDarkMode,
  useThemeConfigNeutral,
  useThemeConfigRadiusScale,
  type DarkModePreference,
  type RadiusScale,
} from "./themeConfigStore";
export type { TintPreset } from "../utils/theme/tintToSkiaColors";
export type { NeutralPreset } from "../utils/theme/neutralToSkiaColors";
