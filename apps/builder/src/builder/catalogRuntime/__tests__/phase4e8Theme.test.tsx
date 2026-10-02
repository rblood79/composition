import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  ThemeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  createTheme,
  updateTheme,
} from "../../../../../../packages/shared/src/catalog/commands";
import { useThemeConfigStore } from "../../../stores/themeConfigStore";
import { installThemeMaps } from "../../../utils/theme/themeMaps";
import { createCatalogThemesHost } from "../../panels/themes/catalog/catalogThemesHost";
import { catalogTextTypography } from "../boxModel";
import {
  catalogBuilderThemeState,
  subscribeSystemColorScheme,
} from "../builderTheme";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CATALOG_DEFAULT_THEME_PRESET } from "../theme";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e-8: the Builder's installed theme reaches what the old theme store fed — the panels'
 * preset · color mode · base typography (color picker palette, token swatches), the Canvas text's
 * base font family (the Preview root inherits it), and a `system` theme following the OS.
 */
const THEME = "project:theme:t1" as EntryId<"theme">;
const theme = (preset: Partial<ThemeEntry["preset"]> = {}): ThemeEntry => ({
  kind: "theme",
  id: THEME,
  name: "Brand",
  tokenIds: [],
  preset: { ...CATALOG_DEFAULT_THEME_PRESET, ...preset },
});

afterEach(() => {
  installThemeMaps(null);
  vi.unstubAllGlobals();
});

async function open() {
  return new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:theme8" as EntryId<"project">,
        name: "Theme",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e8-theme-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      theme: catalogBuilderThemeState,
    },
  );
}

/** A controllable `(prefers-color-scheme: dark)` query. */
function stubColorScheme(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return dark;
      },
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
    })),
  );
  return (next: boolean) => {
    dark = next;
    for (const listener of [...listeners]) listener();
  };
}

describe("ADR-248 4e-8 Builder theme", () => {
  it("each install publishes the theme to the panels' store", async () => {
    const workspace = await open();
    const store = useThemeConfigStore.getState;
    expect(store()).toMatchObject({ tint: "blue", darkMode: "light" });
    const version = store().themeVersion;

    workspace.execute(
      createTheme({
        theme: theme({ darkMode: "dark", tint: "red" }),
        activate: true,
      }),
    );
    expect(store()).toMatchObject({
      tint: "red",
      darkMode: "dark",
      neutral: "neutral",
      radiusScale: "md",
    });
    expect(store().themeVersion).toBeGreaterThan(version);

    workspace.execute(updateTheme({ id: THEME, preset: { tint: "green" } }));
    expect(store().tint).toBe("green");
    workspace.undo();
    expect(store().tint).toBe("red");
  });

  it("the theme's base font family is the text default (own and inherited families win)", async () => {
    const workspace = await open();
    expect(catalogTextTypography({ visual: {} }).fontFamily).toBeUndefined();

    createCatalogThemesHost(workspace).setActiveThemeBaseTypography({
      fontFamily: "Noto Serif KR, serif",
    });
    expect(useThemeConfigStore.getState().baseTypography.fontFamily).toBe(
      "Noto Serif KR, serif",
    );
    expect(catalogTextTypography({ visual: {} }).fontFamily).toBe(
      "Noto Serif KR, serif",
    );
    expect(
      catalogTextTypography({ visual: {}, inheritedText: { fontFamily: "A" } })
        .fontFamily,
    ).toBe("A");
    expect(
      catalogTextTypography({ visual: { fontFamily: "B" } }).fontFamily,
    ).toBe("B");

    workspace.undo();
    expect(catalogTextTypography({ visual: {} }).fontFamily).toBeUndefined();
  });

  it("a system theme follows the OS appearance", async () => {
    const setDark = stubColorScheme(false);
    const workspace = await open();
    const unsubscribe = subscribeSystemColorScheme(() =>
      workspace.refreshTheme(),
    );
    workspace.execute(
      createTheme({ theme: theme({ darkMode: "system" }), activate: true }),
    );
    expect(workspace.root.colorMode).toBe("light");
    const before = workspace.root;
    const version = useThemeConfigStore.getState().themeVersion;

    setDark(true);
    expect(workspace.root).not.toBe(before);
    expect(workspace.root.colorMode).toBe("dark");
    expect(useThemeConfigStore.getState().themeVersion).toBeGreaterThan(
      version,
    );

    // No change: the root stays.
    const dark = workspace.root;
    workspace.refreshTheme();
    expect(workspace.root).toBe(dark);

    unsubscribe();
    setDark(false);
    expect(workspace.root.colorMode).toBe("dark");
  });
});
