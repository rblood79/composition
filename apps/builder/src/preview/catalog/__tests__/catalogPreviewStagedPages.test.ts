import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  createPage,
  insertNodes,
  removePage,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CATALOG_PREVIEW_PAYLOAD_VERSION } from "../../../../../../packages/shared/src/catalog/preview/protocol";
import { CatalogPreviewChannel } from "../../../builder/catalogRuntime/previewChannel";
import { NullLayoutEngine } from "../../../builder/catalogRuntime/nullLayoutEngine";
import { newCatalogProjectDocument } from "../../../builder/catalogRuntime/project";
import { CatalogStorage } from "../../../builder/catalogRuntime/storage";
import { CatalogWorkspace } from "../../../builder/catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../builder/catalogRuntime/__tests__/support/nodeLayoutEngine";
import { CatalogPreviewSession } from "../catalogPreviewSession";

/**
 * ADR-307 후속 (F10) — the Preview · Publish session builds the shown page in full and every other
 * page as a shell (its root record, no children): one route is shown. A page is filled when it is
 * shown (the Builder's page, the Preview's own navigation, the page left when the shown one goes);
 * the deltas of a page still a shell are taken as the Builder's staged root takes them.
 */
const HOME = "project:page:home" as EntryId<"page">;
const HOME_BODY = "project:node:home-body" as NodeId;
const page = (name: string) => `project:page:${name}` as EntryId<"page">;
const node = (name: string) => `project:node:${name}` as NodeId;
const text = (name: string, value: string): NodeEntry =>
  ({
    kind: "node",
    id: node(name),
    definitionId: "lib:definition:text",
    children: [],
    props: { children: { kind: "set", value } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

let library: CatalogLibrary | undefined;
async function open() {
  library ??= await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:preview-staged" as EntryId<"project">,
        name: "Preview staged",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr307-preview-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: HOME_BODY },
      entries: [text("home-text", "Home")],
      rootIds: [node("home-text")],
      newId: workspace.newId,
    }),
  );
  for (const name of ["about", "contact"]) {
    workspace.execute(
      createPage({
        page: {
          kind: "page",
          id: page(name),
          route: `/${name}`,
          name,
          children: [node(`${name}-body`)],
        },
        entries: [
          {
            kind: "node",
            id: node(`${name}-body`),
            definitionId: "lib:definition:type-body",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
      }),
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: node(`${name}-body`) },
        entries: [text(`${name}-text`, name)],
        rootIds: [node(`${name}-text`)],
        newId: workspace.newId,
      }),
    );
  }
  const flushes: (() => void)[] = [];
  const session: CatalogPreviewSession = new CatalogPreviewSession(library, {
    requestSnapshot: (request) =>
      channel.onPreviewMessage(structuredClone(request)),
    engine: () => new NullLayoutEngine(),
    viewport: { width: 1000, height: 800 },
    stateStorage: null,
  });
  const channel = new CatalogPreviewChannel(workspace.runtime, {
    post: (message) => session.receive(structuredClone(message)),
    schedule: (flush) => flushes.push(flush),
  });
  const flush = () => flushes.splice(0).forEach((run) => run());
  /** The Preview's text of a page's Text (undefined = not built: the page is a shell). */
  const textOf = (name: string) => {
    const root = session.root!;
    const [record] = root.recordsOfSource(node(`${name}-text`));
    return record ? root.domInputs.get(record)?.props.children : undefined;
  };
  return { workspace, session, channel, flush, textOf };
}

describe("ADR-307 후속 — the Preview builds the shown page only", () => {
  it("the shown page is built; the others are shells until shown (the editor's page, the Preview's navigation)", async () => {
    const { session, channel, textOf } = await open();
    channel.setView(HOME);
    channel.onReady();
    expect(textOf("home")).toBe("Home");
    expect(textOf("about")).toBeUndefined();
    expect(textOf("contact")).toBeUndefined();
    // (A shell keeps its root record — the page's body.)
    expect(session.root!.recordsOfSource(node("about-body")).length).toBe(1);

    // The editor's page.
    channel.setView(page("about"));
    expect(session.pageRecord).toBe(
      session.root!.recordsOfSource(node("about-body"))[0],
    );
    expect(textOf("about")).toBe("about");
    expect(textOf("contact")).toBeUndefined();
    // The Preview's own navigation (a link, a navigate rule).
    expect(session.navigateTo("/contact")).toBe(true);
    expect(textOf("contact")).toBe("contact");
  });

  it("a delta on a shell page shows when the page is shown; the page left when the shown one goes is filled", async () => {
    const { workspace, session, channel, flush, textOf } = await open();
    channel.setView(page("about"));
    channel.onReady();
    expect(textOf("contact")).toBeUndefined();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: node("contact-text") }],
        props: { children: { kind: "set", value: "Edited" } },
      }),
    );
    flush();
    expect(textOf("contact")).toBeUndefined();
    session.navigate(page("contact"));
    expect(textOf("contact")).toBe("Edited");

    // The shown page goes: the Preview shows the project's first page — filled.
    expect(textOf("home")).toBeUndefined();
    workspace.execute(removePage({ id: page("contact") }));
    flush();
    expect(session.pageId).toBe(HOME);
    expect(textOf("home")).toBe("Home");
  });

  it("a breakpoint switch (a new root) builds the shown page", async () => {
    const { session, channel, textOf } = await open();
    channel.setView(HOME);
    channel.onReady();
    session.navigate(page("about"));
    const before = session.root;
    session.receive({
      type: "CATALOG_VIEW",
      version: CATALOG_PREVIEW_PAYLOAD_VERSION,
      pageId: page("about"),
      breakpoint: "tablet",
    });
    expect(session.root).not.toBe(before);
    expect(textOf("about")).toBe("about");
    expect(textOf("home")).toBeUndefined();
  });
});
