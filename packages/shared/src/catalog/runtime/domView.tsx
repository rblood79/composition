import {
  Fragment,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { CollectionDataContext } from "@composition/shared";
import { ToastProvider, useToast } from "@composition/shared/components";
import type { CatalogToastPlacement } from "../document/types";
import type { CatalogThemeState } from "./theme";
import type { CatalogCompositionRoot } from "./compositionRoot";
import { renderCatalogDom, type CatalogDomRuntime } from "./domBinding";
import { CatalogPreviewSession } from "./catalogPreviewSession";
import { CatalogPreviewInteractions } from "./catalogPreviewInteractions";
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

/** The Builder's data services (API endpoints) for the Preview's components (FileUpload …). */
export function CatalogPreviewDataProvider({
  session,
  children,
}: {
  session: CatalogPreviewSession;
  children: ReactNode;
}) {
  useSyncExternalStore(session.subscribe, session.getVersion);
  return (
    <CollectionDataContext.Provider value={session.dataServices}>
      {children}
    </CollectionDataContext.Provider>
  );
}

/**
 * S2 1.8.0 `ToastPlacement` → the toast region's place (`end` is the right of a left-to-right
 * page). Absent = `bottom end` — the region's place before the project chose one.
 */
export function catalogToastPosition(
  placement: CatalogToastPlacement | undefined,
): "top-center" | "top-right" | "bottom-center" | "bottom-right" {
  switch (placement) {
    case "top":
      return "top-center";
    case "top end":
      return "top-right";
    case "bottom":
      return "bottom-center";
    default:
      return "bottom-right";
  }
}

/** The app's toast region, where the project places it (S2 `ToastContainer` `placement`). */
export function CatalogToastProvider({
  session,
  children,
}: {
  session: CatalogPreviewSession;
  children: ReactNode;
}) {
  useSyncExternalStore(session.subscribe, session.getVersion);
  const project = session.graph?.getEntry(session.graph.projectId);
  return (
    <ToastProvider
      position={catalogToastPosition(
        project?.kind === "project" ? project.toastPlacement : undefined,
      )}
    >
      {children}
    </ToastProvider>
  );
}

/** The session's rules, their toasts shown in this document's toast region. */
export function CatalogPreviewToasts({
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
    sortTable: (tableId, sort) => session.sortTable(tableId, sort),
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
