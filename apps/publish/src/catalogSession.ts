import type { CatalogLibrary } from "../../../packages/shared/src/catalog/document/types";
import { CatalogPreviewSession } from "../../../packages/shared/src/catalog/runtime/catalogPreviewSession";
import { applyCatalogPreviewTheme } from "../../../packages/shared/src/catalog/runtime/domView";
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
    // The session applies the theme on the snapshot and again in a rule's color mode
    // (ADR-281 Decision 6 — a page root's colorScheme), as the Builder's Preview does.
    applyTheme: applyCatalogPreviewTheme,
  });
  // ADR-286: the data definitions (collections · endpoints · variables) are the document's — the
  // session reads them from the snapshot; a published app has no Builder API rows to receive.
  const { document, extras } = project;
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
