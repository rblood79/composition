import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  BreakpointName,
  EntryId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type {
  CatalogCommand,
  CatalogCommandPlan,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type { CatalogPosition } from "../../../../../packages/shared/src/catalog/resolution/positions";
import type { CatalogTransactionResult } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import type { LayoutEngineAPI } from "../workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogAutosave } from "./autosave";
import {
  CatalogCompositionRoot,
  type CatalogRootOptions,
  type CatalogTextMeasure,
} from "./compositionRoot";
import { CatalogRuntime } from "./controller";
import {
  CatalogPreviewChannel,
  type CatalogPreviewChannelOptions,
} from "./previewChannel";
import { CatalogReadModel } from "./readModel";
import { CatalogSession, type CatalogSelectionItem } from "./session";
import type { SlotChromeContext } from "./slotChrome";
import type { CatalogStorage } from "./storage";

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
  private preview: CatalogPreviewChannel | undefined;

  constructor(
    graph: CatalogGraph,
    storage: CatalogStorage,
    private readonly options: CatalogWorkspaceOptions,
  ) {
    this.runtime = new CatalogRuntime(graph, storage);
    this.currentRoot = this.createRoot(options.root?.breakpoint ?? "desktop");
    this.session = new CatalogSession(this.runtime, {
      identityExists: (identity) => this.root.domInputs.has(identity),
    });
    this.readModel = new CatalogReadModel(this.runtime);
    this.autosave = new CatalogAutosave(this.runtime, {
      schedule: options.autosaveSchedule,
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
      { pageFrames: true, ...options.root, breakpoint },
    );
  }
  /**
   * Show another breakpoint: a new composition root over the same runtime (history, saves and
   * the session stay); the layout engine starts empty. Root listeners (the Canvas scene) bind the
   * new root; the session drops positions the new root does not draw.
   */
  setBreakpoint(breakpoint: BreakpointName): void {
    if (breakpoint === this.currentRoot.breakpoint) return;
    this.options.engine.clear();
    this.currentRoot = this.createRoot(breakpoint);
    this.session.setBreakpoint(breakpoint);
    this.session.reconcile();
    for (const listener of [...this.rootListeners]) listener();
  }
  subscribeRoot(listener: () => void): () => void {
    this.rootListeners.add(listener);
    return () => this.rootListeners.delete(listener);
  }

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
    if (executed.plan.selectAfter)
      this.session.select(
        executed.plan.selectAfter.flatMap((id) => this.itemsOfNode(id, 1)),
      );
    return executed;
  }
  undo(): CatalogTransactionResult | undefined {
    return this.root.undo();
  }
  redo(): CatalogTransactionResult | undefined {
    return this.root.redo();
  }

  /** Selection items for a node's drawn positions (`limit` of them, in record order). */
  itemsOfNode(id: NodeId, limit = Infinity): CatalogSelectionItem[] {
    return this.root
      .recordsOfSource(id)
      .slice(0, limit)
      .map((identity) => ({ target: { kind: "node", id }, identity }));
  }

  /**
   * The Layers row (edit target) of a drawn record: follow its parents to the page root, then find
   * the row one level at a time (reads only the entries on the way).
   */
  positionOfRecord(recordId: string): CatalogPosition | undefined {
    const records = this.root.domInputs;
    const chain: string[] = [];
    for (
      let record = records.get(recordId);
      record && isElementRecord(record.sourceId);
      record = records.get(record.parentId)
    )
      chain.unshift(record.id);
    if (!chain.length) return undefined;
    const top = records.get(chain[0])!;
    const pageId = this.runtime.graph.ownerOf(top.sourceId);
    if (!pageId || this.runtime.graph.getEntry(pageId)?.kind !== "page")
      return undefined;
    let rows = this.readModel.pageRows(pageId as EntryId<"page">);
    let position: CatalogPosition | undefined;
    for (const id of chain) {
      position = rows.find((row) => row.identity === id);
      if (!position) return undefined;
      rows = this.readModel.childRows(position);
    }
    return position;
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
    this.session.select(items, options);
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
    this.detachPreview();
    this.autosave.dispose();
    this.readModel.dispose();
    this.session.dispose();
  }
}
