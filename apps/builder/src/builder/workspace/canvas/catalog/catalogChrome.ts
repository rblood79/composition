import {
  isComponentsView,
  isPageParts,
  originOfSample,
} from "../../../catalogRuntime/originView";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import type { BoundingBox } from "../selection/types";

/**
 * Slot chrome (editor only, not document paint). The definition edit view marks every declared
 * slot (origin color, hatched while empty); on the pages a project component's or layout's slot
 * that holds nothing is hatched (instance color, its visible part — the old page slot marker).
 * The Components page outlines the parts of an origin drawn for its parts (`region`: the part's
 * own box, never the empty slot's band) and hatches a library origin's declared slots where they
 * hold nothing (the origin's sample in origin color, an instance's in instance color) — a filled
 * slot is not marked (the page shows the origin's content, not its edit chrome).
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
  region?: true;
}[] {
  const graph = workspace.runtime.graph;
  // One root read per pass (the ADR-246 ratchet counts `workspace.root`).
  const root = workspace.root;
  const components = isComponentsView(root.definitionView);
  const view = !components && !!root.definitionView;
  const records = root.domInputs;
  // The Components page: a record under an origin's sample is the origin's; the rest instances'.
  const pageRole = (record: { sourceId: string; parentId: string }) => {
    for (
      let cursor: { sourceId: string; parentId: string } | undefined = record;
      cursor;
      cursor = records.get(cursor.parentId)
    )
      if (originOfSample(cursor.sourceId)) return "origin" as const;
    return "instance" as const;
  };
  const marks: {
    box: BoundingBox;
    empty: boolean;
    role: "origin" | "instance";
    identity: string;
    region?: true;
  }[] = [];
  for (const record of records.values()) {
    // A part of an origin drawn for its parts: its drawn box (a hidden part has none).
    if (isPageParts(records.get(record.parentId)?.sourceId)) {
      const box = bounds.get(record.id);
      if (box && box.width > 0 && box.height > 0)
        marks.push({
          box,
          empty: false,
          role: "instance",
          identity: record.id,
          region: true,
        });
      continue;
    }
    // A declared slot: the node's own (a project component's), or the library template's (a
    // built-in origin's collection host — the record carries it, an instance's record its
    // template root's).
    const node = graph.getEntry(record.sourceId);
    const slot = (node?.kind === "node" ? node.slot : undefined) ?? record.slot;
    if (!slot) continue;
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
        role: view ? "origin" : components ? pageRole(record) : "instance",
        identity: record.id,
      });
  }
  return marks;
}

/**
 * The drawn height of a slot mark (scene units). A slot that has a box is hatched at that box; only
 * one of no height gets a band the author can see and pick — 48 screen px, and never more than 48
 * scene px, so zooming out shrinks it with the content instead of growing it over its neighbours.
 */
export function catalogSlotBand(height: number, zoom: number): number {
  return height > 0 ? height : Math.min(48, 48 / zoom);
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
