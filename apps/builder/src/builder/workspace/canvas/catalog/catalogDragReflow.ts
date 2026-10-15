/**
 * The siblings' reflow during a Canvas drag (Figma · Pen.dev — 2026-10-15): each sibling eases
 * from its current offset to the target the gesture computes (`dragPresentation().siblings`) over
 * about 120 ms (the old Canvas's Pencil pattern), and back to 0 when the drop moves away.
 */
const SETTLE_MS = 40; // time constant: ~95% after 3 × 40 ms
const EPSILON = 0.25;

export class CatalogDragReflow {
  private readonly current = new Map<string, { dx: number; dy: number }>();
  private targets: ReadonlyMap<string, { dx: number; dy: number }> = new Map();
  private last: number | undefined;

  setTargets(targets: ReadonlyMap<string, { dx: number; dy: number }>): void {
    this.targets = targets;
  }

  /** Advance to `now` (ms); returns whether a sibling is still moving (draw another frame). */
  tick(now: number): boolean {
    const dt = this.last === undefined ? 16 : Math.min(now - this.last, 64);
    this.last = now;
    const k = 1 - Math.exp(-dt / SETTLE_MS);
    let moving = false;
    const ids = new Set([...this.current.keys(), ...this.targets.keys()]);
    for (const id of ids) {
      const target = this.targets.get(id) ?? { dx: 0, dy: 0 };
      const from = this.current.get(id) ?? { dx: 0, dy: 0 };
      let dx = from.dx + (target.dx - from.dx) * k;
      let dy = from.dy + (target.dy - from.dy) * k;
      if (Math.abs(target.dx - dx) < EPSILON) dx = target.dx;
      if (Math.abs(target.dy - dy) < EPSILON) dy = target.dy;
      if (dx !== target.dx || dy !== target.dy) moving = true;
      if (!dx && !dy) this.current.delete(id);
      else this.current.set(id, { dx, dy });
    }
    if (!moving) this.last = undefined;
    return moving;
  }

  offsets(): Map<string, { dx: number; dy: number }> {
    return this.current;
  }

  clear(): void {
    this.current.clear();
    this.targets = new Map();
    this.last = undefined;
  }
}
