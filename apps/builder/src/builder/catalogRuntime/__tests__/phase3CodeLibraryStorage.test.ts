// @vitest-environment node
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type { CatalogDocument } from "../../../../../../packages/shared/src/catalog/document/types";
import { resolveCatalogNode } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";
import {
  exportCatalogFolder,
  exportCatalogJson,
  importCatalogFolder,
  importCatalogJson,
} from "../exchange";

it("roundtrips a code-catalog Text edit and a reusable template through IDB, JSON and folder", async () => {
  const library = await buildCodeCatalogLibrary();
  const button = [...library.definitions.values()].find(
    (definition) =>
      definition.name === "Button" && definition.mode === "composite",
  );
  expect(button).toBeDefined();
  const projectId = "project:project:code-storage" as const;
  const pageId = "project:page:main" as const;
  const textId = "project:node:text" as const;
  const buttonId = "project:node:button" as const;
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 7,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "code storage",
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Main",
        route: "/",
        children: [textId, buttonId],
      },
      [textId]: {
        kind: "node",
        id: textId,
        definitionId: "lib:definition:text",
        children: [],
        props: { children: { kind: "set", value: "Before" } },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
      [buttonId]: {
        kind: "node",
        id: buttonId,
        definitionId: button!.id,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
    },
  };
  const graph = new CatalogGraph(document, library);
  const storage = new CatalogStorage(indexedDB, "adr248-code-library-storage");
  await storage.create(graph.exportDocument(), library);
  const runtime = new CatalogRuntime(graph, storage);
  runtime.dispatch("edit Text", [
    {
      kind: "patchNodeProp",
      id: textId,
      key: "children",
      write: { kind: "set", value: "After" },
    },
  ]);
  runtime.undo();
  runtime.redo();
  await runtime.save();

  const loaded = new CatalogGraph(
    await storage.load(projectId, library),
    library,
  );
  expect(loaded.exportDocument()).toEqual(graph.exportDocument());
  expect(resolveCatalogNode(loaded, textId).props.children).toBe("After");
  expect(resolveCatalogNode(loaded, buttonId).children.length).toBeGreaterThan(
    0,
  );
  expect(importCatalogJson(exportCatalogJson(loaded), library)).toEqual(
    loaded.exportDocument(),
  );
  expect(
    await importCatalogFolder(await exportCatalogFolder(loaded), library),
  ).toEqual(loaded.exportDocument());
});
