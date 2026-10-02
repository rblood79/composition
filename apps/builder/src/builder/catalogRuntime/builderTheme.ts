import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import {
  useThemeConfigStore,
  type DarkModePreference,
  type RadiusScale,
} from "../../stores/themeConfigStore";
import type { NeutralPreset } from "../../utils/theme/neutralToSkiaColors";
import type { ResolvedThemeSnapshot } from "../../utils/theme/resolveThemeSnapshot";
import type { TintPreset } from "../../utils/theme/tintToSkiaColors";
import { catalogThemeState, type CatalogThemeState } from "./theme";

/**
 * The installed theme as the Builder panels read it (ADR-248 4e-8): the theme config store's
 * preset · color mode · base typography, one set per install (`themeVersion` +1 — the color
 * picker's theme palette and the token swatches re-resolve). The document stays the source; the
 * store keeps no project (`initThemeConfig` is not called), so nothing is persisted.
 */
function publishThemeConfig(snapshot: ResolvedThemeSnapshot): void {
  useThemeConfigStore.getState().applyResolvedTheme({
    tint: snapshot.preset.tint as TintPreset,
    darkMode: snapshot.darkMode as DarkModePreference,
    neutral: snapshot.preset.neutral as NeutralPreset,
    radiusScale: snapshot.preset.radiusScale as RadiusScale,
    baseTypography: snapshot.base,
  });
}

/** `catalogThemeState` for the Builder workspace: its install also updates the panels' theme. */
export function catalogBuilderThemeState(
  graph: CatalogGraph,
): CatalogThemeState {
  const state = catalogThemeState(graph);
  return {
    ...state,
    install: () => {
      state.install();
      publishThemeConfig(state.snapshot());
    },
  };
}

/** Calls `listener` when the OS appearance changes (a `system` theme follows it). */
export function subscribeSystemColorScheme(listener: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return () => {};
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
