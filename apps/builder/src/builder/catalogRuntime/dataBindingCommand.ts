import {
  insertCollectionItem,
  setWholeField,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  stageOver,
  type CatalogCommand,
  type CatalogCommandPlan,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  DataBindingRef,
  EditTarget,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  CATALOG_EMPTY_STATE_COLLECTIONS,
  RAC_COLLECTION_CHILD_TYPES,
} from "../../../../../packages/shared/src/catalog/nesting/nestingRules";

/**
 * ADR-248 Phase 4e-4e: the binding write (`dataBinding` holds the reference conversions the
 * Preview also reads; the command module stays out of the Preview's boot set — G5 bundle gate).
 */

/**
 * A bound collection with no item of its own draws its origin's first item per row — a library
 * position no selection reaches (2026-10-23 user report: after binding, no row could be selected
 * on the Canvas or in Layers). Binding it adds that item as its own node (its row template), as
 * the item 「+」 does; a collection that holds an item keeps it.
 */
function rowTemplateInsert(
  reader: CatalogReader,
  nodeId: NodeId,
  newId: NewId,
): CatalogCommand | undefined {
  const node = reader.getEntry(nodeId);
  if (node?.kind !== "node") return undefined;
  const typeOf = (definitionId: string) => {
    try {
      return definitionTypeName(reader, definitionId as never);
    } catch {
      return "";
    }
  };
  const rootId = (
    reader.library.definitions.get(node.definitionId as never) as
      { templateRootId?: string } | undefined
  )?.templateRootId;
  if (!rootId) return undefined;
  const templateOf = (id: string) =>
    reader.library.templates.get(id as never) as
      { definitionId: string; children: readonly string[] } | undefined;
  // The collection: the instance itself (ListBox · GridList · Tree), or its part (TagGroup's TagList).
  let path = [rootId];
  let collectionType = typeOf(node.definitionId);
  if (!CATALOG_EMPTY_STATE_COLLECTIONS.has(collectionType)) {
    const part = templateOf(rootId)?.children.find((id) =>
      CATALOG_EMPTY_STATE_COLLECTIONS.has(
        typeOf(templateOf(id)?.definitionId ?? ""),
      ),
    );
    if (!part) return undefined;
    path = [rootId, part];
    collectionType = typeOf(templateOf(part)!.definitionId);
  }
  const items = RAC_COLLECTION_CHILD_TYPES[collectionType] ?? [];
  const fill = node.descendantOverrides.find(
    (override) =>
      override.kind === "fillSlot" &&
      override.address.templatePath.join("/") === path.join("/"),
  ) as { childIds: readonly NodeId[] } | undefined;
  // (No own contents: the template's items show — they are the rows' template.)
  if (!fill) return undefined;
  const holdsItem = fill.childIds.some((id) => {
    const child = reader.getEntry(id);
    return child?.kind === "node" && items.includes(typeOf(child.definitionId));
  });
  if (holdsItem) return undefined;
  const item = templateOf(path[path.length - 1]!)
    ?.children.map(templateOf)
    .find((template) => template && typeOf(template.definitionId) === items[0]);
  if (!item) return undefined;
  const key = crypto.randomUUID();
  const id = newId("node") as NodeId;
  const entry: NodeEntry = {
    kind: "node",
    id,
    definitionId: item.definitionId as NodeEntry["definitionId"],
    children: [],
    props: { id: { kind: "set", value: key } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  return insertCollectionItem({
    host:
      path.length === 1
        ? { kind: "node", id: nodeId }
        : {
            kind: "descendant",
            ownerId: nodeId,
            address: { instances: [nodeId], templatePath: path as never },
          },
    entries: [entry],
    rootId: id,
    key,
    newId,
  });
}

/**
 * Set (or with `undefined` clear) the targets' binding — one step. With `newId`, a collection that
 * holds no item of its own gets its row template item in the same step (`rowTemplateInsert`).
 */
export const catalogBindingCommand = (
  targets: readonly EditTarget[],
  binding: DataBindingRef | undefined,
  newId?: NewId,
): CatalogCommand => {
  const bind = setWholeField({
    targets,
    field: "binding",
    value: binding,
    label: binding ? "Bind data" : "Unbind data",
  });
  if (!binding || !newId) return bind;
  return (reader) => {
    const stage = stageOver(reader);
    const first = bind(stage);
    stage.apply(first.ops);
    const ops: CatalogCommandPlan["ops"][number][] = [...first.ops];
    for (const target of targets) {
      if (target.kind !== "node") continue;
      const insert = rowTemplateInsert(stage, target.id, newId);
      if (!insert) continue;
      const plan = insert(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    }
    return { ...first, ops };
  };
};
