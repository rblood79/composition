import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  EntryId,
  NodeEntry,
  NodeId,
  PageEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  createPage,
  createTheme,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogPreviewViewMessage } from "../../../../../../packages/shared/src/catalog/preview/protocol";
import { CatalogPreviewChannel } from "../../../builder/catalogRuntime/previewChannel";
import { NullLayoutEngine } from "../../../builder/catalogRuntime/nullLayoutEngine";
import { newCatalogProjectDocument } from "../../../builder/catalogRuntime/project";
import { CatalogStorage } from "../../../builder/catalogRuntime/storage";
import {
  CATALOG_DEFAULT_THEME_PRESET,
  catalogThemeState,
  type CatalogThemeState,
} from "../../../builder/catalogRuntime/theme";
import { CatalogWorkspace } from "../../../builder/catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../builder/catalogRuntime/__tests__/support/nodeLayoutEngine";
import { installThemeMaps } from "../../../utils/theme/themeMaps";
import { CatalogPreviewView } from "../catalogPreviewApp";
import {
  catalogBoundRows,
  catalogCollectionId,
} from "../../../builder/catalogRuntime/dataBinding";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import type { CollectionDataSource } from "@composition/shared";
import { CatalogPreviewSession } from "../catalogPreviewSession";

/**
 * ADR-248 4e-6 Preview entry: the iframe's session holds a replica of the Builder's document
 * (snapshot, then per-frame deltas), draws the editor's page through the DOM binding from a
 * replica root, follows the editor's page until it navigates on its own, and builds a new root in
 * a new theme when a delta changes it — the Builder workspace's rules, on the Preview side.
 */
const BODY = "project:node:home-body" as NodeId;
const TEXT = "project:node:hello" as NodeId;
const HOME = "project:page:home" as EntryId<"page">;
const ABOUT = "project:page:about" as EntryId<"page">;
const ABOUT_BODY = "project:node:about-body" as NodeId;

afterEach(() => installThemeMaps(null));

let library: CatalogLibrary | undefined;
async function open() {
  library ??= await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:preview" as EntryId<"project">,
        name: "Preview",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e6-preview-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      theme: catalogThemeState,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: TEXT,
          definitionId: "lib:definition:text",
          children: [],
          props: { children: { kind: "set", value: "Hello" } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [TEXT],
      newId: workspace.newId,
    }),
  );
  const themes: CatalogThemeState[] = [];
  const views: CatalogPreviewViewMessage[] = [];
  const flushes: (() => void)[] = [];
  const session: CatalogPreviewSession = new CatalogPreviewSession(library, {
    requestSnapshot: (request) =>
      channel.onPreviewMessage(structuredClone(request)),
    engine: () => new NullLayoutEngine(),
    viewport: { width: 1000, height: 800 },
    theme: catalogThemeState,
    applyTheme: (state) => themes.push(state),
  });
  const channel = new CatalogPreviewChannel(workspace.runtime, {
    post: (message) => {
      if (message.type === "CATALOG_VIEW") views.push(message);
      session.receive(structuredClone(message));
    },
    schedule: (flush) => flushes.push(flush),
  });
  const flush = () => flushes.splice(0).forEach((run) => run());
  const recordOf = (root: { recordsOfSource(id: string): readonly string[] }) =>
    root.recordsOfSource(TEXT)[0]!;
  const textIn = (root: CatalogWorkspace["root"]) =>
    root.domInputs.get(recordOf(root))?.props.children;
  return { workspace, session, channel, flush, themes, views, textIn };
}

describe("ADR-248 4e-6 Preview entry", () => {
  it("the replica draws the editor's page and follows its steps; the page follows the editor until the Preview navigates", async () => {
    const { workspace, session, channel, flush, views, textIn } = await open();
    channel.setPage(HOME);
    expect(session.root).toBeUndefined();
    expect(views).toEqual([]);
    channel.onReady();
    expect(session.pageId).toBe(HOME);
    expect(views.map((view) => view.pageId)).toEqual([HOME]);
    expect(session.pageRecord).toBe(workspace.root.recordsOfSource(BODY)[0]);
    expect(textIn(session.root!)).toBe("Hello");

    const version = session.getVersion();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: TEXT }],
        props: { children: { kind: "set", value: "Hi there" } },
      }),
    );
    expect(textIn(session.root!)).toBe("Hello");
    flush();
    expect(textIn(session.root!)).toBe("Hi there");
    expect(textIn(session.root!)).toBe(textIn(workspace.root));
    expect(session.getVersion()).toBeGreaterThan(version);

    const body: NodeEntry = {
      kind: "node",
      id: ABOUT_BODY,
      definitionId: "lib:definition:type-body",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const page: PageEntry = {
      kind: "page",
      id: ABOUT,
      route: "/about",
      name: "About",
      children: [ABOUT_BODY],
    };
    workspace.execute(createPage({ page, entries: [body] }));
    flush();
    channel.setPage(ABOUT);
    expect(session.pageId).toBe(ABOUT);
    expect(session.pageRecord).toBe(
      workspace.root.recordsOfSource(ABOUT_BODY)[0],
    );
    // The Preview's own navigation holds until the editor switches again.
    session.navigate(HOME);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: TEXT }],
        props: { children: { kind: "set", value: "Again" } },
      }),
    );
    flush();
    expect(session.pageId).toBe(HOME);
    channel.setPage(ABOUT);
    expect(session.pageId).toBe(HOME);
    channel.setPage(HOME);
    channel.setPage(ABOUT);
    expect(session.pageId).toBe(ABOUT);
  });

  it("a theme delta builds a new replica root in the theme's color mode and shows its CSS variables", async () => {
    const { workspace, session, channel, flush, themes } = await open();
    channel.onReady();
    expect(themes).toHaveLength(1);
    expect(themes[0]!.colorMode).toBe("light");
    const before = session.root;
    const button: NodeEntry = {
      kind: "node",
      id: "project:node:button" as NodeId,
      definitionId: "lib:definition:type-Button",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [button],
        rootIds: [button.id],
        newId: workspace.newId,
      }),
    );
    flush();
    expect(session.root).toBe(before);
    expect(themes).toHaveLength(1);
    workspace.execute(
      createTheme({
        theme: {
          kind: "theme",
          id: "project:theme:t1" as EntryId<"theme">,
          name: "Dark",
          tokenIds: [],
          preset: { ...CATALOG_DEFAULT_THEME_PRESET, darkMode: "dark" },
        },
        activate: true,
      }),
    );
    flush();
    expect(session.root).not.toBe(before);
    expect(session.root!.colorMode).toBe("dark");
    expect(themes.map((state) => state.colorMode)).toEqual(["light", "dark"]);
    expect(themes[1]!.snapshot().cssVars.some((cssVar) => cssVar.isDark)).toBe(
      true,
    );
    const fill = (root: CatalogWorkspace["root"]) =>
      root.domInputs.get(root.recordsOfSource(button.id)[0]!)?.visual.fill;
    expect(fill(session.root!)).toBe(fill(workspace.root));
  });

  it("the view renders the page's DOM from the replica root and re-renders on a delta", async () => {
    const { workspace, session, channel, flush } = await open();
    const view = render(<CatalogPreviewView session={session} />);
    expect(view.container.textContent).toContain("Initializing Preview");
    act(() => channel.onReady());
    expect(view.container.textContent).toContain("Hello");
    act(() => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: TEXT }],
          props: { children: { kind: "set", value: "Updated" } },
        }),
      );
      flush();
    });
    expect(view.container.textContent).toContain("Updated");
    expect(view.container.textContent).not.toContain("Hello");
    view.unmount();
  });

  it("bound collections draw the rows of the collections the Builder sends, and follow a change", async () => {
    library ??= await buildCodeCatalogLibrary();
    let collections: CollectionDataSource[] = [
      {
        id: "c1",
        name: "Tags",
        schema: [{ key: "label" }],
        mockData: [{ id: "r1", label: "Alpha" }, { id: "r2", label: "Beta" }],
        useMockData: true,
      },
    ];
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:rows" as EntryId<"project">,
          name: "Rows",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `adr248-4e6-rows-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule: () => {},
        root: { rows: (binding) => catalogBoundRows(binding, collections) },
      },
    );
    const LIST = "project:node:list" as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: LIST,
            definitionId: catalogPaletteDefinitionId(library, "ListBox"),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
            binding: { collectionId: catalogCollectionId("c1"), fieldMap: {} },
          } as NodeEntry,
        ],
        rootIds: [LIST],
        newId: workspace.newId,
      }),
    );
    const session: CatalogPreviewSession = new CatalogPreviewSession(library, {
      requestSnapshot: (request) =>
        channel.onPreviewMessage(structuredClone(request)),
      engine: () => new NullLayoutEngine(),
      viewport: { width: 1000, height: 800 },
    });
    const channel = new CatalogPreviewChannel(workspace.runtime, {
      post: (message) => session.receive(structuredClone(message)),
    });
    const texts = (root: CatalogWorkspace["root"]) => {
      const out: string[] = [];
      const visit = (id: string) => {
        const record = root.domInputs.get(id);
        if (!record) return;
        if (typeof record.props.children === "string")
          out.push(record.props.children);
        record.children.forEach(visit);
      };
      visit(root.recordsOfSource(LIST)[0]!);
      return out;
    };
    const send = () =>
      session.receive(
        structuredClone({
          type: "CATALOG_DATA",
          version: 1,
          collections,
        }),
      );
    channel.onReady();
    // No collections yet: the template's sample items (rows unknown).
    expect(texts(session.root!)).not.toContain("Alpha");
    send();
    expect(texts(session.root!)).toEqual(texts(workspace.root));
    expect(texts(session.root!)).toEqual(
      expect.arrayContaining(["Alpha", "Beta"]),
    );
    collections = [
      { ...collections[0]!, mockData: [{ id: "r3", label: "Gamma" }] },
    ];
    workspace.refreshRows(["c1"]);
    send();
    expect(texts(session.root!)).toEqual(texts(workspace.root));
    expect(texts(session.root!)).toContain("Gamma");
    expect(texts(session.root!)).not.toContain("Alpha");
  });
});
