/**
 * Preview routing over the catalog pages (the old `CanvasRouter`'s rules): a path matches a page
 * whose `route` is the same, else a page whose route has `:param` segments that fit it (static
 * routes first); the `?query` and `#hash` of a link do not take part. No match = the project's
 * 404 page (a page routed `/404`), else the built-in not-found view. The catalog page's route is
 * the full path, so there is no parent-prefix composition here.
 */
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type { EntryId } from "../../../../../packages/shared/src/catalog/document/types";

export const NOT_FOUND_ROUTE = "/404";

const segmentsOf = (path: string): string[] =>
  path
    .split(/[?#]/)[0]!
    .split("/")
    .filter((segment) => segment.length > 0);

/** The `:param` values when `route` fits `path`, else undefined. */
export function matchCatalogRoute(
  route: string,
  path: string,
): Record<string, string> | undefined {
  const pattern = segmentsOf(route);
  const actual = segmentsOf(path);
  if (pattern.length !== actual.length) return undefined;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const expected = pattern[i]!;
    const given = actual[i]!;
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(given);
    } else if (expected !== given) return undefined;
  }
  return params;
}

export interface CatalogRouteMatch {
  pageId: EntryId<"page">;
  params: Record<string, string>;
}

/** The page a path leads to: an exact route first, then the first `:param` route that fits. */
export function resolveCatalogRoute(
  graph: CatalogGraph,
  path: string,
): CatalogRouteMatch | undefined {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return undefined;
  const pages = project.pageIds.flatMap((id) => {
    const page = graph.getEntry(id);
    return page?.kind === "page" ? [page] : [];
  });
  const exact = pages.find((page) => page.route === path.split(/[?#]/)[0]);
  if (exact) return { pageId: exact.id, params: {} };
  for (const page of pages) {
    if (!page.route.includes(":")) continue;
    const params = matchCatalogRoute(page.route, path);
    if (params) return { pageId: page.id, params };
  }
  return undefined;
}

/** The project's own 404 page (`/404`), if it has one. */
export function catalogNotFoundPage(
  graph: CatalogGraph,
): EntryId<"page"> | undefined {
  return resolveCatalogRoute(graph, NOT_FOUND_ROUTE)?.pageId;
}
