// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GpuTimer } from "./gpuTimer";

function fixture(supported = true) {
  let available = false;
  let disjoint = false;
  let lost = false;
  const gl = {
    QUERY_RESULT_AVAILABLE: 1,
    QUERY_RESULT: 2,
    getExtension: () =>
      supported ? { TIME_ELAPSED_EXT: 3, GPU_DISJOINT_EXT: 4 } : null,
    isContextLost: () => lost,
    getParameter: () => disjoint,
    getQueryParameter: vi.fn((_q, key) => (key === 1 ? available : 2500000)),
    createQuery: vi.fn(() => ({})),
    beginQuery: vi.fn(),
    endQuery: vi.fn(),
    deleteQuery: vi.fn(),
  };
  const timer = new GpuTimer({
    getContext: () => gl,
  } as unknown as HTMLCanvasElement);
  return {
    timer,
    gl,
    ready: () => {
      available = true;
    },
    disjoint: () => {
      disjoint = true;
    },
    lose: () => {
      lost = true;
    },
  };
}

describe("GPU raw capture", () => {
  it("동기 대기 없이 마지막 query를 수거하고 pending 중 중복 생성하지 않는다", () => {
    const f = fixture();
    f.timer.frameBegin();
    f.timer.frameEnd();
    f.timer.frameBegin();
    expect(f.gl.createQuery).toHaveBeenCalledTimes(1);
    expect(f.timer.poll()).toBeNull();
    expect(f.gl.getQueryParameter).not.toHaveBeenCalledWith(
      expect.anything(),
      2,
    );
    f.ready();
    expect(f.timer.poll()).toBe(2.5);
    expect(f.timer.snapshot()).toMatchObject({
      valid: 1,
      pending: 0,
      samplesMs: [2.5],
    });
  });
  it("미지원과 disjoint 및 context loss를 유효한 0ms 표본으로 만들지 않는다", () => {
    const unsupported = fixture(false);
    unsupported.timer.frameBegin();
    expect(unsupported.timer.snapshot()).toMatchObject({
      supported: false,
      valid: 0,
    });
    expect(unsupported.gl.createQuery).not.toHaveBeenCalled();
    for (const invalidate of ["disjoint", "lose"] as const) {
      const f = fixture();
      f.timer.frameBegin();
      f.timer.frameEnd();
      f[invalidate]();
      expect(f.timer.poll()).toBeNull();
      expect(f.timer.snapshot()).toMatchObject({
        invalid: 1,
        valid: 0,
        pending: 0,
      });
    }
  });
  it("구간 reset은 이전 query를 폐기하고 dispose는 열린 query까지 정리한다", () => {
    const f = fixture();
    f.timer.frameBegin();
    f.timer.frameEnd();
    f.timer.resetSamples();
    expect(f.timer.snapshot()).toMatchObject({ started: 0, pending: 0 });
    f.timer.frameBegin();
    f.timer.dispose();
    expect(f.gl.endQuery).toHaveBeenCalledTimes(2);
    expect(f.gl.deleteQuery).toHaveBeenCalledTimes(2);
    f.timer.frameBegin();
    expect(f.gl.createQuery).toHaveBeenCalledTimes(2);
  });
});
