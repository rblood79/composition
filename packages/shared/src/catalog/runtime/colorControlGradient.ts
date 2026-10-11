import { parseColor } from "react-stately";
import type { Color, ColorChannel } from "react-stately";
import {
  catalogColorControlProps,
  catalogDocumentColor,
  type CatalogColorControlType,
} from "../document/colorValue";

export * from "../document/colorValue";

/**
 * ADR-258 — the Color controls' (ColorArea · ColorSlider · ColorWheel) document value → what RAC
 * draws: the gradient layers, the thumb's place and color, and (ColorSlider) the Label ·
 * SliderOutput text. RAC computes these in its hooks (D1 — `useColorAreaGradient` ·
 * `useColorSlider` `generateBackground` · `useColorWheel`) and writes them inline; the Canvas needs
 * the same values, so this module repeats RAC's branches with the same `Color` implementation
 * (react-stately `parseColor`) — the stop strings are RAC's own. The oracle is the installed RAC's
 * output (`apps/builder/tests/fixtures/adr258-rac-gradient.json`, written by
 * `scripts/adr258-rac-gradient-oracle.mjs`) — a RAC upgrade that changes a branch turns that test
 * RED, and this file follows RAC (never the other way).
 *
 * Inputs are document props. `catalogColorControlProps` first reduces them to a combination RAC
 * accepts (a parse failure or a channel outside the color space falls back to the binding default),
 * and the DOM passes those same props to RAC — one fallback for both consumers.
 */

/** The color RAC's state holds at first render: the default value, in `colorSpace` when given. */
function stateColor(
  type: CatalogColorControlType,
  props: Readonly<Record<string, unknown>>,
): { color: Color; rac: ReturnType<typeof catalogColorControlProps> } {
  const rac = catalogColorControlProps(type, props);
  const base = parseColor(rac.defaultValue);
  if (type === "ColorWheel") {
    const space = base.getColorSpace();
    return {
      color: space === "hsl" || space === "hsb" ? base : base.toFormat("hsl"),
      rac,
    };
  }
  return { color: rac.colorSpace ? base.toFormat(rac.colorSpace) : base, rac };
}

/** One gradient layer: CSS `linear-gradient(to <to>, <stops>)`. */
export interface CatalogColorGradientLayer {
  to: "right" | "left" | "top";
  /** CSS color strings exactly as RAC writes them (`rgba(…)` · `hsla(…)` · `transparent` · `black` · `white`). */
  stops: string[];
}

export interface CatalogColorAreaGradient {
  /** Top layer first (CSS `background` order). */
  layers: CatalogColorGradientLayer[];
  /** A solid bottom layer (rgb: the z channel · hsl/hsb with z = hue: the full-saturation hue). */
  base?: string;
  /** rgb only — the layers combine channel by channel. */
  blend?: "screen";
}

const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360];

/** RAC `useColorAreaGradient` (react-aria 3.52.0 `useColorAreaGradient.mjs:44-77`). */
export function colorAreaGradient(
  props: Readonly<Record<string, unknown>>,
  direction: "ltr" | "rtl" = "ltr",
): CatalogColorAreaGradient {
  const { color } = stateColor("ColorArea", props);
  const rac = catalogColorControlProps("ColorArea", props);
  const { xChannel, yChannel, zChannel } = color.getColorSpaceAxes({
    xChannel: rac.xChannel,
    yChannel: rac.yChannel,
  });
  const end = direction === "rtl" ? "left" : "right";
  const zValue = color.getChannelValue(zChannel);
  const space = color.getColorSpace();
  if (space === "rgb") {
    const rgb = parseColor("rgb(0, 0, 0)");
    return {
      layers: [
        {
          to: end,
          stops: [
            rgb.withChannelValue(xChannel, 0).toString(),
            rgb.withChannelValue(xChannel, 255).toString(),
          ],
        },
        {
          to: "top",
          stops: [
            rgb.withChannelValue(yChannel, 0).toString(),
            rgb.withChannelValue(yChannel, 255).toString(),
          ],
        },
      ],
      base: rgb.withChannelValue(zChannel, zValue).toString(),
      blend: "screen",
    };
  }
  const value = parseColor(
    space === "hsl" ? "hsl(0, 100%, 50%)" : "hsb(0, 100%, 100%)",
  ).withChannelValue(zChannel, zValue);
  const stopsOf = (channel: ColorChannel): string[] =>
    channel === "hue"
      ? HUE_STOPS.map((hue) =>
          value.withChannelValue("hue", hue).toString("css"),
        )
      : channel === "saturation"
        ? [value.withChannelValue("saturation", 0).toString(), "transparent"]
        : channel === "lightness"
          ? ["black", "transparent", "white"]
          : ["black", "transparent"];
  const layers = color
    .getColorChannels()
    .filter((c) => c !== zChannel)
    .map((c): CatalogColorGradientLayer => ({
      to: c === xChannel ? end : "top",
      stops: stopsOf(c),
    }))
    .reverse();
  return {
    layers,
    ...(zChannel === "hue" ? { base: value.toString("css") } : {}),
  };
}

/** RAC's inline `background` (+ `background-blend-mode`) for a ColorArea gradient. */
export function colorAreaGradientCss(gradient: CatalogColorAreaGradient): {
  background: string;
  backgroundBlendMode?: string;
} {
  const layers = gradient.layers.map(
    (layer) => `linear-gradient(to ${layer.to}, ${layer.stops.join(", ")})`,
  );
  if (gradient.blend === "screen")
    return {
      background: [...layers, gradient.base].join(","),
      backgroundBlendMode: "screen",
    };
  return {
    background: [...layers, ...(gradient.base ? [gradient.base] : [])].join(
      ", ",
    ),
  };
}

/** RAC `useColorSliderState` `getDisplayColor`. */
function sliderDisplayColor(color: Color, channel: ColorChannel): Color {
  if (channel === "hue")
    return parseColor(`hsl(${color.getChannelValue("hue")}, 100%, 50%)`);
  if (channel === "alpha") return color;
  return color.withChannelValue("alpha", 1);
}

/** RAC `useColorSlider` `generateBackground` (`useColorSlider.mjs:42-82`) — the SliderTrack's. */
export function colorSliderGradient(
  props: Readonly<Record<string, unknown>>,
  direction: "ltr" | "rtl" = "ltr",
): CatalogColorGradientLayer {
  const { color, rac } = stateColor("ColorSlider", props);
  const channel = rac.channel!;
  const to =
    props.orientation === "vertical"
      ? "top"
      : direction === "ltr"
        ? "right"
        : "left";
  const value = sliderDisplayColor(color, channel);
  const { minValue, maxValue } = color.getChannelRange(channel);
  if (channel === "hue")
    return {
      to,
      stops: HUE_STOPS.map((hue) =>
        value.withChannelValue("hue", hue).toString("css"),
      ),
    };
  if (channel === "lightness")
    return {
      to,
      stops: [
        value.withChannelValue(channel, minValue).toString("css"),
        value
          .withChannelValue(channel, (maxValue - minValue) / 2)
          .toString("css"),
        value.withChannelValue(channel, maxValue).toString("css"),
      ],
    };
  return {
    to,
    stops: [
      value.withChannelValue(channel, minValue).toString("css"),
      value.withChannelValue(channel, maxValue).toString("css"),
    ],
  };
}

export const colorGradientLayerCss = (layer: CatalogColorGradientLayer) =>
  `linear-gradient(to ${layer.to}, ${layer.stops.join(", ")})`;

/** RAC `useColorWheel` track (`useColorWheel.mjs:208-232`) — hue every 30°, from 3 o'clock. */
export const COLOR_WHEEL_STOPS: readonly string[] = Array.from(
  { length: 13 },
  (_, i) => `hsl(${i * 30}, 100%, 50%)`,
);
/** CSS `conic-gradient(from 90deg …)` — 0° at 3 o'clock, clockwise (= Skia's sweep start). */
export const COLOR_WHEEL_FROM_DEG = 90;

export function colorWheelGradientCss(): string {
  return `conic-gradient( from ${COLOR_WHEEL_FROM_DEG}deg, ${COLOR_WHEEL_STOPS.join(", ")} )`;
}

/** react-stately `roundToStepPrecision` (`utils/number.mjs`). */
function roundToStepPrecision(value: number, step: number): number {
  let precision = 0;
  const stepString = step.toString();
  const eIndex = stepString.toLowerCase().indexOf("e-");
  if (eIndex > 0)
    precision = Math.abs(Math.floor(Math.log10(Math.abs(step)))) + eIndex;
  else {
    const pointIndex = stepString.indexOf(".");
    if (pointIndex >= 0) precision = stepString.length - pointIndex;
  }
  if (precision <= 0) return value;
  const pow = Math.pow(10, precision);
  return Math.round(value * pow) / pow;
}

/** react-stately `snapValueToStep` — the slider state holds its value on a step. */
function snapValueToStep(
  value: number,
  min: number,
  max: number,
  step: number,
): number {
  const remainder = (value - min) % step;
  let snapped = roundToStepPrecision(
    Math.abs(remainder) * 2 >= step
      ? value + Math.sign(remainder) * (step - Math.abs(remainder))
      : value - remainder,
    step,
  );
  if (snapped < min) snapped = min;
  else if (snapped > max)
    snapped =
      min + Math.floor(roundToStepPrecision((max - min) / step, step)) * step;
  return roundToStepPrecision(snapped, step);
}

/**
 * The thumb: ColorArea · ColorSlider as fractions of the box (`x` from the left, `y` from the top —
 * RAC writes `${f * 100}%`), ColorWheel in px from the wheel's top-left (RAC writes
 * `(outer + x).toFixed(3)px`). `color` = RAC's thumb `background-color`.
 */
export type CatalogColorThumb =
  | { kind: "fraction"; x?: number; y?: number; color: string }
  | { kind: "px"; x: number; y: number; color: string };

export function colorControlThumb(
  type: CatalogColorControlType,
  props: Readonly<Record<string, unknown>>,
  wheel?: { outerRadius: number; innerRadius: number },
  direction: "ltr" | "rtl" = "ltr",
): CatalogColorThumb {
  const { color, rac } = stateColor(type, props);
  if (type === "ColorArea") {
    const { xChannel, yChannel } = color.getColorSpaceAxes({
      xChannel: rac.xChannel,
      yChannel: rac.yChannel,
    });
    const xr = color.getChannelRange(xChannel);
    const yr = color.getChannelRange(yChannel);
    let x =
      (color.getChannelValue(xChannel) - xr.minValue) /
      (xr.maxValue - xr.minValue);
    const y =
      1 -
      (color.getChannelValue(yChannel) - yr.minValue) /
        (yr.maxValue - yr.minValue);
    if (direction === "rtl") x = 1 - x;
    return {
      kind: "fraction",
      x,
      y,
      color: color.withChannelValue("alpha", 1).toString(),
    };
  }
  if (type === "ColorSlider") {
    const channel = rac.channel!;
    const { minValue, maxValue, step } = color.getChannelRange(channel);
    const value = snapValueToStep(
      color.getChannelValue(channel),
      minValue,
      maxValue,
      step,
    );
    const f = (value - minValue) / (maxValue - minValue);
    const color_ = sliderDisplayColor(color, channel).toString();
    return props.orientation === "vertical"
      ? { kind: "fraction", y: 1 - f, color: color_ }
      : { kind: "fraction", x: direction === "rtl" ? 1 - f : f, color: color_ };
  }
  const outer = wheel?.outerRadius ?? 0;
  const inner = wheel?.innerRadius ?? 0;
  const radius = (inner + outer) / 2;
  // RAC `angleToCartesian` — 0° = 3 o'clock, clockwise.
  const rad = ((360 - color.getChannelValue("hue") + 90) * Math.PI) / 180;
  return {
    kind: "px",
    x: outer + Math.sin(rad) * radius,
    y: outer + Math.cos(rad) * radius,
    color: color
      .toFormat("hsl")
      .withChannelValue("saturation", 100)
      .withChannelValue("lightness", 50)
      .withChannelValue("alpha", 1)
      .toString(),
  };
}

/**
 * ADR-258 Decision 9 — the text RAC writes into a ColorSlider's Label (the channel's name) and
 * SliderOutput (the channel's value) when the author gives none.
 */
export function colorSliderText(
  props: Readonly<Record<string, unknown>>,
  locale: string,
): { label: string; output: string } {
  const { color, rac } = stateColor("ColorSlider", props);
  const channel = rac.channel!;
  return {
    label: color.getChannelName(channel, locale),
    output: color.formatChannelValue(channel, locale),
  };
}

/**
 * ADR-258 Decision 7 — the Preview element key's value part: the document default value's own
 * space, its channels' names and exact values in RAC's order, and alpha. Two spellings of the same
 * numbers share a key; any other difference (an achromatic hue, a space, a fraction) does not —
 * no hex / rounding step, so `hsl(0, 0%, 50%)` and `hsl(120, 0%, 50%)` differ.
 */
export function catalogColorKey(
  type: CatalogColorControlType,
  defaultValue: unknown,
): string {
  const color = catalogDocumentColor(type, { defaultValue });
  return JSON.stringify([
    color.getColorSpace(),
    color.getColorChannels().map((c) => [c, color.getChannelValue(c)]),
    color.getChannelValue("alpha"),
  ]);
}
