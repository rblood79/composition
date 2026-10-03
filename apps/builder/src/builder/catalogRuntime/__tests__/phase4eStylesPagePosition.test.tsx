import "fake-indexeddb/auto";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { catalogNewPageCommand } from "../pageTree";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e: Styles' Position row on a page body edits the page's place on the page canvas
 * (the old row read the old store's page positions — empty in the catalog Builder). Home is the
 * flow origin: shown, not editable.
 */
describe("ADR-248 Phase 4e Styles page body X / Y", () => {
  it("shows a page body's frame position, refuses Home and moves another page as one step", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:pagexy" as EntryId<"project">,
          name: "Page XY",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-page-xy-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    const graph = () => workspace.runtime.graph;
    const project = () => {
      const entry = graph().getEntry(graph().projectId);
      if (entry?.kind !== "project") throw new Error("project");
      return entry;
    };
    const { command, pageId } = catalogNewPageCommand(
      project().pageIds.map((id) => graph().getEntry(id)) as never,
      workspace.newId,
    );
    workspace.execute(command);
    const bodySourceOf = (page: EntryId<"page">): NodeId => {
      const entry = graph().getEntry(page);
      if (entry?.kind !== "page") throw new Error("page");
      return entry.children[0];
    };
    const bodyOf = (page: EntryId<"page">) =>
      workspace.root.recordsOfSource(bodySourceOf(page))[0];
    const host = createCatalogStylesHost(workspace);
    const home = project().pageIds[0];
    const homeView = renderHook(() =>
      host.pagePosition!.usePosition(bodyOf(home)),
    );
    expect(homeView.result.current).toMatchObject({
      pageId: home,
      editable: false,
    });
    const rect = workspace.root.pageFrameRects().get(pageId)!;
    const view = renderHook(() =>
      host.pagePosition!.usePosition(bodyOf(pageId)),
    );
    expect(view.result.current).toEqual({
      pageId,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      editable: true,
    });
    // An element inside a page is not a page body: no row.
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: bodySourceOf(home) },
        entries: [
          {
            kind: "node",
            id: "project:node:child" as NodeId,
            definitionId: "lib:definition:type-frame" as never,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: ["project:node:child" as NodeId],
        newId: workspace.newId,
      }),
    );
    const child = workspace.root.recordsOfSource("project:node:child")[0];
    expect(
      renderHook(() => host.pagePosition!.usePosition(child)).result.current,
    ).toBeNull();
    const steps = workspace.history.getSnapshot().applied;
    act(() => host.pagePosition!.commit(pageId, { x: 5000, y: 300 }));
    expect(workspace.history.getSnapshot()).toMatchObject({
      applied: steps + 1,
      labels: expect.arrayContaining(["Move page"]),
    });
    expect(view.result.current).toMatchObject({ x: 5000, y: 300 });
  });
});
