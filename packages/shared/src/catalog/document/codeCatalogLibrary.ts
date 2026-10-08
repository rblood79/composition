import { LIBRARY_CONTRACT_VERSION } from "./types";
import { scalarFitsType } from "./valueType";
import { resolveToken, type TokenRef } from "@composition/rendering";
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
const NATIVE_TEST_ENTRY_TYPES: ReadonlySet<string> = new Set([
  "frame",
  "Slot",
]);

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

function sourceToken(
  value: unknown,
  field: "color" | "fontSize" | "radius",
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
  if (
    registration.binding.source.kind !== "internal" ||
    registration.binding.source.renderer !== type.toLowerCase() ||
    Object.keys(props).sort().join(",") !== "children,size" ||
    props.children.kind !== "string" ||
    props.size.kind !== "size"
  )
    throw new Error(`CODE_CATALOG_BINDING_UNSUPPORTED:${type}`);
  const rule = COMPONENT_RULES_TABLE[type];
  if (!rule || rule.defaultVariant !== "default" || rule.defaultSize !== "md")
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
    accepts: { children: props.children.kind, size: "string" },
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
      minWidth: values.minWidth,
      paddingX: values.paddingX,
      paddingY: values.paddingY,
      gap: values.gap,
    };
  const variants: Record<string, VisualValues> = {};
  const conditionalRules: NonNullable<
    LibraryDefinition["conditionalRules"]
  >[number][] = [];
  const childPartRules: PartRule[] = [];
  // An icon Button's children take its scale (the old read-time Button → Icon / Text propagation,
  // `buttonIconPx` / `buttonTextMetrics`): the Icon draws at the size's `iconSize`, the label Text
  // at the Button's font size and line height — so an icon Button keeps the plain Button's height.
  for (const [size, values] of Object.entries(rule.sizes)) {
    if (typeof values.iconSize === "number")
      childPartRules.push({
        child: { definitionId: catalogTypeDefinitionId("Icon") },
        when: { size },
        visual: { iconSize: values.iconSize },
      });
    childPartRules.push({
      child: { definitionId: catalogTypeDefinitionId("Text") },
      when: { size },
      visual: {
        fontSize: sizes[size].fontSize,
        lineHeight: sizes[size].lineHeight,
      },
    });
  }
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
      // The legacy premium/genai table names hover tokens absent from the current palette.
      // Keep those state axes open instead of inventing a color for either consumer.
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
  const defaults: Record<string, string> = {
    variant: rule.defaultVariant ?? "primary",
    size: rule.defaultSize ?? "md",
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
    layout: rule.containerStyles,
    propVisualRules: { variant: variants, size: sizes },
    conditionalRules: [
      ...conditionalRules,
      ...disabledStateRules(rule, accepts),
    ],
    partRules: childPartRules,
    stateRules: {},
  };
}

/** Shared Lucide glyph contract for Icon and SelectIcon source registrations. */
function glyphDefinition(
  type: "Icon" | "SelectIcon",
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
    if (typeof values.iconSize !== "number")
      throw new Error(`CODE_CATALOG_GLYPH_SIZE_MISSING:${type}:${size}`);
    sizes[size] = { iconSize: values.iconSize };
  }
  const accepts: Record<string, ValueType> = {};
  const defaults: Record<string, string | number> = {
    size: rule.defaultSize ?? "md",
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

/** Field trigger paint and size from the registered SelectTrigger rule. */
function selectTriggerDefinition(
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
): LibraryDefinition {
  const registration = componentCatalog.find(
    (entry) => entry.type === "SelectTrigger" && entry.kind === "primitive",
  );
  if (
    registration?.kind !== "primitive" ||
    registration.binding.source.kind !== "internal" ||
    registration.binding.source.renderer !== "selecttrigger"
  )
    throw new Error("CODE_CATALOG_SELECT_TRIGGER_BINDING_UNSUPPORTED");
  const rule = COMPONENT_RULES_TABLE.SelectTrigger;
  const variants: Record<string, VisualValues> = {};
  for (const [variant, paint] of Object.entries(rule.variants)) {
    if (!paint.fill.default.base || !paint.colors?.border || !paint.colors.text)
      throw new Error(
        `CODE_CATALOG_SELECT_TRIGGER_VARIANT_UNSUPPORTED:${variant}`,
      );
    variants[variant] = {
      fill: sourceToken(paint.fill.default.base, "color", theme, tokens),
      borderColor: sourceToken(paint.colors.border, "color", theme, tokens),
      color: sourceToken(paint.colors.text, "color", theme, tokens),
    };
  }
  const sizes: Record<string, VisualValues> = {};
  for (const [size, values] of Object.entries(rule.sizes))
    sizes[size] = {
      fontSize: sourceToken(values.fontSize, "fontSize", theme, tokens),
      radius: sourceToken(values.borderRadius, "radius", theme, tokens),
      height: values.height,
      iconSize: values.iconSize,
      paddingX: values.paddingX,
      paddingY: values.paddingY,
      borderWidth: sourcePixels(values.borderWidth, theme),
    };
  return {
    id: catalogTypeDefinitionId("SelectTrigger"),
    name: "SelectTrigger",
    mode: "primitive",
    bindingId: "selecttrigger",
    accepts: { variant: "string", size: "string" },
    defaults: {
      variant: rule.defaultVariant ?? "default",
      size: rule.defaultSize ?? "md",
    },
    propChoices: {
      variant: Object.keys(variants),
      size: Object.keys(sizes),
    },
    visual: {},
    // SelectionComponents factory uses a flex row for this structural sub-part. The new typed
    // definition owns that layout while the existing Builder factory remains untouched.
    layout: { display: "flex", flexDirection: "row" },
    propVisualRules: { variant: variants, size: sizes },
    // ADR-253: `plain` only places its parts — the box is the Input / DateInput instance inside.
    conditionalRules: [
      {
        when: { variant: "plain" },
        visual: { paddingX: 0, paddingY: 0, borderWidth: 0, radius: 0 },
      },
    ],
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
    defaults: { children: "", placeholder: "", size: rule.defaultSize ?? "md" },
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

function withRuleBox(input: LibraryDefinition): LibraryDefinition {
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
  const next: {
    -readonly [K in keyof LibraryDefinition]: LibraryDefinition[K];
  } = {
    ...definition,
    layout: definition.layout ?? (box.layout as LayoutValues),
    visual:
      width === undefined ? definition.visual : { ...definition.visual, width },
  };
  // Manual stylesheet box facts (idempotent over `ruleTypeDefinition`'s own application).
  const layout: Record<string, string> = { ...next.layout };
  const visual: Record<string, VisualValues[keyof VisualValues]> = {
    ...next.visual,
  };
  const sizes: Record<string, VisualValues> = {
    ...("propVisualRules" in next ? next.propVisualRules?.size : undefined),
  };
  applyManualBox(definition.name, next, layout, visual, sizes);
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
      if (
        Object.entries(part.ownerProps ?? {}).some(
          ([prop, value]) => !scalarFitsType(value, ownerAccepts[prop]),
        )
      )
        return [];
      const when = {
        ...(part.size && sized ? { size: part.size } : {}),
        ...part.ownerProps,
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
          ...(Object.keys(part.visual).length
            ? {
                visual: (typeof part.visual.color === "string" &&
                /^\{color\.[^{}]+\}$/.test(part.visual.color)
                  ? {
                      ...part.visual,
                      color: sourceToken(
                        part.visual.color,
                        "color",
                        theme,
                        tokens,
                      ),
                    }
                  : part.visual) as VisualValues,
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
  if (type === "Icon" || type === "SelectIcon")
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
  if (type === "SelectTrigger")
    return selectTriggerDefinition(
      "light",
      new Map<LibraryTokenId, LibraryToken>(),
    );
  if (type === "SelectValue")
    return selectValueDefinition(
      "light",
      new Map<LibraryTokenId, LibraryToken>(),
    );
  // Every other registered type: registration props contract + D3 rule (`ruleDefinition.ts`).
  return ruleTypeDefinition(
    type,
    "light",
    new Map<LibraryTokenId, LibraryToken>(),
  );
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
        : type === "SelectTrigger"
          ? selectTriggerDefinition(theme, tokens)
          : type === "SelectValue"
            ? selectValueDefinition(theme, tokens)
            : type === "Icon" || type === "SelectIcon"
              ? glyphDefinition(type, theme, tokens)
              : ruleTypeDefinition(type, theme, tokens);
    });
  const sourceDefinitions = withRuleParts(
    [
      ...textDefinitions.map(withRuleBox),
      ...typeDefinitions.map(withRuleBox),
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
