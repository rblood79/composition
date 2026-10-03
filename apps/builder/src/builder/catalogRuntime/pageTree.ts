import {
  createPage,
  reorderPages,
  updatePage,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  EntryId,
  NodeId,
  PageEntry,
} from "../../../../../packages/shared/src/catalog/document/types";

/** A catalog page as the Pages tree reads it (the tree's page shape). */
export interface CatalogTreePage {
  readonly id: EntryId<"page">;
  readonly title: string;
  readonly slug: string;
  readonly parent_id: EntryId<"page"> | null;
}

/** Page entries → the Pages tree's pages (same order; the route is the tree's slug). */
export function catalogTreePages(
  pages: readonly PageEntry[],
): CatalogTreePage[] {
  return pages.map((page) => ({
    id: page.id,
    title: page.name,
    slug: page.route,
    parent_id: page.parentId ?? null,
  }));
}

/**
 * The page to open after deleting the open page `deleted`: the one before it in the Pages order,
 * else the one after (the old Pages section's rule); none when it was the only page.
 */
export function catalogPageAfterDelete(
  pages: readonly { readonly id: EntryId<"page"> }[],
  deleted: EntryId<"page">,
): EntryId<"page"> | undefined {
  const index = pages.findIndex((page) => page.id === deleted);
  if (index < 0) return undefined;
  return (pages[index - 1] ?? pages[index + 1])?.id;
}

/** A new page after the others: `Page N` at the first free `/page-N`, with an empty body. */
export function catalogNewPageCommand(
  pages: readonly PageEntry[],
  newId: NewId,
): { command: CatalogCommand; pageId: EntryId<"page"> } {
  const routes = new Set(pages.map((page) => page.route));
  let n = pages.length + 1;
  while (routes.has(`/page-${n}`)) n++;
  const pageId = newId("page");
  const bodyId = newId("node") as NodeId;
  return {
    pageId,
    command: createPage({
      page: {
        kind: "page",
        id: pageId,
        route: `/page-${n}`,
        name: `Page ${n}`,
        children: [bodyId],
      },
      entries: [
        {
          kind: "node",
          id: bodyId,
          definitionId: "lib:definition:type-body",
          name: "Body",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
    }),
  };
}

/**
 * A Pages tree drop as one command: the dragged pages (with their descendants) move in the
 * project's page order to before or after the target, or (on) after the target's last descendant
 * as its last children; each dragged page whose parent changes gets the new parent. `undefined` = no change.
 */
export function catalogPageDropCommand(
  pages: readonly PageEntry[],
  draggedIds: readonly string[],
  targetId: string,
  dropPosition: "before" | "after" | "on",
): CatalogCommand | undefined {
  const byId = new Map(pages.map((page) => [page.id as string, page]));
  const target = byId.get(targetId);
  if (!target || draggedIds.some((id) => !byId.has(id))) return undefined;
  const parentOf = (id: string) => byId.get(id)?.parentId;
  const within = (id: string, ancestor: string) => {
    for (let at: string | undefined = id; at; at = parentOf(at))
      if (at === ancestor) return true;
    return false;
  };
  const dragged = new Set(draggedIds);
  const moving = pages.filter((page) => dragged.has(page.id));
  // Descendants of a dragged page travel with it (they keep their parent).
  const travelling = pages.filter(
    (page) =>
      !dragged.has(page.id) && draggedIds.some((id) => within(page.id, id)),
  );
  const moved = new Set([...moving, ...travelling].map((page) => page.id));
  if (moved.has(target.id)) return undefined;
  const rest = pages.filter((page) => !moved.has(page.id));
  const targetAt = rest.findIndex((page) => page.id === target.id);
  // Sibling order is the page order within a parent: before/after = next to the target; on = after
  // the target's last descendant (its children may sit anywhere after it in the order).
  let at = dropPosition === "before" ? targetAt : targetAt + 1;
  if (dropPosition === "on")
    rest.forEach((page, index) => {
      if (within(page.id, target.id)) at = Math.max(at, index + 1);
    });
  const block = pages.filter((page) => moved.has(page.id));
  const order = [...rest.slice(0, at), ...block, ...rest.slice(at)].map(
    (page) => page.id,
  );
  const parent = dropPosition === "on" ? target.id : target.parentId;
  const reparent = moving.filter((page) => page.parentId !== parent);
  if (!reparent.length && order.every((id, index) => id === pages[index].id))
    return undefined;
  const commands = [
    reorderPages({ ids: order, label: "Move page" }),
    ...reparent.map((page) =>
      updatePage({ id: page.id, fields: { parentId: parent } }),
    ),
  ];
  // The order (project entry) and the parents (page entries) touch different entries.
  return (reader) => ({
    label: "Move page",
    ops: commands.flatMap((command) => command(reader).ops),
  });
}
