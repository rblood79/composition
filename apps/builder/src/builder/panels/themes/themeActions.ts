/**
 * ADR-227 — 테마 컬렉션 쓰기 진입점 (문서 우선).
 *
 * `pageGuideActions.commitPageGuideChanges` (ADR-181) 와 같은 층·같은 어법: 히스토리 entry 1개 +
 * canonical `themes` root 교체 + 런타임 재적용 + persist 를 한 묶음으로 낸다. 항목 연산 자체는
 * shared `themesCollection.ts` 의 순수 함수이고, 여기서는 "현재 컬렉션 → 순수 연산 → 무변경이면
 * 아무것도 안 함 → commit" 만 한다.
 *
 * 런타임 (themeConfigStore → specs 토큰 맵 · Preview THEME_VARS) 은 문서에서 **파생**한다 —
 * Phase 1 은 기존 setter 로 활성 preset + base typography 를 적용하고, Phase 2 가 이를
 * `installThemeSnapshot` 한 번으로 바꾼다.
 */

import type {
  CompositionDocument,
  ThemePreset,
  ThemesCollection,
  TokensSnapshot,
  TokensSnapshotEntry,
} from "@composition/shared";
import {
  BASE_TYPOGRAPHY_TOKEN_KEYS,
  addTheme as addThemePure,
  createThemeDefinition,
  duplicateTheme as duplicateThemePure,
  getActiveTheme,
  isThemesCollection,
  removeTheme as removeThemePure,
  renameTheme as renameThemePure,
  setActiveTheme as setActiveThemePure,
  setThemePreset as setThemePresetPure,
  setThemeToken as setThemeTokenPure,
} from "@composition/shared";

import { getDB } from "../../../lib/db";
import { readBaseTypographyFromTheme } from "../../../adapters/canonical/themesAdapter";
import { markThemeActiveCache } from "../../../stores/themeConfigStore";
import { installThemeSnapshot } from "../../../utils/theme/installThemeSnapshot";
import {
  resolveThemeSnapshot,
  type ResolvedThemeSnapshot,
} from "../../../utils/theme/resolveThemeSnapshot";
import {
  DEFAULT_BASE_TYPOGRAPHY,
  type BaseTypography,
} from "../../fonts/customFonts";
import { persistActiveCanonicalDocument } from "../../stores/canonical/persistActiveCanonicalDocument";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { historyManager, type ThemeHistoryEvent } from "../../stores/history";

// ───────────────────────────── 읽기 ─────────────────────────────

function activeDocument(): CompositionDocument | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;
  return canonical.documents.get(projectId) ?? null;
}

/** 현재 문서의 테마 컬렉션 — migration 전이면 null (쓰기 진입점은 그때 아무것도 안 한다). */
export function readThemesCollection(): ThemesCollection | null {
  const doc = activeDocument();
  const themes = doc?.themes as unknown;
  return isThemesCollection(themes) ? themes : null;
}

// ───────────────────────────── 런타임 재적용 ─────────────────────────────

/**
 * 활성 테마 → 런타임 (Phase 2): `resolveThemeSnapshot` (preset seed → root user-defined → 델타 →
 * 파생 · cssVars) → `installThemeSnapshot` 1회 (specs 토큰 맵 · store set 1 · notifyLayoutChange 1 ·
 * Preview THEME_VARS 1). undo/redo · 로드 · 쓰기 뒤 한 곳에서만 부른다.
 */
export function applyActiveThemeToRuntime(
  themes: ThemesCollection,
  rootTokens?: TokensSnapshot,
): ResolvedThemeSnapshot | null {
  const doc: Pick<CompositionDocument, "themes"> = { themes };
  const active = getActiveTheme(doc);
  if (!active) return null;
  markThemeActiveCache(active.id);
  const snapshot = resolveThemeSnapshot(active, {
    rootTokens: rootTokens ?? activeDocument()?.tokens,
    baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
  });
  if (snapshot.warnings.length > 0 && import.meta.env.DEV) {
    console.warn("[ADR-227] theme resolve warnings:", snapshot.warnings);
  }
  installThemeSnapshot(snapshot);
  return snapshot;
}

// ───────────────────────────── commit ─────────────────────────────

function commitThemes(
  before: ThemesCollection,
  after: ThemesCollection,
  kind: ThemeHistoryEvent["kind"],
  themeName: string,
): boolean {
  if (after === before) return false;
  historyManager.addEntry({
    type: "theme",
    // 소비자 미해석 무해값 (ADR-177 breakdown §5 C5 동형)
    elementId: after.active,
    data: { themeEvent: { kind, before, after, themeName } },
  });
  useCanonicalDocumentStore.getState().setThemes(after);
  applyActiveThemeToRuntime(after);
  queueMicrotask(() => {
    void persistActiveCanonicalDocument(getDB).catch((error) => {
      console.error("[themeActions] DB persist:", error);
    });
  });
  return true;
}

function newThemeId(collection: ThemesCollection): string {
  let n = collection.order.length + 1;
  let id = `theme-${n}`;
  while (id in collection.items) {
    n += 1;
    id = `theme-${n}`;
  }
  return id;
}

// ───────────────────────────── 진입점 ─────────────────────────────

/** 새 테마 = 활성 테마 복제 (Phase 4 UI "추가 = 복제"). */
export function addThemeFromActive(name?: string): string | null {
  const before = readThemesCollection();
  if (!before) return null;
  const source = before.items[before.active];
  if (!source) return null;
  const id = newThemeId(before);
  const themeName = name ?? `${source.name} copy`;
  const after = duplicateThemePure(before, source.id, id, themeName);
  return commitThemes(before, after, "duplicate", themeName) ? id : null;
}

export function addTheme(name: string, preset?: ThemePreset): string | null {
  const before = readThemesCollection();
  if (!before) return null;
  const id = newThemeId(before);
  const after = addThemePure(
    before,
    createThemeDefinition(
      id,
      name,
      preset ?? before.items[before.active]!.preset,
    ),
  );
  return commitThemes(before, after, "add", name) ? id : null;
}

export function removeTheme(id: string): boolean {
  const before = readThemesCollection();
  if (!before) return false;
  const name = before.items[id]?.name ?? id;
  return commitThemes(before, removeThemePure(before, id), "remove", name);
}

export function renameTheme(id: string, name: string): boolean {
  const before = readThemesCollection();
  if (!before) return false;
  return commitThemes(
    before,
    renameThemePure(before, id, name),
    "rename",
    name,
  );
}

export function setActiveTheme(id: string): boolean {
  const before = readThemesCollection();
  if (!before) return false;
  const name = before.items[id]?.name ?? id;
  return commitThemes(before, setActiveThemePure(before, id), "activate", name);
}

/** 활성 테마의 preset (tint · darkMode · neutral · radiusScale) 편집 — Themes 패널 Phase 1 배선. */
export function setActiveThemePreset(patch: Partial<ThemePreset>): boolean {
  const before = readThemesCollection();
  if (!before) return false;
  const name = before.items[before.active]?.name ?? before.active;
  return commitThemes(
    before,
    setThemePresetPure(before, before.active, patch),
    "preset",
    name,
  );
}

export function setThemeToken(
  id: string,
  key: string,
  entry: TokensSnapshotEntry | null,
): boolean {
  const before = readThemesCollection();
  if (!before) return false;
  const name = before.items[id]?.name ?? id;
  return commitThemes(
    before,
    setThemeTokenPure(before, id, key, entry),
    "token",
    name,
  );
}

/**
 * 활성 테마의 base typography — seed (`DEFAULT_BASE_TYPOGRAPHY`) 와 같은 값은 델타를 지우고,
 * 다른 값만 `typography.base-*` 키로 남긴다 (ADR-143 델타 규칙).
 */
export function setActiveThemeBaseTypography(
  patch: Partial<BaseTypography>,
): boolean {
  const before = readThemesCollection();
  if (!before) return false;
  const active = before.items[before.active];
  if (!active) return false;
  const current: BaseTypography = {
    ...DEFAULT_BASE_TYPOGRAPHY,
    ...readBaseTypographyFromTheme(active),
  };
  const next: BaseTypography = { ...current, ...patch };
  let after = before;
  const put = (
    key: string,
    value: string | number,
    seed: string | number,
    type: "string" | "number",
  ) => {
    after = setThemeTokenPure(
      after,
      before.active,
      key,
      value === seed ? null : { type, value, source: "spec-token" },
    );
  };
  put(
    BASE_TYPOGRAPHY_TOKEN_KEYS.fontFamily,
    next.fontFamily,
    DEFAULT_BASE_TYPOGRAPHY.fontFamily,
    "string",
  );
  put(
    BASE_TYPOGRAPHY_TOKEN_KEYS.fontSize,
    next.fontSize,
    DEFAULT_BASE_TYPOGRAPHY.fontSize,
    "number",
  );
  put(
    BASE_TYPOGRAPHY_TOKEN_KEYS.lineHeight,
    next.lineHeight,
    DEFAULT_BASE_TYPOGRAPHY.lineHeight,
    "number",
  );
  return commitThemes(before, after, "token", active.name);
}

// dev 전용 디버그 전역 — live 하니스가 문서 우선 쓰기 진입점을 그대로 부른다 (패널 UI 는 Phase 4).
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (window as unknown as Record<string, unknown>).__composition_THEME_ACTIONS__ =
    {
      readThemesCollection,
      addThemeFromActive,
      removeTheme,
      renameTheme,
      setActiveTheme,
      setActiveThemePreset,
      setThemeToken,
      setActiveThemeBaseTypography,
    };
}
