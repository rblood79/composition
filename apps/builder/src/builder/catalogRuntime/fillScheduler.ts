import type { CatalogFillReport } from "./compositionRoot";

/** What the scheduler reads of a composition root (ADR-307 staged load). */
export interface CatalogFillRoot {
  /**
   * Page roots that still miss records, in page order — without the ones whose fill failed at this
   * revision unless `failed` (a request retries them).
   */
  pendingFillRoots(options?: { failed?: boolean }): readonly string[];
  pageOfRoot(rootId: string): string | undefined;
  fill(
    rootId: string,
    options?: {
      deadline?: () => boolean;
      unitLimit?: number;
      retryFailed?: boolean;
    },
  ): CatalogFillReport;
}

export interface CatalogFillSchedulerHost {
  /** The root to fill now (another one after a root replacement — call `restart`). */
  root(): CatalogFillRoot;
  /** The session's page: filled before every other page. */
  currentPage(): string | undefined;
  /** A task added records (the Canvas scene follows, as after a data-row refresh). */
  delivered(): void;
  /** Subscriber errors of a delivery, or a failed task's cause (background tasks only report). */
  report(errors: readonly unknown[]): void;
  /** True while the user drives the Canvas (a camera gesture, a drag): background tasks wait. */
  busy?(): boolean;
  /** A task ended (with or without records): the host looks whether the fill is over. */
  settled?(): void;
}

export interface CatalogFillSchedulerOptions {
  /**
   * Run `task` when the main thread is idle; returns its cancel. Default: `requestIdleCallback`
   * (a timer where it is missing).
   */
  schedule?: (task: () => void) => () => void;
  now?: () => number;
  /**
   * A background task's time budget (ms): units are added until it is spent. Default 24 — the
   * task's layout pass and delivery are a fixed cost per task, so a small budget spends most of
   * the fill on them (66 pages at 4x CPU: 13.7 s at 8 ms, 10.0 s at 24 ms, no task over 100 ms).
   */
  taskBudget?: number;
  /**
   * Whether the user's input waits for the main thread: a task ends at its next unit (default:
   * `navigator.scheduling.isInputPending` where it exists).
   */
  inputPending?: () => boolean;
  /**
   * A synchronous request's cap (ms): past it, the rest of the page goes on in the background,
   * ahead of every other page (ADR-307 user decision 2026-11-11 — 150 ms at 4x CPU).
   */
  syncBudget?: number;
}

const idle = (task: () => void): (() => void) => {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(task, { timeout: 500 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(task, 16);
  return () => clearTimeout(handle);
};

const pendingInput = (): boolean => {
  const scheduling =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as { scheduling?: { isInputPending?: () => boolean } })
          .scheduling;
  return scheduling?.isInputPending?.() === true;
};

/**
 * ADR-307 Phase 2 — fills the page shells of a staged load: the current page, then the pages the
 * Canvas says are in view (`prioritize`), then the rest in page order; one task per idle period,
 * each a few units within a time budget. A synchronous request (`ensurePage`) fills a page now,
 * up to its cap.
 */
export class CatalogFillScheduler {
  private readonly schedule: (task: () => void) => () => void;
  private readonly now: () => number;
  private readonly taskBudget: number;
  private readonly inputPending: () => boolean;
  private readonly syncBudget: number;
  private cancel: (() => void) | undefined;
  private priority: readonly string[] = [];
  private stopped = false;

  constructor(
    private readonly host: CatalogFillSchedulerHost,
    options: CatalogFillSchedulerOptions = {},
  ) {
    this.schedule = options.schedule ?? idle;
    this.now = options.now ?? (() => performance.now());
    this.taskBudget = options.taskBudget ?? 24;
    this.inputPending = options.inputPending ?? pendingInput;
    this.syncBudget = options.syncBudget ?? 100;
  }

  /** Whether any page root still misses records. */
  get pending(): boolean {
    return this.host.root().pendingFillRoots().length > 0;
  }
  /** Schedule the next background task (after a root replacement, a step, a busy period). */
  restart(): void {
    this.stopped = false;
    this.arm();
  }
  /** Drop the scheduled task (the workspace is disposed). */
  stop(): void {
    this.stopped = true;
    this.cancel?.();
    this.cancel = undefined;
  }
  /** The pages in view, nearest first: filled after the current page, before the rest. */
  prioritize(pageIds: readonly string[]): void {
    this.priority = [...pageIds];
    this.arm();
  }

  /** The root filled next: the current page's, a prioritized page's, else the first pending. */
  private next(): string | undefined {
    const root = this.host.root();
    const pending = root.pendingFillRoots();
    if (!pending.length) return undefined;
    const current = this.host.currentPage();
    const rank = (rootId: string) => {
      const page = root.pageOfRoot(rootId);
      if (page === current) return -1;
      const at = page === undefined ? -1 : this.priority.indexOf(page);
      return at < 0 ? this.priority.length : at;
    };
    let best = pending[0];
    let bestRank = rank(best);
    for (const rootId of pending) {
      const value = rank(rootId);
      if (value < bestRank) {
        best = rootId;
        bestRank = value;
      }
    }
    return best;
  }
  private arm(): void {
    if (this.stopped || this.cancel || !this.pending) return;
    this.cancel = this.schedule(() => {
      this.cancel = undefined;
      this.run();
    });
  }
  /** One background task: units of the next root within the budget, then the next idle period. */
  private run(): void {
    if (this.stopped) return;
    if (!this.host.busy?.()) {
      const rootId = this.next();
      if (rootId === undefined) return;
      const start = this.now();
      this.task(rootId, {
        deadline: () =>
          this.now() - start >= this.taskBudget || this.inputPending(),
      });
    }
    this.arm();
  }
  private task(
    rootId: string,
    options: Parameters<CatalogFillRoot["fill"]>[1],
  ): CatalogFillReport {
    let report: CatalogFillReport;
    try {
      report = this.host.root().fill(rootId, options);
    } catch (error) {
      // (The engine could not be restored after a failed apply — nothing more to fill.)
      this.stop();
      this.host.report([error]);
      throw error;
    }
    if (report.records) this.host.delivered();
    if (report.errors.length) this.host.report(report.errors);
    this.host.settled?.();
    return report;
  }

  /**
   * A synchronous request for a page's content (a page switch): its roots are filled now, in
   * document order, up to the cap — what is left goes on in the background as the current page's.
   * A root that failed at this revision is tried again. Returns whether the page is filled.
   */
  ensurePage(pageId: string, options: { whole?: boolean } = {}): boolean {
    const root = this.host.root();
    const start = this.now();
    const spent = () => this.now() - start >= this.syncBudget;
    for (const rootId of root.pendingFillRoots({ failed: true })) {
      if (root.pageOfRoot(rootId) !== pageId) continue;
      const report = this.task(rootId, {
        retryFailed: true,
        ...(options.whole ? { unitLimit: Infinity } : { deadline: spent }),
      });
      if (report.status === "partial") break;
    }
    const filled = !root
      .pendingFillRoots({ failed: true })
      .some((rootId) => root.pageOfRoot(rootId) === pageId);
    if (!filled) this.arm();
    return filled;
  }
  /** Every page, now (a reader of the whole document — the AI's element list). */
  ensureAll(): void {
    const root = this.host.root();
    for (const rootId of [...root.pendingFillRoots({ failed: true })])
      this.task(rootId, { retryFailed: true, unitLimit: Infinity });
  }
}
