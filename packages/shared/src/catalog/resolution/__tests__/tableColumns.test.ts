import { describe, expect, it } from "vitest";
import {
  CATALOG_COLUMN_HIDDEN_PROP,
  CATALOG_COLUMN_PINNED_AT_PROP,
  CATALOG_COLUMN_PINNED_EDGE_PROP,
  CATALOG_COLUMN_PLACE_PROP,
  CATALOG_COLUMN_PINNED_PROP,
  catalogProjectTableColumns,
  catalogTableColumnEntries,
  catalogTableColumnsNow,
  type CatalogTableColumnState,
} from "../tableColumns";
import { resolveTableColumnKey } from "../../../collections/resolveCollectionItems";

/**
 * ADR-315 Phase 4 — a Table's column projection, on hand-written trees (breakdown §5.3). The
 * Table: a selection column, then `name` (the row header) · `type` · `status` · a Column without a
 * name (`column5` — its authored place); two rows of cells `<row><column>`.
 */
interface Node {
  type: string;
  props: Record<string, unknown>;
  children: Node[];
  rowKept?: boolean;
}
const node = (
  type: string,
  props: Record<string, unknown> = {},
  children: Node[] = [],
): Node => ({ type, props, children });
const typeOf = (item: Node) => item.type;
const column = (props: Record<string, unknown>, children: Node[] = []) =>
  node("Column", props, children);
const cell = (text: string, props: Record<string, unknown> = {}) =>
  node("Cell", { children: text, ...props });
const selectionBox = () => node("Checkbox", { slot: "selection" });

const table = (
  rows: Node[][] = [
    ["s", "a1", "a2", "a3", "a4"].map((text) => cell(text)),
    ["s", "b1", "b2", "b3", "b4"].map((text) => cell(text)),
  ],
  columns: Node[] = [
    column({}, [selectionBox()]),
    column({ key: "name", isRowHeader: true }),
    column({ key: "type" }),
    column({ key: "status" }),
    column({}),
  ],
): Node =>
  node("Table", { density: "regular" }, [
    node("TableHeader", {}, columns),
    node(
      "TableBody",
      {},
      rows.map((cells) => node("Row", {}, cells)),
    ),
  ]);

const read = (projected: Node) => {
  const header = projected.children[0]!;
  const body = projected.children[1]!;
  return {
    // (The key each drawn Column has at its drawn place — the place written on it decides.)
    keys: header.children.map((item, index) =>
      resolveTableColumnKey(item.props, index),
    ),
    rows: body.children.map((row) =>
      row.children.map((item) => String(item.props.children)),
    ),
  };
};
const project = (state?: CatalogTableColumnState, source = table()) =>
  catalogProjectTableColumns(source, typeOf, state);

describe("a Table's column projection", () => {
  it("writes each Column's authored place, and the Table's data columns", () => {
    const source = table();
    const projected = project(undefined, source);
    expect(read(projected).keys).toEqual([
      "column1",
      "name",
      "type",
      "status",
      "column5",
    ]);
    expect(catalogTableColumnEntries(projected.props)).toEqual([
      { key: "name", place: 1, rowHeader: true },
      { key: "type", place: 2 },
      { key: "status", place: 3 },
      { key: "column5", place: 4 },
    ]);
    // (Nothing hidden · moved: the rows are the ones they were.)
    expect(projected.children[1]).toBe(source.children[1]);
    expect(read(projected).rows[0]).toEqual(["s", "a1", "a2", "a3", "a4"]);
    // (The same columns are the same text — a record comparison sees no change.)
    expect(projected.props._tableColumns).toBe(project().props._tableColumns);
  });

  it("hides a Column from the header and from every Row", () => {
    const projected = project({ hiddenColumns: ["type"] });
    expect(read(projected)).toEqual({
      keys: ["column1", "name", "status", "column5"],
      rows: [
        ["s", "a1", "a3", "a4"],
        ["s", "b1", "b3", "b4"],
      ],
    });
    // (A Column after the hidden one keeps its key: `column5`, not `column4`.)
    expect(read(project({ hiddenColumns: ["status"] })).keys.at(-1)).toBe(
      "column5",
    );
  });

  it("orders the Columns: the listed ones first in that order, the rest as authored", () => {
    expect(read(project({ columnOrder: ["status", "name"] }))).toEqual({
      keys: ["column1", "status", "name", "type", "column5"],
      rows: [
        ["s", "a3", "a1", "a2", "a4"],
        ["s", "b3", "b1", "b2", "b4"],
      ],
    });
  });

  it("puts the pinned Columns at the start · the end, the selection column first", () => {
    const projected = project({
      pinnedColumns: { start: ["status"], end: ["name"] },
      columnOrder: ["column5", "type"],
    });
    expect(read(projected)).toEqual({
      keys: ["column1", "status", "column5", "type", "name"],
      rows: [
        ["s", "a3", "a4", "a2", "a1"],
        ["s", "b3", "b4", "b2", "b1"],
      ],
    });
    // (Each pinned Column · Cell says its side and its place from that edge — the selection
    //  column leads the start side: it stays in view before the pinned ones.)
    const marks = (items: Node[]) =>
      items.map((item) => [
        item.props[CATALOG_COLUMN_PINNED_PROP],
        item.props[CATALOG_COLUMN_PINNED_AT_PROP],
      ]);
    const expected = [
      ["start", 0],
      ["start", 1],
      [undefined, undefined],
      [undefined, undefined],
      ["end", 0],
    ];
    expect(marks(projected.children[0]!.children)).toEqual(expected);
    expect(marks(projected.children[1]!.children[0]!.children)).toEqual(
      expected,
    );
    // (The edge of each side — the start side's last column, the end side's first: the line
    //  between the pinned columns and the ones scrolling under them.)
    const edges = (items: Node[]) =>
      items.map((item) => item.props[CATALOG_COLUMN_PINNED_EDGE_PROP] === true);
    expect(edges(projected.children[0]!.children)).toEqual([
      false,
      true,
      false,
      false,
      true,
    ]);
    expect(edges(projected.children[1]!.children[1]!.children)).toEqual([
      false,
      true,
      false,
      false,
      true,
    ]);
    expect(
      edges(
        project({ pinnedColumns: { start: [], end: ["type", "status"] } })
          .children[0]!.children,
      ),
    ).toEqual([false, false, false, true, false]);
    // (Two columns at the end: the last one is place 0, the one before it 1.)
    expect(
      marks(
        project({ pinnedColumns: { start: [], end: ["type", "status"] } })
          .children[0]!.children,
      ),
    ).toEqual([
      [undefined, undefined],
      [undefined, undefined],
      [undefined, undefined],
      ["end", 1],
      ["end", 0],
    ]);
  });

  it("reads the authored defaults where the state has no slice — and the state replaces them", () => {
    const authored = () =>
      table(undefined, [
        column({}, [selectionBox()]),
        column({ key: "name", isRowHeader: true }),
        column({ key: "type", defaultHidden: true }),
        column({ key: "status", defaultPinned: "start" }),
        column({}),
      ]);
    expect(read(project(undefined, authored())).keys).toEqual([
      "column1",
      "status",
      "name",
      "column5",
    ]);
    // (An empty list shows the authored hidden Column again.)
    expect(read(project({ hiddenColumns: [] }, authored())).keys).toEqual([
      "column1",
      "status",
      "name",
      "type",
      "column5",
    ]);
    const entries = catalogTableColumnEntries(
      project(undefined, authored()).props,
    )!;
    expect(catalogTableColumnsNow(entries, undefined)).toEqual({
      hidden: ["type"],
      pinned: { start: ["status"], end: [] },
    });
    expect(
      catalogTableColumnsNow(entries, { hiddenColumns: ["name"] }).hidden,
    ).toEqual(["name"]);
  });

  it("keeps the hidden Columns as marked records where asked (the Builder's Canvas)", () => {
    const projected = catalogProjectTableColumns(
      table(),
      typeOf,
      { hiddenColumns: ["type"], columnOrder: ["status"] },
      true,
    );
    // (The shown ones in their order, then the hidden one — marked, its Cells with it.)
    expect(read(projected)).toEqual({
      keys: ["column1", "status", "name", "column5", "type"],
      rows: [
        ["s", "a3", "a1", "a4", "a2"],
        ["s", "b3", "b1", "b4", "b2"],
      ],
    });
    const marks = (items: Node[]) =>
      items.map((item) => item.props[CATALOG_COLUMN_HIDDEN_PROP] === true);
    expect(marks(projected.children[0]!.children)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(marks(projected.children[1]!.children[1]!.children)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it("keeps a row header column: the last one when every one would hide", () => {
    const two = () =>
      table(undefined, [
        column({}, [selectionBox()]),
        column({ key: "name", isRowHeader: true }),
        column({ key: "type", isRowHeader: true }),
        column({ key: "status" }),
        column({}),
      ]);
    expect(
      read(project({ hiddenColumns: ["name", "type", "status"] }, two())).keys,
    ).toEqual(["column1", "type", "column5"]);
  });

  it("moves the columns a spanning Cell covers together (ADR-257 본문 :21)", () => {
    // Row 2's second cell covers `type` · `status`.
    const spanned = () =>
      table([
        ["s", "a1", "a2", "a3", "a4"].map((text) => cell(text)),
        [cell("s"), cell("b1"), cell("b23", { colSpan: 2 }), cell("b4")],
      ]);
    // Hiding `type` hides `status` with it.
    expect(read(project({ hiddenColumns: ["type"] }, spanned()))).toEqual({
      keys: ["column1", "name", "column5"],
      rows: [
        ["s", "a1", "a4"],
        ["s", "b1", "b4"],
      ],
    });
    // Ordering `status` first brings `type` with it, in their own order.
    expect(read(project({ columnOrder: ["status"] }, spanned()))).toEqual({
      keys: ["column1", "type", "status", "name", "column5"],
      rows: [
        ["s", "a2", "a3", "a1", "a4"],
        ["s", "b23", "b1", "b4"],
      ],
    });
  });

  it("leaves a Table whose rows do not line up with its header (RAC's own refusal)", () => {
    const short = () =>
      table([
        ["s", "a1", "a2", "a3", "a4"].map((text) => cell(text)),
        ["s", "b1", "b2"].map((text) => cell(text)),
      ]);
    expect(read(project({ hiddenColumns: ["type"] }, short()))).toEqual({
      keys: ["column1", "name", "type", "status", "column5"],
      rows: [
        ["s", "a1", "a2", "a3", "a4"],
        ["s", "b1", "b2"],
      ],
    });
  });

  it("leaves a windowed Table's kept rows as they are — a place holder has no type", () => {
    const kept = (): Node => ({
      type: "",
      props: {},
      children: [],
      rowKept: true,
    });
    const source = table();
    // (Kept rows before and after the rows resolved now — a window move.)
    source.children[1]!.children.unshift(kept());
    source.children[1]!.children.push(kept());
    const projected = catalogProjectTableColumns(
      source,
      (item) => {
        if (item.rowKept) throw new Error("DANGLING_DEFINITION");
        return item.type;
      },
      { hiddenColumns: ["type"] },
    );
    const rows = projected.children[1]!.children;
    expect(rows[0]).toBe(source.children[1]!.children[0]);
    expect(rows[3]).toBe(source.children[1]!.children[3]);
    expect(
      rows[1]!.children.map((item) => String(item.props.children)),
    ).toEqual(["s", "a1", "a3", "a4"]);
  });

  it("reads and writes a composite instance as the one record it is to the consumers", () => {
    // As resolved (2026-11-20, a bound Table): a Column · Cell instance holds its template root,
    // and a Row instance holds its root (no children) and then its own Cells.
    const wrap = (item: Node): Node => node(item.type, {}, [item]);
    const source = node("Table", {}, [
      node("TableHeader", {}, [
        wrap(column({ key: "name", isRowHeader: true })),
        wrap(column({ key: "type" })),
      ]),
      node("TableBody", {}, [
        node("Row", {}, [node("Row"), wrap(cell("a1")), wrap(cell("a2"))]),
      ]),
    ]);
    const projected = project({ columnOrder: ["type", "name"] }, source);
    const header = projected.children[0]!;
    // (The place is on the instance and on its root — the record's props are the root's.)
    expect(
      header.children.map((item) => [
        item.props[CATALOG_COLUMN_PLACE_PROP],
        item.children[0]!.props[CATALOG_COLUMN_PLACE_PROP],
        item.children[0]!.props.key,
      ]),
    ).toEqual([
      [1, 1, "type"],
      [0, 0, "name"],
    ]);
    // (The Row keeps its root first; its Cells follow in the columns' order.)
    const row = projected.children[1]!.children[0]!;
    expect(row.children.map((item) => item.type)).toEqual([
      "Row",
      "Cell",
      "Cell",
    ]);
    expect(
      row.children.slice(1).map((item) => item.children[0]!.props.children),
    ).toEqual(["a2", "a1"]);
    expect(
      catalogTableColumnEntries(projected.props)?.map((entry) => entry.key),
    ).toEqual(["name", "type"]);
  });

  it("is the same node for a node that is no Table with a header", () => {
    const list = node("ListBox", {}, [node("ListBoxItem")]);
    expect(catalogProjectTableColumns(list, typeOf)).toBe(list);
  });
});
