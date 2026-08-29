import { describe, expect, it } from "vitest";
import {
  ACTION_BAR_BOTTOM_GAP,
  ACTION_BAR_PAGE_CLEARANCE,
  ACTION_BAR_PAGE_GAP,
  actionBarPageTransform,
  actionBarTransform,
  clampActionBarOffset,
  defaultActionBarOrigin,
  offsetsEqual,
  pageActionBarAnchor,
  pageAnchorToManualOffset,
} from "./actionBarPlacement";
import { SELECTION_DIMENSION_LABEL_BOTTOM_EXTENT } from "../../../workspace/canvas/selectionOverlayGeometry";

const overlay = { width: 1000, height: 600 };
const bar = { width: 200, height: 40 };

describe("actionBarPlacement — ADR-192 Phase 3", () => {
  it("기본 원점은 하단 중앙 (bottom gap 16)", () => {
    expect(defaultActionBarOrigin(overlay, bar)).toEqual({
      x: 400,
      y: 600 - ACTION_BAR_BOTTOM_GAP - 40,
    });
  });

  it("clamp: 바 전체가 overlay 안에 남는 범위로 자른다", () => {
    // 왼쪽 끝: dx = -origin.x
    expect(clampActionBarOffset({ dx: -9999, dy: 0 }, overlay, bar)).toEqual({
      dx: -400,
      dy: 0,
    });
    // 오른쪽 끝: overlay.width - bar.width - origin.x = 400
    expect(clampActionBarOffset({ dx: 9999, dy: 0 }, overlay, bar)).toEqual({
      dx: 400,
      dy: 0,
    });
    // 위쪽 끝: -origin.y = -544, 아래쪽 끝: +16 (bottom gap 만큼)
    expect(clampActionBarOffset({ dx: 0, dy: -9999 }, overlay, bar)).toEqual({
      dx: 0,
      dy: -544,
    });
    expect(clampActionBarOffset({ dx: 0, dy: 9999 }, overlay, bar)).toEqual({
      dx: 0,
      dy: 16,
    });
    // 범위 안은 그대로 (새 객체)
    const inside = { dx: 10, dy: -20 };
    const out = clampActionBarOffset(inside, overlay, bar);
    expect(out).toEqual(inside);
    expect(out).not.toBe(inside);
  });

  it("뷰포트 축소 후 리로드: 저장된 offset 이 화면 밖이면 안으로 (R4)", () => {
    const small = { width: 300, height: 200 };
    expect(clampActionBarOffset({ dx: 380, dy: -500 }, small, bar)).toEqual({
      dx: 50,
      dy: -144,
    });
  });

  it("overlay 가 바보다 작으면 기본 위치", () => {
    expect(
      clampActionBarOffset({ dx: 5, dy: 5 }, { width: 100, height: 20 }, bar),
    ).toEqual({ dx: 0, dy: 0 });
  });

  it("transform: 기본은 translateX(-50%), offset 은 calc 로 합성", () => {
    expect(actionBarTransform(null)).toBe("translateX(-50%)");
    expect(actionBarTransform({ dx: -30, dy: -8 })).toBe(
      "translate(calc(-50% + -30px), -8px)",
    );
  });

  it("page anchor는 compositor-only translate3d로 합성한다", () => {
    expect(actionBarPageTransform({ x: 300, y: 390 })).toBe(
      "translate3d(300px, 390px, 0) translateX(-50%)",
    );
  });

  it("offsetsEqual", () => {
    expect(offsetsEqual(null, null)).toBe(true);
    expect(offsetsEqual({ dx: 1, dy: 2 }, { dx: 1, dy: 2 })).toBe(true);
    expect(offsetsEqual({ dx: 1, dy: 2 }, null)).toBe(false);
    expect(offsetsEqual({ dx: 1, dy: 2 }, { dx: 1, dy: 3 })).toBe(false);
  });

  it("page 하단 중앙을 viewport screen 좌표로 변환한다", () => {
    expect(
      pageActionBarAnchor({
        pagePosition: { x: 100, y: 80 },
        pageSize: { width: 400, height: 300 },
        panOffset: { x: 20, y: 30 },
        zoom: 0.5,
      }),
    ).toEqual({
      x: 170,
      y: 220 + ACTION_BAR_PAGE_GAP,
    });
  });

  it("page gap은 size info 전체 높이 아래에 별도 여백을 남긴다", () => {
    expect(ACTION_BAR_PAGE_GAP).toBe(
      SELECTION_DIMENSION_LABEL_BOTTOM_EXTENT + ACTION_BAR_PAGE_CLEARANCE,
    );
    expect(ACTION_BAR_PAGE_GAP).toBe(40);
  });

  it("page anchor를 기존 overlay 하단 중앙 수동 offset으로 변환한다", () => {
    expect(pageAnchorToManualOffset({ x: 300, y: 390 }, overlay, bar)).toEqual({
      dx: -200,
      dy: 390 - (600 - ACTION_BAR_BOTTOM_GAP - 40),
    });
  });
});
