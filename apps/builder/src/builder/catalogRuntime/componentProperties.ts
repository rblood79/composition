import {
  addComponentProperty,
  applyComponentProperty,
  detachComponentProperty,
  removeComponentProperty,
  renameComponentProperty,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { componentPropertiesOf } from "../../../../../packages/shared/src/catalog/document/componentProperties";
import type {
  CatalogReader,
  ComponentProperty,
  ComponentPropertyKind,
  ComponentPropertyTarget,
  EditTarget,
  EntryId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";

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
              (kind === "boolean" || target.prop === textProp),
          ),
      )
      .map(({ key, name }) => ({ key, name }));
  return {
    origin,
    isRoot,
    rows,
    ...(textProp ? { textProp } : {}),
    canBoolean: !isRoot,
    applicable: {
      text: textProp ? applicable("text") : [],
      boolean: isRoot ? [] : applicable("boolean"),
    },
  };
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
};

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
