/**
 * History IndexedDB Service
 *
 * 🚀 Phase 3: 히스토리 엔트리의 영구 저장소
 *
 * 아키텍처:
 * - Hot Cache (Memory): 최근 50개 엔트리 - 즉시 접근
 * - Cold Storage (IndexedDB): 전체 히스토리 - 세션 복원용
 *
 * 기능:
 * - 히스토리 엔트리 저장/조회
 * - 페이지별 히스토리 관리
 * - 세션 복원 (브라우저 새로고침 후)
 * - 자동 정리 (90일 이상 오래된 엔트리 삭제)
 *
 * @since 2025-12-10 Phase 3 IndexedDB Integration
 */

import type { HistoryEntry } from "../history";
import type { HistorySnapshot } from "./snapshots";

// ============================================
// Types
// ============================================

interface HistoryDBSchema {
  id: string;
  pageId: string;
  entry: HistoryEntry;
  createdAt: number;
}

interface PageHistoryMeta {
  pageId: string;
  currentIndex: number;
  totalEntries: number;
  lastUpdated: number;
}

// ============================================
// Constants
// ============================================

const DB_NAME = "composition-history";
// v4부터 history entry는 canonicalEvents 계약만 영속한다. 개발 단계의 v1
// snapshot payload는 변환하지 않고 해당 history store만 초기화한다. v2/v3의
// canonical history와 v3 snapshots는 그대로 보존한다.
const DB_VERSION = 4;
const STORE_ENTRIES = "history-entries";
const STORE_META = "page-meta";
const STORE_SNAPSHOTS = "snapshots";
const MAX_AGE_DAYS = 90;

const ELEMENT_AXIS_HISTORY_TYPES = new Set<HistoryEntry["type"]>([
  "add",
  "update",
  "remove",
  "move",
  "batch",
  "group",
  "ungroup",
]);

/** IndexedDB에 저장·복원할 수 있는 canonical history entry 계약. */
export function isCanonicalHistoryEntry(entry: HistoryEntry): boolean {
  if (ELEMENT_AXIS_HISTORY_TYPES.has(entry.type)) {
    return (entry.data.canonicalEvents?.length ?? 0) > 0;
  }

  switch (entry.type) {
    case "page-title":
      return entry.data.pageTitleEvent !== undefined;
    case "page-position":
      return (entry.data.pagePositionEvent?.entries.length ?? 0) > 0;
    case "page-guide":
      return (entry.data.pageGuideEvent?.entries.length ?? 0) > 0;
    case "page-lifecycle":
      return entry.data.pageLifecycleEvent !== undefined;
    case "snapshot-restore":
      return entry.data.snapshotRestoreEvent !== undefined;
    default:
      return false;
  }
}

// ============================================
// IndexedDB Service
// ============================================

export class HistoryIndexedDB {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * 데이터베이스 초기화
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.dbPromise) {
      await this.dbPromise;
      return;
    }

    this.dbPromise = this.openDatabase();
    this.db = await this.dbPromise;

    // 오래된 엔트리 정리 (백그라운드)
    this.cleanupOldEntries().catch(console.error);
  }

  /**
   * 데이터베이스 열기
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const idb = (globalThis as unknown as { indexedDB?: IDBFactory })
        .indexedDB;
      if (!idb) {
        reject(new Error("IndexedDB is not available in this environment"));
        return;
      }

      const request = idb.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error(
          "❌ [HistoryIDB] Failed to open database:",
          request.error,
        );
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // 개발 단계에서 만들어진 v1 snapshot history는 더 이상 지원하지 않는다.
        // 프로젝트 문서 DB와 별도 DB이므로 history entry/meta만 초기화한다.
        if (oldVersion === 1) {
          if (db.objectStoreNames.contains(STORE_ENTRIES)) {
            db.deleteObjectStore(STORE_ENTRIES);
          }
          if (db.objectStoreNames.contains(STORE_META)) {
            db.deleteObjectStore(STORE_META);
          }
        }

        // 히스토리 엔트리 스토어
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          const entriesStore = db.createObjectStore(STORE_ENTRIES, {
            keyPath: "id",
          });
          entriesStore.createIndex("pageId", "pageId", { unique: false });
          entriesStore.createIndex("createdAt", "createdAt", { unique: false });
          entriesStore.createIndex(
            "pageId_createdAt",
            ["pageId", "createdAt"],
            { unique: false },
          );
        }

        // 페이지 메타데이터 스토어
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "pageId" });
        }

        // **ADR-180 Phase 1 — 스냅샷 스토어 (v3 신규)**
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          const snapshotsStore = db.createObjectStore(STORE_SNAPSHOTS, {
            keyPath: "id",
          });
          snapshotsStore.createIndex("projectId", "projectId", {
            unique: false,
          });
        }
      };
    });
  }

  /**
   * 데이터베이스 가져오기 (지연 초기화)
   */
  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // ============================================
  // Entry Operations
  // ============================================

  /**
   * 히스토리 엔트리 저장
   */
  async saveEntry(pageId: string, entry: HistoryEntry): Promise<void> {
    if (!isCanonicalHistoryEntry(entry)) return;

    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_ENTRIES], "readwrite");
        const store = transaction.objectStore(STORE_ENTRIES);

        const record: HistoryDBSchema = {
          id: entry.id,
          pageId,
          entry,
          createdAt: entry.timestamp,
        };

        const request = store.put(record);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error("❌ [HistoryIDB] Failed to save entry:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] saveEntry error:", error);
      // 실패해도 메모리에는 저장되어 있으므로 throw하지 않음
    }
  }

  /**
   * 여러 히스토리 엔트리 일괄 저장
   */
  async saveEntries(pageId: string, entries: HistoryEntry[]): Promise<void> {
    const canonicalEntries = entries.filter(isCanonicalHistoryEntry);
    if (canonicalEntries.length === 0) return;

    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_ENTRIES], "readwrite");
        const store = transaction.objectStore(STORE_ENTRIES);

        let completed = 0;
        let hasError = false;

        for (const entry of canonicalEntries) {
          const record: HistoryDBSchema = {
            id: entry.id,
            pageId,
            entry,
            createdAt: entry.timestamp,
          };

          const request = store.put(record);

          request.onsuccess = () => {
            completed++;
            if (completed === canonicalEntries.length && !hasError) {
              resolve();
            }
          };

          request.onerror = () => {
            if (!hasError) {
              hasError = true;
              console.error(
                "❌ [HistoryIDB] Failed to save entries:",
                request.error,
              );
              reject(request.error);
            }
          };
        }
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] saveEntries error:", error);
    }
  }

  /**
   * 페이지의 모든 히스토리 엔트리 조회
   */
  async getEntriesByPage(pageId: string): Promise<HistoryEntry[]> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_ENTRIES], "readonly");
        const store = transaction.objectStore(STORE_ENTRIES);
        const index = store.index("pageId");
        const request = index.getAll(pageId);

        request.onsuccess = () => {
          const records = request.result as HistoryDBSchema[];
          // 시간순 정렬
          records.sort((a, b) => a.createdAt - b.createdAt);
          resolve(
            records
              .map((record) => record.entry)
              .filter(isCanonicalHistoryEntry),
          );
        };

        request.onerror = () => {
          console.error(
            "❌ [HistoryIDB] Failed to get entries:",
            request.error,
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] getEntriesByPage error:", error);
      return [];
    }
  }

  /**
   * 특정 엔트리 삭제
   */
  async deleteEntry(entryId: string): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_ENTRIES], "readwrite");
        const store = transaction.objectStore(STORE_ENTRIES);
        const request = store.delete(entryId);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error(
            "❌ [HistoryIDB] Failed to delete entry:",
            request.error,
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] deleteEntry error:", error);
    }
  }

  /**
   * 페이지의 모든 히스토리 삭제
   */
  async clearPageHistory(pageId: string): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(
          [STORE_ENTRIES, STORE_META],
          "readwrite",
        );
        const entriesStore = transaction.objectStore(STORE_ENTRIES);
        const metaStore = transaction.objectStore(STORE_META);

        // 엔트리 삭제
        const index = entriesStore.index("pageId");
        const request = index.openCursor(pageId);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
            .result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        // 메타 삭제
        metaStore.delete(pageId);

        transaction.oncomplete = () => {
          resolve();
        };

        transaction.onerror = () => {
          console.error(
            "❌ [HistoryIDB] Failed to clear page history:",
            transaction.error,
          );
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] clearPageHistory error:", error);
    }
  }

  // ============================================
  // Meta Operations
  // ============================================

  /**
   * 페이지 메타데이터 저장
   */
  async savePageMeta(
    pageId: string,
    currentIndex: number,
    totalEntries: number,
  ): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_META], "readwrite");
        const store = transaction.objectStore(STORE_META);

        const meta: PageHistoryMeta = {
          pageId,
          currentIndex,
          totalEntries,
          lastUpdated: Date.now(),
        };

        const request = store.put(meta);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error("❌ [HistoryIDB] Failed to save meta:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] savePageMeta error:", error);
    }
  }

  /**
   * 페이지 메타데이터 조회
   */
  async getPageMeta(pageId: string): Promise<PageHistoryMeta | null> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_META], "readonly");
        const store = transaction.objectStore(STORE_META);
        const request = store.get(pageId);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          console.error("❌ [HistoryIDB] Failed to get meta:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] getPageMeta error:", error);
      return null;
    }
  }

  /**
   * 모든 페이지 ID 조회
   */
  async getAllPageIds(): Promise<string[]> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_META], "readonly");
        const store = transaction.objectStore(STORE_META);
        const request = store.getAllKeys();

        request.onsuccess = () => {
          resolve(request.result as string[]);
        };

        request.onerror = () => {
          console.error(
            "❌ [HistoryIDB] Failed to get page IDs:",
            request.error,
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] getAllPageIds error:", error);
      return [];
    }
  }

  // ============================================
  // Cleanup Operations
  // ============================================

  /**
   * 오래된 엔트리 정리 (90일 이상)
   */
  async cleanupOldEntries(): Promise<number> {
    try {
      const db = await this.getDB();
      const cutoffTime = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_ENTRIES], "readwrite");
        const store = transaction.objectStore(STORE_ENTRIES);
        const index = store.index("createdAt");
        const range = IDBKeyRange.upperBound(cutoffTime);
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
            .result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          }
        };

        transaction.oncomplete = () => {
          resolve(deletedCount);
        };

        transaction.onerror = () => {
          console.error("❌ [HistoryIDB] Cleanup failed:", transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] cleanupOldEntries error:", error);
      return 0;
    }
  }

  /**
   * 모든 히스토리 삭제
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(
          [STORE_ENTRIES, STORE_META],
          "readwrite",
        );

        transaction.objectStore(STORE_ENTRIES).clear();
        transaction.objectStore(STORE_META).clear();

        transaction.oncomplete = () => {
          resolve();
        };

        transaction.onerror = () => {
          console.error(
            "❌ [HistoryIDB] Failed to clear all:",
            transaction.error,
          );
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] clearAll error:", error);
    }
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * 스토리지 통계
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalPages: number;
    estimatedSize: number;
  }> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(
          [STORE_ENTRIES, STORE_META],
          "readonly",
        );

        let totalEntries = 0;
        let totalPages = 0;

        const entriesRequest = transaction.objectStore(STORE_ENTRIES).count();
        const metaRequest = transaction.objectStore(STORE_META).count();

        entriesRequest.onsuccess = () => {
          totalEntries = entriesRequest.result;
        };

        metaRequest.onsuccess = () => {
          totalPages = metaRequest.result;
        };

        transaction.oncomplete = () => {
          // 대략적인 크기 추정 (엔트리당 ~500 bytes)
          const estimatedSize = totalEntries * 500;
          resolve({ totalEntries, totalPages, estimatedSize });
        };

        transaction.onerror = () => {
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] getStats error:", error);
      return { totalEntries: 0, totalPages: 0, estimatedSize: 0 };
    }
  }

  // ============================================
  // Snapshot Operations (ADR-180 — SnapshotStorage 구현)
  // ============================================

  /**
   * 스냅샷 저장 (신규 + rename 덮어쓰기 겸용)
   */
  async saveSnapshot(snapshot: HistorySnapshot): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SNAPSHOTS], "readwrite");
        const store = transaction.objectStore(STORE_SNAPSHOTS);
        const request = store.put(snapshot);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error(
            "❌ [HistoryIDB] Failed to save snapshot:",
            request.error,
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] saveSnapshot error:", error);
      // 실패해도 메모리에는 유지되므로 throw하지 않음 (entry 관례 동일)
    }
  }

  /**
   * 프로젝트의 모든 스냅샷 조회 (최신순 정렬)
   */
  async getSnapshotsByProject(projectId: string): Promise<HistorySnapshot[]> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SNAPSHOTS], "readonly");
        const store = transaction.objectStore(STORE_SNAPSHOTS);
        const index = store.index("projectId");
        const request = index.getAll(projectId);

        request.onsuccess = () => {
          const records = request.result as HistorySnapshot[];
          records.sort((a, b) => b.createdAt - a.createdAt);
          resolve(records);
        };

        request.onerror = () => {
          console.error(
            "❌ [HistoryIDB] Failed to get snapshots:",
            request.error,
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] getSnapshotsByProject error:", error);
      return [];
    }
  }

  /**
   * 스냅샷 삭제
   */
  async deleteSnapshot(id: string): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SNAPSHOTS], "readwrite");
        const store = transaction.objectStore(STORE_SNAPSHOTS);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error(
            "❌ [HistoryIDB] Failed to delete snapshot:",
            request.error,
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ [HistoryIDB] deleteSnapshot error:", error);
    }
  }

  /**
   * 데이터베이스 연결 종료
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dbPromise = null;
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

export const historyIndexedDB = new HistoryIndexedDB();
