import { catalogBoxModel } from "./boxModel";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogPlacementStyle } from "./position";
import { catalogStyleView } from "./styleFields";

/**
 * The CSS view of a drawn record's effective typed fields — what the Canvas and the DOM read:
 * the resolved record (definition · rule sizes · parent part rules · size propagation · authored
 * layers at the session breakpoint) through the same box model (`catalogBoxModel`) the layout
 * input and the DOM binding project from, plus the layout longhands (`rowGap` · margins · max)
 * and typography the record carries. Lengths are px text, `lineHeight` is px against the
 * record's font size. The Design panel shows these where nothing is authored; dirty and reset
 * stay on the authored fields (`styleDirty.ts`).
 *
 * Why (2026-10-09): the panel re-derived its defaults from the node's own type rule
 * (`specPresetResolver`), so a part placed by its parent's rule (CheckboxButton · RadioButton ·
 * SwitchButton — `inline-flex`, gap 8) showed Block · 0, a Label under a size-xl Checkbox showed
 * 14px for 18px, and a TextField root showed its input's padding 12 that no consumer applies.
 * Paint (variant colors) stays with the panel's paint adapter; it is not in this view.
 */
export function catalogEffectiveStyle(
  record: CatalogConsumerNode,
): Record<string, string | number> {
  const fontSize =
    typeof record.visual.fontSize === "number"
      ? record.visual.fontSize
      : undefined;
  const style = catalogStyleView(
    { visual: record.visual, layout: record.layout, sizing: record.sizing },
    { fontSize },
  );
  const box = catalogBoxModel(record);
  const px = (value: number | string) =>
    typeof value === "number" ? `${value}px` : value;
  style.display = box.display;
  if (box.flexDirection) style.flexDirection = box.flexDirection;
  if (box.alignItems) style.alignItems = box.alignItems;
  if (box.justifyContent) style.justifyContent = box.justifyContent;
  if (box.flexWrap) style.flexWrap = box.flexWrap;
  if (box.gap !== undefined) style.gap = px(box.gap);
  if (box.padding) {
    style.paddingTop = px(box.padding.top);
    style.paddingRight = px(box.padding.right);
    style.paddingBottom = px(box.padding.bottom);
    style.paddingLeft = px(box.padding.left);
  }
  for (const key of ["width", "height", "minWidth", "minHeight"] as const) {
    const value = box[key];
    if (value !== undefined) style[key] = px(value);
  }
  if (box.borderWidth !== undefined) style.borderWidth = px(box.borderWidth);
  Object.assign(style, catalogPlacementStyle(record.placement));
  return style;
}
