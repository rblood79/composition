import {
  CATALOG_FORMAT,
  CATALOG_SCHEMA_VERSION,
  LIBRARY_CONTRACT_VERSION,
  type CatalogDocument,
  type CatalogEntry,
  CATALOG_PRESENT_WHEN,
  CATALOG_STATE_KEYS,
  CATALOG_TOAST_PLACEMENTS,
  type CatalogStateKey,
  type CatalogToastPlacement,
  type CatalogPresentWhen,
  DISPLAY_STATE_NAMES,
  type DisplayStateName,
  type EntryKind,
  type InstanceAddress,
  type LayoutField,
  type LibraryDefinition,
  type LibraryTemplateNode,
  type LibraryToken,
  type TokenType,
  type ValueType,
  type VisualField,
} from "./types";

export class CatalogValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CatalogValidationError";
  }
}

const entryKinds = new Set<EntryKind>([
  "project",
  "page",
  "definition",
  "definitionOverride",
  "node",
  "theme",
  "token",
  "stateVariable",
  "interaction",
  "asset",
]);
const visualFields = new Set<VisualField>([
  "color",
  "backgroundColor",
  "borderColor",
  "fill",
  "opacity",
  "fontSize",
  "lineHeight",
  "fontWeight",
  "width",
  "height",
  "overflow",
  "radius",
  "gap",
  "padding",
  "borderWidth",
  "borderStyle",
  "fillAlpha",
  "minHeight",
  "thumbSize",
  "indentPerLevel",
  "iconGap",
  "iconSize",
  "paddingX",
  "paddingY",
  "minWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontFamily",
  "fontStyle",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecoration",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "textOverflow",
  "boxShadow",
  "filter",
  "transform",
  "zIndex",
  "aspectRatio",
  "backgroundImage",
  "backgroundSize",
  "radiusTopLeft",
  "radiusTopRight",
  "radiusBottomRight",
  "radiusBottomLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
]);
/** Finite CSS keyword sets of the Phase 4a text keys (the Style panel's choices). */
const visualChoices: Readonly<Record<string, readonly string[]>> = {
  fontStyle: ["normal", "italic", "oblique"],
  textAlign: ["left", "center", "right", "justify", "start", "end"],
  textTransform: ["none", "uppercase", "lowercase", "capitalize"],
  textDecoration: ["none", "underline", "line-through", "overline"],
  whiteSpace: [
    "normal",
    "nowrap",
    "pre",
    "pre-wrap",
    "pre-line",
    "break-spaces",
  ],
  wordBreak: ["normal", "break-all", "keep-all", "break-word"],
  overflowWrap: ["normal", "break-word", "anywhere"],
  textOverflow: ["clip", "ellipsis"],
};
/** Phase 4a keys whose value is CSS text (no finite typed form). */
const visualCssTextKeys = new Set([
  "fontFamily",
  "boxShadow",
  "filter",
  "transform",
  "backgroundImage",
  "backgroundSize",
]);
/** Phase 4a keys whose value is a number (px or unitless). */
const visualNumberKeys = new Set([
  "letterSpacing",
  "zIndex",
  "radiusTopLeft",
  "radiusTopRight",
  "radiusBottomRight",
  "radiusBottomLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
]);
const keyword =
  (...choices: string[]) =>
  (value: string): boolean =>
    choices.includes(value);
const cssLength = (value: string, negative = false): boolean =>
  (negative ? /^-?\d+(?:\.\d+)?px$/ : /^\d+(?:\.\d+)?px$/).test(value) ||
  value === "0";
const flexFactor = (value: string): boolean => /^\d+(?:\.\d+)?$/.test(value);
const gridLine = (value: string): boolean =>
  value === "auto" || /^-?\d+$/.test(value) || /^span \d+$/.test(value);
/** Track list tokens: lengths, `fr`, `%`, keywords and `repeat()`/`minmax()` groups. */
const gridTracks = (value: string): boolean =>
  /^[\w.%(), -]+$/.test(value) && value.trim() !== "";
const alignKeywords = [
  "flex-start",
  "flex-end",
  "center",
  "stretch",
  "baseline",
  "start",
  "end",
];
const layoutValueChoices: Readonly<
  Record<LayoutField, (value: string) => boolean>
> = {
  display: keyword(
    "block",
    "flex",
    "inline-flex",
    "grid",
    "inline-block",
    // ADR-256 Phase 6g: no box of its own (RAC Autocomplete — engine CSS-DISPLAY-3 §2.5).
    "contents",
    "none",
  ),
  flexDirection: keyword("row", "column", "row-reverse", "column-reverse"),
  alignItems: keyword(...alignKeywords),
  justifyContent: keyword(
    "flex-start",
    "flex-end",
    "center",
    "space-between",
    "space-around",
    "space-evenly",
    "start",
    "end",
  ),
  flexWrap: keyword("nowrap", "wrap", "wrap-reverse"),
  position: keyword("static", "relative", "absolute"),
  insetLeft: (value) =>
    cssLength(value, true) || /^-?\d+(?:\.\d+)?%$/.test(value),
  insetTop: (value) =>
    cssLength(value, true) || /^-?\d+(?:\.\d+)?%$/.test(value),
  insetRight: (value) =>
    cssLength(value, true) || /^-?\d+(?:\.\d+)?%$/.test(value),
  insetBottom: (value) =>
    cssLength(value, true) || /^-?\d+(?:\.\d+)?%$/.test(value),
  flexGrow: flexFactor,
  flexShrink: flexFactor,
  flexBasis: (value) =>
    value === "auto" || cssLength(value) || /^\d+(?:\.\d+)?%$/.test(value),
  alignSelf: keyword("auto", ...alignKeywords),
  justifySelf: keyword("auto", ...alignKeywords),
  gridColumnStart: gridLine,
  gridColumnEnd: gridLine,
  gridRowStart: gridLine,
  gridRowEnd: gridLine,
  rowGap: (value) => cssLength(value),
  columnGap: (value) => cssLength(value),
  marginTop: (value) => value === "auto" || cssLength(value, true),
  marginRight: (value) => value === "auto" || cssLength(value, true),
  marginBottom: (value) => value === "auto" || cssLength(value, true),
  marginLeft: (value) => value === "auto" || cssLength(value, true),
  verticalAlign: keyword("baseline", "top", "middle", "bottom"),
  gridTemplateColumns: gridTracks,
  gridTemplateRows: gridTracks,
  gridTemplateAreas: (value) => /^("[\w. ]+"\s*)+$/.test(value.trim()),
  order: (value) => /^-?\d+$/.test(value),
  maxWidth: (value) =>
    value === "none" ||
    cssLength(value) ||
    /^\d+(?:\.\d+)?(?:%|ch)$/.test(value),
  maxHeight: (value) =>
    value === "none" || cssLength(value) || /^\d+(?:\.\d+)?%$/.test(value),
};
const sizingFields = new Set([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
]);
const stateNames = new Set([
  "hover",
  "pressed",
  "selected",
  "selectedHover",
  "selectedPressed",
  "disabled",
  "focusVisible",
]);
const valueTypes = new Set<ValueType>([
  "string",
  "number",
  "boolean",
  "string[]",
  "items",
  "slot",
]);
/** State variables hold scalars only. */
const scalarValueTypes = new Set<ValueType>(["string", "number", "boolean"]);
const tokenTypes = new Set<TokenType>([
  "color",
  "length",
  "number",
  "string",
  "boolean",
]);
const presetValues = {
  tint: new Set([
    "red",
    "orange",
    "yellow",
    "green",
    "turquoise",
    "cyan",
    "blue",
    "indigo",
    "purple",
    "pink",
  ]),
  neutral: new Set(["slate", "gray", "zinc", "neutral", "stone"]),
  radius: new Set(["none", "sm", "md", "lg", "xl"]),
  darkMode: new Set(["light", "dark", "system"]),
} as const;
const breakpointNames = new Set(["desktop", "tablet", "mobile"]);
const placementFields = new Set([
  "position",
  "left",
  "top",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
]);
const idPattern =
  /^(project:(project|page|definition|definitionOverride|node|theme|token|stateVariable|interaction|asset):[A-Za-z0-9][A-Za-z0-9_-]*|lib:(definition|template|token):[A-Za-z0-9][A-Za-z0-9_-]*|data:(collection|field|endpoint|variable):[A-Za-z0-9][A-Za-z0-9_-]*)$/;

function invalid(code: string, at: string): never {
  throw new CatalogValidationError(code, at);
}
function object(value: unknown, at: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalid("OBJECT_REQUIRED", at);
  return value as Record<string, unknown>;
}
function exact(
  value: Record<string, unknown>,
  allowed: readonly string[],
  at: string,
): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) invalid("UNKNOWN_FIELD", `${at}.${key}`);
}
function string(value: unknown, at: string): string {
  if (typeof value !== "string" || value.length === 0)
    invalid("STRING_REQUIRED", at);
  return value;
}
function scalar(value: unknown, at: string): void {
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value === "string" || typeof value === "boolean") return;
  invalid("SCALAR_REQUIRED", at);
}
function id(value: unknown, prefix: string, at: string): string {
  const text = string(value, at);
  if (!idPattern.test(text) || !text.startsWith(prefix))
    invalid("INVALID_ID", at);
  return text;
}
function list(value: unknown, prefix: string, at: string): string[] {
  if (!Array.isArray(value)) invalid("ARRAY_REQUIRED", at);
  const ids = value.map((item, index) => id(item, prefix, `${at}[${index}]`));
  if (ids.length !== new Set(ids).size) invalid("DUPLICATE_ID", at);
  return ids;
}
/**
 * A structured prop value: a list of strings, or a list of records whose cells are scalars; a
 * section record may hold one level of flat records (ADR-099 sections).
 */
function structuredValue(value: unknown[], at: string, nested = false): void {
  if (!nested && value.every((item) => typeof item === "string")) return;
  value.forEach((item, index) => {
    const row = object(item, `${at}[${index}]`);
    for (const [key, cell] of Object.entries(row)) {
      if (!key) invalid("UNKNOWN_FIELD", `${at}[${index}]`);
      if (Array.isArray(cell) && !nested)
        structuredValue(cell, `${at}[${index}].${key}`, true);
      else scalar(cell, `${at}[${index}].${key}`);
    }
  });
}
function authoredValue(
  value: unknown,
  at: string,
  allowNull = false,
  allowStructured = false,
): void {
  if (value === null && allowNull) return;
  if (Array.isArray(value)) {
    if (!allowStructured) invalid("SCALAR_REQUIRED", at);
    return structuredValue(value, at);
  }
  if (typeof value !== "object" || value === null) return scalar(value, at);
  const ref = object(value, at);
  exact(ref, ["kind", "tokenId"], at);
  if (ref.kind !== "token") invalid("UNKNOWN_VALUE_KIND", at);
  id(ref.tokenId, "", `${at}.tokenId`);
  if (
    !(ref.tokenId as string).startsWith("lib:token:") &&
    !(ref.tokenId as string).startsWith("project:token:")
  )
    invalid("TOKEN_ID_REQUIRED", at);
}
/** `50%`, `10vw`, `2rem` … — a non-negative CSS length the layout resolves (not px). */
const relativeMinLength = (value: unknown): boolean =>
  typeof value === "string" &&
  /^\d+(?:\.\d+)?(?:%|vw|vh|vmin|vmax|dvw|dvh|svw|svh|lvw|lvh|em|rem|ch)$/.test(
    value,
  );

function visualLiteral(key: string, value: unknown, at: string): void {
  if (value && typeof value === "object") return; // typed token reference is checked separately
  if (
    [
      "color",
      "backgroundColor",
      "borderColor",
      "fill",
      "overflow",
      "borderStyle",
    ].includes(key) &&
    typeof value !== "string"
  )
    invalid("VISUAL_VALUE_TYPE", at);
  if (
    [
      "opacity",
      "fillAlpha",
      "thumbSize",
      "indentPerLevel",
      "iconGap",
      "iconSize",
      "lineHeight",
    ].includes(key) &&
    typeof value !== "number"
  )
    invalid("VISUAL_VALUE_TYPE", at);
  if (
    (key === "opacity" || key === "fillAlpha") &&
    typeof value === "number" &&
    (value < 0 || value > 1)
  )
    invalid("VISUAL_VALUE_RANGE", at);
  if (
    key === "overflow" &&
    !["visible", "hidden", "clip", "auto", "scroll"].includes(value as string)
  )
    invalid("INVALID_OVERFLOW", at);
  if (
    key === "borderStyle" &&
    !["solid", "dashed", "dotted"].includes(value as string)
  )
    invalid("INVALID_BORDER_STYLE", at);
  if (
    [
      // A node's minimum also takes a relative or viewport CSS length (the Styles Min W/H input).
      ...(value === "auto" || relativeMinLength(value)
        ? []
        : ["minHeight", "minWidth"]),
      "paddingX",
      "paddingY",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ].includes(key) &&
    (typeof value !== "number" || value < 0)
  )
    invalid("VISUAL_VALUE_RANGE", at);
  if (
    (key === "lineHeight" || key === "iconSize") &&
    (typeof value !== "number" || value <= 0)
  )
    invalid("VISUAL_VALUE_RANGE", at);
  if (visualChoices[key]) {
    if (typeof value !== "string") invalid("VISUAL_VALUE_TYPE", at);
    if (!visualChoices[key].includes(value)) invalid("VISUAL_VALUE_CHOICE", at);
  }
  if (
    visualCssTextKeys.has(key) &&
    (typeof value !== "string" || !value.trim())
  )
    invalid("VISUAL_VALUE_TYPE", at);
  if (visualNumberKeys.has(key) && typeof value !== "number")
    invalid("VISUAL_VALUE_TYPE", at);
  if (
    (key.startsWith("radius") || /^border[A-Z][a-z]+Width$/.test(key)) &&
    typeof value === "number" &&
    value < 0
  )
    invalid("VISUAL_VALUE_RANGE", at);
  if (
    key === "aspectRatio" &&
    !(
      (typeof value === "number" && value > 0) ||
      (typeof value === "string" &&
        /^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$|^auto$/.test(value))
    )
  )
    invalid("VISUAL_VALUE_RANGE", at);
}
function values(
  value: unknown,
  at: string,
  allowed?: ReadonlySet<string>,
): void {
  for (const [key, item] of Object.entries(object(value, at))) {
    if (!key || (allowed && !allowed.has(key)))
      invalid("UNKNOWN_FIELD", `${at}.${key}`);
    // Unrestricted keys are props/defaults: they may carry structured values.
    authoredValue(item, `${at}.${key}`, false, allowed === undefined);
    if (allowed === visualFields) visualLiteral(key, item, `${at}.${key}`);
  }
}
function writes(
  value: unknown,
  at: string,
  allowed?: ReadonlySet<string>,
  sizing = false,
): void {
  for (const [key, raw] of Object.entries(object(value, at))) {
    if (!key || (allowed && !allowed.has(key)))
      invalid("UNKNOWN_FIELD", `${at}.${key}`);
    const write = object(raw, `${at}.${key}`);
    if (write.kind === "set") {
      exact(write, ["kind", "value"], `${at}.${key}`);
      if (sizing) {
        if (
          write.value !== null &&
          (typeof write.value !== "number" || !Number.isFinite(write.value))
        )
          invalid("SIZING_VALUE_REQUIRED", `${at}.${key}`);
      } else {
        authoredValue(
          write.value,
          `${at}.${key}.value`,
          false,
          allowed === undefined,
        );
        if (allowed === visualFields)
          visualLiteral(key, write.value, `${at}.${key}.value`);
      }
    } else if (write.kind === "remove") {
      invalid("WRITE_REMOVE_NOT_DURABLE", `${at}.${key}`);
    } else if (write.kind === "mask") {
      exact(write, ["kind"], `${at}.${key}`);
      if (sizing && write.kind === "mask")
        invalid("SIZING_MASK_FORBIDDEN", `${at}.${key}`);
    } else invalid("UNKNOWN_WRITE_KIND", `${at}.${key}`);
  }
}
function stateRules(value: unknown, at: string): void {
  for (const [key, rule] of Object.entries(object(value, at))) {
    if (!stateNames.has(key)) invalid("UNKNOWN_STATE", `${at}.${key}`);
    writes(rule, `${at}.${key}`, visualFields);
  }
}
function layoutValues(value: unknown, at: string): void {
  for (const [key, item] of Object.entries(object(value, at))) {
    const accepts = layoutValueChoices[key as LayoutField];
    if (!accepts) invalid("UNKNOWN_FIELD", `${at}.${key}`);
    if (typeof item !== "string" || !accepts(item))
      invalid("INVALID_LAYOUT_VALUE", `${at}.${key}`);
  }
}
/** Node-authored layout writes: each `set` value is checked like a rule layout value. */
function layoutWrites(value: unknown, at: string): void {
  for (const [key, raw] of Object.entries(object(value, at))) {
    const accepts = layoutValueChoices[key as LayoutField];
    if (!accepts) invalid("UNKNOWN_FIELD", `${at}.${key}`);
    const write = object(raw, `${at}.${key}`);
    if (write.kind === "set") {
      exact(write, ["kind", "value"], `${at}.${key}`);
      if (typeof write.value !== "string" || !accepts(write.value))
        invalid("INVALID_LAYOUT_VALUE", `${at}.${key}`);
    } else if (write.kind === "mask") exact(write, ["kind"], `${at}.${key}`);
    else if (write.kind === "remove")
      invalid("WRITE_REMOVE_NOT_DURABLE", `${at}.${key}`);
    else invalid("UNKNOWN_WRITE_KIND", `${at}.${key}`);
  }
}
const unit = (value: unknown): boolean =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;
const fillColor = (value: unknown): boolean =>
  typeof value === "string" && /^#[0-9a-fA-F]{8}$/.test(value);
const fillBlendModes = new Set([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
]);
function point(value: unknown, at: string): void {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every((axis) => typeof axis === "number" && Number.isFinite(axis))
  )
    invalid("FILL_POINT", at);
}
function fillLayers(value: unknown, at: string): void {
  if (!Array.isArray(value)) invalid("ARRAY_REQUIRED", at);
  const ids = new Set<string>();
  value.forEach((raw, index) => {
    const layerAt = `${at}[${index}]`;
    const layer = object(raw, layerAt);
    const base = ["kind", "id", "enabled", "opacity", "blendMode"];
    const stops = () => {
      if (!Array.isArray(layer.stops) || layer.stops.length < 2)
        invalid("FILL_STOPS", `${layerAt}.stops`);
      for (const [stopIndex, rawStop] of layer.stops.entries()) {
        const stop = object(rawStop, `${layerAt}.stops[${stopIndex}]`);
        exact(stop, ["color", "position"], `${layerAt}.stops[${stopIndex}]`);
        if (!fillColor(stop.color) || !unit(stop.position))
          invalid("FILL_STOP_VALUE", `${layerAt}.stops[${stopIndex}]`);
      }
    };
    const center = () => {
      const c = object(layer.center, `${layerAt}.center`);
      exact(c, ["x", "y"], `${layerAt}.center`);
      if (!unit(c.x) || !unit(c.y)) invalid("FILL_CENTER", `${layerAt}.center`);
    };
    const rotation = () => {
      if (
        typeof layer.rotation !== "number" ||
        !Number.isFinite(layer.rotation)
      )
        invalid("FILL_ROTATION", `${layerAt}.rotation`);
    };
    switch (layer.kind) {
      case "color":
        exact(layer, [...base, "color"], layerAt);
        if (!fillColor(layer.color)) invalid("FILL_COLOR", `${layerAt}.color`);
        break;
      case "linear-gradient":
        exact(layer, [...base, "stops", "rotation"], layerAt);
        stops();
        rotation();
        break;
      case "radial-gradient": {
        exact(layer, [...base, "stops", "center", "radius"], layerAt);
        stops();
        center();
        const radius = object(layer.radius, `${layerAt}.radius`);
        exact(radius, ["width", "height"], `${layerAt}.radius`);
        if (
          typeof radius.width !== "number" ||
          typeof radius.height !== "number" ||
          radius.width < 0 ||
          radius.height < 0
        )
          invalid("FILL_RADIUS", `${layerAt}.radius`);
        break;
      }
      case "angular-gradient":
        exact(layer, [...base, "stops", "center", "rotation"], layerAt);
        stops();
        center();
        rotation();
        break;
      case "image":
        exact(layer, [...base, "url", "mode"], layerAt);
        string(layer.url, `${layerAt}.url`);
        if (!["stretch", "fill", "fit"].includes(layer.mode as string))
          invalid("FILL_IMAGE_MODE", `${layerAt}.mode`);
        break;
      case "mesh-gradient": {
        exact(layer, [...base, "rows", "columns", "points"], layerAt);
        for (const axis of ["rows", "columns"])
          if (!Number.isInteger(layer[axis]) || (layer[axis] as number) < 1)
            invalid("FILL_MESH_GRID", `${layerAt}.${axis}`);
        if (!Array.isArray(layer.points))
          invalid("ARRAY_REQUIRED", `${layerAt}.points`);
        for (const [pointIndex, rawPoint] of layer.points.entries()) {
          const pointAt = `${layerAt}.points[${pointIndex}]`;
          const p = object(rawPoint, pointAt);
          exact(
            p,
            [
              "position",
              "color",
              "leftHandle",
              "rightHandle",
              "topHandle",
              "bottomHandle",
            ],
            pointAt,
          );
          point(p.position, `${pointAt}.position`);
          if (!fillColor(p.color)) invalid("FILL_COLOR", `${pointAt}.color`);
          for (const handle of [
            "leftHandle",
            "rightHandle",
            "topHandle",
            "bottomHandle",
          ])
            if (p[handle] !== undefined)
              point(p[handle], `${pointAt}.${handle}`);
        }
        break;
      }
      default:
        invalid("FILL_KIND", `${layerAt}.kind`);
    }
    const layerId = string(layer.id, `${layerAt}.id`);
    if (ids.has(layerId)) invalid("DUPLICATE_ID", `${layerAt}.id`);
    ids.add(layerId);
    if (typeof layer.enabled !== "boolean")
      invalid("FILL_ENABLED_BOOLEAN", `${layerAt}.enabled`);
    if (!unit(layer.opacity))
      invalid("FILL_OPACITY_RANGE", `${layerAt}.opacity`);
    if (!fillBlendModes.has(layer.blendMode as string))
      invalid("FILL_BLEND_MODE", `${layerAt}.blendMode`);
  });
}
function fillSizing(value: unknown, at: string): void {
  for (const [axis, raw] of Object.entries(object(value, at))) {
    if (axis !== "width" && axis !== "height")
      invalid("UNKNOWN_FIELD", `${at}.${axis}`);
    if (raw === null) continue;
    const intent = object(raw, `${at}.${axis}`);
    exact(intent, ["factor"], `${at}.${axis}`);
    if (
      typeof intent.factor !== "number" ||
      !Number.isFinite(intent.factor) ||
      intent.factor <= 0
    )
      invalid("FILL_FACTOR_RANGE", `${at}.${axis}.factor`);
  }
}
function responsiveLayers(value: unknown, at: string): void {
  for (const [breakpoint, raw] of Object.entries(object(value, at))) {
    if (breakpoint !== "tablet" && breakpoint !== "mobile")
      invalid("RESPONSIVE_BREAKPOINT", `${at}.${breakpoint}`);
    const layerAt = `${at}.${breakpoint}`;
    const layer = object(raw, layerAt);
    exact(layer, ["visual", "layout", "sizing", "fillSizing"], layerAt);
    if (layer.visual !== undefined)
      writes(layer.visual, `${layerAt}.visual`, visualFields);
    if (layer.layout !== undefined)
      layoutWrites(layer.layout, `${layerAt}.layout`);
    if (layer.sizing !== undefined)
      writes(layer.sizing, `${layerAt}.sizing`, sizingFields, true);
    if (layer.fillSizing !== undefined)
      fillSizing(layer.fillSizing, `${layerAt}.fillSizing`);
  }
}
function visibility(value: unknown, at: string): void {
  for (const [breakpoint, shown] of Object.entries(object(value, at))) {
    if (!breakpointNames.has(breakpoint))
      invalid("UNKNOWN_BREAKPOINT", `${at}.${breakpoint}`);
    if (typeof shown !== "boolean")
      invalid("VISIBILITY_BOOLEAN", `${at}.${breakpoint}`);
  }
}
function themeOverride(value: unknown, at: string): void {
  const override = object(value, at);
  exact(override, ["mode", "tint"], at);
  if (
    override.mode !== undefined &&
    override.mode !== "light" &&
    override.mode !== "dark"
  )
    invalid("THEME_OVERRIDE_VALUE", `${at}.mode`);
  if (
    override.tint !== undefined &&
    !presetValues.tint.has(override.tint as never)
  )
    invalid("THEME_OVERRIDE_VALUE", `${at}.tint`);
}
function propCondition(
  value: unknown,
  at: string,
  accepted: Record<string, unknown> | undefined,
  choices: Record<string, unknown> | undefined,
): void {
  const condition = object(value, at);
  for (const [prop, item] of Object.entries(condition)) {
    scalar(item, `${at}.${prop}`);
    if (!accepted) continue;
    if (!accepted[prop])
      invalid("CONDITION_PROP_NOT_ACCEPTED", `${at}.${prop}`);
    if (typeof item !== accepted[prop])
      invalid("CONDITION_PROP_TYPE", `${at}.${prop}`);
    const allowed = choices?.[prop];
    if (Array.isArray(allowed) && !allowed.includes(item))
      invalid("CONDITION_PROP_CHOICE", `${at}.${prop}`);
  }
}
function ruleOutput(item: Record<string, unknown>, at: string): void {
  if (item.state !== undefined && !stateNames.has(item.state as string))
    invalid("UNKNOWN_STATE", `${at}.state`);
  if (item.visual !== undefined)
    values(item.visual, `${at}.visual`, visualFields);
  if (item.layout !== undefined) layoutValues(item.layout, `${at}.layout`);
  const size =
    Object.keys((item.visual as object | undefined) ?? {}).length +
    Object.keys((item.layout as object | undefined) ?? {}).length;
  if (size === 0) invalid("EMPTY_RULE_OUTPUT", at);
}
function accepts(value: unknown, at: string): void {
  for (const [key, type] of Object.entries(object(value, at)))
    if (!key || !valueTypes.has(type as ValueType))
      invalid("INVALID_PROP_CONTRACT", `${at}.${key}`);
}
function address(value: unknown, at: string): InstanceAddress {
  const data = object(value, at);
  exact(data, ["instances", "templatePath"], at);
  if (!Array.isArray(data.instances) || data.instances.length === 0)
    invalid("INSTANCE_PATH_REQUIRED", at);
  data.instances.forEach((item, index) => {
    const text = id(item, "", `${at}.instances[${index}]`);
    if (!text.startsWith("project:node:") && !text.startsWith("lib:template:"))
      invalid("INSTANCE_ID_REQUIRED", at);
  });
  if (!Array.isArray(data.templatePath) || data.templatePath.length === 0)
    invalid("TEMPLATE_PATH_REQUIRED", at);
  data.templatePath.forEach((item, index) => {
    const text = id(item, "", `${at}.templatePath[${index}]`);
    if (!text.startsWith("project:node:") && !text.startsWith("lib:template:"))
      invalid("TEMPLATE_ID_REQUIRED", at);
  });
  return value as InstanceAddress;
}
function descendant(value: unknown, at: string): void {
  const item = object(value, at);
  if (item.kind === "patch") {
    exact(
      item,
      [
        "kind",
        "address",
        "props",
        "visual",
        "sizing",
        "stateRules",
        "enabled",
        "layout",
        "fills",
        "fillSizing",
        "responsive",
        "visibility",
      ],
      at,
    );
    address(item.address, `${at}.address`);
    if (item.layout !== undefined) layoutWrites(item.layout, `${at}.layout`);
    if (item.fills !== undefined) fillLayers(item.fills, `${at}.fills`);
    if (item.fillSizing !== undefined)
      fillSizing(item.fillSizing, `${at}.fillSizing`);
    if (item.responsive !== undefined)
      responsiveLayers(item.responsive, `${at}.responsive`);
    if (item.visibility !== undefined)
      visibility(item.visibility, `${at}.visibility`);
    if (item.enabled !== undefined && typeof item.enabled !== "boolean")
      invalid("ENABLED_BOOLEAN", `${at}.enabled`);
    if (item.props !== undefined) writes(item.props, `${at}.props`);
    if (item.visual !== undefined)
      writes(item.visual, `${at}.visual`, visualFields);
    if (item.sizing !== undefined)
      writes(item.sizing, `${at}.sizing`, sizingFields, true);
    if (item.stateRules !== undefined)
      stateRules(item.stateRules, `${at}.stateRules`);
    if (
      item.props === undefined &&
      item.visual === undefined &&
      item.sizing === undefined &&
      item.stateRules === undefined &&
      item.enabled === undefined &&
      item.layout === undefined &&
      item.fills === undefined &&
      item.fillSizing === undefined &&
      item.responsive === undefined &&
      item.visibility === undefined
    )
      invalid("EMPTY_PATCH", at);
  } else if (item.kind === "replace") {
    exact(item, ["kind", "address", "replacementId"], at);
    address(item.address, `${at}.address`);
    id(item.replacementId, "project:node:", `${at}.replacementId`);
  } else if (item.kind === "fillSlot") {
    exact(item, ["kind", "address", "childIds"], at);
    address(item.address, `${at}.address`);
    list(item.childIds, "project:node:", `${at}.childIds`);
  } else invalid("UNKNOWN_OVERRIDE_KIND", at);
}
function binding(value: unknown, at: string): void {
  const item = object(value, at);
  exact(item, ["collectionId", "fieldMap"], at);
  id(item.collectionId, "data:collection:", `${at}.collectionId`);
  for (const [key, value] of Object.entries(
    object(item.fieldMap, `${at}.fieldMap`),
  )) {
    if (!key) invalid("INVALID_FIELD_MAP", at);
    id(value, "data:field:", `${at}.fieldMap.${key}`);
  }
}
function nonnegative(value: unknown, at: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    invalid("NONNEGATIVE_NUMBER_REQUIRED", at);
}
function columns(value: unknown, at: string): void {
  if (value === "auto") return;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    invalid("INVALID_COLUMNS", at);
}
function pageLayout(value: unknown, at: string): void {
  const layout = object(value, at);
  exact(layout, ["direction", "gap", "columns", "breakpoints"], at);
  if (
    layout.direction !== undefined &&
    !["auto", "vertical", "horizontal"].includes(layout.direction as string)
  )
    invalid("INVALID_PAGE_DIRECTION", `${at}.direction`);
  if (layout.gap !== undefined) nonnegative(layout.gap, `${at}.gap`);
  if (layout.columns !== undefined) columns(layout.columns, `${at}.columns`);
  if (layout.breakpoints !== undefined)
    for (const [tier, raw] of Object.entries(
      object(layout.breakpoints, `${at}.breakpoints`),
    )) {
      if (!breakpointNames.has(tier))
        invalid("INVALID_BREAKPOINT", `${at}.breakpoints.${tier}`);
      const item = object(raw, `${at}.breakpoints.${tier}`);
      exact(item, ["gap", "columns"], `${at}.breakpoints.${tier}`);
      if (item.gap !== undefined)
        nonnegative(item.gap, `${at}.breakpoints.${tier}.gap`);
      if (item.columns !== undefined)
        columns(item.columns, `${at}.breakpoints.${tier}.columns`);
    }
}
function placementStyle(value: unknown, at: string): void {
  for (const [key, item] of Object.entries(object(value, at))) {
    if (!placementFields.has(key))
      invalid("INVALID_PLACEMENT_FIELD", `${at}.${key}`);
    if (
      key === "position" &&
      !["absolute", "static", "relative"].includes(item as string)
    )
      invalid("INVALID_PLACEMENT_POSITION", `${at}.${key}`);
    if (
      key !== "position" &&
      typeof item !== "string" &&
      (typeof item !== "number" || !Number.isFinite(item))
    )
      invalid("INVALID_PLACEMENT_VALUE", `${at}.${key}`);
  }
}
function placement(value: unknown, at: string): void {
  const item = object(value, at);
  exact(item, ["base", "breakpoints"], at);
  placementStyle(item.base, `${at}.base`);
  for (const [tier, style] of Object.entries(
    object(item.breakpoints, `${at}.breakpoints`),
  )) {
    if (!breakpointNames.has(tier))
      invalid("INVALID_BREAKPOINT", `${at}.breakpoints.${tier}`);
    placementStyle(style, `${at}.breakpoints.${tier}`);
  }
}
function guides(value: unknown, at: string): void {
  for (const [tier, raw] of Object.entries(object(value, at))) {
    if (!breakpointNames.has(tier))
      invalid("INVALID_BREAKPOINT", `${at}.${tier}`);
    if (!Array.isArray(raw)) invalid("ARRAY_REQUIRED", `${at}.${tier}`);
    const seen = new Set<string>();
    raw.forEach((value, index) => {
      const guide = object(value, `${at}.${tier}[${index}]`);
      exact(guide, ["id", "axis", "position"], `${at}.${tier}[${index}]`);
      const guideId = string(guide.id, `${at}.${tier}[${index}].id`);
      if (seen.has(guideId))
        invalid("DUPLICATE_ID", `${at}.${tier}[${index}].id`);
      seen.add(guideId);
      if (guide.axis !== "x" && guide.axis !== "y")
        invalid("INVALID_GUIDE_AXIS", `${at}.${tier}[${index}].axis`);
      if (
        typeof guide.position !== "number" ||
        !Number.isFinite(guide.position)
      )
        invalid("INVALID_GUIDE_POSITION", `${at}.${tier}[${index}].position`);
    });
  }
}

export function validateCatalogEntry(value: unknown): CatalogEntry {
  const item = object(value, "entry");
  const kind = item.kind as EntryKind;
  if (!entryKinds.has(kind)) invalid("UNKNOWN_ENTRY_KIND", "entry.kind");
  id(item.id, `project:${kind}:`, "entry.id");
  switch (kind) {
    case "project":
      exact(
        item,
        [
          "kind",
          "id",
          "name",
          "pageIds",
          "definitionIds",
          "overrideIds",
          "themeIds",
          "tokenIds",
          "stateVariableIds",
          "interactionIds",
          "assetIds",
          "activeThemeId",
          "pageLayout",
          "toastPlacement",
        ],
        "entry",
      );
      string(item.name, "entry.name");
      for (const [key, prefix] of [
        ["pageIds", "project:page:"],
        ["definitionIds", "project:definition:"],
        ["overrideIds", "project:definitionOverride:"],
        ["themeIds", "project:theme:"],
        ["tokenIds", "project:token:"],
        ["stateVariableIds", "project:stateVariable:"],
        ["interactionIds", "project:interaction:"],
        ["assetIds", "project:asset:"],
      ] as const)
        list(item[key], prefix, `entry.${key}`);
      if (item.activeThemeId !== undefined)
        id(item.activeThemeId, "project:theme:", "entry.activeThemeId");
      if (item.pageLayout !== undefined)
        pageLayout(item.pageLayout, "entry.pageLayout");
      if (
        item.toastPlacement !== undefined &&
        !CATALOG_TOAST_PLACEMENTS.includes(
          item.toastPlacement as CatalogToastPlacement,
        )
      )
        invalid("INVALID_TOAST_PLACEMENT", "entry.toastPlacement");
      break;
    case "page":
      exact(
        item,
        [
          "kind",
          "id",
          "route",
          "name",
          "children",
          "placement",
          "guideEntries",
          "parentId",
        ],
        "entry",
      );
      string(item.route, "entry.route");
      if (item.parentId !== undefined)
        id(item.parentId, "project:page:", "entry.parentId");
      string(item.name, "entry.name");
      list(item.children, "project:node:", "entry.children");
      if (item.placement !== undefined)
        placement(item.placement, "entry.placement");
      if (item.guideEntries !== undefined)
        guides(item.guideEntries, "entry.guideEntries");
      break;
    case "definition":
      exact(
        item,
        [
          "kind",
          "id",
          "name",
          "mode",
          "accepts",
          "defaults",
          "visual",
          "stateRules",
          "bindingId",
          "templateRootId",
          "usage",
        ],
        "entry",
      );
      string(item.name, "entry.name");
      if (!["primitive", "composite", "native"].includes(item.mode as string))
        invalid("INVALID_DEFINITION_MODE", "entry.mode");
      if (
        item.usage !== undefined &&
        item.usage !== "component" &&
        item.usage !== "layout"
      )
        invalid("INVALID_DEFINITION_USAGE", "entry.usage");
      accepts(item.accepts, "entry.accepts");
      values(item.defaults, "entry.defaults");
      values(item.visual, "entry.visual", visualFields);
      stateRules(item.stateRules, "entry.stateRules");
      if (item.bindingId !== undefined)
        string(item.bindingId, "entry.bindingId");
      if (item.templateRootId !== undefined)
        id(item.templateRootId, "project:node:", "entry.templateRootId");
      if (
        (item.mode === "composite") !== (item.templateRootId !== undefined) ||
        (item.mode === "composite") === (item.bindingId !== undefined)
      )
        invalid("DEFINITION_EXECUTION_EXCLUSIVE", "entry");
      break;
    case "definitionOverride":
      exact(
        item,
        ["kind", "id", "targetId", "defaults", "visual", "stateRules"],
        "entry",
      );
      id(item.targetId, "lib:definition:", "entry.targetId");
      writes(item.defaults, "entry.defaults");
      writes(item.visual, "entry.visual", visualFields);
      stateRules(item.stateRules, "entry.stateRules");
      break;
    case "node": {
      exact(
        item,
        [
          "kind",
          "id",
          "name",
          "definitionId",
          "children",
          "props",
          "visual",
          "sizing",
          "placement",
          "stateRules",
          "descendantOverrides",
          "binding",
          "slot",
          "regions",
          "placeholder",
          "enabled",
          "layout",
          "fills",
          "fillSizing",
          "responsive",
          "visibility",
          "themeOverride",
          "metadata",
          "presentWhen",
          "showWhen",
        ],
        "entry",
      );
      presentWhen(item.presentWhen, "entry.presentWhen");
      showWhen(item.showWhen, "entry.showWhen");
      if (item.metadata !== undefined) {
        const metadata = object(item.metadata, "entry.metadata");
        exact(metadata, ["htmlId", "className", "ariaLabel"], "entry.metadata");
        for (const key of ["className", "ariaLabel"] as const)
          if (
            metadata[key] !== undefined &&
            (typeof metadata[key] !== "string" || !String(metadata[key]).trim())
          )
            invalid("INVALID_METADATA", `entry.metadata.${key}`);
        if (
          metadata.htmlId !== undefined &&
          (typeof metadata.htmlId !== "string" ||
            !/^[^\s]+$/.test(metadata.htmlId))
        )
          invalid("INVALID_HTML_ID", "entry.metadata.htmlId");
      }
      if (item.layout !== undefined) layoutWrites(item.layout, "entry.layout");
      if (item.fills !== undefined) fillLayers(item.fills, "entry.fills");
      if (item.fillSizing !== undefined)
        fillSizing(item.fillSizing, "entry.fillSizing");
      if (item.responsive !== undefined)
        responsiveLayers(item.responsive, "entry.responsive");
      if (item.visibility !== undefined)
        visibility(item.visibility, "entry.visibility");
      if (item.themeOverride !== undefined)
        themeOverride(item.themeOverride, "entry.themeOverride");
      if (item.enabled !== undefined && typeof item.enabled !== "boolean")
        invalid("ENABLED_BOOLEAN", "entry.enabled");
      const definitionId = id(item.definitionId, "", "entry.definitionId");
      if (
        !definitionId.startsWith("lib:definition:") &&
        !definitionId.startsWith("project:definition:")
      )
        invalid("DEFINITION_ID_REQUIRED", "entry.definitionId");
      list(item.children, "project:node:", "entry.children");
      writes(item.props, "entry.props");
      writes(item.visual, "entry.visual", visualFields);
      writes(item.sizing, "entry.sizing", sizingFields, true);
      if (item.placement !== undefined) {
        const placement = object(item.placement, "entry.placement");
        exact(placement, ["kind", "x", "y"], "entry.placement");
        if (placement.kind !== "absolute")
          invalid("NODE_PLACEMENT_KIND", "entry.placement.kind");
        for (const axis of ["x", "y"])
          if (
            typeof placement[axis] !== "number" ||
            !Number.isFinite(placement[axis])
          )
            invalid("NODE_PLACEMENT_COORDINATE", `entry.placement.${axis}`);
      }
      if (item.stateRules !== undefined)
        stateRules(item.stateRules, "entry.stateRules");
      if (!Array.isArray(item.descendantOverrides))
        invalid("ARRAY_REQUIRED", "entry.descendantOverrides");
      item.descendantOverrides.forEach((entry, index) =>
        descendant(entry, `entry.descendantOverrides[${index}]`),
      );
      const addresses = item.descendantOverrides.map((entry) =>
        JSON.stringify((entry as Record<string, unknown>).address),
      );
      if (addresses.length !== new Set(addresses).size)
        invalid("DUPLICATE_DESCENDANT_ADDRESS", "entry.descendantOverrides");
      if (item.binding !== undefined) binding(item.binding, "entry.binding");
      if (item.slot !== undefined) {
        const slot = object(item.slot, "entry.slot");
        exact(slot, ["name", "required"], "entry.slot");
        string(slot.name, "entry.slot.name");
        if (typeof slot.required !== "boolean")
          invalid("SLOT_REQUIRED_BOOLEAN", "entry.slot.required");
      }
      if (item.name !== undefined) string(item.name, "entry.name");
      if (item.regions !== undefined) {
        if (!Array.isArray(item.regions))
          invalid("ARRAY_REQUIRED", "entry.regions");
        const names = new Set<string>();
        for (const [index, raw] of item.regions.entries()) {
          const region = object(raw, `entry.regions[${index}]`);
          exact(region, ["name", "required"], `entry.regions[${index}]`);
          const name = string(region.name, `entry.regions[${index}].name`);
          if (names.has(name)) invalid("DUPLICATE_REGION", name);
          names.add(name);
          if (typeof region.required !== "boolean")
            invalid("REGION_REQUIRED_BOOLEAN", name);
        }
      }
      if (
        item.placeholder !== undefined &&
        typeof item.placeholder !== "boolean"
      )
        invalid("PLACEHOLDER_BOOLEAN_REQUIRED", "entry.placeholder");
      break;
    }
    case "theme": {
      exact(item, ["kind", "id", "name", "tokenIds", "preset"], "entry");
      string(item.name, "entry.name");
      list(item.tokenIds, "project:token:", "entry.tokenIds");
      const preset = object(item.preset, "entry.preset");
      exact(preset, Object.keys(presetValues), "entry.preset");
      for (const [key, allowed] of Object.entries(presetValues))
        if (!allowed.has(preset[key] as never))
          invalid("INVALID_THEME_PRESET", `entry.preset.${key}`);
      break;
    }
    case "token":
      exact(
        item,
        ["kind", "id", "name", "tokenType", "value", "source"],
        "entry",
      );
      string(item.name, "entry.name");
      if (!tokenTypes.has(item.tokenType as TokenType))
        invalid("INVALID_TOKEN_TYPE", "entry.tokenType");
      scalar(item.value, "entry.value");
      if (item.source !== "spec-token" && item.source !== "user-defined")
        invalid("INVALID_TOKEN_SOURCE", "entry.source");
      if (
        (item.tokenType === "number" || item.tokenType === "length") !==
        (typeof item.value === "number")
      )
        invalid("TOKEN_VALUE_TYPE", "entry.value");
      if (
        (item.tokenType === "color" || item.tokenType === "string") !==
        (typeof item.value === "string")
      )
        invalid("TOKEN_VALUE_TYPE", "entry.value");
      if (item.tokenType === "boolean" && typeof item.value !== "boolean")
        invalid("TOKEN_VALUE_TYPE", "entry.value");
      break;
    case "stateVariable": {
      exact(
        item,
        ["kind", "id", "ownerId", "name", "valueType", "defaultValue"],
        "entry",
      );
      const owner = id(item.ownerId, "", "entry.ownerId");
      if (
        !owner.startsWith("project:page:") &&
        !owner.startsWith("project:node:")
      )
        invalid("INVALID_OWNER", "entry.ownerId");
      string(item.name, "entry.name");
      if (!scalarValueTypes.has(item.valueType as ValueType))
        invalid("INVALID_VALUE_TYPE", "entry.valueType");
      scalar(item.defaultValue, "entry.defaultValue");
      if (typeof item.defaultValue !== item.valueType)
        invalid("DEFAULT_VALUE_TYPE", "entry.defaultValue");
      break;
    }
    case "interaction": {
      exact(
        item,
        ["kind", "id", "ownerId", "address", "trigger", "action"],
        "entry",
      );
      id(item.ownerId, "project:node:", "entry.ownerId");
      if (item.address !== undefined) address(item.address, "entry.address");
      string(item.trigger, "entry.trigger");
      const action = object(item.action, "entry.action");
      if (action.opcode === "setState") {
        exact(action, ["opcode", "variableId", "op", "value"], "entry.action");
        const variableId = id(action.variableId, "", "entry.action.variableId");
        if (
          !variableId.startsWith("project:stateVariable:") &&
          !variableId.startsWith("data:variable:")
        )
          invalid("INVALID_VARIABLE_REF", "entry.action.variableId");
        if (
          !["set", "toggle", "increment", "reset"].includes(action.op as string)
        )
          invalid("INVALID_STATE_OP", "entry.action.op");
        if (action.op === "set") scalar(action.value, "entry.action.value");
        if (
          action.op === "increment" &&
          action.value !== undefined &&
          (typeof action.value !== "number" || !Number.isFinite(action.value))
        )
          invalid("STATE_INCREMENT_NUMBER", "entry.action.value");
        if (
          (action.op === "toggle" || action.op === "reset") &&
          action.value !== undefined
        )
          invalid("STATE_VALUE_NOT_ALLOWED", "entry.action.value");
      } else if (action.opcode === "navigate") {
        exact(action, ["opcode", "pageId"], "entry.action");
        id(action.pageId, "project:page:", "entry.action.pageId");
      } else if (action.opcode === "callEndpoint") {
        exact(action, ["opcode", "endpointId"], "entry.action");
        id(action.endpointId, "data:endpoint:", "entry.action.endpointId");
      } else if (action.opcode === "toast") {
        exact(action, ["opcode", "message"], "entry.action");
        string(action.message, "entry.action.message");
      } else if (action.opcode === "capability") {
        exact(
          action,
          ["opcode", "targetId", "capabilityId", "value"],
          "entry.action",
        );
        id(action.targetId, "project:node:", "entry.action.targetId");
        string(action.capabilityId, "entry.action.capabilityId");
        if (action.value !== undefined) {
          if (Array.isArray(action.value))
            action.value.forEach((value, index) =>
              scalar(value, `entry.action.value[${index}]`),
            );
          else scalar(action.value, "entry.action.value");
        }
      } else invalid("UNKNOWN_ACTION_OPCODE", "entry.action.opcode");
      break;
    }
    case "asset":
      exact(
        item,
        ["kind", "id", "contentId", "mediaType", "byteLength", "filename"],
        "entry",
      );
      string(item.contentId, "entry.contentId");
      // ADR-235 content address: project files carry the bytes of every referenced asset.
      if (!/^asset:sha256-[0-9a-f]{64}$/.test(item.contentId as string))
        invalid("INVALID_ASSET_REF", "entry.contentId");
      string(item.mediaType, "entry.mediaType");
      string(item.filename, "entry.filename");
      if (
        typeof item.byteLength !== "number" ||
        !Number.isSafeInteger(item.byteLength) ||
        item.byteLength < 0
      )
        invalid("INVALID_ASSET_SIZE", "entry.byteLength");
  }
  return value as CatalogEntry;
}

export function validateCatalogDocument(value: unknown): CatalogDocument {
  const doc = object(value, "document");
  exact(
    doc,
    [
      "format",
      "schemaVersion",
      "libraryContractVersion",
      "revision",
      "projectId",
      "rootId",
      "entries",
    ],
    "document",
  );
  if (doc.format !== CATALOG_FORMAT)
    invalid("UNSUPPORTED_FORMAT", "document.format");
  if (doc.schemaVersion !== CATALOG_SCHEMA_VERSION)
    invalid("UNSUPPORTED_SCHEMA", "document.schemaVersion");
  if (doc.libraryContractVersion !== LIBRARY_CONTRACT_VERSION)
    invalid("UNSUPPORTED_LIBRARY_CONTRACT", "document.libraryContractVersion");
  if (
    typeof doc.revision !== "number" ||
    !Number.isSafeInteger(doc.revision) ||
    doc.revision < 0
  )
    invalid("INVALID_REVISION", "document.revision");
  id(doc.projectId, "project:project:", "document.projectId");
  if (doc.projectId !== doc.rootId)
    invalid("ROOT_PROJECT_MISMATCH", "document.rootId");
  const entries = object(doc.entries, "document.entries");
  for (const [key, entry] of Object.entries(entries)) {
    const parsed = validateCatalogEntry(entry);
    if (parsed.id !== key) invalid("ENTRY_KEY_MISMATCH", key);
  }
  return value as CatalogDocument;
}

export function validateLibraryDefinition(value: unknown): LibraryDefinition {
  const item = object(value, "library.definition");
  exact(
    item,
    [
      "id",
      "name",
      "mode",
      "accepts",
      "defaults",
      "visual",
      "propChoices",
      "propVisualRules",
      "stateRules",
      "layout",
      "conditionalRules",
      "partRules",
      "bindingId",
      "templateRootId",
      "ruleId",
    ],
    "library.definition",
  );
  id(item.id, "lib:definition:", "library.definition.id");
  string(item.name, "library.definition.name");
  if (!["primitive", "composite", "native"].includes(item.mode as string))
    invalid("INVALID_DEFINITION_MODE", "library.definition.mode");
  accepts(item.accepts, "library.definition.accepts");
  values(item.defaults, "library.definition.defaults");
  values(item.visual, "library.definition.visual", visualFields);
  if (item.propChoices !== undefined) {
    const choices = object(item.propChoices, "library.definition.propChoices");
    const accepted = object(item.accepts, "library.definition.accepts");
    for (const [prop, candidates] of Object.entries(choices)) {
      if (!accepted[prop] || !Array.isArray(candidates) || !candidates.length)
        invalid("INVALID_PROP_CHOICES", `library.definition.${prop}`);
      const seen = new Set<unknown>();
      for (const candidate of candidates) {
        scalar(candidate, `library.definition.propChoices.${prop}`);
        if (typeof candidate !== accepted[prop] || seen.has(candidate))
          invalid("INVALID_PROP_CHOICES", `library.definition.${prop}`);
        seen.add(candidate);
      }
      if (
        item.defaults &&
        prop in object(item.defaults, "library.definition.defaults")
      ) {
        const value = object(item.defaults, "library.definition.defaults")[
          prop
        ];
        if (typeof value !== "object" && !seen.has(value))
          invalid("PROP_CHOICE_MISMATCH", `library.definition.${prop}`);
      }
    }
  }
  if (item.propVisualRules !== undefined) {
    const rules = object(
      item.propVisualRules,
      "library.definition.propVisualRules",
    );
    const accepted = object(item.accepts, "library.definition.accepts");
    for (const [prop, options] of Object.entries(rules)) {
      if (accepted[prop] !== "string")
        invalid("INVALID_VISUAL_RULE_PROP", `library.definition.${prop}`);
      const choices = object(
        options,
        `library.definition.propVisualRules.${prop}`,
      );
      for (const [choice, visual] of Object.entries(choices)) {
        if (!choice)
          invalid("EMPTY_VISUAL_RULE_CHOICE", `library.definition.${prop}`);
        values(
          visual,
          `library.definition.propVisualRules.${prop}.${choice}`,
          visualFields,
        );
      }
    }
  }
  stateRules(item.stateRules, "library.definition.stateRules");
  if (item.layout !== undefined)
    layoutValues(item.layout, "library.definition.layout");
  const acceptedProps = object(item.accepts, "library.definition.accepts");
  const propChoices =
    item.propChoices === undefined
      ? undefined
      : object(item.propChoices, "library.definition.propChoices");
  if (item.conditionalRules !== undefined) {
    if (!Array.isArray(item.conditionalRules))
      invalid("ARRAY_REQUIRED", "library.definition.conditionalRules");
    item.conditionalRules.forEach((raw, index) => {
      const at = `library.definition.conditionalRules[${index}]`;
      const rule = object(raw, at);
      exact(rule, ["when", "state", "visual", "layout"], at);
      propCondition(rule.when, `${at}.when`, acceptedProps, propChoices);
      if (!Object.keys(object(rule.when, `${at}.when`)).length && !rule.state)
        invalid("EMPTY_RULE_CONDITION", at);
      ruleOutput(rule, at);
    });
  }
  if (item.partRules !== undefined) {
    if (!Array.isArray(item.partRules))
      invalid("ARRAY_REQUIRED", "library.definition.partRules");
    item.partRules.forEach((raw, index) => {
      const at = `library.definition.partRules[${index}]`;
      const rule = object(raw, at);
      exact(rule, ["child", "when", "state", "visual", "layout"], at);
      const child = object(rule.child, `${at}.child`);
      exact(child, ["definitionId", "props", "via", "viaProps"], `${at}.child`);
      id(child.definitionId, "lib:definition:", `${at}.child.definitionId`);
      if (child.via !== undefined)
        id(child.via, "lib:definition:", `${at}.child.via`);
      if (child.props !== undefined)
        propCondition(child.props, `${at}.child.props`, undefined, undefined);
      if (child.viaProps !== undefined) {
        if (child.via === undefined)
          invalid("VIA_REQUIRED", `${at}.child.viaProps`);
        propCondition(
          child.viaProps,
          `${at}.child.viaProps`,
          undefined,
          undefined,
        );
      }
      if (rule.when !== undefined)
        propCondition(rule.when, `${at}.when`, acceptedProps, propChoices);
      ruleOutput(rule, at);
    });
  }
  if (item.bindingId !== undefined)
    string(item.bindingId, "library.definition.bindingId");
  if (item.ruleId !== undefined) {
    string(item.ruleId, "library.definition.ruleId");
    if (item.mode === "composite")
      invalid("COMPOSITE_RULE_UNSUPPORTED", "library.definition.ruleId");
  }
  if (item.templateRootId !== undefined)
    id(
      item.templateRootId,
      "lib:template:",
      "library.definition.templateRootId",
    );
  if (
    (item.mode === "composite") !== (item.templateRootId !== undefined) ||
    (item.mode === "composite") === (item.bindingId !== undefined)
  )
    invalid("DEFINITION_EXECUTION_EXCLUSIVE", "library.definition");
  return value as LibraryDefinition;
}
/**
 * ADR-256 Decision 7 — `showWhen`: `{ all: [1 – 3 conditions], from? }`. A condition is a state key,
 * `{ not }`, or either with its own `from`; a state owner is `{ type }` or `{ ancestor: nodeId |
 * address | local }` (breakdown §1-1). Whether the owner exists and gives the key is the commands'
 * (an external document's broken reference reads as false — `catalogShowWhenHolds`).
 */
function showWhen(value: unknown, at: string): void {
  if (value === undefined) return;
  const data = object(value, at);
  exact(data, ["all", "from"], at);
  if (!Array.isArray(data.all) || data.all.length < 1 || data.all.length > 3)
    invalid("SHOW_WHEN_CONDITION_COUNT", `${at}.all`);
  const key = (item: unknown, where: string) => {
    if (!CATALOG_STATE_KEYS.includes(item as CatalogStateKey))
      invalid("SHOW_WHEN_KEY_UNKNOWN", where);
  };
  data.all.forEach((item, index) => {
    const where = `${at}.all[${index}]`;
    if (typeof item === "string") return key(item, where);
    const condition = object(item, where);
    exact(condition, ["key", "not", "from"], where);
    if ((condition.key === undefined) === (condition.not === undefined))
      invalid("SHOW_WHEN_CONDITION_SHAPE", where);
    if (condition.key !== undefined && condition.from === undefined)
      invalid("SHOW_WHEN_CONDITION_SHAPE", where);
    key(condition.key ?? condition.not, where);
    if (condition.from !== undefined)
      stateOwnerRef(condition.from, `${where}.from`);
  });
  if (data.from !== undefined) stateOwnerRef(data.from, `${at}.from`);
}
function stateOwnerRef(value: unknown, at: string): void {
  const data = object(value, at);
  if ("type" in data) {
    exact(data, ["type"], at);
    string(data.type, `${at}.type`);
    return;
  }
  exact(data, ["ancestor"], at);
  const ancestor = object(data.ancestor, `${at}.ancestor`);
  const [form] = Object.keys(ancestor);
  if (Object.keys(ancestor).length !== 1)
    invalid("STATE_OWNER_REF_SHAPE", `${at}.ancestor`);
  if (form === "nodeId")
    id(ancestor.nodeId, "project:node:", `${at}.ancestor.nodeId`);
  else if (form === "address")
    address(ancestor.address, `${at}.ancestor.address`);
  else if (form === "local") {
    const local = object(ancestor.local, `${at}.ancestor.local`);
    exact(local, ["instances", "templatePath"], `${at}.ancestor.local`);
    if (!Array.isArray(local.instances))
      invalid("ARRAY_REQUIRED", `${at}.ancestor.local.instances`);
    if (!Array.isArray(local.templatePath) || local.templatePath.length === 0)
      invalid("TEMPLATE_PATH_REQUIRED", `${at}.ancestor.local.templatePath`);
    for (const [index, item] of [
      ...local.instances,
      ...local.templatePath,
    ].entries()) {
      const text = id(item, "", `${at}.ancestor.local[${index}]`);
      if (!text.startsWith("project:node:") && !text.startsWith("lib:template:"))
        invalid("TEMPLATE_ID_REQUIRED", `${at}.ancestor.local`);
    }
  } else invalid("STATE_OWNER_REF_SHAPE", `${at}.ancestor`);
}
/** ADR-256 Decision 7 — `presentWhen` is one of the fixed value conditions. */
function presentWhen(value: unknown, at: string): void {
  if (
    value !== undefined &&
    !CATALOG_PRESENT_WHEN.includes(value as CatalogPresentWhen)
  )
    invalid("PRESENT_WHEN_UNKNOWN", at);
}
export function validateLibraryTemplate(value: unknown): LibraryTemplateNode {
  const item = object(value, "library.template");
  exact(
    item,
    [
      "id",
      "definitionId",
      "children",
      "props",
      "visual",
      "layout",
      "slot",
      "enabled",
      "descendantPatches",
      "slotFills",
      "displayState",
      "stateRules",
      "presentWhen",
      "showWhen",
    ],
    "library.template",
  );
  presentWhen(item.presentWhen, "library.template.presentWhen");
  showWhen(item.showWhen, "library.template.showWhen");
  if (item.layout !== undefined)
    layoutValues(item.layout, "library.template.layout");
  if (item.stateRules !== undefined)
    stateRules(item.stateRules, "library.template.stateRules");
  if (
    item.displayState !== undefined &&
    !DISPLAY_STATE_NAMES.includes(item.displayState as DisplayStateName)
  )
    invalid("DISPLAY_STATE_UNKNOWN", "library.template.displayState");
  if (item.enabled !== undefined && typeof item.enabled !== "boolean")
    invalid("ENABLED_BOOLEAN", "library.template.enabled");
  if (item.descendantPatches !== undefined) {
    if (!Array.isArray(item.descendantPatches))
      invalid("ARRAY_REQUIRED", "library.template.descendantPatches");
    const paths = new Set<string>();
    item.descendantPatches.forEach((raw, index) => {
      const at = `library.template.descendantPatches[${index}]`;
      const patch = object(raw, at);
      exact(
        patch,
        ["templatePath", "props", "visual", "layout", "enabled"],
        at,
      );
      list(patch.templatePath, "lib:template:", `${at}.templatePath`);
      if (!(patch.templatePath as unknown[]).length)
        invalid("EMPTY_TEMPLATE_PATH", at);
      const key = JSON.stringify(patch.templatePath);
      if (paths.has(key)) invalid("DUPLICATE_DESCENDANT_ADDRESS", at);
      paths.add(key);
      if (patch.props !== undefined) values(patch.props, `${at}.props`);
      if (patch.visual !== undefined)
        values(patch.visual, `${at}.visual`, visualFields);
      if (patch.layout !== undefined)
        layoutValues(patch.layout, `${at}.layout`);
      if (patch.enabled !== undefined && typeof patch.enabled !== "boolean")
        invalid("ENABLED_BOOLEAN", `${at}.enabled`);
      if (
        patch.props === undefined &&
        patch.visual === undefined &&
        patch.layout === undefined &&
        patch.enabled === undefined
      )
        invalid("EMPTY_PATCH", at);
    });
  }
  if (item.slotFills !== undefined) {
    if (!Array.isArray(item.slotFills))
      invalid("ARRAY_REQUIRED", "library.template.slotFills");
    const paths = new Set<string>();
    item.slotFills.forEach((raw, index) => {
      const at = `library.template.slotFills[${index}]`;
      const fill = object(raw, at);
      exact(fill, ["templatePath", "childIds"], at);
      list(fill.templatePath, "lib:template:", `${at}.templatePath`);
      if (!(fill.templatePath as unknown[]).length)
        invalid("EMPTY_TEMPLATE_PATH", at);
      const key = JSON.stringify(fill.templatePath);
      if (paths.has(key)) invalid("DUPLICATE_DESCENDANT_ADDRESS", at);
      paths.add(key);
      list(fill.childIds, "lib:template:", `${at}.childIds`);
    });
  }
  id(item.id, "lib:template:", "library.template.id");
  const definitionId = id(
    item.definitionId,
    "",
    "library.template.definitionId",
  );
  if (!definitionId.startsWith("lib:definition:"))
    invalid("INVALID_DEFINITION_REF", "library.template.definitionId");
  list(item.children, "lib:template:", "library.template.children");
  values(item.props, "library.template.props");
  values(item.visual, "library.template.visual", visualFields);
  if (item.slot !== undefined) {
    const slot = object(item.slot, "library.template.slot");
    exact(slot, ["name", "required"], "library.template.slot");
    string(slot.name, "library.template.slot.name");
    if (typeof slot.required !== "boolean")
      invalid("SLOT_REQUIRED_BOOLEAN", "library.template.slot.required");
  }
  return value as LibraryTemplateNode;
}
export function validateLibraryToken(value: unknown): LibraryToken {
  const item = object(value, "library.token");
  exact(item, ["id", "tokenType", "value", "source", "ref"], "library.token");
  id(item.id, "lib:token:", "library.token.id");
  if (!tokenTypes.has(item.tokenType as TokenType))
    invalid("INVALID_TOKEN_TYPE", "library.token.tokenType");
  scalar(item.value, "library.token.value");
  if (
    (item.tokenType === "number" || item.tokenType === "length") !==
    (typeof item.value === "number")
  )
    invalid("TOKEN_VALUE_TYPE", "library.token.value");
  if (
    (item.tokenType === "color" || item.tokenType === "string") !==
    (typeof item.value === "string")
  )
    invalid("TOKEN_VALUE_TYPE", "library.token.value");
  if (item.tokenType === "boolean" && typeof item.value !== "boolean")
    invalid("TOKEN_VALUE_TYPE", "library.token.value");
  if (item.source !== "spec-token")
    invalid("INVALID_TOKEN_SOURCE", "library.token.source");
  if (
    item.ref !== undefined &&
    (typeof item.ref !== "string" || !/^\{[\w]+\.[^{}]+\}$/.test(item.ref))
  )
    invalid("INVALID_TOKEN_REF", "library.token.ref");
  return value as LibraryToken;
}
