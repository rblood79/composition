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
 * const document = await db.documents.get(projectId);
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
    await adapter.init();

    dbInstance = adapter;
    initPromise = null;

    return adapter;
  })();

  initPromise = promise;
  return promise;
}

/**
 * 데이터베이스 연결 닫기
 */
export async function closeDB(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    initPromise = null;
    console.log("[DB] Database closed");
  }
}

/**
 * 데이터베이스 초기화 여부 확인
 */
export function isDBInitialized(): boolean {
  return dbInstance !== null;
}

/**
 * 캐시 통계 조회 (개발/디버깅용)
 */
export async function getCacheStats() {
  const db = await getDB();
  if (
    "cache" in db &&
    db.cache &&
    typeof (db.cache as { getStats?: () => unknown }).getStats === "function"
  ) {
    return (db.cache as { getStats: () => unknown }).getStats();
  }
  return null;
}

/**
 * 캐시 초기화 (개발/디버깅용)
 */
export async function clearCache() {
  const db = await getDB();
  if (
    "cache" in db &&
    db.cache &&
    typeof (db.cache as { clear?: () => void }).clear === "function"
  ) {
    (db.cache as { clear: () => void }).clear();
  }
}

// Re-export types
export type * from "./types";
