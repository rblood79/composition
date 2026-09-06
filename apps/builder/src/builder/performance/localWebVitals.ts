import { onCLS, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

export interface LocalVitals {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  ttfb: number | null;
}
let vitals: LocalVitals = { lcp: null, inp: null, cls: null, ttfb: null };
const listeners = new Set<() => void>();
let started = false;
const frames: {
  startTime: number;
  duration: number;
  blockingDuration: number;
  forcedStyleAndLayoutDuration: number;
  scriptDuration: number;
}[] = [];
let totalFrames = 0;
const interactions: {
  startTime: number;
  duration: number;
  name: string;
  inputDelay: number;
  processingDuration: number;
  presentationDelay: number;
}[] = [];

export function readLocalVitals(): LocalVitals {
  return vitals;
}
export function subscribeLocalVitals(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 페이지당 한 번 등록. Monitor 개폐가 observer를 중복 생성하지 않는다. 네트워크 전송 없음. */
export function startLocalWebVitals(): void {
  if (started || typeof PerformanceObserver === "undefined") return;
  started = true;
  const update = (metric: Metric) => {
    vitals = { ...vitals, [metric.name.toLowerCase()]: metric.value };
    if (metric.name === "INP") {
      const entry = metric.entries[0] as PerformanceEventTiming | undefined;
      if (entry) {
        interactions.push({
          startTime: entry.startTime,
          duration: metric.value,
          name: entry.name,
          inputDelay: Math.max(0, entry.processingStart - entry.startTime),
          processingDuration: Math.max(
            0,
            entry.processingEnd - entry.processingStart,
          ),
          presentationDelay: Math.max(
            0,
            entry.startTime + entry.duration - entry.processingEnd,
          ),
        });
        if (interactions.length > 50) interactions.shift();
      }
    }
    for (const listener of listeners) listener();
  };
  onINP(update, { reportAllChanges: true });
  onLCP(update, { reportAllChanges: true });
  onCLS(update, { reportAllChanges: true });
  onTTFB(update);
  if (
    PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")
  ) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceLongAnimationFrameTiming[]) {
        totalFrames++;
        frames.push({
          startTime: entry.startTime,
          duration: entry.duration,
          blockingDuration: entry.blockingDuration,
          forcedStyleAndLayoutDuration: entry.scripts.reduce(
            (sum, script) => sum + script.forcedStyleAndLayoutDuration,
            0,
          ),
          scriptDuration: entry.scripts.reduce(
            (sum, script) => sum + script.duration,
            0,
          ),
        });
        if (frames.length > 100) frames.shift();
      }
    });
    observer.observe({ type: "long-animation-frame", buffered: true });
  }
}

export function readLocalPerformanceReport() {
  return {
    schemaVersion: 1,
    collectedAt: new Date().toISOString(),
    scope: "local-page-session",
    supported: {
      inp:
        typeof PerformanceEventTiming !== "undefined" &&
        "interactionId" in PerformanceEventTiming.prototype,
      loaf:
        typeof PerformanceObserver !== "undefined" &&
        PerformanceObserver.supportedEntryTypes.includes(
          "long-animation-frame",
        ),
    },
    environment: {
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
    },
    vitals: { ...vitals },
    inpChanges: interactions.map((entry) => ({ ...entry })),
    longAnimationFrames: {
      totalCount: totalFrames,
      recent: frames.map((entry) => ({ ...entry })),
    },
  };
}

export function downloadLocalPerformanceReport(): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(readLocalPerformanceReport(), null, 2)], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "builder-performance.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
