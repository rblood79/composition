import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogLibrary,
  EntryId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  parseCatalogPreviewData,
  parseCatalogPreviewView,
  type CatalogPreviewSnapshotRequest,
} from "../../../../../packages/shared/src/catalog/preview/protocol";
import {
  CatalogPreviewReceiver,
  type CatalogPreviewReceipt,
} from "../../../../../packages/shared/src/catalog/preview/receiver";
import {
  CatalogCompositionRoot,
  type CatalogRootOptions,
} from "../../builder/catalogRuntime/compositionRoot";
import { CatalogRuntime } from "../../builder/catalogRuntime/controller";
import type { CatalogThemeState } from "../../builder/catalogRuntime/theme";
import { catalogBoundRows } from "../../builder/catalogRuntime/dataBinding";
import {
  createRuntimeState,
  type CollectionDataSource,
  type DispatchDeps,
  type RuntimeKeyValueStorage,
  type RuntimeScope,
  type RuntimeStateHandle,
  type VariableDef,
} from "@composition/shared";
import { catalogRuntimeVariables } from "../../builder/catalogRuntime/stateTemplate";
import type { LayoutEngineAPI } from "../../builder/workspace/canvas/wasm-bindings/layoutBridge";

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
  private shownPage: EntryId<"page"> | undefined;
  /** The Builder's collections: bound collections draw their rows from them. */
  private collections: readonly CollectionDataSource[] = [];
  /** The Builder's project variables (the data store's, H1). */
  private variables: readonly VariableDef[] = [];
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
      this.navigate(view.pageId);
      return { kind: "ignored" };
    }
    const data = parseCatalogPreviewData(value);
    if (data) {
      this.collections = data.collections as readonly CollectionDataSource[];
      this.variables = (data.variables ?? []) as unknown as readonly VariableDef[];
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
  navigate(pageId: EntryId<"page">): void {
    if (pageId === this.shownPage) return;
    this.shownPage = pageId;
    // Entering a page starts its variables over (ADR-214 page scope).
    this.state?.enterPage(pageId);
    this.changed();
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
      document: null,
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
        rows: (binding) => catalogBoundRows(binding, this.collections),
        state: {
          projectVariables: () => this.variables,
          read: (variableId, scope) => this.readState(variableId, scope),
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
