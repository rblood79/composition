/**
 * ADR-235 Phase 5 — 스냅샷 용량 상한 (SNAPSHOT_BYTES_LIMIT).
 */
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import {
  SnapshotManager,
  SNAPSHOT_BYTES_LIMIT,
  SNAPSHOT_LIMIT_ERROR,
  type HistorySnapshot,
  type SnapshotStorage,
} from "../snapshots";

function memoryStorage(): SnapshotStorage & {
  rows: Map<string, HistorySnapshot>;
} {
  const rows = new Map<string, HistorySnapshot>();
  return {
    rows,
    async saveSnapshot(snapshot) {
      rows.set(snapshot.id, snapshot);
    },
    async getSnapshotsByProject(projectId) {
      return [...rows.values()].filter((row) => row.projectId === projectId);
    },
    async deleteSnapshot(id) {
      rows.delete(id);
    },
  };
}

/** 대략 bytes 크기의 문서 (JSON 문자 수) */
const docOf = (bytes: number) =>
  ({
    version: "composition-1.0",
    children: [],
    pad: "x".repeat(bytes),
  }) as unknown as CompositionDocument;

describe("스냅샷 용량 상한 (ADR-235 Phase 5)", () => {
  it("system 은 상한을 넘으면 오래된 system 부터 지운다", async () => {
    const storage = memoryStorage();
    const manager = new SnapshotManager(storage);
    const third = Math.floor(SNAPSHOT_BYTES_LIMIT / 3);
    const first = await manager.createSnapshot({
      projectId: "p",
      doc: docOf(third),
      kind: "system",
    });
    await manager.createSnapshot({
      projectId: "p",
      doc: docOf(third),
      kind: "system",
    });
    await manager.createSnapshot({
      projectId: "p",
      doc: docOf(third),
      kind: "system",
    });
    const ids = manager.getSnapshots("p").map((s) => s.id);
    expect(ids).not.toContain(first.id);
    const total = manager
      .getSnapshots("p")
      .reduce((sum, s) => sum + s.estimatedSize, 0);
    expect(total).toBeLessThanOrEqual(SNAPSHOT_BYTES_LIMIT);
  });

  it("user 는 상한을 넘으면 만들지 않는다 (삭제 유도)", async () => {
    const manager = new SnapshotManager(memoryStorage());
    const half = Math.floor(SNAPSHOT_BYTES_LIMIT * 0.6);
    await manager.createSnapshot({
      projectId: "p",
      doc: docOf(half),
      kind: "user",
    });
    await expect(
      manager.createSnapshot({
        projectId: "p",
        doc: docOf(half),
        kind: "user",
      }),
    ).rejects.toThrow(SNAPSHOT_LIMIT_ERROR);
    expect(manager.getSnapshots("p")).toHaveLength(1);
  });
});
