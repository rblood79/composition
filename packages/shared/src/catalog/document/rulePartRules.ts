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
import { CATALOG_FIELD_LABEL_PART_ALIASES } from "./contextualHelp";
import { CATALOG_CONTEXTUAL_HELP_FIELDS } from "../../domain/componentTraits";
import {
  ARCHETYPE_BASE_STYLES,
  cssVarToTokenRef,
  deriveAutoDelegationVariables,
  ICON_SIZE_TOKEN_REF,
  resolveToken,
  ruleSizeLengthRef,
  spacing as SPACING_TOKENS,
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
import type { ComponentRule } from "../../types/catalog-style.types";
import { CATALOG_FORM_FIELDS } from "./formContext";
import { manualBoxRule } from "./manualBoxRules";
import { catalogFieldBoxStyle } from "../runtime/fieldPrefix";
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
  // ADR-256 G5 (example 5): the field holds the search glyph (an Icon — its own child: the rule's
  // `> .react-aria-Icon`, not the clear button's glyph), an Input instance and a Button instance —
  // no control Group (the reference's grid).
  SearchField: {
    Icon: [".react-aria-Icon", ".react-aria-Icon svg"],
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
  // Whole selectors (matched as written): the header Heading, its trigger Button and the panel's
  // content box (ADR-256 Phase 8c — the reference `Heading > Button[slot=trigger]` +
  // `DisclosurePanel > div`).
  Disclosure: {
    Heading: [".react-aria-Heading"],
    Button: [".react-aria-Button[slot='trigger']"],
    DisclosurePanel: [".react-aria-DisclosurePanel > div"],
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
 * that pick it (a Disclosure's trigger Button, told apart from other Buttons by its `slot`).
 */
const SUBPART_CHILD_PROPS: Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, Scalar>>>>>
> = {
  // ADR-256 Phase 8c: the Disclosure's trigger is the Button in RAC's `trigger` slot.
  Disclosure: { ".react-aria-Button[slot='trigger']": { slot: "trigger" } },
};
/**
 * `… svg` tokens size the glyph (`iconSize`). `box`: the glyph's wrapper has no size of its own
 * (`.search-icon` flex span), so the svg size is also the child's box.
 */
const GLYPH_TOKENS: Readonly<Record<string, { box: boolean }>> = {
  ".react-aria-Icon svg": { box: true },
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
const SUBPART_WRAPPERS: Readonly<Record<string, string>> = {
  Select: "Button",
  // ADR-256 Phase 8c: a Disclosure's trigger Button sits in its header Heading.
  Disclosure: "Heading",
  // ADR-256 Phase 10: a Card's title · description Text nodes sit in its S2 Content.
  Card: "Content",
};
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
/**
 * ADR-259 Phase 2 — fields whose control Group exists only to hold a prefix (the prefix command
 * wraps their Input): their prefix Text · Icon sits in that Group; their Input keeps its own path.
 */
const PREFIX_GROUP_FIELDS: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "ColorField",
]);
function wrapperOf(parentType: string, childType: string): string | undefined {
  if (TOGGLE_BUTTONS[parentType] && childType === `${parentType}Indicator`)
    return TOGGLE_BUTTONS[parentType];
  if (
    PREFIX_GROUP_FIELDS.has(parentType) &&
    (childType === "Text" || childType === "Icon")
  )
    return "Group";
  if (!WRAPPED_BY_TRIGGER.has(childType)) return undefined;
  const wrapper =
    SUBPART_WRAPPERS[parentType] ??
    (SUBPART_TOKENS[parentType]?.Group ? "Group" : undefined);
  return wrapper === childType ? undefined : wrapper;
}
const WRAPPED_BY_TRIGGER: ReadonlySet<string> = new Set([
  "SelectValue",
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
 * The DOM spacing scale (`theme/shared-tokens.css` `--spacing-*`, rem @ 16px): the `{spacing.*}` table
 * (one table — ADR-295 Phase 3d) plus the CSS-only names (`--spacing-0` · the `--spacing` unit · the chrome's
 * 1px `--spacing-3xs`, outside the S2 scale).
 */
const CSS_SPACING_PX: Readonly<Record<string, number>> = {
  "--spacing-0": 0,
  "--spacing": 4,
  "--spacing-3xs": 1,
  ...Object.fromEntries(
    Object.entries(SPACING_TOKENS).map(([name, px]) => [
      `--spacing-${name}`,
      px,
    ]),
  ),
};

/** px number of a resolved length (`0`, `Npx`, a spacing/typography token var). */
/** Root font size of the Preview document (`rem`): the UA default, which the Preview reset keeps. */
const ROOT_FONT_PX = 16;

function lengthPx(value: string): number | undefined {
  const text = value.trim();
  // ADR-295 Phase 3c-3: a rule's relative length (`{length.…}`) in the installed maps.
  if (/^\{length\.[^{}]+\}$/.test(text)) {
    const px = resolveToken(text as TokenRef);
    return typeof px === "number" ? px : undefined;
  }
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

/**
 * ADR-295 Phase 3c-3 — `calc(var(--catalog-token-size-<family>-<S>) ± Npx)` (a field button's room: its
 * square + the input's inset) → the length ref `{length.size.<family>.<S>*1/1±N}`, so the part keeps where
 * the number came from (the DOM writes the device formula); else null.
 */
function sizeOffsetLengthRef(value: string): string | null {
  const match =
    /^calc\((var\(--catalog-token-size-[\w-]+\))\s*([+-])\s*(\d+(?:\.\d+)?)px\)$/.exec(
      value.trim(),
    );
  const ref = match ? sizeHeightRef(match[1]!) : null;
  return ref
    ? `{length.${ref.slice(1, -1)}*1/1${match![2]}${match![3]}}`
    : null;
}

/** `var(--catalog-token-size-height-<S>)` → `{size.height.<S>}` (ADR-295 Phase 3), else null. */
function sizeHeightRef(value: string): string | null {
  const ref = cssVarToTokenRef(value.trim());
  return ref?.startsWith("{size.") ? ref : null;
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
      // (`sticky`: in flow — the engine gives its constraints, ADR-267.)
      if (value === "relative" || value === "static" || value === "sticky")
        layout.position = value;
    } else if (key === "grid-area") {
      Object.assign(layout, areaLines(ownerAreas, value) ?? {});
    } else if (key === "grid-row" || key === "grid-column") {
      // `a` · `a / b` · `a / span n` (line numbers — the engine's placement fields).
      const [start, end] = value.split("/").map((part) => part.trim());
      const axis = key === "grid-row" ? "Row" : "Column";
      if (/^-?\d+$/.test(start)) {
        layout[`grid${axis}Start` as LayoutField] = start;
        if (end && /^(-?\d+|span \d+)$/.test(end))
          layout[`grid${axis}End` as LayoutField] = end;
      }
    } else if (
      key === "grid-template-columns" ||
      key === "grid-template-rows"
    ) {
      layout[
        key === "grid-template-columns"
          ? "gridTemplateColumns"
          : "gridTemplateRows"
      ] = value;
    } else if (key === "row-gap" || key === "column-gap") {
      const px = lengthPx(value);
      if (px !== undefined)
        layout[key === "row-gap" ? "rowGap" : "columnGap"] = `${px}px`;
    } else if (key === "width" || key === "height") {
      const px = lengthPx(value);
      // ADR-295 Phase 3: an S2 control height keeps its ref (the library makes it a token value —
      //   the DOM writes the device variable, as for a token font size).
      const sizeRef = sizeHeightRef(value);
      if (px !== undefined) visual[key] = sizeRef ?? px;
      else if (/^(\d+(?:\.\d+)?%|fit-content|auto)$/.test(value))
        visual[key] = value;
    } else if (key === "min-width" || key === "min-height") {
      // `unset`/`auto` = the initial automatic minimum: a flex item's min-content (CSS-FLEXBOX-1
      // §4.5), zero for a block box — the engine resolves `auto` by the box's formatting context.
      const field = key === "min-width" ? "minWidth" : "minHeight";
      if (value === "auto") visual[field] = "auto";
      else {
        const px = lengthPx(value);
        if (px !== undefined) visual[field] = sizeHeightRef(value) ?? px;
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
      // (ADR-295 Phase 3c-3: a side of a size token ± px — a field button's room — keeps its length ref.)
      if (px !== undefined)
        visual[`padding${key[8].toUpperCase()}${key.slice(9)}` as VisualField] =
          sizeOffsetLengthRef(value) ?? px;
    } else if (key === "gap") {
      const px = lengthPx(value);
      // (ADR-295 Phase 3c-3: a relative gap keeps its ref — the library makes it a token value.)
      if (px !== undefined)
        visual.gap = /^\{length\.[^{}]+\}$/.test(value.trim())
          ? value.trim()
          : px;
    } else if (key === "border" || key === "border-width") {
      if (value === "none" || value === "0") visual.borderWidth = 0;
      else {
        const px = lengthPx(value.split(/\s+/)[0]);
        if (px !== undefined) visual.borderWidth = px;
      }
    } else if (key === "font-size") {
      const px = lengthPx(value);
      if (px !== undefined) {
        // ADR-295 Phase 2: a typography token keeps its ref — the library makes it a token value, so
        //   the resolver knows the size came from a token (the DOM writes the token's device variable).
        const ref = /^var\(--text-[\w-]+\)$/.test(value.trim())
          ? cssVarToTokenRef(value.trim())
          : null;
        fontSize = px;
        visual.fontSize = ref ?? px;
      }
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
 * Owners whose part blocks' `border-radius` reaches the Canvas part (its `radius`). Opt-in: the
 * other rules' child `border-radius` declarations are not read on the Canvas yet (their children
 * draw their own rule's radius). S2 Disclosure (2026-10-10): a square trigger, rounded when quiet.
 */
const RADIUS_PART_OWNERS: ReadonlySet<string> = new Set(["Disclosure"]);
/** `visual` with the block's `border-radius` (`RADIUS_PART_OWNERS`). */
function withPartRadius(
  parentType: string,
  declarations: Readonly<Record<string, string>>,
  variables: Readonly<Record<string, string>>,
  visual: Record<string, Scalar>,
): Record<string, Scalar> {
  const raw = declarations["border-radius"];
  if (!RADIUS_PART_OWNERS.has(parentType) || typeof raw !== "string")
    return visual;
  const value = substitute(raw, variables);
  const px = value === "0" ? 0 : value ? lengthPx(value) : undefined;
  return px === undefined ? visual : { ...visual, radius: px };
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
 * A standalone list's item flex shrink (the list rule's item selector under
 * `&:not(.react-aria-Popover *)` — `flex-shrink: 0`, 2026-10-13: a column list of a fixed height
 * scrolls instead of squeezing its items). Undefined when the list's rule declares none.
 */
export function catalogListItemFlexShrink(
  listType: string,
  itemType: string,
): number | undefined {
  const composition = (
    COMPONENT_RULES_TABLE as Record<
      string,
      { structure?: { composition?: unknown } }
    >
  )[listType]?.structure?.composition as
    | {
        rootSelectors?: Record<
          string,
          { nested?: Record<string, Record<string, string>> }
        >;
      }
    | undefined;
  const shrink =
    composition?.rootSelectors?.["&:not(.react-aria-Popover *)"]?.nested?.[
      `.react-aria-${itemType}`
    ]?.["flex-shrink"];
  return shrink === undefined ? undefined : Number(shrink);
}
/**
 * ADR-267 — a standalone ListBox's section header is sticky (the ListBox rule's
 * `&:not(.react-aria-Popover *)` block, `.react-aria-ListBoxSection .react-aria-Header` —
 * `position: sticky · top: calc(-1 * hairline)`): its insets in px (`insetTop` …), read from the
 * table like `catalogListItemFlexShrink` — and its `z-index` (the header paints over the items it is
 * stuck on). Undefined when the block declares no sticky. An inset the
 * Canvas cannot resolve throws — a dropped one would read as `auto` (the header would not stick,
 * the Preview's would: the RED hidden as GREEN).
 */
export function catalogListSectionHeaderSticky():
  | {
      insets: Partial<
        Record<"insetTop" | "insetRight" | "insetBottom" | "insetLeft", number>
      >;
      zIndex?: number;
    }
  | undefined {
  const composition = (
    COMPONENT_RULES_TABLE as Record<
      string,
      { structure?: { composition?: unknown } }
    >
  ).ListBox?.structure?.composition as
    | {
        rootSelectors?: Record<
          string,
          { nested?: Record<string, Record<string, string>> }
        >;
      }
    | undefined;
  const block =
    composition?.rootSelectors?.["&:not(.react-aria-Popover *)"]?.nested?.[
      ".react-aria-ListBoxSection .react-aria-Header"
    ];
  if (block?.position !== "sticky") return undefined;
  const out: Partial<
    Record<"insetTop" | "insetRight" | "insetBottom" | "insetLeft", number>
  > = {};
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const value = block[side];
    if (value === undefined || value.trim() === "auto") continue;
    // `calc(<factor> * <length>)` (the hairline's negative) or a length.
    const scaled = /^calc\(\s*(-?\d+(?:\.\d+)?)\s*\*\s*(.+)\)$/.exec(
      value.trim(),
    );
    const px = scaled
      ? (() => {
          const length = lengthPx(scaled[2]);
          return length === undefined ? undefined : Number(scaled[1]) * length;
        })()
      : lengthPx(value);
    if (px === undefined)
      throw new Error(
        `CATALOG_STICKY_INSET_UNRESOLVED:ListBox:${side}:${value}`,
      );
    out[`inset${side[0].toUpperCase()}${side.slice(1)}` as keyof typeof out] =
      px;
  }
  const zIndex = Number(block["z-index"]);
  return Number.isInteger(zIndex) ? { insets: out, zIndex } : { insets: out };
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
  const indicator = catalogToggleIndicatorMetrics(size);
  if (typeof indicator?.boxSize === "number")
    return { width: indicator.boxSize, height: indicator.boxSize };
  if (
    typeof indicator?.trackWidth === "number" &&
    typeof indicator?.trackHeight === "number"
  )
    return { width: indicator.trackWidth, height: indicator.trackHeight };
  return undefined;
}

type ToggleIndicatorMetrics = {
  boxSize?: number;
  boxRadius?: number;
  dotSize?: number;
  trackWidth?: number;
  trackHeight?: number;
  thumbSize?: number;
  thumbOffset?: number;
  thumbSizeSelected?: number;
  thumbOffsetSelected?: number;
};

/**
 * ADR-295 Phase 3c-2b — a toggle size's `indicator` in px under the installed maps (desktop on the
 * Canvas; the touch arm's maps in the G2 harness): a size-map token side (`{size.height-sm.<S>}`)
 * resolved, the Switch track width from the size's font (`trackWidthEm` — S2 `fontRelative(26)`) and
 * its thumbs from the insets (track height − 2 × inset, unselected · selected). The DOM reads the same
 * values from the rule's indicator selectors (generated sheet).
 */
export function catalogToggleIndicatorMetrics(
  size: ComponentRule["sizes"][string] | undefined,
): ToggleIndicatorMetrics | undefined {
  const indicator = size?.indicator;
  if (!indicator) return undefined;
  const length = (value: unknown): number | undefined => {
    const resolved =
      typeof value === "string" ? resolveToken(value as TokenRef) : value;
    return typeof resolved === "number" && Number.isFinite(resolved)
      ? resolved
      : undefined;
  };
  const out: ToggleIndicatorMetrics = {};
  const boxSize = length(indicator.boxSize);
  if (boxSize !== undefined) out.boxSize = boxSize;
  if (indicator.boxRadius !== undefined) out.boxRadius = indicator.boxRadius;
  if (indicator.dotSize !== undefined) out.dotSize = indicator.dotSize;
  const trackHeight = length(indicator.trackHeight);
  if (trackHeight !== undefined) out.trackHeight = trackHeight;
  const font = length(size?.fontSize);
  const trackWidth =
    indicator.trackWidthEm !== undefined && font !== undefined
      ? font * indicator.trackWidthEm
      : indicator.trackWidth;
  if (trackWidth !== undefined) out.trackWidth = trackWidth;
  if (trackHeight !== undefined && indicator.thumbInset !== undefined) {
    out.thumbSize = trackHeight - 2 * indicator.thumbInset;
    out.thumbOffset = indicator.thumbInset;
    const selected = indicator.thumbInsetSelected ?? indicator.thumbInset;
    out.thumbSizeSelected = trackHeight - 2 * selected;
    out.thumbOffsetSelected = selected;
  } else {
    if (indicator.thumbSize !== undefined) out.thumbSize = indicator.thumbSize;
    if (indicator.thumbOffset !== undefined)
      out.thumbOffset = indicator.thumbOffset;
  }
  return out;
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

/** TextArea's value box: `<textarea rows>` height per owner size and `rows` (1–12), its text at the top. */
const TEXT_AREA_ROWS = Array.from({ length: 12 }, (_, index) => index + 1);
function textAreaPartRules(parentType: string): CompiledPartRule[] {
  if (parentType !== "TextArea") return [];
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    parentType
  ];
  return sizeNames(rule).flatMap((size) =>
    [undefined, ...TEXT_AREA_ROWS].flatMap((rows): CompiledPartRule[] => {
      const height = catalogTextAreaInputHeight(size, rows);
      if (height === undefined) return [];
      // (ADR-259 Phase 2: in a prefix box the Group draws the box — its padding and border — so the
      // `<textarea>` inside is the rows box less them.)
      const box = catalogFieldBoxStyle(size, "TextArea");
      const inner =
        height - box.paddingTop - box.paddingBottom - 2 * box.borderWidth;
      const owner = rows === undefined ? {} : { ownerProps: { rows } };
      return [
        {
          childType: "Input",
          size,
          // No `rows` value: the shared default (3 rows).
          ...owner,
          // A `<textarea>` starts its text at its top padding, not its rows box's middle —
          // the shape builder's `verticalAlign: "top"` (2026-10-10 사용자 「textarea placeholder
          // 텍스트가 상단이 아니라 가운데」 — the old Skia projection gave it, the catalog path lost it).
          layout: { verticalAlign: "top" },
          visual: { height },
        },
        {
          childType: "Input",
          via: "Group",
          size,
          ...owner,
          layout: { verticalAlign: "top" },
          visual: { height: inner },
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
 * ADR-256 Phase 8c — a Disclosure's trigger content and panel content: the reference
 * `Heading > Button[slot=trigger] > (ChevronRight + span)` and `DisclosurePanel > div > children`.
 * The trigger (`.react-aria-Button[slot='trigger']` — padding, gap, flex row: the selector reaches
 * the Button through `SUBPART_TOKENS`) is RAC's plain button, so the Button rule's own paint and
 * box give way (transparent, no border, no minimum width). Its line height is the `.react-aria-Button`
 * base's (default size, a unitless ratio) while `font-size: inherit` takes the Disclosure's size
 * font. Its chevron is a fixed box of the trigger's `--icon-size` (the Button sheet's default size —
 * the element carries no `data-size`); its title Text takes the trigger's font, weight 600 and color
 * (`… > .react-aria-Text` inherits them). The panel's content Text takes the Disclosure's size font
 * and line height, weight 400, the panel color (`.react-aria-DisclosurePanel > div > .react-aria-Text`).
 * The chevron and title rules reach through the header (`via` the trigger Button — the resolver
 * passes a Disclosure's header Heading, `PART_RULE_PASS_HOSTS`).
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
  if (!trigger) return [];
  const button = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)
    .Button;
  const buttonSize = button?.defaultSize
    ? button.sizes[button.defaultSize]
    : undefined;
  const buttonIcon = buttonSize?.iconSize;
  const px = (value: unknown) => {
    const resolved =
      typeof value === "string" ? resolveToken(value as TokenRef) : value;
    return typeof resolved === "number" ? resolved : undefined;
  };
  const buttonFont = px(buttonSize?.fontSize);
  const buttonLine = px(buttonSize?.lineHeight);
  const lineHeight =
    buttonFont && buttonLine ? buttonLine / buttonFont : undefined;
  const titleWeight = Number(trigger["font-weight"]);
  const neutral = "{color.neutral}";
  return sizeNames(rule).flatMap((size): CompiledPartRule[] => {
    const icon = buttonIcon ?? rule.sizes[size]?.iconSize;
    const fontSize =
      trigger["font-size"] === "inherit"
        ? px(rule.sizes[size]?.fontSize)
        : undefined;
    // ADR-295 Phase 3: the size's typography token keeps its ref (a token value in the library — the
    //   DOM writes its device variable, so the title follows the touch set as the inherited sheet font
    //   does; a px went inline and stayed desktop).
    const sizeFont = rule.sizes[size]?.fontSize;
    const fontValue =
      fontSize !== undefined &&
      typeof sizeFont === "string" &&
      /^\{typography\.[^{}]+\}$/.test(sizeFont)
        ? sizeFont
        : fontSize;
    const font = {
      ...(fontValue !== undefined ? { fontSize: fontValue } : {}),
      ...(lineHeight !== undefined ? { lineHeight } : {}),
    };
    const sizeLine = px(rule.sizes[size]?.lineHeight);
    const panelFont = {
      ...(fontValue !== undefined ? { fontSize: fontValue } : {}),
      ...(fontSize && sizeLine ? { lineHeight: sizeLine / fontSize } : {}),
    };
    // (ADR-295 Phase 3b: an S2 icon step stays its ref — `withRuleParts` makes it a token value.)
    return px(icon) !== undefined
      ? [
          {
            childType: "Button",
            via: "Heading",
            childProps: { slot: "trigger" },
            size,
            layout: {},
            visual: {
              ...font,
              fill: "transparent",
              borderWidth: 0,
              minWidth: 0,
            },
          },
          {
            childType: "Icon",
            via: "Button",
            size,
            layout: { flexShrink: "0" },
            // (Its glyph is `currentColor` — the trigger's text color, not the Button rule's.)
            visual: { width: icon!, height: icon!, color: neutral },
          },
          {
            childType: "Text",
            via: "Button",
            size,
            layout: {},
            visual: {
              ...font,
              ...(titleWeight > 0 ? { fontWeight: titleWeight } : {}),
              color: neutral,
            },
          },
          {
            childType: "Text",
            via: "DisclosurePanel",
            size,
            layout: {},
            visual: { ...panelFont, fontWeight: 400, color: neutral },
          },
        ]
      : [];
  });
}

/**
 * ADR-259 Phase 3 — S2 `ContextualHelp`'s trigger: a quiet icon-only ActionButton (`isQuiet`,
 * `ContextualHelp.tsx:198-209`) of the help's size — S2 control sizes XS 20 · S 24, square — over
 * the Button origin's box: no fill, no border, no padding, no minimum width; its glyph the Button
 * rule's icon size at that size, in the text color. The DOM draws the trigger as RAC's plain Button
 * with this record box inline (`ContextualHelpButton`).
 */
const CONTEXTUAL_HELP_BUTTON_PX: Readonly<Record<string, number>> = {
  XS: 20,
  S: 24,
};
function contextualHelpPartRules(parentType: string): CompiledPartRule[] {
  if (parentType !== "ContextualHelp") return [];
  const button = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)
    .Button;
  return Object.entries(CONTEXTUAL_HELP_BUTTON_PX).flatMap(
    ([size, box]): CompiledPartRule[] => {
      const icon = button?.sizes[size]?.iconSize;
      return [
        {
          childType: "Button",
          size,
          layout: {},
          visual: {
            width: box,
            height: box,
            minWidth: 0,
            // (ADR-295 Phase 3: an ActionButton square — not the Button's S2 min-height.)
            minHeight: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            borderWidth: 0,
            fill: "transparent",
          },
        },
        // (ADR-295 Phase 3b · 3c: the Button's S2 icon — a step, or its line `1lh` · font `1em` — keeps
        //   its ref, a token value in the library.)
        ...(typeof icon === "number" ||
        (typeof icon === "string" && ICON_SIZE_TOKEN_REF.test(icon))
          ? [
              {
                childType: "Icon",
                via: "Button",
                size,
                layout: { flexShrink: "0" },
                visual: {
                  width: icon,
                  height: icon,
                  iconSize: icon,
                  color: "{color.neutral}",
                },
              },
            ]
          : []),
      ];
    },
  );
}

/**
 * ADR-259 Phase 2 — a field's prefix (S2 `FieldGroup` `CenterBaseline` — `color: gray-600`, its
 * icon `size: 1lh`): the prefix Text · Icon in the field's control Group take the field rule's
 * prefix color (`[slot="prefix"]` static block — a color the generic part path does not carry) and
 * an Icon a square of the prefix text's line height at the field's size (the `sizeSelectors`
 * prefix font). Width, shrink and gap stay with the generic blocks.
 */
const FIELD_PREFIX_RULE_TYPES: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "NumberField",
  "ComboBox",
  "ColorField",
]);
function fieldPrefixPartRules(parentType: string): CompiledPartRule[] {
  if (!FIELD_PREFIX_RULE_TYPES.has(parentType)) return [];
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    parentType
  ];
  const composition = rule?.structure?.composition as
    | {
        staticSelectors?: Record<string, Record<string, string>>;
        sizeSelectors?: Record<string, Record<string, Record<string, string>>>;
      }
    | undefined;
  const isPrefix = (selector: string) => selector.includes('[slot="prefix"]');
  const colorCss = Object.entries(composition?.staticSelectors ?? {}).find(
    ([selector, block]) => isPrefix(selector) && block.color,
  )?.[1].color;
  const color = colorCss ? (cssVarToTokenRef(colorCss) ?? colorCss) : undefined;
  const tokenNumber = (css: string | undefined) => {
    const token = css ? cssVarToTokenRef(css) : null;
    const value = token ? resolveToken(token) : undefined;
    return typeof value === "number" ? value : undefined;
  };
  return sizeNames(rule).flatMap((size): CompiledPartRule[] => {
    const text = Object.entries(composition?.sizeSelectors?.[size] ?? {}).find(
      ([selector, block]) =>
        isPrefix(selector) && selector.includes("Text") && block["font-size"],
    )?.[1];
    const fontSize = tokenNumber(text?.["font-size"]);
    const lineRatio = tokenNumber(text?.["line-height"]);
    // (A line-height token is a ratio of the font size, or a length already.)
    const line =
      fontSize && lineRatio
        ? Math.round(lineRatio > 4 ? lineRatio : fontSize * lineRatio)
        : undefined;
    const paint: Record<string, Scalar> = color ? { color } : {};
    return [
      {
        childType: "Text",
        via: "Group",
        childProps: { slot: "prefix" },
        size,
        layout: {},
        visual: { ...paint },
      },
      {
        childType: "Icon",
        via: "Group",
        childProps: { slot: "prefix" },
        size,
        layout: {},
        visual:
          line !== undefined
            ? { ...paint, width: line, height: line, iconSize: line }
            : paint,
      },
    ];
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
/**
 * Axes one type adds (its root renders the attribute — `ruleDom`'s fallback `data-orientation`).
 * Not shared: the group rules' `orientation` blocks have their own readers (`itemsWrapperPartRules`).
 * 2026-10-09: the S2 IllustratedMessage's `orientation` places its picture · heading · content.
 */
const TYPE_CONTAINER_VARIANT_AXES: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  IllustratedMessage: { orientation: "orientation" },
  // ADR-258 Phase 2: a ColorSlider's grid · track box per orientation (RAC's `data-orientation`).
  ColorSlider: { orientation: "orientation" },
  // (S2 AvatarGroup: the avatar overlap is a quarter of the group size.)
  AvatarGroup: { size: "size" },
  // S2 Disclosure (2026-10-10): its trigger's height per density, its rounded quiet trigger.
  Disclosure: { density: "density", quiet: "isQuiet" },
  // ADR-257 Phase 3: S2 Column `align` · Cell `align` · `showDivider`, and the Table's
  // `overflowMode` (carried to its Columns · Cells — `CATALOG_OVERFLOW_MODE_OWNERS`).
  // (and a sortable Column's row — the reference's `.column-header`, G5 example 11)
  Column: {
    align: "align",
    "overflow-mode": "overflowMode",
    "allows-sorting": "allowsSorting",
  },
  Cell: {
    align: "align",
    "show-divider": "showDivider",
    "overflow-mode": "overflowMode",
  },
  // ADR-257 후속: S2 Badge `overflowMode` (its own text) · ListView's (carried to the items —
  // their label · description Text, `TEXT_BOX_VARIANT_AXIS`).
  Badge: { "overflow-mode": "overflowMode" },
  // S2 InlineAlert (2026-10-13): its title keeps clear of the variant's icon (`inlineAlertIcon.ts`).
  InlineAlert: { variant: "variant" },
  GridListItem: { "overflow-mode": "overflowMode" },
  // S2 Button (2026-10-28): a pill, and a field's own button at its size's corner — the derived
  // `fieldButton` (`presence.ts` `catalogFieldButtonSize`, `derivedVariantProps.ts`).
  Button: { "field-button": "fieldButton" },
};

export { CATALOG_DERIVED_VARIANT_PROPS } from "./derivedVariantProps";
function containerVariantAxes(type: string): Readonly<Record<string, string>> {
  return { ...CONTAINER_VARIANT_AXES, ...TYPE_CONTAINER_VARIANT_AXES[type] };
}
/** The owner's own custom properties (`composition.containerStyles` · `containerVariants.size`). */
function compositionVariables(
  rule: ComponentRule,
  size: string | undefined,
): Record<string, string> {
  const composition = rule.structure?.composition as
    { containerStyles?: Record<string, string> } | undefined;
  const variants = containerVariantsOf(rule);
  const out: Record<string, string> = {};
  for (const source of [
    composition?.containerStyles,
    size ? variants?.size?.[size]?.styles : undefined,
  ])
    for (const [key, value] of Object.entries(source ?? {}))
      if (key.startsWith("--") && typeof value === "string") out[key] = value;
  return out;
}
/**
 * Field types by the DOM control a `:has(~ …)` block names: a TextArea is RAC `TextField` (the
 * TextField sheet) with a `.react-aria-TextArea` control — its side label sits at the control's
 * first line, not its middle (2026-10-10).
 */
const SIBLING_CONTROL_TYPES: Readonly<Record<string, string>> = {
  ".react-aria-TextArea": "TextArea",
  ".react-aria-FieldBox > .react-aria-TextArea": "TextArea",
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
  // (A picker / NumberField control Group — ADR-256 Phase 6b.)
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
 * ADR-257 Phase 3 — the rules whose root variant blocks also set their own text box: S2 Table's
 * cell content (`text-align` · `white-space` · truncation — S2 `cellContent`) and a Cell's divider
 * (`border-right-width`, its color the rule's border); S2 Badge's text (ADR-257 후속). Only these:
 * the other rules' blocks do not reach the Canvas text through here.
 */
const TEXT_VARIANT_RULES: ReadonlySet<string> = new Set([
  "Column",
  "Cell",
  "Badge",
]);
/**
 * ADR-257 후속 — the axis whose nested blocks set their child text's box (S2 ListView `overflowMode`
 * on an item's label · description Text): read here as the root blocks of `TEXT_VARIANT_RULES`.
 */
const TEXT_BOX_VARIANT_AXIS = "overflow-mode";
function cellTextVisual(
  styles: Readonly<Record<string, string>>,
): Record<string, Scalar> {
  const out: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (key === "text-align") out.textAlign = value;
    else if (key === "white-space") out.whiteSpace = value;
    else if (key === "text-overflow") out.textOverflow = value;
    else if (key === "overflow") out.overflow = value;
    else if (key === "border-style") out.borderStyle = value;
    else if (key === "border-color") out.borderColor = value;
    else if (key === "border-right-width") {
      const px = lengthPx(value);
      if (px !== undefined) out.borderRightWidth = px;
    }
  }
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
  for (const [attribute, prop] of Object.entries(containerVariantAxes(type)))
    for (const [value, block] of Object.entries(variants[attribute] ?? {})) {
      const declared = compileDeclarations(
        type,
        block.styles ?? {},
        {},
        undefined,
      );
      const compiled = TEXT_VARIANT_RULES.has(type)
        ? {
            ...declared,
            visual: {
              ...declared.visual,
              ...cellTextVisual(block.styles ?? {}),
            },
          }
        : declared;
      if (
        Object.keys(compiled.layout).length ||
        Object.keys(compiled.visual).length
      )
        out.push({ when: { [prop]: value }, ...compiled });
    }
  return out;
}

/**
 * A side Form's shared label column (2026-10-10 — S2 Form's subgrid): the Form declares
 * `--form-label-width` (`[data-label-position="side"]`), inherited by every field inside, and a side
 * field's label reads it (`width: var(--form-label-width)` — without it the label is its text's
 * width). The Canvas reads the field's label block again with the Form's variables: Form → field
 * (`via`, in the field's own label position) → Label. The resolver gives these rules to the field
 * from its nearest Form at any depth (the variable's inheritance — `formOwnerOf`).
 */
function formFieldLabelPartRules(parentType: string): CompiledPartRule[] {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    domStyleRuleType(parentType)
  ];
  const variants = rule ? containerVariantsOf(rule) : undefined;
  if (!variants) return [];
  const out: CompiledPartRule[] = [];
  for (const [attribute, prop] of Object.entries(
    containerVariantAxes(parentType),
  ))
    for (const [value, block] of Object.entries(variants[attribute] ?? {})) {
      const variables = blockVariables(block);
      const names = Object.keys(variables);
      if (!names.length) continue;
      for (const fieldType of CATALOG_FORM_FIELDS) {
        const fieldRule = (
          COMPONENT_RULES_TABLE as Record<string, ComponentRule>
        )[domStyleRuleType(fieldType)];
        const fieldVariants = fieldRule
          ? containerVariantsOf(fieldRule)
          : undefined;
        for (const [fieldAttribute, fieldProp] of Object.entries(
          containerVariantAxes(fieldType),
        ))
          for (const [fieldValue, fieldBlock] of Object.entries(
            fieldVariants?.[fieldAttribute] ?? {},
          ))
            for (const entry of fieldBlock.nested ?? []) {
              if (
                entry.selector.trim().replace(/^>\s*/, "") !==
                ".react-aria-Label"
              )
                continue;
              const declarations = Object.fromEntries(
                Object.entries(entry.styles ?? {}).filter(([, declared]) =>
                  names.some((name) => declared.includes(`var(${name}`)),
                ),
              );
              if (!Object.keys(declarations).length) continue;
              const compiled = compileDeclarations(
                "Label",
                declarations,
                variables,
                undefined,
              );
              if (
                !Object.keys(compiled.layout).length &&
                !Object.keys(compiled.visual).length
              )
                continue;
              out.push({
                childType: "Label",
                via: fieldType,
                viaProps: { [fieldProp]: fieldValue },
                ownerProps: { [prop]: value },
                layout: compiled.layout,
                visual: compiled.visual,
              });
            }
      }
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
  for (const [attribute, prop] of Object.entries(
    containerVariantAxes(parentType),
  ))
    for (const [value, block] of Object.entries(variants[attribute] ?? {}))
      for (const entry of block.nested ?? []) {
        // A block for a field whose control is a given DOM element (`:has(~ .react-aria-TextArea)`):
        // the type that renders that control (`SIBLING_CONTROL_TYPES`), else skipped.
        const sibling = /^(.*):has\(~\s*([^)]+)\)$/.exec(
          entry.selector.trim().replace(/^>\s*/, ""),
        );
        if (
          sibling &&
          !sibling[2]
            .split(/,\s*~\s*/)
            .some(
              (control) => SIBLING_CONTROL_TYPES[control.trim()] === parentType,
            )
        )
          continue;
        const selector = sibling
          ? sibling[1]
          : entry.selector.trim().replace(/^>\s*/, "");
        const excluded = /^:not\((.*)\)$/.exec(selector)?.[1];
        const targets: Array<{
          childType: string;
          via?: string;
          childProps?: Readonly<Record<string, Scalar>>;
        }> = excluded
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
              // (A whole sub-part selector — a Disclosure's trigger `Button[slot='trigger']` — as
              // the static blocks match it, with the props that pick the child.)
              const whole = Object.values(
                SUBPART_TOKENS[parentType] ?? {},
              ).some((tokens) => tokens.includes(part));
              const simple = whole
                ? { token: part, conditions: [] }
                : parseSimple(part);
              const target =
                simple && !simple.conditions.length
                  ? childTypeOf(parentType, simple.token)
                  : undefined;
              const childProps = SUBPART_CHILD_PROPS[parentType]?.[part];
              return target
                ? [{ ...target, ...(childProps ? { childProps } : {}) }]
                : [];
            });
        for (const target of targets) {
          const compile = (
            size: string | undefined,
            align: string | undefined,
          ) => {
            const variables = {
              ...compositionVariables(rule, size),
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
            compiled.visual = withPartRadius(
              parentType,
              entry.styles ?? {},
              variables,
              compiled.visual,
            );
            if (attribute === TEXT_BOX_VARIANT_AXIS)
              Object.assign(
                compiled.visual,
                cellTextVisual(entry.styles ?? {}),
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
              ...(target.childProps ? { childProps: target.childProps } : {}),
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
        /** Per-size child selectors (`.X[data-size="L"] .bar`), emitted after the static ones. */
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
    )) {
      // ADR-295 Phase 3c-3: a relative gap (`em` — S2 `text-to-control`) carries its length ref, so the
      //   part keeps it as a token use (the DOM writes the device formula).
      const gapRef = ruleSizeLengthRef(
        (rule.sizes as Record<string, object>)[size] ?? {},
        "gap",
      );
      const gapVar = `--${delegation.prefix}-gap`;
      Object.assign(
        (rootVariables[size] ??= {}),
        values,
        gapRef && values[gapVar] !== undefined ? { [gapVar]: gapRef } : {},
      );
    }
  }
  const out: CompiledPartRule[] = [
    ...ownerVariablePartRules(parentType),
    ...tokenRuleBasePartRules(parentType),
    ...sliderThumbPartRules(parentType),
    ...disclosureChevronPartRules(parentType),
    ...fieldPrefixPartRules(parentType),
    ...contextualHelpPartRules(parentType),
    ...toggleIndicatorPartRules(parentType),
    ...fieldValuePartRules(parentType),
    ...textAreaPartRules(parentType),
    ...itemsWrapperPartRules(parentType),
    ...manualParts,
  ];
  for (const block of blocks) {
    // (A leading `>` names the owner's own child — what a part rule without `via` reaches: the S2
    // Card's sections, ADR-256 Phase 10 판독 M1.)
    for (const part of selectorList(block.selector).map((selector) =>
      selector.replace(/^>\s*/, ""),
    )) {
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
        // (The owner's own custom properties reach its descendants — `containerVariants.size`'s
        // per-size `--disclosure-trigger-py`, as the generated `[data-size]` block declares them.)
        const variables = {
          ...compositionVariables(rule, size),
          ...((size && rootVariables[size]) || {}),
        };
        const compiledBlock = compileDeclarations(
          target.childType,
          block.declarations,
          variables,
          areas,
        );
        compiledBlock.visual = withPartRadius(
          parentType,
          block.declarations,
          variables,
          compiledBlock.visual,
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
  out.push(...formFieldLabelPartRules(parentType));
  // Generated `[data-size]` selectors never match a root without that attribute: only the default
  // size's values apply, for every size (manual parts keep their real size keys).
  if (manual?.rootSizeAttribute !== undefined)
    return withPartAliases(
      out.flatMap((part): CompiledPartRule[] => {
        if (manualParts.includes(part) || !part.size) return [part];
        if (part.size !== rule.defaultSize) return [];
        const { size: _size, ...unsized } = part;
        return [unsized];
      }),
      parentType,
    );
  return withPartAliases(out, parentType);
}

/**
 * ADR-259 Phase 3 — a field's label row stands in its Label's place (S2 `FieldLabel`): the field's
 * Label part rules reach a FieldLabel child too, as the generated sheet's `:is(.react-aria-Label,
 * .react-aria-FieldLabel)` (`CATALOG_FIELD_LABEL_PART_ALIASES` — a Form's label column through the
 * field as well). The Label in the row keeps its own rule (its parent is the row, not the field).
 */
function withPartAliases(
  parts: CompiledPartRule[],
  parentType: string,
): CompiledPartRule[] {
  return parts.flatMap((part) => {
    const owner = part.via ?? parentType;
    const aliases = CATALOG_CONTEXTUAL_HELP_FIELDS.has(owner)
      ? CATALOG_FIELD_LABEL_PART_ALIASES[part.childType]
      : undefined;
    if (!aliases || (part.via && parentType !== "Form")) return [part];
    // (The row is a box: the Label's text values — alignment, font, color — stay the Label's; the
    // sheet's reach the text in the row by inheritance.)
    const visual = Object.fromEntries(
      Object.entries(part.visual).filter(
        ([key]) => !LABEL_TEXT_VISUAL.has(key),
      ),
    );
    if (!Object.keys(part.layout).length && !Object.keys(visual).length)
      return [part];
    return [
      part,
      ...aliases.map((childType) => ({ ...part, childType, visual })),
    ];
  });
}

/** Text values a field's Label part rule carries that its label row (a box) does not take. */
const LABEL_TEXT_VISUAL: ReadonlySet<string> = new Set([
  "textAlign",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "color",
]);

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
