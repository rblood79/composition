import type { CanonicalNode } from "@composition/shared";
import {
  getSyntheticDescendantRootId,
  isSyntheticDescendantId,
} from "../../stores/canonical/syntheticDescendantLookup";

/**
 * ADR-150 A3' — 데이터 행 (ListBox 행 · GridList 카드 · Tag · Tab) 을 펼치는 항목 템플릿 origin 의 type.
 * 데이터 행 더블클릭이 이 origin (또는 그 자식) 으로 이동해 선택한다 — 편집은 이 origin 을 쓰는 모든 행에
 * 퍼진다.
 */
const ITEM_TEMPLATE_ORIGIN_TYPES: ReadonlySet<string> = new Set([
  "ListBoxItem",
  "GridListItem",
  "Tag",
  "Tab",
]);

const MAX_REF_CHAIN = 16;

/** reusable 노드의 origin type — 변형 origin (reusable ref) 은 체인 끝 type. */
function originTypeOf(
  node: CanonicalNode,
  nodeMap: ReadonlyMap<string, CanonicalNode>,
): string {
  let current: CanonicalNode | undefined = node;
  for (
    let depth = 0;
    current?.type === "ref" && depth < MAX_REF_CHAIN;
    depth++
  ) {
    current = nodeMap.get((current as { ref?: string }).ref ?? "");
  }
  return String(current?.type ?? node.type);
}

/**
 * 선택 요소가 항목 템플릿 origin 이거나 그 안쪽이면 그 origin, 아니면 null. synthetic 자식
 * (`<origin 안 ref>/<path>`) 은 root 부터 올라간다.
 */
export function resolveEnclosingItemTemplateOrigin(
  elementId: string,
  nodeMap: ReadonlyMap<string, CanonicalNode>,
  ancestorsOf: (nodeId: string) => readonly CanonicalNode[],
): CanonicalNode | null {
  const baseId = isSyntheticDescendantId(elementId)
    ? getSyntheticDescendantRootId(elementId)
    : elementId;
  const node = baseId ? nodeMap.get(baseId) : undefined;
  if (!node) return null;
  for (const candidate of [node, ...ancestorsOf(node.id)]) {
    if (
      (candidate as { reusable?: boolean }).reusable === true &&
      ITEM_TEMPLATE_ORIGIN_TYPES.has(originTypeOf(candidate, nodeMap))
    ) {
      return candidate;
    }
  }
  return null;
}
