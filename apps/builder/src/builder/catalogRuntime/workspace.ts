import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  BreakpointName,
  DefinitionId,
  EntryId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type {
  CatalogCommand,
  CatalogCommandPlan,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type { CatalogClipboard } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogPosition } from "../../../../../packages/shared/src/catalog/resolution/positions";
import { CATALOG_ROW_ITEM_TYPES } from "../../../../../packages/shared/src/catalog/resolution/resolver";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { CatalogTransactionResult } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import type { LayoutEngineAPI } from "../workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogAutosave } from "./autosave";
import {
  CatalogCompositionRoot,
  type CatalogRootOptions,
  type CatalogTextMeasure,
  catalogRowTemplateIdentity,
} from "./compositionRoot";
import { catalogCollectionId } from "./dataBinding";
import { CatalogRuntime, type CatalogExternalEffect } from "./controller";
import {
  CatalogPreviewChannel,
  type CatalogPreviewChannelOptions,
} from "./previewChannel";
import { CatalogReadModel } from "./readModel";
import { CatalogHistoryStore } from "./history";
import { CatalogSession, type CatalogSelectionItem } from "./session";
import type { SlotChromeContext } from "./slotChrome";
import type { CatalogStorage } from "./storage";
import type { CatalogThemeState } from "./theme";

export interface CatalogWorkspaceOptions {
  engine: LayoutEngineAPI;
  viewport: { width: number; height: number };
  /** The page size of each breakpoint (`setBreakpoint`); default: `viewport` for every one. */
  viewportOf?: (breakpoint: BreakpointName) => {
    width: number;
    height: number;
  };
  root?: CatalogRootOptions;
  slotChrome?: SlotChromeContext;
  textMeasure?: CatalogTextMeasure;
  locale?: string;
  /** When an autosave runs after a step (default: a microtask). */
  autosaveSchedule?: (run: () => void) => void;
  /**
   * The project's theme (`catalogThemeState`): installed on open and whenever a step changes it
   * (a new root in its color mode — the records re-resolve their token values).
   */
  theme?: (graph: CatalogGraph) => CatalogThemeState;
}

/** A step touched what the theme reads: the project (active theme), a theme or a token. */
function touchesTheme(
  result: CatalogTransactionResult | undefined,
  projectId: string,
): boolean {
  if (!result) return false;
  for (const ids of [result.changedIds, result.removedIds])
    for (const id of ids)
      if (
        id === projectId ||
        id.startsWith("project:theme:") ||
        id.startsWith("project:token:")
      )
        return true;
  return false;
}

/** A Canvas/DOM record that stands for a document element (not a page frame or synthetic root). */
const isElementRecord = (sourceId: string) =>
  sourceId.startsWith("project:node:") || sourceId.startsWith("lib:template:");

/**
 * ADR-248 Phase 4e: one open project in the Builder — its runtime (history, saves), composition
 * root (Canvas and DOM records), session (selection, page), read model (panels), autosave and,
 * when a Preview is attached, its channel. Every edit goes through `execute` / `undo` / `redo`,
 * so the root's consumers take each step before it is published and the session follows it.
 */
export class CatalogWorkspace {
  readonly runtime: CatalogRuntime;
  private currentRoot: CatalogCompositionRoot;
  private readonly rootListeners = new Set<() => void>();
  readonly session: CatalogSession;
  readonly readModel: CatalogReadModel;
  readonly autosave: CatalogAutosave;
  readonly history: CatalogHistoryStore;
  private preview: CatalogPreviewChannel | undefined;
  private themeKey: string | undefined;
  /** `columns: "auto"`: the column count the visible Canvas fits (kept across root switches). */
  private autoColumns: number | undefined;
  private colorMode: "light" | "dark" | undefined;

  constructor(
    graph: CatalogGraph,
    storage: CatalogStorage,
    private readonly options: CatalogWorkspaceOptions,
  ) {
    this.runtime = new CatalogRuntime(graph, storage);
    this.applyTheme();
    this.currentRoot = this.createRoot(options.root?.breakpoint ?? "desktop");
    this.session = new CatalogSession(this.runtime, {
      identityExists: (identity) => this.root.domInputs.has(identity),
    });
    // The session shows the breakpoint the root opened on (a remembered one, not only desktop).
    this.session.setBreakpoint(this.currentRoot.breakpoint);
    this.readModel = new CatalogReadModel(this.runtime);
    this.autosave = new CatalogAutosave(this.runtime, {
      schedule: options.autosaveSchedule,
    });
    this.history = new CatalogHistoryStore(this.runtime, {
      undo: () => this.undo(),
      redo: () => this.redo(),
    });
  }

  /** Canvas and DOM records of the current breakpoint (`setBreakpoint` replaces it). */
  get root(): CatalogCompositionRoot {
    return this.currentRoot;
  }
  private createRoot(breakpoint: BreakpointName): CatalogCompositionRoot {
    const options = this.options;
    return new CatalogCompositionRoot(
      this.runtime,
      options.engine,
      options.viewportOf?.(breakpoint) ?? options.viewport,
      undefined,
      options.slotChrome,
      options.textMeasure,
      options.locale,
      {
        pageFrames: true,
        ...options.root,
        ...(this.autoColumns ? { autoColumns: this.autoColumns } : {}),
        ...(this.colorMode ? { colorMode: this.colorMode } : {}),
        ...(this.definitionView ? { definitionView: this.definitionView } : {}),
        breakpoint,
      },
    );
  }
  /** Install the graph's theme when it changed; true = the root must be rebuilt. */
  private applyTheme(): boolean {
    const state = this.options.theme?.(this.runtime.graph);
    if (!state || state.key === this.themeKey) return false;
    this.themeKey = state.key;
    this.colorMode = state.colorMode;
    state.install();
    return true;
  }
  /** A new composition root over the same runtime (the layout engine starts empty). */
  private replaceRoot(breakpoint: BreakpointName): void {
    this.options.engine.clear();
    this.currentRoot = this.createRoot(breakpoint);
    this.session.setBreakpoint(breakpoint);
    this.session.reconcile();
    for (const listener of [...this.rootListeners]) listener();
  }
  /** After a step: a changed theme builds a new root in its color mode with its token values. */
  private afterStep(result: CatalogTransactionResult | undefined): void {
    // The viewed definition is gone (an undo of its creation, a dissolve): back to the pages.
    if (
      this.definitionView &&
      this.runtime.graph.getEntry(this.definitionView)?.kind !== "definition"
    ) {
      this.showDefinition(undefined);
      return;
    }
    if (touchesTheme(result, this.projectId) && this.applyTheme())
      this.replaceRoot(this.currentRoot.breakpoint);
  }
  private definitionView: EntryId<"definition"> | undefined;
  /**
   * The definition edit view (ADR-248 4e): a new root that draws this project definition's
   * template instead of the pages (`undefined` = back to the pages). Its template nodes are owned
   * nodes, so selection, the panels and every edit command work on them as on a page; the
   * instances elsewhere follow each step.
   */
  showDefinition(definitionId: EntryId<"definition"> | undefined): void {
    if (definitionId === this.definitionView) return;
    if (
      definitionId &&
      this.runtime.graph.getEntry(definitionId)?.kind !== "definition"
    )
      throw new Error(`CATALOG_DEFINITION_NOT_FOUND:${definitionId}`);
    this.definitionView = definitionId;
    this.session.setDefinitionView(definitionId);
    this.replaceRoot(this.currentRoot.breakpoint);
  }
  /**
   * Show another breakpoint: a new composition root over the same runtime (history, saves and
   * the session stay); the layout engine starts empty. Root listeners (the Canvas scene) bind the
   * new root; the session drops positions the new root does not draw.
   */
  setBreakpoint(breakpoint: BreakpointName): void {
    if (breakpoint === this.currentRoot.breakpoint) return;
    this.replaceRoot(breakpoint);
  }
  /**
   * The page grid's `columns: "auto"` count (the Canvas computes it from its visible width and
   * zoom — `catalogAutoColumns`). True = page frames moved (the Canvas binds its scene again).
   */
  setAutoColumns(columns: number): boolean {
    this.autoColumns = columns;
    return this.currentRoot.setAutoColumns(columns);
  }
  subscribeRoot(listener: () => void): () => void {
    this.rootListeners.add(listener);
    return () => this.rootListeners.delete(listener);
  }

  private readonly rowListeners = new Set<() => void>();
  /**
   * Data rows changed in the data store (its collection ids; absent = every collection): the
   * root re-resolves the bound page roots, then row listeners (the Canvas scene) follow.
   */
  refreshRows(dataCollectionIds?: readonly string[]): void {
    const errors = this.currentRoot.refreshRows(
      dataCollectionIds
        ? new Set(dataCollectionIds.map((id) => catalogCollectionId(id)))
        : undefined,
    );
    for (const listener of [...this.rowListeners]) listener();
    if (errors.length)
      throw new AggregateError(errors, "CATALOG_ROWS_DELIVERY");
  }
  /**
   * Variable values changed outside the document (the data store's project variables): the root
   * re-resolves the `{{ }}` readers (`names`; absent = every template), then row listeners (the
   * Canvas scene — the same outside-a-step delta) follow.
   */
  refreshState(names?: readonly string[]): void {
    const errors = this.currentRoot.refreshState(
      names ? new Set(names) : undefined,
    );
    for (const listener of [...this.rowListeners]) listener();
    if (errors.length)
      throw new AggregateError(errors, "CATALOG_STATE_DELIVERY");
  }
  subscribeRows(listener: () => void): () => void {
    this.rowListeners.add(listener);
    return () => this.rowListeners.delete(listener);
  }
  /**
   * The drawn data rows of a bound collection row (the Layers projection, 4e-6-36): each item
   * record the bound root repeats (record identity and label — its first text). `undefined` = the
   * row is not a bound owned node or its rows are unknown (the template's sample items draw).
   */
  boundRowsOf(
    position: CatalogPosition,
  ): readonly { id: string; name: string }[] | undefined {
    if (position.target.kind !== "node") return undefined;
    const graph = this.runtime.graph;
    const entry = graph.getEntry(position.target.id);
    if (entry?.kind !== "node" || !entry.binding) return undefined;
    if (!this.options.root?.rows?.(entry.binding)) return undefined;
    const records = this.currentRoot.domInputs;
    const typeOf = (definitionId: string) => {
      try {
        return definitionTypeName(graph, definitionId as DefinitionId);
      } catch {
        return "";
      }
    };
    const textOf = (id: string): string | undefined => {
      const record = records.get(id);
      if (!record) return undefined;
      const own = record.props.children;
      if (typeof own === "string" && own) return own;
      for (const child of record.children) {
        const text = textOf(child);
        if (text) return text;
      }
      return undefined;
    };
    const rows: { id: string; name: string }[] = [];
    const visit = (id: string) => {
      const record = records.get(id);
      if (!record) return;
      if (CATALOG_ROW_ITEM_TYPES.has(typeOf(record.definitionId))) {
        rows.push({
          id,
          name: textOf(id) ?? typeOf(record.definitionId),
        });
        return;
      }
      record.children.forEach(visit);
    };
    records.get(position.identity)?.children.forEach(visit);
    return rows;
  }

  private readonly revealListeners = new Set<
    (pageId: EntryId<"page">) => void
  >();
  /** Ask the Canvas to bring a page frame into view (the Pages tree's page select). */
  revealPage(pageId: EntryId<"page">): void {
    // A page chosen in the Pages tree leaves the definition edit view.
    this.showDefinition(undefined);
    for (const listener of [...this.revealListeners]) listener(pageId);
  }
  subscribeReveal(listener: (pageId: EntryId<"page">) => void): () => void {
    this.revealListeners.add(listener);
    return () => this.revealListeners.delete(listener);
  }

  /** Copied subtrees of this project (in memory; paste re-creates them with new ids). */
  clipboard: CatalogClipboard | undefined;

  /** New entry ids for commands that create entries (random, never reused). */
  readonly newId: NewId = (kind) =>
    `project:${kind}:${crypto.randomUUID()}` as ReturnType<NewId>;

  get projectId(): EntryId<"project"> {
    return this.runtime.graph.projectId;
  }

  /** One user action; its `selectAfter` nodes become the selection (their first drawn position). */
  execute(command: CatalogCommand): {
    plan: CatalogCommandPlan;
    result: CatalogTransactionResult;
  } {
    const executed = this.root.execute(command);
    this.afterStep(executed.result);
    if (executed.plan.selectAfter)
      this.selectItems(
        executed.plan.selectAfter.flatMap((id) => this.itemsOfNode(id, 1)),
      );
    return executed;
  }
  /**
   * A change outside the document (the data store) as one history entry with its document part
   * (`command`, optional) — undo and redo run the outside effect after the document part.
   */
  recordExternal(
    label: string,
    effect: CatalogExternalEffect,
    command?: CatalogCommand,
  ): CatalogTransactionResult | undefined {
    const recorded = this.root.recordExternal(label, effect, command);
    if (recorded.result) this.afterStep(recorded.result);
    if (recorded.plan?.selectAfter)
      this.selectItems(
        recorded.plan.selectAfter.flatMap((id) => this.itemsOfNode(id, 1)),
      );
    return recorded.result;
  }
  /** Join the last `count` history entries into one (an AI batch); false = not joined. */
  mergeHistory(count: number, label: string): boolean {
    return this.runtime.mergeHistory(count, label);
  }
  undo(): CatalogTransactionResult | undefined {
    const result = this.root.undo();
    this.afterStep(result);
    return result;
  }
  redo(): CatalogTransactionResult | undefined {
    const result = this.root.redo();
    this.afterStep(result);
    return result;
  }

  /** Selection items for a node's drawn positions (`limit` of them, in record order). */
  itemsOfNode(id: NodeId, limit = Infinity): CatalogSelectionItem[] {
    return this.root
      .recordsOfSource(id)
      .slice(0, limit)
      .map((identity) => ({ target: { kind: "node", id }, identity }));
  }

  /** The element records from the page root down to a drawn record (empty = not an element). */
  private recordChain(recordId: string): string[] {
    const records = this.root.domInputs;
    const chain: string[] = [];
    for (
      let record = records.get(recordId);
      record && isElementRecord(record.sourceId);
      record = records.get(record.parentId)
    )
      chain.unshift(record.id);
    return chain;
  }
  /** The page a drawn record is on. */
  pageOfRecord(recordId: string): EntryId<"page"> | undefined {
    const owner = this.ownerOfRecord(recordId);
    return owner?.startsWith("project:page:")
      ? (owner as EntryId<"page">)
      : undefined;
  }
  /** The page — or, in the definition edit view, the definition — that owns a drawn record's root. */
  private ownerOfRecord(
    recordId: string,
  ): EntryId<"page"> | EntryId<"definition"> | undefined {
    const [top] = this.recordChain(recordId);
    const source = top && this.root.domInputs.get(top)?.sourceId;
    const owner = source && this.runtime.graph.ownerOf(source);
    const kind = owner ? this.runtime.graph.getEntry(owner)?.kind : undefined;
    return kind === "page"
      ? (owner as EntryId<"page">)
      : kind === "definition" && owner === this.definitionView
        ? (owner as EntryId<"definition">)
        : undefined;
  }

  /**
   * The Layers row (edit target) of a drawn record: follow its parents to the page root, then find
   * the row one level at a time (reads only the entries on the way).
   */
  positionOfRecord(recordId: string): CatalogPosition | undefined {
    // A data row's records are its row template position's.
    const chain = this.recordChain(recordId).map(catalogRowTemplateIdentity);
    const owner = this.ownerOfRecord(recordId);
    if (!chain.length || !owner) return undefined;
    let rows = owner.startsWith("project:definition:")
      ? this.readModel.definitionRows(owner as EntryId<"definition">)
      : this.readModel.pageRows(owner as EntryId<"page">);
    let position: CatalogPosition | undefined;
    for (const id of chain) {
      position = rows.find((row) => row.identity === id);
      if (!position) return undefined;
      rows = this.readModel.childRows(position);
    }
    return position;
  }
  /**
   * Select items; an item on another page opens that page first (the Layers tree shows the page
   * of the selection). An additive selection across pages replaces the selection.
   */
  private selectItems(
    items: readonly CatalogSelectionItem[],
    options?: { additive?: boolean },
  ): void {
    const pageId = items[0] && this.pageOfRecord(items[0].identity);
    if (pageId && pageId !== this.session.getSnapshot().pageId) {
      this.session.setPage(pageId);
      this.session.select(items);
      return;
    }
    this.session.select(items, options);
  }
  /** Canvas picking: select drawn records (their rows' targets). */
  selectRecords(
    recordIds: readonly string[],
    options?: { additive?: boolean },
  ): void {
    const items: CatalogSelectionItem[] = [];
    for (const identity of recordIds) {
      const item = this.itemOfRecord(identity);
      if (item) items.push(item);
    }
    this.selectItems(items, options);
  }
  /** The selection item of a drawn record (its row's target); `undefined` = not an element row. */
  itemOfRecord(identity: string): CatalogSelectionItem | undefined {
    const position = this.positionOfRecord(identity);
    return position && { target: position.target, identity };
  }

  /** Attach the Builder's Preview iframe (one at a time); returns its channel. */
  attachPreview(options: CatalogPreviewChannelOptions): CatalogPreviewChannel {
    this.preview?.dispose();
    this.preview = new CatalogPreviewChannel(this.runtime, options);
    return this.preview;
  }
  detachPreview(): void {
    this.preview?.dispose();
    this.preview = undefined;
  }

  dispose(): void {
    this.rootListeners.clear();
    this.rowListeners.clear();
    this.revealListeners.clear();
    this.detachPreview();
    this.autosave.dispose();
    this.history.dispose();
    this.readModel.dispose();
    this.session.dispose();
  }
}
