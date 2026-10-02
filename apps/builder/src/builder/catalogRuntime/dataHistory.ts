import type { DataChange, DataOp } from "@composition/shared";
import type { NodeId } from "../../../../../packages/shared/src/catalog/document/types";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  DataChangeHistoryPayload,
  DocumentBindingCommitter,
} from "../stores/utils/dataChange";
import type { CatalogExternalEffect } from "./controller";
import { catalogBindingRef } from "./dataBinding";
import { catalogBindingCommand } from "./dataBindingCommand";
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
    ops.length ? apply({ ops, origin: "user" }, { record: false }) : undefined;
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

/**
 * ADR-248 Phase 4e-5: `bind_element` of a data change (an approved AI proposal) over the catalog
 * document. The element is a drawn record (the AI read model's id) or an owned node id; a template
 * position holds no binding of its own. The change is one history entry: the saved data part its
 * outside effect, the bindings its document part (quick connect's shape); the selection stays.
 */
export function catalogDocumentBindingCommitter(
  workspace: CatalogWorkspace,
  apply: DataChangeApply,
  label: (payload: DataChangeHistoryPayload) => string = (payload) =>
    payload.change.label ?? "Edit data",
): DocumentBindingCommitter {
  const graph = () => workspace.runtime.graph;
  const nodeOf = (elementId: string) => {
    const target = workspace.positionOfRecord(elementId)?.target;
    if (target && target.kind !== "node") return undefined;
    const entry = graph().getEntry(target?.id ?? elementId);
    return entry?.kind === "node" ? entry : undefined;
  };
  return {
    has: (elementId) => nodeOf(elementId) !== undefined,
    read: (elementId) => {
      const node = nodeOf(elementId);
      return node ? { props: node.binding } : null;
    },
    commit({ payload, data, bindings }) {
      const commands: CatalogCommand[] = bindings.map(
        ({ elementId, binding }) => {
          const node = nodeOf(elementId);
          if (!node) throw new Error(`ELEMENT_NOT_FOUND: ${elementId}`);
          const ref = catalogBindingRef(binding ?? undefined);
          if (ref === null)
            throw new Error(`UNSUPPORTED_BINDING: ${elementId}`);
          return catalogBindingCommand(
            [{ kind: "node", id: node.id as NodeId }],
            ref,
          );
        },
      );
      const name = label(payload);
      const command: CatalogCommand = (reader) => {
        const { selectAfter: _selectAfter, ...plan } =
          commands.length > 1
            ? composeCommands(graph(), name, commands)
            : commands[0]!(reader);
        return { ...plan, label: name };
      };
      if (data) {
        workspace.recordExternal(name, dataChangeEffect(data, apply), command);
        return;
      }
      workspace.execute(command);
    },
  };
}
