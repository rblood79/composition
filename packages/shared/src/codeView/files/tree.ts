/**
 * ADR-296 Decision 1 · breakdown §3 — the project's virtual file tree. Listing it reads the entries'
 * names only (no file is generated — R5); a file is generated when it is opened
 * (`generateCodeViewFile`). Paths name entries by their code names (`names.ts`) and change with
 * them; the entry a file is (`kind` + `id`) is its identity.
 */
import type {
  CatalogReader,
  CollectionEntry,
  EndpointEntry,
  EntryId,
  ProjectEntry,
} from "../../catalog/document/types";
import { generateCodeView } from "../generate";
import type {
  CodeViewCollection,
  CodeViewEndpoint,
  CodeViewReader,
  CodeViewResult,
} from "../types";
import { generateAppFile } from "./app";
import { codeViewProjectNames, pascal } from "./names";
import {
  codeName,
  generateCollectionFile,
  generateEndpointFile,
  generateProjectStateFile,
} from "./definitions";

export type CodeViewFileKind =
  "app" | "page" | "collection" | "endpoint" | "state";

export interface CodeViewFileEntry {
  readonly path: string;
  readonly kind: CodeViewFileKind;
  /** The entry the file is (a page · a collection · an endpoint). */
  readonly id?: string;
  /** Read only (a Library origin · a catalog rule — Phase 4 · 5). */
  readonly readOnly?: boolean;
}

/** The files of the project, in the tree's order (App first, then pages). */
export function codeViewFileTree(
  reader: Pick<CatalogReader, "projectId" | "getEntry">,
): CodeViewFileEntry[] {
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  const names = codeViewProjectNames(reader);
  const files: CodeViewFileEntry[] = [{ path: "src/App.tsx", kind: "app" }];
  for (const [pageId, name] of names.pages)
    files.push({ path: `src/pages/${name}.tsx`, kind: "page", id: pageId });
  // ADR-296 Phase 3 — the data definitions (their names — the code imports them by these).
  const taken = new Set<string>();
  const unique = (base: string) => {
    let name = base;
    for (let index = 2; taken.has(name); index += 1) name = `${base}${index}`;
    taken.add(name);
    return name;
  };
  for (const id of project.collectionIds ?? []) {
    const entry = reader.getEntry(id) as CollectionEntry | undefined;
    if (entry?.kind === "collection")
      files.push({
        path: `src/data/${unique(codeName(entry.name, "rows"))}.ts`,
        kind: "collection",
        id,
      });
  }
  taken.clear();
  for (const id of project.endpointIds ?? []) {
    const entry = reader.getEntry(id) as EndpointEntry | undefined;
    if (entry?.kind === "endpoint")
      files.push({
        path: `src/api/${unique(codeName(entry.name, "endpoint"))}.ts`,
        kind: "endpoint",
        id,
      });
  }
  files.push({ path: "src/state/project.ts", kind: "state" });
  return files;
}

/** The data the page generator reads (the document's collections · endpoints as code). */
export interface CodeViewFileData {
  readonly collections: readonly CodeViewCollection[];
  readonly endpoints?: readonly CodeViewEndpoint[];
}

/** Generate one file of the tree (the one opened). */
export function generateCodeViewFile(
  input: { reader: CodeViewReader; file: CodeViewFileEntry } & CodeViewFileData,
): CodeViewResult {
  const { reader, file } = input;
  switch (file.kind) {
    case "app":
      return generateAppFile({ reader: reader as never });
    case "page":
      return generateCodeView({
        reader,
        pageId: file.id as EntryId<"page">,
        collections: input.collections,
        ...(input.endpoints ? { endpoints: input.endpoints } : {}),
      });
    case "collection":
      return generateCollectionFile({ reader: reader as never, id: file.id! });
    case "endpoint":
      return generateEndpointFile({ reader: reader as never, id: file.id! });
    case "state":
      return generateProjectStateFile({ reader: reader as never });
    default:
      throw new Error(`CODE_VIEW_FILE_KIND: ${file.kind as string}`);
  }
}

/** A collection's · endpoint's file name (used from Phase 3). */
export const codeViewEntryFileName = (
  entry: Pick<CollectionEntry | EndpointEntry, "name">,
) => pascal(entry.name, "Data");
