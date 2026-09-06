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

/**
 * 아직 한 번도 fire 하지 않은 counter 를 0 으로 노출한다. emit 지점 옆(모듈
 * 스코프)에서 호출한다 — 이름이 producer 를 떠나면 채널이 끊겨도 하니스가
 * 0 을 읽어 단언이 vacuous 해진다.
 */
export function declareCounter(name: string): void {
  if (frameCaptureEnabled) counters[name] ??= 0;
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
      // delete 가 아니라 0 — 한 번이라도 fire 한 채널은 창을 넘어 관측 가능하게.
      for (const key of Object.keys(counters)) counters[key] = 0;
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
        counters: { ...counters },
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
