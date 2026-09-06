import { isFrameCaptureRequested } from "../wasm-bindings/featureFlags";
import type { FrameType } from "./types";

/** 렌더 프레임 분류별 counter 키 — hot path에서 템플릿 문자열 할당을 피한다. */
export const FRAME_EVENT_NAME: Record<FrameType, string> = {
  idle: "frame.idle",
  present: "frame.present",
  "camera-only": "frame.camera-only",
  content: "frame.content",
  full: "frame.full",
};

/**
 * 하니스가 첫 발생 전에도 0 을 읽어야 하는 counter 전부. countFrameEvent 키를
 * 새로 추가하면 여기에도 넣는다 — 빠지면 snapshot 이 0 대신 undefined 를 준다.
 */
const KNOWN_COUNTERS: readonly string[] = [
  "renderRaf",
  "mainSubmission",
  "contentBuild",
  "planBuild",
  "domainPublication",
  "preparationSkipped",
  "childrenCacheHit",
  "childrenCacheBuild",
  ...Object.values(FRAME_EVENT_NAME),
];

interface CaptureSource {
  snapshot(): unknown;
  reset(): void;
}

/** production 기본 off. navigation 전 opt-in만 허용해 측정 중 정책 변경을 피한다. */
export const frameCaptureEnabled = isFrameCaptureRequested();
const counters: Record<string, number> = {};
const gauges: Record<string, number> = {};
const sources = new Map<number, CaptureSource>();
let nextSourceId = 0;
let lastInput: number | null = null;
let inputCount = 0;
let droppedLatencySamples = 0;
const latencies: number[] = [];
let readinessPresentation: {
  projectId: string;
  documentRevision: number;
  atMs: number;
} | null = null;

export function recordReadinessPresentation(
  projectId: string,
  documentRevision: number,
): void {
  if (frameCaptureEnabled)
    readinessPresentation = {
      projectId,
      documentRevision,
      atMs: performance.now(),
    };
}

export function countFrameEvent(name: string, amount = 1): void {
  if (frameCaptureEnabled) counters[name] = (counters[name] ?? 0) + amount;
}

export function setFrameGauge(name: string, value: number): void {
  if (frameCaptureEnabled) gauges[name] = value;
}

export function recordMainSubmission(): void {
  if (!frameCaptureEnabled) return;
  countFrameEvent("mainSubmission");
  if (lastInput !== null) {
    if (latencies.length < 10000) latencies.push(performance.now() - lastInput);
    else droppedLatencySamples++;
    lastInput = null;
  }
}

export function registerFrameCaptureSource(source: CaptureSource): () => void {
  if (!frameCaptureEnabled) return () => {};
  const id = nextSourceId++;
  sources.set(id, source);
  return () => {
    sources.delete(id);
  };
}

if (frameCaptureEnabled) {
  const recordInput = () => {
    lastInput = performance.now();
    inputCount++;
  };
  for (const event of [
    "pointerdown",
    "pointermove",
    "wheel",
    "keydown",
    "input",
  ]) {
    document.addEventListener(event, recordInput, {
      capture: true,
      passive: true,
    });
  }
  const api = {
    reset() {
      for (const key of Object.keys(counters)) delete counters[key];
      latencies.length = 0;
      lastInput = null;
      inputCount = 0;
      droppedLatencySamples = 0;
      for (const source of sources.values()) source.reset();
    },
    snapshot() {
      return {
        build: { mode: import.meta.env.MODE, production: import.meta.env.PROD },
        readinessPresentation,
        counters: {
          ...Object.fromEntries(KNOWN_COUNTERS.map((name) => [name, 0])),
          ...counters,
        },
        gauges: { ...gauges },
        rendererSources: [...sources.values()].map((source) =>
          source.snapshot(),
        ),
        inputToSubmission: {
          semantics:
            "latest DOM input to next successful main flush; coalesced inputs; not scanout",
          inputCount,
          pendingInput: lastInput !== null,
          droppedLatencySamples,
          samplesMs: [...latencies],
        },
      };
    },
  };
  (
    window as unknown as { __composition_FRAME_CAPTURE__: typeof api }
  ).__composition_FRAME_CAPTURE__ = api;
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      for (const event of [
        "pointerdown",
        "pointermove",
        "wheel",
        "keydown",
        "input",
      ]) {
        document.removeEventListener(event, recordInput, true);
      }
      sources.clear();
    });
}
