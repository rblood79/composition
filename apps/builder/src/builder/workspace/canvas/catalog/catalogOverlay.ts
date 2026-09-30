import type { CanvasKit, FontMgr } from "canvaskit-wasm";
import type { CatalogGesturePreview } from "../../../catalogRuntime/canvasGesture";
import type { CatalogSessionState } from "../../../catalogRuntime/session";
import type { BoundingBox } from "../selection/types";
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
import type { SkiaRenderable } from "../skia/types";

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
        if (gesture.line)
          renderSelectionBox(ck, canvas, gesture.line, zoom / 2);
        return;
      }
      const single =
        state.selection.length === 1 &&
        !state.textEditing &&
        bounds.get(state.selection[0].identity);
      if (single) {
        renderTransformHandles(ck, canvas, single, zoom);
        renderDimensionLabels(ck, canvas, single, zoom, inputs.fontMgr());
      }
    },
  };
}
