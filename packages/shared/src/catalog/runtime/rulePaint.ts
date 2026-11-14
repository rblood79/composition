import { installedFocusRingCss } from "./themeMaps";
import { evaluateConditionTree } from "../rule/conditionTree";
import {
  cssVarToTokenRef,
  resolveToken,
  type TokenRef,
} from "@composition/rendering";
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
  "Accordion",
  "ButtonGroup",
  "ActionButtonGroup",
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
  // Top-aligned text uses this inset in buildCatalogShapes (including a prefix Input's zero).
  paddingTop: "paddingTop",
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
  // (2026-11-14) A Nav's current Link (`navRoute.ts` — the Link rule's `isCurrent` weight) over the rule's
  //   variant weight (standalone 500), as the sheet's `[data-current]` beats `[data-standalone]`; an authored
  //   weight still wins (the layers below).
  if (
    node.derivedProps?._navCurrent === true &&
    typeof node.derivedProps.fontWeight === "number"
  )
    style.fontWeight = node.derivedProps.fontWeight;
  // Popover 항목 모서리도 CSS와 같은 size 상태 트리에서 읽는다.
  if (
    node.derivedProps?._inPopover === true ||
    node.props._inPopover === true
  ) {
    const radius = evaluateConditionTree(
      rule.structure?.stateStyles?.borderRadius,
      {
        inPopover: true,
        size: String(node.props.size ?? rule.defaultSize),
      },
    );
    if (radius !== undefined)
      style.borderRadius =
        typeof radius === "number"
          ? radius
          : containerVariantLength(String(radius));
  }
  // A rule without `structure` has no generated sheet: the DOM inlines the record's whole resolved
  //   visual (`domBinding.runtime.ts` `authoredStyle` `noSheet`) — a part rule's paint (a Table's header
  //   row and lines, the GridList box — `manualBoxRules`) included. The Canvas paints the same record
  //   paint over the tree (ADR-297 후속 ②: it painted only the authored layer, the tree's transparent
  //   under it).
  const recordPaint =
    rule.structure || node.derivedProps?._pickerValue === true
      ? authoredVisual
      : {
          ...Object.fromEntries(
            Object.keys(PAINT_STYLE_KEYS)
              .filter(
                (key) =>
                  node.visual[key as keyof typeof node.visual] !== undefined,
              )
              .map((key) => [
                key,
                node.visual[key as keyof typeof node.visual],
              ]),
          ),
          ...authoredVisual,
        };
  for (const [key, value] of Object.entries(recordPaint)) {
    const styleKey = PAINT_STYLE_KEYS[key] ?? GEOMETRY_STYLE_KEYS[key];
    if (styleKey)
      style[styleKey] = PAINT_STYLE_KEYS[key]
        ? cssVarColor(value, theme)
        : value;
  }
  // ADR-295 후속 C3: a ColorSwatch's box is its color (`_swatchColor` — its own `color` or its picker
  //   item's; the DOM's RAC ColorSwatch writes the same `background-color` inline). It is the content,
  //   so it paints over an authored fill as RAC's inline style does.
  if (typeof node.derivedProps?._swatchColor === "string")
    style.backgroundColor = node.derivedProps._swatchColor;
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
    ...(node.derivedProps?._searchFieldPart === true ||
    node.derivedProps?._pickerTrigger === true ||
    node.derivedProps?._pickerValue === true
      ? node.derivedProps
      : {}),
    _isFocusVisible: state === "focusVisible",
    ...input.paintProps,
  };
  // RAC 메뉴/옵션은 pointer 이동도 focus로 표현한다. DOM에서 hover를 따로 칠하면
  // 방향키로 이동한 뒤 포인터 아래 항목과 키보드 항목이 동시에 강조된다.
  props._isFocused =
    state === "focusVisible" ||
    ((type === "MenuItem" || type === "ListBoxItem") && state === "hover");
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
  // (Disabled as `catalogStateValue` reads it: the display state, the record's own flag, or the one an
  //  owner hands it — a Button in a disabled ButtonGroup, a field's part. The flags OR — the palette
  //  default `isDisabled: false` does not hide an owner's `true`. ADR-297 3h #7: a disabled color.)
  const derived = node.derivedProps as Record<string, unknown> | undefined;
  if (
    state === "disabled" ||
    derived?.isDisabled === true ||
    derived?._fieldDisabled === true
  )
    props.isDisabled = true;
  if (derived?._inActionGroup === true)
    props._groupPosition = {
      orientation: derived.orientation,
      density: derived.density,
      isFirst: derived._actionFirst,
      isLast: derived._actionLast,
      isOnly: derived._actionFirst && derived._actionLast,
    };
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

  // ADR-297 Phase 3d: a selected item paints its variant's `isSelected` branch (the DOM's `[data-selected]`)
  //   — no rule swaps in a `selected` variant any more. An emphasized owner's selection (S2 TagGroup
  //   `isEmphasized` — the item's derived `_emphasized`) is the tree's `isEmphasized` condition.
  const variantName = resolveCatalogVariantName(rule, props);
  const variant = variantName ? rule.variants[variantName] : undefined;
  const sizeName = (props.size as string | undefined) ?? rule.defaultSize;
  const size =
    (sizeName ? rule.sizes[sizeName] : undefined) ??
    (rule.defaultSize ? rule.sizes[rule.defaultSize] : undefined) ??
    {};
  const paintProps =
    props._emphasized === true && props.isEmphasized === undefined
      ? { ...props, isEmphasized: true }
      : props;
  const paint = resolveCatalogPaint({
    variant,
    size,
    props: paintProps,
    style: props.style as Record<string, unknown>,
    interactionState: interaction(state),
    fillStyleValues: rule.fillStyleValues,
  });
  // (Authored fill layers are the box's background — the DOM's inline fill also turns the class gradient
  //  off, `authoredStyle` — so the rule's gradient does not paint over them.)
  if (node.fills?.length) delete paint.backgroundImage;
  const selectors = rule.structure?.composition?.rootSelectors as
    Record<string, { styles?: Record<string, string> }> | undefined;
  const placeholderColor = selectors?.["&::placeholder"]?.styles?.color;
  if (
    placeholderColor &&
    (node.derivedProps?._inputHasValue ?? props._inputHasValue) !== true &&
    style.color === undefined
  ) {
    paint.color = cssVarToTokenRef(placeholderColor) ?? placeholderColor;
  }
  return { props, style, variant, size, paint, theme };
}

/** 레이아웃을 차지하지 않는 catalog 기본 outline (CSS와 Canvas 공용). */
export function catalogContainerOutline(rule: Readonly<ComponentRule>) {
  const value = rule.structure?.containerStyles?.outline;
  const match =
    typeof value === "string"
      ? /^(\d+(?:\.\d+)?)px solid (.+)$/.exec(value)
      : null;
  return match
    ? { width: Number(match[1]), color: cssVarToTokenRef(match[2]) ?? match[2] }
    : undefined;
}

/** Toggle 부품의 내용색도 생성 CSS와 같은 상태 트리에서 읽는다. */
export function catalogToggleContentColor(input: CatalogRuleShapeInput) {
  const selector =
    input.type === "Checkbox"
      ? "& .react-aria-CheckboxButton% .checkbox"
      : input.type === "Switch"
        ? "& .react-aria-SwitchButton% .indicator::before"
        : undefined;
  if (!selector) return undefined;
  const { props } = catalogRulePaint(input);
  const styles = input.rule.partStateStyles?.[selector];
  return evaluateConditionTree(
    styles?.[input.type === "Checkbox" ? "--checkmark-color" : "background"],
    {
      isSelected: props.isSelected === true,
      isDisabled: props.isDisabled === true,
      isHovered: input.state === "hover" || input.state === "selectedHover",
      isPressed: input.state === "pressed" || input.state === "selectedPressed",
      isFocusVisible: input.state === "focusVisible",
    },
  );
}

/**
 * The rule's state-tree `box-shadow` (`structure.stateStyles.boxShadow`) the generated sheet draws —
 * the same conditions on the Canvas (S2 SelectBox: `emphasized` at rest, `elevated` hovered or
 * selected, `none` disabled — 2026-11-08 사용자 「SelectBoxGroup 이 레퍼런스와 boxShadow 가 다르다」:
 * the Canvas read only `containerStyles.boxShadow`, so a state-tree elevation never drew there).
 * A picker trigger's tree (`isPicker`) stays with its own paint — no `isPicker` condition here.
 */
export function catalogStateBoxShadow(
  input: Omit<CatalogRuleShapeInput, "rect">,
  tree: unknown = input.rule.structure?.stateStyles?.boxShadow,
): string | undefined {
  if (tree === undefined) return undefined;
  const { props } = catalogRulePaint(input);
  const value = evaluateConditionTree(tree, {
    // ADR-303: Card 의 tertiary · quiet 가지 (`variant: { tertiary: "none" }`) — DOM `[data-variant]`.
    variant: resolveCatalogVariantName(input.rule, props),
    isSelected: props.isSelected === true,
    isDisabled: props.isDisabled === true,
    isQuiet: props.isQuiet === true,
    isInvalid: props.isInvalid === true,
    isHovered: input.state === "hover" || input.state === "selectedHover",
    isPressed: input.state === "pressed" || input.state === "selectedPressed",
    isFocusVisible: input.state === "focusVisible",
  });
  return value === undefined ? undefined : String(value);
}

/**
 * ADR-303 (리뷰 round 3 m1) — the state shadow an owner's rule gives a descendant part: the
 * `partStateStyles["&% .react-aria-<Type>"].boxShadow` tree the generated sheet compiles to a
 * descendant rule under the owner's state (S2 quiet Card's CardPreview, `Card.tsx:251`). The Canvas
 * evaluates it at the owner's state (`catalogStateBoxShadow(ownerInput, tree)`).
 */
export function catalogOwnerPartShadowTree(
  owner: Readonly<ComponentRule>,
  partType: string,
): unknown {
  return owner.partStateStyles?.[`&% .react-aria-${partType}`]?.boxShadow;
}

const OWNER_PART_SHADOW = /^&% \.react-aria-(\w+)$/;
const ownerPartShadowTypes = new WeakMap<object, ReadonlySet<string>>();
/** The part types some rule gives an owner-state shadow (`catalogOwnerPartShadowTree`). */
export function catalogOwnerPartShadowTypes(
  rules: ReadonlyMap<string, Readonly<ComponentRule>>,
): ReadonlySet<string> {
  let types = ownerPartShadowTypes.get(rules);
  if (!types) {
    types = new Set(
      [...rules.values()].flatMap((rule) =>
        Object.entries(rule.partStateStyles ?? {}).flatMap(
          ([selector, styles]) => {
            const type = OWNER_PART_SHADOW.exec(selector)?.[1];
            return type && styles.boxShadow !== undefined ? [type] : [];
          },
        ),
      ),
    );
    ownerPartShadowTypes.set(rules, types);
  }
  return types;
}

/** 상태 트리의 outline을 Canvas도 같은 조건과 설치된 focus 변수로 해석한다. */
export function catalogStateOutline(input: CatalogRuleShapeInput) {
  const conditions = {
    isFocusVisible: input.state === "focusVisible",
    isSearchFieldPart: input.node.derivedProps?._searchFieldPart === true,
    staticColor: String(
      input.node.derivedProps?.staticColor ??
        input.node.props.staticColor ??
        "auto",
    ),
  };
  const part = input.type === "Checkbox" ? ".checkbox" : ".indicator";
  const styles =
    input.rule.structure?.archetype === "toggle-indicator"
      ? input.rule.partStateStyles?.[
          `& .react-aria-${input.type}Button% ${part}`
        ]
      : input.rule.structure?.stateStyles;
  const resolveFocus = (value: unknown) =>
    String(value ?? "").replace(
      /var\((--focus-ring(?:-width|-offset)?)\)/g,
      (_match, name: string) =>
        installedFocusRingCss(name, input.theme ?? "light"),
    );
  const value = resolveFocus(
    evaluateConditionTree(styles?.outline, conditions),
  );
  const match = /^(\d+(?:\.\d+)?)px solid (.+)$/.exec(value);
  if (!match) return undefined;
  return {
    width: Number(match[1]),
    offset: parseFloat(
      resolveFocus(evaluateConditionTree(styles?.outlineOffset, conditions)) ||
        "0",
    ),
    color: cssVarToTokenRef(match[2]) ?? match[2],
  };
}

/** The stroke an overlay arrow draws its overlay's border with (the svg path's outer half shows). */
export const CATALOG_OVERLAY_ARROW_STROKE_WIDTH = 2;

/**
 * An open overlay's arrow (RAC `OverlayArrow`) is its overlay's surface — the reference starter's
 * `fill: var(--overlay-background); stroke: var(--border-color)`: the overlay's resolved fill, and
 * its border (when it draws one) as the stroke. Values stay as the paint gives them (a TokenRef or
 * a literal) — the DOM writes a token's variable, the Canvas resolves it in its color mode.
 */
export function catalogOverlayArrowPaint(
  input: Omit<CatalogRuleShapeInput, "rect">,
): Readonly<Record<string, string | number>> {
  const { paint } = catalogRulePaint(input);
  const visible = (color: string | undefined) =>
    color !== undefined && color !== "{color.transparent}" ? color : undefined;
  const fill = visible(paint.backgroundColor);
  const outline = catalogContainerOutline(input.rule);
  const stroke = outline?.color ?? visible(paint.borderColor);
  return {
    ...(fill ? { _arrowFill: fill } : {}),
    ...(stroke
      ? {
          _arrowStroke: stroke,
          _arrowStrokeWidth:
            outline?.width ?? CATALOG_OVERLAY_ARROW_STROKE_WIDTH,
        }
      : {}),
  };
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
