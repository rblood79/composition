import { catalogTableGrouping } from "./tableRowSlices";
import { componentInstancePath } from "./componentBoundaries";
import { catalogBoundRows, dataCollectionIdOf } from "./dataBinding";
import { catalogBindingQuery } from "./viewQuery";
import {
  viewFieldOf,
  viewRunReferences,
  viewRunSchema,
  viewSchemaAt,
} from "../../collections/view/evaluate";
import {
  VIEW_COMPARISONS_BY_KIND,
  viewFieldKind,
} from "../../collections/view/comparison";
import type { CatalogTableSort } from "./tableSort";
import {
  resolveFieldRoles,
  resolveTableColumnKey,
} from "../../collections/resolveCollectionItems";
import { catalogTableColumnKey } from "./tableSort";
import { catalogTableColumnRoles } from "./tableColumnRoles";
import {
  CATALOG_COLUMN_PLACE_PROP,
  catalogTableAuthoredSort,
  catalogTableColumnEntries,
  catalogTableColumnsNow,
  catalogTableExpandedKeys,
} from "../resolution/tableColumns";
import {
  CATALOG_TABLE_COLUMN_SLICES,
  CATALOG_TABLE_DATA_SLICES,
  catalogStoredTableStates,
  catalogStoreTableStates,
  catalogTableStateRead,
  catalogTableStateRemembered,
  catalogTableStateWith,
  type CatalogTableShape,
  type CatalogTableSortItem,
  type CatalogTableState,
} from "./tableState";
import {
  catalogColumnFilterPatch,
  catalogColumnMenuItems,
  catalogColumnDropPatch,
  catalogColumnMenuPatch,
  type CatalogColumnFilterView,
  type CatalogColumnMenuColumn,
  type CatalogColumnMenuItem,
  type CatalogColumnMenuItemId,
  type CatalogColumnMenuTable,
  type CatalogTableFacet,
} from "./tableColumnMenu";
import {
  catalogColumnFilterCondition,
  catalogColumnFilterDraft,
  catalogFilterPicksMany,
} from "./tableColumnFilterDraft";
import {
  CATALOG_FACET_COUNT,
  catalogFieldIdOf,
  catalogRowSlicesView,
  catalogTableFacetQueries,
  catalogTableSliceServable,
  type CatalogTableServedSlice,
} from "./tableStateQuery";
import { CATALOG_NO_TABLE_STATE } from "./tableState";
import { CatalogFilterScopes } from "./filterScopeSession";
import {
  catalogFilterBarFieldOps,
  type CatalogFilterBarAccess,
  type CatalogFilterBarField,
} from "./filterBarAccess";
import { catalogFilterBarFieldList } from "./filterBarFields";
import {
  CATALOG_FILTER_TREE_ID,
  catalogColumnFilterConditionId,
  catalogFilterColumnCondition,
  catalogFilterTreeApplied,
  catalogFilterTreeRead,
  catalogJudgeFilterItems,
} from "./filterScope";
import type {
  DataFieldId,
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
} from "../document/types";
import { CATALOG_NO_VIEW_QUERY } from "./viewQuery";
import type {
  CatalogItemsWrite,
  CatalogItemsWriteSkip,
  CatalogPreviewSession,
} from "./catalogPreviewSession";
import { CATALOG_CELL_COLUMN_PROP } from "./tableCellMerge";

/** ADR-317 — why a Table cell of a several-cell write was not written. */
export type CatalogTableCellsWriteSkip =
  CatalogItemsWriteSkip | "notEditable" | "notDataRow";
/** ADR-317 — a several-cell write's result (`editTableCells`). */
export interface CatalogTableCellsWrite extends Omit<
  CatalogItemsWrite,
  "skipped"
> {
  readonly skipped: Partial<Record<CatalogTableCellsWriteSkip, number>>;
  /**
   * ADR-317 Phase 4 — the rows written (item keys, in write order) and their items now: the
   * Table's 「Cells change」 event (what a save sends).
   */
  readonly keys?: readonly string[];
  readonly items?: readonly unknown[];
}

/** What a Table controller reads and calls of its session (`CatalogPreviewSession.tableHost`). */
export type CatalogTableHost = {
  boundTableRecords: CatalogPreviewSession["boundTableRecords"];
  collectionItems: CatalogPreviewSession["collectionItems"];
  itemsByKeys: CatalogPreviewSession["itemsByKeys"];
  collectionRowService: CatalogPreviewSession["collectionRowService"];
  viewRequestLimits: CatalogPreviewSession["viewRequestLimits"];
  collections: CatalogPreviewSession["collections"];
  currentRoot: CatalogPreviewSession["currentRoot"];
  echoing: CatalogPreviewSession["echoing"];
  filterAddress: CatalogPreviewSession["filterAddress"];
  graph: CatalogPreviewSession["graph"];
  itemSources: CatalogPreviewSession["itemSources"];
  loadArguments: CatalogPreviewSession["loadArguments"];
  loadRouted: CatalogPreviewSession["loadRouted"];
  options: CatalogPreviewSession["options"];
  pageUnit: CatalogPreviewSession["pageUnit"];
  recordRowSlices: CatalogPreviewSession["recordRowSlices"];
  remotePages: CatalogPreviewSession["remotePages"];
  root: CatalogPreviewSession["root"];
  runtimePropsWriter: CatalogPreviewSession["runtimePropsWriter"];
  serverSort: CatalogPreviewSession["serverSort"];
  serverSortedTables: CatalogPreviewSession["serverSortedTables"];
  serverView: CatalogPreviewSession["serverView"];
  serverFacet: CatalogPreviewSession["serverFacet"];
  showPage: CatalogPreviewSession["showPage"];
  sortCollection: CatalogPreviewSession["sortCollection"];
  stageRowWindows: CatalogPreviewSession["stageRowWindows"];
  stateSource: CatalogPreviewSession["stateSource"];
  update: CatalogPreviewSession["update"];
  updateMany: CatalogPreviewSession["updateMany"];
  viewReloadTimer: CatalogPreviewSession["viewReloadTimer"];
};

/**
 * ADR-315 — the Preview session's Tables: each Table record's state (sort · search · column
 * filters · grouping · columns · pinned rows · widths), its writes, the column menus · choosers it
 * serves, and the reads of its rows a slice asks for (`CatalogPreviewSession.tables`). The rows
 * themselves, the endpoints and the view stay the session's (`CatalogTableHost`).
 */
export class CatalogTableController {
  constructor(private readonly host: CatalogTableHost) {
    this.scopes = new CatalogFilterScopes(host, (lists) =>
      this.readScopeLists(lists),
    );
  }

  /**
   * ADR-320 Phase 3 — the filter bars' scopes: a Table among a bar's lists reads the scope's tree
   * as its state's `filters` (`tableState` — one tree, never a copy, HC3).
   */
  readonly scopes: CatalogFilterScopes;

  /** The scope's lists read their rows again: a Table through its state's read, another list's node. */
  private readScopeLists(lists: readonly string[]): void {
    const root = this.host.currentRoot;
    if (!root) return;
    const wanted = new Set(lists);
    const others = new Set<string>();
    let remote = false;
    for (const record of root.domInputs.values()) {
      if (!wanted.has(record.sourceId)) continue;
      if (record.ruleId === "Table")
        this.readTableRows(record.id, this.tableState(record.id), "filtering");
      else {
        others.add(record.sourceId);
        const source = this.host.graph?.getEntry(record.sourceId as never);
        if (
          source?.kind === "node" &&
          source.binding &&
          this.host.collectionRowService(
            dataCollectionIdOf(source.binding.collectionId),
          ).remote
        )
          remote = true;
      }
    }
    if (remote) this.host.loadRouted("filtering");
    if (others.size) {
      const errors = root.refreshNodes(others);
      if (errors.length)
        console.error("[CatalogPreview] filtered lists:", ...errors);
    }
  }

  /**
   * A record's state as its rows read it — a Table among a filter bar's lists with the scope's
   * tree as its `filters` (a list that is not a Table: the tree alone). Undefined = none.
   */
  heldTableState(recordId: string): CatalogTableState | undefined {
    const held = this.tableStates.get(recordId);
    const bar = this.scopes.barOf(
      recordId.slice(recordId.lastIndexOf("::") + 2),
    );
    if (!bar) return held;
    const tree = this.scopes.tree(bar);
    if (tree) return { ...held, filters: tree };
    if (!held?.filters) return held;
    const { filters: _scope, ...rest } = held;
    return rest;
  }

  /**
   * ADR-320 Phase 5 — a record's state as its rows read it: `heldTableState` with the scope tree's
   * relative dates as days (`CatalogFilterScopes.rowTree`). The session's slices and the root's own
   * row reading both take this one; the Column menus read the state as held (the tokens).
   */
  rowTableState(recordId: string): CatalogTableState | undefined {
    const held = this.heldTableState(recordId);
    return held?.filters
      ? { ...held, filters: this.scopes.rowTree(held.filters) }
      : held;
  }

  /** ADR-315 Phase 4 — a column width written by RAC's own resize (`resizeTableColumns`). */
  private resizing = false;

  private widthsRevision = 0;

  /**
   * ADR-315 — each Table record's grid state (runtime, never the document): the one place its
   * slices live (it was `tableSorts`, the sort alone — ADR-257 Phase 4). Columns by Column key.
   */
  readonly tableStates = new Map<string, CatalogTableState>();

  /** Table records whose remembered state was looked up (once a record, a project). */
  readonly restoredTables = new Set<string>();

  /** Each Table record's authored `searchText` the state last took (`startTableSearches`). */
  readonly searchedTables = new Map<string, string>();

  /** A root built · a page filled since the last look (`restoreTableStates`). */
  restoreDue = true;

  /** Restored Tables whose sort RAC has not been told (no rule runtime yet). */
  readonly pendingSortEchoes = new Set<string>();

  /**
   * ADR-315 Phase 4 — the column choosers of each Table node (`columnsOf` — they re-resolve when
   * its columns change) and the columns each last listed (their signature).
   */
  readonly columnChoosers = new Map<string, Set<string>>();

  private readonly chooserColumnsSeen = new Map<string, string>();

  /** The selection each chooser Menu record was last told (an unchanged one is not written). */
  private readonly chooserEchoed = new Map<string, string>();

  /**
   * ADR-315 Phase 5 증분 5g — a Table record's grouping · totals row its server answers (a group
   * query — the endpoint answers a group's rows, `catalogTableSliceServable` `whole`).
   */
  tableServes(tableId: string, slice: "grouping" | "totals"): boolean {
    const service = this.tableService(tableId);
    if (!service.remote) return false;
    if (
      slice === "grouping"
        ? !this.tableGroupedNow(tableId)
        : !this.tableHasTotalsRow(tableId)
    )
      return false;
    return (
      catalogTableSliceServable(service, slice, this.tableAggregates(tableId))
        .accepts === "whole"
    );
  }

  /** A Table record's Columns' aggregates (a group row's · the totals row's). */
  private tableAggregates(tableId: string): string[] {
    return this.tableColumns(tableId).flatMap((column) =>
      column.aggregate ? [column.aggregate] : [],
    );
  }

  /** A Table record has a totals row (a Row in its footer — the 「Totals row」 switch). */
  private tableHasTotalsRow(tableId: string): boolean {
    const root = this.host.currentRoot;
    const table = root?.domInputs.get(tableId);
    return !!table?.children.some((id) => {
      const part = root!.domInputs.get(id);
      return (
        part?.ruleId === "TableFooter" &&
        part.children.some((row) => root!.domInputs.get(row)?.ruleId === "Row")
      );
    });
  }

  /**
   * A Table record's authored data Columns: each one's Column key (what the Table state names —
   * the field it shows) and, for a Column that is drawn, its RAC key (what RAC's sort names —
   * `catalogTableColumnKey`). A hidden Column is among them without a RAC key (ADR-315 Phase 4 —
   * the Table record names every authored column, `catalogTableColumnEntries`): a state still
   * names it, and it is searched · sorted · filtered as before.
   */
  tableColumns(tableId: string): {
    /** `""` = the Column is not drawn (hidden). */
    racKey: string;
    key: string;
    rowHeader: boolean;
    /** ADR-315 Phase 4 — the author's defaults (`defaultHidden` · `defaultPinned`). */
    hidden?: true;
    pinned?: "start" | "end";
    /** ADR-315 Phase 2 — the Column's sort options (`sortFirstDirection` · `sortEmptyValues`). */
    sortFirstDirection: "ascending" | "descending";
    sortEmptyValues?: "first";
    /** ADR-315 Phase 3 — the Column's `allowsSearching` (every Column unless it says no). */
    allowsSearching: boolean;
    /** ADR-315 Phase 5 — the author groups by it · its group rows' aggregate. */
    defaultGrouped?: true;
    aggregate?: string;
  }[] {
    const root = this.host.currentRoot;
    const table = root?.domInputs.get(tableId);
    if (!root || !table) return [];
    const header = table.children
      .map((id) => root.domInputs.get(id))
      .find((record) => record?.ruleId === "TableHeader");
    const columns = (header?.children ?? [])
      .map((id) => root.domInputs.get(id))
      .filter(
        (record): record is NonNullable<typeof record> =>
          record?.ruleId === "Column",
      );
    const roles = catalogTableColumnRoles(columns, (id) => {
      const box = root.domInputs.get(id);
      return box?.ruleId === "Checkbox" && box.props.slot === "selection";
    });
    // (The selection column is not a data column: a state names none. The key's index is the
    //  Column's place among all of them — the resolver's, `tableRowSort`.)
    const drawnAll = columns.map((column, index) => ({
      racKey: catalogTableColumnKey(column),
      key: resolveTableColumnKey(column.props, index),
      rowHeader: roles[index]!.rowHeader,
      selection: roles[index]!.selection,
      sortFirstDirection:
        column.props.sortFirstDirection === "descending"
          ? ("descending" as const)
          : ("ascending" as const),
      ...(column.props.sortEmptyValues === "first"
        ? { sortEmptyValues: "first" as const }
        : {}),
      allowsSearching: column.props.allowsSearching !== false,
      ...(column.props.defaultGrouped === true
        ? { defaultGrouped: true as const }
        : {}),
      ...(typeof column.props.aggregate === "string" &&
      column.props.aggregate !== "none"
        ? { aggregate: column.props.aggregate }
        : {}),
    }));
    const drawn = drawnAll.filter((column) => !column.selection);
    const authored = catalogTableColumnEntries(table.props);
    if (!authored) return drawn;
    // (A drawn Column is the entry of its authored place: its key · options are its record's, as
    //  they are now — the Table's list is written when the Table is resolved, not on a Column's
    //  value edit.)
    const byPlace = new Map(
      columns.flatMap((column, index) => {
        const place = column.props[CATALOG_COLUMN_PLACE_PROP];
        const item = drawnAll[index]!;
        return typeof place === "number" && !item.selection
          ? [[place, item] as const]
          : [];
      }),
    );
    return authored.map((entry) => ({
      ...(byPlace.get(entry.place) ?? {
        racKey: "",
        key: entry.key,
        selection: false,
        sortFirstDirection: entry.sortFirstDirection ?? "ascending",
        ...(entry.sortEmptyValues
          ? { sortEmptyValues: entry.sortEmptyValues }
          : {}),
        allowsSearching: entry.allowsSearching !== false,
        ...(entry.grouped ? { defaultGrouped: true as const } : {}),
        ...(entry.aggregate ? { aggregate: entry.aggregate } : {}),
      }),
      // (The row header among the authored Columns — a drawn Column's own role is among the
      //  drawn ones: with the header Column hidden another one is RAC's.)
      rowHeader: entry.rowHeader === true,
      ...(entry.hidden ? { hidden: true as const } : {}),
      ...(entry.pinned ? { pinned: entry.pinned } : {}),
    }));
  }

  /**
   * ADR-315 Phase 6 — a cell range as text (breakdown §5.6 — Ctrl/Cmd + C): its rows (keys, in the
   * order shown) by its Columns (keys, in the order drawn), tab-separated lines. The values are the
   * rows' data as read last — a virtual Table's rows outside its window too; a row of no data (a
   * detail row) is an empty line.
   */
  tableCellText(
    tableId: string,
    rows: readonly string[],
    columns: readonly string[],
  ): string {
    const values = this.host.root?.rowValuesOf(tableId);
    const text = (value: unknown): string =>
      value === undefined || value === null
        ? ""
        : (typeof value === "object" ? JSON.stringify(value) : String(value))
            // (A tab · a line break in a value would split it into other cells.)
            .replace(/[\t\r\n]+/g, " ");
    return rows
      .map((key) =>
        columns.map((column) => text(values?.get(key)?.[column])).join("\t"),
      )
      .join("\n");
  }

  /**
   * ADR-317 Phase 3 — a cell range's values (what a fill copies): its rows (keys) by its Columns
   * (keys), the rows' data as read last — not text (another type's value is not written).
   */
  tableCellValues(
    tableId: string,
    rows: readonly string[],
    columns: readonly string[],
  ): readonly (readonly unknown[])[] {
    const values = this.host.root?.rowValuesOf(tableId);
    return rows.map((key) =>
      columns.map((column) => values?.get(key)?.[column]),
    );
  }

  /**
   * ADR-315 Phase 4 — a Table record's columns as shown now: the hidden ones and the pinned ones —
   * the state's lists, else the authored defaults (a Column's `defaultHidden` · `defaultPinned`).
   */
  tableColumnsNow(tableId: string): {
    readonly columns: readonly string[];
    readonly hidden: readonly string[];
    readonly pinned: {
      readonly start: readonly string[];
      readonly end: readonly string[];
    };
  } {
    const table = this.host.currentRoot?.domInputs.get(tableId);
    const entries = catalogTableColumnEntries(table?.props) ?? [];
    return {
      columns: entries.map((entry) => entry.key),
      ...catalogTableColumnsNow(entries, this.tableStates.get(tableId)),
    };
  }

  /** A Table record's state (absent slices = the authored defaults). */
  tableState(tableId: string): CatalogTableState {
    return this.heldTableState(tableId) ?? CATALOG_NO_TABLE_STATE;
  }

  /** A Table record as the rules between its state's slices read it (`catalogTableStateWith`). */
  private tableShape(tableId: string): CatalogTableShape {
    const table = this.host.currentRoot?.domInputs.get(tableId);
    const max = table?.props.maxSortColumns;
    return {
      // (ADR-315 Phase 5 — a Column the author groups by is the grouping no slice shows.)
      columns: this.tableColumns(tableId).map((column) =>
        column.defaultGrouped ? { ...column, grouped: true } : column,
      ),
      // (ADR-315 Phase 2 — several sorts only on a Table that allows them and whose rows' request
      //  carries the whole list: what it cannot carry is not accepted into the state, §4.3.1 — a
      //  write, a press and the browser's memory alike.)
      multiSort:
        table?.props.allowsMultiSort === true &&
        this.tableSliceServable(tableId, "sort").accepts === "whole",
      ...(typeof max === "number" && max > 0 ? { maxSortColumns: max } : {}),
      // (ADR-315 Phase 3 — a search · a column filter only where the rows' request carries it.)
      search: this.tableSliceServable(tableId, "search").accepts === "whole",
      // (ADR-320 Decision 4 — what of a filter tree the Table's rows' request carries.)
      judgeFilters: (tree) => this.judgeTableFilters(tableId, tree),
      // (ADR-315 Phase 5 증분 5g — pinned rows only where a pinned row of another page can be
      //  asked for by its key.)
      rowPins: !this.rowPinsRefused(
        this.tableCollectionOf(tableId),
        table?.sourceId,
      ),
    };
  }

  /**
   * ADR-320 Decision 4 — a filter tree as the Table takes it, judged here — the one place a tree
   * is assigned (a Column's menu, a rule's Do, a restored · an authored tree alike), by how the
   * rows are served now and the fields they have now. The root's items are judged in order, each
   * with the ones taken before it; an item with a condition that is not taken is left out whole (a
   * group is one item: taking a condition out of an `or` would change what the rest means — the
   * root is an `and`, so leaving an item out only widens the result). Not taken:
   *  - a condition on a field the rows do not have (a field removed since);
   *  - what the rows' request cannot carry, where a server cuts the pages (`viewRequestLimits` —
   *    a comparison · an `or` a flat format does not name, a path through a reference, a computed
   *    field, a key the request already has, a `body` format on a method that sends none).
   * The number of items left out is kept for the Table's notice (`tableFiltersRefused`).
   */
  private judgeTableFilters(
    tableId: string,
    tree: ViewConditionGroup,
  ): ViewConditionGroup {
    const read = this.tableRead(tableId);
    if (!read) {
      this.filtersRefused.delete(tableId);
      return tree;
    }
    const fields = viewRunSchema(read.collection?.schema);
    const rowFields = read.base.queries.length
      ? viewSchemaAt(
          { queries: read.base.queries, schema: fields },
          read.base.queries.length,
        )
      : fields;
    const references = viewRunReferences(this.host.collections);
    const { taken } = catalogJudgeFilterItems(tree, {
      fieldReadable: (path) => !!viewFieldOf(path, rowFields, references),
      refusedBy: (items, ids) =>
        !!this.host
          .viewRequestLimits(read.collectionId, read.base, items)
          ?.some(
            (warning) =>
              warning.code === "GET_BODY" ||
              (warning.conditionId !== undefined &&
                ids.has(warning.conditionId)),
          ),
    });
    const refused = tree.items.length - taken.length;
    if (refused) this.filtersRefused.set(tableId, refused);
    else this.filtersRefused.delete(tableId);
    return refused ? { ...tree, items: taken } : tree;
  }
  /**
   * ADR-320 Decision 4 — the held filter trees judged again: how a collection's rows are served
   * changed (its endpoint · its query format · its fields — the author's edit in the Builder's
   * Preview), and a tree held from before may hold what the request cannot carry now. A tree that
   * is still taken whole writes nothing.
   */
  rejudgeFilters(): void {
    this.scopes.rejudge();
    for (const [tableId, state] of [...this.tableStates]) {
      if (!state.filters) continue;
      // (The notice counts what the tree as it was assigned lost: an item left out now is one
      //  more — judging the held tree again does not clear the ones left out before.)
      const before = this.tableFiltersRefused(tableId);
      this.setTableState(tableId, { filters: state.filters });
      const refused = before + this.tableFiltersRefused(tableId);
      if (refused) this.filtersRefused.set(tableId, refused);
    }
  }
  /** The root items the Table's last assigned filter tree left out (Decision 4 — the notice). */
  private readonly filtersRefused = new Map<string, number>();
  tableFiltersRefused(tableId: string): number {
    return this.filtersRefused.get(tableId) ?? 0;
  }

  /** A Table record's document node (the record's source), if it is one. */
  private tableNodeEntry(tableId: string) {
    const source = this.host.currentRoot?.domInputs.get(tableId)?.sourceId;
    const entry = source
      ? this.host.graph?.getEntry(source as never)
      : undefined;
    return entry?.kind === "node" ? entry : undefined;
  }

  /** The collection a Table record's node is bound to (its id without the prefix). */
  private tableCollectionOf(tableId: string): string | undefined {
    const binding = this.tableNodeEntry(tableId)?.binding;
    return binding && dataCollectionIdOf(binding.collectionId);
  }

  /**
   * ADR-315 Phase 5 증분 5g — the key field a collection's rows are asked for by (`keys` — the
   * binding's value field, the collection's key field, else `id` · `key` · `value` as the lists
   * key them). Undefined = the rows are keyed by their place (`row-N`): no request names them.
   */
  private rowKeyFieldOf(
    collectionId: string,
    nodeId: string | undefined,
  ): string | undefined {
    const collection = this.host.collections.find(
      (item) => item.id === collectionId,
    );
    const entry = nodeId
      ? this.host.graph?.getEntry(nodeId as never)
      : undefined;
    const binding = entry?.kind === "node" ? entry.binding : undefined;
    const schema = collection?.schema ?? [];
    const roles = resolveFieldRoles(
      binding,
      schema.flatMap((field) =>
        field.key ? [{ id: field.id, key: field.key }] : [],
      ),
      collection?.keyField,
    );
    if (roles?.value) return roles.value;
    return ["id", "key", "value"].find((key) =>
      schema.some((field) => field.key === key),
    );
  }

  /**
   * ADR-315 Phase 5 증분 5g — a list of a collection whose server pages its rows pins none: the
   * endpoint names no request for rows by key (`catalogTableSliceServable` 「pins」), the rows have
   * no key field, or the list is a server's 「Pages」 (a page's request carries no view).
   */
  rowPinsRefused(
    collectionId: string | undefined,
    nodeId: string | undefined,
  ): boolean {
    const service = this.host.collectionRowService(collectionId);
    if (!service.remote || !collectionId) return false;
    if (catalogTableSliceServable(service, "pins").accepts !== "whole")
      return true;
    if (!this.rowKeyFieldOf(collectionId, nodeId)) return true;
    const entry = nodeId
      ? this.host.graph?.getEntry(nodeId as never)
      : undefined;
    return (
      entry?.kind === "node" &&
      entry.rowDisplay?.mode === "pages" &&
      this.host.remotePages(collectionId)
    );
  }

  /**
   * ADR-315 Phase 5 증분 5g — a Table record's pinned rows as its rows' requests name them: the
   * key field, the keys, and whether they show past the search · filters (`keepPinnedRows`).
   * Undefined = none, or rows that are all here (local — read out of them).
   */
  tablePinRequest(tableId: string):
    | {
        field: string;
        keys: readonly string[];
        keep: boolean;
      }
    | undefined {
    const pinned = this.tableStates.get(tableId)?.pinnedRows;
    if (!pinned || (!pinned.top.length && !pinned.bottom.length))
      return undefined;
    const collectionId = this.tableCollectionOf(tableId);
    const nodeId = this.host.currentRoot?.domInputs.get(tableId)?.sourceId;
    if (!collectionId || !this.host.collectionRowService(collectionId).remote)
      return undefined;
    if (this.rowPinsRefused(collectionId, nodeId)) return undefined;
    const field = this.rowKeyFieldOf(collectionId, nodeId);
    if (!field) return undefined;
    return {
      field,
      keys: [...pinned.top, ...pinned.bottom],
      keep:
        this.host.currentRoot?.domInputs.get(tableId)?.props.keepPinnedRows ===
        true,
    };
  }

  /**
   * Writes slices of a Table record's state through the rules between them
   * (`catalogTableStateWith`); true = the state changed. The caller reads the rows again.
   */
  private writeTableState(
    tableId: string,
    patch: Readonly<Record<string, unknown>>,
  ): boolean {
    const before = this.tableState(tableId);
    const next = catalogTableStateWith(before, patch, this.tableShape(tableId));
    if (next === before) return false;
    // (ADR-320 — a Table of a filter bar's scope: its filters are the scope's, never held here.)
    const scoped = !!this.scopes.barOf(
      tableId.slice(tableId.lastIndexOf("::") + 2),
    );
    const { filters: _scope, ...unscoped } = next;
    const held = scoped ? unscoped : next;
    if (Object.keys(held).length) this.tableStates.set(tableId, held);
    else this.tableStates.delete(tableId);
    return true;
  }

  /**
   * ADR-315 — the one write of a Table record's state (a header press, a rule's Do, the browser's
   * memory): the slices go through the rules between them, and a data slice (sort · search ·
   * column filters · grouping) changing reads the Table's rows again. A column · row · cell slice
   * never reads rows (HC4 — the row source is not called).
   */
  setTableState(
    tableId: string,
    patch: Readonly<Record<string, unknown>>,
  ): void {
    // (ADR-320 — a Table of a filter bar's scope: a filter write is the scope's assignment — the
    //  Column menu's condition shows as a chip, every list of the scope reads it.)
    const bar =
      "filters" in patch
        ? this.scopes.barOf(tableId.slice(tableId.lastIndexOf("::") + 2))
        : undefined;
    if (bar) {
      const { filters, ...rest } = patch;
      this.scopes.assign(bar, filters ?? null);
      if (!Object.keys(rest).length) return;
      patch = rest;
    }
    const before = this.tableState(tableId);
    if (!this.writeTableState(tableId, patch)) return;
    const next = this.tableState(tableId);
    this.rememberTableState(tableId);
    if (
      CATALOG_TABLE_DATA_SLICES.some((slice) => before[slice] !== next[slice])
    )
      this.readTableRows(
        tableId,
        next,
        before.sort !== next.sort ? "sorting" : "filtering",
        before.sort === next.sort &&
          before.filters === next.filters &&
          before.search !== next.search,
      );
    // (ADR-315 Phase 5 — a grouped Table's open groups: their rows are read out only while open.)
    // (ADR-315 Phase 5 증분 5d — a tree's too: its record says which rows are open.)
    else if (
      before.expandedKeys !== next.expandedKeys &&
      (this.tableGroupedNow(tableId) ||
        catalogTableExpandedKeys(
          this.host.currentRoot?.domInputs.get(tableId)?.props,
        ) !== undefined)
    )
      this.readTableRows(tableId, next, "filtering", false);
    // (ADR-315 Phase 5 증분 5f — the pinned rows: which rows stand first · last, and each one's
    //  record says so — read again with no row kept at its place.)
    else if (before.pinnedRows !== next.pinnedRows)
      this.readPinnedRows(tableId);
    // (ADR-315 Phase 4 — a column slice: the Table's columns are projected again. Its rows are
    //  not read — the ones its records were resolved from, HC4.)
    else if (
      CATALOG_TABLE_COLUMN_SLICES.some(
        (slice) => slice !== "columnWidths" && before[slice] !== next[slice],
      )
    )
      this.projectTableColumns(tableId);
    // (RAC's header reads the first sort; the other sorted Columns' marks read the list — a
    //  hidden Column has no header, so the shown ones are told again when one hides or shows:
    //  ADR-315 Phase 4 증분 6.)
    if (
      before.sort !== next.sort ||
      (before.hiddenColumns !== next.hiddenColumns &&
        this.tableSortNow(tableId).length)
    )
      this.echoTableSort(tableId);
    if (before.columnWidths !== next.columnWidths && !this.resizing)
      this.echoTableWidths(tableId);
  }

  /** ADR-315 Phase 5 증분 5f — a Table record's rows read again for its pinned rows. */
  private readPinnedRows(tableId: string): void {
    const entry = this.tableNodeEntry(tableId);
    if (!entry?.binding) return;
    // (ADR-315 Phase 5 증분 5g — a server's pages: the page leaves the pinned rows out — another
    //  request — and they are asked for by key.)
    if (this.tableService(tableId).remote) this.host.loadRouted("filtering");
    const errors = this.host.currentRoot!.refreshNodes(new Set([entry.id]));
    if (errors.length)
      console.error("[CatalogPreview] pinned rows:", ...errors);
  }

  /** ADR-315 Phase 5 — whether a Table record is grouped now (its state's · its author's grouping). */
  private tableGroupedNow(tableId: string): boolean {
    return (
      catalogTableGrouping(this.tableState(tableId), this.tableColumns(tableId))
        .length > 0
    );
  }

  /**
   * ADR-315 Phase 5 증분 5g — a Table record that reads every row of a collection its server
   * pages: a grouping · a totals row · a tree its rows' request does not carry (breakdown §4.3.1
   * — `catalogTableSliceServable` `loaded`). Its collection loads whole and the slices run here —
   * never over the pages loaded so far (a quiet part of the groups · the totals · the tree).
   */
  private tableReadsWhole(tableId: string): boolean {
    const root = this.host.currentRoot;
    const table = root?.domInputs.get(tableId);
    if (!root || table?.ruleId !== "Table") return false;
    const service = this.tableService(tableId);
    if (!service.remote) return false;
    const fieldMap = this.tableNodeEntry(tableId)?.binding?.fieldMap;
    const slices: CatalogTableServedSlice[] = [
      ...(this.tableGroupedNow(tableId) ? ["grouping" as const] : []),
      ...(this.tableHasTotalsRow(tableId) ? ["totals" as const] : []),
      ...(fieldMap?.children || fieldMap?.parentId ? ["tree" as const] : []),
    ];
    const aggregates = this.tableAggregates(tableId);
    return slices.some(
      (slice) =>
        catalogTableSliceServable(service, slice, aggregates).accepts ===
        "loaded",
    );
  }

  /** ADR-315 Phase 5 증분 5g — a Table bound to the collection reads every row (`tableReadsWhole`). */
  collectionTablesReadWhole(collectionId: string): boolean {
    return this.host
      .boundTableRecords(collectionId)
      .some(({ recordId }) => this.tableReadsWhole(recordId));
  }

  /** A Table record resolved again for its column slices — its rows as they were read. */
  private projectTableColumns(tableId: string): void {
    const source = this.host.currentRoot?.domInputs.get(tableId)?.sourceId;
    if (!source) return;
    const errors = this.host.currentRoot!.reprojectColumns(new Set([source]));
    if (errors.length) console.error("[CatalogPreview] columns:", ...errors);
    this.syncColumnChoosers();
  }

  /** The record of a Table node (the first that draws it — a chooser names the node). */
  private tableRecordOf(tableNodeId: string): string | undefined {
    const root = this.host.currentRoot;
    return root
      ?.recordsOfSource(tableNodeId)
      .find((id) => root.domInputs.get(id)?.ruleId === "Table");
  }

  /** A chooser node's Menu records (under each record that draws the chooser). */
  private chooserMenusOf(chooserId: string): string[] {
    const root = this.host.currentRoot;
    if (!root) return [];
    const out: string[] = [];
    const visit = (id: string) => {
      const record = root.domInputs.get(id);
      if (!record) return;
      if (record.ruleId === "Menu") out.push(id);
      else for (const child of record.children) visit(child);
    };
    for (const id of root.recordsOfSource(chooserId)) visit(id);
    return out;
  }

  /**
   * ADR-315 Phase 4 — what a column chooser of a Table node lists: the Table's data columns (Column
   * key · header text, the authored order), the ones shown now (`selectedKeys`) and the one it
   * cannot hide (`disabledKeys` — the last row header shown, the projection's rule).
   */
  columnChoices(tableNodeId: string):
    | {
        readonly tableId: string;
        readonly columns: readonly { key: string; label: string }[];
        readonly shown: readonly string[];
        readonly locked: readonly string[];
      }
    | undefined {
    const tableId = this.tableRecordOf(tableNodeId);
    return tableId ? this.tableColumnChoices(tableId) : undefined;
  }

  /** `columnChoices` of a Table record. */
  private tableColumnChoices(tableId: string) {
    const table = this.host.currentRoot?.domInputs.get(tableId);
    const entries = catalogTableColumnEntries(table?.props);
    if (!entries) return undefined;
    const now = catalogTableColumnsNow(entries, this.tableStates.get(tableId));
    const hidden = new Set(now.hidden);
    const headers = entries.filter((entry) => entry.rowHeader);
    if (headers.length && headers.every((entry) => hidden.has(entry.key)))
      hidden.delete(headers.at(-1)!.key);
    const shownHeaders = headers.filter((entry) => !hidden.has(entry.key));
    return {
      tableId,
      columns: entries.map((entry) => ({
        key: entry.key,
        label: entry.label ?? entry.key,
      })),
      shown: entries
        .filter((entry) => !hidden.has(entry.key))
        .map((entry) => entry.key),
      locked: shownHeaders.length === 1 ? [shownHeaders[0]!.key] : [],
    };
  }

  /**
   * A column chooser's selection (the columns its viewer checked) as the Table state: the columns
   * left out are hidden. `menuId` is the chooser's Menu record.
   */
  chooseTableColumns(menuId: string, keys: unknown): void {
    // (Only a chooser's Menu — the ones last told their selection; any other selection is not
    //  looked at here, ADR-287 R1's lookups.)
    if (this.host.echoing || !this.chooserEchoed.has(menuId)) return;
    const tableNode = this.chooserTableOf(menuId);
    const tableId = tableNode ? this.tableRecordOf(tableNode) : undefined;
    if (!tableId) return;
    this.showTableColumns(tableId, keys);
    this.chooserEchoed.set(menuId, "");
    this.echoColumnChoosers();
  }

  /**
   * ADR-315 증분 4d — a Table record's shown columns set (a chooser's selection, a rule's 「Set
   * shown columns」 · 「Show · Hide column」 Do): the ones left out are hidden — the last row header
   * stays shown (the projection's rule).
   */
  showTableColumns(tableId: string, keys: unknown): void {
    const choices = this.tableColumnChoices(tableId);
    if (!choices) return;
    const shown =
      keys === "all"
        ? new Set(choices.columns.map((column) => column.key))
        : new Set(
            (Array.isArray(keys) || keys instanceof Set
              ? [...keys]
              : // (A rule's text value — 「Set shown columns」: the keys by commas.)
                typeof keys === "string"
                ? keys.split(",").map((key) => key.trim())
                : []
            ).map(String),
          );
    // (The last row header stays shown — the state's rule, `catalogTableStateWith`.)
    this.setTableState(tableId, {
      hiddenColumns: choices.columns
        .map((column) => column.key)
        .filter((key) => !shown.has(key)),
    });
  }

  /** A Table record's shown columns now (a rule's 「Show · Hide column」 reads them). */
  tableVisibleColumns(tableId: string): readonly string[] | undefined {
    return this.tableColumnChoices(tableId)?.shown;
  }

  /** A drawn Column record's Table record and RAC key (its header's — `catalogTableColumnKey`). */
  private columnRecordPlace(
    columnId: string,
  ): { tableId: string; racKey: string } | undefined {
    const root = this.host.currentRoot;
    const column = root?.domInputs.get(columnId);
    if (!root || column?.ruleId !== "Column") return undefined;
    let table = column.parentId
      ? root.domInputs.get(column.parentId)
      : undefined;
    while (table && table.ruleId !== "Table")
      table = table.parentId ? root.domInputs.get(table.parentId) : undefined;
    if (!table) return undefined;
    return {
      tableId: table.id,
      racKey: catalogTableColumnKey(column),
    };
  }

  /** ADR-315 증분 4d — a drawn Column's pinned side now (`none` · `start` · `end`). */
  tableColumnPinned(columnId: string): "none" | "start" | "end" | undefined {
    const place = this.columnRecordPlace(columnId);
    const input = place && this.columnMenuInput(place.tableId, place.racKey);
    if (!place || !input) return undefined;
    const pinned = this.tableColumnsNow(place.tableId).pinned;
    return pinned.start.includes(input[0].key)
      ? "start"
      : pinned.end.includes(input[0].key)
        ? "end"
        : "none";
  }

  /** ADR-315 증분 4d — a rule's 「Pin column to start · end」 · 「Unpin column」 on a drawn Column. */
  pinTableColumn(columnId: string, side: unknown): void {
    const place = this.columnRecordPlace(columnId);
    const input =
      place && this.columnMenuInput(place.tableId, place.racKey, true);
    if (!place || !input) return;
    const now = this.tableColumnPinned(columnId);
    const id =
      side === "start" ? "pin-start" : side === "end" ? "pin-end" : "unpin";
    if (now === (side === "start" || side === "end" ? side : "none")) return;
    const patch = catalogColumnMenuPatch(id, ...input);
    if (patch) this.setTableState(place.tableId, patch);
  }

  /** ADR-315 Phase 5 증분 5f — a drawn data row's Table record and its row key. */
  private rowRecordPlace(
    rowId: string,
  ): { tableId: string; key: string } | undefined {
    const root = this.host.currentRoot;
    const row = root?.domInputs.get(rowId);
    if (!root || row?.ruleId !== "Row" || row.rowIndex === undefined)
      return undefined;
    let table = row.parentId ? root.domInputs.get(row.parentId) : undefined;
    while (table && table.ruleId !== "Table")
      table = table.parentId ? root.domInputs.get(table.parentId) : undefined;
    return table
      ? { tableId: table.id, key: String(row.props.id ?? row.id) }
      : undefined;
  }

  /** ADR-315 Phase 5 증분 5f — a drawn data row's pinned side now (`none` · `top` · `bottom`). */
  tableRowPinned(rowId: string): "none" | "top" | "bottom" | undefined {
    const place = this.rowRecordPlace(rowId);
    if (!place) return undefined;
    const pinned = this.tableState(place.tableId).pinnedRows;
    return pinned?.top.includes(place.key)
      ? "top"
      : pinned?.bottom.includes(place.key)
        ? "bottom"
        : "none";
  }

  /**
   * ADR-315 Phase 5 증분 5f — a row to the top · the bottom (after the rows pinned there — TanStack
   * `row.pin`) or back among the rows (`none`): the Table's `pinnedRows`. A viewer's row menu.
   */
  pinTableRow(tableId: string, key: string, side: unknown): void {
    const now = this.tableState(tableId).pinnedRows;
    const top = (now?.top ?? []).filter((item) => item !== key);
    const bottom = (now?.bottom ?? []).filter((item) => item !== key);
    this.setTableState(tableId, {
      pinnedRows: {
        top: side === "top" ? [...top, key] : top,
        bottom: side === "bottom" ? [...bottom, key] : bottom,
      },
    });
  }

  /**
   * S2 체크리스트 §9.3 — an S2 `EditableCell`'s save (사용자 결정 「세션 update · 저장은
   * callEndpoint」): the submitted fields onto the drawn row's item of its Table's collection
   * (`useListData.update` — the session's edit record, as a rule's `update` Do).
   */
  editTableRow(
    rowId: string,
    values: Readonly<Record<string, unknown>>,
  ): number | undefined {
    const place = this.rowRecordPlace(rowId);
    const collectionId = place && this.tableCollectionOf(place.tableId);
    if (!place || !collectionId) return undefined;
    const result = this.host.update(collectionId, place.key, values);
    // (ADR-317 사용자 결정 8 — a value its field cannot read is kept out: `ok` with a reason.)
    if (!result.ok || result.reason)
      console.warn(`[interactions] Editable cell: ${result.reason ?? ""}`);
    // (ADR-317 Phase 4 — the edit's number: the Form's save rule clears its mark when it succeeds.)
    return result.seq;
  }

  /**
   * ADR-317 Decision 2 — cells of a Table record written at once (a paste · a fill · a clear): each
   * (row key, Column key) through the session's `updateMany` — one edit record, one read of the
   * rows (HC5), `update`'s judgment for each value (HC2). Written only (HC3): a data row's cell
   * (`notDataRow` — a group · totals · detail row, or a row not read) of a Column whose body cells
   * are S2 `EditableCell`s (`notEditable` — the Column's 「Editable」). A Column is known by its
   * cells' Column key — a Table with 「Cell selection」 (the one that pastes · fills) names them.
   */
  editTableCells(
    tableId: string,
    cells: readonly {
      readonly row: string;
      readonly column: string;
      readonly value: unknown;
    }[],
  ): CatalogTableCellsWrite {
    const skipped: Partial<Record<CatalogTableCellsWriteSkip, number>> = {};
    const skip = (reason: CatalogTableCellsWriteSkip) => {
      skipped[reason] = (skipped[reason] ?? 0) + 1;
    };
    const collectionId = this.tableCollectionOf(tableId);
    const rows = this.host.root?.rowValuesOf(tableId);
    if (!collectionId || !rows)
      return {
        ok: false,
        reason: "데이터에 연결되지 않은 표",
        written: [],
        skipped,
      };
    const editable = this.tableEditableColumns(tableId);
    const byRow = new Map<string, Record<string, unknown>>();
    for (const { row, column, value } of cells) {
      if (!editable.has(column)) skip("notEditable");
      else if (!rows.has(row)) skip("notDataRow");
      else byRow.set(row, { ...byRow.get(row), [column]: value });
    }
    const result = byRow.size
      ? this.host.updateMany(
          collectionId,
          [...byRow].map(([key, fields]) => ({ key, fields })),
        )
      : { ok: true, written: [], skipped: {} };
    for (const [reason, count] of Object.entries(result.skipped))
      skipped[reason as CatalogTableCellsWriteSkip] =
        (skipped[reason as CatalogTableCellsWriteSkip] ?? 0) + (count ?? 0);
    const keys = [...new Set(result.written.map((cell) => cell.key))];
    return {
      ...result,
      skipped,
      ...(keys.length
        ? { keys, items: this.host.itemsByKeys(collectionId, keys) }
        : {}),
    };
  }

  /**
   * ADR-317 — a Table record's Columns whose body cells are S2 `EditableCell`s (a Cell holding a
   * Form — `catalogEditableCell`), by Column key (the cells' `CATALOG_CELL_COLUMN_PROP`). Every
   * body cell of a Column is its template's, so the rows drawn now tell.
   */
  private tableEditableColumns(tableId: string): ReadonlySet<string> {
    const root = this.host.currentRoot;
    const out = new Set<string>();
    if (!root) return out;
    const visit = (id: string) => {
      const record = root.domInputs.get(id);
      if (!record) return;
      if (record.ruleId === "TableHeader" || record.ruleId === "TableFooter")
        return;
      if (record.ruleId === "Cell") {
        const column = record.props[CATALOG_CELL_COLUMN_PROP];
        if (
          typeof column === "string" &&
          record.children.some(
            (child) => root.domInputs.get(child)?.ruleId === "Form",
          )
        )
          out.add(column);
        return;
      }
      for (const child of record.children) visit(child);
    };
    visit(tableId);
    return out;
  }

  /** ADR-315 Phase 5 증분 5f — a rule's 「Pin row to top · bottom」 · 「Unpin row」 on a drawn row. */
  pinTableRowRecord(rowId: string, side: unknown): void {
    const place = this.rowRecordPlace(rowId);
    if (place) this.pinTableRow(place.tableId, place.key, side);
  }

  /** ADR-315 증분 4d — a drawn Column's filter value now (`""` = none — `filterValue`). */
  tableColumnFilterValue(columnId: string): string | undefined {
    const place = this.columnRecordPlace(columnId);
    const input = place && this.columnMenuInput(place.tableId, place.racKey);
    if (!place || !input) return undefined;
    const value = catalogFilterColumnCondition(
      input[1].state.filters,
      input[0].key,
    )?.value;
    return value === undefined || value === null
      ? ""
      : Array.isArray(value)
        ? value.map(String).join(",")
        : String(value);
  }

  /**
   * ADR-315 증분 4d — a rule's 「Set column filter」 on a drawn Column: the value under the
   * Column's filter now, else the comparison its dialog starts with (`catalogColumnFilterDraft` —
   * text 「contains」, a list 「any of」, else 「equals」), read as its field kind holds it. Empty =
   * the filter goes.
   */
  filterTableColumn(columnId: string, value: unknown): void {
    const place = this.columnRecordPlace(columnId);
    const input =
      place && this.columnMenuInput(place.tableId, place.racKey, true);
    if (!place || !input || !input[0].filterOps?.length) return;
    const [column, table] = input;
    const field = this.tableField(place.tableId, column.key)?.field;
    const kind = viewFieldKind(field?.type);
    const condition = catalogFilterColumnCondition(
      table.state.filters,
      column.key,
    );
    const draft = catalogColumnFilterDraft({
      kind,
      ops: column.filterOps!,
      ...(condition ? { condition } : {}),
    });
    const text =
      value === undefined || value === null
        ? ""
        : Array.isArray(value)
          ? value.map(String).join(",")
          : String(value);
    const written = catalogColumnFilterCondition(kind, {
      ...draft,
      text,
      picked:
        text === ""
          ? []
          : catalogFilterPicksMany(draft.op)
            ? text.split(",")
            : draft.picked,
    });
    const patch = catalogColumnFilterPatch(column, table, written);
    if (patch) this.setTableState(place.tableId, patch);
  }

  /** The Table node a chooser's Menu record lists (the nearest record whose node has `columnsOf`). */
  private chooserTableOf(recordId: string): string | undefined {
    const root = this.host.currentRoot;
    const graph = this.host.graph;
    if (!root || !graph) return undefined;
    for (
      let record = root.domInputs.get(recordId);
      record;
      record = record.parentId ? root.domInputs.get(record.parentId) : undefined
    ) {
      const source = graph.getEntry(record.sourceId as never);
      if (source?.kind === "node" && source.columnsOf) return source.columnsOf;
    }
    return undefined;
  }

  /**
   * The choosers follow their Tables: a chooser whose Table's columns changed (added · renamed ·
   * the Table first drawn) resolves again, and every chooser's Menu shows the columns shown now.
   */
  syncColumnChoosers(): void {
    const root = this.host.currentRoot;
    if (!root || !this.columnChoosers.size) return;
    const again = new Set<string>();
    for (const [tableNode, choosers] of this.columnChoosers) {
      const choices = this.columnChoices(tableNode);
      const seen = JSON.stringify(choices?.columns ?? null);
      if (this.chooserColumnsSeen.get(tableNode) === seen) continue;
      this.chooserColumnsSeen.set(tableNode, seen);
      for (const id of choosers) again.add(id);
    }
    if (again.size) {
      const errors = root.refreshNodes(again);
      if (errors.length) console.error("[CatalogPreview] chooser:", ...errors);
    }
    this.echoColumnChoosers();
  }

  /** Each chooser Menu's selection told to RAC: the columns shown, the locked one disabled. */
  echoColumnChoosers(): void {
    const write = this.host.runtimePropsWriter;
    const root = this.host.currentRoot;
    if (!write || !root || !this.columnChoosers.size) return;
    this.host.echoing = true;
    try {
      for (const [tableNode, choosers] of this.columnChoosers) {
        const choices = this.columnChoices(tableNode);
        if (!choices) continue;
        const told = JSON.stringify([choices.shown, choices.locked]);
        for (const chooser of choosers)
          for (const menuId of this.chooserMenusOf(chooser)) {
            if (this.chooserEchoed.get(menuId) === told) continue;
            this.chooserEchoed.set(menuId, told);
            write(menuId, {
              selectedKeys: [...choices.shown],
              disabledKeys: [...choices.locked],
            });
          }
      }
    } finally {
      this.host.echoing = false;
    }
  }

  /** The project's remembered Table states as stored (`{}` = none · no storage). */
  private rememberedTableStates(): Record<string, unknown> {
    const projectId = this.host.graph?.projectId;
    return projectId
      ? catalogStoredTableStates(this.host.options.tableStateStorage, projectId)
      : {};
  }

  /** Keeps a 「Remember state」 Table's state in the browser (사용자 결정 1): its remembered slices. */
  private rememberTableState(tableId: string): void {
    const storage = this.host.options.tableStateStorage;
    const projectId = this.host.graph?.projectId;
    if (!storage || !projectId) return;
    if (
      this.host.currentRoot?.domInputs.get(tableId)?.props.rememberState !==
      true
    )
      return;
    const all = { ...this.rememberedTableStates() };
    const kept = catalogTableStateRemembered(this.tableState(tableId));
    if (Object.keys(kept).length) all[tableId] = kept;
    else delete all[tableId];
    catalogStoreTableStates(storage, projectId, all);
  }

  /**
   * Gives the 「Remember state」 Tables drawn now the state their browser kept — once a record,
   * before the view reads the root (`changed`): no frame shows the data's order first. A stored
   * value goes through the same rules as a write (`catalogTableStateRead` — a column the Table no
   * longer has is dropped), and a state the session already holds wins.
   */
  restoreTableStates(): void {
    const root = this.host.currentRoot;
    if (!root) return;
    const stored = this.rememberedTableStates();
    if (!Object.keys(stored).length) return;
    const tables = [...root.domInputs.values()].filter(
      (record) =>
        record.ruleId === "Table" &&
        record.props.rememberState === true &&
        !this.restoredTables.has(record.id),
    );
    for (const table of tables) {
      this.restoredTables.add(table.id);
      const value = stored[table.id];
      if (value === undefined || this.tableStates.has(table.id)) continue;
      const state = catalogTableStateRemembered(
        catalogTableStateRead(value, this.tableShape(table.id)),
      );
      if (!Object.keys(state).length) continue;
      this.tableStates.set(table.id, state);
      // (ADR-315 Phase 4 — the kept columns are drawn now: the root was resolved before the
      //  state was here, and Publish resolves nothing after it. A sort reads the rows — that
      //  resolves the Table, its columns with it.)
      if (!state.sort) {
        if (state.hiddenColumns || state.columnOrder || state.pinnedColumns)
          this.projectTableColumns(table.id);
        continue;
      }
      this.readTableRows(table.id, state);
      this.echoTableSort(table.id);
    }
  }

  /**
   * ADR-315 Phase 3 — a Table's authored `searchText` is the search it starts with: the state
   * takes it when the record is first drawn — before the view reads the root (as the remembered
   * states are: no frame shows the unsearched rows first) — and again when its author edits it
   * (the Builder's Preview follows the panel). Between those the state is the search: clearing it
   * does not bring the authored text back.
   */
  startTableSearches(): void {
    const root = this.host.currentRoot;
    if (!root) return;
    for (const table of root.domInputs.values()) {
      if (table.ruleId !== "Table") continue;
      const authored = table.props.searchText;
      const text = typeof authored === "string" ? authored : "";
      if ((this.searchedTables.get(table.id) ?? "") === text) continue;
      this.searchedTables.set(table.id, text);
      if (!this.writeTableState(table.id, { search: text })) continue;
      this.readTableRows(table.id, this.tableState(table.id), "filtering");
    }
  }

  /**
   * A Table record's sort told to its view: RAC's `sortDescriptor` (the first entry — RAC's header
   * holds one sort, `aria-sort` on one header) and every entry by RAC key (`_sortEntries` — the
   * order marks of the Columns sorted after the first, ADR-315 Phase 2).
   */
  echoTableSort(tableId: string): void {
    const write = this.host.runtimePropsWriter;
    if (!write) {
      this.pendingSortEchoes.add(tableId);
      return;
    }
    this.pendingSortEchoes.delete(tableId);
    const columns = this.tableColumns(tableId);
    const entries = (this.tableState(tableId).sort ?? []).flatMap((sort) => {
      const column = columns.find((item) => item.key === sort.column);
      // (A hidden Column is sorted by and has no header to mark.)
      return column?.racKey
        ? [{ column: column.racKey, direction: sort.direction }]
        : [];
    });
    this.host.echoing = true;
    try {
      write(tableId, {
        sortDescriptor: entries[0],
        _sortEntries: entries.length > 1 ? entries : undefined,
      });
    } finally {
      this.host.echoing = false;
    }
  }

  /**
   * ADR-315 Phase 4 증분 6 — the sort a Table's rows are in now: its state's, else the sort its view
   * leaves them in as authored (`CATALOG_TABLE_AUTHORED_SORT_PROP` — the state's sort stands in for
   * it, breakdown §4.2). What its header shows and a header press · its menu start from.
   */
  private tableSortNow(tableId: string): readonly CatalogTableSortItem[] {
    const sort = this.tableState(tableId).sort;
    if (sort?.length) return sort;
    const authored = catalogTableAuthoredSort(
      this.host.currentRoot?.domInputs.get(tableId)?.props,
    );
    if (!authored) return [];
    const keys = new Set(this.tableColumns(tableId).map((item) => item.key));
    const out: CatalogTableSortItem[] = [];
    for (const entry of authored) {
      if (!keys.has(entry.column)) break;
      out.push(entry);
    }
    return out;
  }

  /**
   * A sort set as a value (a rule's `sortDescriptor` Do · the runtime prop): that one sort, or none.
   * The first entry of the list the state already holds is no change — the echo above comes back
   * through here.
   */
  sortTable(tableId: string, sort: CatalogTableSort | undefined): void {
    if (this.host.echoing) return;
    // (RAC names the sorted Column by its RAC key; the state keeps its Column key.)
    const column = sort
      ? this.tableColumns(tableId).find((item) => item.racKey === sort.column)
      : undefined;
    const first = this.tableState(tableId).sort?.[0];
    if (
      sort &&
      column &&
      first?.column === column.key &&
      first.direction === sort.direction
    )
      return;
    this.setTableState(tableId, {
      sort:
        sort && column
          ? [{ column: column.key, direction: sort.direction }]
          : [],
    });
    // (A value that named no Column: the view shows the state — no sort.)
    if (sort && !column) this.echoTableSort(tableId);
  }

  /**
   * ADR-315 Phase 2 — a header press (RAC's `onSortChange` names the Column; RAC knows the first
   * sort only, so the direction is the state's to turn). The Column's cycle: its first direction
   * (`sortFirstDirection`) → the other → unsorted when the Table allows it (`allowsUnsorted`),
   * else the first again. `add` (Shift held · the menu's 「add to sort」) on a Table that takes
   * several sorts turns that Column within the list (a new one goes last); without it the press
   * is the only sort (TanStack `toggleSorting(desc, isMulti)`).
   */
  /**
   * ADR-315 Phase 4 — the widths RAC's column resize left (its `onResizeEnd`, by RAC key): the
   * Table's `columnWidths`, a Column's kept until another resize · the reader's reset. They are
   * RAC's already — no echo back (a rebuilt Table would lose its scroll and focus).
   */
  resizeTableColumns(
    tableId: string,
    widths: Readonly<Record<string, number>>,
  ): void {
    const columns = this.tableColumns(tableId);
    const next: Record<string, number> = {
      ...(this.tableState(tableId).columnWidths ?? {}),
    };
    for (const [racKey, width] of Object.entries(widths)) {
      const column = racKey
        ? columns.find((item) => item.racKey === racKey)
        : undefined;
      if (column) next[column.key] = width;
    }
    this.resizing = true;
    try {
      this.setTableState(tableId, { columnWidths: next });
    } finally {
      this.resizing = false;
    }
  }

  /** ADR-315 Phase 4 — a Table's state widths by RAC key (a drawn Column's resize starts there). */
  tableColumnWidths(
    tableId: string,
  ): Readonly<Record<string, number>> | undefined {
    const widths = this.tableState(tableId).columnWidths;
    if (!widths) return undefined;
    return Object.fromEntries(
      this.tableColumns(tableId).flatMap((column) =>
        column.racKey && widths[column.key] !== undefined
          ? [[column.racKey, widths[column.key]!]]
          : [],
      ),
    );
  }

  /**
   * A width set from outside RAC's drag (a rule · the browser's memory · a reset): the resizable
   * Table is built again from it — RAC's resize state keeps the widths it started with.
   */
  private echoTableWidths(tableId: string): void {
    const write = this.host.runtimePropsWriter;
    if (!write) return; // (nothing drawn yet — the first render reads the state)
    this.widthsRevision += 1;
    this.host.echoing = true;
    try {
      write(tableId, { _widthsRevision: this.widthsRevision });
    } finally {
      this.host.echoing = false;
    }
  }

  /**
   * ADR-315 Phase 5 — the group rows RAC opened · closed (its `onExpandedChange`, their row keys):
   * the Table's `expandedKeys`. A group's rows are read out only while it is open
   * (`catalogGroupBoundRows`), so the rows are read again.
   */
  expandTableRows(tableId: string, keys: readonly string[]): void {
    this.setTableState(tableId, { expandedKeys: [...keys] });
  }

  pressTableSort(tableId: string, racKey: string, add = false): void {
    const columns = this.tableColumns(tableId);
    const column = columns.find((item) => item.racKey === racKey);
    if (!column) return;
    const table = this.host.currentRoot?.domInputs.get(tableId);
    const current = this.tableSortNow(tableId);
    const held = current.find((item) => item.column === column.key);
    const first = column.sortFirstDirection;
    const second = first === "ascending" ? "descending" : "ascending";
    const direction = !held
      ? first
      : held.direction === first
        ? second
        : table?.props.allowsUnsorted === true
          ? undefined
          : first;
    const entry = direction && { column: column.key, direction };
    const several =
      add &&
      table?.props.allowsMultiSort === true &&
      this.tableSliceServable(tableId, "sort").accepts === "whole";
    const next = !several
      ? entry
        ? [entry]
        : []
      : held
        ? current.flatMap((item) =>
            item.column === column.key ? (entry ? [entry] : []) : [item],
          )
        : entry
          ? [...current, entry]
          : current;
    const before = this.tableState(tableId).sort;
    this.setTableState(tableId, { sort: next });
    // (A press the state did not take — past the Table's most sort columns: RAC's header already
    //  shows its own guess; the echo puts the state's back.)
    if (this.tableState(tableId).sort === before) this.echoTableSort(tableId);
  }

  /**
   * ADR-315 Phase 4 — a drawn Column's menu (S2 `ColumnWithMenu`, `tableColumnMenu.ts`): what it
   * reads — the Column (by its RAC key) with what its author allowed, the Table's shape · state.
   */
  private columnMenuInput(
    tableId: string,
    racKey: string,
    /** A rule's Do (ADR-315 증분 4d): the author's write — the viewer's menu permissions do not apply. */
    authored = false,
  ): [CatalogColumnMenuColumn, CatalogColumnMenuTable] | undefined {
    const root = this.host.currentRoot;
    const table = root?.domInputs.get(tableId);
    const column = racKey
      ? this.tableColumns(tableId).find((item) => item.racKey === racKey)
      : undefined;
    if (!root || !table || !column) return undefined;
    const record = [...(table.children ?? [])]
      .map((id) => root.domInputs.get(id))
      .filter((header) => header?.ruleId === "TableHeader")
      .flatMap((header) => header!.children)
      .map((id) => root.domInputs.get(id))
      .find((item) => !!item && catalogTableColumnKey(item) === racKey);
    if (!record) return undefined;
    const shape = this.tableShape(tableId);
    const allowsFiltering = authored || record.props.allowsFiltering === true;
    const allowsGrouping = authored || record.props.allowsGrouping === true;
    // (ADR-315 Phase 4 증분 4c — a filter compares the Column's data field: its kind's comparisons
    //  the Table's rows' request carries. No field — an unbound Table, a role's column — none.)
    const read =
      allowsFiltering || allowsGrouping
        ? this.tableField(tableId, column.key)
        : undefined;
    const field = read?.field;
    // (ADR-320 — the field's data id: the Column's condition in the filter tree reads it.)
    const fieldId = read && catalogFieldIdOf(read.fields, column.key);
    return [
      {
        key: column.key,
        allowsSorting: record.props.allowsSorting === true,
        allowsHiding: authored || record.props.allowsHiding === true,
        allowsPinning: authored || record.props.allowsPinning === true,
        allowsResizing: record.props.allowsResizing === true,
        sortFirstDirection: column.sortFirstDirection,
        allowsFiltering,
        // (ADR-315 Phase 5 — a group of a data field: a bound Table's.)
        allowsGrouping,
        groupable: !!field,
        filterOps:
          field && allowsFiltering
            ? VIEW_COMPARISONS_BY_KIND[viewFieldKind(field.type)].filter(
                (op) =>
                  this.tableSliceServable(tableId, { filter: op }).accepts ===
                  "whole",
              )
            : [],
        ...(fieldId ? { field: fieldId } : {}),
      },
      {
        shape,
        state: {
          ...this.tableState(tableId),
          sort: this.tableSortNow(tableId),
        },
        allowsColumnReordering: table.props.allowsColumnReordering === true,
      },
    ];
  }

  /** ADR-315 Phase 4 — a drawn Column's menu items as the Table's state is now. */
  tableColumnMenu(
    tableId: string,
    racKey: string,
  ): readonly CatalogColumnMenuItem[] {
    const input = this.columnMenuInput(tableId, racKey);
    return input ? catalogColumnMenuItems(...input) : [];
  }

  /**
   * ADR-315 Phase 4 — a Column menu item pressed: the slice it writes, through the one write of
   * the Table's state (the resize item is RAC's — the DOM starts it).
   */
  runTableColumnMenu(
    tableId: string,
    racKey: string,
    id: CatalogColumnMenuItemId,
  ): void {
    const input = this.columnMenuInput(tableId, racKey);
    const patch = input && catalogColumnMenuPatch(id, ...input);
    if (patch) this.setTableState(tableId, patch);
  }

  /**
   * ADR-315 Phase 4 증분 5 — a header drag: whether the Column `fromKey` (its RAC key) may drop on
   * the Column `toKey`, and with `apply` the drop — the one write of the Table's state
   * (`catalogColumnDropPatch`: their list's order, never the document).
   */
  dropTableColumn(
    tableId: string,
    fromKey: string,
    toKey: string,
    apply: boolean,
  ): boolean {
    const input = this.columnMenuInput(tableId, fromKey);
    const to = this.tableColumns(tableId).find((item) => item.racKey === toKey);
    const patch =
      input && to && catalogColumnDropPatch(input[0].key, to.key, input[1]);
    if (patch && apply) this.setTableState(tableId, patch);
    return !!patch;
  }

  /**
   * ADR-315 Phase 4 증분 4c — what a drawn Column's filter dialog shows: the field kind, the
   * comparisons it may use, the Column's filter now, and its candidate values (`tableFacet` — the
   * rows the Table's other slices keep). Undefined = the Column takes no filter now.
   */
  tableColumnFilter(
    tableId: string,
    racKey: string,
  ): CatalogColumnFilterView | undefined {
    const input = this.columnMenuInput(tableId, racKey);
    if (!input?.[0].allowsFiltering || !input[0].filterOps?.length)
      return undefined;
    const [column, table] = input;
    const field = this.tableField(tableId, column.key)?.field;
    const condition = catalogFilterColumnCondition(
      table.state.filters,
      column.key,
    );
    const facet = this.tableFacet(tableId, column.key);
    return {
      kind: viewFieldKind(field?.type),
      ops: column.filterOps!,
      ...(condition ? { condition } : {}),
      ...(facet ? { facet } : {}),
    };
  }

  /**
   * ADR-315 Phase 4 증분 4c — a Column's filter dialog applied (`condition`) or cleared
   * (`undefined`): the one write of the Table's state (`catalogColumnFilterPatch`).
   */
  setTableColumnFilter(
    tableId: string,
    racKey: string,
    condition: Parameters<typeof catalogColumnFilterPatch>[2],
  ): void {
    const input = this.columnMenuInput(tableId, racKey);
    const patch = input && catalogColumnFilterPatch(...input, condition);
    if (patch) this.setTableState(tableId, patch);
  }

  /**
   * How a Table record's rows are served (`catalogTableSliceServable`'s reading): its bound
   * collection's endpoint, whether that reads `{{ sortDescriptor }}`, and its query format.
   */
  private tableService(tableId: string) {
    return this.host.collectionRowService(this.tableCollectionOf(tableId));
  }

  /** What of a slice a Table record accepts into its state (`catalogTableSliceServable`). */
  tableSliceServable(tableId: string, slice: CatalogTableServedSlice) {
    return catalogTableSliceServable(
      this.tableService(tableId),
      slice,
      this.tableAggregates(tableId),
    );
  }

  /**
   * The data field a bound Table's Column names (its key among the fields its rows have — the
   * collection's, or its view's result fields), with what the Table reads it through. Undefined =
   * not a bound Table's Column of a field.
   */
  private tableField(tableId: string, columnKey: string) {
    if (!this.tableColumns(tableId).some((column) => column.key === columnKey))
      return undefined;
    const read = this.tableRead(tableId);
    const field = read?.fields.find((item) => item.key === columnKey);
    return read && field ? { ...read, field } : undefined;
  }

  /**
   * What a bound Table reads its rows through: its binding, its collection, its authored view
   * chain (`base`) and the fields its rows have (the collection's, or its view's result fields).
   * Undefined = not a bound Table.
   */
  private tableRead(tableId: string) {
    const graph = this.host.graph;
    const table = this.host.currentRoot?.domInputs.get(tableId);
    const source = table && graph?.getEntry(table.sourceId as never);
    const binding = source?.kind === "node" ? source.binding : undefined;
    if (!graph || !table || !source || !binding) return undefined;
    const collectionId = dataCollectionIdOf(binding.collectionId);
    const collection = this.host.collections.find(
      (item) => item.id === collectionId,
    );
    const authored = catalogBindingQuery(
      graph,
      binding,
      source.id,
      this.host.stateSource(),
      undefined,
      componentInstancePath(table, source.id),
    );
    const base = authored ?? CATALOG_NO_VIEW_QUERY;
    const schema = (collection?.schema ?? []).flatMap((field) =>
      field.id && field.key
        ? [{ id: field.id, key: field.key, type: field.type }]
        : [],
    );
    const fields = base.queries.length
      ? viewSchemaAt({ queries: base.queries, schema }, base.queries.length)
      : schema;
    return { binding, collectionId, collection, base, fields };
  }

  /**
   * ADR-315 Phase 3 — a Table Column's candidate values (TanStack faceting): each value of the
   * Column's field among the rows the Table's other slices keep — its own filter aside — with the
   * rows it would give, and the least · most of them (a number · a date field). `partial` = the
   * rows here are not all of the data (an endpoint's pages · a server's answer): the candidates
   * are those of the loaded rows (breakdown §4.3.1 — 「불러온 N 행 기준」, `loaded`). Undefined =
   * not a bound Table's Column of a field.
   */
  tableFacet(
    tableId: string,
    columnKey: string,
  ): CatalogTableFacet | undefined {
    const read = this.tableField(tableId, columnKey);
    if (!read) return undefined;
    const fieldId = catalogFieldIdOf(read.fields, columnKey);
    if (!fieldId) return undefined;
    // (ADR-320 Decision 9 — the Column's own condition leaves; the author's on that field stays.)
    return this.recordFacet(
      tableId,
      fieldId,
      catalogColumnFilterConditionId(columnKey),
    );
  }

  /**
   * ADR-320 Phase 3 — a running filter bar's access (its record): the shown fields with the
   * comparisons its scope takes, the tree, its write, 「Clear」, a condition's candidate values (read
   * from the first of its lists). Undefined = not a connected bar.
   */
  filterBarAccess(barRecordId: string): CatalogFilterBarAccess | undefined {
    const graph = this.host.graph;
    const barId = this.host.currentRoot?.domInputs.get(barRecordId)?.sourceId;
    const entry = barId ? graph?.getEntry(barId as never) : undefined;
    if (!graph || entry?.kind !== "node" || !entry.filtersOf?.length)
      return undefined;
    // (One access a bar node — the run's subscriptions keep it across renders; it reads the
    //  bar's entry at each call, so an edit of the bar is read.)
    const held = this.barAccesses.get(entry.id);
    if (held) return held;
    const access = this.newFilterBarAccess(entry.id);
    this.barAccesses.set(entry.id, access);
    return access;
  }
  private readonly barAccesses = new Map<string, CatalogFilterBarAccess>();

  /** ADR-320 Phase 5 — a bar record's scope: its node id (none = not a connected bar). */
  private barOfRecord(barRecordId: string): string | undefined {
    return this.filterBarAccess(barRecordId)
      ? this.host.currentRoot?.domInputs.get(barRecordId)?.sourceId
      : undefined;
  }

  /** ADR-320 Phase 5 — the named state 「적용된 조건 수」 of a bar record (`appliedFilters`). */
  filterBarApplied(barRecordId: string): number {
    const barId = this.barOfRecord(barRecordId);
    return barId ? catalogFilterTreeApplied(this.scopes.tree(barId)).length : 0;
  }

  private ruleConditions = 0;
  /**
   * ADR-320 Phase 5 (§5.9) — a rule's Do on a bar: 「조건 넣기」 (`{ field, op, value }` — a field the
   * bar offers, a comparison it offers for that field), 「조건 지우기」 (the root conditions on a
   * field), 「전부 지우기」 (no condition). A condition the scope does not take is a failure, and the
   * tree stays as it was (§5.3 — not added to be left out).
   */
  filterBarDo(
    barRecordId: string,
    write: "add" | "remove" | "clear",
    value: unknown,
  ): { ok: boolean; reason?: string } {
    const barId = this.barOfRecord(barRecordId);
    const access = this.filterBarAccess(barRecordId);
    if (!barId || !access)
      return { ok: false, reason: "연결된 목록이 없는 필터 바" };
    const tree = this.scopes.tree(barId);
    const root = (items: readonly (ViewCondition | ViewConditionGroup)[]) =>
      items.length
        ? {
            id: tree?.id ?? CATALOG_FILTER_TREE_ID,
            op: "and" as const,
            items: [...items],
          }
        : null;
    const fieldId = (raw: unknown): DataFieldId | undefined =>
      typeof raw === "string" && raw
        ? ((raw.startsWith("data:field:")
            ? raw
            : `data:field:${raw}`) as DataFieldId)
        : undefined;
    if (write === "clear") {
      this.scopes.assign(barId, null, true);
      return { ok: true };
    }
    if (write === "remove") {
      const field = fieldId(value);
      if (!field) return { ok: false, reason: "필드가 없다" };
      const items = (tree?.items ?? []).filter(
        (item) =>
          "items" in item ||
          !item.fields.some((path) => path.length === 1 && path[0] === field),
      );
      this.scopes.assign(barId, root(items), true);
      return { ok: true };
    }
    const given =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const path = Array.isArray(given.field)
      ? given.field.map(fieldId)
      : [fieldId(given.field)];
    if (!path.length || path.some((step) => !step))
      return { ok: false, reason: "필드가 없다" };
    const offered = access
      .fields()
      .flatMap((field) => [field, ...(field.fields ?? [])])
      .find((field) => field.path.join("/") === path.join("/"));
    if (!offered)
      return {
        ok: false,
        reason: `필터 바가 내놓지 않는 필드: ${path.join(" › ")}`,
      };
    const op = given.op as ViewComparison;
    if (!offered.ops.includes(op))
      return {
        ok: false,
        reason: `${offered.label} 에 받지 않는 비교: ${String(given.op)}`,
      };
    this.ruleConditions += 1;
    const condition = catalogFilterTreeRead({
      id: CATALOG_FILTER_TREE_ID,
      op: "and",
      items: [
        {
          id: `filter-do-${this.ruleConditions}`,
          fields: [path],
          op,
          ...(given.value !== undefined ? { value: given.value } : {}),
          ...(given.unit !== undefined ? { unit: given.unit } : {}),
        },
      ],
    })?.items[0];
    if (!condition) return { ok: false, reason: "조건의 값이 맞지 않다" };
    const next = root([...(tree?.items ?? []), condition])!;
    if (!this.scopes.takes(barId, next))
      return {
        ok: false,
        reason: `목록의 데이터 공급 방식이 받지 못하는 조건: ${offered.label}`,
      };
    this.scopes.assign(barId, next, true);
    return { ok: true };
  }

  private newFilterBarAccess(barId: string): CatalogFilterBarAccess {
    const scopes = this.scopes;
    const read = (id: string) => this.host.graph?.getEntry(id as never);
    const barNow = () => {
      const entry = read(barId);
      return entry?.kind === "node" ? entry : undefined;
    };
    const takes = (tree: ViewConditionGroup) => scopes.takes(barId, tree);
    const fieldOf = (
      path: DataFieldId[],
      label: string,
      type: string | undefined,
      tree: ViewConditionGroup | undefined,
    ): CatalogFilterBarField => {
      const kind = viewFieldKind(type);
      return {
        path,
        label,
        kind,
        ops: catalogFilterBarFieldOps(path, kind, tree, takes),
      };
    };
    return {
      fields: () => {
        const bar = barNow();
        if (!bar) return [];
        const tree = scopes.tree(barId);
        return catalogFilterBarFieldList(bar, read).flatMap((field) => {
          if (field.hidden) return [];
          const path = [`data:field:${field.id}` as DataFieldId];
          const referenced = field.reference
            ? read(field.reference)
            : undefined;
          // (A reference field: its collection's fields, one level — a request carries no path
          //  through a reference, so a remote scope offers none of them.)
          const fields =
            referenced?.kind === "collection"
              ? referenced.schema
                  .flatMap((sub) =>
                    sub.id
                      ? [
                          fieldOf(
                            [...path, `data:field:${sub.id}` as DataFieldId],
                            `${field.label} › ${sub.label ?? sub.key}`,
                            sub.type,
                            tree,
                          ),
                        ]
                      : [],
                  )
                  .filter((sub) => sub.ops.length)
              : undefined;
          const own = fieldOf(path, field.label, field.type, tree);
          if (fields?.length) return [{ ...own, fields }];
          return own.ops.length ? [own] : [];
        });
      },
      tree: () => scopes.tree(barId),
      refused: () => scopes.refusedOf(barId),
      takes,
      write: (tree) => void scopes.assign(barId, tree),
      clear: () => void scopes.clear(barId),
      facet: (conditionId, path) => {
        if (path.length !== 1) return undefined;
        const lists = new Set<string>(barNow()?.filtersOf ?? []);
        for (const record of this.host.currentRoot?.domInputs.values() ?? [])
          if (lists.has(record.sourceId))
            return this.recordFacet(record.id, path[0]!, conditionId);
        return undefined;
      },
      subscribe: (listener) =>
        scopes.subscribe((change) => {
          if (change.barId === barId) listener();
        }),
    };
  }

  /**
   * ADR-320 Decision 9 — a bound record's candidate values of a field (a Table Column's dialog, a
   * filter bar's chip): each value among the rows its state keeps with the one condition being
   * edited (`skip` — its id, wherever it is in the scope's tree) left out, with the rows it would
   * give. `partial` = the loaded rows only. Undefined = not a bound record · a field its rows lack.
   */
  recordFacet(
    recordId: string,
    fieldId: DataFieldId,
    skip: string,
  ): CatalogTableFacet | undefined {
    const read = this.tableRead(recordId);
    if (!read) return undefined;
    const { binding, collectionId, collection, base, fields } = read;
    const field = fields.find(
      (item) => `data:field:${item.id.replace(/^data:field:/, "")}` === fieldId,
    );
    if (!field) return undefined;
    const columnKey = field.key;
    const remote = !!collection && !collection.useMockData;
    const partial =
      remote &&
      (this.host.loadArguments.get(collectionId)?.cursor !== undefined ||
        !!this.host.serverView(collectionId));
    const rows = catalogBoundRows(
      {
        ...binding,
        query: {
          ...base,
          // (The candidates are the loaded rows' by definition — `partial` says when they are not
          //  all of the data. Without it a remote collection's grouped view marks its counts as
          //  part of the data (`"13+"`, `partialAggregates`) and they read as 0 — 4c live.)
          loaded: { complete: !partial },
          queries: catalogTableFacetQueries(
            base.queries.length ? base.queries : undefined,
            catalogRowSlicesView(this.host.recordRowSlices(recordId), fields),
            fieldId,
            skip,
          ),
        },
      },
      this.host.itemSources(),
      "records",
    );
    if (!rows) return undefined;
    // (ADR-320 사용자 결정 9 — rows here that are not all of the data, from an endpoint that
    //  answers candidate values: the editor asks the server — the same chain, the edited
    //  condition left out.)
    const ask = partial ? this.host.serverFacet(collectionId) : undefined;
    const facetQuery = {
      ...base,
      queries: catalogTableFacetQueries(
        base.queries.length ? base.queries : undefined,
        catalogRowSlicesView(this.host.recordRowSlices(recordId), fields),
        fieldId,
        skip,
      ),
    };
    const server: CatalogTableFacet["server"] = ask
      ? (request, signal) =>
          ask(facetQuery, { field: columnKey, ...request }, signal)
      : undefined;
    const values = rows.map((row) => ({
      value: row.values[columnKey] ?? null,
      count: Number.parseInt(String(row.values[CATALOG_FACET_COUNT]), 10) || 0,
    }));
    // (The least · most: numbers by value, days by their text — ISO days order as text.)
    const kind = field.type === "number" ? "number" : field.type;
    const ordered =
      kind === "number"
        ? values
            .map((item) => Number(item.value))
            .filter(
              (number, index) =>
                values[index]!.value !== null && Number.isFinite(number),
            )
            .sort((a, b) => a - b)
        : kind === "date"
          ? values
              .map((item) => item.value)
              .filter((value): value is string => typeof value === "string")
              .sort()
          : [];
    return {
      values,
      ...(ordered.length
        ? { min: ordered[0], max: ordered[ordered.length - 1] }
        : {}),
      partial,
      loaded: this.host.collectionItems(collectionId).length,
      ...(server ? { server } : {}),
    };
  }

  /**
   * ADR-315 Phase 3 — a Table's search set as a value (a rule's 「Search text」 Do · the runtime
   * prop — a SearchField's `onChange` rule writes it): the state's `search`. A Table whose rows'
   * request carries no search keeps none (`tableShape`).
   */
  searchTable(tableId: string, text: unknown): void {
    this.setTableState(tableId, {
      search: typeof text === "string" ? text : "",
    });
  }

  /**
   * A Table record's rows read again for its state's data slices. `load` = the collection's load
   * state while a request for them runs (S2 `sorting` · `filtering`); `typing` = only the search
   * text changed — a request for it waits 300 ms (the newest text wins, as a view's text
   * condition does — `reloadForVariables`).
   */
  private readTableRows(
    tableId: string,
    state: CatalogTableState,
    load: "sorting" | "filtering" = "sorting",
    typing = false,
  ): void {
    // A bound Table whose query endpoint reads `sortDescriptor` is sorted by the server
    // (`load({sortDescriptor})`, the column as its field): the client keeps the server's order.
    const server = this.host.serverSort(tableId, state.sort?.[0]);
    if (server) {
      this.host.serverSortedTables.add(tableId);
      this.host
        .sortCollection(server.collectionId, server.sortDescriptor)
        .catch((error: unknown) =>
          console.warn("[CatalogPreview] 서버 정렬을 읽지 못했다:", error),
        );
      return;
    }
    this.host.serverSortedTables.delete(tableId);
    // (ADR-315 Phase 2 · 3 — a Table whose request carries its view: the state is that view's,
    //  another request — `loadRouted` loads when the request changed (S2 `sorting` · `filtering`).)
    if (this.tableService(tableId).remote) {
      clearTimeout(this.host.viewReloadTimer);
      if (typing)
        this.host.viewReloadTimer = setTimeout(
          () => this.host.loadRouted(load),
          300,
        );
      else this.host.loadRouted(load);
    }
    // (A local paged list in another order starts over at its first page; its Paginations follow —
    //  `pageRows` cannot tell: not every read of the list's rows carries its sort.)
    const entry = this.tableNodeEntry(tableId);
    if (entry?.binding) {
      const collectionId = entry.binding.collectionId;
      const unit =
        entry.rowDisplay?.mode === "pages" &&
        !this.host.remotePages(dataCollectionIdOf(collectionId))
          ? this.host.pageUnit(collectionId, entry.id)
          : undefined;
      if (unit && unit.page !== 1) {
        unit.page = 1;
        this.host.showPage(collectionId, entry.id);
        return;
      }
    }
    // (The sorted Table resolves again — its bound node alone: before, every bound owner of every
    //  root did, 2026-11-20. A record whose source holds no binding: every bound owner, as before
    //  — an authored Table's Rows are ordered by the DOM, `catalogTableSortedRows`.)
    // (ADR-315 Phase 3 — the state changes which rows show and their order, not a row's data: a
    //  row at its old place keeps its records, and a virtual Table's rows in view come first.)
    if (entry?.kind === "node" && entry.binding)
      this.host.stageRowWindows(entry.id);
    const errors =
      (entry?.kind === "node" && entry.binding
        ? this.host.currentRoot?.reorderRows(new Set([entry.id]))
        : this.host.currentRoot?.refreshRows()) ?? [];
    if (errors.length) console.error("[CatalogPreview] sort:", ...errors);
  }
}
