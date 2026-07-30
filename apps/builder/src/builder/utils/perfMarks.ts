/**
 * Performance Marks — labeled duration tracker
 *
 * ADR-069 observability infrastructure.
 *
 * Purpose: automate Gate G1/G2 verification without relying on manual
 * Chrome DevTools Performance recordings. Captures labeled durations,
 * maintains ring buffer per label, and exposes p50/p95/p99/violation
 * statistics via `window.__composition_PERF__`.
 *
 * Two observation modes share the same buffer Map:
 * - observe(label, fn) — synchronous wrapper (function-body duration)
 * - PerformanceObserver('longtask') — browser task-level duration,
 *   classified into "longtask.input" / "longtask.render" /
 *   "longtask.unclassified" by timestamp overlap with recent observe() traces.
 *
 * Usage:
 *   observe(PERF_LABEL.INPUT_POINTERDOWN, () => handlePointerDown(event));
 *   // In DevTools console:
 *   window.__composition_PERF__.snapshot("input.pointerdown");
 *   window.__composition_PERF__.snapshotLongTasks();
 */

// ============================================================
// Label constants
// ============================================================

/**
 * Canonical label strings for observe() call sites.
 * Using the constant prevents typos and lets the compiler catch missing
 * wire-ups when a new measurement point is added.
 */
export const PERF_LABEL = {
  INPUT_POINTERDOWN: "input.pointerdown",
  /**
   * ADR-074 Phase 5: 페이지 전환 경로 전용 계측.
   * setCurrentPageId / selectElementWithPageTransition 에서 페이지 전환
   * 분기를 래핑. `input.*` prefix 로 longtask.input 카테고리에 자동 분류.
   */
  INPUT_PAGE_TRANSITION: "input.page-transition",
  RENDER_FRAME: "render.frame",
  RENDER_CONTENT_BUILD: "render.content.build",
  RENDER_PLAN_BUILD: "render.plan.build",
  RENDER_SKIA_DRAW: "render.skia.draw",
  /**
   * ADR-153 Phase 1-e: 상호작용 프레임 내부 분해 라벨 (호출부는 dev-only 게이트).
   * record = 씬 재기록 (CanvasKit WASM CPU), flush.content = Ganesh op 실행 +
   * makeImageSnapshot, flush.main = 화면 surface 제출. 2026-07-27 분해 실측의
   * 임시 라벨 3종을 상설화 — G1 오버헤드 판정과 Phase 0 baseline 재실측의 공급 지표.
   */
  RENDER_SKIA_RECORD_CONTENT: "render.skia.record.content",
  RENDER_SKIA_FLUSH_CONTENT: "render.skia.flush.content",
  RENDER_SKIA_FLUSH_MAIN: "render.skia.flush.main",
} as const;

// Long-task classification: observe() label prefix → longtask bucket.
// Adding a category (e.g. "layout.") is a one-line change here.
const LONGTASK_CATEGORIES = [
  { prefix: "input.", label: "longtask.input" },
  { prefix: "render.", label: "longtask.render" },
] as const;

const LONGTASK_LABELS = [
  "longtask.input",
  "longtask.render",
  "longtask.unclassified",
] as const;
type LongTaskLabel = (typeof LONGTASK_LABELS)[number];

// ============================================================
// Internal types / state
// ============================================================

const BUFFER_SIZE = 1000;
const VIOLATION_THRESHOLDS = [50, 100] as const;

// observe() wrapper measures only the function body. Chrome's task-level
// duration (including the following React commit + subscriber fan-out) is
// captured separately by a PerformanceObserver('longtask'), which uses this
// trace ring to classify each longtask by temporal overlap with the most
// recent observe() calls.
const TRACE_RING_MAX = 256;
const TRACE_AGE_WINDOW_MS = 5_000;

interface LabelBuffer {
  /** Ring buffer of recent durations (ms). Newest entries at the end. */
  durations: number[];
  /** Running total samples seen (can exceed BUFFER_SIZE). */
  totalCount: number;
  /** Count of durations exceeding 50 ms threshold. */
  violations50ms: number;
  /** Count of durations exceeding 100 ms threshold. */
  violations100ms: number;
  /** Attribution counts — populated only for longtask.* labels. */
  attributions?: Map<string, number>;
}

export interface MeasurementTrace {
  label: string;
  start: number;
  end: number;
}

export interface PerfSnapshot {
  label: string;
  count: number;
  totalCount: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  /** Count of durations > 50 ms (Chrome Violation threshold). */
  violations50ms: number;
  /** Count of durations > 100 ms (severe). */
  violations100ms: number;
  /** Top attributions (up to 5) — only present for longtask.* labels. */
  topAttributions?: Array<{ name: string; count: number }>;
}

const buffers = new Map<string, LabelBuffer>();
const measurementTraces: MeasurementTrace[] = [];

// ============================================================
// Recording primitives
// ============================================================

function getOrCreateBuffer(label: string): LabelBuffer {
  let buf = buffers.get(label);
  if (!buf) {
    buf = {
      durations: [],
      totalCount: 0,
      violations50ms: 0,
      violations100ms: 0,
    };
    buffers.set(label, buf);
  }
  return buf;
}

function record(label: string, duration: number, attribution?: string): void {
  const buf = getOrCreateBuffer(label);
  buf.durations.push(duration);
  if (buf.durations.length > BUFFER_SIZE) {
    buf.durations.shift();
  }
  buf.totalCount += 1;
  if (duration > VIOLATION_THRESHOLDS[0]) buf.violations50ms += 1;
  if (duration > VIOLATION_THRESHOLDS[1]) buf.violations100ms += 1;
  if (attribution) {
    if (!buf.attributions) buf.attributions = new Map();
    buf.attributions.set(
      attribution,
      (buf.attributions.get(attribution) ?? 0) + 1,
    );
  }
}

function pushTrace(label: string, start: number, end: number): void {
  measurementTraces.push({ label, start, end });
  const cutoff = end - TRACE_AGE_WINDOW_MS;
  while (measurementTraces.length > 0 && measurementTraces[0].end < cutoff) {
    measurementTraces.shift();
  }
  while (measurementTraces.length > TRACE_RING_MAX) {
    measurementTraces.shift();
  }
}

// ============================================================
// Public measurement API
// ============================================================

/**
 * Wrap a synchronous function and record its duration under `label`.
 * Also emits `performance.measure()` so durations appear in the DevTools
 * Performance panel flame graph.
 */
export function observe<T>(label: string, fn: () => T): T {
  const beginMark = `composition:${label}:begin`;
  const endMark = `composition:${label}:end`;
  const start = performance.now();
  try {
    performance.mark(beginMark);
    return fn();
  } finally {
    const end = performance.now();
    const duration = end - start;
    performance.mark(endMark);
    try {
      performance.measure(`composition:${label}`, beginMark, endMark);
    } catch {
      // User Timing API quota exceeded — safe to ignore
    }
    record(label, duration);
    pushTrace(label, start, end);
  }
}

export async function observeAsync<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const end = performance.now();
    record(label, end - start);
    pushTrace(label, start, end);
  }
}

/**
 * Manual markers for regions that cannot be expressed as a single function
 * (e.g., rAF body spread across conditional branches).
 */
export function markBegin(): number {
  return performance.now();
}

export function markEnd(label: string, beginTimestamp: number): number {
  const end = performance.now();
  const duration = end - beginTimestamp;
  record(label, duration);
  pushTrace(label, beginTimestamp, end);
  return duration;
}

// ============================================================
// Snapshot API
// ============================================================

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

export function getSnapshot(label: string): PerfSnapshot | null {
  const buf = buffers.get(label);
  if (!buf || buf.durations.length === 0) return null;
  const sorted = [...buf.durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const snapshot: PerfSnapshot = {
    label,
    count: sorted.length,
    totalCount: buf.totalCount,
    mean: Number((sum / sorted.length).toFixed(2)),
    p50: Number(percentile(sorted, 0.5).toFixed(2)),
    p95: Number(percentile(sorted, 0.95).toFixed(2)),
    p99: Number(percentile(sorted, 0.99).toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    violations50ms: buf.violations50ms,
    violations100ms: buf.violations100ms,
  };
  if (buf.attributions && buf.attributions.size > 0) {
    snapshot.topAttributions = [...buf.attributions.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }
  return snapshot;
}

export function getAllSnapshots(): PerfSnapshot[] {
  return [...buffers.keys()]
    .map((label) => getSnapshot(label))
    .filter((s): s is PerfSnapshot => s !== null);
}

export function getAllLongTaskSnapshots(): PerfSnapshot[] {
  return LONGTASK_LABELS.map((label) => getSnapshot(label)).filter(
    (s): s is PerfSnapshot => s !== null,
  );
}

/**
 * 최근 measurement trace ring (최대 256개 / ~5초 창) 읽기 전용 노출.
 * ADR-153 Phase 1-d — speedscope export 의 직렬화 입력.
 */
export function getMeasurementTraces(): readonly MeasurementTrace[] {
  return measurementTraces;
}

export function resetPerfMarks(label?: string): void {
  if (label) {
    buffers.delete(label);
  } else {
    buffers.clear();
  }
}

export function resetLongTasks(label?: LongTaskLabel): void {
  if (label) {
    buffers.delete(label);
  } else {
    for (const l of LONGTASK_LABELS) buffers.delete(l);
  }
}

// ============================================================
// Long Task Observer
// ============================================================

interface LongTaskAttribution {
  containerType?: string;
  containerSrc?: string;
  containerId?: string;
  containerName?: string;
  name?: string;
}

function classifyLongTask(startTime: number, duration: number): LongTaskLabel {
  const end = startTime + duration;
  let bestLabel: string | null = null;
  let bestOverlap = 0;
  for (const trace of measurementTraces) {
    const overlap = Math.min(trace.end, end) - Math.max(trace.start, startTime);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestLabel = trace.label;
    }
  }
  if (bestLabel) {
    for (const { prefix, label } of LONGTASK_CATEGORIES) {
      if (bestLabel.startsWith(prefix)) return label;
    }
  }
  return "longtask.unclassified";
}

function recordLongTask(entry: PerformanceEntry): void {
  const label = classifyLongTask(entry.startTime, entry.duration);
  // Per spec, attribution is usually empty for SPA main-document tasks.
  const attrs = (entry as unknown as { attribution?: LongTaskAttribution[] })
    .attribution;
  let attrKey: string | undefined;
  if (attrs && attrs.length > 0) {
    const first = attrs[0];
    attrKey =
      first.containerSrc ||
      first.containerName ||
      first.containerId ||
      first.containerType ||
      first.name ||
      "self";
  }
  record(label, entry.duration, attrKey);
}

let longTaskObserverStarted = false;

function initLongTaskObserver(): void {
  // Guard against duplicate registration — protects observability integrity
  // if a future HMR boundary causes this module to re-evaluate.
  if (longTaskObserverStarted) return;
  if (typeof window === "undefined") return;
  if (typeof PerformanceObserver === "undefined") return;
  try {
    // Feature-detect 'longtask' without throwing in unsupported browsers (Safari).
    const supported = (
      PerformanceObserver as unknown as {
        supportedEntryTypes?: readonly string[];
      }
    ).supportedEntryTypes;
    if (supported && !supported.includes("longtask")) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        recordLongTask(entry);
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
    longTaskObserverStarted = true;
  } catch {
    // Unsupported entryType — silently skip.
  }
}

// ============================================================
// Global exposure (DevTools console inspection)
// ============================================================

if (typeof window !== "undefined") {
  const w = window as unknown as {
    __composition_PERF__?: {
      snapshot: typeof getSnapshot;
      snapshotAll: typeof getAllSnapshots;
      reset: typeof resetPerfMarks;
      observe: typeof observe;
      snapshotLongTask: typeof getSnapshot;
      snapshotLongTasks: typeof getAllLongTaskSnapshots;
      resetLongTasks: typeof resetLongTasks;
    };
  };
  w.__composition_PERF__ = {
    snapshot: getSnapshot,
    snapshotAll: getAllSnapshots,
    reset: resetPerfMarks,
    observe,
    snapshotLongTask: getSnapshot,
    snapshotLongTasks: getAllLongTaskSnapshots,
    resetLongTasks,
  };
  initLongTaskObserver();
}
