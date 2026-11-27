import type { CatalogLibrary } from "../../../packages/shared/src/catalog/document/types";
import { CatalogPreviewSession } from "../../../packages/shared/src/catalog/runtime/catalogPreviewSession";
import { applyCatalogPreviewTheme } from "../../../packages/shared/src/catalog/runtime/domView";
import { NullLayoutEngine } from "../../../packages/shared/src/catalog/runtime/nullLayoutEngine";
import { catalogThemeState } from "../../../packages/shared/src/catalog/runtime/theme";
import type { LoadedCatalogProject } from "./catalogProject";

/** The browser's `localStorage`, or none where it is blocked (a private window · a sandbox). */
function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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
    // ADR-315 사용자 결정 1 — a Table with 「Remember state」 keeps its user's state in this browser.
    tableStateStorage: browserStorage(),
    // ADR-320 사용자 결정 5 — the address carries the filter bars' trees (a link shows the same rows).
    addressFilters: true,
    // No Builder loads this app's API collections or runs their execution policy: the session does,
    // and shows what it loaded — never the design sample rows.
    standalone: true,
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
  // ADR-324 Decision 8 (사용자 결정 2) — a tab closed · reloaded with a 「모아서 저장」 change not
  // saved asks first; the changes are not kept in the browser. The Builder's Preview never asks.
  window.addEventListener("beforeunload", (event) => {
    if (!session.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  return session;
}
