import type {
  CatalogReader,
  DefinitionId,
  DescendantOverride,
  EditTarget,
  EntryId,
  LibraryDescendantPatch,
  LibraryTemplateId,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../document/types";
import { CatalogValidationError } from "../document/validation";
import { validateInstanceAddress } from "./address";

/**
 * ADR-248 Phase 4c — the element positions a reader shows (Layers rows, selection targets), one
 * level at a time, in the resolver's order: an owned node, then (an instance) its template root's
 * children — the root collapses into the instance — and its own children; a template position's
 * fill, else its nested composite root's children (collapsed) and its template children. A
 * replaced position is its replacement; a position switched off (`enabled: false`) is not shown.
 *
 * `identity` is the resolved node's (`instancePath` + `sourceId`), the key the composition root
 * and Canvas records use. Enumeration reads only the entries on the way (no document scan).
 */
export interface CatalogPosition {
  /** What an edit on this position addresses. */
  target: EditTarget;
  sourceId: NodeId | TemplateId;
  instancePath: readonly (NodeId | TemplateId)[];
  definitionId: DefinitionId;
  identity: string;
  /** An owned node switched off (`enabled: false`): listed so it can be switched on again. */
  disabled?: boolean;
  /**
   * A template position listed with `includeDisabled`: whether it shows without the owner's own
   * `enabled` write (the template's, else the library patch's value).
   */
  inheritedEnabled?: boolean;
  /** Context of a template position (its owner instance, template path, library patch scope). */
  scope?: PositionScope;
}
interface PositionScope {
  owner: NodeId;
  path: readonly TemplateId[];
  patches?: {
    instances: readonly (NodeId | TemplateId)[];
    patches: readonly LibraryDescendantPatch[];
  };
}
type TemplateRecord = {
  definitionId: DefinitionId;
  children: readonly TemplateId[];
  enabled?: boolean;
  descendantPatches?: readonly LibraryDescendantPatch[];
};

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);
const identityOf = (
  instancePath: readonly string[],
  sourceId: string,
): string => `${instancePath.join("/")}::${sourceId}`;

function readNode(reader: CatalogReader, id: string): NodeEntry {
  const node = reader.getEntry(id);
  if (node?.kind !== "node")
    throw new CatalogValidationError("DANGLING_CHILD", id);
  return node;
}
function readTemplate(reader: CatalogReader, id: TemplateId): TemplateRecord {
  const template = id.startsWith("lib:")
    ? reader.library.templates.get(id as LibraryTemplateId)
    : reader.getEntry(id);
  if (!template || ("kind" in template && template.kind !== "node"))
    throw new CatalogValidationError("DANGLING_TEMPLATE", id);
  return template as TemplateRecord;
}
function templateRootOf(
  reader: CatalogReader,
  definitionId: DefinitionId,
): TemplateId | undefined {
  const definition = definitionId.startsWith("lib:")
    ? reader.library.definitions.get(definitionId as `lib:definition:${string}`)
    : reader.getEntry(definitionId);
  if (!definition || ("kind" in definition && definition.kind !== "definition"))
    throw new CatalogValidationError("DANGLING_DEFINITION", definitionId);
  const { mode, templateRootId } = definition as {
    mode: string;
    templateRootId?: TemplateId;
  };
  return mode === "composite" ? templateRootId : undefined;
}

function ownedPosition(
  node: NodeEntry,
  instancePath: readonly (NodeId | TemplateId)[],
): CatalogPosition {
  return {
    target: { kind: "node", id: node.id },
    sourceId: node.id,
    instancePath,
    definitionId: node.definitionId,
    identity: identityOf(instancePath, node.id),
    ...(node.enabled === false ? { disabled: true } : {}),
  };
}

/** The override of an owner instance at an address (starting at the owner, §validateInstanceAddress). */
function overrideAt(
  owner: NodeEntry,
  instances: readonly (NodeId | TemplateId)[],
  path: readonly TemplateId[],
): DescendantOverride | undefined {
  return owner.descendantOverrides.find(
    (item) =>
      sameIds(item.address.instances, instances) &&
      sameIds(item.address.templatePath, path),
  );
}

/** Options of a child listing. */
export interface ChildPositionOptions {
  /** List switched-off template positions too (`disabled: true`), so they can be switched on. */
  includeDisabled?: boolean;
}

/**
 * A template position as the resolver projects it: its replacement, `undefined` when switched
 * off (unless listed with `includeDisabled`), else the position.
 */
function templatePosition(
  reader: CatalogReader,
  scope: PositionScope,
  instancePath: readonly (NodeId | TemplateId)[],
  options: ChildPositionOptions = {},
): CatalogPosition | undefined {
  const owner = readNode(reader, scope.owner);
  const instances = instancePath.slice(instancePath.lastIndexOf(owner.id));
  const templateId = scope.path[scope.path.length - 1];
  const change = overrideAt(owner, instances, scope.path);
  if (change?.kind === "replace")
    return ownedPosition(readNode(reader, change.replacementId), [
      ...instancePath,
      change.replacementId,
    ]);
  const template = readTemplate(reader, templateId);
  const libraryPatch =
    scope.patches && sameIds(scope.patches.instances, instancePath)
      ? scope.patches.patches.find((item) =>
          sameIds(item.templatePath, scope.path),
        )
      : undefined;
  const inheritedEnabled = libraryPatch?.enabled ?? template.enabled ?? true;
  const enabled =
    (change?.kind === "patch" ? change.enabled : undefined) ?? inheritedEnabled;
  if (!enabled && !options.includeDisabled) return undefined;
  return {
    target: {
      kind: "descendant",
      ownerId: owner.id,
      address: { instances, templatePath: scope.path },
    },
    sourceId: templateId,
    instancePath,
    definitionId: template.definitionId,
    identity: identityOf(instancePath, templateId),
    scope,
    ...(options.includeDisabled ? { inheritedEnabled } : {}),
    ...(enabled ? {} : { disabled: true }),
  };
}

/** The children a collapsed composite root shows in its instance's place. */
function collapsedRootChildren(
  reader: CatalogReader,
  scope: PositionScope,
  instancePath: readonly (NodeId | TemplateId)[],
  options: ChildPositionOptions,
): CatalogPosition[] {
  const root = templatePosition(reader, scope, instancePath);
  if (!root) return [];
  // A replaced root is an element of its own.
  if (root.target.kind === "node") return [root];
  return childPositions(reader, root, options);
}

/** The positions a page shows at its top level. */
export function pagePositions(
  reader: CatalogReader,
  pageId: EntryId<"page">,
): CatalogPosition[] {
  const page = reader.getEntry(pageId);
  if (page?.kind !== "page")
    throw new CatalogValidationError("PAGE_REQUIRED", pageId);
  return page.children.map((id) => ownedPosition(readNode(reader, id), [id]));
}

/**
 * The top position of a project definition's template (the definition edit view): its template
 * root, an ordinary owned node. None when the definition has no template.
 */
export function definitionPositions(
  reader: CatalogReader,
  definitionId: EntryId<"definition">,
): CatalogPosition[] {
  const definition = reader.getEntry(definitionId);
  if (definition?.kind !== "definition")
    throw new CatalogValidationError("DEFINITION_REQUIRED", definitionId);
  const rootId = definition.templateRootId;
  return rootId ? [ownedPosition(readNode(reader, rootId), [rootId])] : [];
}

/** The positions one position shows as its children (one level). */
export function childPositions(
  reader: CatalogReader,
  position: CatalogPosition,
  options: ChildPositionOptions = {},
): CatalogPosition[] {
  const { instancePath } = position;
  if (!position.scope) {
    const node = readNode(reader, position.sourceId);
    const rootId = templateRootOf(reader, node.definitionId);
    return [
      ...(rootId
        ? collapsedRootChildren(
            reader,
            { owner: node.id, path: [rootId] },
            instancePath,
            options,
          )
        : []),
      ...node.children.map((id) =>
        ownedPosition(readNode(reader, id), [...instancePath, id]),
      ),
    ];
  }
  const { scope } = position;
  const templateId = scope.path[scope.path.length - 1];
  const owner = readNode(reader, scope.owner);
  const change = overrideAt(
    owner,
    instancePath.slice(instancePath.lastIndexOf(owner.id)),
    scope.path,
  );
  if (change?.kind === "fillSlot")
    return change.childIds.map((id) =>
      ownedPosition(readNode(reader, id), [...instancePath, id]),
    );
  const template = readTemplate(reader, templateId);
  const nestedRoot = templateRootOf(reader, template.definitionId);
  const nestedPath = [...instancePath, templateId];
  return [
    ...(nestedRoot
      ? collapsedRootChildren(
          reader,
          {
            owner: scope.owner,
            path: [nestedRoot],
            ...(template.descendantPatches
              ? {
                  patches: {
                    instances: nestedPath,
                    patches: template.descendantPatches,
                  },
                }
              : {}),
          },
          nestedPath,
          options,
        )
      : []),
    ...template.children.flatMap((childId) => {
      const child = templatePosition(
        reader,
        { ...scope, path: [...scope.path, childId] },
        instancePath,
        options,
      );
      return child ? [child] : [];
    }),
  ];
}

/**
 * Whether an edit target still addresses a shown element: an owned node that exists, or a
 * template position whose owner exists, whose address resolves and which no switched-off
 * position on its path hides (a replaced position is its replacement, so it is gone).
 */
export function targetExists(
  reader: CatalogReader,
  target: EditTarget,
): boolean {
  if (target.kind === "node")
    return reader.getEntry(target.id)?.kind === "node";
  const owner = reader.getEntry(target.ownerId);
  if (owner?.kind !== "node") return false;
  const { instances, templatePath } = target.address;
  try {
    validateInstanceAddress(
      owner,
      target.address,
      reader.getEntry.bind(reader),
      reader.library,
    );
    const step = instances[instances.length - 1];
    const enclosing =
      instances.length > 1 && step.startsWith("lib:")
        ? readTemplate(reader, step as TemplateId).descendantPatches
        : undefined;
    for (let depth = 1; depth <= templatePath.length; depth++) {
      const position = templatePosition(
        reader,
        {
          owner: owner.id,
          path: templatePath.slice(0, depth),
          ...(enclosing ? { patches: { instances, patches: enclosing } } : {}),
        },
        instances,
      );
      if (!position || position.target.kind === "node") return false;
    }
    return true;
  } catch (error) {
    if (error instanceof CatalogValidationError) return false;
    throw error;
  }
}
