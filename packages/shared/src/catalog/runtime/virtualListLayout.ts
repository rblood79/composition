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
  const grid =
    type === "CardView" || (type === "GridList" && props.layout === "grid");
  const input: CatalogVirtualInput = {
    kind: type === "Table" ? "table" : grid ? "grid" : "list",
    orientation: props.orientation === "horizontal" ? "horizontal" : "vertical",
    rowGap: px(style.rowGap ?? gap),
    columnGap: px(style.columnGap ?? gap),
    padding: {
      top: px(style.paddingTop ?? style.padding),
      right: px(style.paddingRight ?? style.padding),
      bottom: px(style.paddingBottom ?? style.padding),
      left: px(style.paddingLeft ?? style.padding),
    },
    rows: items.map((item) => sizeOf(item.id)).filter((size) => !!size),
    headings: collectHeadings(record, get, typeOf)
      .map((item) => sizeOf(item.id))
      .filter((size) => !!size),
  };
  return catalogVirtualLayout(input);
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

