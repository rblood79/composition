import { describe, expect, it } from "vitest";
import { resolveResizeAxes, resolveResizeRequest } from "./resizeGeometry";

const start = { x: 100, y: 50, width: 400, height: 240 };

describe("ADR-224 캔버스 resize 기하 — 핸들이 닿는 축만, Ratio 는 driver 하나만", () => {
  it("maps handles to axes", () => {
    expect(resolveResizeAxes("middle-right")).toEqual({
      width: true,
      height: false,
    });
    expect(resolveResizeAxes("top-center")).toEqual({
      width: false,
      height: true,
    });
    expect(resolveResizeAxes("bottom-left")).toEqual({
      width: true,
      height: true,
    });
  });

  it("edge drag requests one axis; left/top edges grow against the pointer", () => {
    expect(
      resolveResizeRequest({
        handle: "middle-right",
        startBounds: start,
        dx: -100.4,
        dy: 30,
        lock: null,
      }),
    ).toEqual({ width: 300 });
    expect(
      resolveResizeRequest({
        handle: "middle-left",
        startBounds: start,
        dx: -50,
        dy: 0,
        lock: null,
      }),
    ).toEqual({ width: 450 });
    expect(
      resolveResizeRequest({
        handle: "top-center",
        startBounds: start,
        dx: 999,
        dy: 40,
        lock: null,
      }),
    ).toEqual({ height: 200 });
  });

  it("corner drag requests both axes and clamps to the minimum", () => {
    expect(
      resolveResizeRequest({
        handle: "bottom-right",
        startBounds: start,
        dx: 20,
        dy: -500,
        lock: null,
      }),
    ).toEqual({ width: 420, height: 1 });
  });

  it("ratio lock: driver edge → driver px; dependent edge → converted through the ratio", () => {
    const lock = { driver: "width" as const, ratio: 2 };
    expect(
      resolveResizeRequest({
        handle: "middle-right",
        startBounds: start,
        dx: 100,
        dy: 0,
        lock,
      }),
    ).toEqual({ width: 500 });
    // 세로 resize → 목표 H 300 × 2 → Width 600 (Height 는 auto 유지)
    expect(
      resolveResizeRequest({
        handle: "bottom-center",
        startBounds: start,
        dx: 0,
        dy: 60,
        lock,
      }),
    ).toEqual({ width: 600 });
    // 코너도 driver 하나만
    expect(
      resolveResizeRequest({
        handle: "bottom-right",
        startBounds: start,
        dx: 100,
        dy: 60,
        lock,
      }),
    ).toEqual({ width: 500 });
  });

  it("ratio lock with a height driver is symmetric", () => {
    const lock = { driver: "height" as const, ratio: 2 };
    expect(
      resolveResizeRequest({
        handle: "middle-right",
        startBounds: start,
        dx: 200,
        dy: 0,
        lock,
      }),
    ).toEqual({ height: 300 });
    expect(
      resolveResizeRequest({
        handle: "top-center",
        startBounds: start,
        dx: 0,
        dy: -10,
        lock,
      }),
    ).toEqual({ height: 250 });
  });
});
