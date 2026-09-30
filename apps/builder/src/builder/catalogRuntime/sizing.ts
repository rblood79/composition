import {
  getRatioDependentAxis,
  type BreakpointName,
  type FillAxes,
} from "@composition/shared";
import {
  setFields,
  setFillSizing,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { EditTarget } from "../../../../../packages/shared/src/catalog/document/types";
import type { OwnFields } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import type { RatioEditError } from "../stores/inspectorActions";
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
 * `visual.aspectRatio`); `null` locks the measured ratio. Locking drops each layer's height
 * (fixed, visual and fill) so height follows width; unlocking fixes the dependent axis at its
 * measured px on the base and needs the Desktop geometry (other breakpoints measure other boxes).
 */
export function catalogRatioCommand(input: {
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
      const drop = {
        visual: { height: { kind: "remove" as const } },
        sizing: { height: { kind: "remove" as const } },
      };
      commands.push(
        setFillSizing({ targets: [target], axis: "height", value: undefined }),
        setFields({
          targets: [target],
          visual: {
            ...drop.visual,
            ...catalogStyleWritesOf({ aspectRatio: ratio }).visual,
          },
          sizing: drop.sizing,
          label: "Ratio",
        }),
      );
      for (const layer of ["tablet", "mobile"] as const) {
        const layered = own.responsive?.[layer];
        if (layered?.fillSizing?.height !== undefined)
          commands.push(
            setFillSizing({
              targets: [target],
              breakpoint: layer,
              axis: "height",
              value: undefined,
            }),
          );
        if (layered?.visual?.height || layered?.sizing?.height)
          commands.push(
            setFields({ targets: [target], breakpoint: layer, ...drop }),
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
          sizing: { [dependent]: { kind: "set", value: Math.round(px) } },
        }),
      );
    } else commands.push(setFields(writes));
  }
  return together("Ratio", commands);
}
