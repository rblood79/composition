import {
  addComponentProperty,
  applyComponentProperty,
  detachComponentProperty,
  instancePropertyValue,
  planInstanceProperty,
  removeComponentProperty,
  renameComponentProperty,
  setComponentPropertyPreferred,
  setInstanceProperty,
  type SwapInstanceReport,
} from "../../../../../packages/shared/src/catalog/commands";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { componentPropertiesOf } from "../../../../../packages/shared/src/catalog/document/componentProperties";
import type {
  CatalogReader,
  ComponentProperty,
  ComponentPropertyKind,
  ComponentPropertyTarget,
  DefinitionId,
  EditTarget,
  EntryId,
  InstanceAddress,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import { catalogSwapCandidates, type CatalogSwapCandidate } from "./swapInstance";

/**
 * ADR-261 Decision 4 — the Builder side of user component properties: which component an origin
 * node belongs to (the nearest origin above it — a layer of a component inside another origin is
 * its own component's), the property view of a selected origin node, the commands, and the inline
 * text edit of a driven position inside an instance (Figma: editing the layer sets the property).
 */

export interface CatalogPropertyOrigin {
  definitionId: EntryId<"definition">;
  name: string;
  rootId: NodeId;
}

/** Whether the project has a component of its own (a definition) — no origin walk otherwise. */
export function catalogHasProjectComponents(graph: CatalogReader): boolean {
  const project = graph.getEntry(graph.projectId);
  return project?.kind === "project" && project.definitionIds.length > 0;
}

/** The project component whose origin subtree holds `nodeId` (nearest first). */
export function catalogPropertyOrigin(
  graph: CatalogReader,
  nodeId: NodeId,
): CatalogPropertyOrigin | undefined {
  const seen = new Set<string>();
  for (
    let cursor: string | undefined = nodeId;
    cursor && !seen.has(cursor);
    cursor = graph.ownerOf(cursor)
  ) {
    seen.add(cursor);
    const definitionId = graph.definitionOfTemplateRoot(cursor);
    if (!definitionId) continue;
    const definition = graph.getEntry(definitionId);
    if (definition?.kind !== "definition" || definition.usage === "layout")
      return undefined;
    return {
      definitionId,
      name: definition.name,
      rootId: cursor as NodeId,
    };
  }
  return undefined;
}

export interface CatalogPropertyRow {
  key: string;
  name: string;
  kind: ComponentPropertyKind;
  /** How many origin nodes it drives. */
  count: number;
  /** On the selected node: the target there (the text prop for text). */
  target?: ComponentPropertyTarget;
  /** Instance kind: its preferred components (ids). */
  preferred?: string[];
}
export interface CatalogPropertyView {
  origin: CatalogPropertyOrigin;
  isRoot: boolean;
  /** The selected node's rows (every property when the origin root is selected). */
  rows: CatalogPropertyRow[];
  /** The text prop a text property would drive here (the node's own text), if any. */
  textProp?: string;
  /** A boolean property may drive this node (not the root — it would hide the instance). */
  canBoolean: boolean;
  /** An instance swap property may drive this node (a component instance below the root). */
  canInstance: boolean;
  /** Existing properties this node could take on, by kind. */
  applicable: Record<ComponentPropertyKind, { key: string; name: string }[]>;
}

/** The property view of a selected origin node; `textProp` is the node's own text prop. */
export function catalogPropertyView(
  graph: CatalogReader,
  nodeId: NodeId,
  textProp: string | undefined,
): CatalogPropertyView | undefined {
  const origin = catalogPropertyOrigin(graph, nodeId);
  if (!origin) return undefined;
  const properties =
    componentPropertiesOf(graph.getEntry(origin.definitionId)) ?? [];
  const isRoot = origin.rootId === nodeId;
  const here = (property: ComponentProperty) =>
    property.targets.find((target) => target.id === nodeId);
  const rows = properties.flatMap((property): CatalogPropertyRow[] => {
    const target = here(property);
    if (!target && !isRoot) return [];
    return [
      {
        key: property.key,
        name: property.name,
        kind: property.kind,
        count: property.targets.length,
        ...(target ? { target } : {}),
        ...(property.preferred?.length
          ? { preferred: [...property.preferred] }
          : {}),
      },
    ];
  });
  const applicable = (kind: ComponentPropertyKind) =>
    properties
      .filter(
        (property) =>
          property.kind === kind &&
          !property.targets.some(
            (target) =>
              target.id === nodeId &&
              (kind !== "text" || target.prop === textProp),
          ),
      )
      .map(({ key, name }) => ({ key, name }));
  // (A swapped nested instance is a new node: a text property cannot reach it — the graph refuses
  // one on a node an instance property drives, so it is offered for one or the other.)
  const swapped = properties.some(
    (property) =>
      property.kind === "instance" &&
      property.targets.some((target) => target.id === nodeId),
  );
  const driven = properties.some(
    (property) =>
      property.kind === "text" &&
      property.targets.some((target) => target.id === nodeId),
  );
  const canInstance =
    !isRoot && !driven && catalogIsComponentInstance(graph, nodeId);
  return {
    origin,
    isRoot,
    rows,
    ...(textProp && !swapped ? { textProp } : {}),
    canBoolean: !isRoot,
    canInstance,
    applicable: {
      text: textProp && !swapped ? applicable("text") : [],
      boolean: isRoot ? [] : applicable("boolean"),
      instance: canInstance ? applicable("instance") : [],
    },
  };
}

/**
 * Whether a node shows a component another one can stand in for (Swap instance's subjects): a
 * project component's instance, or a built-in component the palette places (not plain text).
 */
export function catalogIsComponentInstance(
  graph: CatalogReader,
  nodeId: NodeId,
): boolean {
  const node = graph.getEntry(nodeId);
  if (node?.kind !== "node") return false;
  if (node.definitionId.startsWith("project:")) {
    const definition = graph.getEntry(node.definitionId);
    return definition?.kind === "definition" && definition.usage !== "layout";
  }
  try {
    return !/^(Text|Heading|Paragraph)$/.test(
      definitionTypeName(graph, node.definitionId),
    );
  } catch {
    return false;
  }
}

/** A new property key: a stable prop name no instance contract uses. */
export function catalogNewPropertyKey(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `prop${random}`;
}

export const catalogPropertyCommands = {
  create: (
    origin: CatalogPropertyOrigin,
    kind: ComponentPropertyKind,
    name: string,
    target: ComponentPropertyTarget,
  ): CatalogCommand =>
    addComponentProperty({
      definitionId: origin.definitionId,
      key: catalogNewPropertyKey(),
      name,
      kind,
      target,
    }),
  apply: (
    origin: CatalogPropertyOrigin,
    key: string,
    target: ComponentPropertyTarget,
  ): CatalogCommand =>
    applyComponentProperty({ definitionId: origin.definitionId, key, target }),
  detach: (
    origin: CatalogPropertyOrigin,
    key: string,
    target: ComponentPropertyTarget,
  ): CatalogCommand =>
    detachComponentProperty({ definitionId: origin.definitionId, key, target }),
  rename: (
    origin: CatalogPropertyOrigin,
    key: string,
    name: string,
  ): CatalogCommand =>
    renameComponentProperty({ definitionId: origin.definitionId, key, name }),
  remove: (origin: CatalogPropertyOrigin, key: string): CatalogCommand =>
    removeComponentProperty({ definitionId: origin.definitionId, key }),
  preferred: (
    origin: CatalogPropertyOrigin,
    key: string,
    preferred: readonly string[],
  ): CatalogCommand =>
    setComponentPropertyPreferred({
      definitionId: origin.definitionId,
      key,
      preferred: preferred as DefinitionId[],
    }),
};

/**
 * ADR-261 Phase 5 — where an instance's swap property values live for a selected target: an
 * instance (its own overrides), or a nested instance's position inside an outer one (the outer
 * one's overrides through it). `undefined` when the target shows no component with such
 * properties.
 */
export interface CatalogInstancePropertyScope {
  ownerId: NodeId;
  instances: InstanceAddress["instances"];
  definitionId: EntryId<"definition">;
}
export function catalogInstancePropertyScope(
  graph: CatalogReader,
  target: EditTarget,
): CatalogInstancePropertyScope | undefined {
  const step =
    target.kind === "node"
      ? target.id
      : target.address.templatePath[target.address.templatePath.length - 1];
  if (!step?.startsWith("project:")) return undefined;
  const node = graph.getEntry(step);
  if (node?.kind !== "node" || !node.definitionId.startsWith("project:"))
    return undefined;
  const properties = componentPropertiesOf(graph.getEntry(node.definitionId));
  if (!properties?.some((property) => property.kind === "instance"))
    return undefined;
  return target.kind === "node"
    ? {
        ownerId: target.id,
        instances: [target.id],
        definitionId: node.definitionId as EntryId<"definition">,
      }
    : {
        ownerId: target.ownerId,
        instances: [...target.address.instances, step as never],
        definitionId: node.definitionId as EntryId<"definition">,
      };
}

export interface CatalogInstancePropertyRow {
  key: string;
  name: string;
  definitionId: string;
  label: string;
  isDefault: boolean;
}
/** An instance's swap property values (the ones it can still reach). */
export function catalogInstancePropertyRows(
  graph: CatalogReader,
  scope: CatalogInstancePropertyScope,
): CatalogInstancePropertyRow[] {
  const properties = componentPropertiesOf(graph.getEntry(scope.definitionId));
  return (properties ?? []).flatMap((property) => {
    if (property.kind !== "instance") return [];
    let value: ReturnType<typeof instancePropertyValue>;
    try {
      value = instancePropertyValue(
        graph,
        scope.ownerId,
        scope.instances,
        property.key,
      );
    } catch {
      return [];
    }
    if (!value) return [];
    return [
      {
        key: property.key,
        name: property.name,
        definitionId: value.definitionId,
        label: catalogComponentLabel(graph, value.definitionId),
        isDefault: value.isDefault,
      },
    ];
  });
}

export function catalogComponentLabel(
  graph: CatalogReader,
  definitionId: string,
): string {
  const entry = definitionId.startsWith("lib:")
    ? graph.library.definitions.get(definitionId as `lib:definition:${string}`)
    : graph.getEntry(definitionId);
  return (entry as { name?: string } | undefined)?.name ?? definitionId;
}

/**
 * What an instance swap property can pick (Figma: the preferred values on top): the preferred
 * components, then what can stand where the nested instance stands (Swap instance's list), the
 * default included and the current value left out.
 */
export function catalogInstancePropertyCandidates(
  graph: CatalogReader,
  scope: CatalogInstancePropertyScope,
  key: string,
): CatalogSwapCandidate[] {
  const property = componentPropertiesOf(
    graph.getEntry(scope.definitionId),
  )?.find((item) => item.key === key);
  const [first] = property?.targets ?? [];
  if (!property || !first) return [];
  const origin = graph.getEntry(first.id);
  if (origin?.kind !== "node") return [];
  let current: string | undefined;
  try {
    current = instancePropertyValue(
      graph,
      scope.ownerId,
      scope.instances,
      key,
    )?.definitionId;
  } catch {
    current = undefined;
  }
  const preferred = new Set<string>(property.preferred ?? []);
  const listed = catalogSwapCandidates(graph, first.id);
  const out: CatalogSwapCandidate[] = [];
  const seen = new Set<string>([current ?? ""]);
  const push = (candidate: CatalogSwapCandidate) => {
    if (seen.has(candidate.definitionId)) return;
    seen.add(candidate.definitionId);
    out.push(candidate);
  };
  for (const id of property.preferred ?? [])
    push({
      definitionId: id,
      label: catalogComponentLabel(graph, id),
      group: "preferred",
    });
  if (origin.definitionId !== current)
    push({
      definitionId: origin.definitionId,
      label: catalogComponentLabel(graph, origin.definitionId),
      group: "related",
    });
  for (const candidate of listed)
    if (!preferred.has(candidate.definitionId)) push(candidate);
  return out;
}

/** The value as one command, with what the swaps kept, dropped and moved out (the notice). */
export function catalogInstancePropertyPlan(
  graph: CatalogReader,
  scope: CatalogInstancePropertyScope,
  key: string,
  definitionId: DefinitionId | null,
  newId: NewId,
): { command: CatalogCommand; report: SwapInstanceReport } {
  const input = {
    ownerId: scope.ownerId,
    instances: scope.instances,
    key,
    definitionId,
    newId,
  };
  // (Plan once with a throwaway allocator for the report; the command allocates for real.)
  let n = 0;
  const { report } = planInstanceProperty(graph, {
    ...input,
    newId: ((kind: string) => `project:${kind}:plan${++n}`) as NewId,
  });
  return { command: setInstanceProperty(input), report };
}

/**
 * The instance prop an inline text edit writes when the edited text is a component's text
 * property (Figma: editing the layer in an instance sets the property): a position right in the
 * instance's template (`instances` = the owner) whose node · prop the owner's component drives.
 * `undefined` = the position's own text (a nested instance's — the patch path).
 */
export function catalogPropertyTextTarget(
  graph: CatalogReader,
  target: EditTarget,
  key: string,
): { target: EditTarget; prop: string } | undefined {
  if (target.kind !== "descendant" || target.address.instances.length !== 1)
    return undefined;
  const owner = graph.getEntry(target.ownerId);
  if (owner?.kind !== "node") return undefined;
  const nodeId =
    target.address.templatePath[target.address.templatePath.length - 1];
  const property = componentPropertiesOf(
    graph.getEntry(owner.definitionId),
  )?.find(
    (item) =>
      item.kind === "text" &&
      item.targets.some(
        (driven) => driven.id === nodeId && driven.prop === key,
      ),
  );
  return property
    ? { target: { kind: "node", id: owner.id }, prop: property.key }
    : undefined;
}
