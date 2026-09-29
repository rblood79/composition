import {
  resolveToken,
  type LayoutToken,
  type TokenRef,
} from "@composition/specs";
import { componentCatalog } from "../componentCatalog";
import { resolveCatalogRuleCanvasBox } from "../resolvers/resolveCatalogRuleCanvasBox";
import { manualBoxRule } from "./manualBoxRules";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import type { InspectorFieldKind } from "../types";
import type {
  ComponentRule,
  ComponentRuleSize,
} from "../../types/composition-document.types";
import type {
  ConditionalRule,
  LayoutField,
  LayoutValues,
  LibraryDefinition,
  LibraryDefinitionId,
  LibraryToken,
  LibraryTokenId,
  Scalar,
  ValueType,
  VisualValues,
} from "./types";

/**
 * ADR-248 Phase 3 — typed library definition derived from a registered component type: the
 * `componentCatalog` primitive binding (props contract) and its `COMPONENT_RULES_TABLE` rule.
 *
 * The rule itself stays the D3 source (`ruleId`): variant/state paint and sub-part structure are
 * read by the binding executors from `CatalogLibrary.rules`. What layout needs from the rule is
 * declared here as typed values, following the generated CSS for the rule's root box
 * (`CSSGenerator` base/container/size emission), so the Rust input and the class CSS read the
 * same declarations.
 */

/** Scalar value type of a registered prop contract; non-scalar kinds have no typed prop slot. */
export const PROP_KIND_VALUE_TYPE: Readonly<
  Partial<Record<InspectorFieldKind, ValueType>>
> = {
  boolean: "boolean",
  number: "number",
  enum: "string",
  string: "string",
  icon: "string",
  variant: "string",
  size: "string",
  fillStyle: "string",
};

/** `{token}` / number / `Npx` → px number; anything else (auto, %, var) → undefined. */
function pixels(value: unknown, theme: "light" | "dark"): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  if (/^\{[\w]+\.[^{}]+\}$/.test(value))
    return pixels(resolveToken(value as TokenRef, theme), theme);
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match ? Number(match[1]) : undefined;
}

/** Theme token use for a `{token}` source value, else the resolved px number. */
function lengthValue(
  value: unknown,
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
): VisualValues[keyof VisualValues] | undefined {
  const resolved = pixels(value, theme);
  if (resolved === undefined) return undefined;
  if (typeof value !== "string" || !value.startsWith("{")) return resolved;
  const id =
    `lib:token:${value.slice(1, -1).replace(/[^A-Za-z0-9_-]/g, "_")}_${theme}` as LibraryTokenId;
  const current = tokens.get(id);
  if (current && current.value !== resolved)
    throw new Error(`CODE_CATALOG_TOKEN_COLLISION:${id}`);
  tokens.set(id, {
    id,
    tokenType: "number",
    value: resolved,
    source: "spec-token",
  });
  return { kind: "token", tokenId: id };
}

export interface RootBox {
  layout: Record<string, string>;
  visual: Record<string, Scalar>;
  skipBorderRadius: boolean;
  /** Root border width at a size (px), or undefined for no border. */
  borderAt(sizeName: string | undefined): number | undefined;
}

/**
 * Rules whose root border the manual stylesheet removes over the generated one (the visible line
 * is the background): `Separator.css` `border: none` for both orientations.
 */
const MANUAL_BORDERLESS_RULES: ReadonlySet<string> = new Set(["Separator"]);

/** Rules drawn as a circle whose diameter is the size's `height` (`renderAvatar` · ProgressCircle). */
const CIRCLE_LEAF_RULES: ReadonlySet<string> = new Set([
  "Avatar",
  "ProgressCircle",
]);

const BOX_LAYOUT_KEYS: ReadonlySet<string> = new Set<LayoutField>([
  "display",
  "flexDirection",
  "alignItems",
  "justifyContent",
  "flexWrap",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridTemplateAreas",
  "maxWidth",
  "maxHeight",
]);

/** `12` / `"12px"` → 12; other values (auto, %, var) → undefined. */
function boxPixels(value: string | number | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match ? Number(match[1]) : undefined;
}

/**
 * Typed split of a rule's Canvas box (`resolveCatalogRuleCanvasBox`): container declarations as
 * `layout`, box metrics as `visual` (the box model's fields). The legacy border axis is not read
 * here — the typed border follows the generated CSS border (`RootBox.border`).
 */
export function typedCanvasBox(
  box: Readonly<Record<string, string | number>>,
): {
  layout: Record<string, string>;
  visual: Record<string, Scalar>;
} {
  const layout: Record<string, string> = {};
  const visual: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(box)) {
    if (BOX_LAYOUT_KEYS.has(key)) layout[key] = String(value);
    else if (key === "position") {
      // `sticky` has no layout-engine equivalent; the box stays in flow.
      if (value === "relative") layout.position = "relative";
    } else if (key === "flex") {
      if (value === "1" || value === 1) {
        layout.flexGrow = "1";
        layout.flexShrink = "1";
        layout.flexBasis = "0%";
      }
    } else if (key === "width") visual.width = value;
    else if (key === "overflow") visual.overflow = String(value);
    else if (key === "height" || key === "minHeight" || key === "padding") {
      const px = boxPixels(value);
      if (px !== undefined) visual[key] = px;
    } else if (key === "gap") {
      const px = boxPixels(value);
      if (px !== undefined) visual.gap = px;
    } else if (key === "paddingTop") visual.paddingY = boxPixels(value) ?? 0;
    else if (key === "paddingLeft") visual.paddingX = boxPixels(value) ?? 0;
  }
  if (box.rowGap !== undefined || box.columnGap !== undefined) {
    const row = boxPixels(box.rowGap);
    const column = boxPixels(box.columnGap);
    if (row !== undefined && row === column) visual.gap = row;
    else {
      if (row !== undefined) layout.rowGap = `${row}px`;
      if (column !== undefined) layout.columnGap = `${column}px`;
    }
  }
  // No display declaration: the CSS initial box of the rule's element (ADR-223 neutral box).
  layout.display ??= "block";
  return { layout, visual };
}

/** The generated size block's `max-width` (`CSSGenerator.generateSizeStyles`). */
function withSizeLimit(
  box: { layout: Record<string, string>; visual: Record<string, Scalar> },
  size: ComponentRuleSize | undefined,
): { layout: Record<string, string>; visual: Record<string, Scalar> } {
  if (typeof size?.maxWidth !== "number") return box;
  return { ...box, layout: { ...box.layout, maxWidth: `${size.maxWidth}px` } };
}

/**
 * Root box of a rule at its default size (`typedCanvasBox`) and the generated-CSS border axis:
 * the default variant border (not for toggle indicators or composition-owned boxes) or a
 * `structure.containerStyles.border`, with `size.borderWidth` (thin by default).
 */
export function ruleRootBox(type: string, rule: ComponentRule): RootBox {
  const structure = rule.structure;
  const composition = structure?.composition as
    | {
        layout?: LayoutToken;
        containerStyles?: Record<string, string>;
        containerVariants?: unknown;
      }
    | undefined;
  const { layout, visual } = typedCanvasBox(
    resolveCatalogRuleCanvasBox(type, rule.defaultSize),
  );
  const container = (structure?.containerStyles ?? {}) as Record<
    string,
    unknown
  >;
  const ownsContainerBox =
    !!composition &&
    (!!composition.layout ||
      !!composition.containerStyles ||
      !!composition.containerVariants);
  const defaultVariant =
    rule.defaultVariant !== undefined
      ? rule.variants[rule.defaultVariant]
      : undefined;
  const colorContainer = !!(
    container.background ||
    container.text ||
    container.border
  );
  const variantBorder =
    !colorContainer &&
    !ownsContainerBox &&
    structure?.archetype !== "toggle-indicator" &&
    !!defaultVariant?.colors?.border;
  const variantColor = defaultVariant?.colors?.border;
  const thin = pixels("{border.width.thin}", "light");
  // DOM border of the root: a container border shorthand (with its width), else the generated
  // per-size `border-width` (`resolveCatalogRuleCanvasBox`), else the default variant border when
  // it paints (a transparent variant border has no stylesheet box in the DOM).
  const borderAt = (sizeName: string | undefined): number | undefined => {
    if (MANUAL_BORDERLESS_RULES.has(type)) return undefined;
    if (container.border)
      return pixels(container.borderWidth ?? "{border.width.thin}", "light");
    const sized = resolveCatalogRuleCanvasBox(type, sizeName).borderWidth;
    if (typeof sized === "number") return sized;
    return variantBorder && variantColor !== "{color.transparent}"
      ? thin
      : undefined;
  };
  return {
    layout,
    visual,
    skipBorderRadius: container.borderRadius != null,
    borderAt,
  };
}

/** Per-size geometry of `CSSGenerator.generateSizeStyles` as typed values. */
function sizeVisual(
  sizeName: string,
  size: ComponentRuleSize,
  box: RootBox,
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
): VisualValues {
  const visual: Record<string, VisualValues[keyof VisualValues]> = {};
  const set = (key: keyof VisualValues, value: unknown) => {
    if (value !== undefined)
      visual[key] = value as VisualValues[keyof VisualValues];
  };
  const fontSize = pixels(size.fontSize, theme);
  set("fontSize", lengthValue(size.fontSize, theme, tokens));
  if (!box.skipBorderRadius)
    set("radius", lengthValue(size.borderRadius, theme, tokens));
  const lineHeight = pixels(size.lineHeight, theme);
  if (lineHeight !== undefined && fontSize)
    set("lineHeight", lineHeight / fontSize);
  if (typeof size.fontWeight === "number") set("fontWeight", size.fontWeight);
  set("borderWidth", box.borderAt(sizeName));
  set("minWidth", pixels(size.minWidth, theme));
  set("minHeight", pixels(size.minHeight, theme));
  set("iconSize", pixels(size.iconSize, theme));
  set("iconGap", pixels(size.iconGap, theme));
  return visual as VisualValues;
}

/**
 * Insertion content the existing palette factory authors without a binding default
 * (`createIllustratedMessageDefinition`). The typed definition owns these values so the existing
 * binding, and through it the current Preview/panel defaults, stays unchanged.
 */
const INSERTION_DEFAULTS: Readonly<Record<string, Record<string, Scalar>>> = {
  IllustratedMessage: {
    heading: "No results",
    description: "Try another search term.",
  },
};

function definitionId(type: string): LibraryDefinitionId {
  return `lib:definition:type-${type}`;
}

/**
 * Typed definition for a registered type (primitive registration and/or rule). `ruleId` is set
 * when the type has a D3 rule; `bindingId` is the lower-case execution key.
 */
export function ruleTypeDefinition(
  type: string,
  theme: "light" | "dark",
  tokens: Map<LibraryTokenId, LibraryToken>,
): LibraryDefinition {
  const registration = componentCatalog.find(
    (entry) => entry.type === type && entry.kind === "primitive",
  );
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[type];
  const accepts: Record<string, ValueType> = {};
  const defaults: Record<string, Scalar> = {};
  if (registration?.kind === "primitive")
    for (const [key, contract] of Object.entries(
      registration.binding.props.accepts,
    )) {
      const valueType = PROP_KIND_VALUE_TYPE[contract.kind];
      if (!valueType) continue;
      accepts[key] = valueType;
      if (typeof contract.default === valueType)
        defaults[key] = contract.default as Scalar;
    }
  for (const [key, value] of Object.entries(INSERTION_DEFAULTS[type] ?? {}))
    if (key in accepts) defaults[key] = value;
  const definition: {
    -readonly [K in keyof LibraryDefinition]: LibraryDefinition[K];
  } = {
    id: definitionId(type),
    name: type,
    mode: registration?.kind === "primitive" ? "primitive" : "native",
    bindingId: type.toLowerCase(),
    accepts,
    defaults,
    visual: {},
    stateRules: {},
  };
  if (!rule) return definition;
  definition.ruleId = type;
  const box = ruleRootBox(type, rule);
  const layout: Record<string, string> = { ...box.layout };
  const visual: Record<string, VisualValues[keyof VisualValues]> = {
    ...box.visual,
  };
  const defaultVariant =
    rule.defaultVariant !== undefined
      ? rule.variants[rule.defaultVariant]
      : undefined;
  if (typeof defaultVariant?.textWeight === "number")
    visual.fontWeight = defaultVariant.textWeight;
  const choices: Record<string, Scalar[]> = {};
  const choose = (
    prop: "variant" | "size" | "density",
    keys: string[],
    fallback?: string,
  ) => {
    if (accepts[prop] !== "string" || !keys.length) return;
    const current = defaults[prop] ?? fallback;
    if (current === undefined || !keys.includes(String(current))) return;
    defaults[prop] = current;
    choices[prop] = keys;
  };
  choose("variant", Object.keys(rule.variants), rule.defaultVariant);
  choose("size", Object.keys(rule.sizes), rule.defaultSize);
  // Density axis (`[data-density]` in the generated CSS): item spacing without a font change.
  const densities: Record<string, VisualValues> = {};
  for (const [name, values] of Object.entries(rule.densities ?? {}))
    densities[name] = {
      ...(typeof values.gap === "number" ? { gap: values.gap } : {}),
      ...(typeof values.paddingY === "number"
        ? { paddingY: values.paddingY }
        : {}),
    };
  if (rule.densities)
    choose("density", Object.keys(densities), rule.defaultDensity ?? "compact");
  if (Object.keys(choices).length) definition.propChoices = choices;
  const sizes: Record<string, VisualValues> = {};
  for (const [name, size] of Object.entries(rule.sizes))
    sizes[name] = sizeVisual(name, size, box, theme, tokens);
  // Circle leaves: the DOM renderer draws a square box of the size's height (Avatar also keeps it
  // from shrinking in a row).
  if (CIRCLE_LEAF_RULES.has(type)) {
    for (const [name, size] of Object.entries(rule.sizes)) {
      const height = pixels(size.height, theme);
      if (height !== undefined && height > 0)
        sizes[name] = { ...sizes[name], width: height };
    }
    if (type === "Avatar") layout.flexShrink = "0";
  }
  if (choices.size) {
    // Box values that vary by size (height · padding · gap) follow the size choice; the rest
    // stays on the definition.
    const boxes = Object.fromEntries(
      choices.size.map((name) => [
        String(name),
        withSizeLimit(
          typedCanvasBox(resolveCatalogRuleCanvasBox(type, String(name))),
          rule.sizes[String(name)],
        ),
      ]),
    );
    const varying = (pick: "layout" | "visual") => {
      const keys = new Set(
        Object.values(boxes).flatMap((entry) => Object.keys(entry[pick])),
      );
      return [...keys].filter(
        (key) =>
          new Set(
            Object.values(boxes).map((entry) =>
              JSON.stringify(entry[pick][key] ?? null),
            ),
          ).size > 1,
      );
    };
    for (const key of varying("visual")) delete visual[key];
    const layoutVarying = varying("layout");
    for (const key of layoutVarying) delete layout[key];
    // Size-block values shared by every size (e.g. one `max-width`) stay on the definition.
    for (const entry of Object.values(boxes).slice(0, 1))
      for (const [key, value] of Object.entries(entry.layout))
        if (!layoutVarying.includes(key)) layout[key] ??= value;
    for (const [name, entry] of Object.entries(boxes)) {
      const own: Record<string, VisualValues[keyof VisualValues]> = {};
      for (const key of varying("visual"))
        if (entry.visual[key] !== undefined) own[key] = entry.visual[key];
      sizes[name] = { ...own, ...sizes[name] } as VisualValues;
    }
    if (layoutVarying.length)
      definition.conditionalRules = Object.entries(boxes).flatMap(
        ([name, entry]) => {
          const own: Record<string, string> = {};
          for (const key of layoutVarying)
            if (entry.layout[key] !== undefined) own[key] = entry.layout[key];
          return Object.keys(own).length
            ? [{ when: { size: name }, layout: own as LayoutValues }]
            : [];
        },
      );
    definition.propVisualRules = { size: sizes };
  } else {
    const fallback = rule.defaultSize ?? Object.keys(rule.sizes)[0];
    if (fallback && sizes[fallback]) Object.assign(visual, sizes[fallback]);
    if (fallback)
      Object.assign(
        layout,
        withSizeLimit({ layout: {}, visual: {} }, rule.sizes[fallback]).layout,
      );
  }
  if (choices.density)
    definition.propVisualRules = {
      ...definition.propVisualRules,
      density: densities,
    };
  else if (rule.densities)
    Object.assign(visual, densities[rule.defaultDensity ?? "compact"] ?? {});
  applyManualBox(type, definition, layout, visual, sizes);
  const disabled = disabledStateRules(rule, accepts);
  if (disabled.length)
    definition.conditionalRules = [
      ...(definition.conditionalRules ?? []),
      ...disabled,
    ];
  if (Object.keys(layout).length) definition.layout = layout as LayoutValues;
  definition.visual = visual as VisualValues;
  return definition;
}

/**
 * The rule's disabled dimming (`structure.states.disabled.opacity` — the generated
 * `[data-disabled] { opacity }` and the old Canvas state effect): an accepted `isDisabled` or the
 * disabled resolution state sets it. Opacity 1 (Breadcrumbs) is no dimming.
 */
export function disabledStateRules(
  rule: Readonly<ComponentRule>,
  accepts: Readonly<Record<string, ValueType>>,
): ConditionalRule[] {
  const raw = (
    rule.structure as { states?: { disabled?: { opacity?: unknown } } } | undefined
  )?.states?.disabled?.opacity;
  const opacity = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  if (typeof opacity !== "number" || !Number.isFinite(opacity) || opacity >= 1)
    return [];
  return [
    ...(accepts.isDisabled === "boolean"
      ? [{ when: { isDisabled: true }, visual: { opacity } }]
      : []),
    { when: {}, state: "disabled" as const, visual: { opacity } },
  ];
}

const BOX_VISUAL_KEYS = [
  "width",
  "height",
  "minHeight",
  "padding",
  "paddingX",
  "paddingY",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "borderWidth",
  "overflow",
] as const;

/**
 * Manual stylesheet / renderer box facts (`manualBoxRule`) over the rule box: a replacing entry
 * drops the rule's box values first. Conditions keep only accepted props (of the declared choice).
 */
export function applyManualBox(
  type: string,
  definition: {
    -readonly [K in keyof LibraryDefinition]: LibraryDefinition[K];
  },
  layout: Record<string, string>,
  visual: Record<string, VisualValues[keyof VisualValues]>,
  sizes: Record<string, VisualValues>,
): void {
  const manual = manualBoxRule(type);
  if (!manual) return;
  if (manual.replace) {
    for (const key of Object.keys(layout)) delete layout[key];
    for (const key of BOX_VISUAL_KEYS) delete visual[key];
    for (const [name, values] of Object.entries(sizes)) {
      const kept: Record<string, unknown> = { ...values };
      for (const key of BOX_VISUAL_KEYS) delete kept[key];
      sizes[name] = kept as VisualValues;
    }
    delete definition.conditionalRules;
  }
  if (manual.rootSizeAttribute !== undefined) {
    const fallback = sizes[String(definition.defaults.size)];
    if (fallback)
      for (const name of Object.keys(sizes)) sizes[name] = { ...fallback };
  }
  for (const key of manual.omit ?? []) {
    delete visual[key];
    for (const [name, values] of Object.entries(sizes)) {
      const kept: Record<string, unknown> = { ...values };
      delete kept[key];
      sizes[name] = kept as VisualValues;
    }
  }
  Object.assign(layout, manual.layout);
  Object.assign(visual, manual.visual);
  const accepted = (when: Readonly<Record<string, Scalar>>) =>
    Object.entries(when).every(
      ([prop, value]) =>
        definition.accepts[prop] === typeof value &&
        (!definition.propChoices?.[prop] ||
          definition.propChoices[prop].includes(value)),
    );
  const conditional = (manual.conditional ?? [])
    .filter((rule) => accepted(rule.when))
    .map((rule) => ({
      when: rule.when,
      ...(rule.layout ? { layout: rule.layout as LayoutValues } : {}),
      ...(rule.visual ? { visual: rule.visual as VisualValues } : {}),
    }));
  const present = new Set(
    (definition.conditionalRules ?? []).map((rule) => JSON.stringify(rule)),
  );
  const added = conditional.filter(
    (rule) => !present.has(JSON.stringify(rule)),
  );
  if (added.length)
    definition.conditionalRules = [
      ...(definition.conditionalRules ?? []),
      ...added,
    ];
}

/** Every registered type with a primitive registration or a D3 rule. */
export function registeredCatalogTypes(): string[] {
  const types = new Set<string>(Object.keys(COMPONENT_RULES_TABLE));
  for (const entry of componentCatalog)
    if (entry.kind === "primitive") types.add(entry.type);
  return [...types].sort();
}
