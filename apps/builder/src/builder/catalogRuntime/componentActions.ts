import {
  createComponent,
  detachInstances,
  dissolveComponent,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { templateDefinitionId } from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  CatalogReader,
  EditTarget,
  EntryId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  catalogDefinitionTitle,
  isLibraryOrigin,
  originOfEditableSample,
} from "./originView";

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

/**
 * The definition a selected target is an instance of: an owned node's own definition, or — a
 * position of an instance's template (`descendant`) — the template row's definition. A
 * ToggleButtonGroup instance's "Toggle 1" is such a row and an instance of the ToggleButton
 * origin, as the one its "+" adds (an owned node) is (user 2026-10-14 — the panel, the Layers dot
 * and the Canvas chrome said "not an instance" for the template rows alone).
 */
function targetDefinitionId(
  graph: CatalogReader,
  target: EditTarget,
): string | undefined {
  if (target.kind === "node") {
    const node = graph.getEntry(target.id);
    return node?.kind === "node" ? node.definitionId : undefined;
  }
  const templateId = target.address.templatePath.at(-1);
  try {
    return templateId ? templateDefinitionId(graph, templateId) : undefined;
  } catch {
    return undefined;
  }
}

const asTarget = (target: NodeId | EditTarget): EditTarget =>
  typeof target === "string" ? { kind: "node", id: target } : target;

/**
 * The component state of a target: an owned node, or a position of an instance's template (an
 * instance of the row's definition — go to origin; detach and create need an owned node).
 */
export function catalogComponentState(
  graph: CatalogReader,
  selected: NodeId | EditTarget,
  /** The definition edit view open now: its root is that component's origin. */
  definitionView?: string,
): CatalogComponentState {
  const target = asTarget(selected);
  if (target.kind === "node") {
    const node = graph.getEntry(target.id);
    if (node?.kind !== "node") return {};
    // A built-in origin's sample on the Components page is that origin.
    const sampled = originOfEditableSample(target.id);
    if (sampled) {
      const originOf = componentRef(graph, sampled);
      return originOf ? { originOf } : {};
    }
    if (definitionView) {
      const viewed = graph.getEntry(definitionView);
      if (viewed?.kind === "definition" && viewed.templateRootId === target.id) {
        const originOf = componentRef(graph, definitionView);
        return originOf ? { originOf } : {};
      }
    }
  }
  const definitionId = targetDefinitionId(graph, target);
  const instanceOf = definitionId && componentRef(graph, definitionId);
  return instanceOf ? { instanceOf } : {};
}

/**
 * The editing role the Canvas chrome colors a target with (the old `getEditingSemanticsRole`): the
 * origin the definition edit view shows, or an instance of a component — the same test as the
 * Component section (`catalogComponentState`), without its instance list.
 */
export function catalogComponentRole(
  graph: CatalogReader,
  selected: NodeId | EditTarget,
  definitionView?: string,
): "origin" | "instance" | undefined {
  const target = asTarget(selected);
  if (target.kind === "node") {
    const node = graph.getEntry(target.id);
    if (node?.kind !== "node") return undefined;
    if (originOfEditableSample(target.id)) return "origin";
    if (definitionView) {
      const viewed = graph.getEntry(definitionView);
      if (viewed?.kind === "definition" && viewed.templateRootId === target.id)
        return componentDefinition(graph, definitionView) ? "origin" : undefined;
    }
  }
  const definitionId = targetDefinitionId(graph, target);
  return definitionId && componentDefinition(graph, definitionId)
    ? "instance"
    : undefined;
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
