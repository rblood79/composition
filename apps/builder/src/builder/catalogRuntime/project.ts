import type {
  CatalogDocument,
  CatalogLibrary,
  EntryId,
  PageEntry,
  ProjectEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import { CatalogStorage, CatalogStorageError } from "./storage";

/**
 * ADR-248 §4.2 new-project path: a project always starts in the new namespace and format. No
 * old store is read and no old document is converted.
 */
export function newCatalogProjectDocument(options: {
  projectId: EntryId<"project">;
  name: string;
}): CatalogDocument {
  const pageId = "project:page:home" as EntryId<"page">;
  const project: ProjectEntry = {
    kind: "project",
    id: options.projectId,
    name: options.name,
    pageIds: [pageId],
    definitionIds: [],
    overrideIds: [],
    themeIds: [],
    tokenIds: [],
    stateVariableIds: [],
    interactionIds: [],
    assetIds: [],
  };
  const page: PageEntry = {
    kind: "page",
    id: pageId,
    route: "/",
    name: "Home",
    children: [],
  };
  return {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 1,
    revision: 0,
    projectId: options.projectId,
    rootId: options.projectId,
    entries: { [project.id]: project, [page.id]: page },
  };
}

/** Create and store a new project; returns its graph at revision 0. */
export async function createCatalogProject(
  storage: CatalogStorage,
  library: CatalogLibrary,
  options: { projectId: EntryId<"project">; name: string },
): Promise<CatalogGraph> {
  const document = newCatalogProjectDocument(options);
  await storage.create(document, library);
  return new CatalogGraph(document, library);
}

/**
 * ADR-248 §4.3: until Publish follows (H4), the Builder's publish entry has nowhere to send a
 * catalog project. It fails with a visible reason — never a blank page, a silent no-op or a
 * catalog→canonical export.
 */
export class CatalogPublishUnavailableError extends CatalogStorageError {
  constructor() {
    super("UNSUPPORTED_PROJECT_FORMAT");
    this.message =
      "UNSUPPORTED_PROJECT_FORMAT: publish does not open the catalog project format yet";
    this.name = "CatalogPublishUnavailableError";
  }
}
export function publishCatalogProject(): never {
  throw new CatalogPublishUnavailableError();
}
