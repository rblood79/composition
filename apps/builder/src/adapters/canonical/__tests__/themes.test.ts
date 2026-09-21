/**
 * @fileoverview ADR-110 Phase 1/2 themes adapter — ADR-227 컬렉션 모양으로 갱신 (2026-09-22).
 *
 * - `snapshotThemesFromConfig()` → Default 테마 하나짜리 `ThemesCollection`
 * - `readCanonicalThemes()` → 활성 preset (컬렉션 · 구 단일 snapshot 둘 다)
 * - `legacyToCanonical()` + `getThemeConfig` 연동 (call-time, R4)
 * - `applyCanonicalThemes()` → 활성 preset + base typography 델타 → setter
 */

import { describe, expect, it, vi } from "vitest";
import {
  snapshotThemesFromConfig,
  readCanonicalThemes,
  applyCanonicalThemes,
  readBaseTypographyFromTheme,
  type ThemeConfigInput,
  type ThemeConfigSetters,
} from "../themesAdapter";
import { legacyToCanonical } from "../index";
import { convertComponentRole } from "../componentRoleAdapter";
import { convertPageLayout } from "../slotAndLayoutAdapter";
import type { CompositionDocument } from "@composition/shared";
import {
  BASE_TYPOGRAPHY_TOKEN_KEYS,
  DEFAULT_THEME_ID,
  createThemesCollection,
  getActiveTheme,
  isThemesCollection,
  setThemeToken,
} from "@composition/shared";

const deps = { convertComponentRole, convertPageLayout };
const EMPTY = { elements: [], pages: [], layouts: [] };
const config: ThemeConfigInput = {
  tint: "blue",
  darkMode: "light",
  neutral: "neutral",
  radiusScale: "md",
};

describe("snapshotThemesFromConfig (ADR-110 → ADR-227 컬렉션)", () => {
  it("TC-T1: 4 필드가 Default 테마 preset 으로 · 델타 {} · 컬렉션 모양", () => {
    const snap = snapshotThemesFromConfig({ ...config, darkMode: "system", tint: "purple" });
    expect(isThemesCollection(snap)).toBe(true);
    expect(snap.active).toBe(DEFAULT_THEME_ID);
    expect(snap.items[DEFAULT_THEME_ID]!.preset).toEqual({
      tint: "purple",
      darkMode: "system",
      neutral: "neutral",
      radiusScale: "md",
    });
    expect(snap.items[DEFAULT_THEME_ID]!.tokens).toEqual({});
  });
});

describe("readCanonicalThemes", () => {
  it("TC-T5: round-trip — snapshot → doc → 활성 preset", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      themes: snapshotThemesFromConfig({ ...config, tint: "red" }),
      children: [],
    };
    expect(readCanonicalThemes(doc)).toEqual({ ...config, tint: "red" });
  });

  it("themes 부재 → undefined · 구 단일 ThemeSnapshot 모양 (migration 전) 도 읽는다 · 무효 모양 → undefined", () => {
    expect(readCanonicalThemes({ version: "composition-1.0", children: [] })).toBeUndefined();
    const legacy = {
      version: "composition-1.0",
      themes: { tint: "pink", darkMode: "dark", neutral: "zinc", radiusScale: "lg" },
      children: [],
    } as unknown as CompositionDocument;
    expect(readCanonicalThemes(legacy)).toEqual({ tint: "pink", darkMode: "dark", neutral: "zinc", radiusScale: "lg" });
    const bad = { version: "composition-1.0", themes: { tint: 1 }, children: [] } as unknown as CompositionDocument;
    expect(readCanonicalThemes(bad)).toBeUndefined();
  });

  it("컬렉션의 active 항목을 읽는다 (Default 가 아니어도)", () => {
    let themes = createThemesCollection(config);
    themes = {
      ...themes,
      items: { ...themes.items, dark: { id: "dark", name: "Dark", preset: { ...config, darkMode: "dark" }, tokens: {} } },
      order: [...themes.order, "dark"],
      active: "dark",
    };
    expect(readCanonicalThemes({ version: "composition-1.0", themes, children: [] })?.darkMode).toBe("dark");
  });
});

describe("legacyToCanonical + getThemeConfig", () => {
  it("TC-T6/T7: getThemeConfig 전달 시 컬렉션 주입 · 미전달 시 undefined (BC)", () => {
    const withTheme = legacyToCanonical(EMPTY, { ...deps, getThemeConfig: () => config });
    expect(isThemesCollection(withTheme.themes)).toBe(true);
    expect(getActiveTheme(withTheme)?.preset).toEqual(config);
    expect(legacyToCanonical(EMPTY, deps).themes).toBeUndefined();
  });

  it("TC-T8: getThemeConfig 는 call-time 1회 (R4 stale 방지)", () => {
    const getThemeConfig = vi.fn(() => config);
    legacyToCanonical(EMPTY, { ...deps, getThemeConfig });
    expect(getThemeConfig).toHaveBeenCalledTimes(1);
  });
});

describe("applyCanonicalThemes", () => {
  function createMockSetters() {
    const calls = { setTint: [] as string[], setDarkMode: [] as string[], setNeutral: [] as string[], setRadiusScale: [] as string[], setBaseTypography: [] as unknown[] };
    const setters: ThemeConfigSetters = {
      setTint: (t) => calls.setTint.push(t),
      setDarkMode: (m) => calls.setDarkMode.push(m),
      setNeutral: (n) => calls.setNeutral.push(n),
      setRadiusScale: (r) => calls.setRadiusScale.push(r),
      setBaseTypography: (p) => calls.setBaseTypography.push(p),
    };
    return { calls, setters };
  }

  it("TC-A1: 컬렉션 존재 시 4 setter + baseTypography (델타에서) 호출 · true", () => {
    const { calls, setters } = createMockSetters();
    const themes = setThemeToken(
      createThemesCollection({ ...config, tint: "green" }),
      DEFAULT_THEME_ID,
      BASE_TYPOGRAPHY_TOKEN_KEYS.fontSize,
      { type: "number", value: 18, source: "spec-token" },
    );
    const doc: CompositionDocument = { version: "composition-1.0", themes, children: [] };
    expect(applyCanonicalThemes(doc, setters)).toBe(true);
    expect(calls.setTint).toEqual(["green"]);
    expect(calls.setDarkMode).toEqual(["light"]);
    expect(calls.setNeutral).toEqual(["neutral"]);
    expect(calls.setRadiusScale).toEqual(["md"]);
    expect(calls.setBaseTypography).toEqual([{ fontSize: 18 }]);
    expect(readBaseTypographyFromTheme(getActiveTheme(doc)!)).toEqual({ fontSize: 18 });
  });

  it("TC-A2/A3: themes 부재 · 무효 모양 → setter 미호출 + false", () => {
    const { calls, setters } = createMockSetters();
    expect(applyCanonicalThemes({ version: "composition-1.0", children: [] }, setters)).toBe(false);
    expect(
      applyCanonicalThemes({ version: "composition-1.0", themes: { tint: 3 } as never, children: [] }, setters),
    ).toBe(false);
    expect(calls.setTint).toEqual([]);
  });

  it("TC-A4: round-trip — snapshot → doc → apply → 재 snapshot 동일", () => {
    const { setters, calls } = createMockSetters();
    const doc: CompositionDocument = {
      version: "composition-1.0",
      themes: snapshotThemesFromConfig({ ...config, neutral: "slate" }),
      children: [],
    };
    applyCanonicalThemes(doc, setters);
    const again = snapshotThemesFromConfig({
      tint: calls.setTint[0]!,
      darkMode: calls.setDarkMode[0]!,
      neutral: calls.setNeutral[0]!,
      radiusScale: calls.setRadiusScale[0]!,
    });
    expect(again).toEqual(doc.themes);
  });
});
