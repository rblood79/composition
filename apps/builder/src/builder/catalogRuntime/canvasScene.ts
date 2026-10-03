import type { CanvasKit, FontMgr } from "canvaskit-wasm";
import { orderPagesForPaint } from "../workspace/canvas/scene/pagePaintOrder";
import { executeRenderCommands } from "../workspace/canvas/skia/renderCommands";
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
  | { readonly kind: "rebound"; readonly reason: string };

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
    return update.rebound.length || update.patchRoots.length
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

  /** Page frames moved outside a step (the page grid's auto column count): bind again. */
  refresh(): CatalogCanvasSceneSync {
    return this.rebind("page-grid");
  }

  /** Draw another root of the same runtime (a breakpoint switch). */
  replaceRoot(root: CatalogCompositionRoot): CatalogCanvasSceneSync {
    this.root = root;
    return this.rebind("root");
  }

  private rebind(reason: string): CatalogCanvasSceneSync {
    this.binding.dispose();
    this.rootIds = this.drawnRoots();
    this.binding = this.bind();
    return { kind: "rebound", reason };
  }

  /** Renderer content: draws the current stream (a rebind replaces it; the node reads it per frame). */
  contentNode(
    ck: CanvasKit,
    fontMgr: () => FontMgr | undefined,
  ): SkiaRenderable {
    return {
      renderSkia: (canvas, bounds) => {
        const stream = this.binding.stream;
        executeRenderCommands(
          ck,
          canvas,
          stream.commands,
          bounds,
          fontMgr(),
          stream.selfSpans,
        );
      },
    };
  }

  dispose(): void {
    this.binding.dispose();
  }
}
