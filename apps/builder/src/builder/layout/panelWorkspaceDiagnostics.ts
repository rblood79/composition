import type { PanelId } from "../panels/core/types";

const TRACE_QUERY_PARAM = "panelTrace";
const TRACE_DURATION_MS = 5_000;
const IDLE_FRAME_INTERVAL_LIMIT = 240;
const TRACE_LOG_PREFIX = "[PanelWorkspaceTrace]";

export type PanelWorkspaceInteractionKind = "move" | "resize";

interface PanelWorkspaceTraceSummaryInput {
  durationMs: number;
  idleFrameIntervals: readonly number[];
  interactionFrameIntervals: readonly number[];
  pointerMoveCount: number;
  solveCount: number;
  workspaceCommitCount: number;
  frameCommitCounts: ReadonlyMap<string, number>;
  longTaskDurations: readonly number[];
}

export interface PanelWorkspaceTraceSummary {
  durationMs: number;
  displayPeriodMs: number | null;
  estimatedRefreshHz: number | null;
  expectedPeriods: number | null;
  missedPeriods: number | null;
  frameDelivery: number | null;
  pointerMoveCount: number;
  solveCount: number;
  workspaceCommitCount: number;
  frameCommitCount: number;
  frameCommitCounts: Record<string, number>;
  longTaskCount: number;
  longTaskTotalDurationMs: number;
  maxLongTaskMs: number;
}

export interface PanelWorkspaceTraceReport extends PanelWorkspaceTraceSummary {
  kind: PanelWorkspaceInteractionKind;
  interactionEndedAtMs: number | null;
  rafSampleCount: number;
  longTaskObserverSupported: boolean;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const left = sorted[middle - 1];
  const right = sorted[middle];
  return left === undefined || right === undefined ? null : (left + right) / 2;
}

export function summarizePanelWorkspaceTrace({
  durationMs,
  idleFrameIntervals,
  interactionFrameIntervals,
  pointerMoveCount,
  solveCount,
  workspaceCommitCount,
  frameCommitCounts,
  longTaskDurations,
}: PanelWorkspaceTraceSummaryInput): PanelWorkspaceTraceSummary {
  const displayPeriodMs = median(idleFrameIntervals);
  const expectedPeriods =
    displayPeriodMs !== null && displayPeriodMs > 0
      ? Math.floor(durationMs / displayPeriodMs)
      : null;
  const missedPeriods =
    displayPeriodMs !== null && displayPeriodMs > 0
      ? interactionFrameIntervals.reduce(
          (total, interval) =>
            total + Math.max(0, Math.round(interval / displayPeriodMs) - 1),
          0,
        )
      : null;
  const frameDelivery =
    expectedPeriods !== null && expectedPeriods > 0 && missedPeriods !== null
      ? Math.max(0, 1 - missedPeriods / expectedPeriods)
      : null;
  const frameCommitCount = Array.from(frameCommitCounts.values()).reduce(
    (total, count) => total + count,
    0,
  );
  const longTaskTotalDurationMs = longTaskDurations.reduce(
    (total, duration) => total + duration,
    0,
  );

  return {
    durationMs,
    displayPeriodMs,
    estimatedRefreshHz:
      displayPeriodMs !== null && displayPeriodMs > 0
        ? 1_000 / displayPeriodMs
        : null,
    expectedPeriods,
    missedPeriods,
    frameDelivery,
    pointerMoveCount,
    solveCount,
    workspaceCommitCount,
    frameCommitCount,
    frameCommitCounts: Object.fromEntries(frameCommitCounts),
    longTaskCount: longTaskDurations.length,
    longTaskTotalDurationMs,
    maxLongTaskMs: Math.max(0, ...longTaskDurations),
  };
}

interface ActivePanelWorkspaceTrace {
  kind: PanelWorkspaceInteractionKind;
  startedAt: number;
  interactionEndedAt: number | null;
  idleFrameIntervals: number[];
  interactionFrameIntervals: number[];
  pointerMoveCount: number;
  solveCount: number;
  workspaceCommitCount: number;
  frameCommitCounts: Map<string, number>;
  longTaskDurations: number[];
  longTaskObserver: PerformanceObserver | null;
  timeoutId: ReturnType<typeof setTimeout>;
}

class PanelWorkspaceDiagnostics {
  private activeTrace: ActivePanelWorkspaceTrace | null = null;
  private animationFrameId = 0;
  private previousFrameTime: number | null = null;
  private readonly idleFrameIntervals: number[] = [];

  constructor() {
    document.addEventListener("pointerdown", this.handlePointerDown, true);
    document.addEventListener("pointermove", this.handlePointerMove, true);
    document.addEventListener("pointerup", this.handlePointerEnd, true);
    document.addEventListener("pointercancel", this.handlePointerEnd, true);
    this.animationFrameId = requestAnimationFrame(this.handleAnimationFrame);
  }

  dispose(): void {
    document.removeEventListener("pointerdown", this.handlePointerDown, true);
    document.removeEventListener("pointermove", this.handlePointerMove, true);
    document.removeEventListener("pointerup", this.handlePointerEnd, true);
    document.removeEventListener("pointercancel", this.handlePointerEnd, true);
    cancelAnimationFrame(this.animationFrameId);
    if (this.activeTrace) {
      clearTimeout(this.activeTrace.timeoutId);
      this.activeTrace.longTaskObserver?.disconnect();
      this.activeTrace = null;
    }
  }

  recordSolve(): void {
    if (this.activeTrace) this.activeTrace.solveCount += 1;
  }

  recordWorkspaceCommit(): void {
    if (this.activeTrace) this.activeTrace.workspaceCommitCount += 1;
  }

  recordFrameCommit(panelId: PanelId): void {
    if (!this.activeTrace) return;
    const current = this.activeTrace.frameCommitCounts.get(panelId) ?? 0;
    this.activeTrace.frameCommitCounts.set(panelId, current + 1);
  }

  private readonly handleAnimationFrame = (timestamp: number): void => {
    if (this.previousFrameTime !== null) {
      const interval = timestamp - this.previousFrameTime;
      this.idleFrameIntervals.push(interval);
      if (this.idleFrameIntervals.length > IDLE_FRAME_INTERVAL_LIMIT) {
        this.idleFrameIntervals.shift();
      }
      this.activeTrace?.interactionFrameIntervals.push(interval);
    }
    this.previousFrameTime = timestamp;
    this.animationFrameId = requestAnimationFrame(this.handleAnimationFrame);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.activeTrace) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const handle = target.closest<HTMLElement>(
      ".panel-move-handle, .panel-resize-handle",
    );
    if (!handle) return;
    const kind: PanelWorkspaceInteractionKind = handle.classList.contains(
      "panel-move-handle",
    )
      ? "move"
      : "resize";
    this.startTrace(kind);
  };

  private readonly handlePointerMove = (): void => {
    if (this.activeTrace) this.activeTrace.pointerMoveCount += 1;
  };

  private readonly handlePointerEnd = (): void => {
    if (!this.activeTrace || this.activeTrace.interactionEndedAt !== null) {
      return;
    }
    this.activeTrace.interactionEndedAt = performance.now();
  };

  private startTrace(kind: PanelWorkspaceInteractionKind): void {
    const startedAt = performance.now();
    const trace: ActivePanelWorkspaceTrace = {
      kind,
      startedAt,
      interactionEndedAt: null,
      idleFrameIntervals: [...this.idleFrameIntervals],
      interactionFrameIntervals: [],
      pointerMoveCount: 0,
      solveCount: 0,
      workspaceCommitCount: 0,
      frameCommitCounts: new Map(),
      longTaskDurations: [],
      longTaskObserver: null,
      timeoutId: setTimeout(() => this.finishTrace(trace), TRACE_DURATION_MS),
    };

    if (
      typeof PerformanceObserver !== "undefined" &&
      (PerformanceObserver.supportedEntryTypes?.includes("longtask") ?? true)
    ) {
      try {
        trace.longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            trace.longTaskDurations.push(entry.duration);
          }
        });
        trace.longTaskObserver.observe({ entryTypes: ["longtask"] });
      } catch {
        trace.longTaskObserver = null;
      }
    }

    this.activeTrace = trace;
  }

  private finishTrace(trace: ActivePanelWorkspaceTrace): void {
    if (this.activeTrace !== trace) return;
    for (const entry of trace.longTaskObserver?.takeRecords() ?? []) {
      trace.longTaskDurations.push(entry.duration);
    }
    trace.longTaskObserver?.disconnect();
    const finishedAt = performance.now();
    const durationMs = finishedAt - trace.startedAt;
    const summary = summarizePanelWorkspaceTrace({
      durationMs,
      idleFrameIntervals: trace.idleFrameIntervals,
      interactionFrameIntervals: trace.interactionFrameIntervals,
      pointerMoveCount: trace.pointerMoveCount,
      solveCount: trace.solveCount,
      workspaceCommitCount: trace.workspaceCommitCount,
      frameCommitCounts: trace.frameCommitCounts,
      longTaskDurations: trace.longTaskDurations,
    });
    const report: PanelWorkspaceTraceReport = {
      kind: trace.kind,
      interactionEndedAtMs:
        trace.interactionEndedAt === null
          ? null
          : trace.interactionEndedAt - trace.startedAt,
      rafSampleCount: trace.interactionFrameIntervals.length,
      longTaskObserverSupported: trace.longTaskObserver !== null,
      ...summary,
    };
    console.info(`${TRACE_LOG_PREFIX} ${JSON.stringify(report)}`);
    this.activeTrace = null;
  }
}

let diagnostics: PanelWorkspaceDiagnostics | null = null;
let diagnosticsConsumers = 0;

function isPanelWorkspaceDiagnosticsEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get(TRACE_QUERY_PARAM) === "1"
  );
}

export function mountPanelWorkspaceDiagnostics(): () => void {
  if (!isPanelWorkspaceDiagnosticsEnabled()) return () => {};
  diagnostics ??= new PanelWorkspaceDiagnostics();
  diagnosticsConsumers += 1;
  return () => {
    diagnosticsConsumers = Math.max(0, diagnosticsConsumers - 1);
    if (diagnosticsConsumers > 0) return;
    diagnostics?.dispose();
    diagnostics = null;
  };
}

export function recordPanelWorkspaceSolve(): void {
  diagnostics?.recordSolve();
}

export function recordPanelWorkspaceCommit(): void {
  diagnostics?.recordWorkspaceCommit();
}

export function recordPanelFrameCommit(panelId: PanelId): void {
  diagnostics?.recordFrameCommit(panelId);
}
