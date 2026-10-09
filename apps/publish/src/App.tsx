import { PublishErrorBoundary } from "./PublishErrorBoundary";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  buildRegistryFontFaceCss,
  setAssetUrlResolver,
  type FontRegistryV2,
} from "@composition/shared";
import { buildCodeCatalogLibrary } from "../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { CatalogPreviewSession } from "../../../packages/shared/src/catalog/runtime/catalogPreviewSession";
import {
  applyCatalogPreviewTheme,
  CatalogPreviewView,
  CatalogPreviewDataProvider,
  CatalogPreviewToasts,
  CatalogToastProvider,
  catalogPreviewRuntime,
  catalogPreviewLinkClick,
} from "../../../packages/shared/src/catalog/runtime/domView";
import type { EntryId } from "../../../packages/shared/src/catalog/document/types";
import { catalogThemeState } from "../../../packages/shared/src/catalog/runtime/theme";
import type { AssetRef } from "@composition/shared";
import { createPublishedSession } from "./catalogSession";
import {
  loadCatalogProjectFile,
  loadCatalogProjectUrl,
  type LoadedCatalogProject,
} from "./catalogProject";
import { PageNav } from "./components/PageNav";
import { usePublishDocumentLanguage, usePublishStrings } from "./i18n";
import "./styles/index.css";

const GOOGLE_FONTS_CSS_ID = "composition-publish-google-fonts";

function injectGoogleFontsCss() {
  if (document.getElementById(GOOGLE_FONTS_CSS_ID)) return;

  const families = [
    "Inter:wght@100;200;300;400;500;600;700;800;900",
    "Roboto:wght@100;300;400;500;700;900",
    "Open+Sans:wght@300;400;500;600;700;800",
    "Lora:wght@400;500;600;700",
    "Roboto+Mono:wght@100;200;300;400;500;600;700",
  ];

  const url = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;

  const link = document.createElement("link");
  link.id = GOOGLE_FONTS_CSS_ID;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

interface PublishedProject {
  session: CatalogPreviewSession;
  runtime: ReturnType<typeof catalogPreviewRuntime>;
  toast: { show: (message: string) => void };
  key: number;
  dispose: () => void;
}

function PublishedView({
  session,
  runtime,
  toast,
}: Pick<PublishedProject, "session" | "runtime" | "toast">) {
  const t = usePublishStrings();
  useSyncExternalStore(session.subscribe, session.getVersion);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    const click = catalogPreviewLinkClick(session);
    element?.addEventListener("click", click, true);
    const route = () => {
      if (location.hash.startsWith("#/"))
        session.navigateTo(location.hash.slice(1));
    };
    const resize = () => {
      if (session.pageId)
        session.receive({
          type: "CATALOG_VIEW",
          version: 1,
          pageId: session.pageId,
          breakpoint:
            innerWidth >= 1280
              ? "desktop"
              : innerWidth >= 768
                ? "tablet"
                : "mobile",
        });
    };
    route();
    resize();
    if (!location.hash && session.path)
      history.replaceState(null, "", `#${session.path}`);
    const unsubscribe = session.subscribe(() => {
      if (session.path) {
        const hash = `#${session.path}`;
        if (location.hash !== new URL(hash, location.href).hash)
          history.pushState(null, "", hash);
      }
    });
    window.addEventListener("hashchange", route);
    window.addEventListener("resize", resize);
    return () => {
      element?.removeEventListener("click", click, true);
      window.removeEventListener("hashchange", route);
      window.removeEventListener("resize", resize);
      unsubscribe();
    };
  }, [session]);
  const project = session.graph?.getEntry(session.graph.projectId);
  const pages =
    project?.kind === "project"
      ? project.pageIds.flatMap((id) => {
          const page = session.graph!.getEntry(id);
          return page?.kind === "page"
            ? [{ id: page.id, title: page.name, parent_id: null }]
            : [];
        })
      : [];
  return (
    <CatalogToastProvider session={session}>
      <CatalogPreviewToasts toast={toast} />
      <div className="publish-layout">
        <PageNav
          pages={pages}
          currentPageId={session.pageId ?? null}
          onPageChange={(id) => session.navigate(id as EntryId<"page">)}
        />
        <div ref={host} className="publish-content">
          {!pages.length ? (
            <p>{t("noPages")}</p>
          ) : (
            <CatalogPreviewDataProvider session={session}>
              <CatalogPreviewView session={session} runtime={runtime} />
            </CatalogPreviewDataProvider>
          )}
        </div>
      </div>
    </CatalogToastProvider>
  );
}

/** 독립 파일 runtime. Builder store나 부모 window의 편집 상태를 읽지 않는다. */
export function App() {
  usePublishDocumentLanguage();
  const t = usePublishStrings();
  const [view, setView] = useState<PublishedProject>();
  const session = view?.session;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const lifecycle = useRef({
    generation: 0,
    accepted: undefined as PublishedProject | undefined,
  });
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(
    async (source: string | File, optional = false) => {
      const own = ++lifecycle.current.generation;
      let project: LoadedCatalogProject | undefined;
      try {
        const library = await buildCodeCatalogLibrary();
        if (own !== lifecycle.current.generation) return;
        setLoading(true);
        setError(undefined);
        project =
          typeof source === "string"
            ? await loadCatalogProjectUrl(source, library)
            : await loadCatalogProjectFile(source, library);
        if (own !== lifecycle.current.generation) {
          project.dispose();
          return;
        }
        const next = createPublishedSession(project, library);
        const fontCss = project.extras.fontRegistry
          ? buildRegistryFontFaceCss(
              project.extras.fontRegistry as FontRegistryV2,
              (url) =>
                url.startsWith("asset:")
                  ? project!.resolver.resolveSync(url as AssetRef)
                  : url,
            )
          : "";
        applyCatalogPreviewTheme(catalogThemeState(next.graph!));
        const previous = lifecycle.current.accepted;
        const toast = { show: (_message: string) => {} };
        const runtime = catalogPreviewRuntime(next, toast);
        const loaded = project;
        const publication: PublishedProject = {
          session: next,
          runtime,
          toast,
          key: own,
          dispose: () => {
            runtime.dispose();
            loaded.dispose();
          },
        };
        lifecycle.current.accepted = publication;
        setAssetUrlResolver(project.resolver);
        let style = document.getElementById("composition-publish-custom-fonts");
        if (!style) {
          style = document.createElement("style");
          style.id = "composition-publish-custom-fonts";
          document.head.appendChild(style);
        }
        style.textContent = fontCss;
        setView(publication);
        previous?.dispose();
      } catch (cause) {
        project?.dispose();
        if (
          own === lifecycle.current.generation &&
          !(
            optional &&
            cause instanceof Error &&
            ["PROJECT_HTTP_404", "PROJECT_NOT_FOUND"].includes(cause.message)
          )
        )
          setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (own === lifecycle.current.generation) setLoading(false);
      }
    },
    [lifecycle],
  );
  useEffect(() => {
    injectGoogleFontsCss();
    const source = new URLSearchParams(location.search).get("project");
    const resources = lifecycle.current;
    let active = true;
    // StrictMode cleanup으로 취소된 초기 로드는 시작하지 않는다.
    queueMicrotask(() => {
      if (active) void load(source ?? "/manifest.json", !source);
    });
    return () => {
      active = false;
      ++resources.generation;
      resources.accepted?.dispose();
      resources.accepted = undefined;
      setAssetUrlResolver(null);
    };
  }, [load, lifecycle]);
  return (
    <div className="publish-app">
      {error && (
        <div role="alert" className="publish-error">
          <h1>{t("loadTitle")}</h1>
          <p>{error}</p>
          <button
            onClick={() => {
              setError(undefined);
              input.current?.click();
            }}
          >
            {t("retry")}
          </button>
        </div>
      )}
      {loading && <p role="status">{t("loadingProject")}</p>}
      {session ? (
        <PublishErrorBoundary
          key={view!.key}
          fallback={(failure) => (
            <div role="alert" className="publish-error">
              <h1>{t("loadTitle")}</h1>
              <p>{failure.message}</p>
              <button onClick={() => input.current?.click()}>
                {t("retry")}
              </button>
            </div>
          )}
        >
          <PublishedView
            session={session}
            runtime={view!.runtime}
            toast={view!.toast}
          />
        </PublishErrorBoundary>
      ) : (
        !loading && (
          <div
            className="publish-upload"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file) void load(file);
            }}
          >
            <p>{t("dropInstructions")}</p>
            <button onClick={() => input.current?.click()}>
              {t("chooseFile")}
            </button>
          </div>
        )
      )}
      <input
        ref={input}
        type="file"
        accept=".json,.zip"
        aria-label={t("uploadLabel")}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void load(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export default App;
