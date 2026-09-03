import { Element, Page } from "../../types/builder/unified.types";
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
 * **ADR-124**:
 * - `data.canonicalEvents` 가 primary path. 신규 entry 는 생성 시점에
 *   canonical event 를 부착한다 (`addEntry` DEV guard).
 * - v1 IndexedDB load 는 `migrateV1EntryToV2` 가 `canonicalEvents` 로 변환한다.
 * - legacy snapshot 필드 (`element` / `prevProps` / `batchUpdates` 등) 는
 *   `HistoryEntry.data` 타입에서 제거됐다. raw IDB payload 는 migration
 *   adapter 의 `LegacyV1SnapshotData` 로만 읽는다.
 *
 * @see docs/adr/124-canonical-only-history-schema.md
 * @see apps/builder/src/builder/stores/history/historyEntryMigration.ts
 */
/**
 * ADR-177 — `page-position` entry 의 항목 (batch 지원).
 *
 * `before: null` 은 이동 전 문서/스토어 entry 부재 (undo 시 해당 breakpoint
 * entry 제거 — 스토어 위치는 유지, 문서 축만 정리).
 */
export interface PagePositionHistoryEntryItem {
  pageId: string;
  breakpoint: import("@composition/shared").BreakpointName;
  before: { x: number; y: number } | null;
  after: { x: number; y: number };
}

/**
 * ADR-181 — `page-guide` entry 의 항목 (batch 지원).
 *
 * 목록 **전체**를 before/after 로 담는다 (부분 diff 아님) — 생성/이동/삭제가
 * 한 어법으로 처리되고, `setPageGuides` 의 "목록 전체 교체" 계약과 1:1 이다.
 *
 * `page-position` 과 달리 **null 이 없다**. 문서에서 entry 부재와 빈 목록이
 * 구분되지 않기 때문이다 (C9 — `setPageGuides` 가 빈 목록을 받으면 entry 를
 * 지우고, hydrate 는 부재를 빈 목록으로 읽는다). 따라서 `[]` 하나로 충분하다.
 */
export interface PageGuideHistoryEntryItem {
  pageId: string;
  breakpoint: import("@composition/shared").BreakpointName;
  before: import("@composition/shared").PageGuideLine[];
  after: import("@composition/shared").PageGuideLine[];
}

/**
 * ADR-185 G-1 수리 — `page-lifecycle` entry 의 detach 치환쌍.
 *
 * 페이지 삭제는 삭제 페이지의 origin 을 참조하던 **다른 페이지의 instance**
 * 를 detached 사본으로 치환한다 (`removePageLocal` 의 auto-detach).
 * `replacements[0]` 은 detached root 로 `previous` 와 **같은 id** 를 가지며,
 * 이후 요소들은 detach 로 실체화된 descendants 다. undo 는 이 쌍을 역적용
 * (root 를 instance 원형으로 복귀 + descendants 제거) 한다.
 */
export interface PageLifecycleDetachPair {
  previous: Element;
  replacements: Element[];
}

/**
 * ADR-185 G-1 수리 — `page-lifecycle` entry payload (페이지 생성/삭제).
 *
 * 비-element 축 (page-position/page-guide 동형 — undo/redo 는 element 경로
 * 진입 전 early-branch). 페이지 행 + 소속 요소 subtree + detach 치환쌍 +
 * breakpoint 별 위치 + 활성 페이지 전환을 한 entry 로 되돌린다.
 * canonical element 정렬은 page shell bridge (BuilderCore — pages 토폴로지
 * 구독) 가 live 경로와 동일하게 수행한다.
 */
export interface PageLifecycleHistoryPayload {
  action: "create" | "delete";
  /** `pages` 배열 내 원위치 — 복원 시 삽입 지점 */
  pageIndex: number;
  page: Page;
  /** 페이지 소속 요소 전체 (canonical 파생 순서) — create 는 [body] */
  subtreeElements: Element[];
  /** delete 전용 — auto-detach 치환쌍 (create 는 빈 배열) */
  detach: PageLifecycleDetachPair[];
  /** breakpoint 별 페이지 위치 (delete: 제거 전 스냅샷 / create: 부여 위치) */
  positions: Array<{
    breakpoint: import("@composition/shared").BreakpointName;
    position: { x: number; y: number };
  }>;
  /** mutation 직전/직후 활성 페이지 — undo/redo 의 활성 복원 기준 */
  prevCurrentPageId: string | null;
  nextCurrentPageId: string | null;
}

export interface HistoryEntry {
  id: string;
  type:
    | "add"
    | "update"
    | "remove"
    | "move"
    | "batch"
    | "group"
    | "ungroup"
    | "page-title"
    | "page-position"
    | "page-guide"
    | "page-lifecycle"
    | "snapshot-restore";
  /**
   * element 노드 id — `page-position` entry 는 첫 pageId 를 넣는다 (소비자
   * 미해석 무해값, ADR-177 breakdown §5 C5).
   */
  elementId: string;
  elementIds?: string[]; // For multi-element operations
  data: {
    /** group/ungroup 메타 (canonical 직접 표현 불가) — 유지. */
    groupData?: { groupId: string; childIds: string[] };
    /** Diff-based storage — size 추정용 유지, undo/redo 경로는 canonicalEvents 우선. */
    diff?: SerializableElementDiff;
    /** Diff-based storage (batch) — size 추정용 유지. */
    diffs?: SerializableElementDiff[];
    /** **ADR-124 primary** — canonical event sequence (apply 우선 path). */
    canonicalEvents?: CanonicalHistoryNodeEvent[];
    /** Page root node `name` + Builder page mirror title rename. */
    pageTitleEvent?: {
      pageId: string;
      before: string;
      after: string;
    };
    /**
     * **ADR-177** — `type: "page-position"` 전용 payload. element 노드 이벤트
     * (`CanonicalHistoryNodeEvent`) 와 별개 축 — undo/redo 는 element 경로
     * 진입 전 early-branch 로 처리한다 (`historyActions.ts`).
     */
    pagePositionEvent?: { entries: PagePositionHistoryEntryItem[] };
    /**
     * **ADR-181** — `type: "page-guide"` 전용 payload. `pagePositionEvent` 와
     * 같은 비-element 축 (undo/redo 는 element 경로 진입 전 early-branch).
     * 스토어 미러가 없어 canonical `pageGuides` 만 갱신한다 —
     * `pagePositionEvent` 가 스토어 스냅샷을 함께 되돌리는 것과 갈리는 지점.
     */
    pageGuideEvent?: { entries: PageGuideHistoryEntryItem[] };
    /**
     * **ADR-180** — `type: "snapshot-restore"` 전용 payload. 직렬화 본 없이
     * 스냅샷 참조 id 만 담는다 (undo = before / redo = after 재적용 —
     * `snapshotRestore.ts` early-branch). `snapshotName` 은 라벨용 사본 —
     * 스냅샷 삭제 후에도 라벨 유지 (R5).
     */
    snapshotRestoreEvent?: {
      beforeSnapshotId: string;
      afterSnapshotId: string;
      snapshotName: string;
    };
    /**
     * **ADR-185 G-1** — `type: "page-lifecycle"` 전용 payload (페이지 생성/
     * 삭제). 비-element 축 early-branch. 적용이 활성 페이지를 바꾸면 entry 는
     * `migrateEntryToPage` 로 새 활성 페이지 스택으로 이관된다 — history 가
     * 페이지별 스택이라 이관 없이는 반대 방향 (redo↔undo) 이 도달 불가.
     */
    pageLifecycleEvent?: PageLifecycleHistoryPayload;
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

function isThenable(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
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
  /** 트랜잭션 중첩 깊이 — 0 이면 트랜잭션 없음 */
  private transactionDepth = 0;
  /** 트랜잭션 중 모은 canonical event (시간순) */
  private transactionBuffer: CanonicalHistoryNodeEvent[] = [];
  private transactionMeta: {
    type: HistoryEntry["type"];
    elementId: string;
  } | null = null;
  /** 창이 열린 채 이벤트 루프에 양보했는가 (커밋 시 경고) */
  private transactionYielded = false;

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
  /** 현재 history 스택의 pageId — page-lifecycle 이관 출발 스택 판정용 (ADR-185) */
  getCurrentPageId(): string | null {
    return this.currentPageId;
  }

  /**
   * ADR-185 G-1 — page-lifecycle entry 를 적용 후 활성 페이지 스택으로 이관.
   *
   * history 는 페이지별 스택이라, 적용이 활성 페이지를 바꾸는 entry 는 이관
   * 없이는 반대 방향 (undo 후 redo / redo 후 undo) 이 항상 도달 불가가 된다.
   *
   * placement:
   * - `"redoable"` — undo 적용 후: 대상 스택의 다음 redo 위치 (currentIndex+1)
   * - `"done"` — redo 적용 후: 대상 스택의 마지막 완료 entry
   *
   * 양쪽 모두 대상 스택의 기존 redo tail 은 잘린다 (addEntry 의 선형
   * truncation 과 동일 규칙 — 전역 타임라인이 그 분기에서 갈라졌다).
   */
  migrateEntryToPage(
    entryId: string,
    fromPageId: string,
    toPageId: string,
    placement: "done" | "redoable",
  ): void {
    if (fromPageId === toPageId) return;
    const from = this.pageHistories.get(fromPageId);
    if (!from) return;
    const idx = from.entries.findIndex((entry) => entry.id === entryId);
    if (idx < 0) return;

    const [entry] = from.entries.splice(idx, 1);
    if (idx <= from.currentIndex) from.currentIndex--;

    if (!this.pageHistories.has(toPageId)) {
      this.pageHistories.set(toPageId, {
        entries: [],
        currentIndex: -1,
        maxSize: this.defaultMaxSize,
      });
    }
    const to = this.pageHistories.get(toPageId)!;
    to.entries = to.entries.slice(0, to.currentIndex + 1);
    to.entries.push(entry);
    if (placement === "done") {
      to.currentIndex = to.entries.length - 1;
    }
    // "redoable" 은 currentIndex 유지 — entry 가 currentIndex+1 (다음 redo)

    if (this.idbAvailable) {
      void (async () => {
        try {
          await this.ensureInitialized();
          await this.indexedDB.deleteEntry(entry.id);
          await this.indexedDB.saveEntry(toPageId, entry);
          await this.indexedDB.savePageMeta(
            fromPageId,
            from.currentIndex,
            from.entries.length,
          );
          await this.indexedDB.savePageMeta(
            toPageId,
            to.currentIndex,
            to.entries.length,
          );
        } catch (error) {
          console.error("❌ [History] migrateEntryToPage IDB sync:", error);
        }
      })();
    }

    this.notifyListeners();
  }

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
  /**
   * 트랜잭션 시작 — 커밋까지의 모든 `addEntry` 를 **엔트리 1개**로 병합한다.
   *
   * 한 번의 사용자 조작이 여러 mutation 으로 나뉘는 경우(프리셋 적용 = 슬롯 제거 +
   * 슬롯 삽입 + body props + body responsive)에 쓴다. mutation 함수를 고치지 않고
   * 호출부에서 감싸는 방식이라 어느 조합에도 적용된다.
   *
   * 병합이 성립하는 근거: undo/redo 적용부(`applyCanonicalHistoryEventsToDocument`)가
   * canonicalEvents 를 direction 에 따라 **역순 + 역연산** 으로 처리하므로, 시간순으로
   * 이어 붙인 event 배열이 그대로 하나의 되돌리기 단위가 된다. `entry.type` 은
   * canonicalEvents 가 있으면 apply·DB sync 양쪽에서 우회되므로 병합 엔트리의 타입은
   * 표시용이다.
   *
   * 중첩은 depth 로 흡수한다 — 최외곽 커밋에서만 엔트리가 생긴다.
   *
   * **창은 동기여야 한다.** 병합은 "창이 열린 동안의 모든 addEntry" 를 대상으로 하므로,
   * 창 안에서 `await` 로 양보하면 그 틈에 일어난 무관한 mutation (캔버스 조작 / 다른
   * 패널 편집) 까지 같은 되돌리기 단위로 빨려 들어간다. 반대로 양보 지점이 없으면 JS
   * 단일 스레드가 상호배제를 제공하므로 간섭이 구조적으로 불가능하다 — 별도 mutation
   * 큐가 필요 없는 이유다. 직접 호출보다 {@link runInTransaction} 을 쓰는 것을 권장한다.
   */
  beginTransaction(meta: {
    type: HistoryEntry["type"];
    elementId: string;
  }): void {
    if (this.transactionDepth === 0) {
      this.transactionBuffer = [];
      this.transactionMeta = meta;
      this.transactionYielded = false;

      // 양보 감지: microtask 는 동기 스택이 비워질 때 실행된다. 창이 begin→commit
      // 동기라면 이 콜백은 커밋 **뒤**에 돌아 깃발을 세우지 못한다. 콜백 시점에 창이
      // 아직 열려 있다는 것은 창이 양보했다는 뜻이고, 그 틈의 외부 mutation 이 이미
      // 병합됐을 수 있다.
      //
      // 세대 비교가 필요 없는 이유: 깃발은 매 최외곽 begin 에서 초기화되고, 이 콜백은
      // 자신이 큐에 들어간 tick 이 끝날 때 돈다. 그때 열려 있는 창은 같은 창이거나
      // (참 양보) 같은 tick 에 새로 열려 tick 경계를 넘긴 창인데 — 후자도 실제로
      // 양보한 창이므로 오탐이 아니다.
      queueMicrotask(() => {
        if (this.transactionDepth > 0) {
          this.transactionYielded = true;
        }
      });
    }
    this.transactionDepth += 1;
  }

  /**
   * 동기 트랜잭션 실행 — `fn` 안에서 일어난 mutation 이 되돌리기 엔트리 1개가 된다.
   *
   * 여닫기를 한 곳에 모아 `finally` 누락으로 창이 열린 채 남는 사고를 없앤다. `fn` 은
   * **동기**여야 한다 (위 {@link beginTransaction} 주석의 근거) — 비동기 꼬리는 `fn` 이
   * Promise 배열을 반환하고 호출부가 창 **밖**에서 기다리는 형태로 분리한다.
   */
  runInTransaction<T>(
    meta: { type: HistoryEntry["type"]; elementId: string },
    fn: () => T,
  ): T {
    this.beginTransaction(meta);
    try {
      const result = fn();
      if (isThenable(result)) {
        // async 콜백은 첫 await 에서 창을 닫아버린다 — 뒤쪽 mutation 은 병합되지
        // 않고, 그 사이 외부 mutation 이 끼어들 수 있다.
        console.warn(
          "[History] runInTransaction: 콜백이 Promise 를 반환했다 — 창이 동기가 " +
            "아니므로 병합 범위가 첫 await 까지로 잘린다. 동기 콜백 + 창 밖 await 로 " +
            "바꿀 것:",
          meta.type,
          meta.elementId,
        );
      }
      return result;
    } finally {
      this.commitTransaction();
    }
  }

  /**
   * 트랜잭션 커밋 — 버퍼가 비어 있으면 아무 엔트리도 만들지 않는다.
   *
   * **호출부는 `finally` 에서 부르는 것을 권장한다** (abort 아님): 예외나 조기 return
   * 으로 중단돼도 그 시점까지 **실제로 일어난** mutation 은 되돌릴 수 있어야 한다.
   * 버려버리면 기록 없는 변경이 남는다.
   */
  commitTransaction(): void {
    if (this.transactionDepth === 0) {
      console.warn("[History] commitTransaction: 열린 트랜잭션 없음");
      return;
    }
    this.transactionDepth -= 1;
    if (this.transactionDepth > 0) return; // 중첩 — 최외곽에서만 확정

    const events = this.transactionBuffer;
    const meta = this.transactionMeta;
    const yielded = this.transactionYielded;
    this.transactionBuffer = [];
    this.transactionMeta = null;
    this.transactionYielded = false;

    if (yielded) {
      // 창이 양보했으므로 이 엔트리에 무관한 mutation 이 섞여 있을 수 있다. 상태는
      // 시간순 역연산이라 여전히 정합하지만, 되돌리기 **단위**가 사용자 조작 1회와
      // 어긋난다. 사후 분리는 불가(어느 event 가 외부 것인지 알 수 없음) — 드러낸다.
      console.warn(
        "[History] 트랜잭션 창이 이벤트 루프에 양보했다 — 창 안의 무관한 mutation 이 " +
          "같은 되돌리기 엔트리로 병합됐을 수 있다. 창 안에서는 await 하지 말 것:",
        meta?.type,
        meta?.elementId,
      );
    }

    if (!events.length || !meta) return;
    this.addEntry({
      type: meta.type,
      elementId: meta.elementId,
      data: { canonicalEvents: events },
    });
  }

  /** 열린 트랜잭션이 있는가 (테스트/진단용). */
  hasOpenTransaction(): boolean {
    return this.transactionDepth > 0;
  }

  addEntry(entry: Omit<HistoryEntry, "id" | "timestamp">): void {
    // 트랜잭션 중이면 엔트리를 만들지 않고 event 만 모은다.
    // depth 를 먼저 0 으로 만든 뒤 addEntry 를 부르는 commitTransaction 은 여기에
    // 걸리지 않는다.
    if (this.transactionDepth > 0) {
      const events = entry.data.canonicalEvents;
      if (events?.length) {
        this.transactionBuffer.push(...events);
      } else {
        // canonicalEvents 없는 entry 는 병합할 수 없다 — 조용히 삼키면 그 변경이
        // 되돌리기 불가가 되므로 드러낸다.
        console.warn(
          "[History] 트랜잭션 중 canonicalEvents 없는 entry — 병합 불가로 누락:",
          entry.type,
          entry.elementId,
        );
      }
      return;
    }

    if (!this.currentPageId) {
      console.warn("[History] addEntry skipped: no currentPageId");
      return;
    }

    // 회귀 감지 (DEV 전용): element 축 신규 entry 는 canonicalEvents 필수 —
    // 미부착 entry 는 undo 시 legacy full-replace fallback 을 유발한다.
    // page-position(ADR-177)/page-guide(ADR-181)/snapshot-restore(ADR-180) 는
    // 비-element 축 전용 payload 라 대상 아님.
    if (
      import.meta.env?.DEV &&
      entry.type !== "page-position" &&
      entry.type !== "page-guide" &&
      entry.type !== "page-title" &&
      entry.type !== "page-lifecycle" &&
      entry.type !== "snapshot-restore" &&
      !entry.data.canonicalEvents?.length
    ) {
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
   * 지정 페이지를 제외한 모든 페이지 히스토리 초기화 — ADR-180 복원 시퀀스
   * 5단계 (R4: 문서 전체 교체가 타 페이지 delta 의 전제 상태를 무효화하므로
   * stale delta 적용을 차단). 반환값은 clear 된 pageId 목록 (보고용).
   *
   * `additionalPageIds` — 호출부가 아는 프로젝트 페이지 전수. 페이지 히스토리는
   * lazy 로드라 `pageHistories` 키만 순회하면 **이 세션에서 방문하지 않은
   * 페이지가 빠진다** — IndexedDB 잔존분이 재방문 시 부활해 R4 가 뚫린다
   * (2026-08-13 live 실측: 복원 후 미방문 Page 4 히스토리 50건 부활).
   * `clearPageHistory` 는 미로드 페이지에도 안전하다 (메모리 delete 는 no-op,
   * IndexedDB 삭제는 pageId 직접).
   */
  clearOtherPageHistories(
    keepPageId: string,
    additionalPageIds?: Iterable<string>,
  ): string[] {
    const targets = new Set(this.pageHistories.keys());
    if (additionalPageIds) {
      for (const pageId of additionalPageIds) targets.add(pageId);
    }
    targets.delete(keepPageId);
    const cleared: string[] = [];
    for (const pageId of targets) {
      cleared.push(pageId);
      this.clearPageHistory(pageId);
    }
    return cleared;
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
