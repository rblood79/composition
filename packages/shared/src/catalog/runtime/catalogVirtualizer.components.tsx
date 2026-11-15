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
      // (The `Layout` adds the list's padding — `ListLayout` `padding`: the CSS padding would put
      //  it in twice, R12 — the reference's `padding: 0`.)
      ...(layout.kind === "list" ? { padding: 0 } : {}),
    },
  } as never);
  if (layout.kind === "grid") {
    const { minItemSize, maxItemSize, minSpace, maxColumns } = layout.options;
    return createElement(Virtualizer, {
      layout: GridLayout,
      layoutOptions: {
        minItemSize: new Size(minItemSize.width, minItemSize.height),
        maxItemSize: new Size(maxItemSize.width, maxItemSize.height),
        minSpace: new Size(minSpace.width, minSpace.height),
        ...(maxColumns ? { maxColumns } : {}),
        preserveAspectRatio: true,
      },
      children: element,
    } as never);
  }
  return createElement(Virtualizer, {
    layout: layout.kind === "table" ? TableLayout : ListLayout,
    layoutOptions: layout.options,
    children: element,
  } as never);
}
