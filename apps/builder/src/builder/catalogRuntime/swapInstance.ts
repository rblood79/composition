import {
  planSwapInstance,
  swapInstance,
  type SwapInstanceReport,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  assertNestable,
  CommandDraft,
  definitionTypeName,
  locate,
} from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  CatalogReader,
  DefinitionId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { getPaletteItems } from "../panels/components/paletteItems";
import { catalogPaletteDefinitionId } from "./paletteInsert";

/** One component an instance can show instead (ADR-261 Decision 2 — user decisions 3 · 5). */
export interface CatalogSwapCandidate {
  definitionId: DefinitionId;
  label: string;
  /** `related` = the same root type; `local` = a project component; `library` = a built-in one. */
  group: "related" | "local" | "library";
}

const typeOf = (graph: CatalogReader, id: string): string | undefined => {
  try {
    return definitionTypeName(graph, id as DefinitionId);
  } catch {
    return undefined;
  }
};

/**
 * What a node can be swapped to: every project component (Local) and every palette component
 * (Library), the current one left out; the ones of the same root type come first (user decision
 * 3 — 「전체 검색 + 맨 위 관련」). Layouts are not components.
 */
export function catalogSwapCandidates(
  graph: CatalogReader,
  nodeId: NodeId,
): CatalogSwapCandidate[] {
  const node = graph.getEntry(nodeId);
  if (node?.kind !== "node") return [];
  const current = node.definitionId;
  const currentType = typeOf(graph, current);
  // Only what can stand where the node stands (the swap's own nesting check — review h2).
  const draft = new CommandDraft(graph);
  let parent: ReturnType<typeof locate>["parent"];
  try {
    parent = locate(draft, nodeId).parent;
  } catch {
    return [];
  }
  const fits = (definitionId: string) => {
    try {
      assertNestable(draft, parent, [definitionId as DefinitionId]);
      return true;
    } catch {
      return false;
    }
  };
  const seen = new Set<string>([current]);
  const candidates: CatalogSwapCandidate[] = [];
  const add = (
    definitionId: string,
    label: string,
    group: "local" | "library",
  ) => {
    if (seen.has(definitionId)) return;
    seen.add(definitionId);
    if (!fits(definitionId)) return;
    candidates.push({
      definitionId: definitionId as DefinitionId,
      label,
      group:
        currentType !== undefined && typeOf(graph, definitionId) === currentType
          ? "related"
          : group,
    });
  };
  const project = graph.getEntry(graph.projectId);
  if (project?.kind === "project")
    for (const id of project.definitionIds) {
      const definition = graph.getEntry(id);
      if (definition?.kind === "definition" && definition.usage !== "layout")
        add(id, definition.name, "local");
    }
  for (const item of getPaletteItems()) {
    if (item.layoutOnly) continue;
    const definitionId = catalogPaletteDefinitionId(graph.library, item.type);
    if (graph.library.definitions.has(definitionId))
      add(definitionId, item.label, "library");
  }
  const order = { related: 0, local: 1, library: 2 } as const;
  return candidates.sort((a, b) => order[a.group] - order[b.group]);
}

/** The swap as one command, with what it keeps, drops and moves out (the notice). */
export function catalogSwapPlan(
  graph: CatalogReader,
  nodeId: NodeId,
  definitionId: DefinitionId,
): { command: CatalogCommand; report: SwapInstanceReport } {
  const { report } = planSwapInstance(graph, { id: nodeId, definitionId });
  return { command: swapInstance({ id: nodeId, definitionId }), report };
}

// The Canvas menu's 「Swap instance…」 opens the Design panel's picker for its node. The panel may
// mount after the request (it was closed): the request waits until a picker takes it.
const listeners = new Set<(nodeId: NodeId) => void>();
let pending: NodeId | undefined;
export function requestCatalogSwap(nodeId: NodeId): void {
  pending = nodeId;
  for (const listener of [...listeners]) listener(nodeId);
}
/** The waiting request for `nodeId` (taken once), or false. */
export function takeCatalogSwapRequest(nodeId: NodeId): boolean {
  if (pending !== nodeId) return false;
  pending = undefined;
  return true;
}
export function subscribeCatalogSwapRequest(
  listener: (nodeId: NodeId) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
