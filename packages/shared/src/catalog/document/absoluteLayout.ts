import type { LayoutWrites, WriteValue } from "./types";

/**
 * ADR-275 — an authored absolute box is `layout.position: absolute` + `inset*` (+ the Center axis'
 * `justifySelf` / `alignSelf: unsafe center`). Document-level helpers for the commands that copy
 * or move such a box without geometry (paste · duplicate · origin restore).
 */
export const POSITION_LAYOUT_KEYS = [
  "position",
  "insetLeft",
  "insetTop",
  "insetRight",
  "insetBottom",
  "justifySelf",
  "alignSelf",
] as const;

const setText = (write: WriteValue<string> | undefined) =>
  write?.kind === "set" ? write.value : undefined;

/** An inset's px value (`12px` · `0`); undefined for other units or no write. */
export function insetPx(
  write: WriteValue<string> | undefined,
): number | undefined {
  const text = setText(write)?.trim();
  if (text === "0") return 0;
  const match = text ? /^(-?\d+(?:\.\d+)?)px$/.exec(text) : null;
  return match ? Number(match[1]) : undefined;
}

const px = (value: number) => `${Math.round(value * 100) / 100}px`;

/** The layout writes place an authored box — absolute, or fixed (ADR-275 Phase 7). */
export function layoutIsAbsolute(layout: LayoutWrites | undefined): boolean {
  const position = setText(layout?.position);
  return position === "absolute" || position === "fixed";
}

/** The position keys of a layout (position · insets · self alignment). */
export function positionLayout(layout: LayoutWrites): LayoutWrites {
  return Object.fromEntries(
    POSITION_LAYOUT_KEYS.flatMap((key) =>
      layout[key] ? [[key, structuredClone(layout[key])]] : [],
    ),
  );
}

/** A layout without its position keys. */
export function withoutPositionLayout(layout: LayoutWrites): LayoutWrites {
  const next: Record<string, WriteValue<string>> = { ...layout };
  for (const key of POSITION_LAYOUT_KEYS) delete next[key];
  return next;
}

const AXES = {
  x: ["insetLeft", "insetRight"],
  y: ["insetTop", "insetBottom"],
} as const;

/**
 * Moves an authored absolute box by `(dx, dy)` px and keeps its constraint: a set start inset
 * grows, a set end inset shrinks (Left · Right · Left+Right · Center alike), an axis with neither
 * becomes start-pinned at the move. A non-px inset is left as it is (a copy has no containing
 * block size to convert it with).
 */
export function shiftAbsoluteLayout(
  layout: LayoutWrites,
  dx: number,
  dy: number,
): LayoutWrites {
  const next: Record<string, WriteValue<string>> = { ...layout };
  for (const [axis, delta] of [
    ["x", dx],
    ["y", dy],
  ] as const) {
    if (!delta) continue;
    const [start, end] = AXES[axis];
    if (!layout[start] && !layout[end]) {
      next[start] = { kind: "set", value: px(delta) };
      continue;
    }
    const from = insetPx(layout[start]);
    if (from !== undefined)
      next[start] = { kind: "set", value: px(from + delta) };
    const to = insetPx(layout[end]);
    if (to !== undefined) next[end] = { kind: "set", value: px(to - delta) };
  }
  return next;
}

/** The px start offset (left · top) of a box pinned to that edge, or with neither inset (0). */
export function absoluteStart(
  layout: LayoutWrites,
  axis: "x" | "y",
): number | undefined {
  const [start, end] = AXES[axis];
  if (!layout[start] && !layout[end]) return 0;
  return layout[end] ? undefined : insetPx(layout[start]);
}
