import "fake-indexeddb/auto";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

it("keeps a MenuSection hidden at rest but renders its items when the Preview menu opens", async () => {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:menu-section",
        name: "Menu section",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `menu-section-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  // ADR-256 후속 4: the reference's `MenuTrigger > Button + Popover > Menu` (the Menu node is
  // RAC's list; its trigger the Button node).
  const blank = {
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  const host: NodeEntry = {
    kind: "node",
    id: "project:node:trigger",
    definitionId: "lib:definition:type-MenuTrigger",
    children: ["project:node:button", "project:node:popover"],
    ...blank,
  };
  const button: NodeEntry = {
    kind: "node",
    id: "project:node:button",
    definitionId: "lib:definition:origin-component-button",
    children: [],
    ...blank,
    props: { children: { kind: "set", value: "Menu" } },
  };
  const popover: NodeEntry = {
    kind: "node",
    id: "project:node:popover",
    definitionId: "lib:definition:type-Popover",
    children: ["project:node:menu"],
    ...blank,
  };
  const menu: NodeEntry = {
    kind: "node",
    id: "project:node:menu",
    definitionId: "lib:definition:type-Menu",
    children: ["project:node:section"],
    ...blank,
  };
  const section: NodeEntry = {
    kind: "node",
    id: "project:node:section",
    definitionId: "lib:definition:origin-component-menu-section",
    children: [],
    ...blank,
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [host, button, popover, menu, section],
      rootIds: [host.id],
      newId: workspace.newId,
    }),
  );
  const record = workspace.root.recordsOfSource(host.id)[0]!;
  const popoverRecord = workspace.root.recordsOfSource(popover.id)[0]!;
  expect(workspace.root.canvasInputs.get(popoverRecord)?.hidden).toBe(true);
  // (The section rests in the hidden Popover — not drawn.)
  const view = render(renderCatalogDom(workspace.root, record));
  try {
    expect(screen.queryByRole("menuitem")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await waitFor(() =>
      expect(
        screen.getAllByRole("menuitem").map((item) => item.textContent),
      ).toEqual(["Item 1", "Item 2"]),
    );
    expect(screen.getByRole("menu").textContent).toContain("Section");
    fireEvent.keyDown(screen.getByRole("menu"), {
      key: "Escape",
      code: "Escape",
    });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(workspace.root.canvasInputs.get(popoverRecord)?.hidden).toBe(true);
  } finally {
    view.unmount();
    act(() => workspace.dispose());
  }
});
