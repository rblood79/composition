import { useContext } from "react";
import type { ThemePreset, ThemesCollection } from "@composition/shared";
import {
  useThemeConfigBaseTypography,
  useThemeConfigDarkMode,
  useThemeConfigNeutral,
  useThemeConfigRadiusScale,
  useThemeConfigStore,
  useThemeConfigTint,
  type RadiusScale,
} from "../../../stores/themeConfigStore";
import type { NeutralPreset } from "../../../utils/theme/neutralToSkiaColors";
import type { TintPreset } from "../../../utils/theme/tintToSkiaColors";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import {
  addThemeFromActive,
  removeTheme,
  renameTheme,
  setActiveTheme,
  setActiveThemeBaseTypography,
  setActiveThemePreset,
  setThemeToken,
} from "./themeActions";
import { ThemesHostContext, type ThemesHost } from "./themesHostContext";

/** 현재 문서의 테마 컬렉션 — 구독 (setThemes 가 문서를 교체하므로 참조 변경 = 갱신). */
function useStoreThemes(): ThemesCollection | null {
  return useCanonicalDocumentStore((s) => {
    const id = s.currentProjectId;
    const doc = id ? s.documents.get(id) : undefined;
    return (doc?.themes as ThemesCollection | undefined) ?? null;
  });
}

/**
 * The old Themes panel: document-first writes (`themeActions`); before the document has a theme
 * collection (migration window) preset and typography go to `themeConfigStore` directly.
 */
export const STORE_THEMES_HOST: ThemesHost = {
  useThemes: useStoreThemes,
  useActivePreset: (): ThemePreset => ({
    tint: useThemeConfigTint(),
    darkMode: useThemeConfigDarkMode(),
    neutral: useThemeConfigNeutral(),
    radiusScale: useThemeConfigRadiusScale(),
  }),
  useBaseTypography: useThemeConfigBaseTypography,
  addThemeFromActive,
  removeTheme,
  renameTheme,
  setActiveTheme,
  setActiveThemePreset: (patch) => {
    if (setActiveThemePreset(patch)) return true;
    const store = useThemeConfigStore.getState();
    if (patch.darkMode)
      store.setDarkMode(patch.darkMode as "light" | "dark" | "system");
    if (patch.tint) store.setTint(patch.tint as TintPreset);
    if (patch.neutral) store.setNeutral(patch.neutral as NeutralPreset);
    if (patch.radiusScale)
      store.setRadiusScale(patch.radiusScale as RadiusScale);
    return true;
  },
  setThemeToken,
  setActiveThemeBaseTypography: (patch) => {
    if (setActiveThemeBaseTypography(patch)) return true;
    useThemeConfigStore.getState().setBaseTypography(patch);
    return true;
  },
};

export function useThemesHost(): ThemesHost {
  return useContext(ThemesHostContext) ?? STORE_THEMES_HOST;
}
