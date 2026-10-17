import type { CanvasKit, FontMgr } from "canvaskit-wasm";
import { orderPagesForPaint } from "../workspace/canvas/scene/pagePaintOrder";
import { beginImageEpoch } from "../workspace/canvas/skia/imageCache";
import {
  executeDamageRenderCommands,
  executeRenderCommands,
  executeViewportRenderCommands,
} from "../workspace/canvas/skia/renderCommands";
import {
  beginContentScope,
  endContentScope,
  renderCounters,
  renderDebug,
} from "../workspace/canvas/skia/renderCounters";
import {
  beginRebindRelease,
  endRebindRelease,
} from "../workspace/canvas/skia/useSkiaNode";
import {
  beginNodePictureFullRecord,
  endNodePictureFullRecord,
} from "../workspace/canvas/skia/nodePictureCache";
import { requestNodePictureWarmup } from "../workspace/canvas/skia/nodePictureWarmup";
import type { BoundingBox } from "../workspace/canvas/selection/types";
import type { SkiaRenderable } from "../workspace/canvas/skia/types";
import {
  bindCatalogCanvas,
  type CatalogCanvasUpdate,
  type CatalogScrollOffsets,
} from "./canvasBinding";
import type { CatalogCompositionRoot } from "./compositionRoot";

export type CatalogCanvasSceneSync =
  | { readonly kind: "unchanged" }
  | {
      readonly kind: "patched";
      readonly update: Extract<CatalogCanvasUpdate, { status: "patched" }>;
    }
  /** The whole scene was bound again (`reason`: what the patch path does not own). */
  | { readonly kind: "rebound"; readonly reason: string }
  /** ADR-264 Phase 3: page roots placed where the page grid moved them (nothing recorded again). */
  | { readonly kind: "placed"; readonly roots: readonly string[] };

/**
 * ADR-263 Phase 3: the content area a sync changed — a patch's old ∪ new hit bounds. Undefined
 * (draw in full) for a rebind, or a patch that paints outside its hit bounds before or after.
 */
export function catalogSyncDamage(
  sync: CatalogCanvasSceneSync,
): BoundingBox | undefined {
  return sync.kind === "patched" ? sync.update.damage : undefined;
}

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((id, index) => id === right[index]);

/**
 * ADR-248 Phase 4e-2: the Builder Canvas scene of one open project — every page root bound through
 * `bindCatalogCanvas` into one command stream. Once a step is delivered (after `execute` / `undo`
 * / `redo` returns — a step listener runs before the root's subscribers) `sync()` applies the
 * subscribed per-node and parent-structure deltas (subtree splice). Unsupported Slot structure,
 * geometry reaching a page frame, or a changed page-root set binds the scene again.
 */
export class CatalogCanvasScene {
  private binding: ReturnType<typeof bindCatalogCanvas>;
  private rootIds: string[];
  /** Scroll positions of scroll/auto boxes: they outlive a rebind (an edit keeps the position). */
  private readonly scrollOffsets: CatalogScrollOffsets = new Map();

  constructor(
    private root: CatalogCompositionRoot,
    /** Which page roots are drawn (default: all — Compare Mode's current-page filter narrows it). */
    private rootFilter: (roots: string[]) => string[] = (roots) => roots,
    /**
     * The active page's root: drawn last when it overlaps another page, so it paints on top and
     * takes the overlap's pointer (picking follows the stream order). The document order stays —
     * page z-order is a workspace display axis (`scene/pagePaintOrder.ts`, the header DOM layer).
     */
    private activeRoot: () => string | undefined = () => undefined,
  ) {
    this.rootIds = this.drawnRoots();
    this.binding = this.bind();
  }

  private drawnRoots(): string[] {
    const roots = this.rootFilter(this.root.pageRootRecords());
    const active = this.activeRoot();
    if (!active || roots.length < 2 || !roots.includes(active)) return roots;
    // The order only shows where the active page overlaps another: elsewhere the document order
    // stays, so switching pages on the page grid binds nothing (no picture is drawn again).
    const boxes = this.root.getGeometry(roots);
    const own = boxes.get(active);
    const overlaps =
      !!own &&
      roots.some((id) => {
        const other = id === active ? undefined : boxes.get(id);
        return (
          !!other &&
          own.x < other.x + other.width &&
          other.x < own.x + own.width &&
          own.y < other.y + other.height &&
          other.y < own.y + own.height
        );
      });
    return overlaps
      ? orderPagesForPaint(
          roots.map((id) => ({ id })),
          active,
        ).map((root) => root.id)
      : roots;
  }

  private bind() {
    // A full bind reads every drawn image again: images unseen for two binds may be evicted.
    beginImageEpoch();
    return bindCatalogCanvas(this.root, this.rootIds, undefined, {
      scrollOffsets: this.scrollOffsets,
    });
  }

  /** Whether a record is a scroll/auto box with somewhere to scroll. */
  scrollable(id: string): boolean {
    return this.binding.scrollable(id);
  }
  /** Scroll a box by a wheel delta; it redraws at the next `sync()` (false = nothing moved). */
  scrollBy(id: string, deltaX: number, deltaY: number): boolean {
    return this.binding.scrollBy(id, deltaX, deltaY);
  }

  get stream() {
    return this.binding.stream;
  }
  get pageRootIds(): readonly string[] {
    return this.rootIds;
  }

  sync(): CatalogCanvasSceneSync {
    if (!sameIds(this.drawnRoots(), this.rootIds))
      return this.rebind("page-roots");
    const update = this.binding.update();
    if (update.status === "rebind-required") return this.rebind(update.reason);
    // ADR-269 (r1 H2): a scroll records nothing but draws again — `propertyChanged` is a change.
    return update.rebound.length ||
      update.patchRoots.length ||
      update.propertyChanged.length
      ? { kind: "patched", update }
      : { kind: "unchanged" };
  }

  /**
   * Another active page: bind again only when the drawn order changes (the active page overlaps
   * another). No record diff — a page switch changes no record, and the scene's records stay.
   */
  reorder(): CatalogCanvasSceneSync {
    return sameIds(this.drawnRoots(), this.rootIds)
      ? { kind: "unchanged" }
      : this.rebind("page-roots");
  }

  /** Live verification (ADR-264): bind again from the records — the oracle for a patched stream. */
  rebuild(): CatalogCanvasSceneSync {
    return this.rebind("verify");
  }

  /**
   * Bind again outside a step — the drag layer starting or ending (its subtree moves to and from
   * the stream's top layer).
   */
  refresh(): CatalogCanvasSceneSync {
    return this.rebind("page-grid");
  }

  /**
   * ADR-264 Phase 3: the page grid moved page frames outside a step (the auto column count at a
   * zoom, a page grid edit). Page contents keep their layout, so moved roots are placed; a frame
   * that resized, another root set or order, or a root that cannot be placed binds again.
   */
  pageGridChanged(): CatalogCanvasSceneSync {
    if (!sameIds(this.drawnRoots(), this.rootIds))
      return this.rebind("page-roots");
    if (!(process.env.NODE_ENV === "development" && renderDebug.translateOff)) {
      const roots = this.binding.movePageRoots();
      if (roots)
        return roots.length ? { kind: "placed", roots } : { kind: "unchanged" };
    }
    return this.rebind("page-grid");
  }

  /**
   * An image a record draws finished loading: the node data read the image cache at bind time
   * (a miss draws the placeholder) and the records did not change, so bind again.
   */
  imageLoaded(): CatalogCanvasSceneSync {
    return this.rebind("image-loaded");
  }

  /** Draw another root of the same runtime (a breakpoint switch). */
  replaceRoot(root: CatalogCompositionRoot): CatalogCanvasSceneSync {
    this.root = root;
    return this.rebind("root");
  }

  private rebind(reason: string): CatalogCanvasSceneSync {
    const before =
      process.env.NODE_ENV === "development" && reason === "page-grid"
        ? new Map(
            this.rootIds.map((id) => [
              id,
              this.binding.stream.boundsMap.get(id),
            ]),
          )
        : undefined;
    // ADR-266 Phase 0: count what the release drops and what the new bind registers again.
    beginRebindRelease(reason);
    try {
      this.binding.dispose();
      this.rootIds = this.drawnRoots();
      this.binding = this.bind();
    } finally {
      endRebindRelease();
    }
    if (process.env.NODE_ENV === "development") {
      // ADR-269 Phase 0: a rejected splice by its reason (the context a patch could not keep).
      if (reason === "splice-rejected:clip-context-changed")
        renderCounters.rebindSpliceRejectedClipContext += 1;
      else if (reason === "splice-rejected:scroll-context-changed")
        renderCounters.rebindSpliceRejectedScrollContext += 1;
      else if (reason.startsWith("splice-rejected:"))
        renderCounters.rebindSpliceRejectedOther += 1;
      if (reason !== "page-grid") renderCounters.rebindOther += 1;
      // ADR-270 Phase 0: an image finished loading (part of `rebindOther`).
      if (reason === "image-loaded") renderCounters.rebindImageLoaded += 1;
      else {
        // ADR-264 Phase 0: whether the page roots only moved (R4) — compare the bound boxes.
        renderCounters.rebindPageGrid += 1;
        let resized = false;
        for (const id of this.rootIds) {
          const old = before?.get(id);
          const next = this.binding.stream.boundsMap.get(id);
          if (!old || !next) {
            resized = true;
            continue;
          }
          if (old.width !== next.width || old.height !== next.height)
            resized = true;
          else if (old.x !== next.x || old.y !== next.y)
            renderCounters.pageGridMovedRoots += 1;
        }
        if (resized) renderCounters.pageGridResized += 1;
      }
    }
    return { kind: "rebound", reason };
  }

  /**
   * Renderer content: draws the current stream (a rebind replaces it; the node reads it per frame).
   * ADR-263 Phase 2: the viewport's SpatialIndex candidates when it can (visits follow what is on
   * screen), else the whole stream with culled subtrees jumped over.
   */
  contentNode(
    ck: CanvasKit,
    fontMgr: () => FontMgr | undefined,
  ): SkiaRenderable {
    return {
      renderSkia: (canvas, bounds) => {
        const stream = this.binding.stream;
        // ADR-266 Phase 2: the picture cache sizes itself to what a full record touches.
        beginNodePictureFullRecord();
        if (process.env.NODE_ENV === "development") beginContentScope("full");
        try {
          if (
            executeViewportRenderCommands(
              ck,
              canvas,
              stream,
              bounds,
              this.rootIds,
              fontMgr(),
            )
          )
            return;
          executeRenderCommands(
            ck,
            canvas,
            stream.commands,
            bounds,
            fontMgr(),
            stream.selfSpans,
            undefined,
            undefined,
            { subtreeSpans: stream.subtreeSpans },
          );
        } finally {
          endNodePictureFullRecord();
          if (process.env.NODE_ENV === "development") endContentScope();
          // ADR-266 Phase 4: 화면 밖 요소는 쉬는 시간에 미리 기록한다 (처음 줌아웃의 cold 기록).
          requestNodePictureWarmup(ck, stream, bounds, fontMgr);
        }
      },
      // Phase 3: only the damage's SpatialIndex contributors (null → the renderer draws in full).
      renderDamageSkia: (canvas, bounds) => {
        if (process.env.NODE_ENV !== "development")
          return executeDamageRenderCommands(
            ck,
            canvas,
            this.binding.stream,
            bounds,
            fontMgr(),
          );
        if (renderDebug.damageOff) return null;
        beginContentScope("damage");
        try {
          return executeDamageRenderCommands(
            ck,
            canvas,
            this.binding.stream,
            bounds,
            fontMgr(),
          );
        } finally {
          endContentScope();
        }
      },
    };
  }

  dispose(): void {
    this.binding.dispose();
  }
}
