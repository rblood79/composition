import { CatalogGraph, createCatalogGraph } from "../document/graph";
import type { CatalogLibrary, EntryId } from "../document/types";
import {
  applyCatalogTransaction,
  type CatalogOperation,
} from "../transactions/transaction";
import {
  CATALOG_PREVIEW_PAYLOAD_VERSION,
  parseCatalogPreviewMessage,
  type CatalogPreviewSnapshotRequest,
} from "./protocol";

/**
 * What the replica did with one message.
 * - `snapshot` / `delta`: applied; the graph and revision moved.
 * - `stale`: an older or already held revision; nothing changed.
 * - `gap`: the delta does not start at the held revision (or is for another project); not
 *   applied, a snapshot was requested once.
 * - `rejected`: a catalog payload the validator refused; the last good graph stays. A rejected
 *   delta also requests a snapshot; a rejected snapshot does not (asking again would loop).
 * - `ignored`: not a catalog payload of this version (old canonical messages included).
 */
export type CatalogPreviewReceipt =
  | { readonly kind: "snapshot" | "delta"; readonly revision: number }
  | { readonly kind: "stale" | "gap" | "ignored" }
  | { readonly kind: "rejected"; readonly error: unknown };

export interface CatalogPreviewUpdate {
  readonly graph: CatalogGraph;
  readonly projectId: EntryId<"project">;
  readonly revision: number;
  /** Entries whose resolved view may differ; `all` after a snapshot. */
  readonly invalidatedIds: readonly string[] | "all";
}

/**
 * ADR-248 §4.3 Preview replica: holds its own graph, applies a snapshot or a delta that starts at
 * the held editor revision, and never applies a stale or out-of-order message. A delta is one
 * `sync` transaction through the shared validator, so an invalid delta leaves the replica exactly
 * at its last good revision.
 */
export class CatalogPreviewReceiver {
  private current: CatalogGraph | undefined;
  private heldRevision: number | null = null;
  private awaitingSnapshot = false;
  private readonly listeners = new Set<
    (update: CatalogPreviewUpdate) => void
  >();

  constructor(
    private readonly library: CatalogLibrary,
    private readonly requestSnapshot: (
      request: CatalogPreviewSnapshotRequest,
    ) => void,
    /**
     * Applies a delta's operations to the held graph as one step (e.g. a replica runtime's
     * `sync`, so its view consumers take it). It must leave the graph unchanged when it throws.
     * Default: one `sync` transaction on the graph.
     */
    private readonly apply: (
      graph: CatalogGraph,
      ops: readonly CatalogOperation[],
    ) => void = (graph, ops) => {
      applyCatalogTransaction(graph, {
        projectId: graph.projectId,
        expectedRevision: graph.revision,
        ops,
        history: { kind: "skip", reason: "sync" },
      });
    },
  ) {}

  get graph(): CatalogGraph | undefined {
    return this.current;
  }
  get revision(): number | null {
    return this.heldRevision;
  }
  get projectId(): EntryId<"project"> | null {
    return this.current?.projectId ?? null;
  }
  subscribe(listener: (update: CatalogPreviewUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Ask for a snapshot now (first load, or a request that went unanswered). */
  request(): void {
    this.awaitingSnapshot = true;
    this.requestSnapshot({
      type: "CATALOG_SNAPSHOT_REQUEST",
      version: CATALOG_PREVIEW_PAYLOAD_VERSION,
      projectId: this.projectId,
      haveRevision: this.heldRevision,
    });
  }
  private requestOnce(): void {
    if (!this.awaitingSnapshot) this.request();
  }

  receive(value: unknown): CatalogPreviewReceipt {
    const message = parseCatalogPreviewMessage(value);
    if (!message) return { kind: "ignored" };
    const sameProject = message.projectId === this.projectId;
    if (message.type === "CATALOG_SNAPSHOT") {
      if (
        sameProject &&
        this.heldRevision !== null &&
        message.revision < this.heldRevision
      )
        return { kind: "stale" };
      let graph: CatalogGraph;
      try {
        if (message.document.projectId !== message.projectId)
          throw new Error("CATALOG_PREVIEW_PROJECT_MISMATCH");
        graph = createCatalogGraph(message.document, this.library);
      } catch (error) {
        return { kind: "rejected", error };
      }
      this.current = graph;
      this.heldRevision = message.revision;
      this.awaitingSnapshot = false;
      this.publish("all");
      return { kind: "snapshot", revision: message.revision };
    }
    const graph = this.current;
    if (!graph || !sameProject) {
      this.requestOnce();
      return { kind: "gap" };
    }
    if (message.revision <= this.heldRevision!) return { kind: "stale" };
    if (message.baseRevision !== this.heldRevision || this.awaitingSnapshot) {
      this.requestOnce();
      return { kind: "gap" };
    }
    const ops: CatalogOperation[] = [
      ...message.changed.map(
        (entry) => ({ kind: "put", entry }) as CatalogOperation,
      ),
      ...message.removedIds.map(
        (id) => ({ kind: "remove", id }) as CatalogOperation,
      ),
    ];
    const touched = [
      ...message.changed.map((entry) => entry.id),
      ...message.removedIds,
    ];
    let invalidated: Set<string>;
    try {
      const before = graph.collectAffectedIds(touched);
      this.apply(graph, ops);
      invalidated = new Set([...before, ...graph.collectAffectedIds(touched)]);
    } catch (error) {
      this.requestOnce();
      return { kind: "rejected", error };
    }
    this.heldRevision = message.revision;
    this.publish([...invalidated]);
    return { kind: "delta", revision: message.revision };
  }

  private publish(invalidatedIds: readonly string[] | "all"): void {
    const update: CatalogPreviewUpdate = {
      graph: this.current!,
      projectId: this.current!.projectId,
      revision: this.heldRevision!,
      invalidatedIds,
    };
    for (const listener of [...this.listeners]) listener(update);
  }
}
