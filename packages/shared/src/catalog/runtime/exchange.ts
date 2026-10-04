import { CatalogGraph, createCatalogGraph } from "../document/graph";
import type {
  CatalogDocument,
  CatalogLibrary,
  ProjectEntry,
} from "../document/types";
import type { ProjectContentV2 } from "../../assets/formatV2";
import { CatalogStorageError } from "./storage";
import {
  decodeDataUrl,
  encodeDataUrl,
  findAssetRefs,
  hashFromRef,
  sha256Hex,
} from "../../assets/assetBytes";
import { V2AssetMissingError } from "../../assets/formatV2";

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

/** Every string in a value that equals a key of `map`, replaced by its value (object keys too). */
function replaceStrings<T>(value: T, map: ReadonlyMap<string, string>): T {
  const visit = (current: unknown): unknown => {
    if (typeof current === "string") return map.get(current) ?? current;
    if (Array.isArray(current)) return current.map(visit);
    if (!current || typeof current !== "object") return current;
    return Object.fromEntries(
      Object.entries(current).map(([key, child]) => [
        map.get(key) ?? key,
        visit(child),
      ]),
    );
  };
  return visit(value) as T;
}

/**
 * A project file imported into an open project keeps that project's identity (as the old import
 * did): the file's project id becomes the open one wherever the document names it — the project
 * entry, the root, the head. Entry ids of other kinds are not project scoped.
 */
export function rehomeCatalogDocument(
  document: CatalogDocument,
  projectId: CatalogDocument["projectId"],
): CatalogDocument {
  if (document.projectId === projectId) return document;
  return replaceStrings(document, new Map([[document.projectId, projectId]]));
}

/**
 * The file's collections are created or matched by name in the open project's data store (the
 * old import rule); a collection that got another id there is re-pointed wherever the document
 * references it (`data:collection:<id>` — bindings, data actions).
 */
export function remapCatalogCollections(
  document: CatalogDocument,
  ids: ReadonlyMap<string, string>,
): CatalogDocument {
  const map = new Map<string, string>();
  for (const [from, to] of ids)
    if (from !== to)
      map.set(`data:collection:${from}`, `data:collection:${to}`);
  return map.size ? replaceStrings(document, map) : document;
}

/**
 * ADR-248 4e-6 JSON project file: the v2 container's content in one self-contained JSON — the
 * catalog document stays as it is (an asset entry holds a content address, never inline bytes) and
 * each referenced asset's bytes travel beside it as a data URL. The old app's JSON (`version`
 * 1.x, a canonical document) is not this format.
 */
export const CATALOG_PROJECT_JSON_FORMAT = "composition-catalog-project";
export interface CatalogProjectJson extends ProjectContentV2 {
  format: typeof CATALOG_PROJECT_JSON_FORMAT;
  version: 1;
  exportedAt: string;
  /** Asset ref (`asset:sha256-…`) → data URL of its bytes. */
  assets: Record<string, string>;
}
export function isCatalogProjectJson(
  value: unknown,
): value is CatalogProjectJson {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { format?: unknown }).format === CATALOG_PROJECT_JSON_FORMAT &&
    (value as { version?: unknown }).version === 1
  );
}

/** The file as one JSON text: the content, then each asset its content references, as bytes. */
export async function buildCatalogProjectJson(
  content: ProjectContentV2,
  readAsset: (
    hash: string,
  ) => Promise<{ bytes: Uint8Array; mime: string } | null>,
  exportedAt = new Date().toISOString(),
): Promise<string> {
  const assets: Record<string, string> = {};
  for (const ref of findAssetRefs(content)) {
    const asset = await readAsset(hashFromRef(ref) ?? "");
    if (!asset) throw new V2AssetMissingError(ref);
    assets[ref] = encodeDataUrl(asset.mime, asset.bytes);
  }
  const file: CatalogProjectJson = {
    format: CATALOG_PROJECT_JSON_FORMAT,
    version: 1,
    exportedAt,
    ...content,
    assets,
  };
  return JSON.stringify(file);
}

/**
 * A JSON project file: its content and asset bytes, each checked against its content address. Any
 * other JSON (the old app's export included) fails with UNSUPPORTED_PROJECT_FORMAT.
 */
export async function readCatalogProjectJson(text: string): Promise<{
  content: ProjectContentV2;
  assets: { ref: string; mime: string; bytes: Uint8Array }[];
}> {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new CatalogStorageError("UNSUPPORTED_PROJECT_FORMAT");
  }
  if (!isCatalogProjectJson(value))
    throw new CatalogStorageError("UNSUPPORTED_PROJECT_FORMAT");
  const {
    format: _format,
    version: _version,
    exportedAt: _exportedAt,
    assets: files,
    ...content
  } = value;
  const assets: { ref: string; mime: string; bytes: Uint8Array }[] = [];
  for (const [ref, dataUrl] of Object.entries(files ?? {})) {
    const decoded = typeof dataUrl === "string" ? decodeDataUrl(dataUrl) : null;
    if (!decoded || hashFromRef(ref) !== (await sha256Hex(decoded.bytes)))
      throw new Error(`CORRUPT_ASSET:${ref}`);
    assets.push({ ref, ...decoded });
  }
  return { content, assets };
}

/**
 * Import a project file's content into the open project (the old import's rule — the open project
 * keeps its identity, the file's document replaces its document): the document part is checked
 * first, then the data parts go into the data store (`importData` — collections matched by name,
 * returning file id → store id), then the document, re-homed and re-pointed, replaces the stored
 * one (the open project's name kept). The caller reopens the project. The page to open is the file's current page when the
 * document has it, else the first page (`pageMissing`).
 */
export async function importCatalogProjectContent(options: {
  content: ProjectContentV2;
  projectId: CatalogDocument["projectId"];
  /** The open project's name, kept (the name is the project's, not the file's). */
  name?: string;
  library: CatalogLibrary;
  replace: (document: CatalogDocument) => Promise<unknown>;
  importData: (
    extras: CatalogProjectFileExtras,
  ) => Promise<ReadonlyMap<string, string>>;
}): Promise<{
  document: CatalogDocument;
  pageId: string | undefined;
  pageMissing: boolean;
  extras: CatalogProjectFileExtras;
}> {
  const { document: read, extras } = readCatalogProjectContent(
    options.content,
    options.library,
  );
  const ids = await options.importData(extras);
  const remapped = remapCatalogCollections(
    rehomeCatalogDocument(read, options.projectId),
    ids,
  );
  const project: ProjectEntry = {
    ...(remapped.entries[remapped.projectId] as ProjectEntry),
    ...(options.name !== undefined ? { name: options.name } : {}),
  };
  const document: CatalogDocument = {
    ...remapped,
    entries: { ...remapped.entries, [project.id]: project },
  };
  await options.replace(document);
  const wanted = extras.currentPageId ?? undefined;
  const pageMissing = !!wanted && document.entries[wanted]?.kind !== "page";
  return {
    document,
    pageId: wanted && !pageMissing ? wanted : project.pageIds[0],
    pageMissing,
    extras,
  };
}
