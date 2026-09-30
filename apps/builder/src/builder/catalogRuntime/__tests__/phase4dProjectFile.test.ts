import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  AssetEntry,
  CatalogLibrary,
  EntryId,
  NodeEntry,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  buildV2Generation,
  encodeManifest,
  openV2Zip,
  readV2Generation,
  V2AssetMissingError,
  type V2Source,
} from "../../../../../../packages/shared/src/assets/formatV2";
import { sha256Hex } from "../../../../../../packages/shared/src/assets/assetBytes";
import { catalogProjectContent, readCatalogProjectContent } from "../exchange";
import { newCatalogProjectDocument } from "../project";

/**
 * ADR-248 Phase 4d project file: the ADR-235 v2 container carries the catalog document as its
 * document part, with the data store parts, fonts and every referenced asset's bytes. A new
 * project roundtrips; an old project file (the old app's real export) opens as a container but
 * its document part fails with UNSUPPORTED_PROJECT_FORMAT.
 */
const PROJECT = "project:project:files" as EntryId<"project">;
const HOME = "project:page:home" as EntryId<"page">;

let library: CatalogLibrary | undefined;
async function projectWithImage() {
  library ??= await buildCodeCatalogLibrary();
  const bytes = new TextEncoder().encode("PNG-bytes");
  const hash = await sha256Hex(bytes);
  const ref = `asset:sha256-${hash}`;
  const base = newCatalogProjectDocument({ projectId: PROJECT, name: "Files" });
  const asset: AssetEntry = {
    kind: "asset",
    id: "project:asset:logo" as EntryId<"asset">,
    contentId: ref,
    mediaType: "image/png",
    byteLength: bytes.byteLength,
    filename: "logo.png",
  };
  const image = {
    kind: "node",
    id: "project:node:logo",
    definitionId: "lib:definition:text",
    children: [],
    props: { children: { kind: "set", value: "Logo" } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  } as NodeEntry;
  const project = base.entries[PROJECT] as ProjectEntry;
  const body = base.entries["project:node:home-body"] as NodeEntry;
  const graph = new CatalogGraph(
    {
      ...base,
      entries: {
        ...base.entries,
        [PROJECT]: { ...project, assetIds: [asset.id] },
        [body.id]: { ...body, children: [image.id] },
        [asset.id]: asset,
        [image.id]: image,
      },
    },
    library,
  );
  return { graph, bytes, hash, ref };
}
const memory = (files: Map<string, Uint8Array>): V2Source => ({
  read: async (path) => files.get(path) ?? null,
});

describe("ADR-248 Phase 4d project file", () => {
  it("a new project roundtrips through the v2 container with its data parts and asset bytes", async () => {
    const { graph, bytes, hash } = await projectWithImage();
    const extras = {
      collections: [{ id: "data:collection:users", name: "Users" }],
      apiEndpoints: [],
      variables: [{ id: "var-1", name: "count" }],
      fontRegistry: { families: [] },
      currentPageId: HOME,
    };
    const generation = await buildV2Generation(
      catalogProjectContent(graph, extras),
      async (wanted) =>
        wanted === hash ? { bytes, mime: "image/png", ext: "png" } : null,
    );
    expect(generation.manifest.assets.map((asset) => asset.hash)).toEqual([
      hash,
    ]);
    const files = new Map(generation.files);
    files.set("manifest.json", encodeManifest(generation.manifest));
    const read = await readV2Generation(memory(files));
    expect(read.assets.get(hash)?.bytes).toEqual(bytes);
    const { document, extras: readExtras } = readCatalogProjectContent(
      read.content,
      library!,
    );
    expect(document).toEqual(graph.exportDocument());
    expect(readExtras).toMatchObject(extras);
  });

  it("an asset entry without bytes cannot be exported, and an asset entry must be a content address", async () => {
    const { graph } = await projectWithImage();
    await expect(
      buildV2Generation(catalogProjectContent(graph), async () => null),
    ).rejects.toBeInstanceOf(V2AssetMissingError);
    const document = graph.exportDocument();
    let code: unknown;
    try {
      new CatalogGraph(
        {
          ...document,
          entries: {
            ...document.entries,
            "project:asset:logo": {
              ...(document.entries["project:asset:logo"] as AssetEntry),
              contentId: "logo.png",
            },
          },
        },
        library!,
      );
    } catch (error) {
      code = (error as { code?: unknown }).code;
    }
    expect(code).toBe("INVALID_ASSET_REF");
  });

  it("a container whose document part is not this project's catalog document is refused", async () => {
    const { graph } = await projectWithImage();
    library ??= await buildCodeCatalogLibrary();
    const content = catalogProjectContent(graph);
    expect(() =>
      readCatalogProjectContent(
        { ...content, document: { pages: [], elements: [] } },
        library!,
      ),
    ).toThrow("UNSUPPORTED_PROJECT_FORMAT");
    expect(() =>
      readCatalogProjectContent(
        { ...content, project: { id: "project:project:other", name: "x" } },
        library!,
      ),
    ).toThrow("UNSUPPORTED_PROJECT_FORMAT");
  });

  const OLD_EXPORT = join(
    __dirname,
    "../../../../../../docs/adr/design/248-baseline/storage-surface/oracle/old-export.composition.zip",
  );
  it.skipIf(!existsSync(OLD_EXPORT))(
    "the old app's real project file opens as a v2 container and its document part is refused",
    async () => {
      library ??= await buildCodeCatalogLibrary();
      execFileSync("unzip", ["-t", OLD_EXPORT]);
      const read = await readV2Generation(
        await openV2Zip(new Uint8Array(readFileSync(OLD_EXPORT))),
      );
      expect(read.manifest.project.name).toMatch(/^perf-baseline/);
      expect(() => readCatalogProjectContent(read.content, library!)).toThrow(
        "UNSUPPORTED_PROJECT_FORMAT",
      );
    },
  );
});
