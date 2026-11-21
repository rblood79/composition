import type {
  AuthoredValue,
  BreakpointName,
  CatalogReader,
  NodeEntry,
  NodeId,
  Scalar,
  TemplateId,
  WriteValue,
} from "../document/types";
import { COLLECTION_TYPE_TABLE } from "../document/collectionItems";
import { resolveTableColumnKey } from "../../collections/resolveCollectionItems";
import { descendantPatchOf } from "../document/types";
import { readPropSource } from "../resolution/fieldSource";
import {
  childPositions as positionRows,
  nodePosition,
  type CatalogPosition,
} from "../resolution/positions";
import { catalogNodeVisibleAt } from "../resolution/resolver";
import type { CatalogOperation } from "../transactions/transaction";
import type { CatalogCommand } from "./compose";
import {
  assertNestable,
  childList,
  CommandDraft,
  definitionTypeName,
  fail,
  overrideAt,
  parentAncestorTypes,
  setChildList,
  templateDefinitionId,
  type EditTarget,
  type NodeParent,
} from "./context";
import { setFields } from "./fields";
import { readTargetProp } from "./items";
import {
  ensureChildList,
  ownSlotContents,
  readTemplate,
  type NewId,
} from "./materialize";
import { catalogAppendIndex, removeWithReferrers, subtree } from "./structure";

/**
 * ADR-248 Phase 4b component-aware item insertion — the old Slot "+" planners (ADR-234 collection
 * items, ADR-237 group items, ADR-241 table columns and rows) as commands. Items are nodes; an
 * instance's list position is materialized into a `fillSlot` on first use, like the old mode C
 * children replacement. The caller builds the item records (it knows the item origins); the
 * command places them and keeps the owner's pairing, selection and expansion in step.
 */

/** Collection families (the old `STATIC_COLLECTION_FAMILIES` insertion fields). */
interface CollectionFamily {
  owner: string;
  /** The list frame type; `null` = the owner itself holds the items. */
  list: string | null;
  item: string;
  section?: string;
  /** Items hold items (TreeItem). */
  recursive?: boolean;
  /** Tabs: each Tab pairs with a TabPanel by key. */
  panels?: boolean;
}
// (ADR-310 Decision 7: the "+" families are the collection type table's `insert` rows. A Select ·
// ComboBox holds its items in its ListBox — an instance of the ListBox origin, ADR-253 Phase 4: the
// ListBox family places them.)
export const COLLECTION_FAMILIES: readonly CollectionFamily[] =
  COLLECTION_TYPE_TABLE.filter((row) => row.insert).map((row) => ({
    owner: row.owner,
    list: row.list ?? null,
    item: row.item,
    ...(row.section ? { section: row.section } : {}),
    ...(row.recursive ? { recursive: true } : {}),
    ...(row.pair ? { panels: true } : {}),
  }));

import {
  GROUP_ITEM_TYPES,
  GROUP_ITEMS_WRAPPER,
} from "../../domain/componentTraits";
import {
  catalogGroupSelectionStoreProp,
  catalogGroupSelectsMany,
} from "../runtime/groupSelection";

export { GROUP_ITEM_TYPES, GROUP_ITEMS_WRAPPER };

// ── Positions ─────────────────────────────────────────────────────────────

function positionType(draft: CommandDraft, parent: NodeParent): string {
  if (parent.kind === "page") return "";
  if (parent.kind === "node")
    return definitionTypeName(draft.reader, draft.node(parent.id).definitionId);
  const path = parent.address.templatePath;
  return definitionTypeName(
    draft.reader,
    templateDefinitionId(draft.reader, path[path.length - 1]),
  );
}
/** A node position's definition (an owned node's, or a template position's). */
function positionDefinition(
  draft: CommandDraft,
  parent: Exclude<NodeParent, { kind: "page" }>,
): NodeEntry["definitionId"] {
  if (parent.kind === "node") return draft.node(parent.id).definitionId;
  const path = parent.address.templatePath;
  return templateDefinitionId(draft.reader, path[path.length - 1]);
}
/** An instance's root position is the instance itself (it collapses into its root). */
function targetOf(parent: NodeParent): EditTarget | undefined {
  if (parent.kind === "page") return undefined;
  if (parent.kind === "node") return parent;
  if (
    parent.address.templatePath.length === 1 &&
    parent.address.instances.length === 1
  )
    return { kind: "node", id: parent.ownerId };
  return parent;
}
function parentOf(
  draft: CommandDraft,
  parent: NodeParent,
): NodeParent | undefined {
  if (parent.kind === "page") return undefined;
  if (parent.kind === "node") {
    const ownerId = draft.reader.ownerOf(parent.id);
    const owner = ownerId ? draft.read(ownerId) : undefined;
    if (owner?.kind === "page") return { kind: "page", id: owner.id };
    if (owner?.kind !== "node") return undefined;
    // An owned child of an instance's fillSlot sits in that template position.
    if (!owner.children.includes(parent.id))
      for (const item of owner.descendantOverrides)
        if (item.kind === "fillSlot" && item.childIds.includes(parent.id))
          return {
            kind: "descendant",
            ownerId: owner.id,
            address: item.address,
          };
    return { kind: "node", id: owner.id };
  }
  const path = parent.address.templatePath;
  if (path.length > 1)
    return {
      ...parent,
      address: { ...parent.address, templatePath: path.slice(0, -1) },
    };
  return parentOf(draft, { kind: "node", id: parent.ownerId });
}
/** The positions a parent shows as children (owned nodes, or its template children). */
function childPositions(draft: CommandDraft, parent: NodeParent): NodeParent[] {
  const list = childList(draft, parent);
  if (list) return list.map((id) => ({ kind: "node", id }));
  if (parent.kind !== "descendant") return [];
  const path = parent.address.templatePath;
  const templateId = path[path.length - 1];
  const template = templateId.startsWith("lib:")
    ? draft.reader.library.templates.get(templateId as `lib:template:${string}`)
    : draft.node(templateId);
  return (template?.children ?? []).map((child) => ({
    ...parent,
    address: {
      ...parent.address,
      templatePath: [...path, child as TemplateId],
    },
  }));
}
function positionId(parent: NodeParent): string {
  if (parent.kind !== "descendant") return parent.id;
  const path = parent.address.templatePath;
  return path[path.length - 1];
}
function readProp(
  reader: CatalogReader,
  parent: NodeParent,
  key: string,
): AuthoredValue | undefined {
  const target = targetOf(parent);
  return target ? readTargetProp(reader, target, key) : undefined;
}
const setProps = (
  reader: CatalogReader,
  target: EditTarget,
  props: Record<string, AuthoredValue>,
): CatalogOperation[] => [
  ...setFields({
    targets: [target],
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        { kind: "set", value } as WriteValue<AuthoredValue>,
      ]),
    ),
  })(reader).ops,
];

// ── Collection keys of copies ─────────────────────────────────────────────

/**
 * ADR-308 Decision 7 — the selection · expansion groups outside the item-command families whose
 * items carry a RAC key too: the node that holds the items, the item type, and its key prop (a
 * Radio's · a group Checkbox's is its `value`, as the reference's).
 */
const SELECTION_KEY_FAMILIES: readonly {
  host: string;
  item: string;
  prop: "id" | "value";
}[] = [
  { host: "CardView", item: "Card", prop: "id" },
  { host: "TableBody", item: "Row", prop: "id" },
  { host: "ToggleButtonGroup", item: "ToggleButton", prop: "id" },
  { host: "Accordion", item: "Disclosure", prop: "id" },
  { host: "SegmentedControl", item: "SegmentedControlItem", prop: "id" },
  { host: "RadioItems", item: "Radio", prop: "value" },
  { host: "CheckboxItems", item: "Checkbox", prop: "value" },
];
/** Item and section types: a node's `id` (a Radio's · a group Checkbox's `value`) is its RAC key. */
const KEYED_TYPES: ReadonlySet<string> = new Set([
  ...COLLECTION_FAMILIES.flatMap((row) =>
    row.section ? [row.item, row.section] : [row.item],
  ),
  ...SELECTION_KEY_FAMILIES.map((row) => row.item),
]);
/** The nodes that hold a collection's items (the owner, or its list frame). */
const KEY_HOST_TYPES: ReadonlySet<string> = new Set([
  ...COLLECTION_FAMILIES.map((row) => row.list ?? row.owner),
  ...SELECTION_KEY_FAMILIES.map((row) => row.host),
]);
/** A new group item's key stem (the Library origins' own keys: `option1`, `toggle-1`, `section-1`). */
const SELECTION_ITEM_KEY_STEMS: Readonly<Record<string, string>> = {
  Radio: "option",
  Checkbox: "option",
  ToggleButton: "toggle-",
  Disclosure: "section-",
};
/** The prop that holds a keyed type's key. */
const keyPropOf = (type: string): "id" | "value" =>
  SELECTION_KEY_FAMILIES.find((row) => row.item === type)?.prop ?? "id";

function typeNameOr(
  reader: CatalogReader,
  definitionId: NodeEntry["definitionId"],
): string {
  try {
    return definitionTypeName(reader, definitionId);
  } catch {
    return "";
  }
}

const keyOf = (value: unknown): string | undefined =>
  typeof value === "string" && value !== ""
    ? value
    : typeof value === "number"
      ? String(value)
      : undefined;

/** The keys a collection's items and sections already have (their authored `id`s, at any depth). */
function collectionKeys(draft: CommandDraft, host: NodeParent): Set<string> {
  const keys = new Set<string>();
  const { reader } = draft;
  const visit = (rows: readonly CatalogPosition[]) => {
    for (const row of rows) {
      const type = typeNameOr(reader, row.definitionId);
      if (KEY_HOST_TYPES.has(type)) continue;
      if (KEYED_TYPES.has(type)) {
        const key = keyOf(readTargetProp(reader, row.target, keyPropOf(type)));
        if (key !== undefined) keys.add(key);
      }
      visit(positionRows(reader, row));
    }
  };
  if (host.kind === "node")
    visit(positionRows(reader, nodePosition(reader, host.id)));
  else {
    // (A slot position's items, at any depth — a TreeItem's child items too: ADR-308 G1 (b), a
    //  duplicated parent TreeItem's children kept their keys beside the originals'.)
    const walk = (parent: NodeParent) => {
      for (const child of childPositions(draft, parent)) {
        const type = positionType(draft, child);
        if (KEY_HOST_TYPES.has(type)) continue;
        if (KEYED_TYPES.has(type)) {
          const key = keyOf(readProp(reader, child, keyPropOf(type)));
          if (key !== undefined) keys.add(key);
        }
        walk(child);
      }
    };
    walk(host);
  }
  return keys;
}

/**
 * ADR-310 Decision 4 — a Tab's paired TabPanels: the TabPanels (directly in its Tabs, or in an
 * authored TabPanels host) whose `itemId` is the Tab's key. A delete · duplicate of the Tab takes
 * them along in the same command, so no TabPanel is left without its Tab.
 */
export function catalogPairedTabPanels(
  draft: CommandDraft,
  tab: NodeParent,
): NodeParent[] {
  if (tab.kind === "page" || positionType(draft, tab) !== "Tab") return [];
  const key = keyOf(readProp(draft.reader, tab, "id"));
  if (key === undefined) return [];
  let tabs = parentOf(draft, tab);
  while (tabs && tabs.kind !== "page" && positionType(draft, tabs) !== "Tabs")
    tabs = parentOf(draft, tabs);
  if (!tabs || tabs.kind === "page") return [];
  const hosts = [
    tabs,
    ...childPositions(draft, tabs).filter(
      (child) => positionType(draft, child) === "TabPanels",
    ),
  ];
  return hosts
    .flatMap((host) => childPositions(draft, host))
    .filter(
      (child) =>
        positionType(draft, child) === "TabPanel" &&
        keyOf(readProp(draft.reader, child, "itemId")) === key,
    );
}

/**
 * 2026-11-08 (사용자 Preview 「Duplicate key "two" found in collection」): copies (duplicate · paste)
 * placed under `parent` keep their items' keys (`id`) only where the collection they join has none
 * of them — a key it already has takes a new one, since RAC throws on a repeated key for the whole
 * collection. A copy outside a collection (a whole group pasted on the page) keeps its keys: its
 * items form their own collection.
 */
export function catalogCopiesWithFreshKeys(
  draft: CommandDraft,
  parent: NodeParent,
  entries: readonly NodeEntry[],
  newId: NewId,
): NodeEntry[] {
  let host: NodeParent | undefined = parent;
  while (host && !KEY_HOST_TYPES.has(positionType(draft, host))) {
    if (!KEYED_TYPES.has(positionType(draft, host))) return [...entries];
    host = parentOf(draft, host);
  }
  if (!host) return [...entries];
  const taken = collectionKeys(draft, host);
  return entries.map((entry) => {
    const type = typeNameOr(draft.reader, entry.definitionId);
    const prop = keyPropOf(type);
    // (A record's prop is its authored write — `{ kind: "set", value }`.)
    const written = entry.props[prop];
    const key = written?.kind === "set" ? keyOf(written.value) : undefined;
    if (key === undefined || !taken.has(key) || !KEYED_TYPES.has(type))
      return entry;
    const fresh = String(newId("node")).split(":").pop()!;
    taken.add(fresh);
    return {
      ...entry,
      props: { ...entry.props, [prop]: { kind: "set", value: fresh } },
    };
  });
}

function place(
  draft: CommandDraft,
  parent: NodeParent,
  entries: readonly NodeEntry[],
  rootId: NodeId,
  newId: NewId,
): void {
  const root = entries.find((entry) => entry.id === rootId);
  if (!root) return void fail("ROOT_NOT_IN_ENTRIES", rootId);
  assertNestable(draft, parent, [root.definitionId]);
  for (const entry of entries) draft.create(entry);
  const list = ensureChildList(draft, parent, newId);
  const at = catalogAppendIndex(
    draft,
    list,
    [rootId],
    parentAncestorTypes(draft, parent)[0],
  );
  setChildList(draft, parent, [
    ...list.slice(0, at),
    rootId,
    ...list.slice(at),
  ]);
  ownSlotContents(draft, [rootId], newId);
}

// ── Collection items ──────────────────────────────────────────────────────

/** The owner's selection-key update for a newly selected item (old `selectionPatch`). */
function selectionPatch(
  reader: CatalogReader,
  owner: NodeParent,
  ownerType: string,
  key: string,
): Record<string, AuthoredValue> | null {
  const read = (name: string) => readProp(reader, owner, name);
  // (ADR-308 Decision 2: the group's stored key is the default prop — the controlled twin only
  //  where the group already holds it, since it is read first.)
  if (ownerType === "Tabs")
    return read("selectedKey") !== undefined
      ? { selectedKey: key }
      : { defaultSelectedKey: key };
  const prop =
    read("selectedKeys") !== undefined ? "selectedKeys" : "defaultSelectedKeys";
  const current = read(prop);
  if (current === "all") return null;
  if (read("selectionMode") === "single") return { [prop]: [key] };
  const keys = Array.isArray(current) ? current.map(String) : [];
  return { [prop]: [...keys, key] };
}

/** A TreeItem position's key: its `id`, prefixed by a parent item that is an instance. */
function treeItemKey(draft: CommandDraft, item: NodeParent): string {
  const id = readProp(draft.reader, item, "id");
  const own =
    typeof id === "string" && id !== ""
      ? id
      : typeof id === "number"
        ? String(id)
        : positionId(item);
  const parent = parentOf(draft, item);
  if (!parent || positionType(draft, parent) !== "TreeItem") return own;
  const isInstance =
    parent.kind === "node" &&
    (() => {
      const definitionId = draft.node(parent.id).definitionId;
      const definition = definitionId.startsWith("lib:")
        ? draft.reader.library.definitions.get(
            definitionId as `lib:definition:${string}`,
          )
        : draft.read(definitionId);
      return (
        !!definition && "mode" in definition && definition.mode === "composite"
      );
    })();
  return isInstance ? `${treeItemKey(draft, parent)}/${own}` : own;
}

/**
 * A library origin instance whose template root is its items' slot (a ListBox's · GridList's
 * "Items"): the item joins the slot's content, where the items it was placed with are — as a
 * group's does (`insertGroupItem` rootSlot, 2026-10-14). Appended to the node's own children it
 * stood after the slot, apart from the items the Design panel's slot lists (2026-10-22).
 */
function collectionRootSlot(
  draft: CommandDraft,
  host: NodeParent,
): NodeParent | undefined {
  if (host.kind !== "node") return undefined;
  const definitionId = draft.node(host.id).definitionId;
  if (!definitionId.startsWith("lib:")) return undefined;
  const definition = draft.reader.library.definitions.get(
    definitionId as `lib:definition:${string}`,
  );
  const root =
    definition?.mode === "composite" ? definition.templateRootId : undefined;
  return root && readTemplate(draft, root).slot
    ? {
        kind: "descendant",
        ownerId: host.id,
        address: { instances: [host.id], templatePath: [root as TemplateId] },
      }
    : undefined;
}

export const insertCollectionItem =
  (input: {
    /** The list frame (TabList, TagList, ListBox …), a section, or an item that holds items. */
    host: NodeParent;
    entries: readonly NodeEntry[];
    rootId: NodeId;
    /** The item's collection key (Tab ↔ TabPanel pairing, selection). */
    key: string;
    /** The chosen shape was the selected one: add the key to the owner's selection. */
    selectItem?: boolean;
    /** Tabs: the paired TabPanel record (placed directly in Tabs, or an authored TabPanels host). */
    panel?: NodeEntry;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const hostType = positionType(draft, input.host);
    const root = input.entries.find((entry) => entry.id === input.rootId);
    if (!root) return fail("ROOT_NOT_IN_ENTRIES", input.rootId);
    const itemType = definitionTypeName(reader, root.definitionId);
    const family = COLLECTION_FAMILIES.find(
      (row) =>
        ((row.list ?? row.owner) === hostType &&
          (itemType === row.item || itemType === row.section)) ||
        (row.section === hostType && itemType === row.item) ||
        (row.recursive && row.item === hostType && itemType === row.item),
    );
    if (!family)
      return fail("NOT_A_COLLECTION_HOST", `${hostType}>${itemType}`);
    const isSection = itemType === family.section;
    const itemHost = !!family.recursive && hostType === family.item;
    // A TreeItem holds items only inside its Tree (RAC builds Tree rows only there).
    let tree: NodeParent | undefined;
    if (itemHost && family.item === "TreeItem") {
      tree = parentOf(draft, input.host);
      while (tree && positionType(draft, tree) === "TreeItem")
        tree = parentOf(draft, tree);
      if (!tree || positionType(draft, tree) !== "Tree")
        fail("TREE_ITEM_OUTSIDE_TREE", positionId(input.host));
    }
    place(
      draft,
      collectionRootSlot(draft, input.host) ?? input.host,
      input.entries,
      input.rootId,
      input.newId,
    );
    if (family.panels) {
      const owner = parentOf(draft, input.host);
      const panels = owner
        ? childPositions(draft, owner).find(
            (child) => positionType(draft, child) === "TabPanels",
          )
        : undefined;
      const panelHost = panels ?? owner;
      if (panelHost) {
        if (!input.panel) fail("TAB_PANEL_REQUIRED", positionId(input.host));
        else
          place(
            draft,
            // (A placed Tabs holds its tab list and panels in its root slot — ADR-310 Phase 2.)
            collectionRootSlot(draft, panelHost) ?? panelHost,
            [input.panel],
            input.panel.id,
            input.newId,
          );
      }
    }
    const extra: CatalogOperation[] = [];
    if (input.selectItem && !isSection && !itemHost) {
      const owner =
        family.list === null && hostType !== family.section
          ? input.host
          : parentOf(draft, input.host);
      const target = owner && targetOf(owner);
      const patch = target
        ? selectionPatch(reader, owner!, family.owner, input.key)
        : null;
      if (target && patch) extra.push(...setProps(reader, target, patch));
    }
    if (tree) {
      const target = targetOf(tree);
      const key = treeItemKey(draft, input.host);
      const current = readProp(reader, tree, "expandedKeys");
      const keys = Array.isArray(current) ? current.map(String) : [];
      if (target && !keys.includes(key))
        extra.push(
          ...setProps(reader, target, { expandedKeys: [...keys, key] }),
        );
    }
    return {
      label: input.label ?? "Add item",
      ops: [...draft.ops(), ...extra],
      selectAfter: [input.rootId],
    };
  };

// ── Group items ───────────────────────────────────────────────────────────

/** ColorSwatch key = its color: a new swatch takes a color its siblings do not use. */
const SWATCH_COLORS = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FF8000",
  "#8000FF",
  "#0080FF",
  "#FF0080",
  "#80FF00",
  "#00FF80",
  "#000000",
  "#FFFFFF",
  "#808080",
];
function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}
function unusedSwatchColor(taken: ReadonlySet<string>): string {
  for (const color of SWATCH_COLORS) if (!taken.has(color)) return color;
  for (let step = 1; step < 4096; step += 1) {
    const color = hslToHex((step * 137.508) % 360, 70, 50);
    if (!taken.has(color)) return color;
  }
  return "#000000";
}

/**
 * Add an item to a group container (owned group or group instance; an instance's new item is
 * its own child, after the template's items). A selection item gets a key its group does not have
 * (ADR-308), a ColorSwatch an unused color (and the last swatch's box).
 */
/** A position's edit target as a command parent. */
function parentOfTarget(position: CatalogPosition): NodeParent {
  return position.target.kind === "node"
    ? { kind: "node", id: position.target.id }
    : {
        kind: "descendant",
        ownerId: position.target.ownerId,
        address: position.target.address,
      };
}
/**
 * ADR-260 follow-up: the group a user component's instance shows — its origin (the template root,
 * an instance of a library group) — as the resolver draws it under the instance: the rows under
 * the instance, the origin's id and its library template root (`undefined` = not such a host).
 */
function projectGroupLevel(
  draft: CommandDraft,
  hostId: NodeId,
  rootTemplate: string | undefined,
):
  | {
      rows: readonly CatalogPosition[];
      originId: NodeId;
      libraryRoot: string | undefined;
    }
  | undefined {
  if (!rootTemplate?.startsWith("project:node:")) return undefined;
  const origin = draft.node(rootTemplate);
  const definition = origin.definitionId.startsWith("lib:")
    ? draft.reader.library.definitions.get(
        origin.definitionId as `lib:definition:${string}`,
      )
    : undefined;
  return {
    rows: positionRows(draft.reader, nodePosition(draft.reader, hostId)),
    originId: origin.id,
    libraryRoot:
      definition?.mode === "composite" ? definition.templateRootId : undefined,
  };
}

export const insertGroupItem =
  (input: {
    hostId: NodeId;
    entries: readonly NodeEntry[];
    rootId: NodeId;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const host = draft.node(input.hostId);
    const groupType = definitionTypeName(reader, host.definitionId);
    const itemTypes = GROUP_ITEM_TYPES[groupType];
    const root = input.entries.find((entry) => entry.id === input.rootId);
    if (!itemTypes || !root) return fail("NOT_A_GROUP_HOST", groupType);
    const itemType = definitionTypeName(reader, root.definitionId);
    if (!itemTypes.includes(itemType))
      return fail("NOT_A_GROUP_ITEM", `${groupType}>${itemType}`);
    const hostDefinition = host.definitionId.startsWith("lib:")
      ? reader.library.definitions.get(
          host.definitionId as `lib:definition:${string}`,
        )
      : reader.getEntry(host.definitionId);
    const rootTemplate =
      hostDefinition &&
      "mode" in hostDefinition &&
      hostDefinition.mode === "composite" &&
      hostDefinition.templateRootId
        ? hostDefinition.templateRootId
        : undefined;
    // ADR-260 follow-up: an instance of a user component whose origin is a group (a RadioGroup
    // made a component) adds to that group as the instance shows it — the group's items wrapper
    // or root slot through the origin's own composite (`positions.ts`, the resolver's rows), its
    // current items the origin's (Decision 11).
    const inner = projectGroupLevel(draft, host.id, rootTemplate);
    // The host's children: the instance's template positions, then its own children.
    const hostChildren: NodeParent[] = inner
      ? inner.rows.map(parentOfTarget)
      : [
          ...(rootTemplate
            ? childPositions(draft, {
                kind: "descendant",
                ownerId: host.id,
                address: { instances: [host.id], templatePath: [rootTemplate] },
              })
            : []),
          ...host.children.map((id): NodeParent => ({ kind: "node", id })),
        ];
    // ADR-251: the items live in the wrapper node (a template position of an instance, or an
    // owned node); the item goes there and its siblings are the wrapper's children.
    const wrapperType = GROUP_ITEMS_WRAPPER[groupType];
    // A group whose template root is its items' slot (ToggleButtonGroup "Buttons", ButtonGroup,
    // AvatarGroup, Nav, Accordion): the item joins the slot's content, where the items the
    // group starts with are (2026-10-14 — appended to the instance's own children it stood after
    // the slot and the Design panel's slot list did not show it).
    const slotRoot = inner ? inner.libraryRoot : rootTemplate;
    const rootSlot =
      slotRoot?.startsWith("lib:") &&
      reader.library.templates.get(slotRoot as `lib:template:${string}`)?.slot
        ? ({
            kind: "descendant",
            ownerId: host.id,
            address: {
              instances: inner ? [host.id, inner.originId] : [host.id],
              templatePath: [slotRoot as TemplateId],
            },
          } as NodeParent)
        : undefined;
    // (The wrapper may sit in a layout frame — S2 ActionBar's `div` around its ActionButtonGroup.)
    const isWrapper = (parent: NodeParent) =>
      positionType(draft, parent) === wrapperType;
    const wrapperRow =
      inner && wrapperType
        ? (inner.rows.find((row) => isWrapper(parentOfTarget(row))) ??
          inner.rows
            .filter(
              (row) => positionType(draft, parentOfTarget(row)) === "frame",
            )
            .flatMap((row) => positionRows(reader, row))
            .find((row) => isWrapper(parentOfTarget(row))))
        : undefined;
    const container: NodeParent = wrapperType
      ? (hostChildren.find(isWrapper) ??
        hostChildren
          .filter((child) => positionType(draft, child) === "frame")
          .flatMap((child) => childPositions(draft, child))
          .find(isWrapper) ??
        fail("NO_ITEMS_WRAPPER", groupType))
      : (rootSlot ?? { kind: "node", id: host.id });
    const containerChildren = wrapperType
      ? (childList(draft, container)?.map((id): NodeParent => ({
          kind: "node",
          id,
        })) ??
        (wrapperRow
          ? positionRows(reader, wrapperRow).map(parentOfTarget)
          : childPositions(draft, container)))
      : hostChildren;
    const siblings = containerChildren.filter((sibling) =>
      itemTypes.includes(positionType(draft, sibling)),
    );
    const typed = (type: string) =>
      siblings.filter((sibling) => positionType(draft, sibling) === type);
    const own = (key: string) => {
      const write = root.props[key];
      return write?.kind === "set" ? write.value : undefined;
    };
    let item: NodeEntry = root;
    const setOwn = (key: string, value: AuthoredValue) => {
      item = {
        ...item,
        props: { ...item.props, [key]: { kind: "set", value } },
      };
    };
    // ADR-308 Decision 1: a selection group's new item takes a key its group does not have yet — a
    // Radio's · group Checkbox's `value`, a ToggleButton's · Disclosure's · SegmentedControlItem's
    // `id`. A copy of a sibling brings that sibling's key, so a taken one is renamed too.
    const keyFamily = SELECTION_KEY_FAMILIES.find(
      (row) => row.item === itemType,
    );
    if (keyFamily) {
      const peers = typed(itemType);
      const taken = new Set(
        peers.map((peer) =>
          String(readProp(reader, peer, keyFamily.prop) ?? ""),
        ),
      );
      const current = keyOf(own(keyFamily.prop));
      if (current === undefined || taken.has(current)) {
        const stem = SELECTION_ITEM_KEY_STEMS[itemType] ?? "item-";
        let n = peers.length + 1;
        while (taken.has(`${stem}${n}`)) n += 1;
        setOwn(keyFamily.prop, `${stem}${n}`);
      }
    }
    // ADR-256 Phase 5b: a picker item takes an unused color; one made empty gets the reference's
    // ColorSwatch inside (the last item's swatch box — the origin's 28 × 28 by default).
    const added: NodeEntry[] = [];
    if (itemType === "ColorSwatchPickerItem") {
      const items = typed("ColorSwatchPickerItem");
      if (own("color") === undefined) {
        const taken = new Set(
          items.map((swatch) =>
            String(readProp(reader, swatch, "color") ?? "")
              .trim()
              .toUpperCase(),
          ),
        );
        setOwn("color", unusedSwatchColor(taken));
      }
      if (!item.children.length) {
        const last = items[items.length - 1];
        const lastSwatch = last ? childPositions(draft, last)[0] : undefined;
        const source =
          lastSwatch?.kind === "node" ? draft.node(lastSwatch.id) : undefined;
        // (The last item's swatch definition, else the ColorSwatch origin.)
        const swatchDefinition =
          lastSwatch && lastSwatch.kind !== "page"
            ? positionDefinition(draft, lastSwatch)
            : undefined;
        const swatch: NodeEntry = {
          kind: "node",
          id: input.newId("node"),
          definitionId:
            swatchDefinition ?? "lib:definition:origin-component-colorswatch",
          children: [],
          props: {},
          visual: source
            ? { ...source.visual }
            : {
                width: { kind: "set", value: 28 },
                height: { kind: "set", value: 28 },
              },
          sizing: source ? { ...source.sizing } : {},
          descendantOverrides: [],
        };
        added.push(swatch);
        item = { ...item, children: [...item.children, swatch.id] };
      }
    }
    const entries = [
      ...input.entries.map((entry) => (entry.id === item.id ? item : entry)),
      ...added,
    ];
    // ADR-308: a new item's selection is its group's keys — an item that comes Selected (a copy of
    // a selected sibling's props) gives the group its key instead (one key while it selects one) and
    // keeps no `isSelected` of its own.
    const comesSelected = own("isSelected") === true;
    const placed = comesSelected
      ? entries.map((entry) => {
          if (entry.id !== item.id) return entry;
          const { isSelected: _selected, ...props } = entry.props;
          return { ...entry, props };
        })
      : entries;
    place(draft, container, placed, input.rootId, input.newId);
    const extra: CatalogOperation[] = [];
    const store = catalogGroupSelectionStoreProp(groupType);
    const keyProp = keyPropOf(itemType);
    const newKey = keyOf(
      (item.props[keyProp] as { value?: unknown } | undefined)?.value,
    );
    if (comesSelected && store && newKey !== undefined) {
      const hostProps = Object.fromEntries(
        ["selectionMode", store].map((name) => [
          name,
          readTargetProp(reader, { kind: "node", id: host.id }, name),
        ]),
      );
      const many = catalogGroupSelectsMany(groupType, hostProps);
      const current = hostProps[store];
      const keys = Array.isArray(current) ? current.map(String) : [];
      draft.write({
        ...draft.node(host.id),
        props: {
          ...draft.node(host.id).props,
          [store]: {
            kind: "set",
            value: many
              ? [...keys.filter((key) => key !== newKey), newKey]
              : store.endsWith("Keys")
                ? [newKey]
                : newKey,
          },
        },
      });
    }
    return {
      label: input.label ?? "Add item",
      ops: [...draft.ops(), ...extra],
      selectAfter: [input.rootId],
    };
  };

// ── Table columns and rows ────────────────────────────────────────────────

export interface TableColumnSpec {
  key: string;
  label: string;
}
/** A column key as the table reads it (`key`, else its text, else its id — ADR-241). */
function columnKey(
  reader: CatalogReader,
  column: NodeParent,
  index: number,
): string {
  // (One rule with the reader — `resolveTableColumnKey`, ADR-315 Phase 1.)
  return resolveTableColumnKey(
    {
      key: readProp(reader, column, "key"),
      children: readProp(reader, column, "children"),
      id: readProp(reader, column, "id"),
    },
    index,
  );
}
/**
 * Tables whose header and body hold the column and row nodes: RAC `Table` (ADR-256 Phase 5i — RAC
 * throws when a row's cell count differs from the column count; ADR-277 — the table is one type).
 */
const TABLE_OWNERS: ReadonlySet<string> = new Set(["Table"]);
function tableBodyOf(
  draft: CommandDraft,
  header: NodeParent,
): NodeParent | undefined {
  return tableRowGroupsOf(draft, header).find(
    (part) => positionType(draft, part) === "TableBody",
  );
}
/**
 * A Table's row groups — its TableBody and its totals row's TableFooter (ADR-315 Phase 5 증분 5c):
 * every row of either is aligned with the header's columns (RAC throws on a row whose cell count
 * differs from the column count), so a column command takes both along.
 */
function tableRowGroupsOf(
  draft: CommandDraft,
  header: NodeParent,
): NodeParent[] {
  const owner = parentOf(draft, header);
  if (!owner || !TABLE_OWNERS.has(positionType(draft, owner))) return [];
  return childPositions(draft, owner).filter((child) =>
    TABLE_ROW_GROUPS.has(positionType(draft, child)),
  );
}
const TABLE_ROW_GROUPS: ReadonlySet<string> = new Set([
  "TableBody",
  "TableFooter",
]);

/**
 * The TableHeader position a Table shows — an owned child, or its template's header position in
 * an instance (quick connect's column target, ADR-248 4e-4e). Undefined without one.
 */
export function tableHeaderPosition(
  reader: CatalogReader,
  tableId: NodeId,
): NodeParent | undefined {
  return headerPositionIn(new CommandDraft(reader), tableId);
}
/** The TableBody position a Table shows (as `tableHeaderPosition`). Undefined without one. */
export function tableBodyPosition(
  reader: CatalogReader,
  tableId: NodeId,
): NodeParent | undefined {
  const draft = new CommandDraft(reader);
  const header = headerPositionIn(draft, tableId);
  return header ? tableBodyOf(draft, header) : undefined;
}
function headerPositionIn(
  draft: CommandDraft,
  tableId: NodeId,
): NodeParent | undefined {
  const reader = draft.reader;
  const node = draft.read(tableId);
  if (node?.kind !== "node") return undefined;
  const definition = node.definitionId.startsWith("lib:")
    ? reader.library.definitions.get(
        node.definitionId as `lib:definition:${string}`,
      )
    : reader.getEntry(node.definitionId);
  const rootTemplate =
    definition && "templateRootId" in definition
      ? (definition.templateRootId as TemplateId | undefined)
      : undefined;
  let level: NodeParent[] = [
    rootTemplate
      ? {
          kind: "descendant",
          ownerId: tableId,
          address: { instances: [tableId], templatePath: [rootTemplate] },
        }
      : { kind: "node", id: tableId },
  ];
  for (let depth = 0; depth < 4 && level.length; depth++) {
    const found = level.find(
      (position) => positionType(draft, position) === "TableHeader",
    );
    if (found) return found;
    level = level.flatMap((position) => childPositions(draft, position));
  }
  return undefined;
}

/** ADR-310 Phase 4 — a new column's cell in a bound Table's Row template reads its field. */
function templateCell(
  draft: CommandDraft,
  rowId: NodeId,
  cell: { entries: NodeEntry[]; rootId: NodeId },
  key: string,
): { entries: NodeEntry[]; rootId: NodeId } {
  // (A totals row's cells read their column's aggregate the same way — ADR-315 Phase 5 증분 5c.)
  const totals =
    !draft.node(rowId).repeat &&
    positionType(
      draft,
      parentOf(draft, { kind: "node", id: rowId }) ?? {
        kind: "node",
        id: rowId,
      },
    ) === "TableFooter";
  if (!draft.node(rowId).repeat && !totals) return cell;
  return {
    ...cell,
    entries: cell.entries.map((entry) =>
      entry.id === cell.rootId && !entry.children.length
        ? {
            ...entry,
            props: {
              ...entry.props,
              children: { kind: "set" as const, value: `{${key}}` },
            },
          }
        : entry,
    ),
  };
}
/**
 * ADR-310 Phase 4 — a bound Table's Row template shows each column's field: its own cells with no
 * content of their own (no child node, text without a `{field}`) read `{<column key>}`, by place.
 * A cell holding nodes (a Badge) keeps them — they repeat as they are.
 */
export function fillTableTemplateCells(
  draft: CommandDraft,
  tableId: NodeId,
  rowId: NodeId,
): void {
  const header = headerPositionIn(draft, tableId);
  if (!header) return;
  const columns = partChildren(draft, header);
  const keys = columns.map((column, index) =>
    columnKey(draft.reader, column, index),
  );
  // A Column read under its label (no `key`) keeps that key: the template cell now names the
  // field, so a later label edit must not move the column's key (its sort) off the cell's field.
  columns.forEach((column, index) => {
    if (column.kind !== "node" || tableSelectionPart(draft, column)) return;
    const node = draft.node(column.id);
    if (node.props.key?.kind === "set") return;
    draft.write({
      ...node,
      props: { ...node.props, key: { kind: "set", value: keys[index]! } },
    });
  });
  rowCells(draft, { kind: "node", id: rowId }).forEach((cell, index) => {
    const key = keys[index];
    if (cell.kind !== "node" || key === undefined) return;
    const node = draft.node(cell.id);
    if (node.children.length) return;
    const text = readProp(draft.reader, cell, "children");
    if (typeof text === "string" && /\{[^{}]+\}/.test(text)) return;
    draft.write({
      ...node,
      props: { ...node.props, children: { kind: "set", value: `{${key}}` } },
    });
  });
}

/** A composite instance's template root position — its template children show before its own. */
function compositeRootOf(
  draft: CommandDraft,
  position: NodeParent,
): NodeParent | undefined {
  if (position.kind !== "node") return undefined;
  const { definitionId } = draft.node(position.id);
  const definition = definitionId.startsWith("lib:")
    ? draft.reader.library.definitions.get(
        definitionId as `lib:definition:${string}`,
      )
    : draft.reader.getEntry(definitionId);
  const rootId =
    definition && "templateRootId" in definition
      ? (definition.templateRootId as TemplateId | undefined)
      : undefined;
  return rootId
    ? {
        kind: "descendant",
        ownerId: position.id,
        address: { instances: [position.id], templatePath: [rootId] },
      }
    : undefined;
}
/**
 * The positions a table part shows as children, hidden ones included: a component instance's
 * (a reusable Row — ADR-256 Phase 5 Round 12) template children, then its own.
 */
function partChildren(draft: CommandDraft, position: NodeParent): NodeParent[] {
  const root = compositeRootOf(draft, position);
  return [
    ...(root ? childPositions(draft, root) : []),
    ...childPositions(draft, position),
  ];
}
/**
 * S2 TableView's selection column (2026-11-18): a Column · Cell holding `Checkbox[slot=selection]`
 * (as its child or inside a frame in it — `catalogTableSelectionColumn`, read on the document). The
 * column the Table origin starts with; adding rows and columns keeps it (S2 adds it itself).
 */
function tableSelectionPart(draft: CommandDraft, part: NodeParent): boolean {
  const holds = (position: NodeParent, depth: number): boolean =>
    partChildren(draft, position).some(
      (child) =>
        (positionType(draft, child) === "Checkbox" &&
          readProp(draft.reader, child, "slot") === "selection") ||
        (depth > 0 && holds(child, depth - 1)),
    );
  return holds(part, 1);
}
/** The selection Checkbox a new Row's cell in the selection column holds (as the origin's). */
function selectionCheckboxEntry(newId: NewId): NodeEntry {
  return {
    kind: "node",
    id: newId("node") as NodeId,
    definitionId: "lib:definition:origin-component-checkbox",
    children: [],
    props: {
      slot: { kind: "set", value: "selection" },
      children: { kind: "set", value: "" },
    },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  } as NodeEntry;
}
function positionKey(position: NodeParent): string {
  return position.kind === "descendant"
    ? `${position.ownerId}|${position.address.instances.join(",")}|${position.address.templatePath.join(",")}`
    : position.id;
}
/** The hiding fields at a position: its own (a node) or its patch over its template's. */
function hidingAt(
  draft: CommandDraft,
  position: NodeParent,
): Pick<NodeEntry, "enabled" | "visibility"> {
  if (position.kind === "page") return {};
  if (position.kind === "node") {
    const { enabled, visibility } = draft.node(position.id);
    return { enabled, visibility };
  }
  const override = overrideAt(draft.node(position.ownerId), position.address);
  const patch = descendantPatchOf(override);
  const templateId = position.address.templatePath.at(-1)!;
  const template = (
    templateId.startsWith("lib:")
      ? draft.reader.library.templates.get(
          templateId as `lib:template:${string}`,
        )
      : draft.read(templateId)
  ) as Pick<NodeEntry, "enabled" | "visibility"> | undefined;
  return {
    enabled: patch?.enabled ?? template?.enabled,
    visibility: patch?.visibility ?? template?.visibility,
  };
}
/** Whether a position shows at a breakpoint (the resolver's `enabled` and `visibility`). */
function shownAt(
  draft: CommandDraft,
  position: NodeParent,
  breakpoint: BreakpointName,
): boolean {
  const hiding = hidingAt(draft, position);
  return hiding.enabled !== false && catalogNodeVisibleAt(hiding, breakpoint);
}
/**
 * ADR-257 Phase 2 — a cell's column span (RAC `Cell colSpan`, a whole number ≥ 1; default 1),
 * read from `draft` for an owned cell (a command's result), else from its template position.
 */
function cellSpanAt(draft: CommandDraft, cell: NodeParent): number {
  let value: unknown;
  if (cell.kind === "node") {
    const write = draft.node(cell.id).props.colSpan;
    value = write?.kind === "set" ? write.value : undefined;
  } else value = readProp(draft.reader, cell, "colSpan");
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : 1;
}
/** The columns a row's cells take (RAC's `colIndex + colSpan` — the sum of their spans). */
/**
 * ADR-315 Phase 5 증분 5e — a table row's cells: its parts but a nested Row (its detail row — the
 * template Row's 「Detail」 Row, RAC's nested `<Row>` after the cells). Column commands count ·
 * move · add cells among these; a detail row stays after them.
 */
function rowCells(draft: CommandDraft, row: NodeParent): NodeParent[] {
  return partChildren(draft, row).filter(
    (part) => positionType(draft, part) !== "Row",
  );
}
/** A row's own child list without its cells: its detail row (kept after the cells). */
function rowDetailIds(draft: CommandDraft, rowId: NodeId): NodeId[] {
  return draft
    .node(rowId)
    .children.filter(
      (id) => positionType(draft, { kind: "node", id }) === "Row",
    );
}
function spanSum(draft: CommandDraft, cells: readonly NodeParent[]): number {
  return cells.reduce((sum, cell) => sum + cellSpanAt(draft, cell), 0);
}
/** The cell of `cells` covering column `index` (spans counted), and whether it spans others. */
function cellAtColumn(
  draft: CommandDraft,
  cells: readonly NodeParent[],
  index: number,
): { cell: NodeParent; span: number } | undefined {
  let start = 0;
  for (const cell of cells) {
    const span = cellSpanAt(draft, cell);
    if (index < start + span) return { cell, span };
    start += span;
  }
  return undefined;
}

const TABLE_BREAKPOINTS: readonly BreakpointName[] = [
  "desktop",
  "tablet",
  "mobile",
];

/**
 * ADR-256 Phase 5i-3 — whether a RAC Table is aligned (G0 ⑨: RAC throws when a row's cell count
 * differs from the column count): at every breakpoint, each shown row shows as many cells as the
 * header shows columns (`enabled` · `visibility` — Round 12), read from `draft` (a command's
 * result). Undefined for any node that is not a RAC Table.
 */
export function tableAlignedIn(
  draft: CommandDraft,
  tableId: NodeId,
): boolean | undefined {
  const table = draft.read(tableId);
  if (
    table?.kind !== "node" ||
    definitionTypeName(draft.reader, table.definitionId) !== "Table"
  )
    return undefined;
  const header = headerPositionIn(draft, tableId);
  if (!header) return undefined;
  const groups = tableRowGroupsOf(draft, header);
  const columns = partChildren(draft, header);
  const rowsOf = (group: NodeParent) =>
    partChildren(draft, group).map((row) => ({
      row,
      cells: rowCells(draft, row),
    }));
  return TABLE_BREAKPOINTS.every((breakpoint) => {
    const shown = (position: NodeParent) =>
      shownAt(draft, position, breakpoint);
    const count = shown(header) ? columns.filter(shown).length : 0;
    // (Each row group — the body, a totals row's footer — its shown rows against the columns.)
    return groups.every(
      (group) =>
        !shown(group) ||
        rowsOf(group).every(
          ({ row, cells }) =>
            !shown(row) || spanSum(draft, cells.filter(shown)) === count,
        ),
    );
  });
}

/** A RAC Table column's header and the rows aligned with it (as many cells as columns). */
function tableColumnGrid(draft: CommandDraft, column: NodeParent) {
  if (column.kind === "page" || positionType(draft, column) !== "Column")
    return undefined;
  const header = parentOf(draft, column);
  const table = header ? parentOf(draft, header) : undefined;
  if (
    !header ||
    !table ||
    positionType(draft, header) !== "TableHeader" ||
    positionType(draft, table) !== "Table"
  )
    return undefined;
  const columns = partChildren(draft, header);
  // (The body's rows and a totals row's — ADR-315 Phase 5 증분 5c.)
  const rows = tableRowGroupsOf(draft, header)
    .flatMap((group) => partChildren(draft, group))
    .flatMap((row) => {
      const cells = rowCells(draft, row);
      return spanSum(draft, cells) === columns.length ? [{ row, cells }] : [];
    });
  return { header, columns, rows };
}

/**
 * ADR-256 Phase 5i-3 — the cells a RAC Table column takes along when it is deleted or hidden: the
 * cell at the column's place in every row aligned with the header (G0 ⑨ — one transaction). A
 * reusable row's template cell is a position (Round 12). Empty for a non-Column.
 */
export function tableColumnCells(
  draft: CommandDraft,
  column: NodeParent,
): NodeParent[] {
  const grid = tableColumnGrid(draft, column);
  if (!grid) return [];
  const index = grid.columns.findIndex(
    (position) => positionKey(position) === positionKey(column),
  );
  if (index < 0) return [];
  // (ADR-257 Phase 2: a cell spanning more columns stays — `tableColumnSpanningCells`.)
  return grid.rows.flatMap(({ cells }) => {
    const at = cellAtColumn(draft, cells, index);
    return at && at.span === 1 ? [at.cell] : [];
  });
}

/**
 * ADR-257 Phase 2 — the cells spanning a RAC Table column together with others (`colSpan` > 1):
 * a delete of the column narrows them by one (`colSpan − 1`) instead of taking them along.
 */
export function tableColumnSpanningCells(
  draft: CommandDraft,
  column: NodeParent,
): { cell: NodeParent; span: number }[] {
  const grid = tableColumnGrid(draft, column);
  if (!grid) return [];
  const index = grid.columns.findIndex(
    (position) => positionKey(position) === positionKey(column),
  );
  if (index < 0) return [];
  return grid.rows.flatMap(({ cells }) => {
    const at = cellAtColumn(draft, cells, index);
    return at && at.span > 1 ? [at] : [];
  });
}

/**
 * ADR-257 Phase 2 — a RAC Table cell's column span (`colSpan`) set with its row kept aligned (RAC
 * throws when a row's spans do not add up to the column count — G0 ⑨): a wider span takes the
 * cells to its right (their spans must fit exactly), a narrower one leaves new empty cells
 * (`buildCell`, needs `newId`). Only an owned cell in an owned row list.
 */
export const setTableCellSpan =
  (input: {
    cell: NodeId;
    span: number;
    buildCell?: (rowId: string) => { entries: NodeEntry[]; rootId: NodeId };
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    if (!Number.isInteger(input.span) || input.span < 1)
      fail("PROP_TYPE_MISMATCH", `${input.cell}.colSpan`);
    const rowId = reader.ownerOf(input.cell);
    const row = rowId ? draft.read(rowId) : undefined;
    if (
      row?.kind !== "node" ||
      definitionTypeName(reader, row.definitionId) !== "Row" ||
      !row.children.includes(input.cell)
    )
      return fail("TABLE_CELLS_NOT_ALIGNED", input.cell);
    const cellPosition: NodeParent = { kind: "node", id: input.cell };
    const delta = input.span - cellSpanAt(draft, cellPosition);
    let children = [...row.children];
    const at = children.indexOf(input.cell);
    if (delta > 0) {
      let rest = delta;
      const taken: NodeId[] = [];
      for (const id of children.slice(at + 1)) {
        if (rest === 0) break;
        const span = cellSpanAt(draft, { kind: "node", id });
        if (span > rest) break;
        taken.push(id);
        rest -= span;
      }
      if (rest !== 0) return fail("TABLE_CELLS_NOT_ALIGNED", input.cell);
      children = children.filter((id) => !taken.includes(id));
      draft.write({ ...draft.node(row.id), children });
      removeWithReferrers(
        draft,
        taken.flatMap((id) => subtree(draft, id)),
      );
    } else if (delta < 0) {
      if (!input.buildCell) return fail("TABLE_CELLS_NOT_ALIGNED", input.cell);
      const added = Array.from({ length: -delta }, () =>
        input.buildCell!(row.id),
      );
      for (const cell of added)
        for (const entry of cell.entries) draft.create(entry);
      children.splice(at + 1, 0, ...added.map((cell) => cell.rootId));
      draft.write({ ...draft.node(row.id), children });
    }
    const cell = draft.node(input.cell);
    const { colSpan: _colSpan, ...props } = cell.props;
    draft.write({
      ...cell,
      props:
        input.span === 1
          ? props
          : { ...props, colSpan: { kind: "set", value: input.span } },
    });
    return { label: input.label ?? "Edit column span", ops: draft.ops() };
  };

/**
 * ADR-256 Phase 5i-3 — a RAC Table header's column order and its aligned rows' cells, before a
 * command reorders the columns: `follow` (after the command's writes) gives every such row its
 * cells in the header's new column order — RAC pairs a row's cells with the columns by place. A
 * reusable row's template cells cannot be reordered in one table: such a reorder is refused
 * (Round 12). Undefined when `columnId` is not a Column of a RAC Table.
 */
export function tableColumnOrder(
  draft: CommandDraft,
  columnId: NodeId,
  newId: NewId,
): { follow(): void } | undefined {
  const grid = tableColumnGrid(draft, { kind: "node", id: columnId });
  if (!grid) return undefined;
  const { header } = grid;
  const before = grid.columns.map(positionKey);
  const rows = grid.rows.map(({ row }) => row);
  return {
    follow() {
      const after = partChildren(draft, header).map(positionKey);
      if (
        after.length !== before.length ||
        after.every((key, index) => key === before[index])
      )
        return;
      for (const row of rows) {
        // (A row in an instance's template has no list of its own to reorder; ADR-257 Phase 2: a
        // row with a cell spanning columns has no cell per column to move.)
        if (
          row.kind !== "node" ||
          rowCells(draft, row).length !== before.length
        ) {
          fail("TABLE_CELLS_NOT_ALIGNED", positionId(header));
          return;
        }
        // A reusable row's template cells become its own first (Round 13), then all its cells take
        // the header's new order — in the list its template cells were in, else its own.
        const root = ownTableRowCells(draft, row, newId);
        const cells = rowCells(draft, row).map(
          (cell) => positionId(cell) as NodeId,
        );
        const ordered = after.map((key) => cells[before.indexOf(key)]!);
        const node = draft.node(row.id);
        // (ADR-315 Phase 5 증분 5e — its detail row stays after its cells.)
        const detail = rowDetailIds(draft, row.id);
        if (root) {
          draft.write({ ...node, children: detail });
          setChildList(draft, root, ordered);
        } else draft.write({ ...node, children: [...ordered, ...detail] });
      }
    },
  };
}

/**
 * ADR-256 Phase 5 Round 13 — a reusable row's (a component instance's) template cells made its own
 * (`ensureChildList` — copies in the instance, as a detach copies): a column delete or move then
 * edits real cells instead of leaving hidden template positions that every later count would
 * read. Returns the row's template root position when it has one.
 */
function ownTableRowCells(
  draft: CommandDraft,
  row: NodeParent,
  newId: NewId | undefined,
): NodeParent | undefined {
  const root = compositeRootOf(draft, row);
  if (!root || childList(draft, root) || !childPositions(draft, root).length)
    return root;
  if (!newId) return fail("TABLE_CELLS_NOT_ALIGNED", positionId(row));
  ensureChildList(draft, root, newId);
  return root;
}

/**
 * A RAC Table column's delete in its reusable rows (Round 13): each row whose cells are still its
 * template's takes them as its own, without the copy at the column's place (the copies are new —
 * the delete's other cells, already the rows' own, go the usual way).
 */
export function dropTableColumnTemplateCells(
  draft: CommandDraft,
  column: NodeParent,
  newId: NewId | undefined,
): void {
  const grid = tableColumnGrid(draft, column);
  if (!grid) return;
  const index = grid.columns.findIndex(
    (position) => positionKey(position) === positionKey(column),
  );
  for (const { row } of grid.rows) {
    const root = compositeRootOf(draft, row);
    if (!root || childList(draft, root) || !childPositions(draft, root).length)
      continue;
    // (ADR-257 Phase 2: a template row's cells spanning columns are not one per column.)
    if (rowCells(draft, row).length !== grid.columns.length)
      fail("TABLE_CELLS_NOT_ALIGNED", positionId(row));
    ownTableRowCells(draft, row, newId);
    const ids = childList(draft, root)!;
    const dropped = ids[index];
    if (!dropped) continue;
    setChildList(
      draft,
      root,
      ids.filter((id) => id !== dropped),
    );
    removeWithReferrers(draft, subtree(draft, dropped));
  }
}

/** The hiding a new cell under `column` copies (a hidden column's cells are hidden — Round 12). */
export function tableColumnHiding(
  draft: CommandDraft,
  column: NodeParent,
): Pick<NodeEntry, "enabled" | "visibility"> {
  const { enabled, visibility } = hidingAt(draft, column);
  return {
    ...(enabled === false ? { enabled } : {}),
    ...(visibility ? { visibility } : {}),
  };
}

/** The header's columns as the table reads them (key and shown label). */
export function tableHeaderColumns(
  reader: CatalogReader,
  header: NodeParent,
): TableColumnSpec[] {
  const draft = new CommandDraft(reader);
  // (S2's selection column is no data column — quick connect neither counts nor replaces it.)
  return childPositions(draft, header)
    .filter((column) => !tableSelectionPart(draft, column))
    .map((column, index) => {
      const key = columnKey(reader, column, index);
      const label = readProp(reader, column, "label");
      const text = readProp(reader, column, "children");
      return {
        key,
        label:
          typeof label === "string" && label
            ? label
            : typeof text === "string" && text
              ? text
              : key,
      };
    });
}

/**
 * Add columns to a TableHeader (owned, or an instance's header position). Without `columns`, one
 * `column<n>` / "Column <n>" whose key no sibling uses; `replace` drops the current columns (quick
 * connect reconnect). In a Table whose rows each have one cell per column, every row gets a cell
 * per new column; with `replace`, every row's cells are built again — one per new column (ADR-277).
 */
export const insertTableColumns =
  (input: {
    header: NodeParent;
    columns?: readonly TableColumnSpec[];
    replace?: boolean;
    /** Column record for a spec (a Column origin instance); the command sets key and label. */
    buildColumn: (spec: TableColumnSpec) => {
      entries: NodeEntry[];
      rootId: NodeId;
    };
    /** An empty cell for a row. */
    buildCell: (rowId: string) => { entries: NodeEntry[]; rootId: NodeId };
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    if (positionType(draft, input.header) !== "TableHeader")
      fail("NOT_A_TABLE_HEADER", positionId(input.header));
    // The keys are read before an instance's header list becomes its own (the new column records
    // exist only in the draft, not in `reader`).
    // (S2's selection column is no data column — a new column is named after the data ones.)
    const keys = childPositions(draft, input.header)
      .filter((column) => !tableSelectionPart(draft, column))
      .map((column, index) => columnKey(reader, column, index));
    const current = ensureChildList(draft, input.header, input.newId);
    // S2's selection column stays through a replace (quick connect) — first, as S2 draws it.
    const kept = input.replace
      ? current.filter((id) =>
          tableSelectionPart(draft, { kind: "node", id: id as NodeId }),
        )
      : [];
    let specs = input.columns;
    if (!specs) {
      const taken = new Set(keys);
      let n = keys.length + 1;
      while (taken.has(`column${n}`)) n += 1;
      specs = [{ key: `column${n}`, label: `Column ${n}` }];
    }
    if (input.replace) {
      setChildList(draft, input.header, kept);
      removeWithReferrers(
        draft,
        current
          .filter((id) => !kept.includes(id))
          .flatMap((id) => subtree(draft, id)),
      );
    }
    const columnIds: NodeId[] = [];
    for (const spec of specs) {
      const built = input.buildColumn(spec);
      const entries = built.entries.map((entry) =>
        entry.id === built.rootId
          ? {
              ...entry,
              props: {
                ...entry.props,
                key: { kind: "set" as const, value: spec.key },
                children: { kind: "set" as const, value: spec.label },
              },
            }
          : entry,
      );
      assertNestable(draft, input.header, [
        entries.find((entry) => entry.id === built.rootId)!.definitionId,
      ]);
      for (const entry of entries) draft.create(entry);
      columnIds.push(built.rootId);
    }
    setChildList(draft, input.header, [
      ...(childList(draft, input.header) ?? []),
      ...columnIds,
    ]);
    // (The body's rows and a totals row's footer's — ADR-315 Phase 5 증분 5c.)
    for (const body of tableRowGroupsOf(draft, input.header)) {
      const rows = ensureChildList(draft, body, input.newId);
      if (input.replace) {
        // ADR-277 Decision 2 (R2): the static rows follow the new columns — each row's own cells
        // go and it gets one empty cell per new column, so the Table stays aligned (RAC throws on a
        // row whose cell count differs from the column count — ADR-256 Phase 5i G0 ⑨) once its
        // binding is removed and the rows show again.
        for (const rowId of rows) {
          const row = draft.node(rowId);
          // (its selection cells stay with the selection column)
          const keptCells = row.children.filter((id) =>
            tableSelectionPart(draft, { kind: "node", id }),
          );
          // (ADR-315 Phase 5 증분 5e — its detail row stays: it is no cell.)
          const detail = rowDetailIds(draft, rowId);
          const ownCells = row.children.filter(
            (id) => !keptCells.includes(id) && !detail.includes(id),
          );
          draft.write({ ...row, children: keptCells });
          removeWithReferrers(
            draft,
            ownCells.flatMap((id) => subtree(draft, id)),
          );
          const cells = specs.map((spec) =>
            templateCell(draft, rowId, input.buildCell(rowId), spec.key),
          );
          for (const cell of cells)
            for (const entry of cell.entries) draft.create(entry);
          draft.write({
            ...draft.node(rowId),
            children: [
              ...keptCells,
              ...cells.map((cell) => cell.rootId),
              ...detail,
            ],
          });
        }
      } else {
        // (A reusable row's cells are its template's, then its own — Round 12; a new cell is its own.)
        const aligned = rows.every(
          (row) =>
            spanSum(draft, rowCells(draft, { kind: "node", id: row })) ===
            current.length,
        );
        if (rows.length && aligned)
          for (const rowId of rows) {
            const cells = specs.map((spec) =>
              templateCell(draft, rowId, input.buildCell(rowId), spec.key),
            );
            for (const cell of cells)
              for (const entry of cell.entries) draft.create(entry);
            const row = draft.node(rowId);
            // (ADR-315 Phase 5 증분 5e — the new cells before its detail row.)
            const detail = rowDetailIds(draft, rowId);
            draft.write({
              ...row,
              children: [
                ...row.children.filter((id) => !detail.includes(id)),
                ...cells.map((cell) => cell.rootId),
                ...detail,
              ],
            });
          }
      }
    }
    return {
      label: input.label ?? "Add column",
      ops: draft.ops(),
      selectAfter: columnIds,
    };
  };

/** ADR-315 Phase 5 증분 5c — the TableFooter position a Table shows (its 「Totals」 slot). */
export function tableFooterPosition(
  reader: CatalogReader,
  tableId: NodeId,
): NodeParent | undefined {
  const draft = new CommandDraft(reader);
  const header = headerPositionIn(draft, tableId);
  return header
    ? tableRowGroupsOf(draft, header).find(
        (part) => positionType(draft, part) === "TableFooter",
      )
    : undefined;
}

/**
 * ADR-315 Phase 5 증분 5c — a Table's 「Totals row」 on: its footer (the 「Totals」 slot) gets one
 * Row with a cell per column (breakdown §5.4) — each data column's cell reads its key (`{key}` —
 * the totals row's aggregate, `CatalogBoundRows.totals`), the selection column's cell is empty,
 * a hidden column's cell hidden as it is. Off: the footer's rows go. A no-op step is refused.
 */
export const setTableTotalsRow =
  (input: {
    tableId: NodeId;
    on: boolean;
    /** An empty cell (a Cell original's instance). */
    buildCell: () => { entries: NodeEntry[]; rootId: NodeId };
    /** A row holding the given cells. */
    buildRow: (cellIds: readonly NodeId[]) => NodeEntry;
    newId: NewId;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const header = headerPositionIn(draft, input.tableId);
    const footer = header
      ? tableRowGroupsOf(draft, header).find(
          (part) => positionType(draft, part) === "TableFooter",
        )
      : undefined;
    if (!header || !footer) fail("NOT_A_TABLE_VIEW", input.tableId);
    const rows = partChildren(draft, footer!);
    if (!input.on) {
      if (!rows.length) fail("NO_CHANGE", input.tableId);
      const owned = ensureChildList(draft, footer!, input.newId);
      setChildList(draft, footer!, []);
      removeWithReferrers(
        draft,
        owned.flatMap((id) => subtree(draft, id)),
      );
      return { label: "Remove totals row", ops: draft.ops() };
    }
    if (rows.length) fail("NO_CHANGE", input.tableId);
    const columns = partChildren(draft, header!);
    const cellIds: NodeId[] = [];
    const cells: NodeEntry[] = [];
    // (A column's key by its place among the data columns — `tableHeaderColumns`'.)
    let index = 0;
    columns.forEach((column) => {
      if (tableSelectionPart(draft, column)) {
        // (S2's selection column: an empty plain Cell — a totals row is not selected.)
        const id = input.newId("node") as NodeId;
        cells.push({
          kind: "node",
          id,
          definitionId: "lib:definition:type-Cell" as NodeEntry["definitionId"],
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
          ...tableColumnHiding(draft, column),
        });
        cellIds.push(id);
        return;
      }
      const built = input.buildCell();
      const key = columnKey(reader, column, index++);
      for (const entry of built.entries)
        cells.push(
          entry.id === built.rootId
            ? {
                ...entry,
                ...tableColumnHiding(draft, column),
                props: {
                  ...entry.props,
                  children: { kind: "set" as const, value: `{${key}}` },
                },
              }
            : entry,
        );
      cellIds.push(built.rootId);
    });
    const row = input.buildRow(cellIds);
    draft.create(row);
    for (const cell of cells) draft.create(cell);
    const list = ensureChildList(draft, footer!, input.newId);
    setChildList(draft, footer!, [...list, row.id]);
    return { label: "Add totals row", ops: draft.ops(), selectAfter: [] };
  };

/**
 * ADR-315 Phase 5 증분 5e — a bound Table's 「Detail row」 on: its Row template (the body's row
 * that repeats) gets a Row after its cells — one cell, spanning the columns drawn (the projection
 * gives its span — `catalogProjectTableColumns`), reading the first data column's field to start
 * with; each data row expands to it, read with that row's values (RAC's nested `<Row>`,
 * breakdown §5.4). Off: the template's detail rows go. A no-op step is refused.
 */
export const setTableDetailRow =
  (input: {
    tableId: NodeId;
    on: boolean;
    /** An empty cell (a Cell original's instance). */
    buildCell: () => { entries: NodeEntry[]; rootId: NodeId };
    /** A row holding the given cells. */
    buildRow: (cellIds: readonly NodeId[]) => NodeEntry;
    newId: NewId;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const header = headerPositionIn(draft, input.tableId);
    const body = header ? tableBodyOf(draft, header) : undefined;
    const template = body
      ? partChildren(draft, body).find(
          (row): row is Extract<NodeParent, { kind: "node" }> =>
            row.kind === "node" && draft.node(row.id).repeat === true,
        )
      : undefined;
    if (!header || !template) return fail("NOT_A_TABLE_VIEW", input.tableId);
    const detail = rowDetailIds(draft, template.id);
    const row = draft.node(template.id);
    if (!input.on) {
      if (!detail.length) fail("NO_CHANGE", input.tableId);
      draft.write({
        ...row,
        children: row.children.filter((id) => !detail.includes(id)),
      });
      removeWithReferrers(
        draft,
        detail.flatMap((id) => subtree(draft, id)),
      );
      return { label: "Remove detail row", ops: draft.ops() };
    }
    if (detail.length) fail("NO_CHANGE", input.tableId);
    const columns = partChildren(draft, header);
    const first = columns.findIndex(
      (column) => !tableSelectionPart(draft, column),
    );
    const key =
      first >= 0
        ? columnKey(
            reader,
            columns[first]!,
            columns
              .slice(0, first)
              .filter((column) => !tableSelectionPart(draft, column)).length,
          )
        : undefined;
    const built = input.buildCell();
    const entries = built.entries.map((entry) =>
      entry.id === built.rootId && key !== undefined
        ? {
            ...entry,
            props: {
              ...entry.props,
              children: { kind: "set" as const, value: `{${key}}` },
            },
          }
        : entry,
    );
    // (Its divider · look are a body row's — the resolver gives a Row in a Row the body's rules.)
    const detailRow = input.buildRow([built.rootId]);
    // (A Row takes a Row — RAC's nested `<Row>`: `componentTraits` Row children.)
    assertNestable(draft, template, [detailRow.definitionId]);
    draft.create(detailRow);
    for (const entry of entries) draft.create(entry);
    draft.write({ ...row, children: [...row.children, detailRow.id] });
    return {
      label: "Add detail row",
      ops: draft.ops(),
      selectAfter: [detailRow.id],
    };
  };

/** Add a row to a table's body: a Row with one cell per column (rows must be aligned). */
export const insertTableRow =
  (input: {
    body: NodeParent;
    /** A row record holding `columnCount` cells. */
    buildRow: (columnCount: number) => { entries: NodeEntry[]; rootId: NodeId };
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    if (positionType(draft, input.body) !== "TableBody")
      fail("NOT_A_TABLE_BODY", positionId(input.body));
    const owner = parentOf(draft, input.body);
    if (!owner || !TABLE_OWNERS.has(positionType(draft, owner)))
      fail("NOT_A_TABLE_VIEW", positionId(input.body));
    // (ADR-310 Phase 4: a bound Table takes rows too — static ones beside its Row template.)
    const header = childPositions(draft, owner!).find(
      (child) => positionType(draft, child) === "TableHeader",
    );
    // A cell per column, hidden ones included: a hidden column's cell is hidden as it is (Round 12
    // — RAC needs the shown counts equal at every breakpoint).
    const columns = header ? partChildren(draft, header) : [];
    const columnCount = columns.length;
    const rows = ensureChildList(draft, input.body, input.newId);
    if (
      !rows.every(
        (row) =>
          spanSum(draft, rowCells(draft, { kind: "node", id: row })) ===
          columnCount,
      )
    )
      fail("TABLE_ROWS_NOT_ALIGNED", positionId(input.body));
    const built = input.buildRow(columnCount);
    const cellIds =
      built.entries.find((entry) => entry.id === built.rootId)?.children ?? [];
    for (const entry of built.entries) {
      const index = cellIds.indexOf(entry.id);
      const column = index >= 0 ? columns[index] : undefined;
      // A new row's cell in S2's selection column is the selection cell, as the others': the
      // selection Checkbox only (S2 `checkboxCellStyle` — any text the builder gave it goes).
      const checkbox =
        column && !entry.children.length && tableSelectionPart(draft, column)
          ? selectionCheckboxEntry(input.newId)
          : undefined;
      if (checkbox) draft.create(checkbox);
      const { children: _text, ...props } = entry.props;
      draft.create({
        ...entry,
        ...(column ? tableColumnHiding(draft, column) : {}),
        // (A plain Cell: the Cell original's Text would stand beside the Checkbox.)
        ...(checkbox
          ? {
              definitionId:
                "lib:definition:type-Cell" as NodeEntry["definitionId"],
              props,
              children: [checkbox.id],
            }
          : {}),
      });
    }
    // (A row whose definition brings cells of its own — a reusable row's — would hold more.)
    if (
      partChildren(draft, { kind: "node", id: built.rootId }).length !==
      columnCount
    )
      fail("TABLE_ROWS_NOT_ALIGNED", built.rootId);
    setChildList(draft, input.body, [...rows, built.rootId]);
    return {
      label: input.label ?? "Add row",
      ops: draft.ops(),
      selectAfter: [built.rootId],
    };
  };
