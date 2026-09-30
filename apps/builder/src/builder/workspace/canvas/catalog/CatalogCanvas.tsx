import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CatalogCanvasGestures } from "../../../catalogRuntime/canvasGesture";
import { catalogCanvasMenuItems } from "../../../catalogRuntime/canvasMenu";
import { catalogMenuHost } from "../../../catalogRuntime/shortcuts";
import { catalogPageDropCommand } from "../../../catalogRuntime/canvasPage";
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
import { useViewportSyncStore } from "../stores";
import { fitCatalogPageFrame } from "./catalogViewport";
import { hitTestPoint } from "../wasm-bindings/spatialIndex";
import { resolveSpacingCursor } from "../interaction/spacingGeometry";
import { catalogOverlayNode } from "./catalogOverlay";
import { CatalogTextEditor } from "./CatalogTextEditor";

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
  const [menu, setMenu] = useState<{
    request: ContextMenuRequest;
    items: ContextMenuItem[];
  } | null>(null);
  const callbacks = useRef({ onFirstFrame, onError });
  useLayoutEffect(() => {
    callbacks.current = { onFirstFrame, onError };
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
    let scene: CatalogCanvasScene;
    try {
      scene = new CatalogCanvasScene(workspace.root);
    } catch (error) {
      renderer.dispose();
      callbacks.current.onError?.(error);
      return;
    }
    sceneRef.current = scene;
    const fontMgr = () =>
      skiaFontManager.getFamilies().length > 0
        ? skiaFontManager.getFontMgr()
        : undefined;
    renderer.setContentNode(scene.contentNode(ck, fontMgr));
    renderer.setOverlayNode(
      catalogOverlayNode(ck, {
        session: workspace.session.getSnapshot,
        bounds: () => scene.stream.boundsMap,
        recordsOf: (sourceId) => workspace.root.recordsOfSource(sourceId),
        zoom: () => Math.max(viewportState.zoom, 0.001),
        fontMgr,
        gesture: () => gestures.preview(),
        spacing: () => {
          const owner = gestures.spacingOwner();
          if (!owner) return undefined;
          return {
            bands: gestures.spacingBands(),
            clipRect: scene.stream.hitBoundsMap.get(owner.id) ?? null,
            hoveredBandId: spacingHover,
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
    const picking = new CatalogCanvasPicking({
      get records() {
        return workspace.root.domInputs;
      },
      session: workspace.session,
      get stream() {
        return scene.stream;
      },
      query: hitTestPoint,
      selectRecords: (ids, options) => workspace.selectRecords(ids, options),
      itemOf: (id) => workspace.itemOfRecord(id),
    });
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
      pageDropCommand: (page, topLeft) =>
        catalogPageDropCommand(
          workspace.root,
          page as Parameters<typeof catalogPageDropCommand>[1],
          topLeft,
        ),
    });

    // Open on the first page frame (again after a breakpoint switch: the page size changes).
    const fitFirstPage = (containerSize: { width: number; height: number }) => {
      const [firstPage] = workspace.root.pageFrameRects().values();
      if (firstPage) fitCatalogPageFrame(firstPage, containerSize);
    };
    fitFirstPage(containerRect);

    let running = true;
    let presented = false;
    let contextLost = false;
    let sceneStale = false;
    const syncScene = () => {
      if (!sceneStale) return;
      sceneStale = false;
      try {
        if (scene.sync().kind !== "unchanged") {
          renderer.invalidateContent();
          overlayVersion += 1;
        }
      } catch (error) {
        callbacks.current.onError?.(error);
      }
    };
    const renderFrame = () => {
      if (!running || contextLost) return;
      syncScene();
      const zoom = Math.max(viewportState.zoom, 0.001);
      const camera = { zoom, panX: viewportState.x, panY: viewportState.y };
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
    };
    const scheduler = createFrameScheduler(renderFrame);
    const unsubscribeFrames = subscribeCanvasFrames(scheduler.invalidate);
    // A step listener runs before the root's own subscribers deliver the step's per-node deltas
    // (`CatalogRuntime.step`), so the scene follows at the next frame (or pick), not inside it.
    const unsubscribeSteps = workspace.runtime.subscribeSteps(() => {
      sceneStale = true;
      scheduler.invalidate();
    });
    // Data rows re-resolved outside a step (the data store): the same per-node deltas.
    const unsubscribeRows = workspace.subscribeRows(() => {
      sceneStale = true;
      scheduler.invalidate();
    });
    // The record whose text is edited inline: the Canvas leaves its text out while the DOM field
    // shows it (the renderer's editing element skips that node's picture cache).
    let editingText: string | undefined;
    const unsubscribeSession = workspace.session.subscribe(() => {
      const editing = workspace.session.getSnapshot().textEditing?.identity;
      if (editing !== editingText) {
        editingText = editing;
        setEditingElementId(editing ?? null);
        renderer.invalidateContent();
      }
      invalidateOverlay();
    });
    // Dev-only live harness handle: scene boxes and the camera (screen ↔ scene).
    if (import.meta.env.DEV) {
      const handle = ((
        window as unknown as Record<string, unknown>
      ).__COMPOSITION_CATALOG__ ??= {}) as Record<string, unknown>;
      handle.canvas = {
        boundsOf: (id: string) => {
          syncScene();
          return scene.stream.boundsMap.get(id);
        },
        camera: () => ({ ...viewportState }),
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
      fitFirstPage(containerEl.getBoundingClientRect());
      renderer.invalidateContent();
      invalidateOverlay();
    });

    // Pages tree select: center that page frame at the current zoom (the old `panToPage`).
    const unsubscribeReveal = workspace.subscribeReveal((pageId) => {
      const frame = workspace.root.pageFrameRects().get(pageId);
      if (!frame) return;
      const { width, height } = containerEl.getBoundingClientRect();
      const zoom = Math.max(viewportState.zoom, 0.001);
      getViewportController().setPosition(
        width / 2 - (frame.x + frame.width / 2) * zoom,
        height / 2 - (frame.y + frame.height / 2) * zoom,
        zoom,
      );
    });

    // Pointer picking (scene coordinates from the camera). Pan owns its pointer (viewport bridge).
    const scenePoint = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const zoom = Math.max(viewportState.zoom, 0.001);
      return {
        x: (event.clientX - rect.left - viewportState.x) / zoom,
        y: (event.clientY - rect.top - viewportState.y) / zoom,
      };
    };
    // The spacing band under the pointer (hatched; its handle starts a padding/gap drag).
    let spacingHover: string | null = null;
    // The last hovered scene point: a click, double click or Escape changes what a click there
    // selects (the context), so hover follows it without waiting for the next move.
    let lastPoint: { x: number; y: number } | undefined;
    const rehover = () => {
      if (lastPoint && !gestureSession.shouldSuppressElementHover())
        picking.hover(lastPoint.x, lastPoint.y);
    };
    const zoomNow = () => Math.max(viewportState.zoom, 0.001);
    // A press on an already selected element keeps the selection (a multi-selection drags
    // together); a release without a drag then selects that element alone.
    let deferredSelect: string | undefined;
    let pressPointer: number | undefined;
    const onPointerDown = (event: PointerEvent) => {
      // Only the primary button selects and drags (the secondary opens the context menu).
      if (event.button !== 0) return;
      if (gestureSession.blocksPointerDown(event.pointerId)) return;
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
          gestures.beginMove(x, y, target.id);
        }
      } else {
        const picked = picking.click(x, y, { additive, deep });
        // The page background (a page body or off every page) starts a marquee.
        if (
          !picked ||
          workspace.root.domInputs.get(picked)?.parentId === "catalog:root"
        )
          gestures.beginMarquee(x, y, additive);
        else if (!additive) gestures.beginMove(x, y, picked);
      }
      rehover();
    };
    const onWindowPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pressPointer || !gestures.pending) return;
      const { x, y } = scenePoint(event);
      if (gestures.update(x, y, zoomNow(), { axisLock: event.shiftKey })) {
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
        }
        if (deferredSelect) workspace.selectRecords([deferredSelect]);
        deferredSelect = undefined;
        invalidateOverlay();
      }
      if (gestureSession.ownerFor(event.pointerId) !== "pan")
        gestureSession.endPointer(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.buttons !== 0 || gestureSession.shouldSuppressElementHover()) {
        picking.leave();
        return;
      }
      syncScene();
      const { x, y } = scenePoint(event);
      lastPoint = { x, y };
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
        catalogMenuHost(workspace, (error) =>
          callbacks.current.onError?.(error),
        ),
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
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("keydown", onKeyDown);

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
      },
      () => {
        contextLost = false;
        renderer.resize(canvas);
        renderer.invalidateContent();
        renderer.clearFrame();
        updatePaused();
      },
    );
    const resize = new ResizeObserver(() => {
      dpr = window.devicePixelRatio || 1;
      fit();
      renderer.resize(canvas);
      renderer.invalidateContent();
      renderer.clearFrame();
    });
    resize.observe(containerEl);
    renderer.invalidateContent();
    updatePaused();

    return () => {
      running = false;
      resize.disconnect();
      unwatchContext();
      document.removeEventListener("visibilitychange", updatePaused);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("dblclick", onDoubleClick);
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("keydown", onKeyDown);
      unsubscribeRoot();
      unsubscribeReveal();
      setEditingElementId(null);
      sceneRef.current = undefined;
      unsubscribeSession();
      unsubscribeSteps();
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
      <ContextMenuOverlay
        isOpen={!!menu}
        request={menu?.request ?? null}
        items={menu?.items ?? []}
        onClose={() => setMenu(null)}
      />
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
