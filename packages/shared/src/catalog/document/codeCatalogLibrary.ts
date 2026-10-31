import { LIBRARY_CONTRACT_VERSION } from "./types";
import { scalarFitsType } from "./valueType";
import {
  ICON_SIZE_TOKEN_REF,
  resolveToken,
  ruleSizeLengthRef,
  s2ControlPaddingY,
  type TokenRef,
} from "@composition/rendering";
import { componentCatalog } from "../componentCatalog";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { codeExecutionVocabulary } from "./executionVocabulary";
import { buildCatalogLibrary } from "./library";
import {
  applyManualBox,
  disabledStateRules,
  PROP_KIND_VALUE_TYPE,
  registeredCatalogTypes,
  ruleRootBox,
  ruleTypeDefinition,
} from "./ruleDefinition";
export { PROP_KIND_VALUE_TYPE } from "./ruleDefinition";
import { compileRulePartRules } from "./rulePartRules";
import {
  REUSABLE_ORIGIN_DEFINITIONS,
  REUSABLE_ORIGIN_TEMPLATES,
} from "./generated/reusableOriginLibrary";
import type { ComponentRule } from "../../types/catalog-style.types";
import type {
  CatalogLibrary,
  LibraryDefinition,
  LibraryDefinitionId,
  LibraryToken,
  LibraryTokenId,
  LayoutValues,
  PartRule,
  ValueType,
  VisualValues,
} from "./types";

/** Native types whose typed definitions the test entry composes until their catalog port. */
const NATIVE_TEST_ENTRY_TYPES: ReadonlySet<string> = new Set(["frame", "Slot"]);

/** Text leaves with a source-derived visual contract and a shared Canvas text painter. */
export const CODE_CATALOG_SUPPORTED_TYPES = [
  "Text",
  "Heading",
  "Label",
  "Description",
  "Paragraph",
  "FieldError",
] as const;
export type CodeCatalogSupportedType =
  (typeof CODE_CATALOG_SUPPORTED_TYPES)[number];

/**
 * ADR-295 Phase 3b — a rule `iconSize`: px, or the S2 icon step `{size.icon.<S>}` as a token value (the
 * resolver remembers its ref and the DOM writes the device variable — `catalogDeviceGlyphCss`).
 */
function iconValue(
  value: unknown,
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
  block?: object,
): number | ReturnType<typeof sourceToken> {
  // (ADR-295 후속: an S2 `scaled(n)` glyph — an Illustration's 48 · 96 · 160 — is a token use of its length ref.)
  const ref = block ? ruleSizeLengthRef(block, "iconSize") : undefined;
  if (ref) return sourceToken(ref, "iconSize", theme, tokens);
  if (typeof value === "number") return value;
  return sourceToken(value, "iconSize", theme, tokens);
}

/** A size block's length: its relative form's token use (`ruleSizeLengthRef`), else the number. */
function relativeLength(
  block: object,
  key: "paddingX" | "gap",
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
) {
  const ref = ruleSizeLengthRef(block, key);
  return ref
    ? sourceToken(ref, key, theme, tokens)
    : (block as Record<string, number | undefined>)[key];
}

function sourceToken(
  value: unknown,
  field:
    | "color"
    | "fontSize"
    | "radius"
    | "minHeight"
    | "iconSize"
    | "paddingX"
    | "gap",
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
) {
  if (typeof value !== "string" || !/^\{[\w]+\.[^{}]+\}$/.test(value))
    throw new Error(`CODE_CATALOG_TOKEN_UNSUPPORTED:${field}:${String(value)}`);
  const resolved = resolveToken(value as TokenRef, theme);
  const numeric = field !== "color";
  const normalized = numeric
    ? typeof resolved === "number"
      ? resolved
      : typeof resolved === "string" && /^\d+(?:\.\d+)?px$/.test(resolved)
        ? Number.parseFloat(resolved)
        : NaN
    : resolved;
  if (numeric ? !Number.isFinite(normalized) : typeof normalized !== "string")
    throw new Error(`CODE_CATALOG_TOKEN_UNRESOLVED:${field}:${value}`);
  const id =
    `lib:token:${value.slice(1, -1).replace(/[^A-Za-z0-9_-]/g, "_")}_${theme}` as LibraryTokenId;
  const tokenType = field === "color" ? "color" : "number";
  const current = tokens.get(id);
  if (current && current.value !== normalized)
    throw new Error(`CODE_CATALOG_TOKEN_COLLISION:${id}`);
  tokens.set(id, {
    id,
    tokenType,
    value: normalized,
    source: "spec-token",
    ref: value as `{${string}}`,
  });
  return { kind: "token" as const, tokenId: id };
}

function sourcePixels(value: unknown, theme: "light" | "dark"): number {
  if (typeof value !== "string" || !/^\{[\w]+\.[^{}]+\}$/.test(value))
    throw new Error(`CODE_CATALOG_LENGTH_UNSUPPORTED:${String(value)}`);
  const resolved = resolveToken(value as TokenRef, theme);
  const pixels =
    typeof resolved === "number"
      ? resolved
      : typeof resolved === "string" && /^\d+(?:\.\d+)?px$/.test(resolved)
        ? Number.parseFloat(resolved)
        : NaN;
  if (!Number.isFinite(pixels))
    throw new Error(`CODE_CATALOG_LENGTH_UNRESOLVED:${value}`);
  return pixels;
}

function textDefinition(
  type: CodeCatalogSupportedType,
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
): LibraryDefinition {
  const registration = componentCatalog.find(
    (entry) => entry.type === type && entry.kind === "primitive",
  );
  if (!registration || registration.kind !== "primitive")
    throw new Error(`CODE_CATALOG_REGISTRATION_MISSING:${type}`);
  const props = registration.binding.props.accepts;
  // A Heading also takes its S2 `level` (the heading element — `<h1>`~`<h6>`, no visual).
  const keys = type === "Heading" ? "children,level,size" : "children,size";
  if (
    registration.binding.source.kind !== "internal" ||
    registration.binding.source.renderer !== type.toLowerCase() ||
    Object.keys(props).sort().join(",") !== keys ||
    props.children.kind !== "string" ||
    props.size.kind !== "size" ||
    (type === "Heading" && props.level?.kind !== "number")
  )
    throw new Error(`CODE_CATALOG_BINDING_UNSUPPORTED:${type}`);
  const rule = COMPONENT_RULES_TABLE[type];
  if (!rule || rule.defaultVariant !== "default" || rule.defaultSize !== "M")
    throw new Error(`CODE_CATALOG_RULE_UNSUPPORTED:${type}`);
  const variant = rule.variants.default;
  if (
    !variant ||
    !variant.colors?.text ||
    typeof variant.textWeight !== "number"
  )
    throw new Error(`CODE_CATALOG_VISUAL_UNSUPPORTED:${type}`);
  const sizes: Record<string, VisualValues> = {};
  for (const [size, values] of Object.entries(rule.sizes)) {
    if (!values.fontSize || !values.lineHeight || !values.borderRadius)
      throw new Error(`CODE_CATALOG_SIZE_UNSUPPORTED:${type}:${size}`);
    sizes[size] = {
      fontSize: sourceToken(values.fontSize, "fontSize", theme, tokens),
      // The old table stores line height in px; the typed Canvas/Rust input is a ratio.
      lineHeight:
        sourcePixels(values.lineHeight, theme) /
        sourcePixels(values.fontSize, theme),
      radius: sourceToken(values.borderRadius, "radius", theme, tokens),
    };
  }
  return {
    id: catalogTypeDefinitionId(type),
    name: type,
    mode: "primitive",
    bindingId: registration.binding.source.renderer,
    accepts: {
      children: props.children.kind,
      size: "string",
      ...(props.level ? { level: "number" as const } : {}),
    },
    defaults: { size: rule.defaultSize },
    propChoices: { size: Object.keys(sizes) },
    visual: {
      color: sourceToken(variant.colors.text, "color", theme, tokens),
      fontWeight: variant.textWeight,
    },
    propVisualRules: { size: sizes },
    stateRules: {},
  };
}

/** Source-derived Button definition shared by the reusable template and both product consumers. */
function buttonDefinition(
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
): LibraryDefinition {
  const registration = componentCatalog.find(
    (entry) => entry.type === "Button" && entry.kind === "primitive",
  );
  if (
    registration?.kind !== "primitive" ||
    registration.binding.source.kind !== "rac" ||
    registration.binding.source.component !== "Button"
  )
    throw new Error("CODE_CATALOG_BUTTON_BINDING_UNSUPPORTED");
  const rule = COMPONENT_RULES_TABLE.Button;
  const accepts: Record<string, ValueType> = {};
  for (const [key, contract] of Object.entries(
    registration.binding.props.accepts,
  )) {
    const valueType = PROP_KIND_VALUE_TYPE[contract.kind];
    if (valueType) accepts[key] = valueType;
  }
  const sizes: Record<string, VisualValues> = {};
  for (const [size, values] of Object.entries(rule.sizes))
    sizes[size] = {
      fontSize: sourceToken(values.fontSize, "fontSize", theme, tokens),
      lineHeight:
        sourcePixels(values.lineHeight, theme) /
        sourcePixels(values.fontSize, theme),
      radius: sourceToken(values.borderRadius, "radius", theme, tokens),
      borderWidth: sourcePixels(values.borderWidth, theme),
      // `sizes.fontWeight` is what the generated CSS emits (`font-weight`) for the button box.
      ...(typeof values.fontWeight === "number"
        ? { fontWeight: values.fontWeight }
        : {}),
      // (A size without a floor writes none — the Button rule has no minWidth since 2026-10-14.)
      ...(values.minWidth !== undefined ? { minWidth: values.minWidth } : {}),
      // ADR-295 Phase 3: the S2 control height (`{size.height.<S>}` — the generated CSS `min-height`).
      ...(values.minHeight !== undefined
        ? {
            minHeight: sourceToken(
              values.minHeight,
              "minHeight",
              theme,
              tokens,
            ),
          }
        : {}),
      // ADR-295 Phase 3c-3: a relative padding · gap (`ofHeight` · `em` — S2 `pill` · `text-to-visual`) is a
      //   token use of its length ref, so the resolver remembers it (the DOM writes the device formula).
      paddingX: relativeLength(values, "paddingX", theme, tokens),
      // ADR-295 Phase 3: the S2 centring padding in the installed control height (desktop = the rule's).
      paddingY: s2ControlPaddingY(values) ?? values.paddingY,
      gap: relativeLength(values, "gap", theme, tokens),
    };
  const variants: Record<string, VisualValues> = {};
  const conditionalRules: NonNullable<
    LibraryDefinition["conditionalRules"]
  >[number][] = [];
  const childPartRules: PartRule[] = buttonChildScaleRules(
    Object.fromEntries(
      Object.entries(sizes).map(([size, values]) => [
        size,
        {
          ...values,
          ...(rule.sizes[size]?.iconSize !== undefined
            ? {
                iconSize: iconValue(
                  rule.sizes[size].iconSize,
                  theme,
                  tokens,
                  rule.sizes[size],
                ),
              }
            : {}),
        },
      ]),
    ),
  );
  // `utilities.css` `.button-base > :is(.react-aria-Icon, .react-aria-Text, .react-aria-Label)
  // { color: inherit }`: the Button's direct Icon / Text / Label children take its text color in
  // every variant, fill style and state (their own rule color is the dark `--fg`).
  const childColor = (
    color: VisualValues[keyof VisualValues],
    when: Record<string, string>,
    state?: "hover" | "pressed",
  ) => {
    for (const type of ["Icon", "Text", "Label"])
      childPartRules.push({
        child: { definitionId: catalogTypeDefinitionId(type) },
        when,
        ...(state ? { state } : {}),
        visual: { color },
      });
  };
  for (const [variant, paint] of Object.entries(rule.variants)) {
    if (
      !paint.colors?.text ||
      !paint.colors.border ||
      !paint.colors.outlineText ||
      !paint.colors.outlineBorder ||
      !paint.fill.outline?.base
    )
      throw new Error(`CODE_CATALOG_BUTTON_VARIANT_UNSUPPORTED:${variant}`);
    variants[variant] = {
      fill: sourceToken(paint.fill.default.base, "color", theme, tokens),
      color: sourceToken(paint.colors.text, "color", theme, tokens),
      borderColor: sourceToken(paint.colors.border, "color", theme, tokens),
    };
    childColor(variants[variant].color, { variant, fillStyle: "fill" });
    childColor(sourceToken(paint.colors.outlineText, "color", theme, tokens), {
      variant,
      fillStyle: "outline",
    });
    conditionalRules.push({
      when: { variant, fillStyle: "outline" },
      visual: {
        fill: sourceToken(paint.fill.outline.base, "color", theme, tokens),
        color: sourceToken(paint.colors.outlineText, "color", theme, tokens),
        borderColor: sourceToken(
          paint.colors.outlineBorder,
          "color",
          theme,
          tokens,
        ),
      },
    });
    for (const state of ["hover", "pressed"] as const) {
      const fill = paint.fill.default[state];
      // (Every variant's hover · pressed token resolves since 2026-10-28 — the palette derives
      //  `purple-hover` · `-pressed` as the DOM's color-mix, `resolveSemanticStateColors`. A token
      //  the palette lacks still leaves its state axis open.)
      const resolved = fill ? resolveToken(fill as TokenRef, theme) : undefined;
      // Hover also takes the variant's hover border/text (`resolveCatalogPaint`: `borderHover`,
      // `textHover`), when the palette resolves them.
      const hoverColor = (token: string | undefined) =>
        state === "hover" &&
        token &&
        typeof resolveToken(token as TokenRef, theme) === "string"
          ? sourceToken(token, "color", theme, tokens)
          : undefined;
      const borderColor = hoverColor(paint.colors.borderHover);
      const color = hoverColor(paint.colors.textHover);
      if (typeof resolved === "string")
        conditionalRules.push({
          when: { variant, fillStyle: "fill" },
          state,
          visual: {
            fill: sourceToken(fill, "color", theme, tokens),
            ...(borderColor ? { borderColor } : {}),
            ...(color ? { color } : {}),
          },
        });
      if (typeof resolved === "string" && color)
        childColor(color, { variant, fillStyle: "fill" }, state);
    }
  }
  // S2 `staticColor` — the fixed white · black scheme over a colored background (`Button.css`
  // `[data-static-color]`, the DOM's): fill = the static color with the opposite text and a static
  // border, outline = static text · border on the outline's own fill. After the variant rules, so it
  // wins over them. (295 후속 C9 — the Canvas painted a static outline Button with the variant's
  // outline gray and dark text: these conditions were missing, the DOM sheet had them.)
  for (const [staticColor, token, inverse] of [
    ["white", "{color.white}", "{color.black}"],
    ["black", "{color.black}", "{color.white}"],
  ] as const) {
    const own = sourceToken(token, "color", theme, tokens);
    const opposite = sourceToken(inverse, "color", theme, tokens);
    conditionalRules.push({
      when: { staticColor, fillStyle: "fill" },
      visual: { fill: own, color: opposite, borderColor: own },
    });
    childColor(opposite, { staticColor, fillStyle: "fill" });
    conditionalRules.push({
      when: { staticColor, fillStyle: "outline" },
      visual: { color: own, borderColor: own },
    });
    childColor(own, { staticColor, fillStyle: "outline" });
  }
  // S2 Button is a pill (`sizes` `{radius.full}`); a field's own button keeps its size's corner —
  // the rule's `containerVariants["field-button"]` (the DOM's `[data-field-button]` blocks), turned
  // on by the derived `fieldButton` (`catalogDerivedRestVisual` — never an authored prop).
  const fieldButton = (
    rule as {
      containerVariants?: Record<
        string,
        Record<string, { styles?: Record<string, string> }>
      >;
    }
  ).containerVariants?.["field-button"];
  for (const [size, block] of Object.entries(fieldButton ?? {})) {
    const value = block.styles?.["border-radius"] ?? "";
    const corner = /^var\(--radius-([a-z0-9]+)\)$/.exec(value)?.[1];
    const px = /^(\d+(?:\.\d+)?)px$/.exec(value)?.[1];
    if (!corner && px === undefined)
      throw new Error(`CODE_CATALOG_BUTTON_FIELD_CORNER_UNSUPPORTED:${size}`);
    // (ADR-295 후속: S2 field buttons draw no border — the block's `border-width`.)
    const borderWidth = block.styles?.["border-width"];
    conditionalRules.push({
      when: { fieldButton: size },
      visual: {
        radius: corner
          ? sourceToken(`{radius.${corner}}`, "radius", theme, tokens)
          : Number(px),
        ...(borderWidth !== undefined
          ? { borderWidth: Number.parseFloat(borderWidth) }
          : {}),
      },
    });
  }
  const defaults: Record<string, string> = {
    variant: rule.defaultVariant ?? "primary",
    size: rule.defaultSize ?? "M",
  };
  for (const key of ["fillStyle", "staticColor", "type"] as const) {
    const value = registration.binding.props.accepts[key]?.default;
    if (typeof value === "string") defaults[key] = value;
  }
  return {
    id: "lib:definition:type-Button",
    name: "Button",
    mode: "primitive",
    bindingId: "button",
    accepts,
    defaults,
    propChoices: {
      variant: Object.keys(variants),
      size: Object.keys(sizes),
      fillStyle: ["fill", "outline"],
    },
    visual: {},
    // withRuleBox splits the shared root box into typed layout and visual values.
    propVisualRules: { variant: variants, size: sizes },
    conditionalRules: [
      ...conditionalRules,
      ...disabledStateRules(rule, accepts),
    ],
    partRules: childPartRules,
    stateRules: {},
  };
}

/**
 * A button's Icon · Text children take its scale (the old read-time Button → Icon / Text
 * propagation, `buttonIconPx` / `buttonTextMetrics`): the Icon draws at the size's `iconSize`, the
 * label Text at the button's font size and line height — so an icon button keeps the plain
 * button's height. ADR-276: the Button · ToggleButton origins hold their words as a Text{label}
 * child, so both `buttonChildHost` types carry these (the ToggleButton's from its rule sizes).
 */
function buttonChildScaleRules(
  sizes: Readonly<Record<string, VisualValues>>,
): PartRule[] {
  const rules: PartRule[] = [];
  for (const [size, values] of Object.entries(sizes)) {
    if (values.iconSize !== undefined)
      rules.push({
        child: { definitionId: catalogTypeDefinitionId("Icon") },
        when: { size },
        visual: { iconSize: values.iconSize },
      });
    if (values.fontSize !== undefined)
      rules.push({
        child: { definitionId: catalogTypeDefinitionId("Text") },
        when: { size },
        visual: {
          fontSize: values.fontSize,
          ...(values.lineHeight !== undefined
            ? { lineHeight: values.lineHeight }
            : {}),
        },
      });
  }
  return rules;
}

/** ADR-276: a ToggleButton's rule definition with its Icon · Text children's scale (`buttonChildScaleRules`). */
function withButtonChildScale(
  definition: LibraryDefinition,
): LibraryDefinition {
  const sizes = definition.propVisualRules?.size;
  if (!sizes) return definition;
  const own = "partRules" in definition ? (definition.partRules ?? []) : [];
  return {
    ...definition,
    partRules: [...own, ...buttonChildScaleRules(sizes)],
  };
}

/** Shared Lucide glyph contract for Icon and Illustration source registrations. */
function glyphDefinition(
  type: "Icon" | "Illustration",
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
): LibraryDefinition {
  const registration = componentCatalog.find(
    (entry) => entry.type === type && entry.kind === "primitive",
  );
  if (
    registration?.kind !== "primitive" ||
    registration.binding.source.kind !== "internal" ||
    registration.binding.source.renderer !== type.toLowerCase() ||
    registration.binding.skiaPrimitive !== "icon_font"
  )
    throw new Error(`CODE_CATALOG_GLYPH_BINDING_UNSUPPORTED:${type}`);
  const rule = COMPONENT_RULES_TABLE[type];
  const color = rule.variants.default?.colors?.text;
  if (!color) throw new Error(`CODE_CATALOG_GLYPH_COLOR_MISSING:${type}`);
  const sizes: Record<string, VisualValues> = {};
  for (const [size, values] of Object.entries(rule.sizes)) {
    if (values.iconSize === undefined)
      throw new Error(`CODE_CATALOG_GLYPH_SIZE_MISSING:${type}:${size}`);
    sizes[size] = {
      iconSize: iconValue(values.iconSize, theme, tokens, values),
    };
  }
  const accepts: Record<string, ValueType> = {};
  const defaults: Record<string, string | number> = {
    size: rule.defaultSize ?? "M",
  };
  for (const [key, contract] of Object.entries(
    registration.binding.props.accepts,
  )) {
    const valueType = PROP_KIND_VALUE_TYPE[contract.kind];
    if (valueType) accepts[key] = valueType;
    if (
      typeof contract.default === "string" ||
      typeof contract.default === "number"
    )
      defaults[key] = contract.default;
  }
  return {
    id: catalogTypeDefinitionId(type),
    name: type,
    mode: "primitive",
    bindingId: type.toLowerCase(),
    accepts,
    defaults,
    propChoices: { size: Object.keys(sizes) },
    visual: { color: sourceToken(color, "color", theme, tokens) },
    propVisualRules: { size: sizes },
    stateRules: {},
  };
}

/** Parent-owned SelectValue text still has its own graph and Canvas identity. */
function selectValueDefinition(
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
): LibraryDefinition {
  const registration = componentCatalog.find(
    (entry) => entry.type === "SelectValue" && entry.kind === "primitive",
  );
  if (
    registration?.kind !== "primitive" ||
    registration.binding.source.kind !== "internal" ||
    registration.binding.source.renderer !== "selectvalue"
  )
    throw new Error("CODE_CATALOG_SELECT_VALUE_BINDING_UNSUPPORTED");
  const rule = COMPONENT_RULES_TABLE.SelectValue;
  const text = rule.variants.default?.colors?.text;
  if (!text) throw new Error("CODE_CATALOG_SELECT_VALUE_COLOR_MISSING");
  const sizes: Record<string, VisualValues> = {};
  for (const [size, values] of Object.entries(rule.sizes))
    sizes[size] = {
      fontSize: sourceToken(values.fontSize, "fontSize", theme, tokens),
      height: values.height,
    };
  return {
    id: catalogTypeDefinitionId("SelectValue"),
    name: "SelectValue",
    mode: "primitive",
    bindingId: "selectvalue",
    accepts: { children: "string", placeholder: "string", size: "string" },
    defaults: { children: "", placeholder: "", size: rule.defaultSize ?? "M" },
    propChoices: { size: Object.keys(sizes) },
    visual: { color: sourceToken(text, "color", theme, tokens) },
    propVisualRules: { size: sizes },
    stateRules: {},
  };
}

/**
 * The rule's layout box (`ruleRootBox`) on a hand-derived type definition that declares none:
 * every registered type reads its layout declaration from the same catalog rule.
 */
/**
 * Types that take a named slot (ADR-256 Decision 4): RAC's slot of the parent context they render
 * in (`Text slot="label"` in a ListBoxItem, `Button slot="increment"` in a NumberField, `Heading
 * slot="title"` in a Dialog), and the S2 item roles the stylesheets read (`Icon slot="icon"` …).
 * The value type `slot` keeps unset · a name · the explicit detach (`false`) apart.
 */
const ITEM_SLOT_CHILD_TYPES: ReadonlySet<string> = new Set([
  "Text",
  "Heading",
  "Description",
  "Icon",
  "Avatar",
  "Button",
  // (ADR-256 Phase 5f: a collection item's selection checkbox — `Checkbox slot="selection"`.)
  "Checkbox",
]);

function withRuleBox(
  input: LibraryDefinition,
  theme: "light" | "dark" = "light",
  tokens: Map<LibraryTokenId, LibraryToken> = new Map(),
): LibraryDefinition {
  const definition =
    ITEM_SLOT_CHILD_TYPES.has(input.name) && input.mode !== "composite"
      ? { ...input, accepts: { ...input.accepts, slot: "slot" as const } }
      : input;
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    definition.name
  ];
  if (!rule || definition.mode === "composite") return definition;
  const box = ruleRootBox(definition.name, rule);
  const width = definition.visual.width ?? box.visual.width;
  // Only copy a declared root height. A size-derived default would pin hand-derived Icons
  // to M's height and override the owning field/button's icon size.
  const rootHeight = (rule.containerStyles ?? rule.structure?.containerStyles)
    ?.height;
  const height =
    definition.visual.height ??
    (rootHeight == null ? undefined : box.visual.height);
  const next: {
    -readonly [K in keyof LibraryDefinition]: LibraryDefinition[K];
  } = {
    ...definition,
    layout: definition.layout ?? (box.layout as LayoutValues),
    visual: {
      ...definition.visual,
      ...(width === undefined ? {} : { width }),
      ...(height === undefined ? {} : { height }),
    },
  };
  // Manual stylesheet box facts (idempotent over `ruleTypeDefinition`'s own application).
  const layout: Record<string, string> = { ...next.layout };
  const visual: Record<string, VisualValues[keyof VisualValues]> = {
    ...next.visual,
  };
  const sizes: Record<string, VisualValues> = {
    ...("propVisualRules" in next ? next.propVisualRules?.size : undefined),
  };
  applyManualBox(definition.name, next, layout, visual, sizes, theme, tokens);
  next.layout = layout as LayoutValues;
  next.visual = visual as VisualValues;
  if ("propVisualRules" in next && next.propVisualRules?.size)
    next.propVisualRules = { ...next.propVisualRules, size: sizes };
  return next;
}

/**
 * Part rules of every rule-backed definition, compiled from its rule's child-selector declarations
 * (`compileRulePartRules`) onto the library's child definitions. Per-size values follow the
 * owner's size choice; an owner without one keeps its default size. A part color authored as a
 * catalog token (`{color.neutral-subdued}` — a crumb label's Link color) resolves in the library's
 * theme like every definition's own paint.
 */
function withRuleParts(
  definitions: readonly LibraryDefinition[],
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
): LibraryDefinition[] {
  const byId = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const typeId = (type: string): LibraryDefinitionId | undefined => {
    const id = catalogTypeDefinitionId(type);
    return byId.has(id) ? id : undefined;
  };
  const choicesOf = (childType: string, prop: string) => {
    const id = typeId(childType);
    const choices = id ? byId.get(id)?.propChoices?.[prop] : undefined;
    return choices?.map(String);
  };
  return definitions.map((definition) => {
    if (definition.mode === "composite" || !definition.ruleId)
      return definition;
    const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
      definition.ruleId
    ];
    const sized = !!definition.propChoices?.size;
    const partRules: PartRule[] = compileRulePartRules(
      definition.ruleId,
      choicesOf,
    ).flatMap((part): PartRule[] => {
      const child = typeId(part.childType);
      const via = part.via ? typeId(part.via) : undefined;
      if (!child || (part.via && !via)) return [];
      if (part.size && !sized && part.size !== rule?.defaultSize) return [];
      // A size the owner does not offer (a DOM style rule with more sizes — TextArea ← TextField).
      if (
        part.size &&
        sized &&
        !definition.propChoices!.size!.includes(part.size)
      )
        return [];
      const ownerAccepts = definition.accepts;
      // (A boolean axis's attribute value — `[data-quiet="true"]` — is the owner's boolean prop.)
      const ownerProps = Object.fromEntries(
        Object.entries(part.ownerProps ?? {}).map(([prop, value]) => [
          prop,
          ownerAccepts[prop] === "boolean" &&
          (value === "true" || value === "false")
            ? value === "true"
            : value,
        ]),
      );
      if (
        Object.entries(ownerProps).some(
          ([prop, value]) => !scalarFitsType(value, ownerAccepts[prop]),
        )
      )
        return [];
      const when = {
        ...(part.size && sized ? { size: part.size } : {}),
        ...ownerProps,
      };
      const viaAccepts = via ? byId.get(via)!.accepts : {};
      if (
        Object.entries(part.viaProps ?? {}).some(
          ([prop, value]) => !scalarFitsType(value, viaAccepts[prop]),
        )
      )
        return [];
      const accepts = byId.get(child)!.accepts;
      if (
        Object.entries(part.childProps ?? {}).some(
          ([prop, value]) => !scalarFitsType(value, accepts[prop]),
        )
      )
        return [];
      return [
        {
          child: {
            definitionId: child,
            ...(part.childProps ? { props: part.childProps } : {}),
            ...(via ? { via } : {}),
            ...(via && part.viaProps ? { viaProps: part.viaProps } : {}),
          },
          ...(Object.keys(when).length ? { when } : {}),
          ...(Object.keys(part.layout).length
            ? { layout: part.layout as LayoutValues }
            : {}),
          // ADR-295 Phase 3c-3b: a margin's length ref (a SearchField glyph's · a field button's start) is a
          //   token value beside its px.
          ...(part.layoutRefs
            ? {
                layoutTokens: Object.fromEntries(
                  Object.entries(part.layoutRefs).map(([key, ref]) => [
                    key,
                    sourceToken(ref, "gap", theme, tokens),
                  ]),
                ),
              }
            : {}),
          ...(Object.keys(part.visual).length
            ? {
                visual: {
                  ...part.visual,
                  ...(typeof part.visual.color === "string" &&
                  /^\{color\.[^{}]+\}$/.test(part.visual.color)
                    ? {
                        color: sourceToken(
                          part.visual.color,
                          "color",
                          theme,
                          tokens,
                        ),
                      }
                    : {}),
                  // ADR-295 Phase 2: a typography token size (`compileDeclarations`) is a token value
                  ...(typeof part.visual.fontSize === "string" &&
                  /^\{typography\.[^{}]+\}$/.test(part.visual.fontSize)
                    ? {
                        fontSize: sourceToken(
                          part.visual.fontSize,
                          "fontSize",
                          theme,
                          tokens,
                        ),
                      }
                    : {}),
                  // ADR-295 Phase 3: an S2 control height (`compileDeclarations`) is a token value
                  //   (Phase 3c: as is an icon side of a font's line · font — S2 `1lh` · `1em`).
                  ...Object.fromEntries(
                    (["width", "height", "minHeight", "iconSize"] as const)
                      .filter(
                        (key) =>
                          typeof part.visual[key] === "string" &&
                          (/^\{size\.[^{}]+\}$/.test(
                            part.visual[key] as string,
                          ) ||
                            (key !== "minHeight" &&
                              ICON_SIZE_TOKEN_REF.test(
                                part.visual[key] as string,
                              ))),
                      )
                      .map((key) => [
                        key,
                        sourceToken(
                          part.visual[key],
                          "minHeight",
                          theme,
                          tokens,
                        ),
                      ]),
                  ),
                  // ADR-295 Phase 3c-3: a relative gap · padding side (`{length.…}` — S2 `text-to-control`, a field
                  //   button's room) is a token value.
                  //   (ADR-295 후속: as is a fixed S2 sizing number — `scaled(n)` side · minimum.)
                  ...Object.fromEntries(
                    (
                      [
                        "gap",
                        "paddingLeft",
                        "paddingRight",
                        "width",
                        "height",
                        "minWidth",
                        "minHeight",
                      ] as const
                    )
                      .filter(
                        (key) =>
                          typeof part.visual[key] === "string" &&
                          /^\{length\.[^{}]+\}$/.test(
                            part.visual[key] as string,
                          ),
                      )
                      .map((key) => [
                        key,
                        sourceToken(part.visual[key], "gap", theme, tokens),
                      ]),
                  ),
                } as VisualValues,
              }
            : {}),
        },
      ];
    });
    // A definition's own part rules (Button children's inherited color) precede the compiled ones.
    const own = "partRules" in definition ? (definition.partRules ?? []) : [];
    return partRules.length
      ? { ...definition, partRules: [...own, ...partRules] }
      : definition;
  });
}

export function catalogTypeDefinitionId(type: string): LibraryDefinitionId {
  if (["Label", "Description", "Paragraph", "FieldError"].includes(type))
    return `lib:definition:type-${type}`;
  return (CODE_CATALOG_SUPPORTED_TYPES as readonly string[]).includes(type)
    ? `lib:definition:${type.toLowerCase()}`
    : `lib:definition:type-${type}`;
}

/**
 * ADR-248 Phase 3 — accepts-only definition for a registered component type used by a reusable
 * origin template. Accepts come from the `componentCatalog` primitive binding (`string-array` and
 * `items-manager` as structured slots); `binding` and unregistered types accept nothing.
 * Visual/state values are not derived here (Text/Heading keep `textDefinition`).
 */
export function catalogTypeDefinition(type: string): LibraryDefinition {
  return withRuleBox(handOrRuleDefinition(type));
}
function handOrRuleDefinition(type: string): LibraryDefinition {
  if (type === "Button")
    return buttonDefinition("light", new Map<LibraryTokenId, LibraryToken>());
  if (type === "Icon" || type === "Illustration")
    return glyphDefinition(
      type,
      "light",
      new Map<LibraryTokenId, LibraryToken>(),
    );
  // Supported text leaves keep their source-derived definition (accepts + visual).
  if ((CODE_CATALOG_SUPPORTED_TYPES as readonly string[]).includes(type))
    return textDefinition(
      type as CodeCatalogSupportedType,
      "light",
      new Map<LibraryTokenId, LibraryToken>(),
    );
  if (type === "SelectValue")
    return selectValueDefinition(
      "light",
      new Map<LibraryTokenId, LibraryToken>(),
    );
  // Every other registered type: registration props contract + D3 rule (`ruleDefinition.ts`).
  const definition = ruleTypeDefinition(
    type,
    "light",
    new Map<LibraryTokenId, LibraryToken>(),
  );
  return type === "ToggleButton"
    ? withButtonChildScale(definition)
    : definition;
}

/** Read-only code-derived definitions. Native fixture composition belongs to the test entry. */
export async function buildCodeCatalogLibrary(
  theme: "light" | "dark" = "light",
): Promise<CatalogLibrary> {
  const tokens = new Map<LibraryTokenId, LibraryToken>();
  const textDefinitions = CODE_CATALOG_SUPPORTED_TYPES.map((type) =>
    textDefinition(type, theme, tokens),
  );
  // Reusable origins: typed composite definitions/templates (generated source of truth), and a
  // typed definition for every registered type (registration contract + D3 rule). The native
  // Frame/Group/Slot definitions are composed by the test entry until their catalog port.
  const typeNames = new Set([
    ...REUSABLE_ORIGIN_TEMPLATES.map((template) => template.definitionId)
      .filter((id) => id.startsWith("lib:definition:type-"))
      .map((id) => id.slice("lib:definition:type-".length)),
    ...registeredCatalogTypes().filter(
      (type) => !NATIVE_TEST_ENTRY_TYPES.has(type),
    ),
  ]);
  const typeDefinitions = [...typeNames]
    .map((type) => catalogTypeDefinitionId(type))
    .filter((id) => !textDefinitions.some((definition) => definition.id === id))
    .sort()
    .map((id) => {
      const type = id.slice("lib:definition:type-".length);
      return type === "Button"
        ? buttonDefinition(theme, tokens)
        : type === "SelectValue"
          ? selectValueDefinition(theme, tokens)
          : type === "Icon" || type === "Illustration"
            ? glyphDefinition(type, theme, tokens)
            : type === "ToggleButton"
              ? withButtonChildScale(ruleTypeDefinition(type, theme, tokens))
              : ruleTypeDefinition(type, theme, tokens);
    });
  const sourceDefinitions = withRuleParts(
    [
      ...textDefinitions.map((definition) =>
        withRuleBox(definition, theme, tokens),
      ),
      ...typeDefinitions.map((definition) =>
        withRuleBox(definition, theme, tokens),
      ),
      ...REUSABLE_ORIGIN_DEFINITIONS,
    ],
    theme,
    tokens,
  );
  const bindingIds = [
    ...new Set(
      sourceDefinitions.flatMap((definition) =>
        definition.bindingId ? [definition.bindingId] : [],
      ),
    ),
  ];
  const rules: Record<string, ComponentRule> = {};
  for (const definition of sourceDefinitions)
    if (definition.ruleId)
      rules[definition.ruleId] = (
        COMPONENT_RULES_TABLE as Record<string, ComponentRule>
      )[definition.ruleId];
  const execution = codeExecutionVocabulary();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({
        contractVersion: LIBRARY_CONTRACT_VERSION,
        theme,
        definitions: sourceDefinitions,
        templates: REUSABLE_ORIGIN_TEMPLATES,
        tokens: [...tokens.values()],
        bindingIds,
        execution,
        rules,
      }),
    ),
  );
  const revision = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return buildCatalogLibrary({
    contractVersion: LIBRARY_CONTRACT_VERSION,
    revision,
    bindingIds,
    ...execution,
    definitions: sourceDefinitions,
    templates: REUSABLE_ORIGIN_TEMPLATES,
    tokens: [...tokens.values()],
    rules,
  });
}
