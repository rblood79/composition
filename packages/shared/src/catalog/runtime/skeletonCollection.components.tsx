import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createLeafComponent } from "react-aria/CollectionBuilder";
import { CollectionNode } from "react-aria/private/collections/BaseCollection";
import {
  catalogGridSkeletonCount,
  catalogWaterfallSkeletonCount,
} from "./skeletonRepeat";
import {
  catalogElementScale,
  catalogGridTrackCount,
  catalogPx as px,
  catalogWaterfallExtents,
  catalogWaterfallItems,
  catalogWaterfallLanes,
} from "./waterfall";

/**
 * ADR-314 Phase 4 — S2 `SkeletonCollection` (`@react-spectrum/s2/src/SkeletonCollection.tsx`) on the
 * DOM: a collection node of type `skeleton` whose render is the CardView's Card template (its content
 * draws the loading look — a SkeletonCollection is a loading Skeleton to it, `skeletonContext.ts`).
 * RAC's layouts treat the type as S2's: a virtualized `GridLayout` repeats one to fill the view, and
 * the GridList's keyboard · selection skip it. Without a virtualizer the CardView repeats it itself
 * (`CatalogSkeletonFill` — the count from the drawn grid, `skeletonRepeat.ts`).
 */
class CatalogSkeletonNode extends CollectionNode<unknown> {
  static readonly type = "skeleton";
}

interface CatalogSkeletonItemProps {
  readonly id: string;
  readonly children: ReactNode;
  /** The first item measures the drawn grid for the repeat count (non-virtualized). */
  readonly measure?: boolean;
}

export const CatalogSkeletonItem = createLeafComponent(
  CatalogSkeletonNode,
  (props: CatalogSkeletonItemProps): ReactElement => (
    <>
      {props.measure ? <SkeletonMeasure /> : null}
      {props.children}
    </>
  ),
);

interface SkeletonFill {
  readonly measure: (marker: HTMLElement) => void;
}
const SkeletonFillContext = createContext<SkeletonFill | null>(null);

/** A hidden marker before the first item: its next sibling is the drawn template, its parent the grid. */
function SkeletonMeasure(): ReactElement {
  const fill = useContext(SkeletonFillContext);
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (fill && ref.current) fill.measure(ref.current);
  }, [fill]);
  return <span ref={ref} hidden data-skeleton-measure="" />;
}

export interface CatalogSkeletonFillProps {
  /** The CardView element for a count (its children: cards, then `count` skeleton items). */
  readonly render: (count: number) => ReactElement;
  /** Cards drawn before the skeleton items. */
  readonly existing: number;
  readonly waterfall: boolean;
  /** The CardView has a set height — fill it (else the content-height policy). */
  readonly fixedHeight: boolean;
  readonly [prop: string]: unknown;
}

/**
 * The repeat count from the grid as drawn: columns (grid tracks, or how many template widths fit a
 * flex row), the template's height, the row gap, and — waterfall — the columns' heights after the
 * cards (`catalogWaterfallLanes`, the placement `CatalogWaterfallGrid` uses). Starts at one item to
 * measure. Props a wrapper puts on the CardView element (marks · handlers) pass to it.
 */
export function CatalogSkeletonFill({
  render,
  existing,
  waterfall,
  fixedHeight,
  ...rest
}: CatalogSkeletonFillProps): ReactElement {
  const [count, setCount] = useState(1);
  const measure = useCallback(
    (marker: HTMLElement) => {
      const grid = marker.parentElement;
      const card = marker.nextElementSibling as HTMLElement | null;
      const view = marker.ownerDocument.defaultView;
      if (!grid || !card || !view) return;
      const cs = view.getComputedStyle(grid);
      const rowGap = px(cs.rowGap);
      const columnGap = px(cs.columnGap);
      // (Heights in CSS px — a zoomed Preview frame draws them scaled.)
      const scale = catalogElementScale(grid);
      const rect = card.getBoundingClientRect();
      const box = { width: rect.width / scale, height: rect.height / scale };
      const tracks = catalogGridTrackCount(cs);
      const inner = grid.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
      const columns =
        cs.display.includes("grid") && tracks > 0
          ? tracks
          : Math.max(
              1,
              Math.floor((inner + columnGap) / (box.width + columnGap)),
            );
      const viewportHeight = fixedHeight ? grid.clientHeight : undefined;
      let next: number;
      if (waterfall) {
        const extents = catalogWaterfallExtents(
          catalogWaterfallItems(grid, view).slice(0, existing),
          view,
          scale,
        );
        const lanes = catalogWaterfallLanes(extents, columns, rowGap);
        const heights = new Array<number>(columns).fill(rowGap);
        lanes.forEach((lane, i) => {
          const [top, height, bottom] = extents[i]!;
          heights[lane] = heights[lane]! + top + height + bottom + rowGap;
        });
        next = catalogWaterfallSkeletonCount({
          columnHeights: heights,
          itemHeight: box.height,
          gap: rowGap,
          viewportHeight,
        });
      } else
        next = catalogGridSkeletonCount({
          columns,
          existing,
          itemHeight: box.height,
          gap: rowGap,
          viewportHeight,
        });
      setCount((current) => (current === next ? current : Math.max(1, next)));
    },
    [existing, waterfall, fixedHeight],
  );
  const element = render(count);
  const fill = useMemo(() => ({ measure }), [measure]);
  return (
    <SkeletonFillContext.Provider value={fill}>
      {cloneElement(element, rest)}
    </SkeletonFillContext.Provider>
  );
}
