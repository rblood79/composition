import { parseColor } from "react-stately";
import type { Color, ColorChannel, ColorSpace } from "react-stately";

/**
 * ADR-258 — a Color control's (ColorArea · ColorSlider · ColorWheel) color value and its color
 * space · channels as the document stores them: the value type `racColor` (what RAC's `parseColor`
 * accepts), the props RAC receives (one fallback for the Canvas and the DOM), the one-write
 * normalization of a props patch (Decision 8) and the validator's last line. The gradient · thumb ·
 * text RAC draws from these is `runtime/colorControlGradient.ts`.
 */

export type CatalogColorControlType =
  "ColorArea" | "ColorSlider" | "ColorWheel";

export const CATALOG_COLOR_CONTROL_TYPES: ReadonlySet<string> = new Set([
  "ColorArea",
  "ColorSlider",
  "ColorWheel",
]);

/**
 * Binding defaults (`defaultValue`) — ColorArea · ColorWheel = RAC's own; ColorSlider has none in
 * RAC (it throws without one) — the reference's first example.
 */
export const CATALOG_COLOR_DEFAULT_VALUE: Readonly<
  Record<CatalogColorControlType, string>
> = {
  ColorArea: "#ffffff",
  ColorSlider: "hsl(0, 100%, 50%)",
  ColorWheel: "hsl(0, 100%, 50%)",
};

/** ColorSlider's binding default channel (the reference's first example). */
export const CATALOG_COLOR_SLIDER_DEFAULT_CHANNEL: ColorChannel = "hue";

export const CATALOG_COLOR_SPACES: readonly ColorSpace[] = [
  "rgb",
  "hsl",
  "hsb",
];

/** The channels of each color space, in RAC's order (`getColorChannels`). */
export const CATALOG_COLOR_SPACE_CHANNELS: Readonly<
  Record<ColorSpace, readonly ColorChannel[]>
> = {
  rgb: ["red", "green", "blue"],
  hsl: ["hue", "saturation", "lightness"],
  hsb: ["hue", "saturation", "brightness"],
};

export const CATALOG_COLOR_CHANNELS: readonly ColorChannel[] = [
  "hue",
  "saturation",
  "brightness",
  "lightness",
  "red",
  "green",
  "blue",
  "alpha",
];

const parsed = new Map<string, Color | null>();

/** `parseColor` without throwing (memoized — the same strings repeat across records and frames). */
function tryParse(value: string): Color | null {
  let color = parsed.get(value);
  if (color !== undefined) return color;
  try {
    const c = parseColor(value);
    const finite = [...c.getColorChannels(), "alpha" as const].every((ch) =>
      Number.isFinite(c.getChannelValue(ch)),
    );
    color = finite ? c : null;
  } catch {
    color = null;
  }
  if (parsed.size > 512) parsed.clear();
  parsed.set(value, color);
  return color;
}

/**
 * ADR-258 Decision 1 — a color string RAC accepts (`racColor`): what the installed `parseColor`
 * parses (hex `#rgb` · `#rgba` · `#rrggbb` · `#rrggbbaa`; comma `rgb[a]` · `hsl[a]` · `hsb[a]`) with
 * finite channels. CSS names (`red`), the space syntax (`rgb(255 0 0)`) and `oklch()` throw in RAC
 * and are refused.
 */
export function isRacColorString(value: unknown): value is string {
  return typeof value === "string" && tryParse(value) !== null;
}

function isColorSpace(value: unknown): value is ColorSpace {
  return value === "rgb" || value === "hsl" || value === "hsb";
}

/** A channel the color space has (`alpha` is in every space). */
export function catalogColorSpaceHasChannel(
  space: ColorSpace,
  channel: unknown,
): channel is ColorChannel {
  return (
    channel === "alpha" ||
    (CATALOG_COLOR_SPACE_CHANNELS[space] as readonly unknown[]).includes(
      channel,
    )
  );
}

/** The document `defaultValue` as a Color — the binding default when empty or not a RAC color. */
export function catalogDocumentColor(
  type: CatalogColorControlType,
  props: Readonly<Record<string, unknown>>,
): Color {
  const value = props.defaultValue;
  return (
    (typeof value === "string" && value !== "" ? tryParse(value) : null) ??
    parseColor(CATALOG_COLOR_DEFAULT_VALUE[type])
  );
}

/**
 * The effective color space (Decision 8): `colorSpace` when set, else the default value's own
 * (RAC's rule — it `toFormat`s only when `colorSpace` is given).
 */
export function catalogColorEffectiveSpace(
  type: CatalogColorControlType,
  props: Readonly<Record<string, unknown>>,
): ColorSpace {
  if (isColorSpace(props.colorSpace)) return props.colorSpace;
  return catalogDocumentColor(type, props).getColorSpace();
}

/**
 * The props RAC receives — the same for the Canvas and the DOM. `defaultValue` is always a RAC
 * color (the binding default when empty or unparsable); a channel outside the effective space (a
 * damaged document — the validator refuses it on write) falls back to RAC's own axis default
 * (ColorArea) or the space's first channel (ColorSlider). ColorWheel has no space or channel.
 */
export function catalogColorControlProps(
  type: CatalogColorControlType,
  props: Readonly<Record<string, unknown>>,
): {
  defaultValue: string;
  colorSpace?: ColorSpace;
  channel?: ColorChannel;
  xChannel?: ColorChannel;
  yChannel?: ColorChannel;
} {
  const value = props.defaultValue;
  const defaultValue =
    typeof value === "string" && value !== "" && tryParse(value)
      ? value
      : CATALOG_COLOR_DEFAULT_VALUE[type];
  if (type === "ColorWheel") return { defaultValue };
  const colorSpace = isColorSpace(props.colorSpace)
    ? props.colorSpace
    : undefined;
  const space = colorSpace ?? parseColor(defaultValue).getColorSpace();
  if (type === "ColorSlider") {
    const channel = catalogColorSpaceHasChannel(space, props.channel)
      ? props.channel
      : props.channel === undefined || props.channel === ""
        ? catalogColorSpaceHasChannel(
            space,
            CATALOG_COLOR_SLIDER_DEFAULT_CHANNEL,
          )
          ? CATALOG_COLOR_SLIDER_DEFAULT_CHANNEL
          : CATALOG_COLOR_SPACE_CHANNELS[space][0]
        : CATALOG_COLOR_SPACE_CHANNELS[space][0];
    return { defaultValue, ...(colorSpace ? { colorSpace } : {}), channel };
  }
  const x = props.xChannel;
  const y = props.yChannel;
  const ok = (c: unknown): c is ColorChannel =>
    c !== "alpha" &&
    (CATALOG_COLOR_SPACE_CHANNELS[space] as readonly unknown[]).includes(c);
  const xChannel = ok(x) ? x : undefined;
  const yChannel = ok(y) && y !== xChannel ? y : undefined;
  return {
    defaultValue,
    ...(colorSpace ? { colorSpace } : {}),
    ...(xChannel ? { xChannel } : {}),
    ...(yChannel ? { yChannel } : {}),
  };
}

/** The channel space a channel implies when it is outside the current one (Decision 8). */
function spaceForChannel(
  channel: ColorChannel,
  current: ColorSpace,
): ColorSpace {
  if (catalogColorSpaceHasChannel(current, channel)) return current;
  if (channel === "red" || channel === "green" || channel === "blue")
    return "rgb";
  if (channel === "lightness") return "hsl";
  if (channel === "brightness") return "hsb";
  return "hsl"; // hue · saturation from rgb
}

/**
 * ADR-258 Decision 8 — widen a props patch so the color space, the channels and the default value
 * stay a combination RAC accepts, in one write:
 * - `colorSpace` changes → ColorSlider `channel` kept if the new space has it, else the space's
 *   first; ColorArea `xChannel` · `yChannel` kept if in the new space and distinct, else cleared.
 * - a channel outside the effective space → `colorSpace` follows (red · green · blue → rgb,
 *   lightness → hsl, brightness → hsb, hue · saturation → hsl from rgb); ColorArea's other axis by
 *   the rule above.
 * - `defaultValue` alone moves the effective space (no `colorSpace`) → the previous effective space
 *   is written to `colorSpace` (the view stays).
 * Returns the patch unchanged for any other type or a patch touching none of these keys.
 * `undefined` in the patch clears a key.
 */
export function normalizeColorControlPatch(
  type: string,
  props: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  if (type !== "ColorArea" && type !== "ColorSlider") return { ...patch };
  const t = type as CatalogColorControlType;
  const keys = [
    "colorSpace",
    "channel",
    "xChannel",
    "yChannel",
    "defaultValue",
  ];
  if (!keys.some((k) => k in patch)) return { ...patch };
  const out: Record<string, unknown> = { ...patch };
  const next = { ...props, ...patch };
  const before = catalogColorEffectiveSpace(t, props);

  // `defaultValue` alone moved the space → keep the previous one.
  if (
    "defaultValue" in patch &&
    !("colorSpace" in patch) &&
    !isColorSpace(props.colorSpace) &&
    catalogColorEffectiveSpace(t, next) !== before
  ) {
    out.colorSpace = before;
    next.colorSpace = before;
  }

  let space = catalogColorEffectiveSpace(t, next);
  // A channel the patch picked that the space lacks → the space follows the channel.
  const picked =
    t === "ColorSlider"
      ? "channel" in patch
        ? patch.channel
        : undefined
      : "xChannel" in patch
        ? patch.xChannel
        : "yChannel" in patch
          ? patch.yChannel
          : undefined;
  if (
    typeof picked === "string" &&
    CATALOG_COLOR_CHANNELS.includes(picked as ColorChannel) &&
    !catalogColorSpaceHasChannel(space, picked)
  ) {
    space = spaceForChannel(picked as ColorChannel, space);
    out.colorSpace = space;
    next.colorSpace = space;
  }

  if (t === "ColorSlider") {
    const channel = next.channel;
    if (channel !== undefined && !catalogColorSpaceHasChannel(space, channel)) {
      out.channel = CATALOG_COLOR_SPACE_CHANNELS[space][0];
    } else if (
      channel === undefined &&
      !catalogColorSpaceHasChannel(space, CATALOG_COLOR_SLIDER_DEFAULT_CHANNEL)
    ) {
      // The binding default `hue` is not in rgb — write the space's first channel.
      out.channel = CATALOG_COLOR_SPACE_CHANNELS[space][0];
    }
    return out;
  }
  const inSpace = (c: unknown) =>
    c !== "alpha" &&
    (CATALOG_COLOR_SPACE_CHANNELS[space] as readonly unknown[]).includes(c);
  const pickedAxis =
    "xChannel" in patch ? "xChannel" : "yChannel" in patch ? "yChannel" : null;
  const other = pickedAxis === "xChannel" ? "yChannel" : "xChannel";
  for (const axis of pickedAxis
    ? [pickedAxis, other]
    : ["xChannel", "yChannel"]) {
    const value = next[axis];
    if (value === undefined) continue;
    const clash =
      axis !== pickedAxis && pickedAxis !== null && value === next[pickedAxis];
    if (!inSpace(value) || clash) {
      out[axis] = undefined;
      next[axis] = undefined;
    }
  }
  if (
    next.xChannel !== undefined &&
    next.xChannel === next.yChannel &&
    pickedAxis === null
  ) {
    out.yChannel = undefined;
  }
  return out;
}

/**
 * The validator's last line (Decision 8): a stored combination RAC throws on. `null` = valid.
 */
export function catalogColorControlPropsError(
  type: string,
  props: Readonly<Record<string, unknown>>,
): string | null {
  if (type !== "ColorArea" && type !== "ColorSlider") return null;
  const t = type as CatalogColorControlType;
  const space = catalogColorEffectiveSpace(t, props);
  if (t === "ColorSlider") {
    const channel = props.channel ?? CATALOG_COLOR_SLIDER_DEFAULT_CHANNEL;
    return catalogColorSpaceHasChannel(space, channel)
      ? null
      : `channel "${String(channel)}" is not in color space "${space}"`;
  }
  for (const axis of ["xChannel", "yChannel"] as const) {
    const c = props[axis];
    if (c === undefined) continue;
    if (
      c === "alpha" ||
      !(CATALOG_COLOR_SPACE_CHANNELS[space] as readonly unknown[]).includes(c)
    )
      return `${axis} "${String(c)}" is not in color space "${space}"`;
  }
  if (props.xChannel !== undefined && props.xChannel === props.yChannel)
    return `xChannel and yChannel are both "${String(props.xChannel)}"`;
  return null;
}
