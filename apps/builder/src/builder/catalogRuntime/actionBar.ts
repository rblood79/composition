import type { CatalogReader } from "../../../../../packages/shared/src/catalog/document/types";
import {
  applyActionBarPolicy,
  type ActionBarModel,
} from "../components/overlay/actionBar/actionBarPolicy";
import { catalogCanvasMenuItems, type CatalogMenuHost } from "./canvasMenu";
import type { CatalogConsumerNode } from "./compositionRoot";
import type { CatalogSelectionItem } from "./session";

const PAGE_GRID = "catalog:root";

export interface CatalogActionBarState {
  selectedIds: readonly string[];
  pageSelection: boolean;
  selectedPageId: string | null;
  resolved: boolean;
}

/** The page (or definition) whose frame a record is drawn in: its root record's source. */
function frameOf(
  graph: CatalogReader,
  records: ReadonlyMap<string, CatalogConsumerNode>,
  record: string,
): string | null {
  let cursor = records.get(record);
  for (let depth = 0; cursor && cursor.parentId !== PAGE_GRID; depth += 1) {
    if (depth > 256) return null;
    cursor = records.get(cursor.parentId);
  }
  if (!cursor) return null;
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return null;
  for (const pageId of project.pageIds) {
    const page = graph.getEntry(pageId);
    if (page?.kind === "page" && page.children[0] === cursor.sourceId)
      return pageId;
  }
  for (const definitionId of project.definitionIds) {
    const definition = graph.getEntry(definitionId);
    if (
      definition?.kind === "definition" &&
      definition.templateRootId === cursor.sourceId
    )
      return definitionId;
  }
  return null;
}

/**
 * ADR-248 Phase 4e: the Contextual Action Bar (ADR-192) over the catalog selection — what it
 * anchors to (the selection's page frame, the open page first) and whether a page body alone is
 * selected (page chrome only). The old bar read these from the element store.
 */
export function catalogActionBarState(
  graph: CatalogReader,
  records: ReadonlyMap<string, CatalogConsumerNode>,
  selection: readonly CatalogSelectionItem[],
  openPage: string | undefined,
): CatalogActionBarState {
  const selectedIds = selection.map((item) => item.identity);
  const resolved = selectedIds.every((id) => records.has(id));
  const pageSelection =
    selectedIds.length === 1 &&
    records.get(selectedIds[0])?.parentId === PAGE_GRID;
  let selectedPageId: string | null = null;
  for (const id of selectedIds) {
    const frame = frameOf(graph, records, id);
    if (frame && frame === openPage) {
      selectedPageId = frame;
      break;
    }
    selectedPageId ??= frame;
  }
  return { selectedIds, pageSelection, selectedPageId, resolved };
}

/**
 * The bar's items: the catalog context menu's (`canvas-element`) under the bar's policy —
 * allowlist, order and the five-item cap. An empty or page-body selection has no menu items (so
 * no bar items); a selection an undo took out of the document shows none either (the menu would
 * still list commands for the stale ids).
 */
export function catalogActionBarModel(
  host: CatalogMenuHost,
  state: CatalogActionBarState,
): ActionBarModel | null {
  if (!state.resolved) return null;
  return applyActionBarPolicy(
    catalogCanvasMenuItems(host, "canvas-element", state.selectedIds[0]),
  );
}
