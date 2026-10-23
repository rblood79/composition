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
import { CATALOG_ROW_ITEM_TYPES } from "../../../../../packages/shared/src/catalog/resolution/resolver";

/**
 * ADR-248 Phase 4e-4e: the row template of a bound collection (the first item position of its
 * template root — the shared resolver repeats it per data row, 4e-4e-3a). Editing it (or inside
 * it) reaches every data row; the card fields section lists its content props a row fills. The
 * item types are the resolver's (2026-10-24 — a list of its own left Tag · TreeItem · Breadcrumb
 * without a row template here).
 */
const ROW_ITEM_TYPES = CATALOG_ROW_ITEM_TYPES;

function templateType(reader: CatalogReader, templateId: TemplateId): string {
  try {
    return definitionTypeName(reader, templateDefinitionId(reader, templateId));
  } catch {
    return "";
  }
}

/**
 * A bound instance's row template: its first own item (a placed collection holds its items as its
 * own nodes since 2026-10-14 — the resolver repeats that one per row), else its template root's
 * first item position.
 */
export function catalogRowTemplateId(
  reader: CatalogReader,
  ownerId: NodeId,
): TemplateId | NodeId | undefined {
  const owner = reader.getEntry(ownerId);
  if (owner?.kind !== "node" || !owner.binding) return undefined;
  for (const override of owner.descendantOverrides) {
    if (override.kind !== "fillSlot") continue;
    const item = override.childIds.find((id) => {
      const entry = reader.getEntry(id);
      if (entry?.kind !== "node") return false;
      try {
        return ROW_ITEM_TYPES.has(definitionTypeName(reader, entry.definitionId));
      } catch {
        return false;
      }
    });
    if (item) return item;
  }
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

/**
 * The bound owner whose row template the target is (or is inside); undefined otherwise. The
 * Design panel asks this per field of a selection, so the answer is kept per graph revision (the
 * owner-chain walk cost a `getEntry` · `ownerOf` per ancestor per field — ADR-246 ratchet).
 */
export function catalogRowTemplateOwner(
  reader: CatalogReader,
  target: EditTarget,
): NodeId | undefined {
  const key =
    target.kind === "node"
      ? target.id
      : `${target.ownerId}|${target.address.instances.join("/")}|${target.address.templatePath.join("/")}`;
  const revision = (reader as { revision?: unknown }).revision;
  const memo =
    typeof revision === "number" ? rowTemplateOwners.get(reader) : undefined;
  if (memo && memo.revision === revision && memo.answers.has(key))
    return memo.answers.get(key);
  const answer = rowTemplateOwnerOf(reader, target);
  if (typeof revision === "number") {
    const next =
      memo && memo.revision === revision
        ? memo
        : { revision, answers: new Map<string, NodeId | undefined>() };
    next.answers.set(key, answer);
    rowTemplateOwners.set(reader, next);
  }
  return answer;
}
const rowTemplateOwners = new WeakMap<
  object,
  { revision: number; answers: Map<string, NodeId | undefined> }
>();

function rowTemplateOwnerOf(
  reader: CatalogReader,
  target: EditTarget,
): NodeId | undefined {
  // No bound node in the document: no row template anywhere (the committed graph's index).
  const graph = reader as { hasBoundNodes?: () => boolean };
  if (graph.hasBoundNodes && !graph.hasBoundNodes()) return undefined;
  // An owned row template (or a node in it, or a position of its own template): its bound owner
  // is an ancestor whose row template is on the target's owner chain. Only a bound ancestor has a
  // row template, so the chain is read once and only bound ones are asked.
  const chain: string[] = [];
  const bound: NodeId[] = [];
  for (
    let id: string | undefined =
      target.kind === "node" ? target.id : target.ownerId;
    id;
    id = reader.ownerOf(id)
  ) {
    const entry = reader.getEntry(id);
    if (entry?.kind !== "node") break;
    if (entry.binding) bound.push(id as NodeId);
    chain.push(id);
  }
  for (const id of bound) {
    const rowTemplate = catalogRowTemplateId(reader, id);
    if (
      rowTemplate &&
      chain.includes(rowTemplate) &&
      chain.indexOf(rowTemplate) < chain.indexOf(id)
    )
      return id;
  }
  if (target.kind !== "descendant") return undefined;
  const owner = reader.getEntry(target.ownerId);
  if (owner?.kind !== "node" || !owner.binding) return undefined;
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
  // (An owned row template's literal content is its sample content — the rows do not read it,
  // `resolver.ts` `withoutSampleContent`: only a `{field}` write is the rows'.)
  const rowsRead = (value: string) => (value.includes("{") ? value : "");
  if (target.kind === "node") {
    const node = reader.getEntry(target.id);
    const write = node?.kind === "node" ? node.props[key] : undefined;
    return write?.kind === "set" && typeof write.value === "string"
      ? rowsRead(write.value)
      : "";
  }
  const ownedTemplate =
    catalogRowTemplateOwner(reader, { kind: "node", id: target.ownerId }) !==
    undefined;
  const owner = reader.getEntry(target.ownerId);
  if (owner?.kind !== "node") return "";
  const same = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length &&
    left.every((id, index) => id === right[index]);
  const patch = owner.descendantOverrides.find(
    (item) =>
      item.kind !== "replace" &&
      same(item.address.instances, target.address.instances) &&
      same(item.address.templatePath, target.address.templatePath),
  );
  const written = patch?.kind !== "replace" ? patch?.props?.[key] : undefined;
  // (An owned row template's literal write is its sample content: the rows read the template's.)
  const write =
    ownedTemplate &&
    written?.kind === "set" &&
    typeof written.value === "string" &&
    !written.value.includes("{")
      ? undefined
      : written;
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

/** An item's control slots (Tag remove · Tree chevron · selection · drag): parts, not content. */
const CONTROL_SLOTS: ReadonlySet<string> = new Set([
  "remove",
  "chevron",
  "selection",
  "drag",
]);

/** A position's literal `slot` (the owned node's, else its template's). */
function slotOf(reader: CatalogReader, position: CatalogPosition): unknown {
  const entry =
    position.target.kind === "node"
      ? reader.getEntry(position.target.id)
      : position.sourceId.startsWith("lib:")
        ? reader.library.templates.get(
            position.sourceId as `lib:template:${string}`,
          )
        : reader.getEntry(position.sourceId);
  const slot = (entry as { props?: Record<string, unknown> } | undefined)
    ?.props?.slot;
  return slot && typeof slot === "object" && "value" in slot
    ? (slot as { value?: unknown }).value
    : slot;
}

/**
 * The card fields of a bound collection position: each content prop a row fills on the row
 * template's descendants (document order, depth ≤ 8). The row template may sit under a part
 * (TagGroup > TagList > Tag · Select > Popover > ListBox). Undefined when not bound.
 */
export function catalogCardFields(
  reader: CatalogReader,
  position: CatalogPosition,
): { binding: DataBindingRef; fields: CatalogCardField[] } | undefined {
  if (position.target.kind !== "node") return undefined;
  const owner = reader.getEntry(position.target.id);
  if (owner?.kind !== "node" || !owner.binding) return undefined;
  const rowTemplate = catalogRowTemplateId(reader, owner.id);
  if (!rowTemplate) return undefined;
  let item: CatalogPosition | undefined;
  for (
    let level = childPositions(reader, position), depth = 0;
    level.length && !item && depth < 8;
    level = level.flatMap((child) => childPositions(reader, child)), depth += 1
  )
    item = level.find((child) => child.sourceId === rowTemplate);
  if (!item) return undefined;
  const fields: CatalogCardField[] = [];
  const visit = (parent: CatalogPosition, depth: number) => {
    if (depth > 8) return;
    for (const child of childPositions(reader, parent)) {
      let childType: string;
      try {
        childType = definitionTypeName(reader, child.definitionId);
      } catch {
        continue;
      }
      // (A nested row item — a Tree's sample child row — is the rows' again, not a field.)
      if (ROW_ITEM_TYPES.has(childType)) continue;
      const slot = slotOf(reader, child);
      if (typeof slot === "string" && CONTROL_SLOTS.has(slot)) continue;
      const values: Record<string, string> = {};
      for (const key of ROW_TEMPLATE_BINDABLE_PROP_KEYS) {
        // (An untyped node lists the keys holding a value — `rowTemplateBindableKeysFor`.)
        const value = rowValue(reader, child.target, key);
        if (value) values[key] = value;
      }
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
    label: "Edit item field",
  });
}
