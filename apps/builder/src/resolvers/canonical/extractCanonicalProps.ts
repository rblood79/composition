/**
 * @fileoverview ResolvedNode → canonical props helper — ADR-116 direct cutover.
 *
 * Resolver output consumers must read component payload from `ResolvedNode.props`
 * only. Metadata is reserved for page/import/debug annotations and adapter/export
 * quarantine payloads.
 */

import type { ResolvedNode } from "@composition/shared";

export function extractCanonicalPropsFromResolved(
  resolved: ResolvedNode,
): Record<string, unknown> {
  return resolved.props ? { ...resolved.props } : {};
}
