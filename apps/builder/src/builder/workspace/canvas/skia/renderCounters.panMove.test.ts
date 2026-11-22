import { beforeEach, describe, expect, it } from "vitest";
import {
  countPanMove,
  renderCounters,
  resetRenderCounters,
} from "./renderCounters";

/**
 * 2026-11-22 — 팬 이동 거리 분포 (ADR-273 Phase 0 · 여백 크기 판단용) 에 카메라 순간 이동을 넣지 않는다.
 * many-pages100 page-jump 는 줌 4.0 에서 먼 page 로 한 프레임에 옮겨 `panDeviceMax` 가 하니스의 page
 * 거리 (page 프레임 「내용만큼」 `8ec1eed18` 뒤 460,895 → 1,480,707 device px) 가 됐다. 이전 화면과 겹치는
 * 곳이 없는 이동은 어떤 여백으로도 덮을 수 없어 팬이 아니다 — `cameraJumpFrames` 로 따로 센다.
 */
describe("countPanMove — 팬 분포 · 순간 이동", () => {
  beforeEach(() => resetRenderCounters());

  it("화면 안 이동은 축별 큰 쪽으로 분포에 넣는다", () => {
    countPanMove(10, 3, 1440, 900);
    countPanMove(-40, 100, 1440, 900);
    expect(renderCounters.panFrames).toBe(2);
    expect(renderCounters.panDeviceLe16).toBe(1);
    expect(renderCounters.panDeviceLe128).toBe(1);
    expect(renderCounters.panDeviceMax).toBe(100);
    expect(renderCounters.cameraJumpFrames).toBe(0);
  });

  it("화면 크기 이상 옮기면 팬 분포가 아니라 순간 이동으로 센다", () => {
    countPanMove(0, -1_475_662, 1440, 900);
    countPanMove(1440, 0, 1440, 900);
    expect(renderCounters.cameraJumpFrames).toBe(2);
    expect(renderCounters.panFrames).toBe(0);
    expect(renderCounters.panDeviceGt128).toBe(0);
    expect(renderCounters.panDeviceMax).toBe(0);
  });

  it("화면보다 조금 덜 옮기면 팬이다 (Gt128)", () => {
    countPanMove(0, 899, 1440, 900);
    expect(renderCounters.panDeviceGt128).toBe(1);
    expect(renderCounters.panDeviceMax).toBe(899);
    expect(renderCounters.cameraJumpFrames).toBe(0);
  });

  it("이동 0 은 세지 않는다", () => {
    countPanMove(0, 0, 1440, 900);
    expect(renderCounters.panFrames).toBe(0);
    expect(renderCounters.cameraJumpFrames).toBe(0);
  });
});
