import { docCounters } from "./docCounters";
import { catalogAutoHtmlIds } from "./attributes";
import { catalogGridAutoRows } from "./gridAutoRows";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import { originForksOf } from "../../../../../packages/shared/src/catalog/document/originFork";
import type {
  BreakpointName,
  DefinitionId,
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type {
  CatalogCommand,
  CatalogCommandPlan,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type { CatalogClipboard } from "../../../../../packages/shared/src/catalog/commands";
import {
  lockOrigins,
  unlockOrigins,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogPosition } from "../../../../../packages/shared/src/catalog/resolution/positions";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import {
  CATALOG_EMPTY_STATE_COLLECTIONS,
  CATALOG_EMPTY_STATE_TYPE,
  RAC_COLLECTION_CHILD_TYPES,
} from "../../../../../packages/shared/src/catalog/nesting/nestingRules";
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
import type { CatalogBoundLayerRows } from "./layerTree";
import { CatalogReadModel } from "./readModel";
import { catalogRowSampleHidden } from "./rowSample";
import { catalogAbsentByOwnerValue } from "../../../../../packages/shared/src/catalog/runtime/presence";
import { CatalogHistoryStore } from "./history";
import type { EditTarget } from "../../../../../packages/shared/src/catalog/document/types";
import type { OwnFields } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  catalogComponentPageBaseline,
  catalogComponentPageCreation,
  catalogLocalPageSync,
  catalogComponentPageStored,
  catalogProjectComponents,
  setCatalogComponentsView,
} from "./componentsPage";
import {
  catalogOriginEditCommand,
  COMPONENTS_VIEW,
  isComponentsView,
  isComponentsViewRoot,
  isLibraryOrigin,
  isProjectComponentsView,
  originCardId,
  componentPageNodeId,
  PROJECT_COMPONENTS_VIEW,
  originSampleId,
} from "./originView";
import { holdsLibraryOrigin } from "./originViewNode";
import {
  CatalogSession,
  type CatalogDefinitionViewId,
  type CatalogSelectionItem,
} from "./session";
import type { SlotChromeContext } from "./slotChrome";
import type { CatalogStorage } from "./storage";
import type { CatalogComponentsViewId } from "./originViewNode";
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

/**
 * A row list's rows by identity (the first row of an identity, as a search finds it), kept per
 * list and filled only as far as a lookup needs (ADR-265 C8). The read model keeps a row list until
 * a step changes it and never mutates it; a new list gets a new index. A record's lookup ran a
 * linear search per level each time — the overlay looks the selection up on every paint, so a pick
 * among 5k siblings searched them ~13 times; a pick near the front still reads only the front.
 */
const rowIndexes = new WeakMap<
  readonly CatalogPosition[],
  { positions: Map<string, CatalogPosition>; next: number }
>();
function rowOf(
  rows: readonly CatalogPosition[],
  identity: string,
): CatalogPosition | undefined {
  let index = rowIndexes.get(rows);
  if (!index) {
    index = { positions: new Map(), next: 0 };
    rowIndexes.set(rows, index);
  }
  const found = index.positions.get(identity);
  if (found) return found;
  while (index.next < rows.length) {
    const row = rows[index.next++]!;
    if (process.env.NODE_ENV === "development")
      docCounters.selectSiblingCompares += 1;
    const key = row.identity;
    if (!index.positions.has(key)) index.positions.set(key, row);
    if (key === identity) return row;
  }
  return undefined;
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
/** The unlocked library origins and their copy roots (the Library page's ◆ cells — ADR-282). */
function libraryForksKey(graph: CatalogGraph): string {
  return JSON.stringify(
    [...originForksOf((id) => graph.getEntry(id), graph.projectId)].map(
      ([id, fork]) => [id, fork.templateRootId],
    ),
  );
}

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
  /** `columns: "auto"`: the monitor width the page grid's column count derives from (ADR-274). */
  private screenWidth: number | undefined;
  private colorMode: "light" | "dark" | undefined;
  /** The display's pixel ratio the engine snaps border widths to (`setDevicePixelRatio`). */
  private devicePixelRatio: number | undefined;

  constructor(
    graph: CatalogGraph,
    storage: CatalogStorage,
    private readonly options: CatalogWorkspaceOptions,
  ) {
    this.runtime = new CatalogRuntime(graph, storage);
    this.screenWidth = options.root?.screenWidth;
    this.devicePixelRatio = options.root?.devicePixelRatio;
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
    // ADR-282: the Library opens locked — the copies a session left unlocked and nobody edited go
    // back to the library (saved, no history entry). A failure leaves them; the project opens.
    if (originForksOf((id) => graph.getEntry(id), graph.projectId).size)
      try {
        this.root.executeOnLoad(lockOrigins());
      } catch (error) {
        console.error("[CatalogWorkspace] lock library on open:", error);
      }
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
        // A new root derives its own tier's columns from the same monitor width (ADR-274 F5 —
        //   one layout per breakpoint switch, no carried-over count to correct next frame).
        ...(this.screenWidth ? { screenWidth: this.screenWidth } : {}),
        ...(this.colorMode ? { colorMode: this.colorMode } : {}),
        ...(this.devicePixelRatio
          ? { devicePixelRatio: this.devicePixelRatio }
          : {}),
        ...(this.definitionView ? { definitionView: this.definitionView } : {}),
        breakpoint,
      },
    );
  }
  /** Install the graph's theme when it changed; true = the root must be rebuilt. */
  private applyTheme(): boolean {
    if (process.env.NODE_ENV === "development" && this.options.theme)
      docCounters.themeStateComputed += 1;
    const state = this.options.theme?.(this.runtime.graph);
    if (!state || state.key === this.themeKey) return false;
    this.themeKey = state.key;
    this.colorMode = state.colorMode;
    state.install();
    return true;
  }
  /**
   * Re-read the theme outside a step (the OS appearance changed under a `system` theme): a
   * changed theme builds a new root, as after a step.
   */
  refreshTheme(): void {
    if (this.applyTheme()) this.rebuildThemed();
  }
  /** A new root after a theme change; the open Components page reads its colors again. */
  private rebuildThemed(): void {
    if (isComponentsView(this.definitionView))
      setCatalogComponentsView(
        this.runtime.graph,
        this.definitionView,
        this.colorMode,
      );
    this.replaceRoot(this.currentRoot.breakpoint);
  }
  /** A new composition root over the same runtime (the layout engine starts empty). */
  private replaceRoot(breakpoint: BreakpointName): void {
    if (process.env.NODE_ENV === "development") docCounters.rootReplaced += 1;
    this.options.engine.clear();
    this.currentRoot = this.createRoot(breakpoint);
    this.session.setBreakpoint(breakpoint);
    this.session.reconcile();
    for (const listener of [...this.rootListeners]) listener();
  }
  /** After a step: a changed theme builds a new root in its color mode with its token values. */
  private afterStep(result: CatalogTransactionResult | undefined): void {
    // The viewed definition is gone (an undo of its creation, a dissolve): back to the pages.
    const viewed =
      this.definitionView && !isComponentsView(this.definitionView)
        ? this.runtime.graph.getEntry(this.definitionView)
        : undefined;
    if (
      this.definitionView &&
      !isComponentsView(this.definitionView) &&
      viewed?.kind !== "definition"
    ) {
      this.showDefinition(undefined);
      return;
    }
    if (touchesTheme(result, this.projectId) && this.applyTheme())
      this.rebuildThemed();
    // The project components page lists the project's components: one made, renamed, dissolved
    // or deleted (an undo too) lays the page out again.
    else if (isProjectComponentsView(this.definitionView)) {
      const key = JSON.stringify(catalogProjectComponents(this.runtime.graph));
      if (process.env.NODE_ENV === "development")
        docCounters.componentsKeyBytes += key.length;
      if (this.projectComponentsKey !== key)
        this.openComponentsView(this.definitionView);
    }
    // ADR-282: an origin unlocked or reset (an undo too) — its card's ◆ is its copy's root or
    // its sample again: the Library page is laid out again.
    else if (
      this.definitionView === COMPONENTS_VIEW &&
      this.libraryForksKey !== libraryForksKey(this.runtime.graph)
    )
      this.openComponentsView(this.definitionView);
    // (No copy left — an undo of the unlock, a reset: the Library is locked again.)
    if (
      this.libraryUnlocked &&
      !originForksOf((id) => this.runtime.graph.getEntry(id), this.projectId)
        .size
    )
      this.setLibraryMode(false);
  }
  /**
   * ADR-282 (user 2026-10-24 「Library 전체 해제」): the Library page's edit mode — unlocked, every
   * ◆ is its origin's copy and takes every edit; locked (the default — not saved), its copies take
   * none and a library ◆ its root props and styles only.
   */
  private libraryUnlocked = false;
  private readonly libraryModeListeners = new Set<() => void>();
  get isLibraryUnlocked(): boolean {
    return this.libraryUnlocked;
  }
  subscribeLibraryMode(listener: () => void): () => void {
    this.libraryModeListeners.add(listener);
    return () => this.libraryModeListeners.delete(listener);
  }
  private setLibraryMode(unlocked: boolean): void {
    if (this.libraryUnlocked === unlocked) return;
    this.libraryUnlocked = unlocked;
    for (const listener of [...this.libraryModeListeners]) listener();
  }
  /**
   * Unlock the whole Library (every origin forked in one step — `unlockOrigins`) or lock it (the
   * copies nobody edited go back to the library — `lockOrigins`). One history step when the
   * document changes; the mode follows either way.
   */
  setLibraryUnlocked(unlocked: boolean): void {
    const graph = this.runtime.graph;
    const command = unlocked
      ? unlockOrigins({ newId: this.newId })
      : lockOrigins();
    let plan: CatalogCommandPlan | undefined;
    try {
      plan = command(graph.commandReader);
    } catch (error) {
      // (Every origin already unlocked: only the mode changes.)
      if ((error as { code?: string }).code !== "ORIGINS_UNLOCKED") throw error;
    }
    if (plan?.ops.length) {
      const executed = this.root.execute(() => plan!);
      this.afterStep(executed.result);
    }
    this.setLibraryMode(unlocked);
  }
  /** The components the project components page was laid out with. */
  private projectComponentsKey: string | undefined;
  /** The unlocked origins the Library page was laid out with (ADR-282). */
  private libraryForksKey: string | undefined;
  /**
   * Lay a derived components page out (its view entries, a new root), then again with the cards'
   * drawn heights so its columns are balanced.
   */
  private openComponentsView(view: CatalogComponentsViewId): void {
    const graph = this.runtime.graph;
    this.projectComponentsKey = isProjectComponentsView(view)
      ? JSON.stringify(catalogProjectComponents(graph))
      : undefined;
    this.libraryForksKey =
      view === COMPONENTS_VIEW ? libraryForksKey(graph) : undefined;
    // ADR-282 Phase 3: a page the project stores is the document's (its layout is the user's);
    // the first open stores it (user 2026-10-25 — library-body is a page's body, the Local page
    // too), and the Local page follows the project's components. Either is a step the project
    // takes, not the user's: saved, no history entry.
    const plan = catalogComponentPageStored(graph, view)
      ? isProjectComponentsView(view)
        ? catalogLocalPageSync(graph, this.colorMode)?.(graph.commandReader)
        : undefined
      : catalogComponentPageCreation(
          graph,
          view,
          this.colorMode,
        )(graph.commandReader);
    if (plan) {
      setCatalogComponentsView(graph, undefined);
      this.runtime.load(plan.label, plan.ops);
    }
    setCatalogComponentsView(graph, view, this.colorMode);
    this.replaceRoot(this.currentRoot.breakpoint);
    // (Laid out again after a step — the Library's ◆ cells hold the copy roots or the samples:
    // Layers and the Canvas pick read the new rows.)
    this.readModel.viewEntriesChanged();
  }
  /** A Components page node: its stored id when the project stores the page (ADR-282 Phase 3). */
  private componentPageNode(viewId: NodeId): NodeId {
    const stored = componentPageNodeId(viewId);
    return this.runtime.graph.storedEntry(stored) ? stored : viewId;
  }
  private definitionView: CatalogDefinitionViewId | undefined;
  /**
   * The definition edit view (ADR-248 4e): a new root that draws this project definition's
   * template instead of the pages (`undefined` = back to the pages). Its template nodes are owned
   * nodes, so selection, the panels and every edit command work on them as on a page; the
   * instances elsewhere follow each step.
   */
  showDefinition(
    definitionId: CatalogDefinitionViewId | LibraryDefinitionId | undefined,
  ): void {
    // A built-in origin lives on the Components page: open the page and select its sample.
    if (isLibraryOrigin(definitionId)) {
      if (!this.runtime.graph.library.definitions.has(definitionId))
        throw new Error(`CATALOG_DEFINITION_NOT_FOUND:${definitionId}`);
      this.showDefinition(COMPONENTS_VIEW);
      // (An unlocked origin's ◆ is its copy's root — ADR-282.)
      const copyRoot =
        this.runtime.graph.getDefinitionOverride(definitionId)?.templateRootId;
      this.session.select(
        copyRoot
          ? this.libraryOriginItems(copyRoot)
          : this.itemsOfNode(originSampleId(definitionId), 1),
      );
      // Bring that component's card into view (the page is far larger than the Canvas).
      const [card] = this.itemsOfNode(
        this.componentPageNode(originCardId(definitionId)),
        1,
      );
      if (card)
        for (const listener of [...this.recordRevealListeners])
          listener(card.identity);
      return;
    }
    // ADR-279 Decision 5: a component's origin lives on the project components page (the Local
    // page) — open it there and select the template root, as for a built-in origin.
    const viewed =
      definitionId && !isComponentsView(definitionId)
        ? this.runtime.graph.getEntry(definitionId)
        : undefined;
    if (
      viewed?.kind === "definition" &&
      viewed.usage !== "layout" &&
      viewed.templateRootId &&
      this.runtime.graph.getEntry(viewed.templateRootId)
    ) {
      this.showDefinition(PROJECT_COMPONENTS_VIEW);
      const items = this.itemsOfNode(viewed.templateRootId, 1);
      this.selectItems(items);
      if (items[0])
        for (const listener of [...this.recordRevealListeners])
          listener(items[0].identity);
      return;
    }
    if (definitionId === this.definitionView) return;
    const graph = this.runtime.graph;
    if (
      definitionId &&
      !isComponentsView(definitionId) &&
      graph.getEntry(definitionId)?.kind !== "definition"
    )
      throw new Error(`CATALOG_DEFINITION_NOT_FOUND:${definitionId}`);
    // A components page is derived view entries (never saved); a project definition is its
    // template.
    this.definitionView = definitionId;
    this.session.setDefinitionView(definitionId);
    if (isComponentsView(definitionId)) {
      this.openComponentsView(definitionId);
      return;
    }
    this.projectComponentsKey = undefined;
    setCatalogComponentsView(graph, undefined);
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
   * The font set changed (a custom font uploaded or removed mid-session): every text is measured
   * and drawn again — a new root over the same runtime, like a theme change (the old Canvas's
   * `syncCustomFontsWithSkia` + relayout).
   */
  refreshFonts(): void {
    this.replaceRoot(this.currentRoot.breakpoint);
  }
  /**
   * The monitor width (`screen.width`) the page grid's `columns: "auto"` derives from — the
   * camera zoom is not an input (ADR-274). True = page frames moved (the Canvas places them).
   */
  setScreenWidth(width: number): boolean {
    this.screenWidth = width;
    return this.currentRoot.setScreenWidth(width);
  }
  /**
   * The display's pixel ratio changed (the window moved to another display, or the browser zoom):
   * the engine snaps border widths to device pixels, so every box is laid out again — a new root,
   * as after a font change. True = replaced.
   */
  setDevicePixelRatio(dpr: number): boolean {
    if (!(dpr > 0) || dpr === this.devicePixelRatio) return false;
    this.devicePixelRatio = dpr;
    this.replaceRoot(this.currentRoot.breakpoint);
    return true;
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
   * The drawn data rows a row holds (the Layers projection, 4e-6-36): its child records a bound
   * collection repeats (record identity, label — its first text — and type), the rows the Canvas
   * sample draws, and how many it does not (`more` — the collection's count past the sample).
   * `undefined` = the row holds no data rows (unbound or rows unknown: the item positions list).
   */
  /**
   * Whether a template part is absent by its parent's empty prop (`catalogAbsentByOwnerValue` — a
   * Checkbox's Description without `description`): no element, no box, so no Layers row.
   */
  rowAbsentByValue(position: CatalogPosition): boolean {
    const root = this.currentRoot;
    const records = root.domInputs;
    const record = records.get(position.identity);
    return (
      !!record &&
      catalogAbsentByOwnerValue(record, (id) => records.get(id), root.typeOf)
    );
  }
  /**
   * Whether the Canvas leaves a collection's row undrawn (Layers lists what it draws, 2026-10-23):
   * its EmptyState (RAC `renderEmptyState`) while it has items, and its item positions while its
   * loaded data is empty (no row is projected from them).
   */
  collectionRowHidden(position: CatalogPosition, parentType: string): boolean {
    if (!CATALOG_EMPTY_STATE_COLLECTIONS.has(parentType)) return false;
    const root = this.currentRoot;
    let type: string;
    try {
      type = definitionTypeName(this.runtime.graph, position.definitionId);
    } catch {
      return false;
    }
    if (type === CATALOG_EMPTY_STATE_TYPE)
      return (
        (
          root.canvasInputs.get(position.identity) ??
          root.domInputs.get(position.identity)
        )?.hidden === true
      );
    return (
      (RAC_COLLECTION_CHILD_TYPES[parentType] ?? []).includes(type) &&
      !root.domInputs.has(position.identity)
    );
  }
  boundRowsOf(position: CatalogPosition): CatalogBoundLayerRows | undefined {
    const root = this.currentRoot;
    const records = root.domInputs;
    const owner = records.get(position.identity);
    if (!owner) return undefined;
    const graph = this.runtime.graph;
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
    const rows: CatalogBoundLayerRows["rows"][number][] = [];
    for (const id of owner.children) {
      const record = records.get(id);
      if (record?.rowIndex === undefined) continue;
      const drawn = root.canvasInputs.get(id);
      if (drawn && catalogRowSampleHidden(root, drawn)) continue;
      const typeName = typeOf(record.definitionId);
      rows.push({
        id,
        name: textOf(id) ?? typeName,
        typeName,
        // A synthesized row (a Table's data row) has no Layers position: it selects its holder.
        ...(this.positionOfRecord(id) ? {} : { selects: owner.id }),
      });
    }
    if (!rows.length) return undefined;
    const count = root.canvasInputs.get(owner.id)?.rowCount;
    const more =
      root.rowSample !== undefined && count !== undefined
        ? count - root.rowSample
        : 0;
    return more > 0 ? { rows, more } : { rows };
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
  private readonly recordRevealListeners = new Set<
    (identity: string) => void
  >();
  /** The Canvas brings a drawn record into view when asked (a component's card on its page). */
  subscribeRevealRecord(listener: (identity: string) => void): () => void {
    this.recordRevealListeners.add(listener);
    return () => this.recordRevealListeners.delete(listener);
  }

  /** Copied subtrees of this project (in memory; paste re-creates them with new ids). */
  clipboard: CatalogClipboard | undefined;

  /** Asset GC memory roots: the open documents, unsaved commits, undo/redo operations, clipboard. */
  assetRootPayloads(): unknown[] {
    return [...this.runtime.assetRootPayloads(), this.clipboard];
  }

  /** New entry ids for commands that create entries (random, never reused). */
  readonly newId: NewId = (kind) =>
    `project:${kind}:${crypto.randomUUID()}` as ReturnType<NewId>;

  get projectId(): EntryId<"project"> {
    return this.runtime.graph.projectId;
  }

  private readonly executeListeners = new Set<
    (result: CatalogTransactionResult) => void
  >();
  /**
   * One user action; its `selectAfter` nodes become the selection (their first drawn position).
   * `expectedRevision`: commit at that revision or throw `REVISION_CONFLICT` (no re-plan).
   */
  execute(
    command: CatalogCommand,
    options: { expectedRevision?: number } = {},
  ): {
    plan: CatalogCommandPlan;
    result: CatalogTransactionResult;
  } {
    // The Components page: a sample's root writes become its origin's project defaults.
    const view = this.definitionView;
    // Each element the action creates gets its author DOM id (the old `customId`) in this step.
    // Rows 「자동」 grids close the rows the step left empty (Figma), in the same step.
    const executed = this.root.execute(
      catalogAutoHtmlIds(
        this.runtime.graph,
        catalogGridAutoRows(
          isComponentsView(view)
            ? catalogOriginEditCommand(
                this.runtime.graph,
                command,
                this.newId,
                // (A locked Library: its copies take no edit — ADR-282.)
                view === COMPONENTS_VIEW && !this.libraryUnlocked,
              )
            : command,
        ),
      ),
      options,
    );
    this.afterStep(executed.result);
    if (executed.plan.selectAfter)
      this.selectItems(
        executed.plan.selectAfter.flatMap((id) => this.selectableItemsOf(id)),
      );
    for (const listener of [...this.executeListeners])
      listener(executed.result);
    return executed;
  }
  /** Each user action's step after it runs (not undo / redo) — the component edit confirmation. */
  subscribeExecute(
    listener: (result: CatalogTransactionResult) => void,
  ): () => void {
    this.executeListeners.add(listener);
    return () => this.executeListeners.delete(listener);
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
    const recorded = this.root.recordExternal(
      label,
      effect,
      command && catalogAutoHtmlIds(this.runtime.graph, command),
    );
    if (recorded.result) this.afterStep(recorded.result);
    if (recorded.plan?.selectAfter)
      this.selectItems(
        recorded.plan.selectAfter.flatMap((id) => this.selectableItemsOf(id)),
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
  /**
   * ADR-282: an unlocked origin's copy root as its Library card's ◆ draws it — not one of the
   * instances that project it (every Button on the page is drawn from the copy root too).
   */
  libraryOriginItems(id: NodeId): CatalogSelectionItem[] {
    const records = this.root.domInputs;
    return this.itemsOfNode(id)
      .filter(({ identity }) => {
        const record = records.get(identity);
        // (Its own record — not another ◆ whose root is an instance of it, a FieldButton's.)
        return (
          record?.sourceId === id &&
          holdsLibraryOrigin(records.get(record.parentId)?.sourceId)
        );
      })
      .slice(0, 1);
  }
  /** A node's first drawn position — an unlocked origin's copy root, its Library card's ◆. */
  private selectableItemsOf(id: NodeId): CatalogSelectionItem[] {
    const own = this.runtime.graph
      .definitionOfTemplateRoot(id)
      ?.startsWith("lib:")
      ? this.libraryOriginItems(id)
      : [];
    return own.length ? own : this.itemsOfNode(id, 1);
  }
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
  ): EntryId<"page"> | CatalogDefinitionViewId | undefined {
    const [top] = this.recordChain(recordId);
    const source = top && this.root.domInputs.get(top)?.sourceId;
    if (isComponentsViewRoot(source)) return this.definitionView;
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
    let rows =
      owner.startsWith("project:definition:") || isComponentsView(owner)
        ? this.readModel.definitionRows(owner as CatalogDefinitionViewId)
        : this.readModel.pageRows(owner as EntryId<"page">);
    let position: CatalogPosition | undefined;
    for (const id of chain) {
      position = rowOf(rows, id);
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
      this.session.setPage(pageId, items);
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
      const position = this.positionOfRecord(identity);
      if (position) items.push({ target: position.target, identity });
    }
    this.selectItems(items, options);
  }
  /**
   * A Library · Local page node's defaults — its fields as the page makes it
   * (`catalogComponentPageBaseline`): the Styles panel's "modified" marks and reset read them.
   */
  componentPageBaseline(target: EditTarget): OwnFields | undefined {
    if (target.kind !== "node") return undefined;
    const entry = catalogComponentPageBaseline(
      this.runtime.graph,
      target.id,
      this.colorMode,
    );
    return entry
      ? {
          props: entry.props,
          visual: entry.visual,
          layout: entry.layout ?? {},
          sizing: entry.sizing,
          ...(entry.responsive ? { responsive: entry.responsive } : {}),
        }
      : undefined;
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
    this.setPreviewValues(undefined);
  }

  private previewValuesState: Readonly<Record<string, unknown>> | undefined;
  private readonly previewValueListeners = new Set<() => void>();
  /**
   * ADR-284 Decision 11 — the variables' values the attached Preview reports (`undefined` = no
   * Preview running: a filter's detail says 「실행 전」 and shows the defaults as defaults).
   */
  get previewValues(): Readonly<Record<string, unknown>> | undefined {
    return this.previewValuesState;
  }
  setPreviewValues(
    values: Readonly<Record<string, unknown>> | undefined,
  ): void {
    this.previewValuesState = values;
    for (const listener of this.previewValueListeners) listener();
  }
  subscribePreviewValues(listener: () => void): () => void {
    this.previewValueListeners.add(listener);
    return () => this.previewValueListeners.delete(listener);
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
