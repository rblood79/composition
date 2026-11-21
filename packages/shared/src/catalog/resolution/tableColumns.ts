/**
 * ADR-315 Phase 4 — a Table's column projection (breakdown §5.3 · §4.5): which of its authored
 * Columns show and in what order — [pinned at the start · the rest in `columnOrder` · pinned at
 * the end] without the hidden ones — applied to the resolved Table in one place: its header's
 * Columns and every Row's Cells move together, so the header, the rows and the track list
 * (`tableTracks.ts` reads the records) read one column list. The Canvas resolves the authored
 * defaults (a Column's `defaultHidden` · `defaultPinned`) and the Preview · Publish a Table state over them
 * (HC8 · HC9) — the same function.
 *
 * RAC's invariants (ADR 본문 F7) are kept here:
 *  - a row's cells are its columns (the spans' sum): columns a spanning Cell covers are one group —
 *    hidden, moved and pinned together (ADR-257 본문 :21 at run time), and a Table whose rows do
 *    not line up with its header is left as it is;
 *  - a Table shows a row header column: when every one would hide, the last stays.
 *
 * The Table's authored columns are written on its record (`CATALOG_TABLE_COLUMNS_PROP` — a JSON
 * text, so the same columns are the same value to a record comparison): the session names a
 * hidden Column by them, and each Column record carries its authored place
 * (`CATALOG_COLUMN_PLACE_PROP` — a Column without a name is `column3` wherever it is drawn).
 */
import {
  CATALOG_COLUMN_PLACE_PROP,
  resolveTableColumnKey,
} from "../../collections/resolveCollectionItems";
import type { ViewQuery } from "../document/types";

import {
  CATALOG_COLUMN_HIDDEN_PROP,
  CATALOG_COLUMN_MENU_PROP,
  CATALOG_COLUMN_PINNED_EDGE_PROP,
  CATALOG_COLUMN_PINNED_PROP,
  CATALOG_TABLE_PINNED_COLUMNS_PROP,
} from "../runtime/tableTracks";
import {
  CATALOG_CELL_COLUMN_PROP,
  CATALOG_CELL_LINE_PROP,
  CATALOG_CELL_MERGED_PROP,
  CATALOG_ROW_CELL_LINES_PROP,
  CATALOG_ROW_MERGE_DOWN_PROP,
  CATALOG_ROW_MERGE_UP_PROP,
} from "../runtime/tableCellMerge";

export {
  CATALOG_COLUMN_HIDDEN_PROP,
  CATALOG_COLUMN_MENU_PROP,
  CATALOG_COLUMN_PINNED_EDGE_PROP,
  CATALOG_COLUMN_PINNED_PROP,
  CATALOG_COLUMN_PLACE_PROP,
};

/** A Table record's authored data columns (a JSON text of `CatalogTableColumnEntry[]`). */
export const CATALOG_TABLE_COLUMNS_PROP = "_tableColumns";
/**
 * A pinned Column · Cell record's place among its side's pinned columns — from the Table's start
 * edge for `start` (0 = the first column), from its end edge for `end` (0 = the last): the DOM
 * keeps it in view at the widths of the pinned columns before it (`--table-pin-start-<n>` ·
 * `--table-pin-end-<n>`, `catalogTablePinnedStyle`).
 */
export const CATALOG_COLUMN_PINNED_AT_PROP = "_pinnedAt";

/**
 * The Column props the projection reads: an edit of one changes the Table's header and rows, not
 * the Column's own record alone (`compositionRoot.touchesTableRows` — the structure path).
 */
export const CATALOG_COLUMN_PROJECTION_PROPS: ReadonlySet<string> = new Set([
  "defaultHidden",
  "defaultPinned",
  "isRowHeader",
  // (ADR-315 Phase 5 — the grouping stands its Columns first · a group row's aggregate cells.)
  "defaultGrouped",
  "aggregate",
]);

/**
 * The Table switches that give each of its data Columns a menu item (breakdown §6 「Columns」 —
 * 「Reorder columns」: move left · right). An edit of one resolves its Columns again
 * (`compositionRoot`).
 */
export const CATALOG_TABLE_COLUMN_MENU_SWITCHES: readonly string[] = [
  "allowsColumnReordering",
];
/**
 * Whether a data Column has a menu: S2 `isMenu = allowsResizing || menuItems` — here the menu's
 * items are the operations the author allowed (the Column's resize · hide · pin · filter, its
 * Table's reorder). Sorting alone gives no menu (a press sorts — S2's `ColumnWithMenu` is not a sortable
 * column's); a column with a menu sorts from it. The selection column never has one.
 */
export function catalogColumnHasMenu(
  column: Readonly<Record<string, unknown>>,
  table: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return (
    column.allowsResizing === true ||
    column.allowsHiding === true ||
    column.allowsPinning === true ||
    column.allowsFiltering === true ||
    column.allowsGrouping === true ||
    CATALOG_TABLE_COLUMN_MENU_SWITCHES.some((key) => table?.[key] === true)
  );
}

/** One authored data column of a Table (the selection column is none of them). */
export interface CatalogTableColumnEntry {
  /** The Column key (`resolveTableColumnKey` at its authored place). */
  readonly key: string;
  /**
   * Its place among the header's authored Columns (`CATALOG_COLUMN_PLACE_PROP` on its record):
   * a drawn Column is matched by it — its key · sort options are read from its record as they are
   * now (a Column's value edit does not write this list again).
   */
  readonly place: number;
  /** ADR-315 Phase 4 — its header text (`children`) — what a column chooser lists it by. */
  readonly label?: string;
  /** RAC `isRowHeader` among the authored columns (`catalogTableColumnRoles`' rule). */
  readonly rowHeader?: true;
  /** The author hid it (`defaultHidden`) — the default a Table state's `hiddenColumns` replaces. */
  readonly hidden?: true;
  /** The author pinned it (`defaultPinned`) — the default a Table state's `pinnedColumns` replaces. */
  readonly pinned?: "start" | "end";
  /** The Column's sort options · its part in the search (the session reads them of a hidden one). */
  readonly sortFirstDirection?: "descending";
  readonly sortEmptyValues?: "first";
  readonly allowsSearching?: false;
  /** ADR-315 Phase 5 — the author groups by it (`defaultGrouped`) · its group rows' aggregate. */
  readonly grouped?: true;
  readonly aggregate?: string;
}

/** What of a Table state the projection reads (absent = the authored defaults). */
export interface CatalogTableColumnState {
  /**
   * ADR-315 Phase 5 — the grouping the rows are in (the resolver's — the state's or the author's):
   * its Columns stand first among the unpinned ones (TanStack `reorder`).
   */
  readonly grouping?: readonly string[];
  /**
   * ADR-315 Phase 5 증분 5d — the rows are a tree (their binding names child rows): the first data
   * Column in authored order that is shown holds the rows' expand button (RAC `treeColumn` — a
   * Column key, so it moves with its Column), unless a grouping's does.
   */
  readonly nested?: boolean;
  /** ADR-315 Phase 5 증분 5e — the rows hold detail rows (`ColumnsNode.rowDetail`). */
  readonly detail?: boolean;
  readonly hiddenColumns?: readonly string[];
  readonly columnOrder?: readonly string[];
  readonly pinnedColumns?: {
    readonly start: readonly string[];
    readonly end: readonly string[];
  };
}

interface ColumnsNode<T> {
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly T[];
  readonly rowKept?: boolean;
  /** ADR-315 Phase 5 증분 5e — a data row's detail row (its one cell spans the columns drawn). */
  readonly rowDetail?: boolean;
}

const spanOf = (props: Readonly<Record<string, unknown>>): number => {
  const span = props.colSpan;
  return typeof span === "number" && Number.isInteger(span) && span >= 1
    ? span
    : 1;
};

/** The columns a Table record names (`CATALOG_TABLE_COLUMNS_PROP`); none = not written. */
export function catalogTableColumnEntries(
  props: Readonly<Record<string, unknown>> | undefined,
): readonly CatalogTableColumnEntry[] | undefined {
  const text = props?.[CATALOG_TABLE_COLUMNS_PROP];
  if (typeof text !== "string") return undefined;
  let held = PARSED.get(text);
  if (!held) {
    try {
      held = JSON.parse(text) as readonly CatalogTableColumnEntry[];
    } catch {
      return undefined;
    }
    if (PARSED.size > 64) PARSED.clear();
    PARSED.set(text, held);
  }
  return held;
}
const PARSED = new Map<string, readonly CatalogTableColumnEntry[]>();

/**
 * ADR-315 Phase 4 증분 6 — a bound Table record's authored sort: the sort its rows are in before
 * any Table state (its view's literal sort, each field as its key — the Column key of a Column
 * that shows the field). A JSON text of `{ column, direction }[]`, so the same sort is the same
 * value to a record comparison. The header shows it (Canvas · Preview) until a Table state's sort
 * stands in for it (breakdown §4.2).
 */
export const CATALOG_TABLE_AUTHORED_SORT_PROP = "_authoredSort";
/**
 * ADR-315 Phase 5 — a grouped Table record's open group rows (their row keys, a JSON text — RAC
 * `expandedKeys`) and the header Column its rows expand from (RAC `treeColumn` — the outer grouped
 * Column, `true` on that Column's record). The resolver's, never authored.
 */
export const CATALOG_TABLE_EXPANDED_PROP = "_expandedKeys";
export const CATALOG_TREE_COLUMN_PROP = "_treeColumn";
/** A Table record's open group rows (`CATALOG_TABLE_EXPANDED_PROP`); undefined = not grouped. */
export function catalogTableExpandedKeys(
  props: Readonly<Record<string, unknown>> | undefined,
): readonly string[] | undefined {
  const text = props?.[CATALOG_TABLE_EXPANDED_PROP];
  if (typeof text !== "string") return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value.map(String) : undefined;
  } catch {
    return undefined;
  }
}

/** One entry of a Table's authored sort (`CATALOG_TABLE_AUTHORED_SORT_PROP`) — a Column key. */
export interface CatalogTableAuthoredSortItem {
  readonly column: string;
  readonly direction: "ascending" | "descending";
}

/**
 * The sort a binding's views leave its rows in, by field key (the text
 * `CATALOG_TABLE_AUTHORED_SORT_PROP` holds); undefined = none to show. The last view that sorts
 * decides the order, unless a view after it groups the rows; a sort by a variable is the
 * variable's (ADR-284 Decision 5 — not this). An entry whose field is not one of the collection's
 * own (a reference path · a missing field) ends the list: a header cannot show what follows it.
 */
export function catalogViewAuthoredSort(
  views: readonly ViewQuery[] | undefined,
  schema: readonly { readonly id?: string; readonly key?: string }[],
): string | undefined {
  if (!views?.length) return undefined;
  let at = -1;
  for (let index = views.length - 1; index >= 0; index -= 1)
    if (views[index]!.sort?.length) {
      at = index;
      break;
    }
  if (at < 0 || views.slice(at + 1).some((view) => view.groupBy?.length))
    return undefined;
  const sort = views[at]!.sort!;
  if (views[at]!.groupBy?.length || sort.some((entry) => "variableId" in entry))
    return undefined;
  const bare = (id: string) =>
    id.startsWith("data:field:") ? id.slice("data:field:".length) : id;
  const out: CatalogTableAuthoredSortItem[] = [];
  for (const entry of sort) {
    if (!("field" in entry) || entry.field.length !== 1) break;
    const id = bare(String(entry.field[0]));
    const key = schema.find((field) => field.id && bare(field.id) === id)?.key;
    if (!key) break;
    out.push({ column: key, direction: entry.direction });
  }
  return out.length ? JSON.stringify(out) : undefined;
}

/** A Table record's authored sort (`CATALOG_TABLE_AUTHORED_SORT_PROP`); undefined = none. */
export function catalogTableAuthoredSort(
  props: Readonly<Record<string, unknown>> | undefined,
): readonly CatalogTableAuthoredSortItem[] | undefined {
  const text = props?.[CATALOG_TABLE_AUTHORED_SORT_PROP];
  if (typeof text !== "string") return undefined;
  let held = PARSED_SORT.get(text);
  if (!held) {
    try {
      held = JSON.parse(text) as readonly CatalogTableAuthoredSortItem[];
    } catch {
      return undefined;
    }
    if (PARSED_SORT.size > 64) PARSED_SORT.clear();
    PARSED_SORT.set(text, held);
  }
  return held.length ? held : undefined;
}
const PARSED_SORT = new Map<string, readonly CatalogTableAuthoredSortItem[]>();

/**
 * The columns hidden · pinned now: the state's lists, else the authored defaults (a state slice,
 * once written, is the whole list — an authored hidden Column shows by leaving it out).
 */
export function catalogTableColumnsNow(
  entries: readonly CatalogTableColumnEntry[],
  state: CatalogTableColumnState | undefined,
): {
  hidden: readonly string[];
  pinned: { start: readonly string[]; end: readonly string[] };
} {
  return {
    hidden:
      state?.hiddenColumns ??
      entries.filter((entry) => entry.hidden).map((entry) => entry.key),
    pinned: state?.pinnedColumns ?? {
      start: entries
        .filter((entry) => entry.pinned === "start")
        .map((entry) => entry.key),
      end: entries
        .filter((entry) => entry.pinned === "end")
        .map((entry) => entry.key),
    },
  };
}

/**
 * A resolved Table with its columns projected (the file's head). `typeOf` names a node's type;
 * the same node comes back when it is no Table with a header.
 *
 * A composite instance and its template root are one record to the consumers (the root is the
 * instance's first child, of the same type): a Column · Row · Cell is read and written at its
 * innermost layer, and a prop written on it is written on every layer.
 */
export function catalogProjectTableColumns<T extends ColumnsNode<T>>(
  table: T,
  typeOf: (node: T) => string,
  state?: CatalogTableColumnState,
  /**
   * The hidden columns stay in the tree, after the shown ones, marked
   * (`CATALOG_COLUMN_HIDDEN_PROP`) — the Builder's Canvas. Else they are left out (the Preview ·
   * Publish: RAC's collection is the columns shown).
   */
  keepHidden = false,
): T {
  /**
   * A node's layers: itself, then its collapsed template roots (each the first child of the one
   * before, of the same type) — one record to the consumers (`compositionRoot.collapseLayers`).
   */
  const layersOf = (node: T): T[] => {
    const layers = [node];
    for (;;) {
      const current = layers[layers.length - 1]!;
      const first = current.children[0];
      // (A kept row's place holder has no type of its own — `keptRowOf`.)
      if (!first || first.rowKept || typeOf(first) !== typeOf(current))
        return layers;
      layers.push(first);
    }
  };
  /** The innermost layer — the record's props are its. */
  const inner = (node: T): T => layersOf(node).at(-1)!;
  /** The record's children: the innermost layer's, then each outer layer's own (`collapsedChildren`). */
  const kidsOf = (node: T): readonly T[] => {
    const layers = layersOf(node);
    if (layers.length === 1) return node.children;
    return [
      ...layers[layers.length - 1]!.children,
      ...layers
        .slice(0, -1)
        .reverse()
        .flatMap((layer) => layer.children.slice(1)),
    ];
  };
  /**
   * `node` with `props` on every layer and, when `children` is given, the record's children
   * replaced: they go to the outermost layer, after its template root — the same list to
   * `collapsedChildren`, whatever layer each came from.
   */
  const rebuilt = (
    node: T,
    props: Readonly<Record<string, unknown>> | undefined,
    children?: (held: readonly T[]) => readonly T[],
  ): T => {
    const layers = layersOf(node);
    const next = children?.(kidsOf(node));
    let built: T | undefined;
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const layer = layers[index]!;
      const rest = next
        ? index === 0
          ? next
          : []
        : index === layers.length - 1
          ? layer.children
          : layer.children.slice(1);
      built = {
        ...layer,
        ...(props ? { props: { ...layer.props, ...props } } : {}),
        children: built ? [built, ...rest] : rest,
      };
    }
    return built!;
  };
  const tableKids = kidsOf(table);
  const header = tableKids.find((child) => typeOf(child) === "TableHeader");
  if (!header) return table;
  const columns = kidsOf(header);
  if (!columns.length || columns.some((child) => typeOf(child) !== "Column"))
    return table;
  const propsOf = (node: T) => inner(node).props;
  const selection = columns.map((column) =>
    kidsOf(column).some(
      (part) =>
        typeOf(part) === "Checkbox" &&
        (part.props.slot === "selection" ||
          inner(part).props.slot === "selection"),
    ),
  );
  const keys = columns.map((column, index) =>
    resolveTableColumnKey(propsOf(column), index),
  );
  // (The row header rule of `catalogTableColumnRoles`, over the authored columns.)
  const authoredHeader = columns.some(
    (column) => propsOf(column).isRowHeader === true,
  );
  const named = columns.filter((_, index) => !selection[index]);
  const firstNamed = authoredHeader
    ? undefined
    : (named.find((column) => propsOf(column).isRowHeader !== false) ??
      named[0] ??
      columns[0]);
  const rowHeader = columns.map((column) =>
    authoredHeader
      ? propsOf(column).isRowHeader === true
      : column === firstNamed,
  );
  const entries: CatalogTableColumnEntry[] = [];
  columns.forEach((column, index) => {
    if (selection[index]) return;
    const props = propsOf(column);
    const pinned = props.defaultPinned;
    const label = props.children;
    entries.push({
      key: keys[index]!,
      place: index,
      ...(typeof label === "string" && label !== "" ? { label } : {}),
      ...(rowHeader[index] ? { rowHeader: true as const } : {}),
      ...(props.defaultHidden === true ? { hidden: true as const } : {}),
      ...(pinned === "start" || pinned === "end" ? { pinned } : {}),
      ...(props.sortFirstDirection === "descending"
        ? { sortFirstDirection: "descending" as const }
        : {}),
      ...(props.sortEmptyValues === "first"
        ? { sortEmptyValues: "first" as const }
        : {}),
      ...(props.allowsSearching === false
        ? { allowsSearching: false as const }
        : {}),
      ...(props.defaultGrouped === true ? { grouped: true as const } : {}),
      ...(typeof props.aggregate === "string" && props.aggregate !== "none"
        ? { aggregate: props.aggregate }
        : {}),
    });
  });
  const now = catalogTableColumnsNow(entries, state);
  const pinSide = new Map<string, "start" | "end">();
  for (const key of now.pinned.end) pinSide.set(key, "end");
  for (const key of now.pinned.start) pinSide.set(key, "start");

  // The rows whose cells follow the columns: every body Row's (a kept row has none to move) — and
  // a totals row's (ADR-315 Phase 5 증분 5c — its footer).
  const bodies = tableKids.filter(
    (child) => typeOf(child) === "TableBody" || typeOf(child) === "TableFooter",
  );
  const isRow = (row: T) => !row.rowKept && typeOf(row) === "Row";
  const rows = bodies.flatMap((body) => kidsOf(body).filter(isRow));
  // Columns a spanning Cell covers are one group (union-find over the column places).
  const group = columns.map((_, index) => index);
  const find = (index: number): number => {
    while (group[index] !== index) index = group[index] = group[group[index]!]!;
    return index;
  };
  let aligned = true;
  for (const row of rows) {
    let place = 0;
    for (const cell of kidsOf(row)) {
      if (typeOf(cell) !== "Cell") continue;
      const span = spanOf(propsOf(cell));
      for (
        let step = 1;
        step < span && place + step < columns.length;
        step += 1
      )
        group[find(place + step)] = find(place);
      place += span;
    }
    if (place !== columns.length) aligned = false;
  }
  const hidden = new Set(now.hidden);
  // (A row header column stays: the last one, when every one would hide.)
  const headers = entries.filter((entry) => entry.rowHeader);
  if (headers.length && headers.every((entry) => hidden.has(entry.key)))
    hidden.delete(headers.at(-1)!.key);
  // (ADR-315 Phase 5 — TanStack's `groupedColumnMode: 'reorder'`: the grouped Columns stand first
  //  among the unpinned ones, in grouping order — the outer one holds the rows' expand button.)
  //  (The grouping its rows are in — the resolver's: a Table its rows are not grouped in has none.)
  const grouping = state?.grouping ?? [];
  const treeKey =
    grouping[0] ??
    (state?.nested
      ? keys.find((key, place) => !selection[place] && !hidden.has(key))
      : undefined);
  const order = [
    ...grouping,
    ...(state?.columnOrder ?? []).filter((key) => !grouping.includes(key)),
  ];
  interface Group {
    members: number[];
    locked: boolean;
    hidden: boolean;
    side?: "start" | "end";
    at: number;
    pinnedAt: number;
  }
  const groups = new Map<number, Group>();
  columns.forEach((_, index) => {
    const root = find(index);
    let entry = groups.get(root);
    if (!entry)
      groups.set(
        root,
        (entry = {
          members: [],
          locked: false,
          hidden: false,
          at: Infinity,
          pinnedAt: Infinity,
        }),
      );
    entry.members.push(index);
    const key = keys[index]!;
    if (selection[index]) entry.locked = true;
    else {
      if (hidden.has(key)) entry.hidden = true;
      const side = pinSide.get(key);
      if (side && entry.side !== "start") entry.side = side;
      const at = order.indexOf(key);
      if (at >= 0 && at < entry.at) entry.at = at;
      const pinnedAt = side
        ? (side === "end" ? now.pinned.end : now.pinned.start).indexOf(key)
        : -1;
      if (pinnedAt >= 0 && pinnedAt < entry.pinnedAt) entry.pinnedAt = pinnedAt;
    }
  });
  const all = [...groups.values()];
  const byPlace = (a: Group, b: Group) => a.members[0]! - b.members[0]!;
  // (A group with the selection column is never hidden · moved: it leads, where it stands.)
  const locked = all.filter((entry) => entry.locked).sort(byPlace);
  const free = all.filter((entry) => !entry.locked && !entry.hidden);
  const start = free
    .filter((entry) => entry.side === "start")
    .sort((a, b) => a.pinnedAt - b.pinnedAt || byPlace(a, b));
  const end = free
    .filter((entry) => entry.side === "end")
    .sort((a, b) => a.pinnedAt - b.pinnedAt || byPlace(a, b));
  const centre = free
    .filter((entry) => !entry.side)
    .sort((a, b) => a.at - b.at || byPlace(a, b));
  const kept = keepHidden
    ? all.filter((entry) => !entry.locked && entry.hidden).sort(byPlace)
    : [];
  const shown = [...locked, ...start, ...centre, ...end, ...kept];
  const places = shown.flatMap((entry) => entry.members);
  const keptPlaces = new Set(kept.flatMap((entry) => entry.members));
  const moved =
    aligned &&
    (places.length !== columns.length ||
      places.some((place, index) => place !== index));
  // (The columns pinned at a side and each one's place from that edge. With a column pinned at the
  //  start the selection column before it stays in view too — it leads the start side.)
  const sideOf = new Map<number, "start" | "end">();
  const sideAt = new Map<number, number>();
  const edges = new Set<number>();
  if (aligned) {
    const leading = start.length ? [...locked, ...start] : [];
    leading
      .flatMap((entry) => entry.members)
      .forEach((member, at) => {
        sideOf.set(member, "start");
        sideAt.set(member, at);
      });
    end
      .flatMap((entry) => entry.members)
      .reverse()
      .forEach((member, at) => {
        sideOf.set(member, "end");
        sideAt.set(member, at);
      });
    const lastStart = leading.at(-1)?.members.at(-1);
    const firstEnd = end[0]?.members[0];
    if (lastStart !== undefined) edges.add(lastStart);
    if (firstEnd !== undefined) edges.add(firstEnd);
  }
  const pinProps = (place: number) =>
    sideOf.has(place)
      ? {
          [CATALOG_COLUMN_PINNED_PROP]: sideOf.get(place)!,
          [CATALOG_COLUMN_PINNED_AT_PROP]: sideAt.get(place)!,
          ...(edges.has(place)
            ? { [CATALOG_COLUMN_PINNED_EDGE_PROP]: true }
            : {}),
        }
      : undefined;

  const nextHeader = rebuilt(header, undefined, () =>
    (moved ? places : columns.map((_, index) => index)).map((place) =>
      rebuilt(columns[place]!, {
        [CATALOG_COLUMN_PLACE_PROP]: place,
        // (ADR-315 Phase 5 — the outer grouped Column (a tree's first shown Column — 5d): RAC's
        //  `treeColumn`, its cells hold the rows' expand button.)
        ...(!selection[place] &&
        treeKey !== undefined &&
        keys[place] === treeKey
          ? { [CATALOG_TREE_COLUMN_PROP]: true }
          : {}),
        ...pinProps(place),
        ...(aligned && keptPlaces.has(place)
          ? { [CATALOG_COLUMN_HIDDEN_PROP]: true }
          : {}),
      }),
    ),
  );
  // (ADR-315 Phase 5 증분 5e — a detail row's one cell spans every column drawn: the shown ones,
  //  but the selection column of a Table not selecting with checkboxes — `catalogTableRowTracks`.)
  const tableProps = propsOf(table);
  const checkboxes =
    (tableProps.selectionMode === "single" ||
      tableProps.selectionMode === "multiple") &&
    tableProps.selectionStyle !== "highlight";
  const drawnPlaces = aligned
    ? places.filter((place) => !keptPlaces.has(place))
    : columns.map((_, index) => index);
  const drawnCount = Math.max(
    1,
    drawnPlaces.filter((place) => checkboxes || !selection[place]).length,
  );
  const detailRow = (row: T): T =>
    rebuilt(row, undefined, (held) => {
      let first = true;
      return held.map((cell) => {
        if (!first || typeOf(cell) !== "Cell") return cell;
        first = false;
        return rebuilt(cell, { colSpan: drawnCount });
      });
    });
  // (ADR-315 Phase 6 — a Column's same values run together: the rows say in which Columns
  //  (`CATALOG_ROW_MERGE_UP_PROP` · `…DOWN…`, by key); each body Row's line is then its Cells'.)
  const merging = columns.some(
    (column, place) =>
      !selection[place] && propsOf(column).mergeSameValues === true,
  );
  // (ADR-315 Phase 6 — a Table its viewers select cell ranges in (not rows — 사용자 결정 5): each
  //  body Cell names its Column (`CATALOG_CELL_COLUMN_PROP`), the DOM's range by Column key.)
  const tableOwnProps = propsOf(table);
  const keyed =
    tableOwnProps.allowsCellSelection === true &&
    tableOwnProps.selectionMode !== "single" &&
    tableOwnProps.selectionMode !== "multiple";
  const keyList = (value: unknown): ReadonlySet<string> =>
    new Set(Array.isArray(value) ? (value as string[]) : []);
  /**
   * A body row with its cells' lines · merge and Column keys, by the Column each starts at
   * (authored places).
   */
  const markedRow = (row: T): T => {
    const props = propsOf(row);
    const up = keyList(props[CATALOG_ROW_MERGE_UP_PROP]);
    const down = keyList(props[CATALOG_ROW_MERGE_DOWN_PROP]);
    return rebuilt(
      row,
      merging ? { [CATALOG_ROW_CELL_LINES_PROP]: true } : undefined,
      (held) => {
        let place = 0;
        return held.map((cell) => {
          if (typeOf(cell) !== "Cell") return cell;
          const span = spanOf(propsOf(cell));
          const column = !selection[place] ? keys[place] : undefined;
          const key = span === 1 ? column : undefined;
          place += span;
          return rebuilt(cell, {
            ...(merging
              ? {
                  [CATALOG_CELL_LINE_PROP]:
                    key !== undefined && down.has(key) ? "none" : "bottom",
                  ...(key !== undefined && up.has(key)
                    ? { [CATALOG_CELL_MERGED_PROP]: true }
                    : {}),
                }
              : {}),
            ...(keyed && column !== undefined
              ? { [CATALOG_CELL_COLUMN_PROP]: column }
              : {}),
          });
        });
      },
    );
  };
  /** A body row as drawn: projected (the columns moved · pinned · hidden), its detail rows spanning. */
  const settleRow = (shown: T, body = true): T => {
    const row = (merging || keyed) && body ? markedRow(shown) : shown;
    return row.rowDetail
      ? detailRow(row)
      : projecting
        ? projectRow(row, body)
        : rebuilt(row, undefined, (held) =>
            held.map((child) =>
              isRow(child) ? settleRow(child, body) : child,
            ),
          );
  };
  const projectRow = (row: T, body: boolean): T =>
    rebuilt(row, undefined, (held) => {
      // (The row's cells by the group of the column place each starts at.)
      const at = new Map<number, T[]>();
      const rest: T[] = [];
      let place = 0;
      for (const cell of held) {
        if (typeOf(cell) !== "Cell") {
          // (ADR-315 Phase 5 — a row's child rows (a group's · a data row's) follow the columns too.)
          rest.push(isRow(cell) ? settleRow(cell, body) : cell);
          continue;
        }
        const root = find(Math.min(place, columns.length - 1));
        // (A Cell over several pinned columns stands at its first one's place — at the end side
        //  its last one's.)
        const span = spanOf(propsOf(cell));
        const side = pinProps(
          sideOf.get(place) === "end" ? place + span - 1 : place,
        );
        const list = at.get(root) ?? [];
        list.push(
          side
            ? rebuilt(cell, side)
            : keptPlaces.has(place)
              ? rebuilt(cell, { [CATALOG_COLUMN_HIDDEN_PROP]: true })
              : cell,
        );
        at.set(root, list);
        place += spanOf(propsOf(cell));
      }
      return [
        ...shown.flatMap((entry) => at.get(find(entry.members[0]!)) ?? []),
        ...rest,
      ];
    });
  const projecting =
    aligned && (moved || sideOf.size > 0 || keptPlaces.size > 0);
  return rebuilt(
    table,
    {
      [CATALOG_TABLE_COLUMNS_PROP]: JSON.stringify(entries),
      ...(sideOf.size ? { [CATALOG_TABLE_PINNED_COLUMNS_PROP]: true } : {}),
    },
    (held) =>
      held.map((child) =>
        child === header
          ? nextHeader
          : (projecting || state?.detail || merging || keyed) &&
              bodies.includes(child)
            ? rebuilt(child, undefined, (bodyRows) =>
                bodyRows.map((row) =>
                  isRow(row)
                    ? // (A footer's totals row keeps its own line — the Table's part value is a
                      //  body Row's.)
                      settleRow(row, typeOf(child) === "TableBody")
                    : row,
                ),
              )
            : child,
      ),
  );
}
