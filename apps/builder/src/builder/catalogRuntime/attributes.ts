import { setHtmlId } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  CatalogEntry,
  CatalogReader,
  DefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogOperation } from "../../../../../packages/shared/src/catalog/transactions/transaction";

/** The graph's author DOM id index (`CatalogGraph.nodesWithHtmlId`). */
export interface CatalogHtmlIdIndex {
  nodesWithHtmlId(htmlId: string): ReadonlySet<string>;
}

/** Whether another node already uses an author DOM id. */
export function catalogHtmlIdTaken(
  index: CatalogHtmlIdIndex,
  htmlId: string,
  self: NodeId,
): boolean {
  return [...index.nodesWithHtmlId(htmlId)].some((id) => id !== self);
}

/**
 * The first free `base_N` author DOM id (the old ID check's rule: an empty id gets `type_N`, a
 * duplicate moves to the next free number of its base).
 */
export function catalogUniqueHtmlId(
  index: CatalogHtmlIdIndex,
  base: string,
  self: NodeId,
): string {
  const stem = base.replace(/_\d+$/, "");
  for (let n = 1; ; n++) {
    const candidate = `${stem}_${n}`;
    if (!catalogHtmlIdTaken(index, candidate, self)) return candidate;
  }
}

/**
 * ADR-248 Phase 4e-4: an author DOM id edit as one command, or the reason it is refused (another
 * node uses it — ids stay unique so interactions can target them). An empty id removes it.
 */
export function catalogHtmlIdCommand(
  index: CatalogHtmlIdIndex,
  node: NodeId,
  htmlId: string,
): { command: CatalogCommand } | { refused: "HTML_ID_TAKEN" } {
  const value = htmlId.trim();
  if (value && catalogHtmlIdTaken(index, value, node))
    return { refused: "HTML_ID_TAKEN" };
  return { command: setHtmlId({ id: node, htmlId: value }) };
}

const BODY_DEFINITION = "lib:definition:type-body";

/**
 * ADR-248 4e-8: the old app gave every element it created a `customId` (`{type}_{n}`, the first
 * free number), rendered as the DOM `id`. A user action's plan gets the same: each node it creates
 * (an insert, a paste, a duplicate, a group, a detach) without an author DOM id gets `type_N`, and
 * one whose id another node already uses (a pasted copy) moves to its base's next free number —
 * both written into the node's own `put`, so the id is part of the same step. A page or layout body
 * keeps none (the old page body had no `customId`).
 */
export function catalogAutoHtmlIds(
  index: CatalogHtmlIdIndex,
  command: CatalogCommand,
): CatalogCommand {
  return (reader) => {
    const plan = command(reader);
    const created = (op: CatalogOperation): op is CreatedNode =>
      op.kind === "put" &&
      op.entry.kind === "node" &&
      op.entry.definitionId !== BODY_DEFINITION &&
      !reader.getEntry(op.entry.id);
    if (!plan.ops.some(created)) return plan;
    // A reader that also sees the plan's own entries (a component created in the same step).
    const planned = new Map<string, CatalogEntry>();
    for (const op of plan.ops)
      if (op.kind === "put") planned.set(op.entry.id, op.entry);
    const view: CatalogReader = {
      projectId: reader.projectId,
      revision: reader.revision,
      library: reader.library,
      getEntry: (id) => planned.get(id) ?? reader.getEntry(id),
      ownerOf: (id) => reader.ownerOf(id),
      referrersOf: (id) => reader.referrersOf(id),
      instancesOf: (id) => reader.instancesOf(id),
    };
    const typeOf = (entry: NodeEntry) => {
      try {
        return definitionTypeName(view, entry.definitionId as DefinitionId);
      } catch {
        return "element";
      }
    };
    // The ids this plan gives, in order: a later copy of one moves on.
    const given = new Set<string>();
    const taken = (htmlId: string, self: NodeId) =>
      given.has(htmlId) || catalogHtmlIdTaken(index, htmlId, self);
    const ops = plan.ops.map((op) => {
      if (!created(op)) return op;
      const self = op.entry.id as NodeId;
      const own = op.entry.metadata?.htmlId;
      let htmlId = own;
      if (!htmlId || taken(htmlId, self)) {
        const stem = (own ?? typeOf(op.entry).toLowerCase().replace(/\s+/g, "-"))
          .replace(/_\d+$/, "");
        let n = 1;
        while (taken(`${stem}_${n}`, self)) n++;
        htmlId = `${stem}_${n}`;
      }
      given.add(htmlId);
      return htmlId === own
        ? op
        : { ...op, entry: { ...op.entry, metadata: { ...op.entry.metadata, htmlId } } };
    });
    return { ...plan, ops };
  };
}

type CreatedNode = Extract<CatalogOperation, { kind: "put" }> & {
  entry: NodeEntry;
};
