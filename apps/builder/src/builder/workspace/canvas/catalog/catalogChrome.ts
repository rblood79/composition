import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import type { BoundingBox } from "../selection/types";

/**
 * Slot chrome (editor only, not document paint). The definition edit view marks every declared
 * slot (origin color, hatched while empty); on the pages a project component's or layout's slot
 * that holds nothing is hatched (instance color, its visible part — the old page slot marker).
 */
export function catalogSlotMarks(
  workspace: CatalogWorkspace,
  bounds: ReadonlyMap<string, BoundingBox>,
  hitBounds: ReadonlyMap<string, BoundingBox>,
): {
  box: BoundingBox;
  empty: boolean;
  role: "origin" | "instance";
  identity: string;
}[] {
  const graph = workspace.runtime.graph;
  const view = !!workspace.root.definitionView;
  const marks: {
    box: BoundingBox;
    empty: boolean;
    role: "origin" | "instance";
    identity: string;
  }[] = [];
  for (const record of workspace.root.domInputs.values()) {
    const node = graph.getEntry(record.sourceId);
    if (node?.kind !== "node" || !node.slot) continue;
    const empty = record.children.length === 0;
    if (!view && !empty) continue;
    // An empty slot of no height has no visible part to clip: its own box (the band shows it).
    const own = bounds.get(record.id);
    const box = view
      ? own
      : (hitBounds.get(record.id) ?? (own?.height === 0 ? own : undefined));
    if (box)
      marks.push({
        box,
        empty,
        role: view ? "origin" : "instance",
        identity: record.id,
      });
  }
  return marks;
}

/** The leaf records under a record (its own id when it has no children). */
export function catalogLeafRecords(
  records: ReadonlyMap<string, { readonly children: readonly string[] }>,
  id: string,
): string[] {
  const leaves: string[] = [];
  const visit = (current: string) => {
    const children = records.get(current)?.children ?? [];
    if (!children.length) leaves.push(current);
    else children.forEach(visit);
  };
  visit(id);
  return leaves;
}

/**
 * The boxes of the pages painted after a record's own page (canvas-interaction §8.5, 2026-08-12):
 * content chrome of the record (slot hatch, row remainder, binding badge, hover outline) is cut
 * there — the ancestor clip (`hitBoundsMap`) knows nothing about other pages, and the overlay pass
 * draws over the whole scene. `paintRoots` is the scene's page root order (active page last).
 */
export function catalogOccludingPages(
  identity: string,
  parentOf: (id: string) => string | undefined,
  paintRoots: readonly string[],
  boundsOf: (id: string) => BoundingBox | undefined,
): BoundingBox[] {
  let pageRoot = identity;
  for (
    let parent = parentOf(pageRoot);
    parent && parent !== "catalog:root";
    parent = parentOf(pageRoot)
  )
    pageRoot = parent;
  const at = paintRoots.indexOf(pageRoot);
  if (at < 0) return [];
  return paintRoots.slice(at + 1).flatMap((id) => {
    const box = boundsOf(id);
    return box ? [box] : [];
  });
}
