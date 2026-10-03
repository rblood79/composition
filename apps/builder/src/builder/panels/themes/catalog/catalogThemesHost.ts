import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  BASE_TYPOGRAPHY_TOKEN_KEYS,
  type ThemePreset as StoreThemePreset,
  type ThemesCollection,
  type TokensSnapshotEntry,
} from "@composition/shared";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../../../packages/shared/src/catalog/commands/compose";
import {
  createTheme,
  duplicateTheme,
  removeTheme,
  setActiveTheme,
  setThemeToken,
  updateTheme,
} from "../../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  ThemeEntry,
  ThemePreset,
  TokenEntry,
  TokenType,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  CATALOG_DEFAULT_THEME_PRESET,
  CATALOG_VIRTUAL_THEME_ID,
  catalogThemesView,
} from "../../../catalogRuntime/theme";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import {
  DEFAULT_BASE_TYPOGRAPHY,
  type BaseTypography,
} from "../../../fonts/customFonts";
import type { ThemesHost } from "../themesHostContext";

/** The panel's preset patch (old `radiusScale`) as the catalog preset's (`radius`). */
function presetPatch(patch: Partial<StoreThemePreset>): Partial<ThemePreset> {
  return {
    ...(patch.tint ? { tint: patch.tint as ThemePreset["tint"] } : {}),
    ...(patch.neutral
      ? { neutral: patch.neutral as ThemePreset["neutral"] }
      : {}),
    ...(patch.radiusScale
      ? { radius: patch.radiusScale as ThemePreset["radius"] }
      : {}),
    ...(patch.darkMode
      ? { darkMode: patch.darkMode as ThemePreset["darkMode"] }
      : {}),
  };
}

/** A panel token entry as a catalog token value (`number` keeps its type). */
function tokenValue(entry: TokensSnapshotEntry): {
  tokenType: TokenType;
  value: TokenEntry["value"];
} {
  return { tokenType: entry.type, value: entry.value };
}

/**
 * ADR-248 Phase 4e-4d-4: the Themes panel over the catalog workspace — the project's themes read
 * in the old collection shape (`catalogThemesView`, a project without one shows the virtual
 * default theme) and each write one command: a write to the virtual theme creates a real theme
 * with that edit (one step, active). Applying the theme (token maps · color mode · new root) is
 * the workspace's (`catalogThemeState`).
 */
export function createCatalogThemesHost(
  workspace: CatalogWorkspace,
): ThemesHost {
  const graph = () => workspace.runtime.graph;
  const view = () => catalogThemesView(graph());
  const isVirtual = (id: string) => id === CATALOG_VIRTUAL_THEME_ID;
  const run = (command: CatalogCommand): boolean => {
    const before = graph().revision;
    workspace.execute(command);
    return graph().revision !== before;
  };
  /** Several commands as one step, each reading the state the ones before it leave. */
  const runAll = (label: string, commands: readonly CatalogCommand[]) =>
    run(() => composeCommands(graph(), label, commands));
  /** A new theme entry (the virtual default's preset unless given). */
  const newTheme = (
    name: string,
    preset: Partial<ThemePreset> = {},
    tokenIds: EntryId<"token">[] = [],
  ): ThemeEntry => ({
    kind: "theme",
    id: workspace.newId("theme") as EntryId<"theme">,
    name,
    tokenIds,
    preset: { ...CATALOG_DEFAULT_THEME_PRESET, ...preset },
  });
  const newToken = (name: string, entry: TokensSnapshotEntry): TokenEntry => ({
    kind: "token",
    id: workspace.newId("token") as EntryId<"token">,
    name,
    ...tokenValue(entry),
    source: "user-defined",
  });
  /** Token edits on the active theme, or (no theme yet) a new active theme holding them. */
  const writeTokens = (
    themeId: string,
    edits: readonly [string, TokensSnapshotEntry | null][],
    label: string,
  ): boolean => {
    const theme = view().items[themeId];
    if (!theme) return false;
    const changed = edits.filter(([key, entry]) => {
      const current = theme.tokens[key];
      return entry
        ? current?.type !== entry.type || current?.value !== entry.value
        : current !== undefined;
    });
    if (!changed.length) return false;
    if (isVirtual(themeId)) {
      const tokens = changed.flatMap(([key, entry]) =>
        entry ? [newToken(key, entry)] : [],
      );
      if (!tokens.length) return false;
      return run(
        createTheme({
          theme: newTheme(
            theme.name,
            {},
            tokens.map((token) => token.id),
          ),
          tokens,
          activate: true,
          label,
        }),
      );
    }
    const commands = changed.map(([key, entry]) =>
      setThemeToken({
        themeId: themeId as EntryId<"theme">,
        name: key,
        value: entry ? tokenValue(entry) : null,
        newId: workspace.newId,
      }),
    );
    return runAll(label, commands);
  };

  const host: ThemesHost = {
    useThemes() {
      const subscribe = useCallback(
        (notify: () => void) => workspace.runtime.subscribeSteps(notify),
        [],
      );
      const revision = useSyncExternalStore(subscribe, () => graph().revision);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      return useMemo(view, [revision]);
    },
    useActivePreset() {
      const themes = host.useThemes() as ThemesCollection;
      return themes.items[themes.active]!.preset;
    },
    useBaseTypography() {
      const themes = host.useThemes() as ThemesCollection;
      const tokens = themes.items[themes.active]!.tokens;
      return useMemo(() => {
        const family = tokens[BASE_TYPOGRAPHY_TOKEN_KEYS.fontFamily]?.value;
        const size = tokens[BASE_TYPOGRAPHY_TOKEN_KEYS.fontSize]?.value;
        const lineHeight = tokens[BASE_TYPOGRAPHY_TOKEN_KEYS.lineHeight]?.value;
        return {
          fontFamily:
            typeof family === "string"
              ? family
              : DEFAULT_BASE_TYPOGRAPHY.fontFamily,
          fontSize:
            typeof size === "number" ? size : DEFAULT_BASE_TYPOGRAPHY.fontSize,
          lineHeight:
            typeof lineHeight === "number"
              ? lineHeight
              : DEFAULT_BASE_TYPOGRAPHY.lineHeight,
        };
      }, [tokens]);
    },
    addThemeFromActive(name) {
      const themes = view();
      const source = themes.items[themes.active];
      if (!source) return null;
      const copyName = name ?? `${source.name} copy`;
      if (isVirtual(source.id)) {
        // The default theme and its copy (active) — one step.
        const copy = newTheme(copyName);
        const ok = runAll("Duplicate theme", [
          createTheme({ theme: newTheme(source.name) }),
          createTheme({ theme: copy, activate: true }),
        ]);
        return ok ? copy.id : null;
      }
      const before = new Set(themes.order);
      const ok = run(
        duplicateTheme({
          id: source.id as EntryId<"theme">,
          name: copyName,
          newId: workspace.newId,
          activate: true,
        }),
      );
      return ok ? (view().order.find((id) => !before.has(id)) ?? null) : null;
    },
    removeTheme(id) {
      if (isVirtual(id) || view().order.length <= 1) return false;
      return run(removeTheme({ id: id as EntryId<"theme"> }));
    },
    renameTheme(id, name) {
      const theme = view().items[id];
      const next = name.trim();
      if (!theme || !next || next === theme.name) return false;
      if (isVirtual(id))
        return run(
          createTheme({
            theme: newTheme(next),
            activate: true,
            label: "Rename",
          }),
        );
      return run(updateTheme({ id: id as EntryId<"theme">, name: next }));
    },
    setActiveTheme(id) {
      const themes = view();
      if (isVirtual(id) || themes.active === id || !themes.items[id])
        return false;
      return run(setActiveTheme({ id: id as EntryId<"theme"> }));
    },
    setActiveThemePreset(patch) {
      const themes = view();
      const active = themes.items[themes.active];
      if (!active) return false;
      const next = presetPatch(patch);
      const current = presetPatch(active.preset);
      if (
        (Object.keys(next) as (keyof ThemePreset)[]).every(
          (key) => next[key] === current[key],
        )
      )
        return false;
      if (isVirtual(active.id))
        return run(
          createTheme({
            theme: newTheme(active.name, next),
            activate: true,
            label: "Edit theme",
          }),
        );
      return run(
        updateTheme({ id: active.id as EntryId<"theme">, preset: next }),
      );
    },
    setThemeToken(id, key, entry) {
      return writeTokens(id, [[key, entry]], "Edit token");
    },
    setActiveThemeBaseTypography(patch: Partial<BaseTypography>) {
      const themes = view();
      // A value equal to the seed drops the override (the old delta rule, ADR-143).
      const edit = (
        key: string,
        value: string | number | undefined,
        seed: string | number,
        type: "string" | "number",
      ): [string, TokensSnapshotEntry | null][] =>
        value === undefined
          ? []
          : [
              [
                key,
                value === seed ? null : { type, value, source: "user-defined" },
              ],
            ];
      return writeTokens(
        themes.active,
        [
          ...edit(
            BASE_TYPOGRAPHY_TOKEN_KEYS.fontFamily,
            patch.fontFamily,
            DEFAULT_BASE_TYPOGRAPHY.fontFamily,
            "string",
          ),
          ...edit(
            BASE_TYPOGRAPHY_TOKEN_KEYS.fontSize,
            patch.fontSize,
            DEFAULT_BASE_TYPOGRAPHY.fontSize,
            "number",
          ),
          ...edit(
            BASE_TYPOGRAPHY_TOKEN_KEYS.lineHeight,
            patch.lineHeight,
            DEFAULT_BASE_TYPOGRAPHY.lineHeight,
            "number",
          ),
        ],
        "Edit typography",
      );
    },
  };
  return host;
}
