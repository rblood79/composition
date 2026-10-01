import type { Canvas, CanvasKit, FontMgr } from "canvaskit-wasm";
import type { CatalogGesturePreview } from "../../../catalogRuntime/canvasGesture";
import type { CatalogSessionState } from "../../../catalogRuntime/session";
import { calculateCombinedBounds, type BoundingBox } from "../selection/types";
import { resolveMeasureGuides } from "../interaction/measureGuides";
import {
  renderEditingContextBorder,
  renderHoverHighlight,
  renderOverflowContent,
  renderOverflowHatching,
} from "../skia/hoverRenderer";
import {
  catalogOverflowContent,
  catalogOverflowHatch,
  type CatalogOverflowTree,
} from "../../../catalogRuntime/canvasOverflow";
import {
  renderDimensionLabels,
  renderLasso,
  renderSelectionBox,
  renderTransformHandles,
} from "../skia/selectionRenderer";
import {
  renderBindingBadge,
  type DataBadgeBounds,
} from "../skia/bindingBadgeRenderer";
import type { BindingBadgeTarget } from "../skia/skiaOverlayHelpers";
import { renderSlotHatchPattern } from "../skia/slotMarkerRenderer";
import {
  renderMeasureGuides,
  renderSnapGuides,
} from "../skia/snapGuideRenderer";
import { renderSpacingOverlay } from "../skia/spacingOverlayRenderer";
import type { AIEffectNodeBounds, SkiaRenderable } from "../skia/types";
import { renderFlashes, renderGeneratingEffects } from "../skia/aiEffects";
import type { AIVisualFeedbackState } from "../../../stores/aiVisualFeedback";
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
  /**
   * Data binding badges (ADR-212 Phase 6) and the map their drawn scene rects go to (the press
   * that opens the table editor reads it).
   */
  badges?: () => readonly BindingBadgeTarget[];
  badgeHits?: Map<string, DataBadgeBounds>;
  /**
   * AI visual feedback (G.3): the records an agent run works on (blur + particles) and the ones
   * it changed (a fading stroke); their corner radius comes from the drawn box.
   */
  ai?: () => Pick<
    AIVisualFeedbackState,
    "generatingNodes" | "flashAnimations" | "cleanupExpiredFlashes"
  >;
  radiusOf?: (id: string) => AIEffectNodeBounds["borderRadius"];
  /** Manual guides (ADR-181), painted under the selection. */
  guides?: (canvas: Canvas) => void;
  /**
   * The drawn records' overflow and tree (record ids): hovering a clipping box shows the children
   * outside it, a selected child of a scroll/auto box is hatched where it leaves the box.
   */
  overflow?: () => CatalogOverflowTree;
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
/** Scene boxes of the AI effect targets (records without a drawn box are left out). */
export function catalogAiEffectBounds(
  ids: Iterable<string>,
  bounds: ReadonlyMap<string, BoundingBox>,
  radiusOf: (id: string) => AIEffectNodeBounds["borderRadius"] = () => 0,
): Map<string, AIEffectNodeBounds> {
  const out = new Map<string, AIEffectNodeBounds>();
  for (const id of ids) {
    const box = bounds.get(id);
    if (box) out.set(id, { elementId: id, ...box, borderRadius: radiusOf(id) });
  }
  return out;
}

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
      const ai = inputs.ai?.();
      if (ai && (ai.generatingNodes.size || ai.flashAnimations.size)) {
        const now = performance.now();
        const targets = catalogAiEffectBounds(
          [...ai.generatingNodes.keys(), ...ai.flashAnimations.keys()],
          bounds,
          inputs.radiusOf,
        );
        renderGeneratingEffects(ck, canvas, now, ai.generatingNodes, targets);
        renderFlashes(ck, canvas, now, ai.flashAnimations, targets);
        if (ai.flashAnimations.size) ai.cleanupExpiredFlashes(now);
      }
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
      inputs.badgeHits?.clear();
      for (const badge of inputs.badges?.() ?? [])
        renderBindingBadge(
          ck,
          canvas,
          badge,
          zoom,
          inputs.fontMgr(),
          inputs.badgeHits,
        );
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
      const tree = inputs.overflow?.();
      const overflowing =
        tree && state.hover
          ? catalogOverflowContent(state.hover.identity, tree, bounds)
          : null;
      if (overflowing) renderOverflowContent(ck, canvas, overflowing, zoom);
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
      if (tree)
        for (const item of state.selection) {
          const hatch = catalogOverflowHatch(item.identity, tree, bounds);
          if (hatch) renderOverflowHatching(ck, canvas, hatch, zoom);
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
