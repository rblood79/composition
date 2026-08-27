/**
 * scheduleFrameOrTimeout — hidden/background 탭 preview 동기화 회귀 가드
 *
 * ADR-151 잔여 ② (preview prop 편집 stale, 2026-07-17 관측):
 * `requestAnimationFrame` 은 background(hidden) 탭에서 동작하지 않는다. preview 로의
 * canonical 재송신이 rAF 로 예약돼 있어, hidden 탭(= Chrome MCP parity 자동화 컨텍스트)
 * 에서 prop 편집이 reload 전까지 preview 에 반영되지 않았다. 라이브 실측:
 * hidden 탭에서 rAF 미동작 / setTimeout·microtask 즉시 동작.
 *
 * 계약: document.hidden 이면 setTimeout 으로 예약(hidden 탭 동작 보장), visible 이면
 * requestAnimationFrame(프레임 배칭 유지 — focused 탭 hot path 무변경). 반환값은
 * 스케줄러 종류와 무관하게 취소하는 함수.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleFrameOrTimeout } from "./scheduleTask";

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  setHidden(false);
});

describe("scheduleFrameOrTimeout — visibility-resilient scheduler", () => {
  it("visible 이면 requestAnimationFrame 으로 예약한다 (프레임 배칭 유지)", () => {
    setHidden(false);
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockReturnValue(1 as unknown as number);
    const st = vi.spyOn(window, "setTimeout");

    scheduleFrameOrTimeout(vi.fn());

    expect(raf).toHaveBeenCalledTimes(1);
    expect(st).not.toHaveBeenCalled();
  });

  it("hidden 이면 setTimeout 으로 예약한다 (rAF 는 background 탭에서 미동작)", () => {
    setHidden(true);
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const st = vi
      .spyOn(window, "setTimeout")
      .mockReturnValue(7 as unknown as ReturnType<typeof window.setTimeout>);

    scheduleFrameOrTimeout(vi.fn());

    expect(st).toHaveBeenCalledTimes(1);
    expect(raf).not.toHaveBeenCalled();
  });

  it("hidden 탭에서 예약된 콜백이 실제로 실행된다 (핵심 회귀 가드)", async () => {
    setHidden(true);
    const cb = vi.fn();

    scheduleFrameOrTimeout(cb);
    await new Promise((r) => setTimeout(r, 5));

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("반환된 cancel 은 visible 예약(rAF)을 취소한다", () => {
    setHidden(false);
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(
      11 as unknown as number,
    );
    const caf = vi.spyOn(window, "cancelAnimationFrame");

    const cancel = scheduleFrameOrTimeout(vi.fn());
    cancel();

    expect(caf).toHaveBeenCalledWith(11);
  });

  it("반환된 cancel 은 hidden 예약(setTimeout)을 취소한다", () => {
    setHidden(true);
    vi.spyOn(window, "setTimeout").mockReturnValue(
      22 as unknown as ReturnType<typeof window.setTimeout>,
    );
    const ct = vi.spyOn(window, "clearTimeout");

    const cancel = scheduleFrameOrTimeout(vi.fn());
    cancel();

    expect(ct).toHaveBeenCalledWith(22);
  });
});
