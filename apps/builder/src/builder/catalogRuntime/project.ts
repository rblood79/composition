import { LIBRARY_CONTRACT_VERSION } from "../../../../../packages/shared/src/catalog/document/types";
import type {
  CatalogDocument,
  CatalogLibrary,
  EntryId,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import { CatalogStorage } from "./storage";

const PROJECT_PREFIX = "project:project:";

/** The Builder route segment of a project (`/builder/<segment>`). */
export function catalogRouteIdOf(projectId: EntryId<"project">): string {
  return projectId.slice(PROJECT_PREFIX.length);
}
/** The project id a Builder route segment opens; undefined for a segment no project id has. */
export function catalogProjectIdOf(
  routeId: string,
): EntryId<"project"> | undefined {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(routeId)
    ? (`${PROJECT_PREFIX}${routeId}` as EntryId<"project">)
    : undefined;
}
/** A new, unused project id. */
export function newCatalogProjectId(): EntryId<"project"> {
  return `${PROJECT_PREFIX}${crypto.randomUUID()}` as EntryId<"project">;
}

/**
 * ADR-248 §4.2 new-project path: a project always starts in the new namespace and format. No
 * old store is read and no old document is converted. Its page has one root, the page body (the
 * page frame the Canvas draws on the page grid).
 */
export function newCatalogProjectDocument(options: {
  projectId: EntryId<"project">;
  name: string;
}): CatalogDocument {
  const pageId = "project:page:home" as EntryId<"page">;
  const bodyId = "project:node:home-body" as NodeId;
  const body: NodeEntry = {
    kind: "node",
    id: bodyId,
    definitionId: "lib:definition:type-body",
    name: "Body",
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
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
    children: [bodyId],
  };
  return {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: LIBRARY_CONTRACT_VERSION,
    revision: 0,
    projectId: options.projectId,
    rootId: options.projectId,
    entries: { [project.id]: project, [page.id]: page, [body.id]: body },
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
