/**
 * ADR-227 — 문서 소유 토큰 세트 컬렉션 (pure).
 *
 * `CompositionDocument.themes` 의 모양 (`ThemesCollection`) 과 그 위의 순수 연산만 둔다 —
 * 기본 컬렉션 · 구조 검사/보정 · 최초 migration (ADR-110 단일 `ThemeSnapshot` + legacy
 * localStorage 실효값 → 컬렉션) · 항목 연산 (추가/삭제/이름/활성/preset/토큰). store · history ·
 * persist 는 builder 가 (`canonicalDocumentStore` themes action + `themeActions.ts`).
 *
 * 저장 규칙 (ADR-143 델타): 테마의 `tokens` 는 preset seed 와 **다른 명시 값만**. 미편집 테마는
 * `tokens = {}`. root `document.tokens` 는 테마 무관 `user-defined` 만 남는다.
 */
import type {
  CompositionDocument,
  ThemeDefinition,
  ThemePreset,
  ThemesCollection,
  TokensSnapshot,
  TokensSnapshotEntry,
} from "../types/composition-document.types";

export const DEFAULT_THEME_ID = "theme-default";
export const DEFAULT_THEME_NAME = "Default";

/** store 기본 선택값과 같다 (`themeConfigStore.DEFAULT_THEME_SELECTION` + darkMode light). */
export const DEFAULT_THEME_PRESET: ThemePreset = {
  tint: "blue",
  darkMode: "light",
  neutral: "neutral",
  radiusScale: "md",
};

/**
 * legacy `baseTypography` (문서 body 기본 서체) 가 테마 델타로 갈 때 쓰는 토큰 키 — §3.2.
 * 값 모양: family = string · size = px number · lineHeight = unitless number.
 */
export const BASE_TYPOGRAPHY_TOKEN_KEYS = {
  fontFamily: "typography.base-font-family",
  fontSize: "typography.base-font-size",
  lineHeight: "typography.base-line-height",
} as const;

export interface BaseTypographyValue {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

// ───────────────────────────── 구조 검사 ─────────────────────────────

const PRESET_KEYS: readonly (keyof ThemePreset)[] = [
  "tint",
  "darkMode",
  "neutral",
  "radiusScale",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isThemePreset(value: unknown): value is ThemePreset {
  if (!isRecord(value)) return false;
  return PRESET_KEYS.every(
    (key) =>
      typeof value[key] === "string" && (value[key] as string).length > 0,
  );
}

function isTokensSnapshotEntry(value: unknown): value is TokensSnapshotEntry {
  if (!isRecord(value)) return false;
  const type = value.type;
  const source = value.source;
  return (
    (type === "color" ||
      type === "number" ||
      type === "string" ||
      type === "boolean") &&
    (source === "spec-token" || source === "user-defined") &&
    (typeof value.value === "string" ||
      typeof value.value === "number" ||
      typeof value.value === "boolean")
  );
}

export function isThemeDefinition(value: unknown): value is ThemeDefinition {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.length === 0) return false;
  if (typeof value.name !== "string") return false;
  if (!isThemePreset(value.preset)) return false;
  if (!isRecord(value.tokens)) return false;
  return Object.values(value.tokens).every(isTokensSnapshotEntry);
}

/** `ThemesCollection` 모양인가 — 무결성 (active ∈ items · order 순열) 은 `normalizeThemesCollection` 이 보정. */
export function isThemesCollection(value: unknown): value is ThemesCollection {
  if (!isRecord(value)) return false;
  if (typeof value.active !== "string") return false;
  if (!isRecord(value.items) || !Array.isArray(value.order)) return false;
  const items = Object.values(value.items);
  if (items.length === 0) return false;
  return items.every(isThemeDefinition);
}

/** ADR-110 단일 snapshot 모양 (구 문서 · import) 인가. */
export function readLegacyThemeSnapshot(value: unknown): ThemePreset | null {
  if (!isThemePreset(value)) return null;
  return {
    tint: value.tint,
    darkMode: value.darkMode,
    neutral: value.neutral,
    radiusScale: value.radiusScale,
  };
}

export interface ThemesCollectionIssue {
  code:
    | "active-missing"
    | "order-missing-id"
    | "order-unknown-id"
    | "order-duplicate"
    | "item-id-mismatch";
  id?: string;
}

/**
 * 무결성 보정 — active 가 items 에 없으면 order[0], order 는 items 키의 순열로 (부재 id 는 뒤에
 * 붙이고 미지/중복은 뺀다), 항목의 `id` 는 키와 같게. 변경 0 이면 같은 객체.
 */
export function normalizeThemesCollection(collection: ThemesCollection): {
  collection: ThemesCollection;
  issues: ThemesCollectionIssue[];
} {
  const issues: ThemesCollectionIssue[] = [];
  const keys = Object.keys(collection.items);
  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of collection.order) {
    if (!(id in collection.items)) {
      issues.push({ code: "order-unknown-id", id });
      continue;
    }
    if (seen.has(id)) {
      issues.push({ code: "order-duplicate", id });
      continue;
    }
    seen.add(id);
    order.push(id);
  }
  for (const id of keys) {
    if (!seen.has(id)) {
      issues.push({ code: "order-missing-id", id });
      order.push(id);
    }
  }
  let items = collection.items;
  for (const id of keys) {
    const item = items[id]!;
    if (item.id !== id) {
      issues.push({ code: "item-id-mismatch", id });
      if (items === collection.items) items = { ...items };
      items[id] = { ...item, id };
    }
  }
  let active = collection.active;
  if (!(active in items)) {
    issues.push({ code: "active-missing", id: active });
    active = order[0]!;
  }
  if (issues.length === 0) return { collection, issues };
  return { collection: { active, items, order }, issues };
}

// ───────────────────────────── 생성 ─────────────────────────────

export function createThemeDefinition(
  id: string,
  name: string,
  preset: ThemePreset = DEFAULT_THEME_PRESET,
  tokens: TokensSnapshot = {},
): ThemeDefinition {
  return { id, name, preset: { ...preset }, tokens: { ...tokens } };
}

export function createThemesCollection(
  preset: ThemePreset = DEFAULT_THEME_PRESET,
  tokens: TokensSnapshot = {},
): ThemesCollection {
  const item = createThemeDefinition(
    DEFAULT_THEME_ID,
    DEFAULT_THEME_NAME,
    preset,
    tokens,
  );
  return { active: item.id, items: { [item.id]: item }, order: [item.id] };
}

export function getActiveTheme(
  document: Pick<CompositionDocument, "themes">,
): ThemeDefinition | null {
  const themes = document.themes;
  if (!isThemesCollection(themes)) return null;
  return themes.items[themes.active] ?? themes.items[themes.order[0]!] ?? null;
}

// ───────────────────────────── 최초 migration (§3.2) ─────────────────────────────

/** builder 가 읽어 넘기는 legacy localStorage 실효값 (`composition-theme-config-<projectId>`). */
export interface LegacyThemeConfigInput {
  tint?: string;
  darkMode?: string;
  neutral?: string;
  radiusScale?: string;
  baseTypography?: Partial<BaseTypographyValue>;
}

export interface MigrateThemesOptions {
  /** 같은 projectId 의 legacy 설정 — import 문서에는 넘기지 않는다. */
  legacyConfig: LegacyThemeConfigInput | null;
  /** 제거 전 부팅 정책 (`VITE_ADR110_P2_THEMES_WRITE_THROUGH`) — 실전은 항상 false (Phase 0 F5). */
  legacyWriteThrough: boolean;
  source: "local-project" | "import";
  /** legacy `baseTypography` 의 seed (builder `DEFAULT_BASE_TYPOGRAPHY`) — 같으면 델타 0. */
  baseTypographySeed: BaseTypographyValue;
}

export type MigrateThemesPath =
  | "collection" // 이미 컬렉션 — 무결성 보정만
  | "legacy-doc" // 구 document.themes (write-through on 또는 import) 우선
  | "legacy-config" // localStorage 실효값
  | "default";

export interface MigrateThemesReport {
  path: MigrateThemesPath;
  warnings: string[];
  /** 컬렉션 무결성 보정 (path=collection) */
  issues: ThemesCollectionIssue[];
}

export interface MigrateThemesResult {
  document: CompositionDocument;
  changed: boolean;
  report: MigrateThemesReport;
}

function readLegacyPreset(
  legacy: LegacyThemeConfigInput | null,
  warnings: string[],
): Partial<ThemePreset> {
  if (!legacy) return {};
  const out: Partial<ThemePreset> = {};
  for (const key of PRESET_KEYS) {
    const value = legacy[key];
    if (value === undefined) continue;
    if (typeof value === "string" && value.length > 0) out[key] = value;
    else warnings.push(`legacy ${key} 무효 (${String(value)}) — 기본값`);
  }
  return out;
}

/** legacy baseTypography → seed 와 다른 키만 델타 (spec-token). */
export function baseTypographyToTokensDelta(
  typography: Partial<BaseTypographyValue> | undefined,
  seed: BaseTypographyValue,
): TokensSnapshot {
  const delta: TokensSnapshot = {};
  if (!typography) return delta;
  if (
    typeof typography.fontFamily === "string" &&
    typography.fontFamily !== seed.fontFamily
  ) {
    delta[BASE_TYPOGRAPHY_TOKEN_KEYS.fontFamily] = {
      type: "string",
      value: typography.fontFamily,
      source: "spec-token",
    };
  }
  if (
    typeof typography.fontSize === "number" &&
    Number.isFinite(typography.fontSize) &&
    typography.fontSize !== seed.fontSize
  ) {
    delta[BASE_TYPOGRAPHY_TOKEN_KEYS.fontSize] = {
      type: "number",
      value: typography.fontSize,
      source: "spec-token",
    };
  }
  if (
    typeof typography.lineHeight === "number" &&
    Number.isFinite(typography.lineHeight) &&
    typography.lineHeight !== seed.lineHeight
  ) {
    delta[BASE_TYPOGRAPHY_TOKEN_KEYS.lineHeight] = {
      type: "number",
      value: typography.lineHeight,
      source: "spec-token",
    };
  }
  return delta;
}

/** 구 `customTokens: Record<string,string>` → 델타 (알려진 카테고리만, 나머지는 경고). */
function customTokensToDelta(
  customTokens: unknown,
  warnings: string[],
): TokensSnapshot {
  const delta: TokensSnapshot = {};
  if (!isRecord(customTokens)) return delta;
  for (const [key, value] of Object.entries(customTokens)) {
    if (typeof value !== "string") {
      warnings.push(`customTokens.${key} 무효 (문자열 아님) — 버림`);
      continue;
    }
    const category = key.split(".")[0];
    if (category === "color") {
      delta[key] = { type: "color", value, source: "spec-token" };
    } else if (
      category === "typography" ||
      category === "radius" ||
      category === "shadow" ||
      category === "focus" ||
      category === "border"
    ) {
      const asNumber = Number(value);
      delta[key] =
        value.trim() !== "" && Number.isFinite(asNumber)
          ? { type: "number", value: asNumber, source: "spec-token" }
          : { type: "string", value, source: "spec-token" };
    } else {
      warnings.push(`customTokens.${key} 미지원 카테고리 — 보존 안 함`);
    }
  }
  return delta;
}

/**
 * 최초 migration — 순수. 행렬 (breakdown §3.2):
 *   1. 유효한 컬렉션 → 무결성 보정만 (legacy · flag 무시)
 *   2. 구 문서 + off → legacy 필드 → 기본값 (구 document.themes 는 현행에서 적용되지 않았으므로 stale)
 *   3. 구 문서 + on + 유효 snapshot → 구 document.themes 우선 · baseTypography 는 legacy
 *   4. 구 문서 + on + 부재/무효 → legacy → 기본값
 *   5. import (legacy 없음) → 유효 구 snapshot → 기본값
 * 기존 `document.tokens` 의 spec-token 은 Default 테마 델타로, user-defined 는 root 에 남는다.
 */
export function migrateThemesField(
  document: CompositionDocument,
  options: MigrateThemesOptions,
): MigrateThemesResult {
  const warnings: string[] = [];
  const rawThemes = document.themes as unknown;

  if (isThemesCollection(rawThemes)) {
    const { collection, issues } = normalizeThemesCollection(rawThemes);
    if (collection === rawThemes) {
      return {
        document,
        changed: false,
        report: { path: "collection", warnings, issues },
      };
    }
    return {
      document: { ...document, themes: collection },
      changed: true,
      report: { path: "collection", warnings, issues },
    };
  }

  const legacy = options.source === "import" ? null : options.legacyConfig;
  const legacySnapshot = readLegacyThemeSnapshot(rawThemes);
  if (rawThemes !== undefined && !legacySnapshot) {
    warnings.push("구 document.themes 가 ThemeSnapshot 모양이 아님 — 무시");
  }
  const legacyPreset = readLegacyPreset(legacy, warnings);

  let preset: ThemePreset;
  let path: MigrateThemesPath;
  if (options.source === "import") {
    preset = legacySnapshot ?? DEFAULT_THEME_PRESET;
    path = legacySnapshot ? "legacy-doc" : "default";
  } else if (options.legacyWriteThrough && legacySnapshot) {
    preset = legacySnapshot;
    path = "legacy-doc";
  } else {
    const hasLegacy = Object.keys(legacyPreset).length > 0;
    preset = { ...DEFAULT_THEME_PRESET, ...legacyPreset };
    path = hasLegacy ? "legacy-config" : "default";
  }

  // 델타: legacy baseTypography (seed 와 다른 키) + 구 customTokens + 기존 root spec-token
  const tokens: TokensSnapshot = {
    ...baseTypographyToTokensDelta(
      legacy?.baseTypography,
      options.baseTypographySeed,
    ),
  };
  if (legacySnapshot && isRecord(rawThemes)) {
    Object.assign(
      tokens,
      customTokensToDelta(rawThemes.customTokens, warnings),
    );
  }
  const rootTokens = document.tokens ?? {};
  const userDefined: TokensSnapshot = {};
  for (const [key, entry] of Object.entries(rootTokens)) {
    if (!isTokensSnapshotEntry(entry)) {
      warnings.push(`tokens.${key} 무효 entry — 버림`);
      continue;
    }
    if (entry.source === "user-defined") userDefined[key] = entry;
    else if (!(key in tokens)) tokens[key] = entry; // 같은 키의 구 명시 델타는 보존 (legacy 가 먼저)
  }

  const collection = createThemesCollection(preset, tokens);
  const next: CompositionDocument = { ...document, themes: collection };
  if (Object.keys(userDefined).length > 0) next.tokens = userDefined;
  else delete next.tokens;
  return {
    document: next,
    changed: true,
    report: { path, warnings, issues: [] },
  };
}

// ───────────────────────────── 항목 연산 (pure) ─────────────────────────────

export function addTheme(
  collection: ThemesCollection,
  definition: ThemeDefinition,
  index?: number,
): ThemesCollection {
  if (definition.id in collection.items) return collection;
  const order = [...collection.order];
  order.splice(
    index === undefined
      ? order.length
      : Math.max(0, Math.min(index, order.length)),
    0,
    definition.id,
  );
  return {
    ...collection,
    items: { ...collection.items, [definition.id]: definition },
    order,
  };
}

/** 마지막 테마는 지우지 않는다 (Phase 4 UI 계약) — 활성을 지우면 순서상 이웃이 활성. */
export function removeTheme(
  collection: ThemesCollection,
  id: string,
): ThemesCollection {
  if (!(id in collection.items) || collection.order.length <= 1) {
    return collection;
  }
  const items = { ...collection.items };
  delete items[id];
  const order = collection.order.filter((x) => x !== id);
  let active = collection.active;
  if (active === id) {
    const i = collection.order.indexOf(id);
    active = order[Math.min(i, order.length - 1)]!;
  }
  return { active, items, order };
}

export function renameTheme(
  collection: ThemesCollection,
  id: string,
  name: string,
): ThemesCollection {
  const item = collection.items[id];
  if (!item || item.name === name) return collection;
  return {
    ...collection,
    items: { ...collection.items, [id]: { ...item, name } },
  };
}

export function setActiveTheme(
  collection: ThemesCollection,
  id: string,
): ThemesCollection {
  if (!(id in collection.items) || collection.active === id) return collection;
  return { ...collection, active: id };
}

export function setThemePreset(
  collection: ThemesCollection,
  id: string,
  patch: Partial<ThemePreset>,
): ThemesCollection {
  const item = collection.items[id];
  if (!item) return collection;
  const preset = { ...item.preset };
  let changed = false;
  for (const key of PRESET_KEYS) {
    const value = patch[key];
    if (typeof value === "string" && value !== preset[key]) {
      preset[key] = value;
      changed = true;
    }
  }
  if (!changed) return collection;
  return {
    ...collection,
    items: { ...collection.items, [id]: { ...item, preset } },
  };
}

/** `entry === null` 이면 델타 제거 (seed 로 복귀). */
export function setThemeToken(
  collection: ThemesCollection,
  id: string,
  key: string,
  entry: TokensSnapshotEntry | null,
): ThemesCollection {
  const item = collection.items[id];
  if (!item) return collection;
  const current = item.tokens[key];
  if (entry === null) {
    if (current === undefined) return collection;
    const tokens = { ...item.tokens };
    delete tokens[key];
    return {
      ...collection,
      items: { ...collection.items, [id]: { ...item, tokens } },
    };
  }
  if (
    current &&
    current.type === entry.type &&
    current.value === entry.value &&
    current.source === entry.source
  ) {
    return collection;
  }
  return {
    ...collection,
    items: {
      ...collection.items,
      [id]: { ...item, tokens: { ...item.tokens, [key]: entry } },
    },
  };
}

/** 복제 — 이름 · id 새로, preset/tokens 그대로. */
export function duplicateTheme(
  collection: ThemesCollection,
  sourceId: string,
  newId: string,
  name: string,
): ThemesCollection {
  const source = collection.items[sourceId];
  if (!source || newId in collection.items) return collection;
  const index = collection.order.indexOf(sourceId) + 1;
  return addTheme(
    collection,
    createThemeDefinition(newId, name, source.preset, source.tokens),
    index,
  );
}
