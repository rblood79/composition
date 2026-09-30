import type { BreakpointName } from "@composition/shared";
import type { OwnFields } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  catalogAuthoredValues,
  catalogStyleView,
  catalogStyleWrites,
  type CatalogStyleFields,
} from "./styleFields";

/** The layers a breakpoint reads, bottom up (desktop-first: mobile reads tablet then mobile). */
const CASCADE: Record<BreakpointName, readonly ("tablet" | "mobile")[]> = {
  desktop: [],
  tablet: ["tablet"],
  mobile: ["tablet", "mobile"],
};

function layerValues(
  layer:
    | Pick<OwnFields, "visual" | "layout" | "sizing">
    | NonNullable<OwnFields["responsive"]>["tablet"]
    | undefined,
): CatalogStyleFields {
  return {
    visual: catalogAuthoredValues(layer?.visual),
    layout: catalogAuthoredValues(layer?.layout),
    sizing: catalogAuthoredValues(layer?.sizing),
  };
}

/**
 * A node's authored fields at a breakpoint: the base with each layer the breakpoint reads over
 * it (the resolver's cascade — mobile reads the tablet layer too).
 */
export function catalogFieldsAt(
  own: OwnFields,
  breakpoint: BreakpointName,
): CatalogStyleFields {
  const result = layerValues(own);
  for (const name of CASCADE[breakpoint]) {
    const layer = layerValues(own.responsive?.[name]);
    Object.assign(result.visual, layer.visual);
    Object.assign(result.layout, layer.layout);
    Object.assign(result.sizing, layer.sizing);
  }
  return result;
}

/** One tablet/mobile layer's own values as CSS (what that breakpoint overrides). */
export function catalogLayerStyle(
  own: OwnFields,
  breakpoint: "tablet" | "mobile",
  context: { fontSize?: number } = {},
): Record<string, string | number> {
  return catalogStyleView(layerValues(own.responsive?.[breakpoint]), context);
}

/** Summary the Responsive section shows (ADR-154 shape): the active layer and every layer. */
export interface CatalogResponsiveSummary {
  activeOverrideValues: Record<string, unknown>;
  totalOverrideCount: number;
  visibility: { tablet?: boolean; mobile?: boolean };
  baseHidden: boolean;
}
export function catalogResponsiveSummary(
  own: OwnFields,
  breakpoint: BreakpointName,
  context: { fontSize?: number } = {},
): CatalogResponsiveSummary {
  const layers = {
    tablet: catalogLayerStyle(own, "tablet", context),
    mobile: catalogLayerStyle(own, "mobile", context),
  };
  const visibility: CatalogResponsiveSummary["visibility"] = {};
  for (const name of ["tablet", "mobile"] as const)
    if (own.visibility?.[name] !== undefined)
      visibility[name] = own.visibility[name];
  return {
    activeOverrideValues: breakpoint === "desktop" ? {} : layers[breakpoint],
    totalOverrideCount:
      Object.keys(layers.tablet).length +
      Object.keys(layers.mobile).length +
      Object.keys(visibility).length,
    visibility,
    baseHidden:
      own.visibility?.desktop === false ||
      catalogAuthoredValues(own.layout).display === "none",
  };
}

/**
 * Turning a breakpoint override on (ADR-154): the value each longhand shows now at that
 * breakpoint is copied into its layer, so nothing moves; a longhand the node does not author
 * takes `seed` (the type's default, else the CSS initial value). Returns the CSS to write there.
 */
export function catalogOverrideSeed(
  own: OwnFields,
  breakpoint: BreakpointName,
  longhands: readonly string[],
  seed: (longhand: string) => string,
  context: { fontSize?: number } = {},
): Record<string, string> {
  const current = catalogStyleView(catalogFieldsAt(own, breakpoint), context);
  const out: Record<string, string> = {};
  for (const key of longhands) {
    const value = current[key];
    out[key] = value === undefined || value === "" ? seed(key) : String(value);
    // A value the typed field cannot hold (a CSS initial keyword) is left to the base.
    try {
      catalogStyleWrites(key, out[key], context);
    } catch {
      delete out[key];
    }
  }
  return out;
}
