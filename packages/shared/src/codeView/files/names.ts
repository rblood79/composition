/**
 * ADR-296 breakdown §4f — the code names of project entries, in one place: a page's component (and
 * file) name, a layout's. Names are display only — the anchors and symbol tables hold identity — and
 * deterministic (document order; a repeated name takes `2` · `3`).
 */
import type {
  CatalogReader,
  DefinitionEntry,
  EntryId,
  NodeEntry,
  PageEntry,
  ProjectEntry,
} from "../../catalog/document/types";

/** The names the App file itself uses (a page or layout never takes one). */
const APP_RESERVED = new Set([
  "App",
  "Theme",
  "Outlet",
  "RouterProvider",
  "ToastContainer",
  "createBrowserRouter",
  "router",
]);

/** PascalCase of a display name (`about us` → `AboutUs`); empty → the fallback. */
export function pascal(raw: string, fallback: string): string {
  const name = raw
    .replace(/[^A-Za-z0-9_$\s-]/g, " ")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  const safe = name || fallback;
  return /^[0-9]/.test(safe) ? `_${safe}` : safe;
}

type Reader = Pick<CatalogReader, "projectId" | "getEntry">;

const projectOf = (reader: Reader) =>
  reader.getEntry(reader.projectId) as ProjectEntry;

/** Page id → its component name (unique among the pages and the layouts). */
export function codeViewPageNames(reader: Reader): Map<string, string> {
  return codeViewProjectNames(reader).pages;
}

/** The page and layout component names, unique together. */
export function codeViewProjectNames(reader: Reader): {
  pages: Map<string, string>;
  layouts: Map<string, string>;
} {
  const taken = new Set(APP_RESERVED);
  const take = (raw: string, fallback: string) => {
    const base = pascal(raw, fallback);
    let name = base;
    for (let index = 2; taken.has(name); index += 1) name = `${base}${index}`;
    taken.add(name);
    return name;
  };
  const project = projectOf(reader);
  const pages = new Map<string, string>();
  for (const id of project.pageIds) {
    const page = reader.getEntry(id) as PageEntry | undefined;
    if (page?.kind === "page") pages.set(id, take(page.name, "Page"));
  }
  const layouts = new Map<string, string>();
  for (const id of project.definitionIds) {
    const definition = reader.getEntry(id) as DefinitionEntry | undefined;
    if (definition?.kind === "definition" && definition.usage === "layout")
      layouts.set(id, take(definition.name, "Layout"));
  }
  return { pages, layouts };
}

/**
 * The layout a page has (ADR-286 `applyLayout`): its body is an instance of a layout definition, or
 * its one root is. Undefined = none.
 */
export function codeViewPageLayout(
  reader: Reader,
  page: PageEntry,
): EntryId<"definition"> | undefined {
  if (page.children.length !== 1) return undefined;
  const root = reader.getEntry(page.children[0]!) as NodeEntry | undefined;
  if (root?.kind !== "node" || root.definitionId.startsWith("lib:"))
    return undefined;
  const definition = reader.getEntry(root.definitionId) as
    DefinitionEntry | undefined;
  return definition?.kind === "definition" && definition.usage === "layout"
    ? definition.id
    : undefined;
}
