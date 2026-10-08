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
  deriveAutoDelegationVariables,
  resolveToken,
  type TokenRef,
} from "@composition/rendering";
import { componentCatalog } from "../componentCatalog";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import {
  catalogTextAreaInputHeight,
  resolveCatalogRuleCanvasBox,
} from "../resolvers/resolveCatalogRuleCanvasBox";
import {
  isDelegatedSubpartChild,
  OWNER_DRAWN_PART_HOSTS,
} from "../resolvers/resolveDelegatedChildFontSize";
import { resolveTriggerIconSize } from "../resolvers/resolveTriggerIconSize";
import type { ComponentRule } from "../../types/catalog-style.types";
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
 * the typed child type → the class/attribute tokens its DOM element carries. Children under a
 * field's control `Group` are reached through it (`via`). Absent entries use `.react-aria-<Type>`.
 */
const SUBPART_TOKENS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  // ADR-253: the trigger is a Button instance (its own class token) holding the value and an Icon.
  Select: { SelectValue: [".react-aria-SelectValue"] },
  // ADR-253: the container holds an Input instance and a FieldButton instance (their own tokens).
  ComboBox: { Group: [".combobox-container"] },
  // ADR-253: the Group holds an Input instance and two Button instances (their own class tokens).
  NumberField: { Group: [".react-aria-Group"] },
  // ADR-253: the container holds the search glyph (an Icon — whole selectors: a direct child, not
  // the clear button's own glyph), an Input instance and a Button instance.
  SearchField: {
    Group: [".searchfield-container"],
    Icon: [
      ".searchfield-container > .react-aria-Icon",
      ".searchfield-container > .react-aria-Icon svg",
    ],
  },
  // ADR-253: the Group holds a DateInput instance and a FieldButton instance (their own tokens).
  DatePicker: { Group: [".react-aria-Group"] },
  // ADR-253: the Group (the box) holds the pair's DateInput instances around the separator (a Text
  // node — a whole selector: the Group's own child) and a FieldButton instance.
  DateRangePicker: {
    Group: [".react-aria-Group"],
    Text: [".react-aria-Group > .react-aria-Text"],
  },
  ProgressBar: { ProgressBarValue: [".value"], ProgressBarTrack: [".bar"] },
  Meter: { MeterValue: [".value"], MeterTrack: [".bar"] },
  // ADR-251: the group's items wrapper (`RadioGroup.tsx` `div.radio-items`) is the typed
  // RadioItems / CheckboxItems node — the rule's `orientation` nested block lays it out.
  RadioGroup: { RadioItems: [".radio-items"] },
  CheckboxGroup: { CheckboxItems: [".checkbox-items"] },
  // A toggle's indicator node (2026-10-04): the indicator element. ADR-256 Phase 3: the Radio's is
  // `div.indicator` in its RAC RadioButton (was `.react-aria-Radio::before`).
  Radio: {
    RadioButton: [".react-aria-RadioButton"],
    RadioIndicator: [".indicator"],
  },
  // ADR-256 Phase 3: the catalog Checkbox is RAC `CheckboxField` around a `CheckboxButton` (the row
  // the indicator sits in — reached `via` it, `TOGGLE_BUTTONS`).
  Checkbox: {
    CheckboxButton: [".react-aria-CheckboxButton"],
    CheckboxIndicator: [".checkbox"],
  },
  Switch: {
    SwitchButton: [".react-aria-SwitchButton"],
    SwitchIndicator: [".indicator"],
  },
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
> = {};
/**
 * `… svg` tokens size the glyph (`iconSize`). `box`: the glyph's wrapper has no size of its own
 * (`.search-icon` flex span), so the svg size is also the child's box.
 */
const GLYPH_TOKENS: Readonly<Record<string, { box: boolean }>> = {
  ".searchfield-container > .react-aria-Icon svg": { box: true },
};
/**
 * Typed children that stand for several owner-composed DOM parts (their box is the parts' union).
 * None now: a DateRangePicker's start and end are DateInput nodes of their own (ADR-253).
 */
const SUBPART_UNION: Readonly<Record<string, ReadonlySet<string>>> = {};
/** Whether the typed child's DOM box is the union of every part its selectors match. */
export function catalogSubpartDomUnion(
  ownerType: string,
  childType: string,
): boolean {
  return SUBPART_UNION[ownerType]?.has(childType) ?? false;
}
/**
 * The node an owner's wrapped parts sit under (`via`): the control `Group` of a field that has one
 * (ADR-256 Phase 6b), a Select's trigger Button (ADR-253 — RAC's trigger is the Button itself).
 */
const SUBPART_WRAPPERS: Readonly<Record<string, string>> = { Select: "Button" };
/**
 * ADR-256 Phase 3 — the RAC button a toggle's indicator sits in (`CheckboxField > CheckboxButton >
 * indicator`, `OWNER_DRAWN_PART_HOSTS`): toggle type → its button type.
 */
const TOGGLE_BUTTONS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(OWNER_DRAWN_PART_HOSTS).map(([button, owner]) => [
    owner,
    button,
  ]),
);
function wrapperOf(parentType: string, childType: string): string | undefined {
  if (TOGGLE_BUTTONS[parentType] && childType === `${parentType}Indicator`)
    return TOGGLE_BUTTONS[parentType];
  if (!WRAPPED_BY_TRIGGER.has(childType)) return undefined;
  const wrapper =
    SUBPART_WRAPPERS[parentType] ??
    (SUBPART_TOKENS[parentType]?.Group ? "Group" : undefined);
  return wrapper === childType ? undefined : wrapper;
}
const WRAPPED_BY_TRIGGER: ReadonlySet<string> = new Set([
  "SelectValue",
  "SelectIcon",
  "DateInput",
  // ADR-253: the parts a field's wrapper holds — instances of their origins, a field's glyph,
  // a range picker's separator.
  "Input",
  "Button",
  "Icon",
  "Text",
]);
const SHARED_TOKENS: Readonly<Record<string, string>> = {
  '[slot="description"]': "Description",
};

/** DOM attribute → typed prop of the matched child. */
const ATTRIBUTE_PROPS: Readonly<Record<string, string>> = {
  "aria-orientation": "orientation",
  // RAC's named slot of one of an owner's same-type parts (a range picker's `start` · `end`).
  slot: "slot",
};

/**
 * Custom properties a child's stylesheet consumes as its own declaration (`Tab.css`
 * `font-size: var(--tab-font-size)` …): the delegation bridge sets the variable, the child
 * declares the property. A Label and a field Input take none (ADR-253: their own rules size them
 * at their owner's size).
 */
const CONSUMED_VARIABLES: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
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
  const reached = (childType: string) => {
    const via = wrapperOf(parentType, childType);
    return via ? { childType, via } : { childType };
  };
  for (const [childType, tokens] of Object.entries(own))
    if (tokens.includes(token)) return reached(childType);
  if (SHARED_TOKENS[token]) return { childType: SHARED_TOKENS[token] };
  const rac = /^\.react-aria-([A-Z]\w*)$/.exec(token)?.[1];
  if (!rac || !(rac in COMPONENT_RULES_TABLE)) return undefined;
  // A token the owner maps to another child is not this type's own element.
  if (Object.values(own).some((tokens) => tokens.includes(token)))
    return undefined;
  return reached(rac);
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
/** Root font size of the Preview document (`rem`): the UA default, which the Preview reset keeps. */
const ROOT_FONT_PX = 16;

function lengthPx(value: string): number | undefined {
  const text = value.trim();
  // `calc(a + b)` / `calc(a - b)` of resolvable lengths (side label indent: label width + gap).
  const calc = /^calc\((.+)\)$/.exec(text)?.[1];
  if (calc) {
    const terms = calc.split(/\s+([+-])\s+/);
    let total = lengthPx(terms[0]);
    for (
      let index = 1;
      total !== undefined && index < terms.length;
      index += 2
    ) {
      const term = lengthPx(terms[index + 1]);
      total =
        term === undefined
          ? undefined
          : total + (terms[index] === "-" ? -term : term);
    }
    return total;
  }
  const rem = /^(-?\d+(?:\.\d+)?)rem$/.exec(text);
  if (rem) return Number(rem[1]) * ROOT_FONT_PX;
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
      if (
        CSS_SPACING_PX[name] !== undefined ||
        cssVarToTokenRef(`var(${name})`)
      )
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
    } else if (key === "order") {
      if (/^-?\d+$/.test(value)) layout.order = value;
    } else if (key === "margin-inline-start" || key === "margin-inline-end") {
      // Left-to-right documents (the Builder and Preview direction).
      const px = lengthPx(value);
      if (px !== undefined)
        layout[key === "margin-inline-start" ? "marginLeft" : "marginRight"] =
          `${px}px`;
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
        visual[`padding${key[8].toUpperCase()}${key.slice(9)}` as VisualField] =
          px;
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
 * Inline padding of a DateInput's RAC date segments (the DateInput rule's `.react-aria-DateSegment`
 * bridge, `padding: 0 2px` — ADR-253: one definition for every date field): editable segments
 * carry it on both sides, literals do not (`[data-type="literal"] { padding: 0 }`).
 */
export function catalogDateSegmentPaddingX(): number {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)
    .DateInput;
  const delegation = (
    rule?.structure?.composition as
      | {
          delegation?: Array<{
            childSelector?: string;
            bridges?: Record<string, string>;
          }>;
        }
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
 * Paint of a DateInput's empty RAC date segments (the DateInput rule's
 * `.react-aria-DateSegment[data-placeholder]` state — the editable segments; literals keep the
 * field color): the CSS color as written, its opacity and font style.
 */
export function catalogDateSegmentPlaceholderPaint(): {
  color?: string;
  opacity?: number;
  fontStyle?: string;
} {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)
    .DateInput;
  const delegation = (
    rule?.structure?.composition as
      | {
          delegation?: Array<{
            childSelector?: string;
            states?: Record<string, Record<string, string>>;
          }>;
        }
      | undefined
  )?.delegation;
  const state = delegation?.find(
    (entry) => entry.childSelector === ".react-aria-DateSegment",
  )?.states?.["[data-placeholder]"];
  const opacity = Number(state?.opacity);
  return {
    ...(typeof state?.color === "string" ? { color: state.color } : {}),
    ...(state?.opacity !== undefined && Number.isFinite(opacity)
      ? { opacity }
      : {}),
    ...(typeof state?.["font-style"] === "string"
      ? { fontStyle: state["font-style"] }
      : {}),
  };
}

/**
 * Paint of a Select's value while it shows the placeholder (the Select rule's
 * `.react-aria-SelectValue[data-placeholder]` delegation state — what the DOM sheet applies until
 * something is chosen) in `mode`: its color as hex with the state's opacity folded into the alpha.
 * The Canvas draws no selection (a choice is the Preview's run state), so its value always shows
 * the placeholder. Undefined when the rule declares no such color.
 */
export function catalogSelectPlaceholderColor(
  mode: "light" | "dark",
): string | undefined {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>).Select;
  const state = (
    rule?.structure?.composition as
      | {
          delegation?: Array<{
            childSelector?: string;
            states?: Record<string, Record<string, string>>;
          }>;
        }
      | undefined
  )?.delegation?.find(
    (entry) => entry.childSelector === ".react-aria-SelectValue",
  )?.states?.["[data-placeholder]"];
  if (typeof state?.color !== "string") return undefined;
  const token = cssVarToTokenRef(state.color);
  const resolved = token ? resolveToken(token, mode) : state.color;
  if (typeof resolved !== "string" || !/^#[0-9a-f]{6}$/i.test(resolved))
    throw new Error(
      `CATALOG_SELECT_PLACEHOLDER_COLOR_UNSUPPORTED:${state.color}`,
    );
  const opacity = Number(state.opacity);
  return state.opacity !== undefined && Number.isFinite(opacity) && opacity < 1
    ? `${resolved}${Math.round(Math.max(0, opacity) * 255)
        .toString(16)
        .padStart(2, "0")}`
    : resolved;
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
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)
    .DropZone;
  const delegation = (
    rule?.structure?.composition as
      | {
          delegation?: Array<{
            childSelector?: string;
            bridges?: Record<string, string>;
          }>;
        }
      | undefined
  )?.delegation;
  const text = (selector: string): CatalogDropZoneTextStyle => {
    const bridges =
      delegation?.find((entry) => entry.childSelector === selector)?.bridges ??
      {};
    const size = bridges["font-size"];
    const fontSize =
      typeof size === "string" && size.trim() !== "inherit"
        ? lengthPx(size)
        : undefined;
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
 * A toggle-indicator control's indicator box (checkbox box, radio circle, switch track —
 * `sizes[size].indicator`): the `CheckboxIndicator` / `RadioIndicator` / `SwitchIndicator` child
 * node (2026-10-04), sized like the RAC indicator element that sits before the label in the DOM
 * row. The control's `gap` then separates it from the label (flex row), as in the DOM.
 */
export function catalogToggleIndicatorBox(
  type: string,
  sizeName: string | undefined,
): { width: number; height: number } | undefined {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[type];
  if (rule?.structure?.archetype !== "toggle-indicator") return undefined;
  const size =
    rule.sizes?.[sizeName ?? ""] ??
    (rule.defaultSize ? rule.sizes?.[rule.defaultSize] : undefined);
  const indicator = size?.indicator;
  if (typeof indicator?.boxSize === "number")
    return { width: indicator.boxSize, height: indicator.boxSize };
  if (
    typeof indicator?.trackWidth === "number" &&
    typeof indicator?.trackHeight === "number"
  )
    return { width: indicator.trackWidth, height: indicator.trackHeight };
  return undefined;
}

function toggleIndicatorPartRules(parentType: string): CompiledPartRule[] {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    parentType
  ];
  if (rule?.structure?.archetype !== "toggle-indicator") return [];
  return sizeNames(rule).flatMap((size) => {
    const box = catalogToggleIndicatorBox(parentType, size);
    return box === undefined
      ? []
      : [
          {
            childType: `${parentType}Indicator`,
            // (Inside the toggle's RAC button when it has one — ADR-256 Phase 3.)
            ...(TOGGLE_BUTTONS[parentType]
              ? { via: TOGGLE_BUTTONS[parentType] }
              : {}),
            size,
            layout: { flexShrink: "0" },
            visual: { width: box.width, height: box.height },
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
        const size = rule.defaultSize
          ? rule.sizes[rule.defaultSize]
          : undefined;
        const visual: Record<string, Scalar> = {};
        if (typeof size?.gap === "number") visual.gap = size.gap;
        if (typeof size?.minWidth === "number") visual.minWidth = size.minWidth;
        if (!Object.keys(visual).length) return [];
        const childProps = SUBPART_CHILD_PROPS[parentType]?.[token];
        return [
          {
            childType,
            ...(wrapperOf(parentType, childType)
              ? { via: wrapperOf(parentType, childType) }
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
 * Disclosure's trigger (the typed header) renders the chevron (`.disclosure-chevron`,
 * `var(--icon-size)`, `flex-shrink: 0`) and the title Text, separated by the trigger's gap
 * (`DisclosureChevron` · `Text` nodes, 2026-10-07 — the flex row lays them out). The title Text
 * takes the trigger's font (`… > .react-aria-Text` inherits size, line height and color; its weight
 * is the trigger's 600). A header saved before the nodes is a text leaf: its own rule's
 * `leadingIcon` shifts the text past the chevron (`buildCatalogShapes`).
 */
function disclosureChevronPartRules(parentType: string): CompiledPartRule[] {
  if (parentType !== "Disclosure") return [];
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    parentType
  ];
  const trigger = (
    rule.structure?.composition as
      { staticSelectors?: Record<string, Record<string, string>> } | undefined
  )?.staticSelectors?.[".react-aria-Button[slot='trigger']"];
  // (The trigger's padding and gap reach the header through its selector — `compileRulePartRules`.)
  if (!trigger) return [];
  // The chevron reads the nearest `--icon-size`: the trigger's own `.react-aria-Button` sheet at
  // its default size (the element carries no `data-size`).
  const button = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)
    .Button;
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
  const buttonSize = button?.defaultSize
    ? button.sizes[button.defaultSize]
    : undefined;
  const buttonFont = px(buttonSize?.fontSize);
  const buttonLine = px(buttonSize?.lineHeight);
  const lineHeight =
    buttonFont && buttonLine ? buttonLine / buttonFont : undefined;
  const titleWeight = Number(trigger?.["font-weight"]);
  return sizeNames(rule).flatMap((size): CompiledPartRule[] => {
    const icon = buttonIcon ?? rule.sizes[size]?.iconSize;
    const fontSize =
      trigger?.["font-size"] === "inherit"
        ? px(rule.sizes[size]?.fontSize)
        : undefined;
    const font = {
      ...(fontSize !== undefined ? { fontSize } : {}),
      ...(lineHeight !== undefined ? { lineHeight } : {}),
    };
    return typeof icon === "number"
      ? [
          { childType: "DisclosureHeader", size, layout: {}, visual: font },
          {
            childType: "DisclosureChevron",
            via: "DisclosureHeader",
            size,
            layout: { flexShrink: "0" },
            visual: { width: icon, height: icon },
          },
          {
            childType: "Text",
            via: "DisclosureHeader",
            size,
            layout: {},
            visual: {
              ...font,
              ...(titleWeight > 0 ? { fontWeight: titleWeight } : {}),
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

type ContainerVariantBlock = {
  styles?: Record<string, string>;
  nested?: Array<{ selector: string; styles?: Record<string, string> }>;
};
type ContainerVariants = Record<string, Record<string, ContainerVariantBlock>>;

/**
 * Container variant axes a field-family root renders as its own `data-*` attribute, with the
 * typed prop that drives it (`Select.tsx` `data-label-position={labelPosition}` …). The generated
 * CSS emits `.X[data-label-position="side"]` and its nested child selectors from
 * `structure.composition.containerVariants` (the top-level mirror carries the root styles only).
 */
const CONTAINER_VARIANT_AXES: Readonly<Record<string, string>> = {
  "label-position": "labelPosition",
};
/** The side label column's alignment axis: its blocks only declare `--form-label-align`. */
const LABEL_ALIGN_AXIS = {
  attribute: "label-align",
  prop: "labelAlign",
} as const;
/**
 * Typed direct children a side `> :not(.react-aria-Label, …)` selector reaches: the field's control
 * box (TextField `Input`, DateField `DateInput`, the picker / NumberField / SearchField trigger).
 */
const FIELD_CONTROL_TYPES = [
  "Input",
  // (A picker / NumberField / SearchField control Group — ADR-256 Phase 6b.)
  "Group",
  "DateInput",
  // (A Select's trigger — a Button instance, ADR-253.)
  "Button",
] as const;

function containerVariantsOf(
  rule: ComponentRule,
): ContainerVariants | undefined {
  return ((
    rule.structure?.composition as { containerVariants?: unknown } | undefined
  )?.containerVariants ?? rule.containerVariants) as
    ContainerVariants | undefined;
}

/** Custom properties a variant block declares on the root (inherited by every descendant). */
function blockVariables(
  block: ContainerVariantBlock | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(block?.styles ?? {}))
    if (key.startsWith("--")) out[key] = value;
  return out;
}

/**
 * Root values of rule `type`'s prop-driven container variants (`[data-label-position="side"]`):
 * one rule per axis value, applied when the owner's resolved prop has that value.
 */
export function catalogContainerVariantRootRules(type: string): Array<{
  when: Readonly<Record<string, string>>;
  layout: Record<string, string>;
  visual: Record<string, Scalar>;
}> {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    domStyleRuleType(type)
  ];
  const variants = rule ? containerVariantsOf(rule) : undefined;
  if (!variants) return [];
  const out: ReturnType<typeof catalogContainerVariantRootRules> = [];
  for (const [attribute, prop] of Object.entries(CONTAINER_VARIANT_AXES))
    for (const [value, block] of Object.entries(variants[attribute] ?? {})) {
      const compiled = compileDeclarations(
        type,
        block.styles ?? {},
        {},
        undefined,
      );
      if (
        Object.keys(compiled.layout).length ||
        Object.keys(compiled.visual).length
      )
        out.push({ when: { [prop]: value }, ...compiled });
    }
  return out;
}

/**
 * Child values of the prop-driven container variants (`[data-label-position="side"] > .react-aria-Label`
 * …), per owner size (the blocks read per-size gap variables) and label alignment. Emitted after
 * every other part rule: the attribute selector is the more specific one in the sheet.
 */
function containerVariantPartRules(
  parentType: string,
  rule: ComponentRule,
  rootVariables: Readonly<Record<string, Record<string, string>>>,
): CompiledPartRule[] {
  const variants = containerVariantsOf(rule);
  if (!variants) return [];
  const aligns = variants[LABEL_ALIGN_AXIS.attribute] ?? {};
  const sizes = sizeNames(rule).length ? sizeNames(rule) : [undefined];
  const out: CompiledPartRule[] = [];
  for (const [attribute, prop] of Object.entries(CONTAINER_VARIANT_AXES))
    for (const [value, block] of Object.entries(variants[attribute] ?? {}))
      for (const entry of block.nested ?? []) {
        const selector = entry.selector.trim().replace(/^>\s*/, "");
        const excluded = /^:not\((.*)\)$/.exec(selector)?.[1];
        const targets: Array<{ childType: string; via?: string }> = excluded
          ? [
              ...FIELD_CONTROL_TYPES,
              // A group's items wrapper (ADR-251) is its content beside a side label.
              ...(ITEMS_WRAPPERS[parentType]
                ? [ITEMS_WRAPPERS[parentType].childType]
                : []),
            ]
              .filter((childType) => {
                const tokens = SUBPART_TOKENS[parentType]?.[childType] ?? [
                  `.react-aria-${childType}`,
                ];
                const skip = excluded.split(",").map((token) => token.trim());
                return !tokens.some((token) => skip.includes(token));
              })
              .map((childType) => ({ childType }))
          : selectorList(selector).flatMap((part) => {
              const simple = parseSimple(part);
              const target =
                simple && !simple.conditions.length
                  ? childTypeOf(parentType, simple.token)
                  : undefined;
              return target ? [target] : [];
            });
        for (const target of targets) {
          const compile = (
            size: string | undefined,
            align: string | undefined,
          ) => {
            const variables = {
              ...((size && rootVariables[size]) || {}),
              ...blockVariables(block),
              ...(align ? blockVariables(aligns[align]) : {}),
            };
            const compiled = compileDeclarations(
              target.childType,
              entry.styles ?? {},
              variables,
              undefined,
            );
            // The side label column's text alignment (`text-align: var(--form-label-align, start)`):
            // read here only — the label is a text leaf, which paints its alignment.
            const textAlign = entry.styles?.["text-align"];
            const aligned = textAlign
              ? substitute(textAlign, variables)
              : undefined;
            if (aligned && /^(left|center|right|start|end)$/.test(aligned))
              compiled.visual.textAlign = aligned;
            return compiled;
          };
          const key = (compiled: ReturnType<typeof compile>) =>
            JSON.stringify([compiled.layout, compiled.visual]);
          const base = sizes.map((size) => ({
            size,
            ...compile(size, undefined),
          }));
          const uniform = base.every((item) => key(item) === key(base[0]));
          const push = (
            size: string | undefined,
            align: string | undefined,
            compiled: ReturnType<typeof compile>,
          ) => {
            if (
              !Object.keys(compiled.layout).length &&
              !Object.keys(compiled.visual).length
            )
              return;
            out.push({
              childType: target.childType,
              ...(target.via ? { via: target.via } : {}),
              ...(size ? { size } : {}),
              ownerProps: {
                [prop]: value,
                ...(align ? { [LABEL_ALIGN_AXIS.prop]: align } : {}),
              },
              layout: compiled.layout,
              visual: compiled.visual,
            });
          };
          for (const item of uniform ? [{ ...base[0], size: undefined }] : base)
            push(item.size, undefined, item);
          for (const align of Object.keys(aligns))
            for (const item of uniform
              ? [{ ...base[0], size: undefined }]
              : base) {
              const aligned = compile(item.size ?? sizes[0], align);
              if (key(aligned) !== key(item)) push(item.size, align, aligned);
            }
        }
      }
  return out;
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
  // A declaration-only `variables: "auto"` entry (no bridges — a side label field's
  // `--{prefix}-gap`, which its hint indent `calc(label width + gap)` reads): the generator
  // derives its per-size values from the rule's sizes, and so do the part rules (ADR-253 — the
  // hint parts are drawn on the Canvas too).
  for (const entry of (composition?.delegation ?? []) as unknown[]) {
    const delegation = entry as {
      variables?: unknown;
      bridges?: unknown;
      prefix?: string;
    };
    if (delegation.variables !== "auto" || delegation.bridges) continue;
    for (const [size, values] of Object.entries(
      deriveAutoDelegationVariables(
        { name: parentType, sizes: rule.sizes } as never,
        delegation as never,
      ),
    ))
      Object.assign((rootVariables[size] ??= {}), values);
  }
  const out: CompiledPartRule[] = [
    ...ownerVariablePartRules(parentType),
    ...tokenRuleBasePartRules(parentType),
    ...sliderThumbPartRules(parentType),
    ...disclosureChevronPartRules(parentType),
    ...toggleIndicatorPartRules(parentType),
    ...fieldValuePartRules(parentType),
    ...textAreaPartRules(parentType),
    ...childFontPartRules(parentType),
    ...itemsWrapperPartRules(parentType),
    ...manualParts,
  ];
  for (const block of blocks) {
    for (const part of selectorList(block.selector)) {
      const whole = Object.values(SUBPART_TOKENS[parentType] ?? {}).some(
        (tokens) => tokens.includes(part),
      );
      const simple = whole
        ? { token: part, conditions: [] }
        : parseSimple(part);
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
      const same =
        !block.size &&
        compiled.every(
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
  out.push(...containerVariantPartRules(parentType, rule, rootVariables));
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
 * ADR-251 — the items wrapper node of a group (`RadioGroup.tsx` `<div className="radio-items">`,
 * typed RadioItems / CheckboxItems): its wrapper token's blocks in the group rule.
 */
const ITEMS_WRAPPERS: Readonly<
  Record<string, { token: string; childType: string }>
> = {
  CheckboxGroup: { token: ".checkbox-items", childType: "CheckboxItems" },
  RadioGroup: { token: ".radio-items", childType: "RadioItems" },
};

/**
 * The items wrapper's box per group `orientation` × `size` (ADR-251 — was the Canvas-only composed
 * part `catalogItemsWrapper`): the rule's `containerVariants.orientation[…].nested` block for the
 * wrapper token, its gap read through the size's custom properties (`--radio-items-gap`). A root
 * without `data-size` never matches the generated size variables (the default size's value).
 */
function itemsWrapperPartRules(parentType: string): CompiledPartRule[] {
  const wrapper = ITEMS_WRAPPERS[parentType];
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    parentType
  ];
  if (!wrapper || !rule) return [];
  type Styles = Record<string, string>;
  type Variants = Record<
    string,
    Record<
      string,
      { styles?: Styles; nested?: Array<{ selector: string; styles: Styles }> }
    >
  >;
  const composition = rule.structure?.composition as
    { containerStyles?: Styles; containerVariants?: Variants } | undefined;
  const variants = composition?.containerVariants ?? {};
  const sized = manualBoxRule(parentType)?.rootSizeAttribute === undefined;
  const out: CompiledPartRule[] = [];
  for (const [orientation, entry] of Object.entries(
    variants.orientation ?? {},
  )) {
    const block = entry.nested?.find(
      (nested) => nested.selector === wrapper.token,
    )?.styles;
    if (!block) continue;
    for (const size of Object.keys(rule.sizes)) {
      const variables: Record<string, string> = {};
      for (const source of [
        composition?.containerStyles,
        sized ? variants.size?.[size]?.styles : undefined,
      ])
        for (const [key, value] of Object.entries(source ?? {}))
          if (key.startsWith("--")) variables[key] = value;
      const gapText = block.gap ? substitute(block.gap, variables) : undefined;
      const gap = (gapText !== undefined ? lengthPx(gapText) : undefined) ?? 0;
      out.push({
        childType: wrapper.childType,
        size,
        ownerProps: { orientation },
        layout: {
          display: block.display ?? "flex",
          flexDirection: block["flex-direction"] ?? "row",
          ...(block["align-items"] ? { alignItems: block["align-items"] } : {}),
          rowGap: `${gap}px`,
          columnGap: `${gap}px`,
        },
        visual: {},
      });
    }
  }
  return out;
}
