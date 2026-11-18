import { parseColor } from "react-stately";
import {
  cssVarToTokenRef,
  resolveToken,
  type TokenRef,
} from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { evaluateConditionTree } from "../rule/conditionTree";
import type { ComponentRule } from "../../types/catalog-style.types";
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
import { CATALOG_COLOR_HANDLE_INNER_RING } from "@composition/rendering";
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
      /** A disabled control: one color (the rule's — S2 'disabled', a theme token), clipped as the part is. */
      kind: "solid";
      color: string;
      ring?: { outerRadius: number; innerRadius: number };
    };

export interface CatalogColorThumbPaint {
  color: string;
  /** The ring (`border`) — width px and the color token. */
  borderWidth: number;
  borderColor: string;
  /** The rule's `outline` outside the border (S2 `ColorHandle` 1px `black/42`) — color `#rrggbb` + alpha. */
  outline?: { width: number; color: string; alpha: number };
  /** The shadow token (`{shadow.sm}`). */
  shadow?: string;
  /**
   * S2 `ColorHandle`'s inner `div` ring and the checkerboard under the color (`colorHandle.ts`) — a
   * disabled handle has no checkerboard (S2 paints it one color).
   */
  innerRing?: { width: number; color: string; alpha: number };
  checker?: boolean;
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

/** The rule's disabled declaration for a part (`&[data-disabled] .react-aria-<Part>`) or the control itself (its state tree). */
function disabledStyles(
  controlType: string,
  partClass: string,
): Record<string, string> | undefined {
  if (!partClass) {
    // (the control's own box — its state tree, ADR-297 Phase 3c)
    const background = evaluateConditionTree(
      (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[controlType]
        ?.structure?.stateStyles?.background,
      { isDisabled: true },
    );
    return background === undefined
      ? undefined
      : { background: String(background) };
  }
  return rootSelectors(controlType)[`&[data-disabled] .react-aria-${partClass}`]
    ?.styles;
}

const plainColor = (value: string | undefined) =>
  value?.replace(/\s*!important\s*$/, "").trim();

/** A rule color — a theme token (`var(--bg-disabled)` → `{color.disabled}`, resolved per theme) or a CSS color → `#rrggbbaa`. */
function ruleColor(value: string | undefined): string | undefined {
  const color = plainColor(value);
  if (!color) return undefined;
  return cssVarToTokenRef(color) ?? catalogColorHex(color);
}

function disabledColor(
  controlType: string,
  partClass: string,
): string | undefined {
  return ruleColor(disabledStyles(controlType, partClass)?.background);
}

/** The SliderTrack rule's disabled opacity (its state tree under `isDisabled` — `structure.stateStyles`). */
function sliderTrackDisabledOpacity(): number | undefined {
  const opacity = Number(
    evaluateConditionTree(
      (COMPONENT_RULES_TABLE as Record<string, ComponentRule>).SliderTrack
        ?.structure?.stateStyles?.opacity,
      { isDisabled: true },
    ),
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
  if (type === "ColorSwatch") {
    const color = catalogColorSwatchColor(node, get, typeOf);
    if (!color) return undefined;
    return {
      _swatchColor: color,
      ...(catalogColorSwatchSelected(node, color, get, typeOf)
        ? { _swatchSelected: 1 }
        : {}),
    };
  }
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
    //  state dims it with the thumb inside unless the control's rule sets the track's opacity, as
    //  the generated sheets do — S2 ColorSlider does not dim it.)
    const own = Number(disabledStyles(controlType, "SliderTrack")?.opacity);
    const opacity = Number.isFinite(own) ? own : sliderTrackDisabledOpacity();
    const dimmed =
      disabled && opacity !== undefined && opacity < 1 ? opacity : undefined;
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
    const gray = ruleColor(off?.background);
    const grayBorder = ruleColor(off?.["border-color"]);
    const paint: CatalogColorThumbPaint = {
      color: gray ?? catalogColorHex(thumb.color),
      ...ring,
      ...(grayBorder ? { borderColor: grayBorder } : {}),
      // (S2 draws the inner ring on a disabled handle too; the checkerboard only under a color.)
      innerRing: { ...CATALOG_COLOR_HANDLE_INNER_RING },
      ...(gray ? {} : { checker: true }),
    };
    return { _colorThumb: JSON.stringify(paint) };
  }
  return undefined;
}

/**
 * ADR-295 후속 C3 — the color a ColorSwatch shows (`#rrggbbaa`): its own `color`, else its
 * ColorSwatchPickerItem's (RAC `ColorSwatchPickerItem` gives the swatch inside its `color` through
 * `ColorSwatchContext`; the swatch's own prop wins — `useContextProps`). The Canvas paints the box with it
 * (`catalogRulePaint` — `_swatchColor`), the DOM's RAC ColorSwatch writes the same color inline. A value
 * that does not parse leaves the rule's box (RAC's `parseColor` throws on it too).
 */
export function catalogColorSwatchColor(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): string | undefined {
  const parent = get(node.parentId);
  const value =
    node.props.color ??
    (parent && typeOf(parent) === "ColorSwatchPickerItem"
      ? parent.props.color
      : undefined);
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return catalogColorHex(value);
  } catch {
    return undefined;
  }
}

/**
 * Whether a ColorSwatch is its picker's selected swatch — RAC `ColorSwatchPicker` keys its items by
 * their color (`hexa`) and selects the one equal to the picker's value: the swatch's ColorSwatchPickerItem
 * color against the picker's `value` (else `defaultValue`). The Canvas draws S2's selection `div` on it
 * (`color_swatch`), the DOM draws the `div` from RAC's `isSelected`.
 */
function catalogColorSwatchSelected(
  node: CatalogConsumerNode,
  color: string,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): boolean {
  const item = get(node.parentId);
  if (!item || typeOf(item) !== "ColorSwatchPickerItem") return false;
  const picker = get(item.parentId);
  if (!picker || typeOf(picker) !== "ColorSwatchPicker") return false;
  const value = picker.props.value ?? picker.props.defaultValue;
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    return catalogColorHex(value) === color;
  } catch {
    return false;
  }
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
  // (ADR-295 후속: the S2 handle is `scaled(16)` — its px in the installed maps.)
  const width = styles?.width ?? "";
  const size = /^\{length\.[^{}]+\}$/.test(width)
    ? Number(resolveToken(width as TokenRef))
    : Number.parseFloat(width);
  if (!border || !Number.isFinite(size))
    throw new Error("CATALOG_COLOR_THUMB_RULE_UNSUPPORTED");
  const shadow = styles?.["box-shadow"];
  const outline =
    /^(\d+(?:\.\d+)?)px solid rgb\((\d+) (\d+) (\d+) \/ (\d*(?:\.\d+)?)\)$/.exec(
      styles?.outline ?? "",
    );
  if (styles?.outline && !outline)
    throw new Error("CATALOG_COLOR_THUMB_RULE_UNSUPPORTED");
  const hex = (value: string) => Number(value).toString(16).padStart(2, "0");
  return {
    size,
    borderWidth: Number(border[1]),
    borderColor: cssVarToTokenRef(border[2].trim()) ?? border[2].trim(),
    ...(outline
      ? {
          outline: {
            width: Number(outline[1]),
            color: `#${hex(outline[2])}${hex(outline[3])}${hex(outline[4])}`,
            alpha: Number(outline[5]),
          },
        }
      : {}),
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
  // (A ColorSwatchPickerItem's swatch shows the item's color — ADR-295 후속 C3.)
  if (typeOf(control) === "ColorSwatchPickerItem")
    return catalogPartChildren(control, get, typeOf).filter(
      (child) => typeOf(child) === "ColorSwatch",
    );
  // (A picker's value selects one of its swatches — `catalogColorSwatchSelected`.)
  if (typeOf(control) === "ColorSwatchPicker")
    return catalogPartChildren(control, get, typeOf).flatMap((item) =>
      typeOf(item) === "ColorSwatchPickerItem"
        ? catalogPartChildren(item, get, typeOf).filter(
            (child) => typeOf(child) === "ColorSwatch",
          )
        : [],
    );
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
