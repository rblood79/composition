import {
  clearRowTemplates,
  insertCollectionItem,
  markRowTemplates,
  setWholeField,
  type CatalogRowTemplateMode,
} from "../../../../../packages/shared/src/catalog/commands";
import { COLLECTION_TYPE_TABLE } from "../../../../../packages/shared/src/catalog/document/collectionItems";
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
 * A collection with no item of its own has no row template (ADR-310 — the origin's items never are
 * one; 2026-10-23 user report: a library position no selection reaches). Binding it adds the
 * origin's item as its own node, marked `repeat`, as the item 「+」 adds one; a collection that
 * holds items marks one of them instead (`markRowTemplates`).
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
  // (No own contents: the origin's items show, static — ADR-310: they are never a row template.)
  if (!fill) return undefined;
  const holdsItem = fill.childIds.some((id) => {
    const child = reader.getEntry(id);
    return child?.kind === "node" && items.includes(typeOf(child.definitionId));
  });
  if (holdsItem) return undefined;
  // (The collection type table's item for this collection — ADR-310 Decision 7.)
  const itemType = COLLECTION_TYPE_TABLE.find(
    (row) => (row.list ?? row.owner) === collectionType,
  )?.item;
  const item = templateOf(path[path.length - 1]!)
    ?.children.map(templateOf)
    .find(
      (template) => template && typeOf(template.definitionId) === itemType,
    );
  if (!item) return undefined;
  const key = crypto.randomUUID();
  const id = newId("node") as NodeId;
  const entry: NodeEntry = {
    kind: "node",
    id,
    definitionId: item.definitionId as NodeEntry["definitionId"],
    children: [],
    props: { id: { kind: "set", value: key } },
    // (ADR-310: it is the rows' template.)
    repeat: true,
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
 * Set (or with `undefined` clear) the targets' binding — one step. Binding gives a collection its
 * rows' template (ADR-310): with `newId`, one that holds no item of its own gets its row template
 * item (`rowTemplateInsert`); one that holds items marks one by `mode` (Decision 2 — `template`
 * keeps the first and removes the rest, `keep` keeps them all static and repeats a copy after
 * them). Unbinding leaves the template as a static item.
 */
export const catalogBindingCommand = (
  targets: readonly EditTarget[],
  binding: DataBindingRef | undefined,
  newId?: NewId,
  mode: CatalogRowTemplateMode = "template",
): CatalogCommand => {
  const bind = setWholeField({
    targets,
    field: "binding",
    value: binding,
    label: binding ? "Bind data" : "Unbind data",
  });
  return (reader) => {
    const stage = stageOver(reader);
    const first = bind(stage);
    stage.apply(first.ops);
    const ops: CatalogCommandPlan["ops"][number][] = [...first.ops];
    const run = (command: CatalogCommand | undefined) => {
      if (!command) return;
      const plan = command(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    };
    for (const target of targets) {
      if (target.kind !== "node") continue;
      if (!binding) {
        run(clearRowTemplates(target.id));
        continue;
      }
      if (newId) run(rowTemplateInsert(stage, target.id, newId));
      run(markRowTemplates({ ownerId: target.id, mode, newId }));
    }
    return { ...first, ops };
  };
};
