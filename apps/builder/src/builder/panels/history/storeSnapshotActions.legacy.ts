/**
 * ADR-248 Phase 4e-7: the old store's snapshots as the header menu's snapshot actions — the old
 * `BuilderCore` passes them. It goes with the old Builder.
 */
import type { HeaderSnapshotActions } from "../../main/headerMenu/headerMenuActions";
import { snapshotManager } from "../../stores/history/snapshots";
import {
  createUserSnapshot,
  resolveUserSnapshotTarget,
} from "./userSnapshotActions";

export function createStoreSnapshotActions(
  projectId: string | undefined,
): HeaderSnapshotActions {
  return {
    canCreate: () => resolveUserSnapshotTarget() !== null,
    create: () => {
      const target = resolveUserSnapshotTarget();
      if (target) void createUserSnapshot(target);
    },
    // 상한 판정은 IndexedDB 목록 hydrate 뒤에 맞다 — 구독하면서 받아 둔다.
    subscribe: (listener) => {
      const unsubscribe = snapshotManager.subscribe(listener);
      if (projectId) void snapshotManager.loadProject(projectId);
      return unsubscribe;
    },
  };
}
