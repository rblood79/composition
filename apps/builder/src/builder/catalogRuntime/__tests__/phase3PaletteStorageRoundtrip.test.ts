// @vitest-environment node
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import replay from "../../../../../../docs/adr/design/248-phase3-palette-old-replay.json";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogDocument,
  DefinitionId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { resolveCatalogNode } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { CatalogRuntime } from "../controller";
import {
  exportCatalogFolder,
  exportCatalogJson,
  importCatalogFolder,
  importCatalogJson,
} from "../exchange";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 G4 (independent consumer, Phase 3 evidence): every palette type the G3 harness routes
 * to a code-catalog definition is created as a project node, edited (visual width) with
 * Undo/Redo, saved to IndexedDB, loaded, and exchanged through JSON and folder — the document and
 * its resolved tree are the same after each hop. The G3 harness's routing (reusable origin → typed
 * composite, plain type → its definition) is reused.
 */
it("roundtrips every palette type through IDB, JSON and folder", async () => {
  const library = await buildCodeCatalogLibrary();
  const rows = (replay as { rows: Array<{ type: string; ref: string | null }> })
    .rows;
  const routed: Array<{ type: string; definitionId: DefinitionId }> = [];
  const unrouted: string[] = [];
  for (const row of rows) {
    const candidates = row.ref
      ? [`lib:definition:origin-${row.ref}`]
      : [
          `lib:definition:${row.type.toLowerCase()}`,
          `lib:definition:type-${row.type}`,
        ];
    const id = candidates.find((candidate) =>
      library.definitions.has(candidate as never),
    );
    if (id) routed.push({ type: row.type, definitionId: id as DefinitionId });
    else unrouted.push(row.type);
  }
  expect(unrouted).toEqual([]);
  expect(routed).toHaveLength(64);

  for (const [index, { type, definitionId }] of routed.entries()) {
    const projectId = `project:project:palette-${index}` as const;
    const pageId = "project:page:main" as const;
    const nodeId = "project:node:subject" as const;
    const document: CatalogDocument = {
      format: "composition-catalog",
      schemaVersion: 1,
      libraryContractVersion: 18,
      revision: 0,
      projectId,
      rootId: projectId,
      entries: {
        [projectId]: {
          kind: "project",
          id: projectId,
          name: type,
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
          children: [nodeId],
        },
        [nodeId]: {
          kind: "node",
          id: nodeId,
          definitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      },
    };
    const graph = new CatalogGraph(document, library);
    const storage = new CatalogStorage(indexedDB, `adr248-palette-${type}`);
    await storage.create(graph.exportDocument(), library);
    const runtime = new CatalogRuntime(graph, storage);
    runtime.dispatch("resize", [
      {
        kind: "patchNodeVisual",
        id: nodeId,
        key: "width",
        write: { kind: "set", value: 220 },
      },
    ]);
    runtime.undo();
    runtime.redo();
    await runtime.save();
    const edited = resolveCatalogNode(graph, nodeId);
    expect(edited.visual.width, type).toBe(220);

    const loaded = new CatalogGraph(
      await storage.load(projectId, library),
      library,
    );
    expect(loaded.exportDocument(), type).toEqual(graph.exportDocument());
    expect(resolveCatalogNode(loaded, nodeId), type).toEqual(edited);
    expect(importCatalogJson(exportCatalogJson(loaded), library), type).toEqual(
      loaded.exportDocument(),
    );
    expect(
      await importCatalogFolder(await exportCatalogFolder(loaded), library),
      type,
    ).toEqual(loaded.exportDocument());
    // A composite instance is its template root: the width reaches that root (ADR §3.4).
    const definition = library.definitions.get(definitionId as never);
    const templateRoot =
      definition && "templateRootId" in definition
        ? edited.children.find(
            (child) => child.sourceId === definition.templateRootId,
          )
        : undefined;
    if (templateRoot) expect(templateRoot.visual.width, type).toBe(220);
  }
});
