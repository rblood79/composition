// @vitest-environment node
/**
 * ADR-150 A3' — 데이터 행 더블클릭 뒤 카메라 추종의 pan 목표 (화면 밖일 때만 · 배율 유지).
 */
import { describe, expect, it } from "vitest";
import { computeRevealPanTarget } from "./panToPage";

const CONTAINER = { width: 1000, height: 800 };

describe("computeRevealPanTarget", () => {
  it("rect 가 화면 안 (여백 포함) 에 다 보이면 null — 움직이지 않는다", () => {
    expect(
      computeRevealPanTarget(
        { x: 100, y: 100, width: 200, height: 100 },
        { scale: 1, x: 0, y: 0 },
        CONTAINER,
      ),
    ).toBeNull();
  });

  it("다른 페이지 (화면 밖) rect → 현재 배율 그대로 rect 중심을 화면 중심에", () => {
    const viewport = { scale: 0.5, x: 0, y: 0 };
    const rect = { x: 3000, y: 200, width: 100, height: 40 };
    const target = computeRevealPanTarget(rect, viewport, CONTAINER);
    expect(target).toEqual({ x: 500 - 3050 * 0.5, y: 400 - 220 * 0.5 });
    // 이동 뒤 rect 중심의 화면 좌표 = 화면 중심.
    expect((rect.x + rect.width / 2) * viewport.scale + target!.x).toBe(500);
    expect((rect.y + rect.height / 2) * viewport.scale + target!.y).toBe(400);
  });

  it("가장자리에 걸친 rect (여백 안쪽) 도 드러낸다", () => {
    expect(
      computeRevealPanTarget(
        { x: 980, y: 100, width: 100, height: 40 },
        { scale: 1, x: 0, y: 0 },
        CONTAINER,
      ),
    ).not.toBeNull();
  });

  it("컨테이너 크기 0 (마운트 전) → null", () => {
    expect(
      computeRevealPanTarget(
        { x: 5000, y: 0, width: 10, height: 10 },
        { scale: 1, x: 0, y: 0 },
        { width: 0, height: 0 },
      ),
    ).toBeNull();
  });
});
