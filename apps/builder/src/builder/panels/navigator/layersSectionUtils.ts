import type { Key } from "react-stately";
import { resolveEditingContextForTreeSelection } from "../../utils/hierarchicalSelection";
import type { PanelNode } from "../panelNode";

export function buildLayerSectionElementMap(
  currentPageElements: PanelNode[],
  canonicalElements: readonly PanelNode[] | null,
): Map<string, PanelNode> {
  const map = new Map<string, PanelNode>();
  if (canonicalElements) {
    for (const element of canonicalElements) {
      map.set(element.id, element);
    }
  }
  for (const element of currentPageElements) {
    if (!map.has(element.id)) map.set(element.id, element);
  }
  return map;
}

export function resolveLayerTreeEditingContext(
  element: PanelNode,
  elementsMap: Map<string, PanelNode>,
): string | null {
  const lookup = elementsMap.has(element.id)
    ? elementsMap
    : new Map(elementsMap).set(element.id, element);
  return resolveEditingContextForTreeSelection(element.id, lookup);
}

/** 선택된 요소 전부의 조상을 펼침 대상으로 모은다. */
export function collectAutoExpandedParents(
  selectedIds: readonly string[],
  elementsMap: Map<string, PanelNode>,
): Set<Key> {
  const parents = new Set<Key>();
  const visited = new Set<string>();

  for (const selectedId of selectedIds) {
    let currentParentId = elementsMap.get(selectedId)?.parent_id ?? null;
    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);
      parents.add(currentParentId);
      currentParentId = elementsMap.get(currentParentId)?.parent_id ?? null;
    }
  }
  return parents;
}

export type LayerTreeSelectionIntent =
  | { readonly kind: "clear" }
  | { readonly kind: "single"; readonly element: PanelNode }
  | { readonly kind: "multiple"; readonly elementIds: string[] };

export function resolveLayerTreeSelectionIntent(
  elements: readonly PanelNode[],
): LayerTreeSelectionIntent {
  if (elements.length === 0) return { kind: "clear" };
  if (elements.length === 1) return { element: elements[0], kind: "single" };
  return {
    elementIds: elements.map((element) => element.id),
    kind: "multiple",
  };
}
