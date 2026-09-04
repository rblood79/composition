import type { BoxShadowPresentationValue } from "../../builder/presentation/boxShadowPresentation";
import type { EditorMutationDescriptor } from "../../builder/presentation/editorPresentationTypes";
import { parsePresentationOpacity } from "../../builder/presentation/editorPresentationOpacity";
import {
  normalizePresentationSpacingPatch,
  normalizePresentationSpacingStyle,
} from "../../builder/presentation/editorPresentationStyleNormalization";

function isTypedBoxShadowPresentationValue(
  value: unknown,
): value is BoxShadowPresentationValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const layers = (value as { layers?: unknown }).layers;
  if (!Array.isArray(layers) || layers.length === 0) return false;
  return layers.every((layer) => {
    if (!layer || typeof layer !== "object" || Array.isArray(layer)) {
      return false;
    }
    const candidate = layer as Partial<
      BoxShadowPresentationValue["layers"][number]
    >;
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

function formatBoxShadowNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function serializeTypedBoxShadowPresentation(
  value: BoxShadowPresentationValue,
): string {
  return value.layers
    .map(
      (layer) =>
        `${layer.inset ? "inset " : ""}${formatBoxShadowNumber(layer.offsetX)}px ${formatBoxShadowNumber(layer.offsetY)}px ${formatBoxShadowNumber(layer.blur)}px ${formatBoxShadowNumber(layer.spread)}px ${layer.color}`,
    )
    .join(", ");
}

function boxShadowTopology(raw: unknown): readonly boolean[] | null {
  if (typeof raw !== "string" || raw.trim() === "" || raw === "none") {
    return null;
  }
  return raw.split(/,(?![^(]*\))/).map((layer) => /\binset\b/.test(layer));
}

function hasSameBoxShadowTopology(
  base: unknown,
  value: BoxShadowPresentationValue,
): boolean {
  const baseTopology = boxShadowTopology(base);
  return (
    baseTopology !== null &&
    baseTopology.length === value.layers.length &&
    baseTopology.every((inset, index) => inset === value.layers[index]?.inset)
  );
}

/** Skia layout bridge와 동일한 보수적 layout presentation allowlist. */
export function resolvePresentationLayoutProps(
  base: Record<string, unknown>,
  mutations: readonly EditorMutationDescriptor[] | undefined,
  hasChildren = false,
): Record<string, unknown> {
  const baseStyle = base.style;
  if (!baseStyle || typeof baseStyle !== "object") return base;
  const style = normalizePresentationSpacingStyle(
    baseStyle as Record<string, unknown>,
  );
  if (style.position === "fixed" || style.position === "sticky") return base;

  let nextStyle = style;
  for (const mutation of mutations ?? []) {
    const rawPatch =
      mutation.type === "style.patch"
        ? mutation.patch
        : mutation.type === "geometry.patch"
          ? mutation.patch
          : null;
    if (!rawPatch) continue;
    const patch =
      mutation.type === "style.patch"
        ? normalizePresentationSpacingPatch(rawPatch)
        : rawPatch;
    const keys = Object.keys(patch);
    const isStylePatch = mutation.type === "style.patch";
    const allowedKeys = isStylePatch
      ? [
          "left",
          "top",
          "width",
          "height",
          "padding",
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
          "gap",
          "rowGap",
          "columnGap",
        ]
      : ["x", "y", "width", "height"];
    const hasSizePatch = keys.includes("width") || keys.includes("height");
    const hasPositionPatch = keys.some((key) =>
      ["left", "top", "x", "y"].includes(key),
    );
    if (
      keys.length === 0 ||
      (hasPositionPatch && style.position !== "absolute") ||
      (hasChildren && style.position === "absolute" && hasSizePatch) ||
      keys.some((key) => !allowedKeys.includes(key)) ||
      keys.some(
        (key) =>
          typeof patch[key] !== "number" ||
          !Number.isFinite(patch[key]) ||
          patch[key] < 0,
      )
    ) {
      continue;
    }
    nextStyle = {
      ...nextStyle,
      ...(isStylePatch
        ? patch
        : {
            ...(patch.x !== undefined ? { left: patch.x } : {}),
            ...(patch.y !== undefined ? { top: patch.y } : {}),
          }),
    };
  }
  if (nextStyle === style) return base;
  return { ...base, style: nextStyle };
}

export function resolvePresentationPaintProps(
  base: Record<string, unknown>,
  mutations: readonly EditorMutationDescriptor[] | undefined,
): Record<string, unknown> {
  const baseStyle = base.style;
  if (!baseStyle || typeof baseStyle !== "object") return base;
  const style = baseStyle as Record<string, unknown>;
  let nextStyle = style;
  for (const mutation of mutations ?? []) {
    if (mutation.type !== "style.patch") continue;
    const patch = mutation.patch;
    const keys = Object.keys(patch);
    if (
      keys.length === 0 ||
      keys.some(
        (key) =>
          key !== "borderColor" &&
          key !== "boxShadow" &&
          key !== "color" &&
          key !== "opacity",
      ) ||
      (keys.includes("borderColor") && typeof patch.borderColor !== "string") ||
      (keys.includes("color") && typeof patch.color !== "string") ||
      (keys.includes("opacity") &&
        parsePresentationOpacity(patch.opacity) === null) ||
      (keys.includes("boxShadow") &&
        typeof patch.boxShadow !== "string" &&
        !isTypedBoxShadowPresentationValue(patch.boxShadow))
    ) {
      continue;
    }
    const typedBoxShadow = isTypedBoxShadowPresentationValue(patch.boxShadow)
      ? patch.boxShadow
      : null;
    if (
      typedBoxShadow &&
      !hasSameBoxShadowTopology(style.boxShadow, typedBoxShadow)
    ) {
      continue;
    }
    const boxShadow = typedBoxShadow
      ? serializeTypedBoxShadowPresentation(typedBoxShadow)
      : patch.boxShadow;
    nextStyle = {
      ...nextStyle,
      ...(keys.includes("borderColor")
        ? { borderColor: patch.borderColor }
        : {}),
      ...(keys.includes("color") ? { color: patch.color } : {}),
      ...(keys.includes("opacity") ? { opacity: patch.opacity } : {}),
      ...(keys.includes("boxShadow") ? { boxShadow } : {}),
    };
  }
  if (nextStyle === style) return base;
  return { ...base, style: nextStyle };
}
