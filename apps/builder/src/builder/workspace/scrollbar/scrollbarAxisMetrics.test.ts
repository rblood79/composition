import { describe, expect, it } from "vitest";
import {
  getScrollbarAxisMetrics,
  type ScrollbarViewportMetrics,
} from "./viewportMetrics";

/**
 * world 확장이 한 화면으로 제한되면서 **뷰포트가 world 를 넘어설 수 있게** 됐다
 * (content 밖으로 멀리 pan 한 경우). 그 상태에서 thumb 이 트랙을 넘거나 트랙 밖으로
 * 밀려나지 않아야 한다.
 */
const TRACK = 1000;

function makeMetrics(
  worldMinX: number,
  worldWidth: number,
  viewX: number,
  viewWidth: number,
): ScrollbarViewportMetrics {
  return {
    containerSize: { height: 800, width: 1200 },
    viewportState: { scale: 1, x: 0, y: 0 },
    visibleViewport: { height: 800, width: viewWidth, x: viewX, y: 0 },
    world: {
      minX: worldMinX,
      minY: 0,
      maxX: worldMinX + worldWidth,
      maxY: 800,
      width: worldWidth,
      height: 800,
    },
  };
}

describe("getScrollbarAxisMetrics — world 밖 뷰포트", () => {
  it("뷰포트가 world 오른쪽 밖이면 thumb 을 트랙 끝에 묶는다", () => {
    const axis = getScrollbarAxisMetrics(
      makeMetrics(0, 2000, 9000, 500),
      "horizontal",
      TRACK,
    );

    expect(axis).not.toBeNull();
    expect(axis!.viewportStart).toBe(axis!.scrollableWorld);
    expect(axis!.viewportStart / axis!.scrollableWorld).toBe(1);
  });

  it("뷰포트가 world 왼쪽 밖이면 thumb 을 트랙 시작에 묶는다", () => {
    const axis = getScrollbarAxisMetrics(
      makeMetrics(0, 2000, -9000, 500),
      "horizontal",
      TRACK,
    );

    expect(axis!.viewportStart).toBe(0);
  });

  it("뷰포트가 world 보다 크면 thumb 이 트랙을 넘지 않는다", () => {
    const axis = getScrollbarAxisMetrics(
      makeMetrics(0, 500, 0, 3000),
      "horizontal",
      TRACK,
    );

    expect(axis!.thumbSize).toBe(TRACK);
    expect(axis!.scrollableTrack).toBe(0);
  });

  it("world 안이면 종전대로 비례 매핑", () => {
    const axis = getScrollbarAxisMetrics(
      makeMetrics(0, 2000, 500, 500),
      "horizontal",
      TRACK,
    );

    expect(axis!.thumbSize).toBe(250);
    expect(axis!.viewportStart).toBe(500);
    expect(axis!.scrollableWorld).toBe(1500);
  });
});
