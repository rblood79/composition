import {
  getAllLongTaskSnapshots,
  getSnapshot,
  PERF_LABEL,
  type PerfSnapshot,
} from "../../../utils/perfMarks";

/**
 * ADR-175 Phase 0 — viewport interaction baseline counters.
 *
 * Controller/store scheduling is intentionally not owned here. The module only
 * records the independently observable G1 quantities so the current baseline
 * and the later session implementation use identical measurements.
 */

interface ViewportInteractionCounters {
  listenerFanoutCount: number;
  listenerInvocationCount: number;
  mirrorCommitCount: number;
  rawInputCount: number;
  transientApplyCount: number;
}

export interface ViewportRafWallIntervalSnapshot {
  count: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ViewportInteractionMetricsSnapshot extends ViewportInteractionCounters {
  rafWallInterval: ViewportRafWallIntervalSnapshot;
}

export interface ViewportInteractionBaselineSnapshot {
  perf: {
    input: {
      drag: PerfSnapshot | null;
      wheelPan: PerfSnapshot | null;
      wheelZoom: PerfSnapshot | null;
    };
    longTasks: PerfSnapshot[];
    renderFrame: PerfSnapshot | null;
  };
  viewport: ViewportInteractionMetricsSnapshot;
}

const isMeasurementEnabled = process.env.NODE_ENV !== "production";

const counters: ViewportInteractionCounters = {
  listenerFanoutCount: 0,
  listenerInvocationCount: 0,
  mirrorCommitCount: 0,
  rawInputCount: 0,
  transientApplyCount: 0,
};

let lastRafTimestamp: number | null = null;
let rafWallIntervals: number[] = [];
let probePublishTimeout: number | null = null;

function isViewportMetricsProbeEnabled(): boolean {
  return (
    isMeasurementEnabled &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("viewportMetrics")
  );
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

function snapshotRafWallIntervals(): ViewportRafWallIntervalSnapshot {
  if (rafWallIntervals.length === 0) {
    return { count: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...rafWallIntervals].sort((a, b) => a - b);
  const total = sorted.reduce((sum, interval) => sum + interval, 0);

  return {
    count: sorted.length,
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    mean: Number((total / sorted.length).toFixed(2)),
    p50: Number(percentile(sorted, 0.5).toFixed(2)),
    p95: Number(percentile(sorted, 0.95).toFixed(2)),
    p99: Number(percentile(sorted, 0.99).toFixed(2)),
  };
}

export function recordViewportInteractionRawInput(): void {
  if (!isMeasurementEnabled) return;
  counters.rawInputCount += 1;
}

export function recordViewportInteractionTransientApply(): void {
  if (!isMeasurementEnabled) return;
  counters.transientApplyCount += 1;
}

export function recordViewportInteractionListenerFanout(
  listenerCount: number,
): void {
  if (!isMeasurementEnabled) return;
  counters.listenerFanoutCount += 1;
  counters.listenerInvocationCount += listenerCount;
}

export function recordViewportInteractionMirrorCommit(): void {
  if (!isMeasurementEnabled) return;
  counters.mirrorCommitCount += 1;
  scheduleViewportMetricsProbePublish();
}

export function recordViewportInteractionRafFrame(timestamp: number): void {
  if (!isMeasurementEnabled) return;
  if (lastRafTimestamp !== null && timestamp >= lastRafTimestamp) {
    rafWallIntervals.push(timestamp - lastRafTimestamp);
  }
  lastRafTimestamp = timestamp;
}

export function getViewportInteractionMetricsSnapshot(): ViewportInteractionMetricsSnapshot {
  return {
    ...counters,
    rafWallInterval: snapshotRafWallIntervals(),
  };
}

export function getViewportInteractionBaselineSnapshot(): ViewportInteractionBaselineSnapshot {
  return {
    perf: {
      input: {
        drag: getSnapshot(PERF_LABEL.INPUT_VIEWPORT_DRAG),
        wheelPan: getSnapshot(PERF_LABEL.INPUT_VIEWPORT_WHEEL_PAN),
        wheelZoom: getSnapshot(PERF_LABEL.INPUT_VIEWPORT_WHEEL_ZOOM),
      },
      longTasks: getAllLongTaskSnapshots(),
      renderFrame: getSnapshot(PERF_LABEL.RENDER_FRAME),
    },
    viewport: getViewportInteractionMetricsSnapshot(),
  };
}

function publishViewportMetricsProbe(): void {
  if (!isViewportMetricsProbeEnabled()) return;
  document.documentElement.dataset.compositionViewportMetrics = JSON.stringify(
    getViewportInteractionBaselineSnapshot(),
  );
}

function scheduleViewportMetricsProbePublish(): void {
  if (!isViewportMetricsProbeEnabled()) return;
  if (probePublishTimeout !== null) {
    window.clearTimeout(probePublishTimeout);
  }
  probePublishTimeout = window.setTimeout(() => {
    probePublishTimeout = null;
    publishViewportMetricsProbe();
  }, 200);
}

export function resetViewportInteractionMetrics(): void {
  counters.listenerFanoutCount = 0;
  counters.listenerInvocationCount = 0;
  counters.mirrorCommitCount = 0;
  counters.rawInputCount = 0;
  counters.transientApplyCount = 0;
  lastRafTimestamp = null;
  rafWallIntervals = [];
}

if (typeof window !== "undefined" && isMeasurementEnabled) {
  const target = window as typeof window & {
    __composition_VIEWPORT_METRICS__?: {
      baseline: typeof getViewportInteractionBaselineSnapshot;
      reset: typeof resetViewportInteractionMetrics;
      snapshot: typeof getViewportInteractionMetricsSnapshot;
    };
  };

  target.__composition_VIEWPORT_METRICS__ = {
    baseline: getViewportInteractionBaselineSnapshot,
    reset: resetViewportInteractionMetrics,
    snapshot: getViewportInteractionMetricsSnapshot,
  };
  publishViewportMetricsProbe();
}
