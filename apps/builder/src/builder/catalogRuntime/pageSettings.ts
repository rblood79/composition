import {
  applyLayout,
  updatePage,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  EntryId,
  NodeId,
  PageEntry,
  TemplateId,
} from "../../../../../packages/shared/src/catalog/document/types";

/** The graph reads the page settings need (`CatalogGraph` is one). */
export interface CatalogPageReader extends CatalogReader {
  ownerOf(id: string): string | undefined;
}

const BODY_DEFINITION = "lib:definition:type-body";
/** The old nested-route limit: a page sits at most this many levels deep. */
export const CATALOG_MAX_PAGE_DEPTH = 5;

/**
 * The page a node's page settings edit: a page root (the body, or the layout instance a layout
 * makes of it) or the body inside a layout's slot. Other nodes have none.
 */
export function catalogSettingsPage(
  graph: CatalogPageReader,
  nodeId: NodeId,
): EntryId<"page"> | undefined {
  const node = graph.getEntry(nodeId);
  if (node?.kind !== "node") return undefined;
  const owner = graph.ownerOf(nodeId);
  if (owner && graph.getEntry(owner)?.kind === "page")
    return owner as EntryId<"page">;
  if (node.definitionId !== BODY_DEFINITION) return undefined;
  for (let id = owner; id; id = graph.ownerOf(id))
    if (graph.getEntry(id)?.kind === "page") return id as EntryId<"page">;
  return undefined;
}

/** The project's reusable page layouts (definitions with `usage: "layout"`). */
export function catalogPageLayouts(
  graph: CatalogReader,
): { id: EntryId<"definition">; name: string }[] {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  return project.definitionIds.flatMap((id) => {
    const definition = graph.getEntry(id);
    return definition?.kind === "definition" && definition.usage === "layout"
      ? [{ id, name: definition.name }]
      : [];
  });
}

/** The layout a page uses: its one root is an instance of a layout definition. */
export function catalogPageLayoutId(
  graph: CatalogReader,
  pageId: EntryId<"page">,
): EntryId<"definition"> | undefined {
  const page = graph.getEntry(pageId);
  if (page?.kind !== "page" || page.children.length !== 1) return undefined;
  const root = graph.getEntry(page.children[0]);
  if (root?.kind !== "node") return undefined;
  const definition = graph.getEntry(root.definitionId);
  return definition?.kind === "definition" && definition.usage === "layout"
    ? definition.id
    : undefined;
}

/** A declared slot of a page's layout: its template path (`applyLayout`'s `slotPath`) and name. */
export interface CatalogPageLayoutSlot {
  path: readonly TemplateId[];
  name: string;
}

/**
 * The slots of the layout a page uses (template order) and the one its content fills (4e-6-37 —
 * the old page's slot choice): `undefined` without a layout.
 */
export function catalogPageLayoutSlots(
  graph: CatalogReader,
  pageId: EntryId<"page">,
): { slots: CatalogPageLayoutSlot[]; current: string | undefined } | undefined {
  const definitionId = catalogPageLayoutId(graph, pageId);
  const definition = definitionId ? graph.getEntry(definitionId) : undefined;
  if (definition?.kind !== "definition" || !definition.templateRootId)
    return undefined;
  const slots: CatalogPageLayoutSlot[] = [];
  const visit = (path: readonly TemplateId[]) => {
    const node = graph.getEntry(path[path.length - 1] as NodeId);
    if (node?.kind !== "node") return;
    if (node.slot) slots.push({ path, name: node.slot.name });
    for (const child of node.children)
      visit([...path, child as unknown as TemplateId]);
  };
  visit([definition.templateRootId as TemplateId]);
  const page = graph.getEntry(pageId) as PageEntry;
  const instance = graph.getEntry(page.children[0]);
  const fill =
    instance?.kind === "node"
      ? instance.descendantOverrides.find((item) => item.kind === "fillSlot")
      : undefined;
  return {
    slots,
    current:
      fill?.kind === "fillSlot" ? fill.address.templatePath.join() : undefined,
  };
}

function depthOf(
  byId: ReadonlyMap<string, PageEntry>,
  page: PageEntry,
): number {
  let depth = 0;
  for (
    let parent = page.parentId && byId.get(page.parentId);
    parent && depth <= byId.size;
    parent = parent.parentId && byId.get(parent.parentId)
  )
    depth++;
  return depth;
}

/**
 * Pages a page can nest under: not itself, not one of its descendants, and not so deep that the
 * page would pass the nesting limit. Each with its depth (the list indents by it).
 */
export function catalogParentPageOptions(
  pages: readonly PageEntry[],
  pageId: EntryId<"page">,
): { page: PageEntry; depth: number }[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const descendant = (page: PageEntry): boolean => {
    for (
      let cursor: PageEntry | undefined = page, hops = 0;
      cursor && hops <= pages.length;
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined, hops++
    )
      if (cursor.id === pageId) return true;
    return false;
  };
  return pages.flatMap((page) => {
    if (descendant(page)) return [];
    const depth = depthOf(byId, page);
    return depth + 1 < CATALOG_MAX_PAGE_DEPTH ? [{ page, depth }] : [];
  });
}

export type CatalogRouteRefusal =
  "ROUTE_EMPTY" | "ROUTE_CHARACTERS" | "ROUTE_SLASHES" | "ROUTE_TAKEN";

/**
 * A route edit as one command, or why it is refused: a route starts with `/`, uses letters,
 * digits, hyphens and single slashes, does not end with a slash (except `/`) and no other page
 * has it.
 */
export function catalogPageRouteEdit(
  pages: readonly PageEntry[],
  pageId: EntryId<"page">,
  raw: string,
): { command: CatalogCommand } | { refused: CatalogRouteRefusal } {
  const text = raw.trim();
  if (!text) return { refused: "ROUTE_EMPTY" };
  const route = text.startsWith("/") ? text : `/${text}`;
  if (!/^[a-z0-9\-/]+$/i.test(route)) return { refused: "ROUTE_CHARACTERS" };
  if (/\/\//.test(route) || (route.length > 1 && route.endsWith("/")))
    return { refused: "ROUTE_SLASHES" };
  if (pages.some((page) => page.id !== pageId && page.route === route))
    return { refused: "ROUTE_TAKEN" };
  return {
    command: updatePage({ id: pageId, fields: { route }, label: "Page route" }),
  };
}

/**
 * ADR-248 Phase 4e-4: the page section's commands — each one history step. Removing a layout
 * puts the page's content back on the page; a parent is a route hierarchy only.
 */
export const catalogPageCommands = {
  parent: (
    pageId: EntryId<"page">,
    parentId: EntryId<"page"> | undefined,
  ): CatalogCommand =>
    updatePage({
      id: pageId,
      fields: { parentId },
      label: "Parent page",
    }),
  layout: (
    pageId: EntryId<"page">,
    definitionId: EntryId<"definition"> | undefined,
    newId: NewId,
    slotPath?: readonly TemplateId[],
  ): CatalogCommand =>
    applyLayout({
      pageId,
      definitionId,
      newId,
      ...(slotPath ? { slotPath, label: "Layout slot" } : {}),
    }),
};
