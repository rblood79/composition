/**
 * User 2026-10-31 「toast 컴퍼넌트 origin 이 library 에 없다」 — the Library page is stored the first
 * time it opens (ADR-282 Phase 3), so an origin that joined the palette later (Toast — 295 후속 C9)
 * never got a card there. The stored Library page records the origins it has given a card
 * (`PageEntry.originIds`): an origin not listed gets its card on open, in palette order, with no
 * history entry; a card the user deleted is not given again (user 2026-10-31 「Library 에서 지운
 * 카드는 다시 넣지 마라」); a page stored before the list gives every missing card once.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { removeTargets } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  LibraryDefinitionId,
  NodeId,
  PageEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogOperation } from "../../../../../../packages/shared/src/catalog/transactions/transaction";
import { catalogComponentPageId } from "../componentsPage";
import {
  COMPONENTS_VIEW,
  componentPageNodeId,
  ORIGIN_VIEW_NODE,
  originCardId,
} from "../originView";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const LIBRARY_PAGE = catalogComponentPageId(COMPONENTS_VIEW);

/** A project whose Library page is stored (opened once), then closed. */
async function stored() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:library-sync" as const,
        name: "Library sync",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `library-sync-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const graph = workspace.runtime.graph;
  const origin = (type: string) =>
    catalogPaletteDefinitionId(library, type) as LibraryDefinitionId;
  workspace.showDefinition(COMPONENTS_VIEW);
  workspace.showDefinition(undefined);
  const toastCard = componentPageNodeId(originCardId(origin("Toast")));
  const alertCard = componentPageNodeId(originCardId(origin("InlineAlert")));
  const body = () => {
    const entry = graph.storedEntry(ORIGIN_VIEW_NODE);
    return entry?.kind === "node" ? entry.children : [];
  };
  const page = () => graph.storedEntry(LIBRARY_PAGE) as PageEntry;
  const subtree = (id: string): string[] => {
    const entry = graph.storedEntry(id);
    return entry?.kind === "node"
      ? [id, ...entry.children.flatMap(subtree)]
      : [id];
  };
  /** The page as one stored before Toast joined: no Toast card, `originIds` as given. */
  const withoutToast = (originIds: readonly string[] | undefined) => {
    const removed = subtree(toastCard);
    const { originIds: _, ...rest } = page();
    workspace.runtime.load("Old page", [
      ...removed.map((id): CatalogOperation => ({
        kind: "remove",
        id: id as NodeId,
      })),
      {
        kind: "put",
        entry: {
          ...graph.storedEntry(ORIGIN_VIEW_NODE)!,
          children: body().filter((id) => id !== toastCard),
        } as never,
      },
      {
        kind: "put",
        entry: (originIds ? { ...rest, originIds } : rest) as never,
      },
    ]);
    expect(graph.storedEntry(toastCard)).toBeUndefined();
    return removed;
  };
  const toastBack = (removed: string[]) => {
    expect(body()[body().indexOf(alertCard) + 1]).toBe(toastCard);
    // The same card as a fresh page stores: every node back, the ◆ holder pointing at the origin.
    expect(subtree(toastCard).sort()).toEqual([...removed].sort());
    expect(
      subtree(toastCard).some((id) => {
        const entry = graph.storedEntry(id);
        return entry?.kind === "node" && entry.originOf === origin("Toast");
      }),
    ).toBe(true);
  };
  return {
    workspace,
    graph,
    origin,
    toastCard,
    alertCard,
    body,
    page,
    withoutToast,
    toastBack,
  };
}

describe("stored Library page follows the built-in origins", () => {
  it("a new Library page records the origins it gave a card", async () => {
    const { workspace, page, origin, body, alertCard, toastCard } =
      await stored();
    expect(page().originIds).toContain(origin("Toast"));
    expect(page().originIds).toContain(origin("ColorSwatch"));
    expect(body()[body().indexOf(alertCard) + 1]).toBe(toastCard);
    workspace.dispose();
  });

  it("an origin the page has not given (Toast joined later) gets its card on open — after InlineAlert's, no history; then nothing to do", async () => {
    const { workspace, graph, origin, page, withoutToast, toastBack } =
      await stored();
    const removed = withoutToast(
      page().originIds!.filter((id) => id !== origin("Toast")),
    );
    const history = workspace.history.getSnapshot().labels;
    workspace.showDefinition(COMPONENTS_VIEW);
    toastBack(removed);
    expect(page().originIds).toContain(origin("Toast"));
    expect(workspace.history.getSnapshot().labels).toEqual(history);
    const revision = graph.revision;
    workspace.showDefinition(undefined);
    workspace.showDefinition(COMPONENTS_VIEW);
    expect(graph.revision).toBe(revision);
    workspace.dispose();
  });

  it("a page stored before the list gives every missing card once, then records them", async () => {
    const { workspace, origin, page, withoutToast, toastBack } = await stored();
    const removed = withoutToast(undefined);
    workspace.showDefinition(COMPONENTS_VIEW);
    toastBack(removed);
    expect(page().originIds).toContain(origin("Toast"));
    workspace.dispose();
  });

  it("a card the user deleted is not given again", async () => {
    const { workspace, graph, page, origin, toastCard } = await stored();
    workspace.showDefinition(COMPONENTS_VIEW);
    workspace.setLibraryUnlocked(true);
    workspace.execute(
      removeTargets({ targets: [{ kind: "node", id: toastCard }] }),
    );
    workspace.setLibraryUnlocked(false);
    expect(graph.storedEntry(toastCard)).toBeUndefined();
    workspace.showDefinition(undefined);
    const revision = graph.revision;
    workspace.showDefinition(COMPONENTS_VIEW);
    expect(graph.storedEntry(toastCard)).toBeUndefined();
    expect(graph.revision).toBe(revision);
    expect(page().originIds).toContain(origin("Toast"));
    workspace.dispose();
  });
});
