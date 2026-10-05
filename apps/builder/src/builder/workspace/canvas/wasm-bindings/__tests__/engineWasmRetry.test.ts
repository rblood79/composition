import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 2026-10-05 감사 LOW — 엔진 WASM 로드가 한 번 실패하면 (네트워크 · 불완전 모듈) 다음
 * initEngineWasm 이 다시 읽는다. 실패한 promise 를 그대로 돌려주면 프로젝트를 다시 열어도
 * 엔진이 영영 준비되지 않았다.
 */
afterEach(() => {
  vi.doUnmock("../engine-pkg/engine.js");
  vi.resetModules();
});

describe("initEngineWasm 재시도", () => {
  it("첫 로드가 실패하면 다음 호출이 다시 로드한다", async () => {
    let calls = 0;
    vi.doMock("../engine-pkg/engine.js", () => {
      calls += 1;
      if (calls === 1) throw new Error("NETWORK");
      return { LayoutEngine: class {} };
    });
    const { initEngineWasm, isEngineReady } = await import("../engineWasm");
    await initEngineWasm();
    expect(isEngineReady()).toBe(false);
    await initEngineWasm();
    expect(isEngineReady()).toBe(true);
  });
});
