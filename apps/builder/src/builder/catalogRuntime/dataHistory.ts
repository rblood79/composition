import type {
  DataChange,
  DataOp,
} from "@composition/shared";
import type { DataChangeHistoryPayload } from "../stores/utils/dataChange";
import type { CatalogExternalEffect } from "./controller";
import type { CatalogWorkspace } from "./workspace";

/** Re-applies data ops without recording (the data store's `applyDataChange`, `record: false`). */
export type DataChangeApply = (
  change: DataChange,
  options: { record: false },
) => Promise<unknown>;

/**
 * ADR-248 Phase 4e-4e: a recorded data change (collections · fields · rows · API · variables — the
 * data store, H1) as an outside effect of the document's single history: undo re-applies its
 * inverse ops, redo its ops (as the old history manager's data branch did, origin `user`).
 */
export function dataChangeEffect(
  payload: DataChangeHistoryPayload,
  apply: DataChangeApply,
): CatalogExternalEffect {
  const run = (ops: DataOp[]) =>
    ops.length
      ? apply({ ops, origin: "user" }, { record: false })
      : undefined;
  return {
    undo: () => run(payload.inverse),
    redo: () => run(payload.change.ops),
  };
}

/**
 * The recorder the data store calls: each recorded data change becomes one history entry, named by
 * `label` (the History panel's data labels).
 */
export function catalogDataHistoryRecorder(
  workspace: CatalogWorkspace,
  apply: DataChangeApply,
  label: (payload: DataChangeHistoryPayload) => string = (payload) =>
    payload.change.label ?? "Edit data",
): (payload: DataChangeHistoryPayload) => void {
  return (payload) =>
    workspace.recordExternal(label(payload), dataChangeEffect(payload, apply));
}
