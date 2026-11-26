import { RESIZABLE_PANEL_TYPE } from "./resizablePanels";
import {
  catalogResizableRemembered,
  catalogStoreResizablePanels,
  catalogStoredResizablePanels,
} from "./resizableStorage";
import {
  CatalogTableController,
  type CatalogTableHost,
} from "./catalogTableController";
import { CATALOG_NO_TABLE_STATE } from "./tableState";
import { CATALOG_NO_VIEW_QUERY } from "./viewQuery";
import {
  CATALOG_GROUP_ROW_COUNT,
  catalogTableGroupKey,
  catalogTableStateRowSlices,
  type CatalogRowSlices,
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
  type CollectionEntry,
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
import {
  catalogBoundRows,
  catalogRowListMeta,
  dataCollectionIdOf,
} from "./dataBinding";
import { COLLECTION_ROW_PROJECTION_WINDOW_LIMIT } from "../../collections/resolveCollectionItems";
import { executionModeOf } from "../../collections/executionPolicy";
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
  toItemProjectionRow,
} from "../../collections/resolveCollectionItems";

import {
  type CatalogTableSortItem,
  type CatalogTableState,
} from "./tableState";

import {
  catalogRowSlicesView,
  catalogTableSliceServable,
  catalogTableStateQueries,
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
  /** ADR-317 — several items' fields at once (a paste · a fill): one record, one key each. */
  | {
      kind: "updateMany";
      patches: readonly { key: string; patch: Record<string, unknown> }[];
    }
  | { kind: "remove"; keys: readonly string[] | "all" }
  | {
      kind: "move";
      keys: readonly string[];
      to: Exclude<CatalogListPosition, "start">;
      toParent?: string | null;
    };

/** ADR-317 Phase 4 — an edit as the session records it: its number (`edit` — one per record, a
 * several-cell write too; the session's, rising). */
type CatalogItemRecord = CatalogItemEdit & { readonly seq: number };

type CatalogItems = readonly Record<string, unknown>[];

/**
 * ADR-317 Phase 4 (breakdown §5.4) — what the edits made of an item, by the item object the replay
 * made (`replayItemEdits` — every copy the replay makes of a marked item — a tree's parent, a flat
 * tree's row — carries its mark, `carriedItem`): the edit that added it and, by field, the edit
 * that wrote it last. Read after the replay by the item's key now (`CatalogPreviewSession.editMarks`)
 * — never by the key an edit named (a positional key moves). A side table: the item's fields stay
 * the data's (a deep compare · a field read sees nothing new).
 */
const ITEM_EDIT_MARKS = new WeakMap<object, CatalogItemEditMark>();
interface CatalogItemEditMark {
  readonly added?: number;
  readonly fields?: Readonly<Record<string, number>>;
}
/** ADR-317 Phase 4 — a row's edit status shown (「Edit marks」): new or changed, its changed fields. */
export interface CatalogRowEditMark {
  readonly status: "new" | "dirty";
  readonly fields: readonly string[];
}
/** A copy the replay made of an item: the item's mark goes with it. */
function carriedItem<T extends Record<string, unknown>>(
  from: Readonly<Record<string, unknown>>,
  to: T,
): T {
  const mark = ITEM_EDIT_MARKS.get(from);
  if (mark) ITEM_EDIT_MARKS.set(to, mark);
  return to;
}
/** An item the edit wrote: its fields (the patch's) last written by edit `seq`. */
function writtenItem(
  item: Record<string, unknown>,
  patch: Readonly<Record<string, unknown>>,
  seq: number | undefined,
): Record<string, unknown> {
  const next = { ...item, ...patch };
  const mark = ITEM_EDIT_MARKS.get(item);
  if (seq === undefined) return mark ? carriedItem(item, next) : next;
  const fields = { ...mark?.fields };
  for (const field of Object.keys(patch)) fields[field] = seq;
  ITEM_EDIT_MARKS.set(next, { ...mark, fields });
  return next;
}
/** An item an edit added (`append` · `insert`) — marked with the edit (the record's own object). */
function addedItem(
  item: Record<string, unknown>,
  seq: number | undefined,
): Record<string, unknown> {
  if (seq !== undefined && !ITEM_EDIT_MARKS.has(item))
    ITEM_EDIT_MARKS.set(item, { added: seq });
  return item;
}

/** ADR-317 — why a cell of a several-item write was not written (`updateMany`). */
export type CatalogItemsWriteSkip =
  "missing" | "keyField" | "unknown" | "computed" | "unread";
/** ADR-317 — a several-item write's result: the cells written (by item key, field key) and the rest counted. */
export interface CatalogItemsWrite {
  readonly ok: boolean;
  readonly reason?: string;
  readonly written: readonly { readonly key: string; readonly field: string }[];
  readonly skipped: Partial<Record<CatalogItemsWriteSkip, number>>;
  /** ADR-317 Phase 4 — the edit's number (none written = none): a save of it clears its marks. */
  readonly seq?: number;
}

/** ADR-317 사용자 결정 8 — the fields an `update` did not write: their values were not readable. */
const catalogUnreadReason = (fields: readonly string[]) =>
  `읽을 수 없는 값이라 쓰지 않음: ${fields.join(", ")}`;

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
        return carriedItem(item, {
          ...item,
          [childrenKey]: change(childItemsOf(item, childrenKey) ?? []),
        });
      }
      const children = childItemsOf(item, childrenKey);
      return children
        ? carriedItem(item, { ...item, [childrenKey]: visit(children) })
        : item;
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
        ? carriedItem(kept, {
            ...kept,
            [childrenKey!]: mapItems(children, childrenKey, each),
          })
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
  edits: readonly (CatalogItemEdit & { readonly seq?: number })[],
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
      at(edit.parent ?? null, (level) => [
        ...level,
        addedItem(edit.item, edit.seq),
      ]);
    else if (edit.kind === "insert")
      at(
        levelOfPosition(items, edit.at, edit.parent, childrenKey, keyField),
        (level) => {
          const index = positionIndex(level, edit.at, keyField);
          return index < 0
            ? level
            : [
                ...level.slice(0, index),
                addedItem(edit.item, edit.seq),
                ...level.slice(index),
              ];
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
          ? writtenItem(item, edit.patch, edit.seq)
          : item,
      );
    else if (edit.kind === "updateMany") {
      const patches = new Map(
        edit.patches.map((each) => [each.key, each.patch]),
      );
      items = mapItems(items, childrenKey, (item, index) => {
        const patch = patches.get(itemKey(item, index, keyField));
        return patch ? writtenItem(item, patch, edit.seq) : item;
      });
    } else if (edit.keys === "all") items = [];
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
  edits: readonly (CatalogItemEdit & { readonly seq?: number })[],
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
      flat.push(carriedItem(item, { ...rest, [parentField]: parent }));
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
  /**
   * A published app — no Builder sends API rows (`CATALOG_DATA`) or runs the collections' execution
   * policy, so the session does both: every collection an endpoint fills loads by its policy (none ·
   * `auto` = on open, `interval` = on open and each period, `manual` = a rule's `reload` only), and
   * shows what was loaded — never its design sample rows (`catalogRuntimeData` `standalone`).
   * Absent = the Builder's Preview: the Builder loads a plain endpoint, the session only the ones
   * whose request is its own (a template · a cursor · a view).
   * **Why (2026-11-26 live)**: Publish sent 0 requests for a plain endpoint (also with 「Auto」) and
   * showed the sample rows.
   */
  standalone?: boolean;
}
/** ADR-315 Phase 5 증분 5g — a pinned rows' answer's key: the Table node and its pins. */
const pinAnswerKey = (
  nodeId: string,
  pins: { readonly top: readonly string[]; readonly bottom: readonly string[] },
) => `${nodeId}\u0000${JSON.stringify([pins.top, pins.bottom])}`;
/**
 * How many open groups' rows are asked for at once (`syncGroupRows`) — a browser's HTTP/1.1
 * connections to a host (6); more would only wait in its queue.
 */
const CATALOG_GROUP_REQUESTS_AT_ONCE = 6;
/** Runs loads at most `size` at a time, the rest in the order asked. */
function catalogRequestSlots(
  size: number,
): <T>(load: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async (load) => {
    if (running < size) running += 1;
    else await new Promise<void>((resume) => waiting.push(resume));
    try {
      return await load();
    } finally {
      // (The slot passes to the next one waiting, else it frees.)
      const next = waiting.shift();
      if (next) next();
      else running -= 1;
    }
  };
}
/** A Table state without its sort (a Table its server sorts — the rows keep the server's order). */
function withoutSort(state: CatalogTableState): CatalogTableState | undefined {
  if (!state.sort) return state === CATALOG_NO_TABLE_STATE ? undefined : state;
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
      ? catalogRuntimeData(graph, this.runtimeRows, {
          standalone: this.options.standalone,
        })
      : { collections: [], apiEndpoints: [], variables: [] };
  }
  /**
   * ADR-281 user decision 3, second step — what `append` · `update` · `remove` rules did, by
   * collection id, in order (`useListData`'s operations): session state (a reload drops it, the
   * author's data never sees it), replayed over the Builder's items each time they come
   * (`itemSources`).
   */
  private readonly itemEdits = new Map<string, CatalogItemRecord[]>();
  /** ADR-317 Phase 4 — the last edit's number (`CatalogItemRecord.seq` — the session's, rising). */
  private editCount = 0;
  /**
   * ADR-317 Phase 4 (사용자 결정 6 「칸까지 · 저장 성공 때도 지움」) — the edits a save sent and the
   * server took (`markEditsSaved`): a cell whose last edit is one of them is shown saved (no mark).
   * The edits stay (the values are the edits'); a load that drops them drops these too.
   */
  private readonly savedEdits = new Set<number>();
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
  /** Each collection's load (`useAsyncList.loadingState`) — what a bound Table · Skeleton shows. */
  private readonly loadingStates = new Map<string, CatalogLoadingState>();
  /** Endpoint submits in flight — a `reload` waits for them (`await fetch; list.reload()`). */
  private readonly pendingSubmits = new Set<Promise<unknown>>();
  /** Writes a record's runtime props (the view's rule runtime — `attachRuntimeProps`). */
  private runtimePropsWriter:
    | ((id: string, patch: Readonly<Record<string, unknown>>) => void)
    | undefined;
  /** ADR-318 Phase 5 — the 「Remember sizes」 Panels given their kept state (once a record). */
  private readonly restoredPanels = new Set<string>();
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

  /** ADR-315 — the Tables' state · writes · menus (`catalogTableController.ts`). */
  readonly tables: CatalogTableController;
  constructor(
    library: CatalogLibrary,
    private readonly options: CatalogPreviewSessionOptions,
  ) {
    this.tables = new CatalogTableController(this.tableHost());
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
        this.tables.restoredTables.clear();
        this.tables.searchedTables.clear();
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
  /** The session's side of its Table controller (`CatalogTableHost` — what the Tables read and call). */
  private tableHost(): CatalogTableHost {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the host's getters read the session
    const session = this;
    return {
      boundTableRecords: (...args) => session.boundTableRecords(...args),
      collectionItems: (...args) => session.collectionItems(...args),
      itemsByKeys: (...args) => session.itemsByKeys(...args),
      collectionRowService: (...args) => session.collectionRowService(...args),
      get collections() {
        return session.collections;
      },
      get currentRoot() {
        return session.currentRoot;
      },
      get echoing() {
        return session.echoing;
      },
      set echoing(value) {
        session.echoing = value;
      },
      get graph() {
        return session.graph;
      },
      itemSources: (...args) => session.itemSources(...args),
      get loadArguments() {
        return session.loadArguments;
      },
      loadRouted: (...args) => session.loadRouted(...args),
      get options() {
        return session.options;
      },
      pageUnit: (...args) => session.pageUnit(...args),
      recordRowSlices: (...args) => session.recordRowSlices(...args),
      remotePages: (...args) => session.remotePages(...args),
      get root() {
        return session.root;
      },
      get runtimePropsWriter() {
        return session.runtimePropsWriter;
      },
      serverSort: (...args) => session.serverSort(...args),
      get serverSortedTables() {
        return session.serverSortedTables;
      },
      serverView: (...args) => session.serverView(...args),
      showPage: (...args) => session.showPage(...args),
      sortCollection: (...args) => session.sortCollection(...args),
      stageRowWindows: (...args) => session.stageRowWindows(...args),
      stateSource: (...args) => session.stateSource(...args),
      update: (...args) => session.update(...args),
      updateMany: (...args) => session.updateMany(...args),
      get viewReloadTimer() {
        return session.viewReloadTimer;
      },
      set viewReloadTimer(value) {
        session.viewReloadTimer = value;
      },
    };
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
    this.tables.restoreDue = true;
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
   * The schema's fields of a new item's value (`append` · `insert`), in the collection's stored
   * values (ADR-313 Decision 4 — a Form's values are texts: the text rule reads them by the field's
   * type and notation; values that already have a type are kept). A collection without a schema
   * takes every field.
   */
  private itemValues(
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
  /**
   * The fields an item's write changes (`update` · `updateMany`), in the collection's stored values
   * (as `itemValues`).
   *
   * ADR-317 사용자 결정 8 — one judgment for every write to an item: a field whose
   * value its type cannot read (`normalizeRows`' `unread` · `precision` — the text would become
   * `null` — and `typeMismatch` — a value of another type) is not written, the item keeps its value;
   * a computed field (`formula` — its cells are computed when the rows are read) is not written
   * either. They come back in `refused`, by field key. An empty text is not refused (the field's
   * empty value).
   */
  private itemFields(
    collection: CollectionDataSource,
    value: Readonly<Record<string, unknown>>,
  ): {
    patch: Record<string, unknown>;
    refused: Record<string, "unread" | "computed" | "unknown">;
  } {
    const schema = collection.schema ?? [];
    const byKey = new Map(schema.map((field) => [field.key, field]));
    const next: Record<string, unknown> = {};
    const refused: Record<string, "unread" | "computed" | "unknown"> = {};
    for (const [key, field] of Object.entries(value)) {
      const declared = byKey.get(key);
      if (schema.length && !declared) refused[key] = "unknown";
      else if (declared?.formula) refused[key] = "computed";
      else next[key] = field;
    }
    if (!schema.length) return { patch: next, refused };
    const { rows, report } = normalizeRows([next], schema, "text", {
      readDateText: coerceDateText,
    });
    const patch = { ...(rows[0] as Record<string, unknown>) };
    for (const counts of [report.unread, report.precision, report.typeMismatch])
      for (const key of Object.keys(counts ?? {})) {
        delete patch[key];
        refused[key] = "unread";
      }
    return { patch, refused };
  }
  private edit(
    collectionId: string,
    plan: (
      collection: CollectionDataSource,
      items: readonly unknown[],
    ) => CatalogItemEdit | { reason: string },
  ): { ok: boolean; reason?: string; seq?: number } {
    const collection = this.collections.find(
      (item) => item.id === collectionId,
    );
    if (!collection)
      return { ok: false, reason: `collection 없음: ${collectionId}` };
    const edit = plan(collection, this.collectionItems(collectionId));
    if ("reason" in edit) return { ok: false, reason: edit.reason };
    const seq = (this.editCount += 1);
    this.itemEdits.set(collectionId, [
      ...(this.itemEdits.get(collectionId) ?? []),
      { ...edit, seq },
    ]);
    const errors = this.currentRoot?.refreshRows() ?? [];
    if (errors.length)
      console.error(`[CatalogPreview] ${edit.kind}:`, ...errors);
    this.changed();
    return { ok: true, seq };
  }
  /** ADR-317 Phase 4 — the last edit's number (a rule's edits are the ones after the number before it). */
  editSeq(): number {
    return this.editCount;
  }
  /**
   * ADR-317 Phase 4 (사용자 결정 6) — a save the server took: the edits it sent (their numbers) are
   * shown saved — a cell written again after it keeps its mark (its last edit is a later one). The
   * values stay. The rows of the collections those edits wrote are read again (the marks are the
   * rows' — nothing else changed).
   */
  markEditsSaved(seqs: readonly number[]): void {
    const touched = new Set<string>();
    for (const [collectionId, edits] of this.itemEdits)
      for (const edit of edits)
        if (seqs.includes(edit.seq) && !this.savedEdits.has(edit.seq)) {
          this.savedEdits.add(edit.seq);
          touched.add(`data:collection:${collectionId}`);
        }
    if (!touched.size) return;
    const errors = this.currentRoot?.refreshRows(touched) ?? [];
    if (errors.length) console.error("[CatalogPreview] saved:", ...errors);
    this.changed();
  }
  /**
   * ADR-317 Phase 4 (breakdown §5.4) — a collection's rows with an edit not saved yet, by the key
   * the bound components read now (`getItemKey` with the binding's value field — a tree's children
   * too): 「new」 (an edit added it, not saved) or 「dirty」 (fields whose last edit is not saved).
   * Undefined = no edits.
   */
  editMarks(
    collectionId: string,
  ): ReadonlyMap<string, CatalogRowEditMark> | undefined {
    if (!this.itemEdits.get(collectionId)?.length) return undefined;
    const keyField = this.treeFieldKeyOf(collectionId, "value");
    const childrenKey = this.childrenKeyOf(collectionId);
    const marks = new Map<string, CatalogRowEditMark>();
    const visit = (level: CatalogItems) =>
      level.forEach((item, index) => {
        const mark = ITEM_EDIT_MARKS.get(item);
        if (mark) {
          const fields = Object.entries(mark.fields ?? {})
            .filter(([, seq]) => !this.savedEdits.has(seq))
            .map(([field]) => field);
          const added =
            mark.added !== undefined && !this.savedEdits.has(mark.added);
          if (added || fields.length)
            marks.set(itemKey(item, index, keyField), {
              status: added ? "new" : "dirty",
              fields,
            });
        }
        const children = childItemsOf(item, childrenKey);
        if (children) visit(children);
      });
    visit(this.collectionItems(collectionId) as CatalogItems);
    return marks;
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
      const item = this.itemValues(collection, value);
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
      const item = this.itemValues(collection, value);
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
  ): { ok: boolean; reason?: string; seq?: number } {
    let unread: string[] = [];
    const result = this.edit(collectionId, (collection, items) => {
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
      const { patch, refused } = this.itemFields(collection, fields);
      for (const field of ITEM_KEY_FIELDS) delete patch[field];
      const valueField = this.treeFieldKeyOf(collectionId, "value");
      if (valueField) delete patch[valueField];
      // (ADR-317 사용자 결정 8 — a value its field's type cannot read is not written: the item keeps
      //  its value and the reason comes back. Nothing left to write = refused.)
      unread = Object.keys(refused).filter(
        (name) => refused[name] === "unread",
      );
      if (unread.length && !Object.keys(patch).length)
        return { reason: catalogUnreadReason(unread) };
      return { kind: "update", key: target, patch };
    });
    return result.ok && unread.length
      ? { ...result, reason: catalogUnreadReason(unread) }
      : result;
  }
  /**
   * ADR-317 Decision 2 — `update` for several items at once (a paste · a fill · a clear): one edit
   * record and one read of the rows again (`edit` — HC5), each item's fields by `update`'s judgment
   * (`itemFields` — HC2). Not written, counted by reason: an item not there (`missing`), its key
   * fields (`keyField`), a field not in the schema (`unknown`), a computed one (`computed`), a value
   * its type cannot read (`unread` — the item keeps its value). The cells written come back.
   */
  updateMany(
    collectionId: string,
    writes: readonly {
      readonly key: string;
      readonly fields: Readonly<Record<string, unknown>>;
    }[],
  ): CatalogItemsWrite {
    const skipped: Partial<Record<CatalogItemsWriteSkip, number>> = {};
    const skip = (reason: CatalogItemsWriteSkip, count = 1) => {
      if (count) skipped[reason] = (skipped[reason] ?? 0) + count;
    };
    const merged = new Map<string, Record<string, unknown>>();
    let empty = false;
    const result = this.edit(collectionId, (collection, items) => {
      const keys = this.keysOf(collectionId, items);
      const valueField = this.treeFieldKeyOf(collectionId, "value");
      const keyFields = new Set<string>([
        ...ITEM_KEY_FIELDS,
        ...(valueField ? [valueField] : []),
      ]);
      for (const { key, fields } of writes) {
        if (!keys.has(key)) {
          skip("missing", Object.keys(fields).length);
          continue;
        }
        const own: Record<string, unknown> = {};
        for (const [name, field] of Object.entries(fields))
          if (keyFields.has(name)) skip("keyField");
          else own[name] = field;
        const { patch, refused } = this.itemFields(collection, own);
        for (const reason of Object.values(refused)) skip(reason);
        if (Object.keys(patch).length)
          merged.set(key, { ...merged.get(key), ...patch });
      }
      // (Nothing to write: no edit record, no read of the rows.)
      empty = !merged.size;
      if (empty) return { reason: "쓸 칸 없음" };
      return {
        kind: "updateMany",
        patches: [...merged].map(([key, patch]) => ({ key, patch })),
      };
    });
    if (!result.ok && !empty)
      return { ok: false, reason: result.reason, written: [], skipped };
    return {
      ok: true,
      ...(result.seq !== undefined ? { seq: result.seq } : {}),
      written: [...merged].flatMap(([key, patch]) =>
        Object.keys(patch).map((field) => ({ key, field })),
      ),
      skipped,
    };
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
    const held = this.tables.tableStates.get(recordId);
    const state =
      held && this.serverSortedTables.has(recordId) ? withoutSort(held) : held;
    // (ADR-315 Phase 5 증분 5g — a grouping · a totals row a server answers: its group query.)
    const grouped = this.tables.tableServes(recordId, "grouping");
    const totals = this.tables.tableServes(recordId, "totals");
    if (
      !state?.sort?.length &&
      !state?.search &&
      !state?.columnFilters?.length &&
      !grouped &&
      !totals
    )
      return undefined;
    return catalogTableStateRowSlices(
      state ?? CATALOG_NO_TABLE_STATE,
      this.tables.tableColumns(recordId),
      {
        ...this.currentRoot?.domInputs.get(recordId)?.props,
        ...(totals ? { totals: true } : {}),
      },
    );
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
        const pinRequest = this.tables.tablePinRequest(recordId);
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
          : CATALOG_NO_VIEW_QUERY;
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
        this.tables.collectionTablesReadWhole(collectionId)
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
      this.tables.collectionTablesReadWhole(collectionId)
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
    for (const edit of this.itemEdits.get(collectionId) ?? [])
      this.savedEdits.delete(edit.seq);
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
      const id = dataCollectionIdOf(collectionId);
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
        new Set([`data:collection:${dataCollectionIdOf(collectionId)}`]),
      ) ?? [];
    if (errors.length) console.error("[CatalogPreview] show more:", ...errors);
    this.changed();
  }
  /**
   * ADR-310 Decision 11 — a collection's load (`useAsyncList.loadingState`): a run over its data
   * shows its own load-more spinner while it loads more.
   */
  loadingStateOf(collectionId: string): string {
    return this.loadingStates.get(dataCollectionIdOf(collectionId)) ?? "idle";
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
        const collectionId = dataCollectionIdOf(binding.collectionId);
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
    const id = dataCollectionIdOf(authored.collectionId);
    // (ADR-315 Phase 2 · 3 — the Table's state is its bound view's: an answer to that query is
    //  those rows in that order, and is not filtered · sorted here again.)
    const stated = this.stateRowQuery(
      id,
      authored.query ?? CATALOG_NO_VIEW_QUERY,
      slices,
    );
    // (ADR-315 Phase 5 증분 5g — a server's pages and pinned rows: the page is asked for without
    //  them, they are asked for by key — `syncPinnedRows`.)
    const pinsRefused =
      ownerId !== undefined && this.tables.rowPinsRefused(id, ownerId);
    const servedPins =
      !!slices?.pins &&
      ownerId !== undefined &&
      !pinsRefused &&
      this.collectionRowService(id).remote;
    const asked =
      stated ??
      authored.query ??
      (servedPins ? CATALOG_NO_VIEW_QUERY : undefined);
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
        authored.query ?? CATALOG_NO_VIEW_QUERY,
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
    const marked = <T extends CatalogBoundRows | undefined>(rows: T): T =>
      this.withEditMarks(
        rows && pinsRefused
          ? (Object.assign(rows, { pinsRefused: true as const }) as T)
          : rows,
        id,
        ownerId,
      );
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
    const collectionId = dataCollectionIdOf(binding.collectionId);
    return marked(
      Object.assign(rows, {
        loadingState: this.loadingStates.get(collectionId) ?? "idle",
      }),
    );
  }
  /**
   * ADR-317 Phase 4 — a Table 「Edit marks」's rows with their edit status (`CatalogBoundRow.edit` —
   * the resolver carries it on the Row and Cell records): its data rows by key (`editMarks`), not
   * a group's · a detail · a placeholder. A list without the switch reads no marks (R3).
   */
  private withEditMarks<T extends CatalogBoundRows | undefined>(
    rows: T,
    collectionId: string,
    ownerId: string | undefined,
  ): T {
    if (!rows?.length || ownerId === undefined) return rows;
    const owner = this.graph?.getEntry(ownerId as never);
    const on = owner?.kind === "node" ? owner.props.showEditMarks : undefined;
    if (on?.kind !== "set" || on.value !== true) return rows;
    const marks = this.editMarks(collectionId);
    if (!marks?.size) return rows;
    const visit = (list: readonly CatalogBoundRow[]): CatalogBoundRow[] =>
      list.map((row) => {
        const edit =
          row.group || row.detail || row.placeholder
            ? undefined
            : marks.get(row.key);
        const children = row.children && visit(row.children);
        return edit || children
          ? {
              ...row,
              ...(edit ? { edit } : {}),
              ...(children ? { children } : {}),
            }
          : row;
      });
    // (The rows' own fields — total · load · view … — on the new list.)
    return Object.assign(visit(rows), catalogRowListMeta(rows)) as unknown as T;
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
              : CATALOG_NO_VIEW_QUERY,
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
    const requests = catalogRequestSlots(CATALOG_GROUP_REQUESTS_AT_ONCE);
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
      // (The open groups of a level are asked for at once, a few at a time — each one's own pages
      //  in turn, its next level once it has answered. One after another, 12 open groups at
      //  100 ms an answer kept a sort's rows waiting 2.8 s, 2026-11-25.)
      const walk = async (
        rows: readonly Record<string, unknown>[],
        depth: number,
        outer: readonly unknown[],
      ): Promise<void> => {
        const query =
          this.stateRowQuery(collectionId, authored, slices, depth + 1) ??
          authored;
        const deeper = depth + 1 < groups.keys.length;
        await Promise.all(
          rows.map(async (row) => {
            const path = [...outer, row[groups.keys[depth]!] ?? null];
            const groupKey = catalogTableGroupKey(path);
            if (!open(groupKey)) return;
            const groupOf = {
              by: groups.keys.slice(0, depth + 1),
              values: path,
            };
            const first = this.requestOf(collectionId, query, undefined, {
              groupOf,
            });
            if (!first) return;
            const key = `${nodeId}\u0000${groupKey}`;
            let answer = this.groupAnswers.get(key);
            if (answer?.url !== first.url || answer.queryKey !== queryKey) {
              this.groupAnswers.set(
                key,
                (answer = { queryKey, url: first.url }),
              );
              const got = await requests(() =>
                this.loadEveryPage(
                  collectionId,
                  (cursor) =>
                    this.requestOf(
                      collectionId,
                      query,
                      cursor === undefined ? undefined : { cursor },
                      { groupOf },
                    )?.extra ?? first.extra,
                ),
              );
              if (this.groupAnswers.get(key) !== answer) return;
              // (The rows the answer has: the next level's counts, else the server's total.)
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
                  return;
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
            if (answer.rows && deeper) await walk(answer.rows, depth + 1, path);
          }),
        );
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
      const request = this.tables.tablePinRequest(recordId);
      const pinned = this.tables.tableStates.get(recordId)?.pinnedRows;
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
  /** A collection's execution policy (ADR-218) — the document entry's; the Builder's Preview never reads it. */
  private executionPolicyOf(collectionId: string) {
    const entry = this.graph?.getEntry(
      `data:collection:${collectionId}` as never,
    ) as CollectionEntry | undefined;
    return entry?.kind === "collection" ? entry.executionPolicy : undefined;
  }
  /** A published app's `interval` collections: the timer of each one's next load, by collection id. */
  private intervalLoads = new Map<
    string,
    { seconds: number; timer: ReturnType<typeof setTimeout> }
  >();
  /**
   * A published app's `interval` policy (the Builder's `useExecutionPolicyScheduler`, here): each
   * period the collection's first page loads again — the next period starts when that load ended
   * (never two at once). A period is skipped while a load is in flight, and while the collection
   * holds an edit not saved yet (a load drops the edit record — a timer never discards what the
   * user wrote). The lists keep their rows meanwhile (`idle` — a refresh, not a first load).
   */
  private syncIntervalLoads(): void {
    if (!this.options.standalone) return;
    const wanted = new Map<string, number>();
    for (const collection of this.collections) {
      if (!collection.id || collection.useMockData) continue;
      const policy = this.executionPolicyOf(collection.id);
      if (policy?.mode !== "interval" || !this.endpointFilling(collection))
        continue;
      wanted.set(collection.id, policy.intervalSec ?? 30);
    }
    for (const [id, load] of this.intervalLoads)
      if (wanted.get(id) !== load.seconds) {
        clearTimeout(load.timer);
        this.intervalLoads.delete(id);
      }
    const schedule = (id: string, seconds: number) => {
      const timer = setTimeout(() => {
        if (this.intervalLoads.get(id)?.timer !== timer) return;
        const unsaved = (this.itemEdits.get(id) ?? []).some(
          (edit) => !this.savedEdits.has(edit.seq),
        );
        const next = () => {
          if (this.intervalLoads.get(id)?.timer === timer)
            schedule(id, seconds);
        };
        if (unsaved || this.loadControllers.has(id)) return next();
        this.reload(id, "idle")
          .catch((error: unknown) =>
            console.warn(`[CatalogPreview] ${id} 를 읽지 못했다:`, error),
          )
          .then(next);
      }, seconds * 1000);
      this.intervalLoads.set(id, { seconds, timer });
    };
    for (const [id, seconds] of wanted)
      if (!this.intervalLoads.has(id)) schedule(id, seconds);
  }
  /** Let the session go: its timers stop (a published app replaced by another project). */
  dispose(): void {
    for (const load of this.intervalLoads.values()) clearTimeout(load.timer);
    this.intervalLoads.clear();
    clearTimeout(this.viewReloadTimer);
  }
  /**
   * A router loader (`useAsyncList({ load })` fetching `/users/${id}`): each API collection whose
   * query endpoint reads a template loads when the shown path · data give another URL than its
   * last load — once per URL; a template that does not resolve (another page) loads nothing.
   */
  private loadRouted(state: CatalogLoadingState = "loading"): void {
    this.syncIntervalLoads();
    for (const collection of this.collections) {
      if (!collection.id || collection.useMockData) continue;
      const endpoint = this.endpointFilling(collection);
      // (ADR-284: a view the request carries — a variable it reads gives another request. ADR-291:
      // a view that runs here over every row is the session's load too.)
      const viewed = !!this.uniqueView(collection.id);
      // (An endpoint that pages — `cursorPath` — is the session's to load: the cursor is its. A
      //  published app's session loads the plain ones too — no Builder does — unless the author
      //  left the load to a rule: `manual`.)
      if (
        !endpoint ||
        !(
          endpointReadsTemplate(endpoint) ||
          endpoint.responseMapping?.cursorPath ||
          viewed ||
          (this.options.standalone &&
            executionModeOf(this.executionPolicyOf(collection.id)) !== "manual")
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
          this.tables.collectionTablesReadWhole(collection.id)
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
    const collectionId = dataCollectionIdOf(binding.collectionId);
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
   * The view's rule runtime writes records' runtime props (`CatalogPreviewInteractions`): a sort
   * the session restored is told to RAC through it — the header's indicator and `aria-sort`.
   */
  attachRuntimeProps(
    write: (id: string, patch: Readonly<Record<string, unknown>>) => void,
  ): void {
    this.runtimePropsWriter = write;
    if (this.options.tableStateStorage) this.restoreResizablePanels();
    for (const tableId of [...this.tables.pendingSortEchoes])
      this.tables.echoTableSort(tableId);
    this.tables.echoColumnChoosers();
  }
  /**
   * ADR-318 Phase 5 (사용자 결정 5) — a Panel of a 「Remember sizes」 Group: the browser keeps its share
   * and collapse (the runtime props the view's rule runtime wrote). Publish only — the Builder's
   * Preview has no storage.
   */
  rememberRuntimeProps(
    id: string,
    patch: Readonly<Record<string, unknown>>,
  ): void {
    const storage = this.options.tableStateStorage;
    const projectId = this.graph?.projectId;
    if (!storage || !projectId) return;
    const kept = catalogResizableRemembered(patch);
    if (!Object.keys(kept).length || !this.remembersPanel(id)) return;
    const all = catalogStoredResizablePanels(storage, projectId);
    all[id] = { ...all[id], ...kept };
    catalogStoreResizablePanels(storage, projectId, all);
  }
  /** A record is a Panel whose Group remembers its sizes. */
  private remembersPanel(id: string): boolean {
    const root = this.currentRoot;
    const record = root?.domInputs.get(id);
    if (!record || record.ruleId !== RESIZABLE_PANEL_TYPE || !record.parentId)
      return false;
    return root?.domInputs.get(record.parentId)?.props.rememberSizes === true;
  }
  /**
   * Gives the 「Remember sizes」 Panels drawn now what the browser kept — once a record, through the
   * rule runtime (its Handles · mirrors read the same runtime props). A state the session already
   * holds wins (a restore runs before any write).
   */
  private restoreResizablePanels(): void {
    const write = this.runtimePropsWriter;
    const projectId = this.graph?.projectId;
    const root = this.currentRoot;
    if (!write || !projectId || !root) return;
    const stored = catalogStoredResizablePanels(
      this.options.tableStateStorage,
      projectId,
    );
    for (const [id, kept] of Object.entries(stored)) {
      if (this.restoredPanels.has(id) || !root.domInputs.has(id)) continue;
      if (!this.remembersPanel(id)) continue;
      this.restoredPanels.add(id);
      write(id, kept);
    }
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
    this.tables.restoreDue = true;
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
              let set = this.tables.columnChoosers.get(tableId);
              if (!set)
                this.tables.columnChoosers.set(tableId, (set = new Set()));
              set.add(chooserId);
              return this.tables.columnChoices(tableId)?.columns;
            },
          },
        ),
        // (A Table its server sorts keeps the server's order: its `sort` slice is not the rows'.)
        tableState: (tableId) =>
          this.serverSortedTables.has(tableId)
            ? withoutSort(this.tables.tableState(tableId))
            : this.tables.tableStates.get(tableId),
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
      !this.tables.collectionTablesReadWhole(collectionId)
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
    const id = dataCollectionIdOf(binding.collectionId);
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
    const id = dataCollectionIdOf(binding.collectionId);
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
    const id = dataCollectionIdOf(binding.collectionId);
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
    const id = dataCollectionIdOf(binding.collectionId);
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
    const id = dataCollectionIdOf(collectionId);
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
      const id = dataCollectionIdOf(collectionId);
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
    if (this.tables.restoreDue) {
      this.tables.restoreDue = false;
      if (this.options.tableStateStorage) {
        this.tables.restoreTableStates();
        this.restoreResizablePanels();
      }
      this.tables.startTableSearches();
    }
    this.tables.syncColumnChoosers();
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
  return `${dataCollectionIdOf(collectionId)}\u0001${ownerId}`;
}
