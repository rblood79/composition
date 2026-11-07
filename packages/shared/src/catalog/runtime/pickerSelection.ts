import type { CatalogConsumerNode } from "./compositionRoot";
import { selectBoxDisabledKeys } from "./selectBoxSelection";
import { resolveStaticItemKey } from "../slotRoles";

type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** The pickers whose Popover holds their ListBox and follows the trigger's width. */
export const LISTBOX_PICKER_TYPES: ReadonlySet<string> = new Set([
  "Select",
  "ComboBox",
]);

/** 선택 부품의 소유자: Select/ComboBox의 Popover 또는 가장 가까운 Menu. */
export function catalogPickerOfOption(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
) {
  if (typeOf(node) === "SelectBox") {
    const group = get(node.parentId);
    return group && typeOf(group) === "SelectBoxGroup" ? group : undefined;
  }
  if (typeOf(node) === "MenuItem") {
    for (
      let parent = get(node.parentId);
      parent;
      parent = get(parent.parentId)
    ) {
      if (typeOf(parent) === "Menu") return parent;
      if (!["MenuSection", "SubmenuTrigger"].includes(typeOf(parent)))
        return undefined;
    }
    return undefined;
  }
  if (typeOf(node) !== "ListBoxItem") return undefined;
  let listSeen = false;
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId)) {
    const type = typeOf(parent);
    if (type === "ListBox") {
      if (listSeen) return undefined;
      listSeen = true;
    }
    if (LISTBOX_PICKER_TYPES.has(type)) return listSeen ? parent : undefined;
    if (["Menu", "Dialog"].includes(type)) return undefined;
  }
  return undefined;
}

export function catalogPickerOptions(
  owner: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  const items: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const id of node.children) {
      const child = get(id);
      if (!child) continue;
      if (typeOf(child) === "ListBoxItem") {
        if (catalogPickerOfOption(child, get, typeOf)?.id === owner.id)
          items.push(child);
      } else if (typeOf(child) !== "Select") visit(child);
    }
  };
  visit(owner);
  return items;
}

/** The initial ComboBox selection is shared by RAC and its Canvas input text. */
export function catalogComboBoxSelectedOption(
  owner: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
) {
  const key = owner.props.selectedKey;
  return catalogPickerOptions(owner, get, typeOf).find((item) =>
    key === undefined
      ? item.props.isSelected === true
      : key != null &&
        String(
          resolveStaticItemKey(item.props as Record<string, unknown>, item.id),
        ) === String(key),
  );
}

/** 목록 항목의 실제 selection 부품. 선택 동작은 RAC 항목이 소유한다. */
export function catalogPickerSelectionItem(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
) {
  // (the slot first — this runs for every record, and nearly all leave here)
  if (node.props.slot !== "selection") return undefined;
  const type = typeOf(node);
  if (type !== "Checkbox" && type !== "Icon") return undefined;
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId)) {
    if (["ListBoxItem", "MenuItem", "SelectBox"].includes(typeOf(parent)))
      return parent;
    if (
      ["Checkbox", "ListBox", "GridListItem", "TreeItem", "Row"].includes(
        typeOf(parent),
      )
    )
      return undefined;
  }
  return undefined;
}

export function catalogPickerSelectionHidden(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
) {
  const item = catalogPickerSelectionItem(node, get, typeOf);
  if (!item) return false;
  const picker = catalogPickerOfOption(item, get, typeOf);
  if (!picker) return true;
  if (
    typeOf(item) === "SelectBox" &&
    selectBoxDisabledKeys(picker.props, [
      {
        key: resolveStaticItemKey(
          item.props as Record<string, unknown>,
          item.id,
        ),
        isDisabled: item.props.isDisabled === true,
      },
    ]).includes(
      resolveStaticItemKey(item.props as Record<string, unknown>, item.id),
    )
  )
    return true;
  const parent = get(item.parentId);
  if (parent && typeOf(parent) === "SubmenuTrigger") return true;
  const mode =
    typeOf(picker) === "ComboBox"
      ? "single"
      : (picker.props.selectionMode ??
        (typeOf(picker) === "Menu" ? "none" : "single"));
  if (mode === "none") return true;
  if (
    typeOf(item) === "ListBoxItem" &&
    (item.props.href || (typeOf(picker) === "ComboBox" && item.props.onAction))
  )
    return true;
  return (typeOf(node) === "Checkbox") !== (mode === "multiple");
}
