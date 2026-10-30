import { COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT } from "@composition/shared";
import { setBorderSnapRatio } from "@composition/rendering";
import { Button } from "@composition/shared/components";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Key } from "react-aria-components/Collection";
import { useParams } from "react-router";
import { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  BreakpointName,
  EntryId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { useI18n } from "../../i18n";
import { getDB } from "../../lib/db";
import { requestPersistenceOnce } from "../../lib/storage/storageProtection";
import { setAgentCommandHost } from "../../services/agent/agentCommandHost";
import { setAiReadHost } from "../../services/ai/aiReadHost";
import { setAiWriteHost } from "../../services/ai/aiWriteHost";
import { releaseStaticShell } from "../../staticShell/staticShellRelease";
import { createCatalogAgentCommandHost } from "../catalogRuntime/agentHost";
import {
  createCatalogAiReadHost,
  createCatalogAiWriteHost,
} from "../catalogRuntime/aiHost";
import {
  runCatalogAssetGcNow,
  scheduleCatalogAssetGc,
} from "../catalogRuntime/assetGc";
import {
  catalogBuilderThemeState,
  subscribeSystemColorScheme,
} from "../catalogRuntime/builderTheme";
import { watchCatalogComponentEdits } from "../catalogRuntime/componentConfirm";
import { catalogBoundRows } from "../catalogRuntime/dataBinding";
import {
  catalogCollectionTables,
  catalogDataProjectId,
  catalogProjectVariableDefs,
} from "../catalogRuntime/catalogDataRead";
import { loadCatalogProductLibrary } from "../catalogRuntime/library";
import { catalogProjectIdOf } from "../catalogRuntime/project";
import { catalogPropertySelection } from "../catalogRuntime/propertySelection";
import {
  CatalogWorkspaceProvider,
  useCatalogSaveStatus,
  useCatalogWorkspace,
} from "../catalogRuntime/react";
import { CatalogSnapshots } from "../catalogRuntime/snapshots";
import { CatalogStorage, CatalogStorageError } from "../catalogRuntime/storage";
import { watchCatalogStorageQuota } from "../catalogRuntime/storageQuota";
import { catalogTextMeasure } from "../catalogRuntime/textMeasure";
import { CatalogWorkspace } from "../catalogRuntime/workspace";
import { ToastContainer } from "../components/feedback/ToastContainer";
import { AgentCommandConfirmDialogHost } from "../components/overlay/AgentCommandConfirmDialog";
import { CommandPalette } from "../components/overlay/CommandPalette";
import { EditingSemanticsImpactDialogHost } from "../components/overlay/EditingSemanticsImpactDialog";
import { ComponentNameDialogHost } from "../components/overlay/ComponentNameDialog";
import { PropertySelectionContext } from "../components/property/propertySelection";
import {
  loadAllCustomFontsToSkia,
  loadBuiltinFontsToSkia,
  syncCustomFontsWithSkia,
} from "../fonts/loadCustomFontsToSkia";
import { useBuilderChromeTheme } from "../hooks/useBuilderChromeTheme";
import { PanelWorkspace } from "../layout/PanelWorkspace";
import { useExecutionPolicyScheduler } from "../panels/datatable/hooks/useExecutionPolicyScheduler";
import { createCatalogDataUsageSource } from "../panels/datatable/usage/catalogDataUsageSource";
import { createCatalogDataVariablesHost } from "../panels/datatable/usage/catalogDataVariablesHost";
import { createCatalogQuickConnectHost } from "../panels/datatable/usage/catalogQuickConnectHost";
import { DataUsageSourceContext } from "../panels/datatable/usage/dataUsageSource";
import { DataVariablesHostContext } from "../panels/datatable/usage/dataVariablesHost";
import { QuickConnectHostContext } from "../panels/datatable/usage/quickConnectHost";
import {
  CatalogSnapshotHostContext,
  createCatalogSnapshotHost,
} from "../panels/history/catalogSnapshotHost";
import { dataChangeEventLabel } from "../panels/history/dataChangeEventLabel";
import { useDataStore } from "../stores/data";
import {
  changedRuntimeCollectionIds,
  formulaCollectionIds,
} from "../catalogRuntime/rowsRefresh";
import { onFormulaEngineLoaded } from "../../../../../packages/shared/src/collections/formula/engine";
import { notifyEditRefusal } from "../catalogRuntime/operationNotice";
import { useToastStore } from "../stores/toast";
import { CatalogCanvas } from "../workspace/canvas/catalog/CatalogCanvas";
import { CatalogCompareLayout } from "../workspace/canvas/catalog/CatalogPreviewFrame";
import {
  readRememberedBreakpoint,
  rememberBreakpoint,
} from "../workspace/canvas/catalog/catalogViewMemory";
import { getCanvasKit } from "../workspace/canvas/skia/initCanvasKit";
import { useCompareModeStore } from "../workspace/canvas/stores/compareMode";
import { useViewportSyncStore } from "../workspace/canvas/stores/viewportSync";
import { initAllWasm } from "../workspace/canvas/wasm-bindings/init";
import { createLayoutEngine } from "../workspace/canvas/wasm-bindings/layoutBridge";
import {
  CANVAS_BREAKPOINTS,
  CANVAS_VIEWPORT,
} from "../workspace/canvasBreakpoints";
import { BuilderHeader } from "./BuilderHeader";
import { BuilderViewport } from "./BuilderViewport";
import { reloadIfStaleDeploy } from "./staleDeployRecovery";
import {
  catalogViewportActions,
  openPageFrame,
  useCatalogGlobalShortcuts,
} from "./useCatalogGlobalShortcuts";
import { useCatalogProjectFiles } from "./useCatalogProjectFiles";
// 패널 공용 CSS (panel-system · inspector-layout · form-controls · list-group) — 구 BuilderCore 는
// `../components` barrel 의 side effect 로 실었다 (4e-7-1 barrel 정리로 끊겼던 경로).
import "../components/styles";
import "../workspace/Workspace.css";

// 패널 등록 (모듈 로드가 registerAllPanels() 를 실행) · 화면 밖 패널 idle 선로드
import { preloadOffscreenPanels } from "../panels/core/panelConfigs";

/** The zoom menu while the project is still opening (no page frames yet). */
const NO_VIEWPORT_ACTIONS = { fit() {}, fill() {}, alignPages() {} };
/** The header menu's snapshot item while the project is still opening (nothing to snapshot). */
const NO_SNAPSHOT_ACTIONS = { canCreate: () => false, create() {} };

type OpenState =
  | { kind: "opening" }
  | {
      kind: "open";
      workspace: CatalogWorkspace;
      name: string;
      /** The API rows the root resolved its bound rows from (`rows` option — ADR-286). */
      rowsSource: ReadonlyMap<string, Record<string, unknown>[]>;
    }
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
  const [requestedPage, setRequestedPage] = useState<string | undefined>(
    undefined,
  );
  useLayoutEffect(() => {
    openPageRef.current = requestedPage;
  }, [requestedPage, openCount]);
  const [presented, setPresented] = useState(false);

  // The open effect reads the latest `t` here: with `t` in its deps a language switch disposed the
  // workspace and opened the project again (undo stack, page and selection lost — audit M2).
  const tRef = useRef(t);
  useLayoutEffect(() => {
    tRef.current = t;
  }, [t]);

  useLayoutEffect(() => {
    performance.mark("composition:builder.first-commit");
    releaseStaticShell();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let opened: CatalogWorkspace | undefined;
    // `mark`: a boot segment's end as User Timing (`composition:builder.boot.<mark>`), read by the
    // boot latency harness (ADR-244 Phase 0) together with `first-commit` and `presented`.
    const stage = (progress: number, mark?: string) => {
      if (mark) performance.mark(`composition:builder.boot.${mark}`);
      if (!cancelled) setBootProgress(progress);
    };
    (async () => {
      stage(5);
      const projectId = catalogProjectIdOf(routeId);
      if (!projectId) throw new CatalogStorageError("PROJECT_NOT_FOUND");
      // Layout engine, CanvasKit and fonts first: the root measures text with CanvasKit paragraphs.
      await initAllWasm();
      stage(30, "wasm");
      getCanvasKit();
      await loadBuiltinFontsToSkia();
      stage(45);
      await loadAllCustomFontsToSkia();
      stage(55, "fonts");
      const library = await loadCatalogProductLibrary();
      stage(65);
      const storage = new CatalogStorage();
      const graph = new CatalogGraph(
        await storage.load(projectId, library),
        library,
      );
      stage(75);
      // A route change meanwhile: nothing for this run (the cleanup already ran — audit L2).
      if (cancelled) return;
      // ADR-286: collections · API endpoints · variables are the document's entries; the data
      // store projects them once the workspace is open (`bindCatalogDataStore`). Only the API rows
      // cache (ADR-218) is the store's — a project switch starts without the last one's.
      useDataStore.getState().reset();
      // The rest is the Canvas's first frame (the overlay goes when it is drawn).
      stage(90, "document");
      // The API rows the root is about to resolve: the mount refreshes only collections whose rows
      // change after this read (a second whole resolve of the bound pages was ~1/4 of the first
      // frame).
      const rowsSource = useDataStore.getState().runtimeRows;
      const snapRatio = window.devicePixelRatio || 1;
      setBorderSnapRatio(snapRatio);
      opened = new CatalogWorkspace(graph, storage, {
        engine: createLayoutEngine(),
        viewport: CANVAS_VIEWPORT.desktop,
        viewportOf: (breakpoint) => CANVAS_VIEWPORT[breakpoint],
        textMeasure: catalogTextMeasure,
        locale: navigator.language,
        theme: catalogBuilderThemeState,
        // Bound collections show the data store's rows (H1 — rows never enter the document).
        root: {
          // The breakpoint the Builder last showed (a Builder-wide choice, like the old app).
          breakpoint: readRememberedBreakpoint(),
          // ADR-274: `columns: "auto"` derives from the monitor width — the first layout already
          //   has it (the Canvas's frame check then changes nothing).
          screenWidth: window.screen.width,
          // Border widths snap to the display's device pixels, as the Preview's (`ClampLineWidth`) —
          //   the engine lays them out at this ratio and the Canvas draws them at it.
          devicePixelRatio: snapRatio,
          // The old Canvas's sample: a bound list that grows with its rows draws the first 10.
          rowSample: COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT,
          // ADR-286: the document's collections, with the API rows the store caches.
          rows: (binding, kind) =>
            catalogBoundRows(binding, catalogCollectionTables(graph), kind),
          // `{{ name }}` at defaults; project variables are the document's (ADR-286).
          state: {
            projectVariables: () => catalogProjectVariableDefs(graph),
          },
        },
      });
      performance.mark("composition:builder.boot.workspace");
      // Live harness handle (Playwright): dev, or a production build made for the G5 paired
      // measurement (`VITE_COMPOSITION_HARNESS=1`; a normal build drops this branch).
      if (
        import.meta.env.DEV ||
        import.meta.env.VITE_COMPOSITION_HARNESS === "1"
      )
        (window as unknown as Record<string, unknown>).__COMPOSITION_CATALOG__ =
          {
            workspace: opened,
            commands:
              await import("../../../../../packages/shared/src/catalog/commands"),
            palette: await import("../catalogRuntime/paletteInsert"),
            // ADR-270 Phase 0: the `asset:` image fixture uploads through the Fill panel's writer.
            assets: await import("../../lib/assets/assetWriter"),
          };
      // The cleanup may have disposed `opened` during the awaits above.
      if (cancelled) return;
      const openPage = openPageRef.current;
      openPageRef.current = undefined;
      if (openPage && graph.getEntry(openPage)?.kind === "page")
        opened.session.setPage(openPage as EntryId<"page">);
      const project = graph.getEntry(graph.projectId);
      setState({
        kind: "open",
        workspace: opened,
        name: project?.kind === "project" ? project.name : routeId,
        rowsSource,
      });
      // ADR-242 HC3 — the offscreen lazy panels' chunks at idle (an opened one skips the Suspense
      // reveal delay).
      preloadOffscreenPanels();
    })().catch(async (error: unknown) => {
      if (cancelled) return;
      console.error("[CatalogBuilder] open failed:", error);
      const code = error instanceof CatalogStorageError ? error.code : null;
      // ADR-244: workspace 를 열기 전 실패 (wasm · 부팅 chunk 404) 가 옛 배포 탭이면 새로고침 한 번으로
      // 새 빌드를 받는다 — 편집 전이라 잃는 것이 없다. 저장소 오류는 배포와 무관하다.
      if (!code && !opened && (await reloadIfStaleDeploy())) return;
      if (cancelled) return;
      const t = tRef.current;
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
  }, [routeId, openCount]);

  useLayoutEffect(() => {
    if (presented) performance.mark("composition:builder.presented");
  }, [presented]);

  const toastError = useCallback((message: string) => {
    useToastStore.getState().showToast("error", message);
  }, []);
  const handleSceneError = useCallback(
    (error: unknown) => {
      if (notifyEditRefusal(error)) return;
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
  const rowsSource = state.kind === "open" ? state.rowsSource : undefined;
  const viewportActions = useMemo(
    () =>
      workspace
        ? catalogViewportActions(workspace, (error) =>
            toastError(error instanceof Error ? error.message : String(error)),
          )
        : NO_VIEWPORT_ACTIONS,
    [workspace, toastError],
  );
  const reopen = useCallback((pageId: string | undefined) => {
    setRequestedPage(pageId);
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
            subscribe: snapshots.subscribe,
          }
        : NO_SNAPSHOT_ACTIONS,
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
  // The open page's frame is the canvas size an auto page body shows in Styles (Size W/H) — the
  // old store kept it per breakpoint; here it follows the page, its breakpoint and each step.
  useEffect(() => {
    if (!workspace) return;
    const sync = () => {
      const frame = openPageFrame(workspace);
      const viewport = useViewportSyncStore.getState();
      if (
        frame &&
        (viewport.canvasSize.width !== frame.width ||
          viewport.canvasSize.height !== frame.height)
      )
        viewport.setCanvasSize({ width: frame.width, height: frame.height });
    };
    sync();
    const stops = [
      workspace.session.subscribe(sync),
      workspace.subscribeRoot(sync),
      workspace.runtime.subscribeSteps(sync),
    ];
    return () => stops.forEach((stop) => stop());
  }, [workspace]);
  // A `system` theme follows the OS appearance (the old store's `resolveSkiaTheme` read it live).
  useEffect(
    () =>
      workspace && subscribeSystemColorScheme(() => workspace.refreshTheme()),
    [workspace],
  );
  // A custom font uploaded or removed mid-session reaches the Canvas at once (the old SkiaCanvas's
  // `composition:custom-fonts-updated` → `syncCustomFontsWithSkia` + relayout).
  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    const onFontsUpdated = () => {
      void syncCustomFontsWithSkia()
        .then(() => {
          if (cancelled) return;
          workspace.refreshFonts();
          window.dispatchEvent(new CustomEvent("composition:fonts-ready"));
        })
        .catch((error) =>
          console.warn("[CatalogBuilder] custom font sync failed:", error),
        );
    };
    window.addEventListener("composition:custom-fonts-updated", onFontsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(
        "composition:custom-fonts-updated",
        onFontsUpdated,
      );
    };
  }, [workspace]);
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
  // ADR-286: the data store projects the document's data entries and writes them as document
  // commands (one history step · one save); then the API rows cache of this project loads. The
  // projection and its write path load after the first paint (the Canvas reads the document —
  // `catalogDataRead`; every data editor is a lazy panel).
  useEffect(() => {
    if (!workspace) return;
    let unbind: (() => void) | null = null;
    let cancelled = false;
    void import("../catalogRuntime/catalogDataStore")
      .then(({ bindCatalogDataStore }) => {
        if (cancelled) return;
        unbind = bindCatalogDataStore(workspace, (payload) =>
          dataChangeEventLabel(payload, t),
        );
        return useDataStore
          .getState()
          .initializeForProject(catalogDataProjectId(workspace.runtime.graph));
      })
      .catch((error: unknown) =>
        console.error("[CatalogBuilder] data store init failed:", error),
      );
    return () => {
      cancelled = true;
      unbind?.();
    };
  }, [t, workspace]);
  // API rows changed (a run, the cache, a delete): the collections they fill draw them again. A
  // definition change is a document step — its consume plan redraws (ADR-286 R8). The root read
  // the rows it was opened with (`rowsSource`): on mount only what changed since is refreshed
  // (2026-10-21 — an unconditional refresh resolved every bound page root a second time).
  useEffect(() => {
    if (!workspace || !rowsSource) return;
    const since = changedRuntimeCollectionIds(
      useDataStore.getState().runtimeRows,
      rowsSource,
      useDataStore.getState().collections,
    );
    if (since.length) workspace.refreshRows(since);
    // (ADR-291 — computed cells read before the formula engine loaded were `null`: read again —
    // the tables from the document, the store's projection may not have loaded yet.)
    const unsubscribeFormula = onFormulaEngineLoaded(() => {
      const computed = formulaCollectionIds(
        catalogCollectionTables(workspace.runtime.graph),
      );
      if (!computed.length) return;
      try {
        workspace.refreshRows(computed);
      } catch (error) {
        console.error("[CatalogBuilder] formula refresh failed:", error);
      }
    });
    const unsubscribeRows = useDataStore.subscribe(
      (store) => store.runtimeRows,
      (next, previous) => {
        const changed = changedRuntimeCollectionIds(
          next,
          previous,
          useDataStore.getState().collections,
        );
        if (!changed.length) return;
        try {
          workspace.refreshRows(changed);
        } catch (error) {
          console.error("[CatalogBuilder] row refresh failed:", error);
        }
      },
    );
    return () => {
      unsubscribeFormula();
      unsubscribeRows();
    };
  }, [workspace, rowsSource]);
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
  const propertySelection = useMemo(
    () => (workspace ? catalogPropertySelection(workspace) : null),
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
      onPreview={files.openPublish}
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
  // Compare Mode: Preview와 Canvas를 같은 viewport에서 좌우로 드러낸다.
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
              size="S"
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
                  <PropertySelectionContext.Provider value={propertySelection!}>
                    {body}
                  </PropertySelectionContext.Provider>
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
      {/* ADR-279: the name a new component gets (Create component). */}
      <ComponentNameDialogHost />
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
