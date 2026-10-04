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
  const host: NodeEntry = {
    kind: "node",
    id: "project:node:menu",
    definitionId: "lib:definition:type-Menu",
    children: ["project:node:section"],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  const section: NodeEntry = {
    ...host,
    id: "project:node:section",
    definitionId: "lib:definition:origin-component-menu-section",
    children: [],
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [host, section],
      rootIds: [host.id],
      newId: workspace.newId,
    }),
  );
  const record = workspace.root.recordsOfSource(host.id)[0]!;
  expect(workspace.root.canvasInputs.get(record)?.props.variant).toBe(
    "primary",
  );
  const sectionRecord = workspace.root.recordsOfSource(section.id)[0]!;
  expect(workspace.root.canvasInputs.get(sectionRecord)?.hidden).toBe(true);
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
    expect(workspace.root.canvasInputs.get(sectionRecord)?.hidden).toBe(true);
  } finally {
    view.unmount();
    act(() => workspace.dispose());
  }
});
