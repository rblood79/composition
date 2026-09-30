import {
  createComponent,
  detachInstances,
  dissolveComponent,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  EntryId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";

/** What the Component section offers for a selected node. */
export interface CatalogComponentState {
  /** The node is an instance: of a project component or of a library component. */
  instanceOf?: {
    definitionId: string;
    name: string;
    project: boolean;
    /** Drawn instances of a project component (select-instances). */
    instanceIds: readonly NodeId[];
  };
}

/** The component state of a node (owned nodes only; a template position has none). */
export function catalogComponentState(
  graph: CatalogReader,
  id: NodeId,
): CatalogComponentState {
  const node = graph.getEntry(id);
  if (node?.kind !== "node") return {};
  const definitionId = node.definitionId;
  const project = definitionId.startsWith("project:");
  const definition = project
    ? graph.getEntry(definitionId)
    : graph.library.definitions.get(definitionId as `lib:definition:${string}`);
  if (!definition || !("mode" in definition) || definition.mode !== "composite")
    return {};
  // A library composite shows as a component only when it is a reusable origin.
  if (!project && !definitionId.startsWith("lib:definition:origin-")) return {};
  return {
    instanceOf: {
      definitionId,
      name: project
        ? (definition as { name: string }).name
        : definitionTypeName(graph, definitionId),
      project,
      instanceIds: project
        ? ([
            ...graph.instancesOf(definitionId as EntryId<"definition">),
          ] as NodeId[])
        : [],
    },
  };
}

/**
 * ADR-248 Phase 4e-4: the Component section's commands — create a component from a node (the node
 * becomes its template, an instance takes its place), detach an instance (it keeps what it
 * showed, as owned nodes), dissolve a project component (every instance detached, the definition
 * and template removed). Each is one history step.
 */
export const catalogComponentCommands = {
  create: (id: NodeId, name: string, newId: NewId): CatalogCommand =>
    createComponent({ id, name, newId }),
  detach: (id: NodeId, newId: NewId): CatalogCommand =>
    detachInstances({ ids: [id], newId }),
  dissolve: (definitionId: string, newId: NewId): CatalogCommand =>
    dissolveComponent({
      definitionId: definitionId as EntryId<"definition">,
      newId,
    }),
};
