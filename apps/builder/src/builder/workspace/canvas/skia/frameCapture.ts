import { isFrameCaptureRequested } from "../wasm-bindings/featureFlags";

interface CaptureSource {
  snapshot(): unknown;
  reset(): void;
}

/** production 기본 off. navigation 전 opt-in만 허용해 측정 중 정책 변경을 피한다. */
export const frameCaptureEnabled = isFrameCaptureRequested();
const counters: Record<string, number> = {};
const sources = new Map<number, CaptureSource>();
let nextSourceId = 0;
let lastInput: number | null = null;
let inputCount = 0;
let droppedLatencySamples = 0;
const latencies: number[] = [];

export function countFrameEvent(name: string, amount = 1): void {
  if (frameCaptureEnabled) counters[name] = (counters[name] ?? 0) + amount;
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
        counters: { ...counters },
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
}
