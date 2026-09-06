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
    // 스펙: GPU_DISJOINT_EXT 는 조회하면 FALSE 로 리셋된다.
    getParameter: vi.fn(() => {
      const observed = disjoint;
      disjoint = false;
      return observed;
    }),
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
      // disjoint 판정은 결과가 준비된 뒤에 이뤄진다 (플래그를 미리 소모하지 않음).
      if (invalidate === "disjoint") f.ready();
      expect(f.timer.poll()).toBeNull();
      expect(f.timer.snapshot()).toMatchObject({
        invalid: 1,
        valid: 0,
        pending: 0,
      });
    }
  });

  it("결과 대기 중 poll 은 disjoint 플래그를 소모하지 않는다", () => {
    const f = fixture();
    f.timer.frameBegin();
    f.timer.frameEnd();
    f.disjoint();
    // 결과 전 poll 을 여러 번 — 여기서 플래그를 읽어버리면 아래 판정이 죽는다.
    expect(f.timer.poll()).toBeNull();
    expect(f.timer.poll()).toBeNull();
    expect(f.timer.snapshot()).toMatchObject({ invalid: 0, pending: 1 });
    f.ready();
    expect(f.timer.poll()).toBeNull();
    expect(f.timer.snapshot()).toMatchObject({
      invalid: 1,
      valid: 0,
      pending: 0,
    });
  });

  it("measuring 중 reset 을 넘어온 표본은 valid 로도 invalid 로도 세지 않는다", () => {
    const f = fixture();
    f.timer.frameBegin();
    // endQuery 전 reset — query 를 지울 수 없어 살아남는다.
    f.timer.resetSamples();
    expect(f.timer.snapshot()).toMatchObject({ started: 0, pending: 1 });
    f.timer.frameEnd();
    f.ready();
    expect(f.timer.poll()).toBeNull();
    const after = f.timer.snapshot();
    expect(after).toMatchObject({
      started: 0,
      valid: 0,
      invalid: 0,
      pending: 0,
    });
    expect(after.valid + after.invalid + after.dropped).toBeLessThanOrEqual(
      after.started,
    );
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
