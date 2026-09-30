import type { Canvas, CanvasKit } from "canvaskit-wasm";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import {
  catalogDeleteGuideCommand,
  catalogGuideDragAt,
  catalogGuideDragCommand,
  catalogGuidesByPage,
  catalogGuideTargets,
  catalogPageAt,
  catalogPageGuides,
} from "../../../catalogRuntime/pageGuides";
import { useStore } from "../../../stores";
import { guideCursorForAxis } from "../../components/rulerMetrics";
import { isRulerEventTarget } from "../../components/rulerOverlayUtils";
import {
  clearGuideSelection,
  getSelectedGuide,
  resolveGuideEmphasis,
  resolveGuideEmphasisIdsForPage,
  setHoveredGuide,
  setSelectedGuide,
} from "../interaction/guideEmphasis";
import {
  GUIDE_HIT_THRESHOLD_SCREEN_PX,
  buildGuideHitTargets,
  resolveGuideHit,
  type GuideHitTarget,
} from "../interaction/guideHitTest";
import {
  beginGuideDrag,
  endGuideDrag,
  getGuideDrag,
  mergeGuideDrag,
  publishGuideDrag,
  resolveGuideDragPreview,
  type GuideDragState,
} from "../interaction/guidePresentation";
import { subscribePageGuideRevision } from "../interaction/pageGuideRevision";
import {
  renderGuideDragPreview,
  renderGuideExtension,
  renderPageGuides,
} from "../skia/guideRenderer";

/** Click vs drag (screen px) — the old guide drag's threshold. */
const GUIDE_DRAG_THRESHOLD_PX = 3;

type ScenePoint = { x: number; y: number };

export interface CatalogGuideBinding {
  /** A press on a ruler strip: drag a new guide out (a horizontal strip makes a "y" guide). */
  startCreate(
    axis: "x" | "y",
    pointerId: number,
    clientX: number,
    clientY: number,
  ): void;
  /** A Canvas press: on a guide (rulers shown) it starts moving it — true = the press is taken. */
  press(event: PointerEvent): boolean;
  /** Hover: the guide cursor (or `undefined` off every guide). */
  hover(event: PointerEvent): string | undefined;
  leave(): void;
  /** Paint the guides, the dragged guide and its preview (scene coordinates). */
  paint(ck: CanvasKit, canvas: Canvas): void;
  dispose(): void;
}

/**
 * ADR-248 Phase 4e: the Canvas's manual guides (ADR-181) over the catalog document. Rulers are a
 * Builder view setting (`showRulers`); guides are the pages' `guideEntries` at the session
 * breakpoint. A drag writes nothing until it ends (one `updatePage` step); the drag state,
 * emphasis and painters are the old Canvas's store-free modules.
 */
export function bindCatalogGuides(options: {
  workspace: CatalogWorkspace;
  canvas: HTMLCanvasElement;
  scenePoint: (event: { clientX: number; clientY: number }) => ScenePoint;
  zoom: () => number;
  /** The Canvas size in CSS px (the drag preview spans the visible scene). */
  viewport: () => { x: number; y: number; width: number; height: number };
  invalidateOverlay: () => void;
  onError: (error: unknown) => void;
}): CatalogGuideBinding {
  const { workspace } = options;
  const rulersShown = () => useStore.getState().showRulers;
  const breakpoint = () => workspace.session.getSnapshot().breakpoint;
  const frames = () => workspace.root.pageFrameRects();

  let release: (() => void) | undefined;
  const begin = (
    initial: GuideDragState,
    pointerId: number,
    clientX: number,
    clientY: number,
  ) => {
    release?.();
    beginGuideDrag(initial);
    let moved = false;
    const passed = (x: number, y: number) =>
      (moved ||=
        Math.abs(x - clientX) > GUIDE_DRAG_THRESHOLD_PX ||
        Math.abs(y - clientY) > GUIDE_DRAG_THRESHOLD_PX);
    const publishAt = (x: number, y: number) => {
      const drag = getGuideDrag();
      if (!drag) return;
      publishGuideDrag(
        catalogGuideDragAt(
          drag,
          options.scenePoint({ clientX: x, clientY: y }),
          isRulerEventTarget(document.elementFromPoint(x, y)),
          frames(),
        ),
      );
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (passed(event.clientX, event.clientY))
        publishAt(event.clientX, event.clientY);
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (!passed(event.clientX, event.clientY)) {
        // A click: a guide is selected where it is; a ruler press makes nothing.
        const clicked = getGuideDrag();
        stop();
        if (clicked?.kind === "move" && clicked.originPageId)
          setSelectedGuide({
            pageId: clicked.originPageId,
            guideId: clicked.guideId,
          });
        return;
      }
      publishAt(event.clientX, event.clientY);
      const drag = getGuideDrag();
      stop();
      if (!drag) return;
      try {
        const command = catalogGuideDragCommand(
          workspace.runtime.graph,
          drag,
          breakpoint(),
        );
        if (command) workspace.execute(command);
      } catch (error) {
        options.onError(error);
        return;
      }
      // The guide is selected after the drag (the old Canvas's idiom); a deleted one is not.
      if (drag.removing) {
        if (getSelectedGuide()?.guideId === drag.guideId) clearGuideSelection();
      } else {
        const pageId = drag.kind === "move" ? drag.originPageId : drag.pageId;
        if (pageId) setSelectedGuide({ pageId, guideId: drag.guideId });
      }
    };
    const onCancel = (event: PointerEvent) => {
      if (event.pointerId === pointerId) stop();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      stop();
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", stop);
      window.removeEventListener("keydown", onKey, true);
      release = undefined;
      endGuideDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", stop);
    window.addEventListener("keydown", onKey, true);
    release = stop;
    publishAt(clientX, clientY);
  };

  const hitAt = (point: ScenePoint): GuideHitTarget | null => {
    const all = frames();
    const pageId = catalogPageAt(all, point);
    const frame = pageId ? all.get(pageId) : undefined;
    if (!pageId || !frame) return null;
    const guides = catalogPageGuides(
      workspace.runtime.graph,
      pageId,
      breakpoint(),
    );
    if (!guides.length) return null;
    return resolveGuideHit(
      point,
      buildGuideHitTargets(pageId, guides, frame, frame),
      GUIDE_HIT_THRESHOLD_SCREEN_PX / options.zoom(),
    );
  };

  // Delete removes the selected guide before the element shortcuts see the key; Escape
  // deselects it.
  const onKeyDown = (event: KeyboardEvent) => {
    const selected = getSelectedGuide();
    if (!selected || getGuideDrag()) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.isContentEditable ||
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA"
    )
      return;
    if (event.key === "Escape") {
      clearGuideSelection();
      event.stopImmediatePropagation();
      return;
    }
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearGuideSelection();
    try {
      const command = catalogDeleteGuideCommand(
        workspace.runtime.graph,
        selected.pageId,
        selected.guideId,
        breakpoint(),
      );
      if (command) workspace.execute(command);
    } catch (error) {
      options.onError(error);
    }
  };
  window.addEventListener("keydown", onKeyDown, true);
  // Drag, hover and selection changes redraw the overlay (no document step).
  const unwatchRevision = subscribePageGuideRevision(options.invalidateOverlay);
  // Rulers off: nothing stays hovered or selected (guides cannot be grabbed then).
  const unwatchRulers = useStore.subscribe((state, previous) => {
    if (state.showRulers === previous.showRulers) return;
    if (!state.showRulers) {
      setHoveredGuide(null);
      clearGuideSelection();
    }
    options.invalidateOverlay();
  });

  return {
    startCreate(axis, pointerId, clientX, clientY) {
      begin(
        {
          kind: "create",
          guideId: `guide-${Math.random().toString(36).slice(2, 10)}`,
          axis,
          pageId: null,
          position: 0,
          removing: false,
          originPageId: null,
          originPosition: 0,
          scenePosition: null,
        },
        pointerId,
        clientX,
        clientY,
      );
    },
    press(event) {
      if (!rulersShown()) return false;
      const hit = hitAt(options.scenePoint(event));
      if (!hit) {
        clearGuideSelection();
        return false;
      }
      const frame = frames().get(hit.pageId)!;
      const position =
        hit.scenePosition - (hit.axis === "x" ? frame.x : frame.y);
      begin(
        {
          kind: "move",
          guideId: hit.guideId,
          axis: hit.axis,
          pageId: hit.pageId,
          position,
          removing: false,
          originPageId: hit.pageId,
          originPosition: position,
          scenePosition: hit.scenePosition,
        },
        event.pointerId,
        event.clientX,
        event.clientY,
      );
      return true;
    },
    hover(event) {
      if (!rulersShown() || getGuideDrag()) return undefined;
      const hit = hitAt(options.scenePoint(event));
      setHoveredGuide(
        hit ? { pageId: hit.pageId, guideId: hit.guideId } : null,
      );
      return hit ? guideCursorForAxis(hit.axis) : undefined;
    },
    leave() {
      setHoveredGuide(null);
    },
    paint(ck, canvas) {
      const drag = getGuideDrag();
      const guidesByPage = mergeGuideDrag(
        catalogGuidesByPage(workspace.runtime.graph, breakpoint()),
        drag,
      );
      const zoom = options.zoom();
      for (const target of catalogGuideTargets(guidesByPage, frames())) {
        // The dragged guide is emphasized like a hovered one (unless it is being deleted).
        const emphasis =
          drag && !drag.removing && drag.pageId === target.pageId
            ? {
                ...resolveGuideEmphasisIdsForPage(target.pageId),
                hoveredGuideId: drag.guideId,
              }
            : resolveGuideEmphasisIdsForPage(target.pageId);
        renderPageGuides(ck, canvas, target, zoom, emphasis);
        if (!emphasis.selectedGuideId && !emphasis.hoveredGuideId) continue;
        for (const line of target.lines) {
          const kind = resolveGuideEmphasis(line.id, emphasis);
          if (kind !== "default")
            renderGuideExtension(
              ck,
              canvas,
              line,
              target.pageRect,
              options.viewport(),
              zoom,
              kind,
            );
        }
      }
      const preview = resolveGuideDragPreview(drag);
      if (preview)
        renderGuideDragPreview(ck, canvas, preview, options.viewport(), zoom);
    },
    dispose() {
      release?.();
      window.removeEventListener("keydown", onKeyDown, true);
      unwatchRevision();
      unwatchRulers();
      setHoveredGuide(null);
    },
  };
}
