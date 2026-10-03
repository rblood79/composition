import {
  buildSpacingBands,
  type SpacingBand,
} from "../workspace/canvas/interaction/spacingGeometry";
import type { SpacingBoxMetrics } from "../workspace/canvas/interaction/spacingTypes";
import type { BoundingBox } from "../workspace/canvas/selection/types";
import { catalogBoxModel, type CatalogLength } from "./boxModel";
import type { CatalogConsumerNode } from "./compositionRoot";

/** A px length (a number or `Npx`); anything else (%, auto, calc) is not a spacing handle value. */
const pxOf = (value: CatalogLength | undefined): number | undefined => {
  if (value === undefined) return 0;
  if (typeof value === "number") return value;
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match ? Number(match[1]) : undefined;
};

export interface CatalogSpacingPreview {
  /** Preview values while dragging (px): padding sides and the gap. */
  readonly padding?: Partial<Record<keyof SpacingBoxMetrics, number>>;
  readonly gap?: number;
}

/**
 * ADR-248 Phase 4e-3b: the spacing handle bands (ADR-222) of a drawn container record — its four
 * padding sides and, in a one-line flex container with two or more in-flow children, the gaps
 * between them. Values come from the record's box model (the same inputs layout reads); a value
 * that is not px (%, auto) gives no band for that part. `preview` draws the drag values.
 */
export function catalogSpacingBands(
  record: CatalogConsumerNode,
  records: ReadonlyMap<string, CatalogConsumerNode>,
  bounds: (id: string) => BoundingBox | undefined,
  preview: CatalogSpacingPreview = {},
): readonly SpacingBand[] {
  const ownerBounds = bounds(record.id);
  if (!ownerBounds) return [];
  const box = catalogBoxModel(record);
  const border = pxOf(box.borderWidth) ?? 0;
  const sides = {
    top: pxOf(box.padding?.top),
    right: pxOf(box.padding?.right),
    bottom: pxOf(box.padding?.bottom),
    left: pxOf(box.padding?.left),
  };
  const padding = Object.values(sides).every((value) => value !== undefined)
    ? { ...(sides as SpacingBoxMetrics), ...preview.padding }
    : null;
  const flex = box.display === "flex" || box.display === "inline-flex";
  const direction = box.flexDirection ?? "row";
  const horizontal = !direction.startsWith("column");
  const flowChildren = record.children
    .map((id) => records.get(id))
    .filter(
      (child): child is CatalogConsumerNode =>
        !!child &&
        child.placement?.kind !== "absolute" &&
        child.layout.position !== "absolute",
    )
    .map((child) => bounds(child.id))
    .filter((child): child is BoundingBox => !!child);
  const gapValue = preview.gap ?? pxOf(box.gap);
  const gap =
    flex &&
    gapValue !== undefined &&
    flowChildren.length >= 2 &&
    (box.flexWrap ?? "nowrap") === "nowrap"
      ? {
          axis: horizontal ? ("horizontal" as const) : ("vertical" as const),
          value: gapValue,
          reverse: direction.endsWith("reverse"),
          childBounds: flowChildren,
        }
      : null;
  const parent = records.get(record.parentId);
  const parentRow =
    !!parent &&
    ["flex", "inline-flex"].includes(catalogBoxModel(parent).display) &&
    !(catalogBoxModel(parent).flexDirection ?? "row").startsWith("column");
  return buildSpacingBands({
    ownerBounds,
    border: { top: border, right: border, bottom: border, left: border },
    padding,
    // Padding grows the box on an axis whose size follows its content: an unset height, or an
    // unset width of an item in a row (a block's unset width fills its container instead).
    paddingGrowth: {
      x: box.width === undefined && parentRow && !record.layout.flexGrow,
      y: box.height === undefined,
    },
    gap,
  });
}
