import {
  definitionTypeName,
  sameAddress,
  templateDefinitionId,
} from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  CatalogReader,
  EditTarget,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  childPositions,
  nodePosition,
  type CatalogPosition,
} from "../../../../../packages/shared/src/catalog/resolution/positions";
import { CATALOG_PREFIX_FIELDS } from "../../../../../packages/shared/src/catalog/runtime/fieldPrefix";

/** Materialized field parts are independent nodes. The field inspector edits their content,
 * while template parts keep following their existing bindings. Never cross a nested field. */
export function catalogOwnedFieldContent(
  reader: CatalogReader,
  target: EditTarget,
  knownType?: string,
): ReadonlyMap<string, { target: EditTarget; key: string }> {
  const parts = new Map<string, { target: EditTarget; key: string }>();
  // The inspector already resolved its type. Non-fields need no further graph reads.
  if (knownType !== undefined && !CATALOG_PREFIX_FIELDS.has(knownType))
    return parts;
  const entry = target.kind === "node" ? reader.getEntry(target.id) : undefined;
  const definitionId =
    target.kind === "descendant"
      ? templateDefinitionId(reader, target.address.templatePath.at(-1)!)
      : entry?.kind === "node"
        ? entry.definitionId
        : undefined;
  // Most inspected nodes are not fields; never walk their instance trees.
  if (
    !definitionId ||
    !CATALOG_PREFIX_FIELDS.has(definitionTypeName(reader, definitionId))
  )
    return parts;
  const path =
    target.kind === "descendant"
      ? new Set<string>([
          ...target.address.instances,
          ...target.address.templatePath,
        ])
      : undefined;
  const start = nodePosition(
    reader,
    target.kind === "node" ? target.id : target.ownerId,
  );
  const find = (position: CatalogPosition): CatalogPosition | undefined => {
    const at = position.target;
    if (
      target.kind === "node"
        ? at.kind === "node" && at.id === target.id
        : at.kind === "descendant" &&
          at.ownerId === target.ownerId &&
          sameAddress(at.address, target.address)
    )
      return position;
    for (const child of childPositions(reader, position)) {
      if (path && !path.has(child.sourceId)) continue;
      const found = find(child);
      if (found) return found;
    }
  };
  const field = target.kind === "node" ? start : find(start);
  if (!field) return parts;
  const content: Record<string, Record<string, string>> = {
    Label: { label: "children" },
    Input: { placeholder: "placeholder", type: "type" },
    Description: { description: "children" },
    FieldError: { errorMessage: "children" },
  };
  const visit = (parent: CatalogPosition) => {
    for (const child of childPositions(reader, parent, {
      includeDisabled: true,
    })) {
      const type = definitionTypeName(reader, child.definitionId);
      if (type === "Group" || type === "frame") visit(child);
      else if (child.target.kind === "node")
        for (const [key, prop] of Object.entries(content[type] ?? {}))
          if (!parts.has(key))
            parts.set(key, { target: child.target, key: prop });
    }
  };
  visit(field);
  return parts;
}
