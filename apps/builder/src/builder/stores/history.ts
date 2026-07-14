import {
  Element,
  ComponentElementProps,
} from "../../types/builder/unified.types";
import { type SerializableElementDiff } from "./utils/elementDiff";
import { historyIndexedDB } from "./history/historyIndexedDB";
import { type CanonicalHistoryNodeEvent } from "./history/canonicalHistoryEvents";

/**
 * 간단하고 효율적인 History 시스템
 *
 * 🚀 Phase 3 개선 (2025-12-10):
 * - Diff 기반 저장으로 메모리 사용량 80% 감소
 * - 전체 스냅샷 대신 변경사항만 저장
 * - 페이지별 독립적인 히스토리 관리
 * - 최대 히스토리 크기 제한으로 메모리 누수 방지
 * - IndexedDB 연동으로 세션 복원 지원
 *
 * 아키텍처:
 * - Hot Cache (Memory): 최근 50개 엔트리 - 즉시 Undo/Redo
 * - Cold Storage (IndexedDB): 전체 히스토리 - 세션 복원
 *
 * 메모리 비교:
 * - Before: 요소당 ~2-5KB (전체 스냅샷)
 * - After: 변경당 ~100-500 bytes (diff만)
 */

/**
 * `HistoryEntry` — undo/redo 단일 엔트리.
 *
 * **ADR-124 Phase 4 deprecation contract**:
 * - `data.canonicalEvents` 가 primary path. 모든 신규 entry 는 entry 생성
 *   시점에 caller 가 canonical event 를 부착한다 (2026-07-15 history 정비 —
 *   전 mutation call site 전환 완료, `addEntry` DEV guard 가 미부착을 경고).
 * - v1 IndexedDB 에서 load 된 entry 는 `migrateV1EntryToV2` adapter 에 의해
 *   `data.canonicalEvents` 가 보장된다 (ADR-124 Phase 3).
 * - 하단 `@deprecated` 마킹된 legacy snapshot field 는 v1 IndexedDB
 *   compatibility 보존을 위해 type 정의는 유지하되 신규 entry 생성 시 사용
 *   금지. ADR-124 Phase 5 (v1→v2 IndexedDB migration) 완료 후 삭제 예정.
 * - 신규 entry 의 fallback path 도 `applyCanonicalHistoryEventsToActiveDocument`
 *   가 우선 적용 (early-return) 하므로 legacy snapshot field read 는 dead.
 *
 * @see docs/adr/124-canonical-only-history-schema.md
 * @see apps/builder/src/builder/stores/history/historyEntryMigration.ts
 */
export interface HistoryEntry {
  id: string;
  type: "add" | "update" | "remove" | "move" | "batch" | "group" | "ungroup";
  elementId: string;
  elementIds?: string[]; // For multi-element operations
  data: {
    /** @deprecated ADR-124 Phase 4 — legacy add/remove snapshot. Phase 5 후 삭제. canonical insert/remove event 사용. */
    element?: Element;
    /** @deprecated ADR-124 Phase 4 — legacy update snapshot. Phase 5 후 삭제. canonical update event 사용. */
    prevElement?: Element;
    /** @deprecated ADR-124 Phase 4 — legacy update snapshot. Phase 5 후 삭제. */
    props?: ComponentElementProps;
    /** @deprecated ADR-124 Phase 4 — legacy update snapshot. Phase 5 후 삭제. */
    prevProps?: ComponentElementProps;
    /** @deprecated ADR-124 Phase 4 — legacy structural snapshot. Phase 5 후 삭제. canonical event parentId 사용. */
    parentId?: string;
    /** @deprecated ADR-124 Phase 4 — legacy move snapshot. Phase 5 후 삭제. */
    prevParentId?: string;
    /** @deprecated ADR-124 Phase 4 — legacy add/remove children snapshot. Phase 5 후 삭제. canonical insert/remove event sequence 사용. */
    childElements?: Element[];
    /** @deprecated ADR-124 Phase 4 — legacy batch snapshot. Phase 5 후 삭제. canonical update event sequence 사용. */
    elements?: Element[];
    /** @deprecated ADR-124 Phase 4 — legacy batch snapshot. Phase 5 후 삭제. */
    prevElements?: Element[];
    /** @deprecated ADR-124 Phase 4 — legacy batch update snapshot. Phase 5 후 삭제. canonical update event sequence 사용. */
    batchUpdates?: Array<{
      elementId: string;
      prevProps: ComponentElementProps;
      newProps: ComponentElementProps;
    }>;
    /** group/ungroup 메타 (canonical 직접 표현 불가) — Phase 4 deprecation 미해당, 유지. */
    groupData?: { groupId: string; childIds: string[] };
    /** Diff-based storage — size 추정용 유지, undo/redo 경로는 canonicalEvents 우선. */
    diff?: SerializableElementDiff;
    /** Diff-based storage (batch) — size 추정용 유지. */
    diffs?: SerializableElementDiff[];
    /** **ADR-124 primary** — canonical event sequence (apply 우선 path). */
    canonicalEvents?: CanonicalHistoryNodeEvent[];
  };
  timestamp: number;
  /** Entry size tracking */
  estimatedSize?: number;
}

export interface PageHistory {
  entries: HistoryEntry[];
  currentIndex: number;
  maxSize: number;
}

export class HistoryManager {
  private pageHistories: Map<string, PageHistory> = new Map();
  private currentPageId: string | null = null;
  private readonly defaultMaxSize = 50;
  private indexedDB = historyIndexedDB;
  private readonly idbAvailable =
    typeof (globalThis as unknown as { indexedDB?: unknown }).indexedDB !==
    "undefined";
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // IndexedDB 초기화 (백그라운드)
    if (this.idbAvailable) {
      this.initPromise = this.initialize();
    } else {
      // Node/Vitest/SSR 환경에서는 IndexedDB가 없으므로 메모리 모드로 동작
      this.isInitialized = true;
      this.initPromise = Promise.resolve();
    }
  }

  /**
   * 🆕 Phase 3: IndexedDB 초기화
   */
  private async initialize(): Promise<void> {
    if (!this.idbAvailable) {
      this.isInitialized = true;
      return;
    }
    try {
      await this.indexedDB.init();
      this.isInitialized = true;
    } catch (error) {
      console.error("❌ [History] IndexedDB initialization failed:", error);
      // IndexedDB 실패해도 메모리만으로 동작
      this.isInitialized = true;
    }
  }

  /**
   * 🆕 Phase 3: 초기화 대기
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * 현재 페이지 설정
   *
   * ADR-074 Phase 5: listener notify 를 microtask 로 deferral.
   * 페이지 전환 critical path 에서 listener fan-out (HistoryPanel 업데이트,
   * BuilderCore historyInfo setState 등) 을 제거. IndexedDB 복원은 이미
   * 백그라운드이고, pageHistories.set 은 동기 유지하여 즉시 undo/redo
   * 진입도 문제없다.
   */
  setCurrentPage(pageId: string): void {
    this.currentPageId = pageId;

    // 페이지 히스토리가 없으면 생성 (동기)
    if (!this.pageHistories.has(pageId)) {
      this.pageHistories.set(pageId, {
        entries: [],
        currentIndex: -1,
        maxSize: this.defaultMaxSize,
      });

      // 🆕 Phase 3: IndexedDB에서 복원 시도 (백그라운드)
      if (this.idbAvailable) {
        this.restoreFromIndexedDB(pageId).catch(console.error);
      }
    }

    // ADR-074 Phase 5: notify deferral — microtask 로 listener 호출을
    // 현재 task 밖으로 이전. undo/redo 액션 자체는 pageHistories.get 기반
    // 이라 listener 지연에 영향받지 않음.
    queueMicrotask(() => this.notifyListeners());
  }

  /**
   * 🆕 Phase 3: IndexedDB에서 히스토리 복원
   */
  async restoreFromIndexedDB(pageId: string): Promise<boolean> {
    if (!this.idbAvailable) return false;
    try {
      await this.ensureInitialized();

      // 메타데이터 조회
      const meta = await this.indexedDB.getPageMeta(pageId);
      if (!meta || meta.totalEntries === 0) {
        return false;
      }

      // 엔트리 조회
      const entries = await this.indexedDB.getEntriesByPage(pageId);
      if (entries.length === 0) {
        return false;
      }

      // 메모리에 복원
      const pageHistory = this.pageHistories.get(pageId);
      if (pageHistory && pageHistory.entries.length === 0) {
        // 최신 maxSize개만 메모리에 유지
        const recentEntries = entries.slice(-this.defaultMaxSize);
        pageHistory.entries = recentEntries;
        pageHistory.currentIndex = Math.min(
          meta.currentIndex,
          recentEntries.length - 1,
        );

        this.notifyListeners();
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ [History] Failed to restore from IndexedDB:", error);
      return false;
    }
  }

  /**
   * 히스토리 엔트리 추가 (CommandDataStore 통합)
   */
  addEntry(entry: Omit<HistoryEntry, "id" | "timestamp">): void {
    if (!this.currentPageId) {
      console.warn("[History] addEntry skipped: no currentPageId");
      return;
    }

    // 회귀 감지 (DEV 전용): 모든 신규 entry 는 canonicalEvents 필수 —
    // 미부착 entry 는 undo 시 legacy full-replace fallback 을 유발한다.
    if (import.meta.env?.DEV && !entry.data.canonicalEvents?.length) {
      console.warn(
        "[History] entry without canonicalEvents (legacy fallback 유발):",
        entry.type,
        entry.elementId,
      );
    }

    const pageHistory = this.pageHistories.get(this.currentPageId);
    if (!pageHistory) {
      console.warn(
        "[History] addEntry skipped: no pageHistory for",
        this.currentPageId,
      );
      return;
    }

    const newEntry: HistoryEntry = {
      ...entry,
      id: `history_${crypto.randomUUID()}`,
      timestamp: Date.now(),
    };

    // 현재 인덱스 이후의 엔트리들 제거 (새로운 변경사항이 있을 때)
    pageHistory.entries = pageHistory.entries.slice(
      0,
      pageHistory.currentIndex + 1,
    );

    // 새 엔트리 추가
    pageHistory.entries.push(newEntry);
    pageHistory.currentIndex = pageHistory.entries.length - 1;

    // 최대 크기 초과 시 오래된 엔트리 제거
    if (pageHistory.entries.length > pageHistory.maxSize) {
      pageHistory.entries.shift();
      pageHistory.currentIndex--;
    }

    // 🆕 Phase 3: IndexedDB에 저장 (백그라운드)
    this.saveToIndexedDB(
      this.currentPageId,
      newEntry,
      pageHistory.currentIndex,
    );

    this.notifyListeners();
  }

  /**
   * 🆕 Phase 3: IndexedDB에 엔트리 저장 (백그라운드)
   */
  private saveToIndexedDB(
    pageId: string,
    entry: HistoryEntry,
    currentIndex: number,
  ): void {
    if (!this.idbAvailable) return;
    // 비동기로 저장 (UI 블로킹 방지)
    (async () => {
      try {
        await this.ensureInitialized();

        // 엔트리 저장
        await this.indexedDB.saveEntry(pageId, entry);

        // 메타데이터 업데이트
        const pageHistory = this.pageHistories.get(pageId);
        if (pageHistory) {
          await this.indexedDB.savePageMeta(
            pageId,
            currentIndex,
            pageHistory.entries.length,
          );
        }
      } catch (error) {
        console.error("❌ [History] Failed to save to IndexedDB:", error);
        // 실패해도 메모리에는 저장되어 있으므로 계속 진행
      }
    })();
  }

  /**
   * Undo 실행
   */
  undo(): HistoryEntry | null {
    if (!this.currentPageId) return null;

    const pageHistory = this.pageHistories.get(this.currentPageId);
    if (!pageHistory || pageHistory.currentIndex < 0) return null;

    const entry = pageHistory.entries[pageHistory.currentIndex];
    pageHistory.currentIndex--;

    // 🆕 Phase 3: IndexedDB 메타 업데이트 (백그라운드)
    this.updateIndexedDBMeta(this.currentPageId, pageHistory);

    this.notifyListeners();
    return entry;
  }

  /**
   * Redo 실행
   */
  redo(): HistoryEntry | null {
    if (!this.currentPageId) return null;

    const pageHistory = this.pageHistories.get(this.currentPageId);
    if (
      !pageHistory ||
      pageHistory.currentIndex >= pageHistory.entries.length - 1
    )
      return null;

    pageHistory.currentIndex++;
    const entry = pageHistory.entries[pageHistory.currentIndex];

    // 🆕 Phase 3: IndexedDB 메타 업데이트 (백그라운드)
    this.updateIndexedDBMeta(this.currentPageId, pageHistory);

    this.notifyListeners();
    return entry;
  }

  /**
   * 특정 인덱스로 직접 이동 (중간 렌더링 없이)
   *
   * @param targetIndex 목표 인덱스 (-1은 시작 상태)
   * @returns 적용할 엔트리들과 방향 정보
   */
  goToIndex(
    targetIndex: number,
  ): { entries: HistoryEntry[]; direction: "undo" | "redo" } | null {
    if (!this.currentPageId) return null;

    const pageHistory = this.pageHistories.get(this.currentPageId);
    if (!pageHistory) return null;

    const currentIndex = pageHistory.currentIndex;
    if (targetIndex === currentIndex) return null;

    // 유효한 범위 확인
    if (targetIndex < -1 || targetIndex >= pageHistory.entries.length)
      return null;

    const entries: HistoryEntry[] = [];

    if (targetIndex < currentIndex) {
      // Undo 방향: 현재 인덱스부터 목표+1까지 역순으로 수집
      for (let i = currentIndex; i > targetIndex; i--) {
        entries.push(pageHistory.entries[i]);
      }
      pageHistory.currentIndex = targetIndex;
      this.updateIndexedDBMeta(this.currentPageId, pageHistory);
      this.notifyListeners();
      return { entries, direction: "undo" };
    } else {
      // Redo 방향: 현재+1부터 목표까지 순차적으로 수집
      for (let i = currentIndex + 1; i <= targetIndex; i++) {
        entries.push(pageHistory.entries[i]);
      }
      pageHistory.currentIndex = targetIndex;
      this.updateIndexedDBMeta(this.currentPageId, pageHistory);
      this.notifyListeners();
      return { entries, direction: "redo" };
    }
  }

  /**
   * 🆕 Phase 3: IndexedDB 메타데이터 업데이트 (백그라운드)
   */
  private updateIndexedDBMeta(pageId: string, pageHistory: PageHistory): void {
    if (!this.idbAvailable) return;
    (async () => {
      try {
        await this.ensureInitialized();
        await this.indexedDB.savePageMeta(
          pageId,
          pageHistory.currentIndex,
          pageHistory.entries.length,
        );
      } catch (error) {
        console.error("❌ [History] Failed to update IndexedDB meta:", error);
      }
    })();
  }

  /**
   * Undo 가능 여부
   */
  canUndo(): boolean {
    if (!this.currentPageId) return false;
    const pageHistory = this.pageHistories.get(this.currentPageId);
    return pageHistory ? pageHistory.currentIndex >= 0 : false;
  }

  /**
   * Redo 가능 여부
   */
  canRedo(): boolean {
    if (!this.currentPageId) return false;
    const pageHistory = this.pageHistories.get(this.currentPageId);
    return pageHistory
      ? pageHistory.currentIndex < pageHistory.entries.length - 1
      : false;
  }

  /**
   * 현재 페이지 히스토리 정보
   */
  getCurrentPageHistory(): {
    canUndo: boolean;
    canRedo: boolean;
    totalEntries: number;
    currentIndex: number;
  } {
    if (!this.currentPageId) {
      return {
        canUndo: false,
        canRedo: false,
        totalEntries: 0,
        currentIndex: -1,
      };
    }

    const pageHistory = this.pageHistories.get(this.currentPageId);
    if (!pageHistory) {
      return {
        canUndo: false,
        canRedo: false,
        totalEntries: 0,
        currentIndex: -1,
      };
    }

    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      totalEntries: pageHistory.entries.length,
      currentIndex: pageHistory.currentIndex,
    };
  }

  /**
   * 현재 페이지 히스토리 엔트리 목록
   */
  getCurrentPageEntries(): HistoryEntry[] {
    if (!this.currentPageId) return [];
    const pageHistory = this.pageHistories.get(this.currentPageId);
    return pageHistory ? [...pageHistory.entries] : [];
  }

  /**
   * 페이지 히스토리 초기화
   */
  clearPageHistory(pageId: string): void {
    this.pageHistories.delete(pageId);

    // 🆕 Phase 3: IndexedDB에서도 삭제 (백그라운드)
    if (this.idbAvailable) {
      (async () => {
        try {
          await this.ensureInitialized();
          await this.indexedDB.clearPageHistory(pageId);
        } catch (error) {
          console.error(
            "❌ [History] Failed to clear IndexedDB page history:",
            error,
          );
        }
      })();
    }

    // 현재 페이지가 초기화된 페이지라면 새로운 히스토리 생성
    if (this.currentPageId === pageId) {
      this.setCurrentPage(pageId);
    } else {
      this.notifyListeners();
    }
  }

  /**
   * 모든 히스토리 초기화
   */
  clearAllHistory(): void {
    this.pageHistories.clear();

    // 🆕 Phase 3: IndexedDB도 초기화 (백그라운드)
    if (this.idbAvailable) {
      (async () => {
        try {
          await this.ensureInitialized();
          await this.indexedDB.clearAll();
        } catch (error) {
          console.error(
            "❌ [History] Failed to clear all IndexedDB history:",
            error,
          );
        }
      })();
    }

    this.notifyListeners();
  }

  /**
   * 히스토리 변경 구독
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 구독자 알림
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * 메모리 사용량 통계
   *
   * 🆕 Phase 3: Diff 기반 통계 추가
   */
  getMemoryStats(): {
    pageCount: number;
    totalEntries: number;
    /** entry payload 합산 추정치 (estimatedSize ?? JSON 길이) */
    estimatedMemoryUsage: number;
    diffStats: {
      diffBasedEntries: number;
      snapshotBasedEntries: number;
      totalDiffSize: number;
      avgDiffSize: number;
    };
  } {
    const pageCount = this.pageHistories.size;
    const allEntries = Array.from(this.pageHistories.values()).flatMap(
      (page) => page.entries,
    );
    const totalEntries = allEntries.length;

    // 🆕 Phase 3: Diff 통계 계산
    let diffBasedEntries = 0;
    let snapshotBasedEntries = 0;
    let totalDiffSize = 0;

    for (const entry of allEntries) {
      if (entry.data.diff || entry.data.diffs) {
        diffBasedEntries++;
        totalDiffSize += entry.estimatedSize || 0;
      } else {
        snapshotBasedEntries++;
      }
    }

    const avgDiffSize =
      diffBasedEntries > 0 ? Math.round(totalDiffSize / diffBasedEntries) : 0;

    let estimatedMemoryUsage = 0;
    for (const entry of allEntries) {
      estimatedMemoryUsage +=
        entry.estimatedSize ?? JSON.stringify(entry.data).length;
    }

    return {
      pageCount,
      totalEntries,
      estimatedMemoryUsage,
      diffStats: {
        diffBasedEntries,
        snapshotBasedEntries,
        totalDiffSize,
        avgDiffSize,
      },
    };
  }

  /**
   * 🆕 Phase 3: IndexedDB 통계 조회 (비동기)
   */
  async getIndexedDBStats(): Promise<{
    totalEntries: number;
    totalPages: number;
    estimatedSize: number;
  }> {
    if (!this.idbAvailable) {
      return { totalEntries: 0, totalPages: 0, estimatedSize: 0 };
    }
    try {
      await this.ensureInitialized();
      return await this.indexedDB.getStats();
    } catch (error) {
      console.error("❌ [History] Failed to get IndexedDB stats:", error);
      return { totalEntries: 0, totalPages: 0, estimatedSize: 0 };
    }
  }

  /**
   * 메모리 최적화
   */
  optimizeMemory(): void {
    // 오래된 페이지 히스토리 정리
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7일 전
    for (const [pageId, pageHistory] of this.pageHistories.entries()) {
      const hasRecentEntries = pageHistory.entries.some(
        (entry) => entry.timestamp > cutoffTime,
      );
      if (!hasRecentEntries && pageHistory.entries.length === 0) {
        this.pageHistories.delete(pageId);
      }
    }

    // 🆕 Phase 3: IndexedDB 오래된 엔트리 정리 (백그라운드)
    if (this.idbAvailable) {
      (async () => {
        try {
          await this.ensureInitialized();
          await this.indexedDB.cleanupOldEntries();
        } catch (error) {
          console.error("❌ [History] Failed to cleanup IndexedDB:", error);
        }
      })();
    }
  }
}

// 싱글톤 인스턴스
export const historyManager = new HistoryManager();

// 🆕 Phase 3: IndexedDB 인스턴스 re-export (디버깅/모니터링용)
export { historyIndexedDB } from "./history/historyIndexedDB";

// 🆕 Phase 3: Diff 유틸리티 re-export
export {
  createElementDiff,
  createPropsDiff,
  applyDiffUndo,
  applyDiffRedo,
  isDiffEmpty,
  serializeDiff,
  deserializeDiff,
  estimateDiffSize,
  createBatchDiff,
  applyBatchDiffUndo,
  applyBatchDiffRedo,
} from "./utils/elementDiff";

export type {
  ElementDiff,
  PropsDiff,
  SerializableElementDiff,
  SerializablePropsDiff,
} from "./utils/elementDiff";
