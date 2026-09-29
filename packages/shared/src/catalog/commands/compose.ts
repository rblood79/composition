import type { NodeId } from "../document/types";
import type { CatalogGraph } from "../document/graph";
import {
  CatalogStage,
  type CatalogOperation,
  type CatalogReader,
} from "../transactions/transaction";

/**
 * ADR-248 Phase 4b: one user action as a typed command plan. A command reads the graph through a
 * `CatalogReader` (never a selection store or a document export) and returns the operations of
 * one transaction; `applyCatalogTransaction` checks the invariants and records one history entry.
 */
export interface CatalogCommandPlan {
  label: string;
  ops: readonly CatalogOperation[];
  /** Nodes to select after the commit (a created or moved node, a duplicate). */
  selectAfter?: readonly NodeId[];
}
export type CatalogCommand = (reader: CatalogReader) => CatalogCommandPlan;

/**
 * Several commands as one transaction (a multi-selection edit, a batch): each command plans
 * against the records the earlier ones staged, and the operations join in order under one label.
 * A command that throws aborts the whole plan; nothing is committed here.
 */
export function composeCommands(
  graph: CatalogGraph,
  label: string,
  commands: readonly CatalogCommand[],
): CatalogCommandPlan {
  const stage = new CatalogStage(graph);
  const ops: CatalogOperation[] = [];
  const selectAfter: NodeId[] = [];
  for (const command of commands) {
    const plan = command(stage);
    stage.apply(plan.ops);
    ops.push(...plan.ops);
    if (plan.selectAfter) selectAfter.push(...plan.selectAfter);
  }
  return { label, ops, ...(selectAfter.length ? { selectAfter } : {}) };
}
