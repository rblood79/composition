/**
 * ADR-318 — the drag · key calculation of a Resizable Handle (Phase 2 · 3): limits, moves, the
 * collapse threshold. Pure; only the Handle (lazy `resizable.components.tsx`) reads it — apart from
 * `resizablePanels.ts` (the layout the Canvas and every DOM render read) so it stays out of the
 * Builder's first load (G6 bundle).
 */
// ── Phase 2 — the drag · key calculation (Preview · Publish; pure, `adr318ResizablePanels.test.ts`) ──

/** A Panel's size limits in its share % (of the Group's main size less its Handles). */
export interface ResizableLimits {
  readonly min: readonly number[];
  readonly max: readonly number[];
}

/**
 * The Panels' `_panelMin` · `_panelMax` (CSS lengths) as share % — a `%` limit is of the whole Group
 * main size (how CSS resolves `min-width: N%`), a share is of the Group less its Handles, so the limit
 * becomes `N × main ÷ space` and the calculation stops where the CSS clamp stops (review round 1 l5).
 * `space` 0 (not laid out) keeps the % as given.
 */
export function catalogResizableLimits(
  panels: readonly (Readonly<Record<string, unknown>> | undefined)[],
  groupMain: number,
  space: number,
): ResizableLimits {
  const percent = (value: unknown, fallback: number) => {
    if (typeof value !== "string") return fallback;
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return fallback;
    if (value.endsWith("px")) return space > 0 ? (n / space) * 100 : fallback;
    return space > 0 ? (n * groupMain) / space : n;
  };
  return {
    min: panels.map((d) => Math.max(0, percent(d?._panelMin, 0))),
    max: panels.map((d) => Math.min(100, percent(d?._panelMax, 100))),
  };
}

/**
 * A move of Handle `index` (between Panels `index` and `index + 1`) by `delta` share %: only those two
 * Panels change (사용자 결정 4, 2026-11-26 — not the Panels beyond), and the move stops where one of
 * them reaches its min or max. Returns the new sizes (the same array when nothing moves).
 */
export function catalogResizableMove(
  sizes: readonly number[],
  index: number,
  delta: number,
  limits: ResizableLimits,
): readonly number[] {
  const a = index;
  const b = index + 1;
  if (sizes[a] === undefined || sizes[b] === undefined) return sizes;
  const { lo, hi } = catalogResizableRange(sizes, index, limits);
  const next = Math.min(hi, Math.max(lo, sizes[a]! + delta));
  if (next === sizes[a]) return sizes;
  const out = sizes.slice();
  out[b] = sizes[a]! + sizes[b]! - next;
  out[a] = next;
  return out;
}

/** The range Handle `index`'s front Panel can take (its `aria-valuemin` · `aria-valuemax`). */
export function catalogResizableRange(
  sizes: readonly number[],
  index: number,
  limits: ResizableLimits,
): { lo: number; hi: number } {
  const a = index;
  const b = index + 1;
  const total = (sizes[a] ?? 0) + (sizes[b] ?? 0);
  const lo = Math.max(limits.min[a] ?? 0, total - (limits.max[b] ?? 100));
  const hi = Math.min(limits.max[a] ?? 100, total - (limits.min[b] ?? 0));
  return hi < lo ? { lo: sizes[a] ?? 0, hi: sizes[a] ?? 0 } : { lo, hi };
}

/** An arrow key's step (사용자 결정 6 — 5 % fixed, react-resizable-panels' default too). */
export const RESIZABLE_KEY_STEP = 5;

// ── Phase 3 — collapse in a drag · a key (pure, `adr318ResizablePanels.test.ts`) ──

export interface ResizableCollapseInfo {
  readonly collapsible: readonly boolean[];
  /** Each Panel's collapsed size in share % (a px size over the shared space). */
  readonly collapsedShare: readonly number[];
}

/**
 * A move of Handle `index` that may collapse or expand the Panels beside it: a collapsible Panel
 * pushed below the middle of its min and its collapsed size collapses to that size, a collapsed one
 * pulled past the same middle expands to its min (breakdown §5.3 — the threshold is fixed, not a
 * prop). Only the two Panels change (사용자 결정 4). `sizes` are the drawn shares (a collapsed
 * Panel's is its collapsed share).
 */
export function catalogResizableMoveCollapsing(
  sizes: readonly number[],
  collapsed: readonly boolean[],
  index: number,
  delta: number,
  limits: ResizableLimits,
  info: ResizableCollapseInfo,
): { sizes: readonly number[]; collapsed: readonly boolean[] } {
  const a = index;
  const b = index + 1;
  if (sizes[a] === undefined || sizes[b] === undefined)
    return { sizes, collapsed };
  const total = sizes[a]! + sizes[b]!;
  const minA = limits.min[a] ?? 0;
  const minB = limits.min[b] ?? 0;
  const maxA = limits.max[a] ?? 100;
  const maxB = limits.max[b] ?? 100;
  const cA = info.collapsedShare[a] ?? 0;
  const cB = info.collapsedShare[b] ?? 0;
  const proposed = sizes[a]! + delta;
  let front: number;
  let collapsedA = false;
  let collapsedB = false;
  if (
    info.collapsible[a] &&
    proposed < (minA + cA) / 2 &&
    total - cA <= maxB &&
    total - cA >= 0
  ) {
    front = cA;
    collapsedA = true;
  } else if (
    info.collapsible[b] &&
    total - proposed < (minB + cB) / 2 &&
    total - cB >= minA &&
    total - cB <= maxA
  ) {
    front = total - cB;
    collapsedB = true;
  } else {
    const lo = Math.max(minA, total - maxB);
    const hi = Math.min(maxA, total - minB);
    front = hi < lo ? sizes[a]! : Math.min(hi, Math.max(lo, proposed));
  }
  if (
    front === sizes[a] &&
    collapsedA === !!collapsed[a] &&
    collapsedB === !!collapsed[b]
  )
    return { sizes, collapsed };
  const out = sizes.slice();
  out[a] = front;
  out[b] = total - front;
  const nextCollapsed = collapsed.slice();
  nextCollapsed[a] = collapsedA;
  nextCollapsed[b] = collapsedB;
  return { sizes: out, collapsed: nextCollapsed };
}

/** A share as the runtime state keeps it (0.01 % — the sub-pixel rest of a drag is noise). */
export function catalogResizableShareValue(share: number): number {
  return Math.round(share * 100) / 100;
}
