import {
  cssColorToAlpha,
  cssColorToHex,
  parseBoxShadowEffects,
} from "../workspace/canvas/styleConversion/styleConverter";
import type { DropShadowEffect } from "../workspace/canvas/skia/types";

/** CSS-facing fields edited by the continuous box-shadow controls. */
export type BoxShadowPresentationField =
  "offsetX" | "offsetY" | "blur" | "spread" | "color";

/** One parsed shadow layer. Values use CSS blur radius (not Skia sigma). */
export interface BoxShadowPresentationLayer {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blur: number;
  readonly spread: number;
  readonly color: string;
  readonly inset: boolean;
}

export interface BoxShadowPresentationValue {
  readonly layers: readonly BoxShadowPresentationLayer[];
}

const CSS_BLUR_TO_SKIA_SIGMA = 2.355;

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function formatAlpha(value: number): string {
  return formatNumber(Math.max(0, Math.min(1, value)));
}

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

function effectColorToCss(color: Float32Array): string {
  return `rgba(${byte(color[0] ?? 0)}, ${byte(color[1] ?? 0)}, ${byte(
    color[2] ?? 0,
  )}, ${formatAlpha(color[3] ?? 1)})`;
}

function parseColor(value: string): Float32Array {
  const hex = cssColorToHex(value, 0x000000);
  const alpha = cssColorToAlpha(value);
  return Float32Array.of(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
    alpha,
  );
}

export function isBoxShadowPresentationValue(
  value: unknown,
): value is BoxShadowPresentationValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const layers = (value as { layers?: unknown }).layers;
  if (!Array.isArray(layers) || layers.length === 0) return false;
  return layers.every((layer) => {
    if (!layer || typeof layer !== "object" || Array.isArray(layer)) {
      return false;
    }
    const candidate = layer as Partial<BoxShadowPresentationLayer>;
    return (
      typeof candidate.offsetX === "number" &&
      Number.isFinite(candidate.offsetX) &&
      typeof candidate.offsetY === "number" &&
      Number.isFinite(candidate.offsetY) &&
      typeof candidate.blur === "number" &&
      Number.isFinite(candidate.blur) &&
      candidate.blur >= 0 &&
      typeof candidate.spread === "number" &&
      Number.isFinite(candidate.spread) &&
      typeof candidate.color === "string" &&
      candidate.color.length > 0 &&
      typeof candidate.inset === "boolean"
    );
  });
}

export function parseBoxShadowPresentation(
  raw: string,
): BoxShadowPresentationValue | null {
  if (!raw || raw === "none") return null;
  const effects = parseBoxShadowEffects(raw);
  if (effects.length === 0) return null;
  return {
    layers: effects.map((effect) => ({
      offsetX: effect.dx,
      offsetY: effect.dy,
      blur: effect.sigmaX * CSS_BLUR_TO_SKIA_SIGMA,
      spread: effect.spread ?? 0,
      color: effectColorToCss(effect.color),
      inset: effect.inner,
    })),
  };
}

export function boxShadowPresentationToEffects(
  value: BoxShadowPresentationValue,
): DropShadowEffect[] {
  return value.layers.map((layer) => {
    const color = parseColor(layer.color);
    return {
      type: "drop-shadow",
      dx: layer.offsetX,
      dy: layer.offsetY,
      sigmaX: layer.blur / CSS_BLUR_TO_SKIA_SIGMA,
      sigmaY: layer.blur / CSS_BLUR_TO_SKIA_SIGMA,
      color,
      inner: layer.inset,
      spread: layer.spread,
    };
  });
}

export function serializeBoxShadowPresentation(
  value: BoxShadowPresentationValue,
): string {
  return value.layers
    .map(
      (layer) =>
        `${layer.inset ? "inset " : ""}${formatNumber(layer.offsetX)}px ${formatNumber(
          layer.offsetY,
        )}px ${formatNumber(layer.blur)}px ${formatNumber(
          layer.spread,
        )}px ${layer.color}`,
    )
    .join(", ");
}

export function patchBoxShadowPresentation(
  value: BoxShadowPresentationValue,
  layerIndex: number,
  field: BoxShadowPresentationField,
  nextValue: number | string,
): BoxShadowPresentationValue | null {
  const layer = value.layers[layerIndex];
  if (!layer) return null;
  if (field === "color") {
    if (typeof nextValue !== "string" || nextValue.length === 0) return null;
  } else if (typeof nextValue !== "number" || !Number.isFinite(nextValue)) {
    return null;
  }

  const nextLayer: BoxShadowPresentationLayer =
    field === "offsetX"
      ? { ...layer, offsetX: nextValue as number }
      : field === "offsetY"
        ? { ...layer, offsetY: nextValue as number }
        : field === "blur"
          ? { ...layer, blur: Math.max(0, nextValue as number) }
          : field === "spread"
            ? { ...layer, spread: nextValue as number }
            : { ...layer, color: nextValue as string };

  const layers = value.layers.slice();
  layers[layerIndex] = nextLayer;
  return { layers };
}

export function haveSameBoxShadowPresentationTopology(
  left: BoxShadowPresentationValue,
  right: BoxShadowPresentationValue,
): boolean {
  return (
    left.layers.length === right.layers.length &&
    left.layers.every(
      (layer, index) => layer.inset === right.layers[index]?.inset,
    )
  );
}
