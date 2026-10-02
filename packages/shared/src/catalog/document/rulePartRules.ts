/**
 * ADR-248 Phase 3 — typed part rules compiled from a rule's child-selector declarations
 * (`structure.composition.staticSelectors` and `delegation[].bridges`), the catalog source the
 * generated CSS emits as `.react-aria-Parent <child selector> { … }`. The typed graph applies the
 * same declarations to the matching child definitions (`PartRule`), so the Rust input and the DOM
 * read one source.
 *
 * Only box geometry and text metrics are compiled (paint stays with the DOM sheet and the Canvas
 * rule executor). A selector or value the typed model cannot express is skipped whole, never
 * approximated: descendant combinators other than a declared sub-part wrapper, pseudo-classes,
 * unmapped attributes, `unset`, unresolved `var()`.
 */
import {
  ARCHETYPE_BASE_STYLES,
  cssVarToTokenRef,
  resolveToken,
  type TokenRef,
} from "@composition/specs";
import { componentCatalog } from "../componentCatalog";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import {
  catalogTextAreaInputHeight,
  resolveCatalogRuleCanvasBox,
} from "../resolvers/resolveCatalogRuleCanvasBox";
import { isDelegatedSubpartChild } from "../resolvers/resolveDelegatedChildFontSize";
import type { ComponentRule } from "../../types/composition-document.types";
import { manualBoxRule } from "./manualBoxRules";
import type { LayoutField, Scalar, VisualField } from "./types";

export interface CompiledPartRule {
  childType: string;
  /** Intermediate sub-part wrapper type between the rule's root and the child. */
  via?: string;
  /** With `via`: the wrapper's resolved prop values the rule needs. */
  viaProps?: Readonly<Record<string, Scalar>>;
  childProps?: Readonly<Record<string, Scalar>>;
  /** Parent size the values belong to (per-size variables); absent = every size. */
  size?: string;
  /** Further owner prop values the rule needs (with `size`, the rule's `when`). */
  ownerProps?: Readonly<Record<string, Scalar>>;
  layout: Record<string, string>;
  visual: Record<string, Scalar>;
}

/**
 * DOM sub-part a typed child stands for, per owner (D1 structure the owner's RAC renderer builds):
 * the typed child type → the class/attribute tokens its DOM element carries. Children under the
 * `SelectTrigger` wrapper are reached through it (`via`). Absent entries use `.react-aria-<Type>`.
 */
const SUBPART_TOKENS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  Select: {
    SelectTrigger: [".react-aria-Button"],
    SelectValue: [".react-aria-SelectValue"],
    SelectIcon: [".select-chevron"],
  },
  ComboBox: {
    SelectTrigger: [".combobox-container"],
    SelectValue: [".react-aria-Input"],
    SelectIcon: [".react-aria-Button"],
  },
  NumberField: {
    SelectTrigger: [".react-aria-Group"],
    SelectValue: [".react-aria-Input"],
    SelectIcon: [".react-aria-Button"],
  },
  SearchField: {
    SelectTrigger: [".searchfield-container"],
    SelectValue: [".react-aria-Input"],
    SelectIcon: [".search-icon svg", ".react-aria-Button", ".react-aria-Button svg"],
  },
  DatePicker: {
    SelectTrigger: [".react-aria-Group"],
    DateInput: [".react-aria-DateInput"],
    SelectIcon: [".react-aria-Button"],
  },
  DateRangePicker: {
    SelectTrigger: [".react-aria-Group"],
    DateInput: [".react-aria-DateInput"],
    SelectIcon: [".react-aria-Button"],
  },
  ProgressBar: { ProgressBarValue: [".value"], ProgressBarTrack: [".bar"] },
  Meter: { MeterValue: [".value"], MeterTrack: [".bar"] },
  TextField: { Input: [".react-aria-Input"] },
  TextArea: { Input: [".react-aria-TextArea", ".react-aria-Input"] },
  ColorField: { Input: [".react-aria-Input"] },
  // Whole selectors (matched as written): the trigger button and the panel's content box.
  Disclosure: {
    DisclosureHeader: [".react-aria-Button[slot='trigger']"],
    DisclosureContent: [".react-aria-DisclosurePanel > div"],
  },
};
/** DOM selectors of a typed child inside an owner's self-composed DOM (`SUBPART_TOKENS`). */
export function catalogSubpartDomSelectors(
  ownerType: string,
  childType: string,
): readonly string[] {
  return (
    SUBPART_TOKENS[ownerType]?.[childType] ??
    Object.entries(SHARED_TOKENS)
      .filter(([, type]) => type === childType)
      .map(([token]) => token)
      .concat(`.react-aria-${childType}`)
  );
}
/**
 * Owner sub-part tokens that address one of several same-type children: the typed child's props
 * that pick it (SearchField's leading search glyph and trailing clear button, both `SelectIcon`
 * in the template, told apart by their `iconName`).
 */
const SUBPART_CHILD_PROPS: Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, Scalar>>>>>
> = {
  SearchField: {
    ".search-icon svg": { iconName: "search" },
    ".react-aria-Button": { iconName: "x" },
    ".react-aria-Button svg": { iconName: "x" },
  },
};
/**
 * `… svg` tokens size the glyph (`iconSize`). `box`: the glyph's wrapper has no size of its own
 * (`.search-icon` flex span), so the svg size is also the child's box.
 */
const GLYPH_TOKENS: Readonly<Record<string, { box: boolean }>> = {
  ".search-icon svg": { box: true },
  ".react-aria-Button svg": { box: false },
};
/**
 * Typed children that stand for several owner-composed DOM parts: DateRangePicker's one typed
 * `DateInput` is RAC's start/end DateInput pair (and the separator between them), its box their
 * union.
 */
const SUBPART_UNION: Readonly<Record<string, ReadonlySet<string>>> = {
  DateRangePicker: new Set(["DateInput"]),
};
/** Whether the typed child's DOM box is the union of every part its selectors match. */
export function catalogSubpartDomUnion(
  ownerType: string,
  childType: string,
): boolean {
  return SUBPART_UNION[ownerType]?.has(childType) ?? false;
}
const WRAPPED_BY_TRIGGER: ReadonlySet<string> = new Set([
  "SelectValue",
  "SelectIcon",
  "DateInput",
]);
const SHARED_TOKENS: Readonly<Record<string, string>> = {
  '[slot="description"]': "Description",
};

/** DOM attribute → typed prop of the matched child. */
const ATTRIBUTE_PROPS: Readonly<Record<string, string>> = {
  "aria-orientation": "orientation",
};

/**
 * Custom properties a child's stylesheet consumes as its own declaration (`Label.css`
 * `font-size: var(--label-font-size)` …): the delegation bridge sets the variable, the child
 * declares the property.
 */
const CONSUMED_VARIABLES: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  Label: {
    "--label-font-size": "font-size",
    "--label-font-weight": "font-weight",
    "--label-line-height": "line-height",
  },
  Input: {
    "--input-padding": "padding",
    "--input-font-size": "font-size",
    "--input-line-height": "line-height",
  },
  FieldError: { "--error-font-size": "font-size" },
  Tab: { "--tab-padding": "padding", "--tab-font-size": "font-size" },
};

type Condition = { prop: string; value: string; negate: boolean };
interface SimpleSelector {
  token: string;
  conditions: Condition[];
}

/** `.react-aria-X[a="v"]:not([b="w"])` / `[slot="description"]`; anything else → undefined. */
function parseSimple(selector: string): SimpleSelector | undefined {
  const match =
    /^(\.[\w-]+|\[slot="[\w-]+"\])((?:\[[\w-]+=["'][^"']*["']\]|:not\(\[[\w-]+=["'][^"']*["']\]\))*)$/.exec(
      selector.trim(),
    );
  if (!match) return undefined;
  const conditions: Condition[] = [];
  for (const part of match[2].matchAll(
    /(:not\()?\[([\w-]+)=["']([^"']*)["']\]\)?/g,
  ))
    conditions.push({
      prop: part[2],
      value: part[3],
      negate: part[1] !== undefined,
    });
  return { token: match[1], conditions };
}

/** Top-level comma list, unwrapping one `:is(…)`. */
function selectorList(selector: string): string[] {
  const trimmed = selector.trim();
  const inner = /^:is\((.*)\)$/.exec(trimmed)?.[1] ?? trimmed;
  return inner.split(",").map((part) => part.trim());
}

function childTypeOf(
  parentType: string,
  token: string,
): { childType: string; via?: string } | undefined {
  const own = SUBPART_TOKENS[parentType] ?? {};
  for (const [childType, tokens] of Object.entries(own))
    if (tokens.includes(token))
      return WRAPPED_BY_TRIGGER.has(childType) && own.SelectTrigger
        ? { childType, via: "SelectTrigger" }
        : { childType };
  if (SHARED_TOKENS[token]) return { childType: SHARED_TOKENS[token] };
  const rac = /^\.react-aria-([A-Z]\w*)$/.exec(token)?.[1];
  if (!rac || !(rac in COMPONENT_RULES_TABLE)) return undefined;
  // A token the owner maps to another child is not this type's own element.
  if (Object.values(own).some((tokens) => tokens.includes(token)))
    return undefined;
  return { childType: rac };
}

/**
 * The DOM spacing scale (`theme/shared-tokens.css` `--spacing-*`, rem @ 16px). It is not the spec
 * `{spacing.*}` primitive scale (`md` 16 there, 12 here): a stylesheet `var(--spacing-md)` is 12px.
 */
const CSS_SPACING_PX: Readonly<Record<string, number>> = {
  "--spacing-0": 0,
  "--spacing": 4,
  "--spacing-3xs": 1,
  "--spacing-2xs": 2,
  "--spacing-xs": 4,
  "--spacing-sm": 8,
  "--spacing-md": 12,
  "--spacing-lg": 16,
  "--spacing-xl": 24,
  "--spacing-2xl": 32,
  "--spacing-3xl": 40,
  "--spacing-4xl": 48,
};

/** px number of a resolved length (`0`, `Npx`, a spacing/typography token var). */
function lengthPx(value: string): number | undefined {
  const text = value.trim();
  const spacingVar = /^var\((--spacing(?:-[\w]+)?)\)$/.exec(text)?.[1];
  if (spacingVar && CSS_SPACING_PX[spacingVar] !== undefined)
    return CSS_SPACING_PX[spacingVar];
  if (text === "0") return 0;
  const px = /^(-?\d+(?:\.\d+)?)px$/.exec(text);
  if (px) return Number(px[1]);
  const ref = /^var\((--[\w-]+)\)$/.exec(text);
  if (ref) {
    const token = cssVarToTokenRef(`var(${ref[1]})`);
    if (token) {
      const resolved = resolveToken(token as TokenRef);
      if (typeof resolved === "number") return resolved;
    }
  }
  return undefined;
}

/** Substitutes owner variables (`--select-btn-font-size` …) and `var(--x, fallback)` defaults. */
function substitute(
  value: string,
  variables: Readonly<Record<string, string>>,
  depth = 0,
): string | undefined {
  if (depth > 4) return undefined;
  let unresolved = false;
  const out = value.replace(
    /var\((--[\w-]+)(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,
    (whole, name: string, fallback?: string) => {
      if (variables[name] !== undefined) {
        const next = substitute(variables[name], variables, depth + 1);
        if (next === undefined) unresolved = true;
        return next ?? whole;
      }
      if (CSS_SPACING_PX[name] !== undefined || cssVarToTokenRef(`var(${name})`))
        return `var(${name})`;
      if (fallback !== undefined) return fallback.trim();
      unresolved = true;
      return whole;
    },
  );
  return unresolved ? undefined : out;
}

function spacing(value: string): number[] | undefined {
  const parts = value.trim().split(/\s+/).map(lengthPx);
  if (!parts.length || parts.length > 4 || parts.some((p) => p === undefined))
    return undefined;
  return parts as number[];
}

const LAYOUT_KEYWORDS: Readonly<Record<string, LayoutField>> = {
  display: "display",
  "flex-direction": "flexDirection",
  "align-items": "alignItems",
  "justify-content": "justifyContent",
  "flex-wrap": "flexWrap",
  "align-self": "alignSelf",
  "justify-self": "justifySelf",
};
const DISPLAY_VALUES = new Set([
  "block",
  "flex",
  "inline-flex",
  "grid",
  "inline-block",
  "none",
]);

/** Grid lines of a named area in an owner `grid-template-areas`. */
function areaLines(
  areas: string | undefined,
  name: string,
): Record<string, string> | undefined {
  if (!areas) return undefined;
  const rows = [...areas.matchAll(/"([^"]+)"/g)].map((row) =>
    row[1].trim().split(/\s+/),
  );
  let rowStart = Infinity;
  let rowEnd = -Infinity;
  let colStart = Infinity;
  let colEnd = -Infinity;
  rows.forEach((cells, row) =>
    cells.forEach((cell, col) => {
      if (cell !== name) return;
      rowStart = Math.min(rowStart, row + 1);
      rowEnd = Math.max(rowEnd, row + 2);
      colStart = Math.min(colStart, col + 1);
      colEnd = Math.max(colEnd, col + 2);
    }),
  );
  if (!Number.isFinite(rowStart)) return undefined;
  return {
    gridRowStart: String(rowStart),
    gridRowEnd: String(rowEnd),
    gridColumnStart: String(colStart),
    gridColumnEnd: String(colEnd),
  };
}

/**
 * Typed output of one declaration block; `undefined` when a geometry declaration of the block
 * cannot be expressed (the whole block is then skipped).
 */
function compileDeclarations(
  childType: string,
  declarations: Readonly<Record<string, string>>,
  variables: Readonly<Record<string, string>>,
  ownerAreas: string | undefined,
): { layout: Record<string, string>; visual: Record<string, Scalar> } {
  const layout: Record<string, string> = {};
  const visual: Partial<Record<VisualField, Scalar>> = {};
  const consumed = CONSUMED_VARIABLES[childType] ?? {};
  const entries: Array<[string, string]> = [];
  for (const [key, raw] of Object.entries(declarations)) {
    if (typeof raw !== "string") continue;
    if (key.startsWith("--")) {
      if (consumed[key]) entries.push([consumed[key], raw]);
      continue;
    }
    entries.push([key, raw]);
  }
  let fontSize: number | undefined;
  let lineHeightPx: number | undefined;
  for (const [key, raw] of entries) {
    const substituted = substitute(raw, variables);
    const value =
      substituted === "unset" && (key === "min-width" || key === "min-height")
        ? "auto"
        : substituted;
    if (value === undefined || value === "unset" || value === "inherit")
      continue;
    if (LAYOUT_KEYWORDS[key]) {
      if (key === "display" && !DISPLAY_VALUES.has(value)) continue;
      layout[LAYOUT_KEYWORDS[key]] = value;
    } else if (key === "flex") {
      const parts = value.split(/\s+/);
      if (/^\d+(?:\.\d+)?$/.test(parts[0])) {
        layout.flexGrow = parts[0];
        layout.flexShrink = parts[1] ?? "1";
        layout.flexBasis = parts[2] ?? "0%";
      }
    } else if (key === "flex-grow" || key === "flex-shrink") {
      layout[key === "flex-grow" ? "flexGrow" : "flexShrink"] = value;
    } else if (key === "flex-basis") layout.flexBasis = value;
    else if (key === "margin") {
      const [t, r = t, b = t, l = r] = spacing(value) ?? [];
      if (t !== undefined) {
        layout.marginTop = `${t}px`;
        layout.marginRight = `${r}px`;
        layout.marginBottom = `${b}px`;
        layout.marginLeft = `${l}px`;
      }
    } else if (/^margin-(top|right|bottom|left)$/.test(key)) {
      const px = lengthPx(value);
      if (px !== undefined)
        layout[`margin${key[7].toUpperCase()}${key.slice(8)}` as LayoutField] =
          `${px}px`;
    } else if (key === "position") {
      if (value === "relative" || value === "static") layout.position = value;
    } else if (key === "grid-area") {
      Object.assign(layout, areaLines(ownerAreas, value) ?? {});
    } else if (key === "width" || key === "height") {
      const px = lengthPx(value);
      if (px !== undefined) visual[key] = px;
      else if (/^(\d+(?:\.\d+)?%|fit-content|auto)$/.test(value))
        visual[key] = value;
    } else if (key === "min-width" || key === "min-height") {
      // `unset`/`auto` = the initial automatic minimum: a flex item's min-content (CSS-FLEXBOX-1
      // §4.5), zero for a block box — the engine resolves `auto` by the box's formatting context.
      const field = key === "min-width" ? "minWidth" : "minHeight";
      if (value === "auto") visual[field] = "auto";
      else {
        const px = lengthPx(value);
        if (px !== undefined) visual[field] = px;
      }
    } else if (key === "max-width" || key === "max-height") {
      const px = lengthPx(value);
      const field = key === "max-width" ? "maxWidth" : "maxHeight";
      if (px !== undefined) layout[field] = `${px}px`;
      else if (/^\d+(?:\.\d+)?(?:%|ch)$/.test(value)) layout[field] = value;
    } else if (key === "padding") {
      const [t, r = t, b = t, l = r] = spacing(value) ?? [];
      if (t !== undefined && t === b && r === l) {
        visual.paddingY = t;
        visual.paddingX = r;
      } else if (t !== undefined) {
        visual.paddingTop = t;
        visual.paddingRight = r;
        visual.paddingBottom = b;
        visual.paddingLeft = l;
      }
    } else if (/^padding-(top|right|bottom|left)$/.test(key)) {
      const px = lengthPx(value);
      if (px !== undefined)
        visual[
          `padding${key[8].toUpperCase()}${key.slice(9)}` as VisualField
        ] = px;
    } else if (key === "gap") {
      const px = lengthPx(value);
      if (px !== undefined) visual.gap = px;
    } else if (key === "border" || key === "border-width") {
      if (value === "none" || value === "0") visual.borderWidth = 0;
      else {
        const px = lengthPx(value.split(/\s+/)[0]);
        if (px !== undefined) visual.borderWidth = px;
      }
    } else if (key === "font-size") {
      const px = lengthPx(value);
      if (px !== undefined) visual.fontSize = fontSize = px;
    } else if (key === "font-weight") {
      if (/^\d+$/.test(value)) visual.fontWeight = Number(value);
    } else if (key === "line-height") {
      const px = lengthPx(value);
      if (px !== undefined) lineHeightPx = px;
      else if (/^\d+(?:\.\d+)?$/.test(value)) visual.lineHeight = Number(value);
    }
  }
  if (lineHeightPx !== undefined && fontSize)
    visual.lineHeight = lineHeightPx / fontSize;
  return { layout, visual: visual as Record<string, Scalar> };
}

/**
 * Variables the owner declares on its own element (`composition.containerStyles` and
 * `containerVariants.size[*].styles`, e.g. RadioGroup `--label-font-size`) reach every descendant
 * by custom-property inheritance; a child whose stylesheet consumes them (`CONSUMED_VARIABLES`)
 * takes the property. Lower precedence than the delegation blocks (a direct declaration wins).
 */
function ownerVariablePartRules(parentType: string): CompiledPartRule[] {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    domStyleRuleType(parentType)
  ];
  const composition = rule?.structure?.composition as
    | {
        containerStyles?: Record<string, string>;
        containerVariants?: {
          size?: Record<string, { styles?: Record<string, string> }>;
        };
      }
    | undefined;
  if (!composition) return [];
  const layers: Array<{ size?: string; styles: Record<string, string> }> = [
    { styles: composition.containerStyles ?? {} },
    ...Object.entries(composition.containerVariants?.size ?? {}).map(
      ([size, variant]) => ({ size, styles: variant.styles ?? {} }),
    ),
  ];
  return Object.entries(CONSUMED_VARIABLES).flatMap(([childType, consumed]) =>
    layers.flatMap(({ size, styles }): CompiledPartRule[] => {
      const declarations = Object.fromEntries(
        Object.entries(styles).filter(([key]) => consumed[key]),
      );
      if (!Object.keys(declarations).length) return [];
      const { layout, visual } = compileDeclarations(
        childType,
        declarations,
        {},
        undefined,
      );
      if (!Object.keys(layout).length && !Object.keys(visual).length) return [];
      return [{ childType, ...(size ? { size } : {}), layout, visual }];
    }),
  );
}

/**
 * Rule whose generated stylesheet styles `type`'s DOM element. A type rendered as another RAC
 * component (`binding.source.component`, e.g. TextArea → RAC `TextField`) carries that
 * component's class; the generator skips its own sheet on the same condition
 * (`packages/specs/scripts/generate-css.ts` "selector unmatchable"), so that rule's selectors apply.
 */
function domStyleRuleType(type: string): string {
  const registration = componentCatalog.find(
    (entry) => entry.type === type && entry.kind === "primitive",
  );
  const source =
    registration?.kind === "primitive" &&
    registration.binding.source.kind === "rac"
      ? registration.binding.source.component
      : undefined;
  const table = COMPONENT_RULES_TABLE as Record<string, ComponentRule>;
  return source &&
    source.toLowerCase() !== type.toLowerCase() &&
    table[source]?.structure
    ? source
    : type;
}

/**
 * Slider thumb size per owner size — the generator's `generateSliderSizeMetrics`
 * (`.react-aria-Slider[data-size] .react-aria-SliderThumb { width/height: indicator.thumbSize }`).
 * The typed thumb sits under the SliderTrack sub-part (`via`).
 */
function sliderThumbPartRules(parentType: string): CompiledPartRule[] {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    parentType
  ];
  if (rule?.structure?.archetype !== "slider" || parentType !== "Slider")
    return [];
  return Object.entries(rule.sizes ?? {}).flatMap(([size, values]) => {
    const thumb = (values as { indicator?: { thumbSize?: number } }).indicator
      ?.thumbSize;
    return typeof thumb === "number"
      ? [
          {
            childType: "SliderThumb",
            via: "SliderTrack",
            size,
            layout: {},
            visual: { width: thumb, height: thumb },
          },
        ]
      : [];
  });
}

/** Owner size names a rule's per-size variables are declared for. */
function sizeNames(rule: ComponentRule): string[] {
  return Object.keys(rule.sizes ?? {});
}

/**
 * Inline padding of an owner's RAC date segments (`.react-aria-DateSegment` delegation bridge,
 * `padding: 0 2px`): editable segments carry it on both sides, literals do not
 * (`[data-type="literal"] { padding: 0 }`). 0 when the owner declares none.
 */
export function catalogDateSegmentPaddingX(ownerType: string): number {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[ownerType];
  const delegation = (
    rule?.structure?.composition as
      | { delegation?: Array<{ childSelector?: string; bridges?: Record<string, string> }> }
      | undefined
  )?.delegation;
  const padding = delegation?.find(
    (entry) => entry.childSelector === ".react-aria-DateSegment",
  )?.bridges?.padding;
  if (typeof padding !== "string") return 0;
  const values = padding.trim().split(/\s+/);
  return lengthPx(values[1] ?? values[0]) ?? 0;
}

/**
 * Flex grow the owner's delegation gives its RAC range end input (`[slot="end"] { flex: N }` —
 * DateRangePicker): the DOM end DateInput takes the trigger's free space past its min-content.
 * 0 when the owner declares none.
 */
export function catalogDateRangeEndGrow(ownerType: string): number {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[ownerType];
  const delegation = (
    rule?.structure?.composition as
      | { delegation?: Array<{ childSelector?: string; bridges?: Record<string, string> }> }
      | undefined
  )?.delegation;
  const flex = delegation?.find(
    (entry) => entry.childSelector === '[slot="end"]',
  )?.bridges?.flex;
  const grow = typeof flex === "string" ? Number(flex.trim().split(/\s+/)[0]) : 0;
  return Number.isFinite(grow) && grow > 0 ? grow : 0;
}

/** One composed text of the DropZone content: its own px font size (absent = the DropZone's). */
export interface CatalogDropZoneTextStyle {
  readonly fontSize?: number;
  /** Ratio to the font size. */
  readonly lineHeight: number;
}

/**
 * The DropZone's composed content (DropZone.tsx: upload icon, label, description) as its rule
 * delegation declares it — the generated CSS emits the same entries. The icon box is the size's
 * `iconSize` (`var(--icon-size)`); a text's `font-size: inherit` is the DropZone font.
 */
export function catalogDropZoneContentStyle(): {
  readonly label: CatalogDropZoneTextStyle;
  readonly description: CatalogDropZoneTextStyle;
} {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>).DropZone;
  const delegation = (
    rule?.structure?.composition as
      | { delegation?: Array<{ childSelector?: string; bridges?: Record<string, string> }> }
      | undefined
  )?.delegation;
  const text = (selector: string): CatalogDropZoneTextStyle => {
    const bridges =
      delegation?.find((entry) => entry.childSelector === selector)?.bridges ?? {};
    const size = bridges["font-size"];
    const fontSize =
      typeof size === "string" && size.trim() !== "inherit" ? lengthPx(size) : undefined;
    const ratio = Number(bridges["line-height"]);
    return {
      ...(fontSize !== undefined ? { fontSize } : {}),
      lineHeight: Number.isFinite(ratio) && ratio > 0 ? ratio : 1.5,
    };
  };
  return {
    label: text('[slot="label"]'),
    description: text('[slot="description"]'),
  };
}

/**
 * Inline inset of a toggle-indicator control's content: the RAC indicator element (checkbox box,
 * radio circle, switch track — `sizes[size].indicator`) and the control's `gap` sit before the
 * label in the DOM row. The typed tree has no indicator node (the Canvas executor paints it in the
 * control box), so the label carries that inset.
 */
export function catalogIndicatorInset(
  type: string,
  sizeName: string | undefined,
): number | undefined {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[type];
  if (rule?.structure?.archetype !== "toggle-indicator") return undefined;
  const size =
    rule.sizes?.[sizeName ?? ""] ??
    (rule.defaultSize ? rule.sizes?.[rule.defaultSize] : undefined);
  const indicator = size?.indicator?.boxSize ?? size?.indicator?.trackWidth;
  if (typeof indicator !== "number") return undefined;
  return indicator + (typeof size?.gap === "number" ? size.gap : 0);
}

function indicatorPartRules(parentType: string): CompiledPartRule[] {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    parentType
  ];
  if (rule?.structure?.archetype !== "toggle-indicator") return [];
  return sizeNames(rule).flatMap((size) => {
    const inset = catalogIndicatorInset(parentType, size);
    return inset === undefined
      ? []
      : [
          {
            childType: "Label",
            size,
            layout: { marginLeft: `${inset}px` },
            visual: {},
          },
        ];
  });
}

/**
 * A field's own value box (`Input` / `DateInput` directly under the owner that self-composes it —
 * ssot-hierarchy D3 read-only sub-part): the DOM fills the field width (`width: 100%`, the root is
 * `align-items: flex-start`, so no stretch).
 */
function fieldValuePartRules(parentType: string): CompiledPartRule[] {
  return ["Input", "DateInput"].flatMap((childType): CompiledPartRule[] =>
    isDelegatedSubpartChild(childType, parentType)
      ? [{ childType, layout: {}, visual: { width: "100%" } }]
      : [],
  );
}

/** TextArea's value box: `<textarea rows>` height per owner size and `rows` (1–12). */
const TEXT_AREA_ROWS = Array.from({ length: 12 }, (_, index) => index + 1);
function textAreaPartRules(parentType: string): CompiledPartRule[] {
  if (parentType !== "TextArea") return [];
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    parentType
  ];
  return sizeNames(rule).flatMap((size) =>
    [undefined, ...TEXT_AREA_ROWS].flatMap((rows): CompiledPartRule[] => {
      const height = catalogTextAreaInputHeight(size, rows);
      return height === undefined
        ? []
        : [
            {
              childType: "Input",
              size,
              // No `rows` value: the shared default (3 rows).
              ...(rows === undefined ? {} : { ownerProps: { rows } }),
              layout: {},
              visual: { height },
            },
          ];
    }),
  );
}

/**
 * A typed child standing for another rule's element (`SUBPART_TOKENS` `.react-aria-Button` for
 * Select's trigger or a field's icon button) also receives that rule's generated box at its
 * default size (the element carries no `data-size`): its item `gap` and `min-width`. The owner's
 * delegation for the same element follows and wins.
 */
function tokenRuleBasePartRules(parentType: string): CompiledPartRule[] {
  return Object.entries(SUBPART_TOKENS[parentType] ?? {}).flatMap(
    ([childType, tokens]): CompiledPartRule[] =>
      tokens.flatMap((token): CompiledPartRule[] => {
        const other = /^\.react-aria-([A-Z]\w*)$/.exec(token)?.[1];
        if (!other || other === childType) return [];
        const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
          other
        ];
        if (!rule?.structure) return [];
        const size = rule.defaultSize ? rule.sizes[rule.defaultSize] : undefined;
        const visual: Record<string, Scalar> = {};
        if (typeof size?.gap === "number") visual.gap = size.gap;
        if (typeof size?.minWidth === "number") visual.minWidth = size.minWidth;
        if (!Object.keys(visual).length) return [];
        const childProps = SUBPART_CHILD_PROPS[parentType]?.[token];
        return [
          {
            childType,
            ...(WRAPPED_BY_TRIGGER.has(childType) &&
            SUBPART_TOKENS[parentType]?.SelectTrigger
              ? { via: "SelectTrigger" }
              : {}),
            ...(childProps ? { childProps: { ...childProps } } : {}),
            layout: {},
            visual,
          },
        ];
      }),
  );
}

/**
 * Disclosure's trigger renders the chevron (`.disclosure-chevron`, `var(--icon-size)`) before the
 * heading text, separated by the trigger's gap: the typed header (a text leaf) starts its text
 * after that inset.
 */
function disclosureChevronPartRules(parentType: string): CompiledPartRule[] {
  if (parentType !== "Disclosure") return [];
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    parentType
  ];
  const trigger = (
    rule.structure?.composition as
      | { staticSelectors?: Record<string, Record<string, string>> }
      | undefined
  )?.staticSelectors?.[".react-aria-Button[slot='trigger']"];
  const padding = trigger ? spacing(substitute(trigger.padding ?? "", {}) ?? "") : undefined;
  const gap = trigger ? lengthPx(trigger.gap ?? "") : undefined;
  if (!padding || gap === undefined) return [];
  const left = padding[3] ?? padding[1] ?? padding[0];
  // The chevron reads the nearest `--icon-size`: the trigger's own `.react-aria-Button` sheet at
  // its default size (the element carries no `data-size`).
  const button = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>).Button;
  const buttonIcon = button?.defaultSize
    ? button.sizes[button.defaultSize]?.iconSize
    : undefined;
  const px = (value: unknown) => {
    const resolved =
      typeof value === "string" ? resolveToken(value as TokenRef) : value;
    return typeof resolved === "number" ? resolved : undefined;
  };
  // The trigger is a `.react-aria-Button`: its generated base `line-height` (default size, a
  // unitless ratio) stays while `font-size: inherit` takes the Disclosure's size font.
  const buttonSize = button?.defaultSize ? button.sizes[button.defaultSize] : undefined;
  const buttonFont = px(buttonSize?.fontSize);
  const buttonLine = px(buttonSize?.lineHeight);
  const lineHeight =
    buttonFont && buttonLine ? buttonLine / buttonFont : undefined;
  const top = padding[0];
  const bottom = padding[2] ?? padding[0];
  return sizeNames(rule).flatMap((size): CompiledPartRule[] => {
    const icon = buttonIcon ?? rule.sizes[size]?.iconSize;
    const fontSize =
      trigger?.["font-size"] === "inherit" ? px(rule.sizes[size]?.fontSize) : undefined;
    return typeof icon === "number"
      ? [
          {
            childType: "DisclosureHeader",
            size,
            layout: {},
            visual: {
              paddingLeft: left + icon + gap,
              ...(fontSize !== undefined ? { fontSize } : {}),
              ...(lineHeight !== undefined ? { lineHeight } : {}),
              // The flex row is at least as tall as the chevron (content = max(icon, line box)).
              minHeight: top + icon + bottom,
            },
          },
        ]
      : [];
  });
}

/**
 * The generator's heading/description child blocks (`CSSGenerator.generateChildFontStyles`):
 * `sizes.headingFontSize/Weight` → `.alert-heading` (margin 0, line-height 1.4) and
 * `sizes.descFontSize/Weight` → `.react-aria-Description` (margin 0, width 100%, line-height 1.5).
 */
function childFontPartRules(parentType: string): CompiledPartRule[] {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    parentType
  ];
  if (!rule?.structure) return [];
  const zeroMargin = {
    marginTop: "0px",
    marginRight: "0px",
    marginBottom: "0px",
    marginLeft: "0px",
  };
  return sizeNames(rule).flatMap((size): CompiledPartRule[] => {
    const values = rule.sizes[size] as Record<string, unknown>;
    const px = (value: unknown) =>
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? (() => {
              const resolved = resolveToken(value as TokenRef);
              return typeof resolved === "number" ? resolved : undefined;
            })()
          : undefined;
    const out: CompiledPartRule[] = [];
    const headingSize = px(values.headingFontSize);
    if (headingSize !== undefined || values.headingFontWeight != null)
      out.push({
        childType: "Heading",
        size,
        layout: zeroMargin,
        visual: {
          ...(headingSize !== undefined ? { fontSize: headingSize } : {}),
          ...(typeof values.headingFontWeight === "number"
            ? { fontWeight: values.headingFontWeight }
            : {}),
          lineHeight: 1.4,
        },
      });
    const descSize = px(values.descFontSize);
    if (descSize !== undefined || values.descFontWeight != null)
      out.push({
        childType: "Description",
        size,
        layout: zeroMargin,
        visual: {
          width: "100%",
          ...(descSize !== undefined ? { fontSize: descSize } : {}),
          ...(typeof values.descFontWeight === "number"
            ? { fontWeight: values.descFontWeight }
            : {}),
          lineHeight: 1.5,
        },
      });
    return out;
  });
}

/**
 * Child blocks of the rule's archetype base CSS (`ARCHETYPE_BASE_STYLES`, nested under the root
 * selector in every generated sheet of that archetype — e.g. slider `.react-aria-Label { grid-area:
 * label }`), as selector → declarations.
 */
function archetypeChildBlocks(
  rule: ComponentRule,
): Array<{ selector: string; declarations: Record<string, string> }> {
  const archetype = rule.structure?.archetype;
  const lines = archetype
    ? (ARCHETYPE_BASE_STYLES as Record<string, readonly string[]>)[archetype]
    : undefined;
  if (!lines) return [];
  const text = lines.join("\n");
  return [...text.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map((block) => ({
    selector: block[1].trim(),
    declarations: Object.fromEntries(
      block[2]
        .split(";")
        .map((declaration) => declaration.split(":"))
        .filter((pair) => pair.length >= 2)
        .map(([key, ...rest]) => [key.trim(), rest.join(":").trim()]),
    ),
  }));
}

/**
 * Part rules of rule `parentType` in declaration order (later wins, as in the stylesheet).
 * `choicesOf(childType, prop)` gives a child's declared choices for a `:not([attr])` complement.
 */
export function compileRulePartRules(
  parentType: string,
  choicesOf: (childType: string, prop: string) => readonly string[] | undefined,
): CompiledPartRule[] {
  // Selectors come from the rule whose generated sheet styles the DOM element.
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    domStyleRuleType(parentType)
  ];
  const composition = rule?.structure?.composition as
    | {
        staticSelectors?: Record<string, Record<string, string>>;
        /** Per-size child selectors (`.X[data-size="lg"] .bar`), emitted after the static ones. */
        sizeSelectors?: Record<string, Record<string, Record<string, string>>>;
        delegation?: Array<{
          childSelector?: string;
          variables?: Record<string, Record<string, string>>;
          bridges?: Record<string, string>;
        }>;
      }
    | undefined;
  if (!rule) return [];
  const blocks: Array<{
    selector: string;
    declarations: Record<string, string>;
    variables?: Record<string, Record<string, string>>;
    /** The owner size a `sizeSelectors` block belongs to. */
    size?: string;
  }> = [
    ...archetypeChildBlocks(rule),
    ...Object.entries(composition?.staticSelectors ?? {}).map(
      ([selector, declarations]) => ({ selector, declarations }),
    ),
    ...Object.entries(composition?.sizeSelectors ?? {}).flatMap(
      ([size, selectors]) =>
        Object.entries(selectors).map(([selector, declarations]) => ({
          selector,
          declarations,
          size,
        })),
    ),
    ...(composition?.delegation ?? []).flatMap((entry) =>
      entry.childSelector && entry.bridges && typeof entry.bridges === "object"
        ? [
            {
              selector: entry.childSelector,
              declarations: entry.bridges,
              variables: entry.variables,
            },
          ]
        : [],
    ),
  ];
  // Every delegation's per-size variables are declared on the root element, so any child
  // selector reads all of them (CSS custom property inheritance).
  const manual = manualBoxRule(parentType);
  const manualParts = manual?.parts ?? [];
  const rootVariables: Record<string, Record<string, string>> = {};
  for (const block of blocks)
    for (const [size, values] of Object.entries(block.variables ?? {}))
      Object.assign((rootVariables[size] ??= {}), values);
  const out: CompiledPartRule[] = [
    ...ownerVariablePartRules(parentType),
    ...tokenRuleBasePartRules(parentType),
    ...sliderThumbPartRules(parentType),
    ...disclosureChevronPartRules(parentType),
    ...indicatorPartRules(parentType),
    ...fieldValuePartRules(parentType),
    ...textAreaPartRules(parentType),
    ...childFontPartRules(parentType),
    ...manualParts,
  ];
  for (const block of blocks) {
    for (const part of selectorList(block.selector)) {
      const whole = Object.values(SUBPART_TOKENS[parentType] ?? {}).some(
        (tokens) => tokens.includes(part),
      );
      const simple = whole ? { token: part, conditions: [] } : parseSimple(part);
      if (!simple) continue;
      const target = childTypeOf(parentType, simple.token);
      if (!target) continue;
      const childProps: Record<string, Scalar> = {
        ...SUBPART_CHILD_PROPS[parentType]?.[part],
      };
      let expressible = true;
      for (const condition of simple.conditions) {
        const prop = ATTRIBUTE_PROPS[condition.prop];
        if (!prop) {
          expressible = false;
          break;
        }
        if (!condition.negate) childProps[prop] = condition.value;
        else {
          const rest = (choicesOf(target.childType, prop) ?? []).filter(
            (choice) => choice !== condition.value,
          );
          if (rest.length !== 1) {
            expressible = false;
            break;
          }
          childProps[prop] = rest[0];
        }
      }
      if (!expressible) continue;
      const sizes = block.size
        ? [block.size]
        : sizeNames(rule).length
          ? sizeNames(rule)
          : [undefined];
      const compiled = sizes.map((size) => {
        const areas = resolveCatalogRuleCanvasBox(parentType, size)
          .gridTemplateAreas as string | undefined;
        const compiledBlock = compileDeclarations(
          target.childType,
          block.declarations,
          (size && rootVariables[size]) || {},
          areas,
        );
        const glyph = whole ? GLYPH_TOKENS[part] : undefined;
        if (glyph && typeof compiledBlock.visual.width === "number") {
          const { width, height, ...rest } = compiledBlock.visual;
          compiledBlock.visual = {
            ...rest,
            iconSize: width,
            ...(glyph.box ? { width, height } : {}),
          };
        }
        return { size, ...compiledBlock };
      });
      const same = !block.size && compiled.every(
        (entry) =>
          JSON.stringify([entry.layout, entry.visual]) ===
          JSON.stringify([compiled[0].layout, compiled[0].visual]),
      );
      for (const entry of same
        ? [{ ...compiled[0], size: undefined }]
        : compiled) {
        if (
          !Object.keys(entry.layout).length &&
          !Object.keys(entry.visual).length
        )
          continue;
        out.push({
          childType: target.childType,
          ...(target.via ? { via: target.via } : {}),
          ...(Object.keys(childProps).length ? { childProps } : {}),
          ...(entry.size ? { size: entry.size } : {}),
          layout: entry.layout,
          visual: entry.visual,
        });
      }
    }
  }
  // Generated `[data-size]` selectors never match a root without that attribute: only the default
  // size's values apply, for every size (manual parts keep their real size keys).
  if (manual?.rootSizeAttribute !== undefined)
    return out.flatMap((part): CompiledPartRule[] => {
      if (manualParts.includes(part) || !part.size) return [part];
      if (part.size !== rule.defaultSize) return [];
      const { size: _size, ...unsized } = part;
      return [unsized];
    });
  return out;
}

/**
 * Item wrappers a group's DOM renderer composes around its items (`CheckboxGroup.tsx`
 * `<div className="checkbox-items">`, `RadioGroup.tsx` `radio-items`): the wrapper's class token
 * and the item types it holds.
 */
const ITEMS_WRAPPERS: Readonly<
  Record<string, { token: string; itemTypes: readonly string[] }>
> = {
  CheckboxGroup: { token: ".checkbox-items", itemTypes: ["Checkbox"] },
  RadioGroup: { token: ".radio-items", itemTypes: ["Radio"] },
};

/**
 * The items wrapper of group `type` at the resolved `props` (orientation / size), from the rule's
 * `containerVariants.orientation[…].nested` block for the wrapper token and the size's custom
 * properties (`--cb-items-gap`): a flex box whose items stretch across it (the widest item sets
 * every item's width in a column). Undefined for a type without one.
 */
export function catalogItemsWrapper(
  type: string,
  props: Readonly<Record<string, unknown>>,
):
  | {
      itemTypes: readonly string[];
      layout: { display: string; flexDirection: string; alignItems?: string };
      gap: number;
    }
  | undefined {
  const wrapper = ITEMS_WRAPPERS[type];
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[type];
  if (!wrapper || !rule) return undefined;
  type Styles = Record<string, string>;
  type Variants = Record<
    string,
    Record<string, { styles?: Styles; nested?: Array<{ selector: string; styles: Styles }> }>
  >;
  const composition = rule.structure?.composition as
    | { containerStyles?: Styles; containerVariants?: Variants }
    | undefined;
  const variants = composition?.containerVariants ?? {};
  const orientation =
    typeof props.orientation === "string" ? props.orientation : "vertical";
  const block = variants.orientation?.[orientation]?.nested?.find(
    (entry) => entry.selector === wrapper.token,
  )?.styles;
  if (!block) return undefined;
  // A root without `data-size` never matches the generated size variables.
  const size =
    typeof props.size === "string" &&
    manualBoxRule(type)?.rootSizeAttribute === undefined
      ? props.size
      : (rule.defaultSize ?? "");
  const variables: Record<string, string> = {};
  for (const source of [composition?.containerStyles, variants.size?.[size]?.styles])
    for (const [key, value] of Object.entries(source ?? {}))
      if (key.startsWith("--")) variables[key] = value;
  const gapText = block.gap ? substitute(block.gap, variables) : undefined;
  return {
    itemTypes: wrapper.itemTypes,
    layout: {
      display: block.display ?? "flex",
      flexDirection: block["flex-direction"] ?? "row",
      ...(block["align-items"] ? { alignItems: block["align-items"] } : {}),
    },
    gap: (gapText !== undefined ? lengthPx(gapText) : undefined) ?? 0,
  };
}
