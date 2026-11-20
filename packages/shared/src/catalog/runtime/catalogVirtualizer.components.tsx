import type { CSSProperties, ReactElement } from "react";
import { CATALOG_COLUMN_PINNED_PROP } from "../resolution/tableColumns";
import { catalogTableColumnKey } from "./tableSort";
import { cloneElement, createElement, useRef } from "react";
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
import { CatalogRowWindowMode } from "./rowWindowContext";
import { catalogTableTrackWidths } from "./tableTrackWidths";
import {
  catalogVirtualListLayout,
  type CatalogTableDeviceColumns,
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

/** A windowed Table's rows as its `Layout` reports the ones in view (`CatalogRowWindowKeys`). */
type RowsInView = {
  keys: readonly string[];
  owner: string;
  show: (owner: string, first: number, last: number, total: number) => void;
};
const KEY_INDEX = new WeakMap<readonly string[], Map<string, number>>();
function keyIndexOf(keys: readonly string[]): Map<string, number> {
  let index = KEY_INDEX.get(keys);
  if (!index)
    KEY_INDEX.set(keys, (index = new Map(keys.map((key, at) => [key, at]))));
  return index;
}
type TableInput = {
  columnTracks?: readonly string[];
  rowEdge?: { top: number; bottom: number };
  columnWidths?: Map<unknown, number>;
  /** A windowed Table's rows (a holder the Table sets each render — never part of the layout). */
  rowsInView?: { current: RowsInView | undefined };
  /**
   * ADR-315 Phase 4 — the pinned columns' RAC keys, a side each joined by `\n`
   * (`catalogTablePinnedKeys`): the `Layout` keeps their cells in view (`isStickyColumn`).
   */
  pinnedStart?: string;
  pinnedEnd?: string;
};
type TableContext = Parameters<TableLayout<unknown>["update"]>[0];
type RowNode = ReturnType<TableLayout<unknown>["buildRow"]>;

/**
 * RAC's `TableLayout` placing a Table as the Canvas does: the columns are the Canvas's grid tracks
 * (the selection · drag columns at this device — `catalogVirtualListLayout`) at the scroll width
 * (`catalogTableTrackWidths` — RAC's `TableColumnLayout` rounds to whole px
 * and reads a selection · drag Column as `1fr`), and a row is its cells plus the Row's own border ·
 * padding (`rowEdge` — RAC sizes a row by its measured cells, so a Row's bottom divider fell
 * outside its pitch: 40 a row, the Canvas's 41). A resizable Table keeps RAC's widths (its
 * `ResizableTableContainer` gives them — the Preview's own operation).
 */
class CatalogTableLayout extends TableLayout<unknown> {
  private rowEdge = { top: 0, bottom: 0 };
  private rowsInView?: TableInput["rowsInView"];
  /** ADR-315 Phase 4 — the pinned columns' RAC keys (`TableInput.pinnedStart` · `pinnedEnd`). */
  private pinned = new Set<string>();
  private pinnedAtEnd = false;
  /**
   * The last measured row's cell height — the next estimate (`CatalogListLayout`'s rule, for a
   * Table). A windowed Table's rows outside its window are never measured: at the first estimate
   * (41 a row where the drawn rows measured 43 — live, 2026-11-19) each window move put the rows
   * it left back at the estimate, so every row after them moved and RAC laid them all out again
   * (10,000 rows: 2.5 s of a 600 frame scroll), and the scroll height changed as it scrolled.
   */
  private measured: number | undefined;
  /** The rows measured since the last layout: each one's tallest cell. */
  private readonly measuredRows = new Map<unknown, number>();
  override updateItemSize(
    ...args: Parameters<TableLayout<unknown>["updateItemSize"]>
  ): boolean {
    const [key, size] = args;
    const info = this.getLayoutInfo(key);
    if (this.rowSize == null && info?.type === "cell" && size.height > 0)
      this.measuredRows.set(
        info.parentKey,
        Math.max(this.measuredRows.get(info.parentKey) ?? 0, size.height),
      );
    return super.updateItemSize(...args);
  }
  /**
   * The estimate from the rows measured since the last layout: a row is as tall as its tallest
   * cell, and the estimate is the rows' median (one tall row — wrapped text — does not set every
   * unmeasured row's height; a row's cells measured one by one do not set it to a short cell's).
   */
  private takeMeasured(): void {
    if (!this.measuredRows.size) return;
    const heights = [...this.measuredRows.values()].sort((a, b) => a - b);
    this.measuredRows.clear();
    this.measured = heights[Math.floor(heights.length / 2)];
  }
  /**
   * A windowed Table (2026-11-19): the rows the `Virtualizer` is about to draw — the rect it asks
   * for, its overscan included — go to the session, which moves the record window over them before
   * the frame paints (`CatalogPreviewSession.showRows`). The rows a focus keeps outside the rect
   * (persisted) are not rows in view.
   */
  override getVisibleLayoutInfos(
    ...args: Parameters<TableLayout<unknown>["getVisibleLayoutInfos"]>
  ): ReturnType<TableLayout<unknown>["getVisibleLayoutInfos"]> {
    const infos = super.getVisibleLayoutInfos(...args);
    const rows = this.rowsInView?.current;
    const rect = args[0];
    if (rows && rect.height > 1) {
      const index = keyIndexOf(rows.keys);
      let first = Infinity;
      let last = -1;
      for (const info of infos) {
        if (info.type !== "row") continue;
        if (info.rect.maxY <= rect.y || info.rect.y >= rect.maxY) continue;
        const at = index.get(String(info.key));
        if (at === undefined) continue;
        if (at < first) first = at;
        if (at > last) last = at;
      }
      if (last >= 0) rows.show(rows.owner, first, last, rows.keys.length);
    }
    return infos;
  }
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
      a.pinnedStart !== b.pinnedStart ||
      a.pinnedEnd !== b.pinnedEnd ||
      super.shouldInvalidateLayoutOptions(next as never, previous as never)
    );
  }
  override update(context: TableContext): void {
    const options = (context.layoutOptions ?? {}) as TableInput;
    this.rowEdge = options.rowEdge ?? { top: 0, bottom: 0 };
    this.rowsInView = options.rowsInView;
    this.pinned = new Set(
      [options.pinnedStart, options.pinnedEnd].flatMap((keys) =>
        keys ? keys.split("\n") : [],
      ),
    );
    this.pinnedAtEnd = !!options.pinnedEnd;
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
    this.takeMeasured();
    const sized = context.layoutOptions as
      { rowSize?: number; rowHeight?: number } | undefined;
    const estimate =
      this.measured !== undefined &&
      sized?.rowSize == null &&
      sized?.rowHeight == null
        ? { estimatedRowSize: this.measured }
        : undefined;
    super.update(
      widths || estimate
        ? ({
            ...context,
            layoutOptions: {
              ...context.layoutOptions,
              ...estimate,
              ...(widths
                ? {
                    columnWidths: new Map(
                      columns.map((column, index) => [
                        column.key,
                        widths[index]!,
                      ]),
                    ),
                  }
                : {}),
            },
          } as TableContext)
        : context,
    );
  }
  /**
   * ADR-315 Phase 4 (Phase 0 S1) — a pinned column's header · cells stay in view: RAC keeps a
   * sticky column's cells out of its column virtualization and draws their wrappers sticky. A cell
   * node's column is `collection.columns[colIndex]`.
   */
  protected override isStickyColumn(
    ...args: Parameters<TableLayout<unknown>["isStickyColumn"]>
  ): boolean {
    if (!this.pinned.size) return super.isStickyColumn(...args);
    const node = args[0] as {
      type: string;
      key: unknown;
      colIndex?: number | null;
      index: number;
    };
    const columns = (
      this.virtualizer?.collection as unknown as
        { columns: { key: unknown }[] } | undefined
    )?.columns;
    const column =
      node.type === "column" ? node : columns?.[node.colIndex ?? node.index];
    return (
      (!!column && this.pinned.has(String(column.key))) ||
      super.isStickyColumn(...args)
    );
  }
  // (RAC draws the header and the body `overflow: hidden`: a sticky box inside would stick to
  //  that box, not to the Table's scroll box — Phase 0 S1.)
  protected override buildTableHeader(
    ...args: Parameters<TableLayout<unknown>["buildTableHeader"]>
  ): ReturnType<TableLayout<unknown>["buildTableHeader"]> {
    const header = super.buildTableHeader(...args);
    if (this.pinned.size) header.layoutInfo.allowOverflow = true;
    return header;
  }
  protected override buildRowGroup(
    ...args: Parameters<TableLayout<unknown>["buildRowGroup"]>
  ): ReturnType<TableLayout<unknown>["buildRowGroup"]> {
    const group = super.buildRowGroup(...args);
    if (this.pinned.size) group.layoutInfo.allowOverflow = true;
    return group;
  }
  protected override getEstimatedRowHeight(): number {
    return (
      super.getEstimatedRowHeight() + this.rowEdge.top + this.rowEdge.bottom
    );
  }
  protected override buildRow(
    ...args: Parameters<TableLayout<unknown>["buildRow"]>
  ): RowNode {
    // (ADR-315 Phase 4 — a column pinned at the end: its cell is built though it is past the
    //  columns in view — RAC stops at the first cell past `requestedRect`. The cells drawn are
    //  still the ones in view and the pinned ones, Phase 0 S1.)
    let node: RowNode;
    if (this.pinnedAtEnd) {
      const requested = this.requestedRect;
      this.requestedRect = requested.copy();
      this.requestedRect.width = Number.MAX_SAFE_INTEGER;
      try {
        node = super.buildRow(...args);
      } finally {
        this.requestedRect = requested;
      }
      node.validRect = node.layoutInfo.rect.intersection(requested);
    } else node = super.buildRow(...args);
    // (A windowed Table's row outside its record window has no cells — `catalogWindowRowPending`:
    //  RAC sizes a row by its cells, so it is given a row's height.)
    if (!node.children?.length) {
      node.layoutInfo.rect.height = super.getEstimatedRowHeight();
      node.validRect = node.layoutInfo.rect.intersection(this.requestedRect);
    }
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
export default function CatalogVirtualizer(
  props: VirtualizerProps,
): ReactElement {
  return props.readers.typeOf(props.record) === "Table"
    ? createElement(CatalogVirtualTable, props)
    : virtualized(props);
}

type VirtualizerProps = {
  root: CatalogCompositionRoot;
  record: CatalogConsumerNode;
  readers: CatalogVirtualListReaders;
  element: ReactElement;
  /** A windowed Table's rows in view go here (`CatalogDomRuntime.showRows`). */
  showRows?: RowsInView["show"];
};

/**
 * A Table's selection · drag columns follow the device as the DOM's grid does (S2 40 · 52, 16 · 20;
 * the Canvas's tracks hold the desktop px) — only a Table reads the device (a hook).
 */
function CatalogVirtualTable(props: VirtualizerProps): ReactElement {
  // (The windowed body's keys — read each render, held for the `Layout`.)
  const rowsInView = useRef<RowsInView | undefined>(undefined);
  const window = props.record.children
    .map((id) => props.root.domInputs.get(id)?.rowWindow)
    .find((found) => !!found);
  rowsInView.current =
    window && props.showRows
      ? { keys: window.keys, owner: window.owner, show: props.showRows }
      : undefined;
  return virtualized(props, props.readers.deviceColumns(), rowsInView);
}

/**
 * ADR-315 Phase 4 — a Table record's pinned columns by RAC key (`catalogTableColumnKey`), a side
 * each joined by `\n` (a text: the `Layout` compares its options by value) — the header's Columns
 * its column projection marked (`CATALOG_COLUMN_PINNED_PROP`).
 */
function catalogTablePinnedKeys(
  root: VirtualizerProps["root"],
  table: VirtualizerProps["record"],
): Pick<TableInput, "pinnedStart" | "pinnedEnd"> {
  const sides: Record<"start" | "end", string[]> = { start: [], end: [] };
  for (const headerId of table.children) {
    const header = root.domInputs.get(headerId);
    if (header?.ruleId !== "TableHeader") continue;
    for (const columnId of header.children) {
      const column = root.domInputs.get(columnId);
      const side = column?.props[CATALOG_COLUMN_PINNED_PROP];
      if (column && (side === "start" || side === "end"))
        sides[side].push(
          catalogTableColumnKey({
            id: column.id,
            ...(column.htmlId ? { htmlId: column.htmlId } : {}),
          }),
        );
    }
  }
  return {
    ...(sides.start.length ? { pinnedStart: sides.start.join("\n") } : {}),
    ...(sides.end.length ? { pinnedEnd: sides.end.join("\n") } : {}),
  };
}

function virtualized(
  { root, record, readers, element: drawn }: VirtualizerProps,
  device?: CatalogTableDeviceColumns,
  rowsInView?: { current: RowsInView | undefined },
): ReactElement {
  let element = drawn;
  const layout = catalogVirtualListLayout(root, record, readers, device);
  // (A windowed Table reads how it is drawn — `CatalogRowWindowMode`.)
  if ("refused" in layout)
    return createElement(
      CatalogRowWindowMode.Provider,
      { value: "refused" },
      element,
    );
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
  return createElement(
    CatalogRowWindowMode.Provider,
    { value: "virtual" },
    createElement(Virtualizer, {
      layout: layout.kind === "table" ? CatalogTableLayout : CatalogListLayout,
      layoutOptions:
        layout.kind === "table"
          ? {
              ...layout.options,
              ...(rowsInView ? { rowsInView } : {}),
              ...catalogTablePinnedKeys(root, record),
            }
          : layout.options,
      children: element,
    } as never),
  );
}
