import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ADR-244 — `initAllWasm` 은 원래 오류를 부팅 실패 처리까지 전달한다. 삼키면 호출자는 뒤따르는
 * `getCanvasKit()` 의 "초기화되지 않았다" 만 받아, 옛 배포 판정이 원인을 볼 수 없었다.
 */
afterEach(() => {
  vi.doUnmock("../../skia/initCanvasKit");
  vi.doUnmock("../featureFlags");
  vi.resetModules();
});

describe("initAllWasm", () => {
  it("CanvasKit 로드 실패를 다시 throw 하고 준비 상태로 두지 않는다", async () => {
    const failure = new Error("404 canvaskit-old.wasm");
    vi.doMock("../featureFlags", () => ({
      WASM_FLAGS: { CANVASKIT_RENDERER: true, SPATIAL_INDEX: false },
      isUnifiedFlag: () => false,
    }));
    vi.doMock("../../skia/initCanvasKit", () => ({
      initCanvasKit: () => Promise.reject(failure),
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { initAllWasm, isWasmReady } = await import("../init");
    await expect(initAllWasm()).rejects.toBe(failure);
    expect(isWasmReady()).toBe(false);
  });
});
