import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";
import {
  catalogVirtualLayout,
  type CatalogVirtualInput,
  type CatalogVirtualLayout,
  type CatalogVirtualRefusal,
} from "./virtualLayout";
import { catalogVirtualFlow } from "./virtualFlow";
import type { catalogVirtualGridOptions } from "./virtualGrid";
import type { CatalogTableDeviceColumns } from "./tableTrackWidths";

/**
 * ADR-310 Phase 8 — a list's virtual layout read from its drawn records (the Canvas's geometry and
 * engine input — the same in the Preview's root): the Preview's `Virtualizer` and the panel's
 * 「가상 스크롤」 choice read it (no RAC import — the panel's chunk stays small).
 */
const px = (value: unknown): number => {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(number) ? number : 0;
};

/** What the reader needs from the DOM runtime (given — this module stays out of shared chunks). */
export interface CatalogVirtualListReaders {
  readonly typeOf: (node: CatalogConsumerNode) => string;
  readonly itemsOf: (
    group: CatalogConsumerNode,
    get: (id: string) => CatalogConsumerNode | undefined,
    typeOf: (node: CatalogConsumerNode) => string,
  ) => CatalogConsumerNode[];
  /** A grid's `GridLayout` options at a width (`catalogVirtualGridOptions` — the Canvas's). */
  readonly gridOptions: typeof catalogVirtualGridOptions;
  /** A hook: the device's selection · drag column px (a Table's columns that follow the device). */
  readonly deviceColumns: () => CatalogTableDeviceColumns;
}

export function catalogVirtualListLayout(
  root: CatalogCompositionRoot,
  record: CatalogConsumerNode,
  readers: CatalogVirtualListReaders,
): CatalogVirtualLayout | { readonly refused: CatalogVirtualRefusal } {
  const typeOf = readers.typeOf;
  const catalogGroupItems = readers.itemsOf;
  const type = typeOf(record);
  const get = (id: string) => root.domInputs.get(id);
  const style = root.getDrawnLayoutStyle(record.id) ?? {};
  const gap = px(style.gap);
  const items =
    type === "Table"
      ? catalogGroupItems(record, get, typeOf).filter(
          (item) => typeOf(item) === "Row",
        )
      : catalogGroupItems(record, get, typeOf);
  const geometry = root.getGeometry([
    ...items.map((item) => item.id),
    ...collectHeadings(record, get, typeOf).map((item) => item.id),
  ]);
  const sizeOf = (id: string) => {
    const rect = geometry.get(id);
    return rect ? { width: rect.width, height: rect.height } : undefined;
  };
  const props = record.props as Record<string, unknown>;
  if (type === "CardView" || (type === "GridList" && props.layout !== "stack"))
    return props.layout === "waterfall"
      ? { refused: "waterfall" }
      : { kind: "grid", type, props };
  // (A list's direction is its drawn flow — the S2 lists have no `orientation`: a horizontal list
  //  is the author's flex row. A horizontal `ListLayout` measures an item's width in a box of the
  //  estimate, so the items must have one px width there — the Canvas's flex gives a fixed main
  //  size `flex-shrink: 0`.)
  const flow = type === "Table" ? { orientation: "vertical" as const } : catalogVirtualFlow(style);
  if ("refused" in flow) return flow;
  let fixedWidths: number[] | undefined;
  if (flow.orientation === "horizontal") {
    const widths = items.map((item) => {
      const own = root.getDrawnLayoutStyle(item.id) ?? {};
      const width = /^(\d+(?:\.\d+)?)px$/.exec(String(own.width ?? ""));
      const margin = px(own.marginLeft) + px(own.marginRight);
      return width && Number(own.flexShrink) === 0 && !margin
        ? Number(width[1])
        : undefined;
    });
    if (!widths.length || widths.some((width) => width !== widths[0]))
      return { refused: "itemSize" };
    fixedWidths = widths as number[];
  }
  const input: CatalogVirtualInput = {
    kind: type === "Table" ? "table" : "list",
    orientation: flow.orientation,
    rowGap: px(style.rowGap ?? gap),
    columnGap: px(style.columnGap ?? gap),
    padding: {
      top: px(style.paddingTop ?? style.padding),
      right: px(style.paddingRight ?? style.padding),
      bottom: px(style.paddingBottom ?? style.padding),
      left: px(style.paddingLeft ?? style.padding),
    },
    ...(type === "Table" ? tableTrackInput(root, items[0]) : {}),
    // (A horizontal list's items are their px width — the `ListLayout`'s `rowSize`.)
    rows: fixedWidths
      ? fixedWidths.map((width) => ({ width, height: 0 }))
      : items.map((item) => sizeOf(item.id)).filter((size) => !!size),
    headings: collectHeadings(record, get, typeOf)
      .map((item) => sizeOf(item.id))
      .filter((size) => !!size),
  };
  return catalogVirtualLayout(input);
}

/**
 * A Table's column tracks and its Row's edge, read from a body Row's engine input (the Canvas's —
 * the same in the Preview's root): the tracks the grid lays the cells on (`_tableTracks`, with the
 * drag column's), the DOM's device tracks and the border · padding the row adds around them.
 */
function tableTrackInput(
  root: CatalogCompositionRoot,
  row: CatalogConsumerNode | undefined,
): Pick<
  CatalogVirtualInput,
  "columnTracks" | "rowEdge" | "deviceTracks" | "dragColumn"
> {
  if (!row) return {};
  const style = root.getDrawnLayoutStyle(row.id) ?? {};
  const tracks = style.gridTemplateColumns;
  const device = row.derivedProps?._tableDeviceTracks;
  const side = (border: unknown, padding: unknown) =>
    px(border ?? style.border) + px(padding ?? style.padding);
  return {
    ...(Array.isArray(tracks) ? { columnTracks: tracks.map(String) } : {}),
    // (The DOM's tracks follow the device — the selection · drag columns, `catalogDeviceColumnTracks`.)
    ...(typeof device === "string" ? { deviceTracks: device } : {}),
    ...(row.derivedProps?._allowsDragging === true ? { dragColumn: true } : {}),
    rowEdge: {
      top: side(style.borderTop, style.paddingTop),
      bottom: side(style.borderBottom, style.paddingBottom),
    },
  };
}

/** A list's section headers · a Table's header row (the `Layout`'s heading size). */
function collectHeadings(
  record: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const id of node.children) {
      const child = get(id);
      if (!child) continue;
      const type = typeOf(child);
      if (type === "Header" || type === "TableHeader") out.push(child);
      else if (!/Item$|^Row$|^Card$/.test(type)) visit(child);
    }
  };
  visit(record);
  return out;
}

