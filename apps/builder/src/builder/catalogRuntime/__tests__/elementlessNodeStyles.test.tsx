// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { I18nProvider } from "../../../i18n";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { StylesTabBody } from "../../panels/styles/StylesPanel.components";
import { StylesHostContext } from "../../panels/styles/stylesHostContext";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A node RAC renders without an element of its own (MenuTrigger · DialogTrigger · TooltipTrigger ·
 * ContextualHelp · Autocomplete — the catalog rule's root `display: contents`) has no box: a
 * Layout · Style · Text value on it reaches neither the Canvas nor the DOM. The Design panel's
 * style views say so instead of offering fields (a click on a Menu's Button selects its
 * MenuTrigger first — the instance — and its Radius · Border edits looked lost, 2026-10-15). The
 * Button inside keeps its sections, and the edit there lands.
 */
const BODY = "project:node:home-body" as NodeId;

afterEach(cleanup);
(Element.prototype as { getAnimations?: () => Animation[] }).getAnimations ??=
  () => [];

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:elementless" as EntryId<"project">,
        name: "Elementless",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `elementless-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.session.clearSelection();
  workspace.execute(
    catalogPaletteInsertCommand(
      {
        graph: workspace.runtime.graph,
        get records() {
          return workspace.root.domInputs;
        },
        selection: () => workspace.session.getSnapshot().selection,
        itemOfRecord: (identity: string) => workspace.itemOfRecord(identity),
        pageContent: () => ({ kind: "node", id: BODY }),
        newId: workspace.newId,
      },
      "Menu",
    )!,
  );
  const menu = workspace.session.getSnapshot().selection[0]!.identity;
  const root = workspace.root;
  const under = (id: string) => {
    for (
      let parent = root.domInputs.get(root.domInputs.get(id)!.parentId);
      parent;
      parent = root.domInputs.get(parent.parentId)
    )
      if (parent.id === menu) return true;
    return false;
  };
  const button = [...root.domInputs.values()].find(
    (record) => root.typeOf(record) === "Button" && under(record.id),
  )!.id;
  const host = createCatalogStylesHost(workspace);
  render(
    <I18nProvider initialLocale="en-US">
      <CatalogWorkspaceProvider workspace={workspace}>
        <StylesHostContext.Provider value={host}>
          <StylesTabBody view="style" />
        </StylesHostContext.Provider>
      </CatalogWorkspaceProvider>
    </I18nProvider>,
  );
  const select = (id: string) => act(() => workspace.selectRecords([id]));
  return { workspace, menu, button, host, select };
}

describe("a node without an element has no style fields", () => {
  it("MenuTrigger: the style view says it has no box; its Button keeps Border and takes the edit", async () => {
    const { workspace, menu, button, host, select } = await open();
    select(menu);
    expect(workspace.root.typeOf(workspace.root.domInputs.get(menu)!)).toBe(
      "MenuTrigger",
    );
    expect(screen.queryByText("Border")).toBeNull();
    expect(screen.getByText(/MenuTrigger/)).toBeTruthy();

    select(button);
    expect(screen.getByText("Border")).toBeTruthy();
    host.updateStyles({ borderRadius: "12px", borderWidth: "3px" });
    expect(workspace.root.domInputs.get(button)!.visual).toMatchObject({
      radius: 12,
      borderWidth: 3,
    });
  });
});
