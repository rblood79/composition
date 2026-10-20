import { setFields } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  BreakpointName,
  EditTarget,
  LayoutField,
  ResponsiveBreakpointName,
  WriteValue,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { OwnFields } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";

/**
 * ADR-275 Decision 2 — an authored absolute box's constraint per axis, read from which insets it
 * has (it is not stored): `start` (Left · Top), `end` (Right · Bottom), `both` (Left+Right — the
 * box stretches), `center` (both insets opposite + `justifySelf` / `alignSelf: unsafe center`).
 * An axis with neither inset reads as `start` (Figma — an axis is never empty).
 */
export type CatalogAxisConstraint = "start" | "end" | "both" | "center";
export interface CatalogPositionConstraint {
  readonly x: CatalogAxisConstraint;
  readonly y: CatalogAxisConstraint;
}

export const CATALOG_CENTER_ALIGN = "unsafe center";

const AXES = {
  x: {
    start: "insetLeft",
    end: "insetRight",
    self: "justifySelf",
    marginStart: "marginLeft",
    marginEnd: "marginRight",
  },
  y: {
    start: "insetTop",
    end: "insetBottom",
    self: "alignSelf",
    marginStart: "marginTop",
    marginEnd: "marginBottom",
  },
} as const;

type Layout = Readonly<Record<string, string | undefined>>;

const isSet = (value: string | undefined) =>
  value !== undefined && value.trim() !== "" && value.trim() !== "auto";

/** A CSS length as a number and its unit (`12px` · `-10%` · `0`). */
function lengthOf(
  value: string | undefined,
): { n: number; unit: string } | undefined {
  const match = value ? /^(-?\d+(?:\.\d+)?)(px|%)?$/.exec(value.trim()) : null;
  return match ? { n: Number(match[1]), unit: match[2] ?? "px" } : undefined;
}

function axisConstraint(
  layout: Layout,
  axis: "x" | "y",
): CatalogAxisConstraint {
  const keys = AXES[axis];
  const start = layout[keys.start];
  const end = layout[keys.end];
  if (isSet(start) && isSet(end)) {
    const a = lengthOf(start);
    const b = lengthOf(end);
    return layout[keys.self]?.trim() === CATALOG_CENTER_ALIGN &&
      !!a &&
      !!b &&
      a.unit === b.unit &&
      a.n === -b.n
      ? "center"
      : "both";
  }
  return isSet(end) ? "end" : "start";
}

/** The constraint the panel shows and the Canvas move keeps (breakdown §2 읽기 규칙). */
export function catalogReadPositionConstraint(
  layout: Layout,
): CatalogPositionConstraint {
  return { x: axisConstraint(layout, "x"), y: axisConstraint(layout, "y") };
}

/** The axis constraint after pressing `target` (Decision 3 — 축은 비지 않는다). */
export function catalogNextAxisConstraint(
  current: CatalogAxisConstraint,
  target: "start" | "end" | "center",
): CatalogAxisConstraint {
  if (target === "center") return current === "center" ? "start" : "center";
  const other = target === "start" ? "end" : "start";
  if (current === "both") return other;
  if (current === target) return target; // the last pin stays
  if (current === other) return "both";
  return target; // from Center
}

/** A box (border-box) from its containing block's padding-box origin. */
export interface CatalogPositionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type LayoutWrites = Partial<Record<LayoutField, WriteValue<string>>>;

/**
 * The inset writes that put an absolute box at `box` under `constraint` in a containing block of
 * `cb` (its padding box). Each side keeps its unit (`%` of the containing block, else px); a side
 * the constraint drops is cleared (`remove` on the base layer, `mask` on a breakpoint layer so a
 * lower layer's value does not show through). The Center axis writes the offset from the centred
 * position and `unsafe center`; leaving Center clears that alignment.
 */
export function catalogPositionLayoutWrites(input: {
  layout: Layout;
  constraint: CatalogPositionConstraint;
  box: CatalogPositionBox;
  cb: { width: number; height: number };
  breakpoint?: BreakpointName;
}): LayoutWrites {
  const { layout, constraint, box, cb } = input;
  const clear: WriteValue<string> =
    input.breakpoint && input.breakpoint !== "desktop"
      ? { kind: "mask" }
      : { kind: "remove" };
  const writes: Record<string, WriteValue<string>> = {};
  for (const axis of ["x", "y"] as const) {
    const keys = AXES[axis];
    const size = axis === "x" ? cb.width : cb.height;
    const pos = axis === "x" ? box.x : box.y;
    const own = axis === "x" ? box.width : box.height;
    const margin = (key: string) => {
      const length = lengthOf(layout[key]);
      return length?.unit === "px" ? length.n : 0;
    };
    const ms = margin(keys.marginStart);
    const me = margin(keys.marginEnd);
    const unitOf = (key: string, fallback?: string) =>
      lengthOf(layout[key])?.unit ??
      (fallback ? lengthOf(layout[fallback])?.unit : undefined);
    const text = (value: number, unit: string | undefined) =>
      unit === "%" && size > 0
        ? `${Math.round((value / size) * 10000) / 100}%`
        : `${Math.round(value)}px`;
    const set = (key: string, value: string) => {
      writes[key] = { kind: "set", value };
    };
    const drop = (key: string) => {
      if (isSet(layout[key])) writes[key] = clear;
    };
    const kind = constraint[axis];
    const startValue = pos - ms;
    const endValue = size - pos - own - me;
    if (kind === "center") {
      const offset = pos - ms - (size - own - ms - me) / 2;
      const unit = unitOf(keys.start, keys.end);
      set(keys.start, text(offset, unit));
      set(keys.end, text(-offset, unit));
      set(keys.self, CATALOG_CENTER_ALIGN);
      continue;
    }
    if (layout[keys.self]?.trim() === CATALOG_CENTER_ALIGN) drop(keys.self);
    if (kind === "start" || kind === "both")
      set(keys.start, text(startValue, unitOf(keys.start)));
    else drop(keys.start);
    if (kind === "end" || kind === "both")
      set(keys.end, text(endValue, unitOf(keys.end)));
    else drop(keys.end);
  }
  return writes as LayoutWrites;
}

const POSITION_KEYS = [
  "position",
  "insetLeft",
  "insetTop",
  "insetRight",
  "insetBottom",
] as const;

/**
 * The box back in flow (Position off · a drop into a flow container): its position keys go from the
 * base and every breakpoint layer — a node changes parent at every breakpoint, so its position does
 * too. A self alignment goes only when it is the Center axis' `unsafe center` (a flex item's
 * `alignSelf` stays).
 */
export function catalogClearPositionCommands(
  own: OwnFields,
  target: EditTarget,
): CatalogCommand[] {
  const removals = (
    layout: Readonly<Record<string, WriteValue<string>>> | undefined,
  ) => {
    const out: LayoutWrites = {};
    if (!layout) return out;
    for (const key of POSITION_KEYS)
      if (layout[key]) out[key] = { kind: "remove" };
    for (const key of ["justifySelf", "alignSelf"] as const) {
      const write = layout[key];
      if (write?.kind === "set" && write.value === CATALOG_CENTER_ALIGN)
        out[key] = { kind: "remove" };
    }
    return out;
  };
  const commands: CatalogCommand[] = [];
  const base = removals(own.layout);
  if (Object.keys(base).length)
    commands.push(setFields({ targets: [target], layout: base }));
  for (const [breakpoint, layer] of Object.entries(own.responsive ?? {})) {
    const writes = removals(layer?.layout);
    if (Object.keys(writes).length)
      commands.push(
        setFields({
          targets: [target],
          breakpoint: breakpoint as ResponsiveBreakpointName,
          layout: writes,
        }),
      );
  }
  return commands;
}
