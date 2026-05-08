/**
 * @fileoverview ADR-116 Phase 3 G4 — 3-A-impl: shadow write evaluator.
 *
 * legacy snapshot 두 시점의 diff 평가 + console warn 의 utility 계층.
 * ADR-122 이후 canonical document 를 여기서 legacy export 하는 convenience
 * wrapper 는 제거하고, caller 가 compatibility boundary에서 만든 snapshot만
 * 명시적으로 넘긴다.
 *
 * **활성화 흐름** (caller 측 통합 예시):
 * ```ts
 * if (isShadowWriteEnabled()) {
 *   const result = evaluateShadowWrite(legacyBefore, legacyAfter);
 *   logShadowWriteResult(result, { projectId });
 * }
 * ```
 *
 * **Phase 3-A monitoring 시점 (1-2주)**:
 * - `setShadowWriteEnabled(true)` 로 dev 환경 활성.
 * - destructive=0 확정 시 3-B 진입 prerequisite 통과.
 */

import type { Element } from "@/types/builder/unified.types";

import { diffLegacyRoundtrip, type RoundtripDiff } from "./diffLegacyRoundtrip";

// ─────────────────────────────────────────────
// Feature flag
// ─────────────────────────────────────────────

let shadowWriteEnabled = false;

export function isShadowWriteEnabled(): boolean {
  return shadowWriteEnabled;
}

export function setShadowWriteEnabled(value: boolean): void {
  shadowWriteEnabled = value;
}

// ─────────────────────────────────────────────
// Evaluator
// ─────────────────────────────────────────────

export interface ShadowWriteResult {
  /** 3-카테고리 diff (destructive / reorder / cosmetic) */
  diff: RoundtripDiff;
  /** destructive.length > 0 — G4 PASS 차단 시그널 */
  hasDestructive: boolean;
  /** 카테고리별 카운트 요약 (telemetry / log 용) */
  summary: {
    destructive: number;
    reorder: number;
    cosmetic: number;
  };
}

/**
 * legacy snapshot 두 시점 비교 → ShadowWriteResult.
 *
 * @param legacyBefore - canonical write 직전 legacy elements (보통 elementsMap snapshot)
 * @param legacyAfter - compatibility boundary에서 명시적으로 만든 legacy snapshot
 */
export function evaluateShadowWrite(
  legacyBefore: Element[],
  legacyAfter: Element[],
): ShadowWriteResult {
  const diff = diffLegacyRoundtrip(legacyBefore, legacyAfter);
  return {
    diff,
    hasDestructive: diff.destructive.length > 0,
    summary: {
      destructive: diff.destructive.length,
      reorder: 0,
      cosmetic: diff.cosmetic.length,
    },
  };
}

// ─────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────

export interface ShadowWriteLogContext {
  projectId?: string;
  source?: string;
}

/**
 * console UI 노출 helper — destructive 시 warn, reorder 시 info, cosmetic 만 시 silent.
 *
 * production 환경에서는 silent (`NODE_ENV === "production"` 가드).
 */
export function logShadowWriteResult(
  result: ShadowWriteResult,
  context: ShadowWriteLogContext = {},
): void {
  if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV === "production"
  ) {
    return;
  }

  const { projectId, source } = context;
  const tag = `[ADR-116 shadow-write${source ? `:${source}` : ""}${
    projectId ? ` ${projectId}` : ""
  }]`;

  if (result.hasDestructive) {
    console.warn(
      `${tag} destructive=${result.summary.destructive} reorder=${result.summary.reorder} cosmetic=${result.summary.cosmetic}`,
      result.diff.destructive,
    );
    return;
  }

  if (result.summary.reorder > 0) {
    console.info(
      `${tag} destructive=0 reorder=${result.summary.reorder} cosmetic=${result.summary.cosmetic}`,
    );
  }
}
