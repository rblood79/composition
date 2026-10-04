import {
  buildCatalogShapes,
  composeCatalogShapes,
  cssVarToTokenRef,
  getSkiaPrimitive,
  getSkiaPrimitiveMode,
  resolveLeadingSlot,
  resolveSpecFontSize,
  resolveToken,
  type Shape,
  type SizeSpec,
  type TokenRef,
} from "@composition/rendering";
import { getPrimitiveBinding } from "@composition/shared";
import { ruleVariantToVisual } from "../workspace/canvas/skia/resolveSkiaVisualRule";
import { specShapesToSkia } from "../workspace/canvas/skia/specShapeConverter";
import { normalizeMiddleBaselineTextLineHeight } from "../workspace/canvas/skia/specBuildHelpers";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";
import {
  CHILD_PROP_MERGE_TYPES,
  catalogRulePaint,
  type CatalogRuleShapeInput,
} from "./rulePaint";

/**
 * ADR-248 Canvas executor for rule-backed definitions (`LibraryDefinition.ruleId`): the node's
 * D3 rule (variant/state paint, sub-part structure) plus its resolved props and authored visual
 * writes → the catalog shape generators (`@composition/rendering`) → CanvasKit node data.
 *
 * Execution capability tables below are binding-level data (which types own their children,
 * merge child props, or need their box size); they are not visual values.
 */

/** Types whose shape generators lay out against the actual box size. */
const BOX_SIZE_TYPES: ReadonlySet<string> = new Set([
  // The avatar circle is its box (a Tag slot chip sizes it 16; `Avatar.tsx` inlines the same box).
  "Avatar",
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

/**
 * The primitive context of a rule-backed node at its box (`ctx` — what a primitive draws from): its
 * rule paint (`catalogRulePaint`), the variant's visual meta, the size spec and the resolved size
 * values under the authored style.
 */
function ruleShapeContext(input: CatalogRuleShapeInput) {
  const { props, style, variant, size, paint, theme } = catalogRulePaint(
    input,
    input.rect,
  );
  const ctx = {
    props,
    size: size as unknown as SizeSpec,
    visual: variant ? ruleVariantToVisual(variant) : undefined,
    paint,
    style: {
      ...resolveSize(size as Record<string, unknown>, theme),
      ...style,
    } as Record<string, unknown>,
  };
  return { ctx, theme };
}

/** Shapes for one rule-backed node (before conversion; exposed for shape-level checks). */
export function catalogRuleShapes(input: CatalogRuleShapeInput): Shape[] {
  const { rect, rule, type } = input;
  const { ctx } = ruleShapeContext(input);
  const { props, visual, paint, size: sizeSpec } = ctx;
  if (BOX_SIZE_TYPES.has(type)) {
    props._containerWidth = rect.width;
    props._containerHeight = rect.height;
  }
  if (type === "Chart" && rule.chart) props._chartRule = rule.chart;
  const binding = getPrimitiveBinding(type)?.skiaPrimitive;
  const keys = binding ? (Array.isArray(binding) ? binding : [binding]) : [];
  for (const key of keys) {
    if (getSkiaPrimitiveMode(key) !== "replace") continue;
    if (key === input.childPrimitive) return [];
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
    if (mode === "replace" || key === input.childPrimitive) continue;
    const shapes = getSkiaPrimitive(key)?.(ctx);
    if (!shapes) continue;
    if (mode === "prepend") prepend.push(...shapes);
    else append.push(...shapes);
  }
  return composeCatalogShapes(base, prepend, append);
}

/**
 * A part node that holds its owner's leading icon (a TreeItem's `TreeItemChevron`): the owner's
 * `leading_icon` primitive — glyph, expanded turn, color — in the part's box, centered in its
 * content box right of `inset` (the DOM chevron button centers its svg). `input` is the owner's.
 */
export function catalogLeadingIconPartNodeData(
  input: CatalogRuleShapeInput,
  inset: number,
): SkiaNodeData {
  const { rect } = input;
  const {
    ctx: { props, visual, paint, size: sizeSpec, style: mergedStyle },
    theme,
  } = ruleShapeContext(input);
  const fontSize = resolveSpecFontSize(
    (mergedStyle.fontSize as string | number | undefined) ?? sizeSpec.fontSize,
    14,
  );
  // The part is the slot alone: no row indent or selection checkbox ahead of it.
  const partProps: Record<string, unknown> = {
    ...props,
    _treeLevel: undefined,
    _showSelectionCheckbox: undefined,
  };
  const slot = resolveLeadingSlot(visual, partProps, sizeSpec, fontSize);
  const iconSize = slot?.kind === "icon" ? slot.size : 0;
  const shapes =
    getSkiaPrimitive("leading_icon")?.({
      props: partProps,
      size: { ...sizeSpec, height: rect.height },
      visual,
      paint,
      style: {
        ...mergedStyle,
        paddingLeft: inset + (rect.width - inset - iconSize) / 2,
      },
    }) ?? [];
  return specShapesToSkia(
    shapes,
    theme,
    rect.width,
    rect.height,
    input.node.id,
  );
}

/** Every text of `data` paints an ellipsis at its box and clips there. */
function ellipsize(data: SkiaNodeData): void {
  if (data.text) {
    data.text.textOverflow = "ellipsis";
    data.text.clipText = true;
  }
  for (const child of data.children ?? []) ellipsize(child);
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
  // Table cells and columns are one line cut at their box with an ellipsis (Table.css
  // `.react-aria-Cell, .react-aria-Column`: nowrap · hidden · ellipsis). A leaf the layout kept on
  // one line is one line at its fractional max-content box.
  const tableText = input.type === "Cell" || input.type === "Column";
  if (
    input.singleLine ||
    input.type === "Tag" ||
    input.type === "Badge" ||
    tableText
  )
    for (const shape of shapes)
      if (shape.type === "text" && shape.whiteSpace == null)
        shape.whiteSpace = "nowrap";
  const data = specShapesToSkia(
    shapes,
    input.theme ?? "light",
    input.rect.width,
    input.rect.height,
    input.node.id,
  );
  if (tableText) ellipsize(data);
  return data;
}

/**
 * A DateInput's paint inputs beyond its props: its RAC segment runs (`dateSegmentPaint` — the row
 * the layout measured), the empty segments' paint (the owner's `[data-placeholder]` color at its
 * opacity in the canvas theme, its italic) and the node's resolved corner and border width (a
 * standalone field draws its own box — DateField `var(--border-radius)` at every size).
 */
export function catalogDateInputPaintProps(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): Record<string, unknown> | undefined {
  const paint = root.dateSegmentPaint(node.id);
  if (!paint) return undefined;
  const { color, opacity, fontStyle } = paint.placeholder;
  const token = color ? cssVarToTokenRef(color) : null;
  const resolved = token ? resolveToken(token, root.colorMode) : color;
  const fill =
    typeof resolved === "string" && /^#[0-9a-f]{6}$/i.test(resolved)
      ? opacity !== undefined && opacity < 1
        ? `${resolved}${Math.round(Math.max(0, opacity) * 255)
            .toString(16)
            .padStart(2, "0")}`
        : resolved
      : undefined;
  const { radius, borderWidth } = node.visual;
  return {
    ...(typeof radius === "number" ? { _boxRadius: radius } : {}),
    ...(typeof borderWidth === "number"
      ? { _boxBorderWidth: borderWidth }
      : {}),
    _segmentRuns: paint.runs,
    ...(fill ? { _segmentPlaceholderFill: fill } : {}),
    ...(fontStyle === "italic" ? { _segmentPlaceholderItalic: true } : {}),
  };
}
