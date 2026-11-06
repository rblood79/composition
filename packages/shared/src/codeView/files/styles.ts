/**
 * ADR-296 Phase 4 · Decision 3 · breakdown §4c (사용자 결정 1 · 6) — a page's style as a CSS file
 * with one class per node: `src/pages/<Page>.css`. The class is the node's name in kebab-case (its
 * type when unnamed), a repeated one taking `-2` · `-3` in document order — display only, the anchor
 * holds the node. A declaration is one typed field: the Styles panel's CSS keys for the fields it
 * edits (`catalogStyleWrites` reads them back — the same command), `--<field>` for a field no CSS
 * property names (`--icon-size` · `--fill`), `var(--…)` for a token (the name the generated catalog
 * CSS reads — ADR-295 `--catalog-token-*`, so a device's scale stays the resolver's), `unset` for a
 * masked value. `@media (max-width: …)` = a breakpoint layer (the Canvas cascade: tablet, then mobile),
 * `[data-hovered]` · … = a state (RAC's data attributes — D1), `background` = the fill layers,
 * `color-scheme` · `--theme-tint` = the node's forced theme (not a condition — review h2),
 * `display: none` · `revert` = the per-breakpoint visibility.
 */
import { tokenToCSSVar, withCatalogTokenVars } from "@composition/rendering";
import type {
  BreakpointName,
  DefinitionEntry,
  CatalogFillColor,
  CatalogFillLayer,
  CatalogReader,
  FillSizing,
  LayoutField,
  NodeEntry,
  NodeResponsiveLayer,
  PageEntry,
  ResponsiveBreakpointName,
  SizingField,
  StateName,
  TokenEntry,
  VisualField,
} from "../../catalog/document/types";
import type { CodeViewReader, CodeViewResult } from "../types";
import { CodeWriter } from "../writer";
import { definitionTypeName } from "../../catalog/commands/context";
import { codeViewAddressKey, codeViewTreeClasses } from "./overrides";

type Reader = Pick<CatalogReader, "projectId" | "getEntry" | "library">;

/** Desktop-first media of the two smaller breakpoints (`BREAKPOINTS` — tablet ≤ 1279, mobile ≤ 767). */
export const CODE_VIEW_BREAKPOINT_MEDIA: Readonly<
  Record<ResponsiveBreakpointName, string>
> = {
  tablet: "(max-width: 1279px)",
  mobile: "(max-width: 767px)",
};

/** A state's RAC data attributes (D1 — the names RAC writes). */
export const CODE_VIEW_STATE_SELECTORS: Readonly<Record<StateName, string>> = {
  hover: "[data-hovered]",
  pressed: "[data-pressed]",
  selected: "[data-selected]",
  selectedHover: "[data-selected][data-hovered]",
  selectedPressed: "[data-selected][data-pressed]",
  disabled: "[data-disabled]",
  focusVisible: "[data-focus-visible]",
};

/** How a field's number is written: a px length, or a plain number. */
type Unit = "px" | "number";
interface CssPlace {
  readonly property: string;
  readonly unit: Unit;
}
const px = (property: string): CssPlace => ({ property, unit: "px" });
const plain = (property: string): CssPlace => ({ property, unit: "number" });

/**
 * Every visual field's CSS place (a mapped type — a field the type gains is a compile error here).
 * The Styles panel's keys keep its CSS names; the rest are `--<field>` custom properties.
 */
export const CODE_VIEW_VISUAL_CSS: Readonly<Record<VisualField, CssPlace>> = {
  color: plain("color"),
  backgroundColor: plain("background-color"),
  borderColor: plain("border-color"),
  fill: plain("--fill"),
  opacity: plain("opacity"),
  fontSize: px("font-size"),
  lineHeight: plain("line-height"),
  fontWeight: plain("font-weight"),
  width: px("width"),
  height: px("height"),
  overflow: plain("overflow"),
  radius: px("border-radius"),
  gap: px("gap"),
  padding: px("padding"),
  borderWidth: px("border-width"),
  borderStyle: plain("border-style"),
  fillAlpha: plain("--fill-alpha"),
  minHeight: px("min-height"),
  thumbSize: px("--thumb-size"),
  indentPerLevel: px("--indent-per-level"),
  iconGap: px("--icon-gap"),
  iconSize: px("--icon-size"),
  paddingX: px("--padding-x"),
  paddingY: px("--padding-y"),
  minWidth: px("min-width"),
  paddingTop: px("padding-top"),
  paddingRight: px("padding-right"),
  paddingBottom: px("padding-bottom"),
  paddingLeft: px("padding-left"),
  fontFamily: plain("font-family"),
  fontStyle: plain("font-style"),
  letterSpacing: px("letter-spacing"),
  textAlign: plain("text-align"),
  textTransform: plain("text-transform"),
  textDecoration: plain("text-decoration"),
  whiteSpace: plain("white-space"),
  wordBreak: plain("word-break"),
  overflowWrap: plain("overflow-wrap"),
  textOverflow: plain("text-overflow"),
  boxShadow: plain("box-shadow"),
  filter: plain("filter"),
  transform: plain("transform"),
  zIndex: plain("z-index"),
  aspectRatio: plain("aspect-ratio"),
  backgroundImage: plain("background-image"),
  backgroundSize: plain("background-size"),
  radiusTopLeft: px("border-top-left-radius"),
  radiusTopRight: px("border-top-right-radius"),
  radiusBottomRight: px("border-bottom-right-radius"),
  radiusBottomLeft: px("border-bottom-left-radius"),
  borderTopWidth: px("border-top-width"),
  borderRightWidth: px("border-right-width"),
  borderBottomWidth: px("border-bottom-width"),
  borderLeftWidth: px("border-left-width"),
};

/** Every layout field's CSS property (CSS text values). */
export const CODE_VIEW_LAYOUT_CSS: Readonly<Record<LayoutField, string>> = {
  display: "display",
  flexDirection: "flex-direction",
  alignItems: "align-items",
  justifyContent: "justify-content",
  flexWrap: "flex-wrap",
  position: "position",
  insetLeft: "left",
  insetTop: "top",
  insetRight: "right",
  insetBottom: "bottom",
  flexGrow: "flex-grow",
  flexShrink: "flex-shrink",
  flexBasis: "flex-basis",
  alignSelf: "align-self",
  justifySelf: "justify-self",
  gridColumnStart: "grid-column-start",
  gridColumnEnd: "grid-column-end",
  gridRowStart: "grid-row-start",
  gridRowEnd: "grid-row-end",
  rowGap: "row-gap",
  columnGap: "column-gap",
  marginTop: "margin-top",
  marginRight: "margin-right",
  marginBottom: "margin-bottom",
  marginLeft: "margin-left",
  verticalAlign: "vertical-align",
  contain: "contain",
  containIntrinsicWidth: "contain-intrinsic-width",
  gridTemplateColumns: "grid-template-columns",
  gridTemplateRows: "grid-template-rows",
  gridTemplateAreas: "grid-template-areas",
  maxWidth: "max-width",
  maxHeight: "max-height",
  order: "order",
};

/** Every sizing field's CSS property (px numbers). */
export const CODE_VIEW_SIZING_CSS: Readonly<Record<SizingField, string>> = {
  width: "width",
  height: "height",
  minWidth: "min-width",
  minHeight: "min-height",
  maxWidth: "max-width",
  maxHeight: "max-height",
};

/** The whole-field declarations (not a typed field's key). */
export const CODE_VIEW_FILLS_CSS = "background";
export const CODE_VIEW_FILL_SIZING_CSS = {
  width: "--fill-width",
  height: "--fill-height",
} as const;
export const CODE_VIEW_THEME_MODE_CSS = "color-scheme";
export const CODE_VIEW_THEME_TINT_CSS = "--theme-tint";
/** The read-only marker a value the CSS cannot hold writes instead (a mesh fill …). */
export const CODE_VIEW_DESIGN_PANEL_MARKER = (field: string) =>
  `/* composition: ${field} — Design panel */`;

/** kebab-case of a display name (`Hero Title` → `hero-title`); empty → the fallback. */
export function codeViewKebab(raw: string, fallback: string): string {
  const kebab = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const safe = kebab || fallback;
  return /^[0-9]/.test(safe) ? `n-${safe}` : safe;
}

/** A node's definition type name (`Button` · `frame`). */

/** A node's type for its class: a user component's name (an instance), else its definition type. */
export function codeViewTypeName(reader: Reader, definitionId: string): string {
  const own = definitionId.startsWith("lib:")
    ? undefined
    : (reader.getEntry(definitionId) as DefinitionEntry | undefined);
  if (
    own?.kind === "definition" &&
    own.templateRootId &&
    own.usage !== "layout"
  )
    return own.name;
  try {
    return definitionTypeName(reader as never, definitionId as never);
  } catch {
    return "node";
  }
}

/** The page's nodes in document order (its owned tree — an instance's insides are not page nodes). */
export function codeViewPageNodes(
  reader: Pick<CatalogReader, "getEntry">,
  pageId: string,
): NodeEntry[] {
  // (ADR-296 Phase 5 — a component's file: its origin template is the root.)
  const entry = reader.getEntry(pageId) as
    PageEntry | DefinitionEntry | undefined;
  const page =
    entry?.kind === "definition"
      ? ({
          kind: "page",
          children: entry.templateRootId ? [entry.templateRootId] : [],
        } as unknown as PageEntry)
      : (entry as PageEntry | undefined);
  const out: NodeEntry[] = [];
  const walk = (ids: readonly string[]) => {
    for (const id of ids) {
      const node = reader.getEntry(id) as NodeEntry | undefined;
      if (node?.kind !== "node") continue;
      out.push(node);
      walk(node.children);
      // (ADR-296 Phase 5 — an instance's slot fills are the page's nodes too.)
      for (const fill of node.descendantOverrides ?? [])
        if (fill.kind === "fillSlot") walk(fill.childIds);
    }
  };
  walk(page?.kind === "page" ? page.children : []);
  return out;
}

/**
 * 사용자 결정 6 — each page node's class: its name in kebab-case (its type when unnamed), unique in
 * the page (`-2` · `-3` in document order). Every node has one (stable when styles come and go);
 * the code writes it only on a node that has a style.
 */
export function codeViewNodeClasses(
  reader: Reader,
  pageId: string,
): Map<string, string> {
  // (One table with a template's names — `codeViewTreeClasses` over the page's roots.)
  const entry = reader.getEntry(pageId) as
    PageEntry | DefinitionEntry | undefined;
  const roots =
    entry?.kind === "definition"
      ? entry.templateRootId
        ? [entry.templateRootId]
        : []
      : entry?.kind === "page"
        ? entry.children
        : [];
  return codeViewTreeClasses(reader as never, roots);
}

/* ── values ── */

/** A token's CSS reference: the generated catalog CSS's name (ADR-295) or the project token's. */
export function codeViewTokenVar(reader: Reader, tokenId: string): string {
  if (tokenId.startsWith("lib:token:")) {
    const token = reader.library.tokens.get(tokenId as never);
    if (token?.ref) {
      const css = withCatalogTokenVars(tokenToCSSVar(token.ref as never));
      if (/^var\(--[\w-]+\)$/.test(css)) return css;
    }
    return `var(--${codeViewKebab(tokenId.slice(10), "token")})`;
  }
  const token = reader.getEntry(tokenId) as TokenEntry | undefined;
  return `var(--${codeViewKebab(token?.name ?? "", "token")})`;
}

/** A field's value as CSS text (undefined = not CSS-writable). */
function cssValue(
  reader: Reader,
  value: unknown,
  unit: Unit,
  tokens: Record<string, string>,
): string | undefined {
  if (value && typeof value === "object" && "tokenId" in value) {
    const tokenId = (value as { tokenId: string }).tokenId;
    const css = codeViewTokenVar(reader, tokenId);
    tokens[css.slice(4, -1)] = tokenId;
    return css;
  }
  if (typeof value === "number")
    return unit === "px" && value !== 0 ? `${value}px` : String(value);
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "boolean") return String(value);
  return undefined;
}

type Writes = Readonly<Record<string, unknown>> | undefined;
interface Declaration {
  readonly property: string;
  readonly value: string;
}

function writesOf(
  reader: Reader,
  layer: "visual" | "layout" | "sizing",
  writes: Writes,
  place: (key: string) => CssPlace | undefined,
  tokens: Record<string, string>,
  out: Declaration[],
): void {
  for (const [key, write] of Object.entries(writes ?? {})) {
    const at = place(key);
    if (!at || !write || typeof write !== "object") continue;
    const kind = (write as { kind?: string }).kind;
    // (판독 MEDIUM-1 — a property another field of the block already writes: this field's own name.)
    const property = out.some((item) => item.property === at.property)
      ? codeViewLayerProperty(layer, key)
      : at.property;
    if (kind === "mask") out.push({ property, value: "unset" });
    if (kind !== "set") continue;
    const value = cssValue(
      reader,
      (write as { value: unknown }).value,
      at.unit,
      tokens,
    );
    if (value !== undefined) out.push({ property, value });
  }
}

/** A field's own custom property (`--sizing-width`) — when its CSS property is already taken. */
export const codeViewLayerProperty = (
  layer: "visual" | "layout" | "sizing",
  field: string,
) => `--${layer}-${codeViewKebab(field, field)}`;

/** The visibility's own property when `display` is a layout value of the block (`--visible`). */
export const CODE_VIEW_VISIBLE_CSS = "--visible";

/* ── fills (the Fill panel's layers) ── */

/**
 * The fill layers as one `background` (top layer first, as CSS stacks them) — undefined when a
 * layer has no CSS form here (a radial · angular · mesh gradient, a layer off, an opacity or blend
 * of its own): the Design panel keeps it.
 */
export function codeViewFillsCss(
  fills: readonly CatalogFillLayer[],
  reader?: Reader,
  tokens?: Record<string, string>,
): string | undefined {
  // ADR-298 Phase 3 — a color token is its CSS variable (the name `codeViewTokenVar` gives a visual one).
  const color = (value: CatalogFillColor): string => {
    if (typeof value === "string") return value;
    const css = reader
      ? codeViewTokenVar(reader, value.tokenId)
      : `var(--${codeViewKebab(value.tokenId.slice(10), "token")})`;
    if (tokens) tokens[css.slice(4, -1)] = value.tokenId;
    return css;
  };
  const parts: string[] = [];
  for (const [index, layer] of fills.entries()) {
    if (!layer.enabled || layer.opacity !== 1 || layer.blendMode !== "normal")
      return undefined;
    if (layer.kind === "color") {
      const css = color(layer.color);
      parts.push(index === 0 ? css : `linear-gradient(${css}, ${css})`);
    }
    else if (layer.kind === "linear-gradient")
      parts.push(
        `linear-gradient(${layer.rotation}deg, ${layer.stops
          .map(
            (stop) =>
              `${color(stop.color)} ${Math.round(stop.position * 10000) / 100}%`,
          )
          .join(", ")})`,
      );
    else if (layer.kind === "image")
      parts.push(
        `url("${layer.url}") center / ${
          layer.mode === "fill"
            ? "cover"
            : layer.mode === "fit"
              ? "contain"
              : "100% 100%"
        } no-repeat`,
      );
    else return undefined;
  }
  return parts.length ? [...parts].reverse().join(", ") : undefined;
}

/** Split CSS text at its top-level commas (not inside parentheses or quotes). */
export function codeViewCssList(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      out.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last) out.push(last);
  return out;
}

/**
 * `codeViewFillsCss`'s inverse: the layers of a `background` (bottom first, ids from `ids` by
 * position, else `fill-<n>`). Undefined = a layer this CSS form does not have.
 */
/** A fill color as the document stores it (`#RRGGBBAA` — `#rgb` · `#rrggbb` opaque); else undefined. */
export function codeViewFillColor(text: string): string | undefined {
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(
    text.trim(),
  )?.[1];
  if (!hex) return undefined;
  const long =
    hex.length === 3 ? [...hex].map((char) => char + char).join("") : hex;
  return `#${long.length === 6 ? `${long}ff` : long}`;
}

export function codeViewFillsOf(
  text: string,
  ids: readonly string[] = [],
  /** ADR-298 Phase 3 — a `var(--…)` color as the token it names (the code view's `tokenOf`). */
  tokenColor?: (text: string) => CatalogFillColor | undefined,
): CatalogFillLayer[] | undefined {
  const fillColor = (part: string): CatalogFillColor | undefined =>
    codeViewFillColor(part) ?? tokenColor?.(part.trim());
  const layers = codeViewCssList(text).reverse();
  const out: CatalogFillLayer[] = [];
  const base = { enabled: true, opacity: 1, blendMode: "normal" as const };
  for (const [index, part] of layers.entries()) {
    const id = ids[index] ?? `fill-${index + 1}`;
    const solid =
      /^linear-gradient\(\s*([^,()]+(?:\([^()]*\))?)\s*,\s*\1\s*\)$/.exec(part);
    if (solid) {
      const color = fillColor(solid[1]!);
      if (!color) return undefined;
      out.push({ ...base, id, kind: "color", color });
      continue;
    }
    const linear = /^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg\s*,(.*)\)$/s.exec(
      part,
    );
    if (linear) {
      const stops = codeViewCssList(linear[2]!).map((stop) => {
        const match = /^(.*?)\s+(-?\d+(?:\.\d+)?)%$/.exec(stop);
        const color = match ? fillColor(match[1]!) : undefined;
        return match && color
          ? { color, position: Number(match[2]) / 100 }
          : undefined;
      });
      if (stops.some((stop) => !stop)) return undefined;
      out.push({
        ...base,
        id,
        kind: "linear-gradient",
        rotation: Number(linear[1]),
        stops: stops as { color: CatalogFillColor; position: number }[],
      });
      continue;
    }
    const image =
      /^url\("((?:[^"\\]|\\.)*)"\)\s+center\s*\/\s*(cover|contain|100% 100%)\s+no-repeat$/.exec(
        part,
      );
    if (image) {
      out.push({
        ...base,
        id,
        kind: "image",
        url: image[1]!,
        mode:
          image[2] === "cover"
            ? "fill"
            : image[2] === "contain"
              ? "fit"
              : "stretch",
      });
      continue;
    }
    // A plain color is the bottom layer only (CSS's background color).
    const color = index === 0 ? fillColor(part) : undefined;
    if (color) {
      out.push({ ...base, id, kind: "color", color });
      continue;
    }
    return undefined;
  }
  return out;
}

/* ── one node's blocks ── */

/** What a node's style writes at one place (its base, a breakpoint, a state). */
export interface CodeViewStyleBlock {
  readonly nodeId: string;
  /** ADR-296 Phase 5 — an instance's position (its `overrides` key — `left-picker/save-button`). */
  readonly path?: string;
  readonly breakpoint: BreakpointName;
  readonly state?: StateName;
  readonly declarations: readonly Declaration[];
  /** A value the CSS cannot hold — the marker comment written in the block. */
  readonly markers: readonly string[];
}

const visualPlace = (key: string) =>
  CODE_VIEW_VISUAL_CSS[key as VisualField] as CssPlace | undefined;
const layoutPlace = (key: string): CssPlace | undefined =>
  CODE_VIEW_LAYOUT_CSS[key as LayoutField]
    ? plain(CODE_VIEW_LAYOUT_CSS[key as LayoutField])
    : undefined;
const sizingPlace = (key: string): CssPlace | undefined =>
  CODE_VIEW_SIZING_CSS[key as SizingField]
    ? px(CODE_VIEW_SIZING_CSS[key as SizingField])
    : undefined;

function fillSizingDeclarations(
  fill: FillSizing | undefined,
  out: Declaration[],
): void {
  for (const axis of ["width", "height"] as const) {
    if (!fill || !(axis in fill)) continue;
    const value = fill[axis];
    out.push({
      property: CODE_VIEW_FILL_SIZING_CSS[axis],
      value: value === null ? "none" : String(value?.factor ?? 1),
    });
  }
}

/** A node's style blocks, base first, then its states, then its breakpoint layers. */
/** What a style is read from: a node, or an instance's patch at one of its positions. */
export type CodeViewStyleSource = Pick<NodeEntry, "id"> &
  Partial<
    Pick<
      NodeEntry,
      | "visual"
      | "layout"
      | "sizing"
      | "fills"
      | "fillSizing"
      | "themeOverride"
      | "visibility"
      | "stateRules"
      | "responsive"
    >
  >;

export function codeViewStyleBlocks(
  reader: Reader,
  node: CodeViewStyleSource,
  tokens: Record<string, string>,
): CodeViewStyleBlock[] {
  const blocks: CodeViewStyleBlock[] = [];
  const base: Declaration[] = [];
  const markers: string[] = [];
  writesOf(reader, "visual", node.visual, visualPlace, tokens, base);
  writesOf(reader, "layout", node.layout, layoutPlace, tokens, base);
  writesOf(reader, "sizing", node.sizing, sizingPlace, tokens, base);
  if (node.fills?.length) {
    const css = codeViewFillsCss(node.fills, reader, tokens);
    if (css) base.push({ property: CODE_VIEW_FILLS_CSS, value: css });
    else markers.push(CODE_VIEW_DESIGN_PANEL_MARKER("fills"));
  }
  fillSizingDeclarations(node.fillSizing, base);
  if (node.themeOverride?.mode)
    base.push({
      property: CODE_VIEW_THEME_MODE_CSS,
      value: node.themeOverride.mode,
    });
  if (node.themeOverride?.tint)
    base.push({
      property: CODE_VIEW_THEME_TINT_CSS,
      value: node.themeOverride.tint,
    });
  const visibility = (breakpoint: BreakpointName, out: Declaration[]) => {
    const value = node.visibility?.[breakpoint];
    if (value === undefined) return;
    // (A layout `display` of the block keeps the name — the visibility takes `--visible`.)
    if (out.some((item) => item.property === "display"))
      out.push({ property: CODE_VIEW_VISIBLE_CSS, value: String(value) });
    else out.push({ property: "display", value: value ? "revert" : "none" });
  };
  visibility("desktop", base);
  if (base.length || markers.length)
    blocks.push({
      nodeId: node.id,
      breakpoint: "desktop",
      declarations: base,
      markers,
    });
  for (const [state, writes] of Object.entries(node.stateRules ?? {})) {
    const declarations: Declaration[] = [];
    writesOf(reader, "visual", writes, visualPlace, tokens, declarations);
    if (declarations.length)
      blocks.push({
        nodeId: node.id,
        breakpoint: "desktop",
        state: state as StateName,
        declarations,
        markers: [],
      });
  }
  for (const breakpoint of ["tablet", "mobile"] as const) {
    const layer: NodeResponsiveLayer | undefined =
      node.responsive?.[breakpoint];
    const declarations: Declaration[] = [];
    writesOf(
      reader,
      "visual",
      layer?.visual,
      visualPlace,
      tokens,
      declarations,
    );
    writesOf(
      reader,
      "layout",
      layer?.layout,
      layoutPlace,
      tokens,
      declarations,
    );
    writesOf(
      reader,
      "sizing",
      layer?.sizing,
      sizingPlace,
      tokens,
      declarations,
    );
    fillSizingDeclarations(layer?.fillSizing, declarations);
    visibility(breakpoint, declarations);
    if (declarations.length)
      blocks.push({ nodeId: node.id, breakpoint, declarations, markers: [] });
  }
  return blocks;
}

/** Whether a node has a style (its class is written on its element). */
export function codeViewNodeHasStyle(reader: Reader, node: NodeEntry): boolean {
  return (
    codeViewStyleBlocks(reader, node, {}).length > 0 ||
    codeViewPositionBlocks(reader, node, {}).length > 0
  );
}

/** ADR-296 Phase 5 — an instance's styles at its positions (descendant patches), by their paths. */
export function codeViewPositionBlocks(
  reader: Reader,
  node: NodeEntry,
  tokens: Record<string, string>,
): CodeViewStyleBlock[] {
  const out: CodeViewStyleBlock[] = [];
  for (const override of node.descendantOverrides ?? []) {
    if (override.kind === "replace") continue;
    const path = codeViewAddressKey(reader, override.address);
    if (!path) continue;
    for (const block of codeViewStyleBlocks(
      reader,
      { ...override, id: node.id },
      tokens,
    ))
      out.push({ ...block, path });
  }
  return out;
}

/** A block's selector (`.hero-title` · `.hero-title[data-hovered]`). */
export const codeViewBlockSelector = (
  className: string,
  state?: StateName,
  path?: string,
) =>
  `.${className}${
    path
      ? ` ${path
          .split("/")
          .map((segment) => `.${segment}`)
          .join(" ")}`
      : ""
  }${state ? CODE_VIEW_STATE_SELECTORS[state] : ""}`;

/** The page's style file path (`src/pages/<Page>.css`). */
export const codeViewPageStylePath = (pageName: string) =>
  `src/pages/${pageName}.css`;

/** Generate `src/pages/<Page>.css`. */
export function generatePageStyleFile(input: {
  reader: CodeViewReader;
  pageId: string;
}): CodeViewResult {
  const reader = input.reader as unknown as Reader;
  const classes = codeViewNodeClasses(reader, input.pageId);
  const tokens: Record<string, string> = {};
  const nodes = codeViewPageNodes(reader, input.pageId);
  const blocks = nodes.flatMap((node) => [
    ...codeViewStyleBlocks(reader, node, tokens),
    ...codeViewPositionBlocks(reader, node, tokens),
  ]);
  const out = new CodeWriter();
  const writeBlock = (block: CodeViewStyleBlock) => {
    const className = classes.get(block.nodeId)!;
    out.start();
    const from = out.length;
    out
      .write(`${codeViewBlockSelector(className, block.state, block.path)} {`)
      .end()
      .in();
    for (const marker of block.markers) out.line(marker);
    for (const declaration of block.declarations)
      out.line(`${declaration.property}: ${declaration.value};`);
    out.out().start().write("}");
    out.anchor(from, {
      kind: "cssRule",
      nodeId: block.nodeId,
      breakpoint: block.breakpoint,
      ...(block.state ? { state: block.state } : {}),
      ...(block.path ? { path: block.path } : {}),
    });
    out.end();
  };
  const desktop = blocks.filter((block) => block.breakpoint === "desktop");
  desktop.forEach((block, index) => {
    if (index) out.line();
    writeBlock(block);
  });
  for (const breakpoint of ["tablet", "mobile"] as const) {
    const layer = blocks.filter((block) => block.breakpoint === breakpoint);
    if (!layer.length) continue;
    if (out.length) out.line();
    out.line(`@media ${CODE_VIEW_BREAKPOINT_MEDIA[breakpoint]} {`).in();
    layer.forEach((block, index) => {
      if (index) out.line();
      writeBlock(block);
    });
    out.out().line("}");
  }
  const done = out.done();
  return {
    ...done,
    symbols: {
      variables: {},
      fields: {},
      tokens,
      classes: Object.fromEntries(
        [...classes].map(([nodeId, className]) => [className, nodeId]),
      ),
    },
  };
}
