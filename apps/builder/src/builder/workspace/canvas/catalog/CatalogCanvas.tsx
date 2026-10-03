import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
} from "../../../hooks/useKeyboardShortcutsRegistry";
import { useActiveScope } from "../../../hooks/useActiveScope";
import {
  CatalogCanvasGestures,
  type CatalogSpacingClick,
} from "../../../catalogRuntime/canvasGesture";
import { catalogCanvasMenuItems } from "../../../catalogRuntime/canvasMenu";
import { catalogMenuHost } from "../../../catalogRuntime/shortcuts";
import { catalogPageDropCommand } from "../../../catalogRuntime/canvasPage";
import { catalogComponentRole } from "../../../catalogRuntime/componentActions";
import { catalogLeafRecords, catalogSlotMarks } from "./catalogChrome";
import {
  notifyNestingRejected,
  showNestingRelocatedToast,
} from "../interaction/nestingToast";
import { CatalogCanvasPicking } from "../../../catalogRuntime/canvasPick";
import { CatalogCanvasScene } from "../../../catalogRuntime/canvasScene";
import { catalogTextKey } from "../../../catalogRuntime/canvasText";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { DotBackground } from "../../components/DotBackground";
import { ContextMenuOverlay } from "../../../components/overlay/contextMenu/ContextMenuOverlay";
import type {
  ContextMenuItem,
  ContextMenuRequest,
} from "../../../components/overlay/contextMenu/types";
import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import { watchContextLoss } from "../skia/createSurface";
import { destroyAllSkiaCaches } from "../skia/disposable";
import { skiaFontManager } from "../skia/fontManager";
import { setEditingElementId } from "../skia/nodeRendererState";
import {
  createFrameScheduler,
  subscribeCanvasFrames,
} from "../skia/frameScheduler";
import { getCanvasKit } from "../skia/initCanvasKit";
import { SkiaRenderer } from "../skia/SkiaRenderer";
import { getRegistryVersion } from "../skia/useSkiaNode";
import { ViewportControlBridge } from "../viewport";
import { getViewportController } from "../viewport/ViewportController";
import { viewportState } from "../viewport/viewportState";
import { animatePanTo, cancelPanAnimation } from "../viewport/animatePan";
import { useViewportSyncStore } from "../stores";
import { useCompareModeStore } from "../stores/compareMode";
import { catalogUnionRect, fitCatalogPageFrame } from "./catalogViewport";
import { catalogBadgeAt, createCatalogBadges } from "./catalogBadges";
import { CatalogSpacingInput } from "./CatalogSpacingInput";
import { CatalogActionBar } from "./CatalogActionBar";
import { catalogMenuView } from "./catalogMenuView";
import type { CatalogOverflowTree } from "../../../catalogRuntime/canvasOverflow";
import type { DataBadgeBounds } from "../skia/bindingBadgeRenderer";
import { useDataStore } from "../../../stores/data";
import { useAIVisualFeedbackStore } from "../../../stores/aiVisualFeedback";
import { getSkiaNode } from "../skia/useSkiaNode";
import { dismissCanvasSelectionPanels } from "../../../layout/panelWorkspaceVisibility";
import { useDataTableEditorStore } from "../../../panels/datatable/stores/dataTableEditorStore";
import {
  bindCatalogCamera,
  openCatalogCameraMemory,
} from "./catalogViewMemory";
import { catalogAutoColumns } from "../../../catalogRuntime/pageLayoutSettings";
import {
  catalogDefinitionTitle,
  isLibraryOrigin,
} from "../../../catalogRuntime/originView";
import { readCanvasRailInset } from "../viewport/canvasChromeInset";
import { PageHeaderLayer } from "../overlay/pageHeader/PageHeaderLayer";
import { publishCanvasFramePresentation } from "../canvasFramePresentation";
import { getPagePositionPresentationSnapshot } from "../interaction/pagePositionPresentation";
import type { PageHeaderFrame } from "../overlay/pageHeader/pageHeaderGeometry";
import {
  renameDefinition,
  updatePage,
} from "../../../../../../../packages/shared/src/catalog/commands";
import type { EntryId } from "../../../../../../../packages/shared/src/catalog/document/types";

/**
 * Page header frames (ADR-221): each page's laid-out frame and name — in the definition edit view,
 * the definition's frame and name.
 */
function catalogHeaderFrames(
  workspace: CatalogWorkspace,
  onlyPage?: string,
): PageHeaderFrame[] {
  const graph = workspace.runtime.graph;
  const frames: PageHeaderFrame[] = [];
  for (const [id, rect] of workspace.root.pageFrameRects()) {
    if (onlyPage && id !== onlyPage) continue;
    const entry = graph.getEntry(id);
    if (entry?.kind === "page" || entry?.kind === "definition")
      frames.push({ id, title: entry.name, ...rect });
    else if (isLibraryOrigin(id))
      frames.push({ id, title: catalogDefinitionTitle(graph, id), ...rect });
  }
  return frames;
}
/** The definition edit view's declared slots: each drawn slot's box and whether it is empty. */
const sameFrames = (
  left: readonly PageHeaderFrame[],
  right: readonly PageHeaderFrame[],
) =>
  left.length === right.length &&
  left.every((frame, index) => {
    const other = right[index]!;
    return (
      frame.id === other.id &&
      frame.title === other.title &&
      frame.x === other.x &&
      frame.y === other.y &&
      frame.width === other.width &&
      frame.height === other.height
    );
  });
import type { BoundingBox } from "../selection/types";
import { hitTestPoint } from "../wasm-bindings/spatialIndex";
import {
  catalogRowRemainderBox,
  catalogRowRemainders,
  catalogRowSampleHiddenWithin,
} from "../../../catalogRuntime/rowSample";
import { resolveSpacingCursor } from "../interaction/spacingGeometry";
import { catalogOverlayNode } from "./catalogOverlay";
import { useBuilderUiStore } from "../../../stores/builderUiStore";
import { bindCatalogGuides, type CatalogGuideBinding } from "./catalogGuides";
import {
  catalogGuideSnapLines,
  catalogGuidesByPage,
} from "../../../catalogRuntime/pageGuides";
import { RulerOverlay } from "../../components/RulerOverlay";
import { CatalogDefinitionBar } from "./CatalogDefinitionBar";
import { buildViewportSceneRect } from "../skia/viewportSceneRect";
import { CatalogTextEditor } from "./CatalogTextEditor";
import { WorkspaceStatusIndicator } from "../../components/WorkspaceStatusIndicator";
import { CanvasScrollbar } from "../../scrollbar";
import { catalogScrollbarContent } from "./catalogScrollbarContent";

export interface CatalogCanvasProps {
  workspace: CatalogWorkspace;
  /** The first frame reached the screen (boot readiness). */
  onFirstFrame?: () => void;
  /** The scene could not follow a step (an explicit binding failure): shown by the host. */
  onError?: (error: unknown) => void;
}

/**
 * ADR-248 Phase 4e-2: the Builder Canvas of one open project. The scene is the workspace's
 * composition root bound into one command stream (`CatalogCanvasScene`); each published step
 * patches it (or binds it again) and invalidates the renderer. The renderer, frame scheduler and
 * viewport controller are the existing CanvasKit ones.
 */
export function CatalogCanvas({
  workspace,
  onFirstFrame,
  onError,
}: CatalogCanvasProps) {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gestureSession] = useState(() => new CanvasGestureSession());
  const sceneRef = useRef<CatalogCanvasScene | undefined>(undefined);
  /** The action bar's ⋯: the Canvas context menu over the selection at a screen point. */
  const openMenuRef = useRef<
    ((clientX: number, clientY: number) => void) | undefined
  >(undefined);
  /** The spacing handle a click opened the inline number input for. */
  const [spacingInput, setSpacingInput] = useState<CatalogSpacingClick | null>(
    null,
  );
  const spacingInputRef = useRef<CatalogSpacingClick | null>(null);
  const spacingCommitRef = useRef<
    ((click: CatalogSpacingClick, value: number) => void) | undefined
  >(undefined);
  /** The overlay's own redraw (the effect's `invalidateOverlay`, for state kept outside it). */
  const invalidateOverlayRef = useRef<(() => void) | undefined>(undefined);
  const closeSpacingInput = useCallback(() => {
    spacingInputRef.current = null;
    setSpacingInput(null);
    invalidateOverlayRef.current?.();
  }, []);
  /** The selected scroll/auto box takes the wheel (scrolls it) instead of the camera pan. */
  const wheelRouteRef = useRef<
    ((deltaX: number, deltaY: number) => boolean) | undefined
  >(undefined);
  /** A drawn record's scene box, the scene brought up to date first. */
  const boundsRef = useRef<(identity: string) => BoundingBox | undefined>(
    () => undefined,
  );
  const [menu, setMenu] = useState<{
    request: ContextMenuRequest;
    items: ContextMenuItem[];
  } | null>(null);
  // Page headers (ADR-221): the page frames as laid out, the session's page and selection.
  const [headerFrames, setHeaderFrames] = useState<PageHeaderFrame[]>([]);
  // The Figma-style Canvas scrollbars over the page frames (the old Workspace's).
  const scrollbarContent = useMemo(
    () => catalogScrollbarContent(workspace),
    [workspace],
  );
  // The WebGL context is lost: drawing pauses until the browser restores it; the user sees why.
  const [surfaceLost, setSurfaceLost] = useState(false);
  const headerPressRef = useRef<(pageId: string, event: PointerEvent) => void>(
    () => {},
  );
  const guidesRef = useRef<CatalogGuideBinding | undefined>(undefined);
  const activePageId = useSyncExternalStore(
    workspace.session.subscribe,
    () => workspace.session.getSnapshot().pageId ?? null,
  );
  const hasSelection = useSyncExternalStore(
    workspace.session.subscribe,
    () => workspace.session.getSnapshot().selection.length > 0,
  );
  const callbacks = useRef({ onFirstFrame, onError });
  useLayoutEffect(() => {
    callbacks.current = { onFirstFrame, onError };
  });

  /**
   * Zoom to selection — ⇧2, registered here (as the old Canvas did) because the boxes are the
   * scene's. The header menu's enablement (`canRun`) and the handler read the same target.
   */
  const canvasActiveScope = useActiveScope();
  const zoomShortcuts = useMemo(() => {
    const target = () => {
      const rect = catalogUnionRect(
        workspace.session
          .getSnapshot()
          .selection.map((item) => boundsRef.current(item.identity)),
      );
      const { containerSize } = useViewportSyncStore.getState();
      return rect && containerSize.width && containerSize.height
        ? { rect, containerSize }
        : undefined;
    };
    return bindHandlersToDefinitions(
      ["zoomToSelection", "toggleRulers"],
      {
        zoomToSelection: () => {
          const fit = target();
          if (fit) fitCatalogPageFrame(fit.rect, fit.containerSize);
        },
        // Rulers and guide editing (ADR-181) — a Builder view setting, like the Settings switch.
        toggleRulers: () => {
          const settings = useBuilderUiStore.getState();
          settings.setShowRulers(!settings.showRulers);
        },
      },
      { zoomToSelection: () => target() !== undefined },
    );
  }, [workspace]);
  useKeyboardShortcutsRegistry(zoomShortcuts, [zoomShortcuts], {
    activeScope: canvasActiveScope,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerEl) return;
    const ck = getCanvasKit();
    let dpr = window.devicePixelRatio || 1;
    const fit = () => {
      const rect = containerEl.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      // The viewport actions (zoom at center, fit) read the container size.
      useViewportSyncStore
        .getState()
        .setContainerSize({ width: rect.width, height: rect.height });
      return rect;
    };
    const containerRect = fit();
    const renderer = new SkiaRenderer(ck, canvas, dpr);
    // Compare Mode with "current page only": the Canvas draws the page the CSS side shows (the old
    // Canvas's `visiblePageIdsOverride`); a definition view has one frame and is not filtered.
    const compareOnlyPage = (): string | undefined => {
      const { isCompareMode, filterCurrentPage } =
        useCompareModeStore.getState();
      if (!isCompareMode || !filterCurrentPage || workspace.root.definitionView)
        return undefined;
      return workspace.session.getSnapshot().pageId;
    };
    const compareOnlyRoot = (): string | undefined => {
      const pageId = compareOnlyPage();
      const page = pageId
        ? workspace.runtime.graph.getEntry(pageId)
        : undefined;
      const body = page?.kind === "page" ? page.children[0] : undefined;
      return body ? workspace.root.recordsOfSource(body)[0] : undefined;
    };
    let scene: CatalogCanvasScene;
    try {
      scene = new CatalogCanvasScene(workspace.root, (roots) => {
        const only = compareOnlyRoot();
        return only && roots.includes(only) ? [only] : roots;
      });
    } catch (error) {
      renderer.dispose();
      callbacks.current.onError?.(error);
      return;
    }
    sceneRef.current = scene;
    let publishedFrames = catalogHeaderFrames(workspace, compareOnlyPage());
    setHeaderFrames(publishedFrames);
    const fontMgr = () =>
      skiaFontManager.getFamilies().length > 0
        ? skiaFontManager.getFontMgr()
        : undefined;
    renderer.setContentNode(scene.contentNode(ck, fontMgr));
    const badges = createCatalogBadges({
      data: () => useDataStore.getState(),
      bindingsOf: (ref) => workspace.runtime.graph.bindingsOf(ref),
      recordsOf: (sourceId) => workspace.root.recordsOfSource(sourceId),
    });
    const badgeHits = new Map<string, DataBadgeBounds>();
    // Group hover leaves: structural (per hovered record and step), drawn where they show.
    let hoverLeavesMemo: {
      identity?: string;
      root?: unknown;
      revision?: number;
      leaves: readonly string[];
    } = { leaves: [] };
    const overflowTree: CatalogOverflowTree = {
      overflowOf: (id) => workspace.root.canvasInputs.get(id)?.visual.overflow,
      childrenOf: (id) => workspace.root.canvasInputs.get(id)?.children ?? [],
      parentOf: (id) => workspace.root.canvasInputs.get(id)?.parentId,
    };
    renderer.setOverlayNode(
      catalogOverlayNode(ck, {
        session: workspace.session.getSnapshot,
        bounds: () => scene.stream.boundsMap,
        recordsOf: (sourceId) => workspace.root.recordsOfSource(sourceId),
        zoom: () => Math.max(viewportState.zoom, 0.001),
        fontMgr,
        gesture: () => gestures.preview(),
        guides: (overlayCanvas) => guidesRef.current?.paint(ck, overlayCanvas),
        slots: () =>
          catalogSlotMarks(
            workspace,
            scene.stream.boundsMap,
            scene.stream.hitBoundsMap,
          ),
        hitBounds: () => scene.stream.hitBoundsMap,
        roleOf: (identity) => {
          const target = workspace.itemOfRecord(identity)?.target;
          return target?.kind === "node"
            ? (catalogComponentRole(
                workspace.runtime.graph,
                target.id,
                workspace.root.definitionView,
              ) ?? null)
            : null;
        },
        hoverLeaves: (identity) => {
          // A page body is an empty area (canvas-interaction §8.6): no guides.
          const records = workspace.root.canvasInputs;
          if (records.get(identity)?.parentId === "catalog:root") return [];
          if (
            hoverLeavesMemo.identity !== identity ||
            hoverLeavesMemo.root !== workspace.root ||
            hoverLeavesMemo.revision !== workspace.runtime.graph.revision
          ) {
            const leaves = catalogLeafRecords(records, identity);
            hoverLeavesMemo = {
              identity,
              root: workspace.root,
              revision: workspace.runtime.graph.revision,
              // A leaf hovers alone (its own outline).
              leaves:
                leaves.length === 1 && leaves[0] === identity ? [] : leaves,
            };
          }
          return hoverLeavesMemo.leaves;
        },
        remainders: () =>
          catalogRowRemainders(workspace.root).flatMap((remainder) => {
            const box = catalogRowRemainderBox(
              remainder,
              (id) => scene.stream.boundsMap.get(id),
              scene.stream.hitBoundsMap.get(remainder.ownerId),
            );
            return box ? [{ box, hiddenRows: remainder.hiddenRows }] : [];
          }),
        badges: () =>
          badges.targets(scene.stream.boundsMap, scene.stream.hitBoundsMap),
        badgeHits,
        overflow: () => overflowTree,
        ai: () => useAIVisualFeedbackStore.getState(),
        radiusOf: (id) => getSkiaNode(id)?.box?.borderRadius ?? 0,
        measuring: () => measuring,
        spacing: () => {
          const owner = gestures.spacingOwner();
          if (!owner) return undefined;
          return {
            bands: gestures.spacingBands(),
            clipRect: scene.stream.hitBoundsMap.get(owner.id) ?? null,
            hoveredBandId: spacingHover,
            active: spacingInputRef.current
              ? {
                  bandId: spacingInputRef.current.band.id,
                  bandIds: spacingInputRef.current.bandIds,
                  mode: "input" as const,
                }
              : null,
          };
        },
      }),
    );
    // The overlay follows the session and the scene's boxes (its own version, no content redraw).
    let overlayVersion = 0;
    const invalidateOverlay = () => {
      overlayVersion += 1;
      scheduler.invalidate();
    };
    invalidateOverlayRef.current = invalidateOverlay;
    const picking = new CatalogCanvasPicking({
      get records() {
        return workspace.root.domInputs;
      },
      session: workspace.session,
      get stream() {
        return scene.stream;
      },
      query: hitTestPoint,
      pickable: (id) => !catalogRowSampleHiddenWithin(workspace.root, id),
      selectRecords: (ids, options) => workspace.selectRecords(ids, options),
      itemOf: (id) => workspace.itemOfRecord(id),
    });
    // A resize / spacing drag's live reflow redraws at the next frame (set once the loop exists).
    let reflowScene = () => {};
    const gestures = new CatalogCanvasGestures({
      get records() {
        return workspace.root.domInputs;
      },
      graph: workspace.runtime.graph,
      bounds: (id) => scene.stream.boundsMap.get(id),
      pick: (x, y) => picking.pick(x, y),
      selection: () => workspace.session.getSnapshot().selection,
      editingContext: () => workspace.session.getSnapshot().editingContext,
      selectRecords: (ids, options) => workspace.selectRecords(ids, options),
      breakpoint: () => workspace.session.getSnapshot().breakpoint,
      execute: (command) => workspace.execute(command),
      newId: workspace.newId,
      movablePageOf: (record) => {
        const graph = workspace.runtime.graph;
        const project = graph.getEntry(graph.projectId);
        const source = workspace.root.domInputs.get(record)?.sourceId;
        const page = source ? graph.ownerOf(source) : undefined;
        return project?.kind === "project" &&
          page &&
          page !== project.pageIds[0]
          ? page
          : undefined;
      },
      pageFrames: () => workspace.root.pageFrameRects(),
      guideLines: (exclude) =>
        catalogGuideSnapLines(
          catalogGuidesByPage(
            workspace.runtime.graph,
            workspace.session.getSnapshot().breakpoint,
          ),
          workspace.root.pageFrameRects(),
          exclude,
        ),
      pageDropCommand: (page, topLeft, followers = []) =>
        catalogPageDropCommand(
          workspace.root,
          page as Parameters<typeof catalogPageDropCommand>[1],
          topLeft,
          followers.map((follower) => ({
            pageId: follower.page as Parameters<
              typeof catalogPageDropCommand
            >[1],
            dropped: follower.topLeft,
          })),
        ),
      reflow: (record, patch) => {
        for (const error of workspace.root.previewRecord(record, patch))
          callbacks.current.onError?.(error);
        reflowScene();
      },
      // A drop the nesting rules refused: moved to the nearest accepting ancestor (undo = that
      // one step), or cancelled.
      notifyNesting: (notice) =>
        notice.kind === "relocated"
          ? showNestingRelocatedToast(notice.violation, notice.target, () =>
              workspace.undo(),
            )
          : notifyNestingRejected(notice.violation),
    });

    // The camera this project last had at this breakpoint, else the first page frame fitted
    // (again after a breakpoint switch: each breakpoint keeps its own camera).
    const camera = bindCatalogCamera({
      memory: openCatalogCameraMemory(workspace.runtime.graph.projectId),
      breakpoint: () => workspace.root.breakpoint,
      view: () => workspace.root.definitionView,
      camera: () => ({
        x: viewportState.x,
        y: viewportState.y,
        scale: viewportState.zoom,
      }),
      setCamera: (saved) =>
        getViewportController().setPosition(saved.x, saved.y, saved.scale),
      fit: (containerSize) => {
        const [firstPage] = workspace.root.pageFrameRects().values();
        // The definition edit view opens a small component at 100 % (a layout still fits).
        if (firstPage)
          fitCatalogPageFrame(
            firstPage,
            containerSize,
            workspace.root.definitionView ? 1 : Infinity,
          );
      },
    });
    camera.show(containerRect);
    const unwatchCamera = getViewportController().addUpdateListener(
      camera.changed,
    );
    // A reload inside the delay still keeps the last camera.
    window.addEventListener("pagehide", camera.flush);

    let running = true;
    let presented = false;
    let contextLost = false;
    let sceneStale = false;
    /** Publish the page header frames; true = a frame moved or resized. */
    const publishHeaders = (): boolean => {
      const frames = catalogHeaderFrames(workspace, compareOnlyPage());
      if (sameFrames(frames, publishedFrames)) return false;
      const moved = !sameFrames(
        frames.map((frame) => ({ ...frame, title: "" })),
        publishedFrames.map((frame) => ({ ...frame, title: "" })),
      );
      publishedFrames = frames;
      setHeaderFrames(frames);
      return moved;
    };
    const syncScene = () => {
      if (!sceneStale) return;
      sceneStale = false;
      try {
        const synced = scene.sync();
        if (synced.kind !== "unchanged") {
          renderer.invalidateContent();
          overlayVersion += 1;
        }
        // A page grid edit (gap, columns, direction) moves page frames without a record delta,
        // and a rename changes no drawn record: the headers follow, a moved frame binds again.
        if (publishHeaders() && synced.kind !== "rebound") {
          scene.refresh();
          renderer.invalidateContent();
          overlayVersion += 1;
        }
      } catch (error) {
        callbacks.current.onError?.(error);
      }
    };
    // `columns: "auto"`: the page grid fits the visible width (without the panel rails) at this
    // zoom; a changed count moves the page frames, so the scene binds again.
    let railInset: number | undefined;
    const syncAutoColumns = () => {
      const { containerSize } = useViewportSyncStore.getState();
      if (!containerSize.width) return;
      railInset ??= readCanvasRailInset();
      const columns = catalogAutoColumns(
        workspace.root,
        containerSize.width - railInset,
        Math.max(viewportState.zoom, 0.001),
      );
      if (columns === undefined || !workspace.setAutoColumns(columns)) return;
      try {
        scene.refresh();
        renderer.invalidateContent();
        overlayVersion += 1;
        publishHeaders();
      } catch (error) {
        callbacks.current.onError?.(error);
      }
    };
    const renderFrame = () => {
      if (!running || contextLost) return;
      syncScene();
      syncAutoColumns();
      const zoom = Math.max(viewportState.zoom, 0.001);
      const camera = { zoom, panX: viewportState.x, panY: viewportState.y };
      // DOM overlays (page headers) place themselves from the camera this frame draws.
      publishCanvasFramePresentation(
        camera,
        getPagePositionPresentationSnapshot(),
      );
      const drawn = renderer.render(
        new DOMRect(
          -camera.panX / zoom,
          -camera.panY / zoom,
          canvas.width / dpr / zoom,
          canvas.height / dpr / zoom,
        ),
        getRegistryVersion(),
        camera,
        overlayVersion,
        0,
      );
      if (drawn && !presented) {
        presented = true;
        callbacks.current.onFirstFrame?.();
      }
      if (renderer.needsAnimationFrame()) scheduler.invalidate();
      // AI effects animate (particles turn, flashes fade): the overlay draws again next frame
      // while any is running; the last flash's cleanup ends it.
      const ai = useAIVisualFeedbackStore.getState();
      if (ai.generatingNodes.size || ai.flashAnimations.size)
        invalidateOverlay();
    };
    const scheduler = createFrameScheduler(renderFrame);
    const unsubscribeFrames = subscribeCanvasFrames(scheduler.invalidate);
    // A step listener runs before the root's own subscribers deliver the step's per-node deltas
    // (`CatalogRuntime.step`), so the scene follows at the next frame (or pick), not inside it.
    reflowScene = () => {
      sceneStale = true;
      scheduler.invalidate();
    };
    // A preview from any surface (a Styles panel drag too) re-lays the scene out at the next frame.
    const unsubscribePreviews = workspace.root.subscribePreviews(reflowScene);
    const unsubscribeSteps = workspace.runtime.subscribeSteps(() => {
      sceneStale = true;
      // A step may change only document state the overlay reads (a binding's badge).
      overlayVersion += 1;
      scheduler.invalidate();
    });
    // The old Canvas's wheel routing: one selected scroll/auto box with somewhere to scroll takes
    // the wheel (even at its end, so the camera does not jump); a moved position redraws its box.
    wheelRouteRef.current = (deltaX, deltaY) => {
      const selection = workspace.session.getSnapshot().selection;
      if (selection.length !== 1) return false;
      syncScene();
      const id = selection[0].identity;
      if (!scene.scrollable(id)) return false;
      if (scene.scrollBy(id, deltaX, deltaY)) {
        sceneStale = true;
        scheduler.invalidate();
      }
      return true;
    };
    // Data rows re-resolved outside a step (the data store): the same per-node deltas.
    const unsubscribeRows = workspace.subscribeRows(() => {
      sceneStale = true;
      scheduler.invalidate();
    });
    const unsubscribeAi = useAIVisualFeedbackStore.subscribe(invalidateOverlay);
    // The compare filter (or the page it shows) changed: the drawn page roots follow next frame.
    let compareRoot = compareOnlyRoot();
    const followCompareFilter = () => {
      const next = compareOnlyRoot();
      if (next === compareRoot) return;
      compareRoot = next;
      sceneStale = true;
      publishHeaders();
      scheduler.invalidate();
    };
    const unsubscribeCompare =
      useCompareModeStore.subscribe(followCompareFilter);
    // The badges show each collection's state (rows, the linked API's last run).
    const unsubscribeData = useDataStore.subscribe((state, prev) => {
      if (
        state.collections !== prev.collections ||
        state.apiEndpoints !== prev.apiEndpoints ||
        state.apiRuns !== prev.apiRuns
      )
        invalidateOverlay();
    });
    // The record whose text is edited inline: the Canvas leaves its text out while the DOM field
    // shows it (the renderer's editing element skips that node's picture cache).
    let editingText: string | undefined;
    spacingCommitRef.current = (click, value) => {
      const command = gestures.spacingValueCommand(click, value);
      if (!command) return;
      try {
        workspace.execute(command);
      } catch (error) {
        callbacks.current.onError?.(error);
      }
    };
    const unsubscribeSession = workspace.session.subscribe(() => {
      followCompareFilter();
      // Another selection closes the inline spacing input (its blur no longer applies).
      const input = spacingInputRef.current;
      const selection = workspace.session.getSnapshot().selection;
      if (
        input &&
        (selection.length !== 1 ||
          selection[0].identity !== input.item.identity)
      )
        closeSpacingInput();
      const editing = workspace.session.getSnapshot().textEditing?.identity;
      if (editing !== editingText) {
        editingText = editing;
        setEditingElementId(editing ?? null);
        renderer.invalidateContent();
      }
      invalidateOverlay();
    });
    boundsRef.current = (identity) => {
      syncScene();
      return scene.stream.boundsMap.get(identity);
    };
    // Live harness handle: scene boxes and the camera (screen ↔ scene) — dev, or a G5 harness build.
    if (
      import.meta.env.DEV ||
      import.meta.env.VITE_COMPOSITION_HARNESS === "1"
    ) {
      const handle = ((
        window as unknown as Record<string, unknown>
      ).__COMPOSITION_CATALOG__ ??= {}) as Record<string, unknown>;
      handle.canvas = {
        boundsOf: (id: string) => boundsRef.current(id),
        camera: () => ({ ...viewportState }),
        // Sets the camera exactly (a frozen G3 baseline's zoom · pan).
        setCamera: (next: { scale: number; x: number; y: number }) =>
          void import("../viewport/viewportActions").then((actions) =>
            actions.applyViewportState(next),
          ),
      };
    }
    const unsubscribeRoot = workspace.subscribeRoot(() => {
      try {
        scene.replaceRoot(workspace.root);
        sceneStale = false;
      } catch (error) {
        callbacks.current.onError?.(error);
        return;
      }
      // A theme change builds a new root too; only a breakpoint switch moves the camera.
      camera.rootReplaced(containerEl.getBoundingClientRect());
      renderer.invalidateContent();
      invalidateOverlay();
      publishHeaders();
    });

    // Pages tree select: glide that page frame to the center at the current zoom (the old
    // `panToPage` — 300 ms ease-out; a wheel or drag stops it where it is).
    const unsubscribeReveal = workspace.subscribeReveal((pageId) => {
      const frame = workspace.root.pageFrameRects().get(pageId);
      if (!frame) return;
      const { width, height } = containerEl.getBoundingClientRect();
      const zoom = Math.max(viewportState.zoom, 0.001);
      animatePanTo(
        width / 2 - (frame.x + frame.width / 2) * zoom,
        height / 2 - (frame.y + frame.height / 2) * zoom,
      );
    });

    // Pointer picking (scene coordinates from the camera). Pan owns its pointer (viewport bridge).
    const scenePoint = (event: { clientX: number; clientY: number }) => {
      const rect = canvas.getBoundingClientRect();
      const zoom = Math.max(viewportState.zoom, 0.001);
      return {
        x: (event.clientX - rect.left - viewportState.x) / zoom,
        y: (event.clientY - rect.top - viewportState.y) / zoom,
      };
    };
    // The spacing band under the pointer (hatched; its handle starts a padding/gap drag).
    let spacingHover: string | null = null;
    // Alt held: the overlay measures from the selection to the hovered element. Key transitions
    // show it with the pointer still; a move reads the key too (Alt pressed outside the page).
    let measuring = false;
    const setMeasuring = (held: boolean) => {
      if (held === measuring) return;
      measuring = held;
      invalidateOverlay();
    };
    // The last hovered scene point: a click, double click or Escape changes what a click there
    // selects (the context), so hover follows it without waiting for the next move.
    let lastPoint: { x: number; y: number } | undefined;
    const rehover = () => {
      if (lastPoint && !gestureSession.shouldSuppressElementHover())
        picking.hover(lastPoint.x, lastPoint.y);
    };
    const zoomNow = () => Math.max(viewportState.zoom, 0.001);
    // Manual guides (ADR-181): ruler drags, guide moves and deletes, painted in the overlay.
    const guides = bindCatalogGuides({
      workspace,
      canvas,
      scenePoint,
      zoom: zoomNow,
      viewport: () =>
        buildViewportSceneRect(
          viewportState.x,
          viewportState.y,
          zoomNow(),
          canvas.clientWidth,
          canvas.clientHeight,
        ),
      invalidateOverlay: () => invalidateOverlay(),
      onError: (error) => callbacks.current.onError?.(error),
    });
    guidesRef.current = guides;
    // A press on an already selected element keeps the selection (a multi-selection drags
    // together); a release without a drag then selects that element alone.
    let deferredSelect: string | undefined;
    let pressPointer: number | undefined;
    const onPointerDown = (event: PointerEvent) => {
      // Only the primary button selects and drags (the secondary opens the context menu).
      if (event.button !== 0) return;
      if (gestureSession.blocksPointerDown(event.pointerId)) return;
      // A guide under the pointer (rulers shown) takes the press before any element.
      if (guides.press(event)) {
        containerEl.focus({ preventScroll: true });
        picking.leave();
        return;
      }
      // A data badge opens its table's editor (before any element: the badge sits on one).
      const badge = catalogBadgeAt(badgeHits, scenePoint(event));
      if (badge) {
        picking.leave();
        useDataTableEditorStore.getState().openTableEditor(badge.collectionId);
        return;
      }
      if (
        gestureSession.beginPointer(event.pointerId, event.button) !== "element"
      )
        return;
      containerEl.focus({ preventScroll: true });
      syncScene();
      const { x, y } = scenePoint(event);
      lastPoint = { x, y };
      pressPointer = event.pointerId;
      deferredSelect = undefined;
      if (
        gestures.beginSpacing(x, y, zoomNow(), {
          alt: event.altKey,
          shift: event.shiftKey,
        })
      ) {
        gestureSession.promoteElement(event.pointerId, "spacing");
        picking.leave();
        return;
      }
      if (gestures.beginResize(x, y, zoomNow())) {
        gestureSession.promoteElement(event.pointerId, "resize");
        picking.leave();
        return;
      }
      const additive = event.shiftKey;
      const deep = event.metaKey || event.ctrlKey;
      const target = picking.target(x, y, deep);
      const selected = workspace.session
        .getSnapshot()
        .selection.some((item) => item.identity === target?.id);
      const pageRoot =
        !!target &&
        workspace.root.domInputs.get(target.id)?.parentId === "catalog:root";
      if (target && selected && !additive && !target.leaveContext) {
        // A selected page body moves its page frame; a selected element drags.
        // (The home page stays: a press on it starts a marquee.)
        if (pageRoot) {
          if (!gestures.beginPageDrag(x, y, target.id))
            gestures.beginMarquee(x, y, false);
        } else {
          deferredSelect = target.id;
          gestures.beginMove(x, y, target.id, { copy: event.altKey });
        }
      } else {
        const picked = picking.click(x, y, { additive, deep });
        // Off every page ends the selection context: the selection's panels close (the old
        // Canvas's background press — Data · Theme · Settings stay open).
        if (!picked && !additive) dismissCanvasSelectionPanels();
        // The page background (a page body or off every page) starts a marquee.
        if (
          !picked ||
          workspace.root.domInputs.get(picked)?.parentId === "catalog:root"
        )
          gestures.beginMarquee(x, y, additive);
        else if (!additive)
          gestures.beginMove(x, y, picked, { copy: event.altKey });
      }
      rehover();
    };
    // A page header press selects the page (its body; ⇧ toggles it) and drags its frame — the
    // Canvas's own page drag (the home page stays).
    headerPressRef.current = (pageId, event) => {
      if (gestureSession.blocksPointerDown(event.pointerId)) return;
      const page = workspace.runtime.graph.getEntry(pageId);
      const body =
        page?.kind === "page"
          ? page.children[0]
          : page?.kind === "definition"
            ? page.templateRootId
            : undefined;
      const record = body ? workspace.root.recordsOfSource(body)[0] : undefined;
      if (!record) return;
      if (
        gestureSession.beginPointer(event.pointerId, event.button) !== "element"
      )
        return;
      (event as PointerEvent & { __handled?: boolean }).__handled = true;
      containerEl.focus({ preventScroll: true });
      if (event.shiftKey) {
        workspace.selectRecords([record], { additive: true });
      } else {
        // A page already in the selection keeps it: the other selected pages drag along.
        if (
          !workspace.session
            .getSnapshot()
            .selection.some((item) => item.identity === record)
        )
          workspace.selectRecords([record]);
        syncScene();
        const { x, y } = scenePoint(event);
        pressPointer = event.pointerId;
        deferredSelect = undefined;
        gestures.beginPageDrag(x, y, record);
      }
      invalidateOverlay();
    };
    const onWindowPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pressPointer || !gestures.pending) return;
      const { x, y } = scenePoint(event);
      if (
        gestures.update(x, y, zoomNow(), {
          axisLock: event.shiftKey,
          // Snap to objects (the Builder setting); ⌘/Ctrl held turns it off for this move.
          snap:
            useBuilderUiStore.getState().snapToObjects &&
            !(event.metaKey || event.ctrlKey),
        })
      ) {
        deferredSelect = undefined;
        picking.leave();
        invalidateOverlay();
      }
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId === pressPointer) {
        pressPointer = undefined;
        if (event.type === "pointercancel") gestures.cancel();
        else if (gestures.pending) {
          try {
            if (gestures.finish()) {
              syncScene();
              picking.fitContext();
            }
          } catch (error) {
            callbacks.current.onError?.(error);
          }
          const click = gestures.takeSpacingClick();
          if (click) {
            spacingInputRef.current = click;
            setSpacingInput(click);
          }
        }
        if (deferredSelect) workspace.selectRecords([deferredSelect]);
        deferredSelect = undefined;
        invalidateOverlay();
      }
      if (gestureSession.ownerFor(event.pointerId) !== "pan")
        gestureSession.endPointer(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      setMeasuring(event.altKey);
      if (event.buttons !== 0 || gestureSession.shouldSuppressElementHover()) {
        picking.leave();
        return;
      }
      syncScene();
      const { x, y } = scenePoint(event);
      lastPoint = { x, y };
      const guideCursor = guides.hover(event);
      if (guideCursor) {
        canvas.style.cursor = guideCursor;
        picking.leave();
        return;
      }
      const spacing = gestures.spacingAt(x, y, zoomNow());
      const handle = spacing?.onHandle
        ? null
        : gestures.handleAt(x, y, zoomNow());
      canvas.style.cursor = spacing?.onHandle
        ? resolveSpacingCursor(spacing.band)
        : (handle?.cursor ?? "");
      const hoverBand = spacing?.band.id ?? null;
      if (hoverBand !== spacingHover) {
        spacingHover = hoverBand;
        invalidateOverlay();
      }
      picking.hover(x, y);
    };
    const onPointerLeave = () => {
      lastPoint = undefined;
      guides.leave();
      picking.leave();
    };
    const onDoubleClick = (event: MouseEvent) => {
      syncScene();
      const { x, y } = scenePoint(event);
      if (!picking.doubleClick(x, y)) {
        // Nothing to enter: a double click on an element with its own text edits it inline.
        const target = picking.target(x, y, false);
        const item =
          target &&
          catalogTextKey(workspace.root.domInputs.get(target.id)) &&
          workspace.itemOfRecord(target.id);
        if (item) workspace.session.startTextEdit(item);
      }
      rehover();
    };
    const onAltKey = (event: KeyboardEvent) => {
      if (event.key === "Alt") setMeasuring(event.type === "keydown");
    };
    const onWindowBlur = () => setMeasuring(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isEditableTarget(event.target)) return;
      if (gestures.pending) {
        gestures.cancel();
        deferredSelect = undefined;
        invalidateOverlay();
        return;
      }
      syncScene();
      picking.escape();
      rehover();
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    // Context menu: the element under the pointer (selected first), or the page background.
    // The Canvas menu's host: the selection's commands and the view items.
    const menuHost = () =>
      catalogMenuHost(
        workspace,
        (error) => callbacks.current.onError?.(error),
        catalogMenuView(workspace),
      );
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (gestures.pending) return;
      syncScene();
      const { x, y } = scenePoint(event);
      const target = picking.target(x, y, false);
      const record = target && workspace.root.domInputs.get(target.id);
      const onElement = !!record && record.parentId !== "catalog:root";
      if (
        onElement &&
        !workspace.session
          .getSnapshot()
          .selection.some((item) => item.identity === target!.id)
      )
        picking.click(x, y);
      const surface = onElement ? "canvas-element" : "canvas-empty";
      const items = catalogCanvasMenuItems(
        menuHost(),
        surface,
        onElement ? target!.id : record?.id,
      );
      if (!items.length) return;
      setMenu({
        request: {
          surface,
          clientX: event.clientX,
          clientY: event.clientY,
          scenePoint: { x, y },
          targetElementIds: onElement ? [target!.id] : [],
        },
        items,
      });
    };
    openMenuRef.current = (clientX, clientY) => {
      const target = workspace.session.getSnapshot().selection[0]?.identity;
      if (!target) return;
      const items = catalogCanvasMenuItems(
        menuHost(),
        "canvas-element",
        target,
      );
      if (items.length)
        setMenu({
          request: {
            surface: "canvas-element",
            clientX,
            clientY,
            targetElementIds: [target],
          },
          items,
        });
    };
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onAltKey);
    window.addEventListener("keyup", onAltKey);
    window.addEventListener("blur", onWindowBlur);

    const updatePaused = () => {
      scheduler.setPaused(document.hidden || contextLost);
      scheduler.invalidate();
    };
    document.addEventListener("visibilitychange", updatePaused);
    const unwatchContext = watchContextLoss(
      canvas,
      () => {
        contextLost = true;
        updatePaused();
        setSurfaceLost(true);
      },
      () => {
        contextLost = false;
        setSurfaceLost(false);
        renderer.resize(canvas);
        renderer.invalidateContent();
        renderer.clearFrame();
        updatePaused();
      },
    );
    const resize = new ResizeObserver(() => {
      dpr = window.devicePixelRatio || 1;
      fit();
      railInset = undefined;
      renderer.resize(canvas);
      renderer.invalidateContent();
      renderer.clearFrame();
      // Setting the canvas size cleared its bitmap, and this callback runs after this frame's
      // animation frame: draw now, or the browser paints the cleared canvas (a blank flash on
      // every step of a window resize).
      renderFrame();
    });
    resize.observe(containerEl);
    renderer.invalidateContent();
    updatePaused();

    return () => {
      running = false;
      resize.disconnect();
      unwatchContext();
      setSurfaceLost(false);
      document.removeEventListener("visibilitychange", updatePaused);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("dblclick", onDoubleClick);
      canvas.removeEventListener("contextmenu", onContextMenu);
      openMenuRef.current = undefined;
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onAltKey);
      window.removeEventListener("keyup", onAltKey);
      window.removeEventListener("blur", onWindowBlur);
      unsubscribeRoot();
      unsubscribeData();
      unsubscribeAi();
      unsubscribeCompare();
      invalidateOverlayRef.current = undefined;
      spacingCommitRef.current = undefined;
      wheelRouteRef.current = undefined;
      guides.dispose();
      guidesRef.current = undefined;
      unwatchCamera();
      window.removeEventListener("pagehide", camera.flush);
      camera.flush();
      unsubscribeReveal();
      cancelPanAnimation();
      setEditingElementId(null);
      sceneRef.current = undefined;
      unsubscribeSession();
      unsubscribeSteps();
      unsubscribePreviews();
      unsubscribeRows();
      unsubscribeFrames();
      scheduler.dispose();
      scene.dispose();
      renderer.dispose();
    };
  }, [workspace, containerEl, gestureSession]);

  // Module caches (pictures, paints, images) are released when the Canvas leaves.
  useEffect(() => () => destroyAllSkiaCaches(), []);

  return (
    <div
      ref={setContainerEl}
      className="canvas-container"
      data-canvas-container="true"
      data-catalog-canvas="true"
      tabIndex={-1}
      onPointerDown={(event) => {
        // Any press in the Canvas (not in its text editor) makes the Canvas scope active, so
        // the Canvas shortcuts (Delete, arrows, ⌘C …) run — the old `BuilderCanvas` rule.
        if (
          !(event.target as HTMLElement).closest(
            'input, textarea, [contenteditable="true"]',
          )
        )
          containerEl?.focus({ preventScroll: true });
      }}
    >
      <canvas
        ref={canvasRef}
        data-testid="skia-canvas-unified"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          pointerEvents: "auto",
        }}
      />
      <DotBackground />
      <PageHeaderLayer
        frames={headerFrames}
        activePageId={activePageId}
        hasSelection={hasSelection}
        onHeaderPointerDown={(pageId, event) =>
          headerPressRef.current(pageId, event)
        }
        canRenamePage={() => true}
        onBeginRename={(pageId) => {
          if (workspace.runtime.graph.getEntry(pageId)?.kind === "page")
            workspace.session.setPage(pageId as EntryId<"page">);
        }}
        onRenamePage={(pageId, title) => {
          const page = workspace.runtime.graph.getEntry(pageId);
          const name = title.trim();
          if (!page || !name || !("name" in page) || name === page.name) return;
          try {
            if (page.kind === "definition")
              workspace.execute(
                renameDefinition({
                  id: page.id,
                  name,
                  label: "Rename component",
                }),
              );
            else if (page.kind === "page")
              workspace.execute(
                updatePage({
                  id: page.id,
                  fields: { name },
                  label: "Rename page",
                }),
              );
          } catch (error) {
            callbacks.current.onError?.(error);
          }
        }}
      />
      <CatalogDefinitionBar workspace={workspace} />
      <RulerOverlay
        onStartGuideCreate={(axis, pointerId, clientX, clientY) =>
          guidesRef.current?.startCreate(axis, pointerId, clientX, clientY)
        }
      />
      <ContextMenuOverlay
        isOpen={!!menu}
        request={menu?.request ?? null}
        items={menu?.items ?? []}
        onClose={() => setMenu(null)}
      />
      <div className="workspace-overlay">
        <CatalogActionBar
          workspace={workspace}
          onError={onError}
          openMenu={(clientX, clientY) =>
            openMenuRef.current?.(clientX, clientY)
          }
        />
      </div>
      <WorkspaceStatusIndicator isCanvasReady isContextLost={surfaceLost} />
      <CanvasScrollbar direction="horizontal" content={scrollbarContent} />
      <CanvasScrollbar direction="vertical" content={scrollbarContent} />
      {spacingInput && (
        <CatalogSpacingInput
          band={spacingInput.band}
          startValue={spacingInput.start}
          onCommit={(value) => {
            spacingCommitRef.current?.(spacingInput, value);
            closeSpacingInput();
          }}
          onCancel={closeSpacingInput}
        />
      )}
      <CatalogTextEditor
        workspace={workspace}
        boundsOf={(identity) =>
          sceneRef.current?.stream.boundsMap.get(identity)
        }
      />
      {containerEl && (
        <ViewportControlBridge
          containerEl={containerEl}
          minZoom={0.1}
          maxZoom={5}
          gestureSession={gestureSession}
          routeWheel={(deltaX, deltaY) =>
            wheelRouteRef.current?.(deltaX, deltaY) ?? false
          }
        />
      )}
    </div>
  );
}

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT");
