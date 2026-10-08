import {
  ROW_TEMPLATE_BINDABLE_PROP_KEYS,
  rowTemplateBindableKeysFor,
  type RowTemplateBindablePropKey,
} from "@composition/shared";
import { setFields } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  definitionTypeName,
  templateDefinitionId,
  type EditTarget,
} from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  CatalogReader,
  DataBindingRef,
  NodeId,
  TemplateId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  childPositions,
  type CatalogPosition,
} from "../../../../../packages/shared/src/catalog/resolution/positions";

/**
 * ADR-248 Phase 4e-4e: the row template of a bound collection (the first item position of its
 * template root — the shared resolver repeats it per data row, 4e-4e-3a). Editing it (or inside
 * it) reaches every data row; the card fields section lists its content props a row fills.
 */
const ROW_ITEM_TYPES: ReadonlySet<string> = new Set([
  "ListBoxItem",
  "GridListItem",
]);

function templateType(reader: CatalogReader, templateId: TemplateId): string {
  try {
    return definitionTypeName(reader, templateDefinitionId(reader, templateId));
  } catch {
    return "";
  }
}

/** A bound instance's row template position (its template root's first item child). */
export function catalogRowTemplateId(
  reader: CatalogReader,
  ownerId: NodeId,
): TemplateId | undefined {
  const owner = reader.getEntry(ownerId);
  if (owner?.kind !== "node" || !owner.binding) return undefined;
  const definition = owner.definitionId.startsWith("lib:")
    ? reader.library.definitions.get(
        owner.definitionId as `lib:definition:${string}`,
      )
    : reader.getEntry(owner.definitionId);
  const rootId = (definition as { templateRootId?: TemplateId } | undefined)
    ?.templateRootId;
  if (!rootId) return undefined;
  const childrenOf = (id: TemplateId): readonly TemplateId[] =>
    (
      (id.startsWith("lib:")
        ? reader.library.templates.get(id as `lib:template:${string}`)
        : reader.getEntry(id)) as
        { children?: readonly TemplateId[] } | undefined
    )?.children ?? [];
  const itemOf = (ids: readonly TemplateId[]) =>
    ids.find((childId) => ROW_ITEM_TYPES.has(templateType(reader, childId)));
  // The rows reach the items of a part that holds them, at any depth (a Select's `Popover >
  // ListBox` — ADR-256 Phase 6c: the resolver passes the rows on to the children of a position
  // with no item position, level by level).
  for (
    let level = childrenOf(rootId);
    level.length;
    level = level.flatMap((child) => childrenOf(child))
  ) {
    const item = itemOf(level);
    if (item) return item;
  }
  return undefined;
}

/** The bound owner whose row template the target is (or is inside); undefined otherwise. */
export function catalogRowTemplateOwner(
  reader: CatalogReader,
  target: EditTarget,
): NodeId | undefined {
  if (target.kind !== "descendant") return undefined;
  const rowTemplate = catalogRowTemplateId(reader, target.ownerId);
  if (!rowTemplate) return undefined;
  // (The row template itself, a position below it, or one inside its own composite template.)
  const { instances, templatePath } = target.address;
  return (instances as readonly string[]).includes(rowTemplate) ||
    templatePath.includes(rowTemplate)
    ? target.ownerId
    : undefined;
}

export interface CatalogCardField {
  target: EditTarget;
  /** The node's name, else its type. */
  label: string;
  key: RowTemplateBindablePropKey;
  /** What the rows read: the owner's write at the position, else the template's own value. */
  value: string;
}

/** The row template's own value of a prop (its sample library patches are not the rows'). */
function rowValue(
  reader: CatalogReader,
  target: EditTarget,
  key: string,
): string {
  if (target.kind !== "descendant") return "";
  const owner = reader.getEntry(target.ownerId);
  if (owner?.kind !== "node") return "";
  const same = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length &&
    left.every((id, index) => id === right[index]);
  const patch = owner.descendantOverrides.find(
    (item) =>
      item.kind === "patch" &&
      same(item.address.instances, target.address.instances) &&
      same(item.address.templatePath, target.address.templatePath),
  );
  const write = patch?.kind === "patch" ? patch.props?.[key] : undefined;
  if (write?.kind === "set")
    return typeof write.value === "string" ? write.value : "";
  if (write) return "";
  const templateId = target.address.templatePath.at(-1)!;
  const template = templateId.startsWith("lib:")
    ? reader.library.templates.get(templateId as `lib:template:${string}`)
    : reader.getEntry(templateId);
  const own = (template as { props?: Record<string, unknown> } | undefined)
    ?.props?.[key];
  const value =
    own && typeof own === "object" && "kind" in own
      ? (own as { kind: string; value?: unknown }).kind === "set"
        ? (own as { value?: unknown }).value
        : undefined
      : own;
  return typeof value === "string" ? value : "";
}

/**
 * The card fields of a bound GridList position: each content prop a row fills on the row
 * template's descendants (document order, depth ≤ 8). Empty when not a bound GridList.
 */
export function catalogCardFields(
  reader: CatalogReader,
  position: CatalogPosition,
): { binding: DataBindingRef; fields: CatalogCardField[] } | undefined {
  if (position.target.kind !== "node") return undefined;
  const owner = reader.getEntry(position.target.id);
  if (owner?.kind !== "node" || !owner.binding) return undefined;
  let type = "";
  try {
    type = definitionTypeName(reader, owner.definitionId);
  } catch {
    return undefined;
  }
  if (type !== "GridList") return undefined;
  const rowTemplate = catalogRowTemplateId(reader, owner.id);
  const item = childPositions(reader, position).find(
    (child) => child.sourceId === rowTemplate,
  );
  if (!item) return undefined;
  const fields: CatalogCardField[] = [];
  const visit = (parent: CatalogPosition, depth: number) => {
    if (depth > 8) return;
    for (const child of childPositions(reader, parent)) {
      let childType = "";
      try {
        childType = definitionTypeName(reader, child.definitionId);
      } catch {
        continue;
      }
      const values: Record<string, string> = {};
      for (const key of ROW_TEMPLATE_BINDABLE_PROP_KEYS)
        values[key] = rowValue(reader, child.target, key);
      const node =
        child.target.kind === "node"
          ? reader.getEntry(child.target.id)
          : undefined;
      const label = (node?.kind === "node" && node.name) || childType;
      for (const key of rowTemplateBindableKeysFor(childType, values))
        fields.push({
          target: child.target,
          label,
          key,
          value: values[key] ?? "",
        });
      visit(child, depth + 1);
    }
  };
  visit(item, 0);
  return { binding: owner.binding, fields };
}

/** Write a card field: the owner's patch at the position (empty = back to the template's). */
export function catalogCardFieldCommand(
  field: CatalogCardField,
  next: string,
): CatalogCommand {
  return setFields({
    targets: [field.target],
    props: {
      [field.key]:
        next === "" ? { kind: "remove" } : { kind: "set", value: next },
    },
    label: "Edit card field",
  });
}
