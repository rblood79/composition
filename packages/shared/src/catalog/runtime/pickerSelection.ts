import type { CatalogConsumerNode } from "./compositionRoot";

type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** Popover를 넘어가는 Select의 목록 상태. 중첩된 다른 collection의 항목은 제외한다. */
export function catalogPickerOfOption(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
) {
  if (typeOf(node) !== "ListBoxItem") return undefined;
  let listSeen = false;
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId)) {
    const type = typeOf(parent);
    if (type === "ListBox") {
      if (listSeen) return undefined;
      listSeen = true;
    }
    if (type === "Select") return listSeen ? parent : undefined;
    if (["ComboBox", "Menu", "Dialog"].includes(type)) return undefined;
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

/** Select 옵션의 실제 selection 슬롯. RAC의 Checkbox context와는 별도인 표시 계약이다. */
export function catalogPickerSelectionItem(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
) {
  if (
    !["Checkbox", "Icon"].includes(typeOf(node)) ||
    node.props.slot !== "selection"
  )
    return undefined;
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId)) {
    if (typeOf(parent) === "ListBoxItem") return parent;
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
  return typeOf(node) === "Checkbox"
    ? picker?.props.selectionMode !== "multiple"
    : !picker || picker.props.selectionMode === "multiple";
}
