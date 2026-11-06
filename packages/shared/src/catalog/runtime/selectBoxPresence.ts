import type { CatalogConsumerNode } from "./compositionRoot";

export function selectBoxDescriptionHidden(
  slot: unknown,
  orientation: unknown,
): boolean {
  return slot === "description" && orientation !== "horizontal";
}

/** S2 vertical cards keep descriptions authored while neither consumer displays them. */
export function catalogSelectBoxDescriptionHidden(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): boolean {
  if (typeOf(node) !== "Text" || node.props.slot !== "description")
    return false;
  let item = get(node.parentId);
  while (item && typeOf(item) === "frame") item = get(item.parentId);
  const group =
    item && typeOf(item) === "SelectBox" ? get(item.parentId) : undefined;
  return (
    !!group &&
    typeOf(group) === "SelectBoxGroup" &&
    selectBoxDescriptionHidden(node.props.slot, group.props.orientation)
  );
}
