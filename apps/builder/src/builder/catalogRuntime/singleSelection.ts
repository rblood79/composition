import {
  setFields,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  catalogPickerOfOption,
  catalogPickerSelectionItem,
} from "../../../../../packages/shared/src/catalog/runtime/pickerSelection";
import type { AuthoredValue } from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import {
  CATALOG_EXPANSION_GROUP_TYPES,
  CATALOG_SELECTION_GROUP_TYPES,
  catalogGroupExpansion,
  catalogGroupItems,
  catalogGroupSelection,
  catalogGroupSelectionProps,
  catalogGroupSelectionStoreProp,
  catalogGroupSelectsMany,
  catalogItemKey,
  catalogSelectionGroupOf,
} from "../../../../../packages/shared/src/catalog/runtime/groupSelection";
import { catalogAccordionOf } from "../../../../../packages/shared/src/catalog/runtime/presence";
import type { CatalogWorkspace } from "./workspace";

/**
 * ADR-308 — a selection (and expansion) is its group's: the group stores its items' keys (S2 ·
 * RAC `selectedKey(s)` · `value` · `expandedKeys`), the Design panel's group field writes them and
 * no item's `isSelected` · `isExpanded` is written for it. One value stays one by its shape (a
 * single-selection group holds one key — 2026-10-13 「radioGroup, Tabs 등은 하나의 값만」).
 */

type Root = CatalogWorkspace["root"];

const lookup = (root: Root) => (id: string) => root.canvasInputs.get(id);
const typeOf = (root: Root) => (record: CatalogConsumerNode) =>
  root.typeOf(record);

/** A picker selection Checkbox edits the option that owns selection. */
export function catalogPickerSelectionOwner(
  workspace: CatalogWorkspace,
  recordId: string,
) {
  const root = workspace.root;
  const node = root.canvasInputs.get(recordId);
  if (!node || root.typeOf(node) !== "Checkbox") return undefined;
  const get = lookup(root);
  const item = catalogPickerSelectionItem(node, get, root.typeOf);
  return item && catalogPickerOfOption(item, get, root.typeOf)
    ? item
    : undefined;
}

/** A whole template binding (`{label}`) — a ListBoxItem's own `children`, not its text. */
const TEMPLATE_BINDING = /^\{[\w.-]+\}$/;

/** An item's text: its own text, else its first descendant's (a Tab's label Text). */
function itemText(root: Root, node: CatalogConsumerNode): string {
  for (const key of ["label", "title", "textValue", "children"]) {
    const text = node.props[key];
    if (typeof text === "string" && text && !TEMPLATE_BINDING.test(text))
      return text;
  }
  for (const id of node.children) {
    const child = root.canvasInputs.get(id);
    if (!child) continue;
    const text = itemText(root, child);
    if (text) return text;
  }
  return "";
}

/** One group field of the Design panel's Value section (ADR-308 Decision 5). */
export interface CatalogGroupKeysField {
  /** The prop the field writes (`catalogGroupSelectionStoreProp`, or `expandedKeys`). */
  readonly key: string;
  /** Several keys (a check list) — else one (a dropdown) — 사용자 결정 3. */
  readonly many: boolean;
  /** The group's items: their key and text (a bound list's sample rows — 사용자 결정 4). */
  readonly options: readonly { value: string; label: string }[];
  /** The keys it holds now (the group's RAC default when it stores none). */
  readonly value: string | readonly string[];
}

const optionsOf = (root: Root, group: CatalogConsumerNode) => {
  const seen = new Set<string>();
  return catalogGroupItems(group, lookup(root), typeOf(root)).flatMap(
    (item, index) => {
      const value = catalogItemKey(item, typeOf(root));
      if (seen.has(value)) return [];
      seen.add(value);
      return [{ value, label: itemText(root, item) || `Item ${index + 1}` }];
    },
  );
};

/** A group record's selection · expansion fields (none for another record). */
export function catalogGroupKeysFields(
  root: Root,
  groupId: string,
): CatalogGroupKeysField[] {
  const group = root.canvasInputs.get(groupId);
  if (!group) return [];
  const type = root.typeOf(group);
  const fields: CatalogGroupKeysField[] = [];
  const store = catalogGroupSelectionStoreProp(type);
  if (CATALOG_SELECTION_GROUP_TYPES.has(type) && store) {
    const many = catalogGroupSelectsMany(type, group.props);
    const keys = catalogGroupSelection(group, lookup(root), typeOf(root));
    const options = optionsOf(root, group);
    const list = keys === "all" ? options.map((option) => option.value) : keys;
    fields.push({
      key: store,
      many,
      options,
      value: many ? list : (list[0] ?? ""),
    });
  }
  if (CATALOG_EXPANSION_GROUP_TYPES.has(type)) {
    // (An Accordion that expands one holds one key — a dropdown; a Tree · a multiple Accordion
    //  a check list.)
    const many =
      type !== "Accordion" || group.props.allowsMultipleExpanded === true;
    const keys = catalogGroupExpansion(group, typeOf(root));
    fields.push({
      key: "expandedKeys",
      many,
      options: optionsOf(root, group),
      value: many ? keys : (keys[0] ?? ""),
    });
  }
  return fields;
}

/** A write of a group's stored keys (its controlled twin dropped — it is read first). */
function groupWrite(
  workspace: CatalogWorkspace,
  group: CatalogConsumerNode,
  prop: string,
  value: unknown,
): CatalogCommand | undefined {
  const target = workspace.positionOfRecord(group.id)?.target;
  if (!target) return undefined;
  const type = workspace.root.typeOf(group);
  const twins =
    prop === "expandedKeys"
      ? ["defaultExpandedKeys"]
      : (catalogGroupSelectionProps(type) ?? []).filter(
          (name) => name !== prop,
        );
  // (A key list prop — `*Keys` · a CheckboxGroup's value — holds a list even with one key; a
  //  single-selection group's field gives one key.)
  const listProp =
    prop.endsWith("Keys") || (type === "CheckboxGroup" && prop === "value");
  if (listProp && typeof value === "string")
    value = value === "" ? [] : [value];
  return setFields({
    targets: [target],
    props: {
      [prop]:
        value === undefined || value === ""
          ? { kind: "remove" as const }
          : { kind: "set" as const, value: value as AuthoredValue },
      ...Object.fromEntries(
        twins
          .filter((name) => group.props[name] !== undefined)
          .map((name) => [name, { kind: "remove" as const }]),
      ),
    },
  });
}

/**
 * ADR-308 — an item's selection written as its group's: the item's key put in the group's stored
 * keys or taken out (a single-selection group holds one). No item `isSelected` is written.
 */
export function catalogItemSelectionCommands(
  workspace: CatalogWorkspace,
  itemId: string,
  value: unknown,
): CatalogCommand[] {
  const root = workspace.root;
  const item = root.canvasInputs.get(itemId);
  if (!item) return [];
  const group = catalogSelectionGroupOf(item, lookup(root), typeOf(root));
  const type = group ? root.typeOf(group) : "";
  const store = catalogGroupSelectionStoreProp(type);
  if (!group || !store) return [];
  const key = catalogItemKey(item, typeOf(root));
  const keys = catalogGroupSelection(group, lookup(root), typeOf(root));
  const list =
    keys === "all"
      ? optionsOf(root, group).map((option) => option.value)
      : keys;
  const others = list.filter((other) => other !== key);
  const many = catalogGroupSelectsMany(type, group.props);
  const next = value === true ? (many ? [...others, key] : [key]) : others;
  const command = groupWrite(
    workspace,
    group,
    store,
    many ? next : (next[0] ?? undefined),
  );
  return command ? [command] : [];
}

/**
 * A picker option's selection Checkbox (`Checkbox[slot=selection]` — its Selected field) puts its
 * option's key in the picker's selection or takes it out (ADR-308 — the picker's value, not the
 * option's `isSelected`).
 */
export function catalogPickerSelectionCommands(
  workspace: CatalogWorkspace,
  recordId: string,
  value: unknown,
): CatalogCommand[] {
  const owner = catalogPickerSelectionOwner(workspace, recordId);
  return owner ? catalogItemSelectionCommands(workspace, owner.id, value) : [];
}

/**
 * ADR-308 Decision 7 — an item's key edit (its Item ID) moves the keys that name it in the same
 * step: its group's selection (both twins) and expansion, and a Tab's paired TabPanel `itemId`.
 */
export function catalogItemKeyRenameCommands(
  workspace: CatalogWorkspace,
  recordId: string,
  nextKey: unknown,
): CatalogCommand[] {
  const root = workspace.root;
  const item = root.canvasInputs.get(recordId);
  if (!item) return [];
  const before = catalogItemKey(item, typeOf(root));
  const after = typeof nextKey === "string" && nextKey ? nextKey : item.id;
  if (before === after) return [];
  const rename = (raw: unknown): unknown =>
    Array.isArray(raw)
      ? raw.map((key) => (String(key) === before ? after : key))
      : raw === before
        ? after
        : raw;
  const commands: CatalogCommand[] = [];
  const write = (
    record: CatalogConsumerNode,
    props: readonly string[],
  ): void => {
    const changed = props.filter(
      (prop) =>
        record.props[prop] !== undefined &&
        JSON.stringify(rename(record.props[prop])) !==
          JSON.stringify(record.props[prop]),
    );
    const target = workspace.positionOfRecord(record.id)?.target;
    if (!changed.length || !target) return;
    commands.push(
      setFields({
        targets: [target],
        props: Object.fromEntries(
          changed.map((prop) => [
            prop,
            { kind: "set", value: rename(record.props[prop]) as never },
          ]),
        ),
      }),
    );
  };
  const group = catalogSelectionGroupOf(item, lookup(root), typeOf(root));
  if (group)
    write(group, [
      ...(catalogGroupSelectionProps(root.typeOf(group)) ?? []),
      ...(CATALOG_EXPANSION_GROUP_TYPES.has(root.typeOf(group))
        ? ["expandedKeys", "defaultExpandedKeys"]
        : []),
    ]);
  const accordion =
    root.typeOf(item) === "Disclosure"
      ? catalogAccordionOf(item, lookup(root), typeOf(root))
      : undefined;
  if (accordion) write(accordion, ["expandedKeys", "defaultExpandedKeys"]);
  // (A Tab's paired TabPanel — in this Tabs' TabPanels, at any depth.)
  if (root.typeOf(item) === "Tab" && group) {
    const visit = (record: CatalogConsumerNode): void => {
      for (const id of record.children) {
        const child = root.canvasInputs.get(id);
        if (!child) continue;
        if (root.typeOf(child) === "TabPanel" && child.props.itemId === before)
          write(child, ["itemId"]);
        else if (root.typeOf(child) !== "Tabs") visit(child);
      }
    };
    visit(group);
  }
  return commands;
}

/** The Design panel's group field write (`catalogGroupKeysFields`): the prop, its twin dropped. */
export function catalogGroupKeysWriteCommand(
  workspace: CatalogWorkspace,
  groupId: string,
  prop: string,
  value: unknown,
): CatalogCommand | undefined {
  const group = workspace.root.canvasInputs.get(groupId);
  return group ? groupWrite(workspace, group, prop, value) : undefined;
}
