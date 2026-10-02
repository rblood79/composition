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
import { getPrimitiveBinding } from "@composition/shared";
import { ruleVariantToVisual } from "../workspace/canvas/skia/resolveSkiaVisualRule";
import { specShapesToSkia } from "../workspace/canvas/skia/specShapeConverter";
import { normalizeMiddleBaselineTextLineHeight } from "../workspace/canvas/skia/specBuildHelpers";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import {
  CHILD_PROP_MERGE_TYPES,
  catalogRulePaint,
  type CatalogRuleShapeInput,
} from "./rulePaint";

/**
 * ADR-248 Canvas executor for rule-backed definitions (`LibraryDefinition.ruleId`): the node's
 * D3 rule (variant/state paint, sub-part structure) plus its resolved props and authored visual
 * writes → the catalog shape generators (`@composition/specs`) → CanvasKit node data.
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
