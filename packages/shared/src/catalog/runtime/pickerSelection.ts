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

export function pickerOptionPaint(
  selected: boolean,
  disabled: boolean,
  active = false,
) {
  const neutral = active
    ? "{color.picker-content-hover}"
    : "{color.picker-content}";
  return {
    background: (selected
      ? disabled
        ? "{color.picker-content-disabled}"
        : neutral
      : "{color.picker-checkbox-base}") as TokenRef,
    border: (selected
      ? "{color.transparent}"
      : disabled
        ? "{color.picker-content-disabled}"
        : neutral) as TokenRef,
    check: "{color.picker-checkbox-base}" as TokenRef,
  };
}
