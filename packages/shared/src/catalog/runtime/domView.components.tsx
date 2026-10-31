import { CollectionDataContext } from "@composition/shared";
import { CatalogPreviewToastBridge } from "./toastBridge";
import { RouterProvider } from "react-aria-components";

import { ToastProvider, useToast } from "@composition/shared/components";

import {
  Fragment,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { CatalogPreviewSession } from "./catalogPreviewSession";

import { renderCatalogDom, type CatalogDomRuntime } from "./domBinding";

import { catalogToastPlacement, rootKey } from "./domView.runtime";

/** The Preview router's `navigate`: a route moves the page, an `#anchor` scrolls to its element. */
export function catalogPreviewNavigate(
  session: CatalogPreviewSession,
): (path: string) => void {
  return (path) => {
    if (!path.startsWith("#")) {
      session.navigateTo(path);
      return;
    }
    const id = decodeURIComponent(path.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView?.();
  };
}

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
  // RAC's client routing (the reference's `RouterProvider`): an item's, a row's or a link's own
  // `href` goes to the session's router (`:param` routes, the 404 page), never a document load.
  // (An `#anchor` stays on the page — RAC prevents the browser's jump, so it scrolls here; the
  // palette Link's `#` was a 404 — RAC event audit 2026-10-26.)
  return (
    <RouterProvider navigate={catalogPreviewNavigate(session)}>
      <Fragment key={`${rootKey(root)}:${record}`}>
        {renderCatalogDom(root, record, { slotMode: "page", runtime })}
      </Fragment>
    </RouterProvider>
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
      placement={catalogToastPlacement(
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
  toast: CatalogPreviewToastBridge;
}) {
  const { addToast } = useToast();
  useEffect(() => {
    return toast.connect((message, options) =>
      addToast({ title: message, ...options }),
    );
  }, [addToast, toast]);
  return null;
}
