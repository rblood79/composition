import type { CanonicalNode } from "@composition/shared";

/**
 * Canonical node의 fill payload를 읽는 compatibility boundary.
 *
 * `node.fills` 도입 전에 저장된 문서는 fill stack을
 * `metadata.legacyProps.fills`에만 보유할 수 있다. 모든 consumer가 top-level
 * 필드로 이관되기 전까지 이 fallback은 adapter 안에서만 유지한다.
 */
export function readCanonicalNodeFillPayload(
  node: Pick<CanonicalNode, "fills" | "metadata">,
): unknown[] | undefined {
  if (Array.isArray(node.fills) && node.fills.length > 0) {
    return node.fills;
  }

  const legacyFills = (
    node.metadata as { legacyProps?: { fills?: unknown } } | undefined
  )?.legacyProps?.fills;
  return Array.isArray(legacyFills) && legacyFills.length > 0
    ? legacyFills
    : undefined;
}
