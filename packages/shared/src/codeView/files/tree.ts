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
import { generateToastFile } from "./toast";
import { generatePageStyleFile } from "./styles";
import { CODE_VIEW_THEME_PATH, generateThemeFile } from "./theme";
import {
  CODE_VIEW_HTML_PATH,
  CODE_VIEW_SITE_CONFIG_PATH,
  generateHtmlFile,
  generateSiteConfigFile,
} from "./site";
import {
  CODE_VIEW_LIBRARY_DIR,
  codeViewLibraryDefaults,
  codeViewLibraryOrigins,
  codeViewLibraryReader,
} from "./library";
import { codeViewProjectNames, pascal } from "./names";
import {
  codeName,
  generateCollectionFile,
  generateEndpointFile,
  generateProjectStateFile,
} from "./definitions";

export type CodeViewFileKind =
  | "app"
  /** `src/Toast.tsx` — the app's toast queue and shape (RAC `MyToastRegion`). */
  | "toast"
  | "page"
  | "collection"
  | "endpoint"
  | "state"
  /** ADR-296 Phase 4 — `src/pages/<Page>.css` (the page's node styles). */
  | "pageStyle"
  /** ADR-296 Phase 5 — `src/components/<Name>.tsx` (a user component's origin — origin commands). */
  | "component"
  /** ADR-296 Phase 5 — `src/components/<Name>.css` (its origin template's node styles). */
  | "componentStyle"
  /** ADR-296 Phase 5 — a locked Library origin (`node_modules/@composition/library/<Name>.tsx`, read only). */
  | "library"
  /** ADR-296 Phase 6 (결정 2) — `index.html` (the site's head settings). */
  | "html"
  /** ADR-296 Phase 6 (결정 2) — `site.config.ts` (search · redirects · access). */
  | "siteConfig"
  /**
   * ADR-296 Phase 4 — `src/theme.css` (themes · tokens). (The catalog rule sheets are not project
   * files — not listed, ADR-301 Decision 7.)
   */
  | "theme";

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
  const files: CodeViewFileEntry[] = [
    { path: CODE_VIEW_HTML_PATH, kind: "html" },
    { path: CODE_VIEW_SITE_CONFIG_PATH, kind: "siteConfig" },
    { path: "src/App.tsx", kind: "app" },
    { path: "src/Toast.tsx", kind: "toast" },
  ];
  files.push({ path: CODE_VIEW_THEME_PATH, kind: "theme" });
  // ADR-296 Phase 5 (결정 3) — the Library origins the pages use: locked = read only; unlocked =
  // a component file over its copy.
  const origins = codeViewLibraryOrigins(reader as never);
  for (const origin of origins.filter((item) => !item.locked))
    files.push({
      path: `src/components/${origin.name}.tsx`,
      kind: "component",
      id: origin.id,
    });
  for (const [definitionId, name] of names.components) {
    files.push({
      path: `src/components/${name}.tsx`,
      kind: "component",
      id: definitionId,
    });
    files.push({
      path: `src/components/${name}.css`,
      kind: "componentStyle",
      id: definitionId,
    });
  }
  for (const [pageId, name] of names.pages) {
    files.push({ path: `src/pages/${name}.tsx`, kind: "page", id: pageId });
    files.push({
      path: `src/pages/${name}.css`,
      kind: "pageStyle",
      id: pageId,
    });
  }
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
  for (const origin of origins.filter((item) => item.locked))
    files.push({
      path: `${CODE_VIEW_LIBRARY_DIR}/${origin.name}.tsx`,
      kind: "library",
      id: origin.id,
      readOnly: true,
    });
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
    case "toast":
      return generateToastFile({ reader: reader as never });
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
    case "html":
      return generateHtmlFile({ reader });
    case "siteConfig":
      return generateSiteConfigFile({ reader });
    case "pageStyle":
    case "componentStyle":
      return generatePageStyleFile({ reader, pageId: file.id! });
    case "component":
    case "library": {
      const result = generateCodeView({
        reader: file.id!.startsWith("lib:")
          ? codeViewLibraryReader(reader as never)
          : reader,
        pageId: "" as EntryId<"page">,
        componentId: file.id!,
        collections: input.collections,
        ...(input.endpoints ? { endpoints: input.endpoints } : {}),
      });
      // (A Library origin's project defaults — the Components panel's — shown, read only.)
      const defaults = codeViewLibraryDefaults(reader as never, file.id!);
      return defaults
        ? { ...result, code: `${result.code}\n${defaults}\n` }
        : result;
    }
    case "theme":
      return generateThemeFile({ reader });
    default:
      throw new Error(`CODE_VIEW_FILE_KIND: ${file.kind as string}`);
  }
}

/** A collection's · endpoint's file name (used from Phase 3). */
export const codeViewEntryFileName = (
  entry: Pick<CollectionEntry | EndpointEntry, "name">,
) => pascal(entry.name, "Data");
