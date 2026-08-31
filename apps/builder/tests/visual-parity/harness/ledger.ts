/**
 * ADR-198 Phase 4a — 예외 ledger 스키마와 ratchet (test-only)
 *
 * 예외는 게이트를 무르게 만드는 유일한 합법 경로다. 그래서 예외 쪽에 규율을 건다:
 * **주인 · 사유 · 재검토 기한이 없으면 예외가 아니고**, 프레임 전체를 덮는 mask 는
 * 예외가 아니라 게이트 해제이며, 기한이 지난 예외와 조용한 예산 인상은 실패다 (R5).
 *
 * 승인된 예외 목록(`APPROVED_EXCEPTIONS`)은 **지금 비어 있다**. 비어 있는 것이
 * 정상 상태이고, 항목이 생기면 그 자체가 리뷰 대상이다.
 */

import { PARITY_CODES, type ParityCode, type Rect } from "./types";

export interface ParityException {
  caseId: string;
  regionId: string;
  /** 사람 — 팀 이름이나 "TBD" 는 주인이 아니다 */
  owner: string;
  /** 왜 이 발산을 지금 받아들이는가 */
  reason: string;
  /** ISO 날짜. 지나면 ratchet 이 실패시킨다 */
  reviewBy: string;
  /** 이 예외가 인정하는 실패 코드 — 닫힌 집합 밖이면 거부 */
  code: ParityCode;
  maxDiffRatio: number;
  maxByte: number;
  /** 유한 사각형만. 프레임 전체를 덮으면 거부 */
  mask?: Rect[];
}

export interface LedgerContext {
  /** ISO 날짜 — 기한 판정 기준 */
  today: string;
  frame: { width: number; height: number };
  /** region 별 승인 예산. 예외가 이보다 느슨해지면 예산 인상이다 */
  approvedBudgets: Record<string, { maxDiffRatio: number; maxByte: number }>;
}

export interface LedgerViolation {
  entry: string;
  rule:
    | "missing-owner"
    | "missing-reason"
    | "missing-review-date"
    | "wildcard-mask"
    | "stale-exception"
    | "budget-increase"
    | "unknown-failure-code";
  detail: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** mask 가 프레임의 대부분을 덮으면 그건 예외가 아니라 게이트 해제다. */
function isWildcardMask(mask: Rect[] | undefined, frame: LedgerContext["frame"]): boolean {
  if (!mask) return false;
  if (mask.length === 0) return true; // 빈 배열 = "무엇이든" 으로 읽힌다
  const frameArea = frame.width * frame.height;
  const covered = mask.reduce((sum, r) => sum + r.width * r.height, 0);
  return covered >= frameArea * 0.9;
}

export function validateExceptionLedger(
  entries: readonly ParityException[],
  ctx: LedgerContext,
): LedgerViolation[] {
  const violations: LedgerViolation[] = [];
  const push = (e: ParityException, rule: LedgerViolation["rule"], detail: string) =>
    violations.push({ entry: `${e.caseId}/${e.regionId}`, rule, detail });

  for (const e of entries) {
    if (!e.owner || e.owner.trim().length === 0 || /^tbd$/i.test(e.owner.trim())) {
      push(e, "missing-owner", `owner="${e.owner}" — 사람 이름이어야 한다`);
    }
    if (!e.reason || e.reason.trim().length < 10) {
      push(e, "missing-reason", `reason 이 비었거나 너무 짧다: "${e.reason}"`);
    }
    if (!e.reviewBy || !ISO_DATE.test(e.reviewBy)) {
      push(e, "missing-review-date", `reviewBy="${e.reviewBy}" — ISO 날짜여야 한다`);
    } else if (e.reviewBy < ctx.today) {
      push(e, "stale-exception", `reviewBy=${e.reviewBy} 가 오늘(${ctx.today})보다 이르다`);
    }
    if (isWildcardMask(e.mask, ctx.frame)) {
      push(e, "wildcard-mask", "mask 가 프레임 전체(90% 이상)를 덮는다");
    }
    if (!(PARITY_CODES as readonly string[]).includes(e.code)) {
      push(e, "unknown-failure-code", `code="${e.code}" 가 닫힌 집합에 없다`);
    }
    const approved = ctx.approvedBudgets[e.regionId];
    if (
      approved &&
      (e.maxDiffRatio > approved.maxDiffRatio || e.maxByte > approved.maxByte)
    ) {
      push(
        e,
        "budget-increase",
        `예외 예산 (${e.maxDiffRatio} / ${e.maxByte}) 이 승인 예산 ` +
          `(${approved.maxDiffRatio} / ${approved.maxByte}) 보다 느슨하다`,
      );
    }
  }

  return violations;
}

/** 승인된 예외 — 비어 있는 것이 정상 상태다. */
export const APPROVED_EXCEPTIONS: readonly ParityException[] = [];
