import {
  getRatioDependentAxis,
  isFixedRatioAxis,
  type BreakpointName,
  type FillAxes,
} from "@composition/shared";
import {
  setFields,
  setFillSizing,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type { EditTarget } from "../../../../../packages/shared/src/catalog/document/types";
import type { OwnFields } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import type { RatioEditError } from "../utils/ratioEditError";
import {
  catalogAuthoredValues,
  catalogStyleView,
  catalogStyleWritesOf,
} from "./styleFields";

export type CatalogSizeAxis = "width" | "height";

/** The Size panel's axis edit (ADR-026 size mode): fill (a weight), a CSS length, or reset. */
export interface CatalogSizingEdit {
  axis: CatalogSizeAxis;
  mode: "fill" | "css" | "reset";
  value?: string;
  factor?: number;
}

const LAYERS: Record<BreakpointName, readonly ("tablet" | "mobile")[]> = {
  desktop: [],
  tablet: ["tablet"],
  mobile: ["tablet", "mobile"],
};

/** A node's fill intent at a breakpoint: the base with each lower layer's value over it. */
export function catalogFillAt(
  own: Pick<OwnFields, "fillSizing" | "responsive">,
  breakpoint: BreakpointName,
): FillAxes | undefined {
  let result: FillAxes | undefined = own.fillSizing
    ? { ...own.fillSizing }
    : undefined;
  for (const layer of LAYERS[breakpoint]) {
    const fill = own.responsive?.[layer]?.fillSizing;
    if (fill) result = { ...result, ...fill };
  }
  return result;
}

/** The fill a breakpoint inherits from the layers below it (not its own value). */
function inheritedFill(
  own: Pick<OwnFields, "fillSizing" | "responsive">,
  breakpoint: BreakpointName,
): FillAxes | undefined {
  if (breakpoint === "desktop") return undefined;
  return catalogFillAt(own, breakpoint === "mobile" ? "tablet" : "desktop");
}

/** Run commands against one reader as one step (each builds from the pre-edit document). */
function together(label: string, commands: CatalogCommand[]): CatalogCommand {
  return (reader) => ({
    label,
    ops: commands.flatMap((command) => command(reader).ops),
  });
}

/**
 * ADR-248 Phase 4e-4d-3: one Size axis edit as catalog field writes at the session breakpoint.
 *
 * - fill: that layer's `fillSizing` axis gets the weight (given, else the current one, else 1);
 *   its fixed size and visual length go (the fill projection owns the axis).
 * - css: a px length is `sizing`, other CSS text the visual length (`catalogStyleWrites`); an
 *   inherited fill is released with `null`, the layer's own fill is dropped.
 * - reset: the layer's fixed size, visual length and fill for the axis go.
 *
 * The fill write is a whole-node `put` at a breakpoint, so it is staged before the key writes.
 */
export function catalogSizingCommand(input: {
  targets: readonly EditTarget[];
  own: (target: EditTarget) => OwnFields;
  breakpoint: BreakpointName;
  edit: CatalogSizingEdit;
}): CatalogCommand {
  const { axis, mode } = input.edit;
  const layerOf =
    input.breakpoint === "desktop" ? {} : { breakpoint: input.breakpoint };
  const commands: CatalogCommand[] = [];
  for (const target of input.targets) {
    const own = input.own(target);
    const inherited = inheritedFill(own, input.breakpoint)?.[axis];
    const fill =
      mode === "fill"
        ? {
            factor:
              input.edit.factor ??
              catalogFillAt(own, input.breakpoint)?.[axis]?.factor ??
              1,
          }
        : mode === "css" && inherited
          ? null
          : undefined;
    const layer =
      input.breakpoint === "desktop"
        ? own.fillSizing
        : own.responsive?.[input.breakpoint]?.fillSizing;
    const current = layer?.[axis];
    const unchanged =
      fill === undefined
        ? current === undefined
        : fill === null
          ? current === null
          : current?.factor === fill.factor;
    if (!unchanged)
      commands.push(
        setFillSizing({ targets: [target], ...layerOf, axis, value: fill }),
      );
  }
  const writes =
    mode === "css" && input.edit.value
      ? catalogStyleWritesOf({ [axis]: input.edit.value })
      : {
          visual: { [axis]: { kind: "remove" as const } },
          sizing: { [axis]: { kind: "remove" as const } },
        };
  commands.push(
    setFields({
      targets: input.targets,
      ...layerOf,
      ...writes,
    } as Parameters<typeof setFields>[0]),
  );
  return together(mode === "fill" ? "Fill" : "Edit size", commands);
}

/**
 * ADR-248 Phase 4e-4d-3: the Ratio control. A ratio applies to every screen size (base
 * `visual.aspectRatio`); `null` locks the measured ratio. Locking makes one axis follow the other
 * as CSS does — the axis the author fixed holds, the other follows (height, unless only the height
 * is fixed): the following axis drops each layer's value (fixed, visual and fill) and is written
 * `fit-content` on the base, so a rule's default size on it (Chart height 240) no longer fixes
 * both axes and leaves the ratio unused. Unlocking fixes the following axis at its measured px on
 * the base and needs the Desktop geometry (other breakpoints measure other boxes).
 * **Why (2026-11-13)**: locking only dropped the authored height — a Chart (rule height 240) at
 * Width 640 · Ratio 1 / 1 stayed 640 × 240 on both renderers (사용자 「높이가 640 이 되지 않는다」).
 */
/**
 * The axis a ratio lock makes follow (CSS: a fixed axis holds, an `auto` one follows the ratio —
 * both free, the width leads): the height, unless the author fixed only the height (a fill counts
 * as fixed). Reads the base (Desktop) layer — the ratio lives there.
 */
function ratioFollowingAxis(own: OwnFields): CatalogSizeAxis {
  const view = catalogStyleView({
    visual: catalogAuthoredValues(own.visual),
    layout: catalogAuthoredValues(own.layout),
    sizing: catalogAuthoredValues(own.sizing),
  });
  const fill = catalogFillAt(own, "desktop");
  const fixed = (axis: CatalogSizeAxis) =>
    !!fill?.[axis] || isFixedRatioAxis(view[axis]);
  return fixed("height") && !fixed("width") ? "width" : "height";
}

export function catalogRatioCommand(input: {
  /** The commands plan in order on each other's staged records (a layer's fill write is a put). */
  graph: CatalogGraph;
  targets: readonly EditTarget[];
  own: (target: EditTarget) => OwnFields;
  breakpoint: BreakpointName;
  value: string | null;
  measured: (
    target: EditTarget,
  ) => { width: number; height: number } | undefined;
}): CatalogCommand | RatioEditError {
  const locking =
    input.value === null ||
    (input.value !== "" && input.value !== "auto" && input.value !== "reset");
  const commands: CatalogCommand[] = [];
  for (const target of input.targets) {
    const own = input.own(target);
    if (locking) {
      let ratio = input.value;
      if (ratio === null) {
        const box = input.measured(target);
        if (!box || box.width <= 0 || box.height <= 0)
          return "geometry-missing";
        ratio = `${Math.round(box.width * 100) / 100} / ${Math.round(box.height * 100) / 100}`;
      }
      const follows = ratioFollowingAxis(own);
      const drop = {
        visual: { [follows]: { kind: "remove" as const } },
        sizing: { [follows]: { kind: "remove" as const } },
      };
      commands.push(
        setFillSizing({ targets: [target], axis: follows, value: undefined }),
        setFields({
          targets: [target],
          visual: {
            ...catalogStyleWritesOf({ aspectRatio: ratio }).visual,
            [follows]: { kind: "set", value: "fit-content" },
          },
          sizing: drop.sizing,
          label: "Ratio",
        } as Parameters<typeof setFields>[0]),
      );
      for (const layer of ["tablet", "mobile"] as const) {
        const layered = own.responsive?.[layer];
        if (layered?.fillSizing?.[follows] !== undefined)
          commands.push(
            setFillSizing({
              targets: [target],
              breakpoint: layer,
              axis: follows,
              value: undefined,
            }),
          );
        if (layered?.visual?.[follows] || layered?.sizing?.[follows])
          commands.push(
            setFields({
              targets: [target],
              breakpoint: layer,
              ...drop,
            } as Parameters<typeof setFields>[0]),
          );
      }
      continue;
    }
    if (input.breakpoint !== "desktop") return "tier-geometry-missing";
    const dependent = getRatioDependentAxis(
      catalogStyleView({
        visual: catalogAuthoredValues(own.visual),
        layout: catalogAuthoredValues(own.layout),
        sizing: catalogAuthoredValues(own.sizing),
      }),
      catalogFillAt(own, "desktop"),
    );
    const writes: Parameters<typeof setFields>[0] = {
      targets: [target],
      visual: { aspectRatio: { kind: "remove" } },
      label: "Ratio",
    };
    if (dependent) {
      const px = input.measured(target)?.[dependent];
      if (px == null || !Number.isFinite(px) || px < 0)
        return "geometry-missing";
      commands.push(
        setFields({
          ...writes,
          // (The following axis's `fit-content` goes — the measured px is its size now.)
          visual: { aspectRatio: { kind: "remove" }, [dependent]: { kind: "remove" } },
          sizing: { [dependent]: { kind: "set", value: Math.round(px) } },
        } as Parameters<typeof setFields>[0]),
      );
    } else commands.push(setFields(writes));
  }
  return () => {
    const plan = composeCommands(input.graph, "Ratio", commands);
    return { label: plan.label, ops: plan.ops };
  };
}
