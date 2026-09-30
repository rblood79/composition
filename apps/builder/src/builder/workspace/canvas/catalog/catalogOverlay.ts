import type { Canvas, CanvasKit, FontMgr } from "canvaskit-wasm";
import type { CatalogGesturePreview } from "../../../catalogRuntime/canvasGesture";
import type { CatalogSessionState } from "../../../catalogRuntime/session";
import { calculateCombinedBounds, type BoundingBox } from "../selection/types";
import { resolveMeasureGuides } from "../interaction/measureGuides";
import {
  renderEditingContextBorder,
  renderHoverHighlight,
} from "../skia/hoverRenderer";
import {
  renderDimensionLabels,
  renderLasso,
  renderSelectionBox,
  renderTransformHandles,
} from "../skia/selectionRenderer";
import { renderSlotHatchPattern } from "../skia/slotMarkerRenderer";
import {
  renderMeasureGuides,
  renderSnapGuides,
} from "../skia/snapGuideRenderer";
import { renderSpacingOverlay } from "../skia/spacingOverlayRenderer";
import type { SkiaRenderable } from "../skia/types";
import type { SpacingBand } from "../interaction/spacingGeometry";

export interface CatalogOverlayInputs {
  session: () => CatalogSessionState;
  /** Scene-coordinate boxes of the drawn records (the bound stream's `boundsMap`). */
  bounds: () => ReadonlyMap<string, BoundingBox>;
  /** The drawn records of a node (the editing context's frame). */
  recordsOf: (sourceId: string) => readonly string[];
  zoom: () => number;
  fontMgr: () => FontMgr | undefined;
  /** The drag in progress (move ghost, drop line and container, or the resized box). */
  gesture?: () => CatalogGesturePreview | undefined;
  /**
   * Declared slots of the definition edit view (editor chrome, not document paint): each slot's
   * box, hatched while it holds nothing.
   */
  slots?: () => readonly { box: BoundingBox; empty: boolean }[];
  /** Manual guides (ADR-181), painted under the selection. */
  guides?: (canvas: Canvas) => void;
  /** Alt is held: measure from the selection to the hovered record (Figma's Alt-measure). */
  measuring?: () => boolean;
  /** Spacing handles of the selected container when no gesture runs (ADR-222). */
  spacing?: () =>
    | {
        bands: readonly SpacingBand[];
        clipRect: BoundingBox | null;
        hoveredBandId: string | null;
      }
    | undefined;
}

/** The box around every selected record (one selection: its own box). */
export function catalogSelectionBox(
  state: Pick<CatalogSessionState, "selection">,
  bounds: ReadonlyMap<string, BoundingBox>,
): BoundingBox | null {
  return calculateCombinedBounds(
    state.selection.flatMap((item) => {
      const box = bounds.get(item.identity);
      return box ? [box] : [];
    }),
  );
}

/**
 * Alt-measure: the distances from the selection's box to the hovered record — none while Alt is
 * up, nothing is selected or the hovered record is itself selected.
 */
export function catalogMeasureGuides(
  state: Pick<CatalogSessionState, "selection" | "hover">,
  bounds: ReadonlyMap<string, BoundingBox>,
  measuring: boolean,
) {
  const hovered = state.hover?.identity;
  if (
    !measuring ||
    !hovered ||
    state.selection.some((item) => item.identity === hovered)
  )
    return [];
  const selection = catalogSelectionBox(state, bounds);
  const target = bounds.get(hovered);
  return selection && target ? resolveMeasureGuides(selection, target) : [];
}

/**
 * ADR-248 Phase 4e-3: the Canvas editing overlay of the open project — the entered context's
 * frame, the hovered record, the selected records' boxes and (one selection) the transform handles
 * and size label. It reads the session and the bound stream's boxes per frame (scene coordinates;
 * the renderer draws it inside the camera transform) and reuses the existing overlay painters.
 */
export function catalogOverlayNode(
  ck: CanvasKit,
  inputs: CatalogOverlayInputs,
): SkiaRenderable {
  return {
    renderSkia: (canvas) => {
      const state = inputs.session();
      const bounds = inputs.bounds();
      const zoom = inputs.zoom();
      for (const slot of inputs.slots?.() ?? []) {
        // An empty slot has no height of its own: show a band the author can see and pick.
        const band = Math.max(slot.box.height, 48 / zoom);
        renderSlotHatchPattern(
          ck,
          canvas,
          { ...slot.box, height: band },
          zoom,
          "origin",
          slot.empty,
        );
      }
      inputs.guides?.(canvas);
      if (state.editingContext)
        for (const id of inputs.recordsOf(state.editingContext)) {
          const box = bounds.get(id);
          if (box) renderEditingContextBorder(ck, canvas, box, zoom);
        }
      const selected = new Set(state.selection.map((item) => item.identity));
      const hovered = state.hover && bounds.get(state.hover.identity);
      if (hovered && !selected.has(state.hover!.identity))
        renderHoverHighlight(ck, canvas, hovered, zoom);
      for (const item of state.selection) {
        const box = bounds.get(item.identity);
        if (box) renderSelectionBox(ck, canvas, box, zoom);
      }
      const gesture = inputs.gesture?.();
      if (gesture) {
        for (const box of gesture.highlights ?? [])
          renderHoverHighlight(ck, canvas, box, zoom);
        if (gesture.marquee) renderLasso(ck, canvas, gesture.marquee, zoom);
        if (gesture.container)
          renderHoverHighlight(ck, canvas, gesture.container, zoom);
        if (gesture.ghost) renderLasso(ck, canvas, gesture.ghost, zoom);
        if (gesture.snapGuides?.length)
          renderSnapGuides(
            ck,
            canvas,
            gesture.snapGuides,
            zoom,
            inputs.fontMgr(),
          );
        if (gesture.spacing)
          renderSpacingOverlay(ck, canvas, {
            bands: gesture.spacing.bands,
            clipRect: null,
            hoveredBandId: null,
            active: gesture.spacing.active,
            zoom,
            fontMgr: inputs.fontMgr(),
          });
        if (gesture.line)
          renderSelectionBox(ck, canvas, gesture.line, zoom / 2);
        return;
      }
      if (state.textEditing) return;
      // A multi-selection also shows the box around it all, with its size (the handles only
      // mark it: a resize takes one element).
      const box = catalogSelectionBox(state, bounds);
      if (box && state.selection.length > 1)
        renderSelectionBox(ck, canvas, box, zoom);
      if (box) {
        renderTransformHandles(ck, canvas, box, zoom);
        renderDimensionLabels(ck, canvas, box, zoom, inputs.fontMgr());
      }
      const measure = catalogMeasureGuides(
        state,
        bounds,
        inputs.measuring?.() ?? false,
      );
      if (measure.length)
        renderMeasureGuides(ck, canvas, measure, zoom, inputs.fontMgr());
      if (box && state.selection.length === 1) {
        const spacing = inputs.spacing?.();
        if (spacing)
          renderSpacingOverlay(ck, canvas, {
            ...spacing,
            active: null,
            zoom,
            fontMgr: inputs.fontMgr(),
          });
      }
    },
  };
}
