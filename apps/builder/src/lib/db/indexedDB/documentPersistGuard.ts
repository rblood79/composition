/**
 * Canonical document persist guard — 요소 소실 사건 재발 차단 (2026-07-14)
 *
 * 배경: freeze 중 AutoRecovery `clearAllPages()` / LRU eviction 이 legacy store 를
 * 부분 상태로 만들고, full-replace 경로 (page-shell bridge / history sync) 가 그
 * 부분 상태를 canonical 에 투영하면, BuilderCore persist 구독이 즉시 IndexedDB
 * 단일 row 를 덮어써 영구 손실이 확정되던 체인 (2026-07-13/14 사건 2회).
 *
 * 본 모듈은 adapter `documents.put` 단일 관문에서 두 가지를 제공한다:
 * 1. **급감 가드** — node 수가 임계 비율 미만으로 줄어드는 write 를 기본 거부.
 *    정당한 대량 삭제 흐름 (요소 삭제 / 페이지 삭제) 만 `allowShrink` 로 통과.
 *    거부 시 실패 모드는 "메모리-DB 발산 → 새로고침 시 복원" — 손실보다 안전.
 * 2. **백업 ring 판정** — 덮어쓰기 전 세대 백업의 시간 버킷 (per-project 최소
 *    간격) 판정. 편집 burst 마다 백업이 회전 소모되는 것을 방지.
 */

import type { CompositionDocument } from "@composition/shared";
import type { DocumentPersistOptions } from "../types";

export type { DocumentPersistOptions };

// ─────────────────────────────────────────────
// 상수 — 가드 임계값
// ─────────────────────────────────────────────

/** 이 개수 미만의 문서는 가드 미적용 (소형 문서의 정상 삭제 오탐 방지) */
export const GUARD_MIN_PREV_NODES = 20;

/** 신규 node 수가 기존의 이 비율 미만이면 급감으로 판정 */
export const GUARD_SHRINK_RATIO = 0.3;

/** 같은 프로젝트의 백업 간 최소 간격 (ms) — 편집 burst 로 ring 소모 방지 */
export const BACKUP_MIN_INTERVAL_MS = 60_000;

/** 프로젝트당 보존할 백업 세대 수 */
export const BACKUP_GENERATIONS = 5;

// ─────────────────────────────────────────────
// Node 계수
// ─────────────────────────────────────────────

interface CountableNode {
  children?: CountableNode[];
}

function countNodes(nodes: readonly CountableNode[] | undefined): number {
  if (!nodes || nodes.length === 0) return 0;
  let count = 0;
  for (const node of nodes) {
    count += 1 + countNodes(node.children);
  }
  return count;
}

/** canonical document 의 UI node 총 개수 (children 트리 재귀, root collection 제외) */
export function countCanonicalDocumentNodes(doc: CompositionDocument): number {
  return countNodes(doc.children as unknown as CountableNode[]);
}

// ─────────────────────────────────────────────
// 급감 가드 판정
// ─────────────────────────────────────────────

export interface PersistDecision {
  allowed: boolean;
  prevCount: number;
  nextCount: number;
  /** blocked 일 때만 — 사람이 읽을 사유 */
  blockReason?: string;
}

/**
 * 덮어쓰기 허용 여부 판정 (순수 함수).
 *
 * 차단 조건: 기존 문서가 유의미한 크기 (`GUARD_MIN_PREV_NODES` 이상) 인데
 * 신규 문서가 `GUARD_SHRINK_RATIO` 미만으로 급감 + `allowShrink` 미지정.
 */
export function evaluateDocumentPersist(
  prevCount: number,
  nextCount: number,
  options?: DocumentPersistOptions,
): PersistDecision {
  if (options?.allowShrink) {
    return { allowed: true, prevCount, nextCount };
  }
  if (prevCount < GUARD_MIN_PREV_NODES) {
    return { allowed: true, prevCount, nextCount };
  }
  if (nextCount < prevCount * GUARD_SHRINK_RATIO) {
    // history undo/redo 의 "설명 가능한 감소" — entry deleteIds 산출량 한도
    // 안의 급감만 통과 (2026-07-15 사용자 승인 예외). delta 를 초과하는
    // 감소는 여전히 차단 (fail-closed — 가드 본래 목적인 '설명 불가능한
    // 대량 소실 차단' 유지).
    const expectedShrink = options?.expectedShrinkNodeCount;
    if (
      typeof expectedShrink === "number" &&
      expectedShrink > 0 &&
      nextCount >= prevCount - expectedShrink
    ) {
      return { allowed: true, prevCount, nextCount };
    }
    return {
      allowed: false,
      prevCount,
      nextCount,
      blockReason:
        `node count ${prevCount} → ${nextCount} ` +
        `(< ${Math.round(GUARD_SHRINK_RATIO * 100)}%) — ` +
        "suspected truncated in-memory canonical document; write rejected. " +
        "정당한 대량 삭제라면 호출부에서 allowShrink 를 전달해야 한다.",
    };
  }
  return { allowed: true, prevCount, nextCount };
}

// ─────────────────────────────────────────────
// 백업 ring 시간 버킷 판정
// ─────────────────────────────────────────────

/**
 * 새 백업 세대를 기록할지 판정 (순수 함수).
 *
 * @param latestBackupUpdatedAt — 해당 프로젝트의 가장 최근 백업 `updated_at`
 *   (ISO). 백업이 없으면 undefined → 항상 기록.
 * @param nowMs — 현재 시각 (epoch ms). caller 주입 (테스트 결정성).
 */
export function shouldWriteBackup(
  latestBackupUpdatedAt: string | undefined,
  nowMs: number,
): boolean {
  if (!latestBackupUpdatedAt) return true;
  const latestMs = Date.parse(latestBackupUpdatedAt);
  if (Number.isNaN(latestMs)) return true;
  return nowMs - latestMs >= BACKUP_MIN_INTERVAL_MS;
}
