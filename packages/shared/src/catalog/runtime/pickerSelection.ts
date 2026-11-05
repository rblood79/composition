import { resolveToken, type TokenRef } from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
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

/** S2 PickerItem의 Checkbox controlSize(sm). 위치는 catalog 목록의 기존 indicator 열을 사용한다. */
export function pickerOptionMetrics(size: unknown) {
  const key = (
    ["S", "M", "L", "XL"].includes(String(size)) ? String(size) : "M"
  ) as "S" | "M" | "L" | "XL";
  const rule = COMPONENT_RULES_TABLE.Checkbox.sizes[key];
  const indicator = rule.indicator!;
  const box = Number(resolveToken(indicator.boxSize as TokenRef));
  const edge = Number(resolveToken("{spacing.xs}"));
  return { box, radius: Number(indicator.boxRadius), edge };
}

/** Select 옵션의 실제 selection 슬롯. RAC의 Checkbox context와는 별도인 표시 계약이다. */
export function catalogPickerSelectionItem(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
) {
  if (typeOf(node) !== "Checkbox" || node.props.slot !== "selection")
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
  return (
    !!item &&
    catalogPickerOfOption(item, get, typeOf)?.props.selectionMode !== "multiple"
  );
}
