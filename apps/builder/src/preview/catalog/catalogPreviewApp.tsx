import { ToastProvider } from "@composition/shared/components";
import { createRoot } from "react-dom/client";
import { buildCodeCatalogLibrary } from "../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { NullLayoutEngine } from "../../builder/catalogRuntime/nullLayoutEngine";
import { catalogThemeState } from "../../builder/catalogRuntime/theme";
import { PreviewLocale } from "../PreviewLocale";
import { CatalogPreviewSession } from "./catalogPreviewSession";
import {
  applyCatalogPreviewTheme,
  CatalogPreviewView,
  CatalogPreviewDataProvider,
  CatalogPreviewToasts,
  catalogPreviewRuntime,
  catalogPreviewLinkClick,
} from "../../../../../packages/shared/src/catalog/runtime/domView";
export {
  applyCatalogPreviewTheme,
  CatalogPreviewView,
  CatalogPreviewDataProvider,
  catalogPreviewRuntime,
  catalogPreviewLinkClick,
} from "../../../../../packages/shared/src/catalog/runtime/domView";
/**
 * Compare Mode: a click on an element in the Preview selects it on the Canvas (⌘ / Ctrl toggles
 * it in a multi-selection) — the old Preview's `ELEMENT_SELECTED`. The record's identity and
 * source go to the parent Builder, which maps them onto its own root.
 */
export function catalogPreviewSelectClick(
  session: CatalogPreviewSession,
  post: (message: unknown) => void,
): (event: MouseEvent) => void {
  return (event) => {
    const element = (event.target as Element | null)?.closest?.(
      "[data-catalog-id]",
    );
    const identity = element?.getAttribute("data-catalog-id");
    if (!identity) return;
    const record = session.root?.domInputs.get(identity);
    if (!record) return;
    post({
      type: "CATALOG_SELECT",
      identity,
      sourceId: record.sourceId,
      additive: event.metaKey || event.ctrlKey,
    });
  };
}

/**
 * ADR-248 4e-6: the Preview document of a catalog project (`preview.html?catalog=1`). Messages
 * are taken only from the parent Builder window of this origin; the document says it is ready
 * (`PREVIEW_READY`, the Builder's existing bootstrap check) and the Builder answers with a
 * snapshot and its page.
 */
export async function startCatalogPreview(): Promise<void> {
  const library = await buildCodeCatalogLibrary();
  const origin = window.location.origin;
  const session = new CatalogPreviewSession(library, {
    requestSnapshot: (request) => window.parent.postMessage(request, origin),
    engine: () => new NullLayoutEngine(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    locale: navigator.language,
    theme: catalogThemeState,
    applyTheme: applyCatalogPreviewTheme,
  });
  window.addEventListener("message", (event) => {
    if (event.origin !== origin || event.source !== window.parent) return;
    const receipt = session.receive(event.data);
    if (receipt.kind === "rejected")
      console.error("[CatalogPreview] payload rejected:", receipt.error);
  });
  const toast = { show: (_message: string) => {} };
  const runtime = catalogPreviewRuntime(session, toast);
  document.addEventListener("click", catalogPreviewLinkClick(session), true);
  document.addEventListener(
    "click",
    catalogPreviewSelectClick(session, (message) =>
      window.parent.postMessage(message, origin),
    ),
    true,
  );
  createRoot(document.body).render(
    <PreviewLocale>
      <ToastProvider position="bottom-right">
        <CatalogPreviewToasts toast={toast} />
        <CatalogPreviewDataProvider session={session}>
          <CatalogPreviewView session={session} runtime={runtime} />
        </CatalogPreviewDataProvider>
      </ToastProvider>
    </PreviewLocale>,
  );
  window.parent.postMessage({ type: "PREVIEW_READY" }, origin);
}
