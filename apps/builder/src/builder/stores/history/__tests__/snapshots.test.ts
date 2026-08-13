/**
 * ADR-180 Phase 1 — 스냅샷 코어 CRUD + 상한 계약.
 *
 * SnapshotStorage 는 in-memory 대역 — IndexedDB 계층은 historyIndexedDB 가
 * 동일 시그니처로 구현 (G4 영속 게이트는 live 검증).
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import {
  SnapshotManager,
  SNAPSHOT_LIMIT_ERROR,
  SYSTEM_SNAPSHOT_ROLLING_LIMIT,
  USER_SNAPSHOT_LIMIT,
  type HistorySnapshot,
  type SnapshotStorage,
} from "../snapshots";

function makeDoc(label = "Click"): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        props: { layoutType: "page" },
        children: [
          {
            id: "body-1",
            type: "frame",
            props: { background: "#fff" },
            children: [
              {
                id: "button-1",
                type: "Button",
                props: { label, variant: "primary", size: "md" },
              },
            ],
          },
        ],
      },
    ],
  };
}

class InMemoryStorage implements SnapshotStorage {
  saved = new Map<string, HistorySnapshot>();
  deletedIds: string[] = [];

  async saveSnapshot(snapshot: HistorySnapshot): Promise<void> {
    this.saved.set(snapshot.id, snapshot);
  }

  async getSnapshotsByProject(projectId: string): Promise<HistorySnapshot[]> {
    return Array.from(this.saved.values())
      .filter((snapshot) => snapshot.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteSnapshot(id: string): Promise<void> {
    this.deletedIds.push(id);
    this.saved.delete(id);
  }
}

const PROJECT = "project-1";

describe("SnapshotManager — 생성/이름/정렬", () => {
  let storage: InMemoryStorage;
  let manager: SnapshotManager;

  beforeEach(() => {
    storage = new InMemoryStorage();
    manager = new SnapshotManager(storage);
  });

  it("기본 이름은 '스냅숏 N' 시퀀스 (최대 시퀀스 + 1)", async () => {
    const first = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "user",
    });
    const second = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "user",
    });
    expect(first.name).toBe("스냅숏 1");
    expect(second.name).toBe("스냅숏 2");

    await manager.deleteSnapshot(PROJECT, second.id);
    const third = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "user",
    });
    expect(third.name).toBe("스냅숏 2");
  });

  it("목록은 최신순 + write-through 저장 + estimatedSize > 0", async () => {
    const first = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "user",
    });
    const second = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "user",
    });

    const list = manager.getSnapshots(PROJECT);
    expect(list.map((snapshot) => snapshot.id)).toEqual([second.id, first.id]);
    expect(storage.saved.has(first.id)).toBe(true);
    expect(first.estimatedSize).toBeGreaterThan(0);
  });

  it("캡처본은 원본 doc mutation 으로부터 격리된다", async () => {
    const doc = makeDoc("Before");
    const snapshot = await manager.createSnapshot({
      projectId: PROJECT,
      doc,
      kind: "user",
    });

    const button = doc.children[0]?.children?.[0]?.children?.[0];
    if (button?.props) button.props.label = "After";

    const capturedButton =
      snapshot.doc.children[0]?.children?.[0]?.children?.[0];
    expect(capturedButton?.props?.label).toBe("Before");
  });
});

describe("SnapshotManager — 상한 계약 (ADR-180 R2)", () => {
  let storage: InMemoryStorage;
  let manager: SnapshotManager;

  beforeEach(() => {
    storage = new InMemoryStorage();
    manager = new SnapshotManager(storage);
  });

  it(`user 상한 ${USER_SNAPSHOT_LIMIT} 초과 시 생성 차단 (자동 삭제 없음)`, async () => {
    for (let i = 0; i < USER_SNAPSHOT_LIMIT; i++) {
      await manager.createSnapshot({
        projectId: PROJECT,
        doc: makeDoc(),
        kind: "user",
      });
    }
    expect(manager.canCreateUserSnapshot(PROJECT)).toBe(false);
    await expect(
      manager.createSnapshot({
        projectId: PROJECT,
        doc: makeDoc(),
        kind: "user",
      }),
    ).rejects.toThrow(SNAPSHOT_LIMIT_ERROR);
    expect(manager.countUserSnapshots(PROJECT)).toBe(USER_SNAPSHOT_LIMIT);
    expect(storage.deletedIds).toEqual([]);
  });

  it("system kind 는 user 상한 계상에서 제외된다", async () => {
    for (let i = 0; i < USER_SNAPSHOT_LIMIT; i++) {
      await manager.createSnapshot({
        projectId: PROJECT,
        doc: makeDoc(),
        kind: "user",
      });
    }
    const system = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "system",
      name: "복원 전 자동 저장",
    });
    expect(system.kind).toBe("system");
    expect(manager.countUserSnapshots(PROJECT)).toBe(USER_SNAPSHOT_LIMIT);
  });

  it(`system rolling ${SYSTEM_SNAPSHOT_ROLLING_LIMIT} — 초과분은 가장 오래된 system 부터 자동 삭제, user 는 무영향`, async () => {
    const user = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "user",
    });

    const systemIds: string[] = [];
    for (let i = 0; i < SYSTEM_SNAPSHOT_ROLLING_LIMIT + 1; i++) {
      const snapshot = await manager.createSnapshot({
        projectId: PROJECT,
        doc: makeDoc(),
        kind: "system",
        name: `복원 전 ${i}`,
      });
      systemIds.push(snapshot.id);
    }

    const list = manager.getSnapshots(PROJECT);
    const systemInList = list.filter((snapshot) => snapshot.kind === "system");
    expect(systemInList).toHaveLength(SYSTEM_SNAPSHOT_ROLLING_LIMIT);
    // 가장 오래된 system(첫 생성) 만 삭제됨
    expect(storage.deletedIds).toEqual([systemIds[0]]);
    // user 는 잔존
    expect(list.some((snapshot) => snapshot.id === user.id)).toBe(true);
  });
});

describe("SnapshotManager — rename/delete/hydrate/subscribe", () => {
  let storage: InMemoryStorage;
  let manager: SnapshotManager;

  beforeEach(() => {
    storage = new InMemoryStorage();
    manager = new SnapshotManager(storage);
  });

  it("rename 은 목록 + storage 양쪽 반영, 공백 이름은 무시", async () => {
    const snapshot = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "user",
    });
    await manager.renameSnapshot(PROJECT, snapshot.id, "로그인 화면 v1");
    expect(manager.getSnapshot(PROJECT, snapshot.id)?.name).toBe(
      "로그인 화면 v1",
    );
    expect(storage.saved.get(snapshot.id)?.name).toBe("로그인 화면 v1");

    await manager.renameSnapshot(PROJECT, snapshot.id, "   ");
    expect(manager.getSnapshot(PROJECT, snapshot.id)?.name).toBe(
      "로그인 화면 v1",
    );
  });

  it("delete 는 목록 제거 + storage 삭제", async () => {
    const snapshot = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "user",
    });
    await manager.deleteSnapshot(PROJECT, snapshot.id);
    expect(manager.getSnapshots(PROJECT)).toHaveLength(0);
    expect(storage.deletedIds).toContain(snapshot.id);
  });

  it("loadProject 는 storage 를 최신순으로 hydrate 하고 메모리 항목과 merge 한다", async () => {
    const stored: HistorySnapshot = {
      id: "snapshot_stored",
      projectId: PROJECT,
      name: "이전 세션",
      kind: "user",
      createdAt: 1000,
      doc: makeDoc(),
      estimatedSize: 10,
    };
    storage.saved.set(stored.id, stored);

    const fresh = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "user",
    });
    await manager.loadProject(PROJECT);

    const list = manager.getSnapshots(PROJECT);
    expect(list.map((snapshot) => snapshot.id)).toEqual([fresh.id, stored.id]);
  });

  it("생성/삭제 시 subscribe 리스너가 통지된다", async () => {
    let notified = 0;
    const unsubscribe = manager.subscribe(() => {
      notified += 1;
    });
    const snapshot = await manager.createSnapshot({
      projectId: PROJECT,
      doc: makeDoc(),
      kind: "user",
    });
    await manager.deleteSnapshot(PROJECT, snapshot.id);
    expect(notified).toBe(2);
    unsubscribe();
  });
});
