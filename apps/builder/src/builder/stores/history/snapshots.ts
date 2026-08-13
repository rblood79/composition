/**
 * @fileoverview 히스토리 스냅샷 코어 — ADR-180 Phase 1
 *
 * 스냅샷 = canonical `CompositionDocument` 전체 캡처본 (프로젝트 스코프).
 * 선형 히스토리의 truncation (`history.ts` addEntry 의
 * `entries.slice(0, currentIndex + 1)`) 을 생존하는 명시적 복원 지점이다.
 *
 * 상한 계약 (ADR-180 R2):
 * - `kind: "user"` — 프로젝트당 {@link USER_SNAPSHOT_LIMIT} 개. 초과 시 생성
 *   **차단** (자동 삭제 금지 — 사용자 데이터).
 * - `kind: "system"` — 복원 직전 자동 캡처 (복원 undo 안전망). 프로젝트당
 *   최신 {@link SYSTEM_SNAPSHOT_ROLLING_LIMIT} 개 rolling 자동 순환 — 사용자
 *   산출물이 아니므로 자동 삭제 원칙의 예외. 참조 소실 시 R5 fallback
 *   (라벨 "(삭제됨)" + undo no-op).
 *
 * 캡처 격리: `doc` 는 JSON round-trip 사본 — canonical document 는 JSON
 * 직렬화 가능 계약 (IndexedDB persist / preview postMessage 가 이미 전제).
 * round-trip 1회로 격리 사본과 `estimatedSize` (JSON 문자 수) 를 동시에
 * 얻는다 (structuredClone + stringify 2-pass 회피 — G1 생성 비용 예산).
 */

import type { CompositionDocument } from "@composition/shared";
import { historyIndexedDB } from "./historyIndexedDB";

// ============================================
// Types
// ============================================

export interface HistorySnapshot {
  id: string;
  projectId: string;
  /** 표시 이름 — 기본 "스냅숏 N" (Photoshop 어법) */
  name: string;
  /** system = 복원 직전 자동 캡처 (user 상한 계상 제외, rolling 순환) */
  kind: "user" | "system";
  createdAt: number;
  /** canonical document 전체 캡처본 (JSON round-trip 격리 사본) */
  doc: CompositionDocument;
  /** JSON 직렬화 문자 수 — 패널 용량 표시용 근사값 */
  estimatedSize: number;
}

/** IndexedDB 계층 계약 — `historyIndexedDB` 가 구현, 테스트는 in-memory 대역 */
export interface SnapshotStorage {
  saveSnapshot(snapshot: HistorySnapshot): Promise<void>;
  getSnapshotsByProject(projectId: string): Promise<HistorySnapshot[]>;
  deleteSnapshot(id: string): Promise<void>;
}

// ============================================
// Constants
// ============================================

export const USER_SNAPSHOT_LIMIT = 10;
export const SYSTEM_SNAPSHOT_ROLLING_LIMIT = 5;

/** createSnapshot 상한 차단 식별 코드 — 패널이 catch 후 삭제 유도 안내 */
export const SNAPSHOT_LIMIT_ERROR = "SNAPSHOT_USER_LIMIT_EXCEEDED";

const DEFAULT_NAME_PREFIX = "스냅숏";

// ============================================
// Manager
// ============================================

/**
 * 스냅샷 CRUD + 상한 관리. 목록은 프로젝트별 in-memory 캐시 (최신순) 로
 * 유지하고 IndexedDB 에 write-through 한다 — `HistoryManager` 의
 * pageHistories(메모리) + saveToIndexedDB(백그라운드) 구조와 동형.
 *
 * 통지는 자체 `subscribe` 채널 — historyManager 채널과 대칭 패턴 (cross-wiring
 * 은 모듈 순환을 만들므로 패널이 양쪽을 구독한다).
 */
export class SnapshotManager {
  private storage: SnapshotStorage;
  /** projectId → 스냅샷 목록 (createdAt 내림차순 = 최신순) */
  private snapshots: Map<string, HistorySnapshot[]> = new Map();
  private loadedProjects: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();

  constructor(storage: SnapshotStorage) {
    this.storage = storage;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  private getList(projectId: string): HistorySnapshot[] {
    let list = this.snapshots.get(projectId);
    if (!list) {
      list = [];
      this.snapshots.set(projectId, list);
    }
    return list;
  }

  /**
   * IndexedDB → in-memory 캐시 hydrate (프로젝트당 1회, 패널 mount 시점).
   * 실패해도 throw 하지 않음 — 메모리 상태로 계속 동작 (historyIndexedDB
   * graceful 관례).
   */
  async loadProject(projectId: string): Promise<void> {
    if (this.loadedProjects.has(projectId)) return;
    this.loadedProjects.add(projectId);
    try {
      const stored = await this.storage.getSnapshotsByProject(projectId);
      const merged = new Map<string, HistorySnapshot>();
      for (const snapshot of stored) merged.set(snapshot.id, snapshot);
      // 로드 중 메모리에 먼저 생성된 스냅샷이 있으면 그쪽이 최신 — 덮어쓴다
      for (const snapshot of this.getList(projectId))
        merged.set(snapshot.id, snapshot);
      const list = Array.from(merged.values()).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      this.snapshots.set(projectId, list);
      this.notify();
    } catch (error) {
      console.warn("[Snapshots] loadProject 실패 (메모리로 계속):", error);
    }
  }

  /** 최신순 목록 (user + system — 패널은 kind 로 필터) */
  getSnapshots(projectId: string): HistorySnapshot[] {
    return this.getList(projectId);
  }

  getSnapshot(projectId: string, id: string): HistorySnapshot | undefined {
    return this.getList(projectId).find((snapshot) => snapshot.id === id);
  }

  canCreateUserSnapshot(projectId: string): boolean {
    return this.countUserSnapshots(projectId) < USER_SNAPSHOT_LIMIT;
  }

  countUserSnapshots(projectId: string): number {
    return this.getList(projectId).filter(
      (snapshot) => snapshot.kind === "user",
    ).length;
  }

  /**
   * 스냅샷 생성 — 문서 전체 캡처.
   *
   * @throws Error(`SNAPSHOT_LIMIT_ERROR`) user kind 상한 초과 시 (생성 차단)
   */
  async createSnapshot(options: {
    projectId: string;
    doc: CompositionDocument;
    kind: HistorySnapshot["kind"];
    name?: string;
  }): Promise<HistorySnapshot> {
    const { projectId, doc, kind } = options;
    if (kind === "user" && !this.canCreateUserSnapshot(projectId)) {
      throw new Error(SNAPSHOT_LIMIT_ERROR);
    }

    // JSON round-trip 1회 = 격리 사본 + estimatedSize 동시 획득 (모듈 주석)
    const json = JSON.stringify(doc);
    const docCopy = JSON.parse(json) as CompositionDocument;

    const snapshot: HistorySnapshot = {
      id: `snapshot_${crypto.randomUUID()}`,
      projectId,
      name: options.name ?? this.nextDefaultName(projectId),
      kind,
      createdAt: Date.now(),
      doc: docCopy,
      estimatedSize: json.length,
    };

    const list = this.getList(projectId);
    list.unshift(snapshot);

    // 백그라운드 write-through (실패해도 메모리 유지 — IDB 관례)
    void this.storage.saveSnapshot(snapshot).catch((error) => {
      console.warn("[Snapshots] saveSnapshot 실패 (메모리 유지):", error);
    });

    if (kind === "system") {
      this.rollSystemSnapshots(projectId);
    }

    this.notify();
    return snapshot;
  }

  /** system kind rolling — 최신 SYSTEM_SNAPSHOT_ROLLING_LIMIT 개 초과분 삭제 */
  private rollSystemSnapshots(projectId: string): void {
    const list = this.getList(projectId);
    const systemSnapshots = list.filter(
      (snapshot) => snapshot.kind === "system",
    );
    const excess = systemSnapshots.slice(SYSTEM_SNAPSHOT_ROLLING_LIMIT);
    if (excess.length === 0) return;
    const excessIds = new Set(excess.map((snapshot) => snapshot.id));
    this.snapshots.set(
      projectId,
      list.filter((snapshot) => !excessIds.has(snapshot.id)),
    );
    for (const snapshot of excess) {
      void this.storage.deleteSnapshot(snapshot.id).catch((error) => {
        console.warn("[Snapshots] rolling 삭제 실패:", error);
      });
    }
  }

  async renameSnapshot(
    projectId: string,
    id: string,
    name: string,
  ): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const list = this.getList(projectId);
    const index = list.findIndex((snapshot) => snapshot.id === id);
    if (index === -1) return;
    const renamed = { ...list[index], name: trimmed };
    list[index] = renamed;
    void this.storage.saveSnapshot(renamed).catch((error) => {
      console.warn("[Snapshots] rename persist 실패 (메모리 유지):", error);
    });
    this.notify();
  }

  async deleteSnapshot(projectId: string, id: string): Promise<void> {
    const list = this.getList(projectId);
    const next = list.filter((snapshot) => snapshot.id !== id);
    if (next.length === list.length) return;
    this.snapshots.set(projectId, next);
    void this.storage.deleteSnapshot(id).catch((error) => {
      console.warn("[Snapshots] deleteSnapshot persist 실패:", error);
    });
    this.notify();
  }

  /** 기본 이름 "스냅숏 N" — 기존 기본 이름의 최대 시퀀스 + 1 */
  private nextDefaultName(projectId: string): string {
    const pattern = new RegExp(`^${DEFAULT_NAME_PREFIX} (\\d+)$`);
    let max = 0;
    for (const snapshot of this.getList(projectId)) {
      const match = pattern.exec(snapshot.name);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `${DEFAULT_NAME_PREFIX} ${max + 1}`;
  }
}

// ============================================
// Singleton Instance
// ============================================

export const snapshotManager = new SnapshotManager(historyIndexedDB);
