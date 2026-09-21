/**
 * @fileoverview ADR-110 Phase 1+2 — Themes Snapshot/Apply Adapter
 *
 * ADR-021 themeConfigStore ↔ canonical document `themes` 필드 양방향 변환.
 *
 * - **Phase 1 (read-only)**: `snapshotThemesFromConfig()` + `readCanonicalThemes()`
 *   — themeConfigStore 가 여전히 런타임 SSOT, document 직렬화만 수행
 * - **Phase 2 ts-3.1 (write-through)**: `applyCanonicalThemes()` — document
 *   로드 시 활성 테마 preset → themeConfigStore 적용.
 * - **ADR-227**: `themes` 는 `ThemesCollection` (활성 하나 + 항목) — 이 adapter 는 활성 항목만
 *   다룬다. 구 단일 `ThemeSnapshot` 은 hydration 의 `migrateThemesField` 가 옮기고, 읽기는 둘 다
 *   허용한다 (migration 전 문서 · import). env flag 게이트는 제거됐다 (항상 문서 우선).
 *
 * **Read-only 원칙 (Phase 1)**:
 * - `snapshotThemesFromConfig()` 는 call-time 직렬화 — subscribe 기반 아님
 *   (ADR-110 R4 대응: stale snapshot 방지)
 *
 * **Write-through 계약 (Phase 2)**:
 * - `applyCanonicalThemes()` 는 DI 패턴 — `ThemeConfigSetters` 주입 받아 호출
 * - themeConfigStore 직접 의존 없음 (테스트 친화 + R4 stale 방지)
 * - round-trip 보장: load → apply → re-snapshot 결과 동일
 *
 * **ThemeSnapshot 설계 (ADR-110 R2)**:
 * - `@composition/shared` 의 `ThemeSnapshot` 타입을 단일 소스로 사용
 * - per-element theme override 는 후속 ADR 에서 결정
 */

import type {
  CompositionDocument,
  ThemeDefinition,
  ThemePreset,
  ThemeSnapshot,
  ThemesCollection,
} from "@composition/shared";
import {
  BASE_TYPOGRAPHY_TOKEN_KEYS,
  createThemesCollection,
  getActiveTheme,
  isThemesCollection,
  readLegacyThemeSnapshot,
} from "@composition/shared";

// ThemeSnapshot 은 packages/shared 에서 정의됨 — re-export 로 기존 import 경로 유지
export type { ThemeSnapshot } from "@composition/shared";

// ─────────────────────────────────────────────
// ThemeConfig 최소 타입 (adapter DI 계약)
// ─────────────────────────────────────────────

/**
 * adapter 가 필요로 하는 themeConfigStore 최소 인터페이스.
 *
 * 실제 `ThemeConfigState` (themeConfigStore.ts) 는 이 인터페이스의 슈퍼셋.
 * 어댑터는 actions/themeVersion 등 런타임 전용 필드를 참조하지 않는다.
 */
export interface ThemeConfigInput {
  tint: string;
  darkMode: string;
  neutral: string;
  radiusScale: string;
}

// ─────────────────────────────────────────────
// Core adapter functions
// ─────────────────────────────────────────────

/**
 * themeConfigStore 현재 상태 → `ThemesCollection` 직렬화 (ADR-227: Default 테마 하나 · 델타 {}).
 *
 * call-time 직렬화 (subscribe 기반 아님) — stale snapshot 방지 (ADR-110 R4).
 * `legacyToCanonical()` 호출 시 전달된 `getThemeConfig()` 콜백에서 호출됨.
 */
export function snapshotThemesFromConfig(
  themeConfig: ThemeConfigInput,
): ThemesCollection {
  return createThemesCollection({
    tint: themeConfig.tint,
    darkMode: themeConfig.darkMode,
    neutral: themeConfig.neutral,
    radiusScale: themeConfig.radiusScale,
  });
}

/**
 * canonical document 의 **활성 테마 preset** 을 읽는다 — 컬렉션 (ADR-227) 이면 active 항목, 구 단일
 * `ThemeSnapshot` 모양 (migration 전 문서) 이면 그 4 필드. 둘 다 아니면 `undefined`.
 */
export function readCanonicalThemes(
  doc: CompositionDocument,
): ThemePreset | undefined {
  const raw = doc.themes as unknown;
  if (!raw) return undefined;
  if (isThemesCollection(raw)) {
    return getActiveTheme({ themes: raw })?.preset;
  }
  return readLegacyThemeSnapshot(raw) ?? undefined;
}

/** 활성 테마 항목 (컬렉션일 때만). */
export function readActiveThemeDefinition(
  doc: CompositionDocument,
): ThemeDefinition | null {
  return getActiveTheme(doc);
}

// ─────────────────────────────────────────────
// Phase 2 ts-3.1 — Write-through (apply)
// ─────────────────────────────────────────────

/**
 * adapter 가 호출하는 themeConfigStore setter 최소 인터페이스 (Phase 2 DI 계약).
 *
 * 실제 `ThemeConfigState.setTint` 등의 시그니처와 호환 (구체 store 타입 의존 제거).
 * 테스트 친화 + R4 stale 방지를 위해 store 직접 import 하지 않음.
 */
export interface ThemeConfigSetters {
  setTint: (tint: string) => void;
  setDarkMode: (mode: string) => void;
  setNeutral: (neutral: string) => void;
  setRadiusScale: (scale: string) => void;
  /** ADR-227 — 테마 델타의 `typography.base-*` 3 키 → body 기본 서체 (부재 키는 seed). */
  setBaseTypography?: (typography: {
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
  }) => void;
}

/** 테마 델타에서 base typography 3 키를 읽는다 (부재 = seed 유지 → undefined). */
export function readBaseTypographyFromTheme(theme: ThemeDefinition): {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
} {
  const family = theme.tokens[BASE_TYPOGRAPHY_TOKEN_KEYS.fontFamily]?.value;
  const size = theme.tokens[BASE_TYPOGRAPHY_TOKEN_KEYS.fontSize]?.value;
  const lineHeight =
    theme.tokens[BASE_TYPOGRAPHY_TOKEN_KEYS.lineHeight]?.value;
  return {
    ...(typeof family === "string" ? { fontFamily: family } : {}),
    ...(typeof size === "number" ? { fontSize: size } : {}),
    ...(typeof lineHeight === "number" ? { lineHeight } : {}),
  };
}

/**
 * canonical document 활성 테마 → `themeConfigStore` 적용.
 *
 * **idempotent**: 같은 doc 으로 반복 호출 시 stable (round-trip 보장).
 * setter 4 (+ baseTypography) 를 순서대로 호출 — 각 setter 는 `themeVersion` 증가 +
 * `notifyLayoutChange()` (Phase 2 `installThemeSnapshot` 이 한 번으로 줄인다).
 *
 * @returns 적용 여부 (`true` = 활성 preset 발견 + 적용 / `false` = themes 미존재)
 */
export function applyCanonicalThemes(
  doc: CompositionDocument,
  setters: ThemeConfigSetters,
): boolean {
  const preset = readCanonicalThemes(doc);
  if (!preset) return false;

  setters.setTint(preset.tint);
  setters.setDarkMode(preset.darkMode);
  setters.setNeutral(preset.neutral);
  setters.setRadiusScale(preset.radiusScale);
  const active = getActiveTheme(doc);
  if (active && setters.setBaseTypography) {
    setters.setBaseTypography(readBaseTypographyFromTheme(active));
  }

  return true;
}
