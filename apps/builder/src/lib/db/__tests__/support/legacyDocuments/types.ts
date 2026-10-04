/** The old Builder's canonical document rows (legacy IndexedDB layout, read by asset GC · eviction). */
import type { LegacyDocumentFixture } from "../legacyPayload";

export interface CanonicalDocumentRecord {
  project_id: string;
  document: LegacyDocumentFixture;
  updated_at: string;
}

/**
 * documents_backup ring row (2026-07-14 요소 소실 사건 대응).
 * `backup_id` = `${project_id}::${원본 row 의 updated_at}`.
 */
export interface CanonicalDocumentBackupRecord {
  backup_id: string;
  project_id: string;
  document: LegacyDocumentFixture;
  updated_at: string;
}

/**
 * documents.put 급감 가드 옵션 — adapter 구현은
 * `indexedDB/documentPersistGuard.ts` 판정 경유.
 */
export interface DocumentPersistOptions {
  /** 대량 삭제가 의도된 흐름 (요소 삭제 / 페이지 삭제) 에서만 true */
  allowShrink?: boolean;
  /**
   * 설명 가능한 감소량 (history undo/redo 전용, 2026-07-15 사용자 승인) —
   * entry 의 canonical event deleteIds 로 산출한 예상 제거 node 수.
   * 가드는 `nextCount ≥ prevCount − expectedShrinkNodeCount` 일 때만 통과
   * (delta 불일치 시 기존과 동일하게 차단 — fail-closed).
   */
  expectedShrinkNodeCount?: number;
  /** 진단 로그용 호출 출처 */
  reason?: string;
}
