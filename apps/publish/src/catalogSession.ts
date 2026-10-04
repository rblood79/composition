import type { CatalogLibrary } from "../../../packages/shared/src/catalog/document/types";
import { CatalogPreviewSession } from "../../../packages/shared/src/catalog/runtime/catalogPreviewSession";
import { NullLayoutEngine } from "../../../packages/shared/src/catalog/runtime/nullLayoutEngine";
import { catalogThemeState } from "../../../packages/shared/src/catalog/runtime/theme";
import type { LoadedCatalogProject } from "./catalogProject";

export function createPublishedSession(
  project: LoadedCatalogProject,
  library: CatalogLibrary,
) {
  const session = new CatalogPreviewSession(library, {
    requestSnapshot: () => {},
    engine: () => new NullLayoutEngine(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    locale: navigator.language,
    theme: catalogThemeState,
  });
  const { document, extras } = project;
  session.receive({
    type: "CATALOG_DATA",
    version: 1,
    collections: extras.collections ?? [],
    apiEndpoints: extras.apiEndpoints ?? [],
    variables: extras.variables ?? [],
  });
  const receipt = session.receive({
    type: "CATALOG_SNAPSHOT",
    version: 1,
    projectId: document.projectId,
    revision: document.revision,
    document,
  });
  if (receipt.kind !== "snapshot") throw new Error("INVALID_CATALOG_SNAPSHOT");
  const page =
    extras.currentPageId &&
    session.graph?.getEntry(extras.currentPageId as never);
  if (page && page.kind === "page") session.navigate(page.id);
  return session;
}
