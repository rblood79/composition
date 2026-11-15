import type { CSSProperties, ReactElement } from "react";
import { cloneElement, createElement } from "react";
import {
  GridLayout,
  ListLayout,
  Size,
  TableLayout,
  Virtualizer,
} from "react-aria-components/Virtualizer";
import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";
import {
  catalogVirtualListLayout,
  type CatalogVirtualListReaders,
} from "./virtualListLayout";
type GridInput = {
  type: string;
  props: Readonly<Record<string, unknown>>;
  options: CatalogVirtualListReaders["gridOptions"];
};
const size = (value: { width: number; height: number } | undefined) =>
  value && new Size(value.width, value.height);

/**
 * RAC's `GridLayout` with its options picked at the scroll width (S2 CardView's t-shirt size fit —
 * `catalogVirtualGridOptions` — given by the DOM runtime, the function the Canvas lays the grid out
 * with: a static import would split it into a chunk of its own).
 */
class CatalogGridLayout extends GridLayout<unknown> {
  override shouldInvalidateLayoutOptions(next: object, previous: object): boolean {
    const a = next as GridInput;
    const b = previous as GridInput;
    return a.type !== b.type || a.props !== b.props || a.options !== b.options;
  }
  override update(context: Parameters<GridLayout<unknown>["update"]>[0]): void {
    const { type, props, options: optionsAt } =
      context.layoutOptions as unknown as GridInput;
    const options = optionsAt(type, props, this.virtualizer?.size.width ?? 0) ?? {};
    super.update({
      ...context,
      layoutOptions: {
        minItemSize: size(options.minItemSize),
        maxItemSize: size(options.maxItemSize),
        minSpace: size(options.minSpace),
      },
    });
  }
}

/**
 * ADR-310 Phase 8 (Decision 10 「가상 스크롤」 — the Preview · publish lazy chunk): a list whose row
 * display is `virtual` draws inside RAC's `Virtualizer` — only its visible rows are in the DOM. The
 * `Layout` and its options come from the values the Canvas lays the list out with
 * (`catalogVirtualListLayout`); a list a `Layout` cannot place the same way draws as it is.
 */
export default function CatalogVirtualizer({
  root,
  record,
  readers,
  element: drawn,
}: {
  root: CatalogCompositionRoot;
  record: CatalogConsumerNode;
  readers: CatalogVirtualListReaders;
  element: ReactElement;
}): ReactElement {
  let element = drawn;
  const layout = catalogVirtualListLayout(root, record, readers);
  if ("refused" in layout) return element;
  // (The list is the scroll box the `Virtualizer` fills — its rows are placed by the `Layout`, so
  //  the list's own flex · grid flow no longer applies: RAC's reference gives it `display: block`.)
  const own = (element.props as { style?: unknown }).style;
  element = cloneElement(element, {
    style: {
      ...(own && typeof own === "object" ? (own as CSSProperties) : {}),
      display: "block",
      overflow: "auto",
      // (The `Layout` adds the list's padding — `ListLayout` `padding` · `GridLayout` spacing: the
      //  CSS padding would put it in twice, R12 — the reference's `padding: 0`.)
      ...(layout.kind !== "table" ? { padding: 0 } : {}),
    },
  } as never);
  if (layout.kind === "grid")
    return createElement(Virtualizer, {
      layout: CatalogGridLayout,
      layoutOptions: {
        type: layout.type,
        props: layout.props,
        options: readers.gridOptions,
      },
      children: element,
    } as never);
  return createElement(Virtualizer, {
    layout: layout.kind === "table" ? TableLayout : ListLayout,
    layoutOptions: layout.options,
    children: element,
  } as never);
}
