import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { updatePage } from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogNewPageCommand,
  catalogPageDropCommand,
  catalogTreePages,
} from "../pageTree";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 Pages: a new page is `Page N` at a free route with an empty body (one step);
 * a Pages tree drop is one step over the page order and parents; selecting a record on another
 * page opens that page (the Layers tree follows the selection).
 */
const PROJECT = "project:project:pages-tree" as EntryId<"project">;
const HOME = "project:page:home" as EntryId<"page">;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Pages" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-pages-tree-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const add = () => {
    const { command, pageId } = catalogNewPageCommand(
      workspace.readModel.pages(),
      workspace.newId,
    );
    workspace.execute(command);
    return pageId;
  };
  const order = () => workspace.readModel.pages().map((page) => page.id);
  const parentOf = (id: EntryId<"page">) =>
    workspace.readModel.pages().find((page) => page.id === id)?.parentId;
  return { workspace, add, order, parentOf };
}

describe("ADR-248 Phase 4e-4 Pages tree", () => {
  it("adds `Page N` with an empty body at a free route; the read model's pages follow", async () => {
    const { workspace, add, order } = await open();
    let notified = 0;
    workspace.readModel.subscribePages(() => notified++);
    const revision = workspace.runtime.graph.revision;
    const second = add();
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    expect(notified).toBe(1);
    const page = workspace.readModel.pages()[1];
    expect(page).toMatchObject({
      id: second,
      name: "Page 2",
      route: "/page-2",
    });
    expect(workspace.runtime.graph.getEntry(page.children[0])).toMatchObject({
      definitionId: "lib:definition:type-body",
      children: [],
    });
    expect(catalogTreePages(workspace.readModel.pages())[1]).toEqual({
      id: second,
      title: "Page 2",
      slug: "/page-2",
      parent_id: null,
    });
    // A taken route moves on to the next free number.
    workspace.execute(updatePage({ id: second, fields: { route: "/page-3" } }));
    add();
    expect(workspace.readModel.pages()[2].route).toBe("/page-4");
    workspace.undo();
    expect(order()).toHaveLength(2);
  });

  it("a drop reorders and re-parents in one step; the home page and no-op drops give nothing", async () => {
    const { workspace, add, order, parentOf } = await open();
    const a = add();
    const b = add();
    const c = add();
    const drop = (
      dragged: EntryId<"page">[],
      target: EntryId<"page">,
      position: "before" | "after" | "on",
    ) =>
      catalogPageDropCommand(
        workspace.readModel.pages(),
        dragged,
        target,
        position,
      );

    const revision = workspace.runtime.graph.revision;
    workspace.execute(drop([c], a, "before")!);
    expect(order()).toEqual([HOME, c, a, b]);
    expect(workspace.runtime.graph.revision).toBe(revision + 1);

    // On a page: its last child (after its other children).
    workspace.execute(drop([b], a, "on")!);
    expect(parentOf(b)).toBe(a);
    workspace.execute(drop([c], a, "on")!);
    expect(parentOf(c)).toBe(a);
    expect(order().indexOf(c)).toBeGreaterThan(order().indexOf(b));

    expect(order()).toEqual([HOME, a, b, c]);

    // A dragged parent carries its children (they keep their parent).
    const d = add();
    workspace.execute(drop([a], d, "after")!);
    expect(order()).toEqual([HOME, d, a, b, c]);
    expect([parentOf(a), parentOf(b), parentOf(c)]).toEqual([undefined, a, a]);

    // Nothing changes: no command.
    expect(drop([a], d, "after")).toBeUndefined();
    // Into its own subtree: refused.
    expect(drop([a], b, "on")).toBeUndefined();
    workspace.undo();
    expect(order()).toEqual([HOME, a, b, c, d]);
  });

  it("selecting a record on another page opens that page", async () => {
    const { workspace, add } = await open();
    const second = add();
    workspace.session.setPage(HOME);
    const body = workspace.readModel.pages().find((page) => page.id === second)!
      .children[0] as NodeId;
    const record = workspace.root.recordsOfSource(body)[0];
    expect(workspace.pageOfRecord(record)).toBe(second);
    workspace.selectRecords([record]);
    expect(workspace.session.getSnapshot()).toMatchObject({
      pageId: second,
      selection: [{ identity: record }],
    });
  });
});
