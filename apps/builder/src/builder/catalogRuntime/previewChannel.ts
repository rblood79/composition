import type {
  BreakpointName,
  CatalogEntry,
  EntryId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  CATALOG_PREVIEW_PAYLOAD_VERSION,
  isCatalogPreviewSnapshotRequest,
  type CatalogPreviewMessage,
  type CatalogPreviewViewMessage,
} from "../../../../../packages/shared/src/catalog/preview/protocol";
import type { CatalogRuntime } from "./controller";

/**
 * ADR-248 §4.3 Builder side of the Preview payload. Nothing is sent before the Preview is ready;
 * readiness (or a snapshot request) sends one snapshot of the active project, then each published
 * step adds its changed and removed ids to one pending delta, flushed by `schedule` (a frame, or
 * at once). A delta carries only the entries it names: a leaf edit sends one entry and never
 * exports the document.
 */
export interface CatalogPreviewChannelOptions {
  /** Deliver a message to the Preview (e.g. `iframe.contentWindow.postMessage(m, origin)`). */
  post: (message: CatalogPreviewMessage | CatalogPreviewViewMessage) => void;
  /** Run the flush later (coalescing the steps in between); default: at once. */
  schedule?: (flush: () => void) => void;
}

export class CatalogPreviewChannel {
  private ready = false;
  /** The editor revision the Preview holds (last sent), or null before the first snapshot. */
  private sentRevision: number | null = null;
  private sentProject: EntryId<"project"> | null = null;
  private readonly pendingIds = new Set<string>();
  /** The editor's page and breakpoint, sent after each snapshot and when they change. */
  private pageId: EntryId<"page"> | undefined;
  private breakpoint: BreakpointName = "desktop";
  private flushScheduled = false;
  private unsubscribe: () => void;
  private readonly schedule: (flush: () => void) => void;

  constructor(
    private readonly runtime: CatalogRuntime,
    private readonly options: CatalogPreviewChannelOptions,
  ) {
    this.schedule = options.schedule ?? ((flush) => flush());
    this.unsubscribe = this.listen();
  }

  private listen(): () => void {
    return this.runtime.subscribeSteps(({ result }) => {
      if (!this.ready || this.sentRevision === null) return;
      for (const id of result.changedIds) this.pendingIds.add(id);
      for (const id of result.removedIds) this.pendingIds.add(id);
      if (this.flushScheduled) return;
      this.flushScheduled = true;
      this.schedule(() => this.flush());
    });
  }

  dispose(): void {
    this.unsubscribe();
    this.pendingIds.clear();
    this.ready = false;
  }

  /** The Preview said it is ready (a new iframe document): it holds nothing yet. */
  onReady(): void {
    this.ready = true;
    this.sendSnapshot();
  }
  /** A message from the Preview; returns whether it was a catalog snapshot request. */
  onPreviewMessage(value: unknown): boolean {
    if (!isCatalogPreviewSnapshotRequest(value)) return false;
    if (this.ready) this.sendSnapshot();
    return true;
  }
  /** The runtime's active project changed: follow its steps and resend. */
  onProjectSwitched(): void {
    this.unsubscribe();
    this.unsubscribe = this.listen();
    if (this.ready) this.sendSnapshot();
  }

  /**
   * The editor shows another page or breakpoint: the Preview follows (after its current
   * document). The old compare-mode iframe took the breakpoint's width and the old Preview applied
   * the responsive overrides through `@media`; the catalog Preview resolves the layers at the
   * editor's breakpoint instead.
   */
  setView(
    pageId: EntryId<"page"> | undefined,
    breakpoint: BreakpointName = "desktop",
  ): void {
    if (pageId === this.pageId && breakpoint === this.breakpoint) return;
    this.pageId = pageId;
    this.breakpoint = breakpoint;
    if (this.ready && this.sentRevision !== null) this.sendView();
  }

  private sendView(): void {
    if (!this.pageId) return;
    this.options.post({
      type: "CATALOG_VIEW",
      version: CATALOG_PREVIEW_PAYLOAD_VERSION,
      pageId: this.pageId,
      breakpoint: this.breakpoint,
    });
  }

  /** Send the pending delta now (the scheduled flush calls it). */
  flush(): void {
    this.flushScheduled = false;
    if (!this.ready || this.sentRevision === null || !this.pendingIds.size)
      return;
    const graph = this.runtime.graph;
    if (graph.projectId !== this.sentProject) return this.sendSnapshot();
    const changed: CatalogEntry[] = [];
    const removedIds: EntryId[] = [];
    for (const id of this.pendingIds) {
      const entry = graph.getEntry(id);
      if (entry) changed.push(entry as CatalogEntry);
      else removedIds.push(id as EntryId);
    }
    this.pendingIds.clear();
    if (graph.revision === this.sentRevision) return;
    const baseRevision = this.sentRevision;
    this.sentRevision = graph.revision;
    this.options.post({
      type: "CATALOG_DELTA",
      version: CATALOG_PREVIEW_PAYLOAD_VERSION,
      projectId: graph.projectId,
      baseRevision,
      revision: graph.revision,
      changed,
      removedIds,
    });
  }

  private sendSnapshot(): void {
    const graph = this.runtime.graph;
    this.pendingIds.clear();
    this.sentRevision = graph.revision;
    this.sentProject = graph.projectId;
    this.options.post({
      type: "CATALOG_SNAPSHOT",
      version: CATALOG_PREVIEW_PAYLOAD_VERSION,
      projectId: graph.projectId,
      revision: graph.revision,
      document: graph.exportDocument(),
    });
    this.sendView();
  }
}
