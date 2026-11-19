import type { CatalogGraph } from "../document/graph";
import type { NodeEntry, NodeId } from "../document/types";

/**
 * The Skeleton a document node's load reaches (2026-11-19 사용자 결정 — a Skeleton follows the load of
 * the content bound inside it): the nearest owner that is a `Skeleton`, or `undefined` when a
 * `SkeletonCollection` (always loading — its own context) or nothing is nearer. One reading for the
 * resolver (the Skeleton's `isLoading`) and the composition root (a row refresh re-resolves that
 * Skeleton too).
 */
export function catalogNearestSkeletonOwner(
  graph: Pick<CatalogGraph, "getEntry" | "ownerOf">,
  id: string,
  typeOf: (entry: NodeEntry) => string,
): string | undefined {
  const seen = new Set<string>();
  for (
    let owner = graph.ownerOf(id as NodeId);
    owner && !seen.has(owner);
    owner = graph.ownerOf(owner as NodeId)
  ) {
    seen.add(owner);
    const entry = graph.getEntry(owner as NodeId);
    if (entry?.kind !== "node") return undefined;
    const type = typeOf(entry);
    if (type === "Skeleton") return owner;
    if (type === "SkeletonCollection") return undefined;
  }
  return undefined;
}
