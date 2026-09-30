import type {
  AuthoredValue,
  LayoutField,
  SizingField,
  VisualField,
  WriteValue,
} from "../../../../../packages/shared/src/catalog/document/types";

/**
 * ADR-248 Phase 4e-4d: the Styles panel's CSS keys ↔ the catalog node's typed fields
 * (`visual` · `layout` · `sizing`). The old panel wrote CSS text into `props.style`; the catalog
 * document keeps each key in its typed field and unit — lengths the typed contract takes as numbers
 * become px numbers, `line-height` is a ratio to the font size, `gap` is the authored `visual.gap`
 * (the Canvas spacing handle writes the same field), a width/height in px is `sizing` and any other
 * CSS length text (`100%`, `fit-content`) is `visual`. The same precedent converted the reusable
 * origins' style (`reusableOriginConverter`, Phase 3).
 */

export interface CatalogStyleFieldWrites {
  visual?: Partial<Record<VisualField, WriteValue<AuthoredValue>>>;
  layout?: Partial<Record<LayoutField, WriteValue<string>>>;
  sizing?: Partial<Record<SizingField, WriteValue<number | null>>>;
}

/** The authored typed fields a CSS view reads (one node, one breakpoint layer merged). */
export interface CatalogStyleFields {
  visual: Readonly<Partial<Record<VisualField, unknown>>>;
  layout: Readonly<Partial<Record<LayoutField, unknown>>>;
  sizing: Readonly<Partial<Record<SizingField, unknown>>>;
}

const REMOVE = { kind: "remove" } as const;
const set = <T>(value: T): WriteValue<T> => ({ kind: "set", value });

/** Visual fields whose CSS key and catalog key are the same and whose value is CSS text. */
const VISUAL_TEXT = new Set<string>([
  "color",
  "backgroundColor",
  "borderColor",
  "borderStyle",
  "overflow",
  "fontFamily",
  "fontStyle",
  "textAlign",
  "textTransform",
  "textDecoration",
  "whiteSpace",
  "wordBreak",
  "boxShadow",
  "filter",
  "transform",
  "backgroundImage",
  "backgroundSize",
]);
/** Visual fields whose value is a px (or unitless) number; the CSS key is the catalog key. */
const VISUAL_NUMBER = new Set<string>([
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "zIndex",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
]);
/** CSS radius keys → catalog radius fields (px numbers). */
const RADIUS: Readonly<Record<string, VisualField>> = {
  borderRadius: "radius",
  borderTopLeftRadius: "radiusTopLeft",
  borderTopRightRadius: "radiusTopRight",
  borderBottomRightRadius: "radiusBottomRight",
  borderBottomLeftRadius: "radiusBottomLeft",
};
/** Layout fields: CSS text, same key; lengths given as numbers become `Npx`. */
const LAYOUT_TEXT = new Set<string>([
  "display",
  "flexDirection",
  "alignItems",
  "justifyContent",
  "flexWrap",
  "position",
  "alignSelf",
  "justifySelf",
  "verticalAlign",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "rowGap",
  "columnGap",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridTemplateAreas",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
]);
/** CSS inset keys → catalog inset fields (the stylesheet placement of a positioned box). */
const INSET: Readonly<Record<string, LayoutField>> = {
  left: "insetLeft",
  top: "insetTop",
  right: "insetRight",
  bottom: "insetBottom",
};
const SIZE_KEYS = new Set(["width", "height"]);
const MIN_KEYS = new Set(["minWidth", "minHeight"]);
const MAX_KEYS = new Set(["maxWidth", "maxHeight"]);
const LAYOUT_LENGTH = new Set([
  "rowGap",
  "columnGap",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "flexBasis",
]);

/** A px length (`12`, `"12"`, `"12px"`) as a number; undefined for other text. */
export function cssPx(value: string | number): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  const match = /^(-?\d+(?:\.\d+)?)(px)?$/.exec(value.trim());
  return match ? Number(match[1]) : undefined;
}
const cssText = (value: string | number) =>
  typeof value === "number" ? String(value) : value.trim();
const lengthText = (value: string | number) => {
  const text = cssText(value);
  return /^-?\d+(?:\.\d+)?$/.test(text) && text !== "0" ? `${text}px` : text;
};

/** The CSS keys the table maps (the Styles panel's longhand keys and their shorthands). */
export function catalogStyleKeySupported(key: string): boolean {
  return (
    VISUAL_TEXT.has(key) ||
    VISUAL_NUMBER.has(key) ||
    key in RADIUS ||
    LAYOUT_TEXT.has(key) ||
    key in INSET ||
    SIZE_KEYS.has(key) ||
    MIN_KEYS.has(key) ||
    MAX_KEYS.has(key) ||
    key === "opacity" ||
    key === "lineHeight" ||
    key === "aspectRatio" ||
    key === "padding" ||
    key === "margin"
  );
}

export class CatalogStyleValueError extends Error {
  constructor(
    readonly key: string,
    readonly value: string | number,
  ) {
    super(`STYLE_VALUE_UNSUPPORTED: ${key} = ${String(value)}`);
    this.name = "CatalogStyleValueError";
  }
}

const merge = (
  into: CatalogStyleFieldWrites,
  from: CatalogStyleFieldWrites,
): CatalogStyleFieldWrites => ({
  visual: { ...into.visual, ...from.visual },
  layout: { ...into.layout, ...from.layout },
  sizing: { ...into.sizing, ...from.sizing },
});

/**
 * One CSS key's edit as typed field writes. An empty value clears every field the key maps to
 * (the old panel's `""` = remove). `fontSize` is the node's effective font size, for a px
 * `line-height`. Throws `CatalogStyleValueError` for a value the typed field cannot hold.
 */
export function catalogStyleWrites(
  key: string,
  raw: string | number,
  context: { fontSize?: number } = {},
): CatalogStyleFieldWrites {
  const empty = typeof raw === "string" && raw.trim() === "";
  const fail = () => {
    throw new CatalogStyleValueError(key, raw);
  };
  if (key === "padding" || key === "margin") {
    const parts = empty ? [""] : cssText(raw).split(/\s+/);
    const [top, right = top, bottom = top, left = right] = parts;
    return (["Top", "Right", "Bottom", "Left"] as const)
      .map((side, index) =>
        catalogStyleWrites(
          `${key}${side}`,
          [top, right, bottom, left][index],
          context,
        ),
      )
      .reduce(merge, {});
  }
  if (VISUAL_TEXT.has(key))
    return { visual: { [key]: empty ? REMOVE : set(cssText(raw)) } };
  if (VISUAL_NUMBER.has(key) || key in RADIUS) {
    const field = (RADIUS[key] ?? key) as VisualField;
    if (empty) return { visual: { [field]: REMOVE } };
    const weight =
      key === "fontWeight"
        ? ({ normal: 400, bold: 700 } as Record<string, number>)[cssText(raw)]
        : undefined;
    const value = weight ?? cssPx(raw);
    return value === undefined ? fail() : { visual: { [field]: set(value) } };
  }
  if (key === "opacity") {
    if (empty) return { visual: { opacity: REMOVE } };
    const text = cssText(raw);
    const value = text.endsWith("%")
      ? Number(text.slice(0, -1)) / 100
      : Number(text);
    return Number.isFinite(value) && value >= 0 && value <= 1
      ? { visual: { opacity: set(value) } }
      : fail();
  }
  if (key === "lineHeight") {
    if (empty || cssText(raw) === "normal")
      return { visual: { lineHeight: REMOVE } };
    const text = cssText(raw);
    // Unitless = the ratio itself; px = a ratio to the node's own font size.
    const ratio = /^\d+(?:\.\d+)?$/.test(text)
      ? Number(text)
      : text.endsWith("px") && context.fontSize
        ? Number(text.slice(0, -2)) / context.fontSize
        : undefined;
    return ratio && ratio > 0 ? { visual: { lineHeight: set(ratio) } } : fail();
  }
  if (key === "aspectRatio") {
    if (empty || cssText(raw) === "auto")
      return { visual: { aspectRatio: REMOVE } };
    const text = cssText(raw);
    const value = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : text;
    return { visual: { aspectRatio: set(value) } };
  }
  if (key in INSET)
    return {
      layout: { [INSET[key]]: empty ? REMOVE : set(lengthText(raw)) },
    };
  if (LAYOUT_TEXT.has(key))
    return {
      layout: {
        [key]: empty
          ? REMOVE
          : set(LAYOUT_LENGTH.has(key) ? lengthText(raw) : cssText(raw)),
      },
    };
  if (SIZE_KEYS.has(key)) {
    const field = key as "width" | "height";
    // px = the node's fixed size; other CSS text (`100%`, `fit-content`) = its visual length;
    // `auto` / empty = neither (the definition's own sizing shows).
    if (empty || cssText(raw) === "auto")
      return { visual: { [field]: REMOVE }, sizing: { [field]: REMOVE } };
    const px = cssPx(raw);
    return px !== undefined
      ? { visual: { [field]: REMOVE }, sizing: { [field]: set(px) } }
      : { visual: { [field]: set(cssText(raw)) }, sizing: { [field]: REMOVE } };
  }
  if (MIN_KEYS.has(key)) {
    const field = key as "minWidth" | "minHeight";
    if (empty || cssText(raw) === "auto" || cssText(raw) === "0")
      return { sizing: { [field]: REMOVE } };
    const px = cssPx(raw);
    return px !== undefined && px >= 0
      ? { sizing: { [field]: set(px) } }
      : fail();
  }
  if (MAX_KEYS.has(key)) {
    const field = key as "maxWidth" | "maxHeight";
    if (empty || cssText(raw) === "none")
      return { sizing: { [field]: REMOVE }, layout: { [field]: REMOVE } };
    const px = cssPx(raw);
    return px !== undefined
      ? { sizing: { [field]: set(px) }, layout: { [field]: REMOVE } }
      : { layout: { [field]: set(cssText(raw)) }, sizing: { [field]: REMOVE } };
  }
  return fail();
}

/** Several CSS keys' edits merged (later keys win on the same field). */
export function catalogStyleWritesOf(
  styles: Readonly<Record<string, string | number>>,
  context: { fontSize?: number } = {},
): CatalogStyleFieldWrites {
  // A font size edited in the same batch is the one a px line height relates to.
  const fontSize = cssPx(styles.fontSize ?? "") ?? context.fontSize;
  return Object.entries(styles)
    .map(([key, value]) => catalogStyleWrites(key, value, { fontSize }))
    .reduce(merge, {});
}

/** Authored write maps (`{kind:"set", value}` per key) → the set values (removes and masks drop). */
export function catalogAuthoredValues(
  writes: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, write] of Object.entries(writes ?? {}))
    if (
      write &&
      typeof write === "object" &&
      (write as { kind?: string }).kind === "set"
    )
      values[key] = (write as { value: unknown }).value;
  return values;
}

const px = (value: unknown) =>
  typeof value === "number"
    ? `${value}px`
    : typeof value === "string"
      ? value
      : undefined;

/**
 * The CSS view of a node's authored typed fields (what the old panel read from `props.style`):
 * lengths as px text, `line-height` in px when the font size is known, `gap` from `visual.gap`
 * unless a row/column gap is authored. Token uses and structured values are left out.
 */
export function catalogStyleView(
  fields: CatalogStyleFields,
  context: { fontSize?: number } = {},
): Record<string, string | number> {
  const style: Record<string, string | number> = {};
  const { visual, layout, sizing } = fields;
  for (const [key, value] of Object.entries(visual)) {
    if (value === undefined || (typeof value === "object" && value !== null))
      continue;
    if (VISUAL_TEXT.has(key) && typeof value === "string") style[key] = value;
    else if (VISUAL_NUMBER.has(key) && typeof value === "number")
      style[key] =
        key === "fontWeight" || key === "zIndex" ? value : `${value}px`;
  }
  for (const [cssKey, field] of Object.entries(RADIUS)) {
    const value = visual[field];
    if (typeof value === "number") style[cssKey] = `${value}px`;
  }
  if (typeof visual.opacity === "number") style.opacity = visual.opacity;
  if (typeof visual.lineHeight === "number") {
    const fontSize =
      typeof visual.fontSize === "number" ? visual.fontSize : context.fontSize;
    style.lineHeight = fontSize
      ? `${Math.round(visual.lineHeight * fontSize * 100) / 100}px`
      : visual.lineHeight;
  }
  if (visual.aspectRatio !== undefined) {
    const ratio = visual.aspectRatio;
    if (typeof ratio === "number" || typeof ratio === "string")
      style.aspectRatio = String(ratio);
  }
  for (const [key, value] of Object.entries(layout)) {
    if (typeof value !== "string") continue;
    const inset = Object.entries(INSET).find(([, field]) => field === key)?.[0];
    if (inset) style[inset] = value;
    else if (LAYOUT_TEXT.has(key) || MAX_KEYS.has(key)) style[key] = value;
  }
  for (const key of ["width", "height"] as const) {
    const value = px(sizing[key]) ?? px(visual[key]);
    if (value !== undefined) style[key] = value;
  }
  for (const key of [
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
  ] as const) {
    const value = px(sizing[key]);
    if (value !== undefined) style[key] = value;
  }
  return style;
}
