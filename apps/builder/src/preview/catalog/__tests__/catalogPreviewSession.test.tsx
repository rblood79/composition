import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
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
  createComponent,
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
import {
  catalogPreviewLinkClick,
  catalogPreviewRuntime,
  CatalogPreviewView,
} from "../catalogPreviewApp";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../../../builder/catalogRuntime/interactions";
import {
  catalogBoundRows,
  catalogCollectionId,
} from "../../../builder/catalogRuntime/dataBinding";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import type { CollectionDataSource } from "@composition/shared";
import { CatalogPreviewSession } from "../catalogPreviewSession";
import { catalogVariableCommands } from "../../../builder/catalogRuntime/stateVariables";
import { CATALOG_PREVIEW_PAYLOAD_VERSION } from "../../../../../../packages/shared/src/catalog/preview/protocol";

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
    stateStorage: null,
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
    channel.setView(HOME);
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
    channel.setView(ABOUT);
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
    channel.setView(ABOUT);
    expect(session.pageId).toBe(HOME);
    channel.setView(HOME);
    channel.setView(ABOUT);
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
        mockData: [
          { id: "r1", label: "Alpha" },
          { id: "r2", label: "Beta" },
        ],
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
        root: {
          rows: (binding, kind) => catalogBoundRows(binding, collections, kind),
        },
      },
    );
    const LIST = "project:node:list" as NodeId;
    const CHART = "project:node:chart" as NodeId;
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
          {
            kind: "node",
            id: CHART,
            definitionId: catalogPaletteDefinitionId(library, "Chart"),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
            binding: { collectionId: catalogCollectionId("c1"), fieldMap: {} },
          } as NodeEntry,
        ],
        rootIds: [LIST, CHART],
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
    // A bound Chart's data = the collection's records (the Preview root asks for them too).
    const chartData = (root: CatalogWorkspace["root"]) =>
      [...root.domInputs.values()].find((record) => record.ruleId === "Chart")
        ?.props.data;
    expect(chartData(session.root!)).toEqual(collections[0]!.mockData);
    expect(chartData(session.root!)).toEqual(chartData(workspace.root));
    collections = [
      { ...collections[0]!, mockData: [{ id: "r3", label: "Gamma" }] },
    ];
    workspace.refreshRows(["c1"]);
    send();
    expect(texts(session.root!)).toEqual(texts(workspace.root));
    expect(texts(session.root!)).toContain("Gamma");
    expect(texts(session.root!)).not.toContain("Alpha");
  });

  it("rules run in the Preview: toast, navigate by route, capability overrides; a rule added later attaches; links move by route", async () => {
    const { workspace, session, channel, flush } = await open();
    const FRAME = "project:node:panel" as NodeId;
    const BUTTON = "project:node:go" as NodeId;
    const node = (id: NodeId, definitionId: string, props = {}) =>
      ({
        kind: "node",
        id,
        definitionId,
        children: [],
        props,
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }) as NodeEntry;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node(BUTTON, "lib:definition:type-Button", {
            children: { kind: "set", value: "Go" },
          }),
          node(FRAME, "lib:definition:type-frame"),
        ],
        rootIds: [BUTTON, FRAME],
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      createPage({
        page: {
          kind: "page",
          id: ABOUT,
          route: "/about",
          name: "About",
          children: [ABOUT_BODY],
        },
        entries: [node(ABOUT_BODY, "lib:definition:type-body")],
      }),
    );
    const owner = { ownerId: BUTTON };
    workspace.execute(
      catalogInteractionsCommand(
        owner,
        [
          catalogNewInteraction(
            owner,
            "onPress",
            { opcode: "toast", message: "Hi" },
            workspace.newId,
          ),
          catalogNewInteraction(
            owner,
            "onPress",
            { opcode: "capability", targetId: FRAME, capabilityId: "toggle" },
            workspace.newId,
          ),
        ],
        "Rules",
      ),
    );
    const toasts: string[] = [];
    const runtime = catalogPreviewRuntime(session, {
      show: (message) => toasts.push(message),
    });
    const view = render(
      <CatalogPreviewView session={session} runtime={runtime} />,
    );
    act(() => channel.onReady());
    const button = () => view.getByRole("button", { name: "Go" });
    const hidden = () =>
      view.container.querySelector('[style*="display: none"]');
    const frameShown = () => {
      const record = session.root!.recordsOfSource(FRAME)[0]!;
      return runtime.overrideOf(record)?.style;
    };
    act(() => {
      fireEvent.click(button());
    });
    expect(toasts).toEqual(["Hi"]);
    expect(frameShown()).toEqual({ display: "none" });
    expect(hidden()).not.toBeNull();
    act(() => {
      fireEvent.click(button());
    });
    expect(toasts).toEqual(["Hi", "Hi"]);
    expect(frameShown()).toEqual({});
    expect(hidden()).toBeNull();
    // The document and the Builder never see the runtime override.
    expect(workspace.runtime.historyLabels.undo.at(-1)).toBe("Rules");

    // A rule added on its own (the Button's record does not change) attaches.
    act(() => {
      workspace.execute(
        catalogInteractionsCommand(
          owner,
          [
            ...(Object.values(
              workspace.runtime.graph.exportDocument().entries,
            ).filter(
              (entry) =>
                entry.kind === "interaction" && entry.ownerId === BUTTON,
            ) as ReturnType<typeof catalogNewInteraction>[]),
            catalogNewInteraction(
              owner,
              "onPress",
              { opcode: "navigate", pageId: ABOUT },
              workspace.newId,
            ),
          ],
          "Navigate",
        ),
      );
      flush();
    });
    act(() => {
      fireEvent.click(button());
    });
    expect(session.pageId).toBe(ABOUT);
    expect(toasts).toHaveLength(3);

    // Only a rule's action changes (the owner's record does not): the click runs the new action.
    act(() => session.navigate(HOME));
    const rules = () =>
      Object.values(workspace.runtime.graph.exportDocument().entries).filter(
        (entry) => entry.kind === "interaction" && entry.ownerId === BUTTON,
      ) as ReturnType<typeof catalogNewInteraction>[];
    act(() => {
      workspace.execute(
        catalogInteractionsCommand(
          owner,
          rules().map((rule) =>
            rule.action.opcode === "toast"
              ? { ...rule, action: { opcode: "toast", message: "Bye" } }
              : rule,
          ),
          "Edit",
        ),
      );
      flush();
    });
    act(() => {
      fireEvent.click(button());
    });
    expect(toasts.at(-1)).toBe("Bye");

    // An internal link moves the Preview by route; `#anchor` keeps the browser's behavior.
    const click = catalogPreviewLinkClick(session);
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "/");
    document.body.appendChild(anchor);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: anchor });
    act(() => click(event));
    expect(event.defaultPrevented).toBe(true);
    expect(session.pageId).toBe(HOME);
    anchor.setAttribute("href", "#top");
    const hash = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(hash, "target", { value: anchor });
    click(hash);
    expect(hash.defaultPrevented).toBe(false);
    anchor.remove();
    runtime.dispose();
    view.unmount();
  });

  it("state: `{{ }}` shows runtime values; setState writes element (per owner record), page (reset on entry) and project variables", async () => {
    const { workspace, session, channel, flush } = await open();
    const node = (
      id: string,
      definitionId: string,
      props: Record<string, unknown> = {},
      children: string[] = [],
    ) =>
      ({
        kind: "node",
        id,
        definitionId,
        children,
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set", value },
          ]),
        ),
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }) as NodeEntry;
    const card = (name: string) => [
      node(`project:node:${name}`, "lib:definition:type-frame", {}, [
        `project:node:${name}-add`,
        `project:node:${name}-n`,
      ]),
      node(`project:node:${name}-add`, "lib:definition:type-Button", {
        children: `Add ${name}`,
      }),
      node(`project:node:${name}-n`, "lib:definition:text", {
        children: `${name}={{ n }}`,
      }),
    ];
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          ...card("a"),
          ...card("b"),
          node("project:node:total", "lib:definition:text", {
            children: "total={{ total }} user={{ user }}",
          }),
        ],
        rootIds: [
          "project:node:a",
          "project:node:b",
          "project:node:total",
        ] as NodeId[],
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      createPage({
        page: {
          kind: "page",
          id: ABOUT,
          route: "/about",
          name: "About",
          children: [ABOUT_BODY],
        },
        entries: [node(ABOUT_BODY, "lib:definition:type-body")],
      }),
    );
    const graph = workspace.runtime.graph;
    const variableOf = (ownerId: string) => {
      for (const id of graph.referrersOf(ownerId)) {
        const entry = graph.getEntry(id);
        if (entry?.kind === "stateVariable") return entry;
      }
      throw new Error(ownerId);
    };
    for (const [ownerId, name] of [
      ["project:node:a", "n"],
      ["project:node:b", "n"],
      [HOME, "total"],
    ] as const) {
      workspace.execute(
        catalogVariableCommands.add(ownerId as NodeId, name, workspace.newId),
      );
      workspace.execute(
        catalogVariableCommands.setType(variableOf(ownerId), "number"),
      );
    }
    for (const name of ["a", "b"]) {
      const owner = { ownerId: `project:node:${name}-add` as NodeId };
      workspace.execute(
        catalogInteractionsCommand(
          owner,
          [
            catalogNewInteraction(
              owner,
              "onPress",
              {
                opcode: "setState",
                variableId: variableOf(`project:node:${name}`).id,
                op: "increment",
              },
              workspace.newId,
            ),
            catalogNewInteraction(
              owner,
              "onPress",
              {
                opcode: "setState",
                variableId: variableOf(HOME).id,
                op: "increment",
              },
              workspace.newId,
            ),
            catalogNewInteraction(
              owner,
              "onPress",
              {
                opcode: "setState",
                variableId: "data:variable:v-user",
                op: "set",
                value: name,
              },
              workspace.newId,
            ),
          ],
          "Rules",
        ),
      );
    }
    const runtime = catalogPreviewRuntime(session, { show: () => {} });
    const view = render(
      <CatalogPreviewView session={session} runtime={runtime} />,
    );
    act(() => channel.onReady());
    act(() => {
      session.receive({
        type: "CATALOG_DATA",
        version: CATALOG_PREVIEW_PAYLOAD_VERSION,
        collections: [],
        variables: [
          { id: "v-user", name: "user", type: "string", defaultValue: "Ann" },
        ],
      });
    });
    const text = () => view.container.textContent ?? "";
    expect(text()).toContain("a=0");
    expect(text()).toContain("b=0");
    expect(text()).toContain("total=0 user=Ann");
    const press = (name: string) =>
      act(() => {
        fireEvent.click(view.getByRole("button", { name: `Add ${name}` }));
      });
    press("a");
    press("a");
    press("b");
    expect(text()).toContain("a=2");
    expect(text()).toContain("b=1");
    expect(text()).toContain("total=3 user=b");
    // The Builder's Canvas shows the defaults; the document never holds a value.
    expect(
      workspace.root.domInputs.get(
        workspace.root.recordsOfSource("project:node:a-n")[0]!,
      )?.props.children,
    ).toBe("a=0");
    // Entering a page starts its variables over; element values stay.
    act(() => session.navigate(ABOUT));
    act(() => session.navigate(HOME));
    expect(text()).toContain("total=0 user=b");
    expect(text()).toContain("a=2");
    // A delta that edits the text keeps the runtime value.
    act(() => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: "project:node:a-n" as NodeId }],
          props: { children: { kind: "set", value: "A is {{ n }}" } },
        }),
      );
      flush();
    });
    expect(text()).toContain("A is 2");
    // Two instances of a component whose root owns the variable keep their own values.
    act(() => {
      workspace.execute(
        createComponent({
          id: "project:node:a" as NodeId,
          name: "Counter",
          newId: workspace.newId,
        }),
      );
      const project = graph.getEntry(graph.projectId);
      const definitionId =
        project?.kind === "project" ? project.definitionIds.at(-1)! : "";
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [node("project:node:second", definitionId)],
          rootIds: ["project:node:second" as NodeId],
          newId: workspace.newId,
        }),
      );
      flush();
    });
    const counters = () =>
      [...view.container.querySelectorAll("*")]
        .filter((element) => element.children.length === 0)
        .map((element) => element.textContent)
        .filter((value) => value?.startsWith("A is"));
    expect(counters()).toEqual(["A is 0", "A is 0"]);
    const [, second] = view.getAllByRole("button", { name: "Add a" });
    act(() => {
      fireEvent.click(second!);
    });
    act(() => {
      fireEvent.click(second!);
    });
    expect(counters()).toEqual(["A is 0", "A is 2"]);
    // A variable and a rule added after the snapshot: the delta brings the definition.
    act(() => {
      workspace.execute(
        catalogVariableCommands.add(HOME, "late", workspace.newId),
      );
      const late = [...graph.referrersOf(HOME)]
        .map((id) => graph.getEntry(id))
        .find(
          (entry) => entry?.kind === "stateVariable" && entry.name === "late",
        );
      const owner = { ownerId: "project:node:b-add" as NodeId };
      workspace.execute(
        catalogInteractionsCommand(
          owner,
          [
            catalogNewInteraction(
              owner,
              "onPress",
              {
                opcode: "setState",
                variableId: late!.id as never,
                op: "set",
                value: "yes",
              },
              workspace.newId,
            ),
          ],
          "Late",
        ),
      );
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: "project:node:total" as NodeId }],
          props: { children: { kind: "set", value: "late={{ late }}" } },
        }),
      );
      flush();
    });
    press("b");
    expect(text()).toContain("late=yes");
    runtime.dispose();
    view.unmount();
  });

  // The old compare-mode Preview took the breakpoint's width and applied the responsive overrides
  // through `@media`; the catalog Preview resolves the layers at the editor's breakpoint (view).
  it("follows the editor's breakpoint: the tablet layer shows only at tablet", async () => {
    const { workspace, session, channel, flush, views } = await open();
    channel.setView(HOME);
    channel.onReady();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: TEXT }],
        breakpoint: "tablet",
        visual: { fontSize: { kind: "set", value: 40 } },
      }),
    );
    flush();
    const fontSize = () =>
      session.root!.domInputs.get(session.root!.recordsOfSource(TEXT)[0]!)
        ?.visual.fontSize;
    const atDesktop = fontSize();
    expect(atDesktop).not.toBe(40);
    const version = session.getVersion();
    channel.setView(HOME, "tablet");
    expect(views.at(-1)).toMatchObject({ pageId: HOME, breakpoint: "tablet" });
    expect(session.getVersion()).toBeGreaterThan(version);
    expect(fontSize()).toBe(40);
    // A later step at tablet still applies to the tablet root.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: TEXT }],
        props: { children: { kind: "set", value: "Tablet" } },
      }),
    );
    flush();
    expect(
      session.root!.domInputs.get(session.root!.recordsOfSource(TEXT)[0]!)
        ?.props.children,
    ).toBe("Tablet");
    channel.setView(HOME, "desktop");
    expect(fontSize()).toBe(atDesktop);
  });
});
