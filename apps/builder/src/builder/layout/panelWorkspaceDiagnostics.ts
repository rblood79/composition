import type { PanelId } from "../panels/core/types";
import {
  createPanelWorkspaceAppliedVersionTracker,
  summarizePanelWorkspaceAppliedFrames,
} from "./panelWorkspaceCanary";

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
  inputToAppliedFrameMs?: readonly number[];
  appliedVersionMismatchCount?: number;
  pointerDomGeometryQueryCount?: number;
}

export interface PanelWorkspaceTraceSummary {
  durationMs: number;
  displayPeriodMs: number | null;
  estimatedRefreshHz: number | null;
  expectedPeriods: number | null;
  missedPeriods: number | null;
  frameDelivery: number | null;
  baselineFrameDelivery: number | null;
  frameDeliveryDelta: number | null;
  pointerMoveCount: number;
  solveCount: number;
  workspaceCommitCount: number;
  frameCommitCount: number;
  frameCommitCounts: Record<string, number>;
  longTaskCount: number;
  longTaskTotalDurationMs: number;
  maxLongTaskMs: number;
  inputToAppliedFrameMs: readonly number[];
  inputToAppliedFrameP95Ms: number | null;
  appliedVersionMismatchCount: number;
  pointerDomGeometryQueryCount: number;
  passesG2b: boolean;
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

function frameDeliveryForIntervals(
  intervals: readonly number[],
  displayPeriodMs: number | null,
): number | null {
  if (
    displayPeriodMs === null ||
    displayPeriodMs <= 0 ||
    intervals.length === 0
  ) {
    return null;
  }
  const durationMs = intervals.reduce((total, interval) => total + interval, 0);
  const expectedPeriods = Math.floor(durationMs / displayPeriodMs);
  if (expectedPeriods <= 0) return null;
  const missedPeriods = intervals.reduce(
    (total, interval) =>
      total + Math.max(0, Math.round(interval / displayPeriodMs) - 1),
    0,
  );
  return Math.max(0, 1 - missedPeriods / expectedPeriods);
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
  inputToAppliedFrameMs = [],
  appliedVersionMismatchCount = 0,
  pointerDomGeometryQueryCount = 0,
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
  const baselineFrameDelivery = frameDeliveryForIntervals(
    idleFrameIntervals,
    displayPeriodMs,
  );
  const frameCommitCount = Array.from(frameCommitCounts.values()).reduce(
    (total, count) => total + count,
    0,
  );
  const longTaskTotalDurationMs = longTaskDurations.reduce(
    (total, duration) => total + duration,
    0,
  );

  const appliedFrames = summarizePanelWorkspaceAppliedFrames({
    displayPeriodMs,
    baselineFrameDelivery,
    interactionFrameDelivery: frameDelivery,
    inputToAppliedFrameMs,
    appliedVersionMismatchCount,
    longTaskCount: longTaskDurations.length,
    pointerDomGeometryQueryCount,
  });

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
    baselineFrameDelivery,
    frameDeliveryDelta: appliedFrames.frameDeliveryDelta,
    pointerMoveCount,
    solveCount,
    workspaceCommitCount,
    frameCommitCount,
    frameCommitCounts: Object.fromEntries(frameCommitCounts),
    longTaskCount: longTaskDurations.length,
    longTaskTotalDurationMs,
    maxLongTaskMs: Math.max(0, ...longTaskDurations),
    inputToAppliedFrameMs: [...inputToAppliedFrameMs],
    inputToAppliedFrameP95Ms: appliedFrames.inputToAppliedFrameP95Ms,
    appliedVersionMismatchCount,
    pointerDomGeometryQueryCount,
    passesG2b: appliedFrames.passesG2b,
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
  inputToAppliedFrameMs: number[];
  appliedVersionMismatchCount: number;
  pointerDomGeometryQueryCount: number;
  appliedVersionTracker: ReturnType<
    typeof createPanelWorkspaceAppliedVersionTracker
  >;
  longTaskObserver: PerformanceObserver | null;
  timeoutId: ReturnType<typeof setTimeout>;
}

class PanelWorkspaceDiagnostics {
  private activeTrace: ActivePanelWorkspaceTrace | null = null;
  private animationFrameId = 0;
  private previousFrameTime: number | null = null;
  private readonly idleFrameIntervals: number[] = [];
  private appliedPresentationFrameId: number | null = null;

  constructor() {
    document.addEventListener("pointerdown", this.handlePointerDown, true);
    document.addEventListener("pointermove", this.handlePointerMove, true);
    document.addEventListener("pointerup", this.handlePointerEnd, true);
    document.addEventListener("pointercancel", this.handlePointerEnd, true);
    document.addEventListener("keydown", this.handleKeyDown, true);
    this.animationFrameId = requestAnimationFrame(this.handleAnimationFrame);
  }

  dispose(): void {
    document.removeEventListener("pointerdown", this.handlePointerDown, true);
    document.removeEventListener("pointermove", this.handlePointerMove, true);
    document.removeEventListener("pointerup", this.handlePointerEnd, true);
    document.removeEventListener("pointercancel", this.handlePointerEnd, true);
    document.removeEventListener("keydown", this.handleKeyDown, true);
    cancelAnimationFrame(this.animationFrameId);
    if (this.appliedPresentationFrameId !== null) {
      cancelAnimationFrame(this.appliedPresentationFrameId);
      this.appliedPresentationFrameId = null;
    }
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

  recordLayoutInput(
    expectedVersion: number,
    affectedPanelIds: readonly PanelId[],
    inputAtMs: number,
  ): void {
    if (!this.activeTrace) return;
    this.activeTrace.appliedVersionTracker.recordInput({
      expectedVersion,
      affectedPanelIds,
      inputAtMs,
    });
  }

  recordFrameApplied(panelId: PanelId, version: number): void {
    const trace = this.activeTrace;
    if (!trace) return;
    trace.appliedVersionTracker.recordFrameApplied(panelId, version);
    if (this.appliedPresentationFrameId !== null) return;
    this.appliedPresentationFrameId = requestAnimationFrame((timestamp) => {
      this.appliedPresentationFrameId = null;
      if (this.activeTrace !== trace) return;
      let applied =
        trace.appliedVersionTracker.takeReadyPresentation(timestamp);
      while (applied) {
        trace.inputToAppliedFrameMs.push(applied.inputToAppliedFrameMs);
        trace.appliedVersionMismatchCount +=
          applied.appliedVersionMismatchCount;
        applied = trace.appliedVersionTracker.takeReadyPresentation(timestamp);
      }
    });
  }

  recordPointerDomGeometryQuery(): void {
    if (this.activeTrace) this.activeTrace.pointerDomGeometryQueryCount += 1;
  }

  startManualTrace(kind: PanelWorkspaceInteractionKind): void {
    if (!this.activeTrace) this.startTrace(kind);
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
    this.startTraceFromTarget(event.target);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    this.startTraceFromTarget(event.target);
  };

  private startTraceFromTarget(target: EventTarget | null): void {
    if (this.activeTrace || !(target instanceof Element)) return;
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
  }

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
      inputToAppliedFrameMs: [],
      appliedVersionMismatchCount: 0,
      pointerDomGeometryQueryCount: 0,
      appliedVersionTracker: createPanelWorkspaceAppliedVersionTracker(),
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
      inputToAppliedFrameMs: trace.inputToAppliedFrameMs,
      appliedVersionMismatchCount: trace.appliedVersionMismatchCount,
      pointerDomGeometryQueryCount: trace.pointerDomGeometryQueryCount,
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
    document
      .querySelector(".panel-workspace")
      ?.setAttribute("data-panel-trace-report", JSON.stringify(report));
    console.info(`${TRACE_LOG_PREFIX} ${JSON.stringify(report)}`);
    this.activeTrace = null;
  }
}

let diagnostics: PanelWorkspaceDiagnostics | null = null;
let diagnosticsConsumers = 0;

export function isPanelWorkspaceDiagnosticsEnabled(): boolean {
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

export function recordPanelWorkspaceLayoutInput(
  expectedVersion: number,
  affectedPanelIds: readonly PanelId[],
  inputAtMs = performance.now(),
): void {
  diagnostics?.recordLayoutInput(expectedVersion, affectedPanelIds, inputAtMs);
}

export function recordPanelFrameApplied(
  panelId: PanelId,
  layoutVersion: number,
): void {
  diagnostics?.recordFrameApplied(panelId, layoutVersion);
}

export function recordPanelPointerDomGeometryQuery(): void {
  diagnostics?.recordPointerDomGeometryQuery();
}

export function startPanelWorkspaceManualTrace(
  kind: PanelWorkspaceInteractionKind,
): void {
  diagnostics?.startManualTrace(kind);
}
