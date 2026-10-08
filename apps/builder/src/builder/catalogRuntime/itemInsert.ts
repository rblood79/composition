import {
  COLLECTION_FAMILIES,
  GROUP_ITEM_TYPES,
  GROUP_ITEMS_WRAPPER,
  insertCollectionItem,
  insertGroupItem,
  insertTableColumns,
  insertTableRow,
} from "../../../../../packages/shared/src/catalog/commands/collections";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  DescendantOverride,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
  NodeParent,
  PropWrites,
  LibraryTemplateId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogPosition } from "../../../../../packages/shared/src/catalog/resolution/positions";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "./paletteInsert";
import type { CatalogReadModel } from "./readModel";

/**
 * ADR-248 4e: the old Properties slot section's "+" (ADR-234/239/241 — `resolveSlotInsertAction`)
 * over the catalog commands — a list frame adds an item (a Tab with its TabPanel), a group adds an
 * item, a TableHeader a column (a cell per aligned row), a TableBody a row (a cell per column).
 * The old recommendation list is not in the new document (4e-4c-2g): a host offers its family's
 * item types, and a new item takes the definition of a sibling of that type (the shape the list
 * already shows), else the palette's.
 */
export interface CatalogItemInsertHost {
  readonly graph: CatalogGraph;
  readonly readModel: CatalogReadModel;
  readonly newId: NewId;
}
export interface CatalogItemInsertChoice {
  /** The item type the "+" adds. */
  readonly type: string;
  /** The insert command (new ids each call). */
  build(): CatalogCommand;
}

const COLUMN_ORIGIN =
  "lib:definition:origin-component-table-column" as NodeEntry["definitionId"];

const typeOf = (graph: CatalogGraph, definitionId: string) => {
  try {
    return definitionTypeName(graph, definitionId as NodeEntry["definitionId"]);
  } catch {
    return "";
  }
};
const parentOf = (position: CatalogPosition): NodeParent =>
  position.target.kind === "node"
    ? { kind: "node", id: position.target.id }
    : {
        kind: "descendant",
        ownerId: position.target.ownerId,
        address: position.target.address,
      };

/** ADR-251: items wrapper type → its group type (RadioItems → RadioGroup). */
const WRAPPER_GROUP: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(GROUP_ITEMS_WRAPPER).map(([group, wrapper]) => [
    wrapper,
    group,
  ]),
);

/**
 * The group node an items wrapper position belongs to (`insertGroupItem` takes a node): the
 * wrapper of a group instance's template, or an owned group's own wrapper node.
 */
function wrapperGroupHost(
  graph: CatalogGraph,
  position: CatalogPosition,
): NodeId | undefined {
  const { target } = position;
  if (target.kind === "descendant")
    return target.address.instances.length === 1 &&
      target.address.templatePath.length === 2
      ? target.ownerId
      : undefined;
  const owner = graph.ownerOf(target.id);
  const node = owner ? graph.getEntry(owner) : undefined;
  return node?.kind === "node" ? node.id : undefined;
}

/** The item types a position takes with "+" (the old slot host rules over the catalog families). */
function itemTypesOf(
  graph: CatalogGraph,
  type: string,
  position: CatalogPosition,
): readonly string[] {
  if (type === "TableHeader") return ["Column"];
  if (type === "TableBody") return ["Row"];
  const group = GROUP_ITEM_TYPES[type];
  // A group's items go to an owned group or a group instance (`insertGroupItem` takes a node).
  if (group) return position.target.kind === "node" ? group : [];
  // ADR-251: the items wrapper adds its group's items too (TagList adds Tags).
  const wrapped = WRAPPER_GROUP[type];
  if (wrapped)
    return wrapperGroupHost(graph, position) ? GROUP_ITEM_TYPES[wrapped] : [];
  const types = new Set<string>();
  for (const family of COLLECTION_FAMILIES) {
    if ((family.list ?? family.owner) === type) {
      types.add(family.item);
      if (family.section) types.add(family.section);
    }
    if (family.section === type) types.add(family.item);
    if (family.recursive && family.item === type) types.add(family.item);
  }
  return [...types];
}

/**
 * ADR-253 Phase 4 — pickers whose items sit in their ListBox (an instance of the ListBox origin,
 * hidden on the Canvas while the picker is closed — a Select's inside its Popover): the picker's
 * "+" adds the item there.
 */
const PICKER_LIST: Readonly<Record<string, string>> = {
  Select: "ListBox",
  ComboBox: "ListBox",
};

export function catalogItemInsertChoices(
  host: CatalogItemInsertHost,
  position: CatalogPosition,
): CatalogItemInsertChoice[] {
  const { graph, readModel, newId } = host;
  const type = typeOf(graph, position.definitionId);
  if (PICKER_LIST[type]) {
    // (A Select's list is in its Popover — ADR-256 Phase 6c, the reference's `Popover > ListBox`.)
    const rows = readModel.childRows(position);
    const list = [
      ...rows,
      ...rows
        .filter((row) => typeOf(graph, row.definitionId) === "Popover")
        .flatMap((row) => readModel.childRows(row)),
    ].find((row) => typeOf(graph, row.definitionId) === PICKER_LIST[type]);
    return list ? catalogItemInsertChoices(host, list) : [];
  }
  const types = itemTypesOf(graph, type, position);
  if (!types.length) return [];
  const own = readModel.childRows(position);
  // ADR-251: a group's items are its wrapper's children.
  const wrapperRow = GROUP_ITEMS_WRAPPER[type]
    ? own.find(
        (row) => typeOf(graph, row.definitionId) === GROUP_ITEMS_WRAPPER[type],
      )
    : undefined;
  const rows = wrapperRow ? readModel.childRows(wrapperRow) : own;
  /** A sibling's definition for an item type (the shape the host shows), else the palette's. */
  const definitionFor = (
    itemType: string,
    fallback?: NodeEntry["definitionId"],
  ) =>
    rows.find((row) => typeOf(graph, row.definitionId) === itemType)
      ?.definitionId ??
    fallback ??
    catalogPaletteDefinitionId(graph.library, itemType);
  const entry = (
    definitionId: NodeEntry["definitionId"],
    itemType: string,
    initialProps?: Record<string, unknown>,
    children: NodeId[] = [],
  ): NodeEntry => ({
    kind: "node",
    id: newId("node") as NodeId,
    definitionId,
    children,
    props: definitionId.startsWith("lib:")
      ? catalogCreationProps(
          graph.library,
          definitionId as LibraryDefinitionId,
          itemType,
          initialProps,
        )
      : Object.fromEntries(
          Object.entries(initialProps ?? {}).map(([key, value]) => [
            key,
            { kind: "set" as const, value: value as never },
          ]),
        ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  const parent = parentOf(position);
  /**
   * A list item's row fields: a library item origin whose template shows `{label}` ·
   * `{description}` · `{icon}` (the row template fields data rows fill) gets "Item <n>" for the
   * label and hides the description and icon parts, instead of drawing the bare placeholders (the
   * template's own items carry their texts). Root placeholders become own props, part
   * placeholders path overrides on the new instance.
   */
  const placeholderFill = (
    definitionId: NodeEntry["definitionId"],
    itemType: string,
  ): {
    props: Record<string, unknown>;
    patches: (nodeId: NodeId) => DescendantOverride[];
  } => {
    const definition = graph.library.definitions.get(
      definitionId as LibraryDefinitionId,
    ) as { mode?: string; templateRootId?: LibraryTemplateId } | undefined;
    const rootId = definition?.templateRootId;
    if (definition?.mode !== "composite" || !rootId)
      return { props: {}, patches: () => [] };
    const count = rows.filter(
      (row) => typeOf(graph, row.definitionId) === itemType,
    ).length;
    // A Tab or Tag reads like its siblings ("Tab 3"); other items "Item <n>".
    const label = `${itemType === "Tab" || itemType === "Tag" ? itemType : "Item"} ${count + 1}`;
    const fieldOf = (props: Readonly<Record<string, unknown>> | undefined) => {
      for (const key of ["children", "iconName"]) {
        const match =
          typeof props?.[key] === "string"
            ? /^\{(label|description|icon)\}$/.exec(props[key] as string)
            : null;
        if (match) return { key, field: match[1] };
      }
      return undefined;
    };
    const props: Record<string, unknown> = {};
    const root = graph.library.templates.get(rootId);
    const rootField = fieldOf(root?.props);
    if (rootField?.field === "label") props[rootField.key] = label;
    const parts: { path: LibraryTemplateId[]; field: string; key: string }[] =
      [];
    const visit = (path: LibraryTemplateId[], depth: number) => {
      const node = graph.library.templates.get(path[path.length - 1]!);
      for (const childId of (node?.children ?? []) as LibraryTemplateId[]) {
        const child = graph.library.templates.get(childId);
        const found = fieldOf(child?.props);
        if (found) parts.push({ path: [...path, childId], ...found });
        else if (depth < 3) visit([...path, childId], depth + 1);
      }
    };
    visit([rootId], 0);
    return {
      props,
      patches: (nodeId) =>
        parts.map(({ path, field, key }) => ({
          kind: "patch",
          address: { instances: [nodeId], templatePath: path },
          ...(field === "label"
            ? { props: { [key]: { kind: "set", value: label } } as PropWrites }
            : { enabled: false }),
        })),
    };
  };

  const build = (itemType: string): CatalogCommand => {
    if (itemType === "Column") {
      const columnDefinition = definitionFor("Column", COLUMN_ORIGIN);
      return insertTableColumns({
        header: parent,
        buildColumn: () => {
          const column = entry(columnDefinition, "Column");
          return { entries: [column], rootId: column.id };
        },
        buildCell: () => {
          const cell = entry(
            catalogPaletteDefinitionId(graph.library, "Cell"),
            "Cell",
          );
          return { entries: [cell], rootId: cell.id };
        },
        newId,
      });
    }
    if (itemType === "Row") {
      const row = rows.find(
        (child) => typeOf(graph, child.definitionId) === "Row",
      );
      const cellDefinition =
        (row &&
          readModel
            .childRows(row)
            .find((child) => typeOf(graph, child.definitionId) === "Cell")
            ?.definitionId) ??
        catalogPaletteDefinitionId(graph.library, "Cell");
      return insertTableRow({
        body: parent,
        buildRow: (columnCount) => {
          const cells = Array.from({ length: columnCount }, () =>
            entry(cellDefinition, "Cell"),
          );
          // (A plain Row like the palette's: a reusable row — a project component — brings its
          // own cells, ADR-256 Phase 5 Round 13.)
          const next = entry(
            rows.find(
              (child) =>
                typeOf(graph, child.definitionId) === "Row" &&
                child.definitionId.startsWith("lib:"),
            )?.definitionId ?? catalogPaletteDefinitionId(graph.library, "Row"),
            "Row",
            undefined,
            cells.map((cell) => cell.id),
          );
          return { entries: [next, ...cells], rootId: next.id };
        },
        newId,
      });
    }
    const groupHost =
      GROUP_ITEM_TYPES[type] && position.target.kind === "node"
        ? position.target.id
        : WRAPPER_GROUP[type]
          ? wrapperGroupHost(graph, position)
          : undefined;
    if (groupHost) {
      const item = entry(definitionFor(itemType), itemType);
      return insertGroupItem({
        hostId: groupHost,
        entries: [item],
        rootId: item.id,
        newId,
      });
    }
    // A collection item: a new key (Tab ↔ TabPanel pairing, selection); a section has none.
    const key = crypto.randomUUID();
    const section = COLLECTION_FAMILIES.some(
      (family) => family.section === itemType,
    );
    const itemDefinition = definitionFor(itemType);
    const fill = section
      ? { props: {}, patches: () => [] }
      : placeholderFill(itemDefinition, itemType);
    const created = entry(
      itemDefinition,
      itemType,
      section ? undefined : { id: key, ...fill.props },
    );
    const item: NodeEntry = {
      ...created,
      descendantOverrides: fill.patches(created.id),
    };
    const panels = itemType === "Tab";
    return insertCollectionItem({
      host: parent,
      entries: [item],
      rootId: item.id,
      key,
      ...(panels
        ? {
            panel: entry(
              catalogPaletteDefinitionId(graph.library, "TabPanel"),
              "TabPanel",
              { itemId: key },
            ),
          }
        : {}),
      newId,
    });
  };

  // A choice the commands refuse here (a TreeItem outside a Tree, unaligned table rows …) is not
  // offered.
  return types.flatMap((itemType) => {
    try {
      build(itemType)(graph);
      return [{ type: itemType, build: () => build(itemType) }];
    } catch {
      return [];
    }
  });
}
