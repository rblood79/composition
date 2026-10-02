/**
 * ADR-248 Phase 4e-7: the synthetic descendant id test (`<instance>/<path>`) — pure, apart from the
 * old canonical lookup (`stores/canonical/syntheticDescendantLookup.ts` re-exports it).
 */
import { hasSyntheticIdPath } from "@composition/shared";

export function isSyntheticDescendantId(
  elementId: string | null | undefined,
): elementId is string {
  return (
    typeof elementId === "string" &&
    hasSyntheticIdPath(elementId) &&
    !elementId.startsWith("projection:") &&
    !elementId.includes("::page-frame::")
  );
}
