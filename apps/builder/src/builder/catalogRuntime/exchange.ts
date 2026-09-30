import {
  CatalogGraph,
  createCatalogGraph,
} from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogDocument,
  CatalogLibrary,
  ProjectEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { ProjectContentV2 } from "../../../../../packages/shared/src/assets/formatV2";
import { CatalogStorageError } from "./storage";
import { sha256Hex } from "../../../../../packages/shared/src/assets/assetBytes";

function parseDocument(
  value: unknown,
  library: CatalogLibrary,
): CatalogDocument {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { format?: unknown }).format !== "composition-catalog"
  )
    throw new CatalogStorageError("UNSUPPORTED_PROJECT_FORMAT");
  return createCatalogGraph(value, library).exportDocument();
}

/** Explicit cold-path interchange; never called by a leaf edit or incremental save. */
export function exportCatalogJson(graph: CatalogGraph): string {
  return JSON.stringify(graph.exportDocument());
}
export function importCatalogJson(
  json: string,
  library: CatalogLibrary,
): CatalogDocument {
  return parseDocument(JSON.parse(json) as unknown, library);
}

export interface CatalogFolderFiles {
  "manifest.json": string;
  [path: string]: string;
}
const bytes = (value: string) => new TextEncoder().encode(value);
/** Cold export with ADR-235 content-addressed immutable parts. */
export async function exportCatalogFolder(
  graph: CatalogGraph,
): Promise<CatalogFolderFiles> {
  const document = graph.exportDocument();
  const files: CatalogFolderFiles = { "manifest.json": "" };
  const paths: Record<string, string> = {};
  for (const [id, entry] of Object.entries(document.entries)) {
    const content = JSON.stringify(entry);
    const path = `parts/${await sha256Hex(bytes(content))}.json`;
    paths[id] = path;
    files[path] = content;
  }
  files["manifest.json"] = JSON.stringify({
    format: document.format,
    schemaVersion: document.schemaVersion,
    libraryContractVersion: document.libraryContractVersion,
    revision: document.revision,
    projectId: document.projectId,
    rootId: document.rootId,
    paths,
  });
  return files;
}
export async function importCatalogFolder(
  files: Readonly<Record<string, string>>,
  library: CatalogLibrary,
): Promise<CatalogDocument> {
  const manifest = JSON.parse(files["manifest.json"] ?? "null") as Record<
    string,
    unknown
  > | null;
  if (!manifest || manifest.format !== "composition-catalog")
    throw new CatalogStorageError("UNSUPPORTED_PROJECT_FORMAT");
  const paths = manifest.paths;
  if (!paths || typeof paths !== "object")
    throw new CatalogStorageError("UNSUPPORTED_PROJECT_FORMAT");
  const entries: Record<string, unknown> = {};
  for (const [id, path] of Object.entries(paths)) {
    if (typeof path !== "string" || !files[path])
      throw new Error(`MISSING_CATALOG_ENTRY:${id}`);
    if (path !== `parts/${await sha256Hex(bytes(files[path]))}.json`)
      throw new Error(`CORRUPT_CATALOG_ENTRY:${id}`);
    entries[id] = JSON.parse(files[path]) as unknown;
  }
  const { paths: _paths, ...head } = manifest;
  return parseDocument({ ...head, entries }, library);
}

export interface CatalogFolderTarget {
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
}
/** Immutable parts, versioned manifest, then active pointer: interrupted writes preserve the old generation. */
export async function writeCatalogFolder(
  target: CatalogFolderTarget,
  graph: CatalogGraph,
): Promise<void> {
  const files = await exportCatalogFolder(graph);
  for (const [path, content] of Object.entries(files)) {
    if (path === "manifest.json") continue;
    if ((await target.read(path)) === null) await target.write(path, content);
    if ((await target.read(path)) !== content)
      throw new Error(`CORRUPT_CATALOG_PART:${path}`);
  }
  const revisionPath = `manifests/${graph.revision}.json`;
  await target.write(revisionPath, files["manifest.json"]);
  if ((await target.read(revisionPath)) !== files["manifest.json"])
    throw new Error("CORRUPT_CATALOG_MANIFEST");
  await target.write("manifest.json", files["manifest.json"]);
}

/**
 * ADR-248 §4.2 project file (folder or zip): the ADR-235 v2 container — immutable content-addressed
 * parts, asset bytes, generation recovery — whose document part is the catalog document. The
 * data stores (collections, API endpoints, variables; ADR-131 data SSOT) and fonts travel as the
 * container's other parts, unchanged. `buildV2Generation` / `readV2Generation` do the file work.
 */
export type CatalogProjectFileExtras = Omit<
  ProjectContentV2,
  "project" | "document"
>;
export function catalogProjectContent(
  graph: CatalogGraph,
  extras: CatalogProjectFileExtras = {},
): ProjectContentV2 {
  const project = graph.getEntry(graph.projectId) as ProjectEntry;
  return {
    ...extras,
    project: { id: graph.projectId, name: project.name },
    document: graph.exportDocument(),
  };
}
/** The document part must be a catalog document of this format; an old project file fails. */
export function readCatalogProjectContent(
  content: ProjectContentV2,
  library: CatalogLibrary,
): { document: CatalogDocument; extras: CatalogProjectFileExtras } {
  const document = parseDocument(content.document, library);
  if (content.project.id !== document.projectId)
    throw new CatalogStorageError("UNSUPPORTED_PROJECT_FORMAT");
  const { project: _project, document: _document, ...extras } = content;
  return { document, extras };
}
