/**
 * ADR-320 Phase 3 — the Preview session's filter scopes (Decision 1 · 4 · 10): each connected
 * filter bar holds one run-time condition tree over the lists it filters (`filtersOf`). The tree
 * starts as the bar's authored start (`defaultQuery`), and every way it changes — a chip, a Column
 * menu of a Table among the lists, a rule's Do, 「Clear」 — is one assignment (`assign`): the tree
 * as given, judged here against every list of the scope (a root item is taken only when every
 * list's rows have its fields and every list's request carries it with the items before it —
 * `catalogJudgeFilterItems`, the panel's judgment). The items left out are counted for the bar's
 * notice (「적용하지 못한 조건 N」).
 *
 * The tree is the one value of the scope (HC3): a Table among the lists reads it as its state's
 * `filters` (`CatalogTableController.tableState`), another list as its rows' conditions
 * (`CatalogPreviewSession.recordRowSlices` · `boundRows`) — nothing is copied, so the chips, the
 * Column menus and the rows cannot disagree. Keyed by the bar's node id (its lists are node ids).
 */
import { FILTER_BAR_ORIGIN_ID } from "../document/filterBarOrigins";
import type { NodeEntry, NodeId, ViewConditionGroup } from "../document/types";
import {
  viewFieldOf,
  viewRunReferences,
  viewRunSchema,
  viewSchemaAt,
} from "../../collections/view/evaluate";
import { dataCollectionIdOf } from "./dataBinding";
import { catalogFilterBarStartTree } from "./filterBar";
import { catalogFilterTreeRead, catalogJudgeFilterItems } from "./filterScope";
import { CATALOG_NO_VIEW_QUERY, catalogBindingQuery } from "./viewQuery";
import type { CatalogTableHost } from "./catalogTableController";

/** A scope tree's change, as the bar's notice and its listeners read it. */
export interface CatalogFilterScopeChange {
  readonly barId: string;
  readonly tree: ViewConditionGroup | undefined;
  /** The root items the last assignment left out. */
  readonly refused: number;
}

/** A bar's authored start, as text (what a restart compares). */
const startKey = (bar: NodeEntry): string =>
  JSON.stringify(catalogFilterBarStartTree(bar) ?? null);

export class CatalogFilterScopes {
  constructor(
    private readonly host: CatalogTableHost,
    /** The lists of a scope read their rows again (the Tables through their controller). */
    private readonly readRows: (lists: readonly string[]) => void,
  ) {}

  /** Each started bar's tree (`null` = started, empty). */
  private readonly trees = new Map<string, ViewConditionGroup | null>();
  /**
   * The authored start each tree began from — the author editing it (the Builder's Preview)
   * starts the scope again from the new start. Looked at once a graph revision.
   */
  private readonly starts = new Map<string, string>();
  private startsCheckedAt = -1;
  private readonly refused = new Map<string, number>();
  private readonly listeners = new Set<
    (change: CatalogFilterScopeChange) => void
  >();
  /** List node → its bar node, as of a graph revision. */
  private index?: { revision: number; bars: Map<string, string> };

  /** The bar node whose scope holds a list node (`filtersOf` — one at most). */
  barOf(listId: string): string | undefined {
    const graph = this.host.graph;
    if (!graph) return undefined;
    if (this.index?.revision !== graph.revision) {
      const bars = new Map<string, string>();
      for (const id of graph.instancesOf(FILTER_BAR_ORIGIN_ID)) {
        const bar = graph.getEntry(id as NodeId);
        if (bar?.kind === "node")
          for (const list of bar.filtersOf ?? []) bars.set(list, bar.id);
      }
      this.index = { revision: graph.revision, bars };
    }
    return this.index.bars.get(listId);
  }

  /** The bar node of a record (by its source node), when it is a list of a scope. */
  barOfRecord(recordId: string): string | undefined {
    const source = this.host.currentRoot?.domInputs.get(recordId)?.sourceId;
    return source ? this.barOf(source) : undefined;
  }

  private bar(barId: string): NodeEntry | undefined {
    const entry = this.host.graph?.getEntry(barId as NodeId);
    return entry?.kind === "node" && entry.filtersOf?.length
      ? entry
      : undefined;
  }

  /** A scope's tree now — started from the bar's authored start on its first read. */
  tree(barId: string): ViewConditionGroup | undefined {
    const revision = this.host.graph?.revision ?? -1;
    if (revision !== this.startsCheckedAt) {
      this.startsCheckedAt = revision;
      for (const [id, start] of [...this.starts]) {
        const bar = this.bar(id);
        if (!bar || startKey(bar) !== start) {
          this.trees.delete(id);
          this.refused.delete(id);
          this.starts.delete(id);
        }
      }
    }
    if (!this.trees.has(barId)) {
      const bar = this.bar(barId);
      if (!bar) return undefined;
      this.starts.set(barId, startKey(bar));
      this.trees.set(barId, null);
      const judged = this.judge(barId, catalogFilterBarStartTree(bar));
      this.trees.set(barId, judged.tree ?? null);
      if (judged.refused) this.refused.set(barId, judged.refused);
    }
    return this.trees.get(barId) ?? undefined;
  }

  /** The scope tree a list reads (none = not a list of a scope, or no condition). */
  treeOfList(listId: string): ViewConditionGroup | undefined {
    const bar = this.barOf(listId);
    return bar ? this.tree(bar) : undefined;
  }

  /** The root items the bar's last assigned tree left out (its notice). */
  refusedOf(barId: string): number {
    this.tree(barId);
    return this.refused.get(barId) ?? 0;
  }

  /**
   * The one write of a scope's tree: `value` as given (a tree · `null` = no condition · anything
   * else is not a tree and writes nothing), judged against every list of the scope. False = no
   * change (not a tree, or the same tree).
   */
  assign(barId: string, value: unknown): boolean {
    const bar = this.bar(barId);
    if (!bar) return false;
    const read = catalogFilterTreeRead(value);
    if (read === undefined) return false;
    this.tree(barId);
    const judged = this.judge(barId, read ?? undefined);
    const before = this.trees.get(barId) ?? undefined;
    const refusedBefore = this.refused.get(barId) ?? 0;
    if (
      JSON.stringify(before ?? null) === JSON.stringify(judged.tree ?? null) &&
      refusedBefore === judged.refused
    )
      return false;
    this.trees.set(barId, judged.tree ?? null);
    if (judged.refused) this.refused.set(barId, judged.refused);
    else this.refused.delete(barId);
    const lists = (bar.filtersOf ?? []).filter(
      (id) => this.host.graph?.getEntry(id)?.kind === "node",
    );
    // (The lists' rows, then the bar — its chips are the tree's root items.)
    this.readRows(lists);
    const errors = this.host.currentRoot?.refreshNodes(new Set([barId])) ?? [];
    if (errors.length) console.error("[CatalogPreview] filter bar:", ...errors);
    const change = { barId, tree: judged.tree, refused: judged.refused };
    for (const listener of [...this.listeners]) listener(change);
    return true;
  }

  /** 「Clear」 — the scope back to its start (judged as any tree — Decision 10). */
  clear(barId: string): boolean {
    const bar = this.bar(barId);
    return bar
      ? this.assign(barId, catalogFilterBarStartTree(bar) ?? null)
      : false;
  }

  /**
   * Every started scope judged again (Decision 4 — how the rows are served changed: an endpoint,
   * a query format, a field). A bar no longer connected forgets its tree.
   */
  rejudge(): void {
    for (const [barId, tree] of [...this.trees]) {
      if (!this.bar(barId)) {
        this.trees.delete(barId);
        this.refused.delete(barId);
        continue;
      }
      if (!tree) continue;
      // (The notice counts what the tree as assigned lost — one more left out now adds to it.)
      const before = this.refused.get(barId) ?? 0;
      const judged = this.judge(barId, tree);
      if (!judged.refused) continue;
      this.trees.set(barId, judged.tree ?? null);
      this.refused.set(barId, before + judged.refused);
      this.readRows(this.bar(barId)?.filtersOf ?? []);
      this.host.currentRoot?.refreshNodes(new Set([barId]));
    }
  }

  /** Whether the scope takes a tree whole (every root item — the bar's offered comparisons). */
  takes(barId: string, tree: ViewConditionGroup): boolean {
    return this.judge(barId, tree).refused === 0;
  }

  /** The scope's changes (the bar's notice · announce). */
  subscribe(listener: (change: CatalogFilterScopeChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** A tree as the scope takes it — every list must take each root item (Decision 4). */
  private judge(
    barId: string,
    tree: ViewConditionGroup | undefined,
  ): { tree: ViewConditionGroup | undefined; refused: number } {
    if (!tree?.items.length) return { tree: undefined, refused: 0 };
    const reads = (this.bar(barId)?.filtersOf ?? []).flatMap((id) => {
      const read = this.listRead(id);
      return read ? [read] : [];
    });
    const references = viewRunReferences(this.host.collections);
    const { taken } = catalogJudgeFilterItems(tree, {
      fieldReadable: (path) =>
        reads.every((read) => !!viewFieldOf(path, read.fields, references)),
      refusedBy: (items, ids) =>
        reads.some(
          (read) =>
            !!this.host
              .viewRequestLimits(read.collectionId, read.base, items)
              ?.some(
                (warning) =>
                  warning.code === "GET_BODY" ||
                  (warning.conditionId !== undefined &&
                    ids.has(warning.conditionId)),
              ),
        ),
    });
    const refused = tree.items.length - taken.length;
    return {
      tree: taken.length ? { ...tree, items: taken } : undefined,
      refused,
    };
  }

  /** What a list node reads its rows through: its collection, its authored views, their fields. */
  private listRead(listId: string) {
    const graph = this.host.graph;
    const node = graph?.getEntry(listId as NodeId);
    if (!graph || node?.kind !== "node" || !node.binding) return undefined;
    const collectionId = dataCollectionIdOf(node.binding.collectionId);
    const collection = this.host.collections.find(
      (item) => item.id === collectionId,
    );
    const base =
      catalogBindingQuery(
        graph,
        node.binding,
        node.id,
        this.host.stateSource(),
        undefined,
        [],
      ) ?? CATALOG_NO_VIEW_QUERY;
    const schema = viewRunSchema(collection?.schema);
    const fields = base.queries.length
      ? viewSchemaAt({ queries: base.queries, schema }, base.queries.length)
      : schema;
    return { collectionId, base, fields };
  }
}
