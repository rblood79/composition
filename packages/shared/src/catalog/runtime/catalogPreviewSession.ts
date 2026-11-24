import {
  CATALOG_GROUP_ROW_COUNT,
  catalogTableGroupKey,
  catalogTableGrouping,
} from "./tableRowSlices";
import {
  catalogRowGroupLevelView,
  catalogRowTotalsView,
  catalogTableGroupedQueries,
} from "./tableGroupQuery";
import { parseRuleValueRef } from "../../interactions/valueRef";
import { isInputVariable } from "../document/componentEvents";
import { componentInstancePath } from "./componentBoundaries";
import { resolveInputVariableAt } from "./inputVariable";
import type { CatalogGraph } from "../document/graph";
import {
  catalogRowDisplaySize,
  type BreakpointName,
  type CatalogLibrary,
  type CatalogRowDisplay,
  type EntryId,
  type NodeEntry,
} from "../document/types";
import type {
  CatalogBoundRow,
  CatalogBoundRows,
  CatalogRowWindow,
} from "../resolution/resolver";
import { definitionTypeName } from "../commands/context";
import {
  catalogPreviewSnapshotView,
  parseCatalogPreviewData,
  parseCatalogPreviewView,
  type CatalogPreviewSnapshotRequest,
} from "../preview/protocol";
import {
  CatalogPreviewReceiver,
  type CatalogPreviewReceipt,
} from "../preview/receiver";
import {
  CatalogCompositionRoot,
  type CatalogRootOptions,
} from "./compositionRoot";
import { CatalogRuntime } from "./controller";
import type { CatalogThemeState } from "./theme";
import { catalogBoundRows } from "./dataBinding";
import { COLLECTION_ROW_PROJECTION_WINDOW_LIMIT } from "../../collections/resolveCollectionItems";
import {
  catalogBindingQuery,
  catalogCountOnlyView,
  catalogCountlessViews,
  catalogRowQueryResolve,
  catalogRowQueryKey,
  type CatalogRowQuery,
} from "./viewQuery";
import { onFormulaEngineLoaded } from "../../collections/formula/engine";
import { onThemeLaddersLoaded } from "./themeLadders";
import { onSystemColorSchemeChange } from "./theme";
import {
  serializeViewQueries,
  VIEW_LOCAL_LOAD_CAP,
  type SerializedKeyRows,
  type SerializedViewQuery,
} from "../../collections/view/serialize";
import { viewSchemaAt } from "../../collections/view/evaluate";
import {
  VIEW_COMPARISONS_BY_KIND,
  viewFieldKind,
} from "../../collections/view/comparison";
import type { CatalogTableSort } from "./tableSort";
import type {
  CatalogLoadingState,
  CatalogViewResultMeta,
} from "../resolution/resolver";
import {
  createRuntimeState,
  type ApiEndpointDefinition,
  type CollectionDataServices,
  type CollectionDataSource,
  type DispatchDeps,
  type RuntimeKeyValueStorage,
  type RuntimeScope,
  type RuntimeStateHandle,
  type VariableDef,
} from "@composition/shared";
import {
  CATALOG_PARAMS_ROOT,
  catalogBindingKey,
  catalogRuntimeVariables,
  type CatalogStateSource,
} from "./stateTemplate";
import {
  catalogNotFoundPage,
  resolveCatalogRoute,
} from "./catalogPreviewRoute";
import type { LayoutEngineAPI } from "./layoutEngine";
import {
  createCollectionEndpointExecutor,
  createCollectionEndpointSubmitter,
  ENDPOINT_LOAD_ARGUMENTS,
  endpointReadsTemplate,
  loadCollectionEndpoint,
  type IntakeCollections,
  resolvedEndpointUrl,
} from "../../collections/executeCollectionEndpoint";
import {
  getItemKey,
  parentRowsToTree,
  resolveFieldRoles,
  resolveTableColumnKey,
  toItemProjectionRow,
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
  catalogRowSlicesView,
  catalogTableFacetQueries,
  catalogTableSliceServable,
  catalogTableStateQueries,
  catalogTableStateRowSlices,
  type CatalogRowSlices,
  type CatalogTableServedSlice,
} from "./tableStateQuery";
import type { CatalogListPosition } from "../../interactions/dispatcher";
import { catalogRuntimeData, type CatalogRuntimeData } from "./catalogData";
import { normalizeRows } from "../../collections/intake/normalizeRows";
import { intakeQueryItems } from "../../collections/intake/queryItems";
import { coerceDateText } from "../../state/dateValueEditing";

/**
 * The Preview's data services: the API endpoints only (bound collections draw their rows through
 * the root, not this context) — the old Preview's `createCollectionSnapshotServices` endpoint half.
 */
export function catalogPreviewDataServices(
  endpoints: ApiEndpointDefinition[],
  collections: IntakeCollections = [],
): CollectionDataServices {
  return {
    apiEndpointService: {
      getApiEndpoints: () => endpoints,
      executeApiEndpoint: createCollectionEndpointExecutor(
        endpoints,
        collections,
      ),
      submitApiEndpoint: createCollectionEndpointSubmitter(
        endpoints,
        collections,
      ),
    },
  };
}

/** The fields an item's key is read from (`getItemKey`) — an `update` never changes them. */
const ITEM_KEY_FIELDS = ["id", "key", "value"] as const;

/**
 * One `useListData` · `useTreeData` operation a rule ran on a collection (the Preview session's
 * record). `parent` · `toParent` are the tree's (`insert(parentKey, …)` · `move(key, toParentKey, …)`
 * — `null` / absent = the top level).
 */
type CatalogItemEdit =
  | { kind: "append"; item: Record<string, unknown>; parent?: string | null }
  | {
      kind: "insert";
      at: CatalogListPosition;
      item: Record<string, unknown>;
      parent?: string | null;
    }
  | { kind: "update"; key: string; patch: Record<string, unknown> }
  | { kind: "remove"; keys: readonly string[] | "all" }
  | {
      kind: "move";
      keys: readonly string[];
      to: Exclude<CatalogListPosition, "start">;
      toParent?: string | null;
    };

type CatalogItems = readonly Record<string, unknown>[];

const itemKey = (
  item: Record<string, unknown>,
  index: number,
  keyField?: string,
) => getItemKey(item, index, keyField ? { value: keyField } : undefined);

/** An item's child items (`useTreeData.getChildren` — the binding's children field), else none. */
function childItemsOf(
  item: Record<string, unknown>,
  childrenKey: string | undefined,
): CatalogItems | undefined {
  const children = childrenKey ? item[childrenKey] : undefined;
  return Array.isArray(children)
    ? children.filter(
        (child): child is Record<string, unknown> =>
          !!child && typeof child === "object",
      )
    : undefined;
}

/** Every key in the items (the tree's, every level), as the bound components read them. */
function itemKeysOf(
  items: CatalogItems,
  childrenKey?: string,
  keyField?: string,
): Set<string> {
  const keys = new Set<string>();
  const visit = (level: CatalogItems) =>
    level.forEach((item, index) => {
      keys.add(itemKey(item, index, keyField));
      const children = childItemsOf(item, childrenKey);
      if (children) visit(children);
    });
  visit(items);
  return keys;
}

/** The parent of the level holding `key` (`null` = the top level), else undefined. */
function levelOfKey(
  items: CatalogItems,
  key: string,
  childrenKey?: string,
  parent: string | null = null,
  keyField?: string,
): string | null | undefined {
  for (const [index, item] of items.entries()) {
    if (itemKey(item, index, keyField) === key) return parent;
    const children = childItemsOf(item, childrenKey);
    if (!children) continue;
    const found = levelOfKey(
      children,
      key,
      childrenKey,
      itemKey(item, index, keyField),
      keyField,
    );
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The items with one level (`parent` — `null` the top) replaced; undefined when no such parent. */
function withLevel(
  items: CatalogItems,
  parent: string | null,
  childrenKey: string | undefined,
  change: (level: CatalogItems) => CatalogItems,
  keyField?: string,
): CatalogItems | undefined {
  if (parent === null) return change(items);
  if (!childrenKey) return undefined;
  let found = false;
  const visit = (level: CatalogItems): CatalogItems =>
    level.map((item, index) => {
      if (found) return item;
      if (itemKey(item, index, keyField) === parent) {
        found = true;
        return {
          ...item,
          [childrenKey]: change(childItemsOf(item, childrenKey) ?? []),
        };
      }
      const children = childItemsOf(item, childrenKey);
      return children ? { ...item, [childrenKey]: visit(children) } : item;
    });
  const next = visit(items);
  return found ? next : undefined;
}

/** The items with `keep` applied at every level (the tree's — a key anywhere). */
function mapItems(
  items: CatalogItems,
  childrenKey: string | undefined,
  each: (
    item: Record<string, unknown>,
    index: number,
  ) => Record<string, unknown> | null,
): Record<string, unknown>[] {
  return items.flatMap((item, index) => {
    const kept = each(item, index);
    if (!kept) return [];
    const children = childItemsOf(kept, childrenKey);
    return [
      children
        ? { ...kept, [childrenKey!]: mapItems(children, childrenKey, each) }
        : kept,
    ];
  });
}

/** Where a position falls in a list of items (keys as `getItemKey` reads them), else -1. */
function positionIndex(
  items: CatalogItems,
  at: CatalogListPosition,
  keyField?: string,
): number {
  if (at === "start") return 0;
  if ("index" in at) return Math.min(at.index, items.length);
  const key = "before" in at ? at.before : at.after;
  const found = items.findIndex(
    (item, index) => itemKey(item, index, keyField) === key,
  );
  return found < 0 ? -1 : "before" in at ? found : found + 1;
}

/** The level a position names: a key's own level, else the given parent's (`null` the top). */
function levelOfPosition(
  items: CatalogItems,
  at: CatalogListPosition,
  parent: string | null | undefined,
  childrenKey: string | undefined,
  keyField?: string,
): string | null | undefined {
  if (at === "start" || "index" in at) return parent ?? null;
  return levelOfKey(
    items,
    "before" in at ? at.before : at.after,
    childrenKey,
    null,
    keyField,
  );
}

/**
 * The edits over a list of items, in order — keys as the bound components read them (`getItemKey`);
 * with a children field (`useTreeData`) at every level of the tree.
 */
function replayItemEdits(
  base: CatalogItems,
  edits: readonly CatalogItemEdit[],
  childrenKey?: string,
  keyField?: string,
): Record<string, unknown>[] {
  let items: CatalogItems = [...base];
  const at = (
    parent: string | null | undefined,
    change: (level: CatalogItems) => CatalogItems,
  ) => {
    if (parent === undefined) return;
    items = withLevel(items, parent, childrenKey, change, keyField) ?? items;
  };
  for (const edit of edits) {
    if (edit.kind === "append")
      at(edit.parent ?? null, (level) => [...level, edit.item]);
    else if (edit.kind === "insert")
      at(
        levelOfPosition(items, edit.at, edit.parent, childrenKey, keyField),
        (level) => {
          const index = positionIndex(level, edit.at, keyField);
          return index < 0
            ? level
            : [...level.slice(0, index), edit.item, ...level.slice(index)];
        },
      );
    else if (edit.kind === "move") {
      // (`move` · `moveBefore` · `moveAfter` — the moved items keep their order, from any level.)
      const keys = new Set(edit.keys);
      const moved: Record<string, unknown>[] = [];
      const rest = mapItems(items, childrenKey, (item, index) => {
        if (!keys.has(itemKey(item, index, keyField))) return item;
        moved.push(item);
        return null;
      });
      const level = levelOfPosition(
        rest,
        edit.to,
        edit.toParent,
        childrenKey,
        keyField,
      );
      const next =
        level === undefined
          ? undefined
          : withLevel(
              rest,
              level,
              childrenKey,
              (items) => {
                const index = positionIndex(items, edit.to, keyField);
                return index < 0
                  ? items
                  : [...items.slice(0, index), ...moved, ...items.slice(index)];
              },
              keyField,
            );
      if (next) items = next;
    } else if (edit.kind === "update")
      items = mapItems(items, childrenKey, (item, index) =>
        itemKey(item, index, keyField) === edit.key
          ? { ...item, ...edit.patch }
          : item,
      );
    else if (edit.keys === "all") items = [];
    else {
      const keys = new Set(edit.keys);
      items = mapItems(items, childrenKey, (item, index) =>
        keys.has(itemKey(item, index, keyField)) ? null : item,
      );
    }
  }
  return [...items];
}

/** Run the same Tree edit operations on flat rows, then persist the result as flat parent IDs. */
function replayFlatTreeEdits(
  base: CatalogItems,
  edits: readonly CatalogItemEdit[],
  parentField: string,
  keyField?: string,
): Record<string, unknown>[] {
  const childField = "__compositionFlatTreeChildren__";
  const nested = parentRowsToTree(
    base.map((item, index) =>
      toItemProjectionRow(
        item,
        index,
        keyField ? { value: keyField } : undefined,
      ),
    ),
    parentField,
  );
  const toItems = (nodes: typeof nested): Record<string, unknown>[] =>
    nodes.map(({ row, children }) => ({
      ...(row.item as Record<string, unknown>),
      [childField]: toItems(children),
    }));
  const edited = replayItemEdits(toItems(nested), edits, childField, keyField);
  const flat: Record<string, unknown>[] = [];
  const rawKey = (
    item: Record<string, unknown>,
  ): string | number | undefined => {
    for (const field of [keyField, "id", "key", "value"]) {
      if (!field) continue;
      const value = item[field];
      if ((typeof value === "string" && value) || typeof value === "number")
        return value;
    }
    return undefined;
  };
  const visit = (items: CatalogItems, parent: string | number | null) => {
    items.forEach((item, index) => {
      const { [childField]: children, ...rest } = item;
      flat.push({ ...rest, [parentField]: parent });
      if (Array.isArray(children))
        visit(
          children as Record<string, unknown>[],
          rawKey(item) ?? itemKey(item, index, keyField),
        );
    });
  };
  visit(edited, null);
  return flat;
}

export interface CatalogPreviewSessionOptions {
  /** Ask the Builder for a snapshot (`window.parent.postMessage(request, origin)`). */
  requestSnapshot: (request: CatalogPreviewSnapshotRequest) => void;
  /**
   * ADR-284 Decision 11 — the variables' current values for the Builder (`CATALOG_STATE_VALUES`):
   * a filter connection's detail reads what the running Preview holds, not the defaults.
   */
  reportState?: (values: Readonly<Record<string, unknown>>) => void;
  engine: () => LayoutEngineAPI;
  viewport: { width: number; height: number };
  locale?: string;
  /** The graph's theme (the Builder's rule); installed and shown when its key changes. */
  theme?: (graph: CatalogGraph) => CatalogThemeState;
  /** Show a theme: the DOM's CSS variables, color mode and base typography. */
  applyTheme?: (state: CatalogThemeState) => void;
  root?: Omit<CatalogRootOptions, "colorMode" | "rows" | "state">;
  /** Where persisted project variable values live (default `localStorage`; `null` = nowhere). */
  stateStorage?: RuntimeKeyValueStorage | null;
  /**
   * ADR-315 사용자 결정 1 — where a Table with 「Remember state」 keeps its state (a published app:
   * the browser's `localStorage`). Absent · `null` = nowhere — the Builder's Preview never keeps
   * it (a design check does not start from an earlier session's sort).
   */
  tableStateStorage?: RuntimeKeyValueStorage | null;
}

const NO_TABLE_STATE: CatalogTableState = Object.freeze({});
/** The query of a binding without a view (a Table's state — a sort · a search — gives it one). */
/** ADR-315 Phase 5 증분 5g — a pinned rows' answer's key: the Table node and its pins. */
const pinAnswerKey = (
  nodeId: string,
  pins: { readonly top: readonly string[]; readonly bottom: readonly string[] },
) => `${nodeId}\u0000${JSON.stringify([pins.top, pins.bottom])}`;
const NO_VIEW_QUERY: CatalogRowQuery = Object.freeze({
  queries: [],
  values: {},
  names: [],
});
/** A Table state without its sort (a Table its server sorts — the rows keep the server's order). */
function withoutSort(state: CatalogTableState): CatalogTableState | undefined {
  if (!state.sort) return state === NO_TABLE_STATE ? undefined : state;
  const { sort: _sort, ...rest } = state;
  return Object.keys(rest).length ? rest : undefined;
}

/**
 * ADR-248 4e-6 Preview: the iframe's catalog session. The replica graph comes from the Builder's
 * snapshot and deltas (`CatalogPreviewReceiver` — stale and gapped messages never apply); a read
 * only runtime and a composition root over it take each delta as a `sync` step, so the DOM binding
 * reads the records the Builder's root reads; bound collections draw the rows of the collections
 * the Builder sends (`CATALOG_DATA`). `{{ name }}` shows the runtime values of the variables
 * (ADR-214 value model — the shared runtime state: page values reset on entering the page, element
 * values per drawn record, persisted project values); a `setState` rule writes them. The page shown
 * follows the Builder's page until the Preview navigates. A theme change (a delta touching the theme) builds a new root in the new
 * theme, as the Builder's workspace does.
 */
export class CatalogPreviewSession {
  private readonly receiver: CatalogPreviewReceiver;
  private runtime: CatalogRuntime | undefined;
  private currentRoot: CatalogCompositionRoot | undefined;
  private themeKey: string | undefined;
  private colorMode: "light" | "dark" | undefined;
  /** The editor's breakpoint (`CATALOG_VIEW`): the root resolves the responsive layers at it. */
  private breakpoint: BreakpointName = "desktop";
  private shownPage: EntryId<"page"> | undefined;
  /** The editor's page a snapshot carried (ADR-307 후속 — the first root is built at it). */
  private snapshotPage: EntryId<"page"> | undefined;
  /**
   * ADR-286 — the API rows the Builder sends (`CATALOG_DATA`, by collection id): the document's
   * collections (`catalogRuntimeData`) show them. Never the document.
   */
  private runtimeRows = new Map<string, Record<string, unknown>[]>();
  /** The document's collections with the Builder's API rows: bound collections draw from them. */
  private get collections(): readonly CollectionDataSource[] {
    return this.data().collections;
  }
  private data(): CatalogRuntimeData {
    const graph = this.receiver.graph;
    return graph
      ? catalogRuntimeData(graph, this.runtimeRows)
      : { collections: [], apiEndpoints: [], variables: [] };
  }
  /**
   * ADR-281 user decision 3, second step — what `append` · `update` · `remove` rules did, by
   * collection id, in order (`useListData`'s operations): session state (a reload drops it, the
   * author's data never sees it), replayed over the Builder's items each time they come
   * (`itemSources`).
   */
  private readonly itemEdits = new Map<string, CatalogItemEdit[]>();
  /**
   * `useAsyncList.reload()` — the items a `reload` rule loaded, by collection id: they replace the
   * Builder's API items until the Builder sends other ones (`receive`).
   */
  private readonly reloadedItems = new Map<string, Record<string, unknown>[]>();
  /**
   * ADR-310 Decision 10 「더 보기」 — each bound list's display window (the rows its DOM lays out),
   * by collection id + the bound node: it starts at the projection window and grows by one window
   * when the list's end is seen (`showMore`). A reload · filter · sort starts it over.
   */
  private readonly displayWindows = new Map<string, number>();
  /**
   * A virtual-scrolled Table's row window (2026-11-19) — where its record rows start, by the bound
   * node's resolved identity (`instancePath::nodeId`). Its other rows are keyed Rows without content
   * in the DOM; one of those drawn moves the window (`showRows`). Absent = it starts at the first row.
   */
  private readonly rowWindows = new Map<string, CatalogRowWindow>();
  /** The rows last reported in view and not yet read (`showRows`), by owner. */
  private readonly rowsAsked = new Map<
    string,
    { first: number; last: number; total: number }
  >();
  /** The rows last reported in view (`showRows`), by owner — what a staged window holds. */
  private readonly rowsSeen = new Map<
    string,
    { first: number; last: number }
  >();
  /**
   * ADR-315 Phase 3 — the windows cut to the rows in view until the frame paints
   * (`stageRowWindows`), by owner; `turn` tells the latest staging from one a later keystroke
   * replaced.
   */
  private readonly stagedRowWindows = new Map<
    string,
    CatalogRowWindow & { readonly turn: number }
  >();
  private stagedTurn = 0;
  /** The lists whose last delivered rows stopped at their window with more rows loaded (by window key). */
  private readonly windowsCut = new Set<string>();
  /**
   * ADR-310 Phase 7 (Decision 12) — each paged list's query unit (collection + list node, the
   * display window's key): its page, and for a remote collection its own loaded items · total ·
   * cursors · request — a page list's answer never changes the collection's loaded items (the
   * 「더 보기」 lists').
   */
  private readonly pageUnits = new Map<string, CatalogPageUnit>();
  /** The Paginations that page each list (they re-resolve on a page change). */
  private readonly paginationsOf = new Map<string, Set<string>>();
  /** The Builder's API items last received, by collection id (a change drops a reload's). */
  private readonly receivedItems = new Map<string, string>();
  /** The project's API endpoints (each query endpoint names the collection it fills). */
  private get endpoints(): readonly ApiEndpointDefinition[] {
    return this.data().apiEndpoints;
  }
  /**
   * The URL each collection was last loaded from — a query endpoint whose path · query read
   * `{{ params.id }}` loads again only when the shown path gives another URL (`loadRouted`).
   */
  private readonly loadedUrls = new Map<string, string>();
  /**
   * `useAsyncList`'s load arguments by collection id — `cursor` (the next page the last load
   * gave), `filterText` (`setFilterText`), `sortDescriptor` (a bound Table's sort): what the query
   * endpoint's templates read.
   */
  private readonly loadArguments = new Map<
    string,
    { cursor?: string; filterText?: string; sortDescriptor?: CatalogTableSort }
  >();
  /** Each collection's latest load — an older one's answer is dropped (the newer text wins). */
  private readonly loadSequence = new Map<string, number>();
  /** Each collection's load in flight — a newer load aborts it (`useAsyncList` `signal`). */
  private readonly loadControllers = new Map<string, AbortController>();
  /**
   * ADR-284 Decision 3 — the total the server gave for a collection's current query (its whole
   * count, `responseMapping.totalPath`); absent = not known. A new query drops it.
   */
  private readonly loadTotals = new Map<string, number>();
  /** ADR-284 — a variable write that a text condition reads loads again after a pause. */
  private viewReloadTimer: ReturnType<typeof setTimeout> | undefined;
  /** Collections the session loads only for the view their request carries. */
  private readonly viewLoaded = new Set<string>();
  /** The resolved view the accepted API rows answer (never the next request's view). */
  private readonly loadedViewQueries = new Map<string, CatalogRowQuery>();
  /** Tables the server sorts (their endpoint reads `sortDescriptor`) — no client sort on them. */
  private readonly serverSortedTables = new Set<string>();
  /** The session is telling its view a Table's sort (`echoTableSort`) — not a sort being set. */
  private echoing = false;
  /** ADR-315 Phase 4 — a column width written by RAC's own resize (`resizeTableColumns`). */
  private resizing = false;
  private widthsRevision = 0;
  /** Each collection's load (`useAsyncList.loadingState`) — what a bound Table · Skeleton shows. */
  private readonly loadingStates = new Map<string, CatalogLoadingState>();
  /** Endpoint submits in flight — a `reload` waits for them (`await fetch; list.reload()`). */
  private readonly pendingSubmits = new Set<Promise<unknown>>();
  /**
   * ADR-315 — each Table record's grid state (runtime, never the document): the one place its
   * slices live (it was `tableSorts`, the sort alone — ADR-257 Phase 4). Columns by Column key.
   */
  private readonly tableStates = new Map<string, CatalogTableState>();
  /** Table records whose remembered state was looked up (once a record, a project). */
  private readonly restoredTables = new Set<string>();
  /** Each Table record's authored `searchText` the state last took (`startTableSearches`). */
  private readonly searchedTables = new Map<string, string>();
  /** A root built · a page filled since the last look (`restoreTableStates`). */
  private restoreDue = true;
  /** Writes a record's runtime props (the view's rule runtime — `attachRuntimeProps`). */
  private runtimePropsWriter:
    | ((id: string, patch: Readonly<Record<string, unknown>>) => void)
    | undefined;
  /** Restored Tables whose sort RAC has not been told (no rule runtime yet). */
  private readonly pendingSortEchoes = new Set<string>();
  /**
   * ADR-315 Phase 4 — the column choosers of each Table node (`columnsOf` — they re-resolve when
   * its columns change) and the columns each last listed (their signature).
   */
  private readonly columnChoosers = new Map<string, Set<string>>();
  private readonly chooserColumnsSeen = new Map<string, string>();
  /** The selection each chooser Menu record was last told (an unchanged one is not written). */
  private readonly chooserEchoed = new Map<string, string>();
  /** The project variables (the document's — ADR-286). */
  private get variables(): readonly VariableDef[] {
    return this.data().variables;
  }
  /**
   * The project's API endpoints as the shared components read them (`CollectionDataContext`):
   * FileUpload resolves its endpoint id here, an API-bound collection runs its endpoint. A new
   * object when the endpoints change (`syncServices`).
   */
  private services: CollectionDataServices = catalogPreviewDataServices([]);
  private servicesOf: readonly ApiEndpointDefinition[] = [];
  private syncServices(): void {
    const endpoints = this.endpoints;
    if (endpoints === this.servicesOf) return;
    this.servicesOf = endpoints;
    this.services = catalogPreviewDataServices(
      endpoints as ApiEndpointDefinition[],
      // (ADR-313 — the intake reads the collections as they are at each run.)
      () => this.collections,
    );
  }
  private state: RuntimeStateHandle | undefined;
  private version = 0;
  private readonly listeners = new Set<() => void>();

  constructor(
    library: CatalogLibrary,
    private readonly options: CatalogPreviewSessionOptions,
  ) {
    this.receiver = new CatalogPreviewReceiver(
      library,
      options.requestSnapshot,
      (_graph, ops) => this.currentRoot!.sync(ops),
    );
    // (ADR-291 — computed cells read before the formula engine loaded were `null`: read again.)
    onFormulaEngineLoaded(() => {
      const errors = this.currentRoot?.refreshRows() ?? [];
      if (errors.length) console.error("[CatalogPreview] formula:", ...errors);
      this.changed();
    });
    // (ADR-302 — a non-default theme read before its ladder chunk loaded was the seed: apply it again.)
    const reapplyTheme = () => {
      if (!this.runtime || !this.applyTheme(false)) return;
      this.currentRoot = this.createRoot();
      this.changed();
    };
    onThemeLaddersLoaded(reapplyTheme);
    // (A `system` theme follows the OS switching appearance while the page is open.)
    onSystemColorSchemeChange(reapplyTheme);
    this.receiver.subscribe((update) => {
      this.syncServices();
      if (update.invalidatedIds === "all") {
        this.runtime = new CatalogRuntime(update.graph);
        this.restoredTables.clear();
        this.searchedTables.clear();
        this.stagedRowWindows.clear();
        this.rowsSeen.clear();
        this.openState(update.graph.projectId);
        this.syncDefinitions();
        this.applyTheme(true);
        this.currentRoot = this.createRoot();
        this.reportState();
      } else {
        this.syncDefinitions();
        if (this.applyTheme(false)) this.currentRoot = this.createRoot();
        // (The shown page removed: the page shown now — the project's first — may be a shell.)
        else this.fillShown();
      }
      // (ADR-284: a view bound · changed in the document is another request for its endpoint.)
      this.loadRouted();
      this.changed();
    });
  }

  get root(): CatalogCompositionRoot | undefined {
    return this.currentRoot;
  }
  get graph(): CatalogGraph | undefined {
    return this.receiver.graph;
  }
  /** The data services the Preview's components read (a new object when the Builder sends data). */
  get dataServices(): CollectionDataServices {
    return this.services;
  }
  /** Changes whenever what the view shows may change (a `useSyncExternalStore` snapshot). */
  getVersion = (): number => this.version;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /**
   * One message from the Builder: a catalog payload or the editor's page. Returns the receipt of a
   * payload (`ignored` for anything else).
   */
  receive(value: unknown): CatalogPreviewReceipt {
    const view = parseCatalogPreviewView(value);
    if (view) {
      const breakpoint = view.breakpoint ?? "desktop";
      if (breakpoint !== this.breakpoint) {
        this.breakpoint = breakpoint;
        if (this.runtime) {
          this.currentRoot = this.createRoot();
          this.changed();
        }
      }
      this.navigate(view.pageId);
      return { kind: "ignored" };
    }
    const data = parseCatalogPreviewData(value);
    if (data) {
      // ADR-286 R7: the message carries API rows only — the definitions are the document's.
      const rows = new Map<string, Record<string, unknown>[]>();
      for (const item of data.collections) {
        const id = item.id;
        if (typeof id !== "string" || !Array.isArray(item.runtimeData))
          continue;
        rows.set(id, item.runtimeData as Record<string, unknown>[]);
      }
      this.runtimeRows = rows;
      // Items the Builder loaded again replace a `reload`'s (the newer load wins).
      for (const collection of this.collections) {
        if (!collection.id) continue;
        const received = JSON.stringify(collection.runtimeData ?? null);
        if (
          this.receivedItems.has(collection.id) &&
          this.receivedItems.get(collection.id) !== received
        ) {
          this.reloadedItems.delete(collection.id);
          this.loadedViewQueries.delete(collection.id);
        }
        this.receivedItems.set(collection.id, received);
      }
      this.syncServices();
      this.syncDefinitions();
      if (this.currentRoot) {
        const errors = [
          ...this.currentRoot.refreshRows(),
          // A project variable added or renamed: every template reads by name.
          ...this.currentRoot.refreshState(),
        ];
        if (errors.length) console.error("[CatalogPreview] data:", ...errors);
      }
      this.loadRouted();
      this.changed();
      return { kind: "ignored" };
    }
    // (ADR-307 후속: the first root is built at the editor's page and breakpoint.)
    const opening = catalogPreviewSnapshotView(value);
    if (opening) {
      this.snapshotPage = opening.pageId;
      this.breakpoint = opening.breakpoint ?? "desktop";
    }
    return this.receiver.receive(value);
  }
  /** Ask for a snapshot (the Preview document just loaded). */
  request(): void {
    this.receiver.request();
  }

  /** The page shown: the one navigated to, else the project's first page. */
  get pageId(): EntryId<"page"> | undefined {
    const graph = this.graph;
    if (!graph) return undefined;
    if (this.shownPage && graph.getEntry(this.shownPage)?.kind === "page")
      return this.shownPage;
    const project = graph.getEntry(graph.projectId);
    return project?.kind === "project" ? project.pageIds[0] : undefined;
  }
  private currentPath: string | undefined;
  get path(): string | undefined {
    const page = this.pageId && this.graph?.getEntry(this.pageId);
    return (
      this.currentPath ??
      (page && page.kind === "page" ? page.route : undefined)
    );
  }
  navigate(pageId: EntryId<"page">, path?: string): void {
    const page = this.graph?.getEntry(pageId);
    if (page?.kind !== "page") return;
    const samePage = pageId === this.shownPage;
    const nextPath = path ?? (samePage ? this.currentPath : page.route);
    if (samePage && !this.notFoundPath && nextPath === this.currentPath) return;
    this.shownPage = pageId;
    this.currentPath = nextPath;
    this.notFoundPath = undefined;
    if (!samePage) this.state?.enterPage(pageId);
    this.fillShown();
    // Another path (`/detail/u1` → `/detail/u2`, or into the page): the `{{ params.… }}` readers
    // resolve again.
    if (this.currentRoot) {
      const errors = this.currentRoot.refreshState(
        new Set([CATALOG_PARAMS_ROOT]),
      );
      if (errors.length) console.error("[CatalogPreview] params:", ...errors);
    }
    this.loadRouted();
    this.changed();
  }
  /**
   * The page a new root builds in full: the one shown, else the editor's page the snapshot carried
   * (the `CATALOG_VIEW` that moves the Preview there comes after it), else the project's first.
   */
  private openingPage(): string | undefined {
    const graph = this.graph;
    const valid = (pageId: EntryId<"page"> | undefined) =>
      pageId && graph?.getEntry(pageId)?.kind === "page" ? pageId : undefined;
    return valid(this.shownPage) ?? valid(this.snapshotPage) ?? this.pageId;
  }
  /**
   * ADR-307 후속 (F10): the shown page's roots in full — a page built as a shell (not the page
   * shown when the root was built) fills when it is shown, and stays filled. A fill that fails is
   * tried again each time (the page shows its shell meanwhile).
   */
  private fillShown(): void {
    this.restoreDue = true;
    const root = this.currentRoot;
    const pageId = this.pageId;
    if (!root || !pageId || !root.hasPendingFill) return;
    for (const rootId of root.pendingFillRoots({ failed: true })) {
      if (root.pageOfRoot(rootId) !== pageId) continue;
      const report = root.fill(rootId, { retryFailed: true });
      if (report.errors.length)
        console.error("[CatalogPreview] page fill:", ...report.errors);
    }
  }
  /** The shown path's route params (`:id` segments of the page's route — `{{ params.id }}`). */
  get params(): Readonly<Record<string, string>> {
    const graph = this.graph;
    const path = this.path;
    return (graph && path && resolveCatalogRoute(graph, path)?.params) || {};
  }
  /** The path an internal link or a navigate action asked for and no page answers to. */
  private notFoundPath: string | undefined;
  get notFound(): string | undefined {
    return this.notFoundPath;
  }
  /**
   * Go to a path (an internal link, a `navigate` action — the old router): the page whose route
   * is the path or fits it with `:param` segments; none = the project's `/404` page, else the
   * built-in not-found view (`notFound`). Returns whether a page answered.
   */
  navigateTo(path: string): boolean {
    const graph = this.graph;
    if (!graph) return false;
    const match = resolveCatalogRoute(graph, path);
    if (match) {
      this.navigate(match.pageId, path);
      return true;
    }
    const fallback = catalogNotFoundPage(graph);
    if (fallback) {
      this.navigate(fallback, path);
      return false;
    }
    if (this.notFoundPath !== path) {
      this.notFoundPath = path;
      this.currentPath = path;
      this.changed();
    }
    return false;
  }

  /** A variable's runtime value (`undefined` before a snapshot). */
  readState(variableId: string, scope: RuntimeScope): unknown {
    return this.state?.read(variableId, scope);
  }
  /**
   * A `setState` rule's write. An element variable's value lives under the record that draws its
   * owner in the trigger's render context (`instanceKeyFor`), else the owner's first record.
   */
  writeState: NonNullable<DispatchDeps["writeState"]> = ({
    variableId,
    op,
    value,
    instanceKeyFor,
  }) => {
    const scope = this.variableScope(variableId, instanceKeyFor);
    if ("reason" in scope) return { ok: false, reason: scope.reason };
    const result = this.state!.write({
      variableId,
      op,
      value,
      scope: scope.scope,
    });
    return result.ok
      ? { ok: true }
      : { ok: false, reason: result.reason ?? "setState 실패" };
  };
  /** A variable's current value as a rule reads it (`!var.<id>` — the scope `writeState` writes). */
  readVariable: NonNullable<DispatchDeps["readState"]> = ({
    variableId,
    instanceKeyFor,
  }) => {
    const scope = this.variableScope(variableId, instanceKeyFor);
    return "reason" in scope
      ? undefined
      : { value: this.state!.read(variableId, scope.scope) };
  };
  /**
   * The scope a variable's value lives in. An element variable's value lives under the record that
   * draws its owner in the trigger's render context (`instanceKeyFor`), else the owner's first record.
   */
  private variableScope(
    variableId: string,
    instanceKeyFor: ((ownerElementId: string) => string) | undefined,
  ): { scope: RuntimeScope } | { reason: string } {
    const definition = this.state?.getDefinition(variableId);
    if (!this.state || !definition)
      return { reason: `변수 없음: ${variableId}` };
    const owner = definition.owner;
    if (owner.kind === "element") {
      const key = instanceKeyFor?.(owner.elementId);
      const instanceKey =
        key && this.currentRoot?.domInputs.has(key)
          ? key
          : this.currentRoot?.recordsOfSource(owner.elementId)[0];
      if (!instanceKey)
        return { reason: `변수 소유 요소 없음: ${owner.elementId}` };
      return { scope: { kind: "element", instanceKey } };
    }
    return {
      scope:
        owner.kind === "page"
          ? { kind: "page", pageId: owner.pageId }
          : { kind: "project" },
    };
  }
  /**
   * ADR-257 Phase 4 — a Table's Preview sort (RAC `onSortChange`; undefined = the document's
   * order). A bound Table's rows are sorted by the resolver before its height takes them, so the
   * bound roots resolve again.
   */
  /**
   * ADR-281 Decision 6 — show the theme in a color mode a rule set (a page root's `colorScheme`):
   * the same `applyTheme` with the mode replaced, so the CSS variable sets stay the theme's.
   */
  setColorScheme(mode: "light" | "dark"): void {
    const graph = this.runtime?.graph;
    const state = graph ? this.options.theme?.(graph) : undefined;
    if (!state || this.colorMode === mode) return;
    this.colorMode = mode;
    this.options.applyTheme?.({ ...state, colorMode: mode });
  }

  /** The collections as the bound components read them: the Builder's items with the edits replayed. */
  private itemSources(
    /** ADR-310 Phase 7 — a page list's own loaded items (its query unit), in place of the collection's. */
    loaded?: ReadonlyMap<string, Record<string, unknown>[]>,
  ): readonly CollectionDataSource[] {
    if (!this.itemEdits.size && !this.reloadedItems.size && !loaded?.size)
      return this.collections;
    return this.collections.map((source) => {
      const reloaded =
        source.id &&
        (loaded?.get(source.id) ?? this.reloadedItems.get(source.id));
      const collection = reloaded
        ? { ...source, runtimeData: reloaded }
        : source;
      const edits = collection.id && this.itemEdits.get(collection.id);
      if (!edits) return collection;
      // (The items the snapshot shows — `resolveCollectionSnapshot`: mock when `useMockData`, else
      // the API's items, else mock.)
      const api = !collection.useMockData && !!collection.runtimeData;
      const base = (api ? collection.runtimeData : collection.mockData) ?? [];
      const parentField = this.parentIdKeyOf(collection.id);
      const keyField = this.treeFieldKeyOf(collection.id, "value");
      const items = parentField
        ? replayFlatTreeEdits(base, edits, parentField, keyField)
        : replayItemEdits(
            base,
            edits,
            this.childrenKeyOf(collection.id),
            keyField,
          );
      return api
        ? { ...collection, runtimeData: items }
        : { ...collection, mockData: items };
    });
  }
  /** A collection's items as the Preview shows them (the rules' edits included). */
  collectionItems(collectionId: string): readonly unknown[] {
    const collection = this.itemSources().find(
      (item) => item.id === collectionId,
    );
    if (!collection) return [];
    return !collection.useMockData && collection.runtimeData
      ? collection.runtimeData
      : (collection.mockData ?? []);
  }
  /**
   * `useListData.getItem(key)` for each key (in key order; `"all"` = every item shown): the items as
   * the Preview shows them, keyed as the bound components key them (`getItemKey` with the binding's
   * value field) — a tree's children included.
   */
  itemsByKeys(
    collectionId: string,
    keys: readonly string[] | "all",
  ): readonly unknown[] {
    const items = this.collectionItems(collectionId) as CatalogItems;
    if (keys === "all") return items;
    const keyField = this.treeFieldKeyOf(collectionId, "value");
    const childrenField = this.childrenKeyOf(collectionId);
    const byKey = new Map<string, unknown>();
    const visit = (level: CatalogItems) =>
      level.forEach((item, index) => {
        byKey.set(itemKey(item, index, keyField), item);
        const children = childrenField ? item[childrenField] : undefined;
        if (Array.isArray(children)) visit(children as CatalogItems);
      });
    visit(items);
    return keys.flatMap((key) => (byKey.has(key) ? [byKey.get(key)] : []));
  }
  /**
   * The schema's fields of a rule's value, in the collection's stored values (ADR-313 Decision 4 — a
   * Form's values are texts: the text rule reads them by the field's type and notation; values that
   * already have a type are kept). A collection without a schema takes every field.
   */
  private itemFields(
    collection: CollectionDataSource,
    value: Readonly<Record<string, unknown>>,
  ): Record<string, unknown> {
    const schema = collection.schema ?? [];
    const keys = new Set(schema.map((field) => field.key));
    const next: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value))
      if (!schema.length || keys.has(key)) next[key] = field;
    if (!schema.length) return next;
    return normalizeRows([next], schema, "text", {
      readDateText: coerceDateText,
    }).rows[0] as Record<string, unknown>;
  }
  private edit(
    collectionId: string,
    plan: (
      collection: CollectionDataSource,
      items: readonly unknown[],
    ) => CatalogItemEdit | { reason: string },
  ): { ok: boolean; reason?: string } {
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    if (!collection)
      return { ok: false, reason: `collection 없음: ${collectionId}` };
    const edit = plan(collection, this.collectionItems(collectionId));
    if ("reason" in edit) return { ok: false, reason: edit.reason };
    this.itemEdits.set(collectionId, [
      ...(this.itemEdits.get(collectionId) ?? []),
      edit,
    ]);
    const errors = this.currentRoot?.refreshRows() ?? [];
    if (errors.length)
      console.error(`[CatalogPreview] ${edit.kind}:`, ...errors);
    this.changed();
    return { ok: true };
  }
  /**
   * `useListData.append(value)` — the value's schema fields, with an `id` when the schema has one
   * and the value does not. Every component bound to the collection shows it at once.
   */
  append(
    collectionId: string,
    value: Readonly<Record<string, unknown>>,
    parentKey?: string | null,
  ): { ok: boolean; reason?: string } {
    return this.edit(collectionId, (collection, items) => {
      const missing = this.missingParent(collectionId, items, parentKey);
      if (missing) return missing;
      const item = this.itemFields(collection, value);
      if (
        (collection.schema ?? []).some((field) => field.key === "id") &&
        (item.id === undefined || item.id === "")
      )
        item.id = `item-${Date.now().toString(36)}-${(this.itemSerial += 1)}`;
      return parentKey == null
        ? { kind: "append", item }
        : { kind: "append", item, parent: parentKey };
    });
  }
  /**
   * `useListData.insert(index, …)` · `insertBefore(key, …)` · `insertAfter(key, …)` · `prepend(…)`
   * — the value's schema fields as one item there (a new `id` when the schema has one and the value
   * none, as `append`); an unknown key is reported.
   */
  insert(
    collectionId: string,
    at: CatalogListPosition,
    value: Readonly<Record<string, unknown>>,
    parentKey?: string | null,
  ): { ok: boolean; reason?: string } {
    return this.edit(collectionId, (collection, items) => {
      const missing = this.missingParent(collectionId, items, parentKey);
      if (missing) return missing;
      if (
        typeof at === "object" &&
        !("index" in at) &&
        !this.keysOf(collectionId, items).has(
          "before" in at ? at.before : at.after,
        )
      )
        return {
          reason: `항목 없음: ${"before" in at ? at.before : at.after}`,
        };
      const item = this.itemFields(collection, value);
      if (
        (collection.schema ?? []).some((field) => field.key === "id") &&
        (item.id === undefined || item.id === "")
      )
        item.id = `item-${Date.now().toString(36)}-${(this.itemSerial += 1)}`;
      return parentKey == null
        ? { kind: "insert", at, item }
        : { kind: "insert", at, item, parent: parentKey };
    });
  }
  /**
   * `useListData.move(key, toIndex)` · `moveBefore(key, keys)` · `moveAfter(key, keys)` — the items
   * to the position, in their order; an unknown key is reported.
   */
  move(
    collectionId: string,
    keys: readonly string[],
    to: Exclude<CatalogListPosition, "start">,
    toParentKey?: string | null,
  ): { ok: boolean; reason?: string } {
    return this.edit(collectionId, (_collection, items) => {
      const missingParent = this.missingParent(
        collectionId,
        items,
        toParentKey,
      );
      if (missingParent) return missingParent;
      if (toParentKey != null && keys.includes(toParentKey))
        return { reason: `옮길 항목 ${toParentKey} 가 새 부모다` };
      const present = this.keysOf(collectionId, items);
      const target =
        "index" in to ? undefined : "before" in to ? to.before : to.after;
      const missing = [
        ...keys,
        ...(target === undefined ? [] : [target]),
      ].filter((key) => !present.has(key));
      if (!keys.length) return { reason: "옮길 항목의 key 가 없다" };
      if (missing.length) return { reason: `항목 없음: ${missing.join(", ")}` };
      if (target !== undefined && keys.includes(target))
        return { reason: `옮길 항목 ${target} 가 기준 항목이다` };
      return toParentKey == null
        ? { kind: "move", keys, to }
        : { kind: "move", keys, to, toParent: toParentKey };
    });
  }
  /**
   * `useListData.update(key, newValue)` — the item whose key is `key` (absent = the value's `id`)
   * takes the value's schema fields; its key fields stay. An unknown key is reported. `fieldId`
   * (ADR-284 Phase 5) names the one field the value's `fieldId` entry writes.
   */
  update(
    collectionId: string,
    key: string | undefined,
    value: Readonly<Record<string, unknown>>,
    fieldId?: string,
  ): { ok: boolean; reason?: string } {
    return this.edit(collectionId, (collection, items) => {
      const target =
        key ?? (value.id === undefined ? undefined : String(value.id));
      if (target === undefined) return { reason: "수정할 항목의 key 가 없다" };
      if (!this.keysOf(collectionId, items).has(target))
        return { reason: `항목 없음: ${target}` };
      let fields = value;
      if (fieldId !== undefined) {
        const field = (collection.schema ?? []).find(
          (item) => item.id === fieldId,
        );
        if (!field) return { reason: `필드 없음: ${fieldId}` };
        fields = { [field.key]: value[fieldId] };
      }
      const patch = this.itemFields(collection, fields);
      for (const field of ITEM_KEY_FIELDS) delete patch[field];
      const valueField = this.treeFieldKeyOf(collectionId, "value");
      if (valueField) delete patch[valueField];
      return { kind: "update", key: target, patch };
    });
  }
  /** `useListData.remove(...keys)` — `"all"` removes every item; an unknown key is reported. */
  remove(
    collectionId: string,
    keys: readonly string[] | "all",
  ): { ok: boolean; reason?: string } {
    return this.edit(collectionId, (_collection, items) => {
      if (keys !== "all") {
        const present = this.keysOf(collectionId, items);
        const missing = keys.filter((key) => !present.has(key));
        if (!keys.length) return { reason: "삭제할 항목의 key 가 없다" };
        if (missing.length)
          return { reason: `항목 없음: ${missing.join(", ")}` };
      }
      return { kind: "remove", keys };
    });
  }
  private itemSerial = 0;
  /** A bound Tree role's schema key, if that collection has the role mapped. */
  private treeFieldKeyOf(
    collectionId: string | undefined,
    role: "children" | "parentId" | "value",
  ): string | undefined {
    const graph = this.graph;
    if (!graph || !collectionId) return undefined;
    const schema =
      this.collections.find((item) => item.id === collectionId)?.schema ?? [];
    for (const id of graph.bindingsOf(`data:collection:${collectionId}`)) {
      const entry = graph.getEntry(id as never);
      const field =
        entry?.kind === "node" ? entry.binding?.fieldMap[role] : undefined;
      if (!field) continue;
      // (Only a Tree's roles key the items — a Text's `value` (a group count's heading, ADR-284)
      // names the field it shows, not the items' key.)
      if (
        definitionTypeName(graph, (entry as NodeEntry).definitionId) !== "Tree"
      )
        continue;
      const fieldId = field.replace(/^data:field:/, "");
      return schema.find((item) => item.id === fieldId)?.key ?? fieldId;
    }
    // (ADR-313 Decision 6 — no Tree names the key: the collection's key field, as the lists key it.)
    if (role === "value") {
      const keyField = this.collections.find(
        (item) => item.id === collectionId,
      )?.keyField;
      if (keyField) return schema.find((item) => item.id === keyField)?.key;
    }
    return undefined;
  }
  private childrenKeyOf(collectionId: string | undefined): string | undefined {
    return this.treeFieldKeyOf(collectionId, "children");
  }
  private parentIdKeyOf(collectionId: string | undefined): string | undefined {
    return this.treeFieldKeyOf(collectionId, "parentId");
  }
  /** Every key in a collection's items — the tree's, every level. */
  private keysOf(collectionId: string, items: readonly unknown[]): Set<string> {
    return itemKeysOf(
      items as CatalogItems,
      this.childrenKeyOf(collectionId),
      this.treeFieldKeyOf(collectionId, "value"),
    );
  }
  /** A tree edit's parent that is not in the collection, else undefined. */
  private missingParent(
    collectionId: string,
    items: readonly unknown[],
    parentKey: string | null | undefined,
  ): { reason: string } | undefined {
    if (parentKey == null) return undefined;
    if (!this.childrenKeyOf(collectionId) && !this.parentIdKeyOf(collectionId))
      return {
        reason:
          "하위 항목 필드 (fieldMap.children 또는 fieldMap.parentId) 가 없는 목록이다",
      };
    return this.keysOf(collectionId, items).has(parentKey)
      ? undefined
      : { reason: `부모 항목 없음: ${parentKey}` };
  }
  /** A submit in flight until it settles (a `reload` waits for it). */
  trackSubmit<T>(submit: Promise<T>): Promise<T> {
    this.pendingSubmits.add(submit);
    const settled = () => this.pendingSubmits.delete(submit);
    submit.then(settled, settled);
    return submit;
  }
  /**
   * `useAsyncList.reload()` — run the query endpoint that fills the collection (`targetCollection`)
   * after the submits in flight, and show its items: the rules' local edits go (the server holds
   * the items now). A mock collection, or one no endpoint fills, is refused.
   */
  /**
   * The endpoint that fills a collection: the one linked to its id (`targetCollectionId`), else one
   * that names it and is linked to no id (Builder's `dataActions` rule — two collections can share
   * a name). **Why (2026-10-24 review)**: matching the name alone ran the first endpoint of that
   * name.
   */
  private endpointFilling(collection: { id?: string; name?: string }) {
    return this.endpoints.find((item) =>
      item.targetCollectionId
        ? item.targetCollectionId === collection.id
        : item.targetCollection === collection.name,
    );
  }
  /** The query endpoint that fills a collection (`targetCollection`), refusing a mock one. */
  private queryEndpoint(collectionId: string) {
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    if (!collection) throw new Error(`collection 없음: ${collectionId}`);
    if (collection.useMockData)
      throw new Error(
        `${collection.name ?? collectionId} 은 목업 데이터를 쓴다 (API 연결 없음)`,
      );
    const endpoint = this.endpointFilling(collection);
    if (!endpoint)
      throw new Error(
        `${collection.name ?? collectionId} 을 채우는 endpoint 없음`,
      );
    return endpoint;
  }
  /** One `load` of a collection's query endpoint with its load arguments (and a cursor). */
  private async loadPage(
    collectionId: string,
    state: CatalogLoadingState,
    cursor?: string,
  ): Promise<
    | { items: Record<string, unknown>[]; selectedKeys?: string[] | "all" }
    | undefined
  > {
    const endpoint = this.queryEndpoint(collectionId);
    const sequence = (this.loadSequence.get(collectionId) ?? 0) + 1;
    this.loadSequence.set(collectionId, sequence);
    const latest = () => this.loadSequence.get(collectionId) === sequence;
    // (A newer load aborts the one in flight — its late answer is dropped below too.)
    this.loadControllers.get(collectionId)?.abort();
    const controller = new AbortController();
    this.loadControllers.set(collectionId, controller);
    this.setLoadingState(collectionId, state);
    const resolve = this.endpointTemplateFor(collectionId, cursor);
    // ADR-284 Decision 6: the views reading the collection, in the endpoint's query format (with
    // the page the format carries — ADR-291 Decision 6).
    const requestedView = this.uniqueView(collectionId, { cursor });
    const extra = this.viewRequest(collectionId, { cursor });
    try {
      await Promise.allSettled([...this.pendingSubmits]);
      if (cursor === undefined) {
        // (Another query: its total is not the last query's.)
        this.loadTotals.delete(collectionId);
        const url = resolvedEndpointUrl(endpoint, resolve, extra);
        if (url) this.loadedUrls.set(collectionId, url);
      }
      const page = await loadCollectionEndpoint(
        endpoint,
        controller.signal,
        resolve,
        cursor,
        extra,
      );
      // (A newer load started meanwhile — `useAsyncList` aborts this one: its answer is dropped.)
      if (!latest()) return undefined;
      if (requestedView && requestedView.serialized.load !== "all")
        this.loadedViewQueries.set(collectionId, requestedView.query);
      else this.loadedViewQueries.delete(collectionId);
      if (page.total !== undefined)
        this.loadTotals.set(collectionId, page.total);
      const args = this.loadArguments.get(collectionId) ?? {};
      const { cursor: _previous, ...rest } = args;
      this.loadArguments.set(
        collectionId,
        page.cursor === undefined ? rest : { ...rest, cursor: page.cursor },
      );
      this.loadingStates.set(collectionId, "idle");
      // (ADR-313 Decision 4 — the response in the collection's stored values.)
      const intake = intakeQueryItems(
        page.items,
        this.collections.find((item) => item.id === collectionId),
      );
      const items = (Array.isArray(intake) ? intake : [intake]).filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object",
      );
      return page.selectedKeys === undefined
        ? { items }
        : { items, selectedKeys: page.selectedKeys };
    } catch (error) {
      if (!latest()) return undefined;
      this.setLoadingState(collectionId, "error");
      throw error;
    } finally {
      if (this.loadControllers.get(collectionId) === controller)
        this.loadControllers.delete(collectionId);
    }
  }
  /**
   * A Table record's state as its rows read it (`catalogTableStateRowSlices` — its sort · search ·
   * column filters, each Column as its field); undefined for a record that is not a Table with a
   * data slice. A Table its endpoint's own `{{ sortDescriptor }}` sorts has no sort here.
   */
  private recordRowSlices(recordId: string): CatalogRowSlices | undefined {
    const held = this.tableStates.get(recordId);
    const state =
      held && this.serverSortedTables.has(recordId) ? withoutSort(held) : held;
    // (ADR-315 Phase 5 증분 5g — a grouping · a totals row a server answers: its group query.)
    const grouped = this.tableServes(recordId, "grouping");
    const totals = this.tableServes(recordId, "totals");
    if (
      !state?.sort?.length &&
      !state?.search &&
      !state?.columnFilters?.length &&
      !grouped &&
      !totals
    )
      return undefined;
    return catalogTableStateRowSlices(
      state ?? NO_TABLE_STATE,
      this.tableColumns(recordId),
      {
        ...this.currentRoot?.domInputs.get(recordId)?.props,
        ...(totals ? { totals: true } : {}),
      },
    );
  }
  /**
   * ADR-315 Phase 5 증분 5g — a Table record's grouping · totals row its server answers (a group
   * query — the endpoint answers a group's rows, `catalogTableSliceServable` `whole`).
   */
  private tableServes(tableId: string, slice: "grouping" | "totals"): boolean {
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
    const root = this.currentRoot;
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
   * A binding's query with a Table's state as its bound view's (`catalogTableStateQueries` — the
   * one translation the request and the served check read). Undefined = no slice, or one that
   * names no field of the rows (they run on the rows here only).
   */
  private stateRowQuery(
    collectionId: string,
    query: CatalogRowQuery,
    slices: CatalogRowSlices | undefined,
    /**
     * ADR-315 Phase 5 증분 5g — the grouping's level its server answers (0 = the group rows, a
     * level past the last = a group's rows); the slices' totals row instead (`"totals"`).
     */
    level: number | "totals" = 0,
  ): CatalogRowQuery | undefined {
    if (!slices) return undefined;
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    const schema = (collection?.schema ?? []).flatMap((field) =>
      field.id && field.key
        ? [{ id: field.id, key: field.key, type: field.type }]
        : [],
    );
    // (The fields the Table's rows have: its view's result fields — a grouped view's.)
    const fields = query.queries.length
      ? viewSchemaAt({ queries: query.queries, schema }, query.queries.length)
      : schema;
    const totals = level === "totals";
    const view = catalogRowSlicesView(
      totals ? { ...slices, sorts: undefined } : slices,
      fields,
    );
    // (A slice that names no field of the rows: they run on the rows here only.)
    if (
      !view &&
      (slices.search ||
        slices.filters?.length ||
        (!totals && slices.sorts?.length))
    )
      return undefined;
    // (ADR-315 Phase 5 증분 5g — the grouping · the totals row its server answers: a group query.)
    const service = this.collectionRowService(collectionId);
    const served = (slice: "grouping" | "totals", fns: readonly unknown[]) =>
      service.remote &&
      catalogTableSliceServable(service, slice, fns).accepts === "whole";
    const groups = slices.groups;
    const grouped = totals
      ? slices.totals &&
        served(
          "totals",
          slices.totals.flatMap((entry) => (entry.fn ? [entry.fn] : [])),
        )
        ? catalogRowTotalsView(slices.totals, fields)
        : undefined
      : groups?.keys.length &&
          level < groups.keys.length &&
          served(
            "grouping",
            groups.aggregates.map((entry) => entry.fn),
          )
        ? (catalogRowGroupLevelView(groups, level, fields) ?? null)
        : undefined;
    if (grouped === null || (totals && !grouped)) return undefined;
    if (!view && !grouped) return undefined;
    const stated = catalogTableStateQueries(
      query.queries.length ? query.queries : undefined,
      view,
    );
    return {
      ...query,
      queries: grouped ? catalogTableGroupedQueries(stated, grouped) : stated!,
    };
  }
  /**
   * ADR-284 Decision 6 — the view a collection's query endpoint carries: the one view (by its
   * definition) the bindings of that collection read, when the endpoint names a query format. Two
   * different views on one endpoint are not sent (`MULTI_VIEW` — each filters its loaded rows).
   */
  private serverView(collectionId: string):
    | {
        query: CatalogRowQuery;
        serialized: SerializedViewQuery;
        nodeId: string;
        /** ADR-291 Decision 5 · 6 — the answer is the view's rows, or its grouped result. */
        mode: "rows" | "aggregate";
      }
    | undefined {
    const view = this.uniqueView(collectionId);
    // (ADR-291 — a view the request cannot carry whole (`load: "all"` — a computed field, a
    // grouping a flat format has no parameters for) is not the server's answer: every row is
    // loaded (`loadAll`) and the whole chain runs here.)
    if (!view || view.serialized.load === "all") return undefined;
    return {
      ...view,
      mode: view.serialized.body?.group ? "aggregate" : "rows",
    };
  }
  /**
   * The one view (by its definition) the bindings of a collection read, in its endpoint's query
   * format — what the request carries of it and what it cannot (`warnings` · `load`).
   */
  private uniqueView(
    collectionId: string,
    page?: { cursor?: string },
  ):
    | {
        query: CatalogRowQuery;
        serialized: SerializedViewQuery;
        nodeId: string;
      }
    | undefined {
    const graph = this.graph;
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    if (!graph || !collection || collection.useMockData) return undefined;
    const endpoint = this.endpointFilling(collection);
    const format = endpoint?.querySerialization;
    if (!endpoint || !format || format.kind === "none") return undefined;
    const views = new Map<
      string,
      { query: CatalogRowQuery; nodeId: string; keys?: SerializedKeyRows }
    >();
    for (const nodeId of graph.bindingsOf(`data:collection:${collectionId}`)) {
      const entry = graph.getEntry(nodeId as never);
      const binding = entry?.kind === "node" ? entry.binding : undefined;
      if (!binding) continue;
      const viewed = !!binding.view || !!binding.viewId;
      // A template is a different query at each drawn instance occurrence. An unused origin
      // has no request; the Canvas/Preview record path also restores collapsed inner instances.
      const root = this.currentRoot;
      const records = root?.recordsOfSource(nodeId) ?? [];
      for (const recordId of records) {
        const record = root!.domInputs.get(recordId);
        if (!record) continue;
        // (ADR-315 Phase 2 · 3 — a Table record's state (its sort · search · column filters) is
        //  part of its query: the request carries it. A binding without a view is one only while
        //  its Table holds a data slice.)
        const slices = this.recordRowSlices(recordId);
        // (ADR-315 Phase 5 증분 5g — a Table's pinned rows: its page leaves them out.)
        const pinRequest = this.tablePinRequest(recordId);
        if (!viewed && !slices && !pinRequest) continue;
        const query = viewed
          ? catalogBindingQuery(
              graph,
              binding,
              nodeId,
              this.stateSource(),
              undefined,
              componentInstancePath(record, nodeId),
            )
          : NO_VIEW_QUERY;
        if (!query) continue;
        const stated = this.stateRowQuery(collectionId, query, slices);
        if (!viewed && !stated && !pinRequest) continue;
        const base = {
          ...(stated ?? query),
          queries: catalogCountlessViews((stated ?? query).queries),
        };
        const except = pinRequest
          ? { field: pinRequest.field, except: pinRequest.keys }
          : undefined;
        views.set(
          `${catalogRowQueryKey(base)}\u0000${JSON.stringify(except)}`,
          {
            query: base,
            nodeId,
            ...(except ? { keys: except } : {}),
          },
        );
      }
    }
    if (!views.size) return undefined;
    const [{ query, nodeId, keys }] = [...views.values()];
    if (views.size > 1) {
      // Preserve ADR-284's standalone MULTI_VIEW policy; instance-dependent inputs require
      // the unfiltered local load because no one instance's filtered response can be shared.
      const inputDependent = [...views.values()].some(({ query }) =>
        Object.keys(query.values).some((ref) => {
          const parsed = parseRuleValueRef(ref);
          return (
            parsed?.from === "var" &&
            isInputVariable(graph.getEntry(parsed.variableId as never))
          );
        }),
      );
      if (!inputDependent) return undefined;
      return {
        query,
        nodeId,
        // One collection stores one answer. Different instance filters need unfiltered rows,
        // loaded to the existing local-evaluation cap, then evaluated separately per instance.
        serialized: {
          ...serializeViewQueries(
            format,
            { queries: [], schema: [], resolve: () => undefined },
            endpoint.method,
            page,
          ),
          warnings: [{ code: "MULTI_VIEW" }],
          load: "all",
        },
      };
    }
    const serialized = serializeViewQueries(
      format,
      {
        queries: query.queries,
        schema: (collection.schema ?? []).flatMap((field) =>
          field.id && field.key
            ? [
                {
                  id: field.id,
                  key: field.key,
                  type: field.type,
                  ...(field.formula ? { formula: field.formula } : {}),
                  // (ADR-313 — a value sent is written back with the field's notation.)
                  ...(field.encoding ? { encoding: field.encoding } : {}),
                },
              ]
            : [],
        ),
        resolve: catalogRowQueryResolve(query),
      },
      endpoint.method,
      page,
      keys ? { keys } : undefined,
    );
    // (ADR-315 Phase 5 증분 5g — a Table reading every row: what the format carries is sent, the
    //  answer is not the Table's rows — every page loads and its slices run here, §4.3.1.)
    return {
      query,
      nodeId,
      serialized:
        serialized.load !== "all" &&
        this.collectionTablesReadWhole(collectionId)
          ? { ...serialized, load: "all" }
          : serialized,
    };
  }
  /**
   * The request parts a collection's view adds (none = the endpoint as authored) — a view loaded
   * whole still sends what the format carries (a `suffix` format's conditions before its grouping).
   */
  private viewRequest(collectionId: string, page?: { cursor?: string }) {
    const view = this.uniqueView(collectionId, page);
    if (!view) return undefined;
    const { params, body } = view.serialized;
    if (!params.length && !body) return undefined;
    return { query: params, ...(body ? { body } : {}) };
  }
  /** ADR-291 — whether a collection's view must see every row before it can be right. */
  private viewLoadsAll(collectionId: string): boolean {
    return this.uniqueView(collectionId)?.serialized.load === "all";
  }
  /**
   * The collection's rows must all be here before its readers are right: its view runs here
   * (ADR-291), or a Table reads every row (ADR-315 Phase 5 증분 5g — `tableReadsWhole`).
   */
  private loadsWhole(collectionId: string): boolean {
    return (
      this.viewLoadsAll(collectionId) ||
      this.collectionTablesReadWhole(collectionId)
    );
  }
  /**
   * ADR-291 Decision 5 · 사용자 결정 3 — every page of a collection whose view runs here, up to
   * `VIEW_LOCAL_LOAD_CAP`; past the cap the view is refused: no rows, a notice — never a quiet
   * partial result.
   */
  private async loadAll(collectionId: string): Promise<void> {
    while (this.loadArguments.get(collectionId)?.cursor !== undefined) {
      const shown = this.collectionItems(collectionId).length;
      const total = this.loadTotals.get(collectionId);
      if (
        (total !== undefined && total > VIEW_LOCAL_LOAD_CAP) ||
        shown >= VIEW_LOCAL_LOAD_CAP
      ) {
        this.refuseView(collectionId, total ?? shown);
        return;
      }
      const before = this.loadArguments.get(collectionId)?.cursor;
      await this.loadMore(collectionId);
      // (A load in flight — `loadMore` does nothing then — or a page that brought no cursor
      //  change: stop; the load that runs finishes the whole · its own reload calls this again.)
      if (this.loadArguments.get(collectionId)?.cursor === before) return;
    }
  }
  /** The rows a refused view would show: none (the bound components show their empty state). */
  private refuseView(collectionId: string, count: number): void {
    const { cursor: _dropped, ...rest } =
      this.loadArguments.get(collectionId) ?? {};
    this.loadArguments.set(collectionId, rest);
    this.viewRefusals.set(collectionId, count);
    console.warn(
      `[CatalogPreview] ${collectionId}: the view runs here and needs every row — ${count} rows is past the ${VIEW_LOCAL_LOAD_CAP} cap; it shows nothing.`,
    );
    this.showLoaded(collectionId, []);
    this.setLoadingState(collectionId, "error");
  }
  /** ADR-291 — collections whose view was refused for the row cap, with the count that was too many. */
  readonly viewRefusals = new Map<string, number>();
  /** Show a collection's loaded items (they replace the Builder's — the rules' edits go). */
  private showLoaded(
    collectionId: string,
    items: Record<string, unknown>[],
  ): void {
    this.reloadedItems.set(collectionId, items);
    this.itemEdits.delete(collectionId);
    const errors =
      this.currentRoot?.refreshRows(
        new Set([`data:collection:${collectionId}`]),
      ) ?? [];
    if (errors.length) console.error("[CatalogPreview] reload:", ...errors);
    this.changed();
  }
  /** `useAsyncList.reload()` — the first page again (the cursor starts over). */
  async reload(
    collectionId: string,
    state: CatalogLoadingState = "loading",
  ): Promise<void> {
    const page = await this.loadPage(collectionId, state);
    if (!page) return;
    this.viewRefusals.delete(collectionId);
    // (A first page again — its lists show from the top, one window; paged lists at page 1.)
    const prefix = displayWindowKey(collectionId, "");
    for (const key of [...this.displayWindows.keys()])
      if (key.startsWith(prefix)) this.displayWindows.delete(key);
    this.resetPages(collectionId);
    this.showLoaded(collectionId, page.items);
    // (ADR-315 Phase 5 증분 5g — the Tables' pinned rows · open groups · totals: another query is
    //  their requests too.)
    this.syncServedRows(collectionId);
    if (page.selectedKeys !== undefined)
      this.selectLoaded(collectionId, page.selectedKeys, false);
    // (ADR-291 — a view that runs here needs the whole data before it is right. ADR-315 Phase 5
    //  증분 5g — so does a Table that reads every row.)
    if (this.loadsWhole(collectionId)) await this.loadAll(collectionId);
  }
  /**
   * The keys a load returned (`useAsyncList` load `selectedKeys` — `responseMapping.selectedKeysPath`)
   * go to the components showing the collection: a load's replace their selection, a `loadMore`'s
   * join it (the reference's reducer). The rule runtime writes them (`onLoadedSelection`).
   */
  private selectLoaded(
    collectionId: string,
    keys: readonly string[] | "all",
    join: boolean,
  ): void {
    for (const listener of this.loadedSelectionListeners)
      listener(collectionId, keys, join);
  }
  private readonly loadedSelectionListeners = new Set<
    (
      collectionId: string,
      keys: readonly string[] | "all",
      join: boolean,
    ) => void
  >();
  /** Listens for the keys a load returned (the rule runtime selects them — `selectLoaded`). */
  onLoadedSelection(
    listener: (
      collectionId: string,
      keys: readonly string[] | "all",
      join: boolean,
    ) => void,
  ): () => void {
    this.loadedSelectionListeners.add(listener);
    return () => this.loadedSelectionListeners.delete(listener);
  }
  /**
   * `useAsyncList.loadMore()` — the next page after the items shown (the rules' edits kept); no
   * cursor (the last page, or no `cursorPath`) = nothing to load.
   */
  async loadMore(collectionId: string): Promise<void> {
    const cursor = this.loadArguments.get(collectionId)?.cursor;
    // (A load in flight first — the reference's `loadMore` while loading does nothing.)
    const state = this.loadingStates.get(collectionId);
    if (
      cursor === undefined ||
      (state && state !== "idle" && state !== "error")
    )
      return;
    const shown = this.collectionItems(collectionId) as Record<
      string,
      unknown
    >[];
    const page = await this.loadPage(collectionId, "loadingMore", cursor);
    if (!page) return;
    this.showLoaded(collectionId, [...shown, ...page.items]);
    // (ADR-315 Phase 5 증분 5g — a server's next group rows: the open ones' rows.)
    void this.syncGroupRows(collectionId);
    if (page.selectedKeys !== undefined)
      this.selectLoaded(collectionId, page.selectedKeys, true);
  }
  /**
   * ADR-310 Decision 10 「더 보기」 — a bound list's end was seen: rows already loaded past its
   * window (`moreLoaded`) show; else the next page loads first (a collection that pages — none
   * otherwise). Then the list's window grows by one window.
   */
  async showMore(
    collectionId: string,
    ownerId: string,
    moreLoaded: boolean,
  ): Promise<void> {
    if (!moreLoaded) {
      // (No next page — the last one came, or none pages: nothing to show; the window stays.)
      const id = collectionId.replace(/^data:collection:/, "");
      if (!this.pages(id) || this.loadArguments.get(id)?.cursor === undefined)
        return;
      // (A page in flight, or one that brought nothing: the window stays — growing it re-draws
      //  the sentinel, which would ask again at once.)
      const before = this.collectionItems(id).length;
      await this.loadMore(id);
      if (this.collectionItems(id).length === before) return;
    }
    const key = displayWindowKey(collectionId, ownerId);
    this.displayWindows.set(
      key,
      (this.displayWindows.get(key) ?? COLLECTION_ROW_PROJECTION_WINDOW_LIMIT) +
        COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
    );
    const errors =
      this.currentRoot?.refreshRows(
        new Set([
          `data:collection:${collectionId.replace(/^data:collection:/, "")}`,
        ]),
      ) ?? [];
    if (errors.length) console.error("[CatalogPreview] show more:", ...errors);
    this.changed();
  }
  /**
   * ADR-310 Decision 11 — a collection's load (`useAsyncList.loadingState`): a run over its data
   * shows its own load-more spinner while it loads more.
   */
  loadingStateOf(collectionId: string): string {
    return (
      this.loadingStates.get(collectionId.replace(/^data:collection:/, "")) ??
      "idle"
    );
  }
  /** ADR-310 「더 보기」 — whether a bound list holds loaded rows past its display window. */
  moreLoaded(collectionId: string, ownerId: string): boolean {
    return this.windowsCut.has(displayWindowKey(collectionId, ownerId));
  }
  /** `useAsyncList.setFilterText(text)` — loads again with the text (S2 `filtering`). */
  async setFilterText(collectionId: string, filterText: string): Promise<void> {
    this.loadArguments.set(collectionId, {
      ...this.loadArguments.get(collectionId),
      filterText,
    });
    await this.reload(collectionId, "filtering");
  }
  /**
   * Whether a collection pages (`useAsyncList.loadMore` has a next page to ask for): its query
   * endpoint gives a cursor (`responseMapping.cursorPath`) or reads `{{ cursor }}`.
   */
  pages(collectionId: string): boolean {
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    const endpoint =
      collection && !collection.useMockData
        ? this.endpointFilling(collection)
        : undefined;
    return (
      !!endpoint &&
      (!!endpoint.responseMapping?.cursorPath ||
        endpointReadsTemplate(endpoint, "cursor"))
    );
  }
  /**
   * The collection a record's text filters on the server (`inputValue={list.filterText}`): a
   * ComboBox's own binding, an Autocomplete's list's — when its query endpoint reads
   * `{{ filterText }}`; else undefined (the list filters itself).
   */
  serverFilterOf(recordId: string): string | undefined {
    const root = this.currentRoot;
    const graph = this.graph;
    if (!root || !graph) return undefined;
    const visit = (id: string, depth: number): string | undefined => {
      const record = root.domInputs.get(id);
      if (!record) return undefined;
      const source = graph.getEntry(record.sourceId as never);
      const binding = source?.kind === "node" ? source.binding : undefined;
      if (binding) {
        const collectionId = binding.collectionId.replace(
          /^data:collection:/,
          "",
        );
        const collection = this.collections.find(
          (item) => item.id === collectionId,
        );
        const endpoint =
          collection && !collection.useMockData
            ? this.endpointFilling(collection)
            : undefined;
        return endpoint && endpointReadsTemplate(endpoint, "filterText")
          ? collectionId
          : undefined;
      }
      if (depth === 0) return undefined;
      for (const child of record.children) {
        const found = visit(child, depth - 1);
        if (found) return found;
      }
      return undefined;
    };
    return visit(recordId, 3);
  }
  /** `useAsyncList.sort(sortDescriptor)` with a server sort — loads again (S2 `sorting`). */
  async sortCollection(
    collectionId: string,
    sortDescriptor: CatalogTableSort | undefined,
  ): Promise<void> {
    const { sortDescriptor: _previous, ...rest } =
      this.loadArguments.get(collectionId) ?? {};
    this.loadArguments.set(
      collectionId,
      sortDescriptor ? { ...rest, sortDescriptor } : rest,
    );
    await this.reload(collectionId, "sorting");
  }

  private setLoadingState(
    collectionId: string,
    state: CatalogLoadingState,
  ): void {
    this.loadingStates.set(collectionId, state);
    const errors =
      this.currentRoot?.refreshRows(
        new Set([`data:collection:${collectionId}`]),
      ) ?? [];
    if (errors.length) console.error("[CatalogPreview] loading:", ...errors);
    this.changed();
  }
  /**
   * ADR-284 Decision 3 — what a bound node's view shows: matched · loaded rows, the server's total
   * when it gave one, whether the rows are all of the data. Undefined = no view (or no rows yet).
   */
  viewResult(nodeId: string): CatalogViewResultMeta | undefined {
    const graph = this.graph;
    const entry = graph?.getEntry(nodeId as never);
    const binding = entry?.kind === "node" ? entry.binding : undefined;
    if (!graph || !binding) return undefined;
    const query = catalogBindingQuery(
      graph,
      binding,
      nodeId,
      this.stateSource(),
    );
    return query
      ? this.boundRows({ ...binding, query }, "items")?.view
      : undefined;
  }
  /** The bound rows with their collection's load (idle unless a load runs — the Preview's). */
  private boundRows(
    authored: Parameters<typeof catalogBoundRows>[0],
    kind: Parameters<typeof catalogBoundRows>[2],
    ownerId?: string,
    /** A bound Table's state — its rows are filtered · ordered before the window · the page cuts them. */
    slices?: CatalogRowSlices,
  ) {
    // ADR-284 Decision 6: rows the server answered for this binding's view are its result — the
    // view does not run on them again; the total is the server's for that query.
    let binding = authored;
    const id = authored.collectionId.replace(/^data:collection:/, "");
    // (ADR-315 Phase 2 · 3 — the Table's state is its bound view's: an answer to that query is
    //  those rows in that order, and is not filtered · sorted here again.)
    const stated = this.stateRowQuery(
      id,
      authored.query ?? NO_VIEW_QUERY,
      slices,
    );
    // (ADR-315 Phase 5 증분 5g — a server's pages and pinned rows: the page is asked for without
    //  them, they are asked for by key — `syncPinnedRows`.)
    const pinsRefused =
      ownerId !== undefined && this.rowPinsRefused(id, ownerId);
    const servedPins =
      !!slices?.pins &&
      ownerId !== undefined &&
      !pinsRefused &&
      this.collectionRowService(id).remote;
    const asked =
      stated ?? authored.query ?? (servedPins ? NO_VIEW_QUERY : undefined);
    if (asked) {
      const view = this.serverView(id);
      const loaded = this.loadedViewQueries.get(id);
      const depth = loaded?.queries.length ?? 0;
      if (
        view &&
        loaded &&
        catalogRowQueryKey(loaded) === catalogRowQueryKey(asked, depth) &&
        asked.queries.slice(depth).every(catalogCountOnlyView)
      ) {
        const total = this.loadTotals.get(id);
        binding = {
          ...authored,
          query: {
            ...asked,
            served: {
              ...(total !== undefined ? { total } : {}),
              complete: this.loadArguments.get(id)?.cursor === undefined,
              warnings: view.serialized.warnings.length,
              ...(depth < asked.queries.length ? { depth } : {}),
              mode: view.mode,
              ...(stated ? { state: true as const } : {}),
            },
          },
        };
        // (ADR-315 Phase 5 증분 5g — a server's groups: an open group's rows are its answers.)
        if (slices?.groups && stated?.queries.at(-1)?.groupBy) {
          const queryKey = catalogRowQueryKey(asked);
          const owner = ownerId;
          slices = {
            ...slices,
            groups: {
              ...slices.groups,
              served: (path) =>
                owner === undefined
                  ? undefined
                  : this.groupAnswerOf(owner, path, queryKey),
            },
          };
        }
        if (servedPins)
          slices = {
            ...slices!,
            pins: {
              ...slices!.pins!,
              rows:
                this.pinAnswers.get(pinAnswerKey(ownerId!, slices!.pins!))
                  ?.items ?? [],
            },
          };
      } else if (
        view?.mode === "aggregate" &&
        slices?.groups &&
        stated?.queries.at(-1)?.groupBy
      )
        // (ADR-315 Phase 5 증분 5g — a server's groups not answered yet: no rows but the load —
        //  never the rows held grouped here.)
        return Object.assign([] as CatalogBoundRow[], {
          loadingState: "loading" as const,
        }) as CatalogBoundRows;
      else if (
        authored.query &&
        !this.collections.find((item) => item.id === id)?.useMockData
      )
        binding = {
          ...authored,
          query: {
            ...authored.query,
            loaded: {
              complete: this.loadArguments.get(id)?.cursor === undefined,
            },
          },
        };
    }
    // ADR-310 Phase 7 — a paged list shows its page (its query unit's rows when remote).
    const display =
      ownerId === undefined ? undefined : this.rowDisplayOf(ownerId);
    // (ADR-315 Phase 5 증분 5g — a totals row its server answers: that row (none yet = empty).)
    if (slices?.totals && ownerId !== undefined) {
      const query = this.stateRowQuery(
        id,
        authored.query ?? NO_VIEW_QUERY,
        slices,
        "totals",
      );
      if (query) {
        const answer = this.totalsAnswers.get(ownerId);
        slices = {
          ...slices,
          servedTotals:
            answer?.queryKey === catalogRowQueryKey(query)
              ? (answer.row ?? {})
              : {},
        };
      }
    }
    // (ADR-315 Phase 5 증분 5g — rows a Table of pins none of: its record says so.)
    const marked = <T extends object | undefined>(rows: T): T =>
      rows && pinsRefused
        ? (Object.assign(rows, { pinsRefused: true as const }) as T)
        : rows;
    if (ownerId !== undefined && display?.mode === "pages")
      return marked(this.pageRows(binding, kind, ownerId, display, slices));
    // (A virtual-scrolled list shows every loaded row — the `Virtualizer` puts the visible ones in
    //  the DOM; its end loads the next page as 「더 보기」 does.)
    const window =
      ownerId === undefined
        ? undefined
        : display?.mode === "virtual"
          ? Number.MAX_SAFE_INTEGER
          : this.displayWindows.get(
              displayWindowKey(binding.collectionId, ownerId),
            );
    const rows = catalogBoundRows(
      binding,
      this.itemSources(),
      kind,
      window,
      0,
      slices,
    );
    if (!rows) return rows;
    if (ownerId !== undefined) {
      const key = displayWindowKey(binding.collectionId, ownerId);
      if (rows.total !== undefined && rows.total > rows.length)
        this.windowsCut.add(key);
      else this.windowsCut.delete(key);
    }
    const collectionId = binding.collectionId.replace(/^data:collection:/, "");
    return marked(
      Object.assign(rows, {
        loadingState: this.loadingStates.get(collectionId) ?? "idle",
      }),
    );
  }
  /**
   * ADR-315 Phase 5 증분 5g — the servers' answers to the Tables' pinned rows' requests, by the
   * Table node and its pins (`pinAnswerKey`): the request they answer (its URL · body) and rows.
   */
  private readonly pinAnswers = new Map<
    string,
    { url: string; items: Record<string, unknown>[] }
  >();
  /**
   * ADR-315 Phase 5 증분 5g — the servers' answers to an open group's rows (`groupOf`), by the
   * Table node and the group's key: the query they belong to (`catalogRowQueryKey` of the group
   * query — another state's are not these groups'), the request, the rows, and the rows' count
   * when it is not the group's.
   */
  private readonly groupAnswers = new Map<
    string,
    {
      queryKey: string;
      url: string;
      rows?: readonly Record<string, unknown>[];
      mismatch?: number;
    }
  >();
  /** ADR-315 Phase 5 증분 5g — groups asked again once for a count that did not match. */
  private readonly groupRetries = new Set<string>();
  /** ADR-315 Phase 5 증분 5g — the servers' totals rows, by the Table node (`syncTotals`). */
  private readonly totalsAnswers = new Map<
    string,
    { queryKey: string; url: string; row?: Readonly<Record<string, unknown>> }
  >();
  /** An open group's answer (`CatalogRowGroups.served`) — none while not answered. */
  private groupAnswerOf(
    nodeId: string,
    path: readonly unknown[],
    queryKey: string,
  ) {
    const answer = this.groupAnswers.get(
      `${nodeId}\u0000${catalogTableGroupKey(path)}`,
    );
    return answer?.queryKey === queryKey && answer.rows
      ? {
          rows: answer.rows,
          ...(answer.mismatch !== undefined
            ? { mismatch: answer.mismatch }
            : {}),
        }
      : undefined;
  }
  /**
   * ADR-315 Phase 5 증분 5g — the requests a collection's Tables add to its page's (§4.3.2 ·
   * §4.3.3): their pinned rows, their open groups' rows, their totals rows.
   */
  private syncServedRows(collectionId: string): void {
    void this.syncPinnedRows(collectionId);
    void this.syncGroupRows(collectionId);
    void this.syncTotals(collectionId);
  }
  /** Every page of a request (a group's rows — no sentinel inside a group: §4.3.2 Phase 5 note). */
  private async loadEveryPage(
    collectionId: string,
    extraAt: (cursor: string | undefined) => {
      query: [string, string][];
      body?: unknown;
    },
  ): Promise<{ rows: Record<string, unknown>[]; total?: number }> {
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    const endpoint = this.queryEndpoint(collectionId);
    const rows: Record<string, unknown>[] = [];
    let total: number | undefined;
    let cursor: string | undefined;
    do {
      const answer = await loadCollectionEndpoint(
        endpoint,
        new AbortController().signal,
        this.endpointTemplateFor(collectionId, cursor),
        cursor,
        extraAt(cursor),
      );
      const intake = intakeQueryItems(answer.items, collection);
      rows.push(
        ...(Array.isArray(intake) ? intake : [intake]).filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object",
        ),
      );
      if (answer.total !== undefined) total = answer.total;
      cursor = answer.cursor === cursor ? undefined : answer.cursor;
    } while (cursor !== undefined && rows.length < VIEW_LOCAL_LOAD_CAP);
    return { rows, ...(total !== undefined ? { total } : {}) };
  }
  /** The Table records bound to a collection, with their node's binding and authored query. */
  private boundTableRecords(collectionId: string) {
    const graph = this.graph;
    const root = this.currentRoot;
    const out: {
      recordId: string;
      nodeId: string;
      /** The node's authored query at this record (its instance path) — read when asked. */
      authoredQuery: () => CatalogRowQuery | undefined;
    }[] = [];
    if (!graph || !root) return out;
    for (const nodeId of graph.bindingsOf(`data:collection:${collectionId}`)) {
      const entry = graph.getEntry(nodeId as never);
      const binding = entry?.kind === "node" ? entry.binding : undefined;
      if (!binding) continue;
      for (const recordId of root.recordsOfSource(nodeId)) {
        const record = root.domInputs.get(recordId);
        if (record?.ruleId !== "Table") continue;
        out.push({
          recordId,
          nodeId,
          authoredQuery: () =>
            binding.view || binding.viewId
              ? catalogBindingQuery(
                  graph,
                  binding,
                  nodeId,
                  this.stateSource(),
                  undefined,
                  componentInstancePath(record, nodeId),
                )
              : NO_VIEW_QUERY,
        });
      }
    }
    return out;
  }
  /** A query as a request (`serializeViewQueries` in the endpoint's format · fields). */
  private requestOf(
    collectionId: string,
    query: CatalogRowQuery,
    page?: { cursor?: string },
    items?: Parameters<typeof serializeViewQueries>[4],
  ) {
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    const endpoint = collection ? this.endpointFilling(collection) : undefined;
    const format = endpoint?.querySerialization;
    if (!endpoint || !format) return undefined;
    const serialized = serializeViewQueries(
      format,
      {
        queries: catalogCountlessViews(query.queries),
        schema: this.requestSchema(collectionId),
        resolve: catalogRowQueryResolve(query),
      },
      endpoint.method,
      page,
      items,
    );
    if (serialized.load === "all") return undefined;
    const extra = {
      query: serialized.params,
      ...(serialized.body ? { body: serialized.body } : {}),
    };
    const url = resolvedEndpointUrl(
      endpoint,
      this.endpointTemplateFor(collectionId, page?.cursor),
      extra,
    );
    return url ? { extra, url } : undefined;
  }
  /**
   * ADR-315 Phase 5 증분 5g — an open group's rows a server answers (§4.3.2): one request a group
   * — the Table's `where` · sort and `groupOf` its values; the next level's group query when
   * more levels follow. Every page of it loads (a group's rows have no sentinel of their own —
   * its count bounds them). An answer whose count is not the group's: the group query is asked
   * again once, then the group row says so (`mismatch`, §4.3.3).
   */
  private async syncGroupRows(collectionId: string): Promise<void> {
    let retry = false;
    for (const { recordId, nodeId, authoredQuery } of this.boundTableRecords(
      collectionId,
    )) {
      const slices = this.recordRowSlices(recordId);
      const groups = slices?.groups;
      const authored = groups ? authoredQuery() : undefined;
      if (!authored) continue;
      const main = this.stateRowQuery(collectionId, authored, slices, 0);
      if (!groups || !main?.queries.at(-1)?.groupBy) continue;
      const loaded = this.loadedViewQueries.get(collectionId);
      const queryKey = catalogRowQueryKey(main);
      if (!loaded || catalogRowQueryKey(loaded) !== queryKey) continue;
      const open = (key: string) =>
        groups.expanded === "all" || groups.expanded.includes(key);
      let changed = false;
      const walk = async (
        rows: readonly Record<string, unknown>[],
        depth: number,
        outer: readonly unknown[],
      ): Promise<void> => {
        for (const row of rows) {
          const path = [...outer, row[groups.keys[depth]!] ?? null];
          const groupKey = catalogTableGroupKey(path);
          if (!open(groupKey)) continue;
          const query =
            this.stateRowQuery(collectionId, authored, slices, depth + 1) ??
            authored;
          const groupOf = { by: groups.keys.slice(0, depth + 1), values: path };
          const first = this.requestOf(collectionId, query, undefined, {
            groupOf,
          });
          if (!first) continue;
          const key = `${nodeId}\u0000${groupKey}`;
          let answer = this.groupAnswers.get(key);
          if (answer?.url !== first.url || answer.queryKey !== queryKey) {
            this.groupAnswers.set(key, (answer = { queryKey, url: first.url }));
            const got = await this.loadEveryPage(
              collectionId,
              (cursor) =>
                this.requestOf(
                  collectionId,
                  query,
                  cursor === undefined ? undefined : { cursor },
                  { groupOf },
                )?.extra ?? first.extra,
            );
            if (this.groupAnswers.get(key) !== answer) return;
            // (The rows the answer has: the next level's counts, else the server's total.)
            const deeper = depth + 1 < groups.keys.length;
            const count = Number(row[CATALOG_GROUP_ROW_COUNT]);
            const rowsOf = deeper
              ? got.rows.reduce(
                  (sum, item) =>
                    sum + (Number(item[CATALOG_GROUP_ROW_COUNT]) || 0),
                  0,
                )
              : (got.total ?? got.rows.length);
            const retryKey = `${queryKey}\u0000${key}`;
            if (Number.isFinite(count) && rowsOf !== count) {
              if (!this.groupRetries.has(retryKey)) {
                this.groupRetries.add(retryKey);
                this.groupAnswers.delete(key);
                retry = true;
                continue;
              }
              console.warn(
                `[CatalogPreview] ${collectionId}: the group ${groupKey} counts ${count} rows, the server's answer to its rows has ${rowsOf} — said on its row.`,
              );
            }
            answer = {
              queryKey,
              url: first.url,
              rows: got.rows,
              ...(Number.isFinite(count) && rowsOf !== count
                ? { mismatch: rowsOf }
                : {}),
            };
            this.groupAnswers.set(key, answer);
            changed = true;
          }
          if (answer.rows && depth + 1 < groups.keys.length)
            await walk(answer.rows, depth + 1, path);
        }
      };
      await walk(
        this.collectionItems(collectionId) as Record<string, unknown>[],
        0,
        [],
      );
      if (changed) {
        const errors = this.currentRoot?.refreshNodes(new Set([nodeId]));
        if (errors?.length)
          console.error("[CatalogPreview] groups:", ...errors);
        this.changed();
      }
    }
    // (A count that did not match: the group query once more — its answer asks the rows again.)
    if (retry) await this.reload(collectionId, "filtering");
  }
  /**
   * ADR-315 Phase 5 증분 5g — a Table's totals row its server answers (§4.3.2): a group query
   * without fields over the Table's `where` — one row of each Column's aggregate.
   */
  private async syncTotals(collectionId: string): Promise<void> {
    for (const { recordId, nodeId, authoredQuery } of this.boundTableRecords(
      collectionId,
    )) {
      const slices = this.recordRowSlices(recordId);
      const authored = slices?.totals ? authoredQuery() : undefined;
      if (!slices?.totals || !authored) continue;
      const query = this.stateRowQuery(
        collectionId,
        authored,
        slices,
        "totals",
      );
      const request = query && this.requestOf(collectionId, query);
      if (!query || !request) continue;
      const queryKey = catalogRowQueryKey(query);
      const held = this.totalsAnswers.get(nodeId);
      if (held?.url === request.url && held.queryKey === queryKey) continue;
      const answer = { queryKey, url: request.url };
      this.totalsAnswers.set(nodeId, answer);
      try {
        const got = await this.loadEveryPage(collectionId, () => request.extra);
        if (this.totalsAnswers.get(nodeId) !== answer) continue;
        this.totalsAnswers.set(nodeId, { ...answer, row: got.rows[0] ?? {} });
        const errors = this.currentRoot?.refreshNodes(new Set([nodeId]));
        if (errors?.length)
          console.error("[CatalogPreview] totals:", ...errors);
        this.changed();
      } catch (error) {
        console.warn(
          `[CatalogPreview] ${collectionId} 의 합계를 읽지 못했다:`,
          error,
        );
      }
    }
  }
  /** A collection's fields as a request names them (with their notation · formula). */
  private requestSchema(collectionId: string) {
    return (
      this.collections.find((item) => item.id === collectionId)?.schema ?? []
    ).flatMap((field) =>
      field.id && field.key
        ? [
            {
              id: field.id,
              key: field.key,
              type: field.type,
              ...(field.formula ? { formula: field.formula } : {}),
              // (ADR-313 — a value sent is written back with the field's notation.)
              ...(field.encoding ? { encoding: field.encoding } : {}),
            },
          ]
        : [],
    );
  }
  /**
   * ADR-315 Phase 5 증분 5g — the pinned rows of a collection's Tables whose server pages its rows
   * (breakdown §4.3.3 · §5.4): one request a Table — its `where` (without it under 「Keep pinned
   * rows」 — the authored view's only) and `keys.only` its pinned keys, no page. A request that
   * has not changed is not sent again; an answer with more rows than the keys is said (§4.3.3).
   */
  private async syncPinnedRows(collectionId: string): Promise<void> {
    const name =
      this.collections.find((item) => item.id === collectionId)?.name ??
      collectionId;
    const loads: Promise<void>[] = [];
    for (const { recordId, nodeId, authoredQuery } of this.boundTableRecords(
      collectionId,
    )) {
      const request = this.tablePinRequest(recordId);
      const pinned = this.tableStates.get(recordId)?.pinnedRows;
      const authored = request && pinned ? authoredQuery() : undefined;
      if (!request || !pinned || !authored) continue;
      const query = request.keep
        ? authored
        : (this.stateRowQuery(
            collectionId,
            authored,
            this.recordRowSlices(recordId),
          ) ?? authored);
      const asked = this.requestOf(collectionId, query, undefined, {
        keys: { field: request.field, only: request.keys },
      });
      const key = pinAnswerKey(nodeId, pinned);
      const held = this.pinAnswers.get(key);
      if (!asked || held?.url === asked.url) continue;
      // (Asked: the answer this request brings replaces the one held — a later request wins.)
      this.pinAnswers.set(key, { url: asked.url, items: held?.items ?? [] });
      loads.push(
        (async () => {
          const { rows: items } = await this.loadEveryPage(
            collectionId,
            () => asked.extra,
          );
          if (this.pinAnswers.get(key)?.url !== asked.url) return;
          if (items.length > new Set(request.keys).size)
            console.warn(
              `[CatalogPreview] ${name}: the pinned rows' request (${request.keys.length} keys) was answered with ${items.length} rows — not a request by key; the rows of those keys are pinned.`,
            );
          this.pinAnswers.set(key, { url: asked.url, items });
          const errors = this.currentRoot?.refreshNodes(new Set([nodeId]));
          if (errors?.length)
            console.error("[CatalogPreview] pinned rows:", ...errors);
          this.changed();
        })().catch((error: unknown) =>
          console.warn(
            `[CatalogPreview] ${name} 의 고정 행을 읽지 못했다:`,
            error,
          ),
        ),
      );
    }
    await Promise.all(loads);
  }
  /**
   * An endpoint's `{{ }}` (route params · variables) read from the session's state, each on its
   * own: an empty value is not one (Home has no `:id` — `/users/` is another resource).
   */
  private endpointTemplateFor(
    collectionId: string,
    cursor?: string,
    /** ADR-310 Phase 7 — a page list's own `page` · `pageSize`. */
    extra?: Readonly<Record<string, unknown>>,
  ) {
    // (The load's arguments as it starts — a later `setFilterText` is a later load's.)
    const args = { ...this.loadArguments.get(collectionId), cursor, ...extra };
    return (text: string): string | undefined => {
      const graph = this.graph;
      if (!graph) return undefined;
      const source = this.stateSource();
      let unresolved = false;
      const value = text.replace(/\{\{[^}]*\}\}/g, (template) => {
        // `load({cursor, filterText, sortDescriptor})` — empty until given.
        const path =
          /^\{\{\s*([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)*)\s*\}\}$/.exec(
            template,
          );
        if (
          path &&
          (ENDPOINT_LOAD_ARGUMENTS as readonly string[]).includes(path[1]!)
        ) {
          let value: unknown = args[path[1] as keyof typeof args];
          for (const segment of (path[2] ?? "").split(".").filter(Boolean))
            value =
              value !== null && typeof value === "object"
                ? (value as Record<string, unknown>)[segment]
                : undefined;
          return typeof value === "string" || typeof value === "number"
            ? String(value)
            : "";
        }
        const part = catalogBindingKey(graph, template, undefined, source);
        if (!part || part.includes("{{")) unresolved = true;
        return part ?? "";
      });
      return unresolved ? undefined : value;
    };
  }
  /**
   * A router loader (`useAsyncList({ load })` fetching `/users/${id}`): each API collection whose
   * query endpoint reads a template loads when the shown path · data give another URL than its
   * last load — once per URL; a template that does not resolve (another page) loads nothing.
   */
  private loadRouted(state: CatalogLoadingState = "loading"): void {
    for (const collection of this.collections) {
      if (!collection.id || collection.useMockData) continue;
      const endpoint = this.endpointFilling(collection);
      // (ADR-284: a view the request carries — a variable it reads gives another request. ADR-291:
      // a view that runs here over every row is the session's load too.)
      const viewed = !!this.uniqueView(collection.id);
      // (An endpoint that pages — `cursorPath` — is the session's to load: the cursor is its.)
      if (
        !endpoint ||
        !(
          endpointReadsTemplate(endpoint) ||
          endpoint.responseMapping?.cursorPath ||
          viewed
        )
      ) {
        // (Its view no longer goes with the request: the rows the server filtered for it go —
        // the Builder's load shows again.)
        if (this.viewLoaded.delete(collection.id)) {
          this.loadedUrls.delete(collection.id);
          this.loadTotals.delete(collection.id);
          this.reloadedItems.delete(collection.id);
          this.loadedViewQueries.delete(collection.id);
          const errors =
            this.currentRoot?.refreshRows(
              new Set([`data:collection:${collection.id}`]),
            ) ?? [];
          if (errors.length) console.error("[CatalogPreview] view:", ...errors);
        }
        continue;
      }
      if (viewed) this.viewLoaded.add(collection.id);
      const url = resolvedEndpointUrl(
        endpoint,
        this.endpointTemplateFor(collection.id),
        this.viewRequest(collection.id),
      );
      if (!url || this.loadedUrls.get(collection.id) === url) {
        // (ADR-315 Phase 5 증분 5g — the page's request the same, a pinned rows' one may not be:
        //  「Keep pinned rows」 turned on · off.)
        if (url) this.syncServedRows(collection.id);
        // (ADR-315 Phase 5 증분 5g — the same request, and a Table that now reads every row: a
        //  grouping · a totals row · a tree turned on. The pages not loaded yet load.)
        if (
          url &&
          this.loadArguments.get(collection.id)?.cursor !== undefined &&
          this.collectionTablesReadWhole(collection.id)
        )
          this.loadAll(collection.id).catch((error: unknown) =>
            console.warn(
              `[CatalogPreview] ${collection.name ?? collection.id} 의 모든 행을 읽지 못했다:`,
              error,
            ),
          );
        continue;
      }
      this.loadedUrls.set(collection.id, url);
      this.reload(collection.id, state).catch((error: unknown) =>
        console.warn(
          `[CatalogPreview] ${collection.name ?? collection.id} 를 읽지 못했다:`,
          error,
        ),
      );
    }
  }

  /** A Table record's server sort: its bound collection and the sort by field, else undefined. */
  private serverSort(
    tableId: string,
    sort: CatalogTableSortItem | undefined,
  ):
    | { collectionId: string; sortDescriptor: CatalogTableSort | undefined }
    | undefined {
    const root = this.currentRoot;
    const graph = this.graph;
    const table = root?.domInputs.get(tableId);
    if (!root || !graph || !table) return undefined;
    const source = graph.getEntry(table.sourceId as never);
    const binding = source?.kind === "node" ? source.binding : undefined;
    if (!binding) return undefined;
    const collectionId = binding.collectionId.replace(/^data:collection:/, "");
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    const endpoint =
      collection && !collection.useMockData
        ? this.endpointFilling(collection)
        : undefined;
    if (!endpoint || !endpointReadsTemplate(endpoint, "sortDescriptor"))
      return undefined;
    // (The state names the Column by its Column key — the field the server sorts by.)
    return {
      collectionId,
      sortDescriptor: sort && {
        column: sort.column,
        direction: sort.direction,
      },
    };
  }
  /**
   * A Table record's authored data Columns: each one's Column key (what the Table state names —
   * the field it shows) and, for a Column that is drawn, its RAC key (what RAC's sort names —
   * `catalogTableColumnKey`). A hidden Column is among them without a RAC key (ADR-315 Phase 4 —
   * the Table record names every authored column, `catalogTableColumnEntries`): a state still
   * names it, and it is searched · sorted · filtered as before.
   */
  private tableColumns(tableId: string): {
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
    const root = this.currentRoot;
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
      racKey: catalogTableColumnKey({
        id: column.id,
        ...(column.htmlId ? { htmlId: column.htmlId } : {}),
      }),
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
    const values = this.root?.rowValuesOf(tableId);
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
    const table = this.currentRoot?.domInputs.get(tableId);
    const entries = catalogTableColumnEntries(table?.props) ?? [];
    return {
      columns: entries.map((entry) => entry.key),
      ...catalogTableColumnsNow(entries, this.tableStates.get(tableId)),
    };
  }
  /** A Table record's state (absent slices = the authored defaults). */
  tableState(tableId: string): CatalogTableState {
    return this.tableStates.get(tableId) ?? NO_TABLE_STATE;
  }
  /** A Table record as the rules between its state's slices read it (`catalogTableStateWith`). */
  private tableShape(tableId: string): CatalogTableShape {
    const table = this.currentRoot?.domInputs.get(tableId);
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
      filters: (op) =>
        this.tableSliceServable(tableId, { filter: op }).accepts === "whole",
      // (ADR-315 Phase 5 증분 5g — pinned rows only where a pinned row of another page can be
      //  asked for by its key.)
      rowPins: !this.rowPinsRefused(
        this.tableCollectionOf(tableId),
        this.currentRoot?.domInputs.get(tableId)?.sourceId,
      ),
    };
  }
  /** The collection a Table record's node is bound to (its id without the prefix). */
  private tableCollectionOf(tableId: string): string | undefined {
    const source = this.currentRoot?.domInputs.get(tableId)?.sourceId;
    const entry = source ? this.graph?.getEntry(source as never) : undefined;
    return entry?.kind === "node"
      ? entry.binding?.collectionId.replace(/^data:collection:/, "")
      : undefined;
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
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    const entry = nodeId ? this.graph?.getEntry(nodeId as never) : undefined;
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
  private rowPinsRefused(
    collectionId: string | undefined,
    nodeId: string | undefined,
  ): boolean {
    const service = this.collectionRowService(collectionId);
    if (!service.remote || !collectionId) return false;
    if (catalogTableSliceServable(service, "pins").accepts !== "whole")
      return true;
    if (!this.rowKeyFieldOf(collectionId, nodeId)) return true;
    const entry = nodeId ? this.graph?.getEntry(nodeId as never) : undefined;
    return (
      entry?.kind === "node" &&
      entry.rowDisplay?.mode === "pages" &&
      this.remotePages(collectionId)
    );
  }
  /**
   * ADR-315 Phase 5 증분 5g — a Table record's pinned rows as its rows' requests name them: the
   * key field, the keys, and whether they show past the search · filters (`keepPinnedRows`).
   * Undefined = none, or rows that are all here (local — read out of them).
   */
  private tablePinRequest(tableId: string):
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
    const nodeId = this.currentRoot?.domInputs.get(tableId)?.sourceId;
    if (!collectionId || !this.collectionRowService(collectionId).remote)
      return undefined;
    if (this.rowPinsRefused(collectionId, nodeId)) return undefined;
    const field = this.rowKeyFieldOf(collectionId, nodeId);
    if (!field) return undefined;
    return {
      field,
      keys: [...pinned.top, ...pinned.bottom],
      keep:
        this.currentRoot?.domInputs.get(tableId)?.props.keepPinnedRows === true,
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
    if (Object.keys(next).length) this.tableStates.set(tableId, next);
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
          before.columnFilters === next.columnFilters &&
          before.search !== next.search,
      );
    // (ADR-315 Phase 5 — a grouped Table's open groups: their rows are read out only while open.)
    // (ADR-315 Phase 5 증분 5d — a tree's too: its record says which rows are open.)
    else if (
      before.expandedKeys !== next.expandedKeys &&
      (this.tableGroupedNow(tableId) ||
        catalogTableExpandedKeys(
          this.currentRoot?.domInputs.get(tableId)?.props,
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
    const source = this.currentRoot?.domInputs.get(tableId)?.sourceId;
    const entry = source ? this.graph?.getEntry(source as never) : undefined;
    if (entry?.kind !== "node" || !entry.binding) return;
    // (ADR-315 Phase 5 증분 5g — a server's pages: the page leaves the pinned rows out — another
    //  request — and they are asked for by key.)
    if (this.tableService(tableId).remote) this.loadRouted("filtering");
    const errors = this.currentRoot!.refreshNodes(new Set([entry.id]));
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
    const root = this.currentRoot;
    const table = root?.domInputs.get(tableId);
    if (!root || table?.ruleId !== "Table") return false;
    const service = this.tableService(tableId);
    if (!service.remote) return false;
    const source = this.graph?.getEntry(table.sourceId as never);
    const fieldMap =
      source?.kind === "node" ? source.binding?.fieldMap : undefined;
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
  private collectionTablesReadWhole(collectionId: string): boolean {
    return this.boundTableRecords(collectionId).some(({ recordId }) =>
      this.tableReadsWhole(recordId),
    );
  }
  /** A Table record resolved again for its column slices — its rows as they were read. */
  private projectTableColumns(tableId: string): void {
    const source = this.currentRoot?.domInputs.get(tableId)?.sourceId;
    if (!source) return;
    const errors = this.currentRoot!.reprojectColumns(new Set([source]));
    if (errors.length) console.error("[CatalogPreview] columns:", ...errors);
    this.syncColumnChoosers();
  }
  /** The record of a Table node (the first that draws it — a chooser names the node). */
  private tableRecordOf(tableNodeId: string): string | undefined {
    const root = this.currentRoot;
    return root
      ?.recordsOfSource(tableNodeId)
      .find((id) => root.domInputs.get(id)?.ruleId === "Table");
  }
  /** A chooser node's Menu records (under each record that draws the chooser). */
  private chooserMenusOf(chooserId: string): string[] {
    const root = this.currentRoot;
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
    const table = this.currentRoot?.domInputs.get(tableId);
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
    if (this.echoing || !this.chooserEchoed.has(menuId)) return;
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
    const root = this.currentRoot;
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
      racKey: catalogTableColumnKey({
        id: column.id,
        ...(column.htmlId ? { htmlId: column.htmlId } : {}),
      }),
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
    const root = this.currentRoot;
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
  editTableRow(rowId: string, values: Readonly<Record<string, unknown>>): void {
    const place = this.rowRecordPlace(rowId);
    const collectionId = place && this.tableCollectionOf(place.tableId);
    if (!place || !collectionId) return;
    const result = this.update(collectionId, place.key, values);
    if (!result.ok)
      console.warn(`[interactions] Editable cell: ${result.reason ?? ""}`);
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
    const value = input[1].state.columnFilters?.find(
      (filter) => filter.column === input[0].key,
    )?.condition.value;
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
    const condition = table.state.columnFilters?.find(
      (filter) => filter.column === column.key,
    )?.condition;
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
  chooserTableOf(recordId: string): string | undefined {
    const root = this.currentRoot;
    const graph = this.graph;
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
  private syncColumnChoosers(): void {
    const root = this.currentRoot;
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
  private echoColumnChoosers(): void {
    const write = this.runtimePropsWriter;
    const root = this.currentRoot;
    if (!write || !root || !this.columnChoosers.size) return;
    this.echoing = true;
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
      this.echoing = false;
    }
  }
  /** The project's remembered Table states as stored (`{}` = none · no storage). */
  private rememberedTableStates(): Record<string, unknown> {
    const projectId = this.graph?.projectId;
    return projectId
      ? catalogStoredTableStates(this.options.tableStateStorage, projectId)
      : {};
  }
  /** Keeps a 「Remember state」 Table's state in the browser (사용자 결정 1): its remembered slices. */
  private rememberTableState(tableId: string): void {
    const storage = this.options.tableStateStorage;
    const projectId = this.graph?.projectId;
    if (!storage || !projectId) return;
    if (this.currentRoot?.domInputs.get(tableId)?.props.rememberState !== true)
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
  private restoreTableStates(): void {
    const root = this.currentRoot;
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
  private startTableSearches(): void {
    const root = this.currentRoot;
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
   * The view's rule runtime writes records' runtime props (`CatalogPreviewInteractions`): a sort
   * the session restored is told to RAC through it — the header's indicator and `aria-sort`.
   */
  attachRuntimeProps(
    write: (id: string, patch: Readonly<Record<string, unknown>>) => void,
  ): void {
    this.runtimePropsWriter = write;
    for (const tableId of [...this.pendingSortEchoes])
      this.echoTableSort(tableId);
    this.echoColumnChoosers();
  }
  /**
   * A Table record's sort told to its view: RAC's `sortDescriptor` (the first entry — RAC's header
   * holds one sort, `aria-sort` on one header) and every entry by RAC key (`_sortEntries` — the
   * order marks of the Columns sorted after the first, ADR-315 Phase 2).
   */
  private echoTableSort(tableId: string): void {
    const write = this.runtimePropsWriter;
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
    this.echoing = true;
    try {
      write(tableId, {
        sortDescriptor: entries[0],
        _sortEntries: entries.length > 1 ? entries : undefined,
      });
    } finally {
      this.echoing = false;
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
      this.currentRoot?.domInputs.get(tableId)?.props,
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
    if (this.echoing) return;
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
    const write = this.runtimePropsWriter;
    if (!write) return; // (nothing drawn yet — the first render reads the state)
    this.widthsRevision += 1;
    this.echoing = true;
    try {
      write(tableId, { _widthsRevision: this.widthsRevision });
    } finally {
      this.echoing = false;
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
    const table = this.currentRoot?.domInputs.get(tableId);
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
    const root = this.currentRoot;
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
      .find(
        (item) =>
          !!item &&
          catalogTableColumnKey({
            id: item.id,
            ...(item.htmlId ? { htmlId: item.htmlId } : {}),
          }) === racKey,
      );
    if (!record) return undefined;
    const shape = this.tableShape(tableId);
    const allowsFiltering = authored || record.props.allowsFiltering === true;
    const allowsGrouping = authored || record.props.allowsGrouping === true;
    // (ADR-315 Phase 4 증분 4c — a filter compares the Column's data field: its kind's comparisons
    //  the Table's rows' request carries. No field — an unbound Table, a role's column — none.)
    const field =
      allowsFiltering || allowsGrouping
        ? this.tableField(tableId, column.key)?.field
        : undefined;
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
                (op) => !shape.filters || shape.filters(op),
              )
            : [],
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
    const condition = table.state.columnFilters?.find(
      (filter) => filter.column === column.key,
    )?.condition;
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
    const table = this.currentRoot?.domInputs.get(tableId);
    const source = table && this.graph?.getEntry(table.sourceId as never);
    const binding = source?.kind === "node" ? source.binding : undefined;
    return this.collectionRowService(
      binding?.collectionId.replace(/^data:collection:/, ""),
    );
  }
  /** How a collection's rows are served (`CatalogTableRowService`). */
  private collectionRowService(collectionId: string | undefined) {
    const collection = collectionId
      ? this.collections.find((item) => item.id === collectionId)
      : undefined;
    const endpoint =
      collection && !collection.useMockData
        ? this.endpointFilling(collection)
        : undefined;
    return {
      remote: !!endpoint,
      readsSortTemplate:
        !!endpoint && endpointReadsTemplate(endpoint, "sortDescriptor"),
      ...(endpoint?.querySerialization
        ? { format: endpoint.querySerialization }
        : {}),
    };
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
    const graph = this.graph;
    const table = this.currentRoot?.domInputs.get(tableId);
    const source = table && graph?.getEntry(table.sourceId as never);
    const binding = source?.kind === "node" ? source.binding : undefined;
    if (!graph || !table || !source || !binding) return undefined;
    if (!this.tableColumns(tableId).some((column) => column.key === columnKey))
      return undefined;
    const collectionId = binding.collectionId.replace(/^data:collection:/, "");
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    const authored = catalogBindingQuery(
      graph,
      binding,
      source.id,
      this.stateSource(),
      undefined,
      componentInstancePath(table, source.id),
    );
    const base = authored ?? NO_VIEW_QUERY;
    const schema = (collection?.schema ?? []).flatMap((field) =>
      field.id && field.key
        ? [{ id: field.id, key: field.key, type: field.type }]
        : [],
    );
    const fields = base.queries.length
      ? viewSchemaAt({ queries: base.queries, schema }, base.queries.length)
      : schema;
    const field = fields.find((item) => item.key === columnKey);
    return field
      ? { binding, collectionId, collection, base, fields, field }
      : undefined;
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
    const { binding, collectionId, collection, base, fields, field } = read;
    const remote = !!collection && !collection.useMockData;
    const partial =
      remote &&
      (this.loadArguments.get(collectionId)?.cursor !== undefined ||
        !!this.serverView(collectionId));
    const fieldId = (
      field.id.startsWith("data:field:") ? field.id : `data:field:${field.id}`
    ) as `data:field:${string}`;
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
            catalogRowSlicesView(this.recordRowSlices(tableId), fields),
            fieldId,
          ),
        },
      },
      this.itemSources(),
      "records",
    );
    if (!rows) return undefined;
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
      loaded: this.collectionItems(collectionId).length,
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
    const server = this.serverSort(tableId, state.sort?.[0]);
    if (server) {
      this.serverSortedTables.add(tableId);
      this.sortCollection(server.collectionId, server.sortDescriptor).catch(
        (error: unknown) =>
          console.warn("[CatalogPreview] 서버 정렬을 읽지 못했다:", error),
      );
      return;
    }
    this.serverSortedTables.delete(tableId);
    // (ADR-315 Phase 2 · 3 — a Table whose request carries its view: the state is that view's,
    //  another request — `loadRouted` loads when the request changed (S2 `sorting` · `filtering`).)
    if (this.tableService(tableId).remote) {
      clearTimeout(this.viewReloadTimer);
      if (typing)
        this.viewReloadTimer = setTimeout(() => this.loadRouted(load), 300);
      else this.loadRouted(load);
    }
    // (A local paged list in another order starts over at its first page; its Paginations follow —
    //  `pageRows` cannot tell: not every read of the list's rows carries its sort.)
    const source = this.currentRoot?.domInputs.get(tableId)?.sourceId;
    const entry = source ? this.graph?.getEntry(source as never) : undefined;
    if (entry?.kind === "node" && entry.binding) {
      const collectionId = entry.binding.collectionId;
      const unit =
        entry.rowDisplay?.mode === "pages" &&
        !this.remotePages(collectionId.replace(/^data:collection:/, ""))
          ? this.pageUnit(collectionId, entry.id)
          : undefined;
      if (unit && unit.page !== 1) {
        unit.page = 1;
        this.showPage(collectionId, entry.id);
        return;
      }
    }
    // (The sorted Table resolves again — its bound node alone: before, every bound owner of every
    //  root did, 2026-11-20. A record whose source holds no binding: every bound owner, as before
    //  — an authored Table's Rows are ordered by the DOM, `catalogTableSortedRows`.)
    // (ADR-315 Phase 3 — the state changes which rows show and their order, not a row's data: a
    //  row at its old place keeps its records, and a virtual Table's rows in view come first.)
    if (entry?.kind === "node" && entry.binding) this.stageRowWindows(entry.id);
    const errors =
      (entry?.kind === "node" && entry.binding
        ? this.currentRoot?.reorderRows(new Set([entry.id]))
        : this.currentRoot?.refreshRows()) ?? [];
    if (errors.length) console.error("[CatalogPreview] sort:", ...errors);
  }
  /** The record drawing `ownerId` on `recordId`'s chain (itself or an ancestor). */
  ownerRecord(recordId: string, ownerId: string): string | undefined {
    const root = this.currentRoot;
    for (
      let record = root?.domInputs.get(recordId);
      record;
      record = root!.domInputs.get(record.parentId)
    )
      if (
        record.sourceId === ownerId ||
        record.collapsedSourceIds?.includes(ownerId)
      )
        return record.id;
    return undefined;
  }
  /** The record the page's DOM starts at (its body node's record). */
  get pageRecord(): string | undefined {
    const pageId = this.pageId;
    const page = pageId ? this.graph?.getEntry(pageId) : undefined;
    const body = page?.kind === "page" ? page.children[0] : undefined;
    return body ? this.currentRoot?.recordsOfSource(body)[0] : undefined;
  }

  private openState(projectId: string): void {
    if (this.state) {
      this.state.switchProject(projectId);
      return;
    }
    this.state = createRuntimeState({
      projectId,
      ...(this.options.stateStorage !== undefined
        ? { storage: this.options.stateStorage }
        : {}),
    });
    // A value changed (a write, a page entry, a definition reset): its readers resolve again.
    this.state.subscribe((changed) => {
      const names = new Set<string>();
      for (const id of changed) {
        const name = this.state!.getDefinition(id)?.def.name;
        if (name) names.add(name);
        // (ADR-284 Phase 6 — a prop's value condition names its variable by id.)
        names.add(id);
      }
      if (!names.size || !this.currentRoot) return;
      const errors = this.currentRoot.refreshState(names);
      if (errors.length) console.error("[CatalogPreview] state:", ...errors);
      // ADR-284 Decision 6: a request reading a written variable (an endpoint's `{{ name }}`, a
      // view it carries) loads again — after a pause when a text condition reads it (typing).
      this.reloadForVariables(changed);
      this.reportState();
      this.changed();
    });
  }
  private reportScheduled = false;
  /** The variables' current values to the Builder (once per task — several writes, one report). */
  private reportState(): void {
    const report = this.options.reportState;
    const graph = this.graph;
    if (!report || !graph || !this.state || this.reportScheduled) return;
    this.reportScheduled = true;
    queueMicrotask(() => {
      this.reportScheduled = false;
      const values: Record<string, unknown> = {};
      for (const { def } of catalogRuntimeVariables(graph, this.variables)) {
        const read = this.readVariable({ variableId: def.id } as never);
        if (!read) continue;
        // (A RAC `Selection` as its keys — the message carries plain values.)
        values[def.id] =
          read.value instanceof Set ? [...read.value] : read.value;
      }
      report(values);
    });
  }
  /**
   * The requests a variable write changes load again (`loadRouted` — only a URL · body other than
   * the last load's). A text comparison (`contains` · `startsWith` · `endsWith`) reading a written
   * variable waits 300 ms (the newest text wins); any other write loads at once.
   */
  private reloadForVariables(changed: Iterable<string>): void {
    const ids = new Set(changed);
    const typing = this.collections.some((collection) => {
      const view = collection.id ? this.serverView(collection.id) : undefined;
      const visit = (item: {
        items?: readonly unknown[];
        op?: string;
        value?: unknown;
      }): boolean =>
        item.items
          ? item.items.some((child) => visit(child as typeof item))
          : [
              "contains",
              "startsWith",
              "endsWith",
              "notContains",
              "notStartsWith",
              "notEndsWith",
            ].includes(item.op ?? "") &&
            typeof item.value === "string" &&
            item.value.startsWith("!var.") &&
            ids.has(item.value.slice("!var.".length).split(".")[0]!);
      return !!view && view.query.queries.some((query) => visit(query.where));
    });
    clearTimeout(this.viewReloadTimer);
    // (Another query of the same collection: S2's `filtering` — the rows stay while it loads.)
    if (!typing) {
      this.loadRouted("filtering");
      return;
    }
    this.viewReloadTimer = setTimeout(() => this.loadRouted("filtering"), 300);
  }
  /** The runtime state's definitions: the document's variables and the project's. */
  private syncDefinitions(): void {
    const graph = this.graph;
    if (!this.state || !graph) return;
    this.state.setDefinitions({
      projectVariables: [],
      variables: catalogRuntimeVariables(graph, this.variables).map((entry) =>
        // ADR-294 Decision 7 — a component's input variable is the value its instance passes,
        // read at the record that draws the origin root (a rule's `!var` · Set state refused).
        isInputVariable(graph.getEntry(entry.def.id as never))
          ? {
              ...entry,
              derive: (scope) => {
                const root = this.currentRoot;
                const read =
                  root && scope.kind === "element"
                    ? resolveInputVariableAt(
                        graph,
                        entry.def.id,
                        scope.instanceKey,
                        root.domInputs,
                        this.pageId,
                        this.stateSource(),
                      )
                    : undefined;
                return read ? read.value : entry.def.defaultValue;
              },
            }
          : entry,
      ),
    });
  }

  private applyTheme(force: boolean): boolean {
    const state = this.options.theme?.(this.runtime!.graph);
    if (!state || (!force && state.key === this.themeKey)) return false;
    const changed = state.key !== this.themeKey;
    this.themeKey = state.key;
    this.colorMode = state.colorMode;
    state.install();
    this.options.applyTheme?.(state);
    return changed;
  }
  private shapeRoot:
    | {
        definitionId: string;
        revision: number;
        theme?: string;
        root: CatalogCompositionRoot;
      }
    | undefined;
  /**
   * The app's toast shape drawn (user 2026-11-01 — RAC `MyToastRegion`): a root in the shape
   * component's definition view, one per document revision · theme. `undefined` = S2's toast
   * (no shape chosen, or the component gone).
   */
  toastShapeRoot(): CatalogCompositionRoot | undefined {
    const graph = this.graph;
    const project = graph?.getEntry(graph.projectId);
    const definitionId =
      project?.kind === "project" ? project.toastShapeId : undefined;
    if (!graph || !this.runtime || !definitionId) return undefined;
    if (graph.getEntry(definitionId)?.kind !== "definition") return undefined;
    const known = this.shapeRoot;
    if (
      known &&
      known.definitionId === definitionId &&
      known.revision === graph.revision &&
      known.theme === this.themeKey
    )
      return known.root;
    const root = new CatalogCompositionRoot(
      this.runtime,
      this.options.engine(),
      this.options.viewport,
      undefined,
      undefined,
      undefined,
      this.options.locale,
      {
        ...this.options.root,
        breakpoint: this.breakpoint,
        definitionView: definitionId,
        state: this.stateSource(),
        ...(this.colorMode ? { colorMode: this.colorMode } : {}),
      },
    );
    this.shapeRoot = {
      definitionId,
      revision: graph.revision,
      theme: this.themeKey,
      root,
    };
    return root;
  }
  private createRoot(): CatalogCompositionRoot {
    this.restoreDue = true;
    return new CatalogCompositionRoot(
      this.runtime!,
      this.options.engine(),
      this.options.viewport,
      undefined,
      undefined,
      undefined,
      this.options.locale,
      {
        ...this.options.root,
        breakpoint: this.breakpoint,
        // ADR-307 후속 (F10): one route is shown — the other pages are shells until shown
        // (`fillShown`).
        ...(this.openingPage()
          ? { stagedLoad: { firstPage: this.openingPage() } }
          : {}),
        rows: Object.assign(
          (
            binding: Parameters<typeof catalogBoundRows>[0],
            kind: Parameters<typeof catalogBoundRows>[2],
            ownerId?: string,
            _instancePath?: readonly string[],
            slices?: CatalogRowSlices,
          ) => this.boundRows(binding, kind, ownerId, slices),
          {
            pages: (listId: string, paginationId: string) => {
              let set = this.paginationsOf.get(listId);
              if (!set) this.paginationsOf.set(listId, (set = new Set()));
              set.add(paginationId);
              const info = this.pageOf(listId);
              return info
                ? { count: info.count, page: info.page, size: info.size }
                : undefined;
            },
            tableColumns: (tableId: string, chooserId: string) => {
              let set = this.columnChoosers.get(tableId);
              if (!set) this.columnChoosers.set(tableId, (set = new Set()));
              set.add(chooserId);
              return this.columnChoices(tableId)?.columns;
            },
          },
        ),
        // (A Table its server sorts keeps the server's order: its `sort` slice is not the rows'.)
        tableState: (tableId) =>
          this.serverSortedTables.has(tableId)
            ? withoutSort(this.tableState(tableId))
            : this.tableStates.get(tableId),
        rowWindow: (owner) => this.rowWindowOf(owner),
        state: this.stateSource(),
        ...(this.colorMode ? { colorMode: this.colorMode } : {}),
      },
    );
  }
  /** The bound node of a row owner's identity (`instancePath::nodeId`). */
  private rowOwnerNode(owner: string): string {
    return owner.slice(owner.lastIndexOf("::") + 2);
  }
  /** A virtual-scrolled list's record rows (`CatalogRootOptions.rowWindow`); none = every row. */
  private rowWindowOf(owner: string): CatalogRowWindow | undefined {
    return this.rowDisplayOf(this.rowOwnerNode(owner))?.mode === "virtual"
      ? (this.stagedRowWindows.get(owner) ??
          this.rowWindows.get(owner) ?? {
            start: 0,
            limit: CATALOG_VIRTUAL_ROW_WINDOW,
          })
      : undefined;
  }
  /**
   * ADR-315 Phase 3 — the rows of `nodeId` (a virtual-scrolled Table's bound node) are about to be
   * read again for another sort · search · filter: until the frame paints its window is the rows in
   * view (and `CATALOG_STAGED_ROW_MARGIN` on each side), and the rest of the window comes in after
   * the paint (`moveRowWindow` — the rows drawn first keep their records). The rows off screen are
   * most of a window (60 rows over 14 in view, live): resolving them before the paint is what a
   * keystroke waited for. A key typed before the paint stages again — the rest waits for that
   * frame. A window with no rows reported in view, or one the rows in view nearly fill, is left.
   */
  private stageRowWindows(nodeId: string): void {
    for (const [owner, seen] of this.rowsSeen) {
      if (this.rowOwnerNode(owner) !== nodeId) continue;
      const window = this.rowWindows.get(owner) ?? {
        start: 0,
        limit: CATALOG_VIRTUAL_ROW_WINDOW,
      };
      const limit = seen.last - seen.first + 1 + 2 * CATALOG_STAGED_ROW_MARGIN;
      if (limit + CATALOG_ROW_WINDOW_STEP > window.limit) {
        this.stagedRowWindows.delete(owner);
        continue;
      }
      const turn = (this.stagedTurn += 1);
      this.stagedRowWindows.set(owner, {
        start: Math.max(0, seen.first - CATALOG_STAGED_ROW_MARGIN),
        limit,
        turn,
      });
      afterPaint(() => {
        if (this.stagedRowWindows.get(owner)?.turn !== turn) return;
        this.stagedRowWindows.delete(owner);
        const errors = this.currentRoot?.moveRowWindow(new Set([nodeId])) ?? [];
        if (errors.length) console.error("[CatalogPreview] rows:", ...errors);
      });
    }
  }
  /**
   * Rows `[first, last]` of a windowed owner are coming into view (its `Layout`'s — the overscan
   * included; a Table drawn without the `Virtualizer` gives them all): the window is centred on
   * them, and follows once they are `CATALOG_ROW_WINDOW_STEP` rows off its centre — a move brings
   * in that many rows, whatever the scroll speed (2026-11-19: a window three times the rows in view
   * moved a quarter of its spare rows at once, 40 ~ 60 rows — live at 4x a 167 ms frame every few
   * moves). It holds the rows in view and a step on each side, and only grows (a window
   * shrinking and growing with the rows in view would move for each). The last report of a render
   * pass decides (a microtask — before the frame paints).
   */
  showRows(owner: string, first: number, last: number, total: number): void {
    const asked = this.rowsAsked.has(owner);
    this.rowsAsked.set(owner, { first, last, total });
    this.rowsSeen.set(owner, { first, last });
    if (asked) return;
    queueMicrotask(() => {
      const rows = this.rowsAsked.get(owner);
      this.rowsAsked.delete(owner);
      if (!rows) return;
      // (A staged window — `stageRowWindows`: the rows in view inside it wait for the frame; rows
      //  outside it — the Table scrolled first — end the staging, and the window moves whole.)
      const staged = this.stagedRowWindows.get(owner);
      if (staged) {
        const start = Math.max(
          0,
          Math.min(staged.start, rows.total - staged.limit),
        );
        if (rows.first >= start && rows.last < start + staged.limit) return;
        this.stagedRowWindows.delete(owner);
      }
      const current = this.rowWindows.get(owner) ?? {
        start: 0,
        limit: CATALOG_VIRTUAL_ROW_WINDOW,
      };
      const inView = rows.last - rows.first + 1;
      const limit = Math.min(
        rows.total,
        Math.max(current.limit, inView + 2 * CATALOG_ROW_WINDOW_STEP),
      );
      const start = Math.max(
        0,
        Math.min(
          Math.round((rows.first + rows.last + 1) / 2 - limit / 2),
          rows.total - limit,
        ),
      );
      // (A staging just ended: the records are the staged rows — the window is read again even
      //  where it is.)
      if (!staged) {
        if (start === current.start && limit === current.limit) return;
        // (Less than a step off, the rows in view inside the window — at the data's ends the
        //  window cannot centre, so the rows are checked themselves.)
        if (
          limit === current.limit &&
          Math.abs(start - current.start) < CATALOG_ROW_WINDOW_STEP &&
          rows.first >= current.start &&
          rows.last < current.start + current.limit
        )
          return;
      }
      this.rowWindows.set(owner, { start, limit });
      const errors =
        this.currentRoot?.moveRowWindow(new Set([this.rowOwnerNode(owner)])) ??
        [];
      if (errors.length) console.error("[CatalogPreview] rows:", ...errors);
    });
  }
  /** ADR-310 Phase 7 — a list node's row display (its document `rowDisplay`). */
  private rowDisplayOf(ownerId: string): CatalogRowDisplay | undefined {
    const entry = this.graph?.getEntry(ownerId as never);
    return entry?.kind === "node" ? entry.rowDisplay : undefined;
  }
  /** A paged list's query unit (created at page 1). */
  private pageUnit(collectionId: string, ownerId: string): CatalogPageUnit {
    const key = displayWindowKey(collectionId, ownerId);
    let unit = this.pageUnits.get(key);
    if (!unit) this.pageUnits.set(key, (unit = { page: 1, cursors: [] }));
    return unit;
  }
  /** A collection that loads from its endpoint (not its mock rows) — its pages are requests. */
  private remotePages(collectionId: string): boolean {
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    return (
      !!collection &&
      !collection.useMockData &&
      !!this.endpointFilling(collection) &&
      // (ADR-315 Phase 5 증분 5g — a Table reading every row pages the whole rows here: a group
      //  · a total over one server page is not the data's.)
      !this.collectionTablesReadWhole(collectionId)
    );
  }
  /** A paged list's rows: its page of the collection (local), or its unit's loaded page (remote). */
  private pageRows(
    binding: Parameters<typeof catalogBoundRows>[0],
    kind: Parameters<typeof catalogBoundRows>[2],
    ownerId: string,
    display: CatalogRowDisplay,
    slices?: CatalogRowSlices,
  ) {
    const id = binding.collectionId.replace(/^data:collection:/, "");
    const unit = this.pageUnit(binding.collectionId, ownerId);
    const size = unit.size ?? catalogRowDisplaySize(display);
    if (this.remotePages(id)) {
      if (!unit.items) {
        if (!unit.request)
          void this.loadPageUnit(binding.collectionId, ownerId, unit.page);
        return Object.assign([] as CatalogBoundRow[], {
          loadingState: "loading" as const,
        }) as CatalogBoundRows;
      }
      const rows = catalogBoundRows(
        binding,
        this.itemSources(new Map([[id, unit.items]])),
        kind,
        size,
        0,
        slices,
      );
      return rows
        ? Object.assign(rows, {
            loadingState: unit.request
              ? ("loading" as const)
              : ("idle" as const),
          })
        : rows;
    }
    // (A sort · a filter — another query — starts the list over at page 1; its Paginations follow.)
    const query = JSON.stringify(binding.query ?? null);
    if (unit.query !== undefined && unit.query !== query && unit.page !== 1) {
      unit.page = 1;
      queueMicrotask(() => this.showPage(binding.collectionId, ownerId));
    }
    unit.query = query;
    const rows = catalogBoundRows(
      binding,
      this.itemSources(),
      kind,
      unit.page * size,
      (unit.page - 1) * size,
      slices,
    );
    if (rows) unit.total = rows.total ?? (unit.page - 1) * size + rows.length;
    return rows ? Object.assign(rows, { loadingState: "idle" as const }) : rows;
  }
  /**
   * ADR-310 Phase 7 — a paged list's page, the page count (absent = unknown: a remote endpoint
   * that reads no `{{ page }}` steps back and forth by its cursor) and the steps it allows.
   * Undefined = not a paged list.
   */
  pageOf(listId: string):
    | {
        page: number;
        count?: number;
        /** Rows a page — the viewer's pick, else the document's. */
        size: number;
        canPrevious: boolean;
        canNext: boolean;
      }
    | undefined {
    const entry = this.graph?.getEntry(listId as never);
    if (entry?.kind !== "node" || entry.rowDisplay?.mode !== "pages")
      return undefined;
    const binding = entry.binding;
    if (!binding) return undefined;
    const id = binding.collectionId.replace(/^data:collection:/, "");
    const unit = this.pageUnit(binding.collectionId, listId);
    const size = unit.size ?? catalogRowDisplaySize(entry.rowDisplay);
    const remote = this.remotePages(id);
    const numbered =
      !remote || endpointReadsTemplate(this.queryEndpoint(id), "page");
    const count =
      numbered && unit.total !== undefined
        ? Math.max(1, Math.ceil(unit.total / size))
        : undefined;
    return {
      page: unit.page,
      ...(count !== undefined ? { count } : {}),
      size,
      canPrevious: unit.page > 1,
      canNext:
        count !== undefined
          ? unit.page < count
          : unit.cursors[unit.page] !== undefined,
    };
  }
  /** ADR-310 Phase 7 — show a paged list's page (a number, or the one before · after). */
  async goToPage(
    listId: string,
    to: number | "previous" | "next",
  ): Promise<void> {
    const info = this.pageOf(listId);
    const entry = this.graph?.getEntry(listId as never);
    const binding = entry?.kind === "node" ? entry.binding : undefined;
    if (!info || !binding) return;
    const page =
      to === "previous" ? info.page - 1 : to === "next" ? info.page + 1 : to;
    if (
      page < 1 ||
      page === info.page ||
      (info.count !== undefined ? page > info.count : page > info.page + 1)
    )
      return;
    const unit = this.pageUnit(binding.collectionId, listId);
    const id = binding.collectionId.replace(/^data:collection:/, "");
    if (this.remotePages(id))
      await this.loadPageUnit(binding.collectionId, listId, page);
    else {
      unit.page = page;
      this.showPage(binding.collectionId, listId);
    }
  }
  /**
   * 2026-11-19 — a Pagination's 「Rows per page」 Select: the viewer's page size for a paged list (the
   * document's `rowDisplay.size` stays) — the list starts over at page 1.
   */
  async setPageSize(listId: string, size: number): Promise<void> {
    const entry = this.graph?.getEntry(listId as never);
    const binding = entry?.kind === "node" ? entry.binding : undefined;
    if (
      !binding ||
      entry?.kind !== "node" ||
      entry.rowDisplay?.mode !== "pages"
    )
      return;
    if (!Number.isInteger(size) || size < 1) return;
    const unit = this.pageUnit(binding.collectionId, listId);
    if ((unit.size ?? catalogRowDisplaySize(entry.rowDisplay)) === size) return;
    unit.size = size;
    unit.page = 1;
    unit.cursors = [];
    const id = binding.collectionId.replace(/^data:collection:/, "");
    if (this.remotePages(id))
      await this.loadPageUnit(binding.collectionId, listId, 1);
    else this.showPage(binding.collectionId, listId);
  }
  /** One page of a remote collection for a paged list (its own request — Decision 12). */
  private async loadPageUnit(
    collectionId: string,
    listId: string,
    page: number,
  ): Promise<void> {
    const id = collectionId.replace(/^data:collection:/, "");
    const unit = this.pageUnit(collectionId, listId);
    const entry = this.graph?.getEntry(listId as never);
    const size =
      unit.size ??
      catalogRowDisplaySize(
        entry?.kind === "node" ? entry.rowDisplay : undefined,
      );
    unit.request?.abort();
    const controller = new AbortController();
    unit.request = controller;
    const endpoint = this.queryEndpoint(id);
    const numbered = endpointReadsTemplate(endpoint, "page");
    const cursor = numbered ? undefined : unit.cursors[page - 1];
    try {
      await Promise.allSettled([...this.pendingSubmits]);
      const answer = await loadCollectionEndpoint(
        endpoint,
        controller.signal,
        this.endpointTemplateFor(id, cursor, { page, pageSize: size }),
        cursor,
      );
      if (unit.request !== controller) return;
      const intake = intakeQueryItems(
        answer.items,
        this.collections.find((item) => item.id === id),
      );
      unit.items = (Array.isArray(intake) ? intake : [intake]).filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object",
      );
      unit.page = page;
      if (answer.total !== undefined) unit.total = answer.total;
      unit.cursors[page] = answer.cursor;
    } catch (error) {
      if (unit.request !== controller) return;
      console.warn(`[CatalogPreview] ${id} page ${page}:`, error);
    } finally {
      if (unit.request === controller) unit.request = undefined;
    }
    this.showPage(collectionId, listId);
  }
  /** A page change shows: the list's rows and its Paginations' numbers resolve again. */
  private showPage(collectionId: string, listId: string): void {
    const errors = [
      ...(this.currentRoot?.refreshRows(new Set([collectionId])) ?? []),
      ...(this.currentRoot?.refreshNodes(
        new Set(this.paginationsOf.get(listId) ?? []),
      ) ?? []),
    ];
    if (errors.length) console.error("[CatalogPreview] page:", ...errors);
    this.changed();
  }
  /** A reload · sort · filter starts a collection's paged lists over at page 1. */
  private resetPages(collectionId: string): void {
    const prefix = displayWindowKey(collectionId, "");
    for (const [key, unit] of this.pageUnits) {
      if (!key.startsWith(prefix)) continue;
      const listId = key.slice(prefix.length);
      unit.page = 1;
      unit.cursors = [];
      // (A reload is a remote collection's: a local list's sort · filter resets in `pageRows`.)
      const id = collectionId.replace(/^data:collection:/, "");
      if (this.remotePages(id))
        void this.loadPageUnit(`data:collection:${id}`, listId, 1);
    }
  }

  /** What `{{ }}` reads in the Preview: project variables, runtime values, route params. */
  private stateSource(): CatalogStateSource {
    return {
      projectVariables: () => this.variables,
      read: (variableId, scope) => this.readState(variableId, scope),
      params: () => this.params,
    };
  }
  private changed(): void {
    // (A root built · a page filled: its 「Remember state」 Tables take what the browser kept.)
    if (this.restoreDue) {
      this.restoreDue = false;
      if (this.options.tableStateStorage) this.restoreTableStates();
      this.startTableSearches();
    }
    this.syncColumnChoosers();
    this.version += 1;
    for (const listener of [...this.listeners]) listener();
  }
}

/** ADR-310 Phase 7 — a paged list's query unit (Decision 12). */
interface CatalogPageUnit {
  page: number;
  /** A remote page's loaded items (absent = not loaded — a local list's pages are the collection's). */
  items?: Record<string, unknown>[];
  /** The rows in all (the collection's, or the endpoint's `totalPath`) — the page count. */
  total?: number;
  /** A cursor-only endpoint's cursor of each page (`cursors[n]` loads page n + 1). */
  cursors: (string | undefined)[];
  request?: AbortController;
  /** The query the page was of (a local list's sort · filter — another one starts at page 1). */
  query?: string;
  /** The viewer's rows per page (a Pagination's 「Rows per page」 Select) over the document's. */
  size?: number;
}

/** A display window's key: the collection (without its prefix) and the bound node. */
/**
 * A virtual-scrolled Table's record rows (2026-11-19): the rows around the ones shown. The rest are
 * keyed Rows without content until the window reaches them.
 */
export const CATALOG_VIRTUAL_ROW_WINDOW = 60;
/**
 * The rows a window move brings in (`CatalogPreviewSession.showRows`). A move costs about the same
 * whatever it brings (RAC draws the rows in view again for a changed collection, the Table's own
 * records are resolved again — live 9 ms at 1x for 1,000 rows) plus each row's records (0.45 ms):
 * 6 rows a move took 9.5 ms a frame of a fast scroll where 16 ~ 20 take 6.
 */
export const CATALOG_ROW_WINDOW_STEP = 16;
/**
 * ADR-315 Phase 3 — the rows a staged window holds on each side of the rows in view
 * (`CatalogPreviewSession.stageRowWindows`): the rows a frame's scroll would bring in before the
 * rest of the window arrives (it arrives after one paint).
 */
export const CATALOG_STAGED_ROW_MARGIN = 2;
/** Runs `run` once the frame under way painted (a task after its animation frame). */
function afterPaint(run: () => void): void {
  if (typeof requestAnimationFrame === "function")
    requestAnimationFrame(() => setTimeout(run, 0));
  else setTimeout(run, 0);
}
function displayWindowKey(collectionId: string, ownerId: string): string {
  return `${collectionId.replace(/^data:collection:/, "")}\u0001${ownerId}`;
}
