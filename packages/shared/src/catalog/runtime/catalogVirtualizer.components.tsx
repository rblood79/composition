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
import { catalogTableTrackWidths } from "./tableTrackWidths";
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
  override shouldInvalidateLayoutOptions(
    next: object,
    previous: object,
  ): boolean {
    const a = next as GridInput;
    const b = previous as GridInput;
    return a.type !== b.type || a.props !== b.props || a.options !== b.options;
  }
  override update(context: Parameters<GridLayout<unknown>["update"]>[0]): void {
    const {
      type,
      props,
      options: optionsAt,
    } = context.layoutOptions as unknown as GridInput;
    const options =
      optionsAt(type, props, this.virtualizer?.size.width ?? 0) ?? {};
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

type ListContext = Parameters<ListLayout<unknown>["update"]>[0];

/**
 * ADR-310 G8 ⑤ — a list whose rows the Preview estimates (no laid-out row there): the estimate
 * becomes the last row RAC measured. RAC re-lays the list out only when a measured row differs from
 * its rect (`ListLayout.updateItemSize`) — with the first estimate (40) every new row of a 32 px list
 * did, so each scroll frame added a commit and RAC mounted the rows anew instead of reusing their
 * views (live, 4x: p95 25 ms · 80 % of frames dropped; RAC's own list at a fixed size 16.6 ms). Rows
 * are still measured (each keeps `estimatedSize`), so a row that differs moves the rest as before.
 */
export class CatalogListLayout extends ListLayout<unknown> {
  private measured: number | undefined;
  override update(context: ListContext): void {
    const options = context.layoutOptions as
      { rowSize?: number; estimatedRowSize?: number } | undefined;
    super.update(
      this.measured !== undefined && options?.rowSize == null
        ? ({
            ...context,
            layoutOptions: { ...options, estimatedRowSize: this.measured },
          } as ListContext)
        : context,
    );
  }
  override updateItemSize(
    ...args: Parameters<ListLayout<unknown>["updateItemSize"]>
  ): boolean {
    const [, measured] = args;
    const along =
      this.orientation === "horizontal" ? measured.width : measured.height;
    if (this.rowSize == null && along > 0) {
      this.measured = along;
      this.estimatedRowSize = along;
    }
    return super.updateItemSize(...args);
  }
}

type TableInput = {
  columnTracks?: readonly string[];
  rowEdge?: { top: number; bottom: number };
  columnWidths?: Map<unknown, number>;
};
type TableContext = Parameters<TableLayout<unknown>["update"]>[0];
type RowNode = ReturnType<TableLayout<unknown>["buildRow"]>;

/**
 * RAC's `TableLayout` placing a Table as the Canvas does: the columns are the Canvas's grid tracks
 * at the scroll width (`catalogTableTrackWidths` — RAC's `TableColumnLayout` rounds to whole px
 * and reads a selection · drag Column as `1fr`), and a row is its cells plus the Row's own border ·
 * padding (`rowEdge` — RAC sizes a row by its measured cells, so a Row's bottom divider fell
 * outside its pitch: 40 a row, the Canvas's 41). A resizable Table keeps RAC's widths (its
 * `ResizableTableContainer` gives them — the Preview's own operation).
 */
class CatalogTableLayout extends TableLayout<unknown> {
  private rowEdge = { top: 0, bottom: 0 };
  override shouldInvalidateLayoutOptions(
    next: object,
    previous: object,
  ): boolean {
    const a = next as TableInput;
    const b = previous as TableInput;
    return (
      a.columnTracks?.join(" ") !== b.columnTracks?.join(" ") ||
      a.rowEdge?.top !== b.rowEdge?.top ||
      a.rowEdge?.bottom !== b.rowEdge?.bottom ||
      super.shouldInvalidateLayoutOptions(next as never, previous as never)
    );
  }
  override update(context: TableContext): void {
    const options = (context.layoutOptions ?? {}) as TableInput;
    this.rowEdge = options.rowEdge ?? { top: 0, bottom: 0 };
    const columns = this.virtualizer?.collection
      ? (
          this.virtualizer.collection as unknown as {
            columns: { key: unknown }[];
          }
        ).columns
      : [];
    const widths =
      !options.columnWidths && options.columnTracks?.length === columns.length
        ? catalogTableTrackWidths(
            options.columnTracks,
            (this.virtualizer?.size.width ?? 0) - this.padding * 2,
          )
        : undefined;
    super.update(
      widths
        ? ({
            ...context,
            layoutOptions: {
              ...context.layoutOptions,
              columnWidths: new Map(
                columns.map((column, index) => [column.key, widths[index]!]),
              ),
            },
          } as TableContext)
        : context,
    );
  }
  protected override getEstimatedRowHeight(): number {
    return (
      super.getEstimatedRowHeight() + this.rowEdge.top + this.rowEdge.bottom
    );
  }
  protected override buildRow(
    ...args: Parameters<TableLayout<unknown>["buildRow"]>
  ): RowNode {
    const node = super.buildRow(...args);
    const { top, bottom } = this.rowEdge;
    if (!top && !bottom) return node;
    // (The cells start below the Row's top edge; the row holds them and its bottom edge.)
    if (top)
      for (const child of node.children ?? []) {
        child.layoutInfo = child.layoutInfo.copy();
        child.layoutInfo.rect.y += top;
      }
    node.layoutInfo.rect.height += top + bottom;
    return node;
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
    layout: layout.kind === "table" ? CatalogTableLayout : CatalogListLayout,
    layoutOptions: layout.options,
    children: element,
  } as never);
}
