import {
  setFields,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  catalogCollectionSelectionMode,
  COLLECTION_ITEM_OWNERS,
  isCollectionItemOf,
  isCollectionWrapperOf,
} from "../../../../../packages/shared/src/catalog/document/collectionItems";
import type { CatalogConsumerNode } from "../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import {
  catalogTabsSelection,
  catalogToggleGroupItems,
  catalogToggleGroupOf,
} from "../../../../../packages/shared/src/catalog/runtime/presence";
import { resolveStaticItemKey } from "../../../../../packages/shared/src/catalog/slotRoles";
import type { CatalogWorkspace } from "./workspace";

/**
 * 2026-10-13 (사용자 「radioGroup, Tabs 등은 하나의 값만 선택되어야한다. 현재 radioGroup 프러퍼티에
 * value옵션이 있지만 동작하지않는다」): a collection or group that selects one value keeps one —
 * an item set Selected takes the selection from the others, and a RadioGroup's Value and its Radios'
 * Selected are one choice written both ways (each panel shows it).
 *
 * One value: Tabs · RadioGroup always (RAC single-value state), a ToggleButtonGroup · ListBox ·
 * GridList · Tree · Table · TableView · Menu · TagGroup · CardView while its `selectionMode` is
 * single. A multiple selection keeps every item's own choice.
 */

/** The groups whose toggles' `isSelected` is the group's value (RAC group state). */
const GROUP_ITEMS: Readonly<Record<string, string>> = {
  Radio: "RadioGroup",
  ToggleButton: "ToggleButtonGroup",
};

/** Owners that select one value whatever their mode. */
const ALWAYS_SINGLE: ReadonlySet<string> = new Set(["Tabs", "RadioGroup"]);

interface SelectionScope {
  readonly owner: CatalogConsumerNode;
  readonly ownerType: string;
  readonly items: readonly CatalogConsumerNode[];
  readonly single: boolean;
}

type Root = CatalogWorkspace["root"];

const lookup = (root: Root) => (id: string) => root.canvasInputs.get(id);
const typeOf = (root: Root) => (record: CatalogConsumerNode) =>
  root.typeOf(record);

/** The collection or group an item record selects in, its items and whether it keeps one. */
function itemScope(
  root: Root,
  item: CatalogConsumerNode,
): SelectionScope | undefined {
  const get = lookup(root);
  const type = typeOf(root);
  const itemType = type(item);
  const groupType = GROUP_ITEMS[itemType];
  if (groupType) {
    const owner = catalogToggleGroupOf(item, get, type);
    return owner ? groupScope(root, owner) : undefined;
  }
  const entry = COLLECTION_ITEM_OWNERS[itemType];
  if (!entry) return undefined;
  let cursor = get(item.parentId);
  while (cursor && entry.through.includes(type(cursor)))
    cursor = get(cursor.parentId);
  return cursor && entry.owners.includes(type(cursor))
    ? collectionScope(root, cursor)
    : undefined;
}

function groupScope(
  root: Root,
  owner: CatalogConsumerNode,
): SelectionScope | undefined {
  const ownerType = root.typeOf(owner);
  const itemType = Object.keys(GROUP_ITEMS).find(
    (key) => GROUP_ITEMS[key] === ownerType,
  );
  if (!itemType) return undefined;
  const items = catalogToggleGroupItems(
    owner,
    itemType,
    lookup(root),
    typeOf(root),
  ).items;
  // (A ToggleButtonGroup selects one by default — its binding's `single`.)
  const mode =
    ownerType === "ToggleButtonGroup"
      ? String(owner.props.selectionMode || "single")
      : "single";
  return {
    owner,
    ownerType,
    items,
    single: ALWAYS_SINGLE.has(ownerType) || mode === "single",
  };
}

function collectionScope(
  root: Root,
  owner: CatalogConsumerNode,
): SelectionScope {
  const ownerType = root.typeOf(owner);
  const items: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const id of node.children) {
      const child = root.canvasInputs.get(id);
      if (!child) continue;
      const childType = root.typeOf(child);
      if (isCollectionItemOf(childType, ownerType)) items.push(child);
      if (isCollectionWrapperOf(childType, ownerType)) visit(child);
    }
  };
  visit(owner);
  return {
    owner,
    ownerType,
    items,
    single:
      ALWAYS_SINGLE.has(ownerType) ||
      catalogCollectionSelectionMode(ownerType, owner.props) === "single",
  };
}

/** A Radio's value (RAC `<Radio value>`), "" without one. */
const radioValue = (radio: CatalogConsumerNode) =>
  typeof radio.props.value === "string" || typeof radio.props.value === "number"
    ? String(radio.props.value)
    : "";

/**
 * The Value choices of a RadioGroup record: its Radios' values (any depth — RAC's group context), in
 * order, labelled by their text. RAC's value is one of them.
 */
export function catalogRadioGroupValueOptions(
  root: Root,
  groupId: string,
): { value: string; label: string }[] {
  const group = root.canvasInputs.get(groupId);
  if (!group || root.typeOf(group) !== "RadioGroup") return [];
  const seen = new Set<string>();
  return (groupScope(root, group)?.items ?? []).flatMap((radio) => {
    const value = radioValue(radio);
    if (!value || seen.has(value)) return [];
    seen.add(value);
    const text =
      typeof radio.props.children === "string" && radio.props.children
        ? radio.props.children
        : value;
    return [{ value, label: text }];
  });
}

/** An item's text: its first descendant's own text (a Tab's label Text). */
function itemText(root: Root, node: CatalogConsumerNode): string {
  for (const id of node.children) {
    const child = root.canvasInputs.get(id);
    if (!child) continue;
    if (typeof child.props.children === "string" && child.props.children)
      return child.props.children;
    const deeper = itemText(root, child);
    if (deeper) return deeper;
  }
  return "";
}

/**
 * A Tabs record's Selected Tab field: its Tabs (key · label) and the selected one's key (RAC's —
 * the Tabs' key, else the first Selected · enabled Tab, else the first enabled).
 */
export function catalogTabsSelectedTab(
  root: Root,
  tabsId: string,
): { options: { value: string; label: string }[]; value: string } | undefined {
  const tabs = root.canvasInputs.get(tabsId);
  if (!tabs || root.typeOf(tabs) !== "Tabs") return undefined;
  const { pairs, selectedKey } = catalogTabsSelection(
    tabs,
    lookup(root),
    typeOf(root),
  );
  return {
    options: pairs.map((pair, index) => ({
      value: pair.key,
      label: itemText(root, pair.tab) || `Tab ${index + 1}`,
    })),
    value: selectedKey ?? "",
  };
}

const set = (value: string | boolean) => ({ kind: "set" as const, value });

/**
 * The writes that keep one value after the Properties patch of `recordId` (one target): none when
 * the patch leaves the selection alone. Run with the patch in one step (`composeCommands`).
 */
export function catalogSingleSelectionCommand(
  workspace: CatalogWorkspace,
  recordId: string,
  patch: Readonly<Record<string, unknown>>,
): CatalogCommand[] {
  const root = workspace.root;
  const record = root.canvasInputs.get(recordId);
  if (!record) return [];
  const target = (node: CatalogConsumerNode) =>
    workspace.positionOfRecord(node.id)?.target;
  const writes: Array<{
    node: CatalogConsumerNode;
    props: Record<string, ReturnType<typeof set>>;
  }> = [];
  // The others set Selected lose it (their own write — a template's Selected stays under it).
  const clearOthers = (scope: SelectionScope, keep?: CatalogConsumerNode) => {
    for (const item of scope.items)
      if (item.id !== keep?.id && item.props.isSelected === true)
        writes.push({ node: item, props: { isSelected: set(false) } });
  };
  // A RadioGroup's Value: the Radio with it is the selected one.
  if (root.typeOf(record) === "RadioGroup" && "value" in patch) {
    const scope = groupScope(root, record);
    if (!scope) return [];
    const value = typeof patch.value === "string" ? patch.value : "";
    const chosen = value
      ? scope.items.find((radio) => radioValue(radio) === value)
      : undefined;
    clearOthers(scope, chosen);
    if (chosen && chosen.props.isSelected !== true)
      writes.push({ node: chosen, props: { isSelected: set(true) } });
  } else if (root.typeOf(record) === "Tabs" && "defaultSelectedKey" in patch) {
    // The Selected Tab field: that Tab is the Selected one (the Tabs keep no key of their own).
    const scope = collectionScope(root, record);
    const key = String(patch.defaultSelectedKey ?? "");
    const chosen = scope.items.find(
      (tab) =>
        resolveStaticItemKey(tab.props as Record<string, unknown>, tab.id) ===
        key,
    );
    clearOthers(scope, chosen);
    if (chosen && chosen.props.isSelected !== true)
      writes.push({ node: chosen, props: { isSelected: set(true) } });
    if (record.props.defaultSelectedKey)
      writes.push({ node: record, props: { defaultSelectedKey: set("") } });
  } else if ("isSelected" in patch) {
    const scope = itemScope(root, record);
    if (!scope || !scope.single) return [];
    const on = patch.isSelected === true;
    if (on) clearOthers(scope, record);
    // The owner's own key follows (a RadioGroup's Value is this Radio's; a Tabs key would win
    // over the Selected Tab — `catalogTabsSelection`).
    if (scope.ownerType === "RadioGroup") {
      const value = radioValue(record);
      const current = String(scope.owner.props.value ?? "");
      if (on && value && current !== value)
        writes.push({ node: scope.owner, props: { value: set(value) } });
      if (!on && current && current === value)
        writes.push({ node: scope.owner, props: { value: set("") } });
    }
    if (
      scope.ownerType === "Tabs" &&
      on &&
      typeof scope.owner.props.defaultSelectedKey === "string" &&
      scope.owner.props.defaultSelectedKey !==
        resolveStaticItemKey(record.props as Record<string, unknown>, record.id)
    )
      writes.push({
        node: scope.owner,
        props: { defaultSelectedKey: set("") },
      });
  } else return [];
  return writes.flatMap(({ node, props }) => {
    const at = target(node);
    return at ? [setFields({ targets: [at], props })] : [];
  });
}
