import type { Canvas, CanvasKit, FontMgr, PathEffect } from "canvaskit-wasm";
import type { CatalogGesturePreview } from "../../../catalogRuntime/canvasGesture";
import type { CatalogSessionState } from "../../../catalogRuntime/session";
import {
  calculateCombinedBounds,
  type BoundingBox,
  type HandlePosition,
} from "../selection/types";
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
import type { BindingBadgeTarget } from "../skia/overlayTypes";
import { chromeIntersects, expandChromeBox } from "./catalogChromeSpatial";
import { catalogSlotBand } from "./catalogChrome";
import {
  renderCollectionRemainderMarker,
  renderPageLoadingMarker,
  renderSlotHatchPattern,
} from "../skia/slotMarkerRenderer";
import {
  renderMeasureGuides,
  renderSnapGuides,
} from "../skia/snapGuideRenderer";
import { renderSpacingOverlay } from "../skia/spacingOverlayRenderer";
import type { AIEffectNodeBounds, SkiaRenderable } from "../skia/types";
import { renderFlashes, renderGeneratingEffects } from "../skia/aiEffects";
import type { AIVisualFeedbackState } from "../../../stores/aiVisualFeedback";
import type { SpacingBand } from "../interaction/spacingGeometry";
import type { SpacingActiveTarget } from "../interaction/spacingTypes";
import type { EditingSemanticsRole } from "../../../utils/editingSemanticsRole";
import { isComponentsView } from "../../../catalogRuntime/originView";

export interface CatalogOverlayInputs {
  session: () => CatalogSessionState;
  /** Scene-coordinate boxes of the drawn records (the bound stream's `boundsMap`). */
  bounds: () => ReadonlyMap<string, BoundingBox>;
  /** 열린 overlay owner는 본체의 최종 scene 경계로 선택·측정한다. */
  selectionBounds?: (identity: string) => BoundingBox | undefined;
  selectionHitBounds?: (identity: string) => BoundingBox | undefined;
  /** Scene viewport; chrome strokes may extend beyond their owning record. */
  viewport?: () => BoundingBox;
  /** Builder-only page frames; never part of document paint or Preview/Publish. */
  pageBorders?: () => {
    roots: readonly string[];
    color: Float32Array;
    /**
     * The breakpoint's screen height from a page frame's top (scene px): a frame taller than it
     * — its body's content, Height or Min H — shows a dashed line there (the fold: where a
     * device's screen ends).
     */
    fold?: number;
  };
  /**
   * The drawn records' visible boxes (ancestor clips applied — `hitBoundsMap`): the hover chrome
   * marks only what shows (canvas-interaction §8.5).
   */
  hitBounds?: () => ReadonlyMap<string, BoundingBox>;
  /** A record's editing role: the selection and hover chrome take its color (origin · instance). */
  roleOf?: (identity: string) => EditingSemanticsRole | null;
  /**
   * The leaf records under a hovered container (the old group hover's dashed guides); none for a
   * page body (an empty area, §8.6) or a leaf.
   */
  hoverLeaves?: (identity: string) => readonly string[];
  /**
   * ADR-310 Decision 3 — a selected record that is a bound list's rows' template: the data-row
   * records it draws (itself included), outlined dashed while it is selected.
   */
  repeatRows?: (identity: string) => readonly string[];
  /** The drawn records of a node (the editing context's frame). */
  recordsOf: (sourceId: string) => readonly string[];
  zoom: () => number;
  fontMgr: () => FontMgr | undefined;
  /** The drag in progress (move ghost, drop line and container, or the resized box). */
  gesture?: () => CatalogGesturePreview | undefined;
  /** The resize handles the single selection accepts (`CatalogCanvasGestures.handleAccepted`). */
  handleAccepted?: (position: HandlePosition) => boolean;
  /** A grid container's cells (none for other records): outlined while it is selected or hovered. */
  gridCells?: (identity: string) => readonly BoundingBox[];
  /** A record's parent record: a selected grid item shows its grid's cells too (Figma). */
  parentOf?: (identity: string) => string | undefined;
  /** A grid's child records: its cell lines go under them (the elements paint over the grid). */
  childrenOf?: (identity: string) => readonly string[];
  /**
   * Declared slots of the definition edit view (editor chrome, not document paint): each slot's
   * box, hatched while it holds nothing.
   */
  slots?: () => readonly {
    box: BoundingBox;
    empty: boolean;
    role: EditingSemanticsRole;
    /** The slot's record: its chrome is cut where a later-painted page covers its page. */
    identity?: string;
    /** Under a dragged root (drawn over every page): not cut. */
    onTop?: boolean;
  }[];
  /**
   * Bound collections showing a sample (ADR-157): the area of the rows not drawn, hatched with
   * "+N more" (editor chrome — the DOM draws every row).
   */
  remainders?: () => readonly {
    box: BoundingBox;
    hiddenRows: number;
    ownerId?: string;
    onTop?: boolean;
  }[];
  /**
   * ADR-307: the page roots whose content is not in yet (`identity` = the root record), with the
   * label drawn over them — content chrome, cut where a later-painted page covers the page.
   */
  loadingPages?: () => readonly { identity: string; label: string }[];
  /**
   * The page boxes painted over a record's page (`createCatalogPageChrome`): content chrome of the
   * record — slot hatch, row remainder, hover outlines — is cut there (canvas-interaction §8.5).
   * Pointing marks (selection box, handles) are not.
   */
  occluders?: (identity: string, area?: BoundingBox) => readonly BoundingBox[];
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
  /**
   * A selected grid with a cell selected (Figma): its selection line is dashed — the handles and
   * size label stay (`CatalogGridTrackLayer` marks the cell).
   */
  dashedSelection?: () => string | undefined;
  /** Spacing handles of the selected container when no gesture runs (ADR-222). */
  spacing?: () =>
    | {
        bands: readonly SpacingBand[];
        clipRect: BoundingBox | null;
        hoveredBandId: string | null;
        /** The band the inline number input edits (its handle stays marked). */
        active?: SpacingActiveTarget | null;
      }
    | undefined;
}

/** The box around every selected record (one selection: its own box). */
export function catalogSelectionBox(
  state: Pick<CatalogSessionState, "selection">,
  bounds: Pick<ReadonlyMap<string, BoundingBox>, "get">,
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
  bounds: Pick<ReadonlyMap<string, BoundingBox>, "get">,
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
/** Draw with the given page boxes cut out (Difference clips); none = draw as is. */
function withOccluders(
  ck: CanvasKit,
  canvas: Canvas,
  rects: readonly BoundingBox[] | undefined,
  draw: () => void,
): void {
  if (!rects?.length) {
    draw();
    return;
  }
  canvas.save();
  for (const rect of rects)
    canvas.clipRect(
      ck.XYWHRect(rect.x, rect.y, rect.width, rect.height),
      ck.ClipOp.Difference,
      true,
    );
  draw();
  canvas.restore();
}

export function catalogOverlayNode(
  ck: CanvasKit,
  inputs: CatalogOverlayInputs,
): SkiaRenderable & { dispose(): void } {
  // The page frame is persistent editor chrome. Own one cold Paint until Canvas teardown;
  // acquiring/resetting a pooled Paint for every page on every overlay frame adds hot work.
  const pageBorderPaint = inputs.pageBorders ? new ck.Paint() : undefined;
  pageBorderPaint?.setAntiAlias(true);
  pageBorderPaint?.setStyle(ck.PaintStyle.Stroke);
  // The fold's dash, made again only when the zoom changes (its intervals are screen px).
  let foldDash: { zoom: number; effect: PathEffect } | undefined;
  const foldDashAt = (zoom: number): PathEffect => {
    if (foldDash?.zoom !== zoom) {
      foldDash?.effect.delete();
      foldDash = {
        zoom,
        effect: ck.PathEffect.MakeDash([4 / zoom, 4 / zoom])!,
      };
    }
    return foldDash.effect;
  };
  return {
    dispose: () => {
      pageBorderPaint?.delete();
      foldDash?.effect.delete();
    },
    renderSkia: (canvas) => {
      const state = inputs.session();
      const bounds = inputs.bounds();
      const selectionBounds = inputs.selectionBounds
        ? { get: inputs.selectionBounds }
        : bounds;
      const zoom = inputs.zoom();
      const viewport = inputs.viewport?.();
      const selected = new Set(state.selection.map((item) => item.identity));
      const hoverId = state.hover?.identity;
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
      // Queried within the painted area — the frame's viewport unless a caller narrows it.
      const occludersOf = (identity: string | undefined, area?: BoundingBox) =>
        identity ? inputs.occluders?.(identity, area ?? viewport) : undefined;
      // A grid's cell lines sit under its elements (사용자 2026-10-16 「가이드 라인이 요소 위에」):
      // the pages above it and its children's visible boxes are cut out.
      const gridOccludersOf = (grid: string | undefined) => {
        const pages = occludersOf(grid);
        const children = grid ? inputs.childrenOf?.(grid) : undefined;
        if (!children?.length) return pages;
        const hits = inputs.hitBounds?.() ?? bounds;
        const rects = [...(pages ?? [])];
        for (const child of children) {
          const box = hits.get(child);
          if (box) rects.push(box);
        }
        return rects;
      };
      const pages = !state.definitionView ? inputs.pageBorders?.() : undefined;
      if (pages && pageBorderPaint) {
        pageBorderPaint.setColor(pages.color);
        pageBorderPaint.setStrokeWidth(1 / zoom);
      }
      for (const id of pages?.roots ?? []) {
        // Hover/selection replaces the resting border, so translucent strokes do not stack.
        if (id === hoverId || selected.has(id)) continue;
        const box = bounds.get(id);
        if (box && pageBorderPaint)
          withOccluders(
            ck,
            canvas,
            occludersOf(id, expandChromeBox(box, 2 / zoom)),
            () => {
              canvas.drawRect(
                ck.XYWHRect(box.x, box.y, box.width, box.height),
                pageBorderPaint,
              );
            },
          );
      }
      // The fold: where the breakpoint's screen ends in a taller frame (selected or not).
      if (pages?.fold !== undefined && pageBorderPaint) {
        for (const id of pages.roots) {
          const box = bounds.get(id);
          if (!box || pages.fold >= box.height - 0.5) continue;
          const y = box.y + pages.fold;
          pageBorderPaint.setPathEffect(foldDashAt(zoom));
          try {
            withOccluders(
              ck,
              canvas,
              occludersOf(id, expandChromeBox(box, 2 / zoom)),
              () =>
                canvas.drawLine(box.x, y, box.x + box.width, y, pageBorderPaint),
            );
          } finally {
            pageBorderPaint.setPathEffect(null);
          }
        }
      }
      for (const slot of inputs.slots?.() ?? []) {
        const bandBox = {
          ...slot.box,
          height: catalogSlotBand(slot.box.height, zoom),
        };
        const painted = expandChromeBox(bandBox, 2 / zoom);
        if (viewport && !chromeIntersects(painted, viewport)) continue;
        withOccluders(
          ck,
          canvas,
          slot.onTop ? undefined : occludersOf(slot.identity, painted),
          () =>
            renderSlotHatchPattern(
              ck,
              canvas,
              bandBox,
              zoom,
              slot.role,
              slot.empty,
            ),
        );
      }
      for (const remainder of inputs.remainders?.() ?? [])
        withOccluders(
          ck,
          canvas,
          remainder.onTop ? undefined : occludersOf(remainder.ownerId),
          () =>
            renderCollectionRemainderMarker(
              ck,
              canvas,
              remainder.box,
              remainder.hiddenRows,
              zoom,
              inputs.fontMgr(),
              viewport,
            ),
        );
      for (const page of inputs.loadingPages?.() ?? []) {
        const box = bounds.get(page.identity);
        // (A page off screen: no occluder query — the label is drawn only where the view shows.)
        if (box && (!viewport || chromeIntersects(box, viewport)))
          withOccluders(ck, canvas, occludersOf(page.identity, box), () =>
            renderPageLoadingMarker(
              ck,
              canvas,
              box,
              page.label,
              zoom,
              inputs.fontMgr(),
              viewport,
            ),
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
          viewport,
        );
      inputs.guides?.(canvas);
      if (state.editingContext)
        for (const id of inputs.recordsOf(state.editingContext)) {
          const box = bounds.get(id);
          if (box) renderEditingContextBorder(ck, canvas, box, zoom);
        }
      const roleOf = (id: string) => inputs.roleOf?.(id) ?? null;
      const hit = inputs.hitBounds?.();
      // The hovered record's page decides the cut (its leaves are on the same page) — asked once,
      // and only by the hover chrome that draws.
      let hoverCut: readonly BoundingBox[] | undefined | null = null;
      const hoverOccluders = () =>
        hoverCut === null ? (hoverCut = occludersOf(hoverId)) : hoverCut;
      if (hoverId && !selected.has(hoverId))
        withOccluders(ck, canvas, hoverOccluders(), () => {
          // The visible part (a page body is in neither map's clip: its own box).
          const hovered = inputs.selectionHitBounds
            ? inputs.selectionHitBounds(hoverId)
            : (hit?.get(hoverId) ?? bounds.get(hoverId));
          if (hovered)
            renderHoverHighlight(
              ck,
              canvas,
              hovered,
              zoom,
              false,
              roleOf(hoverId),
            );
          // Group hover: the container's leaves, dashed, where they show.
          for (const leaf of inputs.hoverLeaves?.(hoverId) ?? []) {
            const box = (hit ?? bounds).get(leaf);
            if (box)
              renderHoverHighlight(ck, canvas, box, zoom, true, roleOf(leaf));
          }
        });
      const tree = inputs.overflow?.();
      const overflowing =
        tree && state.hover
          ? catalogOverflowContent(state.hover.identity, tree, bounds)
          : null;
      if (overflowing)
        withOccluders(ck, canvas, hoverOccluders(), () =>
          renderOverflowContent(ck, canvas, overflowing, zoom),
        );
      // A grid selected or hovered, or a selected item's grid (Figma): its cells, solid (Figma draws no dashed cell — 사용자 2026-10-16) — a drag
      // draws the target's own.
      if (inputs.gridCells && !inputs.gesture?.()) {
        const grids = new Set<string>();
        for (const { identity } of state.selection) {
          grids.add(identity);
          const parent = inputs.parentOf?.(identity);
          if (parent) grids.add(parent);
        }
        if (hoverId) grids.add(hoverId);
        for (const id of grids) {
          const cells = inputs.gridCells(id);
          // A non-grid record has none: no page occlusion lookup either (every frame).
          if (cells.length)
            withOccluders(ck, canvas, gridOccludersOf(id), () => {
              for (const cell of cells)
                renderHoverHighlight(ck, canvas, cell, zoom);
            });
        }
      }
      // ADR-310 Decision 3: a selected rows' template — every data row it draws, dashed, where
      // they show (content chrome: the visible part, cut under later pages).
      if (inputs.repeatRows && !inputs.gesture?.())
        for (const item of state.selection) {
          const rows = inputs.repeatRows(item.identity);
          if (rows.length < 2) continue;
          withOccluders(ck, canvas, occludersOf(item.identity), () => {
            for (const row of rows) {
              const box = (hit ?? bounds).get(row);
              if (box)
                renderHoverHighlight(ck, canvas, box, zoom, true, roleOf(row));
            }
          });
        }
      const moving = new Set(inputs.gesture?.()?.moving ?? []);
      const dashed = inputs.dashedSelection?.();
      for (const item of state.selection) {
        if (moving.has(item.identity)) continue;
        const box = selectionBounds.get(item.identity);
        if (box)
          renderSelectionBox(
            ck,
            canvas,
            box,
            zoom,
            roleOf(item.identity),
            item.identity === dashed,
          );
      }
      const gesture = inputs.gesture?.();
      if (gesture) {
        for (const box of gesture.highlights ?? [])
          renderHoverHighlight(ck, canvas, box, zoom);
        if (gesture.marquee) renderLasso(ck, canvas, gesture.marquee, zoom);
        // A resized grid child: its grid's cells, as while selected (Figma).
        if (gesture.gridGuides?.length)
          withOccluders(
            ck,
            canvas,
            gridOccludersOf(
              state.selection[0] &&
                inputs.parentOf?.(state.selection[0].identity),
            ),
            () => {
              for (const cell of gesture.gridGuides ?? [])
                renderHoverHighlight(ck, canvas, cell, zoom);
            },
          );
        // A grid drop target (Figma): every cell outlined; an append fills its empty cell.
        for (const cell of gesture.cells ?? [])
          renderHoverHighlight(ck, canvas, cell, zoom);
        if (gesture.cell) renderLasso(ck, canvas, gesture.cell, zoom);
        // The container the drop goes into (another one than the dragged's own): its frame, as
        // thick as the line (Figma).
        if (gesture.container)
          renderSelectionBox(ck, canvas, gesture.container, zoom / 2);
        // The element itself is drawn at the pointer (`moving`): its ghost is the selection
        // outline, not the translucent box that stands in for it (a copy, a page).
        const ghostOf = gesture.moving?.length
          ? renderSelectionBox
          : renderLasso;
        if (gesture.ghost) ghostOf(ck, canvas, gesture.ghost, zoom);
        for (const box of gesture.ghosts ?? []) ghostOf(ck, canvas, box, zoom);
        if (gesture.snapGuides?.length)
          renderSnapGuides(
            ck,
            canvas,
            gesture.snapGuides,
            zoom,
            inputs.fontMgr(),
          );
        if (gesture.distances?.length)
          renderMeasureGuides(
            ck,
            canvas,
            gesture.distances,
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
        if (gesture.line && !gesture.reflow)
          renderSelectionBox(ck, canvas, gesture.line, zoom / 2);
        return;
      }
      if (state.textEditing) return;
      // A multi-selection also shows the box around it all, with its size (the handles only
      // mark it: a resize takes one element).
      const box = catalogSelectionBox(state, selectionBounds);
      if (box && state.selection.length > 1)
        renderSelectionBox(ck, canvas, box, zoom);
      if (box) {
        // The Components page takes no resize (its nodes are derived): no handles to grab.
        // (Only the corners the resize takes — a page body's bottom-right.)
        if (!isComponentsView(state.definitionView))
          renderTransformHandles(
            ck,
            canvas,
            box,
            zoom,
            null,
            inputs.handleAccepted,
          );
        renderDimensionLabels(ck, canvas, box, zoom, inputs.fontMgr());
      }
      if (tree)
        for (const item of state.selection) {
          const hatch = catalogOverflowHatch(item.identity, tree, bounds);
          if (hatch) renderOverflowHatching(ck, canvas, hatch, zoom);
        }
      const measure = catalogMeasureGuides(
        state,
        selectionBounds,
        inputs.measuring?.() ?? false,
      );
      if (measure.length)
        renderMeasureGuides(ck, canvas, measure, zoom, inputs.fontMgr());
      if (box && state.selection.length === 1) {
        const spacing = inputs.spacing?.();
        if (spacing)
          renderSpacingOverlay(ck, canvas, {
            ...spacing,
            active: spacing.active ?? null,
            zoom,
            fontMgr: inputs.fontMgr(),
          });
      }
    },
  };
}
