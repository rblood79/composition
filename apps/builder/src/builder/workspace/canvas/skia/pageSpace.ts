/**
 * Page-local storage of a command stream's scene geometry (2026-11-22).
 *
 * Every element belongs to one page (the scene root it is drawn under). Its scene rects — bounds,
 * hit area, ancestor clip and the build context its parent handed down — are stored relative to
 * the page's origin offset: `scene = stored + offset(page)`. Moving a page frame (a page above it
 * grew — the page grid) changes one offset instead of every element's entries, and the spatial
 * index reads the same offsets (`spatialIndex.ts` — one grid per page).
 *
 * Maps keep the `Map` interface: `get` · iteration return scene values, `set` takes scene values.
 * A page root's own build context and clip are its parent's (the scene's) — they do not move with
 * the page (`"context"` maps).
 */
import type { BoundingBox } from "../selection/types";

export interface PageOffset {
  readonly x: number;
  readonly y: number;
}

export class PageSpace {
  /** element → its page (read directly by `PageLocalMap` — one call per read on the hot path). */
  readonly pages = new Map<string, string>();
  /** page → its origin offset since the stream was built (no entry = 0). */
  readonly offsets = new Map<string, PageOffset>();

  /** The page `id` is drawn under (`undefined` = not assigned — no offset). */
  pageOf(id: string): string | undefined {
    return this.pages.get(id);
  }

  assign(id: string, page: string): void {
    this.pages.set(id, page);
  }

  forget(id: string): void {
    this.pages.delete(id);
  }

  offsetOfPage(page: string): PageOffset | undefined {
    return this.offsets.get(page);
  }

  /** Move a page and everything stored under it by (dx, dy). */
  movePage(page: string, dx: number, dy: number): void {
    if (!dx && !dy) return;
    const at = this.offsets.get(page);
    const x = (at?.x ?? 0) + dx;
    const y = (at?.y ?? 0) + dy;
    if (x === 0 && y === 0) this.offsets.delete(page);
    else this.offsets.set(page, { x, y });
  }
}

/**
 * A `Map` whose values are stored page-local and read in scene coordinates. The reads look the
 * offset up inline (no helper call): they run per element per frame in drags and zooms, and a
 * stream whose pages never moved has no offset to add.
 */
export class PageLocalMap<V> extends Map<string, V> {
  constructor(
    readonly space: PageSpace,
    private readonly shift: Shift<V>,
    /** A page root's entry is its parent's (the scene's) — it does not move with its page. */
    private readonly context: boolean,
  ) {
    super();
  }

  override get(id: string): V | undefined {
    const value = super.get(id);
    const { offsets, pages } = this.space;
    if (value === undefined || !offsets.size) return value;
    const page = pages.get(id);
    if (page === undefined || (this.context && page === id)) return value;
    const offset = offsets.get(page);
    return offset ? this.shift(value, offset.x, offset.y) : value;
  }

  override set(id: string, value: V): this {
    const { offsets, pages } = this.space;
    if (offsets.size) {
      const page = pages.get(id);
      const offset =
        page === undefined || (this.context && page === id)
          ? undefined
          : offsets.get(page);
      if (offset) return super.set(id, this.shift(value, -offset.x, -offset.y));
    }
    return super.set(id, value);
  }

  override forEach(
    callback: (value: V, key: string, map: Map<string, V>) => void,
    thisArg?: unknown,
  ): void {
    for (const [id, value] of this.entries())
      callback.call(thisArg, value, id, this);
  }

  override entries(): MapIterator<[string, V]> {
    return (
      this.space.offsets.size ? this.sceneEntries() : super.entries()
    ) as MapIterator<[string, V]>;
  }

  override values(): MapIterator<V> {
    return (
      this.space.offsets.size ? this.sceneValues() : super.values()
    ) as MapIterator<V>;
  }

  override [Symbol.iterator](): MapIterator<[string, V]> {
    return this.entries();
  }

  private *sceneEntries(): Generator<[string, V]> {
    for (const id of super.keys()) yield [id, this.get(id)!];
  }

  private *sceneValues(): Generator<V> {
    for (const id of super.keys()) yield this.get(id)!;
  }
}

type Shift<V> = (value: V, dx: number, dy: number) => V;

export const shiftRect = <R extends BoundingBox | null>(
  rect: R,
  dx: number,
  dy: number,
): R => (rect ? ({ ...rect, x: rect.x + dx, y: rect.y + dy } as R) : rect);

/**
 * A clip moved with its page. The empty clip (`EMPTY_CLIP` — everything clipped away: `0,0,0,0`)
 * stays where it is: it is a value, not a place (the recorder hands it down as is).
 */
export const shiftClip = <R extends BoundingBox | null>(
  clip: R,
  dx: number,
  dy: number,
): R =>
  clip && !(clip.x === 0 && clip.y === 0 && !clip.width && !clip.height)
    ? shiftRect(clip, dx, dy)
    : clip;
