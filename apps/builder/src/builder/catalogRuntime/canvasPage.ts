import { updatePage } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  BreakpointName,
  EntryId,
  PagePlacementDeclaration,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { PagePlacement } from "@composition/shared";
import { resolvePlacementForDrop } from "../workspace/canvas/scene/pagePlacementEdit";
import {
  catalogPagePlacement,
  type CatalogCompositionRoot,
} from "./compositionRoot";

/** The old per-key cascade shape back to the catalog page placement (base + breakpoint layers). */
function placementDeclaration(
  placement: PagePlacement | null,
): PagePlacementDeclaration | undefined {
  if (!placement) return undefined;
  const breakpoints: PagePlacementDeclaration["breakpoints"] = {};
  for (const [key, values] of Object.entries(placement.responsive ?? {}))
    for (const [name, value] of Object.entries(values ?? {}))
      if (value !== undefined)
        (breakpoints[name as BreakpointName] ??= {})[
          key as keyof PagePlacementDeclaration["base"]
        ] = value as string | number;
  const base = {
    ...(placement.style ?? {}),
  } as PagePlacementDeclaration["base"];
  return Object.keys(base).length || Object.keys(breakpoints).length
    ? { base, breakpoints }
    : undefined;
}

/**
 * ADR-248 Phase 4e-3b: the command a page frame drop commits — the old Builder's placement rule
 * (`resolvePlacementForDrop`: pin to the grid cell under the frame, swap with a page pinned there,
 * or place it freely off the grid; the home page and the first cell stay) over the catalog pages.
 * `undefined` = refused or unchanged. Off desktop the placement is that breakpoint's layer.
 */
export function catalogPageDropCommand(
  root: CatalogCompositionRoot,
  pageId: EntryId<"page">,
  dropped: { x: number; y: number },
): CatalogCommand | undefined {
  const graph = root.runtime.graph;
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return undefined;
  const rects = root.pageFrameRects();
  const placements: Record<string, PagePlacement | undefined> = {};
  for (const id of project.pageIds) {
    const page = graph.getEntry(id);
    if (page?.kind === "page" && page.placement)
      placements[id] = catalogPagePlacement(page.placement);
  }
  const result = resolvePlacementForDrop(
    {
      pages: project.pageIds.map((id) => ({ id })),
      homePageId: project.pageIds[0] ?? null,
      positions: Object.fromEntries(
        [...rects].map(([id, rect]) => [id, { x: rect.x, y: rect.y }]),
      ),
      pageSizes: Object.fromEntries(
        [...rects].map(([id, rect]) => [
          id,
          { width: rect.width, height: rect.height },
        ]),
      ),
      layout: root.pageLayout(),
      placements,
      activeBreakpoint: root.breakpoint,
      writeAsOverride: root.breakpoint !== "desktop",
    },
    pageId,
    dropped,
  );
  if (!result.entries.length) return undefined;
  return (reader) => ({
    label: "Move page",
    ops: result.entries.flatMap(
      (entry) =>
        updatePage({
          id: entry.pageId as EntryId<"page">,
          fields: { placement: placementDeclaration(entry.placement) },
        })(reader).ops,
    ),
  });
}
