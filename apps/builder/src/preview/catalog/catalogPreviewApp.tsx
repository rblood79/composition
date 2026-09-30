import { Fragment, useSyncExternalStore } from "react";
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
}: {
  session: CatalogPreviewSession;
}) {
  useSyncExternalStore(session.subscribe, session.getVersion);
  const root = session.root;
  const record = session.pageRecord;
  if (!root || !record)
    return <div className="preview-loading">Initializing Preview...</div>;
  return (
    <Fragment key={`${rootKey(root)}:${record}`}>
      {renderCatalogDom(root, record, { slotMode: "page" })}
    </Fragment>
  );
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
  createRoot(document.body).render(
    <PreviewLocale>
      <CatalogPreviewView session={session} />
    </PreviewLocale>,
  );
  window.parent.postMessage({ type: "PREVIEW_READY" }, origin);
}
