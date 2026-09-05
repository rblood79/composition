/**
 * perfMarks — User Timing 방출은 토글 뒤 (2026-09-02 기준선 §3-4).
 *
 * observe 가 호출마다 mark/measure/clear 를 부르면 dev 의 React measure 버퍼
 * (렌더마다 쌓이고 안 지워짐) 를 clearMeasures 가 매번 훑어 프레임당 계측 비용이
 * 버퍼 크기에 비례해 자랐다. 기본은 내부 링 버퍼만, DevTools 용 User Timing 은
 * setUserTiming(true) 에서만.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSnapshot,
  observe,
  observeAsync,
  markBegin,
  markEnd,
  resetPerfMarks,
  setRecordingEnabled,
  setUserTiming,
} from "./perfMarks";

describe("perfMarks observe — User Timing 토글", () => {
  afterEach(() => {
    setRecordingEnabled(true);
    setUserTiming(false);
    resetPerfMarks();
    vi.restoreAllMocks();
  });

  it("1,000개 버퍼가 순환해도 전체 호출 수와 누적 시간은 보존한다", () => {
    let time = 0;
    vi.spyOn(performance, "now").mockImplementation(() => time++);
    for (let i = 0; i < 1200; i++) observe("test.total", () => undefined);
    expect(getSnapshot("test.total")).toMatchObject({
      count: 1000,
      totalCount: 1200,
      totalDurationMs: 1200,
    });
    resetPerfMarks();
    expect(getSnapshot("test.total")).toBeNull();
  });

  it("계측 off에서도 반환값과 예외를 보존하고 timing을 호출하지 않는다", async () => {
    setRecordingEnabled(false);
    setUserTiming(true);
    const now = vi.spyOn(performance, "now");
    const mark = vi.spyOn(performance, "mark");
    expect(observe("test.off", () => 42)).toBe(42);
    await expect(observeAsync("test.off", async () => 43)).resolves.toBe(43);
    expect(() =>
      observe("test.off", () => {
        throw new Error("sync");
      }),
    ).toThrow("sync");
    await expect(
      observeAsync("test.off", async () => {
        throw new Error("async");
      }),
    ).rejects.toThrow("async");
    const start = markBegin();
    markEnd("test.off", start);
    expect(now).not.toHaveBeenCalled();
    expect(mark).not.toHaveBeenCalled();
    expect(getSnapshot("test.off")).toBeNull();
    setRecordingEnabled(true);
    markEnd("test.off", start);
    expect(getSnapshot("test.off")).toBeNull();
    observe("test.on", () => 1);
    expect(getSnapshot("test.on")?.totalCount).toBe(1);
  });

  it("기본은 performance.mark/measure/clear 를 부르지 않고 내부 기록만 남긴다", () => {
    const mark = vi.spyOn(performance, "mark");
    const measure = vi.spyOn(performance, "measure");
    const clearMeasures = vi.spyOn(performance, "clearMeasures");
    const result = observe("test.default", () => 42);
    expect(result).toBe(42);
    expect(mark).not.toHaveBeenCalled();
    expect(measure).not.toHaveBeenCalled();
    expect(clearMeasures).not.toHaveBeenCalled();
    expect(getSnapshot("test.default")?.count).toBe(1);
  });

  it("setUserTiming(true) 면 measure 를 남기고 즉시 비운다", () => {
    setUserTiming(true);
    const measure = vi.spyOn(performance, "measure");
    const clearMeasures = vi.spyOn(performance, "clearMeasures");
    observe("test.enabled", () => undefined);
    expect(measure).toHaveBeenCalledWith(
      "composition:test.enabled",
      "composition:test.enabled:begin",
      "composition:test.enabled:end",
    );
    expect(clearMeasures).toHaveBeenCalledWith("composition:test.enabled");
    expect(getSnapshot("test.enabled")?.count).toBe(1);
  });
});
