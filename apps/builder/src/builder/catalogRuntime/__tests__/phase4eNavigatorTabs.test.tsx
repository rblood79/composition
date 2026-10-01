import "fake-indexeddb/auto";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
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

    // Components: the component only, no Add layout.
    fireEvent.click(tab("Components"));
    expect(tab("Components").getAttribute("aria-selected")).toBe("true");
    expect(within(panel()).getByText("Title")).toBeTruthy();
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
