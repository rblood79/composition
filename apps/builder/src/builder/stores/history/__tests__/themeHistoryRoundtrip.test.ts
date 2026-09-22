// @vitest-environment jsdom
/**
 * ADR-227 Phase 1 — `theme` entry 의 undo/redo 왕복 + 문서 우선 쓰기 + localStorage 캐시 축소 (G1 builder 축).
 *
 * `page-guide` (ADR-181) 와 같은 비-element 축: 스토어 미러가 없어 canonical `themes` root 만 왕복하고,
 * 런타임 themeConfigStore 는 활성 테마에서 파생된다 (등록 콜백 `registerThemeHistoryApplier`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import {
  BASE_TYPOGRAPHY_TOKEN_KEYS,
  DEFAULT_THEME_ID,
  createThemesCollection,
  getActiveTheme,
  isThemesCollection,
  migrateThemesField,
} from "@composition/shared";

import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { historyManager } from "../../history";
import { useStore } from "../../index";
import { registerThemeHistoryApplier } from "../historyActions";
import {
  DEFAULT_THEME_SELECTION,
  markThemeDocumentOwned,
  readLegacyThemeConfig,
  resetThemeDocumentOwnershipForTest,
  useThemeConfigStore,
} from "../../../../stores/themeConfigStore";
import {
  addThemeFromActive,
  applyActiveThemeToRuntime,
  removeTheme,
  setActiveTheme,
  setActiveThemeBaseTypography,
  setActiveThemePreset,
} from "../../../panels/themes/themeActions";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../fonts/customFonts";

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => ({ documents: { put: vi.fn() } })),
}));

const PROJECT_ID = "theme-project";

function currentThemes() {
  const doc = useCanonicalDocumentStore.getState().getDocument(PROJECT_ID)!;
  return doc.themes!;
}

function seed(doc?: CompositionDocument): void {
  useCanonicalDocumentStore
    .getState()
    .setDocument(
      PROJECT_ID,
      doc ?? {
        version: "composition-1.0",
        themes: createThemesCollection(),
        children: [],
      },
    );
  useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
  useStore.setState({
    elements: [],
    elementsMap: new Map(),
    currentPageId: "page-1",
    pages: [{ id: "page-1", title: "page-1", project_id: PROJECT_ID }],
  } as never);
}

describe("ADR-227: theme entry undo/redo 왕복 · 문서 우선 쓰기", () => {
  beforeEach(() => {
    historyManager.clearAllHistory();
    historyManager.setCurrentPage("page-1");
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    resetThemeDocumentOwnershipForTest();
    localStorage.clear();
    useThemeConfigStore.setState({
      tint: DEFAULT_THEME_SELECTION.tint,
      darkMode: "light",
      neutral: DEFAULT_THEME_SELECTION.neutral,
      radiusScale: DEFAULT_THEME_SELECTION.radiusScale,
      baseTypography: DEFAULT_BASE_TYPOGRAPHY,
    });
    registerThemeHistoryApplier(applyActiveThemeToRuntime);
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => PROJECT_ID,
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [],
        layouts: [],
      }),
    });
  });

  afterEach(() => {
    registerThemeHistoryApplier(null);
    resetCanonicalMutationStoreActions();
    historyManager.clearAllHistory();
  });

  it("preset 편집 → 문서 themes + 런타임 tint · history entry 1 (type theme) → undo 복귀 → redo 재적용", async () => {
    seed();
    expect(setActiveThemePreset({ tint: "red" })).toBe(true);
    expect(getActiveTheme(currentThemes() && { themes: currentThemes() })!.preset.tint).toBe("red");
    expect(useThemeConfigStore.getState().tint).toBe("red");
    const entries = historyManager.getCurrentPageEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.type).toBe("theme");
    expect(entries[0]!.data.themeEvent?.kind).toBe("preset");
    // 같은 값 재적용은 no-op (entry 0 추가)
    expect(setActiveThemePreset({ tint: "red" })).toBe(false);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);

    await useStore.getState().undo();
    expect(getActiveTheme({ themes: currentThemes() })!.preset.tint).toBe("blue");
    expect(useThemeConfigStore.getState().tint).toBe("blue");

    await useStore.getState().redo();
    expect(getActiveTheme({ themes: currentThemes() })!.preset.tint).toBe("red");
    expect(useThemeConfigStore.getState().tint).toBe("red");
  });

  it("추가(복제) → 전환 → 삭제: 활성/순서 왕복 · 마지막 하나는 못 지운다 · 전환 entry 1건", async () => {
    seed();
    const id = addThemeFromActive("Brand")!;
    expect(id).toBe("theme-2");
    expect(currentThemes().order).toEqual([DEFAULT_THEME_ID, "theme-2"]);
    expect(setActiveTheme("theme-2")).toBe(true);
    expect(currentThemes().active).toBe("theme-2");
    expect(setActiveTheme("theme-2")).toBe(false); // 같은 테마 재선택 no-op
    expect(historyManager.getCurrentPageEntries().map((e) => e.data.themeEvent?.kind)).toEqual([
      "duplicate",
      "activate",
    ]);
    await useStore.getState().undo();
    expect(currentThemes().active).toBe(DEFAULT_THEME_ID);
    await useStore.getState().redo();
    expect(currentThemes().active).toBe("theme-2");
    expect(removeTheme("theme-2")).toBe(true);
    expect(currentThemes().order).toEqual([DEFAULT_THEME_ID]);
    expect(currentThemes().active).toBe(DEFAULT_THEME_ID);
    expect(removeTheme(DEFAULT_THEME_ID)).toBe(false);
  });

  it("G5 — 전환은 현재 페이지 history 만 +1 · 다른 페이지 +0 · canonical children[] 참조 무변화 · 같은 테마 재선택 no-op", () => {
    const children = [{ id: "n1", type: "Button", props: {} }] as unknown as CompositionDocument["children"];
    seed({ version: "composition-1.0", themes: createThemesCollection(), children });
    useStore.setState({
      pages: [
        { id: "page-1", title: "page-1", project_id: PROJECT_ID },
        { id: "page-2", title: "page-2", project_id: PROJECT_ID },
      ],
    } as never);
    historyManager.setCurrentPage("page-2");
    historyManager.setCurrentPage("page-1");
    addThemeFromActive("Brand");
    const before = historyManager.getAllPageEntryCounts();
    expect(setActiveTheme("theme-2")).toBe(true);
    expect(setActiveTheme("theme-2")).toBe(false);
    const after = historyManager.getAllPageEntryCounts();
    expect(after["page-1"]).toBe((before["page-1"] ?? 0) + 1);
    expect(after["page-2"] ?? 0).toBe(before["page-2"] ?? 0);
    expect(currentThemesDoc().children).toBe(children);
    expect(currentThemes().active).toBe("theme-2");
  });

  it("base typography — seed 와 같은 값은 델타를 지우고 다른 값만 남긴다 · 런타임 baseTypography 파생", () => {
    seed();
    expect(setActiveThemeBaseTypography({ fontSize: 18 })).toBe(true);
    const active = getActiveTheme({ themes: currentThemes() })!;
    expect(active.tokens).toEqual({
      [BASE_TYPOGRAPHY_TOKEN_KEYS.fontSize]: { type: "number", value: 18, source: "spec-token" },
    });
    expect(useThemeConfigStore.getState().baseTypography.fontSize).toBe(18);
    expect(setActiveThemeBaseTypography({ fontSize: DEFAULT_BASE_TYPOGRAPHY.fontSize })).toBe(true);
    expect(getActiveTheme({ themes: currentThemes() })!.tokens).toEqual({});
    expect(useThemeConfigStore.getState().baseTypography.fontSize).toBe(DEFAULT_BASE_TYPOGRAPHY.fontSize);
  });

  it("컬렉션 부재 (migration 전) 면 쓰기 진입점은 false · 문서/history 무변경", () => {
    seed({ version: "composition-1.0", children: [] });
    expect(setActiveThemePreset({ tint: "red" })).toBe(false);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(0);
  });

  it("G1 승계 — legacy localStorage → migrate → 저장 성공 표식 → 백업 .pre227 + 캐시 축소 → 이후 setter persist 는 캐시만 · 재실행 멱등", () => {
    const key = `composition-theme-config-${PROJECT_ID}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        tint: "purple",
        darkMode: "dark",
        neutral: "zinc",
        radiusScale: "lg",
        baseTypography: { ...DEFAULT_BASE_TYPOGRAPHY, fontSize: 20 },
      }),
    );
    useThemeConfigStore.getState().initThemeConfig(PROJECT_ID);
    const legacy = readLegacyThemeConfig(PROJECT_ID);
    expect(legacy?.tint).toBe("purple");
    const migrated = migrateThemesField(
      { version: "composition-1.0", children: [] },
      { legacyConfig: legacy, legacyWriteThrough: false, source: "local-project", baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    expect(migrated.report.path).toBe("legacy-config");
    seed(migrated.document);
    const themes = migrated.document.themes!;
    expect(isThemesCollection(themes)).toBe(true);
    markThemeDocumentOwned(PROJECT_ID, themes.active);
    applyActiveThemeToRuntime(themes);
    // 기존 실효 시각 Δ0 — store 가 legacy 와 같은 값
    const s = useThemeConfigStore.getState();
    expect([s.tint, s.darkMode, s.neutral, s.radiusScale, s.baseTypography.fontSize]).toEqual([
      "purple",
      "dark",
      "zinc",
      "lg",
      20,
    ]);
    // 백업 + 캐시 축소
    expect(JSON.parse(localStorage.getItem(`${key}.pre227`)!).tint).toBe("purple");
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ migrated: true, activeThemeId: DEFAULT_THEME_ID });
    expect(readLegacyThemeConfig(PROJECT_ID)).toBeNull();
    // 이후 setter 는 캐시만 쓴다 (legacy 모양으로 되돌아가지 않는다)
    setActiveThemePreset({ tint: "green" });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ migrated: true, activeThemeId: DEFAULT_THEME_ID });
    // 재실행 멱등 — 캐시 모양은 legacy 아님 → migrate changed=false
    const again = migrateThemesField(currentThemesDoc(), {
      legacyConfig: readLegacyThemeConfig(PROJECT_ID),
      legacyWriteThrough: false,
      source: "local-project",
      baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
    });
    expect(again.changed).toBe(false);
  });
});

function currentThemesDoc(): CompositionDocument {
  return useCanonicalDocumentStore.getState().getDocument(PROJECT_ID)!;
}
