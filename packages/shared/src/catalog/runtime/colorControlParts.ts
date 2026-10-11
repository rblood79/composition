import { parseColor } from "react-stately";
import { cssVarToTokenRef } from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import {
  CATALOG_COLOR_WHEEL_TRACK,
  catalogColorWheelDiameter,
} from "../resolvers/resolveCatalogRuleCanvasBox";
import {
  COLOR_WHEEL_FROM_DEG,
  COLOR_WHEEL_STOPS,
  colorAreaGradient,
  colorControlThumb,
  colorSliderGradient,
  type CatalogColorControlType,
  type CatalogColorGradientLayer,
} from "./colorControlGradient";
import type { CatalogConsumerNode } from "./compositionRoot";
import {
  catalogPartParent,
  catalogPartChildren,
  type CatalogRecordLookup,
  type CatalogTypeOf,
} from "./presence";

/**
 * ADR-258 Phase 2 — the Canvas side of a Color control's parts (RAC writes the same values inline in
 * the Preview): the gradient a ColorArea · a ColorSlider's SliderTrack · a ColorWheelTrack paints,
 * the ColorThumb's place and paint. They are derived record values (`_colorGradient` ·
 * `_colorThumb`, JSON) so a change of the control's value repaints the part (the record diff) and the
 * Canvas primitives (`color_area_fill` · `color_slider_track` · `color_wheel_track` · `color_thumb`)
 * read finished numbers. Every color is `#rrggbbaa` (the converter's color form); a stop's place is
 * CSS's (even spacing).
 *
 * The disabled paint, the thumb's size, ring and shadow are the rules' (D3 — the same declarations
 * the generated sheets carry): `rootSelectors["&[data-disabled] …"]` of the control's rule and the
 * ColorThumb rule's `composition.containerStyles`.
 */

/** A gradient a Color part paints, top layer first (CSS `background` order). */
export type CatalogColorPaint =
  | {
      kind: "layers";
      layers: Array<{ to: CatalogColorGradientLayer["to"]; stops: string[] }>;
      /** The bottom solid layer (ColorArea rgb: the z channel; hsl/hsb z = hue: the hue). */
      base?: string;
      /** rgb ColorArea: each layer screens the ones below (`background-blend-mode: screen`). */
      blend?: "screen";
    }
  | {
      kind: "wheel";
      /** The hue sweep, even stops from `fromDeg` clockwise (CSS `conic-gradient(from …)`). */
      stops: string[];
      fromDeg: number;
      outerRadius: number;
      innerRadius: number;
    }
  | {
      /** A disabled control: one color (the rule's `gray`), clipped as the part is. */
      kind: "solid";
      color: string;
      ring?: { outerRadius: number; innerRadius: number };
    };

export interface CatalogColorThumbPaint {
  color: string;
  /** The ring (`border`) — width px and the color token. */
  borderWidth: number;
  borderColor: string;
  /** The shadow token (`{shadow.sm}`). */
  shadow?: string;
  opacity?: number;
}

const CSS_KEYWORD_COLORS: Readonly<Record<string, string>> = {
  transparent: "#00000000",
  black: "#000000ff",
  white: "#ffffffff",
  gray: "#808080ff",
};

const hex2 = (value: number) =>
  Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, "0");

/** A CSS color RAC writes (`rgba(…)` · `hsl(…)` · `hsla(…)` · a keyword) → `#rrggbbaa`. */
export function catalogColorHex(css: string): string {
  const keyword = CSS_KEYWORD_COLORS[css.trim().toLowerCase()];
  if (keyword) return keyword;
  const rgb = parseColor(css.trim()).toFormat("rgb");
  return `#${hex2(rgb.getChannelValue("red"))}${hex2(rgb.getChannelValue("green"))}${hex2(rgb.getChannelValue("blue"))}${hex2(rgb.getChannelValue("alpha") * 255)}`;
}

type RootSelectors = Record<string, { styles?: Record<string, string> }>;
function rootSelectors(type: string): RootSelectors {
  const rule = (COMPONENT_RULES_TABLE as Record<string, unknown>)[type] as
    | { structure?: { composition?: { rootSelectors?: RootSelectors } } }
    | undefined;
  return rule?.structure?.composition?.rootSelectors ?? {};
}

/** The rule's disabled declaration for a part (`&[data-disabled] .react-aria-<Part>`). */
function disabledStyles(
  controlType: string,
  partClass: string,
): Record<string, string> | undefined {
  const selectors = rootSelectors(controlType);
  return selectors[
    partClass ? `&[data-disabled] .react-aria-${partClass}` : "&[data-disabled]"
  ]?.styles;
}

const plainColor = (value: string | undefined) =>
  value?.replace(/\s*!important\s*$/, "").trim();

function disabledColor(
  controlType: string,
  partClass: string,
): string | undefined {
  const color = plainColor(disabledStyles(controlType, partClass)?.background);
  return color ? catalogColorHex(color) : undefined;
}

/** The SliderTrack rule's disabled opacity (`structure.states.disabled`). */
function sliderTrackDisabledOpacity(): number | undefined {
  const opacity = Number(
    (
      (COMPONENT_RULES_TABLE as Record<string, unknown>).SliderTrack as {
        structure?: { states?: { disabled?: { opacity?: number } } };
      }
    ).structure?.states?.disabled?.opacity,
  );
  return Number.isFinite(opacity) && opacity < 1 ? opacity : undefined;
}

const COLOR_CONTROL_TYPES: ReadonlySet<string> = new Set([
  "ColorArea",
  "ColorSlider",
  "ColorWheel",
]);

/** The Color control a part belongs to (past the layout frames the author puts around it). */
export function catalogColorControlOf(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  const type = typeOf(node);
  if (
    type !== "ColorThumb" &&
    type !== "ColorWheelTrack" &&
    type !== "SliderTrack"
  )
    return undefined;
  let parent = catalogPartParent(node, get, typeOf);
  // (A ColorSlider's thumb is in its SliderTrack.)
  if (parent && type === "ColorThumb" && typeOf(parent) === "SliderTrack")
    parent = catalogPartParent(parent, get, typeOf);
  return parent && COLOR_CONTROL_TYPES.has(typeOf(parent)) ? parent : undefined;
}

/** The wheel's radii — the DOM's RAC `outerRadius` · `innerRadius` (`domBinding`). */
function wheelRadii(wheel: CatalogConsumerNode) {
  const outerRadius = catalogColorWheelDiameter(wheel.props.size) / 2;
  return { outerRadius, innerRadius: outerRadius - CATALOG_COLOR_WHEEL_TRACK };
}

const layerPaint = (layer: CatalogColorGradientLayer) => ({
  to: layer.to,
  stops: layer.stops.map(catalogColorHex),
});

/**
 * The derived values of a Color control's part (undefined for any other node): `_colorGradient` on
 * a ColorArea, a ColorSlider's SliderTrack and a ColorWheelTrack; `_colorThumb` on a ColorThumb.
 */
export function catalogColorControlDerivedProps(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Readonly<Record<string, string | number>> | undefined {
  const type = typeOf(node);
  if (type === "ColorArea") {
    const disabled =
      node.props.isDisabled === true
        ? disabledColor("ColorArea", "")
        : undefined;
    const gradient = colorAreaGradient(node.props);
    const paint: CatalogColorPaint = disabled
      ? { kind: "solid", color: disabled }
      : {
          kind: "layers",
          layers: gradient.layers.map(layerPaint),
          ...(gradient.base ? { base: catalogColorHex(gradient.base) } : {}),
          ...(gradient.blend ? { blend: gradient.blend } : {}),
        };
    return { _colorGradient: JSON.stringify(paint) };
  }
  const control = catalogColorControlOf(node, get, typeOf);
  if (!control) return undefined;
  const controlType = typeOf(control) as CatalogColorControlType;
  const disabled = control.props.isDisabled === true;
  if (type === "SliderTrack" && controlType === "ColorSlider") {
    const gray = disabled
      ? disabledColor(controlType, "SliderTrack")
      : undefined;
    const paint: CatalogColorPaint = gray
      ? { kind: "solid", color: gray }
      : {
          kind: "layers",
          layers: [layerPaint(colorSliderGradient(control.props))],
        };
    // (RAC marks a disabled ColorSlider's track `data-disabled` — the SliderTrack rule's disabled
    //  state dims it with the thumb inside, as the generated sheet does.)
    const dimmed = disabled ? sliderTrackDisabledOpacity() : undefined;
    return {
      _colorGradient: JSON.stringify(paint),
      ...(dimmed !== undefined ? { _opacity: dimmed } : {}),
    };
  }
  if (type === "ColorWheelTrack" && controlType === "ColorWheel") {
    const radii = wheelRadii(control);
    const gray = disabled
      ? disabledColor(controlType, "ColorWheelTrack")
      : undefined;
    const paint: CatalogColorPaint = gray
      ? { kind: "solid", color: gray, ring: radii }
      : {
          kind: "wheel",
          stops: COLOR_WHEEL_STOPS.map(catalogColorHex),
          fromDeg: COLOR_WHEEL_FROM_DEG,
          ...radii,
        };
    return { _colorGradient: JSON.stringify(paint) };
  }
  if (type === "ColorThumb") {
    const thumb = colorControlThumb(
      controlType,
      control.props,
      controlType === "ColorWheel" ? wheelRadii(control) : undefined,
    );
    const ring = catalogColorThumbRing();
    const off = disabled
      ? disabledStyles(controlType, "ColorThumb")
      : undefined;
    const gray = plainColor(off?.background);
    const opacity = Number(off?.opacity);
    const paint: CatalogColorThumbPaint = {
      color: catalogColorHex(gray ?? thumb.color),
      ...ring,
      ...(Number.isFinite(opacity) && opacity < 1 ? { opacity } : {}),
    };
    return {
      _colorThumb: JSON.stringify(paint),
      // (The Canvas dims the whole handle, as CSS `opacity` does — `withOpacity`.)
      ...(paint.opacity !== undefined ? { _opacity: paint.opacity } : {}),
    };
  }
  return undefined;
}

/** The ColorThumb rule's box (`composition.containerStyles`): size, ring and shadow. */
export function catalogColorThumbRing(): Omit<
  CatalogColorThumbPaint,
  "color" | "opacity"
> & {
  size: number;
} {
  const styles = (
    (COMPONENT_RULES_TABLE as Record<string, unknown>).ColorThumb as {
      structure?: {
        composition?: { containerStyles?: Record<string, string> };
      };
    }
  ).structure?.composition?.containerStyles;
  const border = /^(\d+(?:\.\d+)?)px solid (.+)$/.exec(styles?.border ?? "");
  const size = Number.parseFloat(styles?.width ?? "");
  if (!border || !Number.isFinite(size))
    throw new Error("CATALOG_COLOR_THUMB_RULE_UNSUPPORTED");
  const shadow = styles?.["box-shadow"];
  return {
    size,
    borderWidth: Number(border[1]),
    borderColor: cssVarToTokenRef(border[2].trim()) ?? border[2].trim(),
    ...(shadow ? { shadow: cssVarToTokenRef(shadow) ?? shadow } : {}),
  };
}

const px = (value: number) => `${value}px`;
const pct = (fraction: number) => `${fraction * 100}%`;

/**
 * RAC's placement of a Color part (D1 — `useColorAreaGradient` · `useColorSlider` ·
 * `useColorWheel` thumb / track styles) in engine fields: a ColorThumb is absolutely placed at the
 * value and centered on it (`translate(-50%, -50%)` — a negative margin of half its size); a
 * ColorSlider's thumb sits on the track's middle across it (the rule's `top: 50%` · `left: 50%`);
 * a ColorWheelTrack is the wheel's square. Undefined for any other node.
 */
export function catalogColorPartLayout(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): Record<string, string> | undefined {
  const control = catalogColorControlOf(node, get, typeOf);
  if (!control) return undefined;
  const controlType = typeOf(control) as CatalogColorControlType;
  const type = typeOf(node);
  if (type === "ColorWheelTrack") {
    const diameter = px(wheelRadii(control).outerRadius * 2);
    return { width: diameter, height: diameter };
  }
  if (type !== "ColorThumb") return undefined;
  const { size } = catalogColorThumbRing();
  const thumb = colorControlThumb(
    controlType,
    control.props,
    controlType === "ColorWheel" ? wheelRadii(control) : undefined,
  );
  const placed =
    thumb.kind === "px"
      ? { insetLeft: px(thumb.x), insetTop: px(thumb.y) }
      : {
          insetLeft: thumb.x === undefined ? "50%" : pct(thumb.x),
          insetTop: thumb.y === undefined ? "50%" : pct(thumb.y),
        };
  return {
    position: "absolute",
    ...placed,
    marginLeft: px(-size / 2),
    marginTop: px(-size / 2),
    width: px(size),
    height: px(size),
  };
}

/** The parts whose derived values · placement a Color control record decides. */
export function catalogColorControlParts(
  control: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode[] {
  if (!COLOR_CONTROL_TYPES.has(typeOf(control))) return [];
  const out: CatalogConsumerNode[] = [];
  const visit = (record: CatalogConsumerNode) => {
    for (const child of catalogPartChildren(record, get, typeOf)) {
      const type = typeOf(child);
      if (type === "SliderTrack") {
        out.push(child);
        visit(child);
      } else if (type === "ColorThumb" || type === "ColorWheelTrack")
        out.push(child);
    }
  };
  visit(control);
  return out;
}
