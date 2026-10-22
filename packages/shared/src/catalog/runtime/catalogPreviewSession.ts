import type { CatalogGraph } from "../document/graph";
import type {
  BreakpointName,
  CatalogLibrary,
  EntryId,
} from "../document/types";
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
import type { CatalogTableSort } from "./tableSort";
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
import { CATALOG_PARAMS_ROOT, catalogRuntimeVariables } from "./stateTemplate";
import {
  catalogNotFoundPage,
  resolveCatalogRoute,
} from "./catalogPreviewRoute";
import type { LayoutEngineAPI } from "./layoutEngine";
import {
  createCollectionEndpointExecutor,
  createCollectionEndpointSubmitter,
  executeCollectionEndpoint,
} from "../../collections/executeCollectionEndpoint";
import { getItemKey } from "../../collections/resolveCollectionItems";

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

/** One `useListData` operation a rule ran on a collection (the Preview session's record). */
type CatalogItemEdit =
  | { kind: "append"; item: Record<string, unknown> }
  | { kind: "update"; key: string; patch: Record<string, unknown> }
  | { kind: "remove"; keys: readonly string[] | "all" };

/** The edits over a list of items, in order — keys as the bound components read them (`getItemKey`). */
function replayItemEdits(
  base: readonly Record<string, unknown>[],
  edits: readonly CatalogItemEdit[],
): Record<string, unknown>[] {
  let items = [...base];
  for (const edit of edits) {
    if (edit.kind === "append") items = [...items, edit.item];
    else if (edit.kind === "update")
      items = items.map((item, index) =>
        getItemKey(item, index) === edit.key ? { ...item, ...edit.patch } : item,
      );
    else if (edit.keys === "all") items = [];
    else {
      const keys = new Set(edit.keys);
      items = items.filter((item, index) => !keys.has(getItemKey(item, index)));
    }
  }
  return items;
}

export interface CatalogPreviewSessionOptions {
  /** Ask the Builder for a snapshot (`window.parent.postMessage(request, origin)`). */
  requestSnapshot: (request: CatalogPreviewSnapshotRequest) => void;
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
  /** The Builder's collections: bound collections draw their rows from them. */
  private collections: readonly CollectionDataSource[] = [];
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
  private endpoints: readonly (ApiEndpointDefinition & {
    targetCollection?: string;
  })[] = [];
  /** Endpoint submits in flight — a `reload` waits for them (`await fetch; list.reload()`). */
  private readonly pendingSubmits = new Set<Promise<unknown>>();
  /** ADR-257 Phase 4 — each Table record's Preview sort (runtime state, never the document). */
  private readonly tableSorts = new Map<string, CatalogTableSort>();
  /** The Builder's project variables (the data store's, H1). */
  private variables: readonly VariableDef[] = [];
  /**
   * The Builder's API endpoints as the shared components read them (`CollectionDataContext`):
   * FileUpload resolves its endpoint id here, an API-bound collection runs its endpoint.
   */
  private services: CollectionDataServices = catalogPreviewDataServices([]);
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
    this.receiver.subscribe((update) => {
      if (update.invalidatedIds === "all") {
        this.runtime = new CatalogRuntime(update.graph);
        this.openState(update.graph.projectId);
        this.syncDefinitions();
        this.applyTheme(true);
        this.currentRoot = this.createRoot();
      } else {
        this.syncDefinitions();
        if (this.applyTheme(false)) this.currentRoot = this.createRoot();
      }
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
      this.collections = data.collections as readonly CollectionDataSource[];
      // Items the Builder loaded again replace a `reload`'s (the newer load wins).
      for (const collection of this.collections) {
        if (!collection.id) continue;
        const received = JSON.stringify(collection.runtimeData ?? null);
        if (
          this.receivedItems.has(collection.id) &&
          this.receivedItems.get(collection.id) !== received
        )
          this.reloadedItems.delete(collection.id);
        this.receivedItems.set(collection.id, received);
      }
      this.endpoints = (data.apiEndpoints ?? []) as unknown as typeof this.endpoints;
      this.variables = (data.variables ??
        []) as unknown as readonly VariableDef[];
      this.services = catalogPreviewDataServices(
        (data.apiEndpoints ?? []) as unknown as ApiEndpointDefinition[],
      );
      this.syncDefinitions();
      if (this.currentRoot) {
        const errors = [
          ...this.currentRoot.refreshRows(),
          // A project variable added or renamed: every template reads by name.
          ...this.currentRoot.refreshState(),
        ];
        if (errors.length) console.error("[CatalogPreview] data:", ...errors);
      }
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
      const errors = this.currentRoot.refreshState(new Set([CATALOG_PARAMS_ROOT]));
      if (errors.length) console.error("[CatalogPreview] params:", ...errors);
    }
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
    const definition = this.state?.getDefinition(variableId);
    if (!this.state || !definition)
      return { ok: false, reason: `변수 없음: ${variableId}` };
    const owner = definition.owner;
    let scope: RuntimeScope;
    if (owner.kind === "element") {
      const key = instanceKeyFor?.(owner.elementId);
      const instanceKey =
        key && this.currentRoot?.domInputs.has(key)
          ? key
          : this.currentRoot?.recordsOfSource(owner.elementId)[0];
      if (!instanceKey)
        return { ok: false, reason: `변수 소유 요소 없음: ${owner.elementId}` };
      scope = { kind: "element", instanceKey };
    } else
      scope =
        owner.kind === "page"
          ? { kind: "page", pageId: owner.pageId }
          : { kind: "project" };
    const result = this.state.write({ variableId, op, value, scope });
    return result.ok
      ? { ok: true }
      : { ok: false, reason: result.reason ?? "setState 실패" };
  };
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
    if (!this.itemEdits.size && !this.reloadedItems.size) return this.collections;
    return this.collections.map((source) => {
      const reloaded = source.id && this.reloadedItems.get(source.id);
      const collection = reloaded ? { ...source, runtimeData: reloaded } : source;
      const edits = collection.id && this.itemEdits.get(collection.id);
      if (!edits) return collection;
      // (The items the snapshot shows — `resolveCollectionSnapshot`: mock when `useMockData`, else
      // the API's items, else mock.)
      const api = !collection.useMockData && !!collection.runtimeData;
      const items = replayItemEdits(
        (api ? collection.runtimeData : collection.mockData) ?? [],
        edits,
      );
      return api
        ? { ...collection, runtimeData: items }
        : { ...collection, mockData: items };
    });
  }
  /** A collection's items as the Preview shows them (the rules' edits included). */
  collectionItems(collectionId: string): readonly unknown[] {
    const collection = this.itemSources().find((item) => item.id === collectionId);
    if (!collection) return [];
    return !collection.useMockData && collection.runtimeData
      ? collection.runtimeData
      : (collection.mockData ?? []);
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
        next[key] = field.trim() === "" || Number.isNaN(number) ? field : number;
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
    const collection = this.collections.find((item) => item.id === collectionId);
    if (!collection) return { ok: false, reason: `collection 없음: ${collectionId}` };
    const edit = plan(collection, this.collectionItems(collectionId));
    if ("reason" in edit) return { ok: false, reason: edit.reason };
    this.itemEdits.set(collectionId, [...(this.itemEdits.get(collectionId) ?? []), edit]);
    const errors = this.currentRoot?.refreshRows() ?? [];
    if (errors.length) console.error(`[CatalogPreview] ${edit.kind}:`, ...errors);
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
  ): { ok: boolean; reason?: string } {
    return this.edit(collectionId, (collection) => {
      const item = this.itemFields(collection, value);
      if (
        (collection.schema ?? []).some((field) => field.key === "id") &&
        (item.id === undefined || item.id === "")
      )
        item.id = `item-${Date.now().toString(36)}-${(this.itemSerial += 1)}`;
      return { kind: "append", item };
    });
  }
  /**
   * `useListData.update(key, newValue)` — the item whose key is `key` (absent = the value's `id`)
   * takes the value's schema fields; its key fields stay. An unknown key is reported.
   */
  update(
    collectionId: string,
    key: string | undefined,
    value: Readonly<Record<string, unknown>>,
  ): { ok: boolean; reason?: string } {
    return this.edit(collectionId, (collection, items) => {
      const target = key ?? (value.id === undefined ? undefined : String(value.id));
      if (target === undefined) return { reason: "수정할 항목의 key 가 없다" };
      if (!items.some((item, index) => getItemKey(item, index) === target))
        return { reason: `항목 없음: ${target}` };
      const patch = this.itemFields(collection, value);
      for (const field of ITEM_KEY_FIELDS) delete patch[field];
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
        const present = new Set(items.map((item, index) => getItemKey(item, index)));
        const missing = keys.filter((key) => !present.has(key));
        if (!keys.length) return { reason: "삭제할 항목의 key 가 없다" };
        if (missing.length) return { reason: `항목 없음: ${missing.join(", ")}` };
      }
      return { kind: "remove", keys };
    });
  }
  private itemSerial = 0;
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
  async reload(collectionId: string): Promise<void> {
    const collection = this.collections.find((item) => item.id === collectionId);
    if (!collection) throw new Error(`collection 없음: ${collectionId}`);
    if (collection.useMockData)
      throw new Error(`${collection.name ?? collectionId} 은 목업 데이터를 쓴다 (API 연결 없음)`);
    const endpoint = this.endpoints.find(
      (item) => item.targetCollection === collection.name,
    );
    if (!endpoint)
      throw new Error(`${collection.name ?? collectionId} 을 채우는 endpoint 없음`);
    await Promise.allSettled([...this.pendingSubmits]);
    const items = await executeCollectionEndpoint(
      endpoint,
      new AbortController().signal,
    );
    this.reloadedItems.set(
      collectionId,
      (Array.isArray(items) ? items : [items]).filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object",
      ),
    );
    this.itemEdits.delete(collectionId);
    const errors = this.currentRoot?.refreshRows(new Set([`data:collection:${collectionId}`])) ?? [];
    if (errors.length) console.error("[CatalogPreview] reload:", ...errors);
    this.changed();
  }

  sortTable(tableId: string, sort: CatalogTableSort | undefined): void {
    if (sort) this.tableSorts.set(tableId, sort);
    else this.tableSorts.delete(tableId);
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
      }
      if (!names.size || !this.currentRoot) return;
      const errors = this.currentRoot.refreshState(names);
      if (errors.length) console.error("[CatalogPreview] state:", ...errors);
      this.changed();
    });
  }
  /** The runtime state's definitions: the document's variables and the project's. */
  private syncDefinitions(): void {
    const graph = this.graph;
    if (!this.state || !graph) return;
    this.state.setDefinitions({
      projectVariables: [],
      variables: catalogRuntimeVariables(graph, this.variables),
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
        rows: (binding, kind) =>
          catalogBoundRows(binding, this.itemSources(), kind),
        tableSort: (tableId) => this.tableSorts.get(tableId),
        state: {
          projectVariables: () => this.variables,
          read: (variableId, scope) => this.readState(variableId, scope),
          params: () => this.params,
        },
        ...(this.colorMode ? { colorMode: this.colorMode } : {}),
      },
    );
  }
  private changed(): void {
    this.version += 1;
    for (const listener of [...this.listeners]) listener();
  }
}
