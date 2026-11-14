/**
 * (2026-11-14, 사용자 「staticColor auto 를 S2 방식으로」) S2 1.8.2 `style/tokens.ts` `autoStaticColor`:
 * `staticColor="auto"` is the black or the white static scheme, picked from the background the element
 * sits on — `lch(from var(--s2-container-bg) calc((49.44 - l) * infinity) 0 0)`: CIE LCH lightness under
 * 49.44 is white, else black. S2's background is the nearest container's `--s2-container-bg` (page base ·
 * Card · Modal · Popover · ActionBar · a black / white static scheme); a no-code page also paints its own
 * frames, so an opaque solid fill counts too (사용자 결정 「칠한 단색 바탕도 포함」).
 *
 * One resolution for both consumers: the composition root's derive step writes the resolved scheme to
 * `derivedProps.staticColor` (with `_staticAuto`), the Canvas paint and the DOM `data-static-color` read it.
 */
import { parseColor } from "react-aria-components/ColorPicker";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogContainerLayerOf } from "./containerLayer";

export type CatalogStaticScheme = "white" | "black";

/** S2's lightness threshold (`autoStaticColor`). */
const AUTO_LIGHTNESS = 49.44;

/**
 * The scheme `staticColor="auto"` takes on a background color: CIE LCH (D50) lightness under 49.44 →
 * white, else black (at the threshold S2's `0 * infinity` is 0 — black).
 */
export function catalogAutoStaticTone(background: string): CatalogStaticScheme {
  const rgb = parseColor(background).toFormat("rgb");
  const linear = (channel: "red" | "green" | "blue") => {
    const value = rgb.getChannelValue(channel) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  // (CSS Color 4: linear sRGB → XYZ D50, the Y row — then CIE L*)
  const y =
    0.2225045 * linear("red") +
    0.7168786 * linear("green") +
    0.0606169 * linear("blue");
  const lightness =
    y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
  return lightness < AUTO_LIGHTNESS ? "white" : "black";
}

/** A record's own black · white scheme — its resolved one (a group's, an auto) over its prop. */
export function catalogStaticScheme(
  node: Pick<CatalogConsumerNode, "props" | "derivedProps">,
): CatalogStaticScheme | undefined {
  const value = node.derivedProps?.staticColor ?? node.props.staticColor;
  return value === "white" || value === "black" ? value : undefined;
}

/** The color of a record's top fill when it is one opaque solid color, else undefined. */
function opaqueSolidFill(node: CatalogConsumerNode): string | undefined {
  const fills = node.fills ?? [];
  for (let index = fills.length - 1; index >= 0; index -= 1) {
    const layer = fills[index];
    if (layer.enabled === false) continue;
    if (layer.kind !== "color" || layer.opacity !== 1) return undefined;
    try {
      return parseColor(layer.color).getChannelValue("alpha") === 1
        ? layer.color
        : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * The scheme `auto` resolves to under `node`: the nearest ancestor that is a backdrop — a black · white
 * static scheme (S2 `staticColor()` sets `--s2-container-bg` to its opposite), an opaque solid fill, a
 * layer container (its layer token in the theme) — else the page base.
 */
export function catalogStaticBackdropTone(
  node: Pick<CatalogConsumerNode, "parentId">,
  get: (id: string) => CatalogConsumerNode | undefined,
  readThemeColor: (ref: string) => unknown,
): CatalogStaticScheme {
  const toneOf = (ref: string) => {
    const color = readThemeColor(ref);
    return typeof color === "string" ? catalogAutoStaticTone(color) : undefined;
  };
  for (let up = get(node.parentId); up; up = get(up.parentId)) {
    // (An `auto` ancestor sets no backdrop — S2 `staticColor()` writes `--s2-container-bg` only for
    //  black · white: the walk goes on past it, whatever its own resolution says yet.)
    const auto =
      up.props.staticColor === "auto" ||
      up.derivedProps?.staticColor === "auto" ||
      up.derivedProps?._staticAuto === true;
    const scheme = auto ? undefined : catalogStaticScheme(up);
    if (scheme) return scheme;
    const solid = opaqueSolidFill(up);
    if (solid) return catalogAutoStaticTone(solid);
    const layer = catalogContainerLayerOf(up);
    const tone = layer && toneOf(`{color.${layer}}`);
    if (tone) return tone;
  }
  return toneOf("{color.base}") ?? "black";
}

/** Whether a record paints `auto` — its own prop or the one its group hands it (`presence.ts`). */
export function catalogStaticAuto(
  node: Pick<CatalogConsumerNode, "props">,
  derived: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return (derived?.staticColor ?? node.props.staticColor) === "auto";
}

const backdropKey = (node: CatalogConsumerNode | undefined) =>
  node
    ? JSON.stringify([
        node.fills ?? null,
        catalogStaticScheme(node) ?? null,
        catalogContainerLayerOf(node) ?? null,
      ])
    : "";

/**
 * The records to re-derive when `after` changed as a backdrop (its fill, its static scheme, its layer):
 * the `auto` records under it, and their parts (a ProgressBar's label · value, an ActionButton's badge).
 */
export function catalogStaticAutoDependents(
  after: CatalogConsumerNode,
  before: CatalogConsumerNode | undefined,
  get: (id: string) => CatalogConsumerNode | undefined,
): CatalogConsumerNode[] {
  if (!before || after.children.length === 0) return [];
  const out: CatalogConsumerNode[] = [];
  // (Its own scheme turned `auto` or back, or resolved anew: its parts take its paint — an `auto`
  //  Button is their glyph owner, `presence.ts` `catalogToggleButtonGlyphOwner`.)
  if (
    before.props.staticColor !== after.props.staticColor ||
    before.derivedProps?.staticColor !== after.derivedProps?.staticColor ||
    before.derivedProps?._staticAuto !== after.derivedProps?._staticAuto
  )
    for (const id of after.children) {
      const part = get(id);
      if (part) out.push(part);
    }
  if (backdropKey(before) === backdropKey(after)) return out;
  const visit = (record: CatalogConsumerNode) => {
    for (const id of record.children) {
      const child = get(id);
      if (!child) continue;
      if (
        child.props.staticColor === "auto" ||
        child.derivedProps?._staticAuto === true
      ) {
        out.push(child);
        for (const partId of child.children) {
          const part = get(partId);
          if (part) out.push(part);
        }
      }
      visit(child);
    }
  };
  visit(after);
  return out;
}

/**
 * The static scheme a record's DOM carries (`staticColor` prop · `data-static-color`): its resolved one
 * (an `auto`'s backdrop scheme, its group's) over its own prop; none for an unset or empty value.
 */
export function catalogEffectiveStaticColor(
  node: Pick<CatalogConsumerNode, "props" | "derivedProps">,
): string | undefined {
  const value = node.derivedProps?.staticColor ?? node.props.staticColor;
  return typeof value === "string" && value !== "" ? value : undefined;
}
