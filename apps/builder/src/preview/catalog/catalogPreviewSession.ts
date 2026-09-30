import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogLibrary,
  EntryId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
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
  root?: Omit<CatalogRootOptions, "colorMode">;
}

/**
 * ADR-248 4e-6 Preview: the iframe's catalog session. The replica graph comes from the Builder's
 * snapshot and deltas (`CatalogPreviewReceiver` — stale and gapped messages never apply); a read
 * only runtime and a composition root over it take each delta as a `sync` step, so the DOM binding
 * reads the records the Builder's root reads. The page shown follows the Builder's page until the
 * Preview navigates. A theme change (a delta touching the theme) builds a new root in the new
 * theme, as the Builder's workspace does.
 */
export class CatalogPreviewSession {
  private readonly receiver: CatalogPreviewReceiver;
  private runtime: CatalogRuntime | undefined;
  private currentRoot: CatalogCompositionRoot | undefined;
  private themeKey: string | undefined;
  private colorMode: "light" | "dark" | undefined;
  private shownPage: EntryId<"page"> | undefined;
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
        this.applyTheme(true);
        this.currentRoot = this.createRoot();
      } else if (this.applyTheme(false)) {
        this.currentRoot = this.createRoot();
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
    this.changed();
  }
  /** The record the page's DOM starts at (its body node's record). */
  get pageRecord(): string | undefined {
    const pageId = this.pageId;
    const page = pageId ? this.graph?.getEntry(pageId) : undefined;
    const body = page?.kind === "page" ? page.children[0] : undefined;
    return body ? this.currentRoot?.recordsOfSource(body)[0] : undefined;
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
        ...(this.colorMode ? { colorMode: this.colorMode } : {}),
      },
    );
  }
  private changed(): void {
    this.version += 1;
    for (const listener of [...this.listeners]) listener();
  }
}
