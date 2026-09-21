/**
 * ADR-227 Phase 4 — Themes 패널 토큰 재정의 편집기의 순수 표.
 *
 * 카테고리 → 편집 가능한 키 목록 (specs seed 맵의 키) · 값 타입 · 문자열 입력을 `TokensSnapshotEntry` 로
 * 바꾸는 검증. UI 는 이 표만 읽고, 쓰기는 `themeActions.setThemeToken` (문서 우선 · history 1) 로 낸다.
 * seed 와 같은 값을 넣으면 `null` (델타 삭제) — ADR-143 델타 규칙.
 */

import type { TokensSnapshotEntry } from "@composition/shared";
import {
  borderWidth as borderWidthSeed,
  lightColors,
  lightShadows,
  radius as radiusSeed,
  typography as typographySeed,
} from "@composition/specs";

export type ThemeTokenCategory =
  | "color"
  | "typography"
  | "radius"
  | "border"
  | "shadow"
  | "focus";

export const THEME_TOKEN_CATEGORIES: readonly ThemeTokenCategory[] = [
  "color",
  "typography",
  "radius",
  "border",
  "shadow",
  "focus",
];

/** focus 축은 DOM 전용 (ADR-150) — 키 4 개 고정. */
const FOCUS_KEYS: readonly string[] = [
  "ring-color",
  "ring-width",
  "ring-offset",
  "ring-inset-offset",
];

/** 파생 hover/pressed 키는 base 에서 파생되므로 목록에서 뺀다 (명시 재정의는 키 직접 입력 없이 불가 — 의도). */
function isDerivedColorKey(key: string): boolean {
  return /-(hover|pressed)$/.test(key);
}

/** 카테고리별 편집 가능한 키 (seed 맵 키 순서). `border` 는 `width.<k>` 형태. */
export function themeTokenKeys(category: ThemeTokenCategory): readonly string[] {
  switch (category) {
    case "color":
      return Object.keys(lightColors).filter((k) => !isDerivedColorKey(k));
    case "typography":
      return Object.keys(typographySeed);
    case "radius":
      return Object.keys(radiusSeed).filter((k) => k !== "full");
    case "border":
      return Object.keys(borderWidthSeed).map((k) => `width.${k}`);
    case "shadow":
      return Object.keys(lightShadows);
    case "focus":
      return FOCUS_KEYS;
  }
}

/** 문서 토큰 키 `<category>.<key>` ↔ 분리. */
export function splitThemeTokenKey(
  tokenKey: string,
): { category: ThemeTokenCategory; key: string } | null {
  const dot = tokenKey.indexOf(".");
  if (dot <= 0) return null;
  const category = tokenKey.slice(0, dot) as ThemeTokenCategory;
  if (!THEME_TOKEN_CATEGORIES.includes(category)) return null;
  return { category, key: tokenKey.slice(dot + 1) };
}

export function joinThemeTokenKey(
  category: ThemeTokenCategory,
  key: string,
): string {
  return `${category}.${key}`;
}

/** 값의 타입 — seed 가 정한다 (typography 의 font-family 류는 string, 나머지 number). */
export function themeTokenValueType(
  category: ThemeTokenCategory,
  key: string,
): TokensSnapshotEntry["type"] {
  switch (category) {
    case "color":
      return "color";
    case "shadow":
      return "string";
    case "focus":
      return key === "ring-color" ? "color" : "number";
    case "typography": {
      const seed = (typographySeed as unknown as Record<string, unknown>)[key];
      return typeof seed === "string" ? "string" : "number";
    }
    case "radius":
    case "border":
      return "number";
  }
}

/** seed 값 (표시 · 같은 값이면 델타 삭제). focus 는 seed 를 여기서 모른다 → undefined. */
export function themeTokenSeedValue(
  category: ThemeTokenCategory,
  key: string,
): string | number | undefined {
  switch (category) {
    case "color":
      return (lightColors as unknown as Record<string, string>)[key];
    case "typography":
      return (typographySeed as unknown as Record<string, string | number>)[key];
    case "radius":
      return (radiusSeed as unknown as Record<string, number>)[key];
    case "border":
      return (borderWidthSeed as unknown as Record<string, number>)[
        key.startsWith("width.") ? key.slice(6) : key
      ];
    case "shadow":
      return (lightShadows as unknown as Record<string, string>)[key];
    case "focus":
      return undefined;
  }
}

const HEX6 = /^#[0-9a-f]{6}$/i;

/**
 * 입력 문자열 → entry. 무효면 `{ error }`. seed 와 같으면 `{ entry: null }` (델타 삭제).
 * 숫자는 유한 · 0 이상 (radius/border/focus 폭) — 음수는 무효.
 */
export function parseThemeTokenInput(
  category: ThemeTokenCategory,
  key: string,
  raw: string,
): { entry: TokensSnapshotEntry | null } | { error: "invalid" } {
  const type = themeTokenValueType(category, key);
  const text = raw.trim();
  if (text === "") return { error: "invalid" };
  const seed = themeTokenSeedValue(category, key);
  if (type === "color") {
    const hex = text.toLowerCase();
    if (!HEX6.test(hex)) return { error: "invalid" };
    if (typeof seed === "string" && seed.toLowerCase() === hex)
      return { entry: null };
    return { entry: { type: "color", value: hex, source: "spec-token" } };
  }
  if (type === "number") {
    const n = Number(text.replace(/px$/i, ""));
    if (!Number.isFinite(n) || n < 0) return { error: "invalid" };
    if (seed === n) return { entry: null };
    return { entry: { type: "number", value: n, source: "spec-token" } };
  }
  if (seed === text) return { entry: null };
  return { entry: { type: "string", value: text, source: "spec-token" } };
}

/** 표시용 값 문자열. */
export function formatThemeTokenValue(entry: TokensSnapshotEntry): string {
  return String(entry.value);
}
