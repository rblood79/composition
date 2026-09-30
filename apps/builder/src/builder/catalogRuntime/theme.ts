import type {
  ThemeDefinition,
  ThemesCollection,
  TokensSnapshot,
} from "@composition/shared";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  ProjectEntry,
  ThemeEntry,
  ThemePreset,
  TokenEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  resolveThemeSnapshot,
  type ResolvedThemeSnapshot,
} from "../../utils/theme/resolveThemeSnapshot";
import { installThemeMaps } from "../../utils/theme/themeMaps";
import { DEFAULT_BASE_TYPOGRAPHY } from "../fonts/customFonts";

/** The preset of a theme the Themes panel creates (the old default theme's). */
export const CATALOG_DEFAULT_THEME_PRESET: ThemePreset = {
  tint: "blue",
  neutral: "neutral",
  radius: "md",
  darkMode: "light",
};
/**
 * The theme a project without one applies and shows in the Themes panel (not a document entry):
 * the default preset. The panel's first edit creates a real theme with that edit applied.
 */
export const CATALOG_VIRTUAL_THEME_ID = "catalog:theme:default";
const VIRTUAL_THEME: ThemeDefinition = {
  id: CATALOG_VIRTUAL_THEME_ID,
  name: "Default",
  preset: {
    tint: CATALOG_DEFAULT_THEME_PRESET.tint,
    darkMode: CATALOG_DEFAULT_THEME_PRESET.darkMode,
    neutral: CATALOG_DEFAULT_THEME_PRESET.neutral,
    radiusScale: CATALOG_DEFAULT_THEME_PRESET.radius,
  },
  tokens: {},
};

function projectOf(graph: CatalogGraph): ProjectEntry {
  return graph.getEntry(graph.projectId) as ProjectEntry;
}

/** The theme the project applies: its active theme (else its first). */
export function catalogActiveTheme(
  graph: CatalogGraph,
): ThemeEntry | undefined {
  const project = projectOf(graph);
  const id = project.activeThemeId ?? project.themeIds[0];
  const entry = id ? graph.getEntry(id) : undefined;
  return entry?.kind === "theme" ? entry : undefined;
}

function tokensOf(
  graph: CatalogGraph,
  ids: readonly EntryId<"token">[],
): TokensSnapshot {
  const tokens: TokensSnapshot = {};
  for (const id of ids) {
    const token = graph.getEntry(id) as TokenEntry | undefined;
    if (token?.kind !== "token") continue;
    tokens[token.name] = {
      type: token.tokenType === "length" ? "number" : token.tokenType,
      value: token.value,
      source: token.source,
    } as TokensSnapshot[string];
  }
  return tokens;
}

/** A catalog theme in the old theme shape (the Themes panel's and `resolveThemeSnapshot`'s input). */
export function catalogThemeDefinition(
  graph: CatalogGraph,
  theme: ThemeEntry,
): ThemeDefinition {
  return {
    id: theme.id,
    name: theme.name,
    preset: {
      tint: theme.preset.tint,
      darkMode: theme.preset.darkMode,
      neutral: theme.preset.neutral,
      radiusScale: theme.preset.radius,
    },
    tokens: tokensOf(graph, theme.tokenIds),
  };
}

/** Project tokens no theme owns (every theme's fallback). */
export function catalogRootTokens(graph: CatalogGraph): TokensSnapshot {
  const project = projectOf(graph);
  const owned = new Set<string>();
  for (const id of project.themeIds) {
    const theme = graph.getEntry(id);
    if (theme?.kind === "theme") for (const t of theme.tokenIds) owned.add(t);
  }
  return tokensOf(
    graph,
    project.tokenIds.filter((id) => !owned.has(id)),
  );
}

/** The project's themes as the Themes panel reads them (a project without one: the virtual theme). */
export function catalogThemesView(graph: CatalogGraph): ThemesCollection {
  const project = projectOf(graph);
  const items: ThemesCollection["items"] = {};
  for (const id of project.themeIds) {
    const theme = graph.getEntry(id);
    if (theme?.kind === "theme")
      items[id] = catalogThemeDefinition(graph, theme);
  }
  const order = Object.keys(items);
  if (!order.length)
    return {
      active: CATALOG_VIRTUAL_THEME_ID,
      order: [CATALOG_VIRTUAL_THEME_ID],
      items: { [CATALOG_VIRTUAL_THEME_ID]: VIRTUAL_THEME },
    };
  return {
    active: catalogActiveTheme(graph)?.id ?? order[0]!,
    order,
    items,
  };
}

/** `system` follows the OS appearance. */
function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** What the workspace applies for the graph's theme (`CatalogWorkspaceOptions.theme`). */
export interface CatalogThemeState {
  /** Changes when anything the theme reads changes (active theme, its preset and tokens). */
  key: string;
  colorMode: "light" | "dark";
  /** Install the theme into the token maps the Canvas and library tokens read. */
  install: () => void;
  /** The resolved theme (the DOM's CSS variables · base typography), computed once. */
  snapshot: () => ResolvedThemeSnapshot;
}

/**
 * ADR-248 Phase 4e-4d-4: the project's theme for the Builder — the active theme (a project without
 * one: the default preset, as the Preview's CSS derives its `--tint` default) with the project and
 * theme tokens resolved into the specs token maps (Skia paint, rule executor and library token
 * reads), and its color mode (`system` read now) for the composition root.
 */
export function catalogThemeState(graph: CatalogGraph): CatalogThemeState {
  const theme = catalogActiveTheme(graph);
  const definition = theme
    ? catalogThemeDefinition(graph, theme)
    : VIRTUAL_THEME;
  const rootTokens = catalogRootTokens(graph);
  const darkMode = definition.preset.darkMode;
  const colorMode =
    darkMode === "system" ? (prefersDark() ? "dark" : "light") : darkMode;
  let resolved: ResolvedThemeSnapshot | undefined;
  const snapshot = () =>
    (resolved ??= resolveThemeSnapshot(definition, {
      rootTokens,
      baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
    }));
  return {
    key: JSON.stringify([definition, rootTokens, colorMode]),
    colorMode: colorMode === "dark" ? "dark" : "light",
    install: () => installThemeMaps(snapshot()),
    snapshot,
  };
}
