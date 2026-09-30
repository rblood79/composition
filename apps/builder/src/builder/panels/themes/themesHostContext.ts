import { createContext } from "react";
import type {
  ThemePreset,
  ThemesCollection,
  TokensSnapshotEntry,
} from "@composition/shared";
import type { BaseTypography } from "../../fonts/customFonts";

/**
 * ADR-248 Phase 4e-4d-4: what the Themes panel reads and writes — the old canonical document and
 * `themeConfigStore` (`STORE_THEMES_HOST`) or the catalog workspace (`createCatalogThemesHost`).
 * Reads are hooks; every write is one history step and returns whether it changed anything.
 */
export interface ThemesHost {
  /** The project's themes (the old collection shape); `null` = none to list yet. */
  useThemes(): ThemesCollection | null;
  /** The active theme's preset the Colors · Appearance sections show. */
  useActivePreset(): ThemePreset;
  /** The base typography the Typography section shows. */
  useBaseTypography(): BaseTypography;
  /** A copy of the active theme becomes active; its id. */
  addThemeFromActive(name?: string): string | null;
  removeTheme(id: string): boolean;
  renameTheme(id: string, name: string): boolean;
  setActiveTheme(id: string): boolean;
  setActiveThemePreset(patch: Partial<ThemePreset>): boolean;
  /** A theme's token override; `null` drops it (the seed value shows again). */
  setThemeToken(
    id: string,
    key: string,
    entry: TokensSnapshotEntry | null,
  ): boolean;
  setActiveThemeBaseTypography(patch: Partial<BaseTypography>): boolean;
}

/** `null` = the old store (`STORE_THEMES_HOST`); the catalog Themes panel provides its own. */
export const ThemesHostContext = createContext<ThemesHost | null>(null);
