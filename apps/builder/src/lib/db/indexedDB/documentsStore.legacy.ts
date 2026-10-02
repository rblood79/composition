/**
 * ADR-248 Phase 4e-7: the old Builder's canonical documents store (ADR-116 primary storage — the
 * incremental head + parts, the shrink guard and the backup ring). The old canonical document store
 * imports this module, which installs the store on the IndexedDB adapter (`installDocumentsStore`).
 * It goes with the old store.
 */
import type { CompositionDocument } from "@composition/shared";
import type {
  CanonicalDocumentBackupRecord,
  DatabaseAdapter,
  DocumentPersistOptions,
} from "../types";
import {
  requestPersistenceOnce,
  withQuotaRetry,
} from "../../storage/storageProtection";
import { installDocumentsStore } from "./adapter";
import { IncrementalDocuments } from "./incrementalDocuments";

installDocumentsStore((access): DatabaseAdapter["documents"] => {
  const incrementalDocuments = new IncrementalDocuments(() =>
    access.ensureDB(),
  );
  return {
    /**
     * 급감 가드 + 백업 ring 경유 write (2026-07-14 요소 소실 사건 대응).
     *
     * - node 수 급감 write 는 기본 거부 (throw 하지 않고 skip + 경고 —
     *   실패 모드가 "새로고침 시 DB 상태로 복원" 이 되도록).
     * - 덮어쓰기 전 기존 row 를 documents_backup ring 에 보존 (프로젝트당
     *   BACKUP_GENERATIONS 세대, BACKUP_MIN_INTERVAL_MS 시간 버킷).
     */
    put: async (
      projectId: string,
      document: CompositionDocument,
      options?: DocumentPersistOptions,
    ): Promise<CompositionDocument> => {
      // ADR-235 Phase 5 — quota 초과면 캐시를 비우고 1회 재시도, 그래도 실패하면 알림 이벤트.
      //   첫 성공 저장에서 persist() 를 한 번 요청한다.
      const saved = await withQuotaRetry(
        () => incrementalDocuments.put(projectId, document, options),
        () => access.clearCaches(),
      );
      void requestPersistenceOnce();
      return saved;
    },

    /** 백업 ring 조회 (최신순) — 사고 시 콘솔 복구용 진입점 */
    getBackups: async (
      projectId: string,
    ): Promise<CanonicalDocumentBackupRecord[]> => {
      const backups = await access.getAllByIndex<CanonicalDocumentBackupRecord>(
        "documents_backup",
        "project_id",
        projectId,
      );
      return backups.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    backupNow: (projectId: string) => incrementalDocuments.backupNow(projectId),

    get: (projectId: string) => incrementalDocuments.get(projectId),
    delete: (projectId: string) => incrementalDocuments.delete(projectId),
    getAll: () => incrementalDocuments.getAll(),
  };
});
