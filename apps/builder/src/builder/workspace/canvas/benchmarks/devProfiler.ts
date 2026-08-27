/**
 * 개발용 실시간 성능 프로파일러.
 *
 * 브라우저 콘솔에서 실행:
 *   await window.__composition_PROFILER.start() — 5초간 메트릭 수집
 *   window.__composition_PROFILER.report()      — 마지막 완료 run 스냅샷
 *
 * `?benchmark=path-heavy-117` 로 Builder 를 열면 3초 warm-up 뒤 동일한 5초
 * 수집을 자동 실행하고 결과를 documentElement dataset 에 기록한다. 브라우저
 * 자동화가 page global 을 직접 읽지 못하는 환경에서도 같은 측정 계약을 쓴다.
 */

import { useCanvasMetricsStore } from "../stores";
import { percentile } from "../utils/gpuProfilerCore";
import { getDocumentElementCount } from "../../../utils/performanceMonitor";

interface ProfileSnapshot {
  timestamp: string;
  elementCount: number;
  fps: { avg: number };
  frameTime: { avg: number; p95: number; p99: number };
  contentRender: { avgMs: number };
  blit: { avgMs: number };
  treeBuild: { avgMs: number };
  selectionBuild: { avgMs: number };
  idleFrameRatio: number;
  contentRendersPerSec: number;
  registryChangesPerSec: number;
  longTasks: { count: number; maxMs: number; totalMs: number };
  memory: { jsHeapMB: number };
}

const AUTO_PROFILE_SCENARIO = "path-heavy-117";
const AUTO_PROFILE_DURATION_SEC = 5;
const AUTO_PROFILE_WARMUP_MS = 3000;

let lastCompletedProfile: ProfileSnapshot | null = null;

function takeSnapshot(): ProfileSnapshot {
  const m = useCanvasMetricsStore.getState().gpuMetrics;
  const mem = (
    performance as unknown as { memory?: { usedJSHeapSize: number } }
  ).memory;

  return {
    timestamp: new Date().toISOString(),
    // 구 `gpuMetrics.elementCount` 는 writer 호출부가 ADR-900 이후 0건이라
    //   **상시 0** 이었다 — 프로파일러가 "요소 수: 0" 을 출력하고 있었다.
    //   canonical 실측 출처로 배선 (스냅샷은 1초 주기라 O(n) 순회 허용).
    elementCount: getDocumentElementCount(),
    fps: { avg: Math.round(m.averageFps) },
    frameTime: {
      avg: Math.round(m.skiaFrameTimeAvgMs * 100) / 100,
      p95: 0,
      p99: 0,
    },
    contentRender: { avgMs: Math.round(m.contentRenderTimeMs * 100) / 100 },
    blit: { avgMs: Math.round(m.blitTimeMs * 100) / 100 },
    treeBuild: { avgMs: Math.round(m.skiaTreeBuildTimeMs * 100) / 100 },
    selectionBuild: {
      avgMs: Math.round(m.selectionBuildTimeMs * 100) / 100,
    },
    idleFrameRatio: Math.round(m.idleFrameRatio * 100) / 100,
    contentRendersPerSec: Math.round(m.contentRendersPerSec * 10) / 10,
    registryChangesPerSec: Math.round(m.registryChangesPerSec * 10) / 10,
    longTasks: { count: 0, maxMs: 0, totalMs: 0 },
    memory: {
      jsHeapMB: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : -1,
    },
  };
}

function collectFrameTimes(durationMs: number): Promise<{
  frameTimes: number[];
  longTaskDurations: number[];
  snapshots: ProfileSnapshot[];
}> {
  return new Promise((resolve) => {
    const frameTimes: number[] = [];
    const longTaskDurations: number[] = [];
    const snapshots: ProfileSnapshot[] = [];
    const longTaskObserver =
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes.includes("longtask")
        ? new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              longTaskDurations.push(entry.duration);
            }
          })
        : null;
    longTaskObserver?.observe({ type: "longtask" });
    let lastTime = performance.now();
    let elapsed = 0;
    const interval = 1000; // 1초마다 스냅샷
    let nextSnapshot = interval;

    function tick() {
      const now = performance.now();
      const dt = now - lastTime;
      frameTimes.push(dt);
      lastTime = now;
      elapsed += dt;

      if (elapsed >= nextSnapshot) {
        snapshots.push(takeSnapshot());
        nextSnapshot += interval;
      }

      if (elapsed < durationMs) {
        requestAnimationFrame(tick);
      } else {
        snapshots.push(takeSnapshot());
        if (longTaskObserver) {
          for (const entry of longTaskObserver.takeRecords()) {
            longTaskDurations.push(entry.duration);
          }
          longTaskObserver.disconnect();
        }
        resolve({ frameTimes, longTaskDurations, snapshots });
      }
    }

    requestAnimationFrame(tick);
  });
}

async function start(durationSec = 5): Promise<ProfileSnapshot> {
  console.log(
    `%c[composition Profiler] ${durationSec}초간 메트릭 수집 시작...`,
    "color: #3b82f6; font-weight: bold",
  );

  const { frameTimes, longTaskDurations, snapshots } = await collectFrameTimes(
    durationSec * 1000,
  );

  const p50 = percentile(frameTimes, 50);
  const p95 = percentile(frameTimes, 95);
  const p99 = percentile(frameTimes, 99);
  const last = snapshots[snapshots.length - 1];
  const completed: ProfileSnapshot = {
    ...last,
    frameTime: {
      ...last.frameTime,
      p95: Math.round(p95 * 100) / 100,
      p99: Math.round(p99 * 100) / 100,
    },
    longTasks: {
      count: longTaskDurations.length,
      maxMs: Math.round(Math.max(0, ...longTaskDurations) * 100) / 100,
      totalMs:
        Math.round(
          longTaskDurations.reduce((total, duration) => total + duration, 0) *
            100,
        ) / 100,
    },
  };
  lastCompletedProfile = completed;

  console.log(
    `%c[composition Profiler] 수집 완료`,
    "color: #22c55e; font-weight: bold",
  );
  console.table({
    "요소 수": last.elementCount,
    "FPS (avg)": last.fps.avg,
    "Frame Time p50": `${Math.round(p50 * 100) / 100}ms`,
    "Frame Time p95": `${Math.round(p95 * 100) / 100}ms`,
    "Frame Time p99": `${Math.round(p99 * 100) / 100}ms`,
    "Content Render": `${last.contentRender.avgMs}ms`,
    "Blit Time": `${last.blit.avgMs}ms`,
    "Tree Build": `${last.treeBuild.avgMs}ms`,
    "Idle Frame %": `${Math.round(last.idleFrameRatio * 100)}%`,
    "Content Renders/s": last.contentRendersPerSec,
    "Registry Changes/s": last.registryChangesPerSec,
    "Long Tasks": completed.longTasks.count,
    "Long Task Total": `${completed.longTasks.totalMs}ms`,
    "Long Task Max": `${completed.longTasks.maxMs}ms`,
    "JS Heap": `${last.memory.jsHeapMB}MB`,
  });

  // 60Hz 호환성 최소선 판정. 목표 상한은 native refresh cadence에서 별도로 확인한다.
  const compatibilityFloorMs = 1000 / 60;
  const verdict =
    p95 <= compatibilityFloorMs
      ? "✅ 60Hz 호환성 최소선 충족 (p95 frame time)"
      : p50 <= compatibilityFloorMs
        ? "⚠️ 60Hz 최소선은 p50만 충족, p95 초과"
        : "❌ 60Hz 호환성 최소선 미달";
  console.log(
    `%c판정: ${verdict}`,
    p95 <= compatibilityFloorMs ? "color: #22c55e" : "color: #ef4444",
  );

  return completed;
}

function report(): ProfileSnapshot {
  const s = lastCompletedProfile ?? takeSnapshot();
  console.table(s);
  return s;
}

/**
 * Hot path 분석: 각 단계별 시간 비율 출력
 */
function hotpath(): void {
  const m = useCanvasMetricsStore.getState().gpuMetrics;
  const total = m.skiaFrameTimeAvgMs || 1;

  const breakdown = [
    {
      stage: "Tree Build",
      ms: m.skiaTreeBuildTimeMs,
      pct: (m.skiaTreeBuildTimeMs / total) * 100,
    },
    {
      stage: "Content Render",
      ms: m.contentRenderTimeMs,
      pct: (m.contentRenderTimeMs / total) * 100,
    },
    { stage: "Blit", ms: m.blitTimeMs, pct: (m.blitTimeMs / total) * 100 },
    {
      stage: "Selection Build",
      ms: m.selectionBuildTimeMs,
      pct: (m.selectionBuildTimeMs / total) * 100,
    },
    {
      stage: "AI Bounds Build",
      ms: m.aiBoundsBuildTimeMs,
      pct: (m.aiBoundsBuildTimeMs / total) * 100,
    },
    {
      stage: "Bounds Lookup",
      ms: m.boundsLookupAvgMs,
      pct: (m.boundsLookupAvgMs / total) * 100,
    },
    {
      stage: "Culling Filter",
      ms: m.cullingFilterAvgMs,
      pct: (m.cullingFilterAvgMs / total) * 100,
    },
  ].map((r) => ({
    ...r,
    ms: Math.round(r.ms * 100) / 100,
    pct: `${Math.round(r.pct)}%`,
    bar: "█".repeat(Math.round((r.ms / total) * 40)),
  }));

  console.log(
    `%c[Hot Path] Total frame: ${Math.round(total * 100) / 100}ms | Elements: ${getDocumentElementCount()}`,
    "color: #f59e0b; font-weight: bold",
  );
  console.table(breakdown);
}

// window에 노출
const profiler = { start, report, hotpath, takeSnapshot };

function scheduleAutoProfile(): void {
  const scenario = new URLSearchParams(window.location.search).get("benchmark");
  if (scenario !== AUTO_PROFILE_SCENARIO) return;

  const root = document.documentElement;
  if (root.dataset.compositionProfilerStatus) return;

  root.dataset.compositionProfilerScenario = scenario;
  root.dataset.compositionProfilerStatus = "warming-up";

  window.setTimeout(() => {
    root.dataset.compositionProfilerStatus = "running";
    void start(AUTO_PROFILE_DURATION_SEC)
      .then((result) => {
        root.dataset.compositionProfilerReport = JSON.stringify(result);
        root.dataset.compositionProfilerStatus = "complete";
      })
      .catch((error: unknown) => {
        root.dataset.compositionProfilerStatus = "error";
        root.dataset.compositionProfilerError =
          error instanceof Error ? error.message : String(error);
      });
  }, AUTO_PROFILE_WARMUP_MS);
}

declare global {
  interface Window {
    __composition_PROFILER: typeof profiler;
  }
}

if (import.meta.env.DEV) {
  window.__composition_PROFILER = profiler;
  if (document.readyState === "complete") {
    scheduleAutoProfile();
  } else {
    window.addEventListener("load", scheduleAutoProfile, { once: true });
  }
}

export { profiler };
