import type {
  CatalogEntry,
  CatalogLibrary,
  DefinitionId,
  InstanceAddress,
  LibraryTemplateId,
  NodeEntry,
  TemplateId,
} from "../document/types";
import { CatalogValidationError } from "../document/validation";

export interface AddressTarget {
  id: TemplateId;
  definitionId: DefinitionId;
  slot?: { name: string; required: boolean };
}
type Lookup = (id: string) => CatalogEntry | undefined;

/** Follows IDs, never names or slash-string descendant keys. */
export function validateInstanceAddress(
  root: NodeEntry,
  address: InstanceAddress,
  get: Lookup,
  library: CatalogLibrary,
): AddressTarget {
  if (address.instances[0] !== root.id)
    throw new CatalogValidationError("INSTANCE_ROOT_MISMATCH", root.id);
  const readTemplate = (
    id: TemplateId,
  ): AddressTarget & { children: readonly TemplateId[] } => {
    if (id.startsWith("lib:")) {
      const node = library.templates.get(id as LibraryTemplateId);
      if (!node) throw new CatalogValidationError("DANGLING_TEMPLATE", id);
      return node;
    }
    const node = get(id);
    if (node?.kind !== "node")
      throw new CatalogValidationError("DANGLING_TEMPLATE", id);
    return node;
  };
  const getRoot = (definitionId: DefinitionId): TemplateId => {
    const definition = definitionId.startsWith("lib:")
      ? library.definitions.get(definitionId as `lib:definition:${string}`)
      : get(definitionId);
    if (
      !definition ||
      ("kind" in definition && definition.kind !== "definition") ||
      definition.mode !== "composite" ||
      !definition.templateRootId
    )
      throw new CatalogValidationError("INSTANCE_NOT_COMPOSITE", definitionId);
    return definition.templateRootId;
  };
  const findInside = (
    rootId: TemplateId,
    sought: TemplateId,
  ): (AddressTarget & { children: readonly TemplateId[] }) | null => {
    const stack = [rootId];
    const seen = new Set<TemplateId>();
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const node = readTemplate(id);
      if (id === sought) return node;
      stack.push(...node.children);
    }
    return null;
  };
  let definitionId = root.definitionId;
  for (const nestedId of address.instances.slice(1)) {
    const nested = findInside(getRoot(definitionId), nestedId);
    if (!nested)
      throw new CatalogValidationError("INSTANCE_STEP_NOT_OWNED", nestedId);
    definitionId = nested.definitionId;
    getRoot(definitionId); // nested step must itself be composite
  }
  const [first, ...rest] = address.templatePath;
  if (first !== getRoot(definitionId))
    throw new CatalogValidationError("TEMPLATE_ROOT_MISMATCH", first);
  let current = readTemplate(first);
  for (const id of rest) {
    if (!current.children.includes(id))
      throw new CatalogValidationError("TEMPLATE_STEP_NOT_OWNED", id);
    current = readTemplate(id);
  }
  return current;
}
