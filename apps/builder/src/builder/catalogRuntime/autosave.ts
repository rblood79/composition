import type { CatalogRuntime } from "./controller";
import { CatalogStorageError } from "./storage";

/**
 * - `saved`: the project's durable revision is its current revision.
 * - `unsaved`: steps wait for a save. `saving`: a save is running.
 * - `failed`: the last save failed; the next step or `retry()` tries again.
 * - `conflict`: another writer moved the stored revision (another tab); autosave stops.
 * - `unsupported`: the stored project is of another format or gone; autosave stops.
 */
export type CatalogSaveState =
  "saved" | "unsaved" | "saving" | "failed" | "conflict" | "unsupported";
export interface CatalogSaveStatus {
  readonly projectId: string;
  readonly state: CatalogSaveState;
  readonly revision: number;
  readonly durableRevision: number;
  readonly error?: unknown;
}

/**
 * ADR-248 §4.2 autosave: each published step schedules a save of its project, pinned to that
 * project and revision (the runtime saves in commit order). `saved` is shown only once the
 * storage transaction for the current revision completed; a failed or conflicting revision is
 * never shown as saved. Status is kept per project, so a save that finishes after a project
 * switch updates the project it saved.
 */
export class CatalogAutosave {
  private readonly statuses = new Map<string, CatalogSaveStatus>();
  private readonly scheduled = new Set<string>();
  private readonly running = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private unsubscribe: () => void;
  private readonly schedule: (run: () => void) => void;

  constructor(
    private readonly runtime: CatalogRuntime,
    options: { schedule?: (run: () => void) => void } = {},
  ) {
    this.schedule = options.schedule ?? ((run) => queueMicrotask(run));
    this.unsubscribe = this.listen();
  }

  /** Stable until the status changes (a `useSyncExternalStore` snapshot). */
  getSnapshot = (): CatalogSaveStatus => {
    const projectId = this.runtime.projectId;
    let status = this.statuses.get(projectId);
    if (!status) {
      status = {
        projectId,
        state:
          this.runtime.durableRevision === this.runtime.graph.revision
            ? "saved"
            : "unsaved",
        revision: this.runtime.graph.revision,
        durableRevision: this.runtime.durableRevision,
      };
      this.statuses.set(projectId, status);
    }
    return status;
  };
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
  }

  private listen(): () => void {
    const projectId = this.runtime.projectId;
    return this.runtime.subscribeSteps(({ result }) => {
      const current = this.statuses.get(projectId);
      const stopped =
        current?.state === "conflict" || current?.state === "unsupported";
      this.set(projectId, {
        state: stopped
          ? current.state
          : this.running.has(projectId)
            ? "saving"
            : "unsaved",
        revision: result.revision,
        error: stopped ? current.error : undefined,
      });
      if (!stopped) this.request(projectId);
    });
  }

  /** The runtime's active project changed: follow its steps (earlier saves keep running). */
  onProjectSwitched(): void {
    this.unsubscribe();
    this.unsubscribe = this.listen();
    this.emit();
  }

  /** Try again after `failed`, or save now. */
  retry(): Promise<void> {
    return this.save(this.runtime.projectId);
  }

  private request(projectId: string): void {
    if (this.scheduled.has(projectId)) return;
    this.scheduled.add(projectId);
    this.schedule(() => {
      this.scheduled.delete(projectId);
      void this.save(projectId);
    });
  }

  private async save(projectId: string): Promise<void> {
    if (this.running.has(projectId)) return;
    this.running.add(projectId);
    this.set(projectId, { state: "saving", error: undefined });
    try {
      await this.runtime.save(projectId as never);
      this.running.delete(projectId);
      const { revision, durableRevision } = this.revisions(projectId);
      this.set(projectId, {
        state: durableRevision === revision ? "saved" : "unsaved",
        durableRevision,
      });
      if (durableRevision !== revision) this.request(projectId);
    } catch (error) {
      this.running.delete(projectId);
      const code = error instanceof CatalogStorageError ? error.code : null;
      this.set(projectId, {
        state:
          code === "REVISION_CONFLICT"
            ? "conflict"
            : code === "UNSUPPORTED_PROJECT_FORMAT" ||
                code === "PROJECT_NOT_FOUND"
              ? "unsupported"
              : "failed",
        durableRevision: this.revisions(projectId).durableRevision,
        error,
      });
    }
  }

  private revisions(projectId: string) {
    return this.runtime.projectRevisions(projectId);
  }
  private set(
    projectId: string,
    patch: Partial<Omit<CatalogSaveStatus, "projectId">>,
  ): void {
    const { revision, durableRevision } = this.revisions(projectId);
    const previous = this.statuses.get(projectId);
    const next: CatalogSaveStatus = {
      projectId,
      state: previous?.state ?? "saved",
      error: previous?.error,
      revision,
      durableRevision,
      ...patch,
    };
    if (
      previous &&
      previous.state === next.state &&
      previous.revision === next.revision &&
      previous.durableRevision === next.durableRevision &&
      previous.error === next.error
    )
      return;
    this.statuses.set(projectId, next);
    if (projectId === this.runtime.projectId) this.emit();
  }
  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
