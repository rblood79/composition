/**
 * ADR-227 — 문서 소유 토큰 세트 컬렉션 (pure).
 *
 * `ThemesCollection`의 구조 검사·보정과 항목 연산을 제공한다.
 * 쓰기·history·persist는 Builder catalog 명령이 담당한다.
 *
 * 저장 규칙 (ADR-143 델타): 테마의 `tokens` 는 preset seed 와 **다른 명시 값만**. 미편집 테마는
 * `tokens = {}`. root `document.tokens` 는 테마 무관 `user-defined` 만 남는다.
 */
import type {
  ThemeDefinition,
  ThemePreset,
  ThemesCollection,
  TokensSnapshot,
  TokensSnapshotEntry,
} from "../types/catalog-style.types";

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

export function getActiveTheme(document: {
  themes?: ThemesCollection;
}): ThemeDefinition | null {
  const themes = document.themes;
  if (!isThemesCollection(themes)) return null;
  return themes.items[themes.active] ?? themes.items[themes.order[0]!] ?? null;
}

// ───────────────────────────── 최초 migration (§3.2) ─────────────────────────────

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

/** 테마를 지정 순서에 추가한다. 중복 ID는 유지한다. */
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
