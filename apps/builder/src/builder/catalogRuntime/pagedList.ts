import {
  composeOver,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  setPagination,
  setRowDisplay,
} from "../../../../../packages/shared/src/catalog/commands/rowDisplay";
import { removeTargets } from "../../../../../packages/shared/src/catalog/commands/structure";
import type {
  CatalogRowDisplay,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { catalogPageContentTarget } from "./pageSettings";
import { catalogPaletteInsertPlan } from "./paletteInsert";
import type { CatalogWorkspace } from "./workspace";

/**
 * 「Show rows」 → Pages (사용자 결정 2026-11-19 「pages 를 선택시 자동으로 pagination 을 붙여주는 게
 * 편하다」): the list shows `size` rows a page, and — when no Pagination pages it yet — a Pagination
 * goes right after the list and pages it. One step (Undo takes the Pagination and the display back);
 * the list stays selected (its panel is the one being edited). A list a Pagination already pages
 * only changes its display; one with no place for a Pagination (nothing accepts it) too.
 */
export function catalogPagedListCommand(
  workspace: CatalogWorkspace,
  /** The list's drawn record (the selection). */
  elementId: string,
  listId: NodeId,
  size: number,
  /** A Pagination pages this list already. */
  connected: boolean,
): CatalogCommand {
  const display = setRowDisplay(listId, { mode: "pages", size });
  const item = connected ? undefined : workspace.itemOfRecord(elementId);
  if (!item) return display;
  const graph = workspace.runtime.graph;
  const placed = catalogPaletteInsertPlan(
    {
      graph,
      records: workspace.root.domInputs,
      selection: () => [item],
      itemOfRecord: (identity) => workspace.itemOfRecord(identity),
      pageContent: () => {
        const { pageId } = workspace.session.getSnapshot();
        const page = pageId && graph.getEntry(pageId);
        const body =
          page && page.kind === "page" ? page.children[0] : undefined;
        return body ? catalogPageContentTarget(graph, body) : undefined;
      },
      newId: workspace.newId,
    },
    "Pagination",
    undefined,
    { beside: true },
  );
  if (!placed.command) return display;
  const { command: insert, id } = placed;
  return (reader) => {
    const plan = composeOver(reader, "Row display", [
      display,
      insert,
      setPagination(id, listId),
    ]);
    // (No `selectAfter` — the insert would move the selection to the Pagination.)
    return { label: plan.label, ops: plan.ops };
  };
}

/**
 * 「Show rows」 away from Pages — 「더 보기」 (`undefined`) or virtual scroll (사용자 결정 2026-11-19
 * 「page → scroll 로 변경시 pagination 은 제거」): the Paginations that page this list go with the
 * display, in one step (Undo gives them back, connected). The list stays selected.
 */
export function catalogUnpagedListCommand(
  listId: NodeId,
  display: CatalogRowDisplay | undefined,
  /** The Paginations paging this list (`pagesOf`). */
  paginationIds: readonly NodeId[],
): CatalogCommand {
  const change = setRowDisplay(listId, display);
  if (!paginationIds.length) return change;
  return (reader) => {
    const plan = composeOver(reader, "Row display", [
      change,
      removeTargets({
        targets: paginationIds.map((id) => ({ kind: "node", id })),
      }),
    ]);
    return { label: plan.label, ops: plan.ops };
  };
}
