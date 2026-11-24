import { act } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createTheme } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  ThemeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { applyCatalogPreviewTheme } from "../../../../../../packages/shared/src/catalog/runtime/domView";
import {
  CATALOG_DEFAULT_THEME_PRESET,
  catalogThemeState,
} from "../../../builder/catalogRuntime/theme";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 부록 D.1 Provider 대조 (2026-11-24): S2 `Provider` follows the OS appearance while
 * the page is open (`light dark`) and sets `color-scheme` on its element.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

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

const theme = (preset: Partial<ThemeEntry["preset"]>): ThemeEntry => ({
  kind: "theme",
  id: "project:theme:t1" as EntryId<"theme">,
  name: "Brand",
  tokenIds: [],
  preset: { ...CATALOG_DEFAULT_THEME_PRESET, ...preset },
});

it("a system theme in the Preview follows the OS switching to dark while it is open", async () => {
  const setDark = stubColorScheme(false);
  const applied: string[] = [];
  const h = await openAdr280Preview(["Button"], {
    applyTheme: (state) => applied.push(state.colorMode),
  });
  act(() => {
    h.workspace.execute(
      createTheme({ theme: theme({ darkMode: "system" }), activate: true }),
    );
  });
  h.flush();
  expect(applied.at(-1)).toBe("light");
  act(() => setDark(true));
  expect(applied.at(-1)).toBe("dark");
  h.view.unmount();
});

it("the applied theme sets the document's color-scheme (the browser's own parts follow it)", async () => {
  const h = await openAdr280Preview(["Button"]);
  const state = catalogThemeState(h.workspace.runtime.graph);
  applyCatalogPreviewTheme({ ...state, colorMode: "dark" });
  expect(document.documentElement.style.colorScheme).toBe("dark");
  applyCatalogPreviewTheme({ ...state, colorMode: "light" });
  expect(document.documentElement.style.colorScheme).toBe("light");
  h.view.unmount();
});
