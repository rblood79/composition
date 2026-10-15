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

describe("an instance part's breakpoint and layout edits reach its record", () => {
  /**
   * The Menu's Button position is itself a Button origin instance: what the position resolves goes
   * on to the Button's template root (the record). Its breakpoint layers' visual keys and its own
   * layout were not passed on — a Mobile border edit and a margin were lost (2026-10-15 사용자
   * 「MenuTrigger 내의 Button 의 border width, style, color 여전히 변경안된다」 — the toolbar was on
   * Mobile).
   */
  it("Menu's Button at mobile: border width · style · color reach the record", async () => {
    const { workspace, button, host, select } = await open();
    select(button);
    workspace.setBreakpoint("mobile");
    host.updateStyles({
      borderWidth: "3px",
      borderStyle: "dashed",
      borderColor: "#ff0000",
    });
    expect(workspace.root.domInputs.get(button)!.visual).toMatchObject({
      borderWidth: 3,
      borderStyle: "dashed",
      borderColor: "#ff0000",
    });
    // (Desktop keeps the base value.)
    workspace.setBreakpoint("desktop");
    expect(workspace.root.domInputs.get(button)!.visual.borderWidth).toBe(1);
  });

  it("Menu's Button: a margin (layout) reaches the record, at desktop and at tablet", async () => {
    const { workspace, button, host, select } = await open();
    select(button);
    host.updateStyles({ marginTop: "10px" });
    expect(workspace.root.domInputs.get(button)!.layout).toMatchObject({
      marginTop: "10px",
    });
    workspace.setBreakpoint("tablet");
    host.updateStyles({ marginTop: "20px" });
    expect(workspace.root.domInputs.get(button)!.layout).toMatchObject({
      marginTop: "20px",
    });
  });
});
