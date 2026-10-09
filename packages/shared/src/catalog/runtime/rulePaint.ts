import { resolveToken, type TokenRef } from "@composition/rendering";
import {
  resolveCatalogPaint,
  resolveCatalogVariantName,
} from "@composition/shared";
import type { ComponentRule } from "../../types/catalog-style.types";
import type { StateName } from "../document/types";
import { MANUAL_ITEM_LABEL_COLORS } from "../document/manualBoxRules";
import { colorTokenOfCssVar } from "../resolvers/colorTokenToCss";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-248: the rule paint decision of a rule-backed node (variant, size, RAC selection, resolved
 * variant/state paint) — the Canvas rule executor (`ruleShapes`) draws from it and the composition
 * root reads a label's inherited color from it. No shape or Skia code here: the Preview's replica
 * root loads this module (G5 bundle gate).
 */

/** Types whose children draw their own content; the node paints only its shell. */
const SHELL_ONLY_TYPES: ReadonlySet<string> = new Set([
  "Calendar",
  "RangeCalendar",
  "Card",
  "Dialog",
  "Section",
  "DisclosureGroup",
  "ButtonGroup",
  "CheckboxGroup",
  "RadioGroup",
  "ToggleButtonGroup",
  "Disclosure",
  "Form",
  "Popover",
  "Tooltip",
  "ColorPicker",
  "ColorSwatchPicker",
  "body",
]);

/** Types whose children merge into the node's own shapes; the node never becomes a shell. */
export const CHILD_PROP_MERGE_TYPES: ReadonlySet<string> = new Set([
  "Breadcrumbs",
  "ComboBox",
  "GridList",
  "Select",
  "Table",
  "Tabs",
  "TagGroup",
  "Toolbar",
  "Tree",
]);

const PAINT_STYLE_KEYS: Readonly<Record<string, string>> = {
  fill: "backgroundColor",
  backgroundColor: "backgroundColor",
  color: "color",
  borderColor: "borderColor",
};
const GEOMETRY_STYLE_KEYS: Readonly<Record<string, string>> = {
  radius: "borderRadius",
  borderWidth: "borderWidth",
  fontSize: "fontSize",
  fontWeight: "fontWeight",
};

/**
 * Root geometry a rule's `containerVariants` block may set on the node's own box — the Canvas
 * side of the generated `[data-*]` sheet blocks (S2 ColorSwatch `rounding`, 2026-10-10). Layout
 * keys in those blocks stay with the layout consumers (`implicitStyles` · part rules); only the
 * keys here reach the rule executor's paint style. The authored visual wins over them, as the
 * document's inline style wins over the sheet.
 */
const CONTAINER_VARIANT_PAINT_KEYS: Readonly<Record<string, string>> = {
  "border-radius": "borderRadius",
  "font-weight": "fontWeight",
};
/** Color keys pass as written (`transparent` · `var(--x)` — the paint resolves them). */
const CONTAINER_VARIANT_COLOR_KEYS: Readonly<Record<string, string>> = {
  "border-color": "borderColor",
  background: "backgroundColor",
  "background-color": "backgroundColor",
  color: "color",
};

/** `var(--radius-x)` · `Npx` · `N` of a containerVariants geometry value → px number. */
function containerVariantLength(value: string): number {
  const token = /^var\(--radius-([a-z0-9]+)\)$/.exec(value);
  if (token) {
    const resolved = resolveToken(`{radius.${token[1]}}` as TokenRef, "light");
    if (typeof resolved === "number") return resolved;
  }
  const px = Number.parseFloat(value);
  if (!Number.isFinite(px))
    throw new Error(`CATALOG_CONTAINER_VARIANT_LENGTH_UNSUPPORTED:${value}`);
  return px;
}

/** The matched `containerVariants` paint styles of a rule for these props (geometry whitelist). */
export function catalogContainerVariantPaint(
  rule: Readonly<ComponentRule>,
  props: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const variants =
    (rule as { containerVariants?: unknown }).containerVariants ??
    (rule.structure?.composition as { containerVariants?: unknown } | undefined)
      ?.containerVariants;
  if (!variants) return {};
  const out: Record<string, unknown> = {};
  for (const [dataAttr, valueMap] of Object.entries(
    variants as Record<
      string,
      Record<string, { styles?: Record<string, string> }>
    >,
  )) {
    const propKey = dataAttr.replace(/-([a-z])/g, (_m, ch: string) =>
      ch.toUpperCase(),
    );
    // Boolean visual props drop their `is` prefix in the data attribute (the house rule —
    // `isStandalone` → `data-standalone`): the variant key follows the attribute.
    const raw =
      props[propKey] ??
      props[`is${propKey[0].toUpperCase()}${propKey.slice(1)}`];
    if (raw == null) continue;
    const styles = valueMap[String(raw)]?.styles;
    if (!styles) continue;
    for (const [cssKey, value] of Object.entries(styles)) {
      const styleKey = CONTAINER_VARIANT_PAINT_KEYS[cssKey];
      if (styleKey) out[styleKey] = containerVariantLength(value);
      const colorKey = CONTAINER_VARIANT_COLOR_KEYS[cssKey];
      if (colorKey) out[colorKey] = value;
    }
  }
  return out;
}

/** `var(--name)` theme color (the CSS form of `{color.name}`) → its token value. */
export function cssVarColor(value: unknown, theme: "light" | "dark"): unknown {
  const match =
    typeof value === "string" ? /^var\(--([a-z0-9-]+)\)$/.exec(value) : null;
  if (!match) return value;
  let resolved = resolveToken(`{color.${match[1]}}` as TokenRef, theme);
  // A variable whose token carries another name (`--fg-muted` ← `{color.neutral-subdued}`).
  if (typeof resolved !== "string") {
    const token = colorTokenOfCssVar(match[1]);
    if (token) resolved = resolveToken(`{color.${token}}` as TokenRef, theme);
  }
  if (typeof resolved !== "string")
    throw new Error(`CATALOG_CSS_VAR_COLOR_UNRESOLVED:${value}`);
  return resolved;
}

/** Display states whose rule paint (variant fill/text/border) the executor draws for a node. */
const INTERACTION_STATES: ReadonlySet<StateName> = new Set([
  "hover",
  "pressed",
]);
const SELECTION_STATES: ReadonlySet<StateName> = new Set([
  "selected",
  "selectedHover",
  "selectedPressed",
]);
/**
 * Rules whose indeterminate paints as selected — `Checkbox.css` `[data-selected], [data-indeterminate]`
 * (the glyph — check or dash — is the primitive's, by `isIndeterminate`).
 */
const INDETERMINATE_SELECTED_TYPES: ReadonlySet<string> = new Set(["Checkbox"]);
/**
 * States a rule-backed node's own rule paint answers (`resolveCatalogPaint` interaction and RAC
 * selection). Other states reach it only through typed rules (disabled opacity) — the G3 census
 * classifies registered state axes by this set.
 */
export const CATALOG_RULE_EXECUTOR_PAINT_STATES: ReadonlySet<StateName> =
  new Set([...INTERACTION_STATES, ...SELECTION_STATES]);

function interaction(state: StateName | undefined) {
  return state && INTERACTION_STATES.has(state)
    ? (state as "hover" | "pressed")
    : "default";
}

export interface CatalogRuleShapeInput {
  readonly node: CatalogConsumerNode;
  readonly rect: { width: number; height: number };
  readonly rule: Readonly<ComponentRule>;
  /** Rule / registration key (the definition name). */
  readonly type: string;
  /** Authored visual writes layered on the rule (`catalogAuthoredVisual`). */
  readonly authoredVisual: Readonly<Record<string, unknown>>;
  readonly state?: StateName;
  readonly theme?: "light" | "dark";
  /** The layout kept this text leaf on one line (`textKeptOnOneLine`): its text paints unwrapped. */
  readonly singleLine?: boolean;
  /** Paint data the executor measured for the shape generators (a DateInput's segment runs). */
  readonly paintProps?: Readonly<Record<string, unknown>>;
  /**
   * A primitive of the rule a child node paints in its own box (`canvasBinding` owner-drawn parts —
   * a toggle's `*Indicator`; a TreeItem's row content its chevron): the node skips it, and a `replace`
   * primitive leaves the node unpainted.
   */
  readonly childPrimitive?: string;
}

/**
 * The rule paint a rule-backed node shows: its RAC selection (`data-selected` — a collection
 * owner's derived selection, else the display state), the variant the DOM styles it with, its size
 * and the resolved variant/state paint. The shape builder and a label that inherits the node's
 * color (`catalogRuleTextColor`) read the same decision.
 */
export function catalogRulePaint(
  input: Omit<CatalogRuleShapeInput, "rect">,
  box?: { width: number; height: number },
) {
  const { node, rule, type, authoredVisual, state } = input;
  const theme = input.theme ?? "light";
  // Authored writes (project override, template, instance, path) layer on the rule, which
  // supplies everything else — the same order as `props.style` over the rule table. Under them,
  // the rule's own prop-conditional geometry (`containerVariants` — the generated `[data-*]`
  // sheet blocks, S2 ColorSwatch `rounding`).
  const style: Record<string, unknown> = catalogContainerVariantPaint(
    rule,
    node.props,
  );
  for (const [key, value] of Object.entries(authoredVisual)) {
    const styleKey = PAINT_STYLE_KEYS[key] ?? GEOMETRY_STYLE_KEYS[key];
    if (styleKey)
      style[styleKey] = PAINT_STYLE_KEYS[key]
        ? cssVarColor(value, theme)
        : value;
  }
  // A box whose text starts at its top (a TextArea's Input — `textAreaPartRules`): the shape
  // builder's `verticalAlign: "top"` puts it at the top padding, as the `<textarea>` does.
  if (node.layout.verticalAlign === "top") style.verticalAlign = "top";
  // A side padding the document wrote (a field rule's room for its glyph or button on an Input —
  // the DOM's inline `padding-left` / `padding-right`) places the text: both resolved sides go
  // out together, since the shape builder reads a lone side as both.
  if (
    authoredVisual.paddingLeft !== undefined ||
    authoredVisual.paddingRight !== undefined
  ) {
    const side = (key: "paddingLeft" | "paddingRight") =>
      Number(node.visual[key] ?? node.visual.paddingX ?? node.visual.padding);
    const left = side("paddingLeft");
    const right = side("paddingRight");
    if (Number.isFinite(left) && Number.isFinite(right)) {
      style.paddingLeft = left;
      style.paddingRight = right;
    }
  }
  const props: Record<string, unknown> = {
    ...node.props,
    ...input.paintProps,
  };
  // RAC `data-selected`: the rule's selected paint (and the `_isSelected` data branch the
  // selection primitives read — the Tab indicator). A collection owner's selection
  // (`derivedProps._isSelected`, Tabs' selected key) decides for its items — an item instance of a
  // selected state origin inside Tabs is selected only when its key is; else the display state.
  const ownerSelected =
    typeof props._isSelected === "boolean" ? props._isSelected : undefined;
  const selected =
    (ownerSelected ?? (state !== undefined && SELECTION_STATES.has(state))) ||
    (INDETERMINATE_SELECTED_TYPES.has(type) && props.isIndeterminate === true);
  if (selected) {
    props.isSelected = true;
    props._isSelected = true;
  } else if (ownerSelected === false) delete props.isSelected;
  if (state === "disabled") props.isDisabled = true;
  props.style = box
    ? { ...style, width: box.width, height: box.height }
    : style;
  if (SHELL_ONLY_TYPES.has(type)) props._hasChildren = true;
  else if (
    type !== "TreeItem" &&
    !CHILD_PROP_MERGE_TYPES.has(type) &&
    node.children.length > 0
  )
    props._hasChildren = true;

  // The DOM styles selection by `[data-selected]` over `data-variant`: a selected node of a rule
  // with a `selected` variant paints it unless another (non-default) variant is authored. The typed
  // `variant` default is not an authored choice (`resolveCatalogVariantName` reads any value as one).
  // (An emphasized owner's selection — S2 TagGroup `isEmphasized`, the item's `_emphasized` —
  // paints the rule's `selectedEmphasized` where it has one.)
  const selectedName =
    props._emphasized === true && rule.variants.selectedEmphasized
      ? "selectedEmphasized"
      : "selected";
  const variantName =
    props.isSelected === true &&
    rule.variants.selected &&
    (props.variant === undefined || props.variant === rule.defaultVariant)
      ? selectedName
      : resolveCatalogVariantName(rule, props);
  const variant = variantName ? rule.variants[variantName] : undefined;
  const sizeName = (props.size as string | undefined) ?? rule.defaultSize;
  const size =
    (sizeName ? rule.sizes[sizeName] : undefined) ??
    (rule.defaultSize ? rule.sizes[rule.defaultSize] : undefined) ??
    {};
  const paintProps =
    variantName === selectedName && props.isSelected === true
      ? { ...props, isSelected: false }
      : props;
  const paint = resolveCatalogPaint({
    variant,
    size,
    props: paintProps,
    style: props.style as Record<string, unknown>,
    interactionState: interaction(state),
  });
  return { props, style, variant, size, paint, theme };
}

/**
 * The text color a label inside a rule-backed item inherits (`MANUAL_ITEM_LABEL_COLORS` — the
 * DOM `.react-aria-Text { color: inherit }` under the item): the item's resolved paint color for
 * its variant/state/selection, with a manual sheet's selected color over a rule that declares none.
 */
export function catalogRuleTextColor(
  input: Omit<CatalogRuleShapeInput, "rect">,
): string | undefined {
  const { props, style, paint, theme } = catalogRulePaint(input);
  const manual = MANUAL_ITEM_LABEL_COLORS[input.type];
  const color =
    style.color === undefined &&
    props.isSelected === true &&
    input.rule.variants.selected === undefined &&
    manual?.selectedText
      ? manual.selectedText
      : paint.color;
  if (color === undefined) return undefined;
  const resolved =
    typeof color === "string" && color.startsWith("{")
      ? resolveToken(color as TokenRef, theme)
      : color;
  return typeof resolved === "string" ? resolved : undefined;
}
