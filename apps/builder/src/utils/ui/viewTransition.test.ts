import { afterEach, describe, expect, it, vi } from "vitest";
import { navigateWithTransition, notifyRouteCommitted } from "./viewTransition";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubDocument(start?: (cb: () => Promise<void>) => unknown) {
  vi.stubGlobal("document", start ? { startViewTransition: start } : {});
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
}

describe("navigateWithTransition", () => {
  it("전환 콜백은 라우트 commit 신호가 올 때까지 끝나지 않는다", async () => {
    let callback: Promise<void> | undefined;
    stubDocument((cb) => (callback = cb()));
    const update = vi.fn();
    navigateWithTransition(update);
    expect(update).toHaveBeenCalledOnce();

    let settled = false;
    void callback!.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    notifyRouteCommitted();
    await callback;
    expect(settled).toBe(true);
  });

  it("commit 신호가 오지 않으면 1.5초 뒤 전환을 끝낸다", async () => {
    vi.useFakeTimers();
    let callback: Promise<void> | undefined;
    stubDocument((cb) => (callback = cb()));
    navigateWithTransition(() => {});
    vi.advanceTimersByTime(1500);
    await expect(callback).resolves.toBeUndefined();
  });

  it("View Transition 이 없으면 바로 갱신한다", () => {
    stubDocument();
    const update = vi.fn();
    navigateWithTransition(update);
    expect(update).toHaveBeenCalledOnce();
  });
});
