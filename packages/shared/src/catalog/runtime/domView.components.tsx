import { CollectionDataContext } from "@composition/shared";
import { CatalogPreviewToastBridge } from "./toastBridge";
import { RouterProvider } from "react-aria-components";

import {
  ToastProvider,
  useToast,
  type ToastRenderInput,
} from "@composition/shared/components";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { CatalogCompositionRoot } from "./compositionRoot";
import {
  CatalogToastShapeContext,
  catalogToastShapeParts,
  catalogToastShapeRuntime,
} from "./toastShape";

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

/**
 * The app's toast region, where the project places it (S2 `ToastContainer` `placement`), drawing
 * the project's toast shape when it chose one (user 2026-11-01 — RAC `MyToastRegion`: the shape
 * component's template with the toast's data over it, `toastShape.ts`).
 */
export function CatalogToastProvider({
  session,
  runtime,
  children,
}: {
  session: CatalogPreviewSession;
  /** The session's rule runtime — the shape's own rules · overrides render with it. */
  runtime?: CatalogDomRuntime;
  children: ReactNode;
}) {
  useSyncExternalStore(session.subscribe, session.getVersion);
  const project = session.graph?.getEntry(session.graph.projectId);
  const shape = session.toastShapeRoot();
  const renderToast = useCallback(
    (toast: ToastRenderInput) =>
      shape ? (
        <CatalogToastShape root={shape} runtime={runtime} toast={toast} />
      ) : null,
    [shape, runtime],
  );
  return (
    <ToastProvider
      placement={catalogToastPlacement(
        project?.kind === "project" ? project.toastPlacement : undefined,
      )}
      {...(shape ? { renderToast } : {})}
    >
      {children}
    </ToastProvider>
  );
}

/** One toast as the app's shape: the shape's template, this toast's data over its records. */
function CatalogToastShape({
  root,
  runtime,
  toast,
}: {
  root: CatalogCompositionRoot;
  runtime?: CatalogDomRuntime;
  toast: ToastRenderInput;
}) {
  const [record] = root.pageRootRecords();
  const shaped = useMemo(
    () =>
      record
        ? catalogToastShapeRuntime(
            runtime,
            catalogToastShapeParts(root, record),
            toast,
          )
        : undefined,
    [root, record, runtime, toast],
  );
  const context = useMemo(() => ({ close: toast.close }), [toast.close]);
  if (!record || !shaped) return null;
  return (
    <CatalogToastShapeContext.Provider value={context}>
      <Fragment key={`${rootKey(root)}:${record}`}>
        {renderCatalogDom(root, record, { slotMode: "page", runtime: shaped })}
      </Fragment>
    </CatalogToastShapeContext.Provider>
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
