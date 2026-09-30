import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useParams } from "react-router";
import type { Key } from "react-aria-components/Collection";
import { releaseStaticShell } from "../../staticShell/staticShellRelease";
import {
  loadAllCustomFontsToSkia,
  loadBuiltinFontsToSkia,
} from "../fonts/loadCustomFontsToSkia";
import { useI18n } from "../../i18n";
import { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import { loadCatalogProductLibrary } from "../catalogRuntime/library";
import {
  catalogProjectIdOf,
  CatalogPublishUnavailableError,
  publishCatalogProject,
} from "../catalogRuntime/project";
import {
  CatalogWorkspaceProvider,
  useCatalogSaveStatus,
  useCatalogWorkspace,
} from "../catalogRuntime/react";
import { CatalogStorage, CatalogStorageError } from "../catalogRuntime/storage";
import { catalogTextMeasure } from "../catalogRuntime/textMeasure";
import { CatalogWorkspace } from "../catalogRuntime/workspace";
import { ToastContainer } from "../components";
import { PanelWorkspace } from "../layout";
import { useToastStore } from "../stores/toast";
import {
  CANVAS_BREAKPOINTS,
  CANVAS_VIEWPORT,
} from "../workspace/canvasBreakpoints";
import { CatalogCanvas } from "../workspace/canvas/catalog/CatalogCanvas";
import { initAllWasm } from "../workspace/canvas/wasm-bindings/init";
import { createLayoutEngine } from "../workspace/canvas/wasm-bindings/layoutBridge";
import { getCanvasKit } from "../workspace/canvas/skia/initCanvasKit";
import { BuilderHeader } from "./BuilderHeader";
import { BuilderViewport } from "./BuilderViewport";
import "../workspace/Workspace.css";

// 패널 등록 (side effect import — registerAllPanels() 자동 실행)
import "../panels";

type OpenState =
  | { kind: "opening" }
  | { kind: "open"; workspace: CatalogWorkspace; name: string }
  | { kind: "failed"; message: string };

/** ADR-248 Phase 4e-2: breakpoint 전환은 Canvas 상호작용 (4e-3) 에서 root 를 다시 만든다. */
const OPEN_BREAKPOINTS = CANVAS_BREAKPOINTS.filter(
  (item) => item.id === "desktop",
);
const OPEN_BREAKPOINT = new Set<Key>(["desktop"]);

/**
 * ADR-248 Phase 4e-2: the Builder entry. Opening a project = load its catalog document from the
 * new storage into a `CatalogWorkspace` (runtime · composition root · session · autosave) and draw
 * it with `CatalogCanvas`. A project of another format fails with a visible reason; nothing reads
 * the old stores or converts an old document.
 */
export function CatalogBuilderCore() {
  const { projectId: routeId = "" } = useParams<{ projectId: string }>();
  const { t } = useI18n();
  const [state, setState] = useState<OpenState>({ kind: "opening" });
  const [presented, setPresented] = useState(false);

  useLayoutEffect(() => {
    performance.mark("composition:builder.first-commit");
    releaseStaticShell();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let opened: CatalogWorkspace | undefined;
    (async () => {
      const projectId = catalogProjectIdOf(routeId);
      if (!projectId) throw new CatalogStorageError("PROJECT_NOT_FOUND");
      // Layout engine, CanvasKit and fonts first: the root measures text with CanvasKit paragraphs.
      await initAllWasm();
      getCanvasKit();
      await loadBuiltinFontsToSkia();
      await loadAllCustomFontsToSkia();
      const library = await loadCatalogProductLibrary();
      const storage = new CatalogStorage();
      const graph = new CatalogGraph(
        await storage.load(projectId, library),
        library,
      );
      if (cancelled) return;
      opened = new CatalogWorkspace(graph, storage, {
        engine: createLayoutEngine(),
        viewport: CANVAS_VIEWPORT.desktop,
        textMeasure: catalogTextMeasure,
        locale: navigator.language,
      });
      // Dev-only live harness handle (Playwright exercises edits before the panels move).
      if (import.meta.env.DEV)
        (window as unknown as Record<string, unknown>).__COMPOSITION_CATALOG__ =
          { workspace: opened, commands: await import("../../../../../packages/shared/src/catalog/commands") };
      const project = graph.getEntry(graph.projectId);
      setState({
        kind: "open",
        workspace: opened,
        name: project?.kind === "project" ? project.name : routeId,
      });
    })().catch((error: unknown) => {
      if (cancelled) return;
      console.error("[CatalogBuilder] open failed:", error);
      const code = error instanceof CatalogStorageError ? error.code : null;
      setState({
        kind: "failed",
        message:
          code === "UNSUPPORTED_PROJECT_FORMAT"
            ? t("catalogProject.formatUnsupported")
            : code === "PROJECT_NOT_FOUND"
              ? t("catalogProject.notFound")
              : t("catalogProject.openFailed", {
                  message:
                    error instanceof Error ? error.message : String(error),
                }),
      });
    });
    return () => {
      cancelled = true;
      opened?.dispose();
    };
  }, [routeId, t]);

  useLayoutEffect(() => {
    if (presented) performance.mark("composition:builder.presented");
  }, [presented]);

  const toastError = useCallback(
    (message: string) => {
      useToastStore.getState().showToast("error", message);
    },
    [],
  );
  // Preview · publish: no path opens a catalog project yet (ADR-248 §4.3) — an explicit failure.
  const handlePreview = useCallback(() => {
    try {
      publishCatalogProject();
    } catch (error) {
      if (!(error instanceof CatalogPublishUnavailableError)) throw error;
      toastError(t("catalogProject.publishUnavailable"));
    }
  }, [t, toastError]);
  const handleExchange = useCallback(
    () => toastError(t("catalogProject.exchangePending")),
    [t, toastError],
  );
  const handleSceneError = useCallback(
    (error: unknown) => {
      console.error("[CatalogBuilder] canvas scene:", error);
      toastError(
        t("catalogProject.sceneFailed", {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    },
    [t, toastError],
  );

  const workspace = state.kind === "open" ? state.workspace : undefined;
  const header = (
    <BuilderHeader
      projectId={routeId}
      projectName={state.kind === "open" ? state.name : undefined}
      breakpoint={OPEN_BREAKPOINT}
      breakpoints={OPEN_BREAKPOINTS}
      onBreakpointChange={() => {}}
      onPreview={handlePreview}
      onPlay={() => {}}
      onImportProject={handleExchange}
      onExportProject={handleExchange}
      onExportProjectJson={handleExchange}
      onConnectFolder={handleExchange}
      directoryLink={null}
      saveStatus={workspace ? <CatalogSaveStatusIndicator /> : null}
    />
  );
  const body = (
    <PanelWorkspace chrome={header}>
      <main className="workspace">
        {workspace && (
          <CatalogCanvas
            key={workspace.projectId}
            workspace={workspace}
            onFirstFrame={() => setPresented(true)}
            onError={handleSceneError}
          />
        )}
      </main>
    </PanelWorkspace>
  );

  return (
    <BuilderViewport className={presented ? "app" : "app builder-booting"}>
      {state.kind === "failed" ? (
        <div className="loading-overlay">
          <div className="loading-error" role="alert">
            <span>{state.message}</span>
          </div>
        </div>
      ) : (
        !presented && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="loading-status">
                <div className="loading-text">
                  {t("workspace.canvasInitializing")}
                </div>
              </div>
            </div>
          </div>
        )
      )}
      {workspace ? (
        <CatalogWorkspaceProvider workspace={workspace}>
          {body}
        </CatalogWorkspaceProvider>
      ) : (
        body
      )}
      <ToastContainer />
    </BuilderViewport>
  );
}

/** Save status of the open project; `failed` retries on press. */
function CatalogSaveStatusIndicator() {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const status = useCatalogSaveStatus();
  const label = {
    saved: t("catalogProject.saveSaved"),
    unsaved: t("catalogProject.saveUnsaved"),
    saving: t("catalogProject.saveSaving"),
    failed: t("catalogProject.saveFailed"),
    conflict: t("catalogProject.saveConflict"),
    unsupported: t("catalogProject.saveUnsupported"),
  }[status.state];
  return (
    <button
      type="button"
      className="catalog-save-status"
      data-save-state={status.state}
      aria-live="polite"
      disabled={status.state !== "failed"}
      onClick={() => void workspace.autosave.retry()}
    >
      {label}
    </button>
  );
}
