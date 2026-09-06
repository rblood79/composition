import { afterEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ enabled: false }));
vi.mock("../wasm-bindings/featureFlags", () => ({
  isFrameCaptureRequested: () => flag.enabled,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete (window as unknown as Record<string, unknown>)
    .__composition_FRAME_CAPTURE__;
});

describe("명시적 프레임 capture", () => {
  it("기본 off에서는 source와 전역 API를 등록하지 않는다", async () => {
    flag.enabled = false;
    const capture = await import("./frameCapture");
    const snapshot = vi.fn();
    capture.registerFrameCaptureSource({ snapshot, reset: vi.fn() })();
    capture.countFrameEvent("renderRaf");
    capture.recordMainSubmission();
    expect(snapshot).not.toHaveBeenCalled();
    expect(
      (window as unknown as Record<string, unknown>)
        .__composition_FRAME_CAPTURE__,
    ).toBeUndefined();
  });

  it("입력 없는 제출을 latency 0으로 만들지 않고 source 해제와 reset을 보존한다", async () => {
    flag.enabled = true;
    const capture = await import("./frameCapture");
    const api = (
      window as unknown as {
        __composition_FRAME_CAPTURE__: {
          reset(): void;
          snapshot(): {
            counters: Record<string, number>;
            rendererSources: unknown[];
            readinessPresentation: { projectId: string };
            inputToSubmission: { samplesMs: number[] };
          };
        };
      }
    ).__composition_FRAME_CAPTURE__;
    const reset = vi.fn();
    const unregister = capture.registerFrameCaptureSource({
      snapshot: () => ({ alive: 1 }),
      reset,
    });
    capture.recordMainSubmission();
    capture.recordReadinessPresentation("project-a", 4);
    expect(api.snapshot().counters.mainSubmission).toBe(1);
    expect(api.snapshot().inputToSubmission.samplesMs).toEqual([]);
    expect(api.snapshot().rendererSources).toEqual([{ alive: 1 }]);
    api.reset();
    expect(reset).toHaveBeenCalledOnce();
    expect(api.snapshot().counters.mainSubmission).toBe(0);
    expect(api.snapshot().readinessPresentation.projectId).toBe("project-a");
    unregister();
    expect(api.snapshot().rendererSources).toEqual([]);
  });

  it("fire 한 적 없는 counter 는 0 이 아니라 undefined 이고, declareCounter 만 0 을 연다", async () => {
    flag.enabled = true;
    const capture = await import("./frameCapture");
    const api = (
      window as unknown as {
        __composition_FRAME_CAPTURE__: {
          reset(): void;
          snapshot(): { counters: Record<string, number> };
        };
      }
    ).__composition_FRAME_CAPTURE__;
    // 채널이 끊기면 `counter === 0` 단언이 조용히 통과하면 안 된다.
    expect(api.snapshot().counters.contentBuild).toBeUndefined();
    capture.declareCounter("domainPublication");
    expect(api.snapshot().counters.domainPublication).toBe(0);
    // 한 번이라도 fire 한 채널은 reset 후에도 0 으로 관측된다.
    capture.countFrameEvent("contentBuild");
    api.reset();
    expect(api.snapshot().counters.contentBuild).toBe(0);
  });

  it("gauge 는 reset 이 지운다 — 이전 측정 창의 값이 새 창의 값으로 보고되면 안 된다", async () => {
    flag.enabled = true;
    const capture = await import("./frameCapture");
    const api = (
      window as unknown as {
        __composition_FRAME_CAPTURE__: {
          reset(): void;
          snapshot(): { gauges: Record<string, number> };
        };
      }
    ).__composition_FRAME_CAPTURE__;
    capture.setFrameGauge("renderBoundsCount", 402);
    expect(api.snapshot().gauges.renderBoundsCount).toBe(402);
    api.reset();
    expect(api.snapshot().gauges.renderBoundsCount).toBeUndefined();
  });

  it("폴링용 counter/probe 는 latency 배열을 복사하지 않고 같은 값을 준다", async () => {
    flag.enabled = true;
    const capture = await import("./frameCapture");
    const api = (
      window as unknown as {
        __composition_FRAME_CAPTURE__: {
          counter(name: string): number | undefined;
          probe(): {
            counters: Record<string, number>;
            rendererSources: unknown[];
          };
          snapshot(): { counters: Record<string, number> };
        };
      }
    ).__composition_FRAME_CAPTURE__;
    capture.registerFrameCaptureSource({
      snapshot: () => ({ alive: 1 }),
      reset: vi.fn(),
    });
    capture.recordMainSubmission();
    capture.recordMainSubmission();
    expect(api.counter("mainSubmission")).toBe(2);
    expect(api.counter("planBuild")).toBeUndefined();
    const probe = api.probe();
    expect(probe.counters).toEqual(api.snapshot().counters);
    expect(probe.rendererSources).toEqual([{ alive: 1 }]);
    expect(probe).not.toHaveProperty("inputToSubmission");
  });
});
