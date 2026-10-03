import { Fragment, useEffect, useSyncExternalStore } from "react";
import { ToastProvider, useToast } from "@composition/shared/components";
import { createRoot } from "react-dom/client";
import { buildCodeCatalogLibrary } from "../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { renderCatalogDom } from "../../builder/catalogRuntime/domBinding";
import { NullLayoutEngine } from "../../builder/catalogRuntime/nullLayoutEngine";
import {
  catalogThemeState,
  type CatalogThemeState,
} from "../../builder/catalogRuntime/theme";
import type { CatalogCompositionRoot } from "../../builder/catalogRuntime/compositionRoot";
import { PreviewLocale } from "../PreviewLocale";
import { CatalogPreviewSession } from "./catalogPreviewSession";
import { CatalogPreviewInteractions } from "./catalogPreviewInteractions";
import type { CatalogDomRuntime } from "../../builder/catalogRuntime/domBinding";

/** The theme as the DOM reads it: CSS variables (light + dark blocks), color mode, base type. */
export function applyCatalogPreviewTheme(state: CatalogThemeState): void {
  const snapshot = state.snapshot();
  let style = document.getElementById(
    "runtime-theme-vars",
  ) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "runtime-theme-vars";
    document.head.appendChild(style);
  }
  const block = (selector: string, dark: boolean) =>
    `${selector} {\n${snapshot.cssVars
      .filter((cssVar) => cssVar.isDark === dark)
      .map((cssVar) => `  ${cssVar.name}: ${cssVar.value};`)
      .join("\n")}\n}\n`;
  style.textContent =
    block(":root", false) + block('[data-theme="dark"]', true);
  document.documentElement.setAttribute("data-theme", state.colorMode);
  for (const element of [document.documentElement, document.body]) {
    element.style.fontFamily = snapshot.base.fontFamily;
    element.style.fontSize = `${snapshot.base.fontSize}px`;
    element.style.lineHeight = String(snapshot.base.lineHeight);
  }
  document.body.style.color = "var(--fg)";
  document.body.style.backgroundColor = "var(--bg)";
}

const roots = new WeakMap<CatalogCompositionRoot, number>();
let rootCount = 0;
/** A new root (a snapshot, a theme change) mounts a new tree: its records are new objects. */
const rootKey = (root: CatalogCompositionRoot) => {
  let key = roots.get(root);
  if (key === undefined) roots.set(root, (key = ++rootCount));
  return key;
};

export function CatalogPreviewView({
  session,
  runtime,
}: {
  session: CatalogPreviewSession;
  runtime?: CatalogDomRuntime;
}) {
  useSyncExternalStore(session.subscribe, session.getVersion);
  const root = session.root;
  const record = session.pageRecord;
  if (!root || !record)
    return <div className="preview-loading">Initializing Preview...</div>;
  // No page answers to the path the user followed (the old router's default 404 view).
  if (session.notFound !== undefined)
    return (
      <div className="preview-not-found" role="alert">
        <h1>404</h1>
        <p>Page not found</p>
        <p className="preview-not-found__path">{session.notFound}</p>
      </div>
    );
  return (
    <Fragment key={`${rootKey(root)}:${record}`}>
      {renderCatalogDom(root, record, { slotMode: "page", runtime })}
    </Fragment>
  );
}

/** The session's rules, their toasts shown in this document's toast region. */
function CatalogPreviewToasts({
  toast,
}: {
  toast: { show: (message: string) => void };
}) {
  const { addToast } = useToast();
  useEffect(() => {
    toast.show = (message) => addToast({ title: message });
  }, [addToast, toast]);
  return null;
}

/** The session's rule runtime (rules · capability overrides · toasts · navigation by route). */
export function catalogPreviewRuntime(
  session: CatalogPreviewSession,
  toast: { show: (message: string) => void },
): CatalogPreviewInteractions {
  return new CatalogPreviewInteractions({
    graph: () => session.graph,
    root: () => session.root,
    subscribe: session.subscribe,
    navigate: (pageId) => session.navigate(pageId),
    navigateTo: (path) => session.navigateTo(path),
    showToast: (message) => toast.show(message),
    writeState: session.writeState,
    ownerRecord: (recordId, ownerId) => session.ownerRecord(recordId, ownerId),
  });
}

/**
 * An internal link (`/route`) moves the Preview to that page; an external one opens a new tab;
 * `#anchor` and `target="_blank"` keep the browser's behavior (the old Preview's rule).
 */
export function catalogPreviewLinkClick(
  session: CatalogPreviewSession,
): (event: MouseEvent) => void {
  return (event) => {
    const anchor = (event.target as Element | null)?.closest?.("a");
    const href = anchor?.getAttribute("href");
    if (!anchor || !href || href.startsWith("#")) return;
    if (anchor.getAttribute("target") === "_blank") return;
    event.preventDefault();
    event.stopPropagation();
    if (/^(https?:\/\/|\/\/|mailto:|tel:|javascript:)/i.test(href)) {
      if (!/^javascript:/i.test(href))
        window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    session.navigateTo(href);
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
  createRoot(document.body).render(
    <PreviewLocale>
      <ToastProvider position="bottom-right">
        <CatalogPreviewToasts toast={toast} />
        <CatalogPreviewView session={session} runtime={runtime} />
      </ToastProvider>
    </PreviewLocale>,
  );
  window.parent.postMessage({ type: "PREVIEW_READY" }, origin);
}
