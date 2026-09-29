import {
  buildCatalogShapes,
  composeCatalogShapes,
  getSkiaPrimitive,
  getSkiaPrimitiveMode,
  resolveToken,
  type Shape,
  type SizeSpec,
  type TokenRef,
} from "@composition/specs";
import { getPrimitiveBinding, resolveCatalogPaint } from "@composition/shared";
import type { ComponentRule } from "../../../../../packages/shared/src/types/composition-document.types";
import type { StateName } from "../../../../../packages/shared/src/catalog/document/types";
import { MANUAL_ITEM_LABEL_COLORS } from "../../../../../packages/shared/src/catalog/document/manualBoxRules";
import {
  resolveCatalogVariantName,
  ruleVariantToVisual,
} from "../workspace/canvas/skia/resolveSkiaVisualRule";
import { specShapesToSkia } from "../workspace/canvas/skia/specShapeConverter";
import { normalizeMiddleBaselineTextLineHeight } from "../workspace/canvas/skia/specBuildHelpers";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-248 Canvas executor for rule-backed definitions (`LibraryDefinition.ruleId`): the node's
 * D3 rule (variant/state paint, sub-part structure) plus its resolved props and authored visual
 * writes → the catalog shape generators (`@composition/specs`) → CanvasKit node data.
 *
 * Execution capability tables below are binding-level data (which types own their children,
 * merge child props, or need their box size); they are not visual values.
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
const CHILD_PROP_MERGE_TYPES: ReadonlySet<string> = new Set([
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

/** Types whose shape generators lay out against the actual box size. */
const BOX_SIZE_TYPES: ReadonlySet<string> = new Set([
  "Tag",
  "Breadcrumbs",
  "Tabs",
  "TabList",
  "Tab",
  "Toast",
  "ProgressBar",
  "ProgressBarTrack",
  "Meter",
  "MeterTrack",
  "TextField",
  "TextArea",
  "Input",
  "Select",
  "SelectTrigger",
  "ComboBox",
  "SearchField",
  "NumberField",
  "GridList",
  "Image",
  "Slider",
  "SliderTrack",
  "ListBox",
  "ColorField",
  "Skeleton",
  "IllustratedMessage",
  "TagList",
  "CalendarHeader",
  "DateInput",
  "Chart",
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

function resolveSize(
  size: Record<string, unknown>,
  theme: "light" | "dark",
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(size))
    resolved[key] =
      typeof value === "string" && /^\{[\w]+\.[^{}]+\}$/.test(value)
        ? resolveToken(value as TokenRef, theme)
        : value;
  return resolved;
}

/** `var(--name)` theme color (the CSS form of `{color.name}`) → its token value. */
export function cssVarColor(value: unknown, theme: "light" | "dark"): unknown {
  const match =
    typeof value === "string" ? /^var\(--([a-z0-9-]+)\)$/.exec(value) : null;
  if (!match) return value;
  const resolved = resolveToken(`{color.${match[1]}}` as TokenRef, theme);
  if (typeof resolved !== "string")
    throw new Error(`CATALOG_CSS_VAR_COLOR_UNRESOLVED:${value}`);
  return resolved;
}

/** Display states whose rule paint (variant fill/text/border) the executor draws for a node. */
const INTERACTION_STATES: ReadonlySet<StateName> = new Set(["hover", "pressed"]);
const SELECTION_STATES: ReadonlySet<StateName> = new Set([
  "selected",
  "selectedHover",
  "selectedPressed",
]);
/**
 * States a rule-backed node's own rule paint answers (`resolveCatalogPaint` interaction and RAC
 * selection). Other states reach it only through typed rules (disabled opacity) — the G3 census
 * classifies registered state axes by this set.
 */
export const CATALOG_RULE_EXECUTOR_PAINT_STATES: ReadonlySet<StateName> = new Set([
  ...INTERACTION_STATES,
  ...SELECTION_STATES,
]);

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
}

/**
 * The rule paint a rule-backed node shows: its RAC selection (`data-selected` — a collection
 * owner's derived selection, else the display state), the variant the DOM styles it with, its size
 * and the resolved variant/state paint. The shape builder and a label that inherits the node's
 * color (`catalogRuleTextColor`) read the same decision.
 */
function catalogRulePaint(
  input: Omit<CatalogRuleShapeInput, "rect">,
  box?: { width: number; height: number },
) {
  const { node, rule, type, authoredVisual, state } = input;
  const theme = input.theme ?? "light";
  // Authored writes (project override, template, instance, path) layer on the rule, which
  // supplies everything else — the same order as `props.style` over the rule table.
  const style: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(authoredVisual)) {
    const styleKey = PAINT_STYLE_KEYS[key] ?? GEOMETRY_STYLE_KEYS[key];
    if (styleKey)
      style[styleKey] = PAINT_STYLE_KEYS[key] ? cssVarColor(value, theme) : value;
  }
  const props: Record<string, unknown> = { ...node.props };
  // RAC `data-selected`: the rule's selected paint (and the `_isSelected` data branch the
  // selection primitives read — the Tab indicator). A collection owner's selection
  // (`derivedProps._isSelected`, Tabs' selected key) decides for its items — an item instance of a
  // selected state origin inside Tabs is selected only when its key is; else the display state.
  const ownerSelected =
    typeof props._isSelected === "boolean" ? props._isSelected : undefined;
  const selected =
    ownerSelected ?? (state !== undefined && SELECTION_STATES.has(state));
  if (selected) {
    props.isSelected = true;
    props._isSelected = true;
  } else if (ownerSelected === false) delete props.isSelected;
  if (state === "disabled") props.isDisabled = true;
  props.style = box ? { ...style, width: box.width, height: box.height } : style;
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
  const variantName =
    props.isSelected === true &&
    rule.variants.selected &&
    (props.variant === undefined || props.variant === rule.defaultVariant)
      ? "selected"
      : resolveCatalogVariantName(rule, props);
  const variant = variantName ? rule.variants[variantName] : undefined;
  const sizeName = (props.size as string | undefined) ?? rule.defaultSize;
  const size =
    (sizeName ? rule.sizes[sizeName] : undefined) ??
    (rule.defaultSize ? rule.sizes[rule.defaultSize] : undefined) ??
    {};
  const paintProps =
    variantName === "selected" && props.isSelected === true
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

/** Shapes for one rule-backed node (before conversion; exposed for shape-level checks). */
export function catalogRuleShapes(input: CatalogRuleShapeInput): Shape[] {
  const { rect, rule, type } = input;
  const { props, style, variant, size, paint, theme } = catalogRulePaint(
    input,
    rect,
  );
  if (BOX_SIZE_TYPES.has(type)) {
    props._containerWidth = rect.width;
    props._containerHeight = rect.height;
  }
  if (type === "Chart" && rule.chart) props._chartRule = rule.chart;
  const visual = variant ? ruleVariantToVisual(variant) : undefined;
  const sizeSpec = size as unknown as SizeSpec;
  const mergedStyle = {
    ...resolveSize(size as Record<string, unknown>, theme),
    ...style,
  };
  const ctx = { props, size: sizeSpec, visual, paint, style: mergedStyle };
  const binding = getPrimitiveBinding(type)?.skiaPrimitive;
  const keys = binding ? (Array.isArray(binding) ? binding : [binding]) : [];
  for (const key of keys) {
    if (getSkiaPrimitiveMode(key) !== "replace") continue;
    const replaced = getSkiaPrimitive(key)?.(ctx);
    if (replaced) return replaced;
  }
  const shellProps = CHILD_PROP_MERGE_TYPES.has(type)
    ? {
        ...props,
        children: undefined,
        text: undefined,
        label: undefined,
        placeholder: undefined,
      }
    : props;
  const base = buildCatalogShapes(
    visual,
    paint,
    shellProps,
    sizeSpec,
    rule.textDecoration,
    type,
  );
  const prepend: Shape[] = [];
  const append: Shape[] = [];
  for (const key of keys) {
    const mode = getSkiaPrimitiveMode(key);
    if (mode === "replace") continue;
    const shapes = getSkiaPrimitive(key)?.(ctx);
    if (!shapes) continue;
    if (mode === "prepend") prepend.push(...shapes);
    else append.push(...shapes);
  }
  return composeCatalogShapes(base, prepend, append);
}

/** CanvasKit node data for one rule-backed node. */
export function catalogRuleNodeData(
  input: CatalogRuleShapeInput,
): SkiaNodeData {
  const shapes = catalogRuleShapes(input);
  const size = input.rule.sizes[
    (input.node.props.size as string | undefined) ??
      input.rule.defaultSize ??
      ""
  ] as Record<string, unknown> | undefined;
  normalizeMiddleBaselineTextLineHeight(shapes, size ?? {});
  if (input.type === "Tag" || input.type === "Badge")
    for (const shape of shapes)
      if (shape.type === "text" && shape.whiteSpace == null)
        shape.whiteSpace = "nowrap";
  return specShapesToSkia(
    shapes,
    input.theme ?? "light",
    input.rect.width,
    input.rect.height,
    input.node.id,
  );
}
