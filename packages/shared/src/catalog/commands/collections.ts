import type {
  AuthoredValue,
  CatalogReader,
  NodeEntry,
  NodeId,
  Scalar,
  TemplateId,
  WriteValue,
} from "../document/types";
import { readPropSource } from "../resolution/fieldSource";
import type { CatalogOperation } from "../transactions/transaction";
import type { CatalogCommand } from "./compose";
import {
  assertNestable,
  childList,
  CommandDraft,
  definitionTypeName,
  fail,
  setChildList,
  templateDefinitionId,
  type EditTarget,
  type NodeParent,
} from "./context";
import { setFields } from "./fields";
import { readTargetProp } from "./items";
import { ensureChildList, readTemplate, type NewId } from "./materialize";
import { removeWithReferrers, subtree } from "./structure";

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
  /** Items hold items (TreeItem, MenuItem). */
  recursive?: boolean;
  /** Tabs: each Tab pairs with a TabPanel by key. */
  panels?: boolean;
}
export const COLLECTION_FAMILIES: readonly CollectionFamily[] = [
  { owner: "Tabs", list: "TabList", item: "Tab", panels: true },
  { owner: "TagGroup", list: "TagList", item: "Tag" },
  {
    owner: "ListBox",
    list: null,
    item: "ListBoxItem",
    section: "ListBoxSection",
  },
  {
    owner: "GridList",
    list: null,
    item: "GridListItem",
    section: "GridListSection",
  },
  {
    owner: "Menu",
    list: null,
    item: "MenuItem",
    section: "MenuSection",
    recursive: true,
  },
  { owner: "Breadcrumbs", list: null, item: "Breadcrumb" },
  // (A Select · ComboBox holds its items in its ListBox — an instance of the ListBox origin,
  // ADR-253 Phase 4: the ListBox family above places them.)
  { owner: "Tree", list: null, item: "TreeItem", recursive: true },
];

/** Group containers and their item types (the old `GROUP_SLOT_HOSTS`). */
export const GROUP_ITEM_TYPES: Readonly<Record<string, readonly string[]>> = {
  CheckboxGroup: ["Checkbox"],
  RadioGroup: ["Radio"],
  ToggleButtonGroup: ["ToggleButton"],
  DisclosureGroup: ["Disclosure"],
  ButtonGroup: ["Button"],
  Pagination: ["Button"],
  AvatarGroup: ["Avatar"],
  Nav: ["Link"],
  // ADR-256 Phase 5b: the reference's items (each holds its ColorSwatch).
  ColorSwatchPicker: ["ColorSwatchPickerItem"],
};

/**
 * ADR-251 — groups whose items sit in an items wrapper node (TagGroup > TagList shape): the "+"
 * of the group (or the wrapper) adds the item inside the wrapper.
 */
export const GROUP_ITEMS_WRAPPER: Readonly<Record<string, string>> = {
  CheckboxGroup: "CheckboxItems",
  RadioGroup: "RadioItems",
};

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
  setChildList(draft, parent, [
    ...ensureChildList(draft, parent, newId),
    rootId,
  ]);
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
  if (ownerType === "Tabs")
    return read("selectedKey") === undefined &&
      read("defaultSelectedKey") !== undefined
      ? { defaultSelectedKey: key }
      : { selectedKey: key };
  const prop =
    read("selectedKeys") === undefined &&
    read("defaultSelectedKeys") !== undefined
      ? "defaultSelectedKeys"
      : "selectedKeys";
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
    /** Tabs: the paired TabPanel record (placed in the sibling TabPanels). */
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
    place(draft, input.host, input.entries, input.rootId, input.newId);
    if (family.panels) {
      const owner = parentOf(draft, input.host);
      const panels = owner
        ? childPositions(draft, owner).find(
            (child) => positionType(draft, child) === "TabPanels",
          )
        : undefined;
      if (panels) {
        if (!input.panel) fail("TAB_PANEL_REQUIRED", positionId(input.host));
        else place(draft, panels, [input.panel], input.panel.id, input.newId);
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

/** Whether a group item shows as selected (the resolver's precedence, `readPropSource`). */
function shownSelected(draft: CommandDraft, item: NodeParent): boolean {
  const target = targetOf(item);
  return (
    !!target &&
    readPropSource(draft.reader, target, "isSelected").value === true
  );
}

/**
 * Add an item to a group container (owned group or group instance; an instance's new item is
 * its own child, after the template's items). A Radio gets a unique `value`, a ColorSwatch an
 * unused color (and the last swatch's box); a selected Radio (or a single-selection ToggleButton)
 * clears its siblings' selection, and a RadioGroup takes the new value.
 */
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
    // The host's children: the instance's template positions, then its own children.
    const hostChildren: NodeParent[] = [
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
    const container: NodeParent = wrapperType
      ? (hostChildren.find(
          (child) => positionType(draft, child) === wrapperType,
        ) ?? fail("NO_ITEMS_WRAPPER", groupType))
      : { kind: "node", id: host.id };
    const containerChildren = wrapperType
      ? childPositions(draft, container)
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
    if (itemType === "Radio" && own("value") === undefined) {
      const radios = typed("Radio");
      const taken = new Set(
        radios.map((radio) => String(readProp(reader, radio, "value") ?? "")),
      );
      let n = radios.length + 1;
      while (taken.has(`option${n}`)) n += 1;
      setOwn("value", `option${n}`);
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
    const single =
      own("isSelected") === true &&
      (groupType === "RadioGroup" ||
        (groupType === "ToggleButtonGroup" &&
          readTargetProp(
            reader,
            { kind: "node", id: host.id },
            "selectionMode",
          ) === "single"));
    // The shown selection is read before the insert: a template wrapper materializes its items
    // into the instance's own nodes (same order) when the item is placed.
    const cleared = single
      ? containerChildren.map(
          (sibling) =>
            positionType(draft, sibling) === itemType &&
            shownSelected(draft, sibling),
        )
      : [];
    place(draft, container, entries, input.rootId, input.newId);
    const placed =
      container.kind === "page" ? [] : (childList(draft, container) ?? []);
    const extra: CatalogOperation[] = [];
    const ownWrite = (id: NodeId, props: Record<string, AuthoredValue>) => {
      const node = draft.node(id);
      draft.write({
        ...node,
        props: {
          ...node.props,
          ...Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value } as WriteValue<AuthoredValue>,
            ]),
          ),
        },
      });
    };
    if (single) {
      cleared.forEach((selected, index) => {
        if (!selected) return;
        const sibling = containerChildren[index];
        // A materialized template item is the wrapper's own node at its template child index.
        const id =
          sibling.kind === "descendant" && container.kind === "descendant"
            ? placed[
                readTemplate(
                  draft,
                  container.address.templatePath[
                    container.address.templatePath.length - 1
                  ],
                ).children.findIndex(
                  (child) =>
                    child ===
                    sibling.address.templatePath[
                      sibling.address.templatePath.length - 1
                    ],
                )
              ]
            : sibling.kind === "node"
              ? sibling.id
              : undefined;
        if (id) ownWrite(id, { isSelected: false });
        else
          extra.push(
            ...setProps(reader, targetOf(sibling)!, { isSelected: false }),
          );
      });
      if (groupType === "RadioGroup")
        ownWrite(host.id, {
          value: (item.props.value as { value: Scalar }).value,
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
  const key = readProp(reader, column, "key");
  if (typeof key === "string" && key) return key;
  if (typeof key === "number") return String(key);
  const text = readProp(reader, column, "children");
  if (typeof text === "string" && text) return text.toLowerCase();
  const id = readProp(reader, column, "id");
  if (typeof id === "string" && id) return id;
  return `column${index + 1}`;
}
/**
 * Tables whose header and body hold the column and row nodes: S2 `TableView` and RAC `Table` (ADR-256
 * Phase 5i — RAC throws when a row's cell count differs from the column count).
 */
const TABLE_OWNERS: ReadonlySet<string> = new Set(["TableView", "Table"]);
function tableBodyOf(
  draft: CommandDraft,
  header: NodeParent,
): NodeParent | undefined {
  const owner = parentOf(draft, header);
  if (!owner || !TABLE_OWNERS.has(positionType(draft, owner))) return undefined;
  return childPositions(draft, owner).find(
    (child) => positionType(draft, child) === "TableBody",
  );
}

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

/** Shown positions (a node the author hid — `enabled: false` — is not there). */
function shownPositions(
  draft: CommandDraft,
  positions: readonly NodeParent[],
): NodeParent[] {
  return positions.filter(
    (position) =>
      position.kind !== "node" || draft.node(position.id).enabled !== false,
  );
}

/**
 * ADR-256 Phase 5i-3 — a RAC Table's alignment (G0 ⑨: RAC throws when a row's cell count differs
 * from the column count): its shown column count and each shown row's cell count, read from
 * `draft` (a command's result). Undefined for any node that is not a RAC Table (a TableView draws
 * its own grid).
 */
export function tableAlignmentIn(
  draft: CommandDraft,
  tableId: NodeId,
): { columns: number; rows: number[] } | undefined {
  const table = draft.read(tableId);
  if (
    table?.kind !== "node" ||
    definitionTypeName(draft.reader, table.definitionId) !== "Table"
  )
    return undefined;
  const header = headerPositionIn(draft, tableId);
  if (!header) return undefined;
  const body = tableBodyOf(draft, header);
  return {
    columns: shownPositions(draft, childPositions(draft, header)).length,
    rows: body
      ? shownPositions(draft, childPositions(draft, body)).map(
          (row) => shownPositions(draft, childPositions(draft, row)).length,
        )
      : [],
  };
}

/**
 * ADR-256 Phase 5i-3 — the cells a RAC Table column takes along when it is deleted: the cell at
 * the column's place in every row that is aligned with the header (G0 ⑨ — one transaction).
 * Empty for a node that is not an owned Column of a RAC Table.
 */
export function tableColumnCells(
  draft: CommandDraft,
  columnId: NodeId,
): NodeId[] {
  const column = draft.read(columnId);
  if (
    column?.kind !== "node" ||
    definitionTypeName(draft.reader, column.definitionId) !== "Column"
  )
    return [];
  const header = parentOf(draft, { kind: "node", id: columnId });
  const table = header ? parentOf(draft, header) : undefined;
  if (
    !header ||
    !table ||
    positionType(draft, header) !== "TableHeader" ||
    positionType(draft, table) !== "Table"
  )
    return [];
  const columns = shownPositions(draft, childPositions(draft, header));
  const index = columns.findIndex(
    (position) => position.kind === "node" && position.id === columnId,
  );
  const body = tableBodyOf(draft, header);
  if (index < 0 || !body) return [];
  return shownPositions(draft, childPositions(draft, body)).flatMap((row) => {
    const cells = shownPositions(draft, childPositions(draft, row));
    const cell = cells[index];
    return cells.length === columns.length && cell?.kind === "node"
      ? [cell.id]
      : [];
  });
}

/**
 * ADR-256 Phase 5i-3 — a RAC Table header's column order and its aligned rows' cells, before a
 * command reorders the columns: `follow` (after the command's writes) gives every such row its
 * cells in the header's new column order — RAC pairs a row's cells with the columns by place.
 * Undefined when `columnId` is not an owned Column of a RAC Table.
 */
export function tableColumnOrder(
  draft: CommandDraft,
  columnId: NodeId,
): { follow(): void } | undefined {
  const header = parentOf(draft, { kind: "node", id: columnId });
  const table = header ? parentOf(draft, header) : undefined;
  if (
    !header ||
    !table ||
    positionType(draft, header) !== "TableHeader" ||
    positionType(draft, table) !== "Table"
  )
    return undefined;
  const columnIds = (positions: readonly NodeParent[]) =>
    positions.map((position) => positionId(position));
  const before = columnIds(childPositions(draft, header));
  const body = tableBodyOf(draft, header);
  const rows = (body ? childPositions(draft, body) : []).flatMap((row) =>
    row.kind === "node" && draft.node(row.id).children.length === before.length
      ? [{ id: row.id, cells: [...draft.node(row.id).children] }]
      : [],
  );
  return {
    follow() {
      const after = columnIds(childPositions(draft, header));
      if (
        after.length !== before.length ||
        after.every((id, index) => id === before[index])
      )
        return;
      for (const row of rows) {
        const node = draft.node(row.id);
        draft.write({
          ...node,
          children: after.map((id) => row.cells[before.indexOf(id)]!),
        });
      }
    },
  };
}

/** The header's columns as the table reads them (key and shown label). */
export function tableHeaderColumns(
  reader: CatalogReader,
  header: NodeParent,
): TableColumnSpec[] {
  const draft = new CommandDraft(reader);
  return childPositions(draft, header).map((column, index) => {
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
 * connect reconnect). In a TableView whose rows each have one cell per column, every row gets a
 * cell per new column.
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
    const keys = childPositions(draft, input.header).map((column, index) =>
      columnKey(reader, column, index),
    );
    const current = ensureChildList(draft, input.header, input.newId);
    let specs = input.columns;
    if (!specs) {
      const taken = new Set(keys);
      let n = keys.length + 1;
      while (taken.has(`column${n}`)) n += 1;
      specs = [{ key: `column${n}`, label: `Column ${n}` }];
    }
    if (input.replace) {
      setChildList(draft, input.header, []);
      removeWithReferrers(
        draft,
        current.flatMap((id) => subtree(draft, id)),
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
    const body = input.replace ? undefined : tableBodyOf(draft, input.header);
    if (body) {
      const rows = ensureChildList(draft, body, input.newId);
      const aligned = rows.every(
        (row) => draft.node(row).children.length === current.length,
      );
      if (rows.length && aligned)
        for (const rowId of rows) {
          const cells = specs.map(() => input.buildCell(rowId));
          for (const cell of cells)
            for (const entry of cell.entries) draft.create(entry);
          const row = draft.node(rowId);
          draft.write({
            ...row,
            children: [...row.children, ...cells.map((cell) => cell.rootId)],
          });
        }
    }
    return {
      label: input.label ?? "Add column",
      ops: draft.ops(),
      selectAfter: columnIds,
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
    // A bound table's rows are its data's (the projected rows hide its own) — it takes none.
    if (owner!.kind === "node" && draft.node(owner!.id).binding)
      fail("TABLE_ROWS_FROM_DATA", positionId(input.body));
    const header = childPositions(draft, owner!).find(
      (child) => positionType(draft, child) === "TableHeader",
    );
    const columnCount = header
      ? childPositions(draft, header).filter(
          (child) =>
            child.kind !== "node" || draft.node(child.id).enabled !== false,
        ).length
      : 0;
    const rows = ensureChildList(draft, input.body, input.newId);
    if (!rows.every((row) => draft.node(row).children.length === columnCount))
      fail("TABLE_ROWS_NOT_ALIGNED", positionId(input.body));
    const built = input.buildRow(columnCount);
    for (const entry of built.entries) draft.create(entry);
    setChildList(draft, input.body, [...rows, built.rootId]);
    return {
      label: input.label ?? "Add row",
      ops: draft.ops(),
      selectAfter: [built.rootId],
    };
  };
