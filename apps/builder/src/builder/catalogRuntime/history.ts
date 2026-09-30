import type { CatalogRuntime } from "./controller";

export interface CatalogHistorySnapshot {
  /** Entry labels in order: the applied ones, then the undone ones (next redo first). */
  readonly labels: readonly string[];
  /** How many entries are applied (`labels.slice(0, applied)`); 0 = the opened state. */
  readonly applied: number;
}

/**
 * ADR-248 Phase 4e-4: the History panel's read of the project's single history — entry labels
 * and the applied count, re-read after each published step (edit, undo, redo) and after a clear.
 * Jumping to an entry undoes or redoes one step at a time through the workspace (each one a
 * published step, so every consumer follows).
 */
export class CatalogHistoryStore {
  private snapshot: CatalogHistorySnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly runtime: CatalogRuntime,
    private readonly steps: { undo(): unknown; redo(): unknown },
  ) {
    this.snapshot = this.read();
    this.unsubscribe = runtime.subscribeSteps(() => this.refresh());
  }
  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
  }
  getSnapshot = (): CatalogHistorySnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Undo or redo until `applied` entries are applied. */
  goTo(applied: number): void {
    const target = Math.max(0, Math.min(applied, this.snapshot.labels.length));
    while (this.snapshot.applied > target) this.steps.undo();
    while (this.snapshot.applied < target) this.steps.redo();
  }
  /** Drop every entry (the document stays as it is). */
  clear(): void {
    this.runtime.clearHistory();
    this.refresh();
  }

  private read(): CatalogHistorySnapshot {
    const { undo, redo } = this.runtime.historyLabels;
    return { labels: [...undo, ...redo], applied: undo.length };
  }
  private refresh(): void {
    const next = this.read();
    if (
      next.applied === this.snapshot.applied &&
      next.labels.length === this.snapshot.labels.length &&
      next.labels.every((label, index) => label === this.snapshot.labels[index])
    )
      return;
    this.snapshot = next;
    for (const listener of [...this.listeners]) listener();
  }
}
