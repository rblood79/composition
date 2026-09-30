import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  AssetEntry,
  CatalogDocument,
  CatalogLibrary,
  EntryId,
  NodeEntry,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { sha256Hex } from "../../../../../../packages/shared/src/assets/assetBytes";
import { V2AssetMissingError } from "../../../../../../packages/shared/src/assets/formatV2";
import {
  buildCatalogProjectJson,
  catalogProjectContent,
  importCatalogProjectContent,
  readCatalogProjectJson,
} from "../exchange";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 4e-6 project files: a JSON file carries the content and its asset bytes; importing
 * a file into the open project keeps that project's identity (its id replaces the file's), re-points
 * collections the data store matched to other ids, and replaces the stored document one revision
 * past the stored one — a save of the old document then conflicts.
 */
const SOURCE = "project:project:source" as EntryId<"project">;
const TARGET = "project:project:target" as EntryId<"project">;
const BODY = "project:node:home-body";

let library: CatalogLibrary | undefined;
async function sourceProject() {
  library ??= await buildCodeCatalogLibrary();
  const bytes = new TextEncoder().encode("PNG-bytes");
  const hash = await sha256Hex(bytes);
  const ref = `asset:sha256-${hash}`;
  const base = newCatalogProjectDocument({ projectId: SOURCE, name: "Src" });
  const asset: AssetEntry = {
    kind: "asset",
    id: "project:asset:logo" as EntryId<"asset">,
    contentId: ref,
    mediaType: "image/png",
    byteLength: bytes.byteLength,
    filename: "logo.png",
  };
  const list = {
    kind: "node",
    id: "project:node:list",
    definitionId: "lib:definition:text",
    children: [],
    props: { children: { kind: "set", value: "List" } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
    binding: { collectionId: "data:collection:c1", fieldMap: {} },
  } as unknown as NodeEntry;
  const project = base.entries[SOURCE] as ProjectEntry;
  const body = base.entries[BODY] as NodeEntry;
  const document: CatalogDocument = {
    ...base,
    entries: {
      ...base.entries,
      [SOURCE]: {
        ...project,
        assetIds: [asset.id],
      },
      [body.id]: { ...body, children: [list.id] },
      [asset.id]: asset,
      [list.id]: list,
    },
  };
  const graph = new CatalogGraph(document, library);
  return { graph, bytes, hash, ref };
}

describe("ADR-248 Phase 4e-6 project files", () => {
  it("a JSON file carries the content and each referenced asset's bytes; other JSON is refused", async () => {
    const { graph, bytes, hash, ref } = await sourceProject();
    const content = catalogProjectContent(graph, {
      collections: [{ id: "c1", name: "Users" }],
      currentPageId: "project:page:home",
    });
    const text = await buildCatalogProjectJson(content, async (wanted) =>
      wanted === hash ? { bytes, mime: "image/png" } : null,
    );
    const read = await readCatalogProjectJson(text);
    expect(read.content).toEqual(JSON.parse(JSON.stringify(content)));
    expect(
      read.assets.map((asset) => ({ ...asset, bytes: [...asset.bytes] })),
    ).toEqual([{ ref, mime: "image/png", bytes: [...bytes] }]);

    await expect(
      buildCatalogProjectJson(content, async () => null),
    ).rejects.toBeInstanceOf(V2AssetMissingError);
    const corrupt = JSON.parse(text) as { assets: Record<string, string> };
    corrupt.assets[ref] = "data:image/png;base64,AAAA";
    await expect(
      readCatalogProjectJson(JSON.stringify(corrupt)),
    ).rejects.toThrow(`CORRUPT_ASSET:${ref}`);
    // The old app's JSON export (version 1.x, a canonical document).
    await expect(
      readCatalogProjectJson(
        JSON.stringify({
          version: "1.0.0",
          project: { id: "p", name: "Old" },
          document: { pages: [], elements: [] },
        }),
      ),
    ).rejects.toThrow("UNSUPPORTED_PROJECT_FORMAT");
    await expect(readCatalogProjectJson("not json")).rejects.toThrow(
      "UNSUPPORTED_PROJECT_FORMAT",
    );
  });

  it("importing into another project: its identity, re-pointed collections, the stored document replaced", async () => {
    const { graph } = await sourceProject();
    const storage = new CatalogStorage(
      indexedDB,
      `adr248-phase4e-files-${Math.random()}`,
    );
    const base = newCatalogProjectDocument({
      projectId: TARGET,
      name: "Target",
    });
    // An entry only the open project has: the import leaves no trace of it.
    const own = {
      kind: "node",
      id: "project:node:target-only",
      definitionId: "lib:definition:text",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    } as unknown as NodeEntry;
    const targetBody = base.entries[BODY] as NodeEntry;
    const target: CatalogDocument = {
      ...base,
      entries: {
        ...base.entries,
        [BODY]: { ...targetBody, children: [own.id] },
        [own.id]: own,
      },
    };
    await storage.create(target, library!);
    const imported: unknown[] = [];
    const result = await importCatalogProjectContent({
      content: catalogProjectContent(graph, {
        collections: [{ id: "c1", name: "Users" }],
        currentPageId: "project:page:home",
      }),
      projectId: TARGET,
      name: "Target",
      library: library!,
      replace: (document) => storage.replace(document, library!),
      importData: async (extras) => {
        imported.push(extras.collections);
        return new Map([["c1", "c9"]]);
      },
    });
    expect(imported).toEqual([[{ id: "c1", name: "Users" }]]);
    expect(result).toMatchObject({
      pageId: "project:page:home",
      pageMissing: false,
    });
    const stored = await storage.load(TARGET, library!);
    expect(stored.revision).toBe(target.revision + 1);
    expect(stored.projectId).toBe(TARGET);
    expect(stored.rootId).toBe(TARGET);
    const project = stored.entries[TARGET] as ProjectEntry;
    expect(project).toMatchObject({ kind: "project", name: "Target" });
    expect(stored.entries[SOURCE]).toBeUndefined();
    expect(stored.entries["project:node:target-only"]).toBeUndefined();
    expect((stored.entries["project:node:list"] as NodeEntry).binding).toEqual({
      collectionId: "data:collection:c9",
      fieldMap: {},
    });
    expect(stored.entries["project:asset:logo"]).toBeDefined();
    // A save of the document the tab held before the import conflicts.
    await expect(
      storage.commit({
        projectId: TARGET,
        expectedDurableRevision: target.revision,
        revision: target.revision + 1,
        changed: [],
        removedIds: [],
      }),
    ).rejects.toThrow("REVISION_CONFLICT");
    expect((await storage.list()).map((head) => head.name)).toEqual([
      "Target",
    ]);
  });

  it("a current page the document lacks opens the first page; a file of another project's document part is refused before any write", async () => {
    const { graph } = await sourceProject();
    const storage = new CatalogStorage(
      indexedDB,
      `adr248-phase4e-files-${Math.random()}`,
    );
    await storage.create(
      newCatalogProjectDocument({ projectId: TARGET, name: "Target" }),
      library!,
    );
    const result = await importCatalogProjectContent({
      content: catalogProjectContent(graph, {
        currentPageId: "project:page:gone",
      }),
      projectId: TARGET,
      library: library!,
      replace: (document) => storage.replace(document, library!),
      importData: async () => new Map(),
    });
    expect(result).toMatchObject({
      pageId: "project:page:home",
      pageMissing: true,
    });

    let dataWrites = 0;
    const content = catalogProjectContent(graph);
    await expect(
      importCatalogProjectContent({
        content: { ...content, document: { pages: [], elements: [] } },
        projectId: TARGET,
        library: library!,
        replace: (document) => storage.replace(document, library!),
        importData: async () => {
          dataWrites += 1;
          return new Map();
        },
      }),
    ).rejects.toThrow("UNSUPPORTED_PROJECT_FORMAT");
    expect(dataWrites).toBe(0);
    await expect(
      storage.replace(
        newCatalogProjectDocument({
          projectId: "project:project:missing" as EntryId<"project">,
          name: "x",
        }),
        library!,
      ),
    ).rejects.toThrow("PROJECT_NOT_FOUND");
  });
});
