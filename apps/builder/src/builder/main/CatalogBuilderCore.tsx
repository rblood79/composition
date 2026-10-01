import { useBuilderChromeTheme } from "../hooks/useBuilderChromeTheme";
import { COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT } from "@composition/shared";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useParams } from "react-router";
import type { Key } from "react-aria-components/Collection";
import { releaseStaticShell } from "../../staticShell/staticShellRelease";
import {
  loadAllCustomFontsToSkia,
  loadBuiltinFontsToSkia,
} from "../fonts/loadCustomFontsToSkia";
import { useI18n } from "../../i18n";
import { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  BreakpointName,
  EntryId,
} from "../../../../../packages/shared/src/catalog/document/types";
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
import { CatalogSnapshots } from "../catalogRuntime/snapshots";
import { catalogTextMeasure } from "../catalogRuntime/textMeasure";
import { catalogBoundRows } from "../catalogRuntime/dataBinding";
import {
  catalogDataHistoryRecorder,
  catalogDocumentBindingCommitter,
} from "../catalogRuntime/dataHistory";
import { dataChangeEventLabel } from "../panels/history/historyEntryLabel";
import { catalogThemeState } from "../catalogRuntime/theme";
import { CatalogWorkspace } from "../catalogRuntime/workspace";
import { createCatalogDataUsageSource } from "../panels/datatable/usage/catalogDataUsageSource";
import { DataUsageSourceContext } from "../panels/datatable/usage/dataUsageSource";
import { createCatalogQuickConnectHost } from "../panels/datatable/usage/catalogQuickConnectHost";
import { QuickConnectHostContext } from "../panels/datatable/usage/quickConnectHost";
import { createCatalogDataVariablesHost } from "../panels/datatable/usage/catalogDataVariablesHost";
import { DataVariablesHostContext } from "../panels/datatable/usage/dataVariablesHost";
import {
  CatalogSnapshotHostContext,
  createCatalogSnapshotHost,
} from "../panels/history/catalogSnapshotHost";
import {
  AgentCommandConfirmDialogHost,
  CommandPalette,
  EditingSemanticsImpactDialogHost,
  ToastContainer,
} from "../components";
import { setAgentCommandHost } from "../../services/agent/agentCommandHost";
import { createCatalogAgentCommandHost } from "../catalogRuntime/agentHost";
import {
  createCatalogAiReadHost,
  createCatalogAiWriteHost,
} from "../catalogRuntime/aiHost";
import { setAiWriteHost } from "../../services/ai/aiWriteHost";
import { setAiReadHost } from "../../services/ai/aiReadHost";
import { PanelWorkspace } from "../layout";
import { toProjectVariableDefs, useDataStore } from "../stores/data";
import {
  setDataHistoryRecorder,
  setDocumentBindingCommitter,
  setDocumentVariableNamesReader,
} from "../stores/utils/dataChange";
import { catalogDocumentVariableNames } from "../catalogRuntime/dataVariables";
import { useToastStore } from "../stores/toast";
import {
  CANVAS_BREAKPOINTS,
  CANVAS_VIEWPORT,
} from "../workspace/canvasBreakpoints";
import {
  readRememberedBreakpoint,
  rememberBreakpoint,
} from "../workspace/canvas/catalog/catalogViewMemory";
import { CatalogCanvas } from "../workspace/canvas/catalog/CatalogCanvas";
import { CatalogCompareLayout } from "../workspace/canvas/catalog/CatalogPreviewFrame";
import { useCompareModeStore } from "../workspace/canvas/stores/compareMode";
import { initAllWasm } from "../workspace/canvas/wasm-bindings/init";
import { createLayoutEngine } from "../workspace/canvas/wasm-bindings/layoutBridge";
import { getCanvasKit } from "../workspace/canvas/skia/initCanvasKit";
import { BuilderHeader } from "./BuilderHeader";
import { BuilderViewport } from "./BuilderViewport";
import { useExecutionPolicyScheduler } from "../panels/datatable/hooks/useExecutionPolicyScheduler";
import { registerVariableOwnerPageSource } from "../stores/utils/variableOwnerMigration";
import { Button } from "@composition/shared/components";
import { watchCatalogStorageQuota } from "../catalogRuntime/storageQuota";
import {
  runCatalogAssetGcNow,
  scheduleCatalogAssetGc,
} from "../catalogRuntime/assetGc";
import { watchCatalogComponentEdits } from "../catalogRuntime/componentConfirm";
import { getDB } from "../../lib/db";
import { requestPersistenceOnce } from "../../lib/storage/storageProtection";
import {
  catalogViewportActions,
  useCatalogGlobalShortcuts,
} from "./useCatalogGlobalShortcuts";
import { useCatalogProjectFiles } from "./useCatalogProjectFiles";
import "../workspace/Workspace.css";

// 패널 등록 (side effect import — registerAllPanels() 자동 실행)
import "../panels";

type OpenState =
  | { kind: "opening" }
  | { kind: "open"; workspace: CatalogWorkspace; name: string }
  | { kind: "failed"; message: string };

/** ADR-248 Phase 4e-3: a breakpoint switch builds the composition root again (same runtime). */
const OPEN_BREAKPOINTS = [...CANVAS_BREAKPOINTS];
const noSubscription = () => () => {};

/**
 * ADR-248 Phase 4e-2: the Builder entry. Opening a project = load its catalog document from the
 * new storage into a `CatalogWorkspace` (runtime · composition root · session · autosave) and draw
 * it with `CatalogCanvas`. A project of another format fails with a visible reason; nothing reads
 * the old stores or converts an old document.
 */
export function CatalogBuilderCore() {
  const { projectId: routeId = "" } = useParams<{ projectId: string }>();
  const { t } = useI18n();
  // Builder UI theme (Settings · View menu) — also marks the Builder chrome as mounted.
  useBuilderChromeTheme();
  const [state, setState] = useState<OpenState>({ kind: "opening" });
  // An imported project file replaced the stored document: open it again (fresh history).
  const [openCount, setOpenCount] = useState(0);
  /** Boot progress (%) over the open path's stages (the old Builder's loading bar). */
  const [bootProgress, setBootProgress] = useState(0);
  const openPageRef = useRef<string | undefined>(undefined);
  const [presented, setPresented] = useState(false);

  useLayoutEffect(() => {
    performance.mark("composition:builder.first-commit");
    releaseStaticShell();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let opened: CatalogWorkspace | undefined;
    let restorePageSource: (() => void) | undefined;
    const stage = (progress: number) => {
      if (!cancelled) setBootProgress(progress);
    };
    (async () => {
      stage(5);
      const projectId = catalogProjectIdOf(routeId);
      if (!projectId) throw new CatalogStorageError("PROJECT_NOT_FOUND");
      // Layout engine, CanvasKit and fonts first: the root measures text with CanvasKit paragraphs.
      await initAllWasm();
      stage(30);
      getCanvasKit();
      await loadBuiltinFontsToSkia();
      stage(45);
      await loadAllCustomFontsToSkia();
      stage(55);
      const library = await loadCatalogProductLibrary();
      stage(65);
      const storage = new CatalogStorage();
      const graph = new CatalogGraph(
        await storage.load(projectId, library),
        library,
      );
      stage(75);
      // ADR-214 owner rule C (one page → it owns a page variable without `page_id`): the
      // document's pages, not the old store's (empty here).
      restorePageSource = registerVariableOwnerPageSource(() => {
        const project = graph.getEntry(graph.projectId);
        return project?.kind === "project" ? project.pageIds : [];
      });
      // Collections · API endpoints · variables stay in the data store (H1), keyed by the route id.
      try {
        await useDataStore.getState().initializeForProject(routeId);
      } catch (error) {
        console.error("[CatalogBuilder] data store init failed:", error);
      }
      if (cancelled) return;
      // The rest is the Canvas's first frame (the overlay goes when it is drawn).
      stage(90);
      opened = new CatalogWorkspace(graph, storage, {
        engine: createLayoutEngine(),
        viewport: CANVAS_VIEWPORT.desktop,
        viewportOf: (breakpoint) => CANVAS_VIEWPORT[breakpoint],
        textMeasure: catalogTextMeasure,
        locale: navigator.language,
        theme: catalogThemeState,
        // Bound collections show the data store's rows (H1 — rows never enter the document).
        root: {
          // The breakpoint the Builder last showed (a Builder-wide choice, like the old app).
          breakpoint: readRememberedBreakpoint(),
          // The old Canvas's sample: a bound list that grows with its rows draws the first 10.
          rowSample: COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT,
          rows: (binding, kind) =>
            catalogBoundRows(
              binding,
              [...useDataStore.getState().collections.values()],
              kind,
            ),
          // `{{ name }}` at defaults; project variables live in the data store (H1).
          state: {
            projectVariables: () =>
              toProjectVariableDefs(useDataStore.getState().variables),
          },
        },
      });
      // Dev-only live harness handle (Playwright exercises edits before the panels move).
      if (import.meta.env.DEV)
        (window as unknown as Record<string, unknown>).__COMPOSITION_CATALOG__ =
          {
            workspace: opened,
            commands:
              await import("../../../../../packages/shared/src/catalog/commands"),
          };
      const openPage = openPageRef.current;
      openPageRef.current = undefined;
      if (openPage && graph.getEntry(openPage)?.kind === "page")
        opened.session.setPage(openPage as EntryId<"page">);
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
      restorePageSource?.();
    };
  }, [routeId, openCount, t]);

  useLayoutEffect(() => {
    if (presented) performance.mark("composition:builder.presented");
  }, [presented]);

  const toastError = useCallback((message: string) => {
    useToastStore.getState().showToast("error", message);
  }, []);
  // Preview · publish: no path opens a catalog project yet (ADR-248 §4.3) — an explicit failure.
  const handlePreview = useCallback(() => {
    try {
      publishCatalogProject();
    } catch (error) {
      if (!(error instanceof CatalogPublishUnavailableError)) throw error;
      toastError(t("catalogProject.publishUnavailable"));
    }
  }, [t, toastError]);
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
  const viewportActions = useMemo(
    () =>
      workspace
        ? catalogViewportActions(workspace, (error) =>
            toastError(error instanceof Error ? error.message : String(error)),
          )
        : undefined,
    [workspace, toastError],
  );
  const reopen = useCallback((pageId: string | undefined) => {
    openPageRef.current = pageId;
    setState({ kind: "opening" });
    setOpenCount((count) => count + 1);
  }, []);
  const files = useCatalogProjectFiles({ workspace, routeId, reopen });
  // History snapshots (4e-6-32): one list per project route, kept across a reopen (a restore).
  const snapshots = useMemo(
    () => new CatalogSnapshots(catalogProjectIdOf(routeId) ?? routeId),
    [routeId],
  );
  const snapshotHost = useMemo(
    () =>
      workspace
        ? createCatalogSnapshotHost(workspace, snapshots, reopen)
        : null,
    [workspace, snapshots, reopen],
  );
  const snapshotActions = useMemo(
    () =>
      snapshotHost
        ? {
            canCreate: () => snapshots.canCreateUser(),
            create: () => {
              void snapshotHost.create().catch((error: unknown) => {
                console.warn("[snapshots] create refused:", error);
              });
            },
          }
        : undefined,
    [snapshotHost, snapshots],
  );
  // The restored snapshot stays "active" until the reopened document's first edit.
  useEffect(() => {
    if (!workspace) return;
    const { history } = workspace;
    const clear = () => {
      if (history.getSnapshot().labels.length > 0) snapshots.markRestored(null);
    };
    clear();
    return history.subscribe(clear);
  }, [workspace, snapshots]);
  useCatalogGlobalShortcuts(workspace, handleSceneError);
  // ADR-235 Phase 5 on the catalog storage: a save over the quota clears the caches and retries
  // once, then tells the user; the first save asks the browser to keep the site's storage.
  useEffect(() => {
    if (!workspace) return;
    return watchCatalogStorageQuota(workspace.autosave, {
      clearCaches: async () => (await getDB()).clearCaches(),
      notifyQuotaExceeded: () =>
        useToastStore
          .getState()
          .showToast("error", t("header.storageQuotaExceeded"), {
            duration: 12000,
          }),
      requestPersistence: () => void requestPersistenceOnce(),
    });
  }, [workspace, t]);
  // ADR-235 asset GC on the catalog storage (idle, once a day): the open workspace's documents,
  // history and clipboard are the memory roots.
  useEffect(() => {
    if (!workspace) return;
    const memory = () => workspace.assetRootPayloads();
    const cancel = scheduleCatalogAssetGc(memory);
    if (!import.meta.env.DEV) return cancel;
    const handle = window as unknown as {
      __composition_ASSET_GC__?: (options?: { graceMs?: number }) => unknown;
    };
    handle.__composition_ASSET_GC__ = (options) =>
      runCatalogAssetGcNow(memory, options);
    return () => {
      cancel();
      delete handle.__composition_ASSET_GC__;
    };
  }, [workspace]);
  // The old origin edit gate: the first edit of a component's template in its edit view asks
  // (Cancel takes it back).
  useEffect(() => {
    if (!workspace) return;
    return watchCatalogComponentEdits(workspace);
  }, [workspace]);
  // ADR-218 interval policy: data-store collections poll their linked endpoint (rows reach the
  // Canvas through the data-store subscription below — `refreshRows`).
  useExecutionPolicyScheduler();
  // Agent commands (the AI panel's run_command, the DEV `window.__compositionAgent`) and the
  // header menu run over this workspace (ADR-248 4e-5).
  useEffect(() => {
    if (!workspace) return;
    return setAgentCommandHost(
      createCatalogAgentCommandHost(workspace, handleSceneError),
    );
  }, [workspace, handleSceneError]);
  // The AI panel's tools, compiler and suggestions read and write this workspace (ADR-248 4e-5).
  useEffect(() => {
    if (!workspace) return;
    const offRead = setAiReadHost(createCatalogAiReadHost(workspace));
    const offWrite = setAiWriteHost(createCatalogAiWriteHost(workspace));
    return () => {
      offRead();
      offWrite();
    };
  }, [workspace]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let uninstall: (() => void) | null = null;
    let cancelled = false;
    void import("../../services/agent/devAgentEntry").then((m) => {
      if (!cancelled) uninstall = m.installDevAgentEntry();
    });
    return () => {
      cancelled = true;
      uninstall?.();
    };
  }, []);
  // A collection's rows changed (edit, load, delete): its bound collections draw them again.
  useEffect(() => {
    if (!workspace) return;
    workspace.refreshRows();
    return useDataStore.subscribe(
      (store) => store.collections,
      (next, previous) => {
        const changed = [
          ...new Set([...next.keys(), ...previous.keys()]),
        ].filter((id) => next.get(id) !== previous.get(id));
        if (!changed.length) return;
        try {
          workspace.refreshRows(changed);
        } catch (error) {
          console.error("[CatalogBuilder] row refresh failed:", error);
        }
      },
    );
  }, [workspace]);
  // Project variables changed (add, rename, default): the `{{ }}` readers resolve again.
  useEffect(() => {
    if (!workspace) return;
    return useDataStore.subscribe(
      (store) => store.variables,
      () => {
        try {
          workspace.refreshState();
        } catch (error) {
          console.error("[CatalogBuilder] state refresh failed:", error);
        }
      },
    );
  }, [workspace]);
  // Recorded data changes join the document's single history while this project is open.
  useEffect(() => {
    if (!workspace) return;
    setDataHistoryRecorder(
      catalogDataHistoryRecorder(
        workspace,
        useDataStore.getState().applyDataChange,
        (payload) => dataChangeEventLabel(payload, t),
      ),
    );
    // `bind_element` (an approved AI data proposal) binds the document's node, one entry.
    setDocumentBindingCommitter(
      catalogDocumentBindingCommitter(
        workspace,
        useDataStore.getState().applyDataChange,
        (payload) => dataChangeEventLabel(payload, t),
      ),
    );
    setDocumentVariableNamesReader(() =>
      catalogDocumentVariableNames(workspace.runtime.graph),
    );
    return () => {
      setDataHistoryRecorder(null);
      setDocumentBindingCommitter(null);
      setDocumentVariableNamesReader(null);
    };
  }, [t, workspace]);
  const quickConnect = useMemo(
    () =>
      workspace
        ? createCatalogQuickConnectHost(
            workspace,
            {
              apply: (change, options) =>
                useDataStore.getState().applyDataChange(change, options),
              collection: (id) => useDataStore.getState().collections.get(id),
            },
            (name) => t("history.entryDataCollectionCreate", { name }),
          )
        : null,
    [t, workspace],
  );
  const dataVariables = useMemo(
    () =>
      workspace
        ? createCatalogDataVariablesHost(
            workspace,
            {
              apply: (change, options) =>
                useDataStore.getState().applyDataChange(change, options),
            },
            t("datatable.variableMigrateToPage"),
          )
        : null,
    [t, workspace],
  );
  const dataUsage = useMemo(
    () => (workspace ? createCatalogDataUsageSource(workspace) : null),
    [workspace],
  );
  const breakpoint = useSyncExternalStore(
    workspace?.session.subscribe ?? noSubscription,
    () => workspace?.session.getSnapshot().breakpoint ?? "desktop",
  );
  const selectedBreakpoint = useMemo(
    () => new Set<Key>([breakpoint]),
    [breakpoint],
  );
  const handleBreakpointChange = useCallback(
    (key: Key) => {
      if (!workspace) return;
      workspace.setBreakpoint(key as BreakpointName);
      rememberBreakpoint(key as BreakpointName);
    },
    [workspace],
  );
  const header = (
    <BuilderHeader
      projectId={routeId}
      projectName={state.kind === "open" ? state.name : undefined}
      breakpoint={selectedBreakpoint}
      breakpoints={OPEN_BREAKPOINTS}
      onBreakpointChange={handleBreakpointChange}
      onPreview={handlePreview}
      onPlay={() => {}}
      onImportProject={files.importFile}
      onExportProject={files.exportZip}
      onExportProjectJson={files.exportJson}
      onConnectFolder={files.connectFolder}
      snapshotActions={snapshotActions}
      directoryLink={files.directoryLink}
      saveStatus={workspace ? <CatalogSaveStatusIndicator /> : null}
      viewportActions={viewportActions}
    />
  );
  // Compare Mode: the Preview iframe beside the Canvas (ADR-248 4e-6).
  const compareMode = useCompareModeStore((store) => store.isCompareMode);
  const canvas = workspace && (
    <CatalogCanvas
      key={workspace.projectId}
      workspace={workspace}
      onFirstFrame={() => setPresented(true)}
      onError={handleSceneError}
    />
  );
  const body = (
    <PanelWorkspace chrome={header}>
      <main className="workspace">
        {workspace &&
          (compareMode ? (
            <CatalogCompareLayout workspace={workspace} canvas={canvas} />
          ) : (
            canvas
          ))}
      </main>
    </PanelWorkspace>
  );

  return (
    <BuilderViewport className={presented ? "app" : "app builder-booting"}>
      {state.kind === "failed" ? (
        <div className="loading-overlay">
          <div className="loading-error" role="alert">
            <span>{state.message}</span>
            <Button
              variant="primary"
              size="sm"
              onPress={() => reopen(openPageRef.current)}
            >
              {t("canvas.reload")}
            </Button>
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
                <div className="loading-progress">
                  <progress
                    className="loading-progress-native"
                    aria-label={t("workspace.canvasInitializing")}
                    max={100}
                    value={bootProgress}
                  />
                  <div
                    className="loading-progress-fill"
                    aria-hidden
                    style={{ transform: `scaleX(${bootProgress / 100})` }}
                  />
                </div>
                {/* A new node per value: centered digits do not shift the layout (ADR-247 HC2). */}
                <div key={bootProgress} className="loading-percent">
                  {bootProgress}%
                </div>
              </div>
            </div>
          </div>
        )
      )}
      {workspace ? (
        <CatalogWorkspaceProvider workspace={workspace}>
          <DataUsageSourceContext.Provider value={dataUsage}>
            <QuickConnectHostContext.Provider value={quickConnect}>
              <DataVariablesHostContext.Provider value={dataVariables}>
                <CatalogSnapshotHostContext.Provider value={snapshotHost}>
                  {body}
                </CatalogSnapshotHostContext.Provider>
              </DataVariablesHostContext.Provider>
            </QuickConnectHostContext.Provider>
          </DataUsageSourceContext.Provider>
        </CatalogWorkspaceProvider>
      ) : (
        body
      )}
      <AgentCommandConfirmDialogHost />
      {/* Detach · dissolve · the first edit of a component with instances (the old dialog). */}
      <EditingSemanticsImpactDialogHost />
      {/* ⌘/ — lists the commands the catalog Builder registered (the header menu's own list). */}
      <CommandPalette />
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
