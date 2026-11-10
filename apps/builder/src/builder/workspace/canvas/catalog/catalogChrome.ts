import {
  isComponentsView,
  originOfSample,
} from "../../../catalogRuntime/originView";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import type { BoundingBox } from "../selection/types";
import { renderCounters } from "../skia/renderCounters";

/**
 * Slot chrome (editor only, not document paint). The definition edit view marks every declared
 * slot (origin color, hatched while empty); on the pages a project component's or layout's slot
 * that holds nothing is hatched (instance color, its visible part — the old page slot marker).
 * The Components page hatches a library origin's declared slots where they
 * hold nothing (the origin's sample in origin color, an instance's in instance color) — a filled
 * slot is not marked. An origin's sample keeps what its slots hold laid out but undrawn
 * (opacity 0): such a slot is hatched as empty at that size.
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
  // Built once per scene change (`catalogOverlayChrome.ts`), not per camera-only frame — the
  // ratchet (`render.overlayChromeBuilt`, pan) keeps it so (2026-10-21).
  if (process.env.NODE_ENV !== "production")
    renderCounters.overlayChromeBuilt += 1;
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
      if (
        originOfSample(cursor.sourceId) ||
        // The project components page draws a component's origin node itself.
        (cursor.sourceId.startsWith("project:node:") &&
          graph.definitionOfTemplateRoot(cursor.sourceId) !== undefined)
      )
        return "origin" as const;
    return "instance" as const;
  };
  // The Components page: content laid out but not drawn (an origin sample's slot contents).
  const undrawn = (id: string) => records.get(id)?.visual.opacity === 0;
  const marks: {
    box: BoundingBox;
    empty: boolean;
    role: "origin" | "instance";
    identity: string;
  }[] = [];
  for (const record of records.values()) {
    // A declared slot: the node's own (a project component's), or the library template's (a
    // built-in origin's collection host; an instance's record carries its template root's). The
    // record carries both (the resolver's `node.slot ?? inherited.slot`) — no document read per
    // record: this pass runs on every scene change over every page's records
    // (CANVAS_PERF_SCALING_2026-11 — an edit's `graph.getEntry` calls grew with the document).
    if (!record.slot) continue;
    const empty = components
      ? record.children.every(undrawn)
      : record.children.length === 0;
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

/** The most scene px a zero-height slot band takes — what a spatial query must cover. */
export const SLOT_BAND_MAX = 48;

/**
 * The drawn height of a slot mark (scene units). A slot that has a box is hatched at that box; only
 * one of no height gets a band the author can see and pick — 48 screen px, and never more than 48
 * scene px, so zooming out shrinks it with the content instead of growing it over its neighbours.
 */
export function catalogSlotBand(height: number, zoom: number): number {
  return height > 0 ? height : Math.min(SLOT_BAND_MAX, SLOT_BAND_MAX / zoom);
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
