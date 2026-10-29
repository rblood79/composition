import {
  useLayoutEffect,
  useRef,
  type ElementType,
  type ReactElement,
} from "react";
import { catalogWaterfallPlace } from "./waterfall";

/**
 * The renderer's grid element (`as` — RAC `GridList` or the shared GridList, which hands `ref` to
 * its RAC GridList) laid out as a waterfall after every render and when it or an item resizes (a
 * card's image loading).
 */
export function CatalogWaterfallGrid({
  as: Grid,
  ...props
}: { readonly as: ElementType } & Record<string, unknown>): ReactElement {
  const ref = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    catalogWaterfallPlace(grid);
    const view = grid.ownerDocument.defaultView;
    if (!view?.ResizeObserver) return;
    let frame = 0;
    const observer = new view.ResizeObserver(() => {
      view.cancelAnimationFrame(frame);
      frame = view.requestAnimationFrame(() => catalogWaterfallPlace(grid));
    });
    observer.observe(grid);
    for (const el of grid.children) observer.observe(el);
    return () => {
      view.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });
  return <Grid {...props} ref={ref} />;
}
