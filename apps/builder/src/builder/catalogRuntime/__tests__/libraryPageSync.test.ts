/**
 * User 2026-10-31 「toast 컴퍼넌트 origin 이 library 에 없다」 — the Library page is stored the first
 * time it opens (ADR-282 Phase 3), so an origin that joined the palette later (Toast — 295 후속 C9)
 * never got a card there. The stored Library page now follows the built-in origins as the Local
 * page follows the project's components: a missing origin's card is added on open, in palette
 * order, with no history entry; the user's other content stays.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogOperation } from "../../../../../../packages/shared/src/catalog/transactions/transaction";
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

async function open() {
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
  const origin = (type: string) =>
    catalogPaletteDefinitionId(library, type) as LibraryDefinitionId;
  return { workspace, graph: workspace.runtime.graph, origin };
}

describe("stored Library page follows the built-in origins", () => {
  it("a page stored before Toast joined gets its card on open — after InlineAlert's, no history", async () => {
    const { workspace, graph, origin } = await open();
    workspace.showDefinition(COMPONENTS_VIEW);
    const toastCard = componentPageNodeId(originCardId(origin("Toast")));
    const alertCard = componentPageNodeId(originCardId(origin("InlineAlert")));
    const body = () => {
      const entry = graph.storedEntry(ORIGIN_VIEW_NODE);
      return entry?.kind === "node" ? entry.children : [];
    };
    expect(body()[body().indexOf(alertCard) + 1]).toBe(toastCard);
    // A page stored without the Toast card (as before 295 후속 C9).
    const subtree = (id: string): string[] => {
      const entry = graph.storedEntry(id);
      return entry?.kind === "node"
        ? [id, ...entry.children.flatMap(subtree)]
        : [id];
    };
    const removed = subtree(toastCard);
    const root = graph.storedEntry(ORIGIN_VIEW_NODE)!;
    workspace.showDefinition(undefined);
    workspace.runtime.load("Old page", [
      ...removed.map((id): CatalogOperation => ({
        kind: "remove",
        id: id as NodeId,
      })),
      {
        kind: "put",
        entry: {
          ...root,
          children: body().filter((id) => id !== toastCard),
        } as never,
      },
    ]);
    expect(graph.storedEntry(toastCard)).toBeUndefined();
    const historyBefore = workspace.history.getSnapshot().labels;
    workspace.showDefinition(COMPONENTS_VIEW);
    expect(body()[body().indexOf(alertCard) + 1]).toBe(toastCard);
    // The same card as a fresh page stores: every node back, the ◆ holder pointing at the origin.
    expect(subtree(toastCard).sort()).toEqual(removed.sort());
    expect(
      subtree(toastCard).some((id) => {
        const entry = graph.storedEntry(id);
        return entry?.kind === "node" && entry.originOf === origin("Toast");
      }),
    ).toBe(true);
    expect(workspace.history.getSnapshot().labels).toEqual(historyBefore);
    // Nothing left to add: opening again takes no step.
    const revision = graph.revision;
    workspace.showDefinition(undefined);
    workspace.showDefinition(COMPONENTS_VIEW);
    expect(graph.revision).toBe(revision);
    workspace.dispose();
  });
});
