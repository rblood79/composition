import { resolveStaticItemKey } from "../slotRoles";
import type { CatalogConsumerNode } from "./compositionRoot";

type Lookup = (id: string) => CatalogConsumerNode | undefined;

export function catalogSegmentItems(
  owner: CatalogConsumerNode,
  get: Lookup,
): CatalogConsumerNode[] {
  const items: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const id of node.children) {
      const child = get(id);
      if (!child) continue;
      if (child.bindingId === "segmentedcontrolitem") items.push(child);
      else if (child.bindingId !== "segmentedcontrol") visit(child);
    }
  };
  visit(owner);
  return items;
}

/** An item's key — its `id` (ADR-308 — the key `catalogItemKey` gives every selection item). */
export function catalogSegmentKey(item: CatalogConsumerNode): string {
  return resolveStaticItemKey(item.props as Record<string, unknown>, item.id);
}

export function catalogSegmentSelected(
  owner: CatalogConsumerNode,
  get: Lookup,
): string | null {
  if (owner.props.selectedKey != null) return String(owner.props.selectedKey);
  if (owner.props.defaultSelectedKey != null)
    return String(owner.props.defaultSelectedKey);
  const first = catalogSegmentItems(owner, get).find(
    (item) => item.props.isDisabled !== true,
  );
  return first ? catalogSegmentKey(first) : null;
}

export function catalogSegmentOwner(
  node: CatalogConsumerNode,
  get: Lookup,
): CatalogConsumerNode | undefined {
  let current = get(node.parentId);
  while (current) {
    if (current.bindingId === "segmentedcontrol") return current;
    current = get(current.parentId);
  }
}
