import {
  CATALOG_FORMAT,
  CATALOG_SCHEMA_VERSION,
  LIBRARY_CONTRACT_VERSION,
  type CatalogDocument,
  type CatalogEntry,
  CATALOG_PRESENT_WHEN,
  CATALOG_STATE_KEYS,
  CATALOG_TOAST_PLACEMENTS,
  CATALOG_TOAST_VARIANTS,
  CATALOG_COLLECTION_ROW_LIMIT,
  COMPONENT_PROPERTY_KINDS,
  type CatalogStateKey,
  type CatalogToastPlacement,
  type CatalogToastVariant,
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
  VIEW_COMPARISONS,
  type VisualField,
} from "./types";
import { CATALOG_DERIVED_VARIANT_PROPS } from "./derivedVariantProps";
import { catalogCalendarDurationFits } from "./valueType";
import { isDateValueText } from "../../state/dateValue";
import { catalogNumberFormatFits } from "./numberFormatValue";
import type { ComputedSchemaField } from "../../collections/formula/compute";
import { formulaRuntimeSync } from "../../collections/formula/engine";

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
  "view",
  "collection",
  "endpoint",
  "projectVariable",
]);
/** ADR-286 — a data entry keeps its data reference id. */
const DATA_ENTRY_PREFIX: Partial<Record<EntryKind, string>> = {
  collection: "data:collection:",
  endpoint: "data:endpoint:",
  projectVariable: "data:variable:",
};
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
  // ADR-275 Phase 6 · 7 (사용자 결정 5 · 6, 2026-10-20 — ADR-267 결정 1 · 2): a node sticks in its
  // scroll container at its insets (sticky), or is placed in the page viewport (fixed).
  position: keyword("static", "relative", "absolute", "sticky", "fixed"),
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
  // ADR-275: `unsafe center` = the Position section's Center (an absolute box stays centered when
  // it is wider than its parent — css-align-3 overflow alignment).
  alignSelf: keyword("auto", "unsafe center", ...alignKeywords),
  justifySelf: keyword("auto", "unsafe center", ...alignKeywords),
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
  "columnSize",
  "columnStaticSize",
  "calendarDuration",
  "racColor",
  "numberFormat",
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
  /^(project:(project|page|definition|definitionOverride|node|theme|token|stateVariable|interaction|asset|view):[A-Za-z0-9][A-Za-z0-9_-]*|lib:(definition|template|token):[A-Za-z0-9][A-Za-z0-9_-]*|data:(collection|field|endpoint|variable):[A-Za-z0-9][A-Za-z0-9_-]*)$/;

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
/** ADR-294 — the value types an event property may carry. */
const EVENT_VALUE_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "date",
  "object",
  "array",
]);
/** A component property key: a prop name (the `{key}` binding grammar). */
export const COMPONENT_PROPERTY_KEY = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
/**
 * ADR-261 Decision 4 — the shape of a component's properties: unique keys, a kind, one or more
 * unique targets (a text target names its prop; a boolean target none). Each origin node · text
 * prop is driven by at most one property (the graph checks the targets exist in the origin).
 */
function componentProperties(value: unknown, at: string): void {
  if (!Array.isArray(value)) invalid("ARRAY_REQUIRED", at);
  const keys = new Set<string>();
  const driven = new Set<string>();
  for (const [index, raw] of value.entries()) {
    const path = `${at}[${index}]`;
    const property = object(raw, path);
    exact(
      property,
      [
        "key",
        "name",
        "kind",
        "targets",
        "preferred",
        "valueType",
        "variableId",
      ],
      path,
    );
    const key = string(property.key, `${path}.key`);
    if (!COMPONENT_PROPERTY_KEY.test(key))
      invalid("INVALID_PROPERTY_KEY", `${path}.key`);
    if (keys.has(key)) invalid("DUPLICATE_PROPERTY_KEY", `${path}.key`);
    keys.add(key);
    string(property.name, `${path}.name`);
    if (!COMPONENT_PROPERTY_KINDS.includes(property.kind as never))
      invalid("INVALID_PROPERTY_KIND", `${path}.kind`);
    // ADR-294 — an event · a variable drives no node (`targets: []`): an event's value type is
    // optional, a variable names its input variable (the graph checks it is the template root's).
    const output = property.kind === "event" || property.kind === "variable";
    if (!Array.isArray(property.targets))
      invalid("PROPERTY_TARGETS_REQUIRED", `${path}.targets`);
    if (output !== (property.targets.length === 0))
      invalid(
        output ? "PROPERTY_TARGETS_NOT_ALLOWED" : "PROPERTY_TARGETS_REQUIRED",
        `${path}.targets`,
      );
    if (property.valueType !== undefined) {
      if (property.kind !== "event")
        invalid("PROPERTY_VALUE_TYPE_EVENT_ONLY", `${path}.valueType`);
      if (!EVENT_VALUE_TYPES.has(property.valueType as string))
        invalid("INVALID_VALUE_TYPE", `${path}.valueType`);
    }
    if ((property.kind === "variable") !== (property.variableId !== undefined))
      invalid("PROPERTY_VARIABLE_REQUIRED", `${path}.variableId`);
    if (property.variableId !== undefined)
      id(property.variableId, "project:stateVariable:", `${path}.variableId`);
    for (const [targetIndex, rawTarget] of property.targets.entries()) {
      const targetAt = `${path}.targets[${targetIndex}]`;
      const target = object(rawTarget, targetAt);
      exact(target, ["id", "prop"], targetAt);
      const nodeId = id(target.id, "project:node:", `${targetAt}.id`);
      if (property.kind === "text") {
        const prop = string(target.prop, `${targetAt}.prop`);
        if (!COMPONENT_PROPERTY_KEY.test(prop))
          invalid("INVALID_PROPERTY_KEY", `${targetAt}.prop`);
      } else if (target.prop !== undefined)
        invalid("PROPERTY_PROP_TEXT_ONLY", `${targetAt}.prop`);
      const drives = `${property.kind}\u0000${nodeId}\u0000${target.prop ?? ""}`;
      if (driven.has(drives)) invalid("PROPERTY_TARGET_TAKEN", targetAt);
      driven.add(drives);
    }
    // ADR-261 Phase 5: an instance property's preferred components (Figma preferred values).
    if (property.preferred !== undefined) {
      if (property.kind !== "instance")
        invalid("PROPERTY_PREFERRED_INSTANCE_ONLY", `${path}.preferred`);
      if (!Array.isArray(property.preferred))
        invalid("ARRAY_REQUIRED", `${path}.preferred`);
      const seen = new Set<string>();
      for (const [preferredIndex, value] of property.preferred.entries()) {
        const preferredAt = `${path}.preferred[${preferredIndex}]`;
        if (
          typeof value !== "string" ||
          (!value.startsWith("project:definition:") &&
            !value.startsWith("lib:definition:"))
        )
          invalid("DEFINITION_ID_REQUIRED", preferredAt);
        if (seen.has(value)) invalid("DUPLICATE_PREFERRED", preferredAt);
        seen.add(value);
      }
    }
  }
}
/** A string (empty allowed — a cleared field). */
function text(value: unknown, at: string): string {
  if (typeof value !== "string") invalid("STRING_REQUIRED", at);
  return value;
}
function boolean(value: unknown, at: string): boolean {
  if (typeof value !== "boolean") invalid("BOOLEAN_REQUIRED", at);
  return value;
}
/** A JSON value: what a project file carries back unchanged (no `undefined`, no non-finite number). */
function jsonValue(value: unknown, at: string, depth = 0): void {
  if (depth > 32) invalid("VALUE_TOO_DEEP", at);
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalid("SCALAR_REQUIRED", at);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      jsonValue(item, `${at}[${index}]`, depth + 1),
    );
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>))
      if (item !== undefined) jsonValue(item, `${at}.${key}`, depth + 1);
    return;
  }
  invalid("JSON_VALUE_REQUIRED", at);
}
/** ADR-286 — a collection's fields (the Data panel's columns). */
function dataFields(value: unknown, at: string, depth = 0): void {
  if (!Array.isArray(value)) invalid("ARRAY_REQUIRED", at);
  if (depth > 8) invalid("VALUE_TOO_DEEP", at);
  value.forEach((item, index) => {
    const field = object(item, `${at}[${index}]`);
    const here = `${at}[${index}]`;
    exact(
      field,
      [
        "id",
        "key",
        "type",
        "format",
        "label",
        "required",
        "defaultValue",
        "children",
        "reference",
        "formula",
      ],
      here,
    );
    if (field.format !== undefined) string(field.format, `${here}.format`);
    if (field.id !== undefined) string(field.id, `${here}.id`);
    if (field.formula !== undefined) {
      // ADR-291 — a computed field: its definition is checked when the engine is loaded (the
      // data sink loads it before writing one); a read before that keeps the shape check.
      string(field.formula, `${here}.formula`);
      const runtime = formulaRuntimeSync();
      if (runtime) {
        const problem = runtime.definitionError(
          runtime.engine,
          field as unknown as ComputedSchemaField & { formula: string },
          value as readonly ComputedSchemaField[],
        );
        if (problem) invalid(problem.code, `${here}.formula`);
      }
    }
    string(field.key, `${here}.key`);
    if (field.type !== undefined) string(field.type, `${here}.type`);
    if (field.label !== undefined) text(field.label, `${here}.label`);
    if (field.required !== undefined)
      boolean(field.required, `${here}.required`);
    if (field.defaultValue !== undefined)
      jsonValue(field.defaultValue, `${here}.defaultValue`);
    if (field.children !== undefined)
      dataFields(field.children, `${here}.children`, depth + 1);
    if (field.reference !== undefined) {
      const reference = object(field.reference, `${here}.reference`);
      exact(reference, ["collectionId", "keyField"], `${here}.reference`);
      string(reference.collectionId, `${here}.reference.collectionId`);
      string(reference.keyField, `${here}.reference.keyField`);
    }
  });
  const runtime = formulaRuntimeSync();
  if (
    runtime &&
    value.some((item) => (item as { formula?: unknown }).formula !== undefined)
  ) {
    const loop = runtime.cycleError(
      runtime.engine,
      value as readonly ComputedSchemaField[],
    );
    if (loop) invalid(loop.code, at);
  }
}
const ASSET_URL = /^asset:sha256-[0-9a-f]{64}$/;
function assetUrl(value: unknown, at: string): void {
  if (typeof value !== "string" || !ASSET_URL.test(value))
    invalid("INVALID_ASSET_REF", at);
}
/**
 * ADR-286 Decision 5 — the site settings. `access` has no secret field (R6): the key sets are
 * closed, so a password · client secret · certificate never enters the document.
 */
function siteSettings(value: unknown, at: string): void {
  const site = object(value, at);
  exact(
    site,
    [
      "title",
      "description",
      "lang",
      "favicon",
      "appIcon",
      "appName",
      "themeColor",
      "socialImage",
      "search",
      "redirects",
      "access",
    ],
    at,
  );
  for (const key of ["title", "description", "appName"] as const)
    if (site[key] !== undefined) text(site[key], `${at}.${key}`);
  if (
    site.themeColor !== undefined &&
    !/^#[0-9a-f]{6}$/i.test(string(site.themeColor, `${at}.themeColor`))
  )
    invalid("INVALID_THEME_COLOR", `${at}.themeColor`);
  if (site.appIcon !== undefined) assetUrl(site.appIcon, `${at}.appIcon`);
  if (site.lang !== undefined) {
    const lang = string(site.lang, `${at}.lang`);
    if (!/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(lang))
      invalid("INVALID_LANG", `${at}.lang`);
  }
  if (site.favicon !== undefined) {
    const favicon = object(site.favicon, `${at}.favicon`);
    exact(favicon, ["light", "dark"], `${at}.favicon`);
    for (const key of ["light", "dark"] as const)
      if (favicon[key] !== undefined)
        assetUrl(favicon[key], `${at}.favicon.${key}`);
  }
  if (site.socialImage !== undefined)
    assetUrl(site.socialImage, `${at}.socialImage`);
  if (site.search !== undefined) {
    const search = object(site.search, `${at}.search`);
    exact(search, ["index", "sitemap", "robots"], `${at}.search`);
    boolean(search.index, `${at}.search.index`);
    boolean(search.sitemap, `${at}.search.sitemap`);
    if (search.robots !== "allow" && search.robots !== "none")
      invalid("INVALID_ROBOTS", `${at}.search.robots`);
  }
  if (site.redirects !== undefined) {
    if (!Array.isArray(site.redirects))
      invalid("ARRAY_REQUIRED", `${at}.redirects`);
    site.redirects.forEach((item, index) => {
      const here = `${at}.redirects[${index}]`;
      const redirect = object(item, here);
      exact(redirect, ["from", "to", "permanent"], here);
      const from = string(redirect.from, `${here}.from`);
      if (!from.startsWith("/")) invalid("INVALID_REDIRECT", `${here}.from`);
      string(redirect.to, `${here}.to`);
      boolean(redirect.permanent, `${here}.permanent`);
    });
  }
  if (site.access !== undefined) {
    const access = object(site.access, `${at}.access`);
    if (access.kind === "none") exact(access, ["kind"], `${at}.access`);
    else if (access.kind === "password") {
      exact(access, ["kind", "hint"], `${at}.access`);
      if (access.hint !== undefined) text(access.hint, `${at}.access.hint`);
    } else if (access.kind === "sso") {
      exact(
        access,
        [
          "kind",
          "protocol",
          "issuer",
          "metadataUrl",
          "clientId",
          "protectedPageIds",
        ],
        `${at}.access`,
      );
      if (access.protocol !== "saml" && access.protocol !== "oidc")
        invalid("INVALID_SSO_PROTOCOL", `${at}.access.protocol`);
      string(access.issuer, `${at}.access.issuer`);
      for (const key of ["metadataUrl", "clientId"] as const)
        if (access[key] !== undefined)
          string(access[key], `${at}.access.${key}`);
      if (access.protectedPageIds !== "all")
        list(
          access.protectedPageIds,
          "project:page:",
          `${at}.access.protectedPageIds`,
        );
    } else invalid("INVALID_SITE_ACCESS", `${at}.access.kind`);
  }
}
/** ADR-286 Decision 6 — a page's own settings. */
function pageMeta(value: unknown, at: string): void {
  const meta = object(value, at);
  exact(meta, ["title", "description", "socialImage", "hidden"], at);
  for (const key of ["title", "description"] as const)
    if (meta[key] !== undefined) text(meta[key], `${at}.${key}`);
  if (meta.socialImage !== undefined)
    assetUrl(meta.socialImage, `${at}.socialImage`);
  if (meta.hidden !== undefined) {
    const hidden = object(meta.hidden, `${at}.hidden`);
    exact(hidden, ["search", "sitemap"], `${at}.hidden`);
    for (const key of ["search", "sitemap"] as const)
      if (hidden[key] !== undefined)
        boolean(hidden[key], `${at}.hidden.${key}`);
  }
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
  // ADR-256 Phase 9 · S2 formatOptions: a prop's typed object — a calendar duration or a number
  // format (the accepts check is the graph's).
  if (allowStructured && !("kind" in value)) {
    if (!catalogCalendarDurationFits(value) && !catalogNumberFormatFits(value))
      invalid("INVALID_OBJECT_VALUE", at);
    return;
  }
  const ref = object(value, at);
  if (ref.kind === "when") return propWhen(ref, at);
  if (ref.kind === "var") {
    exact(ref, ["kind", "ref"], at);
    if (typeof ref.ref !== "string" || !/^!var\.[^.]+/.test(ref.ref))
      invalid("WHEN_SUBJECT_VARIABLE", `${at}.ref`);
    return;
  }
  exact(ref, ["kind", "tokenId"], at);
  if (ref.kind !== "token") invalid("UNKNOWN_VALUE_KIND", at);
  id(ref.tokenId, "", `${at}.tokenId`);
  if (
    !(ref.tokenId as string).startsWith("lib:token:") &&
    !(ref.tokenId as string).startsWith("project:token:")
  )
    invalid("TOKEN_ID_REQUIRED", at);
}
/**
 * ADR-284 Phase 6 — a prop's value condition: a variable subject (`!var.<id>[.path]`), a closed
 * comparison, and its value as a view condition's (a literal · a list · a reference).
 */
function propWhen(node: Record<string, unknown>, at: string): void {
  exact(node, ["kind", "subject", "op", "value"], at);
  if (typeof node.subject !== "string" || !/^!var\.[^.]+/.test(node.subject))
    invalid("WHEN_SUBJECT_VARIABLE", `${at}.subject`);
  const op = node.op as string;
  if (!VIEW_COMPARISONS.includes(op as never))
    invalid("UNKNOWN_COMPARISON", `${at}.op`);
  const isRef = typeof node.value === "string" && node.value.startsWith("!");
  if (VIEW_NO_VALUE_COMPARISONS.has(op)) {
    if (node.value !== undefined)
      invalid("COMPARISON_VALUE_NOT_ALLOWED", `${at}.value`);
  } else if (node.value === undefined)
    invalid("COMPARISON_VALUE_REQUIRED", `${at}.value`);
  else if (Array.isArray(node.value)) {
    if (!VIEW_LIST_COMPARISONS.has(op) && op !== "between")
      invalid("SCALAR_REQUIRED", `${at}.value`);
    node.value.forEach((item, index) => scalar(item, `${at}.value[${index}]`));
  } else {
    if (VIEW_LIST_COMPARISONS.has(op) && !isRef)
      invalid("COMPARISON_LIST_REQUIRED", `${at}.value`);
    scalar(node.value, `${at}.value`);
  }
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
/** Code catalog rule layout values (the Header rule · a standalone ListBox's section header are sticky — ADR-267). */
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
    // (A derived variant prop — never authored, so no `accepts` entry: `derivedVariantProps.ts`.)
    if (!accepted || CATALOG_DERIVED_VARIANT_PROPS.has(prop)) continue;
    if (!accepted[prop])
      invalid("CONDITION_PROP_NOT_ACCEPTED", `${at}.${prop}`);
    if (typeof item !== accepted[prop])
      invalid("CONDITION_PROP_TYPE", `${at}.${prop}`);
    const allowed = choices?.[prop];
    if (Array.isArray(allowed) && !allowed.includes(item))
      invalid("CONDITION_PROP_CHOICE", `${at}.${prop}`);
  }
}
/** A rule's `layoutTokens` (`LayoutTokenUses`): a token use per layout length key it states. */
function layoutTokenUses(rule: Record<string, unknown>, at: string): void {
  if (rule.layoutTokens === undefined) return;
  for (const [key, use] of Object.entries(
    object(rule.layoutTokens, `${at}.layoutTokens`),
  )) {
    const token = object(use, `${at}.layoutTokens.${key}`);
    exact(token, ["kind", "tokenId"], `${at}.layoutTokens.${key}`);
    if (
      !/^(margin(Left|Right|Top|Bottom)|max(Width|Height))$/.test(key) ||
      token.kind !== "token" ||
      typeof (rule.layout as Record<string, unknown> | undefined)?.[key] !==
        "string"
    )
      invalid("INVALID_LAYOUT_VALUE", `${at}.layoutTokens.${key}`);
    string(token.tokenId, `${at}.layoutTokens.${key}.tokenId`);
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
const DESCENDANT_PATCH_FIELDS = [
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
  "displayState",
  "interactions",
] as const;
/** A `patch`'s (or a `fillSlot`'s own) field writes; true when it holds one. */
function descendantPatchFields(
  item: Record<string, unknown>,
  at: string,
): boolean {
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
  if (
    item.displayState !== undefined &&
    !DISPLAY_STATE_NAMES.includes(item.displayState as DisplayStateName)
  )
    invalid("DISPLAY_STATE_UNKNOWN", `${at}.displayState`);
  if (item.interactions !== undefined) {
    // ADR-281 Decision 4 — origin rule → "off" | this instance's rule (both interaction ids).
    const map = object(item.interactions, `${at}.interactions`);
    for (const [key, value] of Object.entries(map)) {
      id(key, "project:interaction:", `${at}.interactions`);
      if (value !== "off")
        id(value, "project:interaction:", `${at}.interactions.${key}`);
    }
  }
  if (item.props !== undefined) writes(item.props, `${at}.props`);
  if (item.visual !== undefined)
    writes(item.visual, `${at}.visual`, visualFields);
  if (item.sizing !== undefined)
    writes(item.sizing, `${at}.sizing`, sizingFields, true);
  if (item.stateRules !== undefined)
    stateRules(item.stateRules, `${at}.stateRules`);
  return DESCENDANT_PATCH_FIELDS.some((field) => item[field] !== undefined);
}
function descendant(value: unknown, at: string): void {
  const item = object(value, at);
  if (item.kind === "patch") {
    exact(item, ["kind", "address", ...DESCENDANT_PATCH_FIELDS], at);
    address(item.address, `${at}.address`);
    if (!descendantPatchFields(item, at)) invalid("EMPTY_PATCH", at);
  } else if (item.kind === "replace") {
    exact(item, ["kind", "address", "replacementId"], at);
    address(item.address, `${at}.address`);
    id(item.replacementId, "project:node:", `${at}.replacementId`);
  } else if (item.kind === "fillSlot") {
    exact(
      item,
      ["kind", "address", "childIds", ...DESCENDANT_PATCH_FIELDS],
      at,
    );
    address(item.address, `${at}.address`);
    list(item.childIds, "project:node:", `${at}.childIds`);
    descendantPatchFields(item, at);
  } else invalid("UNKNOWN_OVERRIDE_KIND", at);
}
function binding(value: unknown, at: string): void {
  const item = object(value, at);
  exact(item, ["collectionId", "fieldMap", "key", "viewId", "view"], at);
  id(item.collectionId, "data:collection:", `${at}.collectionId`);
  if (item.key !== undefined) string(item.key, `${at}.key`);
  // ADR-284 Decision 1 — a shared view, or the binding's own (built-in) view: never both. A
  // built-in view filters · sorts its list; grouping · aggregates are a derived (shared) view's.
  if (item.viewId !== undefined)
    id(item.viewId, "project:view:", `${at}.viewId`);
  if (item.view !== undefined) {
    if (item.viewId !== undefined) invalid("VIEW_AND_VIEW_ID", `${at}.view`);
    const query = viewQuery(item.view, `${at}.view`, []);
    if (
      query.groupBy !== undefined ||
      query.aggregates !== undefined ||
      query.emptyGroups !== undefined
    )
      invalid("VIEW_AGGREGATE_DERIVED_ONLY", `${at}.view`);
  }
  for (const [key, value] of Object.entries(
    object(item.fieldMap, `${at}.fieldMap`),
  )) {
    if (!key) invalid("INVALID_FIELD_MAP", at);
    id(value, "data:field:", `${at}.fieldMap.${key}`);
  }
}
const VIEW_LIST_COMPARISONS = new Set(["oneOf", "containsAny", "containsAll"]);
const VIEW_NO_VALUE_COMPARISONS = new Set(["exists", "notExists"]);
/** ADR-284 — field ids through reference fields (`[teamId, name]`). */
function dataFieldPath(value: unknown, at: string): void {
  if (!Array.isArray(value) || value.length === 0)
    invalid("FIELD_PATH_REQUIRED", at);
  value.forEach((field, index) => id(field, "data:field:", `${at}[${index}]`));
}
/**
 * ADR-284 — a view's query: the condition tree (ids unique in the view, an `or` group never
 * empty), the comparison × value shape (a list for `oneOf` · `containsAny` · `containsAll`, two
 * ends for `between`, none for `exists` · `notExists`, a unit for `withinLast` — a value may be a
 * reference string), grouping, aggregates (`as` unique) and the sort. Field types × comparisons
 * are the data's (the schema lives outside the document) — the panel and the run check them.
 */
function viewQuery(
  value: unknown,
  at: string,
  extra: readonly string[],
): Record<string, unknown> {
  const item = object(value, at);
  exact(
    item,
    ["where", "groupBy", "emptyGroups", "aggregates", "sort", ...extra],
    at,
  );
  const ids = new Set<string>();
  const unique = (raw: unknown, path: string) => {
    const text = string(raw, path);
    if (ids.has(text)) invalid("DUPLICATE_CONDITION_ID", path);
    ids.add(text);
  };
  const conditionValue = (raw: unknown, path: string) => {
    if (Array.isArray(raw))
      raw.forEach((cell, index) => scalar(cell, `${path}[${index}]`));
    else scalar(raw, path);
  };
  const group = (raw: unknown, path: string): void => {
    const node = object(raw, path);
    exact(node, ["id", "op", "items"], path);
    unique(node.id, `${path}.id`);
    if (node.op !== "and" && node.op !== "or")
      invalid("INVALID_GROUP_OP", `${path}.op`);
    if (!Array.isArray(node.items)) invalid("ARRAY_REQUIRED", `${path}.items`);
    if (node.op === "or" && node.items.length === 0)
      invalid("EMPTY_OR_GROUP", `${path}.items`);
    node.items.forEach((child, index) => {
      const childAt = `${path}.items[${index}]`;
      if (object(child, childAt).items !== undefined) group(child, childAt);
      else condition(child, childAt);
    });
  };
  const condition = (raw: unknown, path: string): void => {
    const node = object(raw, path);
    exact(
      node,
      ["id", "fields", "op", "value", "skip", "enabled", "sensitivity", "unit"],
      path,
    );
    unique(node.id, `${path}.id`);
    if (!Array.isArray(node.fields) || node.fields.length === 0)
      invalid("FIELDS_REQUIRED", `${path}.fields`);
    node.fields.forEach((field, index) =>
      dataFieldPath(field, `${path}.fields[${index}]`),
    );
    const op = node.op as string;
    if (!VIEW_COMPARISONS.includes(op as never))
      invalid("UNKNOWN_COMPARISON", `${path}.op`);
    const isRef = typeof node.value === "string" && node.value.startsWith("!");
    if (VIEW_NO_VALUE_COMPARISONS.has(op)) {
      if (node.value !== undefined)
        invalid("COMPARISON_VALUE_NOT_ALLOWED", `${path}.value`);
    } else if (node.value === undefined)
      invalid("COMPARISON_VALUE_REQUIRED", `${path}.value`);
    else if (VIEW_LIST_COMPARISONS.has(op)) {
      if (!isRef && !Array.isArray(node.value))
        invalid("COMPARISON_LIST_REQUIRED", `${path}.value`);
      conditionValue(node.value, `${path}.value`);
    } else if (op === "between") {
      if (!isRef && (!Array.isArray(node.value) || node.value.length !== 2))
        invalid("COMPARISON_RANGE_REQUIRED", `${path}.value`);
      conditionValue(node.value, `${path}.value`);
    } else if (Array.isArray(node.value))
      invalid("SCALAR_REQUIRED", `${path}.value`);
    else scalar(node.value, `${path}.value`);
    if (op === "withinLast") {
      if (!["day", "week", "month", "year"].includes(node.unit as string))
        invalid("COMPARISON_UNIT_REQUIRED", `${path}.unit`);
    } else if (node.unit !== undefined)
      invalid("COMPARISON_UNIT_NOT_ALLOWED", `${path}.unit`);
    if (node.skip !== undefined && node.skip !== "empty")
      scalar(node.skip, `${path}.skip`);
    if (node.enabled !== undefined) {
      scalar(node.enabled, `${path}.enabled`);
      if (
        typeof node.enabled !== "boolean" &&
        !(typeof node.enabled === "string" && node.enabled.startsWith("!"))
      )
        invalid("CONDITION_ENABLED_BOOLEAN", `${path}.enabled`);
    }
    if (
      node.sensitivity !== undefined &&
      !["base", "accent", "case", "variant"].includes(
        node.sensitivity as string,
      )
    )
      invalid("INVALID_SENSITIVITY", `${path}.sensitivity`);
  };
  group(item.where, `${at}.where`);
  if (item.groupBy !== undefined) {
    if (!Array.isArray(item.groupBy) || item.groupBy.length === 0)
      invalid("GROUP_BY_REQUIRED", `${at}.groupBy`);
    item.groupBy.forEach((field, index) =>
      dataFieldPath(field, `${at}.groupBy[${index}]`),
    );
  }
  if (item.emptyGroups !== undefined) {
    if (item.emptyGroups !== "all")
      invalid("INVALID_EMPTY_GROUPS", `${at}.emptyGroups`);
    if (item.groupBy === undefined)
      invalid("GROUP_BY_REQUIRED", `${at}.groupBy`);
  }
  if (item.aggregates !== undefined) {
    if (!Array.isArray(item.aggregates) || item.aggregates.length === 0)
      invalid("AGGREGATES_REQUIRED", `${at}.aggregates`);
    const names = new Set<string>();
    item.aggregates.forEach((raw, index) => {
      const path = `${at}.aggregates[${index}]`;
      const aggregate = object(raw, path);
      exact(aggregate, ["fn", "field", "as"], path);
      if (
        !["count", "sum", "mean", "min", "max", "applied"].includes(
          aggregate.fn as string,
        )
      )
        invalid("UNKNOWN_AGGREGATE", `${path}.fn`);
      if (aggregate.fn === "applied" && aggregate.field !== undefined)
        invalid("AGGREGATE_FIELD_NOT_ALLOWED", `${path}.field`);
      else if (aggregate.field !== undefined)
        dataFieldPath(aggregate.field, `${path}.field`);
      else if (aggregate.fn !== "count" && aggregate.fn !== "applied")
        invalid("AGGREGATE_FIELD_REQUIRED", `${path}.field`);
      const name = string(aggregate.as, `${path}.as`);
      if (names.has(name)) invalid("DUPLICATE_AGGREGATE_NAME", `${path}.as`);
      names.add(name);
    });
  }
  if (item.sort !== undefined) {
    const sort = object(item.sort, `${at}.sort`);
    if (sort.variableId !== undefined) {
      exact(sort, ["variableId"], `${at}.sort`);
      const variableId = id(sort.variableId, "", `${at}.sort.variableId`);
      if (
        !variableId.startsWith("project:stateVariable:") &&
        !variableId.startsWith("data:variable:")
      )
        invalid("INVALID_VARIABLE_REF", `${at}.sort.variableId`);
    } else {
      exact(sort, ["field", "direction"], `${at}.sort`);
      dataFieldPath(sort.field, `${at}.sort.field`);
      if (sort.direction !== "ascending" && sort.direction !== "descending")
        invalid("INVALID_SORT_DIRECTION", `${at}.sort.direction`);
    }
  }
  return item;
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
  exact(
    layout,
    ["direction", "gap", "columns", "autoFitZoom", "breakpoints"],
    at,
  );
  if (
    layout.direction !== undefined &&
    !["auto", "vertical", "horizontal"].includes(layout.direction as string)
  )
    invalid("INVALID_PAGE_DIRECTION", `${at}.direction`);
  if (layout.gap !== undefined) nonnegative(layout.gap, `${at}.gap`);
  if (layout.columns !== undefined) columns(layout.columns, `${at}.columns`);
  // ADR-274: the auto columns' fit zoom (%) — the Settings range 10 ~ 100 (user decision 2).
  if (
    layout.autoFitZoom !== undefined &&
    (typeof layout.autoFitZoom !== "number" ||
      !Number.isFinite(layout.autoFitZoom) ||
      layout.autoFitZoom < 10 ||
      layout.autoFitZoom > 100)
  )
    invalid("INVALID_AUTO_FIT_ZOOM", `${at}.autoFitZoom`);
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
  id(item.id, DATA_ENTRY_PREFIX[kind] ?? `project:${kind}:`, "entry.id");
  switch (kind) {
    case "project":
      exact(
        item,
        [
          "kind",
          "id",
          "name",
          "pageIds",
          "componentPageIds",
          "definitionIds",
          "overrideIds",
          "themeIds",
          "tokenIds",
          "stateVariableIds",
          "interactionIds",
          "assetIds",
          "viewIds",
          "collectionIds",
          "endpointIds",
          "projectVariableIds",
          "site",
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
      if (item.viewIds !== undefined)
        list(item.viewIds, "project:view:", "entry.viewIds");
      for (const [key, prefix] of [
        ["collectionIds", "data:collection:"],
        ["endpointIds", "data:endpoint:"],
        ["projectVariableIds", "data:variable:"],
      ] as const)
        if (item[key] !== undefined) list(item[key], prefix, `entry.${key}`);
      if (item.site !== undefined) siteSettings(item.site, "entry.site");
      if (item.componentPageIds !== undefined)
        list(item.componentPageIds, "project:page:", "entry.componentPageIds");
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
          "meta",
        ],
        "entry",
      );
      if (item.meta !== undefined) pageMeta(item.meta, "entry.meta");
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
          "properties",
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
      if (item.properties !== undefined) {
        // ADR-261 Decision 4: a component's properties (a composite component, not a layout).
        if (item.mode !== "composite" || item.usage === "layout")
          invalid("PROPERTIES_NOT_COMPONENT", "entry.properties");
        componentProperties(item.properties, "entry.properties");
      }
      break;
    case "definitionOverride":
      exact(
        item,
        [
          "kind",
          "id",
          "targetId",
          "defaults",
          "visual",
          "stateRules",
          "templateRootId",
          "templateMap",
        ],
        "entry",
      );
      id(item.targetId, "lib:definition:", "entry.targetId");
      writes(item.defaults, "entry.defaults");
      writes(item.visual, "entry.visual", visualFields);
      stateRules(item.stateRules, "entry.stateRules");
      // ADR-282: an unlocked origin's template copy and its library → copy map, together.
      if (
        (item.templateRootId === undefined) !==
        (item.templateMap === undefined)
      )
        invalid("INVALID_ORIGIN_TEMPLATE_ROOT", "entry.templateRootId");
      if (item.templateRootId !== undefined) {
        id(item.templateRootId, "project:node:", "entry.templateRootId");
        const map = object(item.templateMap, "entry.templateMap");
        for (const [key, value] of Object.entries(map)) {
          id(key, "lib:template:", "entry.templateMap");
          id(value, "project:node:", `entry.templateMap.${key}`);
        }
      }
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
          "displayState",
          "originOf",
        ],
        "entry",
      );
      presentWhen(item.presentWhen, "entry.presentWhen");
      if (
        item.originOf !== undefined &&
        !/^(lib|project):definition:[A-Za-z0-9][A-Za-z0-9_-]*$/.test(
          String(item.originOf),
        )
      )
        invalid("INVALID_ID", "entry.originOf");
      showWhen(item.showWhen, "entry.showWhen");
      if (
        item.displayState !== undefined &&
        !DISPLAY_STATE_NAMES.includes(item.displayState as DisplayStateName)
      )
        invalid("DISPLAY_STATE_UNKNOWN", "entry.displayState");
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
        exact(slot, ["name", "required", "suggested"], "entry.slot");
        string(slot.name, "entry.slot.name");
        if (typeof slot.required !== "boolean")
          invalid("SLOT_REQUIRED_BOOLEAN", "entry.slot.required");
        // ADR-261 Decision 3: suggested components — definition ids, each once.
        if (slot.suggested !== undefined) {
          if (!Array.isArray(slot.suggested))
            invalid("ARRAY_REQUIRED", "entry.slot.suggested");
          const seen = new Set<string>();
          for (const [index, id] of (slot.suggested as unknown[]).entries()) {
            const at = `entry.slot.suggested[${index}]`;
            const value = string(id, at);
            if (
              !value.startsWith("project:definition:") &&
              !value.startsWith("lib:definition:")
            )
              invalid("DEFINITION_ID_REQUIRED", at);
            if (seen.has(value)) invalid("DUPLICATE_SUGGESTION", at);
            seen.add(value);
          }
        }
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
        [
          "kind",
          "id",
          "ownerId",
          "name",
          "valueType",
          "defaultValue",
          "source",
          "input",
        ],
        "entry",
      );
      const owner = id(item.ownerId, "", "entry.ownerId");
      // ADR-294 — a component's input variable (owned by a template root — the graph checks).
      if (item.input !== undefined) {
        const input = object(item.input, "entry.input");
        exact(input, ["propertyKey"], "entry.input");
        const key = string(input.propertyKey, "entry.input.propertyKey");
        if (!COMPONENT_PROPERTY_KEY.test(key))
          invalid("INVALID_PROPERTY_KEY", "entry.input.propertyKey");
        if (item.source !== undefined || !owner.startsWith("project:node:"))
          invalid("INVALID_OWNER", "entry.ownerId");
      }
      if (
        !owner.startsWith("project:page:") &&
        !owner.startsWith("project:node:")
      )
        invalid("INVALID_OWNER", "entry.ownerId");
      string(item.name, "entry.name");
      if (item.source !== undefined) {
        // A named RAC state: page-owned, observing a node; keys are its one array kind.
        const source = object(item.source, "entry.source");
        exact(source, ["nodeId", "prop"], "entry.source");
        id(source.nodeId, "project:node:", "entry.source.nodeId");
        string(source.prop, "entry.source.prop");
        if (!owner.startsWith("project:page:"))
          invalid("INVALID_OWNER", "entry.ownerId");
        if (item.valueType === "string[]") {
          if (
            !Array.isArray(item.defaultValue) ||
            item.defaultValue.some((key: unknown) => typeof key !== "string")
          )
            invalid("DEFAULT_VALUE_TYPE", "entry.defaultValue");
          break;
        }
      }
      // (A structured variable starts empty — `""`, a rule's reference fills it — or with a JSON
      //   value of its type, 2026-10-29.)
      if (item.valueType === "object" || item.valueType === "array") {
        const value = item.defaultValue;
        if (value !== "") {
          if (
            typeof value !== "object" ||
            value === null ||
            Array.isArray(value) !== (item.valueType === "array")
          )
            invalid("DEFAULT_VALUE_TYPE", "entry.defaultValue");
          else jsonValue(value, "entry.defaultValue");
        }
        break;
      }
      // (A date is an ISO text in RAC's shapes, or `""` — `state/dateValue.ts`.)
      if (item.valueType === "date") {
        if (!isDateValueText(item.defaultValue))
          invalid("DEFAULT_VALUE_TYPE", "entry.defaultValue");
        break;
      }
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
        ["kind", "id", "ownerId", "address", "trigger", "actions"],
        "entry",
      );
      id(item.ownerId, "project:node:", "entry.ownerId");
      if (item.address !== undefined) address(item.address, "entry.address");
      string(item.trigger, "entry.trigger");
      // ADR-284 Decision 8 — the Do list (one action = a list of one).
      if (!Array.isArray(item.actions) || item.actions.length === 0)
        invalid("ACTIONS_REQUIRED", "entry.actions");
      // (A toast's `onAction` holds its own Dos — S2 `ToastOptions.onAction` — checked the same way.)
      const validateAction = (raw: unknown, at: string): void => {
        const action = object(raw, at);
        if (action.opcode === "setState") {
          exact(action, ["opcode", "variableId", "op", "value"], `${at}`);
          const variableId = id(action.variableId, "", `${at}.variableId`);
          if (
            !variableId.startsWith("project:stateVariable:") &&
            !variableId.startsWith("data:variable:")
          )
            invalid("INVALID_VARIABLE_REF", `${at}.variableId`);
          if (
            !["set", "toggle", "increment", "reset"].includes(
              action.op as string,
            )
          )
            invalid("INVALID_STATE_OP", `${at}.op`);
          if (action.op === "set") scalar(action.value, `${at}.value`);
          if (
            action.op === "increment" &&
            action.value !== undefined &&
            (typeof action.value !== "number" || !Number.isFinite(action.value))
          )
            invalid("STATE_INCREMENT_NUMBER", `${at}.value`);
          if (action.op === "reset" && action.value !== undefined)
            invalid("STATE_VALUE_NOT_ALLOWED", `${at}.value`);
          // (ADR-284 Phase 6 — a toggle's value: the text a text variable toggles to.)
          if (
            action.op === "toggle" &&
            action.value !== undefined &&
            typeof action.value !== "string"
          )
            invalid("STATE_TOGGLE_TEXT", `${at}.value`);
        } else if (action.opcode === "navigate") {
          exact(action, ["opcode", "pageId"], `${at}`);
          id(action.pageId, "project:page:", `${at}.pageId`);
        } else if (action.opcode === "callEndpoint") {
          exact(action, ["opcode", "endpointId", "body"], `${at}`);
          id(action.endpointId, "data:endpoint:", `${at}.endpointId`);
          // (`scalar` refuses `undefined` — a rule without a body is the shape stored before, ADR-281.)
          if (action.body !== undefined) scalar(action.body, `${at}.body`);
        } else if (action.opcode === "append") {
          exact(
            action,
            ["opcode", "collectionId", "value", "parentKey"],
            `${at}`,
          );
          id(action.collectionId, "data:collection:", `${at}.collectionId`);
          if (action.value !== undefined) scalar(action.value, `${at}.value`);
          if (action.parentKey !== undefined)
            scalar(action.parentKey, `${at}.parentKey`);
        } else if (action.opcode === "update") {
          exact(
            action,
            ["opcode", "collectionId", "key", "value", "field"],
            `${at}`,
          );
          id(action.collectionId, "data:collection:", `${at}.collectionId`);
          if (action.key !== undefined) scalar(action.key, `${at}.key`);
          if (action.value !== undefined) scalar(action.value, `${at}.value`);
          if (action.field !== undefined)
            id(action.field, "data:field:", `${at}.field`);
        } else if (action.opcode === "insert") {
          exact(
            action,
            ["opcode", "collectionId", "index", "value", "parentKey"],
            `${at}`,
          );
          id(action.collectionId, "data:collection:", `${at}.collectionId`);
          if (action.index !== undefined) scalar(action.index, `${at}.index`);
          if (action.value !== undefined) scalar(action.value, `${at}.value`);
          if (action.parentKey !== undefined)
            scalar(action.parentKey, `${at}.parentKey`);
        } else if (
          action.opcode === "insertBefore" ||
          action.opcode === "insertAfter"
        ) {
          exact(action, ["opcode", "collectionId", "key", "value"], `${at}`);
          id(action.collectionId, "data:collection:", `${at}.collectionId`);
          if (action.key !== undefined) scalar(action.key, `${at}.key`);
          if (action.value !== undefined) scalar(action.value, `${at}.value`);
        } else if (action.opcode === "prepend") {
          exact(
            action,
            ["opcode", "collectionId", "value", "parentKey"],
            `${at}`,
          );
          id(action.collectionId, "data:collection:", `${at}.collectionId`);
          if (action.value !== undefined) scalar(action.value, `${at}.value`);
          if (action.parentKey !== undefined)
            scalar(action.parentKey, `${at}.parentKey`);
        } else if (action.opcode === "move") {
          exact(
            action,
            ["opcode", "collectionId", "key", "toIndex", "toParentKey"],
            `${at}`,
          );
          id(action.collectionId, "data:collection:", `${at}.collectionId`);
          if (action.key !== undefined) scalar(action.key, `${at}.key`);
          if (action.toIndex !== undefined)
            scalar(action.toIndex, `${at}.toIndex`);
          if (action.toParentKey !== undefined)
            scalar(action.toParentKey, `${at}.toParentKey`);
        } else if (
          action.opcode === "moveBefore" ||
          action.opcode === "moveAfter"
        ) {
          exact(
            action,
            ["opcode", "collectionId", "key", "keys", "dropPosition"],
            `${at}`,
          );
          id(action.collectionId, "data:collection:", `${at}.collectionId`);
          if (action.key !== undefined) scalar(action.key, `${at}.key`);
          if (action.keys !== undefined) scalar(action.keys, `${at}.keys`);
          if (action.dropPosition !== undefined)
            scalar(action.dropPosition, `${at}.dropPosition`);
        } else if (
          action.opcode === "reload" ||
          action.opcode === "loadMore" ||
          action.opcode === "removeSelectedItems"
        ) {
          exact(action, ["opcode", "collectionId"], `${at}`);
          id(action.collectionId, "data:collection:", `${at}.collectionId`);
        } else if (action.opcode === "setFilterText") {
          exact(action, ["opcode", "collectionId", "value"], `${at}`);
          id(action.collectionId, "data:collection:", `${at}.collectionId`);
          if (action.value !== undefined) scalar(action.value, `${at}.value`);
        } else if (action.opcode === "remove") {
          exact(action, ["opcode", "collectionId", "keys"], `${at}`);
          id(action.collectionId, "data:collection:", `${at}.collectionId`);
          if (action.keys !== undefined) scalar(action.keys, `${at}.keys`);
        } else if (action.opcode === "toast") {
          exact(
            action,
            [
              "opcode",
              "message",
              "variant",
              "timeout",
              "actionLabel",
              "shouldCloseOnAction",
              "onAction",
            ],
            `${at}`,
          );
          string(action.message, `${at}.message`);
          // S2: the action button needs its label; `onAction` · `shouldCloseOnAction` go with it.
          if (action.actionLabel !== undefined)
            string(action.actionLabel, `${at}.actionLabel`);
          else if (
            action.onAction !== undefined ||
            action.shouldCloseOnAction !== undefined
          )
            invalid("TOAST_ACTION_LABEL_REQUIRED", `${at}.actionLabel`);
          // (S2 `addToast`: an actionable toast is never auto dismissed — WCAG 2.2.1.)
          if (action.actionLabel !== undefined && action.timeout !== undefined)
            invalid("INVALID_TOAST_TIMEOUT", `${at}.timeout`);
          if (action.shouldCloseOnAction !== undefined)
            boolean(action.shouldCloseOnAction, `${at}.shouldCloseOnAction`);
          if (action.onAction !== undefined) {
            if (!Array.isArray(action.onAction) || action.onAction.length === 0)
              invalid("ACTIONS_REQUIRED", `${at}.onAction`);
            for (const [index, nested] of (
              action.onAction as unknown[]
            ).entries())
              validateAction(nested, `${at}.onAction[${index}]`);
          }
          if (
            action.variant !== undefined &&
            !CATALOG_TOAST_VARIANTS.includes(
              action.variant as CatalogToastVariant,
            )
          )
            invalid("INVALID_TOAST_VARIANT", `${at}.variant`);
          if (
            action.timeout !== undefined &&
            !(
              typeof action.timeout === "number" &&
              Number.isInteger(action.timeout) &&
              action.timeout > 0
            )
          )
            invalid("INVALID_TOAST_TIMEOUT", `${at}.timeout`);
        } else if (action.opcode === "emit") {
          exact(action, ["opcode", "propertyKey", "value"], `${at}`);
          const key = string(action.propertyKey, `${at}.propertyKey`);
          if (!COMPONENT_PROPERTY_KEY.test(key))
            invalid("INVALID_PROPERTY_KEY", `${at}.propertyKey`);
          if (action.value !== undefined) scalar(action.value, `${at}.value`);
        } else if (action.opcode === "capability") {
          exact(action, ["opcode", "target", "capabilityId", "value"], `${at}`);
          nodeRef(action.target, `${at}.target`, "TARGET_REF_SHAPE", true);
          string(action.capabilityId, `${at}.capabilityId`);
          if (action.value !== undefined) {
            if (Array.isArray(action.value))
              action.value.forEach((value, index) =>
                scalar(value, `${at}.value[${index}]`),
              );
            else scalar(action.value, `${at}.value`);
          }
        } else invalid("UNKNOWN_ACTION_OPCODE", `${at}.opcode`);
      };
      for (const [actionIndex, raw] of item.actions.entries())
        validateAction(raw, `entry.actions[${actionIndex}]`);
      break;
    }
    case "collection": {
      // ADR-286 Decision 1 — a collection's definition (rows the author wrote, never API rows).
      exact(
        item,
        [
          "kind",
          "id",
          "name",
          "description",
          "schema",
          "mockData",
          "useMockData",
          "executionPolicy",
        ],
        "entry",
      );
      string(item.name, "entry.name");
      if (item.description !== undefined)
        text(item.description, "entry.description");
      dataFields(item.schema, "entry.schema");
      if (!Array.isArray(item.mockData))
        invalid("ARRAY_REQUIRED", "entry.mockData");
      if (item.mockData.length > CATALOG_COLLECTION_ROW_LIMIT)
        invalid("COLLECTION_ROW_LIMIT", "entry.mockData");
      item.mockData.forEach((row, index) => {
        object(row, `entry.mockData[${index}]`);
        jsonValue(row, `entry.mockData[${index}]`);
      });
      boolean(item.useMockData, "entry.useMockData");
      if (item.executionPolicy !== undefined) {
        const policy = object(item.executionPolicy, "entry.executionPolicy");
        exact(policy, ["mode", "intervalSec"], "entry.executionPolicy");
        if (!["auto", "manual", "interval"].includes(policy.mode as string))
          invalid("INVALID_EXECUTION_POLICY", "entry.executionPolicy.mode");
        if (
          policy.intervalSec !== undefined &&
          (!Number.isInteger(policy.intervalSec) ||
            (policy.intervalSec as number) <= 0)
        )
          invalid(
            "INVALID_EXECUTION_POLICY",
            "entry.executionPolicy.intervalSec",
          );
      }
      break;
    }
    case "endpoint": {
      // ADR-286 Decision 1 — the request · response · server run (secret names only).
      exact(
        item,
        [
          "kind",
          "id",
          "name",
          "description",
          "method",
          "baseUrl",
          "path",
          "headers",
          "queryParams",
          "bodyType",
          "bodyTemplate",
          "responseMapping",
          "querySerialization",
          "targetCollectionId",
          "executionMode",
          "serverConfig",
          "timeout",
          "retryCount",
          "uploadDryRun",
        ],
        "entry",
      );
      string(item.name, "entry.name");
      if (item.description !== undefined)
        text(item.description, "entry.description");
      if (
        !["GET", "POST", "PUT", "DELETE", "PATCH"].includes(
          item.method as string,
        )
      )
        invalid("INVALID_METHOD", "entry.method");
      text(item.baseUrl, "entry.baseUrl");
      text(item.path, "entry.path");
      for (const key of ["headers", "queryParams"] as const) {
        if (!Array.isArray(item[key]))
          invalid("ARRAY_REQUIRED", `entry.${key}`);
        (item[key] as unknown[]).forEach((row, index) => {
          object(row, `entry.${key}[${index}]`);
          jsonValue(row, `entry.${key}[${index}]`);
        });
      }
      if (
        !["json", "form-data", "x-www-form-urlencoded", "none"].includes(
          item.bodyType as string,
        )
      )
        invalid("INVALID_BODY_TYPE", "entry.bodyType");
      if (item.bodyTemplate !== undefined)
        text(item.bodyTemplate, "entry.bodyTemplate");
      const mapping = object(item.responseMapping, "entry.responseMapping");
      text(mapping.dataPath, "entry.responseMapping.dataPath");
      jsonValue(mapping, "entry.responseMapping");
      for (const key of ["querySerialization", "serverConfig"] as const)
        if (item[key] !== undefined) {
          object(item[key], `entry.${key}`);
          jsonValue(item[key], `entry.${key}`);
        }
      if (item.targetCollectionId !== undefined)
        id(
          item.targetCollectionId,
          "data:collection:",
          "entry.targetCollectionId",
        );
      if (!["client", "server"].includes(item.executionMode as string))
        invalid("INVALID_EXECUTION_MODE", "entry.executionMode");
      for (const key of ["timeout", "retryCount"] as const)
        if (item[key] !== undefined) nonnegative(item[key], `entry.${key}`);
      if (item.uploadDryRun !== undefined)
        boolean(item.uploadDryRun, "entry.uploadDryRun");
      break;
    }
    case "projectVariable": {
      // ADR-286 Decision 1 · 사용자 결정 3 — a project variable (apart from page · node variables).
      exact(
        item,
        [
          "kind",
          "id",
          "name",
          "valueType",
          "defaultValue",
          "persist",
          "validation",
        ],
        "entry",
      );
      string(item.name, "entry.name");
      if (
        !["string", "number", "boolean", "date", "object", "array"].includes(
          item.valueType as string,
        )
      )
        invalid("INVALID_VALUE_TYPE", "entry.valueType");
      if (item.defaultValue !== undefined)
        jsonValue(item.defaultValue, "entry.defaultValue");
      if (
        item.valueType === "date" &&
        item.defaultValue !== undefined &&
        !isDateValueText(item.defaultValue)
      )
        invalid("DEFAULT_VALUE_TYPE", "entry.defaultValue");
      boolean(item.persist, "entry.persist");
      if (item.validation !== undefined) {
        object(item.validation, "entry.validation");
        jsonValue(item.validation, "entry.validation");
      }
      if (item.transform !== undefined) text(item.transform, "entry.transform");
      break;
    }
    case "view": {
      // ADR-284 Decision 1 — a shared view: a name, a source (a collection or another view).
      viewQuery(item, "entry", ["kind", "id", "name", "source"]);
      string(item.name, "entry.name");
      const source = object(item.source, "entry.source");
      if (source.viewId !== undefined) {
        exact(source, ["viewId"], "entry.source");
        id(source.viewId, "project:view:", "entry.source.viewId");
      } else {
        exact(source, ["collectionId"], "entry.source");
        id(
          source.collectionId,
          "data:collection:",
          "entry.source.collectionId",
        );
      }
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
      exact(rule, ["when", "state", "visual", "layout", "layoutTokens"], at);
      layoutTokenUses(rule, at);
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
      exact(
        rule,
        ["child", "when", "state", "visual", "layout", "layoutTokens"],
        at,
      );
      layoutTokenUses(rule, at);
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
  nodeRef(data.ancestor, `${at}.ancestor`, "STATE_OWNER_REF_SHAPE");
}
/**
 * ADR-283 Decision 1 — one stored place (`CatalogNodeRef`): exactly one of `nodeId` · `address` ·
 * `local`, shared by a state owner reference and a capability target. A capability target may
 * also be `{ unset: true }` (`allowUnset`).
 */
function nodeRef(
  value: unknown,
  at: string,
  code: string,
  allowUnset = false,
): void {
  const ref = object(value, at);
  const [form] = Object.keys(ref);
  if (Object.keys(ref).length !== 1) invalid(code, at);
  if (form === "nodeId") id(ref.nodeId, "project:node:", `${at}.nodeId`);
  else if (form === "address") address(ref.address, `${at}.address`);
  else if (form === "local") {
    const local = object(ref.local, `${at}.local`);
    exact(local, ["instances", "templatePath"], `${at}.local`);
    if (!Array.isArray(local.instances))
      invalid("ARRAY_REQUIRED", `${at}.local.instances`);
    if (!Array.isArray(local.templatePath) || local.templatePath.length === 0)
      invalid("TEMPLATE_PATH_REQUIRED", `${at}.local.templatePath`);
    for (const [index, item] of [
      ...local.instances,
      ...local.templatePath,
    ].entries()) {
      const text = id(item, "", `${at}.local[${index}]`);
      if (
        !text.startsWith("project:node:") &&
        !text.startsWith("lib:template:")
      )
        invalid("TEMPLATE_ID_REQUIRED", `${at}.local`);
    }
  } else if (form === "unset" && allowUnset) {
    if (ref.unset !== true) invalid(code, `${at}.unset`);
  } else invalid(code, at);
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
