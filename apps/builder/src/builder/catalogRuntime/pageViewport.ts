import { updatePage } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  BreakpointName,
  CatalogReader,
} from "../../../../../packages/shared/src/catalog/document/types";

/**
 * A page frame's Canvas height (`PageEntry.viewportHeights` — a Builder view state like Adobe XD's
 * Viewport Height, user decision 2026-11-13): the page body's bottom handle and the Design panel's
 * Canvas H commit it as one `updatePage` step at the breakpoint — a px height, or `fit-content`
 * (the frame takes the page's whole content). A height equal to the frame's own (`ownHeight` — the
 * body's Height, Min H, else the screen) clears it; `undefined` when nothing changes.
 */
export function catalogPageViewportCommand(
  graph: CatalogReader,
  pageId: string,
  breakpoint: BreakpointName,
  height: number | "fit-content",
  ownHeight: number,
): CatalogCommand | undefined {
  const page = graph.getEntry(pageId);
  if (page?.kind !== "page") return undefined;
  const next = height === "fit-content" ? height : Math.round(height);
  const heights = { ...page.viewportHeights };
  if (next === Math.round(ownHeight)) delete heights[breakpoint];
  else heights[breakpoint] = next;
  if (heights[breakpoint] === page.viewportHeights?.[breakpoint])
    return undefined;
  return updatePage({
    id: page.id,
    fields: {
      viewportHeights: Object.keys(heights).length ? heights : undefined,
    },
    label: "Canvas height",
  });
}
