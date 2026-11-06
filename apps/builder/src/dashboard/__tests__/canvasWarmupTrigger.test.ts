import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADR-244 A — 미리 받기 시점의 조건: 보이는 탭 · saveData 아님 · 스위치 `off` 아님. 한 번만 시작한다.
 */
const start = vi.fn();

beforeEach(() => {
  vi.resetModules();
  start.mockReset();
  vi.doMock("../canvasWarmup", () => ({ startCanvasWarmup: start }));
  localStorage.clear();
});

afterEach(() => {
  vi.doUnmock("../canvasWarmup");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function request() {
  const trigger = await import("../canvasWarmupTrigger");
  trigger.requestCanvasWarmup();
  await vi.dynamicImportSettled();
  return trigger;
}

describe("requestCanvasWarmup", () => {
  it("한 번만 시작하고 wasm · 폰트 목록을 넘긴다", async () => {
    const trigger = await request();
    trigger.requestCanvasWarmup();
    await vi.dynamicImportSettled();
    expect(start).toHaveBeenCalledTimes(1);
    const deps = start.mock.calls[0][0];
    expect(deps.wasmUrls[0]).toMatch(/canvaskit.*\.wasm/);
    expect(deps.fonts.map((f: { family: string }) => f.family)).toEqual([
      "Pretendard",
      "Inter",
    ]);
  });

  it("스위치가 off 면 시작하지 않는다 (같은 빌드의 대조군)", async () => {
    localStorage.setItem("composition:canvas-warmup", "off");
    await request();
    expect(start).not.toHaveBeenCalled();
  });

  it("탭이 보이지 않으면 시작하지 않는다", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await request();
    expect(start).not.toHaveBeenCalled();
  });

  it("saveData 면 시작하지 않는다", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      connection: { saveData: true },
    });
    await request();
    expect(start).not.toHaveBeenCalled();
  });

  it("조건이 맞지 않았던 호출 뒤 다음 계기에는 시작한다", async () => {
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    const trigger = await request();
    visibility.mockReturnValue("visible");
    trigger.requestCanvasWarmup();
    await vi.dynamicImportSettled();
    expect(start).toHaveBeenCalledTimes(1);
  });
});
