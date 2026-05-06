/**
 * @fileoverview ADR-110 Phase 1+2 — Themes Snapshot/Apply Adapter
 *
 * ADR-021 themeConfigStore ↔ canonical document `themes` 필드 양방향 변환.
 *
 * - **Phase 1 (read-only)**: `snapshotThemesFromConfig()` + `readCanonicalThemes()`
 *   — themeConfigStore 가 여전히 런타임 SSOT, document 직렬화만 수행
 * - **Phase 2 ts-3.1 (write-through)**: `applyCanonicalThemes()` — document
 *   로드 시 `themes.tint`/`darkMode`/`neutral`/`radiusScale` → themeConfigStore
 *   적용. opt-in 진입 (BuilderCore 등 caller 가 env flag 로 게이트)
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

import type { CompositionDocument, ThemeSnapshot } from "@composition/shared";

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
 * themeConfigStore 현재 상태 → `ThemeSnapshot` 직렬화.
 *
 * call-time 직렬화 (subscribe 기반 아님) — stale snapshot 방지 (ADR-110 R4).
 * `legacyToCanonical()` 호출 시 전달된 `getThemeConfig()` 콜백에서 호출됨.
 *
 * @param themeConfig - themeConfigStore 현재 상태 (ThemeConfigInput 최소 계약)
 * @returns ThemeSnapshot — canonical document themes 필드에 주입할 snapshot
 */
export function snapshotThemesFromConfig(
  themeConfig: ThemeConfigInput,
): ThemeSnapshot {
  return {
    tint: themeConfig.tint,
    darkMode: themeConfig.darkMode,
    neutral: themeConfig.neutral,
    radiusScale: themeConfig.radiusScale,
  };
}

/**
 * canonical document 에서 `themes` 필드를 `ThemeSnapshot` 으로 읽기.
 *
 * Phase 2 write-through 이전: read-only accessor.
 * `themes` 필드가 없거나 ThemeSnapshot 구조가 아니면 `undefined` 반환.
 *
 * @param doc - canonical CompositionDocument
 * @returns ThemeSnapshot 또는 undefined (themes 필드 없음)
 */
export function readCanonicalThemes(
  doc: CompositionDocument,
): ThemeSnapshot | undefined {
  if (!doc.themes) return undefined;

  // ADR-110 Phase 1: CompositionDocument.themes 타입이 ThemeSnapshot 으로 전환됨
  // 필드 존재 여부만 확인 (타입 캐스팅 불필요)
  const t = doc.themes;
  if (
    typeof t.tint === "string" &&
    typeof t.darkMode === "string" &&
    typeof t.neutral === "string" &&
    typeof t.radiusScale === "string"
  ) {
    return t;
  }

  return undefined;
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
}

/**
 * canonical document `themes` → `themeConfigStore` 적용 (Phase 2 ts-3.1).
 *
 * **호출 시점**: document 로드 entry (예: `initializeProject` 종료 직후) — caller
 * 가 env flag 로 게이트해서 호출. opt-in 진입 — flag 미설정 시 호출하지 않음.
 *
 * **idempotent**: 같은 doc 으로 반복 호출 시 stable (round-trip 보장).
 * **hierarchy**: themeConfigStore 의 4 setter 를 순서대로 호출 — 각 setter 는
 * `themeVersion` 증가 + `notifyLayoutChange()` 트리거 (4회 발생 → ElementSprite
 * 재렌더는 batched). batch 적용은 Phase 2 ts-3.5 monitoring 단계에서 검토.
 *
 * @param doc - canonical CompositionDocument
 * @param setters - themeConfigStore setter 인터페이스 (DI)
 * @returns 적용 여부 (`true` = themes 필드 발견 + 적용 / `false` = themes 미존재)
 */
export function applyCanonicalThemes(
  doc: CompositionDocument,
  setters: ThemeConfigSetters,
): boolean {
  const snapshot = readCanonicalThemes(doc);
  if (!snapshot) return false;

  setters.setTint(snapshot.tint);
  setters.setDarkMode(snapshot.darkMode);
  setters.setNeutral(snapshot.neutral);
  setters.setRadiusScale(snapshot.radiusScale);

  return true;
}
