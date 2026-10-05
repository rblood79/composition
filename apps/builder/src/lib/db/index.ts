/**
 * Database Instance Manager
 *
 * 전역 데이터베이스 인스턴스를 관리합니다.
 * - IndexedDB (웹 브라우저)
 * - PGlite (Electron, 향후 추가 예정)
 */

import { IndexedDBAdapter } from "./indexedDB/adapter";
import type { DatabaseAdapter } from "./types";

// 전역 DB 인스턴스 (싱글톤)
let dbInstance: DatabaseAdapter | null = null;
let initPromise: Promise<DatabaseAdapter> | null = null;

/**
 * 데이터베이스 인스턴스 가져오기
 *
 * @example
 * ```typescript
 * const db = await getDB();
 * const tables = await db.collections.getByProject(projectId);
 * ```
 */
export async function getDB(): Promise<DatabaseAdapter> {
  // 이미 초기화된 인스턴스가 있으면 반환
  if (dbInstance) {
    return dbInstance;
  }

  // 초기화 중이면 대기
  if (initPromise) {
    return initPromise;
  }

  // 새로 초기화
  const promise = (async (): Promise<DatabaseAdapter> => {
    // 향후 Electron 지원 시:
    // const adapter = import.meta.env.ELECTRON
    //   ? new PGliteAdapter()
    //   : new IndexedDBAdapter();

    const adapter: DatabaseAdapter = new IndexedDBAdapter();
    try {
      await adapter.init();
    } catch (error) {
      // 실패한 promise 를 남기지 않는다 — 다음 호출이 다시 연다 (감사 L3: 그대로 두면
      // VersionError 한 번으로 그 세션의 데이터 저장 · 삭제가 전부 실패했다).
      initPromise = null;
      throw error;
    }

    dbInstance = adapter;
    initPromise = null;

    return adapter;
  })();

  initPromise = promise;
  return promise;
}

// Re-export types
export type * from "./types";
