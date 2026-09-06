import { afterEach, describe, expect, it, vi } from "vitest";
const callbacks = vi.hoisted(() => ({
  inp: vi.fn(),
  lcp: vi.fn(),
  cls: vi.fn(),
  ttfb: vi.fn(),
}));
vi.mock("web-vitals", () => ({
  onINP: callbacks.inp,
  onLCP: callbacks.lcp,
  onCLS: callbacks.cls,
  onTTFB: callbacks.ttfb,
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});
describe("로컬 성능 수집", () => {
  it("미지원 브라우저는 값을 만들어내지 않는다", async () => {
    vi.stubGlobal("PerformanceObserver", undefined);
    const module = await import("./localWebVitals");
    module.startLocalWebVitals();
    expect(module.readLocalVitals().inp).toBeNull();
    expect(callbacks.inp).not.toHaveBeenCalled();
  });
  it("페이지당 한 번 등록하며 subscriber 해제 후 UI 통지를 멈춘다", async () => {
    vi.stubGlobal(
      "PerformanceObserver",
      class {
        static supportedEntryTypes = [];
      },
    );
    const module = await import("./localWebVitals");
    module.startLocalWebVitals();
    module.startLocalWebVitals();
    expect(callbacks.inp).toHaveBeenCalledTimes(1);
    const listener = vi.fn();
    const stop = module.subscribeLocalVitals(listener);
    const update = callbacks.inp.mock.calls[0][0];
    update({ name: "INP", value: 240, entries: [] });
    expect(module.readLocalVitals().inp).toBe(240);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    update({ name: "INP", value: 300, entries: [] });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("LoAF는 최대 100개 보존하며 전체 개수와 비용을 내보낸다", async () => {
    let observe: (list: { getEntries: () => unknown[] }) => void;
    vi.stubGlobal(
      "PerformanceObserver",
      class {
        static supportedEntryTypes = ["long-animation-frame"];
        constructor(callback: typeof observe) {
          observe = callback;
        }
        observe() {}
      },
    );
    const module = await import("./localWebVitals");
    module.startLocalWebVitals();
    observe!({
      getEntries: () =>
        Array.from({ length: 120 }, (_, i) => ({
          startTime: i,
          duration: 60,
          blockingDuration: 10,
          scripts: [{ duration: 8, forcedStyleAndLayoutDuration: 2 }],
        })),
    });
    const report = module.readLocalPerformanceReport();
    expect(report.longAnimationFrames.totalCount).toBe(120);
    expect(report.longAnimationFrames.recent).toHaveLength(100);
    expect(report.longAnimationFrames.recent[0]).toEqual({
      startTime: 20,
      duration: 60,
      blockingDuration: 10,
      scriptDuration: 8,
      forcedStyleAndLayoutDuration: 2,
    });
  });
});
