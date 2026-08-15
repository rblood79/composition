/**
 * 개발용 실시간 성능 프로파일러.
 *
 * 브라우저 콘솔에서 실행:
 *   window.__composition_PROFILER.start()   — 5초간 메트릭 수집
 *   window.__composition_PROFILER.report()  — 현재 메트릭 스냅샷
 *   window.__composition_PROFILER.stress(n) — n개 요소 생성 후 프로파일링
 */

import { useCanvasMetricsStore } from "../stores";
import { percentile } from "../utils/gpuProfilerCore";

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
  memory: { jsHeapMB: number };
}

function takeSnapshot(): ProfileSnapshot {
  const m = useCanvasMetricsStore.getState().gpuMetrics;
  const mem = (
    performance as unknown as { memory?: { usedJSHeapSize: number } }
  ).memory;

  return {
    timestamp: new Date().toISOString(),
    elementCount: m.elementCount,
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
    memory: {
      jsHeapMB: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : -1,
    },
  };
}

function collectFrameTimes(durationMs: number): Promise<{
  frameTimes: number[];
  snapshots: ProfileSnapshot[];
}> {
  return new Promise((resolve) => {
    const frameTimes: number[] = [];
    const snapshots: ProfileSnapshot[] = [];
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
        resolve({ frameTimes, snapshots });
      }
    }

    requestAnimationFrame(tick);
  });
}

async function start(durationSec = 5): Promise<void> {
  console.log(
    `%c[composition Profiler] ${durationSec}초간 메트릭 수집 시작...`,
    "color: #3b82f6; font-weight: bold",
  );

  const { frameTimes, snapshots } = await collectFrameTimes(durationSec * 1000);

  const p50 = percentile(frameTimes, 50);
  const p95 = percentile(frameTimes, 95);
  const p99 = percentile(frameTimes, 99);
  const last = snapshots[snapshots.length - 1];

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
}

function report(): ProfileSnapshot {
  const s = takeSnapshot();
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
    `%c[Hot Path] Total frame: ${Math.round(total * 100) / 100}ms | Elements: ${m.elementCount}`,
    "color: #f59e0b; font-weight: bold",
  );
  console.table(breakdown);
}

// window에 노출
const profiler = { start, report, hotpath, takeSnapshot };

declare global {
  interface Window {
    __composition_PROFILER: typeof profiler;
  }
}

if (import.meta.env.DEV) {
  window.__composition_PROFILER = profiler;
}

export { profiler };
