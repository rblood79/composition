import { afterEach, describe, expect, it, vi } from "vitest";
import { awaitWarmup, registerWarmup } from "../warmupRegistry";

/**
 * ADR-244 A — 소비자는 자기 URL 의 미리 받기만 기다리고, 기다림은 실패하지 않으며 상한이 있다.
 */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const settled = async (promise: Promise<unknown>) => {
  let done = false;
  void promise.then(() => (done = true));
  await new Promise((r) => setTimeout(r, 0));
  return done;
};

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)
    .__composition_CANVAS_WARMUP__;
  vi.useRealTimers();
});

describe("warmupRegistry", () => {
  it("항목이 없으면 바로 끝난다", async () => {
    expect(await settled(awaitWarmup("/composition/assets/a.wasm"))).toBe(true);
  });

  it("자기 URL 의 받기만 기다린다 — 다른 자산의 받기는 기다리지 않는다", async () => {
    const wasm = deferred();
    const font = deferred();
    registerWarmup("/composition/assets/a.wasm", () => wasm.promise);
    registerWarmup("/composition/fonts/b.ttf", () => font.promise);

    const waiting = awaitWarmup("/composition/assets/a.wasm");
    expect(await settled(waiting)).toBe(false);
    wasm.resolve();
    expect(await settled(waiting)).toBe(true);
    // 폰트 받기는 아직 진행 중이다.
    expect(await settled(awaitWarmup("/composition/fonts/b.ttf"))).toBe(false);
  });

  it("상대 경로와 절대 URL 이 같은 항목이다", async () => {
    const wasm = deferred();
    registerWarmup("/composition/assets/a.wasm", () => wasm.promise);
    const absolute = new URL("/composition/assets/a.wasm", document.baseURI)
      .href;
    expect(await settled(awaitWarmup(absolute))).toBe(false);
  });

  it("같은 자산은 한 번만 받는다", async () => {
    const fetching = vi.fn(() => Promise.resolve());
    const first = registerWarmup("/composition/assets/a.wasm", fetching);
    const second = registerWarmup("/composition/assets/a.wasm", fetching);
    await first;
    expect(second).toBe(first);
    expect(fetching).toHaveBeenCalledTimes(1);
  });

  it("받기가 실패해도 기다림은 실패하지 않는다", async () => {
    const wasm = deferred();
    registerWarmup("/composition/assets/a.wasm", () => wasm.promise);
    const waiting = awaitWarmup("/composition/assets/a.wasm");
    wasm.reject(new Error("404"));
    await expect(waiting).resolves.toBeUndefined();
  });

  it("상한을 넘으면 기다리지 않고 진행한다", async () => {
    vi.useFakeTimers();
    registerWarmup("/composition/assets/a.wasm", () => new Promise(() => {}));
    const waiting = awaitWarmup("/composition/assets/a.wasm", 10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(waiting).resolves.toBeUndefined();
  });
});
