import type { ThemesCollection } from "@composition/shared";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import type { ThemePreset } from "@composition/shared";
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
import {
  addThemeFromActive,
  removeTheme,
  renameTheme,
  setActiveTheme,
  setActiveThemeBaseTypography,
  setActiveThemePreset,
  setThemeToken,
} from "./themeActions";
import type { ThemesHost } from "./themesHostContext";
import { setThemesHostTestFallback } from "./themesHost";

/** 현재 문서의 테마 컬렉션 — 구독 (setThemes 가 문서를 교체하므로 참조 변경 = 갱신). */
function useStoreThemes(): ThemesCollection | null {
  return useCanonicalDocumentStore((s) => {
    const id = s.currentProjectId;
    const doc = id ? s.documents.get(id) : undefined;
    return (doc?.themes as ThemesCollection | undefined) ?? null;
  });
}

/**
 * ADR-248 4e-7: the old element store's ThemesHost — no longer in the app (the catalog workspace
 * provides the host). Old-store tests import this module to run against it; it goes with the
 * old store.
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

setThemesHostTestFallback(STORE_THEMES_HOST);
