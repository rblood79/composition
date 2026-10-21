import "fake-indexeddb/auto";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  removeTargets,
} from "../../../../../../packages/shared/src/catalog/commands";
import { I18nProvider } from "../../../i18n";
import { CatalogNavigatorPanel } from "../../panels/navigator/catalog/CatalogNavigatorPanel";
import { catalogComponentCommands } from "../componentActions";
import {
  catalogDefinitionList,
  catalogNavigatorTabOf,
  catalogNewLayoutCommand,
} from "../layouts";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e Navigator tabs (user proposal 2026-10-01): Pages / Components / Layouts — each tab
 * lists its own entries over the Layers of what the Canvas shows; entering a definition edit view
 * selects its tab, leaving it returns to Pages, and the Pages tab leaves the view.
 */
const BODY = "project:node:home-body" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:navtabs" as EntryId<"project">,
        name: "Tabs",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e-navtabs-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: "project:node:title" as NodeId,
          definitionId: "lib:definition:heading",
          children: [],
          props: { children: { kind: "set", value: "T" } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: ["project:node:title" as NodeId],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    catalogComponentCommands.create(
      "project:node:title" as NodeId,
      "Title",
      workspace.newId,
    ),
  );
  workspace.execute(catalogNewLayoutCommand("Shell", workspace.newId));
  const graph = workspace.runtime.graph;
  const [layout, component] = catalogDefinitionList(graph);
  return { workspace, graph, layout: layout!, component: component! };
}

describe("ADR-248 4e Navigator tabs", () => {
  it("lists each kind on its own and maps a definition to its tab", async () => {
    const { graph, layout, component } = await open();
    expect(
      catalogDefinitionList(graph, "component").map((item) => item.name),
    ).toEqual(["Title"]);
    expect(
      catalogDefinitionList(graph, "layout").map((item) => item.name),
    ).toEqual(["Shell"]);
    expect(catalogNavigatorTabOf(graph, component.id)).toBe("components");
    expect(catalogNavigatorTabOf(graph, layout.id)).toBe("layouts");
    expect(catalogNavigatorTabOf(graph, undefined)).toBe(undefined);
  });

  it("the tabs follow the edit view and the Pages tab leaves it", async () => {
    const { workspace, layout, component } = await open();
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogNavigatorPanel />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const tab = (name: string) => screen.getByRole("tab", { name });
    const panel = () => screen.getByRole("tabpanel");
    expect(tab("Pages").getAttribute("aria-selected")).toBe("true");

    // Components: the built-in origins' page and the project's components page (one page for
    // them all — no item per component, user 2026-10-14), no Add layout.
    fireEvent.click(tab("Components"));
    expect(tab("Components").getAttribute("aria-selected")).toBe("true");
    expect(within(panel()).getByText("Library")).toBeTruthy();
    expect(within(panel()).getByText("Local")).toBeTruthy();
    expect(within(panel()).queryByText("Title")).toBeNull();
    expect(within(panel()).queryByText("Shell")).toBeNull();
    expect(within(panel()).queryByLabelText("Add Layout")).toBeNull();
    // Choosing a tab does not leave the page.
    expect(workspace.session.getSnapshot().definitionView).toBe(undefined);

    // Layouts: the layout and Add layout.
    fireEvent.click(tab("Layouts"));
    expect(within(panel()).getByText("Shell")).toBeTruthy();
    expect(within(panel()).queryByText("Title")).toBeNull();
    expect(within(panel()).getByLabelText("Add Layout")).toBeTruthy();

    // An edit view entered elsewhere (Properties "Go to origin") selects its tab.
    act(() => workspace.showDefinition(component.id));
    expect(tab("Components").getAttribute("aria-selected")).toBe("true");
    act(() => workspace.showDefinition(layout.id));
    expect(tab("Layouts").getAttribute("aria-selected")).toBe("true");
    // Leaving the view (Done) returns to Pages.
    act(() => workspace.showDefinition(undefined));
    expect(tab("Pages").getAttribute("aria-selected")).toBe("true");

    // The Pages tab leaves an open view.
    act(() => workspace.showDefinition(component.id));
    fireEvent.click(tab("Pages"));
    expect(workspace.session.getSnapshot().definitionView).toBe(undefined);
    expect(tab("Pages").getAttribute("aria-selected")).toBe("true");
    workspace.dispose();
  });

  it("choosing a page selects its body (Layers row · Canvas page frame)", async () => {
    const { workspace } = await open();
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogNavigatorPanel />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const bodyOf = (pageId: string) => {
      const page = workspace.runtime.graph.getEntry(pageId);
      return page?.kind === "page" ? page.children[0] : undefined;
    };
    const selected = () =>
      workspace.session.getSnapshot().selection.map((item) => item.identity);
    const pages = () => within(screen.getByRole("treegrid", { name: "Pages" }));

    // A new page opens with its body selected.
    fireEvent.click(screen.getByLabelText("Add Page"));
    const added = workspace.session.getSnapshot().pageId!;
    expect(added).not.toBe("project:page:home");
    expect(selected()).toEqual(
      workspace.itemsOfNode(bodyOf(added)!, 1).map((item) => item.identity),
    );

    // Choosing another page in the tree selects that page's body.
    fireEvent.click(pages().getByText("Home"));
    expect(workspace.session.getSnapshot().pageId).toBe("project:page:home");
    expect(selected()).toEqual(
      workspace.itemsOfNode(BODY, 1).map((item) => item.identity),
    );
    expect(selected()).toHaveLength(1);
    workspace.dispose();
  });

  it("opening or adding a layout selects its body", async () => {
    const { workspace, graph, layout } = await open();
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogNavigatorPanel />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const bodyOf = (id: string) => {
      const entry = graph.getEntry(id);
      return entry?.kind === "definition" ? entry.templateRootId : undefined;
    };
    const selected = () =>
      workspace.session.getSnapshot().selection.map((item) => item.identity);
    fireEvent.click(screen.getByRole("tab", { name: "Layouts" }));
    fireEvent.click(within(screen.getByRole("tabpanel")).getByText("Shell"));
    expect(workspace.session.getSnapshot().definitionView).toBe(layout.id);
    expect(selected()).toEqual(
      workspace.itemsOfNode(bodyOf(layout.id)!, 1).map((item) => item.identity),
    );
    expect(selected()).toHaveLength(1);

    fireEvent.click(screen.getByLabelText("Add Layout"));
    const added = workspace.session.getSnapshot().definitionView!;
    expect(added).not.toBe(layout.id);
    expect(selected()).toEqual(
      workspace.itemsOfNode(bodyOf(added)!, 1).map((item) => item.identity),
    );
    workspace.dispose();
  });

  it("Layers lists only what the selected tab is about", async () => {
    const { workspace, component } = await open();
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogNavigatorPanel />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const tab = (name: string) => screen.getByRole("tab", { name });
    const layers = () => within(screen.getByRole("tabpanel"));
    // Pages: the page's layers.
    expect(layers().getByRole("treegrid", { name: "Layers" })).toBeTruthy();
    // Components with nothing opened: no page layers, a hint.
    fireEvent.click(tab("Components"));
    expect(layers().queryByRole("treegrid", { name: "Layers" })).toBeNull();
    expect(
      layers().getByText("Select a component to view elements"),
    ).toBeTruthy();
    fireEvent.click(tab("Layouts"));
    expect(layers().queryByRole("treegrid", { name: "Layers" })).toBeNull();
    expect(layers().getByText("Select a layout to view elements")).toBeTruthy();
    // An opened component: its template's layers on its tab.
    act(() => workspace.showDefinition(component.id));
    expect(layers().getByRole("treegrid", { name: "Layers" })).toBeTruthy();
    workspace.dispose();
  });
});
