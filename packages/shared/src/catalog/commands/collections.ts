import type {
  AuthoredValue,
  CatalogReader,
  DefinitionId,
  DisplayStateName,
  NodeEntry,
  NodeId,
  Scalar,
  TemplateId,
  WriteValue,
} from "../document/types";
import { DISPLAY_STATE_PROPS } from "../resolution/resolver";
import type { CatalogOperation } from "../transactions/transaction";
import type { CatalogCommand } from "./compose";
import {
  assertNestable,
  childList,
  CommandDraft,
  definitionTypeName,
  fail,
  overrideAt,
  setChildList,
  templateDefinitionId,
  type EditTarget,
  type NodeParent,
} from "./context";
import { setFields } from "./fields";
import { readTargetProp } from "./items";
import { ensureChildList, type NewId } from "./materialize";
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
  /** A picker popover item never becomes the selection on insert (Select, ComboBox). */
  skipsSelection?: boolean;
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
  {
    owner: "Select",
    list: null,
    item: "ListBoxItem",
    section: "ListBoxSection",
    skipsSelection: true,
  },
  {
    owner: "ComboBox",
    list: null,
    item: "ListBoxItem",
    section: "ListBoxSection",
    skipsSelection: true,
  },
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
  ColorSwatchPicker: ["ColorSwatch"],
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
    if (input.selectItem && !isSection && !family.skipsSelection && !itemHost) {
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

/** The display state a composite shows from its template root (a state origin), if any. */
function originDisplayState(
  reader: CatalogReader,
  definitionId: DefinitionId,
  seen: ReadonlySet<string> = new Set(),
): DisplayStateName | undefined {
  if (!definitionId.startsWith("lib:") || seen.has(definitionId))
    return undefined;
  const definition = reader.library.definitions.get(
    definitionId as `lib:definition:${string}`,
  );
  const root =
    definition?.mode === "composite" && definition.templateRootId
      ? reader.library.templates.get(definition.templateRootId)
      : undefined;
  return root
    ? (root.displayState ??
        originDisplayState(
          reader,
          root.definitionId,
          new Set([...seen, definitionId]),
        ))
    : undefined;
}

/**
 * Whether a group item shows as selected, the way the resolver reads it: a value the instance
 * authored for the position wins; else a display state (a Radio state origin shows `selected`);
 * else the template and definition value.
 */
function shownSelected(draft: CommandDraft, item: NodeParent): boolean {
  const reader = draft.reader;
  let definitionId: DefinitionId;
  let positionState: DisplayStateName | undefined;
  if (item.kind === "node") {
    const node = draft.node(item.id);
    const own = node.props.isSelected;
    if (own?.kind === "set") return own.value === true;
    definitionId = node.definitionId;
  } else if (item.kind === "descendant") {
    const patch = overrideAt(draft.node(item.ownerId), item.address);
    const patched =
      patch?.kind === "patch" ? patch.props?.isSelected : undefined;
    if (patched?.kind === "set") return patched.value === true;
    const path = item.address.templatePath;
    const templateId = path[path.length - 1];
    definitionId = templateDefinitionId(reader, templateId);
    const template = templateId.startsWith("lib:")
      ? reader.library.templates.get(templateId as `lib:template:${string}`)
      : undefined;
    positionState = template?.displayState;
    // A nested instance position's own value is the instance's, over its origin's state.
    if (
      template &&
      template.props.isSelected !== undefined &&
      reader.library.definitions.get(definitionId as `lib:definition:${string}`)
        ?.mode === "composite"
    )
      return template.props.isSelected === true;
  } else return false;
  const state = positionState ?? originDisplayState(reader, definitionId);
  const forced = state ? DISPLAY_STATE_PROPS[state]?.isSelected : undefined;
  return forced ?? readProp(reader, item, "isSelected") === true;
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
    // Siblings: the instance's template items, then the host's own children.
    const siblings: NodeParent[] = [
      ...(rootTemplate
        ? childPositions(draft, {
            kind: "descendant",
            ownerId: host.id,
            address: { instances: [host.id], templatePath: [rootTemplate] },
          })
        : []),
      ...host.children.map((id): NodeParent => ({ kind: "node", id })),
    ].filter((sibling) => itemTypes.includes(positionType(draft, sibling)));
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
    if (itemType === "ColorSwatch" && own("color") === undefined) {
      const swatches = typed("ColorSwatch");
      const taken = new Set(
        swatches.map((swatch) =>
          String(readProp(reader, swatch, "color") ?? "")
            .trim()
            .toUpperCase(),
        ),
      );
      setOwn("color", unusedSwatchColor(taken));
      const last = swatches[swatches.length - 1];
      if (last?.kind === "node") {
        const source = draft.node(last.id);
        item = {
          ...item,
          visual: { ...source.visual },
          sizing: { ...source.sizing },
        };
      }
    }
    const entries = input.entries.map((entry) =>
      entry.id === item.id ? item : entry,
    );
    place(
      draft,
      { kind: "node", id: host.id },
      entries,
      input.rootId,
      input.newId,
    );
    const extra: CatalogOperation[] = [];
    const single =
      own("isSelected") === true &&
      (groupType === "RadioGroup" ||
        (groupType === "ToggleButtonGroup" &&
          readTargetProp(
            reader,
            { kind: "node", id: host.id },
            "selectionMode",
          ) === "single"));
    if (single) {
      for (const sibling of typed(itemType))
        if (shownSelected(draft, sibling))
          extra.push(
            ...setProps(reader, targetOf(sibling)!, { isSelected: false }),
          );
      if (groupType === "RadioGroup")
        extra.push(
          ...setProps(
            reader,
            { kind: "node", id: host.id },
            {
              value: (item.props.value as { value: Scalar }).value,
            },
          ),
        );
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
function tableBodyOf(
  draft: CommandDraft,
  header: NodeParent,
): NodeParent | undefined {
  const owner = parentOf(draft, header);
  if (!owner || positionType(draft, owner) !== "TableView") return undefined;
  return childPositions(draft, owner).find(
    (child) => positionType(draft, child) === "TableBody",
  );
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
    const current = ensureChildList(draft, input.header, input.newId);
    const keys = current.map((id, index) =>
      columnKey(reader, { kind: "node", id }, index),
    );
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

/** Add a row to a TableView body: a Row with one cell per column (rows must be aligned). */
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
    if (!owner || positionType(draft, owner) !== "TableView")
      fail("NOT_A_TABLE_VIEW", positionId(input.body));
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
