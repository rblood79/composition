import { parseRuleValueRef } from "../../interactions/valueRef";
import { isInputVariable } from "../document/componentEvents";
import { componentInstancePath } from "./componentBoundaries";
import { resolveInputVariableAt } from "./inputVariable";
import type { CatalogGraph } from "../document/graph";
import type {
  BreakpointName,
  CatalogLibrary,
  EntryId,
  NodeEntry,
} from "../document/types";
import { definitionTypeName } from "../commands/context";
import {
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
import {
  catalogBindingQuery,
  catalogCountOnlyView,
  catalogCountlessViews,
  catalogRowQueryResolve,
  catalogRowQueryKey,
  type CatalogRowQuery,
} from "./viewQuery";
import { onFormulaEngineLoaded } from "../../collections/formula/engine";
import {
  serializeViewQueries,
  VIEW_LOCAL_LOAD_CAP,
  type SerializedViewQuery,
} from "../../collections/view/serialize";
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
  resolvedEndpointUrl,
} from "../../collections/executeCollectionEndpoint";
import {
  getItemKey,
  parentRowsToTree,
  resolveTableColumnKey,
  toItemProjectionRow,
} from "../../collections/resolveCollectionItems";
import { catalogTableColumnKey } from "./tableSort";
import type { CatalogListPosition } from "../../interactions/dispatcher";
import { catalogRuntimeData, type CatalogRuntimeData } from "./catalogData";

/**
 * The Preview's data services: the API endpoints only (bound collections draw their rows through
 * the root, not this context) — the old Preview's `createCollectionSnapshotServices` endpoint half.
 */
export function catalogPreviewDataServices(
  endpoints: ApiEndpointDefinition[],
): CollectionDataServices {
  return {
    apiEndpointService: {
      getApiEndpoints: () => endpoints,
      executeApiEndpoint: createCollectionEndpointExecutor(endpoints),
      submitApiEndpoint: createCollectionEndpointSubmitter(endpoints),
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
  /** Each collection's load (`useAsyncList.loadingState`) — what a bound Table · Skeleton shows. */
  private readonly loadingStates = new Map<string, CatalogLoadingState>();
  /** Endpoint submits in flight — a `reload` waits for them (`await fetch; list.reload()`). */
  private readonly pendingSubmits = new Set<Promise<unknown>>();
  /** ADR-257 Phase 4 — each Table record's Preview sort (runtime state, never the document). */
  private readonly tableSorts = new Map<string, CatalogTableSort>();
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
    this.receiver.subscribe((update) => {
      this.syncServices();
      if (update.invalidatedIds === "all") {
        this.runtime = new CatalogRuntime(update.graph);
        this.openState(update.graph.projectId);
        this.syncDefinitions();
        this.applyTheme(true);
        this.currentRoot = this.createRoot();
        this.reportState();
      } else {
        this.syncDefinitions();
        if (this.applyTheme(false)) this.currentRoot = this.createRoot();
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
        if (typeof id !== "string" || !Array.isArray(item.runtimeData)) continue;
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
    // Another path (`/detail/u1` → `/detail/u2`, or into the page): the `{{ params.… }}` readers
    // resolve again (the root resolves every page's records ahead).
    if (this.currentRoot) {
      const errors = this.currentRoot.refreshState(
        new Set([CATALOG_PARAMS_ROOT]),
      );
      if (errors.length) console.error("[CatalogPreview] params:", ...errors);
    }
    this.loadRouted();
    this.changed();
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
  private itemSources(): readonly CollectionDataSource[] {
    if (!this.itemEdits.size && !this.reloadedItems.size)
      return this.collections;
    return this.collections.map((source) => {
      const reloaded = source.id && this.reloadedItems.get(source.id);
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
   * The schema's fields of a rule's value: a `number` field as a number, a `boolean` one as a
   * boolean (a Form sends strings); a collection without a schema takes every field.
   */
  private itemFields(
    collection: CollectionDataSource,
    value: Readonly<Record<string, unknown>>,
  ): Record<string, unknown> {
    const schema = collection.schema ?? [];
    const types = new Map(
      schema.map((field) => [field.key, (field as { type?: string }).type]),
    );
    const next: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value)) {
      if (schema.length && !types.has(key)) continue;
      const type = types.get(key);
      if (type === "number" && typeof field === "string") {
        const number = Number(field);
        next[key] =
          field.trim() === "" || Number.isNaN(number) ? field : number;
      } else if (type === "boolean" && typeof field === "string")
        next[key] = field === "true" || field === "on";
      else next[key] = field;
    }
    return next;
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
      const items = (
        Array.isArray(page.items) ? page.items : [page.items]
      ).filter(
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
    const views = new Map<string, { query: CatalogRowQuery; nodeId: string }>();
    for (const nodeId of graph.bindingsOf(`data:collection:${collectionId}`)) {
      const entry = graph.getEntry(nodeId as never);
      const binding = entry?.kind === "node" ? entry.binding : undefined;
      if (!binding || (!binding.view && !binding.viewId)) continue;
      // A template is a different query at each drawn instance occurrence. An unused origin
      // has no request; the Canvas/Preview record path also restores collapsed inner instances.
      const root = this.currentRoot;
      const records = root?.recordsOfSource(nodeId) ?? [];
      for (const recordId of records) {
        const record = root!.domInputs.get(recordId);
        if (!record) continue;
        const query = catalogBindingQuery(
          graph,
          binding,
          nodeId,
          this.stateSource(),
          undefined,
          componentInstancePath(record, nodeId),
        );
        if (!query) continue;
        const base = {
          ...query,
          queries: catalogCountlessViews(query.queries),
        };
        views.set(catalogRowQueryKey(base), { query: base, nodeId });
      }
    }
    if (!views.size) return undefined;
    const [{ query, nodeId }] = [...views.values()];
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
    return {
      query,
      nodeId,
      serialized: serializeViewQueries(
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
                  },
                ]
              : [],
          ),
          resolve: catalogRowQueryResolve(query),
        },
        endpoint.method,
        page,
      ),
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
   * ADR-291 Decision 5 · 사용자 결정 3 — every page of a collection whose view runs here, up to
   * `VIEW_LOCAL_LOAD_CAP`; past the cap the view is refused: no rows, a notice — never a quiet
   * partial result.
   */
  private async loadAll(collectionId: string): Promise<void> {
    while (this.loadArguments.get(collectionId)?.cursor !== undefined) {
      const shown = this.collectionItems(collectionId).length;
      const total = this.loadTotals.get(collectionId);
      if ((total !== undefined && total > VIEW_LOCAL_LOAD_CAP) || shown >= VIEW_LOCAL_LOAD_CAP) {
        this.refuseView(collectionId, total ?? shown);
        return;
      }
      await this.loadMore(collectionId);
    }
  }
  /** The rows a refused view would show: none (the bound components show their empty state). */
  private refuseView(collectionId: string, count: number): void {
    const { cursor: _dropped, ...rest } = this.loadArguments.get(collectionId) ?? {};
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
    this.showLoaded(collectionId, page.items);
    if (page.selectedKeys !== undefined)
      this.selectLoaded(collectionId, page.selectedKeys, false);
    // (ADR-291 — a view that runs here needs the whole data before it is right.)
    if (this.viewLoadsAll(collectionId)) await this.loadAll(collectionId);
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
    if (page.selectedKeys !== undefined)
      this.selectLoaded(collectionId, page.selectedKeys, true);
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
  ) {
    // ADR-284 Decision 6: rows the server answered for this binding's view are its result — the
    // view does not run on them again; the total is the server's for that query.
    let binding = authored;
    if (authored.query) {
      const id = authored.collectionId.replace(/^data:collection:/, "");
      const view = this.serverView(id);
      const loaded = this.loadedViewQueries.get(id);
      const depth = loaded?.queries.length ?? 0;
      if (
        view &&
        loaded &&
        catalogRowQueryKey(loaded) ===
          catalogRowQueryKey(authored.query, depth) &&
        authored.query.queries.slice(depth).every(catalogCountOnlyView)
      ) {
        const total = this.loadTotals.get(id);
        binding = {
          ...authored,
          query: {
            ...authored.query,
            served: {
              ...(total !== undefined ? { total } : {}),
              complete: this.loadArguments.get(id)?.cursor === undefined,
              warnings: view.serialized.warnings.length,
              ...(depth < authored.query.queries.length ? { depth } : {}),
              mode: view.mode,
            },
          },
        };
      } else if (!this.collections.find((item) => item.id === id)?.useMockData)
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
    const rows = catalogBoundRows(binding, this.itemSources(), kind);
    if (!rows) return rows;
    const collectionId = binding.collectionId.replace(/^data:collection:/, "");
    return Object.assign(rows, {
      loadingState: this.loadingStates.get(collectionId) ?? "idle",
    });
  }
  /**
   * An endpoint's `{{ }}` (route params · variables) read from the session's state, each on its
   * own: an empty value is not one (Home has no `:id` — `/users/` is another resource).
   */
  private endpointTemplateFor(collectionId: string, cursor?: string) {
    // (The load's arguments as it starts — a later `setFilterText` is a later load's.)
    const args = { ...this.loadArguments.get(collectionId), cursor };
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
      if (!url || this.loadedUrls.get(collection.id) === url) continue;
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
    sort: CatalogTableSort | undefined,
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
    if (!sort) return { collectionId, sortDescriptor: undefined };
    const header = table.children
      .map((id) => root.domInputs.get(id))
      .find((record) => record?.ruleId === "TableHeader");
    const columns = (header?.children ?? [])
      .map((id) => root.domInputs.get(id))
      .filter((record) => record?.ruleId === "Column");
    const index = columns.findIndex(
      (column) =>
        !!column &&
        catalogTableColumnKey({
          id: column.id,
          ...(column.htmlId ? { htmlId: column.htmlId } : {}),
        }) === sort.column,
    );
    if (index < 0) return undefined;
    return {
      collectionId,
      sortDescriptor: {
        column: resolveTableColumnKey(columns[index]!.props, index),
        direction: sort.direction,
      },
    };
  }
  sortTable(tableId: string, sort: CatalogTableSort | undefined): void {
    if (sort) this.tableSorts.set(tableId, sort);
    else this.tableSorts.delete(tableId);
    // A bound Table whose query endpoint reads `sortDescriptor` is sorted by the server
    // (`load({sortDescriptor})`, the column as its field): the client keeps the server's order.
    const server = this.serverSort(tableId, sort);
    if (server) {
      this.serverSortedTables.add(tableId);
      this.sortCollection(server.collectionId, server.sortDescriptor).catch(
        (error: unknown) =>
          console.warn("[CatalogPreview] 서버 정렬을 읽지 못했다:", error),
      );
      return;
    }
    this.serverSortedTables.delete(tableId);
    // (Only roots showing a binding resolve again — an authored Table's Rows are ordered by the
    // DOM, `catalogTableSortedRows`.)
    const errors = this.currentRoot?.refreshRows() ?? [];
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
    | { definitionId: string; revision: number; theme?: string; root: CatalogCompositionRoot }
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
        rows: (binding, kind) => this.boundRows(binding, kind),
        tableSort: (tableId) =>
          this.serverSortedTables.has(tableId)
            ? undefined
            : this.tableSorts.get(tableId),
        state: this.stateSource(),
        ...(this.colorMode ? { colorMode: this.colorMode } : {}),
      },
    );
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
    this.version += 1;
    for (const listener of [...this.listeners]) listener();
  }
}
