import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { setBorderSnapRatio } from "@composition/rendering";
import {
  renameDefinition,
  updatePage,
} from "../../../../../../../packages/shared/src/catalog/commands";
import type { EntryId } from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  CatalogCanvasGestures,
  type CatalogGridTrackGeometry,
  type CatalogSpacingClick,
} from "../../../catalogRuntime/canvasGesture";
import { catalogCanvasMenuItems } from "../../../catalogRuntime/canvasMenu";
import type { CatalogOverflowTree } from "../../../catalogRuntime/canvasOverflow";
import { catalogPageDropCommand } from "../../../catalogRuntime/canvasPage";
import {
  CatalogCanvasPicking,
  resolveCatalogTextEditRecord,
} from "../../../catalogRuntime/canvasPick";
import {
  CatalogCanvasScene,
  catalogSyncDamage,
} from "../../../catalogRuntime/canvasScene";
import { catalogTextKey } from "../../../catalogRuntime/canvasText";
import { catalogHasOwnText } from "../../../catalogRuntime/textBinding";
import { catalogComponentRole } from "../../../catalogRuntime/componentActions";
import {
  catalogDefinitionTitle,
  isComponentsView,
  isLibraryOrigin,
  isPageCard,
} from "../../../catalogRuntime/originView";
import {
  catalogGuideSnapLines,
  catalogGuidesByPage,
} from "../../../catalogRuntime/pageGuides";
import {
  catalogRowRemainderBox,
  catalogRowRemainders,
  catalogRowSampleHiddenWithin,
} from "../../../catalogRuntime/rowSample";
import { catalogMenuHost } from "../../../catalogRuntime/shortcuts";
import { setCatalogSpacingLive } from "../../../catalogRuntime/spacingLive";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { ContextMenuOverlay } from "../../../components/overlay/contextMenu/ContextMenuOverlay";
import type {
  ContextMenuItem,
  ContextMenuRequest,
} from "../../../components/overlay/contextMenu/types";
import { useActiveScope } from "../../../hooks/useActiveScope";
import {
  bindHandlersToDefinitions,
  registerKeyboardEventHandler,
  useKeyboardShortcutsRegistry,
} from "../../../hooks/useKeyboardShortcutsRegistry";
import { dismissCanvasSelectionPanels } from "../../../layout/panelWorkspaceVisibility";
import { useDataTableEditorStore } from "../../../panels/datatable/stores/dataTableEditorStore";
import { getPaddingLinked } from "../../../panels/styles/components/boxModelLink";
import { useAIVisualFeedbackStore } from "../../../stores/aiVisualFeedback";
import { useBuilderUiStore } from "../../../stores/builderUiStore";
import { useDataStore } from "../../../stores/data";
import { DotBackground } from "../../components/DotBackground";
import { RulerOverlay } from "../../components/RulerOverlay";
import { WorkspaceStatusIndicator } from "../../components/WorkspaceStatusIndicator";
import { CanvasScrollbar } from "../../scrollbar";
import { publishCanvasFramePresentation } from "../canvasFramePresentation";
import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import {
  notifyNestingRejected,
  showNestingRelocatedToast,
} from "../interaction/nestingToast";
import { getPagePositionPresentationSnapshot } from "../interaction/pagePositionPresentation";
import { resolveSpacingCursor } from "../interaction/spacingGeometry";
import type { PageHeaderFrame } from "../overlay/pageHeader/pageHeaderGeometry";
import { PageHeaderLayer } from "../overlay/pageHeader/PageHeaderLayer";
import { CatalogGridTrackLayer } from "./CatalogGridTrackLayer";
import { useGridTrackSelection } from "../../../stores/gridTrackSelection";
import type { DataBadgeBounds } from "../skia/bindingBadgeRenderer";
import { watchContextLoss } from "../skia/createSurface";
import { destroyAllSkiaCaches } from "../skia/disposable";
import { skiaFontManager } from "../skia/fontManager";
import {
  createFrameScheduler,
  subscribeCanvasFrames,
} from "../skia/frameScheduler";
import { registerImageLoadCallback } from "../skia/imageCache";
import { renderCounters } from "../skia/renderCounters";
import { getCanvasKit } from "../skia/initCanvasKit";
import { setEditingElementId } from "../skia/nodeRendererState";
import {
  getDragSiblingOffsetRevision,
  getDragVisualOffsetRevision,
  setDragSiblingOffsets,
  setDragVisualOffset,
} from "../skia/nodeRendererTree";
import { CatalogDragReflow } from "./catalogDragReflow";
import { SkiaRenderer } from "../skia/SkiaRenderer";
import { setupThemeWatcher } from "../skia/themeWatcher";
import { getRegistryVersion, getSkiaNode } from "../skia/useSkiaNode";
import { buildViewportSceneRect } from "../skia/viewportSceneRect";
import { useViewportSyncStore } from "../stores";
import { useCompareModeStore } from "../stores/compareMode";
import {
  colorIntToFloat32,
  cssColorToAlpha,
  cssColorToHex,
} from "../styleConversion/styleConverter";
import { ViewportControlBridge } from "../viewport";
import { animatePanTo, cancelPanAnimation } from "../viewport/animatePan";
import { getViewportController } from "../viewport/ViewportController";
import { viewportState } from "../viewport/viewportState";
import { hitTestPoint } from "../wasm-bindings/spatialIndex";
import { CatalogActionBar } from "./CatalogActionBar";
import { catalogBadgeAt, createCatalogBadges } from "./catalogBadges";
import { CatalogCanvasViewState } from "./catalogCanvasViewState";
import {
  catalogLeafRecords,
  catalogOccludingPages,
  catalogSlotMarks,
} from "./catalogChrome";
import { CatalogDefinitionBar } from "./CatalogDefinitionBar";
import { bindCatalogGuides, type CatalogGuideBinding } from "./catalogGuides";
import { catalogMenuView } from "./catalogMenuView";
import { catalogOverlayNode } from "./catalogOverlay";
import { catalogScrollbarContent } from "./catalogScrollbarContent";
import { CatalogSpacingInput } from "./CatalogSpacingInput";
import { CatalogTextEditor } from "./CatalogTextEditor";
import {
  bindCatalogCamera,
  openCatalogCameraMemory,
} from "./catalogViewMemory";
import { catalogUnionRect, fitCatalogPageFrame } from "./catalogViewport";

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
      frames.push({
        id,
        title: entry.name,
        ...rect,
        isPage: entry.kind === "page",
      });
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

/** A record that is not a grid: no cells to outline. */
const NO_CELLS: readonly never[] = [];

const IS_MAC =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac");
/** The dragged element's opacity over another container than its own (Figma draws it faded). */
const DRAG_OUTSIDE_ALPHA = 0.5;

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
  const [viewState] = useState(() => new CatalogCanvasViewState());
  const [menu, setMenu] = useState<{
    request: ContextMenuRequest;
    items: ContextMenuItem[];
  } | null>(null);
  // Page headers (ADR-221): the page frames as laid out, the session's page and selection.
  const headerFrames = useSyncExternalStore(
    viewState.subscribe,
    viewState.getFrames,
    viewState.getFrames,
  );
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
  /** The grid track headers' reads (the effect's scene): a grid's tracks, and a gesture runs. */
  const gridTracksRef = useRef<
    ((identity: string) => CatalogGridTrackGeometry | undefined) | undefined
  >(undefined);
  const gestureActiveRef = useRef<() => boolean>(() => false);
  const readGridTracks = useCallback(
    (identity: string) => gridTracksRef.current?.(identity),
    [],
  );
  const readGestureActive = useCallback(() => gestureActiveRef.current(), []);
  const readBounds = useCallback(
    (identity: string) => viewState.boundsOf(identity),
    [viewState],
  );
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
          .selection.map((item) => viewState.boundsOf(item.identity)),
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
  }, [workspace, viewState]);
  useKeyboardShortcutsRegistry(zoomShortcuts, [zoomShortcuts], {
    activeScope: canvasActiveScope,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerEl) return;
    const ck = getCanvasKit();
    let dpr = window.devicePixelRatio || 1;
    // The Canvas draws border widths snapped to this ratio, as the engine lays them out
    // (`snapBorderWidth` — the root was built with the same ratio, `CatalogBuilderCore`).
    setBorderSnapRatio(dpr);
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
    /** The active page's body record: drawn on top of an overlapping page (pagePaintOrder.ts). */
    const activePageRoot = (): string | undefined => {
      if (workspace.root.definitionView) return undefined;
      const pageId = workspace.session.getSnapshot().pageId;
      const page = pageId
        ? workspace.runtime.graph.getEntry(pageId)
        : undefined;
      const body = page?.kind === "page" ? page.children[0] : undefined;
      return body ? workspace.root.recordsOfSource(body)[0] : undefined;
    };
    let scene: CatalogCanvasScene;
    // The root the scene draws (kept for the overlay's grid lookup — no extra `workspace.root`).
    let sceneRoot = workspace.root;
    try {
      scene = new CatalogCanvasScene(
        sceneRoot,
        (roots) => {
          const only = compareOnlyRoot();
          return only && roots.includes(only) ? [only] : roots;
        },
        activePageRoot,
      );
    } catch (error) {
      renderer.dispose();
      callbacks.current.onError?.(error);
      return;
    }
    sceneRef.current = scene;
    let publishedFrames = catalogHeaderFrames(workspace, compareOnlyPage());
    viewState.publishFrames(publishedFrames);
    const fontMgr = () =>
      skiaFontManager.getFamilies().length > 0
        ? skiaFontManager.getFontMgr()
        : undefined;
    renderer.setContentNode(scene.contentNode(ck, fontMgr));
    /** Page boxes painted over a record's page (content chrome is cut there — §8.5). */
    const occludersOf = (identity: string) =>
      catalogOccludingPages(
        identity,
        (id) => workspace.root.canvasInputs.get(id)?.parentId,
        scene.pageRootIds,
        (id) => scene.stream.boundsMap.get(id),
      );
    const badges = createCatalogBadges({
      data: () => useDataStore.getState(),
      bindingsOf: (ref) => workspace.runtime.graph.bindingsOf(ref),
      // (A context is a document node's records, or one template position's record identity.)
      recordsOf: (id) => {
        const records = workspace.root.recordsOfSource(id);
        return records.length > 0 || !workspace.root.canvasInputs.has(id)
          ? records
          : [id];
      },
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
    // Read the Builder scope's token, not the edited document's theme. Only theme changes
    // read computed styles; drawing/panning reuses this color without a DOM style read.
    const readPageBorderColor = () => {
      const css = getComputedStyle(containerEl)
        .getPropertyValue("--border-hover")
        .trim();
      return colorIntToFloat32(cssColorToHex(css), cssColorToAlpha(css));
    };
    let pageBorderColor = readPageBorderColor();
    // The cells the overlay outlines (cached per document step · root): the live handle reads the
    // same function.
    const overlayGridCells = (identity: string) => {
      if (gridCellsCacheVersion !== cellsVersion) {
        gridCellsCache.clear();
        gridCellsCacheVersion = cellsVersion;
      }
      // The grid containers, gathered once per document step / root: a selected or hovered
      // non-grid record reads nothing (the overlay asks every frame; a selection moves the scene
      // version but not the document — ADR-246 select count).
      if (!gridRecordSet().has(identity)) return NO_CELLS;
      let cells = gridCellsCache.get(identity);
      if (!cells) {
        cells = gestures.gridCellsOfRecord(identity);
        gridCellsCache.set(identity, cells);
      }
      return cells;
    };
    // The track headers (DOM) read the same tracks, cached per drawn scene like the cells.
    const gridTracksCache = new Map<
      string,
      ReturnType<typeof gestures.gridTracksOfRecord>
    >();
    let gridTracksCacheVersion = -1;
    gridTracksRef.current = (identity) => {
      if (gridTracksCacheVersion !== cellsVersion) {
        gridTracksCache.clear();
        gridTracksCacheVersion = cellsVersion;
      }
      if (!gridRecordSet().has(identity)) return undefined;
      if (!gridTracksCache.has(identity))
        gridTracksCache.set(identity, gestures.gridTracksOfRecord(identity));
      return gridTracksCache.get(identity);
    };
    gestureActiveRef.current = () => gestures.active;
    const overlay = catalogOverlayNode(ck, {
      session: workspace.session.getSnapshot,
      bounds: () => scene.stream.boundsMap,
      pageBorders: () => ({
        roots: scene.pageRootIds,
        color: pageBorderColor,
      }),
      recordsOf: (sourceId) => workspace.root.recordsOfSource(sourceId),
      zoom: () => Math.max(viewportState.zoom, 0.001),
      fontMgr,
      gesture: () => gestures.preview(),
      gridCells: overlayGridCells,
      // Only a grid parent (none on a page without grids: no record read per frame — ADR-246).
      parentOf: (identity) => {
        const grids = gridRecordSet();
        if (!grids.size) return undefined;
        const parent = sceneRoot.canvasInputs.get(identity)?.parentId;
        return parent && grids.has(parent) ? parent : undefined;
      },
      // Asked only for a grid whose cells are drawn.
      childrenOf: (identity) =>
        sceneRoot.canvasInputs.get(identity)?.children ?? [],
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
        return target
          ? (catalogComponentRole(
              workspace.runtime.graph,
              target,
              workspace.root.definitionView,
            ) ?? null)
          : null;
      },
      hoverLeaves: (identity) => {
        // A page body is an empty area (canvas-interaction §8.6): no guides.
        const records = workspace.root.canvasInputs;
        if (records.get(identity)?.parentId === "catalog:root") return [];
        // A Components page card is a group of samples, not a component: its own outline only.
        if (isPageCard(records.get(identity)?.sourceId)) return [];
        if (
          hoverLeavesMemo.identity !== identity ||
          hoverLeavesMemo.root !== workspace.root ||
          hoverLeavesMemo.revision !== workspace.runtime.graph.revision
        ) {
          // The Components page: an origin sample's slot contents are laid out but not drawn
          // (opacity 0) — no guides of them.
          const drawn = (leaf: string) => {
            for (
              let cursor = records.get(leaf);
              cursor && cursor.id !== identity;
              cursor = records.get(cursor.parentId)
            )
              if (cursor.visual.opacity === 0) return false;
            return true;
          };
          const leaves = isComponentsView(workspace.root.definitionView)
            ? catalogLeafRecords(records, identity).filter(drawn)
            : catalogLeafRecords(records, identity);
          hoverLeavesMemo = {
            identity,
            root: workspace.root,
            revision: workspace.runtime.graph.revision,
            // A leaf hovers alone (its own outline).
            leaves: leaves.length === 1 && leaves[0] === identity ? [] : leaves,
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
          return box
            ? [
                {
                  box,
                  hiddenRows: remainder.hiddenRows,
                  ownerId: remainder.ownerId,
                },
              ]
            : [];
        }),
      // A badge whose anchor a later-painted page covers is neither drawn nor pressed.
      badges: () =>
        badges
          .targets(scene.stream.boundsMap, scene.stream.hitBoundsMap)
          .filter(
            (badge) =>
              !badge.recordId ||
              !occludersOf(badge.recordId).some(
                (rect) =>
                  badge.bounds.x >= rect.x &&
                  badge.bounds.y >= rect.y &&
                  badge.bounds.x <= rect.x + rect.width &&
                  badge.bounds.y <= rect.y + rect.height,
              ),
          ),
      occluders: (identity) => occludersOf(identity),
      badgeHits,
      overflow: () => overflowTree,
      ai: () => useAIVisualFeedbackStore.getState(),
      radiusOf: (id) => getSkiaNode(id)?.box?.borderRadius ?? 0,
      measuring: () => measuring,
      dashedSelection: () => useGridTrackSelection.getState().cell?.identity,
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
    });
    renderer.setOverlayNode(overlay);
    // The overlay follows the session and the scene's boxes (its own version, no content redraw).
    let overlayVersion = 0;
    // The drawn scene's version (not the overlay's — hover · selection do not move a box): the grid
    // cells the overlay outlines are kept per record until the scene changes.
    let cellsVersion = 0;
    const gridCellsCache = new Map<
      string,
      ReturnType<typeof gestures.gridCellsOfRecord>
    >();
    let gridCellsCacheVersion = -1;
    let gridRecords: Set<string> | undefined;
    const gridRecordSet = () => {
      if (!gridRecords) {
        gridRecords = new Set();
        for (const [id, record] of sceneRoot.domInputs) {
          const display = record.layout.display;
          if (display === "grid" || display === "inline-grid")
            gridRecords.add(id);
        }
      }
      return gridRecords;
    };
    // The drag presentation (Figma · Pen.dev): the dragged records drawn on top at the pointer
    // offset (one id set per drag — `setDragVisualOffset` compares it by reference) and the
    // siblings' eased reflow.
    let dragRecords: ReadonlySet<string> | undefined;
    const dragReflow = new CatalogDragReflow();
    let drawnDragRevision = "";
    const invalidateOverlay = () => {
      overlayVersion += 1;
      scheduler.invalidate();
    };
    invalidateOverlayRef.current = invalidateOverlay;
    const themeWatcher = setupThemeWatcher({
      onThemeChange: () => {
        pageBorderColor = readPageBorderColor();
        invalidateOverlay();
      },
    });
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
      itemOfRecord: (record) => workspace.itemOfRecord(record),
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
      // The Styles box model's padding link and the drag the panel follows (ADR-222).
      paddingLinked: getPaddingLinked,
      spacingLive: setCatalogSpacingLive,
      ownFields: (target) => workspace.readModel.ownFields(target),
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
    // ADR-270 Phase 0 (dev): the loads one frame takes (`imageLoadedPerFrameMax`).
    let imagesLoadedInFrame = 0;
    /** Publish the page header frames; true = a frame moved or resized. */
    const publishHeaders = (): boolean => {
      const frames = catalogHeaderFrames(workspace, compareOnlyPage());
      if (sameFrames(frames, publishedFrames)) return false;
      const moved = !sameFrames(
        frames.map((frame) => ({ ...frame, title: "" })),
        publishedFrames.map((frame) => ({ ...frame, title: "" })),
      );
      publishedFrames = frames;
      viewState.publishFrames(frames);
      return moved;
    };
    let orderStale = false;
    const syncScene = () => {
      if (process.env.NODE_ENV === "development" && imagesLoadedInFrame) {
        if (imagesLoadedInFrame > renderCounters.imageLoadedPerFrameMax)
          renderCounters.imageLoadedPerFrameMax = imagesLoadedInFrame;
        imagesLoadedInFrame = 0;
      }
      if (orderStale) {
        orderStale = false;
        try {
          // A page switch changes no record: only the drawn order (no record diff).
          if (!sceneStale && scene.reorder().kind !== "unchanged") {
            renderer.invalidateContent();
            overlayVersion += 1;
            cellsVersion += 1;
          }
        } catch (error) {
          callbacks.current.onError?.(error);
        }
      }
      if (!sceneStale) return;
      sceneStale = false;
      try {
        // A drag's top layer rejects a splice: loaded images wait for its end (which binds again).
        const synced = scene.sync({ holdImages: dragRecords !== undefined });
        if (synced.kind !== "unchanged") {
          // ADR-263 Phase 3: a patch redraws only the area it changed (a rebind draws in full).
          renderer.invalidateContent(catalogSyncDamage(synced));
          overlayVersion += 1;
          cellsVersion += 1;
        }
        // A page grid edit (gap, columns, direction) moves page frames without a record delta,
        // and a rename changes no drawn record: the headers follow, a moved frame is placed
        // (ADR-264 — it binds again only when a frame resized).
        if (publishHeaders() && synced.kind !== "rebound") {
          scene.pageGridChanged();
          renderer.invalidateContent();
          overlayVersion += 1;
          cellsVersion += 1;
        }
      } catch (error) {
        callbacks.current.onError?.(error);
      }
    };
    // `columns: "auto"`: the page grid derives from the monitor width at the grid's fit zoom
    // (ADR-274) — the camera zoom and the panel rails are not inputs, so zooming never moves a
    // page. Only a window moved to another monitor changes this integer; the frames then move.
    const syncScreenWidth = () => {
      const width = window.screen.width;
      if (!width || !workspace.setScreenWidth(width)) return;
      try {
        scene.pageGridChanged();
        renderer.invalidateContent();
        overlayVersion += 1;
        cellsVersion += 1;
        publishHeaders();
      } catch (error) {
        callbacks.current.onError?.(error);
      }
    };
    const renderFrame = () => {
      if (!running || contextLost) return;
      syncScene();
      syncScreenWidth();
      // A drag's presentation (the dragged at the pointer, the siblings easing aside) is drawn at
      // execution from the offsets — the content redraws when they change.
      if (dragRecords) {
        if (dragReflow.tick(performance.now())) scheduler.invalidate();
        setDragSiblingOffsets(dragReflow.offsets());
      }
      const dragRevision = `${getDragVisualOffsetRevision()}:${getDragSiblingOffsetRevision()}`;
      if (dragRevision !== drawnDragRevision) {
        drawnDragRevision = dragRevision;
        renderer.invalidateContent();
      }
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
    // (The root is replaced on a breakpoint or theme switch: the subscription follows it below.)
    let unsubscribePreviews = workspace.root.subscribePreviews(reflowScene);
    const unsubscribeSteps = workspace.runtime.subscribeSteps(() => {
      sceneStale = true;
      gridRecords = undefined;
      // A step may change only document state the overlay reads (a binding's badge).
      overlayVersion += 1;
      cellsVersion += 1;
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
    const unsubscribeGridTracks =
      useGridTrackSelection.subscribe(invalidateOverlay);
    // ADR-270 Phase 1: a loaded image records again only the records that look it up, in the next
    // frame's sync with any other change (a rebind would drop every picture and paragraph, and
    // used to absorb a same-frame edit — 2026-10-05 audit H3 drew nothing until another edit).
    const unsubscribeImages = registerImageLoadCallback((url) => {
      scene.imageLoaded(url);
      sceneStale = true;
      if (process.env.NODE_ENV === "development") imagesLoadedInFrame += 1;
      scheduler.invalidate();
    });
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
    // Another active page may paint on top (where pages overlap): the scene checks its roots.
    // Only a page switch counts — a selection or hover change leaves the order alone.
    let paintedPage = workspace.session.getSnapshot().pageId;
    // The order is checked in the next frame, with the scene sync (one redraw for both).
    const followActivePage = (pageId: typeof paintedPage) => {
      if (pageId === paintedPage) return;
      paintedPage = pageId;
      orderStale = true;
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
      const snapshot = workspace.session.getSnapshot();
      followActivePage(snapshot.pageId);
      // Another selection closes the inline spacing input (its blur no longer applies).
      const input = spacingInputRef.current;
      const selection = snapshot.selection;
      if (
        input &&
        (selection.length !== 1 ||
          selection[0].identity !== input.item.identity)
      )
        closeSpacingInput();
      const editing = snapshot.textEditing?.identity;
      if (editing !== editingText) {
        editingText = editing;
        setEditingElementId(editing ?? null);
        renderer.invalidateContent();
      }
      invalidateOverlay();
    });
    const disconnectBounds = viewState.connectBounds((identity) => {
      syncScene();
      return scene.stream.boundsMap.get(identity);
    });
    // Live harness handle: scene boxes and the camera (screen ↔ scene) — dev, or a G5 harness build.
    if (
      import.meta.env.DEV ||
      import.meta.env.VITE_COMPOSITION_HARNESS === "1"
    ) {
      const handle = ((
        window as unknown as Record<string, unknown>
      ).__COMPOSITION_CATALOG__ ??= {}) as Record<string, unknown>;
      handle.canvas = {
        boundsOf: (id: string) => viewState.boundsOf(id),
        camera: () => ({ ...viewportState }),
        // The drag in progress as the overlay draws it (live drag-and-drop checks).
        drag: () => gestures.preview(),
        // A grid's cells as the overlay outlines them while selected (live checks).
        gridCells: (identity: string) => overlayGridCells(identity),
        // ADR-264 oracle: the stream's boxes now, and the same state bound again from the records.
        streamBoxes: () => ({
          bounds: Object.fromEntries(scene.stream.boundsMap),
          hit: Object.fromEntries(scene.stream.hitBoundsMap),
        }),
        // Ids the SpatialIndex hits at a scene point (picking's candidates).
        hitAt: (x: number, y: number) => hitTestPoint(x, y),
        // ADR-269: whether a record is a scroll/auto box with somewhere to scroll (the wheel target).
        scrollable: (identity: string) => scene.scrollable(identity),
        rebind: () => {
          scene.rebuild();
          renderer.invalidateContent();
          invalidateOverlay();
        },
        // Sets the camera exactly (a frozen G3 baseline's zoom · pan).
        setCamera: (next: { scale: number; x: number; y: number }) =>
          void import("../viewport/viewportActions").then((actions) =>
            actions.applyViewportState(next),
          ),
      };
    }
    const unsubscribeRoot = workspace.subscribeRoot(() => {
      gridRecords = undefined; // another breakpoint's records (a grid only there)
      // …and their cells at this breakpoint's size. **Why (2026-10-16)**: the cache kept the last
      // breakpoint's cells until the next step (사용자 보고 — Mobile 에서 desktop 칸 크기).
      cellsVersion += 1;
      // The new root's previews re-lay the scene out too. **Why (2026-10-15)**: the subscription
      // stayed on the first root, so after a switch to Tablet · Mobile a Styles drag drew nothing
      // until its commit (사용자 보고 — Menu 의 Button border · fill).
      unsubscribePreviews();
      unsubscribePreviews = workspace.root.subscribePreviews(reflowScene);
      try {
        sceneRoot = workspace.root;
        scene.replaceRoot(sceneRoot);
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

    // "Go to component": fit that component's card (after the new root's own camera settles).
    const unsubscribeRevealRecord = workspace.subscribeRevealRecord(
      (identity) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const rect = viewState.boundsOf(identity);
            const { width, height } = containerEl.getBoundingClientRect();
            if (rect && width && height)
              fitCatalogPageFrame(rect, { width, height }, 1);
          }),
        );
      },
    );

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
    /**
     * The first element of a multi-selection whose union box holds the point, else undefined
     * (a single element's box is the element itself; page bodies are not dragged this way).
     */
    const selectionBoxLeader = (
      items: readonly { identity: string }[],
      px: number,
      py: number,
    ): string | undefined => {
      const elements = items.filter(
        (item) =>
          workspace.root.domInputs.get(item.identity)?.parentId !==
          "catalog:root",
      );
      if (elements.length < 2) return undefined;
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const item of elements) {
        const box = viewState.boundsOf(item.identity);
        if (!box) return undefined;
        left = Math.min(left, box.x);
        top = Math.min(top, box.y);
        right = Math.max(right, box.x + box.width);
        bottom = Math.max(bottom, box.y + box.height);
      }
      return px >= left && px <= right && py >= top && py <= bottom
        ? elements[0]!.identity
        : undefined;
    };
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
      if (
        !isComponentsView(workspace.root.definitionView) &&
        gestures.beginResize(x, y, zoomNow())
      ) {
        gestureSession.promoteElement(event.pointerId, "resize");
        picking.leave();
        return;
      }
      const additive = event.shiftKey;
      const deep = event.metaKey || event.ctrlKey;
      const target = picking.target(x, y, deep);
      const selectionItems = workspace.session.getSnapshot().selection;
      const selected = selectionItems.some(
        (item) => item.identity === target?.id,
      );
      const pageRoot =
        !!target &&
        workspace.root.domInputs.get(target.id)?.parentId === "catalog:root";
      // A multi-selection's bounding box is its drag handle: a press on empty space (or the page)
      // inside it drags the selection instead of starting a marquee (the old selection model).
      const inSelectionBox =
        !additive &&
        (!target || pageRoot) &&
        selectionBoxLeader(selectionItems, x, y);
      if (inSelectionBox) {
        gestures.beginMove(x, y, inSelectionBox, { copy: event.altKey });
        rehover();
        return;
      }
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
    const showDrag = () => {
      const view = gestures.dragPresentation();
      if (!view) return;
      // Figma: opaque in its own container, translucent over another one.
      const alpha = view.outside ? DRAG_OUTSIDE_ALPHA : 1;
      if (!dragRecords) {
        if (!view.records.length && !view.siblings.size) return;
        dragRecords = new Set(view.records);
        setDragVisualOffset(dragRecords, view.dx, view.dy, true, alpha);
        // The dragged subtree moves to the stream's top layer (drawn over everything, unclipped).
        try {
          scene.refresh();
        } catch (error) {
          callbacks.current.onError?.(error);
        }
      } else setDragVisualOffset(dragRecords, view.dx, view.dy, true, alpha);
      dragReflow.setTargets(view.siblings);
      scheduler.invalidate();
    };
    const endDrag = () => {
      if (!dragRecords) return;
      dragRecords = undefined;
      dragReflow.clear();
      setDragSiblingOffsets(null);
      setDragVisualOffset(null, 0, 0, true);
      try {
        scene.refresh();
      } catch (error) {
        callbacks.current.onError?.(error);
      }
      scheduler.invalidate();
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
          // Figma: ⌘ (Ctrl elsewhere) lets a larger object into a smaller container; Control on
          // a Mac drops a flow node absolutely (Ignore auto layout · Framer ⌃ drag).
          bypassSize: IS_MAC ? event.metaKey : event.ctrlKey,
          absolute: IS_MAC && event.ctrlKey,
        })
      ) {
        deferredSelect = undefined;
        picking.leave();
        showDrag();
        invalidateOverlay();
      }
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId === pressPointer) {
        pressPointer = undefined;
        endDrag();
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
        // Nothing to enter: a double click on an element with its own text edits it inline — or
        // the text under the pointer inside a container it cannot enter (a Card's title).
        const target = picking.target(x, y, false);
        const picked = picking.pick(x, y);
        const records = workspace.root.domInputs;
        const id =
          target &&
          picked &&
          resolveCatalogTextEditRecord(
            records,
            picked,
            target.id,
            // (A text a part inside draws — a field's · group's `label` on its Label — is that
            // part's to edit, not the whole box's.)
            (record) =>
              catalogHasOwnText(
                workspace.runtime.graph.library,
                records,
                record,
                catalogTextKey,
              ),
          );
        const item = id && workspace.itemOfRecord(id);
        if (item) {
          if (id !== target!.id) workspace.selectRecords([id]);
          workspace.session.startTextEdit(item);
        }
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
        endDrag();
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
        { x, y },
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
    const releaseEscape = registerKeyboardEventHandler("keydown", onKeyDown);
    const releaseAltDown = registerKeyboardEventHandler("keydown", onAltKey);
    const releaseAltUp = registerKeyboardEventHandler("keyup", onAltKey);
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
        renderer.contextLost();
        updatePaused();
        setSurfaceLost(true);
      },
      () => {
        contextLost = false;
        setSurfaceLost(false);
        renderer.contextRestored(canvas);
        renderer.invalidateContent();
        renderer.clearFrame();
        updatePaused();
      },
    );
    const refit = () => {
      dpr = window.devicePixelRatio || 1;
      // Border widths snap to device pixels (the engine's `ClampLineWidth`): a new ratio lays the
      // document out again in a new root (its listeners rebuild the scene).
      setBorderSnapRatio(dpr);
      workspace.setDevicePixelRatio(dpr);
      fit();
      renderer.resize(canvas);
      renderer.invalidateContent();
      renderer.clearFrame();
      // Setting the canvas size cleared its bitmap, and this callback runs after this frame's
      // animation frame: draw now, or the browser paints the cleared canvas (a blank flash on
      // every step of a window resize).
      renderFrame();
    };
    const resize = new ResizeObserver(refit);
    resize.observe(containerEl);
    // The pixel ratio changes without a resize (the window moves to another display): the
    // backing store follows, so the drawing stays sharp (the old SkiaCanvas's dppx query).
    let dprQuery = matchMedia(`(resolution: ${dpr}dppx)`);
    const onDprChange = () => {
      dprQuery.removeEventListener("change", onDprChange);
      refit();
      dprQuery = matchMedia(`(resolution: ${dpr}dppx)`);
      dprQuery.addEventListener("change", onDprChange);
    };
    dprQuery.addEventListener("change", onDprChange);
    renderer.invalidateContent();
    updatePaused();

    return () => {
      running = false;
      resize.disconnect();
      themeWatcher.disconnect();
      dprQuery.removeEventListener("change", onDprChange);
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
      releaseEscape();
      releaseAltDown();
      releaseAltUp();
      window.removeEventListener("blur", onWindowBlur);
      unsubscribeRoot();
      unsubscribeData();
      unsubscribeAi();
      unsubscribeGridTracks();
      unsubscribeImages();
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
      unsubscribeRevealRecord();
      cancelPanAnimation();
      setEditingElementId(null);
      sceneRef.current = undefined;
      unsubscribeSession();
      unsubscribeSteps();
      unsubscribePreviews();
      unsubscribeRows();
      unsubscribeFrames();
      scheduler.dispose();
      overlay.dispose();
      disconnectBounds();
      scene.dispose();
      renderer.dispose();
    };
  }, [workspace, containerEl, gestureSession, closeSpacingInput, viewState]);

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
      <CatalogGridTrackLayer
        workspace={workspace}
        tracksOf={readGridTracks}
        gestureActive={readGestureActive}
        boundsOf={readBounds}
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
