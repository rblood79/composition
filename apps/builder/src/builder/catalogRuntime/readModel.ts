import type {
  CatalogEntry,
  CatalogReader,
  DefinitionEntry,
  EditTarget,
  EntryId,
  InteractionEntry,
  NodeId,
  PageEntry,
  PageLayoutDeclaration,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  readCommonProp,
  readOwnFields,
  readPropSource,
  type OwnFields,
  type PropReading,
} from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  childPositions,
  definitionPositions,
  nodePosition,
  pagePositions,
  type CatalogPosition,
} from "../../../../../packages/shared/src/catalog/resolution/positions";
import { isLibraryOrigin, ORIGIN_VIEW_NODE } from "./originView";
import type { CatalogDefinitionViewId } from "./session";
import type { CatalogRuntime, CatalogStepContext } from "./controller";
import type { DataBindingValue } from "@composition/shared";
import { catalogBindingValue, catalogTargetBinding } from "./dataBinding";

/**
 * ADR-248 Phase 4c read model: the panels' reads (Layers rows, prop sources, pages, components,
 * a node's interactions) over the committed graph, cached per key. Each cached read records the
 * entries it read; a published step recomputes only the reads whose entries changed, and a row
 * list only when its parent changed or a listed node's `definitionId`/`enabled` did — so editing
 * one leaf among 5k siblings recomputes no row list. Subscribers are told when a value differs.
 */
type Listener<T> = (value: T) => void;
interface CachedRead<T> {
  value: T;
  /** Entries whose change recomputes the read. */
  deps: Set<string>;
  /** Listed owned nodes: recompute only when these fields changed. */
  rowDeps?: Map<string, string>;
  listeners: Set<Listener<T>>;
  compute: () => { value: T; deps: Set<string>; rowDeps?: Map<string, string> };
}
export interface CatalogComponentSummary {
  definitionId: EntryId<"definition">;
  name: string;
  templateRootId: string | undefined;
  instanceCount: number;
}

/** A reader that records the entries a read looks up. */
function recording(graph: CatalogReader, deps: Set<string>): CatalogReader {
  return {
    projectId: graph.projectId,
    revision: graph.revision,
    library: graph.library,
    getEntry: (id) => {
      deps.add(id);
      return graph.getEntry(id);
    },
    ownerOf: (id) => {
      deps.add(id);
      return graph.ownerOf(id);
    },
    referrersOf: (id) => {
      deps.add(`referrers:${id}`);
      return graph.referrersOf(id);
    },
    instancesOf: (id) => {
      deps.add(`instances:${id}`);
      return graph.instancesOf(id);
    },
  };
}
const rowFields = (entry: CatalogEntry | undefined) =>
  entry?.kind === "node"
    ? `${entry.definitionId}|${entry.enabled === false ? 0 : 1}`
    : "gone";
const targetKey = (target: EditTarget) =>
  target.kind === "node"
    ? target.id
    : `${target.ownerId}|${target.address.instances.join("/")}|${target.address.templatePath.join("/")}`;
const same = (a: unknown, b: unknown) =>
  Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);

/** Whose rows: a page's top level, the definition edit view's, or one row's children. */
export type CatalogRowsParent =
  | { pageId: EntryId<"page"> }
  | { definitionId: CatalogDefinitionViewId }
  | { position: CatalogPosition };

export class CatalogReadModel {
  private readonly reads = new Map<string, CachedRead<unknown>>();
  /** Reverse indexes: entry id → reads depending on it (whole entry / row fields / index). */
  private readonly byDep = new Map<string, Set<string>>();
  private readonly byRow = new Map<string, Set<string>>();
  private readonly byIndex = new Set<string>();
  private readonly unsubscribe: () => void;
  /** Reads computed (first read or recompute), by kind — the cost contract's counter. */
  readonly stats = { rows: 0, props: 0, components: 0, own: 0 };

  constructor(private readonly runtime: CatalogRuntime) {
    this.unsubscribe = runtime.subscribeSteps((step) => this.onStep(step));
  }
  dispose(): void {
    this.unsubscribe();
    this.reads.clear();
    this.byDep.clear();
    this.byRow.clear();
    this.byIndex.clear();
  }

  private read<T>(
    key: string,
    compute: CachedRead<T>["compute"],
  ): CachedRead<T> {
    let cached = this.reads.get(key) as CachedRead<T> | undefined;
    if (!cached) {
      const first = compute();
      cached = { ...first, listeners: new Set(), compute };
      this.reads.set(key, cached as CachedRead<unknown>);
      this.index(key, cached as CachedRead<unknown>);
    }
    return cached;
  }
  private index(key: string, cached: CachedRead<unknown>): void {
    for (const dep of cached.deps)
      if (dep.startsWith("instances:") || dep.startsWith("referrers:"))
        this.byIndex.add(key);
      else this.add(this.byDep, dep, key);
    for (const id of cached.rowDeps?.keys() ?? [])
      this.add(this.byRow, id, key);
  }
  private unindex(key: string, cached: CachedRead<unknown>): void {
    this.byIndex.delete(key);
    for (const dep of cached.deps) this.byDep.get(dep)?.delete(key);
    for (const id of cached.rowDeps?.keys() ?? [])
      this.byRow.get(id)?.delete(key);
  }
  private add(map: Map<string, Set<string>>, id: string, key: string): void {
    let keys = map.get(id);
    if (!keys) map.set(id, (keys = new Set()));
    keys.add(key);
  }

  private subscribeRead<T>(
    key: string,
    compute: CachedRead<T>["compute"],
    listener: Listener<T>,
  ): () => void {
    const cached = this.read(key, compute);
    cached.listeners.add(listener);
    return () => {
      cached.listeners.delete(listener);
    };
  }

  private rowsCompute(
    parent: CatalogRowsParent,
  ): CachedRead<readonly CatalogPosition[]>["compute"] {
    return () => {
      this.stats.rows += 1;
      const deps = new Set<string>();
      const reader = recording(this.runtime.graph, deps);
      const value =
        "pageId" in parent
          ? pagePositions(reader, parent.pageId)
          : "definitionId" in parent
            ? isLibraryOrigin(parent.definitionId)
              ? // A library origin: the derived sample the view draws.
                reader.getEntry(ORIGIN_VIEW_NODE)
                ? [nodePosition(reader, ORIGIN_VIEW_NODE)]
                : []
              : definitionPositions(reader, parent.definitionId)
            : childPositions(reader, parent.position);
      // A listed owned node matters only through its row fields (not its props or children).
      const rowDeps = new Map<string, string>();
      for (const row of value)
        if (row.target.kind === "node") {
          deps.delete(row.target.id);
          rowDeps.set(
            row.target.id,
            rowFields(this.runtime.graph.getEntry(row.target.id)),
          );
        }
      return { value, deps, rowDeps };
    };
  }
  private rowsKey(parent: CatalogRowsParent) {
    return "pageId" in parent
      ? `rows:page:${parent.pageId}`
      : "definitionId" in parent
        ? `rows:definition:${parent.definitionId}`
        : `rows:${parent.position.identity}`;
  }

  /** The Layers rows of a page (top level). */
  pageRows(pageId: EntryId<"page">): readonly CatalogPosition[] {
    return this.read(this.rowsKey({ pageId }), this.rowsCompute({ pageId }))
      .value;
  }
  /** The Layers rows of the definition edit view (its template root). */
  definitionRows(
    definitionId: CatalogDefinitionViewId,
  ): readonly CatalogPosition[] {
    return this.read(
      this.rowsKey({ definitionId }),
      this.rowsCompute({ definitionId }),
    ).value;
  }
  /** The Layers rows under a row (one level). */
  childRows(position: CatalogPosition): readonly CatalogPosition[] {
    return this.read(this.rowsKey({ position }), this.rowsCompute({ position }))
      .value;
  }
  subscribeRows(
    parent: CatalogRowsParent,
    listener: Listener<readonly CatalogPosition[]>,
  ): () => void {
    return this.subscribeRead(
      this.rowsKey(parent),
      this.rowsCompute(parent),
      listener,
    );
  }

  private propCompute(
    target: EditTarget,
    key: string,
  ): CachedRead<PropReading>["compute"] {
    return () => {
      this.stats.props += 1;
      const deps = new Set<string>();
      const value = readPropSource(
        recording(this.runtime.graph, deps),
        target,
        key,
      );
      return { value, deps };
    };
  }
  /** Where a target's prop value comes from (own · inherited · source). */
  propSource(target: EditTarget, key: string): PropReading {
    return this.read(
      `prop:${targetKey(target)}:${key}`,
      this.propCompute(target, key),
    ).value;
  }
  subscribePropSource(
    target: EditTarget,
    key: string,
    listener: Listener<PropReading>,
  ): () => void {
    return this.subscribeRead(
      `prop:${targetKey(target)}:${key}`,
      this.propCompute(target, key),
      listener,
    );
  }
  /** The target's data binding in the picker shape (an owned node's typed `binding`). */
  bindingValue(target: EditTarget): DataBindingValue | undefined {
    return this.read(
      `binding:${targetKey(target)}`,
      this.bindingCompute(target),
    ).value;
  }
  subscribeBinding(
    target: EditTarget,
    listener: Listener<DataBindingValue | undefined>,
  ): () => void {
    return this.subscribeRead(
      `binding:${targetKey(target)}`,
      this.bindingCompute(target),
      listener,
    );
  }
  private bindingCompute(
    target: EditTarget,
  ): CachedRead<DataBindingValue | undefined>["compute"] {
    return () => {
      const deps = new Set<string>();
      const value = catalogBindingValue(
        catalogTargetBinding(recording(this.runtime.graph, deps), target),
      );
      return { value, deps };
    };
  }
  /** A prop over a multi-selection (mixed or one value); reads each target's cached source. */
  commonProp(targets: readonly EditTarget[], key: string) {
    for (const target of targets) this.propSource(target, key);
    return readCommonProp(this.runtime.graph, targets, key);
  }

  private ownCompute(target: EditTarget): CachedRead<OwnFields>["compute"] {
    return () => {
      this.stats.own += 1;
      const deps = new Set<string>();
      const value = readOwnFields(recording(this.runtime.graph, deps), target);
      return { value, deps };
    };
  }
  /** What the target authors itself (the Styles panel's modified marks and reset). */
  ownFields(target: EditTarget): OwnFields {
    return this.read(`own:${targetKey(target)}`, this.ownCompute(target)).value;
  }
  subscribeOwnFields(
    target: EditTarget,
    listener: Listener<OwnFields>,
  ): () => void {
    return this.subscribeRead(
      `own:${targetKey(target)}`,
      this.ownCompute(target),
      listener,
    );
  }

  /** Other nodes using a node's author DOM id (the graph's htmlId index, no scan). */
  htmlIdConflicts(nodeId: NodeId): readonly NodeId[] {
    const node = this.runtime.graph.getEntry(nodeId);
    const htmlId = node?.kind === "node" ? node.metadata?.htmlId : undefined;
    return htmlId
      ? ([...this.runtime.graph.nodesWithHtmlId(htmlId)].filter(
          (id) => id !== nodeId,
        ) as NodeId[])
      : [];
  }

  /** Nodes bound to a data collection (the graph's collection index, no scan). */
  collectionUsage(collectionId: string): readonly NodeId[] {
    return [...this.runtime.graph.bindingsOf(collectionId)] as NodeId[];
  }

  private pagesCompute(): CachedRead<readonly PageEntry[]>["compute"] {
    return () => {
      const deps = new Set<string>();
      const reader = recording(this.runtime.graph, deps);
      const project = reader.getEntry(reader.projectId);
      const value =
        project?.kind === "project"
          ? project.pageIds.flatMap((id) => {
              const page = reader.getEntry(id);
              return page?.kind === "page" ? [page] : [];
            })
          : [];
      return { value, deps };
    };
  }
  /** The project's pages in order. */
  pages(): readonly PageEntry[] {
    return this.read("pages", this.pagesCompute()).value;
  }
  subscribePages(listener: Listener<readonly PageEntry[]>): () => void {
    return this.subscribeRead("pages", this.pagesCompute(), listener);
  }

  private pageLayoutCompute(): CachedRead<
    PageLayoutDeclaration | undefined
  >["compute"] {
    return () => {
      const deps = new Set<string>();
      const reader = recording(this.runtime.graph, deps);
      const project = reader.getEntry(reader.projectId);
      return {
        value: project?.kind === "project" ? project.pageLayout : undefined,
        deps,
      };
    };
  }
  /** The project's page grid declaration (ADR-232; `undefined` = defaults). */
  pageLayout(): PageLayoutDeclaration | undefined {
    return this.read("pageLayout", this.pageLayoutCompute()).value;
  }
  subscribePageLayout(
    listener: Listener<PageLayoutDeclaration | undefined>,
  ): () => void {
    return this.subscribeRead("pageLayout", this.pageLayoutCompute(), listener);
  }

  private componentsCompute(): CachedRead<
    readonly CatalogComponentSummary[]
  >["compute"] {
    return () => {
      this.stats.components += 1;
      const deps = new Set<string>();
      const reader = recording(this.runtime.graph, deps);
      const project = reader.getEntry(reader.projectId);
      const value =
        project?.kind === "project"
          ? project.definitionIds.flatMap((id) => {
              const definition = reader.getEntry(id) as
                DefinitionEntry | undefined;
              if (
                definition?.kind !== "definition" ||
                definition.mode !== "composite" ||
                definition.usage === "layout"
              )
                return [];
              return [
                {
                  definitionId: definition.id,
                  name: definition.name,
                  templateRootId: definition.templateRootId,
                  instanceCount: reader.instancesOf(definition.id).size,
                },
              ];
            })
          : [];
      return { value, deps };
    };
  }
  /** Project components (Components view): definition, template root, instance count. */
  components(): readonly CatalogComponentSummary[] {
    return this.read("components", this.componentsCompute()).value;
  }
  subscribeComponents(
    listener: Listener<readonly CatalogComponentSummary[]>,
  ): () => void {
    return this.subscribeRead("components", this.componentsCompute(), listener);
  }

  /** The interactions a node owns (the graph's referrer index, no scan). */
  interactionsOf(nodeId: NodeId): readonly InteractionEntry[] {
    return [...this.runtime.graph.referrersOf(nodeId)].flatMap((id) => {
      const entry = this.runtime.graph.getEntry(id);
      return entry?.kind === "interaction" && entry.ownerId === nodeId
        ? [entry]
        : [];
    });
  }

  private onStep({ result }: CatalogStepContext): void {
    const changed = new Set<string>([
      ...result.changedIds,
      ...result.removedIds,
    ]);
    // Only the reads indexed under a changed entry are looked at (never every cached read).
    const stale = new Set<string>();
    for (const id of changed) {
      for (const key of this.byDep.get(id) ?? []) stale.add(key);
      for (const key of this.byRow.get(id) ?? []) {
        const cached = this.reads.get(key);
        if (
          cached?.rowDeps?.get(id) !==
          rowFields(this.runtime.graph.getEntry(id))
        )
          stale.add(key);
      }
    }
    // A derived view entry (the library origin sample) follows any change it may derive from.
    if (changed.size)
      for (const id of this.runtime.graph.viewEntryIds())
        for (const key of this.byDep.get(id) ?? []) stale.add(key);
    // Index reads (instances, referrers) follow any change (their records are few).
    if (changed.size) for (const key of this.byIndex) stale.add(key);
    for (const key of stale) {
      const cached = this.reads.get(key);
      if (!cached) continue;
      this.unindex(key, cached);
      if (!cached.listeners.size) {
        this.reads.delete(key);
        continue;
      }
      let next: ReturnType<typeof cached.compute>;
      try {
        next = cached.compute();
      } catch {
        // The read's subject is gone (a removed page or position): its readers unmount.
        this.reads.delete(key);
        continue;
      }
      const differs = !same(next.value, cached.value);
      cached.deps = next.deps;
      cached.rowDeps = next.rowDeps;
      this.index(key, cached);
      if (differs) {
        cached.value = next.value;
        for (const listener of [...cached.listeners]) listener(next.value);
      }
    }
  }
}
