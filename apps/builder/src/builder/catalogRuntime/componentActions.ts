import {
  createComponent,
  detachInstances,
  dissolveComponent,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import {
  catalogDefinitionTitle,
  isLibraryOrigin,
  ORIGIN_VIEW_NODE,
} from "./originView";
import type {
  CatalogReader,
  EntryId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";

/** A component the selected node is an instance or the origin of. */
export interface CatalogComponentRef {
  definitionId: string;
  name: string;
  /** A project component (else a built-in library origin). */
  project: boolean;
  /** The component's instances in the document (select-instances). */
  instanceIds: readonly NodeId[];
}
/** What the Component section offers for a selected node. */
export interface CatalogComponentState {
  /** The node is an instance: of a project component or of a library component origin. */
  instanceOf?: CatalogComponentRef;
  /**
   * The node is the origin the definition edit view shows: a project component's template root,
   * or the sample of a built-in origin.
   */
  originOf?: CatalogComponentRef;
}

/** The definition a component: a project component (not a layout) or a built-in library origin. */
function componentDefinition(graph: CatalogReader, definitionId: string) {
  const project = definitionId.startsWith("project:");
  const definition = project
    ? graph.getEntry(definitionId)
    : graph.library.definitions.get(definitionId as `lib:definition:${string}`);
  if (!definition || !("mode" in definition) || definition.mode !== "composite")
    return undefined;
  // A library composite shows as a component only when it is a reusable origin.
  if (!project && !isLibraryOrigin(definitionId)) return undefined;
  // A layout is not a component (Layouts tab).
  if (project && (definition as { usage?: string }).usage === "layout")
    return undefined;
  return { definition, project };
}

function componentRef(
  graph: CatalogReader,
  definitionId: string,
): CatalogComponentRef | undefined {
  const found = componentDefinition(graph, definitionId);
  if (!found) return undefined;
  const { definition, project } = found;
  return {
    definitionId,
    name: project
      ? (definition as { name: string }).name
      : catalogDefinitionTitle(
          graph,
          definitionId as `lib:definition:${string}`,
        ),
    project,
    instanceIds: [...graph.instancesOf(definitionId)] as NodeId[],
  };
}

/** The component state of a node (owned nodes only; a template position has none). */
export function catalogComponentState(
  graph: CatalogReader,
  id: NodeId,
  /** The definition edit view open now: its root is that component's origin. */
  definitionView?: string,
): CatalogComponentState {
  const node = graph.getEntry(id);
  if (node?.kind !== "node") return {};
  if (definitionView) {
    const viewed = graph.getEntry(definitionView);
    const origin =
      id === ORIGIN_VIEW_NODE ||
      (viewed?.kind === "definition" && viewed.templateRootId === id);
    if (origin) {
      const originOf = componentRef(graph, definitionView);
      return originOf ? { originOf } : {};
    }
  }
  const instanceOf = componentRef(graph, node.definitionId);
  return instanceOf ? { instanceOf } : {};
}

/**
 * The editing role the Canvas chrome colors a node with (the old `getEditingSemanticsRole`): the
 * origin the definition edit view shows, or an instance of a component — the same test as the
 * Component section (`catalogComponentState`), without its instance list.
 */
export function catalogComponentRole(
  graph: CatalogReader,
  id: NodeId,
  definitionView?: string,
): "origin" | "instance" | undefined {
  const node = graph.getEntry(id);
  if (node?.kind !== "node") return undefined;
  if (definitionView) {
    const viewed = graph.getEntry(definitionView);
    if (
      id === ORIGIN_VIEW_NODE ||
      (viewed?.kind === "definition" && viewed.templateRootId === id)
    )
      return componentDefinition(graph, definitionView) ? "origin" : undefined;
  }
  return componentDefinition(graph, node.definitionId) ? "instance" : undefined;
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
