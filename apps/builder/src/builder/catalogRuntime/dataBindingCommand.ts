import {
  catalogRowItemGroups,
  clearRowTemplates,
  insertCollectionItem,
  insertTableRow,
  markRowTemplates,
  placeCascaderRowTemplate,
  setOwnRows,
  setWholeField,
  tableBodyPosition,
  type CatalogRowTemplateMode,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  CATALOG_REPEAT_TYPES,
  CATALOG_SECTION_TYPES,
  COLLECTION_TYPE_TABLE,
} from "../../../../../packages/shared/src/catalog/document/collectionItems";
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
import { catalogPaletteDefinitionId } from "./paletteInsert";
import { chartBindingRolesCommand } from "./chartRoleReconcile";
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
  mode: CatalogRowTemplateMode,
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
  // ADR-310 Phase 4: a Table with no Row of its own gets a plain Row — a cell per column — which
  // `markRowTemplates` then marks (its cells read their columns' fields).
  if (typeOf(node.definitionId) === "Table") {
    const body = tableBodyPosition(reader, nodeId);
    const holdsRow = catalogRowItemGroups(reader, nodeId).some((group) =>
      group.some((position) => position.target.kind === "node"),
    );
    if (!body || holdsRow) return undefined;
    const entry = (definitionId: string, children: NodeId[] = []) =>
      ({
        kind: "node",
        id: newId("node") as NodeId,
        definitionId: definitionId as NodeEntry["definitionId"],
        children,
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }) satisfies NodeEntry;
    return insertTableRow({
      body,
      buildRow: (columnCount) => {
        const cells = Array.from({ length: columnCount }, () =>
          entry(catalogPaletteDefinitionId(reader.library, "Cell")),
        );
        const row = entry(
          catalogPaletteDefinitionId(reader.library, "Row"),
          cells.map((cell) => cell.id),
        );
        return { entries: [row, ...cells], rootId: row.id };
      },
      newId,
      label: "Bind data",
    });
  }
  const rootId = (
    reader.library.definitions.get(node.definitionId as never) as
      { templateRootId?: string } | undefined
  )?.templateRootId;
  if (!rootId) return undefined;
  const templateOf = (id: string) =>
    reader.library.templates.get(id as never) as
      { definitionId: string; children: readonly string[] } | undefined;
  // ADR-322 Phase 4 · ADR-326 §4.2 — a Cascader's items sit in its level list box (`Popover >
  // CascaderList`): its row template is its own item there; the origin's sample items give way to
  // the rows (`placeCascaderRowTemplate` — not copied).
  if (typeOf(node.definitionId) === "Cascader") {
    const popoverId = templateOf(rootId)?.children.find(
      (id) => typeOf(templateOf(id)?.definitionId ?? "") === "Popover",
    );
    const listId = popoverId
      ? templateOf(popoverId)?.children.find(
          (id) => typeOf(templateOf(id)?.definitionId ?? "") === "CascaderList",
        )
      : undefined;
    if (!popoverId || !listId) return undefined;
    const path = [rootId, popoverId, listId];
    const fill = node.descendantOverrides.find(
      (override) =>
        override.kind === "fillSlot" &&
        override.address.templatePath.join("/") === path.join("/"),
    ) as { childIds: readonly NodeId[] } | undefined;
    // (Own items in the list box: `markRowTemplates` marks one.)
    if (
      fill?.childIds.some((id) => {
        const child = reader.getEntry(id);
        return (
          child?.kind === "node" &&
          typeOf(child.definitionId) === "CascaderItem"
        );
      })
    )
      return undefined;
    const sample = templateOf(listId)
      ?.children.map(templateOf)
      .find(
        (template) =>
          template && typeOf(template.definitionId) === "CascaderItem",
      );
    if (!sample) return undefined;
    const id = newId("node") as NodeId;
    // (「Keep the items」: the samples become its own static items and `markRowTemplates` below
    //  repeats a copy of the last after them, as for any collection — ADR-326 판독 h1: replacing
    //  the list dropped them and an edited name for good; 수리 검증 h3: a fresh item lost the
    //  last item's settings.)
    return placeCascaderRowTemplate({
      keepItems: mode === "keep",
      host: {
        kind: "descendant",
        ownerId: nodeId,
        address: { instances: [nodeId], templatePath: path as never },
      },
      newId,
      entry: {
        kind: "node",
        id,
        definitionId: sample.definitionId as NodeEntry["definitionId"],
        children: [],
        props: { id: { kind: "set", value: crypto.randomUUID() } },
        repeat: true,
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
    });
  }
  // The collection: the instance itself (ListBox · GridList · Tree), or its part (TagGroup's TagList).
  let path = [rootId];
  let collectionType = typeOf(node.definitionId);
  // (A collection whose items are its own children: one with an empty state (ListBox · GridList …)
  //  or a table owner without a list part that repeats its items — 판독 F4, an emptied Timeline
  //  got no row template.)
  const ownsItems =
    CATALOG_EMPTY_STATE_COLLECTIONS.has(collectionType) ||
    COLLECTION_TYPE_TABLE.some(
      (row) => row.owner === collectionType && !row.list && row.repeat,
    );
  if (!ownsItems) {
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
    .find((template) => template && typeOf(template.definitionId) === itemType);
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
      // ADR-310 ①: an item or section bound to data of its own is a run of its own rows (a
      // section's first item the template of each row's child rows — ②).
      const entry = stage.getEntry(target.id);
      let type = "";
      try {
        type =
          entry?.kind === "node"
            ? definitionTypeName(stage, entry.definitionId)
            : "";
      } catch {
        type = "";
      }
      if (CATALOG_REPEAT_TYPES.has(type)) {
        run(setOwnRows(target.id, !!binding && binding.key === undefined));
        if (CATALOG_SECTION_TYPES.has(type))
          run(
            binding
              ? markRowTemplates({ ownerId: target.id, mode, newId })
              : clearRowTemplates(target.id),
          );
        continue;
      }
      // ADR-312 Decision 10 — Chart 는 원천 (보기의 결과 schema · 해제면 표본) 에 역할을 맞춘다 (같은 step).
      if (type === "Chart")
        run(chartBindingRolesCommand(stage, target.id, binding));
      if (!binding) {
        run(clearRowTemplates(target.id));
        continue;
      }
      if (newId) run(rowTemplateInsert(stage, target.id, newId, mode));
      run(markRowTemplates({ ownerId: target.id, mode, newId }));
    }
    return { ...first, ops };
  };
};
