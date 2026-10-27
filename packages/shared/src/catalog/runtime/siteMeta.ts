/**
 * ADR-286 Decision 6 · 8 — what a published page's `<head>` · sitemap · robots · redirects read
 * from the document: a page's own settings over the site's (Framer's override rule). Pure — the
 * publish export phase (user's call) writes them out; the Builder shows them.
 */
import type {
  CatalogAssetUrl,
  CatalogSiteRedirect,
  CatalogSiteSettings,
  EntryId,
  PageEntry,
  ProjectEntry,
} from "../document/types";

interface SiteReader {
  readonly projectId: EntryId<"project">;
  getEntry(id: string): unknown;
}
const projectOf = (reader: SiteReader) =>
  reader.getEntry(reader.projectId) as ProjectEntry | undefined;
const siteOf = (reader: SiteReader): CatalogSiteSettings =>
  projectOf(reader)?.site ?? {};

export interface CatalogPageHead {
  title?: string;
  description?: string;
  lang?: string;
  favicon: { light?: CatalogAssetUrl; dark?: CatalogAssetUrl };
  socialImage?: CatalogAssetUrl;
  /** `noindex` when the site or the page is kept out of search. */
  robots: "index" | "noindex";
}

/** The page's title · description · social image: its own, else the site's. */
export function resolvePageMeta(
  reader: SiteReader,
  pageId: string,
): { title?: string; description?: string; socialImage?: CatalogAssetUrl } {
  const site = siteOf(reader);
  const page = reader.getEntry(pageId) as PageEntry | undefined;
  const meta = page?.kind === "page" ? page.meta : undefined;
  const title = meta?.title || site.title;
  const description = meta?.description || site.description;
  const socialImage = meta?.socialImage ?? site.socialImage;
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(socialImage ? { socialImage } : {}),
  };
}

/** Everything one page's `<head>` holds. */
export function siteHead(reader: SiteReader, pageId: string): CatalogPageHead {
  const site = siteOf(reader);
  const page = reader.getEntry(pageId) as PageEntry | undefined;
  const hidden =
    (site.search && (!site.search.index || site.search.robots === "none")) ||
    (page?.kind === "page" && page.meta?.hidden?.search === true);
  return {
    ...resolvePageMeta(reader, pageId),
    ...(site.lang ? { lang: site.lang } : {}),
    favicon: { ...site.favicon },
    robots: hidden ? "noindex" : "index",
  };
}

/** The routes sitemap.xml lists: pages not hidden from it (none when the site turns it off). */
export function sitemapEntries(reader: SiteReader): string[] {
  const project = projectOf(reader);
  const site = project?.site ?? {};
  if (site.search && !site.search.sitemap) return [];
  const routes: string[] = [];
  for (const id of project?.pageIds ?? []) {
    const page = reader.getEntry(id) as PageEntry | undefined;
    if (page?.kind !== "page") continue;
    if (page.meta?.hidden?.sitemap || page.meta?.hidden?.search) continue;
    if (page.route.includes(":")) continue;
    routes.push(page.route);
  }
  return routes;
}

/** The first redirect whose `from` matches `path` (list order = priority; `*` = any rest). */
export function redirectFor(
  reader: SiteReader,
  path: string,
): CatalogSiteRedirect | undefined {
  for (const redirect of siteOf(reader).redirects ?? []) {
    const from = redirect.from;
    if (from.endsWith("*")) {
      if (path.startsWith(from.slice(0, -1))) return redirect;
    } else if (from === path) return redirect;
  }
  return undefined;
}
